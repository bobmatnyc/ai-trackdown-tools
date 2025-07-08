/**
 * AI Context Command
 * Manage AI context for items
 */

import { Command } from 'commander';
import { ConfigManager } from '../../utils/config-manager.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';
import { Formatter } from '../../utils/formatter.js';

interface ContextOptions {
  itemId?: string;
  add?: string;
  remove?: string;
  list?: boolean;
  clear?: boolean;
  template?: boolean;
  format?: 'table' | 'json' | 'list';
}

export function createAiContextCommand(): Command {
  const cmd = new Command('context');
  
  cmd
    .description('Manage AI context for items')
    .option('-i, --item-id <id>', 'specific item ID to manage')
    .option('--add <context>', 'add context entry (comma-separated for multiple)')
    .option('--remove <context>', 'remove context entry (comma-separated for multiple)')
    .option('-l, --list', 'list context for item or all items')
    .option('--clear', 'clear all context for item')
    .option('-t, --template', 'show available context templates')
    .option('-f, --format <type>', 'output format (table|json|list)', 'table')
    .action(async (options: ContextOptions) => {
      try {
        await manageContext(options);
      } catch (error) {
        console.error(Formatter.error(`Failed to manage context: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}

async function manageContext(options: ContextOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();

  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR; // Set by parent command

  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);  const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);
  const parser = new FrontmatterParser();
  
  // Show templates
  if (options.template) {
    await showContextTemplates(config);
    return;
  }
  
  // List context
  if (options.list || (!options.itemId && !options.add && !options.remove && !options.clear)) {
    await listContext(relationshipManager, options.itemId, options.format || 'table');
    return;
  }
  
  // Manage specific item context
  if (!options.itemId) {
    throw new Error('Item ID is required for context management operations');
  }
  
  await updateItemContext(relationshipManager, parser, options);
}

async function showContextTemplates(config: any): Promise<void> {
  console.log(Formatter.success('AI Context Templates'));
  console.log('');
  
  if (config.ai_context_templates && config.ai_context_templates.length > 0) {
    console.log(Formatter.info('Available templates:'));
    for (const template of config.ai_context_templates) {
      console.log(`  • ${template}`);
    }
  } else {
    console.log(Formatter.warning('No AI context templates configured.'));
    console.log('');
    console.log(Formatter.info('Common AI context patterns:'));
    console.log('  • context/requirements');
    console.log('  • context/constraints');
    console.log('  • context/assumptions');
    console.log('  • context/dependencies');
    console.log('  • context/user-story');
    console.log('  • context/technical-specs');
    console.log('  • context/acceptance-criteria');
  }
}

async function listContext(
  relationshipManager: RelationshipManager,
  itemId?: string,
  format: string = 'table'
): Promise<void> {
  if (itemId) {
    // Show context for specific item
    const searchResult = relationshipManager.search({ content_search: itemId });
    const item = searchResult.items.find(item => {
      if (itemId.startsWith('EP-') && 'epic_id' in item) return item.epic_id === itemId;
      if (itemId.startsWith('ISS-') && 'issue_id' in item) return item.issue_id === itemId;
      if (itemId.startsWith('TSK-') && 'task_id' in item) return item.task_id === itemId;
      return false;
    });
    
    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }
    
    console.log(Formatter.success(`AI Context for ${itemId}: ${item.title}`));
    console.log('');
    
    if (item.ai_context && item.ai_context.length > 0) {
      switch (format) {
        case 'json':
          console.log(JSON.stringify(item.ai_context, null, 2));
          break;
        case 'list':
          for (const context of item.ai_context) {
            console.log(context);
          }
          break;
        default:
          for (let i = 0; i < item.ai_context.length; i++) {
            console.log(`${i + 1}. ${item.ai_context[i]}`);
          }
      }
    } else {
      console.log(Formatter.info('No AI context configured for this item.'));
    }
  } else {
    // Show context for all items
    const searchResult = relationshipManager.search({});
    const itemsWithContext = searchResult.items.filter(item => 
      item.ai_context && item.ai_context.length > 0
    );
    
    console.log(Formatter.success(`AI Context Overview`));
    console.log('');
    
    if (itemsWithContext.length === 0) {
      console.log(Formatter.info('No items have AI context configured.'));
      return;
    }
    
    switch (format) {
      case 'json':
        const jsonData = itemsWithContext.map(item => ({
          id: getItemId(item),
          title: item.title,
          type: getItemType(item),
          ai_context: item.ai_context
        }));
        console.log(JSON.stringify(jsonData, null, 2));
        break;
        
      default:
        // Table format
        for (const item of itemsWithContext) {
          console.log(Formatter.info(`${getItemId(item)}: ${item.title}`));
          for (const context of item.ai_context) {
            console.log(`  • ${context}`);
          }
          console.log('');
        }
    }
    
    console.log(Formatter.success(`Total items with context: ${itemsWithContext.length}`));
  }
}

async function updateItemContext(
  relationshipManager: RelationshipManager,
  parser: FrontmatterParser,
  options: ContextOptions
): Promise<void> {
  // Find the item
  const searchResult = relationshipManager.search({ content_search: options.itemId! });
  const item = searchResult.items.find(item => {
    if (options.itemId!.startsWith('EP-') && 'epic_id' in item) return item.epic_id === options.itemId;
    if (options.itemId!.startsWith('ISS-') && 'issue_id' in item) return item.issue_id === options.itemId;
    if (options.itemId!.startsWith('TSK-') && 'task_id' in item) return item.task_id === options.itemId;
    return false;
  });
  
  if (!item) {
    throw new Error(`Item not found: ${options.itemId}`);
  }
  
  let currentContext = [...(item.ai_context || [])];
  let hasChanges = false;
  
  // Clear context
  if (options.clear) {
    currentContext = [];
    hasChanges = true;
  }
  
  // Add context
  if (options.add) {
    const toAdd = options.add.split(',').map(ctx => ctx.trim());
    for (const ctx of toAdd) {
      if (!currentContext.includes(ctx)) {
        currentContext.push(ctx);
        hasChanges = true;
      }
    }
  }
  
  // Remove context
  if (options.remove) {
    const toRemove = options.remove.split(',').map(ctx => ctx.trim());
    const originalLength = currentContext.length;
    currentContext = currentContext.filter(ctx => !toRemove.includes(ctx));
    hasChanges = originalLength !== currentContext.length;
  }
  
  if (!hasChanges) {
    console.log(Formatter.warning('No changes to make.'));
    return;
  }
  
  // Update the item
  const updates = {
    ai_context: currentContext.length > 0 ? currentContext : [],
    updated_date: new Date().toISOString()
  };
  
  const updatedItem = parser.updateFile(item.file_path, updates);
  
  // Refresh cache
  relationshipManager.rebuildCache();
  
  console.log(Formatter.success(`AI context updated successfully!`));
  console.log(Formatter.info(`Item: ${options.itemId} - ${item.title}`));
  console.log('');
  console.log(Formatter.success('Current AI context:'));
  
  if (updatedItem.ai_context && updatedItem.ai_context.length > 0) {
    for (let i = 0; i < updatedItem.ai_context.length; i++) {
      console.log(`${i + 1}. ${updatedItem.ai_context[i]}`);
    }
  } else {
    console.log(Formatter.info('(No AI context configured)'));
  }
}

function getItemId(item: any): string {
  if (item.epic_id && !item.issue_id && !item.task_id) return item.epic_id;
  if (item.issue_id && !item.task_id) return item.issue_id;
  if (item.task_id) return item.task_id;
  return 'UNKNOWN';
}

function getItemType(item: any): string {
  if (item.epic_id && !item.issue_id && !item.task_id) return 'epic';
  if (item.issue_id && !item.task_id) return 'issue';
  if (item.task_id) return 'task';
  return 'unknown';
}