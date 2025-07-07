/**
 * Label remove command - Remove labels from issues
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatSuccess, formatError, formatWarning, formatInfo } from '../../utils/formatters.js';
import type { LabelRemoveOptions } from '../../types/commands.js';

export function createLabelRemoveCommand(): Command {
  const cmd = new Command('remove');
  
  cmd
    .description('Remove labels from an issue')
    .argument('<issue>', 'Issue number', parseInt)
    .argument('<labels...>', 'Labels to remove (space-separated)')
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .action(async (issueNumber: number, labels: string[], options: LabelRemoveOptions) => {
      try {
        await handleRemoveLabels(issueNumber, labels, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleRemoveLabels(issueNumber: number, labels: string[], options: LabelRemoveOptions): Promise<void> {
  // Validate issue number
  if (!issueNumber || issueNumber <= 0 || !Number.isInteger(issueNumber)) {
    throw new Error('Issue number must be a positive integer');
  }

  // Validate labels
  if (!labels || labels.length === 0) {
    throw new Error('At least one label is required');
  }

  // Parse labels (handle comma-separated values)
  const labelList = labels.flatMap(l => 
    l.includes(',') ? l.split(',').map(s => s.trim()) : [l.trim()]
  ).filter(l => l.length > 0);

  if (labelList.length === 0) {
    throw new Error('At least one valid label is required');
  }

  // Remove duplicates
  const uniqueLabels = [...new Set(labelList)];

  // Create GitHub client
  const client = createGitHubClient();
  
  // Get repository info
  const repository = client.getRepository();
  if (!repository) {
    throw new Error('No repository configured. Run "trackdown config repo" to set up repository.');
  }

  try {
    console.log(chalk.blue(`Fetching issue #${issueNumber} from ${repository.owner}/${repository.name}...`));
    
    // Get current issue
    const currentIssueResponse = await client.getIssue(issueNumber);
    const currentIssue = currentIssueResponse.data;
    
    // Check if it's a pull request
    if (currentIssue.pull_request) {
      console.log(formatWarning('This appears to be a pull request. Labels will be removed from the PR.'));
    }

    // Get current labels
    const currentLabelNames = currentIssue.labels.map(l => l.name);
    
    // Show current labels if verbose
    if (options.verbose) {
      console.log('');
      console.log(chalk.bold('Current issue:'));
      console.log(`Title: ${currentIssue.title}`);
      console.log(`State: ${currentIssue.state === 'open' ? chalk.green('open') : chalk.red('closed')}`);
      
      if (currentIssue.labels && currentIssue.labels.length > 0) {
        console.log('Current labels:');
        currentIssue.labels.forEach(label => {
          console.log(`  ${chalk.hex(`#${label.color}`).bold(label.name)} - ${label.description || 'no description'}`);
        });
      } else {
        console.log('Current labels: none');
      }
      console.log('');
    }

    // Check if issue has any labels
    if (currentLabelNames.length === 0) {
      console.log(formatInfo(`Issue #${issueNumber} has no labels to remove`));
      return;
    }

    // Check which labels are actually applied to the issue
    const labelsToRemove = uniqueLabels.filter(l => currentLabelNames.includes(l));
    const labelsNotApplied = uniqueLabels.filter(l => !currentLabelNames.includes(l));
    
    if (labelsNotApplied.length > 0) {
      console.log(formatWarning(`The following labels are not applied to this issue: ${labelsNotApplied.join(', ')}`));
    }
    
    if (labelsToRemove.length === 0) {
      console.log(formatInfo('None of the specified labels are applied to this issue'));
      
      if (currentLabelNames.length > 0) {
        console.log('');
        console.log(chalk.bold('Available labels to remove:'));
        currentLabelNames.forEach(labelName => {
          const label = currentIssue.labels.find(l => l.name === labelName);
          if (label) {
            console.log(`  ${chalk.hex(`#${label.color}`).bold(label.name)}`);
          }
        });
      }
      
      return;
    }

    // Show what will be removed
    console.log('');
    console.log(chalk.blue('Labels to remove:'));
    labelsToRemove.forEach(labelName => {
      const label = currentIssue.labels.find(l => l.name === labelName);
      if (label) {
        console.log(`  ${chalk.red('-')} ${chalk.hex(`#${label.color}`).bold(labelName)}`);
      }
    });
    
    if (labelsNotApplied.length > 0) {
      console.log('');
      console.log(chalk.gray('Labels not applied (skipped):'));
      labelsNotApplied.forEach(labelName => {
        console.log(`  ${chalk.gray('=')} ${chalk.gray(labelName)}`);
      });
    }

    // Remove labels
    console.log('');
    console.log(chalk.blue('Removing labels...'));
    
    await client.removeLabelsFromIssue(issueNumber, labelsToRemove);
    console.log(formatSuccess(`${labelsToRemove.length} label${labelsToRemove.length === 1 ? '' : 's'} removed from issue #${issueNumber}`));

    // Get updated issue
    const updatedIssueResponse = await client.getIssue(issueNumber);
    const updatedIssue = updatedIssueResponse.data;

    // Format output
    switch (options.format) {
      case 'json':
        console.log(OutputFormatter.formatJSON(updatedIssue, { pretty: true }));
        break;
      case 'yaml':
        console.log(OutputFormatter.formatYAML(updatedIssue));
        break;
      default:
        console.log('\n' + OutputFormatter.formatIssueDetails(updatedIssue));
        break;
    }

    // Show summary
    if (options.format === 'table') {
      console.log('');
      console.log(chalk.bold.cyan('Summary:'));
      console.log(chalk.gray('─'.repeat(20)));
      console.log(`${chalk.bold('Issue:')} #${issueNumber} - ${updatedIssue.title}`);
      console.log(`${chalk.bold('Labels removed:')} ${labelsToRemove.length}`);
      console.log(`${chalk.bold('Remaining labels:')} ${updatedIssue.labels.length}`);
      
      if (labelsNotApplied.length > 0) {
        console.log(`${chalk.bold('Not applied:')} ${labelsNotApplied.length}`);
      }
      
      // Show remaining labels
      if (updatedIssue.labels.length > 0) {
        console.log('');
        console.log(chalk.bold('Remaining labels:'));
        updatedIssue.labels.forEach(label => {
          console.log(`  ${chalk.hex(`#${label.color}`).bold(label.name)}`);
        });
      } else {
        console.log('');
        console.log(chalk.gray('No labels remaining on this issue'));
      }
      
      console.log('');
      console.log(chalk.bold.cyan('Quick Actions:'));
      console.log(chalk.gray('─'.repeat(30)));
      console.log(`${chalk.cyan('View issue:')} trackdown issue show ${issueNumber}`);
      console.log(`${chalk.cyan('Add labels:')} trackdown label apply ${issueNumber} <labels>`);
      console.log(`${chalk.cyan('List available:')} trackdown label list`);
      
      if (updatedIssue.labels.length > 0) {
        const remainingLabels = updatedIssue.labels.map(l => `"${l.name}"`).join(' ');
        console.log(`${chalk.cyan('Search similar:')} trackdown issue search 'is:open ${remainingLabels}'`);
      }
    }

    // Show impact information
    if (options.format === 'table' && labelsToRemove.length > 0) {
      console.log('');
      console.log(chalk.bold.cyan('Impact:'));
      console.log(chalk.gray('─'.repeat(20)));
      
      labelsToRemove.forEach(labelName => {
        console.log(`${chalk.red('Removed:')} ${labelName} - no longer associated with this issue`);
      });
      
      if (updatedIssue.labels.length === 0) {
        console.log(formatInfo('This issue now has no labels'));
        console.log(formatInfo('Consider adding appropriate labels to help with organization'));
      }
    }

  } catch (error) {
    if (error instanceof GitHubAPIClientError) {
      if (error.isNotFound()) {
        console.error(formatError(`Issue #${issueNumber} not found in ${repository.owner}/${repository.name}`));
        console.log(formatInfo('Make sure the issue number is correct and you have access to the repository.'));
      } else if (error.isValidationError()) {
        const validationErrors = error.getValidationErrors();
        console.error(formatError('Validation failed:'));
        validationErrors.forEach(err => {
          console.error(formatError(`  ${err.field}: ${err.message}`));
        });
      } else if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to modify labels on this issue.'));
      } else {
        console.error(formatError(`GitHub API error: ${error.message}`));
      }
    } else {
      throw error;
    }
  }
}

// Export for use in other commands
export { handleRemoveLabels };