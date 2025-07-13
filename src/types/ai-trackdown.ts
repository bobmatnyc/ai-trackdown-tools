/**
 * AI-Trackdown Data Models and Types
 * Hierarchical project management with YAML frontmatter support
 */

// Core status and priority enums
export type ItemStatus = 'planning' | 'active' | 'completed' | 'archived';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type SyncStatus = 'local' | 'synced' | 'conflict';

// GitHub sync configuration
export interface GitHubSyncConfig {
  enabled: boolean;
  repository: string; // Format: "owner/repo"
  token: string; // GitHub personal access token
  auto_sync: boolean;
  conflict_resolution: 'most_recent' | 'local_wins' | 'remote_wins';
  sync_labels: boolean;
  sync_milestones: boolean;
  sync_assignees: boolean;
  rate_limit_delay: number; // Delay in milliseconds between API calls
  batch_size: number; // Number of items to process in each batch
}

// Base frontmatter interface shared by all items
export interface BaseFrontmatter {
  title: string;
  description: string;
  status: ItemStatus;
  priority: Priority;
  assignee: string;
  created_date: string;
  updated_date: string;
  estimated_tokens: number;
  actual_tokens: number;
  ai_context: string[];
  sync_status: SyncStatus;
  // GitHub sync metadata
  github_id?: number; // GitHub issue ID
  github_number?: number; // GitHub issue number
  github_url?: string; // GitHub issue URL
  github_updated_at?: string; // GitHub issue last updated timestamp
  github_labels?: string[]; // GitHub labels
  github_milestone?: string; // GitHub milestone
  github_assignee?: string; // GitHub assignee
}

// Project frontmatter - Top-level container for multi-project management
export interface ProjectFrontmatter extends BaseFrontmatter {
  project_id: string;
  type: 'project';
  name: string;
  git_origin?: string;
  git_branch?: string;
  repository_url?: string;
  clone_url?: string;
  default_branch?: string;
  languages?: string[];
  framework?: string;
  deployment_url?: string;
  documentation_url?: string;
  team_members?: string[];
  license?: string;
  completion_percentage?: number;
  related_projects?: string[];
  // Add properties for compatibility with AnyItemData operations
  tags?: string[];
  dependencies?: string[];
  milestone?: string;
}

// Epic frontmatter - Top level organizational unit
export interface EpicFrontmatter extends BaseFrontmatter {
  epic_id: string;
  project_id?: string; // Optional for backward compatibility in single-project mode
  related_issues: string[];
  milestone?: string;
  tags?: string[];
  dependencies?: string[];
  completion_percentage?: number;
}

// Issue frontmatter - Mid-level work units within epics
export interface IssueFrontmatter extends BaseFrontmatter {
  issue_id: string;
  project_id?: string; // Optional for backward compatibility in single-project mode
  epic_id?: string;
  related_tasks: string[];
  related_prs?: string[];
  related_issues?: string[];
  milestone?: string;
  tags?: string[];
  dependencies?: string[];
  completion_percentage?: number;
  blocked_by?: string[];
  blocks?: string[];
}

// Task frontmatter - Granular work items within issues
export interface TaskFrontmatter extends BaseFrontmatter {
  task_id: string;
  project_id?: string; // Optional for backward compatibility in single-project mode
  issue_id: string;
  epic_id?: string;
  subtasks?: string[];
  parent_task?: string;
  tags?: string[];
  dependencies?: string[];
  time_estimate?: string;
  time_spent?: string;
  blocked_by?: string[];
  blocks?: string[];
  completion_percentage?: number;
  milestone?: string;
}

// PR status specific to pull request lifecycle
export type PRStatus = 'draft' | 'open' | 'review' | 'approved' | 'merged' | 'closed';

