import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.git'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        'vitest.config.ts',
        'turbo.json',
        'biome.json',
        '**/*.d.ts',
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
    testTimeout: 15000, // Increased for index optimization
    hookTimeout: 10000,
    // Memory management and isolation settings
    pool: 'forks',
    isolate: true,
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: true,
        execArgv: ['--expose-gc', '--max-old-space-size=4096'],
      },
    },
    maxConcurrency: 1, // Further reduced for stability and isolation
    // Environment setup for memory debugging and test optimization
    env: {
      NODE_ENV: 'test',
      NODE_OPTIONS: '--max-old-space-size=4096 --expose-gc',
      AI_TRACKDOWN_TEST_MODE: 'true',
      AI_TRACKDOWN_DISABLE_INDEX: 'true',
      AI_TRACKDOWN_MOCK_INDEX: 'true',
      // Ensure subprocess commands can find node
      PATH: process.env.PATH,
      NODE_PATH: process.env.NODE_PATH || '',
    },
    // Global setup for test infrastructure
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
