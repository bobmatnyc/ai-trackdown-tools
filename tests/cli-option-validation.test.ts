/**
 * CLI Option Validation Tests
 * Tests that verify CLI options are correctly defined and handled
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { CLIAssertions, CLITestConfigs, runCLICommand } from './utils/cli-test-runner.js';
import { createMockProject, setupTestEnvironment } from './utils/test-helpers.js';

describe('CLI Option Validation', () => {
  const getTestContext = setupTestEnvironment();

  beforeEach(() => {
    const testContext = getTestContext();
    createMockProject(testContext.tempDir);
  });

  describe('PR Command Options', () => {
    it('should recognize valid PR create options', async () => {
      const result = await runCLICommand(
        [
          'pr',
          'create',
          'Test PR',
          '--issue',
          'ISS-0001',
          '--branch-name',
          'feature/test-branch',
          '--description',
          'Test PR description',
          '--dry-run',
        ],
        CLITestConfigs.standard
      );

      // Should not fail with "unknown option" error
      CLIAssertions.assertValidOption(result, '--branch-name');
      CLIAssertions.assertValidOption(result, '--issue');
      CLIAssertions.assertValidOption(result, '--description');
      CLIAssertions.assertValidOption(result, '--dry-run');
    });

    it('should reject unknown PR options', async () => {
      const result = await runCLICommand(
        [
          'pr',
          'create',
          'Test PR',
          '--issue',
          'ISS-0001', // Provide required option
          '--unknown-option',
          'value',
        ],
        CLITestConfigs.errorTesting
      );

      CLIAssertions.assertFailure(result);

      // Commander.js might put error in stdout or stderr, so check both
      const hasUnknownOption =
        result.stderr.includes('unknown option') ||
        result.stdout.includes('unknown option') ||
        result.stderr.includes('Unknown option') ||
        result.stdout.includes('Unknown option');
      expect(hasUnknownOption).toBe(true);
    });

    it('should recognize PR review comment options', async () => {
      const result = await runCLICommand(
        ['pr', 'review', 'PR-0001', '--comments', 'This looks good', '--approve', '--dry-run'],
        CLITestConfigs.standard
      );

      // Should not fail with "unknown option" error
      CLIAssertions.assertValidOption(result, '--comments');
      CLIAssertions.assertValidOption(result, '--approve');
    });
  });

  describe('Task Command Options', () => {
    it('should recognize valid task complete options', async () => {
      const result = await runCLICommand(
        [
          'task',
          'complete',
          'TSK-0001',
          '--time-spent',
          '4h',
          '--completion-notes',
          'Task completed successfully',
          '--actual-tokens',
          '100',
          '--dry-run',
        ],
        CLITestConfigs.standard
      );

      // Should not fail with "unknown option" error
      CLIAssertions.assertValidOption(result, '--time-spent');
      CLIAssertions.assertValidOption(result, '--completion-notes');
      CLIAssertions.assertValidOption(result, '--actual-tokens');
      CLIAssertions.assertValidOption(result, '--dry-run');
    });

    it('should reject invalid comment option for task complete', async () => {
      const result = await runCLICommand(
        ['task', 'complete', 'TSK-0001', '--comment', 'This should fail'],
        CLITestConfigs.errorTesting
      );

      CLIAssertions.assertFailure(result);
      // Commander.js might put error in stdout or stderr, so check both
      const hasUnknownOption =
        result.stderr.includes('unknown option') ||
        result.stdout.includes('unknown option') ||
        result.stderr.includes('Unknown option') ||
        result.stdout.includes('Unknown option');
      expect(hasUnknownOption).toBe(true);
    });
  });

  describe('Issue Command Options', () => {
    it('should recognize valid issue complete options', async () => {
      const result = await runCLICommand(
        [
          'issue',
          'complete',
          'ISS-0001',
          '--actual-tokens',
          '500',
          '--comment',
          'Issue completed successfully',
          '--completion-notes',
          'Additional completion notes',
          '--dry-run',
        ],
        CLITestConfigs.standard
      );

      // Should not fail with "unknown option" error
      CLIAssertions.assertValidOption(result, '--actual-tokens');
      CLIAssertions.assertValidOption(result, '--comment');
      CLIAssertions.assertValidOption(result, '--completion-notes');
      CLIAssertions.assertValidOption(result, '--dry-run');
    });
  });

  describe('Epic Command Options', () => {
    it('should recognize valid epic complete options', async () => {
      const result = await runCLICommand(
        [
          'epic',
          'complete',
          'EP-0001',
          '--actual-tokens',
          '1500',
          '--completion-notes',
          'Epic completed successfully',
          '--force',
          '--dry-run',
        ],
        CLITestConfigs.standard
      );

      // Should not fail with "unknown option" error
      CLIAssertions.assertValidOption(result, '--actual-tokens');
      CLIAssertions.assertValidOption(result, '--completion-notes');
      CLIAssertions.assertValidOption(result, '--force');
      CLIAssertions.assertValidOption(result, '--dry-run');
    });

    it('should reject invalid comment option for epic complete', async () => {
      const result = await runCLICommand(
        ['epic', 'complete', 'EP-0001', '--comment', 'This should fail'],
        CLITestConfigs.errorTesting
      );

      CLIAssertions.assertFailure(result);
      // Commander.js might put error in stdout or stderr, so check both
      const hasUnknownOption =
        result.stderr.includes('unknown option') ||
        result.stdout.includes('unknown option') ||
        result.stderr.includes('Unknown option') ||
        result.stdout.includes('Unknown option');
      expect(hasUnknownOption).toBe(true);
    });
  });

  describe('Global Options', () => {
    it('should recognize global options across all commands', async () => {
      const globalOptions = [
        ['--verbose'],
        ['--no-color'],
        ['--project-dir', '.'],
        ['--tasks-dir', 'custom-tasks'],
        ['--root-dir', 'custom-root'],
      ];

      for (const option of globalOptions) {
        const result = await runCLICommand(['status', ...option], CLITestConfigs.standard);

        // Global options should not cause "unknown option" errors
        CLIAssertions.assertValidOption(result, option[0]);
      }
    });
  });

  describe('Process Exit Handling', () => {
    it('should handle process.exit calls gracefully in test environment', async () => {
      // This command should trigger process.exit(1) due to missing required argument
      const result = await runCLICommand(
        [
          'epic',
          'create', // Missing required title
        ],
        CLITestConfigs.errorTesting
      );

      // Should not crash the test runner
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.exitCode).toBeGreaterThan(0);
    });

    it('should capture stdout and stderr during process.exit', async () => {
      const result = await runCLICommand(
        [
          'pr',
          'create', // Missing required arguments
        ],
        CLITestConfigs.errorTesting
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(false);

      // Should capture error information
      const hasErrorInfo =
        result.stderr.length > 0 ||
        result.stdout.includes('error') ||
        result.stdout.includes('required');
      expect(hasErrorInfo).toBe(true);
    });
  });

  describe('Command Isolation', () => {
    it('should isolate command execution between tests', async () => {
      // First command
      const result1 = await runCLICommand(['status'], CLITestConfigs.standard);

      // Second command should not be affected by first
      const result2 = await runCLICommand(['epic', 'list'], CLITestConfigs.standard);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();

      // Results should be independent
      expect(result1.stdout).not.toEqual(result2.stdout);
    });

    it('should restore environment after each command', async () => {
      const originalArgv = process.argv;
      const originalCwd = process.cwd();

      await runCLICommand(['status', '--verbose'], CLITestConfigs.standard);

      // Environment should be restored
      expect(process.argv).toEqual(originalArgv);
      expect(process.cwd()).toEqual(originalCwd);
    });
  });

  describe('Performance and Timeout', () => {
    it('should complete commands within reasonable time', async () => {
      const startTime = Date.now();
      const result = await runCLICommand(['status'], CLITestConfigs.performance);
      const endTime = Date.now();

      CLIAssertions.assertExecutionTime(result, 5000); // 5 second max
      expect(endTime - startTime).toBeLessThan(10000); // 10 second outer limit
    });

    it('should handle command timeouts gracefully', async () => {
      // Test with a simple command but very short timeout to test timeout handling
      const result = await runCLICommand(['status'], {
        ...CLITestConfigs.errorTesting,
        timeout: 100,
      }); // 100ms timeout

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.exitCode).toBe('number');
      // Should not crash the test runner regardless of outcome
      expect(result.executionTime).toBeGreaterThan(0);
    });
  });
});
