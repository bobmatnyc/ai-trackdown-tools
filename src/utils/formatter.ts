import chalk from 'chalk';
import boxen from 'boxen';
import figlet from 'figlet';
import type { LogLevel, TrackdownItem, StatusFilter } from '../types/index.js';
import { colors, ColorTheme } from './colors.js';

export class Formatter {
  static success(message: string): string {
    return colors.success(`✅ ${message}`);
  }

  static error(message: string): string {
    return colors.error(`❌ ${message}`);
  }

  static warning(message: string): string {
    return colors.warning(`⚠️  ${message}`);
  }

  static info(message: string): string {
    return colors.info(`ℹ️  ${message}`);
  }

  static debug(message: string): string {
    return colors.muted(`🔍 ${message}`);
  }

  static header(text: string): string {
    return ColorTheme.header(text);
  }

  static subheader(text: string): string {
    return ColorTheme.subheader(text);
  }

  static highlight(text: string): string {
    return colors.highlight(text);
  }

  static dim(text: string): string {
    return colors.muted(text);
  }

  // Enhanced banner for CLI startup
  static banner(text: string): string {
    try {
      const ascii = figlet.textSync(text, {
        font: 'ANSI Shadow',
        horizontalLayout: 'default',
        verticalLayout: 'default',
        width: 80,
        whitespaceBreak: true
      });
      return colors.primary(ascii);
    } catch {
      // Fallback if figlet fails
      return ColorTheme.header(text);
    }
  }

