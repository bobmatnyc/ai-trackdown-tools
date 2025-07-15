import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import type { TrackdownItem } from '../types/index.js';
import { ConfigManager } from '../utils/config.js';
import { Formatter } from '../utils/formatter.js';
import { PathResolver } from '../utils/path-resolver.js';
import {
  ValidationError,
  validateAssignee,
  validateId,
  validatePriority,
  validateRequired,
  validateStoryPoints,
  validateTags,
} from '../utils/validation.js';

export function createTrackCommand(): Command {
  const command = new Command('track');

  command
    .description('Track a new task or issue with advanced features')
    .argument('<title>', 'title of the task or issue')
    .option('--priority <level>', 'priority level (low, medium, high, critical)')
    .option('--assignee <name>', 'assign to team member')
    .option('--tags <tags>', 'comma-separated tags')
    .option('--estimate <points>', 'story point estimate')
    .option('--description <text>', 'detailed description')
    .option('--id <id>', 'custom ID for the item')
    .option('--template <name>', 'use specific template')
    .option('--interactive', 'interactive task creation mode')
    .option('--duplicate-from <id>', 'duplicate from existing task')
    .option('--labels <labels>', 'comma-separated labels')
    .option('--due-date <date>', 'due date (YYYY-MM-DD format)')
    .addHelpText(
      'after',
      `
Examples:
  $ aitrackdown track "Implement user login"
  $ aitrackdown track "Fix critical bug" --priority critical --assignee john.doe
  $ aitrackdown track "Add API endpoint" --tags backend,api --estimate 5
  $ aitrackdown track "Design homepage" --interactive
  $ aitrackdown track "Update docs" --duplicate-from TD-123

Priority Levels:
  low       - Nice to have, non-urgent
  medium    - Standard priority (default)
  high      - Important, should be done soon
  critical  - Urgent, blocking other work

Story Points:
  1-2       - Quick fixes or small tasks
  3-5       - Standard features or moderate complexity
  8-13      - Large features or complex tasks
  21+       - Epic-sized work (consider breaking down)
`
    )
    .action(
      async (
        title: string,
        options?: {
          priority?: string;
          assignee?: string;
          tags?: string;
          estimate?: string;
          description?: string;
          id?: string;
          template?: string;
          interactive?: boolean;
          duplicateFrom?: string;
          labels?: string;
          dueDate?: string;
        }
      ) => {
        try {
          // Get CLI root directory option
          const parentCommand = command.parent;
          const rootDirOption = parentCommand?.opts()?.rootDir || parentCommand?.opts()?.tasksDir;

          // Load configuration first
          const configManager = new ConfigManager();
          const config = configManager.getConfig();

          // Initialize path resolver with CLI override
          const pathResolver = new PathResolver(configManager, rootDirOption);

          let taskData = {
            title: title,
            priority: options?.priority || config.defaultPriority || 'medium',
            assignee: options?.assignee,
            tags: options?.tags,
            estimate: options?.estimate,
            description: options?.description,
            id: options?.id,
            template: options?.template || config.defaultTemplate || 'standard',
            labels: options?.labels,
            dueDate: options?.dueDate,
          };

          // Interactive mode
          if (options?.interactive) {
            taskData = await runInteractiveTaskCreation(taskData, config);
          }

          // Duplicate from existing task
          if (options?.duplicateFrom) {
            taskData = await duplicateTask(options.duplicateFrom, taskData);
          }

          // Validate all inputs
          const validatedTitle = validateRequired(taskData.title, 'Title');
          const priority = validatePriority(taskData.priority);
          // Process tags and labels as aliases
          const tagsInput = taskData.tags || taskData.labels;
          const tags = tagsInput ? validateTags(tagsInput) : undefined;
          const labels = tags; // labels is an alias for tags
          const assignee = taskData.assignee
            ? validateAssignee(taskData.assignee)
            : config.autoAssign
              ? config.defaultAssignee
              : undefined;
          const estimate = taskData.estimate ? validateStoryPoints(taskData.estimate) : undefined;
          const itemId = taskData.id ? validateId(taskData.id) : generateId();

          // Show creation progress
          const spinner = ora('Creating trackdown task...').start();

          try {
            // Create trackdown item
            const item: TrackdownItem = {
              id: itemId,
              title: validatedTitle,
              description: taskData.description,
              status: 'todo',
              priority,
              assignee,
              createdAt: new Date(),
              updatedAt: new Date(),
              tags,
              estimate,
              labels,
              metadata: {
                template: taskData.template,
                dueDate: taskData.dueDate,
                source: options?.duplicateFrom ? 'duplicate' : 'new',
                createdBy: process.env.USER || 'unknown',
              },
            };

            spinner.text = 'Setting up task structure...';

            // Ensure active directory exists (using configurable path)
            const activeDir = join(process.cwd(), pathResolver.getActiveDir());
            if (!existsSync(activeDir)) {
              // Check for migration scenario before creating new directories
              if (pathResolver.shouldMigrate()) {
                pathResolver.showMigrationWarning();
                console.log('\nMigration commands:');
                pathResolver.getMigrationCommands().forEach((cmd) => {
                  console.log(Formatter.highlight(cmd));
                });
                process.exit(1);
              }
              mkdirSync(activeDir, { recursive: true });
            }

            // Create the tracking file
            const filename = `${itemId}-${sanitizeFilename(validatedTitle)}.md`;
            const filePath = join(activeDir, filename);

            if (existsSync(filePath)) {
              throw new ValidationError(
                `Item with ID "${itemId}" already exists`,
                'Use a different ID with --id option',
                1,
                'track',
                ['--id TD-NEW-001', '--id feature-auth', '--id bug-fix-123']
              );
            }

            spinner.text = 'Generating task content...';

            // Generate markdown content
            const content = generateMarkdownContent(item, config);
            writeFileSync(filePath, content);

            spinner.succeed('Task created successfully!');

            // Show success message with details
            console.log(
              Formatter.box(
                `
🎯 Task "${validatedTitle}" tracked successfully!

ID: ${itemId}
Priority: ${priority.toUpperCase()}
${assignee ? `Assignee: ${assignee}` : ''}
${estimate ? `Estimate: ${estimate} story points` : ''}
${tags?.length ? `Tags: ${tags.join(', ')}` : ''}
Location: ${filePath}
`,
                'success'
              )
            );

            // Show helpful next steps
            console.log(Formatter.header('Next Steps'));
            console.log(Formatter.info('• View task details:'));
            console.log(Formatter.highlight(`  trackdown status --filter id=${itemId}`));
            console.log(Formatter.info('• Edit the task file:'));
            console.log(Formatter.highlight(`  ${process.env.EDITOR || 'nano'} "${filePath}"`));
            console.log(Formatter.info('• Check project status:'));
            console.log(Formatter.highlight('  trackdown status'));

            // Auto-assign suggestions
            if (!assignee && !config.autoAssign) {
              console.log(Formatter.warning('💡 Consider assigning this task to someone'));
              console.log(
                Formatter.info('  Use: trackdown track --assignee <name> for future tasks')
              );
            }

            // Story point suggestions
            if (!estimate) {
              console.log(Formatter.info('💡 Add story points to help with planning'));
              console.log(Formatter.info('  Use: --estimate <points> (1-100 scale)'));
            }
          } catch (error) {
            spinner.fail('Task creation failed');
            throw error;
          }
        } catch (error) {
          if (error instanceof ValidationError) {
            console.error(Formatter.error(error.message));
            if (error.suggestion) {
              console.log(Formatter.info(`💡 ${error.suggestion}`));
            }
            if (error.validOptions?.length) {
              console.log(Formatter.info('Valid options:'));
              error.validOptions.forEach((option) => {
                console.log(Formatter.highlight(`  ${option}`));
              });
            }
          } else {
            console.error(
              Formatter.error(
                `Failed to track task: ${error instanceof Error ? error.message : 'Unknown error'}`
              )
            );
          }
          process.exit(1);
        }
      }
    );

  return command;
}

