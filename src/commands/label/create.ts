/**
 * Label create command - Create new labels with color and description
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatSuccess, formatError, formatWarning, formatInfo } from '../../utils/formatters.js';
import type { LabelCreateOptions } from '../../types/commands.js';
import type { CreateLabelRequest } from '../../types/github.js';

export function createLabelCreateCommand(): Command {
  const cmd = new Command('create');
  
  cmd
    .description('Create a new label')
    .argument('<name>', 'Label name')
    .option('-c, --color <color>', 'Label color (6-digit hex without #)')
    .option('-d, --description <text>', 'Label description')
    .option('--force', 'Force creation even if label exists')
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .action(async (name: string, options: LabelCreateOptions) => {
      try {
        await handleCreateLabel(name, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

// Predefined color schemes for quick selection
const COLOR_PRESETS: Record<string, { color: string; description: string }> = {
  'bug': { color: 'd73a4a', description: 'Something isn\'t working' },
  'documentation': { color: '0075ca', description: 'Improvements or additions to documentation' },
  'duplicate': { color: 'cfd3d7', description: 'This issue or pull request already exists' },
  'enhancement': { color: 'a2eeef', description: 'New feature or request' },
  'good-first-issue': { color: '7057ff', description: 'Good for newcomers' },
  'help-wanted': { color: '008672', description: 'Extra attention is needed' },
  'invalid': { color: 'e4e669', description: 'This doesn\'t seem right' },
  'question': { color: 'd876e3', description: 'Further information is requested' },
  'wontfix': { color: 'ffffff', description: 'This will not be worked on' },
  'priority-high': { color: 'ff0000', description: 'High priority' },
  'priority-medium': { color: 'ff8c00', description: 'Medium priority' },
  'priority-low': { color: '00ff00', description: 'Low priority' },
  'status-blocked': { color: 'ff6b6b', description: 'Blocked by other work' },
  'status-in-progress': { color: 'ffeb3b', description: 'Currently being worked on' },
  'status-ready': { color: '4caf50', description: 'Ready to be worked on' },
  'type-feature': { color: '2196f3', description: 'New feature' },
  'type-bugfix': { color: 'f44336', description: 'Bug fix' },
  'type-improvement': { color: '9c27b0', description: 'Improvement to existing feature' },
  'effort-small': { color: 'c5f015', description: 'Small effort required' },
  'effort-medium': { color: 'ff9800', description: 'Medium effort required' },
  'effort-large': { color: 'ff5722', description: 'Large effort required' }
};

async function handleCreateLabel(name: string, options: LabelCreateOptions): Promise<void> {
  // Validate label name
  if (!name || name.trim().length === 0) {
    throw new Error('Label name is required');
  }

  name = name.trim();

  // Validate label name constraints
  if (name.length > 50) {
    throw new Error('Label name must be 50 characters or less');
  }

  // Create GitHub client
  const client = createGitHubClient();
  
  // Get repository info
  const repository = client.getRepository();
  if (!repository) {
    throw new Error('No repository configured. Run "trackdown config repo" to set up repository.');
  }

  try {
    // Check if label already exists
    console.log(chalk.blue(`Checking if label "${name}" exists in ${repository.owner}/${repository.name}...`));
    
    const existingLabel = await client.findLabelByName(name);
    if (existingLabel && !options.force) {
      console.log(formatWarning(`Label "${name}" already exists`));
      console.log('');
      console.log(OutputFormatter.formatLabelsTable([existingLabel]));
      
      const overwrite = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Do you want to update the existing label?',
          default: false
        }
      ]);
      
      if (!overwrite.confirm) {
        console.log(formatInfo('Operation cancelled'));
        return;
      }
      
      // Update existing label instead
      console.log(formatInfo('Use "trackdown label update" to modify existing labels'));
      return;
    }

    // Get color - interactive selection if not provided
    let color = options.color;
    
    if (!color) {
      // Check if it's a preset label
      const preset = COLOR_PRESETS[name.toLowerCase()];
      if (preset) {
        const usePreset = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Use preset color for "${name}" (${chalk.hex(`#${preset.color}`).bold(`#${preset.color}`)})?`,
            default: true
          }
        ]);
        
        if (usePreset.confirm) {
          color = preset.color;
          if (!options.description) {
            options.description = preset.description;
          }
        }
      }
      
      if (!color) {
        // Show color picker
        const colorAnswer = await inquirer.prompt([
          {
            type: 'list',
            name: 'colorChoice',
            message: 'Choose color selection method:',
            choices: [
              { name: 'Pick from presets', value: 'preset' },
              { name: 'Enter custom hex color', value: 'custom' },
              { name: 'Use random color', value: 'random' }
            ]
          }
        ]);
        
        switch (colorAnswer.colorChoice) {
          case 'preset':
            const presetChoices = Object.entries(COLOR_PRESETS).map(([key, value]) => ({
              name: `${chalk.hex(`#${value.color}`).bold(key.padEnd(20))} ${chalk.gray(value.description)}`,
              value: value.color,
              short: key
            }));
            
            const presetAnswer = await inquirer.prompt([
              {
                type: 'list',
                name: 'color',
                message: 'Select a preset color:',
                choices: presetChoices,
                pageSize: 15
              }
            ]);
            color = presetAnswer.color;
            break;
            
          case 'custom':
            const customAnswer = await inquirer.prompt([
              {
                type: 'input',
                name: 'color',
                message: 'Enter hex color (without #):',
                default: 'cccccc',
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
            color = customAnswer.color;
            break;
            
          case 'random':
            color = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
            console.log(formatInfo(`Generated random color: ${chalk.hex(`#${color}`).bold(`#${color}`)}`));
            break;
        }
      }
    }

    // Validate color format
    if (!color || !/^[0-9a-fA-F]{6}$/.test(color)) {
      throw new Error('Color must be a 6-digit hex value (e.g., ff0000)');
    }

    // Get description if not provided
    let description = options.description;
    if (!description) {
      const descAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message: 'Label description (optional):',
          validate: (input: string) => {
            if (input.length > 100) {
              return 'Description must be 100 characters or less';
            }
            return true;
          }
        }
      ]);
      description = descAnswer.description;
    }

    // Prepare label data
    const labelData: CreateLabelRequest = {
      name,
      color,
      description: description || undefined
    };

    // Show preview
    if (options.verbose) {
      console.log('');
      console.log(chalk.blue('Label preview:'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`${chalk.bold('Name:')} ${chalk.hex(`#${color}`).bold(name)}`);
      console.log(`${chalk.bold('Color:')} ${chalk.hex(`#${color}`).bold(`#${color}`)}`);
      console.log(`${chalk.bold('Description:')} ${description || chalk.gray('none')}`);
      console.log(chalk.gray('─'.repeat(40)));
    }

    // Create the label
    console.log(chalk.blue('Creating label...'));
    
    const response = await client.createLabel(labelData);
    const label = response.data;
    
    console.log(formatSuccess(`Label "${name}" created successfully`));
    
    // Format output
    switch (options.format) {
      case 'json':
        console.log(OutputFormatter.formatJSON(label, { pretty: true }));
        break;
      case 'yaml':
        console.log(OutputFormatter.formatYAML(label));
        break;
      default:
        console.log('');
        console.log(OutputFormatter.formatLabelsTable([label]));
        break;
    }
    
    // Show usage examples
    if (options.format === 'table') {
      console.log('');
      console.log(chalk.bold.cyan('Usage Examples:'));
      console.log(chalk.gray('─'.repeat(30)));
      console.log(`${chalk.cyan('Apply to issue:')} trackdown issue update <number> --add-labels "${name}"`);
      console.log(`${chalk.cyan('Create issue:')} trackdown issue create "Title" --labels "${name}"`);
      console.log(`${chalk.cyan('Search issues:')} trackdown issue search 'label:"${name}"'`);
      console.log(`${chalk.cyan('List issues:')} trackdown issue list --labels "${name}"`);
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
        if (validationErrors.some(err => err.field === 'name')) {
          console.log('');
          console.log(chalk.bold.cyan('Label Name Requirements:'));
          console.log('• Must be 50 characters or less');
          console.log('• Cannot be empty');
          console.log('• Case sensitive');
          console.log('• Cannot duplicate existing labels');
        }
        
        if (validationErrors.some(err => err.field === 'color')) {
          console.log('');
          console.log(chalk.bold.cyan('Color Requirements:'));
          console.log('• Must be exactly 6 hexadecimal characters');
          console.log('• Do not include the # symbol');
          console.log('• Examples: ff0000 (red), 00ff00 (green), 0000ff (blue)');
        }
        
      } else if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to create labels in this repository.'));
      } else {
        console.error(formatError(`GitHub API error: ${error.message}`));
      }
    } else {
      throw error;
    }
  }
}

// Export for use in other commands
export { handleCreateLabel };