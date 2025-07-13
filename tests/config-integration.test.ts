/**
 * Integration tests for configuration with unified directory structure
 * ATT-004: Fix Task Directory Structure - Single Root Directory Implementation
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProjectConfig } from '../src/types/ai-trackdown.js';
import { ConfigManager } from '../src/utils/config-manager.js';

describe('ConfigManager Integration with Unified Paths', () => {
  let tempDir: string;
  let configManager: ConfigManager;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'config-integration-test-'));
    configManager = new ConfigManager(tempDir);
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('createDefaultConfig', () => {
    it('should create config with default tasks_directory', () => {
      const config = configManager.createDefaultConfig('test-project');

      expect(config.tasks_directory).toBe('tasks');
      expect(config.structure.epics_dir).toBe('epics');
      expect(config.structure.issues_dir).toBe('issues');
      expect(config.structure.tasks_dir).toBe('tasks');
      expect(config.structure.templates_dir).toBe('templates');
      expect(config.structure.prs_dir).toBe('prs');
    });

    it('should allow custom tasks_directory', () => {
      const config = configManager.createDefaultConfig('test-project', {
        tasks_directory: 'work',
      });

      expect(config.tasks_directory).toBe('work');
    });

    it('should include PR configurations', () => {
      const config = configManager.createDefaultConfig('test-project');

      expect(config.structure.prs_dir).toBe('prs');
      expect(config.naming_conventions.pr_prefix).toBe('PR');
    });
  });

  describe('getAbsolutePaths', () => {
    it('should return unified paths structure', () => {
      const config = configManager.createDefaultConfig('test-project');
      configManager.initializeProject('test-project', config);

      const paths = configManager.getAbsolutePaths();

      expect(paths.tasksRoot).toBe(join(tempDir, 'tasks'));
      expect(paths.epicsDir).toBe(join(tempDir, 'tasks', 'epics'));
      expect(paths.issuesDir).toBe(join(tempDir, 'tasks', 'issues'));
      expect(paths.tasksDir).toBe(join(tempDir, 'tasks', 'tasks'));
      expect(paths.prsDir).toBe(join(tempDir, 'tasks', 'prs'));
      expect(paths.templatesDir).toBe(join(tempDir, 'tasks', 'templates'));
    });

    it('should respect CLI tasks directory override', () => {
      const config = configManager.createDefaultConfig('test-project');
      configManager.initializeProject('test-project', config);

      const paths = configManager.getAbsolutePaths('cli-override');

      expect(paths.tasksRoot).toBe(join(tempDir, 'cli-override'));
      expect(paths.epicsDir).toBe(join(tempDir, 'cli-override', 'epics'));
    });

    it('should handle custom tasks_directory from config', () => {
      const config = configManager.createDefaultConfig('test-project', {
        tasks_directory: 'work',
      });
      configManager.initializeProject('test-project', config);

      const paths = configManager.getAbsolutePaths();

      expect(paths.tasksRoot).toBe(join(tempDir, 'work'));
      expect(paths.epicsDir).toBe(join(tempDir, 'work', 'epics'));
    });
  });

  describe('initializeProject', () => {
    it('should create unified directory structure', () => {
      const config = configManager.createDefaultConfig('test-project');
      configManager.initializeProject('test-project', config);

      // Verify unified structure was created
      expect(existsSync(join(tempDir, '.ai-trackdown'))).toBe(true);
      expect(existsSync(join(tempDir, 'tasks'))).toBe(true);
      expect(existsSync(join(tempDir, 'tasks', 'epics'))).toBe(true);
      expect(existsSync(join(tempDir, 'tasks', 'issues'))).toBe(true);
      expect(existsSync(join(tempDir, 'tasks', 'tasks'))).toBe(true);
      expect(existsSync(join(tempDir, 'tasks', 'prs'))).toBe(true);
      expect(existsSync(join(tempDir, 'tasks', 'templates'))).toBe(true);
    });

    it('should create custom tasks directory structure', () => {
      const config = configManager.createDefaultConfig('test-project', {
        tasks_directory: 'work',
      });
      configManager.initializeProject('test-project', config);

      // Verify custom structure was created
      expect(existsSync(join(tempDir, 'work'))).toBe(true);
      expect(existsSync(join(tempDir, 'work', 'epics'))).toBe(true);
      expect(existsSync(join(tempDir, 'work', 'issues'))).toBe(true);
      expect(existsSync(join(tempDir, 'work', 'tasks'))).toBe(true);
      expect(existsSync(join(tempDir, 'work', 'prs'))).toBe(true);
      expect(existsSync(join(tempDir, 'work', 'templates'))).toBe(true);
    });

    it('should not create legacy separate root directories', () => {
      const config = configManager.createDefaultConfig('test-project');
      configManager.initializeProject('test-project', config);

      // Verify legacy structure was NOT created at root
      expect(existsSync(join(tempDir, 'epics'))).toBe(false);
      expect(existsSync(join(tempDir, 'issues'))).toBe(false);
      // Note: tempDir/tasks exists but it's the unified root, not a separate legacy dir
    });
  });

  describe('getTemplate integration', () => {
    it('should find templates in unified structure', () => {
      const config = configManager.createDefaultConfig('test-project');
      configManager.initializeProject('test-project', config);

      // Templates should be accessible from unified location
      const template = configManager.getTemplate('epic', 'default');
      expect(template).toBeTruthy();
      expect(template?.type).toBe('epic');
    });
  });

  describe('backward compatibility', () => {
    it('should maintain compatibility with existing configurations', () => {
      // Create a config without tasks_directory (old format)
      const _oldConfig: ProjectConfig = {
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

      // Create config file manually
      mkdirSync(join(tempDir, '.ai-trackdown'), { recursive: true });
      writeFileSync(
        join(tempDir, '.ai-trackdown', 'config.yaml'),
        `name: test-project
version: 1.0.0
structure:
  epics_dir: epics
  issues_dir: issues
  tasks_dir: tasks
  templates_dir: templates
naming_conventions:
  epic_prefix: EP
  issue_prefix: ISS
  task_prefix: TSK
  file_extension: .md`,
        'utf8'
      );

      const paths = configManager.getAbsolutePaths();

      // Should default to 'tasks' when tasks_directory not specified
      expect(paths.tasksRoot).toBe(join(tempDir, 'tasks'));
    });
  });
});
