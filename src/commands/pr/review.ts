/**
 * PR Review Command
 * Creates and manages PR reviews with structured feedback
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigManager } from '../../utils/config-manager.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';
import type { PRData, PRStatus } from '../../types/ai-trackdown.js';
import { Formatter } from '../../utils/formatter.js';

interface ReviewOptions {
  comments?: string;
  approve?: boolean;
  requestChanges?: boolean;
  status?: PRStatus;
  reviewer?: string;
  template?: string;
  addReviewer?: string;
  removeReviewer?: string;
  dryRun?: boolean;
}

interface ReviewFrontmatter {
  review_id: string;
  pr_id: string;
  reviewer: string;
  review_type: 'approve' | 'request_changes' | 'comment';
  created_date: string;
  updated_date: string;
  status: 'pending' | 'submitted' | 'dismissed';
  comments?: string;
}

export function createPRReviewCommand(): Command {
  const cmd = new Command('review');
  
  cmd
    .description('Create or update a PR review')
    .argument('<pr-id>', 'PR ID to review')
    .option('-c, --comments <text>', 'review comments')
    .option('-a, --approve', 'approve the PR')
    .option('-r, --request-changes', 'request changes to the PR')
    .option('-s, --status <status>', 'update PR status (draft|open|review|approved|merged|closed)')
    .option('--reviewer <username>', 'reviewer username (defaults to current user)')
    .option('-t, --template <name>', 'review template to use')
    .option('--add-reviewer <username>', 'add a reviewer to the PR')
    .option('--remove-reviewer <username>', 'remove a reviewer from the PR')
    .option('--dry-run', 'show what would be done without making changes')
    .action(async (prId: string, options: ReviewOptions) => {
      try {
        await reviewPR(prId, options);
      } catch (error) {
        console.error(Formatter.error(`Failed to review PR: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}

async function reviewPR(prId: string, options: ReviewOptions): Promise<void> {
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
  
  // Validate review options
  if (options.approve && options.requestChanges) {
    throw new Error('Cannot both approve and request changes in the same review');
  }
  
  // Determine review type
  let reviewType: 'approve' | 'request_changes' | 'comment' = 'comment';
  if (options.approve) {
    reviewType = 'approve';
  } else if (options.requestChanges) {
    reviewType = 'request_changes';
  }
  
  // Get reviewer
  const reviewer = options.reviewer || config.default_assignee || 'current-user';
  
  // Create review ID
  const reviewId = `${prId}-review-${Date.now()}`;
  
  // Get review template if specified
  let reviewTemplate = '';
  if (options.template) {
    const template = configManager.getTemplate('pr-review', options.template);
    if (template) {
      reviewTemplate = template.content_template || '';
    }
  }
  
  // Create review frontmatter
  const now = new Date().toISOString();
  const reviewFrontmatter: ReviewFrontmatter = {
    review_id: reviewId,
    pr_id: prId,
    reviewer,
    review_type: reviewType,
    created_date: now,
    updated_date: now,
    status: 'submitted',
    comments: options.comments
  };
  
  // Generate review content
  const reviewContent = `# PR Review: ${pr.title}

**PR**: ${prId}  
**Reviewer**: ${reviewer}  
**Review Type**: ${reviewType.toUpperCase()}  
**Date**: ${now}

## Review Comments

${options.comments || ''}

${reviewTemplate}

## Files Reviewed

- Review pending

## Review Checklist

- [ ] Code quality and standards
- [ ] Functionality and logic
- [ ] Test coverage
- [ ] Documentation
- [ ] Performance considerations
- [ ] Security considerations

## Decision

${reviewType === 'approve' ? '✅ **APPROVED** - Ready to merge' : ''}
${reviewType === 'request_changes' ? '❌ **CHANGES REQUESTED** - Please address comments' : ''}
${reviewType === 'comment' ? '💬 **COMMENTED** - General feedback provided' : ''}
`;
  
  // Handle reviewer management
  let updatedReviewers = [...(pr.reviewers || [])];
  
  if (options.addReviewer) {
    if (!updatedReviewers.includes(options.addReviewer)) {
      updatedReviewers.push(options.addReviewer);
    }
  }
  
  if (options.removeReviewer) {
    updatedReviewers = updatedReviewers.filter(r => r !== options.removeReviewer);
  }
  
  // Add current reviewer if not already present
  if (!updatedReviewers.includes(reviewer)) {
    updatedReviewers.push(reviewer);
  }
  
  // Handle approvals
  let updatedApprovals = [...(pr.approvals || [])];
  if (reviewType === 'approve' && !updatedApprovals.includes(reviewer)) {
    updatedApprovals.push(reviewer);
  } else if (reviewType === 'request_changes') {
    // Remove approval if requesting changes
    updatedApprovals = updatedApprovals.filter(a => a !== reviewer);
  }
  
  // Determine new PR status
  let newPRStatus = pr.pr_status;
  if (options.status) {
    newPRStatus = options.status;
  } else if (reviewType === 'approve') {
    // Auto-transition to approved if all reviewers have approved
    if (updatedReviewers.length > 0 && updatedApprovals.length >= updatedReviewers.length) {
      newPRStatus = 'approved';
    } else if (pr.pr_status === 'draft' || pr.pr_status === 'open') {
      newPRStatus = 'review';
    }
  } else if (reviewType === 'request_changes') {
    newPRStatus = 'open'; // Back to open for changes
  }
  
  if (options.dryRun) {
    console.log(Formatter.info('Dry run - Review would be created with:'));
    console.log(Formatter.debug(`PR ID: ${prId}`));
    console.log(Formatter.debug(`Review ID: ${reviewId}`));
    console.log(Formatter.debug(`Reviewer: ${reviewer}`));
    console.log(Formatter.debug(`Review Type: ${reviewType}`));
    console.log(Formatter.debug(`Current PR Status: ${pr.pr_status}`));
    console.log(Formatter.debug(`New PR Status: ${newPRStatus}`));
    console.log(Formatter.debug(`Reviewers: ${updatedReviewers.join(', ')}`));
    console.log(Formatter.debug(`Approvals: ${updatedApprovals.join(', ')}`));
    if (options.comments) {
      console.log(Formatter.debug(`Comments: ${options.comments}`));
    }
    return;
  }
  
  // Create reviews directory if it doesn't exist
  const reviewsDir = path.join(paths.prsDir, 'reviews');
  if (!fs.existsSync(reviewsDir)) {
    fs.mkdirSync(reviewsDir, { recursive: true });
  }
  
  // Write review file
  const reviewFileName = `${reviewId}.md`;
  const reviewFilePath = path.join(reviewsDir, reviewFileName);
  parser.writeFile(reviewFilePath, reviewFrontmatter, reviewContent);
  
  // Update PR with review information
  const prUpdates: Partial<PRData> = {
    reviewers: updatedReviewers.length > 0 ? updatedReviewers : undefined,
    approvals: updatedApprovals.length > 0 ? updatedApprovals : undefined,
    pr_status: newPRStatus,
    updated_date: now
  };
  
  parser.updateFile(pr.file_path, prUpdates);
  
  // Handle status-based file movement if status changed
  if (newPRStatus !== pr.pr_status) {
    await handleStatusTransition(pr, newPRStatus, paths, configManager);
  }
  
  // Refresh cache
  relationshipManager.rebuildCache();
  
  console.log(Formatter.success(`PR review created successfully!`));
  console.log(Formatter.info(`Review ID: ${reviewId}`));
  console.log(Formatter.info(`PR: ${prId} - ${pr.title}`));
  console.log(Formatter.info(`Reviewer: ${reviewer}`));
  console.log(Formatter.info(`Review Type: ${reviewType.toUpperCase()}`));
  console.log(Formatter.info(`Review File: ${reviewFilePath}`));
  
  if (newPRStatus !== pr.pr_status) {
    console.log(Formatter.info(`PR Status Changed: ${pr.pr_status} → ${newPRStatus}`));
  }
  
  console.log(Formatter.info(`Reviewers: ${updatedReviewers.join(', ')}`));
  console.log(Formatter.info(`Approvals: ${updatedApprovals.length}/${updatedReviewers.length}`));
  
  if (options.comments) {
    console.log(Formatter.info(`Comments: ${options.comments}`));
  }
  
  // Show next steps
  if (reviewType === 'approve' && newPRStatus === 'approved') {
    console.log('');
    console.log(Formatter.success('✅ PR is now approved and ready to merge!'));
    console.log(Formatter.info('Use `aitrackdown pr merge` to merge the PR'));
  } else if (reviewType === 'request_changes') {
    console.log('');
    console.log(Formatter.warning('⚠️  Changes requested - PR returned to open status'));
    console.log(Formatter.info('Author should address comments and update the PR'));
  }
}

async function handleStatusTransition(
  pr: PRData,
  newStatus: PRStatus,
  paths: any,
  configManager: ConfigManager
): Promise<void> {
  const parser = new FrontmatterParser();
  
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