/**
 * Example usage of the unified state management system
 * Demonstrates migration, state transitions, and validation
 */

import {
  StateManager,
  UnifiedState,
  ItemStatus,
  IssueData,
  TaskData,
  StateMetadata,
  ValidationResult
} from '../types/ai-trackdown.js';
import { StateMigration, StateTransition } from '../utils/state-migration.js';

// Example: Working with legacy items that need migration
async function exampleMigrationWorkflow() {
  console.log('=== State Migration Example ===');

  // Legacy issue that only has status field
  const legacyIssue: IssueData = {
    issue_id: 'ISS-0001',
    title: 'Legacy Issue Example',
    description: 'An issue created before state management',
    status: 'completed', // Legacy status field
    priority: 'high',
    assignee: 'dev-team',
    created_date: '2025-01-01T00:00:00Z',
    updated_date: '2025-01-01T00:00:00Z',
    estimated_tokens: 200,
    actual_tokens: 180,
    ai_context: ['bug-fix', 'frontend'],
    sync_status: 'local',
    related_tasks: ['TSK-0001', 'TSK-0002'],
    content: 'Issue content here',
    file_path: '/tasks/issues/ISS-0001-legacy-issue.md'
  };

  // Check if migration is needed
  const needsMigration = StateMigration.needsMigration(legacyIssue);
  console.log(`Issue needs migration: ${needsMigration}`);

  // Migrate the item
  const migrationResult = StateMigration.migrateItem(legacyIssue, 'migration-bot');
  
  if (migrationResult.success) {
    console.log('Migration successful!');
    console.log(`Original status: ${legacyIssue.status}`);
    console.log(`New state: ${migrationResult.item.state}`);
    console.log(`Migration metadata:`, migrationResult.item.state_metadata);
  }

  return migrationResult.item;
}

// Example: State transitions in a development workflow
async function exampleWorkflowTransitions() {
  console.log('\n=== Workflow Transition Example ===');

  // Start with a task ready for QA
  const task: TaskData = {
    task_id: 'TSK-0001',
    issue_id: 'ISS-0001',
    title: 'Implement user authentication',
    description: 'Add login/logout functionality',
    status: 'active', // Keep for backward compatibility
    state: 'ready_for_qa',
    state_metadata: {
      transitioned_at: '2025-01-14T10:00:00Z',
      transitioned_by: 'developer',
      previous_state: 'active',
      automation_eligible: true,
      transition_reason: 'Development completed'
    },
    priority: 'high',
    assignee: 'qa-team',
    created_date: '2025-01-10T00:00:00Z',
    updated_date: '2025-01-14T10:00:00Z',
    estimated_tokens: 150,
    actual_tokens: 140,
    ai_context: ['authentication', 'security'],
    sync_status: 'local',
    content: 'Task implementation details',
    file_path: '/tasks/tasks/TSK-0001-authentication.md'
  };

  console.log(`Current state: ${StateManager.getEffectiveState(task)}`);

  // Get available transitions
  const availableTransitions = StateTransition.getAvailableTransitions(task);
  console.log('Available transitions:', availableTransitions);

  // QA passes - transition to ready for deployment
  const deploymentTransition = StateTransition.transitionState(
    task,
    'ready_for_deployment',
    'qa-engineer',
    'All tests passed successfully',
    'senior-qa-lead'
  );

  if (deploymentTransition.success) {
    console.log('✅ QA completed - ready for deployment');
    console.log('Transition warnings:', deploymentTransition.warnings);
    
    const updatedTask = deploymentTransition.item;
    console.log(`New state: ${updatedTask.state}`);
    console.log(`Previous state: ${updatedTask.state_metadata?.previous_state}`);
    console.log(`Reviewed by: ${updatedTask.state_metadata?.reviewer}`);
  }

  // Deploy to production - final state
  const completionTransition = StateTransition.transitionState(
    deploymentTransition.item,
    'done',
    'devops-engineer',
    'Successfully deployed to production'
  );

  if (completionTransition.success) {
    console.log('🚀 Deployed to production - task complete');
    return completionTransition.item;
  }

  return task;
}

