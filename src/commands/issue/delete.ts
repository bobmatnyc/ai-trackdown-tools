/**
 * Issue delete command - Delete issues with confirmation
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { formatSuccess, formatError, formatWarning, formatInfo } from '../../utils/formatters.js';
import type { IssueDeleteOptions } from '../../types/commands.js';

export function createIssueDeleteCommand(): Command {
  const cmd = new Command('delete');
  
  cmd
    .description('Delete an issue (where supported)')
    .argument('<number>', 'Issue number', parseInt)
    .option('--confirm', 'Skip confirmation prompt')
    .option('--force', 'Force deletion even if there are warnings')
    .action(async (issueNumber: number, options: IssueDeleteOptions) => {
      try {
        await handleDeleteIssue(issueNumber, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleDeleteIssue(issueNumber: number, options: IssueDeleteOptions): Promise<void> {
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
    
    // Get current issue to show details before deletion
    const currentIssueResponse = await client.getIssue(issueNumber);
    const currentIssue = currentIssueResponse.data;
    
    // Check if it's a pull request
    if (currentIssue.pull_request) {
      console.log(formatWarning('This appears to be a pull request. Use "trackdown pr delete" for pull requests.'));
      if (!options.force) {
        throw new Error('Cannot delete pull request as an issue. Use --force to override.');
      }
    }

    // Show issue details
    console.log('');
    console.log(chalk.bold.red('Issue to be deleted:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.bold('Number:')} #${currentIssue.number}`);
    console.log(`${chalk.bold('Title:')} ${currentIssue.title}`);
    console.log(`${chalk.bold('State:')} ${currentIssue.state === 'open' ? chalk.green('open') : chalk.red('closed')}`);
    console.log(`${chalk.bold('Author:')} ${chalk.blue(currentIssue.user.login)}`);
    console.log(`${chalk.bold('Created:')} ${new Date(currentIssue.created_at).toLocaleString()}`);
    console.log(`${chalk.bold('Updated:')} ${new Date(currentIssue.updated_at).toLocaleString()}`);
    
    if (currentIssue.assignees && currentIssue.assignees.length > 0) {
      console.log(`${chalk.bold('Assignees:')} ${currentIssue.assignees.map(a => chalk.blue(a.login)).join(', ')}`);
    }
    
    if (currentIssue.labels && currentIssue.labels.length > 0) {
      console.log(`${chalk.bold('Labels:')} ${currentIssue.labels.map(l => chalk.yellow(l.name)).join(', ')}`);
    }
    
    if (currentIssue.milestone) {
      console.log(`${chalk.bold('Milestone:')} ${chalk.yellow(currentIssue.milestone.title)}`);
    }
    
    console.log(`${chalk.bold('Comments:')} ${currentIssue.comments}`);
    
    if (currentIssue.reactions && currentIssue.reactions.total_count > 0) {
      console.log(`${chalk.bold('Reactions:')} ${currentIssue.reactions.total_count}`);
    }
    
    console.log(`${chalk.bold('URL:')} ${currentIssue.html_url}`);
    console.log(chalk.gray('─'.repeat(50)));

    // Show warnings
    const warnings: string[] = [];
    
    if (currentIssue.state === 'open') {
      warnings.push('Issue is still open');
    }
    
    if (currentIssue.comments > 0) {
      warnings.push(`Issue has ${currentIssue.comments} comment${currentIssue.comments === 1 ? '' : 's'} that will be lost`);
    }
    
    if (currentIssue.reactions && currentIssue.reactions.total_count > 0) {
      warnings.push(`Issue has ${currentIssue.reactions.total_count} reaction${currentIssue.reactions.total_count === 1 ? '' : 's'} that will be lost`);
    }
    
    if (currentIssue.assignees && currentIssue.assignees.length > 0) {
      warnings.push('Issue has assignees');
    }
    
    if (currentIssue.labels && currentIssue.labels.length > 0) {
      warnings.push('Issue has labels');
    }
    
    if (currentIssue.milestone) {
      warnings.push('Issue is part of a milestone');
    }

    // Show warnings
    if (warnings.length > 0 && !options.force) {
      console.log('');
      console.log(chalk.bold.yellow('⚠️  Warnings:'));
      warnings.forEach(warning => {
        console.log(formatWarning(warning));
      });
    }

    // Important note about GitHub API limitations
    console.log('');
    console.log(chalk.bold.red('⚠️  IMPORTANT:'));
    console.log(formatWarning('GitHub API does not support deleting issues in most cases.'));
    console.log(formatWarning('This operation may fail or have limited functionality.'));
    console.log(formatInfo('Consider closing the issue instead with: trackdown issue close ' + issueNumber));

    // Confirmation prompt
    if (!options.confirm) {
      console.log('');
      const confirmationAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: chalk.red.bold('Are you absolutely sure you want to delete this issue?'),
          default: false
        }
      ]);
      
      if (!confirmationAnswer.confirm) {
        console.log(formatInfo('Operation cancelled'));
        return;
      }

      // Double confirmation for issues with content
      if (warnings.length > 0) {
        const doubleConfirmAnswer = await inquirer.prompt([
          {
            type: 'input',
            name: 'confirmation',
            message: chalk.red.bold(`Type "delete issue ${issueNumber}" to confirm:`),
            validate: (input: string) => {
              return input === `delete issue ${issueNumber}` || 'Please type the exact phrase to confirm deletion';
            }
          }
        ]);
        
        if (doubleConfirmAnswer.confirmation !== `delete issue ${issueNumber}`) {
          console.log(formatInfo('Operation cancelled'));
          return;
        }
      }
    }

    // Attempt to delete the issue
    console.log('');
    console.log(chalk.blue('Attempting to delete issue...'));
    
    try {
      await client.deleteIssue(issueNumber);
      console.log(formatSuccess(`Issue #${issueNumber} deleted successfully`));
      
      // Note: This might not actually work for most GitHub repositories
      console.log(formatInfo('Note: Issue deletion is rare and may not be supported in all repositories.'));
      
    } catch (error) {
      if (error instanceof GitHubAPIClientError) {
        if (error.status === 404) {
          // Issue might have been deleted or doesn't exist
          console.log(formatSuccess(`Issue #${issueNumber} appears to have been deleted or no longer exists`));
        } else if (error.status === 403) {
          console.error(formatError('Access denied. Issue deletion may not be supported or you may lack permissions.'));
          console.log(formatInfo('Alternative: Close the issue instead with: trackdown issue close ' + issueNumber));
        } else if (error.status === 405) {
          console.error(formatError('Method not allowed. GitHub API does not support deleting this issue.'));
          console.log(formatInfo('Alternative: Close the issue instead with: trackdown issue close ' + issueNumber));
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

  } catch (error) {
    if (error instanceof GitHubAPIClientError) {
      if (error.isNotFound()) {
        console.error(formatError(`Issue #${issueNumber} not found in ${repository.owner}/${repository.name}`));
        console.log(formatInfo('The issue may have already been deleted or may not exist.'));
      } else if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to delete issues in this repository.'));
        console.log(formatInfo('Alternative: Close the issue instead with: trackdown issue close ' + issueNumber));
      } else {
        console.error(formatError(`GitHub API error: ${error.message}`));
      }
    } else {
      throw error;
    }
  }
}

// Export for use in other commands
export { handleDeleteIssue };