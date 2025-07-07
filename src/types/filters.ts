/**
 * Advanced filtering and search types for GitHub-compatible queries
 */

// Search query parser types
export interface ParsedSearchQuery {
  is?: {
    open?: boolean;
    closed?: boolean;
    issue?: boolean;
    pr?: boolean;
    public?: boolean;
    private?: boolean;
    fork?: boolean;
  };
  state?: 'open' | 'closed';
  type?: 'issue' | 'pr';
  in?: Array<'title' | 'body' | 'comments'>;
  author?: string;
  assignee?: string;
  mentions?: string;
  commenter?: string;
  involves?: string;
  team?: string;
  label?: string[];
  milestone?: string;
  project?: string;
  status?: string;
  created?: DateQuery;
  updated?: DateQuery;
  closed?: DateQuery;
  merged?: DateQuery;
  archived?: boolean;
  locked?: boolean;
  no?: Array<'label' | 'milestone' | 'assignee'>;
  language?: string;
  comments?: NumberQuery;
  interactions?: NumberQuery;
  reactions?: NumberQuery;
  draft?: boolean;
  review?: 'none' | 'required' | 'approved' | 'changes_requested';
  reviewed_by?: string;
  review_requested?: string;
  user?: string;
  org?: string;
  repo?: string;
  head?: string;
  base?: string;
  sort?: 'comments' | 'reactions' | 'reactions-+1' | 'reactions--1' | 'reactions-smile' | 'reactions-thinking_face' | 'reactions-heart' | 'reactions-tada' | 'interactions' | 'created' | 'updated';
  order?: 'asc' | 'desc';
  // Full text search terms (anything not matching above patterns)
  text?: string[];
}

// Date query types
export interface DateQuery {
  operator: '>' | '<' | '>=' | '<=' | '=' | '..' | '*';
  value: string | Date;
  endValue?: string | Date; // For range queries
}

// Number query types
export interface NumberQuery {
  operator: '>' | '<' | '>=' | '<=' | '=' | '..' | '*';
  value: number;
  endValue?: number; // For range queries
}

// Advanced filter options
export interface AdvancedFilters {
  // Text search
  query?: string;
  
  // State filters
  state?: 'open' | 'closed' | 'all';
  draft?: boolean;
  locked?: boolean;
  
  // User filters
  author?: string;
  assignee?: string | 'none' | '*';
  assignees?: string[];
  mentions?: string;
  commenter?: string;
  involves?: string;
  
  // Label filters
  labels?: string | string[];
  labelOperator?: 'and' | 'or'; // How to combine multiple labels
  
  // Milestone filters
  milestone?: string | number | 'none' | '*';
  
  // Date filters
  created?: string | DateQuery;
  updated?: string | DateQuery;
  closed?: string | DateQuery;
  since?: string;
  until?: string;
  
  // Numeric filters
  comments?: NumberQuery;
  reactions?: NumberQuery;
  interactions?: NumberQuery;
  
  // Sorting
  sort?: 'created' | 'updated' | 'comments' | 'reactions' | 'interactions';
  direction?: 'asc' | 'desc';
  
  // Pagination
  page?: number;
  per_page?: number;
  limit?: number;
  
  // Content filters
  in?: Array<'title' | 'body' | 'comments'>;
  
  // Repository filters
  repo?: string;
  org?: string;
  user?: string;
  
  // Additional GitHub-specific filters
  project?: string;
  review?: 'none' | 'required' | 'approved' | 'changes_requested';
  reviewed_by?: string;
  review_requested?: string;
  team?: string;
  language?: string;
  archived?: boolean;
  fork?: boolean;
  
  // Pull request specific
  head?: string;
  base?: string;
  status?: string;
}

// Search syntax validation
export interface SearchSyntaxError {
  type: 'invalid_operator' | 'invalid_date' | 'invalid_number' | 'unknown_qualifier' | 'missing_value';
  message: string;
  position?: number;
  qualifier?: string;
  value?: string;
  suggestion?: string;
}

