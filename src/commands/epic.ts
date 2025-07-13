/**
 * Epic Command Group for AI-Trackdown
 * Top-level organizational unit commands
 */

import { Command } from 'commander';
import { createEpicCompleteCommand } from './epic/complete.js';
import { createEpicCreateCommand } from './epic/create.js';
import { createEpicDeleteCommand } from './epic/delete.js';
import { createEpicListCommand } from './epic/list.js';
import { createEpicShowCommand } from './epic/show.js';
import { createEpicUpdateCommand } from './epic/update.js';

export function createEpicCommand(): Command {
  const cmd = new Command('epic');

  cmd
    .description('Manage epics (top-level organizational units)')
    .addCommand(createEpicCreateCommand())
    .addCommand(createEpicListCommand())
    .addCommand(createEpicShowCommand())
    .addCommand(createEpicUpdateCommand())
    .addCommand(createEpicDeleteCommand())
    .addCommand(createEpicCompleteCommand());

  return cmd;
}