  // Create beautiful notification boxes
  static box(message: string, variant: 'info' | 'success' | 'warning' | 'error' = 'info'): string {
    const borderColors = {
      info: 'cyan',
      success: 'green',
      warning: 'yellow',
      error: 'red'
    };

    return boxen(message, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: borderColors[variant],
      backgroundColor: undefined
    });
  }

  // Professional item formatting with enhanced styling
  static formatItem(item: TrackdownItem, format: 'compact' | 'detailed' = 'detailed'): string {
    const statusBadge = ColorTheme.badge(item.status.toUpperCase(), this.getStatusVariant(item.status));
    const priorityBadge = ColorTheme.badge(item.priority.toUpperCase(), this.getPriorityVariant(item.priority));

    if (format === 'compact') {
      return [
        `${statusBadge} ${priorityBadge} ${colors.highlight(item.title)}`,
        colors.muted(`ID: ${item.id}`),
        item.assignee ? colors.info(`@${item.assignee}`) : '',
        item.tags?.length ? colors.muted(`[${item.tags.join(', ')}]`) : '',
      ].filter(Boolean).join(' ');
    }

    const sections = [
      `${statusBadge} ${priorityBadge}`,
      colors.highlight(item.title),
      colors.muted(`ID: ${item.id}`),
      item.assignee ? colors.info(`👤 Assignee: ${item.assignee}`) : '',
      item.description ? colors.muted(`📝 ${item.description}`) : '',
      item.estimate ? colors.warning(`📊 ${item.estimate} story points`) : '',
      item.tags?.length ? colors.primary(`🏷️  Tags: ${item.tags.join(', ')}`) : '',
      ColorTheme.timestamp(item.createdAt),
    ];

    return sections.filter(Boolean).join('\n');
  }

  // Enhanced list formatting with statistics
  static formatList(items: TrackdownItem[], showStats = true): string {
    if (items.length === 0) {
      return this.box('No items found', 'info');
    }

    const formatted = items
      .map((item, index) => {
        const prefix = colors.muted(`${(index + 1).toString().padStart(2, ' ')}. `);
        return `${prefix}${this.formatItem(item, 'compact')}`;
      })
      .join('\n');

    if (!showStats) {
      return formatted;
    }

    const stats = this.generateStats(items);
    return `${formatted}\n\n${stats}`;
  }

  // Generate item statistics
  static generateStats(items: TrackdownItem[]): string {
    const total = items.length;
    const byStatus = this.groupBy(items, 'status');
    const byPriority = this.groupBy(items, 'priority');

    const statusSection = Object.entries(byStatus)
      .map(([status, count]) => {
        const color = ColorTheme.status(status);
        return color(`${status}: ${count}`);
      })
      .join(' | ');

    const prioritySection = Object.entries(byPriority)
      .map(([priority, count]) => {
        const color = ColorTheme.priority(priority);
        return color(`${priority}: ${count}`);
      })
      .join(' | ');

    return [
      ColorTheme.separator(),
      colors.highlight(`📊 Statistics (${total} total)`),
      `Status: ${statusSection}`,
      `Priority: ${prioritySection}`,
      ColorTheme.separator(),
    ].join('\n');
  }

  // Enhanced table formatting
  static formatTable(items: TrackdownItem[]): string {
    if (items.length === 0) {
      return this.box('No items found', 'info');
    }

    const headers = ['ID', 'Title', 'Status', 'Priority', 'Assignee', 'Tags'];
    const maxWidths = this.calculateColumnWidths(items, headers);

    const headerRow = headers
      .map((header, i) => colors.highlight(header.padEnd(maxWidths[i])))
      .join(' | ');

    const separator = ColorTheme.separator('─', headerRow.length);

    const rows = items.map(item => {
      const cells = [
        item.id,
        item.title.length > 30 ? item.title.substring(0, 27) + '...' : item.title,
        item.status,
        item.priority,
        item.assignee || 'unassigned',
        item.tags?.join(', ') || '',
      ];

      return cells
        .map((cell, i) => {
          const colored = i === 2 ? ColorTheme.status(cell)(cell) :
                        i === 3 ? ColorTheme.priority(cell)(cell) :
                        cell;
          return colored.padEnd(maxWidths[i]);
        })
        .join(' | ');
    });

    return [headerRow, separator, ...rows].join('\n');
  }

  // Format export output
  static formatExport(items: TrackdownItem[], format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(items, null, 2);
      case 'csv':
        return this.formatCSV(items);
      case 'yaml':
        // Would need yaml package import
        return this.formatYAML(items);
      case 'markdown':
        return this.formatMarkdown(items);
      default:
        return this.formatTable(items);
    }
  }

  // Enhanced help formatting
  static formatHelp(command: string, description: string, usage: string, options: Array<{flag: string, description: string}>, examples: string[]): string {
    const sections = [
      ColorTheme.header(`${command.toUpperCase()} COMMAND`),
      `${colors.info('Description:')} ${description}`,
      '',
      `${colors.info('Usage:')} ${ColorTheme.command(usage)}`,
      '',
      colors.info('Options:'),
      ...options.map(opt => `  ${ColorTheme.option(opt.flag.padEnd(20))} ${opt.description}`),
      '',
      colors.info('Examples:'),
      ...examples.map(ex => `  ${colors.muted('$')} ${ex}`),
    ];

    return sections.join('\n');
  }

  // Enhanced logging with context
  static log(level: LogLevel, message: string, context?: Record<string, any>): void {
    const timestamp = ColorTheme.timestamp(new Date());
    const contextStr = context ? ` ${colors.muted(JSON.stringify(context))}` : '';

    switch (level) {
      case 'debug':
        console.log(`${timestamp} ${this.debug(message)}${contextStr}`);
        break;
      case 'info':
        console.log(`${timestamp} ${this.info(message)}${contextStr}`);
        break;
      case 'warn':
        console.warn(`${timestamp} ${this.warning(message)}${contextStr}`);
        break;
      case 'error':
        console.error(`${timestamp} ${this.error(message)}${contextStr}`);
        break;
    }
  }

  // Helper methods
  private static getStatusVariant(status: string): 'info' | 'success' | 'warning' | 'error' {
    switch (status) {
      case 'done': return 'success';
      case 'blocked': return 'error';
      case 'in-progress': return 'warning';
      default: return 'info';
    }
  }

  private static getPriorityVariant(priority: string): 'info' | 'success' | 'warning' | 'error' {
    switch (priority) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'success';
    }
  }

  private static groupBy<T>(items: T[], key: keyof T): Record<string, number> {
    return items.reduce((acc, item) => {
      const value = String(item[key]);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private static calculateColumnWidths(items: TrackdownItem[], headers: string[]): number[] {
    const rows = items.map(item => [
      item.id,
      item.title.length > 30 ? item.title.substring(0, 27) + '...' : item.title,
      item.status,
      item.priority,
      item.assignee || 'unassigned',
      item.tags?.join(', ') || '',
    ]);

    return headers.map((header, i) => {
      const columnValues = [header, ...rows.map(row => row[i])];
      return Math.max(...columnValues.map(val => val.length)) + 2;
    });
  }

  private static formatCSV(items: TrackdownItem[]): string {
    const headers = ['ID', 'Title', 'Description', 'Status', 'Priority', 'Assignee', 'Created', 'Updated', 'Tags'];
    const rows = items.map(item => [
      item.id,
      `"${item.title.replace(/"/g, '""')}"`,
      `"${(item.description || '').replace(/"/g, '""')}"`,
      item.status,
      item.priority,
      item.assignee || '',
      item.createdAt.toISOString(),
      item.updatedAt.toISOString(),
      `"${(item.tags || []).join(', ')}"`,
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private static formatYAML(items: TrackdownItem[]): string {
    // Basic YAML formatting - would be better with yaml package
    return items.map(item => {
      return [
        `- id: ${item.id}`,
        `  title: "${item.title}"`,
        `  description: "${item.description || ''}"`,
        `  status: ${item.status}`,
        `  priority: ${item.priority}`,
        `  assignee: ${item.assignee || ''}`,
        `  created: ${item.createdAt.toISOString()}`,
        `  updated: ${item.updatedAt.toISOString()}`,
        `  tags: [${(item.tags || []).map(t => `"${t}"`).join(', ')}]`,
      ].join('\n');
    }).join('\n');
  }

  private static formatMarkdown(items: TrackdownItem[]): string {
    const table = [
      '| ID | Title | Status | Priority | Assignee | Tags |',
      '|---|---|---|---|---|---|',
      ...items.map(item => 
        `| ${item.id} | ${item.title} | ${item.status} | ${item.priority} | ${item.assignee || ''} | ${(item.tags || []).join(', ')} |`
      )
    ].join('\n');

    return `# Trackdown Items\n\n${table}\n\n*Generated at ${new Date().toISOString()}*`;
  }
}
