/**
 * GitHub API Compatible Type Definitions
 * These types match the GitHub REST API v4 structure for complete parity
 */

// Base types
export interface GitHubUser {
  id: number;
  login: string;
  node_id: string;
  avatar_url: string;
  gravatar_id: string | null;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: 'User' | 'Bot' | 'Organization';
  site_admin: boolean;
  name?: string;
  company?: string | null;
  blog?: string;
  location?: string | null;
  email?: string | null;
  hireable?: boolean | null;
  bio?: string | null;
  twitter_username?: string | null;
  public_repos?: number;
  public_gists?: number;
  followers?: number;
  following?: number;
  created_at?: string;
  updated_at?: string;
}

// Label type
export interface GitHubLabel {
  id: number;
  node_id: string;
  url: string;
  name: string;
  description: string | null;
  color: string;
  default: boolean;
}

// Milestone type
export interface GitHubMilestone {
  id: number;
  node_id: string;
  number: number;
  title: string;
  description: string | null;
  creator: GitHubUser;
  open_issues: number;
  closed_issues: number;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  due_on: string | null;
  closed_at: string | null;
  url: string;
  html_url: string;
  labels_url: string;
}

// Reaction type
export interface GitHubReaction {
  id: number;
  node_id: string;
  user: GitHubUser;
  content: '+1' | '-1' | 'laugh' | 'hooray' | 'confused' | 'heart' | 'rocket' | 'eyes';
  created_at: string;
}

// Reaction summary type
export interface GitHubReactionSummary {
  url: string;
  total_count: number;
  '+1': number;
  '-1': number;
  laugh: number;
  hooray: number;
  confused: number;
  heart: number;
  rocket: number;
  eyes: number;
}

// Issue state types
export type IssueState = 'open' | 'closed';
export type IssueStateReason = 'completed' | 'not_planned' | 'reopened' | null;

// Pull request type (basic)
export interface GitHubPullRequest {
  id: number;
  number: number;
  state: 'open' | 'closed';
  title: string;
  user: GitHubUser;
  body: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  requested_reviewers: GitHubUser[];
  labels: GitHubLabel[];
  milestone: GitHubMilestone | null;
  draft: boolean;
  head: {
    ref: string;
    sha: string;
    repo: GitHubRepository | null;
  };
  base: {
    ref: string;
    sha: string;
    repo: GitHubRepository;
  };
  html_url: string;
  diff_url: string;
  patch_url: string;
}

// Repository type (basic)
export interface GitHubRepository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  owner: GitHubUser;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  clone_url: string;
  ssh_url: string;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
}

// Main Issue type - GitHub API compatible
export interface GitHubIssue {
  id: number;
  node_id: string;
  url: string;
  repository_url: string;
  labels_url: string;
  comments_url: string;
  events_url: string;
  html_url: string;
  number: number;
  title: string;
  body: string | null;
  body_text?: string;
  body_html?: string;
  user: GitHubUser;
  labels: GitHubLabel[];
  state: IssueState;
  state_reason: IssueStateReason;
  locked: boolean;
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  milestone: GitHubMilestone | null;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  author_association: 'COLLABORATOR' | 'CONTRIBUTOR' | 'FIRST_TIMER' | 'FIRST_TIME_CONTRIBUTOR' | 'MANNEQUIN' | 'MEMBER' | 'NONE' | 'OWNER';
  active_lock_reason?: string | null;
  draft?: boolean;
  pull_request?: {
    url: string;
    html_url: string;
    diff_url: string;
    patch_url: string;
    merged_at: string | null;
  } | null;
  closed_by?: GitHubUser | null;
  reactions: GitHubReactionSummary;
  timeline_url: string;
  performed_via_github_app?: any | null;
  score?: number;
}

// Comment type
export interface GitHubComment {
  id: number;
  node_id: string;
  url: string;
  html_url: string;
  body: string;
  body_text?: string;
  body_html?: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  issue_url: string;
  author_association: 'COLLABORATOR' | 'CONTRIBUTOR' | 'FIRST_TIMER' | 'FIRST_TIME_CONTRIBUTOR' | 'MANNEQUIN' | 'MEMBER' | 'NONE' | 'OWNER';
  performed_via_github_app?: any | null;
  reactions: GitHubReactionSummary;
}

// API request/response types
export interface CreateIssueRequest {
  title: string;
  body?: string;
  assignees?: string[];
  milestone?: number | null;
  labels?: string[];
  assignee?: string;
}

export interface UpdateIssueRequest {
  title?: string;
  body?: string;
  assignees?: string[];
  milestone?: number | null;
  labels?: string[];
  state?: IssueState;
  state_reason?: IssueStateReason;
}

export interface CreateLabelRequest {
  name: string;
  color: string;
  description?: string;
}

export interface UpdateLabelRequest {
  new_name?: string;
  color?: string;
  description?: string;
}

export interface CreateMilestoneRequest {
  title: string;
  state?: 'open' | 'closed';
  description?: string;
  due_on?: string;
}

export interface UpdateMilestoneRequest {
  title?: string;
  state?: 'open' | 'closed';
  description?: string;
  due_on?: string;
}

export interface CreateCommentRequest {
  body: string;
}

export interface UpdateCommentRequest {
  body: string;
}

// Filtering and search types
export interface IssueFilters {
  milestone?: string | number | 'none' | '*';
  state?: 'open' | 'closed' | 'all';
  assignee?: string | 'none' | '*';
  creator?: string;
  mentioned?: string;
  labels?: string | string[];
  sort?: 'created' | 'updated' | 'comments';
  direction?: 'asc' | 'desc';
  since?: string;
  per_page?: number;
  page?: number;
}

export interface LabelFilters {
  sort?: 'name' | 'created' | 'updated';
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface MilestoneFilters {
  state?: 'open' | 'closed' | 'all';
  sort?: 'due_on' | 'completeness';
  direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

// Search query parsing types
export interface SearchQuery {
  q: string;
  sort?: 'comments' | 'reactions' | 'reactions-+1' | 'reactions--1' | 'reactions-smile' | 'reactions-thinking_face' | 'reactions-heart' | 'reactions-tada' | 'interactions' | 'created' | 'updated';
  order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface SearchResult<T> {
  total_count: number;
  incomplete_results: boolean;
  items: T[];
}

// Pagination metadata
export interface PaginationMeta {
  page: number;
  per_page: number;
  total_count?: number;
  total_pages?: number;
  has_next_page: boolean;
  has_prev_page: boolean;
}

// API response types
export interface APIResponse<T> {
  data: T;
  meta?: PaginationMeta;
  headers?: Record<string, string>;
  status: number;
}

// Error types
export interface GitHubAPIError {
  message: string;
  documentation_url?: string;
  errors?: Array<{
    resource: string;
    field: string;
    code: string;
    message?: string;
  }>;
}

// Rate limiting types
export interface RateLimit {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
  resource: string;
}

export interface RateLimitResponse {
  rate: RateLimit;
  search?: RateLimit;
  graphql?: RateLimit;
  integration_manifest?: RateLimit;
  source_import?: RateLimit;
  code_scanning_upload?: RateLimit;
  actions_runner_registration?: RateLimit;
}

// Authentication types
export interface AuthConfig {
  token?: string;
  type: 'token' | 'app' | 'oauth';
  baseUrl?: string;
  userAgent?: string;
}

// Configuration types
export interface GitHubConfig {
  auth: AuthConfig;
  repository?: {
    owner: string;
    name: string;
  };
  defaultBranch?: string;
  requestOptions?: {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
  };
}