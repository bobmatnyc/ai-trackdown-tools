/**
 * Issue Show Command
 * Display detailed information about a specific issue
 */

import { Command } from 'commander';
import type { EpicData, IssueData, PRData, TaskData } from '../../types/ai-trackdown.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';

interface ShowOptions {
  format?: 'detailed' | 'json' | 'yaml';
  showTasks?: boolean;
  showPRs?: boolean;
  showContent?: boolean;
  showRelated?: boolean;
}

export function createIssueShowCommand(): Command {
  const cmd = new Command('show');

  cmd
    .description('Show detailed information about an issue')
    .argument('<issue-id>', 'issue ID to show')
    .option('-f, --format <type>', 'output format (detailed|json|yaml)', 'detailed')
    .option('--show-tasks, --with-tasks', 'show related tasks')
    .option('--show-prs', 'show related pull requests')
    .option('--show-content', 'show issue content/description')
    .option('--show-related', 'show related issues and dependencies')
    .action(async (issueId: string, options: ShowOptions) => {
      try {
        await showIssue(issueId, options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to show issue: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function showIssue(issueId: string, options: ShowOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();

  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR;

  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);
  const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);

  // Get issue hierarchy
  const hierarchy = relationshipManager.getIssueHierarchy(issueId);
  if (!hierarchy) {
    throw new Error(`Issue not found: ${issueId}`);
  }

  const { issue, tasks, prs, epic } = hierarchy;

  // Output based on format
  switch (options.format) {
    case 'json': {
      const jsonOutput = {
        issue,
        ...(options.showTasks && { tasks }),
        ...(options.showPRs && { prs }),
        ...(epic && { epic }),
      };
      console.log(JSON.stringify(jsonOutput, null, 2));
      break;
    }

    case 'yaml': {
      const YAML = await import('yaml');
      const yamlOutput = {
        issue,
        ...(options.showTasks && { tasks }),
        ...(options.showPRs && { prs }),
        ...(epic && { epic }),
      };
      console.log(YAML.stringify(yamlOutput));
      break;
    }

    default:
      await displayIssueDetailed(issue, tasks, prs, epic, options, relationshipManager);
  }
}

async function displayIssueDetailed(
  issue: IssueData,
  tasks: TaskData[],
  prs: PRData[],
  epic: EpicData | undefined,
  options: ShowOptions,
  relationshipManager: RelationshipManager
): Promise<void> {
  // Header
  console.log(Formatter.success(`\n=== ISSUE: ${issue.title} ===`));
  console.log(Formatter.info(`ID: ${issue.issue_id}`));
  console.log('');

  // Basic Information
  console.log(Formatter.success('Basic Information:'));
  console.log(`  Title: ${issue.title}`);
  console.log(`  Status: ${getStatusDisplay(issue.status)}`);
  console.log(`  Priority: ${getPriorityDisplay(issue.priority)}`);
  console.log(`  Assignee: ${issue.assignee || 'Unassigned'}`);

  if (epic) {
    console.log(`  Epic: ${epic.epic_id} - ${epic.title}`);
  }

  if (issue.milestone) {
    console.log(`  Milestone: ${issue.milestone}`);
  }

  if (issue.tags && issue.tags.length > 0) {
    console.log(`  Tags: ${issue.tags.join(', ')}`);
  }

  if (issue.completion_percentage !== undefined) {
    console.log(`  Progress: ${issue.completion_percentage}%`);
  }

  console.log('');

  // Dates and Tracking
  console.log(Formatter.success('Tracking Information:'));
  console.log(`  Created: ${formatDateTime(issue.created_date)}`);
  console.log(`  Updated: ${formatDateTime(issue.updated_date)}`);
  console.log(`  Estimated Tokens: ${issue.estimated_tokens || 0}`);
  console.log(`  Actual Tokens: ${issue.actual_tokens || 0}`);

  if (issue.estimated_tokens > 0) {
    const efficiency = issue.actual_tokens / issue.estimated_tokens;
    console.log(`  Token Efficiency: ${(efficiency * 100).toFixed(1)}%`);
  }

  console.log(`  Sync Status: ${issue.sync_status || 'local'}`);
  console.log('');

  // Description
  if (issue.description) {
    console.log(Formatter.success('Description:'));
    console.log(`  ${issue.description}`);
    console.log('');
  }

  // Content
  if (options.showContent && issue.content) {
    console.log(Formatter.success('Content:'));
    console.log(issue.content);
    console.log('');
  }

  // AI Context
  if (issue.ai_context && issue.ai_context.length > 0) {
    console.log(Formatter.success('AI Context:'));
    for (const context of issue.ai_context) {
      console.log(`  • ${context}`);
    }
    console.log('');
  }

  // Dependencies
  if (issue.dependencies && issue.dependencies.length > 0) {
    console.log(Formatter.success('Dependencies:'));
    for (const dep of issue.dependencies) {
      console.log(`  • ${dep}`);
    }
    console.log('');
  }

  // Blocked by / Blocks
  if (issue.blocked_by && issue.blocked_by.length > 0) {
    console.log(Formatter.success('Blocked By:'));
    for (const blocker of issue.blocked_by) {
      console.log(`  • ${blocker}`);
    }
    console.log('');
  }

  if (issue.blocks && issue.blocks.length > 0) {
    console.log(Formatter.success('Blocks:'));
    for (const blocked of issue.blocks) {
      console.log(`  • ${blocked}`);
    }
    console.log('');
  }

  // Related Tasks
  if (options.showTasks || tasks.length > 0) {
    console.log(Formatter.success(`Related Tasks (${tasks.length}):`));
    if (tasks.length === 0) {
      console.log(Formatter.debug('  No tasks found'));
    } else {
      for (const task of tasks) {
        const statusIcon = getStatusIcon(task.status);
        const priorityColor = getPriorityDisplay(task.priority);
        console.log(`  ${statusIcon} ${task.task_id}: ${task.title} [${priorityColor}]`);
      }
    }
    console.log('');
  }

  // Related PRs
  if (options.showPRs || prs.length > 0) {
    console.log(Formatter.success(`Related Pull Requests (${prs.length}):`));
    if (prs.length === 0) {
      console.log(Formatter.debug('  No pull requests found'));
    } else {
      for (const pr of prs) {
        const statusIcon = getPRStatusIcon(pr.pr_status);
        console.log(`  ${statusIcon} ${pr.pr_id}: ${pr.title} [${pr.pr_status.toUpperCase()}]`);
      }
    }
    console.log('');
  }

  // Related Issues
  if (issue.related_issues && issue.related_issues.length > 0) {
    console.log(Formatter.success('Related Issues:'));
    for (const relatedId of issue.related_issues) {
      console.log(`  • ${relatedId}`);
    }
    console.log('');
  }

  // Related Items (if requested)
  if (options.showRelated) {
    const related = relationshipManager.getRelatedItems(issue.issue_id);

    if (related.siblings.length > 0) {
      console.log(Formatter.success('Sibling Issues:'));
      for (const sibling of related.siblings) {
        console.log(`  • ${getItemId(sibling)}: ${sibling.title}`);
      }
      console.log('');
    }

    if (related.dependencies.length > 0) {
      console.log(Formatter.success('Dependencies:'));
      for (const dep of related.dependencies) {
        console.log(`  • ${getItemId(dep)}: ${dep.title}`);
      }
      console.log('');
    }

    if (related.dependents.length > 0) {
      console.log(Formatter.success('Dependents:'));
      for (const dep of related.dependents) {
        console.log(`  • ${getItemId(dep)}: ${dep.title}`);
      }
      console.log('');
    }
  }

  // GitHub sync information
  if (issue.github_id || issue.github_number || issue.github_url) {
    console.log(Formatter.success('GitHub Integration:'));
    if (issue.github_id) {
      console.log(`  GitHub ID: ${issue.github_id}`);
    }
    if (issue.github_number) {
      console.log(`  GitHub Number: #${issue.github_number}`);
    }
    if (issue.github_url) {
      console.log(`  GitHub URL: ${issue.github_url}`);
    }
    if (issue.github_labels && issue.github_labels.length > 0) {
      console.log(`  GitHub Labels: ${issue.github_labels.join(', ')}`);
    }
    console.log('');
  }

  // File Information
  console.log(Formatter.success('File Information:'));
  console.log(`  Path: ${issue.file_path}`);
  console.log('');

  // Summary Statistics
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const mergedPRs = prs.filter((p) => p.pr_status === 'merged').length;

  console.log(Formatter.success('Summary:'));
  console.log(`  Tasks: ${completedTasks}/${tasks.length} completed`);
  console.log(`  PRs: ${mergedPRs}/${prs.length} merged`);

  if (tasks.length > 0) {
    const taskCompletionRate = ((completedTasks / tasks.length) * 100).toFixed(1);
    console.log(`  Task Completion: ${taskCompletionRate}%`);
  }

  if (prs.length > 0) {
    const prMergeRate = ((mergedPRs / prs.length) * 100).toFixed(1);
    console.log(`  PR Merge Rate: ${prMergeRate}%`);
  }
}

function getStatusDisplay(status: string): string {
  const statusColors: Record<string, (text: string) => string> = {
    planning: (text) => Formatter.info(text),
    active: (text) => Formatter.success(text),
    completed: (text) => Formatter.success(text),
    archived: (text) => Formatter.debug(text),
  };

  const colorFn = statusColors[status] || ((text) => text);
  return colorFn(status.toUpperCase());
}

function getPriorityDisplay(priority: string): string {
  const priorityColors: Record<string, (text: string) => string> = {
    critical: (text) => Formatter.error(text),
    high: (text) => Formatter.warning(text),
    medium: (text) => Formatter.info(text),
    low: (text) => Formatter.debug(text),
  };

  const colorFn = priorityColors[priority] || ((text) => text);
  return colorFn(priority.toUpperCase());
}

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    planning: '⏳',
    active: '🔄',
    completed: '✅',
    archived: '📦',
  };

  return icons[status] || '❓';
}

function getPRStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    draft: '📝',
    open: '🔓',
    review: '👀',
    approved: '✅',
    merged: '🔗',
    closed: '❌',
  };

  return icons[status] || '❓';
}

function formatDateTime(dateString: string): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString();
}

function getItemId(item: any): string {
  if (item.epic_id && !item.issue_id && !item.task_id) return item.epic_id;
  if (item.issue_id && !item.task_id) return item.issue_id;
  if (item.task_id) return item.task_id;
  if (item.pr_id) return item.pr_id;
  return 'UNKNOWN';
}
