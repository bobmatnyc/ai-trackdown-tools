/**
 * Additional Tests for GitMetadataExtractor - Multi-Project Support
 * Tests specific to multi-project scenarios and edge cases
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitMetadataExtractor } from '../src/utils/git-metadata-extractor.js';

describe('GitMetadataExtractor - Multi-Project Support', () => {
  let testRootPath: string;
  let originalCwd: string;

  beforeEach(() => {
    testRootPath = fs.mkdtempSync(path.join(tmpdir(), 'git-metadata-multiproject-test-'));
    originalCwd = process.cwd();
    process.chdir(testRootPath);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testRootPath, { recursive: true, force: true });
    GitMetadataExtractor.clearCache();
  });

  describe('multi-project git metadata extraction', () => {
    it('should extract metadata from project within projects/ directory', async () => {
      // Create projects directory structure
      const projectsDir = path.join(testRootPath, 'projects');
      const project1Dir = path.join(projectsDir, 'project1');
      fs.mkdirSync(project1Dir, { recursive: true });

      // Initialize git repo in project1
      process.chdir(project1Dir);
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
      execSync('git config user.name "Test User"', { stdio: 'ignore' });

      // Create project files
      fs.writeFileSync(
        path.join(project1Dir, 'package.json'),
        JSON.stringify({
          name: 'project1',
          dependencies: { react: '^18.0.0' },
        })
      );
      fs.mkdirSync(path.join(project1Dir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(project1Dir, 'src/App.tsx'), 'export default function App() {}');
      fs.writeFileSync(path.join(project1Dir, 'README.md'), '# Project 1');

      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });
      execSync('git remote add origin https://github.com/user/project1.git', { stdio: 'ignore' });

      // Extract metadata
      const extractor = new GitMetadataExtractor(project1Dir);
      const metadata = await extractor.extractMetadata();

      expect(metadata.is_git_repo).toBe(true);
      expect(metadata.repository_url).toBe('https://github.com/user/project1');
      expect(metadata.framework).toBe('React 18.0.0');
      expect(metadata.readme_exists).toBe(true);
      expect(metadata.languages).toContain('TypeScript');
    });

    it('should handle multiple projects with different tech stacks', async () => {
      const projectsDir = path.join(testRootPath, 'projects');

      // Create React project
      const reactProjectDir = path.join(projectsDir, 'react-app');
      fs.mkdirSync(reactProjectDir, { recursive: true });
      process.chdir(reactProjectDir);
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
      execSync('git config user.name "Test User"', { stdio: 'ignore' });

      fs.writeFileSync(
        path.join(reactProjectDir, 'package.json'),
        JSON.stringify({
          name: 'react-app',
          dependencies: { react: '^18.0.0', next: '^13.0.0' },
        })
      );
      fs.mkdirSync(path.join(reactProjectDir, 'pages'), { recursive: true });
      fs.writeFileSync(
        path.join(reactProjectDir, 'pages/index.tsx'),
        'export default function Home() {}'
      );
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      // Create Python project
      const pythonProjectDir = path.join(projectsDir, 'python-api');
      fs.mkdirSync(pythonProjectDir, { recursive: true });
      process.chdir(pythonProjectDir);
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
      execSync('git config user.name "Test User"', { stdio: 'ignore' });

      fs.writeFileSync(
        path.join(pythonProjectDir, 'requirements.txt'),
        'Django==4.2.0\ndjango-rest-framework==3.14.0'
      );
      fs.writeFileSync(path.join(pythonProjectDir, 'manage.py'), 'import django');
      fs.mkdirSync(path.join(pythonProjectDir, 'api'), { recursive: true });
      fs.writeFileSync(
        path.join(pythonProjectDir, 'api/views.py'),
        'from django.http import JsonResponse'
      );
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      // Test React project metadata
      const reactExtractor = new GitMetadataExtractor(reactProjectDir);
      const reactMetadata = await reactExtractor.extractMetadata();

      expect(reactMetadata.framework).toBe('Next.js 13.0.0');
      expect(reactMetadata.package_manager).toBe('npm');
      expect(reactMetadata.languages).toContain('TypeScript');

      // Test Python project metadata
      const pythonExtractor = new GitMetadataExtractor(pythonProjectDir);
      const pythonMetadata = await pythonExtractor.extractMetadata();

      expect(pythonMetadata.framework).toBe('Django');
      expect(pythonMetadata.package_manager).toBe('pip');
      expect(pythonMetadata.languages).toContain('Python');
    });

    it('should handle projects with nested git repositories', async () => {
      const projectsDir = path.join(testRootPath, 'projects');
      const mainProjectDir = path.join(projectsDir, 'main-project');
      const submoduleDir = path.join(mainProjectDir, 'submodule');

      fs.mkdirSync(submoduleDir, { recursive: true });

      // Initialize main project
      process.chdir(mainProjectDir);
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
      execSync('git config user.name "Test User"', { stdio: 'ignore' });

      fs.writeFileSync(path.join(mainProjectDir, 'main.py'), 'print("Main project")');
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Main project commit"', { stdio: 'ignore' });

      // Initialize submodule
      process.chdir(submoduleDir);
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
      execSync('git config user.name "Test User"', { stdio: 'ignore' });

      fs.writeFileSync(path.join(submoduleDir, 'sub.py'), 'print("Submodule")');
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Submodule commit"', { stdio: 'ignore' });

      // Test main project metadata
      const mainExtractor = new GitMetadataExtractor(mainProjectDir);
      const mainMetadata = await mainExtractor.extractMetadata();
      expect(mainMetadata.is_git_repo).toBe(true);
      expect(mainMetadata.commit_count).toBe(1);

      // Test submodule metadata
      const subExtractor = new GitMetadataExtractor(submoduleDir);
      const subMetadata = await subExtractor.extractMetadata();
      expect(subMetadata.is_git_repo).toBe(true);
      expect(subMetadata.commit_count).toBe(1);
    });
  });

  describe('performance and caching with multiple projects', () => {
    let projectDirs: string[];

    beforeEach(() => {
      const projectsDir = path.join(testRootPath, 'projects');
      projectDirs = [];

      // Create multiple projects
      for (let i = 1; i <= 3; i++) {
        const projectDir = path.join(projectsDir, `project${i}`);
        fs.mkdirSync(projectDir, { recursive: true });
        process.chdir(projectDir);

        execSync('git init', { stdio: 'ignore' });
        execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
        execSync('git config user.name "Test User"', { stdio: 'ignore' });

        fs.writeFileSync(path.join(projectDir, 'README.md'), `# Project ${i}`);
        fs.writeFileSync(path.join(projectDir, 'app.js'), `console.log('Project ${i}');`);
        execSync('git add .', { stdio: 'ignore' });
        execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

        projectDirs.push(projectDir);
      }
    });

    it('should cache metadata for multiple projects independently', async () => {
      const extractors = projectDirs.map((dir) => new GitMetadataExtractor(dir, true));

      // Extract metadata for all projects
      const metadataResults = await Promise.all(
        extractors.map((extractor) => extractor.extractMetadata())
      );

      // Verify all projects have metadata
      metadataResults.forEach((metadata, _index) => {
        expect(metadata.is_git_repo).toBe(true);
        expect(metadata.commit_count).toBe(1);
        expect(metadata.readme_exists).toBe(true);
      });

      // Verify cache has entries for all projects
      const cacheStats = GitMetadataExtractor.getCacheStats();
      expect(cacheStats.size).toBe(3);
      projectDirs.forEach((dir) => {
        expect(cacheStats.entries).toContain(dir);
      });
    });

    it('should handle cache expiration correctly', async () => {
      // Mock Date.now to control cache expiration
      const originalNow = Date.now;
      let mockTime = 1000000;
      vi.spyOn(Date, 'now').mockImplementation(() => mockTime);

      const extractor = new GitMetadataExtractor(projectDirs[0], true);

      // First extraction
      await extractor.extractMetadata();
      expect(GitMetadataExtractor.getCacheStats().size).toBe(1);

      // Advance time beyond cache TTL (5 minutes = 300000ms)
      mockTime += 400000;

      // Second extraction should refresh cache
      await extractor.extractMetadata();
      expect(GitMetadataExtractor.getCacheStats().size).toBe(1);

      // Restore original Date.now
      Date.now = originalNow;
    });
  });

  describe('error handling in multi-project scenarios', () => {
    it('should handle corrupted git repository gracefully', async () => {
      const projectDir = path.join(testRootPath, 'projects', 'corrupted-project');
      fs.mkdirSync(projectDir, { recursive: true });

      // Create a corrupted git directory
      const gitDir = path.join(projectDir, '.git');
      fs.mkdirSync(gitDir);
      fs.writeFileSync(path.join(gitDir, 'HEAD'), 'invalid content');

      const extractor = new GitMetadataExtractor(projectDir);

      // Should not throw error
      expect(async () => {
        await extractor.extractMetadata();
      }).not.toThrow();

      const metadata = await extractor.extractMetadata();
      expect(metadata.is_git_repo).toBe(false);
    });

    it('should handle permission errors gracefully', async () => {
      const projectDir = path.join(testRootPath, 'projects', 'permission-project');
      fs.mkdirSync(projectDir, { recursive: true });

      process.chdir(projectDir);
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
      execSync('git config user.name "Test User"', { stdio: 'ignore' });

      fs.writeFileSync(path.join(projectDir, 'file.txt'), 'content');
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      // Mock execSync to simulate permission error
      const originalExecSync = execSync;
      const mockExecSync = vi.fn().mockImplementation((command: string, options: any) => {
        if (command.includes('git log')) {
          throw new Error('Permission denied');
        }
        return originalExecSync(command, options);
      });

      // Temporarily replace execSync
      const { execSync: realExecSync } = require('node:child_process');
      require('node:child_process').execSync = mockExecSync;

      const extractor = new GitMetadataExtractor(projectDir);

      // Should not throw error
      expect(async () => {
        await extractor.extractMetadata();
      }).not.toThrow();

      const metadata = await extractor.extractMetadata();
      expect(metadata.is_git_repo).toBe(true);
      expect(metadata.commit_count).toBe(0); // Should fallback to 0 on error

      // Restore original execSync
      require('node:child_process').execSync = realExecSync;
    });

    it('should handle non-existent project directories', async () => {
      const nonExistentDir = path.join(testRootPath, 'projects', 'non-existent');
      const extractor = new GitMetadataExtractor(nonExistentDir);

      const metadata = await extractor.extractMetadata();
      expect(metadata.is_git_repo).toBe(false);
      expect(metadata.commit_count).toBe(0);
      expect(metadata.readme_exists).toBe(false);
    });
  });

  describe('framework detection edge cases', () => {
    it('should handle monorepo with multiple frameworks', async () => {
      const monorepoDir = path.join(testRootPath, 'projects', 'monorepo');
      fs.mkdirSync(monorepoDir, { recursive: true });

      process.chdir(monorepoDir);
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
      execSync('git config user.name "Test User"', { stdio: 'ignore' });

      // Create root package.json with multiple frameworks
      fs.writeFileSync(
        path.join(monorepoDir, 'package.json'),
        JSON.stringify({
          name: 'monorepo',
          workspaces: ['packages/*'],
          dependencies: {
            react: '^18.0.0',
            next: '^13.0.0',
            express: '^4.0.0',
          },
        })
      );

      // Create workspace packages
      const packagesDir = path.join(monorepoDir, 'packages');
      fs.mkdirSync(packagesDir, { recursive: true });

      fs.mkdirSync(path.join(packagesDir, 'frontend'));
      fs.writeFileSync(
        path.join(packagesDir, 'frontend', 'package.json'),
        JSON.stringify({
          name: 'frontend',
          dependencies: { next: '^13.0.0' },
        })
      );

      fs.mkdirSync(path.join(packagesDir, 'backend'));
      fs.writeFileSync(
        path.join(packagesDir, 'backend', 'package.json'),
        JSON.stringify({
          name: 'backend',
          dependencies: { express: '^4.0.0' },
        })
      );

      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      const extractor = new GitMetadataExtractor(monorepoDir);
      const metadata = await extractor.extractMetadata();

      // Should detect the highest priority framework (Next.js > React > Express)
      expect(metadata.framework).toBe('Next.js 13.0.0');
      expect(metadata.languages).toContain('JavaScript');
    });

    it('should handle projects with no recognizable framework', async () => {
      const projectDir = path.join(testRootPath, 'projects', 'unknown-project');
      fs.mkdirSync(projectDir, { recursive: true });

      process.chdir(projectDir);
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
      execSync('git config user.name "Test User"', { stdio: 'ignore' });

      // Create files with unknown extensions
      fs.writeFileSync(path.join(projectDir, 'main.xyz'), 'unknown language');
      fs.writeFileSync(path.join(projectDir, 'config.abc'), 'configuration');

      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      const extractor = new GitMetadataExtractor(projectDir);
      const metadata = await extractor.extractMetadata();

      expect(metadata.framework).toBeUndefined();
      expect(metadata.languages).toEqual([]);
      expect(metadata.package_manager).toBeUndefined();
    });
  });

  describe('cross-project collaboration detection', () => {
    it('should detect shared contributors across projects', async () => {
      const projectsDir = path.join(testRootPath, 'projects');
      const project1Dir = path.join(projectsDir, 'project1');
      const project2Dir = path.join(projectsDir, 'project2');

      fs.mkdirSync(project1Dir, { recursive: true });
      fs.mkdirSync(project2Dir, { recursive: true });

      // Setup project1 with multiple contributors
      process.chdir(project1Dir);
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.email "alice@example.com"', { stdio: 'ignore' });
      execSync('git config user.name "Alice"', { stdio: 'ignore' });

      fs.writeFileSync(path.join(project1Dir, 'file1.txt'), 'content1');
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "First commit by Alice"', { stdio: 'ignore' });

      execSync('git config user.email "bob@example.com"', { stdio: 'ignore' });
      execSync('git config user.name "Bob"', { stdio: 'ignore' });

      fs.writeFileSync(path.join(project1Dir, 'file2.txt'), 'content2');
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Second commit by Bob"', { stdio: 'ignore' });

      // Setup project2 with overlapping contributors
      process.chdir(project2Dir);
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.email "bob@example.com"', { stdio: 'ignore' });
      execSync('git config user.name "Bob"', { stdio: 'ignore' });

      fs.writeFileSync(path.join(project2Dir, 'file3.txt'), 'content3');
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "First commit by Bob"', { stdio: 'ignore' });

      execSync('git config user.email "charlie@example.com"', { stdio: 'ignore' });
      execSync('git config user.name "Charlie"', { stdio: 'ignore' });

      fs.writeFileSync(path.join(project2Dir, 'file4.txt'), 'content4');
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Second commit by Charlie"', { stdio: 'ignore' });

      // Extract metadata from both projects
      const extractor1 = new GitMetadataExtractor(project1Dir);
      const extractor2 = new GitMetadataExtractor(project2Dir);

      const metadata1 = await extractor1.extractMetadata();
      const metadata2 = await extractor2.extractMetadata();

      // Verify contributors
      expect(metadata1.team_members).toContain('Alice');
      expect(metadata1.team_members).toContain('Bob');
      expect(metadata2.team_members).toContain('Bob');
      expect(metadata2.team_members).toContain('Charlie');

      // Verify shared contributor (Bob) appears in both projects
      expect(metadata1.team_members).toContain('Bob');
      expect(metadata2.team_members).toContain('Bob');
    });
  });

  describe('project metadata population for multi-project scenarios', () => {
    it('should populate project frontmatter with multi-project context', async () => {
      const projectDir = path.join(testRootPath, 'projects', 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      process.chdir(projectDir);
      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
      execSync('git config user.name "Test User"', { stdio: 'ignore' });

      fs.writeFileSync(
        path.join(projectDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          dependencies: { vue: '^3.0.0' },
        })
      );
      fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'src/App.vue'), '<template><div>App</div></template>');
      fs.writeFileSync(path.join(projectDir, 'LICENSE'), 'MIT License');

      execSync('git remote add origin https://github.com/user/test-project.git', {
        stdio: 'ignore',
      });
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      const extractor = new GitMetadataExtractor(projectDir);
      const result = await extractor.populateProjectFrontmatter({
        title: 'Test Multi-Project',
        description: 'A test project in multi-project setup',
        project_id: 'MP-001',
        related_projects: ['MP-002', 'MP-003'],
      });

      expect(result.title).toBe('Test Multi-Project');
      expect(result.project_id).toBe('MP-001');
      expect(result.repository_url).toBe('https://github.com/user/test-project');
      expect(result.framework).toBe('Vue.js 3.0.0');
      expect(result.license).toBe('MIT');
      expect(result.languages).toContain('Vue');
      expect(result.related_projects).toEqual(['MP-002', 'MP-003']);
    });
  });
});
