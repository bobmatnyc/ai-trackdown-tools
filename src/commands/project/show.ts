/**
 * Project Show Command
 * Displays detailed information about a specific project
 */

import { Command } from 'commander';
import { ProjectContextManager } from '../../utils/project-context-manager.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

interface ShowOptions {
  format?: 'table' | 'json';
  showStats?: boolean;
  showConfig?: boolean;
  showStructure?: boolean;
}

export function createProjectShowCommand(): Command {
  const cmd = new Command('show');
  
  cmd
    .description('Show detailed information about a project')
    .argument('[name]', 'project name (defaults to current project)')
    .option('-f, --format <type>', 'output format (table|json)', 'table')
    .option('-s, --show-stats', 'show project statistics', false)
    .option('-c, --show-config', 'show project configuration', false)
    .option('--show-structure', 'show directory structure', false)
    .action(async (nameArg: string | undefined, options: ShowOptions) => {
      try {
        await showProject(nameArg, options);
      } catch (error) {
        console.error(Formatter.error(`Failed to show project: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}

async function showProject(name: string | undefined, options: ShowOptions): Promise<void> {
  const contextManager = new ProjectContextManager();
  
  // Initialize context to detect mode
  await contextManager.initializeContext();
  
  // Check if we're in multi-project mode
  const mode = contextManager.getProjectMode();
  if (mode === 'single') {
    console.log(Formatter.info('Single-project mode detected.'));
    await showSingleProjectInfo(contextManager, options);
    return;
  }
  
  // Get project name
  const currentContext = contextManager.getCurrentContext();
  const targetProject = name || currentContext?.context.currentProject;
  
  if (!targetProject) {
    throw new Error('No project specified and no current project selected.');
  }
  
  // Get available projects
  const projects = contextManager.listProjects();
  if (!projects.includes(targetProject)) {
    throw new Error(`Project '${targetProject}' not found. Available projects: ${projects.join(', ')}`);
  }
  
  // Switch to target project if not current
  if (targetProject !== currentContext?.context.currentProject) {
    await contextManager.switchProject(targetProject);
  }
  
  const projectContext = contextManager.getCurrentContext();
  if (!projectContext) {
    throw new Error('Failed to get project context');
  }
  
  // Get project configuration
  const configManager = projectContext.configManager;
  const config = configManager.getConfig();
  const paths = projectContext.paths;
  
  // Collect project information
  const projectInfo = {
    name: targetProject,
    mode: mode,
    project_root: paths.projectRoot,
    config_dir: paths.configDir,
    tasks_root: paths.tasksRoot,
    status: existsSync(paths.projectRoot) ? 'active' : 'inactive',
    config: config
  };
  
  // Get project statistics if requested
  let stats: any = {};
  if (options.showStats) {
    stats = await getProjectStats(paths);
  }
  
  // Format output
  switch (options.format) {
    case 'json':
      const jsonOutput: any = {
        project: projectInfo,
        paths: paths
      };
      
      if (options.showStats) {
        jsonOutput.statistics = stats;
      }
      
      if (options.showConfig) {
        jsonOutput.configuration = config;
      }
      
      console.log(JSON.stringify(jsonOutput, null, 2));
      break;
      
    case 'table':
    default:
      console.log(Formatter.info(`\n📋 Project: ${targetProject}`));
      console.log(Formatter.info(`Mode: ${mode.toUpperCase()}`));
      console.log(Formatter.info(`Status: ${projectInfo.status === 'active' ? '✅ Active' : '❌ Inactive'}`));
      console.log(Formatter.info(`Root: ${paths.projectRoot}`));
      console.log(Formatter.info(`Config: ${paths.configDir}`));
      console.log(Formatter.info(`Tasks: ${paths.tasksRoot}`));
      
      if (options.showStructure) {
        console.log(Formatter.info('\n📁 Directory Structure:'));
        console.log(Formatter.info(`   ├── Epics: ${paths.epicsDir}`));
        console.log(Formatter.info(`   ├── Issues: ${paths.issuesDir}`));
        console.log(Formatter.info(`   ├── Tasks: ${paths.tasksDir}`));
        console.log(Formatter.info(`   ├── PRs: ${paths.prsDir}`));
        console.log(Formatter.info(`   └── Templates: ${paths.templatesDir}`));
      }
      
      if (options.showStats && stats) {
        console.log(Formatter.info('\n📊 Project Statistics:'));
        console.log(Formatter.info(`   Epics: ${stats.epics || 0}`));
        console.log(Formatter.info(`   Issues: ${stats.issues || 0}`));
        console.log(Formatter.info(`   Tasks: ${stats.tasks || 0}`));
        console.log(Formatter.info(`   PRs: ${stats.prs || 0}`));
        console.log(Formatter.info(`   Total Items: ${stats.total || 0}`));
      }
      
      if (options.showConfig) {
        console.log(Formatter.info('\n⚙️  Configuration:'));
        console.log(Formatter.info(`   Version: ${config.version}`));
        console.log(Formatter.info(`   Default Assignee: ${config.default_assignee || 'Not set'}`));
        console.log(Formatter.info(`   File Extension: ${config.naming_conventions.file_extension}`));
        console.log(Formatter.info(`   Epic Prefix: ${config.naming_conventions.epic_prefix}`));
        console.log(Formatter.info(`   Issue Prefix: ${config.naming_conventions.issue_prefix}`));
        console.log(Formatter.info(`   Task Prefix: ${config.naming_conventions.task_prefix}`));
        if (config.naming_conventions.pr_prefix) {
          console.log(Formatter.info(`   PR Prefix: ${config.naming_conventions.pr_prefix}`));
        }
      }
      
      console.log(Formatter.info('\nUse "aitrackdown project switch" to switch to this project.'));
      console.log(Formatter.info('Use "aitrackdown status" to see project status.'));
      break;
  }
}

async function showSingleProjectInfo(contextManager: ProjectContextManager, options: ShowOptions): Promise<void> {
  const currentContext = contextManager.getCurrentContext();
  if (!currentContext) {
    throw new Error('No project context available');
  }
  
  const paths = currentContext.paths;
  const config = currentContext.configManager.getConfig();
  
  console.log(Formatter.info(`\n📋 Single Project Mode`));
  console.log(Formatter.info(`Root: ${paths.projectRoot}`));
  console.log(Formatter.info(`Config: ${paths.configDir}`));
  console.log(Formatter.info(`Tasks: ${paths.tasksRoot}`));
  
  if (options.showStats) {
    const stats = await getProjectStats(paths);
    console.log(Formatter.info('\n📊 Project Statistics:'));
    console.log(Formatter.info(`   Epics: ${stats.epics || 0}`));
    console.log(Formatter.info(`   Issues: ${stats.issues || 0}`));
    console.log(Formatter.info(`   Tasks: ${stats.tasks || 0}`));
    console.log(Formatter.info(`   PRs: ${stats.prs || 0}`));
    console.log(Formatter.info(`   Total Items: ${stats.total || 0}`));
  }
  
  if (options.showConfig) {
    console.log(Formatter.info('\n⚙️  Configuration:'));
    console.log(Formatter.info(`   Version: ${config.version}`));
    console.log(Formatter.info(`   Default Assignee: ${config.default_assignee || 'Not set'}`));
    console.log(Formatter.info(`   File Extension: ${config.naming_conventions.file_extension}`));
  }
}

async function getProjectStats(paths: any): Promise<any> {
  const stats = {
    epics: 0,
    issues: 0,
    tasks: 0,
    prs: 0,
    total: 0
  };
  
  try {
    if (existsSync(paths.epicsDir)) {
      stats.epics = readdirSync(paths.epicsDir).filter(file => file.endsWith('.md')).length;
    }
    
    if (existsSync(paths.issuesDir)) {
      stats.issues = readdirSync(paths.issuesDir).filter(file => file.endsWith('.md')).length;
    }
    
    if (existsSync(paths.tasksDir)) {
      stats.tasks = readdirSync(paths.tasksDir).filter(file => file.endsWith('.md')).length;
    }
    
    if (existsSync(paths.prsDir)) {
      stats.prs = readdirSync(paths.prsDir).filter(file => file.endsWith('.md')).length;
    }
    
    stats.total = stats.epics + stats.issues + stats.tasks + stats.prs;
  } catch (error) {
    console.warn(Formatter.warning(`Failed to collect statistics: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }
  
  return stats;
}