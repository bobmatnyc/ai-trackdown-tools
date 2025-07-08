/**
 * PR Status Manager
 * Handles PR status transitions, validation, and file organization
 */

import * as path from 'path';
import * as fs from 'fs';
import type { PRData, PRStatus } from '../types/ai-trackdown.js';
import { ConfigManager } from './config-manager.js';
import { Formatter } from './formatter.js';

export class PRStatusManager {
  private configManager: ConfigManager;
  
  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }
  
  /**
   * Validates if a status transition is allowed
   */
  isValidStatusTransition(currentStatus: PRStatus, newStatus: PRStatus): boolean {
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
  
  /**
   * Gets the directory path for a given PR status
   */
  getStatusDirectory(status: PRStatus, basePRsDir: string): string {
    const statusDirs = {
      draft: path.join(basePRsDir, 'draft'),
      open: path.join(basePRsDir, 'active'),
      review: path.join(basePRsDir, 'active'),
      approved: path.join(basePRsDir, 'active'),
      merged: path.join(basePRsDir, 'merged'),
      closed: path.join(basePRsDir, 'closed')
    };
    
    return statusDirs[status];
  }
  
  /**
   * Moves a PR file to the appropriate directory based on status
   */
  async moveToStatusDirectory(
    pr: PRData,
    newStatus: PRStatus,
    basePRsDir: string
  ): Promise<string | null> {
    const currentDir = path.dirname(pr.file_path);
    const targetDir = this.getStatusDirectory(newStatus, basePRsDir);
    
    // Only move if different directory
    if (currentDir === targetDir) {
      return null; // No move needed
    }
    
    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Generate new file path
    const fileName = path.basename(pr.file_path);
    const newFilePath = path.join(targetDir, fileName);
    
    // Check if target file already exists
    if (fs.existsSync(newFilePath)) {
      throw new Error(`Target file already exists: ${newFilePath}`);
    }
    
    // Move the file
    fs.renameSync(pr.file_path, newFilePath);
    
    return newFilePath;
  }
  
  /**
   * Validates PR status transition business rules
   */
  validateStatusTransition(
    pr: PRData,
    newStatus: PRStatus,
    options: {
      bypassChecks?: boolean;
      requiredApprovals?: number;
    } = {}
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check if transition is structurally valid
    if (!this.isValidStatusTransition(pr.pr_status, newStatus)) {
      errors.push(`Invalid status transition: ${pr.pr_status} → ${newStatus}`);
    }
    
    // Business rule validations (can be bypassed)
    if (!options.bypassChecks) {
      switch (newStatus) {
        case 'approved':
          // Check if there are reviewers
          if (!pr.reviewers || pr.reviewers.length === 0) {
            warnings.push('PR has no reviewers assigned');
          }
          
          // Check if all reviewers have approved
          const approvals = pr.approvals || [];
          const reviewers = pr.reviewers || [];
          const requiredApprovals = options.requiredApprovals || reviewers.length;
          
          if (approvals.length < requiredApprovals) {
            warnings.push(`PR needs ${requiredApprovals - approvals.length} more approvals`);
          }
          break;
          
        case 'merged':
          // Check if PR is approved
          if (pr.pr_status !== 'approved') {
            errors.push('PR must be approved before merging');
          }
          
          // Check for blocking dependencies
          if (pr.blocked_by && pr.blocked_by.length > 0) {
            errors.push(`PR is blocked by: ${pr.blocked_by.join(', ')}`);
          }
          break;
          
        case 'closed':
          // Warn if closing an approved PR
          if (pr.pr_status === 'approved') {
            warnings.push('Closing an approved PR - consider merging instead');
          }
          break;
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Gets the next recommended status for a PR
   */
  getNextRecommendedStatus(pr: PRData): PRStatus | null {
    switch (pr.pr_status) {
      case 'draft':
        return 'open';
      case 'open':
        return 'review';
      case 'review':
        const approvals = pr.approvals || [];
        const reviewers = pr.reviewers || [];
        return approvals.length >= reviewers.length ? 'approved' : 'review';
      case 'approved':
        return 'merged';
      default:
        return null;
    }
  }
  
  /**
   * Gets status-specific requirements and suggestions
   */
  getStatusRequirements(status: PRStatus): StatusRequirements {
    const requirements: Record<PRStatus, StatusRequirements> = {
      draft: {
        required: [],
        recommended: ['title', 'description', 'branch_name'],
        nextActions: ['Add reviewers', 'Update to open when ready']
      },
      open: {
        required: ['title', 'description'],
        recommended: ['reviewers', 'target_branch'],
        nextActions: ['Request reviews', 'Update to review status']
      },
      review: {
        required: ['reviewers'],
        recommended: ['approval_count'],
        nextActions: ['Wait for reviews', 'Address feedback']
      },
      approved: {
        required: ['approvals'],
        recommended: ['merge_strategy'],
        nextActions: ['Merge PR', 'Deploy changes']
      },
      merged: {
        required: ['merge_commit'],
        recommended: ['linked_tasks_updated'],
        nextActions: ['Close related tasks', 'Update documentation']
      },
      closed: {
        required: [],
        recommended: ['close_reason'],
        nextActions: ['Archive or reopen if needed']
      }
    };
    
    return requirements[status];
  }
  
  /**
   * Applies automatic status transitions based on PR state
   */
  getAutoStatusTransition(pr: PRData): PRStatus | null {
    // Auto-transition from review to approved if all reviewers approved
    if (pr.pr_status === 'review') {
      const approvals = pr.approvals || [];
      const reviewers = pr.reviewers || [];
      
      if (reviewers.length > 0 && approvals.length >= reviewers.length) {
        return 'approved';
      }
    }
    
    return null;
  }
  
  /**
   * Creates status-specific directories if they don't exist
   */
  ensureStatusDirectories(basePRsDir: string): void {
    const statusDirs = [
      'draft',
      'active',
      'merged',
      'closed',
      'reviews',
      'logs'
    ];
    
    statusDirs.forEach(dir => {
      const dirPath = path.join(basePRsDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
  }
  
  /**
   * Generates a status transition report
   */
  generateStatusReport(
    pr: PRData,
    fromStatus: PRStatus,
    toStatus: PRStatus,
    metadata: any = {}
  ): StatusTransitionReport {
    const now = new Date().toISOString();
    
    return {
      pr_id: pr.pr_id,
      from_status: fromStatus,
      to_status: toStatus,
      timestamp: now,
      triggered_by: metadata.triggered_by || 'manual',
      file_moved: metadata.file_moved || false,
      new_file_path: metadata.new_file_path,
      approvals_count: (pr.approvals || []).length,
      reviewers_count: (pr.reviewers || []).length,
      validation_passed: metadata.validation_passed || true,
      validation_warnings: metadata.validation_warnings || []
    };
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface StatusRequirements {
  required: string[];
  recommended: string[];
  nextActions: string[];
}

export interface StatusTransitionReport {
  pr_id: string;
  from_status: PRStatus;
  to_status: PRStatus;
  timestamp: string;
  triggered_by: string;
  file_moved: boolean;
  new_file_path?: string;
  approvals_count: number;
  reviewers_count: number;
  validation_passed: boolean;
  validation_warnings: string[];
}

export default PRStatusManager;