// Example: Validation and error handling
async function exampleValidationScenarios() {
  console.log('\n=== Validation Example ===');

  const issue: IssueData = {
    issue_id: 'ISS-0002',
    title: 'Feature Request',
    description: 'Add dark mode support',
    status: 'planning',
    state: 'planning',
    state_metadata: {
      transitioned_at: '2025-01-14T09:00:00Z',
      transitioned_by: 'product-manager',
      automation_eligible: false
    },
    priority: 'medium',
    assignee: 'frontend-team',
    created_date: '2025-01-14T09:00:00Z',
    updated_date: '2025-01-14T09:00:00Z',
    estimated_tokens: 300,
    actual_tokens: 0,
    ai_context: ['ui', 'theming'],
    sync_status: 'local',
    related_tasks: [],
    content: 'Feature requirements and design specs',
    file_path: '/tasks/issues/ISS-0002-dark-mode.md'
  };

  // Try valid transition
  const validTransition = StateManager.validateTransition('planning', 'ready_for_engineering');
  console.log('Valid transition result:', {
    valid: validTransition.valid,
    warnings: validTransition.warnings
  });

  // Try invalid transition
  const invalidTransition = StateManager.validateTransition('planning', 'done');
  console.log('Invalid transition result:', {
    valid: invalidTransition.valid,
    errors: invalidTransition.errors,
    allowed: invalidTransition.allowed_transitions
  });

  // Validate state metadata
  const incompleteMetadata: StateMetadata = {
    transitioned_at: '',
    transitioned_by: '',
    automation_eligible: true
  };

  const metadataValidation = StateManager.validateStateMetadata(incompleteMetadata);
  console.log('Metadata validation:', {
    valid: metadataValidation.valid,
    errors: metadataValidation.errors.map(e => e.message)
  });
}

// Example: Batch migration with preview and rollback
async function exampleBatchMigration() {
  console.log('\n=== Batch Migration Example ===');

  // Create sample legacy items
  const legacyItems: IssueData[] = [
    {
      issue_id: 'ISS-0003',
      title: 'Legacy Issue 1',
      description: 'First legacy issue',
      status: 'active',
      priority: 'medium',
      assignee: 'developer-1',
      created_date: '2025-01-01T00:00:00Z',
      updated_date: '2025-01-01T00:00:00Z',
      estimated_tokens: 100,
      actual_tokens: 50,
      ai_context: [],
      sync_status: 'local',
      related_tasks: [],
      content: 'Legacy issue content',
      file_path: '/tasks/issues/ISS-0003-legacy-1.md'
    },
    {
      issue_id: 'ISS-0004',
      title: 'Legacy Issue 2', 
      description: 'Second legacy issue',
      status: 'completed',
      priority: 'low',
      assignee: 'developer-2',
      created_date: '2025-01-02T00:00:00Z',
      updated_date: '2025-01-05T00:00:00Z',
      estimated_tokens: 80,
      actual_tokens: 85,
      ai_context: [],
      sync_status: 'local',
      related_tasks: [],
      content: 'Another legacy issue',
      file_path: '/tasks/issues/ISS-0004-legacy-2.md'
    }
  ];

  // Preview migration
  const preview = StateMigration.previewMigration(legacyItems);
  console.log('Migration preview:', {
    totalItems: preview.total_items,
    needsMigration: preview.needs_migration,
    alreadyMigrated: preview.already_migrated
  });

  console.log('Preview details:');
  preview.migration_preview.forEach(item => {
    console.log(`  ${item.item_id}: ${item.current_status} → ${item.target_state} (needs migration: ${item.needs_migration})`);
  });

  // Perform migration
  const migrationResult = StateMigration.migrateItems(legacyItems, 'batch-migration-tool');
  console.log('\nMigration result:', {
    success: migrationResult.success,
    migrated: migrationResult.migrated_count,
    failed: migrationResult.failed_count,
    errors: migrationResult.errors
  });

  // Create rollback plan
  const rollbackPlan = StateMigration.createRollbackPlan(migrationResult.migration_log);
  console.log('\nRollback plan:', rollbackPlan.rollback_summary);

  // Validate migration
  const validation = StateMigration.validateMigration(legacyItems);
  console.log('\nValidation result:', {
    valid: validation.valid,
    errorCount: validation.errors.length,
    warningCount: validation.warnings.length
  });
}

