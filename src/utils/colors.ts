import chalk from 'chalk';
import type { Colors } from '../types/index.js';

/**
 * Professional color scheme for the CLI
 * Provides consistent, accessible colors across the application
 */
export const colors: Colors = {
  // Main brand color - cyan for professional tech feel
  primary: chalk.cyan,
  
  // Success operations and positive feedback
  success: chalk.green,
  
  // Warnings and cautionary messages
  warning: chalk.yellow,
  
  // Errors and critical issues
  error: chalk.red,
  
  // Informational messages and tips
  info: chalk.blue,
  
  // Secondary text and less important information
  muted: chalk.gray,
  
  // Important highlights and emphasis
  highlight: chalk.bold.white,
};

/**
 * Specialized color functions for specific UI elements
 */
export class ColorTheme {
  // Priority-based colors
  static priority(level: string): (text: string) => string {
    switch (level.toLowerCase()) {
      case 'low':
        return chalk.gray;
      case 'medium':
        return chalk.yellow;
      case 'high':
        return chalk.magenta;
      case 'critical':
        return chalk.red.bold;
      default:
        return chalk.white;
    }
  }

  // Status-based colors
  static status(status: string): (text: string) => string {
    switch (status.toLowerCase()) {
      case 'todo':
        return chalk.gray;
      case 'in-progress':
        return chalk.blue;
      case 'done':
        return chalk.green;
      case 'blocked':
        return chalk.red;
      default:
        return chalk.white;
    }
  }

  // Command-specific colors
  static command(command: string): string {
    return chalk.cyan.bold(command);
  }

  // Option colors
  static option(option: string): string {
    return chalk.yellow(option);
  }

  // Argument colors
  static argument(arg: string): string {
    return chalk.green(arg);
  }

  // Header styling
  static header(text: string): string {
    return chalk.bold.cyan(`\n${text}\n${'='.repeat(text.length)}`);
  }

  // Subheader styling
  static subheader(text: string): string {
    return chalk.bold.white(`\n${text}\n${'-'.repeat(text.length)}`);
  }

  // Badge styling for tags, labels, etc.
  static badge(text: string, variant: 'info' | 'success' | 'warning' | 'error' = 'info'): string {
    const colorFn = colors[variant];
    return colorFn(` ${text} `);
  }

  // Create a bordered box for important messages
  static box(text: string, variant: 'info' | 'success' | 'warning' | 'error' = 'info'): string {
    const lines = text.split('\n');
    const maxLength = Math.max(...lines.map(line => line.length));
    const colorFn = colors[variant];
    
    const border = '─'.repeat(maxLength + 2);
    const top = `┌${border}┐`;
    const bottom = `└${border}┘`;
    
    const content = lines.map(line => 
      `│ ${line.padEnd(maxLength)} │`
    ).join('\n');
    
    return colorFn(`${top}\n${content}\n${bottom}`);
  }

  // Progress indicators
  static progress(current: number, total: number): string {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * 20);
    const empty = 20 - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    if (percentage < 30) {
      return chalk.red(`[${bar}] ${percentage}%`);
    } else if (percentage < 70) {
      return chalk.yellow(`[${bar}] ${percentage}%`);
    } else {
      return chalk.green(`[${bar}] ${percentage}%`);
    }
  }

  // Create a separator line
  static separator(char = '─', length = 50): string {
    return chalk.gray(char.repeat(length));
  }

  // Timestamp formatting
  static timestamp(date: Date): string {
    return chalk.dim(date.toISOString().replace('T', ' ').substring(0, 19));
  }

  // File path formatting
  static path(path: string): string {
    return chalk.cyan.underline(path);
  }

  // Code formatting
  static code(code: string): string {
    return chalk.gray.inverse(` ${code} `);
  }

  // URL formatting
  static url(url: string): string {
    return chalk.blue.underline(url);
  }

  // Keyboard shortcut formatting
  static key(key: string): string {
    return chalk.inverse(` ${key} `);
  }
}

/**
 * Check if colors should be disabled based on environment
 */
export function shouldUseColors(): boolean {
  // Check environment variables
  if (process.env.NO_COLOR || process.env.FORCE_COLOR === '0') {
    return false;
  }
  
  if (process.env.FORCE_COLOR === '1' || process.env.FORCE_COLOR === '2' || process.env.FORCE_COLOR === '3') {
    return true;
  }
  
  // Check if stdout is a TTY
  return process.stdout.isTTY;
}

/**
 * Disable colors globally
 */
export function disableColors(): void {
  chalk.level = 0;
}

/**
 * Enable colors globally
 */
export function enableColors(): void {
  chalk.level = 3;
}