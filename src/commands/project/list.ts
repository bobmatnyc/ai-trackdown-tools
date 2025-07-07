/**
 * Project list command - List GitHub Projects v2
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { formatInfo } from '../../utils/formatters.js';

export function createProjectListCommand(): Command {
  const cmd = new Command('list');
  
  cmd
    .description('List GitHub Projects v2')
    .option('--include-closed', 'Include closed projects')
    .option('--owner <owner>', 'Filter by owner')
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .action(async (options) => {
      console.log(chalk.blue('GitHub Projects v2 integration coming soon...'));
      console.log(formatInfo('This feature requires GitHub Projects v2 GraphQL API integration'));
      console.log(formatInfo('Use "aitrackdown --help" to see available commands'));
    });

  return cmd;
}