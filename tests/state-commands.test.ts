/**
 * Tests for State Management CLI Commands
 * Validates resolve, state, and migrate-state commands
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('State Management CLI Commands', () => {
  let testDir: string;
  let tasksDir: string;

  beforeEach(() => {
    // Create temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-commands-test-'));
    tasksDir = path.join(testDir, 'tasks');
    
    // Create directory structure
    fs.mkdirSync(path.join(tasksDir, 'epics'), { recursive: true });
    fs.mkdirSync(path.join(tasksDir, 'issues'), { recursive: true });
    fs.mkdirSync(path.join(tasksDir, 'tasks'), { recursive: true });
    fs.mkdirSync(path.join(tasksDir, 'prs'), { recursive: true });
    fs.mkdirSync(path.join(tasksDir, 'templates'), { recursive: true });

    // Create test issue
    const issueContent = `---
issue_id: ISS-0001
epic_id: EP-0001
title: Test Issue
description: A test issue for state management
status: active
priority: medium
assignee: test-user
created_date: 2024-01-01T00:00:00.000Z
updated_date: 2024-01-01T00:00:00.000Z
estimated_tokens: 100
actual_tokens: 0
ai_context: []
sync_status: local
related_tasks: []
related_issues: []
completion_percentage: 0
blocked_by: []
blocks: []
---

# Test Issue

This is a test issue for state management testing.
`;

    fs.writeFileSync(path.join(tasksDir, 'issues', 'ISS-0001-test-issue.md'), issueContent);

    // Create test issue with state
    const issueWithStateContent = `---
issue_id: ISS-0002
epic_id: EP-0001
title: Test Issue with State
description: A test issue with state field
status: active
state: ready_for_qa
state_metadata:
  transitioned_at: 2024-01-01T12:00:00.000Z
  transitioned_by: test-user
  automation_eligible: true
  transition_reason: Initial testing
priority: high
assignee: qa-user
created_date: 2024-01-01T00:00:00.000Z
updated_date: 2024-01-01T12:00:00.000Z
estimated_tokens: 150
actual_tokens: 120
ai_context: []
sync_status: local
related_tasks: []
related_issues: []
completion_percentage: 80
blocked_by: []
blocks: []
---

# Test Issue with State

This is a test issue that already has state management implemented.
`;

    fs.writeFileSync(path.join(tasksDir, 'issues', 'ISS-0002-test-issue-with-state.md'), issueWithStateContent);

    // Create config file
    const config = {
      version: '1.0.0',
      structure: {
        epics_dir: 'epics',
        issues_dir: 'issues',
        tasks_dir: 'tasks',
        templates_dir: 'templates',
        prs_dir: 'prs'
      },
      naming_conventions: {
        epic_prefix: 'EP',
        issue_prefix: 'ISS',
        task_prefix: 'TSK',
        pr_prefix: 'PR',
        file_extension: '.md'
      },
      default_assignee: 'unassigned'
    };

    fs.writeFileSync(path.join(testDir, 'trackdown.config.json'), JSON.stringify(config, null, 2));

    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('State List Command', () => {
    it('should list items with state information', () => {
      const result = execSync('npx tsx ../../dist/cli.js state list --format json', {
        encoding: 'utf8',
        cwd: testDir
      });

      const items = JSON.parse(result);
      expect(items).toBeInstanceOf(Array);
      expect(items.length).toBeGreaterThan(0);
      
      // Find our test issues
      const issue1 = items.find((item: any) => item.id === 'ISS-0001');
      const issue2 = items.find((item: any) => item.id === 'ISS-0002');
      
      expect(issue1).toBeDefined();
      expect(issue1.state).toBe('active'); // Should use effective state from status
      
      expect(issue2).toBeDefined();
      expect(issue2.state).toBe('ready_for_qa'); // Should use actual state field
    });

    it('should filter by state', () => {
      const result = execSync('npx tsx ../../dist/cli.js state list --state ready_for_qa --format json', {
        encoding: 'utf8',
        cwd: testDir
      });

      const items = JSON.parse(result);
      expect(items).toBeInstanceOf(Array);
      expect(items.length).toBe(1);
      expect(items[0].id).toBe('ISS-0002');
      expect(items[0].state).toBe('ready_for_qa');
    });

    it('should show state analytics', () => {
      const result = execSync('npx tsx ../../dist/cli.js state analytics --format json', {
        encoding: 'utf8',
        cwd: testDir
      });

      const analytics = JSON.parse(result);
      expect(analytics.total_items).toBe(2);
      expect(analytics.state_distribution).toBeDefined();
      expect(analytics.state_distribution.active).toBe(1);
      expect(analytics.state_distribution.ready_for_qa).toBe(1);
      expect(analytics.migration_status).toBeDefined();
    });
  });

  describe('State Show Command', () => {
    it('should show detailed state information for an item', () => {
      const result = execSync('npx tsx ../../dist/cli.js state show ISS-0002', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('ISS-0002');
      expect(result).toContain('ready_for_qa');
      expect(result).toContain('State Metadata');
      expect(result).toContain('test-user');
      expect(result).toContain('Initial testing');
    });

    it('should show available transitions', () => {
      const result = execSync('npx tsx ../../dist/cli.js state show ISS-0002 --show-transitions', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('Available Transitions');
      expect(result).toContain('ready_for_deployment');
    });
  });

  describe('State Update Command', () => {
    it('should update item state with validation', () => {
      const result = execSync('npx tsx ../../dist/cli.js state update ISS-0002 ready_for_deployment --reason "QA testing complete"', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('State updated');
      expect(result).toContain('ready_for_qa → ready_for_deployment');

      // Verify the file was updated
      const fileContent = fs.readFileSync(path.join(tasksDir, 'issues', 'ISS-0002-test-issue-with-state.md'), 'utf8');
      expect(fileContent).toContain('state: ready_for_deployment');
      expect(fileContent).toContain('QA testing complete');
    });

    it('should fail on invalid state transition', () => {
      expect(() => {
        execSync('npx tsx ../../dist/cli.js state update ISS-0002 planning --reason "Invalid transition"', {
          encoding: 'utf8',
          cwd: testDir
        });
      }).toThrow();
    });

    it('should show dry run preview', () => {
      const result = execSync('npx tsx ../../dist/cli.js state update ISS-0002 ready_for_deployment --reason "QA complete" --dry-run', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('Dry run');
      expect(result).toContain('ready_for_qa');
      expect(result).toContain('ready_for_deployment');

      // Verify the file was NOT updated
      const fileContent = fs.readFileSync(path.join(tasksDir, 'issues', 'ISS-0002-test-issue-with-state.md'), 'utf8');
      expect(fileContent).toContain('state: ready_for_qa'); // Should remain unchanged
    });
  });

  describe('Resolve Command', () => {
    it('should resolve item to engineering', () => {
      const result = execSync('npx tsx ../../dist/cli.js resolve engineering ISS-0001 --reason "Development ready"', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('resolved to ready_for_engineering');

      // Verify the file was updated
      const fileContent = fs.readFileSync(path.join(tasksDir, 'issues', 'ISS-0001-test-issue.md'), 'utf8');
      expect(fileContent).toContain('state: ready_for_engineering');
      expect(fileContent).toContain('Development ready');
    });

    it('should resolve item to QA', () => {
      // First resolve to engineering
      execSync('npx tsx ../../dist/cli.js resolve engineering ISS-0001 --reason "Development complete"', {
        encoding: 'utf8',
        cwd: testDir
      });

      // Then resolve to QA
      const result = execSync('npx tsx ../../dist/cli.js resolve qa ISS-0001 --reason "Ready for testing"', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('resolved to ready_for_qa');

      // Verify the file was updated
      const fileContent = fs.readFileSync(path.join(tasksDir, 'issues', 'ISS-0001-test-issue.md'), 'utf8');
      expect(fileContent).toContain('state: ready_for_qa');
      expect(fileContent).toContain('Ready for testing');
    });

    it('should reject item with reason', () => {
      const result = execSync('npx tsx ../../dist/cli.js resolve reject ISS-0001 --reason "Out of scope for current sprint"', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('resolved to won_t_do');

      // Verify the file was updated
      const fileContent = fs.readFileSync(path.join(tasksDir, 'issues', 'ISS-0001-test-issue.md'), 'utf8');
      expect(fileContent).toContain('state: won_t_do');
      expect(fileContent).toContain('Out of scope for current sprint');
    });

    it('should show resolve status', () => {
      const result = execSync('npx tsx ../../dist/cli.js resolve status ISS-0002', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('Resolve status for ISS-0002');
      expect(result).toContain('Current state: READY FOR QA');
      expect(result).toContain('Available transitions');
    });
  });

  describe('Batch Operations', () => {
    it('should perform batch state updates', () => {
      // First prepare both issues to be in engineering state
      execSync('npx tsx ../../dist/cli.js resolve engineering ISS-0001 --reason "Prep for batch"', {
        encoding: 'utf8',
        cwd: testDir
      });

      const result = execSync('npx tsx ../../dist/cli.js state batch-update ready_for_qa ISS-0001 ISS-0002 --reason "Batch QA transition"', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('Batch update summary');
      expect(result).toContain('Successful: 2');
      expect(result).toContain('Failed: 0');
    });

    it('should perform batch resolve operations', () => {
      // Prepare items to be in QA state
      execSync('npx tsx ../../dist/cli.js resolve engineering ISS-0001 --reason "Prep"', {
        encoding: 'utf8',
        cwd: testDir
      });
      execSync('npx tsx ../../dist/cli.js resolve qa ISS-0001 --reason "Prep"', {
        encoding: 'utf8',
        cwd: testDir
      });

      const result = execSync('npx tsx ../../dist/cli.js resolve batch-deployment ISS-0001 ISS-0002 --reason "Batch deployment"', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('Batch resolving 2 items');
      expect(result).toContain('Batch resolution summary');
    });
  });

  describe('State Workflow Command', () => {
    it('should show complete workflow', () => {
      const result = execSync('npx tsx ../../dist/cli.js state workflow', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('State Transition Workflow');
      expect(result).toContain('Legacy Status Flow');
      expect(result).toContain('Resolution State Flow');
      expect(result).toContain('Rejection Flow');
    });

    it('should show transitions from specific state', () => {
      const result = execSync('npx tsx ../../dist/cli.js state workflow --from ready_for_qa', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('Transitions from READY FOR QA');
      expect(result).toContain('ready_for_deployment');
    });

    it('should show transitions to specific state', () => {
      const result = execSync('npx tsx ../../dist/cli.js state workflow --to done', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('Transitions to DONE');
      expect(result).toContain('ready_for_deployment');
    });
  });

  describe('State Validation Command', () => {
    it('should validate state consistency', () => {
      const result = execSync('npx tsx ../../dist/cli.js state validate', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('Validation Results');
      expect(result).toContain('Valid:');
      expect(result).toContain('Invalid:');
      expect(result).toContain('Warnings:');
    });

    it('should validate specific item type', () => {
      const result = execSync('npx tsx ../../dist/cli.js state validate --type issue', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('Validating 2 items');
      expect(result).toContain('Validation Results');
    });
  });

  describe('Migration Commands', () => {
    it('should show migration status', () => {
      const result = execSync('npx tsx ../../dist/cli.js migrate-state status --format json', {
        encoding: 'utf8',
        cwd: testDir
      });

      const status = JSON.parse(result);
      expect(status.total_items).toBe(2);
      expect(status.needs_migration).toBe(1); // ISS-0001 needs migration
      expect(status.already_migrated).toBe(1); // ISS-0002 already has state
    });

    it('should preview migration', () => {
      const result = execSync('npx tsx ../../dist/cli.js migrate-state preview', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('Migration Preview');
      expect(result).toContain('Total items: 2');
      expect(result).toContain('Need migration: 1');
      expect(result).toContain('Already migrated: 1');
    });

    it('should validate migration', () => {
      const result = execSync('npx tsx ../../dist/cli.js migrate-state validate', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('Migration Validation');
      expect(result).toContain('Total items: 2');
    });

    it('should perform dry run migration', () => {
      const result = execSync('npx tsx ../../dist/cli.js migrate-state --dry-run', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('Dry run - showing migration preview');
      expect(result).toContain('Items that will be migrated');

      // Verify files were not actually changed
      const fileContent = fs.readFileSync(path.join(tasksDir, 'issues', 'ISS-0001-test-issue.md'), 'utf8');
      expect(fileContent).not.toContain('state:'); // Should not have state field yet
    });

    it('should perform actual migration', () => {
      const result = execSync('npx tsx ../../dist/cli.js migrate-state --migrated-by "test-system"', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('Migration Results');
      expect(result).toContain('Successfully migrated: 1');
      expect(result).toContain('Files updated: 1');

      // Verify the file was updated
      const fileContent = fs.readFileSync(path.join(tasksDir, 'issues', 'ISS-0001-test-issue.md'), 'utf8');
      expect(fileContent).toContain('state: active');
      expect(fileContent).toContain('state_metadata:');
      expect(fileContent).toContain('test-system');
    });
  });

  describe('Integration with Existing Commands', () => {
    it('should create issue with state field', () => {
      const result = execSync('npx tsx ../../dist/cli.js issue create "New Issue with State" --state ready_for_engineering --description "Test issue"', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('Issue created successfully');

      // Find the created file
      const issuesDir = path.join(tasksDir, 'issues');
      const files = fs.readdirSync(issuesDir);
      const newFile = files.find(f => f.includes('new-issue-with-state'));
      expect(newFile).toBeDefined();

      if (newFile) {
        const content = fs.readFileSync(path.join(issuesDir, newFile), 'utf8');
        expect(content).toContain('state: ready_for_engineering');
        expect(content).toContain('state_metadata:');
        expect(content).toContain('Initial creation');
      }
    });

    it('should update issue with state field', () => {
      const result = execSync('npx tsx ../../dist/cli.js issue update ISS-0001 --state ready_for_qa --reason "Development complete"', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('Issue updated successfully');
      expect(result).toContain('State: READY FOR QA');

      // Verify the file was updated
      const fileContent = fs.readFileSync(path.join(tasksDir, 'issues', 'ISS-0001-test-issue.md'), 'utf8');
      expect(fileContent).toContain('state: ready_for_qa');
      expect(fileContent).toContain('Development complete');
    });

    it('should list issues with state filter', () => {
      // First add state to ISS-0001
      execSync('npx tsx ../../dist/cli.js issue update ISS-0001 --state ready_for_engineering', {
        encoding: 'utf8',
        cwd: testDir
      });

      const result = execSync('npx tsx ../../dist/cli.js issue list --state ready_for_engineering --show-state', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('ISS-0001');
      expect(result).toContain('READY FOR ENGINEERING');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid state transitions gracefully', () => {
      expect(() => {
        execSync('npx tsx ../../dist/cli.js state update ISS-0002 invalid_state', {
          encoding: 'utf8',
          cwd: testDir
        });
      }).toThrow();
    });

    it('should handle missing item IDs gracefully', () => {
      expect(() => {
        execSync('npx tsx ../../dist/cli.js state show ISS-9999', {
          encoding: 'utf8',
          cwd: testDir
        });
      }).toThrow();
    });

    it('should require reason for rejection', () => {
      expect(() => {
        execSync('npx tsx ../../dist/cli.js resolve reject ISS-0001', {
          encoding: 'utf8',
          cwd: testDir
        });
      }).toThrow();
    });
  });

  describe('Automation Integration', () => {
    it('should mark automated transitions as automation eligible', () => {
      // Create an automated transition
      const result = execSync('npx tsx ../../dist/cli.js state update ISS-0002 ready_for_deployment --reason "Automated QA passed" --reviewer "ci-system"', {
        encoding: 'utf8',
        cwd: testDir
      });

      expect(result).toContain('State updated');

      // Verify the metadata indicates automation eligibility
      const fileContent = fs.readFileSync(path.join(tasksDir, 'issues', 'ISS-0002-test-issue-with-state.md'), 'utf8');
      expect(fileContent).toContain('automation_eligible: true');
    });

    it('should show automation status in analytics', () => {
      const result = execSync('npx tsx ../../dist/cli.js state analytics --verbose --format json', {
        encoding: 'utf8',
        cwd: testDir
      });

      const analytics = JSON.parse(result);
      expect(analytics.migration_status).toBeDefined();
      expect(analytics.migration_status.migrated).toBeDefined();
      expect(analytics.migration_status.needs_migration).toBeDefined();
    });
  });
});