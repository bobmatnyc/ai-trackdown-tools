import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, vi } from 'vitest';

// Performance optimization: Disable AI-Trackdown index system during tests
const DISABLE_INDEX_SYSTEM = true;
const TEST_PERFORMANCE_MODE = true;

// Mock data types
export interface MockFileSystem {
  [path: string]: string | { [key: string]: string };
}

export interface TestContext {
  tempDir: string;
  mockFs: MockFileSystem;
  originalCwd: string;
  cleanup: () => void;
}

/**
 * Creates a temporary test directory with mock file system
 */
export function createTestContext(): TestContext {
  const tempDir = path.join(
    process.cwd(),
    'tests',
    `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  const originalCwd = process.cwd();

  // Create temp directory
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const mockFs: MockFileSystem = {};

  const cleanup = () => {
    try {
      // Restore original working directory safely
      if (fs.existsSync(originalCwd)) {
        process.chdir(originalCwd);
      } else {
        // If original directory was deleted, go to a safe directory
        process.chdir(require('node:os').homedir());
      }

      // Clean up temp directory with enhanced retry logic for locked files
      if (fs.existsSync(tempDir)) {
        let retries = 5; // Increased retries
        let retryDelay = 50; // Start with shorter delay

        while (retries > 0) {
          try {
            // Try to ensure no processes are using the directory
            if (process.platform === 'win32') {
              // On Windows, try to release file handles
              try {
                require('node:child_process').execSync(`taskkill /f /im node.exe 2>nul || true`, {
                  stdio: 'ignore',
                });
              } catch {}
            }

            fs.rmSync(tempDir, { recursive: true, force: true });
            break;
          } catch (error) {
            retries--;
            if (retries === 0) {
              console.warn(`Failed to cleanup temp directory after all retries: ${tempDir}`, error);
              // Try alternative cleanup method
              try {
                require('node:child_process').execSync(`rm -rf "${tempDir}"`, { stdio: 'ignore' });
              } catch (altError) {
                console.warn('Alternative cleanup also failed:', altError);
              }
            } else {
              // Exponential backoff for retries
              const delay = retryDelay * (6 - retries);
              const start = Date.now();
              while (Date.now() - start < delay) {
                // Synchronous delay
              }
              retryDelay *= 1.5;
            }
          }
        }
      }

      // Clear mockFs to free memory
      Object.keys(mockFs).forEach((key) => delete mockFs[key]);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  };

  return {
    tempDir,
    mockFs,
    originalCwd,
    cleanup,
  };
}

/**
 * Creates a pre-built AI-Trackdown index to prevent rebuilding during tests
 */
export function createMockIndex(tasksDir: string): void {
  const indexPath = path.join(tasksDir, '.ai-trackdown-index');
  const mockIndex = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    projectPath: tasksDir,
    projects: {},
    epics: {
      'EP-0001': {
        id: 'EP-0001',
        title: 'Test Epic',
        filePath: path.join(tasksDir, 'epics', 'EP-0001-test-epic.md'),
        status: 'active',
        priority: 'high',
        lastModified: new Date().toISOString(),
        fileSize: 1024,
        assignee: 'test-user',
        issueIds: ['ISS-0001'],
        completion_percentage: 0,
      },
    },
    issues: {
      'ISS-0001': {
        id: 'ISS-0001',
        title: 'Test Issue',
        filePath: path.join(tasksDir, 'issues', 'ISS-0001-test-issue.md'),
        status: 'active',
        priority: 'medium',
        lastModified: new Date().toISOString(),
        fileSize: 512,
        assignee: 'test-user',
        epicId: 'EP-0001',
        taskIds: ['TSK-0001'],
        prIds: [],
      },
    },
    tasks: {
      'TSK-0001': {
        id: 'TSK-0001',
        title: 'Test Task',
        filePath: path.join(tasksDir, 'tasks', 'TSK-0001-test-task.md'),
        status: 'pending',
        priority: 'medium',
        lastModified: new Date().toISOString(),
        fileSize: 256,
        assignee: 'test-user',
        issueId: 'ISS-0001',
        epicId: 'EP-0001',
      },
    },
    prs: {},
    stats: {
      totalProjects: 0,
      totalEpics: 1,
      totalIssues: 1,
      totalTasks: 1,
      totalPRs: 0,
      lastFullScan: new Date().toISOString(),
      indexSize: 2048,
      performanceMetrics: {
        lastLoadTime: 5,
        lastUpdateTime: 3,
        lastRebuildTime: 0,
      },
    },
  };

  fs.writeFileSync(indexPath, JSON.stringify(mockIndex, null, 2));
}

/**
 * Mock the TrackdownIndexManager to prevent index rebuilding
 */
export function mockIndexManager(): void {
  // Mock the console methods that create noise during tests
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;

  vi.spyOn(console, 'log').mockImplementation((...args) => {
    const message = args.join(' ');
    // Filter out index-related messages
    if (
      message.includes('🔄 Rebuilding') ||
      message.includes('Index file not found') ||
      message.includes('using high-performance index') ||
      message.includes('high-performance index system')
    ) {
      return; // Suppress these messages
    }
    originalConsoleLog(...args);
  });

  vi.spyOn(console, 'warn').mockImplementation((...args) => {
    const message = args.join(' ');
    // Filter out index-related warnings
    if (message.includes('Index file not found') || message.includes('Rebuilding...')) {
      return; // Suppress these warnings
    }
    originalConsoleWarn(...args);
  });
}

/**
 * Creates a mock trackdown project structure
 */
export function createMockProject(basePath: string, projectName: string = ''): void {
  const projectDir = projectName ? path.join(basePath, projectName) : basePath;
  const tasksDir = path.join(projectDir, 'tasks');

  // Create directory structure
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(path.join(tasksDir, 'epics'), { recursive: true });
  fs.mkdirSync(path.join(tasksDir, 'issues'), { recursive: true });
  fs.mkdirSync(path.join(tasksDir, 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(tasksDir, 'prs'), { recursive: true });
  fs.mkdirSync(path.join(tasksDir, 'templates'), { recursive: true });

  // Create basic project files
  fs.writeFileSync(path.join(projectDir, 'README.md'), '# Test Project\n\nThis is a test project.');

  // Create sample epic
  const epicContent = `---
title: Test Epic
description: A test epic for testing
status: active
priority: high
assignee: test-user
created_date: ${new Date().toISOString()}
updated_date: ${new Date().toISOString()}
estimated_tokens: 1000
actual_tokens: 0
ai_context:
  - context/requirements
  - context/constraints
sync_status: local
related_issues: []
dependencies: []
completion_percentage: 0
---

# Epic: Test Epic

## Overview
This is a test epic for testing purposes.

## Objectives
- [ ] Test objective 1
- [ ] Test objective 2

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2
`;

  fs.writeFileSync(path.join(tasksDir, 'epics', 'EP-0001-test-epic.md'), epicContent);

  // Create sample issue
  const issueContent = `---
title: Test Issue
description: A test issue for testing
status: active
priority: medium
assignee: test-user
created_date: ${new Date().toISOString()}
updated_date: ${new Date().toISOString()}
estimated_tokens: 500
actual_tokens: 0
ai_context:
  - context/requirements
sync_status: local
related_epics:
  - EP-0001
dependencies: []
completion_percentage: 0
---

# Issue: Test Issue

## Description
This is a test issue for testing purposes.

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2
`;

  fs.writeFileSync(path.join(tasksDir, 'issues', 'ISS-0001-test-issue.md'), issueContent);

  // Create templates
  const epicTemplate = `---
title: "{{title}}"
description: "{{description}}"
status: planning
priority: medium
assignee: "{{assignee}}"
created_date: {{created_date}}
updated_date: {{updated_date}}
estimated_tokens: {{estimated_tokens}}
actual_tokens: 0
ai_context:
  - context/requirements
  - context/constraints
  - context/assumptions
  - context/dependencies
sync_status: local
related_issues: []
dependencies: []
completion_percentage: 0
---

# Epic: {{title}}

## Overview
{{description}}

## Objectives
- [ ] Objective 1
- [ ] Objective 2

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2
`;

  fs.writeFileSync(path.join(tasksDir, 'templates', 'epic-default.yaml'), epicTemplate);

  // Create PR template
  const prTemplate = `---
title: "{{title}}"
description: "{{description}}"
status: planning
pr_status: draft
priority: medium
assignee: "{{assignee}}"
created_date: {{created_date}}
updated_date: {{updated_date}}
branch: "{{branch_name}}"
target_branch: "{{target_branch}}"
source_branch: "{{source_branch}}"
repository_url: "{{repository_url}}"
related_issues: []
related_epics: []
dependencies: []
reviewers: []
labels: []
github_pr_number: null
github_url: null
review_status: pending
merge_status: pending
---

# Pull Request: {{title}}

## Description
{{description}}

## Changes
- [ ] Change 1
- [ ] Change 2

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass

## Review Checklist
- [ ] Code review completed
- [ ] Documentation updated
`;

  fs.writeFileSync(path.join(tasksDir, 'templates', 'pr-default.yaml'), prTemplate);

  // Create issue template
  const issueTemplate = `---
title: "{{title}}"
description: "{{description}}"
status: active
priority: medium
assignee: "{{assignee}}"
created_date: {{created_date}}
updated_date: {{updated_date}}
estimated_tokens: {{estimated_tokens}}
actual_tokens: 0
ai_context:
  - context/requirements
sync_status: local
related_epics: []
related_tasks: []
dependencies: []
completion_percentage: 0
---

# Issue: {{title}}

## Description
{{description}}

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2
`;

  fs.writeFileSync(path.join(tasksDir, 'templates', 'issue-default.yaml'), issueTemplate);

  // Create task template
  const taskTemplate = `---
title: "{{title}}"
description: "{{description}}"
status: pending
priority: medium
assignee: "{{assignee}}"
created_date: {{created_date}}
updated_date: {{updated_date}}
estimated_time: "{{estimated_time}}"
actual_time: "0h"
related_issue: "{{related_issue}}"
related_epic: null
dependencies: []
completion_percentage: 0
---

# Task: {{title}}

## Description
{{description}}

## Implementation Notes
- Implementation detail 1
- Implementation detail 2
`;

  fs.writeFileSync(path.join(tasksDir, 'templates', 'task-default.yaml'), taskTemplate);

  // Create mock index to prevent rebuilding during tests
  if (DISABLE_INDEX_SYSTEM) {
    createMockIndex(tasksDir);
  }
}

/**
 * Mock file system operations
 */
export class MockFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  writeFile(filePath: string, content: string): void {
    this.files.set(filePath, content);
    // Add parent directories
    const dir = path.dirname(filePath);
    this.directories.add(dir);
  }

  readFile(filePath: string): string {
    if (!this.files.has(filePath)) {
      throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    }
    return this.files.get(filePath)!;
  }

  exists(filePath: string): boolean {
    return this.files.has(filePath) || this.directories.has(filePath);
  }

  mkdir(dirPath: string): void {
    this.directories.add(dirPath);
  }

  readdir(dirPath: string): string[] {
    const files: string[] = [];
    for (const file of this.files.keys()) {
      if (path.dirname(file) === dirPath) {
        files.push(path.basename(file));
      }
    }
    return files;
  }

  clear(): void {
    this.files.clear();
    this.directories.clear();
  }
}

/**
 * Common test assertions
 */
export class TestAssertions {
  static assertFileExists(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Expected file to exist: ${filePath}`);
    }
  }

  static assertFileContains(filePath: string, content: string): void {
    TestAssertions.assertFileExists(filePath);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    if (!fileContent.includes(content)) {
      throw new Error(`Expected file ${filePath} to contain: ${content}`);
    }
  }

  static assertValidYamlFrontmatter(filePath: string): void {
    TestAssertions.assertFileExists(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.startsWith('---\n')) {
      throw new Error(`Expected file ${filePath} to have YAML frontmatter`);
    }
    const endIndex = content.indexOf('---\n', 4);
    if (endIndex === -1) {
      throw new Error(`Expected file ${filePath} to have valid YAML frontmatter`);
    }
  }

  static assertDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      throw new Error(`Expected directory to exist: ${dirPath}`);
    }
  }
}

