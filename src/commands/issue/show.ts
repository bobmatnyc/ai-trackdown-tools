/**
 * Issue show command - Display detailed information about a specific issue
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatError, formatInfo, formatWarning } from '../../utils/formatters.js';
import type { IssueShowOptions } from '../../types/commands.js';

export function createIssueShowCommand(): Command {
  const cmd = new Command('show');
  
  cmd
    .description('Show detailed information about an issue')
    .argument('<number>', 'Issue number', parseInt)
    .option('-c, --comments', 'Include comments in output')
    .option('-r, --reactions', 'Include reactions in output')
    .option('-t, --timeline', 'Include timeline events in output')
    .option('--raw', 'Show raw markdown without formatting')
    .option('--web', 'Open issue in web browser')
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .action(async (issueNumber: number, options: IssueShowOptions) => {
      try {
        await handleShowIssue(issueNumber, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleShowIssue(issueNumber: number, options: IssueShowOptions): Promise<void> {
  // Validate issue number
  if (!issueNumber || issueNumber <= 0 || !Number.isInteger(issueNumber)) {
    throw new Error('Issue number must be a positive integer');
  }

  // Create GitHub client
  const client = createGitHubClient();
  
  // Get repository info
  const repository = client.getRepository();
  if (!repository) {
    throw new Error('No repository configured. Run "trackdown config repo" to set up repository.');
  }

  try {
    console.log(chalk.blue(`Fetching issue #${issueNumber} from ${repository.owner}/${repository.name}...`));
    
    // Fetch issue details
    const issueResponse = await client.getIssue(issueNumber);
    const issue = issueResponse.data;
    
    // Check if it's actually a pull request
    if (issue.pull_request) {
      console.log(formatWarning('This appears to be a pull request. Use "trackdown pr show" for pull request details.'));
    }

    // Fetch comments if requested
    let comments: any[] = [];
    if (options.comments) {
      console.log(chalk.blue('Fetching comments...'));
      try {
        const commentsResponse = await client.listComments(issueNumber);
        comments = commentsResponse.data;
      } catch (error) {
        console.log(formatWarning('Failed to fetch comments'));
        if (options.verbose) {
          console.log(formatError(error instanceof Error ? error.message : 'Unknown error'));
        }
      }
    }

    // Format output based on requested format
    switch (options.format) {
      case 'json':
        const jsonData = {
          issue,
          ...(options.comments && { comments }),
          meta: {
            repository: `${repository.owner}/${repository.name}`,
            fetched_at: new Date().toISOString()
          }
        };
        console.log(OutputFormatter.formatJSON(jsonData, { pretty: true }));
        break;
      
      case 'yaml':
        const yamlData = {
          issue,
          ...(options.comments && { comments }),
          meta: {
            repository: `${repository.owner}/${repository.name}`,
            fetched_at: new Date().toISOString()
          }
        };
        console.log(OutputFormatter.formatYAML(yamlData));
        break;
      
      default:
        // Table/formatted output
        console.log('');
        console.log(OutputFormatter.formatIssueDetails(issue, {
          reactions: options.reactions
        }));
        
        // Show comments if requested
        if (options.comments && comments.length > 0) {
          console.log('');
          console.log(chalk.bold.cyan(`Comments (${comments.length}):`));
          console.log(chalk.gray('═'.repeat(80)));
          console.log(OutputFormatter.formatCommentsList(comments));
        } else if (options.comments && comments.length === 0) {
          console.log('');
          console.log(chalk.gray('No comments found.'));
        }
        
        // Show timeline if requested (placeholder for future implementation)
        if (options.timeline) {
          console.log('');
          console.log(formatInfo('Timeline view is not yet implemented. Use --web to view full timeline on GitHub.'));
        }
        
        break;
    }

    // Show additional metadata
    if (options.verbose && options.format === 'table') {
      console.log('');
      console.log(chalk.bold.cyan('Additional Information:'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`${chalk.bold('Node ID:')} ${issue.node_id}`);
      console.log(`${chalk.bold('Author Association:')} ${issue.author_association}`);
      console.log(`${chalk.bold('Locked:')} ${issue.locked ? chalk.red('Yes') : chalk.green('No')}`);
      
      if (issue.active_lock_reason) {
        console.log(`${chalk.bold('Lock Reason:')} ${issue.active_lock_reason}`);
      }
      
      if (issue.closed_by) {
        console.log(`${chalk.bold('Closed By:')} ${chalk.blue(issue.closed_by.login)}`);
      }
      
      // API URLs
      console.log('');
      console.log(chalk.bold.cyan('API URLs:'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`${chalk.bold('Issue:')} ${issue.url}`);
      console.log(`${chalk.bold('Comments:')} ${issue.comments_url}`);
      console.log(`${chalk.bold('Events:')} ${issue.events_url}`);
      console.log(`${chalk.bold('Timeline:')} ${issue.timeline_url}`);
    }

    // Show issue statistics
    if (options.format === 'table') {
      console.log('');
      console.log(chalk.bold.cyan('Statistics:'));
      console.log(chalk.gray('─'.repeat(20)));
      console.log(`${chalk.bold('Comments:')} ${issue.comments}`);
      
      if (issue.reactions && issue.reactions.total_count > 0) {
        console.log(`${chalk.bold('Reactions:')} ${issue.reactions.total_count}`);
      }
      
      // Calculate age
      const created = new Date(issue.created_at);
      const now = new Date();
      const ageMs = now.getTime() - created.getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      console.log(`${chalk.bold('Age:')} ${ageDays} days`);
      
      // Calculate time since last update
      const updated = new Date(issue.updated_at);
      const lastUpdateMs = now.getTime() - updated.getTime();
      const lastUpdateDays = Math.floor(lastUpdateMs / (1000 * 60 * 60 * 24));
      const lastUpdateHours = Math.floor(lastUpdateMs / (1000 * 60 * 60));
      
      if (lastUpdateDays > 0) {
        console.log(`${chalk.bold('Last Updated:')} ${lastUpdateDays} days ago`);
      } else if (lastUpdateHours > 0) {
        console.log(`${chalk.bold('Last Updated:')} ${lastUpdateHours} hours ago`);
      } else {
        console.log(`${chalk.bold('Last Updated:')} Recently`);
      }
    }

    // Open in web browser if requested
    if (options.web) {
      try {
        const open = await import('open');
        await open.default(issue.html_url);
        console.log('');
        console.log(formatInfo(`Opened in browser: ${issue.html_url}`));
      } catch (error) {
        console.log(formatWarning('Failed to open browser'));
      }
    }

    // Show helpful commands
    if (options.format === 'table' && !options.web) {
      console.log('');
      console.log(chalk.bold.cyan('Quick Actions:'));
      console.log(chalk.gray('─'.repeat(30)));
      console.log(`${chalk.cyan('Edit:')} trackdown issue update ${issueNumber}`);
      console.log(`${chalk.cyan('Comment:')} trackdown comment create ${issueNumber}`);
      
      if (issue.state === 'open') {
        console.log(`${chalk.cyan('Close:')} trackdown issue close ${issueNumber}`);
      } else {
        console.log(`${chalk.cyan('Reopen:')} trackdown issue reopen ${issueNumber}`);
      }
      
      console.log(`${chalk.cyan('Web:')} trackdown issue show ${issueNumber} --web`);
    }

  } catch (error) {
    if (error instanceof GitHubAPIClientError) {
      if (error.isNotFound()) {
        console.error(formatError(`Issue #${issueNumber} not found in ${repository.owner}/${repository.name}`));
        console.log(formatInfo('Make sure the issue number is correct and you have access to the repository.'));
      } else if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to read this issue.'));
      } else {
        console.error(formatError(`GitHub API error: ${error.message}`));
      }
    } else {
      throw error;
    }
  }
}

// Export for use in other commands
export { handleShowIssue };