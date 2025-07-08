/**
 * Professional output formatters for CLI display
 */

import chalk from 'chalk';
// import type { GitHubIssue, GitHubLabel, GitHubMilestone, GitHubComment } from '../types/github.js'; // Removed GitHub dependencies
import type { FormatOptions } from '../types/commands.js';

export interface TableColumn {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  formatter?: (value: any) => string;
}

export interface ProgressBarOptions {
  width?: number;
  showPercentage?: boolean;
  showNumbers?: boolean;
  style?: 'block' | 'bar' | 'simple';
}

export class OutputFormatter {
  /**
   * Format issues as a table
   */
  public static formatIssuesTable(issues: GitHubIssue[], options: FormatOptions = {}): string {
    if (issues.length === 0) {
      return chalk.gray('No issues found.');
    }

    const columns: TableColumn[] = [
      {
        key: 'number',
        header: '#',
        width: 6,
        align: 'right',
        formatter: (num) => chalk.cyan(`#${num}`)
      },
      {
        key: 'title',
        header: 'Title',
        width: 50,
        formatter: (title, issue) => {
          const truncated = title.length > 47 ? title.substring(0, 44) + '...' : title;
          return issue.state === 'open' ? chalk.green(truncated) : chalk.red(truncated);
        }
      },
      {
        key: 'labels',
        header: 'Labels',
        width: 20,
        formatter: (labels) => {
          if (!labels || labels.length === 0) return chalk.gray('none');
          return labels.slice(0, 2).map((label: any) => 
            chalk.hex(`#${label.color}`).bold(label.name)
          ).join(' ') + (labels.length > 2 ? chalk.gray(` +${labels.length - 2}`) : '');
        }
      },
      {
        key: 'assignees',
        header: 'Assignee',
        width: 15,
        formatter: (assignees) => {
          if (!assignees || assignees.length === 0) return chalk.gray('unassigned');
          return assignees.slice(0, 1).map((user: any) => chalk.blue(user.login)).join(', ') +
                 (assignees.length > 1 ? chalk.gray(` +${assignees.length - 1}`) : '');
        }
      },
      {
        key: 'created_at',
        header: 'Created',
        width: 12,
        formatter: (date) => this.formatRelativeDate(date)
      }
    ];

    return this.formatTable(issues, columns, options);
  }

  /**
   * Format a single issue details
   */
  public static formatIssueDetails(issue: GitHubIssue, options: { comments?: boolean; reactions?: boolean } = {}): string {
    const lines: string[] = [];
    
    // Header
    lines.push(chalk.bold.cyan(`Issue #${issue.number}: ${issue.title}`));
    lines.push(chalk.gray('─'.repeat(80)));
    
    // Status and metadata
    const statusIcon = issue.state === 'open' ? chalk.green('●') : chalk.red('●');
    const stateReason = issue.state_reason ? ` (${issue.state_reason})` : '';
    lines.push(`${statusIcon} ${chalk.bold(issue.state.toUpperCase())}${stateReason}`);
    
    lines.push(`${chalk.bold('Author:')} ${chalk.blue(issue.user.login)}`);
    lines.push(`${chalk.bold('Created:')} ${this.formatAbsoluteDate(issue.created_at)}`);
    lines.push(`${chalk.bold('Updated:')} ${this.formatAbsoluteDate(issue.updated_at)}`);
    
    if (issue.closed_at) {
      lines.push(`${chalk.bold('Closed:')} ${this.formatAbsoluteDate(issue.closed_at)}`);
    }
    
    // Assignees
    if (issue.assignees && issue.assignees.length > 0) {
      const assigneesList = issue.assignees.map(user => chalk.blue(user.login)).join(', ');
      lines.push(`${chalk.bold('Assignees:')} ${assigneesList}`);
    }
    
    // Labels
    if (issue.labels && issue.labels.length > 0) {
      const labelsList = issue.labels.map(label => 
        chalk.hex(`#${label.color}`).bold(label.name)
      ).join(' ');
      lines.push(`${chalk.bold('Labels:')} ${labelsList}`);
    }
    
    // Milestone
    if (issue.milestone) {
      lines.push(`${chalk.bold('Milestone:')} ${chalk.yellow(issue.milestone.title)}`);
    }
    
    // Comments count
    if (issue.comments > 0) {
      lines.push(`${chalk.bold('Comments:')} ${issue.comments}`);
    }
    
    // Reactions
    if (options.reactions && issue.reactions && issue.reactions.total_count > 0) {
      const reactions = this.formatReactions(issue.reactions);
      if (reactions) {
        lines.push(`${chalk.bold('Reactions:')} ${reactions}`);
      }
    }
    
    // Body
    if (issue.body) {
      lines.push('');
      lines.push(chalk.bold('Description:'));
      lines.push(this.formatMarkdown(issue.body));
    }
    
    // URLs
    lines.push('');
    lines.push(chalk.gray(`Web: ${issue.html_url}`));
    lines.push(chalk.gray(`API: ${issue.url}`));
    
    return lines.join('\n');
  }

