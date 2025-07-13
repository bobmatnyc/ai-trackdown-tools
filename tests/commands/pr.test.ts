import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPRCommand } from '../../src/commands/pr.js';
import {
  CLITestUtils,
  createMockProject,
  setupTestEnvironment,
  TestAssertions,
} from '../utils/test-helpers.js';

// Mock external dependencies
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  }),
}));

vi.mock('chalk', () => ({
  default: {
    green: vi.fn((text) => text),
    red: vi.fn((text) => text),
    blue: vi.fn((text) => text),
    yellow: vi.fn((text) => text),
    cyan: vi.fn((text) => text),
    gray: vi.fn((text) => text),
    bold: {
      green: vi.fn((text) => text),
      red: vi.fn((text) => text),
      blue: vi.fn((text) => text),
      yellow: vi.fn((text) => text),
      cyan: vi.fn((text) => text),
    },
  },
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

// Mock GitHub client
vi.mock('../../src/utils/github-client.js', () => ({
  GitHubClient: {
    getInstance: vi.fn(() => ({
      createPullRequest: vi
        .fn()
        .mockResolvedValue({ number: 123, html_url: 'https://github.com/test/repo/pull/123' }),
      updatePullRequest: vi.fn().mockResolvedValue({}),
      mergePullRequest: vi.fn().mockResolvedValue({}),
      closePullRequest: vi.fn().mockResolvedValue({}),
      getPullRequest: vi.fn().mockResolvedValue({ number: 123, state: 'open', title: 'Test PR' }),
      listPullRequests: vi
        .fn()
        .mockResolvedValue([{ number: 123, title: 'Test PR', state: 'open' }]),
    })),
  },
}));

describe('PR Command Tests', () => {
  const getTestContext = setupTestEnvironment();

  beforeEach(() => {
    const testContext = getTestContext();
    createMockProject(testContext.tempDir);

    // Create a sample PR file for testing
    const prContent = `---
title: Test PR
description: A test pull request for testing
status: open
priority: medium
assignee: test-user
created_date: ${new Date().toISOString()}
updated_date: ${new Date().toISOString()}
branch: feature/test-branch
target_branch: main
github_pr_number: 123
github_url: https://github.com/test/repo/pull/123
ai_context:
  - context/requirements
sync_status: local
related_issues:
  - ISS-0001
dependencies: []
review_status: pending
merge_status: pending
---

# PR: Test PR

## Description
This is a test pull request for testing purposes.

## Changes
- [ ] Change 1
- [ ] Change 2

## Review Checklist
- [ ] Code review completed
- [ ] Tests passing
- [ ] Documentation updated
`;

    fs.writeFileSync(
      path.join(testContext.tempDir, 'tasks', 'prs', 'PR-0001-test-pr.md'),
      prContent
    );
  });

  describe('PR Create Command', () => {
    it('should create a new PR with required fields', async () => {
      const testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          [
            'node',
            'test',
            'pr',
            'create',
            'New Test PR',
            '--description',
            'A new test pull request',
            '--issue',
            'ISS-0001',
            '--branch-name',
            'feature/new-feature',
            '--target-branch',
            'main',
          ],
          { from: 'user' }
        );

        // Check if PR file was created
        const prFiles = fs.readdirSync(path.join(testContext.tempDir, 'tasks', 'prs'));
        expect(prFiles.length).toBeGreaterThan(1); // Should have existing + new PR

        const newPRFile = prFiles.find((f) => f.includes('new-test-pr'));
        expect(newPRFile).toBeDefined();

        if (newPRFile) {
          const prPath = path.join(testContext.tempDir, 'tasks', 'prs', newPRFile);
          TestAssertions.assertFileExists(prPath);
          TestAssertions.assertValidYamlFrontmatter(prPath);
          TestAssertions.assertFileContains(prPath, 'title: New Test PR');
          TestAssertions.assertFileContains(prPath, 'description: A new test pull request');
          TestAssertions.assertFileContains(prPath, 'branch: feature/new-feature');
          TestAssertions.assertFileContains(prPath, 'target_branch: main');
          TestAssertions.assertFileContains(prPath, 'related_issues:');
          TestAssertions.assertFileContains(prPath, '- ISS-0001');
        }
      } finally {
        consoleMock.restore();
      }
    });

    it('should create PR with GitHub integration', async () => {
      const testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          [
            'node',
            'test',
            'pr',
            'create',
            'GitHub PR',
            '--description',
            'PR with GitHub integration',
            '--branch-name',
            'feature/github-pr',
            '--github', // Enable GitHub integration
            '--draft', // Create as draft
          ],
          { from: 'user' }
        );

        // Check if PR file was created with GitHub info
        const prFiles = fs.readdirSync(path.join(testContext.tempDir, 'tasks', 'prs'));
        const newPRFile = prFiles.find((f) => f.includes('github-pr'));
        expect(newPRFile).toBeDefined();

        if (newPRFile) {
          const prPath = path.join(testContext.tempDir, 'tasks', 'prs', newPRFile);
          TestAssertions.assertFileContains(prPath, 'github_pr_number: 123');
          TestAssertions.assertFileContains(
            prPath,
            'github_url: https://github.com/test/repo/pull/123'
          );
        }
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle interactive PR creation', async () => {
      const testContext = getTestContext();

      const inquirer = await import('inquirer');
      vi.mocked(inquirer.default.prompt).mockResolvedValue({
        description: 'Interactive description',
        issue: 'ISS-0001',
        branch: 'feature/interactive',
        target_branch: 'main',
        priority: 'high',
        assignee: 'test-user',
      });

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'pr', 'create', 'Interactive PR'], {
          from: 'user',
        });

        // Check if PR file was created with interactive values
        const prFiles = fs.readdirSync(path.join(testContext.tempDir, 'tasks', 'prs'));
        const newPRFile = prFiles.find((f) => f.includes('interactive-pr'));
        expect(newPRFile).toBeDefined();

        if (newPRFile) {
          const prPath = path.join(testContext.tempDir, 'tasks', 'prs', newPRFile);
          TestAssertions.assertFileContains(prPath, 'description: Interactive description');
          TestAssertions.assertFileContains(prPath, 'branch: feature/interactive');
          TestAssertions.assertFileContains(prPath, 'priority: high');
        }
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('PR List Command', () => {
    it('should list all PRs', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'pr', 'list'], { from: 'user' });

        // Check console output contains PR information
        expect(consoleMock.logs.some((log) => log.includes('Test PR'))).toBe(true);
        expect(consoleMock.logs.some((log) => log.includes('PR-0001'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should filter PRs by status', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'pr', 'list', '--status', 'open'], {
          from: 'user',
        });

        // Should only show open PRs
        expect(consoleMock.logs.some((log) => log.includes('open'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should filter PRs by assignee', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'pr', 'list', '--assignee', 'test-user'], {
          from: 'user',
        });

        // Should only show PRs assigned to test-user
        expect(consoleMock.logs.some((log) => log.includes('test-user'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should show PR review status', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'pr', 'list', '--show-review-status'], {
          from: 'user',
        });

        // Should show review status information
        expect(
          consoleMock.logs.some((log) => log.includes('review') || log.includes('pending'))
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('PR Show Command', () => {
    it('should display PR details', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'pr', 'show', 'PR-0001'], { from: 'user' });

        // Check console output contains PR details
        expect(consoleMock.logs.some((log) => log.includes('Test PR'))).toBe(true);
        expect(consoleMock.logs.some((log) => log.includes('A test pull request'))).toBe(true);
        expect(consoleMock.logs.some((log) => log.includes('feature/test-branch'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle non-existent PR', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'pr', 'show', 'PR-9999'], { from: 'user' });

        // Should show error for non-existent PR
        expect(
          consoleMock.errors.some(
            (error) => error.includes('not found') || error.includes('PR-9999')
          )
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('PR Update Command', () => {
    it('should update PR fields', async () => {
      const testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          [
            'node',
            'test',
            'pr',
            'update',
            'PR-0001',
            '--status',
            'ready-for-review',
            '--priority',
            'high',
            '--assignee',
            'new-reviewer',
            '--review-status',
            'approved',
          ],
          { from: 'user' }
        );

        // Check if PR file was updated
        const prPath = path.join(testContext.tempDir, 'tasks', 'prs', 'PR-0001-test-pr.md');
        TestAssertions.assertFileContains(prPath, 'status: ready-for-review');
        TestAssertions.assertFileContains(prPath, 'priority: high');
        TestAssertions.assertFileContains(prPath, 'assignee: new-reviewer');
        TestAssertions.assertFileContains(prPath, 'review_status: approved');
      } finally {
        consoleMock.restore();
      }
    });

    it('should sync with GitHub when updated', async () => {
      const testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          [
            'node',
            'test',
            'pr',
            'update',
            'PR-0001',
            '--title',
            'Updated PR Title',
            '--sync-github',
          ],
          { from: 'user' }
        );

        // Check if PR file was updated
        const prPath = path.join(testContext.tempDir, 'tasks', 'prs', 'PR-0001-test-pr.md');
        TestAssertions.assertFileContains(prPath, 'title: Updated PR Title');

        // Should log GitHub sync activity
        expect(consoleMock.logs.some((log) => log.includes('sync') || log.includes('GitHub'))).toBe(
          true
        );
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('PR Review Command', () => {
    it('should approve PR', async () => {
      const testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          [
            'node',
            'test',
            'pr',
            'review',
            'PR-0001',
            '--approve',
            '--comment',
            'LGTM! Great work.',
          ],
          { from: 'user' }
        );

        // Check if PR file was updated with review
        const prPath = path.join(testContext.tempDir, 'tasks', 'prs', 'PR-0001-test-pr.md');
        TestAssertions.assertFileContains(prPath, 'review_status: approved');
      } finally {
        consoleMock.restore();
      }
    });

    it('should request changes on PR', async () => {
      const testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          [
            'node',
            'test',
            'pr',
            'review',
            'PR-0001',
            '--request-changes',
            '--comment',
            'Please fix the failing tests.',
          ],
          { from: 'user' }
        );

        // Check if PR file was updated with review request
        const prPath = path.join(testContext.tempDir, 'tasks', 'prs', 'PR-0001-test-pr.md');
        TestAssertions.assertFileContains(prPath, 'review_status: changes-requested');
      } finally {
        consoleMock.restore();
      }
    });

    it('should add comment without approval', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          [
            'node',
            'test',
            'pr',
            'review',
            'PR-0001',
            '--comment',
            'This looks good, just a few minor suggestions.',
          ],
          { from: 'user' }
        );

        // Should log comment activity
        expect(
          consoleMock.logs.some((log) => log.includes('comment') || log.includes('review'))
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('PR Merge Command', () => {
    it('should merge PR successfully', async () => {
      const testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          ['node', 'test', 'pr', 'merge', 'PR-0001', '--merge-method', 'squash', '--delete-branch'],
          { from: 'user' }
        );

        // Check if PR file was updated
        const prPath = path.join(testContext.tempDir, 'tasks', 'prs', 'PR-0001-test-pr.md');
        TestAssertions.assertFileContains(prPath, 'status: merged');
        TestAssertions.assertFileContains(prPath, 'merge_status: merged');
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle merge conflicts', async () => {
      const _testContext = getTestContext();

      // Mock GitHub client to simulate merge conflict
      const { GitHubClient } = await import('../../src/utils/github-client.js');
      const mockInstance = GitHubClient.getInstance();
      vi.mocked(mockInstance.mergePullRequest).mockRejectedValue(
        new Error('Merge conflict detected')
      );

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'pr', 'merge', 'PR-0001'], { from: 'user' });

        // Should handle merge conflict gracefully
        expect(
          consoleMock.errors.some((error) => error.includes('conflict') || error.includes('merge'))
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('PR Close Command', () => {
    it('should close PR', async () => {
      const testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          ['node', 'test', 'pr', 'close', 'PR-0001', '--reason', 'No longer needed'],
          { from: 'user' }
        );

        // Check if PR file was updated
        const prPath = path.join(testContext.tempDir, 'tasks', 'prs', 'PR-0001-test-pr.md');
        TestAssertions.assertFileContains(prPath, 'status: closed');
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('PR Sync Command', () => {
    it('should sync PR with GitHub', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'pr', 'sync', 'PR-0001'], { from: 'user' });

        // Should log sync activity
        expect(consoleMock.logs.some((log) => log.includes('sync') || log.includes('GitHub'))).toBe(
          true
        );
      } finally {
        consoleMock.restore();
      }
    });

    it('should sync all PRs', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'pr', 'sync', '--all'], { from: 'user' });

        // Should log bulk sync activity
        expect(consoleMock.logs.some((log) => log.includes('sync') || log.includes('all'))).toBe(
          true
        );
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('PR Dependencies Command', () => {
    it('should show PR dependencies', async () => {
      const testContext = getTestContext();

      // Create a dependent PR
      const dependentPRContent = `---
title: Dependent PR
description: A PR that depends on another
status: draft
priority: medium
assignee: test-user
created_date: ${new Date().toISOString()}
updated_date: ${new Date().toISOString()}
branch: feature/dependent
target_branch: main
ai_context: []
sync_status: local
related_issues: []
dependencies:
  - PR-0001
review_status: pending
merge_status: pending
---

# PR: Dependent PR
`;

      fs.writeFileSync(
        path.join(testContext.tempDir, 'tasks', 'prs', 'PR-0002-dependent-pr.md'),
        dependentPRContent
      );

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'pr', 'dependencies', 'PR-0002'], {
          from: 'user',
        });

        // Should show dependency information
        expect(
          consoleMock.logs.some((log) => log.includes('PR-0001') || log.includes('dependencies'))
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('PR Batch Operations', () => {
    it('should handle batch operations', async () => {
      const testContext = getTestContext();

      // Create additional PR files for batch operations
      const batchPRContent = `---
title: Batch PR
description: A PR for batch operations
status: open
priority: medium
assignee: test-user
created_date: ${new Date().toISOString()}
updated_date: ${new Date().toISOString()}
branch: feature/batch
target_branch: main
ai_context: []
sync_status: local
related_issues: []
dependencies: []
review_status: pending
merge_status: pending
---

# PR: Batch PR
`;

      fs.writeFileSync(
        path.join(testContext.tempDir, 'tasks', 'prs', 'PR-0003-batch-pr.md'),
        batchPRContent
      );

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          [
            'node',
            'test',
            'pr',
            'batch',
            'update',
            '--status',
            'ready-for-review',
            '--assignee',
            'batch-reviewer',
          ],
          { from: 'user' }
        );

        // Should log batch operation
        expect(
          consoleMock.logs.some((log) => log.includes('batch') || log.includes('updated'))
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing PRs directory', async () => {
      const testContext = getTestContext();

      // Remove prs directory
      fs.rmSync(path.join(testContext.tempDir, 'tasks', 'prs'), { recursive: true, force: true });

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'pr', 'list'], { from: 'user' });

        // Should handle missing directory gracefully
        expect(
          consoleMock.errors.some(
            (error) => error.includes('not found') || error.includes('No PRs found')
          )
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle GitHub API errors', async () => {
      const _testContext = getTestContext();

      // Mock GitHub client to throw API error
      const { GitHubClient } = await import('../../src/utils/github-client.js');
      const mockInstance = GitHubClient.getInstance();
      vi.mocked(mockInstance.createPullRequest).mockRejectedValue(
        new Error('API rate limit exceeded')
      );

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'pr', 'create', 'API Error Test', '--github'], {
          from: 'user',
        });

        // Should handle API error gracefully
        expect(
          consoleMock.errors.some((error) => error.includes('rate limit') || error.includes('API'))
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle invalid branch names', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          [
            'node',
            'test',
            'pr',
            'create',
            'Invalid Branch Test',
            '--branch-name',
            'invalid..branch..name',
          ],
          { from: 'user' }
        );

        // Should handle invalid branch name gracefully
        expect(
          consoleMock.errors.some(
            (error) => error.includes('branch') || error.includes('invalid')
          ) || consoleMock.logs.some((log) => log.includes('created'))
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle network connectivity issues', async () => {
      const _testContext = getTestContext();

      // Mock GitHub client to throw network error
      const { GitHubClient } = await import('../../src/utils/github-client.js');
      const mockInstance = GitHubClient.getInstance();
      vi.mocked(mockInstance.createPullRequest).mockRejectedValue(new Error('ECONNREFUSED'));

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'pr', 'create', 'Network Test', '--github'], {
          from: 'user',
        });

        // Should handle network error gracefully
        expect(
          consoleMock.errors.some(
            (error) => error.includes('network') || error.includes('ECONNREFUSED')
          )
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('PR Workflow Integration', () => {
    it('should integrate with issue workflows', async () => {
      const testContext = getTestContext();

      const program = new Command();
      const prCommand = createPRCommand();
      program.addCommand(prCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          [
            'node',
            'test',
            'pr',
            'create',
            'Workflow PR',
            '--issue',
            'ISS-0001',
            '--auto-close-issue', // Automatically close issue when PR is merged
          ],
          { from: 'user' }
        );

        // Check if PR file was created with workflow integration
        const prFiles = fs.readdirSync(path.join(testContext.tempDir, 'tasks', 'prs'));
        const newPRFile = prFiles.find((f) => f.includes('workflow-pr'));
        expect(newPRFile).toBeDefined();

        if (newPRFile) {
          const prPath = path.join(testContext.tempDir, 'tasks', 'prs', newPRFile);
          TestAssertions.assertFileContains(prPath, 'related_issues:');
          TestAssertions.assertFileContains(prPath, '- ISS-0001');
        }
      } finally {
        consoleMock.restore();
      }
    });
  });
});
