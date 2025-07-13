/**
 * Enhanced CLI Test Runner for robust command testing
 * Handles process.exit mocking and command isolation
 */

import { type MockedFunction, vi } from 'vitest';
import { main } from '../../src/index.js';

export interface CLITestResult {
  stdout: string;
  stderr: string;
  success: boolean;
  exitCode: number;
  executionTime: number;
}

export interface CLIRunnerOptions {
  timeout?: number;
  mockProcessExit?: boolean;
  isolateEnvironment?: boolean;
  captureConsole?: boolean;
  workingDirectory?: string;
}

export class CLITestRunner {
  private static instance: CLITestRunner;
  private originalProcessExit: typeof process.exit;
  private originalConsole: typeof console;
  private activeMocks: Set<string> = new Set();
  private activeConsoleSpies: MockedFunction<any>[] = [];

  constructor() {
    this.originalProcessExit = process.exit;
    this.originalConsole = { ...console };
  }

  static getInstance(): CLITestRunner {
    if (!CLITestRunner.instance) {
      CLITestRunner.instance = new CLITestRunner();
    }
    return CLITestRunner.instance;
  }

  static resetInstance(): void {
    if (CLITestRunner.instance) {
      CLITestRunner.instance.cleanup();
      CLITestRunner.instance = undefined as any;
    }
  }

