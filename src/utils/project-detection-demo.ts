/**
 * Project Detection System Demo
 * Demonstrates the integration of ProjectDetector, PathResolver, and ProjectContextManager
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigManager } from './config-manager.js';
import { PathResolver } from './path-resolver.js';
import { ProjectContextManager } from './project-context-manager.js';
import { ProjectDetector } from './project-detector.js';

/**
 * Demo setup for testing project detection
 */
export class ProjectDetectionDemo {
  private testRoot: string;
  private originalCwd: string;

  constructor(testRoot: string = '/tmp/ai-trackdown-test') {
    this.testRoot = testRoot;
    this.originalCwd = process.cwd();
  }

  /**
   * Set up demo environment
   */
  async setup(): Promise<void> {
    console.log('🏗️  Setting up demo environment...');

    // Clean up any existing test directory
    if (existsSync(this.testRoot)) {
      rmSync(this.testRoot, { recursive: true, force: true });
    }

    // Create test directory structure
    mkdirSync(this.testRoot, { recursive: true });
    process.chdir(this.testRoot);

    console.log(`📁 Demo environment created at: ${this.testRoot}`);
  }

  /**
   * Clean up demo environment
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up demo environment...');

    process.chdir(this.originalCwd);

    if (existsSync(this.testRoot)) {
      rmSync(this.testRoot, { recursive: true, force: true });
    }

    console.log('✅ Demo environment cleaned up');
  }

  /**
   * Demo 1: Single project mode detection
   */
  async demoSingleProjectMode(): Promise<void> {
    console.log('\n🔍 Demo 1: Single Project Mode Detection');
    console.log('=====================================');

    // Create single project structure
    const directories = [
      'tasks/epics',
      'tasks/issues',
      'tasks/tasks',
      'tasks/prs',
      'tasks/templates',
    ];
    directories.forEach((dir) => mkdirSync(join(this.testRoot, dir), { recursive: true }));

    // Create config file
    mkdirSync(join(this.testRoot, '.ai-trackdown'), { recursive: true });
    writeFileSync(
      join(this.testRoot, '.ai-trackdown/config.yaml'),
      `
name: demo-project
version: 1.0.0
description: Demo single project
tasks_directory: tasks
structure:
  epics_dir: epics
  issues_dir: issues
  tasks_dir: tasks
  prs_dir: prs
  templates_dir: templates
naming_conventions:
  epic_prefix: EP
  issue_prefix: ISS
  task_prefix: TSK
  pr_prefix: PR
  file_extension: .md
`
    );

    // Test detection
    const detector = new ProjectDetector(this.testRoot);
    const detection = detector.detectProjectMode();

    console.log('Detection Result:', detection);

    // Test path resolution
    const configManager = new ConfigManager(this.testRoot);
    const pathResolver = new PathResolver(configManager);

    console.log('Path Resolution:');
    console.log(`  Root Directory: ${pathResolver.getRootDirectory()}`);
    console.log(`  Epics Directory: ${pathResolver.getEpicsDir()}`);
    console.log(`  Issues Directory: ${pathResolver.getIssuesDir()}`);
    console.log(`  Tasks Directory: ${pathResolver.getTasksDir()}`);
    console.log(`  PRs Directory: ${pathResolver.getPRsDir()}`);
    console.log(`  Templates Directory: ${pathResolver.getTemplatesDir()}`);

    // Test context manager
    const contextManager = new ProjectContextManager(this.testRoot);
    const context = await contextManager.initializeContext();

    console.log('Context Manager:');
    console.log(`  Mode: ${context.context.mode}`);
    console.log(`  Project Root: ${context.paths.projectRoot}`);
    console.log(`  Tasks Root: ${context.paths.tasksRoot}`);

    contextManager.showContextInfo();
  }

