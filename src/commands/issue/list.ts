/**
 * Issue list command - List issues with advanced filtering and sorting
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatError, formatInfo, formatWarning } from '../../utils/formatters.js';
import type { IssueListOptions } from '../../types/commands.js';
import type { IssueFilters, GitHubIssue } from '../../types/github.js';

export function createIssueListCommand(): Command {
  const cmd = new Command('list');
  
  cmd
    .description('List issues with filtering and sorting')
    .alias('ls')
    .option('-s, --state <state>', 'Issue state (open, closed, all)', 'open')
    .option('-l, --labels <labels>', 'Filter by labels (comma-separated)')
    .option('-a, --assignee <user>', 'Filter by assignee (username, "none", "*")')
    .option('--assignees <users>', 'Filter by multiple assignees (comma-separated)')
    .option('-c, --creator <user>', 'Filter by creator')
    .option('-m, --mentioned <user>', 'Filter by mentioned user')
    .option('--milestone <milestone>', 'Filter by milestone (title, number, "none", "*")')
    .option('--since <date>', 'Only issues updated after this date (ISO 8601)')
    .option('--sort <field>', 'Sort by field (created, updated, comments)', 'created')
    .option('-d, --direction <dir>', 'Sort direction (asc, desc)', 'desc')
    .option('-n, --limit <number>', 'Maximum number of issues to return', parseInt, 30)
    .option('-p, --page <number>', 'Page number for pagination', parseInt, 1)
    .option('--all', 'Fetch all issues (ignore limit and pagination)')
    .option('--web', 'Open results in web browser')
    .option('--format <format>', 'Output format (table, json, yaml, csv)', 'table')
    .option('--fields <fields>', 'Comma-separated list of fields to display')
    .option('--no-header', 'Hide table header')
    .action(async (options: IssueListOptions) => {
      try {
        await handleListIssues(options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleListIssues(options: IssueListOptions): Promise<void> {
  // Create GitHub client
  const client = createGitHubClient();
  
  // Get repository info
  const repository = client.getRepository();
  if (!repository) {
    throw new Error('No repository configured. Run "trackdown config repo" to set up repository.');
  }

  // Build filters
  const filters: IssueFilters = {};

  // State filter
  if (options.state && options.state !== 'all') {
    if (options.state !== 'open' && options.state !== 'closed') {
      throw new Error('State must be "open", "closed", or "all"');
    }
    filters.state = options.state;
  }

  // Labels filter
  if (options.labels) {
    filters.labels = options.labels.split(',').map(l => l.trim()).filter(l => l.length > 0);
  }

  // Assignee filter
  if (options.assignee) {
    filters.assignee = options.assignee;
  } else if (options.assignees) {
    // For multiple assignees, use the first one (GitHub API limitation)
    const assigneeList = options.assignees.split(',').map(a => a.trim()).filter(a => a.length > 0);
    if (assigneeList.length > 0) {
      filters.assignee = assigneeList[0];
      if (assigneeList.length > 1) {
        console.log(formatWarning('GitHub API only supports filtering by one assignee. Using the first one.'));
      }
    }
  }

  // Creator filter
  if (options.creator) {
    filters.creator = options.creator;
  }

  // Mentioned filter
  if (options.mentioned) {
    filters.mentioned = options.mentioned;
  }

  // Milestone filter
  if (options.milestone) {
    filters.milestone = options.milestone;
  }

  // Date filter
  if (options.since) {
    filters.since = options.since;
  }

  // Sorting
  if (options.sort) {
    if (!['created', 'updated', 'comments'].includes(options.sort)) {
      throw new Error('Sort field must be "created", "updated", or "comments"');
    }
    filters.sort = options.sort as any;
  }

  if (options.direction) {
    if (!['asc', 'desc'].includes(options.direction)) {
      throw new Error('Direction must be "asc" or "desc"');
    }
    filters.direction = options.direction;
  }

  // Pagination
  if (!options.all) {
    filters.per_page = options.limit || 30;
    filters.page = options.page || 1;
  }

  // Show filters in verbose mode
  if (options.verbose) {
    console.log(chalk.blue('Applied filters:'));
    console.log(chalk.gray(JSON.stringify(filters, null, 2)));
    console.log('');
  }

  let allIssues: GitHubIssue[] = [];
  let currentPage = filters.page || 1;
  let hasMore = true;

  try {
    // Fetch issues
    console.log(chalk.blue(`Fetching issues from ${repository.owner}/${repository.name}...`));
    
    while (hasMore) {
      const currentFilters = { ...filters, page: currentPage };
      const response = await client.listIssues(currentFilters);
      const issues = response.data;
      
      allIssues.push(...issues);
      
      // Check if we should continue fetching
      if (options.all && issues.length === (filters.per_page || 30)) {
        currentPage++;
        // Add a small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        hasMore = false;
      }
      
      // Safety limit to prevent infinite loops
      if (currentPage > 100) {
        console.log(formatWarning('Reached maximum page limit (100). Some issues may not be displayed.'));
        break;
      }
    }

    // Filter out pull requests if needed (GitHub includes PRs in issues endpoint)
    const issuesOnly = allIssues.filter(issue => !issue.pull_request);
    
    if (issuesOnly.length === 0) {
      console.log(formatInfo('No issues found matching the criteria.'));
      
      // Suggest alternative filters
      if (filters.state === 'open') {
        console.log(formatInfo('Try using --state=all to include closed issues.'));
      }
      if (filters.assignee) {
        console.log(formatInfo('Try removing the assignee filter or using --assignee="*" for all assigned issues.'));
      }
      if (filters.labels) {
        console.log(formatInfo('Try removing or modifying the label filters.'));
      }
      
      return;
    }

    // Apply client-side filtering for multiple assignees if needed
    let filteredIssues = issuesOnly;
    if (options.assignees) {
      const assigneeList = options.assignees.split(',').map(a => a.trim()).filter(a => a.length > 0);
      if (assigneeList.length > 1) {
        filteredIssues = issuesOnly.filter(issue => 
          issue.assignees.some(assignee => assigneeList.includes(assignee.login))
        );
      }
    }

    // Sort issues if needed (client-side for complex sorting)
    if (options.sort === 'comments' && options.direction) {
      filteredIssues.sort((a, b) => {
        const aVal = a.comments;
        const bVal = b.comments;
        return options.direction === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    // Format output
    console.log(formatInfo(`Found ${filteredIssues.length} issue${filteredIssues.length === 1 ? '' : 's'}`));
    console.log('');

    switch (options.format) {
      case 'json':
        console.log(OutputFormatter.formatJSON(filteredIssues, { pretty: true }));
        break;
      
      case 'yaml':
        console.log(OutputFormatter.formatYAML(filteredIssues));
        break;
      
      case 'csv':
        const csvHeaders = options.fields 
          ? options.fields.split(',').map(f => f.trim())
          : ['number', 'title', 'state', 'created_at', 'updated_at'];
        console.log(OutputFormatter.formatCSV(filteredIssues, csvHeaders));
        break;
      
      default:
        console.log(OutputFormatter.formatIssuesTable(filteredIssues, {
          format: 'table',
          noHeader: options.noHeader,
          fields: options.fields?.split(',').map(f => f.trim())
        }));
        break;
    }

    // Show pagination info
    if (!options.all && filteredIssues.length === (options.limit || 30)) {
      console.log('');
      console.log(formatInfo(`Showing page ${currentPage}. Use --page=${currentPage + 1} for next page or --all for all issues.`));
    }

    // Open in web browser if requested
    if (options.web) {
      const url = `https://github.com/${repository.owner}/${repository.name}/issues`;
      const params = new URLSearchParams();
      
      if (filters.state === 'closed') {
        params.append('q', 'is:closed');
      } else if (filters.state === 'open') {
        params.append('q', 'is:open');
      }
      
      if (filters.labels) {
        const labelQuery = Array.isArray(filters.labels) 
          ? filters.labels.map(l => `label:"${l}"`).join(' ')
          : `label:"${filters.labels}"`;
        const existing = params.get('q') || '';
        params.set('q', existing ? `${existing} ${labelQuery}` : labelQuery);
      }
      
      if (filters.assignee && filters.assignee !== '*') {
        const assigneeQuery = filters.assignee === 'none' ? 'no:assignee' : `assignee:${filters.assignee}`;
        const existing = params.get('q') || '';
        params.set('q', existing ? `${existing} ${assigneeQuery}` : assigneeQuery);
      }
      
      const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;
      
      try {
        const open = await import('open');
        await open.default(fullUrl);
        console.log(formatInfo(`Opened in browser: ${fullUrl}`));
      } catch (error) {
        console.log(formatWarning('Failed to open browser'));
      }
    }

  } catch (error) {
    if (error instanceof GitHubAPIClientError) {
      if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to read issues in this repository.'));
      } else if (error.isNotFound()) {
        console.error(formatError('Repository not found or access denied.'));
      } else {
        console.error(formatError(`GitHub API error: ${error.message}`));
      }
    } else {
      throw error;
    }
  }
}

// Export for use in other commands
export { handleListIssues };