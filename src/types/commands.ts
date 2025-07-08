/**
 * Command-specific types for CLI operations
 */

// import type { IssueState, IssueStateReason } from './github.js'; // Removed GitHub dependencies
import type { AdvancedFilters, SortDirection } from './filters.js';

// Base command options
export interface BaseCommandOptions {
  verbose?: boolean;
  config?: string;
  noColor?: boolean;
  format?: 'table' | 'json' | 'yaml' | 'csv';
  output?: string;
}

// Issue command options
export interface IssueCreateOptions extends BaseCommandOptions {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
  assignee?: string;
  milestone?: string | number;
  template?: string;
  draft?: boolean;
}

export interface IssueListOptions extends BaseCommandOptions {
  state?: 'open' | 'closed' | 'all';
  labels?: string | string[];
  assignee?: string;
  assignees?: string[];
  creator?: string;
  mentioned?: string;
  milestone?: string | number;
  since?: string;
  sort?: 'created' | 'updated' | 'comments';
  direction?: SortDirection;
  limit?: number;
  page?: number;
  all?: boolean;
  web?: boolean;
}

export interface IssueShowOptions extends BaseCommandOptions {
  comments?: boolean;
  reactions?: boolean;
  timeline?: boolean;
  raw?: boolean;
  web?: boolean;
}

export interface IssueUpdateOptions extends BaseCommandOptions {
  title?: string;
  body?: string;
  addLabels?: string[];
  removeLabels?: string[];
  labels?: string[];
  assignees?: string[];
  addAssignees?: string[];
  removeAssignees?: string[];
  milestone?: string | number;
  removeMilestone?: boolean;
  state?: IssueState;
  stateReason?: IssueStateReason;
}

export interface IssueCloseOptions extends BaseCommandOptions {
  stateReason?: 'completed' | 'not_planned';
  comment?: string;
}

export interface IssueReopenOptions extends BaseCommandOptions {
  comment?: string;
}

export interface IssueDeleteOptions extends BaseCommandOptions {
  confirm?: boolean;
  force?: boolean;
}

export interface IssueSearchOptions extends BaseCommandOptions {
  query: string;
  state?: 'open' | 'closed' | 'all';
  sort?: 'comments' | 'reactions' | 'reactions-+1' | 'reactions--1' | 'interactions' | 'created' | 'updated';
  order?: SortDirection;
  limit?: number;
  page?: number;
  created?: string;
  updated?: string;
  author?: string;
  assignee?: string;
  mentions?: string;
  labels?: string | string[];
  milestone?: string;
  in?: string[];
  web?: boolean;
}

// Label command options
export interface LabelCreateOptions extends BaseCommandOptions {
  name: string;
  color: string;
  description?: string;
  force?: boolean;
}

export interface LabelListOptions extends BaseCommandOptions {
  sort?: 'name' | 'created' | 'updated';
  direction?: SortDirection;
  search?: string;
  limit?: number;
  page?: number;
}

export interface LabelUpdateOptions extends BaseCommandOptions {
  newName?: string;
  color?: string;
  description?: string;
}

export interface LabelDeleteOptions extends BaseCommandOptions {
  confirm?: boolean;
  force?: boolean;
}

export interface LabelApplyOptions extends BaseCommandOptions {
  labels: string[];
  replace?: boolean;
}

export interface LabelRemoveOptions extends BaseCommandOptions {
  labels: string[];
}

// Milestone command options
export interface MilestoneCreateOptions extends BaseCommandOptions {
  title: string;
  description?: string;
  dueDate?: string;
  state?: 'open' | 'closed';
}

export interface MilestoneListOptions extends BaseCommandOptions {
  state?: 'open' | 'closed' | 'all';
  sort?: 'due_on' | 'completeness' | 'created' | 'updated';
  direction?: SortDirection;
  limit?: number;
  page?: number;
  fields?: string;
  noHeader?: boolean;
  showProgress?: boolean;
}

export interface MilestoneUpdateOptions extends BaseCommandOptions {
  title?: string;
  description?: string;
  dueDate?: string;
  state?: 'open' | 'closed';
}

export interface MilestoneDeleteOptions extends BaseCommandOptions {
  confirm?: boolean;
  force?: boolean;
}

