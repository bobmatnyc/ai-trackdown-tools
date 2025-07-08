/**
 * Progress Indicator Utility
 * Provides progress indicators for long-running operations
 */

import ora, { Ora } from 'ora';
import chalk from 'chalk';

export interface ProgressOptions {
  text?: string;
  spinner?: string;
  color?: string;
  hideCursor?: boolean;
  interval?: number;
}

export interface ProgressStep {
  name: string;
  text: string;
  weight?: number; // Relative weight for progress calculation
}

export class ProgressIndicator {
  private spinner: Ora | null = null;
  private steps: ProgressStep[] = [];
  private currentStep = 0;
  private startTime: number = 0;
  private totalWeight = 0;

  constructor(private options: ProgressOptions = {}) {
    this.options = {
      spinner: 'dots',
      color: 'cyan',
      hideCursor: true,
      interval: 80,
      ...options
    };
  }

  /**
   * Start a simple spinner with text
   */
  start(text?: string): void {
    if (this.spinner) {
      this.stop();
    }

    this.startTime = Date.now();
    this.spinner = ora({
      text: text || this.options.text || 'Processing...',
      spinner: this.options.spinner,
      color: this.options.color as any,
      hideCursor: this.options.hideCursor,
      interval: this.options.interval
    }).start();
  }

  /**
   * Update spinner text
   */
  updateText(text: string): void {
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  /**
   * Update spinner with step progress
   */
  updateStep(stepName: string, text?: string): void {
    const stepIndex = this.steps.findIndex(s => s.name === stepName);
    if (stepIndex >= 0) {
      this.currentStep = stepIndex;
      const step = this.steps[stepIndex];
      const progressText = text || step.text;
      const percentage = this.calculateProgress();
      
      if (this.spinner) {
        this.spinner.text = `${progressText} ${chalk.gray(`(${percentage}%)`)}`;
      }
    }
  }

  /**
   * Set up multi-step progress
   */
  setSteps(steps: ProgressStep[]): void {
    this.steps = steps;
    this.currentStep = 0;
    this.totalWeight = steps.reduce((sum, step) => sum + (step.weight || 1), 0);
  }

  /**
   * Move to next step
   */
  nextStep(text?: string): void {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      const step = this.steps[this.currentStep];
      const stepText = text || step.text;
      const percentage = this.calculateProgress();
      
      if (this.spinner) {
        this.spinner.text = `${stepText} ${chalk.gray(`(${percentage}%)`)}`;
      }
    }
  }

  /**
   * Complete current step and move to next
   */
  completeStep(stepName?: string, text?: string): void {
    if (stepName) {
      const stepIndex = this.steps.findIndex(s => s.name === stepName);
      if (stepIndex >= 0) {
        this.currentStep = stepIndex;
      }
    }

    const step = this.steps[this.currentStep];
    const completedText = text || `${step.text} ✓`;
    
    if (this.spinner) {
      this.spinner.succeed(completedText);
    }

    // Start next step if available
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      const nextStep = this.steps[this.currentStep];
      this.start(nextStep.text);
    }
  }

  /**
   * Mark current operation as successful
   */
  succeed(text?: string): void {
    if (this.spinner) {
      const duration = this.formatDuration(Date.now() - this.startTime);
      const successText = text || this.spinner.text;
      this.spinner.succeed(`${successText} ${chalk.gray(`(${duration})`)}` );
      this.spinner = null;
    }
  }

  /**
   * Mark current operation as failed
   */
  fail(text?: string): void {
    if (this.spinner) {
      const duration = this.formatDuration(Date.now() - this.startTime);
      const failText = text || this.spinner.text;
      this.spinner.fail(`${failText} ${chalk.gray(`(${duration})`)}`);
      this.spinner = null;
    }
  }

  /**
   * Mark current operation as warning
   */
  warn(text?: string): void {
    if (this.spinner) {
      const duration = this.formatDuration(Date.now() - this.startTime);
      const warnText = text || this.spinner.text;
      this.spinner.warn(`${warnText} ${chalk.gray(`(${duration})`)}`);
      this.spinner = null;
    }
  }

  /**
   * Stop spinner without success/fail indication
   */
  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Create a progress bar for batch operations
   */
  static createProgressBar(total: number, current: number, width = 20): string {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `${chalk.cyan(bar)} ${percentage}% (${current}/${total})`;
  }

  /**
   * Show progress for batch operations
   */
  static showBatchProgress(
    operation: string,
    processed: number,
    total: number,
    current?: string
  ): void {
    const progressBar = this.createProgressBar(total, processed);
    const currentText = current ? ` - ${current}` : '';
    
    process.stdout.write(`\r${operation}: ${progressBar}${currentText}`);
    
    if (processed >= total) {
      process.stdout.write('\n');
    }
  }

  /**
   * Calculate current progress percentage
   */
  private calculateProgress(): number {
    if (this.steps.length === 0) return 0;
    
    let completedWeight = 0;
    for (let i = 0; i < this.currentStep; i++) {
      completedWeight += this.steps[i].weight || 1;
    }
    
    // Add partial progress for current step (assume 50% completion)
    if (this.currentStep < this.steps.length) {
      completedWeight += (this.steps[this.currentStep].weight || 1) * 0.5;
    }
    
    return Math.round((completedWeight / this.totalWeight) * 100);
  }

  /**
   * Format duration in human readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  }
}

/**
 * Utility function for simple spinner operations
 */
export async function withSpinner<T>(
  operation: () => Promise<T>,
  text: string,
  successText?: string,
  errorText?: string
): Promise<T> {
  const progress = new ProgressIndicator();
  progress.start(text);

  try {
    const result = await operation();
    progress.succeed(successText);
    return result;
  } catch (error) {
    progress.fail(errorText || `${text} failed`);
    throw error;
  }
}

/**
 * Utility function for multi-step operations
 */
export async function withSteppedProgress<T>(
  steps: ProgressStep[],
  operation: (updateStep: (stepName: string, text?: string) => void) => Promise<T>
): Promise<T> {
  const progress = new ProgressIndicator();
  progress.setSteps(steps);
  
  if (steps.length > 0) {
    progress.start(steps[0].text);
  }

  try {
    const result = await operation((stepName, text) => {
      progress.updateStep(stepName, text);
    });
    
    progress.succeed('Operation completed successfully');
    return result;
  } catch (error) {
    progress.fail('Operation failed');
    throw error;
  }
}

/**
 * Utility function for batch operations with progress
 */
export async function withBatchProgress<T, R>(
  items: T[],
  operation: (item: T, index: number) => Promise<R>,
  operationName = 'Processing'
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    ProgressIndicator.showBatchProgress(operationName, i, items.length, `item ${i + 1}`);
    
    try {
      const result = await operation(item, i);
      results.push(result);
    } catch (error) {
      ProgressIndicator.showBatchProgress(operationName, i + 1, items.length, `failed on item ${i + 1}`);
      throw error;
    }
  }
  
  ProgressIndicator.showBatchProgress(operationName, items.length, items.length);
  return results;
}

export default ProgressIndicator;