/**
 * Bulk assign command - Mass assignment of issues to assignees
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatSuccess, formatError, formatWarning, formatInfo } from '../../utils/formatters.js';
import type { BulkAssignOptions } from '../../types/commands.js';

export function createBulkAssignCommand(): Command {
  const cmd = new Command('assign');
  
  cmd
    .description('Bulk assign issues to users with enterprise-scale performance')
    .option('--issues <issues>', 'Issue numbers (comma-separated, ranges: "123-130")')
    .option('--filter <query>', 'Filter query to select issues')
    .option('--assignee <user>', 'Username to assign issues to')
    .option('--notify', 'Send notifications to assignees')
    .option('--force', 'Skip confirmation prompts')
    .option('--dry-run', 'Show what would be assigned without making changes')
    .option('--batch-size <size>', 'Batch size for processing (default: 50)', parseInt, 50)
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .action(async (options: BulkAssignOptions) => {
      try {
        await handleBulkAssign(options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleBulkAssign(options: BulkAssignOptions): Promise<void> {
  // Validate required options
  if (!options.issues && !options.filter) {
    throw new Error('Either --issues or --filter must be specified');
  }

  if (!options.assignee) {
    throw new Error('--assignee is required');
  }

  // Create GitHub client
  const client = createGitHubClient();
  
  // Get repository info
  const repository = client.getRepository();
  if (!repository) {
    throw new Error('No repository configured. Run "aitrackdown config repo" to set up repository.');
  }

  try {
    console.log(chalk.blue('Preparing bulk assignment operation...'));
    
    // Get list of issues to process
    let issueNumbers: number[] = [];
    
    if (options.issues) {
      // Parse issue numbers from direct input
      issueNumbers = parseIssueNumbers(options.issues);
      console.log(chalk.blue(`Processing ${issueNumbers.length} specified issue number${issueNumbers.length === 1 ? '' : 's'}...`));
    } else if (options.filter) {
      // Get issues from filter query
      console.log(chalk.blue(`Searching issues with filter: ${options.filter}`));
      const searchResponse = await client.searchIssues(options.filter, {
        per_page: 100,
        sort: 'created',
        order: 'desc'
      });
      
      issueNumbers = searchResponse.data.items.map(issue => issue.number);
      console.log(chalk.blue(`Found ${issueNumbers.length} issue${issueNumbers.length === 1 ? '' : 's'} matching filter`));
    }

    if (issueNumbers.length === 0) {
      console.log(formatWarning('No issues found to assign'));
      return;
    }

    // Verify assignee exists
    console.log(chalk.blue(`Verifying assignee: ${options.assignee}`));
    try {
      await client.getUser(options.assignee);
      console.log(chalk.green(`✓ Assignee ${options.assignee} found`));
    } catch (error) {
      throw new Error(`Assignee "${options.assignee}" not found or not accessible`);
    }

    // Show summary
    console.log('');
    console.log(chalk.bold.cyan('📊 Bulk Assignment Summary'));
    console.log(chalk.gray('─'.repeat(35)));
    console.log(`${chalk.bold('Issues to process:')} ${issueNumbers.length}`);
    console.log(`${chalk.bold('Assignee:')} ${options.assignee}`);
    console.log(`${chalk.bold('Batch size:')} ${options.batchSize}`);
    console.log(`${chalk.bold('Notifications:')} ${options.notify ? 'Yes' : 'No'}`);

    if (options.dryRun) {
      console.log(`${chalk.bold('Mode:')} ${chalk.yellow('DRY RUN')}`);
    }

    // Show first few issues as preview
    if (issueNumbers.length > 0) {
      console.log('');
      console.log(chalk.bold.cyan('Preview (first 5 issues):'));
      const previewNumbers = issueNumbers.slice(0, 5);
      
      for (const issueNumber of previewNumbers) {
        try {
          const issue = await client.getIssue(issueNumber);
          const currentAssignee = issue.assignee?.login || 'Unassigned';
          console.log(`  #${issueNumber}: ${truncateText(issue.title, 60)} (${currentAssignee})`);
        } catch (error) {
          console.log(`  #${issueNumber}: ${chalk.red('Error loading issue')}`);
        }
      }
      
      if (issueNumbers.length > 5) {
        console.log(`  ... and ${issueNumbers.length - 5} more`);
      }
    }

    // Confirm operation
    if (!options.force && !options.dryRun) {
      const confirm = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: `Assign ${issueNumbers.length} issue${issueNumbers.length === 1 ? '' : 's'} to ${options.assignee}?`,
          default: false
        }
      ]);

      if (!confirm.proceed) {
        console.log(formatInfo('Bulk assignment cancelled'));
        return;
      }
    }

    // Process issues in batches
    const results = {
      assigned: [] as number[],
      failed: [] as { issue: number; error: string }[],
      skipped: [] as number[]
    };

    const batches = chunkArray(issueNumbers, options.batchSize);
    
    console.log('');
    console.log(chalk.blue(`Processing ${issueNumbers.length} issues in ${batches.length} batch${batches.length === 1 ? '' : 'es'}...`));

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNum = i + 1;
      
      console.log(chalk.blue(`\nBatch ${batchNum}/${batches.length} (${batch.length} issues):`));
      
      for (const issueNumber of batch) {
        try {
          if (options.dryRun) {
            console.log(chalk.gray(`  [DRY RUN] Would assign #${issueNumber} to ${options.assignee}`));
            results.assigned.push(issueNumber);
          } else {
            // Get current issue to check if already assigned
            const issue = await client.getIssue(issueNumber);
            
            if (issue.assignee?.login === options.assignee) {
              console.log(chalk.yellow(`  ↻ #${issueNumber}: Already assigned to ${options.assignee}`));
              results.skipped.push(issueNumber);
              continue;
            }

            // Assign issue
            await client.updateIssue(issueNumber, {
              assignees: [options.assignee]
            });
            
            console.log(chalk.green(`  ✓ #${issueNumber}: Assigned to ${options.assignee}`));
            results.assigned.push(issueNumber);
            
            // Add delay to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.log(chalk.red(`  ✗ #${issueNumber}: ${errorMsg}`));
          results.failed.push({ issue: issueNumber, error: errorMsg });
        }
      }
      
      // Progress indicator
      const processed = (i + 1) * options.batchSize;
      const total = issueNumbers.length;
      const percentage = Math.min(100, Math.round((processed / total) * 100));
      console.log(chalk.blue(`Progress: ${percentage}% (${Math.min(processed, total)}/${total})`));
    }

    // Show final results
    console.log('');
    console.log(chalk.bold.cyan('🎯 Bulk Assignment Results'));
    console.log(chalk.gray('─'.repeat(35)));
    console.log(`${chalk.bold('Successfully assigned:')} ${chalk.green(results.assigned.length.toString())}`);
    console.log(`${chalk.bold('Already assigned:')} ${chalk.yellow(results.skipped.length.toString())}`);
    console.log(`${chalk.bold('Failed:')} ${chalk.red(results.failed.length.toString())}`);

    if (results.assigned.length > 0) {
      const verb = options.dryRun ? 'Would assign' : 'Assigned';
      console.log(formatSuccess(`${verb} ${results.assigned.length} issue${results.assigned.length === 1 ? '' : 's'} to ${options.assignee}`));
    }

    // Show failed assignments
    if (results.failed.length > 0) {
      console.log('');
      console.log(chalk.bold.red('Failed Assignments:'));
      results.failed.slice(0, 10).forEach(f => {
        console.log(formatError(`#${f.issue}: ${f.error}`));
      });
      
      if (results.failed.length > 10) {
        console.log(formatError(`... and ${results.failed.length - 10} more failures`));
      }
    }

    // Export results if requested
    if (options.format !== 'table') {
      const exportData = {
        summary: {
          total_processed: issueNumbers.length,
          successfully_assigned: results.assigned.length,
          already_assigned: results.skipped.length,
          failed: results.failed.length,
          assignee: options.assignee,
          dry_run: options.dryRun
        },
        assigned_issues: results.assigned,
        skipped_issues: results.skipped,
        failed_assignments: results.failed
      };

      console.log('');
      switch (options.format) {
        case 'json':
          console.log(OutputFormatter.formatJSON(exportData, { pretty: true }));
          break;
        case 'yaml':
          console.log(OutputFormatter.formatYAML(exportData));
          break;
      }
    }

    // Show next steps
    if (results.assigned.length > 0 && !options.dryRun) {
      console.log('');
      console.log(chalk.bold.cyan('Next Steps:'));
      console.log(chalk.gray('─'.repeat(20)));
      console.log(`${chalk.cyan('View assigned issues:')} aitrackdown issue list --assignee ${options.assignee}`);
      console.log(`${chalk.cyan('Issue analytics:')} aitrackdown issue search "assignee:${options.assignee}"`);
      
      if (options.notify) {
        console.log(formatInfo(`Notifications sent to ${options.assignee}`));
      }
    }

  } catch (error) {
    if (error instanceof GitHubAPIClientError) {
      if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to modify issues.'));
      } else if (error.isNotFound()) {
        console.error(formatError('Repository or user not found.'));
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

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

// Export for use in other commands
export { handleBulkAssign };