# AI-Trackdown CLI Testing Guide

## Overview

This guide provides comprehensive documentation for the AI-Trackdown CLI test suite, including structure, best practices, and maintenance procedures.

## Test Suite Structure

### 1. Test Framework Configuration

**Framework**: Vitest with TypeScript support
**Coverage Provider**: @vitest/coverage-v8
**Configuration**: `vitest.config.ts`

#### Key Configuration Settings
- **Coverage Thresholds**: 90% minimum for branches, functions, lines, and statements
- **Test Environment**: Node.js
- **Test Timeout**: 10 seconds (configurable per test)
- **Mock Support**: Full ESM mock support with Vitest

### 2. Directory Structure

```
tests/
├── commands/               # CLI command-specific tests
│   ├── epic.test.ts       # Epic command tests
│   ├── issue.test.ts      # Issue command tests
│   ├── task.test.ts       # Task command tests
│   ├── pr.test.ts         # Pull request command tests
│   └── status-and-init.test.ts # Status and init command tests
├── integration/           # End-to-end integration tests
│   └── end-to-end-workflows.test.ts # Complete workflow tests
├── utils/                 # Test utilities and helpers
│   └── test-helpers.ts    # Shared test utilities
├── cli-argument-validation.test.ts # CLI argument parsing tests
├── coverage-validation.test.ts     # Test coverage validation
└── unit-test-suite.test.ts        # Test framework validation
```

### 3. Test Categories

#### Unit Tests (`tests/commands/`)
- **Purpose**: Test individual CLI commands in isolation
- **Coverage**: All major CLI commands (epic, issue, task, pr, status, init)
- **Scope**: Command creation, listing, updating, completion, error handling

#### Integration Tests (`tests/integration/`)
- **Purpose**: Test complete workflows and command interactions
- **Coverage**: End-to-end scenarios, multi-project workflows, error recovery
- **Scope**: Real-world usage patterns and complex scenarios

#### Validation Tests
- **Purpose**: Ensure test suite quality and coverage requirements
- **Coverage**: Test file existence, structure validation, coverage metrics
- **Scope**: Meta-testing to ensure comprehensive test coverage

## Test Utilities and Helpers

### Core Test Helpers (`tests/utils/test-helpers.ts`)

#### `setupTestEnvironment()`
Creates isolated test environment with cleanup:
```typescript
const getTestContext = setupTestEnvironment();
// Automatically handles beforeEach/afterEach setup
```

#### `createMockProject(basePath, projectName?)`
Creates complete mock project structure:
```typescript
createMockProject(testContext.tempDir);
// Creates tasks/, epics/, issues/, tasks/, prs/ directories
// Includes sample files and templates
```

#### `TestAssertions`
Static class for common test assertions:
```typescript
TestAssertions.assertFileExists(filePath);
TestAssertions.assertFileContains(filePath, content);
TestAssertions.assertValidYamlFrontmatter(filePath);
TestAssertions.assertDirectoryExists(dirPath);
```

#### `CLITestUtils`
Utilities for CLI command testing:
```typescript
const consoleMock = CLITestUtils.mockConsole();
// Mock console.log, console.error, console.warn
// Returns { logs, errors, warns, restore }

await CLITestUtils.runCommand(command, args, options);
// Execute CLI commands in test environment
```

#### `ErrorTestUtils`
Create specific error scenarios:
```typescript
ErrorTestUtils.createFileSystemError('EACCES', '/path');
ErrorTestUtils.createNetworkError('Connection refused');
ErrorTestUtils.createYamlParseError(line, column);
```

### Mock Configuration

#### External Dependencies
All external dependencies are mocked for isolation:

```typescript
// Standard mocks in all command tests
vi.mock('ora');           // Loading spinners
vi.mock('chalk');         // Terminal colors
vi.mock('inquirer');      // Interactive prompts
vi.mock('figlet');        // ASCII art
vi.mock('boxen');         // Terminal boxes
```

#### GitHub Integration
PR command tests include GitHub client mocking:
```typescript
vi.mock('../../src/utils/github-client.js', () => ({
  GitHubClient: {
    getInstance: vi.fn(() => ({
      createPullRequest: vi.fn().mockResolvedValue(mockResponse),
      // ... other GitHub operations
    }))
  }
}));
```

