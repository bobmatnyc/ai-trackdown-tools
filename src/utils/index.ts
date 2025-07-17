/**
 * Common utility functions for AI Trackdown Tools
 */

import { promises as fs } from 'fs';
import path from 'path';
import { IdGenerator } from './simple-id-generator.js';
import { ProjectDetector } from './project-detector.js';

/**
 * Get the project root directory
 */
export async function getProjectRoot(projectPath?: string): Promise<string> {
  if (projectPath) {
    // Verify the path exists
    try {
      await fs.access(projectPath);
      return path.resolve(projectPath);
    } catch (error) {
      throw new Error(`Project path not found: ${projectPath}`);
    }
  }
  
  // Use current working directory
  return process.cwd();
}

/**
 * Load the project index
 */
export async function loadIndex(projectRoot: string): Promise<any> {
  const indexPath = path.join(projectRoot, '.ai-trackdown-index');
  
  try {
    const content = await fs.readFile(indexPath, 'utf-8');
    const index = JSON.parse(content);
    
    // Convert to expected format
    const issues: any = {};
    if (index.issues) {
      for (const issue of index.issues) {
        issues[issue.id] = {
          path: issue.filePath,
          lastModified: issue.lastModified,
        };
      }
    }
    
    const epics: any = {};
    if (index.epics) {
      for (const epic of index.epics) {
        epics[epic.id] = {
          path: epic.filePath,
          lastModified: epic.lastModified,
        };
      }
    }
    
    return {
      version: index.version || '1.0.0',
      lastUpdated: index.lastUpdated || new Date().toISOString(),
      issues,
      epics,
      comments: index.comments || {},
      relationships: index.relationships || {},
    };
  } catch (error) {
    // Return empty index if file doesn't exist
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      issues: {},
      epics: {},
      comments: {},
      relationships: {},
    };
  }
}

/**
 * Save the project index
 */
export async function saveIndex(projectRoot: string, index: any): Promise<void> {
  const indexPath = path.join(projectRoot, '.ai-trackdown-index');
  
  // Load existing index to preserve data
  let existingIndex: any = {};
  try {
    const content = await fs.readFile(indexPath, 'utf-8');
    existingIndex = JSON.parse(content);
  } catch (error) {
    // File doesn't exist, that's okay
  }
  
  // Convert back to array format
  const issues = [];
  for (const [id, data] of Object.entries(index.issues)) {
    const issueData: any = data;
    issues.push({
      id,
      filePath: issueData.path,
      lastModified: issueData.lastModified,
      ...(existingIndex.issues?.find((i: any) => i.id === id) || {}),
    });
  }
  
  const epics = [];
  for (const [id, data] of Object.entries(index.epics)) {
    const epicData: any = data;
    epics.push({
      id,
      filePath: epicData.path,
      lastModified: epicData.lastModified,
      ...(existingIndex.epics?.find((e: any) => e.id === id) || {}),
    });
  }
  
  // Merge with existing data
  const newIndex = {
    ...existingIndex,
    version: index.version || '1.0.0',
    lastUpdated: new Date().toISOString(),
    issues,
    epics,
    comments: index.comments || existingIndex.comments || {},
    relationships: index.relationships || existingIndex.relationships || {},
  };
  
  // Write index file
  await fs.writeFile(indexPath, JSON.stringify(newIndex, null, 2));
}

/**
 * Generate a new comment ID
 */
export async function generateCommentId(projectRoot: string): Promise<string> {
  // Create ID generator instance
  const idGenerator = new IdGenerator();
  return idGenerator.generateCommentId();
}

/**
 * Format a comment for display
 */
export function formatComment(comment: any): string {
  // Simple formatting for now
  const lines = comment.body.split('\n');
  return lines.map((line: string) => `  ${line}`).join('\n');
}