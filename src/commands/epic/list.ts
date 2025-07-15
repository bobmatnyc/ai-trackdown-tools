/**
 * Epic List Command
 * Lists epics with filtering and sorting options with project context support
 */

import { Command } from 'commander';
import type { ItemStatus, Priority, SearchFilters } from '../../types/ai-trackdown.js';
import { isEpicData } from '../../types/ai-trackdown.js';
import { Formatter } from '../../utils/formatter.js';
import { ProjectContextManager } from '../../utils/project-context-manager.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';

interface ListOptions {
  status?: string;
  priority?: string;
  assignee?: string;
  tags?: string;
  labels?: string;
  milestone?: string;
  search?: string;
  format?: 'table' | 'json' | 'yaml';
  sortBy?: 'created' | 'updated' | 'title' | 'priority' | 'status';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  showProgress?: boolean;
  showIssues?: boolean;
  showProject?: boolean;
  active?: boolean;
  project?: string;
}

export function createEpicListCommand(): Command {
  const cmd = new Command('list');

  cmd
    .description('List epics with filtering options')
    .option('-s, --status <statuses>', 'filter by status (comma-separated)')
    .option('-p, --priority <priorities>', 'filter by priority (comma-separated)')
    .option('-a, --assignee <username>', 'filter by assignee')
    .option('-t, --tags <tags>', 'filter by tags (comma-separated)')
    .option('--labels <labels>', 'filter by labels (comma-separated, alias for --tags)')
    .option('-m, --milestone <name>', 'filter by milestone')
    .option('--search <term>', 'search in title, description, and content')
    .option('-f, --format <type>', 'output format (table|json|yaml)', 'table')
    .option('--sort-by <field>', 'sort by field (created|updated|title|priority|status)', 'created')
    .option('--sort-order <order>', 'sort order (asc|desc)', 'desc')
    .option('-l, --limit <number>', 'limit number of results')
    .option('--show-progress', 'show completion progress')
    .option('--show-issues', 'show related issues count')
    .option('--show-project', 'show project information')
    .option('--active', 'show only active epics (equivalent to --status active)')
    .option('--project <name>', 'filter by project (for multi-project mode)')
    .action(async (options: ListOptions) => {
      try {
        await listEpics(options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to list epics: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function listEpics(options: ListOptions): Promise<void> {
  // Initialize project context manager
  const contextManager = new ProjectContextManager();

  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR; // Set by parent command

  // Initialize project context
  const projectContext = await contextManager.initializeContext(options.project);

  // Get managers and paths from context
  const configManager = projectContext.configManager;
  const config = configManager.getConfig();
  const paths = projectContext.paths;
  const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);

  // Build search filters
  const filters: SearchFilters = {};

  if (options.active) {
    filters.status = 'active';
  } else if (options.status) {
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

  if (options.tags || options.labels) {
    const tagsInput = options.tags || options.labels;
    const tags = tagsInput.split(',').map((t) => t.trim());
    filters.tags = tags.length === 1 ? tags[0] : tags;
  }

  if (options.search) {
    filters.content_search = options.search;
  }

  // Search for items
  const searchResult = relationshipManager.search(filters);

  // Filter to only epics
  const epics = searchResult.items.filter(isEpicData);

  // Additional filtering for milestone (not in search filters yet)
  let filteredEpics = epics;
  if (options.milestone) {
    filteredEpics = epics.filter((epic) => epic.milestone === options.milestone);
  }

  // Sort epics
  sortEpics(filteredEpics, options.sortBy || 'created', options.sortOrder || 'desc');

  // Apply limit
  if (options.limit) {
    const limit = parseInt(options.limit.toString(), 10);
    filteredEpics = filteredEpics.slice(0, limit);
  }

  // Output results
  switch (options.format) {
    case 'json':
      console.log(JSON.stringify(filteredEpics, null, 2));
      break;
    case 'yaml': {
      const YAML = await import('yaml');
      console.log(YAML.stringify(filteredEpics));
      break;
    }
    default:
      await displayEpicsTable(filteredEpics, options, relationshipManager, projectContext);
  }
}

function sortEpics(epics: any[], sortBy: string, sortOrder: string): void {
  epics.sort((a, b) => {
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

async function displayEpicsTable(
  epics: any[],
  options: ListOptions,
  relationshipManager: RelationshipManager,
  projectContext: any
): Promise<void> {
  if (epics.length === 0) {
    console.log(Formatter.info('No epics found matching the criteria.'));
    return;
  }

  // Show project context information
  if (projectContext.context.mode === 'multi' && projectContext.context.currentProject) {
    console.log(Formatter.info(`📋 Project: ${projectContext.context.currentProject}`));
  }

  console.log(Formatter.success(`Found ${epics.length} epic(s):`));
  console.log('');

  // Table headers
  const headers = ['ID', 'Title', 'Status', 'Priority', 'Assignee'];
  if (options.showProject) headers.push('Project');
  if (options.showProgress) headers.push('Progress');
  if (options.showIssues) headers.push('Issues');
  headers.push('Created');

  // Calculate column widths
  const colWidths = headers.map(() => 0);

  // Prepare rows data
  const rows: string[][] = [];

  for (const epic of epics) {
    const row = [
      epic.epic_id,
      truncateText(epic.title, 40),
      getStatusDisplay(epic.status),
      getPriorityDisplay(epic.priority),
      epic.assignee,
    ];

    if (options.showProject) {
      row.push(epic.project_id || '-');
    }

    if (options.showProgress) {
      const progress = epic.completion_percentage || 0;
      row.push(`${progress}%`);
    }

    if (options.showIssues) {
      const hierarchy = relationshipManager.getEpicHierarchy(epic.epic_id);
      const issueCount = hierarchy ? hierarchy.issues.length : 0;
      row.push(issueCount.toString());
    }

    row.push(formatDate(epic.created_date));
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
  console.log(Formatter.info(`Total: ${epics.length} epic(s)`));
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
