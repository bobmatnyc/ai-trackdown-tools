/**
 * Integration tests for ISS-0025 and ISS-0026 fixes
 * Tests the fixed status command and universal ticketing interface
 */

import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const CLI_PATH = path.join(__dirname, '..', 'dist', 'index.js');

describe('Status Command Fix (ISS-0025)', () => {
  beforeEach(() => {
    // Change to test directory
    process.chdir(path.join(__dirname, '..'));
  });

  it('should show accurate counts in status command', () => {
    // Test status command with summary
    const statusOutput = execSync(`node ${CLI_PATH} status --summary`, { encoding: 'utf8' });

    // Should contain non-zero counts
    expect(statusOutput).toContain('Total Items: 35');
    expect(statusOutput).toContain('Active: 32');
    expect(statusOutput).toContain('Completed: 3');
    expect(statusOutput).not.toContain('Total Items: 0');
  });

  it('should match individual command counts', () => {
    // Get counts from individual commands
    const epicOutput = execSync(`node ${CLI_PATH} epic list`, { encoding: 'utf8' });
    const issueOutput = execSync(`node ${CLI_PATH} issue list`, { encoding: 'utf8' });
    const taskOutput = execSync(`node ${CLI_PATH} task list`, { encoding: 'utf8' });

    // Extract counts
    const epicCount = parseInt(epicOutput.match(/Found (\d+) epic/)?.[1] || '0');
    const issueCount = parseInt(issueOutput.match(/=== ISSUES \((\d+)\/\d+\) ===/)?.[1] || '0');
    const taskCount = parseInt(taskOutput.match(/Found (\d+) task/)?.[1] || '0');

    const totalExpected = epicCount + issueCount + taskCount;

    // Test status command total
    const statusOutput = execSync(`node ${CLI_PATH} status --summary`, { encoding: 'utf8' });
    const statusTotal = parseInt(statusOutput.match(/Total Items: (\d+)/)?.[1] || '0');

    expect(statusTotal).toBe(totalExpected);
    expect(statusTotal).toBeGreaterThan(0);
  });

  it('should provide accurate project health metrics', () => {
    const statusOutput = execSync(`node ${CLI_PATH} status --summary`, { encoding: 'utf8' });

    // Should contain valid metrics
    expect(statusOutput).toMatch(/Completion Rate: \d+%/);
    expect(statusOutput).toMatch(/Priority Distribution/);
    expect(statusOutput).toMatch(/Status Breakdown/);
    expect(statusOutput).toMatch(/Recent Activity/);
  });
});

describe('Universal Ticketing Interface (ISS-0026)', () => {
  beforeEach(() => {
    // Change to test directory
    process.chdir(path.join(__dirname, '..'));
  });

  it('should provide accurate counts via health command', () => {
    const healthOutput = execSync(`node ${CLI_PATH} health --counts-only`, { encoding: 'utf8' });

    // Should contain accurate counts
    expect(healthOutput).toMatch(/📋 Epics: \d+/);
    expect(healthOutput).toMatch(/🐛 Issues: \d+/);
    expect(healthOutput).toMatch(/✅ Tasks: \d+/);
    expect(healthOutput).toMatch(/🔢 Total: \d+/);
    expect(healthOutput).toContain(
      'These counts match the individual epic/issue/task list commands'
    );
  });

  it('should provide comprehensive health monitoring', () => {
    const healthOutput = execSync(`node ${CLI_PATH} health`, { encoding: 'utf8' });

    // Should contain all health sections
    expect(healthOutput).toContain('Universal Ticketing Interface - Health Monitoring');
    expect(healthOutput).toContain('Ticket Counts');
    expect(healthOutput).toContain('Status Breakdown');
    expect(healthOutput).toContain('Priority Distribution');
    expect(healthOutput).toContain('Health Indicators');
    expect(healthOutput).toContain('Health Recommendations');
  });

  it('should support JSON output format', () => {
    const healthOutput = execSync(`node ${CLI_PATH} health --json`, { encoding: 'utf8' });

    // Should be valid JSON
    expect(() => JSON.parse(healthOutput)).not.toThrow();

    const data = JSON.parse(healthOutput);
    expect(data).toHaveProperty('counts');
    expect(data).toHaveProperty('healthMetrics');
    expect(data).toHaveProperty('timestamp');
    expect(data.counts).toHaveProperty('total');
    expect(data.counts.total).toBeGreaterThan(0);
  });

  it('should provide detailed metrics when requested', () => {
    const healthOutput = execSync(
      `node ${CLI_PATH} health --epic-details --issue-details --task-details`,
      { encoding: 'utf8' }
    );

    // Should contain detailed sections
    expect(healthOutput).toContain('Epic Details');
    expect(healthOutput).toContain('Issue Details');
    expect(healthOutput).toContain('Task Details');
    expect(healthOutput).toContain('Total Epics:');
    expect(healthOutput).toContain('Total Issues:');
    expect(healthOutput).toContain('Total Tasks:');
  });

  it('should support metrics-only output', () => {
    const healthOutput = execSync(`node ${CLI_PATH} health --metrics-only`, { encoding: 'utf8' });

    // Should contain only metrics, not full health report
    expect(healthOutput).toContain('Universal Ticketing Interface - Health Monitoring');
    expect(healthOutput).not.toContain('Project Health Report');
  });

  it('should provide real-time monitoring capabilities', () => {
    const healthOutput = execSync(`node ${CLI_PATH} health --refresh`, { encoding: 'utf8' });

    // Should show refresh message
    expect(healthOutput).toContain('Refreshing ticket data...');
    expect(healthOutput).toContain('Data refreshed successfully');
  });
});

