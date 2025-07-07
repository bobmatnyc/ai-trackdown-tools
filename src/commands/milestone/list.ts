/**
 * Milestone list command - List milestones with progress tracking
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatError, formatInfo, formatWarning } from '../../utils/formatters.js';
import type { MilestoneListOptions } from '../../types/commands.js';
import type { MilestoneFilters } from '../../types/github.js';

export function createMilestoneListCommand(): Command {
  const cmd = new Command('list');
  
  cmd
    .description('List repository milestones')
    .alias('ls')
    .option('-s, --state <state>', 'Milestone state (open, closed, all)', 'open')
    .option('--sort <field>', 'Sort by field (due_on, completeness, created, updated)', 'due_on')
    .option('-d, --direction <dir>', 'Sort direction (asc, desc)', 'asc')
    .option('-n, --limit <number>', 'Maximum number of milestones to return', parseInt, 30)
    .option('-p, --page <number>', 'Page number for pagination', parseInt, 1)
    .option('--format <format>', 'Output format (table, json, yaml, csv)', 'table')
    .option('--fields <fields>', 'Comma-separated list of fields to display')
    .option('--no-header', 'Hide table header')
    .option('--show-progress', 'Show detailed progress information')
    .action(async (options: MilestoneListOptions) => {
      try {
        await handleListMilestones(options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleListMilestones(options: MilestoneListOptions): Promise<void> {
  // Create GitHub client
  const client = createGitHubClient();
  
  // Get repository info
  const repository = client.getRepository();
  if (!repository) {
    throw new Error('No repository configured. Run "aitrackdown config repo" to set up repository.');
  }

  // Build filters
  const filters: MilestoneFilters = {};

  // State filter
  if (options.state && options.state !== 'all') {
    if (!['open', 'closed'].includes(options.state)) {
      throw new Error('State must be "open", "closed", or "all"');
    }
    filters.state = options.state as 'open' | 'closed';
  }

  // Sorting
  if (options.sort) {
    if (!['due_on', 'completeness', 'created', 'updated'].includes(options.sort)) {
      throw new Error('Sort field must be "due_on", "completeness", "created", or "updated"');
    }
    filters.sort = options.sort as any;
  }

  if (options.direction) {
    if (!['asc', 'desc'].includes(options.direction)) {
      throw new Error('Direction must be "asc" or "desc"');
    }
    filters.direction = options.direction;
  }

  // Pagination
  filters.per_page = options.limit || 30;
  filters.page = options.page || 1;

  // Show filters in verbose mode
  if (options.verbose) {
    console.log(chalk.blue('Applied filters:'));
    console.log(chalk.gray(JSON.stringify(filters, null, 2)));
    console.log('');
  }

  try {
    console.log(chalk.blue(`Fetching milestones from ${repository.owner}/${repository.name}...`));
    
    // Fetch milestones
    const response = await client.listMilestones(filters);
    const milestones = response.data;

    if (milestones.length === 0) {
      console.log(formatInfo('No milestones found in this repository.'));
      
      if (options.state === 'open') {
        console.log(formatInfo('Try using --state=all to include closed milestones.'));
      }
      
      console.log(formatInfo('Create your first milestone with: aitrackdown milestone create <title>'));
      return;
    }

    // Format output
    console.log(formatInfo(`Found ${milestones.length} milestone${milestones.length === 1 ? '' : 's'}`));
    console.log('');

    switch (options.format) {
      case 'json':
        console.log(OutputFormatter.formatJSON(milestones, { pretty: true }));
        break;
      
      case 'yaml':
        console.log(OutputFormatter.formatYAML(milestones));
        break;
      
      case 'csv':
        const csvHeaders = options.fields 
          ? options.fields.split(',').map(f => f.trim())
          : ['number', 'title', 'state', 'due_on', 'open_issues', 'closed_issues'];
        console.log(OutputFormatter.formatCSV(milestones, csvHeaders));
        break;
      
      default:
        console.log(OutputFormatter.formatMilestonesTable(milestones, {
          format: 'table',
          noHeader: options.noHeader,
          fields: options.fields?.split(',').map(f => f.trim())
        }));
        
        // Show detailed progress if requested
        if (options.showProgress && milestones.length > 0) {
          console.log('');
          console.log(chalk.bold.cyan('Milestone Progress Details:'));
          console.log(chalk.gray('═'.repeat(60)));
          
          milestones.forEach((milestone, index) => {
            if (index > 0) console.log('');
            console.log(OutputFormatter.formatMilestoneProgress(milestone, { detailed: false }));
          });
        }
        break;
    }

    // Show pagination info
    if (milestones.length === (options.limit || 30)) {
      console.log('');
      console.log(formatInfo(`Showing page ${options.page || 1}. Use --page=${(options.page || 1) + 1} for next page.`));
    }

    // Show summary statistics
    if (options.format === 'table' && milestones.length > 0) {
      console.log('');
      console.log(chalk.bold.cyan('Summary:'));
      console.log(chalk.gray('─'.repeat(20)));
      
      const openMilestones = milestones.filter(m => m.state === 'open').length;
      const closedMilestones = milestones.length - openMilestones;
      const totalIssues = milestones.reduce((sum, m) => sum + m.open_issues + m.closed_issues, 0);
      const totalOpen = milestones.reduce((sum, m) => sum + m.open_issues, 0);
      const totalClosed = milestones.reduce((sum, m) => sum + m.closed_issues, 0);
      
      console.log(`${chalk.bold('Total milestones:')} ${milestones.length}`);
      console.log(`${chalk.bold('Open milestones:')} ${openMilestones}`);
      console.log(`${chalk.bold('Closed milestones:')} ${closedMilestones}`);
      console.log(`${chalk.bold('Total issues:')} ${totalIssues} (${totalClosed} closed, ${totalOpen} open)`);
      
      // Overall completion percentage
      if (totalIssues > 0) {
        const overallCompletion = Math.round((totalClosed / totalIssues) * 100);
        console.log(`${chalk.bold('Overall completion:')} ${overallCompletion}%`);
      }
      
      // Due date analysis
      const now = new Date();
      const overdue = milestones.filter(m => m.state === 'open' && m.due_on && new Date(m.due_on) < now).length;
      const dueSoon = milestones.filter(m => {
        if (m.state !== 'open' || !m.due_on) return false;
        const dueDate = new Date(m.due_on);
        const daysFromNow = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysFromNow <= 7 && daysFromNow > 0;
      }).length;
      
      if (overdue > 0) {
        console.log(`${chalk.bold('Overdue:')} ${chalk.red(overdue.toString())}`);
      }
      
      if (dueSoon > 0) {
        console.log(`${chalk.bold('Due soon (≤7 days):')} ${chalk.yellow(dueSoon.toString())}`);
      }
      
      // Milestones without due dates
      const noDueDate = milestones.filter(m => m.state === 'open' && !m.due_on).length;
      if (noDueDate > 0) {
        console.log(`${chalk.bold('No due date:')} ${noDueDate}`);
      }
    }

    // Show warnings and recommendations
    if (options.format === 'table' && milestones.length > 0) {
      const warnings: string[] = [];
      const recommendations: string[] = [];
      
      // Check for overdue milestones
      const now = new Date();
      const overdueMilestones = milestones.filter(m => 
        m.state === 'open' && m.due_on && new Date(m.due_on) < now
      );
      
      if (overdueMilestones.length > 0) {
        warnings.push(`${overdueMilestones.length} milestone${overdueMilestones.length === 1 ? ' is' : 's are'} overdue`);
        recommendations.push('Review overdue milestones and update due dates or close completed ones');
      }
      
      // Check for milestones with no issues
      const emptyMilestones = milestones.filter(m => m.open_issues === 0 && m.closed_issues === 0);
      if (emptyMilestones.length > 0) {
        warnings.push(`${emptyMilestones.length} milestone${emptyMilestones.length === 1 ? ' has' : 's have'} no issues`);
        recommendations.push('Assign issues to milestones or consider removing empty ones');
      }
      
      // Check for milestones without due dates
      const noDueDateMilestones = milestones.filter(m => m.state === 'open' && !m.due_on);
      if (noDueDateMilestones.length > 0) {
        recommendations.push('Consider setting due dates for better project planning');
      }
      
      if (warnings.length > 0) {
        console.log('');
        console.log(chalk.bold.yellow('⚠️  Warnings:'));
        warnings.forEach(warning => console.log(formatWarning(warning)));
      }
      
      if (recommendations.length > 0) {
        console.log('');
        console.log(chalk.bold.blue('💡 Recommendations:'));
        recommendations.forEach(rec => console.log(formatInfo(rec)));
      }
    }

    // Show helpful commands
    if (options.format === 'table' && milestones.length > 0) {
      console.log('');
      console.log(chalk.bold.cyan('Quick Actions:'));
      console.log(chalk.gray('─'.repeat(30)));
      console.log(`${chalk.cyan('Create milestone:')} aitrackdown milestone create <title>`);
      console.log(`${chalk.cyan('View progress:')} aitrackdown milestone progress <title>`);
      console.log(`${chalk.cyan('Update milestone:')} aitrackdown milestone update <title>`);
      console.log(`${chalk.cyan('Assign to issue:')} aitrackdown issue update <number> --milestone <title>`);
      console.log(`${chalk.cyan('List issues:')} aitrackdown issue list --milestone <title>`);
    }

  } catch (error) {
    if (error instanceof GitHubAPIClientError) {
      if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to read milestones in this repository.'));
      } else if (error.isNotFound()) {
        console.error(formatError('Repository not found or access denied.'));
      } else {
        console.error(formatError(`GitHub API error: ${error.message}`));
      }
    } else {
      throw error;
    }
  }
}

// Export for use in other commands
export { handleListMilestones };