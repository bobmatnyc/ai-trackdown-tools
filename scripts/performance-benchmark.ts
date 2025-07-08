#!/usr/bin/env tsx

/**
 * Performance Benchmark Script for PR Commands
 * Measures command response times and memory usage
 */

import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { promisify } from 'util';

interface BenchmarkResult {
  command: string;
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  success: boolean;
  error?: string;
}

interface BenchmarkSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  averageExecutionTime: number;
  maxExecutionTime: number;
  averageMemoryUsage: number;
  maxMemoryUsage: number;
  performanceTargetsMet: boolean;
  recommendations: string[];
}

class PerformanceBenchmark {
  private testDir: string;
  private cliPath: string;
  private results: BenchmarkResult[] = [];
  
  // Performance targets
  private readonly TARGETS = {
    PR_CREATE: 200,    // 200ms
    PR_LIST: 100,      // 100ms
    PR_SHOW: 50,       // 50ms
    PR_UPDATE: 150,    // 150ms
    PR_MERGE: 300,     // 300ms
    BATCH_OP: 1000,    // 1s for batch operations
    MEMORY_LIMIT: 50 * 1024 * 1024, // 50MB
  };

  constructor() {
    this.testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-trackdown-benchmark-'));
    this.cliPath = path.join(process.cwd(), 'dist', 'index.cjs');
    this.setupTestEnvironment();
  }

  private setupTestEnvironment(): void {
    console.log('🚀 Setting up benchmark environment...');
    
    // Create directory structure
    const dirs = [
      'prs/draft',
      'prs/active/open',
      'prs/active/review', 
      'prs/active/approved',
      'prs/merged',
      'prs/closed',
      'prs/reviews',
      'tasks',
      'issues',
      'templates'
    ];

    dirs.forEach(dir => {
      fs.mkdirSync(path.join(this.testDir, dir), { recursive: true });
    });

    // Create config file
    const config = {
      name: 'benchmark-project',
      version: '1.0.0',
      structure: {
        prs_dir: 'prs',
        tasks_dir: 'tasks',
        issues_dir: 'issues',
        templates_dir: 'templates'
      },
      naming_conventions: {
        pr_prefix: 'PR',
        task_prefix: 'TASK',
        issue_prefix: 'ISSUE'
      }
    };

    fs.writeFileSync(
      path.join(this.testDir, 'ai-trackdown.json'),
      JSON.stringify(config, null, 2)
    );

    // Create sample data
    this.createSampleData();
    
    console.log(`✅ Environment setup complete at: ${this.testDir}`);
  }

  private createSampleData(): void {
    // Create sample issue
    const issueContent = `---
issue_id: ISSUE-001
epic_id: EPIC-001
title: Benchmark Issue
description: Sample issue for benchmarking
status: active
priority: high
assignee: benchmark-user
created_date: ${new Date().toISOString()}
updated_date: ${new Date().toISOString()}
estimated_tokens: 100
actual_tokens: 0
ai_context: []
sync_status: local
---

# Benchmark Issue

This is a sample issue for performance benchmarking.`;

    fs.writeFileSync(path.join(this.testDir, 'issues', 'ISSUE-001-benchmark-issue.md'), issueContent);

    // Create multiple PRs for testing
    for (let i = 1; i <= 50; i++) {
      const prId = `PR-${i.toString().padStart(3, '0')}`;
      const status = i % 4 === 0 ? 'approved' : i % 3 === 0 ? 'review' : 'open';
      const statusDir = status === 'open' ? 'active/open' : status === 'review' ? 'active/review' : 'active/approved';
      
      const prContent = `---
pr_id: ${prId}
issue_id: ISSUE-001
epic_id: EPIC-001
title: Benchmark PR ${i}
description: Sample PR for benchmarking
status: active
pr_status: ${status}
priority: medium
assignee: benchmark-user
created_date: ${new Date().toISOString()}
updated_date: ${new Date().toISOString()}
estimated_tokens: 50
actual_tokens: 25
ai_context: []
sync_status: local
branch_name: feature/benchmark-${i}
target_branch: main
reviewers: [reviewer1, reviewer2]
approvals: ${status === 'approved' ? '[reviewer1, reviewer2]' : '[]'}
tags: [benchmark]
dependencies: []
blocked_by: []
blocks: []
related_prs: []
template_used: default
---

# Benchmark PR ${i}

This is a sample PR for performance benchmarking.

## Changes
- Sample change ${i}
- Performance test change

## Testing
- [x] Unit tests
- [x] Integration tests`;

      fs.writeFileSync(
        path.join(this.testDir, 'prs', statusDir, `${prId}-benchmark.md`),
        prContent
      );
    }
  }

