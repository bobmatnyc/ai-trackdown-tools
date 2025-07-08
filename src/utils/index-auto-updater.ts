/**
 * Index Auto-Updater Utility
 * Provides helper functions to automatically update the TrackdownIndex
 * when items are created, modified, or deleted
 */

import { TrackdownIndexManager } from './trackdown-index-manager.js';
import { ConfigManager } from './config-manager.js';
import { Formatter } from './formatter.js';
import type { ItemType } from '../types/ai-trackdown.js';

export class IndexAutoUpdater {
  private indexManager: TrackdownIndexManager;
  private isEnabled: boolean = true;

  constructor(config: any, projectRoot: string, cliTasksDir?: string) {
    this.indexManager = new TrackdownIndexManager(config, projectRoot, cliTasksDir);
  }

  /**
   * Enable or disable automatic index updates
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Update index after item creation
   */
  async onItemCreated(type: ItemType, id: string, silent: boolean = false): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await this.indexManager.updateItem(type, id);
      if (!silent) {
        console.log(Formatter.dim(`✓ Index updated for ${type} ${id}`));
      }
    } catch (error) {
      if (!silent) {
        console.warn(Formatter.warning(`Index update failed (non-critical): ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    }
  }

  /**
   * Update index after item modification
   */
  async onItemUpdated(type: ItemType, id: string, silent: boolean = false): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await this.indexManager.updateItem(type, id);
      if (!silent) {
        console.log(Formatter.dim(`✓ Index updated for ${type} ${id}`));
      }
    } catch (error) {
      if (!silent) {
        console.warn(Formatter.warning(`Index update failed (non-critical): ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    }
  }

  /**
   * Update index after item deletion
   */
  async onItemDeleted(type: ItemType, id: string, silent: boolean = false): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await this.indexManager.removeItem(type, id);
      if (!silent) {
        console.log(Formatter.dim(`✓ Index updated (removed ${type} ${id})`));
      }
    } catch (error) {
      if (!silent) {
        console.warn(Formatter.warning(`Index cleanup failed (non-critical): ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    }
  }

  /**
   * Batch update multiple items (for performance)
   */
  async onBatchUpdate(updates: { type: ItemType; id: string; action: 'create' | 'update' | 'delete' }[], silent: boolean = false): Promise<void> {
    if (!this.isEnabled) return;

    const promises = updates.map(async (update) => {
      try {
        switch (update.action) {
          case 'create':
          case 'update':
            await this.indexManager.updateItem(update.type, update.id);
            break;
          case 'delete':
            await this.indexManager.removeItem(update.type, update.id);
            break;
        }
      } catch (error) {
        if (!silent) {
          console.warn(Formatter.warning(`Index ${update.action} failed for ${update.type} ${update.id}: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      }
    });

    await Promise.all(promises);
    
    if (!silent && updates.length > 1) {
      console.log(Formatter.dim(`✓ Index batch updated (${updates.length} items)`));
    }
  }

  /**
   * Force rebuild index (useful for migration or corruption recovery)
   */
  async rebuildIndex(silent: boolean = false): Promise<void> {
    try {
      if (!silent) {
        console.log(Formatter.info('🔄 Rebuilding index...'));
      }
      
      await this.indexManager.rebuildIndex();
      
      if (!silent) {
        console.log(Formatter.success('✅ Index rebuilt successfully'));
      }
    } catch (error) {
      if (!silent) {
        console.error(Formatter.error(`Index rebuild failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
      throw error;
    }
  }

  /**
   * Check index health and rebuild if necessary
   */
  async validateAndRepair(silent: boolean = false): Promise<boolean> {
    try {
      const isValid = await this.indexManager.validateIndex();
      
      if (!isValid) {
        if (!silent) {
          console.warn(Formatter.warning('Index validation failed. Rebuilding...'));
        }
        await this.rebuildIndex(silent);
        return true;
      }
      
      return false;
    } catch (error) {
      if (!silent) {
        console.warn(Formatter.warning(`Index validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
      return false;
    }
  }

  /**
   * Get index statistics for monitoring
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    stats: any;
    needsRebuild: boolean;
  }> {
    try {
      const stats = await this.indexManager.getIndexStats();
      const needsRebuild = !stats.healthy || !stats.indexFileExists;
      
      return {
        healthy: stats.healthy,
        stats,
        needsRebuild
      };
    } catch (error) {
      return {
        healthy: false,
        stats: null,
        needsRebuild: true
      };
    }
  }

  /**
   * Get the underlying index manager (for advanced operations)
   */
  getIndexManager(): TrackdownIndexManager {
    return this.indexManager;
  }
}

/**
 * Factory function to create IndexAutoUpdater instance
 */
export function createIndexAutoUpdater(cliTasksDir?: string): IndexAutoUpdater | null {
  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const projectRoot = configManager.findProjectRoot();
    
    return new IndexAutoUpdater(config, projectRoot, cliTasksDir);
  } catch (error) {
    // Not in a valid AI-Trackdown project, index auto-updater not available
    return null;
  }
}

/**
 * Helper function to wrap command functions with automatic index updates
 */
export function withIndexUpdate<T extends any[], R>(
  commandFn: (...args: T) => Promise<R>,
  getUpdateInfo: (...args: T) => { type: ItemType; id: string; action: 'create' | 'update' | 'delete' } | null,
  cliTasksDir?: string
) {
  return async (...args: T): Promise<R> => {
    const result = await commandFn(...args);
    
    const updateInfo = getUpdateInfo(...args);
    if (updateInfo) {
      const updater = createIndexAutoUpdater(cliTasksDir);
      if (updater) {
        switch (updateInfo.action) {
          case 'create':
            await updater.onItemCreated(updateInfo.type, updateInfo.id, true);
            break;
          case 'update':
            await updater.onItemUpdated(updateInfo.type, updateInfo.id, true);
            break;
          case 'delete':
            await updater.onItemDeleted(updateInfo.type, updateInfo.id, true);
            break;
        }
      }
    }
    
    return result;
  };
}

/**
 * Auto-initialization function for commands
 * Ensures index is healthy before operations
 */
export async function ensureIndexHealth(cliTasksDir?: string, silent: boolean = true): Promise<void> {
  const updater = createIndexAutoUpdater(cliTasksDir);
  if (updater) {
    const health = await updater.getHealthStatus();
    if (health.needsRebuild) {
      if (!silent) {
        console.log(Formatter.info('🔧 Initializing index for optimal performance...'));
      }
      await updater.rebuildIndex(silent);
    }
  }
}