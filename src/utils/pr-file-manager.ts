/**
 * PR File Manager
 * Handles PR file organization, movement, and directory structure
 */

import * as path from 'path';
import * as fs from 'fs';
import type { PRData, PRStatus } from '../types/ai-trackdown.js';
import { ConfigManager } from './config-manager.js';
import { PRStatusManager } from './pr-status-manager.js';
import { Formatter } from './formatter.js';

export class PRFileManager {
  private configManager: ConfigManager;
  private statusManager: PRStatusManager;
  
  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.statusManager = new PRStatusManager(configManager);
  }
  
  /**
   * Initialize PR directory structure
   */
  initializePRDirectories(basePRsDir: string): void {
    const directories = [
      'draft',        // Draft PRs
      'active',       // Open, review, approved PRs
      'merged',       // Merged PRs
      'closed',       // Closed PRs
      'reviews',      // Review files
      'logs',         // Activity logs
      'templates',    // PR templates
      'attachments'   // File attachments
    ];
    
    directories.forEach(dir => {
      const dirPath = path.join(basePRsDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
    
    // Create subdirectories for active PRs
    const activeDirs = ['open', 'review', 'approved'];
    activeDirs.forEach(subdir => {
      const subDirPath = path.join(basePRsDir, 'active', subdir);
      if (!fs.existsSync(subDirPath)) {
        fs.mkdirSync(subDirPath, { recursive: true });
      }
    });
  }
  
  /**
   * Get the appropriate directory for a PR based on its status
   */
  getPRDirectory(status: PRStatus, basePRsDir: string): string {
    const statusDirectories = {
      draft: path.join(basePRsDir, 'draft'),
      open: path.join(basePRsDir, 'active', 'open'),
      review: path.join(basePRsDir, 'active', 'review'),
      approved: path.join(basePRsDir, 'active', 'approved'),
      merged: path.join(basePRsDir, 'merged'),
      closed: path.join(basePRsDir, 'closed')
    };
    
    return statusDirectories[status];
  }
  
  /**
   * Move PR file to status-appropriate directory
   */
  async movePRToStatusDirectory(
    pr: PRData,
    newStatus: PRStatus,
    basePRsDir: string
  ): Promise<MovePRResult> {
    const currentPath = pr.file_path;
    const targetDir = this.getPRDirectory(newStatus, basePRsDir);
    const fileName = path.basename(currentPath);
    const newPath = path.join(targetDir, fileName);
    
    // Check if move is needed
    if (currentPath === newPath) {
      return {
        moved: false,
        oldPath: currentPath,
        newPath: currentPath,
        reason: 'File already in correct location'
      };
    }
    
    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Check if target file already exists
    if (fs.existsSync(newPath)) {
      // Generate unique filename
      const uniquePath = this.generateUniqueFilename(newPath);
      
      fs.renameSync(currentPath, uniquePath);
      
      return {
        moved: true,
        oldPath: currentPath,
        newPath: uniquePath,
        reason: 'Moved to unique filename to avoid conflict'
      };
    }
    
    // Move the file
    fs.renameSync(currentPath, newPath);
    
    return {
      moved: true,
      oldPath: currentPath,
      newPath: newPath,
      reason: 'Moved to status-appropriate directory'
    };
  }
  
  /**
   * Generate unique filename if conflict exists
   */
  private generateUniqueFilename(filePath: string): string {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    
    let counter = 1;
    let uniquePath = filePath;
    
    while (fs.existsSync(uniquePath)) {
      uniquePath = path.join(dir, `${base}-${counter}${ext}`);
      counter++;
    }
    
    return uniquePath;
  }
  
  /**
   * Create PR review file
   */
  async createReviewFile(
    prId: string,
    reviewer: string,
    reviewType: 'approve' | 'request_changes' | 'comment',
    content: string,
    basePRsDir: string
  ): Promise<string> {
    const reviewsDir = path.join(basePRsDir, 'reviews');
    
    // Ensure reviews directory exists
    if (!fs.existsSync(reviewsDir)) {
      fs.mkdirSync(reviewsDir, { recursive: true });
    }
    
    const reviewId = `${prId}-${reviewType}-${reviewer}-${Date.now()}`;
    const reviewFileName = `${reviewId}.md`;
    const reviewFilePath = path.join(reviewsDir, reviewFileName);
    
    // Write review file
    fs.writeFileSync(reviewFilePath, content, 'utf8');
    
    return reviewFilePath;
  }
  
  /**
   * Archive old PR files
   */
  async archiveOldPRs(
    basePRsDir: string,
    olderThanDays: number = 90
  ): Promise<ArchiveResult> {
    const archiveDir = path.join(basePRsDir, 'archive');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const archivedFiles: string[] = [];
    const errors: string[] = [];
    
    // Check merged and closed directories
    const dirsToCheck = [
      path.join(basePRsDir, 'merged'),
      path.join(basePRsDir, 'closed')
    ];
    
    for (const dir of dirsToCheck) {
      if (!fs.existsSync(dir)) continue;
      
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          try {
            const archivePath = path.join(archiveDir, file);
            fs.renameSync(filePath, archivePath);
            archivedFiles.push(file);
          } catch (error) {
            errors.push(`Failed to archive ${file}: ${error}`);
          }
        }
      }
    }
    
    return {
      archivedCount: archivedFiles.length,
      archivedFiles,
      errors
    };
  }
  
  /**
   * Get PR directory statistics
   */
  getPRDirectoryStats(basePRsDir: string): PRDirectoryStats {
    const stats: PRDirectoryStats = {
      draft: 0,
      open: 0,
      review: 0,
      approved: 0,
      merged: 0,
      closed: 0,
      total: 0,
      reviewFiles: 0,
      diskUsage: 0
    };
    
    const directories = {
      draft: path.join(basePRsDir, 'draft'),
      open: path.join(basePRsDir, 'active', 'open'),
      review: path.join(basePRsDir, 'active', 'review'),
      approved: path.join(basePRsDir, 'active', 'approved'),
      merged: path.join(basePRsDir, 'merged'),
      closed: path.join(basePRsDir, 'closed')
    };
    
    Object.entries(directories).forEach(([status, dir]) => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        stats[status as keyof PRDirectoryStats] = files.length;
        stats.total += files.length;
        
        // Calculate disk usage
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const fileStats = fs.statSync(filePath);
          stats.diskUsage += fileStats.size;
        });
      }
    });
    
    // Count review files
    const reviewsDir = path.join(basePRsDir, 'reviews');
    if (fs.existsSync(reviewsDir)) {
      const reviewFiles = fs.readdirSync(reviewsDir);
      stats.reviewFiles = reviewFiles.length;
    }
    
    return stats;
  }
  
  /**
   * Clean up empty directories
   */
  cleanupEmptyDirectories(basePRsDir: string): CleanupResult {
    const removedDirs: string[] = [];
    const errors: string[] = [];
    
    const checkAndRemoveEmpty = (dir: string): void => {
      try {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          if (files.length === 0) {
            fs.rmdirSync(dir);
            removedDirs.push(dir);
          }
        }
      } catch (error) {
        errors.push(`Failed to remove ${dir}: ${error}`);
      }
    };
    
    // Check subdirectories first
    const subDirs = [
      path.join(basePRsDir, 'active', 'open'),
      path.join(basePRsDir, 'active', 'review'),
      path.join(basePRsDir, 'active', 'approved')
    ];
    
    subDirs.forEach(checkAndRemoveEmpty);
    
    return {
      removedCount: removedDirs.length,
      removedDirs,
      errors
    };
  }
  
  /**
   * Validate PR directory structure
   */
  validatePRDirectoryStructure(basePRsDir: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const requiredDirs = [
      'draft',
      'active',
      'merged',
      'closed',
      'reviews'
    ];
    
    // Check required directories
    requiredDirs.forEach(dir => {
      const dirPath = path.join(basePRsDir, dir);
      if (!fs.existsSync(dirPath)) {
        errors.push(`Missing required directory: ${dir}`);
      }
    });
    
    // Check active subdirectories
    const activeSubDirs = ['open', 'review', 'approved'];
    activeSubDirs.forEach(subdir => {
      const subDirPath = path.join(basePRsDir, 'active', subdir);
      if (!fs.existsSync(subDirPath)) {
        warnings.push(`Missing active subdirectory: ${subdir}`);
      }
    });
    
    // Check for orphaned files
    const prFiles = this.findPRFiles(basePRsDir);
    prFiles.forEach(file => {
      const relativePath = path.relative(basePRsDir, file);
      const pathParts = relativePath.split(path.sep);
      
      if (pathParts.length < 2) {
        warnings.push(`PR file in root directory: ${file}`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Find all PR files in the directory structure
   */
  findPRFiles(basePRsDir: string): string[] {
    const prFiles: string[] = [];
    
    const searchDir = (dir: string): void => {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      
      items.forEach(item => {
        const itemPath = path.join(dir, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          searchDir(itemPath);
        } else if (item.endsWith('.md') && item.startsWith('PR-')) {
          prFiles.push(itemPath);
        }
      });
    };
    
    searchDir(basePRsDir);
    return prFiles;
  }
}

export interface MovePRResult {
  moved: boolean;
  oldPath: string;
  newPath: string;
  reason: string;
}

export interface ArchiveResult {
  archivedCount: number;
  archivedFiles: string[];
  errors: string[];
}

export interface PRDirectoryStats {
  draft: number;
  open: number;
  review: number;
  approved: number;
  merged: number;
  closed: number;
  total: number;
  reviewFiles: number;
  diskUsage: number;
}

export interface CleanupResult {
  removedCount: number;
  removedDirs: string[];
  errors: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export default PRFileManager;