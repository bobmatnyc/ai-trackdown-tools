/**
 * Simple ID Generator for AI-Trackdown Items
 * Generates unique IDs for Epics, Issues, and Tasks
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export class IdGenerator {
  private countersPath: string;
  private counters: {
    epic: number;
    issue: number;
    task: number;
    pr: number;
  } = {
    epic: 1,
    issue: 1,
    task: 1,
    pr: 1,
  };

  constructor() {
    // Use current working directory for now
    this.countersPath = path.join(process.cwd(), '.ai-trackdown', 'counters.json');
    this.loadCounters();
  }

  /**
   * Generate unique Epic ID
   */
  public generateEpicId(_title: string): string {
    const id = `EP-${this.counters.epic.toString().padStart(4, '0')}`;
    this.counters.epic++;
    this.saveCounters();
    return id;
  }

  /**
   * Generate unique Issue ID
   */
  public generateIssueId(_epic_id: string, _title: string): string {
    const id = `ISS-${this.counters.issue.toString().padStart(4, '0')}`;
    this.counters.issue++;
    this.saveCounters();
    return id;
  }

  /**
   * Generate unique Task ID
   */
  public generateTaskId(_issue_id: string, _title: string): string {
    const id = `TSK-${this.counters.task.toString().padStart(4, '0')}`;
    this.counters.task++;
    this.saveCounters();
    return id;
  }

  /**
   * Generate unique PR ID
   */
  public generatePRId(_issue_id: string, _title: string): string {
    const id = `PR-${this.counters.pr.toString().padStart(4, '0')}`;
    this.counters.pr++;
    this.saveCounters();
    return id;
  }

  /**
   * Load counters from file
   */
  private loadCounters(): void {
    try {
      if (fs.existsSync(this.countersPath)) {
        const data = fs.readFileSync(this.countersPath, 'utf8');
        const loaded = JSON.parse(data);

        this.counters.epic = Math.max(1, loaded.epic || 1);
        this.counters.issue = Math.max(1, loaded.issue || 1);
        this.counters.task = Math.max(1, loaded.task || 1);
        this.counters.pr = Math.max(1, loaded.pr || 1);
      }
    } catch (_error) {
      // Keep default values
    }
  }

  /**
   * Save counters to file
   */
  private saveCounters(): void {
    try {
      const dir = path.dirname(this.countersPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = JSON.stringify(this.counters, null, 2);
      fs.writeFileSync(this.countersPath, data, 'utf8');
    } catch (_error) {
      // Silently fail
    }
  }
}
