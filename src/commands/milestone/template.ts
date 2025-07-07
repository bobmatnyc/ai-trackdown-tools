/**
 * Milestone template command - Manage milestone templates for recurring sprints
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { OutputFormatter, formatSuccess, formatError, formatWarning, formatInfo } from '../../utils/formatters.js';
import type { MilestoneTemplateOptions } from '../../types/commands.js';

export function createMilestoneTemplateCommand(): Command {
  const cmd = new Command('template');
  
  cmd
    .description('Manage milestone templates for recurring sprints and releases')
    .option('--list', 'List available templates')
    .option('--create <name>', 'Create a new template')
    .option('--delete <name>', 'Delete a template')
    .option('--apply <template>', 'Apply template to create milestone')
    .option('--duration <duration>', 'Template duration (e.g., "2w", "1m")')
    .option('--auto-assign', 'Enable auto-assignment of issues')
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .action(async (options: MilestoneTemplateOptions) => {
      try {
        await handleMilestoneTemplate(options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

// Built-in templates
const BUILTIN_TEMPLATES = {
  'sprint': {
    name: 'Sprint',
    description: 'Standard 2-week sprint template',
    duration: '2w',
    auto_assign: true,
    default_labels: ['sprint'],
    settings: {
      auto_close_completed: true,
      move_incomplete_issues: true,
      generate_summary: true
    }
  },
  'release': {
    name: 'Release',
    description: 'Product release milestone template',
    duration: '4w',
    auto_assign: false,
    default_labels: ['release'],
    settings: {
      auto_close_completed: false,
      move_incomplete_issues: false,
      generate_summary: true
    }
  },
  'hotfix': {
    name: 'Hotfix',
    description: 'Critical hotfix milestone template',
    duration: '3d',
    auto_assign: true,
    default_labels: ['hotfix', 'critical'],
    settings: {
      auto_close_completed: true,
      move_incomplete_issues: false,
      generate_summary: false
    }
  },
  'epic': {
    name: 'Epic',
    description: 'Large feature epic milestone template',
    duration: '12w',
    auto_assign: false,
    default_labels: ['epic'],
    settings: {
      auto_close_completed: false,
      move_incomplete_issues: true,
      generate_summary: true
    }
  }
};

async function handleMilestoneTemplate(options: MilestoneTemplateOptions): Promise<void> {
  // List templates
  if (options.list) {
    await listTemplates(options);
    return;
  }

  // Create template
  if (options.create) {
    await createTemplate(options.create, options);
    return;
  }

  // Delete template
  if (options.delete) {
    await deleteTemplate(options.delete, options);
    return;
  }

  // Apply template
  if (options.apply) {
    await applyTemplate(options.apply, options);
    return;
  }

  // Default: show help
  console.log(chalk.bold.cyan('🎯 Milestone Templates\n'));
  console.log('Milestone templates help you create consistent milestones for recurring workflows.\n');
  
  console.log(chalk.bold('Available Commands:'));
  console.log(chalk.gray('─'.repeat(30)));
  console.log(`${chalk.cyan('List templates:')} aitrackdown milestone template --list`);
  console.log(`${chalk.cyan('Create template:')} aitrackdown milestone template --create "my-template"`);
  console.log(`${chalk.cyan('Apply template:')} aitrackdown milestone template --apply "sprint"`);
  console.log(`${chalk.cyan('Delete template:')} aitrackdown milestone template --delete "my-template"`);
  console.log('');
  
  console.log(chalk.bold('Built-in Templates:'));
  console.log(chalk.gray('─'.repeat(25)));
  Object.entries(BUILTIN_TEMPLATES).forEach(([key, template]) => {
    console.log(`${chalk.cyan(key.padEnd(8))} - ${template.description}`);
  });
}

async function listTemplates(options: MilestoneTemplateOptions): Promise<void> {
  console.log(chalk.blue('Loading milestone templates...'));
  
  // Get custom templates (would be stored in config)
  const customTemplates = getCustomTemplates();
  const allTemplates = { ...BUILTIN_TEMPLATES, ...customTemplates };

  if (Object.keys(allTemplates).length === 0) {
    console.log(formatInfo('No templates found. Create your first template with --create'));
    return;
  }

  switch (options.format) {
    case 'json':
      console.log(OutputFormatter.formatJSON(allTemplates, { pretty: true }));
      break;
    
    case 'yaml':
      console.log(OutputFormatter.formatYAML(allTemplates));
      break;
    
    default:
      console.log(formatInfo(`Found ${Object.keys(allTemplates).length} template${Object.keys(allTemplates).length === 1 ? '' : 's'}`));
      console.log('');
      console.log(formatTemplatesTable(allTemplates));
      break;
  }

  // Show usage examples
  if (options.format === 'table') {
    console.log('');
    console.log(chalk.bold.cyan('Usage Examples:'));
    console.log(chalk.gray('─'.repeat(30)));
    console.log(`${chalk.cyan('Apply template:')} aitrackdown milestone template --apply "sprint"`);
    console.log(`${chalk.cyan('Create from template:')} aitrackdown milestone create "Sprint 15" --template "sprint"`);
    console.log(`${chalk.cyan('Custom template:')} aitrackdown milestone template --create "my-sprint" --duration "3w"`);
  }
}

async function createTemplate(name: string, options: MilestoneTemplateOptions): Promise<void> {
  console.log(chalk.blue(`Creating milestone template "${name}"...`));
  
  // Check if template already exists
  const existingTemplates = { ...BUILTIN_TEMPLATES, ...getCustomTemplates() };
  if (existingTemplates[name]) {
    const overwrite = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Template "${name}" already exists. Overwrite?`,
        default: false
      }
    ]);
    
    if (!overwrite.confirm) {
      console.log(formatInfo('Template creation cancelled'));
      return;
    }
  }

  // Collect template details
  const templateData = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Template description:',
      validate: (input: string) => input.length > 0 || 'Description is required'
    },
    {
      type: 'input',
      name: 'duration',
      message: 'Default duration (e.g., "2w", "1m", "30d"):',
      default: options.duration || '2w',
      validate: (input: string) => {
        if (!/^\d+[dwmy]$/.test(input)) {
          return 'Duration must be in format like "2w", "1m", "30d"';
        }
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'autoAssign',
      message: 'Enable auto-assignment of issues?',
      default: options.autoAssign || false
    },
    {
      type: 'input',
      name: 'defaultLabels',
      message: 'Default labels (comma-separated):',
      filter: (input: string) => input.split(',').map(l => l.trim()).filter(l => l.length > 0)
    },
    {
      type: 'confirm',
      name: 'autoCloseCompleted',
      message: 'Auto-close milestone when all issues are completed?',
      default: true
    },
    {
      type: 'confirm',
      name: 'moveIncompleteIssues',
      message: 'Move incomplete issues to next milestone when closing?',
      default: true
    },
    {
      type: 'confirm',
      name: 'generateSummary',
      message: 'Generate completion summary when closing?',
      default: true
    }
  ]);

  const template = {
    name: templateData.description,
    description: templateData.description,
    duration: templateData.duration,
    auto_assign: templateData.autoAssign,
    default_labels: templateData.defaultLabels,
    settings: {
      auto_close_completed: templateData.autoCloseCompleted,
      move_incomplete_issues: templateData.moveIncompleteIssues,
      generate_summary: templateData.generateSummary
    },
    created_at: new Date().toISOString(),
    custom: true
  };

  // Save template (would be saved to config)
  saveCustomTemplate(name, template);
  
  console.log(formatSuccess(`Template "${name}" created successfully`));
  console.log('');
  console.log(formatTemplateDetails(template));
  
  console.log('');
  console.log(chalk.bold.cyan('Usage:'));
  console.log(`${chalk.cyan('Apply template:')} aitrackdown milestone template --apply "${name}"`);
  console.log(`${chalk.cyan('Create milestone:')} aitrackdown milestone create "Title" --template "${name}"`);
}

async function deleteTemplate(name: string, options: MilestoneTemplateOptions): Promise<void> {
  console.log(chalk.blue(`Deleting milestone template "${name}"...`));
  
  // Check if it's a built-in template
  if (BUILTIN_TEMPLATES[name]) {
    console.error(formatError('Cannot delete built-in templates'));
    return;
  }

  // Check if template exists
  const customTemplates = getCustomTemplates();
  if (!customTemplates[name]) {
    console.error(formatError(`Template "${name}" not found`));
    return;
  }

  // Confirm deletion
  const confirm = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete template "${name}"?`,
      default: false
    }
  ]);

  if (!confirm.confirm) {
    console.log(formatInfo('Template deletion cancelled'));
    return;
  }

  // Delete template
  deleteCustomTemplate(name);
  console.log(formatSuccess(`Template "${name}" deleted successfully`));
}

async function applyTemplate(templateName: string, options: MilestoneTemplateOptions): Promise<void> {
  console.log(chalk.blue(`Applying milestone template "${templateName}"...`));
  
  // Find template
  const allTemplates = { ...BUILTIN_TEMPLATES, ...getCustomTemplates() };
  const template = allTemplates[templateName];
  
  if (!template) {
    console.error(formatError(`Template "${templateName}" not found`));
    console.log(formatInfo('Use --list to see available templates'));
    return;
  }

  // Collect milestone details
  const milestoneData = await inquirer.prompt([
    {
      type: 'input',
      name: 'title',
      message: 'Milestone title:',
      validate: (input: string) => input.length > 0 || 'Title is required'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Milestone description (optional):',
      default: template.description
    },
    {
      type: 'confirm',
      name: 'setDueDate',
      message: 'Set due date based on template duration?',
      default: true
    }
  ]);

  // Calculate due date
  let dueDate: string | undefined;
  if (milestoneData.setDueDate) {
    const duration = parseDuration(template.duration);
    const future = new Date(Date.now() + duration);
    dueDate = future.toISOString().split('T')[0];
  }

  // Show preview
  console.log('');
  console.log(chalk.blue('Milestone Preview:'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`${chalk.bold('Title:')} ${milestoneData.title}`);
  console.log(`${chalk.bold('Description:')} ${milestoneData.description || chalk.gray('none')}`);
  console.log(`${chalk.bold('Due date:')} ${dueDate || chalk.gray('none')}`);
  console.log(`${chalk.bold('Template:')} ${templateName} (${template.duration})`);
  console.log(`${chalk.bold('Auto-assign:')} ${template.auto_assign ? 'Yes' : 'No'}`);
  console.log(`${chalk.bold('Default labels:')} ${template.default_labels?.join(', ') || chalk.gray('none')}`);

  const proceed = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Create milestone with these settings?',
      default: true
    }
  ]);

  if (!proceed.confirm) {
    console.log(formatInfo('Milestone creation cancelled'));
    return;
  }

  // Create milestone command
  const createCommand = [
    'aitrackdown milestone create',
    `"${milestoneData.title}"`,
    milestoneData.description ? `--description "${milestoneData.description}"` : '',
    dueDate ? `--due-date "${dueDate}"` : '',
    template.default_labels?.length ? `--labels "${template.default_labels.join(',')}"` : ''
  ].filter(Boolean).join(' ');

  console.log('');
  console.log(formatSuccess('Template applied successfully!'));
  console.log('');
  console.log(chalk.bold.cyan('Next steps:'));
  console.log(`${chalk.cyan('Create milestone:')} ${createCommand}`);
  
  if (template.auto_assign) {
    console.log(`${chalk.cyan('Auto-assign issues:')} aitrackdown milestone assign <issues> "${milestoneData.title}"`);
  }
}

function formatTemplatesTable(templates: Record<string, any>): string {
  const rows = Object.entries(templates).map(([key, template]) => [
    key,
    template.description,
    template.duration,
    template.auto_assign ? 'Yes' : 'No',
    template.custom ? 'Custom' : 'Built-in'
  ]);

  return OutputFormatter.formatTable(
    ['Name', 'Description', 'Duration', 'Auto-assign', 'Type'],
    rows,
    { format: 'table' }
  );
}

function formatTemplateDetails(template: any): string {
  let details = '';
  details += `${chalk.bold('Name:')} ${template.name}\n`;
  details += `${chalk.bold('Description:')} ${template.description}\n`;
  details += `${chalk.bold('Duration:')} ${template.duration}\n`;
  details += `${chalk.bold('Auto-assign:')} ${template.auto_assign ? 'Yes' : 'No'}\n`;
  details += `${chalk.bold('Default labels:')} ${template.default_labels?.join(', ') || 'none'}\n`;
  details += `${chalk.bold('Auto-close completed:')} ${template.settings.auto_close_completed ? 'Yes' : 'No'}\n`;
  details += `${chalk.bold('Move incomplete issues:')} ${template.settings.move_incomplete_issues ? 'Yes' : 'No'}\n`;
  details += `${chalk.bold('Generate summary:')} ${template.settings.generate_summary ? 'Yes' : 'No'}\n`;
  
  return details;
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([dwmy])$/);
  if (!match) {
    throw new Error('Invalid duration format');
  }

  const [, num, unit] = match;
  const value = parseInt(num);

  switch (unit) {
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    case 'm': return value * 30 * 24 * 60 * 60 * 1000;
    case 'y': return value * 365 * 24 * 60 * 60 * 1000;
    default: throw new Error('Invalid duration unit');
  }
}

// Mock functions for template storage (would be implemented with actual config)
function getCustomTemplates(): Record<string, any> {
  // In real implementation, this would read from config file
  return {};
}

function saveCustomTemplate(name: string, template: any): void {
  // In real implementation, this would save to config file
  console.log(formatInfo('Note: Template storage not implemented in this version'));
}

function deleteCustomTemplate(name: string): void {
  // In real implementation, this would delete from config file
  console.log(formatInfo('Note: Template storage not implemented in this version'));
}

// Export for use in other commands
export { handleMilestoneTemplate };