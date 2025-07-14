/**
 * Index Health Command - Validate and repair index corruption
 * Provides comprehensive index diagnostics and auto-repair functionality
 */

import { Command } from 'commander';
import { ConfigManager } from '../utils/config-manager.js';
import { Formatter } from '../utils/formatter.js';
import { TrackdownIndexManager } from '../utils/trackdown-index-manager.js';

interface IndexHealthOptions {
  repair?: boolean;
  verbose?: boolean;
  force?: boolean;
  rebuildIndex?: boolean;
}

export function createIndexHealthCommand(): Command {
  const command = new Command('index-health');

  command
    .description('Validate index health and detect corruption issues')
    .option('-r, --repair', 'automatically repair detected issues')
    .option('-v, --verbose', 'show detailed diagnostics')
    .option('-f, --force', 'force repair even if index appears healthy')
    .option('--rebuild-index', 'force complete index rebuild (nuclear option)')
    .addHelpText(
      'after',
      `
Examples:
  $ aitrackdown index-health                # Basic health check
  $ aitrackdown index-health --verbose      # Detailed diagnostics
  $ aitrackdown index-health --repair       # Auto-repair detected issues
  $ aitrackdown index-health --rebuild-index # Force complete rebuild

Exit Codes:
  0 - Index is healthy
  1 - Index has issues but repair succeeded
  2 - Index has issues and repair failed
  3 - Critical error occurred
`
    )
    .action(async (options: IndexHealthOptions) => {
      try {
        const exitCode = await runIndexHealthCheck(options);
        process.exit(exitCode);
      } catch (error) {
        console.error(
          Formatter.error(
            `Index health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
        process.exit(3);
      }
    });

  return command;
}

async function runIndexHealthCheck(options: IndexHealthOptions): Promise<number> {
  const startTime = Date.now();

  // Initialize configuration and index manager
  const configManager = new ConfigManager();
  const config = configManager.getConfig();

  // Get CLI tasks directory from parent command options
  const parentCommand = (process as any).command?.parent;
  const cliTasksDir = parentCommand?.opts()?.rootDir || parentCommand?.opts()?.tasksDir;

  const projectRoot = configManager.findProjectRoot();
  const indexManager = new TrackdownIndexManager(config, projectRoot, cliTasksDir);

  console.log(Formatter.header(`🔍 AI-Trackdown Index Health Check`));
  console.log(Formatter.info(`Project: ${config.name || 'AI-Trackdown'}`));
  console.log(Formatter.info(`Root: ${projectRoot}`));
  console.log('');

  // Force rebuild if requested
  if (options.rebuildIndex) {
    console.log(Formatter.warning('🔄 Force rebuilding index (nuclear option)...'));
    await indexManager.rebuildIndex();
    console.log(Formatter.success('✅ Index rebuilt successfully'));
    console.log(Formatter.dim(`\n⚡ Completed in ${Date.now() - startTime}ms`));
    return 0;
  }

  // Run health validation
  console.log(Formatter.info('🏥 Running health diagnostics...'));
  const healthCheck = await indexManager.validateIndexHealth();

  // Display basic health status
  if (healthCheck.isValid) {
    console.log(Formatter.success('✅ Index is healthy'));
  } else {
    console.log(Formatter.error('❌ Index has issues'));
  }

  console.log('');

  // Display statistics
  console.log(Formatter.subheader('📊 Index Statistics'));
  console.log(Formatter.info(`Files found: ${healthCheck.stats.fileCount}`));
  console.log(Formatter.info(`Files indexed: ${healthCheck.stats.indexedCount}`));
  
  if (healthCheck.stats.missingCount > 0) {
    console.log(Formatter.warning(`Missing from index: ${healthCheck.stats.missingCount}`));
  }
  
  if (healthCheck.stats.orphanedCount > 0) {
    console.log(Formatter.warning(`Orphaned entries: ${healthCheck.stats.orphanedCount}`));
  }

  if (healthCheck.stats.missingCount === 0 && healthCheck.stats.orphanedCount === 0) {
    console.log(Formatter.success('No missing or orphaned entries detected'));
  }

  console.log('');

  // Display issues if any
  if (healthCheck.issues.length > 0) {
    console.log(Formatter.subheader('⚠️  Detected Issues'));
    for (const issue of healthCheck.issues) {
      console.log(Formatter.warning(`• ${issue}`));
    }
    console.log('');
  }

  // Display suggestions
  if (healthCheck.suggestions.length > 0) {
    console.log(Formatter.subheader('💡 Suggestions'));
    for (const suggestion of healthCheck.suggestions) {
      console.log(Formatter.info(`• ${suggestion}`));
    }
    console.log('');
  }

  // Show verbose information if requested
  if (options.verbose) {
    await displayVerboseDiagnostics(indexManager);
  }

  // Auto-repair if requested or forced
  if (options.repair || options.force) {
    if (healthCheck.isValid && !options.force) {
      console.log(Formatter.info('📝 Index is healthy, no repair needed'));
    } else {
      console.log(Formatter.info('🔧 Starting auto-repair process...'));
      
      const repairResult = await indexManager.autoRepairIndex();
      
      if (repairResult.repaired) {
        console.log(Formatter.success('✅ Index repair completed successfully'));
        
        if (repairResult.actions.length > 0) {
          console.log(Formatter.subheader('🛠️  Repair Actions Taken'));
          for (const action of repairResult.actions) {
            console.log(Formatter.info(`• ${action}`));
          }
        }
      } else {
        console.log(Formatter.error('❌ Index repair failed'));
        
        if (repairResult.errors.length > 0) {
          console.log(Formatter.subheader('❌ Repair Errors'));
          for (const error of repairResult.errors) {
            console.log(Formatter.error(`• ${error}`));
          }
        }
      }
      
      console.log('');
    }
  }

  console.log(Formatter.dim(`\n⚡ Health check completed in ${Date.now() - startTime}ms`));

  // Return appropriate exit code
  if (healthCheck.isValid) {
    return 0; // Healthy
  } else if (options.repair || options.force) {
    const repairResult = await indexManager.autoRepairIndex();
    return repairResult.repaired ? 1 : 2; // Repaired or failed to repair
  } else {
    return 1; // Has issues but no repair attempted
  }
}

async function displayVerboseDiagnostics(indexManager: TrackdownIndexManager): Promise<void> {
  console.log(Formatter.subheader('🔍 Verbose Diagnostics'));
  
  try {
    const stats = await indexManager.getIndexStats();
    
    console.log(Formatter.info(`Cache hit: ${stats.cacheHit ? 'Yes' : 'No'}`));
    console.log(Formatter.info(`Index file exists: ${stats.indexFileExists ? 'Yes' : 'No'}`));
    
    if (stats.lastModified) {
      const ageHours = Math.round((Date.now() - stats.lastModified.getTime()) / (1000 * 60 * 60));
      console.log(Formatter.info(`Index age: ${ageHours} hours`));
    }
    
    console.log(Formatter.info(`Last full scan: ${stats.lastFullScan || 'Never'}`));
    console.log(Formatter.info(`Index size: ${(stats.indexSize / 1024).toFixed(2)} KB`));
    
    // Performance metrics
    console.log(Formatter.subheader('⚡ Performance Metrics'));
    console.log(Formatter.info(`Last load time: ${stats.performanceMetrics.lastLoadTime}ms`));
    console.log(Formatter.info(`Last update time: ${stats.performanceMetrics.lastUpdateTime}ms`));
    console.log(Formatter.info(`Last rebuild time: ${stats.performanceMetrics.lastRebuildTime}ms`));
    
    // Breakdown by type
    console.log(Formatter.subheader('📈 Item Breakdown'));
    console.log(Formatter.info(`Projects: ${stats.totalProjects || 0}`));
    console.log(Formatter.info(`Epics: ${stats.totalEpics}`));
    console.log(Formatter.info(`Issues: ${stats.totalIssues}`));
    console.log(Formatter.info(`Tasks: ${stats.totalTasks}`));
    console.log(Formatter.info(`PRs: ${stats.totalPRs}`));
    
  } catch (error) {
    console.log(Formatter.warning(`Could not gather verbose diagnostics: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }
  
  console.log('');
}