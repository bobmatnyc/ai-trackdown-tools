/**
 * Issue Complete Command
 * Mark issues as completed with validation
 */

import { Command } from 'commander';
import { ConfigManager } from '../../utils/config-manager.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';
import { Formatter } from '../../utils/formatter.js';

interface CompleteOptions {
  force?: boolean;
  actualTokens?: number;
  completionNotes?: string;
  comment?: string;
  autoCompleteTasks?: boolean;
  dryRun?: boolean;
}

export function createIssueCompleteCommand(): Command {
  const cmd = new Command('complete');
  
  cmd
    .description('Mark an issue as completed')
    .argument('<issue-id>', 'issue ID to complete')
    .option('-f, --force', 'complete even if tasks are not completed')
    .option('--actual-tokens <number>', 'set actual token usage')
    .option('--completion-notes <text>', 'add completion notes')
    .option('-c, --comment <text>', 'add completion comment')
    .option('--auto-complete-tasks', 'automatically complete all child tasks')
    .option('--dry-run', 'show what would be completed without completing')
    .action(async (issueId: string, options: CompleteOptions) => {
      try {
        await completeIssue(issueId, options);
      } catch (error) {
        console.error(Formatter.error(`Failed to complete issue: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}

async function completeIssue(issueId: string, options: CompleteOptions): Promise<void> {
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
  
  // Check if already completed
  if (issue.status === 'completed') {
    console.log(Formatter.warning(`Issue ${issueId} is already completed.`));
    return;
  }
  
  // Check completion status of tasks
  const incompleteTasks = tasks.filter(task => task.status !== 'completed');
  
  // Show status
  console.log(Formatter.info(`Issue: ${issue.title}`));
  console.log(Formatter.info(`Current Status: ${issue.status}`));
  console.log('');
  
  // Show completion statistics
  const taskCompletionRate = tasks.length > 0 ? (tasks.length - incompleteTasks.length) / tasks.length * 100 : 100;
  
  console.log(Formatter.success('Completion Status:'));
  console.log(`  Tasks: ${tasks.length - incompleteTasks.length}/${tasks.length} completed (${taskCompletionRate.toFixed(1)}%)`);
  console.log('');
  
  // Check if all tasks are completed
  if (incompleteTasks.length > 0 && !options.force && !options.autoCompleteTasks) {
    console.log(Formatter.warning('Issue has incomplete tasks:'));
    
    for (const task of incompleteTasks.slice(0, 5)) {
      console.log(`    • ${task.task_id}: ${task.title} [${task.status}]`);
    }
    if (incompleteTasks.length > 5) {
      console.log(`    ... and ${incompleteTasks.length - 5} more`);
    }
    
    console.log('');
    console.log(Formatter.info('Options:'));
    console.log('  - Use --force to complete anyway');
    console.log('  - Use --auto-complete-tasks to complete all tasks');
    console.log('  - Complete tasks manually first');
    
    throw new Error('Cannot complete issue with incomplete tasks without --force or --auto-complete-tasks');
  }
  
  // Prepare updates
  const updates = {
    status: 'completed' as const,
    completion_percentage: 100,
    updated_date: new Date().toISOString()
  };
  
  if (options.actualTokens !== undefined) {
    (updates as any).actual_tokens = parseInt(options.actualTokens.toString(), 10);
  }
  
  // Add comment if provided
  if (options.comment) {
    (updates as any).completion_comment = options.comment;
  }
  
  // Prepare task completions if auto-complete is enabled
  const taskUpdates = [];
  
  if (options.autoCompleteTasks) {
    for (const task of incompleteTasks) {
      taskUpdates.push({
        id: task.task_id,
        filePath: task.file_path,
        updates: {
          status: 'completed' as const,
          updated_date: new Date().toISOString()
        }
      });
    }
  }
  
  // Show what would be updated
  console.log(Formatter.info(`${options.dryRun ? 'Dry run - ' : ''}Would complete:`));
  console.log(`  Issue: ${issue.issue_id} - ${issue.title}`);
  console.log(`    Status: ${issue.status} → completed`);
  console.log(`    Progress: ${issue.completion_percentage || 0}% → 100%`);
  
  if (options.actualTokens !== undefined) {
    console.log(`    Actual Tokens: ${issue.actual_tokens || 0} → ${options.actualTokens}`);
  }
  
  if (options.comment) {
    console.log(`    Comment: ${options.comment}`);
  }
  
  if (taskUpdates.length > 0) {
    console.log(`  Tasks (${taskUpdates.length}):`);
    for (const task of taskUpdates) {
      console.log(`    • ${task.id}: → completed`);
    }
  }
  
  if (options.dryRun) {
    return;
  }
  
  // Perform updates
  try {
    // Update issue
    const updatedIssue = parser.updateFile(issue.file_path, updates);
    
    // Update tasks if auto-complete is enabled
    for (const task of taskUpdates) {
      parser.updateFile(task.filePath, task.updates);
    }
    
    // Refresh cache
    relationshipManager.rebuildCache();
    
    console.log(Formatter.success(`Issue completed successfully!`));
    console.log(Formatter.info(`Issue ID: ${issueId}`));
    console.log(Formatter.info(`Title: ${updatedIssue.title}`));
    console.log(Formatter.info(`Status: ${updatedIssue.status}`));
    console.log(Formatter.info(`Progress: ${updatedIssue.completion_percentage}%`));
    
    if (updatedIssue.actual_tokens) {
      console.log(Formatter.info(`Actual Tokens: ${updatedIssue.actual_tokens}`));
      
      if (updatedIssue.estimated_tokens > 0) {
        const efficiency = updatedIssue.actual_tokens / updatedIssue.estimated_tokens;
        const efficiencyDisplay = efficiency <= 1 ? 
          Formatter.success(`${(efficiency * 100).toFixed(1)}%`) :
          Formatter.warning(`${(efficiency * 100).toFixed(1)}%`);
        console.log(Formatter.info(`Token Efficiency: ${efficiencyDisplay}`));
      }
    }
    
    if (taskUpdates.length > 0) {
      console.log(Formatter.info(`Also completed ${taskUpdates.length} tasks.`));
    }
    
    console.log('');
    console.log(Formatter.success('🎉 Issue completion summary:'));
    console.log(`  • ${tasks.length} tasks total`);
    console.log(`  • Completed on ${new Date().toLocaleDateString()}`);
    
    if (options.completionNotes) {
      console.log(`  • Notes: ${options.completionNotes}`);
    }
    
    if (options.comment) {
      console.log(`  • Comment: ${options.comment}`);
    }
    
  } catch (error) {
    throw new Error(`Failed to update files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}