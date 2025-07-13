/**
 * Optional Epic ID Test Suite
 * Comprehensive test cases for frontmatter parser with optional epic_id scenarios
 * Tests the fix for mandatory epic_id requirement that's preventing ticket parsing
 */

import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FrontmatterParser } from '../src/utils/frontmatter-parser.js';
import type { IssueData, PRData, TaskData } from '../src/types/ai-trackdown.js';

describe('Optional Epic ID Tests', () => {
  let testRootPath: string;
  let originalCwd: string;
  let parser: FrontmatterParser;

  beforeEach(() => {
    testRootPath = fs.mkdtempSync(path.join(tmpdir(), 'optional-epic-id-test-'));
    originalCwd = process.cwd();
    process.chdir(testRootPath);
    parser = new FrontmatterParser();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testRootPath, { recursive: true, force: true });
  });

  describe('Issues without epic_id', () => {
    it('should successfully parse issue with only issue_id (no epic_id)', () => {
      const issueContent = `---
issue_id: ISS-0075
title: Test issue without epic_id
description: This issue should parse successfully without epic_id field
status: active
priority: high
assignee: test-user
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 100
actual_tokens: 120
ai_context:
  - context/requirements
sync_status: local
related_tasks: []
related_issues: []
completion_percentage: 0
blocked_by: []
blocks: []
---

# Issue: Test issue without epic_id

This issue should parse successfully even without an epic_id field.
`;

      const filePath = path.join(testRootPath, 'ISS-0075-test-issue.md');
      fs.writeFileSync(filePath, issueContent);

      // This should NOT throw an error after the fix
      expect(() => {
        const result = parser.parseIssue(filePath);
        expect(result.issue_id).toBe('ISS-0075');
        expect(result.title).toBe('Test issue without epic_id');
        expect(result.epic_id).toBeUndefined();
        expect(result.content).toContain('This issue should parse successfully');
      }).not.toThrow();
    });

    it('should handle multiple issues without epic_id (ISS-0075 through ISS-0092 format)', () => {
      const issueNumbers = Array.from({ length: 18 }, (_, i) => 75 + i); // ISS-0075 to ISS-0092

      const parsedIssues: IssueData[] = [];

      issueNumbers.forEach((num) => {
        const issueId = `ISS-${num.toString().padStart(4, '0')}`;
        const issueContent = `---
issue_id: ${issueId}
title: Migration issue ${num}
description: Migration task for project component ${num}
status: active
priority: medium
assignee: engineer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 150
actual_tokens: 0
ai_context: []
sync_status: local
related_tasks: []
related_issues: []
completion_percentage: 0
---

# Issue: Migration issue ${num}

This is a migration task that doesn't belong to any specific epic.
`;

        const filePath = path.join(testRootPath, `${issueId}-migration-issue.md`);
        fs.writeFileSync(filePath, issueContent);

        // Should parse successfully without epic_id
        expect(() => {
          const result = parser.parseIssue(filePath);
          expect(result.issue_id).toBe(issueId);
          expect(result.epic_id).toBeUndefined();
          parsedIssues.push(result);
        }).not.toThrow();
      });

      expect(parsedIssues).toHaveLength(18);
      expect(parsedIssues.every(issue => issue.epic_id === undefined)).toBe(true);
    });

    it('should validate issue without epic_id using validateFile method', () => {
      const issueContent = `---
issue_id: ISS-0076
title: Validation test issue
description: Testing validation without epic_id
status: active
priority: high
assignee: validator
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 100
actual_tokens: 0
ai_context: []
sync_status: local
related_tasks: []
related_issues: []
---

# Validation Test Issue
`;

      const filePath = path.join(testRootPath, 'ISS-0076-validation-test.md');
      fs.writeFileSync(filePath, issueContent);

      const validationResult = parser.validateFile(filePath);
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
    });
  });

  describe('Tasks without epic_id', () => {
    it('should successfully parse task with issue_id but no epic_id', () => {
      const taskContent = `---
task_id: TSK-0100
issue_id: ISS-0075
title: Task without epic_id
description: This task should parse successfully
status: active
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 50
actual_tokens: 60
ai_context: []
sync_status: local
time_estimate: "2h"
time_spent: "1h"
completion_percentage: 50
---

# Task: Task without epic_id

This task should work without epic_id.
`;

      const filePath = path.join(testRootPath, 'TSK-0100-task-test.md');
      fs.writeFileSync(filePath, taskContent);

      expect(() => {
        const result = parser.parseTask(filePath);
        expect(result.task_id).toBe('TSK-0100');
        expect(result.issue_id).toBe('ISS-0075');
        expect(result.epic_id).toBeUndefined();
      }).not.toThrow();
    });

    it('should handle task hierarchy with missing epic_id in parent chain', () => {
      const taskContent = `---
task_id: TSK-0101
issue_id: ISS-0076
title: Subtask without epic hierarchy
description: Task that belongs to issue without epic
status: planning
priority: low
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 30
actual_tokens: 0
ai_context: []
sync_status: local
parent_task: TSK-0100
subtasks: []
---

# Subtask without epic hierarchy
`;

      const filePath = path.join(testRootPath, 'TSK-0101-subtask-test.md');
      fs.writeFileSync(filePath, taskContent);

      expect(() => {
        const result = parser.parseTask(filePath);
        expect(result.task_id).toBe('TSK-0101');
        expect(result.issue_id).toBe('ISS-0076');
        expect(result.epic_id).toBeUndefined();
        expect(result.parent_task).toBe('TSK-0100');
      }).not.toThrow();
    });
  });

  describe('PRs without epic_id', () => {
    it('should successfully parse PR with issue_id but no epic_id', () => {
      const prContent = `---
pr_id: PR-0050
issue_id: ISS-0075
title: Pull request without epic_id
description: This PR should parse successfully
status: active
pr_status: open
priority: high
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 80
actual_tokens: 85
ai_context: []
sync_status: local
branch_name: feature/no-epic-fix
source_branch: feature/no-epic-fix
target_branch: main
pr_number: 123
reviewers:
  - reviewer1
  - reviewer2
---

# PR: Pull request without epic_id

This pull request should work without epic_id.
`;

      const filePath = path.join(testRootPath, 'PR-0050-pr-test.md');
      fs.writeFileSync(filePath, prContent);

      expect(() => {
        const result = parser.parsePR(filePath);
        expect(result.pr_id).toBe('PR-0050');
        expect(result.issue_id).toBe('ISS-0075');
        expect(result.epic_id).toBeUndefined();
        expect(result.pr_status).toBe('open');
      }).not.toThrow();
    });

    it('should validate PR status with missing epic_id', () => {
      const prContent = `---
pr_id: PR-0051
issue_id: ISS-0076
title: PR validation test
description: Testing PR validation without epic_id
status: active
pr_status: review
priority: medium
assignee: reviewer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 60
actual_tokens: 65
ai_context: []
sync_status: local
branch_name: fix/validation-test
---

# PR Validation Test
`;

      const filePath = path.join(testRootPath, 'PR-0051-validation.md');
      fs.writeFileSync(filePath, prContent);

      const validationResult = parser.validateFile(filePath);
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
    });
  });

  describe('parseAnyItem method with optional epic_id', () => {
    it('should correctly identify and parse issue without epic_id using parseAnyItem', () => {
      const issueContent = `---
issue_id: ISS-0077
title: ParseAnyItem test issue
description: Testing parseAnyItem with missing epic_id
status: active
priority: medium
assignee: tester
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 90
actual_tokens: 95
ai_context: []
sync_status: local
related_tasks: []
related_issues: []
---

# ParseAnyItem Test Issue
`;

      const filePath = path.join(testRootPath, 'ISS-0077-parseany-test.md');
      fs.writeFileSync(filePath, issueContent);

      expect(() => {
        const result = parser.parseAnyItem(filePath);
        expect(result.issue_id).toBe('ISS-0077');
        expect(result.epic_id).toBeUndefined();
        expect('title' in result && result.title).toBe('ParseAnyItem test issue');
      }).not.toThrow();
    });

    it('should handle mixed item types with and without epic_id', () => {
      // Create epic WITH epic_id (should still work)
      const epicContent = `---
epic_id: EP-0001
title: Test epic
description: Epic with epic_id
status: active
priority: high
assignee: epic-owner
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 500
actual_tokens: 450
ai_context: []
sync_status: local
related_issues: []
---

# Test Epic
`;

      // Create issue WITHOUT epic_id (should work after fix)
      const issueContent = `---
issue_id: ISS-0078
title: Mixed test issue
description: Issue without epic_id in mixed environment
status: active
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 100
actual_tokens: 110
ai_context: []
sync_status: local
related_tasks: []
related_issues: []
---

# Mixed Test Issue
`;

      const epicPath = path.join(testRootPath, 'EP-0001-test-epic.md');
      const issuePath = path.join(testRootPath, 'ISS-0078-mixed-test.md');
      
      fs.writeFileSync(epicPath, epicContent);
      fs.writeFileSync(issuePath, issueContent);

      // Both should parse successfully
      const epicResult = parser.parseAnyItem(epicPath);
      const issueResult = parser.parseAnyItem(issuePath);

      expect('epic_id' in epicResult && epicResult.epic_id).toBe('EP-0001');
      expect('issue_id' in issueResult && issueResult.issue_id).toBe('ISS-0078');
      expect(issueResult.epic_id).toBeUndefined();
    });
  });

  describe('Backward compatibility with existing epic_id usage', () => {
    it('should continue to work with issues that have epic_id', () => {
      const issueWithEpicContent = `---
issue_id: ISS-0079
epic_id: EP-0001
title: Issue with epic_id
description: This issue has epic_id and should continue working
status: active
priority: high
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 120
actual_tokens: 125
ai_context: []
sync_status: local
related_tasks: []
related_issues: []
---

# Issue with epic_id
`;

      const filePath = path.join(testRootPath, 'ISS-0079-with-epic.md');
      fs.writeFileSync(filePath, issueWithEpicContent);

      expect(() => {
        const result = parser.parseIssue(filePath);
        expect(result.issue_id).toBe('ISS-0079');
        expect(result.epic_id).toBe('EP-0001');
      }).not.toThrow();
    });

    it('should maintain task and PR relationships with epic_id when present', () => {
      const taskWithEpicContent = `---
task_id: TSK-0102
issue_id: ISS-0079
epic_id: EP-0001
title: Task with full hierarchy
description: Task with complete epic hierarchy
status: active
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 60
actual_tokens: 65
ai_context: []
sync_status: local
---

# Task with full hierarchy
`;

      const prWithEpicContent = `---
pr_id: PR-0052
issue_id: ISS-0079
epic_id: EP-0001
title: PR with full hierarchy
description: PR with complete epic hierarchy
status: active
pr_status: draft
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 70
actual_tokens: 75
ai_context: []
sync_status: local
branch_name: feature/full-hierarchy
---

# PR with full hierarchy
`;

      const taskPath = path.join(testRootPath, 'TSK-0102-with-epic.md');
      const prPath = path.join(testRootPath, 'PR-0052-with-epic.md');
      
      fs.writeFileSync(taskPath, taskWithEpicContent);
      fs.writeFileSync(prPath, prWithEpicContent);

      const taskResult = parser.parseTask(taskPath);
      const prResult = parser.parsePR(prPath);

      expect(taskResult.task_id).toBe('TSK-0102');
      expect(taskResult.issue_id).toBe('ISS-0079');
      expect(taskResult.epic_id).toBe('EP-0001');

      expect(prResult.pr_id).toBe('PR-0052');
      expect(prResult.issue_id).toBe('ISS-0079');
      expect(prResult.epic_id).toBe('EP-0001');
    });
  });

  describe('Epic assignment workflow compatibility', () => {
    it('should support assigning epic_id to existing issue without epic_id', () => {
      // Create issue without epic_id
      const originalContent = `---
issue_id: ISS-0080
title: Issue for epic assignment
description: Issue that will get epic assigned later
status: active
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 100
actual_tokens: 0
ai_context: []
sync_status: local
related_tasks: []
related_issues: []
---

# Issue for epic assignment
`;

      const filePath = path.join(testRootPath, 'ISS-0080-assignment-test.md');
      fs.writeFileSync(filePath, originalContent);

      // Should parse successfully without epic_id
      const originalResult = parser.parseIssue(filePath);
      expect(originalResult.epic_id).toBeUndefined();

      // Update to add epic_id
      const updatedResult = parser.updateFile(filePath, { 
        epic_id: 'EP-0002',
        updated_date: new Date().toISOString()
      });

      expect(updatedResult.epic_id).toBe('EP-0002');
      expect(updatedResult.issue_id).toBe('ISS-0080');
    });

    it('should support removing epic_id from existing issue', () => {
      // Create issue with epic_id
      const originalContent = `---
issue_id: ISS-0081
epic_id: EP-0002
title: Issue for epic removal
description: Issue that will have epic removed
status: active
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 100
actual_tokens: 0
ai_context: []
sync_status: local
related_tasks: []
related_issues: []
---

# Issue for epic removal
`;

      const filePath = path.join(testRootPath, 'ISS-0081-removal-test.md');
      fs.writeFileSync(filePath, originalContent);

      // Should parse successfully with epic_id
      const originalResult = parser.parseIssue(filePath);
      expect(originalResult.epic_id).toBe('EP-0002');

      // Update to remove epic_id (set to undefined/null)
      const updatedResult = parser.updateFile(filePath, { 
        epic_id: undefined,
        updated_date: new Date().toISOString()
      });

      expect('epic_id' in updatedResult ? updatedResult.epic_id : undefined).toBeUndefined();
      expect(updatedResult.issue_id).toBe('ISS-0081');
    });
  });

  describe('Validation requirements for other fields', () => {
    it('should still require issue_id for issues', () => {
      const invalidIssueContent = `---
title: Invalid issue without issue_id
description: This should fail validation
status: active
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 100
actual_tokens: 0
ai_context: []
sync_status: local
---

# Invalid Issue
`;

      const filePath = path.join(testRootPath, 'invalid-issue.md');
      fs.writeFileSync(filePath, invalidIssueContent);

      expect(() => {
        parser.parseIssue(filePath);
      }).toThrow(/missing.*issue_id/i);
    });

    it('should still require task_id and issue_id for tasks', () => {
      const invalidTaskContent = `---
title: Invalid task
description: Missing required IDs
status: active
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 50
actual_tokens: 0
ai_context: []
sync_status: local
---

# Invalid Task
`;

      const filePath = path.join(testRootPath, 'invalid-task.md');
      fs.writeFileSync(filePath, invalidTaskContent);

      expect(() => {
        parser.parseTask(filePath);
      }).toThrow(/missing required.*task_id/i);
    });

    it('should still require pr_id and issue_id for PRs', () => {
      const invalidPRContent = `---
title: Invalid PR
description: Missing required IDs
status: active
pr_status: open
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 70
actual_tokens: 0
ai_context: []
sync_status: local
---

# Invalid PR
`;

      const filePath = path.join(testRootPath, 'invalid-pr.md');
      fs.writeFileSync(filePath, invalidPRContent);

      expect(() => {
        parser.parsePR(filePath);
      }).toThrow(/missing required.*pr_id/i);
    });
  });

  describe('Bulk directory parsing with optional epic_id', () => {
    it('should parse directory with mixed epic_id presence', () => {
      const issuesDir = path.join(testRootPath, 'issues');
      fs.mkdirSync(issuesDir);

      // Create issues with and without epic_id
      const issuesData = [
        { id: 'ISS-0082', epic_id: 'EP-0001', title: 'Issue with epic' },
        { id: 'ISS-0083', epic_id: undefined, title: 'Issue without epic' },
        { id: 'ISS-0084', epic_id: 'EP-0002', title: 'Another issue with epic' },
        { id: 'ISS-0085', epic_id: undefined, title: 'Another issue without epic' },
      ];

      issuesData.forEach(({ id, epic_id, title }) => {
        const epicField = epic_id ? `epic_id: ${epic_id}` : '';
        const issueContent = `---
issue_id: ${id}
${epicField}
title: ${title}
description: Test issue for bulk parsing
status: active
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 100
actual_tokens: 0
ai_context: []
sync_status: local
related_tasks: []
related_issues: []
---

# ${title}
`;

        const filePath = path.join(issuesDir, `${id}-test.md`);
        fs.writeFileSync(filePath, issueContent);
      });

      // Parse entire directory
      const results = parser.parseDirectory(issuesDir, 'issue');
      
      expect(results).toHaveLength(4);
      
      // Check mixed epic_id presence
      const withEpic = results.filter(issue => 'epic_id' in issue && issue.epic_id);
      const withoutEpic = results.filter(issue => !('epic_id' in issue) || !issue.epic_id);
      
      expect(withEpic).toHaveLength(2);
      expect(withoutEpic).toHaveLength(2);
    });
  });

  describe('Performance and regression tests', () => {
    it('should maintain parsing performance with optional epic_id', () => {
      const startTime = Date.now();
      
      // Create many issues without epic_id
      for (let i = 0; i < 100; i++) {
        const issueId = `ISS-${(1000 + i).toString()}`;
        const issueContent = `---
issue_id: ${issueId}
title: Performance test issue ${i}
description: Testing parsing performance
status: active
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 100
actual_tokens: 0
ai_context: []
sync_status: local
related_tasks: []
related_issues: []
---

# Performance test issue ${i}
`;

        const filePath = path.join(testRootPath, `${issueId}-perf-test.md`);
        fs.writeFileSync(filePath, issueContent);
        
        // Parse each issue
        const result = parser.parseIssue(filePath);
        expect(result.issue_id).toBe(issueId);
        expect(result.epic_id).toBeUndefined();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    it('should not break existing functionality with epic_id present', () => {
      // Create comprehensive test with all item types having epic_id
      const epicContent = `---
epic_id: EP-9999
title: Regression test epic
description: Epic for regression testing
status: active
priority: high
assignee: tester
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 500
actual_tokens: 450
ai_context: []
sync_status: local
related_issues: ["ISS-9999"]
---

# Regression test epic
`;

      const issueContent = `---
issue_id: ISS-9999
epic_id: EP-9999
title: Regression test issue
description: Issue for regression testing
status: active
priority: high
assignee: tester
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 200
actual_tokens: 180
ai_context: []
sync_status: local
related_tasks: ["TSK-9999"]
related_issues: []
---

# Regression test issue
`;

      const taskContent = `---
task_id: TSK-9999
issue_id: ISS-9999
epic_id: EP-9999
title: Regression test task
description: Task for regression testing
status: active
priority: high
assignee: tester
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 100
actual_tokens: 90
ai_context: []
sync_status: local
---

# Regression test task
`;

      const prContent = `---
pr_id: PR-9999
issue_id: ISS-9999
epic_id: EP-9999
title: Regression test PR
description: PR for regression testing
status: active
pr_status: open
priority: high
assignee: tester
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 80
actual_tokens: 85
ai_context: []
sync_status: local
branch_name: test/regression
---

# Regression test PR
`;

      const epicPath = path.join(testRootPath, 'EP-9999-regression.md');
      const issuePath = path.join(testRootPath, 'ISS-9999-regression.md');
      const taskPath = path.join(testRootPath, 'TSK-9999-regression.md');
      const prPath = path.join(testRootPath, 'PR-9999-regression.md');

      fs.writeFileSync(epicPath, epicContent);
      fs.writeFileSync(issuePath, issueContent);
      fs.writeFileSync(taskPath, taskContent);
      fs.writeFileSync(prPath, prContent);

      // All should parse successfully
      const epicResult = parser.parseEpic(epicPath);
      const issueResult = parser.parseIssue(issuePath);
      const taskResult = parser.parseTask(taskPath);
      const prResult = parser.parsePR(prPath);

      expect(epicResult.epic_id).toBe('EP-9999');
      expect(issueResult.issue_id).toBe('ISS-9999');
      expect(issueResult.epic_id).toBe('EP-9999');
      expect(taskResult.task_id).toBe('TSK-9999');
      expect(taskResult.epic_id).toBe('EP-9999');
      expect(prResult.pr_id).toBe('PR-9999');
      expect(prResult.epic_id).toBe('EP-9999');

      // Validate all items
      expect(parser.validateFile(epicPath).valid).toBe(true);
      expect(parser.validateFile(issuePath).valid).toBe(true);
      expect(parser.validateFile(taskPath).valid).toBe(true);
      expect(parser.validateFile(prPath).valid).toBe(true);
    });
  });
});