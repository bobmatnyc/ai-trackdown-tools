/**
 * PR Close Command
 * Handles closing pull requests without merging
 */

import { Command } from 'commander';
import { PRStatusManager } from '../../utils/pr-status-manager.js';
import { PRFileManager } from '../../utils/pr-file-manager.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { colors } from '../../utils/colors.js';
import * as fs from 'fs';
import * as path from 'path';
import type { PRData, PRStatus } from '../../types/ai-trackdown.js';

export type CloseReason = 'cancelled' | 'superseded' | 'rejected' | 'duplicate' | 'stale' | 'other';

export interface CloseOptions {
  reason: CloseReason;
  comment?: string;
  updateLinkedTasks: boolean;
  updateLinkedIssues: boolean;
  deleteSourceBranch: boolean;
  archiveFiles: boolean;
  notifyReviewers: boolean;
  addToReport: boolean;
}

export interface CloseResult {
  success: boolean;
  prId: string;
  reason: CloseReason;
  updatedTasks: string[];
  updatedIssues: string[];
  archivedFiles: string[];
  notifications: string[];
  errors: string[];
  warnings: string[];
}

export function createPRCloseCommand(): Command {
  const cmd = new Command('close');
  
  cmd
    .description('Close a pull request without merging')
    .argument('<pr-id>', 'Pull request ID to close')
    .option('-r, --reason <reason>', 'Reason for closing (cancelled|superseded|rejected|duplicate|stale|other)', 'cancelled')
    .option('-c, --comment <comment>', 'Comment explaining the closure')
    .option('--update-tasks', 'Update linked tasks with closure info', false)
    .option('--update-issues', 'Update linked issues with closure info', false)
    .option('--delete-branch', 'Delete source branch after closing', false)
    .option('--no-archive', 'Do not archive PR after closing', false)
    .option('--notify-reviewers', 'Notify reviewers of the closure', false)
    .option('--add-to-report', 'Add to closure report', false)
    .option('--force', 'Force close even if PR is approved', false)
    .option('--dry-run', 'Show what would be done without executing', false)
    .action(async (prId: string, options: any) => {
      const configManager = new ConfigManager();
      const statusManager = new PRStatusManager(configManager);
      const fileManager = new PRFileManager(configManager);
      const relationshipManager = new RelationshipManager(configManager);
      const formatter = new Formatter();
      
      const closeOptions: CloseOptions = {
        reason: options.reason as CloseReason,
        comment: options.comment,
        updateLinkedTasks: options.updateTasks,
        updateLinkedIssues: options.updateIssues,
        deleteSourceBranch: options.deleteBranch,
        archiveFiles: !options.noArchive,
        notifyReviewers: options.notifyReviewers,
        addToReport: options.addToReport
      };
      
      try {
        const result = await closePR(
          prId,
          closeOptions,
          statusManager,
          fileManager,
          relationshipManager,
          configManager,
          options.force,
          options.dryRun
        );
        
        if (options.dryRun) {
          console.log(colors.yellow('🔍 Dry run - showing what would be done:'));
          console.log('');
        }
        
        if (result.success) {
          console.log(colors.green(`✅ Successfully closed PR ${prId}`));
          console.log(`📋 Reason: ${result.reason}`);
          
          if (result.updatedTasks.length > 0) {
            console.log(`📝 Updated tasks: ${result.updatedTasks.join(', ')}`);
          }
          
          if (result.updatedIssues.length > 0) {
            console.log(`🎯 Updated issues: ${result.updatedIssues.join(', ')}`);
          }
          
          if (result.archivedFiles.length > 0) {
            console.log(`📁 Archived files: ${result.archivedFiles.length}`);
          }
          
          if (result.notifications.length > 0) {
            console.log(`📬 Notifications sent: ${result.notifications.join(', ')}`);
          }
          
          if (result.warnings.length > 0) {
            console.log(colors.yellow('⚠️  Warnings:'));
            result.warnings.forEach(warning => {
              console.log(colors.yellow(`  - ${warning}`));
            });
          }
        } else {
          console.error(colors.red(`❌ Failed to close PR ${prId}`));
          result.errors.forEach(error => {
            console.error(colors.red(`  • ${error}`));
          });
          process.exit(1);
        }
      } catch (error) {
        console.error(colors.red(`❌ Error closing PR: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
  
  return cmd;
}

async function closePR(
  prId: string,
  options: CloseOptions,
  statusManager: PRStatusManager,
  fileManager: PRFileManager,
  relationshipManager: RelationshipManager,
  configManager: ConfigManager,
  force: boolean = false,
  dryRun: boolean = false
): Promise<CloseResult> {
  const result: CloseResult = {
    success: false,
    prId,
    reason: options.reason,
    updatedTasks: [],
    updatedIssues: [],
    archivedFiles: [],
    notifications: [],
    errors: [],
    warnings: []
  };
  
  try {
    // 1. Load PR data
    const prData = await statusManager.loadPRData(prId);
    if (!prData) {
      result.errors.push(`PR ${prId} not found`);
      return result;
    }
    
    // 2. Validate close reason
    if (!isValidCloseReason(options.reason)) {
      result.errors.push(`Invalid close reason: ${options.reason}`);
      return result;
    }
    
    // 3. Check current PR status
    const statusValidation = validatePRStatusForClose(prData, force);
    if (!statusValidation.valid) {
      result.errors.push(...statusValidation.errors);
      return result;
    }
    
    // 4. Add warnings for significant closures
    if (statusValidation.warnings.length > 0) {
      result.warnings.push(...statusValidation.warnings);
    }
    
    // 5. Update PR status and move to closed directory
    if (!dryRun) {
      await statusManager.updatePRStatus(prId, 'closed');
      const basePRsDir = configManager.getPRsDirectory();
      const moveResult = await fileManager.movePRToStatusDirectory(prData, 'closed', basePRsDir);
      if (moveResult.moved) {
        result.archivedFiles.push(moveResult.newPath);
      }
    }
    
    // 6. Update linked tasks and issues
    if (options.updateLinkedTasks) {
      const linkedTasks = await relationshipManager.getLinkedTasks(prId);
      
      if (!dryRun) {
        for (const taskId of linkedTasks) {
          await updateTaskForClose(taskId, prId, options, configManager);
          result.updatedTasks.push(taskId);
        }
      } else {
        result.updatedTasks = linkedTasks;
      }
    }
    
    if (options.updateLinkedIssues) {
      const linkedIssues = await relationshipManager.getLinkedIssues(prId);
      
      if (!dryRun) {
        for (const issueId of linkedIssues) {
          await updateIssueForClose(issueId, prId, options, configManager);
          result.updatedIssues.push(issueId);
        }
      } else {
        result.updatedIssues = linkedIssues;
      }
    }
    
    // 7. Notify reviewers if requested
    if (options.notifyReviewers && prData.reviewers) {
      if (!dryRun) {
        for (const reviewer of prData.reviewers) {
          await notifyReviewer(reviewer, prId, options);
          result.notifications.push(reviewer);
        }
      } else {
        result.notifications = prData.reviewers;
      }
    }
    
    // 8. Add to closure report if requested
    if (options.addToReport) {
      if (!dryRun) {
        await addToClosureReport(prData, options, configManager);
      }
      result.warnings.push('Added to closure report');
    }
    
    // 9. Create closure activity log
    if (!dryRun) {
      await createClosureActivityLog(prData, options, result);
    }
    
    // 10. Update PR with closure information
    if (!dryRun) {
      await updatePRWithClosureInfo(prData, options, configManager);
    }
    
    result.success = true;
    return result;
    
  } catch (error) {
    result.errors.push(`Close operation failed: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}

function isValidCloseReason(reason: string): reason is CloseReason {
  return ['cancelled', 'superseded', 'rejected', 'duplicate', 'stale', 'other'].includes(reason);
}

function validatePRStatusForClose(prData: PRData, force: boolean): { 
  valid: boolean; 
  errors: string[]; 
  warnings: string[] 
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check if PR is already closed
  if (prData.pr_status === 'closed') {
    errors.push('PR is already closed');
  }
  
  // Check if PR is already merged
  if (prData.pr_status === 'merged') {
    errors.push('PR is already merged and cannot be closed');
  }
  
  // Warn about closing approved PRs
  if (prData.pr_status === 'approved' && !force) {
    warnings.push('PR is approved - consider merging instead of closing');
  }
  
  // Warn about closing PRs with approvals
  if (prData.approvals && prData.approvals.length > 0 && !force) {
    warnings.push(`PR has ${prData.approvals.length} approval(s) - closing will discard them`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

async function updateTaskForClose(
  taskId: string,
  prId: string,
  options: CloseOptions,
  configManager: ConfigManager
): Promise<void> {
  try {
    const tasksDir = configManager.getTasksDirectory();
    const taskFiles = fs.readdirSync(tasksDir).filter(file => file.includes(taskId));
    
    if (taskFiles.length === 0) {
      console.warn(`Task ${taskId} not found in ${tasksDir}`);
      return;
    }
    
    const taskFile = taskFiles[0];
    const taskPath = path.join(tasksDir, taskFile);
    const taskContent = fs.readFileSync(taskPath, 'utf8');
    
    // Update task content with closure information
    const updatedContent = taskContent.replace(
      /updated_date:\s*[^\n]+/,
      `updated_date: ${new Date().toISOString()}`
    );
    
    // Add closure note
    const closureNote = `\n\n## PR Closed\n\nPR ${prId} was closed (${options.reason})${options.comment ? `: ${options.comment}` : ''}.\n\nThis task may need attention or reassignment.\n`;
    const finalContent = updatedContent + closureNote;
    
    fs.writeFileSync(taskPath, finalContent, 'utf8');
    
  } catch (error) {
    console.error(`Failed to update task ${taskId}: ${error}`);
  }
}

async function updateIssueForClose(
  issueId: string,
  prId: string,
  options: CloseOptions,
  configManager: ConfigManager
): Promise<void> {
  try {
    const issuesDir = configManager.getIssuesDirectory();
    const issueFiles = fs.readdirSync(issuesDir).filter(file => file.includes(issueId));
    
    if (issueFiles.length === 0) {
      console.warn(`Issue ${issueId} not found in ${issuesDir}`);
      return;
    }
    
    const issueFile = issueFiles[0];
    const issuePath = path.join(issuesDir, issueFile);
    const issueContent = fs.readFileSync(issuePath, 'utf8');
    
    // Update issue content with closure information
    const updatedContent = issueContent.replace(
      /updated_date:\s*[^\n]+/,
      `updated_date: ${new Date().toISOString()}`
    );
    
    // Add closure note
    const closureNote = `\n\n## PR Closed\n\nPR ${prId} was closed (${options.reason})${options.comment ? `: ${options.comment}` : ''}.\n\nThis issue may need a new PR or different approach.\n`;
    const finalContent = updatedContent + closureNote;
    
    fs.writeFileSync(issuePath, finalContent, 'utf8');
    
  } catch (error) {
    console.error(`Failed to update issue ${issueId}: ${error}`);
  }
}

async function notifyReviewer(reviewer: string, prId: string, options: CloseOptions): Promise<void> {
  // This would send notifications to reviewers
  // Implementation depends on notification system
  console.log(`Notifying ${reviewer} about PR ${prId} closure (${options.reason})`);
}

async function addToClosureReport(
  prData: PRData,
  options: CloseOptions,
  configManager: ConfigManager
): Promise<void> {
  const reportEntry = {
    timestamp: new Date().toISOString(),
    pr_id: prData.pr_id,
    title: prData.title,
    reason: options.reason,
    comment: options.comment,
    author: prData.assignee,
    reviewers: prData.reviewers,
    approvals: prData.approvals
  };
  
  // This would append to a closure report file
  const reportsDir = path.join(configManager.getPRsDirectory(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const reportPath = path.join(reportsDir, 'closure-report.json');
  let reports: any[] = [];
  
  if (fs.existsSync(reportPath)) {
    const reportContent = fs.readFileSync(reportPath, 'utf8');
    reports = JSON.parse(reportContent);
  }
  
  reports.push(reportEntry);
  fs.writeFileSync(reportPath, JSON.stringify(reports, null, 2), 'utf8');
}

async function createClosureActivityLog(
  prData: PRData,
  options: CloseOptions,
  result: CloseResult
): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action: 'closed',
    pr_id: prData.pr_id,
    reason: options.reason,
    comment: options.comment,
    updated_tasks: result.updatedTasks,
    updated_issues: result.updatedIssues,
    archived_files: result.archivedFiles,
    notifications: result.notifications
  };
  
  // This would append to an activity log file
  console.log('Closure activity logged:', JSON.stringify(logEntry, null, 2));
}

async function updatePRWithClosureInfo(
  prData: PRData,
  options: CloseOptions,
  configManager: ConfigManager
): Promise<void> {
  try {
    const prContent = fs.readFileSync(prData.file_path, 'utf8');
    
    // Update PR content with closure information
    const updatedContent = prContent.replace(
      /pr_status:\s*\w+/,
      'pr_status: closed'
    ).replace(
      /updated_date:\s*[^\n]+/,
      `updated_date: ${new Date().toISOString()}`
    );
    
    // Add closure section
    const closureSection = `\n\n## PR Closed\n\n**Reason**: ${options.reason}\n${options.comment ? `**Comment**: ${options.comment}\n` : ''}**Closed**: ${new Date().toISOString()}\n`;
    const finalContent = updatedContent + closureSection;
    
    fs.writeFileSync(prData.file_path, finalContent, 'utf8');
    
  } catch (error) {
    console.error(`Failed to update PR ${prData.pr_id} with closure info: ${error}`);
  }
}

export { closePR, CloseOptions, CloseResult };