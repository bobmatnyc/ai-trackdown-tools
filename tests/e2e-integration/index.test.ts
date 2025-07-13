/**
 * E2E Integration Test Suite - Main Entry Point
 *
 * This file serves as the main entry point for the comprehensive E2E integration test suite.
 * It imports and runs all test modules to ensure complete coverage of the ticketing system.
 *
 * Test Coverage:
 * - Complete ticket lifecycle for all types (epics, issues, tasks, PRs)
 * - Cross-type relationship management and validation
 * - Comment system functionality across all ticket types
 * - Cleanup workflows with orphaned reference detection
 * - Multi-project scenarios and project switching
 * - Error handling and recovery scenarios
 * - Performance and scalability testing
 * - Test isolation and cleanup mechanisms
 */

import { describe, expect, it } from 'vitest';

// Import all test modules
import './test-data-manager.js'; // Test data management utilities
import './ticket-lifecycle.test.js'; // Complete ticket lifecycle tests
import './relationship-management.test.js'; // Relationship management tests
import './comment-system.test.js'; // Comment system integration tests
import './cleanup-deletion.test.js'; // Cleanup and deletion verification tests
import './multi-project.test.js'; // Multi-project integration scenarios
import './test-suite-runner.test.js'; // Test isolation and suite runner

describe('E2E Integration Test Suite', () => {
  it('should load all test modules successfully', () => {
    // This test ensures all test modules are properly loaded
    // Individual tests are defined in their respective modules
    expect(true).toBe(true);
  });
});

export type { ProjectTestData, TicketTestData } from './test-data-manager.js';
// Export test utilities for external use
export { TestDataManager } from './test-data-manager.js';
