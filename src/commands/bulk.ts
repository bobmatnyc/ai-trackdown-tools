/**
 * Main bulk command - Mass operations for issues, labels, and milestones
 */

import { Command } from 'commander';
import { createBulkAssignCommand } from './bulk/assign.js';
import { createBulkLabelCommand } from './bulk/label.js';
import { createBulkCloseCommand } from './bulk/close.js';
import { createBulkExportCommand } from './bulk/export.js';
import { createBulkImportCommand } from './bulk/import.js';

export function createBulkCommand(): Command {
  const cmd = new Command('bulk');
  
  cmd
    .description('Mass operations for issues, labels, and milestones with enterprise-scale performance')
    .alias('mass');

  // Add subcommands
  cmd.addCommand(createBulkAssignCommand());
  cmd.addCommand(createBulkLabelCommand());
  cmd.addCommand(createBulkCloseCommand());
  cmd.addCommand(createBulkExportCommand());
  cmd.addCommand(createBulkImportCommand());

  // Add helpful examples and documentation
  cmd.on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  $ aitrackdown bulk assign --issues "123-130" --assignee "johndoe" --notify');
    console.log('  $ aitrackdown bulk label --filter "state:open milestone:Sprint1" --add "needs-review"');
    console.log('  $ aitrackdown bulk close --query "is:open label:completed created:<1w"');
    console.log('  $ aitrackdown bulk export --query "milestone:Sprint1" --format csv');
    console.log('  $ aitrackdown bulk import --file "issues.csv" --template "bug-report"');
    console.log('');
    console.log('Short alias:');
    console.log('  $ atd bulk assign --issues "123-130" --assignee "johndoe"');
    console.log('  $ atd bulk export --query "milestone:Sprint1" --format csv');
    console.log('');
    console.log('Performance Features:');
    console.log('  • Handles 1000+ issues efficiently');
    console.log('  • Batch processing with rate limiting');
    console.log('  • Progress tracking for long operations');
    console.log('  • Dry-run mode for validation');
    console.log('  • Rollback support for failed operations');
    console.log('');
    console.log('Learn more:');
    console.log('  GitHub Search Syntax: https://docs.github.com/en/search-github/searching-on-github');
  });

  return cmd;
}