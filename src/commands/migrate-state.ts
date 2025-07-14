/**
 * State Migration Command for AI-Trackdown
 * Converts legacy status field to unified state field
 */

import { Command } from 'commander';
import { writeFileSync } from 'fs';
import type { 
  AnyItemData, 
  MigrationResult,
  MigrationLogEntry
} from '../types/ai-trackdown.js';
import { ConfigManager } from '../utils/config-manager.js';
import { Formatter } from '../utils/formatter.js';
import { FrontmatterParser } from '../utils/frontmatter-parser.js';
import { RelationshipManager } from '../utils/relationship-manager.js';
import { StateMigration } from '../utils/state-migration.js';

interface MigrateStateOptions {
  type?: string;
  dryRun?: boolean;
  backup?: boolean;
  force?: boolean;
  verbose?: boolean;
  logFile?: string;
  migratedBy?: string;
}

export function createMigrateStateCommand(): Command {
  const cmd = new Command('migrate-state');

  cmd
    .description('Migrate legacy status field to unified state field')
    .option('--type <type>', 'migrate specific item type only (epic|issue|task|pr)')
    .option('--dry-run', 'preview migration without making changes')
    .option('--backup', 'create backup files before migration')
    .option('--force', 'proceed with migration even if validation warnings exist')
    .option('--verbose', 'show detailed migration information')
    .option('--log-file <path>', 'save migration log to file')
    .option('--migrated-by <username>', 'specify who performed the migration', 'system')
    .action(async (options: MigrateStateOptions) => {
      await migrateStates(options);
    });

  // Preview migration
  cmd
    .command('preview')
    .description('Preview migration changes without applying them')
    .option('--type <type>', 'preview specific item type only')
    .option('--verbose', 'show detailed preview information')
    .action(async (options: { type?: string; verbose?: boolean }) => {
      await previewMigration(options);
    });

  // Validate migration
  cmd
    .command('validate')
    .description('Validate migration results')
    .option('--type <type>', 'validate specific item type only')
    .option('--verbose', 'show detailed validation information')
    .action(async (options: { type?: string; verbose?: boolean }) => {
      await validateMigration(options);
    });

  // Rollback migration
  cmd
    .command('rollback <log-file>')
    .description('Rollback migration using log file')
    .option('--dry-run', 'preview rollback without making changes')
    .option('--verbose', 'show detailed rollback information')
    .action(async (logFile: string, options: { dryRun?: boolean; verbose?: boolean }) => {
      await rollbackMigration(logFile, options);
    });

  // Status command
  cmd
    .command('status')
    .description('Show migration status for all items')
    .option('--type <type>', 'show status for specific item type only')
    .option('--format <format>', 'output format (table|json)', 'table')
    .action(async (options: { type?: string; format?: string }) => {
      await showMigrationStatus(options);
    });

  return cmd;
}

