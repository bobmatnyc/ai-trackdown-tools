import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { main } from '../../src/index.js';
import { CLITestUtils, setupTestEnvironment, TestAssertions } from '../utils/test-helpers.js';
import { TestDataManager } from './test-data-manager.js';

// Mock external dependencies
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  }),
}));

vi.mock('chalk', () => ({
  default: {
    green: vi.fn((text) => text),
    red: vi.fn((text) => text),
    blue: vi.fn((text) => text),
    yellow: vi.fn((text) => text),
    cyan: vi.fn((text) => text),
    gray: vi.fn((text) => text),
    bold: {
      green: vi.fn((text) => text),
      red: vi.fn((text) => text),
      blue: vi.fn((text) => text),
      yellow: vi.fn((text) => text),
      cyan: vi.fn((text) => text),
    },
  },
}));

describe('Multi-Project Integration Tests', () => {
  const getTestContext = setupTestEnvironment();
  let testDataManager: TestDataManager;

  beforeEach(() => {
    testDataManager = new TestDataManager();
  });

  afterEach(() => {
    testDataManager.cleanup();
  });

  // Helper function to run CLI commands
  async function runCLICommand(
    args: string[]
  ): Promise<{ stdout: string; stderr: string; success: boolean }> {
    const consoleMock = CLITestUtils.mockConsole();
    const originalArgv = process.argv;
    const originalExit = process.exit;

    let exitCode = 0;
    process.exit = vi.fn((code = 0) => {
      exitCode = code;
      throw new Error(`Process exit: ${code}`);
    }) as any;

    process.argv = ['node', 'aitrackdown', ...args];

    try {
      await main();
      return {
        stdout: consoleMock.logs.join('\n'),
        stderr: consoleMock.errors.join('\n'),
        success: exitCode === 0,
      };
    } catch (error) {
      // Extract exit code from process.exit error if available
      if (error instanceof Error && error.message.includes('Process exit:')) {
        const match = error.message.match(/Process exit: (\d+)/);
        if (match) {
          exitCode = parseInt(match[1], 10);
        }
      }
      return {
        stdout: consoleMock.logs.join('\n'),
        stderr: consoleMock.errors.join('\n'),
        success: exitCode === 0,
      };
    } finally {
      process.argv = originalArgv;
      process.exit = originalExit;
      consoleMock.restore();
    }
  }

  // Helper function to count files in directory
  function _countFilesInDirectory(dirPath: string): number {
    if (!fs.existsSync(dirPath)) return 0;
    return fs.readdirSync(dirPath).length;
  }

  describe('Project Creation and Switching', () => {
    it('should create multiple projects and switch between them', async () => {
      const testContext = getTestContext();

      // Create multiple projects
      const projectNames = ['frontend-app', 'backend-api', 'mobile-app', 'docs-site'];
      const projectPaths: string[] = [];

      // Change to test context directory first
      process.chdir(testContext.tempDir);

      for (const projectName of projectNames) {
        const result = await runCLICommand(['init', projectName]);
        if (!result.success) {
          console.log(`Failed to initialize project ${projectName}:`);
          console.log('stdout:', result.stdout);
          console.log('stderr:', result.stderr);
        }
        expect(result.success).toBe(true);

        const projectPath = path.join(testContext.tempDir, projectName);
        projectPaths.push(projectPath);

        // Verify the project was actually created
        if (!fs.existsSync(projectPath)) {
          throw new Error(
            `Project ${projectName} was not created at expected path: ${projectPath}`
          );
        }

        // Verify project structure was created
        TestAssertions.assertDirectoryExists(projectPath);
        TestAssertions.assertDirectoryExists(path.join(projectPath, 'tasks'));
        TestAssertions.assertDirectoryExists(path.join(projectPath, 'tasks', 'epics'));
        TestAssertions.assertDirectoryExists(path.join(projectPath, 'tasks', 'issues'));
        TestAssertions.assertDirectoryExists(path.join(projectPath, 'tasks', 'tasks'));
        TestAssertions.assertDirectoryExists(path.join(projectPath, 'tasks', 'prs'));
        TestAssertions.assertFileExists(path.join(projectPath, 'README.md'));
      }

      // Test project switching by working directory
      for (let i = 0; i < projectPaths.length; i++) {
        const projectPath = projectPaths[i];
        const projectName = projectNames[i];

        // Change to project directory
        process.chdir(projectPath);

        // Create unique content for each project
        const result = await runCLICommand([
          'epic',
          'create',
          `${projectName} Main Epic`,
          '--description',
          `Primary epic for ${projectName} project`,
          '--priority',
          'high',
        ]);
        if (!result.success) {
          console.log(`Failed to create epic for ${projectName}:`);
          console.log('stdout:', result.stdout);
          console.log('stderr:', result.stderr);
          console.log('Current directory:', process.cwd());
          console.log('Project path:', projectPath);
        }
        expect(result.success).toBe(true);

        // Verify epic was created in correct project
        const epicsDir = path.join(projectPath, 'tasks', 'epics');
        const epicFiles = fs.readdirSync(epicsDir);
        expect(epicFiles.length).toBeGreaterThanOrEqual(1);

        // Find the epic file we just created (not the example epic)
        const createdEpicFile = epicFiles.find((file) => file.includes('main-epic'));
        expect(createdEpicFile).toBeDefined();
        TestAssertions.assertFileContains(
          path.join(epicsDir, createdEpicFile!),
          `${projectName} Main Epic`
        );
      }

      // Verify each project has its own unique content
      for (let i = 0; i < projectPaths.length; i++) {
        const projectPath = projectPaths[i];

        // Ensure project directory exists before changing to it
        if (!fs.existsSync(projectPath)) {
          throw new Error(`Project directory does not exist for verification: ${projectPath}`);
        }
        process.chdir(projectPath);

        const result = await runCLICommand(['status']);
        if (!result.success) {
          console.log(`Status command failed for ${projectNames[i]}:`);
          console.log('stdout:', result.stdout);
          console.log('stderr:', result.stderr);
          console.log('Current directory:', process.cwd());
          console.log('Project path:', projectPath);
        }
        expect(result.success).toBe(true);
        expect(result.stdout).toContain(`${projectNames[i]} Main Epic`);

        // Verify it doesn't contain content from other projects
        for (let j = 0; j < projectNames.length; j++) {
          if (i !== j) {
            expect(result.stdout).not.toContain(`${projectNames[j]} Main Epic`);
          }
        }
      }
    });

    it('should handle project switching with --project-dir flag', async () => {
      const testContext = getTestContext();

      // Change to test directory
      process.chdir(testContext.tempDir);

      // Create both projects using CLI init for consistency
      let result = await runCLICommand(['init', 'frontend-project']);
      expect(result.success).toBe(true);
      const frontendPath = path.join(testContext.tempDir, 'frontend-project');

      result = await runCLICommand(['init', 'backend-project']);
      expect(result.success).toBe(true);
      const backendPath = path.join(testContext.tempDir, 'backend-project');

      // Create epics in both projects (since we're not using test data manager)
      process.chdir(frontendPath);
      result = await runCLICommand([
        'epic',
        'create',
        'Frontend Epic',
        '--description',
        'Frontend epic for testing',
      ]);
      expect(result.success).toBe(true);

      process.chdir(backendPath);
      result = await runCLICommand([
        'epic',
        'create',
        'Backend Epic',
        '--description',
        'Backend epic for testing',
      ]);
      expect(result.success).toBe(true);

      // Start from frontend project directory
      process.chdir(frontendPath);

      // Work on frontend project (current directory)
      let result = await runCLICommand([
        'issue',
        'create',
        'Frontend Specific Issue',
        '--description',
        'Issue specific to frontend project',
        '--epic',
        'EP-0001',
      ]);
      if (!result.success) {
        console.log('Frontend issue creation failed:');
        console.log('stdout:', result.stdout);
        console.log('stderr:', result.stderr);
      }
      expect(result.success).toBe(true);

      // Work on backend project using --project-dir flag
      result = await runCLICommand([
        'issue',
        'create',
        'Backend Specific Issue',
        '--description',
        'Issue specific to backend project',
        '--epic',
        'EP-0001',
        '--project-dir',
        backendPath,
      ]);
      expect(result.success).toBe(true);

      // Verify each project has its specific content
      result = await runCLICommand(['issue', 'list']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Frontend Specific Issue');
      expect(result.stdout).not.toContain('Backend Specific Issue');

      result = await runCLICommand(['issue', 'list', '--project-dir', backendPath]);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Backend Specific Issue');
      expect(result.stdout).not.toContain('Frontend Specific Issue');

      // Check status for both projects
      result = await runCLICommand(['status']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Frontend');

      result = await runCLICommand(['status', '--project-dir', backendPath]);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Backend');
    });

    it('should detect and validate project structure during operations', async () => {
      const testContext = getTestContext();

      // Create a directory that looks like a project but isn't properly initialized
      const fakeProjectPath = path.join(testContext.tempDir, 'fake-project');
      fs.mkdirSync(fakeProjectPath);
      fs.writeFileSync(path.join(fakeProjectPath, 'README.md'), '# Fake Project');

      process.chdir(fakeProjectPath);

      // Try to perform operations in non-initialized directory
      let result = await runCLICommand(['status']);

      if (!result.success) {
        expect(result.stderr).toMatch(/not initialized|not found|No.*project found/);
      }

      // Try to create epic in non-initialized directory
      result = await runCLICommand([
        'epic',
        'create',
        'Test Epic',
        '--description',
        'This should fail',
      ]);

      if (!result.success) {
        expect(result.stderr).toMatch(/not initialized|not found|No.*project found/);
      }

      // Initialize the directory properly
      result = await runCLICommand(['init']);
      expect(result.success).toBe(true);

      // Now operations should work
      result = await runCLICommand(['status']);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'epic',
        'create',
        'Test Epic',
        '--description',
        'This should work now',
      ]);
      expect(result.success).toBe(true);
    });
  });

  describe('Cross-Project Operations', () => {
    it('should handle cross-project status aggregation', async () => {
      const testContext = getTestContext();

      // Create multiple projects with different statuses
      const projects = [
        { name: 'active-project', hasActiveWork: true },
        { name: 'completed-project', hasActiveWork: false },
        { name: 'empty-project', hasActiveWork: false },
      ];

      const projectPaths: { [key: string]: string } = {};

      // Change to test directory first
      process.chdir(testContext.tempDir);

      for (const project of projects) {
        let result = await runCLICommand(['init', project.name]);
        expect(result.success).toBe(true);

        projectPaths[project.name] = path.join(testContext.tempDir, project.name);

        // Ensure project directory exists before changing to it
        if (!fs.existsSync(projectPaths[project.name])) {
          throw new Error(
            `Project ${project.name} was not created at expected path: ${projectPaths[project.name]}`
          );
        }
        process.chdir(projectPaths[project.name]);

        if (project.hasActiveWork) {
          // Create active work
          result = await runCLICommand([
            'epic',
            'create',
            `${project.name} Epic`,
            '--description',
            `Active epic for ${project.name}`,
            '--priority',
            'high',
          ]);
          expect(result.success).toBe(true);

          result = await runCLICommand([
            'issue',
            'create',
            `${project.name} Issue`,
            '--description',
            `Active issue for ${project.name}`,
            '--epic',
            'EP-0001',
          ]);
          expect(result.success).toBe(true);

          result = await runCLICommand([
            'task',
            'create',
            `${project.name} Task`,
            '--description',
            `Active task for ${project.name}`,
            '--issue',
            'ISS-0001',
          ]);
          if (!result.success) {
            console.log(`Task creation failed for ${project.name}:`);
            console.log('stdout:', result.stdout);
            console.log('stderr:', result.stderr);
          }
          expect(result.success).toBe(true);
        } else if (project.name === 'completed-project') {
          // Create and complete work
          result = await runCLICommand([
            'epic',
            'create',
            `${project.name} Epic`,
            '--description',
            `Completed epic for ${project.name}`,
          ]);
          expect(result.success).toBe(true);

          result = await runCLICommand(['epic', 'complete', 'EP-0001', '--actual-tokens', '500']);
          expect(result.success).toBe(true);
        }
      }

      // Test status for each project individually
      for (const project of projects) {
        const projectPath = projectPaths[project.name];
        if (!fs.existsSync(projectPath)) {
          throw new Error(`Project directory does not exist: ${projectPath}`);
        }
        process.chdir(projectPath);

        const result = await runCLICommand(['status']);
        expect(result.success).toBe(true);

        if (project.hasActiveWork) {
          expect(result.stdout).toContain('active' || result.stdout.includes('pending'));
        } else if (project.name === 'completed-project') {
          expect(result.stdout).toContain('completed');
        } else {
          expect(result.stdout).toContain('empty' || result.stdout.includes('No'));
        }
      }

      // Test cross-project status if supported
      result = await runCLICommand(['status', '--all-projects']);

      if (result.success) {
        // Should show status for all projects
        for (const project of projects) {
          expect(result.stdout).toContain(project.name);
        }
      } else {
        // If not supported, test using project-dir flag for each
        for (const project of projects) {
          result = await runCLICommand(['status', '--project-dir', projectPaths[project.name]]);
          expect(result.success).toBe(true);
        }
      }
    });

    it('should handle cross-project search and filtering', async () => {
      const testContext = getTestContext();

      // Create projects with searchable content
      const projects = ['search-project-1', 'search-project-2', 'search-project-3'];
      const projectPaths: string[] = [];

      for (let i = 0; i < projects.length; i++) {
        const projectName = projects[i];
        let result = await runCLICommand(['init', projectName]);
        expect(result.success).toBe(true);

        const projectPath = path.join(testContext.tempDir, projectName);
        projectPaths.push(projectPath);

        // Ensure directory exists before changing to it
        if (!fs.existsSync(projectPath)) {
          throw new Error(`Project directory does not exist: ${projectPath}`);
        }
        process.chdir(projectPath);

        // Create content with searchable terms
        result = await runCLICommand([
          'epic',
          'create',
          `Epic with keyword-${i}`,
          '--description',
          `This epic contains searchable content for project ${i}`,
          '--assignee',
          `developer-${i}`,
        ]);
        expect(result.success).toBe(true);

        result = await runCLICommand([
          'issue',
          'create',
          `Security Issue ${i}`,
          '--description',
          'This issue deals with security considerations',
          '--epic',
          'EP-0001',
          '--assignee',
          `security-team-${i}`,
        ]);
        expect(result.success).toBe(true);

        result = await runCLICommand([
          'issue',
          'create',
          `Performance Issue ${i}`,
          '--description',
          'This issue deals with performance optimization',
          '--epic',
          'EP-0001',
          '--assignee',
          `performance-team-${i}`,
        ]);
        expect(result.success).toBe(true);
      }

      // Test search within individual projects
      for (let i = 0; i < projectPaths.length; i++) {
        process.chdir(projectPaths[i]);

        // Search for security issues
        let result = await runCLICommand(['issue', 'search', 'security']);
        expect(result.success).toBe(true);
        expect(result.stdout).toContain(`Security Issue ${i}`);
        expect(result.stdout).not.toContain('Performance Issue');

        // Search for performance issues
        result = await runCLICommand(['issue', 'search', 'performance']);
        expect(result.success).toBe(true);
        expect(result.stdout).toContain(`Performance Issue ${i}`);
        expect(result.stdout).not.toContain('Security Issue');

        // Filter by assignee
        result = await runCLICommand(['issue', 'list', '--assignee', `security-team-${i}`]);
        expect(result.success).toBe(true);
        expect(result.stdout).toContain(`Security Issue ${i}`);
        expect(result.stdout).not.toContain('Performance Issue');
      }

      // Test cross-project search if supported
      result = await runCLICommand(['issue', 'search', 'security', '--all-projects']);

      if (result.success) {
        // Should find security issues across all projects
        for (let i = 0; i < projects.length; i++) {
          expect(result.stdout).toContain(`Security Issue ${i}`);
        }
      } else {
        // If not supported, verify each project individually
        for (let i = 0; i < projectPaths.length; i++) {
          result = await runCLICommand([
            'issue',
            'search',
            'security',
            '--project-dir',
            projectPaths[i],
          ]);
          expect(result.success).toBe(true);
          expect(result.stdout).toContain(`Security Issue ${i}`);
        }
      }
    });

    it('should handle project-specific configuration and templates', async () => {
      const testContext = getTestContext();

      // Create projects with different configurations
      const frontendPath = path.join(testContext.tempDir, 'frontend-config-test');
      const backendPath = path.join(testContext.tempDir, 'backend-config-test');

      // Initialize frontend project
      let result = await runCLICommand(['init', 'frontend-config-test']);
      expect(result.success).toBe(true);

      // Ensure frontend directory exists before changing to it
      if (!fs.existsSync(frontendPath)) {
        throw new Error(`Frontend project directory does not exist: ${frontendPath}`);
      }
      process.chdir(frontendPath);

      // Create frontend-specific templates
      const frontendTemplatesDir = path.join(frontendPath, 'tasks', 'templates');
      const frontendEpicTemplate = `---
title: "{{title}}"
description: "{{description}}"
status: planning
priority: medium
assignee: "{{assignee}}"
created_date: {{created_date}}
updated_date: {{updated_date}}
estimated_tokens: {{estimated_tokens}}
actual_tokens: 0
frontend_specific_field: true
ui_components: []
design_assets: []
---

# Frontend Epic: {{title}}

## UI Requirements
- [ ] Responsive design
- [ ] Accessibility compliance
- [ ] Cross-browser testing

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2
`;

      fs.writeFileSync(path.join(frontendTemplatesDir, 'epic-default.yaml'), frontendEpicTemplate);

      // Initialize backend project
      result = await runCLICommand(['init', 'backend-config-test']);
      expect(result.success).toBe(true);

      // Ensure backend directory exists before changing to it
      if (!fs.existsSync(backendPath)) {
        throw new Error(`Backend project directory does not exist: ${backendPath}`);
      }
      process.chdir(backendPath);

      // Create backend-specific templates
      const backendTemplatesDir = path.join(backendPath, 'tasks', 'templates');
      const backendEpicTemplate = `---
title: "{{title}}"
description: "{{description}}"
status: planning
priority: medium
assignee: "{{assignee}}"
created_date: {{created_date}}
updated_date: {{updated_date}}
estimated_tokens: {{estimated_tokens}}
actual_tokens: 0
backend_specific_field: true
api_endpoints: []
database_changes: []
---

# Backend Epic: {{title}}

## API Requirements
- [ ] RESTful endpoints
- [ ] Authentication
- [ ] Rate limiting

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2
`;

      fs.writeFileSync(path.join(backendTemplatesDir, 'epic-default.yaml'), backendEpicTemplate);

      // Create epics in each project and verify templates are used
      process.chdir(frontendPath);
      result = await runCLICommand([
        'epic',
        'create',
        'Frontend Epic',
        '--description',
        'Frontend epic description',
      ]);
      expect(result.success).toBe(true);

      const frontendEpicsDir = path.join(frontendPath, 'tasks', 'epics');
      const frontendEpicFiles = fs.readdirSync(frontendEpicsDir);
      const frontendEpicPath = path.join(frontendEpicsDir, frontendEpicFiles[0]);
      TestAssertions.assertFileContains(frontendEpicPath, 'frontend_specific_field: true');
      TestAssertions.assertFileContains(frontendEpicPath, 'UI Requirements');
      TestAssertions.assertFileContains(frontendEpicPath, 'Responsive design');

      process.chdir(backendPath);
      result = await runCLICommand([
        'epic',
        'create',
        'Backend Epic',
        '--description',
        'Backend epic description',
      ]);
      expect(result.success).toBe(true);

      const backendEpicsDir = path.join(backendPath, 'tasks', 'epics');
      const backendEpicFiles = fs.readdirSync(backendEpicsDir);
      const backendEpicPath = path.join(backendEpicsDir, backendEpicFiles[0]);
      TestAssertions.assertFileContains(backendEpicPath, 'backend_specific_field: true');
      TestAssertions.assertFileContains(backendEpicPath, 'API Requirements');
      TestAssertions.assertFileContains(backendEpicPath, 'RESTful endpoints');

      // Verify cross-contamination doesn't occur
      expect(fs.readFileSync(frontendEpicPath, 'utf-8')).not.toContain('backend_specific_field');
      expect(fs.readFileSync(backendEpicPath, 'utf-8')).not.toContain('frontend_specific_field');
    });
  });

  describe('Multi-Project Workflows', () => {
    it('should handle coordinated development across projects', async () => {
      const testContext = getTestContext();

      // Create microservices architecture simulation
      const services = ['auth-service', 'user-service', 'notification-service', 'gateway-service'];
      const servicePaths: { [key: string]: string } = {};

      // Change to test directory first
      process.chdir(testContext.tempDir);

      // Initialize all services
      for (const service of services) {
        const result = await runCLICommand(['init', service]);
        expect(result.success).toBe(true);

        servicePaths[service] = path.join(testContext.tempDir, service);

        // Verify service directory was created
        if (!fs.existsSync(servicePaths[service])) {
          throw new Error(
            `Service ${service} was not created at expected path: ${servicePaths[service]}`
          );
        }
      }

      // Create coordinated feature across services
      const featureName = 'User Profile Management';
      const featureEpics: { [key: string]: string } = {};

      for (const service of services) {
        const servicePath = servicePaths[service];
        if (!fs.existsSync(servicePath)) {
          throw new Error(`Service directory does not exist: ${servicePath}`);
        }
        process.chdir(servicePath);

        let result = await runCLICommand([
          'epic',
          'create',
          `${featureName} - ${service}`,
          '--description',
          `Implementation of ${featureName} in ${service}`,
          '--priority',
          'high',
          '--assignee',
          `${service.split('-')[0]}-team`,
        ]);
        expect(result.success).toBe(true);

        featureEpics[service] = 'EP-0001';

        // Create service-specific issues
        const serviceIssues = {
          'auth-service': ['JWT Token Management', 'Password Validation'],
          'user-service': ['User Profile CRUD', 'Profile Validation'],
          'notification-service': ['Profile Update Notifications', 'Email Templates'],
          'gateway-service': ['API Gateway Routing', 'Request Validation'],
        };

        for (const issueTitle of serviceIssues[service] || []) {
          result = await runCLICommand([
            'issue',
            'create',
            issueTitle,
            '--description',
            `${issueTitle} implementation for ${service}`,
            '--epic',
            'EP-0001',
            '--priority',
            'medium',
          ]);
          expect(result.success).toBe(true);
        }
      }

      // Simulate coordinated development
      // Complete work in dependency order: auth -> user -> notification -> gateway
      const completionOrder = [
        'auth-service',
        'user-service',
        'notification-service',
        'gateway-service',
      ];

      for (const service of completionOrder) {
        const servicePath = servicePaths[service];
        if (!fs.existsSync(servicePath)) {
          throw new Error(`Service directory does not exist for completion: ${servicePath}`);
        }
        process.chdir(servicePath);

        // Complete all issues in this service
        let result = await runCLICommand(['issue', 'list']);
        expect(result.success).toBe(true);

        const issuesDir = path.join(servicePaths[service], 'tasks', 'issues');
        const issueFiles = fs.readdirSync(issuesDir);

        for (const issueFile of issueFiles) {
          const issueId = issueFile.match(/^(ISS-\d+)/)?.[1];
          if (issueId) {
            result = await runCLICommand([
              'issue',
              'complete',
              issueId,
              '--actual-tokens',
              '300',
              '--comment',
              `Completed as part of coordinated ${featureName} feature`,
            ]);
            expect(result.success).toBe(true);
          }
        }

        // Complete epic
        result = await runCLICommand([
          'epic',
          'complete',
          'EP-0001',
          '--actual-tokens',
          '600',
          '--comment',
          `${service} portion of ${featureName} feature completed`,
        ]);
        expect(result.success).toBe(true);
      }

      // Verify all services completed their portions
      for (const service of services) {
        process.chdir(servicePaths[service]);

        let result = await runCLICommand(['status']);
        expect(result.success).toBe(true);
        expect(result.stdout).toContain('completed');

        result = await runCLICommand(['epic', 'show', 'EP-0001']);
        expect(result.success).toBe(true);
        expect(result.stdout).toContain('completed');
        expect(result.stdout).toContain(featureName);
      }
    });

    it('should handle shared dependencies between projects', async () => {
      const testContext = getTestContext();

      // Change to test directory first
      process.chdir(testContext.tempDir);

      // Create projects with shared dependencies
      const libraryPath = path.join(testContext.tempDir, 'shared-library');
      const app1Path = path.join(testContext.tempDir, 'consumer-app-1');
      const app2Path = path.join(testContext.tempDir, 'consumer-app-2');

      // Initialize shared library project
      let result = await runCLICommand(['init', 'shared-library']);
      expect(result.success).toBe(true);

      // Ensure library directory exists before changing to it
      if (!fs.existsSync(libraryPath)) {
        throw new Error(`Library project was not created at expected path: ${libraryPath}`);
      }
      process.chdir(libraryPath);

      // Create library epic and issues
      result = await runCLICommand([
        'epic',
        'create',
        'Shared Component Library',
        '--description',
        'Common components used by multiple applications',
      ]);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'issue',
        'create',
        'Button Component',
        '--description',
        'Reusable button component',
        '--epic',
        'EP-0001',
      ]);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'issue',
        'create',
        'Form Validation Library',
        '--description',
        'Common form validation utilities',
        '--epic',
        'EP-0001',
      ]);
      expect(result.success).toBe(true);

      // Initialize consumer applications
      for (const appPath of [app1Path, app2Path]) {
        const appName = path.basename(appPath);
        result = await runCLICommand(['init', appName]);
        expect(result.success).toBe(true);

        // Ensure app directory exists before changing to it
        if (!fs.existsSync(appPath)) {
          throw new Error(`App ${appName} was not created at expected path: ${appPath}`);
        }
        process.chdir(appPath);

        // Create app-specific epic that depends on library
        result = await runCLICommand([
          'epic',
          'create',
          `${appName} Features`,
          '--description',
          `Features specific to ${appName} that depend on shared library`,
        ]);
        expect(result.success).toBe(true);

        // Create issues that reference shared library components
        result = await runCLICommand([
          'issue',
          'create',
          'Login Form Implementation',
          '--description',
          'Implement login form using shared components (buttons, validation)',
          '--epic',
          'EP-0001',
          '--comment',
          'Depends on Button Component and Form Validation Library from shared-library',
        ]);
        expect(result.success).toBe(true);

        result = await runCLICommand([
          'issue',
          'create',
          'Settings Page',
          '--description',
          'Settings page using shared form components',
          '--epic',
          'EP-0001',
          '--comment',
          'Depends on Form Validation Library from shared-library',
        ]);
        expect(result.success).toBe(true);
      }

      // Complete shared library components first
      process.chdir(libraryPath);
      result = await runCLICommand([
        'issue',
        'complete',
        'ISS-0001',
        '--actual-tokens',
        '200',
        '--comment',
        'Button component completed and ready for consumption',
      ]);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'issue',
        'complete',
        'ISS-0002',
        '--actual-tokens',
        '300',
        '--comment',
        'Form validation library completed and ready for consumption',
      ]);
      expect(result.success).toBe(true);

      // Now consumer apps can proceed with their implementation
      for (const appPath of [app1Path, app2Path]) {
        process.chdir(appPath);

        result = await runCLICommand([
          'issue',
          'update',
          'ISS-0001',
          '--status',
          'in-progress',
          '--comment',
          'Starting implementation now that shared library components are ready',
        ]);
        expect(result.success).toBe(true);

        result = await runCLICommand([
          'issue',
          'complete',
          'ISS-0001',
          '--actual-tokens',
          '150',
          '--comment',
          'Login form completed using shared components',
        ]);
        expect(result.success).toBe(true);
      }

      // Verify dependency flow worked correctly
      process.chdir(libraryPath);
      result = await runCLICommand(['status']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('completed');

      for (const appPath of [app1Path, app2Path]) {
        process.chdir(appPath);
        result = await runCLICommand(['status']);
        expect(result.success).toBe(true);
        // Should show progress on consumer applications
      }
    });

    it('should handle project migration and restructuring', async () => {
      const testContext = getTestContext();

      // Change to test directory first
      process.chdir(testContext.tempDir);

      // Create initial monolithic project
      let result = await runCLICommand(['init', 'monolithic-app']);
      expect(result.success).toBe(true);

      const monolithPath = path.join(testContext.tempDir, 'monolithic-app');

      // Ensure monolith directory exists before changing to it
      if (!fs.existsSync(monolithPath)) {
        throw new Error(`Monolithic app was not created at expected path: ${monolithPath}`);
      }
      process.chdir(monolithPath);

      // Create content in monolithic structure
      result = await runCLICommand([
        'epic',
        'create',
        'User Management System',
        '--description',
        'Complete user management functionality',
      ]);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'epic',
        'create',
        'Order Processing System',
        '--description',
        'Complete order processing functionality',
      ]);
      expect(result.success).toBe(true);

      result = await runCLICommand([
        'epic',
        'create',
        'Payment Processing System',
        '--description',
        'Complete payment processing functionality',
      ]);
      expect(result.success).toBe(true);

      // Add issues to each epic
      const epics = ['EP-0001', 'EP-0002', 'EP-0003'];
      const epicNames = ['User Management', 'Order Processing', 'Payment Processing'];

      for (let i = 0; i < epics.length; i++) {
        result = await runCLICommand([
          'issue',
          'create',
          `${epicNames[i]} Core Feature`,
          '--description',
          `Core functionality for ${epicNames[i]}`,
          '--epic',
          epics[i],
        ]);
        expect(result.success).toBe(true);

        result = await runCLICommand([
          'issue',
          'create',
          `${epicNames[i]} API`,
          '--description',
          `API endpoints for ${epicNames[i]}`,
          '--epic',
          epics[i],
        ]);
        expect(result.success).toBe(true);
      }

      // Simulate migration to microservices
      const microservices = ['user-service', 'order-service', 'payment-service'];
      const servicePaths: string[] = [];

      for (let i = 0; i < microservices.length; i++) {
        const serviceName = microservices[i];
        result = await runCLICommand(['init', serviceName]);
        expect(result.success).toBe(true);

        const servicePath = path.join(testContext.tempDir, serviceName);
        servicePaths.push(servicePath);

        // Ensure service directory exists before changing to it
        if (!fs.existsSync(servicePath)) {
          throw new Error(
            `Service ${serviceName} was not created at expected path: ${servicePath}`
          );
        }
        process.chdir(servicePath);

        // Migrate epic to new service
        result = await runCLICommand([
          'epic',
          'create',
          `Migrated ${epicNames[i]} Service`,
          '--description',
          `${epicNames[i]} functionality migrated from monolith`,
          '--comment',
          `Migrated from monolithic-app ${epics[i]}`,
        ]);
        expect(result.success).toBe(true);

        // Migrate issues
        result = await runCLICommand([
          'issue',
          'create',
          `${epicNames[i]} Service Core`,
          '--description',
          `Core service functionality migrated from monolith`,
          '--epic',
          'EP-0001',
          '--comment',
          `Migrated from monolithic-app`,
        ]);
        expect(result.success).toBe(true);

        result = await runCLICommand([
          'issue',
          'create',
          `${epicNames[i]} Service API`,
          '--description',
          `Service API migrated from monolith`,
          '--epic',
          'EP-0001',
          '--comment',
          `Migrated from monolithic-app`,
        ]);
        expect(result.success).toBe(true);
      }

      // Mark original monolithic epics as deprecated/migrated
      process.chdir(monolithPath);
      for (let i = 0; i < epics.length; i++) {
        result = await runCLICommand([
          'epic',
          'update',
          epics[i],
          '--status',
          'deprecated',
          '--comment',
          `Functionality migrated to ${microservices[i]}`,
        ]);
        expect(result.success).toBe(true);
      }

      // Verify migration state
      process.chdir(monolithPath);
      result = await runCLICommand(['status']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('deprecated');

      for (const servicePath of servicePaths) {
        process.chdir(servicePath);
        result = await runCLICommand(['status']);
        expect(result.success).toBe(true);
        expect(result.stdout).toContain('active' || result.stdout.includes('planning'));
      }
    });
  });

  describe('Project Isolation and Data Integrity', () => {
    it('should maintain strict isolation between projects', async () => {
      const testContext = getTestContext();

      // Change to test directory first
      process.chdir(testContext.tempDir);

      // Create two projects with identical IDs but different content
      const project1Path = path.join(testContext.tempDir, 'isolation-test-1');
      const project2Path = path.join(testContext.tempDir, 'isolation-test-2');

      for (const projectPath of [project1Path, project2Path]) {
        const projectName = path.basename(projectPath);
        let result = await runCLICommand(['init', projectName]);
        expect(result.success).toBe(true);

        // Ensure project directory exists before changing to it
        if (!fs.existsSync(projectPath)) {
          throw new Error(
            `Project ${projectName} was not created at expected path: ${projectPath}`
          );
        }
        process.chdir(projectPath);

        // Create identical structures with different content
        result = await runCLICommand([
          'epic',
          'create',
          `${projectName} Epic`,
          '--description',
          `Epic specific to ${projectName}`,
        ]);
        expect(result.success).toBe(true);

        result = await runCLICommand([
          'issue',
          'create',
          `${projectName} Issue`,
          '--description',
          `Issue specific to ${projectName}`,
          '--epic',
          'EP-0001',
        ]);
        expect(result.success).toBe(true);

        result = await runCLICommand([
          'task',
          'create',
          `${projectName} Task`,
          '--description',
          `Task specific to ${projectName}`,
          '--issue',
          'ISS-0001',
        ]);
        expect(result.success).toBe(true);
      }

      // Verify each project only sees its own content
      process.chdir(project1Path);
      let result = await runCLICommand(['status']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('isolation-test-1');
      expect(result.stdout).not.toContain('isolation-test-2');

      result = await runCLICommand(['epic', 'show', 'EP-0001']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('isolation-test-1 Epic');
      expect(result.stdout).not.toContain('isolation-test-2');

      process.chdir(project2Path);
      result = await runCLICommand(['status']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('isolation-test-2');
      expect(result.stdout).not.toContain('isolation-test-1');

      result = await runCLICommand(['epic', 'show', 'EP-0001']);
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('isolation-test-2 Epic');
      expect(result.stdout).not.toContain('isolation-test-1');

      // Verify file system isolation
      const project1EpicsDir = path.join(project1Path, 'tasks', 'epics');
      const project2EpicsDir = path.join(project2Path, 'tasks', 'epics');

      const project1Files = fs.readdirSync(project1EpicsDir);
      const project2Files = fs.readdirSync(project2EpicsDir);

      expect(project1Files).toHaveLength(1);
      expect(project2Files).toHaveLength(1);

      const project1Content = fs.readFileSync(
        path.join(project1EpicsDir, project1Files[0]),
        'utf-8'
      );
      const project2Content = fs.readFileSync(
        path.join(project2EpicsDir, project2Files[0]),
        'utf-8'
      );

      expect(project1Content).toContain('isolation-test-1');
      expect(project1Content).not.toContain('isolation-test-2');
      expect(project2Content).toContain('isolation-test-2');
      expect(project2Content).not.toContain('isolation-test-1');
    });

    it('should handle concurrent operations across projects', async () => {
      const testContext = getTestContext();

      // Change to test directory first
      process.chdir(testContext.tempDir);

      // Create multiple projects for concurrent testing
      const projects = ['concurrent-1', 'concurrent-2', 'concurrent-3'];
      const projectPaths: string[] = [];

      for (const project of projects) {
        const result = await runCLICommand(['init', project]);
        expect(result.success).toBe(true);
        const projectPath = path.join(testContext.tempDir, project);
        projectPaths.push(projectPath);

        // Ensure project directory exists
        if (!fs.existsSync(projectPath)) {
          throw new Error(`Project ${project} was not created at expected path: ${projectPath}`);
        }
      }

      // Perform concurrent operations on different projects
      // Note: Avoid actual concurrency due to potential race conditions in file operations
      const concurrentOperations: Promise<{ stdout: string; stderr: string; success: boolean }>[] =
        [];

      for (let index = 0; index < projectPaths.length; index++) {
        const projectPath = projectPaths[index];
        const operation = runCLICommand([
          'epic',
          'create',
          `Concurrent Epic ${index}`,
          '--description',
          `Epic created concurrently in project ${index}`,
          '--project-dir',
          projectPath,
        ]);
        concurrentOperations.push(operation);
      }

      // Wait for all operations to complete
      const results = await Promise.all(concurrentOperations);

      // All operations should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
      }

      // Verify each project has its unique content
      for (let i = 0; i < projectPaths.length; i++) {
        const projectPath = projectPaths[i];
        process.chdir(projectPath);

        const result = await runCLICommand(['status']);
        if (!result.success) {
          console.log(`Status command failed for concurrent project ${i}:`);
          console.log('stdout:', result.stdout);
          console.log('stderr:', result.stderr);
          console.log('Project path:', projectPath);
          console.log('Current working dir:', process.cwd());
        }
        expect(result.success).toBe(true);
        expect(result.stdout).toContain(`Concurrent Epic ${i}`);

        // Verify it doesn't contain other projects' content
        for (let j = 0; j < projects.length; j++) {
          if (i !== j) {
            expect(result.stdout).not.toContain(`Concurrent Epic ${j}`);
          }
        }
      }

      // Perform more complex concurrent operations
      const complexOperations = projectPaths.map((projectPath, index) => {
        return Promise.all([
          runCLICommand([
            'issue',
            'create',
            `Concurrent Issue ${index}`,
            '--epic',
            'EP-0001',
            '--project-dir',
            projectPath,
          ]),
          runCLICommand([
            'task',
            'create',
            `Concurrent Task ${index}`,
            '--issue',
            'ISS-0001',
            '--project-dir',
            projectPath,
          ]),
        ]);
      });

      const complexResults = await Promise.all(complexOperations);

      // Verify all complex operations succeeded
      for (const resultPair of complexResults) {
        for (const result of resultPair) {
          expect(result.success).toBe(true);
        }
      }

      // Final verification of project integrity
      for (const projectPath of projectPaths) {
        process.chdir(projectPath);
        const result = await runCLICommand(['status']);
        expect(result.success).toBe(true);
      }
    });
  });
});
