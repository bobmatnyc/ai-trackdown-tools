/**
 * Test Performance Optimizer
 * Centralizes performance optimizations for test infrastructure
 */

import { vi } from 'vitest';

export class TestPerformanceOptimizer {
  private static instance: TestPerformanceOptimizer;
  private isOptimized = false;
  private originalMethods: Map<string, any> = new Map();

  static getInstance(): TestPerformanceOptimizer {
    if (!TestPerformanceOptimizer.instance) {
      TestPerformanceOptimizer.instance = new TestPerformanceOptimizer();
    }
    return TestPerformanceOptimizer.instance;
  }

  /**
   * Apply comprehensive performance optimizations for tests
   */
  optimize(): void {
    if (this.isOptimized) return;

    // Set environment variables for test mode
    this.setTestModeEnvironment();

    // Mock heavyweight operations
    this.mockIndexOperations();

    // Optimize console output
    this.optimizeConsoleOutput();

    // Optimize file system operations
    this.optimizeFileSystemOps();

    this.isOptimized = true;
  }

  /**
   * Restore original behavior (cleanup)
   */
  restore(): void {
    if (!this.isOptimized) return;

    // Restore all mocked methods
    vi.restoreAllMocks();

    // Restore original methods from our backup
    for (const [key, originalMethod] of this.originalMethods) {
      const [object, methodName] = key.split('.');
      if (object === 'console') {
        (console as any)[methodName] = originalMethod;
      }
    }

    this.originalMethods.clear();
    this.isOptimized = false;
  }

  private setTestModeEnvironment(): void {
    process.env.NODE_ENV = 'test';
    process.env.AI_TRACKDOWN_TEST_MODE = 'true';
    process.env.AI_TRACKDOWN_DISABLE_INDEX = 'true';
    process.env.AI_TRACKDOWN_MOCK_INDEX = 'true';
    process.env.AI_TRACKDOWN_FAST_MODE = 'true';
  }

  private mockIndexOperations(): void {
    // Mock the TrackdownIndexManager to prevent actual index operations
    vi.doMock('../src/utils/trackdown-index-manager.js', () => ({
      TrackdownIndexManager: vi.fn().mockImplementation(() => ({
        loadIndex: vi.fn().mockResolvedValue({
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
          projectPath: process.cwd(),
          projects: {},
          epics: {},
          issues: {},
          tasks: {},
          prs: {},
          stats: {
            totalProjects: 0,
            totalEpics: 0,
            totalIssues: 0,
            totalTasks: 0,
            totalPRs: 0,
            lastFullScan: new Date().toISOString(),
            indexSize: 0,
            performanceMetrics: {
              lastLoadTime: 1,
              lastUpdateTime: 1,
              lastRebuildTime: 0,
            },
          },
        }),
        saveIndex: vi.fn().mockResolvedValue(undefined),
        rebuildIndex: vi.fn().mockResolvedValue({}),
        updateItem: vi.fn().mockResolvedValue(undefined),
        removeItem: vi.fn().mockResolvedValue(undefined),
        validateIndex: vi.fn().mockResolvedValue(true),
        getIndexStats: vi.fn().mockResolvedValue({}),
        clearCache: vi.fn(),
        getItemsByType: vi.fn().mockResolvedValue([]),
        getItemById: vi.fn().mockResolvedValue(null),
        getItemsByStatus: vi.fn().mockResolvedValue([]),
        getProjectOverview: vi.fn().mockResolvedValue({
          totalItems: 0,
          byStatus: {},
          byPriority: {},
          byType: {},
          completionRate: 0,
          recentActivity: [],
        }),
      })),
    }));
  }

  private optimizeConsoleOutput(): void {
    // Store original methods
    this.originalMethods.set('console.log', console.log);
    this.originalMethods.set('console.warn', console.warn);
    this.originalMethods.set('console.error', console.error);

    // Mock console methods to filter out noise
    const filterMessage = (message: string): boolean => {
      return (
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
        message.includes('📊 Indexed:') ||
        message.includes('⚠️ Slow')
      );
    };

    vi.spyOn(console, 'log').mockImplementation((...args) => {
      const message = args.join(' ');
      if (!filterMessage(message)) {
        this.originalMethods.get('console.log')(...args);
      }
    });

    vi.spyOn(console, 'warn').mockImplementation((...args) => {
      const message = args.join(' ');
      if (!filterMessage(message)) {
        this.originalMethods.get('console.warn')(...args);
      }
    });
  }

  private optimizeFileSystemOps(): void {
    // We could mock fs operations here if needed, but for now
    // the index mocking should be sufficient
  }

  /**
   * Get optimized timeouts for different test scenarios
   */
  getOptimizedTimeouts() {
    return {
      unit: 2000, // Unit tests should be fast
      integration: 5000, // Integration tests
      e2e: 10000, // E2E tests
      performance: 15000, // Performance tests
      slow: 30000, // Slow operations
    };
  }

  /**
   * Check if environment is optimized
   */
  isEnvironmentOptimized(): boolean {
    return (
      process.env.AI_TRACKDOWN_TEST_MODE === 'true' &&
      process.env.AI_TRACKDOWN_DISABLE_INDEX === 'true' &&
      process.env.AI_TRACKDOWN_MOCK_INDEX === 'true'
    );
  }
}

// Export singleton instance
export const testOptimizer = TestPerformanceOptimizer.getInstance();

// Export convenience functions
export function optimizeTestEnvironment(): void {
  testOptimizer.optimize();
}

export function restoreTestEnvironment(): void {
  testOptimizer.restore();
}

export function getOptimizedTimeouts() {
  return testOptimizer.getOptimizedTimeouts();
}
