import { beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

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
  const tempDir = path.join(process.cwd(), 'tests', `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const originalCwd = process.cwd();
  
  // Create temp directory
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const mockFs: MockFileSystem = {};

  const cleanup = () => {
    try {
      // Restore original working directory
      process.chdir(originalCwd);
      
      // Clean up temp directory
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  };

  return {
    tempDir,
    mockFs,
    originalCwd,
    cleanup
  };
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
    this.assertFileExists(filePath);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    if (!fileContent.includes(content)) {
      throw new Error(`Expected file ${filePath} to contain: ${content}`);
    }
  }

  static assertValidYamlFrontmatter(filePath: string): void {
    this.assertFileExists(filePath);
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
  static async runCommand(command: string, args: string[] = [], options: { cwd?: string } = {}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const { cwd = process.cwd() } = options;
    
    try {
      const result = execSync(`${command} ${args.join(' ')}`, {
        cwd,
        encoding: 'utf-8',
        timeout: 10000
      });
      
      return {
        stdout: result.toString(),
        stderr: '',
        exitCode: 0
      };
    } catch (error: any) {
      return {
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        exitCode: error.status || 1
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
      }
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

  beforeEach(() => {
    testContext = createTestContext();
    
    // Mock environment variables
    process.env.NODE_ENV = 'test';
    process.env.CLI_TASKS_DIR = '';
    process.env.CLI_PROJECT_DIR = '';
    
    // Change to test directory
    process.chdir(testContext.tempDir);
  });

  afterEach(() => {
    if (testContext) {
      testContext.cleanup();
    }
    
    // Restore mocks
    vi.restoreAllMocks();
  });

  return () => testContext;
}