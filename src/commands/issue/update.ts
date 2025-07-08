/**
 * Issue Update Command - Placeholder
 */

import { Command } from 'commander';
import { Formatter } from '../../utils/formatter.js';

export function createIssueUpdateCommand(): Command {
  const cmd = new Command('update');
  
  cmd
    .description('Update an existing issue')
    .argument('<issue-id>', 'issue ID to update')
    .action(async (issueId: string) => {
      console.log(Formatter.info(`Issue update command not yet implemented for ${issueId}`));
    });

  return cmd;
}