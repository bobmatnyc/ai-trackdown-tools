/**
 * GitHub Sync Bidirectional Command
 * Perform full bidirectional sync between local and GitHub
 */

import { Command } from 'commander';
import ora from 'ora';
import { Formatter } from '../../utils/formatter.js';
import { ConfigManager } from '../../utils/config-manager.js';
import { GitHubSyncEngine } from '../../integrations/github-sync.js';

export function createSyncBidirectionalCommand(): Command {
  const command = new Command('bidirectional');
  
  command
    .description('Perform full bidirectional sync between local and GitHub')
    .option('--dry-run', 'Show what would be synced without making changes')
    .option('--force', 'Force sync even with conflicts')
    .option('--verbose', 'Show detailed progress information')
    .option('--conflict-resolution <strategy>', 'Override conflict resolution strategy', 'config')
    .action(async (options) => {
      try {
        const configManager = new ConfigManager();
        const config = configManager.getConfig();
        
        // Check if GitHub sync is configured
        if (!config.github_sync?.enabled) {
          console.log(Formatter.error('GitHub sync is not configured. Run "aitrackdown sync setup" first.'));
          process.exit(1);
        }
        
        console.log(Formatter.header('🔄 Bidirectional GitHub Sync'));
        console.log(Formatter.info(`Repository: ${config.github_sync.repository}`));
        console.log(Formatter.info(`Conflict resolution: ${options.conflictResolution === 'config' ? config.github_sync.conflict_resolution : options.conflictResolution}`));
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
        
        // Perform bidirectional sync
        const syncSpinner = ora('Performing bidirectional sync...').start();
        
        try {
          const result = await syncEngine.bidirectionalSync();
          
          if (options.dryRun) {
            syncSpinner.succeed('Dry run completed');
            console.log(Formatter.info('Operations that would be performed:'));
          } else {
            syncSpinner.succeed('Bidirectional sync completed');
          }
          
          console.log('');
          console.log(Formatter.info('Sync Summary:'));
          console.log(`  Pushed: ${result.pushed_count} issues`);
          console.log(`  Pulled: ${result.pulled_count} issues`);
          console.log(`  Skipped: ${result.skipped_count} issues`);
          console.log(`  Conflicts: ${result.conflict_count} issues`);
          console.log(`  Errors: ${result.errors.length}`);
          
          // Show success/warning based on results
          if (result.success && result.conflict_count === 0) {
            console.log('');
            console.log(Formatter.success('✅ Bidirectional sync completed successfully!'));
          } else if (result.success && result.conflict_count > 0) {
            console.log('');
            console.log(Formatter.warning('⚠️ Sync completed with conflicts'));
          } else {
            console.log('');
            console.log(Formatter.error('❌ Sync completed with errors'));
          }
          
          // Show errors if any
          if (result.errors.length > 0) {
            console.log('');
            console.log(Formatter.error('Errors encountered:'));
            result.errors.forEach(error => {
              console.log(`  • ${error}`);
            });
          }
          
          // Show conflicts if any
          if (result.conflicts.length > 0) {
            console.log('');
            console.log(Formatter.warning('Conflicts detected:'));
            result.conflicts.forEach(conflict => {
              console.log(`  • ${conflict.local_issue.title} (${conflict.local_issue.issue_id})`);
              console.log(`    Type: ${conflict.type}`);
              console.log(`    Reason: ${conflict.reason}`);
              if (conflict.github_issue) {
                console.log(`    GitHub: #${conflict.github_issue.number} - ${conflict.github_issue.html_url}`);
              }
            });
            
            if (!options.force) {
              console.log('');
              console.log(Formatter.info('Conflict resolution options:'));
              console.log('  • Use "aitrackdown sync bidirectional --force" to apply configured resolution strategy');
              console.log('  • Use "aitrackdown sync push --force" to force push local changes');
              console.log('  • Use "aitrackdown sync pull --force" to force pull remote changes');
              console.log('  • Manually resolve conflicts and sync again');
            }
          }
          
          // Show detailed operations if verbose
          if (options.verbose) {
            console.log('');
            console.log(Formatter.info('Detailed Operations:'));
            result.operations.forEach((op, index) => {
              const title = op.local_issue.title || op.github_issue?.title || 'Unknown';
              const issueId = op.local_issue.issue_id || `#${op.github_issue?.number}`;
              
              console.log(`  ${index + 1}. ${title} (${issueId})`);
              console.log(`     Type: ${op.type}`);
              console.log(`     Action: ${op.action}`);
              if (op.reason) {
                console.log(`     Reason: ${op.reason}`);
              }
              if (op.github_issue) {
                console.log(`     GitHub: #${op.github_issue.number} - ${op.github_issue.html_url}`);
              }
              if (op.local_issue.file_path) {
                console.log(`     Local: ${op.local_issue.file_path}`);
              }
              console.log('');
            });
          }
          
          // Show recommendations
          if (result.success) {
            console.log('');
            console.log(Formatter.info('Next steps:'));
            
            if (result.pulled_count > 0) {
              console.log('  • Review pulled issues and assign to appropriate epics');
              console.log('  • Update AI context and token estimates for new issues');
            }
            
            if (result.pushed_count > 0) {
              console.log('  • Verify pushed issues appear correctly in GitHub');
              console.log('  • Check that labels, milestones, and assignees synced properly');
            }
            
            if (result.conflict_count > 0) {
              console.log('  • Review and resolve conflicts manually');
              console.log('  • Consider adjusting conflict resolution strategy');
            }
            
            if (config.github_sync.auto_sync) {
              console.log('  • Auto-sync is enabled - future changes will sync automatically');
            } else {
              console.log('  • Consider enabling auto-sync with "aitrackdown sync auto --enable"');
            }
          }
          
        } catch (error) {
          syncSpinner.fail('Bidirectional sync failed');
          throw error;
        }
        
      } catch (error) {
        console.error(Formatter.error('Bidirectional sync failed:'));
        console.error(Formatter.error(error instanceof Error ? error.message : 'Unknown error'));
        process.exit(1);
      }
    });
  
  return command;
}