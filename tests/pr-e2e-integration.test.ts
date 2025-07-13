/**
 * End-to-End Integration Tests for PR Commands
 * Tests complete PR workflows from creation to completion
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const _execAsync = promisify(spawn);

describe('PR E2E Integration Tests', () => {
  let testDir: string;
  let originalCwd: string;
  let cliPath: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-trackdown-e2e-'));
    process.chdir(testDir);

    // Get CLI path
    cliPath = path.join(originalCwd, 'dist', 'index.cjs');

    // Initialize test project
    initializeTestProject();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  const initializeTestProject = () => {
    // Create directory structure
    fs.mkdirSync(path.join(testDir, 'prs', 'draft'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'prs', 'active', 'open'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'prs', 'active', 'review'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'prs', 'active', 'approved'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'prs', 'merged'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'prs', 'closed'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'prs', 'reviews'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'tasks'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'issues'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'templates'), { recursive: true });

    // Create config file
    const config = {
      name: 'test-project',
      version: '1.0.0',
      structure: {
        prs_dir: 'prs',
        tasks_dir: 'tasks',
        issues_dir: 'issues',
        templates_dir: 'templates',
      },
      naming_conventions: {
        pr_prefix: 'PR',
        task_prefix: 'TASK',
        issue_prefix: 'ISSUE',
      },
    };
    fs.writeFileSync(path.join(testDir, 'ai-trackdown.json'), JSON.stringify(config, null, 2));

    // Create templates
    createTemplates();

    // Create sample tasks and issues
    createSampleData();
  };

  const createTemplates = () => {
    const prTemplate = `---
pr_id: {PR_ID}
issue_id: {ISSUE_ID}
epic_id: {EPIC_ID}
title: {TITLE}
description: {DESCRIPTION}
status: planning
pr_status: draft
priority: medium
assignee: {ASSIGNEE}
created_date: {CREATED_DATE}
updated_date: {UPDATED_DATE}
estimated_tokens: 0
actual_tokens: 0
ai_context: []
sync_status: local
branch_name: {BRANCH_NAME}
target_branch: main
reviewers: []
approvals: []
tags: []
dependencies: []
blocked_by: []
blocks: []
related_prs: []
template_used: default
---

# {TITLE}

## Description
{DESCRIPTION}

## Changes Made
- [ ] Change 1
- [ ] Change 2
- [ ] Change 3

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Review Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No breaking changes or properly documented

## Additional Notes
{ADDITIONAL_NOTES}`;

    fs.writeFileSync(path.join(testDir, 'templates', 'pr-template.md'), prTemplate);

    const quickTemplate = `---
pr_id: {PR_ID}
issue_id: {ISSUE_ID}
title: {TITLE}
description: {DESCRIPTION}
status: planning
pr_status: draft
priority: medium
assignee: {ASSIGNEE}
created_date: {CREATED_DATE}
updated_date: {UPDATED_DATE}
sync_status: local
branch_name: {BRANCH_NAME}
target_branch: main
reviewers: []
approvals: []
template_used: quick
---

# {TITLE}

## Quick Description
{DESCRIPTION}

## Changes
- Quick fix implemented

## Testing
- [x] Basic testing completed`;

    fs.writeFileSync(path.join(testDir, 'templates', 'pr-quick-template.md'), quickTemplate);
  };

  const createSampleData = () => {
    // Create sample issue
    const issueContent = `---
issue_id: ISSUE-001
epic_id: EPIC-001
title: Sample Issue
description: This is a sample issue for testing
status: active
priority: high
assignee: test-user
created_date: ${new Date().toISOString()}
updated_date: ${new Date().toISOString()}
estimated_tokens: 200
actual_tokens: 0
ai_context: []
sync_status: local
---

# Sample Issue

This is a sample issue for testing PR workflows.

## Acceptance Criteria
- [ ] Implement feature X
- [ ] Add tests for feature X
- [ ] Update documentation

## Tasks
- TASK-001: Implement core functionality
- TASK-002: Add unit tests
- TASK-003: Update documentation`;

    fs.writeFileSync(path.join(testDir, 'issues', 'ISSUE-001-sample-issue.md'), issueContent);

    // Create sample tasks
    const taskContent = `---
task_id: TASK-001
issue_id: ISSUE-001
epic_id: EPIC-001
title: Implement core functionality
description: Implement the core functionality for the feature
status: active
priority: high
assignee: test-user
created_date: ${new Date().toISOString()}
updated_date: ${new Date().toISOString()}
estimated_tokens: 100
actual_tokens: 0
ai_context: []
sync_status: local
---

# Implement core functionality

This task involves implementing the core functionality for the new feature.

## Implementation Details
- Add new class/module
- Implement main logic
- Add error handling
- Add logging

## Definition of Done
- [ ] Code implemented
- [ ] Unit tests added
- [ ] Code review completed
- [ ] Documentation updated`;

    fs.writeFileSync(
      path.join(testDir, 'tasks', 'TASK-001-implement-core-functionality.md'),
      taskContent
    );
  };

  const runCLI = async (
    args: string[]
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [cliPath, ...args], {
        cwd: testDir,
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' },
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
        });
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Set a timeout to prevent hanging
      setTimeout(() => {
        child.kill();
        reject(new Error('Command timed out'));
      }, 30000);
    });
  };

  describe('Complete PR Workflow', () => {
    it('should complete full PR lifecycle: create -> review -> approve -> merge', async () => {
      // Step 1: Create PR
      const createResult = await runCLI([
        'pr',
        'create',
        '--title',
        'Test Feature Implementation',
        '--issue',
        'ISSUE-001',
        '--description',
        'Implementing the test feature',
        '--assignee',
        'test-user',
        '--branch-name',
        'feature/test-implementation',
        '--reviewers',
        'reviewer1,reviewer2',
        '--dry-run',
      ]);

      expect(createResult.exitCode).toBe(0);
      expect(createResult.stdout).toContain('PR would be created');

      // Step 2: Create PR for real
      const createRealResult = await runCLI([
        'pr',
        'create',
        '--title',
        'Test Feature Implementation',
        '--issue',
        'ISSUE-001',
        '--description',
        'Implementing the test feature',
        '--assignee',
        'test-user',
        '--branch-name',
        'feature/test-implementation',
        '--reviewers',
        'reviewer1,reviewer2',
      ]);

      expect(createRealResult.exitCode).toBe(0);
      expect(createRealResult.stdout).toContain('PR created successfully');

      // Step 3: List PRs to verify creation
      const listResult = await runCLI(['pr', 'list']);
      expect(listResult.exitCode).toBe(0);
      expect(listResult.stdout).toContain('Test Feature Implementation');

      // Step 4: Show PR details
      const showResult = await runCLI(['pr', 'show', 'PR-001']);
      expect(showResult.exitCode).toBe(0);
      expect(showResult.stdout).toContain('Test Feature Implementation');
      expect(showResult.stdout).toContain('reviewer1');
      expect(showResult.stdout).toContain('reviewer2');

      // Step 5: Update PR status to review
      const updateResult = await runCLI(['pr', 'update', 'PR-001', '--status', 'review']);
      expect(updateResult.exitCode).toBe(0);
      expect(updateResult.stdout).toContain('PR updated successfully');

      // Step 6: Add review
      const reviewResult = await runCLI([
        'pr',
        'review',
        'PR-001',
        '--approve',
        '--comments',
        'This looks good! LGTM.',
        '--reviewer',
        'reviewer1',
      ]);
      expect(reviewResult.exitCode).toBe(0);
      expect(reviewResult.stdout).toContain('Review added successfully');

      // Step 7: Approve PR
      const approveResult = await runCLI([
        'pr',
        'approve',
        'PR-001',
        '--comments',
        'Final approval',
        '--reviewer',
        'reviewer2',
      ]);
      expect(approveResult.exitCode).toBe(0);
      expect(approveResult.stdout).toContain('PR approved successfully');

      // Step 8: Merge PR
      const mergeResult = await runCLI([
        'pr',
        'merge',
        'PR-001',
        '--strategy',
        'squash',
        '--close-linked-tasks',
      ]);
      expect(mergeResult.exitCode).toBe(0);
      expect(mergeResult.stdout).toContain('PR merged successfully');

      // Step 9: Verify PR is in merged directory
      const finalListResult = await runCLI(['pr', 'list', '--status', 'merged']);
      expect(finalListResult.exitCode).toBe(0);
      expect(finalListResult.stdout).toContain('Test Feature Implementation');
    });

    it('should handle PR rejection workflow', async () => {
      // Create PR
      const createResult = await runCLI([
        'pr',
        'create',
        '--title',
        'Feature to be rejected',
        '--issue',
        'ISSUE-001',
        '--description',
        'This feature will be rejected',
        '--assignee',
        'test-user',
      ]);
      expect(createResult.exitCode).toBe(0);

      // Request changes
      const reviewResult = await runCLI([
        'pr',
        'review',
        'PR-001',
        '--request-changes',
        '--comments',
        'This needs significant changes',
        '--reviewer',
        'reviewer1',
      ]);
      expect(reviewResult.exitCode).toBe(0);

      // Close PR
      const closeResult = await runCLI([
        'pr',
        'close',
        'PR-001',
        '--reason',
        'rejected',
        '--update-linked-tasks',
      ]);
      expect(closeResult.exitCode).toBe(0);
      expect(closeResult.stdout).toContain('PR closed successfully');

      // Verify PR is closed
      const listResult = await runCLI(['pr', 'list', '--status', 'closed']);
      expect(listResult.exitCode).toBe(0);
      expect(listResult.stdout).toContain('Feature to be rejected');
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch PR operations', async () => {
      // Create multiple PRs
      const prTitles = ['Batch PR 1', 'Batch PR 2', 'Batch PR 3'];

      for (const title of prTitles) {
        const createResult = await runCLI([
          'pr',
          'create',
          '--title',
          title,
          '--issue',
          'ISSUE-001',
          '--description',
          `Description for ${title}`,
          '--assignee',
          'test-user',
        ]);
        expect(createResult.exitCode).toBe(0);
      }

      // List all PRs
      const listResult = await runCLI(['pr', 'list']);
      expect(listResult.exitCode).toBe(0);
      prTitles.forEach((title) => {
        expect(listResult.stdout).toContain(title);
      });

      // Batch approve (if implemented)
      const batchResult = await runCLI([
        'pr',
        'batch',
        '--operation',
        'approve',
        '--filter',
        'status:open',
        '--dry-run',
      ]);
      expect(batchResult.exitCode).toBe(0);
      expect(batchResult.stdout).toContain('Batch operation');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid PR operations gracefully', async () => {
      // Try to show non-existent PR
      const showResult = await runCLI(['pr', 'show', 'PR-999']);
      expect(showResult.exitCode).not.toBe(0);
      expect(showResult.stderr).toContain('PR not found');

      // Try to merge non-existent PR
      const mergeResult = await runCLI(['pr', 'merge', 'PR-999']);
      expect(mergeResult.exitCode).not.toBe(0);
      expect(mergeResult.stderr).toContain('PR not found');

      // Try to create PR with invalid issue
      const createResult = await runCLI([
        'pr',
        'create',
        '--title',
        'Test PR',
        '--issue',
        'INVALID-999',
        '--description',
        'Test description',
      ]);
      expect(createResult.exitCode).not.toBe(0);
      expect(createResult.stderr).toContain('Issue not found');
    });

    it('should validate required parameters', async () => {
      // Try to create PR without required title
      const createResult = await runCLI([
        'pr',
        'create',
        '--issue',
        'ISSUE-001',
        '--description',
        'Test description',
      ]);
      expect(createResult.exitCode).not.toBe(0);
      expect(createResult.stderr).toContain('required');

      // Try to merge PR without ID
      const mergeResult = await runCLI(['pr', 'merge']);
      expect(mergeResult.exitCode).not.toBe(0);
      expect(mergeResult.stderr).toContain('required');
    });
  });

  describe('Performance Tests', () => {
    it('should handle commands within acceptable time limits', async () => {
      // Create a PR
      const createStart = Date.now();
      const createResult = await runCLI([
        'pr',
        'create',
        '--title',
        'Performance Test PR',
        '--issue',
        'ISSUE-001',
        '--description',
        'Testing performance',
        '--assignee',
        'test-user',
      ]);
      const createTime = Date.now() - createStart;

      expect(createResult.exitCode).toBe(0);
      expect(createTime).toBeLessThan(5000); // Should complete in under 5 seconds

      // List PRs
      const listStart = Date.now();
      const listResult = await runCLI(['pr', 'list']);
      const listTime = Date.now() - listStart;

      expect(listResult.exitCode).toBe(0);
      expect(listTime).toBeLessThan(2000); // Should complete in under 2 seconds

      // Show PR details
      const showStart = Date.now();
      const showResult = await runCLI(['pr', 'show', 'PR-001']);
      const showTime = Date.now() - showStart;

      expect(showResult.exitCode).toBe(0);
      expect(showTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  describe('CLI Help and Documentation', () => {
    it('should provide comprehensive help information', async () => {
      // Test main PR command help
      const prHelpResult = await runCLI(['pr', '--help']);
      expect(prHelpResult.exitCode).toBe(0);
      expect(prHelpResult.stdout).toContain('Usage:');
      expect(prHelpResult.stdout).toContain('Commands:');
      expect(prHelpResult.stdout).toContain('create');
      expect(prHelpResult.stdout).toContain('list');
      expect(prHelpResult.stdout).toContain('show');
      expect(prHelpResult.stdout).toContain('merge');

      // Test subcommand help
      const createHelpResult = await runCLI(['pr', 'create', '--help']);
      expect(createHelpResult.exitCode).toBe(0);
      expect(createHelpResult.stdout).toContain('Create a new PR');
      expect(createHelpResult.stdout).toContain('--title');
      expect(createHelpResult.stdout).toContain('--issue');
      expect(createHelpResult.stdout).toContain('--description');

      const listHelpResult = await runCLI(['pr', 'list', '--help']);
      expect(listHelpResult.exitCode).toBe(0);
      expect(listHelpResult.stdout).toContain('List PRs');
      expect(listHelpResult.stdout).toContain('--status');
      expect(listHelpResult.stdout).toContain('--assignee');
    });

    it('should provide examples in help text', async () => {
      const helpResult = await runCLI(['pr', 'create', '--help']);
      expect(helpResult.exitCode).toBe(0);
      expect(helpResult.stdout).toContain('Examples:');
    });
  });

  describe('Configuration Integration', () => {
    it('should respect project configuration', async () => {
      // Test with custom configuration
      const customConfig = {
        name: 'custom-project',
        version: '2.0.0',
        structure: {
          prs_dir: 'pull-requests',
          tasks_dir: 'tasks',
          issues_dir: 'issues',
        },
        naming_conventions: {
          pr_prefix: 'MR',
          task_prefix: 'TASK',
          issue_prefix: 'ISSUE',
        },
      };

      fs.writeFileSync(
        path.join(testDir, 'ai-trackdown.json'),
        JSON.stringify(customConfig, null, 2)
      );

      // Create directories for custom config
      fs.mkdirSync(path.join(testDir, 'pull-requests', 'draft'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'pull-requests', 'active'), { recursive: true });

      // Try to create PR with custom config
      const createResult = await runCLI([
        'pr',
        'create',
        '--title',
        'Custom Config Test',
        '--issue',
        'ISSUE-001',
        '--description',
        'Testing custom configuration',
        '--assignee',
        'test-user',
      ]);

      expect(createResult.exitCode).toBe(0);
      expect(createResult.stdout).toContain('MR-001'); // Should use custom prefix
    });
  });

  describe('File System Integration', () => {
    it('should maintain proper file organization', async () => {
      // Create PR
      const createResult = await runCLI([
        'pr',
        'create',
        '--title',
        'File System Test',
        '--issue',
        'ISSUE-001',
        '--description',
        'Testing file system integration',
        '--assignee',
        'test-user',
      ]);
      expect(createResult.exitCode).toBe(0);

      // Verify file was created in correct location
      const draftFiles = fs.readdirSync(path.join(testDir, 'prs', 'draft'));
      expect(draftFiles.length).toBe(1);
      expect(draftFiles[0]).toContain('PR-001');

      // Update status and verify file move
      const updateResult = await runCLI(['pr', 'update', 'PR-001', '--status', 'open']);
      expect(updateResult.exitCode).toBe(0);

      // Verify file moved to correct directory
      const openFiles = fs.readdirSync(path.join(testDir, 'prs', 'active', 'open'));
      expect(openFiles.length).toBe(1);
      expect(openFiles[0]).toContain('PR-001');

      // Verify file no longer in draft directory
      const draftFilesAfter = fs.readdirSync(path.join(testDir, 'prs', 'draft'));
      expect(draftFilesAfter.length).toBe(0);
    });
  });
});
