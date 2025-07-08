/**
 * Enhanced Error Handling System
 * Provides polished error messages and error recovery suggestions
 */

import chalk from 'chalk';
import { existsSync, accessSync, constants } from 'fs';
import path from 'path';

export enum ErrorCode {
  // General errors
  UNKNOWN = 'UNKNOWN',
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  MISSING_REQUIRED = 'MISSING_REQUIRED',
  
  // File system errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',
  FILE_EXISTS = 'FILE_EXISTS',
  DISK_FULL = 'DISK_FULL',
  
  // PR specific errors
  PR_NOT_FOUND = 'PR_NOT_FOUND',
  PR_INVALID_STATUS = 'PR_INVALID_STATUS',
  PR_INVALID_TRANSITION = 'PR_INVALID_TRANSITION',
  PR_MISSING_APPROVAL = 'PR_MISSING_APPROVAL',
  PR_DEPENDENCY_CYCLE = 'PR_DEPENDENCY_CYCLE',
  
  // Configuration errors
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  CONFIG_INVALID = 'CONFIG_INVALID',
  PROJECT_NOT_INITIALIZED = 'PROJECT_NOT_INITIALIZED',
  
  // Template errors
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  TEMPLATE_INVALID = 'TEMPLATE_INVALID',
  TEMPLATE_VARIABLE_MISSING = 'TEMPLATE_VARIABLE_MISSING',
  
  // Validation errors
  INVALID_PR_ID = 'INVALID_PR_ID',
  INVALID_ISSUE_ID = 'INVALID_ISSUE_ID',
  INVALID_EPIC_ID = 'INVALID_EPIC_ID',
  INVALID_DATE_FORMAT = 'INVALID_DATE_FORMAT',
  
  // Network/External errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  GITHUB_API_ERROR = 'GITHUB_API_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Performance errors
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED'
}

export interface ErrorContext {
  prId?: string;
  issueId?: string;
  epicId?: string;
  filePath?: string;
  operation?: string;
  details?: Record<string, any>;
}

export interface ErrorSuggestion {
  action: string;
  description: string;
  command?: string;
  url?: string;
}

export class AITrackdownError extends Error {
  public readonly code: ErrorCode;
  public readonly context: ErrorContext;
  public readonly suggestions: ErrorSuggestion[];
  public readonly recoverable: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    context: ErrorContext = {},
    suggestions: ErrorSuggestion[] = [],
    recoverable = true
  ) {
    super(message);
    this.name = 'AITrackdownError';
    this.code = code;
    this.context = context;
    this.suggestions = suggestions;
    this.recoverable = recoverable;

    // Maintain proper stack trace
    Error.captureStackTrace(this, AITrackdownError);
  }
}

export class ErrorHandler {
  /**
   * Format and display error with suggestions
   */
  static handleError(error: unknown, exit = true): void {
    if (error instanceof AITrackdownError) {
      this.displayAITrackdownError(error);
    } else if (error instanceof Error) {
      this.displayGenericError(error);
    } else {
      this.displayUnknownError(error);
    }

    if (exit) {
      process.exit(1);
    }
  }

  /**
   * Display formatted AI Trackdown error
   */
  private static displayAITrackdownError(error: AITrackdownError): void {
    console.error();
    console.error(chalk.red.bold('✖ Error:'), chalk.red(error.message));
    
    if (error.code !== ErrorCode.UNKNOWN) {
      console.error(chalk.gray(`Code: ${error.code}`));
    }

    // Display context if available
    if (Object.keys(error.context).length > 0) {
      console.error();
      console.error(chalk.yellow('Context:'));
      Object.entries(error.context).forEach(([key, value]) => {
        if (value !== undefined) {
          console.error(chalk.gray(`  ${key}: ${value}`));
        }
      });
    }

    // Display suggestions
    if (error.suggestions.length > 0) {
      console.error();
      console.error(chalk.cyan('💡 Suggestions:'));
      error.suggestions.forEach((suggestion, index) => {
        console.error(chalk.cyan(`  ${index + 1}. ${suggestion.action}`));
        console.error(chalk.gray(`     ${suggestion.description}`));
        
        if (suggestion.command) {
          console.error(chalk.gray(`     Command: ${chalk.white(suggestion.command)}`));
        }
        
        if (suggestion.url) {
          console.error(chalk.gray(`     Help: ${suggestion.url}`));
        }
      });
    }

    // Display recovery info
    if (error.recoverable) {
      console.error();
      console.error(chalk.green('ℹ This error is recoverable. Follow the suggestions above to resolve it.'));
    } else {
      console.error();
      console.error(chalk.red('⚠ This is a critical error that may require manual intervention.'));
    }
  }

