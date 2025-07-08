/**
 * Issue Delete Command - Placeholder
 */

import { Command } from 'commander';
import { Formatter } from '../../utils/formatter.js';

export function createIssueDeleteCommand(): Command {
  const cmd = new Command('delete');
  
  cmd
    .description('Delete an issue')
    .argument('<issue-id>', 'issue ID to delete')
    .action(async (issueId: string) => {
      console.log(Formatter.info(`Issue delete command not yet implemented for ${issueId}`));
    });

  return cmd;
}