// PR frontmatter - Pull request tracking within issues
export interface PRFrontmatter extends BaseFrontmatter {
  pr_id: string;
  project_id?: string; // Optional for backward compatibility in single-project mode
  issue_id: string;
  epic_id?: string;
  pr_status: PRStatus;
  branch_name?: string;
  source_branch?: string;
  target_branch?: string;
  repository_url?: string;
  pr_number?: number;
  reviewers?: string[];
  approvals?: string[];
  merge_commit?: string;
  tags?: string[];
  dependencies?: string[];
  blocked_by?: string[];
  blocks?: string[];
  related_prs?: string[];
  template_used?: string;
}

// Combined types with content
export interface ProjectData extends ProjectFrontmatter {
  content: string;
  file_path: string;
}

export interface EpicData extends EpicFrontmatter {
  content: string;
  file_path: string;
}

export interface IssueData extends IssueFrontmatter {
  content: string;
  file_path: string;
}

export interface TaskData extends TaskFrontmatter {
  content: string;
  file_path: string;
}

export interface PRData extends PRFrontmatter {
  content: string;
  file_path: string;
}

// Hierarchical relationship types
export interface ProjectHierarchy {
  project: ProjectData;
  epics: EpicData[];
  issues: IssueData[];
  tasks: TaskData[];
  prs: PRData[];
}

export interface EpicHierarchy {
  epic: EpicData;
  issues: IssueData[];
  tasks: TaskData[];
  prs: PRData[];
  project?: ProjectData;
}

export interface IssueHierarchy {
  issue: IssueData;
  tasks: TaskData[];
  prs: PRData[];
  epic?: EpicData;
  project?: ProjectData;
}

export interface PRHierarchy {
  pr: PRData;
  issue: IssueData;
  epic?: EpicData;
  project?: ProjectData;
}

// Project configuration
export interface ProjectConfig {
  name: string;
  description?: string;
  version: string;
  // NEW: Single configurable root directory for all task types
  tasks_directory?: string; // Default: "tasks"
  // NEW: Project mode configuration
  project_mode?: 'single' | 'multi'; // Default: auto-detect
  structure: {
    projects_dir?: string; // NEW: Projects directory for multi-project mode
    epics_dir: string;
    issues_dir: string;
    tasks_dir: string;
    templates_dir: string;
    // NEW: PR directory for pull request tracking
    prs_dir?: string;
  };
  naming_conventions: {
    project_prefix?: string; // NEW: Project prefix
    epic_prefix: string;
    issue_prefix: string;
    task_prefix: string;
    pr_prefix?: string; // NEW: PR prefix
    file_extension: string;
  };
  default_assignee?: string;
  ai_context_templates?: string[];
  automation?: {
    auto_update_timestamps: boolean;
    auto_calculate_tokens: boolean;
    auto_sync_status: boolean;
  };
  // GitHub sync configuration
  github_sync?: GitHubSyncConfig;
}

// Search and filter types
export interface SearchFilters {
  status?: ItemStatus | ItemStatus[];
  priority?: Priority | Priority[];
  assignee?: string | string[];
  tags?: string | string[];
  created_after?: string;
  created_before?: string;
  updated_after?: string;
  updated_before?: string;
  content_search?: string;
  ai_context_search?: string;
}

export interface SearchResult<T> {
  items: T[];
  total_count: number;
  search_query: SearchFilters;
  execution_time: number;
}

// Analytics and reporting types
export interface ProjectAnalytics {
  total_epics: number;
  total_issues: number;
  total_tasks: number;
  completion_rate: number;
  status_breakdown: Record<ItemStatus, number>;
  priority_breakdown: Record<Priority, number>;
  assignee_breakdown: Record<string, number>;
  token_usage: {
    estimated_total: number;
    actual_total: number;
    efficiency_ratio: number;
  };
}

export interface TimelineEntry {
  id: string;
  type: 'project' | 'epic' | 'issue' | 'task' | 'pr';
  action: 'created' | 'updated' | 'completed' | 'archived' | 'merged' | 'closed';
  timestamp: string;
  item_id: string;
  changes?: Record<string, { from: any; to: any }>;
}

// Validation types
export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// File operation types
export interface FileOperation {
  type: 'create' | 'update' | 'delete' | 'move';
  source_path?: string;
  target_path: string;
  content?: string;
  timestamp: string;
}

