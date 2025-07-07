import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import type { TrackdownItem, StatusFilter } from '../types/index.js';
import { ConfigManager } from '../utils/config.js';
import { Formatter } from '../utils/formatter.js';
import { 
  validateStatus, 
  validatePriority, 
  validateAssignee,
  validateId,
  ValidationError 
} from '../utils/validation.js';

export function createStatusCommand(): Command {
  const command = new Command('status');

  command
    .description('Display comprehensive project status with advanced filtering and analytics')
    .option('-v, --verbose', 'show detailed item information with descriptions')
    .option('-c, --compact', 'compact output format for quick overview')
    .option('--table', 'display results in table format')
    .option('--stats', 'show detailed project statistics and analytics')
    .option('--filter <expr>', 'advanced filter expression (e.g., "status=todo,priority=high")')
    .option('-s, --status <status>', 'filter by status (todo, in-progress, done, blocked)')
    .option('-p, --priority <priority>', 'filter by priority (low, medium, high, critical)')
    .option('-a, --assignee <name>', 'filter by assignee name or email')
    .option('-t, --tags <tags>', 'filter by tags (comma-separated)')
    .option('-i, --id <id>', 'filter by specific item ID')
    .option('--created-after <date>', 'show items created after date (YYYY-MM-DD)')
    .option('--created-before <date>', 'show items created before date (YYYY-MM-DD)')
    .option('--updated-after <date>', 'show items updated after date (YYYY-MM-DD)')
    .option('--updated-before <date>', 'show items updated before date (YYYY-MM-DD)')
    .option('--estimate-min <points>', 'minimum story points')
    .option('--estimate-max <points>', 'maximum story points')
    .option('--sort <field>', 'sort by field (created, updated, priority, status, title)', 'updated')
    .option('--order <direction>', 'sort order (asc, desc)', 'desc')
    .option('--limit <count>', 'limit number of results shown')
    .option('--offset <count>', 'skip number of results (for pagination)')
    .option('--interactive', 'interactive filtering and display mode')
    .option('--watch', 'continuously monitor and refresh status')
    .option('--export <file>', 'export filtered results to file')
    .addHelpText('after', `
Examples:
  $ trackdown status
  $ trackdown status --verbose --stats
  $ trackdown status --filter "status=todo,priority=high"
  $ trackdown status --assignee john.doe --created-after 2024-01-01
  $ trackdown status --tags backend,security --table
  $ trackdown status --interactive
  $ trackdown status --stats --export project-status.json

Filter Expressions:
  status=todo,blocked        - Multiple status values
  priority=high              - Single priority
  assignee=john.doe          - Specific assignee
  tags=backend,api           - Items with any of these tags
  estimate=5-13              - Story points range

Status Values:
  todo          - Not started
  in-progress   - Currently being worked on
  blocked       - Blocked by dependencies or issues
  done          - Completed tasks

Priority Levels:
  low           - Nice to have, non-urgent
  medium        - Standard priority (default)
  high          - Important, should be done soon
  critical      - Urgent, blocking other work

Sort Fields:
  created       - Creation date
  updated       - Last modified date
  priority      - Priority level (critical > high > medium > low)
  status        - Status progression (todo > in-progress > blocked > done)
  title         - Alphabetical by title
`)
    .action(
      async (options?: {
        verbose?: boolean;
        compact?: boolean;
        table?: boolean;
        stats?: boolean;
        filter?: string;
        status?: string;
        priority?: string;
        assignee?: string;
        tags?: string;
        id?: string;
        createdAfter?: string;
        createdBefore?: string;
        updatedAfter?: string;
        updatedBefore?: string;
        estimateMin?: string;
        estimateMax?: string;
        sort?: string;
        order?: string;
        limit?: string;
        offset?: string;
        interactive?: boolean;
        watch?: boolean;
        export?: string;
      }) => {
        try {
          // Load configuration first
          const configManager = new ConfigManager();
          const config = configManager.getConfig();

          const trackdownDir = join(process.cwd(), 'trackdown');

          if (!existsSync(trackdownDir)) {
            console.error(Formatter.error('No trackdown project found in current directory'));
            console.log(Formatter.info('Run "trackdown init" to initialize a new project'));
            console.log(Formatter.info('Or navigate to a directory with an existing trackdown project'));
            process.exit(1);
          }

          // Interactive mode
          if (options?.interactive) {
            const interactiveOptions = await runInteractiveStatusMode(options);
            options = { ...options, ...interactiveOptions };
          }

          // Watch mode
          if (options?.watch) {
            return runWatchMode(trackdownDir, options, config);
          }

          // Show progress indicator
          const spinner = ora('Analyzing project status...').start();

          try {
            // Get and parse all items
            const items = await getAllItemsEnhanced(trackdownDir);
            
            spinner.text = 'Applying filters...';

            // Parse and validate filters
            const filters = parseFilters(options);
            
            // Apply all filters
            const filteredItems = applyAdvancedFilters(items, filters);

            spinner.text = 'Processing results...';

            // Apply sorting and pagination
            const sortedItems = applySorting(filteredItems, options?.sort || 'updated', options?.order || 'desc');
            const paginatedItems = applyPagination(sortedItems, options?.limit, options?.offset);

            spinner.succeed(`Found ${filteredItems.length} items${filteredItems.length !== items.length ? ` (${items.length} total)` : ''}`);

            // Display banner
            console.log(Formatter.header(`📊 ${config.projectName || 'Trackdown'} Project Status`));

            // Show project summary and statistics
            if (options?.stats !== false) {
              displayProjectOverview(trackdownDir, items, config);
            }

            if (filteredItems.length === 0) {
              console.log(Formatter.box('No items match the current filters', 'info'));
              console.log(Formatter.info('Try adjusting your filter criteria or use --help for filter examples'));
              return;
            }

            // Display results based on format
            if (options?.table) {
              console.log(Formatter.header('📋 Items Table'));
              console.log(Formatter.formatTable(paginatedItems));
            } else if (options?.compact) {
              console.log(Formatter.header('📝 Compact View'));
              displayCompactView(paginatedItems);
            } else if (options?.verbose) {
              console.log(Formatter.header('📖 Detailed View'));
              displayDetailedView(paginatedItems);
            } else {
              console.log(Formatter.header('📋 Status Overview'));
              displayGroupedView(paginatedItems);
            }

            // Show detailed statistics
            if (options?.stats) {
              console.log(Formatter.header('📈 Project Analytics'));
              displayAdvancedStatistics(filteredItems, items);
            }

            // Show active filters
            if (hasActiveFilters(filters)) {
              displayActiveFilters(filters);
            }

            // Show pagination info
            if (options?.limit || options?.offset) {
              displayPaginationInfo(sortedItems.length, paginatedItems.length, options);
            }

            // Export if requested
            if (options?.export) {
              await exportResults(filteredItems, options.export, config);
            }

            // Show helpful next steps
            if (!options?.compact && !options?.table) {
              displayNextSteps(filteredItems, config);
            }

          } catch (error) {
            spinner.fail('Status analysis failed');
            throw error;
          }

        } catch (error) {
          if (error instanceof ValidationError) {
            console.error(Formatter.error(error.message));
            if (error.suggestion) {
              console.log(Formatter.info(`💡 ${error.suggestion}`));
            }
            if (error.validOptions?.length) {
              console.log(Formatter.info('Valid options:'));
              error.validOptions.forEach(option => {
                console.log(Formatter.highlight(`  ${option}`));
              });
            }
          } else {
            console.error(Formatter.error(
              `Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`
            ));
          }
          process.exit(1);
        }
      }
    );

  return command;
}

