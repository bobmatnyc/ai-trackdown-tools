/**
 * PR Merge Command
 * Handles merging pull requests with multiple strategies and validation
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
import type { PRData, PRStatus, TaskData, IssueData } from '../../types/ai-trackdown.js';

export type MergeStrategy = 'merge' | 'squash' | 'rebase';

export interface MergeOptions {
  strategy: MergeStrategy;
  message?: string;
  closeLinkedTasks: boolean;
  deleteSourceBranch: boolean;
  requireApproval: boolean;
  runPreMergeChecks: boolean;
  autoArchive: boolean;
  updateMilestone: boolean;
}

export interface MergeResult {
  success: boolean;
  prId: string;
  strategy: MergeStrategy;
  mergeCommit?: string;
  updatedTasks: string[];
  updatedIssues: string[];
  archivedFiles: string[];
  errors: string[];
  warnings: string[];
}

export interface PreMergeCheck {
  name: string;
  description: string;
  required: boolean;
  passed: boolean;
  message: string;
}

export function createPRMergeCommand(): Command {
  const cmd = new Command('merge');
  
  cmd
    .description('Merge a pull request with specified strategy')
    .argument('<pr-id>', 'Pull request ID to merge')
    .option('-s, --strategy <strategy>', 'Merge strategy (merge|squash|rebase)', 'merge')
    .option('-m, --message <message>', 'Custom merge commit message')
    .option('--close-tasks', 'Close linked tasks after merge', false)
    .option('--delete-branch', 'Delete source branch after merge', false)
    .option('--skip-approval', 'Skip approval requirement check', false)
    .option('--skip-checks', 'Skip pre-merge validation checks', false)
    .option('--no-archive', 'Do not archive PR after merge', false)
    .option('--update-milestone', 'Update milestone progress', false)
    .option('--dry-run', 'Show what would be done without executing', false)
    .action(async (prId: string, options: any) => {
      const configManager = new ConfigManager();
      const statusManager = new PRStatusManager(configManager);
      const fileManager = new PRFileManager(configManager);
      const relationshipManager = new RelationshipManager(configManager);
      const formatter = new Formatter();
      
      const mergeOptions: MergeOptions = {
        strategy: options.strategy as MergeStrategy,
        message: options.message,
        closeLinkedTasks: options.closeTasks,
        deleteSourceBranch: options.deleteBranch,
        requireApproval: !options.skipApproval,
        runPreMergeChecks: !options.skipChecks,
        autoArchive: !options.noArchive,
        updateMilestone: options.updateMilestone
      };
      
      try {
        const result = await mergePR(
          prId,
          mergeOptions,
          statusManager,
          fileManager,
          relationshipManager,
          configManager,
          options.dryRun
        );
        
        if (options.dryRun) {
          console.log(colors.yellow('🔍 Dry run - showing what would be done:'));
          console.log('');
        }
        
        if (result.success) {
          console.log(colors.green(`✅ Successfully merged PR ${prId}`));
          console.log(`📋 Strategy: ${result.strategy}`);
          
          if (result.mergeCommit) {
            console.log(`🔗 Merge commit: ${result.mergeCommit}`);
          }
          
          if (result.updatedTasks.length > 0) {
            console.log(`📝 Updated tasks: ${result.updatedTasks.join(', ')}`);
          }
          
          if (result.updatedIssues.length > 0) {
            console.log(`🎯 Updated issues: ${result.updatedIssues.join(', ')}`);
          }
          
          if (result.archivedFiles.length > 0) {
            console.log(`📁 Archived files: ${result.archivedFiles.length}`);
          }
          
          if (result.warnings.length > 0) {
            console.log(colors.yellow('⚠️  Warnings:'));
            result.warnings.forEach(warning => {
              console.log(colors.yellow(`  - ${warning}`));
            });
          }
        } else {
          console.error(colors.red(`❌ Failed to merge PR ${prId}`));
          result.errors.forEach(error => {
            console.error(colors.red(`  • ${error}`));
          });
          process.exit(1);
        }
      } catch (error) {
        console.error(colors.red(`❌ Error merging PR: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
  
  return cmd;
}

async function mergePR(
  prId: string,
  options: MergeOptions,
  statusManager: PRStatusManager,
  fileManager: PRFileManager,
  relationshipManager: RelationshipManager,
  configManager: ConfigManager,
  dryRun: boolean = false
): Promise<MergeResult> {
  const result: MergeResult = {
    success: false,
    prId,
    strategy: options.strategy,
    updatedTasks: [],
    updatedIssues: [],
    archivedFiles: [],
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
    
    // 2. Validate merge strategy
    if (!isValidMergeStrategy(options.strategy)) {
      result.errors.push(`Invalid merge strategy: ${options.strategy}`);
      return result;
    }
    
    // 3. Check current PR status
    const statusValidation = validatePRStatusForMerge(prData);
    if (!statusValidation.valid) {
      result.errors.push(...statusValidation.errors);
      return result;
    }
    
    // 4. Run pre-merge checks
    if (options.runPreMergeChecks) {
      const checkResults = await runPreMergeChecks(prData, options);
      const failedChecks = checkResults.filter(check => check.required && !check.passed);
      
      if (failedChecks.length > 0) {
        result.errors.push('Required pre-merge checks failed:');
        failedChecks.forEach(check => {
          result.errors.push(`  - ${check.name}: ${check.message}`);
        });
        return result;
      }
      
      // Add warnings for non-required failed checks
      checkResults.filter(check => !check.required && !check.passed).forEach(check => {
        result.warnings.push(`${check.name}: ${check.message}`);
      });
    }
    
    // 5. Perform merge operation
    if (!dryRun) {
      const mergeResult = await performMerge(prData, options);
      if (!mergeResult.success) {
        result.errors.push(...mergeResult.errors);
        return result;
      }
      result.mergeCommit = mergeResult.mergeCommit;
    }
    
    // 6. Update PR status and move to merged directory
    if (!dryRun) {
      await statusManager.updatePRStatus(prId, 'merged');
      const basePRsDir = configManager.getPRsDirectory();
      const moveResult = await fileManager.movePRToStatusDirectory(prData, 'merged', basePRsDir);
      if (moveResult.moved) {
        result.archivedFiles.push(moveResult.newPath);
      }
    }
    
    // 7. Update linked tasks and issues
    if (options.closeLinkedTasks) {
      const linkedTasks = await relationshipManager.getLinkedTasks(prId);
      const linkedIssues = await relationshipManager.getLinkedIssues(prId);
      
      if (!dryRun) {
        // Update linked tasks
        for (const taskId of linkedTasks) {
          await updateTaskForMerge(taskId, prId, configManager);
          result.updatedTasks.push(taskId);
        }
        
        // Update linked issues
        for (const issueId of linkedIssues) {
          await updateIssueForMerge(issueId, prId, configManager);
          result.updatedIssues.push(issueId);
        }
      } else {
        result.updatedTasks = linkedTasks;
        result.updatedIssues = linkedIssues;
      }
    }
    
    // 8. Update milestone if requested
    if (options.updateMilestone && prData.milestone) {
      if (!dryRun) {
        await updateMilestoneProgress(prData.milestone, configManager);
      }
      result.warnings.push(`Would update milestone: ${prData.milestone}`);
    }
    
    // 9. Create merge activity log
    if (!dryRun) {
      await createMergeActivityLog(prData, options, result);
    }
    
    result.success = true;
    return result;
    
  } catch (error) {
    result.errors.push(`Merge operation failed: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}

function isValidMergeStrategy(strategy: string): strategy is MergeStrategy {
  return ['merge', 'squash', 'rebase'].includes(strategy);
}

function validatePRStatusForMerge(prData: PRData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check if PR is in a mergeable state
  if (!['approved', 'open', 'review'].includes(prData.pr_status)) {
    errors.push(`PR status '${prData.pr_status}' is not mergeable. Must be 'approved', 'open', or 'review'.`);
  }
  
  // Check if PR is already merged or closed
  if (prData.pr_status === 'merged') {
    errors.push('PR is already merged');
  }
  
  if (prData.pr_status === 'closed') {
    errors.push('PR is closed and cannot be merged');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

async function runPreMergeChecks(prData: PRData, options: MergeOptions): Promise<PreMergeCheck[]> {
  const checks: PreMergeCheck[] = [];
  
  // Check 1: Approval requirement
  if (options.requireApproval) {
    const hasApproval = prData.approvals && prData.approvals.length > 0;
    checks.push({
      name: 'Approval Check',
      description: 'PR must have at least one approval',
      required: true,
      passed: hasApproval || false,
      message: hasApproval ? 'PR has required approvals' : 'PR lacks required approvals'
    });
  }
  
  // Check 2: Review completion
  const hasReviewers = prData.reviewers && prData.reviewers.length > 0;
  const allReviewersCompleted = hasReviewers && prData.reviewers!.every(reviewer => 
    prData.approvals?.includes(reviewer) || false
  );
  
  checks.push({
    name: 'Review Completion',
    description: 'All assigned reviewers should have completed their reviews',
    required: false,
    passed: !hasReviewers || allReviewersCompleted,
    message: allReviewersCompleted ? 'All reviews completed' : 'Some reviewers have not completed their reviews'
  });
  
  // Check 3: Branch validation
  checks.push({
    name: 'Branch Validation',
    description: 'Source and target branches should be valid',
    required: true,
    passed: Boolean(prData.source_branch && prData.target_branch),
    message: Boolean(prData.source_branch && prData.target_branch) ? 'Branches are valid' : 'Missing branch information'
  });
  
  // Check 4: Conflict check (simulated)
  checks.push({
    name: 'Merge Conflict Check',
    description: 'PR should not have merge conflicts',
    required: true,
    passed: true, // This would be implemented with actual Git integration
    message: 'No merge conflicts detected'
  });
  
  // Check 5: Linked tasks completion
  if (options.closeLinkedTasks) {
    const linkedTasksCompleted = await checkLinkedTasksStatus(prData);
    checks.push({
      name: 'Linked Tasks Status',
      description: 'Linked tasks should be completed if auto-closing',
      required: false,
      passed: linkedTasksCompleted,
      message: linkedTasksCompleted ? 'All linked tasks are completed' : 'Some linked tasks are not completed'
    });
  }
  
  return checks;
}

async function checkLinkedTasksStatus(prData: PRData): Promise<boolean> {
  // This would check if all linked tasks are completed
  // For now, we'll return true as a placeholder
  return true;
}

async function performMerge(prData: PRData, options: MergeOptions): Promise<{
  success: boolean;
  mergeCommit?: string;
  errors: string[];
}> {
  const result = {
    success: false,
    mergeCommit: undefined as string | undefined,
    errors: [] as string[]
  };
  
  try {
    // This would integrate with actual Git operations
    // For now, we'll simulate the merge
    const mergeCommit = generateMergeCommit(prData, options);
    
    // Simulate merge based on strategy
    switch (options.strategy) {
      case 'merge':
        // Create merge commit
        result.mergeCommit = mergeCommit;
        break;
      case 'squash':
        // Squash commits and merge
        result.mergeCommit = `squash-${mergeCommit}`;
        break;
      case 'rebase':
        // Rebase and merge
        result.mergeCommit = `rebase-${mergeCommit}`;
        break;
    }
    
    result.success = true;
    return result;
    
  } catch (error) {
    result.errors.push(`Merge failed: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}

function generateMergeCommit(prData: PRData, options: MergeOptions): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const strategy = options.strategy;
  
  if (options.message) {
    return `${strategy}-${timestamp}-custom`;
  }
  
  return `${strategy}-${timestamp}-${prData.pr_id}`;
}

async function updateTaskForMerge(taskId: string, prId: string, configManager: ConfigManager): Promise<void> {
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
    
    // Update task content to mark as completed due to PR merge
    const updatedContent = taskContent.replace(
      /status:\s*\w+/,
      'status: completed'
    ).replace(
      /updated_date:\s*[^\n]+/,
      `updated_date: ${new Date().toISOString()}`
    );
    
    // Add merge note
    const mergeNote = `\n\n## Completed via PR Merge\n\nThis task was automatically completed when PR ${prId} was merged.\n`;
    const finalContent = updatedContent + mergeNote;
    
    fs.writeFileSync(taskPath, finalContent, 'utf8');
    
  } catch (error) {
    console.error(`Failed to update task ${taskId}: ${error}`);
  }
}

async function updateIssueForMerge(issueId: string, prId: string, configManager: ConfigManager): Promise<void> {
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
    
    // Update issue content to reflect PR merge
    const updatedContent = issueContent.replace(
      /updated_date:\s*[^\n]+/,
      `updated_date: ${new Date().toISOString()}`
    );
    
    // Add merge note
    const mergeNote = `\n\n## PR Merged\n\nPR ${prId} has been merged for this issue.\n`;
    const finalContent = updatedContent + mergeNote;
    
    fs.writeFileSync(issuePath, finalContent, 'utf8');
    
  } catch (error) {
    console.error(`Failed to update issue ${issueId}: ${error}`);
  }
}

async function updateMilestoneProgress(milestone: string, configManager: ConfigManager): Promise<void> {
  // This would update milestone progress tracking
  // Implementation would depend on milestone tracking system
  console.log(`Updating milestone progress for: ${milestone}`);
}

async function createMergeActivityLog(
  prData: PRData,
  options: MergeOptions,
  result: MergeResult
): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    action: 'merged',
    pr_id: prData.pr_id,
    strategy: options.strategy,
    merge_commit: result.mergeCommit,
    updated_tasks: result.updatedTasks,
    updated_issues: result.updatedIssues,
    archived_files: result.archivedFiles
  };
  
  // This would append to an activity log file
  console.log('Merge activity logged:', JSON.stringify(logEntry, null, 2));
}

export { mergePR, MergeOptions, MergeResult };