/**
 * Project Context Manager for AI-Trackdown CLI
 * Manages project context for CLI operations in both single and multi-project modes
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectConfig } from '../types/ai-trackdown.js';
import { ConfigManager } from './config-manager.js';
import { PathResolver } from './path-resolver.js';
import { type ProjectContext, ProjectDetector, type ProjectMode } from './project-detector.js';

export interface ContextualizedPaths {
  projectRoot: string;
  configDir: string;
  tasksRoot: string;
  epicsDir: string;
  issuesDir: string;
  tasksDir: string;
  prsDir: string;
  templatesDir: string;
}

export interface ProjectContextState {
  context: ProjectContext;
  paths: ContextualizedPaths;
  configManager: ConfigManager;
  pathResolver: PathResolver;
  projectDetector: ProjectDetector;
}

/**
 * ProjectContextManager handles project context setup and management
 * for CLI operations across both single and multi-project modes
 */
export class ProjectContextManager {
  private projectRoot: string;
  private currentContext?: ProjectContextState;
  private modeOverride?: ProjectMode;
  private cliRootDir?: string;

  constructor(
    projectRoot: string = process.cwd(),
    modeOverride?: ProjectMode,
    cliRootDir?: string
  ) {
    this.projectRoot = projectRoot;
    this.modeOverride = modeOverride;
    this.cliRootDir = cliRootDir;
  }

  /**
   * Initialize project context for CLI operations
   */
  async initializeContext(projectName?: string): Promise<ProjectContextState> {
    // Create project detector
    const projectDetector = new ProjectDetector(this.projectRoot, undefined, this.modeOverride);

    // Get project context
    const context = projectDetector.getProjectContext(projectName);

    // Determine the actual project root path
    const actualProjectRoot = this.getActualProjectRoot(context);

    // Create config manager for the project
    const configManager = new ConfigManager(actualProjectRoot);

    // Create path resolver with project context
    const pathResolver = new PathResolver(
      configManager,
      this.cliRootDir,
      context.currentProject,
      this.modeOverride
    );

    // Build contextualized paths
    const paths = this.buildContextualizedPaths(context, pathResolver, actualProjectRoot);

    // Create and cache the context state
    this.currentContext = {
      context,
      paths,
      configManager,
      pathResolver,
      projectDetector,
    };

    return this.currentContext;
  }

  /**
   * Get the current project context state
   */
  getCurrentContext(): ProjectContextState | undefined {
    return this.currentContext;
  }

  /**
   * Switch to a different project in multi-project mode
   */
  async switchProject(projectName: string): Promise<ProjectContextState> {
    if (!this.currentContext) {
      throw new Error('No project context initialized. Call initializeContext() first.');
    }

    if (this.currentContext.context.mode === 'single') {
      throw new Error('Cannot switch projects in single-project mode');
    }

    // Re-initialize with new project
    return await this.initializeContext(projectName);
  }

  /**
   * Create a new project in multi-project mode
   */
  async createProject(
    projectName: string,
    config?: Partial<ProjectConfig>
  ): Promise<ProjectContextState> {
    if (!this.currentContext) {
      // Initialize context first to detect mode
      await this.initializeContext();
    }

    if (!this.currentContext) {
      throw new Error('Failed to initialize project context');
    }

    if (this.currentContext.context.mode === 'single') {
      throw new Error('Cannot create projects in single-project mode');
    }

    // Create project directory
    const projectPath = this.currentContext.projectDetector.createProject(projectName);

    // Create directory structure
    mkdirSync(projectPath, { recursive: true });

    // Initialize project with config
    const projectConfigManager = new ConfigManager(projectPath);
    const _projectConfig = projectConfigManager.initializeProject(projectName, config);

    // Switch to the new project
    return await this.switchProject(projectName);
  }

  /**
   * List available projects
   */
  listProjects(): string[] {
    if (!this.currentContext) {
      throw new Error('No project context initialized. Call initializeContext() first.');
    }

    return this.currentContext.context.availableProjects;
  }

  /**
   * Get project mode
   */
  getProjectMode(): ProjectMode {
    if (!this.currentContext) {
      throw new Error('No project context initialized. Call initializeContext() first.');
    }

    return this.currentContext.context.mode;
  }

  /**
   * Get contextualized paths for current project
   */
  getPaths(): ContextualizedPaths {
    if (!this.currentContext) {
      throw new Error('No project context initialized. Call initializeContext() first.');
    }

    return this.currentContext.paths;
  }

  /**
   * Get path resolver for current project
   */
  getPathResolver(): PathResolver {
    if (!this.currentContext) {
      throw new Error('No project context initialized. Call initializeContext() first.');
    }

    return this.currentContext.pathResolver;
  }

  /**
   * Get config manager for current project
   */
  getConfigManager(): ConfigManager {
    if (!this.currentContext) {
      throw new Error('No project context initialized. Call initializeContext() first.');
    }

    return this.currentContext.configManager;
  }

