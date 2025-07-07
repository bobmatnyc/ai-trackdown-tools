/**
 * Issue close command - Close issues with state reason tracking
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatSuccess, formatError, formatWarning, formatInfo } from '../../utils/formatters.js';
import type { IssueCloseOptions } from '../../types/commands.js';

export function createIssueCloseCommand(): Command {
  const cmd = new Command('close');
  
  cmd
    .description('Close an issue')
    .argument('<number>', 'Issue number', parseInt)
    .option('--state-reason <reason>', 'Reason for closing (completed, not_planned)', 'completed')
    .option('-c, --comment <text>', 'Add comment when closing')
    .option('--web', 'Open issue in web browser after closing')
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .action(async (issueNumber: number, options: IssueCloseOptions) => {
      try {
        await handleCloseIssue(issueNumber, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleCloseIssue(issueNumber: number, options: IssueCloseOptions): Promise<void> {
  // Validate issue number
  if (!issueNumber || issueNumber <= 0 || !Number.isInteger(issueNumber)) {
    throw new Error('Issue number must be a positive integer');
  }

  // Validate state reason
  if (options.stateReason && !['completed', 'not_planned'].includes(options.stateReason)) {
    throw new Error('State reason must be "completed" or "not_planned"');
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
      console.log(formatWarning('This appears to be a pull request. Use "trackdown pr close" for pull requests.'));
    }

    // Check if already closed
    if (currentIssue.state === 'closed') {
      console.log(formatWarning(`Issue #${issueNumber} is already closed (${currentIssue.state_reason || 'no reason specified'})`));
      
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
      console.log(`State: ${chalk.green('open')}`);
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

    // Close the issue
    console.log(chalk.blue(`Closing issue with reason: ${options.stateReason || 'completed'}...`));
    
    const closedIssueResponse = await client.closeIssue(issueNumber, options.stateReason);
    const closedIssue = closedIssueResponse.data;
    
    console.log(formatSuccess(`Issue #${issueNumber} closed successfully`));
    
    // Show state reason
    if (closedIssue.state_reason) {
      const reasonColor = closedIssue.state_reason === 'completed' ? chalk.green : chalk.yellow;
      console.log(formatInfo(`Closed as: ${reasonColor(closedIssue.state_reason)}`));
    }
    
    // Format output
    switch (options.format) {
      case 'json':
        console.log(OutputFormatter.formatJSON(closedIssue, { pretty: true }));
        break;
      case 'yaml':
        console.log(OutputFormatter.formatYAML(closedIssue));
        break;
      default:
        console.log('\n' + OutputFormatter.formatIssueDetails(closedIssue));
        break;
    }
    
    // Show helpful information
    if (options.format === 'table') {
      console.log('');
      console.log(chalk.bold.cyan('Quick Actions:'));
      console.log(chalk.gray('─'.repeat(30)));
      console.log(`${chalk.cyan('Reopen:')} trackdown issue reopen ${issueNumber}`);
      console.log(`${chalk.cyan('View:')} trackdown issue show ${issueNumber}`);
      console.log(`${chalk.cyan('Edit:')} trackdown issue update ${issueNumber}`);
    }
    
    // Open in web browser if requested
    if (options.web) {
      try {
        const open = await import('open');
        await open.default(closedIssue.html_url);
        console.log(formatInfo(`Opened in browser: ${closedIssue.html_url}`));
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
        console.error(formatError('Access denied. You may not have permission to close this issue.'));
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
export { handleCloseIssue };