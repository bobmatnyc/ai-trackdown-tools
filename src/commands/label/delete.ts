/**
 * Label delete command - Delete labels with confirmation and impact analysis
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatSuccess, formatError, formatWarning, formatInfo } from '../../utils/formatters.js';
import type { LabelDeleteOptions } from '../../types/commands.js';

export function createLabelDeleteCommand(): Command {
  const cmd = new Command('delete');
  
  cmd
    .description('Delete a label')
    .argument('<name>', 'Label name to delete')
    .option('--confirm', 'Skip confirmation prompt')
    .option('--force', 'Force deletion even if label is in use')
    .action(async (name: string, options: LabelDeleteOptions) => {
      try {
        await handleDeleteLabel(name, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleDeleteLabel(name: string, options: LabelDeleteOptions): Promise<void> {
  // Validate label name
  if (!name || name.trim().length === 0) {
    throw new Error('Label name is required');
  }

  name = name.trim();

  // Create GitHub client
  const client = createGitHubClient();
  
  // Get repository info
  const repository = client.getRepository();
  if (!repository) {
    throw new Error('No repository configured. Run "trackdown config repo" to set up repository.');
  }

  try {
    console.log(chalk.blue(`Fetching label "${name}" from ${repository.owner}/${repository.name}...`));
    
    // Get current label to show details before deletion
    const currentLabel = await client.findLabelByName(name);
    if (!currentLabel) {
      throw new Error(`Label "${name}" not found`);
    }

    // Show label details
    console.log('');
    console.log(chalk.bold.red('Label to be deleted:'));
    console.log(OutputFormatter.formatLabelsTable([currentLabel]));

    // Check label usage and impact
    const warnings: string[] = [];
    let usageCount = 0;

    console.log(chalk.blue('Analyzing label usage...'));
    try {
      // Search for issues using this label
      const searchResponse = await client.searchIssues({
        q: `repo:${repository.owner}/${repository.name} label:"${name}"`
      });
      
      usageCount = searchResponse.data.total_count;
      
      if (usageCount > 0) {
        warnings.push(`Label is used by ${usageCount} issue${usageCount === 1 ? '' : 's'}`);
        warnings.push(`Deleting this label will remove it from all ${usageCount} issue${usageCount === 1 ? '' : 's'}`);
      }
    } catch (error) {
      console.log(formatWarning('Could not determine label usage'));
      warnings.push('Unable to verify label usage - proceed with caution');
    }

    // Additional warnings
    if (currentLabel.default) {
      warnings.push('This is a default GitHub label');
    }

    // Show usage details if found
    if (usageCount > 0) {
      console.log('');
      console.log(chalk.bold.yellow(`⚠️  Impact Analysis:`));
      console.log(chalk.gray('─'.repeat(30)));
      console.log(formatWarning(`${usageCount} issue${usageCount === 1 ? '' : 's'} currently use${usageCount === 1 ? 's' : ''} this label`));
      
      if (usageCount <= 10) {
        try {
          // Show recent issues using this label
          const issuesResponse = await client.listIssues({
            labels: name,
            state: 'all',
            per_page: 5,
            sort: 'updated',
            direction: 'desc'
          });
          
          if (issuesResponse.data.length > 0) {
            console.log('');
            console.log(chalk.bold('Recent issues using this label:'));
            issuesResponse.data.forEach(issue => {
              const stateIcon = issue.state === 'open' ? chalk.green('●') : chalk.red('●');
              console.log(`  ${stateIcon} #${issue.number}: ${issue.title.substring(0, 60)}${issue.title.length > 60 ? '...' : ''}`);
            });
          }
        } catch (error) {
          // Continue even if we can't fetch issue details
        }
      }
      
      console.log('');
      console.log(formatInfo(`You can view all affected issues with: trackdown issue list --labels "${name}"`));
    }

    // Show warnings
    if (warnings.length > 0 && !options.force) {
      console.log('');
      console.log(chalk.bold.yellow('⚠️  Warnings:'));
      warnings.forEach(warning => {
        console.log(formatWarning(warning));
      });
    }

    // Special handling for default labels
    if (currentLabel.default && !options.force) {
      console.log('');
      console.log(formatError('This is a default GitHub label. Deletion may affect repository functionality.'));
      console.log(formatInfo('Use --force to delete default labels.'));
      return;
    }

    // Show additional information
    console.log('');
    console.log(chalk.bold.red('⚠️  IMPORTANT:'));
    console.log(formatWarning('Deleting a label is permanent and cannot be undone.'));
    console.log(formatWarning('The label will be removed from all issues immediately.'));
    
    if (usageCount > 0) {
      console.log(formatInfo('Consider renaming or updating the label instead if you want to preserve issue associations.'));
    }

    // Confirmation prompt
    if (!options.confirm) {
      console.log('');
      
      const confirmationAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: chalk.red.bold(`Are you sure you want to delete the label "${name}"?`),
          default: false
        }
      ]);
      
      if (!confirmationAnswer.confirm) {
        console.log(formatInfo('Operation cancelled'));
        return;
      }

      // Double confirmation for labels with high usage
      if (usageCount > 5) {
        const doubleConfirmAnswer = await inquirer.prompt([
          {
            type: 'input',
            name: 'confirmation',
            message: chalk.red.bold(`Type "delete ${name}" to confirm:`),
            validate: (input: string) => {
              return input === `delete ${name}` || 'Please type the exact phrase to confirm deletion';
            }
          }
        ]);
        
        if (doubleConfirmAnswer.confirmation !== `delete ${name}`) {
          console.log(formatInfo('Operation cancelled'));
          return;
        }
      }
    }

    // Delete the label
    console.log('');
    console.log(chalk.blue('Deleting label...'));
    
    await client.deleteLabel(name);
    console.log(formatSuccess(`Label "${name}" deleted successfully`));
    
    // Show post-deletion information
    if (usageCount > 0) {
      console.log(formatInfo(`The label has been removed from ${usageCount} issue${usageCount === 1 ? '' : 's'}`));
    }
    
    // Show helpful suggestions
    console.log('');
    console.log(chalk.bold.cyan('What\'s Next:'));
    console.log(chalk.gray('─'.repeat(20)));
    console.log(`${chalk.cyan('View remaining labels:')} trackdown label list`);
    console.log(`${chalk.cyan('Create new label:')} trackdown label create <name>`);
    
    if (usageCount > 0) {
      console.log(`${chalk.cyan('View affected issues:')} trackdown issue search 'repo:${repository.owner}/${repository.name}'`);
      console.log(`${chalk.cyan('Filter by other labels:')} trackdown issue list --labels <other-label>`);
    }

  } catch (error) {
    if (error instanceof GitHubAPIClientError) {
      if (error.isNotFound()) {
        console.error(formatError(`Label "${name}" not found in ${repository.owner}/${repository.name}`));
        console.log(formatInfo('Use "trackdown label list" to see available labels.'));
      } else if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to delete labels in this repository.'));
      } else {
        console.error(formatError(`GitHub API error: ${error.message}`));
      }
    } else {
      throw error;
    }
  }
}

// Export for use in other commands
export { handleDeleteLabel };