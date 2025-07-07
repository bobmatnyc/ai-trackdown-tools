/**
 * Main project command - GitHub Projects v2 integration
 */

import { Command } from 'commander';
import { createProjectCreateCommand } from './project/create.js';
import { createProjectListCommand } from './project/list.js';
import { createProjectBoardCommand } from './project/board.js';
import { createProjectAnalyticsCommand } from './project/analytics.js';
import { createProjectAutomationCommand } from './project/automation.js';

export function createProjectCommand(): Command {
  const cmd = new Command('project');
  
  cmd
    .description('Manage GitHub Projects v2 with board views and automation')
    .alias('projects');

  // Add subcommands
  cmd.addCommand(createProjectCreateCommand());
  cmd.addCommand(createProjectListCommand());
  cmd.addCommand(createProjectBoardCommand());
  cmd.addCommand(createProjectAnalyticsCommand());
  cmd.addCommand(createProjectAutomationCommand());

  // Add helpful examples and documentation
  cmd.on('--help', () => {
    console.log('');
    console.log('Examples:');
    console.log('  $ aitrackdown project create "Q1 Roadmap" --template "roadmap"');
    console.log('  $ aitrackdown project list --include-closed --owner "team"');
    console.log('  $ aitrackdown project board "Q1 Roadmap" --view kanban');
    console.log('  $ aitrackdown project add-issue 123 --project "Q1 Roadmap" --status "In Progress"');
    console.log('  $ aitrackdown project analytics "Q1 Roadmap" --cycle-time --throughput');
    console.log('  $ aitrackdown project automation create --trigger "label:ready" --action "move-to-column:In Progress"');
    console.log('');
    console.log('Short alias:');
    console.log('  $ atd project board "Q1 Roadmap" --view kanban');
    console.log('  $ atd project analytics "Q1 Roadmap" --cycle-time');
    console.log('');
    console.log('Project Templates:');
    console.log('  • roadmap    - Strategic roadmap planning');
    console.log('  • kanban     - Basic kanban workflow');
    console.log('  • scrum      - Scrum sprint planning');
    console.log('  • bug-triage - Bug triage and resolution');
    console.log('');
    console.log('Learn more:');
    console.log('  GitHub Projects v2: https://docs.github.com/en/issues/planning-and-tracking-with-projects');
  });

  return cmd;
}