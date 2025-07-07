/**
 * Issue update command - Update issue properties (title, body, labels, assignees, milestone)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatSuccess, formatError, formatWarning, formatInfo } from '../../utils/formatters.js';
import type { IssueUpdateOptions } from '../../types/commands.js';
import type { UpdateIssueRequest } from '../../types/github.js';

export function createIssueUpdateCommand(): Command {
  const cmd = new Command('update');
  
  cmd
    .description('Update an existing issue')
    .argument('<number>', 'Issue number', parseInt)
    .option('-t, --title <text>', 'New issue title')
    .option('-b, --body <text>', 'New issue body/description')
    .option('--add-labels <labels...>', 'Labels to add (comma-separated or multiple flags)')
    .option('--remove-labels <labels...>', 'Labels to remove (comma-separated or multiple flags)')
    .option('-l, --labels <labels...>', 'Replace all labels (comma-separated or multiple flags)')
    .option('-a, --assignees <users...>', 'Replace all assignees (comma-separated or multiple flags)')
    .option('--add-assignees <users...>', 'Users to assign (comma-separated or multiple flags)')
    .option('--remove-assignees <users...>', 'Users to unassign (comma-separated or multiple flags)')
    .option('-m, --milestone <milestone>', 'Milestone title or number')
    .option('--remove-milestone', 'Remove milestone from issue')
    .option('-s, --state <state>', 'Issue state (open, closed)')
    .option('--state-reason <reason>', 'State reason (completed, not_planned, reopened)')
    .option('--editor', 'Open editor for body text')
    .option('--web', 'Open issue in web browser after update')
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .action(async (issueNumber: number, options: IssueUpdateOptions) => {
      try {
        await handleUpdateIssue(issueNumber, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleUpdateIssue(issueNumber: number, options: IssueUpdateOptions): Promise<void> {
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

  // Check if any update options provided
  const hasUpdates = !!(
    options.title ||
    options.body ||
    options.labels ||
    options.addLabels ||
    options.removeLabels ||
    options.assignees ||
    options.addAssignees ||
    options.removeAssignees ||
    options.milestone ||
    options.removeMilestone ||
    options.state ||
    options.stateReason ||
    options.editor
  );

  if (!hasUpdates) {
    throw new Error('No updates specified. Use --help to see available options.');
  }

  try {
    console.log(chalk.blue(`Fetching issue #${issueNumber} from ${repository.owner}/${repository.name}...`));
    
    // Get current issue
    const currentIssueResponse = await client.getIssue(issueNumber);
    const currentIssue = currentIssueResponse.data;
    
    // Check if it's a pull request
    if (currentIssue.pull_request) {
      console.log(formatWarning('This appears to be a pull request. Some operations may not work as expected.'));
    }

    // Show current state if verbose
    if (options.verbose) {
      console.log('');
      console.log(chalk.bold('Current issue state:'));
      console.log(OutputFormatter.formatIssueDetails(currentIssue));
      console.log('');
    }

    // Prepare update data
    const updateData: UpdateIssueRequest = {};

    // Update title
    if (options.title) {
      updateData.title = options.title.trim();
    }

    // Update body
    if (options.body) {
      updateData.body = options.body.trim();
    } else if (options.editor) {
      const editorResult = await inquirer.prompt([
        {
          type: 'editor',
          name: 'body',
          message: 'Edit issue body:',
          default: currentIssue.body || ''
        }
      ]);
      updateData.body = editorResult.body;
    }

    // Handle labels
    let newLabels: string[] = [];
    
    if (options.labels) {
      // Replace all labels
      newLabels = Array.isArray(options.labels) 
        ? options.labels.flatMap(l => l.split(',').map(s => s.trim()))
        : [options.labels];
    } else {
      // Start with current labels
      newLabels = currentIssue.labels.map(label => label.name);
      
      // Add labels
      if (options.addLabels) {
        const labelsToAdd = Array.isArray(options.addLabels)
          ? options.addLabels.flatMap(l => l.split(',').map(s => s.trim()))
          : [options.addLabels];
        newLabels.push(...labelsToAdd);
      }
      
      // Remove labels
      if (options.removeLabels) {
        const labelsToRemove = Array.isArray(options.removeLabels)
          ? options.removeLabels.flatMap(l => l.split(',').map(s => s.trim()))
          : [options.removeLabels];
        newLabels = newLabels.filter(label => !labelsToRemove.includes(label));
      }
    }
    
    // Remove duplicates and empty strings
    newLabels = [...new Set(newLabels.filter(label => label.length > 0))];
    updateData.labels = newLabels;

    // Handle assignees
    let newAssignees: string[] = [];
    
    if (options.assignees) {
      // Replace all assignees
      newAssignees = Array.isArray(options.assignees)
        ? options.assignees.flatMap(a => a.split(',').map(s => s.trim()))
        : [options.assignees];
    } else {
      // Start with current assignees
      newAssignees = currentIssue.assignees.map(assignee => assignee.login);
      
      // Add assignees
      if (options.addAssignees) {
        const assigneesToAdd = Array.isArray(options.addAssignees)
          ? options.addAssignees.flatMap(a => a.split(',').map(s => s.trim()))
          : [options.addAssignees];
        newAssignees.push(...assigneesToAdd);
      }
      
      // Remove assignees
      if (options.removeAssignees) {
        const assigneesToRemove = Array.isArray(options.removeAssignees)
          ? options.removeAssignees.flatMap(a => a.split(',').map(s => s.trim()))
          : [options.removeAssignees];
        newAssignees = newAssignees.filter(assignee => !assigneesToRemove.includes(assignee));
      }
    }
    
    // Remove duplicates and empty strings
    newAssignees = [...new Set(newAssignees.filter(assignee => assignee.length > 0))];
    updateData.assignees = newAssignees;

    // Handle milestone
    if (options.milestone) {
      console.log(chalk.blue('Resolving milestone...'));
      
      // Try to parse as number first
      const milestoneNum = parseInt(options.milestone, 10);
      if (!isNaN(milestoneNum)) {
        try {
          await client.getMilestone(milestoneNum);
          updateData.milestone = milestoneNum;
        } catch (error) {
          if (error instanceof GitHubAPIClientError && error.isNotFound()) {
            throw new Error(`Milestone #${milestoneNum} not found`);
          }
          throw error;
        }
      } else {
        // Search by title
        const milestone = await client.findMilestoneByTitle(options.milestone);
        if (milestone) {
          updateData.milestone = milestone.number;
        } else {
          throw new Error(`Milestone "${options.milestone}" not found`);
        }
      }
    } else if (options.removeMilestone) {
      updateData.milestone = null;
    }

    // Handle state
    if (options.state) {
      if (!['open', 'closed'].includes(options.state)) {
        throw new Error('State must be "open" or "closed"');
      }
      updateData.state = options.state as 'open' | 'closed';
    }

    // Handle state reason
    if (options.stateReason) {
      if (!['completed', 'not_planned', 'reopened'].includes(options.stateReason)) {
        throw new Error('State reason must be "completed", "not_planned", or "reopened"');
      }
      updateData.state_reason = options.stateReason as any;
    }

    // Validate assignees exist
    if (newAssignees.length > 0) {
      console.log(chalk.blue('Validating assignees...'));
      for (const assignee of newAssignees) {
        try {
          await client.getUser(assignee);
        } catch (error) {
          if (error instanceof GitHubAPIClientError && error.isNotFound()) {
            throw new Error(`User not found: ${assignee}`);
          }
          throw error;
        }
      }
    }

    // Validate labels exist
    if (newLabels.length > 0) {
      console.log(chalk.blue('Validating labels...'));
      const missingLabels: string[] = [];
      
      for (const label of newLabels) {
        const existingLabel = await client.findLabelByName(label);
        if (!existingLabel) {
          missingLabels.push(label);
        }
      }
      
      if (missingLabels.length > 0) {
        throw new Error(`Labels not found: ${missingLabels.join(', ')}. Create them first with "trackdown label create"`);
      }
    }

    // Show preview of changes
    if (options.verbose) {
      console.log(chalk.blue('\nChanges to be made:'));
      console.log(chalk.gray('─'.repeat(50)));
      
      if (updateData.title && updateData.title !== currentIssue.title) {
        console.log(`${chalk.bold('Title:')} ${chalk.red(currentIssue.title)} → ${chalk.green(updateData.title)}`);
      }
      
      if (updateData.body !== undefined && updateData.body !== currentIssue.body) {
        const oldBody = currentIssue.body || '[empty]';
        const newBody = updateData.body || '[empty]';
        console.log(`${chalk.bold('Body:')} ${chalk.red(oldBody.substring(0, 50))}... → ${chalk.green(newBody.substring(0, 50))}...`);
      }
      
      if (updateData.labels) {
        const oldLabels = currentIssue.labels.map(l => l.name).sort().join(', ') || '[none]';
        const newLabelsStr = updateData.labels.sort().join(', ') || '[none]';
        if (oldLabels !== newLabelsStr) {
          console.log(`${chalk.bold('Labels:')} ${chalk.red(oldLabels)} → ${chalk.green(newLabelsStr)}`);
        }
      }
      
      if (updateData.assignees) {
        const oldAssignees = currentIssue.assignees.map(a => a.login).sort().join(', ') || '[none]';
        const newAssigneesStr = updateData.assignees.sort().join(', ') || '[none]';
        if (oldAssignees !== newAssigneesStr) {
          console.log(`${chalk.bold('Assignees:')} ${chalk.red(oldAssignees)} → ${chalk.green(newAssigneesStr)}`);
        }
      }
      
      if (updateData.milestone !== undefined) {
        const oldMilestone = currentIssue.milestone?.title || '[none]';
        const newMilestone = updateData.milestone ? `#${updateData.milestone}` : '[none]';
        console.log(`${chalk.bold('Milestone:')} ${chalk.red(oldMilestone)} → ${chalk.green(newMilestone)}`);
      }
      
      if (updateData.state && updateData.state !== currentIssue.state) {
        console.log(`${chalk.bold('State:')} ${chalk.red(currentIssue.state)} → ${chalk.green(updateData.state)}`);
      }
      
      console.log(chalk.gray('─'.repeat(50)));
    }

    // Update the issue
    console.log(chalk.blue('Updating issue...'));
    
    const updatedIssueResponse = await client.updateIssue(issueNumber, updateData);
    const updatedIssue = updatedIssueResponse.data;
    
    console.log(formatSuccess(`Issue #${issueNumber} updated successfully`));
    
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
    
    // Open in web browser if requested
    if (options.web) {
      try {
        const open = await import('open');
        await open.default(updatedIssue.html_url);
        console.log(formatInfo(`Opened in browser: ${updatedIssue.html_url}`));
      } catch (error) {
        console.log(formatWarning('Failed to open browser'));
      }
    }

  } catch (error) {
    if (error instanceof GitHubAPIClientError) {
      if (error.isNotFound()) {
        console.error(formatError(`Issue #${issueNumber} not found in ${repository.owner}/${repository.name}`));
      } else if (error.isValidationError()) {
        const validationErrors = error.getValidationErrors();
        console.error(formatError('Validation failed:'));
        validationErrors.forEach(err => {
          console.error(formatError(`  ${err.field}: ${err.message}`));
        });
      } else if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to update this issue.'));
      } else {
        console.error(formatError(`GitHub API error: ${error.message}`));
      }
    } else {
      throw error;
    }
  }
}

// Export for use in other commands
export { handleUpdateIssue };