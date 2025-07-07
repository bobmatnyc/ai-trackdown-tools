import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora';
import { ConfigManager } from '../utils/config.js';
import { Formatter } from '../utils/formatter.js';
import { 
  validateProjectName, 
  validateProjectType, 
  validateConfigFormat,
  ValidationError 
} from '../utils/validation.js';
import type { ProjectTemplate } from '../types/index.js';

const PROJECT_TEMPLATES: Record<string, ProjectTemplate> = {
  standard: {
    name: 'Standard',
    description: 'Basic trackdown project with essential features',
    type: 'general',
    structure: [
      { path: 'trackdown/active', type: 'directory' },
      { path: 'trackdown/completed', type: 'directory' },
      { path: 'trackdown/templates', type: 'directory' },
      { path: 'trackdown/exports', type: 'directory' },
      { path: 'trackdown/docs', type: 'directory' },
    ],
    config: {
      defaultPriority: 'medium',
      outputFormat: 'md',
      colorOutput: true,
    }
  },
  cli: {
    name: 'CLI Tool',
    description: 'Template for command-line tool development',
    type: 'cli',
    structure: [
      { path: 'trackdown/features', type: 'directory' },
      { path: 'trackdown/bugs', type: 'directory' },
      { path: 'trackdown/releases', type: 'directory' },
      { path: 'trackdown/documentation', type: 'directory' },
    ],
    config: {
      defaultPriority: 'high',
      outputFormat: 'table',
      integrations: { git: true },
    }
  },
  web: {
    name: 'Web Application',
    description: 'Template for web application development',
    type: 'web',
    structure: [
      { path: 'trackdown/frontend', type: 'directory' },
      { path: 'trackdown/backend', type: 'directory' },
      { path: 'trackdown/testing', type: 'directory' },
      { path: 'trackdown/deployment', type: 'directory' },
    ],
    config: {
      defaultPriority: 'medium',
      outputFormat: 'table',
      integrations: { git: true, jira: false },
    }
  },
  api: {
    name: 'API Development',
    description: 'Template for API and microservice development',
    type: 'api',
    structure: [
      { path: 'trackdown/endpoints', type: 'directory' },
      { path: 'trackdown/schemas', type: 'directory' },
      { path: 'trackdown/testing', type: 'directory' },
      { path: 'trackdown/documentation', type: 'directory' },
    ],
    config: {
      defaultPriority: 'high',
      outputFormat: 'json',
      integrations: { git: true },
    }
  },
  mobile: {
    name: 'Mobile App',
    description: 'Template for mobile application development',
    type: 'mobile',
    structure: [
      { path: 'trackdown/features', type: 'directory' },
      { path: 'trackdown/ui-ux', type: 'directory' },
      { path: 'trackdown/testing', type: 'directory' },
      { path: 'trackdown/releases', type: 'directory' },
    ],
    config: {
      defaultPriority: 'medium',
      outputFormat: 'table',
      integrations: { git: true },
    }
  },
};