  /**
   * Format labels as a table
   */
  public static formatLabelsTable(labels: GitHubLabel[], options: FormatOptions = {}): string {
    if (labels.length === 0) {
      return chalk.gray('No labels found.');
    }

    const columns: TableColumn[] = [
      {
        key: 'name',
        header: 'Name',
        width: 25,
        formatter: (name, label) => chalk.hex(`#${label.color}`).bold(name)
      },
      {
        key: 'description',
        header: 'Description',
        width: 40,
        formatter: (desc) => desc ? chalk.gray(desc) : chalk.gray('no description')
      },
      {
        key: 'color',
        header: 'Color',
        width: 10,
        formatter: (color) => chalk.hex(`#${color}`).bold(`#${color}`)
      },
      {
        key: 'default',
        header: 'Default',
        width: 8,
        formatter: (isDefault) => isDefault ? chalk.green('✓') : chalk.gray('✗')
      }
    ];

    return this.formatTable(labels, columns, options);
  }

  /**
   * Format milestones as a table
   */
  public static formatMilestonesTable(milestones: GitHubMilestone[], options: FormatOptions = {}): string {
    if (milestones.length === 0) {
      return chalk.gray('No milestones found.');
    }

    const columns: TableColumn[] = [
      {
        key: 'title',
        header: 'Title',
        width: 25,
        formatter: (title, milestone) => {
          const color = milestone.state === 'open' ? chalk.green : chalk.gray;
          return color.bold(title);
        }
      },
      {
        key: 'description',
        header: 'Description',
        width: 30,
        formatter: (desc) => desc ? chalk.gray(desc.substring(0, 27) + (desc.length > 27 ? '...' : '')) : chalk.gray('no description')
      },
      {
        key: 'progress',
        header: 'Progress',
        width: 20,
        formatter: (_, milestone) => {
          const total = milestone.open_issues + milestone.closed_issues;
          if (total === 0) return chalk.gray('no issues');
          
          const percentage = Math.round((milestone.closed_issues / total) * 100);
          return this.formatProgressBar(percentage, { width: 15, showPercentage: true });
        }
      },
      {
        key: 'due_on',
        header: 'Due Date',
        width: 12,
        formatter: (dueDate) => dueDate ? this.formatRelativeDate(dueDate) : chalk.gray('no due date')
      }
    ];

    return this.formatTable(milestones, columns, options);
  }

