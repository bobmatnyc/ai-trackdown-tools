/**
 * Task List Command
 * Lists tasks with filtering and sorting options
 */

import { Command } from 'commander';
import type { ItemStatus, Priority, SearchFilters } from '../../types/ai-trackdown.js';
import { isTaskData } from '../../types/ai-trackdown.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';

interface ListOptions {
  status?: string;
  priority?: string;
  assignee?: string;
  issue?: string;
  epic?: string;
  tags?: string;
  search?: string;
  format?: 'table' | 'json' | 'yaml';
  sortBy?: 'created' | 'updated' | 'title' | 'priority' | 'status';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  showTime?: boolean;
}

export function createTaskListCommand(): Command {
  const cmd = new Command('list');

  cmd
    .description('List tasks with filtering options')
    .option('-s, --status <statuses>', 'filter by status (comma-separated)')
    .option('-p, --priority <priorities>', 'filter by priority (comma-separated)')
    .option('-a, --assignee <username>', 'filter by assignee')
    .option('-i, --issue <issue-id>', 'filter by issue ID')
    .option('-e, --epic <epic-id>', 'filter by epic ID')
    .option('-t, --tags <tags>', 'filter by tags (comma-separated)')
    .option('--search <term>', 'search in title, description, and content')
    .option('-f, --format <type>', 'output format (table|json|yaml)', 'table')
    .option('--sort-by <field>', 'sort by field (created|updated|title|priority|status)', 'created')
    .option('--sort-order <order>', 'sort order (asc|desc)', 'desc')
    .option('-l, --limit <number>', 'limit number of results')
    .option('--show-time', 'show time estimates and spent')
    .action(async (options: ListOptions) => {
      try {
        await listTasks(options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to list tasks: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function listTasks(options: ListOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();

  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR; // Set by parent command

  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);
  const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);

  // Build search filters
  const filters: SearchFilters = {};

  if (options.status) {
    const statuses = options.status.split(',').map((s) => s.trim()) as ItemStatus[];
    filters.status = statuses.length === 1 ? statuses[0] : statuses;
  }

  if (options.priority) {
    const priorities = options.priority.split(',').map((p) => p.trim()) as Priority[];
    filters.priority = priorities.length === 1 ? priorities[0] : priorities;
  }

  if (options.assignee) {
    filters.assignee = options.assignee;
  }

  if (options.tags) {
    const tags = options.tags.split(',').map((t) => t.trim());
    filters.tags = tags.length === 1 ? tags[0] : tags;
  }

  if (options.search) {
    filters.content_search = options.search;
  }

  // Search for items
  const searchResult = relationshipManager.search(filters);

  // Filter to only tasks
  let tasks = searchResult.items.filter(isTaskData);

  // Additional filtering for issue/epic
  if (options.issue) {
    tasks = tasks.filter((task) => task.issue_id === options.issue);
  }

  if (options.epic) {
    tasks = tasks.filter((task) => task.epic_id === options.epic);
  }

  // Sort tasks
  sortTasks(tasks, options.sortBy || 'created', options.sortOrder || 'desc');

  // Apply limit
  if (options.limit) {
    const limit = parseInt(options.limit.toString(), 10);
    tasks = tasks.slice(0, limit);
  }

  // Output results
  switch (options.format) {
    case 'json':
      console.log(JSON.stringify(tasks, null, 2));
      break;
    case 'yaml': {
      const YAML = await import('yaml');
      console.log(YAML.stringify(tasks));
      break;
    }
    default:
      await displayTasksTable(tasks, options);
  }
}

function sortTasks(tasks: any[], sortBy: string, sortOrder: string): void {
  tasks.sort((a, b) => {
    let aVal: any, bVal: any;

    switch (sortBy) {
      case 'created':
        aVal = new Date(a.created_date);
        bVal = new Date(b.created_date);
        break;
      case 'updated':
        aVal = new Date(a.updated_date);
        bVal = new Date(b.updated_date);
        break;
      case 'title':
        aVal = a.title.toLowerCase();
        bVal = b.title.toLowerCase();
        break;
      case 'priority': {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        aVal = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
        bVal = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
        break;
      }
      case 'status': {
        const statusOrder = { active: 4, planning: 3, completed: 2, archived: 1 };
        aVal = statusOrder[a.status as keyof typeof statusOrder] || 0;
        bVal = statusOrder[b.status as keyof typeof statusOrder] || 0;
        break;
      }
      default:
        aVal = a.created_date;
        bVal = b.created_date;
    }

    if (sortOrder === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });
}

async function displayTasksTable(tasks: any[], options: ListOptions): Promise<void> {
  if (tasks.length === 0) {
    console.log(Formatter.info('No tasks found matching the criteria.'));
    return;
  }

  console.log(Formatter.success(`Found ${tasks.length} task(s):`));
  console.log('');

  // Table headers
  const headers = ['ID', 'Title', 'Status', 'Priority', 'Issue', 'Assignee'];
  if (options.showTime) {
    headers.push('Time Est.');
    headers.push('Time Spent');
  }
  headers.push('Created');

  // Calculate column widths
  const colWidths = headers.map(() => 0);

  // Prepare rows data
  const rows: string[][] = [];

  for (const task of tasks) {
    const row = [
      task.task_id,
      truncateText(task.title, 30),
      getStatusDisplay(task.status),
      getPriorityDisplay(task.priority),
      task.issue_id,
      truncateText(task.assignee, 15),
    ];

    if (options.showTime) {
      row.push(task.time_estimate || '-');
      row.push(task.time_spent || '-');
    }

    row.push(formatDate(task.created_date));
    rows.push(row);
  }

  // Calculate column widths
  for (let i = 0; i < headers.length; i++) {
    colWidths[i] = Math.max(headers[i].length, ...rows.map((row) => row[i].length));
  }

  // Print table
  printTableRow(headers, colWidths, true);
  printSeparator(colWidths);

  for (const row of rows) {
    printTableRow(row, colWidths, false);
  }

  console.log('');
  console.log(Formatter.info(`Total: ${tasks.length} task(s)`));
}

function printTableRow(row: string[], widths: number[], isHeader: boolean): void {
  const paddedRow = row.map((cell, i) => cell.padEnd(widths[i]));
  const rowText = paddedRow.join(' | ');

  if (isHeader) {
    console.log(Formatter.info(rowText));
  } else {
    console.log(rowText);
  }
}

function printSeparator(widths: number[]): void {
  const separator = widths.map((width) => '-'.repeat(width)).join('-+-');
  console.log(separator);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}

function getStatusDisplay(status: string): string {
  const statusColors: Record<string, (text: string) => string> = {
    planning: (text) => Formatter.info(text),
    active: (text) => Formatter.success(text),
    completed: (text) => Formatter.success(text),
    archived: (text) => Formatter.debug(text),
  };

  const colorFn = statusColors[status] || ((text) => text);
  return colorFn(status.toUpperCase());
}

function getPriorityDisplay(priority: string): string {
  const priorityColors: Record<string, (text: string) => string> = {
    critical: (text) => Formatter.error(text),
    high: (text) => Formatter.warning(text),
    medium: (text) => Formatter.info(text),
    low: (text) => Formatter.debug(text),
  };

  const colorFn = priorityColors[priority] || ((text) => text);
  return colorFn(priority.toUpperCase());
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString();
}
