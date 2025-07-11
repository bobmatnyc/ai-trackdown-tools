/**
 * Universal Ticketing Interface for Health Monitoring
 * Provides a unified interface for aggregating ticket data across different commands
 * and ensuring real-time monitoring capabilities
 */

import { RelationshipManager } from './relationship-manager.js';
import { ConfigManager } from './config-manager.js';
import { Formatter } from './formatter.js';
import type { EpicData, IssueData, TaskData, ProjectConfig } from '../types/ai-trackdown.js';

export interface TicketCounts {
  epics: number;
  issues: number;
  tasks: number;
  total: number;
}

export interface TicketHealthMetrics {
  counts: TicketCounts;
  statusBreakdown: {
    planning: number;
    active: number;
    completed: number;
    blocked: number;
  };
  priorityBreakdown: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  recentActivity: {
    updatedLastWeek: number;
    createdLastWeek: number;
  };
  completionRate: number;
  lastUpdated: Date;
}

export interface TicketData {
  epics: EpicData[];
  issues: IssueData[];
  tasks: TaskData[];
}

export class UniversalTicketingInterface {
  private relationshipManager: RelationshipManager;
  private config: ProjectConfig;
  private lastCacheUpdate: number = 0;
  private cacheExpiry: number = 60000; // 1 minute cache for health monitoring

  constructor(config?: ProjectConfig, projectRoot?: string, cliTasksDir?: string) {
    if (!config) {
      const configManager = new ConfigManager(projectRoot);
      this.config = configManager.getConfig();
    } else {
      this.config = config;
    }
    
    this.relationshipManager = new RelationshipManager(this.config, projectRoot, cliTasksDir);
  }

  /**
   * Get accurate ticket counts using the same logic as individual commands
   */
  public getTicketCounts(): TicketCounts {
    const epics = this.relationshipManager.getAllEpics();
    const issues = this.relationshipManager.getAllIssues();
    const tasks = this.relationshipManager.getAllTasks();

    return {
      epics: epics.length,
      issues: issues.length,
      tasks: tasks.length,
      total: epics.length + issues.length + tasks.length
    };
  }

  /**
   * Get all ticket data for further processing
   */
  public getAllTicketData(): TicketData {
    return {
      epics: this.relationshipManager.getAllEpics(),
      issues: this.relationshipManager.getAllIssues(),
      tasks: this.relationshipManager.getAllTasks()
    };
  }

  /**
   * Get comprehensive health metrics
   */
  public getHealthMetrics(): TicketHealthMetrics {
    const data = this.getAllTicketData();
    const allItems = [...data.epics, ...data.issues, ...data.tasks];
    
    // Calculate status breakdown
    const statusBreakdown = {
      planning: 0,
      active: 0,
      completed: 0,
      blocked: 0
    };

    // Calculate priority breakdown
    const priorityBreakdown = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    // Calculate recent activity
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    let updatedLastWeek = 0;
    let createdLastWeek = 0;

    for (const item of allItems) {
      // Status breakdown
      switch (item.status) {
        case 'planning':
          statusBreakdown.planning++;
          break;
        case 'active':
          statusBreakdown.active++;
          break;
        case 'completed':
          statusBreakdown.completed++;
          break;
        case 'blocked':
          statusBreakdown.blocked++;
          break;
      }

      // Priority breakdown
      switch (item.priority) {
        case 'low':
          priorityBreakdown.low++;
          break;
        case 'medium':
          priorityBreakdown.medium++;
          break;
        case 'high':
          priorityBreakdown.high++;
          break;
        case 'critical':
          priorityBreakdown.critical++;
          break;
      }

      // Recent activity
      const updatedDate = new Date(item.updated_date);
      const createdDate = new Date(item.created_date);
      
      if (updatedDate >= lastWeek) {
        updatedLastWeek++;
      }
      if (createdDate >= lastWeek) {
        createdLastWeek++;
      }
    }

    const completionRate = allItems.length > 0 
      ? Math.round((statusBreakdown.completed / allItems.length) * 100)
      : 0;

    return {
      counts: this.getTicketCounts(),
      statusBreakdown,
      priorityBreakdown,
      recentActivity: {
        updatedLastWeek,
        createdLastWeek
      },
      completionRate,
      lastUpdated: new Date()
    };
  }

  /**
   * Display health metrics in a formatted way
   */
  public displayHealthMetrics(): void {
    const metrics = this.getHealthMetrics();
    
    console.log(Formatter.header('🎯 Universal Ticketing Interface - Health Monitoring'));
    console.log('');
    
    // Ticket counts
    console.log(Formatter.subheader('📊 Ticket Counts'));
    console.log(`   📋 Epics: ${Formatter.highlight(metrics.counts.epics.toString())}`);
    console.log(`   🐛 Issues: ${Formatter.highlight(metrics.counts.issues.toString())}`);
    console.log(`   ✅ Tasks: ${Formatter.highlight(metrics.counts.tasks.toString())}`);
    console.log(`   🔢 Total: ${Formatter.highlight(metrics.counts.total.toString())}`);
    console.log('');
    
    // Status breakdown
    console.log(Formatter.subheader('🎯 Status Breakdown'));
    console.log(`   📝 Planning: ${metrics.statusBreakdown.planning}`);
    console.log(`   🔄 Active: ${metrics.statusBreakdown.active}`);
    console.log(`   ✅ Completed: ${metrics.statusBreakdown.completed}`);
    console.log(`   🚫 Blocked: ${metrics.statusBreakdown.blocked}`);
    console.log('');
    
    // Priority breakdown
    console.log(Formatter.subheader('⚡ Priority Distribution'));
    console.log(`   🔴 Critical: ${metrics.priorityBreakdown.critical}`);
    console.log(`   🟠 High: ${metrics.priorityBreakdown.high}`);
    console.log(`   🟡 Medium: ${metrics.priorityBreakdown.medium}`);
    console.log(`   🟢 Low: ${metrics.priorityBreakdown.low}`);
    console.log('');
    
    // Health indicators
    console.log(Formatter.subheader('🏥 Health Indicators'));
    console.log(`   📈 Completion Rate: ${Formatter.highlight(`${metrics.completionRate}%`)}`);
    console.log(`   🔄 Recent Activity: ${metrics.recentActivity.updatedLastWeek} updated, ${metrics.recentActivity.createdLastWeek} created (last 7 days)`);
    console.log(`   ⏰ Last Updated: ${metrics.lastUpdated.toLocaleString()}`);
    console.log('');
    
    // Health alerts
    this.displayHealthAlerts(metrics);
  }

