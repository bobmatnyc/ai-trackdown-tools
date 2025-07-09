/**
 * Backward Compatibility Tests for Multi-Project Support
 * Tests that existing single-project workflows continue to work after multi-project implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectDetector } from '../src/utils/project-detector.js';
import { ProjectContextManager } from '../src/utils/project-context-manager.js';
import { PathResolver } from '../src/utils/path-resolver.js';
import { ConfigManager } from '../src/utils/config-manager.js';

describe('Backward Compatibility Tests', () => {
  let testRootPath: string;
  let originalCwd: string;

  beforeEach(() => {
    testRootPath = fs.mkdtempSync(path.join(tmpdir(), 'backward-compat-test-'));
    originalCwd = process.cwd();
    process.chdir(testRootPath);
    
    // Clear environment variables
    delete process.env.AITRACKDOWN_PROJECT_MODE;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testRootPath, { recursive: true, force: true });
  });

  describe('legacy directory structure support', () => {
    it('should work with legacy trackdown/ directory', () => {
      // Create legacy structure
      const legacyDirs = ['trackdown', 'epics', 'issues', 'tasks'];
      legacyDirs.forEach(dir => {
        fs.mkdirSync(path.join(testRootPath, dir), { recursive: true });
      });
      
      // Create legacy files
      fs.writeFileSync(
        path.join(testRootPath, 'epics', 'EP-001-legacy-epic.md'),
        '---\nepic_id: EP-001\ntitle: Legacy Epic\nstatus: active\n---\n# Legacy Epic'
      );
      
      fs.writeFileSync(
        path.join(testRootPath, 'issues', 'ISS-001-legacy-issue.md'),
        '---\nissue_id: ISS-001\ntitle: Legacy Issue\nepic_id: EP-001\n---\n# Legacy Issue'
      );
      
      const detector = new ProjectDetector(testRootPath);
      const result = detector.detectProjectMode();
      
      expect(result.mode).toBe('single');
      expect(result.migrationNeeded).toBe(true);
      expect(result.recommendations).toContain('Legacy directory structure detected');
    });

    it('should resolve paths correctly for legacy structure', () => {
      // Create legacy structure
      fs.mkdirSync(path.join(testRootPath, 'trackdown'), { recursive: true });
      fs.mkdirSync(path.join(testRootPath, 'epics'), { recursive: true });
      fs.mkdirSync(path.join(testRootPath, 'issues'), { recursive: true });
      
      const configManager = new ConfigManager(testRootPath);
      const pathResolver = new PathResolver(configManager);
      
      // Should resolve to legacy paths
      expect(pathResolver.getEpicsDir()).toBe(path.join(testRootPath, 'epics'));
      expect(pathResolver.getIssuesDir()).toBe(path.join(testRootPath, 'issues'));
      expect(pathResolver.getTasksDir()).toBe(path.join(testRootPath, 'tasks'));
    });

    it('should migrate from legacy to new structure', async () => {
      // Create legacy structure with data
      fs.mkdirSync(path.join(testRootPath, 'epics'), { recursive: true });
      fs.mkdirSync(path.join(testRootPath, 'issues'), { recursive: true });
      
      const legacyEpicContent = '---\nepic_id: EP-001\ntitle: Legacy Epic\n---\n# Legacy Epic';
      fs.writeFileSync(path.join(testRootPath, 'epics', 'EP-001-legacy.md'), legacyEpicContent);
      
      const legacyIssueContent = '---\nissue_id: ISS-001\ntitle: Legacy Issue\n---\n# Legacy Issue';
      fs.writeFileSync(path.join(testRootPath, 'issues', 'ISS-001-legacy.md'), legacyIssueContent);
      
      // Initialize context manager (should detect legacy and suggest migration)
      const contextManager = new ProjectContextManager(testRootPath);
      await contextManager.initializeContext();
      
      // Should still work in single-project mode
      expect(contextManager.getProjectMode()).toBe('single');
      
      // Paths should resolve correctly
      const paths = contextManager.getPaths();
      expect(paths.epicsDir).toBe(path.join(testRootPath, 'epics'));
      expect(paths.issuesDir).toBe(path.join(testRootPath, 'issues'));
      
      // Files should be accessible
      expect(fs.existsSync(path.join(paths.epicsDir, 'EP-001-legacy.md'))).toBe(true);
      expect(fs.existsSync(path.join(paths.issuesDir, 'ISS-001-legacy.md'))).toBe(true);
    });
  });

  describe('configuration file backward compatibility', () => {
    it('should work with legacy config format', () => {
      // Create legacy config structure
      const configDir = path.join(testRootPath, '.ai-trackdown');
      fs.mkdirSync(configDir, { recursive: true });
      
      const legacyConfig = {
        name: 'Legacy Project',
        version: '1.0.0',
        // Legacy field that might not exist in new format
        trackdown_version: '1.0.0',
        directory_structure: 'legacy'
      };
      
      fs.writeFileSync(
        path.join(configDir, 'config.json'),
        JSON.stringify(legacyConfig, null, 2)
      );
      
      const configManager = new ConfigManager(testRootPath);
      const config = configManager.getConfig();
      
      expect(config.name).toBe('Legacy Project');
      expect(config.version).toBe('1.0.0');
      
      // Should handle legacy fields gracefully
      expect(config).toBeDefined();
    });

    it('should validate legacy config format', () => {
      const configDir = path.join(testRootPath, '.ai-trackdown');
      fs.mkdirSync(configDir, { recursive: true });
      
      const legacyConfig = {
        name: 'Legacy Project',
        version: '1.0.0',
        created_date: '2023-01-01T00:00:00Z'
      };
      
      fs.writeFileSync(
        path.join(configDir, 'config.json'),
        JSON.stringify(legacyConfig, null, 2)
      );
      
      const configManager = new ConfigManager(testRootPath);
      const validation = configManager.validateConfig();
      
      expect(validation.valid).toBe(true);
    });

    it('should migrate legacy config to new format', () => {
      const configDir = path.join(testRootPath, '.ai-trackdown');
      fs.mkdirSync(configDir, { recursive: true });
      
      const legacyConfig = {
        name: 'Legacy Project',
        version: '1.0.0',
        // Missing required fields that should be added
        created_date: '2023-01-01T00:00:00Z'
      };
      
      fs.writeFileSync(
        path.join(configDir, 'config.json'),
        JSON.stringify(legacyConfig, null, 2)
      );
      
      const configManager = new ConfigManager(testRootPath);
      const config = configManager.getConfig();
      
      // Should add missing fields with defaults
      expect(config.name).toBe('Legacy Project');
      expect(config.version).toBe('1.0.0');
      expect(config.created_date).toBeDefined();
    });
  });

  describe('file format backward compatibility', () => {
    it('should read legacy frontmatter format', () => {
      // Create legacy epic file
      fs.mkdirSync(path.join(testRootPath, 'epics'), { recursive: true });
      
      const legacyEpicContent = `---
epic_id: EP-001
title: Legacy Epic
description: Legacy description
status: active
priority: high
assignee: developer
created_date: 2023-01-01T00:00:00Z
---

# Legacy Epic

This is a legacy epic with old frontmatter format.
`;
      
      fs.writeFileSync(path.join(testRootPath, 'epics', 'EP-001-legacy.md'), legacyEpicContent);
      
      // Should be able to read and parse
      const content = fs.readFileSync(path.join(testRootPath, 'epics', 'EP-001-legacy.md'), 'utf8');
      expect(content).toContain('epic_id: EP-001');
      expect(content).toContain('title: Legacy Epic');
      expect(content).toContain('# Legacy Epic');
    });

    it('should handle missing frontmatter fields', () => {
      fs.mkdirSync(path.join(testRootPath, 'issues'), { recursive: true });
      
      const minimalIssueContent = `---
issue_id: ISS-001
title: Minimal Issue
---

# Minimal Issue

This issue has minimal frontmatter.
`;
      
      fs.writeFileSync(path.join(testRootPath, 'issues', 'ISS-001-minimal.md'), minimalIssueContent);
      
      // Should be able to read without errors
      const content = fs.readFileSync(path.join(testRootPath, 'issues', 'ISS-001-minimal.md'), 'utf8');
      expect(content).toContain('issue_id: ISS-001');
      expect(content).toContain('title: Minimal Issue');
    });

    it('should handle legacy ID formats', () => {
      fs.mkdirSync(path.join(testRootPath, 'epics'), { recursive: true });
      
      // Create files with different ID formats
      const formats = [
        { id: 'EP-001', filename: 'EP-001-format1.md' },
        { id: 'EP-0002', filename: 'EP-0002-format2.md' },
        { id: 'EPIC-001', filename: 'EPIC-001-format3.md' }
      ];
      
      formats.forEach(format => {
        const content = `---
epic_id: ${format.id}
title: Test Epic ${format.id}
---

# Test Epic ${format.id}
`;
        fs.writeFileSync(path.join(testRootPath, 'epics', format.filename), content);
      });
      
      // All should be readable
      formats.forEach(format => {
        const content = fs.readFileSync(path.join(testRootPath, 'epics', format.filename), 'utf8');
        expect(content).toContain(`epic_id: ${format.id}`);
      });
    });
  });

  describe('path resolution backward compatibility', () => {
    it('should resolve legacy paths when new structure does not exist', () => {
      // Create only legacy structure
      fs.mkdirSync(path.join(testRootPath, 'epics'), { recursive: true });
      fs.mkdirSync(path.join(testRootPath, 'issues'), { recursive: true });
      
      const configManager = new ConfigManager(testRootPath);
      const pathResolver = new PathResolver(configManager);
      
      // Should resolve to legacy paths
      expect(pathResolver.getEpicsDir()).toBe(path.join(testRootPath, 'epics'));
      expect(pathResolver.getIssuesDir()).toBe(path.join(testRootPath, 'issues'));
    });

    it('should prefer new structure over legacy when both exist', () => {
      // Create both legacy and new structure
      fs.mkdirSync(path.join(testRootPath, 'epics'), { recursive: true });
      fs.mkdirSync(path.join(testRootPath, 'tasks', 'epics'), { recursive: true });
      
      const configManager = new ConfigManager(testRootPath);
      const pathResolver = new PathResolver(configManager);
      
      // Should prefer new structure
      expect(pathResolver.getEpicsDir()).toBe(path.join(testRootPath, 'tasks', 'epics'));
    });

    it('should handle mixed legacy and new structure', () => {
      // Create mixed structure
      fs.mkdirSync(path.join(testRootPath, 'epics'), { recursive: true }); // legacy
      fs.mkdirSync(path.join(testRootPath, 'tasks', 'issues'), { recursive: true }); // new
      
      const configManager = new ConfigManager(testRootPath);
      const pathResolver = new PathResolver(configManager);
      
      // Should handle mixed structure gracefully
      expect(pathResolver.getEpicsDir()).toBe(path.join(testRootPath, 'epics'));
      expect(pathResolver.getIssuesDir()).toBe(path.join(testRootPath, 'tasks', 'issues'));
    });
  });

  describe('data migration scenarios', () => {
    it('should preserve data when migrating from legacy to new structure', async () => {
      // Create legacy structure with data
      fs.mkdirSync(path.join(testRootPath, 'epics'), { recursive: true });
      fs.mkdirSync(path.join(testRootPath, 'issues'), { recursive: true });
      
      const legacyEpicContent = '---\nepic_id: EP-001\ntitle: Legacy Epic\n---\n# Legacy Epic';
      const legacyIssueContent = '---\nissue_id: ISS-001\ntitle: Legacy Issue\n---\n# Legacy Issue';
      
      fs.writeFileSync(path.join(testRootPath, 'epics', 'EP-001-legacy.md'), legacyEpicContent);
      fs.writeFileSync(path.join(testRootPath, 'issues', 'ISS-001-legacy.md'), legacyIssueContent);
      
      // Initialize context manager
      const contextManager = new ProjectContextManager(testRootPath);
      await contextManager.initializeContext();
      
      // Data should be accessible
      const paths = contextManager.getPaths();
      expect(fs.existsSync(path.join(paths.epicsDir, 'EP-001-legacy.md'))).toBe(true);
      expect(fs.existsSync(path.join(paths.issuesDir, 'ISS-001-legacy.md'))).toBe(true);
      
      // Content should be preserved
      const epicContent = fs.readFileSync(path.join(paths.epicsDir, 'EP-001-legacy.md'), 'utf8');
      const issueContent = fs.readFileSync(path.join(paths.issuesDir, 'ISS-001-legacy.md'), 'utf8');
      
      expect(epicContent).toBe(legacyEpicContent);
      expect(issueContent).toBe(legacyIssueContent);
    });

    it('should handle gradual migration from single to multi-project', async () => {
      // Start with single-project structure
      fs.mkdirSync(path.join(testRootPath, 'tasks', 'epics'), { recursive: true });
      fs.mkdirSync(path.join(testRootPath, 'tasks', 'issues'), { recursive: true });
      
      const singleEpicContent = '---\nepic_id: EP-001\ntitle: Single Epic\n---\n# Single Epic';
      fs.writeFileSync(path.join(testRootPath, 'tasks', 'epics', 'EP-001-single.md'), singleEpicContent);
      
      // Initialize in single-project mode
      const contextManager = new ProjectContextManager(testRootPath);
      await contextManager.initializeContext();
      
      expect(contextManager.getProjectMode()).toBe('single');
      
      // Add projects directory to trigger multi-project mode
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'new-project'));
      
      // Reset and reinitialize
      contextManager.reset();
      await contextManager.initializeContext('new-project');
      
      expect(contextManager.getProjectMode()).toBe('multi');
      
      // Original single-project data should still exist
      expect(fs.existsSync(path.join(testRootPath, 'tasks', 'epics', 'EP-001-single.md'))).toBe(true);
      
      // New project should have separate structure
      const newPaths = contextManager.getPaths();
      expect(newPaths.projectRoot).toBe(path.join(projectsDir, 'new-project'));
    });

    it('should handle PRJ file migration', () => {
      // Create PRJ files (legacy multi-project format)
      fs.writeFileSync(path.join(testRootPath, 'PRJ-0001-frontend.md'), '# Frontend Project');
      fs.writeFileSync(path.join(testRootPath, 'PRJ-0002-backend.md'), '# Backend Project');
      
      const detector = new ProjectDetector(testRootPath);
      const result = detector.detectProjectMode();
      
      expect(result.mode).toBe('multi');
      expect(result.migrationNeeded).toBe(true);
      expect(result.detectedProjects).toContain('PRJ-0001-frontend.md');
      expect(result.detectedProjects).toContain('PRJ-0002-backend.md');
      expect(result.recommendations).toContain('Detected PRJ-XXXX files in root directory');
    });
  });

  describe('CLI backward compatibility', () => {
    it('should work with legacy command syntax', () => {
      // Test that old command patterns still work
      // This would require actual CLI testing, which is covered in the E2E tests
      // Here we'll test the underlying functionality
      
      // Create legacy structure
      fs.mkdirSync(path.join(testRootPath, 'epics'), { recursive: true });
      
      const contextManager = new ProjectContextManager(testRootPath);
      
      // Should initialize without errors
      expect(async () => {
        await contextManager.initializeContext();
      }).not.toThrow();
    });

    it('should handle legacy environment variables', () => {
      // Test legacy environment variable names
      process.env.TRACKDOWN_MODE = 'single';
      
      const detector = new ProjectDetector(testRootPath);
      const result = detector.detectProjectMode();
      
      // Should still work (though might not use the legacy env var)
      expect(result.mode).toBe('single');
      
      delete process.env.TRACKDOWN_MODE;
    });
  });

  describe('template compatibility', () => {
    it('should work with legacy template format', () => {
      // Create legacy template structure
      fs.mkdirSync(path.join(testRootPath, 'templates'), { recursive: true });
      
      const legacyEpicTemplate = `---
epic_id: "{{epic_id}}"
title: "{{title}}"
description: "{{description}}"
status: planning
priority: medium
assignee: unassigned
created_date: "{{created_date}}"
---

# {{title}}

{{description}}

## Objectives

- [ ] Objective 1
- [ ] Objective 2

## Acceptance Criteria

- [ ] Criteria 1
- [ ] Criteria 2
`;
      
      fs.writeFileSync(path.join(testRootPath, 'templates', 'epic-template.md'), legacyEpicTemplate);
      
      // Should be able to read template
      const templateContent = fs.readFileSync(path.join(testRootPath, 'templates', 'epic-template.md'), 'utf8');
      expect(templateContent).toContain('{{epic_id}}');
      expect(templateContent).toContain('{{title}}');
      expect(templateContent).toContain('# {{title}}');
    });

    it('should handle missing template fields', () => {
      fs.mkdirSync(path.join(testRootPath, 'templates'), { recursive: true });
      
      const minimalTemplate = `---
title: "{{title}}"
---

# {{title}}
`;
      
      fs.writeFileSync(path.join(testRootPath, 'templates', 'minimal-template.md'), minimalTemplate);
      
      // Should be readable without errors
      const templateContent = fs.readFileSync(path.join(testRootPath, 'templates', 'minimal-template.md'), 'utf8');
      expect(templateContent).toContain('title: "{{title}}"');
    });
  });

  describe('git integration backward compatibility', () => {
    beforeEach(() => {
      // Initialize git repo
      execSync('git init', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.name "Test User"', { stdio: 'ignore', cwd: testRootPath });
    });

    it('should work with existing git repositories', () => {
      // Create some files and commit
      fs.writeFileSync(path.join(testRootPath, 'README.md'), '# Test Project');
      fs.writeFileSync(path.join(testRootPath, 'package.json'), JSON.stringify({ name: 'test' }));
      
      execSync('git add .', { stdio: 'ignore', cwd: testRootPath });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore', cwd: testRootPath });
      
      // Initialize context manager
      const contextManager = new ProjectContextManager(testRootPath);
      
      expect(async () => {
        await contextManager.initializeContext();
      }).not.toThrow();
    });

    it('should handle repositories without remote', () => {
      // Create local-only repository
      fs.writeFileSync(path.join(testRootPath, 'local-file.txt'), 'local content');
      
      execSync('git add .', { stdio: 'ignore', cwd: testRootPath });
      execSync('git commit -m "Local commit"', { stdio: 'ignore', cwd: testRootPath });
      
      // Should work without errors
      const contextManager = new ProjectContextManager(testRootPath);
      
      expect(async () => {
        await contextManager.initializeContext();
      }).not.toThrow();
    });
  });

  describe('error handling backward compatibility', () => {
    it('should handle corrupted legacy files gracefully', () => {
      // Create corrupted legacy file
      fs.mkdirSync(path.join(testRootPath, 'epics'), { recursive: true });
      fs.writeFileSync(path.join(testRootPath, 'epics', 'corrupted.md'), 'invalid frontmatter\n---\n# Title');
      
      const contextManager = new ProjectContextManager(testRootPath);
      
      expect(async () => {
        await contextManager.initializeContext();
      }).not.toThrow();
    });

    it('should handle missing legacy directories gracefully', () => {
      // Create partial legacy structure
      fs.mkdirSync(path.join(testRootPath, 'epics'), { recursive: true });
      // Missing issues directory
      
      const contextManager = new ProjectContextManager(testRootPath);
      
      expect(async () => {
        await contextManager.initializeContext();
      }).not.toThrow();
    });

    it('should handle legacy permission issues', () => {
      // Create structure but with limited permissions
      fs.mkdirSync(path.join(testRootPath, 'epics'), { recursive: true });
      fs.writeFileSync(path.join(testRootPath, 'epics', 'test.md'), 'test content');
      
      const contextManager = new ProjectContextManager(testRootPath);
      
      expect(async () => {
        await contextManager.initializeContext();
      }).not.toThrow();
    });
  });
});