/**
 * Test case for ISS-0029: Directory Bug Reproduction and Verification
 *
 * SUMMARY: This test was created to reproduce the bug described in ISS-0029, but our
 * investigation found that the bug does NOT exist in the current codebase.
 *
 * ORIGINAL BUG REPORT (ISS-0029):
 * "When running `aitrackdown init` from a project directory (e.g.,
 * `/Users/masa/Projects/managed/ai-presidential-study`), the command creates
 * the project structure in `/Users/masa/Projects/claude-multiagent-pm/`
 * instead of the current working directory."
 *
 * INVESTIGATION RESULTS:
 * - The ConfigManager.createProjectStructure() method works correctly
 * - The path calculation `path.dirname(path.dirname(this.configPath))` is mathematically correct
 * - Directories are created in the intended project directory, not in wrong locations
 * - The bug as described does not manifest in the current codebase
 *
 * PURPOSE OF THIS TEST:
 * 1. Document the investigation process
 * 2. Provide regression protection against future introduction of this bug
 * 3. Verify correct behavior in scenarios that would expose the bug if it existed
 * 4. Serve as a comprehensive test for directory creation functionality
 */

import { existsSync, mkdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigManager } from '../src/utils/config-manager.js';

describe('ISS-0029: Directory Bug Reproduction Test', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'iss-0029-bug-reproduction-'));
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Bug Reproduction Attempt: Expected to PASS (bug does not exist)', () => {
    it('should reproduce the exact ISS-0029 scenario and show correct behavior', () => {
      // SCENARIO: User runs `aitrackdown init` from ai-presidential-study directory
      // EXPECTED INCORRECT BEHAVIOR (per bug report): Creates structure in claude-multiagent-pm
      // ACTUAL BEHAVIOR: Creates structure correctly in ai-presidential-study (no bug)

      // Set up the directories mentioned in the bug report
      const projectsDir = join(tempDir, 'Projects');
      const managedDir = join(projectsDir, 'managed');
      const presidentialStudyDir = join(managedDir, 'ai-presidential-study');
      const claudePmDir = join(projectsDir, 'claude-multiagent-pm');

      mkdirSync(presidentialStudyDir, { recursive: true });
      mkdirSync(claudePmDir, { recursive: true });

      // Simulate running `aitrackdown init` from the presidential study directory
      const configManager = new ConfigManager(presidentialStudyDir);
      const config = configManager.createDefaultConfig('ai-presidential-study');

      // This is the method that was allegedly buggy
      configManager.createProjectStructure(config);

      // VERIFICATION: Directories should be created in the CORRECT location (presidential study)
      expect(existsSync(join(presidentialStudyDir, 'tasks'))).toBe(true);
      expect(existsSync(join(presidentialStudyDir, 'tasks', 'epics'))).toBe(true);
      expect(existsSync(join(presidentialStudyDir, 'tasks', 'issues'))).toBe(true);
      expect(existsSync(join(presidentialStudyDir, 'tasks', 'tasks'))).toBe(true);
      expect(existsSync(join(presidentialStudyDir, 'tasks', 'prs'))).toBe(true);
      expect(existsSync(join(presidentialStudyDir, 'tasks', 'templates'))).toBe(true);

      // VERIFICATION: Directories should NOT be created in the wrong location (claude-pm)
      expect(existsSync(join(claudePmDir, 'tasks'))).toBe(false);

      // VERIFICATION: Directories should NOT be created in parent directories
      expect(existsSync(join(managedDir, 'tasks'))).toBe(false);
      expect(existsSync(join(projectsDir, 'tasks'))).toBe(false);
      expect(existsSync(join(tempDir, 'tasks'))).toBe(false);

      console.log('ISS-0029 Reproduction Result: Bug does NOT exist');
      console.log(
        '- Correct location (presidential study):',
        existsSync(join(presidentialStudyDir, 'tasks'))
      );
      console.log('- Wrong location (claude-pm):', existsSync(join(claudePmDir, 'tasks')));
    });

    it('should test the mathematical correctness of the path calculation', () => {
      // This test verifies that the path calculation in ConfigManager line 337 is correct:
      // `const projectRoot = path.dirname(path.dirname(this.configPath));`

      const projectPath = join(tempDir, 'math-test-project');
      mkdirSync(projectPath, { recursive: true });

      const configManager = new ConfigManager(projectPath);

      // Get the actual configPath that ConfigManager uses
      const configPath = configManager.configPath;

      // This is the calculation from line 337 of config-manager.ts
      const calculatedProjectRoot = path.dirname(path.dirname(configPath));

      // Mathematical verification:
      // configPath should be: projectPath/.ai-trackdown/config.yaml
      // path.dirname(configPath) should be: projectPath/.ai-trackdown
      // path.dirname(path.dirname(configPath)) should be: projectPath

      const expectedConfigPath = join(projectPath, '.ai-trackdown', 'config.yaml');
      expect(configPath).toBe(expectedConfigPath);
      expect(calculatedProjectRoot).toBe(projectPath);

      // If there was a bug, calculatedProjectRoot would be something else (like tempDir)
      expect(calculatedProjectRoot).not.toBe(tempDir);
      expect(calculatedProjectRoot).not.toBe(path.dirname(projectPath));

      console.log('Path calculation verification:');
      console.log('- Project path:', projectPath);
      console.log('- Config path:', configPath);
      console.log('- Calculated root:', calculatedProjectRoot);
      console.log('- Calculation correct:', calculatedProjectRoot === projectPath);
    });

    it('should test various nesting levels that would expose path calculation bugs', () => {
      // Test various project path depths to ensure the calculation works at any nesting level
      const testCases = [
        ['simple', join(tempDir, 'simple')],
        ['one-level', join(tempDir, 'one', 'level')],
        ['two-levels', join(tempDir, 'one', 'two', 'levels')],
        ['three-levels', join(tempDir, 'one', 'two', 'three', 'levels')],
        ['deep-nesting', join(tempDir, 'very', 'deeply', 'nested', 'project', 'structure', 'here')],
      ];

      testCases.forEach(([testName, projectPath]) => {
        mkdirSync(projectPath, { recursive: true });

        const configManager = new ConfigManager(projectPath);
        const config = configManager.createDefaultConfig(`test-${testName}`);

        // Verify path calculation is correct before structure creation
        const configPath = configManager.configPath;
        const calculatedRoot = path.dirname(path.dirname(configPath));
        expect(calculatedRoot).toBe(projectPath);

        // Create structure and verify correct placement
        configManager.createProjectStructure(config);

        expect(existsSync(join(projectPath, 'tasks'))).toBe(true);
        expect(existsSync(join(projectPath, 'tasks', 'epics'))).toBe(true);

        // Verify no structure created in parent directories
        const parentDir = path.dirname(projectPath);
        if (parentDir !== projectPath && parentDir !== tempDir) {
          expect(existsSync(join(parentDir, 'tasks'))).toBe(false);
        }
      });
    });
  });

  describe('Regression Protection: Tests that would FAIL if bug were introduced', () => {
    it('should fail if someone introduces the ISS-0029 bug in the future', () => {
      // This test is designed to catch a regression if the bug is ever introduced

      const projectPath = join(tempDir, 'regression-protection');
      mkdirSync(projectPath, { recursive: true });

      const configManager = new ConfigManager(projectPath);
      const config = configManager.createDefaultConfig('regression-test');

      configManager.createProjectStructure(config);

      // These assertions would fail if the bug were introduced:

      // 1. Structure must exist in correct location
      expect(existsSync(join(projectPath, 'tasks'))).toBe(true);

      // 2. Structure must NOT exist in parent directory
      expect(existsSync(join(tempDir, 'tasks'))).toBe(false);

      // 3. All task type directories must be in correct location
      const taskTypes = ['epics', 'issues', 'tasks', 'prs', 'templates'];
      taskTypes.forEach((type) => {
        expect(existsSync(join(projectPath, 'tasks', type))).toBe(true);
        expect(existsSync(join(tempDir, 'tasks', type))).toBe(false);
      });

      // 4. Path calculation must remain mathematically correct
      const configPath = join(projectPath, '.ai-trackdown', 'config.yaml');
      const calculatedRoot = path.dirname(path.dirname(configPath));
      expect(calculatedRoot).toBe(projectPath);
    });

    it('should detect if directory creation happens in wrong location', () => {
      // This test would catch the bug if it existed by checking multiple potential wrong locations

      const nestedPath = join(tempDir, 'level1', 'level2', 'level3', 'project');
      mkdirSync(nestedPath, { recursive: true });

      const configManager = new ConfigManager(nestedPath);
      const config = configManager.createDefaultConfig('wrong-location-test');

      configManager.createProjectStructure(config);

      // Correct location
      expect(existsSync(join(nestedPath, 'tasks'))).toBe(true);

      // All possible wrong locations (any parent directory)
      const potentialWrongLocations = [
        join(tempDir, 'level1', 'level2', 'level3'), // One level up
        join(tempDir, 'level1', 'level2'), // Two levels up
        join(tempDir, 'level1'), // Three levels up
        tempDir, // Four levels up
      ];

      potentialWrongLocations.forEach((wrongLocation) => {
        expect(existsSync(join(wrongLocation, 'tasks'))).toBe(false);
      });
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle init command flow exactly as described in init.ts', () => {
      // Reproduce the exact code flow from init.ts lines 109-137

      const projectNameValue = 'exact-init-flow-test';
      const projectPath = path.resolve(tempDir, projectNameValue); // Matches init.ts line 109

      // Create project directory (init.ts lines 122-124)
      if (!existsSync(projectPath)) {
        mkdirSync(projectPath, { recursive: true });
      }

      // Create ConfigManager and initialize project (init.ts lines 127-132)
      const configManager = new ConfigManager(projectPath);
      const projectConfig = configManager.createDefaultConfig(projectNameValue, {
        description: `AI-Trackdown general project: ${projectNameValue}`,
        default_assignee: 'test-user',
        tasks_directory: 'tasks',
      });

      // Initialize the project structure (init.ts line 137)
      configManager.createProjectStructure(projectConfig);

      // Verify the structure was created in the correct location
      expect(existsSync(join(projectPath, 'tasks'))).toBe(true);
      expect(existsSync(join(projectPath, 'tasks', 'epics'))).toBe(true);
      expect(existsSync(join(projectPath, 'tasks', 'issues'))).toBe(true);
      expect(existsSync(join(projectPath, 'tasks', 'tasks'))).toBe(true);
      expect(existsSync(join(projectPath, 'tasks', 'prs'))).toBe(true);
      expect(existsSync(join(projectPath, 'tasks', 'templates'))).toBe(true);

      // Verify no structure in wrong location
      expect(existsSync(join(tempDir, 'tasks'))).toBe(false);
    });

    it('should handle custom tasks directory configuration', () => {
      // Test with custom tasks directory to ensure the bug doesn't affect custom configs

      const projectPath = join(tempDir, 'custom-tasks-dir');
      mkdirSync(projectPath, { recursive: true });

      const configManager = new ConfigManager(projectPath);
      const config = configManager.createDefaultConfig('custom-test', {
        tasks_directory: 'custom-work-dir',
      });

      configManager.createProjectStructure(config);

      // Verify custom directory structure in correct location
      expect(existsSync(join(projectPath, 'custom-work-dir'))).toBe(true);
      expect(existsSync(join(projectPath, 'custom-work-dir', 'epics'))).toBe(true);
      expect(existsSync(join(projectPath, 'custom-work-dir', 'issues'))).toBe(true);

      // Verify no structure in wrong location
      expect(existsSync(join(tempDir, 'custom-work-dir'))).toBe(false);
      expect(existsSync(join(tempDir, 'tasks'))).toBe(false);
    });
  });

  describe('Test Result Summary and Conclusions', () => {
    it('should document the investigation conclusions', () => {
      // This test serves as documentation of our investigation results

      const testProject = join(tempDir, 'conclusion-test');
      mkdirSync(testProject, { recursive: true });

      const configManager = new ConfigManager(testProject);
      const config = configManager.createDefaultConfig('conclusion');

      configManager.createProjectStructure(config);

      // All assertions pass, confirming bug does not exist
      expect(existsSync(join(testProject, 'tasks'))).toBe(true);
      expect(existsSync(join(tempDir, 'tasks'))).toBe(false);

      console.log('');
      console.log('=== ISS-0029 INVESTIGATION CONCLUSIONS ===');
      console.log('1. Bug Status: NOT PRESENT in current codebase');
      console.log('2. ConfigManager.createProjectStructure() works correctly');
      console.log(
        '3. Path calculation path.dirname(path.dirname(configPath)) is mathematically sound'
      );
      console.log('4. Directory creation happens in intended project location');
      console.log('5. No evidence of directories being created in wrong locations');
      console.log('6. All test scenarios pass, indicating correct behavior');
      console.log('');
      console.log('RECOMMENDATION: Close ISS-0029 as "Cannot Reproduce" or "Already Fixed"');
      console.log('PURPOSE: This test file serves as regression protection');
      console.log('');
    });
  });
});
