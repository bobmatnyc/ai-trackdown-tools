/**
 * GitHub Sync Engine
 * Handles bidirectional sync between local issues and GitHub Issues
 */

import * as fs from 'fs';
import * as path from 'path';
import { GitHubClient } from '../utils/github-client.js';
import { ConfigManager } from '../utils/config-manager.js';
import { FrontmatterParser } from '../utils/frontmatter-parser.js';
import { Formatter } from '../utils/formatter.js';
import { 
  IssueData, 
  IssueFrontmatter, 
  GitHubIssue, 
  GitHubSyncConfig, 
  SyncOperation, 
  SyncResult,
  SyncStatus,
  ProjectConfig,
  ItemStatus
} from '../types/ai-trackdown.js';

export class GitHubSyncEngine {
  private client: GitHubClient;
  private configManager: ConfigManager;
  private config: ProjectConfig;
  private syncConfig: GitHubSyncConfig;
  private frontmatterParser: FrontmatterParser;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.config = configManager.getConfig();
    this.frontmatterParser = new FrontmatterParser();
    
    if (!this.config.github_sync?.enabled) {
      throw new Error('GitHub sync is not enabled in project configuration');
    }
    
    this.syncConfig = this.config.github_sync;
    this.client = new GitHubClient(this.syncConfig);
  }

  /**
   * Test GitHub connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    return await this.client.testConnection();
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const rateLimit = await this.client.getRateLimit();
      const localIssues = await this.getLocalIssues();
      const syncMetaFile = this.getSyncMetaPath();
      
      let lastSync = '';
      let conflicts = 0;
      
      if (fs.existsSync(syncMetaFile)) {
        const syncMeta = JSON.parse(fs.readFileSync(syncMetaFile, 'utf8'));
        lastSync = syncMeta.last_sync || '';
        conflicts = syncMeta.conflicts || 0;
      }

      return {
        enabled: this.syncConfig.enabled,
        repository: this.syncConfig.repository,
        last_sync: lastSync,
        auto_sync: this.syncConfig.auto_sync,
        pending_operations: localIssues.filter(issue => 
          issue.sync_status === 'local' || issue.sync_status === 'conflict'
        ).length,
        conflicts,
        sync_health: rateLimit.remaining > 100 ? 'healthy' : 'degraded',
      };
    } catch (error) {
      return {
        enabled: this.syncConfig.enabled,
        repository: this.syncConfig.repository,
        last_sync: '',
        auto_sync: this.syncConfig.auto_sync,
        pending_operations: 0,
        conflicts: 0,
        sync_health: 'failed',
      };
    }
  }

  /**
   * Push local changes to GitHub
   */
  async pushToGitHub(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      operations: [],
      errors: [],
      conflicts: [],
      pushed_count: 0,
      pulled_count: 0,
      skipped_count: 0,
      conflict_count: 0,
    };

    try {
      const localIssues = await this.getLocalIssues();
      const githubIssues = await this.client.getAllIssues();
      
      // Create ID mappings
      const githubIssuesMap = new Map(githubIssues.map(issue => [issue.number, issue]));
      
      for (const localIssue of localIssues) {
        const operation = await this.processPushOperation(localIssue, githubIssuesMap);
        result.operations.push(operation);
        
        if (operation.type === 'push') {
          result.pushed_count++;
        } else if (operation.type === 'conflict') {
          result.conflicts.push(operation);
          result.conflict_count++;
        } else {
          result.skipped_count++;
        }
      }

      // Update sync metadata
      await this.updateSyncMetadata(result);
      
      result.success = result.errors.length === 0;
      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error during push');
      return result;
    }
  }

  /**
   * Pull changes from GitHub
   */
  async pullFromGitHub(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      operations: [],
      errors: [],
      conflicts: [],
      pushed_count: 0,
      pulled_count: 0,
      skipped_count: 0,
      conflict_count: 0,
    };

    try {
      const githubIssues = await this.client.getAllIssues();
      const localIssues = await this.getLocalIssues();
      
      // Create ID mappings
      const localIssuesMap = new Map(
        localIssues
          .filter(issue => issue.github_number)
          .map(issue => [issue.github_number!, issue])
      );
      
      for (const githubIssue of githubIssues) {
        const operation = await this.processPullOperation(githubIssue, localIssuesMap);
        result.operations.push(operation);
        
        if (operation.type === 'pull') {
          result.pulled_count++;
        } else if (operation.type === 'conflict') {
          result.conflicts.push(operation);
          result.conflict_count++;
        } else {
          result.skipped_count++;
        }
      }

      // Update sync metadata
      await this.updateSyncMetadata(result);
      
      result.success = result.errors.length === 0;
      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error during pull');
      return result;
    }
  }

  /**
   * Bidirectional sync with conflict resolution
   */
  async bidirectionalSync(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      operations: [],
      errors: [],
      conflicts: [],
      pushed_count: 0,
      pulled_count: 0,
      skipped_count: 0,
      conflict_count: 0,
    };

    try {
      const localIssues = await this.getLocalIssues();
      const githubIssues = await this.client.getAllIssues();
      
      // Create ID mappings
      const githubIssuesMap = new Map(githubIssues.map(issue => [issue.number, issue]));
      const localIssuesMap = new Map(
        localIssues
          .filter(issue => issue.github_number)
          .map(issue => [issue.github_number!, issue])
      );

      // Process local issues (push operations)
      for (const localIssue of localIssues) {
        const operation = await this.processBidirectionalOperation(localIssue, githubIssuesMap, 'push');
        result.operations.push(operation);
        this.updateResultCounters(result, operation);
      }

      // Process GitHub issues not in local (pull operations)
      for (const githubIssue of githubIssues) {
        if (!localIssuesMap.has(githubIssue.number)) {
          const operation = await this.processBidirectionalOperation(null, githubIssuesMap, 'pull', githubIssue);
          result.operations.push(operation);
          this.updateResultCounters(result, operation);
        }
      }

      // Update sync metadata
      await this.updateSyncMetadata(result);
      
      result.success = result.errors.length === 0;
      return result;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error during bidirectional sync');
      return result;
    }
  }

  /**
   * Process push operation for a local issue
   */
  private async processPushOperation(
    localIssue: IssueData,
    githubIssuesMap: Map<number, GitHubIssue>
  ): Promise<SyncOperation> {
    const operation: SyncOperation = {
      type: 'push',
      local_issue: localIssue,
      action: 'skip',
      reason: 'No changes needed',
    };

    try {
      if (localIssue.github_number) {
        // Update existing GitHub issue
        const githubIssue = githubIssuesMap.get(localIssue.github_number);
        if (githubIssue) {
          operation.github_issue = githubIssue;
          
          // Check for conflicts
          if (await this.hasConflict(localIssue, githubIssue)) {
            operation.type = 'conflict';
            operation.reason = 'Conflict detected - both local and GitHub have changes';
            return operation;
          }
          
          // Update GitHub issue
          const updatedGitHubIssue = await this.client.updateIssue(localIssue.github_number, {
            title: localIssue.title,
            body: this.createGitHubIssueBody(localIssue),
            state: this.mapStatusToGitHubState(localIssue.status),
            assignee: this.syncConfig.sync_assignees ? localIssue.assignee : undefined,
            labels: this.syncConfig.sync_labels ? localIssue.tags : undefined,
          });
          
          operation.action = 'update';
          operation.github_issue = updatedGitHubIssue;
          
          // Update local issue with GitHub metadata
          await this.updateLocalIssueWithGitHubMetadata(localIssue, updatedGitHubIssue);
        }
      } else {
        // Create new GitHub issue
        const newGitHubIssue = await this.client.createIssue({
          title: localIssue.title,
          body: this.createGitHubIssueBody(localIssue),
          assignee: this.syncConfig.sync_assignees ? localIssue.assignee : undefined,
          labels: this.syncConfig.sync_labels ? localIssue.tags : undefined,
        });
        
        operation.action = 'create';
        operation.github_issue = newGitHubIssue;
        
        // Update local issue with GitHub metadata
        await this.updateLocalIssueWithGitHubMetadata(localIssue, newGitHubIssue);
      }
    } catch (error) {
      operation.reason = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    return operation;
  }

  /**
   * Process pull operation for a GitHub issue
   */
  private async processPullOperation(
    githubIssue: GitHubIssue,
    localIssuesMap: Map<number, IssueData>
  ): Promise<SyncOperation> {
    const operation: SyncOperation = {
      type: 'pull',
      local_issue: {} as IssueData,
      github_issue: githubIssue,
      action: 'skip',
      reason: 'No changes needed',
    };

    try {
      const localIssue = localIssuesMap.get(githubIssue.number);
      
      if (localIssue) {
        // Update existing local issue
        operation.local_issue = localIssue;
        
        // Check for conflicts
        if (await this.hasConflict(localIssue, githubIssue)) {
          operation.type = 'conflict';
          operation.reason = 'Conflict detected - both local and GitHub have changes';
          return operation;
        }
        
        // Update local issue
        await this.updateLocalIssueFromGitHub(localIssue, githubIssue);
        operation.action = 'update';
      } else {
        // Create new local issue
        const newLocalIssue = await this.createLocalIssueFromGitHub(githubIssue);
        operation.local_issue = newLocalIssue;
        operation.action = 'create';
      }
    } catch (error) {
      operation.reason = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    return operation;
  }

  /**
   * Process bidirectional operation
   */
  private async processBidirectionalOperation(
    localIssue: IssueData | null,
    githubIssuesMap: Map<number, GitHubIssue>,
    direction: 'push' | 'pull',
    githubIssue?: GitHubIssue
  ): Promise<SyncOperation> {
    if (direction === 'push' && localIssue) {
      return this.processPushOperation(localIssue, githubIssuesMap);
    } else if (direction === 'pull' && githubIssue) {
      const localIssuesMap = new Map<number, IssueData>();
      return this.processPullOperation(githubIssue, localIssuesMap);
    }
    
    return {
      type: direction,
      local_issue: localIssue || {} as IssueData,
      github_issue: githubIssue,
      action: 'skip',
      reason: 'Invalid operation parameters',
    };
  }

  /**
   * Check if there's a conflict between local and GitHub issues
   */
  private async hasConflict(localIssue: IssueData, githubIssue: GitHubIssue): Promise<boolean> {
    if (this.syncConfig.conflict_resolution === 'local_wins' || this.syncConfig.conflict_resolution === 'remote_wins') {
      return false;
    }
    
    // Check if both have been updated since last sync
    const localUpdated = new Date(localIssue.updated_date);
    const githubUpdated = new Date(githubIssue.updated_at);
    const lastSync = await this.getLastSyncTime();
    
    return localUpdated > lastSync && githubUpdated > lastSync;
  }

  /**
   * Get local issues from the file system
   */
  private async getLocalIssues(): Promise<IssueData[]> {
    const paths = this.configManager.getAbsolutePaths();
    const issuesDir = paths.issuesDir;
    
    if (!fs.existsSync(issuesDir)) {
      return [];
    }
    
    const issues: IssueData[] = [];
    const files = fs.readdirSync(issuesDir).filter(file => file.endsWith('.md'));
    
    for (const file of files) {
      try {
        const filePath = path.join(issuesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = this.frontmatterParser.parse(content);
        
        const issueData: IssueData = {
          ...parsed.frontmatter as IssueFrontmatter,
          content: parsed.content,
          file_path: filePath,
        };
        
        issues.push(issueData);
      } catch (error) {
        console.warn(`Failed to parse issue file ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return issues;
  }

  /**
   * Create GitHub issue body from local issue
   */
  private createGitHubIssueBody(localIssue: IssueData): string {
    const aiMetadata = {
      ai_context: localIssue.ai_context,
      estimated_tokens: localIssue.estimated_tokens,
      actual_tokens: localIssue.actual_tokens,
      epic_id: localIssue.epic_id,
      issue_id: localIssue.issue_id,
      local_created_date: localIssue.created_date,
      local_updated_date: localIssue.updated_date,
    };
    
    return `${localIssue.content}

<!-- AI-Trackdown Metadata -->
\`\`\`json
${JSON.stringify(aiMetadata, null, 2)}
\`\`\``;
  }

  /**
   * Map local status to GitHub state
   */
  private mapStatusToGitHubState(status: ItemStatus): 'open' | 'closed' {
    switch (status) {
      case 'completed':
      case 'archived':
        return 'closed';
      default:
        return 'open';
    }
  }

  /**
   * Map GitHub state to local status
   */
  private mapGitHubStateToStatus(state: 'open' | 'closed'): ItemStatus {
    return state === 'closed' ? 'completed' : 'active';
  }

  /**
   * Update local issue with GitHub metadata
   */
  private async updateLocalIssueWithGitHubMetadata(
    localIssue: IssueData,
    githubIssue: GitHubIssue
  ): Promise<void> {
    const updatedFrontmatter: IssueFrontmatter = {
      ...localIssue,
      github_id: githubIssue.id,
      github_number: githubIssue.number,
      github_url: githubIssue.html_url,
      github_updated_at: githubIssue.updated_at,
      sync_status: 'synced',
      updated_date: new Date().toISOString(),
    };

    if (this.syncConfig.sync_labels && githubIssue.labels.length > 0) {
      updatedFrontmatter.github_labels = githubIssue.labels.map(label => label.name);
    }

    if (this.syncConfig.sync_assignees && githubIssue.assignee) {
      updatedFrontmatter.github_assignee = githubIssue.assignee.login;
    }

    if (this.syncConfig.sync_milestones && githubIssue.milestone) {
      updatedFrontmatter.github_milestone = githubIssue.milestone.title;
    }

    // Write updated issue back to file
    const updatedContent = this.frontmatterParser.stringify(updatedFrontmatter, localIssue.content);
    fs.writeFileSync(localIssue.file_path, updatedContent, 'utf8');
  }

  /**
   * Update local issue from GitHub
   */
  private async updateLocalIssueFromGitHub(
    localIssue: IssueData,
    githubIssue: GitHubIssue
  ): Promise<void> {
    const updatedFrontmatter: IssueFrontmatter = {
      ...localIssue,
      title: githubIssue.title,
      status: this.mapGitHubStateToStatus(githubIssue.state),
      github_id: githubIssue.id,
      github_number: githubIssue.number,
      github_url: githubIssue.html_url,
      github_updated_at: githubIssue.updated_at,
      sync_status: 'synced',
      updated_date: new Date().toISOString(),
    };

    if (this.syncConfig.sync_labels && githubIssue.labels.length > 0) {
      updatedFrontmatter.tags = githubIssue.labels.map(label => label.name);
      updatedFrontmatter.github_labels = githubIssue.labels.map(label => label.name);
    }

    if (this.syncConfig.sync_assignees && githubIssue.assignee) {
      updatedFrontmatter.assignee = githubIssue.assignee.login;
      updatedFrontmatter.github_assignee = githubIssue.assignee.login;
    }

    if (this.syncConfig.sync_milestones && githubIssue.milestone) {
      updatedFrontmatter.milestone = githubIssue.milestone.title;
      updatedFrontmatter.github_milestone = githubIssue.milestone.title;
    }

    // Extract original content from GitHub body (remove AI metadata)
    const content = this.extractContentFromGitHubBody(githubIssue.body);

    // Write updated issue back to file
    const updatedContent = this.frontmatterParser.stringify(updatedFrontmatter, content);
    fs.writeFileSync(localIssue.file_path, updatedContent, 'utf8');
  }

  /**
   * Create local issue from GitHub
   */
  private async createLocalIssueFromGitHub(githubIssue: GitHubIssue): Promise<IssueData> {
    const paths = this.configManager.getAbsolutePaths();
    const issuesDir = paths.issuesDir;
    
    // Generate new issue ID
    const issueId = `${this.config.naming_conventions.issue_prefix}-${String(githubIssue.number).padStart(4, '0')}`;
    const filename = `${issueId}.md`;
    const filePath = path.join(issuesDir, filename);
    
    const newIssue: IssueFrontmatter = {
      issue_id: issueId,
      epic_id: '', // Will need to be assigned manually
      title: githubIssue.title,
      description: githubIssue.body,
      status: this.mapGitHubStateToStatus(githubIssue.state),
      priority: 'medium',
      assignee: githubIssue.assignee?.login || this.config.default_assignee || 'unassigned',
      created_date: githubIssue.created_at,
      updated_date: new Date().toISOString(),
      estimated_tokens: 0,
      actual_tokens: 0,
      ai_context: [],
      sync_status: 'synced',
      related_tasks: [],
      github_id: githubIssue.id,
      github_number: githubIssue.number,
      github_url: githubIssue.html_url,
      github_updated_at: githubIssue.updated_at,
      tags: this.syncConfig.sync_labels ? githubIssue.labels.map(label => label.name) : [],
      github_labels: githubIssue.labels.map(label => label.name),
      github_assignee: githubIssue.assignee?.login,
      github_milestone: githubIssue.milestone?.title,
      milestone: this.syncConfig.sync_milestones ? githubIssue.milestone?.title : undefined,
    };

    // Extract content from GitHub body
    const content = this.extractContentFromGitHubBody(githubIssue.body);
    
    // Create the issue file
    const issueContent = this.frontmatterParser.stringify(newIssue, content);
    fs.writeFileSync(filePath, issueContent, 'utf8');
    
    return {
      ...newIssue,
      content,
      file_path: filePath,
    };
  }

  /**
   * Extract content from GitHub issue body, removing AI metadata
   */
  private extractContentFromGitHubBody(body: string): string {
    // Remove AI metadata section
    const metadataRegex = /<!-- AI-Trackdown Metadata -->\s*```json[\s\S]*?```/;
    return body.replace(metadataRegex, '').trim();
  }

  /**
   * Get last sync time
   */
  private async getLastSyncTime(): Promise<Date> {
    const syncMetaFile = this.getSyncMetaPath();
    if (fs.existsSync(syncMetaFile)) {
      const syncMeta = JSON.parse(fs.readFileSync(syncMetaFile, 'utf8'));
      return new Date(syncMeta.last_sync || 0);
    }
    return new Date(0);
  }

  /**
   * Update sync metadata
   */
  private async updateSyncMetadata(result: SyncResult): Promise<void> {
    const syncMetaFile = this.getSyncMetaPath();
    const syncMeta = {
      last_sync: new Date().toISOString(),
      last_result: result,
      conflicts: result.conflict_count,
    };
    
    fs.writeFileSync(syncMetaFile, JSON.stringify(syncMeta, null, 2), 'utf8');
  }

  /**
   * Get sync metadata file path
   */
  private getSyncMetaPath(): string {
    const paths = this.configManager.getAbsolutePaths();
    return path.join(paths.configDir, 'sync-metadata.json');
  }

  /**
   * Update result counters
   */
  private updateResultCounters(result: SyncResult, operation: SyncOperation): void {
    if (operation.type === 'push') {
      result.pushed_count++;
    } else if (operation.type === 'pull') {
      result.pulled_count++;
    } else if (operation.type === 'conflict') {
      result.conflicts.push(operation);
      result.conflict_count++;
    } else {
      result.skipped_count++;
    }
  }
}