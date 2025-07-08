/**
 * Tests for UnifiedPathResolver
 * ATT-004: Fix Task Directory Structure - Single Root Directory Implementation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { UnifiedPathResolver } from '../src/utils/unified-path-resolver.js';
import type { ProjectConfig } from '../src/types/ai-trackdown.js';

describe('UnifiedPathResolver', () => {
  let tempDir: string;
  let testConfig: ProjectConfig;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await mkdtemp(join(tmpdir(), 'unified-path-test-'));
    
    // Default test configuration
    testConfig = {
      name: 'test-project',
      version: '1.0.0',
      tasks_directory: 'tasks',
      structure: {
        epics_dir: 'epics',
        issues_dir: 'issues',
        tasks_dir: 'tasks',
        templates_dir: 'templates',
        prs_dir: 'prs'
      },
      naming_conventions: {
        epic_prefix: 'EP',
        issue_prefix: 'ISS',
        task_prefix: 'TSK',
        pr_prefix: 'PR',
        file_extension: '.md'
      }
    };
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('getTasksRootDirectory', () => {
    it('should return CLI override when provided', () => {
      const resolver = new UnifiedPathResolver(testConfig, tempDir, 'cli-override');
      expect(resolver.getTasksRootDirectory()).toBe('cli-override');
    });

    it('should return environment variable when no CLI override', () => {
      process.env.AITRACKDOWN_TASKS_DIR = 'env-override';
      const resolver = new UnifiedPathResolver(testConfig, tempDir);
      expect(resolver.getTasksRootDirectory()).toBe('env-override');
      delete process.env.AITRACKDOWN_TASKS_DIR;
    });

    it('should return config value when no CLI or env override', () => {
      const resolver = new UnifiedPathResolver(testConfig, tempDir);
      expect(resolver.getTasksRootDirectory()).toBe('tasks');
    });

    it('should return default when no configuration specified', () => {
      const configWithoutTasksDir = { ...testConfig };
      delete configWithoutTasksDir.tasks_directory;
      const resolver = new UnifiedPathResolver(configWithoutTasksDir, tempDir);
      expect(resolver.getTasksRootDirectory()).toBe('tasks');
    });
  });

  describe('getUnifiedPaths', () => {
    it('should generate correct unified paths structure', () => {
      const resolver = new UnifiedPathResolver(testConfig, tempDir);
      const paths = resolver.getUnifiedPaths();

      expect(paths.projectRoot).toBe(tempDir);
      expect(paths.configDir).toBe(join(tempDir, '.ai-trackdown'));
      expect(paths.tasksRoot).toBe(join(tempDir, 'tasks'));
      expect(paths.epicsDir).toBe(join(tempDir, 'tasks', 'epics'));
      expect(paths.issuesDir).toBe(join(tempDir, 'tasks', 'issues'));
      expect(paths.tasksDir).toBe(join(tempDir, 'tasks', 'tasks'));
      expect(paths.prsDir).toBe(join(tempDir, 'tasks', 'prs'));
      expect(paths.templatesDir).toBe(join(tempDir, 'tasks', 'templates'));
    });

    it('should respect custom tasks directory', () => {
      const customConfig = { ...testConfig, tasks_directory: 'work' };
      const resolver = new UnifiedPathResolver(customConfig, tempDir);
      const paths = resolver.getUnifiedPaths();

      expect(paths.tasksRoot).toBe(join(tempDir, 'work'));
      expect(paths.epicsDir).toBe(join(tempDir, 'work', 'epics'));
      expect(paths.issuesDir).toBe(join(tempDir, 'work', 'issues'));
      expect(paths.tasksDir).toBe(join(tempDir, 'work', 'tasks'));
    });
  });

  describe('getItemTypeDirectory', () => {
    it('should return correct directory for each item type', () => {
      const resolver = new UnifiedPathResolver(testConfig, tempDir);

      expect(resolver.getItemTypeDirectory('epic')).toBe(join(tempDir, 'tasks', 'epics'));
      expect(resolver.getItemTypeDirectory('issue')).toBe(join(tempDir, 'tasks', 'issues'));
      expect(resolver.getItemTypeDirectory('task')).toBe(join(tempDir, 'tasks', 'tasks'));
      expect(resolver.getItemTypeDirectory('pr')).toBe(join(tempDir, 'tasks', 'prs'));
    });

    it('should throw error for unknown item type', () => {
      const resolver = new UnifiedPathResolver(testConfig, tempDir);
      
      expect(() => {
        // @ts-ignore - testing invalid type
        resolver.getItemTypeDirectory('unknown');
      }).toThrow('Unknown item type: unknown');
    });
  });

  describe('detectLegacyStructure', () => {
    it('should detect no legacy structure when none exists', () => {
      const resolver = new UnifiedPathResolver(testConfig, tempDir);
      const result = resolver.detectLegacyStructure();

      expect(result.hasLegacy).toBe(false);
      expect(result.legacyDirs).toHaveLength(0);
    });

    it('should detect legacy structure when separate root directories exist', () => {
      // Create legacy directories
      mkdirSync(join(tempDir, 'epics'), { recursive: true });
      mkdirSync(join(tempDir, 'issues'), { recursive: true });
      mkdirSync(join(tempDir, 'tasks'), { recursive: true });

      const resolver = new UnifiedPathResolver(testConfig, tempDir);
      const result = resolver.detectLegacyStructure();

      expect(result.hasLegacy).toBe(true);
      expect(result.legacyDirs).toContain(join(tempDir, 'epics'));
      expect(result.legacyDirs).toContain(join(tempDir, 'issues'));
      expect(result.legacyDirs).toContain(join(tempDir, 'tasks'));
    });

    it('should detect old trackdown structure', () => {
      // Create old trackdown directory
      mkdirSync(join(tempDir, 'trackdown'), { recursive: true });

      const resolver = new UnifiedPathResolver(testConfig, tempDir);
      const result = resolver.detectLegacyStructure();

      expect(result.hasLegacy).toBe(true);
      expect(result.legacyDirs).toContain(join(tempDir, 'trackdown'));
    });

    it('should provide migration suggestions', () => {
      // Create legacy directories
      mkdirSync(join(tempDir, 'epics'), { recursive: true });
      
      const resolver = new UnifiedPathResolver(testConfig, tempDir);
      const result = resolver.detectLegacyStructure();

      expect(result.suggestions).toContain('# Detected legacy directory structure. Migration options:');
      expect(result.suggestions.some(s => s.includes('mv epics tasks/epics'))).toBe(true);
    });
  });

  describe('validateStructure', () => {
    it('should report missing directories', () => {
      const resolver = new UnifiedPathResolver(testConfig, tempDir);
      const result = resolver.validateStructure();

      expect(result.valid).toBe(false);
      expect(result.missingDirs.length).toBeGreaterThan(0);
    });

    it('should report valid structure when all directories exist', () => {
      const resolver = new UnifiedPathResolver(testConfig, tempDir);
      const requiredDirs = resolver.getRequiredDirectories();
      
      // Create all required directories
      requiredDirs.forEach(dir => mkdirSync(dir, { recursive: true }));

      const result = resolver.validateStructure();
      expect(result.valid).toBe(true);
      expect(result.missingDirs).toHaveLength(0);
    });

    it('should report legacy structure conflicts', () => {
      // Create legacy directories
      mkdirSync(join(tempDir, 'epics'), { recursive: true });
      
      const resolver = new UnifiedPathResolver(testConfig, tempDir);
      const result = resolver.validateStructure();

      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.includes('Legacy directory structure detected'))).toBe(true);
    });
  });

  describe('CLI override functionality', () => {
    it('should allow setting and clearing CLI override', () => {
      const resolver = new UnifiedPathResolver(testConfig, tempDir);
      
      // Initial state
      expect(resolver.getTasksRootDirectory()).toBe('tasks');
      
      // Set CLI override
      resolver.setCliTasksDir('cli-override');
      expect(resolver.getTasksRootDirectory()).toBe('cli-override');
      
      // Clear CLI override
      resolver.clearCliTasksDir();
      expect(resolver.getTasksRootDirectory()).toBe('tasks');
    });
  });

  describe('environment variable priority', () => {
    afterEach(() => {
      // Clean up environment variables
      delete process.env.AITRACKDOWN_TASKS_DIR;
      delete process.env.AITRACKDOWN_ROOT_DIR;
    });

    it('should prioritize AITRACKDOWN_TASKS_DIR over AITRACKDOWN_ROOT_DIR', () => {
      process.env.AITRACKDOWN_ROOT_DIR = 'root-dir';
      process.env.AITRACKDOWN_TASKS_DIR = 'tasks-dir';
      
      const resolver = new UnifiedPathResolver(testConfig, tempDir);
      expect(resolver.getTasksRootDirectory()).toBe('tasks-dir');
    });

    it('should fall back to AITRACKDOWN_ROOT_DIR when AITRACKDOWN_TASKS_DIR not set', () => {
      process.env.AITRACKDOWN_ROOT_DIR = 'root-dir';
      
      const resolver = new UnifiedPathResolver(testConfig, tempDir);
      expect(resolver.getTasksRootDirectory()).toBe('root-dir');
    });
  });
});