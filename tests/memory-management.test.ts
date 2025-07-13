import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCLICommand } from './utils/cli-test-runner.js';
import { preventEventEmitterLeaks, withMemoryTracking } from './utils/memory-test-utils.js';
import { setupTestEnvironment } from './utils/test-helpers.js';

describe('Memory Management Validation', () => {
  const getTestContext = setupTestEnvironment();
  let restoreMemoryEnvironment: () => void;

  beforeEach(() => {
    restoreMemoryEnvironment = preventEventEmitterLeaks();
  });

  afterEach(() => {
    if (restoreMemoryEnvironment) {
      restoreMemoryEnvironment();
    }
  });

  it('should not leak memory during CLI test execution', async () => {
    await withMemoryTracking(
      async (memoryManager) => {
        const _testContext = getTestContext();

        // Take initial snapshot
        memoryManager.takeInitialSnapshot();

        // Run multiple CLI commands to test memory stability
        for (let i = 0; i < 5; i++) {
          const result = await runCLICommand(['--help'], {
            timeout: 5000,
            isolateEnvironment: true,
            captureConsole: true,
          });

          expect(result.success).toBe(true);

          // Take snapshot after each command
          memoryManager.takeSnapshot();

          // Force garbage collection
          if (global.gc) {
            global.gc();
          }
        }

        // Memory check will be performed automatically by withMemoryTracking
      },
      {
        maxHeapGrowthMB: 50, // Allow 50MB growth for CLI operations
        enableGC: true,
        trackLeaks: true,
        logMemoryUsage: true,
      }
    );
  });

  it('should properly clean up test data managers', async () => {
    await withMemoryTracking(
      async (memoryManager) => {
        const { TestDataManager } = await import('./e2e-integration/test-data-manager.js');

        memoryManager.takeInitialSnapshot();

        // Create and cleanup multiple test data managers
        for (let i = 0; i < 3; i++) {
          const testDataManager = new TestDataManager();
          const projectData = testDataManager.createMinimalTestData();

          // Create test project
          await testDataManager.createTestProject(projectData);

          // Take snapshot
          memoryManager.takeSnapshot();

          // Cleanup
          testDataManager.cleanup();

          // Force garbage collection
          if (global.gc) {
            global.gc();
          }
        }
      },
      {
        maxHeapGrowthMB: 30, // Allow 30MB growth for test data operations
        enableGC: true,
        trackLeaks: true,
      }
    );
  });

  it('should prevent EventEmitter memory leaks', async () => {
    // Check initial EventEmitter listeners
    const initialListeners = process.listenerCount('uncaughtException');

    // Simulate multiple test runs
    for (let i = 0; i < 10; i++) {
      // Each iteration simulates a test setup/teardown cycle
      preventEventEmitterLeaks();

      const currentListeners = process.listenerCount('uncaughtException');

      // Should not accumulate listeners
      expect(currentListeners).toBeLessThanOrEqual(initialListeners + 1);
    }
  });

  it('should manage console mocks without accumulation', async () => {
    const { CLITestRunner } = await import('./utils/cli-test-runner.js');

    await withMemoryTracking(
      async (memoryManager) => {
        memoryManager.takeInitialSnapshot();

        // Create and cleanup multiple CLI test runner instances
        for (let i = 0; i < 5; i++) {
          const runner = CLITestRunner.getInstance();

          // Run a command with console mocking
          await runner.runCommand(['--version'], {
            captureConsole: true,
            mockProcessExit: true,
            isolateEnvironment: true,
          });

          memoryManager.takeSnapshot();

          // Reset instance to test cleanup
          CLITestRunner.resetInstance();

          if (global.gc) {
            global.gc();
          }
        }
      },
      {
        maxHeapGrowthMB: 25,
        enableGC: true,
        trackLeaks: true,
      }
    );
  });

  it('should handle large data sets without memory explosion', async () => {
    await withMemoryTracking(
      async (memoryManager) => {
        const { TestDataManager } = await import('./e2e-integration/test-data-manager.js');

        memoryManager.takeInitialSnapshot();

        const testDataManager = new TestDataManager();

        // Register cleanup handler
        memoryManager.registerCleanupHandler(() => {
          testDataManager.cleanup();
        });

        // Create comprehensive test data
        const projectData = testDataManager.createComprehensiveTestData();

        // Expand the dataset significantly
        for (let i = 4; i <= 10; i++) {
          projectData.tickets.epics.push({
            id: `EP-${String(i).padStart(4, '0')}`,
            title: `Large Scale Epic ${i}`,
            description: `Epic ${i} for large scale testing with lots of content that simulates real-world usage patterns`,
            priority: 'medium',
            assignee: `team-${i % 5}`,
            estimatedTokens: 1000 + i * 100,
          });
        }

        // Create project with large dataset
        await testDataManager.createTestProject(projectData);

        memoryManager.takeSnapshot();

        // Simulate some operations
        for (let i = 0; i < 3; i++) {
          const result = await runCLICommand(['status'], {
            timeout: 10000,
            isolateEnvironment: true,
          });

          expect(result.success).toBe(true);
          memoryManager.takeSnapshot();
        }
      },
      {
        maxHeapGrowthMB: 100, // Allow more growth for large datasets
        enableGC: true,
        trackLeaks: true,
        logMemoryUsage: true,
      }
    );
  });
});
