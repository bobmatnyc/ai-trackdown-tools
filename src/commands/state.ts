/**
 * State Command Group for AI-Trackdown
 * Handles querying and updating ticket states
 */

import { Command } from 'commander';
import type { 
  AnyItemData, 
  UnifiedState, 
  SearchFilters,
  StateMetadata
} from '../types/ai-trackdown.js';
import { ConfigManager } from '../utils/config-manager.js';
import { Formatter } from '../utils/formatter.js';
import { FrontmatterParser } from '../utils/frontmatter-parser.js';
import { RelationshipManager } from '../utils/relationship-manager.js';
import { StateManager, StateTransition } from '../types/ai-trackdown.js';

interface StateQueryOptions {
  type?: string;
  status?: string;
  state?: string;
  assignee?: string;
  verbose?: boolean;
  format?: 'table' | 'json' | 'summary';
  showTransitions?: boolean;
}

interface StateUpdateOptions {
  reason?: string;
  reviewer?: string;
  assignee?: string;
  dryRun?: boolean;
  force?: boolean;
  verbose?: boolean;
}

export function createStateCommand(): Command {
  const cmd = new Command('state');

  cmd
    .description('Query and update ticket states')
    .option('--verbose', 'show detailed state information');

  // Query states
  cmd
    .command('list')
    .description('List items and their current states')
    .option('--type <type>', 'filter by item type (epic|issue|task|pr)')
    .option('--status <status>', 'filter by legacy status (planning|active|completed|archived)')
    .option('--state <state>', 'filter by unified state')
    .option('--assignee <username>', 'filter by assignee')
    .option('--format <format>', 'output format (table|json|summary)', 'table')
    .option('--show-transitions', 'show available transitions for each item')
    .option('--verbose', 'show detailed state information')
    .action(async (options: StateQueryOptions) => {
      await listStates(options);
    });

  // Show state for specific item
  cmd
    .command('show <item-id>')
    .description('Show detailed state information for a specific item')
    .option('--show-transitions', 'show available state transitions')
    .option('--verbose', 'show detailed state metadata')
    .action(async (itemId: string, options: { showTransitions?: boolean; verbose?: boolean }) => {
      await showState(itemId, options);
    });

  // Update state
  cmd
    .command('update <item-id> <new-state>')
    .description('Update item state directly')
    .option('-r, --reason <text>', 'reason for state change')
    .option('--reviewer <username>', 'reviewer who approved the change')
    .option('-a, --assignee <username>', 'update assignee along with state')
    .option('--dry-run', 'show what would be updated without making changes')
    .option('--force', 'force update even if validation warnings exist')
    .option('--verbose', 'show detailed update information')
    .action(async (itemId: string, newState: string, options: StateUpdateOptions) => {
      await updateState(itemId, newState as UnifiedState, options);
    });

  // Validate states
  cmd
    .command('validate')
    .description('Validate state consistency across all items')
    .option('--type <type>', 'validate specific item type only')
    .option('--fix', 'attempt to fix validation issues')
    .option('--verbose', 'show detailed validation information')
    .action(async (options: { type?: string; fix?: boolean; verbose?: boolean }) => {
      await validateStates(options);
    });

  // State analytics
  cmd
    .command('analytics')
    .description('Show state distribution and analytics')
    .option('--type <type>', 'analytics for specific item type only')
    .option('--format <format>', 'output format (table|json)', 'table')
    .option('--verbose', 'show detailed analytics')
    .action(async (options: { type?: string; format?: string; verbose?: boolean }) => {
      await showStateAnalytics(options);
    });

  // Show state workflow
  cmd
    .command('workflow')
    .description('Show state transition workflow and rules')
    .option('--from <state>', 'show transitions from specific state')
    .option('--to <state>', 'show transitions to specific state')
    .option('--verbose', 'show detailed workflow information')
    .action(async (options: { from?: string; to?: string; verbose?: boolean }) => {
      await showStateWorkflow(options);
    });

  // Batch state operations
  cmd
    .command('batch-update <new-state>')
    .description('Update multiple items to same state')
    .argument('<item-ids...>', 'space-separated list of item IDs')
    .option('-r, --reason <text>', 'reason for state changes')
    .option('--reviewer <username>', 'reviewer who approved the changes')
    .option('--dry-run', 'show what would be updated without making changes')
    .option('--force', 'force updates even if validation warnings exist')
    .option('--verbose', 'show detailed update information')
    .action(async (newState: string, itemIds: string[], options: StateUpdateOptions) => {
      await batchUpdateState(itemIds, newState as UnifiedState, options);
    });

  return cmd;
}

