/**
 * Issue Create Command
 * Creates new issues using YAML frontmatter system with project context support
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import type { IssueFrontmatter, ItemStatus, Priority, UnifiedState } from '../../types/ai-trackdown.js';
import type { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';
import { ProjectContextManager } from '../../utils/project-context-manager.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';
import { IdGenerator } from '../../utils/simple-id-generator.js';
import { TrackdownIndexManager } from '../../utils/trackdown-index-manager.js';

interface CreateOptions {
  title?: string;
  epic?: string;
  description?: string;
  assignee?: string;
  priority?: Priority;
  status?: ItemStatus;
  state?: UnifiedState;
  template?: string;
  estimatedTokens?: number;
  tags?: string;
  milestone?: string;
  dependencies?: string;
  project?: string;
  dryRun?: boolean;
}

export function createIssueCreateCommand(): Command {
  const cmd = new Command('create');

  cmd
    .description('Create a new issue (optionally within an epic)')
    .argument('[title]', 'issue title (optional if using --title flag)')
    .option('--title <text>', 'issue title (alternative to positional argument)')
    .option('-e, --epic <epic-id>', 'parent epic ID (auto-creates if missing)')
    .option('-d, --description <text>', 'issue description')
    .option('-a, --assignee <username>', 'assignee username')
    .option('-p, --priority <level>', 'priority level (low|medium|high|critical)', 'medium')
    .option(
      '-s, --status <status>',
      'initial status (planning|active|completed|archived)',
      'planning'
    )
    .option(
      '--state <state>',
      'initial unified state (planning|active|completed|archived|ready_for_engineering|ready_for_qa|ready_for_deployment|won_t_do|done)'
    )
    .option('-t, --template <name>', 'template to use', 'default')
    .option('--estimated-tokens <number>', 'estimated token usage', '0')
    .option('--tags <tags>', 'comma-separated tags')
    .option('-m, --milestone <name>', 'milestone name')
    .option('--dependencies <ids>', 'comma-separated dependency IDs')
    .option('--project <name>', 'project name (for multi-project mode)')
    .option('--dry-run', 'show what would be created without creating')
    .action(async (titleArg: string | undefined, options: CreateOptions) => {
      try {
        // Support both positional argument and --title flag
        const title = titleArg || options.title;
        if (!title) {
          throw new Error(
            'Issue title is required. Provide it as a positional argument or use --title flag.'
          );
        }
        await createIssue(title, options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to create issue: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function createIssue(title: string, options: CreateOptions): Promise<void> {
  // Initialize project context manager
  const contextManager = new ProjectContextManager();

  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR; // Set by parent command

  // Initialize project context
  const projectContext = await contextManager.initializeContext(options.project);

  // Ensure project structure exists
  await contextManager.ensureProjectStructure();

  // Get managers and paths from context
  const configManager = projectContext.configManager;
  const config = configManager.getConfig();
  const paths = projectContext.paths;
  const parser = new FrontmatterParser();
  const idGenerator = new IdGenerator();
  const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);

  // Handle epic parameter with flexible creation
  let epicId = options.epic;
  let epicHierarchy: any = null;

  if (epicId) {
    // Check if epic exists
    epicHierarchy = relationshipManager.getEpicHierarchy(epicId);
    if (!epicHierarchy) {
      console.warn(Formatter.warning(`Epic ${epicId} not found. Creating placeholder epic...`));

      // Auto-create missing epic
      try {
        await createPlaceholderEpic(epicId, paths, configManager, parser, idGenerator);
        console.log(Formatter.success(`Created placeholder epic ${epicId}`));

        // Reload relationship manager to pick up new epic
        relationshipManager.rebuildCache();
        epicHierarchy = relationshipManager.getEpicHierarchy(epicId);
      } catch (error) {
        console.warn(
          Formatter.warning(
            `Failed to create placeholder epic: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        console.log(Formatter.info(`Continuing with issue creation without epic...`));
        epicId = undefined;
      }
    }
  } else {
    // No epic specified - create standalone issue
    console.log(Formatter.info(`Creating standalone issue without epic...`));
  }

  // Generate issue ID
  const issueId = idGenerator.generateIssueId(epicId, title);

  // Get template
  const template = configManager.getTemplateWithFallback('issue', options.template || 'default');
  if (!template) {
    throw new Error(`Issue template '${options.template || 'default'}' not found`);
  }

  // Parse tags and dependencies
  const tags = options.tags ? options.tags.split(',').map((tag) => tag.trim()) : [];
  const dependencies = options.dependencies
    ? options.dependencies.split(',').map((dep) => dep.trim())
    : [];

  // Create issue frontmatter
  const now = new Date().toISOString();
  const issueFrontmatter: IssueFrontmatter = {
    issue_id: issueId,
    epic_id: epicId,
    title,
    description: options.description || template.frontmatter_template.description || '',
    status: options.status || 'planning',
    // Add state field if provided
    ...(options.state && { 
      state: options.state,
      state_metadata: {
        transitioned_at: now,
        transitioned_by: process.env.USER || 'system',
        automation_eligible: false,
        transition_reason: 'Initial creation'
      }
    }),
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
    blocks: [],
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
    console.log(Formatter.debug(`Epic ID: ${epicId || 'none'}`));
    console.log(Formatter.debug(`Title: ${title}`));
    console.log(Formatter.debug(`Status: ${issueFrontmatter.status}`));
    if (issueFrontmatter.state) {
      console.log(Formatter.debug(`State: ${issueFrontmatter.state}`));
    }
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
  if (fs.existsSync(filePath)) {
    throw new Error(`Issue file already exists: ${filePath}`);
  }

  // Write the issue file
  parser.writeIssue(filePath, issueFrontmatter, content);

  // Update the epic's related issues (if epic exists)
  if (epicHierarchy?.epic) {
    const epic = epicHierarchy.epic;
    const updatedRelatedIssues = [...(epic.related_issues || []), issueId];
    parser.updateFile(epic.file_path, { related_issues: updatedRelatedIssues });
  }

  // Update the index for better performance
  try {
    const indexManager = new TrackdownIndexManager(config, paths.projectRoot, cliTasksDir);
    await indexManager.updateItem('issue', issueId);
    if (epicId) {
      await indexManager.updateItem('epic', epicId); // Update parent epic too
    }
  } catch (error) {
    console.warn(
      Formatter.warning(
        `Index update failed (non-critical): ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
  }

  // Refresh cache
  relationshipManager.rebuildCache();

  console.log(Formatter.success(`Issue created successfully!`));
  console.log(Formatter.info(`Issue ID: ${issueId}`));
  console.log(Formatter.info(`Epic ID: ${epicId || 'none'}`));
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
  if (epicHierarchy) {
    console.log(Formatter.success(`Issue added to epic "${epicHierarchy.epic.title}"`));
  } else {
    console.log(Formatter.success(`Standalone issue created successfully`));
  }
}

/**
 * Create a placeholder epic when an epic ID is referenced but doesn't exist
 */