export function createInitCommand(): Command {
  const command = new Command('init');

  command
    .description('Initialize a new trackdown project with advanced configuration')
    .argument('[project-name]', 'name of the project')
    .option('--type <type>', 'project type (cli, web, api, mobile, general)', 'general')
    .option('--template <name>', 'use project template', 'standard')
    .option('--config <file>', 'custom configuration file path')
    .option('--force', 'overwrite existing project')
    .option('--interactive', 'interactive setup mode')
    .option('--no-git', 'skip git repository initialization')
    .option('--format <format>', 'configuration file format (json, yaml)', 'json')
    .addHelpText('after', `
Examples:
  $ trackdown init my-project --type cli --template standard
  $ trackdown init web-app --type web --interactive
  $ trackdown init api-service --config ./custom.yaml --format yaml
  $ trackdown init --interactive

Templates:
  standard  - Basic project with essential features
  cli       - Command-line tool development
  web       - Web application development  
  api       - API and microservice development
  mobile    - Mobile application development

Types:
  cli       - Command-line tools and utilities
  web       - Web applications and sites
  api       - REST APIs and microservices
  mobile    - Mobile applications
  general   - General purpose projects
`)
    .action(async (
      projectName?: string, 
      options?: {
        type?: string;
        template?: string;
        config?: string;
        force?: boolean;
        interactive?: boolean;
        git?: boolean;
        format?: string;
      }
    ) => {
      try {
        let config = {
          name: projectName,
          type: options?.type || 'general',
          template: options?.template || 'standard',
          configFile: options?.config,
          force: options?.force || false,
          initGit: options?.git !== false,
          format: options?.format || 'json',
        };

        // Interactive mode
        if (options?.interactive || !projectName) {
          config = await runInteractiveSetup(config);
        }

        // Validate inputs
        const validatedName = validateProjectName(config.name || 'trackdown-project');
        const validatedType = validateProjectType(config.type);
        const configFormat = validateConfigFormat(`.${config.format}`);

        // Validate template
        if (!PROJECT_TEMPLATES[config.template]) {
          throw new ValidationError(
            `Unknown template: ${config.template}`,
            `Available templates: ${Object.keys(PROJECT_TEMPLATES).join(', ')}`,
            1,
            'init',
            Object.keys(PROJECT_TEMPLATES).map(t => `--template ${t}`)
          );
        }

        const template = PROJECT_TEMPLATES[config.template];
        const projectPath = join(process.cwd(), validatedName);

        // Check if project already exists
        if (existsSync(projectPath) && !config.force) {
          console.error(Formatter.error(`Project "${validatedName}" already exists`));
          console.log(Formatter.info('Use --force to overwrite existing project'));
          console.log(Formatter.info('Or choose a different project name'));
          process.exit(1);
        }

        // Show initialization progress
        const spinner = ora('Initializing trackdown project...').start();

        try {
          // Create project directory
          if (!existsSync(projectPath)) {
            mkdirSync(projectPath, { recursive: true });
          }
          spinner.text = 'Creating project structure...';

          // Create directory structure based on template
          for (const item of template.structure) {
            const fullPath = join(projectPath, item.path);
            if (item.type === 'directory') {
              mkdirSync(fullPath, { recursive: true });
            } else if (item.type === 'file' && item.content) {
              writeFileSync(fullPath, item.content);
            }
          }

          spinner.text = 'Configuring project settings...';

          // Create configuration
          const configFileName = configFormat === 'yaml' ? '.trackdownrc.yaml' : '.trackdownrc.json';
          const configManager = new ConfigManager(
            config.configFile || join(projectPath, configFileName)
          );

          const projectConfig = {
            projectName: validatedName,
            outputFormat: template.config?.outputFormat || 'md',
            templatePath: './trackdown/templates',
            defaultTemplate: config.template,
            colorOutput: template.config?.colorOutput ?? true,
            defaultPriority: template.config?.defaultPriority || 'medium',
            autoAssign: template.config?.autoAssign ?? true,
            integrations: template.config?.integrations || { git: true },
            ...template.config,
          };

          configManager.updateConfig(projectConfig);

          spinner.text = 'Creating project files...';

          // Create enhanced README
          const readmeContent = generateReadmeContent(validatedName, validatedType, template);
          writeFileSync(join(projectPath, 'README.md'), readmeContent);

          // Create .gitignore if git is enabled
          if (config.initGit) {
            const gitignoreContent = generateGitignoreContent();
            writeFileSync(join(projectPath, '.gitignore'), gitignoreContent);
          }

          // Create enhanced templates
          await createProjectTemplates(projectPath, template);

          // Create example tasks based on template type
          await createExampleTasks(projectPath, template);

          spinner.succeed('Project initialized successfully!');

          // Show success message
          console.log(Formatter.box(`
🎉 Trackdown project "${validatedName}" created successfully!

Project Type: ${template.name} (${validatedType})
Template: ${config.template}
Configuration: ${configFileName}
Location: ${projectPath}
`, 'success'));

          // Show next steps
          console.log(Formatter.header('Next Steps'));
          console.log(Formatter.info('1. Navigate to your project:'));
          console.log(Formatter.highlight(`   cd ${validatedName}`));
          console.log(Formatter.info('2. Create your first task:'));
          console.log(Formatter.highlight('   trackdown track "Set up development environment"'));
          console.log(Formatter.info('3. Check project status:'));
          console.log(Formatter.highlight('   trackdown status'));
          console.log(Formatter.info('4. View available commands:'));
          console.log(Formatter.highlight('   trackdown --help'));

          if (config.initGit) {
            console.log(Formatter.info('5. Initialize git repository:'));
            console.log(Formatter.highlight('   git init && git add . && git commit -m "Initial commit"'));
          }

        } catch (error) {
          spinner.fail('Project initialization failed');
          throw error;
        }

      } catch (error) {
        if (error instanceof ValidationError) {
          console.error(Formatter.error(error.message));
          if (error.suggestion) {
            console.log(Formatter.info(`💡 ${error.suggestion}`));
          }
          if (error.validOptions?.length) {
            console.log(Formatter.info('Valid options:'));
            error.validOptions.forEach(option => {
              console.log(Formatter.highlight(`  ${option}`));
            });
          }
        } else {
          console.error(Formatter.error(
            `Failed to initialize project: ${error instanceof Error ? error.message : 'Unknown error'}`
          ));
        }
        process.exit(1);
      }
    });

  return command;
}

