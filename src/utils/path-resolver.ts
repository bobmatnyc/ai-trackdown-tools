import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigManager } from './config.js';
import { type ProjectContext, ProjectDetector, type ProjectMode } from './project-detector.js';

/**
 * PathResolver provides configurable directory path resolution
 * with support for both single-project and multi-project modes
 * Priority: CLI option > Environment variable > Config file > Auto-detection > Default
 */
export class PathResolver {
  private configManager: ConfigManager;
  private cliRootDir?: string;
  private projectDetector: ProjectDetector;
  private projectContext?: ProjectContext;
  private modeOverride?: ProjectMode;

  constructor(
    configManager: ConfigManager,
    cliRootDir?: string,
    projectName?: string,
    modeOverride?: ProjectMode
  ) {
    this.configManager = configManager;
    this.cliRootDir = cliRootDir;
    this.modeOverride = modeOverride;
    this.projectDetector = new ProjectDetector(process.cwd(), configManager, modeOverride);

    // Initialize project context
    try {
      this.projectContext = this.projectDetector.getProjectContext(projectName);
    } catch (_error) {
      // Will be handled by individual methods if needed
    }
  }

  /**
   * Get the root directory with proper priority resolution:
   * 1. CLI option override (--root-dir, --tasks-dir)
   * 2. Environment variable (AITRACKDOWN_ROOT_DIR)
   * 3. Config file setting (rootDirectory)
   * 4. Project mode detection
   * 5. Default to "tasks/"
   */
  getRootDirectory(): string {
    // 1. CLI option takes highest priority
    if (this.cliRootDir) {
      return this.cliRootDir;
    }

    // 2. Environment variable override
    const envRootDir = process.env.AITRACKDOWN_ROOT_DIR || process.env.AITRACKDOWN_TASKS_DIR;
    if (envRootDir) {
      return envRootDir;
    }

    // 3. Config file setting
    const config = this.configManager.getConfig();
    if (config.rootDirectory) {
      return config.rootDirectory;
    }

    // 4. Project mode detection
    const projectPath = this.getProjectBasePath();
    if (projectPath !== process.cwd()) {
      // In multi-project mode, use tasks relative to project directory
      return join(projectPath, 'tasks');
    }

    // 5. Default to "tasks/" (NEW DEFAULT - was "trackdown/")
    return 'tasks';
  }

  /**
   * Get the project base path (project directory in multi-project mode)
   */
  getProjectBasePath(): string {
    if (!this.projectContext) {
      return process.cwd();
    }

    if (this.projectContext.mode === 'single') {
      return this.projectContext.projectRoot;
    }

    // Multi-project mode
    if (this.projectContext.currentProject) {
      return this.projectDetector.getProjectPath(this.projectContext.currentProject);
    }

    // No current project selected
    return this.projectContext.projectRoot;
  }

  /**
   * Get the epics directory
   */
  getEpicsDir(): string {
    return join(this.getRootDirectory(), 'epics');
  }

  /**
   * Get the issues directory
   */
  getIssuesDir(): string {
    return join(this.getRootDirectory(), 'issues');
  }

  /**
   * Get the tasks directory
   */
  getTasksDir(): string {
    return join(this.getRootDirectory(), 'tasks');
  }

  /**
   * Get the PRs directory
   */
  getPRsDir(): string {
    return join(this.getRootDirectory(), 'prs');
  }

  /**
   * Get the templates directory
   */
  getTemplatesDir(): string {
    return join(this.getRootDirectory(), 'templates');
  }

  /**
   * Get the exports directory
   */
  getExportsDir(): string {
    return join(this.getRootDirectory(), 'exports');
  }

  /**
   * Get the documentation directory
   */
  getDocsDir(): string {
    return join(this.getRootDirectory(), 'docs');
  }

  /**
   * Get the archived tasks directory
   */
  getArchivedDir(): string {
    return join(this.getRootDirectory(), 'archived');
  }

  /**
   * DEPRECATED: Legacy method for backward compatibility
   * Use getEpicsDir() instead
   */
  getActiveDir(): string {
    return this.getEpicsDir();
  }

  /**
   * DEPRECATED: Legacy method for backward compatibility
   * Use getArchivedDir() instead
   */
  getCompletedDir(): string {
    return this.getArchivedDir();
  }

  /**
   * Check if legacy "trackdown/" directory exists and root is still default
   */
  shouldMigrate(): boolean {
    const config = this.configManager.getConfig();
    const hasLegacyDir = existsSync(join(process.cwd(), 'trackdown'));
    const usingDefaultRoot = this.getRootDirectory() === 'tasks';
    const migrationEnabled = config.migrateFromTrackdown !== false;

    return hasLegacyDir && usingDefaultRoot && migrationEnabled;
  }

  /**
   * Get legacy trackdown directory for migration detection
   */
  getLegacyTrackdownDir(): string {
    return join(process.cwd(), 'trackdown');
  }

  /**
   * Get all standard directories that should be created
   */
  getStandardDirectories(): string[] {
    return [
      this.getEpicsDir(),
      this.getIssuesDir(),
      this.getTasksDir(),
      this.getPRsDir(),
      this.getTemplatesDir(),
      this.getExportsDir(),
      this.getDocsDir(),
      this.getArchivedDir(),
    ];
  }

