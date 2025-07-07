/**
 * Main issue command - Combines all issue subcommands
 */

import { Command } from 'commander';
import { createIssueCreateCommand } from './issue/create.js';
import { createIssueListCommand } from './issue/list.js';
import { createIssueShowCommand } from './issue/show.js';
import { createIssueUpdateCommand } from './issue/update.js';
import { createIssueCloseCommand } from './issue/close.js';
import { createIssueReopenCommand } from './issue/reopen.js';
import { createIssueDeleteCommand } from './issue/delete.js';
import { createIssueSearchCommand } from './issue/search.js';

export function createIssueCommand(): Command {
  const cmd = new Command('issue');
  
  cmd
    .description('Manage GitHub issues with complete API parity')
    .alias('issues');

  // Add subcommands
  cmd.addCommand(createIssueCreateCommand());
  cmd.addCommand(createIssueListCommand());
  cmd.addCommand(createIssueShowCommand());
  cmd.addCommand(createIssueUpdateCommand());
  cmd.addCommand(createIssueCloseCommand());
  cmd.addCommand(createIssueReopenCommand());
  cmd.addCommand(createIssueDeleteCommand());
  cmd.addCommand(createIssueSearchCommand());

  // Add helpful examples and documentation
  cmd.on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  $ aitrackdown issue create "Fix login bug" --labels bug,high-priority');
    console.log('  $ aitrackdown issue list --state open --assignee @me');
    console.log('  $ aitrackdown issue show 123 --comments');
    console.log('  $ aitrackdown issue update 123 --add-labels enhancement --assignee username');
    console.log('  $ aitrackdown issue close 123 --state-reason completed');
    console.log('  $ aitrackdown issue search "is:open label:bug created:>1w"');
    console.log('');
    console.log('Search Syntax:');
    console.log('  State:       is:open, is:closed');
    console.log('  Labels:      label:bug, label:"help wanted"');
    console.log('  Assignee:    assignee:username, assignee:@me, no:assignee');
    console.log('  Author:      author:username');
    console.log('  Mentions:    mentions:username');
    console.log('  Milestone:   milestone:"v1.0", no:milestone');
    console.log('  Dates:       created:>2024-01-01, updated:<1w');
    console.log('  Content:     in:title, in:body, in:comments');
    console.log('  Numbers:     comments:>5, reactions:>10');
    console.log('');
    console.log('Date Formats:');
    console.log('  Absolute:    2024-01-01, 2024-12-31');
    console.log('  Relative:    >2024-01-01, <1w, >=30d');
    console.log('  Ranges:      2024-01-01..2024-12-31');
    console.log('  Shortcuts:   1d (1 day), 1w (1 week), 1m (1 month), 1y (1 year)');
    console.log('');
    console.log('Learn more:');
    console.log('  GitHub Search Syntax: https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests');
  });

  return cmd;
}