## Test Coverage Requirements

### Coverage Thresholds
- **Branches**: 90% minimum
- **Functions**: 90% minimum  
- **Lines**: 90% minimum
- **Statements**: 90% minimum

### Coverage Areas

#### 1. CLI Commands (Required for each command)
- ✅ Create operations with all option combinations
- ✅ List operations with filtering and sorting
- ✅ Show operations with detailed display
- ✅ Update operations with partial and complete updates
- ✅ Complete/finish operations with success scenarios
- ✅ Delete operations where applicable

#### 2. Error Handling (Required for each command)
- ✅ File system errors (ENOENT, EACCES, ENOSPC)
- ✅ Malformed YAML frontmatter
- ✅ Invalid command arguments
- ✅ Missing required fields
- ✅ Network connectivity issues (for GitHub features)
- ✅ Concurrent file access scenarios

#### 3. Cross-Project Functionality
- ✅ --project-dir option handling
- ✅ Multi-project scenario testing
- ✅ Path resolution across projects
- ✅ Invalid project directory handling

#### 4. Recently Added Features
- ✅ Flexible epic creation (auto-create missing epics)
- ✅ Standalone issue creation (without required epics)
- ✅ Graceful error handling and helpful error messages
- ✅ YAML parsing improvements
- ✅ Enhanced argument validation

## Running Tests

### Basic Test Execution
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test tests/commands/epic.test.ts

# Run tests in watch mode
npm run test:ui
```

### Test Filtering
```bash
# Run only unit tests
npm test tests/commands/

# Run only integration tests  
npm test tests/integration/

# Run tests matching pattern
npm test -- --grep "Epic Command"

# Run with verbose output
npm test -- --reporter=verbose
```

### Coverage Analysis
```bash
# Generate coverage report
npm run test:coverage

# View coverage in browser
open coverage/index.html

# Coverage summary
npm run test:coverage -- --reporter=text-summary
```

## Writing New Tests

### 1. Command Test Template

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { create[Command]Command } from '../../src/commands/[command].js';
import { setupTestEnvironment, createMockProject, TestAssertions, CLITestUtils } from '../utils/test-helpers.js';

// Mock external dependencies
vi.mock('ora', () => ({ /* ... */ }));
vi.mock('chalk', () => ({ /* ... */ }));
vi.mock('inquirer', () => ({ /* ... */ }));

describe('[Command] Command Tests', () => {
  const getTestContext = setupTestEnvironment();

  describe('[Command] Create Command', () => {
    it('should create new [item] with required fields', async () => {
      const testContext = getTestContext();
      createMockProject(testContext.tempDir);
      
      const program = new Command();
      const [command]Command = create[Command]Command();
      program.addCommand([command]Command);

      const consoleMock = CLITestUtils.mockConsole();

      try {
        await program.parseAsync(['node', 'test', '[command]', 'create', 'Test [Item]'], { from: 'user' });
        
        // Verify [item] was created
        // Add assertions here
      } finally {
        consoleMock.restore();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing [items] directory', async () => {
      // Test error scenarios
    });
  });
});
```

### 2. Integration Test Template

```typescript
describe('[Feature] Workflow Integration', () => {
  const getTestContext = setupTestEnvironment();

  async function runCLICommand(args: string[]): Promise<{ stdout: string; stderr: string; success: boolean }> {
    // Helper function implementation
  }

  it('should handle complete [feature] workflow', async () => {
    const testContext = getTestContext();
    
    // Step 1: Setup
    let result = await runCLICommand(['init', 'test-project']);
    expect(result.success).toBe(true);
    
    // Step 2: Create items
    result = await runCLICommand(['epic', 'create', 'Test Epic']);
    expect(result.success).toBe(true);
    
    // Step 3: Verify results
    TestAssertions.assertFileExists(expectedPath);
  });
});
```

### 3. Best Practices

#### Test Naming
- Use descriptive test names that explain the behavior being tested
- Group related tests in `describe` blocks
- Use consistent naming patterns across test files

