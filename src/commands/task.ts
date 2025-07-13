/**
 * Task Command Group for AI-Trackdown
 * Granular work items within issues
 */

import { Command } from 'commander';
import { createTaskCompleteCommand } from './task/complete.js';
import { createTaskCreateCommand } from './task/create.js';
import { createTaskDeleteCommand } from './task/delete.js';
import { createTaskListCommand } from './task/list.js';
import { createTaskShowCommand } from './task/show.js';
import { createTaskUpdateCommand } from './task/update.js';

export function createTaskCommand(): Command {
  const cmd = new Command('task');

  cmd
    .description('Manage tasks (granular work items within issues)')
    .alias('tasks')
    .addCommand(createTaskCreateCommand())
    .addCommand(createTaskListCommand())
    .addCommand(createTaskShowCommand())
    .addCommand(createTaskUpdateCommand())
    .addCommand(createTaskDeleteCommand())
    .addCommand(createTaskCompleteCommand());

  return cmd;
}