  /**
   * Execute CLI command with proper isolation and mocking
   */
  async runCommand(args: string[], options: CLIRunnerOptions = {}): Promise<CLITestResult> {
    const {
      timeout = 5000, // Reduced default timeout for faster tests
      mockProcessExit = true,
      isolateEnvironment = true,
      captureConsole = true,
      workingDirectory,
    } = options;

    const startTime = Date.now();
    let exitCode = 0;
    let _processExitCalled = false;

    // Store original state
    const originalArgv = process.argv;
    const originalCwd = process.cwd();
    const originalEnv = { ...process.env };
    const originalNodePath = process.env.NODE_PATH;
    const originalPath = process.env.PATH;

    // Prepare console capture
    const logs: string[] = [];
    const errors: string[] = [];
    const warns: string[] = [];

    // Mock process.exit to prevent actual termination
    let exitMock: MockedFunction<typeof process.exit>;
    if (mockProcessExit) {
      exitMock = vi.fn((code: number = 0) => {
        exitCode = code;
        _processExitCalled = true;
        // Throw error to break execution flow without actually exiting
        throw new Error(`MOCK_PROCESS_EXIT:${code}`);
      }) as any;
      process.exit = exitMock;
      this.activeMocks.add('process.exit');
    }

    // Mock console for output capture
    if (captureConsole) {
      // Clear any existing console spies to prevent accumulation
      this.clearConsoleSpies();

      const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: any[]) => {
        logs.push(args.map((arg) => String(arg)).join(' '));
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: any[]) => {
        errors.push(args.map((arg) => String(arg)).join(' '));
      });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
        warns.push(args.map((arg) => String(arg)).join(' '));
      });
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
        logs.push(String(chunk));
        return true;
      });
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
        errors.push(String(chunk));
        return true;
      });

      // Track spies for proper cleanup
      this.activeConsoleSpies.push(logSpy, errorSpy, warnSpy, stdoutSpy, stderrSpy);
      this.activeMocks.add('console');
    }

    // Set up environment isolation
    if (isolateEnvironment) {
      // Clear CLI-specific environment variables to prevent interference
      delete process.env.CLI_TASKS_DIR;
      delete process.env.CLI_PROJECT_DIR;
      delete process.env.AITRACKDOWN_TASKS_DIR;

      // Set test mode flags for performance optimization
      process.env.AI_TRACKDOWN_TEST_MODE = 'true';
      process.env.AI_TRACKDOWN_DISABLE_INDEX = 'true';
      process.env.AI_TRACKDOWN_MOCK_INDEX = 'true';

      // Ensure NODE environment variables are preserved for subprocess execution
      if (originalNodePath) {
        process.env.NODE_PATH = originalNodePath;
      }
      // Preserve PATH to ensure node command is available
      if (originalPath) {
        process.env.PATH = originalPath;
      }
    }

    // Change working directory if specified
    if (workingDirectory) {
      try {
        // Ensure the directory exists before changing to it
        if (!require('node:fs').existsSync(workingDirectory)) {
          require('node:fs').mkdirSync(workingDirectory, { recursive: true });
        }
        process.chdir(workingDirectory);
      } catch (error) {
        console.error(`Failed to change to working directory: ${workingDirectory}`, error);
        // Return error result instead of continuing
        return {
          stdout: '',
          stderr: `Failed to change working directory: ${error instanceof Error ? error.message : String(error)}`,
          success: false,
          exitCode: 1,
          executionTime: Date.now() - startTime,
        };
      }
    }

    // Set up command arguments
    process.argv = ['node', 'aitrackdown', ...args];

    try {
      // Execute with timeout
      const executionPromise = main();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Command timeout')), timeout);
      });

      await Promise.race([executionPromise, timeoutPromise]);

      // If we reach here, command completed successfully
      return {
        stdout: logs.join('\n'),
        stderr: errors.join('\n'),
        success: true,
        exitCode: 0,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle mock process exit (not a real error)
      if (errorMessage.startsWith('MOCK_PROCESS_EXIT:')) {
        const exitCodeFromError = parseInt(errorMessage.split(':')[1], 10);
        return {
          stdout: logs.join('\n'),
          stderr: errors.join('\n'),
          success: exitCodeFromError === 0,
          exitCode: exitCodeFromError,
          executionTime: Date.now() - startTime,
        };
      }

      // Handle directory/path errors specifically
      if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file or directory')) {
        return {
          stdout: logs.join('\n'),
          stderr: errors.concat([`Directory/Path Error: ${errorMessage}`]).join('\n'),
          success: false,
          exitCode: 2, // ENOENT exit code
          executionTime: Date.now() - startTime,
        };
      }

      // Handle timeout
      if (errorMessage.includes('timeout')) {
        return {
          stdout: logs.join('\n'),
          stderr: errors.concat(['Command timed out']).join('\n'),
          success: false,
          exitCode: 124, // Standard timeout exit code
          executionTime: Date.now() - startTime,
        };
      }

      // Handle other errors
      return {
        stdout: logs.join('\n'),
        stderr: errors.concat([errorMessage]).join('\n'),
        success: false,
        exitCode: exitCode || 1,
        executionTime: Date.now() - startTime,
      };
    } finally {
      // Restore original state
      try {
        process.argv = originalArgv;

        // Safely restore working directory
        if (require('node:fs').existsSync(originalCwd)) {
          process.chdir(originalCwd);
        } else {
          // If original directory was deleted, go to a safe directory
          process.chdir(require('node:os').homedir());
        }

        if (isolateEnvironment) {
          process.env = originalEnv;
        }
      } catch (error) {
        console.warn('Failed to restore test environment state:', error);
      }

      // Restore mocks
      this.restoreMocks();
    }
  }

  /**
   * Clear console spies to prevent accumulation
   */
  private clearConsoleSpies(): void {
    for (const spy of this.activeConsoleSpies) {
      try {
        spy.mockRestore();
      } catch (_error) {
        // Spy might already be restored, ignore error
      }
    }
    this.activeConsoleSpies.length = 0;
  }

  /**
   * Restore all active mocks
   */
  private restoreMocks(): void {
    if (this.activeMocks.has('process.exit')) {
      process.exit = this.originalProcessExit;
      this.activeMocks.delete('process.exit');
    }

    if (this.activeMocks.has('console')) {
      this.clearConsoleSpies();
      vi.restoreAllMocks();
      this.activeMocks.delete('console');
    }
  }

  /**
   * Run multiple commands in sequence with shared context
   */
  async runCommandSequence(
    commands: { args: string[]; description?: string }[],
    options: CLIRunnerOptions = {}
  ): Promise<CLITestResult[]> {
    const results: CLITestResult[] = [];

    for (const command of commands) {
      console.log(`Executing: ${command.description || command.args.join(' ')}`);
      const result = await this.runCommand(command.args, options);
      results.push(result);

      // Stop on first failure if desired
      if (!result.success && options.timeout) {
        break;
      }
    }

    return results;
  }

  /**
   * Test command with various argument combinations
   */
  async testCommandVariations(
    baseCommand: string[],
    argumentVariations: { [key: string]: string[] },
    options: CLIRunnerOptions = {}
  ): Promise<{ [variation: string]: CLITestResult }> {
    const results: { [variation: string]: CLITestResult } = {};

    for (const [variationName, args] of Object.entries(argumentVariations)) {
      const fullCommand = [...baseCommand, ...args];
      console.log(`Testing variation: ${variationName} - ${fullCommand.join(' ')}`);
      results[variationName] = await this.runCommand(fullCommand, options);
    }

    return results;
  }

  /**
   * Clean up any remaining resources and prevent memory leaks
   */
  cleanup(): void {
    this.restoreMocks();
    this.clearConsoleSpies();
    this.activeMocks.clear();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
}

