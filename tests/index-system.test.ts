/**
 * TrackdownIndexManager Test Suite
 * Comprehensive tests for the high-performance index file system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TrackdownIndexManager } from '../src/utils/trackdown-index-manager.js';
import { ConfigManager } from '../src/utils/config-manager.js';
import { FrontmatterParser } from '../src/utils/frontmatter-parser.js';
import type { ProjectConfig, EpicFrontmatter, IssueFrontmatter, TaskFrontmatter } from '../src/types/ai-trackdown.js';

describe('TrackdownIndexManager', () => {
  let testDir: string;
  let config: ProjectConfig;
  let indexManager: TrackdownIndexManager;
  let frontmatterParser: FrontmatterParser;

  beforeEach(() => {
    // Create temporary test directory
    testDir = path.join(__dirname, `test-${Date.now()}-${Math.random().toString(36).substring(2)}`);
    fs.mkdirSync(testDir, { recursive: true });

    // Create test configuration
    config = {
      name: 'Test Project',
      description: 'Test project for index system',
      version: '1.0.0',
      tasks_directory: 'tasks',
      structure: {
        epics_dir: 'epics',
        issues_dir: 'issues',
        tasks_dir: 'tasks',
        templates_dir: 'templates',
        prs_dir: 'prs'
      },
      naming_conventions: {
        epic_prefix: 'EP',
        issue_prefix: 'ISS',
        task_prefix: 'TSK',
        pr_prefix: 'PR',
        file_extension: '.md'
      },
      default_assignee: 'test-user',
      ai_context_templates: [],
      automation: {
        auto_update_timestamps: true,
        auto_calculate_tokens: false,
        auto_sync_status: true
      }
    };

    // Initialize index manager and parser
    indexManager = new TrackdownIndexManager(config, testDir);
    frontmatterParser = new FrontmatterParser();

    // Create directory structure
    const tasksDir = path.join(testDir, 'tasks');
    fs.mkdirSync(path.join(tasksDir, 'epics'), { recursive: true });
    fs.mkdirSync(path.join(tasksDir, 'issues'), { recursive: true });
    fs.mkdirSync(path.join(tasksDir, 'tasks'), { recursive: true });
    fs.mkdirSync(path.join(tasksDir, 'prs'), { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Index Creation and Loading', () => {
    it('should create a new index when none exists', async () => {
      const index = await indexManager.rebuildIndex();
      
      expect(index.version).toBe('1.0.0');
      expect(index.projectPath).toBe(testDir);
      expect(index.epics).toEqual({});
      expect(index.issues).toEqual({});
      expect(index.tasks).toEqual({});
      expect(index.prs).toEqual({});
    });

    it('should save and load index correctly', async () => {
      const originalIndex = await indexManager.rebuildIndex();
      const loadedIndex = await indexManager.loadIndex();
      
      expect(loadedIndex.version).toBe(originalIndex.version);
      expect(loadedIndex.projectPath).toBe(originalIndex.projectPath);
      expect(loadedIndex.lastUpdated).toBe(originalIndex.lastUpdated);
    });

    it('should validate index structure correctly', async () => {
      await indexManager.rebuildIndex();
      const isValid = await indexManager.validateIndex();
      
      expect(isValid).toBe(true);
    });
  });

  describe('Item Indexing', () => {
    beforeEach(async () => {
      // Create test files
      await createTestEpic();
      await createTestIssue();
      await createTestTask();
    });

    it('should index epic files correctly', async () => {
      const index = await indexManager.rebuildIndex();
      
      expect(Object.keys(index.epics)).toHaveLength(1);
      const epic = index.epics['EP-0001'];
      expect(epic).toBeDefined();
      expect(epic.id).toBe('EP-0001');
      expect(epic.title).toBe('Test Epic');
      expect(epic.status).toBe('planning');
      expect(epic.priority).toBe('medium');
    });

    it('should index issue files correctly', async () => {
      const index = await indexManager.rebuildIndex();
      
      expect(Object.keys(index.issues)).toHaveLength(1);
      const issue = index.issues['ISS-0001'];
      expect(issue).toBeDefined();
      expect(issue.id).toBe('ISS-0001');
      expect(issue.title).toBe('Test Issue');
      expect(issue.epicId).toBe('EP-0001');
    });

    it('should index task files correctly', async () => {
      const index = await indexManager.rebuildIndex();
      
      expect(Object.keys(index.tasks)).toHaveLength(1);
      const task = index.tasks['TSK-0001'];
      expect(task).toBeDefined();
      expect(task.id).toBe('TSK-0001');
      expect(task.title).toBe('Test Task');
      expect(task.issueId).toBe('ISS-0001');
      expect(task.epicId).toBe('EP-0001');
    });

    it('should build relationships correctly', async () => {
      const index = await indexManager.rebuildIndex();
      
      const epic = index.epics['EP-0001'];
      const issue = index.issues['ISS-0001'];
      
      expect(epic.issueIds).toContain('ISS-0001');
      expect(issue.taskIds).toContain('TSK-0001');
    });
  });

  describe('Incremental Updates', () => {
    beforeEach(async () => {
      await createTestEpic();
      await indexManager.rebuildIndex();
    });

    it('should update existing items correctly', async () => {
      // Modify the epic file
      const epicPath = path.join(testDir, 'tasks', 'epics', 'EP-0001-test-epic.md');
      const content = fs.readFileSync(epicPath, 'utf8');
      const updatedContent = content.replace('status: planning', 'status: active');
      fs.writeFileSync(epicPath, updatedContent);

      // Update index
      await indexManager.updateItem('epic', 'EP-0001');
      const index = await indexManager.loadIndex();

      expect(index.epics['EP-0001'].status).toBe('active');
    });

    it('should remove deleted items correctly', async () => {
      await indexManager.removeItem('epic', 'EP-0001');
      const index = await indexManager.loadIndex();

      expect(index.epics['EP-0001']).toBeUndefined();
    });

    it('should handle item creation correctly', async () => {
      await createSecondTestEpic();
      await indexManager.updateItem('epic', 'EP-0002');
      
      const index = await indexManager.loadIndex();
      expect(Object.keys(index.epics)).toHaveLength(2);
      expect(index.epics['EP-0002']).toBeDefined();
    });
  });

  describe('Performance and Caching', () => {
    beforeEach(async () => {
      // Create multiple test files for performance testing
      for (let i = 1; i <= 10; i++) {
        await createTestEpic(`EP-${i.toString().padStart(4, '0')}`, `Test Epic ${i}`);
        await createTestIssue(`ISS-${i.toString().padStart(4, '0')}`, `Test Issue ${i}`, `EP-${i.toString().padStart(4, '0')}`);
        await createTestTask(`TSK-${i.toString().padStart(4, '0')}`, `Test Task ${i}`, `ISS-${i.toString().padStart(4, '0')}`, `EP-${i.toString().padStart(4, '0')}`);
      }
    });

    it('should rebuild index quickly', async () => {
      const startTime = Date.now();
      await indexManager.rebuildIndex();
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000); // Should rebuild in under 1 second
    });

    it('should load index quickly from cache', async () => {
      await indexManager.rebuildIndex();
      
      const startTime = Date.now();
      await indexManager.loadIndex();
      await indexManager.loadIndex(); // Second call should be cached
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(50); // Should load very quickly from cache
    });

    it('should provide accurate statistics', async () => {
      await indexManager.rebuildIndex();
      const stats = await indexManager.getIndexStats();

      expect(stats.totalEpics).toBe(10);
      expect(stats.totalIssues).toBe(10);
      expect(stats.totalTasks).toBe(10);
      expect(stats.healthy).toBe(true);
      expect(stats.indexFileExists).toBe(true);
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      await createTestEpic('EP-0001', 'Active Epic', 'active', 'high');
      await createTestEpic('EP-0002', 'Planning Epic', 'planning', 'medium');
      await createTestIssue('ISS-0001', 'Active Issue', 'EP-0001', 'active', 'high');
      await createTestIssue('ISS-0002', 'Planning Issue', 'EP-0002', 'planning', 'low');
      await indexManager.rebuildIndex();
    });

    it('should filter items by status correctly', async () => {
      const activeItems = await indexManager.getItemsByStatus('active');
      expect(activeItems).toHaveLength(2);
      expect(activeItems.map(item => item.id)).toEqual(expect.arrayContaining(['EP-0001', 'ISS-0001']));
    });

    it('should get items by type correctly', async () => {
      const epics = await indexManager.getItemsByType('epic');
      const issues = await indexManager.getItemsByType('issue');
      
      expect(epics).toHaveLength(2);
      expect(issues).toHaveLength(2);
    });

    it('should find items by ID correctly', async () => {
      const epic = await indexManager.getItemById('epic', 'EP-0001');
      expect(epic).toBeDefined();
      expect(epic!.title).toBe('Active Epic');
      
      const nonExistent = await indexManager.getItemById('epic', 'EP-9999');
      expect(nonExistent).toBeNull();
    });

    it('should generate project overview correctly', async () => {
      const overview = await indexManager.getProjectOverview();
      
      expect(overview.totalItems).toBe(4);
      expect(overview.byType.epic).toBe(2);
      expect(overview.byType.issue).toBe(2);
      expect(overview.byStatus.active).toBe(2);
      expect(overview.byStatus.planning).toBe(2);
      expect(overview.byPriority.high).toBe(2);
      expect(overview.byPriority.medium).toBe(1);
      expect(overview.byPriority.low).toBe(1);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle corrupted index files gracefully', async () => {
      // Create corrupted index file
      const indexPath = path.join(testDir, 'tasks', '.ai-trackdown-index');
      fs.writeFileSync(indexPath, 'invalid json content');

      // Should rebuild automatically
      const index = await indexManager.loadIndex();
      expect(index.version).toBe('1.0.0');
    });

    it('should handle missing files gracefully', async () => {
      await createTestEpic();
      await indexManager.rebuildIndex();
      
      // Delete the file but try to update index
      const epicPath = path.join(testDir, 'tasks', 'epics', 'EP-0001-test-epic.md');
      fs.unlinkSync(epicPath);
      
      // Should remove from index automatically
      await indexManager.updateItem('epic', 'EP-0001');
      const index = await indexManager.loadIndex();
      expect(index.epics['EP-0001']).toBeUndefined();
    });

    it('should validate index health correctly', async () => {
      const stats = await indexManager.getIndexStats();
      expect(stats.healthy).toBe(true);
      
      // Create invalid index state (empty index should rebuild)
      indexManager.clearCache();
      await indexManager.rebuildIndex();
      const isValid = await indexManager.validateIndex();
      expect(isValid).toBe(true);
    });
  });

  // Helper functions
  async function createTestEpic(id: string = 'EP-0001', title: string = 'Test Epic', status: string = 'planning', priority: string = 'medium'): Promise<void> {
    const epicFrontmatter: EpicFrontmatter = {
      epic_id: id,
      title,
      description: 'Test epic description',
      status: status as any,
      priority: priority as any,
      assignee: 'test-user',
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
      estimated_tokens: 100,
      actual_tokens: 0,
      ai_context: [],
      sync_status: 'local',
      related_issues: [],
      completion_percentage: 0
    };

    const content = `# Epic: ${title}

## Overview
Test epic for the index system.

## Objectives
- [ ] Objective 1
- [ ] Objective 2

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2`;

    const filename = `${id}-${title.toLowerCase().replace(/\s+/g, '-')}.md`;
    const filePath = path.join(testDir, 'tasks', 'epics', filename);
    frontmatterParser.writeEpic(filePath, epicFrontmatter, content);
  }

  async function createSecondTestEpic(): Promise<void> {
    await createTestEpic('EP-0002', 'Second Test Epic');
  }

  async function createTestIssue(id: string = 'ISS-0001', title: string = 'Test Issue', epicId: string = 'EP-0001', status: string = 'planning', priority: string = 'medium'): Promise<void> {
    const issueFrontmatter: IssueFrontmatter = {
      issue_id: id,
      epic_id: epicId,
      title,
      description: 'Test issue description',
      status: status as any,
      priority: priority as any,
      assignee: 'test-user',
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
      estimated_tokens: 50,
      actual_tokens: 0,
      ai_context: [],
      sync_status: 'local',
      related_tasks: [],
      completion_percentage: 0
    };

    const content = `# Issue: ${title}

## Description
Test issue for the index system.

## Tasks
- [ ] Task 1
- [ ] Task 2

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2`;

    const filename = `${id}-${title.toLowerCase().replace(/\s+/g, '-')}.md`;
    const filePath = path.join(testDir, 'tasks', 'issues', filename);
    frontmatterParser.writeIssue(filePath, issueFrontmatter, content);
  }

  async function createTestTask(id: string = 'TSK-0001', title: string = 'Test Task', issueId: string = 'ISS-0001', epicId: string = 'EP-0001'): Promise<void> {
    const taskFrontmatter: TaskFrontmatter = {
      task_id: id,
      issue_id: issueId,
      epic_id: epicId,
      title,
      description: 'Test task description',
      status: 'planning',
      priority: 'medium',
      assignee: 'test-user',
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
      estimated_tokens: 25,
      actual_tokens: 0,
      ai_context: [],
      sync_status: 'local',
      time_estimate: '2h'
    };

    const content = `# Task: ${title}

## Description
Test task for the index system.

## Steps
1. Step 1
2. Step 2
3. Step 3

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2`;

    const filename = `${id}-${title.toLowerCase().replace(/\s+/g, '-')}.md`;
    const filePath = path.join(testDir, 'tasks', 'tasks', filename);
    frontmatterParser.writeTask(filePath, taskFrontmatter, content);
  }
});