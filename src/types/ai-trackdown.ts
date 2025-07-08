/**
 * AI-Trackdown Data Models and Types
 * Hierarchical project management with YAML frontmatter support
 */

// Core status and priority enums
export type ItemStatus = 'planning' | 'active' | 'completed' | 'archived';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type SyncStatus = 'local' | 'synced' | 'conflict';

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
}

// Epic frontmatter - Top level organizational unit
export interface EpicFrontmatter extends BaseFrontmatter {
  epic_id: string;
  related_issues: string[];
  milestone?: string;
  tags?: string[];
  dependencies?: string[];
  completion_percentage?: number;
}

// Issue frontmatter - Mid-level work units within epics
export interface IssueFrontmatter extends BaseFrontmatter {
  issue_id: string;
  epic_id: string;
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
  issue_id: string;
  epic_id: string;
  subtasks?: string[];
  parent_task?: string;
  tags?: string[];
  dependencies?: string[];
  time_estimate?: string;
  time_spent?: string;
  blocked_by?: string[];
  blocks?: string[];
}

// PR status specific to pull request lifecycle
export type PRStatus = 'draft' | 'open' | 'review' | 'approved' | 'merged' | 'closed';

// PR frontmatter - Pull request tracking within issues
export interface PRFrontmatter extends BaseFrontmatter {
  pr_id: string;
  issue_id: string;
  epic_id: string;
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
export interface EpicHierarchy {
  epic: EpicData;
  issues: IssueData[];
  tasks: TaskData[];
  prs: PRData[];
}

export interface IssueHierarchy {
  issue: IssueData;
  tasks: TaskData[];
  prs: PRData[];
  epic?: EpicData;
}

export interface PRHierarchy {
  pr: PRData;
  issue: IssueData;
  epic?: EpicData;
}

// Project configuration
export interface ProjectConfig {
  name: string;
  description?: string;
  version: string;
  // NEW: Single configurable root directory for all task types
  tasks_directory?: string; // Default: "tasks"
  structure: {
    epics_dir: string;
    issues_dir: string;
    tasks_dir: string;
    templates_dir: string;
    // NEW: PR directory for pull request tracking
    prs_dir?: string;
  };
  naming_conventions: {
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
  type: 'epic' | 'issue' | 'task' | 'pr';
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
  type: 'epic' | 'issue' | 'task' | 'pr';
  name: string;
  description: string;
  frontmatter_template: Partial<BaseFrontmatter>;
  content_template: string;
  ai_context_defaults?: string[];
}

// Export union types for type safety
export type AnyFrontmatter = EpicFrontmatter | IssueFrontmatter | TaskFrontmatter | PRFrontmatter;
export type AnyItemData = EpicData | IssueData | TaskData | PRData;
export type ItemType = 'epic' | 'issue' | 'task' | 'pr';

// Type guards
export function isEpicFrontmatter(item: AnyFrontmatter): item is EpicFrontmatter {
  return 'epic_id' in item && !('issue_id' in item) && !('task_id' in item) && !('pr_id' in item);
}

export function isIssueFrontmatter(item: AnyFrontmatter): item is IssueFrontmatter {
  return 'issue_id' in item && 'epic_id' in item && !('task_id' in item) && !('pr_id' in item);
}

export function isTaskFrontmatter(item: AnyFrontmatter): item is TaskFrontmatter {
  return 'task_id' in item && 'issue_id' in item && 'epic_id' in item && !('pr_id' in item);
}

export function isPRFrontmatter(item: AnyFrontmatter): item is PRFrontmatter {
  return 'pr_id' in item && 'issue_id' in item && 'epic_id' in item && !('task_id' in item);
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

// Utility type for ID generation
export interface IdGenerator {
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