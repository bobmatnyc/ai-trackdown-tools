/**
 * GitHub Sync Status Command
 * Show sync status and conflicts
 */

import { Command } from 'commander';
import ora from 'ora';
import { Formatter } from '../../utils/formatter.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { GitHubSyncEngine } from '../../integrations/github-sync.js';

export function createSyncStatusCommand(): Command {
  const command = new Command('status');
  
  command
    .description('Show sync status and conflicts')
    .option('--verbose', 'Show detailed status information')
    .option('--conflicts-only', 'Show only conflicts')
    .action(async (options) => {
      try {
        const configManager = new ConfigManager();
        const config = configManager.getConfig();
        
        // Check if GitHub sync is configured
        if (!config.github_sync?.enabled) {
          console.log(Formatter.error('GitHub sync is not configured. Run "aitrackdown sync setup" first.'));
          process.exit(1);
        }
        
        console.log(Formatter.header('🔄 GitHub Sync Status'));
        console.log(Formatter.info(`Repository: ${config.github_sync.repository}`));
        console.log('');
        
        const syncEngine = new GitHubSyncEngine(configManager);
        
        // Test connection first
        const spinner = ora('Checking GitHub connection...').start();
        const testResult = await syncEngine.testConnection();
        
        if (!testResult.success) {
          spinner.fail('GitHub connection failed');
          console.log(Formatter.error(testResult.message));
          process.exit(1);
        }
        
        spinner.succeed('GitHub connection verified');
        
        // Get sync status
        const statusSpinner = ora('Fetching sync status...').start();
        
        try {
          const status = await syncEngine.getSyncStatus();
          statusSpinner.succeed('Sync status retrieved');
          
          // Display general status
          if (!options.conflictsOnly) {
            console.log('');
            console.log(Formatter.info('Sync Configuration:'));
            console.log(`  Repository: ${status.repository}`);
            console.log(`  Auto sync: ${status.auto_sync ? 'enabled' : 'disabled'}`);
            console.log(`  Conflict resolution: ${config.github_sync.conflict_resolution}`);
            console.log(`  Sync labels: ${config.github_sync.sync_labels ? 'enabled' : 'disabled'}`);
            console.log(`  Sync milestones: ${config.github_sync.sync_milestones ? 'enabled' : 'disabled'}`);
            console.log(`  Sync assignees: ${config.github_sync.sync_assignees ? 'enabled' : 'disabled'}`);
            
            console.log('');
            console.log(Formatter.info('Sync Status:'));
            console.log(`  Last sync: ${status.last_sync || 'Never'}`);
            console.log(`  Pending operations: ${status.pending_operations}`);
            console.log(`  Conflicts: ${status.conflicts}`);
            console.log(`  Health: ${status.sync_health}`);
            
            // Health indicator
            const healthIcon = status.sync_health === 'healthy' ? '✅' : 
                              status.sync_health === 'degraded' ? '⚠️' : '❌';
            console.log(`  Status: ${healthIcon} ${status.sync_health}`);
          }
          
          // Show conflicts if any
          if (status.conflicts > 0) {
            console.log('');
            console.log(Formatter.warning(`⚠️ ${status.conflicts} conflicts detected`));
            
            if (options.verbose) {
              // Get detailed conflict information
              const conflictSpinner = ora('Analyzing conflicts...').start();
              
              try {
                // Perform a dry run to get conflict details
                const dryRunResult = await syncEngine.bidirectionalSync();
                conflictSpinner.succeed('Conflict analysis completed');
                
                if (dryRunResult.conflicts.length > 0) {
                  console.log('');
                  console.log(Formatter.warning('Conflict Details:'));
                  dryRunResult.conflicts.forEach((conflict, index) => {
                    console.log(`  ${index + 1}. ${conflict.local_issue.title} (${conflict.local_issue.issue_id})`);
                    console.log(`     Reason: ${conflict.reason}`);
                    if (conflict.github_issue) {
                      console.log(`     GitHub: #${conflict.github_issue.number} - ${conflict.github_issue.html_url}`);
                      console.log(`     Local updated: ${conflict.local_issue.updated_date}`);
                      console.log(`     GitHub updated: ${conflict.github_issue.updated_at}`);
                    }
                    console.log('');
                  });
                }
              } catch (error) {
                conflictSpinner.fail('Failed to analyze conflicts');
                console.log(Formatter.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
              }
            }
            
            console.log(Formatter.info('Conflict Resolution Options:'));
            console.log('  • Use "aitrackdown sync push --force" to push local changes');
            console.log('  • Use "aitrackdown sync pull --force" to pull remote changes');
            console.log('  • Manually resolve conflicts and sync again');
          }
          
          if (options.verbose && !options.conflictsOnly) {
            // Get rate limit information
            const rateLimitSpinner = ora('Checking rate limit...').start();
            
            try {
              const client = new (await import('../../utils/github-client.js')).GitHubClient(config.github_sync);
              const rateLimit = await client.getRateLimit();
              rateLimitSpinner.succeed('Rate limit information retrieved');
              
              console.log('');
              console.log(Formatter.info('GitHub API Rate Limit:'));
              console.log(`  Limit: ${rateLimit.limit} requests/hour`);
              console.log(`  Remaining: ${rateLimit.remaining} requests`);
              console.log(`  Used: ${rateLimit.used} requests`);
              console.log(`  Reset: ${rateLimit.reset.toLocaleString()}`);
              
              // Rate limit health indicator
              const rateLimitPercentage = (rateLimit.remaining / rateLimit.limit) * 100;
              const rateLimitIcon = rateLimitPercentage > 50 ? '✅' : 
                                   rateLimitPercentage > 20 ? '⚠️' : '❌';
              console.log(`  Health: ${rateLimitIcon} ${rateLimitPercentage.toFixed(1)}% remaining`);
              
            } catch (error) {
              rateLimitSpinner.fail('Failed to check rate limit');
              console.log(Formatter.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
          }
          
          // Show recommendations
          if (!options.conflictsOnly) {
            console.log('');
            console.log(Formatter.info('Recommendations:'));
            
            if (status.pending_operations > 0) {
              console.log('  • Run "aitrackdown sync push" to push local changes');
              console.log('  • Run "aitrackdown sync pull" to pull remote changes');
            }
            
            if (status.conflicts > 0) {
              console.log('  • Review conflicts and resolve them manually');
              console.log('  • Use --force flags to override conflicts');
            }
            
            if (!status.auto_sync) {
              console.log('  • Consider enabling auto-sync with "aitrackdown sync auto --enable"');
            }
            
            if (status.sync_health === 'degraded') {
              console.log('  • Check rate limit usage and consider increasing delays');
            }
            
            if (status.sync_health === 'failed') {
              console.log('  • Check GitHub connection and permissions');
              console.log('  • Verify token is valid and has correct permissions');
            }
          }
          
        } catch (error) {
          statusSpinner.fail('Failed to retrieve sync status');
          throw error;
        }
        
      } catch (error) {
        console.error(Formatter.error('Status check failed:'));
        console.error(Formatter.error(error instanceof Error ? error.message : 'Unknown error'));
        process.exit(1);
      }
    });
  
  return command;
}