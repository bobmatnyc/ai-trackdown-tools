/**
 * Issue List Command
 * Lists issues with filtering and sorting options
 */

import { Command } from 'commander';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';

interface ListOptions {
  status?: string;
  priority?: string;
  assignee?: string;
  epic?: string;
  tags?: string[];
  format?: 'table' | 'json' | 'yaml';
  limit?: number;
  offset?: number;
  active?: boolean;
}

export function createIssueListCommand(): Command {
  const cmd = new Command('list');

  cmd
    .description('List issues with filtering options')
    .option('--status <status>', 'filter by status (todo|in-progress|done|blocked)')
    .option('--priority <priority>', 'filter by priority (low|medium|high|critical)')
    .option('--assignee <assignee>', 'filter by assignee')
    .option('--epic <epic-id>', 'filter by epic ID')
    .option('--tags <tags...>', 'filter by tags')
    .option('-f, --format <type>', 'output format (table|json|yaml)', 'table')
    .option('--limit <number>', 'limit number of results', '50')
    .option('--offset <number>', 'offset for pagination', '0')
    .option('--active', 'show only active issues (equivalent to --status active)')
    .action(async (options: ListOptions) => {
      try {
        await listIssues(options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to list issues: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function listIssues(options: ListOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();

  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR;

  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);
  const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);

  // Get all issues
  let issues = relationshipManager.getAllIssues();

  // Apply filters
  if (options.active) {
    issues = issues.filter((issue) => issue.status === 'active');
  } else if (options.status) {
    issues = issues.filter((issue) => issue.status === options.status);
  }

  if (options.priority) {
    issues = issues.filter((issue) => issue.priority === options.priority);
  }

  if (options.assignee) {
    issues = issues.filter((issue) => issue.assignee === options.assignee);
  }

  if (options.epic) {
    issues = issues.filter((issue) => issue.epic_id === options.epic);
  }

  if (options.tags && options.tags.length > 0) {
    issues = issues.filter(
      (issue) => issue.tags && options.tags?.some((tag) => issue.tags.includes(tag))
    );
  }

  // Apply pagination
  const limit = parseInt(options.limit || '50');
  const offset = parseInt(options.offset || '0');
  const paginatedIssues = issues.slice(offset, offset + limit);

  // Output based on format
  switch (options.format) {
    case 'json':
      console.log(JSON.stringify(paginatedIssues, null, 2));
      break;

    case 'yaml': {
      const YAML = await import('yaml');
      console.log(YAML.stringify(paginatedIssues));
      break;
    }

    default:
      await displayIssuesTable(paginatedIssues, issues.length, offset, limit);
  }
}

async function displayIssuesTable(
  issues: any[],
  totalCount: number,
  offset: number,
  limit: number
): Promise<void> {
  if (issues.length === 0) {
    console.log(Formatter.info('No issues found matching the criteria'));
    return;
  }

  // Header
  console.log(Formatter.success(`\n=== ISSUES (${issues.length}/${totalCount}) ===`));

  if (totalCount > limit) {
    console.log(
      Formatter.info(
        `Showing ${offset + 1}-${Math.min(offset + limit, totalCount)} of ${totalCount} issues`
      )
    );
  }

  console.log('');

  // Table headers
  const headers = ['ID', 'Title', 'Status', 'Priority', 'Epic', 'Assignee', 'Updated'];
  const columnWidths = [12, 40, 12, 10, 12, 15, 12];

  // Print headers
  const headerRow = headers.map((header, i) => header.padEnd(columnWidths[i])).join(' ');
  console.log(Formatter.success(headerRow));
  console.log(Formatter.success('-'.repeat(headerRow.length)));

  // Print issues
  for (const issue of issues) {
    const row = [
      issue.issue_id || 'N/A',
      truncate(issue.title || 'Untitled', columnWidths[1]),
      getStatusDisplay(issue.status),
      getPriorityDisplay(issue.priority),
      issue.epic_id || 'N/A',
      issue.assignee || 'Unassigned',
      formatDate(issue.updated_date),
    ];

    const formattedRow = row.map((cell, i) => cell.toString().padEnd(columnWidths[i])).join(' ');
    console.log(formattedRow);
  }

  console.log('');

  // Pagination info
  if (totalCount > limit) {
    const nextOffset = offset + limit;
    const hasNext = nextOffset < totalCount;
    const prevOffset = Math.max(0, offset - limit);
    const hasPrev = offset > 0;

    console.log(Formatter.info('Pagination:'));
    if (hasPrev) {
      console.log(`  Previous: aitrackdown issue list --offset ${prevOffset} --limit ${limit}`);
    }
    if (hasNext) {
      console.log(`  Next: aitrackdown issue list --offset ${nextOffset} --limit ${limit}`);
    }
    console.log('');
  }
}

function getStatusDisplay(status: string): string {
  const statusColors: Record<string, (text: string) => string> = {
    todo: (text) => Formatter.info(text),
    'in-progress': (text) => Formatter.warning(text),
    done: (text) => Formatter.success(text),
    blocked: (text) => Formatter.error(text),
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
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}