  /**
   * Demo 2: Multi-project mode detection
   */
  async demoMultiProjectMode(): Promise<void> {
    console.log('\n🔍 Demo 2: Multi-Project Mode Detection');
    console.log('=====================================');

    // Create multi-project structure
    const projects = ['project-a', 'project-b', 'project-c'];

    mkdirSync(join(this.testRoot, 'projects'), { recursive: true });

    for (const project of projects) {
      const projectPath = join(this.testRoot, 'projects', project);
      const directories = [
        'tasks/epics',
        'tasks/issues',
        'tasks/tasks',
        'tasks/prs',
        'tasks/templates',
      ];

      directories.forEach((dir) => mkdirSync(join(projectPath, dir), { recursive: true }));

      // Create config file for each project
      mkdirSync(join(projectPath, '.ai-trackdown'), { recursive: true });
      writeFileSync(
        join(projectPath, '.ai-trackdown/config.yaml'),
        `
name: ${project}
version: 1.0.0
description: Demo project ${project}
tasks_directory: tasks
structure:
  epics_dir: epics
  issues_dir: issues
  tasks_dir: tasks
  prs_dir: prs
  templates_dir: templates
naming_conventions:
  epic_prefix: EP
  issue_prefix: ISS
  task_prefix: TSK
  pr_prefix: PR
  file_extension: .md
`
      );
    }

    // Test detection
    const detector = new ProjectDetector(this.testRoot);
    const detection = detector.detectProjectMode();

    console.log('Detection Result:', detection);

    // Test context manager with project selection
    const contextManager = new ProjectContextManager(this.testRoot);
    const context = await contextManager.initializeContext('project-a');

    console.log('Context Manager (project-a):');
    console.log(`  Mode: ${context.context.mode}`);
    console.log(`  Current Project: ${context.context.currentProject}`);
    console.log(`  Available Projects: ${context.context.availableProjects.join(', ')}`);
    console.log(`  Project Root: ${context.paths.projectRoot}`);
    console.log(`  Tasks Root: ${context.paths.tasksRoot}`);

    contextManager.showContextInfo();

    // Test project switching
    console.log('\n🔄 Testing Project Switching...');
    const switchedContext = await contextManager.switchProject('project-b');
    console.log(`Switched to: ${switchedContext.context.currentProject}`);

    // Test project listing
    console.log('\n📋 Available Projects:');
    const projectList = contextManager.listProjects();
    projectList.forEach((project) => console.log(`  • ${project}`));
  }

  /**
   * Demo 3: Environment variable overrides
   */
  async demoEnvironmentOverrides(): Promise<void> {
    console.log('\n🔍 Demo 3: Environment Variable Overrides');
    console.log('=========================================');

    // Set environment variables
    process.env.AITRACKDOWN_PROJECT_MODE = 'single';
    process.env.AITRACKDOWN_TASKS_DIR = 'custom-tasks';

    // Create structure with custom directory
    const directories = [
      'custom-tasks/epics',
      'custom-tasks/issues',
      'custom-tasks/tasks',
      'custom-tasks/prs',
      'custom-tasks/templates',
    ];
    directories.forEach((dir) => mkdirSync(join(this.testRoot, dir), { recursive: true }));

    // Create config file
    mkdirSync(join(this.testRoot, '.ai-trackdown'), { recursive: true });
    writeFileSync(
      join(this.testRoot, '.ai-trackdown/config.yaml'),
      `
name: demo-env-project
version: 1.0.0
description: Demo with environment overrides
tasks_directory: tasks
project_mode: multi
structure:
  epics_dir: epics
  issues_dir: issues
  tasks_dir: tasks
  prs_dir: prs
  templates_dir: templates
naming_conventions:
  epic_prefix: EP
  issue_prefix: ISS
  task_prefix: TSK
  pr_prefix: PR
  file_extension: .md
`
    );

    // Test detection with environment overrides
    const detector = new ProjectDetector(this.testRoot);
    const detection = detector.detectProjectMode();

    console.log('Detection Result (with env overrides):');
    console.log(`  Mode: ${detection.mode} (overridden from config)`);
    console.log(`  Project Root: ${detection.projectRoot}`);

    // Test path resolution with environment overrides
    const configManager = new ConfigManager(this.testRoot);
    const pathResolver = new PathResolver(configManager);

    console.log('Path Resolution (with env overrides):');
    console.log(`  Root Directory: ${pathResolver.getRootDirectory()} (overridden from config)`);
    console.log(`  Epics Directory: ${pathResolver.getEpicsDir()}`);
    console.log(`  Issues Directory: ${pathResolver.getIssuesDir()}`);

    // Test context manager with environment overrides
    const contextManager = new ProjectContextManager(this.testRoot);
    const context = await contextManager.initializeContext();

    console.log('Context Manager (with env overrides):');
    console.log(`  Mode: ${context.context.mode} (env override)`);
    console.log(`  Tasks Root: ${context.paths.tasksRoot} (env override)`);

    contextManager.showContextInfo();

    // Clean up environment variables
    delete process.env.AITRACKDOWN_PROJECT_MODE;
    delete process.env.AITRACKDOWN_TASKS_DIR;
  }

