/**
 * Ticket Compliance Fixer
 * Automatically fixes non-compliant ticket names and frontmatter during indexing
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FrontmatterParser } from './frontmatter-parser.js';
import type { AnyFrontmatter, EpicFrontmatter, IssueFrontmatter, TaskFrontmatter, PRFrontmatter } from '../types/ai-trackdown.js';

export class TicketComplianceFixer {
  private parser: FrontmatterParser;

  constructor() {
    this.parser = new FrontmatterParser();
  }

  /**
   * Fix a non-compliant ticket file
   * Returns true if fixes were made, false if already compliant
   */
  public async fixTicketCompliance(filePath: string): Promise<boolean> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = this.parser.parse(content);
      
      // Determine ticket type and fix accordingly
      const frontmatter = parsed.frontmatter;
      const ticketType = this.determineTicketType(frontmatter);
      
      if (!ticketType) {
        console.warn(`Cannot determine ticket type for ${filePath}`);
        return false;
      }

      let fixesMade = false;
      const originalFilename = path.basename(filePath);
      
      // Fix frontmatter IDs and required fields
      const fixedFrontmatter = await this.fixFrontmatter(frontmatter, ticketType, filePath);
      if (this.hasFrontmatterChanges(frontmatter, fixedFrontmatter)) {
        fixesMade = true;
      }

      // Check and fix filename
      const correctFilename = this.generateCorrectFilename(fixedFrontmatter, ticketType);
      
      if (originalFilename !== correctFilename) {
        // Rename file to follow correct naming convention
        const newFilePath = path.join(path.dirname(filePath), correctFilename);
        
        // Write updated content first
        const updatedContent = this.parser.stringify(fixedFrontmatter, parsed.content);
        await fs.writeFile(filePath, updatedContent);
        
        // Then rename the file
        await fs.rename(filePath, newFilePath);
        console.log(`Fixed: Renamed ${originalFilename} to ${correctFilename}`);
        fixesMade = true;
      } else if (fixesMade) {
        // Just update the content if only frontmatter changed
        const updatedContent = this.parser.stringify(fixedFrontmatter, parsed.content);
        await fs.writeFile(filePath, updatedContent);
        console.log(`Fixed: Updated frontmatter in ${originalFilename}`);
      }

      return fixesMade;
    } catch (error) {
      console.error(`Failed to fix compliance for ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Determine ticket type from frontmatter
   */
  private determineTicketType(frontmatter: AnyFrontmatter): 'epic' | 'issue' | 'task' | 'pr' | null {
    if ('epic_id' in frontmatter && !('issue_id' in frontmatter)) {
      return 'epic';
    } else if ('issue_id' in frontmatter && !('task_id' in frontmatter) && !('pr_id' in frontmatter)) {
      return 'issue';
    } else if ('task_id' in frontmatter) {
      return 'task';
    } else if ('pr_id' in frontmatter) {
      return 'pr';
    }
    return null;
  }

  /**
   * Fix frontmatter IDs and ensure required fields
   */
  private async fixFrontmatter(
    frontmatter: AnyFrontmatter, 
    type: 'epic' | 'issue' | 'task' | 'pr',
    filePath: string
  ): Promise<AnyFrontmatter> {
    const fixed = { ...frontmatter };

    switch (type) {
      case 'epic':
        return this.fixEpicFrontmatter(fixed as EpicFrontmatter);
      case 'issue':
        return this.fixIssueFrontmatter(fixed as IssueFrontmatter);
      case 'task':
        return this.fixTaskFrontmatter(fixed as TaskFrontmatter);
      case 'pr':
        return this.fixPRFrontmatter(fixed as PRFrontmatter);
    }
  }

  /**
   * Fix epic frontmatter
   */
  private fixEpicFrontmatter(frontmatter: EpicFrontmatter): EpicFrontmatter {
    const fixed = { ...frontmatter };

    // Fix epic ID format
    if (fixed.epic_id) {
      // Handle various formats: EPIC-001, EP-001, EP-1, etc.
      const match = fixed.epic_id.match(/(\d+)/);
      if (match) {
        const num = match[1].padStart(4, '0');
        fixed.epic_id = `EP-${num}`;
      }
    }

    // Ensure required fields
    if (!fixed.status) fixed.status = 'planning';
    if (!fixed.priority) fixed.priority = 'medium';
    if (!fixed.assignee) fixed.assignee = 'unassigned';
    if (!fixed.created_date) fixed.created_date = new Date().toISOString();
    if (!fixed.updated_date) fixed.updated_date = new Date().toISOString();

    return fixed;
  }

  /**
   * Fix issue frontmatter
   */
  private fixIssueFrontmatter(frontmatter: IssueFrontmatter): IssueFrontmatter {
    const fixed = { ...frontmatter };

    // Fix issue ID format
    if (fixed.issue_id) {
      // Handle ISS-15, ISS-015, etc.
      const match = fixed.issue_id.match(/(\d+)/);
      if (match) {
        const num = match[1].padStart(4, '0');
        fixed.issue_id = `ISS-${num}`;
      }
    }

    // Fix epic ID format if present
    if (fixed.epic_id) {
      const match = fixed.epic_id.match(/(\d+)/);
      if (match) {
        const num = match[1].padStart(4, '0');
        fixed.epic_id = `EP-${num}`;
      }
    }

    // Ensure required fields
    if (!fixed.status) fixed.status = 'planning';
    if (!fixed.priority) fixed.priority = 'medium';
    if (!fixed.assignee) fixed.assignee = 'unassigned';
    if (!fixed.created_date) fixed.created_date = new Date().toISOString();
    if (!fixed.updated_date) fixed.updated_date = new Date().toISOString();
    if (!fixed.estimated_tokens) fixed.estimated_tokens = 0;
    if (!fixed.actual_tokens) fixed.actual_tokens = 0;
    if (!fixed.ai_context) fixed.ai_context = [];
    if (!fixed.sync_status) fixed.sync_status = 'local';

    return fixed;
  }

  /**
   * Fix task frontmatter
   */
  private fixTaskFrontmatter(frontmatter: TaskFrontmatter): TaskFrontmatter {
    const fixed = { ...frontmatter };

    // Fix task ID format
    if (fixed.task_id) {
      const match = fixed.task_id.match(/(\d+)/);
      if (match) {
        const num = match[1].padStart(4, '0');
        fixed.task_id = `TSK-${num}`;
      }
    }

    // Fix issue ID format
    if (fixed.issue_id) {
      const match = fixed.issue_id.match(/(\d+)/);
      if (match) {
        const num = match[1].padStart(4, '0');
        fixed.issue_id = `ISS-${num}`;
      }
    }

    // Fix epic ID format
    if (fixed.epic_id) {
      const match = fixed.epic_id.match(/(\d+)/);
      if (match) {
        const num = match[1].padStart(4, '0');
        fixed.epic_id = `EP-${num}`;
      }
    }

    // Ensure required fields
    if (!fixed.status) fixed.status = 'planning';
    if (!fixed.priority) fixed.priority = 'medium';
    if (!fixed.assignee) fixed.assignee = 'unassigned';
    if (!fixed.created_date) fixed.created_date = new Date().toISOString();
    if (!fixed.updated_date) fixed.updated_date = new Date().toISOString();
    if (!fixed.estimated_tokens) fixed.estimated_tokens = 0;
    if (!fixed.actual_tokens) fixed.actual_tokens = 0;
    if (!fixed.ai_context) fixed.ai_context = [];
    if (!fixed.sync_status) fixed.sync_status = 'local';

    return fixed;
  }

  /**
   * Fix PR frontmatter
   */
  private fixPRFrontmatter(frontmatter: PRFrontmatter): PRFrontmatter {
    const fixed = { ...frontmatter };

    // Fix PR ID format
    if (fixed.pr_id) {
      const match = fixed.pr_id.match(/(\d+)/);
      if (match) {
        const num = match[1].padStart(4, '0');
        fixed.pr_id = `PR-${num}`;
      }
    }

    // Fix issue ID format
    if (fixed.issue_id) {
      const match = fixed.issue_id.match(/(\d+)/);
      if (match) {
        const num = match[1].padStart(4, '0');
        fixed.issue_id = `ISS-${num}`;
      }
    }

    // Fix epic ID format
    if (fixed.epic_id) {
      const match = fixed.epic_id.match(/(\d+)/);
      if (match) {
        const num = match[1].padStart(4, '0');
        fixed.epic_id = `EP-${num}`;
      }
    }

    // Ensure required fields
    if (!fixed.status) fixed.status = 'planning';
    if (!fixed.pr_status) fixed.pr_status = 'draft';
    if (!fixed.priority) fixed.priority = 'medium';
    if (!fixed.assignee) fixed.assignee = 'unassigned';
    if (!fixed.created_date) fixed.created_date = new Date().toISOString();
    if (!fixed.updated_date) fixed.updated_date = new Date().toISOString();

    return fixed;
  }

  /**
   * Generate correct filename based on frontmatter
   */
  private generateCorrectFilename(frontmatter: AnyFrontmatter, type: 'epic' | 'issue' | 'task' | 'pr'): string {
    const slugify = (text: string): string => {
      return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-')      // Replace spaces with -
        .replace(/-+/g, '-')       // Replace multiple - with single -
        .trim();
    };

    switch (type) {
      case 'epic':
        const epic = frontmatter as EpicFrontmatter;
        return `${epic.epic_id}-${slugify(epic.title)}.md`;
      
      case 'issue':
        const issue = frontmatter as IssueFrontmatter;
        return `${issue.issue_id}-${slugify(issue.title)}.md`;
      
      case 'task':
        const task = frontmatter as TaskFrontmatter;
        return `${task.task_id}-${slugify(task.title)}.md`;
      
      case 'pr':
        const pr = frontmatter as PRFrontmatter;
        return `${pr.pr_id}-${slugify(pr.title)}.md`;
    }
  }

  /**
   * Check if frontmatter has changes
   */
  private hasFrontmatterChanges(original: AnyFrontmatter, fixed: AnyFrontmatter): boolean {
    return JSON.stringify(original) !== JSON.stringify(fixed);
  }
}