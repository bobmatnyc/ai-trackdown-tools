/**
 * GitHub Sync Auto Command
 * Enable/disable automatic sync
 */

import { Command } from 'commander';
import { ConfigManager } from '../../utils/config-manager.js';
import { Formatter } from '../../utils/formatter.js';

export function createSyncAutoCommand(): Command {
  const command = new Command('auto');

  command
    .description('Enable/disable automatic sync')
    .option('--enable', 'Enable automatic sync')
    .option('--disable', 'Disable automatic sync')
    .option('--interval <minutes>', 'Set auto-sync interval in minutes (default: 30)')
    .option('--status', 'Show auto-sync status')
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

        console.log(Formatter.header('🔄 GitHub Auto-Sync Configuration'));
        console.log(Formatter.info(`Repository: ${config.github_sync.repository}`));
        console.log('');

        if (options.status) {
          // Show current auto-sync status
          console.log(Formatter.info('Current Auto-Sync Status:'));
          console.log(`  Enabled: ${config.github_sync.auto_sync ? 'Yes' : 'No'}`);
          console.log(`  Conflict resolution: ${config.github_sync.conflict_resolution}`);
          console.log(`  Batch size: ${config.github_sync.batch_size}`);
          console.log(`  Rate limit delay: ${config.github_sync.rate_limit_delay}ms`);

          if (config.github_sync.auto_sync) {
            console.log('');
            console.log(Formatter.info('Auto-sync is currently enabled.'));
            console.log(
              Formatter.warning(
                'Note: Auto-sync implementation requires a scheduler (cron, systemd timer, etc.)'
              )
            );
            console.log('');
            console.log(Formatter.info('Suggested cron job (every 30 minutes):'));
            console.log('  0,30 * * * * cd /path/to/project && aitrackdown sync bidirectional');
            console.log('');
            console.log(Formatter.info('Suggested systemd timer:'));
            console.log('  # Create /etc/systemd/system/aitrackdown-sync.service');
            console.log('  # Create /etc/systemd/system/aitrackdown-sync.timer');
            console.log('  # Enable with: systemctl enable --now aitrackdown-sync.timer');
          } else {
            console.log('');
            console.log(Formatter.info('Auto-sync is currently disabled.'));
            console.log('Use "aitrackdown sync auto --enable" to enable it.');
          }

          return;
        }

        if (options.enable) {
          // Enable auto-sync
          const updatedConfig = {
            ...config,
            github_sync: {
              ...config.github_sync,
              auto_sync: true,
            },
          };

          configManager.saveConfig(updatedConfig);

          console.log(Formatter.success('Auto-sync enabled successfully!'));
          console.log('');
          console.log(Formatter.info('Auto-sync configuration:'));
          console.log(`  Repository: ${updatedConfig.github_sync.repository}`);
          console.log(`  Conflict resolution: ${updatedConfig.github_sync.conflict_resolution}`);
          console.log(`  Batch size: ${updatedConfig.github_sync.batch_size}`);
          console.log(`  Rate limit delay: ${updatedConfig.github_sync.rate_limit_delay}ms`);
          console.log('');
          console.log(Formatter.warning('Important: Auto-sync requires external scheduling!'));
          console.log('');
          console.log(Formatter.info('Setup options:'));
          console.log('');
          console.log(Formatter.info('1. Cron job (recommended):'));
          console.log('   Edit crontab: crontab -e');
          console.log(
            '   Add line: 0,30 * * * * cd /path/to/your/project && aitrackdown sync bidirectional'
          );
          console.log('');
          console.log(Formatter.info('2. Systemd timer:'));
          console.log('   Create service file: /etc/systemd/system/aitrackdown-sync.service');
          console.log('   Create timer file: /etc/systemd/system/aitrackdown-sync.timer');
          console.log('   Enable: systemctl enable --now aitrackdown-sync.timer');
          console.log('');
          console.log(Formatter.info('3. Manual periodic execution:'));
          console.log('   Run: aitrackdown sync bidirectional');
          console.log('   Schedule as needed for your workflow');
        } else if (options.disable) {
          // Disable auto-sync
          const updatedConfig = {
            ...config,
            github_sync: {
              ...config.github_sync,
              auto_sync: false,
            },
          };

          configManager.saveConfig(updatedConfig);

          console.log(Formatter.success('Auto-sync disabled successfully!'));
          console.log('');
          console.log(Formatter.info('Manual sync commands are still available:'));
          console.log('  • aitrackdown sync push - Push local changes to GitHub');
          console.log('  • aitrackdown sync pull - Pull GitHub changes to local');
          console.log('  • aitrackdown sync bidirectional - Full bidirectional sync');
          console.log('  • aitrackdown sync status - Check sync status');
        } else {
          // Show help if no action specified
          console.log(Formatter.info('Auto-sync management options:'));
          console.log('  --enable     Enable automatic sync');
          console.log('  --disable    Disable automatic sync');
          console.log('  --status     Show current auto-sync status');
          console.log('');
          console.log(Formatter.info('Examples:'));
          console.log('  aitrackdown sync auto --enable');
          console.log('  aitrackdown sync auto --disable');
          console.log('  aitrackdown sync auto --status');
        }
      } catch (error) {
        console.error(Formatter.error('Auto-sync configuration failed:'));
        console.error(Formatter.error(error instanceof Error ? error.message : 'Unknown error'));
        process.exit(1);
      }
    });

  return command;
}
