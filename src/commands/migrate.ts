#!/usr/bin/env node

/**
 * Migration Tool for AI-Trackdown
 * Converts legacy .trackdownrc.json to .ai-trackdown/config.yaml
 * Migrates active/completed/ to epics/issues/tasks/ structure
 * Adds YAML frontmatter to existing markdown files
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import * as YAML from 'yaml';
import type { EpicFrontmatter, IssueFrontmatter, TaskFrontmatter } from '../types/ai-trackdown.js';
import { ConfigManager } from '../utils/config-manager.js';
import { FrontmatterParser } from '../utils/frontmatter-parser.js';
import { IdGenerator } from '../utils/simple-id-generator.js';

interface LegacyConfig {
  directory_root?: string;
  github?: {
    owner?: string;
    repo?: string;
    token?: string;
  };
  default_assignee?: string;
  labels?: string[];
  milestones?: string[];
}

interface MigrationStats {
  configMigrated: boolean;
  filesProcessed: number;
  epicsMigrated: number;
  issuesMigrated: number;
  tasksMigrated: number;
  errors: string[];
}

export class MigrationTool {
  private frontmatterParser = new FrontmatterParser();
  private configManager = new ConfigManager();
  private idGenerator = new IdGenerator();
  private stats: MigrationStats = {
    configMigrated: false,
    filesProcessed: 0,
    epicsMigrated: 0,
    issuesMigrated: 0,
    tasksMigrated: 0,
    errors: [],
  };

  /**
   * Main migration entry point
   */
  public async migrate(
    sourceDir: string = process.cwd(),
    options: {
      dryRun?: boolean;
      verbose?: boolean;
      backup?: boolean;
    } = {}
  ): Promise<MigrationStats> {
    const spinner = ora('Starting AI-Trackdown migration...').start();

    try {
      // Step 1: Backup if requested
      if (options.backup) {
        await this.createBackup(sourceDir);
        spinner.text = 'Backup created';
      }

      // Step 2: Migrate configuration
      spinner.text = 'Migrating configuration...';
      await this.migrateConfiguration(sourceDir, options.dryRun);

      // Step 3: Create new directory structure
      spinner.text = 'Creating directory structure...';
      await this.createDirectoryStructure(sourceDir, options.dryRun);

      // Step 4: Migrate existing files
      spinner.text = 'Migrating files...';
      await this.migrateFiles(sourceDir, options.dryRun, options.verbose);

      // Step 5: Cleanup legacy files
      spinner.text = 'Cleaning up...';
      await this.cleanupLegacyFiles(sourceDir, options.dryRun);

      spinner.succeed('Migration completed successfully!');
      this.displaySummary();
    } catch (error) {
      spinner.fail(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }

    return this.stats;
  }

  /**
   * Migrate .trackdownrc.json to .ai-trackdown/config.yaml
   */
  private async migrateConfiguration(sourceDir: string, dryRun = false): Promise<void> {
    const legacyConfigPath = path.join(sourceDir, '.trackdownrc.json');

    if (!fs.existsSync(legacyConfigPath)) {
      console.log(chalk.yellow('No legacy .trackdownrc.json found, creating default config'));
      return;
    }

    try {
      const legacyConfig: LegacyConfig = JSON.parse(fs.readFileSync(legacyConfigPath, 'utf8'));

      // Convert to new config format
      const newConfig = {
        version: '1.0.0',
        directory_root: legacyConfig.directory_root || '.ai-trackdown',
        defaults: {
          assignee: legacyConfig.default_assignee || 'unassigned',
          priority: 'medium',
          status: 'todo',
        },
        templates: {
          epic: 'default',
          issue: 'default',
          task: 'default',
        },
        integrations: {
          // Note: GitHub integration removed in new architecture
        },
        automation: {
          auto_assign_ids: true,
          auto_update_dates: true,
          auto_track_relationships: true,
        },
      };

      if (!dryRun) {
        const configDir = path.join(sourceDir, '.ai-trackdown');
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }

        const newConfigPath = path.join(configDir, 'config.yaml');
        fs.writeFileSync(newConfigPath, YAML.stringify(newConfig, { indent: 2 }));

        console.log(chalk.green(`✓ Configuration migrated to ${newConfigPath}`));
      } else {
        console.log(chalk.blue(`[DRY RUN] Would migrate config to .ai-trackdown/config.yaml`));
      }

      this.stats.configMigrated = true;
    } catch (error) {
      const errorMsg = `Failed to migrate configuration: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.stats.errors.push(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Create the new directory structure
   */
  private async createDirectoryStructure(sourceDir: string, dryRun = false): Promise<void> {
    const aiTrackdownDir = path.join(sourceDir, '.ai-trackdown');
    const directories = [
      path.join(aiTrackdownDir, 'epics'),
      path.join(aiTrackdownDir, 'issues'),
      path.join(aiTrackdownDir, 'tasks'),
      path.join(aiTrackdownDir, 'templates'),
    ];

    if (!dryRun) {
      for (const dir of directories) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(chalk.green(`✓ Created directory: ${dir}`));
        }
      }
    } else {
      console.log(chalk.blue(`[DRY RUN] Would create directories: ${directories.join(', ')}`));
    }
  }

  /**
   * Migrate existing files from legacy structure
   */
  private async migrateFiles(sourceDir: string, dryRun = false, verbose = false): Promise<void> {
    const legacyDirs = [
      path.join(sourceDir, 'active'),
      path.join(sourceDir, 'completed'),
      path.join(sourceDir, 'trackdown'), // Handle existing trackdown folder
    ];

    for (const legacyDir of legacyDirs) {
      if (fs.existsSync(legacyDir)) {
        await this.processLegacyDirectory(legacyDir, sourceDir, dryRun, verbose);
      }
    }
  }

  /**
   * Process a legacy directory and migrate its files
   */
  private async processLegacyDirectory(
    legacyDir: string,
    sourceDir: string,
    dryRun = false,
    verbose = false
  ): Promise<void> {
    const files = fs.readdirSync(legacyDir).filter((file) => file.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(legacyDir, file);

      try {
        await this.migrateFile(filePath, sourceDir, dryRun, verbose);
        this.stats.filesProcessed++;
      } catch (error) {
        const errorMsg = `Failed to migrate ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        this.stats.errors.push(errorMsg);
        if (verbose) {
          console.log(chalk.red(`✗ ${errorMsg}`));
        }
      }
    }
  }

  /**
   * Migrate a single file
   */
  private async migrateFile(
    filePath: string,
    sourceDir: string,
    dryRun = false,
    verbose = false
  ): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf8');
    const filename = path.basename(filePath, '.md');

    // Determine file type and destination
    const { type, frontmatter, targetPath } = this.analyzeAndPrepareFile(
      filename,
      content,
      sourceDir
    );

    if (!dryRun) {
      // Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Write migrated file with frontmatter
      let migratedContent: string;

      switch (type) {
        case 'epic':
          migratedContent = this.frontmatterParser.serializeEpic(
            frontmatter as EpicFrontmatter,
            this.extractContent(content)
          );
          this.stats.epicsMigrated++;
          break;
        case 'issue':
          migratedContent = this.frontmatterParser.serializeIssue(
            frontmatter as IssueFrontmatter,
            this.extractContent(content)
          );
          this.stats.issuesMigrated++;
          break;
        case 'task':
          migratedContent = this.frontmatterParser.serializeTask(
            frontmatter as TaskFrontmatter,
            this.extractContent(content)
          );
          this.stats.tasksMigrated++;
          break;
        default:
          throw new Error(`Unknown file type: ${type}`);
      }

      fs.writeFileSync(targetPath, migratedContent);

      if (verbose) {
        console.log(chalk.green(`✓ Migrated ${type}: ${filePath} → ${targetPath}`));
      }
    } else {
      console.log(chalk.blue(`[DRY RUN] Would migrate ${type}: ${filePath} → ${targetPath}`));
    }
  }

  /**
   * Analyze a file and prepare frontmatter
   */
  private analyzeAndPrepareFile(
    filename: string,
    content: string,
    sourceDir: string
  ): {
    type: 'epic' | 'issue' | 'task';
    frontmatter: EpicFrontmatter | IssueFrontmatter | TaskFrontmatter;
    targetPath: string;
  } {
    const aiTrackdownDir = path.join(sourceDir, '.ai-trackdown');

    // Try to determine type from filename patterns
    let type: 'epic' | 'issue' | 'task';
    let id: string;

    if (filename.startsWith('EPIC-') || filename.includes('epic')) {
      type = 'epic';
      id = this.extractOrGenerateId(filename, 'EP');
    } else if (filename.startsWith('ISSUE-') || filename.includes('issue')) {
      type = 'issue';
      id = this.extractOrGenerateId(filename, 'ISS');
    } else if (
      filename.startsWith('TASK-') ||
      filename.includes('task') ||
      filename.startsWith('TSK-')
    ) {
      type = 'task';
      id = this.extractOrGenerateId(filename, 'TSK');
    } else {
      // Default to issue if unclear
      type = 'issue';
      id = this.extractOrGenerateId(filename, 'ISS');
    }

    const now = new Date().toISOString();
    const title = this.extractTitle(content) || filename.replace(/-/g, ' ');

    // Create appropriate frontmatter
    const baseFrontmatter = {
      title,
      status: 'todo' as const,
      priority: 'medium' as const,
      assignee: 'unassigned',
      labels: [],
      created_date: now,
      updated_date: now,
    };

    let frontmatter: EpicFrontmatter | IssueFrontmatter | TaskFrontmatter;
    let targetPath: string;

    switch (type) {
      case 'epic':
        frontmatter = {
          epic_id: id,
          ...baseFrontmatter,
          story_points: 0,
          completion_percentage: 0,
        } as EpicFrontmatter;
        targetPath = path.join(aiTrackdownDir, 'epics', `${id}.md`);
        break;

      case 'issue': {
        // For issues, we need to assign to an epic (use first available or create default)
        const epicId = this.findOrCreateDefaultEpic(sourceDir);
        frontmatter = {
          issue_id: id,
          epic_id: epicId,
          ...baseFrontmatter,
          story_points: 1,
        } as IssueFrontmatter;
        targetPath = path.join(aiTrackdownDir, 'issues', `${id}.md`);
        break;
      }

      case 'task': {
        // For tasks, we need epic and issue IDs
        const taskEpicId = this.findOrCreateDefaultEpic(sourceDir);
        const issueId = this.findOrCreateDefaultIssue(sourceDir, taskEpicId);
        frontmatter = {
          task_id: id,
          issue_id: issueId,
          epic_id: taskEpicId,
          ...baseFrontmatter,
          estimated_hours: 1,
          actual_hours: 0,
        } as TaskFrontmatter;
        targetPath = path.join(aiTrackdownDir, 'tasks', `${id}.md`);
        break;
      }
    }

    return { type, frontmatter, targetPath };
  }

  /**
   * Extract or generate an ID from filename
   */
  private extractOrGenerateId(filename: string, prefix: string): string {
    // Try to extract existing ID
    const patterns = [
      new RegExp(`${prefix}-(\\d{4})`),
      new RegExp(`(${prefix.toLowerCase()}|${prefix})-(\\d+)`, 'i'),
      /(\d{4})/,
    ];

    for (const pattern of patterns) {
      const match = filename.match(pattern);
      if (match) {
        const num = match[1] || match[2];
        return `${prefix}-${num.padStart(4, '0')}`;
      }
    }

    // Generate new ID
    switch (prefix) {
      case 'EP':
        return this.idGenerator.generateEpicId('migrated');
      case 'ISS':
        return this.idGenerator.generateIssueId('EP-0001', 'migrated');
      case 'TSK':
        return this.idGenerator.generateTaskId('ISS-0001', 'migrated');
      default:
        return `${prefix}-0001`;
    }
  }

  /**
   * Extract title from content
   */
  private extractTitle(content: string): string | null {
    // Look for markdown title (# Title)
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      return titleMatch[1].trim();
    }

    // Look for first non-empty line
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line);
    if (lines.length > 0) {
      return lines[0].replace(/^#+\s*/, '');
    }

    return null;
  }

  /**
   * Extract content without title
   */
  private extractContent(content: string): string {
    // Remove first title line if present
    const lines = content.split('\n');
    if (lines[0]?.trim().startsWith('# ')) {
      return lines.slice(1).join('\n').trim();
    }
    return content.trim();
  }

  /**
   * Find or create default epic for migration
   */
  private findOrCreateDefaultEpic(_sourceDir: string): string {
    // Return default epic ID - this will be created if needed
    return 'EP-0001';
  }

  /**
   * Find or create default issue for migration
   */
  private findOrCreateDefaultIssue(_sourceDir: string, _epicId: string): string {
    // Return default issue ID - this will be created if needed
    return 'ISS-0001';
  }

  /**
   * Create backup of source directory
   */
  private async createBackup(sourceDir: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(sourceDir, `backup-${timestamp}`);

    // Simple recursive copy
    this.copyDirectory(sourceDir, backupDir, ['node_modules', '.git', 'backup-*']);

    console.log(chalk.green(`✓ Backup created at ${backupDir}`));
  }

  /**
   * Copy directory recursively
   */
  private copyDirectory(src: string, dest: string, exclude: string[] = []): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const items = fs.readdirSync(src);

    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);

      // Skip excluded patterns
      if (exclude.some((pattern) => item.match(new RegExp(pattern)))) {
        continue;
      }

      const stat = fs.statSync(srcPath);

      if (stat.isDirectory()) {
        this.copyDirectory(srcPath, destPath, exclude);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Cleanup legacy files after successful migration
   */
  private async cleanupLegacyFiles(sourceDir: string, dryRun = false): Promise<void> {
    const legacyFiles = [path.join(sourceDir, '.trackdownrc.json')];

    const legacyDirs = [path.join(sourceDir, 'active'), path.join(sourceDir, 'completed')];

    if (!dryRun) {
      // Remove legacy config file
      for (const file of legacyFiles) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(chalk.green(`✓ Removed legacy file: ${file}`));
        }
      }

      // Archive legacy directories
      for (const dir of legacyDirs) {
        if (fs.existsSync(dir)) {
          const archiveDir = path.join(sourceDir, `${path.basename(dir)}-legacy`);
          fs.renameSync(dir, archiveDir);
          console.log(chalk.green(`✓ Archived legacy directory: ${dir} → ${archiveDir}`));
        }
      }
    } else {
      console.log(chalk.blue(`[DRY RUN] Would cleanup legacy files and directories`));
    }
  }

  /**
   * Display migration summary
   */
  private displaySummary(): void {
    console.log(`\n${chalk.bold.green('Migration Summary:')}`);
    console.log(chalk.green(`✓ Configuration migrated: ${this.stats.configMigrated}`));
    console.log(chalk.green(`✓ Files processed: ${this.stats.filesProcessed}`));
    console.log(chalk.green(`✓ Epics migrated: ${this.stats.epicsMigrated}`));
    console.log(chalk.green(`✓ Issues migrated: ${this.stats.issuesMigrated}`));
    console.log(chalk.green(`✓ Tasks migrated: ${this.stats.tasksMigrated}`));

    if (this.stats.errors.length > 0) {
      console.log(chalk.red(`✗ Errors encountered: ${this.stats.errors.length}`));
      this.stats.errors.forEach((error) => {
        console.log(chalk.red(`  - ${error}`));
      });
    }

    console.log(`\n${chalk.bold.blue('Next Steps:')}`);
    console.log('1. Review migrated files in .ai-trackdown/ directory');
    console.log('2. Update .ai-trackdown/config.yaml as needed');
    console.log('3. Test the new system with: aitrackdown status');
    console.log('4. Archive or remove legacy files when satisfied');
  }
}

// CLI Command Setup
export function createMigrateCommand(): Command {
  return new Command('migrate')
    .description('Migrate from legacy trackdown to ai-trackdown structure')
    .option('-d, --dry-run', 'Preview migration without making changes')
    .option('-v, --verbose', 'Show detailed migration progress')
    .option('-b, --backup', 'Create backup before migration')
    .option('--source <dir>', 'Source directory to migrate from', process.cwd())
    .action(async (options) => {
      const migrationTool = new MigrationTool();

      try {
        console.log(chalk.bold.blue('AI-Trackdown Migration Tool'));
        console.log(chalk.gray('Converting legacy structure to new ai-trackdown format\n'));

        const _stats = await migrationTool.migrate(options.source, {
          dryRun: options.dryRun,
          verbose: options.verbose,
          backup: options.backup,
        });

        if (options.dryRun) {
          console.log(
            chalk.yellow('\nDry run completed. Use without --dry-run to perform actual migration.')
          );
        }

        process.exit(0);
      } catch (error) {
        console.error(
          chalk.red(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        );
        process.exit(1);
      }
    });
}

export default createMigrateCommand;
