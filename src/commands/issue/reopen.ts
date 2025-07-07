/**
 * Issue reopen command - Reopen closed issues
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatSuccess, formatError, formatWarning, formatInfo } from '../../utils/formatters.js';
import type { IssueReopenOptions } from '../../types/commands.js';

export function createIssueReopenCommand(): Command {
  const cmd = new Command('reopen');
  
  cmd
    .description('Reopen a closed issue')
    .argument('<number>', 'Issue number', parseInt)
    .option('-c, --comment <text>', 'Add comment when reopening')
    .option('--web', 'Open issue in web browser after reopening')
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .action(async (issueNumber: number, options: IssueReopenOptions) => {
      try {
        await handleReopenIssue(issueNumber, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleReopenIssue(issueNumber: number, options: IssueReopenOptions): Promise<void> {
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
    
    // Get current issue to check state
    const currentIssueResponse = await client.getIssue(issueNumber);
    const currentIssue = currentIssueResponse.data;
    
    // Check if it's a pull request
    if (currentIssue.pull_request) {
      console.log(formatWarning('This appears to be a pull request. Use "trackdown pr reopen" for pull requests.'));
    }

    // Check if already open
    if (currentIssue.state === 'open') {
      console.log(formatWarning(`Issue #${issueNumber} is already open`));
      
      // Show current details
      if (options.format === 'table') {
        console.log('\n' + OutputFormatter.formatIssueDetails(currentIssue));
      }
      
      return;
    }

    // Show current state if verbose
    if (options.verbose) {
      console.log('');
      console.log(chalk.bold('Current issue state:'));
      console.log(`State: ${chalk.red('closed')}`);
      if (currentIssue.state_reason) {
        console.log(`Reason: ${currentIssue.state_reason}`);
      }
      if (currentIssue.closed_at) {
        console.log(`Closed: ${new Date(currentIssue.closed_at).toLocaleString()}`);
      }
      if (currentIssue.closed_by) {
        console.log(`Closed by: ${currentIssue.closed_by.login}`);
      }
      console.log(`Title: ${currentIssue.title}`);
      console.log('');
    }

    // Add comment if requested
    if (options.comment) {
      console.log(chalk.blue('Adding comment...'));
      try {
        await client.createComment(issueNumber, { body: options.comment });
        console.log(formatSuccess('Comment added'));
      } catch (error) {
        console.log(formatWarning('Failed to add comment'));
        if (options.verbose) {
          console.log(formatError(error instanceof Error ? error.message : 'Unknown error'));
        }
      }
    }

    // Reopen the issue
    console.log(chalk.blue('Reopening issue...'));
    
    const reopenedIssueResponse = await client.reopenIssue(issueNumber);
    const reopenedIssue = reopenedIssueResponse.data;
    
    console.log(formatSuccess(`Issue #${issueNumber} reopened successfully`));
    
    // Show state reason
    if (reopenedIssue.state_reason) {
      console.log(formatInfo(`State reason: ${chalk.blue(reopenedIssue.state_reason)}`));
    }
    
    // Format output
    switch (options.format) {
      case 'json':
        console.log(OutputFormatter.formatJSON(reopenedIssue, { pretty: true }));
        break;
      case 'yaml':
        console.log(OutputFormatter.formatYAML(reopenedIssue));
        break;
      default:
        console.log('\n' + OutputFormatter.formatIssueDetails(reopenedIssue));
        break;
    }
    
    // Show helpful information
    if (options.format === 'table') {
      console.log('');
      console.log(chalk.bold.cyan('Quick Actions:'));
      console.log(chalk.gray('─'.repeat(30)));
      console.log(`${chalk.cyan('Close:')} trackdown issue close ${issueNumber}`);
      console.log(`${chalk.cyan('View:')} trackdown issue show ${issueNumber}`);
      console.log(`${chalk.cyan('Edit:')} trackdown issue update ${issueNumber}`);
      console.log(`${chalk.cyan('Comment:')} trackdown comment create ${issueNumber}`);
    }
    
    // Show issue activity summary
    if (options.format === 'table') {
      console.log('');
      console.log(chalk.bold.cyan('Issue Activity:'));
      console.log(chalk.gray('─'.repeat(30)));
      
      const created = new Date(reopenedIssue.created_at);
      const now = new Date();
      const ageMs = now.getTime() - created.getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      
      console.log(`${chalk.bold('Age:')} ${ageDays} days`);
      console.log(`${chalk.bold('Comments:')} ${reopenedIssue.comments}`);
      
      if (reopenedIssue.reactions && reopenedIssue.reactions.total_count > 0) {
        console.log(`${chalk.bold('Reactions:')} ${reopenedIssue.reactions.total_count}`);
      }
      
      // Show recent activity indicator
      const updated = new Date(reopenedIssue.updated_at);
      const lastUpdateMs = now.getTime() - updated.getTime();
      const lastUpdateHours = Math.floor(lastUpdateMs / (1000 * 60 * 60));
      
      if (lastUpdateHours < 24) {
        console.log(`${chalk.bold('Status:')} ${chalk.green('Recently active')}`);
      } else {
        console.log(`${chalk.bold('Last activity:')} ${lastUpdateHours} hours ago`);
      }
    }
    
    // Open in web browser if requested
    if (options.web) {
      try {
        const open = await import('open');
        await open.default(reopenedIssue.html_url);
        console.log(formatInfo(`Opened in browser: ${reopenedIssue.html_url}`));
      } catch (error) {
        console.log(formatWarning('Failed to open browser'));
      }
    }

  } catch (error) {
    if (error instanceof GitHubAPIClientError) {
      if (error.isNotFound()) {
        console.error(formatError(`Issue #${issueNumber} not found in ${repository.owner}/${repository.name}`));
        console.log(formatInfo('Make sure the issue number is correct and you have access to the repository.'));
      } else if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to reopen this issue.'));
      } else if (error.isValidationError()) {
        const validationErrors = error.getValidationErrors();
        console.error(formatError('Validation failed:'));
        validationErrors.forEach(err => {
          console.error(formatError(`  ${err.field}: ${err.message}`));
        });
      } else {
        console.error(formatError(`GitHub API error: ${error.message}`));
      }
    } else {
      throw error;
    }
  }
}

// Export for use in other commands
export { handleReopenIssue };