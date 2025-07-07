/**
 * Label apply command - Apply labels to issues
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatSuccess, formatError, formatWarning, formatInfo } from '../../utils/formatters.js';
import type { LabelApplyOptions } from '../../types/commands.js';

export function createLabelApplyCommand(): Command {
  const cmd = new Command('apply');
  
  cmd
    .description('Apply labels to an issue')
    .argument('<issue>', 'Issue number', parseInt)
    .argument('<labels...>', 'Labels to apply (space-separated)')
    .option('--replace', 'Replace all existing labels instead of adding')
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .action(async (issueNumber: number, labels: string[], options: LabelApplyOptions) => {
      try {
        await handleApplyLabels(issueNumber, labels, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleApplyLabels(issueNumber: number, labels: string[], options: LabelApplyOptions): Promise<void> {
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
      console.log(formatWarning('This appears to be a pull request. Labels will be applied to the PR.'));
    }

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

    // Validate that labels exist
    console.log(chalk.blue('Validating labels...'));
    const validatedLabels: string[] = [];
    const missingLabels: string[] = [];
    
    for (const labelName of uniqueLabels) {
      const existingLabel = await client.findLabelByName(labelName);
      if (existingLabel) {
        validatedLabels.push(labelName);
      } else {
        missingLabels.push(labelName);
      }
    }
    
    if (missingLabels.length > 0) {
      console.log(formatError(`The following labels do not exist: ${missingLabels.join(', ')}`));
      console.log(formatInfo('Create missing labels first with: trackdown label create <name>'));
      
      if (validatedLabels.length === 0) {
        throw new Error('No valid labels to apply');
      }
      
      console.log(formatInfo(`Proceeding with valid labels: ${validatedLabels.join(', ')}`));
    }

    // Check for duplicates with existing labels
    const currentLabelNames = currentIssue.labels.map(l => l.name);
    const newLabels = validatedLabels.filter(l => !currentLabelNames.includes(l));
    const duplicateLabels = validatedLabels.filter(l => currentLabelNames.includes(l));
    
    if (duplicateLabels.length > 0 && !options.replace) {
      console.log(formatWarning(`The following labels are already applied: ${duplicateLabels.join(', ')}`));
    }
    
    if (newLabels.length === 0 && !options.replace) {
      console.log(formatInfo('All specified labels are already applied to this issue'));
      return;
    }

    // Show what will be applied
    console.log('');
    console.log(chalk.blue('Labels to apply:'));
    validatedLabels.forEach(labelName => {
      const isNew = newLabels.includes(labelName);
      const isDuplicate = duplicateLabels.includes(labelName);
      
      if (isNew) {
        console.log(`  ${chalk.green('+')} ${chalk.bold(labelName)}`);
      } else if (isDuplicate && !options.replace) {
        console.log(`  ${chalk.yellow('=')} ${chalk.gray(labelName)} (already applied)`);
      } else {
        console.log(`  ${chalk.blue('=')} ${chalk.bold(labelName)}`);
      }
    });

    // Apply labels
    console.log('');
    if (options.replace) {
      console.log(chalk.blue('Replacing all labels...'));
      const response = await client.replaceLabelsOnIssue(issueNumber, validatedLabels);
      console.log(formatSuccess(`Labels replaced on issue #${issueNumber}`));
      
      // Show final state
      const finalIssueResponse = await client.getIssue(issueNumber);
      const finalIssue = finalIssueResponse.data;
      
      console.log('');
      console.log(chalk.bold('Final labels:'));
      if (finalIssue.labels && finalIssue.labels.length > 0) {
        finalIssue.labels.forEach(label => {
          console.log(`  ${chalk.hex(`#${label.color}`).bold(label.name)}`);
        });
      } else {
        console.log('  none');
      }
      
    } else {
      console.log(chalk.blue('Adding labels...'));
      if (newLabels.length > 0) {
        await client.addLabelsToIssue(issueNumber, newLabels);
        console.log(formatSuccess(`${newLabels.length} label${newLabels.length === 1 ? '' : 's'} added to issue #${issueNumber}`));
      }
    }

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
      console.log(`${chalk.bold('Total labels:')} ${updatedIssue.labels.length}`);
      
      if (options.replace) {
        console.log(`${chalk.bold('Action:')} Replaced all labels`);
      } else {
        console.log(`${chalk.bold('Labels added:')} ${newLabels.length}`);
        if (duplicateLabels.length > 0) {
          console.log(`${chalk.bold('Already applied:')} ${duplicateLabels.length}`);
        }
      }
      
      console.log('');
      console.log(chalk.bold.cyan('Quick Actions:'));
      console.log(chalk.gray('─'.repeat(30)));
      console.log(`${chalk.cyan('View issue:')} trackdown issue show ${issueNumber}`);
      console.log(`${chalk.cyan('Remove labels:')} trackdown label remove ${issueNumber} <labels>`);
      console.log(`${chalk.cyan('Search similar:')} trackdown issue search 'is:open ${validatedLabels.map(l => `label:"${l}"`).join(' ')}'`);
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
export { handleApplyLabels };