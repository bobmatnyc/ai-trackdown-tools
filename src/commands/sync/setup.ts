/**
 * GitHub Sync Setup Command
 * Configure GitHub sync for the project
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import type { GitHubSyncConfig } from '../../types/ai-trackdown.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';
import { GitHubClient } from '../../utils/github-client.js';

export function createSyncSetupCommand(): Command {
  const command = new Command('setup');

  command
    .description('Configure GitHub sync for the project')
    .option('--repository <repo>', 'GitHub repository (owner/repo format)')
    .option('--token <token>', 'GitHub personal access token')
    .option('--auto-sync', 'Enable automatic sync')
    .option('--no-auto-sync', 'Disable automatic sync')
    .option(
      '--conflict-resolution <strategy>',
      'Conflict resolution strategy (most_recent|local_wins|remote_wins)',
      'most_recent'
    )
    .option('--sync-labels', 'Enable label synchronization')
    .option('--no-sync-labels', 'Disable label synchronization')
    .option('--sync-milestones', 'Enable milestone synchronization')
    .option('--no-sync-milestones', 'Disable milestone synchronization')
    .option('--sync-assignees', 'Enable assignee synchronization')
    .option('--no-sync-assignees', 'Disable assignee synchronization')
    .option('--batch-size <size>', 'Batch size for sync operations', '50')
    .option('--rate-limit-delay <ms>', 'Delay between API calls in milliseconds', '100')
    .option('--dry-run', 'Show what would be configured without making changes')
    .option('--force', 'Force setup even if already configured')
    .action(async (options) => {
      try {
        const configManager = new ConfigManager();
        const config = configManager.getConfig();

        // Check if already configured
        if (config.github_sync?.enabled && !options.force) {
          console.log(
            Formatter.warning('GitHub sync is already configured. Use --force to reconfigure.')
          );
          console.log(Formatter.info(`Current repository: ${config.github_sync.repository}`));
          console.log(
            Formatter.info(`Auto sync: ${config.github_sync.auto_sync ? 'enabled' : 'disabled'}`)
          );
          console.log(
            Formatter.info(`Conflict resolution: ${config.github_sync.conflict_resolution}`)
          );
          return;
        }

        console.log(Formatter.header('🔧 GitHub Sync Setup'));
        console.log(
          Formatter.info('Configure bidirectional sync between local issues and GitHub Issues')
        );
        console.log('');

        let syncConfig: GitHubSyncConfig;

        if (options.repository && options.token) {
          // Non-interactive setup
          syncConfig = {
            enabled: true,
            repository: options.repository,
            token: options.token,
            auto_sync: options.autoSync ?? false,
            conflict_resolution: options.conflictResolution || 'most_recent',
            sync_labels: options.syncLabels ?? true,
            sync_milestones: options.syncMilestones ?? true,
            sync_assignees: options.syncAssignees ?? true,
            batch_size: parseInt(options.batchSize) || 50,
            rate_limit_delay: parseInt(options.rateLimitDelay) || 100,
          };
        } else {
          // Interactive setup
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'repository',
              message: 'GitHub repository (owner/repo format):',
              validate: (input: string) => {
                if (!input.includes('/')) {
                  return 'Repository must be in owner/repo format';
                }
                return true;
              },
              default: options.repository,
            },
            {
              type: 'password',
              name: 'token',
              message: 'GitHub personal access token:',
              validate: (input: string) => {
                if (input.length < 10) {
                  return 'Token appears to be too short';
                }
                return true;
              },
              default: options.token,
            },
            {
              type: 'confirm',
              name: 'auto_sync',
              message: 'Enable automatic sync?',
              default: options.autoSync ?? false,
            },
            {
              type: 'list',
              name: 'conflict_resolution',
              message: 'Conflict resolution strategy:',
              choices: [
                { name: 'Most recent wins (recommended)', value: 'most_recent' },
                { name: 'Local always wins', value: 'local_wins' },
                { name: 'Remote always wins', value: 'remote_wins' },
              ],
              default: options.conflictResolution || 'most_recent',
            },
            {
              type: 'confirm',
              name: 'sync_labels',
              message: 'Sync labels between local tags and GitHub labels?',
              default: options.syncLabels ?? true,
            },
            {
              type: 'confirm',
              name: 'sync_milestones',
              message: 'Sync milestones between local and GitHub?',
              default: options.syncMilestones ?? true,
            },
            {
              type: 'confirm',
              name: 'sync_assignees',
              message: 'Sync assignees between local and GitHub?',
              default: options.syncAssignees ?? true,
            },
            {
              type: 'number',
              name: 'batch_size',
              message: 'Batch size for sync operations:',
              default: parseInt(options.batchSize) || 50,
              validate: (input: number) => input > 0 && input <= 100,
            },
            {
              type: 'number',
              name: 'rate_limit_delay',
              message: 'Rate limit delay (ms) between API calls:',
              default: parseInt(options.rateLimitDelay) || 100,
              validate: (input: number) => input >= 0,
            },
          ]);

          syncConfig = {
            enabled: true,
            ...answers,
          };
        }

        if (options.dryRun) {
          console.log(Formatter.info('Dry run - configuration that would be applied:'));
          console.log(JSON.stringify(syncConfig, null, 2));
          return;
        }

        // Test connection before saving
        console.log(Formatter.info('Testing GitHub connection...'));
        const testClient = new GitHubClient(syncConfig);
        const testResult = await testClient.testConnection();

        if (!testResult.success) {
          console.log(Formatter.error('GitHub connection test failed:'));
          console.log(Formatter.error(testResult.message));
          return;
        }

        console.log(Formatter.success('GitHub connection test passed!'));

        // Save configuration
        const updatedConfig = {
          ...config,
          github_sync: syncConfig,
        };

        configManager.saveConfig(updatedConfig);

        console.log(Formatter.success('GitHub sync configuration saved successfully!'));
        console.log('');
        console.log(Formatter.info('Configuration summary:'));
        console.log(`  Repository: ${syncConfig.repository}`);
        console.log(`  Auto sync: ${syncConfig.auto_sync ? 'enabled' : 'disabled'}`);
        console.log(`  Conflict resolution: ${syncConfig.conflict_resolution}`);
        console.log(`  Sync labels: ${syncConfig.sync_labels ? 'enabled' : 'disabled'}`);
        console.log(`  Sync milestones: ${syncConfig.sync_milestones ? 'enabled' : 'disabled'}`);
        console.log(`  Sync assignees: ${syncConfig.sync_assignees ? 'enabled' : 'disabled'}`);
        console.log(`  Batch size: ${syncConfig.batch_size}`);
        console.log(`  Rate limit delay: ${syncConfig.rate_limit_delay}ms`);
        console.log('');
        console.log(Formatter.info('Next steps:'));
        console.log('  • Run "aitrackdown sync status" to check sync status');
        console.log('  • Run "aitrackdown sync pull" to pull existing GitHub issues');
        console.log('  • Run "aitrackdown sync push" to push local issues to GitHub');
        console.log('  • Run "aitrackdown sync auto" to enable automatic sync');
      } catch (error) {
        console.error(Formatter.error('Setup failed:'));
        console.error(Formatter.error(error instanceof Error ? error.message : 'Unknown error'));
        process.exit(1);
      }
    });

  return command;
}
