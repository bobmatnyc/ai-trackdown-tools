/**
 * State Migration Utilities
 * Handles migration from legacy status field to unified state field
 */

import {
  AnyItemData,
  BaseFrontmatter,
  ItemStatus,
  UnifiedState,
  StateMetadata,
  MigrationResult,
  MigrationLogEntry,
  ItemType,
  StateManager
} from '../types/ai-trackdown.js';

export class StateMigration {
  /**
   * Migrates a single item from legacy status to unified state
   */
  static migrateItem(
    item: AnyItemData,
    migrated_by: string = 'system'
  ): { item: AnyItemData; success: boolean; error?: string } {
    try {
      // If item already has state field, no migration needed
      if (item.state && item.state_metadata) {
        return { item, success: true };
      }

      // Create new state based on legacy status
      const new_state = StateManager.migrateStatusToState(item.status);
      
      // Create state metadata
      const state_metadata: StateMetadata = {
        transitioned_at: new Date().toISOString(),
        transitioned_by: migrated_by,
        previous_state: undefined, // No previous state for migration
        automation_eligible: false, // Migration is manual
        transition_reason: 'Legacy status migration',
        automation_source: undefined
      };

      // Update item with new fields
      const migrated_item: AnyItemData = {
        ...item,
        state: new_state,
        state_metadata,
        // Keep status field for backward compatibility
        status: item.status
      };

      return { item: migrated_item, success: true };
    } catch (error) {
      return {
        item,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown migration error'
      };
    }
  }

  /**
   * Migrates multiple items with detailed logging
   */
  static migrateItems(
    items: AnyItemData[],
    migrated_by: string = 'system'
  ): MigrationResult {
    const migration_log: MigrationLogEntry[] = [];
    const migrated_items: AnyItemData[] = [];
    let migrated_count = 0;
    let failed_count = 0;
    const errors: string[] = [];

    for (const item of items) {
      const result = this.migrateItem(item, migrated_by);
      
      const log_entry: MigrationLogEntry = {
        item_id: this.getItemId(item),
        item_type: this.getItemType(item),
        old_status: item.status,
        new_state: result.success ? result.item.state! : item.status as UnifiedState,
        timestamp: new Date().toISOString(),
        success: result.success,
        error: result.error
      };

      migration_log.push(log_entry);

      if (result.success) {
        migrated_items.push(result.item);
        migrated_count++;
      } else {
        migrated_items.push(item); // Keep original on failure
        failed_count++;
        if (result.error) {
          errors.push(`${log_entry.item_id}: ${result.error}`);
        }
      }
    }

    return {
      success: failed_count === 0,
      migrated_count,
      failed_count,
      errors,
      migration_log
    };
  }

  /**
   * Validates if migration is needed for an item
   */
  static needsMigration(item: BaseFrontmatter): boolean {
    // Migration needed if no state field or no state metadata
    return !item.state || !item.state_metadata;
  }

  /**
   * Creates a migration preview without modifying items
   */
  static previewMigration(items: AnyItemData[]): {
    total_items: number;
    needs_migration: number;
    already_migrated: number;
    migration_preview: Array<{
      item_id: string;
      item_type: ItemType;
      current_status: ItemStatus;
      target_state: UnifiedState;
      needs_migration: boolean;
    }>;
  } {
    let needs_migration = 0;
    let already_migrated = 0;

    const migration_preview = items.map(item => {
      const needs_mig = this.needsMigration(item);
      if (needs_mig) {
        needs_migration++;
      } else {
        already_migrated++;
      }

      return {
        item_id: this.getItemId(item),
        item_type: this.getItemType(item),
        current_status: item.status,
        target_state: StateManager.migrateStatusToState(item.status),
        needs_migration: needs_mig
      };
    });

    return {
      total_items: items.length,
      needs_migration,
      already_migrated,
      migration_preview
    };
  }

  /**
   * Validates migration results
   */
  static validateMigration(items: AnyItemData[]): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    validation_details: Array<{
      item_id: string;
      has_state: boolean;
      has_metadata: boolean;
      metadata_valid: boolean;
      backward_compatible: boolean;
    }>;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validation_details = [];

