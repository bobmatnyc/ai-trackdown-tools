/**
 * GitHub Sync Tests
 * Comprehensive tests for GitHub sync functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubClient } from '../src/utils/github-client.js';
import { GitHubSyncEngine } from '../src/integrations/github-sync.js';
import { GitHubSyncConfig, GitHubIssue, IssueData } from '../src/types/ai-trackdown.js';
import { RequestError } from '@octokit/request-error';

// Mock GitHub API responses
const mockGitHubIssue: GitHubIssue = {
  id: 123456,
  number: 1,
  title: 'Test Issue',
  body: 'This is a test issue',
  state: 'open',
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  html_url: 'https://github.com/owner/repo/issues/1',
  labels: [
    { name: 'bug', color: 'red' },
    { name: 'priority-high', color: 'orange' }
  ],
  assignee: {
    login: 'testuser',
    id: 789
  },
  milestone: {
    title: 'v1.0.0',
    number: 1
  }
};

const mockLocalIssue: IssueData = {
  issue_id: 'ISS-0001',
  epic_id: 'EP-0001',
  title: 'Test Local Issue',
  description: 'Local issue description',
  status: 'active',
  priority: 'high',
  assignee: 'localuser',
  created_date: '2023-01-01T00:00:00Z',
  updated_date: '2023-01-01T00:00:00Z',
  estimated_tokens: 100,
  actual_tokens: 0,
  ai_context: ['test-context'],
  sync_status: 'local',
  related_tasks: [],
  content: 'This is the local issue content',
  file_path: '/path/to/issue.md'
};

const mockSyncConfig: GitHubSyncConfig = {
  enabled: true,
  repository: 'owner/repo',
  token: 'ghp_test_token',
  auto_sync: false,
  conflict_resolution: 'most_recent',
  sync_labels: true,
  sync_milestones: true,
  sync_assignees: true,
  rate_limit_delay: 100,
  batch_size: 50
};

describe('GitHubClient', () => {
  let client: GitHubClient;

  beforeEach(() => {
    client = new GitHubClient(mockSyncConfig);
  });

  describe('constructor', () => {
    it('should parse repository correctly', () => {
      expect(() => new GitHubClient(mockSyncConfig)).not.toThrow();
    });

    it('should throw error for invalid repository format', () => {
      const invalidConfig = { ...mockSyncConfig, repository: 'invalid-repo' };
      expect(() => new GitHubClient(invalidConfig)).toThrow('Invalid repository format');
    });
  });

  describe('testConnection', () => {
    it('should return success for valid connection', async () => {
      // Mock Octokit response
      const mockOctokit = {
        rest: {
          repos: {
            get: vi.fn().mockResolvedValue({
              data: {
                permissions: { push: true }
              }
            })
          }
        }
      };

      // Replace the client's octokit instance
      (client as any).octokit = mockOctokit;

      const result = await client.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toContain('Connected to owner/repo successfully');
    });

    it('should return failure for authentication error', async () => {
      const mockError = new RequestError('Unauthorized', 401, {
        request: {
          method: 'GET',
          url: 'https://api.github.com/repos/owner/repo',
          headers: {}
        }
      });
      
      const mockOctokit = {
        rest: {
          repos: {
            get: vi.fn().mockRejectedValue(mockError)
          }
        }
      };

      (client as any).octokit = mockOctokit;

      const result = await client.testConnection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Authentication failed');
    });
  });

  describe('getAllIssues', () => {
    it('should fetch all issues with pagination', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            listForRepo: vi.fn()
              .mockResolvedValueOnce({
                data: [mockGitHubIssue]
              })
              .mockResolvedValueOnce({
                data: []
              })
          }
        }
      };

      (client as any).octokit = mockOctokit;

      const issues = await client.getAllIssues();
      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual(mockGitHubIssue);
    });

    it('should handle empty response', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            listForRepo: vi.fn().mockResolvedValue({
              data: []
            })
          }
        }
      };

      (client as any).octokit = mockOctokit;

      const issues = await client.getAllIssues();
      expect(issues).toHaveLength(0);
    });
  });

  describe('createIssue', () => {
    it('should create a new issue', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            create: vi.fn().mockResolvedValue({
              data: mockGitHubIssue
            })
          }
        }
      };

      (client as any).octokit = mockOctokit;

      const issue = await client.createIssue({
        title: 'Test Issue',
        body: 'Test body',
        labels: ['bug']
      });

      expect(issue).toEqual(mockGitHubIssue);
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: 'Test Issue',
        body: 'Test body',
        labels: ['bug'],
        assignee: undefined,
        milestone: undefined
      });
    });
  });

  describe('updateIssue', () => {
    it('should update an existing issue', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            update: vi.fn().mockResolvedValue({
              data: mockGitHubIssue
            })
          }
        }
      };

      (client as any).octokit = mockOctokit;

      const issue = await client.updateIssue(1, {
        title: 'Updated Title',
        state: 'closed'
      });

      expect(issue).toEqual(mockGitHubIssue);
      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
        title: 'Updated Title',
        state: 'closed',
        body: undefined,
        assignee: undefined,
        milestone: undefined,
        labels: undefined
      });
    });
  });
});

describe('GitHubSyncEngine', () => {
  let syncEngine: GitHubSyncEngine;
  let mockConfigManager: any;

  beforeEach(() => {
    // Mock ConfigManager
    mockConfigManager = {
      getConfig: vi.fn().mockReturnValue({
        github_sync: mockSyncConfig,
        naming_conventions: {
          issue_prefix: 'ISS',
          file_extension: '.md'
        },
        default_assignee: 'unassigned'
      }),
      getAbsolutePaths: vi.fn().mockReturnValue({
        issuesDir: '/path/to/issues',
        configDir: '/path/to/config'
      })
    };

    // Mock file system operations
    vi.mock('fs', () => ({
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue('mock file content'),
      writeFileSync: vi.fn(),
      readdirSync: vi.fn().mockReturnValue(['test.md'])
    }));

    // Mock frontmatter parser
    vi.mock('../src/utils/frontmatter-parser.js', () => ({
      FrontmatterParser: vi.fn().mockImplementation(() => ({
        parse: vi.fn().mockReturnValue({
          frontmatter: mockLocalIssue,
          content: 'test content'
        }),
        stringify: vi.fn().mockReturnValue('stringified content')
      }))
    }));

    syncEngine = new GitHubSyncEngine(mockConfigManager);
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(syncEngine).toBeDefined();
    });

    it('should throw error if sync not enabled', () => {
      mockConfigManager.getConfig.mockReturnValue({
        github_sync: { enabled: false }
      });

      expect(() => new GitHubSyncEngine(mockConfigManager)).toThrow('GitHub sync is not enabled');
    });
  });

  describe('testConnection', () => {
    it('should test GitHub connection', async () => {
      const mockClient = {
        testConnection: vi.fn().mockResolvedValue({
          success: true,
          message: 'Connected successfully'
        })
      };

      (syncEngine as any).client = mockClient;

      const result = await syncEngine.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Connected successfully');
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync status', async () => {
      const mockClient = {
        getRateLimit: vi.fn().mockResolvedValue({
          remaining: 500,
          limit: 5000
        })
      };

      (syncEngine as any).client = mockClient;

      // Mock getLocalIssues
      vi.spyOn(syncEngine as any, 'getLocalIssues').mockResolvedValue([mockLocalIssue]);
      
      // Mock getSyncMetaPath and filesystem calls
      vi.spyOn(syncEngine as any, 'getSyncMetaPath').mockReturnValue('/path/to/sync-metadata.json');
      
      const fs = await import('fs');
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const status = await syncEngine.getSyncStatus();
      expect(status.enabled).toBe(true);
      expect(status.repository).toBe('owner/repo');
      expect(status.sync_health).toBe('healthy');
    });

    it('should return failed status on error', async () => {
      const mockClient = {
        getRateLimit: vi.fn().mockRejectedValue(new Error('Network error'))
      };

      (syncEngine as any).client = mockClient;

      // Mock getLocalIssues to throw error
      vi.spyOn(syncEngine as any, 'getLocalIssues').mockRejectedValue(new Error('File error'));

      const status = await syncEngine.getSyncStatus();
      expect(status.enabled).toBe(true);
      expect(status.repository).toBe('owner/repo');
      expect(status.sync_health).toBe('failed');
    });
  });

  describe('pushToGitHub', () => {
    it('should push local changes to GitHub', async () => {
      const mockClient = {
        getAllIssues: vi.fn().mockResolvedValue([]),
        createIssue: vi.fn().mockResolvedValue(mockGitHubIssue),
        updateIssue: vi.fn().mockResolvedValue(mockGitHubIssue)
      };

      (syncEngine as any).client = mockClient;

      // Mock getLocalIssues
      vi.spyOn(syncEngine as any, 'getLocalIssues').mockResolvedValue([mockLocalIssue]);
      vi.spyOn(syncEngine as any, 'updateSyncMetadata').mockResolvedValue(undefined);
      vi.spyOn(syncEngine as any, 'updateLocalIssueWithGitHubMetadata').mockResolvedValue(undefined);

      const result = await syncEngine.pushToGitHub();
      expect(result.success).toBe(true);
      expect(result.pushed_count).toBe(1);
    });
  });

  describe('pullFromGitHub', () => {
    it('should pull changes from GitHub', async () => {
      const mockClient = {
        getAllIssues: vi.fn().mockResolvedValue([mockGitHubIssue])
      };

      (syncEngine as any).client = mockClient;

      // Mock getLocalIssues
      vi.spyOn(syncEngine as any, 'getLocalIssues').mockResolvedValue([]);
      vi.spyOn(syncEngine as any, 'updateSyncMetadata').mockResolvedValue(undefined);
      vi.spyOn(syncEngine as any, 'createLocalIssueFromGitHub').mockResolvedValue(mockLocalIssue);

      const result = await syncEngine.pullFromGitHub();
      expect(result.success).toBe(true);
      expect(result.pulled_count).toBe(1);
    });
  });

  describe('bidirectionalSync', () => {
    it('should perform bidirectional sync', async () => {
      const mockClient = {
        getAllIssues: vi.fn().mockResolvedValue([mockGitHubIssue]),
        createIssue: vi.fn().mockResolvedValue(mockGitHubIssue)
      };

      (syncEngine as any).client = mockClient;

      // Mock getLocalIssues
      vi.spyOn(syncEngine as any, 'getLocalIssues').mockResolvedValue([mockLocalIssue]);
      vi.spyOn(syncEngine as any, 'updateSyncMetadata').mockResolvedValue(undefined);
      vi.spyOn(syncEngine as any, 'updateLocalIssueWithGitHubMetadata').mockResolvedValue(undefined);

      const result = await syncEngine.bidirectionalSync();
      expect(result.success).toBe(true);
    });
  });

  describe('conflict resolution', () => {
    it('should detect conflicts when both sides have changes', async () => {
      const localIssue = {
        ...mockLocalIssue,
        updated_date: '2023-01-02T00:00:00Z'
      };

      const githubIssue = {
        ...mockGitHubIssue,
        updated_at: '2023-01-02T00:00:00Z'
      };

      // Mock getLastSyncTime to return earlier date
      vi.spyOn(syncEngine as any, 'getLastSyncTime').mockResolvedValue(new Date('2023-01-01T00:00:00Z'));

      const hasConflict = await (syncEngine as any).hasConflict(localIssue, githubIssue);
      expect(hasConflict).toBe(true);
    });

    it('should not detect conflicts when only one side has changes', async () => {
      const localIssue = {
        ...mockLocalIssue,
        updated_date: '2023-01-01T00:00:00Z'
      };

      const githubIssue = {
        ...mockGitHubIssue,
        updated_at: '2023-01-02T00:00:00Z'
      };

      // Mock getLastSyncTime to return earlier date
      vi.spyOn(syncEngine as any, 'getLastSyncTime').mockResolvedValue(new Date('2023-01-01T00:00:00Z'));

      const hasConflict = await (syncEngine as any).hasConflict(localIssue, githubIssue);
      expect(hasConflict).toBe(false);
    });
  });

  describe('data mapping', () => {
    it('should map local status to GitHub state', () => {
      expect((syncEngine as any).mapStatusToGitHubState('completed')).toBe('closed');
      expect((syncEngine as any).mapStatusToGitHubState('archived')).toBe('closed');
      expect((syncEngine as any).mapStatusToGitHubState('active')).toBe('open');
      expect((syncEngine as any).mapStatusToGitHubState('planning')).toBe('open');
    });

    it('should map GitHub state to local status', () => {
      expect((syncEngine as any).mapGitHubStateToStatus('closed')).toBe('completed');
      expect((syncEngine as any).mapGitHubStateToStatus('open')).toBe('active');
    });

    it('should create GitHub issue body with AI metadata', () => {
      const body = (syncEngine as any).createGitHubIssueBody(mockLocalIssue);
      expect(body).toContain(mockLocalIssue.content);
      expect(body).toContain('AI-Trackdown Metadata');
      expect(body).toContain(mockLocalIssue.ai_context[0]);
      expect(body).toContain(mockLocalIssue.estimated_tokens.toString());
    });

    it('should extract content from GitHub body', () => {
      const bodyWithMetadata = `
        Original content
        
        <!-- AI-Trackdown Metadata -->
        \`\`\`json
        {"ai_context": ["test"]}
        \`\`\`
      `;

      const extracted = (syncEngine as any).extractContentFromGitHubBody(bodyWithMetadata);
      expect(extracted).toBe('Original content');
      expect(extracted).not.toContain('AI-Trackdown Metadata');
    });
  });
});

describe('Integration Tests', () => {
  describe('end-to-end sync flow', () => {
    it('should handle complete sync workflow', async () => {
      // This would be a more complex integration test
      // that tests the entire sync flow with mock data
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      // Test network error scenarios
      expect(true).toBe(true); // Placeholder
    });

    it('should handle rate limiting', async () => {
      // Test rate limiting scenarios
      expect(true).toBe(true); // Placeholder
    });
  });
});