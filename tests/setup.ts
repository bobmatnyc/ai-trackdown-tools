/**
 * Global test setup for AI-Trackdown Tools
 * Optimizes test infrastructure and prevents index rebuilding
 */

import { vi } from 'vitest';

// Store original functions for cleanup
let originalProcessExit: typeof process.exit;
let originalConsoleLog: typeof console.log;
let originalConsoleWarn: typeof console.warn;

// Global test environment setup
beforeAll(() => {
  // Store original functions
  originalProcessExit = process.exit;
  originalConsoleLog = console.log;
  originalConsoleWarn = console.warn;

  // Set test mode environment variables
  process.env.NODE_ENV = 'test';
  process.env.AI_TRACKDOWN_TEST_MODE = 'true';
  process.env.AI_TRACKDOWN_DISABLE_INDEX = 'true';
  process.env.AI_TRACKDOWN_MOCK_INDEX = 'true';

  // Preserve critical environment variables for subprocess execution
  if (process.env.PATH) {
    process.env.TEST_ORIGINAL_PATH = process.env.PATH;
  }
  if (process.env.NODE_PATH) {
    process.env.TEST_ORIGINAL_NODE_PATH = process.env.NODE_PATH;
  }

  // Mock process.exit to capture exit calls and log them
  process.exit = vi.fn((code: number = 0) => {
    const error = new Error();
    console.error(`PROCESS_EXIT_CALLED: exit(${code}) from:`);
    console.error(error.stack);
    throw new Error(`MOCK_PROCESS_EXIT:${code}`);
  }) as any;

  // Mock Git operations to prevent shell command issues
  const { execSync: originalExecSync } = require('node:child_process');
  require('node:child_process').execSync = function (command: string, options?: any) {
    // Mock Git commands to prevent shell issues
    if (command.includes('git')) {
      if (command.includes('rev-parse --git-dir')) {
        return '.git';
      }
      if (command.includes('status --porcelain')) {
        return '';
      }
      if (command.includes('branch --show-current')) {
        return 'main';
      }
      if (command.includes('remote get-url origin')) {
        return 'https://github.com/test/repo.git';
      }
      // Default empty response for other git commands
      return '';
    }

    try {
      return originalExecSync.call(this, command, options);
    } catch (error: any) {
      if (error.message?.includes('unknown command') || error.status === 127) {
        console.warn(`MOCK: execSync failed with unknown command: ${command}`);
        throw error;
      }
      throw error;
    }
  };

  // Suppress index-related console output
  vi.spyOn(console, 'log').mockImplementation((...args) => {
    const message = args.join(' ');
    if (
      message.includes('🔄 Rebuilding') ||
      message.includes('Index file not found') ||
      message.includes('using high-performance index') ||
      message.includes('high-performance index system') ||
      message.includes('🔍 Detecting project structure') ||
      message.includes('📋 Project Mode') ||
      message.includes('📁 Detected Projects') ||
      message.includes('📂 Projects Directory') ||
      message.includes('⚠️  Migration may be needed') ||
      message.includes('💡 Recommendations available') ||
      message.includes('✅ Index rebuilt successfully') ||
      message.includes('📊 Indexed:')
    ) {
      return; // Suppress these messages
    }
    originalConsoleLog(...args);
  });

  vi.spyOn(console, 'warn').mockImplementation((...args) => {
    const message = args.join(' ');
    if (
      message.includes('Index file not found') ||
      message.includes('Rebuilding...') ||
      message.includes('⚠️ Slow')
    ) {
      return; // Suppress these warnings
    }
    originalConsoleWarn(...args);
  });
});

// Global cleanup
afterAll(() => {
  // Restore original functions
  if (originalProcessExit) {
    process.exit = originalProcessExit;
  }
  if (originalConsoleLog) {
    console.log = originalConsoleLog;
  }
  if (originalConsoleWarn) {
    console.warn = originalConsoleWarn;
  }

  // Restore environment variables
  if (process.env.TEST_ORIGINAL_PATH) {
    process.env.PATH = process.env.TEST_ORIGINAL_PATH;
    delete process.env.TEST_ORIGINAL_PATH;
  }
  if (process.env.TEST_ORIGINAL_NODE_PATH) {
    process.env.NODE_PATH = process.env.TEST_ORIGINAL_NODE_PATH;
    delete process.env.TEST_ORIGINAL_NODE_PATH;
  }

  // Restore console methods
  vi.restoreAllMocks();

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Ensure garbage collection is available for tests
declare global {
  var gc: (() => void) | undefined;
}
