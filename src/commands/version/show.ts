import { Command } from 'commander';
import { VersionManager } from '../../utils/version.js';
import { Formatter } from '../../utils/formatter.js';

export function createShowCommand(): Command {
  const command = new Command('show');
  
  command
    .description('Display current version information')
    .option('--json', 'output as JSON')
    .option('--check-consistency', 'check version consistency across files')
    .action(async (options) => {
      try {
        const versionInfo = VersionManager.getVersion();
        
        if (options.json) {
          if (options.checkConsistency) {
            const consistency = VersionManager.validateVersionConsistency();
            console.log(JSON.stringify({
              ...versionInfo,
              consistency
            }, null, 2));
          } else {
            console.log(JSON.stringify(versionInfo, null, 2));
          }
          return;
        }

        // Pretty output
        console.log(Formatter.success(`📦 AI Trackdown CLI v${versionInfo.version}`));
        console.log(Formatter.info(`   Major: ${versionInfo.major}`));
        console.log(Formatter.info(`   Minor: ${versionInfo.minor}`));
        console.log(Formatter.info(`   Patch: ${versionInfo.patch}`));

        if (options.checkConsistency) {
          console.log('');
          const consistency = VersionManager.validateVersionConsistency();
          
          if (consistency.consistent) {
            console.log(Formatter.success('✅ Version consistency check passed'));
          } else {
            console.log(Formatter.error('❌ Version inconsistency detected:'));
            for (const [file, version] of Object.entries(consistency.versions)) {
              const status = version === versionInfo.version ? '✅' : '❌';
              console.log(Formatter.info(`   ${file}: ${version} ${status}`));
            }
          }
        }

      } catch (error) {
        console.error(Formatter.error(`Failed to get version: ${error instanceof Error ? error.message : 'Unknown error'}`));
        process.exit(1);
      }
    });

  return command;
}