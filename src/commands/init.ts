/**
 * AI-Trackdown Init Command
 * Initialize new ai-trackdown projects with YAML frontmatter architecture
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { ConfigManager } from '../utils/config-manager.js';
import { AITrackdownIdGenerator } from '../utils/id-generator.js';
import { FrontmatterParser } from '../utils/frontmatter-parser.js';
import type { ProjectConfig } from '../types/ai-trackdown.js';
import * as fs from 'fs';
import * as path from 'path';

interface InitOptions {
  force?: boolean;
  interactive?: boolean;
  type?: string;
  assignee?: string;
  name?: string;
  tasksDirectory?: string; // NEW: Support for --tasks-dir option
}

export function createInitCommand(): Command {
  const command = new Command('init');

  command
    .description('Initialize a new AI-Trackdown project with hierarchical structure')
    .argument('[project-name]', 'name of the project')
    .option('--type <type>', 'project type (software, research, business, general)', 'general')
    .option('--assignee <assignee>', 'default assignee for items')
    .option('--tasks-directory <path>', 'root directory for all task types (default: tasks)', 'tasks')
    .option('--force', 'overwrite existing project')
    .option('--interactive', 'interactive setup mode')
    .addHelpText(
      'after',
      `
Examples:
  $ aitrackdown init my-project --type software
  $ aitrackdown init research-project --type research --interactive
  $ aitrackdown init --interactive
  $ aitrackdown init my-project --tasks-directory work

Project Types:
  software  - Software development projects
  research  - Research and analysis projects  
  business  - Business process and planning
  general   - General purpose projects

Directory Structure:
  Default structure with --tasks-directory "tasks":
    tasks/epics/, tasks/issues/, tasks/tasks/, tasks/templates/
  
  Custom structure with --tasks-directory "work":
    work/epics/, work/issues/, work/tasks/, work/templates/
`
    )
    .action(async (projectName?: string, options: InitOptions = {}) => {
      try {
        let config = {
          name: projectName,
          type: options.type || 'general',
          assignee: options.assignee || process.env.USER || 'unassigned',
          tasksDirectory: options.tasksDirectory || process.env.CLI_TASKS_DIR || 'tasks',
          force: options.force || false
        };

        // Interactive mode
        if (options.interactive || !projectName) {
          config = await runInteractiveSetup(config);
        }

        // Validate project name
        const projectNameValue = config.name || 'ai-trackdown-project';
        if (!/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/.test(projectNameValue)) {
          throw new Error('Project name must start with alphanumeric character and contain only letters, numbers, hyphens, and underscores');
        }

        const projectPath = path.resolve(process.cwd(), projectNameValue);

        // Check if project already exists
        if (fs.existsSync(projectPath) && !config.force) {
          console.error(`❌ Project "${projectNameValue}" already exists`);
          console.log('💡 Use --force to overwrite existing project');
          process.exit(1);
        }

        const spinner = ora('Initializing AI-Trackdown project...').start();

        try {
          // Create project directory
          if (!fs.existsSync(projectPath)) {
            fs.mkdirSync(projectPath, { recursive: true });
          }

          // Create ConfigManager and initialize project
          const configManager = new ConfigManager(projectPath);
          const projectConfig = configManager.createDefaultConfig(projectNameValue, {
            description: `AI-Trackdown ${config.type} project: ${projectNameValue}`,
            default_assignee: config.assignee,
            tasks_directory: config.tasksDirectory
          });

          spinner.text = 'Creating project structure...';
          
          // Initialize the project
          configManager.initializeProject(projectNameValue, projectConfig);

          spinner.text = 'Setting up ID generator...';

          // Initialize ID generator
          const idGenerator = new AITrackdownIdGenerator(projectConfig, projectPath);

          spinner.text = 'Creating example items...';

          // Create example epic, issue, and task
          await createExampleItems(projectPath, projectConfig, idGenerator);

          spinner.text = 'Creating documentation...';

          // Create README
          createProjectReadme(projectPath, projectNameValue, config.type, projectConfig);

          // Create .gitignore
          createGitignore(projectPath);

          spinner.succeed('AI-Trackdown project initialized successfully!');

          // Show success message
          console.log(`
🎉 AI-Trackdown project "${projectNameValue}" created successfully!

Project Type: ${config.type}
Location: ${projectPath}
Configuration: .ai-trackdown/config.yaml
Tasks Directory: ${config.tasksDirectory}/

📁 Project Structure (Unified Layout):
├── .ai-trackdown/          # Configuration and metadata
│   ├── config.yaml         # Project configuration
│   ├── counters.json       # ID counters
│   └── templates/          # Item templates  
├── ${config.tasksDirectory}/                # Tasks root directory
│   ├── epics/              # Epic-level planning
│   ├── issues/             # Issue-level work items
│   ├── tasks/              # Task-level activities
│   ├── prs/                # Pull request tracking
│   └── templates/          # Item templates
├── .gitignore             # Git ignore patterns
└── README.md              # Project documentation

🚀 Next Steps:
1. Navigate to your project:
   cd ${projectNameValue}

2. Explore the example items:
   ls ${config.tasksDirectory}/epics/ ${config.tasksDirectory}/issues/ ${config.tasksDirectory}/tasks/

3. Create your first epic:
   aitrackdown epic create "New Feature Development"

4. Create an issue within the epic:
   aitrackdown issue create "API Implementation" --epic EP-0001

5. Create tasks for the issue:
   aitrackdown task create "Design API Schema" --issue ISS-0001

6. View project status:
   aitrackdown status

7. Get help:
   aitrackdown --help
`);

        } catch (error) {
          spinner.fail('Project initialization failed');
          throw error;
        }
      } catch (error) {
        console.error(`❌ Failed to initialize project: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    });

  return command;
}

async function runInteractiveSetup(initialConfig: any) {
  console.log(`
🚀 AI-Trackdown Interactive Setup
`);

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: initialConfig.name || 'my-trackdown-project',
      validate: (input: string) => {
        if (!/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/.test(input)) {
          return 'Project name must start with alphanumeric character and contain only letters, numbers, hyphens, and underscores';
        }
        return true;
      }
    },
    {
      type: 'list',
      name: 'type',
      message: 'Project type:',
      choices: [
        { name: '💻 Software - Software development projects', value: 'software' },
        { name: '🔬 Research - Research and analysis projects', value: 'research' },
        { name: '📊 Business - Business process and planning', value: 'business' },
        { name: '📁 General - General purpose projects', value: 'general' }
      ],
      default: initialConfig.type
    },
    {
      type: 'input',
      name: 'assignee',
      message: 'Default assignee:',
      default: initialConfig.assignee
    },
    {
      type: 'input',
      name: 'tasksDirectory',
      message: 'Tasks root directory:',
      default: initialConfig.tasksDirectory || 'tasks',
      validate: (input: string) => {
        if (!/^[a-zA-Z0-9][a-zA-Z0-9-_/]*$/.test(input)) {
          return 'Tasks directory must start with alphanumeric character and contain only letters, numbers, hyphens, underscores, and slashes';
        }
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'force',
      message: 'Overwrite existing project if it exists?',
      default: initialConfig.force,
      when: (answers) => fs.existsSync(path.resolve(process.cwd(), answers.name))
    }
  ]);

  return { ...initialConfig, ...answers };
}

async function createExampleItems(
  projectPath: string,
  config: ProjectConfig,
  idGenerator: AITrackdownIdGenerator
): Promise<void> {
  const parser = new FrontmatterParser();

  // Get unified paths for the project
  const { UnifiedPathResolver } = require('../utils/unified-path-resolver.js');
  const pathResolver = new UnifiedPathResolver(config, projectPath);
  const paths = pathResolver.getUnifiedPaths();

  // Create example epic
  const epicId = idGenerator.generateEpicId('Project Setup and Initial Development');
  const epicPath = path.join(
    paths.epicsDir,
    idGenerator.generateFilename(epicId, 'Project Setup and Initial Development')
  );

  const epicData = {
    epic_id: epicId,
    title: 'Project Setup and Initial Development',
    description: 'Initial setup and foundational development for the project',
    status: 'active' as const,
    priority: 'high' as const,
    assignee: config.default_assignee || 'unassigned',
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    estimated_tokens: 500,
    actual_tokens: 0,
    ai_context: ['project-setup', 'initial-development', 'foundation'],
    related_issues: ['ISS-0001'],
    sync_status: 'local' as const,
    tags: ['setup', 'foundation'],
    milestone: 'v1.0.0'
  };

  const epicContent = `# Epic: Project Setup and Initial Development

## Overview
This epic covers the foundational work needed to get the project up and running, including environment setup, initial architecture decisions, and core infrastructure.

## Objectives
- [ ] Set up development environment
- [ ] Establish project structure and conventions
- [ ] Implement core infrastructure
- [ ] Create initial documentation

## Success Criteria
- Development environment is fully configured
- Team can effectively collaborate on the project
- Core infrastructure is in place and tested
- Documentation is comprehensive and up-to-date

## Related Issues
- ISS-0001: Development Environment Setup

## Notes
This is a foundational epic that will enable all future development work.`;

  parser.writeEpic(epicPath, epicData, epicContent);

  // Create example issue
  const issueId = idGenerator.generateIssueId(epicId, 'Development Environment Setup');
  const issuePath = path.join(
    paths.issuesDir,
    idGenerator.generateFilename(issueId, 'Development Environment Setup')
  );

  const issueData = {
    issue_id: issueId,
    epic_id: epicId,
    title: 'Development Environment Setup',
    description: 'Configure development environment and tooling for the project',
    status: 'active' as const,
    priority: 'high' as const,
    assignee: config.default_assignee || 'unassigned',
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    estimated_tokens: 200,
    actual_tokens: 0,
    ai_context: ['environment-setup', 'tooling', 'configuration'],
    related_tasks: ['TSK-0001', 'TSK-0002'],
    sync_status: 'local' as const,
    tags: ['setup', 'environment'],
    dependencies: []
  };

  const issueContent = `# Issue: Development Environment Setup

## Description
Set up a consistent development environment that all team members can use. This includes configuring development tools, establishing coding standards, and creating setup documentation.

## Tasks
- TSK-0001: Install and configure development tools
- TSK-0002: Create development setup documentation

## Acceptance Criteria
- [ ] All required development tools are identified and documented
- [ ] Setup instructions are created and tested
- [ ] Development environment can be replicated consistently
- [ ] Team members can successfully set up their environments

## Dependencies
None - this is foundational work.

## Notes
Focus on creating a setup that is reliable and easy to follow for new team members.`;

  parser.writeIssue(issuePath, issueData, issueContent);

  // Create example task 1
  const task1Id = idGenerator.generateTaskId(issueId, 'Install and configure development tools');
  const task1Path = path.join(
    paths.tasksDir,
    idGenerator.generateFilename(task1Id, 'Install and configure development tools')
  );

  const task1Data = {
    task_id: task1Id,
    issue_id: issueId,
    epic_id: epicId,
    title: 'Install and configure development tools',
    description: 'Install required development tools and configure them for the project',
    status: 'planning' as const,
    priority: 'high' as const,
    assignee: config.default_assignee || 'unassigned',
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    estimated_tokens: 100,
    actual_tokens: 0,
    ai_context: ['tool-installation', 'configuration', 'setup'],
    sync_status: 'local' as const,
    tags: ['tools', 'setup'],
    time_estimate: '4 hours',
    dependencies: []
  };

  const task1Content = `# Task: Install and configure development tools

## Description
Install and configure all necessary development tools for the project including IDE, version control, package managers, and any project-specific tools.

## Steps
1. Install IDE/editor with required extensions
2. Configure version control (Git)
3. Install package managers and dependencies
4. Set up project-specific tools and utilities
5. Test the complete development setup

## Acceptance Criteria
- [ ] All required tools are installed and working
- [ ] Configuration is documented
- [ ] Setup can be reproduced on different machines
- [ ] All tools integrate properly with the project

## Tools to Install
- [ ] IDE/Editor (VS Code, IntelliJ, etc.)
- [ ] Git and Git client
- [ ] Node.js/Python/etc. (as needed)
- [ ] Package managers
- [ ] Project-specific tools

## Notes
Document any platform-specific setup requirements.`;

  parser.writeTask(task1Path, task1Data, task1Content);

  // Create example task 2
  const task2Id = idGenerator.generateTaskId(issueId, 'Create development setup documentation');
  const task2Path = path.join(
    paths.tasksDir,
    idGenerator.generateFilename(task2Id, 'Create development setup documentation')
  );

  const task2Data = {
    task_id: task2Id,
    issue_id: issueId,
    epic_id: epicId,
    title: 'Create development setup documentation',
    description: 'Write comprehensive documentation for setting up the development environment',
    status: 'planning' as const,
    priority: 'medium' as const,
    assignee: config.default_assignee || 'unassigned',
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    estimated_tokens: 100,
    actual_tokens: 0,
    ai_context: ['documentation', 'setup-guide', 'onboarding'],
    sync_status: 'local' as const,
    tags: ['documentation', 'setup'],
    time_estimate: '2 hours',
    dependencies: ['TSK-0001']
  };

  const task2Content = `# Task: Create development setup documentation

## Description
Create comprehensive setup documentation that enables new team members to quickly and reliably set up their development environment.

## Steps
1. Document all required tools and versions
2. Write step-by-step setup instructions
3. Include troubleshooting section
4. Add platform-specific notes (Windows/Mac/Linux)
5. Test documentation with a fresh setup

## Acceptance Criteria
- [ ] Documentation is complete and accurate
- [ ] Instructions work on all supported platforms
- [ ] Troubleshooting section addresses common issues
- [ ] Documentation is easily accessible to team members

## Documentation Sections
- [ ] Prerequisites and system requirements
- [ ] Tool installation instructions
- [ ] Configuration steps
- [ ] Verification and testing
- [ ] Troubleshooting common issues
- [ ] Contact information for help

## Notes
Keep documentation updated as tools and requirements evolve.`;

  parser.writeTask(task2Path, task2Data, task2Content);
}

function createProjectReadme(projectPath: string, projectName: string, projectType: string, config: ProjectConfig): void {
  const tasksDir = config.tasks_directory || 'tasks';
  const readmeContent = `# ${projectName}

An AI-Trackdown project for hierarchical project management.

**Project Type:** ${projectType}  
**Created:** ${new Date().toISOString().split('T')[0]}
**Tasks Directory:** ${tasksDir}/

## Overview

This project uses AI-Trackdown for hierarchical project management with Epics, Issues, and Tasks. Each item has YAML frontmatter for metadata and Markdown content for descriptions.

## Unified Directory Structure

\`\`\`
${projectName}/
├── .ai-trackdown/          # Configuration and metadata
│   ├── config.yaml         # Project configuration
│   ├── counters.json       # ID generation counters
│   └── templates/          # Item templates
├── ${tasksDir}/                  # Tasks root directory (configurable)
│   ├── epics/              # Epic-level planning (.md files)
│   ├── issues/             # Issue-level work items (.md files)
│   ├── tasks/              # Task-level activities (.md files)
│   ├── prs/                # Pull request tracking (.md files)
│   └── templates/          # Item templates
├── .gitignore             # Git ignore patterns
└── README.md              # This file
\`\`\`

## Hierarchy

- **Epics** (${config.naming_conventions.epic_prefix}-XXXX): High-level features or objectives
- **Issues** (${config.naming_conventions.issue_prefix}-XXXX): Specific work items within epics
- **Tasks** (${config.naming_conventions.task_prefix}-XXXX): Granular activities within issues

## Getting Started

### View Items
\`\`\`bash
# List all epics
ls ${tasksDir}/epics/

# List all issues
ls ${tasksDir}/issues/

# List all tasks
ls ${tasksDir}/tasks/

# List all PRs
ls ${tasksDir}/prs/
\`\`\`

### Create New Items
\`\`\`bash
# Create a new epic
aitrackdown epic create "New Feature Development"

# Create an issue within an epic
aitrackdown issue create "API Implementation" --epic EP-0001

# Create a task within an issue
aitrackdown task create "Design API Schema" --issue ISS-0001
\`\`\`

### Project Management
\`\`\`bash
# View project status
aitrackdown status

# Search items
aitrackdown search --status active --priority high

# Update item status
aitrackdown task update TSK-0001 --status completed

# Export project data
aitrackdown export --format json
\`\`\`

## Configuration

Project configuration is stored in \`.ai-trackdown/config.yaml\`. You can modify:

- Directory structure
- Naming conventions
- Default assignee
- AI context templates
- Automation settings

## File Format

Each item file contains YAML frontmatter and Markdown content:

\`\`\`markdown
---
epic_id: EP-0001
title: Project Setup and Initial Development
description: Initial setup and foundational development
status: active
priority: high
assignee: ${config.default_assignee}
created_date: 2023-XX-XX
updated_date: 2023-XX-XX
estimated_tokens: 500
actual_tokens: 0
ai_context:
  - project-setup
  - initial-development
related_issues:
  - ISS-0001
sync_status: local
---

# Epic: Project Setup and Initial Development

## Overview
Detailed description of the epic...
\`\`\`

## Examples

The project includes example items to help you get started:
- **EP-0001**: Project Setup and Initial Development
- **ISS-0001**: Development Environment Setup
- **TSK-0001**: Install and configure development tools
- **TSK-0002**: Create development setup documentation

## Commands

| Command | Description |
|---------|-------------|
| \`aitrackdown init\` | Initialize a new project |
| \`aitrackdown epic create\` | Create a new epic |
| \`aitrackdown issue create\` | Create a new issue |
| \`aitrackdown task create\` | Create a new task |
| \`aitrackdown status\` | View project status |
| \`aitrackdown search\` | Search items |
| \`aitrackdown export\` | Export project data |

## Links

- [AI-Trackdown Documentation](https://github.com/your-org/ai-trackdown-tools)
- [Project Issues](https://github.com/your-org/ai-trackdown-tools/issues)

---

*Generated by ai-trackdown-tools on ${new Date().toISOString().split('T')[0]}*
`;

  fs.writeFileSync(path.join(projectPath, 'README.md'), readmeContent, 'utf8');
}

function createGitignore(projectPath: string): void {
  const gitignoreContent = `# AI-Trackdown exports
.ai-trackdown/exports/
*.backup

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# Dependency directories
node_modules/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env
.env.test

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
`;

  fs.writeFileSync(path.join(projectPath, '.gitignore'), gitignoreContent, 'utf8');
}