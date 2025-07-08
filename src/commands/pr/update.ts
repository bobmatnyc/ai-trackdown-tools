/**
 * PR Update Command
 * Updates PR status, metadata, and handles state transitions
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from '../../utils/config-manager.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';
import type { PRData, PRStatus, Priority } from '../../types/ai-trackdown.js';
import { Formatter } from '../../utils/formatter.js';

interface UpdateOptions {
  status?: PRStatus;
  priority?: Priority;
  assignee?: string;
  title?: string;
  description?: string;
  branchName?: string;
  sourceBranch?: string;
  targetBranch?: string;
  repositoryUrl?: string;
  addReviewer?: string;
  removeReviewer?: string;
  addTag?: string;
  removeTag?: string;
  addDependency?: string;
  removeDependency?: string;
  milestone?: string;
  estimatedTokens?: number;
  dryRun?: boolean;
}

export function createPRUpdateCommand(): Command {
  const cmd = new Command('update');
  
  cmd
    .description('Update PR status, metadata, and properties')
    .argument('<pr-id>', 'PR ID to update')
    .option('-s, --status <status>', 'update PR status (draft|open|review|approved|merged|closed)')
    .option('-p, --priority <priority>', 'update priority (low|medium|high|critical)')
    .option('-a, --assignee <username>', 'update assignee')
    .option('-t, --title <title>', 'update title')
    .option('-d, --description <text>', 'update description')
    .option('--branch-name <name>', 'update branch name')
    .option('--source-branch <name>', 'update source branch')
    .option('--target-branch <name>', 'update target branch')
    .option('--repository-url <url>', 'update repository URL')
    .option('--add-reviewer <username>', 'add a reviewer')
    .option('--remove-reviewer <username>', 'remove a reviewer')
    .option('--add-tag <tag>', 'add a tag')
    .option('--remove-tag <tag>', 'remove a tag')
    .option('--add-dependency <id>', 'add a dependency')
    .option('--remove-dependency <id>', 'remove a dependency')
    .option('--milestone <milestone>', 'update milestone')
    .option('--estimated-tokens <number>', 'update estimated tokens')
    .option('--dry-run', 'show what would be updated without making changes')
    .action(async (prId: string, options: UpdateOptions) => {
      try {
        await updatePR(prId, options);
      } catch (error) {
        console.error(Formatter.error(`Failed to update PR: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}

async function updatePR(prId: string, options: UpdateOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();
  const parser = new FrontmatterParser();
  const relationshipManager = new RelationshipManager(config);
  
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
  const originalStatus = pr.pr_status;
  
  // Validate status transition if status is being updated
  if (options.status && !isValidStatusTransition(originalStatus, options.status)) {
    throw new Error(`Invalid status transition: ${originalStatus} → ${options.status}`);
  }
  
  // Validate priority
  if (options.priority && !['low', 'medium', 'high', 'critical'].includes(options.priority)) {
    throw new Error(`Invalid priority: ${options.priority}. Must be one of: low, medium, high, critical`);
  }
  
  // Validate PR status
  if (options.status && !['draft', 'open', 'review', 'approved', 'merged', 'closed'].includes(options.status)) {
    throw new Error(`Invalid PR status: ${options.status}. Must be one of: draft, open, review, approved, merged, closed`);
  }
  
  // Handle reviewer updates
  let updatedReviewers = [...(pr.reviewers || [])];
  if (options.addReviewer) {
    if (!updatedReviewers.includes(options.addReviewer)) {
      updatedReviewers.push(options.addReviewer);
    }
  }
  if (options.removeReviewer) {
    updatedReviewers = updatedReviewers.filter(r => r !== options.removeReviewer);
  }
  
  // Handle tag updates
  let updatedTags = [...(pr.tags || [])];
  if (options.addTag) {
    if (!updatedTags.includes(options.addTag)) {
      updatedTags.push(options.addTag);
    }
  }
  if (options.removeTag) {
    updatedTags = updatedTags.filter(t => t !== options.removeTag);
  }
  
  // Handle dependency updates
  let updatedDependencies = [...(pr.dependencies || [])];
  if (options.addDependency) {
    if (!updatedDependencies.includes(options.addDependency)) {
      updatedDependencies.push(options.addDependency);
    }
  }
  if (options.removeDependency) {
    updatedDependencies = updatedDependencies.filter(d => d !== options.removeDependency);
  }
  
  // Handle approvals - clear if moving back to draft or open
  let updatedApprovals = [...(pr.approvals || [])];
  if (options.status && (options.status === 'draft' || options.status === 'open')) {
    updatedApprovals = [];
  }
  
  const now = new Date().toISOString();
  
  // Build update object
  const updates: Partial<PRData> = {
    updated_date: now
  };
  
  // Add all specified updates
  if (options.status) updates.pr_status = options.status;
  if (options.priority) updates.priority = options.priority;
  if (options.assignee) updates.assignee = options.assignee;
  if (options.title) updates.title = options.title;
  if (options.description) updates.description = options.description;
  if (options.branchName) updates.branch_name = options.branchName;
  if (options.sourceBranch) updates.source_branch = options.sourceBranch;
  if (options.targetBranch) updates.target_branch = options.targetBranch;
  if (options.repositoryUrl) updates.repository_url = options.repositoryUrl;
  if (options.milestone) updates.milestone = options.milestone;
  if (options.estimatedTokens !== undefined) updates.estimated_tokens = options.estimatedTokens;
  
  // Update arrays only if they changed
  if (options.addReviewer || options.removeReviewer) {
    updates.reviewers = updatedReviewers.length > 0 ? updatedReviewers : undefined;
  }
  if (options.addTag || options.removeTag) {
    updates.tags = updatedTags.length > 0 ? updatedTags : undefined;
  }
  if (options.addDependency || options.removeDependency) {
    updates.dependencies = updatedDependencies.length > 0 ? updatedDependencies : undefined;
  }
  if (options.status && (options.status === 'draft' || options.status === 'open')) {
    updates.approvals = updatedApprovals.length > 0 ? updatedApprovals : undefined;
  }
  
  if (options.dryRun) {
    console.log(Formatter.info('Dry run - PR would be updated with:'));
    console.log(Formatter.debug(`PR ID: ${prId}`));
    console.log(Formatter.debug(`Current Title: ${pr.title}`));
    console.log(Formatter.debug(`Current Status: ${pr.pr_status}`));
    console.log(Formatter.debug(`Current Priority: ${pr.priority}`));
    console.log(Formatter.debug(`Current Assignee: ${pr.assignee}`));
    
    console.log('');
    console.log(Formatter.info('Proposed Changes:'));
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'updated_date') {
        console.log(Formatter.debug(`  ${key}: ${JSON.stringify(value)}`));
      }
    });
    
    if (options.status && options.status !== originalStatus) {
      console.log(Formatter.debug(`Status Change: ${originalStatus} → ${options.status}`));
    }
    
    return;
  }
  
  // Check if there are any actual changes
  const hasChanges = Object.keys(updates).length > 1; // More than just updated_date
  if (!hasChanges) {
    console.log(Formatter.warning('No changes specified. Use --help to see available options.'));
    return;
  }
  
  // Apply updates
  parser.updateFile(pr.file_path, updates);
  
  // Handle status-based file movement if status changed
  if (options.status && options.status !== originalStatus) {
    await handleStatusTransition(pr, options.status, paths);
  }
  
  // Create update log entry
  const updateLogEntry = {
    timestamp: now,
    pr_id: prId,
    changes: updates,
    previous_status: originalStatus,
    new_status: options.status || originalStatus
  };
  
  // Log the update
  await logPRUpdate(updateLogEntry, paths);
  
  // Refresh cache
  relationshipManager.rebuildCache();
  
  console.log(Formatter.success(`PR updated successfully!`));
  console.log(Formatter.info(`PR: ${prId} - ${updates.title || pr.title}`));
  console.log(Formatter.info(`File: ${pr.file_path}`));
  
  if (options.status && options.status !== originalStatus) {
    console.log(Formatter.info(`Status: ${originalStatus} → ${options.status}`));
  }
  
  // Show key changes
  console.log('');
  console.log(Formatter.info('Updated Fields:'));
  Object.entries(updates).forEach(([key, value]) => {
    if (key !== 'updated_date') {
      console.log(Formatter.info(`  ${key}: ${JSON.stringify(value)}`));
    }
  });
  
  // Show status-specific information
  if (options.status) {
    console.log('');
    switch (options.status) {
      case 'draft':
        console.log(Formatter.info('📝 PR is now in draft status'));
        console.log(Formatter.info('Use `aitrackdown pr update --status open` when ready for review'));
        break;
      case 'open':
        console.log(Formatter.info('🔓 PR is now open for review'));
        console.log(Formatter.info('Use `aitrackdown pr review` to add reviews'));
        break;
      case 'review':
        console.log(Formatter.info('👀 PR is under review'));
        console.log(Formatter.info('Use `aitrackdown pr approve` to approve'));
        break;
      case 'approved':
        console.log(Formatter.info('✅ PR is approved'));
        console.log(Formatter.info('Use `aitrackdown pr merge` to merge'));
        break;
      case 'merged':
        console.log(Formatter.success('🎉 PR is merged'));
        console.log(Formatter.info('Linked tasks updated if applicable'));
        break;
      case 'closed':
        console.log(Formatter.info('🔒 PR is closed'));
        console.log(Formatter.info('Use `aitrackdown pr update --status open` to reopen'));
        break;
    }
  }
}

function isValidStatusTransition(currentStatus: PRStatus, newStatus: PRStatus): boolean {
  // Define valid status transitions
  const validTransitions: Record<PRStatus, PRStatus[]> = {
    draft: ['open', 'closed'],
    open: ['draft', 'review', 'approved', 'merged', 'closed'],
    review: ['open', 'approved', 'closed'],
    approved: ['review', 'merged', 'closed'],
    merged: [], // Merged PRs cannot transition to other states
    closed: ['draft', 'open'] // Closed PRs can be reopened
  };
  
  return validTransitions[currentStatus].includes(newStatus);
}

async function handleStatusTransition(
  pr: PRData,
  newStatus: PRStatus,
  paths: any
): Promise<void> {
  // Define status-based directories
  const statusDirs = {
    draft: path.join(paths.prsDir, 'draft'),
    open: path.join(paths.prsDir, 'active'),
    review: path.join(paths.prsDir, 'active'),
    approved: path.join(paths.prsDir, 'active'),
    merged: path.join(paths.prsDir, 'merged'),
    closed: path.join(paths.prsDir, 'closed')
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

async function logPRUpdate(updateLogEntry: any, paths: any): Promise<void> {
  try {
    const logDir = path.join(paths.prsDir, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, 'pr-updates.log');
    const logLine = JSON.stringify(updateLogEntry) + '\n';
    
    fs.appendFileSync(logFile, logLine);
  } catch (error) {
    console.warn(Formatter.warning(`Failed to log update: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }
}