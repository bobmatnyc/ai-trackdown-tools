/**
 * Frontmatter Parser Bug Reproduction Test
 * This test confirms the current bug where epic_id is mandatory
 * These tests should FAIL before the fix and PASS after the fix
 */

import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FrontmatterParser } from '../src/utils/frontmatter-parser.js';

describe('Frontmatter Parser Bug Reproduction', () => {
  let testRootPath: string;
  let originalCwd: string;
  let parser: FrontmatterParser;

  beforeEach(() => {
    testRootPath = fs.mkdtempSync(path.join(tmpdir(), 'bug-reproduction-test-'));
    originalCwd = process.cwd();
    process.chdir(testRootPath);
    parser = new FrontmatterParser();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testRootPath, { recursive: true, force: true });
  });

  describe('Current Parser Behavior (Should Fail Before Fix)', () => {
    it('should currently FAIL to parse issue without epic_id', () => {
      const issueContent = `---
issue_id: ISS-0075
title: Issue without epic_id (should currently fail)
description: This issue currently fails to parse due to missing epic_id
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

# Issue without epic_id
`;

      const filePath = path.join(testRootPath, 'ISS-0075-failing.md');
      fs.writeFileSync(filePath, issueContent);

      // This SHOULD throw an error with current parser
      expect(() => {
        parser.parseIssue(filePath);
      }).toThrow(/missing.*epic_id/i);
    });

    it('should currently FAIL to parse task without epic_id', () => {
      const taskContent = `---
task_id: TSK-0200
issue_id: ISS-0075
title: Task without epic_id (should currently fail)
description: This task currently fails to parse due to missing epic_id
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

# Task without epic_id
`;

      const filePath = path.join(testRootPath, 'TSK-0200-failing.md');
      fs.writeFileSync(filePath, taskContent);

      // This SHOULD throw an error with current parser
      expect(() => {
        parser.parseTask(filePath);
      }).toThrow(/missing.*epic_id/i);
    });

    it('should currently FAIL to parse PR without epic_id', () => {
      const prContent = `---
pr_id: PR-0100
issue_id: ISS-0075
title: PR without epic_id (should currently fail)
description: This PR currently fails to parse due to missing epic_id
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
branch_name: test/failing-pr
---

# PR without epic_id
`;

      const filePath = path.join(testRootPath, 'PR-0100-failing.md');
      fs.writeFileSync(filePath, prContent);

      // This SHOULD throw an error with current parser
      expect(() => {
        parser.parsePR(filePath);
      }).toThrow(/missing.*epic_id/i);
    });

    it('should currently FAIL parseAnyItem with issue missing epic_id', () => {
      const issueContent = `---
issue_id: ISS-0076
title: ParseAnyItem test (should currently fail)
description: This should fail parseAnyItem due to missing epic_id
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

# ParseAnyItem test
`;

      const filePath = path.join(testRootPath, 'ISS-0076-parseany-failing.md');
      fs.writeFileSync(filePath, issueContent);

      // This SHOULD throw an error with current parser
      expect(() => {
        parser.parseAnyItem(filePath);
      }).toThrow(/missing.*epic_id/i);
    });

    it('should demonstrate the specific error messages from current parser', () => {
      const issueContent = `---
issue_id: ISS-0077
title: Error message test
description: Testing specific error messages
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

# Error message test
`;

      const filePath = path.join(testRootPath, 'ISS-0077-error-test.md');
      fs.writeFileSync(filePath, issueContent);

      // Capture the specific error message
      let errorMessage = '';
      try {
        parser.parseIssue(filePath);
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }

      // Verify the error mentions both issue_id and epic_id
      expect(errorMessage).toMatch(/issue_id.*epic_id|epic_id.*issue_id/i);
      expect(errorMessage).toContain('ISS-0077-error-test.md');
    });
  });

  describe('Current Parser Validation Behavior', () => {
    it('should currently mark files as invalid due to missing epic_id', () => {
      const issueContent = `---
issue_id: ISS-0078
title: Validation test issue
description: Testing validation with missing epic_id
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

# Validation test
`;

      const filePath = path.join(testRootPath, 'ISS-0078-validation.md');
      fs.writeFileSync(filePath, issueContent);

      const validationResult = parser.validateFile(filePath);
      
      // Current parser should mark this as invalid
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);
      
      // Should contain error about missing epic_id
      const hasEpicIdError = validationResult.errors.some(error => 
        error.message.toLowerCase().includes('epic_id')
      );
      expect(hasEpicIdError).toBe(true);
    });
  });

  describe('Parser Line Number Verification', () => {
    it('should demonstrate the exact lines causing the issue', () => {
      // This test documents the specific locations in the parser code
      // that need to be fixed

      const issueContent = `---
issue_id: ISS-0079
title: Line number test
description: Documenting exact failure points
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

# Line number test
`;

      const taskContent = `---
task_id: TSK-0201
issue_id: ISS-0079
title: Task line number test
description: Documenting task parsing failure point
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

# Task line number test
`;

      const prContent = `---
pr_id: PR-0101
issue_id: ISS-0079
title: PR line number test
description: Documenting PR parsing failure point
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
branch_name: test/line-numbers
---

# PR line number test
`;

      const issuePath = path.join(testRootPath, 'ISS-0079-lines.md');
      const taskPath = path.join(testRootPath, 'TSK-0201-lines.md');
      const prPath = path.join(testRootPath, 'PR-0101-lines.md');
      
      fs.writeFileSync(issuePath, issueContent);
      fs.writeFileSync(taskPath, taskContent);
      fs.writeFileSync(prPath, prContent);

      // Document the expected failure points:
      // parseIssue() method: lines 57-58 require both issue_id AND epic_id
      // parseTask() method: lines 78-80 require task_id, issue_id AND epic_id  
      // parsePR() method: lines 99-101 require pr_id, issue_id AND epic_id

      expect(() => parser.parseIssue(issuePath)).toThrow(/missing.*epic_id/i);
      expect(() => parser.parseTask(taskPath)).toThrow(/missing.*epic_id/i);
      expect(() => parser.parsePR(prPath)).toThrow(/missing.*epic_id/i);
    });
  });

  describe('Bulk Operation Failures', () => {
    it('should fail bulk directory parsing due to missing epic_id', () => {
      const issuesDir = path.join(testRootPath, 'issues');
      fs.mkdirSync(issuesDir);

      // Create multiple issues without epic_id
      for (let i = 75; i <= 80; i++) {
        const issueContent = `---
issue_id: ISS-${i.toString().padStart(4, '0')}
title: Bulk test issue ${i}
description: Issue ${i} for bulk parsing test
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

# Bulk test issue ${i}
`;

        fs.writeFileSync(
          path.join(issuesDir, `ISS-${i.toString().padStart(4, '0')}-bulk.md`),
          issueContent
        );
      }

      // parseDirectory should fail to parse these issues
      const results = parser.parseDirectory(issuesDir, 'issue');
      
      // With current parser, should get empty results due to parsing failures
      expect(results).toHaveLength(0);
    });
  });

  describe('Current parseAnyItem Logic Verification', () => {
    it('should demonstrate parseAnyItem logic requirements', () => {
      // Current parseAnyItem logic (lines 126-131) requires both issue_id AND epic_id
      // for issue identification: frontmatter.issue_id && frontmatter.epic_id

      const issueWithoutEpicContent = `---
issue_id: ISS-0080
title: ParseAnyItem logic test
description: Testing current parseAnyItem identification logic
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

# ParseAnyItem logic test
`;

      const filePath = path.join(testRootPath, 'ISS-0080-logic.md');
      fs.writeFileSync(filePath, issueWithoutEpicContent);

      // Current parseAnyItem should fail to identify this as an issue
      // due to missing epic_id, and then fail to match any other type
      expect(() => {
        parser.parseAnyItem(filePath);
      }).toThrow(/does not match any ai-trackdown item type/i);
    });
  });
});