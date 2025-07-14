/**
 * Hierarchical Relationship Manager for AI-Trackdown
 * Manages Epic → Issue → Task relationships and dependencies
 */

import type {
  AnyItemData,
  EpicData,
  EpicHierarchy,
  IssueData,
  IssueHierarchy,
  PRData,
  PRHierarchy,
  ProjectConfig,
  SearchFilters,
  SearchResult,
  TaskData,
  TaskHierarchy,
  ValidationError,
  ValidationResult,
} from '../types/ai-trackdown.js';
import { FrontmatterParser } from './frontmatter-parser.js';
import { UnifiedPathResolver } from './unified-path-resolver.js';

export class RelationshipManager {
  private parser: FrontmatterParser;
  private config: ProjectConfig;
  private projectRoot: string;
  private cliTasksDir?: string;

  // In-memory caches for performance
  private epicCache: Map<string, EpicData> = new Map();
  private issueCache: Map<string, IssueData> = new Map();
  private taskCache: Map<string, TaskData> = new Map();
  private prCache: Map<string, PRData> = new Map();

  private lastCacheUpdate: number = 0;
  private cacheExpiry: number = 300000; // 5 minutes

  constructor(config: ProjectConfig, projectRoot?: string, cliTasksDir?: string) {
    this.parser = new FrontmatterParser();
    this.config = config;
    this.projectRoot = projectRoot || process.cwd();
    this.cliTasksDir = cliTasksDir;
  }

  /**
   * Get complete hierarchy for an epic (epic + all issues + all tasks)
   */
  public getEpicHierarchy(epicId: string): EpicHierarchy | null {
    this.refreshCacheIfNeeded();

    const epic = this.epicCache.get(epicId);
    if (!epic) {
      return null;
    }

    const issues = Array.from(this.issueCache.values())
      .filter((issue) => issue.epic_id === epicId)
      .sort((a, b) => a.created_date.localeCompare(b.created_date));

    const tasks = Array.from(this.taskCache.values())
      .filter((task) => task.epic_id === epicId)
      .sort((a, b) => a.created_date.localeCompare(b.created_date));

    const prs = Array.from(this.prCache.values())
      .filter((pr) => pr.epic_id === epicId)
      .sort((a, b) => a.created_date.localeCompare(b.created_date));

    return {
      epic,
      issues,
      tasks,
      prs,
    };
  }

  /**
   * Get hierarchy for an issue (issue + its tasks + parent epic)
   */
  public getIssueHierarchy(issueId: string): IssueHierarchy | null {
    this.refreshCacheIfNeeded();

    const issue = this.issueCache.get(issueId);
    if (!issue) {
      return null;
    }

    const tasks = Array.from(this.taskCache.values())
      .filter((task) => task.issue_id === issueId)
      .sort((a, b) => a.created_date.localeCompare(b.created_date));

    const prs = Array.from(this.prCache.values())
      .filter((pr) => pr.issue_id === issueId)
      .sort((a, b) => a.created_date.localeCompare(b.created_date));

    const epic = this.epicCache.get(issue.epic_id);

    return {
      issue,
      tasks,
      prs,
      epic,
    };
  }

  /**
   * Get hierarchy for a PR (PR + parent issue + parent epic)
   */
  public getPRHierarchy(prId: string): PRHierarchy | null {
    this.refreshCacheIfNeeded();

    const pr = this.prCache.get(prId);
    if (!pr) {
      return null;
    }

    const issue = this.issueCache.get(pr.issue_id);
    if (!issue) {
      return null;
    }

    const epic = this.epicCache.get(pr.epic_id);

    return {
      pr,
      issue,
      epic,
    };
  }

  /**
   * Get hierarchy for a task (task + parent issue + parent epic)
   */
  public getTaskHierarchy(taskId: string): TaskHierarchy | null {
    this.refreshCacheIfNeeded();

    const task = this.taskCache.get(taskId);
    if (!task) {
      return null;
    }

    const issue = this.issueCache.get(task.issue_id);
    if (!issue) {
      return null;
    }

    const epic = task.epic_id ? this.epicCache.get(task.epic_id) : undefined;

    return {
      task,
      issue,
      epic,
    };
  }

