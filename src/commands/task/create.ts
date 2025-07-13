/**
 * Task Create Command
 * Creates new tasks using YAML frontmatter system
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import type { ItemStatus, Priority, TaskFrontmatter } from '../../types/ai-trackdown.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';
import { IdGenerator } from '../../utils/simple-id-generator.js';

interface CreateOptions {
  title?: string;
  issue: string;
  description?: string;
  assignee?: string;
  priority?: Priority;
  status?: ItemStatus;
  template?: string;
  estimatedTokens?: number;
  timeEstimate?: string;
  tags?: string;
  dependencies?: string;
  dryRun?: boolean;
}

export function createTaskCreateCommand(): Command {
  const cmd = new Command('create');

  cmd
    .description('Create a new task within an issue')
    .argument('[title]', 'task title (optional if using --title flag)')
    .option('--title <text>', 'task title (alternative to positional argument)')
    .requiredOption('-i, --issue <issue-id>', 'parent issue ID')
    .option('-d, --description <text>', 'task description')
    .option('-a, --assignee <username>', 'assignee username')
    .option('-p, --priority <level>', 'priority level (low|medium|high|critical)', 'medium')
    .option(
      '-s, --status <status>',
      'initial status (planning|active|completed|archived)',
      'planning'
    )
    .option('-t, --template <name>', 'template to use', 'default')
    .option('--estimated-tokens <number>', 'estimated token usage', '0')
    .option('--time-estimate <duration>', 'estimated time (e.g., 2h, 30m, 1d)')
    .option('--tags <tags>', 'comma-separated tags')
    .option('--dependencies <ids>', 'comma-separated dependency IDs')
    .option('--dry-run', 'show what would be created without creating')
    .action(async (titleArg: string | undefined, options: CreateOptions) => {
      try {
        // Support both positional argument and --title flag
        const title = titleArg || options.title;
        if (!title) {
          throw new Error(
            'Task title is required. Provide it as a positional argument or use --title flag.'
          );
        }
        await createTask(title, options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function createTask(title: string, options: CreateOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();
  const parser = new FrontmatterParser();
  const idGenerator = new IdGenerator();

  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR; // Set by parent command

  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);
  const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);

  // Validate that the issue exists
  const issueHierarchy = relationshipManager.getIssueHierarchy(options.issue);
  if (!issueHierarchy) {
    throw new Error(`Issue not found: ${options.issue}`);
  }

  const issue = issueHierarchy.issue;
  const epicId = issue.epic_id;

  // Generate task ID
  const taskId = idGenerator.generateTaskId(options.issue, title);

  // Get template
  const template = configManager.getTemplateWithFallback('task', options.template || 'default');
  if (!template) {
    throw new Error(`Task template '${options.template || 'default'}' not found`);
  }

  // Parse tags and dependencies
  const tags = options.tags ? options.tags.split(',').map((tag) => tag.trim()) : [];
  const dependencies = options.dependencies
    ? options.dependencies.split(',').map((dep) => dep.trim())
    : [];

  // Create task frontmatter
  const now = new Date().toISOString();
  const taskFrontmatter: TaskFrontmatter = {
    task_id: taskId,
    issue_id: options.issue,
    epic_id: epicId,
    title,
    description: options.description || template.frontmatter_template.description || '',
    status: options.status || 'planning',
    priority: options.priority || 'medium',
    assignee: options.assignee || config.default_assignee || 'unassigned',
    created_date: now,
    updated_date: now,
    estimated_tokens: parseInt(options.estimatedTokens || '0', 10),
    actual_tokens: 0,
    ai_context: template.ai_context_defaults || config.ai_context_templates || [],
    sync_status: 'local',
    subtasks: [],
    parent_task: undefined,
    tags: tags.length > 0 ? tags : undefined,
    dependencies: dependencies.length > 0 ? dependencies : undefined,
    time_estimate: options.timeEstimate,
    time_spent: undefined,
    blocked_by: [],
    blocks: [],
  };

  // Generate content from template
  const content = template.content_template
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{description\}\}/g, taskFrontmatter.description);

  // Create filename
  const filename = `${taskId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}${config.naming_conventions.file_extension}`;
  const filePath = path.join(paths.tasksDir, filename);

  if (options.dryRun) {
    console.log(Formatter.info('Dry run - Task would be created with:'));
    console.log(Formatter.debug(`File: ${filePath}`));
    console.log(Formatter.debug(`Task ID: ${taskId}`));
    console.log(Formatter.debug(`Issue ID: ${options.issue}`));
    console.log(Formatter.debug(`Epic ID: ${epicId}`));
    console.log(Formatter.debug(`Title: ${title}`));
    console.log(Formatter.debug(`Status: ${taskFrontmatter.status}`));
    console.log(Formatter.debug(`Priority: ${taskFrontmatter.priority}`));
    console.log(Formatter.debug(`Assignee: ${taskFrontmatter.assignee}`));
    if (options.timeEstimate) {
      console.log(Formatter.debug(`Time Estimate: ${options.timeEstimate}`));
    }
    if (tags.length > 0) {
      console.log(Formatter.debug(`Tags: ${tags.join(', ')}`));
    }
    if (dependencies.length > 0) {
      console.log(Formatter.debug(`Dependencies: ${dependencies.join(', ')}`));
    }
    return;
  }

  // Check if file already exists
  if (fs.existsSync(filePath)) {
    throw new Error(`Task file already exists: ${filePath}`);
  }

  // Write the task file
  parser.writeTask(filePath, taskFrontmatter, content);

  // Update the issue's related tasks
  const updatedRelatedTasks = [...(issue.related_tasks || []), taskId];
  parser.updateFile(issue.file_path, { related_tasks: updatedRelatedTasks });

  // Refresh cache
  relationshipManager.rebuildCache();

  console.log(Formatter.success(`Task created successfully!`));
  console.log(Formatter.info(`Task ID: ${taskId}`));
  console.log(Formatter.info(`Issue ID: ${options.issue}`));
  console.log(Formatter.info(`Epic ID: ${epicId}`));
  console.log(Formatter.info(`File: ${filePath}`));
  console.log(Formatter.info(`Title: ${title}`));
  console.log(Formatter.info(`Status: ${taskFrontmatter.status}`));
  console.log(Formatter.info(`Priority: ${taskFrontmatter.priority}`));
  console.log(Formatter.info(`Assignee: ${taskFrontmatter.assignee}`));

  if (options.timeEstimate) {
    console.log(Formatter.info(`Time Estimate: ${options.timeEstimate}`));
  }

  if (tags.length > 0) {
    console.log(Formatter.info(`Tags: ${tags.join(', ')}`));
  }

  if (dependencies.length > 0) {
    console.log(Formatter.info(`Dependencies: ${dependencies.join(', ')}`));
  }

  console.log('');
  console.log(Formatter.success(`Task added to issue "${issue.title}"`));
}
