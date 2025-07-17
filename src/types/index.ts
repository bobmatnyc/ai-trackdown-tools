// Core CLI types and interfaces

// Export new AI-Trackdown types
export * from './ai-trackdown.js';
export * from './comment.js';

export interface CommandOptions {
  verbose?: boolean;
  config?: string;
  help?: boolean;
  noColor?: boolean;
}

export interface TrackdownConfig {
  projectName?: string;
  outputFormat?: 'json' | 'yaml' | 'md' | 'csv' | 'table';
  defaultAssignee?: string;
  templatePath?: string;
  defaultTemplate?: string;
  colorOutput?: boolean;
  defaultPriority?: 'low' | 'medium' | 'high' | 'critical';
  autoAssign?: boolean;
  rootDirectory?: string; // NEW: configurable root directory
  migrateFromTrackdown?: boolean; // NEW: migration flag
  customFields?: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date';
    required?: boolean;
    default?: any;
  }>;
  integrations?: {
    git?: boolean;
    jira?: boolean;
    slack?: boolean;
  };
  exportSettings?: {
    includeCompleted?: boolean;
    dateFormat?: string;
    timezone?: string;
  };
}

export interface TrackdownItem {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee?: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  estimate?: number;
  labels?: string[];
  metadata?: Record<string, any>;
}

export interface CliError extends Error {
  exitCode: number;
  suggestion?: string;
  command?: string;
  validOptions?: string[];
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface ProjectTemplate {
  name: string;
  description: string;
  type: 'cli' | 'web' | 'api' | 'mobile' | 'general';
  structure: Array<{
    path: string;
    type: 'file' | 'directory';
    content?: string;
  }>;
  config?: Partial<TrackdownConfig>;
}

export interface ExportOptions {
  format: 'json' | 'csv' | 'markdown' | 'pdf' | 'yaml';
  output?: string;
  filter?: {
    status?: string[];
    priority?: string[];
    assignee?: string[];
    tags?: string[];
    dateRange?: {
      start?: Date;
      end?: Date;
    };
  };
  template?: string;
  includeMetadata?: boolean;
}

export interface StatusFilter {
  // Single value filters
  status?: string;
  priority?: string;
  assignee?: string;
  id?: string;

  // Multi-value filters
  statusIn?: string[];
  priorityIn?: string[];
  tags?: string[];

  // Date filters
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;

  // Estimate filters
  estimateMin?: number;
  estimateMax?: number;

  // Legacy/compatibility
  search?: string;
}

export interface Colors {
  primary: (text: string) => string;
  success: (text: string) => string;
  warning: (text: string) => string;
  error: (text: string) => string;
  info: (text: string) => string;
  muted: (text: string) => string;
  highlight: (text: string) => string;
}
