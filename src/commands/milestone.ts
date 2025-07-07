/**
 * Main milestone command - Combines all milestone subcommands
 */

import { Command } from 'commander';
import { createMilestoneCreateCommand } from './milestone/create.js';
import { createMilestoneListCommand } from './milestone/list.js';
import { createMilestoneAnalyticsCommand } from './milestone/analytics.js';
import { createMilestoneTemplateCommand } from './milestone/template.js';
import { createMilestoneBulkAssignCommand } from './milestone/bulk-assign.js';
import { createMilestoneProgressCommand } from './milestone/progress.js';

export function createMilestoneCommand(): Command {
  const cmd = new Command('milestone');
  
  cmd
    .description('Manage GitHub milestones with progress tracking and analytics')
    .alias('milestones');

  // Add subcommands
  cmd.addCommand(createMilestoneCreateCommand());
  cmd.addCommand(createMilestoneListCommand());
  cmd.addCommand(createMilestoneAnalyticsCommand());
  cmd.addCommand(createMilestoneTemplateCommand());
  cmd.addCommand(createMilestoneBulkAssignCommand());
  cmd.addCommand(createMilestoneProgressCommand());

  // Add helpful examples and documentation
  cmd.on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  $ aitrackdown milestone create "Sprint 1" --due-date "2025-01-15"');
    console.log('  $ aitrackdown milestone list --state open --show-progress');
    console.log('  $ aitrackdown milestone progress "Sprint 1" --burndown --forecast');
    console.log('  $ aitrackdown milestone analytics "Sprint 1" --velocity --completion-rate');
    console.log('  $ aitrackdown milestone assign 123,124,125 "Sprint 1" --bulk');
    console.log('  $ aitrackdown milestone template --apply "sprint"');
    console.log('');
    console.log('Short alias:');
    console.log('  $ atd milestone create "Sprint 1" --due-date "2025-01-15"');
    console.log('  $ atd milestone progress "Sprint 1" --burndown');
    console.log('  $ atd milestone analytics "Sprint 1" --velocity');
    console.log('');
    console.log('Learn more:');
    console.log('  GitHub Milestones API: https://docs.github.com/en/rest/issues/milestones');
  });

  return cmd;
}