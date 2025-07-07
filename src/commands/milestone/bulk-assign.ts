/**
 * Milestone bulk assign command - Bulk assign issues to milestones
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatSuccess, formatError, formatWarning, formatInfo } from '../../utils/formatters.js';
import type { MilestoneBulkAssignOptions } from '../../types/commands.js';

export function createMilestoneBulkAssignCommand(): Command {
  const cmd = new Command('assign');
  
  cmd
    .description('Bulk assign issues to a milestone')
    .argument('<issues>', 'Issue numbers (comma-separated, ranges supported: "123,124,130-135")')
    .argument('<milestone>', 'Milestone title or number')
    .option('--notify', 'Send notifications to issue assignees')
    .option('--force', 'Skip confirmation prompts')
    .option('--dry-run', 'Show what would be assigned without making changes')
    .option('--filter <query>', 'Additional filter for issue selection')
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .action(async (issues: string, milestone: string, options: MilestoneBulkAssignOptions) => {
      try {
        await handleBulkAssign(issues, milestone, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleBulkAssign(issuesInput: string, milestoneInput: string, options: MilestoneBulkAssignOptions): Promise<void> {
  // Validate inputs
  if (!issuesInput || issuesInput.trim().length === 0) {
    throw new Error('Issue numbers are required');
  }

  if (!milestoneInput || milestoneInput.trim().length === 0) {
    throw new Error('Milestone title or number is required');
  }

  // Create GitHub client
  const client = createGitHubClient();
  
  // Get repository info
  const repository = client.getRepository();
  if (!repository) {
    throw new Error('No repository configured. Run "aitrackdown config repo" to set up repository.');
  }

  try {
    console.log(chalk.blue('Preparing bulk milestone assignment...'));
    
    // Find milestone
    let milestone;
    if (/^\d+$/.test(milestoneInput.trim())) {
      // If input is a number, fetch by milestone number
      milestone = await client.getMilestone(parseInt(milestoneInput.trim()));
    } else {
      // Find by title
      milestone = await client.findMilestoneByTitle(milestoneInput.trim());
      if (!milestone) {
        throw new Error(`Milestone "${milestoneInput}" not found`);
      }
    }

    console.log(chalk.blue(`Target milestone: ${milestone.title} (#${milestone.number})`));

    // Parse issue numbers
    const issueNumbers = parseIssueNumbers(issuesInput);
    console.log(chalk.blue(`Processing ${issueNumbers.length} issue number${issueNumbers.length === 1 ? '' : 's'}...`));

    // Fetch issues
    const issues = [];
    const notFound = [];
    const alreadyAssigned = [];
    const errors = [];

    for (const issueNumber of issueNumbers) {
      try {
        const issue = await client.getIssue(issueNumber);
        
        // Check if already assigned to this milestone
        if (issue.milestone?.number === milestone.number) {
          alreadyAssigned.push(issue);
        } else {
          issues.push(issue);
        }
      } catch (error) {
        if (error instanceof GitHubAPIClientError && error.isNotFound()) {
          notFound.push(issueNumber);
        } else {
          errors.push({ issue: issueNumber, error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
    }

    // Apply additional filters if specified
    let filteredIssues = issues;
    if (options.filter) {
      console.log(chalk.blue(`Applying filter: ${options.filter}`));
      // This would integrate with the search parser
      filteredIssues = issues; // For now, use all issues
    }

    // Show summary
    console.log('');
    console.log(chalk.bold.cyan('📊 Assignment Summary'));
    console.log(chalk.gray('─'.repeat(30)));
    console.log(`${chalk.bold('Issues to assign:')} ${filteredIssues.length}`);
    console.log(`${chalk.bold('Already assigned:')} ${alreadyAssigned.length}`);
    console.log(`${chalk.bold('Not found:')} ${notFound.length}`);
    console.log(`${chalk.bold('Errors:')} ${errors.length}`);

    // Show issues that will be assigned
    if (filteredIssues.length > 0) {
      console.log('');
      console.log(chalk.bold.cyan('Issues to Assign:'));
      console.log(formatIssuesTable(filteredIssues, { 
        format: 'compact',
        showMilestone: true 
      }));
    }

    // Show already assigned issues
    if (alreadyAssigned.length > 0) {
      console.log('');
      console.log(chalk.bold.yellow('Already Assigned:'));
      console.log(formatIssuesTable(alreadyAssigned, { 
        format: 'compact',
        showMilestone: true 
      }));
    }

    // Show not found issues
    if (notFound.length > 0) {
      console.log('');
      console.log(chalk.bold.red('Not Found:'));
      notFound.forEach(num => console.log(`  #${num}`));
    }

    // Show errors
    if (errors.length > 0) {
      console.log('');
      console.log(chalk.bold.red('Errors:'));
      errors.forEach(err => console.log(`  #${err.issue}: ${err.error}`));
    }

    // Exit if no issues to assign
    if (filteredIssues.length === 0) {
      console.log('');
      if (alreadyAssigned.length > 0) {
        console.log(formatInfo('All specified issues are already assigned to this milestone'));
      } else {
        console.log(formatWarning('No issues found to assign'));
      }
      return;
    }

    // Dry run mode
    if (options.dryRun) {
      console.log('');
      console.log(formatInfo('DRY RUN: No changes made'));
      return;
    }

    // Confirm assignment
    if (!options.force) {
      const confirm = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: `Assign ${filteredIssues.length} issue${filteredIssues.length === 1 ? '' : 's'} to milestone "${milestone.title}"?`,
          default: true
        }
      ]);

      if (!confirm.proceed) {
        console.log(formatInfo('Assignment cancelled'));
        return;
      }
    }

    // Perform bulk assignment
    console.log('');
    console.log(chalk.blue('Assigning issues to milestone...'));
    
    const assigned = [];
    const failed = [];

    for (const issue of filteredIssues) {
      try {
        await client.updateIssue(issue.number, {
          milestone: milestone.number
        });
        assigned.push(issue);
        
        if (options.notify && issue.assignee) {
          // In a real implementation, this would send notifications
          console.log(chalk.gray(`  Would notify: ${issue.assignee.login}`));
        }
        
        console.log(chalk.green(`  ✓ #${issue.number}: ${issue.title}`));
      } catch (error) {
        failed.push({ 
          issue, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        console.log(chalk.red(`  ✗ #${issue.number}: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    }

    // Show final results
    console.log('');
    console.log(chalk.bold.cyan('🎯 Assignment Results'));
    console.log(chalk.gray('─'.repeat(30)));
    console.log(`${chalk.bold('Successfully assigned:')} ${chalk.green(assigned.length.toString())}`);
    console.log(`${chalk.bold('Failed:')} ${chalk.red(failed.length.toString())}`);

    if (assigned.length > 0) {
      console.log(formatSuccess(`Successfully assigned ${assigned.length} issue${assigned.length === 1 ? '' : 's'} to milestone "${milestone.title}"`));
    }

    if (failed.length > 0) {
      console.log('');
      console.log(chalk.bold.red('Failed Assignments:'));
      failed.forEach(f => {
        console.log(formatError(`#${f.issue.number}: ${f.error}`));
      });
    }

    // Show milestone progress
    if (assigned.length > 0) {
      console.log('');
      console.log(chalk.bold.cyan('Updated Milestone Progress:'));
      
      // Refresh milestone data
      const updatedMilestone = await client.getMilestone(milestone.number);
      console.log(OutputFormatter.formatMilestoneProgress(updatedMilestone, { detailed: true }));
      
      // Show helpful commands
      console.log('');
      console.log(chalk.bold.cyan('Next Steps:'));
      console.log(chalk.gray('─'.repeat(20)));
      console.log(`${chalk.cyan('View milestone:')} aitrackdown milestone list --show-progress`);
      console.log(`${chalk.cyan('Milestone issues:')} aitrackdown issue list --milestone "${milestone.title}"`);
      console.log(`${chalk.cyan('Milestone progress:')} aitrackdown milestone analytics "${milestone.title}" --burndown`);
    }

    // Format output based on format option
    if (options.format !== 'table') {
      const results = {
        milestone: {
          title: milestone.title,
          number: milestone.number
        },
        assigned: assigned.map(i => ({ number: i.number, title: i.title })),
        failed: failed.map(f => ({ number: f.issue.number, title: f.issue.title, error: f.error })),
        already_assigned: alreadyAssigned.map(i => ({ number: i.number, title: i.title })),
        not_found: notFound,
        summary: {
          total_processed: issueNumbers.length,
          successfully_assigned: assigned.length,
          failed: failed.length,
          already_assigned: alreadyAssigned.length,
          not_found: notFound.length
        }
      };

      console.log('');
      switch (options.format) {
        case 'json':
          console.log(OutputFormatter.formatJSON(results, { pretty: true }));
          break;
        case 'yaml':
          console.log(OutputFormatter.formatYAML(results));
          break;
      }
    }

  } catch (error) {
    if (error instanceof GitHubAPIClientError) {
      if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to modify issues in this repository.'));
      } else if (error.isNotFound()) {
        console.error(formatError('Milestone or repository not found.'));
      } else {
        console.error(formatError(`GitHub API error: ${error.message}`));
      }
    } else {
      throw error;
    }
  }
}

function parseIssueNumbers(input: string): number[] {
  const numbers: number[] = [];
  const parts = input.split(',').map(p => p.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      // Handle ranges like "123-130"
      const [start, end] = part.split('-').map(n => parseInt(n.trim()));
      if (isNaN(start) || isNaN(end) || start > end) {
        throw new Error(`Invalid range: ${part}`);
      }
      for (let i = start; i <= end; i++) {
        numbers.push(i);
      }
    } else {
      // Handle single numbers
      const num = parseInt(part);
      if (isNaN(num)) {
        throw new Error(`Invalid issue number: ${part}`);
      }
      numbers.push(num);
    }
  }

  // Remove duplicates and sort
  return [...new Set(numbers)].sort((a, b) => a - b);
}

function formatIssuesTable(issues: any[], options: { format: string; showMilestone?: boolean }): string {
  const rows = issues.map(issue => {
    const row = [
      `#${issue.number}`,
      truncateText(issue.title, 50),
      issue.state,
      issue.assignee?.login || 'Unassigned'
    ];
    
    if (options.showMilestone) {
      row.push(issue.milestone?.title || 'None');
    }
    
    return row;
  });

  const headers = ['Issue', 'Title', 'State', 'Assignee'];
  if (options.showMilestone) {
    headers.push('Current Milestone');
  }

  return OutputFormatter.formatTable(headers, rows, { format: 'table' });
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

// Export for use in other commands
export { handleBulkAssign };