async function migrateStates(options: MigrateStateOptions): Promise<void> {
  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const cliTasksDir = process.env.CLI_TASKS_DIR;
    const paths = configManager.getAbsolutePaths(cliTasksDir);
    const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);
    const parser = new FrontmatterParser();

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

    console.log(Formatter.info(`Found ${items.length} items for migration`));

    // Filter items that need migration
    const itemsNeedingMigration = items.filter(item => StateMigration.needsMigration(item));
    
    console.log(Formatter.info(`${itemsNeedingMigration.length} items need migration`));
    console.log(Formatter.info(`${items.length - itemsNeedingMigration.length} items already migrated`));

    if (itemsNeedingMigration.length === 0) {
      console.log(Formatter.success('All items are already migrated!'));
      return;
    }

    if (options.dryRun) {
      console.log(Formatter.info('Dry run - showing migration preview:'));
      const preview = StateMigration.previewMigration(itemsNeedingMigration);
      showMigrationPreview(preview, options.verbose);
      return;
    }

    // Create backup if requested
    if (options.backup) {
      console.log(Formatter.info('Creating backup files...'));
      await createBackups(itemsNeedingMigration);
      console.log(Formatter.success('Backup files created'));
    }

    // Perform migration
    console.log(Formatter.info('Starting migration...'));
    const migrationResult = StateMigration.migrateItems(
      itemsNeedingMigration, 
      options.migratedBy || 'system'
    );

    // Apply migrations to files
    let filesUpdated = 0;
    let filesFailedToUpdate = 0;

    for (let i = 0; i < itemsNeedingMigration.length; i++) {
      const originalItem = itemsNeedingMigration[i];
      const logEntry = migrationResult.migration_log[i];
      
      if (logEntry.success && migrationResult.migration_log[i]) {
        try {
          // Find the migrated item
          const migratedItem = items.find(item => 
            getItemId(item) === logEntry.item_id
          );
          
          if (migratedItem) {
            // Perform the migration on this specific item
            const singleMigrationResult = StateMigration.migrateItem(
              migratedItem, 
              options.migratedBy || 'system'
            );
            
            if (singleMigrationResult.success) {
              // Update the file
              const updates = {
                state: singleMigrationResult.item.state,
                state_metadata: singleMigrationResult.item.state_metadata,
                updated_date: new Date().toISOString()
              };
              
              parser.updateFile(originalItem.file_path, updates);
              filesUpdated++;
              
              if (options.verbose) {
                console.log(Formatter.success(`✓ ${logEntry.item_id}: ${logEntry.old_status} → ${logEntry.new_state}`));
              }
            }
          }
        } catch (error) {
          filesFailedToUpdate++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.log(Formatter.error(`✗ ${logEntry.item_id}: ${errorMsg}`));
        }
      }
    }

    // Refresh cache
    relationshipManager.rebuildCache();

    // Save migration log
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultLogFile = `migration-log-${timestamp}.json`;
    const logFile = options.logFile || defaultLogFile;
    
    const logData = {
      timestamp: new Date().toISOString(),
      migration_result: migrationResult,
      files_updated: filesUpdated,
      files_failed: filesFailedToUpdate,
      options: {
        type: options.type,
        migrated_by: options.migratedBy,
        backup_created: options.backup
      }
    };
    
    writeFileSync(logFile, JSON.stringify(logData, null, 2));

    // Show results
    console.log('');
    console.log(Formatter.info('Migration Results:'));
    console.log(`  Items processed: ${itemsNeedingMigration.length}`);
    console.log(`  Successfully migrated: ${migrationResult.migrated_count}`);
    console.log(`  Failed migrations: ${migrationResult.failed_count}`);
    console.log(`  Files updated: ${filesUpdated}`);
    console.log(`  Files failed to update: ${filesFailedToUpdate}`);
    console.log(`  Migration log: ${logFile}`);

    if (migrationResult.errors.length > 0) {
      console.log('');
      console.log(Formatter.error('Migration Errors:'));
      migrationResult.errors.forEach(error => {
        console.log(Formatter.error(`  - ${error}`));
      });
    }

    if (migrationResult.failed_count > 0 || filesFailedToUpdate > 0) {
      console.log('');
      console.log(Formatter.warning('Some items failed to migrate. Check the log file for details.'));
      process.exit(1);
    } else {
      console.log('');
      console.log(Formatter.success('Migration completed successfully!'));
    }

  } catch (error) {
    console.error(
      Formatter.error(
        `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
    process.exit(1);
  }
}

async function previewMigration(options: { type?: string; verbose?: boolean }): Promise<void> {
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

    const preview = StateMigration.previewMigration(items);
    
    console.log(Formatter.info('Migration Preview:'));
    console.log(`  Total items: ${preview.total_items}`);
    console.log(`  Need migration: ${preview.needs_migration}`);
    console.log(`  Already migrated: ${preview.already_migrated}`);

    if (preview.needs_migration === 0) {
      console.log('');
      console.log(Formatter.success('All items are already migrated!'));
      return;
    }

    showMigrationPreview(preview, options.verbose);

  } catch (error) {
    console.error(
      Formatter.error(
        `Preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
    process.exit(1);
  }
}

async function validateMigration(options: { type?: string; verbose?: boolean }): Promise<void> {
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

    const validation = StateMigration.validateMigration(items);
    
    console.log(Formatter.info('Migration Validation:'));
    console.log(`  Valid: ${validation.valid ? 'Yes' : 'No'}`);
    console.log(`  Total items: ${items.length}`);
    console.log(`  Errors: ${validation.errors.length}`);
    console.log(`  Warnings: ${validation.warnings.length}`);

    if (validation.errors.length > 0) {
      console.log('');
      console.log(Formatter.error('Validation Errors:'));
      validation.errors.forEach(error => {
        console.log(Formatter.error(`  - ${error}`));
      });
    }

    if (validation.warnings.length > 0 && options.verbose) {
      console.log('');
      console.log(Formatter.warning('Validation Warnings:'));
      validation.warnings.forEach(warning => {
        console.log(Formatter.warning(`  - ${warning}`));
      });
    }

    if (options.verbose) {
      console.log('');
      console.log(Formatter.info('Validation Details:'));
      validation.validation_details.forEach(detail => {
        const status = detail.has_state && detail.has_metadata && detail.metadata_valid ? '✓' : '✗';
        console.log(`  ${status} ${detail.item_id}: state=${detail.has_state}, metadata=${detail.has_metadata}, valid=${detail.metadata_valid}, backward_compat=${detail.backward_compatible}`);
      });
    }

    if (!validation.valid) {
      process.exit(1);
    } else {
      console.log('');
      console.log(Formatter.success('Migration validation passed!'));
    }

  } catch (error) {
    console.error(
      Formatter.error(
        `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
    process.exit(1);
  }
}

async function rollbackMigration(logFile: string, options: { dryRun?: boolean; verbose?: boolean }): Promise<void> {
  try {
    // Read migration log
    const logData = JSON.parse(require('fs').readFileSync(logFile, 'utf8'));
    const migrationResult: MigrationResult = logData.migration_result;
    
    console.log(Formatter.info(`Rolling back migration from ${logFile}`));
    console.log(`  Original migration: ${new Date(logData.timestamp).toLocaleString()}`);
    console.log(`  Items to rollback: ${migrationResult.migration_log.length}`);

    if (options.dryRun) {
      console.log(Formatter.info('Dry run - showing rollback preview:'));
    }

    const rollbackPlan = StateMigration.createRollbackPlan(migrationResult.migration_log);
    
    console.log('');
    console.log(Formatter.info('Rollback Plan:'));
    console.log(`  Total operations: ${rollbackPlan.rollback_summary.total_operations}`);
    console.log(`  Remove state fields: ${rollbackPlan.rollback_summary.remove_state_fields}`);
    console.log(`  Restore status: ${rollbackPlan.rollback_summary.restore_status}`);
    console.log(`  No action needed: ${rollbackPlan.rollback_summary.no_action}`);

    if (options.verbose || options.dryRun) {
      console.log('');
      console.log(Formatter.info('Rollback Operations:'));
      rollbackPlan.rollback_operations.forEach(op => {
        console.log(`  ${op.item_id}: ${op.action} (original: ${op.original_status})`);
      });
    }

    if (options.dryRun) {
      return;
    }

    // Perform rollback
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const cliTasksDir = process.env.CLI_TASKS_DIR;
    const paths = configManager.getAbsolutePaths(cliTasksDir);
    const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);
    const parser = new FrontmatterParser();

    let successCount = 0;
    let failureCount = 0;

    for (const operation of rollbackPlan.rollback_operations) {
      try {
        if (operation.action === 'remove_state_fields') {
          // Find the item and remove state fields
          const item = findItem(relationshipManager, operation.item_id);
          if (item) {
            const updates = {
              state: undefined,
              state_metadata: undefined,
              status: operation.original_status,
              updated_date: new Date().toISOString()
            };
            
            parser.updateFile(item.file_path, updates);
            successCount++;
            
            if (options.verbose) {
              console.log(Formatter.success(`✓ ${operation.item_id}: removed state fields`));
            }
          }
        }
      } catch (error) {
        failureCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.log(Formatter.error(`✗ ${operation.item_id}: ${errorMsg}`));
      }
    }

    // Refresh cache
    relationshipManager.rebuildCache();

    console.log('');
    console.log(Formatter.info('Rollback Results:'));
    console.log(`  Successful: ${successCount}`);
    console.log(`  Failed: ${failureCount}`);
    console.log(`  Total: ${rollbackPlan.rollback_summary.total_operations}`);

    if (failureCount > 0) {
      console.log('');
      console.log(Formatter.warning('Some rollback operations failed.'));
      process.exit(1);
    } else {
      console.log('');
      console.log(Formatter.success('Rollback completed successfully!'));
    }

  } catch (error) {
    console.error(
      Formatter.error(
        `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
    process.exit(1);
  }
}

async function showMigrationStatus(options: { type?: string; format?: string }): Promise<void> {
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

    const preview = StateMigration.previewMigration(items);
    
    if (options.format === 'json') {
      const status = {
        total_items: preview.total_items,
        needs_migration: preview.needs_migration,
        already_migrated: preview.already_migrated,
        migration_percentage: (preview.already_migrated / preview.total_items * 100).toFixed(1),
        items: preview.migration_preview
      };
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    // Table format
    console.log(Formatter.info('Migration Status:'));
    console.log(`  Total items: ${preview.total_items}`);
    console.log(`  Already migrated: ${preview.already_migrated}`);
    console.log(`  Needs migration: ${preview.needs_migration}`);
    
    if (preview.total_items > 0) {
      const percentage = (preview.already_migrated / preview.total_items * 100).toFixed(1);
      console.log(`  Migration progress: ${percentage}%`);
    }

    if (preview.needs_migration > 0) {
      console.log('');
      console.log(Formatter.warning('Items needing migration:'));
      preview.migration_preview
        .filter(item => item.needs_migration)
        .slice(0, 10)
        .forEach(item => {
          console.log(`  ${item.item_id} (${item.item_type}): ${item.current_status} → ${item.target_state}`);
        });
      
      if (preview.needs_migration > 10) {
        console.log(`  ... and ${preview.needs_migration - 10} more`);
      }
    } else {
      console.log('');
      console.log(Formatter.success('All items are migrated!'));
    }

  } catch (error) {
    console.error(
      Formatter.error(
        `Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
    process.exit(1);
  }
}

// Helper functions
function showMigrationPreview(preview: any, verbose?: boolean): void {
  console.log('');
  console.log(Formatter.info('Migration Preview:'));
  
  const needsMigration = preview.migration_preview.filter((item: any) => item.needs_migration);
  const alreadyMigrated = preview.migration_preview.filter((item: any) => !item.needs_migration);

  if (needsMigration.length > 0) {
    console.log('');
    console.log(Formatter.warning('Items that will be migrated:'));
    needsMigration.slice(0, verbose ? needsMigration.length : 10).forEach((item: any) => {
      console.log(`  ${item.item_id} (${item.item_type}): ${item.current_status} → ${item.target_state}`);
    });
    
    if (!verbose && needsMigration.length > 10) {
      console.log(`  ... and ${needsMigration.length - 10} more`);
    }
  }

  if (alreadyMigrated.length > 0 && verbose) {
    console.log('');
    console.log(Formatter.success('Items already migrated:'));
    alreadyMigrated.slice(0, 10).forEach((item: any) => {
      console.log(`  ${item.item_id} (${item.item_type}): already has state field`);
    });
    
    if (alreadyMigrated.length > 10) {
      console.log(`  ... and ${alreadyMigrated.length - 10} more`);
    }
  }
}

async function createBackups(items: AnyItemData[]): Promise<void> {
  const backupDir = `migration-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  require('fs').mkdirSync(backupDir, { recursive: true });
  
  for (const item of items) {
    const content = require('fs').readFileSync(item.file_path, 'utf8');
    const backupPath = `${backupDir}/${getItemId(item)}.md`;
    require('fs').writeFileSync(backupPath, content);
  }
  
  console.log(Formatter.info(`Backup created in: ${backupDir}`));
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

function getItemId(item: AnyItemData): string {
  if ('project_id' in item && 'type' in item) return item.project_id;
  if ('epic_id' in item) return item.epic_id;
  if ('issue_id' in item && 'pr_id' in item) return item.pr_id;
  if ('issue_id' in item && 'task_id' in item) return item.task_id;
  if ('issue_id' in item) return item.issue_id;
  throw new Error('Unknown item type');
}