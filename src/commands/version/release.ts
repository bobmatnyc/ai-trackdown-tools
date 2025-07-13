import { Command } from 'commander';
import { ChangelogManager } from '../../utils/changelog.js';
import { Formatter } from '../../utils/formatter.js';
import { GitManager } from '../../utils/git.js';
import { VersionManager } from '../../utils/version.js';

export function createReleaseCommand(): Command {
  const command = new Command('release');

  command
    .description('Create a complete release with version bump, changelog, and git tag')
    .argument('[type]', 'version bump type (major, minor, patch)', 'patch')
    .option('--no-changelog', 'skip changelog generation')
    .option('--no-commit', 'skip git commit')
    .option('--no-tag', 'skip git tag creation')
    .option('--push', 'push changes and tags to remote')
    .option('--dry-run', 'show what would be done without making changes')
    .option('--message <msg>', 'custom release message')
    .action(async (type: string, options) => {
      try {
        // Validate bump type
        if (!['major', 'minor', 'patch'].includes(type)) {
          console.error(Formatter.error('Invalid release type. Must be: major, minor, or patch'));
          process.exit(1);
        }

        const currentVersion = VersionManager.getVersion();

        // Pre-flight checks
        if (GitManager.isGitRepository()) {
          if (GitManager.hasUncommittedChanges() && !options.noCommit) {
            console.error(
              Formatter.error('Uncommitted changes detected. Please commit or stash changes first.')
            );
            process.exit(1);
          }
        } else {
          console.warn(
            Formatter.warning('Not in a git repository. Git operations will be skipped.')
          );
          options.noCommit = true;
          options.noTag = true;
        }

        // Calculate new version
        const semver = await import('semver');
        const newVersion = semver.inc(currentVersion.version, type as any);

        if (!newVersion) {
          throw new Error(`Could not calculate new version from ${currentVersion.version}`);
        }

        console.log(Formatter.info('🚀 Starting release process...'));
        console.log('');

        if (options.dryRun) {
          console.log(Formatter.info('🔍 Dry run mode - no changes will be made'));
          console.log('');
          console.log(Formatter.info('📋 Release plan:'));
          console.log(Formatter.info(`   📦 Current version: ${currentVersion.version}`));
          console.log(Formatter.info(`   🎯 New version: ${newVersion}`));

          if (!options.noChangelog) {
            console.log(Formatter.info('   📝 Generate changelog'));
          }

          if (!options.noCommit && GitManager.isGitRepository()) {
            console.log(Formatter.info('   📝 Commit changes'));
          }

          if (!options.noTag && GitManager.isGitRepository()) {
            console.log(Formatter.info(`   🏷️  Create tag v${newVersion}`));
          }

          if (options.push && GitManager.isGitRepository()) {
            console.log(Formatter.info('   📤 Push to remote'));
          }

          return;
        }

        // Step 1: Bump version
        console.log(
          Formatter.info(`📦 Bumping version from ${currentVersion.version} to ${newVersion}...`)
        );
        VersionManager.bumpVersion(type as 'major' | 'minor' | 'patch');
        VersionManager.syncVersion();
        console.log(Formatter.success('✅ Version updated'));

        // Step 2: Generate changelog
        if (!options.noChangelog) {
          console.log(Formatter.info('📝 Generating changelog...'));
          const lastTag = GitManager.getLastTag();
          const since = lastTag || undefined;
          ChangelogManager.generateChangelog(newVersion, since);
          console.log(Formatter.success('✅ Changelog updated'));
        }

        // Step 3: Commit changes
        if (!options.noCommit && GitManager.isGitRepository()) {
          console.log(Formatter.info('📝 Committing changes...'));

          const commitMessage = options.message || `chore: release version ${newVersion}`;
          const filesToCommit = ['VERSION', 'package.json'];

          if (!options.noChangelog) {
            filesToCommit.push('CHANGELOG.md');
          }

          GitManager.commit(commitMessage, filesToCommit);
          console.log(Formatter.success('✅ Changes committed'));
        }

        // Step 4: Create tag
        if (!options.noTag && GitManager.isGitRepository()) {
          console.log(Formatter.info(`🏷️  Creating tag v${newVersion}...`));

          const tagMessage = `Release version ${newVersion}`;
          GitManager.createTag(newVersion, tagMessage);
          console.log(Formatter.success('✅ Tag created'));
        }

        // Step 5: Push to remote
        if (options.push && GitManager.isGitRepository()) {
          console.log(Formatter.info('📤 Pushing to remote...'));

          try {
            const { execSync } = await import('node:child_process');
            const currentBranch = GitManager.getCurrentBranch();

            // Push commits
            execSync(`git push origin ${currentBranch}`);
            console.log(Formatter.success('✅ Commits pushed'));

            // Push tags
            if (!options.noTag) {
              GitManager.pushTags();
              console.log(Formatter.success('✅ Tags pushed'));
            }
          } catch (error) {
            console.error(Formatter.error(`Failed to push to remote: ${error}`));
            console.log(Formatter.info('💡 You can push manually later'));
          }
        }

        // Success summary
        console.log('');
        console.log(Formatter.success('🎉 Release completed successfully!'));
        console.log('');
        console.log(Formatter.info('📋 Release summary:'));
        console.log(Formatter.info(`   📦 Version: ${currentVersion.version} → ${newVersion}`));
        console.log(Formatter.info(`   📅 Date: ${new Date().toISOString().split('T')[0]}`));

        if (!options.noChangelog) {
          console.log(Formatter.info('   📝 Changelog: Updated'));
        }

        if (!options.noCommit && GitManager.isGitRepository()) {
          console.log(Formatter.info('   📝 Git: Changes committed'));
        }

        if (!options.noTag && GitManager.isGitRepository()) {
          console.log(Formatter.info(`   🏷️  Tag: v${newVersion} created`));
        }

        // Next steps
        if (!options.push && GitManager.isGitRepository()) {
          console.log('');
          console.log(Formatter.info('💡 Next steps:'));
          console.log(
            Formatter.info(`   - Push changes: git push origin ${GitManager.getCurrentBranch()}`)
          );

          if (!options.noTag) {
            console.log(Formatter.info(`   - Push tags: git push origin v${newVersion}`));
          }

          console.log(Formatter.info('   - Create GitHub release from the tag'));
        }
      } catch (error) {
        console.error(
          Formatter.error(
            `Release failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return command;
}
