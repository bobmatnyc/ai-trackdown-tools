import { existsSync } from 'node:fs';
import { extname } from 'node:path';
import type { CliError } from '../types/index.js';

export class ValidationError extends Error implements CliError {
  public exitCode: number;
  public suggestion?: string;
  public command?: string;
  public validOptions?: string[];

  constructor(
    message: string,
    suggestion?: string,
    exitCode = 1,
    command?: string,
    validOptions?: string[]
  ) {
    super(message);
    this.name = 'ValidationError';
    this.exitCode = exitCode;
    this.suggestion = suggestion;
    this.command = command;
    this.validOptions = validOptions;
  }
}

export function validateRequired(value: string | undefined, fieldName: string): string {
  if (!value || value.trim().length === 0) {
    throw new ValidationError(
      `${fieldName} is required`,
      `Please provide a valid ${fieldName.toLowerCase()}`,
      1,
      undefined,
      ['Provide a non-empty value', 'Check the command usage with --help']
    );
  }
  return value.trim();
}

export function validateProjectName(name: string): string {
  const validName = validateRequired(name, 'Project name');

  // Check for valid project name format
  const nameRegex = /^[a-zA-Z0-9-_]+$/;
  if (!nameRegex.test(validName)) {
    throw new ValidationError(
      'Project name contains invalid characters',
      'Use only letters, numbers, hyphens, and underscores',
      1,
      'init',
      ['my-project', 'awesome_tool', 'project123']
    );
  }

  if (validName.length > 50) {
    throw new ValidationError(
      'Project name is too long',
      'Please use a name with 50 characters or less',
      1,
      'init'
    );
  }

  if (validName.length < 2) {
    throw new ValidationError(
      'Project name is too short',
      'Please use a name with at least 2 characters',
      1,
      'init'
    );
  }

  // Check for reserved names
  const reservedNames = ['aitrackdown', 'atd', 'config', 'help', 'version'];
  if (reservedNames.includes(validName.toLowerCase())) {
    throw new ValidationError(
      `Project name '${validName}' is reserved`,
      'Please choose a different name',
      1,
      'init',
      ['my-aitrackdown-project', 'awesome-tracker']
    );
  }

  return validName;
}

export function validatePriority(priority: string): 'low' | 'medium' | 'high' | 'critical' {
  const normalizedPriority = priority.toLowerCase().trim();
  const validPriorities = ['low', 'medium', 'high', 'critical'] as const;

  if (!validPriorities.includes(normalizedPriority as (typeof validPriorities)[number])) {
    throw new ValidationError(
      `Invalid priority: ${priority}`,
      `Valid priorities are: ${validPriorities.join(', ')}`,
      1,
      'track',
      validPriorities.map((p) => `--priority ${p}`)
    );
  }

  return normalizedPriority as 'low' | 'medium' | 'high' | 'critical';
}

export function validateStatus(status: string): 'todo' | 'in-progress' | 'done' | 'blocked' {
  const normalizedStatus = status.toLowerCase().trim();
  const validStatuses = ['todo', 'in-progress', 'done', 'blocked'] as const;

  if (!validStatuses.includes(normalizedStatus as (typeof validStatuses)[number])) {
    throw new ValidationError(
      `Invalid status: ${status}`,
      `Valid statuses are: ${validStatuses.join(', ')}`,
      1,
      'status',
      validStatuses.map((s) => `--filter status=${s}`)
    );
  }

  return normalizedStatus as 'todo' | 'in-progress' | 'done' | 'blocked';
}

export function validateOutputFormat(
  format: string
): 'json' | 'csv' | 'markdown' | 'yaml' | 'table' {
  const normalizedFormat = format.toLowerCase().trim();
  const validFormats = ['json', 'csv', 'markdown', 'yaml', 'table'] as const;

  if (!validFormats.includes(normalizedFormat as (typeof validFormats)[number])) {
    throw new ValidationError(
      `Invalid output format: ${format}`,
      `Valid formats are: ${validFormats.join(', ')}`,
      1,
      'export',
      validFormats.map((f) => `--format ${f}`)
    );
  }

  return normalizedFormat as 'json' | 'csv' | 'markdown' | 'yaml' | 'table';
}

export function validateProjectType(type: string): 'cli' | 'web' | 'api' | 'mobile' | 'general' {
  const normalizedType = type.toLowerCase().trim();
  const validTypes = ['cli', 'web', 'api', 'mobile', 'general'] as const;

  if (!validTypes.includes(normalizedType as (typeof validTypes)[number])) {
    throw new ValidationError(
      `Invalid project type: ${type}`,
      `Valid types are: ${validTypes.join(', ')}`,
      1,
      'init',
      validTypes.map((t) => `--type ${t}`)
    );
  }

  return normalizedType as 'cli' | 'web' | 'api' | 'mobile' | 'general';
}

