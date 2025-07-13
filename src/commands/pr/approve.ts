/**
 * PR Approve Command
 * Approves PRs with validation and automatic status management
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import type { PRData, PRStatus } from '../../types/ai-trackdown.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';

interface ApproveOptions {
  comments?: string;
  autoMerge?: boolean;
  mergeStrategy?: 'merge' | 'squash' | 'rebase';
  reviewer?: string;
  bypassChecks?: boolean;
  dryRun?: boolean;
}

export function createPRApproveCommand(): Command {
  const cmd = new Command('approve');

  cmd
    .description('Approve a PR and update its status')
    .argument('<pr-id>', 'PR ID to approve')
    .option('-c, --comments <text>', 'approval comments')
    .option('-m, --auto-merge', 'automatically merge after approval')
    .option('--merge-strategy <strategy>', 'merge strategy (merge|squash|rebase)', 'merge')
    .option('--reviewer <username>', 'approver username (defaults to current user)')
    .option('--bypass-checks', 'bypass approval requirement checks')
    .option('--dry-run', 'show what would be done without making changes')
    .action(async (prId: string, options: ApproveOptions) => {
      try {
        await approvePR(prId, options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to approve PR: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function approvePR(prId: string, options: ApproveOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();
  const parser = new FrontmatterParser();
  const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);

  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR;

  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);

  // Find the PR
  const prHierarchy = relationshipManager.getPRHierarchy(prId);
  if (!prHierarchy) {
    throw new Error(`PR not found: ${prId}`);
  }

  const pr = prHierarchy.pr;

  // Validate PR can be approved
  if (pr.pr_status === 'merged') {
    throw new Error('Cannot approve a PR that is already merged');
  }

  if (pr.pr_status === 'closed') {
    throw new Error('Cannot approve a PR that is closed');
  }

  // Get approver
  const approver = options.reviewer || config.default_assignee || 'current-user';

  // Check if already approved by this user
  const currentApprovals = pr.approvals || [];
  if (currentApprovals.includes(approver)) {
    console.log(Formatter.warning(`PR ${prId} is already approved by ${approver}`));
    if (!options.bypassChecks) {
      return;
    }
  }

  // Add approver to reviewers if not already present
  const currentReviewers = pr.reviewers || [];
  const updatedReviewers = currentReviewers.includes(approver)
    ? currentReviewers
    : [...currentReviewers, approver];

  // Add approval
  const updatedApprovals = currentApprovals.includes(approver)
    ? currentApprovals
    : [...currentApprovals, approver];

  // Determine new status
  let newStatus: PRStatus = 'review';

  // Check if all reviewers have approved
  const allApproved =
    updatedReviewers.length > 0 && updatedApprovals.length >= updatedReviewers.length;

  if (allApproved || options.bypassChecks) {
    newStatus = 'approved';
  }

  // Auto-merge logic
  const shouldAutoMerge = options.autoMerge && (allApproved || options.bypassChecks);

  if (shouldAutoMerge) {
    newStatus = 'merged';
  }

  // Validate merge strategy
  const validMergeStrategies = ['merge', 'squash', 'rebase'];
  if (options.mergeStrategy && !validMergeStrategies.includes(options.mergeStrategy)) {
    throw new Error(
      `Invalid merge strategy: ${options.mergeStrategy}. Must be one of: ${validMergeStrategies.join(', ')}`
    );
  }

  const now = new Date().toISOString();

  if (options.dryRun) {
    console.log(Formatter.info('Dry run - PR would be approved with:'));
    console.log(Formatter.debug(`PR ID: ${prId}`));
    console.log(Formatter.debug(`Approver: ${approver}`));
    console.log(Formatter.debug(`Current Status: ${pr.pr_status}`));
    console.log(Formatter.debug(`New Status: ${newStatus}`));
    console.log(Formatter.debug(`Current Reviewers: ${currentReviewers.join(', ') || 'none'}`));
    console.log(Formatter.debug(`Updated Reviewers: ${updatedReviewers.join(', ')}`));
    console.log(Formatter.debug(`Current Approvals: ${currentApprovals.join(', ') || 'none'}`));
    console.log(Formatter.debug(`Updated Approvals: ${updatedApprovals.join(', ')}`));
    console.log(Formatter.debug(`All Approved: ${allApproved}`));
    console.log(Formatter.debug(`Auto-merge: ${shouldAutoMerge}`));
    if (options.mergeStrategy) {
      console.log(Formatter.debug(`Merge Strategy: ${options.mergeStrategy}`));
    }
    if (options.comments) {
      console.log(Formatter.debug(`Comments: ${options.comments}`));
    }
    return;
  }

  // Create approval review record
  const reviewsDir = path.join(paths.prsDir, 'reviews');
  if (!fs.existsSync(reviewsDir)) {
    fs.mkdirSync(reviewsDir, { recursive: true });
  }

  const approvalReviewId = `${prId}-approval-${Date.now()}`;
  const approvalContent = `# PR Approval: ${pr.title}

**PR**: ${prId}  
**Approver**: ${approver}  
**Date**: ${now}  
**Status**: ✅ APPROVED

## Approval Comments

${options.comments || 'No additional comments provided.'}

## Approval Details

- **Review Type**: Approval
- **Approver**: ${approver}
- **Auto-merge**: ${shouldAutoMerge ? 'Yes' : 'No'}
${options.mergeStrategy ? `- **Merge Strategy**: ${options.mergeStrategy}` : ''}

## Approval Checklist

- [x] Code quality meets standards
- [x] Functionality works as expected
- [x] Tests pass (if applicable)
- [x] Documentation updated (if applicable)
- [x] No security concerns identified
- [x] Performance impact acceptable

## Decision

✅ **APPROVED** - This PR is ready to merge.

${shouldAutoMerge ? '🚀 **AUTO-MERGE ENABLED** - PR will be automatically merged.' : ''}
`;

  const approvalFrontmatter = {
    review_id: approvalReviewId,
    pr_id: prId,
    reviewer: approver,
    review_type: 'approve',
    created_date: now,
    updated_date: now,
    status: 'submitted',
    comments: options.comments,
    auto_merge: shouldAutoMerge,
    merge_strategy: options.mergeStrategy,
  };

  // Write approval review
  const approvalFilePath = path.join(reviewsDir, `${approvalReviewId}.md`);
  parser.writeFile(approvalFilePath, approvalFrontmatter, approvalContent);

  // Update PR with approval information
  const prUpdates: Partial<PRData> = {
    reviewers: updatedReviewers,
    approvals: updatedApprovals,
    pr_status: newStatus,
    updated_date: now,
  };

  // Add merge information if auto-merging
  if (shouldAutoMerge) {
    prUpdates.merge_commit = `auto-merge-${Date.now()}`;
  }

  parser.updateFile(pr.file_path, prUpdates);

  // Handle status-based file movement
  if (newStatus !== pr.pr_status) {
    await handleStatusTransition(pr, newStatus, paths);
  }

  // Update linked tasks if merged
  if (shouldAutoMerge && prHierarchy.issue) {
    await updateLinkedTasks(prHierarchy.issue, relationshipManager, parser);
  }

  // Refresh cache
  relationshipManager.rebuildCache();

  console.log(Formatter.success(`PR approved successfully!`));
  console.log(Formatter.info(`PR: ${prId} - ${pr.title}`));
  console.log(Formatter.info(`Approver: ${approver}`));
  console.log(Formatter.info(`Status: ${pr.pr_status} → ${newStatus}`));
  console.log(Formatter.info(`Approval File: ${approvalFilePath}`));

  if (options.comments) {
    console.log(Formatter.info(`Comments: ${options.comments}`));
  }

  console.log('');
  console.log(Formatter.info(`📊 Approval Status:`));
  console.log(Formatter.info(`   Reviewers: ${updatedReviewers.join(', ')}`));
  console.log(
    Formatter.info(`   Approvals: ${updatedApprovals.length}/${updatedReviewers.length}`)
  );
  console.log(Formatter.info(`   All Approved: ${allApproved ? '✅' : '❌'}`));

  if (shouldAutoMerge) {
    console.log('');
    console.log(Formatter.success('🚀 PR automatically merged!'));
    console.log(Formatter.info(`Merge Strategy: ${options.mergeStrategy || 'merge'}`));
    console.log(Formatter.info('Linked tasks updated if applicable'));
  } else if (newStatus === 'approved') {
    console.log('');
    console.log(Formatter.success('✅ PR is now approved and ready to merge!'));
    console.log(Formatter.info('Use `aitrackdown pr merge` to merge the PR'));
  } else {
    console.log('');
    console.log(Formatter.warning('⚠️  PR approved but waiting for additional reviewers'));
    console.log(
      Formatter.info(`Need ${updatedReviewers.length - updatedApprovals.length} more approvals`)
    );
  }
}

async function handleStatusTransition(pr: PRData, newStatus: PRStatus, paths: any): Promise<void> {
  // Define status-based directories
  const statusDirs = {
    draft: path.join(paths.prsDir, 'draft'),
    open: path.join(paths.prsDir, 'active'),
    review: path.join(paths.prsDir, 'active'),
    approved: path.join(paths.prsDir, 'active'),
    merged: path.join(paths.prsDir, 'merged'),
    closed: path.join(paths.prsDir, 'closed'),
  };

  // Get current and target directories
  const currentDir = path.dirname(pr.file_path);
  const targetDir = statusDirs[newStatus];

  // Only move if different directory
  if (currentDir !== targetDir) {
    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Generate new file path
    const fileName = path.basename(pr.file_path);
    const newFilePath = path.join(targetDir, fileName);

    // Move the file
    fs.renameSync(pr.file_path, newFilePath);

    console.log(Formatter.info(`Moved PR file: ${currentDir} → ${targetDir}`));
  }
}

async function updateLinkedTasks(
  issue: any,
  relationshipManager: RelationshipManager,
  parser: FrontmatterParser
): Promise<void> {
  try {
    // Get all tasks linked to the issue
    const issueHierarchy = relationshipManager.getIssueHierarchy(issue.issue_id);
    if (!issueHierarchy) {
      return;
    }

    const tasks = issueHierarchy.tasks;
    const now = new Date().toISOString();

    // Update completed tasks to mark PR as merged
    for (const task of tasks) {
      if (task.status === 'completed') {
        const taskUpdates = {
          updated_date: now,
          sync_status: 'synced' as const,
        };

        parser.updateFile(task.file_path, taskUpdates);
      }
    }

    console.log(Formatter.info(`Updated ${tasks.length} linked tasks`));
  } catch (error) {
    console.warn(
      Formatter.warning(
        `Failed to update linked tasks: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    );
  }
}