  /**
   * Get directory for specific item type
   */
  getItemTypeDirectory(type: 'epic' | 'issue' | 'task' | 'pr'): string {
    switch (type) {
      case 'epic':
        return this.getEpicsDir();
      case 'issue':
        return this.getIssuesDir();
      case 'task':
        return this.getTasksDir();
      case 'pr':
        return this.getPRsDir();
      default:
        throw new Error(`Unknown item type: ${type}`);
    }
  }

  /**
   * Get template-specific directories based on project template
   */
  getTemplateDirectories(
    templateType: string
  ): Array<{ path: string; type: 'directory' | 'file' }> {
    const rootDir = this.getRootDirectory();

    const templates: Record<string, Array<{ path: string; type: 'directory' | 'file' }>> = {
      standard: [
        { path: join(rootDir, 'active'), type: 'directory' },
        { path: join(rootDir, 'completed'), type: 'directory' },
        { path: join(rootDir, 'templates'), type: 'directory' },
        { path: join(rootDir, 'exports'), type: 'directory' },
        { path: join(rootDir, 'docs'), type: 'directory' },
      ],
      cli: [
        { path: join(rootDir, 'features'), type: 'directory' },
        { path: join(rootDir, 'bugs'), type: 'directory' },
        { path: join(rootDir, 'releases'), type: 'directory' },
        { path: join(rootDir, 'documentation'), type: 'directory' },
      ],
      web: [
        { path: join(rootDir, 'frontend'), type: 'directory' },
        { path: join(rootDir, 'backend'), type: 'directory' },
        { path: join(rootDir, 'testing'), type: 'directory' },
        { path: join(rootDir, 'deployment'), type: 'directory' },
      ],
      api: [
        { path: join(rootDir, 'endpoints'), type: 'directory' },
        { path: join(rootDir, 'schemas'), type: 'directory' },
        { path: join(rootDir, 'testing'), type: 'directory' },
        { path: join(rootDir, 'documentation'), type: 'directory' },
      ],
      mobile: [
        { path: join(rootDir, 'features'), type: 'directory' },
        { path: join(rootDir, 'ui-ux'), type: 'directory' },
        { path: join(rootDir, 'testing'), type: 'directory' },
        { path: join(rootDir, 'releases'), type: 'directory' },
      ],
    };

    return templates[templateType] || templates.standard;
  }

  /**
   * Update CLI root directory override
   */
  setCliRootDir(rootDir: string): void {
    this.cliRootDir = rootDir;
  }

  /**
   * Clear CLI root directory override
   */
  clearCliRootDir(): void {
    this.cliRootDir = undefined;
  }

  /**
   * Set project context for multi-project operations
   */
  setProjectContext(projectName: string): void {
    this.projectContext = this.projectDetector.getProjectContext(projectName);
  }

  /**
   * Get current project context
   */
  getProjectContext(): ProjectContext | undefined {
    return this.projectContext;
  }

  /**
   * Get project mode (single or multi)
   */
  getProjectMode(): ProjectMode {
    return this.projectContext?.mode || 'single';
  }

  /**
   * List available projects in multi-project mode
   */
  getAvailableProjects(): string[] {
    return this.projectDetector.listAvailableProjects();
  }

  /**
   * Check if project exists
   */
  projectExists(projectName: string): boolean {
    return this.projectDetector.projectExists(projectName);
  }

  /**
   * Create new project directory structure
   */
  createProjectStructure(projectName?: string): void {
    const _projectPath = projectName
      ? this.projectDetector.createProject(projectName)
      : this.getProjectBasePath();

    // Create all standard directories
    const directories = this.getStandardDirectories();
    for (const dir of directories) {
      if (!existsSync(dir)) {
        require('node:fs').mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Show migration warning if legacy directory exists
   */
  showMigrationWarning(): void {
    if (this.shouldMigrate()) {
      console.warn(`
⚠️  LEGACY DIRECTORY DETECTED

Found existing "trackdown/" directory. The CLI now defaults to "${this.getRootDirectory()}/" directory.

Migration Options:
1. Automatic: Set AITRACKDOWN_ROOT_DIR=trackdown to continue using the existing directory
2. Manual: Move files from trackdown/ to ${this.getRootDirectory()}/ manually
3. Configuration: Update .trackdownrc.json with "rootDirectory": "trackdown"

Examples:
  export AITRACKDOWN_ROOT_DIR=trackdown    # Use existing directory
  aitrackdown --root-dir trackdown init    # Specify directory per command
      `);
    }

    // Show project detection info
    this.projectDetector.showDetectionInfo();
  }

  /**
   * Get migration command suggestions
   */
  getMigrationCommands(): string[] {
    if (!this.shouldMigrate()) {
      return [];
    }

    const rootDir = this.getRootDirectory();
    return [
      `# Option 1: Set environment variable to use existing trackdown/ directory`,
      `export AITRACKDOWN_ROOT_DIR=trackdown`,
      ``,
      `# Option 2: Move files to new ${rootDir}/ directory`,
      `mkdir -p ${rootDir}`,
      `mv trackdown/active ${rootDir}/active 2>/dev/null || true`,
      `mv trackdown/completed ${rootDir}/completed 2>/dev/null || true`,
      `mv trackdown/templates ${rootDir}/templates 2>/dev/null || true`,
      `mv trackdown/exports ${rootDir}/exports 2>/dev/null || true`,
      ``,
      `# Option 3: Update configuration file`,
      `echo '{"rootDirectory": "trackdown"}' > .trackdownrc.json`,
    ];
  }
}
