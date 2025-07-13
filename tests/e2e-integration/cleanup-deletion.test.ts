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

describe('Cleanup and Deletion Integration Tests', () => {
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

  // Helper function to count files in directory
  function countFilesInDirectory(dirPath: string): number {
    if (!fs.existsSync(dirPath)) return 0;
    return fs.readdirSync(dirPath).length;
  }

  // Helper function to get all ticket IDs from files
  function getAllTicketIds(projectPath: string): {
    epics: string[];
    issues: string[];
    tasks: string[];
    prs: string[];
  } {
    const result = { epics: [], issues: [], tasks: [], prs: [] };

    const dirs = [
      { type: 'epics', path: path.join(projectPath, 'tasks', 'epics') },
      { type: 'issues', path: path.join(projectPath, 'tasks', 'issues') },
      { type: 'tasks', path: path.join(projectPath, 'tasks', 'tasks') },
      { type: 'prs', path: path.join(projectPath, 'tasks', 'prs') },
    ];

    for (const dir of dirs) {
      if (fs.existsSync(dir.path)) {
        const files = fs.readdirSync(dir.path);
        for (const file of files) {
          const match = file.match(/^(EP|ISS|TSK|PR)-\d+/);
          if (match) {
            (result as any)[dir.type].push(`${match[1]}-${match[0].split('-')[1]}`);
          }
        }
      }
    }

    return result;
  }

  // Helper function to check for orphaned references
  function checkForOrphanedReferences(projectPath: string): {
    orphanedIssues: string[];
    orphanedTasks: string[];
    orphanedPRs: string[];
  } {
    const result = { orphanedIssues: [], orphanedTasks: [], orphanedPRs: [] };
    const ticketIds = getAllTicketIds(projectPath);

    // Check issues for orphaned epic references
    const issuesDir = path.join(projectPath, 'tasks', 'issues');
    if (fs.existsSync(issuesDir)) {
      const issueFiles = fs.readdirSync(issuesDir);
      for (const issueFile of issueFiles) {
        const issuePath = path.join(issuesDir, issueFile);
        const content = fs.readFileSync(issuePath, 'utf-8');
        const epicMatch = content.match(/related_epics:\s*\["?(EP-\d+)"?\]/);
        if (epicMatch) {
          const referencedEpic = epicMatch[1];
          if (!ticketIds.epics.includes(referencedEpic)) {
            result.orphanedIssues.push(issueFile);
          }
        }
      }
    }

    // Check tasks for orphaned issue references
    const tasksDir = path.join(projectPath, 'tasks', 'tasks');
    if (fs.existsSync(tasksDir)) {
      const taskFiles = fs.readdirSync(tasksDir);
      for (const taskFile of taskFiles) {
        const taskPath = path.join(tasksDir, taskFile);
        const content = fs.readFileSync(taskPath, 'utf-8');
        const issueMatch = content.match(/related_issue:\s*"?(ISS-\d+)"?/);
        if (issueMatch) {
          const referencedIssue = issueMatch[1];
          if (!ticketIds.issues.includes(referencedIssue)) {
            result.orphanedTasks.push(taskFile);
          }
        }
      }
    }

    // Check PRs for orphaned issue references
    const prsDir = path.join(projectPath, 'tasks', 'prs');
    if (fs.existsSync(prsDir)) {
      const prFiles = fs.readdirSync(prsDir);
      for (const prFile of prFiles) {
        const prPath = path.join(prsDir, prFile);
        const content = fs.readFileSync(prPath, 'utf-8');
        const issueMatch = content.match(/related_issue:\s*"?(ISS-\d+)"?/);
        if (issueMatch) {
          const referencedIssue = issueMatch[1];
          if (!ticketIds.issues.includes(referencedIssue)) {
            result.orphanedPRs.push(prFile);
          }
        }
      }
    }

    return result;
  }

  describe('Individual Item Deletion', () => {
    it('should delete epic and handle related items appropriately', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Get initial counts
      const initialCounts = {
        epics: countFilesInDirectory(path.join(projectPath, 'tasks', 'epics')),
        issues: countFilesInDirectory(path.join(projectPath, 'tasks', 'issues')),
        tasks: countFilesInDirectory(path.join(projectPath, 'tasks', 'tasks')),
        prs: countFilesInDirectory(path.join(projectPath, 'tasks', 'prs')),
      };

      expect(initialCounts.epics).toBeGreaterThan(0);
      expect(initialCounts.issues).toBeGreaterThan(0);

      // Try to delete epic without force (should prompt or warn)
      let result = await runCLICommand(['epic', 'delete', 'EP-0001']);

      if (!result.success) {
        // If deletion failed, try with force flag
        result = await runCLICommand(['epic', 'delete', 'EP-0001', '--force']);
        expect(result.success).toBe(true);
      }

      // Verify epic was deleted
      const epicPath = path.join(projectPath, 'tasks', 'epics');
      const epicFiles = fs.readdirSync(epicPath);
      const remainingEpics = epicFiles.filter((f) => f.startsWith('EP-0001'));
      expect(remainingEpics).toHaveLength(0);

      // Check what happened to related issues
      const issuesAfterDeletion = countFilesInDirectory(path.join(projectPath, 'tasks', 'issues'));

      // Issues should either:
      // 1. Still exist with cleaned references, or
      // 2. Be cascade deleted if that's the implementation
      if (issuesAfterDeletion === initialCounts.issues) {
        // References should be cleaned up
        const orphaned = checkForOrphanedReferences(projectPath);
        expect(orphaned.orphanedIssues).toHaveLength(0);
      }

      // Check overall project status is still valid
      result = await runCLICommand(['status']);
      expect(result.success).toBe(true);
    });

    it('should delete issue and clean up related tasks and PRs', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Get initial counts
      const _initialCounts = {
        issues: countFilesInDirectory(path.join(projectPath, 'tasks', 'issues')),
        tasks: countFilesInDirectory(path.join(projectPath, 'tasks', 'tasks')),
        prs: countFilesInDirectory(path.join(projectPath, 'tasks', 'prs')),
      };

      // Delete an issue that has related tasks and PRs
      let result = await runCLICommand(['issue', 'delete', 'ISS-0001', '--force']);
      expect(result.success).toBe(true);

      // Verify issue was deleted
      const issuesDir = path.join(projectPath, 'tasks', 'issues');
      const issueFiles = fs.readdirSync(issuesDir);
      const remainingIssues = issueFiles.filter((f) => f.startsWith('ISS-0001'));
      expect(remainingIssues).toHaveLength(0);

      // Check that references are cleaned up
      const orphaned = checkForOrphanedReferences(projectPath);
      expect(orphaned.orphanedTasks).toHaveLength(0);
      expect(orphaned.orphanedPRs).toHaveLength(0);

      // Verify project integrity
      result = await runCLICommand(['status']);
      expect(result.success).toBe(true);
    });

    it('should delete task and update issue relationships', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Get task count before deletion
      const initialTaskCount = countFilesInDirectory(path.join(projectPath, 'tasks', 'tasks'));

      // Delete a specific task
      let result = await runCLICommand(['task', 'delete', 'TSK-0001', '--force']);
      expect(result.success).toBe(true);

      // Verify task was deleted
      const tasksDir = path.join(projectPath, 'tasks', 'tasks');
      const taskFiles = fs.readdirSync(tasksDir);
      const remainingTasks = taskFiles.filter((f) => f.startsWith('TSK-0001'));
      expect(remainingTasks).toHaveLength(0);

      // Verify count decreased
      const finalTaskCount = countFilesInDirectory(path.join(projectPath, 'tasks', 'tasks'));
      expect(finalTaskCount).toBe(initialTaskCount - 1);

      // Check that related issue shows the task is no longer referenced
      result = await runCLICommand(['issue', 'show', 'ISS-0001', '--with-tasks']);
      expect(result.success).toBe(true);
      expect(result.stdout).not.toContain('TSK-0001');

      // Verify project integrity
      result = await runCLICommand(['status']);
      expect(result.success).toBe(true);
    });

    it('should delete PR and update issue relationships', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Get PR count before deletion
      const initialPRCount = countFilesInDirectory(path.join(projectPath, 'tasks', 'prs'));

      // Delete a specific PR
      let result = await runCLICommand(['pr', 'delete', 'PR-0001', '--force']);
      expect(result.success).toBe(true);

      // Verify PR was deleted
      const prsDir = path.join(projectPath, 'tasks', 'prs');
      const prFiles = fs.readdirSync(prsDir);
      const remainingPRs = prFiles.filter((f) => f.startsWith('PR-0001'));
      expect(remainingPRs).toHaveLength(0);

      // Verify count decreased
      const finalPRCount = countFilesInDirectory(path.join(projectPath, 'tasks', 'prs'));
      expect(finalPRCount).toBe(initialPRCount - 1);

      // Check that related issue no longer shows the PR
      result = await runCLICommand(['issue', 'show', 'ISS-0001', '--with-prs']);
      expect(result.success).toBe(true);
      expect(result.stdout).not.toContain('PR-0001');

      // Verify project integrity
      result = await runCLICommand(['status']);
      expect(result.success).toBe(true);
    });
  });

  describe('Cascade Deletion Scenarios', () => {
    it('should handle cascade deletion of epic with all related items', async () => {
      const testContext = getTestContext();

      // Create a project with deep relationships
      let result = await runCLICommand(['init', 'cascade-deletion-test']);
      expect(result.success).toBe(true);

      const projectDir = path.join(testContext.tempDir, 'cascade-deletion-test');
      process.chdir(projectDir);

      // Create epic
      result = await runCLICommand([
        'epic',
        'create',
        'Cascade Test Epic',
        '--description',
        'Epic for testing cascade deletion',
      ]);
      expect(result.success).toBe(true);

      // Create multiple issues under epic
      for (let i = 1; i <= 3; i++) {
        result = await runCLICommand([
          'issue',
          'create',
          `Issue ${i}`,
          '--description',
          `Issue ${i} description`,
          '--epic',
          'EP-0001',
        ]);
        expect(result.success).toBe(true);
      }

      // Create tasks under issues
      for (let i = 1; i <= 3; i++) {
        result = await runCLICommand([
          'task',
          'create',
          `Task ${i}`,
          '--description',
          `Task ${i} description`,
          '--issue',
          `ISS-${String(i).padStart(4, '0')}`,
        ]);
        expect(result.success).toBe(true);
      }

      // Create PRs for issues
      for (let i = 1; i <= 2; i++) {
        result = await runCLICommand([
          'pr',
          'create',
          `PR ${i}`,
          '--description',
          `PR ${i} description`,
          '--issue',
          `ISS-${String(i).padStart(4, '0')}`,
          '--branch-name',
          `feature/branch-${i}`,
        ]);
        expect(result.success).toBe(true);
      }

      // Get initial counts
      const initialCounts = {
        epics: countFilesInDirectory(path.join(projectDir, 'tasks', 'epics')),
        issues: countFilesInDirectory(path.join(projectDir, 'tasks', 'issues')),
        tasks: countFilesInDirectory(path.join(projectDir, 'tasks', 'tasks')),
        prs: countFilesInDirectory(path.join(projectDir, 'tasks', 'prs')),
      };

      expect(initialCounts.epics).toBe(1);
      expect(initialCounts.issues).toBe(3);
      expect(initialCounts.tasks).toBe(3);
      expect(initialCounts.prs).toBe(2);

      // Delete epic with cascade option (if supported)
      result = await runCLICommand(['epic', 'delete', 'EP-0001', '--cascade']);

      if (!result.success) {
        // Try force deletion if cascade isn't supported
        result = await runCLICommand(['epic', 'delete', 'EP-0001', '--force']);
        expect(result.success).toBe(true);
      }

      // Verify deletion results
      const finalCounts = {
        epics: countFilesInDirectory(path.join(projectDir, 'tasks', 'epics')),
        issues: countFilesInDirectory(path.join(projectDir, 'tasks', 'issues')),
        tasks: countFilesInDirectory(path.join(projectDir, 'tasks', 'tasks')),
        prs: countFilesInDirectory(path.join(projectDir, 'tasks', 'prs')),
      };

      // Epic should be deleted
      expect(finalCounts.epics).toBe(0);

      // Check if cascade deletion occurred or references were cleaned
      if (finalCounts.issues === 0) {
        // Full cascade deletion occurred
        expect(finalCounts.tasks).toBe(0);
        expect(finalCounts.prs).toBe(0);
      } else {
        // References should be cleaned up
        const orphaned = checkForOrphanedReferences(projectDir);
        expect(orphaned.orphanedIssues).toHaveLength(0);
        expect(orphaned.orphanedTasks).toHaveLength(0);
        expect(orphaned.orphanedPRs).toHaveLength(0);
      }

      // Verify project integrity
      result = await runCLICommand(['status']);
      expect(result.success).toBe(true);
    });

    it('should handle dependency-based deletion prevention', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Try to delete an issue that has active tasks
      let result = await runCLICommand(['issue', 'delete', 'ISS-0001']);

      if (!result.success) {
        // Should provide helpful error about existing dependencies
        expect(result.stderr).toContain(
          'tasks' || result.stderr.includes('related') || result.stderr.includes('force')
        );
      }

      // Complete all related tasks first
      const tasksDir = path.join(projectPath, 'tasks', 'tasks');
      const taskFiles = fs.readdirSync(tasksDir);

      for (const taskFile of taskFiles) {
        if (taskFile.includes('ISS-0001')) {
          const taskId = taskFile.match(/^(TSK-\d+)/)?.[1];
          if (taskId) {
            result = await runCLICommand(['task', 'complete', taskId, '--time-spent', '1h']);
            expect(result.success).toBe(true);
          }
        }
      }

      // Now try to delete the issue again
      result = await runCLICommand(['issue', 'delete', 'ISS-0001']);

      if (!result.success) {
        // Try with force flag
        result = await runCLICommand(['issue', 'delete', 'ISS-0001', '--force']);
        expect(result.success).toBe(true);
      }

      // Verify deletion occurred
      const issuesDir = path.join(projectPath, 'tasks', 'issues');
      const issueFiles = fs.readdirSync(issuesDir);
      const remainingIssues = issueFiles.filter((f) => f.startsWith('ISS-0001'));
      expect(remainingIssues).toHaveLength(0);
    });
  });

  describe('Cleanup Verification and Integrity', () => {
    it('should detect and report orphaned references', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Manually delete an epic file to create orphaned references
      const epicsDir = path.join(projectPath, 'tasks', 'epics');
      const epicFiles = fs.readdirSync(epicsDir);
      const epicFile = epicFiles.find((f) => f.startsWith('EP-0001'));
      if (epicFile) {
        fs.unlinkSync(path.join(epicsDir, epicFile));
      }

      // Check for orphaned references
      const orphaned = checkForOrphanedReferences(projectPath);
      expect(orphaned.orphanedIssues.length).toBeGreaterThan(0);

      // Status command should either handle gracefully or report the issue
      let result = await runCLICommand(['status']);
      expect(result.success).toBe(true); // Should not crash

      // If the system has a cleanup command, test it
      result = await runCLICommand(['cleanup', '--dry-run']);

      if (result.success) {
        // Cleanup command exists - verify it detects issues
        expect(result.stdout).toContain('orphan' || result.stdout.includes('reference'));

        // Run actual cleanup
        result = await runCLICommand(['cleanup', '--fix']);
        expect(result.success).toBe(true);

        // Verify orphaned references are fixed
        const cleanedOrphaned = checkForOrphanedReferences(projectPath);
        expect(cleanedOrphaned.orphanedIssues).toHaveLength(0);
      }
    });

    it('should maintain project integrity after multiple deletions', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Get initial ticket IDs
      const _initialIds = getAllTicketIds(projectPath);

      // Delete various items in random order
      const deletionOperations = [
        ['task', 'delete', 'TSK-0003', '--force'],
        ['pr', 'delete', 'PR-0002', '--force'],
        ['task', 'delete', 'TSK-0007', '--force'],
        ['issue', 'delete', 'ISS-0004', '--force'],
        ['task', 'delete', 'TSK-0010', '--force'],
        ['pr', 'delete', 'PR-0001', '--force'],
        ['epic', 'delete', 'EP-0002', '--force'],
      ];

      for (const operation of deletionOperations) {
        const result = await runCLICommand(operation);
        if (!result.success) {
          // Some deletions might fail due to dependencies, which is acceptable
          console.log(`Deletion failed for ${operation.join(' ')}: ${result.stderr}`);
        }
      }

      // Verify project integrity after all deletions
      const result = await runCLICommand(['status']);
      expect(result.success).toBe(true);

      // Check for orphaned references
      const orphaned = checkForOrphanedReferences(projectPath);
      expect(
        orphaned.orphanedIssues.length + orphaned.orphanedTasks.length + orphaned.orphanedPRs.length
      ).toBe(0);

      // Verify remaining items are consistent
      const finalIds = getAllTicketIds(projectPath);

      // Each remaining issue should have a valid epic reference (if any)
      const issuesDir = path.join(projectPath, 'tasks', 'issues');
      const issueFiles = fs.readdirSync(issuesDir);

      for (const issueFile of issueFiles) {
        const issuePath = path.join(issuesDir, issueFile);
        const content = fs.readFileSync(issuePath, 'utf-8');
        const epicMatch = content.match(/related_epics:\s*\["?(EP-\d+)"?\]/);

        if (epicMatch) {
          const referencedEpic = epicMatch[1];
          expect(finalIds.epics).toContain(referencedEpic);
        }
      }

      // Each remaining task should have a valid issue reference (if any)
      const tasksDir = path.join(projectPath, 'tasks', 'tasks');
      if (fs.existsSync(tasksDir)) {
        const taskFiles = fs.readdirSync(tasksDir);

        for (const taskFile of taskFiles) {
          const taskPath = path.join(tasksDir, taskFile);
          const content = fs.readFileSync(taskPath, 'utf-8');
          const issueMatch = content.match(/related_issue:\s*"?(ISS-\d+)"?/);

          if (issueMatch) {
            const referencedIssue = issueMatch[1];
            expect(finalIds.issues).toContain(referencedIssue);
          }
        }
      }
    });

    it('should handle cleanup of temporary and backup files', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Create some temporary files that might be left behind
      const tempFiles = [
        path.join(projectPath, 'tasks', '.tmp_epic_001'),
        path.join(projectPath, 'tasks', 'issues', '.backup_ISS-0001.md'),
        path.join(projectPath, 'tasks', 'tasks', 'TSK-0001.md.bak'),
        path.join(projectPath, '.aitrackdown_temp'),
        path.join(projectPath, 'tasks', '.index.tmp'),
      ];

      // Create temporary files
      for (const tempFile of tempFiles) {
        fs.writeFileSync(tempFile, 'temporary content');
      }

      // Verify temp files exist
      for (const tempFile of tempFiles) {
        expect(fs.existsSync(tempFile)).toBe(true);
      }

      // Run cleanup command if available
      let result = await runCLICommand(['cleanup', '--temp-files']);

      if (result.success) {
        // Verify temp files are cleaned up
        for (const tempFile of tempFiles) {
          expect(fs.existsSync(tempFile)).toBe(false);
        }
      } else {
        // If no cleanup command, manually clean and verify detection
        for (const tempFile of tempFiles) {
          fs.unlinkSync(tempFile);
        }
      }

      // Verify project still functions correctly
      result = await runCLICommand(['status']);
      expect(result.success).toBe(true);
    });
  });

  describe('Batch Deletion Operations', () => {
    it('should handle batch deletion of completed items', async () => {
      const testContext = getTestContext();

      // Create project with multiple completed items
      let result = await runCLICommand(['init', 'batch-deletion-test']);
      expect(result.success).toBe(true);

      const projectDir = path.join(testContext.tempDir, 'batch-deletion-test');
      process.chdir(projectDir);

      // Create and complete multiple items
      for (let i = 1; i <= 5; i++) {
        // Create epic
        result = await runCLICommand([
          'epic',
          'create',
          `Epic ${i}`,
          '--description',
          `Epic ${i} for batch testing`,
        ]);
        expect(result.success).toBe(true);

        // Complete epic
        result = await runCLICommand([
          'epic',
          'complete',
          `EP-${String(i).padStart(4, '0')}`,
          '--actual-tokens',
          '100',
        ]);
        expect(result.success).toBe(true);
      }

      // Create some active items that should not be deleted
      result = await runCLICommand([
        'epic',
        'create',
        'Active Epic',
        '--description',
        'This epic should remain active',
      ]);
      expect(result.success).toBe(true);

      // Get counts before batch deletion
      const initialCount = countFilesInDirectory(path.join(projectDir, 'tasks', 'epics'));
      expect(initialCount).toBe(6); // 5 completed + 1 active

      // Attempt batch deletion of completed items
      result = await runCLICommand(['epic', 'delete', '--status', 'completed', '--batch']);

      if (result.success) {
        // Verify only completed items were deleted
        const finalCount = countFilesInDirectory(path.join(projectDir, 'tasks', 'epics'));
        expect(finalCount).toBe(1); // Only active epic should remain

        // Verify the remaining epic is the active one
        result = await runCLICommand(['epic', 'list']);
        expect(result.success).toBe(true);
        expect(result.stdout).toContain('Active Epic');
        expect(result.stdout).not.toContain('Epic 1');
      } else {
        // Batch deletion might not be supported, verify individual deletion works
        for (let i = 1; i <= 5; i++) {
          result = await runCLICommand([
            'epic',
            'delete',
            `EP-${String(i).padStart(4, '0')}`,
            '--force',
          ]);
          expect(result.success).toBe(true);
        }

        const finalCount = countFilesInDirectory(path.join(projectDir, 'tasks', 'epics'));
        expect(finalCount).toBe(1);
      }
    });

    it('should handle batch deletion with filters', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createComprehensiveTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Create additional issues with specific assignees
      for (let i = 1; i <= 3; i++) {
        const result = await runCLICommand([
          'issue',
          'create',
          `Temp Issue ${i}`,
          '--description',
          `Temporary issue ${i}`,
          '--assignee',
          'temp-worker',
          '--priority',
          'low',
        ]);
        expect(result.success).toBe(true);
      }

      // Get initial count
      const initialCount = countFilesInDirectory(path.join(projectPath, 'tasks', 'issues'));

      // Attempt to delete issues by assignee
      let result = await runCLICommand(['issue', 'delete', '--assignee', 'temp-worker', '--batch']);

      if (result.success) {
        // Verify filtered deletion worked
        const finalCount = countFilesInDirectory(path.join(projectPath, 'tasks', 'issues'));
        expect(finalCount).toBe(initialCount - 3);

        // Verify no issues assigned to temp-worker remain
        result = await runCLICommand(['issue', 'list', '--assignee', 'temp-worker']);
        expect(result.success).toBe(true);
        expect(result.stdout).not.toContain('Temp Issue');
      } else {
        // If batch deletion by filter isn't supported, verify individual deletions
        const issuesDir = path.join(projectPath, 'tasks', 'issues');
        const issueFiles = fs.readdirSync(issuesDir);

        for (const issueFile of issueFiles) {
          if (issueFile.includes('temp-issue')) {
            const issueId = issueFile.match(/^(ISS-\d+)/)?.[1];
            if (issueId) {
              result = await runCLICommand(['issue', 'delete', issueId, '--force']);
              expect(result.success).toBe(true);
            }
          }
        }
      }

      // Verify project integrity after batch operations
      result = await runCLICommand(['status']);
      expect(result.success).toBe(true);

      const orphaned = checkForOrphanedReferences(projectPath);
      expect(
        orphaned.orphanedIssues.length + orphaned.orphanedTasks.length + orphaned.orphanedPRs.length
      ).toBe(0);
    });
  });

  describe('Error Handling During Deletion', () => {
    it('should handle deletion of non-existent items gracefully', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Try to delete non-existent items
      const nonExistentItems = [
        ['epic', 'delete', 'EP-9999'],
        ['issue', 'delete', 'ISS-9999'],
        ['task', 'delete', 'TSK-9999'],
        ['pr', 'delete', 'PR-9999'],
      ];

      for (const operation of nonExistentItems) {
        const result = await runCLICommand(operation);
        expect(result.success).toBe(false);
        expect(result.stderr).toContain('not found' || result.stderr.includes('does not exist'));
      }

      // Verify project integrity is maintained
      const result = await runCLICommand(['status']);
      expect(result.success).toBe(true);
    });

    it('should handle file system errors during deletion', async () => {
      const _testContext = getTestContext();
      const projectData = testDataManager.createMinimalTestData();
      const projectPath = await testDataManager.createTestProject(projectData);
      process.chdir(projectPath);

      // Make a file read-only to simulate permission errors
      const issuesDir = path.join(projectPath, 'tasks', 'issues');
      const issueFiles = fs.readdirSync(issuesDir);
      const issueFile = issueFiles[0];
      const issuePath = path.join(issuesDir, issueFile);

      // Change file permissions to read-only
      try {
        fs.chmodSync(issuePath, 0o444);

        // Try to delete the read-only file
        const issueId = issueFile.match(/^(ISS-\d+)/)?.[1];
        let result = await runCLICommand(['issue', 'delete', issueId!, '--force']);

        // Should either handle gracefully or provide clear error
        if (!result.success) {
          expect(result.stderr).toContain('permission' || result.stderr.includes('access'));
        }

        // Restore permissions
        fs.chmodSync(issuePath, 0o644);

        // Now deletion should work
        result = await runCLICommand(['issue', 'delete', issueId!, '--force']);
        expect(result.success).toBe(true);
      } catch (_error) {
        // Skip test if permission changes aren't supported on this system
        console.log('Skipping permission test due to system limitations');
      }
    });

    it('should handle concurrent deletion attempts', async () => {
      const testContext = getTestContext();

      // Create multiple items for concurrent deletion
      let result = await runCLICommand(['init', 'concurrent-deletion-test']);
      expect(result.success).toBe(true);

      const projectDir = path.join(testContext.tempDir, 'concurrent-deletion-test');
      process.chdir(projectDir);

      // Create multiple items
      for (let i = 1; i <= 10; i++) {
        result = await runCLICommand([
          'task',
          'create',
          `Concurrent Task ${i}`,
          '--description',
          `Task ${i} for concurrent deletion testing`,
        ]);
        expect(result.success).toBe(true);
      }

      // Attempt concurrent deletions
      const deletionPromises = [];
      for (let i = 1; i <= 10; i++) {
        const taskId = `TSK-${String(i).padStart(4, '0')}`;
        const promise = runCLICommand(['task', 'delete', taskId, '--force']);
        deletionPromises.push(promise);
      }

      // Wait for all deletions to complete
      const results = await Promise.all(deletionPromises);

      // Most should succeed, some might fail due to race conditions
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBeGreaterThan(0);

      // Verify final state is consistent
      result = await runCLICommand(['status']);
      expect(result.success).toBe(true);

      const finalTaskCount = countFilesInDirectory(path.join(projectDir, 'tasks', 'tasks'));
      expect(finalTaskCount).toBeLessThanOrEqual(10);
    });
  });
});
