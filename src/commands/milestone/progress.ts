/**
 * Milestone progress command - View milestone progress with burndown charts
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatSuccess, formatError, formatWarning, formatInfo } from '../../utils/formatters.js';
import type { MilestoneProgressOptions } from '../../types/commands.js';

export function createMilestoneProgressCommand(): Command {
  const cmd = new Command('progress');
  
  cmd
    .description('View milestone progress with detailed analytics and burndown charts')
    .argument('<title>', 'Milestone title or number')
    .option('--detailed', 'Show detailed progress breakdown')
    .option('--burndown', 'Generate burndown chart')
    .option('--forecast', 'Include completion forecasting')
    .option('--export-chart', 'Export chart data for external visualization')
    .option('--format <format>', 'Output format (table, json, yaml, chart)', 'table')
    .option('--period <period>', 'Time period for analysis (7d, 30d, all)', '30d')
    .action(async (title: string, options: MilestoneProgressOptions) => {
      try {
        await handleMilestoneProgress(title, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

async function handleMilestoneProgress(title: string, options: MilestoneProgressOptions): Promise<void> {
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
    console.log(chalk.blue(`Loading progress for milestone "${title}" in ${repository.owner}/${repository.name}...`));
    
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
    console.log(chalk.blue('Fetching milestone issues...'));
    const issuesResponse = await client.listIssues({ 
      milestone: milestone.number.toString(),
      state: 'all',
      per_page: 100 
    });
    const issues = issuesResponse.data;

    // Calculate progress metrics
    const progress = calculateProgressMetrics(milestone, issues, options.period);

    // Generate burndown data if requested
    let burndownData = null;
    if (options.burndown || options.format === 'chart') {
      burndownData = generateBurndownData(issues, milestone);
    }

    // Generate forecast if requested
    let forecast = null;
    if (options.forecast) {
      forecast = generateForecast(issues, milestone);
    }

    // Format output
    switch (options.format) {
      case 'json':
        const jsonOutput = {
          milestone: {
            title: milestone.title,
            number: milestone.number,
            state: milestone.state,
            due_on: milestone.due_on
          },
          progress,
          burndown: burndownData,
          forecast
        };
        console.log(OutputFormatter.formatJSON(jsonOutput, { pretty: true }));
        break;
      
      case 'yaml':
        const yamlOutput = {
          milestone: {
            title: milestone.title,
            number: milestone.number,
            state: milestone.state,
            due_on: milestone.due_on
          },
          progress,
          burndown: burndownData,
          forecast
        };
        console.log(OutputFormatter.formatYAML(yamlOutput));
        break;
      
      case 'chart':
        if (burndownData) {
          console.log(formatBurndownChart(burndownData, milestone));
          if (options.exportChart) {
            console.log('');
            console.log(formatInfo('📊 Chart data exported in JSON format below:'));
            console.log(OutputFormatter.formatJSON(burndownData, { pretty: true }));
          }
        } else {
          console.log(formatWarning('Burndown chart requires --burndown option'));
        }
        break;
      
      default:
        console.log(formatProgressTable(milestone, progress, issues, options));
        
        if (burndownData && options.burndown) {
          console.log('');
          console.log(formatBurndownChart(burndownData, milestone));
        }
        
        if (forecast && options.forecast) {
          console.log('');
          console.log(formatForecastSection(forecast, milestone));
        }
        break;
    }

    // Show actionable insights for table format
    if (options.format === 'table') {
      console.log('');
      console.log(chalk.bold.cyan('💡 Insights & Recommendations:'));
      console.log(chalk.gray('─'.repeat(50)));
      
      const insights = generateInsights(progress, milestone, issues, forecast);
      insights.forEach(insight => {
        console.log(`${chalk.blue('•')} ${insight}`);
      });

      // Show quick actions
      console.log('');
      console.log(chalk.bold.cyan('⚡ Quick Actions:'));
      console.log(chalk.gray('─'.repeat(25)));
      console.log(`${chalk.cyan('View issues:')} aitrackdown issue list --milestone "${milestone.title}"`);
      console.log(`${chalk.cyan('Add issues:')} aitrackdown milestone assign <issues> "${milestone.title}"`);
      console.log(`${chalk.cyan('Analytics:')} aitrackdown milestone analytics "${milestone.title}" --velocity`);
      
      if (milestone.state === 'open' && progress.completion_percentage >= 100) {
        console.log(`${chalk.cyan('Close milestone:')} aitrackdown milestone close "${milestone.title}"`);
      }
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

function calculateProgressMetrics(milestone: any, issues: any[], period: string): any {
  const now = new Date();
  const total = issues.length;
  const closed = issues.filter(issue => issue.state === 'closed').length;
  const open = total - closed;
  
  // Calculate completion percentage
  const completionPercentage = total > 0 ? Math.round((closed / total) * 100) : 0;
  
  // Calculate velocity metrics for specified period
  const periodMs = parsePeriod(period);
  const since = new Date(now.getTime() - periodMs);
  
  const recentActivity = issues.filter(issue => 
    (issue.closed_at && new Date(issue.closed_at) >= since) ||
    (issue.updated_at && new Date(issue.updated_at) >= since)
  );
  
  const recentlyClosed = issues.filter(issue => 
    issue.closed_at && new Date(issue.closed_at) >= since
  ).length;
  
  const velocity = recentlyClosed / (periodMs / (1000 * 60 * 60 * 24)); // issues per day
  
  // Calculate days since milestone creation
  const created = new Date(milestone.created_at);
  const daysSinceCreated = Math.ceil((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculate due date metrics
  let daysUntilDue = null;
  let isOverdue = false;
  let daysOverdue = null;
  
  if (milestone.due_on) {
    const dueDate = new Date(milestone.due_on);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 0) {
      daysUntilDue = diffDays;
    } else {
      isOverdue = true;
      daysOverdue = Math.abs(diffDays);
    }
  }
  
  // Calculate issue distribution
  const issueDistribution = {
    by_state: {
      open: open,
      closed: closed
    },
    by_assignee: {}
  };
  
  // Group by assignee
  issues.forEach(issue => {
    const assignee = issue.assignee?.login || 'Unassigned';
    if (!issueDistribution.by_assignee[assignee]) {
      issueDistribution.by_assignee[assignee] = { open: 0, closed: 0 };
    }
    issueDistribution.by_assignee[assignee][issue.state]++;
  });
  
  // Calculate labels distribution
  const labelDistribution = {};
  issues.forEach(issue => {
    issue.labels.forEach(label => {
      if (!labelDistribution[label.name]) {
        labelDistribution[label.name] = { open: 0, closed: 0 };
      }
      labelDistribution[label.name][issue.state]++;
    });
  });

  return {
    summary: {
      total_issues: total,
      open_issues: open,
      closed_issues: closed,
      completion_percentage: completionPercentage
    },
    timeline: {
      created_at: milestone.created_at,
      due_on: milestone.due_on,
      days_since_created: daysSinceCreated,
      days_until_due: daysUntilDue,
      is_overdue: isOverdue,
      days_overdue: daysOverdue
    },
    velocity: {
      period,
      recently_closed: recentlyClosed,
      issues_per_day: Math.round(velocity * 100) / 100,
      recent_activity: recentActivity.length
    },
    distribution: {
      by_state: issueDistribution.by_state,
      by_assignee: issueDistribution.by_assignee,
      by_labels: labelDistribution
    }
  };
}

function generateBurndownData(issues: any[], milestone: any): any {
  const start = new Date(milestone.created_at);
  const now = new Date();
  const dueDate = milestone.due_on ? new Date(milestone.due_on) : null;
  
  // Generate daily data points
  const data = [];
  const totalIssues = issues.length;
  
  // Sort issues by closed date for accurate burndown
  const sortedIssues = issues
    .filter(issue => issue.closed_at)
    .sort((a, b) => new Date(a.closed_at).getTime() - new Date(b.closed_at).getTime());
  
  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    const issuesClosedByDate = sortedIssues.filter(issue => 
      new Date(issue.closed_at) <= d
    ).length;
    
    const remaining = totalIssues - issuesClosedByDate;
    data.push({
      date: d.toISOString().split('T')[0],
      remaining_issues: remaining,
      closed_issues: issuesClosedByDate,
      total_issues: totalIssues
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
        remaining_issues: Math.max(0, Math.round(totalIssues - (day * issuesPerDay)))
      });
    }
  }

  return {
    actual: data,
    ideal: idealData,
    metadata: {
      total_issues: totalIssues,
      start_date: start.toISOString().split('T')[0],
      due_date: dueDate ? dueDate.toISOString().split('T')[0] : null,
      current_remaining: data[data.length - 1]?.remaining_issues || totalIssues
    }
  };
}

function generateForecast(issues: any[], milestone: any): any {
  const now = new Date();
  const openIssues = issues.filter(issue => issue.state === 'open').length;
  
  // Calculate velocity from last 14 days
  const twoWeeksAgo = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));
  const recentlyClosed = issues.filter(issue => 
    issue.closed_at && new Date(issue.closed_at) >= twoWeeksAgo
  ).length;
  
  const currentVelocity = recentlyClosed / 14; // Issues per day
  
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
    estimated_completion_date: estimatedCompletion ? estimatedCompletion.toISOString().split('T')[0] : null,
    confidence: calculateForecastConfidence(recentlyClosed, currentVelocity)
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

function calculateForecastConfidence(recentlyClosed: number, velocity: number): string {
  if (recentlyClosed === 0) return 'low';
  if (recentlyClosed < 3) return 'medium';
  if (velocity > 0.5) return 'high';
  return 'medium';
}

function formatProgressTable(milestone: any, progress: any, issues: any[], options: MilestoneProgressOptions): string {
  let output = '';
  
  // Header
  output += chalk.bold.cyan('🎯 Milestone Progress\n');
  output += chalk.gray('═'.repeat(50)) + '\n';
  output += `${chalk.bold('Milestone:')} ${milestone.title} (#${milestone.number})\n`;
  output += `${chalk.bold('State:')} ${milestone.state}\n`;
  output += `${chalk.bold('Created:')} ${new Date(milestone.created_at).toLocaleDateString()}\n`;
  
  if (milestone.due_on) {
    const dueDate = new Date(milestone.due_on);
    output += `${chalk.bold('Due date:')} ${dueDate.toLocaleDateString()}`;
    
    if (progress.timeline.is_overdue) {
      output += ` ${chalk.red(`(${progress.timeline.days_overdue} days overdue)`)}`;
    } else if (progress.timeline.days_until_due !== null) {
      output += ` ${chalk.blue(`(${progress.timeline.days_until_due} days remaining)`)}`;
    }
  } else {
    output += `${chalk.bold('Due date:')} ${chalk.gray('Not set')}`;
  }
  
  output += '\n\n';
  
  // Progress summary
  output += chalk.bold.cyan('📊 Progress Summary\n');
  output += chalk.gray('─'.repeat(25)) + '\n';
  output += `${chalk.bold('Total issues:')} ${progress.summary.total_issues}\n`;
  output += `${chalk.bold('Completed:')} ${progress.summary.closed_issues}\n`;
  output += `${chalk.bold('Remaining:')} ${progress.summary.open_issues}\n`;
  
  // Progress bar
  const progressBar = generateProgressBar(progress.summary.completion_percentage);
  output += `${chalk.bold('Progress:')} ${progressBar} ${progress.summary.completion_percentage}%\n\n`;
  
  // Velocity section
  if (progress.velocity.issues_per_day > 0) {
    output += chalk.bold.cyan('⚡ Velocity\n');
    output += chalk.gray('─'.repeat(15)) + '\n';
    output += `${chalk.bold('Recent velocity:')} ${progress.velocity.issues_per_day} issues/day (last ${progress.velocity.period})\n`;
    output += `${chalk.bold('Recent activity:')} ${progress.velocity.recent_activity} issue updates\n`;
    output += `${chalk.bold('Recently closed:')} ${progress.velocity.recently_closed} issues\n\n`;
  }
  
  // Detailed breakdown if requested
  if (options.detailed) {
    // Assignee breakdown
    output += chalk.bold.cyan('👥 By Assignee\n');
    output += chalk.gray('─'.repeat(20)) + '\n';
    
    const assigneeData = Object.entries(progress.distribution.by_assignee)
      .sort(([,a], [,b]) => (b.open + b.closed) - (a.open + a.closed))
      .slice(0, 10); // Top 10 assignees
    
    assigneeData.forEach(([assignee, counts]) => {
      const total = counts.open + counts.closed;
      const completion = total > 0 ? Math.round((counts.closed / total) * 100) : 0;
      output += `  ${assignee.padEnd(15)} ${total.toString().padStart(3)} issues (${completion}% complete)\n`;
    });
    
    // Top labels
    const labelData = Object.entries(progress.distribution.by_labels)
      .sort(([,a], [,b]) => (b.open + b.closed) - (a.open + a.closed))
      .slice(0, 5); // Top 5 labels
    
    if (labelData.length > 0) {
      output += '\n';
      output += chalk.bold.cyan('🏷️  Top Labels\n');
      output += chalk.gray('─'.repeat(18)) + '\n';
      
      labelData.forEach(([label, counts]) => {
        const total = counts.open + counts.closed;
        output += `  ${label.padEnd(20)} ${total.toString().padStart(3)} issues\n`;
      });
    }
    
    output += '\n';
  }
  
  return output;
}

function formatBurndownChart(burndownData: any, milestone: any): string {
  if (!burndownData || !burndownData.actual) {
    return formatWarning('No burndown data available');
  }

  const data = burndownData.actual.slice(-21); // Show last 21 days
  const maxIssues = burndownData.metadata.total_issues;
  const chartHeight = 10;
  const chartWidth = Math.min(50, data.length);

  let chart = chalk.bold.cyan('📈 Burndown Chart (Last 21 Days)\n');
  chart += chalk.gray('─'.repeat(60)) + '\n';

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
      } else if (burndownData.ideal) {
        // Show ideal line
        const idealPoint = burndownData.ideal.find(p => p.date === point?.date);
        if (idealPoint && idealPoint.remaining_issues <= value && idealPoint.remaining_issues > value - (maxIssues / chartHeight)) {
          chart += chalk.gray('░');
        } else {
          chart += ' ';
        }
      } else {
        chart += ' ';
      }
    }
    chart += '\n';
  }

  chart += chalk.gray('    └' + '─'.repeat(chartWidth) + '\n');
  chart += chalk.gray('     ');
  
  // Add date labels
  if (data.length > 0) {
    const startDate = new Date(data[0].date);
    const endDate = new Date(data[data.length - 1].date);
    chart += `${startDate.getMonth() + 1}/${startDate.getDate()}`;
    chart += ' '.repeat(Math.max(0, chartWidth - 12));
    chart += `${endDate.getMonth() + 1}/${endDate.getDate()}`;
  }
  
  chart += '\n\n';
  chart += chalk.gray('Legend: ') + chalk.blue('█') + chalk.gray(' Actual  ') + chalk.gray('░') + chalk.gray(' Ideal');
  
  return chart;
}

function formatForecastSection(forecast: any, milestone: any): string {
  let output = '';
  
  output += chalk.bold.cyan('🔮 Completion Forecast\n');
  output += chalk.gray('─'.repeat(30)) + '\n';
  output += `${chalk.bold('Current velocity:')} ${forecast.current_velocity_per_day} issues/day\n`;
  output += `${chalk.bold('Remaining issues:')} ${forecast.open_issues_remaining}\n`;
  output += `${chalk.bold('Confidence:')} ${forecast.confidence}\n`;
  
  if (forecast.estimated_completion_date) {
    output += `${chalk.bold('Estimated completion:')} ${forecast.estimated_completion_date}\n`;
    
    if (forecast.due_date) {
      const status = forecast.on_track 
        ? chalk.green('✓ On track') 
        : chalk.red('⚠ Behind schedule');
      output += `${chalk.bold('Status:')} ${status}\n`;
      
      if (forecast.days_ahead_behind !== undefined) {
        const diff = forecast.days_ahead_behind;
        if (diff > 0) {
          output += `${chalk.bold('Days behind:')} ${chalk.red(diff.toString())}\n`;
        } else if (diff < 0) {
          output += `${chalk.bold('Days ahead:')} ${chalk.green(Math.abs(diff).toString())}\n`;
        }
      }
    }
  } else {
    output += `${chalk.bold('Estimated completion:')} ${chalk.gray('Unable to calculate')}\n`;
    output += `${chalk.gray('(Insufficient recent activity for reliable forecast)')}\n`;
  }
  
  return output;
}

function generateProgressBar(percentage: number, width: number = 30): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  return `[${bar}]`;
}

function generateInsights(progress: any, milestone: any, issues: any[], forecast: any): string[] {
  const insights = [];
  
  // Progress insights
  if (progress.summary.completion_percentage >= 90) {
    insights.push('Milestone is nearly complete! Consider planning closure and next steps.');
  } else if (progress.summary.completion_percentage >= 75) {
    insights.push('Good progress! Milestone is on the home stretch.');
  } else if (progress.summary.completion_percentage < 25) {
    insights.push('Early stage milestone. Consider breaking down large issues for better visibility.');
  }
  
  // Velocity insights
  if (progress.velocity.issues_per_day < 0.3) {
    insights.push('Low velocity detected. Review issue complexity and team capacity.');
  } else if (progress.velocity.issues_per_day > 2) {
    insights.push('High velocity! Team is performing well on this milestone.');
  }
  
  // Due date insights
  if (progress.timeline.is_overdue) {
    insights.push(`Milestone is ${progress.timeline.days_overdue} days overdue. Consider scope adjustment.`);
  } else if (progress.timeline.days_until_due && progress.timeline.days_until_due <= 3) {
    insights.push('Due date is approaching soon. Focus on high-priority issues.');
  }
  
  // Assignment insights
  const unassignedIssues = issues.filter(issue => issue.state === 'open' && !issue.assignee).length;
  if (unassignedIssues > progress.summary.open_issues * 0.3) {
    insights.push(`${unassignedIssues} open issues lack assignees. Consider assigning owners.`);
  }
  
  // Forecast insights
  if (forecast && forecast.on_track === false) {
    insights.push('Current velocity suggests milestone may miss deadline. Consider scope reduction.');
  }
  
  // Default insight
  if (insights.length === 0) {
    insights.push('Milestone progress looks healthy. Keep up the good work!');
  }
  
  return insights;
}

function parsePeriod(period: string): number {
  if (period === 'all') {
    return 365 * 24 * 60 * 60 * 1000; // 1 year
  }
  
  const match = period.match(/^(\d+)([dwmy])$/);
  if (!match) {
    throw new Error('Invalid period format. Use format like "7d", "30d", etc.');
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

// Export for use in other commands
export { handleMilestoneProgress };