export interface MilestoneAssignOptions extends BaseCommandOptions {
  milestone: string | number;
}

export interface MilestoneProgressOptions extends BaseCommandOptions {
  detailed?: boolean;
  burndown?: boolean;
  forecast?: boolean;
  exportChart?: boolean;
  period?: string;
}

export interface MilestoneAnalyticsOptions extends BaseCommandOptions {
  velocity?: boolean;
  completionRate?: boolean;
  burndown?: boolean;
  cycleTime?: boolean;
  forecasting?: boolean;
  exportChart?: boolean;
  period?: string;
}

export interface MilestoneTemplateOptions extends BaseCommandOptions {
  list?: boolean;
  create?: string;
  delete?: string;
  apply?: string;
  duration?: string;
  autoAssign?: boolean;
}

export interface MilestoneBulkAssignOptions extends BaseCommandOptions {
  notify?: boolean;
  force?: boolean;
  dryRun?: boolean;
  filter?: string;
}

// Project command options
export interface ProjectCreateOptions extends BaseCommandOptions {
  description?: string;
  template?: string;
  public?: boolean;
  readme?: string;
}

export interface ProjectListOptions extends BaseCommandOptions {
  includeClosed?: boolean;
  owner?: string;
  sort?: 'created' | 'updated' | 'name';
  direction?: SortDirection;
}

export interface ProjectBoardOptions extends BaseCommandOptions {
  view?: string;
  groupBy?: string;
  filter?: string;
  customFields?: boolean;
}

export interface ProjectAnalyticsOptions extends BaseCommandOptions {
  cycleTime?: boolean;
  throughput?: boolean;
  bottlenecks?: boolean;
  period?: string;
}

export interface ProjectAutomationOptions extends BaseCommandOptions {
  trigger?: string;
  action?: string;
  dryRun?: boolean;
}

// Bulk operation options
export interface BulkAssignOptions extends BaseCommandOptions {
  issues?: string;
  filter?: string;
  assignee?: string;
  notify?: boolean;
  force?: boolean;
  dryRun?: boolean;
  batchSize?: number;
}

export interface BulkLabelOptions extends BaseCommandOptions {
  filter?: string;
  add?: string;
  remove?: string;
  replace?: string;
  dryRun?: boolean;
  batchSize?: number;
}

export interface BulkCloseOptions extends BaseCommandOptions {
  query?: string;
  filter?: string;
  stateReason?: 'completed' | 'not_planned';
  comment?: string;
  dryRun?: boolean;
  batchSize?: number;
}

export interface BulkExportOptions extends BaseCommandOptions {
  query?: string;
  fields?: string;
  includeComments?: boolean;
  includeHistory?: boolean;
}

export interface BulkImportOptions extends BaseCommandOptions {
  file?: string;
  template?: string;
  validate?: boolean;
  dryRun?: boolean;
}

// Comment command options
export interface CommentCreateOptions extends BaseCommandOptions {
  body: string;
  editor?: boolean;
}

export interface CommentListOptions extends BaseCommandOptions {
  sort?: 'created' | 'updated';
  direction?: SortDirection;
  since?: string;
  limit?: number;
  page?: number;
}

export interface CommentUpdateOptions extends BaseCommandOptions {
  body: string;
  editor?: boolean;
}

export interface CommentDeleteOptions extends BaseCommandOptions {
  confirm?: boolean;
  force?: boolean;
}

// Reaction command options
export interface ReactionAddOptions extends BaseCommandOptions {
  reaction: '+1' | '-1' | 'laugh' | 'hooray' | 'confused' | 'heart' | 'rocket' | 'eyes';
}

export interface ReactionListOptions extends BaseCommandOptions {
  detailed?: boolean;
}

export interface ReactionRemoveOptions extends BaseCommandOptions {
  reaction: '+1' | '-1' | 'laugh' | 'hooray' | 'confused' | 'heart' | 'rocket' | 'eyes';
}