/**
 * CLI command testing utilities
 */
export class CLITestUtils {
  static async runCommand(
    command: string,
    args: string[] = [],
    options: { cwd?: string } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const { cwd = process.cwd() } = options;

    try {
      const result = execSync(`${command} ${args.join(' ')}`, {
        cwd,
        encoding: 'utf-8',
        timeout: 10000,
      });

      return {
        stdout: result.toString(),
        stderr: '',
        exitCode: 0,
      };
    } catch (error: any) {
      return {
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        exitCode: error.status || 1,
      };
    }
  }

  static mockConsole() {
    const originalConsole = { ...console };
    const logs: string[] = [];
    const errors: string[] = [];
    const warns: string[] = [];

    vi.spyOn(console, 'log').mockImplementation((message: string) => {
      logs.push(message);
    });

    vi.spyOn(console, 'error').mockImplementation((message: string) => {
      errors.push(message);
    });

    vi.spyOn(console, 'warn').mockImplementation((message: string) => {
      warns.push(message);
    });

    return {
      logs,
      errors,
      warns,
      restore: () => {
        Object.assign(console, originalConsole);
      },
    };
  }
}

/**
 * Error testing utilities
 */
export class ErrorTestUtils {
  static createFileSystemError(code: string, path: string): Error {
    const error = new Error(`${code}: ${path}`);
    (error as any).code = code;
    (error as any).path = path;
    return error;
  }