export function validateFilePath(path: string, shouldExist = false): string {
  const validPath = validateRequired(path, 'File path');

  if (shouldExist && !existsSync(validPath)) {
    throw new ValidationError(
      `File does not exist: ${validPath}`,
      'Please check the file path and try again',
      1,
      undefined,
      ['Use an absolute path', 'Check file permissions', 'Ensure the file exists']
    );
  }

  return validPath;
}

export function validateConfigFormat(configPath: string): 'json' | 'yaml' {
  const ext = extname(configPath);

  if (ext === '.json') {
    return 'json';
  } else if (ext === '.yaml' || ext === '.yml') {
    return 'yaml';
  } else {
    throw new ValidationError(
      `Unsupported config file format: ${ext}`,
      'Configuration files must be JSON (.json) or YAML (.yaml/.yml)',
      1,
      'init',
      ['config.json', 'config.yaml', '.trackdownrc.json']
    );
  }
}

export function validateStoryPoints(points: string): number {
  const num = Number.parseFloat(points);

  if (Number.isNaN(num)) {
    throw new ValidationError(
      `Invalid story points: ${points}`,
      'Story points must be a valid number',
      1,
      'track',
      ['1', '2.5', '5', '8', '13']
    );
  }

  if (num < 0) {
    throw new ValidationError(
      'Story points cannot be negative',
      'Please provide a positive number',
      1,
      'track'
    );
  }

  if (num > 100) {
    throw new ValidationError(
      'Story points seem unusually high',
      'Consider breaking this task into smaller pieces',
      1,
      'track'
    );
  }

  return num;
}

export function validateTags(tagsString: string): string[] {
  if (!tagsString || tagsString.trim().length === 0) {
    return [];
  }

  const tags = tagsString
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  // Validate individual tags
  const tagRegex = /^[a-zA-Z0-9-_]+$/;
  const invalidTags = tags.filter((tag) => !tagRegex.test(tag));

  if (invalidTags.length > 0) {
    throw new ValidationError(
      `Invalid tags: ${invalidTags.join(', ')}`,
      'Tags can only contain letters, numbers, hyphens, and underscores',
      1,
      'track',
      ['bug', 'feature', 'urgent', 'frontend']
    );
  }

  // Check for duplicate tags
  const uniqueTags = [...new Set(tags)];
  if (uniqueTags.length !== tags.length) {
    throw new ValidationError('Duplicate tags detected', 'Each tag should be unique', 1, 'track');
  }

  return uniqueTags;
}

export function validateAssignee(assignee: string): string {
  const validAssignee = validateRequired(assignee, 'Assignee');

  // Basic email validation if it looks like an email
  if (validAssignee.includes('@')) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(validAssignee)) {
      throw new ValidationError(
        `Invalid email format: ${validAssignee}`,
        'Please provide a valid email address',
        1,
        'track',
        ['user@example.com', 'john.doe@company.com']
      );
    }
  }

  // Username validation (letters, numbers, dots, hyphens, underscores)
  const usernameRegex = /^[a-zA-Z0-9._-]+$/;
  if (!usernameRegex.test(validAssignee)) {
    throw new ValidationError(
      `Invalid assignee format: ${validAssignee}`,
      'Assignee can contain letters, numbers, dots, hyphens, and underscores',
      1,
      'track',
      ['john.doe', 'user123', 'team-lead']
    );
  }

  return validAssignee;
}

export function validateId(id: string): string {
  const validId = validateRequired(id, 'ID');

  // ID format validation
  const idRegex = /^[a-zA-Z0-9-_]+$/;
  if (!idRegex.test(validId)) {
    throw new ValidationError(
      `Invalid ID format: ${validId}`,
      'IDs can only contain letters, numbers, hyphens, and underscores',
      1,
      'track',
      ['TD-123', 'feature-login', 'bug_fix_001']
    );
  }

  if (validId.length > 50) {
    throw new ValidationError(
      'ID is too long',
      'Please use an ID with 50 characters or less',
      1,
      'track'
    );
  }

  if (validId.length < 2) {
    throw new ValidationError(
      'ID is too short',
      'Please use an ID with at least 2 characters',
      1,
      'track'
    );
  }

  return validId;
}