// Bulk operation options
export interface BulkUpdateOptions extends BaseCommandOptions {
  filter: string | AdvancedFilters;
  addLabels?: string[];
  removeLabels?: string[];
  assignees?: string[];
  addAssignees?: string[];
  removeAssignees?: string[];
  milestone?: string | number;
  removeMilestone?: boolean;
  state?: IssueState;
  stateReason?: IssueStateReason;
  dryRun?: boolean;
  batchSize?: number;
  confirm?: boolean;
}

export interface BulkCloseOptions extends BaseCommandOptions {
  filter: string | AdvancedFilters;
  stateReason?: 'completed' | 'not_planned';
  comment?: string;
  dryRun?: boolean;
  batchSize?: number;
  confirm?: boolean;
}

// Configuration options
export interface ConfigOptions extends BaseCommandOptions {
  global?: boolean;
  local?: boolean;
  list?: boolean;
  get?: string;
  set?: string;
  unset?: string;
  edit?: boolean;
}

export interface AuthOptions extends BaseCommandOptions {
  token?: string;
  login?: boolean;
  logout?: boolean;
  status?: boolean;
  refresh?: boolean;
  scopes?: string[];
  hostname?: string;
}

// Repository options
export interface RepoOptions extends BaseCommandOptions {
  owner?: string;
  name?: string;
  url?: string;
  clone?: boolean;
  list?: boolean;
  current?: boolean;
}

// Output formatting options
export interface FormatOptions {
  format: 'table' | 'json' | 'yaml' | 'csv' | 'markdown';
  fields?: string[];
  noHeader?: boolean;
  template?: string;
  color?: boolean;
  compact?: boolean;
  pretty?: boolean;
}

// Pagination options
export interface PaginationOptions {
  page?: number;
  perPage?: number;
  limit?: number;
  all?: boolean;
  maxPages?: number;
}

// Filter preset options
export interface PresetOptions extends BaseCommandOptions {
  name?: string;
  list?: boolean;
  save?: string;
  delete?: string;
  edit?: string;
  apply?: string;
}

// Command result types
export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
  meta?: {
    total?: number;
    page?: number;
    perPage?: number;
    hasMore?: boolean;
    executionTime?: number;
    apiCalls?: number;
  };
}

// Command context
export interface CommandContext {
  config: any;
  auth?: {
    token: string;
    user?: any;
  };
  repository?: {
    owner: string;
    name: string;
  };
  options: BaseCommandOptions;
}

// Validation types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

// Help and documentation types
export interface CommandHelp {
  usage: string;
  description: string;
  examples: Array<{
    command: string;
    description: string;
  }>;
  options: Array<{
    flag: string;
    description: string;
    type?: string;
    default?: any;
    required?: boolean;
  }>;
  aliases?: string[];
  seeAlso?: string[];
}

// Progress tracking
export interface ProgressOptions {
  showProgress?: boolean;
  progressBar?: boolean;
  progressFormat?: 'bar' | 'spinner' | 'dots' | 'simple';
  progressTitle?: string;
}

// Export utility types
export type AnyCommandOptions = 
  | IssueCreateOptions
  | IssueListOptions
  | IssueShowOptions
  | IssueUpdateOptions
  | IssueCloseOptions
  | IssueReopenOptions
  | IssueDeleteOptions
  | IssueSearchOptions
  | LabelCreateOptions
  | LabelListOptions
  | LabelUpdateOptions
  | LabelDeleteOptions
  | LabelApplyOptions
  | LabelRemoveOptions
  | MilestoneCreateOptions
  | MilestoneListOptions
  | MilestoneUpdateOptions
  | MilestoneDeleteOptions
  | MilestoneAssignOptions
  | MilestoneProgressOptions;

export type CommandName = 
  | 'issue'
  | 'label'
  | 'milestone'
  | 'comment'
  | 'reaction'
  | 'config'
  | 'auth'
  | 'repo';

export type IssueSubcommand = 
  | 'create'
  | 'list'
  | 'show'
  | 'update'
  | 'close'
  | 'reopen'
  | 'delete'
  | 'search';

export type LabelSubcommand = 
  | 'create'
  | 'list'
  | 'update'
  | 'delete'
  | 'apply'
  | 'remove';

export type MilestoneSubcommand = 
  | 'create'
  | 'list'
  | 'update'
  | 'delete'
  | 'assign'
  | 'progress'
  | 'analytics'
  | 'template';