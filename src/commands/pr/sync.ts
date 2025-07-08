/**
 * PR-Task Synchronization Command
 * Handles bidirectional synchronization between PRs and tasks
 */

import { Command } from 'commander';
import { PRStatusManager } from '../../utils/pr-status-manager.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { colors } from '../../utils/colors.js';
import * as fs from 'fs';
import * as path from 'path';
import type { PRData, PRStatus, TaskData, IssueData, ItemStatus } from '../../types/ai-trackdown.js';

export interface SyncOptions {
  direction: 'pr-to-task' | 'task-to-pr' | 'bidirectional';
  autoCreate: boolean;
  autoComplete: boolean;
  updateDescriptions: boolean;
  syncTimestamps: boolean;
  syncAssignees: boolean;
  dryRun: boolean;
  force: boolean;
}

export interface SyncResult {
  success: boolean;
  direction: string;
  totalPRs: number;
  totalTasks: number;
  syncedPRs: number;
  syncedTasks: number;
  createdPRs: number;
  createdTasks: number;
  updatedPRs: number;
  updatedTasks: number;
  completedTasks: number;
  errors: string[];
  warnings: string[];
  details: SyncDetail[];
}

export interface SyncDetail {
  prId: string;
  taskId: string;
  action: string;
  success: boolean;
  message: string;
  error?: string;
  changes?: string[];
}

export interface SyncMapping {
  prId: string;
  taskId: string;
  issueId: string;
  prStatus: PRStatus;
  taskStatus: ItemStatus;
  prAssignee: string;
  taskAssignee: string;
  prUpdated: string;
  taskUpdated: string;
  syncRequired: boolean;
  syncDirection: 'pr-to-task' | 'task-to-pr' | 'conflict';
  conflictReasons: string[];
}