  static createNetworkError(message: string): Error {
    const error = new Error(message);
    (error as any).code = 'ECONNREFUSED';
    return error;
  }

  static createYamlParseError(line: number, column: number): Error {
    const error = new Error(`YAMLException: bad indentation at line ${line}, column ${column}`);
    (error as any).name = 'YAMLException';
    return error;
  }
}

/**
 * Setup function for all tests
 */
export function setupTestEnvironment() {
  let testContext: TestContext;
  let originalNodePath: string | undefined;
  let originalPath: string | undefined;
  let originalCwd: string;

  beforeEach(() => {
    // Store original environment before any changes
    originalCwd = process.cwd();
    originalNodePath = process.env.NODE_PATH;
    originalPath = process.env.PATH;

    testContext = createTestContext();

    // Mock environment variables
    process.env.NODE_ENV = 'test';
    process.env.CLI_TASKS_DIR = path.join(testContext.tempDir, 'tasks');
    process.env.CLI_PROJECT_DIR = testContext.tempDir;

    // Performance optimization: Set test mode flags
    if (TEST_PERFORMANCE_MODE) {
      process.env.AI_TRACKDOWN_TEST_MODE = 'true';
      process.env.AI_TRACKDOWN_DISABLE_INDEX = 'true';
      process.env.AI_TRACKDOWN_MOCK_INDEX = 'true';
    }

    // Preserve critical environment variables for subprocess execution
    if (originalNodePath) {
      process.env.NODE_PATH = originalNodePath;
    }
    if (originalPath) {
      process.env.PATH = originalPath;
    }

    // Mock index manager to prevent rebuilding
    if (DISABLE_INDEX_SYSTEM) {
      mockIndexManager();
    }

    // Change to test directory safely
    try {
      if (fs.existsSync(testContext.tempDir)) {
        process.chdir(testContext.tempDir);
      }
    } catch (error) {
      console.warn('Failed to change to test directory:', error);
    }
  });

  afterEach(() => {
    try {
      // Restore working directory first
      if (originalCwd && fs.existsSync(originalCwd)) {
        process.chdir(originalCwd);
      }

      // Clean up test context
      if (testContext) {
        testContext.cleanup();
      }

      // Restore mocks and clear console spies
      vi.restoreAllMocks();

      // Clear any process event listeners that might have accumulated
      if (process.env.NODE_ENV === 'test') {
        // Remove test-specific event listeners
        process.removeAllListeners('uncaughtException');
        process.removeAllListeners('unhandledRejection');
      }

      // Restore environment variables
      if (originalNodePath !== undefined) {
        process.env.NODE_PATH = originalNodePath;
      }
      if (originalPath !== undefined) {
        process.env.PATH = originalPath;
      }

      // Force garbage collection in test environment
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      console.warn('AfterEach cleanup failed:', error);
    }
  });

  return () => testContext;
}
