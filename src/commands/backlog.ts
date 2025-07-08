/**
 * Backlog Command
 * Provides comprehensive backlog reading functionality
 */

import { Command } from 'commander';
import { ConfigManager } from '../utils/config-manager.js';
import { FrontmatterParser } from '../utils/frontmatter-parser.js';
import { Formatter } from '../utils/formatter.js';
import type { EpicData, IssueData, TaskData, AnyItemData } from '../types/ai-trackdown.js';

interface BacklogOptions {
  epic?: string;
  status?: string;
  format?: 'table' | 'json' | 'markdown';
  full?: boolean;
  withIssues?: boolean;
  withTasks?: boolean;
}

export function createBacklogCommand(): Command {
  const cmd = new Command('backlog');
  
  cmd
    .description('Show comprehensive project backlog')
    .option('--epic <epic-id>', 'filter by specific epic')
    .option('--status <status>', 'filter by status (planning, active, completed, archived)')
    .option('--format <format>', 'output format (table, json, markdown)', 'table')
    .option('--full', 'show full backlog with all details')
    .option('--with-issues', 'include issues in epic display')
    .option('--with-tasks', 'include tasks in issue display')
    .action(async (options: BacklogOptions) => {
      try {
        await showBacklog(options);
      } catch (error) {
        console.error(Formatter.error(`Failed to show backlog: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}

async function showBacklog(options: BacklogOptions): Promise<void> {
  const configManager = new ConfigManager();
  const parser = new FrontmatterParser();
  
  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR;
  
  // Get absolute paths with CLI override
  const paths = configManager.getAbsolutePaths(cliTasksDir);
  
  console.log(Formatter.info('📋 Project Backlog'));
  console.log('='.repeat(50));
  
  try {
    // Parse all epics
    const epics = parser.parseDirectory(paths.epicsDir, 'epic') as EpicData[];
    
    if (epics.length === 0) {
      console.log(Formatter.warning('No epics found in project'));
      return;
    }
    
    // Filter epics by options
    let filteredEpics = epics;
    
    if (options.epic) {
      filteredEpics = epics.filter(epic => epic.epic_id === options.epic);
    }
    
    if (options.status) {
      filteredEpics = epics.filter(epic => epic.status === options.status);
    }
    
    if (options.format === 'json') {
      console.log(JSON.stringify(filteredEpics, null, 2));
      return;
    }
    
    // Display epics
    for (const epic of filteredEpics) {
      await displayEpic(epic, parser, paths, options);
    }
    
    // Summary
    console.log('');
    console.log(Formatter.info(`📊 Summary: ${filteredEpics.length} epic(s)`));
    console.log(Formatter.success('✅ Backlog display complete'));
    
  } catch (error) {
    console.error(Formatter.error(`Error reading backlog: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }
}

async function displayEpic(
  epic: EpicData, 
  parser: FrontmatterParser, 
  paths: any, 
  options: BacklogOptions
): Promise<void> {
  console.log('');
  console.log(Formatter.success(`🎯 ${epic.epic_id}: ${epic.title}`));
  console.log(Formatter.info(`   Status: ${epic.status} | Priority: ${epic.priority} | Assignee: ${epic.assignee}`));
  console.log(Formatter.debug(`   Created: ${epic.created_date} | Updated: ${epic.updated_date}`));
  
  if (epic.description && options.full) {
    console.log(Formatter.debug(`   Description: ${epic.description}`));
  }
  
  if (epic.tags && epic.tags.length > 0) {
    console.log(Formatter.debug(`   Tags: ${epic.tags.join(', ')}`));
  }
  
  // Show issues if requested
  if (options.withIssues) {
    try {
      const allIssues = parser.parseDirectory(paths.issuesDir, 'issue') as IssueData[];
      const epicIssues = allIssues.filter(issue => issue.epic_id === epic.epic_id);
      
      if (epicIssues.length > 0) {
        console.log(Formatter.info(`   📋 Issues (${epicIssues.length}):`));
        for (const issue of epicIssues) {
          console.log(Formatter.debug(`     • ${issue.issue_id}: ${issue.title} [${issue.status}]`));
          
          // Show tasks if requested
          if (options.withTasks) {
            try {
              const allTasks = parser.parseDirectory(paths.tasksDir, 'task') as TaskData[];
              const issueTasks = allTasks.filter(task => task.issue_id === issue.issue_id);
              
              if (issueTasks.length > 0) {
                for (const task of issueTasks) {
                  console.log(Formatter.debug(`       - ${task.task_id}: ${task.title} [${task.status}]`));
                }
              }
            } catch (taskError) {
              console.log(Formatter.warning(`       Error reading tasks: ${taskError}`));
            }
          }
        }
      }
    } catch (issueError) {
      console.log(Formatter.warning(`   Error reading issues: ${issueError}`));
    }
  }
}