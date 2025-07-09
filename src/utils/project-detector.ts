/**
 * Project Detection System for AI-Trackdown CLI
 * Automatically determines whether to operate in single-project or multi-project mode
 * and resolves paths accordingly.
 */

import { join, dirname } from 'node:path';
import { existsSync, readdirSync, statSync } from 'node:fs';
import type { ConfigManager } from './config-manager.js';

export type ProjectMode = 'single' | 'multi';

export interface ProjectDetectionResult {
  mode: ProjectMode;
  projectRoot: string;
  projectsDir?: string;
  detectedProjects?: string[];
  migrationNeeded: boolean;
  recommendations: string[];
}

export interface ProjectContext {
  mode: ProjectMode;
  projectRoot: string;
  projectsDir?: string;
  currentProject?: string;
  availableProjects: string[];
}

/**
 * ProjectDetector class handles automatic detection of project structure
 * and determines whether to operate in single-project or multi-project mode.
 */
export class ProjectDetector {
  private projectRoot: string;
  private configManager?: ConfigManager;
  private modeOverride?: ProjectMode;

  constructor(
    projectRoot: string = process.cwd(),
    configManager?: ConfigManager,
    modeOverride?: ProjectMode
  ) {
    this.projectRoot = projectRoot;
    this.configManager = configManager;
    this.modeOverride = modeOverride;
  }

  /**
   * Detect project mode based on directory structure and configuration
   */
  detectProjectMode(): ProjectDetectionResult {
    // Check for explicit mode override
    if (this.modeOverride) {
      return this.buildDetectionResult(this.modeOverride);
    }

    // Check environment variable override
    const envMode = this.getEnvironmentMode();
    if (envMode) {
      return this.buildDetectionResult(envMode);
    }

    // Check configuration file override
    const configMode = this.getConfigurationMode();
    if (configMode) {
      return this.buildDetectionResult(configMode);
    }

    // Auto-detect based on directory structure
    return this.autoDetectMode();
  }

  /**
   * Get environment variable mode override
   */
  private getEnvironmentMode(): ProjectMode | null {
    const envMode = process.env.AITRACKDOWN_PROJECT_MODE;
    if (envMode === 'single' || envMode === 'multi') {
      return envMode;
    }
    return null;
  }

  /**
   * Get configuration file mode override
   */
  private getConfigurationMode(): ProjectMode | null {
    if (!this.configManager) {
      return null;
    }

    try {
      const config = this.configManager.getConfig();
      // Check for project_mode in config
      if ('project_mode' in config && (config.project_mode === 'single' || config.project_mode === 'multi')) {
        return config.project_mode as ProjectMode;
      }
    } catch (error) {
      // Config not found or invalid - continue with auto-detection
    }

    return null;
  }

  /**
   * Auto-detect project mode based on directory structure
   */
  private autoDetectMode(): ProjectDetectionResult {
    const indicators = this.scanDirectoryIndicators();
    
    // Multi-project indicators (in order of priority):
    // 1. projects/ directory exists
    // 2. PRJ-XXXX files exist in root
    // 3. Multiple .ai-trackdown directories in subdirectories
    
    if (indicators.hasProjectsDirectory) {
      return this.buildDetectionResult('multi', {
        projectsDir: join(this.projectRoot, 'projects'),
        detectedProjects: indicators.projectsInDirectory,
        migrationNeeded: false,
        recommendations: indicators.multiProjectRecommendations
      });
    }

    if (indicators.hasPRJFiles) {
      return this.buildDetectionResult('multi', {
        detectedProjects: indicators.prjFileProjects,
        migrationNeeded: true,
        recommendations: indicators.migrationRecommendations
      });
    }

    if (indicators.hasMultipleAITrackdownDirs) {
      return this.buildDetectionResult('multi', {
        detectedProjects: indicators.aiTrackdownProjects,
        migrationNeeded: true,
        recommendations: indicators.consolidationRecommendations
      });
    }

    // Default to single-project mode
    return this.buildDetectionResult('single', {
      migrationNeeded: indicators.hasLegacyStructure,
      recommendations: indicators.singleProjectRecommendations
    });
  }

