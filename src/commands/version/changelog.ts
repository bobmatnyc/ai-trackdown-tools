import { Command } from 'commander';
import { ChangelogManager } from '../../utils/changelog.js';
import { VersionManager } from '../../utils/version.js';
import { GitManager } from '../../utils/git.js';
import { Formatter } from '../../utils/formatter.js';

export function createChangelogCommand(): Command {
  const command = new Command('changelog');

  command
    .description('Generate or update CHANGELOG.md')
    .option(
      '--since <ref>',
      'generate changelog since a specific git reference (tag, commit, etc.)'
    )
    .option('--version <version>', 'specify version for the changelog entry')
    .option('--dry-run', 'show what would be generated without writing to file')
    .option('--format <format>', 'output format (markdown, json)', 'markdown')
    .action(async (options) => {
      try {
        if (!GitManager.isGitRepository()) {
          console.warn(
            Formatter.warning('Not in a git repository. Changelog generation may be limited.')
          );
        }

        const version = options.version || VersionManager.getVersion().version;
        const since = options.since || GitManager.getLastTag() || undefined;

        console.log(Formatter.info(`📝 Generating changelog for version ${version}...`));

        if (since) {
          console.log(Formatter.info(`📅 Including changes since: ${since}`));
        }

        // Generate changelog entry
        const entry = ChangelogManager.generateChangelogEntry(version, since);

        if (options.format === 'json') {
          if (options.dryRun) {
            console.log('📄 Generated changelog entry (JSON):');
            console.log(JSON.stringify(entry, null, 2));
          } else {
            console.log(JSON.stringify(entry, null, 2));
          }
          return;
        }

        // Format as markdown
        const markdown = ChangelogManager.formatChangelogEntry(entry);

        if (options.dryRun) {
          console.log('📄 Generated changelog entry:');
          console.log('');
          console.log(markdown);
          return;
        }

        // Write to CHANGELOG.md
        ChangelogManager.generateChangelog(version, since);

        console.log(Formatter.success('✅ CHANGELOG.md updated successfully!'));

        // Show summary
        const totalChanges = Object.values(entry.sections).reduce(
          (sum, items) => sum + items.length,
          0
        );
        console.log(Formatter.info(`📊 Summary:`));
        console.log(Formatter.info(`   - Version: ${entry.version}`));
        console.log(Formatter.info(`   - Date: ${entry.date}`));
        console.log(Formatter.info(`   - Total changes: ${totalChanges}`));

        // Show section breakdown
        const sectionNames = {
          added: 'Added',
          changed: 'Changed',
          deprecated: 'Deprecated',
          removed: 'Removed',
          fixed: 'Fixed',
          security: 'Security',
        };

        for (const [key, name] of Object.entries(sectionNames)) {
          const count = entry.sections[key as keyof typeof entry.sections].length;
          if (count > 0) {
            console.log(Formatter.info(`   - ${name}: ${count} items`));
          }
        }

        console.log('');
        console.log(Formatter.info('💡 Tip: Review CHANGELOG.md and edit manually if needed'));
      } catch (error) {
        console.error(
          Formatter.error(
            `Failed to generate changelog: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(1);
      }
    });

  return command;
}