describe('Count Consistency Verification', () => {
  it('should have consistent counts across all interfaces', () => {
    // Get counts from all sources
    const epicOutput = execSync(`node ${CLI_PATH} epic list`, { encoding: 'utf8' });
    const issueOutput = execSync(`node ${CLI_PATH} issue list`, { encoding: 'utf8' });
    const taskOutput = execSync(`node ${CLI_PATH} task list`, { encoding: 'utf8' });
    const statusOutput = execSync(`node ${CLI_PATH} status --summary`, { encoding: 'utf8' });
    const healthOutput = execSync(`node ${CLI_PATH} health --counts-only`, { encoding: 'utf8' });

    // Extract counts
    const epicCount = parseInt(epicOutput.match(/Found (\d+) epic/)?.[1] || '0');
    const issueCount = parseInt(issueOutput.match(/=== ISSUES \((\d+)\/\d+\) ===/)?.[1] || '0');
    const taskCount = parseInt(taskOutput.match(/Found (\d+) task/)?.[1] || '0');
    const statusTotal = parseInt(statusOutput.match(/Total Items: (\d+)/)?.[1] || '0');
    const healthTotal = parseInt(healthOutput.match(/🔢 Total: (\d+)/)?.[1] || '0');

    const expectedTotal = epicCount + issueCount + taskCount;

    // All counts should match
    expect(statusTotal).toBe(expectedTotal);
    expect(healthTotal).toBe(expectedTotal);
    expect(expectedTotal).toBeGreaterThan(0);

    // Individual counts should also match
    const healthEpicCount = parseInt(healthOutput.match(/📋 Epics: (\d+)/)?.[1] || '0');
    const healthIssueCount = parseInt(healthOutput.match(/🐛 Issues: (\d+)/)?.[1] || '0');
    const healthTaskCount = parseInt(healthOutput.match(/✅ Tasks: (\d+)/)?.[1] || '0');

    expect(healthEpicCount).toBe(epicCount);
    expect(healthIssueCount).toBe(issueCount);
    expect(healthTaskCount).toBe(taskCount);
  });
});

describe('Health Alerts and Recommendations', () => {
  it('should provide health alerts when applicable', () => {
    const healthOutput = execSync(`node ${CLI_PATH} health`, { encoding: 'utf8' });

    // Should contain health evaluation
    expect(healthOutput).toMatch(/(Health Alerts|health indicators are within normal ranges)/);
  });

  it('should provide actionable recommendations', () => {
    const healthOutput = execSync(`node ${CLI_PATH} health`, { encoding: 'utf8' });

    // Should contain recommendations section
    expect(healthOutput).toContain('Health Recommendations');
    expect(healthOutput).toMatch(/(Consider|Review|Focus)/);
  });
});

describe('Error Handling and Edge Cases', () => {
  it('should handle health command with invalid options gracefully', () => {
    try {
      execSync(`node ${CLI_PATH} health --invalid-option`, { encoding: 'utf8' });
      expect(false).toBe(true); // Should not reach here
    } catch (error: any) {
      expect(error.status).toBe(1);
      expect(error.stderr).toContain('unknown option');
    }
  });

  it('should handle status command with filters', () => {
    const statusOutput = execSync(`node ${CLI_PATH} status --status todo --priority high`, {
      encoding: 'utf8',
    });

    // Should apply filters and still show valid output
    expect(statusOutput).toContain('Active Filters');
    expect(statusOutput).toContain('Status: todo');
    expect(statusOutput).toContain('Priority: high');
    expect(statusOutput).toMatch(/TODO \(\d+\)/);
  });
});
