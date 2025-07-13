/**
 * Unified Path Resolver for AI-Trackdown
 * Implements single root directory structure: tasks/{type}/
 * ATT-004: Fix Task Directory Structure - Single Root Directory Implementation
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectConfig } from '../types/ai-trackdown.js';

export interface UnifiedPaths {
  projectRoot: string;
  configDir: string;
  tasksRoot: string; // The single configurable root (default: "tasks")
  epicsDir: string; // {tasksRoot}/epics/
  issuesDir: string; // {tasksRoot}/issues/
  tasksDir: string; // {tasksRoot}/tasks/
  prsDir: string; // {tasksRoot}/prs/
  templatesDir: string; // {tasksRoot}/templates/
}

/**
 * Unified Path Resolver implementing the required directory structure
 * All task types are organized under a single configurable root directory
 */
export class UnifiedPathResolver {
  private config: ProjectConfig;
  private projectRoot: string;
  private cliTasksDir?: string; // CLI override via --tasks-dir or --root-dir

  constructor(config: ProjectConfig, projectRoot: string, cliTasksDir?: string) {
    this.config = config;
    this.projectRoot = projectRoot;
    this.cliTasksDir = cliTasksDir;
  }

  /**
   * Get the tasks root directory with proper priority resolution:
   * 1. CLI option override (--root-dir, --tasks-dir)
   * 2. Environment variable (AITRACKDOWN_TASKS_DIR)
   * 3. Config file setting (tasks_directory)
   * 4. Default to "tasks"
   */
  getTasksRootDirectory(): string {
    // 1. CLI option takes highest priority
    if (this.cliTasksDir) {
      return this.cliTasksDir;
    }

    // 2. Environment variable override
    const envTasksDir = process.env.AITRACKDOWN_TASKS_DIR || process.env.AITRACKDOWN_ROOT_DIR;
    if (envTasksDir) {
      return envTasksDir;
    }

    // 3. Config file setting
    if (this.config.tasks_directory) {
      return this.config.tasks_directory;
    }

    // 4. Default to "tasks"
    return 'tasks';
  }

  /**
   * Get all unified paths following the required structure
   */
  getUnifiedPaths(): UnifiedPaths {
    const tasksRoot = this.getTasksRootDirectory();

    return {
      projectRoot: this.projectRoot,
      configDir: join(this.projectRoot, '.ai-trackdown'),
      tasksRoot: join(this.projectRoot, tasksRoot),
      epicsDir: join(this.projectRoot, tasksRoot, this.config.structure.epics_dir),
      issuesDir: join(this.projectRoot, tasksRoot, this.config.structure.issues_dir),
      tasksDir: join(this.projectRoot, tasksRoot, this.config.structure.tasks_dir),
      prsDir: join(this.projectRoot, tasksRoot, this.config.structure.prs_dir || 'prs'),
      templatesDir: join(this.projectRoot, tasksRoot, this.config.structure.templates_dir),
    };
  }

  /**
   * Get path for specific item type
   */
  getItemTypeDirectory(type: 'project' | 'epic' | 'issue' | 'task' | 'pr'): string {
    const paths = this.getUnifiedPaths();

    switch (type) {
      case 'project':
        return join(paths.tasksRoot, 'projects');
      case 'epic':
        return paths.epicsDir;
      case 'issue':
        return paths.issuesDir;
      case 'task':
        return paths.tasksDir;
      case 'pr':
        return paths.prsDir;
      default:
        throw new Error(`Unknown item type: ${type}`);
    }
  }

  /**
   * Get all directories that should be created for the unified structure
   */
  getRequiredDirectories(): string[] {
    const paths = this.getUnifiedPaths();

    return [
      paths.configDir,
      paths.tasksRoot,
      paths.epicsDir,
      paths.issuesDir,
      paths.tasksDir,
      paths.prsDir,
      paths.templatesDir,
    ];
  }

