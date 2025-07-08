/**
 * Issue Command Group for AI-Trackdown
 * Mid-level work units within epics
 */

import { Command } from 'commander';
import { createIssueCreateCommand } from './issue/create.js';
import { createIssueListCommand } from './issue/list.js';
import { createIssueShowCommand } from './issue/show.js';
import { createIssueUpdateCommand } from './issue/update.js';
import { createIssueDeleteCommand } from './issue/delete.js';
import { createIssueCompleteCommand } from './issue/complete.js';
import { createIssueAssignCommand } from './issue/assign.js';

export function createIssueCommand(): Command {
  const cmd = new Command('issue');
  
  cmd
    .description('Manage issues (mid-level work units within epics)')
    .alias('issues')
    .addCommand(createIssueCreateCommand())
    .addCommand(createIssueListCommand())
    .addCommand(createIssueShowCommand())
    .addCommand(createIssueUpdateCommand())
    .addCommand(createIssueDeleteCommand())
    .addCommand(createIssueCompleteCommand())
    .addCommand(createIssueAssignCommand());

  return cmd;
}