  /**
   * Ensure project structure exists
   */
  async ensureProjectStructure(): Promise<void> {
    if (!this.currentContext) {
      throw new Error('No project context initialized. Call initializeContext() first.');
    }

    const { paths, configManager } = this.currentContext;

    // Create all required directories
    const directories = [
      paths.configDir,
      paths.tasksRoot,
      paths.epicsDir,
      paths.issuesDir,
      paths.tasksDir,
      paths.prsDir,
      paths.templatesDir,
    ];

    for (const dir of directories) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    // Initialize config if it doesn't exist
    if (!configManager.isProjectDirectory(paths.projectRoot)) {
      await configManager.initializeProject(
        this.currentContext.context.currentProject || 'default-project'
      );
    }
  }

  /**
   * Validate project context
   */
  validateContext(): {
    valid: boolean;
    issues: string[];
    warnings: string[];
  } {
    if (!this.currentContext) {
      return {
        valid: false,
        issues: ['No project context initialized'],
        warnings: [],
      };
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    // Check if project exists in multi-project mode
    if (this.currentContext.context.mode === 'multi') {
      if (!this.currentContext.context.currentProject) {
        issues.push('No project selected in multi-project mode');
      } else if (
        !this.currentContext.projectDetector.projectExists(
          this.currentContext.context.currentProject
        )
      ) {
        issues.push(`Project '${this.currentContext.context.currentProject}' does not exist`);
      }
    }

    // Check if required directories exist
    const requiredDirs = [this.currentContext.paths.configDir, this.currentContext.paths.tasksRoot];

    for (const dir of requiredDirs) {
      if (!existsSync(dir)) {
        warnings.push(`Required directory does not exist: ${dir}`);
      }
    }

    // Check config validity
    try {
      const _config = this.currentContext.configManager.getConfig();
      const validation = this.currentContext.configManager.validateConfig();
      if (!validation.valid) {
        issues.push(...validation.errors);
      }
    } catch (error) {
      issues.push(
        `Configuration error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
    };
  }

  /**
   * Show context information
   */
  showContextInfo(): void {
    if (!this.currentContext) {
      console.log('❌ No project context initialized');
      return;
    }

    const { context, paths } = this.currentContext;

    console.log(`\n📋 Project Context Information`);
    console.log(`Mode: ${context.mode.toUpperCase()}`);
    console.log(`Root: ${context.projectRoot}`);

    if (context.mode === 'multi') {
      console.log(`Projects Directory: ${context.projectsDir || 'Not set'}`);
      console.log(`Current Project: ${context.currentProject || 'None selected'}`);
      console.log(`Available Projects: ${context.availableProjects.join(', ') || 'None'}`);
    }

    console.log(`\n📁 Directory Structure:`);
    console.log(`   Config: ${paths.configDir}`);
    console.log(`   Tasks Root: ${paths.tasksRoot}`);
    console.log(`   ├── Epics: ${paths.epicsDir}`);
    console.log(`   ├── Issues: ${paths.issuesDir}`);
    console.log(`   ├── Tasks: ${paths.tasksDir}`);
    console.log(`   ├── PRs: ${paths.prsDir}`);
    console.log(`   └── Templates: ${paths.templatesDir}`);

    // Show validation results
    const validation = this.validateContext();
    if (!validation.valid) {
      console.log(`\n❌ Context Issues:`);
      validation.issues.forEach((issue) => console.log(`   • ${issue}`));
    }

    if (validation.warnings.length > 0) {
      console.log(`\n⚠️  Warnings:`);
      validation.warnings.forEach((warning) => console.log(`   • ${warning}`));
    }
  }

  /**
   * Get the actual project root path based on context
   */
  private getActualProjectRoot(context: ProjectContext): string {
    if (context.mode === 'single') {
      return context.projectRoot;
    }

    // Multi-project mode
    if (context.currentProject) {
      return join(
        context.projectsDir || join(context.projectRoot, 'projects'),
        context.currentProject
      );
    }

    // No project selected in multi-project mode
    return context.projectRoot;
  }

  /**
   * Build contextualized paths for the current project
   */
  private buildContextualizedPaths(
    _context: ProjectContext,
    pathResolver: PathResolver,
    actualProjectRoot: string
  ): ContextualizedPaths {
    return {
      projectRoot: actualProjectRoot,
      configDir: join(actualProjectRoot, '.ai-trackdown'),
      tasksRoot: pathResolver.getRootDirectory(),
      epicsDir: pathResolver.getEpicsDir(),
      issuesDir: pathResolver.getIssuesDir(),
      tasksDir: pathResolver.getTasksDir(),
      prsDir: pathResolver.getPRsDir(),
      templatesDir: pathResolver.getTemplatesDir(),
    };
  }

  /**
   * Reset context (useful for testing)
   */
  reset(): void {
    this.currentContext = undefined;
  }

  /**
   * Set mode override
   */
  setModeOverride(mode: ProjectMode | undefined): void {
    this.modeOverride = mode;
    // Reset context to force re-initialization
    this.currentContext = undefined;
  }

  /**
   * Set CLI root directory override
   */
  setCliRootDir(rootDir: string | undefined): void {
    this.cliRootDir = rootDir;
    // Reset context to force re-initialization
    this.currentContext = undefined;
  }
}
