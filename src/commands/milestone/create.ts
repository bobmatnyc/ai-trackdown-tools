/**
 * Milestone create command - Create new milestones with due dates and progress tracking
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatSuccess, formatError, formatWarning, formatInfo } from '../../utils/formatters.js';
import type { MilestoneCreateOptions } from '../../types/commands.js';
import type { CreateMilestoneRequest } from '../../types/github.js';

export function createMilestoneCreateCommand(): Command {
  const cmd = new Command('create');
  
  cmd
    .description('Create a new milestone')
    .argument('<title>', 'Milestone title')
    .option('-d, --description <text>', 'Milestone description')
    .option('--due-date <date>', 'Due date (YYYY-MM-DD format)')
    .option('-s, --state <state>', 'Milestone state (open, closed)', 'open')
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .action(async (title: string, options: MilestoneCreateOptions) => {
      try {
        await handleCreateMilestone(title, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleCreateMilestone(title: string, options: MilestoneCreateOptions): Promise<void> {
  // Validate milestone title
  if (!title || title.trim().length === 0) {
    throw new Error('Milestone title is required');
  }

  title = title.trim();

  // Validate title constraints
  if (title.length > 255) {
    throw new Error('Milestone title must be 255 characters or less');
  }

  // Validate state
  if (options.state && !['open', 'closed'].includes(options.state)) {
    throw new Error('State must be "open" or "closed"');
  }

  // Create GitHub client
  const client = createGitHubClient();
  
  // Get repository info
  const repository = client.getRepository();
  if (!repository) {
    throw new Error('No repository configured. Run "aitrackdown config repo" to set up repository.');
  }

  try {
    // Check if milestone already exists
    console.log(chalk.blue(`Checking if milestone "${title}" exists in ${repository.owner}/${repository.name}...`));
    
    const existingMilestone = await client.findMilestoneByTitle(title);
    if (existingMilestone) {
      console.log(formatWarning(`Milestone "${title}" already exists`));
      console.log('');
      console.log(OutputFormatter.formatMilestonesTable([existingMilestone]));
      
      const overwrite = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Do you want to view the existing milestone details?',
          default: true
        }
      ]);
      
      if (overwrite.confirm) {
        console.log('');
        console.log(OutputFormatter.formatMilestoneProgress(existingMilestone, { detailed: true }));
      }
      
      console.log(formatInfo('Use "aitrackdown milestone update" to modify existing milestones'));
      return;
    }

    // Handle due date
    let dueDate: string | undefined = options.dueDate;
    
    if (!dueDate) {
      const dateAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'setDueDate',
          message: 'Set a due date for this milestone?',
          default: true
        }
      ]);
      
      if (dateAnswer.setDueDate) {
        const dueDateAnswer = await inquirer.prompt([
          {
            type: 'list',
            name: 'dateType',
            message: 'How would you like to set the due date?',
            choices: [
              { name: 'Enter specific date (YYYY-MM-DD)', value: 'specific' },
              { name: 'Choose from common periods', value: 'relative' },
              { name: 'No due date', value: 'none' }
            ]
          }
        ]);
        
        if (dueDateAnswer.dateType === 'specific') {
          const specificDateAnswer = await inquirer.prompt([
            {
              type: 'input',
              name: 'date',
              message: 'Enter due date (YYYY-MM-DD):',
              validate: (input: string) => {
                if (!input) return true; // Allow empty for no due date
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(input)) {
                  return 'Please enter date in YYYY-MM-DD format';
                }
                const date = new Date(input);
                if (isNaN(date.getTime())) {
                  return 'Please enter a valid date';
                }
                if (date < new Date()) {
                  return 'Due date should be in the future';
                }
                return true;
              }
            }
          ]);
          dueDate = specificDateAnswer.date || undefined;
          
        } else if (dueDateAnswer.dateType === 'relative') {
          const relativeAnswer = await inquirer.prompt([
            {
              type: 'list',
              name: 'period',
              message: 'Select milestone duration:',
              choices: [
                { name: '1 week from now', value: 7 },
                { name: '2 weeks from now', value: 14 },
                { name: '1 month from now', value: 30 },
                { name: '2 months from now', value: 60 },
                { name: '3 months from now', value: 90 },
                { name: '6 months from now', value: 180 }
              ]
            }
          ]);
          
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + relativeAnswer.period);
          dueDate = futureDate.toISOString().split('T')[0];
        }
      }
    } else {
      // Validate provided due date
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dueDate)) {
        throw new Error('Due date must be in YYYY-MM-DD format');
      }
      
      const date = new Date(dueDate);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid due date');
      }
      
      if (date < new Date()) {
        console.log(formatWarning('Due date is in the past'));
      }
    }

    // Get description if not provided
    let description = options.description;
    if (!description) {
      const descAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message: 'Milestone description (optional):',
          validate: (input: string) => {
            if (input.length > 1000) {
              return 'Description must be 1000 characters or less';
            }
            return true;
          }
        }
      ]);
      description = descAnswer.description;
    }

    // Prepare milestone data
    const milestoneData: CreateMilestoneRequest = {
      title,
      description: description || undefined,
      due_on: dueDate ? new Date(dueDate + 'T23:59:59Z').toISOString() : undefined,
      state: options.state || 'open'
    };

    // Show preview
    if (options.verbose) {
      console.log('');
      console.log(chalk.blue('Milestone preview:'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`${chalk.bold('Title:')} ${title}`);
      console.log(`${chalk.bold('Description:')} ${description || chalk.gray('none')}`);
      console.log(`${chalk.bold('Due date:')} ${dueDate || chalk.gray('none')}`);
      console.log(`${chalk.bold('State:')} ${milestoneData.state}`);
      console.log(chalk.gray('─'.repeat(40)));
    }

    // Create the milestone
    console.log(chalk.blue('Creating milestone...'));
    
    const response = await client.createMilestone(milestoneData);
    const milestone = response.data;
    
    console.log(formatSuccess(`Milestone "${title}" created successfully`));
    console.log(formatInfo(`Milestone number: #${milestone.number}`));
    
    // Format output
    switch (options.format) {
      case 'json':
        console.log(OutputFormatter.formatJSON(milestone, { pretty: true }));
        break;
      case 'yaml':
        console.log(OutputFormatter.formatYAML(milestone));
        break;
      default:
        console.log('');
        console.log(OutputFormatter.formatMilestoneProgress(milestone, { detailed: true }));
        break;
    }
    
    // Show usage examples
    if (options.format === 'table') {
      console.log('');
      console.log(chalk.bold.cyan('Usage Examples:'));
      console.log(chalk.gray('─'.repeat(30)));
      console.log(`${chalk.cyan('Assign to issue:')} aitrackdown issue update <number> --milestone "${title}"`);
      console.log(`${chalk.cyan('Create issue:')} aitrackdown issue create "Title" --milestone "${title}"`);
      console.log(`${chalk.cyan('List issues:')} aitrackdown issue list --milestone "${title}"`);
      console.log(`${chalk.cyan('Search issues:')} aitrackdown issue search 'milestone:"${title}"'`);
      console.log(`${chalk.cyan('View progress:')} aitrackdown milestone progress "${title}"`);
    }

    // Show timeline information
    if (dueDate && options.format === 'table') {
      console.log('');
      console.log(chalk.bold.cyan('Timeline:'));
      console.log(chalk.gray('─'.repeat(20)));
      
      const due = new Date(dueDate);
      const now = new Date();
      const diffTime = due.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0) {
        console.log(`${chalk.bold('Time remaining:')} ${diffDays} days`);
        console.log(`${chalk.bold('Due date:')} ${due.toLocaleDateString()}`);
        
        if (diffDays <= 7) {
          console.log(formatWarning('Due date is within one week'));
        } else if (diffDays <= 30) {
          console.log(formatInfo('Due date is within one month'));
        }
      } else {
        console.log(formatWarning('Due date has passed'));
      }
    }

  } catch (error) {
    if (error instanceof GitHubAPIClientError) {
      if (error.isValidationError()) {
        const validationErrors = error.getValidationErrors();
        console.error(formatError('Validation failed:'));
        validationErrors.forEach(err => {
          console.error(formatError(`  ${err.field}: ${err.message}`));
        });
        
        // Provide helpful suggestions
        if (validationErrors.some(err => err.field === 'title')) {
          console.log('');
          console.log(chalk.bold.cyan('Milestone Title Requirements:'));
          console.log('• Must be 255 characters or less');
          console.log('• Cannot be empty');
          console.log('• Should be descriptive and unique');
          console.log('• Examples: "v1.0 Release", "Sprint 1", "Q1 2024 Goals"');
        }
        
        if (validationErrors.some(err => err.field === 'due_on')) {
          console.log('');
          console.log(chalk.bold.cyan('Due Date Requirements:'));
          console.log('• Must be in ISO 8601 format (YYYY-MM-DD)');
          console.log('• Should be a future date');
          console.log('• Time is set to end of day (23:59:59)');
        }
        
      } else if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to create milestones in this repository.'));
      } else {
        console.error(formatError(`GitHub API error: ${error.message}`));
      }
    } else {
      throw error;
    }
  }
}

// Export for use in other commands
export { handleCreateMilestone };