async function runInteractiveTaskCreation(taskData: any, config: any) {
  console.log(Formatter.header('📝 Interactive Task Creation'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'title',
      message: 'Task title:',
      default: taskData.title,
      validate: (input: string) => {
        try {
          validateRequired(input, 'Title');
          return true;
        } catch (error) {
          return error instanceof Error ? error.message : 'Invalid title';
        }
      },
    },
    {
      type: 'editor',
      name: 'description',
      message: 'Task description (opens in editor):',
      default: taskData.description || 'Add a detailed description of this task...',
      when: () => process.env.EDITOR !== undefined,
    },
    {
      type: 'input',
      name: 'description',
      message: 'Task description:',
      default: taskData.description,
      when: () => process.env.EDITOR === undefined,
    },
    {
      type: 'list',
      name: 'priority',
      message: 'Priority level:',
      choices: [
        { name: '🟢 Low - Nice to have', value: 'low' },
        { name: '🟡 Medium - Standard priority', value: 'medium' },
        { name: '🟠 High - Important, urgent', value: 'high' },
        { name: '🔴 Critical - Blocking, emergency', value: 'critical' },
      ],
      default: taskData.priority,
    },
    {
      type: 'input',
      name: 'assignee',
      message: 'Assignee (username or email):',
      default: taskData.assignee || config.defaultAssignee,
      validate: (input: string) => {
        if (!input) return true;
        try {
          validateAssignee(input);
          return true;
        } catch (error) {
          return error instanceof Error ? error.message : 'Invalid assignee';
        }
      },
    },
    {
      type: 'input',
      name: 'estimate',
      message: 'Story points (1-100):',
      default: taskData.estimate,
      validate: (input: string) => {
        if (!input) return true;
        try {
          validateStoryPoints(input);
          return true;
        } catch (error) {
          return error instanceof Error ? error.message : 'Invalid story points';
        }
      },
    },
    {
      type: 'input',
      name: 'tags',
      message: 'Tags (comma-separated):',
      default: taskData.tags,
      validate: (input: string) => {
        if (!input) return true;
        try {
          validateTags(input);
          return true;
        } catch (error) {
          return error instanceof Error ? error.message : 'Invalid tags';
        }
      },
    },
    {
      type: 'input',
      name: 'id',
      message: 'Custom ID (leave blank for auto-generated):',
      default: taskData.id,
      validate: (input: string) => {
        if (!input) return true;
        try {
          validateId(input);
          return true;
        } catch (error) {
          return error instanceof Error ? error.message : 'Invalid ID';
        }
      },
    },
  ]);

  return { ...taskData, ...answers };
}

