/**
 * GitHub Sync Push Command
 * Push local changes to GitHub
 */

import { Command } from 'commander';
import ora from 'ora';
import { Formatter } from '../../utils/formatter.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { GitHubSyncEngine } from '../../integrations/github-sync.js';

export function createSyncPushCommand(): Command {
  const command = new Command('push');
  
  command
    .description('Push local changes to GitHub')
    .option('--dry-run', 'Show what would be pushed without making changes')
    .option('--force', 'Force push even with conflicts')
    .option('--verbose', 'Show detailed progress information')
    .action(async (options) => {
      try {
        const configManager = new ConfigManager();
        const config = configManager.getConfig();
        
        // Check if GitHub sync is configured
        if (!config.github_sync?.enabled) {
          console.log(Formatter.error('GitHub sync is not configured. Run "aitrackdown sync setup" first.'));
          process.exit(1);
        }
        
        console.log(Formatter.header('📤 Pushing Local Changes to GitHub'));
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
        
        // Perform push operation
        const pushSpinner = ora('Pushing local changes to GitHub...').start();
        
        try {
          const result = await syncEngine.pushToGitHub();
          
          if (options.dryRun) {
            pushSpinner.succeed('Dry run completed');
            console.log(Formatter.info('Operations that would be performed:'));
          } else {
            pushSpinner.succeed('Push completed');
          }
          
          console.log('');
          console.log(Formatter.info('Push Summary:'));
          console.log(`  Pushed: ${result.pushed_count} issues`);
          console.log(`  Skipped: ${result.skipped_count} issues`);
          console.log(`  Conflicts: ${result.conflict_count} issues`);
          console.log(`  Errors: ${result.errors.length}`);
          
          if (result.errors.length > 0) {
            console.log('');
            console.log(Formatter.error('Errors encountered:'));
            result.errors.forEach(error => {
              console.log(`  • ${error}`);
            });
          }
          
          if (result.conflicts.length > 0) {
            console.log('');
            console.log(Formatter.warning('Conflicts detected:'));
            result.conflicts.forEach(conflict => {
              console.log(`  • ${conflict.local_issue.title} (${conflict.local_issue.issue_id})`);
              console.log(`    Reason: ${conflict.reason}`);
            });
            
            if (!options.force) {
              console.log('');
              console.log(Formatter.info('To resolve conflicts:'));
              console.log('  • Use "aitrackdown sync status" to see detailed conflict information');
              console.log('  • Use "aitrackdown sync push --force" to force push local changes');
              console.log('  • Use "aitrackdown sync pull" to pull remote changes');
            }
          }
          
          if (options.verbose) {
            console.log('');
            console.log(Formatter.info('Detailed Operations:'));
            result.operations.forEach((op, index) => {
              console.log(`  ${index + 1}. ${op.local_issue.title} (${op.local_issue.issue_id})`);
              console.log(`     Type: ${op.type}`);
              console.log(`     Action: ${op.action}`);
              if (op.reason) {
                console.log(`     Reason: ${op.reason}`);
              }
              if (op.github_issue) {
                console.log(`     GitHub: #${op.github_issue.number} - ${op.github_issue.html_url}`);
              }
            });
          }
          
          if (result.success) {
            console.log('');
            console.log(Formatter.success('Push operation completed successfully!'));
          } else {
            console.log('');
            console.log(Formatter.warning('Push operation completed with issues. Review the errors above.'));
          }
          
        } catch (error) {
          pushSpinner.fail('Push failed');
          throw error;
        }
        
      } catch (error) {
        console.error(Formatter.error('Push failed:'));
        console.error(Formatter.error(error instanceof Error ? error.message : 'Unknown error'));
        process.exit(1);
      }
    });
  
  return command;
}