  /**
   * Get all children items for a parent ID
   */
  public getChildren(parentId: string, type: 'epic' | 'issue'): AnyItemData[] {
    this.refreshCacheIfNeeded();

    if (type === 'epic') {
      return Array.from(this.issueCache.values()).filter((issue) => issue.epic_id === parentId);
    } else if (type === 'issue') {
      return Array.from(this.taskCache.values()).filter((task) => task.issue_id === parentId);
    }

    return [];
  }

  /**
   * Get parent item for a child ID
   */
  public getParent(childId: string, childType: 'issue' | 'task' | 'pr'): AnyItemData | null {
    this.refreshCacheIfNeeded();

    if (childType === 'issue') {
      const issue = this.issueCache.get(childId);
      return issue ? this.epicCache.get(issue.epic_id) || null : null;
    } else if (childType === 'task') {
      const task = this.taskCache.get(childId);
      return task ? this.issueCache.get(task.issue_id) || null : null;
    } else if (childType === 'pr') {
      const pr = this.prCache.get(childId);
      return pr ? this.issueCache.get(pr.issue_id) || null : null;
    }

    return null;
  }

  /**
   * Get all related items (siblings and dependencies)
   */
  public getRelatedItems(itemId: string): {
    siblings: AnyItemData[];
    dependencies: AnyItemData[];
    dependents: AnyItemData[];
    blocked_by: AnyItemData[];
    blocks: AnyItemData[];
  } {
    this.refreshCacheIfNeeded();

    const item = this.findItemById(itemId);
    if (!item) {
      return { siblings: [], dependencies: [], dependents: [], blocked_by: [], blocks: [] };
    }

    // Get siblings (same parent)
    let siblings: AnyItemData[] = [];
    if ('task_id' in item) {
      siblings = Array.from(this.taskCache.values()).filter(
        (task) => task.issue_id === item.issue_id && task.task_id !== itemId
      );
    } else if ('pr_id' in item) {
      siblings = Array.from(this.prCache.values()).filter(
        (pr) => pr.issue_id === item.issue_id && pr.pr_id !== itemId
      );
    } else if ('issue_id' in item && !('task_id' in item) && !('pr_id' in item)) {
      siblings = Array.from(this.issueCache.values()).filter(
        (issue) => issue.epic_id === item.epic_id && issue.issue_id !== itemId
      );
    }

    // Get dependencies and dependents
    const dependencies = this.resolveDependencies(item.dependencies || []);
    const dependents = this.findDependents(itemId);

    // Get blocked relationships (if item supports it)
    const blocked_by = 'blocked_by' in item ? this.resolveDependencies(item.blocked_by || []) : [];
    const blocks = 'blocks' in item ? this.resolveDependencies(item.blocks || []) : [];

    return {
      siblings,
      dependencies,
      dependents,
      blocked_by,
      blocks,
    };
  }

  /**
   * Search across all items with filters
   */
  public search(filters: SearchFilters): SearchResult<AnyItemData> {
    const startTime = Date.now();
    this.refreshCacheIfNeeded();

    let allItems: AnyItemData[] = [
      ...Array.from(this.epicCache.values()),
      ...Array.from(this.issueCache.values()),
      ...Array.from(this.taskCache.values()),
      ...Array.from(this.prCache.values()),
    ];

    // Apply filters
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      allItems = allItems.filter((item) => statuses.includes(item.status));
    }

