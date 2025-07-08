/**
 * Enhanced Backlog Command with TrackdownIndexManager
 * High-performance backlog overview using the .ai-trackdown-index file system
 * 
 * Performance Benefits:
 * - Instant backlog generation from pre-indexed data
 * - Fast filtering and hierarchical navigation
 * - Real-time progress tracking with cached metrics
 */

import { Command } from 'commander';
import { ConfigManager } from '../utils/config-manager.js';
import { TrackdownIndexManager } from '../utils/trackdown-index-manager.js';
import { Formatter } from '../utils/formatter.js';
import type { ItemStatus, Priority } from '../types/ai-trackdown.js';

interface BacklogOptions {
  epic?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  detailed?: boolean;
  hierarchy?: boolean;
  progress?: boolean;
  export?: string;
  rebuildIndex?: boolean;
}

export function createBacklogEnhancedCommand(): Command {
  const command = new Command('backlog-enhanced');

  command
    .description('Display project backlog with hierarchical view using high-performance index')
    .option('-e, --epic <epic-id>', 'filter by specific epic')
    .option('-s, --status <status>', 'filter by status (planning|active|completed|archived)')
    .option('-p, --priority <priority>', 'filter by priority (low|medium|high|critical)')
    .option('-a, --assignee <name>', 'filter by assignee')
    .option('-d, --detailed', 'show detailed information for each item')
    .option('--hierarchy', 'show complete hierarchical structure')
    .option('--progress', 'show detailed progress metrics')
    .option('--export <file>', 'export backlog to JSON file')
    .option('--rebuild-index', 'force rebuild of index before displaying backlog')
    .addHelpText('after', `
Examples:
  $ aitrackdown backlog-enhanced
  $ aitrackdown backlog-enhanced --hierarchy --progress
  $ aitrackdown backlog-enhanced --epic EP-0001 --detailed
  $ aitrackdown backlog-enhanced --status active --priority high
  $ aitrackdown backlog-enhanced --export backlog.json

Performance Features:
  ⚡ Instant backlog generation from indexed data
  🔗 Pre-calculated hierarchical relationships
  📊 Real-time progress tracking
  🎯 Fast filtering across all dimensions
`)
    .action(async (options: BacklogOptions) => {
      try {
        await displayEnhancedBacklog(options);
      } catch (error) {
        console.error(Formatter.error(`Failed to display backlog: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return command;
}

async function displayEnhancedBacklog(options: BacklogOptions): Promise<void> {
  const startTime = Date.now();
  
  // Initialize configuration and index manager
  const configManager = new ConfigManager();
  const config = configManager.getConfig();
  
  // Get CLI tasks directory from parent command options
  const parentCommand = (process as any).command?.parent;
  const cliTasksDir = parentCommand?.opts()?.rootDir || parentCommand?.opts()?.tasksDir;
  
  const projectRoot = configManager.findProjectRoot();
  const indexManager = new TrackdownIndexManager(config, projectRoot, cliTasksDir);

  // Force rebuild index if requested
  if (options.rebuildIndex) {
    console.log(Formatter.info('🔄 Rebuilding index...'));
    await indexManager.rebuildIndex();
  }

  console.log(Formatter.header(`📋 ${config.name || 'AI-Trackdown'} Project Backlog (Enhanced)`));

  // Get all data from index
  const [epics, issues, tasks, prs] = await Promise.all([
    indexManager.getItemsByType('epic'),
    indexManager.getItemsByType('issue'),
    indexManager.getItemsByType('task'),
    indexManager.getItemsByType('pr')
  ]);

  // Apply filters
  const filteredData = applyBacklogFilters({epics, issues, tasks, prs}, options);

  // Show progress summary if requested
  if (options.progress) {
    displayProgressSummary(filteredData);
  }

  // Display backlog based on view mode
  if (options.hierarchy) {
    displayHierarchicalView(filteredData, options);
  } else {
    displayBacklogView(filteredData, options);
  }

  // Export if requested
  if (options.export) {
    await exportBacklog(filteredData, options.export);
  }

  // Show performance metrics
  const totalTime = Date.now() - startTime;
  console.log(Formatter.dim(`\n⚡ Generated in ${totalTime}ms using index system`));
}

function applyBacklogFilters(data: any, options: BacklogOptions): any {
  let { epics, issues, tasks, prs } = data;

  // Filter by epic if specified
  if (options.epic) {
    epics = epics.filter((epic: any) => epic.id === options.epic);
    issues = issues.filter((issue: any) => issue.epicId === options.epic);
    tasks = tasks.filter((task: any) => task.epicId === options.epic);
    prs = prs.filter((pr: any) => pr.epicId === options.epic);
  }

  // Filter by status
  if (options.status) {
    epics = epics.filter((epic: any) => epic.status === options.status);
    issues = issues.filter((issue: any) => issue.status === options.status);
    tasks = tasks.filter((task: any) => task.status === options.status);
    prs = prs.filter((pr: any) => pr.status === options.status);
  }

  // Filter by priority
  if (options.priority) {
    epics = epics.filter((epic: any) => epic.priority === options.priority);
    issues = issues.filter((issue: any) => issue.priority === options.priority);
    tasks = tasks.filter((task: any) => task.priority === options.priority);
    prs = prs.filter((pr: any) => pr.priority === options.priority);
  }

  // Filter by assignee
  if (options.assignee) {
    epics = epics.filter((epic: any) => epic.assignee === options.assignee);
    issues = issues.filter((issue: any) => issue.assignee === options.assignee);
    tasks = tasks.filter((task: any) => task.assignee === options.assignee);
    prs = prs.filter((pr: any) => pr.assignee === options.assignee);
  }

  return { epics, issues, tasks, prs };
}

function displayProgressSummary(data: any): void {
  const { epics, issues, tasks, prs } = data;
  const total = epics.length + issues.length + tasks.length + prs.length;

  if (total === 0) {
    console.log(Formatter.box('No items match the current filters', 'info'));
    return;
  }

  console.log(Formatter.subheader('📊 Progress Summary'));

  // Overall completion metrics
  const completedItems = [
    ...epics.filter((e: any) => e.status === 'completed'),
    ...issues.filter((i: any) => i.status === 'completed'),
    ...tasks.filter((t: any) => t.status === 'completed'),
    ...prs.filter((p: any) => p.status === 'completed')
  ].length;

  const completionRate = total > 0 ? Math.round((completedItems / total) * 100) : 0;

  console.log(Formatter.info(`Total Items: ${total}`));
  console.log(Formatter.info(`Completed: ${completedItems} (${completionRate}%)`));
  console.log(Formatter.info(`In Progress: ${[...epics, ...issues, ...tasks, ...prs].filter((item: any) => item.status === 'active').length}`));
  console.log(Formatter.info(`Planned: ${[...epics, ...issues, ...tasks, ...prs].filter((item: any) => item.status === 'planning').length}`));

  // Progress by type
  console.log(Formatter.subheader('\n📈 Progress by Type'));
  displayTypeProgress('Epics', epics);
  displayTypeProgress('Issues', issues);
  displayTypeProgress('Tasks', tasks);
  displayTypeProgress('PRs', prs);

  console.log('');
}

function displayTypeProgress(typeName: string, items: any[]): void {
  if (items.length === 0) return;

  const completed = items.filter(item => item.status === 'completed').length;
  const rate = Math.round((completed / items.length) * 100);
  const progressBar = createProgressBar(rate);

  console.log(Formatter.info(`${typeName}: ${completed}/${items.length} ${progressBar} ${rate}%`));
}

function createProgressBar(percentage: number, width: number = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
}

function displayHierarchicalView(data: any, options: BacklogOptions): void {
  const { epics, issues, tasks, prs } = data;

  console.log(Formatter.subheader('🌳 Hierarchical Backlog View'));

  if (epics.length === 0) {
    console.log(Formatter.box('No epics match the current filters', 'info'));
    return;
  }

  epics.forEach((epic: any) => {
    displayEpic(epic, options);

    // Get related issues for this epic
    const epicIssues = issues.filter((issue: any) => issue.epicId === epic.id);
    
    epicIssues.forEach((issue: any, issueIndex: number) => {
      const isLastIssue = issueIndex === epicIssues.length - 1;
      displayIssue(issue, isLastIssue, options);

      // Get related tasks for this issue
      const issueTasks = tasks.filter((task: any) => task.issueId === issue.id);
      const issuePRs = prs.filter((pr: any) => pr.issueId === issue.id);

      issueTasks.forEach((task: any, taskIndex: number) => {
        const isLastTask = taskIndex === issueTasks.length - 1 && issuePRs.length === 0;
        displayTask(task, isLastIssue, isLastTask, options);
      });

      issuePRs.forEach((pr: any, prIndex: number) => {
        const isLastPR = prIndex === issuePRs.length - 1;
        displayPR(pr, isLastIssue, isLastPR, options);
      });
    });

    console.log('');
  });
}

function displayBacklogView(data: any, options: BacklogOptions): void {
  const { epics, issues, tasks, prs } = data;

  console.log(Formatter.subheader('📋 Backlog Overview'));

  // Group all items by status
  const allItems = [...epics, ...issues, ...tasks, ...prs]
    .map(item => ({
      ...item,
      type: getItemType(item.id)
    }))
    .sort((a, b) => {
      // Sort by priority first, then by last modified
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder];
      if (priorityDiff !== 0) return priorityDiff;
      
      return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
    });

  if (allItems.length === 0) {
    console.log(Formatter.box('No items match the current filters', 'info'));
    return;
  }

  // Group by status
  const grouped = allItems.reduce((acc, item) => {
    if (!acc[item.status]) acc[item.status] = [];
    acc[item.status].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  // Display each status group
  for (const [status, statusItems] of Object.entries(grouped)) {
    if (statusItems.length > 0) {
      const statusEmoji = getStatusEmoji(status);
      console.log(Formatter.subheader(`${statusEmoji} ${status.toUpperCase()} (${statusItems.length})`));
      
      statusItems.forEach((item: any, index: number) => {
        displayBacklogItem(item, index, options);
      });
      console.log('');
    }
  }
}

function displayEpic(epic: any, options: BacklogOptions): void {
  const statusEmoji = getStatusEmoji(epic.status);
  const priorityColor = getPriorityColor(epic.priority);
  const completionInfo = epic.completion_percentage !== undefined 
    ? ` (${epic.completion_percentage}%)` 
    : '';

  console.log(`🎯 ${statusEmoji} ${priorityColor(epic.priority.toUpperCase())} ${Formatter.highlight(epic.title)}${completionInfo} ${Formatter.dim(`(${epic.id})`)}`);
  
  if (options.detailed) {
    console.log(`   Assignee: ${epic.assignee || 'unassigned'}`);
    if (epic.milestone) console.log(`   Milestone: ${epic.milestone}`);
    if (epic.tags?.length) console.log(`   Tags: ${epic.tags.join(', ')}`);
    console.log(`   Modified: ${new Date(epic.lastModified).toLocaleString()}`);
  }
}

function displayIssue(issue: any, isLast: boolean, options: BacklogOptions): void {
  const prefix = isLast ? '└── ' : '├── ';
  const statusEmoji = getStatusEmoji(issue.status);
  const priorityColor = getPriorityColor(issue.priority);

  console.log(`${prefix}📋 ${statusEmoji} ${priorityColor(issue.priority.toUpperCase())} ${issue.title} ${Formatter.dim(`(${issue.id})`)}`);
  
  if (options.detailed) {
    const indent = isLast ? '    ' : '│   ';
    console.log(`${indent}Assignee: ${issue.assignee || 'unassigned'}`);
    if (issue.tags?.length) console.log(`${indent}Tags: ${issue.tags.join(', ')}`);
    console.log(`${indent}Modified: ${new Date(issue.lastModified).toLocaleString()}`);
  }
}

function displayTask(task: any, issueIsLast: boolean, isLast: boolean, options: BacklogOptions): void {
  const issuePrefix = issueIsLast ? '    ' : '│   ';
  const taskPrefix = isLast ? '└── ' : '├── ';
  const statusEmoji = getStatusEmoji(task.status);
  const priorityColor = getPriorityColor(task.priority);

  console.log(`${issuePrefix}${taskPrefix}✅ ${statusEmoji} ${priorityColor(task.priority.toUpperCase())} ${task.title} ${Formatter.dim(`(${task.id})`)}`);
  
  if (options.detailed) {
    const indent = issuePrefix + (isLast ? '    ' : '│   ');
    console.log(`${indent}Assignee: ${task.assignee || 'unassigned'}`);
    if (task.time_estimate) console.log(`${indent}Estimate: ${task.time_estimate}`);
    if (task.tags?.length) console.log(`${indent}Tags: ${task.tags.join(', ')}`);
  }
}

function displayPR(pr: any, issueIsLast: boolean, isLast: boolean, options: BacklogOptions): void {
  const issuePrefix = issueIsLast ? '    ' : '│   ';
  const prPrefix = isLast ? '└── ' : '├── ';
  const statusEmoji = getStatusEmoji(pr.status);
  const priorityColor = getPriorityColor(pr.priority);

  console.log(`${issuePrefix}${prPrefix}🔄 ${statusEmoji} ${priorityColor(pr.priority.toUpperCase())} ${pr.title} ${Formatter.dim(`(${pr.id})`)}`);
  
  if (options.detailed) {
    const indent = issuePrefix + (isLast ? '    ' : '│   ');
    console.log(`${indent}PR Status: ${pr.pr_status}`);
    if (pr.branch_name) console.log(`${indent}Branch: ${pr.branch_name}`);
    if (pr.reviewers?.length) console.log(`${indent}Reviewers: ${pr.reviewers.join(', ')}`);
  }
}

function displayBacklogItem(item: any, index: number, options: BacklogOptions): void {
  const typeEmoji = getTypeEmoji(item.type);
  const statusEmoji = getStatusEmoji(item.status);
  const priorityColor = getPriorityColor(item.priority);
  const assigneeInfo = item.assignee ? ` @${item.assignee}` : '';
  const tagsInfo = item.tags?.length ? ` [${item.tags.join(', ')}]` : '';

  console.log(
    `  ${(index + 1).toString().padStart(3, ' ')}. ${typeEmoji} ${statusEmoji} ${priorityColor(item.priority.toUpperCase())} ${item.title}${assigneeInfo}${tagsInfo} ${Formatter.dim(`(${item.id})`)}`
  );

  if (options.detailed) {
    console.log(`      Modified: ${new Date(item.lastModified).toLocaleString()}`);
    if (item.type === 'epic' && item.completion_percentage !== undefined) {
      console.log(`      Completion: ${item.completion_percentage}%`);
    }
    if (item.type === 'pr' && item.pr_status) {
      console.log(`      PR Status: ${item.pr_status}`);
    }
  }
}

async function exportBacklog(data: any, filename: string): Promise<void> {
  const exportData = {
    exportTime: new Date().toISOString(),
    summary: {
      totalEpics: data.epics.length,
      totalIssues: data.issues.length,
      totalTasks: data.tasks.length,
      totalPRs: data.prs.length
    },
    data
  };

  const fs = await import('fs');
  fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
  console.log(Formatter.success(`Backlog exported to ${filename}`));
}

// Helper functions
function getItemType(id: string): string {
  if (id.startsWith('EP-')) return 'epic';
  if (id.startsWith('ISS-')) return 'issue';
  if (id.startsWith('TSK-')) return 'task';
  if (id.startsWith('PR-')) return 'pr';
  return 'unknown';
}

function getTypeEmoji(type: string): string {
  switch (type) {
    case 'epic': return '🎯';
    case 'issue': return '📋';
    case 'task': return '✅';
    case 'pr': return '🔄';
    default: return '📄';
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'planning': return '📝';
    case 'active': return '🔄';
    case 'completed': return '✅';
    case 'archived': return '📦';
    default: return '📄';
  }
}

function getPriorityColor(priority: string): (text: string) => string {
  switch (priority) {
    case 'low':
      return Formatter.dim;
    case 'medium':
      return (text: string) => text;
    case 'high':
      return Formatter.highlight;
    case 'critical':
      return Formatter.error;
    default:
      return (text: string) => text;
  }
}