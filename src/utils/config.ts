import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { homedir } from 'node:os';
import YAML from 'yaml';
import type { TrackdownConfig } from '../types/index.js';

const DEFAULT_CONFIG: TrackdownConfig = {
  projectName: 'trackdown-project',
  outputFormat: 'md',
  defaultAssignee: 'unassigned',
  templatePath: './templates',
  defaultTemplate: 'standard',
  colorOutput: true,
  defaultPriority: 'medium',
  autoAssign: true,
  customFields: [],
  integrations: {
    git: true,
    jira: false,
    slack: false,
  },
  exportSettings: {
    includeCompleted: true,
    dateFormat: 'YYYY-MM-DD',
    timezone: 'UTC',
  },
};

export class ConfigManager {
  private configPath: string;
  private config: TrackdownConfig;
  private globalConfigPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || this.findConfigFile();
    this.globalConfigPath = join(homedir(), '.trackdown', 'config.json');
    this.config = this.loadConfig();
  }

  private findConfigFile(): string {
    const possibleFiles = [
      '.trackdownrc.json',
      '.trackdownrc.yaml',
      '.trackdownrc.yml',
      'trackdown.config.json',
      'trackdown.config.yaml',
      'trackdown.config.yml',
    ];

    for (const file of possibleFiles) {
      const fullPath = join(process.cwd(), file);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }

    return join(process.cwd(), '.trackdownrc.json');
  }

  private loadConfig(): TrackdownConfig {
    let config = { ...DEFAULT_CONFIG };

    // Load global configuration first
    config = { ...config, ...this.loadConfigFile(this.globalConfigPath) };

    // Load local configuration (overrides global)
    config = { ...config, ...this.loadConfigFile(this.configPath) };

    // Load environment variables (overrides file configs)
    config = { ...config, ...this.loadEnvironmentConfig() };

    return config;
  }

  private loadConfigFile(path: string): Partial<TrackdownConfig> {
    try {
      if (!existsSync(path)) {
        return {};
      }

      const fileContent = readFileSync(path, 'utf-8');
      const ext = extname(path);

      if (ext === '.yaml' || ext === '.yml') {
        return YAML.parse(fileContent) as TrackdownConfig;
      } else {
        return JSON.parse(fileContent) as TrackdownConfig;
      }
    } catch (error) {
      console.warn(`Warning: Could not load config from ${path}, skipping`);
      return {};
    }
  }

  private loadEnvironmentConfig(): Partial<TrackdownConfig> {
    const envConfig: Partial<TrackdownConfig> = {};

    if (process.env.TRACKDOWN_PROJECT_NAME) {
      envConfig.projectName = process.env.TRACKDOWN_PROJECT_NAME;
    }

    if (process.env.TRACKDOWN_OUTPUT_FORMAT) {
      envConfig.outputFormat = process.env.TRACKDOWN_OUTPUT_FORMAT as any;
    }

    if (process.env.TRACKDOWN_DEFAULT_ASSIGNEE) {
      envConfig.defaultAssignee = process.env.TRACKDOWN_DEFAULT_ASSIGNEE;
    }

    if (process.env.TRACKDOWN_DEFAULT_PRIORITY) {
      envConfig.defaultPriority = process.env.TRACKDOWN_DEFAULT_PRIORITY as any;
    }

    if (process.env.TRACKDOWN_TEMPLATE_PATH) {
      envConfig.templatePath = process.env.TRACKDOWN_TEMPLATE_PATH;
    }

    if (process.env.TRACKDOWN_COLOR_OUTPUT) {
      envConfig.colorOutput = process.env.TRACKDOWN_COLOR_OUTPUT === 'true';
    }

    if (process.env.TRACKDOWN_AUTO_ASSIGN) {
      envConfig.autoAssign = process.env.TRACKDOWN_AUTO_ASSIGN === 'true';
    }

    return envConfig;
  }

  public getConfig(): TrackdownConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<TrackdownConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  public saveConfig(global = false): void {
    const targetPath = global ? this.globalConfigPath : this.configPath;
    
    try {
      // Ensure directory exists
      const dir = join(targetPath, '..');
      if (!existsSync(dir)) {
        require('fs').mkdirSync(dir, { recursive: true });
      }

      const ext = extname(targetPath);
      let content: string;

      if (ext === '.yaml' || ext === '.yml') {
        content = YAML.stringify(this.config);
      } else {
        content = JSON.stringify(this.config, null, 2);
      }

      writeFileSync(targetPath, content);
    } catch (error) {
      throw new Error(`Failed to save config to ${targetPath}: ${error}`);
    }
  }

  public resetConfig(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.saveConfig();
  }

  public getConfigPath(): string {
    return this.configPath;
  }

  public getGlobalConfigPath(): string {
    return this.globalConfigPath;
  }

  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.outputFormat && !['json', 'yaml', 'md', 'csv', 'table'].includes(this.config.outputFormat)) {
      errors.push(`Invalid output format: ${this.config.outputFormat}`);
    }

    if (this.config.defaultPriority && !['low', 'medium', 'high', 'critical'].includes(this.config.defaultPriority)) {
      errors.push(`Invalid default priority: ${this.config.defaultPriority}`);
    }

    if (this.config.customFields) {
      this.config.customFields.forEach((field, index) => {
        if (!field.name) {
          errors.push(`Custom field at index ${index} is missing a name`);
        }
        if (!['string', 'number', 'boolean', 'date'].includes(field.type)) {
          errors.push(`Custom field '${field.name}' has invalid type: ${field.type}`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  public createDefaultConfigFile(format: 'json' | 'yaml' = 'json'): string {
    const filename = format === 'yaml' ? '.trackdownrc.yaml' : '.trackdownrc.json';
    const path = join(process.cwd(), filename);
    
    this.configPath = path;
    this.config = { ...DEFAULT_CONFIG };
    this.saveConfig();
    
    return path;
  }
}
