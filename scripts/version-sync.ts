#!/usr/bin/env tsx

/**
 * Version Synchronization Script
 * 
 * This script ensures all version references across the project
 * are synchronized with the VERSION file.
 */

import { VersionManager } from '../src/utils/version.js';
import chalk from 'chalk';

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const prefix = {
    info: chalk.blue('ℹ'),
    success: chalk.green('✅'),
    error: chalk.red('❌'),
    warning: chalk.yellow('⚠️'),
  }[type];
  
  console.log(`${prefix} ${message}`);
}

async function main() {
  try {
    log('Starting version synchronization...', 'info');
    
    // Get current version
    const versionInfo = VersionManager.getVersion();
    log(`Source version: ${versionInfo.version}`, 'info');
    
    // Check consistency first
    const consistency = VersionManager.validateVersionConsistency();
    
    if (consistency.consistent) {
      log('All files are already synchronized!', 'success');
      return;
    }
    
    log('Version inconsistency detected:', 'warning');
    for (const [file, version] of Object.entries(consistency.versions)) {
      const status = version === versionInfo.version ? '✅' : '❌';
      log(`  ${file}: ${version} ${status}`, 'info');
    }
    
    // Perform synchronization
    log('Synchronizing versions...', 'info');
    VersionManager.syncVersion();
    
    // Verify synchronization
    const newConsistency = VersionManager.validateVersionConsistency();
    
    if (newConsistency.consistent) {
      log('Version synchronization completed successfully!', 'success');
      log(`All files now use version: ${versionInfo.version}`, 'info');
    } else {
      log('Synchronization failed!', 'error');
      for (const [file, version] of Object.entries(newConsistency.versions)) {
        const status = version === versionInfo.version ? '✅' : '❌';
        log(`  ${file}: ${version} ${status}`, 'info');
      }
      process.exit(1);
    }
    
  } catch (error) {
    log(`Synchronization failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}