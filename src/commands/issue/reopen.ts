/**
 * Issue reopen command - Deprecated in favor of issue update
 */

import chalk from 'chalk';
import { Command } from 'commander';
import { formatError, formatInfo } from '../../utils/formatters.js';

interface IssueReopenOptions {
  comment?: string;
  format?: string;
  verbose?: boolean;
}

export function createIssueReopenCommand(): Command {
  const cmd = new Command('reopen');

  cmd
    .description('Reopen an issue (deprecated - use "issue update")')
    .argument('<issue-id>', 'Issue ID (e.g., ISS-0001)')
    .option('-c, --comment <text>', 'Add comment when reopening')
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .option('-v, --verbose', 'Show detailed output')
    .action(async (issueId: string, options: IssueReopenOptions) => {
      try {
        await handleReopenIssue(issueId, options);
      } catch (error) {
        console.error(
          formatError(error instanceof Error ? error.message : 'Unknown error occurred')
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function handleReopenIssue(issueId: string, options: IssueReopenOptions): Promise<void> {
  // This command is deprecated
  console.log(formatInfo(`The "reopen" command is deprecated.`));
  console.log(formatInfo(`Please use: aitrackdown issue update ${issueId} --status todo`));

  if (options.comment) {
    console.log(formatInfo(`To add a comment, edit the issue content directly.`));
  }

  console.log('');
  console.log(chalk.yellow('The "reopen" command will be removed in a future version.'));
  console.log(chalk.yellow('Please update your scripts to use the "update" command instead.'));
}

// Export for use in other commands
export { handleReopenIssue };
