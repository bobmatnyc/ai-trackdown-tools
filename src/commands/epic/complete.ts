/**
 * Epic Complete Command
 * Mark epics as completed with validation
 */

import { Command } from 'commander';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';

interface CompleteOptions {
  force?: boolean;
  actualTokens?: number;
  completionNotes?: string;
  autoCompleteChildren?: boolean;
  dryRun?: boolean;
}

export function createEpicCompleteCommand(): Command {
  const cmd = new Command('complete');

  cmd
    .description('Mark an epic as completed')
    .argument('<epic-id>', 'epic ID to complete')
    .option('-f, --force', 'complete even if issues/tasks are not completed')
    .option('--actual-tokens <number>', 'set actual token usage')
    .option('--completion-notes <text>', 'add completion notes')
    .option('--auto-complete-children', 'automatically complete all child issues and tasks')
    .option('--dry-run', 'show what would be completed without completing')
    .action(async (epicId: string, options: CompleteOptions) => {
      try {
        await completeEpic(epicId, options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to complete epic: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function completeEpic(epicId: string, options: CompleteOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();

  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR; // Set by parent command

  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);
  const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);
  const parser = new FrontmatterParser();

  // Get epic hierarchy
  const hierarchy = relationshipManager.getEpicHierarchy(epicId);
  if (!hierarchy) {
    throw new Error(`Epic not found: ${epicId}`);
  }

  const { epic, issues, tasks } = hierarchy;

  // Check if already completed
  if (epic.status === 'completed') {
    console.log(Formatter.warning(`Epic ${epicId} is already completed.`));
    return;
  }

  // Check completion status of children
  const incompleteIssues = issues.filter((issue) => issue.status !== 'completed');
  const incompleteTasks = tasks.filter((task) => task.status !== 'completed');

  // Show status
  console.log(Formatter.info(`Epic: ${epic.title}`));
  console.log(Formatter.info(`Current Status: ${epic.status}`));
  console.log('');

  // Show completion statistics
  const issueCompletionRate =
    issues.length > 0 ? ((issues.length - incompleteIssues.length) / issues.length) * 100 : 100;
  const taskCompletionRate =
    tasks.length > 0 ? ((tasks.length - incompleteTasks.length) / tasks.length) * 100 : 100;

  console.log(Formatter.success('Completion Status:'));
  console.log(
    `  Issues: ${issues.length - incompleteIssues.length}/${issues.length} completed (${issueCompletionRate.toFixed(1)}%)`
  );
  console.log(
    `  Tasks: ${tasks.length - incompleteTasks.length}/${tasks.length} completed (${taskCompletionRate.toFixed(1)}%)`
  );
  console.log('');

  // Check if all children are completed
  if (
    (incompleteIssues.length > 0 || incompleteTasks.length > 0) &&
    !options.force &&
    !options.autoCompleteChildren
  ) {
    console.log(Formatter.warning('Epic has incomplete items:'));

    if (incompleteIssues.length > 0) {
      console.log(Formatter.info(`  Incomplete Issues (${incompleteIssues.length}):`));
      for (const issue of incompleteIssues.slice(0, 5)) {
        console.log(`    • ${issue.issue_id}: ${issue.title} [${issue.status}]`);
      }
      if (incompleteIssues.length > 5) {
        console.log(`    ... and ${incompleteIssues.length - 5} more`);
      }
    }

    if (incompleteTasks.length > 0) {
      console.log(Formatter.info(`  Incomplete Tasks (${incompleteTasks.length}):`));
      for (const task of incompleteTasks.slice(0, 5)) {
        console.log(`    • ${task.task_id}: ${task.title} [${task.status}]`);
      }
      if (incompleteTasks.length > 5) {
        console.log(`    ... and ${incompleteTasks.length - 5} more`);
      }
    }

    console.log('');
    console.log(Formatter.info('Options:'));
    console.log('  - Use --force to complete anyway');
    console.log('  - Use --auto-complete-children to complete all child items');
    console.log('  - Complete child items manually first');

    throw new Error(
      'Cannot complete epic with incomplete children without --force or --auto-complete-children'
    );
  }

  // Prepare updates
  const updates: Record<string, unknown> = {
    status: 'completed' as const,
    completion_percentage: 100,
    updated_date: new Date().toISOString(),
  };

  if (options.actualTokens !== undefined) {
    updates.actual_tokens = parseInt(options.actualTokens.toString(), 10);
  }

  // Prepare child completions if auto-complete is enabled
  const childUpdates = [];

  if (options.autoCompleteChildren) {
    for (const issue of incompleteIssues) {
      childUpdates.push({
        type: 'issue',
        id: issue.issue_id,
        filePath: issue.file_path,
        updates: {
          status: 'completed' as const,
          completion_percentage: 100,
          updated_date: new Date().toISOString(),
        },
      });
    }

    for (const task of incompleteTasks) {
      childUpdates.push({
        type: 'task',
        id: task.task_id,
        filePath: task.file_path,
        updates: {
          status: 'completed' as const,
          updated_date: new Date().toISOString(),
        },
      });
    }
  }

  // Show what would be updated
  console.log(Formatter.info(`${options.dryRun ? 'Dry run - ' : ''}Would complete:`));
  console.log(`  Epic: ${epic.epic_id} - ${epic.title}`);
  console.log(`    Status: ${epic.status} → completed`);
  console.log(`    Progress: ${epic.completion_percentage || 0}% → 100%`);

  if (options.actualTokens !== undefined) {
    console.log(`    Actual Tokens: ${epic.actual_tokens || 0} → ${options.actualTokens}`);
  }

  if (childUpdates.length > 0) {
    console.log(`  Child Items (${childUpdates.length}):`);
    for (const child of childUpdates) {
      console.log(`    • ${child.id}: ${child.type} → completed`);
    }
  }

  if (options.dryRun) {
    return;
  }

  // Perform updates
  try {
    // Update epic
    const updatedEpic = parser.updateFile(epic.file_path, updates);

    // Update children if auto-complete is enabled
    for (const child of childUpdates) {
      parser.updateFile(child.filePath, child.updates);
    }

    // Refresh cache
    relationshipManager.rebuildCache();

    console.log(Formatter.success(`Epic completed successfully!`));
    console.log(Formatter.info(`Epic ID: ${epicId}`));
    console.log(Formatter.info(`Title: ${updatedEpic.title}`));
    console.log(Formatter.info(`Status: ${updatedEpic.status}`));
    console.log(Formatter.info(`Progress: ${updatedEpic.completion_percentage}%`));

    if (updatedEpic.actual_tokens) {
      console.log(Formatter.info(`Actual Tokens: ${updatedEpic.actual_tokens}`));

      if (updatedEpic.estimated_tokens > 0) {
        const efficiency = updatedEpic.actual_tokens / updatedEpic.estimated_tokens;
        const efficiencyDisplay =
          efficiency <= 1
            ? Formatter.success(`${(efficiency * 100).toFixed(1)}%`)
            : Formatter.warning(`${(efficiency * 100).toFixed(1)}%`);
        console.log(Formatter.info(`Token Efficiency: ${efficiencyDisplay}`));
      }
    }

    if (childUpdates.length > 0) {
      console.log(Formatter.info(`Also completed ${childUpdates.length} child items.`));
    }

    console.log('');
    console.log(Formatter.success('🎉 Epic completion summary:'));
    console.log(`  • ${issues.length} issues total`);
    console.log(`  • ${tasks.length} tasks total`);
    console.log(`  • Completed on ${new Date().toLocaleDateString()}`);

    if (options.completionNotes) {
      console.log(`  • Notes: ${options.completionNotes}`);
    }
  } catch (error) {
    throw new Error(
      `Failed to update files: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
