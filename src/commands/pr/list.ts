/**
 * PR List Command
 * Lists PRs with filtering and sorting options
 */

import { Command } from 'commander';
import type { PRStatus, Priority } from '../../types/ai-trackdown.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';

interface ListOptions {
  status?: string;
  prStatus?: string;
  priority?: string;
  assignee?: string;
  issue?: string;
  epic?: string;
  tags?: string;
  reviewer?: string;
  branch?: string;
  repository?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  showDetails?: boolean;
  format?: 'table' | 'json' | 'csv';
}

export function createPRListCommand(): Command {
  const cmd = new Command('list');

  cmd
    .description('List PRs with filtering options')
    .option('-s, --status <status>', 'filter by base status (planning|active|completed|archived)')
    .option(
      '--pr-status <status>',
      'filter by PR status (draft|open|review|approved|merged|closed)'
    )
    .option('-p, --priority <level>', 'filter by priority (low|medium|high|critical)')
    .option('-a, --assignee <username>', 'filter by assignee')
    .option('-i, --issue <issue-id>', 'filter by issue ID')
    .option('-e, --epic <epic-id>', 'filter by epic ID')
    .option('-t, --tags <tags>', 'filter by tags (comma-separated)')
    .option('-r, --reviewer <username>', 'filter by reviewer')
    .option('-b, --branch <name>', 'filter by branch name')
    .option('--repository <url>', 'filter by repository URL')
    .option('-l, --limit <number>', 'limit number of results (default: 50)')
    .option(
      '--sort-by <field>',
      'sort by field (created_date|updated_date|priority|pr_status|title)',
      'updated_date'
    )
    .option('--sort-order <order>', 'sort order (asc|desc)', 'desc')
    .option('--show-details', 'show detailed information')
    .option('--format <format>', 'output format (table|json|csv)', 'table')
    .action(async (options: ListOptions) => {
      try {
        await listPRs(options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to list PRs: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function listPRs(options: ListOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();
  const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);

  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR;

  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);

  // Get all PRs
  const allPRs = relationshipManager.getAllPRs();

  if (allPRs.length === 0) {
    console.log(Formatter.info('No PRs found.'));
    return;
  }

  // Apply filters
  let filteredPRs = allPRs;

  if (options.status) {
    filteredPRs = filteredPRs.filter((pr) => pr.status === options.status);
  }

  if (options.prStatus) {
    filteredPRs = filteredPRs.filter((pr) => pr.pr_status === options.prStatus);
  }

  if (options.priority) {
    filteredPRs = filteredPRs.filter((pr) => pr.priority === options.priority);
  }

  if (options.assignee) {
    filteredPRs = filteredPRs.filter((pr) => pr.assignee === options.assignee);
  }

  if (options.issue) {
    filteredPRs = filteredPRs.filter((pr) => pr.issue_id === options.issue);
  }

  if (options.epic) {
    filteredPRs = filteredPRs.filter((pr) => pr.epic_id === options.epic);
  }

  if (options.tags) {
    const filterTags = options.tags.split(',').map((tag) => tag.trim());
    filteredPRs = filteredPRs.filter((pr) => pr.tags?.some((tag) => filterTags.includes(tag)));
  }

  if (options.reviewer) {
    filteredPRs = filteredPRs.filter((pr) => pr.reviewers?.includes(options.reviewer));
  }

  if (options.branch) {
    filteredPRs = filteredPRs.filter(
      (pr) =>
        pr.branch_name?.includes(options.branch) ||
        pr.source_branch?.includes(options.branch) ||
        pr.target_branch?.includes(options.branch)
    );
  }

  if (options.repository) {
    filteredPRs = filteredPRs.filter((pr) => pr.repository_url?.includes(options.repository));
  }

  // Sort PRs
  const sortField = options.sortBy || 'updated_date';
  const sortOrder = options.sortOrder || 'desc';

  filteredPRs.sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'created_date':
        aValue = new Date(a.created_date);
        bValue = new Date(b.created_date);
        break;
      case 'updated_date':
        aValue = new Date(a.updated_date);
        bValue = new Date(b.updated_date);
        break;
      case 'priority': {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        aValue = priorityOrder[a.priority as Priority];
        bValue = priorityOrder[b.priority as Priority];
        break;
      }
      case 'pr_status': {
        const statusOrder = { merged: 6, closed: 5, approved: 4, review: 3, open: 2, draft: 1 };
        aValue = statusOrder[a.pr_status as PRStatus];
        bValue = statusOrder[b.pr_status as PRStatus];
        break;
      }
      case 'title':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      default:
        aValue = a.updated_date;
        bValue = b.updated_date;
    }

    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Apply limit
  const limit = parseInt(options.limit || '50', 10);
  const displayPRs = filteredPRs.slice(0, limit);

  // Display results
  if (options.format === 'json') {
    console.log(JSON.stringify(displayPRs, null, 2));
    return;
  }

  if (options.format === 'csv') {
    console.log(
      'PR_ID,Title,PR_Status,Priority,Assignee,Issue_ID,Epic_ID,Branch_Name,Target_Branch,Created_Date,Updated_Date'
    );
    displayPRs.forEach((pr) => {
      console.log(
        [
          pr.pr_id,
          `"${pr.title.replace(/"/g, '""')}"`,
          pr.pr_status,
          pr.priority,
          pr.assignee,
          pr.issue_id,
          pr.epic_id,
          pr.branch_name || '',
          pr.target_branch || '',
          pr.created_date,
          pr.updated_date,
        ].join(',')
      );
    });
    return;
  }

  // Table format (default)
  console.log(
    Formatter.header(
      `\n📋 PRs (${displayPRs.length}${filteredPRs.length > limit ? ` of ${filteredPRs.length}` : ''})`
    )
  );

  if (displayPRs.length === 0) {
    console.log(Formatter.info('No PRs match the specified filters.'));
    return;
  }

  displayPRs.forEach((pr) => {
    const statusColor = getPRStatusColor(pr.pr_status);
    const priorityColor = getPriorityColor(pr.priority);

    console.log(`\n${Formatter.info(`${pr.pr_id}`)} ${pr.title}`);
    console.log(
      `  Status: ${statusColor(pr.pr_status)} | Priority: ${priorityColor(pr.priority)} | Assignee: ${pr.assignee}`
    );
    console.log(`  Issue: ${pr.issue_id} | Epic: ${pr.epic_id}`);

    if (pr.branch_name) {
      console.log(`  Branch: ${pr.branch_name} → ${pr.target_branch || 'main'}`);
    }

    if (pr.reviewers && pr.reviewers.length > 0) {
      console.log(`  Reviewers: ${pr.reviewers.join(', ')}`);
    }

    if (pr.tags && pr.tags.length > 0) {
      console.log(`  Tags: ${pr.tags.join(', ')}`);
    }

    if (options.showDetails) {
      console.log(`  Description: ${pr.description || 'No description'}`);
      console.log(
        `  Created: ${formatDate(pr.created_date)} | Updated: ${formatDate(pr.updated_date)}`
      );
      console.log(`  File: ${pr.file_path}`);

      if (pr.repository_url) {
        console.log(`  Repository: ${pr.repository_url}`);
      }

      if (pr.pr_number) {
        console.log(`  PR Number: #${pr.pr_number}`);
      }
    }
  });

  // Summary
  console.log(`\n${Formatter.info('Summary:')}`);
  console.log(`  Total PRs: ${allPRs.length}`);
  console.log(`  Filtered: ${filteredPRs.length}`);
  console.log(`  Displayed: ${displayPRs.length}`);

  // Status breakdown
  const statusBreakdown: Record<string, number> = {};
  filteredPRs.forEach((pr) => {
    statusBreakdown[pr.pr_status] = (statusBreakdown[pr.pr_status] || 0) + 1;
  });

  console.log(
    `  Status breakdown: ${Object.entries(statusBreakdown)
      .map(([status, count]) => `${status}: ${count}`)
      .join(', ')}`
  );
}

function getPRStatusColor(status: PRStatus): (text: string) => string {
  switch (status) {
    case 'draft':
      return Formatter.debug;
    case 'open':
      return Formatter.info;
    case 'review':
      return Formatter.warning;
    case 'approved':
      return Formatter.success;
    case 'merged':
      return Formatter.success;
    case 'closed':
      return Formatter.error;
    default:
      return Formatter.info;
  }
}

function getPriorityColor(priority: Priority): (text: string) => string {
  switch (priority) {
    case 'critical':
      return Formatter.error;
    case 'high':
      return Formatter.warning;
    case 'medium':
      return Formatter.info;
    case 'low':
      return Formatter.debug;
    default:
      return Formatter.info;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}
