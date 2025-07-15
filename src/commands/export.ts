import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import type { StatusFilter, TrackdownItem } from '../types/index.js';
import { ConfigManager } from '../utils/config.js';
import { Formatter } from '../utils/formatter.js';
import { PathResolver } from '../utils/path-resolver.js';
import {
  ValidationError,
  validateAssignee,
  validatePriority,
  validateStatus,
} from '../utils/validation.js';

export function createExportCommand(): Command {
  const command = new Command('export');

  command
    .description('Export trackdown data with advanced filtering and professional output formats')
    .option('-f, --format <type>', 'export format (json, yaml, csv, md, table)', 'json')
    .option('-o, --output <file>', 'output file path (auto-generated if not specified)')
    .option('--filter <expr>', 'advanced filter expression (e.g., "status=todo,priority=high")')
    .option('-s, --status <status>', 'filter by status (todo, in-progress, done, blocked)')
    .option('-p, --priority <priority>', 'filter by priority (low, medium, high, critical)')
    .option('-a, --assignee <name>', 'filter by assignee name or email')
    .option('-t, --tags <tags>', 'filter by tags (comma-separated)')
    .option('--labels <labels>', 'filter by labels (comma-separated, alias for --tags)')
    .option('-i, --id <id>', 'filter by specific item ID')
    .option('--created-after <date>', 'show items created after date (YYYY-MM-DD)')
    .option('--created-before <date>', 'show items created before date (YYYY-MM-DD)')
    .option('--updated-after <date>', 'show items updated after date (YYYY-MM-DD)')
    .option('--updated-before <date>', 'show items updated before date (YYYY-MM-DD)')
    .option('--estimate-min <points>', 'minimum story points')
    .option('--estimate-max <points>', 'maximum story points')
    .option('--include-completed', 'include completed items', false)
    .option('--include-descriptions', 'include full descriptions in export', true)
    .option('--include-metadata', 'include export metadata and statistics', true)
    .option(
      '--sort <field>',
      'sort by field (created, updated, priority, status, title)',
      'updated'
    )
    .option('--order <direction>', 'sort order (asc, desc)', 'desc')
    .option('--limit <count>', 'limit number of results exported')
    .option('--interactive', 'interactive export configuration mode')
    .option('--preview', 'preview export without saving to file')
    .option('--compress', 'compress output for large exports')
    .option('--template <name>', 'use export template (summary, detailed, minimal)')
    .addHelpText(
      'after',
      `
Examples:
  $ aitrackdown export
  $ aitrackdown export --format csv --output project-data.csv
  $ aitrackdown export --filter "status=todo,priority=high" --format json
  $ aitrackdown export --assignee john.doe --created-after 2024-01-01
  $ aitrackdown export --tags backend,security --format yaml
  $ aitrackdown export --interactive
  $ aitrackdown export --preview --format table
  $ aitrackdown export --template summary --format md

Export Formats:
  json          - Structured JSON with metadata
  yaml          - YAML format for configuration management
  csv           - Spreadsheet-compatible format
  md            - Markdown format for documentation
  table         - Human-readable table format

Filter Expressions:
  status=todo,blocked        - Multiple status values
  priority=high              - Single priority
  assignee=john.doe          - Specific assignee
  tags=backend,api           - Items with any of these tags
  estimate=5-13              - Story points range

Export Templates:
  summary       - Basic information only
  detailed      - Full item details with descriptions
  minimal       - ID, title, status only
`
    )
    .action(
      async (options?: {
        format?: string;
        output?: string;
        filter?: string;
        status?: string;
        priority?: string;
        assignee?: string;
        tags?: string;
        labels?: string;
        id?: string;
        createdAfter?: string;
        createdBefore?: string;
        updatedAfter?: string;
        updatedBefore?: string;
        estimateMin?: string;
        estimateMax?: string;
        includeCompleted?: boolean;
        includeDescriptions?: boolean;
        includeMetadata?: boolean;
        sort?: string;
        order?: string;
        limit?: string;
        interactive?: boolean;
        preview?: boolean;
        compress?: boolean;
        template?: string;
      }) => {
        try {
          // Handle interactive mode first
          let currentOptions = options;
          if (options?.interactive) {
            currentOptions = await runInteractiveExportMode(options);
          }

          // Get CLI root directory option
          const parentCommand = command.parent;
          const rootDirOption = parentCommand?.opts()?.rootDir || parentCommand?.opts()?.tasksDir;

          const configManager = new ConfigManager();
          const config = configManager.getConfig();

          // Initialize path resolver with CLI override
          const pathResolver = new PathResolver(configManager, rootDirOption);

          const trackdownDir = join(process.cwd(), pathResolver.getRootDirectory());

          if (!existsSync(trackdownDir)) {
            // Check for migration scenario
            if (pathResolver.shouldMigrate()) {
              pathResolver.showMigrationWarning();
              console.log('\nMigration commands:');
              pathResolver.getMigrationCommands().forEach((cmd) => {
                console.log(Formatter.highlight(cmd));
              });
              process.exit(1);
            }

            console.error(
              Formatter.error(
                `No ${pathResolver.getRootDirectory()} project found in current directory`
              )
            );
            console.log(Formatter.info('Run "aitrackdown init" to initialize a new project'));
            process.exit(1);
          }

          // Validate and process options with professional UX
          const exportConfig = await validateAndProcessExportOptions(currentOptions, config);

          console.log(Formatter.header('🚀 Starting Export Process'));

          const spinner = ora('Collecting trackdown items...').start();

          try {
            // Collect all items
            const items = collectItems(trackdownDir, exportConfig.includeCompleted, pathResolver);
            spinner.text = `Processing ${items.length} items...`;

            // Parse and apply filters
            const filters = parseAdvancedFilters(exportConfig);
            const filteredItems = applyAdvancedFilters(items, filters);

            if (filteredItems.length === 0) {
              spinner.fail('No items match the specified filters');
              console.log(
                Formatter.info('Try adjusting your filter criteria or use --interactive mode')
              );
              return;
            }

            // Sort items
            const sortedItems = sortItems(filteredItems, exportConfig.sort, exportConfig.order);

            // Apply limit if specified
            const finalItems = exportConfig.limit
              ? sortedItems.slice(0, parseInt(exportConfig.limit))
              : sortedItems;

            spinner.succeed(`Prepared ${finalItems.length} items for export`);

            // Preview mode - display without saving
            if (exportConfig.preview) {
              console.log(Formatter.header('📋 Export Preview'));
              await displayExportPreview(finalItems, exportConfig);
              return;
            }

            // Generate export data
            const progressSpinner = ora('Generating export data...').start();
            const exportedData = await generateAdvancedExportData(
              finalItems,
              exportConfig,
              config.projectName
            );

            // Handle output
            if (exportConfig.output) {
              const outputPath = resolveOutputPath(exportConfig.output, trackdownDir, pathResolver);
              ensureDirectoryExists(outputPath);

              progressSpinner.text = 'Writing export file...';
              writeFileSync(outputPath, exportedData);
              progressSpinner.succeed(`Export saved to ${outputPath}`);

              // Display comprehensive export summary
              displayExportSummary(finalItems, exportConfig, outputPath);
            } else {
              progressSpinner.succeed('Export data generated');
              console.log(exportedData);
            }
          } catch (processingError) {
            spinner.fail('Export processing failed');
            throw processingError;
          }
        } catch (error) {
          console.error(
            Formatter.error(
              `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          );

          if (error instanceof ValidationError) {
            console.log(
              Formatter.info('Use --help for usage information or --interactive for guided setup')
            );
          }

          process.exit(1);
        }
      }
    );

  return command;
}

// ===== ENHANCED PHASE 2 FUNCTIONS =====

async function runInteractiveExportMode(currentOptions: any): Promise<any> {
  console.log(Formatter.header('📤 Interactive Export Configuration'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'format',
      message: 'Select export format:',
      choices: [
        { name: 'JSON - Structured data with metadata', value: 'json' },
        { name: 'CSV - Spreadsheet compatible', value: 'csv' },
        { name: 'YAML - Configuration friendly', value: 'yaml' },
        { name: 'Markdown - Documentation format', value: 'md' },
        { name: 'Table - Human readable', value: 'table' },
      ],
      default: currentOptions?.format || 'json',
    },
    {
      type: 'input',
      name: 'output',
      message: 'Output file path (leave empty for auto-generated):',
      default: currentOptions?.output || '',
    },
    {
      type: 'list',
      name: 'template',
      message: 'Choose export template:',
      choices: [
        { name: 'Detailed - Full information with descriptions', value: 'detailed' },
        { name: 'Summary - Essential information only', value: 'summary' },
        { name: 'Minimal - ID, title, status only', value: 'minimal' },
      ],
      default: currentOptions?.template || 'detailed',
    },
    {
      type: 'checkbox',
      name: 'statusFilter',
      message: 'Filter by status (select multiple):',
      choices: [
        { name: 'Todo', value: 'todo' },
        { name: 'In Progress', value: 'in-progress' },
        { name: 'Blocked', value: 'blocked' },
        { name: 'Done', value: 'done' },
      ],
      default: currentOptions?.status ? [currentOptions.status] : [],
    },
    {
      type: 'checkbox',
      name: 'priorityFilter',
      message: 'Filter by priority (select multiple):',
      choices: [
        { name: 'Critical', value: 'critical' },
        { name: 'High', value: 'high' },
        { name: 'Medium', value: 'medium' },
        { name: 'Low', value: 'low' },
      ],
      default: currentOptions?.priority ? [currentOptions.priority] : [],
    },
    {
      type: 'input',
      name: 'assignee',
      message: 'Filter by assignee (leave empty for all):',
      default: currentOptions?.assignee || '',
    },
    {
      type: 'input',
      name: 'tags',
      message: 'Filter by tags (comma-separated):',
      default: currentOptions?.tags || '',
    },
    {
      type: 'input',
      name: 'limit',
      message: 'Limit number of items (leave empty for all):',
      default: currentOptions?.limit || '',
    },
    {
      type: 'list',
      name: 'sort',
      message: 'Sort by:',
      choices: [
        { name: 'Last Updated', value: 'updated' },
        { name: 'Created Date', value: 'created' },
        { name: 'Priority', value: 'priority' },
        { name: 'Status', value: 'status' },
        { name: 'Title', value: 'title' },
      ],
      default: currentOptions?.sort || 'updated',
    },
    {
      type: 'list',
      name: 'order',
      message: 'Sort order:',
      choices: [
        { name: 'Descending (newest first)', value: 'desc' },
        { name: 'Ascending (oldest first)', value: 'asc' },
      ],
      default: currentOptions?.order || 'desc',
    },
    {
      type: 'confirm',
      name: 'includeCompleted',
      message: 'Include completed items?',
      default: currentOptions?.includeCompleted || false,
    },
    {
      type: 'confirm',
      name: 'includeDescriptions',
      message: 'Include item descriptions?',
      default: currentOptions?.includeDescriptions !== false,
    },
    {
      type: 'confirm',
      name: 'includeMetadata',
      message: 'Include export metadata and statistics?',
      default: currentOptions?.includeMetadata !== false,
    },
    {
      type: 'confirm',
      name: 'preview',
      message: 'Preview export without saving?',
      default: currentOptions?.preview || false,
    },
  ]);

  // Process answers
  const processedOptions = {
    ...currentOptions,
    format: answers.format,
    output: answers.output || undefined,
    template: answers.template,
    status: answers.statusFilter.length > 0 ? answers.statusFilter.join(',') : undefined,
    priority: answers.priorityFilter.length > 0 ? answers.priorityFilter.join(',') : undefined,
    assignee: answers.assignee || undefined,
    tags: answers.tags || undefined,
    limit: answers.limit || undefined,
    sort: answers.sort,
    order: answers.order,
    includeCompleted: answers.includeCompleted,
    includeDescriptions: answers.includeDescriptions,
    includeMetadata: answers.includeMetadata,
    preview: answers.preview,
  };

  console.log(Formatter.success('Export configuration completed!'));
  return processedOptions;
}

async function validateAndProcessExportOptions(options: any, config: any): Promise<any> {
  const exportConfig = {
    format: options?.format || config.outputFormat || 'json',
    output: options?.output,
    includeCompleted: options?.includeCompleted || false,
    includeDescriptions: options?.includeDescriptions !== false,
    includeMetadata: options?.includeMetadata !== false,
    sort: options?.sort || 'updated',
    order: options?.order || 'desc',
    limit: options?.limit,
    template: options?.template || 'detailed',
    preview: options?.preview || false,
    compress: options?.compress || false,
    ...options,
  };

  // Validate format
  const supportedFormats = ['json', 'yaml', 'csv', 'md', 'table'];
  if (!supportedFormats.includes(exportConfig.format)) {
    throw new ValidationError(
      `Unsupported format: ${exportConfig.format}. Supported: ${supportedFormats.join(', ')}`
    );
  }

  // Validate template
  const supportedTemplates = ['summary', 'detailed', 'minimal'];
  if (exportConfig.template && !supportedTemplates.includes(exportConfig.template)) {
    throw new ValidationError(
      `Unsupported template: ${exportConfig.template}. Supported: ${supportedTemplates.join(', ')}`
    );
  }

  // Validate status if provided
  if (exportConfig.status) {
    const statuses = exportConfig.status.split(',').map((s: string) => s.trim());
    for (const status of statuses) {
      validateStatus(status);
    }
  }

  // Validate priority if provided
  if (exportConfig.priority) {
    const priorities = exportConfig.priority.split(',').map((p: string) => p.trim());
    for (const priority of priorities) {
      validatePriority(priority);
    }
  }

  // Validate assignee if provided
  if (exportConfig.assignee) {
    validateAssignee(exportConfig.assignee);
  }

  // Validate limit if provided
  if (exportConfig.limit) {
    const limit = parseInt(exportConfig.limit);
    if (Number.isNaN(limit) || limit <= 0) {
      throw new ValidationError('Limit must be a positive number');
    }
  }

  // Validate sort field
  const validSortFields = ['created', 'updated', 'priority', 'status', 'title'];
  if (!validSortFields.includes(exportConfig.sort)) {
    throw new ValidationError(
      `Invalid sort field: ${exportConfig.sort}. Valid: ${validSortFields.join(', ')}`
    );
  }

  // Validate sort order
  if (!['asc', 'desc'].includes(exportConfig.order)) {
    throw new ValidationError('Sort order must be "asc" or "desc"');
  }

  return exportConfig;
}

function parseAdvancedFilters(options: any): StatusFilter {
  const filters: StatusFilter = {};

  // Parse filter expression if provided
  if (options.filter) {
    const filterParts = options.filter.split(',');
    for (const part of filterParts) {
      const [key, value] = part.split('=');
      if (key && value) {
        const trimmedKey = key.trim();
        const trimmedValue = value.trim();

        switch (trimmedKey) {
          case 'status':
            filters.status = trimmedValue.split(',').map((s) => s.trim());
            break;
          case 'priority':
            filters.priority = trimmedValue.split(',').map((p) => p.trim());
            break;
          case 'assignee':
            filters.assignee = trimmedValue;
            break;
          case 'tags':
            filters.tags = trimmedValue.split(',').map((t) => t.trim());
            break;
          case 'estimate':
            if (trimmedValue.includes('-')) {
              const [min, max] = trimmedValue.split('-').map((n) => parseInt(n.trim()));
              filters.estimateMin = min;
              filters.estimateMax = max;
            } else {
              filters.estimate = parseInt(trimmedValue);
            }
            break;
        }
      }
    }
  }

  // Apply individual filter options
  if (options.status) {
    filters.status = options.status.split(',').map((s: string) => s.trim());
  }
  if (options.priority) {
    filters.priority = options.priority.split(',').map((p: string) => p.trim());
  }
  if (options.assignee) {
    filters.assignee = options.assignee;
  }
  if (options.tags || options.labels) {
    const tagsInput = options.tags || options.labels;
    filters.tags = tagsInput.split(',').map((t: string) => t.trim());
  }
  if (options.id) {
    filters.id = options.id;
  }
  if (options.createdAfter) {
    filters.createdAfter = new Date(options.createdAfter);
  }
  if (options.createdBefore) {
    filters.createdBefore = new Date(options.createdBefore);
  }
  if (options.updatedAfter) {
    filters.updatedAfter = new Date(options.updatedAfter);
  }
  if (options.updatedBefore) {
    filters.updatedBefore = new Date(options.updatedBefore);
  }
  if (options.estimateMin) {
    filters.estimateMin = parseInt(options.estimateMin);
  }
  if (options.estimateMax) {
    filters.estimateMax = parseInt(options.estimateMax);
  }

  return filters;
}

function applyAdvancedFilters(items: TrackdownItem[], filters: StatusFilter): TrackdownItem[] {
  return items.filter((item) => {
    // Status filter
    if (filters.status && !filters.status.includes(item.status)) {
      return false;
    }

    // Priority filter
    if (filters.priority && !filters.priority.includes(item.priority)) {
      return false;
    }

    // Assignee filter
    if (filters.assignee && item.assignee !== filters.assignee) {
      return false;
    }

    // ID filter
    if (filters.id && item.id !== filters.id) {
      return false;
    }

    // Tags filter (item must have at least one of the specified tags)
    if (filters.tags && filters.tags.length > 0) {
      if (!item.tags || !filters.tags.some((tag) => item.tags?.includes(tag))) {
        return false;
      }
    }

    // Date filters
    if (filters.createdAfter && item.createdAt < filters.createdAfter) {
      return false;
    }
    if (filters.createdBefore && item.createdAt > filters.createdBefore) {
      return false;
    }
    if (filters.updatedAfter && item.updatedAt < filters.updatedAfter) {
      return false;
    }
    if (filters.updatedBefore && item.updatedAt > filters.updatedBefore) {
      return false;
    }

    // Story point filters
    if (filters.estimate && item.estimate !== filters.estimate) {
      return false;
    }
    if (filters.estimateMin && (!item.estimate || item.estimate < filters.estimateMin)) {
      return false;
    }
    if (filters.estimateMax && (!item.estimate || item.estimate > filters.estimateMax)) {
      return false;
    }

    return true;
  });
}

function sortItems(items: TrackdownItem[], sortField: string, order: string): TrackdownItem[] {
  const sortedItems = [...items];

  sortedItems.sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'created':
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
        break;
      case 'updated':
        comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
        break;
      case 'priority': {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        comparison =
          (priorityOrder[a.priority as keyof typeof priorityOrder] || 0) -
          (priorityOrder[b.priority as keyof typeof priorityOrder] || 0);
        break;
      }
      case 'status': {
        const statusOrder = { todo: 1, 'in-progress': 2, blocked: 3, done: 4 };
        comparison =
          (statusOrder[a.status as keyof typeof statusOrder] || 0) -
          (statusOrder[b.status as keyof typeof statusOrder] || 0);
        break;
      }
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      default:
        comparison = 0;
    }

    return order === 'desc' ? -comparison : comparison;
  });

  return sortedItems;
}

async function displayExportPreview(items: TrackdownItem[], config: any): Promise<void> {
  console.log(
    Formatter.subheader(`Preview: ${items.length} items in ${config.format.toUpperCase()} format`)
  );

  if (config.format === 'table' || items.length <= 10) {
    // Show full preview for table format or small datasets
    const previewData = await generateAdvancedExportData(items, config, 'preview-project');
    console.log(previewData);
  } else {
    // Show sample for large datasets
    const sampleItems = items.slice(0, 3);
    console.log(Formatter.info(`Showing first 3 items (${items.length} total):`));
    const sampleData = await generateAdvancedExportData(sampleItems, config, 'preview-project');
    console.log(sampleData);
    console.log(Formatter.dim('... (additional items truncated for preview)'));
  }

  console.log(Formatter.info(`Full export would contain ${items.length} items`));
}

function resolveOutputPath(
  outputPath: string,
  _trackdownDir: string,
  pathResolver: PathResolver
): string {
  if (outputPath.startsWith('/') || outputPath.includes(':')) {
    // Absolute path
    return outputPath;
  } else {
    // Relative path - resolve from exports directory
    return join(process.cwd(), pathResolver.getExportsDir(), outputPath);
  }
}

function ensureDirectoryExists(filePath: string): void {
  const dir = join(filePath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function displayExportSummary(items: TrackdownItem[], config: any, outputPath: string): void {
  console.log('');
  console.log(Formatter.header('📊 Export Summary'));

  // Basic stats
  console.log(Formatter.success(`✅ Successfully exported ${items.length} items`));
  console.log(Formatter.info(`📁 Output: ${outputPath}`));
  console.log(Formatter.info(`📋 Format: ${config.format.toUpperCase()}`));
  console.log(Formatter.info(`📝 Template: ${config.template}`));

  // Status breakdown
  const statusCounts = items.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('');
  console.log(Formatter.subheader('Status Breakdown:'));
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  // Priority breakdown
  const priorityCounts = items.reduce(
    (acc, item) => {
      acc[item.priority] = (acc[item.priority] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log('');
  console.log(Formatter.subheader('Priority Breakdown:'));
  Object.entries(priorityCounts).forEach(([priority, count]) => {
    console.log(`  ${priority}: ${count}`);
  });

  // File size info
  try {
    const stats = statSync(outputPath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    console.log('');
    console.log(Formatter.info(`📊 File size: ${fileSizeKB} KB`));
  } catch {
    // Ignore file size errors
  }
}

async function generateAdvancedExportData(
  items: TrackdownItem[],
  config: any,
  projectName?: string
): Promise<string> {
  const metadata = {
    project: projectName || 'trackdown-project',
    exportedAt: new Date().toISOString(),
    itemCount: items.length,
    format: config.format,
    template: config.template,
    filters: getAppliedFiltersInfo(config),
    sorting: {
      field: config.sort,
      order: config.order,
    },
  };

  // Apply template filtering
  const processedItems = applyTemplate(items, config.template, config);

  switch (config.format) {
    case 'json':
      return generateJSONExport(processedItems, metadata, config);

    case 'yaml':
      return generateYAMLExport(processedItems, metadata, config);

    case 'csv':
      return generateCSVExport(processedItems, metadata, config);

    case 'md':
      return generateMarkdownExport(processedItems, metadata, config);

    case 'table':
      return generateTableExport(processedItems, metadata, config);

    default:
      throw new Error(`Unsupported format: ${config.format}`);
  }
}

function applyTemplate(items: TrackdownItem[], template: string, config: any): any[] {
  switch (template) {
    case 'minimal':
      return items.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
      }));

    case 'summary':
      return items.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        priority: item.priority,
        assignee: item.assignee,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        tags: item.tags,
      }));
    default:
      return items.map((item) => ({
        ...item,
        description: config.includeDescriptions ? item.description : undefined,
      }));
  }
}

function generateJSONExport(items: any[], metadata: any, config: any): string {
  const exportData = {
    ...(config.includeMetadata ? { metadata } : {}),
    items,
  };

  return JSON.stringify(exportData, null, 2);
}

function generateYAMLExport(items: any[], metadata: any, config: any): string {
  const lines: string[] = [];

  if (config.includeMetadata) {
    lines.push('metadata:');
    lines.push(`  project: "${metadata.project}"`);
    lines.push(`  exportedAt: "${metadata.exportedAt}"`);
    lines.push(`  itemCount: ${metadata.itemCount}`);
    lines.push(`  format: "${metadata.format}"`);
    lines.push(`  template: "${metadata.template}"`);
    lines.push('');
  }

  lines.push('items:');

  for (const item of items) {
    lines.push(`  - id: "${item.id}"`);
    lines.push(`    title: "${item.title}"`);
    lines.push(`    status: "${item.status}"`);

    if (item.priority) lines.push(`    priority: "${item.priority}"`);
    if (item.assignee) lines.push(`    assignee: "${item.assignee}"`);
    if (item.description) lines.push(`    description: "${item.description.replace(/"/g, '\\"')}"`);
    if (item.estimate) lines.push(`    estimate: ${item.estimate}`);
    if (item.createdAt) lines.push(`    createdAt: "${item.createdAt.toISOString()}"`);
    if (item.updatedAt) lines.push(`    updatedAt: "${item.updatedAt.toISOString()}"`);
    if (item.tags && item.tags.length > 0) {
      lines.push(`    tags: [${item.tags.map((tag: string) => `"${tag}"`).join(', ')}]`);
    }
  }

  return lines.join('\n');
}

function generateCSVExport(items: any[], metadata: any, config: any): string {
  const headers = Object.keys(items[0] || {}).filter(
    (key) => (key !== 'createdAt' && key !== 'updatedAt') || config.template === 'detailed'
  );

  // Add date columns if detailed template
  if (config.template === 'detailed') {
    headers.push('createdAt', 'updatedAt');
  }

  const headerRow = headers.join(',');

  const dataRows = items.map((item) => {
    return headers
      .map((header) => {
        const value = item[header];
        if (value === undefined || value === null) return '';
        if (Array.isArray(value)) return `"${value.join(', ')}"`;
        if (typeof value === 'string' && value.includes(','))
          return `"${value.replace(/"/g, '""')}"`;
        if (value instanceof Date) return value.toISOString();
        return String(value);
      })
      .join(',');
  });

  const csvContent = [headerRow, ...dataRows].join('\n');

  if (config.includeMetadata) {
    const metadataLines = [
      `# Export Metadata`,
      `# Project: ${metadata.project}`,
      `# Exported: ${metadata.exportedAt}`,
      `# Items: ${metadata.itemCount}`,
      `# Template: ${metadata.template}`,
      `#`,
      csvContent,
    ];
    return metadataLines.join('\n');
  }

  return csvContent;
}

function generateMarkdownExport(items: any[], metadata: any, config: any): string {
  const lines: string[] = [];

  lines.push(`# ${metadata.project} Export`);
  lines.push('');

  if (config.includeMetadata) {
    lines.push(`**Exported**: ${metadata.exportedAt}`);
    lines.push(`**Items**: ${metadata.itemCount}`);
    lines.push(`**Format**: ${metadata.format}`);
    lines.push(`**Template**: ${metadata.template}`);
    lines.push('');
  }

  lines.push('## Items');
  lines.push('');

  for (const item of items) {
    lines.push(`### ${item.title}`);
    lines.push('');
    lines.push(`- **ID**: ${item.id}`);
    lines.push(`- **Status**: ${item.status}`);

    if (item.priority) lines.push(`- **Priority**: ${item.priority}`);
    if (item.assignee) lines.push(`- **Assignee**: ${item.assignee}`);
    if (item.estimate) lines.push(`- **Estimate**: ${item.estimate} story points`);
    if (item.createdAt) lines.push(`- **Created**: ${item.createdAt.toISOString().split('T')[0]}`);
    if (item.updatedAt) lines.push(`- **Updated**: ${item.updatedAt.toISOString().split('T')[0]}`);
    if (item.tags && item.tags.length > 0) {
      lines.push(`- **Tags**: ${item.tags.join(', ')}`);
    }

    lines.push('');

    if (item.description) {
      lines.push(item.description);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

function generateTableExport(items: any[], _metadata: any, _config: any): string {
  // Use the formatter's table functionality
  return Formatter.formatTable(items as TrackdownItem[]);
}

function getAppliedFiltersInfo(config: any): Record<string, any> {
  const filters: Record<string, any> = {};

  if (config.status) filters.status = config.status;
  if (config.priority) filters.priority = config.priority;
  if (config.assignee) filters.assignee = config.assignee;
  if (config.tags) filters.tags = config.tags;
  if (config.createdAfter) filters.createdAfter = config.createdAfter;
  if (config.createdBefore) filters.createdBefore = config.createdBefore;
  if (config.updatedAfter) filters.updatedAfter = config.updatedAfter;
  if (config.updatedBefore) filters.updatedBefore = config.updatedBefore;
  if (config.estimateMin) filters.estimateMin = config.estimateMin;
  if (config.estimateMax) filters.estimateMax = config.estimateMax;
  if (config.limit) filters.limit = config.limit;

  return filters;
}

// Keep the enhanced collectItems and parseTrackdownFile functions from the original
function collectItems(
  _trackdownDir: string,
  includeCompleted: boolean,
  pathResolver: PathResolver
): TrackdownItem[] {
  const items: TrackdownItem[] = [];
  const directories = [pathResolver.getActiveDir()];

  if (includeCompleted) {
    directories.push(pathResolver.getCompletedDir());
  }

  for (const dir of directories) {
    const fullPath = join(process.cwd(), dir);
    if (existsSync(fullPath)) {
      const files = readdirSync(fullPath).filter((file) => file.endsWith('.md'));

      for (const file of files) {
        try {
          const item = parseTrackdownFile(join(fullPath, file));
          if (item) {
            items.push(item);
          }
        } catch (_error) {
          console.warn(Formatter.warning(`Could not parse file: ${file}`));
        }
      }
    }
  }

  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function parseTrackdownFile(filePath: string): TrackdownItem | null {
  try {
    const content = readFileSync(filePath, 'utf-8');

    // Extract metadata from markdown
    const titleMatch = content.match(/^# (.+)$/m);
    const idMatch = content.match(/\*\*ID\*\*:\s*(.+)$/m);
    const statusMatch = content.match(/\*\*Status\*\*:\s*(.+)$/m);
    const priorityMatch = content.match(/\*\*Priority\*\*:\s*(.+)$/m);
    const assigneeMatch = content.match(/\*\*Assignee\*\*:\s*(.+)$/m);
    const createdMatch = content.match(/\*\*Created\*\*:\s*(.+)$/m);
    const updatedMatch = content.match(/\*\*Updated\*\*:\s*(.+)$/m);
    const tagsMatch = content.match(/\*\*Tags\*\*:\s*(.+)$/m);
    const estimateMatch = content.match(/\*\*Estimate\*\*:\s*(.+)$/m);

    if (!titleMatch || !idMatch) {
      return null;
    }

    // Extract description
    const descriptionMatch = content.match(/## Description\n\n(.*?)(\n\n##|\n\n---|\n\n$)/s);

    // Parse tags
    const tags = tagsMatch
      ? tagsMatch[1]
          .split(',')
          .map((tag) => tag.trim().replace(/`/g, ''))
          .filter(Boolean)
      : undefined;

    return {
      id: idMatch[1].trim(),
      title: titleMatch[1].trim(),
      description: descriptionMatch ? descriptionMatch[1].trim() : undefined,
      status: (statusMatch?.[1]?.trim() || 'todo') as 'todo' | 'in-progress' | 'done' | 'blocked',
      priority: (priorityMatch?.[1]?.trim() || 'medium') as 'low' | 'medium' | 'high' | 'critical',
      assignee:
        assigneeMatch?.[1]?.trim() !== 'Unassigned' ? assigneeMatch?.[1]?.trim() : undefined,
      createdAt: createdMatch ? new Date(createdMatch[1].trim()) : new Date(),
      updatedAt: updatedMatch ? new Date(updatedMatch[1].trim()) : new Date(),
      estimate: estimateMatch ? parseInt(estimateMatch[1].trim()) : undefined,
      tags,
    };
  } catch (_error) {
    return null;
  }
}
