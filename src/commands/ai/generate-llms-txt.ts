/**
 * AI Generate LLMs.txt Command
 * Generates llms.txt file from project structure
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../../utils/config-manager.js';
import { RelationshipManager } from '../../utils/relationship-manager.js';
import { Formatter } from '../../utils/formatter.js';

interface GenerateOptions {
  output?: string;
  includeContent?: boolean;
  includeCompleted?: boolean;
  format?: 'standard' | 'detailed' | 'summary';
  dryRun?: boolean;
}

export function createAiGenerateLlmsCommand(): Command {
  const cmd = new Command('generate-llms-txt');
  
  cmd
    .description('Generate llms.txt file from project structure')
    .option('-o, --output <path>', 'output file path', 'llms.txt')
    .option('--include-content', 'include full content in output')
    .option('--include-completed', 'include completed items')
    .option('-f, --format <type>', 'output format (standard|detailed|summary)', 'standard')
    .option('--dry-run', 'show what would be generated without creating file')
    .action(async (options: GenerateOptions) => {
      try {
        await generateLlmsTxt(options);
      } catch (error) {
        console.error(Formatter.error(`Failed to generate llms.txt: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return cmd;
}

async function generateLlmsTxt(options: GenerateOptions): Promise<void> {
  const configManager = new ConfigManager();
  const config = configManager.getConfig();
  const relationshipManager = new RelationshipManager(config);
  
  // Get project overview
  const overview = relationshipManager.getProjectOverview();
  
  // Get all items
  const searchResult = relationshipManager.search({});
  const allItems = searchResult.items;
  
  // Filter items based on options
  let filteredItems = allItems;
  if (!options.includeCompleted) {
    filteredItems = allItems.filter(item => item.status !== 'completed');
  }
  
  // Separate by type
  const epics = filteredItems.filter(item => 'epic_id' in item && !('issue_id' in item));
  const issues = filteredItems.filter(item => 'issue_id' in item && !('task_id' in item));
  const tasks = filteredItems.filter(item => 'task_id' in item);
  
  // Generate content based on format
  let content = '';
  
  switch (options.format) {
    case 'summary':
      content = generateSummaryFormat(config, overview, epics, issues, tasks);
      break;
    case 'detailed':
      content = generateDetailedFormat(config, overview, epics, issues, tasks, options.includeContent);
      break;
    default:
      content = generateStandardFormat(config, overview, epics, issues, tasks);
  }
  
  if (options.dryRun) {
    console.log(Formatter.info('Dry run - Generated llms.txt content:'));
    console.log('');
    console.log(content);
    console.log('');
    console.log(Formatter.info(`Content length: ${content.length} characters`));
    return;
  }
  
  // Write to file
  const outputPath = path.resolve(options.output || 'llms.txt');
  fs.writeFileSync(outputPath, content, 'utf8');
  
  console.log(Formatter.success(`llms.txt generated successfully!`));
  console.log(Formatter.info(`Output: ${outputPath}`));
  console.log(Formatter.info(`Format: ${options.format || 'standard'}`));
  console.log(Formatter.info(`Content length: ${content.length} characters`));
  console.log(Formatter.info(`Items included: ${filteredItems.length} total`));
  console.log(`  • Epics: ${epics.length}`);
  console.log(`  • Issues: ${issues.length}`);
  console.log(`  • Tasks: ${tasks.length}`);
}

function generateSummaryFormat(config: any, overview: any, epics: any[], issues: any[], tasks: any[]): string {
  return `# ${config.name} - Project Summary

## Overview
- **Total Items**: ${overview.totals.epics + overview.totals.issues + overview.totals.tasks}
- **Completion Rate**: ${overview.completion_metrics.overall_completion}%
- **Generated**: ${new Date().toISOString()}

## Status Breakdown
${Object.entries(overview.status_breakdown).map(([status, count]) => 
  `- **${status.charAt(0).toUpperCase() + status.slice(1)}**: ${count}`
).join('\n')}

## Priority Breakdown
${Object.entries(overview.priority_breakdown).map(([priority, count]) => 
  `- **${priority.charAt(0).toUpperCase() + priority.slice(1)}**: ${count}`
).join('\n')}

## Active Items

### Epics (${epics.length})
${epics.map(epic => `- ${epic.epic_id}: ${epic.title} [${epic.status}]`).join('\n')}

### Issues (${issues.length})
${issues.map(issue => `- ${issue.issue_id}: ${issue.title} [${issue.status}]`).join('\n')}

### Tasks (${tasks.length})
${tasks.map(task => `- ${task.task_id}: ${task.title} [${task.status}]`).join('\n')}
`;
}

function generateStandardFormat(config: any, overview: any, epics: any[], issues: any[], tasks: any[]): string {
  let content = `# ${config.name} - AI Project Context

> Generated on ${new Date().toISOString()}
> AI-Trackdown project management system

## Project Statistics
- **Epics**: ${epics.length} active
- **Issues**: ${issues.length} active  
- **Tasks**: ${tasks.length} active
- **Overall Completion**: ${overview.completion_metrics.overall_completion}%

## Project Structure

`;

  // Group issues by epic
  const issuesByEpic = issues.reduce((acc, issue) => {
    if (!acc[issue.epic_id]) acc[issue.epic_id] = [];
    acc[issue.epic_id].push(issue);
    return acc;
  }, {} as Record<string, any[]>);

  // Group tasks by issue
  const tasksByIssue = tasks.reduce((acc, task) => {
    if (!acc[task.issue_id]) acc[task.issue_id] = [];
    acc[task.issue_id].push(task);
    return acc;
  }, {} as Record<string, any[]>);

  for (const epic of epics) {
    content += `### ${epic.epic_id}: ${epic.title}\n`;
    content += `**Status**: ${epic.status} | **Priority**: ${epic.priority} | **Assignee**: ${epic.assignee}\n`;
    if (epic.description) {
      content += `**Description**: ${epic.description}\n`;
    }
    content += '\n';

    const epicIssues = issuesByEpic[epic.epic_id] || [];
    for (const issue of epicIssues) {
      content += `#### ${issue.issue_id}: ${issue.title}\n`;
      content += `**Status**: ${issue.status} | **Priority**: ${issue.priority} | **Assignee**: ${issue.assignee}\n`;
      if (issue.description) {
        content += `**Description**: ${issue.description}\n`;
      }
      content += '\n';

      const issueTasks = tasksByIssue[issue.issue_id] || [];
      if (issueTasks.length > 0) {
        content += `**Tasks**:\n`;
        for (const task of issueTasks) {
          content += `- ${task.task_id}: ${task.title} [${task.status}]\n`;
        }
        content += '\n';
      }
    }
  }

  return content;
}

function generateDetailedFormat(config: any, overview: any, epics: any[], issues: any[], tasks: any[], includeContent: boolean = false): string {
  let content = generateStandardFormat(config, overview, epics, issues, tasks);
  
  if (includeContent) {
    content += '\n## Detailed Content\n\n';
    
    for (const epic of epics) {
      content += `### ${epic.epic_id} Content\n`;
      content += '```markdown\n';
      content += epic.content || '(No content)';
      content += '\n```\n\n';
    }
    
    for (const issue of issues) {
      content += `### ${issue.issue_id} Content\n`;
      content += '```markdown\n';
      content += issue.content || '(No content)';
      content += '\n```\n\n';
    }
    
    for (const task of tasks) {
      content += `### ${task.task_id} Content\n`;
      content += '```markdown\n';
      content += task.content || '(No content)';
      content += '\n```\n\n';
    }
  }
  
  // Add AI context information
  content += '\n## AI Context Templates\n\n';
  if (config.ai_context_templates && config.ai_context_templates.length > 0) {
    for (const template of config.ai_context_templates) {
      content += `- ${template}\n`;
    }
  } else {
    content += 'No AI context templates configured.\n';
  }
  
  // Add token usage summary
  content += '\n## Token Usage Summary\n\n';
  const totalEstimated = [...epics, ...issues, ...tasks].reduce((sum, item) => sum + (item.estimated_tokens || 0), 0);
  const totalActual = [...epics, ...issues, ...tasks].reduce((sum, item) => sum + (item.actual_tokens || 0), 0);
  
  content += `- **Total Estimated Tokens**: ${totalEstimated}\n`;
  content += `- **Total Actual Tokens**: ${totalActual}\n`;
  if (totalEstimated > 0) {
    content += `- **Token Efficiency**: ${((totalActual / totalEstimated) * 100).toFixed(1)}%\n`;
  }
  
  return content;
}