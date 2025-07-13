/**
 * Issue search command - Advanced search for ai-trackdown issues
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import * as YAML from 'yaml';
import type { IssueData } from '../../types/ai-trackdown.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { formatError, formatInfo, formatWarning } from '../../utils/formatters.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';

interface IssueSearchOptions {
  state?: string;
  sort?: string;
  order?: string;
  limit?: number;
  page?: number;
  assignee?: string;
  labels?: string;
  priority?: string;
  epic?: string;
  format?: string;
  verbose?: boolean;
}

export function createIssueSearchCommand(): Command {
  const cmd = new Command('search');

  cmd
    .description('Search issues in the current ai-trackdown project')
    .argument('<query>', 'Search query (searches in title and content)')
    .option('-s, --state <state>', 'Issue state (todo, in_progress, completed, all)', 'all')
    .option('--sort <field>', 'Sort by field (created, updated, priority, status)', 'updated')
    .option('--order <direction>', 'Sort direction (asc, desc)', 'desc')
    .option('-n, --limit <number>', 'Maximum number of results to return', parseInt, 30)
    .option('-p, --page <number>', 'Page number for pagination', parseInt, 1)
    .option('--assignee <user>', 'Filter by assignee')
    .option('--labels <labels>', 'Filter by labels (comma-separated)')
    .option('--priority <priority>', 'Filter by priority (low, medium, high, critical)')
    .option('--epic <epic-id>', 'Filter by epic ID')
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .option('-v, --verbose', 'Show detailed output')
    .action(async (query: string, options: IssueSearchOptions) => {
      try {
        await handleSearchIssues(query, options);
      } catch (error) {
        console.error(
          formatError(error instanceof Error ? error.message : 'Unknown error occurred')
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function handleSearchIssues(query: string, options: IssueSearchOptions): Promise<void> {
  // Validate query
  if (!query || query.trim().length === 0) {
    throw new Error('Search query is required');
  }

  // Initialize config and frontmatter parser
  const configManager = new ConfigManager();
  const config = configManager.getConfig();
  const frontmatterParser = new FrontmatterParser();

  const rootDir = path.resolve(config.directory_root || '.ai-trackdown');
  const issuesDir = path.join(rootDir, 'issues');

  if (!fs.existsSync(issuesDir)) {
    throw new Error(
      `Issues directory not found: ${issuesDir}. Run 'aitrackdown init' to set up the project.`
    );
  }

  if (options.verbose) {
    console.log(chalk.blue('Search details:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`${chalk.bold('Query:')} ${query}`);
    console.log(`${chalk.bold('Issues directory:')} ${issuesDir}`);
    console.log(`${chalk.bold('Filters applied:')}`);
    if (options.state && options.state !== 'all') console.log(`  - State: ${options.state}`);
    if (options.assignee) console.log(`  - Assignee: ${options.assignee}`);
    if (options.labels) console.log(`  - Labels: ${options.labels}`);
    if (options.priority) console.log(`  - Priority: ${options.priority}`);
    if (options.epic) console.log(`  - Epic: ${options.epic}`);
    console.log(chalk.gray('─'.repeat(40)));
    console.log('');
  }

  try {
    console.log(chalk.blue('Searching issues...'));

    // Load all issues
    const allIssues = frontmatterParser.parseDirectory(issuesDir, 'issue');

    if (allIssues.length === 0) {
      console.log(formatWarning('No issues found in the project'));
      return;
    }

    // Filter issues based on criteria
    const filteredIssues = allIssues.filter((issue) => {
      const issueData = issue as IssueData;

      // Text search in title and content
      const searchableText = `${issueData.title.toLowerCase()} ${issueData.content.toLowerCase()}`;
      if (!searchableText.includes(query.toLowerCase())) {
        return false;
      }

      // State filter
      if (options.state && options.state !== 'all' && issueData.status !== options.state) {
        return false;
      }

      // Assignee filter
      if (options.assignee && issueData.assignee !== options.assignee) {
        return false;
      }

      // Priority filter
      if (options.priority && issueData.priority !== options.priority) {
        return false;
      }

      // Epic filter
      if (options.epic && issueData.epic_id !== options.epic) {
        return false;
      }

      // Labels filter
      if (options.labels) {
        const requestedLabels = options.labels.split(',').map((l) => l.trim());
        const hasAllLabels = requestedLabels.every((label) => issueData.labels?.includes(label));
        if (!hasAllLabels) {
          return false;
        }
      }

      return true;
    });

    // Sort issues
    filteredIssues.sort((a, b) => {
      const issueA = a as IssueData;
      const issueB = b as IssueData;

      let comparison = 0;

      switch (options.sort) {
        case 'created':
          comparison =
            new Date(issueA.created_date).getTime() - new Date(issueB.created_date).getTime();
          break;
        case 'updated':
          comparison =
            new Date(issueA.updated_date).getTime() - new Date(issueB.updated_date).getTime();
          break;
        case 'priority': {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          comparison =
            (priorityOrder[issueA.priority as keyof typeof priorityOrder] || 0) -
            (priorityOrder[issueB.priority as keyof typeof priorityOrder] || 0);
          break;
        }
        case 'status':
          comparison = issueA.status.localeCompare(issueB.status);
          break;
        default:
          comparison =
            new Date(issueA.updated_date).getTime() - new Date(issueB.updated_date).getTime();
      }

      return options.order === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const limit = options.limit || 30;
    const page = options.page || 1;
    const startIndex = (page - 1) * limit;
    const paginatedIssues = filteredIssues.slice(startIndex, startIndex + limit);

    console.log(
      formatInfo(
        `Found ${filteredIssues.length} issue${filteredIssues.length === 1 ? '' : 's'} matching your criteria`
      )
    );

    if (filteredIssues.length === 0) {
      console.log('');
      console.log(chalk.gray('No issues found matching your search criteria.'));

      console.log('');
      console.log(chalk.bold.cyan('Search Tips:'));
      console.log(chalk.gray('─'.repeat(20)));
      console.log('• Search matches title and content');
      console.log('• Use --state to filter by status (todo, in_progress, completed)');
      console.log('• Use --assignee to filter by assignee');
      console.log('• Use --priority to filter by priority level');
      console.log('• Use --epic to filter by epic ID');
      console.log('• Use --labels to filter by labels (comma-separated)');

      return;
    }

    console.log('');

    // Format output
    switch (options.format) {
      case 'json': {
        const jsonData = {
          query,
          total_found: filteredIssues.length,
          page: page,
          per_page: limit,
          issues: paginatedIssues,
          meta: {
            searched_at: new Date().toISOString(),
            issues_directory: issuesDir,
          },
        };
        console.log(JSON.stringify(jsonData, null, 2));
        break;
      }

      case 'yaml': {
        const yamlData = {
          query,
          total_found: filteredIssues.length,
          page,
          per_page: limit,
          issues: paginatedIssues,
        };
        console.log(YAML.stringify(yamlData));
        break;
      }

      default:
        // Table format
        if (paginatedIssues.length > 0) {
          console.log(chalk.bold.cyan('Issues:'));
          console.log(chalk.gray('─'.repeat(80)));

          paginatedIssues.forEach((issue) => {
            const issueData = issue as IssueData;
            const statusColor =
              issueData.status === 'completed'
                ? 'green'
                : issueData.status === 'in_progress'
                  ? 'yellow'
                  : 'gray';
            const priorityColor =
              issueData.priority === 'critical'
                ? 'red'
                : issueData.priority === 'high'
                  ? 'yellow'
                  : 'white';

            console.log(
              `${chalk[statusColor]('●')} ${chalk.bold(issueData.issue_id)} ${issueData.title}`
            );
            console.log(
              `  ${chalk.gray('Epic:')} ${issueData.epic_id} ${chalk.gray('|')} ${chalk.gray('Status:')} ${chalk[statusColor](issueData.status)} ${chalk.gray('|')} ${chalk.gray('Priority:')} ${chalk[priorityColor](issueData.priority)}`
            );
            console.log(
              `  ${chalk.gray('Assignee:')} ${issueData.assignee} ${chalk.gray('|')} ${chalk.gray('Updated:')} ${new Date(issueData.updated_date).toLocaleDateString()}`
            );

            if (issueData.labels && issueData.labels.length > 0) {
              console.log(`  ${chalk.gray('Labels:')} ${issueData.labels.join(', ')}`);
            }
            console.log('');
          });
        }

        // Show search metadata
        console.log(chalk.bold.cyan('Search Results:'));
        console.log(chalk.gray('─'.repeat(30)));
        console.log(`${chalk.bold('Query:')} ${query}`);
        console.log(`${chalk.bold('Total found:')} ${filteredIssues.length}`);
        console.log(`${chalk.bold('Shown:')} ${paginatedIssues.length}`);
        console.log(
          `${chalk.bold('Page:')} ${page} of ${Math.ceil(filteredIssues.length / limit)}`
        );

        break;
    }

    // Show pagination info
    if (filteredIssues.length > limit) {
      const totalPages = Math.ceil(filteredIssues.length / limit);
      console.log('');
      if (page < totalPages) {
        console.log(
          formatInfo(`Showing page ${page} of ${totalPages}. Use --page=${page + 1} for next page.`)
        );
      }
      if (page > 1) {
        console.log(formatInfo(`Use --page=${page - 1} for previous page.`));
      }
    }

    // Show helpful suggestions
    if (options.format === 'table' && filteredIssues.length > 0) {
      console.log('');
      console.log(chalk.bold.cyan('Refine Search:'));
      console.log(chalk.gray('─'.repeat(30)));
      console.log(`${chalk.cyan('Only open:')} --state todo`);
      console.log(`${chalk.cyan('In progress:')} --state in_progress`);
      console.log(`${chalk.cyan('High priority:')} --priority high`);
      console.log(`${chalk.cyan('Unassigned:')} --assignee unassigned`);
    }
  } catch (error) {
    throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Export for use in other commands
export { handleSearchIssues };
