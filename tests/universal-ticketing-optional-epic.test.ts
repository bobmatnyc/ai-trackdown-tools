/**
 * Universal Ticketing Interface Test Suite for Optional Epic ID
 * Tests the universal ticketing interface with items that have no epic_id
 */

import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UniversalTicketingInterface } from '../src/utils/universal-ticketing-interface.js';
import { ConfigManager } from '../src/utils/config-manager.js';
import type { ProjectConfig } from '../src/types/ai-trackdown.js';

describe('Universal Ticketing Interface - Optional Epic ID', () => {
  let testRootPath: string;
  let originalCwd: string;
  let configManager: ConfigManager;
  let ticketingInterface: UniversalTicketingInterface;

  beforeEach(() => {
    testRootPath = fs.mkdtempSync(path.join(tmpdir(), 'universal-ticketing-optional-epic-'));
    originalCwd = process.cwd();
    process.chdir(testRootPath);

    // Initialize config structure
    const configDir = path.join(testRootPath, '.ai-trackdown');
    fs.mkdirSync(configDir, { recursive: true });

    const config: ProjectConfig = {
      name: 'Optional Epic ID Test Project',
      description: 'Testing universal interface with optional epic_id',
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
      default_assignee: 'test-user',
    };

    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    // Create directory structure
    fs.mkdirSync(path.join(testRootPath, 'tasks', 'epics'), { recursive: true });
    fs.mkdirSync(path.join(testRootPath, 'tasks', 'issues'), { recursive: true });
    fs.mkdirSync(path.join(testRootPath, 'tasks', 'tasks'), { recursive: true });
    fs.mkdirSync(path.join(testRootPath, 'tasks', 'prs'), { recursive: true });

    configManager = new ConfigManager(testRootPath);
    ticketingInterface = new UniversalTicketingInterface(configManager);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testRootPath, { recursive: true, force: true });
  });

  describe('Issue handling without epic_id', () => {
    it('should list issues without epic_id in getAllTickets()', async () => {
      // Create issues with and without epic_id
      const issueWithEpic = `---
issue_id: ISS-0001
epic_id: EP-0001
title: Issue with epic
description: This issue has an epic_id
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

# Issue with epic
`;

      const issueWithoutEpic = `---
issue_id: ISS-0002
title: Issue without epic
description: This issue has no epic_id
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

# Issue without epic
`;

      fs.writeFileSync(
        path.join(testRootPath, 'tasks', 'issues', 'ISS-0001-with-epic.md'),
        issueWithEpic
      );
      fs.writeFileSync(
        path.join(testRootPath, 'tasks', 'issues', 'ISS-0002-without-epic.md'),
        issueWithoutEpic
      );

      const allTickets = await ticketingInterface.getAllTickets();
      
      expect(allTickets.issues).toHaveLength(2);
      
      const withEpic = allTickets.issues.find(issue => issue.issue_id === 'ISS-0001');
      const withoutEpic = allTickets.issues.find(issue => issue.issue_id === 'ISS-0002');
      
      expect(withEpic?.epic_id).toBe('EP-0001');
      expect(withoutEpic?.epic_id).toBeUndefined();
    });

    it('should provide correct health status for mixed epic_id scenarios', async () => {
      // Create multiple issues, some with and some without epic_id
      for (let i = 1; i <= 10; i++) {
        const hasEpic = i % 3 === 0; // Every 3rd issue has epic_id
        const epicField = hasEpic ? `epic_id: EP-000${Math.ceil(i / 3)}` : '';
        
        const issueContent = `---
issue_id: ISS-${i.toString().padStart(4, '0')}
${epicField}
title: Mixed test issue ${i}
description: Testing mixed epic_id scenarios
status: ${i <= 5 ? 'active' : 'completed'}
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 100
actual_tokens: ${i <= 5 ? 0 : 100}
ai_context: []
sync_status: local
related_tasks: []
related_issues: []
---

# Mixed test issue ${i}
`;

        fs.writeFileSync(
          path.join(testRootPath, 'tasks', 'issues', `ISS-${i.toString().padStart(4, '0')}-mixed-test.md`),
          issueContent
        );
      }

      const healthStatus = await ticketingInterface.getHealthStatus();
      
      expect(healthStatus.totalTickets).toBe(10);
      expect(healthStatus.activeTickets).toBe(5);
      expect(healthStatus.completedTickets).toBe(5);
      expect(healthStatus.issuesCount).toBe(10);
      expect(healthStatus.healthScore).toBe(100); // All tickets should be parseable
    });
  });

  describe('Task handling without epic_id', () => {
    it('should handle tasks that belong to issues without epic_id', async () => {
      // Create issue without epic_id
      const issueContent = `---
issue_id: ISS-0003
title: Issue without epic for tasks
description: Parent issue for tasks without epic
status: active
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 150
actual_tokens: 0
ai_context: []
sync_status: local
related_tasks: ["TSK-0001", "TSK-0002"]
related_issues: []
---

# Issue without epic for tasks
`;

      // Create tasks without epic_id
      const task1Content = `---
task_id: TSK-0001
issue_id: ISS-0003
title: Task without epic
description: Task belonging to issue without epic
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

# Task without epic
`;

      const task2Content = `---
task_id: TSK-0002
issue_id: ISS-0003
title: Another task without epic
description: Another task belonging to issue without epic
status: completed
priority: low
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 30
actual_tokens: 35
ai_context: []
sync_status: local
---

# Another task without epic
`;

      fs.writeFileSync(
        path.join(testRootPath, 'tasks', 'issues', 'ISS-0003-without-epic.md'),
        issueContent
      );
      fs.writeFileSync(
        path.join(testRootPath, 'tasks', 'tasks', 'TSK-0001-without-epic.md'),
        task1Content
      );
      fs.writeFileSync(
        path.join(testRootPath, 'tasks', 'tasks', 'TSK-0002-without-epic.md'),
        task2Content
      );

      const allTickets = await ticketingInterface.getAllTickets();
      
      expect(allTickets.issues).toHaveLength(1);
      expect(allTickets.tasks).toHaveLength(2);
      
      const issue = allTickets.issues[0];
      const tasks = allTickets.tasks;
      
      expect(issue.epic_id).toBeUndefined();
      expect(tasks.every(task => task.epic_id === undefined)).toBe(true);
      expect(tasks.every(task => task.issue_id === 'ISS-0003')).toBe(true);
    });
  });

  describe('PR handling without epic_id', () => {
    it('should handle PRs that belong to issues without epic_id', async () => {
      // Create issue without epic_id
      const issueContent = `---
issue_id: ISS-0004
title: Issue without epic for PRs
description: Parent issue for PRs without epic
status: active
priority: high
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 200
actual_tokens: 0
ai_context: []
sync_status: local
related_tasks: []
related_issues: []
related_prs: ["PR-0001"]
---

# Issue without epic for PRs
`;

      // Create PR without epic_id
      const prContent = `---
pr_id: PR-0001
issue_id: ISS-0004
title: PR without epic
description: Pull request for issue without epic
status: active
pr_status: open
priority: high
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 80
actual_tokens: 0
ai_context: []
sync_status: local
branch_name: feature/no-epic-support
pr_number: 789
---

# PR without epic
`;

      fs.writeFileSync(
        path.join(testRootPath, 'tasks', 'issues', 'ISS-0004-without-epic.md'),
        issueContent
      );
      fs.writeFileSync(
        path.join(testRootPath, 'tasks', 'prs', 'PR-0001-without-epic.md'),
        prContent
      );

      const allTickets = await ticketingInterface.getAllTickets();
      
      expect(allTickets.issues).toHaveLength(1);
      expect(allTickets.prs).toHaveLength(1);
      
      const issue = allTickets.issues[0];
      const pr = allTickets.prs[0];
      
      expect(issue.epic_id).toBeUndefined();
      expect(pr.epic_id).toBeUndefined();
      expect(pr.issue_id).toBe('ISS-0004');
    });
  });

  describe('Relationship management with optional epic_id', () => {
    it('should handle relationships when epic_id is missing from chain', async () => {
      // Create epic (with epic_id)
      const epicContent = `---
epic_id: EP-0001
title: Test epic
description: Epic that contains mixed issues
status: active
priority: high
assignee: epic-owner
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 500
actual_tokens: 0
ai_context: []
sync_status: local
related_issues: ["ISS-0005", "ISS-0006"]
---

# Test epic
`;

      // Create issue with epic_id
      const issueWithEpicContent = `---
issue_id: ISS-0005
epic_id: EP-0001
title: Issue with epic
description: Issue that belongs to epic
status: active
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 120
actual_tokens: 0
ai_context: []
sync_status: local
related_tasks: []
related_issues: []
---

# Issue with epic
`;

      // Create issue without epic_id (orphaned)
      const issueWithoutEpicContent = `---
issue_id: ISS-0006
title: Orphaned issue
description: Issue that doesn't belong to any epic
status: active
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 100
actual_tokens: 0
ai_context: []
sync_status: local
related_tasks: ["TSK-0003"]
related_issues: []
---

# Orphaned issue
`;

      // Create task for orphaned issue (also without epic_id)
      const taskContent = `---
task_id: TSK-0003
issue_id: ISS-0006
title: Task for orphaned issue
description: Task that belongs to orphaned issue
status: active
priority: low
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 40
actual_tokens: 0
ai_context: []
sync_status: local
---

# Task for orphaned issue
`;

      fs.writeFileSync(
        path.join(testRootPath, 'tasks', 'epics', 'EP-0001-test-epic.md'),
        epicContent
      );
      fs.writeFileSync(
        path.join(testRootPath, 'tasks', 'issues', 'ISS-0005-with-epic.md'),
        issueWithEpicContent
      );
      fs.writeFileSync(
        path.join(testRootPath, 'tasks', 'issues', 'ISS-0006-orphaned.md'),
        issueWithoutEpicContent
      );
      fs.writeFileSync(
        path.join(testRootPath, 'tasks', 'tasks', 'TSK-0003-orphaned.md'),
        taskContent
      );

      const allTickets = await ticketingInterface.getAllTickets();
      
      expect(allTickets.epics).toHaveLength(1);
      expect(allTickets.issues).toHaveLength(2);
      expect(allTickets.tasks).toHaveLength(1);
      
      // Check epic relationships
      const epic = allTickets.epics[0];
      expect(epic.related_issues).toContain('ISS-0005');
      expect(epic.related_issues).toContain('ISS-0006');
      
      // Check issue relationships
      const issueWithEpic = allTickets.issues.find(i => i.issue_id === 'ISS-0005');
      const orphanedIssue = allTickets.issues.find(i => i.issue_id === 'ISS-0006');
      
      expect(issueWithEpic?.epic_id).toBe('EP-0001');
      expect(orphanedIssue?.epic_id).toBeUndefined();
      expect(orphanedIssue?.related_tasks).toContain('TSK-0003');
      
      // Check task relationships
      const task = allTickets.tasks[0];
      expect(task.issue_id).toBe('ISS-0006');
      expect(task.epic_id).toBeUndefined();
    });
  });

  describe('Search and filtering with optional epic_id', () => {
    it('should search across items with and without epic_id', async () => {
      // Create mixed content for searching
      const items = [
        {
          type: 'issue',
          id: 'ISS-0007',
          epic_id: 'EP-0001',
          title: 'Search test with epic',
          content: 'This issue belongs to an epic and contains searchable content'
        },
        {
          type: 'issue',
          id: 'ISS-0008',
          epic_id: undefined,
          title: 'Search test without epic',
          content: 'This issue has no epic but contains searchable content'
        },
        {
          type: 'task',
          id: 'TSK-0004',
          issue_id: 'ISS-0008',
          epic_id: undefined,
          title: 'Searchable task',
          content: 'This task has searchable content and no epic'
        }
      ];

      items.forEach(item => {
        const epicField = item.epic_id ? `epic_id: ${item.epic_id}` : '';
        const issueField = 'issue_id' in item ? `issue_id: ${item.issue_id}` : '';
        
        const baseFields = `
title: ${item.title}
description: ${item.content}
status: active
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 100
actual_tokens: 0
ai_context: []
sync_status: local`;

        const typeSpecificFields = item.type === 'issue' 
          ? `related_tasks: []
related_issues: []` 
          : '';

        const content = `---
${item.type}_id: ${item.id}
${issueField}
${epicField}${baseFields}
${typeSpecificFields}
---

# ${item.title}

${item.content}
`;

        const dir = item.type === 'issue' ? 'issues' : 'tasks';
        fs.writeFileSync(
          path.join(testRootPath, 'tasks', dir, `${item.id}-search-test.md`),
          content
        );
      });

      const allTickets = await ticketingInterface.getAllTickets();
      
      // All items should be parseable
      expect(allTickets.issues).toHaveLength(2);
      expect(allTickets.tasks).toHaveLength(1);
      
      // Check that search would work (verify content is accessible)
      const searchableItems = [...allTickets.issues, ...allTickets.tasks];
      const itemsWithSearchableContent = searchableItems.filter(item => 
        item.content.includes('searchable content')
      );
      
      expect(itemsWithSearchableContent).toHaveLength(3);
      
      // Verify mixed epic_id presence in search results
      const itemsWithEpic = searchableItems.filter(item => 
        'epic_id' in item && item.epic_id
      );
      const itemsWithoutEpic = searchableItems.filter(item => 
        !('epic_id' in item) || !item.epic_id
      );
      
      expect(itemsWithEpic).toHaveLength(1);
      expect(itemsWithoutEpic).toHaveLength(2);
    });
  });

  describe('Error handling and validation', () => {
    it('should handle malformed files gracefully during bulk operations', async () => {
      // Create valid issue without epic_id
      const validIssueContent = `---
issue_id: ISS-0009
title: Valid issue
description: This is a valid issue
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

# Valid issue
`;

      // Create malformed issue (missing required issue_id)
      const malformedIssueContent = `---
title: Malformed issue
description: This issue is missing issue_id
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

# Malformed issue
`;

      fs.writeFileSync(
        path.join(testRootPath, 'tasks', 'issues', 'ISS-0009-valid.md'),
        validIssueContent
      );
      fs.writeFileSync(
        path.join(testRootPath, 'tasks', 'issues', 'malformed-issue.md'),
        malformedIssueContent
      );

      const allTickets = await ticketingInterface.getAllTickets();
      
      // Should still get the valid issue, malformed one should be skipped
      expect(allTickets.issues).toHaveLength(1);
      expect(allTickets.issues[0].issue_id).toBe('ISS-0009');
      
      const healthStatus = await ticketingInterface.getHealthStatus();
      expect(healthStatus.healthScore).toBeLessThan(100); // Should reflect parsing issues
    });
  });
});