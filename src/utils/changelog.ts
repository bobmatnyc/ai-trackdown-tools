import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { VersionManager } from './version.js';

export interface ChangelogEntry {
  version: string;
  date: string;
  sections: {
    added: string[];
    changed: string[];
    deprecated: string[];
    removed: string[];
    fixed: string[];
    security: string[];
  };
}

export interface ConventionalCommit {
  type: string;
  scope?: string;
  description: string;
  body?: string;
  breaking: boolean;
  hash: string;
}

export class ChangelogManager {
  private static readonly CHANGELOG_FILE = 'CHANGELOG.md';

  /**
   * Get the project root directory
   */
  private static getProjectRoot(): string {
    let current = process.cwd();
    while (current !== path.dirname(current)) {
      if (fs.existsSync(path.join(current, 'package.json'))) {
        return current;
      }
      current = path.dirname(current);
    }
    throw new Error('Could not find project root (no package.json found)');
  }

  /**
   * Parse conventional commits from git log
   */
  static parseCommits(since?: string): ConventionalCommit[] {
    const projectRoot = this.getProjectRoot();

    try {
      const sinceFlag = since ? `--since="${since}"` : '';
      const gitLog = execSync(`git log --pretty=format:"%H|%s|%b" --no-merges ${sinceFlag}`, {
        cwd: projectRoot,
        encoding: 'utf8',
      });

      if (!gitLog.trim()) {
        return [];
      }

      return gitLog
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const [hash, subject, body] = line.split('|');
          return this.parseConventionalCommit(hash, subject, body || '');
        })
        .filter((commit) => commit !== null) as ConventionalCommit[];
    } catch (error) {
      console.warn('Warning: Could not parse git commits. Make sure you are in a git repository.');
      return [];
    }
  }

  /**
   * Parse a single conventional commit
   */
  private static parseConventionalCommit(
    hash: string,
    subject: string,
    body: string
  ): ConventionalCommit | null {
    // Conventional commit pattern: type(scope): description
    const conventionalPattern = /^(\w+)(\([^)]+\))?!?:\s*(.+)$/;
    const match = subject.match(conventionalPattern);

    if (!match) {
      // Return as a generic commit if it doesn't match conventional format
      return {
        type: 'other',
        description: subject,
        body,
        breaking: subject.includes('BREAKING') || body.includes('BREAKING CHANGE'),
        hash: hash.substring(0, 7),
      };
    }

    const [, type, scopeMatch, description] = match;
    const scope = scopeMatch ? scopeMatch.slice(1, -1) : undefined;
    const breaking = subject.includes('!') || body.includes('BREAKING CHANGE');

    return {
      type,
      scope,
      description,
      body,
      breaking,
      hash: hash.substring(0, 7),
    };
  }

  /**
   * Categorize commits into changelog sections
   */
  static categorizeCommits(commits: ConventionalCommit[]): ChangelogEntry['sections'] {
    const sections: ChangelogEntry['sections'] = {
      added: [],
      changed: [],
      deprecated: [],
      removed: [],
      fixed: [],
      security: [],
    };

    for (const commit of commits) {
      const entry = commit.scope
        ? `**${commit.scope}**: ${commit.description} (${commit.hash})`
        : `${commit.description} (${commit.hash})`;

      switch (commit.type) {
        case 'feat':
          sections.added.push(entry);
          break;
        case 'fix':
          sections.fixed.push(entry);
          break;
        case 'perf':
          sections.changed.push(entry);
          break;
        case 'refactor':
          sections.changed.push(entry);
          break;
        case 'docs':
          sections.changed.push(entry);
          break;
        case 'style':
          sections.changed.push(entry);
          break;
        case 'test':
          sections.changed.push(entry);
          break;
        case 'chore':
          sections.changed.push(entry);
          break;
        case 'security':
          sections.security.push(entry);
          break;
        default:
          if (commit.breaking) {
            sections.changed.push(entry);
          } else {
            sections.changed.push(entry);
          }
      }

      // Handle breaking changes
      if (commit.breaking) {
        const breakingEntry = `**BREAKING**: ${commit.description} (${commit.hash})`;
        if (!sections.changed.includes(breakingEntry)) {
          sections.changed.unshift(breakingEntry);
        }
      }
    }

    return sections;
  }

  /**
   * Generate changelog entry for current version
   */
  static generateChangelogEntry(version?: string, since?: string): ChangelogEntry {
    const currentVersion = version || VersionManager.getVersion().version;
    const commits = this.parseCommits(since);
    const sections = this.categorizeCommits(commits);

    return {
      version: currentVersion,
      date: new Date().toISOString().split('T')[0],
      sections,
    };
  }

  /**
   * Format changelog entry as markdown
   */
  static formatChangelogEntry(entry: ChangelogEntry): string {
    const lines: string[] = [];

    lines.push(`## [${entry.version}] - ${entry.date}`);
    lines.push('');

    // Add each section if it has content
    const sectionNames = {
      added: 'Added',
      changed: 'Changed',
      deprecated: 'Deprecated',
      removed: 'Removed',
      fixed: 'Fixed',
      security: 'Security',
    };

    for (const [key, title] of Object.entries(sectionNames)) {
      const items = entry.sections[key as keyof typeof entry.sections];
      if (items.length > 0) {
        lines.push(`### ${title}`);
        for (const item of items) {
          lines.push(`- ${item}`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate or update CHANGELOG.md
   */
  static generateChangelog(version?: string, since?: string): void {
    const projectRoot = this.getProjectRoot();
    const changelogPath = path.join(projectRoot, this.CHANGELOG_FILE);

    const entry = this.generateChangelogEntry(version, since);
    const entryMarkdown = this.formatChangelogEntry(entry);

    let changelogContent = '';

    if (fs.existsSync(changelogPath)) {
      // Read existing changelog
      const existingContent = fs.readFileSync(changelogPath, 'utf8');

      // Find where to insert the new entry
      const headerEndIndex = existingContent.indexOf('\n## ');
      if (headerEndIndex !== -1) {
        const header = existingContent.substring(0, headerEndIndex + 1);
        const rest = existingContent.substring(headerEndIndex + 1);
        changelogContent = header + entryMarkdown + '\n' + rest;
      } else {
        changelogContent = existingContent + '\n' + entryMarkdown;
      }
    } else {
      // Create new changelog
      changelogContent = this.createChangelogHeader() + entryMarkdown;
    }

    fs.writeFileSync(changelogPath, changelogContent);
  }

  /**
   * Create changelog header
   */
  private static createChangelogHeader(): string {
    return `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;
  }

  /**
   * Get the latest version from CHANGELOG.md
   */
  static getLatestChangelogVersion(): string | null {
    const projectRoot = this.getProjectRoot();
    const changelogPath = path.join(projectRoot, this.CHANGELOG_FILE);

    if (!fs.existsSync(changelogPath)) {
      return null;
    }

    const content = fs.readFileSync(changelogPath, 'utf8');
    const versionMatch = content.match(/## \[([^\]]+)\]/);

    return versionMatch ? versionMatch[1] : null;
  }
}
