/**
 * Issue search command - Advanced search with GitHub-compatible query syntax
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatError, formatInfo, formatWarning, formatSuccess } from '../../utils/formatters.js';
import { SearchQueryParser, buildSearchQuery } from '../../utils/search-parser.js';
import type { IssueSearchOptions } from '../../types/commands.js';
import type { SearchQuery } from '../../types/github.js';

export function createIssueSearchCommand(): Command {
  const cmd = new Command('search');
  
  cmd
    .description('Search issues with GitHub-compatible query syntax')
    .argument('<query>', 'Search query (GitHub-compatible syntax)')
    .option('-s, --state <state>', 'Issue state (open, closed, all)', 'all')
    .option('--sort <field>', 'Sort by field (comments, reactions, reactions-+1, reactions--1, interactions, created, updated)')
    .option('--order <direction>', 'Sort direction (asc, desc)', 'desc')
    .option('-n, --limit <number>', 'Maximum number of results to return', parseInt, 30)
    .option('-p, --page <number>', 'Page number for pagination', parseInt, 1)
    .option('--created <date>', 'Filter by creation date (e.g., ">2024-01-01", "<1w")')
    .option('--updated <date>', 'Filter by update date')
    .option('--author <user>', 'Filter by author')
    .option('--assignee <user>', 'Filter by assignee')
    .option('--mentions <user>', 'Filter by mentioned user')
    .option('--labels <labels>', 'Filter by labels (comma-separated)')
    .option('--milestone <milestone>', 'Filter by milestone')
    .option('--in <fields>', 'Search in specific fields (title, body, comments)')
    .option('--web', 'Open search results in web browser')
    .option('--format <format>', 'Output format (table, json, yaml, csv)', 'table')
    .option('--validate', 'Validate search query syntax without executing')
    .action(async (query: string, options: IssueSearchOptions) => {
      try {
        await handleSearchIssues(query, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
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

  // Validate and parse query if requested
  if (options.validate) {
    console.log(chalk.blue('Validating search query...'));
    const validation = SearchQueryParser.validate(query);
    
    if (validation.valid) {
      console.log(formatSuccess('Query syntax is valid'));
      if (validation.parsedQuery) {
        console.log('');
        console.log(chalk.bold('Parsed query:'));
        console.log(JSON.stringify(validation.parsedQuery, null, 2));
      }
    } else {
      console.log(formatError('Query syntax is invalid'));
      validation.errors.forEach(error => {
        console.log(formatError(`  ${error.message}`));
        if (error.suggestion) {
          console.log(formatInfo(`  Suggestion: ${error.suggestion}`));
        }
      });
    }
    
    if (validation.warnings.length > 0) {
      console.log('');
      console.log(chalk.bold.yellow('Warnings:'));
      validation.warnings.forEach(warning => {
        console.log(formatWarning(warning));
      });
    }
    
    return;
  }

  // Create GitHub client
  const client = createGitHubClient();
  
  // Get repository info
  const repository = client.getRepository();
  if (!repository) {
    throw new Error('No repository configured. Run "trackdown config repo" to set up repository.');
  }

  // Parse search query
  const parsed = SearchQueryParser.parse(query);
  
  // Build advanced filters from options and parsed query
  const filters: any = {};
  
  // Apply command-line options to override/supplement query
  if (options.state && options.state !== 'all') {
    filters.state = options.state;
  }
  
  if (options.author) {
    filters.author = options.author;
  }
  
  if (options.assignee) {
    filters.assignee = options.assignee;
  }
  
  if (options.mentions) {
    filters.mentions = options.mentions;
  }
  
  if (options.labels) {
    filters.labels = options.labels.split(',').map(l => l.trim());
  }
  
  if (options.milestone) {
    filters.milestone = options.milestone;
  }
  
  if (options.created) {
    filters.created = options.created;
  }
  
  if (options.updated) {
    filters.updated = options.updated;
  }
  
  if (options.in) {
    filters.in = options.in.split(',').map(f => f.trim());
  }

  // Build GitHub search query
  let searchQuery = SearchQueryParser.toGitHubQuery(parsed, `${repository.owner}/${repository.name}`);
  
  // Apply additional filters from command line options
  const additionalFilters = buildSearchQuery(filters);
  if (additionalFilters) {
    searchQuery = searchQuery ? `${searchQuery} ${additionalFilters}` : additionalFilters;
  }

  // Ensure repository is included in search
  if (!searchQuery.includes('repo:') && !searchQuery.includes('user:') && !searchQuery.includes('org:')) {
    searchQuery += ` repo:${repository.owner}/${repository.name}`;
  }

  // Build GitHub search API parameters
  const searchParams: SearchQuery = {
    q: searchQuery,
    sort: options.sort as any,
    order: options.order,
    per_page: options.limit,
    page: options.page
  };

  // Show search details if verbose
  if (options.verbose) {
    console.log(chalk.blue('Search details:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`${chalk.bold('Original query:')} ${query}`);
    console.log(`${chalk.bold('GitHub query:')} ${searchQuery}`);
    console.log(`${chalk.bold('Repository:')} ${repository.owner}/${repository.name}`);
    if (options.sort) {
      console.log(`${chalk.bold('Sort:')} ${options.sort} ${options.order || 'desc'}`);
    }
    console.log(chalk.gray('─'.repeat(40)));
    console.log('');
  }

  try {
    console.log(chalk.blue(`Searching issues in ${repository.owner}/${repository.name}...`));
    
    // Execute search
    const searchResponse = await client.searchIssues(searchParams);
    const searchResult = searchResponse.data;
    
    // Filter out pull requests (GitHub includes PRs in issues search)
    const issues = searchResult.items.filter(issue => !issue.pull_request);
    const totalIssues = issues.length;
    
    // Show search results summary
    console.log(formatInfo(`Found ${totalIssues} issue${totalIssues === 1 ? '' : 's'} (${searchResult.total_count} total items including PRs)`));
    
    if (searchResult.incomplete_results) {
      console.log(formatWarning('Search results may be incomplete due to timeout'));
    }
    
    if (totalIssues === 0) {
      console.log('');
      console.log(chalk.gray('No issues found matching your search criteria.'));
      
      // Provide search tips
      console.log('');
      console.log(chalk.bold.cyan('Search Tips:'));
      console.log(chalk.gray('─'.repeat(20)));
      console.log('• Use quotes for exact phrases: "bug in login"');
      console.log('• Filter by state: is:open, is:closed');
      console.log('• Filter by labels: label:bug');
      console.log('• Filter by assignee: assignee:username');
      console.log('• Filter by author: author:username');
      console.log('• Date ranges: created:>2024-01-01');
      console.log('• Combine filters: is:open label:bug assignee:@me');
      
      return;
    }

    console.log('');

    // Format output
    switch (options.format) {
      case 'json':
        const jsonData = {
          query: searchQuery,
          total_count: searchResult.total_count,
          incomplete_results: searchResult.incomplete_results,
          issues: issues,
          meta: {
            repository: `${repository.owner}/${repository.name}`,
            searched_at: new Date().toISOString()
          }
        };
        console.log(OutputFormatter.formatJSON(jsonData, { pretty: true }));
        break;
      
      case 'yaml':
        const yamlData = {
          query: searchQuery,
          total_count: searchResult.total_count,
          incomplete_results: searchResult.incomplete_results,
          issues: issues
        };
        console.log(OutputFormatter.formatYAML(yamlData));
        break;
      
      case 'csv':
        const csvHeaders = ['number', 'title', 'state', 'author', 'created_at', 'updated_at'];
        console.log(OutputFormatter.formatCSV(issues, csvHeaders));
        break;
      
      default:
        console.log(OutputFormatter.formatIssuesTable(issues, {
          format: 'table'
        }));
        
        // Show search metadata
        console.log('');
        console.log(chalk.bold.cyan('Search Results:'));
        console.log(chalk.gray('─'.repeat(30)));
        console.log(`${chalk.bold('Query:')} ${searchQuery}`);
        console.log(`${chalk.bold('Total items:')} ${searchResult.total_count} (including PRs)`);
        console.log(`${chalk.bold('Issues shown:')} ${totalIssues}`);
        console.log(`${chalk.bold('Page:')} ${options.page || 1}`);
        
        if (searchResult.incomplete_results) {
          console.log(`${chalk.bold('Status:')} ${chalk.yellow('Incomplete (timeout)')}`);
        }
        
        break;
    }

    // Show pagination info
    if (totalIssues === (options.limit || 30) && searchResult.total_count > totalIssues) {
      console.log('');
      console.log(formatInfo(`Showing page ${options.page || 1}. Use --page=${(options.page || 1) + 1} for next page.`));
    }

    // Open in web browser if requested
    if (options.web) {
      const searchUrl = `https://github.com/search?q=${encodeURIComponent(searchQuery)}&type=issues`;
      
      try {
        const open = await import('open');
        await open.default(searchUrl);
        console.log(formatInfo(`Opened search in browser: ${searchUrl}`));
      } catch (error) {
        console.log(formatWarning('Failed to open browser'));
      }
    }

    // Show helpful search suggestions
    if (options.format === 'table' && totalIssues > 0) {
      console.log('');
      console.log(chalk.bold.cyan('Refine Search:'));
      console.log(chalk.gray('─'.repeat(30)));
      console.log(`${chalk.cyan('More recent:')} ${query} created:>1w`);
      console.log(`${chalk.cyan('Open only:')} ${query} is:open`);
      console.log(`${chalk.cyan('With comments:')} ${query} comments:>0`);
      console.log(`${chalk.cyan('No assignee:')} ${query} no:assignee`);
    }

  } catch (error) {
    if (error instanceof GitHubAPIClientError) {
      if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to search in this repository.'));
      } else if (error.isValidationError()) {
        const validationErrors = error.getValidationErrors();
        console.error(formatError('Search query validation failed:'));
        validationErrors.forEach(err => {
          console.error(formatError(`  ${err.field}: ${err.message}`));
        });
        
        // Provide search syntax help
        console.log('');
        console.log(chalk.bold.cyan('Search Syntax Help:'));
        console.log(chalk.gray('─'.repeat(30)));
        console.log('Valid qualifiers: is, author, assignee, label, milestone, created, updated');
        console.log('Date formats: YYYY-MM-DD, >2024-01-01, <1w, 2024-01-01..2024-12-31');
        console.log('Examples: "is:open label:bug", "author:username created:>2024-01-01"');
        
      } else {
        console.error(formatError(`GitHub API error: ${error.message}`));
      }
    } else {
      throw error;
    }
  }
}

// Export for use in other commands
export { handleSearchIssues };