  /**
   * Scan directory for project mode indicators
   */
  private scanDirectoryIndicators() {
    const indicators = {
      hasProjectsDirectory: false,
      projectsInDirectory: [] as string[],
      hasPRJFiles: false,
      prjFileProjects: [] as string[],
      hasMultipleAITrackdownDirs: false,
      aiTrackdownProjects: [] as string[],
      hasLegacyStructure: false,
      multiProjectRecommendations: [] as string[],
      migrationRecommendations: [] as string[],
      consolidationRecommendations: [] as string[],
      singleProjectRecommendations: [] as string[]
    };

    try {
      const entries = readdirSync(this.projectRoot, { withFileTypes: true });

      // Check for projects/ directory
      const projectsDir = entries.find(entry => entry.isDirectory() && entry.name === 'projects');
      if (projectsDir) {
        indicators.hasProjectsDirectory = true;
        const projectsPath = join(this.projectRoot, 'projects');
        try {
          const projectEntries = readdirSync(projectsPath, { withFileTypes: true });
          indicators.projectsInDirectory = projectEntries
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name);
        } catch (error) {
          // projects directory not readable
        }
      }

      // Check for PRJ-XXXX files
      const prjFiles = entries.filter(entry => 
        entry.isFile() && /^PRJ-\d{4}.*\.md$/.test(entry.name)
      );
      if (prjFiles.length > 0) {
        indicators.hasPRJFiles = true;
        indicators.prjFileProjects = prjFiles.map(file => file.name);
        indicators.migrationRecommendations.push(
          'Detected PRJ-XXXX files in root directory',
          'Consider creating projects/ directory structure:',
          'mkdir -p projects/',
          ...prjFiles.map(file => `mkdir -p projects/${file.name.replace(/\.md$/, '')}/`)
        );
      }

      // Check for multiple .ai-trackdown directories
      const subdirs = entries.filter(entry => entry.isDirectory() && entry.name !== 'projects');
      let aiTrackdownCount = 0;
      
      for (const subdir of subdirs) {
        const aiTrackdownPath = join(this.projectRoot, subdir.name, '.ai-trackdown');
        if (existsSync(aiTrackdownPath)) {
          aiTrackdownCount++;
          indicators.aiTrackdownProjects.push(subdir.name);
        }
      }

      if (aiTrackdownCount > 1) {
        indicators.hasMultipleAITrackdownDirs = true;
        indicators.consolidationRecommendations.push(
          'Multiple .ai-trackdown directories detected',
          'Consider consolidating into multi-project structure:',
          'mkdir -p projects/',
          ...indicators.aiTrackdownProjects.map(proj => `mv ${proj} projects/${proj}/`)
        );
      }

      // Check for legacy structure indicators
      const legacyDirs = ['trackdown', 'epics', 'issues', 'tasks'].filter(dir => 
        entries.some(entry => entry.isDirectory() && entry.name === dir)
      );
      
      if (legacyDirs.length > 0) {
        indicators.hasLegacyStructure = true;
        indicators.singleProjectRecommendations.push(
          'Legacy directory structure detected',
          'Consider running migration:',
          'aitrackdown migrate-structure --from-legacy'
        );
      }

    } catch (error) {
      // Directory not readable - continue with defaults
    }

    return indicators;
  }

  /**
   * Build detection result with common fields
   */
  private buildDetectionResult(
    mode: ProjectMode,
    options: Partial<ProjectDetectionResult> = {}
  ): ProjectDetectionResult {
    return {
      mode,
      projectRoot: this.projectRoot,
      projectsDir: options.projectsDir,
      detectedProjects: options.detectedProjects || [],
      migrationNeeded: options.migrationNeeded || false,
      recommendations: options.recommendations || [],
      ...options
    };
  }

  /**
   * Get project context for CLI operations
   */
  getProjectContext(projectName?: string): ProjectContext {
    const detection = this.detectProjectMode();
    
    const context: ProjectContext = {
      mode: detection.mode,
      projectRoot: detection.projectRoot,
      projectsDir: detection.projectsDir,
      availableProjects: detection.detectedProjects || []
    };

    if (detection.mode === 'multi') {
      if (projectName) {
        // Validate project exists
        if (context.availableProjects.includes(projectName)) {
          context.currentProject = projectName;
        } else {
          throw new Error(`Project '${projectName}' not found. Available projects: ${context.availableProjects.join(', ')}`);
        }
      } else if (context.availableProjects.length === 1) {
        // Auto-select single project
        context.currentProject = context.availableProjects[0];
      }
    }

    return context;
  }

  /**
   * List available projects in multi-project mode
   */
  listAvailableProjects(): string[] {
    const detection = this.detectProjectMode();
    
    if (detection.mode === 'single') {
      return [];
    }

    return detection.detectedProjects || [];
  }

  /**
   * Check if project exists in multi-project mode
   */
  projectExists(projectName: string): boolean {
    const detection = this.detectProjectMode();
    
    if (detection.mode === 'single') {
      return false;
    }

    return (detection.detectedProjects || []).includes(projectName);
  }

  /**
   * Get project directory path
   */
  getProjectPath(projectName?: string): string {
    const detection = this.detectProjectMode();
    
    if (detection.mode === 'single') {
      return this.projectRoot;
    }

    if (!projectName) {
      throw new Error('Project name required in multi-project mode');
    }

    if (!this.projectExists(projectName)) {
      throw new Error(`Project '${projectName}' not found`);
    }

    return join(detection.projectsDir || join(this.projectRoot, 'projects'), projectName);
  }

  /**
   * Create new project in multi-project mode
   */
  createProject(projectName: string): string {
    const detection = this.detectProjectMode();
    
    if (detection.mode === 'single') {
      throw new Error('Cannot create project in single-project mode');
    }

    const projectsDir = detection.projectsDir || join(this.projectRoot, 'projects');
    const projectPath = join(projectsDir, projectName);

    if (existsSync(projectPath)) {
      throw new Error(`Project '${projectName}' already exists`);
    }

    return projectPath;
  }

  /**
   * Set mode override for testing or explicit control
   */
  setModeOverride(mode: ProjectMode | undefined): void {
    this.modeOverride = mode;
  }

  /**
   * Show detection results and recommendations
   */
  showDetectionInfo(): void {
    const detection = this.detectProjectMode();
    
    console.log(`\n🔍 AI-Trackdown Project Detection`);
    console.log(`Mode: ${detection.mode.toUpperCase()}`);
    console.log(`Root: ${detection.projectRoot}`);
    
    if (detection.mode === 'multi') {
      console.log(`Projects Directory: ${detection.projectsDir || 'Not set'}`);
      if (detection.detectedProjects && detection.detectedProjects.length > 0) {
        console.log(`Available Projects: ${detection.detectedProjects.join(', ')}`);
      }
    }

    if (detection.migrationNeeded) {
      console.log(`\n⚠️  Migration needed`);
    }

    if (detection.recommendations.length > 0) {
      console.log(`\n📋 Recommendations:`);
      detection.recommendations.forEach(rec => console.log(`   ${rec}`));
    }
  }
}