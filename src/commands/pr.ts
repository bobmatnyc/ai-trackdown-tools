/**
 * PR Command Group for AI-Trackdown
 * Pull request tracking within issues
 */

import { Command } from 'commander';
import { createPRCreateCommand } from './pr/create.js';
import { createPRListCommand } from './pr/list.js';
import { createPRShowCommand } from './pr/show.js';
import { createPRReviewCommand } from './pr/review.js';
import { createPRApproveCommand } from './pr/approve.js';
import { createPRUpdateCommand } from './pr/update.js';
import { createPRMergeCommand } from './pr/merge.js';
import { createPRCloseCommand } from './pr/close.js';
import { createPRBatchCommand } from './pr/batch.js';
import { createPRDependenciesCommand } from './pr/dependencies.js';
import { createPRSyncCommand } from './pr/sync.js';
import { createPRArchiveCommand } from './pr/archive.js';

export function createPRCommand(): Command {
  const cmd = new Command('pr');
  
  cmd
    .description('Manage PRs (pull request tracking within issues)')
    .alias('prs')
    .addCommand(createPRCreateCommand())
    .addCommand(createPRListCommand())
    .addCommand(createPRShowCommand())
    .addCommand(createPRReviewCommand())
    .addCommand(createPRApproveCommand())
    .addCommand(createPRUpdateCommand())
    .addCommand(createPRMergeCommand())
    .addCommand(createPRCloseCommand())
    .addCommand(createPRBatchCommand())
    .addCommand(createPRDependenciesCommand())
    .addCommand(createPRSyncCommand())
    .addCommand(createPRArchiveCommand());

  return cmd;
}