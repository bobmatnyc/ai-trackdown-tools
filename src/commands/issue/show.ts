/**
 * Issue Show Command - Placeholder
 */

import { Command } from 'commander';
import { Formatter } from '../../utils/formatter.js';

export function createIssueShowCommand(): Command {
  const cmd = new Command('show');
  
  cmd
    .description('Show detailed information about an issue')
    .argument('<issue-id>', 'issue ID to show')
    .action(async (issueId: string) => {
      console.log(Formatter.info(`Issue show command not yet implemented for ${issueId}`));
    });

  return cmd;
}