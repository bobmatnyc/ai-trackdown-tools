/**
 * Memory Management Utilities for Test Environment
 * Provides tools to monitor and control memory usage during testing
 */

import { CLITestRunner } from './cli-test-runner.js';

export interface MemorySnapshot {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
  timestamp: number;
}

export interface MemoryTestConfig {
  maxHeapGrowthMB?: number;
  enableGC?: boolean;
  trackLeaks?: boolean;
  logMemoryUsage?: boolean;
}

export class MemoryTestManager {
  private initialSnapshot: MemorySnapshot | null = null;
  private snapshots: MemorySnapshot[] = [];
  private config: MemoryTestConfig;
  private cleanupHandlers: (() => void)[] = [];

  constructor(config: MemoryTestConfig = {}) {
    this.config = {
      maxHeapGrowthMB: 100,
      enableGC: true,
      trackLeaks: true,
      logMemoryUsage: false,
      ...config,
    };
  }

  /**
   * Take initial memory snapshot before test execution
   */
  takeInitialSnapshot(): MemorySnapshot {
    // Force garbage collection before taking baseline
    if (this.config.enableGC && global.gc) {
      global.gc();
    }

    this.initialSnapshot = this.takeSnapshot();
    return this.initialSnapshot;
  }

  /**
   * Take a memory snapshot at current point
   */
  takeSnapshot(): MemorySnapshot {
    const memoryUsage = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      ...memoryUsage,
      timestamp: Date.now(),
    };

    this.snapshots.push(snapshot);

    if (this.config.logMemoryUsage) {
      console.log(`Memory Snapshot: ${this.formatSnapshot(snapshot)}`);
    }

    return snapshot;
  }

  /**
   * Check for memory leaks and growth
   */
  checkMemoryLeaks(): { hasLeaks: boolean; growth: number; report: string } {
    if (!this.initialSnapshot) {
      throw new Error('No initial snapshot taken. Call takeInitialSnapshot() first.');
    }

    // Force garbage collection before final check
    if (this.config.enableGC && global.gc) {
      global.gc();
    }

    const finalSnapshot = this.takeSnapshot();
    const heapGrowth = finalSnapshot.heapUsed - this.initialSnapshot.heapUsed;
    const heapGrowthMB = heapGrowth / 1024 / 1024;

    const hasLeaks = heapGrowthMB > (this.config.maxHeapGrowthMB || 100);

    const report = this.generateMemoryReport(this.initialSnapshot, finalSnapshot, heapGrowthMB);

    return {
      hasLeaks,
      growth: heapGrowthMB,
      report,
    };
  }

  /**
   * Clean up memory and resources
   */
  cleanup(): void {
    try {
      // Run custom cleanup handlers
      for (const handler of this.cleanupHandlers) {
        try {
          handler();
        } catch (error) {
          console.warn('Memory cleanup handler failed:', error);
        }
      }
      this.cleanupHandlers.length = 0;

      // Reset CLI test runner
      CLITestRunner.resetInstance();

      // Clear all tracked snapshots
      this.snapshots.length = 0;
      this.initialSnapshot = null;

      // Force garbage collection
      if (this.config.enableGC && global.gc) {
        global.gc();
      }
    } catch (error) {
      console.warn('Memory test manager cleanup failed:', error);
    }
  }

  /**
   * Register cleanup handler
   */
  registerCleanupHandler(handler: () => void): void {
    this.cleanupHandlers.push(handler);
  }

  /**
   * Generate detailed memory report
   */
  private generateMemoryReport(
    initial: MemorySnapshot,
    final: MemorySnapshot,
    growthMB: number
  ): string {
    const duration = final.timestamp - initial.timestamp;

    return `
=== Memory Usage Report ===
Duration: ${duration}ms
Initial Heap: ${(initial.heapUsed / 1024 / 1024).toFixed(2)} MB
Final Heap: ${(final.heapUsed / 1024 / 1024).toFixed(2)} MB
Heap Growth: ${growthMB.toFixed(2)} MB
Max Allowed Growth: ${this.config.maxHeapGrowthMB} MB
RSS Growth: ${((final.rss - initial.rss) / 1024 / 1024).toFixed(2)} MB

Peak Heap Usage: ${(Math.max(...this.snapshots.map((s) => s.heapUsed)) / 1024 / 1024).toFixed(2)} MB
Average Heap Usage: ${(this.snapshots.reduce((sum, s) => sum + s.heapUsed, 0) / this.snapshots.length / 1024 / 1024).toFixed(2)} MB

Status: ${growthMB > (this.config.maxHeapGrowthMB || 100) ? '❌ MEMORY LEAK DETECTED' : '✅ MEMORY USAGE OK'}
`;
  }

  /**
   * Format memory snapshot for logging
   */
  private formatSnapshot(snapshot: MemorySnapshot): string {
    return `Heap: ${(snapshot.heapUsed / 1024 / 1024).toFixed(2)}MB, RSS: ${(snapshot.rss / 1024 / 1024).toFixed(2)}MB`;
  }
}

/**
 * Memory test wrapper function for easy integration
 */
export async function withMemoryTracking<T>(
  testFunction: (memoryManager: MemoryTestManager) => Promise<T>,
  config?: MemoryTestConfig
): Promise<T> {
  const memoryManager = new MemoryTestManager(config);

  try {
    memoryManager.takeInitialSnapshot();
    const result = await testFunction(memoryManager);

    const leakCheck = memoryManager.checkMemoryLeaks();
    if (leakCheck.hasLeaks) {
      console.warn(leakCheck.report);
      throw new Error(`Memory leak detected: ${leakCheck.growth.toFixed(2)}MB growth`);
    }

    return result;
  } finally {
    memoryManager.cleanup();
  }
}

/**
 * Utility to prevent EventEmitter memory leaks in tests
 */
export function preventEventEmitterLeaks(): void {
  // Increase EventEmitter max listeners for test environment
  process.setMaxListeners(50);

  // Clear existing listeners before each test
  process.removeAllListeners('uncaughtException');
  process.removeAllListeners('unhandledRejection');
}

/**
 * Force garbage collection with fallback
 */
export function forceGarbageCollection(): void {
  if (global.gc) {
    global.gc();
  } else if (typeof global !== 'undefined' && global.gc) {
    global.gc();
  }
}

/**
 * Memory-safe test environment setup
 */
export function setupMemorySafeEnvironment(): () => void {
  preventEventEmitterLeaks();

  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  // Suppress EventEmitter warnings during tests unless verbose
  if (!process.env.VERBOSE_TESTS) {
    console.error = (...args: any[]) => {
      const message = args.join(' ');
      if (!message.includes('MaxListenersExceededWarning')) {
        originalConsoleError(...args);
      }
    };
  }

  return () => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    forceGarbageCollection();
  };
}
