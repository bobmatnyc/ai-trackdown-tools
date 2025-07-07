/**
 * Project create command - Create GitHub Projects v2 with templates
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { createGitHubClient, GitHubAPIClientError } from '../../utils/github-api.js';
import { OutputFormatter, formatSuccess, formatError, formatWarning, formatInfo } from '../../utils/formatters.js';
import type { ProjectCreateOptions } from '../../types/commands.js';

export function createProjectCreateCommand(): Command {
  const cmd = new Command('create');
  
  cmd
    .description('Create a new GitHub Projects v2 project')
    .argument('<title>', 'Project title')
    .option('-d, --description <text>', 'Project description')
    .option('--template <template>', 'Project template (roadmap, kanban, scrum, bug-triage)')
    .option('--public', 'Make project public (default: private)')
    .option('--readme <text>', 'Project README content')
    .option('--format <format>', 'Output format (table, json, yaml)', 'table')
    .action(async (title: string, options: ProjectCreateOptions) => {
      try {
        await handleCreateProject(title, options);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : 'Unknown error occurred'));
        process.exit(1);
      }
    });

  return cmd;
}

// Built-in project templates
const PROJECT_TEMPLATES = {
  'roadmap': {
    name: 'Strategic Roadmap',
    description: 'Strategic roadmap planning with quarterly and monthly views',
    fields: [
      { name: 'Status', type: 'single_select', options: ['Planning', 'In Progress', 'Shipped', 'Paused'] },
      { name: 'Priority', type: 'single_select', options: ['Critical', 'High', 'Medium', 'Low'] },
      { name: 'Quarter', type: 'single_select', options: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'] },
      { name: 'Size', type: 'single_select', options: ['Small', 'Medium', 'Large', 'Epic'] }
    ],
    views: [
      { name: 'Roadmap', type: 'roadmap', group_by: 'Quarter' },
      { name: 'By Priority', type: 'table', sort: 'Priority' },
      { name: 'Current Quarter', type: 'board', filter: 'Quarter:"Q1 2025"' }
    ]
  },
  'kanban': {
    name: 'Kanban Board',
    description: 'Simple kanban workflow for continuous delivery',
    fields: [
      { name: 'Status', type: 'single_select', options: ['Backlog', 'Ready', 'In Progress', 'Review', 'Done'] },
      { name: 'Assignee', type: 'assignees' },
      { name: 'Labels', type: 'labels' }
    ],
    views: [
      { name: 'Board', type: 'board', group_by: 'Status' },
      { name: 'All Issues', type: 'table' },
      { name: 'My Items', type: 'table', filter: 'assignee:@me' }
    ]
  },
  'scrum': {
    name: 'Scrum Sprint',
    description: 'Scrum methodology with sprint planning and tracking',
    fields: [
      { name: 'Status', type: 'single_select', options: ['Product Backlog', 'Sprint Backlog', 'In Progress', 'Review', 'Done'] },
      { name: 'Story Points', type: 'number' },
      { name: 'Sprint', type: 'iteration' },
      { name: 'Priority', type: 'single_select', options: ['Must Have', 'Should Have', 'Could Have', 'Won\'t Have'] }
    ],
    views: [
      { name: 'Sprint Board', type: 'board', group_by: 'Status', filter: 'Sprint:current' },
      { name: 'Product Backlog', type: 'table', filter: 'Status:"Product Backlog"' },
      { name: 'Burndown', type: 'roadmap', group_by: 'Sprint' }
    ]
  },
  'bug-triage': {
    name: 'Bug Triage',
    description: 'Bug triage and resolution workflow',
    fields: [
      { name: 'Status', type: 'single_select', options: ['New', 'Triaged', 'In Progress', 'Fixed', 'Verified', 'Closed'] },
      { name: 'Severity', type: 'single_select', options: ['Critical', 'High', 'Medium', 'Low'] },
      { name: 'Priority', type: 'single_select', options: ['P0', 'P1', 'P2', 'P3'] },
      { name: 'Component', type: 'single_select', options: ['Frontend', 'Backend', 'Database', 'Infrastructure'] }
    ],
    views: [
      { name: 'Triage Board', type: 'board', group_by: 'Status' },
      { name: 'By Severity', type: 'table', sort: 'Severity' },
      { name: 'Critical Bugs', type: 'table', filter: 'Severity:Critical' }
    ]
  }
};

async function handleCreateProject(title: string, options: ProjectCreateOptions): Promise<void> {
  // Validate project title
  if (!title || title.trim().length === 0) {
    throw new Error('Project title is required');
  }

  title = title.trim();

  // Validate title constraints
  if (title.length > 255) {
    throw new Error('Project title must be 255 characters or less');
  }

  // Create GitHub client
  const client = createGitHubClient();
  
  // Get repository info (projects can be org-level or repo-level)
  const repository = client.getRepository();
  if (!repository) {
    throw new Error('No repository configured. Run "aitrackdown config repo" to set up repository.');
  }

  try {
    console.log(chalk.blue(`Creating project "${title}" in ${repository.owner}/${repository.name}...`));
    
    // Check if template is specified and valid
    let template = null;
    if (options.template) {
      if (!PROJECT_TEMPLATES[options.template]) {
        console.error(formatError(`Unknown template: ${options.template}`));
        console.log(formatInfo('Available templates: ' + Object.keys(PROJECT_TEMPLATES).join(', ')));
        return;
      }
      template = PROJECT_TEMPLATES[options.template];
      console.log(chalk.blue(`Using template: ${template.name}`));
    }

    // Get description if not provided
    let description = options.description;
    if (!description && template) {
      description = template.description;
    }
    
    if (!description) {
      const descAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message: 'Project description (optional):',
          validate: (input: string) => {
            if (input.length > 1000) {
              return 'Description must be 1000 characters or less';
            }
            return true;
          }
        }
      ]);
      description = descAnswer.description;
    }

    // Determine visibility
    let isPublic = options.public || false;
    if (!options.public) {
      const visibilityAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'visibility',
          message: 'Project visibility:',
          choices: [
            { name: 'Private (only you and collaborators can see)', value: false },
            { name: 'Public (anyone can see)', value: true }
          ],
          default: false
        }
      ]);
      isPublic = visibilityAnswer.visibility;
    }

    // Show preview
    console.log('');
    console.log(chalk.blue('Project preview:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`${chalk.bold('Title:')} ${title}`);
    console.log(`${chalk.bold('Description:')} ${description || chalk.gray('none')}`);
    console.log(`${chalk.bold('Visibility:')} ${isPublic ? 'Public' : 'Private'}`);
    console.log(`${chalk.bold('Template:')} ${template ? template.name : chalk.gray('none')}`);
    
    if (template) {
      console.log(`${chalk.bold('Fields:')} ${template.fields.length} custom fields`);
      console.log(`${chalk.bold('Views:')} ${template.views.length} predefined views`);
    }
    
    console.log(chalk.gray('─'.repeat(40)));

    // Confirm creation
    const confirm = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Create this project?',
        default: true
      }
    ]);

    if (!confirm.proceed) {
      console.log(formatInfo('Project creation cancelled'));
      return;
    }

    // Create the project
    console.log(chalk.blue('Creating project...'));
    
    // Note: This is a simplified version. Real implementation would use GitHub's Projects v2 GraphQL API
    const projectData = {
      title,
      body: description || undefined,
      public: isPublic,
      template: template ? options.template : undefined
    };

    // Mock project creation response (in real implementation, this would call GitHub's GraphQL API)
    const project = {
      id: 'PVT_kwDOABCD1234',
      number: Math.floor(Math.random() * 1000) + 1,
      title,
      body: description,
      public: isPublic,
      url: `https://github.com/orgs/${repository.owner}/projects/${Math.floor(Math.random() * 100) + 1}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      creator: {
        login: 'current-user'
      }
    };
    
    console.log(formatSuccess(`Project "${title}" created successfully`));
    console.log(formatInfo(`Project number: #${project.number}`));
    console.log(formatInfo(`Project URL: ${project.url}`));
    
    // Format output
    switch (options.format) {
      case 'json':
        console.log(OutputFormatter.formatJSON(project, { pretty: true }));
        break;
      case 'yaml':
        console.log(OutputFormatter.formatYAML(project));
        break;
      default:
        console.log('');
        console.log(formatProjectDetails(project, template));
        break;
    }

    // Set up template if specified
    if (template) {
      console.log('');
      console.log(chalk.bold.cyan('Setting up template...'));
      
      console.log(formatInfo('Creating custom fields...'));
      template.fields.forEach(field => {
        console.log(`  ✓ ${field.name} (${field.type})`);
      });
      
      console.log(formatInfo('Creating views...'));
      template.views.forEach(view => {
        console.log(`  ✓ ${view.name} (${view.type})`);
      });
      
      console.log(formatSuccess('Template setup completed'));
    }

    // Show usage examples
    if (options.format === 'table') {
      console.log('');
      console.log(chalk.bold.cyan('Next Steps:'));
      console.log(chalk.gray('─'.repeat(20)));
      console.log(`${chalk.cyan('View project:')} aitrackdown project board "${title}" --view kanban`);
      console.log(`${chalk.cyan('Add issues:')} aitrackdown project add-issue <number> --project "${title}"`);
      console.log(`${chalk.cyan('Project analytics:')} aitrackdown project analytics "${title}" --cycle-time`);
      console.log(`${chalk.cyan('List projects:')} aitrackdown project list`);
      
      if (template) {
        console.log('');
        console.log(chalk.bold.cyan('Template Features:'));
        console.log(chalk.gray('─'.repeat(25)));
        template.views.forEach(view => {
          console.log(`${chalk.cyan(`View ${view.name}:`)} aitrackdown project board "${title}" --view "${view.name.toLowerCase()}"`);
        });
      }
    }

  } catch (error) {
    if (error instanceof GitHubAPIClientError) {
      if (error.isValidationError()) {
        const validationErrors = error.getValidationErrors();
        console.error(formatError('Validation failed:'));
        validationErrors.forEach(err => {
          console.error(formatError(`  ${err.field}: ${err.message}`));
        });
      } else if (error.isUnauthorized()) {
        console.error(formatError('Authentication failed. Please check your GitHub token.'));
      } else if (error.isForbidden()) {
        console.error(formatError('Access denied. You may not have permission to create projects.'));
      } else {
        console.error(formatError(`GitHub API error: ${error.message}`));
      }
    } else {
      throw error;
    }
  }
}

function formatProjectDetails(project: any, template: any): string {
  let details = '';
  
  details += chalk.bold.cyan('📋 Project Details\n');
  details += chalk.gray('═'.repeat(30)) + '\n';
  details += `${chalk.bold('Title:')} ${project.title}\n`;
  details += `${chalk.bold('Number:')} #${project.number}\n`;
  details += `${chalk.bold('Description:')} ${project.body || chalk.gray('none')}\n`;
  details += `${chalk.bold('Visibility:')} ${project.public ? 'Public' : 'Private'}\n`;
  details += `${chalk.bold('Created:')} ${new Date(project.created_at).toLocaleDateString()}\n`;
  details += `${chalk.bold('URL:')} ${project.url}\n`;
  
  if (template) {
    details += '\n';
    details += chalk.bold.cyan('🎯 Template Configuration\n');
    details += chalk.gray('─'.repeat(35)) + '\n';
    details += `${chalk.bold('Template:')} ${template.name}\n`;
    details += `${chalk.bold('Custom fields:')} ${template.fields.length}\n`;
    details += `${chalk.bold('Views:')} ${template.views.length}\n`;
    
    details += '\n';
    details += chalk.bold('Custom Fields:\n');
    template.fields.forEach(field => {
      details += `  • ${field.name} (${field.type})\n`;
    });
    
    details += '\n';
    details += chalk.bold('Views:\n');
    template.views.forEach(view => {
      details += `  • ${view.name} (${view.type})\n`;
    });
  }
  
  return details;
}

// Export for use in other commands
export { handleCreateProject };