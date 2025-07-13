/**
 * Project Command Suite
 * Manages project context and multi-project workflows
 */

import { Command } from 'commander';
import { createProjectCreateCommand } from './project/create.js';
import { createProjectListCommand } from './project/list.js';
import { createProjectShowCommand } from './project/show.js';
import { createProjectSwitchCommand } from './project/switch.js';

export function createProjectCommand(): Command {
  const cmd = new Command('project');

  cmd.description('Manage projects and project context').alias('proj');

  // Add subcommands
  cmd.addCommand(createProjectCreateCommand());
  cmd.addCommand(createProjectListCommand());
  cmd.addCommand(createProjectShowCommand());
  cmd.addCommand(createProjectSwitchCommand());

  return cmd;
}