  /**
   * Check if legacy directory structure exists (separate root directories)
   */
  detectLegacyStructure(): {
    hasLegacy: boolean;
    legacyDirs: string[];
    suggestions: string[];
  } {
    const legacyDirs: string[] = [];
    const suggestions: string[] = [];

    // Check for old separate root directories
    const potentialLegacyDirs = [
      join(this.projectRoot, 'epics'),
      join(this.projectRoot, 'issues'),
      join(this.projectRoot, 'tasks'),
      join(this.projectRoot, 'prs'),
      join(this.projectRoot, 'trackdown'), // Old trackdown structure
    ];

    for (const dir of potentialLegacyDirs) {
      if (existsSync(dir)) {
        legacyDirs.push(dir);
      }
    }

    if (legacyDirs.length > 0) {
      const tasksRoot = this.getTasksRootDirectory();

      suggestions.push(
        `# Detected legacy directory structure. Migration options:`,
        ``,
        `# Option 1: Use CLI override to maintain current structure`,
        `export AITRACKDOWN_TASKS_DIR=""  # Use project root`,
        ``,
        `# Option 2: Migrate to unified structure`,
        `mkdir -p ${tasksRoot}`,
        ...legacyDirs.map((dir) => {
          const dirName = dir.split('/').pop();
          return `mv ${dirName} ${tasksRoot}/${dirName} 2>/dev/null || true`;
        }),
        ``,
        `# Option 3: Update configuration`,
        `# Edit .ai-trackdown/config.yaml and set:`,
        `# tasks_directory: ""  # Use project root`
      );
    }

    return {
      hasLegacy: legacyDirs.length > 0,
      legacyDirs,
      suggestions,
    };
  }

  /**
   * Get migration commands for moving to unified structure
   */
  getMigrationCommands(): string[] {
    const legacy = this.detectLegacyStructure();

    if (!legacy.hasLegacy) {
      return [];
    }

    return legacy.suggestions;
  }

  /**
   * Validate current directory structure
   */
  validateStructure(): {
    valid: boolean;
    issues: string[];
    missingDirs: string[];
  } {
    const _paths = this.getUnifiedPaths();
    const issues: string[] = [];
    const missingDirs: string[] = [];

    // Check if required directories exist
    const requiredDirs = this.getRequiredDirectories();

    for (const dir of requiredDirs) {
      if (!existsSync(dir)) {
        missingDirs.push(dir);
      }
    }

    // Check for legacy structure conflicts
    const legacy = this.detectLegacyStructure();
    if (legacy.hasLegacy) {
      issues.push(`Legacy directory structure detected: ${legacy.legacyDirs.join(', ')}`);
    }

    return {
      valid: issues.length === 0 && missingDirs.length === 0,
      issues,
      missingDirs,
    };
  }

  /**
   * Update CLI tasks directory override
   */
  setCliTasksDir(tasksDir: string): void {
    this.cliTasksDir = tasksDir;
  }

  /**
   * Clear CLI tasks directory override
   */
  clearCliTasksDir(): void {
    this.cliTasksDir = undefined;
  }

  /**
   * Show structure information for debugging
   */
  showStructureInfo(): void {
    const paths = this.getUnifiedPaths();
    const validation = this.validateStructure();

    console.log(`\n🏗️  AI-Trackdown Directory Structure`);
    console.log(`📁 Tasks Root: ${paths.tasksRoot}`);
    console.log(`   ├── 📂 epics/     → ${paths.epicsDir}`);
    console.log(`   ├── 📂 issues/    → ${paths.issuesDir}`);
    console.log(`   ├── 📂 tasks/     → ${paths.tasksDir}`);
    console.log(`   ├── 📂 prs/       → ${paths.prsDir}`);
    console.log(`   └── 📂 templates/ → ${paths.templatesDir}`);

    if (validation.missingDirs.length > 0) {
      console.log(`\n⚠️  Missing directories:`);
      validation.missingDirs.forEach((dir) => console.log(`   • ${dir}`));
    }

    if (validation.issues.length > 0) {
      console.log(`\n🚨 Issues detected:`);
      validation.issues.forEach((issue) => console.log(`   • ${issue}`));
    }

    const legacy = this.detectLegacyStructure();
    if (legacy.hasLegacy) {
      console.log(`\n📋 Migration suggestions:`);
      legacy.suggestions.forEach((suggestion) => console.log(`   ${suggestion}`));
    }
  }
}
