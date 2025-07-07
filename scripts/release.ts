#!/usr/bin/env tsx

/**
 * Release Automation Script
 * 
 * This script automates the complete release process including:
 * - Version bumping
 * - Changelog generation
 * - Git commit and tagging
 * - Push to remote (optional)
 */

import { VersionManager } from '../src/utils/version.js';
import { ChangelogManager } from '../src/utils/changelog.js';
import { GitManager } from '../src/utils/git.js';
import chalk from 'chalk';

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const prefix = {
    info: chalk.blue('ℹ'),
    success: chalk.green('✅'),
    error: chalk.red('❌'),
    warning: chalk.yellow('⚠️'),
  }[type];
  
  console.log(`${prefix} ${message}`);
}

interface ReleaseOptions {
  type: 'major' | 'minor' | 'patch';
  push?: boolean;
  dryRun?: boolean;
  skipChangelog?: boolean;
  skipCommit?: boolean;
  skipTag?: boolean;
  message?: string;
}

async function performRelease(options: ReleaseOptions) {
  try {
    const currentVersion = VersionManager.getVersion();
    
    // Pre-flight checks
    if (GitManager.isGitRepository()) {
      if (GitManager.hasUncommittedChanges() && !options.skipCommit) {
        throw new Error('Uncommitted changes detected. Please commit or stash changes first.');
      }
    } else {
      log('Not in a git repository. Git operations will be skipped.', 'warning');
      options.skipCommit = true;
      options.skipTag = true;
    }

    // Calculate new version
    const semver = await import('semver');
    const newVersion = semver.inc(currentVersion.version, options.type);
    
    if (!newVersion) {
      throw new Error(`Could not calculate new version from ${currentVersion.version}`);
    }

    log('🚀 Starting release process...', 'info');
    
    if (options.dryRun) {
      log('🔍 Dry run mode - no changes will be made', 'info');
      log(`📦 Current version: ${currentVersion.version}`, 'info');
      log(`🎯 New version: ${newVersion}`, 'info');
      
      if (!options.skipChangelog) {
        log('📝 Would generate changelog', 'info');
      }
      
      if (!options.skipCommit && GitManager.isGitRepository()) {
        log('📝 Would commit changes', 'info');
      }
      
      if (!options.skipTag && GitManager.isGitRepository()) {
        log(`🏷️ Would create tag v${newVersion}`, 'info');
      }
      
      if (options.push && GitManager.isGitRepository()) {
        log('📤 Would push to remote', 'info');
      }
      
      return;
    }

    // Step 1: Bump version
    log(`📦 Bumping version from ${currentVersion.version} to ${newVersion}...`, 'info');
    VersionManager.bumpVersion(options.type);
    VersionManager.syncVersion();
    log('Version updated', 'success');

    // Step 2: Generate changelog
    if (!options.skipChangelog) {
      log('📝 Generating changelog...', 'info');
      const lastTag = GitManager.getLastTag();
      const since = lastTag || undefined;
      ChangelogManager.generateChangelog(newVersion, since);
      log('Changelog updated', 'success');
    }

    // Step 3: Commit changes
    if (!options.skipCommit && GitManager.isGitRepository()) {
      log('📝 Committing changes...', 'info');
      
      const commitMessage = options.message || `chore: release version ${newVersion}`;
      const filesToCommit = ['VERSION', 'package.json'];
      
      if (!options.skipChangelog) {
        filesToCommit.push('CHANGELOG.md');
      }

      GitManager.commit(commitMessage, filesToCommit);
      log('Changes committed', 'success');
    }

    // Step 4: Create tag
    if (!options.skipTag && GitManager.isGitRepository()) {
      log(`🏷️ Creating tag v${newVersion}...`, 'info');
      
      const tagMessage = `Release version ${newVersion}`;
      GitManager.createTag(newVersion, tagMessage);
      log('Tag created', 'success');
    }

    // Step 5: Push to remote
    if (options.push && GitManager.isGitRepository()) {
      log('📤 Pushing to remote...', 'info');
      
      try {
        const { execSync } = await import('child_process');
        const currentBranch = GitManager.getCurrentBranch();
        
        // Push commits
        execSync(`git push origin ${currentBranch}`);
        log('Commits pushed', 'success');
        
        // Push tags
        if (!options.skipTag) {
          GitManager.pushTags();
          log('Tags pushed', 'success');
        }
      } catch (error) {
        log(`Failed to push to remote: ${error}`, 'error');
        log('You can push manually later', 'info');
      }
    }

    // Success summary
    log('🎉 Release completed successfully!', 'success');
    log(`📦 Version: ${currentVersion.version} → ${newVersion}`, 'info');
    log(`📅 Date: ${new Date().toISOString().split('T')[0]}`, 'info');

  } catch (error) {
    log(`Release failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Usage: tsx scripts/release.ts <type> [options]

Arguments:
  type            Version bump type (major, minor, patch)

Options:
  --push          Push changes and tags to remote
  --dry-run       Show what would be done without making changes
  --skip-changelog   Skip changelog generation
  --skip-commit   Skip git commit
  --skip-tag      Skip git tag creation
  --message <msg> Custom release message

Examples:
  tsx scripts/release.ts patch
  tsx scripts/release.ts minor --push
  tsx scripts/release.ts major --dry-run
`);
    process.exit(1);
  }

  const type = args[0] as 'major' | 'minor' | 'patch';
  
  if (!['major', 'minor', 'patch'].includes(type)) {
    log('Invalid release type. Must be: major, minor, or patch', 'error');
    process.exit(1);
  }

  const options: ReleaseOptions = {
    type,
    push: args.includes('--push'),
    dryRun: args.includes('--dry-run'),
    skipChangelog: args.includes('--skip-changelog'),
    skipCommit: args.includes('--skip-commit'),
    skipTag: args.includes('--skip-tag'),
  };

  // Extract custom message
  const messageIndex = args.indexOf('--message');
  if (messageIndex !== -1 && messageIndex + 1 < args.length) {
    options.message = args[messageIndex + 1];
  }

  await performRelease(options);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}