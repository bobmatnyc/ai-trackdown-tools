/**
 * AI-Trackdown Data Models and Types
 * Hierarchical project management with YAML frontmatter support
 */

// Core status and priority enums
export type ItemStatus = 'planning' | 'active' | 'completed' | 'archived';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type SyncStatus = 'local' | 'synced' | 'conflict';

// Resolution states for unified state management
export type ResolutionState = 
  | 'ready_for_engineering'
  | 'ready_for_qa'
  | 'ready_for_deployment'
  | 'won_t_do'
  | 'done';

// Combined state type that includes both legacy status and resolution states
export type UnifiedState = ItemStatus | ResolutionState;

// State metadata for tracking transitions and automation
export interface StateMetadata {
  transitioned_at: string;
  transitioned_by: string;
  previous_state?: UnifiedState;
  automation_eligible: boolean;
  automation_source?: string;
  transition_reason?: string;
  reviewer?: string;
}

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
  // Legacy status field (deprecated, use state instead)
  status: ItemStatus;
  // NEW: Unified state field for enhanced resolution tracking
  state?: UnifiedState;
  // NEW: State metadata for transition tracking
  state_metadata?: StateMetadata;
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

export interface TaskHierarchy {
  task: TaskData;
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
  // NEW: Support filtering by unified state
  state?: UnifiedState | UnifiedState[];
  priority?: Priority | Priority[];
  assignee?: string | string[];
  tags?: string | string[];
  created_after?: string;
  created_before?: string;
  updated_after?: string;
  updated_before?: string;
  content_search?: string;
  ai_context_search?: string;
  // NEW: Filter by state transition metadata
  transitioned_by?: string | string[];
  automation_eligible?: boolean;
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
  // NEW: State breakdown for resolution analytics
  state_breakdown: Record<UnifiedState, number>;
  priority_breakdown: Record<Priority, number>;
  assignee_breakdown: Record<string, number>;
  // NEW: Resolution analytics
  resolution_analytics: {
    ready_for_engineering: number;
    ready_for_qa: number;
    ready_for_deployment: number;
    won_t_do: number;
    done: number;
    automation_rate: number;
  };
  token_usage: {
    estimated_total: number;
    actual_total: number;
    efficiency_ratio: number;
  };
}

export interface TimelineEntry {
  id: string;
  type: 'project' | 'epic' | 'issue' | 'task' | 'pr';
  action: 'created' | 'updated' | 'completed' | 'archived' | 'merged' | 'closed' | 'state_transitioned';
  timestamp: string;
  item_id: string;
  changes?: Record<string, { from: any; to: any }>;
  // NEW: State transition metadata
  state_transition?: {
    from_state: UnifiedState;
    to_state: UnifiedState;
    transitioned_by: string;
    automation_eligible: boolean;
    transition_reason?: string;
  };
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

// State validation and transition types
export interface StateValidationRule {
  from_state: UnifiedState;
  to_state: UnifiedState;
  required_role?: string;
  automation_eligible: boolean;
  validation_function?: (item: AnyItemData) => boolean;
  prerequisites?: string[];
}

export interface StateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  allowed_transitions: UnifiedState[];
}

// Migration types for converting legacy status to unified state
export interface MigrationMapping {
  legacy_status: ItemStatus;
  default_state: UnifiedState;
  fallback_state: UnifiedState;
  preserve_metadata: boolean;
}

export interface MigrationResult {
  success: boolean;
  migrated_count: number;
  failed_count: number;
  errors: string[];
  migration_log: MigrationLogEntry[];
}

export interface MigrationLogEntry {
  item_id: string;
  item_type: ItemType;
  old_status: ItemStatus;
  new_state: UnifiedState;
  timestamp: string;
  success: boolean;
  error?: string;
}

// Backward compatibility interfaces
export interface LegacyItem {
  // Items that only have status field (pre-state implementation)
  status: ItemStatus;
  state?: never;
  state_metadata?: never;
}

export interface ModernItem {
  // Items with both fields during transition period
  status: ItemStatus; // Kept for backward compatibility
  state: UnifiedState;
  state_metadata: StateMetadata;
}

export interface StateOnlyItem {
  // Future items that only use state field
  status?: never;
  state: UnifiedState;
  state_metadata: StateMetadata;
}

// Type for mixed environments during migration
export type MigrationCompatibleItem = LegacyItem | ModernItem | StateOnlyItem;

// State management utility functions
// Re-export StateTransition from utils for convenience
export { StateTransition } from '../utils/state-migration.js';

