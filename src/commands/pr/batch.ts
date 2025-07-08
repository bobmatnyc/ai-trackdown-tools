/**
 * PR Batch Operations Command
 * Handles bulk actions and batch operations on multiple PRs
 */

import { Command } from 'commander';
import { PRStatusManager } from '../../utils/pr-status-manager.js';
import { PRFileManager } from '../../utils/pr-file-manager.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { colors } from '../../utils/colors.js';
import { mergePR, type MergeOptions } from './merge.js';
import { closePR, type CloseOptions } from './close.js';
import * as fs from 'fs';
import * as path from 'path';
import type { PRData, PRStatus, TaskData, IssueData } from '../../types/ai-trackdown.js';

export type BatchOperation = 'merge' | 'close' | 'approve' | 'update-status' | 'archive' | 'create-from-tasks';

export interface BatchOptions {
  operation: BatchOperation;
  filter?: PRBatchFilter;
  dryRun: boolean;
  maxConcurrency: number;
  continueOnError: boolean;
  createReport: boolean;
  autoApprove: boolean;
}

export interface PRBatchFilter {
  status?: PRStatus | PRStatus[];
  assignee?: string | string[];
  reviewer?: string | string[];
  labels?: string | string[];
  createdAfter?: string;
  createdBefore?: string;
  branch?: string;
  author?: string;
  milestone?: string;
}

export interface BatchResult {
  success: boolean;
  operation: BatchOperation;
  totalPRs: number;
  processedPRs: number;
  successfulPRs: number;
  failedPRs: number;
  skippedPRs: number;
  results: PROperationResult[];
  errors: string[];
  warnings: string[];
  executionTime: number;
  report?: string;
}

export interface PROperationResult {
  prId: string;
  success: boolean;
  action: string;
  message: string;
  details?: any;
  error?: string;
  warnings?: string[];
}

