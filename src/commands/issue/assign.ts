/**
 * Issue Assign Command
 * Assign or reassign issues to users
 */

import { Command } from 'commander';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';

interface AssignOptions {
  dryRun?: boolean;
}

export function createIssueAssignCommand(): Command {
  const cmd = new Command('assign');

  cmd
    .description('Assign an issue to a user')
    .argument('<issue-id>', 'issue ID to assign')
    .argument('<assignee>', 'username to assign to')
    .option('--dry-run', 'show what would be assigned without assigning')
    .action(async (issueId: string, assignee: string, options: AssignOptions) => {
      try {
        await assignIssue(issueId, assignee, options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to assign issue: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function assignIssue(
  issueId: string,
  assignee: string,
  options: AssignOptions
): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();

  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR; // Set by parent command

  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);
  const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);
  const parser = new FrontmatterParser();

  // Get issue hierarchy
  const hierarchy = relationshipManager.getIssueHierarchy(issueId);
  if (!hierarchy) {
    throw new Error(`Issue not found: ${issueId}`);
  }

  const issue = hierarchy.issue;
  const currentAssignee = issue.assignee;

  if (options.dryRun) {
    console.log(Formatter.info('Dry run - Issue would be assigned:'));
    console.log(Formatter.debug(`Issue ID: ${issueId}`));
    console.log(Formatter.debug(`Title: ${issue.title}`));
    console.log(Formatter.debug(`Current Assignee: ${currentAssignee}`));
    console.log(Formatter.debug(`New Assignee: ${assignee}`));
    return;
  }

  if (currentAssignee === assignee) {
    console.log(Formatter.warning(`Issue ${issueId} is already assigned to ${assignee}`));
    return;
  }

  // Update the issue
  const _updatedIssue = parser.updateFile(issue.file_path, {
    assignee,
    updated_date: new Date().toISOString(),
  });

  // Refresh cache
  relationshipManager.rebuildCache();

  console.log(Formatter.success(`Issue assigned successfully!`));
  console.log(Formatter.info(`Issue ID: ${issueId}`));
  console.log(Formatter.info(`Title: ${issue.title}`));
  console.log(Formatter.info(`Previous Assignee: ${currentAssignee}`));
  console.log(Formatter.info(`New Assignee: ${assignee}`));
}