#### Test Structure
- Follow AAA pattern: Arrange, Act, Assert
- Set up test context in `beforeEach` when needed
- Clean up resources in `afterEach` or use test helpers
- Mock external dependencies consistently

#### Assertions
- Use specific assertions that clearly indicate expected behavior
- Include error messages in assertions for clarity
- Test both success and failure scenarios
- Verify file contents, not just existence

#### Error Testing
- Test all major error conditions
- Verify error messages are helpful and actionable
- Ensure graceful degradation in error scenarios
- Test recovery mechanisms where applicable

## Maintenance Procedures

### 1. Regular Test Maintenance

#### Weekly Tasks
- [ ] Run full test suite with coverage
- [ ] Review coverage reports for gaps
- [ ] Check for flaky or slow tests
- [ ] Update mocks for external dependency changes

#### Monthly Tasks
- [ ] Review test performance and optimize slow tests
- [ ] Update test documentation for new features
- [ ] Clean up obsolete tests
- [ ] Validate test utility functions

#### Before Releases
- [ ] Ensure all tests pass on CI/CD
- [ ] Verify coverage thresholds are met
- [ ] Run performance benchmarks
- [ ] Test on multiple Node.js versions

### 2. Adding Tests for New Features

#### Checklist for New Command Tests
- [ ] Create command test file following template
- [ ] Test all command operations (create, list, show, update, etc.)
- [ ] Test error scenarios and edge cases
- [ ] Test argument validation and parsing
- [ ] Test interactive prompts and options
- [ ] Add integration test scenarios
- [ ] Update test documentation

#### Checklist for Bug Fix Tests
- [ ] Create test that reproduces the bug
- [ ] Verify test fails before fix
- [ ] Implement fix
- [ ] Verify test passes after fix
- [ ] Add regression test to prevent recurrence

### 3. Performance Considerations

#### Test Performance Guidelines
- Keep individual tests under 1 second when possible
- Use mocks to avoid expensive operations
- Clean up resources properly to prevent memory leaks
- Use parallel test execution for independent tests

#### Monitoring Test Performance
```bash
# Run tests with timing information
npm test -- --reporter=verbose

# Profile slow tests
npm test -- --reporter=verbose --logHeapUsage

# Run specific slow tests in isolation
npm test tests/integration/ -- --timeout=30000
```

## Troubleshooting

### Common Issues

#### Test Timeouts
- Increase timeout for integration tests
- Check for hung processes or infinite loops
- Verify proper cleanup in test teardown

#### Mock Issues
- Ensure mocks are restored between tests
- Check for ESM vs CommonJS mock conflicts
- Verify mock implementations match real APIs

#### File System Issues
- Ensure proper cleanup of test directories
- Check permissions on temporary files
- Verify path resolution across platforms

#### Coverage Issues
- Identify uncovered code paths with coverage reports
- Add tests for edge cases and error scenarios
- Ensure all branches and functions are tested

### Debugging Tests

#### Debug Individual Tests
```bash
# Run single test with debug output
NODE_OPTIONS="--inspect-brk" npm test tests/commands/epic.test.ts

# Run with verbose logging
DEBUG=* npm test tests/commands/epic.test.ts
```

#### Debug Coverage Issues
```bash
# Generate detailed coverage report
npm run test:coverage -- --reporter=lcov
open coverage/lcov-report/index.html
```

## Continuous Integration

### CI Configuration Requirements
- Node.js versions: 16.x, 18.x, 20.x
- Operating systems: Ubuntu, macOS, Windows
- Test execution: All tests must pass
- Coverage: Must meet 90% threshold
- Performance: Tests should complete within 10 minutes

### Pre-commit Hooks
- Run linting and formatting
- Execute unit tests (not integration tests)
- Validate test file structure
- Check coverage on changed files

## Conclusion

This testing guide provides the foundation for maintaining high-quality, comprehensive test coverage for the AI-Trackdown CLI. Regular maintenance, following best practices, and continuous improvement ensure the test suite remains effective and valuable for development and quality assurance.

For questions or suggestions about the test suite, please refer to the project's issue tracker or contribute improvements through pull requests.