    for (const item of items) {
      const has_state = !!item.state;
      const has_metadata = !!item.state_metadata;
      const backward_compatible = !!item.status; // Legacy field preserved

      let metadata_valid = true;
      if (has_metadata && item.state_metadata) {
        const validation = StateManager.validateStateMetadata(item.state_metadata);
        metadata_valid = validation.valid;
        
        if (!metadata_valid) {
          errors.push(...validation.errors.map(e => 
            `${this.getItemId(item)}: ${e.message}`
          ));
        }
        
        warnings.push(...validation.warnings.map(w => 
          `${this.getItemId(item)}: ${w.message}`
        ));
      }

      validation_details.push({
        item_id: this.getItemId(item),
        has_state,
        has_metadata,
        metadata_valid,
        backward_compatible
      });

      if (!has_state) {
        errors.push(`${this.getItemId(item)}: Missing state field`);
      }

      if (!has_metadata) {
        errors.push(`${this.getItemId(item)}: Missing state metadata`);
      }

      if (!backward_compatible) {
        warnings.push(`${this.getItemId(item)}: Legacy status field missing (backward compatibility affected)`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      validation_details
    };
  }

  /**
   * Creates a rollback plan for migration
   */
  static createRollbackPlan(migration_log: MigrationLogEntry[]): {
    rollback_operations: Array<{
      item_id: string;
      action: 'remove_state_fields' | 'restore_status' | 'no_action';
      original_status: ItemStatus;
    }>;
    rollback_summary: {
      total_operations: number;
      remove_state_fields: number;
      restore_status: number;
      no_action: number;
    };
  } {
    const rollback_operations = migration_log.map(entry => {
      let action: 'remove_state_fields' | 'restore_status' | 'no_action' = 'no_action';

      if (entry.success) {
        // Successfully migrated - need to remove state fields
        action = 'remove_state_fields';
      } else {
        // Failed migration - restore original status if needed
        action = 'restore_status';
      }

      return {
        item_id: entry.item_id,
        action,
        original_status: entry.old_status
      };
    });

    const rollback_summary = {
      total_operations: rollback_operations.length,
      remove_state_fields: rollback_operations.filter(op => op.action === 'remove_state_fields').length,
      restore_status: rollback_operations.filter(op => op.action === 'restore_status').length,
      no_action: rollback_operations.filter(op => op.action === 'no_action').length
    };

    return {
      rollback_operations,
      rollback_summary
    };
  }

  // Helper methods for item identification
  private static getItemId(item: AnyItemData): string {
    if ('project_id' in item) return item.project_id;
    if ('epic_id' in item) return item.epic_id;
    if ('issue_id' in item) return item.issue_id;
    if ('task_id' in item) return item.task_id;
    if ('pr_id' in item) return item.pr_id;
    throw new Error('Unknown item type - no valid ID field found');
  }

  private static getItemType(item: AnyItemData): ItemType {
    if ('project_id' in item && 'type' in item) return 'project';
    if ('epic_id' in item) return 'epic';
    if ('issue_id' in item && 'pr_id' in item) return 'pr';
    if ('issue_id' in item && 'task_id' in item) return 'task';
    if ('issue_id' in item) return 'issue';
    throw new Error('Unknown item type');
  }
}

/**
 * State transition utilities for workflow management
 */
export class StateTransition {
  /**
   * Performs a state transition with validation
   */
  static transitionState(
    item: AnyItemData,
    to_state: UnifiedState,
    transitioned_by: string,
    transition_reason?: string,
    reviewer?: string,
    user_role?: string
  ): { item: AnyItemData; success: boolean; errors: string[]; warnings: string[] } {
    const current_state = StateManager.getEffectiveState(item);
    
    // Validate transition
    const validation = StateManager.validateTransition(current_state, to_state, user_role);
    
    if (!validation.valid) {
      return {
        item,
        success: false,
        errors: validation.errors,
        warnings: validation.warnings
      };
    }

    // Create new state metadata
    const state_metadata = StateManager.createStateMetadata(
      transitioned_by,
      current_state,
      validation.warnings.length === 0, // automation_eligible if no warnings
      undefined, // automation_source
      transition_reason,
      reviewer
    );

    // Update item
    const updated_item: AnyItemData = {
      ...item,
      state: to_state,
      state_metadata,
      updated_date: new Date().toISOString()
    };

    return {
      item: updated_item,
      success: true,
      errors: [],
      warnings: validation.warnings
    };
  }

  /**
   * Gets available transitions for an item
   */
  static getAvailableTransitions(item: AnyItemData, user_role?: string): UnifiedState[] {
    const current_state = StateManager.getEffectiveState(item);
    const all_transitions = StateManager.getAllowedTransitions(current_state);
    
    // Filter by user role if specified
    if (user_role) {
      return all_transitions.filter(to_state => {
        const validation = StateManager.validateTransition(current_state, to_state, user_role);
        return validation.valid;
      });
    }
    
    return all_transitions;
  }

  /**
   * Checks if an item can be automated
   */
  static canAutomate(item: AnyItemData, to_state: UnifiedState): boolean {
    const current_state = StateManager.getEffectiveState(item);
    const validation = StateManager.validateTransition(current_state, to_state);
    
    return validation.valid && validation.warnings.length === 0;
  }
}