# E2E Integration Test Suite

This directory contains a comprehensive end-to-end integration test suite for the AI Trackdown Tools ticketing system. The test suite provides comprehensive coverage of all ticketing workflows, relationship management, and multi-project scenarios.

## Test Architecture

### Test Structure

```
tests/e2e-integration/
├── index.test.ts                    # Main entry point and test module loader
├── test-data-manager.ts             # Comprehensive test data management utilities
├── ticket-lifecycle.test.ts         # Complete ticket lifecycle tests
├── relationship-management.test.ts  # Cross-type relationship management tests
├── comment-system.test.ts          # Comment system integration tests
├── cleanup-deletion.test.ts        # Cleanup and deletion verification tests
├── multi-project.test.ts           # Multi-project integration scenarios
├── test-suite-runner.test.ts       # Test isolation and performance testing
└── README.md                       # This documentation file
```

### Test Categories

#### 1. Ticket Lifecycle Tests (`ticket-lifecycle.test.ts`)
- **Epic Lifecycle**: Complete workflow from creation to completion
- **Issue Lifecycle**: Full issue management including assignment, completion, reopening, and closing
- **Task Lifecycle**: Task creation, updates, completion, and time tracking
- **PR Lifecycle**: Pull request creation, review workflow, approval, and merging
- **Cross-Type Workflows**: Complete workflows spanning all ticket types
- **Error Handling**: Graceful handling of errors during lifecycle operations

#### 2. Relationship Management Tests (`relationship-management.test.ts`)
- **Epic-Issue Relationships**: Parent-child relationships and progress tracking
- **Issue-Task Relationships**: Task assignment and completion tracking
- **Issue-PR Relationships**: Code delivery through pull requests
- **Complex Multi-Level Relationships**: Epic→Issue→Task→PR chains
- **Orphaned Reference Detection**: Cleanup of broken relationships
- **Relationship Integrity**: Maintaining consistency during operations

#### 3. Comment System Tests (`comment-system.test.ts`)
- **Lifecycle Comments**: Comments during creation, updates, and completion
- **Cross-Type Integration**: Comments across related ticket types
- **Author Tracking**: Comment attribution and timestamp management
- **Special Characters**: Unicode, emojis, and special character handling
- **Concurrent Comments**: Multiple users adding comments simultaneously

#### 4. Cleanup and Deletion Tests (`cleanup-deletion.test.ts`)
- **Individual Deletions**: Safe deletion of epics, issues, tasks, and PRs
- **Cascade Deletions**: Handling related item cleanup
- **Orphaned Reference Cleanup**: Detection and resolution of broken references
- **Batch Operations**: Bulk deletion with filters
- **Data Integrity**: Maintaining consistency during cleanup operations

#### 5. Multi-Project Tests (`multi-project.test.ts`)
- **Project Creation**: Multiple project initialization and setup
- **Project Switching**: Working across different projects
- **Cross-Project Operations**: Managing related work across projects
- **Project Isolation**: Ensuring complete separation between projects
- **Coordinated Development**: Multi-service/microservice workflows

#### 6. Test Suite Management (`test-suite-runner.test.ts`)
- **Test Isolation**: Complete environment separation between tests
- **Resource Management**: Memory usage and cleanup verification
- **Performance Testing**: Large dataset handling and operation timing
- **Error Recovery**: Recovery from various failure conditions
- **Concurrent Execution**: Safe parallel test execution

## Test Data Management

### TestDataManager Class

The `TestDataManager` class provides comprehensive utilities for creating and managing test data:

```typescript
import { TestDataManager } from './test-data-manager.js';

const testDataManager = new TestDataManager();

// Create comprehensive test data
const projectData = testDataManager.createComprehensiveTestData();

// Create minimal test data
const minimalData = testDataManager.createMinimalTestData();

// Create multi-project test data
const multiProjectData = testDataManager.createMultiProjectTestData();

// Physically create test project
const projectPath = await testDataManager.createTestProject(projectData);

// Cleanup
testDataManager.cleanup();
```

### Test Data Types

#### Comprehensive Test Data
- 3 epics with different priorities and assignees
- 6 issues distributed across epics
- 13 tasks assigned to various issues
- 4 pull requests with different statuses
- Comments across all ticket types

#### Minimal Test Data
- 1 epic, 1 issue, 1 task, 1 PR
- Basic relationships established
- Minimal comment set

#### Multi-Project Test Data
- Frontend and backend project structures
- Cross-project dependencies
- Service-specific ticket types

## Running the Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Ensure Vitest is configured
npm run test --version
```

### Running E2E Tests

```bash
# Run all E2E integration tests
npm run test tests/e2e-integration/

# Run specific test file
npm run test tests/e2e-integration/ticket-lifecycle.test.ts

# Run with verbose output
npm run test tests/e2e-integration/ --reporter=verbose

