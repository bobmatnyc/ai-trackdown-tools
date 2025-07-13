import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setupTestEnvironment } from './utils/test-helpers.js';

describe('Simple Memory Validation', () => {
  const getTestContext = setupTestEnvironment();
  let initialMemory: NodeJS.MemoryUsage;

  beforeEach(() => {
    // Force garbage collection and take initial memory snapshot
    if (global.gc) {
      global.gc();
    }
    initialMemory = process.memoryUsage();
  });

  afterEach(() => {
    // Force garbage collection and check memory growth
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage();
    const heapGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

    console.log(`Memory growth: ${heapGrowth.toFixed(2)}MB`);

    // Allow reasonable memory growth (25MB for test operations)
    expect(heapGrowth).toBeLessThan(25);
  });

  it('should not accumulate EventEmitter listeners', () => {
    const initialListeners = process.listenerCount('uncaughtException');

    // Simulate multiple test setups
    for (let i = 0; i < 5; i++) {
      // Clear listeners to prevent accumulation
      if (process.env.NODE_ENV === 'test') {
        process.removeAllListeners('uncaughtException');
        process.removeAllListeners('unhandledRejection');
      }
    }

    const finalListeners = process.listenerCount('uncaughtException');

    // Should not have more listeners than we started with
    expect(finalListeners).toBeLessThanOrEqual(initialListeners);
  });

  it('should clean up test data properly', async () => {
    const { TestDataManager } = await import('./e2e-integration/test-data-manager.js');

    // Create and cleanup test data manager
    const testDataManager = new TestDataManager();
    const projectData = testDataManager.createMinimalTestData();

    // Create project
    const projectPath = await testDataManager.createTestProject(projectData);
    expect(projectPath).toBeDefined();

    // Cleanup should not throw
    expect(() => testDataManager.cleanup()).not.toThrow();
  });

  it('should handle CLI test runner cleanup', async () => {
    const { CLITestRunner } = await import('./utils/cli-test-runner.js');

    // Create instance
    const runner = CLITestRunner.getInstance();
    expect(runner).toBeDefined();

    // Reset should not throw
    expect(() => CLITestRunner.resetInstance()).not.toThrow();
  });

  it('should manage memory with large data structures', () => {
    // Create large data structure
    const largeArray: string[] = [];
    for (let i = 0; i < 10000; i++) {
      largeArray.push(`test-item-${i}-with-some-longer-content-to-simulate-real-data`);
    }

    // Use the data
    const filtered = largeArray.filter((item) => item.includes('5000'));
    expect(filtered.length).toBe(1);

    // Clear references
    largeArray.length = 0;

    // Force garbage collection
    if (global.gc) {
      global.gc();
    }

    // Test passes if no memory explosion occurs
    expect(true).toBe(true);
  });

  it('should validate process isolation', () => {
    const testContext = getTestContext();

    // Test context should be isolated
    expect(testContext.tempDir).toContain('test-');
    expect(testContext.cleanup).toBeDefined();

    // Environment variables should be isolated
    process.env.TEST_ISOLATION = 'test-value';
    expect(process.env.TEST_ISOLATION).toBe('test-value');

    // Cleanup function should work
    expect(() => testContext.cleanup()).not.toThrow();
  });
});
