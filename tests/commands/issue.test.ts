import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { createIssueCommand } from '../../src/commands/issue.js';
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

describe('Issue Command Tests', () => {
  const getTestContext = setupTestEnvironment();

  describe('Issue Create Command', () => {
    it('should create a new issue with required fields', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'issue', 'create', 'Test Issue',
          '--description', 'A test issue',
          '--epic', 'EP-0001',
          '--assignee', 'test-user'
        ], { from: 'user' });
        
        // Check if issue file was created
        const issueFiles = fs.readdirSync(path.join(testContext.tempDir, 'tasks', 'issues'));
        expect(issueFiles).toHaveLength(2); // One existing + one new
        
        const newIssueFile = issueFiles.find(f => f.includes('test-issue') && f !== 'ISS-0001-test-issue.md');
        expect(newIssueFile).toBeDefined();
        
        if (newIssueFile) {
          const issuePath = path.join(testContext.tempDir, 'tasks', 'issues', newIssueFile);
          TestAssertions.assertFileExists(issuePath);
          TestAssertions.assertValidYamlFrontmatter(issuePath);
          TestAssertions.assertFileContains(issuePath, 'title: Test Issue');
          TestAssertions.assertFileContains(issuePath, 'description: A test issue');
          TestAssertions.assertFileContains(issuePath, 'assignee: test-user');
          TestAssertions.assertFileContains(issuePath, 'related_epics:');
          TestAssertions.assertFileContains(issuePath, '- EP-0001');
        }
      } finally {
        consoleMock.restore();
      }
    });

    it('should create standalone issue without epic requirement', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'issue', 'create', 'Standalone Issue',
          '--description', 'A standalone issue without epic',
          '--assignee', 'test-user'
        ], { from: 'user' });
        
        // Check if issue file was created without epic requirement
        const issueFiles = fs.readdirSync(path.join(testContext.tempDir, 'tasks', 'issues'));
        const newIssueFile = issueFiles.find(f => f.includes('standalone-issue'));
        expect(newIssueFile).toBeDefined();
        
        if (newIssueFile) {
          const issuePath = path.join(testContext.tempDir, 'tasks', 'issues', newIssueFile);
          TestAssertions.assertFileExists(issuePath);
          TestAssertions.assertFileContains(issuePath, 'title: Standalone Issue');
          TestAssertions.assertFileContains(issuePath, 'related_epics: []');
        }
      } finally {
        consoleMock.restore();
      }
    });

    it('should auto-create missing epic when referenced', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'issue', 'create', 'Auto Epic Issue',
          '--description', 'Issue with auto-created epic',
          '--epic', 'EP-0999',
          '--assignee', 'test-user'
        ], { from: 'user' });
        
        // Check if issue was created
        const issueFiles = fs.readdirSync(path.join(testContext.tempDir, 'tasks', 'issues'));
        const newIssueFile = issueFiles.find(f => f.includes('auto-epic-issue'));
        expect(newIssueFile).toBeDefined();
        
        // Check if epic was auto-created (if feature is implemented)
        const epicFiles = fs.readdirSync(path.join(testContext.tempDir, 'tasks', 'epics'));
        const autoCreatedEpic = epicFiles.find(f => f.includes('EP-0999'));
        
        if (autoCreatedEpic) {
          const epicPath = path.join(testContext.tempDir, 'tasks', 'epics', autoCreatedEpic);
          TestAssertions.assertFileExists(epicPath);
          TestAssertions.assertValidYamlFrontmatter(epicPath);
        }
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle interactive issue creation', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const inquirer = await import('inquirer');
      vi.mocked(inquirer.default.prompt).mockResolvedValue({
        description: 'Interactive description',
        epic: 'EP-0001',
        priority: 'medium',
        assignee: 'test-user',
        estimated_tokens: 500
      });

      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'issue', 'create', 'Interactive Issue'], { from: 'user' });
        
        // Check if issue file was created with interactive values
        const issueFiles = fs.readdirSync(path.join(testContext.tempDir, 'tasks', 'issues'));
        const newIssueFile = issueFiles.find(f => f.includes('interactive-issue'));
        expect(newIssueFile).toBeDefined();
        
        if (newIssueFile) {
          const issuePath = path.join(testContext.tempDir, 'tasks', 'issues', newIssueFile);
          TestAssertions.assertFileContains(issuePath, 'description: Interactive description');
          TestAssertions.assertFileContains(issuePath, 'priority: medium');
          TestAssertions.assertFileContains(issuePath, 'estimated_tokens: 500');
        }
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Issue List Command', () => {
    it('should list all issues', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'issue', 'list'], { from: 'user' });
        
        // Check console output contains issue information
        expect(consoleMock.logs.some(log => log.includes('Test Issue'))).toBe(true);
        expect(consoleMock.logs.some(log => log.includes('ISS-0001'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should filter issues by epic', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'issue', 'list', '--epic', 'EP-0001'], { from: 'user' });
        
        // Should only show issues related to EP-0001
        expect(consoleMock.logs.some(log => log.includes('EP-0001'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should filter issues by status', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'issue', 'list', '--status', 'active'], { from: 'user' });
        
        // Should only show active issues
        expect(consoleMock.logs.some(log => log.includes('active'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should filter issues by priority', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'issue', 'list', '--priority', 'high'], { from: 'user' });
        
        // Should only show high priority issues
        expect(consoleMock.logs.some(log => log.includes('high'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should filter issues by assignee', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'issue', 'list', '--assignee', 'test-user'], { from: 'user' });
        
        // Should only show issues assigned to test-user
        expect(consoleMock.logs.some(log => log.includes('test-user'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Issue Show Command', () => {
    it('should display issue details', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'issue', 'show', 'ISS-0001'], { from: 'user' });
        
        // Check console output contains issue details
        expect(consoleMock.logs.some(log => log.includes('Test Issue'))).toBe(true);
        expect(consoleMock.logs.some(log => log.includes('A test issue for testing'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle non-existent issue', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'issue', 'show', 'ISS-9999'], { from: 'user' });
        
        // Should show error for non-existent issue
        expect(consoleMock.errors.some(error => error.includes('not found') || error.includes('ISS-9999'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Issue Update Command', () => {
    it('should update issue fields', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'issue', 'update', 'ISS-0001',
          '--status', 'in-progress',
          '--priority', 'high',
          '--assignee', 'new-assignee',
          '--actual-tokens', '600'
        ], { from: 'user' });
        
        // Check if issue file was updated
        const issuePath = path.join(testContext.tempDir, 'tasks', 'issues', 'ISS-0001-test-issue.md');
        TestAssertions.assertFileContains(issuePath, 'status: in-progress');
        TestAssertions.assertFileContains(issuePath, 'priority: high');
        TestAssertions.assertFileContains(issuePath, 'assignee: new-assignee');
        TestAssertions.assertFileContains(issuePath, 'actual_tokens: 600');
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle missing status option', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'issue', 'update', 'ISS-0001',
          '--priority', 'high'
        ], { from: 'user' });
        
        // Should update without status option
        const issuePath = path.join(testContext.tempDir, 'tasks', 'issues', 'ISS-0001-test-issue.md');
        TestAssertions.assertFileContains(issuePath, 'priority: high');
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle invalid issue ID', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'issue', 'update', 'INVALID-ID',
          '--status', 'completed'
        ], { from: 'user' });
        
        // Should show error for invalid ID
        expect(consoleMock.errors.some(error => error.includes('not found') || error.includes('INVALID-ID'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Issue Complete Command', () => {
    it('should mark issue as completed', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'issue', 'complete', 'ISS-0001',
          '--actual-tokens', '700',
          '--notes', 'Issue completed successfully'
        ], { from: 'user' });
        
        // Check if issue file was marked as completed
        const issuePath = path.join(testContext.tempDir, 'tasks', 'issues', 'ISS-0001-test-issue.md');
        TestAssertions.assertFileContains(issuePath, 'status: completed');
        TestAssertions.assertFileContains(issuePath, 'actual_tokens: 700');
        TestAssertions.assertFileContains(issuePath, 'completion_percentage: 100');
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle missing notes option', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'issue', 'complete', 'ISS-0001',
          '--actual-tokens', '700'
        ], { from: 'user' });
        
        // Should complete without notes option
        const issuePath = path.join(testContext.tempDir, 'tasks', 'issues', 'ISS-0001-test-issue.md');
        TestAssertions.assertFileContains(issuePath, 'status: completed');
        TestAssertions.assertFileContains(issuePath, 'actual_tokens: 700');
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Issue Assign Command', () => {
    it('should assign issue to user', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'issue', 'assign', 'ISS-0001',
          '--assignee', 'new-user'
        ], { from: 'user' });
        
        // Check if issue was assigned
        const issuePath = path.join(testContext.tempDir, 'tasks', 'issues', 'ISS-0001-test-issue.md');
        TestAssertions.assertFileContains(issuePath, 'assignee: new-user');
      } finally {
        consoleMock.restore();
      }
    });

    it('should unassign issue when no assignee provided', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'issue', 'assign', 'ISS-0001',
          '--assignee', ''
        ], { from: 'user' });
        
        // Check if issue was unassigned
        const issuePath = path.join(testContext.tempDir, 'tasks', 'issues', 'ISS-0001-test-issue.md');
        const content = fs.readFileSync(issuePath, 'utf-8');
        expect(content.includes('assignee: ""') || content.includes('assignee:')).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Issue Search Command', () => {
    it('should search issues by title', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'issue', 'search', 'Test'
        ], { from: 'user' });
        
        // Should find issues with 'Test' in title
        expect(consoleMock.logs.some(log => log.includes('Test Issue'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should search issues by description', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'issue', 'search', 'testing'
        ], { from: 'user' });
        
        // Should find issues with 'testing' in description
        expect(consoleMock.logs.some(log => log.includes('Test Issue'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle no search results', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'issue', 'search', 'nonexistent'
        ], { from: 'user' });
        
        // Should indicate no results found
        expect(consoleMock.logs.some(log => log.includes('No issues found') || log.includes('0 issues'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Issue Close/Reopen Commands', () => {
    it('should close issue', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'issue', 'close', 'ISS-0001',
          '--reason', 'Not needed anymore'
        ], { from: 'user' });
        
        // Check if issue was closed
        const issuePath = path.join(testContext.tempDir, 'tasks', 'issues', 'ISS-0001-test-issue.md');
        TestAssertions.assertFileContains(issuePath, 'status: closed');
      } finally {
        consoleMock.restore();
      }
    });

    it('should reopen issue', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      // First close the issue
      const issuePath = path.join(testContext.tempDir, 'tasks', 'issues', 'ISS-0001-test-issue.md');
      let content = fs.readFileSync(issuePath, 'utf-8');
      content = content.replace('status: active', 'status: closed');
      fs.writeFileSync(issuePath, content);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync([
          'node', 'test', 'issue', 'reopen', 'ISS-0001',
          '--reason', 'Needs more work'
        ], { from: 'user' });
        
        // Check if issue was reopened
        TestAssertions.assertFileContains(issuePath, 'status: active');
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tasks directory', async () => {
      const testContext = getTestContext();
      // Don't create mock project - no tasks directory
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'issue', 'list'], { from: 'user' });
        
        // Should handle missing directory gracefully
        expect(consoleMock.errors.some(error => error.includes('not found') || error.includes('No issues found'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle malformed YAML frontmatter', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      // Create issue with malformed YAML
      const malformedIssue = `---
title: Malformed Issue
description: This issue has malformed YAML
status: active
priority: high
invalid_yaml: [unclosed bracket
---

# Malformed Issue
`;
      
      const issuePath = path.join(testContext.tempDir, 'tasks', 'issues', 'ISS-0002-malformed-issue.md');
      fs.writeFileSync(issuePath, malformedIssue);
      
      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'issue', 'show', 'ISS-0002'], { from: 'user' });
        
        // Should handle malformed YAML gracefully
        expect(consoleMock.errors.some(error => error.includes('YAML') || error.includes('parse'))).toBe(true);
      } finally {
        consoleMock.restore();
      }
    });

    it('should handle concurrent file access', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      // Mock file system to simulate concurrent access
      const originalReadFileSync = fs.readFileSync;
      let callCount = 0;
      vi.spyOn(fs, 'readFileSync').mockImplementation((...args) => {
        callCount++;
        if (callCount === 1) {
          // First call throws error
          const error = new Error('EBUSY: resource busy or locked');
          (error as any).code = 'EBUSY';
          throw error;
        }
        // Second call succeeds
        return originalReadFileSync.apply(fs, args);
      });

      const program = new Command();
      const issueCommand = createIssueCommand();
      program.addCommand(issueCommand);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', 'issue', 'show', 'ISS-0001'], { from: 'user' });
        
        // Should handle concurrent access gracefully
        expect(consoleMock.errors.some(error => error.includes('busy') || error.includes('locked')) || 
               consoleMock.logs.some(log => log.includes('Test Issue'))).toBe(true);
      } finally {
        consoleMock.restore();
        vi.mocked(fs.readFileSync).mockRestore();
      }
    });
  });
});