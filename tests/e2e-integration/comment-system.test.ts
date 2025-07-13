import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../../src/index.js';
import { CLITestUtils, setupTestEnvironment } from '../utils/test-helpers.js';
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

describe('Comment System Integration Tests', () => {
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

  // Helper function to check if file contains comment
  function checkFileContainsComment(filePath: string, commentText: string): boolean {
    if (!fs.existsSync(filePath)) return false;
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.includes(commentText);
  }

  // Helper function to count comments in file
  function countCommentsInFile(filePath: string): number {
    if (!fs.existsSync(filePath)) return 0;
    const content = fs.readFileSync(filePath, 'utf-8');
    const commentMatches = content.match(/### \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g);
    return commentMatches ? commentMatches.length : 0;
  }

  describe('Epic Comment System', () => {
    it('should add comments to epics during lifecycle operations', async () => {
      const testContext = getTestContext();

      // Initialize project
      let result = await runCLICommand(['init', 'epic-comments-test']);
      expect(result.success).toBe(true);

      const projectDir = path.join(testContext.tempDir, 'epic-comments-test');
      process.chdir(projectDir);

      // Create epic
      result = await runCLICommand([
        'epic',
        'create',
        'Comment Test Epic',
        '--description',
        'Epic for testing comment functionality',
        '--priority',
        'high',
      ]);
      expect(result.success).toBe(true);

      const epicsDir = path.join(projectDir, 'tasks', 'epics');
      const epicFiles = fs.readdirSync(epicsDir);
      const epicFile = epicFiles[0];
      const epicPath = path.join(epicsDir, epicFile);
      const epicId = epicFile.match(/^(EP-\d+)/)?.[1];

      // Update epic with comment
      result = await runCLICommand([
        'epic',
        'update',
        epicId!,
        '--status',
        'active',
        '--comment',
        'Epic has been activated and work is starting',
      ]);
      expect(result.success).toBe(true);

      // Check that comment was added to file
      expect(
        checkFileContainsComment(epicPath, 'Epic has been activated and work is starting')
      ).toBe(true);

      // Add another update with comment
      result = await runCLICommand([
        'epic',
        'update',
        epicId!,
        '--priority',
        'medium',
        '--comment',
        'Priority adjusted based on stakeholder feedback',
      ]);
      expect(result.success).toBe(true);

      // Check both comments exist
      expect(
        checkFileContainsComment(epicPath, 'Epic has been activated and work is starting')
      ).toBe(true);
      expect(
        checkFileContainsComment(epicPath, 'Priority adjusted based on stakeholder feedback')
      ).toBe(true);
      expect(countCommentsInFile(epicPath)).toBe(2);

      // Complete epic with comment
      result = await runCLICommand([
        'epic',
        'complete',
        epicId!,
        '--actual-tokens',
        '1500',
        '--comment',
        'Epic completed successfully with all objectives met',
      ]);
      expect(result.success).toBe(true);

      // Check completion comment
      expect(
        checkFileContainsComment(epicPath, 'Epic completed successfully with all objectives met')
      ).toBe(true);
      expect(countCommentsInFile(epicPath)).toBe(3);

      // Show epic should display comments
      result = await runCLICommand(['epic', 'show', epicId!, '--with-comments']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Epic has been activated and work is starting');
      expect(result.stdout).toContain('Priority adjusted based on stakeholder feedback');
      expect(result.stdout).toContain('Epic completed successfully with all objectives met');
    });

    it('should handle epic comments with different authors', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Add comments as different users
      let result = await runCLICommand([
        'epic',
        'update',
        'EP-0001',
        '--comment',
        'Project manager notes: Epic scope is well defined',
        '--author',
        'project-manager',
      ]);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'epic',
        'update',
        'EP-0001',
        '--comment',
        'Tech lead notes: Technical approach approved',
        '--author',
        'tech-lead',
      ]);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'epic',
        'update',
        'EP-0001',
        '--comment',
        'Designer notes: UI mockups are ready for review',
        '--author',
        'ui-designer',
      ]);
      expect(result.success).toBe(true);

      const epicsDir = path.join(projectPath, 'tasks', 'epics');
      const epicFiles = fs.readdirSync(epicsDir);
      const epicFile = epicFiles[0];
      const epicPath = path.join(epicsDir, epicFile);

      // Check that all comments with different authors are present
      expect(checkFileContainsComment(epicPath, 'project-manager')).toBe(true);
      expect(checkFileContainsComment(epicPath, 'tech-lead')).toBe(true);
      expect(checkFileContainsComment(epicPath, 'ui-designer')).toBe(true);
      expect(countCommentsInFile(epicPath)).toBe(4); // Including initial comment from test data
    });
  });

  describe('Issue Comment System', () => {
    it('should add comments to issues during lifecycle operations', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      const issueId = 'ISS-0001';
      const issuesDir = path.join(projectPath, 'tasks', 'issues');
      const issueFiles = fs.readdirSync(issuesDir);
      const issueFile = issueFiles.find((f) => f.startsWith(issueId));
      const issuePath = path.join(issuesDir, issueFile!);

      // Update issue with comment
      let result = await runCLICommand([
        'issue',
        'update',
        issueId,
        '--status',
        'in-progress',
        '--comment',
        'Starting development work on this issue',
      ]);
      expect(result.success).toBe(true);

      expect(checkFileContainsComment(issuePath, 'Starting development work on this issue')).toBe(
        true
      );

      // Assign issue with comment
      result = await runCLICommand([
        'issue',
        'assign',
        issueId,
        '--assignee',
        'senior-developer',
        '--comment',
        'Assigning to senior developer due to complexity',
      ]);
      expect(result.success).toBe(true);

      expect(
        checkFileContainsComment(issuePath, 'Assigning to senior developer due to complexity')
      ).toBe(true);

      // Complete issue with comment
      result = await runCLICommand([
        'issue',
        'complete',
        issueId,
        '--actual-tokens',
        '580',
        '--comment',
        'Issue completed with all acceptance criteria met',
      ]);
      expect(result.success).toBe(true);

      expect(
        checkFileContainsComment(issuePath, 'Issue completed with all acceptance criteria met')
      ).toBe(true);

      // Reopen with comment
      result = await runCLICommand([
        'issue',
        'reopen',
        issueId,
        '--comment',
        'Reopening due to regression found in testing',
      ]);
      expect(result.success).toBe(true);

      expect(
        checkFileContainsComment(issuePath, 'Reopening due to regression found in testing')
      ).toBe(true);

      // Close with comment
      result = await runCLICommand([
        'issue',
        'close',
        issueId,
        '--comment',
        'Closing as regression has been fixed',
      ]);
      expect(result.success).toBe(true);

      expect(checkFileContainsComment(issuePath, 'Closing as regression has been fixed')).toBe(
        true
      );

      // Verify all comments are present
      expect(countCommentsInFile(issuePath)).toBeGreaterThanOrEqual(6); // Including initial comments
    });

    it('should handle issue comments during search operations', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Add searchable comments to multiple issues
      let result = await runCLICommand([
        'issue',
        'update',
        'ISS-0001',
        '--comment',
        'This issue involves critical security considerations',
      ]);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'issue',
        'update',
        'ISS-0002',
        '--comment',
        'Performance optimization is the main focus here',
      ]);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'issue',
        'update',
        'ISS-0003',
        '--comment',
        'Security review required before completion',
      ]);
      expect(result.success).toBe(true);

      // Search for issues containing specific keywords in comments
      result = await runCLICommand(['issue', 'search', 'security']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('ISS-0001');
      expect(result.stdout).toContain('ISS-0003');
      expect(result.stdout).not.toContain('ISS-0002');

      result = await runCLICommand(['issue', 'search', 'performance']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('ISS-0002');
      expect(result.stdout).not.toContain('ISS-0001');
    });
  });

  describe('Task Comment System', () => {
    it('should add comments to tasks during lifecycle operations', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      const taskId = 'TSK-0001';
      const tasksDir = path.join(projectPath, 'tasks', 'tasks');
      const taskFiles = fs.readdirSync(tasksDir);
      const taskFile = taskFiles.find((f) => f.startsWith(taskId));
      const taskPath = path.join(tasksDir, taskFile!);

      // Update task with comment
      let result = await runCLICommand([
        'task',
        'update',
        taskId,
        '--status',
        'in-progress',
        '--actual-time',
        '2h',
        '--comment',
        'Made good progress on the UI implementation',
      ]);
      expect(result.success).toBe(true);

      expect(
        checkFileContainsComment(taskPath, 'Made good progress on the UI implementation')
      ).toBe(true);

      // Another update with comment
      result = await runCLICommand([
        'task',
        'update',
        taskId,
        '--actual-time',
        '3.5h',
        '--comment',
        'Ran into some complexity with responsive design',
      ]);
      expect(result.success).toBe(true);

      expect(
        checkFileContainsComment(taskPath, 'Ran into some complexity with responsive design')
      ).toBe(true);

      // Complete task with comment
      result = await runCLICommand([
        'task',
        'complete',
        taskId,
        '--time-spent',
        '4h',
        '--comment',
        'Task completed - responsive design issues resolved',
      ]);
      expect(result.success).toBe(true);

      expect(
        checkFileContainsComment(taskPath, 'Task completed - responsive design issues resolved')
      ).toBe(true);

      // Show task with comments
      result = await runCLICommand(['task', 'show', taskId, '--with-comments']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Made good progress on the UI implementation');
      expect(result.stdout).toContain('Ran into some complexity with responsive design');
      expect(result.stdout).toContain('Task completed - responsive design issues resolved');
    });

    it('should track time-related comments for tasks', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Create task with time tracking
      let result = await runCLICommand([
        'task',
        'create',
        'Time Tracking Task',
        '--description',
        'Task for testing time tracking comments',
        '--issue',
        'ISS-0001',
        '--time-estimate',
        '6h',
      ]);
      expect(result.success).toBe(true);

      const tasksDir = path.join(projectPath, 'tasks', 'tasks');
      const taskFiles = fs.readdirSync(tasksDir);
      const newTaskFile = taskFiles[taskFiles.length - 1];
      const taskId = newTaskFile.match(/^(TSK-\d+)/)?.[1];
      const taskPath = path.join(tasksDir, newTaskFile);

      // Track time with comments
      result = await runCLICommand([
        'task',
        'update',
        taskId!,
        '--actual-time',
        '2h',
        '--comment',
        'First 2 hours: Setup and initial research',
      ]);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'task',
        'update',
        taskId!,
        '--actual-time',
        '4h',
        '--comment',
        'Next 2 hours: Core implementation work',
      ]);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'task',
        'update',
        taskId!,
        '--actual-time',
        '5.5h',
        '--comment',
        'Additional 1.5 hours: Testing and debugging',
      ]);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'task',
        'complete',
        taskId!,
        '--time-spent',
        '6.5h',
        '--comment',
        'Final hour: Documentation and cleanup - task complete',
      ]);
      expect(result.success).toBe(true);

      // Verify all time-related comments
      expect(checkFileContainsComment(taskPath, 'First 2 hours: Setup and initial research')).toBe(
        true
      );
      expect(checkFileContainsComment(taskPath, 'Next 2 hours: Core implementation work')).toBe(
        true
      );
      expect(
        checkFileContainsComment(taskPath, 'Additional 1.5 hours: Testing and debugging')
      ).toBe(true);
      expect(
        checkFileContainsComment(taskPath, 'Final hour: Documentation and cleanup - task complete')
      ).toBe(true);

      // Check time progression in comments
      result = await runCLICommand(['task', 'show', taskId!, '--with-comments']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('6.5h');
    });
  });

  describe('PR Comment System', () => {
    it('should add comments to PRs during review workflow', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      const prId = 'PR-0001';
      const prsDir = path.join(projectPath, 'tasks', 'prs');
      const prFiles = fs.readdirSync(prsDir);
      const prFile = prFiles.find((f) => f.startsWith(prId));
      const prPath = path.join(prsDir, prFile!);

      // Update PR with comment
      let result = await runCLICommand([
        'pr',
        'update',
        prId,
        '--status',
        'ready',
        '--comment',
        'PR is ready for review - all tests passing',
      ]);
      expect(result.success).toBe(true);

      expect(checkFileContainsComment(prPath, 'PR is ready for review - all tests passing')).toBe(
        true
      );

      // Review PR with comments
      result = await runCLICommand([
        'pr',
        'review',
        prId,
        '--action',
        'changes-requested',
        '--reviewer',
        'senior-dev',
        '--comment',
        'Please address the code style issues in login.js',
      ]);
      expect(result.success).toBe(true);

      expect(
        checkFileContainsComment(prPath, 'Please address the code style issues in login.js')
      ).toBe(true);

      // Update after review
      result = await runCLICommand([
        'pr',
        'update',
        prId,
        '--comment',
        'Code style issues have been addressed',
      ]);
      expect(result.success).toBe(true);

      expect(checkFileContainsComment(prPath, 'Code style issues have been addressed')).toBe(true);

      // Approve PR
      result = await runCLICommand([
        'pr',
        'approve',
        prId,
        '--reviewer',
        'senior-dev',
        '--comment',
        'Code looks good now, approved for merge',
      ]);
      expect(result.success).toBe(true);

      expect(checkFileContainsComment(prPath, 'Code looks good now, approved for merge')).toBe(
        true
      );

      // Merge PR
      result = await runCLICommand([
        'pr',
        'merge',
        prId,
        '--comment',
        'Merged successfully into main branch',
      ]);
      expect(result.success).toBe(true);

      expect(checkFileContainsComment(prPath, 'Merged successfully into main branch')).toBe(true);

      // Show PR with comments
      result = await runCLICommand(['pr', 'show', prId, '--with-comments']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('PR is ready for review - all tests passing');
      expect(result.stdout).toContain('Please address the code style issues in login.js');
      expect(result.stdout).toContain('Code style issues have been addressed');
      expect(result.stdout).toContain('Code looks good now, approved for merge');
      expect(result.stdout).toContain('Merged successfully into main branch');
    });

    it('should handle PR comments during dependency resolution', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Create base PR
      let result = await runCLICommand([
        'pr',
        'create',
        'Base Feature PR',
        '--description',
        'Base feature implementation',
        '--issue',
        'ISS-0001',
        '--branch-name',
        'feature/base',
      ]);
      expect(result.success).toBe(true);

      // Create dependent PR
      result = await runCLICommand([
        'pr',
        'create',
        'Dependent Feature PR',
        '--description',
        'Feature depending on base',
        '--branch-name',
        'feature/dependent',
        '--dependencies',
        'PR-0001',
      ]);
      expect(result.success).toBe(true);

      const prsDir = path.join(projectPath, 'tasks', 'prs');
      const prFiles = fs.readdirSync(prsDir);
      const dependentPrFile = prFiles.find((f) => f.includes('dependent-feature-pr'));
      const dependentPrPath = path.join(prsDir, dependentPrFile!);

      // Try to merge dependent PR before base
      result = await runCLICommand([
        'pr',
        'merge',
        'PR-0002',
        '--comment',
        'Attempting to merge dependent PR',
      ]);

      // Should handle dependency appropriately
      if (!result.success) {
        expect(result.stderr).toContain('dependency');
      }

      // Comment on dependency status
      result = await runCLICommand([
        'pr',
        'update',
        'PR-0002',
        '--comment',
        'Waiting for base PR to be merged before this can proceed',
      ]);
      expect(result.success).toBe(true);

      expect(
        checkFileContainsComment(
          dependentPrPath,
          'Waiting for base PR to be merged before this can proceed'
        )
      ).toBe(true);

      // Merge base PR
      result = await runCLICommand(['pr', 'update', 'PR-0001', '--status', 'ready']);
      expect(result.success).toBe(true);

      result = await runCLICommand(['pr', 'approve', 'PR-0001']);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'pr',
        'merge',
        'PR-0001',
        '--comment',
        'Base PR merged - dependency resolved',
      ]);
      expect(result.success).toBe(true);

      // Now update dependent PR
      result = await runCLICommand([
        'pr',
        'update',
        'PR-0002',
        '--comment',
        'Base PR is now merged, ready to proceed with this PR',
      ]);
      expect(result.success).toBe(true);

      expect(
        checkFileContainsComment(
          dependentPrPath,
          'Base PR is now merged, ready to proceed with this PR'
        )
      ).toBe(true);
    });
  });

  describe('Cross-Type Comment Integration', () => {
    it('should handle comments across related ticket types', async () => {
      const testContext = getTestContext();

      // Initialize project
      let result = await runCLICommand(['init', 'cross-type-comments']);
      expect(result.success).toBe(true);

      const projectDir = path.join(testContext.tempDir, 'cross-type-comments');
      process.chdir(projectDir);

      // Create epic with comment
      result = await runCLICommand([
        'epic',
        'create',
        'Integration Comments Epic',
        '--description',
        'Testing cross-type comment integration',
        '--comment',
        'Epic created for comprehensive comment testing',
      ]);
      expect(result.success).toBe(true);

      // Create issue with reference to epic comment
      result = await runCLICommand([
        'issue',
        'create',
        'Related Issue',
        '--description',
        'Issue related to epic',
        '--epic',
        'EP-0001',
        '--comment',
        'Issue created as part of Epic EP-0001 scope',
      ]);
      expect(result.success).toBe(true);

      // Create task with reference to issue
      result = await runCLICommand([
        'task',
        'create',
        'Implementation Task',
        '--description',
        'Task for issue implementation',
        '--issue',
        'ISS-0001',
        '--comment',
        'Task created to implement ISS-0001 requirements',
      ]);
      expect(result.success).toBe(true);

      // Create PR with reference to issue and task
      result = await runCLICommand([
        'pr',
        'create',
        'Implementation PR',
        '--description',
        'PR implementing the feature',
        '--issue',
        'ISS-0001',
        '--branch-name',
        'feature/implementation',
        '--comment',
        'PR created for ISS-0001, implementing TSK-0001',
      ]);
      expect(result.success).toBe(true);

      // Complete task with reference to PR
      result = await runCLICommand([
        'task',
        'complete',
        'TSK-0001',
        '--time-spent',
        '4h',
        '--comment',
        'Task completed, code changes are in PR-0001',
      ]);
      expect(result.success).toBe(true);

      // Merge PR with reference to task completion
      result = await runCLICommand(['pr', 'update', 'PR-0001', '--status', 'ready']);
      expect(result.success).toBe(true);

      result = await runCLICommand(['pr', 'approve', 'PR-0001']);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'pr',
        'merge',
        'PR-0001',
        '--comment',
        'PR merged - TSK-0001 implementation is now in main branch',
      ]);
      expect(result.success).toBe(true);

      // Complete issue with reference to PR merge
      result = await runCLICommand([
        'issue',
        'complete',
        'ISS-0001',
        '--actual-tokens',
        '400',
        '--comment',
        'Issue completed with PR-0001 merged and TSK-0001 finished',
      ]);
      expect(result.success).toBe(true);

      // Complete epic with reference to issue completion
      result = await runCLICommand([
        'epic',
        'complete',
        'EP-0001',
        '--actual-tokens',
        '800',
        '--comment',
        'Epic completed - all related work (ISS-0001, TSK-0001, PR-0001) is done',
      ]);
      expect(result.success).toBe(true);

      // Verify all comments are properly stored
      const epicsDir = path.join(projectDir, 'tasks', 'epics');
      const issuesDir = path.join(projectDir, 'tasks', 'issues');
      const tasksDir = path.join(projectDir, 'tasks', 'tasks');
      const prsDir = path.join(projectDir, 'tasks', 'prs');

      const epicFile = fs.readdirSync(epicsDir)[0];
      const issueFile = fs.readdirSync(issuesDir)[0];
      const taskFile = fs.readdirSync(tasksDir)[0];
      const prFile = fs.readdirSync(prsDir)[0];

      const epicPath = path.join(epicsDir, epicFile);
      const issuePath = path.join(issuesDir, issueFile);
      const taskPath = path.join(tasksDir, taskFile);
      const prPath = path.join(prsDir, prFile);

      expect(
        checkFileContainsComment(epicPath, 'Epic created for comprehensive comment testing')
      ).toBe(true);
      expect(
        checkFileContainsComment(
          epicPath,
          'Epic completed - all related work (ISS-0001, TSK-0001, PR-0001) is done'
        )
      ).toBe(true);

      expect(
        checkFileContainsComment(issuePath, 'Issue created as part of Epic EP-0001 scope')
      ).toBe(true);
      expect(
        checkFileContainsComment(
          issuePath,
          'Issue completed with PR-0001 merged and TSK-0001 finished'
        )
      ).toBe(true);

      expect(
        checkFileContainsComment(taskPath, 'Task created to implement ISS-0001 requirements')
      ).toBe(true);
      expect(
        checkFileContainsComment(taskPath, 'Task completed, code changes are in PR-0001')
      ).toBe(true);

      expect(
        checkFileContainsComment(prPath, 'PR created for ISS-0001, implementing TSK-0001')
      ).toBe(true);
      expect(
        checkFileContainsComment(
          prPath,
          'PR merged - TSK-0001 implementation is now in main branch'
        )
      ).toBe(true);
    });

    it('should handle comment timestamps and author tracking', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Add comments with different authors and verify timestamps
      const startTime = new Date();

      let result = await runCLICommand([
        'epic',
        'update',
        'EP-0001',
        '--comment',
        'First comment by project manager',
        '--author',
        'project-manager',
      ]);
      expect(result.success).toBe(true);

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 100));

      result = await runCLICommand([
        'epic',
        'update',
        'EP-0001',
        '--comment',
        'Second comment by developer',
        '--author',
        'developer',
      ]);
      expect(result.success).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 100));

      result = await runCLICommand([
        'epic',
        'update',
        'EP-0001',
        '--comment',
        'Third comment by tester',
        '--author',
        'tester',
      ]);
      expect(result.success).toBe(true);

      const endTime = new Date();

      // Verify comments have proper timestamps and authors
      const epicsDir = path.join(projectPath, 'tasks', 'epics');
      const epicFiles = fs.readdirSync(epicsDir);
      const epicPath = path.join(epicsDir, epicFiles[0]);
      const content = fs.readFileSync(epicPath, 'utf-8');

      // Check that comments contain author information
      expect(content).toContain('project-manager');
      expect(content).toContain('developer');
      expect(content).toContain('tester');

      // Check that comments contain timestamps (ISO format)
      const timestampRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g;
      const timestamps = content.match(timestampRegex);
      expect(timestamps).toBeDefined();
      expect(timestamps?.length).toBeGreaterThanOrEqual(3);

      // Verify timestamps are within expected range
      for (const timestamp of timestamps!) {
        const commentTime = new Date(timestamp);
        expect(commentTime.getTime()).toBeGreaterThanOrEqual(startTime.getTime() - 1000);
        expect(commentTime.getTime()).toBeLessThanOrEqual(endTime.getTime() + 1000);
      }
    });
  });

  describe('Comment System Edge Cases', () => {
    it('should handle comments with special characters and formatting', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Test comments with special characters
      const specialComment =
        'Comment with special chars: @#$%^&*()_+{}|:"<>?[]\\;\',./ and emojis 🚀 💯';
      let result = await runCLICommand([
        'issue',
        'update',
        'ISS-0001',
        '--comment',
        specialComment,
      ]);
      expect(result.success).toBe(true);

      // Test multiline comment
      const multilineComment =
        'This is a multiline comment\nLine 2 of the comment\nLine 3 with more details';
      result = await runCLICommand(['issue', 'update', 'ISS-0001', '--comment', multilineComment]);
      expect(result.success).toBe(true);

      // Test very long comment
      const longComment = 'A'.repeat(1000);
      result = await runCLICommand(['issue', 'update', 'ISS-0001', '--comment', longComment]);
      expect(result.success).toBe(true);

      // Verify all comments are properly stored
      const issuesDir = path.join(projectPath, 'tasks', 'issues');
      const issueFiles = fs.readdirSync(issuesDir);
      const issuePath = path.join(issuesDir, issueFiles[0]);

      expect(checkFileContainsComment(issuePath, specialComment)).toBe(true);
      expect(checkFileContainsComment(issuePath, 'This is a multiline comment')).toBe(true);
      expect(checkFileContainsComment(issuePath, longComment)).toBe(true);
    });

    it('should handle concurrent comment additions', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Simulate concurrent comment additions
      const commentPromises = [];
      for (let i = 1; i <= 5; i++) {
        const promise = runCLICommand([
          'epic',
          'update',
          'EP-0001',
          '--comment',
          `Concurrent comment ${i}`,
          '--author',
          `user-${i}`,
        ]);
        commentPromises.push(promise);
      }

      // Wait for all comments to be added
      const results = await Promise.all(commentPromises);

      // All should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
      }

      // Verify all comments are present
      const epicsDir = path.join(projectPath, 'tasks', 'epics');
      const epicFiles = fs.readdirSync(epicsDir);
      const epicPath = path.join(epicsDir, epicFiles[0]);

      for (let i = 1; i <= 5; i++) {
        expect(checkFileContainsComment(epicPath, `Concurrent comment ${i}`)).toBe(true);
        expect(checkFileContainsComment(epicPath, `user-${i}`)).toBe(true);
      }

      // Should have at least 5 new comments plus any existing ones
      expect(countCommentsInFile(epicPath)).toBeGreaterThanOrEqual(5);
    });

    it('should handle comments when files are missing or corrupted', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Delete an issue file
      const issuesDir = path.join(projectPath, 'tasks', 'issues');
      const issueFiles = fs.readdirSync(issuesDir);
      const issueFile = issueFiles[0];
      const issuePath = path.join(issuesDir, issueFile);
      fs.unlinkSync(issuePath);

      // Try to add comment to deleted issue
      let result = await runCLICommand([
        'issue',
        'update',
        'ISS-0001',
        '--comment',
        'Comment for deleted issue',
      ]);

      // Should handle gracefully
      expect(result.success || result.stderr.includes('not found')).toBe(true);

      // Recreate issue and corrupt the YAML frontmatter
      fs.writeFileSync(issuePath, 'corrupted yaml content\nwithout proper frontmatter');

      // Try to add comment to corrupted issue
      result = await runCLICommand([
        'issue',
        'update',
        'ISS-0001',
        '--comment',
        'Comment for corrupted issue',
      ]);

      // Should handle gracefully
      expect(result.success || result.stderr.includes('parse')).toBe(true);
    });
  });
});
