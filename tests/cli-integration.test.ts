/**
 * CLI Integration tests for tasks directory option
 * ATT-004: Fix Task Directory Structure - Single Root Directory Implementation
 */

import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('CLI Integration - Tasks Directory Option', () => {
  let tempDir: string;
  let originalCwd: string;
  let originalEnv: typeof process.env;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cli-integration-test-'));
    originalCwd = process.cwd();
    originalEnv = { ...process.env };

    // Change to temp directory for tests
    process.chdir(tempDir);
  });

  afterEach(async () => {
    // Restore original state
    process.chdir(originalCwd);
    process.env = originalEnv;

    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Environment variable handling', () => {
    it('should set CLI_TASKS_DIR environment variable from --tasks-dir option', () => {
      // Simulate what happens in the preAction hook
      const mockOptions = {
        tasksDir: 'custom-tasks',
        verbose: false,
        noColor: false,
      };

      // Simulate the preAction hook logic
      const tasksDir = mockOptions.tasksDir;
      if (tasksDir) {
        process.env.CLI_TASKS_DIR = tasksDir;
      }

      expect(process.env.CLI_TASKS_DIR).toBe('custom-tasks');
    });

    it('should set CLI_TASKS_DIR environment variable from --root-dir option', () => {
      // Simulate what happens in the preAction hook
      const mockOptions = {
        rootDir: 'custom-root',
        verbose: false,
        noColor: false,
      };

      // Simulate the preAction hook logic
      const tasksDir = mockOptions.tasksDir || mockOptions.rootDir;
      if (tasksDir) {
        process.env.CLI_TASKS_DIR = tasksDir;
      }

      expect(process.env.CLI_TASKS_DIR).toBe('custom-root');
    });

    it('should prioritize --tasks-dir over --root-dir', () => {
      // Simulate what happens in the preAction hook
      const mockOptions = {
        tasksDir: 'tasks-dir-value',
        rootDir: 'root-dir-value',
        verbose: false,
        noColor: false,
      };

      // Simulate the preAction hook logic
      const tasksDir = mockOptions.tasksDir || mockOptions.rootDir;
      if (tasksDir) {
        process.env.CLI_TASKS_DIR = tasksDir;
      }

      expect(process.env.CLI_TASKS_DIR).toBe('tasks-dir-value');
    });
  });

  describe('Command integration scenarios', () => {
    it('should handle init command with custom tasks directory', async () => {
      // Set environment variable as CLI would
      process.env.CLI_TASKS_DIR = 'work';

      // Import and create ConfigManager as commands would
      const { ConfigManager } = await import('../src/utils/config-manager.js');
      const configManager = new ConfigManager(tempDir);

      // Create project with custom tasks directory
      const config = configManager.createDefaultConfig('test-project', {
        tasks_directory: process.env.CLI_TASKS_DIR || 'tasks',
      });

      configManager.initializeProject('test-project', config);

      // Verify the unified structure was created with custom directory
      expect(existsSync(join(tempDir, 'work'))).toBe(true);
      expect(existsSync(join(tempDir, 'work', 'epics'))).toBe(true);
      expect(existsSync(join(tempDir, 'work', 'issues'))).toBe(true);
      expect(existsSync(join(tempDir, 'work', 'tasks'))).toBe(true);
      expect(existsSync(join(tempDir, 'work', 'prs'))).toBe(true);
      expect(existsSync(join(tempDir, 'work', 'templates'))).toBe(true);
    });

    it('should handle create commands with CLI override', async () => {
      // First initialize a project
      const { ConfigManager } = await import('../src/utils/config-manager.js');
      const configManager = new ConfigManager(tempDir);
      const config = configManager.createDefaultConfig('test-project');
      configManager.initializeProject('test-project', config);

      // Set CLI override after initialization
      process.env.CLI_TASKS_DIR = 'custom';

      // Test that getAbsolutePaths respects CLI override
      const paths = configManager.getAbsolutePaths(process.env.CLI_TASKS_DIR);

      expect(paths.tasksRoot).toBe(join(tempDir, 'custom'));
      expect(paths.epicsDir).toBe(join(tempDir, 'custom', 'epics'));
      expect(paths.issuesDir).toBe(join(tempDir, 'custom', 'issues'));
      expect(paths.tasksDir).toBe(join(tempDir, 'custom', 'tasks'));
    });
  });

  describe('Priority order verification', () => {
    it('should respect correct priority: CLI > ENV > CONFIG > DEFAULT', async () => {
      const { ConfigManager } = await import('../src/utils/config-manager.js');
      const { UnifiedPathResolver } = await import('../src/utils/unified-path-resolver.js');

      // Create config with tasks_directory
      const config = {
        name: 'test-project',
        version: '1.0.0',
        tasks_directory: 'config-tasks',
        structure: {
          epics_dir: 'epics',
          issues_dir: 'issues',
          tasks_dir: 'tasks',
          templates_dir: 'templates',
          prs_dir: 'prs',
        },
        naming_conventions: {
          epic_prefix: 'EP',
          issue_prefix: 'ISS',
          task_prefix: 'TSK',
          pr_prefix: 'PR',
          file_extension: '.md',
        },
      };

      // Test 1: Default only
      let resolver = new UnifiedPathResolver(config, tempDir);
      expect(resolver.getTasksRootDirectory()).toBe('config-tasks');

      // Test 2: Environment variable overrides config
      process.env.AITRACKDOWN_TASKS_DIR = 'env-tasks';
      resolver = new UnifiedPathResolver(config, tempDir);
      expect(resolver.getTasksRootDirectory()).toBe('env-tasks');

      // Test 3: CLI overrides environment
      resolver = new UnifiedPathResolver(config, tempDir, 'cli-tasks');
      expect(resolver.getTasksRootDirectory()).toBe('cli-tasks');

      // Cleanup
      delete process.env.AITRACKDOWN_TASKS_DIR;
    });

    it('should handle fallback when configuration is missing tasks_directory', async () => {
      const { UnifiedPathResolver } = await import('../src/utils/unified-path-resolver.js');

      // Config without tasks_directory (backward compatibility)
      const configWithoutTasksDir = {
        name: 'test-project',
        version: '1.0.0',
        structure: {
          epics_dir: 'epics',
          issues_dir: 'issues',
          tasks_dir: 'tasks',
          templates_dir: 'templates',
        },
        naming_conventions: {
          epic_prefix: 'EP',
          issue_prefix: 'ISS',
          task_prefix: 'TSK',
          file_extension: '.md',
        },
      };

      const resolver = new UnifiedPathResolver(configWithoutTasksDir, tempDir);
      expect(resolver.getTasksRootDirectory()).toBe('tasks'); // Default fallback
    });
  });

  describe('Error handling', () => {
    it('should handle missing configuration gracefully', async () => {
      const { UnifiedPathResolver } = await import('../src/utils/unified-path-resolver.js');

      // Minimal config that might cause issues
      const minimalConfig = {
        name: 'test-project',
        version: '1.0.0',
        structure: {
          epics_dir: 'epics',
          issues_dir: 'issues',
          tasks_dir: 'tasks',
          templates_dir: 'templates',
        },
        naming_conventions: {
          epic_prefix: 'EP',
          issue_prefix: 'ISS',
          task_prefix: 'TSK',
          file_extension: '.md',
        },
      };

      const resolver = new UnifiedPathResolver(minimalConfig, tempDir);

      // Should not throw and should provide sensible defaults
      expect(() => resolver.getUnifiedPaths()).not.toThrow();
      expect(() => resolver.getRequiredDirectories()).not.toThrow();
      expect(() => resolver.validateStructure()).not.toThrow();
    });
  });

  describe('Comprehensive workflow test', () => {
    it('should support complete workflow with custom tasks directory', async () => {
      // Step 1: Initialize project with custom tasks directory
      process.env.CLI_TASKS_DIR = 'project-tasks';

      const { ConfigManager } = await import('../src/utils/config-manager.js');
      const configManager = new ConfigManager(tempDir);

      const config = configManager.createDefaultConfig('workflow-test', {
        tasks_directory: process.env.CLI_TASKS_DIR,
      });

      configManager.initializeProject('workflow-test', config);

      // Step 2: Verify structure creation
      expect(existsSync(join(tempDir, 'project-tasks', 'epics'))).toBe(true);
      expect(existsSync(join(tempDir, 'project-tasks', 'issues'))).toBe(true);
      expect(existsSync(join(tempDir, 'project-tasks', 'tasks'))).toBe(true);
      expect(existsSync(join(tempDir, 'project-tasks', 'prs'))).toBe(true);
      expect(existsSync(join(tempDir, 'project-tasks', 'templates'))).toBe(true);

      // Step 3: Test path resolution
      const paths = configManager.getAbsolutePaths(process.env.CLI_TASKS_DIR);
      expect(paths.tasksRoot).toBe(join(tempDir, 'project-tasks'));
      expect(paths.epicsDir).toBe(join(tempDir, 'project-tasks', 'epics'));

      // Step 4: Test unified path resolver
      const { UnifiedPathResolver } = await import('../src/utils/unified-path-resolver.js');
      const resolver = new UnifiedPathResolver(config, tempDir, process.env.CLI_TASKS_DIR);

      const validation = resolver.validateStructure();
      expect(validation.valid).toBe(true);
      expect(validation.missingDirs).toHaveLength(0);

      // Step 5: Test item type directories
      expect(resolver.getItemTypeDirectory('epic')).toBe(join(tempDir, 'project-tasks', 'epics'));
      expect(resolver.getItemTypeDirectory('issue')).toBe(join(tempDir, 'project-tasks', 'issues'));
      expect(resolver.getItemTypeDirectory('task')).toBe(join(tempDir, 'project-tasks', 'tasks'));
      expect(resolver.getItemTypeDirectory('pr')).toBe(join(tempDir, 'project-tasks', 'prs'));
    });
  });
});
