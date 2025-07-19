/**
 * YAML Frontmatter Parser for AI-Trackdown
 * Handles parsing and serialization of Epic, Issue, and Task files
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as YAML from 'yaml';
import type {
  AnyFrontmatter,
  AnyItemData,
  EpicData,
  EpicFrontmatter,
  IssueData,
  IssueFrontmatter,
  PRData,
  PRFrontmatter,
  TaskData,
  TaskFrontmatter,
  ValidationError,
  ValidationResult,
} from '../types/ai-trackdown.js';

// Frontmatter delimiter patterns
const FRONTMATTER_DELIMITER = '---';
const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

export class FrontmatterParser {
  /**
   * Parse raw content with YAML frontmatter
   * This is the generic parse method that parses content directly
   */
  public parse(content: string): { frontmatter: AnyFrontmatter; content: string } {
    const match = content.match(FRONTMATTER_REGEX);

    if (!match) {
      // Try legacy format where content might be in frontmatter
      try {
        const frontmatter = YAML.parse(content) as AnyFrontmatter;
        // Check if it has a content field (legacy format)
        if ('content' in frontmatter && typeof frontmatter.content === 'string') {
          const actualContent = frontmatter.content;
          delete (frontmatter as any).content;
          return {
            frontmatter,
            content: actualContent,
          };
        }
      } catch {
        // Not valid YAML, treat as plain content
      }
      
      // No frontmatter found, return empty frontmatter
      return {
        frontmatter: {} as AnyFrontmatter,
        content: content.trim(),
      };
    }

    const [, yamlContent, markdownContent] = match;

    try {
      const frontmatter = YAML.parse(yamlContent) as AnyFrontmatter;
      
      // Handle legacy format where content might be in frontmatter
      if ('content' in frontmatter && typeof frontmatter.content === 'string' && !markdownContent.trim()) {
        const actualContent = frontmatter.content;
        delete (frontmatter as any).content;
        return {
          frontmatter,
          content: actualContent,
        };
      }
      
      return {
        frontmatter,
        content: markdownContent.trim(),
      };
    } catch (error) {
      throw new Error(
        `Failed to parse YAML frontmatter: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Stringify frontmatter and content to file format
   * This is the public version of serializeWithFrontmatter
   */
  public stringify(frontmatter: AnyFrontmatter, content: string): string {
    return this.serializeWithFrontmatter(frontmatter, content);
  }

  /**
   * Parse an Epic file with YAML frontmatter
   */
  public parseEpic(filePath: string): EpicData {
    const { frontmatter, content } = this.parseFile(filePath);

    // Validate that this is an epic
    if (!frontmatter.epic_id) {
      throw new Error(`File ${filePath} is missing epic_id field`);
    }

    const epicFrontmatter = frontmatter as EpicFrontmatter;
    this.validateEpicFrontmatter(epicFrontmatter);

    return {
      ...epicFrontmatter,
      content,
      file_path: filePath,
    };
  }

  /**
   * Parse an Issue file with YAML frontmatter
   */
  public parseIssue(filePath: string): IssueData {
    const { frontmatter, content } = this.parseFile(filePath);

    // Validate that this is an issue
    if (!frontmatter.issue_id) {
      throw new Error(`File ${filePath} is missing required issue_id field`);
    }

    const issueFrontmatter = frontmatter as IssueFrontmatter;
    this.validateIssueFrontmatter(issueFrontmatter);

    return {
      ...issueFrontmatter,
      content,
      file_path: filePath,
    };
  }

  /**
   * Parse a Task file with YAML frontmatter
   */
  public parseTask(filePath: string): TaskData {
    const { frontmatter, content } = this.parseFile(filePath);

    // Validate that this is a task
    if (!frontmatter.task_id || !frontmatter.issue_id) {
      throw new Error(`File ${filePath} is missing required task_id or issue_id field`);
    }

    const taskFrontmatter = frontmatter as TaskFrontmatter;
    this.validateTaskFrontmatter(taskFrontmatter);

    return {
      ...taskFrontmatter,
      content,
      file_path: filePath,
    };
  }

  /**
   * Parse a PR file with YAML frontmatter
   */
  public parsePR(filePath: string): PRData {
    const { frontmatter, content } = this.parseFile(filePath);

    // Validate that this is a PR
    if (!frontmatter.pr_id || !frontmatter.issue_id) {
      throw new Error(`File ${filePath} is missing required pr_id or issue_id field`);
    }

    const prFrontmatter = frontmatter as PRFrontmatter;
    this.validatePRFrontmatter(prFrontmatter);

    return {
      ...prFrontmatter,
      content,
      file_path: filePath,
    };
  }

  /**
   * Generic file parser for any ai-trackdown item
   */
  public parseAnyItem(filePath: string): AnyItemData {
    const { frontmatter } = this.parseFile(filePath);

    if (
      frontmatter.epic_id &&
      !frontmatter.issue_id &&
      !frontmatter.task_id &&
      !frontmatter.pr_id
    ) {
      return this.parseEpic(filePath);
    } else if (
      frontmatter.issue_id &&
      !frontmatter.task_id &&
      !frontmatter.pr_id
    ) {
      return this.parseIssue(filePath);
    } else if (
      frontmatter.task_id &&
      frontmatter.issue_id &&
      !frontmatter.pr_id
    ) {
      return this.parseTask(filePath);
    } else if (
      frontmatter.pr_id &&
      frontmatter.issue_id &&
      !frontmatter.task_id
    ) {
      return this.parsePR(filePath);
    } else {
      throw new Error(`File ${filePath} does not match any ai-trackdown item type`);
    }
  }

  /**
   * Serialize Epic data back to file format
   */
  public serializeEpic(data: EpicFrontmatter, content: string): string {
    const frontmatter = this.cleanFrontmatter(data);
    return this.serializeWithFrontmatter(frontmatter, content);
  }

  /**
   * Serialize Issue data back to file format
   */
  public serializeIssue(data: IssueFrontmatter, content: string): string {
    const frontmatter = this.cleanFrontmatter(data);
    return this.serializeWithFrontmatter(frontmatter, content);
  }

  /**
   * Serialize Task data back to file format
   */
  public serializeTask(data: TaskFrontmatter, content: string): string {
    const frontmatter = this.cleanFrontmatter(data);
    return this.serializeWithFrontmatter(frontmatter, content);
  }

  /**
   * Serialize PR data back to file format
   */
  public serializePR(data: PRFrontmatter, content: string): string {
    const frontmatter = this.cleanFrontmatter(data);
    return this.serializeWithFrontmatter(frontmatter, content);
  }

  /**
   * Write Epic data to file
   */
  public writeEpic(filePath: string, data: EpicFrontmatter, content: string): void {
    const serialized = this.serializeEpic(data, content);
    this.ensureDirectoryExists(path.dirname(filePath));
    fs.writeFileSync(filePath, serialized, 'utf8');
  }

  /**
   * Write Issue data to file
   */
  public writeIssue(filePath: string, data: IssueFrontmatter, content: string): void {
    const serialized = this.serializeIssue(data, content);
    this.ensureDirectoryExists(path.dirname(filePath));
    fs.writeFileSync(filePath, serialized, 'utf8');
  }

  /**
   * Write Task data to file
   */
  public writeTask(filePath: string, data: TaskFrontmatter, content: string): void {
    const serialized = this.serializeTask(data, content);
    this.ensureDirectoryExists(path.dirname(filePath));
    fs.writeFileSync(filePath, serialized, 'utf8');
  }

  /**
   * Write PR data to file
   */
  public writePR(filePath: string, data: PRFrontmatter, content: string): void {
    const serialized = this.serializePR(data, content);
    this.ensureDirectoryExists(path.dirname(filePath));
    fs.writeFileSync(filePath, serialized, 'utf8');
  }

  /**
   * Update existing file with new frontmatter data
   */
  public updateFile(filePath: string, updates: Partial<AnyFrontmatter>): AnyItemData {
    const existing = this.parseAnyItem(filePath);

    // Merge updates with existing data
    const updated = {
      ...existing,
      ...updates,
      updated_date: new Date().toISOString(),
    };

    // Write back to file
    if ('epic_id' in updated && !('issue_id' in updated)) {
      this.writeEpic(filePath, updated as EpicFrontmatter, existing.content);
    } else if ('issue_id' in updated && !('task_id' in updated) && !('pr_id' in updated)) {
      this.writeIssue(filePath, updated as IssueFrontmatter, existing.content);
    } else if ('task_id' in updated) {
      this.writeTask(filePath, updated as TaskFrontmatter, existing.content);
    } else if ('pr_id' in updated) {
      this.writePR(filePath, updated as PRFrontmatter, existing.content);
    }

    return updated;
  }

  /**
   * Validate file structure and content
   */
  public validateFile(filePath: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    try {
      if (!fs.existsSync(filePath)) {
        errors.push({
          field: 'file',
          message: `File does not exist: ${filePath}`,
          severity: 'error',
        });
        return { valid: false, errors, warnings };
      }

      const data = this.parseAnyItem(filePath);

      // Validate required fields based on type
      if ('epic_id' in data && !('issue_id' in data)) {
        return this.validateEpicData(data as EpicData);
      } else if ('issue_id' in data && !('task_id' in data) && !('pr_id' in data)) {
        return this.validateIssueData(data as IssueData);
      } else if ('task_id' in data) {
        return this.validateTaskData(data as TaskData);
      } else if ('pr_id' in data) {
        return this.validatePRData(data as PRData);
      }
    } catch (error) {
      errors.push({
        field: 'parse',
        message: `Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Private: Core file parsing logic
   */
  private parseFile(filePath: string): { frontmatter: AnyFrontmatter; content: string } {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    try {
      return this.parse(fileContent);
    } catch (error) {
      throw new Error(
        `Failed to parse file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Private: Serialize frontmatter and content to file format
   */
  private serializeWithFrontmatter(frontmatter: AnyFrontmatter, content: string): string {
    const yamlString = YAML.stringify(frontmatter, {
      indent: 2,
      lineWidth: 120,
      minContentWidth: 20,
    });

    return `${FRONTMATTER_DELIMITER}\n${yamlString}${FRONTMATTER_DELIMITER}\n\n${content}\n`;
  }

  /**
   * Private: Clean frontmatter object (remove undefined/null values)
   */
  private cleanFrontmatter(data: AnyFrontmatter): AnyFrontmatter {
    const cleaned: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        cleaned[key] = value;
      }
    }

    return cleaned as AnyFrontmatter;
  }

  /**
   * Private: Ensure directory exists
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Private: Validate Epic frontmatter
   */
  private validateEpicFrontmatter(data: EpicFrontmatter): void {
    const required = ['epic_id', 'title', 'status', 'priority', 'assignee', 'created_date'];
    for (const field of required) {
      if (!data[field as keyof EpicFrontmatter]) {
        throw new Error(`Epic missing required field: ${field}`);
      }
    }
  }

  /**
   * Private: Validate Issue frontmatter
   */
  private validateIssueFrontmatter(data: IssueFrontmatter): void {
    const required = [
      'issue_id',
      'title',
      'status',
      'priority',
      'assignee',
      'created_date',
    ];
    for (const field of required) {
      if (!data[field as keyof IssueFrontmatter]) {
        throw new Error(`Issue missing required field: ${field}`);
      }
    }
  }

  /**
   * Private: Validate Task frontmatter
   */
  private validateTaskFrontmatter(data: TaskFrontmatter): void {
    const required = [
      'task_id',
      'issue_id',
      'title',
      'status',
      'priority',
      'assignee',
      'created_date',
    ];
    for (const field of required) {
      if (!data[field as keyof TaskFrontmatter]) {
        throw new Error(`Task missing required field: ${field}`);
      }
    }
  }

  /**
   * Private: Validate PR frontmatter
   */
  private validatePRFrontmatter(data: PRFrontmatter): void {
    const required = [
      'pr_id',
      'issue_id',
      'title',
      'status',
      'pr_status',
      'priority',
      'assignee',
      'created_date',
    ];
    for (const field of required) {
      if (!data[field as keyof PRFrontmatter]) {
        throw new Error(`PR missing required field: ${field}`);
      }
    }
  }

  /**
   * Private: Comprehensive Epic data validation
   */
  private validateEpicData(data: EpicData): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Required field validation
    if (!data.epic_id)
      errors.push({ field: 'epic_id', message: 'Epic ID is required', severity: 'error' });
    if (!data.title)
      errors.push({ field: 'title', message: 'Title is required', severity: 'error' });
    if (!data.status)
      errors.push({ field: 'status', message: 'Status is required', severity: 'error' });

    // Format validation
    if (data.epic_id && !/^EP-\d{4}$/.test(data.epic_id)) {
      warnings.push({
        field: 'epic_id',
        message: 'Epic ID should follow format EP-XXXX',
        severity: 'warning',
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Private: Comprehensive Issue data validation
   */
  private validateIssueData(data: IssueData): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Required field validation
    if (!data.issue_id)
      errors.push({ field: 'issue_id', message: 'Issue ID is required', severity: 'error' });
    if (!data.title)
      errors.push({ field: 'title', message: 'Title is required', severity: 'error' });

    // Format validation
    if (data.issue_id && !/^ISS-\d{4}$/.test(data.issue_id)) {
      warnings.push({
        field: 'issue_id',
        message: 'Issue ID should follow format ISS-XXXX',
        severity: 'warning',
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Private: Comprehensive Task data validation
   */
  private validateTaskData(data: TaskData): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Required field validation
    if (!data.task_id)
      errors.push({ field: 'task_id', message: 'Task ID is required', severity: 'error' });
    if (!data.issue_id)
      errors.push({ field: 'issue_id', message: 'Issue ID is required', severity: 'error' });

    // Format validation
    if (data.task_id && !/^TSK-\d{4}$/.test(data.task_id)) {
      warnings.push({
        field: 'task_id',
        message: 'Task ID should follow format TSK-XXXX',
        severity: 'warning',
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Private: Comprehensive PR data validation
   */
  private validatePRData(data: PRData): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Required field validation
    if (!data.pr_id)
      errors.push({ field: 'pr_id', message: 'PR ID is required', severity: 'error' });
    if (!data.issue_id)
      errors.push({ field: 'issue_id', message: 'Issue ID is required', severity: 'error' });
    if (!data.pr_status)
      errors.push({ field: 'pr_status', message: 'PR status is required', severity: 'error' });

    // Format validation
    if (data.pr_id && !/^PR-\d{4}$/.test(data.pr_id)) {
      warnings.push({
        field: 'pr_id',
        message: 'PR ID should follow format PR-XXXX',
        severity: 'warning',
      });
    }

    // PR-specific validation
    const validPRStatuses = ['draft', 'open', 'review', 'approved', 'merged', 'closed'];
    if (data.pr_status && !validPRStatuses.includes(data.pr_status)) {
      errors.push({
        field: 'pr_status',
        message: `Invalid PR status: ${data.pr_status}`,
        severity: 'error',
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Bulk operations for directory processing
   */
  public parseDirectory(
    dirPath: string,
    itemType: 'epic' | 'issue' | 'task' | 'pr'
  ): AnyItemData[] {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    const files = fs
      .readdirSync(dirPath)
      .filter((file) => file.endsWith('.md'))
      .map((file) => path.join(dirPath, file));

    const results: AnyItemData[] = [];

    for (const filePath of files) {
      try {
        let data: AnyItemData;

        switch (itemType) {
          case 'epic':
            data = this.parseEpic(filePath);
            break;
          case 'issue':
            data = this.parseIssue(filePath);
            break;
          case 'task':
            data = this.parseTask(filePath);
            break;
          case 'pr':
            data = this.parsePR(filePath);
            break;
          default:
            continue;
        }

        results.push(data);
      } catch (error) {
        console.warn(
          `Failed to parse ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return results;
  }
}
