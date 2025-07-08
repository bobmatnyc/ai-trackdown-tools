/**
 * Issue Create Command
 * Creates new issues using YAML frontmatter system
 */

import { Command } from 'commander';
import * as path from 'path';
import { ConfigManager } from '../../utils/config-manager.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';
import { IdGenerator } from '../../utils/simple-id-generator.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';
import type { IssueFrontmatter, ItemStatus, Priority } from '../../types/ai-trackdown.js';
import { Formatter } from '../../utils/formatter.js';

interface CreateOptions {
  epic: string;
  description?: string;
  assignee?: string;
  priority?: Priority;
  status?: ItemStatus;
  template?: string;
  estimatedTokens?: number;
  tags?: string;
  milestone?: string;
  dependencies?: string;
  dryRun?: boolean;
}

export function createIssueCreateCommand(): Command {
  const cmd = new Command('create');
  
  cmd
    .description('Create a new issue within an epic')
    .argument('<title>', 'issue title')
    .requiredOption('-e, --epic <epic-id>', 'parent epic ID')
    .option('-d, --description <text>', 'issue description')
    .option('-a, --assignee <username>', 'assignee username')
    .option('-p, --priority <level>', 'priority level (low|medium|high|critical)', 'medium')
    .option('-s, --status <status>', 'initial status (planning|active|completed|archived)', 'planning')
    .option('-t, --template <name>', 'template to use', 'default')
    .option('--estimated-tokens <number>', 'estimated token usage', '0')
    .option('--tags <tags>', 'comma-separated tags')
    .option('-m, --milestone <name>', 'milestone name')
    .option('--dependencies <ids>', 'comma-separated dependency IDs')
    .option('--dry-run', 'show what would be created without creating')
    .action(async (title: string, options: CreateOptions) => {
      try {
        await createIssue(title, options);
      } catch (error) {
        console.error(Formatter.error(`Failed to create issue: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}

async function createIssue(title: string, options: CreateOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();
  const parser = new FrontmatterParser();
  const idGenerator = new IdGenerator();
  const relationshipManager = new RelationshipManager(config);
  
  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR; // Set by parent command
  
  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);
  
  // Validate that the epic exists
  const epicHierarchy = relationshipManager.getEpicHierarchy(options.epic);
  if (!epicHierarchy) {
    throw new Error(`Epic not found: ${options.epic}`);
  }
  
  // Generate issue ID
  const issueId = idGenerator.generateIssueId(options.epic, title);
  
  // Get template
  const template = configManager.getTemplate('issue', options.template || 'default');
  if (!template) {
    throw new Error(`Issue template '${options.template || 'default'}' not found`);
  }
  
  // Parse tags and dependencies
  const tags = options.tags ? options.tags.split(',').map(tag => tag.trim()) : [];
  const dependencies = options.dependencies ? options.dependencies.split(',').map(dep => dep.trim()) : [];
  
  // Create issue frontmatter
  const now = new Date().toISOString();
  const issueFrontmatter: IssueFrontmatter = {
    issue_id: issueId,
    epic_id: options.epic,
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
    related_tasks: [],
    related_issues: [],
    tags: tags.length > 0 ? tags : undefined,
    milestone: options.milestone,
    dependencies: dependencies.length > 0 ? dependencies : undefined,
    completion_percentage: 0,
    blocked_by: [],
    blocks: []
  };
  
  // Generate content from template
  const content = template.content_template
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{description\}\}/g, issueFrontmatter.description);
  
  // Create filename
  const filename = `${issueId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}${config.naming_conventions.file_extension}`;
  const filePath = path.join(paths.issuesDir, filename);
  
  if (options.dryRun) {
    console.log(Formatter.info('Dry run - Issue would be created with:'));
    console.log(Formatter.debug(`File: ${filePath}`));
    console.log(Formatter.debug(`Issue ID: ${issueId}`));
    console.log(Formatter.debug(`Epic ID: ${options.epic}`));
    console.log(Formatter.debug(`Title: ${title}`));
    console.log(Formatter.debug(`Status: ${issueFrontmatter.status}`));
    console.log(Formatter.debug(`Priority: ${issueFrontmatter.priority}`));
    console.log(Formatter.debug(`Assignee: ${issueFrontmatter.assignee}`));
    if (tags.length > 0) {
      console.log(Formatter.debug(`Tags: ${tags.join(', ')}`));
    }
    if (dependencies.length > 0) {
      console.log(Formatter.debug(`Dependencies: ${dependencies.join(', ')}`));
    }
    return;
  }
  
  // Check if file already exists
  if (require('fs').existsSync(filePath)) {
    throw new Error(`Issue file already exists: ${filePath}`);
  }
  
  // Write the issue file
  parser.writeIssue(filePath, issueFrontmatter, content);
  
  // Update the epic's related issues
  const epic = epicHierarchy.epic;
  const updatedRelatedIssues = [...(epic.related_issues || []), issueId];
  parser.updateFile(epic.file_path, { related_issues: updatedRelatedIssues });
  
  // Refresh cache
  relationshipManager.rebuildCache();
  
  console.log(Formatter.success(`Issue created successfully!`));
  console.log(Formatter.info(`Issue ID: ${issueId}`));
  console.log(Formatter.info(`Epic ID: ${options.epic}`));
  console.log(Formatter.info(`File: ${filePath}`));
  console.log(Formatter.info(`Title: ${title}`));
  console.log(Formatter.info(`Status: ${issueFrontmatter.status}`));
  console.log(Formatter.info(`Priority: ${issueFrontmatter.priority}`));
  console.log(Formatter.info(`Assignee: ${issueFrontmatter.assignee}`));
  
  if (tags.length > 0) {
    console.log(Formatter.info(`Tags: ${tags.join(', ')}`));
  }
  
  if (dependencies.length > 0) {
    console.log(Formatter.info(`Dependencies: ${dependencies.join(', ')}`));
  }
  
  if (options.milestone) {
    console.log(Formatter.info(`Milestone: ${options.milestone}`));
  }
  
  console.log('');
  console.log(Formatter.success(`Issue added to epic "${epic.title}"`));
}