// Enhanced functions for Phase 2 implementation
async function runInteractiveStatusMode(currentOptions: any): Promise<any> {
  console.log(Formatter.header('🔍 Interactive Status Filtering'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'outputFormat',
      message: 'Output format:',
      choices: [
        { name: '📋 Default - Grouped by status', value: 'default' },
        { name: '📖 Verbose - Detailed item view', value: 'verbose' },
        { name: '📝 Compact - Quick overview', value: 'compact' },
        { name: '📊 Table - Tabular format', value: 'table' },
      ],
      default: 'default',
    },
    {
      type: 'checkbox',
      name: 'statusFilter',
      message: 'Filter by status (select multiple):',
      choices: [
        { name: '📝 Todo - Not started', value: 'todo' },
        { name: '🔄 In Progress - Currently working', value: 'in-progress' },
        { name: '🚫 Blocked - Dependencies or issues', value: 'blocked' },
        { name: '✅ Done - Completed tasks', value: 'done' },
      ],
    },
    {
      type: 'checkbox',
      name: 'priorityFilter',
      message: 'Filter by priority (select multiple):',
      choices: [
        { name: '🔴 Critical - Urgent, blocking', value: 'critical' },
        { name: '🟠 High - Important, urgent', value: 'high' },
        { name: '🟡 Medium - Standard priority', value: 'medium' },
        { name: '🟢 Low - Nice to have', value: 'low' },
      ],
    },
    {
      type: 'input',
      name: 'assigneeFilter',
      message: 'Filter by assignee (username/email):',
    },
    {
      type: 'input',
      name: 'tagsFilter',
      message: 'Filter by tags (comma-separated):',
    },
    {
      type: 'list',
      name: 'sortBy',
      message: 'Sort results by:',
      choices: [
        { name: '🕒 Last Updated (newest first)', value: 'updated:desc' },
        { name: '🕒 Last Updated (oldest first)', value: 'updated:asc' },
        { name: '📅 Created Date (newest first)', value: 'created:desc' },
        { name: '📅 Created Date (oldest first)', value: 'created:asc' },
        { name: '🏷️ Priority (high to low)', value: 'priority:desc' },
        { name: '📝 Title (A-Z)', value: 'title:asc' },
      ],
      default: 'updated:desc',
    },
    {
      type: 'confirm',
      name: 'showStats',
      message: 'Show detailed statistics?',
      default: true,
    },
    {
      type: 'input',
      name: 'limitResults',
      message: 'Limit number of results (leave blank for all):',
      validate: (input: string) => {
        if (!input) return true;
        const num = parseInt(input);
        if (isNaN(num) || num < 1) return 'Please enter a valid positive number';
        return true;
      },
    },
  ]);

  // Convert answers to options format
  const [sortField, sortOrder] = answers.sortBy.split(':');
  
  return {
    verbose: answers.outputFormat === 'verbose',
    compact: answers.outputFormat === 'compact',
    table: answers.outputFormat === 'table',
    stats: answers.showStats,
    status: answers.statusFilter.length === 1 ? answers.statusFilter[0] : undefined,
    priority: answers.priorityFilter.length === 1 ? answers.priorityFilter[0] : undefined,
    assignee: answers.assigneeFilter || undefined,
    tags: answers.tagsFilter || undefined,
    sort: sortField,
    order: sortOrder,
    limit: answers.limitResults ? answers.limitResults : undefined,
    filter: buildFilterExpression(answers),
  };
}