async function listStates(options: StateQueryOptions): Promise<void> {
  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const cliTasksDir = process.env.CLI_TASKS_DIR;
    const paths = configManager.getAbsolutePaths(cliTasksDir);
    const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);

    // Get all items
    let items: AnyItemData[] = [];
    
    // Collect items based on type filter
    if (!options.type || options.type === 'epic') {
      items.push(...relationshipManager.getAllEpics());
    }
    if (!options.type || options.type === 'issue') {
      items.push(...relationshipManager.getAllIssues());
    }
    if (!options.type || options.type === 'task') {
      items.push(...relationshipManager.getAllTasks());
    }
    if (!options.type || options.type === 'pr') {
      items.push(...relationshipManager.getAllPRs());
    }

    // Apply filters
    if (options.status) {
      items = items.filter(item => item.status === options.status);
    }
    
    if (options.state) {
      items = items.filter(item => {
        const effectiveState = StateManager.getEffectiveState(item);
        return effectiveState === options.state;
      });
    }
    
    if (options.assignee) {
      items = items.filter(item => item.assignee === options.assignee);
    }

    if (options.format === 'json') {
      const output = items.map(item => ({
        id: getItemId(item),
        type: getItemType(item),
        title: item.title,
        status: item.status,
        state: StateManager.getEffectiveState(item),
        assignee: item.assignee,
        created_date: item.created_date,
        updated_date: item.updated_date,
        ...(options.showTransitions && {
          available_transitions: StateTransition.getAvailableTransitions(item)
        }),
        ...(options.verbose && {
          state_metadata: item.state_metadata
        })
      }));
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    if (options.format === 'summary') {
      showStateSummary(items);
      return;
    }

    // Table format
    console.log(Formatter.info(`Found ${items.length} items`));
    console.log('');

    if (items.length === 0) {
      console.log(Formatter.warning('No items found matching the criteria'));
      return;
    }

    // Table headers
    const headers = ['ID', 'Type', 'Title', 'Status', 'State', 'Assignee'];
    if (options.showTransitions) headers.push('Available Transitions');
    
    console.log(headers.map(h => Formatter.info(h.padEnd(15))).join(' '));
    console.log(headers.map(() => '─'.repeat(15)).join(' '));

    // Table rows
    for (const item of items) {
      const id = getItemId(item);
      const type = getItemType(item);
      const title = item.title.length > 30 ? item.title.substring(0, 27) + '...' : item.title;
      const status = item.status;
      const state = StateManager.getEffectiveState(item);
      const assignee = item.assignee || 'unassigned';
      
      const row = [
        id.padEnd(15),
        type.padEnd(15),
        title.padEnd(15),
        getStatusDisplay(status).padEnd(15),
        getStateDisplay(state).padEnd(15),
        assignee.padEnd(15)
      ];

      if (options.showTransitions) {
        const transitions = StateTransition.getAvailableTransitions(item);
        const transitionsText = transitions.slice(0, 2).join(', ') + (transitions.length > 2 ? '...' : '');
        row.push(transitionsText.padEnd(15));
      }

      console.log(row.join(' '));
    }

    if (options.verbose) {
      console.log('');
      showStateSummary(items);
    }

  } catch (error) {
    console.error(
      Formatter.error(
        `Failed to list states: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
    process.exit(1);
  }
}

async function showState(itemId: string, options: { showTransitions?: boolean; verbose?: boolean }): Promise<void> {
  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const cliTasksDir = process.env.CLI_TASKS_DIR;
    const paths = configManager.getAbsolutePaths(cliTasksDir);
    const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);

    const item = findItem(relationshipManager, itemId);
    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    const currentState = StateManager.getEffectiveState(item);
    const isResolutionState = StateManager.isResolutionState(currentState);
    const isLegacyStatus = StateManager.isLegacyStatus(currentState);

    console.log(Formatter.info(`State information for ${itemId}:`));
    console.log(`  Title: ${item.title}`);
    console.log(`  Type: ${getItemType(item)}`);
    console.log(`  Legacy Status: ${getStatusDisplay(item.status)}`);
    console.log(`  Current State: ${getStateDisplay(currentState)}`);
    console.log(`  State Type: ${isResolutionState ? 'Resolution State' : 'Legacy Status'}`);
    console.log(`  Assignee: ${item.assignee}`);
    
    if (item.state_metadata) {
      console.log('');
      console.log(Formatter.info('State Metadata:'));
      console.log(`  Transitioned by: ${item.state_metadata.transitioned_by}`);
      console.log(`  Transitioned at: ${new Date(item.state_metadata.transitioned_at).toLocaleString()}`);
      
      if (item.state_metadata.previous_state) {
        console.log(`  Previous state: ${getStateDisplay(item.state_metadata.previous_state)}`);
      }
      
      if (item.state_metadata.transition_reason) {
        console.log(`  Reason: ${item.state_metadata.transition_reason}`);
      }
      
      if (item.state_metadata.reviewer) {
        console.log(`  Reviewer: ${item.state_metadata.reviewer}`);
      }
      
      console.log(`  Automation eligible: ${item.state_metadata.automation_eligible ? 'Yes' : 'No'}`);
      
      if (item.state_metadata.automation_source) {
        console.log(`  Automation source: ${item.state_metadata.automation_source}`);
      }
    } else if (item.state) {
      console.log('');
      console.log(Formatter.warning('State metadata missing (may need migration)'));
    }

    if (options.showTransitions) {
      const availableTransitions = StateTransition.getAvailableTransitions(item);
      console.log('');
      console.log(Formatter.info('Available Transitions:'));
      
      if (availableTransitions.length === 0) {
        console.log('  No valid transitions available');
      } else {
        availableTransitions.forEach(state => {
          const canAutomate = StateTransition.canAutomate(item, state);
          const automateText = canAutomate ? ' (automation eligible)' : ' (manual only)';
          console.log(`  → ${getStateDisplay(state)}${automateText}`);
        });
      }
    }

    if (options.verbose) {
      console.log('');
      console.log(Formatter.debug('Additional Information:'));
      console.log(`  Priority: ${item.priority}`);
      console.log(`  Created: ${new Date(item.created_date).toLocaleString()}`);
      console.log(`  Updated: ${new Date(item.updated_date).toLocaleString()}`);
      console.log(`  File: ${item.file_path}`);
      
      if (item.tags && item.tags.length > 0) {
        console.log(`  Tags: ${item.tags.join(', ')}`);
      }
      
      if (item.dependencies && item.dependencies.length > 0) {
        console.log(`  Dependencies: ${item.dependencies.join(', ')}`);
      }
    }

  } catch (error) {
    console.error(
      Formatter.error(
        `Failed to show state: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
    process.exit(1);
  }
}

async function updateState(itemId: string, newState: UnifiedState, options: StateUpdateOptions): Promise<void> {
  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const cliTasksDir = process.env.CLI_TASKS_DIR;
    const paths = configManager.getAbsolutePaths(cliTasksDir);
    const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);
    const parser = new FrontmatterParser();

    const item = findItem(relationshipManager, itemId);
    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    const currentState = StateManager.getEffectiveState(item);
    
    if (options.verbose || options.dryRun) {
      console.log(Formatter.info(`Updating state for ${itemId}`));
      console.log(Formatter.debug(`Current state: ${currentState}`));
      console.log(Formatter.debug(`New state: ${newState}`));
      console.log(Formatter.debug(`File: ${item.file_path}`));
    }

    // Perform state transition
    const transitionResult = StateTransition.transitionState(
      item,
      newState,
      process.env.USER || 'system',
      options.reason,
      options.reviewer
    );

    if (!transitionResult.success) {
      if (options.force && transitionResult.warnings.length > 0 && transitionResult.errors.length === 0) {
        console.log(Formatter.warning('Forcing state update despite warnings:'));
        transitionResult.warnings.forEach(warning => 
          console.log(Formatter.warning(`  - ${warning}`))
        );
      } else {
        console.error(Formatter.error('State update failed:'));
        transitionResult.errors.forEach(error => 
          console.error(Formatter.error(`  - ${error}`))
        );
        process.exit(1);
      }
    }

    if (transitionResult.warnings.length > 0 && !options.force) {
      console.log(Formatter.warning('Update warnings:'));
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

    console.log(Formatter.success(`State updated for ${itemId}: ${currentState} → ${newState}`));
    
    if (options.verbose) {
      console.log('');
      console.log(Formatter.info('Update details:'));
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
        `Failed to update state: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
    process.exit(1);
  }
}

async function validateStates(options: { type?: string; fix?: boolean; verbose?: boolean }): Promise<void> {
  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const cliTasksDir = process.env.CLI_TASKS_DIR;
    const paths = configManager.getAbsolutePaths(cliTasksDir);
    const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);

    // Get all items
    let items: AnyItemData[] = [];
    
    if (!options.type || options.type === 'epic') {
      items.push(...relationshipManager.getAllEpics());
    }
    if (!options.type || options.type === 'issue') {
      items.push(...relationshipManager.getAllIssues());
    }
    if (!options.type || options.type === 'task') {
      items.push(...relationshipManager.getAllTasks());
    }
    if (!options.type || options.type === 'pr') {
      items.push(...relationshipManager.getAllPRs());
    }

    console.log(Formatter.info(`Validating ${items.length} items...`));

    let validCount = 0;
    let invalidCount = 0;
    let warningCount = 0;
    const issues: Array<{ itemId: string; type: 'error' | 'warning'; message: string }> = [];

    for (const item of items) {
      const itemId = getItemId(item);
      let hasErrors = false;

      // Check if item has state field
      if (!item.state) {
        issues.push({
          itemId,
          type: 'warning',
          message: 'Missing state field (using legacy status)'
        });
        warningCount++;
      }

      // Check if item has state metadata when it has state
      if (item.state && !item.state_metadata) {
        issues.push({
          itemId,
          type: 'error',
          message: 'Missing state metadata'
        });
        hasErrors = true;
      }

      // Validate state metadata if present
      if (item.state_metadata) {
        const validation = StateManager.validateStateMetadata(item.state_metadata);
        if (!validation.valid) {
          validation.errors.forEach(error => {
            issues.push({
              itemId,
              type: 'error',
              message: `Invalid state metadata: ${error.message}`
            });
          });
          hasErrors = true;
        }
        
        validation.warnings.forEach(warning => {
          issues.push({
            itemId,
            type: 'warning',
            message: `State metadata warning: ${warning.message}`
          });
          warningCount++;
        });
      }

      if (hasErrors) {
        invalidCount++;
      } else {
        validCount++;
      }
    }

    console.log('');
    console.log(Formatter.info('Validation Results:'));
    console.log(`  Valid: ${validCount}`);
    console.log(`  Invalid: ${invalidCount}`);
    console.log(`  Warnings: ${warningCount}`);
    console.log(`  Total: ${items.length}`);

    if (issues.length > 0) {
      console.log('');
      console.log(Formatter.warning('Issues Found:'));
      
      const errors = issues.filter(i => i.type === 'error');
      const warnings = issues.filter(i => i.type === 'warning');

      if (errors.length > 0) {
        console.log('');
        console.log(Formatter.error('Errors:'));
        errors.forEach(issue => {
          console.log(Formatter.error(`  ${issue.itemId}: ${issue.message}`));
        });
      }

      if (warnings.length > 0 && options.verbose) {
        console.log('');
        console.log(Formatter.warning('Warnings:'));
        warnings.forEach(issue => {
          console.log(Formatter.warning(`  ${issue.itemId}: ${issue.message}`));
        });
      }

      if (options.fix) {
        console.log('');
        console.log(Formatter.info('Fix option not yet implemented - would apply automatic fixes'));
      }
    } else {
      console.log('');
      console.log(Formatter.success('All items have valid state configuration!'));
    }

    if (invalidCount > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error(
      Formatter.error(
        `Failed to validate states: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
    process.exit(1);
  }
}

async function showStateAnalytics(options: { type?: string; format?: string; verbose?: boolean }): Promise<void> {
  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const cliTasksDir = process.env.CLI_TASKS_DIR;
    const paths = configManager.getAbsolutePaths(cliTasksDir);
    const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);

    // Get all items
    let items: AnyItemData[] = [];
    
    if (!options.type || options.type === 'epic') {
      items.push(...relationshipManager.getAllEpics());
    }
    if (!options.type || options.type === 'issue') {
      items.push(...relationshipManager.getAllIssues());
    }
    if (!options.type || options.type === 'task') {
      items.push(...relationshipManager.getAllTasks());
    }
    if (!options.type || options.type === 'pr') {
      items.push(...relationshipManager.getAllPRs());
    }

    // Calculate analytics
    const stateDistribution: Record<string, number> = {};
    const statusDistribution: Record<string, number> = {};
    const typeDistribution: Record<string, number> = {};
    let hasMigration = 0;
    let needsMigration = 0;

    items.forEach(item => {
      const state = StateManager.getEffectiveState(item);
      const status = item.status;
      const type = getItemType(item);

      stateDistribution[state] = (stateDistribution[state] || 0) + 1;
      statusDistribution[status] = (statusDistribution[status] || 0) + 1;
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;

      if (item.state && item.state_metadata) {
        hasMigration++;
      } else {
        needsMigration++;
      }
    });

    if (options.format === 'json') {
      const analytics = {
        total_items: items.length,
        state_distribution: stateDistribution,
        status_distribution: statusDistribution,
        type_distribution: typeDistribution,
        migration_status: {
          migrated: hasMigration,
          needs_migration: needsMigration,
          migration_percentage: hasMigration / (hasMigration + needsMigration) * 100
        }
      };
      console.log(JSON.stringify(analytics, null, 2));
      return;
    }

    // Table format
    console.log(Formatter.info(`State Analytics (${items.length} total items):`));
    console.log('');

    console.log(Formatter.info('State Distribution:'));
    Object.entries(stateDistribution)
      .sort(([,a], [,b]) => b - a)
      .forEach(([state, count]) => {
        const percentage = (count / items.length * 100).toFixed(1);
        console.log(`  ${getStateDisplay(state).padEnd(20)} ${count.toString().padStart(4)} (${percentage}%)`);
      });

    if (options.verbose) {
      console.log('');
      console.log(Formatter.info('Legacy Status Distribution:'));
      Object.entries(statusDistribution)
        .sort(([,a], [,b]) => b - a)
        .forEach(([status, count]) => {
          const percentage = (count / items.length * 100).toFixed(1);
          console.log(`  ${getStatusDisplay(status).padEnd(20)} ${count.toString().padStart(4)} (${percentage}%)`);
        });

      console.log('');
      console.log(Formatter.info('Type Distribution:'));
      Object.entries(typeDistribution)
        .sort(([,a], [,b]) => b - a)
        .forEach(([type, count]) => {
          const percentage = (count / items.length * 100).toFixed(1);
          console.log(`  ${type.padEnd(20)} ${count.toString().padStart(4)} (${percentage}%)`);
        });
    }

    console.log('');
    console.log(Formatter.info('Migration Status:'));
    console.log(`  Migrated to unified state: ${hasMigration}`);
    console.log(`  Needs migration: ${needsMigration}`);
    if (hasMigration + needsMigration > 0) {
      const migrationPercentage = (hasMigration / (hasMigration + needsMigration) * 100).toFixed(1);
      console.log(`  Migration progress: ${migrationPercentage}%`);
    }

  } catch (error) {
    console.error(
      Formatter.error(
        `Failed to show analytics: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
    process.exit(1);
  }
}

async function showStateWorkflow(options: { from?: string; to?: string; verbose?: boolean }): Promise<void> {
  const allStates: UnifiedState[] = [
    'planning', 'active', 'completed', 'archived',
    'ready_for_engineering', 'ready_for_qa', 'ready_for_deployment', 'won_t_do', 'done'
  ];

  console.log(Formatter.info('State Transition Workflow:'));
  console.log('');

  if (options.from) {
    const fromState = options.from as UnifiedState;
    const transitions = StateManager.getAllowedTransitions(fromState);
    
    console.log(Formatter.info(`Transitions from ${getStateDisplay(fromState)}:`));
    if (transitions.length === 0) {
      console.log('  No transitions available');
    } else {
      transitions.forEach(state => {
        console.log(`  → ${getStateDisplay(state)}`);
      });
    }
    return;
  }

  if (options.to) {
    const toState = options.to as UnifiedState;
    const fromStates = allStates.filter(state => {
      const transitions = StateManager.getAllowedTransitions(state);
      return transitions.includes(toState);
    });
    
    console.log(Formatter.info(`Transitions to ${getStateDisplay(toState)}:`));
    if (fromStates.length === 0) {
      console.log('  No transitions lead to this state');
    } else {
      fromStates.forEach(state => {
        console.log(`  ${getStateDisplay(state)} →`);
      });
    }
    return;
  }

  // Show complete workflow
  console.log(Formatter.info('Complete Workflow:'));
  console.log('');
  
  console.log(Formatter.info('Legacy Status Flow:'));
  console.log('  planning → active → completed → archived');
  console.log('');
  
  console.log(Formatter.info('Resolution State Flow:'));
  console.log('  planning → ready_for_engineering');
  console.log('  active → ready_for_engineering');
  console.log('  ready_for_engineering → ready_for_qa');
  console.log('  ready_for_qa → ready_for_deployment');
  console.log('  ready_for_deployment → done');
  console.log('  done → archived');
  console.log('');
  
  console.log(Formatter.info('Rejection Flow:'));
  console.log('  any_state → won_t_do → archived');

  if (options.verbose) {
    console.log('');
    console.log(Formatter.info('All Available Transitions:'));
    allStates.forEach(state => {
      const transitions = StateManager.getAllowedTransitions(state);
      console.log(`  ${getStateDisplay(state)}:`);
      if (transitions.length === 0) {
        console.log('    (no transitions)');
      } else {
        transitions.forEach(toState => {
          console.log(`    → ${getStateDisplay(toState)}`);
        });
      }
    });
  }
}

async function batchUpdateState(itemIds: string[], newState: UnifiedState, options: StateUpdateOptions): Promise<void> {
  console.log(Formatter.info(`Batch updating ${itemIds.length} items to ${newState}`));
  
  if (options.dryRun) {
    console.log(Formatter.info('Dry run - no changes will be made'));
  }

  let successCount = 0;
  let failureCount = 0;
  const failures: string[] = [];

  for (const itemId of itemIds) {
    try {
      await updateState(itemId, newState, { ...options, verbose: false });
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
  console.log(Formatter.info('Batch update summary:'));
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

// Helper functions
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

function getItemId(item: AnyItemData): string {
  if ('project_id' in item && 'type' in item) return item.project_id;
  if ('epic_id' in item) return item.epic_id;
  if ('issue_id' in item && 'pr_id' in item) return item.pr_id;
  if ('issue_id' in item && 'task_id' in item) return item.task_id;
  if ('issue_id' in item) return item.issue_id;
  throw new Error('Unknown item type');
}

function getItemType(item: AnyItemData): string {
  if ('project_id' in item && 'type' in item) return 'project';
  if ('epic_id' in item && !('issue_id' in item)) return 'epic';
  if ('issue_id' in item && 'pr_id' in item) return 'pr';
  if ('issue_id' in item && 'task_id' in item) return 'task';
  if ('issue_id' in item) return 'issue';
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

function showStateSummary(items: AnyItemData[]): void {
  const stateDistribution: Record<string, number> = {};
  
  items.forEach(item => {
    const state = StateManager.getEffectiveState(item);
    stateDistribution[state] = (stateDistribution[state] || 0) + 1;
  });

  console.log(Formatter.info('State Summary:'));
  Object.entries(stateDistribution)
    .sort(([,a], [,b]) => b - a)
    .forEach(([state, count]) => {
      const percentage = (count / items.length * 100).toFixed(1);
      console.log(`  ${getStateDisplay(state).padEnd(20)} ${count.toString().padStart(4)} (${percentage}%)`);
    });
}