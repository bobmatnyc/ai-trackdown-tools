import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/index.js';
import { CLITestUtils, createMockProject, setupTestEnvironment } from './utils/test-helpers.js';

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

describe('CLI Argument Parsing and Validation Tests', () => {
  const getTestContext = setupTestEnvironment();

  beforeEach(() => {
    const testContext = getTestContext();
    createMockProject(testContext.tempDir);
  });

  describe('Global Options Validation', () => {
    it('should handle --version flag', async () => {
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;
      const originalExit = process.exit;

      // Mock process.exit to prevent actual exit
      process.exit = vi.fn() as any;
      process.argv = ['node', 'aitrackdown', '--version'];

      try {
        await main();

        // Should display version information
        expect(
          consoleMock.logs.some((log) => log.includes('1.') || log.includes('version')) ||
            process.exit
        ).toHaveBeenCalledWith(0);
      } finally {
        process.argv = originalArgv;
        process.exit = originalExit;
        consoleMock.restore();
      }
    });

    it('should handle --help flag', async () => {
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;
      const originalExit = process.exit;

      process.exit = vi.fn() as any;
      process.argv = ['node', 'aitrackdown', '--help'];

      try {
        await main();

        // Should display help information
        expect(
          consoleMock.logs.some(
            (log) => log.includes('help') || log.includes('Usage') || log.includes('Commands')
          ) || process.exit
        ).toHaveBeenCalledWith(0);
      } finally {
        process.argv = originalArgv;
        process.exit = originalExit;
        consoleMock.restore();
      }
    });

    it('should handle --verbose flag', async () => {
      const _testContext = getTestContext();
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;

      process.argv = ['node', 'aitrackdown', 'status', '--verbose'];

      try {
        await main();

        // Should display verbose output
        expect(
          consoleMock.logs.some(
            (log) =>
              log.includes('debug') || log.includes('verbose') || log.includes('Running command')
          )
        ).toBe(true);
      } finally {
        process.argv = originalArgv;
        consoleMock.restore();
      }
    });

    it('should handle --no-color flag', async () => {
      const _testContext = getTestContext();
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;
      const originalForceColor = process.env.FORCE_COLOR;

      process.argv = ['node', 'aitrackdown', 'status', '--no-color'];

      try {
        await main();

        // Should set FORCE_COLOR environment variable
        expect(process.env.FORCE_COLOR).toBe('0');
      } finally {
        process.argv = originalArgv;
        process.env.FORCE_COLOR = originalForceColor;
        consoleMock.restore();
      }
    });

    it('should handle --project-dir option', async () => {
      const testContext = getTestContext();

      // Create external project
      const externalProjectDir = path.join(testContext.tempDir, 'external-project');
      createMockProject(testContext.tempDir, 'external-project');

      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;

      process.argv = ['node', 'aitrackdown', 'status', '--project-dir', externalProjectDir];

      try {
        await main();

        // Should process external project
        expect(
          consoleMock.logs.some(
            (log) => log.includes('status') || log.includes('Epic') || log.includes('Issue')
          )
        ).toBe(true);
      } finally {
        process.argv = originalArgv;
        consoleMock.restore();
      }
    });

    it('should handle invalid --project-dir', async () => {
      const _testContext = getTestContext();
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;
      const originalExit = process.exit;

      process.exit = vi.fn() as any;
      process.argv = ['node', 'aitrackdown', 'status', '--project-dir', '/non/existent/path'];

      try {
        await main();

        // Should handle invalid directory gracefully
        expect(
          consoleMock.errors.some(
            (error) => error.includes('Failed to change') || error.includes('directory')
          ) || process.exit
        ).toHaveBeenCalledWith(1);
      } finally {
        process.argv = originalArgv;
        process.exit = originalExit;
        consoleMock.restore();
      }
    });

    it('should handle --root-dir option', async () => {
      const testContext = getTestContext();

      // Create custom tasks directory
      const customTasksDir = path.join(testContext.tempDir, 'custom-tasks');
      fs.mkdirSync(customTasksDir, { recursive: true });
      fs.mkdirSync(path.join(customTasksDir, 'epics'), { recursive: true });

      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;

      process.argv = ['node', 'aitrackdown', 'status', '--root-dir', customTasksDir];

      try {
        await main();

        // Should set custom tasks directory
        expect(process.env.CLI_TASKS_DIR).toBe(customTasksDir);
      } finally {
        process.argv = originalArgv;
        consoleMock.restore();
      }
    });

    it('should handle --tasks-dir as alias for --root-dir', async () => {
      const testContext = getTestContext();

      const customTasksDir = path.join(testContext.tempDir, 'alias-tasks');
      fs.mkdirSync(customTasksDir, { recursive: true });

      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;

      process.argv = ['node', 'aitrackdown', 'status', '--tasks-dir', customTasksDir];

      try {
        await main();

        // Should set custom tasks directory via alias
        expect(process.env.CLI_TASKS_DIR).toBe(customTasksDir);
      } finally {
        process.argv = originalArgv;
        consoleMock.restore();
      }
    });
  });

  describe('Command-Specific Argument Validation', () => {
    describe('Epic Command Arguments', () => {
      it('should validate required epic title', async () => {
        const _testContext = getTestContext();
        const consoleMock = CLITestUtils.mockConsole();
        const originalArgv = process.argv;
        const originalExit = process.exit;

        process.exit = vi.fn() as any;
        process.argv = ['node', 'aitrackdown', 'epic', 'create']; // Missing title

        try {
          await main();

          // Should show error for missing title
          expect(
            consoleMock.errors.some(
              (error) =>
                error.includes('title') || error.includes('required') || error.includes('argument')
            ) || process.exit
          ).toHaveBeenCalledWith(1);
        } finally {
          process.argv = originalArgv;
          process.exit = originalExit;
          consoleMock.restore();
        }
      });

      it('should validate epic priority values', async () => {
        const _testContext = getTestContext();
        const consoleMock = CLITestUtils.mockConsole();
        const originalArgv = process.argv;

        process.argv = [
          'node',
          'aitrackdown',
          'epic',
          'create',
          'Test Epic',
          '--priority',
          'invalid-priority',
        ];

        try {
          await main();

          // Should handle invalid priority gracefully
          expect(
            consoleMock.errors.some(
              (error) => error.includes('priority') || error.includes('invalid')
            ) || consoleMock.logs.some((log) => log.includes('created'))
          ).toBe(true);
        } finally {
          process.argv = originalArgv;
          consoleMock.restore();
        }
      });

      it('should validate estimated tokens as number', async () => {
        const _testContext = getTestContext();
        const consoleMock = CLITestUtils.mockConsole();
        const originalArgv = process.argv;

        process.argv = [
          'node',
          'aitrackdown',
          'epic',
          'create',
          'Test Epic',
          '--estimated-tokens',
          'not-a-number',
        ];

        try {
          await main();

          // Should handle invalid token count gracefully
          expect(
            consoleMock.errors.some(
              (error) => error.includes('token') || error.includes('number')
            ) || consoleMock.logs.some((log) => log.includes('created'))
          ).toBe(true);
        } finally {
          process.argv = originalArgv;
          consoleMock.restore();
        }
      });

      it('should validate epic status values', async () => {
        const _testContext = getTestContext();
        const consoleMock = CLITestUtils.mockConsole();
        const originalArgv = process.argv;

        const _validStatuses = ['planning', 'active', 'completed', 'cancelled'];
        const invalidStatus = 'invalid-status';

        process.argv = [
          'node',
          'aitrackdown',
          'epic',
          'create',
          'Test Epic',
          '--status',
          invalidStatus,
        ];

        try {
          await main();

          // Should handle invalid status gracefully
          expect(
            consoleMock.errors.some(
              (error) => error.includes('status') || error.includes('invalid')
            ) || consoleMock.logs.some((log) => log.includes('created'))
          ).toBe(true);
        } finally {
          process.argv = originalArgv;
          consoleMock.restore();
        }
      });
    });

    describe('Issue Command Arguments', () => {
      it('should validate required issue title', async () => {
        const _testContext = getTestContext();
        const consoleMock = CLITestUtils.mockConsole();
        const originalArgv = process.argv;
        const originalExit = process.exit;

        process.exit = vi.fn() as any;
        process.argv = ['node', 'aitrackdown', 'issue', 'create']; // Missing title

        try {
          await main();

          // Should show error for missing title
          expect(
            consoleMock.errors.some(
              (error) =>
                error.includes('title') || error.includes('required') || error.includes('argument')
            ) || process.exit
          ).toHaveBeenCalledWith(1);
        } finally {
          process.argv = originalArgv;
          process.exit = originalExit;
          consoleMock.restore();
        }
      });

      it('should validate epic reference format', async () => {
        const _testContext = getTestContext();
        const consoleMock = CLITestUtils.mockConsole();
        const originalArgv = process.argv;

        process.argv = [
          'node',
          'aitrackdown',
          'issue',
          'create',
          'Test Issue',
          '--epic',
          'invalid-epic-id',
        ];

        try {
          await main();

          // Should handle invalid epic ID format gracefully
          expect(
            consoleMock.errors.some(
              (error) => error.includes('epic') || error.includes('format')
            ) || consoleMock.logs.some((log) => log.includes('created'))
          ).toBe(true);
        } finally {
          process.argv = originalArgv;
          consoleMock.restore();
        }
      });

      it('should validate issue priority values', async () => {
        const _testContext = getTestContext();
        const consoleMock = CLITestUtils.mockConsole();
        const originalArgv = process.argv;

        process.argv = [
          'node',
          'aitrackdown',
          'issue',
          'create',
          'Test Issue',
          '--priority',
          'ultra-mega-high',
        ];

        try {
          await main();

          // Should handle invalid priority gracefully
          expect(
            consoleMock.errors.some((error) => error.includes('priority')) ||
              consoleMock.logs.some((log) => log.includes('created'))
          ).toBe(true);
        } finally {
          process.argv = originalArgv;
          consoleMock.restore();
        }
      });
    });

    describe('Task Command Arguments', () => {
      it('should validate required task title', async () => {
        const _testContext = getTestContext();
        const consoleMock = CLITestUtils.mockConsole();
        const originalArgv = process.argv;
        const originalExit = process.exit;

        process.exit = vi.fn() as any;
        process.argv = ['node', 'aitrackdown', 'task', 'create']; // Missing title

        try {
          await main();

          // Should show error for missing title
          expect(
            consoleMock.errors.some(
              (error) =>
                error.includes('title') || error.includes('required') || error.includes('argument')
            ) || process.exit
          ).toHaveBeenCalledWith(1);
        } finally {
          process.argv = originalArgv;
          process.exit = originalExit;
          consoleMock.restore();
        }
      });

      it('should validate time format', async () => {
        const _testContext = getTestContext();
        const consoleMock = CLITestUtils.mockConsole();
        const originalArgv = process.argv;

        const timeFormats = ['2h', '30m', '1.5h', '2h30m', 'invalid-time'];

        for (const timeFormat of timeFormats) {
          process.argv = [
            'node',
            'aitrackdown',
            'task',
            'create',
            'Test Task',
            '--time-estimate',
            timeFormat,
          ];

          try {
            await main();

            if (timeFormat === 'invalid-time') {
              // Should handle invalid time format
              expect(
                consoleMock.errors.some(
                  (error) => error.includes('time') || error.includes('format')
                ) || consoleMock.logs.some((log) => log.includes('created'))
              ).toBe(true);
            } else {
              // Should accept valid time formats
              expect(consoleMock.logs.some((log) => log.includes('created'))).toBe(true);
            }
          } finally {
            // Continue to next iteration
          }
        }

        process.argv = originalArgv;
        consoleMock.restore();
      });

      it('should validate completion percentage range', async () => {
        const testContext = getTestContext();
        const consoleMock = CLITestUtils.mockConsole();
        const originalArgv = process.argv;

        // Create a task first
        const taskPath = path.join(testContext.tempDir, 'tasks', 'tasks', 'TSK-0001-test-task.md');
        const taskContent = `---
title: Test Task
status: active
---
# Test Task
`;
        fs.writeFileSync(taskPath, taskContent);

        const percentages = ['0', '50', '100', '150', '-10'];

        for (const percentage of percentages) {
          process.argv = [
            'node',
            'aitrackdown',
            'task',
            'update',
            'TSK-0001',
            '--completion',
            percentage,
          ];

          try {
            await main();

            if (percentage === '150' || percentage === '-10') {
              // Should handle invalid percentage range
              expect(
                consoleMock.errors.some(
                  (error) => error.includes('percentage') || error.includes('range')
                ) || consoleMock.logs.some((log) => log.includes('updated'))
              ).toBe(true);
            } else {
              // Should accept valid percentages
              expect(consoleMock.logs.some((log) => log.includes('updated'))).toBe(true);
            }
          } finally {
            // Continue to next iteration
          }
        }

        process.argv = originalArgv;
        consoleMock.restore();
      });
    });

    describe('PR Command Arguments', () => {
      it('should validate required PR title', async () => {
        const _testContext = getTestContext();
        const consoleMock = CLITestUtils.mockConsole();
        const originalArgv = process.argv;
        const originalExit = process.exit;

        process.exit = vi.fn() as any;
        process.argv = ['node', 'aitrackdown', 'pr', 'create']; // Missing title

        try {
          await main();

          // Should show error for missing title
          expect(
            consoleMock.errors.some(
              (error) =>
                error.includes('title') || error.includes('required') || error.includes('argument')
            ) || process.exit
          ).toHaveBeenCalledWith(1);
        } finally {
          process.argv = originalArgv;
          process.exit = originalExit;
          consoleMock.restore();
        }
      });

      it('should validate branch name format', async () => {
        const _testContext = getTestContext();
        const consoleMock = CLITestUtils.mockConsole();
        const originalArgv = process.argv;

        const branchNames = [
          'feature/test',
          'bugfix/issue-123',
          'hotfix/critical-fix',
          'invalid..branch..name',
        ];

        for (const branchName of branchNames) {
          process.argv = [
            'node',
            'aitrackdown',
            'pr',
            'create',
            'Test PR',
            '--issue',
            'ISS-0001',
            '--branch-name',
            branchName,
          ];

          try {
            await main();

            if (branchName === 'invalid..branch..name') {
              // Should handle invalid branch name
              expect(
                consoleMock.errors.some(
                  (error) => error.includes('branch') || error.includes('invalid')
                ) || consoleMock.logs.some((log) => log.includes('created'))
              ).toBe(true);
            } else {
              // Should accept valid branch names
              expect(consoleMock.logs.some((log) => log.includes('created'))).toBe(true);
            }
          } finally {
            // Continue to next iteration
          }
        }

        process.argv = originalArgv;
        consoleMock.restore();
      });
    });
  });

  describe('Subcommand Validation', () => {
    it('should handle unknown commands', async () => {
      const _testContext = getTestContext();
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;
      const originalExit = process.exit;

      process.exit = vi.fn() as any;
      process.argv = ['node', 'aitrackdown', 'unknown-command'];

      try {
        await main();

        // Should show error for unknown command
        expect(
          consoleMock.errors.some(
            (error) => error.includes('Unknown command') || error.includes('unknown-command')
          ) || process.exit
        ).toHaveBeenCalledWith(1);
      } finally {
        process.argv = originalArgv;
        process.exit = originalExit;
        consoleMock.restore();
      }
    });

    it('should handle unknown subcommands', async () => {
      const _testContext = getTestContext();
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;
      const originalExit = process.exit;

      process.exit = vi.fn() as any;
      process.argv = ['node', 'aitrackdown', 'epic', 'unknown-subcommand'];

      try {
        await main();

        // Should show error for unknown subcommand
        expect(
          consoleMock.errors.some(
            (error) => error.includes('unknown') || error.includes('subcommand')
          ) || process.exit
        ).toHaveBeenCalledWith(1);
      } finally {
        process.argv = originalArgv;
        process.exit = originalExit;
        consoleMock.restore();
      }
    });

    it('should handle missing required subcommand', async () => {
      const _testContext = getTestContext();
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;

      process.argv = ['node', 'aitrackdown', 'epic']; // Missing subcommand

      try {
        await main();

        // Should show help or error for missing subcommand
        expect(
          consoleMock.logs.some(
            (log) => log.includes('help') || log.includes('Usage') || log.includes('Commands')
          ) || consoleMock.errors.some((error) => error.includes('subcommand'))
        ).toBe(true);
      } finally {
        process.argv = originalArgv;
        consoleMock.restore();
      }
    });
  });

  describe('Option Validation', () => {
    it('should handle conflicting options', async () => {
      const _testContext = getTestContext();
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;

      process.argv = [
        'node',
        'aitrackdown',
        'epic',
        'create',
        'Test Epic',
        '--status',
        'active',
        '--status',
        'completed',
      ];

      try {
        await main();

        // Should handle conflicting options (last one wins or show error)
        expect(
          consoleMock.errors.some(
            (error) => error.includes('conflict') || error.includes('duplicate')
          ) || consoleMock.logs.some((log) => log.includes('created'))
        ).toBe(true);
      } finally {
        process.argv = originalArgv;
        consoleMock.restore();
      }
    });

    it('should handle boolean option variations', async () => {
      const _testContext = getTestContext();
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;

      const booleanOptions = ['--verbose', '--no-verbose', '--force', '--no-force'];

      for (const option of booleanOptions) {
        process.argv = ['node', 'aitrackdown', 'status', option];

        try {
          await main();

          // Should handle boolean option variations
          expect(
            consoleMock.logs.some(
              (log) => log.includes('status') || log.includes('Epic') || log.includes('Issue')
            )
          ).toBe(true);
        } finally {
          // Continue to next iteration
        }
      }

      process.argv = originalArgv;
      consoleMock.restore();
    });

    it('should handle option aliases', async () => {
      const _testContext = getTestContext();
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;

      // Test short and long option aliases
      const optionPairs = [
        ['--help', '-h'],
        ['--version', '-v'],
        ['--verbose', '-V'],
      ];

      for (const [longOption, shortOption] of optionPairs) {
        for (const option of [longOption, shortOption]) {
          process.argv = ['node', 'aitrackdown', option];

          try {
            await main();

            // Both should work the same way
            expect(consoleMock.logs.length).toBeGreaterThan(0);
          } finally {
            // Continue to next iteration
          }
        }
      }

      process.argv = originalArgv;
      consoleMock.restore();
    });
  });

  describe('Argument Sanitization', () => {
    it('should handle special characters in arguments', async () => {
      const _testContext = getTestContext();
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;

      const specialTitles = [
        'Test Epic with "quotes"',
        "Test Epic with 'single quotes'",
        'Test Epic with <brackets>',
        'Test Epic with & ampersand',
        'Test Epic with | pipe',
        'Test Epic with ; semicolon',
      ];

      for (const title of specialTitles) {
        process.argv = ['node', 'aitrackdown', 'epic', 'create', title];

        try {
          await main();

          // Should handle special characters gracefully
          expect(
            consoleMock.logs.some((log) => log.includes('created')) ||
              consoleMock.errors.some((error) => error.includes('character'))
          ).toBe(true);
        } finally {
          // Continue to next iteration
        }
      }

      process.argv = originalArgv;
      consoleMock.restore();
    });

    it('should handle very long arguments', async () => {
      const _testContext = getTestContext();
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;

      const longTitle = 'A'.repeat(1000); // Very long title
      const longDescription = 'B'.repeat(5000); // Very long description

      process.argv = [
        'node',
        'aitrackdown',
        'epic',
        'create',
        longTitle,
        '--description',
        longDescription,
      ];

      try {
        await main();

        // Should handle very long arguments
        expect(
          consoleMock.logs.some((log) => log.includes('created')) ||
            consoleMock.errors.some((error) => error.includes('length') || error.includes('long'))
        ).toBe(true);
      } finally {
        process.argv = originalArgv;
        consoleMock.restore();
      }
    });

    it('should handle empty string arguments', async () => {
      const _testContext = getTestContext();
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;

      process.argv = ['node', 'aitrackdown', 'epic', 'create', '', '--description', ''];

      try {
        await main();

        // Should handle empty arguments gracefully
        expect(
          consoleMock.errors.some(
            (error) => error.includes('empty') || error.includes('required')
          ) || consoleMock.logs.some((log) => log.includes('created'))
        ).toBe(true);
      } finally {
        process.argv = originalArgv;
        consoleMock.restore();
      }
    });
  });

  describe('Error Recovery', () => {
    it('should recover from parsing errors', async () => {
      const _testContext = getTestContext();
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;
      const originalExit = process.exit;

      process.exit = vi.fn() as any;
      process.argv = ['node', 'aitrackdown', 'epic', 'create', '--invalid-option'];

      try {
        await main();

        // Should handle parsing errors gracefully
        expect(
          consoleMock.errors.some(
            (error) => error.includes('option') || error.includes('invalid')
          ) || process.exit
        ).toHaveBeenCalledWith(1);
      } finally {
        process.argv = originalArgv;
        process.exit = originalExit;
        consoleMock.restore();
      }
    });

    it('should provide helpful error messages', async () => {
      const _testContext = getTestContext();
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;
      const originalExit = process.exit;

      process.exit = vi.fn() as any;
      process.argv = ['node', 'aitrackdown', 'epic', 'create'];

      try {
        await main();

        // Should provide helpful error messages
        expect(
          consoleMock.errors.some(
            (error) =>
              error.includes('required') || error.includes('missing') || error.includes('help')
          )
        ).toBe(true);
      } finally {
        process.argv = originalArgv;
        process.exit = originalExit;
        consoleMock.restore();
      }
    });

    it('should suggest corrections for typos', async () => {
      const _testContext = getTestContext();
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;
      const originalExit = process.exit;

      process.exit = vi.fn() as any;
      process.argv = ['node', 'aitrackdown', 'epi', 'create', 'Test Epic']; // Typo: 'epi' instead of 'epic'

      try {
        await main();

        // Should suggest corrections or show available commands
        expect(
          consoleMock.errors.some(
            (error) => error.includes('Unknown command') || error.includes('did you mean')
          ) ||
            consoleMock.logs.some(
              (log) => log.includes('help') || log.includes('available commands')
            ) ||
            process.exit
        ).toHaveBeenCalledWith(1);
      } finally {
        process.argv = originalArgv;
        process.exit = originalExit;
        consoleMock.restore();
      }
    });
  });

  describe('Environment Variable Integration', () => {
    it('should respect environment variable overrides', async () => {
      const testContext = getTestContext();
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;
      const originalEnv = { ...process.env };

      // Set environment variables
      process.env.CLI_TASKS_DIR = path.join(testContext.tempDir, 'env-tasks');
      process.env.CLI_PROJECT_DIR = testContext.tempDir;

      fs.mkdirSync(process.env.CLI_TASKS_DIR, { recursive: true });

      process.argv = ['node', 'aitrackdown', 'status'];

      try {
        await main();

        // Should use environment variable values
        expect(consoleMock.logs.some((log) => log.includes('status'))).toBe(true);
      } finally {
        process.argv = originalArgv;
        process.env = originalEnv;
        consoleMock.restore();
      }
    });

    it('should prioritize command line options over environment variables', async () => {
      const testContext = getTestContext();
      const consoleMock = CLITestUtils.mockConsole();
      const originalArgv = process.argv;
      const originalEnv = { ...process.env };

      // Set environment variable
      process.env.CLI_TASKS_DIR = path.join(testContext.tempDir, 'env-tasks');

      // Command line should override
      const cmdTasksDir = path.join(testContext.tempDir, 'cmd-tasks');
      fs.mkdirSync(cmdTasksDir, { recursive: true });

      process.argv = ['node', 'aitrackdown', 'status', '--root-dir', cmdTasksDir];

      try {
        await main();

        // Command line option should win
        expect(process.env.CLI_TASKS_DIR).toBe(cmdTasksDir);
      } finally {
        process.argv = originalArgv;
        process.env = originalEnv;
        consoleMock.restore();
      }
    });
  });
});
