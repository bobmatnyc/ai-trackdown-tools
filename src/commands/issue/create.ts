/**
 * Issue create command - Create new issues with full metadata support
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatSuccess, formatError, formatWarning } from '../../utils/formatters.js';
import type { IssueCreateOptions } from '../../types/commands.js';
import type { CreateIssueRequest } from '../../types/github.js';

export function createIssueCreateCommand(): Command {
  const cmd = new Command('create');
  
  cmd
    .description('Create a new issue')
    .argument('[title]', 'Issue title')
    .option('-b, --body <text>', 'Issue body/description')
    .option('-l, --labels <labels...>', 'Labels to apply (comma-separated or multiple flags)')
    .option('-a, --assignees <users...>', 'Users to assign (comma-separated or multiple flags)')
    .option('--assignee <user>', 'Single user to assign (for GitHub compatibility)')
    .option('-m, --milestone <milestone>', 'Milestone title or number')
    .option('-t, --template <name>', 'Issue template to use')
    .option('--draft', 'Create as draft issue (if supported)')
    .option('--editor', 'Open editor for body text')
    .option('--web', 'Open issue in web browser after creation')
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .action(async (title: string, options: IssueCreateOptions) => {
      try {
        await handleCreateIssue(title, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleCreateIssue(title: string, options: IssueCreateOptions): Promise<void> {
  // Interactive mode if no title provided
  if (!title) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'title',
        message: 'Issue title:',
        validate: (input: string) => input.trim().length > 0 || 'Title is required'
      },
      {
        type: 'editor',
        name: 'body',
        message: 'Issue description (optional):',
        when: !options.body && !options.editor
      }
    ]);
    
    title = answers.title;
    if (!options.body && answers.body) {
      options.body = answers.body;
    }
  }

  // Validate required fields
  if (!title || title.trim().length === 0) {
    throw new Error('Issue title is required');
  }

  // Create GitHub client
  const client = createGitHubClient();
  
  // Get repository info
  const repository = client.getRepository();
  if (!repository) {
    throw new Error('No repository configured. Run "trackdown config repo" to set up repository.');
  }

  // Process labels
  let labels: string[] = [];
  if (options.labels) {
    labels = Array.isArray(options.labels) 
      ? options.labels.flatMap(l => l.split(',').map(s => s.trim()))
      : [options.labels];
  }

  // Process assignees
  let assignees: string[] = [];
  if (options.assignees) {
    assignees = Array.isArray(options.assignees)
      ? options.assignees.flatMap(a => a.split(',').map(s => s.trim()))
      : [options.assignees];
  }
  
  // Add single assignee for GitHub compatibility
  if (options.assignee) {
    assignees.push(options.assignee);
  }

  // Remove duplicates
  assignees = [...new Set(assignees)];
  labels = [...new Set(labels)];

  // Validate assignees exist
  if (assignees.length > 0) {
    console.log(chalk.blue('Validating assignees...'));
    for (const assignee of assignees) {
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

  // Validate labels exist or suggest creating them
  if (labels.length > 0) {
    console.log(chalk.blue('Validating labels...'));
    const missingLabels: string[] = [];
    
    for (const label of labels) {
      const existingLabel = await client.findLabelByName(label);
      if (!existingLabel) {
        missingLabels.push(label);
      }
    }
    
    if (missingLabels.length > 0) {
      console.log(formatWarning(`Labels not found: ${missingLabels.join(', ')}`));
      
      const createLabels = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'create',
          message: 'Create missing labels?',
          default: true
        }
      ]);
      
      if (createLabels.create) {
        for (const labelName of missingLabels) {
          const labelDetails = await inquirer.prompt([
            {
              type: 'input',
              name: 'color',
              message: `Color for label "${labelName}" (without #):`,
              default: 'cccccc',
              validate: (input: string) => /^[0-9a-fA-F]{6}$/.test(input) || 'Please enter a valid 6-digit hex color'
            },
            {
              type: 'input',
              name: 'description',
              message: `Description for label "${labelName}" (optional):`
            }
          ]);
          
          try {
            await client.createLabel({
              name: labelName,
              color: labelDetails.color,
              description: labelDetails.description || undefined
            });
            console.log(formatSuccess(`Created label: ${labelName}`));
          } catch (error) {
            console.log(formatWarning(`Failed to create label "${labelName}": ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        }
      } else {
        // Remove missing labels from the list
        labels = labels.filter(label => !missingLabels.includes(label));
      }
    }
  }

  // Handle milestone
  let milestoneNumber: number | undefined;
  if (options.milestone) {
    console.log(chalk.blue('Resolving milestone...'));
    
    // Try to parse as number first
    const milestoneNum = parseInt(options.milestone, 10);
    if (!isNaN(milestoneNum)) {
      try {
        await client.getMilestone(milestoneNum);
        milestoneNumber = milestoneNum;
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
        milestoneNumber = milestone.number;
      } else {
        throw new Error(`Milestone "${options.milestone}" not found`);
      }
    }
  }

  // Prepare issue data
  const issueData: CreateIssueRequest = {
    title: title.trim(),
    body: options.body?.trim() || undefined,
    labels: labels.length > 0 ? labels : undefined,
    assignees: assignees.length > 0 ? assignees : undefined,
    milestone: milestoneNumber || undefined
  };

  // Show preview
  if (options.verbose) {
    console.log(chalk.blue('\nIssue preview:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`${chalk.bold('Title:')} ${issueData.title}`);
    if (issueData.body) {
      console.log(`${chalk.bold('Body:')} ${issueData.body.substring(0, 100)}${issueData.body.length > 100 ? '...' : ''}`);
    }
    if (issueData.labels && issueData.labels.length > 0) {
      console.log(`${chalk.bold('Labels:')} ${issueData.labels.join(', ')}`);
    }
    if (issueData.assignees && issueData.assignees.length > 0) {
      console.log(`${chalk.bold('Assignees:')} ${issueData.assignees.join(', ')}`);
    }
    if (milestoneNumber) {
      console.log(`${chalk.bold('Milestone:')} #${milestoneNumber}`);
    }
    console.log(chalk.gray('─'.repeat(50)));
  }

  // Create the issue
  console.log(chalk.blue('Creating issue...'));
  
  try {
    const response = await client.createIssue(issueData);
    const issue = response.data;
    
    console.log(formatSuccess(`Issue #${issue.number} created successfully`));
    
    // Format output
    switch (options.format) {
      case 'json':
        console.log(OutputFormatter.formatJSON(issue, { pretty: true }));
        break;
      case 'yaml':
        console.log(OutputFormatter.formatYAML(issue));
        break;
      default:
        console.log('\n' + OutputFormatter.formatIssueDetails(issue));
        break;
    }
    
    // Open in web browser if requested
    if (options.web) {
      const open = await import('open');
      await open.default(issue.html_url);
      console.log(formatInfo(`Opened in browser: ${issue.html_url}`));
    }
    
  } catch (error) {
    if (error instanceof GitHubAPIClientError) {
      if (error.isValidationError()) {
        const validationErrors = error.getValidationErrors();
        console.error(formatError('Validation failed:'));
        validationErrors.forEach(err => {
          console.error(formatError(`  ${err.field}: ${err.message}`));
        });
      } else if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to create issues in this repository.'));
      } else {
        console.error(formatError(`GitHub API error: ${error.message}`));
      }
    } else {
      throw error;
    }
  }
}

// Export for use in other commands
export { handleCreateIssue };