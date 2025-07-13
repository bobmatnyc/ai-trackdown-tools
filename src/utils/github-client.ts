/**
 * GitHub API Client
 * Handles GitHub Issues API interactions with authentication, rate limiting, and pagination
 */

import { RequestError } from '@octokit/request-error';
import { Octokit } from '@octokit/rest';
import type { GitHubIssue, GitHubSyncConfig } from '../types/ai-trackdown.js';

export class GitHubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private config: GitHubSyncConfig;

  constructor(config: GitHubSyncConfig) {
    this.config = config;

    // Parse repository format (owner/repo)
    const [owner, repo] = config.repository.split('/');
    if (!owner || !repo) {
      throw new Error(
        `Invalid repository format: ${config.repository}. Expected format: owner/repo`
      );
    }

    this.owner = owner;
    this.repo = repo;

    // Initialize Octokit with authentication
    this.octokit = new Octokit({
      auth: config.token,
      request: {
        timeout: 30000, // 30 second timeout
      },
    });
  }

  /**
   * Test GitHub connection and permissions
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      // Test repository access
      const { data: repoData } = await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo,
      });

      // Check if we have issues permission
      if (!repoData.permissions?.push && !repoData.permissions?.admin) {
        return {
          success: false,
          message: 'Token does not have write permissions to the repository',
        };
      }

      return {
        success: true,
        message: `Connected to ${this.owner}/${this.repo} successfully`,
      };
    } catch (error) {
      if (error instanceof RequestError) {
        switch (error.status) {
          case 401:
            return {
              success: false,
              message: 'Authentication failed. Please check your GitHub token.',
            };
          case 403:
            return {
              success: false,
              message: 'Access forbidden. Token may not have required permissions.',
            };
          case 404:
            return {
              success: false,
              message: `Repository ${this.owner}/${this.repo} not found or not accessible.`,
            };
          default:
            return {
              success: false,
              message: `GitHub API error: ${error.message}`,
            };
        }
      }
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get all issues from GitHub repository with pagination
   */
  async getAllIssues(
    options: {
      state?: 'open' | 'closed' | 'all';
      sort?: 'created' | 'updated' | 'comments';
      direction?: 'asc' | 'desc';
      since?: string;
    } = {}
  ): Promise<GitHubIssue[]> {
    const issues: GitHubIssue[] = [];
    let page = 1;
    const per_page = Math.min(this.config.batch_size || 100, 100);

    try {
      while (true) {
        // Rate limiting delay
        if (page > 1) {
          await this.delay(this.config.rate_limit_delay || 100);
        }

        const response = await this.octokit.rest.issues.listForRepo({
          owner: this.owner,
          repo: this.repo,
          state: options.state || 'all',
          sort: options.sort || 'updated',
          direction: options.direction || 'desc',
          since: options.since,
          per_page,
          page,
        });

        if (response.data.length === 0) {
          break;
        }

        // Convert to our GitHubIssue format
        const convertedIssues = response.data.map(this.convertGitHubIssue);
        issues.push(...convertedIssues);

        // Check if we have more pages
        if (response.data.length < per_page) {
          break;
        }

        page++;
      }

      return issues;
    } catch (error) {
      throw new Error(
        `Failed to fetch issues: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a specific issue by number
   */
  async getIssue(issueNumber: number): Promise<GitHubIssue | null> {
    try {
      const response = await this.octokit.rest.issues.get({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
      });

      return this.convertGitHubIssue(response.data);
    } catch (error) {
      if (error instanceof RequestError && error.status === 404) {
        return null;
      }
      throw new Error(
        `Failed to fetch issue #${issueNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create a new issue in GitHub
   */
  async createIssue(data: {
    title: string;
    body: string;
    assignee?: string;
    milestone?: number;
    labels?: string[];
  }): Promise<GitHubIssue> {
    try {
      await this.delay(this.config.rate_limit_delay || 100);

      const response = await this.octokit.rest.issues.create({
        owner: this.owner,
        repo: this.repo,
        title: data.title,
        body: data.body,
        assignee: data.assignee,
        milestone: data.milestone,
        labels: data.labels,
      });

      return this.convertGitHubIssue(response.data);
    } catch (error) {
      throw new Error(
        `Failed to create issue: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update an existing issue in GitHub
   */
  async updateIssue(
    issueNumber: number,
    data: {
      title?: string;
      body?: string;
      state?: 'open' | 'closed';
      assignee?: string;
      milestone?: number;
      labels?: string[];
    }
  ): Promise<GitHubIssue> {
    try {
      await this.delay(this.config.rate_limit_delay || 100);

      const response = await this.octokit.rest.issues.update({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        title: data.title,
        body: data.body,
        state: data.state,
        assignee: data.assignee,
        milestone: data.milestone,
        labels: data.labels,
      });

      return this.convertGitHubIssue(response.data);
    } catch (error) {
      throw new Error(
        `Failed to update issue #${issueNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Close an issue in GitHub
   */
  async closeIssue(issueNumber: number): Promise<GitHubIssue> {
    return this.updateIssue(issueNumber, { state: 'closed' });
  }

  /**
   * Reopen an issue in GitHub
   */
  async reopenIssue(issueNumber: number): Promise<GitHubIssue> {
    return this.updateIssue(issueNumber, { state: 'open' });
  }

  /**
   * Get repository labels
   */
  async getLabels(): Promise<Array<{ name: string; color: string; description?: string }>> {
    try {
      const response = await this.octokit.rest.issues.listLabelsForRepo({
        owner: this.owner,
        repo: this.repo,
      });

      return response.data.map((label) => ({
        name: label.name,
        color: label.color,
        description: label.description || undefined,
      }));
    } catch (error) {
      throw new Error(
        `Failed to fetch labels: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get repository milestones
   */
  async getMilestones(): Promise<Array<{ title: string; number: number; state: string }>> {
    try {
      const response = await this.octokit.rest.issues.listMilestones({
        owner: this.owner,
        repo: this.repo,
      });

      return response.data.map((milestone) => ({
        title: milestone.title,
        number: milestone.number,
        state: milestone.state,
      }));
    } catch (error) {
      throw new Error(
        `Failed to fetch milestones: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get repository collaborators
   */
  async getCollaborators(): Promise<Array<{ login: string; id: number }>> {
    try {
      const response = await this.octokit.rest.repos.listCollaborators({
        owner: this.owner,
        repo: this.repo,
      });

      return response.data.map((collaborator) => ({
        login: collaborator.login,
        id: collaborator.id,
      }));
    } catch (error) {
      throw new Error(
        `Failed to fetch collaborators: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get rate limit information
   */
  async getRateLimit(): Promise<{
    limit: number;
    remaining: number;
    reset: Date;
    used: number;
  }> {
    try {
      const response = await this.octokit.rest.rateLimit.get();
      const core = response.data.rate;

      return {
        limit: core.limit,
        remaining: core.remaining,
        reset: new Date(core.reset * 1000),
        used: core.used,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch rate limit: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert GitHub API issue to our GitHubIssue format
   */
  private convertGitHubIssue(issue: any): GitHubIssue {
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      state: issue.state,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      assignee: issue.assignee
        ? {
            login: issue.assignee.login,
            id: issue.assignee.id,
          }
        : undefined,
      labels: issue.labels.map((label: any) => ({
        name: label.name,
        color: label.color,
      })),
      milestone: issue.milestone
        ? {
            title: issue.milestone.title,
            number: issue.milestone.number,
          }
        : undefined,
      html_url: issue.html_url,
    };
  }

  /**
   * Helper method to add delay for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
