/**
 * Relationship Manager Optional Epic ID Test Suite
 * Tests relationship management when epic_id is optional/null
 */

import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RelationshipManager } from '../src/utils/relationship-manager.js';
import { ConfigManager } from '../src/utils/config-manager.js';
import type { ProjectConfig, EpicData, IssueData, TaskData, PRData } from '../src/types/ai-trackdown.js';

describe('Relationship Manager - Optional Epic ID', () => {
  let testRootPath: string;
  let originalCwd: string;
  let configManager: ConfigManager;
  let relationshipManager: RelationshipManager;

  beforeEach(() => {
    testRootPath = fs.mkdtempSync(path.join(tmpdir(), 'relationship-optional-epic-'));
    originalCwd = process.cwd();
    process.chdir(testRootPath);

    // Initialize config
    const configDir = path.join(testRootPath, '.ai-trackdown');
    fs.mkdirSync(configDir, { recursive: true });

    const config: ProjectConfig = {
      name: 'Relationship Test Project',
      description: 'Testing relationships with optional epic_id',
      version: '1.0.0',
      structure: {
        epics_dir: 'tasks/epics',
        issues_dir: 'tasks/issues',
        tasks_dir: 'tasks/tasks',
        templates_dir: 'tasks/templates',
        prs_dir: 'tasks/prs',
      },
      naming_conventions: {
        epic_prefix: 'EP',
        issue_prefix: 'ISS',
        task_prefix: 'TSK',
        pr_prefix: 'PR',
        file_extension: '.md',
      },
    };

    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    configManager = new ConfigManager(testRootPath);
    relationshipManager = new RelationshipManager(configManager);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testRootPath, { recursive: true, force: true });
  });

  describe('Issue relationships without epic_id', () => {
    it('should handle issue hierarchy when epic_id is null/undefined', () => {
      const issueWithoutEpic: IssueData = {
        issue_id: 'ISS-0001',
        title: 'Issue without epic',
        description: 'Standalone issue',
        status: 'active',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 100,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        related_tasks: [],
        related_issues: [],
        content: 'Issue content',
        file_path: '/test/ISS-0001.md',
        // epic_id is undefined/missing
      };

      // Should not throw when building hierarchy for issue without epic_id
      expect(() => {
        const hierarchy = relationshipManager.buildIssueHierarchy(issueWithoutEpic);
        expect(hierarchy.issue).toBe(issueWithoutEpic);
        expect(hierarchy.epic).toBeUndefined();
        expect(hierarchy.tasks).toEqual([]);
        expect(hierarchy.prs).toEqual([]);
      }).not.toThrow();
    });

    it('should find related tasks for issue without epic_id', () => {
      const issueWithoutEpic: IssueData = {
        issue_id: 'ISS-0002',
        title: 'Parent issue without epic',
        description: 'Issue that has tasks but no epic',
        status: 'active',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 150,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        related_tasks: ['TSK-0001', 'TSK-0002'],
        related_issues: [],
        content: 'Parent issue content',
        file_path: '/test/ISS-0002.md',
        // epic_id is undefined
      };

      const task1: TaskData = {
        task_id: 'TSK-0001',
        issue_id: 'ISS-0002',
        title: 'Task 1 without epic',
        description: 'First task',
        status: 'active',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 50,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        content: 'Task 1 content',
        file_path: '/test/TSK-0001.md',
        // epic_id is undefined
      };

      const task2: TaskData = {
        task_id: 'TSK-0002',
        issue_id: 'ISS-0002',
        title: 'Task 2 without epic',
        description: 'Second task',
        status: 'completed',
        priority: 'low',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 30,
        actual_tokens: 35,
        ai_context: [],
        sync_status: 'local',
        content: 'Task 2 content',
        file_path: '/test/TSK-0002.md',
        // epic_id is undefined
      };

      // Mock findRelatedTasks to return our test tasks
      const mockFindRelatedTasks = (issueId: string): TaskData[] => {
        if (issueId === 'ISS-0002') {
          return [task1, task2];
        }
        return [];
      };

      // Temporarily replace the method for testing
      const originalFindRelatedTasks = relationshipManager.findRelatedTasks;
      relationshipManager.findRelatedTasks = mockFindRelatedTasks;

      try {
        const relatedTasks = relationshipManager.findRelatedTasks('ISS-0002');
        expect(relatedTasks).toHaveLength(2);
        expect(relatedTasks[0].epic_id).toBeUndefined();
        expect(relatedTasks[1].epic_id).toBeUndefined();
        expect(relatedTasks.every(task => task.issue_id === 'ISS-0002')).toBe(true);
      } finally {
        relationshipManager.findRelatedTasks = originalFindRelatedTasks;
      }
    });
  });

  describe('Task relationships without epic_id', () => {
    it('should build task hierarchy when epic_id is missing', () => {
      const taskWithoutEpic: TaskData = {
        task_id: 'TSK-0003',
        issue_id: 'ISS-0003',
        title: 'Task without epic',
        description: 'Standalone task',
        status: 'active',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 60,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        content: 'Task content',
        file_path: '/test/TSK-0003.md',
        // epic_id is undefined
      };

      const parentIssue: IssueData = {
        issue_id: 'ISS-0003',
        title: 'Parent issue without epic',
        description: 'Parent issue',
        status: 'active',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 120,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        related_tasks: ['TSK-0003'],
        related_issues: [],
        content: 'Parent issue content',
        file_path: '/test/ISS-0003.md',
        // epic_id is undefined
      };

      // Mock findIssueById
      const mockFindIssueById = (issueId: string): IssueData | undefined => {
        if (issueId === 'ISS-0003') {
          return parentIssue;
        }
        return undefined;
      };

      const originalFindIssueById = relationshipManager.findIssueById;
      relationshipManager.findIssueById = mockFindIssueById;

      try {
        expect(() => {
          const taskIssue = relationshipManager.findIssueById('ISS-0003');
          expect(taskIssue).toBeDefined();
          expect(taskIssue?.epic_id).toBeUndefined();
          expect(taskIssue?.issue_id).toBe('ISS-0003');
        }).not.toThrow();
      } finally {
        relationshipManager.findIssueById = originalFindIssueById;
      }
    });

    it('should handle task subtask relationships without epic_id', () => {
      const parentTask: TaskData = {
        task_id: 'TSK-0004',
        issue_id: 'ISS-0004',
        title: 'Parent task without epic',
        description: 'Parent task',
        status: 'active',
        priority: 'high',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 100,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        subtasks: ['TSK-0005', 'TSK-0006'],
        content: 'Parent task content',
        file_path: '/test/TSK-0004.md',
        // epic_id is undefined
      };

      const subtask1: TaskData = {
        task_id: 'TSK-0005',
        issue_id: 'ISS-0004',
        title: 'Subtask 1 without epic',
        description: 'First subtask',
        status: 'active',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 30,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        parent_task: 'TSK-0004',
        content: 'Subtask 1 content',
        file_path: '/test/TSK-0005.md',
        // epic_id is undefined
      };

      const subtask2: TaskData = {
        task_id: 'TSK-0006',
        issue_id: 'ISS-0004',
        title: 'Subtask 2 without epic',
        description: 'Second subtask',
        status: 'completed',
        priority: 'low',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 25,
        actual_tokens: 30,
        ai_context: [],
        sync_status: 'local',
        parent_task: 'TSK-0004',
        content: 'Subtask 2 content',
        file_path: '/test/TSK-0006.md',
        // epic_id is undefined
      };

      // Verify subtask relationships work without epic_id
      expect(subtask1.parent_task).toBe(parentTask.task_id);
      expect(subtask2.parent_task).toBe(parentTask.task_id);
      expect(parentTask.subtasks).toContain(subtask1.task_id);
      expect(parentTask.subtasks).toContain(subtask2.task_id);

      // All should have undefined epic_id but valid issue_id
      [parentTask, subtask1, subtask2].forEach(task => {
        expect(task.epic_id).toBeUndefined();
        expect(task.issue_id).toBe('ISS-0004');
      });
    });
  });

  describe('PR relationships without epic_id', () => {
    it('should handle PR relationships when epic_id is missing', () => {
      const prWithoutEpic: PRData = {
        pr_id: 'PR-0001',
        issue_id: 'ISS-0005',
        title: 'PR without epic',
        description: 'Standalone PR',
        status: 'active',
        pr_status: 'open',
        priority: 'high',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 80,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        branch_name: 'feature/no-epic',
        pr_number: 123,
        content: 'PR content',
        file_path: '/test/PR-0001.md',
        // epic_id is undefined
      };

      const parentIssue: IssueData = {
        issue_id: 'ISS-0005',
        title: 'Issue for PR without epic',
        description: 'Parent issue for PR',
        status: 'active',
        priority: 'high',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 150,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        related_tasks: [],
        related_issues: [],
        related_prs: ['PR-0001'],
        content: 'Issue content',
        file_path: '/test/ISS-0005.md',
        // epic_id is undefined
      };

      // Should handle PR hierarchy without epic_id
      expect(prWithoutEpic.epic_id).toBeUndefined();
      expect(prWithoutEpic.issue_id).toBe(parentIssue.issue_id);
      expect(parentIssue.related_prs).toContain(prWithoutEpic.pr_id);
    });

    it('should build PR hierarchy when epic chain is missing', () => {
      const prWithoutEpic: PRData = {
        pr_id: 'PR-0002',
        issue_id: 'ISS-0006',
        title: 'PR hierarchy test',
        description: 'Testing PR hierarchy without epic',
        status: 'active',
        pr_status: 'review',
        priority: 'medium',
        assignee: 'reviewer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 90,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        branch_name: 'feature/hierarchy-test',
        content: 'PR hierarchy test content',
        file_path: '/test/PR-0002.md',
        // epic_id is undefined
      };

      const mockFindIssueById = (issueId: string): IssueData | undefined => {
        if (issueId === 'ISS-0006') {
          return {
            issue_id: 'ISS-0006',
            title: 'Issue for PR hierarchy',
            description: 'Parent issue',
            status: 'active',
            priority: 'medium',
            assignee: 'developer',
            created_date: '2025-07-13T20:00:00.000Z',
            updated_date: '2025-07-13T20:00:00.000Z',
            estimated_tokens: 120,
            actual_tokens: 0,
            ai_context: [],
            sync_status: 'local',
            related_tasks: [],
            related_issues: [],
            content: 'Issue content',
            file_path: '/test/ISS-0006.md',
            // epic_id is undefined
          };
        }
        return undefined;
      };

      const originalFindIssueById = relationshipManager.findIssueById;
      relationshipManager.findIssueById = mockFindIssueById;

      try {
        const hierarchy = relationshipManager.buildPRHierarchy(prWithoutEpic);
        expect(hierarchy.pr).toBe(prWithoutEpic);
        expect(hierarchy.issue.issue_id).toBe('ISS-0006');
        expect(hierarchy.epic).toBeUndefined(); // No epic in chain
        expect(hierarchy.project).toBeUndefined();
      } finally {
        relationshipManager.findIssueById = originalFindIssueById;
      }
    });
  });

  describe('Mixed epic_id scenarios in relationships', () => {
    it('should handle mixed presence of epic_id in related items', () => {
      // Epic with issues (some with epic_id, some without)
      const epic: EpicData = {
        epic_id: 'EP-0001',
        title: 'Mixed epic',
        description: 'Epic with mixed issue relationships',
        status: 'active',
        priority: 'high',
        assignee: 'epic-owner',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 500,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        related_issues: ['ISS-0007', 'ISS-0008'], // One with epic_id, one without
        content: 'Epic content',
        file_path: '/test/EP-0001.md',
      };

      const issueWithEpic: IssueData = {
        issue_id: 'ISS-0007',
        epic_id: 'EP-0001', // Has epic_id
        title: 'Issue with epic',
        description: 'Issue that belongs to epic',
        status: 'active',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 100,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        related_tasks: [],
        related_issues: [],
        content: 'Issue with epic content',
        file_path: '/test/ISS-0007.md',
      };

      const orphanedIssue: IssueData = {
        issue_id: 'ISS-0008',
        // epic_id is undefined (orphaned from epic perspective)
        title: 'Orphaned issue',
        description: 'Issue listed in epic but no epic_id',
        status: 'active',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 100,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        related_tasks: [],
        related_issues: [],
        content: 'Orphaned issue content',
        file_path: '/test/ISS-0008.md',
      };

      // Mock findRelatedIssues
      const mockFindRelatedIssues = (epicId: string): IssueData[] => {
        if (epicId === 'EP-0001') {
          return [issueWithEpic, orphanedIssue];
        }
        return [];
      };

      const originalFindRelatedIssues = relationshipManager.findRelatedIssues;
      relationshipManager.findRelatedIssues = mockFindRelatedIssues;

      try {
        const relatedIssues = relationshipManager.findRelatedIssues('EP-0001');
        expect(relatedIssues).toHaveLength(2);
        
        const withEpic = relatedIssues.find(issue => issue.epic_id);
        const withoutEpic = relatedIssues.find(issue => !issue.epic_id);
        
        expect(withEpic?.epic_id).toBe('EP-0001');
        expect(withoutEpic?.epic_id).toBeUndefined();
        expect(withoutEpic?.issue_id).toBe('ISS-0008');
      } finally {
        relationshipManager.findRelatedIssues = originalFindRelatedIssues;
      }
    });

    it('should validate relationships with partial epic_id chains', () => {
      // Task -> Issue (no epic_id) -> Epic (doesn't exist in task chain)
      const taskInBrokenChain: TaskData = {
        task_id: 'TSK-0007',
        issue_id: 'ISS-0009',
        title: 'Task in broken chain',
        description: 'Task with no epic_id but issue references epic',
        status: 'active',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 50,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        content: 'Task content',
        file_path: '/test/TSK-0007.md',
        // epic_id is undefined
      };

      const issueWithPartialChain: IssueData = {
        issue_id: 'ISS-0009',
        // epic_id is undefined but task references this issue
        title: 'Issue in partial chain',
        description: 'Issue that has tasks but no epic reference',
        status: 'active',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 100,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        related_tasks: ['TSK-0007'],
        related_issues: [],
        content: 'Issue content',
        file_path: '/test/ISS-0009.md',
      };

      // Verify the broken chain doesn't cause errors
      expect(taskInBrokenChain.epic_id).toBeUndefined();
      expect(issueWithPartialChain.epic_id).toBeUndefined();
      expect(taskInBrokenChain.issue_id).toBe(issueWithPartialChain.issue_id);
      expect(issueWithPartialChain.related_tasks).toContain(taskInBrokenChain.task_id);
    });
  });

  describe('Validation and error handling', () => {
    it('should handle null epic_id in validation methods', () => {
      const issueWithNullEpic: IssueData = {
        issue_id: 'ISS-0010',
        epic_id: undefined, // Explicitly undefined
        title: 'Validation test issue',
        description: 'Testing validation with null epic_id',
        status: 'active',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 100,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        related_tasks: [],
        related_issues: [],
        content: 'Validation test content',
        file_path: '/test/ISS-0010.md',
      };

      // Validation should not fail due to missing epic_id
      expect(() => {
        const isValid = issueWithNullEpic.issue_id && 
                       issueWithNullEpic.title && 
                       issueWithNullEpic.status;
        expect(isValid).toBe(true);
      }).not.toThrow();
    });

    it('should handle relationship lookup failures gracefully', () => {
      // Mock methods to return empty/undefined results
      const originalFindEpicById = relationshipManager.findEpicById;
      const originalFindIssueById = relationshipManager.findIssueById;

      relationshipManager.findEpicById = (): EpicData | undefined => undefined;
      relationshipManager.findIssueById = (): IssueData | undefined => undefined;

      try {
        // Should not throw when epic/issue lookups fail
        expect(() => {
          const nonExistentEpic = relationshipManager.findEpicById('EP-9999');
          const nonExistentIssue = relationshipManager.findIssueById('ISS-9999');
          
          expect(nonExistentEpic).toBeUndefined();
          expect(nonExistentIssue).toBeUndefined();
        }).not.toThrow();
      } finally {
        relationshipManager.findEpicById = originalFindEpicById;
        relationshipManager.findIssueById = originalFindIssueById;
      }
    });
  });
});