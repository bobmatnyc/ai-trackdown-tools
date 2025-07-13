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

describe('Relationship Management Integration Tests', () => {
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

  describe('Epic-Issue Relationships', () => {
    it('should create and manage epic-issue relationships', async () => {
      const testContext = getTestContext();

      // Initialize project
      let result = await runCLICommand(['init', 'epic-issue-relationships']);
      expect(result.success).toBe(true);

      const projectDir = path.join(testContext.tempDir, 'epic-issue-relationships');
      process.chdir(projectDir);

      // Create parent epic
      result = await runCLICommand([
        'epic',
        'create',
        'User Management Epic',
        '--description',
        'Complete user management system',
        '--priority',
        'high',
        '--estimated-tokens',
        '2000',
      ]);
      expect(result.success).toBe(true);

      const epicId = 'EP-0001';

      // Create multiple issues under the epic
      const issueData = [
        { title: 'User Authentication', tokens: '600' },
        { title: 'User Profile Management', tokens: '500' },
        { title: 'User Permissions', tokens: '400' },
        { title: 'User Activity Tracking', tokens: '300' },
      ];

      const issueIds: string[] = [];
      for (let i = 0; i < issueData.length; i++) {
        const issue = issueData[i];
        result = await runCLICommand([
          'issue',
          'create',
          issue.title,
          '--description',
          `${issue.title} implementation`,
          '--epic',
          epicId,
          '--priority',
          'medium',
          '--estimated-tokens',
          issue.tokens,
        ]);
        expect(result.success).toBe(true);

        issueIds.push(`ISS-${String(i + 1).padStart(4, '0')}`);
      }

      // Verify epic shows all related issues
      result = await runCLICommand(['epic', 'show', epicId, '--with-issues']);
      expect(result.success).toBe(true);
      for (const issue of issueData) {
        expect(result.stdout).toContain(issue.title);
      }

      // Verify issue files contain epic reference
      const issuesDir = path.join(projectDir, 'tasks', 'issues');
      for (const issueId of issueIds) {
        const issueFiles = fs.readdirSync(issuesDir);
        const issueFile = issueFiles.find((f) => f.startsWith(issueId));
        expect(issueFile).toBeDefined();

        const issuePath = path.join(issuesDir, issueFile!);
        TestAssertions.assertFileContains(issuePath, `related_epics: ["${epicId}"]`);
      }

      // Complete some issues and check epic progress
      result = await runCLICommand(['issue', 'complete', issueIds[0], '--actual-tokens', '550']);
      expect(result.success).toBe(true);

      result = await runCLICommand(['issue', 'complete', issueIds[1], '--actual-tokens', '480']);
      expect(result.success).toBe(true);

      // Check epic progress calculation
      result = await runCLICommand(['epic', 'show', epicId, '--show-progress']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('%');

      // List issues by epic
      result = await runCLICommand(['issue', 'list', '--epic', epicId]);
      expect(result.success).toBe(true);
      for (const issueId of issueIds) {
        expect(result.stdout).toContain(issueId);
      }

      // List only completed issues for epic
      result = await runCLICommand(['issue', 'list', '--epic', epicId, '--status', 'completed']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(issueIds[0]);
      expect(result.stdout).toContain(issueIds[1]);
      expect(result.stdout).not.toContain(issueIds[2]);
      expect(result.stdout).not.toContain(issueIds[3]);
    });

    it('should handle orphaned issue relationships', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Create issue with reference to non-existent epic
      let result = await runCLICommand([
        'issue',
        'create',
        'Orphaned Issue',
        '--description',
        'Issue with invalid epic reference',
        '--epic',
        'EP-9999',
        '--priority',
        'low',
      ]);

      // Should either handle gracefully or provide clear error
      expect(result.success || result.stderr.includes('not found')).toBe(true);

      // Delete an epic that has related issues
      result = await runCLICommand(['epic', 'delete', 'EP-0001', '--force']);
      expect(result.success).toBe(true);

      // Check that related issues still exist but relationship is handled
      result = await runCLICommand(['issue', 'list', '--epic', 'EP-0001']);
      // Should either show empty results or handle the orphaned relationship
      expect(result.success).toBe(true);
    });

    it('should handle epic completion with incomplete issues', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Try to complete epic while issues are still pending
      const result = await runCLICommand([
        'epic',
        'complete',
        'EP-0001',
        '--actual-tokens',
        '1800',
      ]);

      // Should either complete successfully or warn about incomplete issues
      expect(result.success).toBe(true);

      if (result.stdout.includes('warning') || result.stderr.includes('incomplete')) {
        // Check that epic completion is handled appropriately
        expect(result.stdout.includes('incomplete') || result.stderr.includes('incomplete')).toBe(
          true
        );
      }
    });
  });

  describe('Issue-Task Relationships', () => {
    it('should create and manage issue-task relationships', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Create additional tasks for an existing issue
      const issueId = 'ISS-0001';
      const taskData = [
        { title: 'Additional Frontend Task', time: '3h' },
        { title: 'Additional Backend Task', time: '4h' },
        { title: 'Additional Testing Task', time: '2h' },
      ];

      const newTaskIds: string[] = [];
      for (const task of taskData) {
        const result = await runCLICommand([
          'task',
          'create',
          task.title,
          '--description',
          `${task.title} for issue ${issueId}`,
          '--issue',
          issueId,
          '--priority',
          'medium',
          '--time-estimate',
          task.time,
        ]);
        expect(result.success).toBe(true);

        // Get the created task ID
        const tasksDir = path.join(projectPath, 'tasks', 'tasks');
        const taskFiles = fs.readdirSync(tasksDir);
        const newTaskFile = taskFiles[taskFiles.length - 1];
        const taskId = newTaskFile.match(/^(TSK-\d+)/)?.[1];
        if (taskId) newTaskIds.push(taskId);
      }

      // Verify issue shows related tasks
      let result = await runCLICommand(['issue', 'show', issueId, '--with-tasks']);
      expect(result.success).toBe(true);
      for (const task of taskData) {
        expect(result.stdout).toContain(task.title);
      }

      // Verify task files contain issue reference
      const tasksDir = path.join(projectPath, 'tasks', 'tasks');
      for (const taskId of newTaskIds) {
        const taskFiles = fs.readdirSync(tasksDir);
        const taskFile = taskFiles.find((f) => f.startsWith(taskId));
        expect(taskFile).toBeDefined();

        const taskPath = path.join(tasksDir, taskFile!);
        TestAssertions.assertFileContains(taskPath, `related_issue: "${issueId}"`);
      }

      // Complete tasks and check issue progress
      result = await runCLICommand(['task', 'complete', newTaskIds[0], '--time-spent', '2.5h']);
      expect(result.success).toBe(true);

      result = await runCLICommand(['task', 'complete', newTaskIds[1], '--time-spent', '4.5h']);
      expect(result.success).toBe(true);

      // Check issue progress
      result = await runCLICommand(['issue', 'show', issueId, '--show-progress']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('%');

      // List tasks by issue
      result = await runCLICommand(['task', 'list', '--issue', issueId]);
      expect(result.success).toBe(true);
      for (const taskId of newTaskIds) {
        expect(result.stdout).toContain(taskId);
      }

      // List only completed tasks for issue
      result = await runCLICommand(['task', 'list', '--issue', issueId, '--status', 'completed']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(newTaskIds[0]);
      expect(result.stdout).toContain(newTaskIds[1]);
      expect(result.stdout).not.toContain(newTaskIds[2]);
    });

    it('should handle task reassignment between issues', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Create a task for one issue
      let result = await runCLICommand([
        'task',
        'create',
        'Reassignable Task',
        '--description',
        'Task that will be reassigned',
        '--issue',
        'ISS-0001',
        '--priority',
        'medium',
        '--time-estimate',
        '3h',
      ]);
      expect(result.success).toBe(true);

      const tasksDir = path.join(projectPath, 'tasks', 'tasks');
      const taskFiles = fs.readdirSync(tasksDir);
      const taskFile = taskFiles[taskFiles.length - 1];
      const taskId = taskFile.match(/^(TSK-\d+)/)?.[1];
      expect(taskId).toBeDefined();

      // Verify initial assignment
      const taskPath = path.join(tasksDir, taskFile);
      TestAssertions.assertFileContains(taskPath, 'related_issue: "ISS-0001"');

      // Reassign task to different issue
      result = await runCLICommand(['task', 'update', taskId!, '--issue', 'ISS-0002']);
      expect(result.success).toBe(true);

      // Verify reassignment
      TestAssertions.assertFileContains(taskPath, 'related_issue: "ISS-0002"');

      // Check that task appears in new issue's task list
      result = await runCLICommand(['task', 'list', '--issue', 'ISS-0002']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(taskId!);

      // Check that task no longer appears in old issue's task list
      result = await runCLICommand(['task', 'list', '--issue', 'ISS-0001']);
      expect(result.success).toBe(true);
      expect(result.stdout).not.toContain(taskId!);
    });
  });

  describe('Issue-PR Relationships', () => {
    it('should create and manage issue-PR relationships', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Create multiple PRs for the same issue
      const issueId = 'ISS-0001';
      const prData = [
        { title: 'Main Implementation PR', branch: 'feature/main-impl' },
        { title: 'Bug Fix PR', branch: 'hotfix/bug-fix' },
        { title: 'Documentation PR', branch: 'docs/api-docs' },
      ];

      const prIds: string[] = [];
      for (const pr of prData) {
        const result = await runCLICommand([
          'pr',
          'create',
          pr.title,
          '--description',
          `${pr.title} for issue ${issueId}`,
          '--issue',
          issueId,
          '--branch-name',
          pr.branch,
          '--target-branch',
          'main',
        ]);
        expect(result.success).toBe(true);

        // Get created PR ID
        const prsDir = path.join(projectPath, 'tasks', 'prs');
        const prFiles = fs.readdirSync(prsDir);
        const newPRFile = prFiles[prFiles.length - 1];
        const prId = newPRFile.match(/^(PR-\d+)/)?.[1];
        if (prId) prIds.push(prId);
      }

      // Verify issue shows related PRs
      let result = await runCLICommand(['issue', 'show', issueId, '--with-prs']);
      expect(result.success).toBe(true);
      for (const pr of prData) {
        expect(result.stdout).toContain(pr.title);
      }

      // Verify PR files contain issue reference
      const prsDir = path.join(projectPath, 'tasks', 'prs');
      for (const prId of prIds) {
        const prFiles = fs.readdirSync(prsDir);
        const prFile = prFiles.find((f) => f.startsWith(prId));
        expect(prFile).toBeDefined();

        const prPath = path.join(prsDir, prFile!);
        TestAssertions.assertFileContains(prPath, `related_issue: "${issueId}"`);
      }

      // Progress PRs through workflow
      result = await runCLICommand(['pr', 'update', prIds[0], '--status', 'ready']);
      expect(result.success).toBe(true);

      result = await runCLICommand(['pr', 'approve', prIds[0]]);
      expect(result.success).toBe(true);

      result = await runCLICommand(['pr', 'merge', prIds[0]]);
      expect(result.success).toBe(true);

      // List PRs by issue
      result = await runCLICommand(['pr', 'list', '--issue', issueId]);
      expect(result.success).toBe(true);
      for (const prId of prIds) {
        expect(result.stdout).toContain(prId);
      }

      // List only merged PRs for issue
      result = await runCLICommand(['pr', 'list', '--issue', issueId, '--status', 'merged']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(prIds[0]);
      expect(result.stdout).not.toContain(prIds[1]);
      expect(result.stdout).not.toContain(prIds[2]);
    });

    it('should handle PR dependencies and blocking relationships', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Create base PR
      let result = await runCLICommand([
        'pr',
        'create',
        'Base Implementation PR',
        '--description',
        'Base implementation that other PRs depend on',
        '--issue',
        'ISS-0001',
        '--branch-name',
        'feature/base-impl',
      ]);
      expect(result.success).toBe(true);

      // Create dependent PR
      result = await runCLICommand([
        'pr',
        'create',
        'Dependent Feature PR',
        '--description',
        'Feature that depends on base implementation',
        '--issue',
        'ISS-0002',
        '--branch-name',
        'feature/dependent-feature',
        '--dependencies',
        'PR-0001',
      ]);
      expect(result.success).toBe(true);

      // Try to merge dependent PR before base PR
      result = await runCLICommand(['pr', 'merge', 'PR-0002']);
      // Should either block or warn about dependency
      expect(result.success || result.stderr.includes('dependency')).toBe(true);

      // Merge base PR first
      result = await runCLICommand(['pr', 'update', 'PR-0001', '--status', 'ready']);
      expect(result.success).toBe(true);

      result = await runCLICommand(['pr', 'approve', 'PR-0001']);
      expect(result.success).toBe(true);

      result = await runCLICommand(['pr', 'merge', 'PR-0001']);
      expect(result.success).toBe(true);

      // Now dependent PR should be ready to merge
      result = await runCLICommand(['pr', 'update', 'PR-0002', '--status', 'ready']);
      expect(result.success).toBe(true);

      result = await runCLICommand(['pr', 'approve', 'PR-0002']);
      expect(result.success).toBe(true);

      result = await runCLICommand(['pr', 'merge', 'PR-0002']);
      expect(result.success).toBe(true);
    });
  });

  describe('Complex Multi-Level Relationships', () => {
    it('should handle epic->issue->task->PR relationship chain', async () => {
      const testContext = getTestContext();

      // Initialize project
      let result = await runCLICommand(['init', 'complex-relationships']);
      expect(result.success).toBe(true);

      const projectDir = path.join(testContext.tempDir, 'complex-relationships');
      process.chdir(projectDir);

      // 1. Create Epic
      result = await runCLICommand([
        'epic',
        'create',
        'Complex Feature Epic',
        '--description',
        'Multi-level relationship testing',
        '--priority',
        'high',
        '--estimated-tokens',
        '3000',
      ]);
      expect(result.success).toBe(true);

      // 2. Create Issue under Epic
      result = await runCLICommand([
        'issue',
        'create',
        'Feature Implementation Issue',
        '--description',
        'Implementation of complex feature',
        '--epic',
        'EP-0001',
        '--priority',
        'high',
        '--estimated-tokens',
        '1000',
      ]);
      expect(result.success).toBe(true);

      // 3. Create Tasks under Issue
      const taskTitles = ['Backend API Task', 'Frontend UI Task', 'Testing Task'];
      for (const title of taskTitles) {
        result = await runCLICommand([
          'task',
          'create',
          title,
          '--description',
          `${title} implementation`,
          '--issue',
          'ISS-0001',
          '--priority',
          'medium',
          '--time-estimate',
          '6h',
        ]);
        expect(result.success).toBe(true);
      }

      // 4. Create PR linked to Issue
      result = await runCLICommand([
        'pr',
        'create',
        'Complex Feature PR',
        '--description',
        'Implementation of complex feature',
        '--issue',
        'ISS-0001',
        '--branch-name',
        'feature/complex-implementation',
      ]);
      expect(result.success).toBe(true);

      // 5. Complete workflow in order
      // Complete tasks
      result = await runCLICommand(['task', 'complete', 'TSK-0001', '--time-spent', '5.5h']);
      expect(result.success).toBe(true);

      result = await runCLICommand(['task', 'complete', 'TSK-0002', '--time-spent', '6.5h']);
      expect(result.success).toBe(true);

      result = await runCLICommand(['task', 'complete', 'TSK-0003', '--time-spent', '4h']);
      expect(result.success).toBe(true);

      // Complete PR
      result = await runCLICommand(['pr', 'update', 'PR-0001', '--status', 'ready']);
      expect(result.success).toBe(true);

      result = await runCLICommand(['pr', 'approve', 'PR-0001']);
      expect(result.success).toBe(true);

      result = await runCLICommand(['pr', 'merge', 'PR-0001']);
      expect(result.success).toBe(true);

      // Complete Issue
      result = await runCLICommand(['issue', 'complete', 'ISS-0001', '--actual-tokens', '950']);
      expect(result.success).toBe(true);

      // Complete Epic
      result = await runCLICommand(['epic', 'complete', 'EP-0001', '--actual-tokens', '2800']);
      expect(result.success).toBe(true);

      // 6. Verify all relationships and statuses
      result = await runCLICommand(['epic', 'show', 'EP-0001', '--with-issues']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('completed');

      result = await runCLICommand(['issue', 'show', 'ISS-0001', '--with-tasks', '--with-prs']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('completed');
      expect(result.stdout).toContain('merged');

      // Check overall project status
      result = await runCLICommand(['status', '--full']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('completed');
    });

    it('should handle multiple epics with cross-cutting issues', async () => {
      const testContext = getTestContext();

      // Initialize project
      let result = await runCLICommand(['init', 'cross-cutting-relationships']);
      expect(result.success).toBe(true);

      const projectDir = path.join(testContext.tempDir, 'cross-cutting-relationships');
      process.chdir(projectDir);

      // Create multiple epics
      result = await runCLICommand([
        'epic',
        'create',
        'Frontend Epic',
        '--description',
        'Frontend development epic',
        '--priority',
        'high',
      ]);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'epic',
        'create',
        'Backend Epic',
        '--description',
        'Backend development epic',
        '--priority',
        'high',
      ]);
      expect(result.success).toBe(true);

      // Create shared infrastructure issue
      result = await runCLICommand([
        'issue',
        'create',
        'Shared Infrastructure Issue',
        '--description',
        'Infrastructure needed by both frontend and backend',
        '--epic',
        'EP-0001', // Assign to frontend epic initially
        '--priority',
        'high',
      ]);
      expect(result.success).toBe(true);

      // Create frontend-specific issue
      result = await runCLICommand([
        'issue',
        'create',
        'UI Components Issue',
        '--description',
        'Frontend UI components',
        '--epic',
        'EP-0001',
        '--priority',
        'medium',
      ]);
      expect(result.success).toBe(true);

      // Create backend-specific issue
      result = await runCLICommand([
        'issue',
        'create',
        'API Endpoints Issue',
        '--description',
        'Backend API endpoints',
        '--epic',
        'EP-0002',
        '--priority',
        'medium',
      ]);
      expect(result.success).toBe(true);

      // Update shared issue to reference both epics (if supported)
      result = await runCLICommand([
        'issue',
        'update',
        'ISS-0001',
        '--epic',
        'EP-0002', // Add reference to backend epic
        '--notes',
        'This issue affects both frontend and backend epics',
      ]);
      // This might succeed or fail depending on implementation
      expect(result.success || result.stderr.includes('multiple')).toBe(true);

      // Verify epic relationships
      result = await runCLICommand(['epic', 'show', 'EP-0001', '--with-issues']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('UI Components Issue');

      result = await runCLICommand(['epic', 'show', 'EP-0002', '--with-issues']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('API Endpoints Issue');
    });
  });

  describe('Relationship Integrity Tests', () => {
    it('should maintain relationship integrity during deletions', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Get initial counts
      let result = await runCLICommand(['status', '--verbose']);
      expect(result.success).toBe(true);

      // Delete a task and verify issue relationships are updated
      result = await runCLICommand(['task', 'delete', 'TSK-0001', '--force']);
      expect(result.success).toBe(true);

      // Check that issue no longer references the deleted task
      result = await runCLICommand(['issue', 'show', 'ISS-0001', '--with-tasks']);
      expect(result.success).toBe(true);
      expect(result.stdout).not.toContain('TSK-0001');

      // Delete an issue and verify epic relationships are updated
      result = await runCLICommand(['issue', 'delete', 'ISS-0003', '--force']);
      expect(result.success).toBe(true);

      // Check that epic no longer references the deleted issue
      result = await runCLICommand(['epic', 'show', 'EP-0001', '--with-issues']);
      expect(result.success).toBe(true);
      expect(result.stdout).not.toContain('ISS-0003');

      // Verify overall integrity
      result = await runCLICommand(['status', '--verbose']);
      expect(result.success).toBe(true);
      // Should not show any broken references or errors
    });

    it('should handle cascade deletion options', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Try to delete epic with related issues (should prompt or handle gracefully)
      let result = await runCLICommand(['epic', 'delete', 'EP-0001']);
      // Should either require --force or --cascade, or provide helpful message
      expect(
        result.success || result.stderr.includes('related') || result.stderr.includes('force')
      ).toBe(true);

      // Force delete epic and check what happens to related issues
      result = await runCLICommand(['epic', 'delete', 'EP-0001', '--force']);
      expect(result.success).toBe(true);

      // Check that issues exist but epic reference is handled
      result = await runCLICommand(['issue', 'list']);
      expect(result.success).toBe(true);

      // Issues should still exist but epic references should be cleaned up
      const issuesDir = path.join(projectPath, 'tasks', 'issues');
      const issueFiles = fs.readdirSync(issuesDir);

      for (const issueFile of issueFiles) {
        const issuePath = path.join(issuesDir, issueFile);
        const content = fs.readFileSync(issuePath, 'utf-8');
        // Should not contain references to deleted epic
        expect(content.includes('EP-0001')).toBe(false);
      }
    });

    it('should validate relationship constraints', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Try to create circular dependencies
      let result = await runCLICommand([
        'issue',
        'create',
        'Dependent Issue',
        '--description',
        'Issue that will create circular dependency',
        '--epic',
        'EP-0001',
        '--dependencies',
        'ISS-0001', // Try to depend on existing issue
      ]);
      expect(result.success).toBe(true);

      // Try to make ISS-0001 depend on the new issue (creating cycle)
      result = await runCLICommand(['issue', 'update', 'ISS-0001', '--dependencies', 'ISS-0002']);
      // Should either prevent cycle or handle gracefully
      expect(result.success || result.stderr.includes('circular')).toBe(true);

      // Try to assign task to non-existent issue
      result = await runCLICommand(['task', 'create', 'Invalid Task', '--issue', 'ISS-9999']);
      // Should handle gracefully
      expect(result.success || result.stderr.includes('not found')).toBe(true);

      // Try to create PR for non-existent issue
      result = await runCLICommand([
        'pr',
        'create',
        'Invalid PR',
        '--issue',
        'ISS-9999',
        '--branch-name',
        'invalid-branch',
      ]);
      // Should handle gracefully
      expect(result.success || result.stderr.includes('not found')).toBe(true);
    });
  });
});
