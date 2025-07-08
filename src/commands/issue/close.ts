/**
 * Issue close command - Mark issues as completed in ai-trackdown
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { formatSuccess, formatError, formatWarning, formatInfo } from '../../utils/formatters.js';

interface IssueCloseOptions {
  comment?: string;
  format?: string;
  verbose?: boolean;
}

export function createIssueCloseCommand(): Command {
  const cmd = new Command('close');
  
  cmd
    .description('Mark an issue as completed (alias for "issue complete")')
    .argument('<issue-id>', 'Issue ID (e.g., ISS-0001)')
    .option('-c, --comment <text>', 'Add completion comment')
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .option('-v, --verbose', 'Show detailed output')
    .action(async (issueId: string, options: IssueCloseOptions) => {
      try {
        await handleCloseIssue(issueId, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleCloseIssue(issueId: string, options: IssueCloseOptions): Promise<void> {
  // This command is an alias for "issue complete"
  // For now, redirect users to use the complete command
  console.log(formatInfo(`The "close" command is deprecated.`));
  console.log(formatInfo(`Please use: aitrackdown issue complete ${issueId}`));
  
  if (options.comment) {
    console.log(formatInfo(`To add a comment, use: aitrackdown issue complete ${issueId} --comment "${options.comment}"`));
  }
  
  console.log('');
  console.log(chalk.yellow('The "close" command will be removed in a future version.'));
  console.log(chalk.yellow('Please update your scripts to use the "complete" command instead.'));
}

// Export for use in other commands
export { handleCloseIssue };