/**
 * GitHub API Client with rate limiting, authentication, and error handling
 */

import type {
  GitHubIssue,
  GitHubLabel,
  GitHubMilestone,
  GitHubComment,
  GitHubUser,
  CreateIssueRequest,
  UpdateIssueRequest,
  CreateLabelRequest,
  UpdateLabelRequest,
  CreateMilestoneRequest,
  UpdateMilestoneRequest,
  CreateCommentRequest,
  UpdateCommentRequest,
  IssueFilters,
  LabelFilters,
  MilestoneFilters,
  SearchQuery,
  SearchResult,
  APIResponse,
  GitHubAPIError,
  RateLimitResponse,
  AuthConfig,
  GitHubConfig
} from '../types/github.js';

export class GitHubAPIClient {
  private baseUrl: string;
  private token: string;
  private userAgent: string;
  private rateLimitRemaining: number = 5000;
  private rateLimitReset: number = 0;
  private repository?: { owner: string; name: string };

  constructor(config: GitHubConfig) {
    this.baseUrl = config.auth.baseUrl || 'https://api.github.com';
    this.token = config.auth.token || '';
    this.userAgent = config.auth.userAgent || 'aitrackdown-cli/0.3.0';
    this.repository = config.repository;

    if (!this.token) {
      throw new Error('GitHub token is required. Set GITHUB_TOKEN environment variable or configure authentication.');
    }
  }

  // Authentication and configuration
  public setRepository(owner: string, name: string): void {
    this.repository = { owner, name };
  }

  public getRepository(): { owner: string; name: string } | undefined {
    return this.repository;
  }

  // Rate limiting
  public async checkRateLimit(): Promise<RateLimitResponse> {
    const response = await this.request('GET', '/rate_limit');
    return response.data as RateLimitResponse;
  }

  public getRateLimitStatus(): { remaining: number; reset: number } {
    return {
      remaining: this.rateLimitRemaining,
      reset: this.rateLimitReset
    };
  }

