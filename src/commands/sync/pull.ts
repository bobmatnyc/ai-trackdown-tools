/**
 * GitHub Sync Pull Command
 * Pull changes from GitHub to local
 */

import { Command } from 'commander';
import ora from 'ora';
import { GitHubSyncEngine } from '../../integrations/github-sync.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';

export function createSyncPullCommand(): Command {
  const command = new Command('pull');

  command
    .description('Pull changes from GitHub to local')
    .option('--dry-run', 'Show what would be pulled without making changes')
    .option('--force', 'Force pull even with conflicts')
    .option('--verbose', 'Show detailed progress information')
    .action(async (options) => {
      try {
        const configManager = new ConfigManager();
        const config = configManager.getConfig();

        // Check if GitHub sync is configured
        if (!config.github_sync?.enabled) {
          console.log(
            Formatter.error('GitHub sync is not configured. Run "aitrackdown sync setup" first.')
          );
          process.exit(1);
        }

        console.log(Formatter.header('📥 Pulling Changes from GitHub'));
        console.log(Formatter.info(`Repository: ${config.github_sync.repository}`));
        console.log('');

        const syncEngine = new GitHubSyncEngine(configManager);

        // Test connection first
        const spinner = ora('Testing GitHub connection...').start();
        const testResult = await syncEngine.testConnection();

        if (!testResult.success) {
          spinner.fail('GitHub connection failed');
          console.log(Formatter.error(testResult.message));
          process.exit(1);
        }

        spinner.succeed('GitHub connection verified');

        // Perform pull operation
        const pullSpinner = ora('Pulling changes from GitHub...').start();

        try {
          const result = await syncEngine.pullFromGitHub();

          if (options.dryRun) {
            pullSpinner.succeed('Dry run completed');
            console.log(Formatter.info('Operations that would be performed:'));
          } else {
            pullSpinner.succeed('Pull completed');
          }

          console.log('');
          console.log(Formatter.info('Pull Summary:'));
          console.log(`  Pulled: ${result.pulled_count} issues`);
          console.log(`  Skipped: ${result.skipped_count} issues`);
          console.log(`  Conflicts: ${result.conflict_count} issues`);
          console.log(`  Errors: ${result.errors.length}`);

          if (result.errors.length > 0) {
            console.log('');
            console.log(Formatter.error('Errors encountered:'));
            result.errors.forEach((error) => {
              console.log(`  • ${error}`);
            });
          }

          if (result.conflicts.length > 0) {
            console.log('');
            console.log(Formatter.warning('Conflicts detected:'));
            result.conflicts.forEach((conflict) => {
              console.log(`  • ${conflict.local_issue.title} (${conflict.local_issue.issue_id})`);
              console.log(`    Reason: ${conflict.reason}`);
              if (conflict.github_issue) {
                console.log(
                  `    GitHub: #${conflict.github_issue.number} - ${conflict.github_issue.html_url}`
                );
              }
            });

            if (!options.force) {
              console.log('');
              console.log(Formatter.info('To resolve conflicts:'));
              console.log('  • Use "aitrackdown sync status" to see detailed conflict information');
              console.log('  • Use "aitrackdown sync pull --force" to force pull remote changes');
              console.log('  • Use "aitrackdown sync push" to push local changes');
            }
          }

          if (options.verbose) {
            console.log('');
            console.log(Formatter.info('Detailed Operations:'));
            result.operations.forEach((op, index) => {
              console.log(
                `  ${index + 1}. ${op.github_issue?.title || 'Unknown'} (#${op.github_issue?.number})`
              );
              console.log(`     Type: ${op.type}`);
              console.log(`     Action: ${op.action}`);
              if (op.reason) {
                console.log(`     Reason: ${op.reason}`);
              }
              if (op.github_issue) {
                console.log(`     GitHub: ${op.github_issue.html_url}`);
              }
              if (op.local_issue.issue_id) {
                console.log(`     Local: ${op.local_issue.issue_id}`);
              }
            });
          }

          if (result.success) {
            console.log('');
            console.log(Formatter.success('Pull operation completed successfully!'));

            if (result.pulled_count > 0) {
              console.log('');
              console.log(Formatter.info('Next steps:'));
              console.log('  • Review the pulled issues in your local files');
              console.log('  • Assign issues to appropriate epics if needed');
              console.log('  • Update AI context and token estimates as needed');
            }
          } else {
            console.log('');
            console.log(
              Formatter.warning('Pull operation completed with issues. Review the errors above.')
            );
          }
        } catch (error) {
          pullSpinner.fail('Pull failed');
          throw error;
        }
      } catch (error) {
        console.error(Formatter.error('Pull failed:'));
        console.error(Formatter.error(error instanceof Error ? error.message : 'Unknown error'));
        process.exit(1);
      }
    });

  return command;
}