  /**
   * Demo 4: Migration detection
   */
  async demoMigrationDetection(): Promise<void> {
    console.log('\n🔍 Demo 4: Migration Detection');
    console.log('==============================');

    // Create legacy structure
    const legacyDirs = ['trackdown/active', 'trackdown/completed', 'trackdown/templates'];
    legacyDirs.forEach((dir) => mkdirSync(join(this.testRoot, dir), { recursive: true }));

    // Create some legacy files
    writeFileSync(
      join(this.testRoot, 'trackdown/active/EP-001-legacy-epic.md'),
      '# Legacy Epic\n\nThis is a legacy epic'
    );
    writeFileSync(
      join(this.testRoot, 'trackdown/active/ISS-001-legacy-issue.md'),
      '# Legacy Issue\n\nThis is a legacy issue'
    );

    // Create PRJ files (another legacy indicator)
    writeFileSync(
      join(this.testRoot, 'PRJ-001-legacy-project.md'),
      '# Legacy Project\n\nThis is a legacy project file'
    );

    // Test detection
    const detector = new ProjectDetector(this.testRoot);
    const detection = detector.detectProjectMode();

    console.log('Detection Result (with legacy structure):');
    console.log(`  Mode: ${detection.mode}`);
    console.log(`  Migration Needed: ${detection.migrationNeeded}`);
    console.log(`  Detected Projects: ${detection.detectedProjects?.join(', ') || 'None'}`);

    if (detection.recommendations.length > 0) {
      console.log('Migration Recommendations:');
      detection.recommendations.forEach((rec) => console.log(`  ${rec}`));
    }

    // Test path resolver migration detection
    const configManager = new ConfigManager(this.testRoot);
    const pathResolver = new PathResolver(configManager);

    console.log('\nPath Resolver Migration Detection:');
    console.log(`  Should Migrate: ${pathResolver.shouldMigrate()}`);
    console.log(`  Legacy Directory: ${pathResolver.getLegacyTrackdownDir()}`);

    const migrationCommands = pathResolver.getMigrationCommands();
    if (migrationCommands.length > 0) {
      console.log('Migration Commands:');
      migrationCommands.forEach((cmd) => console.log(`  ${cmd}`));
    }

    // Show migration warning
    pathResolver.showMigrationWarning();
  }

  /**
   * Run all demos
   */
  async runAllDemos(): Promise<void> {
    try {
      await this.setup();

      await this.demoSingleProjectMode();
      await this.cleanup();
      await this.setup();

      await this.demoMultiProjectMode();
      await this.cleanup();
      await this.setup();

      await this.demoEnvironmentOverrides();
      await this.cleanup();
      await this.setup();

      await this.demoMigrationDetection();
    } finally {
      await this.cleanup();
    }
  }
}

// Export for use in other modules
export default ProjectDetectionDemo;

// If run directly, execute all demos
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new ProjectDetectionDemo();
  demo.runAllDemos().catch(console.error);
}
