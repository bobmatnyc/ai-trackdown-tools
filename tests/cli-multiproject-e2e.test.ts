/**
 * End-to-End Tests for CLI Command Integration with Multi-Project Support
 * Tests CLI commands in both single and multi-project modes
 */

import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('CLI Multi-Project E2E Tests', () => {
  let testRootPath: string;
  let originalCwd: string;
  let cliPath: string;

  beforeEach(() => {
    testRootPath = fs.mkdtempSync(path.join(tmpdir(), 'cli-multiproject-e2e-test-'));
    originalCwd = process.cwd();
    process.chdir(testRootPath);

    // Path to CLI (assuming built CLI exists)
    cliPath = path.join(__dirname, '../dist/cli.js');

    // Clear environment variables
    delete process.env.AITRACKDOWN_PROJECT_MODE;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testRootPath, { recursive: true, force: true });
  });

  function runCLI(args: string[]): { stdout: string; stderr: string; exitCode: number } {
    try {
      const result = execSync(`node ${cliPath} ${args.join(' ')}`, {
        encoding: 'utf8',
        cwd: testRootPath,
      });
      return { stdout: result, stderr: '', exitCode: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.status || 1,
      };
    }
  }

  function runCLIAsync(
    args: string[]
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      const child = spawn('node', [cliPath, ...args], {
        cwd: testRootPath,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code || 0 });
      });
    });
  }

  describe('single-project mode CLI commands', () => {
    beforeEach(() => {
      // Initialize single-project structure
      const configDir = path.join(testRootPath, '.ai-trackdown');
      fs.mkdirSync(configDir, { recursive: true });

      const config = {
        name: 'Single Project',
        version: '1.0.0',
        created_date: new Date().toISOString(),
      };

      fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config, null, 2));
    });

    it('should create epic in single-project mode', async () => {
      const result = runCLI([
        'epic',
        'create',
        '--title',
        'Test Epic',
        '--description',
        'Epic description',
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Epic created successfully');
      expect(result.stdout).toContain('EP-');

      // Verify epic file was created
      const tasksDir = path.join(testRootPath, 'tasks', 'epics');
      expect(fs.existsSync(tasksDir)).toBe(true);

      const epicFiles = fs.readdirSync(tasksDir).filter((f) => f.endsWith('.md'));
      expect(epicFiles.length).toBe(1);

      const epicContent = fs.readFileSync(path.join(tasksDir, epicFiles[0]), 'utf8');
      expect(epicContent).toContain('title: Test Epic');
      expect(epicContent).toContain('description: Epic description');
    });

    it('should create issue in single-project mode', async () => {
      // First create an epic
      const epicResult = runCLI([
        'epic',
        'create',
        '--title',
        'Parent Epic',
        '--description',
        'Epic for issues',
      ]);
      expect(epicResult.exitCode).toBe(0);

      // Extract epic ID from output
      const epicIdMatch = epicResult.stdout.match(/EP-\d+/);
      expect(epicIdMatch).toBeDefined();
      const epicId = epicIdMatch?.[0];

      // Create issue
      const issueResult = runCLI([
        'issue',
        'create',
        '--title',
        'Test Issue',
        '--description',
        'Issue description',
        '--epic',
        epicId,
      ]);

      expect(issueResult.exitCode).toBe(0);
      expect(issueResult.stdout).toContain('Issue created successfully');
      expect(issueResult.stdout).toContain('ISS-');

      // Verify issue file was created
      const issuesDir = path.join(testRootPath, 'tasks', 'issues');
      expect(fs.existsSync(issuesDir)).toBe(true);

      const issueFiles = fs.readdirSync(issuesDir).filter((f) => f.endsWith('.md'));
      expect(issueFiles.length).toBe(1);

      const issueContent = fs.readFileSync(path.join(issuesDir, issueFiles[0]), 'utf8');
      expect(issueContent).toContain('title: Test Issue');
      expect(issueContent).toContain('description: Issue description');
      expect(issueContent).toContain(`epic_id: ${epicId}`);
    });

    it('should list epics in single-project mode', async () => {
      // Create a few epics
      runCLI(['epic', 'create', '--title', 'Epic 1', '--description', 'First epic']);
      runCLI(['epic', 'create', '--title', 'Epic 2', '--description', 'Second epic']);

      const result = runCLI(['epic', 'list']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Epic 1');
      expect(result.stdout).toContain('Epic 2');
      expect(result.stdout).toContain('EP-');
    });

    it('should show status in single-project mode', async () => {
      // Create some items
      runCLI(['epic', 'create', '--title', 'Status Epic', '--description', 'Epic for status']);

      const result = runCLI(['status']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Status Epic');
      expect(result.stdout).toContain('Mode: SINGLE');
    });
  });

  describe('multi-project mode CLI commands', () => {
    beforeEach(() => {
      // Setup multi-project structure
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);

      // Create multiple projects
      const projects = ['frontend', 'backend', 'mobile'];
      projects.forEach((projectName) => {
        const projectPath = path.join(projectsDir, projectName);
        fs.mkdirSync(projectPath);

        const configDir = path.join(projectPath, '.ai-trackdown');
        fs.mkdirSync(configDir, { recursive: true });

        const config = {
          name: `${projectName} Project`,
          version: '1.0.0',
          created_date: new Date().toISOString(),
        };

        fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify(config, null, 2));
      });
    });

    it('should list projects in multi-project mode', async () => {
      const result = runCLI(['project', 'list']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('frontend');
      expect(result.stdout).toContain('backend');
      expect(result.stdout).toContain('mobile');
    });

    it('should create epic in specific project', async () => {
      const result = runCLI([
        'epic',
        'create',
        '--title',
        'Frontend Epic',
        '--description',
        'Epic for frontend',
        '--project',
        'frontend',
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Epic created successfully');
      expect(result.stdout).toContain('EP-');

      // Verify epic file was created in correct project
      const frontendEpicsDir = path.join(testRootPath, 'projects', 'frontend', 'tasks', 'epics');
      expect(fs.existsSync(frontendEpicsDir)).toBe(true);

      const epicFiles = fs.readdirSync(frontendEpicsDir).filter((f) => f.endsWith('.md'));
      expect(epicFiles.length).toBe(1);

      const epicContent = fs.readFileSync(path.join(frontendEpicsDir, epicFiles[0]), 'utf8');
      expect(epicContent).toContain('title: Frontend Epic');

      // Verify epic is NOT in other projects
      const backendEpicsDir = path.join(testRootPath, 'projects', 'backend', 'tasks', 'epics');
      if (fs.existsSync(backendEpicsDir)) {
        const backendEpicFiles = fs.readdirSync(backendEpicsDir).filter((f) => f.endsWith('.md'));
        expect(backendEpicFiles.length).toBe(0);
      }
    });

    it('should create issue in specific project', async () => {
      // First create an epic in backend project
      const epicResult = runCLI([
        'epic',
        'create',
        '--title',
        'Backend Epic',
        '--description',
        'Epic for backend',
        '--project',
        'backend',
      ]);
      expect(epicResult.exitCode).toBe(0);

      const epicIdMatch = epicResult.stdout.match(/EP-\d+/);
      expect(epicIdMatch).toBeDefined();
      const epicId = epicIdMatch?.[0];

      // Create issue in backend project
      const issueResult = runCLI([
        'issue',
        'create',
        '--title',
        'Backend Issue',
        '--description',
        'Issue for backend',
        '--epic',
        epicId,
        '--project',
        'backend',
      ]);

      expect(issueResult.exitCode).toBe(0);
      expect(issueResult.stdout).toContain('Issue created successfully');

      // Verify issue file was created in correct project
      const backendIssuesDir = path.join(testRootPath, 'projects', 'backend', 'tasks', 'issues');
      expect(fs.existsSync(backendIssuesDir)).toBe(true);

      const issueFiles = fs.readdirSync(backendIssuesDir).filter((f) => f.endsWith('.md'));
      expect(issueFiles.length).toBe(1);

      const issueContent = fs.readFileSync(path.join(backendIssuesDir, issueFiles[0]), 'utf8');
      expect(issueContent).toContain('title: Backend Issue');
      expect(issueContent).toContain(`epic_id: ${epicId}`);
    });

    it('should list epics from specific project', async () => {
      // Create epics in different projects
      runCLI([
        'epic',
        'create',
        '--title',
        'Frontend Epic 1',
        '--description',
        'FE epic 1',
        '--project',
        'frontend',
      ]);
      runCLI([
        'epic',
        'create',
        '--title',
        'Frontend Epic 2',
        '--description',
        'FE epic 2',
        '--project',
        'frontend',
      ]);
      runCLI([
        'epic',
        'create',
        '--title',
        'Backend Epic 1',
        '--description',
        'BE epic 1',
        '--project',
        'backend',
      ]);

      // List epics from frontend project
      const frontendResult = runCLI(['epic', 'list', '--project', 'frontend']);

      expect(frontendResult.exitCode).toBe(0);
      expect(frontendResult.stdout).toContain('Frontend Epic 1');
      expect(frontendResult.stdout).toContain('Frontend Epic 2');
      expect(frontendResult.stdout).not.toContain('Backend Epic 1');

      // List epics from backend project
      const backendResult = runCLI(['epic', 'list', '--project', 'backend']);

      expect(backendResult.exitCode).toBe(0);
      expect(backendResult.stdout).toContain('Backend Epic 1');
      expect(backendResult.stdout).not.toContain('Frontend Epic 1');
    });

    it('should show status for specific project', async () => {
      // Create items in different projects
      runCLI([
        'epic',
        'create',
        '--title',
        'Mobile Epic',
        '--description',
        'Mobile epic',
        '--project',
        'mobile',
      ]);

      const result = runCLI(['status', '--project', 'mobile']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Mobile Epic');
      expect(result.stdout).toContain('Mode: MULTI');
      expect(result.stdout).toContain('Current Project: mobile');
    });

    it('should switch projects', async () => {
      // Create epic in frontend
      runCLI([
        'epic',
        'create',
        '--title',
        'Frontend Epic',
        '--description',
        'FE epic',
        '--project',
        'frontend',
      ]);

      // Switch to backend and create epic
      const switchResult = runCLI(['project', 'switch', 'backend']);
      expect(switchResult.exitCode).toBe(0);

      const backendEpicResult = runCLI([
        'epic',
        'create',
        '--title',
        'Backend Epic',
        '--description',
        'BE epic',
      ]);
      expect(backendEpicResult.exitCode).toBe(0);

      // List epics should show backend epic
      const listResult = runCLI(['epic', 'list']);
      expect(listResult.stdout).toContain('Backend Epic');
      expect(listResult.stdout).not.toContain('Frontend Epic');
    });

    it('should handle project creation', async () => {
      const result = runCLI([
        'project',
        'create',
        'new-project',
        '--name',
        'New Project',
        '--description',
        'A new project',
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Project created successfully');
      expect(result.stdout).toContain('new-project');

      // Verify project directory was created
      const projectPath = path.join(testRootPath, 'projects', 'new-project');
      expect(fs.existsSync(projectPath)).toBe(true);

      // Verify config was created
      const configPath = path.join(projectPath, '.ai-trackdown', 'config.json');
      expect(fs.existsSync(configPath)).toBe(true);

      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(config.name).toBe('New Project');
      expect(config.description).toBe('A new project');
    });
  });

  describe('CLI error handling', () => {
    it('should handle missing project in multi-project mode', async () => {
      // Setup multi-project structure
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'existing-project'));

      const result = runCLI([
        'epic',
        'create',
        '--title',
        'Test Epic',
        '--description',
        'Test',
        '--project',
        'nonexistent',
      ]);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('not found');
    });

    it('should handle missing epic ID for issue creation', async () => {
      const result = runCLI(['issue', 'create', '--title', 'Test Issue', '--description', 'Test']);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Epic ID is required');
    });

    it('should handle invalid project name', async () => {
      const result = runCLI(['project', 'create', 'invalid/project/name']);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Invalid project name');
    });

    it('should handle corrupted project structure', async () => {
      // Setup multi-project structure
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'corrupted-project'));

      // Corrupt the project by creating invalid config
      const configDir = path.join(projectsDir, 'corrupted-project', '.ai-trackdown');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, 'config.json'), 'invalid json');

      const result = runCLI(['status', '--project', 'corrupted-project']);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('configuration') || expect(result.stderr).toContain('config');
    });
  });

  describe('CLI with git metadata integration', () => {
    beforeEach(() => {
      // Setup git repository
      execSync('git init', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.email "test@example.com"', { stdio: 'ignore', cwd: testRootPath });
      execSync('git config user.name "Test User"', { stdio: 'ignore', cwd: testRootPath });

      // Create project files
      fs.writeFileSync(
        path.join(testRootPath, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          dependencies: { react: '^18.0.0' },
        })
      );
      fs.writeFileSync(path.join(testRootPath, 'src/App.tsx'), 'export default function App() {}');

      execSync('git add .', { stdio: 'ignore', cwd: testRootPath });
      execSync('git commit -m "Initial commit"', { stdio: 'ignore', cwd: testRootPath });
      execSync('git remote add origin https://github.com/test/test-project.git', {
        stdio: 'ignore',
        cwd: testRootPath,
      });
    });

    it('should create project with git metadata', async () => {
      const result = runCLI(['project', 'create-with-git', 'git-project', '--extract-metadata']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Project created with git metadata');

      // Verify git metadata was extracted
      const projectPath = path.join(testRootPath, 'projects', 'git-project');
      if (fs.existsSync(projectPath)) {
        const configPath = path.join(projectPath, '.ai-trackdown', 'config.json');
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          expect(config.repository_url).toBe('https://github.com/test/test-project');
          expect(config.framework).toBe('React');
        }
      }
    });

    it('should show git metadata in status', async () => {
      const result = runCLI(['status', '--git-info']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('git');
      expect(result.stdout).toContain('React');
    });
  });

  describe('CLI performance and concurrency', () => {
    it('should handle concurrent operations', async () => {
      // Setup multi-project structure
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'project1'));
      fs.mkdirSync(path.join(projectsDir, 'project2'));

      // Create concurrent operations
      const operations = [
        runCLIAsync([
          'epic',
          'create',
          '--title',
          'Epic 1',
          '--description',
          'First epic',
          '--project',
          'project1',
        ]),
        runCLIAsync([
          'epic',
          'create',
          '--title',
          'Epic 2',
          '--description',
          'Second epic',
          '--project',
          'project2',
        ]),
        runCLIAsync(['project', 'list']),
        runCLIAsync(['status', '--project', 'project1']),
        runCLIAsync(['status', '--project', 'project2']),
      ];

      const results = await Promise.all(operations);

      // All operations should succeed
      results.forEach((result) => {
        expect(result.exitCode).toBe(0);
      });

      // Verify epics were created in correct projects
      const project1EpicsDir = path.join(projectsDir, 'project1', 'tasks', 'epics');
      const project2EpicsDir = path.join(projectsDir, 'project2', 'tasks', 'epics');

      if (fs.existsSync(project1EpicsDir)) {
        const project1Epics = fs.readdirSync(project1EpicsDir).filter((f) => f.endsWith('.md'));
        expect(project1Epics.length).toBe(1);
      }

      if (fs.existsSync(project2EpicsDir)) {
        const project2Epics = fs.readdirSync(project2EpicsDir).filter((f) => f.endsWith('.md'));
        expect(project2Epics.length).toBe(1);
      }
    });

    it('should handle rapid project switching', async () => {
      // Setup multi-project structure
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);

      const projects = ['rapid1', 'rapid2', 'rapid3'];
      projects.forEach((projectName) => {
        fs.mkdirSync(path.join(projectsDir, projectName));
      });

      // Rapidly switch between projects
      for (let i = 0; i < 3; i++) {
        for (const projectName of projects) {
          const result = runCLI(['project', 'switch', projectName]);
          expect(result.exitCode).toBe(0);

          const statusResult = runCLI(['status']);
          expect(statusResult.exitCode).toBe(0);
          expect(statusResult.stdout).toContain(`Current Project: ${projectName}`);
        }
      }
    });
  });

  describe('CLI backward compatibility', () => {
    it('should work with legacy single-project structure', async () => {
      // Create legacy structure
      const legacyDirs = ['trackdown', 'epics', 'issues', 'tasks'];
      legacyDirs.forEach((dir) => {
        fs.mkdirSync(path.join(testRootPath, dir), { recursive: true });
      });

      // Create legacy epic
      fs.writeFileSync(
        path.join(testRootPath, 'epics', 'EP-001-legacy-epic.md'),
        '---\nepic_id: EP-001\ntitle: Legacy Epic\n---\n# Legacy Epic'
      );

      const result = runCLI(['epic', 'list']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Legacy Epic');
    });

    it('should handle migration from single to multi-project', async () => {
      // Start with single-project structure
      const configDir = path.join(testRootPath, '.ai-trackdown');
      fs.mkdirSync(configDir, { recursive: true });

      const tasksDir = path.join(testRootPath, 'tasks');
      fs.mkdirSync(path.join(tasksDir, 'epics'), { recursive: true });

      // Create single-project epic
      runCLI(['epic', 'create', '--title', 'Single Epic', '--description', 'Single mode epic']);

      // Convert to multi-project by creating projects/ directory
      const projectsDir = path.join(testRootPath, 'projects');
      fs.mkdirSync(projectsDir);
      fs.mkdirSync(path.join(projectsDir, 'migrated-project'));

      // Should now work in multi-project mode
      const result = runCLI(['project', 'list']);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('migrated-project');
    });
  });
});
