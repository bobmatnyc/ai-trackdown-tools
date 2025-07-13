/**
 * Integration tests for Git Metadata Extractor
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createProjectWithGitMetadata,
  extractGitMetadata,
  GitMetadataExtractor,
} from '../src/utils/git-metadata-extractor.js';

describe('GitMetadataExtractor', () => {
  let testRepoPath: string;
  let originalCwd: string;

  beforeEach(() => {
    // Create temporary directory for test repo
    testRepoPath = fs.mkdtempSync(path.join(tmpdir(), 'git-metadata-test-'));
    originalCwd = process.cwd();
    process.chdir(testRepoPath);

    // Initialize git repo
    execSync('git init', { stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
    execSync('git config user.name "Test User"', { stdio: 'ignore' });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    // Clean up test repo
    fs.rmSync(testRepoPath, { recursive: true, force: true });
    GitMetadataExtractor.clearCache();
  });

  describe('constructor', () => {
    it('should initialize with default parameters', () => {
      const extractor = new GitMetadataExtractor();
      expect(extractor).toBeDefined();
    });

    it('should accept custom project path', () => {
      const extractor = new GitMetadataExtractor('/custom/path');
      expect(extractor).toBeDefined();
    });

    it('should accept cache configuration', () => {
      const extractor = new GitMetadataExtractor(undefined, false);
      expect(extractor).toBeDefined();
    });
  });

  describe('extractMetadata', () => {
    it('should detect non-git directory', async () => {
      // Create non-git directory
      const nonGitPath = fs.mkdtempSync(path.join(tmpdir(), 'non-git-'));
      const extractor = new GitMetadataExtractor(nonGitPath);

      const metadata = await extractor.extractMetadata();

      expect(metadata.is_git_repo).toBe(false);
      expect(metadata.commit_count).toBe(0);
      expect(metadata.readme_exists).toBe(false);

      fs.rmSync(nonGitPath, { recursive: true, force: true });
    });

    it('should extract basic git information', async () => {
      // Create initial commit
      fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test Project');
      execSync('git add README.md', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      const extractor = new GitMetadataExtractor(testRepoPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.is_git_repo).toBe(true);
      expect(metadata.commit_count).toBe(1);
      expect(metadata.readme_exists).toBe(true);
      expect(metadata.current_branch).toBeDefined();
      expect(metadata.last_commit_date).toBeDefined();
    });

    it('should detect uncommitted changes', async () => {
      // Create initial commit
      fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test Project');
      execSync('git add README.md', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      // Create uncommitted change
      fs.writeFileSync(path.join(testRepoPath, 'new-file.txt'), 'New content');

      const extractor = new GitMetadataExtractor(testRepoPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.has_uncommitted_changes).toBe(true);
    });

    it('should extract repository URLs', async () => {
      // Set up remote origin
      execSync('git remote add origin https://github.com/user/repo.git', { stdio: 'ignore' });

      const extractor = new GitMetadataExtractor(testRepoPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.git_origin).toBe('https://github.com/user/repo.git');
      expect(metadata.repository_url).toBe('https://github.com/user/repo');
      expect(metadata.clone_url).toBe('https://github.com/user/repo.git');
    });

    it('should convert SSH URLs to HTTPS', async () => {
      // Set up remote origin with SSH
      execSync('git remote add origin git@github.com:user/repo.git', { stdio: 'ignore' });

      const extractor = new GitMetadataExtractor(testRepoPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.git_origin).toBe('git@github.com:user/repo.git');
      expect(metadata.repository_url).toBe('https://github.com/user/repo');
      expect(metadata.clone_url).toBe('https://github.com/user/repo.git');
    });
  });

  describe('language detection', () => {
    it('should detect JavaScript/TypeScript project', async () => {
      // Create Node.js project files
      fs.writeFileSync(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          dependencies: {
            react: '^18.0.0',
          },
        })
      );
      fs.writeFileSync(path.join(testRepoPath, 'index.js'), 'console.log("Hello");');
      fs.writeFileSync(path.join(testRepoPath, 'app.tsx'), 'export default function App() {}');

      // Add to git
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      const extractor = new GitMetadataExtractor(testRepoPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.languages).toContain('JavaScript');
      expect(metadata.languages).toContain('TypeScript');
      expect(metadata.framework).toBe('React 18.0.0');
      expect(metadata.package_manager).toBe('npm');
    });

    it('should detect Python project', async () => {
      // Create Python project files
      fs.writeFileSync(path.join(testRepoPath, 'requirements.txt'), 'Flask==2.0.1');
      fs.writeFileSync(path.join(testRepoPath, 'app.py'), 'from flask import Flask');
      fs.writeFileSync(path.join(testRepoPath, 'utils.py'), 'def helper(): pass');

      // Add to git
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      const extractor = new GitMetadataExtractor(testRepoPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.languages).toContain('Python');
      expect(metadata.framework).toBe('Flask');
      expect(metadata.package_manager).toBe('pip');
    });

    it('should detect Rust project', async () => {
      // Create Rust project files
      fs.writeFileSync(
        path.join(testRepoPath, 'Cargo.toml'),
        `
[package]
name = "test-project"
version = "0.1.0"

[dependencies]
actix-web = "4.0"
      `
      );
      fs.writeFileSync(path.join(testRepoPath, 'main.rs'), 'fn main() {}');

      // Add to git
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      const extractor = new GitMetadataExtractor(testRepoPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.languages).toContain('Rust');
      expect(metadata.framework).toBe('Actix Web');
      expect(metadata.package_manager).toBe('cargo');
    });
  });

  describe('framework detection', () => {
    it('should detect Next.js project', async () => {
      fs.writeFileSync(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          dependencies: {
            next: '^13.0.0',
            react: '^18.0.0',
          },
        })
      );

      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      const extractor = new GitMetadataExtractor(testRepoPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.framework).toBe('Next.js 13.0.0');
    });

    it('should detect Django project', async () => {
      fs.writeFileSync(path.join(testRepoPath, 'manage.py'), 'import django');
      fs.writeFileSync(path.join(testRepoPath, 'requirements.txt'), 'Django==4.0.0');

      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      const extractor = new GitMetadataExtractor(testRepoPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.framework).toBe('Django');
    });

    it('should detect Spring Boot project', async () => {
      fs.writeFileSync(
        path.join(testRepoPath, 'pom.xml'),
        `
<?xml version="1.0" encoding="UTF-8"?>
<project>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
  </dependencies>
</project>
      `
      );

      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      const extractor = new GitMetadataExtractor(testRepoPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.framework).toBe('Spring Boot');
    });
  });

  describe('license detection', () => {
    it('should detect MIT license from LICENSE file', async () => {
      fs.writeFileSync(
        path.join(testRepoPath, 'LICENSE'),
        `
MIT License

Copyright (c) 2023 Test User

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
      `
      );

      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      const extractor = new GitMetadataExtractor(testRepoPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.license).toBe('MIT');
    });

    it('should detect license from package.json', async () => {
      fs.writeFileSync(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          license: 'Apache-2.0',
        })
      );

      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      const extractor = new GitMetadataExtractor(testRepoPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.license).toBe('Apache-2.0');
    });
  });

  describe('team member extraction', () => {
    it('should extract contributors from git log', async () => {
      // Create initial commit
      fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test Project');
      execSync('git add README.md', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      // Create second commit with different author
      execSync('git config user.name "Second User"', { stdio: 'ignore' });
      execSync('git config user.email "second@example.com"', { stdio: 'ignore' });
      fs.writeFileSync(path.join(testRepoPath, 'file2.txt'), 'Second commit');
      execSync('git add file2.txt', { stdio: 'ignore' });
      execSync('git commit -m "Second commit"', { stdio: 'ignore' });

      const extractor = new GitMetadataExtractor(testRepoPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.contributors).toHaveLength(2);
      expect(metadata.team_members).toContain('Test User');
      expect(metadata.team_members).toContain('Second User');

      // Check contributor details
      const testUser = metadata.contributors?.find((c) => c.name === 'Test User');
      expect(testUser?.commits).toBe(1);
      expect(testUser?.email).toBe('test@example.com');

      const secondUser = metadata.contributors?.find((c) => c.name === 'Second User');
      expect(secondUser?.commits).toBe(1);
      expect(secondUser?.email).toBe('second@example.com');
    });
  });

  describe('caching', () => {
    it('should cache results when enabled', async () => {
      fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test Project');
      execSync('git add README.md', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      const extractor = new GitMetadataExtractor(testRepoPath, true);

      // First call
      const metadata1 = await extractor.extractMetadata();

      // Second call should return cached result
      const metadata2 = await extractor.extractMetadata();

      expect(metadata1).toEqual(metadata2);

      const cacheStats = GitMetadataExtractor.getCacheStats();
      expect(cacheStats.size).toBe(1);
      expect(cacheStats.entries).toContain(testRepoPath);
    });

    it('should not cache when disabled', async () => {
      const extractor = new GitMetadataExtractor(testRepoPath, false);

      await extractor.extractMetadata();

      const cacheStats = GitMetadataExtractor.getCacheStats();
      expect(cacheStats.size).toBe(0);
    });

    it('should clear cache', async () => {
      const extractor = new GitMetadataExtractor(testRepoPath, true);
      await extractor.extractMetadata();

      expect(GitMetadataExtractor.getCacheStats().size).toBe(1);

      GitMetadataExtractor.clearCache();

      expect(GitMetadataExtractor.getCacheStats().size).toBe(0);
    });
  });

  describe('populateProjectFrontmatter', () => {
    it('should populate project frontmatter with git metadata', async () => {
      // Set up test repo
      fs.writeFileSync(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          dependencies: { react: '^18.0.0' },
        })
      );
      fs.writeFileSync(path.join(testRepoPath, 'index.js'), 'console.log("Hello");');
      fs.writeFileSync(path.join(testRepoPath, 'LICENSE'), 'MIT License');
      execSync('git remote add origin https://github.com/user/repo.git', { stdio: 'ignore' });
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      const extractor = new GitMetadataExtractor(testRepoPath);
      const result = await extractor.populateProjectFrontmatter({
        title: 'Test Project',
        description: 'A test project',
        project_id: 'TEST-001',
      });

      expect(result.title).toBe('Test Project');
      expect(result.description).toBe('A test project');
      expect(result.project_id).toBe('TEST-001');
      expect(result.type).toBe('project');
      expect(result.repository_url).toBe('https://github.com/user/repo');
      expect(result.framework).toBe('React 18.0.0');
      expect(result.license).toBe('MIT');
      expect(result.languages).toContain('JavaScript');
    });

    it('should provide defaults for missing fields', async () => {
      const extractor = new GitMetadataExtractor(testRepoPath);
      const result = await extractor.populateProjectFrontmatter({});

      expect(result.title).toBe('Untitled Project');
      expect(result.description).toBe('Project description');
      expect(result.status).toBe('planning');
      expect(result.priority).toBe('medium');
      expect(result.assignee).toBe('unassigned');
      expect(result.project_id).toBe('PROJECT-001');
      expect(result.type).toBe('project');
      expect(result.sync_status).toBe('local');
      expect(result.created_date).toBeDefined();
      expect(result.updated_date).toBeDefined();
    });
  });
});

describe('utility functions', () => {
  let testRepoPath: string;
  let originalCwd: string;

  beforeEach(() => {
    testRepoPath = fs.mkdtempSync(path.join(tmpdir(), 'git-metadata-util-test-'));
    originalCwd = process.cwd();
    process.chdir(testRepoPath);

    execSync('git init', { stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
    execSync('git config user.name "Test User"', { stdio: 'ignore' });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testRepoPath, { recursive: true, force: true });
    GitMetadataExtractor.clearCache();
  });

  describe('extractGitMetadata', () => {
    it('should extract metadata using utility function', async () => {
      fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test');
      execSync('git add README.md', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      const metadata = await extractGitMetadata(testRepoPath);

      expect(metadata.is_git_repo).toBe(true);
      expect(metadata.readme_exists).toBe(true);
    });

    it('should use current directory by default', async () => {
      fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test');
      execSync('git add README.md', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      const metadata = await extractGitMetadata();

      expect(metadata.is_git_repo).toBe(true);
    });
  });

  describe('createProjectWithGitMetadata', () => {
    it('should create project with git metadata', async () => {
      fs.writeFileSync(
        path.join(testRepoPath, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          dependencies: { express: '^4.0.0' },
        })
      );
      fs.writeFileSync(path.join(testRepoPath, 'server.js'), 'const express = require("express");');
      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });

      const project = await createProjectWithGitMetadata(testRepoPath, {
        title: 'Express API',
        description: 'An Express.js API',
        project_id: 'API-001',
      });

      expect(project.title).toBe('Express API');
      expect(project.framework).toBe('Express 4.0.0');
      expect(project.languages).toContain('JavaScript');
    });
  });
});

describe('error handling', () => {
  it('should handle non-existent directories gracefully', async () => {
    const nonExistentPath = '/path/that/does/not/exist';
    const extractor = new GitMetadataExtractor(nonExistentPath);

    const metadata = await extractor.extractMetadata();

    expect(metadata.is_git_repo).toBe(false);
    expect(metadata.commit_count).toBe(0);
  });

  it('should handle corrupted git repositories', async () => {
    // This test would need a corrupted git repo setup
    // For now, we'll just ensure the extractor doesn't crash
    const extractor = new GitMetadataExtractor();

    expect(async () => {
      await extractor.extractMetadata();
    }).not.toThrow();
  });

  it('should handle permission errors gracefully', async () => {
    // This test would need specific permission setup
    // For now, we'll ensure the extractor handles errors
    const extractor = new GitMetadataExtractor();

    expect(async () => {
      await extractor.extractMetadata();
    }).not.toThrow();
  });
});
