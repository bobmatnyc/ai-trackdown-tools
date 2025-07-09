/**
 * Project Switch Command
 * Switches the current project context in multi-project mode
 */

import { Command } from 'commander';
import { ProjectContextManager } from '../../utils/project-context-manager.js';
import { Formatter } from '../../utils/formatter.js';

interface SwitchOptions {
  create?: boolean;
  force?: boolean;
}

export function createProjectSwitchCommand(): Command {
  const cmd = new Command('switch');
  
  cmd
    .description('Switch to a different project')
    .argument('<name>', 'project name to switch to')
    .option('-c, --create', 'create project if it does not exist', false)
    .option('-f, --force', 'force switch even if project appears inactive', false)
    .action(async (name: string, options: SwitchOptions) => {
      try {
        await switchProject(name, options);
      } catch (error) {
        console.error(Formatter.error(`Failed to switch project: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}

async function switchProject(name: string, options: SwitchOptions): Promise<void> {
  const contextManager = new ProjectContextManager();
  
  // Initialize context to detect mode
  await contextManager.initializeContext();
  
  // Check if we're in multi-project mode
  const mode = contextManager.getProjectMode();
  if (mode === 'single') {
    throw new Error('Cannot switch projects in single-project mode. Use multi-project mode to manage multiple projects.');
  }
  
  // Get available projects
  const projects = contextManager.listProjects();
  const currentContext = contextManager.getCurrentContext();
  const currentProject = currentContext?.context.currentProject;
  
  // Check if already on the target project
  if (currentProject === name) {
    console.log(Formatter.info(`Already on project '${name}'.`));
    return;
  }
  
  // Check if project exists
  if (!projects.includes(name)) {
    if (options.create) {
      console.log(Formatter.info(`Project '${name}' does not exist. Creating it...`));
      await contextManager.createProject(name);
      console.log(Formatter.success(`Project '${name}' created and switched to.`));
      return;
    } else {
      throw new Error(`Project '${name}' not found. Available projects: ${projects.join(', ')}\nUse --create to create it.`);
    }
  }
  
  // Switch to the project
  try {
    const projectContext = await contextManager.switchProject(name);
    
    // Ensure project structure exists
    await contextManager.ensureProjectStructure();
    
    // Validate the project context
    const validation = contextManager.validateContext();
    if (!validation.valid && !options.force) {
      console.error(Formatter.error(`Project '${name}' has validation issues:`));
      validation.issues.forEach(issue => console.error(Formatter.error(`  • ${issue}`)));
      console.error(Formatter.error('Use --force to switch anyway.'));
      process.exit(1);
    }
    
    // Show warnings if any
    if (validation.warnings.length > 0) {
      console.log(Formatter.warning('Project has warnings:'));
      validation.warnings.forEach(warning => console.log(Formatter.warning(`  • ${warning}`)));
    }
    
    // Success message
    console.log(Formatter.success(`Switched to project '${name}'.`));
    
    // Show project information
    const paths = projectContext.paths;
    console.log(Formatter.info(`Project Root: ${paths.projectRoot}`));
    console.log(Formatter.info(`Tasks Root: ${paths.tasksRoot}`));
    console.log(Formatter.info(`Config Dir: ${paths.configDir}`));
    
    // Show quick stats if directories exist
    const stats = await getQuickStats(paths);
    if (stats.total > 0) {
      console.log(Formatter.info(`\n📊 Quick Stats:`));
      console.log(Formatter.info(`   Epics: ${stats.epics}, Issues: ${stats.issues}, Tasks: ${stats.tasks}, PRs: ${stats.prs}`));
    }
    
    console.log(Formatter.info('\nUse "aitrackdown status" to see detailed project status.'));
    
  } catch (error) {
    throw new Error(`Failed to switch to project '${name}': ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getQuickStats(paths: any): Promise<any> {
  const stats = {
    epics: 0,
    issues: 0,
    tasks: 0,
    prs: 0,
    total: 0
  };
  
  try {
    const fs = await import('fs');
    
    if (fs.existsSync(paths.epicsDir)) {
      stats.epics = fs.readdirSync(paths.epicsDir).filter(file => file.endsWith('.md')).length;
    }
    
    if (fs.existsSync(paths.issuesDir)) {
      stats.issues = fs.readdirSync(paths.issuesDir).filter(file => file.endsWith('.md')).length;
    }
    
    if (fs.existsSync(paths.tasksDir)) {
      stats.tasks = fs.readdirSync(paths.tasksDir).filter(file => file.endsWith('.md')).length;
    }
    
    if (fs.existsSync(paths.prsDir)) {
      stats.prs = fs.readdirSync(paths.prsDir).filter(file => file.endsWith('.md')).length;
    }
    
    stats.total = stats.epics + stats.issues + stats.tasks + stats.prs;
  } catch (error) {
    // Silently ignore stats collection errors
  }
  
  return stats;
}