  /**
   * Display generic error
   */
  private static displayGenericError(error: Error): void {
    console.error();
    console.error(chalk.red.bold('✖ Unexpected Error:'), chalk.red(error.message));
    
    if (process.env.DEBUG) {
      console.error();
      console.error(chalk.gray('Stack trace:'));
      console.error(chalk.gray(error.stack));
    } else {
      console.error();
      console.error(chalk.gray('Run with DEBUG=* for more details'));
    }
  }

  /**
   * Display unknown error
   */
  private static displayUnknownError(error: unknown): void {
    console.error();
    console.error(chalk.red.bold('✖ Unknown Error:'), chalk.red(String(error)));
  }

  /**
   * Create PR not found error
   */
  static prNotFound(prId: string): AITrackdownError {
    return new AITrackdownError(
      ErrorCode.PR_NOT_FOUND,
      `Pull request '${prId}' not found`,
      { prId },
      [
        {
          action: 'Check if PR ID is correct',
          description: 'Verify the PR ID format (e.g., PR-001) and spelling',
          command: 'aitrackdown pr list'
        },
        {
          action: 'Search in all statuses',
          description: 'The PR might be in a different status directory',
          command: `aitrackdown pr list | grep ${prId}`
        },
        {
          action: 'List recent PRs',
          description: 'Show recently created PRs to find the correct ID',
          command: 'aitrackdown pr list --sort created --reverse --limit 10'
        }
      ]
    );
  }

  /**
   * Create invalid status transition error
   */
  static invalidStatusTransition(prId: string, fromStatus: string, toStatus: string): AITrackdownError {
    const validTransitions = this.getValidTransitions(fromStatus);
    
    return new AITrackdownError(
      ErrorCode.PR_INVALID_TRANSITION,
      `Cannot transition PR '${prId}' from '${fromStatus}' to '${toStatus}'`,
      { prId, operation: 'status_transition', details: { fromStatus, toStatus } },
      [
        {
          action: 'Check valid transitions',
          description: `Valid transitions from '${fromStatus}': ${validTransitions.join(', ')}`,
        },
        {
          action: 'Update to valid status first',
          description: 'Use an intermediate status if needed',
          command: `aitrackdown pr update ${prId} --status ${validTransitions[0]}`
        },
        {
          action: 'Show current PR status',
          description: 'Verify the current status of the PR',
          command: `aitrackdown pr show ${prId}`
        }
      ]
    );
  }

  /**
   * Create file not found error
   */
  static fileNotFound(filePath: string, operation?: string): AITrackdownError {
    const suggestions: ErrorSuggestion[] = [
      {
        action: 'Check file path',
        description: 'Verify the file path is correct and accessible',
      }
    ];

    // Add specific suggestions based on file type
    if (filePath.includes('ai-trackdown.json')) {
      suggestions.push({
        action: 'Initialize project',
        description: 'Create a new AI Trackdown project',
        command: 'aitrackdown init'
      });
    } else if (filePath.includes('template')) {
      suggestions.push({
        action: 'Create missing templates',
        description: 'Generate default templates',
        command: 'aitrackdown init --create-templates'
      });
    } else if (filePath.includes('prs/')) {
      suggestions.push({
        action: 'Initialize PR directories',
        description: 'Create PR directory structure',
        command: 'aitrackdown init --create-directories'
      });
    }

    return new AITrackdownError(
      ErrorCode.FILE_NOT_FOUND,
      `File not found: ${filePath}`,
      { filePath, operation },
      suggestions
    );
  }

  /**
   * Create permission denied error
   */
  static permissionDenied(filePath: string, operation?: string): AITrackdownError {
    return new AITrackdownError(
      ErrorCode.PERMISSION_DENIED,
      `Permission denied accessing: ${filePath}`,
      { filePath, operation },
      [
        {
          action: 'Check file permissions',
          description: 'Verify you have read/write access to the file',
          command: `ls -la ${path.dirname(filePath)}`
        },
        {
          action: 'Fix permissions',
          description: 'Update file permissions if needed',
          command: `chmod 755 ${path.dirname(filePath)}`
        },
        {
          action: 'Check ownership',
          description: 'Ensure you own the file or have appropriate access',
          command: `ls -la ${filePath}`
        }
      ]
    );
  }

