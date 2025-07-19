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

describe('Complete Epic/Issue/Task/Comment Workflow with Notes and Reasons', () => {
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

  describe('Complete E2E Workflow Test', () => {
    it('should handle complete workflow: epic -> issue -> task -> comments with state changes and notes', async () => {
      const testContext = getTestContext();

      // Step 1: Initialize project
      let result = await runCLICommand(['init', 'e2e-workflow-test']);
      if (!result.success) {
        console.log('Init failed:', result.stdout, result.stderr);
      }
      expect(result.success).toBe(true);

      const projectDir = path.join(testContext.tempDir, 'e2e-workflow-test');
      process.chdir(projectDir);

      // Step 2: Create an epic
      result = await runCLICommand([
        'epic',
        'create',
        '--title',
        'E2E Test Epic',
        '--description',
        'Epic for comprehensive E2E testing',
        '--labels',
        'e2e-test,epic',
      ]);
      expect(result.success).toBe(true);
      
      // Extract epic ID from the created file
      const epicsDir = path.join(projectDir, 'tasks', 'epics');
      const epicFiles = fs.readdirSync(epicsDir);
      expect(epicFiles.length).toBeGreaterThan(0);
      const epicId = epicFiles[0].match(/^(EP-\d{4})/)?.[1];
      expect(epicId).toBeTruthy();

      // Step 3: Create issues under the epic
      result = await runCLICommand([
        'issue',
        'create',
        '--title',
        'First Issue in E2E Test',
        '--description',
        'Testing issue creation with epic linkage',
        '--epic',
        epicId!,
        '--labels',
        'e2e-test,issue',
        '--priority',
        'high',
      ]);
      expect(result.success).toBe(true);
      
      // Extract issue ID from created file
      const issuesDir = path.join(projectDir, 'tasks', 'issues');
      let issueFiles = fs.readdirSync(issuesDir);
      const firstIssueFile = issueFiles.find(f => f.includes('first-issue-in-e2e-test'));
      expect(firstIssueFile).toBeTruthy();
      const issueId1 = firstIssueFile!.match(/^(ISS-\d{4})/)?.[1];
      expect(issueId1).toBeTruthy();

      // Create second issue
      result = await runCLICommand([
        'issue',
        'create',
        '--title',
        'Second Issue in E2E Test',
        '--description',
        'Another test issue',
        '--epic',
        epicId!,
        '--labels',
        'e2e-test,issue',
        '--priority',
        'medium',
      ]);
      expect(result.success).toBe(true);
      
      issueFiles = fs.readdirSync(issuesDir);
      const secondIssueFile = issueFiles.find(f => f.includes('second-issue-in-e2e-test'));
      expect(secondIssueFile).toBeTruthy();
      const issueId2 = secondIssueFile!.match(/^(ISS-\d{4})/)?.[1];
      expect(issueId2).toBeTruthy();

      // Step 4: Create tasks for the first issue
      result = await runCLICommand([
        'task',
        'create',
        '--issue',
        issueId1!,
        '--title',
        'Implement core functionality',
        '--description',
        'Core implementation task',
        '--priority',
        'high',
      ]);
      expect(result.success).toBe(true);
      
      // Extract task ID from created file
      const issueTaskDir = path.join(issuesDir, issueId1!);
      let taskFiles = fs.readdirSync(issueTaskDir);
      const firstTaskFile = taskFiles.find(f => f.includes('implement-core-functionality'));
      expect(firstTaskFile).toBeTruthy();
      const taskId1 = firstTaskFile!.match(/^(TSK-\d{4})/)?.[1];
      expect(taskId1).toBeTruthy();

      // Create second task
      result = await runCLICommand([
        'task',
        'create',
        '--issue',
        issueId1!,
        '--title',
        'Write unit tests',
        '--description',
        'Testing task',
        '--priority',
        'medium',
      ]);
      expect(result.success).toBe(true);
      
      taskFiles = fs.readdirSync(issueTaskDir);
      const secondTaskFile = taskFiles.find(f => f.includes('write-unit-tests'));
      expect(secondTaskFile).toBeTruthy();
      const taskId2 = secondTaskFile!.match(/^(TSK-\d{4})/)?.[1];
      expect(taskId2).toBeTruthy();

      // Step 5: Add comments to various items
      // Comment on epic
      result = await runCLICommand([
        'comment',
        'add',
        epicId!,
        '--body',
        'Starting work on this epic. High priority for Q1.',
      ]);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Comment added successfully');

      // Comment on issue
      result = await runCLICommand([
        'comment',
        'add',
        issueId1!,
        '--body',
        'This issue needs immediate attention. Dependencies identified.',
      ]);
      expect(result.success).toBe(true);

      // Comment on task
      result = await runCLICommand([
        'comment',
        'add',
        taskId1!,
        '--body',
        'Started implementation. Found some edge cases to handle.',
      ]);
      expect(result.success).toBe(true);

      // Step 6: Update issue status with reason
      result = await runCLICommand([
        'issue',
        'update',
        issueId1!,
        '--status',
        'active',
        '--reason',
        'All requirements gathered and dependencies resolved. Starting development.',
      ]);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Issue updated successfully');

      // Verify reason was appended to issue
      const issuePath = path.join(projectDir, 'tasks', 'issues', firstIssueFile!);
      const issueContent = fs.readFileSync(issuePath, 'utf8');
      expect(issueContent).toContain('## State Change:');
      expect(issueContent).toContain('**Reason**: All requirements gathered and dependencies resolved. Starting development.');
      expect(issueContent).toContain('**New Status**: active');

      // Step 7: Add general notes to issue
      result = await runCLICommand([
        'issue',
        'update',
        issueId1!,
        '--notes',
        'Meeting with stakeholders confirmed the approach. Need to coordinate with backend team for API changes.',
      ]);
      expect(result.success).toBe(true);

      // Verify notes were appended
      const issueContentAfterNotes = fs.readFileSync(issuePath, 'utf8');
      expect(issueContentAfterNotes).toContain('## Note:');
      expect(issueContentAfterNotes).toContain('Meeting with stakeholders confirmed the approach. Need to coordinate with backend team for API changes.');

      // Step 8: Update task status with state change
      result = await runCLICommand([
        'task',
        'update',
        taskId1!,
        '--state',
        'ready_for_qa',
        '--reason',
        'Implementation complete. All unit tests passing. Ready for QA review.',
      ]);
      expect(result.success).toBe(true);

      // Step 9: Complete task with completion notes
      result = await runCLICommand([
        'task',
        'complete',
        taskId1!,
        '--completion-notes',
        'Task completed successfully. Performance benchmarks met all requirements.',
        '--actual-tokens',
        '1500',
      ]);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Task completed successfully');

      // Verify completion notes
      const taskPath = path.join(issueTaskDir, firstTaskFile!);
      const taskContent = fs.readFileSync(taskPath, 'utf8');
      expect(taskContent).toContain('## Completion:');
      expect(taskContent).toContain('**Notes**: Task completed successfully. Performance benchmarks met all requirements.');

      // Step 10: Add more comments and notes
      result = await runCLICommand([
        'comment',
        'add',
        issueId1!,
        '--body',
        'First task completed. Moving to testing phase.',
      ]);
      expect(result.success).toBe(true);

      // Step 11: Complete second task
      result = await runCLICommand([
        'task',
        'complete',
        taskId2!,
        '--completion-notes',
        'All tests written and passing. Code coverage at 95%.',
      ]);
      expect(result.success).toBe(true);

      // Step 12: Complete issue with notes
      result = await runCLICommand([
        'issue',
        'complete',
        issueId1!,
        '--completion-notes',
        'All tasks completed successfully. Ready for deployment.',
        '--comment',
        'Great team effort on this issue!',
      ]);
      expect(result.success).toBe(true);

      // Step 13: Update epic with progress notes
      result = await runCLICommand([
        'epic',
        'update',
        epicId!,
        '--notes',
        'First issue completed. Project on track for Q1 delivery.',
      ]);
      expect(result.success).toBe(true);

      // Step 14: List comments to verify
      result = await runCLICommand(['comment', 'list', epicId!]);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Starting work on this epic');

      result = await runCLICommand(['comment', 'list', issueId1!]);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('This issue needs immediate attention');
      expect(result.stdout).toContain('First task completed');

      // Step 15: Show issue to verify all updates
      result = await runCLICommand(['issue', 'show', issueId1!]);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Status: completed');
      expect(result.stdout).toContain('Progress: 100%');

      // Step 16: Close second issue with reason
      result = await runCLICommand([
        'issue',
        'close',
        issueId2!,
        '--comment',
        'Closing as duplicate. Work consolidated into first issue.',
        '--force',
      ]);
      expect(result.success).toBe(true);

      // Step 17: Complete epic
      result = await runCLICommand([
        'epic',
        'complete',
        epicId!,
        '--notes',
        'Epic successfully delivered. All objectives met within timeline and budget.',
      ]);
      expect(result.success).toBe(true);

      // Final verification: Check backlog shows completed items
      result = await runCLICommand(['backlog-enhanced']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain(epicId!);
      expect(result.stdout).toContain('COMPLETED');
    });

    it('should handle edge cases for notes and reasons', async () => {
      const testContext = getTestContext();

      // Initialize project
      let result = await runCLICommand(['init', 'edge-case-test']);
      expect(result.success).toBe(true);

      const projectDir = path.join(testContext.tempDir, 'edge-case-test');
      process.chdir(projectDir);

      // Create an issue
      result = await runCLICommand([
        'issue',
        'create',
        '--title',
        'Edge Case Test Issue',
        '--description',
        'Testing edge cases for notes and reasons',
      ]);
      expect(result.success).toBe(true);
      const issueIdMatch = result.stdout.match(/Issue ID: (ISS-\d{4})/);
      const issueId = issueIdMatch![1];

      // Test 1: Add only notes (no state change)
      result = await runCLICommand([
        'issue',
        'update',
        issueId!,
        '--notes',
        'Just adding a note without any other changes.',
      ]);
      expect(result.success).toBe(true);

      // Test 2: Try to add reason without state change (should still work)
      result = await runCLICommand([
        'issue',
        'update',
        issueId!,
        '--reason',
        'This reason is provided without a state change.',
      ]);
      expect(result.success).toBe(true);

      // Test 3: Multiple notes in sequence
      result = await runCLICommand([
        'issue',
        'update',
        issueId!,
        '--notes',
        'First note in sequence.',
      ]);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'issue',
        'update',
        issueId!,
        '--notes',
        'Second note in sequence.',
      ]);
      expect(result.success).toBe(true);

      // Test 4: Long notes with special characters
      result = await runCLICommand([
        'issue',
        'update',
        issueId!,
        '--notes',
        'This is a longer note with special characters: @#$%^&*()_+-={}[]|\\:";\'<>?,./~` and newlines should be handled properly.',
      ]);
      expect(result.success).toBe(true);

      // Test 5: State change with both reason and notes
      result = await runCLICommand([
        'issue',
        'update',
        issueId!,
        '--status',
        'active',
        '--reason',
        'Starting work after analysis phase.',
        '--notes',
        'Additional context: Team allocated, resources confirmed.',
      ]);
      expect(result.success).toBe(true);

      // Verify all content was properly appended
      const issuePath = path.join(projectDir, 'tasks', 'issues', issueFile!);
      const issueContent = fs.readFileSync(issuePath, 'utf8');
      
      // Should contain all notes
      expect(issueContent).toContain('Just adding a note without any other changes.');
      expect(issueContent).toContain('First note in sequence.');
      expect(issueContent).toContain('Second note in sequence.');
      expect(issueContent).toContain('special characters: @#$%^&*()');
      
      // Should contain state change with reason
      expect(issueContent).toContain('**Reason**: Starting work after analysis phase.');
      expect(issueContent).toContain('Additional context: Team allocated, resources confirmed.');
    });

    it('should properly format timestamps in notes and reasons', async () => {
      const testContext = getTestContext();

      // Initialize project
      let result = await runCLICommand(['init', 'timestamp-test']);
      expect(result.success).toBe(true);

      const projectDir = path.join(testContext.tempDir, 'timestamp-test');
      process.chdir(projectDir);

      // Create an issue
      result = await runCLICommand([
        'issue',
        'create',
        '--title',
        'Timestamp Test Issue',
        '--description',
        'Testing timestamp formatting',
      ]);
      expect(result.success).toBe(true);
      const issueIdMatch = result.stdout.match(/Issue ID: (ISS-\d{4})/);
      const issueId = issueIdMatch![1];

      // Add a note and capture timestamp
      const beforeTime = new Date().toISOString();
      result = await runCLICommand([
        'issue',
        'update',
        issueId!,
        '--notes',
        'Testing timestamp format.',
      ]);
      expect(result.success).toBe(true);
      const afterTime = new Date().toISOString();

      // Read the issue content
      const issuePath = path.join(projectDir, 'tasks', 'issues', issueFile!);
      const issueContent = fs.readFileSync(issuePath, 'utf8');

      // Extract timestamp from note
      const timestampMatch = issueContent.match(/## Note: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
      expect(timestampMatch).toBeTruthy();
      
      const noteTimestamp = new Date(timestampMatch![1]);
      const beforeDate = new Date(beforeTime);
      const afterDate = new Date(afterTime);
      
      // Verify timestamp is within expected range
      expect(noteTimestamp.getTime()).toBeGreaterThanOrEqual(beforeDate.getTime());
      expect(noteTimestamp.getTime()).toBeLessThanOrEqual(afterDate.getTime());
    });
  });
});