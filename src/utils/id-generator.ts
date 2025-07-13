/**
 * ID Generator for AI-Trackdown Items
 * Generates unique IDs for Epics, Issues, and Tasks
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IdGenerator, ProjectConfig } from '../types/ai-trackdown.js';

export class AITrackdownIdGenerator implements IdGenerator {
  private config: ProjectConfig;

  // Counters for ID generation (loaded from .ai-trackdown/counters.json)
  private counters: {
    project: number;
    epic: number;
    issue: number;
    task: number;
    pr: number;
  } = {
    project: 1,
    epic: 1,
    issue: 1,
    task: 1,
    pr: 1,
  };

  private countersPath: string;

  constructor(config: ProjectConfig, projectRoot: string) {
    this.config = config;
    this.countersPath = path.join(projectRoot, '.ai-trackdown', 'counters.json');
    this.loadCounters();
  }

  /**
   * Generate unique Project ID
   */
  public generateProjectId(_title: string): string {
    const prefix = this.config.naming_conventions.project_prefix || 'PRJ';
    const id = `${prefix}-${this.counters.project.toString().padStart(4, '0')}`;
    this.counters.project++;
    this.saveCounters();
    return id;
  }

  /**
   * Generate unique Epic ID
   */
  public generateEpicId(_title: string): string {
    const id = `${this.config.naming_conventions.epic_prefix}-${this.counters.epic.toString().padStart(4, '0')}`;
    this.counters.epic++;
    this.saveCounters();
    return id;
  }

  /**
   * Generate unique Issue ID
   */
  public generateIssueId(_epic_id: string, _title: string): string {
    const id = `${this.config.naming_conventions.issue_prefix}-${this.counters.issue.toString().padStart(4, '0')}`;
    this.counters.issue++;
    this.saveCounters();
    return id;
  }

  /**
   * Generate unique Task ID
   */
  public generateTaskId(_issue_id: string, _title: string): string {
    const id = `${this.config.naming_conventions.task_prefix}-${this.counters.task.toString().padStart(4, '0')}`;
    this.counters.task++;
    this.saveCounters();
    return id;
  }

  /**
   * Generate unique PR ID
   */
  public generatePRId(_issue_id: string, _title: string): string {
    const prefix = this.config.naming_conventions.pr_prefix || 'PR';
    const id = `${prefix}-${this.counters.pr.toString().padStart(4, '0')}`;
    this.counters.pr++;
    this.saveCounters();
    return id;
  }

  /**
   * Generate filename for an item
   */
  public generateFilename(itemId: string, title: string): string {
    // Sanitize title for filename
    const sanitizedTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50)
      .replace(/^-|-$/g, '');

    return `${itemId}-${sanitizedTitle}${this.config.naming_conventions.file_extension}`;
  }

  /**
   * Get next available ID without incrementing counter
   */
  public peekNextId(type: 'project' | 'epic' | 'issue' | 'task' | 'pr'): string {
    const prefix =
      this.config.naming_conventions[`${type}_prefix`] ||
      (type === 'project' ? 'PRJ' : type === 'pr' ? 'PR' : '');
    const counter = this.counters[type];
    return `${prefix}-${counter.toString().padStart(4, '0')}`;
  }

  /**
   * Reset counters (dangerous - only for testing or project reset)
   */
  public resetCounters(): void {
    this.counters = { project: 1, epic: 1, issue: 1, task: 1, pr: 1 };
    this.saveCounters();
  }

  /**
   * Get current counter values
   */
  public getCounters(): typeof this.counters {
    return { ...this.counters };
  }

  /**
   * Set specific counter value (useful for migration)
   */
  public setCounter(type: 'project' | 'epic' | 'issue' | 'task' | 'pr', value: number): void {
    this.counters[type] = Math.max(1, value);
    this.saveCounters();
  }

  /**
   * Auto-detect and set counters based on existing files
   */
  public autoDetectCounters(projectRoot: string): void {
    const epicsDir = path.join(projectRoot, this.config.structure.epics_dir);
    const issuesDir = path.join(projectRoot, this.config.structure.issues_dir);
    const tasksDir = path.join(projectRoot, this.config.structure.tasks_dir);

    // Find highest existing epic ID
    const epicPrefix = this.config.naming_conventions.epic_prefix;
    const epicPattern = new RegExp(`${epicPrefix}-(\\d+)`);
    let maxEpic = 0;

    if (fs.existsSync(epicsDir)) {
      const epicFiles = fs.readdirSync(epicsDir);
      for (const file of epicFiles) {
        const match = file.match(epicPattern);
        if (match) {
          maxEpic = Math.max(maxEpic, parseInt(match[1], 10));
        }
      }
    }

    // Find highest existing issue ID
    const issuePrefix = this.config.naming_conventions.issue_prefix;
    const issuePattern = new RegExp(`${issuePrefix}-(\\d+)`);
    let maxIssue = 0;

    if (fs.existsSync(issuesDir)) {
      const issueFiles = fs.readdirSync(issuesDir);
      for (const file of issueFiles) {
        const match = file.match(issuePattern);
        if (match) {
          maxIssue = Math.max(maxIssue, parseInt(match[1], 10));
        }
      }
    }

    // Find highest existing task ID
    const taskPrefix = this.config.naming_conventions.task_prefix;
    const taskPattern = new RegExp(`${taskPrefix}-(\\d+)`);
    let maxTask = 0;

    if (fs.existsSync(tasksDir)) {
      const taskFiles = fs.readdirSync(tasksDir);
      for (const file of taskFiles) {
        const match = file.match(taskPattern);
        if (match) {
          maxTask = Math.max(maxTask, parseInt(match[1], 10));
        }
      }
    }

    // Set counters to next available numbers
    this.counters.epic = maxEpic + 1;
    this.counters.issue = maxIssue + 1;
    this.counters.task = maxTask + 1;

    this.saveCounters();
  }

  /**
   * Load counters from file
   */
  private loadCounters(): void {
    try {
      if (fs.existsSync(this.countersPath)) {
        const data = fs.readFileSync(this.countersPath, 'utf8');
        const loaded = JSON.parse(data);

        // Validate and merge with defaults
        this.counters.project = Math.max(1, loaded.project || 1);
        this.counters.epic = Math.max(1, loaded.epic || 1);
        this.counters.issue = Math.max(1, loaded.issue || 1);
        this.counters.task = Math.max(1, loaded.task || 1);
        this.counters.pr = Math.max(1, loaded.pr || 1);
      }
    } catch (error) {
      console.warn(
        `Failed to load counters, using defaults: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
    } catch (error) {
      console.warn(
        `Failed to save counters: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validate ID format
   */
  public validateId(id: string, type: 'project' | 'epic' | 'issue' | 'task' | 'pr'): boolean {
    const prefix =
      this.config.naming_conventions[`${type}_prefix`] ||
      (type === 'project' ? 'PRJ' : type === 'pr' ? 'PR' : '');
    const pattern = new RegExp(`^${prefix}-\\d{4}$`);
    return pattern.test(id);
  }

  /**
   * Extract number from ID
   */
  public extractIdNumber(
    id: string,
    type: 'project' | 'epic' | 'issue' | 'task' | 'pr'
  ): number | null {
    const prefix =
      this.config.naming_conventions[`${type}_prefix`] ||
      (type === 'project' ? 'PRJ' : type === 'pr' ? 'PR' : '');
    const pattern = new RegExp(`^${prefix}-(\\d{4})$`);
    const match = id.match(pattern);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Generate batch of IDs (useful for bulk operations)
   */
  public generateBatchIds(
    type: 'project' | 'epic' | 'issue' | 'task' | 'pr',
    count: number
  ): string[] {
    const ids: string[] = [];
    const prefix =
      this.config.naming_conventions[`${type}_prefix`] ||
      (type === 'project' ? 'PRJ' : type === 'pr' ? 'PR' : '');

    for (let i = 0; i < count; i++) {
      const id = `${prefix}-${this.counters[type].toString().padStart(4, '0')}`;
      ids.push(id);
      this.counters[type]++;
    }

    this.saveCounters();
    return ids;
  }
}