export interface BatchOperation {
  operations: FileOperation[];
  description: string;
  dry_run: boolean;
}

// Template types
export interface ItemTemplate {
  type: 'project' | 'epic' | 'issue' | 'task' | 'pr';
  name: string;
  description: string;
  frontmatter_template: Partial<BaseFrontmatter>;
  content_template: string;
  ai_context_defaults?: string[];
}

// Export union types for type safety
export type AnyFrontmatter =
  | ProjectFrontmatter
  | EpicFrontmatter
  | IssueFrontmatter
  | TaskFrontmatter
  | PRFrontmatter;
export type AnyItemData = ProjectData | EpicData | IssueData | TaskData | PRData;
export type ItemType = 'project' | 'epic' | 'issue' | 'task' | 'pr';

// Type guards
export function isProjectFrontmatter(item: AnyFrontmatter): item is ProjectFrontmatter {
  return 'project_id' in item && 'type' in item && (item as any).type === 'project';
}

export function isEpicFrontmatter(item: AnyFrontmatter): item is EpicFrontmatter {
  return 'epic_id' in item && !('issue_id' in item) && !('task_id' in item) && !('pr_id' in item);
}

export function isIssueFrontmatter(item: AnyFrontmatter): item is IssueFrontmatter {
  return 'issue_id' in item && !('task_id' in item) && !('pr_id' in item);
}

export function isTaskFrontmatter(item: AnyFrontmatter): item is TaskFrontmatter {
  return 'task_id' in item && 'issue_id' in item && !('pr_id' in item);
}

export function isPRFrontmatter(item: AnyFrontmatter): item is PRFrontmatter {
  return 'pr_id' in item && 'issue_id' in item && !('task_id' in item);
}

export function isProjectData(item: AnyItemData): item is ProjectData {
  return isProjectFrontmatter(item);
}

export function isEpicData(item: AnyItemData): item is EpicData {
  return isEpicFrontmatter(item);
}

export function isIssueData(item: AnyItemData): item is IssueData {
  return isIssueFrontmatter(item);
}

export function isTaskData(item: AnyItemData): item is TaskData {
  return isTaskFrontmatter(item);
}

export function isPRData(item: AnyItemData): item is PRData {
  return isPRFrontmatter(item);
}

// Utility function to get the main ID from any item
export function getItemId(item: AnyItemData): string {
  if (isProjectData(item)) return item.project_id;
  if (isEpicData(item)) return item.epic_id;
  if (isIssueData(item)) return item.issue_id;
  if (isTaskData(item)) return item.task_id;
  if (isPRData(item)) return item.pr_id;
  throw new Error('Unknown item type');
}

// Utility type for ID generation
export interface IdGenerator {
  generateProjectId(title: string): string;
  generateEpicId(title: string): string;
  generateIssueId(epic_id: string, title: string): string;
  generateTaskId(issue_id: string, title: string): string;
  generatePRId(issue_id: string, title: string): string;
}

// API response types for future consistency
export interface APIResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  success: boolean;
  message?: string;
  timestamp: string;
}

// GitHub sync types
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  assignee?: {
    login: string;
    id: number;
  };
  labels: Array<{
    name: string;
    color: string;
  }>;
  milestone?: {
    title: string;
    number: number;
  };
  html_url: string;
}

export interface SyncOperation {
  type: 'push' | 'pull' | 'conflict';
  local_issue: IssueData;
  github_issue?: GitHubIssue;
  action: 'create' | 'update' | 'skip';
  reason?: string;
}

export interface SyncResult {
  success: boolean;
  operations: SyncOperation[];
  errors: string[];
  conflicts: SyncOperation[];
  pushed_count: number;
  pulled_count: number;
  skipped_count: number;
  conflict_count: number;
}

export interface SyncStatusInfo {
  enabled: boolean;
  repository: string;
  last_sync: string;
  next_sync?: string;
  auto_sync: boolean;
  pending_operations: number;
  conflicts: number;
  sync_health: 'healthy' | 'degraded' | 'failed';
}
