/**
 * Main GitHub Sync Command
 * Combines all sync subcommands
 */

import { Command } from 'commander';
import { createSyncAutoCommand } from './sync/auto.js';
import { createSyncBidirectionalCommand } from './sync/bidirectional.js';
import { createSyncPullCommand } from './sync/pull.js';
import { createSyncPushCommand } from './sync/push.js';
import { createSyncSetupCommand } from './sync/setup.js';
import { createSyncStatusCommand } from './sync/status.js';

export function createSyncCommand(): Command {
  const command = new Command('sync');

  command
    .description('GitHub Issues sync management')
    .addCommand(createSyncSetupCommand())
    .addCommand(createSyncPushCommand())
    .addCommand(createSyncPullCommand())
    .addCommand(createSyncStatusCommand())
    .addCommand(createSyncAutoCommand())
    .addCommand(createSyncBidirectionalCommand());

  // Add help action for when no subcommand is provided
  command.action(() => {
    console.log('🔄 GitHub Issues Sync Management');
    console.log('');
    console.log('Available commands:');
    console.log('  setup         Configure GitHub sync for the project');
    console.log('  push          Push local changes to GitHub');
    console.log('  pull          Pull GitHub changes to local');
    console.log('  bidirectional Perform full bidirectional sync');
    console.log('  status        Show sync status and conflicts');
    console.log('  auto          Enable/disable automatic sync');
    console.log('');
    console.log('Examples:');
    console.log('  aitrackdown sync setup --repository owner/repo --token ghp_xxx');
    console.log('  aitrackdown sync push --verbose');
    console.log('  aitrackdown sync pull --dry-run');
    console.log('  aitrackdown sync pull --days 7              # Pull issues updated in last 7 days');
    console.log('  aitrackdown sync pull --since 2024-01-01   # Pull issues updated since date');
    console.log('  aitrackdown sync bidirectional');
    console.log('  aitrackdown sync status --verbose');
    console.log('  aitrackdown sync auto --enable');
    console.log('');
    console.log('Use "aitrackdown sync <command> --help" for more information about a command.');
  });

  return command;
}
