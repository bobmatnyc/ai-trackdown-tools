/**
 * Project Create Command
 * Creates new projects with Git metadata integration
 */

import { Command } from 'commander';
import { ProjectContextManager } from '../../utils/project-context-manager.js';
import { GitMetadataExtractor } from '../../utils/git-metadata-extractor.js';
import { Formatter } from '../../utils/formatter.js';
import type { ProjectConfig } from '../../types/ai-trackdown.js';

interface CreateOptions {
  name?: string;
  description?: string;
  gitOrigin?: string;
  gitBranch?: string;
  framework?: string;
  languages?: string;
  teamMembers?: string;
  dryRun?: boolean;
  template?: string;
  extractGitMetadata?: boolean;
}

export function createProjectCreateCommand(): Command {
  const cmd = new Command('create');
  
  cmd
    .description('Create a new project with Git metadata integration')
    .argument('[name]', 'project name (optional if using --name flag)')
    .option('--name <text>', 'project name (alternative to positional argument)')
    .option('-d, --description <text>', 'project description')
    .option('--git-origin <url>', 'Git origin URL')
    .option('--git-branch <branch>', 'Git branch name')
    .option('--framework <name>', 'project framework')
    .option('--languages <list>', 'comma-separated list of languages')
    .option('--team-members <list>', 'comma-separated list of team members')
    .option('-t, --template <name>', 'project template to use', 'default')
    .option('--extract-git-metadata', 'extract Git metadata from current directory', true)
    .option('--dry-run', 'show what would be created without creating')
    .action(async (nameArg: string | undefined, options: CreateOptions) => {
      try {
        // Support both positional argument and --name flag
        const name = nameArg || options.name;
        if (!name) {
          throw new Error('Project name is required. Provide it as a positional argument or use --name flag.');
        }
        await createProject(name, options);
      } catch (error) {
        console.error(Formatter.error(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}

async function createProject(name: string, options: CreateOptions): Promise<void> {
  const contextManager = new ProjectContextManager();
  
  // Initialize context to detect mode
  await contextManager.initializeContext();
  
  // Check if we're in multi-project mode
  const mode = contextManager.getProjectMode();
  if (mode === 'single') {
    throw new Error('Cannot create projects in single-project mode. Use multi-project mode or initialize a new project structure.');
  }
  
  // Extract Git metadata if requested
  let gitMetadata: any = {};
  if (options.extractGitMetadata) {
    try {
      const gitExtractor = new GitMetadataExtractor();
      gitMetadata = await gitExtractor.extractGitMetadata();
      console.log(Formatter.info(`Extracted Git metadata for ${gitMetadata.repository_url || 'repository'}`));
    } catch (error) {
      console.warn(Formatter.warning(`Failed to extract Git metadata: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }
  
  // Parse arrays
  const languages = options.languages ? options.languages.split(',').map(lang => lang.trim()) : gitMetadata.languages || [];
  const teamMembers = options.teamMembers ? options.teamMembers.split(',').map(member => member.trim()) : [];
  
  // Create project configuration
  const projectConfig: Partial<ProjectConfig> = {
    name,
    description: options.description || gitMetadata.description || `Project ${name}`,
    version: '1.0.0',
    project_mode: 'multi',
    structure: {
      epics_dir: 'epics',
      issues_dir: 'issues',
      tasks_dir: 'tasks',
      templates_dir: 'templates',
      prs_dir: 'prs'
    },
    naming_conventions: {
      project_prefix: 'PROJ',
      epic_prefix: 'EP',
      issue_prefix: 'ISS',
      task_prefix: 'TSK',
      pr_prefix: 'PR',
      file_extension: '.md'
    }
  };
  
  // Create project frontmatter data
  const projectData = {
    name,
    description: options.description || gitMetadata.description || `Project ${name}`,
    git_origin: options.gitOrigin || gitMetadata.git_origin,
    git_branch: options.gitBranch || gitMetadata.git_branch || gitMetadata.default_branch,
    repository_url: gitMetadata.repository_url,
    clone_url: gitMetadata.clone_url,
    default_branch: gitMetadata.default_branch,
    languages,
    framework: options.framework || gitMetadata.framework,
    team_members: teamMembers,
    completion_percentage: 0
  };
  
  if (options.dryRun) {
    console.log(Formatter.info('Dry run - Project would be created with:'));
    console.log(Formatter.debug(`Name: ${name}`));
    console.log(Formatter.debug(`Description: ${projectData.description}`));
    console.log(Formatter.debug(`Git Origin: ${projectData.git_origin || 'Not set'}`));
    console.log(Formatter.debug(`Git Branch: ${projectData.git_branch || 'Not set'}`));
    console.log(Formatter.debug(`Repository URL: ${projectData.repository_url || 'Not set'}`));
    console.log(Formatter.debug(`Framework: ${projectData.framework || 'Not set'}`));
    console.log(Formatter.debug(`Languages: ${languages.join(', ') || 'Not set'}`));
    console.log(Formatter.debug(`Team Members: ${teamMembers.join(', ') || 'Not set'}`));
    console.log(Formatter.debug(`Template: ${options.template || 'default'}`));
    return;
  }
  
  // Create the project
  try {
    const projectContext = await contextManager.createProject(name, projectConfig);
    
    // Ensure project structure exists
    await contextManager.ensureProjectStructure();
    
    console.log(Formatter.success(`Project '${name}' created successfully!`));
    console.log(Formatter.info(`Project Path: ${projectContext.paths.projectRoot}`));
    console.log(Formatter.info(`Config Dir: ${projectContext.paths.configDir}`));
    console.log(Formatter.info(`Tasks Root: ${projectContext.paths.tasksRoot}`));
    
    if (projectData.git_origin) {
      console.log(Formatter.info(`Git Origin: ${projectData.git_origin}`));
    }
    
    if (projectData.repository_url) {
      console.log(Formatter.info(`Repository: ${projectData.repository_url}`));
    }
    
    if (languages.length > 0) {
      console.log(Formatter.info(`Languages: ${languages.join(', ')}`));
    }
    
    if (projectData.framework) {
      console.log(Formatter.info(`Framework: ${projectData.framework}`));
    }
    
    console.log(Formatter.info(`\nProject '${name}' is now active. You can start creating epics, issues, and tasks.`));
    
  } catch (error) {
    throw new Error(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}