# Run with coverage
npm run test tests/e2e-integration/ --coverage
```

### Test Configuration

The tests use the following configuration:

```typescript
// vitest.config.ts
export default {
  test: {
    testTimeout: 30000,      // 30 second timeout for E2E tests
    pool: 'threads',         // Use thread pool for isolation
    poolOptions: {
      threads: {
        singleThread: true   // Ensure test isolation
      }
    }
  }
}
```

## Test Isolation

### Environment Isolation

Each test creates completely isolated environments:

- **Temporary Directories**: Unique temp directories for each test
- **Project Isolation**: No cross-contamination between projects
- **File System Separation**: Complete separation of test artifacts
- **Process Isolation**: Clean process state for each test

### Cleanup Mechanisms

- **Automatic Cleanup**: TestDataManager handles automatic cleanup
- **Error Recovery**: Cleanup occurs even when tests fail
- **Resource Management**: Memory and file handle cleanup
- **Orphaned Resource Detection**: Detection of leaked resources

## Performance Considerations

### Test Performance

- **Large Dataset Testing**: Tests with 500+ items
- **Operation Timing**: Performance benchmarks for all operations
- **Memory Usage Tracking**: Memory leak detection
- **Concurrent Operation Testing**: Multi-user simulation

### Optimization

- **Parallel Execution**: Safe parallel test execution where possible
- **Resource Pooling**: Efficient test data creation
- **Incremental Testing**: Only test changed functionality when possible

## Error Handling

### Error Scenarios Tested

- **File System Errors**: Permission issues, disk space, corruption
- **Data Corruption**: Invalid YAML, missing files, broken references
- **Concurrent Access**: Multiple users, race conditions
- **Boundary Conditions**: Empty strings, very long strings, special characters
- **Network Issues**: Simulated network failures for GitHub integration

### Recovery Testing

- **Graceful Degradation**: System continues operating with partial failures
- **Data Recovery**: Restoration from corrupted states
- **User Feedback**: Clear error messages and recovery instructions

## Integration Points

### CLI Integration

All tests use the actual CLI commands:

```typescript
await runCLICommand(['epic', 'create', 'Test Epic', '--priority', 'high']);
await runCLICommand(['issue', 'list', '--status', 'active']);
await runCLICommand(['status', '--verbose']);
```

### File System Integration

Tests verify actual file system operations:

- YAML frontmatter validation
- File creation and modification
- Directory structure verification
- Relationship consistency in files

### GitHub Integration

Mocked GitHub operations for:

- Pull request creation
- Review workflows
- Merge operations
- Issue synchronization

## Debugging and Troubleshooting

### Debug Mode

Enable debug logging:

```bash
DEBUG=aitrackdown:* npm run test tests/e2e-integration/
```

### Test Artifacts

Failed tests preserve artifacts:

- Test directory contents
- Error logs and stack traces
- CLI command outputs
- Performance metrics

### Common Issues

1. **Test Timeouts**: Increase timeout for large dataset tests
2. **Permission Errors**: Ensure test directories are writable
3. **Port Conflicts**: Use unique ports for concurrent tests
4. **Memory Issues**: Monitor memory usage for large tests

## Contributing

### Adding New Tests

1. Follow the existing test structure
2. Use TestDataManager for test data creation
3. Ensure proper cleanup in afterEach hooks
4. Add comprehensive error handling
5. Include performance considerations

### Test Guidelines

- **Isolation**: Each test must be completely independent
- **Cleanup**: Always clean up resources
- **Assertions**: Use specific, meaningful assertions
- **Documentation**: Document complex test scenarios
- **Performance**: Consider test execution time

### Code Style

Follow the existing patterns:

```typescript
describe('Feature Category', () => {
  let testDataManager: TestDataManager;

  beforeEach(() => {
    testDataManager = new TestDataManager();
  });

  afterEach(() => {
    testDataManager.cleanup();
  });

  it('should handle specific scenario', async () => {
    // Test implementation
  });
});
```

## Metrics and Reporting

### Test Metrics

The test suite tracks:

- Test execution time
- Memory usage patterns
- Error rates and types
- Coverage percentages
- Performance benchmarks

### Reporting

Test results include:

- Pass/fail status for each category
- Performance metrics
- Memory usage analysis
- Error summaries
- Coverage reports

## Future Enhancements

### Planned Improvements

1. **Visual Testing**: Screenshot comparison for UI components
2. **Load Testing**: Higher volume concurrent user simulation
3. **Integration Testing**: Real GitHub API integration tests
4. **Performance Profiling**: Detailed performance analysis
5. **Chaos Testing**: Random failure injection

### Scalability Testing

Plans for testing:

- 10,000+ ticket systems
- 100+ concurrent users
- Multiple project hierarchies
- Cross-platform compatibility

---

This E2E integration test suite provides comprehensive coverage of the AI Trackdown Tools ticketing system, ensuring reliability, performance, and correctness across all supported workflows and scenarios.