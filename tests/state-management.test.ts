/**
 * Unit tests for state management functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StateManager,
  UnifiedState,
  ItemStatus,
  ResolutionState,
  StateMetadata,
  IssueData,
  TaskData
} from '../src/types/ai-trackdown.js';
import { StateMigration, StateTransition } from '../src/utils/state-migration.js';

describe('StateManager', () => {
  describe('State validation', () => {
    it('should validate allowed transitions', () => {
      const result = StateManager.validateTransition('planning', 'ready_for_engineering');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid transitions', () => {
      const result = StateManager.validateTransition('planning', 'done');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid transition from planning to done');
    });

    it('should provide allowed transitions', () => {
      const transitions = StateManager.getAllowedTransitions('ready_for_qa');
      expect(transitions).toContain('ready_for_deployment');
      expect(transitions).toContain('active');
      expect(transitions).toContain('ready_for_engineering');
      expect(transitions).toContain('won_t_do');
    });

    it('should validate role-based transitions when role is required', () => {
      // Assuming we add role requirements to some transitions
      const result = StateManager.validateTransition('ready_for_qa', 'ready_for_deployment');
      expect(result.valid).toBe(true); // No role requirement in current implementation
    });
  });

  describe('State identification', () => {
    it('should identify resolution states', () => {
      expect(StateManager.isResolutionState('ready_for_engineering')).toBe(true);
      expect(StateManager.isResolutionState('ready_for_qa')).toBe(true);
      expect(StateManager.isResolutionState('ready_for_deployment')).toBe(true);
      expect(StateManager.isResolutionState('won_t_do')).toBe(true);
      expect(StateManager.isResolutionState('done')).toBe(true);
      expect(StateManager.isResolutionState('planning')).toBe(false);
    });

    it('should identify legacy statuses', () => {
      expect(StateManager.isLegacyStatus('planning')).toBe(true);
      expect(StateManager.isLegacyStatus('active')).toBe(true);
      expect(StateManager.isLegacyStatus('completed')).toBe(true);
      expect(StateManager.isLegacyStatus('archived')).toBe(true);
      expect(StateManager.isLegacyStatus('ready_for_engineering')).toBe(false);
    });
  });

  describe('Migration mapping', () => {
    it('should migrate legacy status to unified state', () => {
      expect(StateManager.migrateStatusToState('planning')).toBe('planning');
      expect(StateManager.migrateStatusToState('active')).toBe('active');
      expect(StateManager.migrateStatusToState('completed')).toBe('done');
      expect(StateManager.migrateStatusToState('archived')).toBe('archived');
    });

    it('should get effective state from items', () => {
      const legacyItem: Partial<IssueData> = {
        status: 'active'
      };

      const modernItem: Partial<IssueData> = {
        status: 'active',
        state: 'ready_for_qa'
      };

      expect(StateManager.getEffectiveState(legacyItem as any)).toBe('active');
      expect(StateManager.getEffectiveState(modernItem as any)).toBe('ready_for_qa');
    });
  });

  describe('State metadata creation', () => {
    it('should create valid state metadata', () => {
      const metadata = StateManager.createStateMetadata(
        'test-user',
        'planning',
        true,
        'automation-bot',
        'Automated transition',
        'reviewer'
      );

      expect(metadata.transitioned_by).toBe('test-user');
      expect(metadata.previous_state).toBe('planning');
      expect(metadata.automation_eligible).toBe(true);
      expect(metadata.automation_source).toBe('automation-bot');
      expect(metadata.transition_reason).toBe('Automated transition');
      expect(metadata.reviewer).toBe('reviewer');
      expect(metadata.transitioned_at).toBeDefined();
    });

    it('should validate state metadata', () => {
      const validMetadata: StateMetadata = {
        transitioned_at: new Date().toISOString(),
        transitioned_by: 'test-user',
        automation_eligible: false
      };

      const invalidMetadata: StateMetadata = {
        transitioned_at: '',
        transitioned_by: '',
        automation_eligible: true
      };

      const validResult = StateManager.validateStateMetadata(validMetadata);
      expect(validResult.valid).toBe(true);

      const invalidResult = StateManager.validateStateMetadata(invalidMetadata);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.some(e => e.field === 'transitioned_at')).toBe(true);
      expect(invalidResult.errors.some(e => e.field === 'transitioned_by')).toBe(true);
    });
  });
});

describe('StateMigration', () => {
  const sampleIssue: IssueData = {
    issue_id: 'issue-1',
    title: 'Test Issue',
    description: 'Test description',
    status: 'active',
    priority: 'medium',
    assignee: 'test-user',
    created_date: '2025-01-01T00:00:00Z',
    updated_date: '2025-01-01T00:00:00Z',
    estimated_tokens: 100,
    actual_tokens: 0,
    ai_context: [],
    sync_status: 'local',
    related_tasks: [],
    content: 'Test content',
    file_path: '/test/issue.md'
  };

  const modernIssue: IssueData = {
    ...sampleIssue,
    state: 'ready_for_qa',
    state_metadata: {
      transitioned_at: '2025-01-01T12:00:00Z',
      transitioned_by: 'test-user',
      automation_eligible: true
    }
  };

  describe('Migration detection', () => {
    it('should detect items needing migration', () => {
      expect(StateMigration.needsMigration(sampleIssue)).toBe(true);
      expect(StateMigration.needsMigration(modernIssue)).toBe(false);
    });
  });

  describe('Single item migration', () => {
    it('should migrate a legacy item successfully', () => {
      const result = StateMigration.migrateItem(sampleIssue, 'migration-tool');
      
      expect(result.success).toBe(true);
      expect(result.item.state).toBe('active'); // Maps from status 'active'
      expect(result.item.state_metadata).toBeDefined();
      expect(result.item.state_metadata?.transitioned_by).toBe('migration-tool');
      expect(result.item.status).toBe('active'); // Preserved for backward compatibility
    });

    it('should skip migration for already migrated items', () => {
      const result = StateMigration.migrateItem(modernIssue, 'migration-tool');
      
      expect(result.success).toBe(true);
      expect(result.item).toEqual(modernIssue); // Unchanged
    });
  });

  describe('Batch migration', () => {
    it('should migrate multiple items', () => {
      const items = [sampleIssue, modernIssue];
      const result = StateMigration.migrateItems(items, 'batch-migration');

      expect(result.success).toBe(true);
      expect(result.migrated_count).toBe(2); // Both items processed (one migrated, one already had state)
      expect(result.failed_count).toBe(0);
      expect(result.migration_log).toHaveLength(2);
    });

    it('should create migration preview', () => {
      const items = [sampleIssue, modernIssue];
      const preview = StateMigration.previewMigration(items);

      expect(preview.total_items).toBe(2);
      expect(preview.needs_migration).toBe(1);
      expect(preview.already_migrated).toBe(1);
      expect(preview.migration_preview).toHaveLength(2);
    });
  });

  describe('Migration validation', () => {
    it('should validate successful migration', () => {
      const migratedItem = StateMigration.migrateItem(sampleIssue).item;
      const validation = StateMigration.validateMigration([migratedItem]);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.validation_details[0]).toMatchObject({
        has_state: true,
        has_metadata: true,
        metadata_valid: true,
        backward_compatible: true
      });
    });

    it('should detect validation errors', () => {
      const invalidItem = { ...sampleIssue, state: 'ready_for_qa' as UnifiedState };
      delete (invalidItem as any).state_metadata;

      const validation = StateMigration.validateMigration([invalidItem]);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Missing state metadata'))).toBe(true);
    });
  });

  describe('Rollback planning', () => {
    it('should create rollback plan', () => {
      const migrationLog = [
        {
          item_id: 'issue-1',
          item_type: 'issue' as const,
          old_status: 'active' as ItemStatus,
          new_state: 'active' as UnifiedState,
          timestamp: '2025-01-01T00:00:00Z',
          success: true
        }
      ];

      const rollbackPlan = StateMigration.createRollbackPlan(migrationLog);

      expect(rollbackPlan.rollback_operations).toHaveLength(1);
      expect(rollbackPlan.rollback_operations[0].action).toBe('remove_state_fields');
      expect(rollbackPlan.rollback_summary.remove_state_fields).toBe(1);
    });
  });
});

describe('StateTransition', () => {
  const sampleTask: TaskData = {
    task_id: 'task-1',
    issue_id: 'issue-1',
    title: 'Test Task',
    description: 'Test description',
    status: 'active',
    state: 'ready_for_qa',
    state_metadata: {
      transitioned_at: '2025-01-01T00:00:00Z',
      transitioned_by: 'test-user',
      automation_eligible: true
    },
    priority: 'medium',
    assignee: 'test-user',
    created_date: '2025-01-01T00:00:00Z',
    updated_date: '2025-01-01T00:00:00Z',
    estimated_tokens: 50,
    actual_tokens: 0,
    ai_context: [],
    sync_status: 'local',
    content: 'Test content',
    file_path: '/test/task.md'
  };

  describe('State transitions', () => {
    it('should perform valid state transition', () => {
      const result = StateTransition.transitionState(
        sampleTask,
        'ready_for_deployment',
        'test-user',
        'QA completed successfully'
      );

      expect(result.success).toBe(true);
      expect(result.item.state).toBe('ready_for_deployment');
      expect(result.item.state_metadata?.previous_state).toBe('ready_for_qa');
      expect(result.item.state_metadata?.transition_reason).toBe('QA completed successfully');
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid state transition', () => {
      const result = StateTransition.transitionState(
        sampleTask,
        'planning',
        'test-user'
      );

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid transition from ready_for_qa to planning'))).toBe(true);
    });

    it('should get available transitions', () => {
      const transitions = StateTransition.getAvailableTransitions(sampleTask);

      expect(transitions).toContain('ready_for_deployment');
      expect(transitions).toContain('active');
      expect(transitions).toContain('ready_for_engineering');
      expect(transitions).toContain('won_t_do');
      expect(transitions).not.toContain('planning');
    });

    it('should check automation eligibility', () => {
      expect(StateTransition.canAutomate(sampleTask, 'ready_for_deployment')).toBe(true);
      expect(StateTransition.canAutomate(sampleTask, 'active')).toBe(false); // Manual transition
    });
  });
});