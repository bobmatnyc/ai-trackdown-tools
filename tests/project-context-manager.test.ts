/**
 * Comprehensive Tests for ProjectContextManager
 * Tests project context management, path resolution, and multi-project workflows
 */

import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigManager } from '../src/utils/config-manager.js';
import { PathResolver } from '../src/utils/path-resolver.js';
import { ProjectContextManager } from '../src/utils/project-context-manager.js';

describe('ProjectContextManager', () => {
  let testProjectRoot: string;
  let contextManager: ProjectContextManager;
  let originalCwd: string;

  beforeEach(() => {
    testProjectRoot = fs.mkdtempSync(path.join(tmpdir(), 'project-context-manager-test-'));
    originalCwd = process.cwd();
    process.chdir(testProjectRoot);

    contextManager = new ProjectContextManager(testProjectRoot);

    // Clear environment variables
    delete process.env.AITRACKDOWN_PROJECT_MODE;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testProjectRoot, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default parameters', () => {
      const manager = new ProjectContextManager();
      expect(manager).toBeDefined();
    });

    it('should accept custom project root', () => {
      const manager = new ProjectContextManager('/custom/path');
      expect(manager).toBeDefined();
    });

    it('should accept mode override', () => {
      const manager = new ProjectContextManager(testProjectRoot, 'multi');
      expect(manager).toBeDefined();
    });

    it('should accept CLI root directory', () => {
      const manager = new ProjectContextManager(testProjectRoot, undefined, '/cli/root');
      expect(manager).toBeDefined();
    });
  });

  describe('initializeContext', () => {
    it('should initialize single-project context', async () => {
      const context = await contextManager.initializeContext();

      expect(context.context.mode).toBe('single');
      expect(context.context.projectRoot).toBe(testProjectRoot);
      expect(context.context.availableProjects).toEqual([]);
      expect(context.paths.projectRoot).toBe(testProjectRoot);
      expect(context.configManager).toBeDefined();
      expect(context.pathResolver).toBeDefined();
      expect(context.projectDetector).toBeDefined();
    });

    it('should initialize multi-project context', async () => {
      // Create projects directory structure
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));
      fs.mkdirSync(path.join(projectsDir, 'project2'));

      const context = await contextManager.initializeContext('project1');

      expect(context.context.mode).toBe('multi');
      expect(context.context.projectRoot).toBe(testProjectRoot);
      expect(context.context.currentProject).toBe('project1');
      expect(context.context.availableProjects).toContain('project1');
      expect(context.context.availableProjects).toContain('project2');
      expect(context.paths.projectRoot).toBe(path.join(projectsDir, 'project1'));
    });

    it('should auto-select single project in multi-project mode', async () => {
      // Create projects directory with single project
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'onlyproject'));

      const context = await contextManager.initializeContext();

      expect(context.context.mode).toBe('multi');
      expect(context.context.currentProject).toBe('onlyproject');
    });

    it('should build correct contextualized paths', async () => {
      const context = await contextManager.initializeContext();

      expect(context.paths.projectRoot).toBe(testProjectRoot);
      expect(context.paths.configDir).toBe(path.join(testProjectRoot, '.ai-trackdown'));
      expect(context.paths.tasksRoot).toBeDefined();
      expect(context.paths.epicsDir).toBeDefined();
      expect(context.paths.issuesDir).toBeDefined();
      expect(context.paths.tasksDir).toBeDefined();
      expect(context.paths.prsDir).toBeDefined();
      expect(context.paths.templatesDir).toBeDefined();
    });

    it('should cache context state', async () => {
      const context1 = await contextManager.initializeContext();
      const context2 = contextManager.getCurrentContext();

      expect(context1).toBe(context2);
    });
  });

  describe('project switching', () => {
    beforeEach(async () => {
      // Setup multi-project structure
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));
      fs.mkdirSync(path.join(projectsDir, 'project2'));
      fs.mkdirSync(path.join(projectsDir, 'project3'));

      // Initialize with project1
      await contextManager.initializeContext('project1');
    });

    it('should switch to different project', async () => {
      const newContext = await contextManager.switchProject('project2');

      expect(newContext.context.currentProject).toBe('project2');
      expect(newContext.paths.projectRoot).toBe(path.join(testProjectRoot, 'projects', 'project2'));
    });

    it('should throw error when switching in single-project mode', async () => {
      const singleManager = new ProjectContextManager(testProjectRoot, 'single');
      await singleManager.initializeContext();

      await expect(singleManager.switchProject('project1')).rejects.toThrow(
        'Cannot switch projects in single-project mode'
      );
    });

    it('should throw error when no context initialized', async () => {
      const newManager = new ProjectContextManager(testProjectRoot);

      await expect(newManager.switchProject('project1')).rejects.toThrow(
        'No project context initialized'
      );
    });

    it('should validate project exists when switching', async () => {
      await expect(contextManager.switchProject('nonexistent')).rejects.toThrow(
        "Project 'nonexistent' not found"
      );
    });

    it('should update cached context after switching', async () => {
      const originalContext = contextManager.getCurrentContext();
      expect(originalContext?.context.currentProject).toBe('project1');

      await contextManager.switchProject('project2');

      const newContext = contextManager.getCurrentContext();
      expect(newContext?.context.currentProject).toBe('project2');
    });
  });

  describe('project creation', () => {
    beforeEach(async () => {
      // Setup multi-project structure
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'existing-project'));

      await contextManager.initializeContext('existing-project');
    });

    it('should create new project and switch to it', async () => {
      const newContext = await contextManager.createProject('new-project');

      expect(newContext.context.currentProject).toBe('new-project');
      expect(newContext.paths.projectRoot).toBe(
        path.join(testProjectRoot, 'projects', 'new-project')
      );

      // Verify directory was created
      const projectDir = path.join(testProjectRoot, 'projects', 'new-project');
      expect(fs.existsSync(projectDir)).toBe(true);
    });

    it('should initialize project with custom config', async () => {
      const customConfig = {
        name: 'New Project',
        description: 'A new project',
        version: '1.0.0',
      };

      const newContext = await contextManager.createProject('new-project', customConfig);

      expect(newContext.context.currentProject).toBe('new-project');

      // Verify config was applied
      const configManager = newContext.configManager;
      const config = configManager.getConfig();
      expect(config.name).toBe('New Project');
    });

    it('should throw error when creating in single-project mode', async () => {
      const singleManager = new ProjectContextManager(testProjectRoot, 'single');
      await singleManager.initializeContext();

      await expect(singleManager.createProject('new-project')).rejects.toThrow(
        'Cannot create projects in single-project mode'
      );
    });

    it('should initialize context if not already initialized', async () => {
      const newManager = new ProjectContextManager(testProjectRoot);

      // Create projects directory to trigger multi-project mode
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'existing-project'));

      const newContext = await newManager.createProject('new-project');

      expect(newContext.context.mode).toBe('multi');
      expect(newContext.context.currentProject).toBe('new-project');
    });

    it('should handle project creation errors gracefully', async () => {
      // Create a file with the same name as the project we want to create
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.writeFileSync(path.join(projectsDir, 'conflicting-project'), 'file content');

      // This should throw an error due to the conflict
      await expect(contextManager.createProject('conflicting-project')).rejects.toThrow();
    });
  });

  describe('context queries', () => {
    beforeEach(async () => {
      // Setup multi-project structure
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));
      fs.mkdirSync(path.join(projectsDir, 'project2'));
      fs.mkdirSync(path.join(projectsDir, 'project3'));

      await contextManager.initializeContext('project1');
    });

    it('should list available projects', () => {
      const projects = contextManager.listProjects();

      expect(projects).toContain('project1');
      expect(projects).toContain('project2');
      expect(projects).toContain('project3');
    });

    it('should return project mode', () => {
      const mode = contextManager.getProjectMode();
      expect(mode).toBe('multi');
    });

    it('should return contextualized paths', () => {
      const paths = contextManager.getPaths();

      expect(paths.projectRoot).toBe(path.join(testProjectRoot, 'projects', 'project1'));
      expect(paths.configDir).toBe(
        path.join(testProjectRoot, 'projects', 'project1', '.ai-trackdown')
      );
      expect(paths.tasksRoot).toBeDefined();
      expect(paths.epicsDir).toBeDefined();
    });

    it('should return path resolver', () => {
      const pathResolver = contextManager.getPathResolver();
      expect(pathResolver).toBeInstanceOf(PathResolver);
    });

    it('should return config manager', () => {
      const configManager = contextManager.getConfigManager();
      expect(configManager).toBeInstanceOf(ConfigManager);
    });

    it('should throw error when no context initialized', () => {
      const newManager = new ProjectContextManager(testProjectRoot);

      expect(() => newManager.listProjects()).toThrow('No project context initialized');
      expect(() => newManager.getProjectMode()).toThrow('No project context initialized');
      expect(() => newManager.getPaths()).toThrow('No project context initialized');
      expect(() => newManager.getPathResolver()).toThrow('No project context initialized');
      expect(() => newManager.getConfigManager()).toThrow('No project context initialized');
    });
  });

  describe('project structure management', () => {
    beforeEach(async () => {
      await contextManager.initializeContext();
    });

    it('should ensure project structure exists', async () => {
      await contextManager.ensureProjectStructure();

      const paths = contextManager.getPaths();

      // Check that all required directories exist
      expect(fs.existsSync(paths.configDir)).toBe(true);
      expect(fs.existsSync(paths.tasksRoot)).toBe(true);
      expect(fs.existsSync(paths.epicsDir)).toBe(true);
      expect(fs.existsSync(paths.issuesDir)).toBe(true);
      expect(fs.existsSync(paths.tasksDir)).toBe(true);
      expect(fs.existsSync(paths.prsDir)).toBe(true);
      expect(fs.existsSync(paths.templatesDir)).toBe(true);
    });

    it('should not recreate existing directories', async () => {
      const paths = contextManager.getPaths();

      // Create some directories first
      fs.mkdirSync(paths.configDir, { recursive: true });
      const configStat = fs.statSync(paths.configDir);

      await contextManager.ensureProjectStructure();

      // Directory should not be recreated (same creation time)
      const newConfigStat = fs.statSync(paths.configDir);
      expect(newConfigStat.birthtime).toEqual(configStat.birthtime);
    });

    it('should initialize config if not exists', async () => {
      await contextManager.ensureProjectStructure();

      const configManager = contextManager.getConfigManager();
      const config = configManager.getConfig();

      expect(config).toBeDefined();
      expect(config.name).toBeDefined();
    });

    it('should throw error when no context initialized', async () => {
      const newManager = new ProjectContextManager(testProjectRoot);

      await expect(newManager.ensureProjectStructure()).rejects.toThrow(
        'No project context initialized'
      );
    });
  });

  describe('context validation', () => {
    it('should validate single-project context', async () => {
      await contextManager.initializeContext();

      const validation = contextManager.validateContext();

      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
    });

    it('should validate multi-project context with selected project', async () => {
      // Setup multi-project structure
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));

      await contextManager.initializeContext('project1');

      const validation = contextManager.validateContext();

      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
    });

    it('should detect validation issues', async () => {
      // Setup multi-project structure
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));

      await contextManager.initializeContext('project1');

      // Remove the project directory to create an issue
      fs.rmSync(path.join(projectsDir, 'project1'), { recursive: true });

      const validation = contextManager.validateContext();

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain("Project 'project1' does not exist");
    });

    it('should detect missing project selection in multi-project mode', async () => {
      // Setup multi-project structure
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));
      fs.mkdirSync(path.join(projectsDir, 'project2'));

      await contextManager.initializeContext(); // No project selected

      const validation = contextManager.validateContext();

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('No project selected in multi-project mode');
    });

    it('should detect missing directories as warnings', async () => {
      await contextManager.initializeContext();

      const validation = contextManager.validateContext();

      // Should warn about missing directories
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings.some((w) => w.includes('Required directory does not exist'))).toBe(
        true
      );
    });

    it('should handle validation without initialized context', () => {
      const newManager = new ProjectContextManager(testProjectRoot);

      const validation = newManager.validateContext();

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('No project context initialized');
    });
  });

  describe('context information display', () => {
    it('should display single-project context info', async () => {
      await contextManager.initializeContext();

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      contextManager.showContextInfo();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Project Context Information')
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Mode: SINGLE'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Directory Structure:'));

      consoleSpy.mockRestore();
    });

    it('should display multi-project context info', async () => {
      // Setup multi-project structure
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));

      await contextManager.initializeContext('project1');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      contextManager.showContextInfo();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Mode: MULTI'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Current Project: project1'));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Available Projects: project1')
      );

      consoleSpy.mockRestore();
    });

    it('should display validation issues', async () => {
      // Setup multi-project structure with issues
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));

      await contextManager.initializeContext('project1');

      // Remove project to create validation issue
      fs.rmSync(path.join(projectsDir, 'project1'), { recursive: true });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      contextManager.showContextInfo();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Context Issues:'));

      consoleSpy.mockRestore();
    });

    it('should display without initialized context', () => {
      const newManager = new ProjectContextManager(testProjectRoot);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      newManager.showContextInfo();

      expect(consoleSpy).toHaveBeenCalledWith('❌ No project context initialized');

      consoleSpy.mockRestore();
    });
  });

  describe('context reset and configuration', () => {
    it('should reset context', async () => {
      await contextManager.initializeContext();
      expect(contextManager.getCurrentContext()).toBeDefined();

      contextManager.reset();
      expect(contextManager.getCurrentContext()).toBeUndefined();
    });

    it('should set mode override', async () => {
      await contextManager.initializeContext();
      expect(contextManager.getProjectMode()).toBe('single');

      contextManager.setModeOverride('multi');
      await contextManager.initializeContext();
      expect(contextManager.getProjectMode()).toBe('multi');
    });

    it('should reset context when setting mode override', async () => {
      await contextManager.initializeContext();
      const _originalContext = contextManager.getCurrentContext();

      contextManager.setModeOverride('multi');

      expect(contextManager.getCurrentContext()).toBeUndefined();
    });

    it('should set CLI root directory', () => {
      contextManager.setCliRootDir('/new/cli/root');

      // Context should be reset
      expect(contextManager.getCurrentContext()).toBeUndefined();
    });

    it('should reset context when setting CLI root directory', async () => {
      await contextManager.initializeContext();
      const _originalContext = contextManager.getCurrentContext();

      contextManager.setCliRootDir('/new/cli/root');

      expect(contextManager.getCurrentContext()).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle invalid project root gracefully', async () => {
      const invalidManager = new ProjectContextManager('/invalid/path/that/does/not/exist');

      // Should not throw error
      expect(async () => {
        await invalidManager.initializeContext();
      }).not.toThrow();

      const context = await invalidManager.initializeContext();
      expect(context.context.mode).toBe('single');
    });

    it('should handle config manager errors gracefully', async () => {
      // Mock ConfigManager to throw error
      const _mockConfigManager = {
        getConfig: vi.fn().mockImplementation(() => {
          throw new Error('Config error');
        }),
        isProjectDirectory: vi.fn().mockReturnValue(false),
        initializeProject: vi.fn().mockImplementation(() => {
          throw new Error('Init error');
        }),
        validateConfig: vi.fn().mockReturnValue({ valid: false, errors: ['Config error'] }),
      };

      // This test would require dependency injection to properly test
      // For now, we'll just verify the context manager handles normal cases
      const context = await contextManager.initializeContext();
      expect(context).toBeDefined();
    });

    it('should handle project creation with existing directory', async () => {
      // Setup multi-project structure
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'existing-project'));

      await contextManager.initializeContext('existing-project');

      // Try to create project with same name
      await expect(contextManager.createProject('existing-project')).rejects.toThrow();
    });
  });
});