  /**
   * Create invalid PR ID error
   */
  static invalidPRId(prId: string): AITrackdownError {
    return new AITrackdownError(
      ErrorCode.INVALID_PR_ID,
      `Invalid PR ID format: '${prId}'`,
      { prId },
      [
        {
          action: 'Use correct format',
          description: 'PR IDs should follow the format PR-XXX (e.g., PR-001, PR-123)',
        },
        {
          action: 'Check existing PRs',
          description: 'List existing PRs to see the correct format',
          command: 'aitrackdown pr list'
        },
        {
          action: 'Use auto-generated ID',
          description: 'Let the system generate the ID when creating new PRs',
          command: 'aitrackdown pr create --title "Your PR Title" --issue ISSUE-001'
        }
      ]
    );
  }

  /**
   * Create project not initialized error
   */
  static projectNotInitialized(): AITrackdownError {
    return new AITrackdownError(
      ErrorCode.PROJECT_NOT_INITIALIZED,
      'AI Trackdown project not initialized in this directory',
      {},
      [
        {
          action: 'Initialize project',
          description: 'Create a new AI Trackdown project in the current directory',
          command: 'aitrackdown init'
        },
        {
          action: 'Change directory',
          description: 'Navigate to an existing AI Trackdown project directory',
        },
        {
          action: 'Check for config file',
          description: 'Look for ai-trackdown.json in parent directories',
          command: 'find . -name "ai-trackdown.json" -type f'
        }
      ]
    );
  }

  /**
   * Create missing approval error
   */
  static missingApproval(prId: string, requiredApprovals: number, currentApprovals: number): AITrackdownError {
    const needed = requiredApprovals - currentApprovals;
    
    return new AITrackdownError(
      ErrorCode.PR_MISSING_APPROVAL,
      `PR '${prId}' needs ${needed} more approval(s) before merging`,
      { prId, details: { requiredApprovals, currentApprovals, needed } },
      [
        {
          action: 'Request reviews',
          description: 'Add more reviewers to the PR',
          command: `aitrackdown pr update ${prId} --add-reviewer @reviewer`
        },
        {
          action: 'Get approvals',
          description: 'Ask reviewers to approve the PR',
          command: `aitrackdown pr review ${prId} --approve --comments "LGTM"`
        },
        {
          action: 'Show PR details',
          description: 'Check current approval status',
          command: `aitrackdown pr show ${prId} --show-reviews`
        }
      ]
    );
  }

  /**
   * Create template not found error
   */
  static templateNotFound(templateName: string): AITrackdownError {
    return new AITrackdownError(
      ErrorCode.TEMPLATE_NOT_FOUND,
      `Template '${templateName}' not found`,
      { details: { templateName } },
      [
        {
          action: 'Create missing templates',
          description: 'Generate default templates',
          command: 'aitrackdown init --create-templates'
        },
        {
          action: 'List available templates',
          description: 'Show available template files',
          command: 'ls -la templates/'
        },
        {
          action: 'Use default template',
          description: 'Omit --template option to use the default template',
        }
      ]
    );
  }

  /**
   * Validate file access and throw appropriate error
   */
  static validateFileAccess(filePath: string, operation = 'access'): void {
    if (!existsSync(filePath)) {
      throw this.fileNotFound(filePath, operation);
    }

    try {
      accessSync(filePath, constants.R_OK);
    } catch {
      throw this.permissionDenied(filePath, operation);
    }
  }

  /**
   * Validate PR ID format
   */
  static validatePRId(prId: string): void {
    const prIdPattern = /^PR-\d{3,4}$/;
    if (!prIdPattern.test(prId)) {
      throw this.invalidPRId(prId);
    }
  }

  /**
   * Get valid status transitions for a given status
   */
  private static getValidTransitions(status: string): string[] {
    const transitions: Record<string, string[]> = {
      'draft': ['open', 'closed'],
      'open': ['review', 'closed'],
      'review': ['approved', 'open', 'closed'],
      'approved': ['merged', 'review', 'closed'],
      'merged': [],
      'closed': ['open']
    };

    return transitions[status] || [];
  }

  /**
   * Wrap async operations with error handling
   */
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: ErrorContext = {}
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof AITrackdownError) {
        // Add context to existing error
        error.context = { ...error.context, ...context };
        throw error;
      } else if (error instanceof Error) {
        // Convert to AITrackdownError
        throw new AITrackdownError(
          ErrorCode.UNKNOWN,
          error.message,
          context,
          [{
            action: 'Check error details',
            description: 'Review the error message and stack trace for more information'
          }]
        );
      } else {
        // Handle unknown error types
        throw new AITrackdownError(
          ErrorCode.UNKNOWN,
          `Unknown error: ${String(error)}`,
          context
        );
      }
    }
  }
}

export default ErrorHandler;