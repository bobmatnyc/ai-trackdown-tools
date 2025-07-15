/**
 * AI Track Tokens Command
 * Track and update token usage across items
 */

import { Command } from 'commander';
import type { AnyItemData } from '../../types/ai-trackdown.js';
import { isEpicData, isIssueData, isTaskData } from '../../types/ai-trackdown.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';

interface TrackOptions {
  itemId?: string;
  type?: 'epic' | 'issue' | 'task';
  estimated?: number;
  actual?: number;
  operation?: 'add' | 'set';
  report?: boolean;
  format?: 'table' | 'json' | 'summary';
}

interface TokenUpdates {
  updated_date: string;
  estimated_tokens?: number;
  actual_tokens?: number;
}

export function createAiTrackTokensCommand(): Command {
  const cmd = new Command('track-tokens');

  cmd
    .description('Track and update token usage across items')
    .option('-i, --item-id <id>', 'specific item ID to update')
    .option('-t, --type <type>', 'item type filter (epic|issue|task)')
    .option('-e, --estimated <number>', 'set estimated tokens')
    .option('-a, --actual <number>', 'set actual tokens')
    .option('-o, --operation <op>', 'operation (add|set)', 'set')
    .option('-r, --report', 'show token usage report')
    .option('-f, --format <type>', 'output format (table|json|summary)', 'table')
    .action(async (options: TrackOptions) => {
      try {
        await trackTokens(options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to track tokens: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function trackTokens(options: TrackOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();

  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR; // Set by parent command

  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);
  const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);
  const parser = new FrontmatterParser();

  // If just showing report
  if (options.report || (!options.itemId && !options.estimated && !options.actual)) {
    await showTokenReport(relationshipManager, options.format || 'table', options.type);
    return;
  }

  // If updating specific item
  if (options.itemId) {
    await updateItemTokens(relationshipManager, parser, options);
    return;
  }

  throw new Error('Must specify either --item-id for updates or --report for viewing usage');
}

async function updateItemTokens(
  relationshipManager: RelationshipManager,
  parser: FrontmatterParser,
  options: TrackOptions
): Promise<void> {
  // Find the item
  if (!options.itemId) {
    throw new Error('Item ID is required for token updates');
  }

  const searchResult = relationshipManager.search({ content_search: options.itemId });
  const item = searchResult.items.find((item) => {
    if (options.itemId?.startsWith('EP-') && isEpicData(item))
      return item.epic_id === options.itemId;
    if (options.itemId?.startsWith('ISS-') && isIssueData(item))
      return item.issue_id === options.itemId;
    if (options.itemId?.startsWith('TSK-') && isTaskData(item))
      return item.task_id === options.itemId;
    return false;
  });

  if (!item) {
    throw new Error(`Item not found: ${options.itemId}`);
  }

  // Prepare updates
  const updates: TokenUpdates = {
    updated_date: new Date().toISOString(),
  };

  if (options.estimated !== undefined) {
    if (options.operation === 'add') {
      updates.estimated_tokens = (item.estimated_tokens || 0) + options.estimated;
    } else {
      updates.estimated_tokens = options.estimated;
    }
  }

  if (options.actual !== undefined) {
    if (options.operation === 'add') {
      updates.actual_tokens = (item.actual_tokens || 0) + options.actual;
    } else {
      updates.actual_tokens = options.actual;
    }
  }

  // Update the item
  const updatedItem = parser.updateFile(item.file_path, updates);

  // Refresh cache
  relationshipManager.rebuildCache();

  console.log(Formatter.success(`Token usage updated successfully!`));
  console.log(Formatter.info(`Item: ${options.itemId} - ${item.title}`));
  console.log(
    Formatter.info(
      `Estimated Tokens: ${item.estimated_tokens || 0} → ${updatedItem.estimated_tokens || 0}`
    )
  );
  console.log(
    Formatter.info(`Actual Tokens: ${item.actual_tokens || 0} → ${updatedItem.actual_tokens || 0}`)
  );

  if (updatedItem.estimated_tokens > 0) {
    const efficiency = (updatedItem.actual_tokens || 0) / updatedItem.estimated_tokens;
    const efficiencyDisplay =
      efficiency <= 1
        ? Formatter.success(`${(efficiency * 100).toFixed(1)}%`)
        : Formatter.warning(`${(efficiency * 100).toFixed(1)}%`);
    console.log(Formatter.info(`Token Efficiency: ${efficiencyDisplay}`));
  }
}

async function showTokenReport(
  relationshipManager: RelationshipManager,
  format: string,
  typeFilter?: string
): Promise<void> {
  // Get all items
  const searchResult = relationshipManager.search({});
  let items = searchResult.items;

  // Apply type filter
  if (typeFilter) {
    items = items.filter((item) => {
      switch (typeFilter) {
        case 'epic':
          return isEpicData(item);
        case 'issue':
          return isIssueData(item);
        case 'task':
          return isTaskData(item);
        default:
          return true;
      }
    });
  }

  // Calculate totals
  const totalEstimated = items.reduce((sum, item) => sum + (item.estimated_tokens || 0), 0);
  const totalActual = items.reduce((sum, item) => sum + (item.actual_tokens || 0), 0);
  const overallEfficiency = totalEstimated > 0 ? (totalActual / totalEstimated) * 100 : 0;

  // Show report based on format
  switch (format) {
    case 'json': {
      const jsonReport = {
        summary: {
          total_items: items.length,
          total_estimated: totalEstimated,
          total_actual: totalActual,
          efficiency_percentage: overallEfficiency,
        },
        items: items.map((item) => ({
          id: getItemId(item),
          title: item.title,
          type: getItemType(item),
          status: item.status,
          estimated_tokens: item.estimated_tokens || 0,
          actual_tokens: item.actual_tokens || 0,
          efficiency:
            item.estimated_tokens > 0
              ? ((item.actual_tokens || 0) / item.estimated_tokens) * 100
              : 0,
        })),
      };
      console.log(JSON.stringify(jsonReport, null, 2));
      break;
    }

    case 'summary': {
      console.log(Formatter.success('Token Usage Summary'));
      console.log('');
      console.log(`Total Items: ${items.length}`);
      console.log(`Total Estimated Tokens: ${totalEstimated}`);
      console.log(`Total Actual Tokens: ${totalActual}`);
      console.log(`Overall Efficiency: ${overallEfficiency.toFixed(1)}%`);
      console.log('');

      // Group by type
      const byType = items.reduce(
        (acc, item) => {
          const type = getItemType(item);
          if (!acc[type]) acc[type] = [];
          acc[type].push(item);
          return acc;
        },
        {} as Record<string, AnyItemData[]>
      );

      for (const [type, typeItems] of Object.entries(byType)) {
        const typeEstimated = typeItems.reduce(
          (sum, item) => sum + (item.estimated_tokens || 0),
          0
        );
        const typeActual = typeItems.reduce((sum, item) => sum + (item.actual_tokens || 0), 0);
        const typeEfficiency = typeEstimated > 0 ? (typeActual / typeEstimated) * 100 : 0;

        console.log(`${type.charAt(0).toUpperCase() + type.slice(1)}s:`);
        console.log(`  Count: ${typeItems.length}`);
        console.log(`  Estimated: ${typeEstimated}`);
        console.log(`  Actual: ${typeActual}`);
        console.log(`  Efficiency: ${typeEfficiency.toFixed(1)}%`);
        console.log('');
      }
      break;
    }

    default: {
      // Table format
      console.log(Formatter.success('Token Usage Report'));
      console.log('');

      if (items.length === 0) {
        console.log(Formatter.info('No items found.'));
        return;
      }

      // Table headers
      const headers = ['ID', 'Title', 'Type', 'Status', 'Estimated', 'Actual', 'Efficiency'];
      const colWidths = [12, 40, 8, 10, 10, 10, 10];

      // Print header
      printTableRow(headers, colWidths, true);
      printSeparator(colWidths);

      // Print items
      for (const item of items) {
        const efficiency =
          item.estimated_tokens > 0
            ? `${(((item.actual_tokens || 0) / item.estimated_tokens) * 100).toFixed(1)}%`
            : 'N/A';

        const row = [
          getItemId(item),
          truncateText(item.title, 38),
          getItemType(item).toUpperCase(),
          item.status.toUpperCase(),
          (item.estimated_tokens || 0).toString(),
          (item.actual_tokens || 0).toString(),
          efficiency,
        ];

        printTableRow(row, colWidths, false);
      }

      // Print summary
      console.log('');
      console.log(Formatter.success('Summary:'));
      console.log(`Total Items: ${items.length}`);
      console.log(`Total Estimated: ${totalEstimated}`);
      console.log(`Total Actual: ${totalActual}`);
      console.log(`Overall Efficiency: ${overallEfficiency.toFixed(1)}%`);
    }
  }
}

function getItemId(item: AnyItemData): string {
  if (isEpicData(item)) return item.epic_id;
  if (isIssueData(item)) return item.issue_id;
  if (isTaskData(item)) return item.task_id;
  return 'UNKNOWN';
}

function getItemType(item: AnyItemData): string {
  if (isEpicData(item)) return 'epic';
  if (isIssueData(item)) return 'issue';
  if (isTaskData(item)) return 'task';
  return 'unknown';
}

function printTableRow(row: string[], widths: number[], isHeader: boolean): void {
  const paddedRow = row.map((cell, i) => cell.padEnd(widths[i]));
  const rowText = paddedRow.join(' | ');

  if (isHeader) {
    console.log(Formatter.info(rowText));
  } else {
    console.log(rowText);
  }
}

function printSeparator(widths: number[]): void {
  const separator = widths.map((width) => '-'.repeat(width)).join('-+-');
  console.log(separator);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}
