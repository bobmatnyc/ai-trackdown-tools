/**
 * Label list command - List repository labels with filtering and sorting
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatError, formatInfo, formatWarning } from '../../utils/formatters.js';
import type { LabelListOptions } from '../../types/commands.js';
import type { LabelFilters, GitHubLabel } from '../../types/github.js';

export function createLabelListCommand(): Command {
  const cmd = new Command('list');
  
  cmd
    .description('List repository labels')
    .alias('ls')
    .option('-s, --sort <field>', 'Sort by field (name, created, updated)', 'name')
    .option('-d, --direction <dir>', 'Sort direction (asc, desc)', 'asc')
    .option('--search <text>', 'Search labels by name or description')
    .option('-n, --limit <number>', 'Maximum number of labels to return', parseInt, 100)
    .option('-p, --page <number>', 'Page number for pagination', parseInt, 1)
    .option('--format <format>', 'Output format (table, json, yaml, csv)', 'table')
    .option('--fields <fields>', 'Comma-separated list of fields to display')
    .option('--no-header', 'Hide table header')
    .option('--show-usage', 'Show usage statistics for each label')
    .action(async (options: LabelListOptions) => {
      try {
        await handleListLabels(options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleListLabels(options: LabelListOptions): Promise<void> {
  // Create GitHub client
  const client = createGitHubClient();
  
  // Get repository info
  const repository = client.getRepository();
  if (!repository) {
    throw new Error('No repository configured. Run "trackdown config repo" to set up repository.');
  }

  // Build filters
  const filters: LabelFilters = {};

  // Sorting
  if (options.sort) {
    if (!['name', 'created', 'updated'].includes(options.sort)) {
      throw new Error('Sort field must be "name", "created", or "updated"');
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
  filters.per_page = options.limit || 100;
  filters.page = options.page || 1;

  // Show filters in verbose mode
  if (options.verbose) {
    console.log(chalk.blue('Applied filters:'));
    console.log(chalk.gray(JSON.stringify(filters, null, 2)));
    console.log('');
  }

  try {
    console.log(chalk.blue(`Fetching labels from ${repository.owner}/${repository.name}...`));
    
    // Fetch labels
    const response = await client.listLabels(filters);
    let labels = response.data;
    
    // Apply client-side search filter
    if (options.search) {
      const searchTerm = options.search.toLowerCase();
      labels = labels.filter(label => 
        label.name.toLowerCase().includes(searchTerm) ||
        (label.description && label.description.toLowerCase().includes(searchTerm))
      );
    }

    if (labels.length === 0) {
      if (options.search) {
        console.log(formatInfo(`No labels found matching "${options.search}".`));
      } else {
        console.log(formatInfo('No labels found in this repository.'));
        console.log(formatInfo('Create your first label with: trackdown label create <name>'));
      }
      return;
    }

    // Get usage statistics if requested
    let usageStats: Map<string, number> | undefined;
    if (options.showUsage) {
      console.log(chalk.blue('Fetching label usage statistics...'));
      try {
        usageStats = new Map();
        
        // Get issues for each label to count usage
        for (const label of labels) {
          try {
            const issuesResponse = await client.listIssues({
              labels: label.name,
              state: 'all',
              per_page: 1
            });
            
            // GitHub doesn't return total count in headers for this endpoint
            // So we need to make a search query to get accurate counts
            const searchResponse = await client.searchIssues({
              q: `repo:${repository.owner}/${repository.name} label:"${label.name}"`
            });
            
            usageStats.set(label.name, searchResponse.data.total_count);
          } catch (error) {
            // If search fails, fall back to 0
            usageStats.set(label.name, 0);
          }
        }
      } catch (error) {
        console.log(formatWarning('Failed to fetch usage statistics'));
        usageStats = undefined;
      }
    }

    // Format output
    console.log(formatInfo(`Found ${labels.length} label${labels.length === 1 ? '' : 's'}`));
    console.log('');

    switch (options.format) {
      case 'json':
        const jsonData = usageStats ? 
          labels.map(label => ({
            ...label,
            usage_count: usageStats!.get(label.name) || 0
          })) : labels;
        console.log(OutputFormatter.formatJSON(jsonData, { pretty: true }));
        break;
      
      case 'yaml':
        const yamlData = usageStats ? 
          labels.map(label => ({
            ...label,
            usage_count: usageStats!.get(label.name) || 0
          })) : labels;
        console.log(OutputFormatter.formatYAML(yamlData));
        break;
      
      case 'csv':
        const csvHeaders = options.fields 
          ? options.fields.split(',').map(f => f.trim())
          : ['name', 'description', 'color', 'default'];
        if (usageStats) csvHeaders.push('usage_count');
        
        const csvData = usageStats ?
          labels.map(label => ({
            ...label,
            usage_count: usageStats!.get(label.name) || 0
          })) : labels;
        console.log(OutputFormatter.formatCSV(csvData, csvHeaders));
        break;
      
      default:
        // Enhanced table format with usage stats
        if (usageStats) {
          console.log(formatLabelsTableWithUsage(labels, usageStats, options));
        } else {
          console.log(OutputFormatter.formatLabelsTable(labels, {
            format: 'table',
            noHeader: options.noHeader,
            fields: options.fields?.split(',').map(f => f.trim())
          }));
        }
        break;
    }

    // Show pagination info
    if (labels.length === (options.limit || 100)) {
      console.log('');
      console.log(formatInfo(`Showing page ${options.page || 1}. Use --page=${(options.page || 1) + 1} for next page.`));
    }

    // Show summary statistics
    if (options.format === 'table' && labels.length > 0) {
      console.log('');
      console.log(chalk.bold.cyan('Summary:'));
      console.log(chalk.gray('─'.repeat(20)));
      
      const defaultLabels = labels.filter(l => l.default).length;
      const customLabels = labels.length - defaultLabels;
      
      console.log(`${chalk.bold('Total labels:')} ${labels.length}`);
      console.log(`${chalk.bold('Default labels:')} ${defaultLabels}`);
      console.log(`${chalk.bold('Custom labels:')} ${customLabels}`);
      
      // Color distribution
      const colorCounts = new Map<string, number>();
      labels.forEach(label => {
        const colorGroup = getColorGroup(label.color);
        colorCounts.set(colorGroup, (colorCounts.get(colorGroup) || 0) + 1);
      });
      
      if (colorCounts.size > 0) {
        console.log('');
        console.log(chalk.bold('Color distribution:'));
        for (const [color, count] of colorCounts.entries()) {
          console.log(`  ${color}: ${count}`);
        }
      }
      
      // Usage stats summary
      if (usageStats) {
        const totalUsage = Array.from(usageStats.values()).reduce((sum, count) => sum + count, 0);
        const unusedLabels = Array.from(usageStats.values()).filter(count => count === 0).length;
        
        console.log('');
        console.log(chalk.bold('Usage statistics:'));
        console.log(`  Total usage: ${totalUsage} issues`);
        console.log(`  Unused labels: ${unusedLabels}`);
        console.log(`  Average usage: ${(totalUsage / labels.length).toFixed(1)} per label`);
      }
    }

    // Show helpful commands
    if (options.format === 'table' && labels.length > 0) {
      console.log('');
      console.log(chalk.bold.cyan('Quick Actions:'));
      console.log(chalk.gray('─'.repeat(30)));
      console.log(`${chalk.cyan('Create label:')} trackdown label create <name>`);
      console.log(`${chalk.cyan('Update label:')} trackdown label update <name>`);
      console.log(`${chalk.cyan('Delete label:')} trackdown label delete <name>`);
      console.log(`${chalk.cyan('Search issues:')} trackdown issue search 'label:"<name>"'`);
    }

  } catch (error) {
    if (error instanceof GitHubAPIClientError) {
      if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to read labels in this repository.'));
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

// Enhanced table formatter with usage statistics
function formatLabelsTableWithUsage(labels: GitHubLabel[], usageStats: Map<string, number>, options: any): string {
  if (labels.length === 0) return '';
  
  const lines: string[] = [];
  
  // Header
  if (!options.noHeader) {
    const headerRow = [
      chalk.bold.cyan('Name'.padEnd(25)),
      chalk.bold.cyan('Description'.padEnd(30)),
      chalk.bold.cyan('Color'.padEnd(10)),
      chalk.bold.cyan('Usage'.padEnd(8)),
      chalk.bold.cyan('Default'.padEnd(8))
    ].join(' ');
    lines.push(headerRow);
    
    const separator = '─'.repeat(25) + ' ' + '─'.repeat(30) + ' ' + '─'.repeat(10) + ' ' + '─'.repeat(8) + ' ' + '─'.repeat(8);
    lines.push(chalk.gray(separator));
  }
  
  // Data rows
  labels.forEach(label => {
    const name = chalk.hex(`#${label.color}`).bold(label.name.padEnd(25));
    const description = (label.description || 'no description').substring(0, 27).padEnd(30);
    const color = chalk.hex(`#${label.color}`).bold(`#${label.color}`.padEnd(10));
    const usage = (usageStats.get(label.name) || 0).toString().padEnd(8);
    const isDefault = (label.default ? chalk.green('✓') : chalk.gray('✗')).padEnd(8);
    
    const row = [name, chalk.gray(description), color, chalk.blue(usage), isDefault].join(' ');
    lines.push(row);
  });
  
  return lines.join('\n');
}

// Helper function to group colors
function getColorGroup(color: string): string {
  const hex = color.toLowerCase();
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Simple color categorization
  if (r > g && r > b) return 'Red';
  if (g > r && g > b) return 'Green';
  if (b > r && b > g) return 'Blue';
  if (r === g && g === b) return 'Gray';
  if (r > 200 && g > 200 && b > 200) return 'Light';
  if (r < 50 && g < 50 && b < 50) return 'Dark';
  return 'Mixed';
}

// Export for use in other commands
export { handleListLabels };