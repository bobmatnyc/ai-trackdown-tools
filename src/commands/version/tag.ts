import { Command } from 'commander';
import { execSync } from 'child_process';
import { VersionManager } from '../../utils/version.js';
import { GitManager } from '../../utils/git.js';
import { Formatter } from '../../utils/formatter.js';

export function createTagCommand(): Command {
  const command = new Command('tag');

  command
    .description('Create a git tag for the current version')
    .option('--push', 'push the tag to remote repository')
    .option('--message <msg>', 'custom tag message')
    .option('--dry-run', 'show what would be done without creating the tag')
    .option('--force', 'force create tag even if it exists')
    .action(async (options) => {
      try {
        if (!GitManager.isGitRepository()) {
          console.error(Formatter.error('Not in a git repository. Cannot create tags.'));
          process.exit(1);
        }

        const versionInfo = VersionManager.getVersion();
        const tagName = `v${versionInfo.version}`;
        const tagMessage = options.message || `Release version ${versionInfo.version}`;

        console.log(Formatter.info(`🏷️  Creating tag ${tagName}...`));

        // Check if tag already exists
        if (GitManager.tagExists(tagName) && !options.force) {
          console.error(
            Formatter.error(`Tag ${tagName} already exists. Use --force to recreate it.`)
          );
          process.exit(1);
        }

        // Check for uncommitted changes
        if (GitManager.hasUncommittedChanges()) {
          console.warn(Formatter.warning('⚠️  Warning: You have uncommitted changes.'));
          console.log(Formatter.info('Consider committing changes before creating a release tag.'));
        }

        if (options.dryRun) {
          console.log(Formatter.info('🔍 Dry run mode - no tag will be created'));
          console.log(Formatter.info(`Tag name: ${tagName}`));
          console.log(Formatter.info(`Tag message: ${tagMessage}`));

          if (options.push) {
            console.log(Formatter.info('Would push tag to remote repository'));
          }

          return;
        }

        // Create the tag
        try {
          GitManager.createTag(versionInfo.version, tagMessage);
          console.log(Formatter.success(`✅ Tag ${tagName} created successfully!`));
        } catch (error) {
          if (options.force && error instanceof Error && error.message.includes('already exists')) {
            // Delete existing tag and recreate
            console.log(Formatter.warning(`🔄 Recreating existing tag ${tagName}...`));
            try {
              // Delete local tag
              execSync(`git tag -d ${tagName}`, { stdio: 'ignore' });
              GitManager.createTag(versionInfo.version, tagMessage);
              console.log(Formatter.success(`✅ Tag ${tagName} recreated successfully!`));
            } catch (recreateError) {
              throw new Error(`Failed to recreate tag: ${recreateError}`);
            }
          } else {
            throw error;
          }
        }

        // Push tag if requested
        if (options.push) {
          console.log(Formatter.info('📤 Pushing tag to remote repository...'));
          try {
            GitManager.pushTags();
            console.log(Formatter.success('✅ Tag pushed successfully!'));
          } catch (error) {
            console.error(
              Formatter.error(
                `Failed to push tag: ${error instanceof Error ? error.message : 'Unknown error'}`
              )
            );
            console.log(
              Formatter.info(`💡 You can push manually later with: git push origin ${tagName}`)
            );
          }
        }

        // Show tag info
        console.log('');
        console.log(Formatter.success('🎉 Tag created successfully!'));
        console.log(Formatter.info(`   Tag: ${tagName}`));
        console.log(Formatter.info(`   Message: ${tagMessage}`));
        console.log(Formatter.info(`   Branch: ${GitManager.getCurrentBranch()}`));

        if (!options.push) {
          console.log('');
          console.log(Formatter.info('💡 Next steps:'));
          console.log(Formatter.info(`   - Push the tag: git push origin ${tagName}`));
          console.log(Formatter.info('   - Create a GitHub release from this tag'));
        }

        // Show all tags for reference
        const allTags = GitManager.getTags();
        if (allTags.length > 1) {
          console.log('');
          console.log(Formatter.info('📋 All tags:'));
          allTags.slice(-5).forEach((tag) => {
            const indicator = tag === tagName ? ' ← current' : '';
            console.log(Formatter.info(`   ${tag}${indicator}`));
          });

          if (allTags.length > 5) {
            console.log(Formatter.info(`   ... and ${allTags.length - 5} more`));
          }
        }
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to create tag: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return command;
}
