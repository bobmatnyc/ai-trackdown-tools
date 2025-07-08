/**
 * PR Archive Command
 * Advanced PR archival system and file management
 */

import { Command } from 'commander';
import { PRStatusManager } from '../../utils/pr-status-manager.js';
import { PRFileManager } from '../../utils/pr-file-manager.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { colors } from '../../utils/colors.js';
import * as fs from 'fs';
import * as path from 'path';
import type { PRData, PRStatus } from '../../types/ai-trackdown.js';

export interface ArchiveOptions {
  olderThanDays: number;
  status: PRStatus[];
  includeReviews: boolean;
  compress: boolean;
  createIndex: boolean;
  preserveStructure: boolean;
  dryRun: boolean;
  force: boolean;
}

export interface ArchiveResult {
  success: boolean;
  archivedPRs: number;
  archivedReviews: number;
  totalSizeBefore: number;
  totalSizeAfter: number;
  compressionRatio: number;
  archivePath: string;
  indexPath?: string;
  errors: string[];
  warnings: string[];
  details: ArchiveDetail[];
}

export interface ArchiveDetail {
  prId: string;
  originalPath: string;
  archivePath: string;
  sizeBytes: number;
  archived: boolean;
  reason?: string;
}

export interface ArchiveIndex {
  created: string;
  totalPRs: number;
  totalReviews: number;
  totalSize: number;
  compressionRatio: number;
  prs: ArchiveIndexEntry[];
}

export interface ArchiveIndexEntry {
  prId: string;
  title: string;
  status: PRStatus;
  assignee: string;
  created: string;
  merged?: string;
  closed?: string;
  archivePath: string;
  sizeBytes: number;
  linkedTasks: string[];
  linkedIssues: string[];
}

