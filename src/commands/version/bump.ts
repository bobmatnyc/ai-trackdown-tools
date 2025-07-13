import { Command } from 'commander';
import { ChangelogManager } from '../../utils/changelog.js';
import { Formatter } from '../../utils/formatter.js';
import { GitManager } from '../../utils/git.js';
import { VersionManager } from '../../utils/version.js';

export function createBumpCommand(): Command {
  const command = new Command('bump');

  command
    .description('Bump version following semantic versioning')
    .argument('<type>', 'version bump type (major, minor, patch)')
    .option('--no-changelog', 'skip changelog generation')
    .option('--no-commit', 'skip git commit')
    .option('--dry-run', 'show what would be done without making changes')
    .option('--message <msg>', 'custom commit message')
    .action(async (type: string, options) => {
      try {
        // Validate bump type
        if (!['major', 'minor', 'patch'].includes(type)) {
          console.error(Formatter.error('Invalid bump type. Must be: major, minor, or patch'));
          process.exit(1);
        }

        const currentVersion = VersionManager.getVersion();

        // Check for uncommitted changes
        if (
          GitManager.isGitRepository() &&
          GitManager.hasUncommittedChanges() &&
          !options.noCommit
        ) {
          console.error(
            Formatter.error('Uncommitted changes detected. Please commit or stash changes first.')
          );
          process.exit(1);
        }

        if (options.dryRun) {
          console.log(Formatter.info('🔍 Dry run mode - no changes will be made'));

          // Simulate version bump
          const semver = await import('semver');
          const newVersion = semver.inc(currentVersion.version, type as any);

          console.log(Formatter.info(`📦 Current version: ${currentVersion.version}`));
          console.log(Formatter.info(`🚀 New version: ${newVersion}`));

          if (!options.noChangelog) {
            console.log(Formatter.info('📝 Would generate changelog entry'));
          }

          if (!options.noCommit && GitManager.isGitRepository()) {
            console.log(Formatter.info('📝 Would commit changes to git'));
          }

          return;
        }

        console.log(Formatter.info(`📦 Bumping version from ${currentVersion.version}...`));

        // Get last tag for changelog generation
        const lastTag = GitManager.getLastTag();

        // Bump version
        const newVersion = VersionManager.bumpVersion(type as 'major' | 'minor' | 'patch');
        console.log(Formatter.success(`🚀 Version bumped to ${newVersion.version}`));

        // Sync version across files
        VersionManager.syncVersion();
        console.log(Formatter.success('🔄 Version synchronized across all files'));

        // Generate changelog
        if (!options.noChangelog) {
          const since = lastTag || undefined;
          ChangelogManager.generateChangelog(newVersion.version, since);
          console.log(Formatter.success('📝 Changelog updated'));
        }

        // Commit changes
        if (!options.noCommit && GitManager.isGitRepository()) {
          const commitMessage = options.message || `chore: bump version to ${newVersion.version}`;

          const filesToCommit = ['VERSION', 'package.json'];
          if (!options.noChangelog) {
            filesToCommit.push('CHANGELOG.md');
          }

          GitManager.commit(commitMessage, filesToCommit);
          console.log(Formatter.success(`📝 Changes committed: ${commitMessage}`));
        }

        console.log('');
        console.log(Formatter.success(`✅ Version bump complete!`));
        console.log(Formatter.info(`   Previous: ${currentVersion.version}`));
        console.log(Formatter.info(`   Current:  ${newVersion.version}`));

        if (GitManager.isGitRepository()) {
          console.log('');
          console.log(Formatter.info('💡 Next steps:'));
          console.log(Formatter.info('   - Review the changes'));
          console.log(Formatter.info(`   - Create a release tag: trackdown version tag`));
          console.log(
            Formatter.info(`   - Push changes: git push origin ${GitManager.getCurrentBranch()}`)
          );
        }
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to bump version: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return command;
}