// Filter validation results
export interface FilterValidationResult {
  valid: boolean;
  errors: SearchSyntaxError[];
  warnings: string[];
  parsedQuery?: ParsedSearchQuery;
}

// Sort options for different endpoints
export interface SortOptions {
  issues: Array<'created' | 'updated' | 'comments' | 'reactions' | 'reactions-+1' | 'reactions--1' | 'interactions'>;
  labels: Array<'name' | 'created' | 'updated'>;
  milestones: Array<'due_on' | 'completeness' | 'created' | 'updated'>;
  comments: Array<'created' | 'updated'>;
}

// Filter presets for common queries
export interface FilterPreset {
  name: string;
  description: string;
  filters: AdvancedFilters;
  icon?: string;
}

export const DEFAULT_FILTER_PRESETS: FilterPreset[] = [
  {
    name: 'my-issues',
    description: 'Issues assigned to me',
    filters: { assignee: '@me', state: 'open' },
    icon: '👤'
  },
  {
    name: 'my-created',
    description: 'Issues I created',
    filters: { author: '@me', state: 'open' },
    icon: '✏️'
  },
  {
    name: 'mentioned',
    description: 'Issues that mention me',
    filters: { mentions: '@me', state: 'open' },
    icon: '📢'
  },
  {
    name: 'bugs',
    description: 'Open bug reports',
    filters: { labels: 'bug', state: 'open' },
    icon: '🐛'
  },
  {
    name: 'enhancements',
    description: 'Enhancement requests',
    filters: { labels: 'enhancement', state: 'open' },
    icon: '✨'
  },
  {
    name: 'help-wanted',
    description: 'Issues looking for help',
    filters: { labels: 'help wanted', state: 'open' },
    icon: '🆘'
  },
  {
    name: 'good-first-issue',
    description: 'Good for new contributors',
    filters: { labels: 'good first issue', state: 'open' },
    icon: '🌱'
  },
  {
    name: 'high-priority',
    description: 'High priority issues',
    filters: { labels: ['priority:high', 'urgent'], labelOperator: 'or', state: 'open' },
    icon: '🔥'
  },
  {
    name: 'no-assignee',
    description: 'Unassigned issues',
    filters: { assignee: 'none', state: 'open' },
    icon: '❓'
  },
  {
    name: 'stale',
    description: 'Issues not updated in 30 days',
    filters: { updated: '<30d', state: 'open' },
    icon: '📅'
  }
];

// Query builder helpers
export interface QueryBuilder {
  is(state: string): QueryBuilder;
  in(fields: string[]): QueryBuilder;
  author(username: string): QueryBuilder;
  assignee(username: string): QueryBuilder;
  mentions(username: string): QueryBuilder;
  commenter(username: string): QueryBuilder;
  involves(username: string): QueryBuilder;
  label(name: string): QueryBuilder;
  milestone(name: string): QueryBuilder;
  project(name: string): QueryBuilder;
  created(date: string | DateQuery): QueryBuilder;
  updated(date: string | DateQuery): QueryBuilder;
  closed(date: string | DateQuery): QueryBuilder;
  comments(count: number | NumberQuery): QueryBuilder;
  reactions(count: number | NumberQuery): QueryBuilder;
  interactions(count: number | NumberQuery): QueryBuilder;
  draft(isDraft: boolean): QueryBuilder;
  locked(isLocked: boolean): QueryBuilder;
  archived(isArchived: boolean): QueryBuilder;
  no(field: string): QueryBuilder;
  sort(field: string): QueryBuilder;
  order(direction: 'asc' | 'desc'): QueryBuilder;
  build(): string;
  toFilters(): AdvancedFilters;
}

// Export utility types
export type FilterKey = keyof AdvancedFilters;
export type SortDirection = 'asc' | 'desc';
export type IssueSort = 'created' | 'updated' | 'comments' | 'reactions' | 'interactions';
export type LabelSort = 'name' | 'created' | 'updated';
export type MilestoneSort = 'due_on' | 'completeness' | 'created' | 'updated';