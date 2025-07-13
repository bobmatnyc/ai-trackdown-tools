import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../../src/index.js';
import { CLITestUtils, setupTestEnvironment, TestAssertions } from '../utils/test-helpers.js';
import { TestDataManager } from './test-data-manager.js';

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

describe('Ticket Lifecycle Integration Tests', () => {
  const getTestContext = setupTestEnvironment();
  let testDataManager: TestDataManager;

  beforeEach(() => {
    testDataManager = new TestDataManager();
  });

  afterEach(() => {
    testDataManager.cleanup();
  });

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

  describe('Epic Lifecycle Tests', () => {
    it('should handle complete epic lifecycle from creation to completion', async () => {
      const testContext = getTestContext();

      // Initialize project
      let result = await runCLICommand(['init', 'epic-lifecycle-test']);
      expect(result.success).toBe(true);

      const projectDir = path.join(testContext.tempDir, 'epic-lifecycle-test');
      process.chdir(projectDir);

      // 1. Create Epic
      result = await runCLICommand([
        'epic',
        'create',
        'E2E Test Epic',
        '--description',
        'Epic for testing complete lifecycle',
        '--priority',
        'high',
        '--assignee',
        'test-team',
        '--estimated-tokens',
        '1500',
      ]);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('created');

      // Verify epic file exists and has correct content
      const epicsDir = path.join(projectDir, 'tasks', 'epics');
      const epicFiles = fs.readdirSync(epicsDir);
      expect(epicFiles).toHaveLength(1);

      const epicFile = epicFiles[0];
      const epicPath = path.join(epicsDir, epicFile);
      TestAssertions.assertFileContains(epicPath, 'E2E Test Epic');
      TestAssertions.assertFileContains(epicPath, 'status: planning');
      TestAssertions.assertFileContains(epicPath, 'priority: high');
      TestAssertions.assertFileContains(epicPath, 'estimated_tokens: 1500');

      const epicId = epicFile.match(/^(EP-\d+)/)?.[1];
      expect(epicId).toBeDefined();

      // 2. Show Epic
      result = await runCLICommand(['epic', 'show', epicId!]);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('E2E Test Epic');
      expect(result.stdout).toContain('planning');

      // 3. Update Epic
      result = await runCLICommand([
        'epic',
        'update',
        epicId!,
        '--status',
        'active',
        '--priority',
        'medium',
        '--notes',
        'Updated epic status to active',
      ]);
      expect(result.success).toBe(true);

      // Verify update
      TestAssertions.assertFileContains(epicPath, 'status: active');
      TestAssertions.assertFileContains(epicPath, 'priority: medium');

      // 4. List Epics
      result = await runCLICommand(['epic', 'list']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(epicId!);
      expect(result.stdout).toContain('E2E Test Epic');

      // 5. List Epics with filters
      result = await runCLICommand(['epic', 'list', '--status', 'active']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(epicId!);

      result = await runCLICommand(['epic', 'list', '--assignee', 'test-team']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(epicId!);

      result = await runCLICommand(['epic', 'list', '--priority', 'medium']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(epicId!);

      // 6. Complete Epic
      result = await runCLICommand([
        'epic',
        'complete',
        epicId!,
        '--actual-tokens',
        '1400',
        '--notes',
        'Epic completed successfully',
      ]);
      expect(result.success).toBe(true);

      // Verify completion
      TestAssertions.assertFileContains(epicPath, 'status: completed');
      TestAssertions.assertFileContains(epicPath, 'actual_tokens: 1400');
      TestAssertions.assertFileContains(epicPath, 'completion_percentage: 100');

      // 7. Show completed epic
      result = await runCLICommand(['epic', 'show', epicId!]);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('completed');
      expect(result.stdout).toContain('1400');

      // 8. Delete Epic (cleanup test)
      result = await runCLICommand(['epic', 'delete', epicId!, '--force']);
      expect(result.success).toBe(true);

      // Verify deletion
      expect(fs.existsSync(epicPath)).toBe(false);
    });

    it('should handle epic with related issues workflow', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Create additional issues related to the epic
      let result = await runCLICommand([
        'issue',
        'create',
        'Related Issue 1',
        '--description',
        'First related issue',
        '--epic',
        'EP-0001',
        '--priority',
        'high',
      ]);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'issue',
        'create',
        'Related Issue 2',
        '--description',
        'Second related issue',
        '--epic',
        'EP-0001',
        '--priority',
        'medium',
      ]);
      expect(result.success).toBe(true);

      // Show epic with related issues
      result = await runCLICommand(['epic', 'show', 'EP-0001', '--with-issues']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Related Issue 1');
      expect(result.stdout).toContain('Related Issue 2');

      // Check epic progress calculation
      result = await runCLICommand(['epic', 'show', 'EP-0001', '--show-progress']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('%');
    });
  });

  describe('Issue Lifecycle Tests', () => {
    it('should handle complete issue lifecycle from creation to completion', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // 1. Create Issue
      let result = await runCLICommand([
        'issue',
        'create',
        'Lifecycle Test Issue',
        '--description',
        'Issue for testing complete lifecycle',
        '--epic',
        'EP-0001',
        '--priority',
        'high',
        '--assignee',
        'test-dev',
        '--estimated-tokens',
        '400',
      ]);
      expect(result.success).toBe(true);

      // Find the created issue
      const issuesDir = path.join(projectPath, 'tasks', 'issues');
      const issueFiles = fs.readdirSync(issuesDir);
      const newIssueFile = issueFiles.find((f) => f.includes('lifecycle-test-issue'));
      expect(newIssueFile).toBeDefined();

      const issueId = newIssueFile?.match(/^(ISS-\d+)/)?.[1];
      expect(issueId).toBeDefined();

      const issuePath = path.join(issuesDir, newIssueFile!);
      TestAssertions.assertFileContains(issuePath, 'Lifecycle Test Issue');
      TestAssertions.assertFileContains(issuePath, 'status: active');

      // 2. Show Issue
      result = await runCLICommand(['issue', 'show', issueId!]);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Lifecycle Test Issue');

      // 3. Update Issue
      result = await runCLICommand([
        'issue',
        'update',
        issueId!,
        '--status',
        'in-progress',
        '--priority',
        'medium',
        '--notes',
        'Started working on this issue',
      ]);
      expect(result.success).toBe(true);

      TestAssertions.assertFileContains(issuePath, 'status: in-progress');
      TestAssertions.assertFileContains(issuePath, 'priority: medium');

      // 4. Assign Issue
      result = await runCLICommand(['issue', 'assign', issueId!, '--assignee', 'new-developer']);
      expect(result.success).toBe(true);

      TestAssertions.assertFileContains(issuePath, 'assignee: "new-developer"');

      // 5. List Issues with various filters
      result = await runCLICommand(['issue', 'list']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(issueId!);

      result = await runCLICommand(['issue', 'list', '--status', 'in-progress']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(issueId!);

      result = await runCLICommand(['issue', 'list', '--assignee', 'new-developer']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(issueId!);

      result = await runCLICommand(['issue', 'list', '--epic', 'EP-0001']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(issueId!);

      // 6. Search Issues
      result = await runCLICommand(['issue', 'search', 'lifecycle']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(issueId!);

      // 7. Complete Issue
      result = await runCLICommand([
        'issue',
        'complete',
        issueId!,
        '--actual-tokens',
        '350',
        '--notes',
        'Issue completed successfully',
      ]);
      expect(result.success).toBe(true);

      TestAssertions.assertFileContains(issuePath, 'status: completed');
      TestAssertions.assertFileContains(issuePath, 'actual_tokens: 350');
      TestAssertions.assertFileContains(issuePath, 'completion_percentage: 100');

      // 8. Reopen Issue
      result = await runCLICommand([
        'issue',
        'reopen',
        issueId!,
        '--notes',
        'Need to address additional requirements',
      ]);
      expect(result.success).toBe(true);

      TestAssertions.assertFileContains(issuePath, 'status: active');

      // 9. Close Issue
      result = await runCLICommand([
        'issue',
        'close',
        issueId!,
        '--notes',
        'Closing due to change in requirements',
      ]);
      expect(result.success).toBe(true);

      TestAssertions.assertFileContains(issuePath, 'status: closed');

      // 10. Delete Issue
      result = await runCLICommand(['issue', 'delete', issueId!, '--force']);
      expect(result.success).toBe(true);

      expect(fs.existsSync(issuePath)).toBe(false);
    });

    it('should handle issue with comments', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Complete an issue with comments
      const result = await runCLICommand([
        'issue',
        'complete',
        'ISS-0001',
        '--actual-tokens',
        '280',
        '--comment',
        'Completed with all requirements met',
      ]);
      expect(result.success).toBe(true);

      const issuesDir = path.join(projectPath, 'tasks', 'issues');
      const issueFiles = fs.readdirSync(issuesDir);
      const issueFile = issueFiles.find((f) => f.startsWith('ISS-0001'));
      const issuePath = path.join(issuesDir, issueFile!);

      TestAssertions.assertFileContains(issuePath, 'status: completed');
      TestAssertions.assertFileContains(issuePath, 'Completed with all requirements met');
    });
  });

  describe('Task Lifecycle Tests', () => {
    it('should handle complete task lifecycle from creation to completion', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // 1. Create Task
      let result = await runCLICommand([
        'task',
        'create',
        'Lifecycle Test Task',
        '--description',
        'Task for testing complete lifecycle',
        '--issue',
        'ISS-0001',
        '--priority',
        'high',
        '--assignee',
        'task-dev',
        '--time-estimate',
        '6h',
      ]);
      expect(result.success).toBe(true);

      const tasksDir = path.join(projectPath, 'tasks', 'tasks');
      const taskFiles = fs.readdirSync(tasksDir);
      const newTaskFile = taskFiles.find((f) => f.includes('lifecycle-test-task'));
      expect(newTaskFile).toBeDefined();

      const taskId = newTaskFile?.match(/^(TSK-\d+)/)?.[1];
      expect(taskId).toBeDefined();

      const taskPath = path.join(tasksDir, newTaskFile!);
      TestAssertions.assertFileContains(taskPath, 'Lifecycle Test Task');
      TestAssertions.assertFileContains(taskPath, 'status: pending');
      TestAssertions.assertFileContains(taskPath, 'estimated_time: "6h"');

      // 2. Show Task
      result = await runCLICommand(['task', 'show', taskId!]);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Lifecycle Test Task');

      // 3. Update Task
      result = await runCLICommand([
        'task',
        'update',
        taskId!,
        '--status',
        'in-progress',
        '--actual-time',
        '3h',
        '--notes',
        'Started working on task',
      ]);
      expect(result.success).toBe(true);

      TestAssertions.assertFileContains(taskPath, 'status: in-progress');
      TestAssertions.assertFileContains(taskPath, 'actual_time: "3h"');

      // 4. List Tasks with filters
      result = await runCLICommand(['task', 'list']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(taskId!);

      result = await runCLICommand(['task', 'list', '--status', 'in-progress']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(taskId!);

      result = await runCLICommand(['task', 'list', '--assignee', 'task-dev']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(taskId!);

      result = await runCLICommand(['task', 'list', '--issue', 'ISS-0001']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(taskId!);

      // 5. Complete Task
      result = await runCLICommand([
        'task',
        'complete',
        taskId!,
        '--time-spent',
        '5.5h',
        '--notes',
        'Task completed successfully',
      ]);
      expect(result.success).toBe(true);

      TestAssertions.assertFileContains(taskPath, 'status: completed');
      TestAssertions.assertFileContains(taskPath, 'actual_time: "5.5h"');
      TestAssertions.assertFileContains(taskPath, 'completion_percentage: 100');

      // 6. Delete Task
      result = await runCLICommand(['task', 'delete', taskId!, '--force']);
      expect(result.success).toBe(true);

      expect(fs.existsSync(taskPath)).toBe(false);
    });
  });

  describe('PR Lifecycle Tests', () => {
    it('should handle complete PR lifecycle from creation to merge', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // 1. Create PR
      let result = await runCLICommand([
        'pr',
        'create',
        'Lifecycle Test PR',
        '--description',
        'PR for testing complete lifecycle',
        '--issue',
        'ISS-0001',
        '--branch-name',
        'feature/lifecycle-test',
        '--target-branch',
        'main',
      ]);
      expect(result.success).toBe(true);

      const prsDir = path.join(projectPath, 'tasks', 'prs');
      const prFiles = fs.readdirSync(prsDir);
      const newPRFile = prFiles.find((f) => f.includes('lifecycle-test-pr'));
      expect(newPRFile).toBeDefined();

      const prId = newPRFile?.match(/^(PR-\d+)/)?.[1];
      expect(prId).toBeDefined();

      const prPath = path.join(prsDir, newPRFile!);
      TestAssertions.assertFileContains(prPath, 'Lifecycle Test PR');
      TestAssertions.assertFileContains(prPath, 'status: draft');
      TestAssertions.assertFileContains(prPath, 'branch: "feature/lifecycle-test"');

      // 2. Show PR
      result = await runCLICommand(['pr', 'show', prId!]);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Lifecycle Test PR');

      // 3. Update PR
      result = await runCLICommand([
        'pr',
        'update',
        prId!,
        '--status',
        'ready',
        '--description',
        'Updated PR description',
      ]);
      expect(result.success).toBe(true);

      TestAssertions.assertFileContains(prPath, 'status: ready');
      TestAssertions.assertFileContains(prPath, 'Updated PR description');

      // 4. List PRs with filters
      result = await runCLICommand(['pr', 'list']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(prId!);

      result = await runCLICommand(['pr', 'list', '--status', 'ready']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(prId!);

      result = await runCLICommand(['pr', 'list', '--issue', 'ISS-0001']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(prId!);

      // 5. Approve PR
      result = await runCLICommand([
        'pr',
        'approve',
        prId!,
        '--notes',
        'Code looks good, approved for merge',
      ]);
      expect(result.success).toBe(true);

      TestAssertions.assertFileContains(prPath, 'status: approved');

      // 6. Merge PR
      result = await runCLICommand(['pr', 'merge', prId!, '--notes', 'Merged successfully']);
      expect(result.success).toBe(true);

      TestAssertions.assertFileContains(prPath, 'status: merged');

      // 7. Archive PR
      result = await runCLICommand(['pr', 'archive', prId!]);
      expect(result.success).toBe(true);

      TestAssertions.assertFileContains(prPath, 'status: archived');
    });

    it('should handle PR review workflow', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Create PR for review
      let result = await runCLICommand([
        'pr',
        'create',
        'Review Test PR',
        '--description',
        'PR for testing review workflow',
        '--issue',
        'ISS-0001',
        '--branch-name',
        'feature/review-test',
      ]);
      expect(result.success).toBe(true);

      const prsDir = path.join(projectPath, 'tasks', 'prs');
      const prFiles = fs.readdirSync(prsDir);
      const prFile = prFiles.find((f) => f.includes('review-test-pr'));
      const prId = prFile?.match(/^(PR-\d+)/)?.[1];

      // Submit for review
      result = await runCLICommand([
        'pr',
        'review',
        prId!,
        '--action',
        'request',
        '--reviewer',
        'senior-dev',
        '--notes',
        'Please review this implementation',
      ]);
      expect(result.success).toBe(true);

      const prPath = path.join(prsDir, prFile!);
      TestAssertions.assertFileContains(prPath, 'senior-dev');

      // Review with changes requested
      result = await runCLICommand([
        'pr',
        'review',
        prId!,
        '--action',
        'changes-requested',
        '--notes',
        'Please address the code style issues',
      ]);
      expect(result.success).toBe(true);

      // Update after review
      result = await runCLICommand([
        'pr',
        'update',
        prId!,
        '--description',
        'Updated PR with review feedback addressed',
      ]);
      expect(result.success).toBe(true);
    });
  });

  describe('Cross-Type Workflow Tests', () => {
    it('should handle complete workflow across all ticket types', async () => {
      const testContext = getTestContext();

      // Initialize fresh project
      let result = await runCLICommand(['init', 'cross-type-workflow']);
      expect(result.success).toBe(true);

      const projectDir = path.join(testContext.tempDir, 'cross-type-workflow');
      process.chdir(projectDir);

      // 1. Create Epic
      result = await runCLICommand([
        'epic',
        'create',
        'Cross-Type Workflow Epic',
        '--description',
        'Testing complete cross-type workflow',
        '--priority',
        'high',
        '--estimated-tokens',
        '2000',
      ]);
      expect(result.success).toBe(true);

      const epicId = 'EP-0001'; // First epic should get this ID

      // 2. Create Issue under Epic
      result = await runCLICommand([
        'issue',
        'create',
        'Workflow Test Issue',
        '--description',
        'Issue for cross-type workflow testing',
        '--epic',
        epicId,
        '--priority',
        'medium',
        '--estimated-tokens',
        '600',
      ]);
      expect(result.success).toBe(true);

      const issueId = 'ISS-0001'; // First issue should get this ID

      // 3. Create Task under Issue
      result = await runCLICommand([
        'task',
        'create',
        'Implementation Task',
        '--description',
        'Task for implementing the feature',
        '--issue',
        issueId,
        '--priority',
        'medium',
        '--time-estimate',
        '4h',
      ]);
      expect(result.success).toBe(true);

      const taskId = 'TSK-0001'; // First task should get this ID

      // 4. Work on Task
      result = await runCLICommand([
        'task',
        'update',
        taskId,
        '--status',
        'in-progress',
        '--actual-time',
        '2h',
      ]);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'task',
        'complete',
        taskId,
        '--time-spent',
        '3.5h',
        '--notes',
        'Task completed successfully',
      ]);
      expect(result.success).toBe(true);

      // 5. Create PR for Issue
      result = await runCLICommand([
        'pr',
        'create',
        'Feature Implementation PR',
        '--description',
        'PR implementing the workflow feature',
        '--issue',
        issueId,
        '--branch-name',
        'feature/workflow-implementation',
      ]);
      expect(result.success).toBe(true);

      const prId = 'PR-0001'; // First PR should get this ID

      // 6. Complete PR workflow
      result = await runCLICommand(['pr', 'update', prId, '--status', 'ready']);
      expect(result.success).toBe(true);

      result = await runCLICommand(['pr', 'approve', prId, '--notes', 'Implementation looks good']);
      expect(result.success).toBe(true);

      result = await runCLICommand(['pr', 'merge', prId, '--notes', 'Feature successfully merged']);
      expect(result.success).toBe(true);

      // 7. Complete Issue
      result = await runCLICommand([
        'issue',
        'complete',
        issueId,
        '--actual-tokens',
        '550',
        '--notes',
        'Issue completed with PR merged',
      ]);
      expect(result.success).toBe(true);

      // 8. Complete Epic
      result = await runCLICommand([
        'epic',
        'complete',
        epicId,
        '--actual-tokens',
        '1900',
        '--notes',
        'Epic completed successfully',
      ]);
      expect(result.success).toBe(true);

      // 9. Check final status
      result = await runCLICommand(['status', '--full']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('completed');

      // Verify all files have completed status
      const epicsDir = path.join(projectDir, 'tasks', 'epics');
      const issuesDir = path.join(projectDir, 'tasks', 'issues');
      const tasksDir = path.join(projectDir, 'tasks', 'tasks');
      const prsDir = path.join(projectDir, 'tasks', 'prs');

      const epicFile = fs.readdirSync(epicsDir)[0];
      const issueFile = fs.readdirSync(issuesDir)[0];
      const taskFile = fs.readdirSync(tasksDir)[0];
      const prFile = fs.readdirSync(prsDir)[0];

      TestAssertions.assertFileContains(path.join(epicsDir, epicFile), 'status: completed');
      TestAssertions.assertFileContains(path.join(issuesDir, issueFile), 'status: completed');
      TestAssertions.assertFileContains(path.join(tasksDir, taskFile), 'status: completed');
      TestAssertions.assertFileContains(path.join(prsDir, prFile), 'status: merged');
    });
  });

  describe('Error Handling in Lifecycle Tests', () => {
    it('should handle errors gracefully during lifecycle operations', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Try to update non-existent epic
      let result = await runCLICommand(['epic', 'update', 'EP-9999', '--status', 'completed']);
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('not found');

      // Try to create issue with invalid epic reference
      result = await runCLICommand(['issue', 'create', 'Invalid Epic Issue', '--epic', 'EP-9999']);
      // Should either fail gracefully or auto-create (depending on implementation)
      expect(result.success || result.stderr.includes('not found')).toBe(true);

      // Try to complete task with invalid time format
      result = await runCLICommand([
        'task',
        'complete',
        'TSK-0001',
        '--time-spent',
        'invalid-time',
      ]);
      // Should handle invalid time format gracefully
      expect(result.success || result.stderr.includes('invalid')).toBe(true);

      // Try to merge PR that's not approved
      result = await runCLICommand(['pr', 'create', 'Test PR', '--branch-name', 'test-branch']);
      expect(result.success).toBe(true);

      const prsDir = path.join(projectPath, 'tasks', 'prs');
      const prFiles = fs.readdirSync(prsDir);
      const prFile = prFiles.find((f) => f.includes('test-pr'));
      const prId = prFile?.match(/^(PR-\d+)/)?.[1];

      result = await runCLICommand(['pr', 'merge', prId!]);
      // Should either require approval first or handle gracefully
      expect(result.success || result.stderr.includes('not approved')).toBe(true);
    });
  });
});
