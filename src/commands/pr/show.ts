/**
 * PR Show Command
 * Displays detailed information about a specific PR
 */

import { Command } from 'commander';
import type { PRStatus, Priority } from '../../types/ai-trackdown.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';

interface ShowOptions {
  format?: 'detailed' | 'json' | 'yaml';
  showContent?: boolean;
  showRelationships?: boolean;
  showHistory?: boolean;
}

export function createPRShowCommand(): Command {
  const cmd = new Command('show');

  cmd
    .description('Show detailed information about a specific PR')
    .argument('<pr-id>', 'PR ID to display')
    .option('-f, --format <format>', 'output format (detailed|json|yaml)', 'detailed')
    .option('-c, --show-content', 'include PR content/description')
    .option('-r, --show-relationships', 'show related items (issue, epic, dependencies)')
    .option('-h, --show-history', 'show change history (if available)')
    .action(async (prId: string, options: ShowOptions) => {
      try {
        await showPR(prId, options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to show PR: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function showPR(prId: string, options: ShowOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();
  const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);

  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR;

  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);

  // Find the PR
  const prHierarchy = relationshipManager.getPRHierarchy(prId);
  if (!prHierarchy) {
    console.error(Formatter.error(`PR not found: ${prId}`));
    process.exit(1);
  }

  const pr = prHierarchy.pr;

  // Display based on format
  if (options.format === 'json') {
    const output = {
      pr,
      ...(options.showRelationships && {
        relationships: {
          issue: prHierarchy.issue,
          epic: prHierarchy.epic,
        },
      }),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (options.format === 'yaml') {
    // For YAML, we'll output the frontmatter format
    const yamlOutput = {
      pr_id: pr.pr_id,
      title: pr.title,
      description: pr.description,
      status: pr.status,
      pr_status: pr.pr_status,
      priority: pr.priority,
      assignee: pr.assignee,
      issue_id: pr.issue_id,
      epic_id: pr.epic_id,
      created_date: pr.created_date,
      updated_date: pr.updated_date,
      estimated_tokens: pr.estimated_tokens,
      actual_tokens: pr.actual_tokens,
      branch_name: pr.branch_name,
      source_branch: pr.source_branch,
      target_branch: pr.target_branch,
      repository_url: pr.repository_url,
      pr_number: pr.pr_number,
      reviewers: pr.reviewers,
      approvals: pr.approvals,
      merge_commit: pr.merge_commit,
      tags: pr.tags,
      dependencies: pr.dependencies,
      blocked_by: pr.blocked_by,
      blocks: pr.blocks,
      related_prs: pr.related_prs,
      template_used: pr.template_used,
      ai_context: pr.ai_context,
      sync_status: pr.sync_status,
    };

    console.log('---');
    Object.entries(yamlOutput).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            console.log(`${key}:`);
            value.forEach((item) => console.log(`  - ${item}`));
          }
        } else {
          console.log(`${key}: ${value}`);
        }
      }
    });
    console.log('---');
    return;
  }

  // Detailed format (default)
  const statusColor = getPRStatusColor(pr.pr_status);
  const priorityColor = getPriorityColor(pr.priority);

  console.log(Formatter.header(`\n📋 PR Details: ${pr.pr_id}`));
  console.log(`\n${Formatter.info('Title:')} ${pr.title}`);
  console.log(
    `${Formatter.info('Status:')} ${statusColor(pr.pr_status)} | ${Formatter.info('Priority:')} ${priorityColor(pr.priority)}`
  );
  console.log(`${Formatter.info('Assignee:')} ${pr.assignee}`);

  console.log(`\n${Formatter.info('Hierarchy:')}`);
  console.log(`  Epic: ${pr.epic_id} (${prHierarchy.epic?.title || 'Unknown'})`);
  console.log(`  Issue: ${pr.issue_id} (${prHierarchy.issue.title})`);
  console.log(`  PR: ${pr.pr_id}`);

  console.log(`\n${Formatter.info('Branch Information:')}`);
  if (pr.branch_name) {
    console.log(`  Branch: ${pr.branch_name}`);
  }
  if (pr.source_branch) {
    console.log(`  Source: ${pr.source_branch}`);
  }
  console.log(`  Target: ${pr.target_branch || 'main'}`);

  if (pr.repository_url) {
    console.log(`  Repository: ${pr.repository_url}`);
  }

  if (pr.pr_number) {
    console.log(`  PR Number: #${pr.pr_number}`);
  }

  console.log(`\n${Formatter.info('Dates:')}`);
  console.log(`  Created: ${formatDate(pr.created_date)}`);
  console.log(`  Updated: ${formatDate(pr.updated_date)}`);

  if (pr.reviewers && pr.reviewers.length > 0) {
    console.log(`\n${Formatter.info('Reviewers:')}`);
    pr.reviewers.forEach((reviewer) => {
      const isApproved = pr.approvals?.includes(reviewer);
      console.log(`  ${reviewer} ${isApproved ? '✅' : '⏳'}`);
    });
  }

  if (pr.approvals && pr.approvals.length > 0) {
    console.log(`\n${Formatter.info('Approvals:')}`);
    pr.approvals.forEach((approval) => {
      console.log(`  ✅ ${approval}`);
    });
  }

  if (pr.merge_commit) {
    console.log(`\n${Formatter.info('Merge Commit:')} ${pr.merge_commit}`);
  }

  if (pr.tags && pr.tags.length > 0) {
    console.log(`\n${Formatter.info('Tags:')} ${pr.tags.join(', ')}`);
  }

  if (pr.estimated_tokens > 0 || pr.actual_tokens > 0) {
    console.log(`\n${Formatter.info('Token Usage:')}`);
    console.log(`  Estimated: ${pr.estimated_tokens}`);
    console.log(`  Actual: ${pr.actual_tokens}`);
    if (pr.estimated_tokens > 0) {
      const efficiency = ((pr.actual_tokens / pr.estimated_tokens) * 100).toFixed(1);
      console.log(`  Efficiency: ${efficiency}%`);
    }
  }

  if (pr.dependencies && pr.dependencies.length > 0) {
    console.log(`\n${Formatter.info('Dependencies:')}`);
    pr.dependencies.forEach((dep) => {
      console.log(`  📎 ${dep}`);
    });
  }

  if (pr.blocked_by && pr.blocked_by.length > 0) {
    console.log(`\n${Formatter.warning('Blocked By:')}`);
    pr.blocked_by.forEach((blocker) => {
      console.log(`  🚫 ${blocker}`);
    });
  }

  if (pr.blocks && pr.blocks.length > 0) {
    console.log(`\n${Formatter.warning('Blocks:')}`);
    pr.blocks.forEach((blocked) => {
      console.log(`  🚫 ${blocked}`);
    });
  }

  if (pr.related_prs && pr.related_prs.length > 0) {
    console.log(`\n${Formatter.info('Related PRs:')}`);
    pr.related_prs.forEach((relatedPR) => {
      console.log(`  🔗 ${relatedPR}`);
    });
  }

  if (pr.ai_context && pr.ai_context.length > 0) {
    console.log(`\n${Formatter.info('AI Context:')}`);
    pr.ai_context.forEach((context) => {
      console.log(`  🤖 ${context}`);
    });
  }

  if (pr.template_used) {
    console.log(`\n${Formatter.info('Template Used:')} ${pr.template_used}`);
  }

  console.log(`\n${Formatter.info('Sync Status:')} ${pr.sync_status}`);
  console.log(`${Formatter.info('File Path:')} ${pr.file_path}`);

  if (options.showContent && pr.description) {
    console.log(`\n${Formatter.info('Description:')}`);
    console.log(pr.description);
  }

  if (options.showContent && pr.content) {
    console.log(`\n${Formatter.info('Content:')}`);
    console.log(pr.content);
  }

  if (options.showRelationships) {
    console.log(`\n${Formatter.header('Related Items:')}`);

    // Show issue details
    const issue = prHierarchy.issue;
    console.log(`\n${Formatter.info('Parent Issue:')} ${issue.issue_id}`);
    console.log(`  Title: ${issue.title}`);
    console.log(`  Status: ${issue.status}`);
    console.log(`  Priority: ${issue.priority}`);
    console.log(`  Assignee: ${issue.assignee}`);

    // Show epic details if available
    if (prHierarchy.epic) {
      const epic = prHierarchy.epic;
      console.log(`\n${Formatter.info('Parent Epic:')} ${epic.epic_id}`);
      console.log(`  Title: ${epic.title}`);
      console.log(`  Status: ${epic.status}`);
      console.log(`  Priority: ${epic.priority}`);
      console.log(`  Assignee: ${epic.assignee}`);

      if (epic.completion_percentage !== undefined) {
        console.log(`  Completion: ${epic.completion_percentage}%`);
      }
    }
  }

  // Show change summary
  console.log(`\n${Formatter.success('PR Summary:')}`);
  console.log(`  PR ${pr.pr_id} "${pr.title}"`);
  console.log(`  Status: ${pr.pr_status} | Priority: ${pr.priority} | Assignee: ${pr.assignee}`);
  console.log(`  Branch: ${pr.branch_name || 'N/A'} → ${pr.target_branch || 'main'}`);
  console.log(`  Created: ${formatDate(pr.created_date)}`);
  console.log(`  Last Updated: ${formatDate(pr.updated_date)}`);
}

function getPRStatusColor(status: PRStatus): (text: string) => string {
  switch (status) {
    case 'draft':
      return Formatter.debug;
    case 'open':
      return Formatter.info;
    case 'review':
      return Formatter.warning;
    case 'approved':
      return Formatter.success;
    case 'merged':
      return Formatter.success;
    case 'closed':
      return Formatter.error;
    default:
      return Formatter.info;
  }
}

function getPriorityColor(priority: Priority): (text: string) => string {
  switch (priority) {
    case 'critical':
      return Formatter.error;
    case 'high':
      return Formatter.warning;
    case 'medium':
      return Formatter.info;
    case 'low':
      return Formatter.debug;
    default:
      return Formatter.info;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}
