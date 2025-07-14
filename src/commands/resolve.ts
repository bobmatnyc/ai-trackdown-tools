/**
 * Resolve Command Group for AI-Trackdown
 * Handles transitioning tickets to resolution states
 */

import { Command } from 'commander';
import type { 
  AnyItemData, 
  ResolutionState, 
  UnifiedState, 
  StateValidationResult 
} from '../types/ai-trackdown.js';
import { ConfigManager } from '../utils/config-manager.js';
import { Formatter } from '../utils/formatter.js';
import { FrontmatterParser } from '../utils/frontmatter-parser.js';
import { RelationshipManager } from '../utils/relationship-manager.js';
import { StateManager, StateTransition } from '../types/ai-trackdown.js';

interface ResolveOptions {
  reason?: string;
  reviewer?: string;
  assignee?: string;
  dryRun?: boolean;
  force?: boolean;
  batch?: boolean;
  verbose?: boolean;
}

export function createResolveCommand(): Command {
  const cmd = new Command('resolve');

  cmd
    .description('Transition tickets to resolution states')
    .option('--dry-run', 'show what would be resolved without making changes')
    .option('--force', 'force resolution even if validation warnings exist')
    .option('--batch', 'enable batch processing for multiple items')
    .option('--verbose', 'show detailed transition information');

  // Individual resolution commands
  cmd
    .command('engineering <item-id>')
    .description('Mark item as ready for engineering')
    .option('-r, --reason <text>', 'reason for transition')
    .option('--reviewer <username>', 'reviewer who approved the transition')
    .option('-a, --assignee <username>', 'assign to specific engineer')
    .option('--dry-run', 'show what would be resolved without making changes')
    .option('--force', 'force resolution even if validation warnings exist')
    .option('--verbose', 'show detailed transition information')
    .action(async (itemId: string, options: ResolveOptions) => {
      await resolveItem(itemId, 'ready_for_engineering', options);
    });

  cmd
    .command('qa <item-id>')
    .description('Mark item as ready for QA')
    .option('-r, --reason <text>', 'reason for transition')
    .option('--reviewer <username>', 'reviewer who approved the transition')
    .option('-a, --assignee <username>', 'assign to specific QA engineer')
    .option('--dry-run', 'show what would be resolved without making changes')
    .option('--force', 'force resolution even if validation warnings exist')
    .option('--verbose', 'show detailed transition information')
    .action(async (itemId: string, options: ResolveOptions) => {
      await resolveItem(itemId, 'ready_for_qa', options);
    });

  cmd
    .command('deployment <item-id>')
    .description('Mark item as ready for deployment')
    .option('-r, --reason <text>', 'reason for transition')
    .option('--reviewer <username>', 'reviewer who approved the transition')
    .option('-a, --assignee <username>', 'assign to specific deployment engineer')
    .option('--dry-run', 'show what would be resolved without making changes')
    .option('--force', 'force resolution even if validation warnings exist')
    .option('--verbose', 'show detailed transition information')
    .action(async (itemId: string, options: ResolveOptions) => {
      await resolveItem(itemId, 'ready_for_deployment', options);
    });

  cmd
    .command('done <item-id>')
    .description('Mark item as completed/done')
    .option('-r, --reason <text>', 'reason for completion')
    .option('--reviewer <username>', 'reviewer who approved completion')
    .option('--dry-run', 'show what would be resolved without making changes')
    .option('--force', 'force resolution even if validation warnings exist')
    .option('--verbose', 'show detailed transition information')
    .action(async (itemId: string, options: ResolveOptions) => {
      await resolveItem(itemId, 'done', options);
    });

  cmd
    .command('reject <item-id>')
    .description('Mark item as won\'t do (rejected)')
    .option('-r, --reason <text>', 'reason for rejection (required for rejection)')
    .option('--reviewer <username>', 'reviewer who made the rejection decision')
    .option('--dry-run', 'show what would be resolved without making changes')
    .option('--force', 'force resolution even if validation warnings exist')
    .option('--verbose', 'show detailed transition information')
    .action(async (itemId: string, options: ResolveOptions) => {
      if (!options.reason && !options.dryRun) {
        console.error(Formatter.error('Reason is required when rejecting items'));
        process.exit(1);
      }
      await resolveItem(itemId, 'won_t_do', options);
    });

  // Batch resolution commands
  cmd
    .command('batch-engineering')
    .description('Mark multiple items as ready for engineering')
    .argument('<item-ids...>', 'space-separated list of item IDs')
    .option('-r, --reason <text>', 'reason for transitions')
    .option('--reviewer <username>', 'reviewer who approved the transitions')
    .option('-a, --assignee <username>', 'assign to specific engineer')
    .option('--dry-run', 'show what would be resolved without making changes')
    .option('--force', 'force resolution even if validation warnings exist')
    .option('--verbose', 'show detailed transition information')
    .action(async (itemIds: string[], options: ResolveOptions) => {
      await resolveBatch(itemIds, 'ready_for_engineering', options);
    });

  cmd
    .command('batch-qa')
    .description('Mark multiple items as ready for QA')
    .argument('<item-ids...>', 'space-separated list of item IDs')
    .option('-r, --reason <text>', 'reason for transitions')
    .option('--reviewer <username>', 'reviewer who approved the transitions')
    .option('-a, --assignee <username>', 'assign to specific QA engineer')
    .option('--dry-run', 'show what would be resolved without making changes')
    .option('--force', 'force resolution even if validation warnings exist')
    .option('--verbose', 'show detailed transition information')
    .action(async (itemIds: string[], options: ResolveOptions) => {
      await resolveBatch(itemIds, 'ready_for_qa', options);
    });

  cmd
    .command('batch-deployment')
    .description('Mark multiple items as ready for deployment')
    .argument('<item-ids...>', 'space-separated list of item IDs')
    .option('-r, --reason <text>', 'reason for transitions')
    .option('--reviewer <username>', 'reviewer who approved the transitions')
    .option('-a, --assignee <username>', 'assign to specific deployment engineer')
    .option('--dry-run', 'show what would be resolved without making changes')
    .option('--force', 'force resolution even if validation warnings exist')
    .option('--verbose', 'show detailed transition information')
    .action(async (itemIds: string[], options: ResolveOptions) => {
      await resolveBatch(itemIds, 'ready_for_deployment', options);
    });

  // Show available transitions
  cmd
    .command('status <item-id>')
    .description('Show current state and available transitions for an item')
    .option('--verbose', 'show detailed state information')
    .action(async (itemId: string, options: { verbose?: boolean }) => {
      await showResolveStatus(itemId, options);
    });

  return cmd;
}

