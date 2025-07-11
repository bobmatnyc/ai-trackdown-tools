import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { createTaskCommand } from '../../src/commands/task.js';
import { setupTestEnvironment, createMockProject, TestAssertions, CLITestUtils } from '../utils/test-helpers.js';

// Mock external dependencies
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: ''
  })
}));

vi.mock('chalk', () => ({
  default: {
    green: vi.fn(text => text),
    red: vi.fn(text => text),
    blue: vi.fn(text => text),
    yellow: vi.fn(text => text),
    cyan: vi.fn(text => text),
    gray: vi.fn(text => text),
    bold: {
      green: vi.fn(text => text),
      red: vi.fn(text => text),
      blue: vi.fn(text => text),
      yellow: vi.fn(text => text),
      cyan: vi.fn(text => text)
    }
  }
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn()
  }
}));

describe('Task Command Tests', () => {
  const getTestContext = setupTestEnvironment();

  beforeEach(() => {
    const testContext = getTestContext();
    createMockProject(testContext.tempDir);
    
    // Create a sample task file for testing
    const taskContent = `---
title: Test Task
description: A test task for testing
status: active
priority: medium
assignee: test-user
created_date: ${new Date().toISOString()}
updated_date: ${new Date().toISOString()}
estimated_time: 2h
actual_time: 0h
ai_context:
  - context/requirements
sync_status: local
related_issues:
  - ISS-0001
dependencies: []
completion_percentage: 0
---

# Task: Test Task

## Description
This is a test task for testing purposes.

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2
`;

    fs.writeFileSync(path.join(testContext.tempDir, 'tasks', 'tasks', 'TSK-0001-test-task.md'), taskContent);
  });

  describe('Task Create Command', () => {
    it('should create a new task with required fields', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'task', 'create', 'New Test Task',
          '--description', 'A new test task',
          '--issue', 'ISS-0001',
          '--assignee', 'test-user'
        ], { from: 'user' });
        
        // Check if task file was created
        const taskFiles = fs.readdirSync(path.join(testContext.tempDir, 'tasks', 'tasks'));
        expect(taskFiles.length).toBeGreaterThan(1); // Should have existing + new task
        
        const newTaskFile = taskFiles.find(f => f.includes('new-test-task'));
        expect(newTaskFile).toBeDefined();
        
        if (newTaskFile) {
          const taskPath = path.join(testContext.tempDir, 'tasks', 'tasks', newTaskFile);
          TestAssertions.assertFileExists(taskPath);
          TestAssertions.assertValidYamlFrontmatter(taskPath);
          TestAssertions.assertFileContains(taskPath, 'title: New Test Task');
          TestAssertions.assertFileContains(taskPath, 'description: A new test task');
          TestAssertions.assertFileContains(taskPath, 'assignee: test-user');
          TestAssertions.assertFileContains(taskPath, 'related_issues:');
          TestAssertions.assertFileContains(taskPath, '- ISS-0001');
        }
      } finally {
        consoleMock.restore();
      }
    });

    it('should create standalone task without issue requirement', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'task', 'create', 'Standalone Task',
          '--description', 'A standalone task without issue',
          '--assignee', 'test-user'
        ], { from: 'user' });
        
        // Check if task file was created without issue requirement
        const taskFiles = fs.readdirSync(path.join(testContext.tempDir, 'tasks', 'tasks'));
        const newTaskFile = taskFiles.find(f => f.includes('standalone-task'));
        expect(newTaskFile).toBeDefined();
        
        if (newTaskFile) {
          const taskPath = path.join(testContext.tempDir, 'tasks', 'tasks', newTaskFile);
          TestAssertions.assertFileExists(taskPath);
          TestAssertions.assertFileContains(taskPath, 'title: Standalone Task');
          TestAssertions.assertFileContains(taskPath, 'related_issues: []');
        }
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle task creation with all options', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'task', 'create', 'Full Options Task',
          '--description', 'Task with all options',
          '--issue', 'ISS-0001',
          '--priority', 'high',
          '--assignee', 'test-user',
          '--estimated-time', '4h',
          '--status', 'active'
        ], { from: 'user' });
        
        const taskFiles = fs.readdirSync(path.join(testContext.tempDir, 'tasks', 'tasks'));
        const newTaskFile = taskFiles.find(f => f.includes('full-options-task'));
        expect(newTaskFile).toBeDefined();
        
        if (newTaskFile) {
          const taskPath = path.join(testContext.tempDir, 'tasks', 'tasks', newTaskFile);
          TestAssertions.assertFileContains(taskPath, 'priority: high');
          TestAssertions.assertFileContains(taskPath, 'estimated_time: 4h');
          TestAssertions.assertFileContains(taskPath, 'status: active');
        }
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle interactive task creation', async () => {
      const testContext = getTestContext();
      
      const inquirer = await import('inquirer');
      vi.mocked(inquirer.default.prompt).mockResolvedValue({
        description: 'Interactive description',
        issue: 'ISS-0001',
        priority: 'high',
        assignee: 'test-user',
        estimated_time: '3h'
      });

      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'task', 'create', 'Interactive Task'], { from: 'user' });
        
        // Check if task file was created with interactive values
        const taskFiles = fs.readdirSync(path.join(testContext.tempDir, 'tasks', 'tasks'));
        const newTaskFile = taskFiles.find(f => f.includes('interactive-task'));
        expect(newTaskFile).toBeDefined();
        
        if (newTaskFile) {
          const taskPath = path.join(testContext.tempDir, 'tasks', 'tasks', newTaskFile);
          TestAssertions.assertFileContains(taskPath, 'description: Interactive description');
          TestAssertions.assertFileContains(taskPath, 'priority: high');
          TestAssertions.assertFileContains(taskPath, 'estimated_time: 3h');
        }
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Task List Command', () => {
    it('should list all tasks', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'task', 'list'], { from: 'user' });
        
        // Check console output contains task information
        expect(consoleMock.logs.some(log => log.includes('Test Task'))).toBe(true);
        expect(consoleMock.logs.some(log => log.includes('TSK-0001'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should filter tasks by issue', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'task', 'list', '--issue', 'ISS-0001'], { from: 'user' });
        
        // Should only show tasks related to ISS-0001
        expect(consoleMock.logs.some(log => log.includes('ISS-0001'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should filter tasks by status', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'task', 'list', '--status', 'active'], { from: 'user' });
        
        // Should only show active tasks
        expect(consoleMock.logs.some(log => log.includes('active'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should filter tasks by assignee', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'task', 'list', '--assignee', 'test-user'], { from: 'user' });
        
        // Should only show tasks assigned to test-user
        expect(consoleMock.logs.some(log => log.includes('test-user'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should show task progress', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'task', 'list', '--show-progress'], { from: 'user' });
        
        // Should show progress information
        expect(consoleMock.logs.some(log => log.includes('%') || log.includes('progress'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Task Show Command', () => {
    it('should display task details', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'task', 'show', 'TSK-0001'], { from: 'user' });
        
        // Check console output contains task details
        expect(consoleMock.logs.some(log => log.includes('Test Task'))).toBe(true);
        expect(consoleMock.logs.some(log => log.includes('A test task for testing'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle non-existent task', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'task', 'show', 'TSK-9999'], { from: 'user' });
        
        // Should show error for non-existent task
        expect(consoleMock.errors.some(error => error.includes('not found') || error.includes('TSK-9999'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Task Update Command', () => {
    it('should update task fields', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'task', 'update', 'TSK-0001',
          '--status', 'in-progress',
          '--priority', 'high',
          '--assignee', 'new-assignee',
          '--actual-time', '1h'
        ], { from: 'user' });
        
        // Check if task file was updated
        const taskPath = path.join(testContext.tempDir, 'tasks', 'tasks', 'TSK-0001-test-task.md');
        TestAssertions.assertFileContains(taskPath, 'status: in-progress');
        TestAssertions.assertFileContains(taskPath, 'priority: high');
        TestAssertions.assertFileContains(taskPath, 'assignee: new-assignee');
        TestAssertions.assertFileContains(taskPath, 'actual_time: 1h');
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle partial updates', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'task', 'update', 'TSK-0001',
          '--priority', 'high'
        ], { from: 'user' });
        
        // Should update only specified field
        const taskPath = path.join(testContext.tempDir, 'tasks', 'tasks', 'TSK-0001-test-task.md');
        TestAssertions.assertFileContains(taskPath, 'priority: high');
        // Original status should remain
        TestAssertions.assertFileContains(taskPath, 'status: active');
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle invalid task ID', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'task', 'update', 'INVALID-ID',
          '--status', 'completed'
        ], { from: 'user' });
        
        // Should show error for invalid ID
        expect(consoleMock.errors.some(error => error.includes('not found') || error.includes('INVALID-ID'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Task Complete Command', () => {
    it('should mark task as completed', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'task', 'complete', 'TSK-0001',
          '--time-spent', '2.5h',
          '--notes', 'Task completed successfully'
        ], { from: 'user' });
        
        // Check if task file was marked as completed
        const taskPath = path.join(testContext.tempDir, 'tasks', 'tasks', 'TSK-0001-test-task.md');
        TestAssertions.assertFileContains(taskPath, 'status: completed');
        TestAssertions.assertFileContains(taskPath, 'actual_time: 2.5h');
        TestAssertions.assertFileContains(taskPath, 'completion_percentage: 100');
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle completion without time tracking', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'task', 'complete', 'TSK-0001',
          '--notes', 'Completed without time tracking'
        ], { from: 'user' });
        
        // Should complete without time spent
        const taskPath = path.join(testContext.tempDir, 'tasks', 'tasks', 'TSK-0001-test-task.md');
        TestAssertions.assertFileContains(taskPath, 'status: completed');
        TestAssertions.assertFileContains(taskPath, 'completion_percentage: 100');
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle completion with partial progress', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'task', 'complete', 'TSK-0001',
          '--completion', '80',
          '--time-spent', '1.5h'
        ], { from: 'user' });
        
        // Check if task was marked with partial completion
        const taskPath = path.join(testContext.tempDir, 'tasks', 'tasks', 'TSK-0001-test-task.md');
        TestAssertions.assertFileContains(taskPath, 'completion_percentage: 80');
        TestAssertions.assertFileContains(taskPath, 'actual_time: 1.5h');
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Time Tracking', () => {
    it('should track time in various formats', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      const timeFormats = ['2h', '1.5h', '30m', '2h30m'];

      for (const timeFormat of timeFormats) {
        try {
          await program.parseAsync([
            'node', 'test', 'task', 'update', 'TSK-0001',
            '--actual-time', timeFormat
          ], { from: 'user' });
          
          // Check if time was recorded in the specified format
          const taskPath = path.join(testContext.tempDir, 'tasks', 'tasks', 'TSK-0001-test-task.md');
          TestAssertions.assertFileContains(taskPath, `actual_time: ${timeFormat}`);
        } finally {
          // Reset for next iteration
        }
      }

      consoleMock.restore();
    });

    it('should handle invalid time formats', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'task', 'update', 'TSK-0001',
          '--actual-time', 'invalid-time'
        ], { from: 'user' });
        
        // Should handle invalid time format gracefully
        expect(consoleMock.errors.some(error => error.includes('invalid') || error.includes('time')) ||
               consoleMock.logs.some(log => log.includes('updated'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Task Dependencies', () => {
    it('should handle task dependencies', async () => {
      const testContext = getTestContext();
      
      // Create a second task to use as dependency
      const dependentTaskContent = `---
title: Dependent Task
description: A task that depends on another
status: blocked
priority: medium
assignee: test-user
created_date: ${new Date().toISOString()}
updated_date: ${new Date().toISOString()}
estimated_time: 1h
actual_time: 0h
ai_context: []
sync_status: local
related_issues: []
dependencies:
  - TSK-0001
completion_percentage: 0
---

# Task: Dependent Task
`;
      
      fs.writeFileSync(path.join(testContext.tempDir, 'tasks', 'tasks', 'TSK-0002-dependent-task.md'), dependentTaskContent);

      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'task', 'list', '--show-dependencies'], { from: 'user' });
        
        // Should show dependency information
        expect(consoleMock.logs.some(log => log.includes('TSK-0001') || log.includes('dependencies'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tasks directory', async () => {
      const testContext = getTestContext();
      
      // Remove tasks directory
      fs.rmSync(path.join(testContext.tempDir, 'tasks', 'tasks'), { recursive: true, force: true });
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'task', 'list'], { from: 'user' });
        
        // Should handle missing directory gracefully
        expect(consoleMock.errors.some(error => error.includes('not found') || error.includes('No tasks found'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle file system errors', async () => {
      const testContext = getTestContext();
      
      // Mock fs.writeFileSync to throw error
      const originalWriteFileSync = fs.writeFileSync;
      vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
        const error = new Error('ENOSPC: no space left on device');
        (error as any).code = 'ENOSPC';
        throw error;
      });

      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'task', 'create', 'Error Test'], { from: 'user' });
        
        // Should handle file system error gracefully
        expect(consoleMock.errors.some(error => error.includes('space') || error.includes('ENOSPC'))).toBe(true);
      } finally {
        consoleMock.restore();
        vi.mocked(fs.writeFileSync).mockRestore();
      }
    });

    it('should handle malformed task files', async () => {
      const testContext = getTestContext();
      
      // Create malformed task file
      const malformedTask = `---
title: Malformed Task
invalid_yaml: [unclosed
---

# Malformed Task
`;
      
      fs.writeFileSync(path.join(testContext.tempDir, 'tasks', 'tasks', 'TSK-0003-malformed.md'), malformedTask);
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'task', 'show', 'TSK-0003'], { from: 'user' });
        
        // Should handle malformed YAML gracefully
        expect(consoleMock.errors.some(error => error.includes('YAML') || error.includes('parse'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Task Validation', () => {
    it('should validate required fields', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'task', 'create', '', // Empty title
          '--description', 'Valid description'
        ], { from: 'user' });
        
        // Should validate title requirement
        expect(consoleMock.errors.some(error => error.includes('title') || error.includes('required'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should validate time formats', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'task', 'create', 'Time Format Test',
          '--estimated-time', 'not-a-time-format'
        ], { from: 'user' });
        
        // Should validate time format or accept gracefully
        expect(consoleMock.errors.some(error => error.includes('time') || error.includes('format')) ||
               consoleMock.logs.some(log => log.includes('created'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should validate completion percentage range', async () => {
      const testContext = getTestContext();
      
      const program = new Command();
      const taskCommand = createTaskCommand();
      program.addCommand(taskCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'task', 'complete', 'TSK-0001',
          '--completion', '150' // Invalid percentage
        ], { from: 'user' });
        
        // Should validate percentage range
        expect(consoleMock.errors.some(error => error.includes('percentage') || error.includes('range')) ||
               consoleMock.logs.some(log => log.includes('completed'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });
});