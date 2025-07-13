/**
 * Issue close command - Mark issues as completed in ai-trackdown
 */

import { Command } from 'commander';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';

interface IssueCloseOptions {
  comment?: string;
  force?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

export function createIssueCloseCommand(): Command {
  const cmd = new Command('close');

  cmd
    .description('Close an issue by marking it as completed')
    .argument('<issue-id>', 'Issue ID (e.g., ISS-0001)')
    .option('-c, --comment <text>', 'Add completion comment')
    .option('-f, --force', 'force closure even if tasks are not completed')
    .option('--dry-run', 'show what would be closed without closing')
    .option('-v, --verbose', 'Show detailed output')
    .action(async (issueId: string, options: IssueCloseOptions) => {
      try {
        await handleCloseIssue(issueId, options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to close issue: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function handleCloseIssue(issueId: string, options: IssueCloseOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();

  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR; // Set by parent command

  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);
  const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);
  const parser = new FrontmatterParser();

  // Get issue hierarchy
  const hierarchy = relationshipManager.getIssueHierarchy(issueId);
  if (!hierarchy) {
    throw new Error(`Issue not found: ${issueId}`);
  }

  const { issue, tasks } = hierarchy;

  // Check if already closed
  if (issue.status === 'completed') {
    console.log(Formatter.warning(`Issue ${issueId} is already closed.`));
    return;
  }

  // Check completion status of tasks
  const incompleteTasks = tasks.filter((task) => task.status !== 'completed');

  // Show status
  if (options.verbose) {
    console.log(Formatter.info(`Issue: ${issue.title}`));
    console.log(Formatter.info(`Current Status: ${issue.status}`));
    console.log('');
  }

  // Check if all tasks are completed
  if (incompleteTasks.length > 0 && !options.force) {
    console.log(Formatter.warning('Issue has incomplete tasks:'));

    for (const task of incompleteTasks.slice(0, 3)) {
      console.log(`  • ${task.task_id}: ${task.title} [${task.status}]`);
    }
    if (incompleteTasks.length > 3) {
      console.log(`  ... and ${incompleteTasks.length - 3} more`);
    }

    console.log('');
    console.log(Formatter.info('Use --force to close anyway, or complete tasks first.'));

    throw new Error('Cannot close issue with incomplete tasks without --force');
  }

  // Prepare updates
  const updates = {
    status: 'completed' as const,
    completion_percentage: 100,
    updated_date: new Date().toISOString(),
  };

  // Add comment if provided
  if (options.comment) {
    updates.closing_comment = options.comment;
  }

  // Show what would be updated
  console.log(Formatter.info(`${options.dryRun ? 'Dry run - ' : ''}Closing issue:`));
  console.log(`  Issue: ${issue.issue_id} - ${issue.title}`);
  console.log(`  Status: ${issue.status} → completed`);
  console.log(`  Progress: ${issue.completion_percentage || 0}% → 100%`);

  if (options.comment) {
    console.log(`  Comment: ${options.comment}`);
  }

  if (options.dryRun) {
    return;
  }

  // Perform update
  try {
    const updatedIssue = parser.updateFile(issue.file_path, updates);

    // Refresh cache
    relationshipManager.rebuildCache();

    console.log(Formatter.success(`Issue closed successfully!`));
    console.log(Formatter.info(`Issue ID: ${issueId}`));
    console.log(Formatter.info(`Title: ${updatedIssue.title}`));
    console.log(Formatter.info(`Status: ${updatedIssue.status}`));
    console.log(Formatter.info(`Closed on: ${new Date().toLocaleDateString()}`));

    if (incompleteTasks.length > 0) {
      console.log(Formatter.warning(`Note: ${incompleteTasks.length} tasks remain incomplete.`));
    }
  } catch (error) {
    throw new Error(
      `Failed to update issue file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Export for use in other commands
export { handleCloseIssue };
