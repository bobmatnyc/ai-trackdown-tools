/**
 * Epic Show Command
 * Display detailed information about a specific epic
 */

import { Command } from 'commander';
import { ConfigManager } from '../../utils/config-manager.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';
import { FrontmatterParser } from '../../utils/frontmatter-parser.js';
import { Formatter } from '../../utils/formatter.js';

interface ShowOptions {
  format?: 'detailed' | 'json' | 'yaml';
  showIssues?: boolean;
  showTasks?: boolean;
  showContent?: boolean;
  showRelated?: boolean;
}

export function createEpicShowCommand(): Command {
  const cmd = new Command('show');
  
  cmd
    .description('Show detailed information about an epic')
    .argument('<epic-id>', 'epic ID to show')
    .option('-f, --format <type>', 'output format (detailed|json|yaml)', 'detailed')
    .option('--show-issues', 'show related issues')
    .option('--show-tasks', 'show all related tasks')
    .option('--show-content', 'show epic content/description')
    .option('--show-related', 'show related epics and dependencies')
    .action(async (epicId: string, options: ShowOptions) => {
      try {
        await showEpic(epicId, options);
      } catch (error) {
        console.error(Formatter.error(`Failed to show epic: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}

async function showEpic(epicId: string, options: ShowOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();
  const relationshipManager = new RelationshipManager(config);
  
  // Get epic hierarchy
  const hierarchy = relationshipManager.getEpicHierarchy(epicId);
  if (!hierarchy) {
    throw new Error(`Epic not found: ${epicId}`);
  }
  
  const { epic, issues, tasks } = hierarchy;
  
  // Output based on format
  switch (options.format) {
    case 'json':
      const jsonOutput = {
        epic,
        ...(options.showIssues && { issues }),
        ...(options.showTasks && { tasks })
      };
      console.log(JSON.stringify(jsonOutput, null, 2));
      break;
      
    case 'yaml':
      const YAML = await import('yaml');
      const yamlOutput = {
        epic,
        ...(options.showIssues && { issues }),
        ...(options.showTasks && { tasks })
      };
      console.log(YAML.stringify(yamlOutput));
      break;
      
    default:
      await displayEpicDetailed(epic, issues, tasks, options, relationshipManager);
  }
}

async function displayEpicDetailed(
  epic: any,
  issues: any[],
  tasks: any[],
  options: ShowOptions,
  relationshipManager: RelationshipManager
): Promise<void> {
  // Header
  console.log(Formatter.success(`\n=== EPIC: ${epic.title} ===`));
  console.log(Formatter.info(`ID: ${epic.epic_id}`));
  console.log('');
  
  // Basic Information
  console.log(Formatter.success('Basic Information:'));
  console.log(`  Title: ${epic.title}`);
  console.log(`  Status: ${getStatusDisplay(epic.status)}`);
  console.log(`  Priority: ${getPriorityDisplay(epic.priority)}`);
  console.log(`  Assignee: ${epic.assignee}`);
  
  if (epic.milestone) {
    console.log(`  Milestone: ${epic.milestone}`);
  }
  
  if (epic.tags && epic.tags.length > 0) {
    console.log(`  Tags: ${epic.tags.join(', ')}`);
  }
  
  if (epic.completion_percentage !== undefined) {
    console.log(`  Progress: ${epic.completion_percentage}%`);
  }
  
  console.log('');
  
  // Dates and Tracking
  console.log(Formatter.success('Tracking Information:'));
  console.log(`  Created: ${formatDateTime(epic.created_date)}`);
  console.log(`  Updated: ${formatDateTime(epic.updated_date)}`);
  console.log(`  Estimated Tokens: ${epic.estimated_tokens || 0}`);
  console.log(`  Actual Tokens: ${epic.actual_tokens || 0}`);
  
  if (epic.estimated_tokens > 0) {
    const efficiency = epic.actual_tokens / epic.estimated_tokens;
    console.log(`  Token Efficiency: ${(efficiency * 100).toFixed(1)}%`);
  }
  
  console.log(`  Sync Status: ${epic.sync_status || 'local'}`);
  console.log('');
  
  // Description
  if (epic.description) {
    console.log(Formatter.success('Description:'));
    console.log(`  ${epic.description}`);
    console.log('');
  }
  
  // Content
  if (options.showContent && epic.content) {
    console.log(Formatter.success('Content:'));
    console.log(epic.content);
    console.log('');
  }
  
  // AI Context
  if (epic.ai_context && epic.ai_context.length > 0) {
    console.log(Formatter.success('AI Context:'));
    for (const context of epic.ai_context) {
      console.log(`  • ${context}`);
    }
    console.log('');
  }
  
  // Dependencies
  if (epic.dependencies && epic.dependencies.length > 0) {
    console.log(Formatter.success('Dependencies:'));
    for (const dep of epic.dependencies) {
      console.log(`  • ${dep}`);
    }
    console.log('');
  }
  
  // Related Issues
  if (options.showIssues || issues.length > 0) {
    console.log(Formatter.success(`Related Issues (${issues.length}):`));
    if (issues.length === 0) {
      console.log(Formatter.debug('  No issues found'));
    } else {
      for (const issue of issues) {
        const statusIcon = getStatusIcon(issue.status);
        const priorityColor = getPriorityDisplay(issue.priority);
        console.log(`  ${statusIcon} ${issue.issue_id}: ${issue.title} [${priorityColor}]`);
      }
    }
    console.log('');
  }
  
  // Related Tasks
  if (options.showTasks || tasks.length > 0) {
    console.log(Formatter.success(`All Related Tasks (${tasks.length}):`));
    if (tasks.length === 0) {
      console.log(Formatter.debug('  No tasks found'));
    } else {
      // Group tasks by issue
      const tasksByIssue = tasks.reduce((acc, task) => {
        if (!acc[task.issue_id]) acc[task.issue_id] = [];
        acc[task.issue_id].push(task);
        return acc;
      }, {} as Record<string, any[]>);
      
      for (const [issueId, issueTasks] of Object.entries(tasksByIssue)) {
        const issue = issues.find(i => i.issue_id === issueId);
        console.log(`  ${issue ? issue.title : issueId}:`);
        for (const task of issueTasks) {
          const statusIcon = getStatusIcon(task.status);
          console.log(`    ${statusIcon} ${task.task_id}: ${task.title}`);
        }
      }
    }
    console.log('');
  }
  
  // Related Items (if requested)
  if (options.showRelated) {
    const related = relationshipManager.getRelatedItems(epic.epic_id);
    
    if (related.dependencies.length > 0) {
      console.log(Formatter.success('Dependencies:'));
      for (const dep of related.dependencies) {
        console.log(`  • ${getItemId(dep)}: ${dep.title}`);
      }
      console.log('');
    }
    
    if (related.dependents.length > 0) {
      console.log(Formatter.success('Dependents:'));
      for (const dep of related.dependents) {
        console.log(`  • ${getItemId(dep)}: ${dep.title}`);
      }
      console.log('');
    }
  }
  
  // File Information
  console.log(Formatter.success('File Information:'));
  console.log(`  Path: ${epic.file_path}`);
  console.log('');
  
  // Summary Statistics
  const completedIssues = issues.filter(i => i.status === 'completed').length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  
  console.log(Formatter.success('Summary:'));
  console.log(`  Issues: ${completedIssues}/${issues.length} completed`);
  console.log(`  Tasks: ${completedTasks}/${tasks.length} completed`);
  
  if (issues.length > 0) {
    const issueCompletionRate = (completedIssues / issues.length * 100).toFixed(1);
    console.log(`  Issue Completion: ${issueCompletionRate}%`);
  }
  
  if (tasks.length > 0) {
    const taskCompletionRate = (completedTasks / tasks.length * 100).toFixed(1);
    console.log(`  Task Completion: ${taskCompletionRate}%`);
  }
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

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    'planning': '⏳',
    'active': '🔄',
    'completed': '✅',
    'archived': '📦'
  };
  
  return icons[status] || '❓';
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

function getItemId(item: any): string {
  if (item.epic_id && !item.issue_id && !item.task_id) return item.epic_id;
  if (item.issue_id && !item.task_id) return item.issue_id;
  if (item.task_id) return item.task_id;
  return 'UNKNOWN';
}