async function createPlaceholderEpic(
  epicId: string,
  paths: any,
  configManager: ConfigManager,
  parser: FrontmatterParser,
  _idGenerator: IdGenerator
): Promise<void> {
  const config = configManager.getConfig();

  // Get template for placeholder epic
  const template = configManager.getTemplateWithFallback('epic', 'default');
  if (!template) {
    throw new Error('No epic template found for placeholder creation');
  }

  const now = new Date().toISOString();
  const epicFrontmatter = {
    epic_id: epicId,
    title: `Placeholder Epic - ${epicId}`,
    description: `Auto-generated placeholder epic for ${epicId}. Please update with proper details.`,
    status: 'planning',
    priority: 'medium',
    assignee: config.default_assignee || 'unassigned',
    created_date: now,
    updated_date: now,
    estimated_tokens: 0,
    actual_tokens: 0,
    ai_context: template.ai_context_defaults || [],
    sync_status: 'local',
    related_issues: [],
    dependencies: [],
    completion_percentage: 0,
  };

  // Generate content from template
  const content = template.content_template
    .replace(/\{\{title\}\}/g, epicFrontmatter.title)
    .replace(/\{\{description\}\}/g, epicFrontmatter.description);

  // Create filename
  const filename = `${epicId}-placeholder-epic${config.naming_conventions.file_extension}`;
  const filePath = path.join(paths.epicsDir, filename);

  // Create epic file
  parser.writeEpic(filePath, epicFrontmatter, content);
}