function buildFilterExpression(answers: any): string {
  const filters = [];
  
  if (answers.statusFilter.length > 1) {
    filters.push(`status=${answers.statusFilter.join(',')}`);
  }
  if (answers.priorityFilter.length > 1) {
    filters.push(`priority=${answers.priorityFilter.join(',')}`);
  }
  if (answers.assigneeFilter) {
    filters.push(`assignee=${answers.assigneeFilter}`);
  }
  if (answers.tagsFilter) {
    filters.push(`tags=${answers.tagsFilter}`);
  }

  return filters.join(',');
}

async function runWatchMode(trackdownDir: string, options: any, config: any): Promise<void> {
  console.log(Formatter.info('👁️ Watch mode enabled - monitoring for changes...'));
  console.log(Formatter.info('Press Ctrl+C to exit'));

  let lastHash = '';

  const displayStatus = async () => {
    try {
      // Clear console
      console.clear();
      
      // Show current time
      console.log(Formatter.header(`📊 ${config.projectName || 'Trackdown'} Live Status - ${new Date().toLocaleTimeString()}`));
      
      // Get items and generate hash for change detection
      const items = await getAllItemsEnhanced(trackdownDir);
      const currentHash = JSON.stringify(items.map(i => `${i.id}-${i.updatedAt.getTime()}`)).substring(0, 20);
      
      if (currentHash !== lastHash) {
        const filters = parseFilters(options);
        const filteredItems = applyAdvancedFilters(items, filters);
        const sortedItems = applySorting(filteredItems, options?.sort || 'updated', options?.order || 'desc');
        const paginatedItems = applyPagination(sortedItems, options?.limit, options?.offset);

        displayProjectOverview(trackdownDir, items, config);
        
        if (paginatedItems.length > 0) {
          if (options?.table) {
            console.log(Formatter.formatTable(paginatedItems));
          } else {
            displayGroupedView(paginatedItems);
          }
        } else {
          console.log(Formatter.box('No items match current filters', 'info'));
        }
        
        lastHash = currentHash;
        console.log(Formatter.info(`🔄 Last updated: ${new Date().toLocaleTimeString()}`));
      } else {
        console.log(Formatter.info('No changes detected'));
      }
    } catch (error) {
      console.error(Formatter.error(`Watch mode error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  };

  // Initial display
  await displayStatus();

  // Set up file watching interval
  const interval = setInterval(displayStatus, 2000);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log(Formatter.info('\n👋 Watch mode stopped'));
    process.exit(0);
  });
}

async function getAllItemsEnhanced(trackdownDir: string): Promise<TrackdownItem[]> {
  const items: TrackdownItem[] = [];
  const directories = ['active', 'completed'];

  for (const dir of directories) {
    const fullPath = join(trackdownDir, dir);
    if (existsSync(fullPath)) {
      const files = readdirSync(fullPath).filter((file) => file.endsWith('.md'));

      for (const file of files) {
        try {
          const item = parseTrackdownFileEnhanced(join(fullPath, file));
          if (item) {
            items.push(item);
          }
        } catch (_error) {
          console.warn(Formatter.warning(`Could not parse file: ${file}`));
        }
      }
    }
  }

  return items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

function parseTrackdownFileEnhanced(filePath: string): TrackdownItem | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const stats = statSync(filePath);

    // Extract metadata from markdown
    const titleMatch = content.match(/^# (.+)$/m);
    const idMatch = content.match(/\*\*ID\*\*:\s*(.+)$/m);
    const statusMatch = content.match(/\*\*Status\*\*:\s*(.+)$/m);
    const priorityMatch = content.match(/\*\*Priority\*\*:\s*(.+)$/m);
    const assigneeMatch = content.match(/\*\*Assignee\*\*:\s*(.+)$/m);
    const createdMatch = content.match(/\*\*Created\*\*:\s*(.+)$/m);
    const updatedMatch = content.match(/\*\*Updated\*\*:\s*(.+)$/m);
    const tagsMatch = content.match(/\*\*Tags\*\*:\s*(.+)$/m);
    const labelsMatch = content.match(/\*\*Labels\*\*:\s*(.+)$/m);
    const estimateMatch = content.match(/\*\*Story Points\*\*:\s*(.+)$/m);

    if (!titleMatch || !idMatch) {
      return null;
    }

    // Extract description (content between Description and next section)
    const descriptionMatch = content.match(/## Description\n\n(.*?)\n\n##/s);

    // Parse tags and labels
    const tags = tagsMatch
      ? tagsMatch[1]
          .split(',')
          .map((tag) => tag.trim().replace(/`/g, ''))
          .filter(Boolean)
      : undefined;

    const labels = labelsMatch
      ? labelsMatch[1]
          .split(',')
          .map((label) => label.trim().replace(/`/g, ''))
          .filter(Boolean)
      : undefined;

    const estimate = estimateMatch ? parseFloat(estimateMatch[1].trim()) : undefined;

    return {
      id: idMatch[1].trim(),
      title: titleMatch[1].trim(),
      description: descriptionMatch ? descriptionMatch[1].trim() : undefined,
      status: (statusMatch?.[1]?.trim() || 'todo') as 'todo' | 'in-progress' | 'done' | 'blocked',
      priority: (priorityMatch?.[1]?.trim() || 'medium') as 'low' | 'medium' | 'high' | 'critical',
      assignee:
        assigneeMatch?.[1]?.trim() !== 'Unassigned' ? assigneeMatch?.[1]?.trim() : undefined,
      createdAt: createdMatch ? new Date(createdMatch[1].trim()) : stats.birthtime,
      updatedAt: updatedMatch ? new Date(updatedMatch[1].trim()) : stats.mtime,
      tags,
      labels,
      estimate,
    };
  } catch (_error) {
    return null;
  }
}

function parseFilters(options: any): StatusFilter {
  const filters: StatusFilter = {};

  // Basic filters
  if (options?.status) {
    filters.status = validateStatus(options.status);
  }
  
  if (options?.priority) {
    filters.priority = validatePriority(options.priority);
  }
  
  if (options?.assignee) {
    filters.assignee = validateAssignee(options.assignee);
  }
  
  if (options?.id) {
    filters.id = validateId(options.id);
  }
  
  if (options?.tags) {
    filters.tags = validateTags(options.tags);
  }

  // Date filters
  if (options?.createdAfter) {
    filters.createdAfter = new Date(options.createdAfter);
  }
  
  if (options?.createdBefore) {
    filters.createdBefore = new Date(options.createdBefore);
  }
  
  if (options?.updatedAfter) {
    filters.updatedAfter = new Date(options.updatedAfter);
  }
  
  if (options?.updatedBefore) {
    filters.updatedBefore = new Date(options.updatedBefore);
  }

  // Story point filters
  if (options?.estimateMin) {
    filters.estimateMin = parseFloat(options.estimateMin);
  }
  
  if (options?.estimateMax) {
    filters.estimateMax = parseFloat(options.estimateMax);
  }

  // Advanced filter expression
  if (options?.filter) {
    parseAdvancedFilter(options.filter, filters);
  }

  return filters;
}

function parseAdvancedFilter(filterExpr: string, filters: StatusFilter): void {
  const parts = filterExpr.split(',');
  
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (!key || !value) continue;
    
    const trimmedKey = key.trim();
    const trimmedValue = value.trim();
    
    switch (trimmedKey) {
      case 'status':
        if (trimmedValue.includes(',')) {
          filters.statusIn = trimmedValue.split(',').map(s => s.trim());
        } else {
          filters.status = trimmedValue;
        }
        break;
      case 'priority':
        if (trimmedValue.includes(',')) {
          filters.priorityIn = trimmedValue.split(',').map(p => p.trim());
        } else {
          filters.priority = trimmedValue;
        }
        break;
      case 'assignee':
        filters.assignee = trimmedValue;
        break;
      case 'tags':
        filters.tags = trimmedValue.split(',').map(t => t.trim());
        break;
      case 'estimate':
        if (trimmedValue.includes('-')) {
          const [min, max] = trimmedValue.split('-');
          filters.estimateMin = parseFloat(min);
          filters.estimateMax = parseFloat(max);
        }
        break;
    }
  }
}

function applyAdvancedFilters(items: TrackdownItem[], filters: StatusFilter): TrackdownItem[] {
  return items.filter((item) => {
    // Status filters
    if (filters.status && item.status !== filters.status) return false;
    if (filters.statusIn && !filters.statusIn.includes(item.status)) return false;
    
    // Priority filters
    if (filters.priority && item.priority !== filters.priority) return false;
    if (filters.priorityIn && !filters.priorityIn.includes(item.priority)) return false;
    
    // Assignee filter
    if (filters.assignee && item.assignee !== filters.assignee) return false;
    
    // ID filter
    if (filters.id && item.id !== filters.id) return false;
    
    // Tags filter - item must have at least one matching tag
    if (filters.tags && filters.tags.length > 0) {
      if (!item.tags || !filters.tags.some(tag => item.tags!.includes(tag))) return false;
    }
    
    // Date filters
    if (filters.createdAfter && item.createdAt < filters.createdAfter) return false;
    if (filters.createdBefore && item.createdAt > filters.createdBefore) return false;
    if (filters.updatedAfter && item.updatedAt < filters.updatedAfter) return false;
    if (filters.updatedBefore && item.updatedAt > filters.updatedBefore) return false;
    
    // Story point filters
    if (filters.estimateMin && (!item.estimate || item.estimate < filters.estimateMin)) return false;
    if (filters.estimateMax && (!item.estimate || item.estimate > filters.estimateMax)) return false;
    
    return true;
  });
}

function applySorting(items: TrackdownItem[], sortField: string, sortOrder: string): TrackdownItem[] {
  const direction = sortOrder === 'desc' ? -1 : 1;
  
  return [...items].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'created':
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
        break;
      case 'updated':
        comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'priority':
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        break;
      case 'status':
        const statusOrder = { todo: 1, 'in-progress': 2, blocked: 3, done: 4 };
        comparison = statusOrder[a.status] - statusOrder[b.status];
        break;
      default:
        comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
    }
    
    return comparison * direction;
  });
}

function applyPagination(items: TrackdownItem[], limit?: string, offset?: string): TrackdownItem[] {
  let start = 0;
  let end = items.length;
  
  if (offset) {
    start = parseInt(offset);
    if (isNaN(start) || start < 0) start = 0;
  }
  
  if (limit) {
    const limitNum = parseInt(limit);
    if (!isNaN(limitNum) && limitNum > 0) {
      end = start + limitNum;
    }
  }
  
  return items.slice(start, end);
}

function displayProjectOverview(trackdownDir: string, items: TrackdownItem[], config: any): void {
  const summary = getProjectSummaryEnhanced(trackdownDir, items);
  console.log(summary);
}

function getProjectSummaryEnhanced(trackdownDir: string, items: TrackdownItem[]): string {
  const activeItems = items.filter(item => item.status !== 'done');
  const completedItems = items.filter(item => item.status === 'done');
  const total = items.length;
  const completionRate = total > 0 ? Math.round((completedItems.length / total) * 100) : 0;
  
  // Calculate velocity metrics
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const recentlyCompleted = completedItems.filter(item => item.updatedAt >= lastWeek).length;
  const recentlyCreated = items.filter(item => item.createdAt >= lastWeek).length;
  
  // Priority breakdown
  const byPriority = items.reduce((acc, item) => {
    acc[item.priority] = (acc[item.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return [
    `📊 Project Overview`,
    `   Active Items: ${Formatter.highlight(activeItems.length.toString())}`,
    `   Completed Items: ${Formatter.highlight(completedItems.length.toString())}`,
    `   Total Items: ${Formatter.highlight(total.toString())}`,
    `   Completion Rate: ${Formatter.highlight(`${completionRate}%`)}`,
    `   Weekly Velocity: ${Formatter.highlight(`${recentlyCompleted} completed, ${recentlyCreated} created`)}`,
    `   Priority Breakdown: ${Object.entries(byPriority).map(([p, c]) => `${p}: ${c}`).join(', ')}`,
    '',
  ].join('\n');
}

function displayCompactView(items: TrackdownItem[]): void {
  items.forEach((item, index) => {
    const statusBadge = getStatusIcon(item.status);
    const priorityColor = getPriorityColor(item.priority);
    console.log(
      `${(index + 1).toString().padStart(3, ' ')}. ${statusBadge} ${priorityColor(item.priority.charAt(0).toUpperCase())} ${item.title} ${Formatter.dim(`(${item.id})`)}`
    );
  });
}

function displayDetailedView(items: TrackdownItem[]): void {
  items.forEach((item, index) => {
    console.log(Formatter.formatItem(item, 'detailed'));
    if (index < items.length - 1) {
      console.log(Formatter.dim('─'.repeat(80)));
    }
  });
}

function displayGroupedView(items: TrackdownItem[]): void {
  const groupedItems = groupItemsByStatus(items);

  for (const [status, statusItems] of Object.entries(groupedItems)) {
    if (statusItems.length > 0) {
      console.log(Formatter.subheader(`${getStatusIcon(status)} ${status.toUpperCase()} (${statusItems.length})`));
      
      statusItems.forEach((item, index) => {
        const priorityColor = getPriorityColor(item.priority);
        const assigneeInfo = item.assignee ? ` @${item.assignee}` : '';
        const tagsInfo = item.tags?.length ? ` [${item.tags.join(', ')}]` : '';
        console.log(
          `  ${index + 1}. ${priorityColor(item.priority.toUpperCase())} ${item.title}${assigneeInfo}${tagsInfo} ${Formatter.dim(`(${item.id})`)}`
        );
      });
      console.log('');
    }
  }
}

function displayAdvancedStatistics(filteredItems: TrackdownItem[], allItems: TrackdownItem[]): void {
  const stats = Formatter.generateStats(filteredItems);
  console.log(stats);
  
  // Additional analytics
  if (allItems.length > filteredItems.length) {
    console.log(Formatter.info(`📊 Showing ${filteredItems.length} of ${allItems.length} total items`));
  }
  
  // Estimate statistics
  const withEstimates = filteredItems.filter(item => item.estimate);
  if (withEstimates.length > 0) {
    const totalPoints = withEstimates.reduce((sum, item) => sum + (item.estimate || 0), 0);
    const avgPoints = Math.round(totalPoints / withEstimates.length * 10) / 10;
    console.log(Formatter.info(`📊 Story Points: ${totalPoints} total, ${avgPoints} average (${withEstimates.length} estimated)`));
  }
  
  // Recent activity
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const recentActivity = filteredItems.filter(item => item.updatedAt >= lastWeek).length;
  console.log(Formatter.info(`🔄 Recent Activity: ${recentActivity} items updated in the last 7 days`));
}

function hasActiveFilters(filters: StatusFilter): boolean {
  return Object.keys(filters).length > 0;
}

function displayActiveFilters(filters: StatusFilter): void {
  console.log(Formatter.header('🔍 Active Filters'));
  
  const filterDescriptions = [];
  
  if (filters.status) filterDescriptions.push(`Status: ${filters.status}`);
  if (filters.statusIn) filterDescriptions.push(`Status in: ${filters.statusIn.join(', ')}`);
  if (filters.priority) filterDescriptions.push(`Priority: ${filters.priority}`);
  if (filters.priorityIn) filterDescriptions.push(`Priority in: ${filters.priorityIn.join(', ')}`);
  if (filters.assignee) filterDescriptions.push(`Assignee: ${filters.assignee}`);
  if (filters.id) filterDescriptions.push(`ID: ${filters.id}`);
  if (filters.tags) filterDescriptions.push(`Tags: ${filters.tags.join(', ')}`);
  if (filters.createdAfter) filterDescriptions.push(`Created after: ${filters.createdAfter.toDateString()}`);
  if (filters.createdBefore) filterDescriptions.push(`Created before: ${filters.createdBefore.toDateString()}`);
  if (filters.updatedAfter) filterDescriptions.push(`Updated after: ${filters.updatedAfter.toDateString()}`);
  if (filters.updatedBefore) filterDescriptions.push(`Updated before: ${filters.updatedBefore.toDateString()}`);
  if (filters.estimateMin) filterDescriptions.push(`Min estimate: ${filters.estimateMin}`);
  if (filters.estimateMax) filterDescriptions.push(`Max estimate: ${filters.estimateMax}`);
  
  filterDescriptions.forEach(desc => {
    console.log(Formatter.info(`  • ${desc}`));
  });
  
  console.log('');
}

function displayPaginationInfo(totalCount: number, displayedCount: number, options: any): void {
  const offset = options?.offset ? parseInt(options.offset) : 0;
  const limit = options?.limit ? parseInt(options.limit) : displayedCount;
  
  console.log(Formatter.info(`📄 Pagination: Showing ${displayedCount} items (${offset + 1}-${offset + displayedCount} of ${totalCount})`));
  
  if (offset + displayedCount < totalCount) {
    console.log(Formatter.info(`   Next page: --offset ${offset + limit} --limit ${limit}`));
  }
  
  console.log('');
}

async function exportResults(items: TrackdownItem[], exportFile: string, config: any): Promise<void> {
  const spinner = ora('Exporting filtered results...').start();
  
  try {
    const format = exportFile.split('.').pop() || 'json';
    const exportData = Formatter.formatExport(items, format);
    
    writeFileSync(exportFile, exportData);
    
    spinner.succeed(`Exported ${items.length} items to ${exportFile}`);
    console.log(Formatter.info(`📄 Export completed: ${exportFile}`));
  } catch (error) {
    spinner.fail('Export failed');
    throw error;
  }
}

function displayNextSteps(items: TrackdownItem[], config: any): void {
  console.log(Formatter.header('💡 Quick Actions'));
  
  const todoItems = items.filter(item => item.status === 'todo');
  const inProgressItems = items.filter(item => item.status === 'in-progress');
  const blockedItems = items.filter(item => item.status === 'blocked');
  
  if (todoItems.length > 0) {
    console.log(Formatter.info('📝 Create a new task:'));
    console.log(Formatter.highlight('  trackdown track "New task title"'));
  }
  
  if (inProgressItems.length > 0) {
    console.log(Formatter.info('🔄 Update task status:'));
    console.log(Formatter.highlight(`  # Edit file: ${inProgressItems[0].id}*.md`));
  }
  
  if (blockedItems.length > 0) {
    console.log(Formatter.warning('🚫 Review blocked items for resolution'));
  }
  
  console.log(Formatter.info('📊 View detailed item:'));
  console.log(Formatter.highlight('  trackdown status --id <item-id> --verbose'));
  
  console.log('');
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'todo': return '📝';
    case 'in-progress': return '🔄';
    case 'blocked': return '🚫';
    case 'done': return '✅';
    default: return '📄';
  }
}

function groupItemsByStatus(items: TrackdownItem[]): Record<string, TrackdownItem[]> {
  const groups: Record<string, TrackdownItem[]> = {
    todo: [],
    'in-progress': [],
    blocked: [],
    done: [],
  };

  for (const item of items) {
    if (groups[item.status]) {
      groups[item.status].push(item);
    }
  }

  return groups;
}

function getPriorityColor(priority: string): (text: string) => string {
  switch (priority) {
    case 'low':
      return Formatter.dim;
    case 'medium':
      return (text: string) => text; // no color
    case 'high':
      return (text: string) => Formatter.highlight(text);
    case 'critical':
      return (text: string) => Formatter.error(text);
    default:
      return (text: string) => text;
  }
}

function validateStatus(status: string): string {
  const validStatuses = ['todo', 'in-progress', 'blocked', 'done'];
  const normalizedStatus = status.toLowerCase().trim();
  
  if (!validStatuses.includes(normalizedStatus)) {
    throw new ValidationError(
      `Invalid status: ${status}`,
      `Valid statuses are: ${validStatuses.join(', ')}`,
      1,
      'status',
      validStatuses.map(s => `--status ${s}`)
    );
  }
  
  return normalizedStatus;
}
