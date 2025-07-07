/**
 * Label update command - Update existing labels (name, color, description)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatSuccess, formatError, formatWarning, formatInfo } from '../../utils/formatters.js';
import type { LabelUpdateOptions } from '../../types/commands.js';
import type { UpdateLabelRequest } from '../../types/github.js';

export function createLabelUpdateCommand(): Command {
  const cmd = new Command('update');
  
  cmd
    .description('Update an existing label')
    .argument('<name>', 'Current label name')
    .option('-n, --new-name <name>', 'New label name')
    .option('-c, --color <color>', 'New label color (6-digit hex without #)')
    .option('-d, --description <text>', 'New label description')
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .action(async (name: string, options: LabelUpdateOptions) => {
      try {
        await handleUpdateLabel(name, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleUpdateLabel(name: string, options: LabelUpdateOptions): Promise<void> {
  // Validate label name
  if (!name || name.trim().length === 0) {
    throw new Error('Label name is required');
  }

  name = name.trim();

  // Check if any update options provided
  const hasUpdates = !!(options.newName || options.color || options.description);
  if (!hasUpdates) {
    throw new Error('No updates specified. Use --help to see available options.');
  }

  // Create GitHub client
  const client = createGitHubClient();
  
  // Get repository info
  const repository = client.getRepository();
  if (!repository) {
    throw new Error('No repository configured. Run "trackdown config repo" to set up repository.');
  }

  try {
    console.log(chalk.blue(`Fetching label "${name}" from ${repository.owner}/${repository.name}...`));
    
    // Get current label
    const currentLabel = await client.findLabelByName(name);
    if (!currentLabel) {
      throw new Error(`Label "${name}" not found`);
    }

    // Show current state if verbose
    if (options.verbose) {
      console.log('');
      console.log(chalk.bold('Current label:'));
      console.log(OutputFormatter.formatLabelsTable([currentLabel]));
      console.log('');
    }

    // Prepare update data
    const updateData: UpdateLabelRequest = {};

    // Handle new name
    if (options.newName) {
      if (options.newName.trim().length === 0) {
        throw new Error('New label name cannot be empty');
      }
      if (options.newName.length > 50) {
        throw new Error('Label name must be 50 characters or less');
      }
      updateData.new_name = options.newName.trim();
      
      // Check if new name conflicts with existing label
      if (options.newName !== name) {
        const conflictingLabel = await client.findLabelByName(options.newName);
        if (conflictingLabel) {
          throw new Error(`Label "${options.newName}" already exists`);
        }
      }
    }

    // Handle color
    if (options.color) {
      // Validate color format
      if (!/^[0-9a-fA-F]{6}$/.test(options.color)) {
        throw new Error('Color must be a 6-digit hex value (e.g., ff0000)');
      }
      updateData.color = options.color;
    }

    // Handle description
    if (options.description !== undefined) {
      if (options.description.length > 100) {
        throw new Error('Description must be 100 characters or less');
      }
      updateData.description = options.description || '';
    }

    // Interactive mode if no options provided
    if (!options.newName && !options.color && !options.description) {
      const updateChoices = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'fields',
          message: 'What would you like to update?',
          choices: [
            { name: 'Name', value: 'name' },
            { name: 'Color', value: 'color' },
            { name: 'Description', value: 'description' }
          ],
          validate: (choices) => choices.length > 0 || 'Please select at least one field to update'
        }
      ]);

      if (updateChoices.fields.includes('name')) {
        const nameAnswer = await inquirer.prompt([
          {
            type: 'input',
            name: 'newName',
            message: 'New label name:',
            default: currentLabel.name,
            validate: (input: string) => {
              if (input.trim().length === 0) return 'Name cannot be empty';
              if (input.length > 50) return 'Name must be 50 characters or less';
              return true;
            }
          }
        ]);
        if (nameAnswer.newName !== currentLabel.name) {
          updateData.new_name = nameAnswer.newName;
        }
      }

      if (updateChoices.fields.includes('color')) {
        const colorAnswer = await inquirer.prompt([
          {
            type: 'input',
            name: 'color',
            message: 'New color (6-digit hex without #):',
            default: currentLabel.color,
            validate: (input: string) => {
              if (!/^[0-9a-fA-F]{6}$/.test(input)) {
                return 'Please enter a valid 6-digit hex color (e.g., ff0000)';
              }
              return true;
            },
            transformer: (input: string) => {
              if (input.length === 6 && /^[0-9a-fA-F]{6}$/.test(input)) {
                return chalk.hex(`#${input}`).bold(`#${input}`);
              }
              return input;
            }
          }
        ]);
        if (colorAnswer.color !== currentLabel.color) {
          updateData.color = colorAnswer.color;
        }
      }

      if (updateChoices.fields.includes('description')) {
        const descAnswer = await inquirer.prompt([
          {
            type: 'input',
            name: 'description',
            message: 'New description:',
            default: currentLabel.description || '',
            validate: (input: string) => {
              if (input.length > 100) return 'Description must be 100 characters or less';
              return true;
            }
          }
        ]);
        if (descAnswer.description !== (currentLabel.description || '')) {
          updateData.description = descAnswer.description;
        }
      }
    }

    // Check if there are actually changes to make
    const hasActualChanges = 
      (updateData.new_name && updateData.new_name !== currentLabel.name) ||
      (updateData.color && updateData.color !== currentLabel.color) ||
      (updateData.description !== undefined && updateData.description !== (currentLabel.description || ''));

    if (!hasActualChanges) {
      console.log(formatInfo('No changes detected. Label remains unchanged.'));
      return;
    }

    // Show preview of changes
    if (options.verbose) {
      console.log(chalk.blue('\nChanges to be made:'));
      console.log(chalk.gray('─'.repeat(50)));
      
      if (updateData.new_name) {
        console.log(`${chalk.bold('Name:')} ${chalk.red(currentLabel.name)} → ${chalk.green(updateData.new_name)}`);
      }
      
      if (updateData.color) {
        console.log(`${chalk.bold('Color:')} ${chalk.hex(`#${currentLabel.color}`).bold(`#${currentLabel.color}`)} → ${chalk.hex(`#${updateData.color}`).bold(`#${updateData.color}`)}`);
      }
      
      if (updateData.description !== undefined) {
        const oldDesc = currentLabel.description || '[empty]';
        const newDesc = updateData.description || '[empty]';
        console.log(`${chalk.bold('Description:')} ${chalk.red(oldDesc)} → ${chalk.green(newDesc)}`);
      }
      
      console.log(chalk.gray('─'.repeat(50)));
    }

    // Update the label
    console.log(chalk.blue('Updating label...'));
    
    const updatedLabelResponse = await client.updateLabel(name, updateData);
    const updatedLabel = updatedLabelResponse.data;
    
    console.log(formatSuccess(`Label "${name}" updated successfully`));
    if (updateData.new_name && updateData.new_name !== name) {
      console.log(formatInfo(`Label renamed to "${updateData.new_name}"`));
    }
    
    // Format output
    switch (options.format) {
      case 'json':
        console.log(OutputFormatter.formatJSON(updatedLabel, { pretty: true }));
        break;
      case 'yaml':
        console.log(OutputFormatter.formatYAML(updatedLabel));
        break;
      default:
        console.log('\n' + OutputFormatter.formatLabelsTable([updatedLabel]));
        break;
    }

    // Show impact information
    if (options.format === 'table') {
      console.log('');
      console.log(chalk.bold.cyan('Impact:'));
      console.log(chalk.gray('─'.repeat(20)));
      
      if (updateData.new_name) {
        console.log(formatInfo('All issues with this label will show the new name'));
      }
      
      if (updateData.color) {
        console.log(formatInfo('Label color will be updated everywhere it appears'));
      }
      
      if (updateData.description !== undefined) {
        console.log(formatInfo('Updated description will appear in label picker'));
      }
      
      console.log('');
      console.log(chalk.bold.cyan('Quick Actions:'));
      console.log(chalk.gray('─'.repeat(30)));
      
      const labelName = updateData.new_name || name;
      console.log(`${chalk.cyan('View issues:')} trackdown issue list --labels "${labelName}"`);
      console.log(`${chalk.cyan('Search issues:')} trackdown issue search 'label:"${labelName}"'`);
      console.log(`${chalk.cyan('Apply to issue:')} trackdown issue update <number> --add-labels "${labelName}"`);
    }

  } catch (error) {
    if (error instanceof GitHubAPIClientError) {
      if (error.isNotFound()) {
        console.error(formatError(`Label "${name}" not found in ${repository.owner}/${repository.name}`));
        console.log(formatInfo('Use "trackdown label list" to see available labels.'));
      } else if (error.isValidationError()) {
        const validationErrors = error.getValidationErrors();
        console.error(formatError('Validation failed:'));
        validationErrors.forEach(err => {
          console.error(formatError(`  ${err.field}: ${err.message}`));
        });
        
        // Provide helpful suggestions
        if (validationErrors.some(err => err.field === 'name')) {
          console.log('');
          console.log(chalk.bold.cyan('Label Name Requirements:'));
          console.log('• Must be 50 characters or less');
          console.log('• Cannot be empty');
          console.log('• Cannot duplicate existing labels');
        }
        
      } else if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to update labels in this repository.'));
      } else {
        console.error(formatError(`GitHub API error: ${error.message}`));
      }
    } else {
      throw error;
    }
  }
}

// Export for use in other commands
export { handleUpdateLabel };