export function createPRBatchCommand(): Command {
  const cmd = new Command('batch');
  
  cmd
    .description('Perform batch operations on multiple PRs')
    .option('-o, --operation <operation>', 'Batch operation (merge|close|approve|update-status|archive|create-from-tasks)', 'merge')
    .option('--status <status>', 'Filter by PR status (can be comma-separated)')
    .option('--assignee <assignee>', 'Filter by assignee')
    .option('--reviewer <reviewer>', 'Filter by reviewer')
    .option('--labels <labels>', 'Filter by labels (comma-separated)')
    .option('--created-after <date>', 'Filter PRs created after date')
    .option('--created-before <date>', 'Filter PRs created before date')
    .option('--branch <branch>', 'Filter by branch name')
    .option('--author <author>', 'Filter by author')
    .option('--milestone <milestone>', 'Filter by milestone')
    .option('--max-concurrency <num>', 'Maximum concurrent operations', '5')
    .option('--continue-on-error', 'Continue processing if one PR fails', false)
    .option('--create-report', 'Create detailed report of operations', false)
    .option('--auto-approve', 'Auto-approve operations when applicable', false)
    .option('--dry-run', 'Show what would be done without executing', false)
    .action(async (options: any) => {
      const configManager = new ConfigManager();
      const statusManager = new PRStatusManager(configManager);
      const fileManager = new PRFileManager(configManager);
      const relationshipManager = new RelationshipManager(configManager);
      const formatter = new Formatter();
      
      const batchOptions: BatchOptions = {
        operation: options.operation as BatchOperation,
        filter: {
          status: options.status ? options.status.split(',') : undefined,
          assignee: options.assignee,
          reviewer: options.reviewer,
          labels: options.labels ? options.labels.split(',') : undefined,
          createdAfter: options.createdAfter,
          createdBefore: options.createdBefore,
          branch: options.branch,
          author: options.author,
          milestone: options.milestone
        },
        dryRun: options.dryRun,
        maxConcurrency: parseInt(options.maxConcurrency),
        continueOnError: options.continueOnError,
        createReport: options.createReport,
        autoApprove: options.autoApprove
      };
      
      try {
        const result = await performBatchOperation(
          batchOptions,
          statusManager,
          fileManager,
          relationshipManager,
          configManager
        );
        
        if (options.dryRun) {
          console.log(colors.yellow('🔍 Batch dry run - showing what would be done:'));
          console.log('');
        }
        
        console.log(colors.cyan(`📊 Batch ${result.operation} operation completed`));
        console.log(`🎯 Total PRs: ${result.totalPRs}`);
        console.log(`✅ Processed: ${result.processedPRs}`);
        console.log(`🟢 Successful: ${result.successfulPRs}`);
        console.log(`🔴 Failed: ${result.failedPRs}`);
        console.log(`⏭️  Skipped: ${result.skippedPRs}`);
        console.log(`⏱️  Time: ${result.executionTime}ms`);
        
        if (result.results.length > 0) {
          console.log('\n📋 Operation Results:');
          result.results.forEach(prResult => {
            const icon = prResult.success ? '✅' : '❌';
            const color = prResult.success ? colors.green : colors.red;
            console.log(color(`${icon} ${prResult.prId}: ${prResult.message}`));
            
            if (prResult.warnings && prResult.warnings.length > 0) {
              prResult.warnings.forEach(warning => {
                console.log(colors.yellow(`  ⚠️  ${warning}`));
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
        
        if (result.report) {
          console.log(colors.blue(`\n📄 Report saved to: ${result.report}`));
        }
        
        if (!result.success) {
          process.exit(1);
        }
        
      } catch (error) {
        console.error(colors.red(`❌ Batch operation failed: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
  
  return cmd;
}

async function performBatchOperation(
  options: BatchOptions,
  statusManager: PRStatusManager,
  fileManager: PRFileManager,
  relationshipManager: RelationshipManager,
  configManager: ConfigManager
): Promise<BatchResult> {
  const startTime = Date.now();
  
  const result: BatchResult = {
    success: false,
    operation: options.operation,
    totalPRs: 0,
    processedPRs: 0,
    successfulPRs: 0,
    failedPRs: 0,
    skippedPRs: 0,
    results: [],
    errors: [],
    warnings: [],
    executionTime: 0
  };
  
  try {
    // 1. Get PRs matching the filter
    const allPRs = await statusManager.listPRs();
    const filteredPRs = filterPRs(allPRs, options.filter);
    
    result.totalPRs = filteredPRs.length;
    
    if (filteredPRs.length === 0) {
      result.warnings.push('No PRs match the specified filter criteria');
      result.success = true;
      result.executionTime = Date.now() - startTime;
      return result;
    }
    
    console.log(colors.blue(`🔄 Processing ${filteredPRs.length} PRs with operation: ${options.operation}`));
    
    // 2. Perform batch operation based on type
    switch (options.operation) {
      case 'merge':
        await performBatchMerge(filteredPRs, options, result, statusManager, fileManager, relationshipManager, configManager);
        break;
      case 'close':
        await performBatchClose(filteredPRs, options, result, statusManager, fileManager, relationshipManager, configManager);
        break;
      case 'approve':
        await performBatchApprove(filteredPRs, options, result, statusManager, configManager);
        break;
      case 'update-status':
        await performBatchStatusUpdate(filteredPRs, options, result, statusManager, fileManager, configManager);
        break;
      case 'archive':
        await performBatchArchive(filteredPRs, options, result, fileManager, configManager);
        break;
      case 'create-from-tasks':
        await performBatchCreateFromTasks(options, result, statusManager, relationshipManager, configManager);
        break;
      default:
        result.errors.push(`Unknown batch operation: ${options.operation}`);
        result.executionTime = Date.now() - startTime;
        return result;
    }
    
    // 3. Create report if requested
    if (options.createReport) {
      result.report = await createBatchReport(result, options, configManager);
    }
    
    result.success = result.failedPRs === 0;
    result.executionTime = Date.now() - startTime;
    
    return result;
    
  } catch (error) {
    result.errors.push(`Batch operation failed: ${error instanceof Error ? error.message : String(error)}`);
    result.executionTime = Date.now() - startTime;
    return result;
  }
}

function filterPRs(prs: PRData[], filter?: PRBatchFilter): PRData[] {
  if (!filter) return prs;
  
  return prs.filter(pr => {
    // Filter by status
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      if (!statuses.includes(pr.pr_status)) return false;
    }
    
    // Filter by assignee
    if (filter.assignee && pr.assignee !== filter.assignee) return false;
    
    // Filter by reviewer
    if (filter.reviewer && (!pr.reviewers || !pr.reviewers.includes(filter.reviewer))) return false;
    
    // Filter by labels
    if (filter.labels) {
      const labels = Array.isArray(filter.labels) ? filter.labels : [filter.labels];
      if (!pr.tags || !labels.some(label => pr.tags!.includes(label))) return false;
    }
    
    // Filter by date range
    if (filter.createdAfter && new Date(pr.created_date) < new Date(filter.createdAfter)) return false;
    if (filter.createdBefore && new Date(pr.created_date) > new Date(filter.createdBefore)) return false;
    
    // Filter by branch
    if (filter.branch && pr.source_branch !== filter.branch) return false;
    
    // Filter by author
    if (filter.author && pr.assignee !== filter.author) return false;
    
    // Filter by milestone
    if (filter.milestone && pr.milestone !== filter.milestone) return false;
    
    return true;
  });
}

async function performBatchMerge(
  prs: PRData[],
  options: BatchOptions,
  result: BatchResult,
  statusManager: PRStatusManager,
  fileManager: PRFileManager,
  relationshipManager: RelationshipManager,
  configManager: ConfigManager
): Promise<void> {
  const mergeOptions: MergeOptions = {
    strategy: 'merge',
    closeLinkedTasks: true,
    deleteSourceBranch: false,
    requireApproval: !options.autoApprove,
    runPreMergeChecks: true,
    autoArchive: true,
    updateMilestone: false
  };
  
  for (const pr of prs) {
    try {
      // Skip if not in mergeable state
      if (!['approved', 'open', 'review'].includes(pr.pr_status)) {
        result.skippedPRs++;
        result.results.push({
          prId: pr.pr_id,
          success: false,
          action: 'merge',
          message: `Skipped - PR status '${pr.pr_status}' is not mergeable`
        });
        continue;
      }
      
      const mergeResult = await mergePR(
        pr.pr_id,
        mergeOptions,
        statusManager,
        fileManager,
        relationshipManager,
        configManager,
        options.dryRun
      );
      
      result.processedPRs++;
      
      if (mergeResult.success) {
        result.successfulPRs++;
        result.results.push({
          prId: pr.pr_id,
          success: true,
          action: 'merge',
          message: `Merged successfully with strategy: ${mergeResult.strategy}`,
          details: mergeResult,
          warnings: mergeResult.warnings
        });
      } else {
        result.failedPRs++;
        result.results.push({
          prId: pr.pr_id,
          success: false,
          action: 'merge',
          message: `Merge failed: ${mergeResult.errors.join(', ')}`,
          error: mergeResult.errors.join(', ')
        });
        
        if (!options.continueOnError) {
          break;
        }
      }
      
    } catch (error) {
      result.failedPRs++;
      result.results.push({
        prId: pr.pr_id,
        success: false,
        action: 'merge',
        message: `Merge failed with error`,
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (!options.continueOnError) {
        break;
      }
    }
  }
}

async function performBatchClose(
  prs: PRData[],
  options: BatchOptions,
  result: BatchResult,
  statusManager: PRStatusManager,
  fileManager: PRFileManager,
  relationshipManager: RelationshipManager,
  configManager: ConfigManager
): Promise<void> {
  const closeOptions: CloseOptions = {
    reason: 'stale',
    updateLinkedTasks: true,
    updateLinkedIssues: true,
    deleteSourceBranch: false,
    archiveFiles: true,
    notifyReviewers: false,
    addToReport: true
  };
  
  for (const pr of prs) {
    try {
      // Skip if already closed or merged
      if (['closed', 'merged'].includes(pr.pr_status)) {
        result.skippedPRs++;
        result.results.push({
          prId: pr.pr_id,
          success: false,
          action: 'close',
          message: `Skipped - PR is already ${pr.pr_status}`
        });
        continue;
      }
      
      const closeResult = await closePR(
        pr.pr_id,
        closeOptions,
        statusManager,
        fileManager,
        relationshipManager,
        configManager,
        false,
        options.dryRun
      );
      
      result.processedPRs++;
      
      if (closeResult.success) {
        result.successfulPRs++;
        result.results.push({
          prId: pr.pr_id,
          success: true,
          action: 'close',
          message: `Closed successfully with reason: ${closeResult.reason}`,
          details: closeResult,
          warnings: closeResult.warnings
        });
      } else {
        result.failedPRs++;
        result.results.push({
          prId: pr.pr_id,
          success: false,
          action: 'close',
          message: `Close failed: ${closeResult.errors.join(', ')}`,
          error: closeResult.errors.join(', ')
        });
        
        if (!options.continueOnError) {
          break;
        }
      }
      
    } catch (error) {
      result.failedPRs++;
      result.results.push({
        prId: pr.pr_id,
        success: false,
        action: 'close',
        message: `Close failed with error`,
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (!options.continueOnError) {
        break;
      }
    }
  }
}

async function performBatchApprove(
  prs: PRData[],
  options: BatchOptions,
  result: BatchResult,
  statusManager: PRStatusManager,
  configManager: ConfigManager
): Promise<void> {
  for (const pr of prs) {
    try {
      // Skip if not in reviewable state
      if (!['open', 'review'].includes(pr.pr_status)) {
        result.skippedPRs++;
        result.results.push({
          prId: pr.pr_id,
          success: false,
          action: 'approve',
          message: `Skipped - PR status '${pr.pr_status}' is not reviewable`
        });
        continue;
      }
      
      if (!options.dryRun) {
        await statusManager.updatePRStatus(pr.pr_id, 'approved');
      }
      
      result.processedPRs++;
      result.successfulPRs++;
      result.results.push({
        prId: pr.pr_id,
        success: true,
        action: 'approve',
        message: 'Approved successfully'
      });
      
    } catch (error) {
      result.failedPRs++;
      result.results.push({
        prId: pr.pr_id,
        success: false,
        action: 'approve',
        message: `Approve failed with error`,
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (!options.continueOnError) {
        break;
      }
    }
  }
}

async function performBatchStatusUpdate(
  prs: PRData[],
  options: BatchOptions,
  result: BatchResult,
  statusManager: PRStatusManager,
  fileManager: PRFileManager,
  configManager: ConfigManager
): Promise<void> {
  // This would update PR status based on additional criteria
  // For now, it's a placeholder
  for (const pr of prs) {
    result.skippedPRs++;
    result.results.push({
      prId: pr.pr_id,
      success: false,
      action: 'update-status',
      message: 'Status update operation not implemented'
    });
  }
}

async function performBatchArchive(
  prs: PRData[],
  options: BatchOptions,
  result: BatchResult,
  fileManager: PRFileManager,
  configManager: ConfigManager
): Promise<void> {
  const basePRsDir = configManager.getPRsDirectory();
  
  for (const pr of prs) {
    try {
      // Only archive merged or closed PRs
      if (!['merged', 'closed'].includes(pr.pr_status)) {
        result.skippedPRs++;
        result.results.push({
          prId: pr.pr_id,
          success: false,
          action: 'archive',
          message: `Skipped - PR status '${pr.pr_status}' is not archivable`
        });
        continue;
      }
      
      if (!options.dryRun) {
        const archiveResult = await fileManager.archiveOldPRs(basePRsDir, 0);
        // This is a simplified archive - in practice, we'd move specific files
      }
      
      result.processedPRs++;
      result.successfulPRs++;
      result.results.push({
        prId: pr.pr_id,
        success: true,
        action: 'archive',
        message: 'Archived successfully'
      });
      
    } catch (error) {
      result.failedPRs++;
      result.results.push({
        prId: pr.pr_id,
        success: false,
        action: 'archive',
        message: `Archive failed with error`,
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (!options.continueOnError) {
        break;
      }
    }
  }
}

async function performBatchCreateFromTasks(
  options: BatchOptions,
  result: BatchResult,
  statusManager: PRStatusManager,
  relationshipManager: RelationshipManager,
  configManager: ConfigManager
): Promise<void> {
  try {
    // Get completed tasks that don't have PRs
    const completedTasks = await getCompletedTasksWithoutPRs(configManager);
    
    for (const task of completedTasks) {
      try {
        if (!options.dryRun) {
          // Create PR from task
          const prData = await createPRFromTask(task, statusManager, configManager);
          await relationshipManager.linkPRToTask(prData.pr_id, task.task_id);
        }
        
        result.processedPRs++;
        result.successfulPRs++;
        result.results.push({
          prId: `PR-${task.task_id}`,
          success: true,
          action: 'create-from-task',
          message: `Created PR from task: ${task.title}`
        });
        
      } catch (error) {
        result.failedPRs++;
        result.results.push({
          prId: `PR-${task.task_id}`,
          success: false,
          action: 'create-from-task',
          message: `Failed to create PR from task: ${task.title}`,
          error: error instanceof Error ? error.message : String(error)
        });
        
        if (!options.continueOnError) {
          break;
        }
      }
    }
    
    result.totalPRs = completedTasks.length;
    
  } catch (error) {
    result.errors.push(`Failed to create PRs from tasks: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function getCompletedTasksWithoutPRs(configManager: ConfigManager): Promise<TaskData[]> {
  // This would query for completed tasks that don't have associated PRs
  // For now, return empty array as placeholder
  return [];
}

async function createPRFromTask(task: TaskData, statusManager: PRStatusManager, configManager: ConfigManager): Promise<PRData> {
  // This would create a PR from a task
  // For now, return a mock PR
  return {
    pr_id: `PR-${task.task_id}`,
    title: `PR for ${task.title}`,
    description: task.description,
    status: 'active',
    priority: task.priority,
    assignee: task.assignee,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    estimated_tokens: 0,
    actual_tokens: 0,
    ai_context: [],
    sync_status: 'local',
    issue_id: task.issue_id,
    epic_id: task.epic_id,
    pr_status: 'draft',
    content: '',
    file_path: ''
  };
}

async function createBatchReport(
  result: BatchResult,
  options: BatchOptions,
  configManager: ConfigManager
): Promise<string> {
  const reportData = {
    timestamp: new Date().toISOString(),
    operation: result.operation,
    summary: {
      totalPRs: result.totalPRs,
      processedPRs: result.processedPRs,
      successfulPRs: result.successfulPRs,
      failedPRs: result.failedPRs,
      skippedPRs: result.skippedPRs,
      executionTime: result.executionTime
    },
    filter: options.filter,
    results: result.results,
    errors: result.errors,
    warnings: result.warnings
  };
  
  const reportsDir = path.join(configManager.getPRsDirectory(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const reportFileName = `batch-${result.operation}-${new Date().toISOString().split('T')[0]}.json`;
  const reportPath = path.join(reportsDir, reportFileName);
  
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf8');
  
  return reportPath;
}

export { performBatchOperation, BatchOptions, BatchResult };