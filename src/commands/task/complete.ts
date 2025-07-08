/**
 * Task Complete Command
 * Mark tasks as completed with time tracking
 */

import { Command } from 'commander';
import { ConfigManager } from '../../utils/config-manager.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';
import { Formatter } from '../../utils/formatter.js';

interface CompleteOptions {
  actualTokens?: number;
  timeSpent?: string;
  completionNotes?: string;
  dryRun?: boolean;
}

export function createTaskCompleteCommand(): Command {
  const cmd = new Command('complete');
  
  cmd
    .description('Mark a task as completed')
    .argument('<task-id>', 'task ID to complete')
    .option('--actual-tokens <number>', 'set actual token usage')
    .option('--time-spent <duration>', 'time spent on task (e.g., 2h, 30m, 1d)')
    .option('--completion-notes <text>', 'add completion notes')
    .option('--dry-run', 'show what would be completed without completing')
    .action(async (taskId: string, options: CompleteOptions) => {
      try {
        await completeTask(taskId, options);
      } catch (error) {
        console.error(Formatter.error(`Failed to complete task: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}

async function completeTask(taskId: string, options: CompleteOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();
  const relationshipManager = new RelationshipManager(config);
  const parser = new FrontmatterParser();
  
  // Find the task
  const allTasks = relationshipManager.search({ content_search: taskId }).items.filter(item => 
    'task_id' in item && item.task_id === taskId
  );
  
  if (allTasks.length === 0) {
    throw new Error(`Task not found: ${taskId}`);
  }
  
  const task = allTasks[0];
  
  // Check if already completed
  if (task.status === 'completed') {
    console.log(Formatter.warning(`Task ${taskId} is already completed.`));
    return;
  }
  
  // Show status
  console.log(Formatter.info(`Task: ${task.title}`));
  console.log(Formatter.info(`Current Status: ${task.status}`));
  console.log('');
  
  // Prepare updates
  const updates = {
    status: 'completed' as const,
    updated_date: new Date().toISOString()
  };
  
  if (options.actualTokens !== undefined) {
    (updates as any).actual_tokens = parseInt(options.actualTokens.toString(), 10);
  }
  
  if (options.timeSpent) {
    (updates as any).time_spent = options.timeSpent;
  }
  
  // Show what would be updated
  console.log(Formatter.info(`${options.dryRun ? 'Dry run - ' : ''}Would complete:`));
  console.log(`  Task: ${task.task_id} - ${task.title}`);
  console.log(`    Status: ${task.status} → completed`);
  
  if (options.actualTokens !== undefined) {
    console.log(`    Actual Tokens: ${task.actual_tokens || 0} → ${options.actualTokens}`);
  }
  
  if (options.timeSpent) {
    console.log(`    Time Spent: ${task.time_spent || 'none'} → ${options.timeSpent}`);
  }
  
  if (options.dryRun) {
    return;
  }
  
  // Perform update
  try {
    const updatedTask = parser.updateFile(task.file_path, updates);
    
    // Refresh cache
    relationshipManager.rebuildCache();
    
    console.log(Formatter.success(`Task completed successfully!`));
    console.log(Formatter.info(`Task ID: ${taskId}`));
    console.log(Formatter.info(`Title: ${updatedTask.title}`));
    console.log(Formatter.info(`Status: ${updatedTask.status}`));
    
    if (updatedTask.actual_tokens) {
      console.log(Formatter.info(`Actual Tokens: ${updatedTask.actual_tokens}`));
      
      if (updatedTask.estimated_tokens > 0) {
        const efficiency = updatedTask.actual_tokens / updatedTask.estimated_tokens;
        const efficiencyDisplay = efficiency <= 1 ? 
          Formatter.success(`${(efficiency * 100).toFixed(1)}%`) :
          Formatter.warning(`${(efficiency * 100).toFixed(1)}%`);
        console.log(Formatter.info(`Token Efficiency: ${efficiencyDisplay}`));
      }
    }
    
    if (updatedTask.time_spent) {
      console.log(Formatter.info(`Time Spent: ${updatedTask.time_spent}`));
    }
    
    console.log('');
    console.log(Formatter.success('✅ Task completed!'));
    console.log(`  • Completed on ${new Date().toLocaleDateString()}`);
    
    if (options.completionNotes) {
      console.log(`  • Notes: ${options.completionNotes}`);
    }
    
    // Show time tracking summary if applicable
    if (updatedTask.time_estimate && updatedTask.time_spent) {
      console.log(`  • Time: ${updatedTask.time_spent} (estimated: ${updatedTask.time_estimate})`);
    }
    
  } catch (error) {
    throw new Error(`Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}