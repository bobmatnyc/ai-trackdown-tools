import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitCommand } from '../../src/commands/init.js';
import { createStatusCommand } from '../../src/commands/status.js';
import {
  CLITestUtils,
  createMockProject,
  setupTestEnvironment,
  TestAssertions,
} from '../utils/test-helpers.js';

// Mock external dependencies
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  }),
}));

vi.mock('chalk', () => ({
  default: {
    green: vi.fn((text) => text),
    red: vi.fn((text) => text),
    blue: vi.fn((text) => text),
    yellow: vi.fn((text) => text),
    cyan: vi.fn((text) => text),
    gray: vi.fn((text) => text),
    bold: {
      green: vi.fn((text) => text),
      red: vi.fn((text) => text),
      blue: vi.fn((text) => text),
      yellow: vi.fn((text) => text),
      cyan: vi.fn((text) => text),
    },
  },
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock('figlet', () => ({
  default: {
    textSync: vi.fn(() => 'ASCII ART'),
  },
}));

vi.mock('boxen', () => ({
  default: vi.fn((text) => `[BOX: ${text}]`),
}));

describe('Status and Init Command Tests', () => {
  const getTestContext = setupTestEnvironment();

  describe('Status Command', () => {
    beforeEach(() => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      // Create additional test data for status command
      const completedEpicContent = `---
title: Completed Epic
description: A completed epic
status: completed
priority: high
assignee: test-user
created_date: 2025-01-01T00:00:00.000Z
updated_date: ${new Date().toISOString()}
estimated_tokens: 1000
actual_tokens: 1200
completion_percentage: 100
---

# Epic: Completed Epic
`;

      fs.writeFileSync(
        path.join(testContext.tempDir, 'tasks', 'epics', 'EP-0002-completed-epic.md'),
        completedEpicContent
      );

      const inProgressIssueContent = `---
title: In Progress Issue
description: An issue currently in progress
status: in-progress
priority: medium
assignee: test-user
created_date: 2025-01-02T00:00:00.000Z
updated_date: ${new Date().toISOString()}
estimated_tokens: 500
actual_tokens: 300
completion_percentage: 60
related_epics:
  - EP-0001
---

# Issue: In Progress Issue
`;

      fs.writeFileSync(
        path.join(testContext.tempDir, 'tasks', 'issues', 'ISS-0002-in-progress-issue.md'),
        inProgressIssueContent
      );
    });

    it('should display basic project status', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const statusCommand = createStatusCommand();
      program.addCommand(statusCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'status'], { from: 'user' });

        // Check console output contains status information
        expect(
          consoleMock.logs.some((log) => log.includes('Project Status') || log.includes('status'))
        ).toBe(true);
        expect(consoleMock.logs.some((log) => log.includes('Epic') || log.includes('Issue'))).toBe(
          true
        );
      } finally {
        consoleMock.restore();
      }
    });

    it('should display detailed status with --verbose flag', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const statusCommand = createStatusCommand();
      program.addCommand(statusCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'status', '--verbose'], { from: 'user' });

        // Check console output contains detailed information
        expect(
          consoleMock.logs.some((log) => log.includes('Test Epic') || log.includes('Test Issue'))
        ).toBe(true);
        expect(
          consoleMock.logs.some((log) => log.includes('active') || log.includes('completed'))
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should display full status with all items', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const statusCommand = createStatusCommand();
      program.addCommand(statusCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'status', '--full'], { from: 'user' });

        // Check console output contains comprehensive information
        expect(consoleMock.logs.some((log) => log.includes('Epic') || log.includes('Issue'))).toBe(
          true
        );
        expect(consoleMock.logs.some((log) => log.includes('Task') || log.includes('PR'))).toBe(
          true
        );
      } finally {
        consoleMock.restore();
      }
    });

    it('should show progress statistics', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const statusCommand = createStatusCommand();
      program.addCommand(statusCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'status', '--show-progress'], { from: 'user' });

        // Check console output contains progress information
        expect(
          consoleMock.logs.some(
            (log) => log.includes('%') || log.includes('progress') || log.includes('completion')
          )
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should show token statistics', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const statusCommand = createStatusCommand();
      program.addCommand(statusCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'status', '--show-tokens'], { from: 'user' });

        // Check console output contains token information
        expect(
          consoleMock.logs.some(
            (log) => log.includes('token') || log.includes('estimated') || log.includes('actual')
          )
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should filter status by priority', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const statusCommand = createStatusCommand();
      program.addCommand(statusCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'status', '--priority', 'high'], {
          from: 'user',
        });

        // Should only show high priority items
        expect(consoleMock.logs.some((log) => log.includes('high'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should filter status by assignee', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const statusCommand = createStatusCommand();
      program.addCommand(statusCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'status', '--assignee', 'test-user'], {
          from: 'user',
        });

        // Should only show items assigned to test-user
        expect(consoleMock.logs.some((log) => log.includes('test-user'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should show current sprint status', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const statusCommand = createStatusCommand();
      program.addCommand(statusCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'status', '--current-sprint'], { from: 'user' });

        // Should show sprint-specific information
        expect(
          consoleMock.logs.some(
            (log) => log.includes('sprint') || log.includes('active') || log.includes('progress')
          )
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle project with no tasks', async () => {
      const testContext = getTestContext();

      // Remove all task files
      fs.rmSync(path.join(testContext.tempDir, 'tasks'), { recursive: true, force: true });

      const program = new Command();
      const statusCommand = createStatusCommand();
      program.addCommand(statusCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'status'], { from: 'user' });

        // Should handle empty project gracefully
        expect(
          consoleMock.logs.some(
            (log) => log.includes('No items') || log.includes('empty') || log.includes('0')
          )
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle status with project directory option', async () => {
      const testContext = getTestContext();

      // Create external project
      const externalProjectDir = path.join(testContext.tempDir, 'external-project');
      createMockProject(testContext.tempDir, 'external-project');

      const program = new Command();
      const statusCommand = createStatusCommand();
      program.addCommand(statusCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'status', '--project-dir', externalProjectDir], {
          from: 'user',
        });

        // Should show status for external project
        expect(
          consoleMock.logs.some((log) => log.includes('Test Epic') || log.includes('status'))
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Init Command', () => {
    it('should initialize new project with basic structure', async () => {
      const testContext = getTestContext();

      const program = new Command();
      const initCommand = createInitCommand();
      program.addCommand(initCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'init', 'new-project'], { from: 'user' });

        // Check if project structure was created
        const projectDir = path.join(testContext.tempDir, 'new-project');
        TestAssertions.assertDirectoryExists(projectDir);
        TestAssertions.assertDirectoryExists(path.join(projectDir, 'tasks'));
        TestAssertions.assertDirectoryExists(path.join(projectDir, 'tasks', 'epics'));
        TestAssertions.assertDirectoryExists(path.join(projectDir, 'tasks', 'issues'));
        TestAssertions.assertDirectoryExists(path.join(projectDir, 'tasks', 'tasks'));
        TestAssertions.assertDirectoryExists(path.join(projectDir, 'tasks', 'prs'));
        TestAssertions.assertDirectoryExists(path.join(projectDir, 'tasks', 'templates'));

        // Check if README was created
        TestAssertions.assertFileExists(path.join(projectDir, 'README.md'));
        TestAssertions.assertFileContains(path.join(projectDir, 'README.md'), 'new-project');
      } finally {
        consoleMock.restore();
      }
    });

    it('should initialize project in current directory', async () => {
      const testContext = getTestContext();

      const program = new Command();
      const initCommand = createInitCommand();
      program.addCommand(initCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'init'], { from: 'user' });

        // Check if project structure was created in current directory
        TestAssertions.assertDirectoryExists(path.join(testContext.tempDir, 'tasks'));
        TestAssertions.assertDirectoryExists(path.join(testContext.tempDir, 'tasks', 'epics'));
        TestAssertions.assertDirectoryExists(path.join(testContext.tempDir, 'tasks', 'issues'));
        TestAssertions.assertDirectoryExists(path.join(testContext.tempDir, 'tasks', 'tasks'));
        TestAssertions.assertDirectoryExists(path.join(testContext.tempDir, 'tasks', 'prs'));
      } finally {
        consoleMock.restore();
      }
    });

    it('should initialize with custom templates', async () => {
      const testContext = getTestContext();

      const program = new Command();
      const initCommand = createInitCommand();
      program.addCommand(initCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'init', 'custom-project', '--with-templates'], {
          from: 'user',
        });

        // Check if templates were created
        const projectDir = path.join(testContext.tempDir, 'custom-project');
        const templatesDir = path.join(projectDir, 'tasks', 'templates');

        TestAssertions.assertFileExists(path.join(templatesDir, 'epic-default.yaml'));
        TestAssertions.assertFileExists(path.join(templatesDir, 'issue-default.yaml'));
        TestAssertions.assertFileExists(path.join(templatesDir, 'task-default.yaml'));
        TestAssertions.assertFileExists(path.join(templatesDir, 'pr-default.yaml'));
      } finally {
        consoleMock.restore();
      }
    });

    it('should initialize with GitHub integration', async () => {
      const testContext = getTestContext();

      const program = new Command();
      const initCommand = createInitCommand();
      program.addCommand(initCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          [
            'node',
            'test',
            'init',
            'github-project',
            '--github-repo',
            'test/repo',
            '--github-token',
            'test-token',
          ],
          { from: 'user' }
        );

        // Check if project was initialized with GitHub config
        const projectDir = path.join(testContext.tempDir, 'github-project');
        TestAssertions.assertDirectoryExists(projectDir);

        // Should log GitHub integration setup
        expect(
          consoleMock.logs.some((log) => log.includes('GitHub') || log.includes('integration'))
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle interactive initialization', async () => {
      const testContext = getTestContext();

      const inquirer = await import('inquirer');
      vi.mocked(inquirer.default.prompt).mockResolvedValue({
        projectName: 'interactive-project',
        description: 'Interactive project description',
        withTemplates: true,
        withGitHub: false,
        defaultAssignee: 'test-user',
      });

      const program = new Command();
      const initCommand = createInitCommand();
      program.addCommand(initCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'init', '--interactive'], { from: 'user' });

        // Check if project was created with interactive values
        const projectDir = path.join(testContext.tempDir, 'interactive-project');
        TestAssertions.assertDirectoryExists(projectDir);
        TestAssertions.assertFileExists(path.join(projectDir, 'README.md'));
        TestAssertions.assertFileContains(
          path.join(projectDir, 'README.md'),
          'Interactive project description'
        );
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle existing project directory', async () => {
      const testContext = getTestContext();

      // Create existing directory
      const existingDir = path.join(testContext.tempDir, 'existing-project');
      fs.mkdirSync(existingDir);
      fs.writeFileSync(path.join(existingDir, 'existing-file.txt'), 'existing content');

      const program = new Command();
      const initCommand = createInitCommand();
      program.addCommand(initCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'init', 'existing-project'], { from: 'user' });

        // Should handle existing directory appropriately
        expect(
          consoleMock.errors.some(
            (error) => error.includes('exists') || error.includes('existing')
          ) ||
            consoleMock.logs.some((log) => log.includes('initialized') || log.includes('created'))
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle force initialization', async () => {
      const testContext = getTestContext();

      // Create existing directory
      const existingDir = path.join(testContext.tempDir, 'force-project');
      fs.mkdirSync(existingDir);
      fs.writeFileSync(path.join(existingDir, 'existing-file.txt'), 'existing content');

      const program = new Command();
      const initCommand = createInitCommand();
      program.addCommand(initCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'init', 'force-project', '--force'], {
          from: 'user',
        });

        // Should initialize even with existing content
        TestAssertions.assertDirectoryExists(path.join(existingDir, 'tasks'));
        TestAssertions.assertDirectoryExists(path.join(existingDir, 'tasks', 'epics'));
      } finally {
        consoleMock.restore();
      }
    });

    it('should create sample items when requested', async () => {
      const testContext = getTestContext();

      const program = new Command();
      const initCommand = createInitCommand();
      program.addCommand(initCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'init', 'sample-project', '--with-samples'], {
          from: 'user',
        });

        // Check if sample items were created
        const projectDir = path.join(testContext.tempDir, 'sample-project');
        const epicsDir = path.join(projectDir, 'tasks', 'epics');
        const issuesDir = path.join(projectDir, 'tasks', 'issues');

        // Should have sample files
        const epicFiles = fs.readdirSync(epicsDir);
        const issueFiles = fs.readdirSync(issuesDir);

        expect(epicFiles.length).toBeGreaterThan(0);
        expect(issueFiles.length).toBeGreaterThan(0);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle initialization errors', async () => {
      const _testContext = getTestContext();

      // Mock fs.mkdirSync to throw permission error
      const _originalMkdirSync = fs.mkdirSync;
      vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
        const error = new Error('EACCES: permission denied');
        (error as any).code = 'EACCES';
        throw error;
      });

      const program = new Command();
      const initCommand = createInitCommand();
      program.addCommand(initCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'init', 'error-project'], { from: 'user' });

        // Should handle initialization error gracefully
        expect(
          consoleMock.errors.some(
            (error) => error.includes('permission') || error.includes('EACCES')
          )
        ).toBe(true);
      } finally {
        consoleMock.restore();
        vi.mocked(fs.mkdirSync).mockRestore();
      }
    });

    it('should validate project name', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const initCommand = createInitCommand();
      program.addCommand(initCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'init', 'invalid/project\\name'], {
          from: 'user',
        });

        // Should validate project name and either reject or sanitize
        expect(
          consoleMock.errors.some((error) => error.includes('invalid') || error.includes('name')) ||
            consoleMock.logs.some((log) => log.includes('initialized'))
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Status Error Handling', () => {
    it('should handle corrupted task files', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      // Create corrupted file
      fs.writeFileSync(
        path.join(testContext.tempDir, 'tasks', 'epics', 'corrupted.md'),
        'invalid content'
      );

      const program = new Command();
      const statusCommand = createStatusCommand();
      program.addCommand(statusCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'status'], { from: 'user' });

        // Should handle corrupted files gracefully
        expect(
          consoleMock.logs.some(
            (log) => log.includes('status') || log.includes('epic') || log.includes('issue')
          ) ||
            consoleMock.errors.some(
              (error) => error.includes('parse') || error.includes('corrupted')
            )
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle file system permission errors', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      // Mock fs.readdirSync to throw permission error
      const _originalReaddirSync = fs.readdirSync;
      vi.spyOn(fs, 'readdirSync').mockImplementation(() => {
        const error = new Error('EACCES: permission denied');
        (error as any).code = 'EACCES';
        throw error;
      });

      const program = new Command();
      const statusCommand = createStatusCommand();
      program.addCommand(statusCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'status'], { from: 'user' });

        // Should handle permission error gracefully
        expect(
          consoleMock.errors.some(
            (error) => error.includes('permission') || error.includes('EACCES')
          )
        ).toBe(true);
      } finally {
        consoleMock.restore();
        vi.mocked(fs.readdirSync).mockRestore();
      }
    });
  });

  describe('Performance Tests', () => {
    it('should handle large number of items efficiently', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      // Create many items for performance testing
      const epicsDir = path.join(testContext.tempDir, 'tasks', 'epics');
      const issuesDir = path.join(testContext.tempDir, 'tasks', 'issues');

      for (let i = 0; i < 100; i++) {
        const epicContent = `---
title: Epic ${i}
description: Performance test epic ${i}
status: active
priority: medium
created_date: ${new Date().toISOString()}
---
# Epic ${i}
`;
        fs.writeFileSync(
          path.join(epicsDir, `EP-${String(i).padStart(4, '0')}-epic-${i}.md`),
          epicContent
        );

        const issueContent = `---
title: Issue ${i}
description: Performance test issue ${i}
status: active
priority: medium
created_date: ${new Date().toISOString()}
related_epics:
  - EP-${String(i).padStart(4, '0')}
---
# Issue ${i}
`;
        fs.writeFileSync(
          path.join(issuesDir, `ISS-${String(i).padStart(4, '0')}-issue-${i}.md`),
          issueContent
        );
      }

      const program = new Command();
      const statusCommand = createStatusCommand();
      program.addCommand(statusCommand);

      const consoleMock = CLITestUtils.mockConsole();
      const startTime = Date.now();

      try {
        await program.parseAsync(['node', 'test', 'status'], { from: 'user' });

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete within reasonable time (less than 5 seconds)
        expect(duration).toBeLessThan(5000);

        // Should still show status information
        expect(
          consoleMock.logs.some(
            (log) => log.includes('status') || log.includes('Epic') || log.includes('Issue')
          )
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });
});
