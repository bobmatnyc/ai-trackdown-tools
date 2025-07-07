/**
 * Main label command - Combines all label subcommands
 */

import { Command } from 'commander';
import { createLabelCreateCommand } from './label/create.js';
import { createLabelListCommand } from './label/list.js';
import { createLabelUpdateCommand } from './label/update.js';
import { createLabelDeleteCommand } from './label/delete.js';
import { createLabelApplyCommand } from './label/apply.js';
import { createLabelRemoveCommand } from './label/remove.js';

export function createLabelCommand(): Command {
  const cmd = new Command('label');
  
  cmd
    .description('Manage GitHub repository labels')
    .alias('labels');

  // Add subcommands
  cmd.addCommand(createLabelCreateCommand());
  cmd.addCommand(createLabelListCommand());
  cmd.addCommand(createLabelUpdateCommand());
  cmd.addCommand(createLabelDeleteCommand());
  cmd.addCommand(createLabelApplyCommand());
  cmd.addCommand(createLabelRemoveCommand());

  // Add helpful examples and documentation
  cmd.on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  $ aitrackdown label create "bug" --color ff0000 --description "Something isn\'t working"');
    console.log('  $ aitrackdown label list --sort name --show-usage');
    console.log('  $ aitrackdown label update "bug" --color d73a4a --description "Updated description"');
    console.log('  $ aitrackdown label delete "old-label" --confirm');
    console.log('  $ aitrackdown label apply 123 bug high-priority');
    console.log('  $ aitrackdown label remove 123 wontfix duplicate');
    console.log('');
    console.log('Common Label Presets:');
    console.log('  bug           - d73a4a (red)');
    console.log('  enhancement   - a2eeef (light blue)');
    console.log('  documentation - 0075ca (blue)');
    console.log('  good-first-issue - 7057ff (purple)');
    console.log('  help-wanted   - 008672 (green)');
    console.log('  priority-high - ff0000 (bright red)');
    console.log('  priority-low  - 00ff00 (bright green)');
    console.log('  status-blocked - ff6b6b (light red)');
    console.log('');
    console.log('Color Formats:');
    console.log('  Hex colors:   ff0000 (red), 00ff00 (green), 0000ff (blue)');
    console.log('  No # symbol:  Use "ff0000" not "#ff0000"');
    console.log('  6 digits:     Always use 6-digit hex values');
    console.log('');
    console.log('Best Practices:');
    console.log('  • Use consistent naming conventions (type:name, priority:level)');
    console.log('  • Choose contrasting colors for better visibility');
    console.log('  • Add descriptions to help users understand label purpose');
    console.log('  • Regularly review and clean up unused labels');
    console.log('  • Use hierarchical labels (e.g., "type:bug", "type:feature")');
    console.log('');
    console.log('Label Organization:');
    console.log('  Type labels:     bug, enhancement, documentation, question');
    console.log('  Priority labels: priority:high, priority:medium, priority:low');
    console.log('  Status labels:   status:ready, status:in-progress, status:blocked');
    console.log('  Effort labels:   effort:small, effort:medium, effort:large');
    console.log('  Area labels:     area:frontend, area:backend, area:api');
  });

  return cmd;
}