export function createPRArchiveCommand(): Command {
  const cmd = new Command('archive');
  
  cmd.description('Archive old or closed PRs for long-term storage');
  
  // Main archive command
  cmd
    .option('-d, --days <days>', 'Archive PRs older than specified days', '90')
    .option('-s, --status <status>', 'Archive PRs with specific status (comma-separated)', 'merged,closed')
    .option('--include-reviews', 'Include review files in archive', false)
    .option('--compress', 'Compress archived files', false)
    .option('--create-index', 'Create searchable index of archived PRs', false)
    .option('--preserve-structure', 'Preserve directory structure in archive', false)
    .option('--force', 'Force archive even if files are recent', false)
    .option('--dry-run', 'Show what would be archived without executing', false)
    .action(async (options: any) => {
      const configManager = new ConfigManager();
      const statusManager = new PRStatusManager(configManager);
      const fileManager = new PRFileManager(configManager);
      const formatter = new Formatter();
      
      const archiveOptions: ArchiveOptions = {
        olderThanDays: parseInt(options.days),
        status: options.status.split(',') as PRStatus[],
        includeReviews: options.includeReviews,
        compress: options.compress,
        createIndex: options.createIndex,
        preserveStructure: options.preserveStructure,
        dryRun: options.dryRun,
        force: options.force
      };
      
      try {
        const result = await performArchive(archiveOptions, statusManager, fileManager, configManager);
        
        if (options.dryRun) {
          console.log(colors.yellow('🔍 Archive dry run - showing what would be archived:'));
          console.log('');
        }
        
        displayArchiveResult(result);
        
        if (!result.success) {
          process.exit(1);
        }
        
      } catch (error) {
        console.error(colors.red(`❌ Archive failed: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
  
  // List archived PRs
  cmd.command('list')
    .description('List archived PRs')
    .option('-f, --format <format>', 'Output format (table|json)', 'table')
    .option('--search <query>', 'Search archived PRs')
    .action(async (options: any) => {
      const configManager = new ConfigManager();
      const formatter = new Formatter();
      
      try {
        const archived = await listArchivedPRs(configManager, options.search);
        displayArchivedPRs(archived, options.format, formatter);
        
      } catch (error) {
        console.error(colors.red(`❌ Error listing archived PRs: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
  
  // Restore archived PR
  cmd.command('restore')
    .description('Restore an archived PR')
    .argument('<pr-id>', 'PR ID to restore')
    .option('--to-status <status>', 'Restore to specific status', 'closed')
    .action(async (prId: string, options: any) => {
      const configManager = new ConfigManager();
      const statusManager = new PRStatusManager(configManager);
      const fileManager = new PRFileManager(configManager);
      
      try {
        const result = await restorePR(prId, options.toStatus, statusManager, fileManager, configManager);
        
        if (result.success) {
          console.log(colors.green(`✅ Successfully restored PR ${prId}`));
          console.log(`📁 Restored to: ${result.restoredPath}`);
          console.log(`📋 Status: ${options.toStatus}`);
        } else {
          console.error(colors.red(`❌ Failed to restore PR ${prId}`));
          result.errors.forEach(error => console.error(colors.red(`  • ${error}`)));
          process.exit(1);
        }
        
      } catch (error) {
        console.error(colors.red(`❌ Error restoring PR: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
  
  // Clean up archive
  cmd.command('cleanup')
    .description('Clean up archive by removing very old files')
    .option('-d, --days <days>', 'Remove archives older than specified days', '365')
    .option('--force', 'Force cleanup without confirmation', false)
    .action(async (options: any) => {
      const configManager = new ConfigManager();
      
      try {
        const result = await cleanupArchive(parseInt(options.days), options.force, configManager);
        
        if (result.success) {
          console.log(colors.green(`✅ Archive cleanup completed`));
          console.log(`🗑️  Removed ${result.removedCount} old archives`);
          console.log(`💾 Freed ${formatBytes(result.freedSpace)} of space`);
        } else {
          console.error(colors.red(`❌ Archive cleanup failed`));
          result.errors.forEach(error => console.error(colors.red(`  • ${error}`)));
          process.exit(1);
        }
        
      } catch (error) {
        console.error(colors.red(`❌ Error during cleanup: ${error instanceof Error ? error.message : String(error)}`));
        process.exit(1);
      }
    });
  
  return cmd;
}

async function performArchive(
  options: ArchiveOptions,
  statusManager: PRStatusManager,
  fileManager: PRFileManager,
  configManager: ConfigManager
): Promise<ArchiveResult> {
  const result: ArchiveResult = {
    success: false,
    archivedPRs: 0,
    archivedReviews: 0,
    totalSizeBefore: 0,
    totalSizeAfter: 0,
    compressionRatio: 0,
    archivePath: '',
    errors: [],
    warnings: [],
    details: []
  };
  
  try {
    const basePRsDir = configManager.getPRsDirectory();
    const archiveDir = path.join(basePRsDir, 'archive');
    const timestamp = new Date().toISOString().split('T')[0];
    const archivePath = path.join(archiveDir, `archive-${timestamp}`);
    
    if (!options.dryRun) {
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }
      
      if (!fs.existsSync(archivePath)) {
        fs.mkdirSync(archivePath, { recursive: true });
      }
    }
    
    result.archivePath = archivePath;
    
    // Find PRs to archive
    const candidatePRs = await findArchiveCandidates(options, statusManager, configManager);
    
    console.log(colors.blue(`🔄 Found ${candidatePRs.length} PRs matching archive criteria`));
    
    if (candidatePRs.length === 0) {
      console.log(colors.green('✅ No PRs need archiving'));
      result.success = true;
      return result;
    }
    
    // Calculate total size before archival
    for (const pr of candidatePRs) {
      const stats = fs.statSync(pr.file_path);
      result.totalSizeBefore += stats.size;
    }
    
    // Archive each PR
    for (const pr of candidatePRs) {
      const detail = await archivePR(pr, archivePath, options, configManager);
      result.details.push(detail);
      
      if (detail.archived) {
        result.archivedPRs++;
        result.totalSizeAfter += detail.sizeBytes;
      } else {
        result.warnings.push(`Failed to archive ${pr.pr_id}: ${detail.reason}`);
      }
    }
    
    // Archive review files if requested
    if (options.includeReviews) {
      const reviewCount = await archiveReviewFiles(archivePath, options, configManager);
      result.archivedReviews = reviewCount;
    }
    
    // Calculate compression ratio
    if (result.totalSizeBefore > 0) {
      result.compressionRatio = (result.totalSizeBefore - result.totalSizeAfter) / result.totalSizeBefore;
    }
    
    // Create index if requested
    if (options.createIndex && !options.dryRun) {
      const indexPath = await createArchiveIndex(candidatePRs, archivePath, result, configManager);
      result.indexPath = indexPath;
    }
    
    // Compress archive if requested
    if (options.compress && !options.dryRun) {
      await compressArchive(archivePath, configManager);
    }
    
    result.success = result.errors.length === 0;
    
    return result;
    
  } catch (error) {
    result.errors.push(`Archive operation failed: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}

async function findArchiveCandidates(
  options: ArchiveOptions,
  statusManager: PRStatusManager,
  configManager: ConfigManager
): Promise<PRData[]> {
  const allPRs = await statusManager.listPRs();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - options.olderThanDays);
  
  return allPRs.filter(pr => {
    // Filter by status
    if (!options.status.includes(pr.pr_status)) {
      return false;
    }
    
    // Filter by age (unless forced)
    if (!options.force) {
      const prDate = new Date(pr.updated_date);
      if (prDate > cutoffDate) {
        return false;
      }
    }
    
    return true;
  });
}

async function archivePR(
  pr: PRData,
  archivePath: string,
  options: ArchiveOptions,
  configManager: ConfigManager
): Promise<ArchiveDetail> {
  const detail: ArchiveDetail = {
    prId: pr.pr_id,
    originalPath: pr.file_path,
    archivePath: '',
    sizeBytes: 0,
    archived: false
  };
  
  try {
    const stats = fs.statSync(pr.file_path);
    detail.sizeBytes = stats.size;
    
    // Determine archive file path
    const fileName = path.basename(pr.file_path);
    let targetPath: string;
    
    if (options.preserveStructure) {
      const relativePath = path.relative(configManager.getPRsDirectory(), pr.file_path);
      targetPath = path.join(archivePath, relativePath);
      
      // Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    } else {
      targetPath = path.join(archivePath, fileName);
    }
    
    detail.archivePath = targetPath;
    
    if (!options.dryRun) {
      // Copy file to archive
      fs.copyFileSync(pr.file_path, targetPath);
      
      // Remove original file
      fs.unlinkSync(pr.file_path);
    }
    
    detail.archived = true;
    
    return detail;
    
  } catch (error) {
    detail.reason = error instanceof Error ? error.message : String(error);
    return detail;
  }
}

async function archiveReviewFiles(
  archivePath: string,
  options: ArchiveOptions,
  configManager: ConfigManager
): Promise<number> {
  try {
    const reviewsDir = path.join(configManager.getPRsDirectory(), 'reviews');
    
    if (!fs.existsSync(reviewsDir)) {
      return 0;
    }
    
    const reviewFiles = fs.readdirSync(reviewsDir);
    const archiveReviewsDir = path.join(archivePath, 'reviews');
    
    if (!options.dryRun && reviewFiles.length > 0) {
      if (!fs.existsSync(archiveReviewsDir)) {
        fs.mkdirSync(archiveReviewsDir, { recursive: true });
      }
    }
    
    let archivedCount = 0;
    
    for (const file of reviewFiles) {
      const sourcePath = path.join(reviewsDir, file);
      const targetPath = path.join(archiveReviewsDir, file);
      
      try {
        if (!options.dryRun) {
          fs.copyFileSync(sourcePath, targetPath);
          fs.unlinkSync(sourcePath);
        }
        archivedCount++;
      } catch (error) {
        console.warn(`Failed to archive review file ${file}: ${error}`);
      }
    }
    
    return archivedCount;
    
  } catch (error) {
    console.error(`Error archiving review files: ${error}`);
    return 0;
  }
}

async function createArchiveIndex(
  prs: PRData[],
  archivePath: string,
  result: ArchiveResult,
  configManager: ConfigManager
): Promise<string> {
  const index: ArchiveIndex = {
    created: new Date().toISOString(),
    totalPRs: result.archivedPRs,
    totalReviews: result.archivedReviews,
    totalSize: result.totalSizeAfter,
    compressionRatio: result.compressionRatio,
    prs: []
  };
  
  for (const pr of prs) {
    const entry: ArchiveIndexEntry = {
      prId: pr.pr_id,
      title: pr.title,
      status: pr.pr_status,
      assignee: pr.assignee,
      created: pr.created_date,
      archivePath: path.relative(archivePath, result.details.find(d => d.prId === pr.pr_id)?.archivePath || ''),
      sizeBytes: result.details.find(d => d.prId === pr.pr_id)?.sizeBytes || 0,
      linkedTasks: [], // This would be populated from relationship manager
      linkedIssues: []
    };
    
    if (pr.pr_status === 'merged') {
      entry.merged = pr.updated_date;
    } else if (pr.pr_status === 'closed') {
      entry.closed = pr.updated_date;
    }
    
    index.prs.push(entry);
  }
  
  const indexPath = path.join(archivePath, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  
  return indexPath;
}

async function compressArchive(archivePath: string, configManager: ConfigManager): Promise<void> {
  // This would implement compression using a library like node-tar or zip
  // For now, it's a placeholder
  console.log(`Compressing archive at ${archivePath}...`);
}

async function listArchivedPRs(configManager: ConfigManager, searchQuery?: string): Promise<ArchiveIndexEntry[]> {
  const archiveDir = path.join(configManager.getPRsDirectory(), 'archive');
  
  if (!fs.existsSync(archiveDir)) {
    return [];
  }
  
  const archiveDirs = fs.readdirSync(archiveDir).filter(dir => {
    const dirPath = path.join(archiveDir, dir);
    return fs.statSync(dirPath).isDirectory();
  });
  
  const allPRs: ArchiveIndexEntry[] = [];
  
  for (const dir of archiveDirs) {
    const indexPath = path.join(archiveDir, dir, 'index.json');
    
    if (fs.existsSync(indexPath)) {
      try {
        const indexContent = fs.readFileSync(indexPath, 'utf8');
        const index: ArchiveIndex = JSON.parse(indexContent);
        allPRs.push(...index.prs);
      } catch (error) {
        console.warn(`Failed to read index for archive ${dir}: ${error}`);
      }
    }
  }
  
  // Apply search filter if provided
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    return allPRs.filter(pr => 
      pr.prId.toLowerCase().includes(query) ||
      pr.title.toLowerCase().includes(query) ||
      pr.assignee.toLowerCase().includes(query)
    );
  }
  
  return allPRs;
}

async function restorePR(
  prId: string,
  targetStatus: string,
  statusManager: PRStatusManager,
  fileManager: PRFileManager,
  configManager: ConfigManager
): Promise<{ success: boolean; restoredPath?: string; errors: string[] }> {
  const result = {
    success: false,
    restoredPath: undefined as string | undefined,
    errors: [] as string[]
  };
  
  try {
    // Find archived PR
    const archivedPRs = await listArchivedPRs(configManager);
    const archivedPR = archivedPRs.find(pr => pr.prId === prId);
    
    if (!archivedPR) {
      result.errors.push(`Archived PR ${prId} not found`);
      return result;
    }
    
    // Determine restore path
    const basePRsDir = configManager.getPRsDirectory();
    const targetDir = fileManager.getPRDirectory(targetStatus as PRStatus, basePRsDir);
    const fileName = path.basename(archivedPR.archivePath);
    const restorePath = path.join(targetDir, fileName);
    
    // Find archive file
    const archiveDir = path.join(basePRsDir, 'archive');
    const archiveDirs = fs.readdirSync(archiveDir).filter(dir => {
      const dirPath = path.join(archiveDir, dir);
      return fs.statSync(dirPath).isDirectory();
    });
    
    let sourcePath: string | undefined;
    
    for (const dir of archiveDirs) {
      const candidatePath = path.join(archiveDir, dir, archivedPR.archivePath);
      if (fs.existsSync(candidatePath)) {
        sourcePath = candidatePath;
        break;
      }
    }
    
    if (!sourcePath) {
      result.errors.push(`Archive file for PR ${prId} not found`);
      return result;
    }
    
    // Restore file
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    fs.copyFileSync(sourcePath, restorePath);
    
    result.success = true;
    result.restoredPath = restorePath;
    
    return result;
    
  } catch (error) {
    result.errors.push(`Restore failed: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}

async function cleanupArchive(
  olderThanDays: number,
  force: boolean,
  configManager: ConfigManager
): Promise<{ success: boolean; removedCount: number; freedSpace: number; errors: string[] }> {
  const result = {
    success: false,
    removedCount: 0,
    freedSpace: 0,
    errors: [] as string[]
  };
  
  try {
    const archiveDir = path.join(configManager.getPRsDirectory(), 'archive');
    
    if (!fs.existsSync(archiveDir)) {
      result.success = true;
      return result;
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const archiveDirs = fs.readdirSync(archiveDir).filter(dir => {
      const dirPath = path.join(archiveDir, dir);
      return fs.statSync(dirPath).isDirectory();
    });
    
    for (const dir of archiveDirs) {
      const dirPath = path.join(archiveDir, dir);
      const stats = fs.statSync(dirPath);
      
      if (stats.mtime < cutoffDate) {
        try {
          const size = calculateDirectorySize(dirPath);
          
          if (force || await confirmCleanup(dir)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
            result.removedCount++;
            result.freedSpace += size;
          }
        } catch (error) {
          result.errors.push(`Failed to remove ${dir}: ${error}`);
        }
      }
    }
    
    result.success = result.errors.length === 0;
    return result;
    
  } catch (error) {
    result.errors.push(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }
}

function calculateDirectorySize(dirPath: string): number {
  let totalSize = 0;
  
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory()) {
      totalSize += calculateDirectorySize(itemPath);
    } else {
      totalSize += stats.size;
    }
  }
  
  return totalSize;
}

async function confirmCleanup(archiveName: string): Promise<boolean> {
  // This would implement user confirmation prompt
  // For now, return false to be safe
  return false;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function displayArchiveResult(result: ArchiveResult): void {
  console.log(colors.cyan(`\n📦 Archive operation completed`));
  console.log(`📁 Archive path: ${result.archivePath}`);
  console.log(`📋 Archived PRs: ${result.archivedPRs}`);
  console.log(`📝 Archived reviews: ${result.archivedReviews}`);
  console.log(`💾 Size before: ${formatBytes(result.totalSizeBefore)}`);
  console.log(`💾 Size after: ${formatBytes(result.totalSizeAfter)}`);
  
  if (result.compressionRatio > 0) {
    console.log(`📉 Compression: ${(result.compressionRatio * 100).toFixed(1)}%`);
  }
  
  if (result.indexPath) {
    console.log(`📄 Index created: ${result.indexPath}`);
  }
  
  if (result.details.length > 0) {
    console.log('\n📋 Archive Details:');
    result.details.forEach(detail => {
      const icon = detail.archived ? '✅' : '❌';
      const color = detail.archived ? colors.green : colors.red;
      const size = formatBytes(detail.sizeBytes);
      console.log(color(`${icon} ${detail.prId} (${size})`));
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
  console.log(successColor(`\n${successIcon} Archive ${result.success ? 'completed successfully' : 'failed'}`));
}

function displayArchivedPRs(prs: ArchiveIndexEntry[], format: string, formatter: Formatter): void {
  if (format === 'json') {
    console.log(JSON.stringify(prs, null, 2));
  } else {
    console.log(colors.blue(`\n📦 Archived PRs (${prs.length} found)`));
    
    if (prs.length === 0) {
      console.log(colors.yellow('No archived PRs found'));
      return;
    }
    
    console.table(prs.map(pr => ({
      'PR ID': pr.prId,
      'Title': pr.title.substring(0, 40) + (pr.title.length > 40 ? '...' : ''),
      'Status': pr.status,
      'Assignee': pr.assignee,
      'Created': pr.created.split('T')[0],
      'Size': formatBytes(pr.sizeBytes)
    })));
  }
}

export { ArchiveOptions, ArchiveResult, ArchiveIndex };