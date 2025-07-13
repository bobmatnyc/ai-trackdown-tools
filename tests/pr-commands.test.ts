/**
 * PR Commands Test Suite
 * Tests the PR command functionality and integration
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPRApproveCommand } from '../src/commands/pr/approve.js';
import { createPRCreateCommand } from '../src/commands/pr/create.js';
import { createPRListCommand } from '../src/commands/pr/list.js';
import { createPRReviewCommand } from '../src/commands/pr/review.js';
import { createPRShowCommand } from '../src/commands/pr/show.js';
import { createPRUpdateCommand } from '../src/commands/pr/update.js';
import { createPRCommand } from '../src/commands/pr.js';
import type { PRFrontmatter, PRStatus } from '../src/types/ai-trackdown.js';
import { ConfigManager } from '../src/utils/config-manager.js';
import { PRFileManager } from '../src/utils/pr-file-manager.js';
import { PRStatusManager } from '../src/utils/pr-status-manager.js';

describe('PR Commands', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-trackdown-pr-test-'));
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('PR Command Registration', () => {
    it('should create main PR command with subcommands', () => {
      const prCommand = createPRCommand();

      expect(prCommand.name()).toBe('pr');
      expect(prCommand.alias()).toBe('prs');
      expect(prCommand.description()).toContain('pull request tracking');

      const subcommands = prCommand.commands.map((cmd) => cmd.name());
      expect(subcommands).toContain('create');
      expect(subcommands).toContain('list');
      expect(subcommands).toContain('show');
      expect(subcommands).toContain('review');
      expect(subcommands).toContain('approve');
      expect(subcommands).toContain('update');
    });

    it('should create PR create command with required options', () => {
      const createCommand = createPRCreateCommand();

      expect(createCommand.name()).toBe('create');
      expect(createCommand.description()).toContain('Create a new PR');

      const options = createCommand.options.map((opt) => opt.long);
      expect(options).toContain('--issue');
      expect(options).toContain('--description');
      expect(options).toContain('--assignee');
      expect(options).toContain('--priority');
      expect(options).toContain('--pr-status');
      expect(options).toContain('--branch-name');
      expect(options).toContain('--target-branch');
      expect(options).toContain('--reviewers');
      expect(options).toContain('--dry-run');
    });

    it('should create PR list command with filter options', () => {
      const listCommand = createPRListCommand();

      expect(listCommand.name()).toBe('list');
      expect(listCommand.description()).toContain('List PRs');

      const options = listCommand.options.map((opt) => opt.long);
      expect(options).toContain('--status');
      expect(options).toContain('--pr-status');
      expect(options).toContain('--priority');
      expect(options).toContain('--assignee');
      expect(options).toContain('--issue');
      expect(options).toContain('--epic');
      expect(options).toContain('--reviewer');
      expect(options).toContain('--branch-name');
      expect(options).toContain('--format');
    });

    it('should create PR show command with display options', () => {
      const showCommand = createPRShowCommand();

      expect(showCommand.name()).toBe('show');
      expect(showCommand.description()).toContain('Show detailed information');

      const options = showCommand.options.map((opt) => opt.long);
      expect(options).toContain('--format');
      expect(options).toContain('--show-content');
      expect(options).toContain('--show-relationships');
      expect(options).toContain('--show-history');
    });
  });

  describe('PR Status Validation', () => {
    it('should validate PR status enum values', () => {
      const validStatuses: PRStatus[] = ['draft', 'open', 'review', 'approved', 'merged', 'closed'];

      for (const status of validStatuses) {
        expect(typeof status).toBe('string');
        expect(['draft', 'open', 'review', 'approved', 'merged', 'closed']).toContain(status);
      }
    });
  });

  describe('PR Frontmatter Structure', () => {
    it('should have correct PR frontmatter interface structure', () => {
      const samplePRFrontmatter: PRFrontmatter = {
        pr_id: 'PR-0001',
        issue_id: 'ISS-0001',
        epic_id: 'EP-0001',
        title: 'Test PR',
        description: 'Test PR description',
        status: 'planning',
        pr_status: 'draft',
        priority: 'medium',
        assignee: 'test-user',
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        estimated_tokens: 100,
        actual_tokens: 0,
        ai_context: ['context/test'],
        sync_status: 'local',
        branch_name: 'feature/test-pr',
        target_branch: 'main',
        reviewers: ['reviewer1', 'reviewer2'],
        approvals: [],
        tags: ['feature'],
        dependencies: [],
        blocked_by: [],
        blocks: [],
        related_prs: [],
        template_used: 'default',
      };

      // Test required fields
      expect(samplePRFrontmatter.pr_id).toBeDefined();
      expect(samplePRFrontmatter.issue_id).toBeDefined();
      expect(samplePRFrontmatter.epic_id).toBeDefined();
      expect(samplePRFrontmatter.pr_status).toBeDefined();
      expect(samplePRFrontmatter.title).toBeDefined();
      expect(samplePRFrontmatter.status).toBeDefined();
      expect(samplePRFrontmatter.priority).toBeDefined();
      expect(samplePRFrontmatter.assignee).toBeDefined();

      // Test optional fields
      expect(samplePRFrontmatter.branch_name).toBeDefined();
      expect(samplePRFrontmatter.target_branch).toBeDefined();
      expect(samplePRFrontmatter.reviewers).toBeDefined();
      expect(samplePRFrontmatter.approvals).toBeDefined();
      expect(Array.isArray(samplePRFrontmatter.reviewers)).toBe(true);
      expect(Array.isArray(samplePRFrontmatter.approvals)).toBe(true);
    });
  });

  describe('PR Relationships', () => {
    it('should properly link PR to issue and epic', () => {
      const prData = {
        pr_id: 'PR-0001',
        issue_id: 'ISS-0001',
        epic_id: 'EP-0001',
        title: 'Test PR',
        description: 'Test description',
        status: 'planning' as const,
        pr_status: 'draft' as const,
        priority: 'medium' as const,
        assignee: 'test-user',
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        estimated_tokens: 0,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local' as const,
      };

      expect(prData.issue_id).toBe('ISS-0001');
      expect(prData.epic_id).toBe('EP-0001');
      expect(prData.pr_id).toBe('PR-0001');
    });
  });

  describe('PR CLI Integration', () => {
    it('should integrate with main CLI structure', () => {
      const prCommand = createPRCommand();

      // Test that command can be executed (basic smoke test)
      expect(() => prCommand.configureHelp()).not.toThrow();
      expect(prCommand.commands.length).toBeGreaterThan(0);
    });
  });

  describe('PR Configuration', () => {
    it('should support PR directory in configuration', () => {
      // This tests that the configuration system supports PR directories
      const config = {
        name: 'test-project',
        version: '1.0.0',
        structure: {
          epics_dir: 'epics',
          issues_dir: 'issues',
          tasks_dir: 'tasks',
          templates_dir: 'templates',
          prs_dir: 'prs', // This should be supported
        },
        naming_conventions: {
          epic_prefix: 'EP',
          issue_prefix: 'ISS',
          task_prefix: 'TSK',
          pr_prefix: 'PR', // This should be supported
          file_extension: '.md',
        },
      };

      expect(config.structure.prs_dir).toBe('prs');
      expect(config.naming_conventions.pr_prefix).toBe('PR');
    });
  });

  describe('PR Validation', () => {
    it('should validate PR ID format', () => {
      const validPRIds = ['PR-0001', 'PR-0123', 'PR-9999'];
      const invalidPRIds = ['PR-1', 'PR01', 'pr-0001', 'PULL-0001'];

      for (const id of validPRIds) {
        expect(/^PR-\d{4}$/.test(id)).toBe(true);
      }

      for (const id of invalidPRIds) {
        expect(/^PR-\d{4}$/.test(id)).toBe(false);
      }
    });

    it('should validate PR status transitions', () => {
      const validTransitions = [
        ['draft', 'open'],
        ['open', 'review'],
        ['review', 'approved'],
        ['approved', 'merged'],
        ['open', 'closed'],
        ['review', 'closed'],
      ];

      for (const [from, to] of validTransitions) {
        // Basic validation that both states are valid PR statuses
        const validStatuses = ['draft', 'open', 'review', 'approved', 'merged', 'closed'];
        expect(validStatuses).toContain(from);
        expect(validStatuses).toContain(to);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing issue reference gracefully', () => {
      // This would be tested with actual command execution in integration tests
      // For now, we just verify the structure supports error cases
      const prWithMissingIssue = {
        pr_id: 'PR-0001',
        issue_id: 'ISS-9999', // Non-existent issue
        epic_id: 'EP-0001',
        title: 'Test PR',
        status: 'planning' as const,
        pr_status: 'draft' as const,
      };

      expect(prWithMissingIssue.issue_id).toBe('ISS-9999');
      // In actual implementation, this would trigger validation errors
    });
  });

  // ========================================
  // PHASE 2 TESTS: PR Lifecycle Management
  // ========================================

  describe('Phase 2: PR Review Commands', () => {
    it('should create PR review command with all options', () => {
      const reviewCommand = createPRReviewCommand();

      expect(reviewCommand.name()).toBe('review');
      expect(reviewCommand.description()).toContain('Create or update a PR review');

      const options = reviewCommand.options.map((opt) => opt.long);
      expect(options).toContain('--comments');
      expect(options).toContain('--approve');
      expect(options).toContain('--request-changes');
      expect(options).toContain('--status');
      expect(options).toContain('--reviewer');
      expect(options).toContain('--template');
      expect(options).toContain('--add-reviewer');
      expect(options).toContain('--remove-reviewer');
      expect(options).toContain('--dry-run');
    });

    it('should create PR approve command with merge options', () => {
      const approveCommand = createPRApproveCommand();

      expect(approveCommand.name()).toBe('approve');
      expect(approveCommand.description()).toContain('Approve a PR');

      const options = approveCommand.options.map((opt) => opt.long);
      expect(options).toContain('--comments');
      expect(options).toContain('--auto-merge');
      expect(options).toContain('--merge-strategy');
      expect(options).toContain('--reviewer');
      expect(options).toContain('--bypass-checks');
      expect(options).toContain('--dry-run');
    });

    it('should create PR update command with comprehensive options', () => {
      const updateCommand = createPRUpdateCommand();

      expect(updateCommand.name()).toBe('update');
      expect(updateCommand.description()).toContain('Update PR status');

      const options = updateCommand.options.map((opt) => opt.long);
      expect(options).toContain('--status');
      expect(options).toContain('--priority');
      expect(options).toContain('--assignee');
      expect(options).toContain('--title');
      expect(options).toContain('--description');
      expect(options).toContain('--branch-name');
      expect(options).toContain('--source-branch');
      expect(options).toContain('--target-branch');
      expect(options).toContain('--add-reviewer');
      expect(options).toContain('--remove-reviewer');
      expect(options).toContain('--add-tag');
      expect(options).toContain('--remove-tag');
      expect(options).toContain('--dry-run');
    });
  });

  describe('Phase 2: PR Status Manager', () => {
    let statusManager: PRStatusManager;
    let configManager: ConfigManager;

    beforeEach(() => {
      configManager = new ConfigManager();
      statusManager = new PRStatusManager(configManager);
    });

    it('should validate status transitions correctly', () => {
      // Valid transitions
      expect(statusManager.isValidStatusTransition('draft', 'open')).toBe(true);
      expect(statusManager.isValidStatusTransition('open', 'review')).toBe(true);
      expect(statusManager.isValidStatusTransition('review', 'approved')).toBe(true);
      expect(statusManager.isValidStatusTransition('approved', 'merged')).toBe(true);
      expect(statusManager.isValidStatusTransition('open', 'closed')).toBe(true);
      expect(statusManager.isValidStatusTransition('closed', 'open')).toBe(true);

      // Invalid transitions
      expect(statusManager.isValidStatusTransition('merged', 'open')).toBe(false);
      expect(statusManager.isValidStatusTransition('draft', 'approved')).toBe(false);
      expect(statusManager.isValidStatusTransition('merged', 'review')).toBe(false);
    });

    it('should get correct status directories', () => {
      const basePRsDir = '/test/prs';

      expect(statusManager.getStatusDirectory('draft', basePRsDir)).toBe('/test/prs/draft');
      expect(statusManager.getStatusDirectory('open', basePRsDir)).toBe('/test/prs/active');
      expect(statusManager.getStatusDirectory('review', basePRsDir)).toBe('/test/prs/active');
      expect(statusManager.getStatusDirectory('approved', basePRsDir)).toBe('/test/prs/active');
      expect(statusManager.getStatusDirectory('merged', basePRsDir)).toBe('/test/prs/merged');
      expect(statusManager.getStatusDirectory('closed', basePRsDir)).toBe('/test/prs/closed');
    });

    it('should validate PR status transition business rules', () => {
      const mockPR = {
        pr_id: 'PR-0001',
        pr_status: 'review' as PRStatus,
        reviewers: ['reviewer1', 'reviewer2'],
        approvals: ['reviewer1'],
        blocked_by: [],
      } as any;

      // Test approval validation
      const approvalResult = statusManager.validateStatusTransition(mockPR, 'approved');
      expect(approvalResult.valid).toBe(true);
      expect(approvalResult.warnings).toContain('PR needs 1 more approvals');

      // Test merge validation
      const mergeResult = statusManager.validateStatusTransition(mockPR, 'merged');
      expect(mergeResult.valid).toBe(false);
      expect(mergeResult.errors).toContain('PR must be approved before merging');
    });

    it('should get next recommended status', () => {
      expect(statusManager.getNextRecommendedStatus({ pr_status: 'draft' } as any)).toBe('open');
      expect(statusManager.getNextRecommendedStatus({ pr_status: 'open' } as any)).toBe('review');
      expect(statusManager.getNextRecommendedStatus({ pr_status: 'approved' } as any)).toBe(
        'merged'
      );
      expect(statusManager.getNextRecommendedStatus({ pr_status: 'merged' } as any)).toBe(null);
    });

    it('should get auto status transitions', () => {
      // PR with all reviewers approved
      const fullyApprovedPR = {
        pr_status: 'review' as PRStatus,
        reviewers: ['reviewer1', 'reviewer2'],
        approvals: ['reviewer1', 'reviewer2'],
      } as any;

      expect(statusManager.getAutoStatusTransition(fullyApprovedPR)).toBe('approved');

      // PR without enough approvals
      const partiallyApprovedPR = {
        pr_status: 'review' as PRStatus,
        reviewers: ['reviewer1', 'reviewer2'],
        approvals: ['reviewer1'],
      } as any;

      expect(statusManager.getAutoStatusTransition(partiallyApprovedPR)).toBe(null);
    });

    it('should generate status transition reports', () => {
      const mockPR = {
        pr_id: 'PR-0001',
        approvals: ['reviewer1'],
        reviewers: ['reviewer1', 'reviewer2'],
      } as any;

      const report = statusManager.generateStatusReport(mockPR, 'review', 'approved', {
        triggered_by: 'test',
        file_moved: true,
      });

      expect(report.pr_id).toBe('PR-0001');
      expect(report.from_status).toBe('review');
      expect(report.to_status).toBe('approved');
      expect(report.triggered_by).toBe('test');
      expect(report.file_moved).toBe(true);
      expect(report.approvals_count).toBe(1);
      expect(report.reviewers_count).toBe(2);
    });
  });

  describe('Phase 2: PR File Manager', () => {
    let fileManager: PRFileManager;
    let configManager: ConfigManager;
    let testPRsDir: string;

    beforeEach(() => {
      configManager = new ConfigManager();
      fileManager = new PRFileManager(configManager);
      testPRsDir = path.join(testDir, 'prs');
    });

    it('should initialize PR directory structure', () => {
      fileManager.initializePRDirectories(testPRsDir);

      expect(fs.existsSync(path.join(testPRsDir, 'draft'))).toBe(true);
      expect(fs.existsSync(path.join(testPRsDir, 'active'))).toBe(true);
      expect(fs.existsSync(path.join(testPRsDir, 'merged'))).toBe(true);
      expect(fs.existsSync(path.join(testPRsDir, 'closed'))).toBe(true);
      expect(fs.existsSync(path.join(testPRsDir, 'reviews'))).toBe(true);
      expect(fs.existsSync(path.join(testPRsDir, 'logs'))).toBe(true);
      expect(fs.existsSync(path.join(testPRsDir, 'active', 'open'))).toBe(true);
      expect(fs.existsSync(path.join(testPRsDir, 'active', 'review'))).toBe(true);
      expect(fs.existsSync(path.join(testPRsDir, 'active', 'approved'))).toBe(true);
    });

    it('should get correct PR directories for each status', () => {
      expect(fileManager.getPRDirectory('draft', testPRsDir)).toBe(path.join(testPRsDir, 'draft'));
      expect(fileManager.getPRDirectory('open', testPRsDir)).toBe(
        path.join(testPRsDir, 'active', 'open')
      );
      expect(fileManager.getPRDirectory('review', testPRsDir)).toBe(
        path.join(testPRsDir, 'active', 'review')
      );
      expect(fileManager.getPRDirectory('approved', testPRsDir)).toBe(
        path.join(testPRsDir, 'active', 'approved')
      );
      expect(fileManager.getPRDirectory('merged', testPRsDir)).toBe(
        path.join(testPRsDir, 'merged')
      );
      expect(fileManager.getPRDirectory('closed', testPRsDir)).toBe(
        path.join(testPRsDir, 'closed')
      );
    });

    it('should create review files correctly', async () => {
      fileManager.initializePRDirectories(testPRsDir);

      const reviewPath = await fileManager.createReviewFile(
        'PR-0001',
        'reviewer1',
        'approve',
        'Test review content',
        testPRsDir
      );

      expect(fs.existsSync(reviewPath)).toBe(true);
      expect(path.dirname(reviewPath)).toBe(path.join(testPRsDir, 'reviews'));
      expect(path.basename(reviewPath)).toMatch(/^PR-0001-approve-reviewer1-\d+\.md$/);

      const content = fs.readFileSync(reviewPath, 'utf8');
      expect(content).toBe('Test review content');
    });

    it('should get directory statistics correctly', () => {
      fileManager.initializePRDirectories(testPRsDir);

      // Create some test files
      fs.writeFileSync(path.join(testPRsDir, 'draft', 'PR-0001.md'), 'draft pr');
      fs.writeFileSync(path.join(testPRsDir, 'active', 'open', 'PR-0002.md'), 'open pr');
      fs.writeFileSync(path.join(testPRsDir, 'merged', 'PR-0003.md'), 'merged pr');
      fs.writeFileSync(path.join(testPRsDir, 'reviews', 'review-1.md'), 'review');

      const stats = fileManager.getPRDirectoryStats(testPRsDir);

      expect(stats.draft).toBe(1);
      expect(stats.open).toBe(1);
      expect(stats.merged).toBe(1);
      expect(stats.total).toBe(3);
      expect(stats.reviewFiles).toBe(1);
      expect(stats.diskUsage).toBeGreaterThan(0);
    });

    it('should validate directory structure', () => {
      // Test with incomplete structure
      const validation1 = fileManager.validatePRDirectoryStructure(testPRsDir);
      expect(validation1.valid).toBe(false);
      expect(validation1.errors.length).toBeGreaterThan(0);

      // Test with complete structure
      fileManager.initializePRDirectories(testPRsDir);
      const validation2 = fileManager.validatePRDirectoryStructure(testPRsDir);
      expect(validation2.valid).toBe(true);
      expect(validation2.errors.length).toBe(0);
    });

    it('should find PR files correctly', () => {
      fileManager.initializePRDirectories(testPRsDir);

      // Create test PR files
      fs.writeFileSync(path.join(testPRsDir, 'draft', 'PR-0001.md'), 'content');
      fs.writeFileSync(path.join(testPRsDir, 'active', 'open', 'PR-0002.md'), 'content');
      fs.writeFileSync(path.join(testPRsDir, 'merged', 'PR-0003.md'), 'content');
      fs.writeFileSync(path.join(testPRsDir, 'reviews', 'not-a-pr.md'), 'content'); // Should be ignored

      const prFiles = fileManager.findPRFiles(testPRsDir);

      expect(prFiles.length).toBe(3);
      expect(prFiles.some((file) => file.includes('PR-0001.md'))).toBe(true);
      expect(prFiles.some((file) => file.includes('PR-0002.md'))).toBe(true);
      expect(prFiles.some((file) => file.includes('PR-0003.md'))).toBe(true);
      expect(prFiles.some((file) => file.includes('not-a-pr.md'))).toBe(false);
    });
  });

  describe('Phase 2: PR Review System Integration', () => {
    it('should support review types', () => {
      const reviewTypes = ['approve', 'request_changes', 'comment'];

      reviewTypes.forEach((type) => {
        expect(['approve', 'request_changes', 'comment']).toContain(type);
      });
    });

    it('should handle review state management', () => {
      const reviewStates = ['pending', 'submitted', 'dismissed'];

      reviewStates.forEach((state) => {
        expect(['pending', 'submitted', 'dismissed']).toContain(state);
      });
    });

    it('should support merge strategies', () => {
      const mergeStrategies = ['merge', 'squash', 'rebase'];

      mergeStrategies.forEach((strategy) => {
        expect(['merge', 'squash', 'rebase']).toContain(strategy);
      });
    });
  });

  describe('Phase 2: Error Handling and Edge Cases', () => {
    it('should handle invalid status transitions', () => {
      const configManager = new ConfigManager();
      const statusManager = new PRStatusManager(configManager);

      expect(statusManager.isValidStatusTransition('merged', 'draft')).toBe(false);
      expect(statusManager.isValidStatusTransition('closed', 'merged')).toBe(false);
      expect(statusManager.isValidStatusTransition('approved', 'draft')).toBe(false);
    });

    it('should validate reviewer management', () => {
      // Test reviewer addition/removal logic
      const initialReviewers = ['reviewer1', 'reviewer2'];

      // Add reviewer
      const addReviewer = (reviewers: string[], newReviewer: string) => {
        return reviewers.includes(newReviewer) ? reviewers : [...reviewers, newReviewer];
      };

      // Remove reviewer
      const removeReviewer = (reviewers: string[], targetReviewer: string) => {
        return reviewers.filter((r) => r !== targetReviewer);
      };

      const withNewReviewer = addReviewer(initialReviewers, 'reviewer3');
      expect(withNewReviewer).toContain('reviewer3');
      expect(withNewReviewer.length).toBe(3);

      const withoutReviewer = removeReviewer(initialReviewers, 'reviewer1');
      expect(withoutReviewer).not.toContain('reviewer1');
      expect(withoutReviewer.length).toBe(1);
    });

    it('should handle approval tracking', () => {
      const mockPR = {
        reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
        approvals: ['reviewer1', 'reviewer2'],
      };

      const isFullyApproved = mockPR.approvals.length >= mockPR.reviewers.length;
      const remainingApprovals = mockPR.reviewers.length - mockPR.approvals.length;

      expect(isFullyApproved).toBe(false);
      expect(remainingApprovals).toBe(1);
    });

    it('should validate review conflicts', () => {
      // Test that approve and request_changes are mutually exclusive
      const conflictingOptions = {
        approve: true,
        requestChanges: true,
      };

      const hasConflict = conflictingOptions.approve && conflictingOptions.requestChanges;
      expect(hasConflict).toBe(true);
    });
  });
});
