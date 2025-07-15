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
import { Formatter } from '../utils/formatter.js';
import { TrackdownIndexManager } from '../utils/trackdown-index-manager.js';
import type { AnyItemData, EpicData, IssueData, TaskData, PRData, ItemStatus, Priority } from '../types/ai-trackdown.js';

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

interface BacklogData {
  epics: EpicData[];
  issues: IssueData[];
  tasks: TaskData[];
  prs: PRData[];
}

interface BacklogItem extends AnyItemData {
  type: 'epic' | 'issue' | 'task' | 'pr';
  lastModified: string;
}

// Commander.js Command interface extension
interface CommandWithParent extends Command {
  parent?: CommandWithParent;
  opts(): { rootDir?: string; tasksDir?: string; [key: string]: unknown };
}

// Process interface extension for accessing command
interface ProcessWithCommand extends NodeJS.Process {
  command?: CommandWithParent;
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
    .addHelpText(
      'after',
      `
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
`
    )
    .action(async (options: BacklogOptions) => {
      try {
        await displayEnhancedBacklog(options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to display backlog: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
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
  const parentCommand = (process as ProcessWithCommand).command?.parent;
  const cliTasksDir = parentCommand?.opts()?.rootDir || parentCommand?.opts()?.tasksDir;

  const projectRoot = configManager.findProjectRoot();
  const indexManager = new TrackdownIndexManager(config, projectRoot, cliTasksDir);

  // Force rebuild index if requested
  if (options.rebuildIndex) {
    console.log(Formatter.info('🔄 Rebuilding index...'));
    await indexManager.rebuildIndex();
  }

  console.log(Formatter.header(`📋 ${config.name || 'AI-Trackdown'} Project Backlog (Enhanced)`));

  // Check index health and auto-repair if needed
  const healthCheck = await indexManager.validateIndexHealth();
  if (!healthCheck.isValid) {
    console.log(Formatter.warning('⚠️  Index health issues detected:'));
    for (const issue of healthCheck.issues) {
      console.log(Formatter.warning(`   • ${issue}`));
    }
    
    console.log(Formatter.info('🔧 Auto-repairing index...'));
    const repairResult = await indexManager.autoRepairIndex();
    
    if (repairResult.repaired) {
      console.log(Formatter.success('✅ Index repaired successfully'));
      for (const action of repairResult.actions) {
        console.log(Formatter.dim(`   • ${action}`));
      }
    } else {
      console.log(Formatter.warning('⚠️  Auto-repair failed, continuing with current index'));
      for (const error of repairResult.errors) {
        console.log(Formatter.warning(`   • ${error}`));
      }
    }
    console.log('');
  }

  // Get all data from index
  const [epics, issues, tasks, prs] = await Promise.all([
    indexManager.getItemsByType('epic'),
    indexManager.getItemsByType('issue'),
    indexManager.getItemsByType('task'),
    indexManager.getItemsByType('pr'),
  ]);

  // Apply filters
  const filteredData = applyBacklogFilters({ epics, issues, tasks, prs }, options);

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

function applyBacklogFilters(data: BacklogData, options: BacklogOptions): BacklogData {
  let { epics, issues, tasks, prs } = data;

  // Filter by epic if specified
  if (options.epic) {
    epics = epics.filter((epic: EpicData) => epic.epic_id === options.epic);
    issues = issues.filter((issue: IssueData) => issue.epic_id === options.epic);
    tasks = tasks.filter((task: TaskData) => task.epic_id === options.epic);
    prs = prs.filter((pr: PRData) => pr.epic_id === options.epic);
  }

  // Filter by status
  if (options.status) {
    epics = epics.filter((epic: EpicData) => epic.status === options.status);
    issues = issues.filter((issue: IssueData) => issue.status === options.status);
    tasks = tasks.filter((task: TaskData) => task.status === options.status);
    prs = prs.filter((pr: PRData) => pr.status === options.status);
  }

  // Filter by priority
  if (options.priority) {
    epics = epics.filter((epic: EpicData) => epic.priority === options.priority);
    issues = issues.filter((issue: IssueData) => issue.priority === options.priority);
    tasks = tasks.filter((task: TaskData) => task.priority === options.priority);
    prs = prs.filter((pr: PRData) => pr.priority === options.priority);
  }

  // Filter by assignee
  if (options.assignee) {
    epics = epics.filter((epic: EpicData) => epic.assignee === options.assignee);
    issues = issues.filter((issue: IssueData) => issue.assignee === options.assignee);
    tasks = tasks.filter((task: TaskData) => task.assignee === options.assignee);
    prs = prs.filter((pr: PRData) => pr.assignee === options.assignee);
  }

  return { epics, issues, tasks, prs };
}

function displayProgressSummary(data: BacklogData): void {
  const { epics, issues, tasks, prs } = data;
  const total = epics.length + issues.length + tasks.length + prs.length;

  if (total === 0) {
    console.log(Formatter.box('No items match the current filters', 'info'));
    return;
  }

  console.log(Formatter.subheader('📊 Progress Summary'));

  // Overall completion metrics
  const completedItems = [
    ...epics.filter((e: EpicData) => e.status === 'completed'),
    ...issues.filter((i: IssueData) => i.status === 'completed'),
    ...tasks.filter((t: TaskData) => t.status === 'completed'),
    ...prs.filter((p: PRData) => p.status === 'completed'),
  ].length;

  const completionRate = total > 0 ? Math.round((completedItems / total) * 100) : 0;

  console.log(Formatter.info(`Total Items: ${total}`));
  console.log(Formatter.info(`Completed: ${completedItems} (${completionRate}%)`));
  console.log(
    Formatter.info(
      `In Progress: ${[...epics, ...issues, ...tasks, ...prs].filter((item: AnyItemData) => item.status === 'active').length}`
    )
  );
  console.log(
    Formatter.info(
      `Planned: ${[...epics, ...issues, ...tasks, ...prs].filter((item: AnyItemData) => item.status === 'planning').length}`
    )
  );

  // Progress by type
  console.log(Formatter.subheader('\n📈 Progress by Type'));
  displayTypeProgress('Epics', epics);
  displayTypeProgress('Issues', issues);
  displayTypeProgress('Tasks', tasks);
  displayTypeProgress('PRs', prs);

  console.log('');
}

function displayTypeProgress(typeName: string, items: AnyItemData[]): void {
  if (items.length === 0) return;

  const completed = items.filter((item) => item.status === 'completed').length;
  const rate = Math.round((completed / items.length) * 100);
  const progressBar = createProgressBar(rate);

  console.log(Formatter.info(`${typeName}: ${completed}/${items.length} ${progressBar} ${rate}%`));
}

function createProgressBar(percentage: number, width: number = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
}

function displayHierarchicalView(data: BacklogData, options: BacklogOptions): void {
  const { epics, issues, tasks, prs } = data;

  console.log(Formatter.subheader('🌳 Hierarchical Backlog View'));

  if (epics.length === 0) {
    console.log(Formatter.box('No epics match the current filters', 'info'));
    return;
  }

  epics.forEach((epic: EpicData) => {
    displayEpic(epic, options);

    // Get related issues for this epic
    const epicIssues = issues.filter((issue: IssueData) => issue.epic_id === epic.epic_id);

    epicIssues.forEach((issue: IssueData, issueIndex: number) => {
      const isLastIssue = issueIndex === epicIssues.length - 1;
      displayIssue(issue, isLastIssue, options);

      // Get related tasks for this issue
      const issueTasks = tasks.filter((task: TaskData) => task.issue_id === issue.issue_id);
      const issuePRs = prs.filter((pr: PRData) => pr.issue_id === issue.issue_id);

      issueTasks.forEach((task: TaskData, taskIndex: number) => {
        const isLastTask = taskIndex === issueTasks.length - 1 && issuePRs.length === 0;
        displayTask(task, isLastIssue, isLastTask, options);
      });

      issuePRs.forEach((pr: PRData, prIndex: number) => {
        const isLastPR = prIndex === issuePRs.length - 1;
        displayPR(pr, isLastIssue, isLastPR, options);
      });
    });

    console.log('');
  });
}

function displayBacklogView(data: BacklogData, options: BacklogOptions): void {
  const { epics, issues, tasks, prs } = data;

  console.log(Formatter.subheader('📋 Backlog Overview'));

  // Group all items by status
  const allItems: BacklogItem[] = [...epics, ...issues, ...tasks, ...prs]
    .map((item: AnyItemData): BacklogItem => ({
      ...item,
      type: getItemType(getItemId(item)),
      lastModified: item.updated_date,
    } as BacklogItem))
    .sort((a: BacklogItem, b: BacklogItem) => {
      // Sort by priority first, then by last modified
      const priorityOrder: Record<Priority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff =
        priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
    });

  if (allItems.length === 0) {
    console.log(Formatter.box('No items match the current filters', 'info'));
    return;
  }

  // Group by status
  const grouped = allItems.reduce(
    (acc: Record<string, BacklogItem[]>, item: BacklogItem) => {
      if (!acc[item.status]) acc[item.status] = [];
      acc[item.status].push(item);
      return acc;
    },
    {} as Record<string, BacklogItem[]>
  );

  // Display each status group
  for (const [status, statusItems] of Object.entries(grouped)) {
    if (statusItems.length > 0) {
      const statusEmoji = getStatusEmoji(status);
      console.log(
        Formatter.subheader(`${statusEmoji} ${status.toUpperCase()} (${statusItems.length})`)
      );

      statusItems.forEach((item: BacklogItem, index: number) => {
        displayBacklogItem(item, index, options);
      });
      console.log('');
    }
  }
}

function displayEpic(epic: EpicData, options: BacklogOptions): void {
  const statusEmoji = getStatusEmoji(epic.status);
  const priorityColor = getPriorityColor(epic.priority);
  const completionInfo =
    epic.completion_percentage !== undefined ? ` (${epic.completion_percentage}%)` : '';

  console.log(
    `🎯 ${statusEmoji} ${priorityColor(epic.priority.toUpperCase())} ${Formatter.highlight(epic.title)}${completionInfo} ${Formatter.dim(`(${epic.epic_id})`)}`
  );

  if (options.detailed) {
    console.log(`   Assignee: ${epic.assignee || 'unassigned'}`);
    if (epic.milestone) console.log(`   Milestone: ${epic.milestone}`);
    if (epic.tags?.length) console.log(`   Tags: ${epic.tags.join(', ')}`);
    console.log(`   Modified: ${new Date(epic.updated_date).toLocaleString()}`);
  }
}

function displayIssue(issue: IssueData, isLast: boolean, options: BacklogOptions): void {
  const prefix = isLast ? '└── ' : '├── ';
  const statusEmoji = getStatusEmoji(issue.status);
  const priorityColor = getPriorityColor(issue.priority);

  console.log(
    `${prefix}📋 ${statusEmoji} ${priorityColor(issue.priority.toUpperCase())} ${issue.title} ${Formatter.dim(`(${issue.issue_id})`)}`
  );

  if (options.detailed) {
    const indent = isLast ? '    ' : '│   ';
    console.log(`${indent}Assignee: ${issue.assignee || 'unassigned'}`);
    if (issue.tags?.length) console.log(`${indent}Tags: ${issue.tags.join(', ')}`);
    console.log(`${indent}Modified: ${new Date(issue.updated_date).toLocaleString()}`);
  }
}

function displayTask(
  task: TaskData,
  issueIsLast: boolean,
  isLast: boolean,
  options: BacklogOptions
): void {
  const issuePrefix = issueIsLast ? '    ' : '│   ';
  const taskPrefix = isLast ? '└── ' : '├── ';
  const statusEmoji = getStatusEmoji(task.status);
  const priorityColor = getPriorityColor(task.priority);

  console.log(
    `${issuePrefix}${taskPrefix}✅ ${statusEmoji} ${priorityColor(task.priority.toUpperCase())} ${task.title} ${Formatter.dim(`(${task.task_id})`)}`
  );

  if (options.detailed) {
    const indent = issuePrefix + (isLast ? '    ' : '│   ');
    console.log(`${indent}Assignee: ${task.assignee || 'unassigned'}`);
    if (task.time_estimate) console.log(`${indent}Estimate: ${task.time_estimate}`);
    if (task.tags?.length) console.log(`${indent}Tags: ${task.tags.join(', ')}`);
  }
}

function displayPR(pr: PRData, issueIsLast: boolean, isLast: boolean, options: BacklogOptions): void {
  const issuePrefix = issueIsLast ? '    ' : '│   ';
  const prPrefix = isLast ? '└── ' : '├── ';
  const statusEmoji = getStatusEmoji(pr.status);
  const priorityColor = getPriorityColor(pr.priority);

  console.log(
    `${issuePrefix}${prPrefix}🔄 ${statusEmoji} ${priorityColor(pr.priority.toUpperCase())} ${pr.title} ${Formatter.dim(`(${pr.pr_id})`)}`
  );

  if (options.detailed) {
    const indent = issuePrefix + (isLast ? '    ' : '│   ');
    console.log(`${indent}PR Status: ${pr.pr_status}`);
    if (pr.branch_name) console.log(`${indent}Branch: ${pr.branch_name}`);
    if (pr.reviewers?.length) console.log(`${indent}Reviewers: ${pr.reviewers.join(', ')}`);
  }
}

function displayBacklogItem(item: BacklogItem, index: number, options: BacklogOptions): void {
  const typeEmoji = getTypeEmoji(item.type);
  const statusEmoji = getStatusEmoji(item.status);
  const priorityColor = getPriorityColor(item.priority);
  const assigneeInfo = item.assignee ? ` @${item.assignee}` : '';
  const tagsInfo = item.tags?.length ? ` [${item.tags.join(', ')}]` : '';

  console.log(
    `  ${(index + 1).toString().padStart(3, ' ')}. ${typeEmoji} ${statusEmoji} ${priorityColor(item.priority.toUpperCase())} ${item.title}${assigneeInfo}${tagsInfo} ${Formatter.dim(`(${getItemId(item)})`)}`
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

async function exportBacklog(data: BacklogData, filename: string): Promise<void> {
  const exportData = {
    exportTime: new Date().toISOString(),
    summary: {
      totalEpics: data.epics.length,
      totalIssues: data.issues.length,
      totalTasks: data.tasks.length,
      totalPRs: data.prs.length,
    },
    data,
  };

  const fs = await import('node:fs');
  fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
  console.log(Formatter.success(`Backlog exported to ${filename}`));
}

// Helper functions
// Helper function to get item ID based on type
function getItemId(item: AnyItemData): string {
  if ('epic_id' in item) return item.epic_id;
  if ('issue_id' in item) return item.issue_id;
  if ('task_id' in item) return item.task_id;
  if ('pr_id' in item) return item.pr_id;
  if ('project_id' in item) return item.project_id;
  throw new Error('Unknown item type');
}

function getItemType(id: string): 'epic' | 'issue' | 'task' | 'pr' {
  if (id.startsWith('EP-')) return 'epic';
  if (id.startsWith('ISS-')) return 'issue';
  if (id.startsWith('TSK-')) return 'task';
  if (id.startsWith('PR-')) return 'pr';
  throw new Error(`Unknown item type for ID: ${id}`);
}

function getTypeEmoji(type: string): string {
  switch (type) {
    case 'epic':
      return '🎯';
    case 'issue':
      return '📋';
    case 'task':
      return '✅';
    case 'pr':
      return '🔄';
    default:
      return '📄';
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'planning':
      return '📝';
    case 'active':
      return '🔄';
    case 'completed':
      return '✅';
    case 'archived':
      return '📦';
    default:
      return '📄';
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
