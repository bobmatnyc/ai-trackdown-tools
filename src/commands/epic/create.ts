/**
 * Epic Create Command
 * Creates new epics using YAML frontmatter system
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from '../../utils/config-manager.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';
import { IdGenerator } from '../../utils/simple-id-generator.js';
import { TrackdownIndexManager } from '../../utils/trackdown-index-manager.js';
import type { EpicFrontmatter, ItemStatus, Priority } from '../../types/ai-trackdown.js';
import { Formatter } from '../../utils/formatter.js';

interface CreateOptions {
  description?: string;
  assignee?: string;
  priority?: Priority;
  status?: ItemStatus;
  template?: string;
  estimatedTokens?: number;
  tags?: string;
  milestone?: string;
  dryRun?: boolean;
}

export function createEpicCreateCommand(): Command {
  const cmd = new Command('create');
  
  cmd
    .description('Create a new epic')
    .argument('<title>', 'epic title')
    .option('-d, --description <text>', 'epic description')
    .option('-a, --assignee <username>', 'assignee username')
    .option('-p, --priority <level>', 'priority level (low|medium|high|critical)', 'medium')
    .option('-s, --status <status>', 'initial status (planning|active|completed|archived)', 'planning')
    .option('-t, --template <name>', 'template to use', 'default')
    .option('-e, --estimated-tokens <number>', 'estimated token usage', '0')
    .option('--tags <tags>', 'comma-separated tags')
    .option('-m, --milestone <name>', 'milestone name')
    .option('--dry-run', 'show what would be created without creating')
    .action(async (title: string, options: CreateOptions) => {
      try {
        await createEpic(title, options);
      } catch (error) {
        console.error(Formatter.error(`Failed to create epic: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}

async function createEpic(title: string, options: CreateOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();
  const parser = new FrontmatterParser();
  const idGenerator = new IdGenerator();
  
  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR; // Set by parent command
  
  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);
  
  // Generate epic ID
  const epicId = idGenerator.generateEpicId(title);
  
  // Get template with fallback to bundled templates
  const template = configManager.getTemplateWithFallback('epic', options.template || 'default');
  if (!template) {
    throw new Error(`Epic template '${options.template || 'default'}' not found`);
  }
  
  // Parse tags
  const tags = options.tags ? options.tags.split(',').map(tag => tag.trim()) : [];
  
  // Create epic frontmatter
  const now = new Date().toISOString();
  const epicFrontmatter: EpicFrontmatter = {
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
    related_issues: [],
    tags: tags.length > 0 ? tags : undefined,
    milestone: options.milestone,
    dependencies: [],
    completion_percentage: 0
  };
  
  // Generate content from template
  const content = template.content_template
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{description\}\}/g, epicFrontmatter.description);
  
  // Create filename
  const filename = `${epicId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}${config.naming_conventions.file_extension}`;
  const filePath = path.join(paths.epicsDir, filename);
  
  if (options.dryRun) {
    console.log(Formatter.info('Dry run - Epic would be created with:'));
    console.log(Formatter.debug(`File: ${filePath}`));
    console.log(Formatter.debug(`Epic ID: ${epicId}`));
    console.log(Formatter.debug(`Title: ${title}`));
    console.log(Formatter.debug(`Status: ${epicFrontmatter.status}`));
    console.log(Formatter.debug(`Priority: ${epicFrontmatter.priority}`));
    console.log(Formatter.debug(`Assignee: ${epicFrontmatter.assignee}`));
    if (tags.length > 0) {
      console.log(Formatter.debug(`Tags: ${tags.join(', ')}`));
    }
    if (options.milestone) {
      console.log(Formatter.debug(`Milestone: ${options.milestone}`));
    }
    return;
  }
  
  // Check if file already exists
  if (fs.existsSync(filePath)) {
    throw new Error(`Epic file already exists: ${filePath}`);
  }
  
  // Write the epic file
  parser.writeEpic(filePath, epicFrontmatter, content);
  
  // Update the index for better performance
  try {
    const indexManager = new TrackdownIndexManager(config, paths.projectRoot, cliTasksDir);
    await indexManager.updateItem('epic', epicId);
  } catch (error) {
    console.warn(Formatter.warning(`Index update failed (non-critical): ${error instanceof Error ? error.message : 'Unknown error'}`));
  }
  
  console.log(Formatter.success(`Epic created successfully!`));
  console.log(Formatter.info(`Epic ID: ${epicId}`));
  console.log(Formatter.info(`File: ${filePath}`));
  console.log(Formatter.info(`Title: ${title}`));
  console.log(Formatter.info(`Status: ${epicFrontmatter.status}`));
  console.log(Formatter.info(`Priority: ${epicFrontmatter.priority}`));
  console.log(Formatter.info(`Assignee: ${epicFrontmatter.assignee}`));
  
  if (tags.length > 0) {
    console.log(Formatter.info(`Tags: ${tags.join(', ')}`));
  }
  
  if (options.milestone) {
    console.log(Formatter.info(`Milestone: ${options.milestone}`));
  }
}