// Example: Automation eligibility checking
async function exampleAutomationWorkflow() {
  console.log('\n=== Automation Example ===');

  const automatedTask: TaskData = {
    task_id: 'TSK-0002',
    issue_id: 'ISS-0001',
    title: 'Automated Task',
    description: 'Task managed by automation',
    status: 'active',
    state: 'ready_for_engineering',
    state_metadata: {
      transitioned_at: '2025-01-14T12:00:00Z',
      transitioned_by: 'automation-bot',
      automation_eligible: true,
      automation_source: 'ci-pipeline',
      transition_reason: 'All prerequisites completed'
    },
    priority: 'medium',
    assignee: 'engineering-team',
    created_date: '2025-01-14T00:00:00Z',
    updated_date: '2025-01-14T12:00:00Z',
    estimated_tokens: 120,
    actual_tokens: 0,
    ai_context: ['automation', 'testing'],
    sync_status: 'local',
    content: 'Automated task content',
    file_path: '/tasks/tasks/TSK-0002-automated.md'
  };

  // Check if transitions can be automated
  const canAutoQA = StateTransition.canAutomate(automatedTask, 'ready_for_qa');
  const canAutoDeployment = StateTransition.canAutomate(automatedTask, 'ready_for_deployment');
  
  console.log('Automation eligibility:');
  console.log(`  Engineering → QA: ${canAutoQA ? '✅ Can automate' : '❌ Manual required'}`);
  
  if (canAutoQA) {
    // Automated transition to QA
    const qaTransition = StateTransition.transitionState(
      automatedTask,
      'ready_for_qa',
      'automation-bot',
      'Code review passed, tests green',
      undefined, // No human reviewer needed
      'automation'
    );

    if (qaTransition.success) {
      console.log('🤖 Automated transition to QA completed');
      
      // Check next automation possibility
      const canAutoFromQA = StateTransition.canAutomate(qaTransition.item, 'ready_for_deployment');
      console.log(`  QA → Deployment: ${canAutoFromQA ? '✅ Can automate' : '❌ Manual required'}`);
    }
  }
}

// Example: State-based analytics
async function exampleStateAnalytics() {
  console.log('\n=== State Analytics Example ===');

  // Sample items in different states
  const projectItems = [
    { state: 'planning' as UnifiedState, type: 'issue' },
    { state: 'active' as UnifiedState, type: 'task' },
    { state: 'ready_for_engineering' as UnifiedState, type: 'issue' },
    { state: 'ready_for_qa' as UnifiedState, type: 'task' },
    { state: 'ready_for_deployment' as UnifiedState, type: 'task' },
    { state: 'done' as UnifiedState, type: 'issue' },
    { state: 'won_t_do' as UnifiedState, type: 'task' }
  ];

  // Calculate state distribution
  const stateDistribution = projectItems.reduce((acc, item) => {
    acc[item.state] = (acc[item.state] || 0) + 1;
    return acc;
  }, {} as Record<UnifiedState, number>);

  console.log('State distribution:', stateDistribution);

  // Resolution states analysis
  const resolutionStates = projectItems.filter(item => 
    StateManager.isResolutionState(item.state)
  );

  console.log(`Resolution states: ${resolutionStates.length}/${projectItems.length} items`);

  // Calculate workflow efficiency
  const workflowStages = {
    planning: stateDistribution['planning'] || 0,
    in_progress: (stateDistribution['active'] || 0) + (stateDistribution['ready_for_engineering'] || 0),
    in_review: (stateDistribution['ready_for_qa'] || 0) + (stateDistribution['ready_for_deployment'] || 0),
    completed: (stateDistribution['done'] || 0) + (stateDistribution['won_t_do'] || 0)
  };

  console.log('Workflow stage analysis:', workflowStages);
  
  const totalActive = workflowStages.planning + workflowStages.in_progress + workflowStages.in_review;
  const completionRate = workflowStages.completed / (totalActive + workflowStages.completed);
  
  console.log(`Completion rate: ${(completionRate * 100).toFixed(1)}%`);
}

// Run all examples
async function runExamples() {
  console.log('🔄 AI-Trackdown State Management Examples\n');
  
  try {
    await exampleMigrationWorkflow();
    await exampleWorkflowTransitions();
    await exampleValidationScenarios();
    await exampleBatchMigration();
    await exampleAutomationWorkflow();
    await exampleStateAnalytics();
    
    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// Export for use in other modules
export {
  exampleMigrationWorkflow,
  exampleWorkflowTransitions,
  exampleValidationScenarios,
  exampleBatchMigration,
  exampleAutomationWorkflow,
  exampleStateAnalytics,
  runExamples
};

// Run examples if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples();
}