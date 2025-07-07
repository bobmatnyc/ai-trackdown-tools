/**
 * Milestone analytics command - Generate analytics and insights for milestones
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatSuccess, formatError, formatWarning, formatInfo } from '../../utils/formatters.js';
import type { MilestoneAnalyticsOptions } from '../../types/commands.js';

export function createMilestoneAnalyticsCommand(): Command {
  const cmd = new Command('analytics');
  
  cmd
    .description('Generate analytics and insights for milestones')
    .argument('<title>', 'Milestone title or number')
    .option('--velocity', 'Calculate velocity metrics')
    .option('--completion-rate', 'Show completion rate analysis')
    .option('--burndown', 'Generate burndown chart data')
    .option('--cycle-time', 'Calculate average cycle time')
    .option('--forecasting', 'Generate completion forecasting')
    .option('--format <format>', 'Output format (table, json, yaml, chart)', 'table')
    .option('--export-chart', 'Export burndown chart as image (requires chart format)')
    .option('--period <period>', 'Analysis period (7d, 30d, 90d, all)', '30d')
    .action(async (title: string, options: MilestoneAnalyticsOptions) => {
      try {
        await handleMilestoneAnalytics(title, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleMilestoneAnalytics(title: string, options: MilestoneAnalyticsOptions): Promise<void> {
  // Validate milestone title
  if (!title || title.trim().length === 0) {
    throw new Error('Milestone title or number is required');
  }

  title = title.trim();

  // Create GitHub client
  const client = createGitHubClient();
  
  // Get repository info
  const repository = client.getRepository();
  if (!repository) {
    throw new Error('No repository configured. Run "aitrackdown config repo" to set up repository.');
  }

  try {
    console.log(chalk.blue(`Analyzing milestone "${title}" in ${repository.owner}/${repository.name}...`));
    
    // Find milestone
    let milestone;
    if (/^\d+$/.test(title)) {
      // If title is a number, fetch by milestone number
      milestone = await client.getMilestone(parseInt(title));
    } else {
      // Find by title
      milestone = await client.findMilestoneByTitle(title);
      if (!milestone) {
        throw new Error(`Milestone "${title}" not found`);
      }
    }

    // Get milestone issues for detailed analysis
    console.log(chalk.blue('Fetching milestone issues for analysis...'));
    const issuesResponse = await client.listIssues({ 
      milestone: milestone.number.toString(),
      state: 'all',
      per_page: 100 
    });
    const issues = issuesResponse.data;

    // Generate analytics based on requested options
    const analytics: any = {
      milestone: {
        title: milestone.title,
        number: milestone.number,
        state: milestone.state,
        due_on: milestone.due_on,
        created_at: milestone.created_at,
        updated_at: milestone.updated_at
      },
      summary: {
        total_issues: issues.length,
        open_issues: milestone.open_issues,
        closed_issues: milestone.closed_issues,
        completion_percentage: milestone.open_issues + milestone.closed_issues > 0 
          ? Math.round((milestone.closed_issues / (milestone.open_issues + milestone.closed_issues)) * 100)
          : 0
      }
    };

    // Calculate velocity metrics
    if (options.velocity || options.format === 'chart') {
      analytics.velocity = calculateVelocityMetrics(issues, options.period);
    }

    // Calculate completion rate analysis
    if (options.completionRate || options.format === 'chart') {
      analytics.completion_rate = calculateCompletionRate(issues, milestone);
    }

    // Generate burndown chart data
    if (options.burndown || options.format === 'chart') {
      analytics.burndown = generateBurndownData(issues, milestone);
    }

    // Calculate cycle time
    if (options.cycleTime || options.format === 'chart') {
      analytics.cycle_time = calculateCycleTime(issues);
    }

    // Generate forecasting
    if (options.forecasting || options.format === 'chart') {
      analytics.forecasting = generateForecasting(issues, milestone);
    }

    // Format output
    switch (options.format) {
      case 'json':
        console.log(OutputFormatter.formatJSON(analytics, { pretty: true }));
        break;
      
      case 'yaml':
        console.log(OutputFormatter.formatYAML(analytics));
        break;
      
      case 'chart':
        console.log(formatBurndownChart(analytics.burndown, milestone));
        if (options.exportChart) {
          console.log(formatInfo('Chart export feature requires additional dependencies (chart.js, canvas)'));
          console.log(formatInfo('Use --format json to get chart data for external visualization'));
        }
        break;
      
      default:
        console.log(formatAnalyticsTable(analytics, milestone));
        break;
    }

    // Show recommendations
    if (options.format === 'table') {
      console.log('');
      console.log(chalk.bold.cyan('📊 Insights & Recommendations:'));
      console.log(chalk.gray('─'.repeat(50)));
      
      const recommendations = generateRecommendations(analytics, milestone, issues);
      recommendations.forEach(rec => {
        console.log(`${chalk.blue('•')} ${rec}`);
      });
    }

  } catch (error) {
    if (error instanceof GitHubAPIClientError) {
      if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to read milestones in this repository.'));
      } else if (error.isNotFound()) {
        console.error(formatError('Milestone not found or access denied.'));
      } else {
        console.error(formatError(`GitHub API error: ${error.message}`));
      }
    } else {
      throw error;
    }
  }
}

function calculateVelocityMetrics(issues: any[], period: string): any {
  const now = new Date();
  const periodMs = parsePeriod(period);
  const since = new Date(now.getTime() - periodMs);
  
  const recentIssues = issues.filter(issue => 
    issue.closed_at && new Date(issue.closed_at) >= since
  );

  const totalClosed = recentIssues.length;
  const avgClosureTime = recentIssues.length > 0 
    ? recentIssues.reduce((sum, issue) => {
        const created = new Date(issue.created_at);
        const closed = new Date(issue.closed_at);
        return sum + (closed.getTime() - created.getTime());
      }, 0) / recentIssues.length / (1000 * 60 * 60 * 24) // Convert to days
    : 0;

  return {
    period,
    issues_closed: totalClosed,
    velocity_per_day: totalClosed / (periodMs / (1000 * 60 * 60 * 24)),
    avg_closure_time_days: Math.round(avgClosureTime * 10) / 10
  };
}

function calculateCompletionRate(issues: any[], milestone: any): any {
  const total = issues.length;
  const closed = issues.filter(issue => issue.state === 'closed').length;
  const open = total - closed;

  // Calculate daily completion rate
  const milestoneStart = new Date(milestone.created_at);
  const now = new Date();
  const daysElapsed = Math.max(1, Math.ceil((now.getTime() - milestoneStart.getTime()) / (1000 * 60 * 60 * 24)));
  
  const completionRate = closed / daysElapsed;

  return {
    total_issues: total,
    closed_issues: closed,
    open_issues: open,
    completion_percentage: total > 0 ? Math.round((closed / total) * 100) : 0,
    days_elapsed: daysElapsed,
    completion_rate_per_day: Math.round(completionRate * 100) / 100
  };
}

function generateBurndownData(issues: any[], milestone: any): any {
  const start = new Date(milestone.created_at);
  const now = new Date();
  const dueDate = milestone.due_on ? new Date(milestone.due_on) : null;
  
  // Generate daily data points
  const data = [];
  const totalIssues = issues.length;
  
  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    const issuesClosedByDate = issues.filter(issue => 
      issue.closed_at && new Date(issue.closed_at) <= d
    ).length;
    
    const remaining = totalIssues - issuesClosedByDate;
    data.push({
      date: d.toISOString().split('T')[0],
      remaining_issues: remaining,
      closed_issues: issuesClosedByDate
    });
  }

  // Calculate ideal burndown line
  const idealData = [];
  if (dueDate && dueDate > start) {
    const totalDays = Math.ceil((dueDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const issuesPerDay = totalIssues / totalDays;
    
    for (let day = 0; day <= totalDays; day++) {
      const date = new Date(start);
      date.setDate(date.getDate() + day);
      idealData.push({
        date: date.toISOString().split('T')[0],
        remaining_issues: Math.max(0, totalIssues - (day * issuesPerDay))
      });
    }
  }

  return {
    actual: data,
    ideal: idealData,
    total_issues: totalIssues,
    start_date: start.toISOString().split('T')[0],
    due_date: dueDate ? dueDate.toISOString().split('T')[0] : null
  };
}

function calculateCycleTime(issues: any[]): any {
  const closedIssues = issues.filter(issue => issue.closed_at);
  
  if (closedIssues.length === 0) {
    return {
      avg_cycle_time_days: 0,
      median_cycle_time_days: 0,
      min_cycle_time_days: 0,
      max_cycle_time_days: 0,
      total_issues_analyzed: 0
    };
  }

  const cycleTimes = closedIssues.map(issue => {
    const created = new Date(issue.created_at);
    const closed = new Date(issue.closed_at);
    return (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24); // Days
  });

  cycleTimes.sort((a, b) => a - b);

  return {
    avg_cycle_time_days: Math.round((cycleTimes.reduce((sum, time) => sum + time, 0) / cycleTimes.length) * 10) / 10,
    median_cycle_time_days: cycleTimes[Math.floor(cycleTimes.length / 2)],
    min_cycle_time_days: Math.round(cycleTimes[0] * 10) / 10,
    max_cycle_time_days: Math.round(cycleTimes[cycleTimes.length - 1] * 10) / 10,
    total_issues_analyzed: closedIssues.length
  };
}

function generateForecasting(issues: any[], milestone: any): any {
  const now = new Date();
  const totalIssues = issues.length;
  const closedIssues = issues.filter(issue => issue.state === 'closed').length;
  const openIssues = totalIssues - closedIssues;

  // Calculate velocity from last 7 days
  const lastWeek = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  const recentlyClosed = issues.filter(issue => 
    issue.closed_at && new Date(issue.closed_at) >= lastWeek
  ).length;

  const currentVelocity = recentlyClosed / 7; // Issues per day

  let estimatedCompletion = null;
  let daysToCompletion = null;

  if (currentVelocity > 0 && openIssues > 0) {
    daysToCompletion = Math.ceil(openIssues / currentVelocity);
    estimatedCompletion = new Date(now.getTime() + (daysToCompletion * 24 * 60 * 60 * 1000));
  }

  const result: any = {
    current_velocity_per_day: Math.round(currentVelocity * 100) / 100,
    open_issues_remaining: openIssues,
    estimated_days_to_completion: daysToCompletion,
    estimated_completion_date: estimatedCompletion ? estimatedCompletion.toISOString().split('T')[0] : null
  };

  // Compare with due date if available
  if (milestone.due_on) {
    const dueDate = new Date(milestone.due_on);
    const isOnTrack = !estimatedCompletion || estimatedCompletion <= dueDate;
    
    result.due_date = dueDate.toISOString().split('T')[0];
    result.on_track = isOnTrack;
    
    if (estimatedCompletion) {
      const daysDifference = Math.ceil((estimatedCompletion.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      result.days_ahead_behind = daysDifference;
    }
  }

  return result;
}

function parsePeriod(period: string): number {
  const match = period.match(/^(\d+)([dwmy])$/);
  if (!match) {
    throw new Error('Invalid period format. Use format like "7d", "30d", "3m", etc.');
  }

  const [, num, unit] = match;
  const value = parseInt(num);

  switch (unit) {
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    case 'm': return value * 30 * 24 * 60 * 60 * 1000;
    case 'y': return value * 365 * 24 * 60 * 60 * 1000;
    default: throw new Error('Invalid period unit');
  }
}

function formatBurndownChart(burndownData: any, milestone: any): string {
  if (!burndownData || !burndownData.actual) {
    return formatWarning('No burndown data available');
  }

  const data = burndownData.actual.slice(-30); // Show last 30 days
  const maxIssues = burndownData.total_issues;
  const chartHeight = 15;
  const chartWidth = Math.min(60, data.length);

  let chart = chalk.bold.cyan('📈 Burndown Chart (Last 30 Days)\n');
  chart += chalk.gray('─'.repeat(70)) + '\n';

  // Generate ASCII chart
  for (let row = chartHeight; row >= 0; row--) {
    const value = Math.round((row / chartHeight) * maxIssues);
    const label = value.toString().padStart(3);
    
    chart += chalk.gray(`${label} │`);
    
    for (let col = 0; col < chartWidth; col++) {
      const dataIndex = Math.floor((col / chartWidth) * data.length);
      const point = data[dataIndex];
      
      if (point && point.remaining_issues <= value && point.remaining_issues > value - (maxIssues / chartHeight)) {
        chart += chalk.blue('█');
      } else {
        chart += ' ';
      }
    }
    chart += '\n';
  }

  chart += chalk.gray('    └' + '─'.repeat(chartWidth) + '\n');
  chart += chalk.gray('     ');
  
  // Add date labels
  const startDate = new Date(data[0].date);
  const endDate = new Date(data[data.length - 1].date);
  chart += `${startDate.getMonth() + 1}/${startDate.getDate()}`;
  chart += ' '.repeat(Math.max(0, chartWidth - 20));
  chart += `${endDate.getMonth() + 1}/${endDate.getDate()}`;
  
  return chart;
}

function formatAnalyticsTable(analytics: any, milestone: any): string {
  let output = '';
  
  // Basic milestone info
  output += chalk.bold.cyan('📊 Milestone Analytics\n');
  output += chalk.gray('═'.repeat(50)) + '\n';
  output += `${chalk.bold('Milestone:')} ${analytics.milestone.title} (#${analytics.milestone.number})\n`;
  output += `${chalk.bold('State:')} ${analytics.milestone.state}\n`;
  output += `${chalk.bold('Due date:')} ${analytics.milestone.due_on ? new Date(analytics.milestone.due_on).toLocaleDateString() : 'Not set'}\n`;
  output += `${chalk.bold('Created:')} ${new Date(analytics.milestone.created_at).toLocaleDateString()}\n\n`;

  // Summary section
  output += chalk.bold.cyan('📈 Summary\n');
  output += chalk.gray('─'.repeat(20)) + '\n';
  output += `${chalk.bold('Total issues:')} ${analytics.summary.total_issues}\n`;
  output += `${chalk.bold('Closed issues:')} ${analytics.summary.closed_issues}\n`;
  output += `${chalk.bold('Open issues:')} ${analytics.summary.open_issues}\n`;
  output += `${chalk.bold('Completion:')} ${analytics.summary.completion_percentage}%\n\n`;

  // Velocity metrics
  if (analytics.velocity) {
    output += chalk.bold.cyan('⚡ Velocity Metrics\n');
    output += chalk.gray('─'.repeat(25)) + '\n';
    output += `${chalk.bold('Period:')} ${analytics.velocity.period}\n`;
    output += `${chalk.bold('Issues closed:')} ${analytics.velocity.issues_closed}\n`;
    output += `${chalk.bold('Velocity:')} ${analytics.velocity.velocity_per_day} issues/day\n`;
    output += `${chalk.bold('Avg closure time:')} ${analytics.velocity.avg_closure_time_days} days\n\n`;
  }

  // Completion rate
  if (analytics.completion_rate) {
    output += chalk.bold.cyan('📊 Completion Rate\n');
    output += chalk.gray('─'.repeat(25)) + '\n';
    output += `${chalk.bold('Days elapsed:')} ${analytics.completion_rate.days_elapsed}\n`;
    output += `${chalk.bold('Rate:')} ${analytics.completion_rate.completion_rate_per_day} issues/day\n\n`;
  }

  // Cycle time
  if (analytics.cycle_time) {
    output += chalk.bold.cyan('⏱️  Cycle Time Analysis\n');
    output += chalk.gray('─'.repeat(30)) + '\n';
    output += `${chalk.bold('Average:')} ${analytics.cycle_time.avg_cycle_time_days} days\n`;
    output += `${chalk.bold('Median:')} ${analytics.cycle_time.median_cycle_time_days} days\n`;
    output += `${chalk.bold('Range:')} ${analytics.cycle_time.min_cycle_time_days} - ${analytics.cycle_time.max_cycle_time_days} days\n\n`;
  }

  // Forecasting
  if (analytics.forecasting) {
    output += chalk.bold.cyan('🔮 Forecasting\n');
    output += chalk.gray('─'.repeat(20)) + '\n';
    output += `${chalk.bold('Current velocity:')} ${analytics.forecasting.current_velocity_per_day} issues/day\n`;
    output += `${chalk.bold('Remaining issues:')} ${analytics.forecasting.open_issues_remaining}\n`;
    
    if (analytics.forecasting.estimated_completion_date) {
      output += `${chalk.bold('Estimated completion:')} ${analytics.forecasting.estimated_completion_date}\n`;
      
      if (analytics.forecasting.due_date) {
        const status = analytics.forecasting.on_track ? chalk.green('On track') : chalk.red('Behind schedule');
        output += `${chalk.bold('Due date:')} ${analytics.forecasting.due_date}\n`;
        output += `${chalk.bold('Status:')} ${status}\n`;
        
        if (analytics.forecasting.days_ahead_behind !== undefined) {
          const diff = analytics.forecasting.days_ahead_behind;
          if (diff > 0) {
            output += `${chalk.bold('Days behind:')} ${chalk.red(diff.toString())}\n`;
          } else if (diff < 0) {
            output += `${chalk.bold('Days ahead:')} ${chalk.green(Math.abs(diff).toString())}\n`;
          }
        }
      }
    } else {
      output += `${chalk.bold('Estimated completion:')} ${chalk.gray('Unable to calculate (no recent activity)')}\n`;
    }
  }

  return output;
}

function generateRecommendations(analytics: any, milestone: any, issues: any[]): string[] {
  const recommendations = [];

  // Completion rate recommendations
  if (analytics.summary.completion_percentage < 25) {
    recommendations.push('Consider breaking down large issues into smaller, manageable tasks');
  } else if (analytics.summary.completion_percentage > 75) {
    recommendations.push('Milestone is progressing well! Consider planning next milestone');
  }

  // Velocity recommendations
  if (analytics.velocity && analytics.velocity.velocity_per_day < 0.5) {
    recommendations.push('Low velocity detected. Consider reviewing issue complexity and team capacity');
  }

  // Due date recommendations
  if (analytics.forecasting) {
    if (analytics.forecasting.on_track === false) {
      recommendations.push('Behind schedule. Consider scope reduction or deadline extension');
    }
    
    if (!milestone.due_on) {
      recommendations.push('Set a due date for better project planning and tracking');
    }
  }

  // Cycle time recommendations
  if (analytics.cycle_time && analytics.cycle_time.avg_cycle_time_days > 14) {
    recommendations.push('High cycle time detected. Review workflow bottlenecks and issue complexity');
  }

  // Issue distribution recommendations
  const openIssues = issues.filter(i => i.state === 'open');
  const issuesWithoutAssignee = openIssues.filter(i => !i.assignee).length;
  
  if (issuesWithoutAssignee > openIssues.length * 0.5) {
    recommendations.push('Many issues lack assignees. Consider assigning owners for better accountability');
  }

  // Default recommendation if none provided
  if (recommendations.length === 0) {
    recommendations.push('Milestone metrics look healthy. Keep up the good work!');
  }

  return recommendations;
}

// Export for use in other commands
export { handleMilestoneAnalytics };