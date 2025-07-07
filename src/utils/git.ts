import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export class GitManager {
  /**
   * Get the project root directory
   */
  private static getProjectRoot(): string {
    let current = process.cwd();
    while (current !== path.dirname(current)) {
      if (fs.existsSync(path.join(current, '.git'))) {
        return current;
      }
      current = path.dirname(current);
    }
    throw new Error('Not in a git repository');
  }

  /**
   * Check if we're in a git repository
   */
  static isGitRepository(): boolean {
    try {
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if there are uncommitted changes
   */
  static hasUncommittedChanges(): boolean {
    try {
      const output = execSync('git status --porcelain', { encoding: 'utf8' });
      return output.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get the current branch name
   */
  static getCurrentBranch(): string {
    try {
      return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    } catch {
      throw new Error('Could not determine current branch');
    }
  }

  /**
   * Create a git tag
   */
  static createTag(version: string, message?: string): void {
    if (!this.isGitRepository()) {
      throw new Error('Not in a git repository');
    }

    const tagName = `v${version}`;
    const tagMessage = message || `Release version ${version}`;

    try {
      // Check if tag already exists
      execSync(`git tag -l ${tagName}`, { stdio: 'ignore' });
      throw new Error(`Tag ${tagName} already exists`);
    } catch (error) {
      // Tag doesn't exist, which is what we want
    }

    try {
      execSync(`git tag -a ${tagName} -m "${tagMessage}"`);
    } catch (error) {
      throw new Error(`Failed to create tag: ${error}`);
    }
  }

  /**
   * Push tags to remote
   */
  static pushTags(): void {
    if (!this.isGitRepository()) {
      throw new Error('Not in a git repository');
    }

    try {
      execSync('git push --tags');
    } catch (error) {
      throw new Error(`Failed to push tags: ${error}`);
    }
  }

  /**
   * Get list of existing tags
   */
  static getTags(): string[] {
    if (!this.isGitRepository()) {
      return [];
    }

    try {
      const output = execSync('git tag -l', { encoding: 'utf8' });
      return output.trim().split('\n').filter(tag => tag.trim());
    } catch {
      return [];
    }
  }

  /**
   * Get the last tag
   */
  static getLastTag(): string | null {
    if (!this.isGitRepository()) {
      return null;
    }

    try {
      const output = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' });
      return output.trim();
    } catch {
      return null;
    }
  }

  /**
   * Commit changes with a message
   */
  static commit(message: string, files?: string[]): void {
    if (!this.isGitRepository()) {
      throw new Error('Not in a git repository');
    }

    try {
      // Add files if specified
      if (files && files.length > 0) {
        for (const file of files) {
          execSync(`git add "${file}"`);
        }
      }

      // Commit with message
      execSync(`git commit -m "${message}"`);
    } catch (error) {
      throw new Error(`Failed to commit changes: ${error}`);
    }
  }

  /**
   * Get commits since a specific tag or commit
   */
  static getCommitsSince(since: string): string[] {
    if (!this.isGitRepository()) {
      return [];
    }

    try {
      const output = execSync(`git log ${since}..HEAD --oneline`, { encoding: 'utf8' });
      return output.trim().split('\n').filter(line => line.trim());
    } catch {
      return [];
    }
  }

  /**
   * Check if a tag exists
   */
  static tagExists(tag: string): boolean {
    if (!this.isGitRepository()) {
      return false;
    }

    try {
      execSync(`git tag -l ${tag}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get repository URL
   */
  static getRepositoryUrl(): string | null {
    if (!this.isGitRepository()) {
      return null;
    }

    try {
      const output = execSync('git config --get remote.origin.url', { encoding: 'utf8' });
      return output.trim();
    } catch {
      return null;
    }
  }
}