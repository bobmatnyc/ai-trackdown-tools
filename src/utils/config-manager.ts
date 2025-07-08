/**
 * Configuration Manager for AI-Trackdown
 * Handles .ai-trackdown/config.yaml configuration system
 */

import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import type { ProjectConfig, ItemTemplate } from '../types/ai-trackdown.js';

const DEFAULT_CONFIG_DIR = '.ai-trackdown';
const DEFAULT_CONFIG_FILE = 'config.yaml';
const DEFAULT_TEMPLATES_DIR = 'templates';

export class ConfigManager {
  private configPath: string;
  private config: ProjectConfig | null = null;

  constructor(projectRoot?: string) {
    const root = projectRoot || this.findProjectRoot();
    this.configPath = path.join(root, DEFAULT_CONFIG_DIR, DEFAULT_CONFIG_FILE);
  }

  /**
   * Load configuration from file
   */
  public loadConfig(): ProjectConfig {
    if (this.config) {
      return this.config;
    }

    if (!fs.existsSync(this.configPath)) {
      throw new Error(`AI-Trackdown configuration not found at ${this.configPath}. Run 'aitrackdown init' to create a new project.`);
    }

    try {
      const configContent = fs.readFileSync(this.configPath, 'utf8');
      this.config = YAML.parse(configContent) as ProjectConfig;
      
      // Validate and normalize config
      this.validateConfig(this.config);
      this.normalizeConfig(this.config);
      
      return this.config;
    } catch (error) {
      throw new Error(`Failed to load AI-Trackdown configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save configuration to file
   */
  public saveConfig(config: ProjectConfig): void {
    this.validateConfig(config);
    
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const yamlContent = YAML.stringify(config, {
      indent: 2,
      lineWidth: 120,
      minContentWidth: 20
    });

    fs.writeFileSync(this.configPath, yamlContent, 'utf8');
    this.config = config;
  }

  /**
   * Create default configuration
   */
  public createDefaultConfig(projectName: string, options: Partial<ProjectConfig> = {}): ProjectConfig {
    const defaultConfig: ProjectConfig = {
      name: projectName,
      description: options.description || `AI-Trackdown project: ${projectName}`,
      version: '1.0.0',
      structure: {
        epics_dir: 'epics',
        issues_dir: 'issues',
        tasks_dir: 'tasks',
        templates_dir: 'templates'
      },
      naming_conventions: {
        epic_prefix: 'EP',
        issue_prefix: 'ISS',
        task_prefix: 'TSK',
        file_extension: '.md'
      },
      default_assignee: options.default_assignee || 'unassigned',
      ai_context_templates: [
        'context/requirements',
        'context/constraints',
        'context/assumptions',
        'context/dependencies'
      ],
      automation: {
        auto_update_timestamps: true,
        auto_calculate_tokens: false,
        auto_sync_status: true
      },
      ...options
    };

    return defaultConfig;
  }

  /**
   * Initialize new project with default structure
   */
  public initializeProject(projectName: string, options: Partial<ProjectConfig> = {}): ProjectConfig {
    const config = this.createDefaultConfig(projectName, options);
    
    // Create directory structure
    this.createProjectStructure(config);
    
    // Create default templates
    this.createDefaultTemplates(config);
    
    // Save configuration
    this.saveConfig(config);
    
    return config;
  }

  /**
   * Update specific configuration values
   */
  public updateConfig(updates: Partial<ProjectConfig>): ProjectConfig {
    const currentConfig = this.loadConfig();
    const updatedConfig = this.deepMerge(currentConfig, updates);
    
    this.saveConfig(updatedConfig);
    return updatedConfig;
  }

  /**
   * Get configuration with environment overrides
   */
  public getConfig(): ProjectConfig {
    const config = this.loadConfig();
    
    // Apply environment variable overrides
    if (process.env.ATD_DEFAULT_ASSIGNEE) {
      config.default_assignee = process.env.ATD_DEFAULT_ASSIGNEE;
    }
    
    if (process.env.ATD_AUTO_TIMESTAMPS === 'false') {
      config.automation!.auto_update_timestamps = false;
    }
    
    if (process.env.ATD_AUTO_CALCULATE_TOKENS === 'true') {
      config.automation!.auto_calculate_tokens = true;
    }
    
    return config;
  }

  /**
   * Get absolute paths for project structure
   */
  public getAbsolutePaths(): {
    projectRoot: string;
    configDir: string;
    epicsDir: string;
    issuesDir: string;
    tasksDir: string;
    templatesDir: string;
  } {
    const config = this.getConfig();
    const projectRoot = path.dirname(path.dirname(this.configPath));
    
    return {
      projectRoot,
      configDir: path.dirname(this.configPath),
      epicsDir: path.resolve(projectRoot, config.structure.epics_dir),
      issuesDir: path.resolve(projectRoot, config.structure.issues_dir),
      tasksDir: path.resolve(projectRoot, config.structure.tasks_dir),
      templatesDir: path.resolve(projectRoot, config.structure.templates_dir)
    };
  }

  /**
   * Check if current directory is an AI-Trackdown project
   */
  public isProjectDirectory(dir?: string): boolean {
    const checkDir = dir || process.cwd();
    const configPath = path.join(checkDir, DEFAULT_CONFIG_DIR, DEFAULT_CONFIG_FILE);
    return fs.existsSync(configPath);
  }

  /**
   * Find project root by walking up directory tree
   */
  public findProjectRoot(startDir?: string): string {
    let currentDir = startDir || process.cwd();
    
    while (currentDir !== path.dirname(currentDir)) {
      const configPath = path.join(currentDir, DEFAULT_CONFIG_DIR, DEFAULT_CONFIG_FILE);
      if (fs.existsSync(configPath)) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    
    // If not found, return the starting directory
    return startDir || process.cwd();
  }

  /**
   * Validate configuration structure
   */
  private validateConfig(config: ProjectConfig): void {
    const required = ['name', 'version', 'structure', 'naming_conventions'];
    
    for (const field of required) {
      if (!config[field as keyof ProjectConfig]) {
        throw new Error(`Configuration missing required field: ${field}`);
      }
    }

    // Validate structure paths
    const structureFields = ['epics_dir', 'issues_dir', 'tasks_dir', 'templates_dir'];
    for (const field of structureFields) {
      if (!config.structure[field as keyof typeof config.structure]) {
        throw new Error(`Configuration structure missing required field: ${field}`);
      }
    }

    // Validate naming conventions
    const namingFields = ['epic_prefix', 'issue_prefix', 'task_prefix', 'file_extension'];
    for (const field of namingFields) {
      if (!config.naming_conventions[field as keyof typeof config.naming_conventions]) {
        throw new Error(`Configuration naming_conventions missing required field: ${field}`);
      }
    }
  }

  /**
   * Normalize configuration (ensure defaults and proper types)
   */
  private normalizeConfig(config: ProjectConfig): void {
    // Ensure automation defaults
    if (!config.automation) {
      config.automation = {
        auto_update_timestamps: true,
        auto_calculate_tokens: false,
        auto_sync_status: true
      };
    }

    // Ensure arrays are arrays
    if (!config.ai_context_templates) {
      config.ai_context_templates = [];
    }

    // Normalize paths (remove leading/trailing slashes)
    config.structure.epics_dir = config.structure.epics_dir.replace(/^\/|\/$/g, '');
    config.structure.issues_dir = config.structure.issues_dir.replace(/^\/|\/$/g, '');
    config.structure.tasks_dir = config.structure.tasks_dir.replace(/^\/|\/$/g, '');
    config.structure.templates_dir = config.structure.templates_dir.replace(/^\/|\/$/g, '');

    // Ensure file extension starts with dot
    if (!config.naming_conventions.file_extension.startsWith('.')) {
      config.naming_conventions.file_extension = '.' + config.naming_conventions.file_extension;
    }
  }

  /**
   * Create project directory structure
   */
  private createProjectStructure(config: ProjectConfig): void {
    const projectRoot = path.dirname(path.dirname(this.configPath));
    
    const directories = [
      path.join(projectRoot, config.structure.epics_dir),
      path.join(projectRoot, config.structure.issues_dir),
      path.join(projectRoot, config.structure.tasks_dir),
      path.join(projectRoot, config.structure.templates_dir),
      path.dirname(this.configPath) // .ai-trackdown directory
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Create default templates
   */
  private createDefaultTemplates(config: ProjectConfig): void {
    const templatesDir = path.join(
      path.dirname(path.dirname(this.configPath)),
      config.structure.templates_dir
    );

    const templates: ItemTemplate[] = [
      {
        type: 'epic',
        name: 'default',
        description: 'Default epic template',
        frontmatter_template: {
          title: 'Epic Title',
          description: 'Epic description',
          status: 'planning',
          priority: 'medium',
          assignee: config.default_assignee || 'unassigned',
          created_date: '',
          updated_date: '',
          estimated_tokens: 0,
          actual_tokens: 0,
          ai_context: config.ai_context_templates || [],
          sync_status: 'local'
        },
        content_template: `# Epic: {{title}}

## Overview
{{description}}

## Objectives
- [ ] Objective 1
- [ ] Objective 2
- [ ] Objective 3

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2

## Related Issues
{{#related_issues}}
- {{.}}
{{/related_issues}}

## Notes
Add any additional notes here.`
      },
      {
        type: 'issue',
        name: 'default',
        description: 'Default issue template',
        frontmatter_template: {
          title: 'Issue Title',
          description: 'Issue description',
          status: 'planning',
          priority: 'medium',
          assignee: config.default_assignee || 'unassigned',
          created_date: '',
          updated_date: '',
          estimated_tokens: 0,
          actual_tokens: 0,
          ai_context: config.ai_context_templates || [],
          sync_status: 'local'
        },
        content_template: `# Issue: {{title}}

## Description
{{description}}

## Tasks
{{#related_tasks}}
- [ ] {{.}}
{{/related_tasks}}

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2

## Notes
Add any additional notes here.`
      },
      {
        type: 'task',
        name: 'default',
        description: 'Default task template',
        frontmatter_template: {
          title: 'Task Title',
          description: 'Task description',
          status: 'planning',
          priority: 'medium',
          assignee: config.default_assignee || 'unassigned',
          created_date: '',
          updated_date: '',
          estimated_tokens: 0,
          actual_tokens: 0,
          ai_context: config.ai_context_templates || [],
          sync_status: 'local'
        },
        content_template: `# Task: {{title}}

## Description
{{description}}

## Steps
1. Step 1
2. Step 2
3. Step 3

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2

## Notes
Add any additional notes here.`
      }
    ];

    for (const template of templates) {
      const templatePath = path.join(templatesDir, `${template.type}-${template.name}.yaml`);
      if (!fs.existsSync(templatePath)) {
        const templateContent = YAML.stringify(template, {
          indent: 2,
          lineWidth: 120
        });
        fs.writeFileSync(templatePath, templateContent, 'utf8');
      }
    }
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Get template by type and name
   */
  public getTemplate(type: 'epic' | 'issue' | 'task', name: string = 'default'): ItemTemplate | null {
    const templatesDir = path.join(
      path.dirname(path.dirname(this.configPath)),
      this.getConfig().structure.templates_dir
    );
    
    const templatePath = path.join(templatesDir, `${type}-${name}.yaml`);
    
    if (!fs.existsSync(templatePath)) {
      return null;
    }
    
    try {
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      return YAML.parse(templateContent) as ItemTemplate;
    } catch (error) {
      console.warn(`Failed to load template ${templatePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * List available templates
   */
  public listTemplates(): { type: string; name: string; description: string }[] {
    const config = this.getConfig();
    const templatesDir = path.join(
      path.dirname(path.dirname(this.configPath)),
      config.structure.templates_dir
    );
    
    if (!fs.existsSync(templatesDir)) {
      return [];
    }
    
    const templates: { type: string; name: string; description: string }[] = [];
    const files = fs.readdirSync(templatesDir).filter(file => file.endsWith('.yaml'));
    
    for (const file of files) {
      try {
        const templateContent = fs.readFileSync(path.join(templatesDir, file), 'utf8');
        const template = YAML.parse(templateContent) as ItemTemplate;
        templates.push({
          type: template.type,
          name: template.name,
          description: template.description
        });
      } catch (error) {
        console.warn(`Failed to parse template ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return templates;
  }
}