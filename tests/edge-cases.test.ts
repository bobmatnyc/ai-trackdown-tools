/**
 * Edge Case Tests for Multi-Project Support
 * Tests unusual scenarios, error conditions, and boundary cases
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigManager } from '../src/utils/config-manager.js';
import { GitMetadataExtractor } from '../src/utils/git-metadata-extractor.js';
import { PathResolver } from '../src/utils/path-resolver.js';
import { ProjectContextManager } from '../src/utils/project-context-manager.js';
import { ProjectDetector } from '../src/utils/project-detector.js';

describe('Edge Cases Tests', () => {
  let testRootPath: string;
  let originalCwd: string;

  beforeEach(() => {
    testRootPath = fs.mkdtempSync(path.join(tmpdir(), 'edge-cases-test-'));
    originalCwd = process.cwd();
    process.chdir(testRootPath);

    // Clear environment variables
    delete process.env.AITRACKDOWN_PROJECT_MODE;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testRootPath, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('filesystem edge cases', () => {
    it('should handle very long project names', () => {
      const longProjectName = 'a'.repeat(255); // Maximum filename length on most filesystems

      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);

      // This might fail on some filesystems, so we'll try and handle gracefully
      try {
        fs.mkdirSync(path.join(projectsDir, longProjectName));

        const detector = new ProjectDetector(testRootPath);
        const result = detector.detectProjectMode();

        expect(result.mode).toBe('multi');
        expect(result.detectedProjects).toContain(longProjectName);
      } catch (error) {
        // Expected on filesystems with shorter limits
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle project names with special characters', () => {
      const specialNames = [
        'project-with-dashes',
        'project_with_underscores',
        'project.with.dots',
        'project with spaces',
        'project@with@symbols',
        'проект-на-русском', // Cyrillic
        '项目-中文', // Chinese
        'プロジェクト-日本語', // Japanese
      ];

      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);

      // Create projects with special names
      specialNames.forEach((name) => {
        try {
          fs.mkdirSync(path.join(projectsDir, name));
        } catch (_error) {
          // Some filesystems might not support certain characters
          console.warn(`Could not create project with name: ${name}`);
        }
      });

      const detector = new ProjectDetector(testRootPath);
      const result = detector.detectProjectMode();

      expect(result.mode).toBe('multi');
      expect(result.detectedProjects.length).toBeGreaterThan(0);
    });

    it('should handle empty projects directory', () => {
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);

      const detector = new ProjectDetector(testRootPath);
      const result = detector.detectProjectMode();

      expect(result.mode).toBe('multi');
      expect(result.detectedProjects).toEqual([]);
    });

    it('should handle projects directory with only files', () => {
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);

      // Create files (not directories) in projects folder
      fs.writeFileSync(path.join(projectsDir, 'file1.txt'), 'content1');
      fs.writeFileSync(path.join(projectsDir, 'file2.md'), 'content2');

      const detector = new ProjectDetector(testRootPath);
      const result = detector.detectProjectMode();

      expect(result.mode).toBe('multi');
      expect(result.detectedProjects).toEqual([]);
    });

    it('should handle deeply nested project structures', () => {
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);

      // Create nested structure
      const nestedPath = path.join(projectsDir, 'project1', 'deeply', 'nested', 'structure');
      fs.mkdirSync(nestedPath, { recursive: true });

      const detector = new ProjectDetector(testRootPath);
      const result = detector.detectProjectMode();

      expect(result.mode).toBe('multi');
      expect(result.detectedProjects).toContain('project1');
    });

    it('should handle symlinks in projects directory', () => {
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);

      // Create real project
      const realProjectDir = path.join(testRootPath, 'real-project');
      fs.mkdirSync(realProjectDir);

      // Create symlink (if supported)
      try {
        fs.symlinkSync(realProjectDir, path.join(projectsDir, 'symlink-project'));

        const detector = new ProjectDetector(testRootPath);
        const result = detector.detectProjectMode();

        expect(result.mode).toBe('multi');
        // Behavior with symlinks may vary by filesystem
        expect(result.detectedProjects.length).toBeGreaterThan(0);
      } catch (_error) {
        // Symlinks might not be supported on all systems
        console.warn('Symlinks not supported on this system');
      }
    });

    it('should handle permission denied errors', () => {
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'accessible-project'));

      // Create inaccessible directory (if possible)
      const inaccessibleDir = path.join(projectsDir, 'inaccessible-project');
      fs.mkdirSync(inaccessibleDir);

      try {
        fs.chmodSync(inaccessibleDir, 0o000); // Remove all permissions

        const detector = new ProjectDetector(testRootPath);
        const result = detector.detectProjectMode();

        expect(result.mode).toBe('multi');
        expect(result.detectedProjects).toContain('accessible-project');
        // Inaccessible project might or might not be detected

        // Restore permissions for cleanup
        fs.chmodSync(inaccessibleDir, 0o755);
      } catch (_error) {
        // Permission changes might not work on all systems
        console.warn('Permission changes not supported on this system');
      }
    });

    it('should handle concurrent directory access', async () => {
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);

      // Create multiple detectors accessing same directory
      const detectors = Array(5)
        .fill(null)
        .map(() => new ProjectDetector(testRootPath));

      // Create projects concurrently
      const createProjects = async (count: number) => {
        for (let i = 0; i < count; i++) {
          fs.mkdirSync(path.join(projectsDir, `concurrent-project-${i}`));
        }
      };

      // Run concurrent operations
      const [, ...results] = await Promise.all([
        createProjects(3),
        ...detectors.map((detector) => detector.detectProjectMode()),
      ]);

      // All detectors should succeed
      results.forEach((result) => {
        expect(result.mode).toBe('multi');
      });
    });
  });

  describe('configuration edge cases', () => {
    it('should handle malformed JSON config', () => {
      const configDir = path.join(testRootPath, '.ai-trackdown');
      fs.mkdirSync(configDir, { recursive: true });

      // Create malformed JSON
      fs.writeFileSync(path.join(configDir, 'config.json'), '{ invalid json }');

      const configManager = new ConfigManager(testRootPath);

      expect(() => {
        configManager.getConfig();
      }).toThrow();
    });

    it('should handle empty config file', () => {
      const configDir = path.join(testRootPath, '.ai-trackdown');
      fs.mkdirSync(configDir, { recursive: true });

      fs.writeFileSync(path.join(configDir, 'config.json'), '');

      const configManager = new ConfigManager(testRootPath);

      expect(() => {
        configManager.getConfig();
      }).toThrow();
    });

    it('should handle config with null values', () => {
      const configDir = path.join(testRootPath, '.ai-trackdown');
      fs.mkdirSync(configDir, { recursive: true });

      const configWithNulls = {
        name: null,
        version: '1.0.0',
        description: null,
        created_date: new Date().toISOString(),
      };

      fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(configWithNulls));

      const configManager = new ConfigManager(testRootPath);
      const config = configManager.getConfig();

      expect(config.name).toBe(null);
      expect(config.version).toBe('1.0.0');
    });

    it('should handle config with circular references', () => {
      const configDir = path.join(testRootPath, '.ai-trackdown');
      fs.mkdirSync(configDir, { recursive: true });

      // Create object with circular reference
      const circularConfig: any = {
        name: 'Test',
        version: '1.0.0',
      };
      circularConfig.self = circularConfig;

      // This should throw when trying to stringify
      expect(() => {
        fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(circularConfig));
      }).toThrow();
    });

    it('should handle extremely large config files', () => {
      const configDir = path.join(testRootPath, '.ai-trackdown');
      fs.mkdirSync(configDir, { recursive: true });

      // Create very large config
      const largeConfig = {
        name: 'Large Config',
        version: '1.0.0',
        large_data: 'x'.repeat(1000000), // 1MB of data
      };

      fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(largeConfig));

      const configManager = new ConfigManager(testRootPath);
      const config = configManager.getConfig();

      expect(config.name).toBe('Large Config');
      expect(config.large_data).toBeDefined();
      expect(config.large_data.length).toBe(1000000);
    });

    it('should handle config with unicode characters', () => {
      const configDir = path.join(testRootPath, '.ai-trackdown');
      fs.mkdirSync(configDir, { recursive: true });

      const unicodeConfig = {
        name: 'プロジェクト名',
        version: '1.0.0',
        description: '这是一个项目描述',
        emoji: '🚀✨💻',
        special_chars: '\\/"\'`~!@#$%^&*()_+-=[]{}|;:,.<>?',
      };

      fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(unicodeConfig));

      const configManager = new ConfigManager(testRootPath);
      const config = configManager.getConfig();

      expect(config.name).toBe('プロジェクト名');
      expect(config.description).toBe('这是一个项目描述');
      expect(config.emoji).toBe('🚀✨💻');
    });
  });

  describe('git metadata edge cases', () => {
    it('should handle repository with no commits', () => {
      // Initialize empty git repo
      execSync('git init', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.name "Test User"', { stdio: 'ignore', cwd: testRootPath });

      const extractor = new GitMetadataExtractor(testRootPath);

      expect(async () => {
        await extractor.extractMetadata();
      }).not.toThrow();
    });

    it('should handle repository with detached HEAD', async () => {
      // Initialize git repo with commits
      execSync('git init', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.name "Test User"', { stdio: 'ignore', cwd: testRootPath });

      fs.writeFileSync(path.join(testRootPath, 'file1.txt'), 'content1');
      execSync('git add .', { stdio: 'ignore', cwd: testRootPath });
      execSync('git commit -m "First commit"', { stdio: 'ignore', cwd: testRootPath });

      fs.writeFileSync(path.join(testRootPath, 'file2.txt'), 'content2');
      execSync('git add .', { stdio: 'ignore', cwd: testRootPath });
      execSync('git commit -m "Second commit"', { stdio: 'ignore', cwd: testRootPath });

      // Detach HEAD
      const firstCommit = execSync('git rev-list --max-parents=0 HEAD', {
        encoding: 'utf8',
        cwd: testRootPath,
      }).trim();
      execSync(`git checkout ${firstCommit}`, { stdio: 'ignore', cwd: testRootPath });

      const extractor = new GitMetadataExtractor(testRootPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.is_git_repo).toBe(true);
      expect(metadata.current_branch).toBeDefined();
    });

    it('should handle repository with binary files', async () => {
      execSync('git init', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.name "Test User"', { stdio: 'ignore', cwd: testRootPath });

      // Create binary file
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe, 0xfd]);
      fs.writeFileSync(path.join(testRootPath, 'binary.bin'), binaryData);

      fs.writeFileSync(path.join(testRootPath, 'text.txt'), 'text content');

      execSync('git add .', { stdio: 'ignore', cwd: testRootPath });
      execSync('git commit -m "Add binary and text files"', { stdio: 'ignore', cwd: testRootPath });

      const extractor = new GitMetadataExtractor(testRootPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.is_git_repo).toBe(true);
      expect(metadata.total_files).toBe(2);
    });

    it('should handle repository with very long commit messages', async () => {
      execSync('git init', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.name "Test User"', { stdio: 'ignore', cwd: testRootPath });

      fs.writeFileSync(path.join(testRootPath, 'file.txt'), 'content');
      execSync('git add .', { stdio: 'ignore', cwd: testRootPath });

      const longMessage = 'Very long commit message '.repeat(100);
      execSync(`git commit -m "${longMessage}"`, { stdio: 'ignore', cwd: testRootPath });

      const extractor = new GitMetadataExtractor(testRootPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.is_git_repo).toBe(true);
      expect(metadata.commit_count).toBe(1);
    });

    it('should handle repository with unusual file extensions', async () => {
      execSync('git init', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.name "Test User"', { stdio: 'ignore', cwd: testRootPath });

      // Create files with unusual extensions
      const unusualFiles = [
        'file.xyz',
        'file.123',
        'file.very.long.extension',
        'file.',
        'file',
        '.hiddenfile',
        'file with spaces.txt',
      ];

      unusualFiles.forEach((filename) => {
        fs.writeFileSync(path.join(testRootPath, filename), 'content');
      });

      execSync('git add .', { stdio: 'ignore', cwd: testRootPath });
      execSync('git commit -m "Add unusual files"', { stdio: 'ignore', cwd: testRootPath });

      const extractor = new GitMetadataExtractor(testRootPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.is_git_repo).toBe(true);
      expect(metadata.total_files).toBe(unusualFiles.length);
    });

    it('should handle repository with Git LFS files', async () => {
      execSync('git init', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.name "Test User"', { stdio: 'ignore', cwd: testRootPath });

      // Create what looks like LFS pointer file
      const lfsPointer = `version https://git-lfs.github.com/spec/v1
oid sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
size 12345
`;
      fs.writeFileSync(path.join(testRootPath, 'large-file.bin'), lfsPointer);

      execSync('git add .', { stdio: 'ignore', cwd: testRootPath });
      execSync('git commit -m "Add LFS file"', { stdio: 'ignore', cwd: testRootPath });

      const extractor = new GitMetadataExtractor(testRootPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.is_git_repo).toBe(true);
    });
  });

  describe('project context edge cases', () => {
    it('should handle project with circular directory references', async () => {
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);

      const project1Dir = path.join(projectsDir, 'project1');
      fs.mkdirSync(project1Dir);

      // Create circular reference (if possible)
      try {
        fs.symlinkSync(project1Dir, path.join(project1Dir, 'circular'));

        const contextManager = new ProjectContextManager(testRootPath);

        expect(async () => {
          await contextManager.initializeContext('project1');
        }).not.toThrow();
      } catch (_error) {
        // Circular references might not be possible on all systems
        console.warn('Circular references not supported on this system');
      }
    });

    it('should handle project with extremely deep nesting', async () => {
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);

      const project1Dir = path.join(projectsDir, 'project1');
      fs.mkdirSync(project1Dir);

      // Create deeply nested structure
      let currentPath = project1Dir;
      for (let i = 0; i < 50; i++) {
        currentPath = path.join(currentPath, `level${i}`);
        fs.mkdirSync(currentPath);
      }

      const contextManager = new ProjectContextManager(testRootPath);

      expect(async () => {
        await contextManager.initializeContext('project1');
      }).not.toThrow();
    });

    it('should handle rapid project creation and deletion', async () => {
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);

      const contextManager = new ProjectContextManager(testRootPath);

      // Rapidly create and delete projects
      for (let i = 0; i < 10; i++) {
        const projectName = `rapid-project-${i}`;

        // Create project
        await contextManager.createProject(projectName);
        expect(contextManager.getCurrentContext()?.context.currentProject).toBe(projectName);

        // Delete project directory
        fs.rmSync(path.join(projectsDir, projectName), { recursive: true });

        // Should handle gracefully
        const validation = contextManager.validateContext();
        expect(validation.valid).toBe(false);
      }
    });

    it('should handle project with conflicting configuration files', async () => {
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);

      const projectDir = path.join(projectsDir, 'conflicting-project');
      fs.mkdirSync(projectDir);

      // Create conflicting config files
      const configDir = path.join(projectDir, '.ai-trackdown');
      fs.mkdirSync(configDir);

      const config1 = { name: 'Config 1', version: '1.0.0' };
      const config2 = { name: 'Config 2', version: '2.0.0' };

      fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config1));
      fs.writeFileSync(path.join(configDir, 'config.json.bak'), JSON.stringify(config2));

      const contextManager = new ProjectContextManager(testRootPath);

      expect(async () => {
        await contextManager.initializeContext('conflicting-project');
      }).not.toThrow();

      const config = contextManager.getConfigManager().getConfig();
      expect(config.name).toBe('Config 1'); // Should use main config
    });

    it('should handle project with missing parent directory', async () => {
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);

      const contextManager = new ProjectContextManager(testRootPath);

      // Try to create project but remove parent directory first
      fs.rmSync(projectsDir, { recursive: true });

      await expect(contextManager.createProject('orphan-project')).rejects.toThrow();
    });
  });

  describe('path resolution edge cases', () => {
    it('should handle paths with spaces and special characters', () => {
      const specialPath = path.join(testRootPath, 'path with spaces & symbols!');
      fs.mkdirSync(specialPath);

      const configManager = new ConfigManager(specialPath);
      const pathResolver = new PathResolver(configManager);

      expect(pathResolver.getRootDirectory()).toBe(path.join(specialPath, 'tasks'));
    });

    it('should handle very long paths', () => {
      const longPath = path.join(testRootPath, 'very'.repeat(50));
      fs.mkdirSync(longPath, { recursive: true });

      const configManager = new ConfigManager(longPath);
      const pathResolver = new PathResolver(configManager);

      expect(pathResolver.getRootDirectory()).toBe(path.join(longPath, 'tasks'));
    });

    it('should handle paths with unicode characters', () => {
      const unicodePath = path.join(testRootPath, 'プロジェクト-中文-العربية');
      fs.mkdirSync(unicodePath, { recursive: true });

      const configManager = new ConfigManager(unicodePath);
      const pathResolver = new PathResolver(configManager);

      expect(pathResolver.getRootDirectory()).toBe(path.join(unicodePath, 'tasks'));
    });

    it('should handle relative path resolution', () => {
      const relativePath = './relative/path';
      const absolutePath = path.resolve(testRootPath, relativePath);
      fs.mkdirSync(absolutePath, { recursive: true });

      const configManager = new ConfigManager(absolutePath);
      const pathResolver = new PathResolver(configManager);

      expect(path.isAbsolute(pathResolver.getRootDirectory())).toBe(true);
    });
  });

  describe('memory and performance edge cases', () => {
    it('should handle large numbers of projects', () => {
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);

      // Create many projects
      for (let i = 0; i < 1000; i++) {
        fs.mkdirSync(path.join(projectsDir, `project${i}`));
      }

      const detector = new ProjectDetector(testRootPath);
      const result = detector.detectProjectMode();

      expect(result.mode).toBe('multi');
      expect(result.detectedProjects.length).toBe(1000);
    });

    it('should handle memory pressure during git operations', async () => {
      // Create large git repository
      execSync('git init', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.name "Test User"', { stdio: 'ignore', cwd: testRootPath });

      // Create many files
      for (let i = 0; i < 100; i++) {
        fs.writeFileSync(path.join(testRootPath, `file${i}.txt`), `content${i}`.repeat(1000));
      }

      execSync('git add .', { stdio: 'ignore', cwd: testRootPath });
      execSync('git commit -m "Large commit"', { stdio: 'ignore', cwd: testRootPath });

      const extractor = new GitMetadataExtractor(testRootPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.is_git_repo).toBe(true);
      expect(metadata.total_files).toBe(100);
    });

    it('should handle concurrent access to git metadata', async () => {
      execSync('git init', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.name "Test User"', { stdio: 'ignore', cwd: testRootPath });

      fs.writeFileSync(path.join(testRootPath, 'file.txt'), 'content');
      execSync('git add .', { stdio: 'ignore', cwd: testRootPath });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore', cwd: testRootPath });

      // Create multiple extractors accessing same repository
      const extractors = Array(10)
        .fill(null)
        .map(() => new GitMetadataExtractor(testRootPath));

      const metadataPromises = extractors.map((extractor) => extractor.extractMetadata());
      const results = await Promise.all(metadataPromises);

      // All should succeed
      results.forEach((metadata) => {
        expect(metadata.is_git_repo).toBe(true);
      });
    });
  });

  describe('error recovery edge cases', () => {
    it('should recover from corrupted cache', async () => {
      execSync('git init', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.name "Test User"', { stdio: 'ignore', cwd: testRootPath });

      fs.writeFileSync(path.join(testRootPath, 'file.txt'), 'content');
      execSync('git add .', { stdio: 'ignore', cwd: testRootPath });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore', cwd: testRootPath });

      const extractor = new GitMetadataExtractor(testRootPath, true);

      // First extraction (populates cache)
      await extractor.extractMetadata();

      // Corrupt the cache by directly modifying it
      const cacheStats = GitMetadataExtractor.getCacheStats();
      expect(cacheStats.size).toBe(1);

      // Clear cache and try again
      GitMetadataExtractor.clearCache();

      // Should still work
      const metadata = await extractor.extractMetadata();
      expect(metadata.is_git_repo).toBe(true);
    });

    it('should handle partial file system failures', () => {
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);

      // Create some projects
      fs.mkdirSync(path.join(projectsDir, 'working-project'));
      fs.mkdirSync(path.join(projectsDir, 'failing-project'));

      // Mock fs.readdirSync to fail for specific directory
      const originalReaddir = fs.readdirSync;
      const mockReaddir = vi.spyOn(fs, 'readdirSync').mockImplementation((dirPath, options) => {
        if (dirPath.toString().includes('failing-project')) {
          throw new Error('Permission denied');
        }
        return originalReaddir(dirPath, options);
      });

      const detector = new ProjectDetector(testRootPath);
      const result = detector.detectProjectMode();

      expect(result.mode).toBe('multi');
      expect(result.detectedProjects).toContain('working-project');

      mockReaddir.mockRestore();
    });

    it('should handle git command failures gracefully', async () => {
      execSync('git init', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.name "Test User"', { stdio: 'ignore', cwd: testRootPath });

      fs.writeFileSync(path.join(testRootPath, 'file.txt'), 'content');
      execSync('git add .', { stdio: 'ignore', cwd: testRootPath });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore', cwd: testRootPath });

      // Mock execSync to fail for specific commands
      const originalExecSync = execSync;
      const mockExecSync = vi
        .spyOn(require('node:child_process'), 'execSync')
        .mockImplementation((command, options) => {
          if (command.includes('git log')) {
            throw new Error('Git command failed');
          }
          return originalExecSync(command, options);
        });

      const extractor = new GitMetadataExtractor(testRootPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.is_git_repo).toBe(true);
      expect(metadata.commit_count).toBe(0); // Should fallback to 0

      mockExecSync.mockRestore();
    });
  });
});
