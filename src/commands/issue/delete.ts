/**
 * Issue Delete Command
 * Delete issues with safety checks for related items
 */

import * as fs from 'node:fs';
import { Command } from 'commander';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';

interface DeleteOptions {
  force?: boolean;
  recursive?: boolean;
  dryRun?: boolean;
}

export function createIssueDeleteCommand(): Command {
  const cmd = new Command('delete');

  cmd
    .description('Delete an issue')
    .argument('<issue-id>', 'issue ID to delete')
    .option('-f, --force', 'force deletion without confirmation')
    .option('-r, --recursive', 'delete all related tasks')
    .option('--dry-run', 'show what would be deleted without deleting')
    .action(async (issueId: string, options: DeleteOptions) => {
      try {
        await deleteIssue(issueId, options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to delete issue: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function deleteIssue(issueId: string, options: DeleteOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();

  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR; // Set by parent command

  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);
  const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);

  // Get issue hierarchy
  const hierarchy = relationshipManager.getIssueHierarchy(issueId);
  if (!hierarchy) {
    throw new Error(`Issue not found: ${issueId}`);
  }

  const { issue, tasks } = hierarchy;

  // Check for related tasks
  if (tasks.length > 0 && !options.recursive) {
    console.log(Formatter.warning('Issue has related tasks:'));
    console.log(`  Tasks: ${tasks.length}`);
    console.log('');
    console.log(
      Formatter.info('Use --recursive to delete all related tasks, or reassign them first.')
    );
    console.log(Formatter.info('Related tasks:'));

    for (const task of tasks.slice(0, 5)) {
      console.log(`  • ${task.task_id}: ${task.title}`);
    }
    if (tasks.length > 5) {
      console.log(`  ... and ${tasks.length - 5} more`);
    }

    throw new Error('Cannot delete issue with related tasks without --recursive flag');
  }

  // Check for dependencies
  const related = relationshipManager.getRelatedItems(issueId);
  if (related.dependents.length > 0) {
    console.log(Formatter.warning('Issue has items that depend on it:'));
    for (const dependent of related.dependents) {
      const depId = getItemId(dependent);
      console.log(`  • ${depId}: ${dependent.title}`);
    }

    if (!options.force) {
      throw new Error(
        'Cannot delete issue with dependents. Use --force to override or remove dependencies first.'
      );
    }
  }

  // Prepare deletion list
  const filesToDelete = [issue.file_path];

  if (options.recursive) {
    filesToDelete.push(...tasks.map((task) => task.file_path));
  }

  // Show what would be deleted
  console.log(Formatter.info(`${options.dryRun ? 'Dry run - ' : ''}Would delete:`));
  console.log(`  Issue: ${issue.issue_id} - ${issue.title}`);
  console.log(`    File: ${issue.file_path}`);

  if (options.recursive && tasks.length > 0) {
    console.log(`  Tasks (${tasks.length}):`);
    for (const task of tasks) {
      console.log(`    • ${task.task_id}: ${task.title}`);
      console.log(`      File: ${task.file_path}`);
    }
  }

  console.log('');
  console.log(Formatter.info(`Total files to delete: ${filesToDelete.length}`));

  if (options.dryRun) {
    return;
  }

  // Confirmation
  if (!options.force) {
    const readline = await import('node:readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(
        Formatter.warning(
          'Are you sure you want to delete this issue and all related tasks? (yes/no): '
        ),
        resolve
      );
    });

    rl.close();

    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
      console.log(Formatter.info('Deletion cancelled.'));
      return;
    }
  }

  // Perform deletion
  let deletedCount = 0;
  const errors: string[] = [];

  for (const filePath of filesToDelete) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deletedCount++;
      } else {
        console.log(Formatter.warning(`File not found: ${filePath}`));
      }
    } catch (error) {
      const errorMsg = `Failed to delete ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(Formatter.error(errorMsg));
    }
  }

  // Refresh cache after deletion
  relationshipManager.rebuildCache();

  // Report results
  console.log(Formatter.success(`Issue deletion completed!`));
  console.log(Formatter.info(`Files deleted: ${deletedCount}/${filesToDelete.length}`));

  if (errors.length > 0) {
    console.log(Formatter.warning(`Errors encountered: ${errors.length}`));
    for (const error of errors) {
      console.log(Formatter.error(`  • ${error}`));
    }
  }

  console.log('');
  console.log(Formatter.success(`Issue ${issueId} has been deleted.`));

  if (options.recursive && tasks.length > 0) {
    console.log(Formatter.info(`Also deleted ${tasks.length} tasks.`));
  }

  if (related.dependents.length > 0) {
    console.log(
      Formatter.warning('Warning: Items that depended on this issue may need to be updated:')
    );
    for (const dependent of related.dependents) {
      const depId = getItemId(dependent);
      console.log(`  • ${depId}: ${dependent.title}`);
    }
  }
}

function getItemId(item: any): string {
  if (item.epic_id && !item.issue_id && !item.task_id) return item.epic_id;
  if (item.issue_id && !item.task_id) return item.issue_id;
  if (item.task_id) return item.task_id;
  return 'UNKNOWN';
}
