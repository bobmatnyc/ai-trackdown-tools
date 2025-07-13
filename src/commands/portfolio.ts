/**
 * Portfolio Command
 * Provides portfolio-wide status reporting across multiple ai-trackdown projects
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Command } from 'commander';
import type { EpicData, IssueData, ProjectConfig, TaskData } from '../types/ai-trackdown.js';
import { ConfigManager } from '../utils/config-manager.js';
import { Formatter } from '../utils/formatter.js';
import { FrontmatterParser } from '../utils/frontmatter-parser.js';

interface PortfolioOptions {
  format?: 'table' | 'json' | 'markdown';
  directory?: string;
  health?: boolean;
  summary?: boolean;
}

interface ProjectSummary {
  name: string;
  path: string;
  config: ProjectConfig | null;
  epics: number;
  issues: number;
  tasks: number;
  status: 'healthy' | 'warning' | 'error';
  lastUpdated: string;
}

export function createPortfolioCommand(): Command {
  const cmd = new Command('portfolio');

  cmd
    .description('Portfolio-wide status reporting across multiple ai-trackdown projects')
    .option('--format <format>', 'output format (table, json, markdown)', 'table')
    .option('--directory <path>', 'root directory to scan for projects', '.')
    .option('--health', 'focus on project health monitoring')
    .option('--summary', 'show summary statistics only')
    .action(async (options: PortfolioOptions) => {
      try {
        await showPortfolio(options);
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to show portfolio: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return cmd;
}

async function showPortfolio(options: PortfolioOptions): Promise<void> {
  console.log(Formatter.info('🏢 AI-Trackdown Portfolio Status'));
  console.log('='.repeat(60));

  const scanDirectory = path.resolve(options.directory || '.');
  const projects = await findAiTrackdownProjects(scanDirectory);

  if (projects.length === 0) {
    console.log(Formatter.warning('No AI-Trackdown projects found'));
    return;
  }

  const projectSummaries: ProjectSummary[] = [];

  for (const project of projects) {
    try {
      const summary = await analyzeProject(project);
      projectSummaries.push(summary);
    } catch (_error) {
      projectSummaries.push({
        name: path.basename(project),
        path: project,
        config: null,
        epics: 0,
        issues: 0,
        tasks: 0,
        status: 'error',
        lastUpdated: 'unknown',
      });
    }
  }

  if (options.format === 'json') {
    console.log(JSON.stringify(projectSummaries, null, 2));
    return;
  }

  // Display portfolio summary
  displayPortfolioSummary(projectSummaries, options);
}

async function findAiTrackdownProjects(rootDir: string): Promise<string[]> {
  const projects: string[] = [];

  function scanDir(dir: string, depth: number = 0): void {
    if (depth > 3) return; // Limit scan depth

    try {
      const items = fs.readdirSync(dir);

      // Check if current directory is an ai-trackdown project
      if (items.includes('.ai-trackdown')) {
        projects.push(dir);
        return; // Don't scan subdirectories of ai-trackdown projects
      }

      // Scan subdirectories
      for (const item of items) {
        if (item.startsWith('.') && item !== '.ai-trackdown') continue;

        const itemPath = path.join(dir, item);
        try {
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory()) {
            scanDir(itemPath, depth + 1);
          }
        } catch (_error) {
          // Skip inaccessible directories
        }
      }
    } catch (_error) {
      // Skip inaccessible directories
    }
  }

  scanDir(rootDir);
  return projects;
}

async function analyzeProject(projectPath: string): Promise<ProjectSummary> {
  const configManager = new ConfigManager(projectPath);
  const parser = new FrontmatterParser();

  let config: ProjectConfig | null = null;
  let status: 'healthy' | 'warning' | 'error' = 'healthy';

  try {
    config = configManager.getConfig();
  } catch (_error) {
    status = 'error';
  }

  const paths = configManager.getAbsolutePaths();

  let epics = 0;
  let issues = 0;
  let tasks = 0;
  let lastUpdated = 'never';

  try {
    // Count epics
    const epicData = parser.parseDirectory(paths.epicsDir, 'epic') as EpicData[];
    epics = epicData.length;

    // Count issues
    const issueData = parser.parseDirectory(paths.issuesDir, 'issue') as IssueData[];
    issues = issueData.length;

    // Count tasks
    const taskData = parser.parseDirectory(paths.tasksDir, 'task') as TaskData[];
    tasks = taskData.length;

    // Find most recent update
    const allItems = [...epicData, ...issueData, ...taskData];
    if (allItems.length > 0) {
      const dates = allItems
        .map((item) => item.updated_date)
        .filter((date) => date)
        .sort()
        .reverse();

      if (dates.length > 0) {
        lastUpdated = new Date(dates[0]).toLocaleDateString();
      }
    }

    // Health check
    if (epics === 0 && issues === 0 && tasks === 0) {
      status = 'warning';
    }
  } catch (_error) {
    status = 'error';
  }

  return {
    name: config?.project_name || path.basename(projectPath),
    path: projectPath,
    config,
    epics,
    issues,
    tasks,
    status,
    lastUpdated,
  };
}

function displayPortfolioSummary(projects: ProjectSummary[], options: PortfolioOptions): void {
  console.log(Formatter.info(`📊 Found ${projects.length} AI-Trackdown project(s)`));
  console.log('');

  // Overall statistics
  const totalEpics = projects.reduce((sum, p) => sum + p.epics, 0);
  const totalIssues = projects.reduce((sum, p) => sum + p.issues, 0);
  const totalTasks = projects.reduce((sum, p) => sum + p.tasks, 0);
  const healthyProjects = projects.filter((p) => p.status === 'healthy').length;
  const warningProjects = projects.filter((p) => p.status === 'warning').length;
  const errorProjects = projects.filter((p) => p.status === 'error').length;

  console.log(Formatter.success(`📈 Portfolio Overview:`));
  console.log(Formatter.info(`   Total Items: ${totalEpics + totalIssues + totalTasks}`));
  console.log(
    Formatter.info(`   Epics: ${totalEpics} | Issues: ${totalIssues} | Tasks: ${totalTasks}`)
  );
  console.log(
    Formatter.info(
      `   Health: ${healthyProjects} healthy, ${warningProjects} warnings, ${errorProjects} errors`
    )
  );
  console.log('');

  if (options.summary) {
    return;
  }

  // Individual project details
  console.log(Formatter.success('📋 Project Details:'));
  console.log('');

  for (const project of projects) {
    const statusIcon = getStatusIcon(project.status);
    const statusColor = getStatusColor(project.status);

    console.log(statusColor(`${statusIcon} ${project.name}`));
    console.log(Formatter.debug(`   Path: ${project.path}`));
    console.log(
      Formatter.debug(
        `   Items: ${project.epics} epics, ${project.issues} issues, ${project.tasks} tasks`
      )
    );
    console.log(Formatter.debug(`   Last Updated: ${project.lastUpdated}`));

    if (options.health && project.status !== 'healthy') {
      console.log(Formatter.warning(`   ⚠️  Status: ${project.status}`));
    }

    console.log('');
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'healthy':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'error':
      return '❌';
    default:
      return '❓';
  }
}

function getStatusColor(status: string): (text: string) => string {
  switch (status) {
    case 'healthy':
      return Formatter.success;
    case 'warning':
      return Formatter.warning;
    case 'error':
      return Formatter.error;
    default:
      return Formatter.info;
  }
}