    if (filters.priority) {
      const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority];
      allItems = allItems.filter((item) => priorities.includes(item.priority));
    }

    if (filters.assignee) {
      const assignees = Array.isArray(filters.assignee) ? filters.assignee : [filters.assignee];
      allItems = allItems.filter((item) => assignees.includes(item.assignee));
    }

    if (filters.tags) {
      const tags = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
      allItems = allItems.filter((item) => {
        const itemTags = 'tags' in item ? item.tags || [] : [];
        return tags.some((tag) => itemTags.includes(tag));
      });
    }

    if (filters.created_after) {
      allItems = allItems.filter((item) => item.created_date >= filters.created_after!);
    }

    if (filters.created_before) {
      allItems = allItems.filter((item) => item.created_date <= filters.created_before!);
    }

    if (filters.updated_after) {
      allItems = allItems.filter((item) => item.updated_date >= filters.updated_after!);
    }

    if (filters.updated_before) {
      allItems = allItems.filter((item) => item.updated_date <= filters.updated_before!);
    }

    if (filters.content_search) {
      const searchTerm = filters.content_search.toLowerCase();
      allItems = allItems.filter(
        (item) =>
          item.title.toLowerCase().includes(searchTerm) ||
          item.description.toLowerCase().includes(searchTerm) ||
          item.content.toLowerCase().includes(searchTerm)
      );
    }

    if (filters.ai_context_search) {
      const searchTerm = filters.ai_context_search.toLowerCase();
      allItems = allItems.filter((item) =>
        item.ai_context.some((context) => context.toLowerCase().includes(searchTerm))
      );
    }

    const executionTime = Date.now() - startTime;

    return {
      items: allItems,
      total_count: allItems.length,
      search_query: filters,
      execution_time: executionTime,
    };
  }

  /**
   * Validate relationships and hierarchical integrity
   */
  public validateRelationships(): ValidationResult {
    this.refreshCacheIfNeeded();

    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Check orphaned issues (epic_id doesn't exist)
    for (const issue of this.issueCache.values()) {
      if (!this.epicCache.has(issue.epic_id)) {
        errors.push({
          field: 'epic_id',
          message: `Issue ${issue.issue_id} references non-existent epic ${issue.epic_id}`,
          severity: 'error',
        });
      }
    }

    // Check orphaned tasks (issue_id doesn't exist)
    for (const task of this.taskCache.values()) {
      if (!this.issueCache.has(task.issue_id)) {
        errors.push({
          field: 'issue_id',
          message: `Task ${task.task_id} references non-existent issue ${task.issue_id}`,
          severity: 'error',
        });
      }

      if (!this.epicCache.has(task.epic_id)) {
        errors.push({
          field: 'epic_id',
          message: `Task ${task.task_id} references non-existent epic ${task.epic_id}`,
          severity: 'error',
        });
      }
    }

    // Check orphaned PRs (issue_id doesn't exist)
    for (const pr of this.prCache.values()) {
      if (!this.issueCache.has(pr.issue_id)) {
        errors.push({
          field: 'issue_id',
          message: `PR ${pr.pr_id} references non-existent issue ${pr.issue_id}`,
          severity: 'error',
        });
      }

      if (!this.epicCache.has(pr.epic_id)) {
        errors.push({
          field: 'epic_id',
          message: `PR ${pr.pr_id} references non-existent epic ${pr.epic_id}`,
          severity: 'error',
        });
      }
    }

    // Check circular dependencies
    const circularDeps = this.findCircularDependencies();
    for (const cycle of circularDeps) {
      errors.push({
        field: 'dependencies',
        message: `Circular dependency detected: ${cycle.join(' → ')}`,
        severity: 'error',
      });
    }

    // Check for inconsistent epic_id in task hierarchy
    for (const task of this.taskCache.values()) {
      const issue = this.issueCache.get(task.issue_id);
      if (issue && task.epic_id !== issue.epic_id) {
        warnings.push({
          field: 'epic_id',
          message: `Task ${task.task_id} epic_id (${task.epic_id}) doesn't match issue's epic_id (${issue.epic_id})`,
          severity: 'warning',
        });
      }
    }

    // Check for inconsistent epic_id in PR hierarchy
    for (const pr of this.prCache.values()) {
      const issue = this.issueCache.get(pr.issue_id);
      if (issue && pr.epic_id !== issue.epic_id) {
        warnings.push({
          field: 'epic_id',
          message: `PR ${pr.pr_id} epic_id (${pr.epic_id}) doesn't match issue's epic_id (${issue.epic_id})`,
          severity: 'warning',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Rebuild all caches from filesystem
   */
  public rebuildCache(): void {
    this.epicCache.clear();
    this.issueCache.clear();
    this.taskCache.clear();
    this.prCache.clear();

    // Get absolute paths using UnifiedPathResolver
    const pathResolver = new UnifiedPathResolver(this.config, this.projectRoot, this.cliTasksDir);
    const paths = pathResolver.getUnifiedPaths();

    // Load epics
    const epics = this.parser.parseDirectory(paths.epicsDir, 'epic');
    for (const epic of epics as EpicData[]) {
      this.epicCache.set(epic.epic_id, epic);
    }

    // Load issues
    const issues = this.parser.parseDirectory(paths.issuesDir, 'issue');
    for (const issue of issues as IssueData[]) {
      this.issueCache.set(issue.issue_id, issue);
    }

    // Load tasks
    const tasks = this.parser.parseDirectory(paths.tasksDir, 'task');
    for (const task of tasks as TaskData[]) {
      this.taskCache.set(task.task_id, task);
    }

    // Load PRs
    const prs = this.parser.parseDirectory(paths.prsDir, 'pr');
    for (const pr of prs as PRData[]) {
      this.prCache.set(pr.pr_id, pr);
    }

    this.lastCacheUpdate = Date.now();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    epics: number;
    issues: number;
    tasks: number;
    prs: number;
    lastUpdate: Date;
    isStale: boolean;
  } {
    return {
      epics: this.epicCache.size,
      issues: this.issueCache.size,
      tasks: this.taskCache.size,
      prs: this.prCache.size,
      lastUpdate: new Date(this.lastCacheUpdate),
      isStale: Date.now() - this.lastCacheUpdate > this.cacheExpiry,
    };
  }

  /**
   * Force refresh cache if stale
   */
  private refreshCacheIfNeeded(): void {
    if (Date.now() - this.lastCacheUpdate > this.cacheExpiry) {
      this.rebuildCache();
    }
  }

  /**
   * Find item by ID across all caches
   */
  private findItemById(itemId: string): AnyItemData | null {
    return (
      this.epicCache.get(itemId) ||
      this.issueCache.get(itemId) ||
      this.taskCache.get(itemId) ||
      this.prCache.get(itemId) ||
      null
    );
  }

  /**
   * Resolve dependency IDs to actual items
   */
  private resolveDependencies(dependencyIds: string[]): AnyItemData[] {
    const dependencies: AnyItemData[] = [];

    for (const depId of dependencyIds) {
      const item = this.findItemById(depId);
      if (item) {
        dependencies.push(item);
      }
    }

    return dependencies;
  }

  /**
   * Find items that depend on the given item
   */
  private findDependents(itemId: string): AnyItemData[] {
    const dependents: AnyItemData[] = [];

    const allItems = [
      ...Array.from(this.epicCache.values()),
      ...Array.from(this.issueCache.values()),
      ...Array.from(this.taskCache.values()),
      ...Array.from(this.prCache.values()),
    ];

    for (const item of allItems) {
      if (item.dependencies?.includes(itemId)) {
        dependents.push(item);
      }
    }

    return dependents;
  }

  /**
   * Find circular dependencies using DFS
   */
  private findCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const allItems = [
      ...Array.from(this.epicCache.values()),
      ...Array.from(this.issueCache.values()),
      ...Array.from(this.taskCache.values()),
      ...Array.from(this.prCache.values()),
    ];

    for (const item of allItems) {
      const itemId = this.getItemId(item);
      if (!visited.has(itemId)) {
        const path: string[] = [];
        this.dfsForCycles(itemId, visited, recursionStack, path, cycles);
      }
    }

    return cycles;
  }

  /**
   * DFS helper for cycle detection
   */
  private dfsForCycles(
    itemId: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[],
    cycles: string[][]
  ): void {
    visited.add(itemId);
    recursionStack.add(itemId);
    path.push(itemId);

    const item = this.findItemById(itemId);
    if (item?.dependencies) {
      for (const depId of item.dependencies) {
        if (!visited.has(depId)) {
          this.dfsForCycles(depId, visited, recursionStack, path, cycles);
        } else if (recursionStack.has(depId)) {
          // Found a cycle
          const cycleStart = path.indexOf(depId);
          const cycle = path.slice(cycleStart).concat([depId]);
          cycles.push(cycle);
        }
      }
    }

    recursionStack.delete(itemId);
    path.pop();
  }

  /**
   * Get appropriate ID field from any item
   */
  private getItemId(item: AnyItemData): string {
    if ('epic_id' in item && !('issue_id' in item)) {
      return item.epic_id;
    } else if ('issue_id' in item && !('task_id' in item) && !('pr_id' in item)) {
      return item.issue_id;
    } else if ('task_id' in item) {
      return item.task_id;
    } else if ('pr_id' in item) {
      return item.pr_id;
    }
    throw new Error('Unknown item type');
  }

  /**
   * Get project overview statistics
   */
  public getProjectOverview(): {
    totals: { epics: number; issues: number; tasks: number; prs: number };
    status_breakdown: Record<string, number>;
    priority_breakdown: Record<string, number>;
    completion_metrics: {
      completed_epics: number;
      completed_issues: number;
      completed_tasks: number;
      completed_prs: number;
      overall_completion: number;
    };
  } {
    this.refreshCacheIfNeeded();

    const allItems = [
      ...Array.from(this.epicCache.values()),
      ...Array.from(this.issueCache.values()),
      ...Array.from(this.taskCache.values()),
      ...Array.from(this.prCache.values()),
    ];

    const statusBreakdown: Record<string, number> = {};
    const priorityBreakdown: Record<string, number> = {};

    for (const item of allItems) {
      statusBreakdown[item.status] = (statusBreakdown[item.status] || 0) + 1;
      priorityBreakdown[item.priority] = (priorityBreakdown[item.priority] || 0) + 1;
    }

    const completedEpics = Array.from(this.epicCache.values()).filter(
      (e) => e.status === 'completed'
    ).length;
    const completedIssues = Array.from(this.issueCache.values()).filter(
      (i) => i.status === 'completed'
    ).length;
    const completedTasks = Array.from(this.taskCache.values()).filter(
      (t) => t.status === 'completed'
    ).length;
    const completedPRs = Array.from(this.prCache.values()).filter(
      (p) => p.status === 'completed' || p.pr_status === 'merged'
    ).length;

    const totalItems = allItems.length;
    const completedItems = completedEpics + completedIssues + completedTasks + completedPRs;
    const overallCompletion = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

    return {
      totals: {
        epics: this.epicCache.size,
        issues: this.issueCache.size,
        tasks: this.taskCache.size,
        prs: this.prCache.size,
      },
      status_breakdown: statusBreakdown,
      priority_breakdown: priorityBreakdown,
      completion_metrics: {
        completed_epics: completedEpics,
        completed_issues: completedIssues,
        completed_tasks: completedTasks,
        completed_prs: completedPRs,
        overall_completion: Math.round(overallCompletion * 100) / 100,
      },
    };
  }

  /**
   * Get all PRs
   */
  public getAllPRs(): PRData[] {
    this.refreshCacheIfNeeded();
    return Array.from(this.prCache.values());
  }

  /**
   * Get all epics
   */
  public getAllEpics(): EpicData[] {
    this.refreshCacheIfNeeded();
    return Array.from(this.epicCache.values());
  }

  /**
   * Get all issues
   */
  public getAllIssues(): IssueData[] {
    this.refreshCacheIfNeeded();
    return Array.from(this.issueCache.values());
  }

  /**
   * Get all tasks
   */
  public getAllTasks(): TaskData[] {
    this.refreshCacheIfNeeded();
    return Array.from(this.taskCache.values());
  }
}
