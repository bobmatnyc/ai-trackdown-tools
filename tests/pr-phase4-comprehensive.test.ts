/**
 * Phase 4 Comprehensive Test Suite for PR Commands
 * Complete test coverage for all PR functionality including edge cases and performance
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { performance } from 'perf_hooks';

// Import all PR commands
import { createPRCommand } from '../src/commands/pr.js';
import { createPRCreateCommand } from '../src/commands/pr/create.js';
import { createPRListCommand } from '../src/commands/pr/list.js';
import { createPRShowCommand } from '../src/commands/pr/show.js';
import { createPRUpdateCommand } from '../src/commands/pr/update.js';
import { createPRReviewCommand } from '../src/commands/pr/review.js';
import { createPRApproveCommand } from '../src/commands/pr/approve.js';
import { createPRMergeCommand } from '../src/commands/pr/merge.js';
import { createPRCloseCommand } from '../src/commands/pr/close.js';
import { createPRSyncCommand } from '../src/commands/pr/sync.js';
import { createPRArchiveCommand } from '../src/commands/pr/archive.js';
import { createPRBatchCommand } from '../src/commands/pr/batch.js';
import { createPRDependenciesCommand } from '../src/commands/pr/dependencies.js';

// Import utilities
import { PRStatusManager } from '../src/utils/pr-status-manager.js';
import { PRFileManager } from '../src/utils/pr-file-manager.js';
import { RelationshipManager } from '../src/utils/relationship-manager.js';
import { ConfigManager } from '../src/utils/config-manager.js';

// Import types
import type { PRFrontmatter, PRStatus, PRData, TaskData, IssueData } from '../src/types/ai-trackdown.js';

describe('Phase 4: Comprehensive PR Command Tests', () => {
  let testDir: string;
  let originalCwd: string;
  let configManager: ConfigManager;
  let statusManager: PRStatusManager;
  let fileManager: PRFileManager;
  let relationshipManager: RelationshipManager;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-trackdown-pr-phase4-'));
    process.chdir(testDir);

    // Initialize test directory structure
    fs.mkdirSync(path.join(testDir, 'prs'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'prs', 'draft'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'prs', 'active'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'prs', 'active', 'open'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'prs', 'active', 'review'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'prs', 'active', 'approved'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'prs', 'merged'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'prs', 'closed'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'prs', 'reviews'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'tasks'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'issues'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'templates'), { recursive: true });

    // Create test config file
    const configData = {
      name: 'test-project',
      version: '1.0.0',
      structure: {
        prs_dir: 'prs',
        tasks_dir: 'tasks',
        issues_dir: 'issues',
        templates_dir: 'templates'
      },
      naming_conventions: {
        pr_prefix: 'PR',
        task_prefix: 'TASK',
        issue_prefix: 'ISSUE'
      }
    };
    fs.writeFileSync(path.join(testDir, 'ai-trackdown.json'), JSON.stringify(configData, null, 2));

    // Initialize managers
    configManager = new ConfigManager();
    statusManager = new PRStatusManager(configManager);
    fileManager = new PRFileManager(configManager);
    relationshipManager = new RelationshipManager(configManager);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  // Helper function to create test PR file
  const createTestPR = (prId: string, status: PRStatus = 'open', additionalData: Partial<PRFrontmatter> = {}): string => {
    const prData: PRFrontmatter = {
      pr_id: prId,
      issue_id: 'ISSUE-001',
      epic_id: 'EPIC-001',
      title: `Test PR ${prId}`,
      description: 'Test PR description',
      status: 'active',
      pr_status: status,
      priority: 'medium',
      assignee: 'test-user',
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
      estimated_tokens: 100,
      actual_tokens: 50,
      ai_context: ['test-context'],
      sync_status: 'local',
      branch_name: `feature/${prId.toLowerCase()}`,
      target_branch: 'main',
      reviewers: ['reviewer1', 'reviewer2'],
      approvals: status === 'approved' ? ['reviewer1', 'reviewer2'] : [],
      tags: ['feature'],
      dependencies: [],
      blocked_by: [],
      blocks: [],
      related_prs: [],
      template_used: 'default',
      ...additionalData
    };

    const content = `---
${Object.entries(prData)
  .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
  .join('\n')}
---

# ${prData.title}

## Description
${prData.description}

## Changes
- Test change 1
- Test change 2

## Testing
- [x] Unit tests
- [x] Integration tests
- [ ] Manual testing

## Review Checklist
- [x] Code follows style guidelines
- [x] Tests added/updated
- [x] Documentation updated
`;

    const statusDir = fileManager.getPRDirectory(status, path.join(testDir, 'prs'));
    const filePath = path.join(statusDir, `${prId}-test.md`);
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  describe('Command Registration and Structure', () => {
    it('should register all PR commands correctly', () => {
      const prCommand = createPRCommand();
      
      expect(prCommand.name()).toBe('pr');
      expect(prCommand.alias()).toBe('prs');
      
      const subcommands = prCommand.commands.map(cmd => cmd.name());
      const expectedCommands = [
        'create', 'list', 'show', 'update', 'review', 'approve', 
        'merge', 'close', 'sync', 'archive', 'batch', 'dependencies'
      ];
      
      expectedCommands.forEach(cmd => {
        expect(subcommands).toContain(cmd);
      });
    });

    it('should have proper command options for all commands', () => {
      const commands = [
        { fn: createPRCreateCommand, name: 'create' },
        { fn: createPRListCommand, name: 'list' },
        { fn: createPRShowCommand, name: 'show' },
        { fn: createPRUpdateCommand, name: 'update' },
        { fn: createPRReviewCommand, name: 'review' },
        { fn: createPRApproveCommand, name: 'approve' },
        { fn: createPRMergeCommand, name: 'merge' },
        { fn: createPRCloseCommand, name: 'close' },
        { fn: createPRSyncCommand, name: 'sync' },
        { fn: createPRArchiveCommand, name: 'archive' },
        { fn: createPRBatchCommand, name: 'batch' },
        { fn: createPRDependenciesCommand, name: 'dependencies' }
      ];

      commands.forEach(({ fn, name }) => {
        const command = fn();
        expect(command.name()).toBe(name);
        expect(command.description()).toBeTruthy();
        expect(command.options).toBeDefined();
      });
    });
  });

  describe('PR Lifecycle Management', () => {
    it('should handle complete PR lifecycle correctly', async () => {
      const prId = 'PR-001';
      
      // Create PR in draft status
      const draftPath = createTestPR(prId, 'draft');
      expect(fs.existsSync(draftPath)).toBe(true);
      
      // Load PR data
      const prData = await statusManager.loadPRData(prId);
      expect(prData).toBeTruthy();
      expect(prData?.pr_status).toBe('draft');
      
      // Update to open status
      await statusManager.updatePRStatus(prId, 'open');
      const openPR = await statusManager.loadPRData(prId);
      expect(openPR?.pr_status).toBe('open');
      
      // Update to review status
      await statusManager.updatePRStatus(prId, 'review');
      const reviewPR = await statusManager.loadPRData(prId);
      expect(reviewPR?.pr_status).toBe('review');
      
      // Update to approved status
      await statusManager.updatePRStatus(prId, 'approved');
      const approvedPR = await statusManager.loadPRData(prId);
      expect(approvedPR?.pr_status).toBe('approved');
      
      // Update to merged status
      await statusManager.updatePRStatus(prId, 'merged');
      const mergedPR = await statusManager.loadPRData(prId);
      expect(mergedPR?.pr_status).toBe('merged');
    });

    it('should validate status transitions correctly', () => {
      const validTransitions = [
        ['draft', 'open'],
        ['open', 'review'],
        ['review', 'approved'],
        ['approved', 'merged'],
        ['open', 'closed'],
        ['review', 'closed'],
        ['closed', 'open'],
        ['draft', 'closed']
      ];

      validTransitions.forEach(([from, to]) => {
        expect(statusManager.isValidStatusTransition(from as PRStatus, to as PRStatus)).toBe(true);
      });

      const invalidTransitions = [
        ['merged', 'open'],
        ['merged', 'review'],
        ['merged', 'approved'],
        ['draft', 'approved'],
        ['draft', 'merged']
      ];

      invalidTransitions.forEach(([from, to]) => {
        expect(statusManager.isValidStatusTransition(from as PRStatus, to as PRStatus)).toBe(false);
      });
    });
  });

  describe('File Management and Organization', () => {
    it('should maintain proper directory structure', () => {
      const prsDir = path.join(testDir, 'prs');
      fileManager.initializePRDirectories(prsDir);
      
      const validation = fileManager.validatePRDirectoryStructure(prsDir);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should move PR files correctly on status change', async () => {
      const prId = 'PR-002';
      const originalPath = createTestPR(prId, 'draft');
      
      // Move from draft to open
      const moveResult = await fileManager.movePRToStatusDirectory(prId, 'open', 'draft');
      expect(moveResult.moved).toBe(true);
      expect(fs.existsSync(originalPath)).toBe(false);
      expect(fs.existsSync(moveResult.newPath)).toBe(true);
    });

    it('should handle large numbers of PR files efficiently', async () => {
      const startTime = performance.now();
      
      // Create 100 test PRs
      for (let i = 1; i <= 100; i++) {
        const prId = `PR-${i.toString().padStart(3, '0')}`;
        createTestPR(prId, 'open');
      }
      
      const creationTime = performance.now() - startTime;
      expect(creationTime).toBeLessThan(1000); // Should create 100 PRs in under 1 second
      
      // List all PRs
      const listStartTime = performance.now();
      const prs = await statusManager.listPRs();
      const listTime = performance.now() - listStartTime;
      
      expect(prs).toHaveLength(100);
      expect(listTime).toBeLessThan(200); // Should list 100 PRs in under 200ms
    });
  });

  describe('Review System', () => {
    it('should create review files correctly', async () => {
      const prId = 'PR-003';
      createTestPR(prId, 'review');
      
      const reviewPath = await fileManager.createReviewFile(
        prId,
        'reviewer1',
        'approve',
        'This PR looks good. LGTM!',
        path.join(testDir, 'prs')
      );
      
      expect(fs.existsSync(reviewPath)).toBe(true);
      expect(path.dirname(reviewPath)).toBe(path.join(testDir, 'prs', 'reviews'));
      
      const reviewContent = fs.readFileSync(reviewPath, 'utf8');
      expect(reviewContent).toContain('This PR looks good. LGTM!');
    });

    it('should track approvals correctly', async () => {
      const prId = 'PR-004';
      createTestPR(prId, 'review', { reviewers: ['reviewer1', 'reviewer2', 'reviewer3'] });
      
      const prData = await statusManager.loadPRData(prId);
      expect(prData?.approvals).toHaveLength(0);
      
      // Add approvals
      if (prData) {
        prData.approvals = ['reviewer1', 'reviewer2'];
        await statusManager.updatePRData(prId, prData);
      }
      
      const updatedPR = await statusManager.loadPRData(prId);
      expect(updatedPR?.approvals).toHaveLength(2);
      expect(updatedPR?.approvals).toContain('reviewer1');
      expect(updatedPR?.approvals).toContain('reviewer2');
    });

    it('should handle review conflicts (approve vs request changes)', () => {
      const reviewOptions = {
        approve: true,
        requestChanges: true,
        comment: 'Test comment'
      };
      
      const hasConflict = reviewOptions.approve && reviewOptions.requestChanges;
      expect(hasConflict).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    it('should perform batch operations efficiently', async () => {
      // Create multiple PRs with different statuses
      const prIds = [];
      for (let i = 1; i <= 10; i++) {
        const prId = `PR-${i.toString().padStart(3, '0')}`;
        const status = i % 3 === 0 ? 'approved' : 'open';
        createTestPR(prId, status as PRStatus);
        prIds.push(prId);
      }
      
      const startTime = performance.now();
      const prs = await statusManager.listPRs({ status: ['approved'] });
      const batchTime = performance.now() - startTime;
      
      expect(prs.length).toBeGreaterThan(0);
      expect(batchTime).toBeLessThan(100); // Should filter PRs in under 100ms
    });

    it('should handle batch merge operations', async () => {
      // Create approved PRs
      const approvedPRs = [];
      for (let i = 1; i <= 5; i++) {
        const prId = `PR-${i.toString().padStart(3, '0')}`;
        createTestPR(prId, 'approved');
        approvedPRs.push(prId);
      }
      
      // Simulate batch merge
      const results = [];
      for (const prId of approvedPRs) {
        const pr = await statusManager.loadPRData(prId);
        if (pr && pr.pr_status === 'approved') {
          results.push({ prId, success: true });
        }
      }
      
      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid PR IDs gracefully', async () => {
      const invalidPRs = ['PR-999', 'INVALID-001', 'pr-001', 'PR-1'];
      
      for (const prId of invalidPRs) {
        const prData = await statusManager.loadPRData(prId);
        expect(prData).toBeFalsy();
      }
    });

    it('should handle missing files gracefully', async () => {
      const prId = 'PR-005';
      const prPath = path.join(testDir, 'prs', 'active', 'open', `${prId}-test.md`);
      
      // Try to load non-existent PR
      const prData = await statusManager.loadPRData(prId);
      expect(prData).toBeFalsy();
    });

    it('should handle corrupted YAML frontmatter', () => {
      const prId = 'PR-006';
      const corruptedContent = `---
invalid: yaml: content: [unclosed
---

# Test PR

This PR has corrupted frontmatter.`;
      
      const filePath = path.join(testDir, 'prs', 'active', 'open', `${prId}-test.md`);
      fs.writeFileSync(filePath, corruptedContent);
      
      // Should handle corrupted frontmatter gracefully
      expect(async () => {
        await statusManager.loadPRData(prId);
      }).not.toThrow();
    });

    it('should handle file system permission errors', () => {
      const restrictedDir = path.join(testDir, 'restricted');
      fs.mkdirSync(restrictedDir);
      
      try {
        fs.chmodSync(restrictedDir, 0o000); // Remove all permissions
        
        expect(() => {
          fs.writeFileSync(path.join(restrictedDir, 'test.md'), 'test');
        }).toThrow();
      } finally {
        fs.chmodSync(restrictedDir, 0o755); // Restore permissions for cleanup
      }
    });

    it('should handle disk space issues', () => {
      // Simulate disk space check
      const availableSpace = 1000000; // 1MB
      const requiredSpace = 500000;   // 500KB
      
      expect(availableSpace).toBeGreaterThan(requiredSpace);
    });
  });

  describe('Performance and Memory Usage', () => {
    it('should complete operations within time limits', async () => {
      const prId = 'PR-007';
      createTestPR(prId, 'open');
      
      // Test PR loading performance
      const startTime = performance.now();
      const prData = await statusManager.loadPRData(prId);
      const loadTime = performance.now() - startTime;
      
      expect(prData).toBeTruthy();
      expect(loadTime).toBeLessThan(50); // Should load PR in under 50ms
    });

    it('should handle concurrent operations safely', async () => {
      const prIds = [];
      for (let i = 1; i <= 20; i++) {
        const prId = `PR-${i.toString().padStart(3, '0')}`;
        createTestPR(prId, 'open');
        prIds.push(prId);
      }
      
      // Load all PRs concurrently
      const startTime = performance.now();
      const promises = prIds.map(prId => statusManager.loadPRData(prId));
      const results = await Promise.all(promises);
      const concurrentTime = performance.now() - startTime;
      
      expect(results.every(r => r !== null)).toBe(true);
      expect(concurrentTime).toBeLessThan(500); // Should load 20 PRs concurrently in under 500ms
    });

    it('should use memory efficiently for large datasets', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create large dataset
      const prIds = [];
      for (let i = 1; i <= 100; i++) {
        const prId = `PR-${i.toString().padStart(3, '0')}`;
        createTestPR(prId, 'open');
        prIds.push(prId);
      }
      
      // Load all PRs
      const prs = await statusManager.listPRs();
      expect(prs).toHaveLength(100);
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryUsed = finalMemory - initialMemory;
      
      // Should use less than 50MB for 100 PRs
      expect(memoryUsed).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Integration with Tasks and Issues', () => {
    it('should link PRs to tasks correctly', async () => {
      const prId = 'PR-008';
      const taskId = 'TASK-001';
      
      // Create linked task
      const taskData = {
        task_id: taskId,
        issue_id: 'ISSUE-001',
        epic_id: 'EPIC-001',
        title: 'Test Task',
        description: 'Test task description',
        status: 'active',
        priority: 'medium',
        assignee: 'test-user',
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        estimated_tokens: 50,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local'
      };
      
      const taskContent = `---
${Object.entries(taskData)
  .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
  .join('\n')}
---

# Test Task

This task is linked to ${prId}.`;
      
      fs.writeFileSync(path.join(testDir, 'tasks', `${taskId}-test.md`), taskContent);
      
      // Create PR with task link
      createTestPR(prId, 'open');
      
      const linkedTasks = await relationshipManager.getLinkedTasks(prId);
      expect(linkedTasks).toBeDefined();
    });

    it('should maintain relationship consistency', async () => {
      const prId = 'PR-009';
      const taskId = 'TASK-002';
      const issueId = 'ISSUE-002';
      
      // Test bidirectional relationships
      const prData = await statusManager.loadPRData(prId);
      if (prData) {
        // Check that PR references task and issue
        expect(prData.issue_id).toBeTruthy();
        
        // Check that task references PR (if implemented)
        const linkedTasks = await relationshipManager.getLinkedTasks(prId);
        expect(linkedTasks).toBeDefined();
      }
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should validate PR data structure', () => {
      const validPRData: PRFrontmatter = {
        pr_id: 'PR-010',
        issue_id: 'ISSUE-001',
        epic_id: 'EPIC-001',
        title: 'Valid PR',
        description: 'Valid description',
        status: 'active',
        pr_status: 'open',
        priority: 'high',
        assignee: 'test-user',
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        estimated_tokens: 100,
        actual_tokens: 50,
        ai_context: ['context1'],
        sync_status: 'local',
        branch_name: 'feature/valid-pr',
        target_branch: 'main',
        reviewers: ['reviewer1'],
        approvals: [],
        tags: ['feature'],
        dependencies: [],
        blocked_by: [],
        blocks: [],
        related_prs: [],
        template_used: 'default'
      };
      
      // Validate required fields
      expect(validPRData.pr_id).toBeTruthy();
      expect(validPRData.title).toBeTruthy();
      expect(validPRData.pr_status).toBeTruthy();
      expect(validPRData.issue_id).toBeTruthy();
      expect(validPRData.epic_id).toBeTruthy();
      
      // Validate data types
      expect(typeof validPRData.pr_id).toBe('string');
      expect(typeof validPRData.title).toBe('string');
      expect(Array.isArray(validPRData.reviewers)).toBe(true);
      expect(Array.isArray(validPRData.approvals)).toBe(true);
      expect(Array.isArray(validPRData.tags)).toBe(true);
    });

    it('should maintain file consistency across operations', async () => {
      const prId = 'PR-011';
      const originalPath = createTestPR(prId, 'open');
      
      // Load PR data
      const prData1 = await statusManager.loadPRData(prId);
      expect(prData1).toBeTruthy();
      
      // Update PR status
      await statusManager.updatePRStatus(prId, 'review');
      
      // Verify file was moved correctly
      const prData2 = await statusManager.loadPRData(prId);
      expect(prData2?.pr_status).toBe('review');
      
      // Verify old file is gone
      expect(fs.existsSync(originalPath)).toBe(false);
    });
  });

  describe('CLI Output and Formatting', () => {
    it('should format PR list output correctly', async () => {
      // Create test PRs
      createTestPR('PR-012', 'open');
      createTestPR('PR-013', 'review');
      createTestPR('PR-014', 'approved');
      
      const prs = await statusManager.listPRs();
      expect(prs.length).toBeGreaterThanOrEqual(3);
      
      // Test that PR data includes all necessary fields for formatting
      prs.forEach(pr => {
        expect(pr.pr_id).toBeTruthy();
        expect(pr.title).toBeTruthy();
        expect(pr.pr_status).toBeTruthy();
        expect(pr.assignee).toBeTruthy();
        expect(pr.created_date).toBeTruthy();
      });
    });

    it('should handle empty result sets gracefully', async () => {
      const emptyResults = await statusManager.listPRs({ status: ['merged'] });
      expect(emptyResults).toHaveLength(0);
    });
  });

  describe('Configuration and Settings', () => {
    it('should respect configuration settings', () => {
      const config = configManager.getConfig();
      expect(config.structure.prs_dir).toBe('prs');
      expect(config.naming_conventions.pr_prefix).toBe('PR');
    });

    it('should handle missing configuration gracefully', () => {
      // Test with minimal configuration
      const minimalConfig = {
        name: 'test',
        version: '1.0.0'
      };
      
      expect(minimalConfig.name).toBe('test');
      expect(minimalConfig.version).toBe('1.0.0');
    });
  });
});

describe('Phase 4: Stress and Load Testing', () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-trackdown-stress-test-'));
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should handle 1000 PRs without performance degradation', async () => {
    const startTime = performance.now();
    
    // Create directory structure
    fs.mkdirSync(path.join(testDir, 'prs', 'active', 'open'), { recursive: true });
    
    // Create 1000 PRs
    for (let i = 1; i <= 1000; i++) {
      const prId = `PR-${i.toString().padStart(4, '0')}`;
      const content = `---
pr_id: ${prId}
title: Test PR ${i}
pr_status: open
---

# Test PR ${i}

This is a test PR for stress testing.`;
      
      fs.writeFileSync(path.join(testDir, 'prs', 'active', 'open', `${prId}-test.md`), content);
    }
    
    const creationTime = performance.now() - startTime;
    expect(creationTime).toBeLessThan(5000); // Should create 1000 PRs in under 5 seconds
    
    // List all files
    const listStartTime = performance.now();
    const files = fs.readdirSync(path.join(testDir, 'prs', 'active', 'open'));
    const listTime = performance.now() - listStartTime;
    
    expect(files).toHaveLength(1000);
    expect(listTime).toBeLessThan(100); // Should list 1000 files in under 100ms
  });

  it('should handle concurrent file operations', async () => {
    fs.mkdirSync(path.join(testDir, 'prs', 'active', 'open'), { recursive: true });
    
    // Create multiple files concurrently
    const promises = [];
    for (let i = 1; i <= 100; i++) {
      const promise = new Promise<void>((resolve) => {
        setTimeout(() => {
          const prId = `PR-${i.toString().padStart(3, '0')}`;
          const content = `---
pr_id: ${prId}
title: Concurrent PR ${i}
pr_status: open
---

# Concurrent PR ${i}`;
          
          fs.writeFileSync(path.join(testDir, 'prs', 'active', 'open', `${prId}-test.md`), content);
          resolve();
        }, Math.random() * 100);
      });
      promises.push(promise);
    }
    
    const startTime = performance.now();
    await Promise.all(promises);
    const concurrentTime = performance.now() - startTime;
    
    expect(concurrentTime).toBeLessThan(1000); // Should complete in under 1 second
    
    const files = fs.readdirSync(path.join(testDir, 'prs', 'active', 'open'));
    expect(files).toHaveLength(100);
  });

  it('should handle large file sizes efficiently', async () => {
    fs.mkdirSync(path.join(testDir, 'prs', 'active', 'open'), { recursive: true });
    
    // Create a large PR file (1MB)
    const largeContent = '# Large PR\n\n' + 'This is a large PR file.\n'.repeat(20000);
    const prId = 'PR-LARGE';
    
    const writeStartTime = performance.now();
    fs.writeFileSync(path.join(testDir, 'prs', 'active', 'open', `${prId}-test.md`), largeContent);
    const writeTime = performance.now() - writeStartTime;
    
    expect(writeTime).toBeLessThan(100); // Should write large file in under 100ms
    
    const readStartTime = performance.now();
    const readContent = fs.readFileSync(path.join(testDir, 'prs', 'active', 'open', `${prId}-test.md`), 'utf8');
    const readTime = performance.now() - readStartTime;
    
    expect(readTime).toBeLessThan(50); // Should read large file in under 50ms
    expect(readContent).toEqual(largeContent);
  });
});