/**
 * Type System Optional Epic ID Test Suite
 * Tests TypeScript type definitions and guards with optional epic_id
 */

import { describe, expect, it } from 'vitest';
import type {
  IssueData,
  IssueFrontmatter,
  TaskData,
  TaskFrontmatter,
  PRData,
  PRFrontmatter,
  AnyItemData,
  AnyFrontmatter,
} from '../src/types/ai-trackdown.js';
import {
  isIssueFrontmatter,
  isTaskFrontmatter,
  isPRFrontmatter,
  isIssueData,
  isTaskData,
  isPRData,
  getItemId,
} from '../src/types/ai-trackdown.js';

describe('Type System - Optional Epic ID', () => {
  describe('Issue type definitions with optional epic_id', () => {
    it('should accept issue frontmatter without epic_id', () => {
      const issueFrontmatterWithoutEpic: IssueFrontmatter = {
        issue_id: 'ISS-0001',
        // epic_id is optional, so omitting it should be valid
        title: 'Issue without epic',
        description: 'This issue has no epic_id',
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
      };

      // TypeScript should allow this without compilation errors
      expect(issueFrontmatterWithoutEpic.issue_id).toBe('ISS-0001');
      expect(issueFrontmatterWithoutEpic.epic_id).toBeUndefined();
    });

    it('should accept issue frontmatter with explicit undefined epic_id', () => {
      const issueFrontmatterWithExplicitUndefined: IssueFrontmatter = {
        issue_id: 'ISS-0002',
        epic_id: undefined, // Explicitly set to undefined
        title: 'Issue with explicit undefined epic',
        description: 'This issue has explicit undefined epic_id',
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
      };

      expect(issueFrontmatterWithExplicitUndefined.epic_id).toBeUndefined();
    });

    it('should accept issue data without epic_id', () => {
      const issueDataWithoutEpic: IssueData = {
        issue_id: 'ISS-0003',
        // epic_id omitted
        title: 'Issue data without epic',
        description: 'This issue data has no epic_id',
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
        file_path: '/test/ISS-0003.md',
      };

      expect(issueDataWithoutEpic.issue_id).toBe('ISS-0003');
      expect(issueDataWithoutEpic.epic_id).toBeUndefined();
    });
  });

  describe('Task type definitions with optional epic_id', () => {
    it('should accept task frontmatter without epic_id', () => {
      const taskFrontmatterWithoutEpic: TaskFrontmatter = {
        task_id: 'TSK-0001',
        issue_id: 'ISS-0003',
        // epic_id omitted
        title: 'Task without epic',
        description: 'This task has no epic_id',
        status: 'active',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 50,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
      };

      expect(taskFrontmatterWithoutEpic.task_id).toBe('TSK-0001');
      expect(taskFrontmatterWithoutEpic.issue_id).toBe('ISS-0003');
      expect(taskFrontmatterWithoutEpic.epic_id).toBeUndefined();
    });

    it('should accept task data without epic_id', () => {
      const taskDataWithoutEpic: TaskData = {
        task_id: 'TSK-0002',
        issue_id: 'ISS-0003',
        // epic_id omitted
        title: 'Task data without epic',
        description: 'This task data has no epic_id',
        status: 'active',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 40,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        content: 'Task content',
        file_path: '/test/TSK-0002.md',
      };

      expect(taskDataWithoutEpic.task_id).toBe('TSK-0002');
      expect(taskDataWithoutEpic.epic_id).toBeUndefined();
    });
  });

  describe('PR type definitions with optional epic_id', () => {
    it('should accept PR frontmatter without epic_id', () => {
      const prFrontmatterWithoutEpic: PRFrontmatter = {
        pr_id: 'PR-0001',
        issue_id: 'ISS-0003',
        // epic_id omitted
        title: 'PR without epic',
        description: 'This PR has no epic_id',
        status: 'active',
        pr_status: 'open',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 70,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        branch_name: 'feature/no-epic',
      };

      expect(prFrontmatterWithoutEpic.pr_id).toBe('PR-0001');
      expect(prFrontmatterWithoutEpic.issue_id).toBe('ISS-0003');
      expect(prFrontmatterWithoutEpic.epic_id).toBeUndefined();
    });

    it('should accept PR data without epic_id', () => {
      const prDataWithoutEpic: PRData = {
        pr_id: 'PR-0002',
        issue_id: 'ISS-0003',
        // epic_id omitted
        title: 'PR data without epic',
        description: 'This PR data has no epic_id',
        status: 'active',
        pr_status: 'draft',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 60,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        branch_name: 'feature/draft-pr',
        content: 'PR content',
        file_path: '/test/PR-0002.md',
      };

      expect(prDataWithoutEpic.pr_id).toBe('PR-0002');
      expect(prDataWithoutEpic.epic_id).toBeUndefined();
    });
  });

  describe('Type guards with optional epic_id', () => {
    it('should correctly identify issue frontmatter without epic_id', () => {
      const frontmatterWithoutEpic: AnyFrontmatter = {
        issue_id: 'ISS-0004',
        // epic_id omitted
        title: 'Type guard test issue',
        description: 'Testing type guards',
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
      };

      expect(isIssueFrontmatter(frontmatterWithoutEpic)).toBe(true);
      expect(isTaskFrontmatter(frontmatterWithoutEpic)).toBe(false);
      expect(isPRFrontmatter(frontmatterWithoutEpic)).toBe(false);
    });

    it('should correctly identify task frontmatter without epic_id', () => {
      const taskFrontmatterWithoutEpic: AnyFrontmatter = {
        task_id: 'TSK-0003',
        issue_id: 'ISS-0004',
        // epic_id omitted
        title: 'Type guard test task',
        description: 'Testing task type guards',
        status: 'active',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 40,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
      };

      expect(isTaskFrontmatter(taskFrontmatterWithoutEpic)).toBe(true);
      expect(isIssueFrontmatter(taskFrontmatterWithoutEpic)).toBe(false);
      expect(isPRFrontmatter(taskFrontmatterWithoutEpic)).toBe(false);
    });

    it('should correctly identify PR frontmatter without epic_id', () => {
      const prFrontmatterWithoutEpic: AnyFrontmatter = {
        pr_id: 'PR-0003',
        issue_id: 'ISS-0004',
        // epic_id omitted
        title: 'Type guard test PR',
        description: 'Testing PR type guards',
        status: 'active',
        pr_status: 'review',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 60,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        branch_name: 'feature/type-guards',
      };

      expect(isPRFrontmatter(prFrontmatterWithoutEpic)).toBe(true);
      expect(isIssueFrontmatter(prFrontmatterWithoutEpic)).toBe(false);
      expect(isTaskFrontmatter(prFrontmatterWithoutEpic)).toBe(false);
    });

    it('should correctly identify data types without epic_id', () => {
      const issueDataWithoutEpic: AnyItemData = {
        issue_id: 'ISS-0005',
        // epic_id omitted
        title: 'Data type guard test',
        description: 'Testing data type guards',
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
        file_path: '/test/ISS-0005.md',
      };

      const taskDataWithoutEpic: AnyItemData = {
        task_id: 'TSK-0004',
        issue_id: 'ISS-0005',
        // epic_id omitted
        title: 'Data type guard task',
        description: 'Testing task data type guards',
        status: 'active',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 40,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        content: 'Task content',
        file_path: '/test/TSK-0004.md',
      };

      const prDataWithoutEpic: AnyItemData = {
        pr_id: 'PR-0004',
        issue_id: 'ISS-0005',
        // epic_id omitted
        title: 'Data type guard PR',
        description: 'Testing PR data type guards',
        status: 'active',
        pr_status: 'merged',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 60,
        actual_tokens: 65,
        ai_context: [],
        sync_status: 'local',
        branch_name: 'feature/merged-pr',
        content: 'PR content',
        file_path: '/test/PR-0004.md',
      };

      expect(isIssueData(issueDataWithoutEpic)).toBe(true);
      expect(isTaskData(taskDataWithoutEpic)).toBe(true);
      expect(isPRData(prDataWithoutEpic)).toBe(true);
    });
  });

  describe('Utility functions with optional epic_id', () => {
    it('should correctly extract item IDs regardless of epic_id presence', () => {
      const issueWithoutEpic: IssueData = {
        issue_id: 'ISS-0006',
        // epic_id omitted
        title: 'Utility test issue',
        description: 'Testing utility functions',
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
        file_path: '/test/ISS-0006.md',
      };

      const taskWithoutEpic: TaskData = {
        task_id: 'TSK-0005',
        issue_id: 'ISS-0006',
        // epic_id omitted
        title: 'Utility test task',
        description: 'Testing task utility functions',
        status: 'active',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 40,
        actual_tokens: 0,
        ai_context: [],
        sync_status: 'local',
        content: 'Task content',
        file_path: '/test/TSK-0005.md',
      };

      const prWithoutEpic: PRData = {
        pr_id: 'PR-0005',
        issue_id: 'ISS-0006',
        // epic_id omitted
        title: 'Utility test PR',
        description: 'Testing PR utility functions',
        status: 'active',
        pr_status: 'closed',
        priority: 'medium',
        assignee: 'developer',
        created_date: '2025-07-13T20:00:00.000Z',
        updated_date: '2025-07-13T20:00:00.000Z',
        estimated_tokens: 60,
        actual_tokens: 65,
        ai_context: [],
        sync_status: 'local',
        branch_name: 'feature/closed-pr',
        content: 'PR content',
        file_path: '/test/PR-0005.md',
      };

      expect(getItemId(issueWithoutEpic)).toBe('ISS-0006');
      expect(getItemId(taskWithoutEpic)).toBe('TSK-0005');
      expect(getItemId(prWithoutEpic)).toBe('PR-0005');
    });
  });

  describe('Mixed epic_id scenarios in type arrays', () => {
    it('should handle arrays with mixed epic_id presence', () => {
      const mixedIssues: IssueData[] = [
        {
          issue_id: 'ISS-0007',
          epic_id: 'EP-0001', // Has epic_id
          title: 'Issue with epic',
          description: 'Issue that has epic_id',
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
        },
        {
          issue_id: 'ISS-0008',
          // epic_id omitted
          title: 'Issue without epic',
          description: 'Issue that has no epic_id',
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
          content: 'Issue without epic content',
          file_path: '/test/ISS-0008.md',
        },
      ];

      expect(mixedIssues).toHaveLength(2);
      
      const withEpic = mixedIssues.filter(issue => issue.epic_id);
      const withoutEpic = mixedIssues.filter(issue => !issue.epic_id);
      
      expect(withEpic).toHaveLength(1);
      expect(withoutEpic).toHaveLength(1);
      expect(withEpic[0].epic_id).toBe('EP-0001');
      expect(withoutEpic[0].epic_id).toBeUndefined();
    });
  });

  describe('Type compatibility and assignment', () => {
    it('should allow assignment of items without epic_id to Any types', () => {
      const issueWithoutEpic: IssueData = {
        issue_id: 'ISS-0009',
        // epic_id omitted
        title: 'Assignment test',
        description: 'Testing type assignment',
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
        content: 'Assignment test content',
        file_path: '/test/ISS-0009.md',
      };

      // Should be assignable to AnyItemData
      const anyItem: AnyItemData = issueWithoutEpic;
      expect(getItemId(anyItem)).toBe('ISS-0009');

      // Should be assignable to AnyFrontmatter
      const anyFrontmatter: AnyFrontmatter = issueWithoutEpic;
      expect(anyFrontmatter.title).toBe('Assignment test');
    });

    it('should maintain type safety with optional epic_id', () => {
      const issueWithoutEpic: IssueData = {
        issue_id: 'ISS-0010',
        // epic_id omitted
        title: 'Type safety test',
        description: 'Testing type safety',
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
        content: 'Type safety content',
        file_path: '/test/ISS-0010.md',
      };

      // TypeScript should require type checking for epic_id access
      if (issueWithoutEpic.epic_id) {
        // This code should only execute if epic_id is defined
        expect(issueWithoutEpic.epic_id).toBeDefined();
      } else {
        // This code should execute when epic_id is undefined
        expect(issueWithoutEpic.epic_id).toBeUndefined();
      }

      // Direct access should allow undefined
      const epicId: string | undefined = issueWithoutEpic.epic_id;
      expect(epicId).toBeUndefined();
    });
  });
});