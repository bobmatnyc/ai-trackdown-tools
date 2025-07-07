import { Command } from 'commander';
import { VersionManager } from '../../utils/version.js';
import { Formatter } from '../../utils/formatter.js';

export function createSyncCommand(): Command {
  const command = new Command('sync');
  
  command
    .description('Synchronize version across all files')
    .option('--check-only', 'only check consistency without making changes')
    .option('--verbose', 'show detailed information about each file')
    .action(async (options) => {
      try {
        console.log(Formatter.info('🔄 Checking version consistency...'));

        // Check current consistency
        const consistency = VersionManager.validateVersionConsistency();
        const versionInfo = VersionManager.getVersion();

        if (options.verbose || options.checkOnly) {
          console.log(Formatter.info(`📦 Source version (VERSION file): ${versionInfo.version}`));
          console.log('');
          
          for (const [file, version] of Object.entries(consistency.versions)) {
            const status = version === versionInfo.version ? '✅' : '❌';
            const message = version === versionInfo.version ? 'synchronized' : 'needs update';
            console.log(Formatter.info(`   ${file}: ${version} ${status} (${message})`));
          }
        }

        if (consistency.consistent) {
          console.log(Formatter.success('✅ All files are already synchronized!'));
          return;
        }

        if (options.checkOnly) {
          console.log('');
          console.log(Formatter.error('❌ Version inconsistency detected.'));
          console.log(Formatter.info('Run without --check-only to fix the inconsistencies.'));
          process.exit(1);
        }

        console.log('');
        console.log(Formatter.warning('⚠️  Version inconsistency detected. Synchronizing...'));

        // Perform synchronization
        VersionManager.syncVersion();

        // Verify synchronization
        const newConsistency = VersionManager.validateVersionConsistency();
        
        if (newConsistency.consistent) {
          console.log(Formatter.success('✅ Version synchronization completed successfully!'));
          
          if (options.verbose) {
            console.log('');
            console.log(Formatter.info('📋 Updated files:'));
            for (const [file, version] of Object.entries(newConsistency.versions)) {
              console.log(Formatter.info(`   ${file}: ${version} ✅`));
            }
          }
          
          console.log('');
          console.log(Formatter.info(`🎯 All files now use version: ${versionInfo.version}`));
        } else {
          console.log(Formatter.error('❌ Synchronization failed. Some files could not be updated.'));
          
          console.log('');
          console.log(Formatter.info('📋 Current status:'));
          for (const [file, version] of Object.entries(newConsistency.versions)) {
            const status = version === versionInfo.version ? '✅' : '❌';
            console.log(Formatter.info(`   ${file}: ${version} ${status}`));
          }
          
          process.exit(1);
        }

      } catch (error) {
        console.error(Formatter.error(`Failed to synchronize versions: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return command;
}