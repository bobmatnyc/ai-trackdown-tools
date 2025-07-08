/**
 * Epic Update Command
 * Update epic fields using YAML frontmatter system
 */

import { Command } from 'commander';
import { ConfigManager } from '../../utils/config-manager.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';
import type { ItemStatus, Priority, EpicFrontmatter } from '../../types/ai-trackdown.js';
import { Formatter } from '../../utils/formatter.js';

interface UpdateOptions {
  title?: string;
  description?: string;
  status?: ItemStatus;
  priority?: Priority;
  assignee?: string;
  addTags?: string;
  removeTags?: string;
  milestone?: string;
  clearMilestone?: boolean;
  estimatedTokens?: number;
  actualTokens?: number;
  addDependencies?: string;
  removeDependencies?: string;
  progress?: number;
  dryRun?: boolean;
}

export function createEpicUpdateCommand(): Command {
  const cmd = new Command('update');
  
  cmd
    .description('Update an existing epic')
    .argument('<epic-id>', 'epic ID to update')
    .option('-t, --title <text>', 'update title')
    .option('-d, --description <text>', 'update description')
    .option('-s, --status <status>', 'update status (planning|active|completed|archived)')
    .option('-p, --priority <level>', 'update priority (low|medium|high|critical)')
    .option('-a, --assignee <username>', 'update assignee')
    .option('--add-tags <tags>', 'add tags (comma-separated)')
    .option('--remove-tags <tags>', 'remove tags (comma-separated)')
    .option('-m, --milestone <name>', 'set milestone')
    .option('--clear-milestone', 'clear milestone')
    .option('-e, --estimated-tokens <number>', 'update estimated tokens')
    .option('--actual-tokens <number>', 'update actual tokens')
    .option('--add-dependencies <ids>', 'add dependencies (comma-separated IDs)')
    .option('--remove-dependencies <ids>', 'remove dependencies (comma-separated IDs)')
    .option('--progress <percentage>', 'update completion percentage (0-100)')
    .option('--dry-run', 'show what would be updated without updating')
    .action(async (epicId: string, options: UpdateOptions) => {
      try {
        await updateEpic(epicId, options);
      } catch (error) {
        console.error(Formatter.error(`Failed to update epic: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}

async function updateEpic(epicId: string, options: UpdateOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();

  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR; // Set by parent command

  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);  const relationshipManager = new RelationshipManager(config, paths.projectRoot, cliTasksDir);
  const parser = new FrontmatterParser();
  
  // Get epic hierarchy to find the epic
  const hierarchy = relationshipManager.getEpicHierarchy(epicId);
  if (!hierarchy) {
    throw new Error(`Epic not found: ${epicId}`);
  }
  
  const epic = hierarchy.epic;
  const filePath = epic.file_path;
  
  // Build updates object
  const updates: Partial<EpicFrontmatter> = {};
  
  if (options.title) {
    updates.title = options.title;
  }
  
  if (options.description) {
    updates.description = options.description;
  }
  
  if (options.status) {
    updates.status = options.status;
  }
  
  if (options.priority) {
    updates.priority = options.priority;
  }
  
  if (options.assignee) {
    updates.assignee = options.assignee;
  }
  
  if (options.milestone) {
    updates.milestone = options.milestone;
  }
  
  if (options.clearMilestone) {
    updates.milestone = undefined;
  }
  
  if (options.estimatedTokens !== undefined) {
    updates.estimated_tokens = parseInt(options.estimatedTokens.toString(), 10);
  }
  
  if (options.actualTokens !== undefined) {
    updates.actual_tokens = parseInt(options.actualTokens.toString(), 10);
  }
  
  if (options.progress !== undefined) {
    const progress = parseInt(options.progress.toString(), 10);
    if (progress < 0 || progress > 100) {
      throw new Error('Progress must be between 0 and 100');
    }
    updates.completion_percentage = progress;
  }
  
  // Handle tags
  if (options.addTags || options.removeTags) {
    const currentTags = epic.tags || [];
    let newTags = [...currentTags];
    
    if (options.addTags) {
      const tagsToAdd = options.addTags.split(',').map(tag => tag.trim());
      for (const tag of tagsToAdd) {
        if (!newTags.includes(tag)) {
          newTags.push(tag);
        }
      }
    }
    
    if (options.removeTags) {
      const tagsToRemove = options.removeTags.split(',').map(tag => tag.trim());
      newTags = newTags.filter(tag => !tagsToRemove.includes(tag));
    }
    
    updates.tags = newTags.length > 0 ? newTags : undefined;
  }
  
  // Handle dependencies
  if (options.addDependencies || options.removeDependencies) {
    const currentDeps = epic.dependencies || [];
    let newDeps = [...currentDeps];
    
    if (options.addDependencies) {
      const depsToAdd = options.addDependencies.split(',').map(dep => dep.trim());
      for (const dep of depsToAdd) {
        if (!newDeps.includes(dep)) {
          newDeps.push(dep);
        }
      }
    }
    
    if (options.removeDependencies) {
      const depsToRemove = options.removeDependencies.split(',').map(dep => dep.trim());
      newDeps = newDeps.filter(dep => !depsToRemove.includes(dep));
    }
    
    updates.dependencies = newDeps.length > 0 ? newDeps : undefined;
  }
  
  // Show what would be updated (dry run or verbose)
  if (options.dryRun || Object.keys(updates).length === 0) {
    console.log(Formatter.info(`${options.dryRun ? 'Dry run - ' : ''}Epic would be updated:`));
    console.log(Formatter.debug(`Epic ID: ${epicId}`));
    console.log(Formatter.debug(`File: ${filePath}`));
    
    if (Object.keys(updates).length === 0) {
      console.log(Formatter.warning('No updates specified'));
      return;
    }
    
    for (const [key, value] of Object.entries(updates)) {
      const currentValue = epic[key as keyof typeof epic];
      console.log(Formatter.debug(`${key}: ${currentValue} → ${value}`));
    }
    
    if (options.dryRun) {
      return;
    }
  }
  
  // Update the file
  const updatedEpic = parser.updateFile(filePath, updates);
  
  // Refresh cache
  relationshipManager.rebuildCache();
  
  console.log(Formatter.success(`Epic updated successfully!`));
  console.log(Formatter.info(`Epic ID: ${epicId}`));
  console.log(Formatter.info(`File: ${filePath}`));
  
  // Show what was changed
  const changedFields = Object.keys(updates);
  if (changedFields.length > 0) {
    console.log(Formatter.info(`Updated fields: ${changedFields.join(', ')}`));
  }
  
  // Show current values
  console.log('');
  console.log(Formatter.success('Current values:'));
  console.log(`  Title: ${updatedEpic.title}`);
  console.log(`  Status: ${getStatusDisplay(updatedEpic.status)}`);
  console.log(`  Priority: ${getPriorityDisplay(updatedEpic.priority)}`);
  console.log(`  Assignee: ${updatedEpic.assignee}`);
  
  if (updatedEpic.milestone) {
    console.log(`  Milestone: ${updatedEpic.milestone}`);
  }
  
  if (updatedEpic.tags && updatedEpic.tags.length > 0) {
    console.log(`  Tags: ${updatedEpic.tags.join(', ')}`);
  }
  
  if (updatedEpic.completion_percentage !== undefined) {
    console.log(`  Progress: ${updatedEpic.completion_percentage}%`);
  }
  
  if (updatedEpic.dependencies && updatedEpic.dependencies.length > 0) {
    console.log(`  Dependencies: ${updatedEpic.dependencies.join(', ')}`);
  }
  
  console.log(`  Estimated Tokens: ${updatedEpic.estimated_tokens || 0}`);
  console.log(`  Actual Tokens: ${updatedEpic.actual_tokens || 0}`);
}

function getStatusDisplay(status: string): string {
  const statusColors: Record<string, (text: string) => string> = {
    'planning': (text) => Formatter.info(text),
    'active': (text) => Formatter.success(text),
    'completed': (text) => Formatter.success(text),
    'archived': (text) => Formatter.debug(text)
  };
  
  const colorFn = statusColors[status] || ((text) => text);
  return colorFn(status.toUpperCase());
}

function getPriorityDisplay(priority: string): string {
  const priorityColors: Record<string, (text: string) => string> = {
    'critical': (text) => Formatter.error(text),
    'high': (text) => Formatter.warning(text),
    'medium': (text) => Formatter.info(text),
    'low': (text) => Formatter.debug(text)
  };
  
  const colorFn = priorityColors[priority] || ((text) => text);
  return colorFn(priority.toUpperCase());
}