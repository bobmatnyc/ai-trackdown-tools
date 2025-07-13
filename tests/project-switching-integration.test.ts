/**
 * Integration Tests for Project Switching Workflows
 * Tests end-to-end project switching scenarios and workflows
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitMetadataExtractor } from '../src/utils/git-metadata-extractor.js';
import { ProjectContextManager } from '../src/utils/project-context-manager.js';

describe('Project Switching Integration Tests', () => {
  let testRootPath: string;
  let originalCwd: string;
  let contextManager: ProjectContextManager;

  beforeEach(() => {
    testRootPath = fs.mkdtempSync(path.join(tmpdir(), 'project-switching-test-'));
    originalCwd = process.cwd();
    process.chdir(testRootPath);

    contextManager = new ProjectContextManager(testRootPath);

    // Clear environment variables
    delete process.env.AITRACKDOWN_PROJECT_MODE;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testRootPath, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('single to multi-project migration', () => {
    it('should migrate from single-project to multi-project mode', async () => {
      // Start in single-project mode
      await contextManager.initializeContext();
      expect(contextManager.getProjectMode()).toBe('single');

      // Create some issues and epics in single mode
      await contextManager.ensureProjectStructure();
      const singlePaths = contextManager.getPaths();

      fs.writeFileSync(
        path.join(singlePaths.issuesDir, 'ISS-001-single-issue.md'),
        '---\nissue_id: ISS-001\ntitle: Single Issue\n---\n# Single Issue'
      );
      fs.writeFileSync(
        path.join(singlePaths.epicsDir, 'EP-001-single-epic.md'),
        '---\nepic_id: EP-001\ntitle: Single Epic\n---\n# Single Epic'
      );

      // Create projects/ directory to trigger multi-project mode
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));
      fs.mkdirSync(path.join(projectsDir, 'project2'));

      // Re-initialize context to pick up multi-project mode
      contextManager.reset();
      await contextManager.initializeContext('project1');

      expect(contextManager.getProjectMode()).toBe('multi');
      expect(contextManager.getCurrentContext()?.context.currentProject).toBe('project1');

      // Verify multi-project paths
      const multiPaths = contextManager.getPaths();
      expect(multiPaths.projectRoot).toBe(path.join(projectsDir, 'project1'));
      expect(multiPaths.configDir).toBe(path.join(projectsDir, 'project1', '.ai-trackdown'));
    });

    it('should preserve existing single-project data during migration', async () => {
      // Setup single-project with data
      await contextManager.initializeContext();
      await contextManager.ensureProjectStructure();

      const singlePaths = contextManager.getPaths();
      const issueContent = '---\nissue_id: ISS-001\ntitle: Original Issue\n---\n# Original Issue';
      fs.writeFileSync(path.join(singlePaths.issuesDir, 'ISS-001-original.md'), issueContent);

      // Verify single-project data exists
      expect(fs.existsSync(path.join(singlePaths.issuesDir, 'ISS-001-original.md'))).toBe(true);

      // Migrate to multi-project by creating projects/ directory
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'migrated-project'));

      // Original single-project data should still exist
      expect(fs.existsSync(path.join(singlePaths.issuesDir, 'ISS-001-original.md'))).toBe(true);

      // Switch to multi-project mode
      contextManager.reset();
      await contextManager.initializeContext('migrated-project');

      // New project should have separate directory structure
      const multiPaths = contextManager.getPaths();
      expect(multiPaths.projectRoot).toBe(path.join(projectsDir, 'migrated-project'));
      expect(multiPaths.issuesDir).not.toBe(singlePaths.issuesDir);
    });
  });

  describe('multi-project workflows', () => {
    let projectsDir: string;

    beforeEach(async () => {
      // Setup multi-project structure
      projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);

      // Create multiple projects with different tech stacks
      await createProjectWithGitRepo('frontend', {
        'package.json': JSON.stringify({
          name: 'frontend',
          dependencies: { react: '^18.0.0', typescript: '^4.9.0' },
        }),
        'src/App.tsx': 'export default function App() { return <div>Frontend</div>; }',
        'README.md': '# Frontend Project',
      });

      await createProjectWithGitRepo('backend', {
        'requirements.txt': 'Django==4.2.0\ndjango-rest-framework==3.14.0',
        'manage.py': 'import django',
        'api/models.py': 'from django.db import models',
        'README.md': '# Backend API',
      });

      await createProjectWithGitRepo('mobile', {
        'package.json': JSON.stringify({
          name: 'mobile',
          dependencies: { 'react-native': '^0.72.0' },
        }),
        'App.tsx': 'import React from "react"; export default function App() {}',
        'README.md': '# Mobile App',
      });
    });

    async function createProjectWithGitRepo(projectName: string, files: Record<string, string>) {
      const projectPath = path.join(projectsDir, projectName);
      fs.mkdirSync(projectPath, { recursive: true });

      // Create files
      for (const [filename, content] of Object.entries(files)) {
        const filePath = path.join(projectPath, filename);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content);
      }

      // Initialize git repo
      const originalCwd = process.cwd();
      process.chdir(projectPath);
      try {
        execSync('git init', { stdio: 'ignore' });
        execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
        execSync('git config user.name "Test User"', { stdio: 'ignore' });
        execSync('git add .', { stdio: 'ignore' });
        execSync('git commit -m "Initial commit"', { stdio: 'ignore' });
        execSync(`git remote add origin https://github.com/test/${projectName}.git`, {
          stdio: 'ignore',
        });
      } finally {
        process.chdir(originalCwd);
      }
    }

    it('should switch between projects with different contexts', async () => {
      // Start with frontend project
      await contextManager.initializeContext('frontend');
      expect(contextManager.getCurrentContext()?.context.currentProject).toBe('frontend');

      // Ensure structure and create frontend-specific items
      await contextManager.ensureProjectStructure();
      const frontendPaths = contextManager.getPaths();

      fs.writeFileSync(
        path.join(frontendPaths.issuesDir, 'ISS-001-frontend-issue.md'),
        '---\nissue_id: ISS-001\ntitle: Frontend Issue\n---\n# Frontend Issue'
      );

      // Switch to backend project
      await contextManager.switchProject('backend');
      expect(contextManager.getCurrentContext()?.context.currentProject).toBe('backend');

      // Ensure structure and create backend-specific items
      await contextManager.ensureProjectStructure();
      const backendPaths = contextManager.getPaths();

      fs.writeFileSync(
        path.join(backendPaths.issuesDir, 'ISS-001-backend-issue.md'),
        '---\nissue_id: ISS-001\ntitle: Backend Issue\n---\n# Backend Issue'
      );

      // Verify projects have separate contexts
      expect(frontendPaths.projectRoot).not.toBe(backendPaths.projectRoot);
      expect(frontendPaths.issuesDir).not.toBe(backendPaths.issuesDir);

      // Verify files exist in correct projects
      expect(fs.existsSync(path.join(frontendPaths.issuesDir, 'ISS-001-frontend-issue.md'))).toBe(
        true
      );
      expect(fs.existsSync(path.join(backendPaths.issuesDir, 'ISS-001-backend-issue.md'))).toBe(
        true
      );

      // Verify cross-project isolation
      expect(fs.existsSync(path.join(frontendPaths.issuesDir, 'ISS-001-backend-issue.md'))).toBe(
        false
      );
      expect(fs.existsSync(path.join(backendPaths.issuesDir, 'ISS-001-frontend-issue.md'))).toBe(
        false
      );
    });

    it('should extract correct git metadata for each project', async () => {
      // Test frontend project metadata
      await contextManager.initializeContext('frontend');
      const frontendPaths = contextManager.getPaths();

      const frontendExtractor = new GitMetadataExtractor(frontendPaths.projectRoot);
      const frontendMetadata = await frontendExtractor.extractMetadata();

      expect(frontendMetadata.is_git_repo).toBe(true);
      expect(frontendMetadata.repository_url).toBe('https://github.com/test/frontend');
      expect(frontendMetadata.framework).toBe('React 18.0.0');
      expect(frontendMetadata.languages).toContain('TypeScript');

      // Test backend project metadata
      await contextManager.switchProject('backend');
      const backendPaths = contextManager.getPaths();

      const backendExtractor = new GitMetadataExtractor(backendPaths.projectRoot);
      const backendMetadata = await backendExtractor.extractMetadata();

      expect(backendMetadata.is_git_repo).toBe(true);
      expect(backendMetadata.repository_url).toBe('https://github.com/test/backend');
      expect(backendMetadata.framework).toBe('Django');
      expect(backendMetadata.languages).toContain('Python');

      // Test mobile project metadata
      await contextManager.switchProject('mobile');
      const mobilePaths = contextManager.getPaths();

      const mobileExtractor = new GitMetadataExtractor(mobilePaths.projectRoot);
      const mobileMetadata = await mobileExtractor.extractMetadata();

      expect(mobileMetadata.is_git_repo).toBe(true);
      expect(mobileMetadata.repository_url).toBe('https://github.com/test/mobile');
      expect(mobileMetadata.framework).toBe('React Native');
      expect(mobileMetadata.languages).toContain('TypeScript');
    });

    it('should handle project-specific configurations', async () => {
      // Setup frontend project with specific config
      await contextManager.initializeContext('frontend');
      await contextManager.ensureProjectStructure();

      const frontendConfigManager = contextManager.getConfigManager();
      const frontendConfig = frontendConfigManager.getConfig();
      frontendConfig.name = 'Frontend Application';
      frontendConfig.version = '1.0.0';
      frontendConfigManager.saveConfig(frontendConfig);

      // Setup backend project with different config
      await contextManager.switchProject('backend');
      await contextManager.ensureProjectStructure();

      const backendConfigManager = contextManager.getConfigManager();
      const backendConfig = backendConfigManager.getConfig();
      backendConfig.name = 'Backend API';
      backendConfig.version = '2.0.0';
      backendConfigManager.saveConfig(backendConfig);

      // Verify configs are separate
      const frontendFinalConfig = frontendConfigManager.getConfig();
      const backendFinalConfig = backendConfigManager.getConfig();

      expect(frontendFinalConfig.name).toBe('Frontend Application');
      expect(frontendFinalConfig.version).toBe('1.0.0');
      expect(backendFinalConfig.name).toBe('Backend API');
      expect(backendFinalConfig.version).toBe('2.0.0');
    });

    it('should support cross-project operations', async () => {
      const projects = ['frontend', 'backend', 'mobile'];
      const projectMetadata: Record<string, any> = {};

      // Collect metadata from all projects
      for (const projectName of projects) {
        await contextManager.initializeContext(projectName);
        await contextManager.ensureProjectStructure();

        const paths = contextManager.getPaths();
        const extractor = new GitMetadataExtractor(paths.projectRoot);
        const metadata = await extractor.extractMetadata();

        projectMetadata[projectName] = {
          paths,
          metadata,
          config: contextManager.getConfigManager().getConfig(),
        };
      }

      // Verify each project has unique characteristics
      expect(projectMetadata.frontend.metadata.framework).toBe('React 18.0.0');
      expect(projectMetadata.backend.metadata.framework).toBe('Django');
      expect(projectMetadata.mobile.metadata.framework).toBe('React Native');

      // Verify paths are unique
      const projectRoots = Object.values(projectMetadata).map((p) => p.paths.projectRoot);
      expect(new Set(projectRoots).size).toBe(3); // All unique

      // Verify git metadata is project-specific
      Object.entries(projectMetadata).forEach(([projectName, data]) => {
        expect(data.metadata.repository_url).toBe(`https://github.com/test/${projectName}`);
      });
    });
  });

  describe('project creation and initialization workflows', () => {
    beforeEach(async () => {
      // Setup initial multi-project structure
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'existing-project'));

      await contextManager.initializeContext('existing-project');
    });

    it('should create new project and initialize with git metadata', async () => {
      // Create new project
      const newContext = await contextManager.createProject('new-project');
      expect(newContext.context.currentProject).toBe('new-project');

      // Initialize git repo in new project
      const projectPath = newContext.paths.projectRoot;
      process.chdir(projectPath);

      execSync('git init', { stdio: 'ignore' });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore' });
      execSync('git config user.name "Test User"', { stdio: 'ignore' });

      // Create project files
      fs.writeFileSync(
        path.join(projectPath, 'package.json'),
        JSON.stringify({
          name: 'new-project',
          dependencies: { express: '^4.18.0' },
        })
      );
      fs.writeFileSync(path.join(projectPath, 'server.js'), 'const express = require("express");');

      execSync('git add .', { stdio: 'ignore' });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore' });
      execSync('git remote add origin https://github.com/test/new-project.git', {
        stdio: 'ignore',
      });

      // Extract metadata
      const extractor = new GitMetadataExtractor(projectPath);
      const metadata = await extractor.extractMetadata();

      expect(metadata.is_git_repo).toBe(true);
      expect(metadata.repository_url).toBe('https://github.com/test/new-project');
      expect(metadata.framework).toBe('Express 4.18.0');
      expect(metadata.languages).toContain('JavaScript');

      // Verify project structure
      await contextManager.ensureProjectStructure();
      const paths = contextManager.getPaths();

      expect(fs.existsSync(paths.configDir)).toBe(true);
      expect(fs.existsSync(paths.epicsDir)).toBe(true);
      expect(fs.existsSync(paths.issuesDir)).toBe(true);
    });

    it('should handle rapid project switching', async () => {
      // Create multiple projects
      const projectNames = ['rapid1', 'rapid2', 'rapid3'];

      for (const projectName of projectNames) {
        await contextManager.createProject(projectName);
        await contextManager.ensureProjectStructure();

        // Create unique content in each project
        const paths = contextManager.getPaths();
        fs.writeFileSync(
          path.join(paths.issuesDir, `${projectName}-issue.md`),
          `---\nissue_id: ${projectName.toUpperCase()}-001\ntitle: ${projectName} Issue\n---\n# ${projectName} Issue`
        );
      }

      // Rapidly switch between projects and verify context
      for (let i = 0; i < 3; i++) {
        for (const projectName of projectNames) {
          await contextManager.switchProject(projectName);

          const context = contextManager.getCurrentContext();
          expect(context?.context.currentProject).toBe(projectName);

          const paths = contextManager.getPaths();
          expect(fs.existsSync(path.join(paths.issuesDir, `${projectName}-issue.md`))).toBe(true);

          // Verify isolation - other projects' files should not exist
          const otherProjects = projectNames.filter((p) => p !== projectName);
          for (const otherProject of otherProjects) {
            expect(fs.existsSync(path.join(paths.issuesDir, `${otherProject}-issue.md`))).toBe(
              false
            );
          }
        }
      }
    });
  });

  describe('error handling and recovery', () => {
    it('should handle corrupted project directory', async () => {
      // Setup multi-project structure
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'good-project'));
      fs.mkdirSync(path.join(projectsDir, 'corrupted-project'));

      await contextManager.initializeContext('good-project');

      // Corrupt the project directory by making it a file
      fs.rmSync(path.join(projectsDir, 'corrupted-project'), { recursive: true });
      fs.writeFileSync(path.join(projectsDir, 'corrupted-project'), 'not a directory');

      // Should handle corruption gracefully
      await expect(contextManager.switchProject('corrupted-project')).rejects.toThrow();

      // Should still be able to work with good project
      await contextManager.switchProject('good-project');
      expect(contextManager.getCurrentContext()?.context.currentProject).toBe('good-project');
    });

    it('should handle missing projects directory', async () => {
      // Setup multi-project structure
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));

      await contextManager.initializeContext('project1');

      // Remove entire projects directory
      fs.rmSync(projectsDir, { recursive: true });

      // Should handle gracefully
      const validation = contextManager.validateContext();
      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('should recover from invalid context state', async () => {
      // Setup normal multi-project structure
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));

      await contextManager.initializeContext('project1');

      // Force invalid state by removing project after initialization
      fs.rmSync(path.join(projectsDir, 'project1'), { recursive: true });

      // Reset and re-initialize should recover
      contextManager.reset();

      // Since project1 no longer exists, this should now be single-project mode
      const newContext = await contextManager.initializeContext();
      expect(newContext.context.mode).toBe('single');
    });
  });

  describe('environment and configuration handling', () => {
    it('should respect environment variable overrides during switching', async () => {
      // Setup multi-project structure
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));

      await contextManager.initializeContext('project1');
      expect(contextManager.getProjectMode()).toBe('multi');

      // Set environment variable to force single mode
      process.env.AITRACKDOWN_PROJECT_MODE = 'single';

      // Reset and reinitialize
      contextManager.reset();
      await contextManager.initializeContext();

      expect(contextManager.getProjectMode()).toBe('single');
    });

    it('should handle configuration inheritance in multi-project mode', async () => {
      // Setup multi-project structure
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));
      fs.mkdirSync(path.join(projectsDir, 'project2'));

      // Create root-level config
      const rootConfigPath = path.join(testRootPath, '.ai-trackdown', 'config.json');
      fs.mkdirSync(path.dirname(rootConfigPath), { recursive: true });
      fs.writeFileSync(
        rootConfigPath,
        JSON.stringify({
          global_setting: 'root_value',
          project_mode: 'multi',
        })
      );

      // Initialize project1
      await contextManager.initializeContext('project1');
      await contextManager.ensureProjectStructure();

      // Project should have its own config but inherit some global settings
      const project1Config = contextManager.getConfigManager().getConfig();
      expect(project1Config).toBeDefined();

      // Switch to project2
      await contextManager.switchProject('project2');
      await contextManager.ensureProjectStructure();

      const project2Config = contextManager.getConfigManager().getConfig();
      expect(project2Config).toBeDefined();

      // Both projects should have separate configs
      expect(project1Config !== project2Config).toBe(true);
    });
  });
});