  private async runCommand(args: string[]): Promise<BenchmarkResult> {
    const command = args.join(' ');
    const startTime = performance.now();
    const initialMemory = process.memoryUsage().heapUsed;

    return new Promise((resolve) => {
      const child = spawn('node', [this.cliPath, ...args], {
        cwd: this.testDir,
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'benchmark' }
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const endTime = performance.now();
        const finalMemory = process.memoryUsage().heapUsed;
        
        const result: BenchmarkResult = {
          command,
          executionTime: endTime - startTime,
          memoryUsage: finalMemory - initialMemory,
          cpuUsage: process.cpuUsage().user / 1000, // Convert to ms
          success: code === 0,
          error: code !== 0 ? stderr : undefined
        };

        resolve(result);
      });

      child.on('error', (error) => {
        const endTime = performance.now();
        resolve({
          command,
          executionTime: endTime - startTime,
          memoryUsage: 0,
          cpuUsage: 0,
          success: false,
          error: error.message
        });
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill();
        resolve({
          command,
          executionTime: 30000,
          memoryUsage: 0,
          cpuUsage: 0,
          success: false,
          error: 'Command timed out'
        });
      }, 30000);
    });
  }

  private async benchmarkPRCreate(): Promise<void> {
    console.log('📝 Benchmarking PR create commands...');
    
    const tests = [
      ['pr', 'create', '--title', 'Benchmark PR Test', '--issue', 'ISSUE-001', '--description', 'Test PR', '--assignee', 'test-user', '--dry-run'],
      ['pr', 'create', '--title', 'Quick PR Test', '--issue', 'ISSUE-001', '--description', 'Quick test', '--assignee', 'test-user', '--branch-name', 'feature/quick-test', '--dry-run'],
      ['pr', 'create', '--title', 'Full PR Test', '--issue', 'ISSUE-001', '--description', 'Full test with all options', '--assignee', 'test-user', '--reviewers', 'reviewer1,reviewer2', '--priority', 'high', '--dry-run']
    ];

    for (const test of tests) {
      const result = await this.runCommand(test);
      this.results.push(result);
      
      if (result.executionTime > this.TARGETS.PR_CREATE) {
        console.warn(`⚠️  PR create exceeded target: ${result.executionTime.toFixed(2)}ms > ${this.TARGETS.PR_CREATE}ms`);
      } else {
        console.log(`✅ PR create within target: ${result.executionTime.toFixed(2)}ms`);
      }
    }
  }

  private async benchmarkPRList(): Promise<void> {
    console.log('📋 Benchmarking PR list commands...');
    
    const tests = [
      ['pr', 'list'],
      ['pr', 'list', '--status', 'open'],
      ['pr', 'list', '--status', 'approved'],
      ['pr', 'list', '--assignee', 'benchmark-user'],
      ['pr', 'list', '--format', 'json'],
      ['pr', 'list', '--format', 'table']
    ];

    for (const test of tests) {
      const result = await this.runCommand(test);
      this.results.push(result);
      
      if (result.executionTime > this.TARGETS.PR_LIST) {
        console.warn(`⚠️  PR list exceeded target: ${result.executionTime.toFixed(2)}ms > ${this.TARGETS.PR_LIST}ms`);
      } else {
        console.log(`✅ PR list within target: ${result.executionTime.toFixed(2)}ms`);
      }
    }
  }

  private async benchmarkPRShow(): Promise<void> {
    console.log('👁️  Benchmarking PR show commands...');
    
    const tests = [
      ['pr', 'show', 'PR-001'],
      ['pr', 'show', 'PR-010', '--format', 'json'],
      ['pr', 'show', 'PR-020', '--show-content'],
      ['pr', 'show', 'PR-030', '--show-relationships'],
      ['pr', 'show', 'PR-040', '--show-history']
    ];

    for (const test of tests) {
      const result = await this.runCommand(test);
      this.results.push(result);
      
      if (result.executionTime > this.TARGETS.PR_SHOW) {
        console.warn(`⚠️  PR show exceeded target: ${result.executionTime.toFixed(2)}ms > ${this.TARGETS.PR_SHOW}ms`);
      } else {
        console.log(`✅ PR show within target: ${result.executionTime.toFixed(2)}ms`);
      }
    }
  }

  private async benchmarkPRUpdate(): Promise<void> {
    console.log('✏️  Benchmarking PR update commands...');
    
    const tests = [
      ['pr', 'update', 'PR-001', '--priority', 'high', '--dry-run'],
      ['pr', 'update', 'PR-002', '--assignee', 'new-user', '--dry-run'],
      ['pr', 'update', 'PR-003', '--add-reviewer', 'reviewer3', '--dry-run'],
      ['pr', 'update', 'PR-004', '--title', 'Updated PR Title', '--dry-run'],
      ['pr', 'update', 'PR-005', '--description', 'Updated description', '--dry-run']
    ];

    for (const test of tests) {
      const result = await this.runCommand(test);
      this.results.push(result);
      
      if (result.executionTime > this.TARGETS.PR_UPDATE) {
        console.warn(`⚠️  PR update exceeded target: ${result.executionTime.toFixed(2)}ms > ${this.TARGETS.PR_UPDATE}ms`);
      } else {
        console.log(`✅ PR update within target: ${result.executionTime.toFixed(2)}ms`);
      }
    }
  }

  private async benchmarkBatchOperations(): Promise<void> {
    console.log('⚡ Benchmarking batch operations...');
    
    const tests = [
      ['pr', 'batch', '--operation', 'approve', '--filter', 'status:open', '--dry-run'],
      ['pr', 'batch', '--operation', 'merge', '--filter', 'status:approved', '--dry-run'],
      ['pr', 'list', '--format', 'json'] // Simulate large dataset processing
    ];

    for (const test of tests) {
      const result = await this.runCommand(test);
      this.results.push(result);
      
      if (result.executionTime > this.TARGETS.BATCH_OP) {
        console.warn(`⚠️  Batch operation exceeded target: ${result.executionTime.toFixed(2)}ms > ${this.TARGETS.BATCH_OP}ms`);
      } else {
        console.log(`✅ Batch operation within target: ${result.executionTime.toFixed(2)}ms`);
      }
    }
  }

  private async benchmarkMemoryUsage(): Promise<void> {
    console.log('💾 Benchmarking memory usage...');
    
    // Create more test data for memory stress test
    for (let i = 51; i <= 200; i++) {
      const prId = `PR-${i.toString().padStart(3, '0')}`;
      const prContent = `---
pr_id: ${prId}
title: Memory Test PR ${i}
pr_status: open
---

# Memory Test PR ${i}

Large content for memory testing.
${'Large content line. '.repeat(100)}`;

      fs.writeFileSync(
        path.join(this.testDir, 'prs', 'active', 'open', `${prId}-memory-test.md`),
        prContent
      );
    }

    const result = await this.runCommand(['pr', 'list', '--format', 'json']);
    this.results.push(result);

    if (result.memoryUsage > this.TARGETS.MEMORY_LIMIT) {
      console.warn(`⚠️  Memory usage exceeded target: ${(result.memoryUsage / 1024 / 1024).toFixed(2)}MB > ${this.TARGETS.MEMORY_LIMIT / 1024 / 1024}MB`);
    } else {
      console.log(`✅ Memory usage within target: ${(result.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
    }
  }

  private generateSummary(): BenchmarkSummary {
    const passed = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    
    const executionTimes = this.results.map(r => r.executionTime);
    const memoryUsages = this.results.map(r => r.memoryUsage);
    
    const avgExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
    const maxExecutionTime = Math.max(...executionTimes);
    const avgMemoryUsage = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;
    const maxMemoryUsage = Math.max(...memoryUsages);

    const recommendations: string[] = [];
    
    // Performance recommendations
    if (maxExecutionTime > 1000) {
      recommendations.push('Consider optimizing slow commands (>1s execution time)');
    }
    
    if (avgExecutionTime > 200) {
      recommendations.push('Average execution time is high - consider general optimizations');
    }
    
    if (maxMemoryUsage > this.TARGETS.MEMORY_LIMIT) {
      recommendations.push('Memory usage exceeds targets - optimize large dataset handling');
    }
    
    if (failed.length > 0) {
      recommendations.push(`${failed.length} commands failed - investigate error handling`);
    }

    const performanceTargetsMet = maxExecutionTime < 1000 && maxMemoryUsage < this.TARGETS.MEMORY_LIMIT;

    return {
      totalTests: this.results.length,
      passedTests: passed.length,
      failedTests: failed.length,
      averageExecutionTime: avgExecutionTime,
      maxExecutionTime,
      averageMemoryUsage: avgMemoryUsage,
      maxMemoryUsage,
      performanceTargetsMet,
      recommendations
    };
  }

  private generateReport(summary: BenchmarkSummary): void {
    console.log('\n📊 PERFORMANCE BENCHMARK REPORT');
    console.log('================================');
    
    console.log(`\n📈 Test Results:`);
    console.log(`  Total Tests: ${summary.totalTests}`);
    console.log(`  Passed: ${summary.passedTests} ✅`);
    console.log(`  Failed: ${summary.failedTests} ${summary.failedTests > 0 ? '❌' : '✅'}`);
    
    console.log(`\n⏱️  Performance Metrics:`);
    console.log(`  Average Execution Time: ${summary.averageExecutionTime.toFixed(2)}ms`);
    console.log(`  Maximum Execution Time: ${summary.maxExecutionTime.toFixed(2)}ms`);
    console.log(`  Average Memory Usage: ${(summary.averageMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Maximum Memory Usage: ${(summary.maxMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
    
    console.log(`\n🎯 Target Compliance:`);
    console.log(`  Overall Targets Met: ${summary.performanceTargetsMet ? '✅ YES' : '❌ NO'}`);
    console.log(`  PR Create Target (${this.TARGETS.PR_CREATE}ms): ${this.checkTarget('create')}`);
    console.log(`  PR List Target (${this.TARGETS.PR_LIST}ms): ${this.checkTarget('list')}`);
    console.log(`  PR Show Target (${this.TARGETS.PR_SHOW}ms): ${this.checkTarget('show')}`);
    console.log(`  Memory Target (${this.TARGETS.MEMORY_LIMIT / 1024 / 1024}MB): ${summary.maxMemoryUsage < this.TARGETS.MEMORY_LIMIT ? '✅' : '❌'}`);
    
    if (summary.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      summary.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }

    // Detailed results
    console.log(`\n📋 Detailed Results:`);
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const time = result.executionTime.toFixed(2);
      const memory = (result.memoryUsage / 1024 / 1024).toFixed(2);
      console.log(`  ${status} ${result.command} - ${time}ms, ${memory}MB`);
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }
    });

    // Save detailed report to file
    const reportPath = path.join(process.cwd(), 'performance-report.json');
    const detailedReport = {
      timestamp: new Date().toISOString(),
      summary,
      results: this.results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem()
      }
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }

  private checkTarget(commandType: string): string {
    const relevant = this.results.filter(r => r.command.includes(commandType));
    if (relevant.length === 0) return '❓ N/A';
    
    let target: number;
    switch (commandType) {
      case 'create': target = this.TARGETS.PR_CREATE; break;
      case 'list': target = this.TARGETS.PR_LIST; break;
      case 'show': target = this.TARGETS.PR_SHOW; break;
      case 'update': target = this.TARGETS.PR_UPDATE; break;
      default: target = 1000;
    }
    
    const exceeded = relevant.filter(r => r.executionTime > target);
    return exceeded.length === 0 ? '✅' : `❌ (${exceeded.length}/${relevant.length} exceeded)`;
  }

  public async run(): Promise<void> {
    console.log('🚀 Starting PR Commands Performance Benchmark');
    console.log(`📍 Test Directory: ${this.testDir}`);
    console.log(`🔧 CLI Path: ${this.cliPath}`);
    
    try {
      // Verify CLI exists
      if (!fs.existsSync(this.cliPath)) {
        throw new Error(`CLI not found at ${this.cliPath}. Run 'npm run build' first.`);
      }

      // Run benchmarks
      await this.benchmarkPRCreate();
      await this.benchmarkPRList();
      await this.benchmarkPRShow();
      await this.benchmarkPRUpdate();
      await this.benchmarkBatchOperations();
      await this.benchmarkMemoryUsage();

      // Generate and display report
      const summary = this.generateSummary();
      this.generateReport(summary);

      console.log('\n🏁 Benchmark completed successfully!');
      
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
      process.exit(1);
    } finally {
      // Cleanup
      if (fs.existsSync(this.testDir)) {
        fs.rmSync(this.testDir, { recursive: true, force: true });
      }
    }
  }
}

// Run benchmark if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const benchmark = new PerformanceBenchmark();
  benchmark.run().catch(console.error);
}

export { PerformanceBenchmark };