async function runInteractiveSetup(initialConfig: any) {
  console.log(Formatter.banner('Trackdown'));
  console.log(Formatter.header('🚀 Interactive Project Setup'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: initialConfig.name || 'my-trackdown-project',
      validate: (input: string) => {
        try {
          validateProjectName(input);
          return true;
        } catch (error) {
          return error instanceof Error ? error.message : 'Invalid project name';
        }
      },
    },
    {
      type: 'list',
      name: 'type',
      message: 'Project type:',
      choices: [
        { name: '🔧 CLI Tool - Command-line applications', value: 'cli' },
        { name: '🌐 Web App - Web applications and sites', value: 'web' },
        { name: '🔌 API - REST APIs and microservices', value: 'api' },
        { name: '📱 Mobile - Mobile applications', value: 'mobile' },
        { name: '📁 General - General purpose projects', value: 'general' },
      ],
      default: initialConfig.type,
    },
    {
      type: 'list',
      name: 'template',
      message: 'Project template:',
      choices: Object.entries(PROJECT_TEMPLATES).map(([key, template]) => ({
        name: `${template.name} - ${template.description}`,
        value: key,
      })),
      default: initialConfig.template,
    },
    {
      type: 'list',
      name: 'format',
      message: 'Configuration file format:',
      choices: [
        { name: '📄 JSON (.json)', value: 'json' },
        { name: '📝 YAML (.yaml)', value: 'yaml' },
      ],
      default: initialConfig.format,
    },
    {
      type: 'confirm',
      name: 'initGit',
      message: 'Initialize git repository?',
      default: initialConfig.initGit,
    },
    {
      type: 'confirm',
      name: 'force',
      message: 'Overwrite existing project if it exists?',
      default: initialConfig.force,
      when: (answers) => existsSync(join(process.cwd(), answers.name)),
    },
  ]);

  return { ...initialConfig, ...answers };
}

function generateReadmeContent(name: string, type: string, template: ProjectTemplate): string {
  return `# ${name}

A professional trackdown project for managing tasks and issues.

**Project Type:** ${template.name} (${type})  
**Template:** ${template.description}

## Getting Started

\`\`\`bash
# Create your first task
trackdown track "Set up development environment" --priority high

# Check project status
trackdown status --verbose

# Export project data
trackdown export --format json

# View detailed help
trackdown --help
\`\`\`

## Project Structure

\`\`\`
${name}/
├── trackdown/          # Main trackdown directory
${template.structure.map(item => `│   ├── ${item.path.replace('trackdown/', '')}/`).join('\n')}
├── .trackdownrc.json   # Project configuration
├── .gitignore         # Git ignore patterns
└── README.md          # This file
\`\`\`

## Configuration

This project uses the **${template.name}** template with the following defaults:

- **Default Priority:** ${template.config?.defaultPriority || 'medium'}
- **Output Format:** ${template.config?.outputFormat || 'md'}
- **Color Output:** ${template.config?.colorOutput ? 'enabled' : 'disabled'}
- **Git Integration:** ${template.config?.integrations?.git ? 'enabled' : 'disabled'}

You can modify these settings in \`.trackdownrc.json\` or use environment variables:

\`\`\`bash
export TRACKDOWN_DEFAULT_PRIORITY=high
export TRACKDOWN_OUTPUT_FORMAT=table
export TRACKDOWN_COLOR_OUTPUT=true
\`\`\`

## Commands

| Command | Description |
|---------|-------------|
| \`trackdown init\` | Initialize a new project |
| \`trackdown track\` | Create a new task or issue |
| \`trackdown status\` | View project status and statistics |
| \`trackdown export\` | Export data in various formats |

## Examples

\`\`\`bash
# Track a new feature
trackdown track "Add user authentication" \\
  --priority high \\
  --assignee john.doe \\
  --tags security,backend \\
  --estimate 8

# Filter by status and priority
trackdown status --filter "status=in-progress,priority=high"

# Export as CSV with filters
trackdown export --format csv --filter "status=done" --output completed-tasks.csv
\`\`\`

## Links

- [Documentation](https://github.com/your-org/ai-trackdown-tooling#readme)
- [Issues](https://github.com/your-org/ai-trackdown-tooling/issues)
- [Contributing](https://github.com/your-org/ai-trackdown-tooling/blob/main/CONTRIBUTING.md)

---

*Generated by ai-trackdown-tooling v1.0.0 on ${new Date().toISOString().split('T')[0]}*
`;
}

