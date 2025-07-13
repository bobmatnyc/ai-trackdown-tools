import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { main } from '../../src/index.js';
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

vi.mock('figlet', () => ({
  default: {
    textSync: vi.fn(() => 'ASCII ART'),
  },
}));

vi.mock('boxen', () => ({
  default: vi.fn((text) => `[BOX: ${text}]`),
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

describe('End-to-End Workflow Integration Tests', () => {
  const getTestContext = setupTestEnvironment();

  // Helper function to run CLI commands
  async function runCLICommand(
    args: string[]
  ): Promise<{ stdout: string; stderr: string; success: boolean }> {
    const consoleMock = CLITestUtils.mockConsole();
    const originalArgv = process.argv;
    const originalExit = process.exit;

    let exitCode = 0;
    process.exit = vi.fn((code = 0) => {
      exitCode = code;
      throw new Error(`Process exit: ${code}`);
    }) as any;

    process.argv = ['node', 'aitrackdown', ...args];

    try {
      await main();
      return {
        stdout: consoleMock.logs.join('\n'),
        stderr: consoleMock.errors.join('\n'),
        success: exitCode === 0,
      };
    } catch (_error) {
      // Handle process.exit calls
      return {
        stdout: consoleMock.logs.join('\n'),
        stderr: consoleMock.errors.join('\n'),
        success: exitCode === 0,
      };
    } finally {
      process.argv = originalArgv;
      process.exit = originalExit;
      consoleMock.restore();
    }
  }

  describe('Complete Project Lifecycle', () => {
    it('should handle complete project setup to completion workflow', async () => {
      const testContext = getTestContext();

      // Step 1: Initialize new project
      let result = await runCLICommand(['init', 'lifecycle-project']);
      expect(result.success).toBe(true);

      const projectDir = path.join(testContext.tempDir, 'lifecycle-project');
      TestAssertions.assertDirectoryExists(projectDir);
      TestAssertions.assertDirectoryExists(path.join(projectDir, 'tasks'));

      // Change to project directory
      process.chdir(projectDir);

      // Step 2: Create epic
      result = await runCLICommand([
        'epic',
        'create',
        'User Authentication System',
        '--description',
        'Complete user authentication with login, signup, and password reset',
        '--priority',
        'high',
        '--assignee',
        'dev-team',
        '--estimated-tokens',
        '2000',
      ]);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('created');

      // Verify epic was created
      const epicsDir = path.join(projectDir, 'tasks', 'epics');
      const epicFiles = fs.readdirSync(epicsDir);
      expect(epicFiles).toHaveLength(1);
      const epicFile = epicFiles[0];
      TestAssertions.assertFileContains(
        path.join(epicsDir, epicFile),
        'User Authentication System'
      );

      // Extract epic ID from filename
      const epicId = epicFile.match(/^(EP-\d+)/)?.[1];
      expect(epicId).toBeDefined();

      // Step 3: Create multiple issues under the epic
      const issueData = [
        {
          title: 'Implement Login Form',
          description: 'Create responsive login form with validation',
        },
        { title: 'Setup Password Reset', description: 'Implement forgot password functionality' },
        { title: 'Add User Registration', description: 'Create user signup process' },
      ];

      const issueIds: string[] = [];
      for (const issue of issueData) {
        result = await runCLICommand([
          'issue',
          'create',
          issue.title,
          '--description',
          issue.description,
          '--epic',
          epicId!,
          '--priority',
          'medium',
          '--assignee',
          'frontend-dev',
        ]);
        expect(result.success).toBe(true);

        // Extract issue ID from created files
        const issuesDir = path.join(projectDir, 'tasks', 'issues');
        const issueFiles = fs.readdirSync(issuesDir);
        const newIssueFile = issueFiles[issueFiles.length - 1];
        const issueId = newIssueFile.match(/^(ISS-\d+)/)?.[1];
        if (issueId) issueIds.push(issueId);
      }

      expect(issueIds).toHaveLength(3);

      // Step 4: Create tasks for each issue
      const taskIds: string[] = [];
      for (let i = 0; i < issueIds.length; i++) {
        const issueId = issueIds[i];
        const taskData = [
          { title: `Frontend Component for ${issueData[i].title}`, time: '4h' },
          { title: `Backend API for ${issueData[i].title}`, time: '3h' },
          { title: `Tests for ${issueData[i].title}`, time: '2h' },
        ];

        for (const task of taskData) {
          result = await runCLICommand([
            'task',
            'create',
            task.title,
            '--description',
            `Implementation task for ${task.title}`,
            '--issue',
            issueId,
            '--time-estimate',
            task.time,
            '--assignee',
            'developer',
          ]);
          expect(result.success).toBe(true);

          // Extract task ID
          const tasksDir = path.join(projectDir, 'tasks', 'tasks');
          const taskFiles = fs.readdirSync(tasksDir);
          const newTaskFile = taskFiles[taskFiles.length - 1];
          const taskId = newTaskFile.match(/^(TSK-\d+)/)?.[1];
          if (taskId) taskIds.push(taskId);
        }
      }

      expect(taskIds).toHaveLength(9); // 3 issues × 3 tasks each

      // Step 5: Check initial status
      result = await runCLICommand(['status', '--verbose']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('User Authentication System');
      expect(result.stdout).toContain('active');

      // Step 6: Work on tasks - complete some tasks
      for (let i = 0; i < 3; i++) {
        result = await runCLICommand([
          'task',
          'complete',
          taskIds[i],
          '--time-spent',
          '3.5h',
          '--notes',
          'Completed successfully',
        ]);
        expect(result.success).toBe(true);
      }

      // Step 7: Update some tasks as in progress
      for (let i = 3; i < 6; i++) {
        result = await runCLICommand([
          'task',
          'update',
          taskIds[i],
          '--status',
          'in-progress',
          '--actual-time',
          '2h',
        ]);
        expect(result.success).toBe(true);
      }

      // Step 8: Complete first issue
      result = await runCLICommand([
        'issue',
        'complete',
        issueIds[0],
        '--actual-tokens',
        '600',
        '--notes',
        'All login functionality implemented and tested',
      ]);
      expect(result.success).toBe(true);

      // Step 9: Create PRs for completed work
      result = await runCLICommand([
        'pr',
        'create',
        'Implement User Login System',
        '--description',
        'Complete implementation of user login with form validation',
        '--issue',
        issueIds[0],
        '--branch-name',
        'feature/user-login',
        '--target-branch',
        'main',
      ]);
      expect(result.success).toBe(true);

      // Step 10: Check progress status
      result = await runCLICommand(['status', '--show-progress', '--show-tokens']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('%');
      expect(result.stdout).toContain('token');

      // Step 11: Complete more issues and tasks
      // Complete remaining tasks for second issue
      for (let i = 3; i < 6; i++) {
        result = await runCLICommand(['task', 'complete', taskIds[i], '--time-spent', '4h']);
        expect(result.success).toBe(true);
      }

      // Complete second issue
      result = await runCLICommand(['issue', 'complete', issueIds[1], '--actual-tokens', '550']);
      expect(result.success).toBe(true);

      // Step 12: Final status check
      result = await runCLICommand(['status', '--full']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('completed');

      // Step 13: Complete the entire epic
      result = await runCLICommand([
        'epic',
        'complete',
        epicId!,
        '--actual-tokens',
        '1800',
        '--notes',
        'User authentication system fully implemented and deployed',
      ]);
      expect(result.success).toBe(true);

      // Final verification
      const epicPath = path.join(epicsDir, epicFile);
      TestAssertions.assertFileContains(epicPath, 'status: completed');
      TestAssertions.assertFileContains(epicPath, 'actual_tokens: 1800');
      TestAssertions.assertFileContains(epicPath, 'completion_percentage: 100');
    });
  });

  describe('Multi-Project Workflow', () => {
    it('should handle multi-project development workflow', async () => {
      const testContext = getTestContext();

      // Create multiple projects
      const projects = ['frontend-app', 'backend-api', 'mobile-app'];
      const projectPaths: string[] = [];

      for (const project of projects) {
        const result = await runCLICommand(['init', project]);
        expect(result.success).toBe(true);
        projectPaths.push(path.join(testContext.tempDir, project));
      }

      // Work with frontend project
      process.chdir(projectPaths[0]);

      let result = await runCLICommand([
        'epic',
        'create',
        'Frontend UI Components',
        '--description',
        'Reusable UI component library',
        '--priority',
        'high',
      ]);
      expect(result.success).toBe(true);

      // Work with backend project using --project-dir
      result = await runCLICommand([
        'epic',
        'create',
        'API Development',
        '--description',
        'RESTful API endpoints',
        '--priority',
        'high',
        '--project-dir',
        projectPaths[1],
      ]);
      expect(result.success).toBe(true);

      // Verify epics were created in correct projects
      TestAssertions.assertDirectoryExists(path.join(projectPaths[0], 'tasks', 'epics'));
      TestAssertions.assertDirectoryExists(path.join(projectPaths[1], 'tasks', 'epics'));

      const frontendEpics = fs.readdirSync(path.join(projectPaths[0], 'tasks', 'epics'));
      const backendEpics = fs.readdirSync(path.join(projectPaths[1], 'tasks', 'epics'));

      expect(frontendEpics).toHaveLength(1);
      expect(backendEpics).toHaveLength(1);

      // Check status of different projects
      result = await runCLICommand(['status']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Frontend UI Components');

      result = await runCLICommand(['status', '--project-dir', projectPaths[1]]);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('API Development');
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should handle workflow with various error conditions', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      // Create epic with valid data
      let result = await runCLICommand([
        'epic',
        'create',
        'Error Recovery Test',
        '--description',
        'Testing error recovery scenarios',
        '--priority',
        'medium',
      ]);
      expect(result.success).toBe(true);

      // Try to create issue with non-existent epic (should auto-create or handle gracefully)
      result = await runCLICommand([
        'issue',
        'create',
        'Test Issue',
        '--description',
        'Issue with non-existent epic',
        '--epic',
        'EP-9999',
      ]);

      // Should either create issue (if auto-create is enabled) or show helpful error
      expect(result.stdout.includes('created') || result.stderr.includes('not found')).toBe(true);

      // Try to update non-existent item
      result = await runCLICommand(['task', 'update', 'TSK-9999', '--status', 'completed']);
      expect(result.stderr).toContain('not found');

      // Try to use invalid file path
      result = await runCLICommand(['status', '--project-dir', '/non/existent/path']);
      expect(result.stderr).toContain('Failed to change');

      // Corrupt a file and test graceful handling
      const corruptedFile = path.join(testContext.tempDir, 'tasks', 'epics', 'corrupted.md');
      fs.writeFileSync(corruptedFile, 'invalid yaml frontmatter');

      result = await runCLICommand(['status']);
      // Should handle corrupted files gracefully and continue
      expect(result.success || result.stderr.includes('parse')).toBe(true);
    });
  });

  describe('GitHub Integration Workflow', () => {
    it('should handle GitHub integration workflow', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      // Create epic and issue
      let result = await runCLICommand([
        'epic',
        'create',
        'GitHub Integration',
        '--description',
        'Testing GitHub integration features',
      ]);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'issue',
        'create',
        'GitHub Sync Issue',
        '--description',
        'Issue for GitHub sync testing',
        '--epic',
        'EP-0001',
      ]);
      expect(result.success).toBe(true);

      // Create PR with GitHub integration
      result = await runCLICommand([
        'pr',
        'create',
        'Test GitHub PR',
        '--description',
        'PR for testing GitHub integration',
        '--issue',
        'ISS-0001',
        '--branch-name',
        'feature/github-test',
        '--github',
      ]);
      expect(result.success).toBe(true);

      // Should have created PR with GitHub info
      const prFiles = fs.readdirSync(path.join(testContext.tempDir, 'tasks', 'prs'));
      expect(prFiles).toHaveLength(1);

      const prPath = path.join(testContext.tempDir, 'tasks', 'prs', prFiles[0]);
      TestAssertions.assertFileContains(prPath, 'github_pr_number: 123');
      TestAssertions.assertFileContains(
        prPath,
        'github_url: https://github.com/test/repo/pull/123'
      );
    });
  });

  describe('Performance and Scale Workflow', () => {
    it('should handle large-scale project workflow efficiently', async () => {
      const testContext = getTestContext();

      // Initialize project
      let result = await runCLICommand(['init', 'large-project']);
      expect(result.success).toBe(true);

      const projectDir = path.join(testContext.tempDir, 'large-project');
      process.chdir(projectDir);

      const startTime = Date.now();

      // Create multiple epics
      for (let i = 0; i < 10; i++) {
        result = await runCLICommand([
          'epic',
          'create',
          `Epic ${i}`,
          '--description',
          `Description for epic ${i}`,
          '--priority',
          i % 2 === 0 ? 'high' : 'medium',
        ]);
        expect(result.success).toBe(true);
      }

      // Create multiple issues for each epic
      for (let epicNum = 0; epicNum < 5; epicNum++) {
        for (let issueNum = 0; issueNum < 5; issueNum++) {
          result = await runCLICommand([
            'issue',
            'create',
            `Issue ${epicNum}-${issueNum}`,
            '--description',
            `Issue ${issueNum} for epic ${epicNum}`,
            '--epic',
            `EP-${String(epicNum + 1).padStart(4, '0')}`,
          ]);
          expect(result.success).toBe(true);
        }
      }

      // Check status with large number of items
      result = await runCLICommand(['status', '--verbose']);
      expect(result.success).toBe(true);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 30 seconds)
      expect(duration).toBeLessThan(30000);

      // Verify correct number of items were created
      const epicsDir = path.join(projectDir, 'tasks', 'epics');
      const issuesDir = path.join(projectDir, 'tasks', 'issues');

      expect(fs.readdirSync(epicsDir)).toHaveLength(10);
      expect(fs.readdirSync(issuesDir)).toHaveLength(25); // 5 epics × 5 issues each
    });
  });

  describe('Collaborative Workflow', () => {
    it('should handle collaborative development workflow', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      // Team lead creates epic
      let result = await runCLICommand([
        'epic',
        'create',
        'Team Collaboration Feature',
        '--description',
        'Multi-user collaboration features',
        '--assignee',
        'team-lead',
        '--priority',
        'high',
      ]);
      expect(result.success).toBe(true);

      // Different team members create issues
      const teamMembers = ['alice', 'bob', 'charlie'];
      const issueIds: string[] = [];

      for (let i = 0; i < teamMembers.length; i++) {
        result = await runCLICommand([
          'issue',
          'create',
          `Feature Component ${i + 1}`,
          '--description',
          `Component implementation by ${teamMembers[i]}`,
          '--epic',
          'EP-0001',
          '--assignee',
          teamMembers[i],
          '--priority',
          'medium',
        ]);
        expect(result.success).toBe(true);

        // Get issue ID
        const issuesDir = path.join(testContext.tempDir, 'tasks', 'issues');
        const issueFiles = fs.readdirSync(issuesDir);
        const newIssueFile = issueFiles[issueFiles.length - 1];
        const issueId = newIssueFile.match(/^(ISS-\d+)/)?.[1];
        if (issueId) issueIds.push(issueId);
      }

      // Team members work on their tasks
      for (let i = 0; i < issueIds.length; i++) {
        const issueId = issueIds[i];
        const assignee = teamMembers[i];

        // Create tasks for each issue
        result = await runCLICommand([
          'task',
          'create',
          `Implementation Task for ${assignee}`,
          '--description',
          `Implementation work by ${assignee}`,
          '--issue',
          issueId,
          '--assignee',
          assignee,
          '--time-estimate',
          '8h',
        ]);
        expect(result.success).toBe(true);

        // Update task progress
        const tasksDir = path.join(testContext.tempDir, 'tasks', 'tasks');
        const taskFiles = fs.readdirSync(tasksDir);
        const newTaskFile = taskFiles[taskFiles.length - 1];
        const taskId = newTaskFile.match(/^(TSK-\d+)/)?.[1];

        if (taskId) {
          result = await runCLICommand([
            'task',
            'update',
            taskId,
            '--status',
            'in-progress',
            '--actual-time',
            '4h',
          ]);
          expect(result.success).toBe(true);
        }
      }

      // Check team progress
      result = await runCLICommand(['status', '--show-progress']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('in-progress');

      // Filter by assignee
      for (const member of teamMembers) {
        result = await runCLICommand(['status', '--assignee', member]);
        expect(result.success).toBe(true);
        expect(result.stdout).toContain(member);
      }

      // Team lead reviews overall progress
      result = await runCLICommand(['epic', 'show', 'EP-0001', '--with-issues']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Team Collaboration Feature');
    });
  });

  describe('Migration and Data Import Workflow', () => {
    it('should handle data migration workflow', async () => {
      const testContext = getTestContext();

      // Create legacy structure
      const legacyDir = path.join(testContext.tempDir, 'legacy-project');
      fs.mkdirSync(legacyDir, { recursive: true });
      fs.mkdirSync(path.join(legacyDir, 'old-tasks'), { recursive: true });

      // Create some legacy files
      fs.writeFileSync(
        path.join(legacyDir, 'old-tasks', 'task1.md'),
        '# Legacy Task 1\nSome content'
      );
      fs.writeFileSync(
        path.join(legacyDir, 'old-tasks', 'task2.md'),
        '# Legacy Task 2\nMore content'
      );

      process.chdir(legacyDir);

      // Initialize new structure
      let result = await runCLICommand(['init', '--force']);
      expect(result.success).toBe(true);

      // Check that both old and new structures exist
      TestAssertions.assertDirectoryExists(path.join(legacyDir, 'old-tasks'));
      TestAssertions.assertDirectoryExists(path.join(legacyDir, 'tasks'));

      // Manually create some items in new structure
      result = await runCLICommand([
        'epic',
        'create',
        'Migrated Epic',
        '--description',
        'Epic created after migration',
      ]);
      expect(result.success).toBe(true);

      // Check status shows new items
      result = await runCLICommand(['status']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Migrated Epic');
    });
  });
});