export class StateManager {
  private static readonly STATE_TRANSITIONS: StateValidationRule[] = [
    // Engineering workflow
    { from_state: 'planning', to_state: 'ready_for_engineering', automation_eligible: true },
    { from_state: 'active', to_state: 'ready_for_engineering', automation_eligible: true },
    { from_state: 'ready_for_engineering', to_state: 'active', automation_eligible: false },
    { from_state: 'ready_for_engineering', to_state: 'ready_for_qa', automation_eligible: true },
    
    // QA workflow
    { from_state: 'ready_for_qa', to_state: 'active', automation_eligible: false },
    { from_state: 'ready_for_qa', to_state: 'ready_for_deployment', automation_eligible: true },
    { from_state: 'ready_for_qa', to_state: 'ready_for_engineering', automation_eligible: false },
    
    // Deployment workflow
    { from_state: 'ready_for_deployment', to_state: 'done', automation_eligible: true },
    { from_state: 'ready_for_deployment', to_state: 'ready_for_qa', automation_eligible: false },
    
    // Terminal states
    { from_state: 'done', to_state: 'archived', automation_eligible: true },
    { from_state: 'won_t_do', to_state: 'archived', automation_eligible: true },
    
    // Universal transitions
    { from_state: 'planning', to_state: 'won_t_do', automation_eligible: false },
    { from_state: 'active', to_state: 'won_t_do', automation_eligible: false },
    { from_state: 'ready_for_engineering', to_state: 'won_t_do', automation_eligible: false },
    { from_state: 'ready_for_qa', to_state: 'won_t_do', automation_eligible: false },
    { from_state: 'ready_for_deployment', to_state: 'won_t_do', automation_eligible: false },
  ];

  private static readonly LEGACY_MIGRATION_MAP: MigrationMapping[] = [
    { 
      legacy_status: 'planning', 
      default_state: 'planning', 
      fallback_state: 'planning',
      preserve_metadata: false 
    },
    { 
      legacy_status: 'active', 
      default_state: 'active', 
      fallback_state: 'active',
      preserve_metadata: false 
    },
    { 
      legacy_status: 'completed', 
      default_state: 'done', 
      fallback_state: 'ready_for_deployment',
      preserve_metadata: false 
    },
    { 
      legacy_status: 'archived', 
      default_state: 'archived', 
      fallback_state: 'archived',
      preserve_metadata: true 
    },
  ];

  /**
   * Validates if a state transition is allowed
   */
  static validateTransition(
    from_state: UnifiedState, 
    to_state: UnifiedState, 
    user_role?: string
  ): StateValidationResult {
    const rule = this.STATE_TRANSITIONS.find(
      r => r.from_state === from_state && r.to_state === to_state
    );

    if (!rule) {
      return {
        valid: false,
        errors: [`Invalid transition from ${from_state} to ${to_state}`],
        warnings: [],
        allowed_transitions: this.getAllowedTransitions(from_state)
      };
    }

    if (rule.required_role && user_role !== rule.required_role) {
      return {
        valid: false,
        errors: [`Transition requires role: ${rule.required_role}`],
        warnings: [],
        allowed_transitions: this.getAllowedTransitions(from_state)
      };
    }

    return {
      valid: true,
      errors: [],
      warnings: rule.automation_eligible ? [] : ['Manual transition - automation not recommended'],
      allowed_transitions: this.getAllowedTransitions(from_state)
    };
  }

  /**
   * Gets all allowed transitions from a given state
   */
  static getAllowedTransitions(from_state: UnifiedState): UnifiedState[] {
    return this.STATE_TRANSITIONS
      .filter(rule => rule.from_state === from_state)
      .map(rule => rule.to_state);
  }

  /**
   * Creates state metadata for a transition
   */
  static createStateMetadata(
    transitioned_by: string,
    previous_state?: UnifiedState,
    automation_eligible: boolean = false,
    automation_source?: string,
    transition_reason?: string,
    reviewer?: string
  ): StateMetadata {
    return {
      transitioned_at: new Date().toISOString(),
      transitioned_by,
      previous_state,
      automation_eligible,
      automation_source,
      transition_reason,
      reviewer
    };
  }

  /**
   * Migrates legacy status to unified state
   */
  static migrateStatusToState(legacy_status: ItemStatus): UnifiedState {
    const mapping = this.LEGACY_MIGRATION_MAP.find(m => m.legacy_status === legacy_status);
    return mapping ? mapping.default_state : legacy_status as UnifiedState;
  }

  /**
   * Gets the effective state from an item (handles backward compatibility)
   */
  static getEffectiveState(item: BaseFrontmatter): UnifiedState {
    // If state field exists, use it
    if (item.state) {
      return item.state;
    }
    
    // Fall back to migrating from status
    return this.migrateStatusToState(item.status);
  }

  /**
   * Checks if a state is a resolution state
   */
  static isResolutionState(state: UnifiedState): state is ResolutionState {
    const resolutionStates: ResolutionState[] = [
      'ready_for_engineering',
      'ready_for_qa', 
      'ready_for_deployment',
      'won_t_do',
      'done'
    ];
    return resolutionStates.includes(state as ResolutionState);
  }

  /**
   * Checks if a state is a legacy status
   */
  static isLegacyStatus(state: UnifiedState): state is ItemStatus {
    const legacyStatuses: ItemStatus[] = ['planning', 'active', 'completed', 'archived'];
    return legacyStatuses.includes(state as ItemStatus);
  }

  /**
   * Validates state metadata completeness
   */
  static validateStateMetadata(metadata: StateMetadata): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!metadata.transitioned_at) {
      errors.push({
        field: 'transitioned_at',
        message: 'Transition timestamp is required',
        severity: 'error'
      });
    }

    if (!metadata.transitioned_by) {
      errors.push({
        field: 'transitioned_by',
        message: 'Transition author is required',
        severity: 'error'
      });
    }

    if (metadata.automation_eligible && !metadata.automation_source) {
      warnings.push({
        field: 'automation_source',
        message: 'Automation source recommended for eligible transitions',
        severity: 'warning'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}