async function resolveItem(
  itemId: string, 
  targetState: ResolutionState, 
  options: ResolveOptions
): Promise<void> {
  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const cliTasksDir = process.env.CLI_TASKS_DIR;
    const paths = configManager.getAbsolutePaths(cliTasksDir);
    const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);
    const parser = new FrontmatterParser();

    // Find the item
    const item = findItem(relationshipManager, itemId);
    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    const currentState = StateManager.getEffectiveState(item);
    
    if (options.verbose || options.dryRun) {
      console.log(Formatter.info(`Resolving ${itemId} to ${targetState}`));
      console.log(Formatter.debug(`Current state: ${currentState}`));
      console.log(Formatter.debug(`Target state: ${targetState}`));
      console.log(Formatter.debug(`File: ${item.file_path}`));
    }

    // Perform state transition
    const transitionResult = StateTransition.transitionState(
      item,
      targetState,
      process.env.USER || 'system',
      options.reason,
      options.reviewer
    );

    if (!transitionResult.success) {
      if (options.force && transitionResult.warnings.length > 0 && transitionResult.errors.length === 0) {
        console.log(Formatter.warning('Forcing transition despite warnings:'));
        transitionResult.warnings.forEach(warning => 
          console.log(Formatter.warning(`  - ${warning}`))
        );
      } else {
        console.error(Formatter.error('State transition failed:'));
        transitionResult.errors.forEach(error => 
          console.error(Formatter.error(`  - ${error}`))
        );
        process.exit(1);
      }
    }

    if (transitionResult.warnings.length > 0 && !options.force) {
      console.log(Formatter.warning('Transition warnings:'));
      transitionResult.warnings.forEach(warning => 
        console.log(Formatter.warning(`  - ${warning}`))
      );
    }

    if (options.dryRun) {
      console.log(Formatter.info('Dry run - no changes made'));
      return;
    }

    // Update assignee if provided
    if (options.assignee) {
      transitionResult.item.assignee = options.assignee;
    }

    // Write the updated item
    const updates = {
      state: transitionResult.item.state,
      state_metadata: transitionResult.item.state_metadata,
      updated_date: transitionResult.item.updated_date,
      ...(options.assignee && { assignee: options.assignee })
    };

    parser.updateFile(item.file_path, updates);

    // Refresh cache
    relationshipManager.rebuildCache();

    console.log(Formatter.success(`Item ${itemId} resolved to ${targetState}`));
    
    if (options.verbose) {
      console.log('');
      console.log(Formatter.info('Updated fields:'));
      console.log(`  State: ${currentState} → ${targetState}`);
      console.log(`  Transitioned by: ${transitionResult.item.state_metadata?.transitioned_by}`);
      console.log(`  Transitioned at: ${new Date(transitionResult.item.state_metadata?.transitioned_at || '').toLocaleString()}`);
      if (options.reason) {
        console.log(`  Reason: ${options.reason}`);
      }
      if (options.reviewer) {
        console.log(`  Reviewer: ${options.reviewer}`);
      }
      if (options.assignee) {
        console.log(`  Assigned to: ${options.assignee}`);
      }
    }

  } catch (error) {
    console.error(
      Formatter.error(
        `Failed to resolve item: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
    process.exit(1);
  }
}

async function resolveBatch(
  itemIds: string[], 
  targetState: ResolutionState, 
  options: ResolveOptions
): Promise<void> {
  console.log(Formatter.info(`Batch resolving ${itemIds.length} items to ${targetState}`));
  
  if (options.dryRun) {
    console.log(Formatter.info('Dry run - no changes will be made'));
  }

  let successCount = 0;
  let failureCount = 0;
  const failures: string[] = [];

  for (const itemId of itemIds) {
    try {
      await resolveItem(itemId, targetState, { ...options, verbose: false });
      successCount++;
      console.log(Formatter.success(`✓ ${itemId}`));
    } catch (error) {
      failureCount++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      failures.push(`${itemId}: ${errorMsg}`);
      console.log(Formatter.error(`✗ ${itemId}: ${errorMsg}`));
    }
  }

  console.log('');
  console.log(Formatter.info('Batch resolution summary:'));
  console.log(`  Successful: ${successCount}`);
  console.log(`  Failed: ${failureCount}`);
  console.log(`  Total: ${itemIds.length}`);

  if (failures.length > 0 && options.verbose) {
    console.log('');
    console.log(Formatter.error('Failures:'));
    failures.forEach(failure => console.log(Formatter.error(`  - ${failure}`)));
  }

  if (failureCount > 0) {
    process.exit(1);
  }
}

async function showResolveStatus(itemId: string, options: { verbose?: boolean }): Promise<void> {
  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const cliTasksDir = process.env.CLI_TASKS_DIR;
    const paths = configManager.getAbsolutePaths(cliTasksDir);
    const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);

    // Find the item
    const item = findItem(relationshipManager, itemId);
    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    const currentState = StateManager.getEffectiveState(item);
    const availableTransitions = StateTransition.getAvailableTransitions(item);

    console.log(Formatter.info(`Resolve status for ${itemId}:`));
    console.log(`  Current state: ${getStateDisplay(currentState)}`);
    console.log(`  Item type: ${getItemType(item)}`);
    console.log(`  File: ${item.file_path}`);

    if (item.state_metadata) {
      console.log('');
      console.log(Formatter.info('State metadata:'));
      console.log(`  Transitioned by: ${item.state_metadata.transitioned_by}`);
      console.log(`  Transitioned at: ${new Date(item.state_metadata.transitioned_at).toLocaleString()}`);
      
      if (item.state_metadata.previous_state) {
        console.log(`  Previous state: ${item.state_metadata.previous_state}`);
      }
      
      if (item.state_metadata.transition_reason) {
        console.log(`  Reason: ${item.state_metadata.transition_reason}`);
      }
      
      if (item.state_metadata.reviewer) {
        console.log(`  Reviewer: ${item.state_metadata.reviewer}`);
      }
      
      console.log(`  Automation eligible: ${item.state_metadata.automation_eligible ? 'Yes' : 'No'}`);
    }

    console.log('');
    console.log(Formatter.info('Available transitions:'));
    
    if (availableTransitions.length === 0) {
      console.log('  No valid transitions available');
    } else {
      availableTransitions.forEach(state => {
        const canAutomate = StateTransition.canAutomate(item, state);
        const automateText = canAutomate ? ' (automation eligible)' : ' (manual only)';
        console.log(`  → ${getStateDisplay(state)}${automateText}`);
      });
    }

    if (options.verbose) {
      console.log('');
      console.log(Formatter.debug('Item details:'));
      console.log(`  Title: ${item.title}`);
      console.log(`  Priority: ${item.priority}`);
      console.log(`  Assignee: ${item.assignee}`);
      console.log(`  Created: ${new Date(item.created_date).toLocaleString()}`);
      console.log(`  Updated: ${new Date(item.updated_date).toLocaleString()}`);
    }

  } catch (error) {
    console.error(
      Formatter.error(
        `Failed to get resolve status: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
    process.exit(1);
  }
}

function findItem(relationshipManager: RelationshipManager, itemId: string): AnyItemData | null {
  // Try to find in different hierarchies
  const epic = relationshipManager.getEpicHierarchy(itemId);
  if (epic) return epic.epic;

  const issue = relationshipManager.getIssueHierarchy(itemId);
  if (issue) return issue.issue;

  const task = relationshipManager.getTaskHierarchy(itemId);
  if (task) return task.task;

  const pr = relationshipManager.getPRHierarchy(itemId);
  if (pr) return pr.pr;

  return null;
}

function getItemType(item: AnyItemData): string {
  if ('epic_id' in item && !('issue_id' in item)) return 'epic';
  if ('issue_id' in item && 'pr_id' in item) return 'pr';
  if ('issue_id' in item && 'task_id' in item) return 'task';
  if ('issue_id' in item) return 'issue';
  if ('project_id' in item) return 'project';
  return 'unknown';
}

function getStateDisplay(state: UnifiedState): string {
  const stateColors: Record<string, (text: string) => string> = {
    planning: (text) => Formatter.info(text),
    active: (text) => Formatter.warning(text),
    completed: (text) => Formatter.success(text),
    archived: (text) => Formatter.debug(text),
    ready_for_engineering: (text) => Formatter.info(text),
    ready_for_qa: (text) => Formatter.warning(text),
    ready_for_deployment: (text) => Formatter.info(text),
    won_t_do: (text) => Formatter.error(text),
    done: (text) => Formatter.success(text),
  };

  const colorFn = stateColors[state] || ((text) => text);
  return colorFn(state.toUpperCase().replace(/_/g, ' '));
}