/**
 * Project List Command
 * Lists all available projects in multi-project mode
 */

import { Command } from 'commander';
import { Formatter } from '../../utils/formatter.js';
import { ProjectContextManager } from '../../utils/project-context-manager.js';

interface ListOptions {
  format?: 'table' | 'json' | 'simple';
  showInactive?: boolean;
  showDetails?: boolean;
}

export function createProjectListCommand(): Command {
  const cmd = new Command('list');

  cmd
    .description('List all available projects')
    .alias('ls')
    .option('-f, --format <type>', 'output format (table|json|simple)', 'table')
    .option('-i, --show-inactive', 'show inactive projects', false)
    .option('-d, --show-details', 'show detailed project information', false)
    .action(async (options: ListOptions) => {
      try {
        await listProjects(options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to list projects: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function listProjects(options: ListOptions): Promise<void> {
  const contextManager = new ProjectContextManager();

  // Initialize context to detect mode
  await contextManager.initializeContext();

  // Check if we're in multi-project mode
  const mode = contextManager.getProjectMode();
  if (mode === 'single') {
    console.log(Formatter.info('Single-project mode detected. No project listing available.'));
    console.log(
      Formatter.info('Use "aitrackdown project create" to initialize multi-project mode.')
    );
    return;
  }

  // Get available projects
  const projects = contextManager.listProjects();
  const currentContext = contextManager.getCurrentContext();
  const currentProject = currentContext?.context.currentProject;

  if (projects.length === 0) {
    console.log(Formatter.info('No projects found.'));
    console.log(
      Formatter.info('Use "aitrackdown project create <name>" to create your first project.')
    );
    return;
  }

  // Format output based on requested format
  switch (options.format) {
    case 'json':
      console.log(
        JSON.stringify(
          {
            current_project: currentProject,
            projects: projects.map((name) => ({
              name,
              is_current: name === currentProject,
            })),
          },
          null,
          2
        )
      );
      break;

    case 'simple':
      projects.forEach((project) => {
        const marker = project === currentProject ? '*' : ' ';
        console.log(`${marker} ${project}`);
      });
      break;
    default:
      console.log(Formatter.info(`\n📋 Available Projects (${projects.length})`));
      console.log(Formatter.info(`Current project: ${currentProject || 'None selected'}`));
      console.log();

      projects.forEach((project, index) => {
        const marker = project === currentProject ? '👉' : '  ';
        const status = project === currentProject ? Formatter.success('[CURRENT]') : '';
        console.log(`${marker} ${index + 1}. ${project} ${status}`);
      });

      console.log();
      console.log(
        Formatter.info('Use "aitrackdown project switch <name>" to switch to a different project.')
      );
      console.log(Formatter.info('Use "aitrackdown project show <name>" to view project details.'));
      break;
  }

  // Show additional details if requested
  if (options.showDetails) {
    console.log(Formatter.info('\n📊 Project Details:'));
    console.log(Formatter.info(`Mode: ${mode.toUpperCase()}`));
    console.log(
      Formatter.info(`Projects Directory: ${currentContext?.context.projectsDir || 'Not set'}`)
    );
    console.log(Formatter.info(`Root Directory: ${currentContext?.context.projectRoot}`));
  }
}
