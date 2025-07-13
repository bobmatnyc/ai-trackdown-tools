/**
 * PR Command Group for AI-Trackdown
 * Pull request tracking within issues
 */

import { Command } from 'commander';
import { createPRApproveCommand } from './pr/approve.js';
import { createPRArchiveCommand } from './pr/archive.js';
import { createPRBatchCommand } from './pr/batch.js';
import { createPRCloseCommand } from './pr/close.js';
import { createPRCreateCommand } from './pr/create.js';
import { createPRDependenciesCommand } from './pr/dependencies.js';
import { createPRListCommand } from './pr/list.js';
import { createPRMergeCommand } from './pr/merge.js';
import { createPRReviewCommand } from './pr/review.js';
import { createPRShowCommand } from './pr/show.js';
import { createPRSyncCommand } from './pr/sync.js';
import { createPRUpdateCommand } from './pr/update.js';

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