  // Issues API
  public async createIssue(data: CreateIssueRequest): Promise<APIResponse<GitHubIssue>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/issues`;
    return this.request('POST', path, data);
  }

  public async listIssues(filters: IssueFilters = {}): Promise<APIResponse<GitHubIssue[]>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/issues`;
    const queryParams = this.buildQueryParams(filters);
    return this.request('GET', `${path}?${queryParams}`);
  }

  public async getIssue(issueNumber: number): Promise<APIResponse<GitHubIssue>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/issues/${issueNumber}`;
    return this.request('GET', path);
  }

  public async updateIssue(issueNumber: number, data: UpdateIssueRequest): Promise<APIResponse<GitHubIssue>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/issues/${issueNumber}`;
    return this.request('PATCH', path, data);
  }

  public async closeIssue(issueNumber: number, stateReason?: 'completed' | 'not_planned'): Promise<APIResponse<GitHubIssue>> {
    const data: UpdateIssueRequest = {
      state: 'closed',
      state_reason: stateReason
    };
    return this.updateIssue(issueNumber, data);
  }

  public async reopenIssue(issueNumber: number): Promise<APIResponse<GitHubIssue>> {
    const data: UpdateIssueRequest = {
      state: 'open',
      state_reason: 'reopened'
    };
    return this.updateIssue(issueNumber, data);
  }

  public async deleteIssue(issueNumber: number): Promise<APIResponse<void>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/issues/${issueNumber}`;
    return this.request('DELETE', path);
  }

  public async searchIssues(query: SearchQuery): Promise<APIResponse<SearchResult<GitHubIssue>>> {
    const queryParams = this.buildQueryParams(query);
    return this.request('GET', `/search/issues?${queryParams}`);
  }

  // Labels API
  public async createLabel(data: CreateLabelRequest): Promise<APIResponse<GitHubLabel>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/labels`;
    return this.request('POST', path, data);
  }

  public async listLabels(filters: LabelFilters = {}): Promise<APIResponse<GitHubLabel[]>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/labels`;
    const queryParams = this.buildQueryParams(filters);
    return this.request('GET', `${path}?${queryParams}`);
  }

  public async getLabel(labelName: string): Promise<APIResponse<GitHubLabel>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/labels/${encodeURIComponent(labelName)}`;
    return this.request('GET', path);
  }

  public async updateLabel(labelName: string, data: UpdateLabelRequest): Promise<APIResponse<GitHubLabel>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/labels/${encodeURIComponent(labelName)}`;
    return this.request('PATCH', path, data);
  }

  public async deleteLabel(labelName: string): Promise<APIResponse<void>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/labels/${encodeURIComponent(labelName)}`;
    return this.request('DELETE', path);
  }

  public async addLabelsToIssue(issueNumber: number, labels: string[]): Promise<APIResponse<GitHubLabel[]>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/issues/${issueNumber}/labels`;
    return this.request('POST', path, { labels });
  }

  public async removeLabelsFromIssue(issueNumber: number, labels: string[]): Promise<APIResponse<void>> {
    this.validateRepository();
    // Remove each label individually
    const promises = labels.map(label => {
      const path = `/repos/${this.repository!.owner}/${this.repository!.name}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`;
      return this.request('DELETE', path);
    });
    
    await Promise.all(promises);
    return { data: undefined as any, status: 200 };
  }

  public async replaceLabelsOnIssue(issueNumber: number, labels: string[]): Promise<APIResponse<GitHubLabel[]>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/issues/${issueNumber}/labels`;
    return this.request('PUT', path, { labels });
  }

  // Milestones API
  public async createMilestone(data: CreateMilestoneRequest): Promise<APIResponse<GitHubMilestone>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/milestones`;
    return this.request('POST', path, data);
  }

  public async listMilestones(filters: MilestoneFilters = {}): Promise<APIResponse<GitHubMilestone[]>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/milestones`;
    const queryParams = this.buildQueryParams(filters);
    return this.request('GET', `${path}?${queryParams}`);
  }

  public async getMilestone(milestoneNumber: number): Promise<APIResponse<GitHubMilestone>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/milestones/${milestoneNumber}`;
    return this.request('GET', path);
  }

  public async updateMilestone(milestoneNumber: number, data: UpdateMilestoneRequest): Promise<APIResponse<GitHubMilestone>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/milestones/${milestoneNumber}`;
    return this.request('PATCH', path, data);
  }

  public async deleteMilestone(milestoneNumber: number): Promise<APIResponse<void>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/milestones/${milestoneNumber}`;
    return this.request('DELETE', path);
  }

  // Comments API
  public async createComment(issueNumber: number, data: CreateCommentRequest): Promise<APIResponse<GitHubComment>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/issues/${issueNumber}/comments`;
    return this.request('POST', path, data);
  }

  public async listComments(issueNumber: number): Promise<APIResponse<GitHubComment[]>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/issues/${issueNumber}/comments`;
    return this.request('GET', path);
  }

  public async updateComment(commentId: number, data: UpdateCommentRequest): Promise<APIResponse<GitHubComment>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/issues/comments/${commentId}`;
    return this.request('PATCH', path, data);
  }

  public async deleteComment(commentId: number): Promise<APIResponse<void>> {
    this.validateRepository();
    const path = `/repos/${this.repository!.owner}/${this.repository!.name}/issues/comments/${commentId}`;
    return this.request('DELETE', path);
  }

  // User API
  public async getCurrentUser(): Promise<APIResponse<GitHubUser>> {
    return this.request('GET', '/user');
  }

  public async getUser(username: string): Promise<APIResponse<GitHubUser>> {
    return this.request('GET', `/users/${username}`);
  }

  // Generic request method
  private async request<T>(method: string, path: string, data?: any): Promise<APIResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    
    // Check rate limit
    if (this.rateLimitRemaining <= 10 && Date.now() / 1000 < this.rateLimitReset) {
      const waitTime = this.rateLimitReset - Date.now() / 1000;
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime)} seconds.`);
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': this.userAgent,
      'X-GitHub-Api-Version': '2022-11-28'
    };

    if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      headers['Content-Type'] = 'application/json';
    }

    const requestOptions: RequestInit = {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined
    };

    try {
      const response = await fetch(url, requestOptions);
      
      // Update rate limit tracking
      const remaining = response.headers.get('x-ratelimit-remaining');
      const reset = response.headers.get('x-ratelimit-reset');
      
      if (remaining) this.rateLimitRemaining = parseInt(remaining, 10);
      if (reset) this.rateLimitReset = parseInt(reset, 10);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        const error: GitHubAPIError = {
          message: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          documentation_url: errorData.documentation_url,
          errors: errorData.errors
        };
        
        throw new GitHubAPIClientError(error, response.status);
      }

      const responseData = method === 'DELETE' ? null : await response.json();
      
      return {
        data: responseData,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      if (error instanceof GitHubAPIClientError) {
        throw error;
      }
      
      throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper methods
  private validateRepository(): void {
    if (!this.repository) {
      throw new Error('Repository not set. Use setRepository() or provide repository in constructor.');
    }
  }

  private buildQueryParams(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          searchParams.append(key, value.join(','));
        } else {
          searchParams.append(key, String(value));
        }
      }
    }
    
    return searchParams.toString();
  }

  // Utility methods for common operations
  public async findIssueByTitle(title: string): Promise<GitHubIssue | null> {
    const response = await this.searchIssues({
      q: `"${title}" in:title repo:${this.repository!.owner}/${this.repository!.name}`
    });
    
    const exactMatch = response.data.items.find(issue => issue.title === title);
    return exactMatch || null;
  }

  public async findLabelByName(name: string): Promise<GitHubLabel | null> {
    try {
      const response = await this.getLabel(name);
      return response.data;
    } catch (error) {
      if (error instanceof GitHubAPIClientError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  public async findMilestoneByTitle(title: string): Promise<GitHubMilestone | null> {
    const response = await this.listMilestones();
    const milestone = response.data.find(m => m.title === title);
    return milestone || null;
  }

  // Batch operations
  public async batchOperation<T, R>(
    items: T[],
    operation: (item: T) => Promise<R>,
    batchSize: number = 10,
    delay: number = 100
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map(operation);
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults);
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return results;
  }
}

// Custom error class for GitHub API errors
export class GitHubAPIClientError extends Error {
  public status: number;
  public githubError: GitHubAPIError;

  constructor(githubError: GitHubAPIError, status: number) {
    super(githubError.message);
    this.name = 'GitHubAPIClientError';
    this.status = status;
    this.githubError = githubError;
  }

  public isRateLimit(): boolean {
    return this.status === 403 && this.message.includes('rate limit');
  }

  public isNotFound(): boolean {
    return this.status === 404;
  }

  public isUnauthorized(): boolean {
    return this.status === 401;
  }

  public isForbidden(): boolean {
    return this.status === 403;
  }

  public isValidationError(): boolean {
    return this.status === 422;
  }

  public getValidationErrors(): Array<{ field: string; message: string; code: string }> {
    if (!this.isValidationError() || !this.githubError.errors) {
      return [];
    }
    
    return this.githubError.errors.map(error => ({
      field: error.field,
      message: error.message || 'Invalid value',
      code: error.code
    }));
  }
}

// Factory function for creating GitHub API client
export function createGitHubClient(config: Partial<GitHubConfig> = {}): GitHubAPIClient {
  const token = config.auth?.token || process.env.GITHUB_TOKEN;
  
  if (!token) {
    throw new Error('GitHub token is required. Set GITHUB_TOKEN environment variable or provide token in config.');
  }

  const fullConfig: GitHubConfig = {
    auth: {
      token,
      type: 'token',
      baseUrl: config.auth?.baseUrl || 'https://api.github.com',
      userAgent: config.auth?.userAgent || 'aitrackdown-cli/0.3.0'
    },
    repository: config.repository,
    defaultBranch: config.defaultBranch || 'main',
    requestOptions: {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config.requestOptions
    }
  };

  return new GitHubAPIClient(fullConfig);
}