/**
 * Convenience function for single command execution
 */
export async function runCLICommand(
  args: string[],
  options: CLIRunnerOptions = {}
): Promise<CLITestResult> {
  const runner = CLITestRunner.getInstance();
  return runner.runCommand(args, options);
}

/**
 * Enhanced assertions for CLI testing
 */
export class CLIAssertions {
  static assertSuccess(result: CLITestResult, message?: string): void {
    if (!result.success) {
      const error = message || `Command failed with exit code ${result.exitCode}`;
      throw new Error(`${error}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    }
  }

  static assertFailure(result: CLITestResult, expectedExitCode?: number): void {
    if (result.success) {
      throw new Error(`Expected command to fail but it succeeded\nstdout: ${result.stdout}`);
    }

    if (expectedExitCode !== undefined && result.exitCode !== expectedExitCode) {
      throw new Error(`Expected exit code ${expectedExitCode}, got ${result.exitCode}`);
    }
  }

  static assertOutputContains(
    result: CLITestResult,
    text: string,
    searchIn: 'stdout' | 'stderr' | 'both' = 'both'
  ): void {
    const searchText = text.toLowerCase();
    const stdout = result.stdout.toLowerCase();
    const stderr = result.stderr.toLowerCase();

    let found = false;
    if (searchIn === 'stdout' || searchIn === 'both') {
      found = found || stdout.includes(searchText);
    }
    if (searchIn === 'stderr' || searchIn === 'both') {
      found = found || stderr.includes(searchText);
    }

    if (!found) {
      throw new Error(
        `Expected output to contain: "${text}"\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
      );
    }
  }

  static assertOutputDoesNotContain(result: CLITestResult, text: string): void {
    const searchText = text.toLowerCase();
    const stdout = result.stdout.toLowerCase();
    const stderr = result.stderr.toLowerCase();

    if (stdout.includes(searchText) || stderr.includes(searchText)) {
      throw new Error(
        `Expected output to NOT contain: "${text}"\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
      );
    }
  }

  static assertExecutionTime(result: CLITestResult, maxTimeMs: number): void {
    if (result.executionTime > maxTimeMs) {
      throw new Error(`Command took too long: ${result.executionTime}ms (max: ${maxTimeMs}ms)`);
    }
  }

  static assertValidOption(result: CLITestResult, option: string): void {
    if (!result.success && result.stderr.includes(`unknown option '${option}'`)) {
      throw new Error(`Option '${option}' is not recognized by the command`);
    }
  }
}

/**
 * Mock configurations for common testing scenarios
 */
export const CLITestConfigs = {
  // Fast configuration for unit tests
  fast: {
    timeout: 2000,
    mockProcessExit: true,
    isolateEnvironment: true,
    captureConsole: true,
  } as CLIRunnerOptions,

  // Default configuration for most tests
  standard: {
    timeout: 5000,
    mockProcessExit: true,
    isolateEnvironment: true,
    captureConsole: true,
  } as CLIRunnerOptions,

  // Configuration for performance testing
  performance: {
    timeout: 10000,
    mockProcessExit: true,
    isolateEnvironment: true,
    captureConsole: false,
  } as CLIRunnerOptions,

  // Configuration for integration testing
  integration: {
    timeout: 15000,
    mockProcessExit: true,
    isolateEnvironment: false,
    captureConsole: true,
  } as CLIRunnerOptions,

  // Configuration for error testing
  errorTesting: {
    timeout: 3000,
    mockProcessExit: true,
    isolateEnvironment: true,
    captureConsole: true,
  } as CLIRunnerOptions,
};