async function duplicateTask(sourceId: string, taskData: any): Promise<any> {
  // This would load an existing task and use it as a template
  // For now, we'll just return the task data with a note
  console.log(Formatter.info(`🔄 Duplicating from task: ${sourceId}`));
  return {
    ...taskData,
    description: `${taskData.description || ''}\n\n*Duplicated from task: ${sourceId}*`,
  };
}

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `TD-${timestamp}-${random}`.toUpperCase();
}

function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

function generateMarkdownContent(item: TrackdownItem, _config: any): string {
  const tagsSection = item.tags?.length
    ? `\n**Tags**: ${item.tags.map((tag) => `\`${tag}\``).join(', ')}`
    : '';

  const labelsSection = item.labels?.length
    ? `\n**Labels**: ${item.labels.map((label) => `\`${label}\``).join(', ')}`
    : '';

  const estimateSection = item.estimate ? `\n**Story Points**: ${item.estimate}` : '';

  const dueDateSection = item.metadata?.dueDate ? `\n**Due Date**: ${item.metadata.dueDate}` : '';

  const metadataSection = `
## Metadata

- **Template**: ${item.metadata?.template || 'standard'}
- **Created By**: ${item.metadata?.createdBy || 'unknown'}
- **Source**: ${item.metadata?.source || 'new'}
${item.metadata?.dueDate ? `- **Due Date**: ${item.metadata.dueDate}` : ''}
`;

  return `# ${item.title}

**ID**: ${item.id}
**Status**: ${item.status}
**Priority**: ${item.priority}
**Assignee**: ${item.assignee || 'Unassigned'}
**Created**: ${item.createdAt.toISOString()}
**Updated**: ${item.updatedAt.toISOString()}${estimateSection}${tagsSection}${labelsSection}${dueDateSection}

## Description

${item.description || 'No description provided.'}

## Acceptance Criteria

- [ ] Define specific and measurable acceptance criteria
- [ ] Ensure criteria are testable and verifiable
- [ ] Add more criteria as needed

## Implementation Notes

<!-- Add technical details, approach, or constraints here -->

## Dependencies

<!-- List any dependencies on other tasks or external factors -->

## Progress Log

- ${item.createdAt.toISOString().split('T')[0]}: Task created

## Resources

<!-- Add links, references, documentation, or related materials here -->

${metadataSection}

---

*Generated by ai-trackdown-tools v1.0.0*
`;
}