function generateGitignoreContent(): string {
  return `# Trackdown exports
trackdown/exports/*.json
trackdown/exports/*.csv
trackdown/exports/*.yaml

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

# nyc test coverage
.nyc_output

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
}

async function createProjectTemplates(projectPath: string, template: ProjectTemplate): Promise<void> {
  const templatesDir = join(projectPath, 'trackdown', 'templates');
  
  // Enhanced task template
  const taskTemplate = `# {title}

**ID**: {id}
**Status**: {status}
**Priority**: {priority}
**Assignee**: {assignee}
**Created**: {createdAt}
**Updated**: {updatedAt}

## Description

{description}

## Acceptance Criteria

- [ ] Define specific and measurable acceptance criteria
- [ ] Ensure criteria are testable and verifiable
- [ ] Add more criteria as needed

## Technical Notes

<!-- Add technical implementation details, architecture decisions, or constraints -->

## Dependencies

<!-- List any dependencies on other tasks, features, or external factors -->

## Resources

<!-- Add links, references, documentation, or related materials here -->

## Progress Log

- {createdAt}: Task created
<!-- Add progress updates as work progresses -->

---

*Template: ${template.name} | Generated by ai-trackdown-tooling*
`;

  writeFileSync(join(templatesDir, 'task.md'), taskTemplate);

  // Create template-specific templates
  if (template.type === 'cli') {
    const featureTemplate = `# Feature: {title}

**Feature ID**: {id}
**Priority**: {priority}
**Assignee**: {assignee}
**Target Release**: {targetRelease}

## User Story

As a [user type], I want [functionality] so that [benefit].

## Implementation Plan

### Phase 1: Planning
- [ ] Define requirements and scope
- [ ] Create technical design
- [ ] Identify dependencies

### Phase 2: Development
- [ ] Implement core functionality
- [ ] Add error handling
- [ ] Write unit tests

### Phase 3: Integration
- [ ] Integration testing
- [ ] Documentation updates
- [ ] Code review

## Command Specification

\`\`\`bash
# Command syntax
{commandName} [options] [arguments]

# Examples
{commandName} --help
{commandName} --verbose
\`\`\`

## Testing

- [ ] Unit tests written
- [ ] Integration tests added
- [ ] Manual testing completed
- [ ] Cross-platform testing
`;

    writeFileSync(join(templatesDir, 'feature.md'), featureTemplate);
  }
}

async function createExampleTasks(projectPath: string, template: ProjectTemplate): Promise<void> {
  // This would create example tasks based on the template type
  // For now, we'll just create the directory structure
  const activeDir = join(projectPath, 'trackdown', 'active');
  
  // Create a welcome task
  const welcomeTask = `# Welcome to Trackdown

**ID**: welcome-001
**Status**: todo
**Priority**: low
**Assignee**: ${process.env.USER || 'you'}
**Created**: ${new Date().toISOString()}
**Updated**: ${new Date().toISOString()}

## Description

This is your first trackdown task! This task will help you get familiar with the trackdown system.

## Acceptance Criteria

- [ ] Read through this task template
- [ ] Explore the project structure
- [ ] Create your first real task using: \`trackdown track "Your task title"\`
- [ ] Check the project status using: \`trackdown status\`
- [ ] Mark this task as completed

## Getting Started

1. **Explore Commands**: Run \`trackdown --help\` to see all available commands
2. **Create Tasks**: Use \`trackdown track\` to create new tasks and issues
3. **Monitor Progress**: Use \`trackdown status\` to view project overview
4. **Export Data**: Use \`trackdown export\` to export your data

## Resources

- [Trackdown Documentation](https://github.com/your-org/ai-trackdown-tooling)
- [Command Reference](https://github.com/your-org/ai-trackdown-tooling#commands)

## Progress Log

- ${new Date().toISOString()}: Welcome task created

---

*Template: ${template.name} | Generated by ai-trackdown-tooling*
`;

  writeFileSync(join(activeDir, 'welcome-001-welcome-to-trackdown.md'), welcomeTask);
}