  /**
   * Format milestone progress with detailed information
   */
  public static formatMilestoneProgress(milestone: GitHubMilestone, options: { detailed?: boolean; chart?: boolean } = {}): string {
    const lines: string[] = [];
    
    // Header
    lines.push(chalk.bold.yellow(`Milestone: ${milestone.title}`));
    lines.push(chalk.gray('─'.repeat(50)));
    
    const total = milestone.open_issues + milestone.closed_issues;
    const percentage = total > 0 ? Math.round((milestone.closed_issues / total) * 100) : 0;
    
    // Progress bar
    const progressBar = this.formatProgressBar(percentage, { 
      width: 30, 
      showPercentage: true, 
      showNumbers: true 
    });
    lines.push(`Progress: ${progressBar}`);
    
    // Statistics
    lines.push(`${chalk.green('Closed:')} ${milestone.closed_issues}`);
    lines.push(`${chalk.red('Open:')} ${milestone.open_issues}`);
    lines.push(`${chalk.blue('Total:')} ${total}`);
    
    // Due date
    if (milestone.due_on) {
      const dueDate = new Date(milestone.due_on);
      const now = new Date();
      const isOverdue = dueDate < now && milestone.state === 'open';
      
      if (isOverdue) {
        lines.push(`${chalk.bold('Due:')} ${chalk.red('OVERDUE')} (${this.formatAbsoluteDate(milestone.due_on)})`);
      } else {
        lines.push(`${chalk.bold('Due:')} ${this.formatAbsoluteDate(milestone.due_on)}`);
      }
    }
    
    // Description
    if (milestone.description) {
      lines.push('');
      lines.push(chalk.bold('Description:'));
      lines.push(chalk.gray(milestone.description));
    }
    
    // Detailed breakdown
    if (options.detailed && total > 0) {
      lines.push('');
      lines.push(chalk.bold('Statistics:'));
      lines.push(`Completion Rate: ${percentage}%`);
      
      if (milestone.state === 'open' && milestone.due_on) {
        const dueDate = new Date(milestone.due_on);
        const now = new Date();
        const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining > 0) {
          lines.push(`Days Remaining: ${daysRemaining}`);
          if (milestone.open_issues > 0) {
            const issuesPerDay = milestone.open_issues / daysRemaining;
            lines.push(`Required Velocity: ${issuesPerDay.toFixed(1)} issues/day`);
          }
        }
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Format comments as a list
   */
  public static formatCommentsList(comments: GitHubComment[], options: FormatOptions = {}): string {
    if (comments.length === 0) {
      return chalk.gray('No comments found.');
    }

    const lines: string[] = [];
    
    comments.forEach((comment, index) => {
      if (index > 0) lines.push('');
      
      // Comment header
      const header = `${chalk.blue.bold(comment.user.login)} • ${this.formatRelativeDate(comment.created_at)}`;
      lines.push(header);
      lines.push(chalk.gray('─'.repeat(header.length)));
      
      // Comment body
      if (comment.body) {
        lines.push(this.formatMarkdown(comment.body));
      }
      
      // Reactions
      if (comment.reactions && comment.reactions.total_count > 0) {
        const reactions = this.formatReactions(comment.reactions);
        if (reactions) {
          lines.push('');
          lines.push(chalk.gray(`Reactions: ${reactions}`));
        }
      }
    });
    
    return lines.join('\n');
  }

  /**
   * Format data as JSON
   */
  public static formatJSON(data: any, options: { pretty?: boolean } = {}): string {
    if (options.pretty) {
      return JSON.stringify(data, null, 2);
    }
    return JSON.stringify(data);
  }

  /**
   * Format data as YAML
   */
  public static formatYAML(data: any): string {
    // Simple YAML formatter - in production, use a proper YAML library
    return JSON.stringify(data, null, 2)
      .replace(/"/g, '')
      .replace(/,$/gm, '')
      .replace(/^\s*{\s*$/gm, '')
      .replace(/^\s*}\s*$/gm, '');
  }

  /**
   * Format data as CSV
   */
  public static formatCSV(data: any[], headers?: string[]): string {
    if (data.length === 0) return '';
    
    const keys = headers || Object.keys(data[0]);
    const lines: string[] = [];
    
    // Add header
    lines.push(keys.map(key => `"${key}"`).join(','));
    
    // Add data rows
    data.forEach(item => {
      const row = keys.map(key => {
        const value = item[key];
        if (value === null || value === undefined) return '""';
        if (typeof value === 'object') return `"${JSON.stringify(value)}"`;
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      lines.push(row.join(','));
    });
    
    return lines.join('\n');
  }

  // Private helper methods
  private static formatTable(data: any[], columns: TableColumn[], options: FormatOptions): string {
    if (data.length === 0) return '';
    
    const lines: string[] = [];
    
    // Header
    if (!options.noHeader) {
      const headerRow = columns.map(col => {
        const header = col.header.padEnd(col.width || 20);
        return chalk.bold.cyan(header);
      }).join(' ');
      lines.push(headerRow);
      
      const separator = columns.map(col => 
        '─'.repeat(col.width || 20)
      ).join(' ');
      lines.push(chalk.gray(separator));
    }
    
    // Data rows
    data.forEach(item => {
      const row = columns.map(col => {
        const value = this.getNestedProperty(item, col.key);
        let formatted = col.formatter ? col.formatter(value, item) : String(value || '');
        
        // Strip ANSI codes for width calculation
        const plainText = formatted.replace(/\u001b\[[0-9;]*m/g, '');
        const width = col.width || 20;
        
        if (plainText.length > width) {
          // Truncate while preserving ANSI codes
          const excess = plainText.length - width + 3; // +3 for '...'
          formatted = formatted.substring(0, formatted.length - excess) + '...';
        } else {
          // Pad to width
          const padding = ' '.repeat(width - plainText.length);
          formatted += padding;
        }
        
        return formatted;
      }).join(' ');
      
      lines.push(row);
    });
    
    return lines.join('\n');
  }

  private static formatProgressBar(percentage: number, options: ProgressBarOptions = {}): string {
    const width = options.width || 20;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    
    let result = `[${bar}]`;
    
    if (options.showPercentage) {
      result += ` ${percentage}%`;
    }
    
    return result;
  }

  private static formatRelativeDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffDays > 0) {
      return chalk.gray(`${diffDays}d ago`);
    } else if (diffHours > 0) {
      return chalk.gray(`${diffHours}h ago`);
    } else if (diffMinutes > 0) {
      return chalk.gray(`${diffMinutes}m ago`);
    } else {
      return chalk.gray('now');
    }
  }

  private static formatAbsoluteDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  private static formatReactions(reactions: any): string {
    const reactionEmojis: Record<string, string> = {
      '+1': '👍',
      '-1': '👎',
      'laugh': '😄',
      'hooray': '🎉',
      'confused': '😕',
      'heart': '❤️',
      'rocket': '🚀',
      'eyes': '👀'
    };
    
    const parts: string[] = [];
    
    Object.entries(reactions).forEach(([key, count]) => {
      if (key !== 'url' && key !== 'total_count' && count && Number(count) > 0) {
        const emoji = reactionEmojis[key] || key;
        parts.push(`${emoji} ${count}`);
      }
    });
    
    return parts.join(' ');
  }

  private static formatMarkdown(text: string): string {
    // Simple markdown formatting for terminal
    return text
      .replace(/\*\*(.*?)\*\*/g, chalk.bold('$1'))
      .replace(/\*(.*?)\*/g, chalk.italic('$1'))
      .replace(/`(.*?)`/g, chalk.cyan('$1'))
      .replace(/^#\s+(.*$)/gm, chalk.bold.yellow('$1'))
      .replace(/^##\s+(.*$)/gm, chalk.bold.blue('$1'))
      .replace(/^>\s+(.*$)/gm, chalk.gray('│ $1'));
  }

  private static getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

// Utility functions for common formatting operations
export function formatError(message: string): string {
  return chalk.red.bold('Error: ') + chalk.red(message);
}

export function formatWarning(message: string): string {
  return chalk.yellow.bold('Warning: ') + chalk.yellow(message);
}

export function formatSuccess(message: string): string {
  return chalk.green.bold('Success: ') + chalk.green(message);
}

export function formatInfo(message: string): string {
  return chalk.blue.bold('Info: ') + chalk.blue(message);
}

export function formatDebug(message: string): string {
  return chalk.gray.bold('Debug: ') + chalk.gray(message);
}

export function formatSpinner(message: string): string {
  return chalk.cyan('◐ ') + message;
}

export function formatCheckmark(message: string): string {
  return chalk.green('✓ ') + message;
}

export function formatCross(message: string): string {
  return chalk.red('✗ ') + message;
}

export function formatBullet(message: string): string {
  return chalk.blue('• ') + message;
}

export function formatBadge(text: string, color: 'red' | 'green' | 'blue' | 'yellow' | 'gray' = 'blue'): string {
  const colors = {
    red: chalk.red.bold,
    green: chalk.green.bold,
    blue: chalk.blue.bold,
    yellow: chalk.yellow.bold,
    gray: chalk.gray.bold
  };
  
  return colors[color](`[${text}]`);
}