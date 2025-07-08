/**
 * PR Create Command
 * Creates new PRs using YAML frontmatter system
 */

import { Command } from 'commander';
import * as path from 'path';
import { ConfigManager } from '../../utils/config-manager.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';
import { IdGenerator } from '../../utils/simple-id-generator.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';
import type { PRFrontmatter, PRStatus, Priority } from '../../types/ai-trackdown.js';
import { Formatter } from '../../utils/formatter.js';

interface CreateOptions {
  issue: string;
  description?: string;
  assignee?: string;
  priority?: Priority;
  prStatus?: PRStatus;
  template?: string;
  estimatedTokens?: number;
  tags?: string;
  branchName?: string;
  sourceBranch?: string;
  targetBranch?: string;
  repositoryUrl?: string;
  reviewers?: string;
  dependencies?: string;
  dryRun?: boolean;
}

export function createPRCreateCommand(): Command {
  const cmd = new Command('create');
  
  cmd
    .description('Create a new PR within an issue')
    .argument('<title>', 'PR title')
    .requiredOption('-i, --issue <issue-id>', 'parent issue ID')
    .option('-d, --description <text>', 'PR description')
    .option('-a, --assignee <username>', 'assignee username')
    .option('-p, --priority <level>', 'priority level (low|medium|high|critical)', 'medium')
    .option('-s, --pr-status <status>', 'initial PR status (draft|open|review|approved|merged|closed)', 'draft')
    .option('-t, --template <name>', 'template to use', 'default')
    .option('--estimated-tokens <number>', 'estimated token usage', '0')
    .option('--tags <tags>', 'comma-separated tags')
    .option('-b, --branch-name <name>', 'branch name for the PR')
    .option('--source-branch <name>', 'source branch name')
    .option('--target-branch <name>', 'target branch name (default: main)')
    .option('--repository-url <url>', 'repository URL')
    .option('--reviewers <usernames>', 'comma-separated reviewer usernames')
    .option('--dependencies <ids>', 'comma-separated dependency IDs')
    .option('--dry-run', 'show what would be created without creating')
    .action(async (title: string, options: CreateOptions) => {
      try {
        await createPR(title, options);
      } catch (error) {
        console.error(Formatter.error(`Failed to create PR: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}

async function createPR(title: string, options: CreateOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();
  const parser = new FrontmatterParser();
  const idGenerator = new IdGenerator();
  const relationshipManager = new RelationshipManager(config);
  
  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR; // Set by parent command
  
  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);
  
  // Validate that the issue exists
  const issueHierarchy = relationshipManager.getIssueHierarchy(options.issue);
  if (!issueHierarchy) {
    throw new Error(`Issue not found: ${options.issue}`);
  }
  
  // Generate PR ID
  const prId = idGenerator.generatePRId(options.issue, title);
  
  // Get template
  const template = configManager.getTemplate('pr', options.template || 'default');
  if (!template) {
    throw new Error(`PR template '${options.template || 'default'}' not found`);
  }
  
  // Parse tags, reviewers, and dependencies
  const tags = options.tags ? options.tags.split(',').map(tag => tag.trim()) : [];
  const reviewers = options.reviewers ? options.reviewers.split(',').map(r => r.trim()) : [];
  const dependencies = options.dependencies ? options.dependencies.split(',').map(dep => dep.trim()) : [];
  
  // Create PR frontmatter
  const now = new Date().toISOString();
  const prFrontmatter: PRFrontmatter = {
    pr_id: prId,
    issue_id: options.issue,
    epic_id: issueHierarchy.issue.epic_id,
    title,
    description: options.description || template.frontmatter_template.description || '',
    status: 'planning', // Keep base status as 'planning'
    pr_status: options.prStatus || 'draft',
    priority: options.priority || 'medium',
    assignee: options.assignee || config.default_assignee || 'unassigned',
    created_date: now,
    updated_date: now,
    estimated_tokens: parseInt(options.estimatedTokens || '0', 10),
    actual_tokens: 0,
    ai_context: template.ai_context_defaults || config.ai_context_templates || [],
    sync_status: 'local',
    branch_name: options.branchName,
    source_branch: options.sourceBranch,
    target_branch: options.targetBranch || 'main',
    repository_url: options.repositoryUrl,
    reviewers: reviewers.length > 0 ? reviewers : undefined,
    approvals: [],
    tags: tags.length > 0 ? tags : undefined,
    dependencies: dependencies.length > 0 ? dependencies : undefined,
    blocked_by: [],
    blocks: [],
    related_prs: [],
    template_used: options.template || 'default'
  };
  
  // Generate content from template
  const content = template.content_template
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{description\}\}/g, prFrontmatter.description)
    .replace(/\{\{issue_id\}\}/g, options.issue)
    .replace(/\{\{branch_name\}\}/g, prFrontmatter.branch_name || '')
    .replace(/\{\{target_branch\}\}/g, prFrontmatter.target_branch || 'main');
  
  // Create filename
  const filename = `${prId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}${config.naming_conventions.file_extension}`;
  const filePath = path.join(paths.prsDir, filename);
  
  if (options.dryRun) {
    console.log(Formatter.info('Dry run - PR would be created with:'));
    console.log(Formatter.debug(`File: ${filePath}`));
    console.log(Formatter.debug(`PR ID: ${prId}`));
    console.log(Formatter.debug(`Issue ID: ${options.issue}`));
    console.log(Formatter.debug(`Epic ID: ${issueHierarchy.issue.epic_id}`));
    console.log(Formatter.debug(`Title: ${title}`));
    console.log(Formatter.debug(`PR Status: ${prFrontmatter.pr_status}`));
    console.log(Formatter.debug(`Priority: ${prFrontmatter.priority}`));
    console.log(Formatter.debug(`Assignee: ${prFrontmatter.assignee}`));
    console.log(Formatter.debug(`Target Branch: ${prFrontmatter.target_branch}`));
    if (prFrontmatter.branch_name) {
      console.log(Formatter.debug(`Branch Name: ${prFrontmatter.branch_name}`));
    }
    if (tags.length > 0) {
      console.log(Formatter.debug(`Tags: ${tags.join(', ')}`));
    }
    if (reviewers.length > 0) {
      console.log(Formatter.debug(`Reviewers: ${reviewers.join(', ')}`));
    }
    if (dependencies.length > 0) {
      console.log(Formatter.debug(`Dependencies: ${dependencies.join(', ')}`));
    }
    return;
  }
  
  // Check if file already exists
  if (require('fs').existsSync(filePath)) {
    throw new Error(`PR file already exists: ${filePath}`);
  }
  
  // Write the PR file
  parser.writePR(filePath, prFrontmatter, content);
  
  // Update the issue's related PRs
  const issue = issueHierarchy.issue;
  const updatedRelatedPRs = [...(issue.related_prs || []), prId];
  parser.updateFile(issue.file_path, { related_prs: updatedRelatedPRs });
  
  // Refresh cache
  relationshipManager.rebuildCache();
  
  console.log(Formatter.success(`PR created successfully!`));
  console.log(Formatter.info(`PR ID: ${prId}`));
  console.log(Formatter.info(`Issue ID: ${options.issue}`));
  console.log(Formatter.info(`Epic ID: ${issueHierarchy.issue.epic_id}`));
  console.log(Formatter.info(`File: ${filePath}`));
  console.log(Formatter.info(`Title: ${title}`));
  console.log(Formatter.info(`PR Status: ${prFrontmatter.pr_status}`));
  console.log(Formatter.info(`Priority: ${prFrontmatter.priority}`));
  console.log(Formatter.info(`Assignee: ${prFrontmatter.assignee}`));
  console.log(Formatter.info(`Target Branch: ${prFrontmatter.target_branch}`));
  
  if (prFrontmatter.branch_name) {
    console.log(Formatter.info(`Branch Name: ${prFrontmatter.branch_name}`));
  }
  
  if (tags.length > 0) {
    console.log(Formatter.info(`Tags: ${tags.join(', ')}`));
  }
  
  if (reviewers.length > 0) {
    console.log(Formatter.info(`Reviewers: ${reviewers.join(', ')}`));
  }
  
  if (dependencies.length > 0) {
    console.log(Formatter.info(`Dependencies: ${dependencies.join(', ')}`));
  }
  
  if (options.repositoryUrl) {
    console.log(Formatter.info(`Repository: ${options.repositoryUrl}`));
  }
  
  console.log('');
  console.log(Formatter.success(`PR added to issue "${issue.title}"`));
}