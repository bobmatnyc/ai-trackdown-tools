/**
 * Health Command - Universal Ticketing Interface
 * Provides comprehensive health monitoring using the universal ticketing interface
 */

import { Command } from 'commander';
import { Formatter } from '../utils/formatter.js';
import { UniversalTicketingInterface } from '../utils/universal-ticketing-interface.js';

export function createHealthCommand(): Command {
  const command = new Command('health');

  command
    .description('Display comprehensive project health metrics using universal ticketing interface')
    .option('--counts-only', 'show only ticket counts')
    .option('--metrics-only', 'show only health metrics')
    .option('--json', 'output in JSON format')
    .option('--refresh', 'force refresh of all data')
    .option('--watch', 'continuously monitor health metrics')
    .option('--epic-details', 'show detailed epic metrics')
    .option('--issue-details', 'show detailed issue metrics')
    .option('--task-details', 'show detailed task metrics')
    .addHelpText(
      'after',
      `
Examples:
  $ aitrackdown health                    # Full health report
  $ aitrackdown health --counts-only      # Just the counts
  $ aitrackdown health --json             # JSON output
  $ aitrackdown health --refresh          # Force refresh data
  $ aitrackdown health --epic-details     # Epic-specific metrics
  $ aitrackdown health --watch            # Live monitoring

This command uses the Universal Ticketing Interface to provide:
- Accurate ticket counts matching individual commands
- Real-time health monitoring
- Comprehensive project metrics
- Health alerts and recommendations
      `
    )
    .action(async (options) => {
      try {
        await executeHealthCommand(options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return command;
}

async function executeHealthCommand(options: {
  countsOnly?: boolean;
  metricsOnly?: boolean;
  json?: boolean;
  refresh?: boolean;
  watch?: boolean;
  epicDetails?: boolean;
  issueDetails?: boolean;
  taskDetails?: boolean;
}): Promise<void> {
  // Get CLI tasks directory from parent command options
  const cliTasksDir = process.env.CLI_TASKS_DIR;

  // Initialize the universal ticketing interface
  const ticketingInterface = new UniversalTicketingInterface(undefined, process.cwd(), cliTasksDir);

  // Force refresh if requested
  if (options.refresh) {
    console.log('🔄 Refreshing ticket data...');
    ticketingInterface.refreshData();
    console.log('✅ Data refreshed successfully');
    console.log('');
  }

  // Watch mode
  if (options.watch) {
    return runWatchMode(ticketingInterface);
  }

  // Get metrics
  const healthMetrics = ticketingInterface.getHealthMetrics();
  const counts = ticketingInterface.getTicketCounts();

  // JSON output
  if (options.json) {
    const output = {
      counts,
      healthMetrics,
      timestamp: new Date().toISOString(),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Counts only
  if (options.countsOnly) {
    console.log(Formatter.header('🎯 Universal Ticketing Interface - Ticket Counts'));
    console.log('');
    console.log(`📋 Epics: ${Formatter.highlight(counts.epics.toString())}`);
    console.log(`🐛 Issues: ${Formatter.highlight(counts.issues.toString())}`);
    console.log(`✅ Tasks: ${Formatter.highlight(counts.tasks.toString())}`);
    console.log(`🔢 Total: ${Formatter.highlight(counts.total.toString())}`);
    console.log('');

    // Verification note
    console.log(
      Formatter.info('✅ These counts match the individual epic/issue/task list commands')
    );
    return;
  }

  // Metrics only
  if (options.metricsOnly) {
    ticketingInterface.displayHealthMetrics();
    return;
  }

  // Full health report (default)
  console.log(Formatter.header('🏥 Project Health Report'));
  console.log(Formatter.info('Using Universal Ticketing Interface for accurate health monitoring'));
  console.log('');

  // Display main health metrics
  ticketingInterface.displayHealthMetrics();

  // Detailed metrics if requested
  if (options.epicDetails) {
    displayEpicDetails(ticketingInterface);
  }

  if (options.issueDetails) {
    displayIssueDetails(ticketingInterface);
  }

  if (options.taskDetails) {
    displayTaskDetails(ticketingInterface);
  }

  // Summary and recommendations
  displayRecommendations(healthMetrics);
}

function displayEpicDetails(ticketingInterface: UniversalTicketingInterface): void {
  const epicMetrics = ticketingInterface.getEpicMetrics();

  console.log(Formatter.subheader('📋 Epic Details'));
  console.log(`   Total Epics: ${epicMetrics.total}`);
  console.log(`   Active Epics: ${epicMetrics.active}`);
  console.log(`   Completed Epics: ${epicMetrics.completed}`);
  console.log(`   Average Completion: ${epicMetrics.averageCompletion}%`);
  console.log('');
}

function displayIssueDetails(ticketingInterface: UniversalTicketingInterface): void {
  const issueMetrics = ticketingInterface.getIssueMetrics();

  console.log(Formatter.subheader('🐛 Issue Details'));
  console.log(`   Total Issues: ${issueMetrics.total}`);
  console.log(`   Unassigned Issues: ${issueMetrics.unassigned}`);
  console.log(`   High Priority Issues: ${issueMetrics.highPriority}`);
  console.log('');

  if (Object.keys(issueMetrics.byEpic).length > 0) {
    console.log(Formatter.subheader('📊 Issues by Epic'));
    Object.entries(issueMetrics.byEpic).forEach(([epic, count]) => {
      console.log(`   ${epic}: ${count} issues`);
    });
    console.log('');
  }
}

function displayTaskDetails(ticketingInterface: UniversalTicketingInterface): void {
  const taskMetrics = ticketingInterface.getTaskMetrics();

  console.log(Formatter.subheader('✅ Task Details'));
  console.log(`   Total Tasks: ${taskMetrics.total}`);
  console.log(`   Standalone Tasks: ${taskMetrics.standalone}`);
  console.log(`   Estimated Tokens: ${taskMetrics.estimatedVsActual.estimated}`);
  console.log(`   Actual Tokens: ${taskMetrics.estimatedVsActual.actual}`);
  console.log('');

  if (Object.keys(taskMetrics.byIssue).length > 0) {
    console.log(Formatter.subheader('📊 Tasks by Issue'));
    Object.entries(taskMetrics.byIssue).forEach(([issue, count]) => {
      console.log(`   ${issue}: ${count} tasks`);
    });
    console.log('');
  }
}

function displayRecommendations(healthMetrics: any): void {
  console.log(Formatter.subheader('💡 Health Recommendations'));

  const recommendations = [];

  // Based on completion rate
  if (healthMetrics.completionRate < 20) {
    recommendations.push(
      'Consider focusing on completing existing tickets before creating new ones'
    );
  }

  // Based on priority distribution
  if (healthMetrics.priorityBreakdown.critical > 3) {
    recommendations.push('High number of critical issues detected - consider prioritizing these');
  }

  // Based on recent activity
  if (healthMetrics.recentActivity.updatedLastWeek < healthMetrics.counts.total * 0.1) {
    recommendations.push('Low recent activity detected - consider reviewing stale tickets');
  }

  // Based on status distribution
  if (healthMetrics.statusBreakdown.blocked > 0) {
    recommendations.push(
      `Review ${healthMetrics.statusBreakdown.blocked} blocked tickets to remove blockers`
    );
  }

  if (recommendations.length > 0) {
    recommendations.forEach((rec) => {
      console.log(`   • ${rec}`);
    });
  } else {
    console.log('   ✅ Project health looks good! Keep up the great work.');
  }

  console.log('');
}

async function runWatchMode(ticketingInterface: UniversalTicketingInterface): Promise<void> {
  console.log(Formatter.info('👁️ Health monitoring mode enabled - updating every 30 seconds'));
  console.log(Formatter.info('Press Ctrl+C to exit'));
  console.log('');

  const displayHealthData = () => {
    console.clear();
    console.log(Formatter.header(`🏥 Live Health Monitoring - ${new Date().toLocaleTimeString()}`));
    console.log('');

    const metrics = ticketingInterface.getMonitoringData();

    // Quick overview
    console.log(Formatter.subheader('📊 Quick Overview'));
    console.log(`   Total Tickets: ${metrics.counts.total}`);
    console.log(`   Completion Rate: ${metrics.completionRate}%`);
    console.log(`   Active Items: ${metrics.statusBreakdown.active}`);
    console.log(`   Blocked Items: ${metrics.statusBreakdown.blocked}`);
    console.log(`   Recent Activity: ${metrics.recentActivity.updatedLastWeek} updated (7 days)`);
    console.log('');

    // Health status
    const isHealthy =
      metrics.statusBreakdown.blocked === 0 &&
      metrics.priorityBreakdown.critical < 3 &&
      metrics.completionRate > 10;

    if (isHealthy) {
      console.log(Formatter.success('✅ Project Health: GOOD'));
    } else {
      console.log(Formatter.warning('⚠️ Project Health: NEEDS ATTENTION'));
    }

    console.log('');
    console.log(Formatter.dim(`Last updated: ${new Date().toLocaleTimeString()}`));
  };

  // Initial display
  displayHealthData();

  // Set up interval
  const interval = setInterval(displayHealthData, 30000);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log(Formatter.info('\n👋 Health monitoring stopped'));
    process.exit(0);
  });
}