  /**
   * Display health alerts based on metrics
   */
  private displayHealthAlerts(metrics: TicketHealthMetrics): void {
    const alerts = [];
    
    // Check for high number of blocked items
    if (metrics.statusBreakdown.blocked > 3) {
      alerts.push(`⚠️ High number of blocked items: ${metrics.statusBreakdown.blocked}`);
    }
    
    // Check for low completion rate
    if (metrics.completionRate < 10 && metrics.counts.total > 10) {
      alerts.push(`⚠️ Low completion rate: ${metrics.completionRate}%`);
    }
    
    // Check for high critical priority items
    if (metrics.priorityBreakdown.critical > 5) {
      alerts.push(`🚨 High number of critical items: ${metrics.priorityBreakdown.critical}`);
    }
    
    // Check for stale items (low recent activity)
    if (metrics.recentActivity.updatedLastWeek < Math.ceil(metrics.counts.total * 0.1)) {
      alerts.push(`⏰ Low recent activity: only ${metrics.recentActivity.updatedLastWeek} items updated in last 7 days`);
    }
    
    if (alerts.length > 0) {
      console.log(Formatter.subheader('🚨 Health Alerts'));
      alerts.forEach(alert => {
        console.log(`   ${alert}`);
      });
      console.log('');
    } else {
      console.log(Formatter.success('✅ All health indicators are within normal ranges'));
      console.log('');
    }
  }

  /**
   * Get real-time monitoring data (with caching)
   */
  public getMonitoringData(): TicketHealthMetrics {
    const now = Date.now();
    if (now - this.lastCacheUpdate > this.cacheExpiry) {
      this.relationshipManager.rebuildCache();
      this.lastCacheUpdate = now;
    }
    
    return this.getHealthMetrics();
  }

  /**
   * Lifecycle management methods
   */
  public refreshData(): void {
    this.relationshipManager.rebuildCache();
    this.lastCacheUpdate = Date.now();
  }

  /**
   * Get epic-specific metrics
   */
  public getEpicMetrics(): { 
    total: number; 
    active: number; 
    completed: number; 
    averageCompletion: number 
  } {
    const epics = this.relationshipManager.getAllEpics();
    const active = epics.filter(epic => epic.status === 'active').length;
    const completed = epics.filter(epic => epic.status === 'completed').length;
    const averageCompletion = epics.length > 0 
      ? Math.round(epics.reduce((sum, epic) => sum + (epic.completion_percentage || 0), 0) / epics.length)
      : 0;

    return {
      total: epics.length,
      active,
      completed,
      averageCompletion
    };
  }

  /**
   * Get issue-specific metrics
   */
  public getIssueMetrics(): {
    total: number;
    byEpic: Record<string, number>;
    unassigned: number;
    highPriority: number;
  } {
    const issues = this.relationshipManager.getAllIssues();
    const byEpic: Record<string, number> = {};
    let unassigned = 0;
    let highPriority = 0;

    for (const issue of issues) {
      // Count by epic
      if (issue.epic_id) {
        byEpic[issue.epic_id] = (byEpic[issue.epic_id] || 0) + 1;
      }

      // Count unassigned
      if (!issue.assignee || issue.assignee === 'unassigned') {
        unassigned++;
      }

      // Count high priority
      if (issue.priority === 'high' || issue.priority === 'critical') {
        highPriority++;
      }
    }

    return {
      total: issues.length,
      byEpic,
      unassigned,
      highPriority
    };
  }

  /**
   * Get task-specific metrics
   */
  public getTaskMetrics(): {
    total: number;
    byIssue: Record<string, number>;
    standalone: number;
    estimatedVsActual: { estimated: number; actual: number };
  } {
    const tasks = this.relationshipManager.getAllTasks();
    const byIssue: Record<string, number> = {};
    let standalone = 0;
    let totalEstimated = 0;
    let totalActual = 0;

    for (const task of tasks) {
      // Count by issue
      if (task.issue_id) {
        byIssue[task.issue_id] = (byIssue[task.issue_id] || 0) + 1;
      } else {
        standalone++;
      }

      // Sum estimates
      if (task.estimated_tokens) {
        totalEstimated += task.estimated_tokens;
      }
      if (task.actual_tokens) {
        totalActual += task.actual_tokens;
      }
    }

    return {
      total: tasks.length,
      byIssue,
      standalone,
      estimatedVsActual: {
        estimated: totalEstimated,
        actual: totalActual
      }
    };
  }
}