export function createPRSyncCommand(): Command {
  const cmd = new Command('sync');
  
  cmd.description('Synchronize PR and task statuses');
  
  // Main sync command
  cmd
    .option('-d, --direction <direction>', 'Sync direction (pr-to-task|task-to-pr|bidirectional)', 'bidirectional')
    .option('--auto-create', 'Automatically create missing PRs or tasks', false)
    .option('--auto-complete', 'Automatically complete tasks when PRs are merged', false)
    .option('--update-descriptions', 'Update descriptions during sync', false)
    .option('--sync-timestamps', 'Sync timestamps between PRs and tasks', false)
    .option('--sync-assignees', 'Sync assignees between PRs and tasks', false)
    .option('--force', 'Force sync even when conflicts exist', false)
    .option('--dry-run', 'Show what would be synced without executing', false)
    .action(async (options: any) => {
      const configManager = new ConfigManager();
      const statusManager = new PRStatusManager(configManager);
      const relationshipManager = new RelationshipManager(configManager);
      const formatter = new Formatter();
      
      const syncOptions: SyncOptions = {
        direction: options.direction,
        autoCreate: options.autoCreate,
        autoComplete: options.autoComplete,
        updateDescriptions: options.updateDescriptions,
        syncTimestamps: options.syncTimestamps,
        syncAssignees: options.syncAssignees,
        dryRun: options.dryRun,
        force: options.force
      };
      
      try {
        const result = await performSync(
          syncOptions,
          statusManager,
          relationshipManager,
          configManager
        );
        
        if (options.dryRun) {
          console.log(colors.yellow('🔍 Sync dry run - showing what would be done:'));
          console.log('');
        }
        
        displaySyncResult(result);
        
        if (!result.success) {
          process.exit(1);
        }
        
      } catch (error) {
        console.error(colors.red(`❌ Sync failed: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
  
  // Status mapping command
  cmd.command('status')
    .description('Show current sync status between PRs and tasks')
    .option('-f, --format <format>', 'Output format (table|json)', 'table')
    .option('--conflicts-only', 'Show only conflicts', false)
    .action(async (options: any) => {
      const configManager = new ConfigManager();
      const statusManager = new PRStatusManager(configManager);
      const relationshipManager = new RelationshipManager(configManager);
      const formatter = new Formatter();
      
      try {
        const mappings = await getSyncMappings(statusManager, relationshipManager, configManager);
        
        if (options.conflictsOnly) {
          const conflicts = mappings.filter(m => m.syncDirection === 'conflict');
          displaySyncMappings(conflicts, options.format, formatter);
        } else {
          displaySyncMappings(mappings, options.format, formatter);
        }
        
      } catch (error) {
        console.error(colors.red(`❌ Error getting sync status: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
  
  // Force sync specific PR-task pair
  cmd.command('force')
    .description('Force synchronization of a specific PR-task pair')
    .argument('<pr-id>', 'PR ID')
    .argument('<task-id>', 'Task ID')
    .option('-d, --direction <direction>', 'Sync direction (pr-to-task|task-to-pr)', 'pr-to-task')
    .action(async (prId: string, taskId: string, options: any) => {
      const configManager = new ConfigManager();
      const statusManager = new PRStatusManager(configManager);
      const relationshipManager = new RelationshipManager(configManager);
      
      try {
        const result = await forceSyncPRTask(
          prId,
          taskId,
          options.direction,
          statusManager,
          relationshipManager,
          configManager
        );
        
        if (result.success) {
          console.log(colors.green(`✅ Successfully synced ${prId} ↔ ${taskId}`));
          console.log(`📋 Direction: ${options.direction}`);
          if (result.changes && result.changes.length > 0) {
            console.log('📝 Changes:');
            result.changes.forEach(change => console.log(`  - ${change}`));
          }
        } else {
          console.error(colors.red(`❌ Failed to sync ${prId} ↔ ${taskId}`));
          if (result.error) {
            console.error(colors.red(`  Error: ${result.error}`));
          }
          process.exit(1);
        }
        
      } catch (error) {
        console.error(colors.red(`❌ Error during force sync: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
  
  return cmd;
}

async function performSync(
  options: SyncOptions,
  statusManager: PRStatusManager,
  relationshipManager: RelationshipManager,
  configManager: ConfigManager
): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    direction: options.direction,
    totalPRs: 0,
    totalTasks: 0,
    syncedPRs: 0,
    syncedTasks: 0,
    createdPRs: 0,
    createdTasks: 0,
    updatedPRs: 0,
    updatedTasks: 0,
    completedTasks: 0,
    errors: [],
    warnings: [],
    details: []
  };
  
  try {
    // Get all sync mappings
    const mappings = await getSyncMappings(statusManager, relationshipManager, configManager);
    
    result.totalPRs = new Set(mappings.map(m => m.prId)).size;
    result.totalTasks = new Set(mappings.map(m => m.taskId)).size;
    
    console.log(colors.blue(`🔄 Starting sync operation: ${options.direction}`));
    console.log(`📊 Found ${mappings.length} PR-task relationships`);
    
    // Filter mappings that need sync
    const needsSync = mappings.filter(m => m.syncRequired || options.force);
    
    if (needsSync.length === 0) {
      console.log(colors.green('✅ All PRs and tasks are already synchronized'));
      result.success = true;
      return result;
    }
    
    console.log(colors.yellow(`⚠️  ${needsSync.length} relationships need synchronization`));
    
    // Perform sync based on direction
    for (const mapping of needsSync) {
      const detail = await syncPRTask(mapping, options, statusManager, relationshipManager, configManager);
      result.details.push(detail);
      
      if (detail.success) {
        if (detail.action.includes('updated PR')) result.updatedPRs++;
        if (detail.action.includes('updated task')) result.updatedTasks++;
        if (detail.action.includes('completed task')) result.completedTasks++;
        if (detail.action.includes('created PR')) result.createdPRs++;
        if (detail.action.includes('created task')) result.createdTasks++;
      } else {
        result.errors.push(`${mapping.prId} ↔ ${mapping.taskId}: ${detail.error}`);
      }
    }
    
    result.syncedPRs = result.updatedPRs + result.createdPRs;
    result.syncedTasks = result.updatedTasks + result.createdTasks;
    result.success = result.errors.length === 0;
    
    return result;
    
  } catch (error) {
    result.errors.push(`Sync operation failed: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}

async function getSyncMappings(
  statusManager: PRStatusManager,
  relationshipManager: RelationshipManager,
  configManager: ConfigManager
): Promise<SyncMapping[]> {
  const mappings: SyncMapping[] = [];
  
  // Get all PRs
  const allPRs = await statusManager.listPRs();
  
  for (const pr of allPRs) {
    // Get linked tasks for this PR
    const linkedTasks = await relationshipManager.getLinkedTasks(pr.pr_id);
    
    for (const taskId of linkedTasks) {
      const task = await loadTaskData(taskId, configManager);
      
      if (task) {
        const mapping = createSyncMapping(pr, task);
        mappings.push(mapping);
      }
    }
  }
  
  return mappings;
}

function createSyncMapping(pr: PRData, task: TaskData): SyncMapping {
  const mapping: SyncMapping = {
    prId: pr.pr_id,
    taskId: task.task_id,
    issueId: task.issue_id,
    prStatus: pr.pr_status,
    taskStatus: task.status,
    prAssignee: pr.assignee,
    taskAssignee: task.assignee,
    prUpdated: pr.updated_date,
    taskUpdated: task.updated_date,
    syncRequired: false,
    syncDirection: 'pr-to-task',
    conflictReasons: []
  };
  
  // Determine if sync is required and direction
  const prNewer = new Date(pr.updated_date) > new Date(task.updated_date);
  const taskNewer = new Date(task.updated_date) > new Date(pr.updated_date);
  
  const statusMismatch = !isStatusSynced(pr.pr_status, task.status);
  const assigneeMismatch = pr.assignee !== task.assignee;
  
  if (statusMismatch || assigneeMismatch) {
    mapping.syncRequired = true;
    
    if (prNewer) {
      mapping.syncDirection = 'pr-to-task';
    } else if (taskNewer) {
      mapping.syncDirection = 'task-to-pr';
    } else {
      mapping.syncDirection = 'conflict';
      mapping.conflictReasons.push('Same timestamp but different status/assignee');
    }
  }
  
  // Check for conflicts
  if (statusMismatch && !canSyncStatus(pr.pr_status, task.status)) {
    mapping.syncDirection = 'conflict';
    mapping.conflictReasons.push(`Cannot sync status: ${pr.pr_status} ↔ ${task.status}`);
  }
  
  return mapping;
}

function isStatusSynced(prStatus: PRStatus, taskStatus: ItemStatus): boolean {
  const syncMap: Record<PRStatus, ItemStatus> = {
    'draft': 'planning',
    'open': 'active',
    'review': 'active',
    'approved': 'active',
    'merged': 'completed',
    'closed': 'archived'
  };
  
  return syncMap[prStatus] === taskStatus;
}

function canSyncStatus(prStatus: PRStatus, taskStatus: ItemStatus): boolean {
  // Define which status transitions are allowed
  const allowedTransitions: Record<PRStatus, ItemStatus[]> = {
    'draft': ['planning', 'active'],
    'open': ['active'],
    'review': ['active'],
    'approved': ['active', 'completed'],
    'merged': ['completed'],
    'closed': ['archived']
  };
  
  return allowedTransitions[prStatus]?.includes(taskStatus) || false;
}

async function syncPRTask(
  mapping: SyncMapping,
  options: SyncOptions,
  statusManager: PRStatusManager,
  relationshipManager: RelationshipManager,
  configManager: ConfigManager
): Promise<SyncDetail> {
  const detail: SyncDetail = {
    prId: mapping.prId,
    taskId: mapping.taskId,
    action: 'sync',
    success: false,
    message: '',
    changes: []
  };
  
  try {
    // Handle conflicts
    if (mapping.syncDirection === 'conflict' && !options.force) {
      detail.message = `Conflict detected: ${mapping.conflictReasons.join(', ')}`;
      detail.error = 'Use --force to override conflicts';
      return detail;
    }
    
    // Load current data
    const pr = await statusManager.loadPRData(mapping.prId);
    const task = await loadTaskData(mapping.taskId, configManager);
    
    if (!pr || !task) {
      detail.error = `Could not load PR ${mapping.prId} or task ${mapping.taskId}`;
      return detail;
    }
    
    // Determine sync direction
    let syncDirection = mapping.syncDirection;
    if (options.direction !== 'bidirectional') {
      syncDirection = options.direction;
    }
    
    const changes: string[] = [];
    
    // Perform sync based on direction
    if (syncDirection === 'pr-to-task' || syncDirection === 'conflict') {
      // Update task based on PR
      if (pr.pr_status !== mapping.prStatus || options.force) {
        const newTaskStatus = getTaskStatusFromPR(pr.pr_status);
        
        if (!options.dryRun) {
          await updateTaskStatus(task, newTaskStatus, configManager);
        }
        
        changes.push(`Updated task status: ${task.status} → ${newTaskStatus}`);
        
        // Auto-complete task if PR is merged
        if (options.autoComplete && pr.pr_status === 'merged') {
          if (!options.dryRun) {
            await updateTaskStatus(task, 'completed', configManager);
          }
          changes.push('Auto-completed task (PR merged)');
        }
      }
      
      // Sync assignee if requested
      if (options.syncAssignees && pr.assignee !== task.assignee) {
        if (!options.dryRun) {
          await updateTaskAssignee(task, pr.assignee, configManager);
        }
        changes.push(`Updated task assignee: ${task.assignee} → ${pr.assignee}`);
      }
    }
    
    if (syncDirection === 'task-to-pr' || syncDirection === 'conflict') {
      // Update PR based on task
      if (task.status !== mapping.taskStatus || options.force) {
        const newPRStatus = getPRStatusFromTask(task.status);
        
        if (!options.dryRun) {
          await statusManager.updatePRStatus(pr.pr_id, newPRStatus);
        }
        
        changes.push(`Updated PR status: ${pr.pr_status} → ${newPRStatus}`);
      }
      
      // Sync assignee if requested
      if (options.syncAssignees && task.assignee !== pr.assignee) {
        if (!options.dryRun) {
          await updatePRAssignee(pr, task.assignee, configManager);
        }
        changes.push(`Updated PR assignee: ${pr.assignee} → ${task.assignee}`);
      }
    }
    
    // Sync timestamps if requested
    if (options.syncTimestamps) {
      const latestDate = new Date(Math.max(
        new Date(pr.updated_date).getTime(),
        new Date(task.updated_date).getTime()
      )).toISOString();
      
      if (!options.dryRun) {
        await updateTimestamps(pr, task, latestDate, configManager);
      }
      
      changes.push(`Synced timestamps to: ${latestDate}`);
    }
    
    detail.success = true;
    detail.changes = changes;
    detail.message = changes.length > 0 ? `Synced successfully (${changes.length} changes)` : 'Already in sync';
    detail.action = `synced ${syncDirection}`;
    
    return detail;
    
  } catch (error) {
    detail.error = error instanceof Error ? error.message : String(error);
    detail.message = 'Sync failed';
    return detail;
  }
}

function getTaskStatusFromPR(prStatus: PRStatus): ItemStatus {
  const statusMap: Record<PRStatus, ItemStatus> = {
    'draft': 'planning',
    'open': 'active',
    'review': 'active',
    'approved': 'active',
    'merged': 'completed',
    'closed': 'archived'
  };
  
  return statusMap[prStatus] || 'active';
}

function getPRStatusFromTask(taskStatus: ItemStatus): PRStatus {
  const statusMap: Record<ItemStatus, PRStatus> = {
    'planning': 'draft',
    'active': 'open',
    'completed': 'merged',
    'archived': 'closed'
  };
  
  return statusMap[taskStatus] || 'open';
}

async function loadTaskData(taskId: string, configManager: ConfigManager): Promise<TaskData | null> {
  try {
    const tasksDir = configManager.getTasksDirectory();
    const taskFiles = fs.readdirSync(tasksDir).filter(file => file.includes(taskId));
    
    if (taskFiles.length === 0) {
      return null;
    }
    
    const taskFile = taskFiles[0];
    const taskPath = path.join(tasksDir, taskFile);
    
    // This is a simplified loader - in practice, you'd use the frontmatter parser
    const content = fs.readFileSync(taskPath, 'utf8');
    
    // Mock task data for demonstration
    return {
      task_id: taskId,
      issue_id: 'ISSUE-001',
      epic_id: 'EPIC-001',
      title: 'Task Title',
      description: 'Task Description',
      status: 'active',
      priority: 'medium',
      assignee: 'system',
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
      estimated_tokens: 0,
      actual_tokens: 0,
      ai_context: [],
      sync_status: 'local',
      content: content,
      file_path: taskPath
    };
    
  } catch (error) {
    console.error(`Error loading task ${taskId}:`, error);
    return null;
  }
}

async function updateTaskStatus(task: TaskData, newStatus: ItemStatus, configManager: ConfigManager): Promise<void> {
  try {
    const content = fs.readFileSync(task.file_path, 'utf8');
    const updatedContent = content
      .replace(/status:\s*\w+/, `status: ${newStatus}`)
      .replace(/updated_date:\s*[^\n]+/, `updated_date: ${new Date().toISOString()}`);
    
    fs.writeFileSync(task.file_path, updatedContent, 'utf8');
  } catch (error) {
    console.error(`Error updating task ${task.task_id}:`, error);
  }
}

async function updateTaskAssignee(task: TaskData, newAssignee: string, configManager: ConfigManager): Promise<void> {
  try {
    const content = fs.readFileSync(task.file_path, 'utf8');
    const updatedContent = content
      .replace(/assignee:\s*[^\n]+/, `assignee: ${newAssignee}`)
      .replace(/updated_date:\s*[^\n]+/, `updated_date: ${new Date().toISOString()}`);
    
    fs.writeFileSync(task.file_path, updatedContent, 'utf8');
  } catch (error) {
    console.error(`Error updating task assignee ${task.task_id}:`, error);
  }
}

async function updatePRAssignee(pr: PRData, newAssignee: string, configManager: ConfigManager): Promise<void> {
  try {
    const content = fs.readFileSync(pr.file_path, 'utf8');
    const updatedContent = content
      .replace(/assignee:\s*[^\n]+/, `assignee: ${newAssignee}`)
      .replace(/updated_date:\s*[^\n]+/, `updated_date: ${new Date().toISOString()}`);
    
    fs.writeFileSync(pr.file_path, updatedContent, 'utf8');
  } catch (error) {
    console.error(`Error updating PR assignee ${pr.pr_id}:`, error);
  }
}

async function updateTimestamps(pr: PRData, task: TaskData, timestamp: string, configManager: ConfigManager): Promise<void> {
  try {
    // Update PR timestamp
    const prContent = fs.readFileSync(pr.file_path, 'utf8');
    const updatedPRContent = prContent.replace(/updated_date:\s*[^\n]+/, `updated_date: ${timestamp}`);
    fs.writeFileSync(pr.file_path, updatedPRContent, 'utf8');
    
    // Update task timestamp
    const taskContent = fs.readFileSync(task.file_path, 'utf8');
    const updatedTaskContent = taskContent.replace(/updated_date:\s*[^\n]+/, `updated_date: ${timestamp}`);
    fs.writeFileSync(task.file_path, updatedTaskContent, 'utf8');
    
  } catch (error) {
    console.error(`Error updating timestamps for ${pr.pr_id} ↔ ${task.task_id}:`, error);
  }
}

async function forceSyncPRTask(
  prId: string,
  taskId: string,
  direction: string,
  statusManager: PRStatusManager,
  relationshipManager: RelationshipManager,
  configManager: ConfigManager
): Promise<SyncDetail> {
  const pr = await statusManager.loadPRData(prId);
  const task = await loadTaskData(taskId, configManager);
  
  if (!pr || !task) {
    return {
      prId,
      taskId,
      action: 'force-sync',
      success: false,
      message: 'PR or task not found',
      error: `Could not load PR ${prId} or task ${taskId}`
    };
  }
  
  const mapping = createSyncMapping(pr, task);
  
  const syncOptions: SyncOptions = {
    direction: direction as any,
    autoCreate: false,
    autoComplete: true,
    updateDescriptions: false,
    syncTimestamps: true,
    syncAssignees: true,
    dryRun: false,
    force: true
  };
  
  return await syncPRTask(mapping, syncOptions, statusManager, relationshipManager, configManager);
}

function displaySyncResult(result: SyncResult): void {
  console.log(colors.cyan(`\n📊 Sync operation completed`));
  console.log(`🎯 Direction: ${result.direction}`);
  console.log(`📋 Total PRs: ${result.totalPRs}`);
  console.log(`📝 Total Tasks: ${result.totalTasks}`);
  console.log(`🔄 Synced PRs: ${result.syncedPRs}`);
  console.log(`🔄 Synced Tasks: ${result.syncedTasks}`);
  
  if (result.createdPRs > 0) {
    console.log(`➕ Created PRs: ${result.createdPRs}`);
  }
  
  if (result.createdTasks > 0) {
    console.log(`➕ Created Tasks: ${result.createdTasks}`);
  }
  
  if (result.completedTasks > 0) {
    console.log(`✅ Completed Tasks: ${result.completedTasks}`);
  }
  
  if (result.details.length > 0) {
    console.log('\n📋 Sync Details:');
    result.details.forEach(detail => {
      const icon = detail.success ? '✅' : '❌';
      const color = detail.success ? colors.green : colors.red;
      console.log(color(`${icon} ${detail.prId} ↔ ${detail.taskId}: ${detail.message}`));
      
      if (detail.changes && detail.changes.length > 0) {
        detail.changes.forEach(change => {
          console.log(colors.blue(`    - ${change}`));
        });
      }
    });
  }
  
  if (result.warnings.length > 0) {
    console.log(colors.yellow('\n⚠️  Warnings:'));
    result.warnings.forEach(warning => {
      console.log(colors.yellow(`  - ${warning}`));
    });
  }
  
  if (result.errors.length > 0) {
    console.log(colors.red('\n❌ Errors:'));
    result.errors.forEach(error => {
      console.log(colors.red(`  - ${error}`));
    });
  }
  
  const successColor = result.success ? colors.green : colors.red;
  const successIcon = result.success ? '✅' : '❌';
  console.log(successColor(`\n${successIcon} Sync ${result.success ? 'completed successfully' : 'failed'}`));
}

function displaySyncMappings(mappings: SyncMapping[], format: string, formatter: Formatter): void {
  if (format === 'json') {
    console.log(JSON.stringify(mappings, null, 2));
  } else {
    console.log(colors.blue(`\n📊 PR-Task Sync Status (${mappings.length} relationships)`));
    
    console.table(mappings.map(mapping => ({
      'PR ID': mapping.prId,
      'Task ID': mapping.taskId,
      'PR Status': mapping.prStatus,
      'Task Status': mapping.taskStatus,
      'Sync Required': mapping.syncRequired ? 'Yes' : 'No',
      'Direction': mapping.syncDirection,
      'Conflicts': mapping.conflictReasons.length > 0 ? mapping.conflictReasons.join(', ') : 'None'
    })));
    
    const needsSync = mappings.filter(m => m.syncRequired).length;
    const conflicts = mappings.filter(m => m.syncDirection === 'conflict').length;
    
    console.log(colors.cyan(`\n📈 Summary:`));
    console.log(`🔄 Needs Sync: ${needsSync}`);
    console.log(`⚠️  Conflicts: ${conflicts}`);
    console.log(`✅ In Sync: ${mappings.length - needsSync}`);
  }
}

export { SyncOptions, SyncResult, SyncMapping };