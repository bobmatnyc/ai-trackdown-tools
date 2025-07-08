/**
 * Structure Migration Command
 * ATT-004: Migrate from separate root directories to unified structure
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../utils/config-manager.js';
import { UnifiedPathResolver } from '../utils/unified-path-resolver.js';
import { Formatter } from '../utils/formatter.js';

interface MigrateOptions {
  dryRun?: boolean;
  backup?: boolean;
  verbose?: boolean;
  force?: boolean;
  tasksDir?: string;
}

export function createMigrateStructureCommand(): Command {
  const cmd = new Command('migrate-structure');
  
  cmd
    .description('Migrate from separate root directories to unified structure')
    .option('--dry-run', 'show what would be migrated without making changes')
    .option('--backup', 'create backup before migration')
    .option('--verbose', 'verbose output')
    .option('--force', 'force migration even if target directories exist')
    .option('--tasks-dir <path>', 'target tasks directory (default: from config or "tasks")')
    .addHelpText('after', `
Examples:
  $ aitrackdown migrate-structure --dry-run
  $ aitrackdown migrate-structure --backup --verbose
  $ aitrackdown migrate-structure --tasks-dir work

Migration Process:
  1. Detects legacy directory structure (epics/, issues/, tasks/ at root)
  2. Creates unified structure under configurable root (default: tasks/)
  3. Moves files to new structure: epics/ -> tasks/epics/
  4. Updates configuration if needed
  5. Optionally creates backup of original structure

Before Migration:
  project/
  ├── epics/           # ❌ Separate root directory
  ├── issues/          # ❌ Separate root directory
  └── tasks/           # ❌ Separate root directory

After Migration:
  project/
  └── tasks/           # ✅ Single configurable root
      ├── epics/
      ├── issues/
      ├── tasks/
      ├── prs/
      └── templates/
`)
    .action(async (options: MigrateOptions) => {
      try {
        await migrateStructure(options);
      } catch (error) {
        console.error(Formatter.error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}

async function migrateStructure(options: MigrateOptions): Promise<void> {
  const projectRoot = process.cwd();
  
  try {
    // Check if this is an AI-Trackdown project
    const configManager = new ConfigManager(projectRoot);
    if (!configManager.isProjectDirectory(projectRoot)) {
      throw new Error('Not an AI-Trackdown project. Run "aitrackdown init" first.');
    }

    const config = configManager.getConfig();
    const cliTasksDir = options.tasksDir || process.env.CLI_TASKS_DIR;
    
    // Create path resolver to detect legacy structure
    const pathResolver = new UnifiedPathResolver(config, projectRoot, cliTasksDir);
    const legacy = pathResolver.detectLegacyStructure();
    
    if (!legacy.hasLegacy) {
      console.log(Formatter.success('✅ No legacy directory structure detected. Project already uses unified structure.'));
      
      // Show current structure for verification
      pathResolver.showStructureInfo();
      return;
    }

    console.log(Formatter.warning('🔍 Legacy directory structure detected:'));
    legacy.legacyDirs.forEach(dir => {
      console.log(Formatter.info(`   • ${path.relative(projectRoot, dir)}`));
    });

    const targetPaths = pathResolver.getUnifiedPaths();
    const targetTasksRoot = path.relative(projectRoot, targetPaths.tasksRoot);
    
    console.log(Formatter.info(`\n📋 Migration Plan:`));
    console.log(Formatter.info(`   Target structure: ${targetTasksRoot}/`));

    // Plan the migration
    const migrationPlan = planMigration(projectRoot, legacy.legacyDirs, pathResolver);
    
    if (migrationPlan.length === 0) {
      console.log(Formatter.warning('No files to migrate.'));
      return;
    }

    console.log(Formatter.info(`\n📁 Files to migrate: ${migrationPlan.length}`));
    
    if (options.verbose || options.dryRun) {
      migrationPlan.forEach(item => {
        const sourcePath = path.relative(projectRoot, item.source);
        const targetPath = path.relative(projectRoot, item.target);
        console.log(Formatter.debug(`   ${sourcePath} → ${targetPath}`));
      });
    }

    if (options.dryRun) {
      console.log(Formatter.info('\n🔍 Dry run completed. Use without --dry-run to perform migration.'));
      return;
    }

    // Check for conflicts
    const conflicts = migrationPlan.filter(item => fs.existsSync(item.target));
    if (conflicts.length > 0 && !options.force) {
      console.log(Formatter.error('\n❌ Migration conflicts detected:'));
      conflicts.forEach(item => {
        const targetPath = path.relative(projectRoot, item.target);
        console.log(Formatter.error(`   Target exists: ${targetPath}`));
      });
      console.log(Formatter.info('\n💡 Use --force to overwrite existing files or --backup to create backups first.'));
      return;
    }

    // Create backup if requested
    if (options.backup) {
      await createBackup(projectRoot, legacy.legacyDirs);
    }

    // Perform the migration
    console.log(Formatter.info('\n🚀 Starting migration...'));
    
    // Create target directories
    await createTargetDirectories(pathResolver);
    
    // Move files
    let migratedCount = 0;
    for (const item of migrationPlan) {
      try {
        // Ensure target directory exists
        const targetDir = path.dirname(item.target);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // Move file
        fs.renameSync(item.source, item.target);
        migratedCount++;
        
        if (options.verbose) {
          const sourcePath = path.relative(projectRoot, item.source);
          const targetPath = path.relative(projectRoot, item.target);
          console.log(Formatter.success(`   ✓ ${sourcePath} → ${targetPath}`));
        }
      } catch (error) {
        console.error(Formatter.error(`Failed to migrate ${item.source}: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    }

    // Remove empty legacy directories
    await removeEmptyLegacyDirectories(legacy.legacyDirs);

    // Update configuration if needed
    if (cliTasksDir && cliTasksDir !== config.tasks_directory) {
      configManager.updateConfig({ tasks_directory: cliTasksDir });
      console.log(Formatter.success(`✅ Updated configuration: tasks_directory = "${cliTasksDir}"`));
    }

    console.log(Formatter.success(`\n🎉 Migration completed successfully!`));
    console.log(Formatter.info(`   Files migrated: ${migratedCount}`));
    console.log(Formatter.info(`   Target structure: ${targetTasksRoot}/`));

    // Show final structure
    console.log(Formatter.info('\n📁 Final directory structure:'));
    pathResolver.showStructureInfo();

  } catch (error) {
    throw new Error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function planMigration(
  projectRoot: string, 
  legacyDirs: string[], 
  pathResolver: UnifiedPathResolver
): Array<{ source: string; target: string; type: string }> {
  const plan: Array<{ source: string; target: string; type: string }> = [];
  const targetPaths = pathResolver.getUnifiedPaths();

  for (const legacyDir of legacyDirs) {
    if (!fs.existsSync(legacyDir)) continue;

    const dirName = path.basename(legacyDir);
    let targetDir: string;

    // Map legacy directories to unified structure
    switch (dirName) {
      case 'epics':
        targetDir = targetPaths.epicsDir;
        break;
      case 'issues':
        targetDir = targetPaths.issuesDir;
        break;
      case 'tasks':
        targetDir = targetPaths.tasksDir;
        break;
      case 'templates':
        targetDir = targetPaths.templatesDir;
        break;
      case 'trackdown':
        // For old trackdown structure, check subdirectories
        const subdirs = fs.readdirSync(legacyDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);
        
        for (const subdir of subdirs) {
          const sourceSubdir = path.join(legacyDir, subdir);
          let targetSubdir: string;
          
          switch (subdir) {
            case 'active':
            case 'epics':
              targetSubdir = targetPaths.epicsDir;
              break;
            case 'issues':
              targetSubdir = targetPaths.issuesDir;
              break;
            case 'tasks':
              targetSubdir = targetPaths.tasksDir;
              break;
            case 'templates':
              targetSubdir = targetPaths.templatesDir;
              break;
            default:
              continue; // Skip unknown subdirectories
          }
          
          // Add files from trackdown subdirectory
          if (fs.existsSync(sourceSubdir)) {
            const files = fs.readdirSync(sourceSubdir)
              .filter(file => file.endsWith('.md') || file.endsWith('.yaml'));
            
            for (const file of files) {
              plan.push({
                source: path.join(sourceSubdir, file),
                target: path.join(targetSubdir, file),
                type: subdir
              });
            }
          }
        }
        continue;
      default:
        continue; // Skip unknown directories
    }

    // Add files from legacy directory
    if (fs.existsSync(legacyDir)) {
      const files = fs.readdirSync(legacyDir)
        .filter(file => file.endsWith('.md') || file.endsWith('.yaml'));
      
      for (const file of files) {
        plan.push({
          source: path.join(legacyDir, file),
          target: path.join(targetDir, file),
          type: dirName
        });
      }
    }
  }

  return plan;
}

async function createTargetDirectories(pathResolver: UnifiedPathResolver): Promise<void> {
  const requiredDirs = pathResolver.getRequiredDirectories();
  
  for (const dir of requiredDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

async function createBackup(projectRoot: string, legacyDirs: string[]): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(projectRoot, `.backup-${timestamp}`);
  
  console.log(Formatter.info(`📦 Creating backup in ${path.relative(projectRoot, backupDir)}...`));
  
  fs.mkdirSync(backupDir, { recursive: true });
  
  for (const legacyDir of legacyDirs) {
    if (fs.existsSync(legacyDir)) {
      const targetBackupDir = path.join(backupDir, path.basename(legacyDir));
      await copyDirectory(legacyDir, targetBackupDir);
    }
  }
  
  console.log(Formatter.success(`✅ Backup created: ${path.relative(projectRoot, backupDir)}`));
}

async function copyDirectory(source: string, target: string): Promise<void> {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  
  const items = fs.readdirSync(source, { withFileTypes: true });
  
  for (const item of items) {
    const sourcePath = path.join(source, item.name);
    const targetPath = path.join(target, item.name);
    
    if (item.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

async function removeEmptyLegacyDirectories(legacyDirs: string[]): Promise<void> {
  for (const dir of legacyDirs) {
    try {
      if (fs.existsSync(dir)) {
        const items = fs.readdirSync(dir);
        if (items.length === 0) {
          fs.rmdirSync(dir);
          console.log(Formatter.success(`✅ Removed empty directory: ${path.basename(dir)}`));
        }
      }
    } catch (error) {
      // Ignore errors removing directories
    }
  }
}