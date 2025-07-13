/**
 * Comprehensive Unit Tests for ProjectDetector
 * Tests multi-project support functionality, detection logic, and path resolution
 */

import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConfigManager } from '../src/utils/config-manager.js';
import { ProjectDetector } from '../src/utils/project-detector.js';

describe('ProjectDetector', () => {
  let testProjectRoot: string;
  let detector: ProjectDetector;
  let mockConfigManager: ConfigManager;
  let originalCwd: string;

  beforeEach(() => {
    // Create temporary directory for tests
    testProjectRoot = fs.mkdtempSync(path.join(tmpdir(), 'project-detector-test-'));
    originalCwd = process.cwd();
    process.chdir(testProjectRoot);

    // Mock ConfigManager
    mockConfigManager = {
      getConfig: vi.fn(),
      isProjectDirectory: vi.fn().mockReturnValue(true),
      initializeProject: vi.fn(),
      validateConfig: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    } as any;

    detector = new ProjectDetector(testProjectRoot, mockConfigManager);

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
      const defaultDetector = new ProjectDetector();
      expect(defaultDetector).toBeDefined();
    });

    it('should accept custom project root', () => {
      const customDetector = new ProjectDetector('/custom/path');
      expect(customDetector).toBeDefined();
    });

    it('should accept config manager', () => {
      const detectorWithConfig = new ProjectDetector(testProjectRoot, mockConfigManager);
      expect(detectorWithConfig).toBeDefined();
    });

    it('should accept mode override', () => {
      const detectorWithOverride = new ProjectDetector(testProjectRoot, mockConfigManager, 'multi');
      expect(detectorWithOverride).toBeDefined();
    });
  });

  describe('detectProjectMode', () => {
    describe('mode override precedence', () => {
      it('should use constructor mode override first', () => {
        const overrideDetector = new ProjectDetector(testProjectRoot, mockConfigManager, 'multi');
        const result = overrideDetector.detectProjectMode();
        expect(result.mode).toBe('multi');
      });

      it('should use environment variable override second', () => {
        process.env.AITRACKDOWN_PROJECT_MODE = 'single';
        const result = detector.detectProjectMode();
        expect(result.mode).toBe('single');
      });

      it('should use config file override third', () => {
        mockConfigManager.getConfig = vi.fn().mockReturnValue({ project_mode: 'multi' });
        const result = detector.detectProjectMode();
        expect(result.mode).toBe('multi');
      });
    });

    describe('auto-detection logic', () => {
      it('should detect single-project mode by default', () => {
        const result = detector.detectProjectMode();
        expect(result.mode).toBe('single');
        expect(result.projectRoot).toBe(testProjectRoot);
        expect(result.migrationNeeded).toBe(false);
      });

      it('should detect multi-project mode with projects/ directory', () => {
        // Create projects directory with subdirectories
        const projectsDir = path.join(testProjectRoot, 'projects');
        fs.mkdirSync(projectsDir);
        fs.mkdirSync(path.join(projectsDir, 'project1'));
        fs.mkdirSync(path.join(projectsDir, 'project2'));

        const result = detector.detectProjectMode();
        expect(result.mode).toBe('multi');
        expect(result.projectsDir).toBe(projectsDir);
        expect(result.detectedProjects).toContain('project1');
        expect(result.detectedProjects).toContain('project2');
        expect(result.migrationNeeded).toBe(false);
      });

      it('should detect multi-project mode with PRJ files', () => {
        // Create PRJ-XXXX files
        fs.writeFileSync(path.join(testProjectRoot, 'PRJ-0001-project-one.md'), '# Project One');
        fs.writeFileSync(path.join(testProjectRoot, 'PRJ-0002-project-two.md'), '# Project Two');

        const result = detector.detectProjectMode();
        expect(result.mode).toBe('multi');
        expect(result.detectedProjects).toContain('PRJ-0001-project-one.md');
        expect(result.detectedProjects).toContain('PRJ-0002-project-two.md');
        expect(result.migrationNeeded).toBe(true);
        expect(result.recommendations).toContain('Detected PRJ-XXXX files in root directory');
      });

      it('should detect multi-project mode with multiple .ai-trackdown directories', () => {
        // Create subdirectories with .ai-trackdown folders
        const proj1Dir = path.join(testProjectRoot, 'project1');
        const proj2Dir = path.join(testProjectRoot, 'project2');
        fs.mkdirSync(proj1Dir);
        fs.mkdirSync(proj2Dir);
        fs.mkdirSync(path.join(proj1Dir, '.ai-trackdown'));
        fs.mkdirSync(path.join(proj2Dir, '.ai-trackdown'));

        const result = detector.detectProjectMode();
        expect(result.mode).toBe('multi');
        expect(result.detectedProjects).toContain('project1');
        expect(result.detectedProjects).toContain('project2');
        expect(result.migrationNeeded).toBe(true);
        expect(result.recommendations).toContain('Multiple .ai-trackdown directories detected');
      });

      it('should detect legacy structure and recommend migration', () => {
        // Create legacy directories
        fs.mkdirSync(path.join(testProjectRoot, 'trackdown'));
        fs.mkdirSync(path.join(testProjectRoot, 'epics'));
        fs.mkdirSync(path.join(testProjectRoot, 'issues'));

        const result = detector.detectProjectMode();
        expect(result.mode).toBe('single');
        expect(result.migrationNeeded).toBe(true);
        expect(result.recommendations).toContain('Legacy directory structure detected');
      });
    });

    describe('priority order', () => {
      it('should prioritize projects/ directory over PRJ files', () => {
        // Create both projects/ directory and PRJ files
        const projectsDir = path.join(testProjectRoot, 'projects');
        fs.mkdirSync(projectsDir);
        fs.mkdirSync(path.join(projectsDir, 'project1'));
        fs.writeFileSync(path.join(testProjectRoot, 'PRJ-0001-project-one.md'), '# Project One');

        const result = detector.detectProjectMode();
        expect(result.mode).toBe('multi');
        expect(result.projectsDir).toBe(projectsDir);
        expect(result.migrationNeeded).toBe(false);
      });

      it('should prioritize PRJ files over multiple .ai-trackdown directories', () => {
        // Create PRJ files and multiple .ai-trackdown directories
        fs.writeFileSync(path.join(testProjectRoot, 'PRJ-0001-project-one.md'), '# Project One');
        const proj1Dir = path.join(testProjectRoot, 'project1');
        fs.mkdirSync(proj1Dir);
        fs.mkdirSync(path.join(proj1Dir, '.ai-trackdown'));

        const result = detector.detectProjectMode();
        expect(result.mode).toBe('multi');
        expect(result.detectedProjects).toContain('PRJ-0001-project-one.md');
        expect(result.migrationNeeded).toBe(true);
      });
    });
  });

  describe('getProjectContext', () => {
    it('should return single-project context', () => {
      const context = detector.getProjectContext();
      expect(context.mode).toBe('single');
      expect(context.projectRoot).toBe(testProjectRoot);
      expect(context.availableProjects).toEqual([]);
    });

    it('should return multi-project context with project selection', () => {
      // Setup multi-project structure
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));
      fs.mkdirSync(path.join(projectsDir, 'project2'));

      const context = detector.getProjectContext('project1');
      expect(context.mode).toBe('multi');
      expect(context.projectRoot).toBe(testProjectRoot);
      expect(context.projectsDir).toBe(projectsDir);
      expect(context.currentProject).toBe('project1');
      expect(context.availableProjects).toContain('project1');
      expect(context.availableProjects).toContain('project2');
    });

    it('should auto-select single project in multi-project mode', () => {
      // Setup multi-project structure with only one project
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'onlyproject'));

      const context = detector.getProjectContext();
      expect(context.mode).toBe('multi');
      expect(context.currentProject).toBe('onlyproject');
    });

    it('should throw error for invalid project in multi-project mode', () => {
      // Setup multi-project structure
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));

      expect(() => {
        detector.getProjectContext('nonexistent');
      }).toThrow("Project 'nonexistent' not found");
    });
  });

  describe('project management methods', () => {
    beforeEach(() => {
      // Setup multi-project structure
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));
      fs.mkdirSync(path.join(projectsDir, 'project2'));
    });

    describe('listAvailableProjects', () => {
      it('should return empty array for single-project mode', () => {
        const singleDetector = new ProjectDetector(testProjectRoot, mockConfigManager, 'single');
        const projects = singleDetector.listAvailableProjects();
        expect(projects).toEqual([]);
      });

      it('should return available projects for multi-project mode', () => {
        const projects = detector.listAvailableProjects();
        expect(projects).toContain('project1');
        expect(projects).toContain('project2');
      });
    });

    describe('projectExists', () => {
      it('should return false for single-project mode', () => {
        const singleDetector = new ProjectDetector(testProjectRoot, mockConfigManager, 'single');
        const exists = singleDetector.projectExists('project1');
        expect(exists).toBe(false);
      });

      it('should return true for existing project in multi-project mode', () => {
        const exists = detector.projectExists('project1');
        expect(exists).toBe(true);
      });

      it('should return false for non-existing project in multi-project mode', () => {
        const exists = detector.projectExists('nonexistent');
        expect(exists).toBe(false);
      });
    });

    describe('getProjectPath', () => {
      it('should return project root for single-project mode', () => {
        const singleDetector = new ProjectDetector(testProjectRoot, mockConfigManager, 'single');
        const projectPath = singleDetector.getProjectPath();
        expect(projectPath).toBe(testProjectRoot);
      });

      it('should return project path for multi-project mode', () => {
        const projectPath = detector.getProjectPath('project1');
        expect(projectPath).toBe(path.join(testProjectRoot, 'projects', 'project1'));
      });

      it('should throw error when project name is missing in multi-project mode', () => {
        expect(() => {
          detector.getProjectPath();
        }).toThrow('Project name required in multi-project mode');
      });

      it('should throw error for non-existing project', () => {
        expect(() => {
          detector.getProjectPath('nonexistent');
        }).toThrow("Project 'nonexistent' not found");
      });
    });

    describe('createProject', () => {
      it('should throw error in single-project mode', () => {
        const singleDetector = new ProjectDetector(testProjectRoot, mockConfigManager, 'single');
        expect(() => {
          singleDetector.createProject('newproject');
        }).toThrow('Cannot create project in single-project mode');
      });

      it('should return project path for new project', () => {
        const projectPath = detector.createProject('newproject');
        expect(projectPath).toBe(path.join(testProjectRoot, 'projects', 'newproject'));
      });

      it('should throw error for existing project', () => {
        expect(() => {
          detector.createProject('project1');
        }).toThrow("Project 'project1' already exists");
      });
    });
  });

  describe('mode override methods', () => {
    it('should set mode override', () => {
      detector.setModeOverride('multi');
      const result = detector.detectProjectMode();
      expect(result.mode).toBe('multi');
    });

    it('should clear mode override', () => {
      detector.setModeOverride('multi');
      detector.setModeOverride(undefined);
      const result = detector.detectProjectMode();
      expect(result.mode).toBe('single'); // Default for empty directory
    });
  });

  describe('showDetectionInfo', () => {
    it('should display single-project info', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      detector.showDetectionInfo();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('AI-Trackdown Project Detection')
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Mode: SINGLE'));

      consoleSpy.mockRestore();
    });

    it('should display multi-project info', () => {
      // Setup multi-project structure
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      detector.showDetectionInfo();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Mode: MULTI'));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Available Projects: project1')
      );

      consoleSpy.mockRestore();
    });

    it('should display migration recommendations', () => {
      // Create PRJ files to trigger migration
      fs.writeFileSync(path.join(testProjectRoot, 'PRJ-0001-project-one.md'), '# Project One');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      detector.showDetectionInfo();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Migration needed'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Recommendations:'));

      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle unreadable directory gracefully', () => {
      // Create detector with non-existent path
      const invalidDetector = new ProjectDetector('/invalid/path/that/does/not/exist');

      expect(() => {
        invalidDetector.detectProjectMode();
      }).not.toThrow();

      const result = invalidDetector.detectProjectMode();
      expect(result.mode).toBe('single');
    });

    it('should handle config manager errors gracefully', () => {
      mockConfigManager.getConfig = vi.fn().mockImplementation(() => {
        throw new Error('Config error');
      });

      const result = detector.detectProjectMode();
      expect(result.mode).toBe('single'); // Should fallback to auto-detection
    });
  });

  describe('environment variable handling', () => {
    it('should handle invalid environment variable values', () => {
      process.env.AITRACKDOWN_PROJECT_MODE = 'invalid';
      const result = detector.detectProjectMode();
      expect(result.mode).toBe('single'); // Should fallback to auto-detection
    });

    it('should handle single mode from environment', () => {
      process.env.AITRACKDOWN_PROJECT_MODE = 'single';
      const result = detector.detectProjectMode();
      expect(result.mode).toBe('single');
    });

    it('should handle multi mode from environment', () => {
      process.env.AITRACKDOWN_PROJECT_MODE = 'multi';
      const result = detector.detectProjectMode();
      expect(result.mode).toBe('multi');
    });
  });

  describe('configuration file handling', () => {
    it('should handle missing config file', () => {
      mockConfigManager.getConfig = vi.fn().mockImplementation(() => {
        throw new Error('Config not found');
      });

      const result = detector.detectProjectMode();
      expect(result.mode).toBe('single'); // Should fallback to auto-detection
    });

    it('should handle invalid config format', () => {
      mockConfigManager.getConfig = vi.fn().mockReturnValue({
        project_mode: 'invalid_mode',
      });

      const result = detector.detectProjectMode();
      expect(result.mode).toBe('single'); // Should fallback to auto-detection
    });

    it('should handle valid config values', () => {
      mockConfigManager.getConfig = vi.fn().mockReturnValue({
        project_mode: 'multi',
      });

      const result = detector.detectProjectMode();
      expect(result.mode).toBe('multi');
    });
  });

  describe('edge cases', () => {
    it('should handle empty projects directory', () => {
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);

      const result = detector.detectProjectMode();
      expect(result.mode).toBe('multi');
      expect(result.detectedProjects).toEqual([]);
    });

    it('should handle projects directory with files (not directories)', () => {
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.writeFileSync(path.join(projectsDir, 'file.txt'), 'content');

      const result = detector.detectProjectMode();
      expect(result.mode).toBe('multi');
      expect(result.detectedProjects).toEqual([]);
    });

    it('should handle mixed content in projects directory', () => {
      const projectsDir = path.join(testProjectRoot, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));
      fs.writeFileSync(path.join(projectsDir, 'file.txt'), 'content');

      const result = detector.detectProjectMode();
      expect(result.mode).toBe('multi');
      expect(result.detectedProjects).toEqual(['project1']);
    });

    it('should handle PRJ files with different extensions', () => {
      fs.writeFileSync(path.join(testProjectRoot, 'PRJ-0001-project.txt'), 'content');
      fs.writeFileSync(path.join(testProjectRoot, 'PRJ-0002-project.md'), 'content');

      const result = detector.detectProjectMode();
      expect(result.mode).toBe('multi');
      expect(result.detectedProjects).toEqual(['PRJ-0002-project.md']);
    });

    it('should handle single .ai-trackdown directory', () => {
      const projDir = path.join(testProjectRoot, 'project1');
      fs.mkdirSync(projDir);
      fs.mkdirSync(path.join(projDir, '.ai-trackdown'));

      const result = detector.detectProjectMode();
      expect(result.mode).toBe('single'); // Only one, so not multi
    });
  });
});
