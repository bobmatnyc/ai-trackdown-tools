/**
 * TrackdownIndexManager - High-Performance Index File System for AI-Trackdown
 * Implements .ai-trackdown-index file system to eliminate expensive directory searches
 * 
 * Performance Targets:
 * - Index Load Time: < 10ms for projects with 1000+ items
 * - Update Time: < 5ms for single item updates  
 * - Rebuild Time: < 100ms for full project scan
 * - Memory Usage: < 5MB for large projects
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import type { 
  EpicData, 
  IssueData, 
  TaskData, 
  PRData, 
  AnyItemData,
  ItemType,
  ItemStatus,
  Priority,
  ProjectConfig 
} from '../types/ai-trackdown.js';
import { FrontmatterParser } from './frontmatter-parser.js';
import { UnifiedPathResolver } from './unified-path-resolver.js';

// Async file operations for better performance
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const access = promisify(fs.access);

// Index file format and location
const INDEX_FILE_NAME = '.ai-trackdown-index';
const INDEX_VERSION = '1.0.0';
const MAX_CONCURRENT_READS = 50; // Limit concurrent file reads for performance

// Core index data structure
export interface TrackdownIndexEntry {
  id: string;
  title: string;
  filePath: string;
  status: ItemStatus;
  priority: Priority;
  lastModified: string;
  fileSize: number;
  assignee?: string;
  tags?: string[];
}

export interface EpicIndexEntry extends TrackdownIndexEntry {
  issueIds: string[];
  milestone?: string;
  completion_percentage?: number;
}

export interface IssueIndexEntry extends TrackdownIndexEntry {
  epicId: string;
  taskIds: string[];
  prIds: string[];
  blocked_by?: string[];
  blocks?: string[];
}

export interface TaskIndexEntry extends TrackdownIndexEntry {
  issueId: string;
  epicId: string;
  time_estimate?: string;
  time_spent?: string;
  parent_task?: string;
  subtasks?: string[];
}

export interface PRIndexEntry extends TrackdownIndexEntry {
  issueId: string;
  epicId: string;
  pr_status: string;
  branch_name?: string;
  pr_number?: number;
  reviewers?: string[];
}

export interface TrackdownIndex {
  version: string;
  lastUpdated: string;
  projectPath: string;
  epics: Record<string, EpicIndexEntry>;
  issues: Record<string, IssueIndexEntry>;
  tasks: Record<string, TaskIndexEntry>;
  prs: Record<string, PRIndexEntry>;
  stats: {
    totalEpics: number;
    totalIssues: number;
    totalTasks: number;
    totalPRs: number;
    lastFullScan: string;
    indexSize: number;
    performanceMetrics: {
      lastLoadTime: number;
      lastUpdateTime: number;
      lastRebuildTime: number;
    };
  };
}

// Performance tracking interface
interface PerformanceTracker {
  startTime: number;
  operation: string;
}

export class TrackdownIndexManager {
  private indexPath: string;
  private tasksDir: string;
  private projectPath: string;
  private config: ProjectConfig;
  private pathResolver: UnifiedPathResolver;
  private frontmatterParser: FrontmatterParser;
  
  // Memory cache for performance
  private cachedIndex: TrackdownIndex | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5000; // 5 seconds cache TTL

  constructor(config: ProjectConfig, projectPath: string, cliTasksDir?: string) {
    this.config = config;
    this.projectPath = projectPath;
    this.pathResolver = new UnifiedPathResolver(config, projectPath, cliTasksDir);
    this.frontmatterParser = new FrontmatterParser();
    
    const paths = this.pathResolver.getUnifiedPaths();
    this.tasksDir = paths.tasksRoot;
    this.indexPath = path.join(this.tasksDir, INDEX_FILE_NAME);
  }

  /**
   * Load index with memory caching and performance optimization
   */
  public async loadIndex(): Promise<TrackdownIndex> {
    const tracker = this.startPerformanceTracking('loadIndex');
    
    try {
      // Check memory cache first
      if (this.cachedIndex && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL) {
        this.endPerformanceTracking(tracker);
        return this.cachedIndex;
      }

      // Check if index file exists
      if (!await this.indexExists()) {
        console.warn(`Index file not found at ${this.indexPath}. Rebuilding...`);
        return await this.rebuildIndex();
      }

      // Load from disk
      const indexContent = await readFile(this.indexPath, 'utf8');
      const index = JSON.parse(indexContent) as TrackdownIndex;
      
      // Validate index structure
      if (!this.validateIndexStructure(index)) {
        console.warn('Index file corrupted. Rebuilding...');
        return await this.rebuildIndex();
      }

      // Update cache
      this.cachedIndex = index;
      this.cacheTimestamp = Date.now();

      // Update performance metrics
      const loadTime = this.endPerformanceTracking(tracker);
      index.stats.performanceMetrics.lastLoadTime = loadTime;

      return index;
    } catch (error) {
      console.warn(`Failed to load index: ${error instanceof Error ? error.message : 'Unknown error'}. Rebuilding...`);
      return await this.rebuildIndex();
    }
  }

  /**
   * Save index with atomic writes and compression consideration
   */
  public async saveIndex(index: TrackdownIndex): Promise<void> {
    const tracker = this.startPerformanceTracking('saveIndex');
    
    try {
      // Update metadata
      index.lastUpdated = new Date().toISOString();
      index.projectPath = this.projectPath;
      
      // Calculate stats
      index.stats.totalEpics = Object.keys(index.epics).length;
      index.stats.totalIssues = Object.keys(index.issues).length;
      index.stats.totalTasks = Object.keys(index.tasks).length;
      index.stats.totalPRs = Object.keys(index.prs).length;
      
      // Serialize with proper formatting
      const indexContent = JSON.stringify(index, null, 2);
      index.stats.indexSize = Buffer.byteLength(indexContent, 'utf8');

      // Ensure tasks directory exists
      await this.ensureTasksDirectoryExists();

      // Atomic write using temp file + rename
      const tempPath = `${this.indexPath}.tmp`;
      await writeFile(tempPath, indexContent, 'utf8');
      
      // Rename temp file to final location (atomic operation)
      fs.renameSync(tempPath, this.indexPath);

      // Update cache
      this.cachedIndex = index;
      this.cacheTimestamp = Date.now();

      // Update performance metrics
      const saveTime = this.endPerformanceTracking(tracker);
      index.stats.performanceMetrics.lastUpdateTime = saveTime;

    } catch (error) {
      throw new Error(`Failed to save index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Rebuild entire index by scanning filesystem
   */
  public async rebuildIndex(): Promise<TrackdownIndex> {
    const tracker = this.startPerformanceTracking('rebuildIndex');
    
    console.log('🔄 Rebuilding AI-Trackdown index...');
    
    const newIndex: TrackdownIndex = {
      version: INDEX_VERSION,
      lastUpdated: new Date().toISOString(),
      projectPath: this.projectPath,
      epics: {},
      issues: {},
      tasks: {},
      prs: {},
      stats: {
        totalEpics: 0,
        totalIssues: 0,
        totalTasks: 0,
        totalPRs: 0,
        lastFullScan: new Date().toISOString(),
        indexSize: 0,
        performanceMetrics: {
          lastLoadTime: 0,
          lastUpdateTime: 0,
          lastRebuildTime: 0
        }
      }
    };

    try {
      const paths = this.pathResolver.getUnifiedPaths();
      
      // Parallel processing for better performance
      const scanTasks = [
        this.scanDirectory(paths.epicsDir, 'epic'),
        this.scanDirectory(paths.issuesDir, 'issue'), 
        this.scanDirectory(paths.tasksDir, 'task'),
        this.scanDirectory(paths.prsDir, 'pr')
      ];

      const [epics, issues, tasks, prs] = await Promise.all(scanTasks);

      // Populate index with scanned data
      for (const epic of epics) {
        newIndex.epics[epic.id] = await this.createEpicIndexEntry(epic as EpicData);
      }

      for (const issue of issues) {
        newIndex.issues[issue.id] = await this.createIssueIndexEntry(issue as IssueData);
      }

      for (const task of tasks) {
        newIndex.tasks[task.id] = await this.createTaskIndexEntry(task as TaskData);
      }

      for (const pr of prs) {
        newIndex.prs[pr.id] = await this.createPRIndexEntry(pr as PRData);
      }

      // Build relationships
      this.buildRelationships(newIndex);

      // Save the new index
      await this.saveIndex(newIndex);

      const rebuildTime = this.endPerformanceTracking(tracker);
      newIndex.stats.performanceMetrics.lastRebuildTime = rebuildTime;

      console.log(`✅ Index rebuilt successfully in ${rebuildTime}ms`);
      console.log(`📊 Indexed: ${newIndex.stats.totalEpics} epics, ${newIndex.stats.totalIssues} issues, ${newIndex.stats.totalTasks} tasks, ${newIndex.stats.totalPRs} PRs`);

      return newIndex;
    } catch (error) {
      throw new Error(`Failed to rebuild index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update single item in index (incremental update)
   */
  public async updateItem(type: ItemType, id: string): Promise<void> {
    const tracker = this.startPerformanceTracking('updateItem');
    
    try {
      const index = await this.loadIndex();
      const filePath = await this.findItemFile(type, id);
      
      if (!filePath || !fs.existsSync(filePath)) {
        // Item was deleted, remove from index
        await this.removeItem(type, id);
        return;
      }

      // Parse the updated file
      const itemData = this.frontmatterParser.parseAnyItem(filePath);
      
      // Update the appropriate index section
      switch (type) {
        case 'epic':
          index.epics[id] = await this.createEpicIndexEntry(itemData as EpicData);
          break;
        case 'issue':
          index.issues[id] = await this.createIssueIndexEntry(itemData as IssueData);
          break;
        case 'task':
          index.tasks[id] = await this.createTaskIndexEntry(itemData as TaskData);
          break;
        case 'pr':
          index.prs[id] = await this.createPRIndexEntry(itemData as PRData);
          break;
      }

      // Rebuild relationships for this item
      this.updateRelationships(index, type, id);

      // Save updated index
      await this.saveIndex(index);
      
      this.endPerformanceTracking(tracker);
    } catch (error) {
      throw new Error(`Failed to update item ${type}/${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove item from index
   */
  public async removeItem(type: ItemType, id: string): Promise<void> {
    const tracker = this.startPerformanceTracking('removeItem');
    
    try {
      const index = await this.loadIndex();
      
      // Remove from appropriate index section
      switch (type) {
        case 'epic':
          delete index.epics[id];
          // Remove related issues and tasks
          for (const issueId of Object.keys(index.issues)) {
            if (index.issues[issueId].epicId === id) {
              delete index.issues[issueId];
            }
          }
          for (const taskId of Object.keys(index.tasks)) {
            if (index.tasks[taskId].epicId === id) {
              delete index.tasks[taskId];
            }
          }
          break;
        case 'issue':
          delete index.issues[id];
          // Remove related tasks and PRs
          for (const taskId of Object.keys(index.tasks)) {
            if (index.tasks[taskId].issueId === id) {
              delete index.tasks[taskId];
            }
          }
          for (const prId of Object.keys(index.prs)) {
            if (index.prs[prId].issueId === id) {
              delete index.prs[prId];
            }
          }
          break;
        case 'task':
          delete index.tasks[id];
          break;
        case 'pr':
          delete index.prs[id];
          break;
      }

      // Clean up relationships
      this.cleanupRelationships(index, type, id);

      // Save updated index
      await this.saveIndex(index);
      
      this.endPerformanceTracking(tracker);
    } catch (error) {
      throw new Error(`Failed to remove item ${type}/${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate index structure and detect corruption
   */
  public async validateIndex(): Promise<boolean> {
    try {
      const index = await this.loadIndex();
      return this.validateIndexStructure(index);
    } catch {
      return false;
    }
  }

  /**
   * Get index statistics and health information
   */
  public async getIndexStats(): Promise<TrackdownIndex['stats'] & { 
    healthy: boolean; 
    cacheHit: boolean;
    indexFileExists: boolean;
    lastModified?: Date;
  }> {
    try {
      const indexExists = await this.indexExists();
      let lastModified: Date | undefined;
      
      if (indexExists) {
        const stats = await stat(this.indexPath);
        lastModified = stats.mtime;
      }

      const index = await this.loadIndex();
      const cacheHit = (Date.now() - this.cacheTimestamp) < this.CACHE_TTL;
      
      return {
        ...index.stats,
        healthy: this.validateIndexStructure(index),
        cacheHit,
        indexFileExists: indexExists,
        lastModified
      };
    } catch (error) {
      return {
        totalEpics: 0,
        totalIssues: 0,
        totalTasks: 0,
        totalPRs: 0,
        lastFullScan: '',
        indexSize: 0,
        performanceMetrics: {
          lastLoadTime: 0,
          lastUpdateTime: 0,
          lastRebuildTime: 0
        },
        healthy: false,
        cacheHit: false,
        indexFileExists: false
      };
    }
  }

  /**
   * Clear memory cache (useful for testing or forcing reload)
   */
  public clearCache(): void {
    this.cachedIndex = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Get all items of a specific type with fast index lookup
   */
  public async getItemsByType(type: ItemType): Promise<TrackdownIndexEntry[]> {
    const index = await this.loadIndex();
    
    switch (type) {
      case 'epic':
        return Object.values(index.epics);
      case 'issue':
        return Object.values(index.issues);
      case 'task':
        return Object.values(index.tasks);
      case 'pr':
        return Object.values(index.prs);
      default:
        return [];
    }
  }

  /**
   * Fast item lookup by ID
   */
  public async getItemById(type: ItemType, id: string): Promise<TrackdownIndexEntry | null> {
    const index = await this.loadIndex();
    
    switch (type) {
      case 'epic':
        return index.epics[id] || null;
      case 'issue':
        return index.issues[id] || null;
      case 'task':
        return index.tasks[id] || null;
      case 'pr':
        return index.prs[id] || null;
      default:
        return null;
    }
  }

  /**
   * Get items by status with fast filtering
   */
  public async getItemsByStatus(status: ItemStatus): Promise<TrackdownIndexEntry[]> {
    const index = await this.loadIndex();
    const allItems: TrackdownIndexEntry[] = [
      ...Object.values(index.epics),
      ...Object.values(index.issues),
      ...Object.values(index.tasks),
      ...Object.values(index.prs)
    ];
    
    return allItems.filter(item => item.status === status);
  }

  /**
   * Get project overview with pre-calculated metrics
   */
  public async getProjectOverview(): Promise<{
    totalItems: number;
    byStatus: Record<ItemStatus, number>;
    byPriority: Record<Priority, number>;
    byType: Record<ItemType, number>;
    completionRate: number;
    recentActivity: TrackdownIndexEntry[];
  }> {
    const index = await this.loadIndex();
    const allItems: TrackdownIndexEntry[] = [
      ...Object.values(index.epics),
      ...Object.values(index.issues),
      ...Object.values(index.tasks),
      ...Object.values(index.prs)
    ];

    // Calculate metrics
    const byStatus = allItems.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<ItemStatus, number>);

    const byPriority = allItems.reduce((acc, item) => {
      acc[item.priority] = (acc[item.priority] || 0) + 1;
      return acc;
    }, {} as Record<Priority, number>);

    const byType: Record<ItemType, number> = {
      epic: index.stats.totalEpics,
      issue: index.stats.totalIssues,
      task: index.stats.totalTasks,
      pr: index.stats.totalPRs
    };

    const completedItems = byStatus.completed || 0;
    const completionRate = allItems.length > 0 ? Math.round((completedItems / allItems.length) * 100) : 0;

    // Get recent activity (last 7 days)
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const recentActivity = allItems
      .filter(item => new Date(item.lastModified) >= lastWeek)
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
      .slice(0, 10);

    return {
      totalItems: allItems.length,
      byStatus,
      byPriority,
      byType,
      completionRate,
      recentActivity
    };
  }

  // Private helper methods

  private async indexExists(): Promise<boolean> {
    try {
      await access(this.indexPath);
      return true;
    } catch {
      return false;
    }
  }

  private validateIndexStructure(index: TrackdownIndex): boolean {
    return !!(
      index.version &&
      index.lastUpdated &&
      index.projectPath &&
      index.epics &&
      index.issues &&
      index.tasks &&
      index.prs &&
      index.stats
    );
  }

  private async ensureTasksDirectoryExists(): Promise<void> {
    try {
      await access(this.tasksDir);
    } catch {
      fs.mkdirSync(this.tasksDir, { recursive: true });
    }
  }

  private async scanDirectory(dirPath: string, itemType: ItemType): Promise<AnyItemData[]> {
    try {
      await access(dirPath);
    } catch {
      return []; // Directory doesn't exist
    }

    const files = await readdir(dirPath);
    const mdFiles = files.filter(file => file.endsWith('.md'));
    
    // Process files in batches to avoid overwhelming the system
    const results: AnyItemData[] = [];
    const batchSize = Math.min(MAX_CONCURRENT_READS, mdFiles.length);
    
    for (let i = 0; i < mdFiles.length; i += batchSize) {
      const batch = mdFiles.slice(i, i + batchSize);
      const batchPromises = batch.map(async (file) => {
        try {
          const filePath = path.join(dirPath, file);
          return this.frontmatterParser.parseAnyItem(filePath);
        } catch (error) {
          console.warn(`Failed to parse ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(Boolean) as AnyItemData[]);
    }

    return results;
  }

  private async createEpicIndexEntry(epic: EpicData): Promise<EpicIndexEntry> {
    const stats = await stat(epic.file_path);
    return {
      id: epic.epic_id,
      title: epic.title,
      filePath: epic.file_path,
      status: epic.status,
      priority: epic.priority,
      lastModified: epic.updated_date,
      fileSize: stats.size,
      assignee: epic.assignee !== 'unassigned' ? epic.assignee : undefined,
      tags: epic.tags,
      issueIds: epic.related_issues || [],
      milestone: epic.milestone,
      completion_percentage: epic.completion_percentage
    };
  }

  private async createIssueIndexEntry(issue: IssueData): Promise<IssueIndexEntry> {
    const stats = await stat(issue.file_path);
    return {
      id: issue.issue_id,
      title: issue.title,
      filePath: issue.file_path,
      status: issue.status,
      priority: issue.priority,
      lastModified: issue.updated_date,
      fileSize: stats.size,
      assignee: issue.assignee !== 'unassigned' ? issue.assignee : undefined,
      tags: issue.tags,
      epicId: issue.epic_id,
      taskIds: issue.related_tasks || [],
      prIds: issue.related_prs || [],
      blocked_by: issue.blocked_by,
      blocks: issue.blocks
    };
  }

  private async createTaskIndexEntry(task: TaskData): Promise<TaskIndexEntry> {
    const stats = await stat(task.file_path);
    return {
      id: task.task_id,
      title: task.title,
      filePath: task.file_path,
      status: task.status,
      priority: task.priority,
      lastModified: task.updated_date,
      fileSize: stats.size,
      assignee: task.assignee !== 'unassigned' ? task.assignee : undefined,
      tags: task.tags,
      issueId: task.issue_id,
      epicId: task.epic_id,
      time_estimate: task.time_estimate,
      time_spent: task.time_spent,
      parent_task: task.parent_task,
      subtasks: task.subtasks
    };
  }

  private async createPRIndexEntry(pr: PRData): Promise<PRIndexEntry> {
    const stats = await stat(pr.file_path);
    return {
      id: pr.pr_id,
      title: pr.title,
      filePath: pr.file_path,
      status: pr.status,
      priority: pr.priority,
      lastModified: pr.updated_date,
      fileSize: stats.size,
      assignee: pr.assignee !== 'unassigned' ? pr.assignee : undefined,
      tags: pr.tags,
      issueId: pr.issue_id,
      epicId: pr.epic_id,
      pr_status: pr.pr_status,
      branch_name: pr.branch_name,
      pr_number: pr.pr_number,
      reviewers: pr.reviewers
    };
  }

  private buildRelationships(index: TrackdownIndex): void {
    // Build Epic -> Issues relationships
    for (const epic of Object.values(index.epics)) {
      epic.issueIds = Object.values(index.issues)
        .filter(issue => issue.epicId === epic.id)
        .map(issue => issue.id);
    }

    // Build Issue -> Tasks/PRs relationships
    for (const issue of Object.values(index.issues)) {
      issue.taskIds = Object.values(index.tasks)
        .filter(task => task.issueId === issue.id)
        .map(task => task.id);
      
      issue.prIds = Object.values(index.prs)
        .filter(pr => pr.issueId === issue.id)
        .map(pr => pr.id);
    }
  }

  private updateRelationships(index: TrackdownIndex, type: ItemType, id: string): void {
    // This is a simplified version - in production, you'd want more sophisticated relationship tracking
    this.buildRelationships(index);
  }

  private cleanupRelationships(index: TrackdownIndex, type: ItemType, id: string): void {
    // Remove references to deleted items
    switch (type) {
      case 'epic':
        for (const epic of Object.values(index.epics)) {
          epic.issueIds = epic.issueIds.filter(issueId => issueId !== id);
        }
        break;
      case 'issue':
        for (const issue of Object.values(index.issues)) {
          issue.taskIds = issue.taskIds.filter(taskId => taskId !== id);
          issue.prIds = issue.prIds.filter(prId => prId !== id);
        }
        break;
    }
  }

  private async findItemFile(type: ItemType, id: string): Promise<string | null> {
    const paths = this.pathResolver.getUnifiedPaths();
    const typeDir = this.pathResolver.getItemTypeDirectory(type);
    
    try {
      const files = await readdir(typeDir);
      const mdFiles = files.filter(file => file.endsWith('.md'));
      
      for (const file of mdFiles) {
        if (file.includes(id)) {
          return path.join(typeDir, file);
        }
      }
    } catch {
      // Directory doesn't exist or other error
    }
    
    return null;
  }

  private startPerformanceTracking(operation: string): PerformanceTracker {
    return {
      startTime: Date.now(),
      operation
    };
  }

  private endPerformanceTracking(tracker: PerformanceTracker): number {
    const duration = Date.now() - tracker.startTime;
    
    // Log performance if it's unusually slow
    if (duration > 100) {
      console.warn(`⚠️ Slow ${tracker.operation}: ${duration}ms`);
    }
    
    return duration;
  }
}