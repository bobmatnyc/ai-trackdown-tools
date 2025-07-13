import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';
import { createEpicCommand } from '../../src/commands/epic.js';
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

describe('Epic Command Tests', () => {
  const getTestContext = setupTestEnvironment();

  describe('Epic Create Command', () => {
    it('should create a new epic with required fields', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      const program = new Command();
      const epicCommand = createEpicCommand();
      program.addCommand(epicCommand);

      // Mock console output
      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          [
            'node',
            'test',
            'epic',
            'create',
            'Test Epic',
            '--description',
            'A test epic',
            '--assignee',
            'test-user',
          ],
          { from: 'user' }
        );

        // Check if epic file was created
        const epicFiles = fs.readdirSync(path.join(testContext.tempDir, 'tasks', 'epics'));
        expect(epicFiles).toHaveLength(2); // One existing + one new

        const newEpicFile = epicFiles.find((f) => f.includes('test-epic'));
        expect(newEpicFile).toBeDefined();

        if (newEpicFile) {
          const epicPath = path.join(testContext.tempDir, 'tasks', 'epics', newEpicFile);
          TestAssertions.assertFileExists(epicPath);
          TestAssertions.assertValidYamlFrontmatter(epicPath);
          TestAssertions.assertFileContains(epicPath, 'title: Test Epic');
          TestAssertions.assertFileContains(epicPath, 'description: A test epic');
          TestAssertions.assertFileContains(epicPath, 'assignee: test-user');
        }
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle missing description with interactive prompt', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      const inquirer = await import('inquirer');
      vi.mocked(inquirer.default.prompt).mockResolvedValue({
        description: 'Interactive description',
        priority: 'high',
        assignee: 'test-user',
        estimated_tokens: 1000,
      });

      const program = new Command();
      const epicCommand = createEpicCommand();
      program.addCommand(epicCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'epic', 'create', 'Interactive Epic'], {
          from: 'user',
        });

        // Check if epic file was created with interactive values
        const epicFiles = fs.readdirSync(path.join(testContext.tempDir, 'tasks', 'epics'));
        const newEpicFile = epicFiles.find((f) => f.includes('interactive-epic'));
        expect(newEpicFile).toBeDefined();

        if (newEpicFile) {
          const epicPath = path.join(testContext.tempDir, 'tasks', 'epics', newEpicFile);
          TestAssertions.assertFileContains(epicPath, 'description: Interactive description');
          TestAssertions.assertFileContains(epicPath, 'priority: high');
        }
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle epic creation with flexible options', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      const program = new Command();
      const epicCommand = createEpicCommand();
      program.addCommand(epicCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          [
            'node',
            'test',
            'epic',
            'create',
            'Flexible Epic',
            '--description',
            'Epic with all options',
            '--priority',
            'high',
            '--assignee',
            'test-user',
            '--estimated-tokens',
            '2000',
            '--status',
            'active',
          ],
          { from: 'user' }
        );

        const epicFiles = fs.readdirSync(path.join(testContext.tempDir, 'tasks', 'epics'));
        const newEpicFile = epicFiles.find((f) => f.includes('flexible-epic'));
        expect(newEpicFile).toBeDefined();

        if (newEpicFile) {
          const epicPath = path.join(testContext.tempDir, 'tasks', 'epics', newEpicFile);
          TestAssertions.assertFileContains(epicPath, 'priority: high');
          TestAssertions.assertFileContains(epicPath, 'estimated_tokens: 2000');
          TestAssertions.assertFileContains(epicPath, 'status: active');
        }
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Epic List Command', () => {
    it('should list all epics', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      const program = new Command();
      const epicCommand = createEpicCommand();
      program.addCommand(epicCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'epic', 'list'], { from: 'user' });

        // Check console output contains epic information
        expect(consoleMock.logs.some((log) => log.includes('Test Epic'))).toBe(true);
        expect(consoleMock.logs.some((log) => log.includes('EP-0001'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should filter epics by status', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      const program = new Command();
      const epicCommand = createEpicCommand();
      program.addCommand(epicCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'epic', 'list', '--status', 'active'], {
          from: 'user',
        });

        // Should only show active epics
        expect(consoleMock.logs.some((log) => log.includes('active'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should filter epics by assignee', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      const program = new Command();
      const epicCommand = createEpicCommand();
      program.addCommand(epicCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'epic', 'list', '--assignee', 'test-user'], {
          from: 'user',
        });

        // Should only show epics assigned to test-user
        expect(consoleMock.logs.some((log) => log.includes('test-user'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Epic Show Command', () => {
    it('should display epic details', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      const program = new Command();
      const epicCommand = createEpicCommand();
      program.addCommand(epicCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'epic', 'show', 'EP-0001'], { from: 'user' });

        // Check console output contains epic details
        expect(consoleMock.logs.some((log) => log.includes('Test Epic'))).toBe(true);
        expect(consoleMock.logs.some((log) => log.includes('A test epic for testing'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle non-existent epic', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      const program = new Command();
      const epicCommand = createEpicCommand();
      program.addCommand(epicCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'epic', 'show', 'EP-9999'], { from: 'user' });

        // Should show error for non-existent epic
        expect(
          consoleMock.errors.some(
            (error) => error.includes('not found') || error.includes('EP-9999')
          )
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Epic Update Command', () => {
    it('should update epic fields', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      const program = new Command();
      const epicCommand = createEpicCommand();
      program.addCommand(epicCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          [
            'node',
            'test',
            'epic',
            'update',
            'EP-0001',
            '--status',
            'completed',
            '--priority',
            'high',
            '--actual-tokens',
            '1200',
          ],
          { from: 'user' }
        );

        // Check if epic file was updated
        const epicPath = path.join(testContext.tempDir, 'tasks', 'epics', 'EP-0001-test-epic.md');
        TestAssertions.assertFileContains(epicPath, 'status: completed');
        TestAssertions.assertFileContains(epicPath, 'priority: high');
        TestAssertions.assertFileContains(epicPath, 'actual_tokens: 1200');
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle invalid epic ID', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      const program = new Command();
      const epicCommand = createEpicCommand();
      program.addCommand(epicCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          ['node', 'test', 'epic', 'update', 'INVALID-ID', '--status', 'completed'],
          { from: 'user' }
        );

        // Should show error for invalid ID
        expect(
          consoleMock.errors.some(
            (error) => error.includes('not found') || error.includes('INVALID-ID')
          )
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Epic Complete Command', () => {
    it('should mark epic as completed', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      const program = new Command();
      const epicCommand = createEpicCommand();
      program.addCommand(epicCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          [
            'node',
            'test',
            'epic',
            'complete',
            'EP-0001',
            '--actual-tokens',
            '1500',
            '--notes',
            'Epic completed successfully',
          ],
          { from: 'user' }
        );

        // Check if epic file was marked as completed
        const epicPath = path.join(testContext.tempDir, 'tasks', 'epics', 'EP-0001-test-epic.md');
        TestAssertions.assertFileContains(epicPath, 'status: completed');
        TestAssertions.assertFileContains(epicPath, 'actual_tokens: 1500');
        TestAssertions.assertFileContains(epicPath, 'completion_percentage: 100');
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tasks directory', async () => {
      const _testContext = getTestContext();
      // Don't create mock project - no tasks directory

      const program = new Command();
      const epicCommand = createEpicCommand();
      program.addCommand(epicCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'epic', 'list'], { from: 'user' });

        // Should handle missing directory gracefully
        expect(
          consoleMock.errors.some(
            (error) => error.includes('not found') || error.includes('No epics found')
          )
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle malformed YAML frontmatter', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      // Create epic with malformed YAML
      const malformedEpic = `---
title: Malformed Epic
description: This epic has malformed YAML
status: active
priority: high
invalid_yaml: [unclosed bracket
---

# Malformed Epic
`;

      const epicPath = path.join(
        testContext.tempDir,
        'tasks',
        'epics',
        'EP-0002-malformed-epic.md'
      );
      fs.writeFileSync(epicPath, malformedEpic);

      const program = new Command();
      const epicCommand = createEpicCommand();
      program.addCommand(epicCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'epic', 'show', 'EP-0002'], { from: 'user' });

        // Should handle malformed YAML gracefully
        expect(
          consoleMock.errors.some((error) => error.includes('YAML') || error.includes('parse'))
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle file system permission errors', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);

      // Mock fs.writeFileSync to throw permission error
      const _originalWriteFileSync = fs.writeFileSync;
      vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
        const error = new Error('EACCES: permission denied');
        (error as any).code = 'EACCES';
        throw error;
      });

      const program = new Command();
      const epicCommand = createEpicCommand();
      program.addCommand(epicCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'epic', 'create', 'Permission Test'], {
          from: 'user',
        });

        // Should handle permission error gracefully
        expect(
          consoleMock.errors.some(
            (error) => error.includes('permission') || error.includes('EACCES')
          )
        ).toBe(true);
      } finally {
        consoleMock.restore();
        vi.mocked(fs.writeFileSync).mockRestore();
      }
    });
  });

  describe('Cross-project Epic References', () => {
    it('should handle --project-dir option', async () => {
      const testContext = getTestContext();

      // Create project in different directory
      const projectDir = path.join(testContext.tempDir, 'external-project');
      createMockProject(testContext.tempDir, 'external-project');

      const program = new Command();
      const epicCommand = createEpicCommand();
      program.addCommand(epicCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'epic', 'list', '--project-dir', projectDir], {
          from: 'user',
        });

        // Should find epics in external project
        expect(consoleMock.logs.some((log) => log.includes('Test Epic'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle invalid project directory', async () => {
      const _testContext = getTestContext();

      const program = new Command();
      const epicCommand = createEpicCommand();
      program.addCommand(epicCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(
          ['node', 'test', 'epic', 'list', '--project-dir', '/non/existent/path'],
          { from: 'user' }
        );

        // Should handle invalid directory gracefully
        expect(
          consoleMock.errors.some(
            (error) => error.includes('not found') || error.includes('directory')
          )
        ).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });
});
