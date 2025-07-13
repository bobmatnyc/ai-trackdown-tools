import * as fs from 'node:fs';
import * as path from 'node:path';
import { createMockIndex, createTestContext, type TestContext } from '../utils/test-helpers.js';

export interface TicketTestData {
  epics: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    assignee: string;
    estimatedTokens: number;
    relatedIssues?: string[];
  }>;
  issues: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    assignee: string;
    estimatedTokens: number;
    epicId?: string;
    relatedTasks?: string[];
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    assignee: string;
    estimatedTime: string;
    issueId?: string;
  }>;
  prs: Array<{
    id: string;
    title: string;
    description: string;
    branch: string;
    targetBranch: string;
    issueId?: string;
    status: 'draft' | 'ready' | 'approved' | 'merged' | 'closed';
  }>;
}

export interface ProjectTestData {
  name: string;
  description: string;
  tickets: TicketTestData;
  comments: Array<{
    ticketId: string;
    ticketType: 'epic' | 'issue' | 'task' | 'pr';
    content: string;
    author: string;
  }>;
}

export class TestDataManager {
  private testContext: TestContext;
  private projectsData: Map<string, ProjectTestData> = new Map();
  private cleanupHandlers: (() => void)[] = [];

  constructor() {
    this.testContext = createTestContext();
  }

  /**
   * Creates a comprehensive test dataset for multi-type workflow testing
   */
  createComprehensiveTestData(): ProjectTestData {
    return {
      name: 'comprehensive-test-project',
      description: 'Complete test project with all ticket types and relationships',
      tickets: {
        epics: [
          {
            id: 'EP-0001',
            title: 'User Authentication System',
            description: 'Complete user authentication with login, signup, and password reset',
            priority: 'high',
            assignee: 'auth-team',
            estimatedTokens: 2000,
            relatedIssues: ['ISS-0001', 'ISS-0002', 'ISS-0003'],
          },
          {
            id: 'EP-0002',
            title: 'Dashboard Analytics',
            description: 'Real-time analytics dashboard with charts and reporting',
            priority: 'medium',
            assignee: 'frontend-team',
            estimatedTokens: 1500,
            relatedIssues: ['ISS-0004', 'ISS-0005'],
          },
          {
            id: 'EP-0003',
            title: 'API Performance Optimization',
            description: 'Backend API optimization for better performance and scalability',
            priority: 'high',
            assignee: 'backend-team',
            estimatedTokens: 1200,
            relatedIssues: ['ISS-0006'],
          },
        ],
        issues: [
          {
            id: 'ISS-0001',
            title: 'Implement Login Form',
            description: 'Create responsive login form with validation',
            priority: 'high',
            assignee: 'frontend-dev',
            estimatedTokens: 600,
            epicId: 'EP-0001',
            relatedTasks: ['TSK-0001', 'TSK-0002', 'TSK-0003'],
          },
          {
            id: 'ISS-0002',
            title: 'Setup Password Reset',
            description: 'Implement forgot password functionality',
            priority: 'medium',
            assignee: 'backend-dev',
            estimatedTokens: 500,
            epicId: 'EP-0001',
            relatedTasks: ['TSK-0004', 'TSK-0005'],
          },
          {
            id: 'ISS-0003',
            title: 'Add User Registration',
            description: 'Create user signup process',
            priority: 'medium',
            assignee: 'fullstack-dev',
            estimatedTokens: 700,
            epicId: 'EP-0001',
            relatedTasks: ['TSK-0006', 'TSK-0007'],
          },
          {
            id: 'ISS-0004',
            title: 'Charts Component Library',
            description: 'Reusable chart components for analytics',
            priority: 'medium',
            assignee: 'frontend-dev',
            estimatedTokens: 800,
            epicId: 'EP-0002',
            relatedTasks: ['TSK-0008', 'TSK-0009'],
          },
          {
            id: 'ISS-0005',
            title: 'Real-time Data Sync',
            description: 'WebSocket implementation for real-time updates',
            priority: 'high',
            assignee: 'backend-dev',
            estimatedTokens: 900,
            epicId: 'EP-0002',
            relatedTasks: ['TSK-0010', 'TSK-0011'],
          },
          {
            id: 'ISS-0006',
            title: 'Database Query Optimization',
            description: 'Optimize slow database queries and add indexing',
            priority: 'high',
            assignee: 'backend-dev',
            estimatedTokens: 600,
            epicId: 'EP-0003',
            relatedTasks: ['TSK-0012', 'TSK-0013'],
          },
        ],
        tasks: [
          // Login Form tasks
          {
            id: 'TSK-0001',
            title: 'Create Login UI Component',
            description: 'Design and implement login form UI',
            priority: 'high',
            assignee: 'frontend-dev',
            estimatedTime: '4h',
            issueId: 'ISS-0001',
          },
          {
            id: 'TSK-0002',
            title: 'Add Form Validation',
            description: 'Implement client-side validation for login form',
            priority: 'medium',
            assignee: 'frontend-dev',
            estimatedTime: '3h',
            issueId: 'ISS-0001',
          },
          {
            id: 'TSK-0003',
            title: 'Login API Integration',
            description: 'Connect login form to authentication API',
            priority: 'high',
            assignee: 'frontend-dev',
            estimatedTime: '2h',
            issueId: 'ISS-0001',
          },
          // Password Reset tasks
          {
            id: 'TSK-0004',
            title: 'Password Reset API Endpoint',
            description: 'Create API endpoint for password reset requests',
            priority: 'high',
            assignee: 'backend-dev',
            estimatedTime: '3h',
            issueId: 'ISS-0002',
          },
          {
            id: 'TSK-0005',
            title: 'Email Service Integration',
            description: 'Integrate with email service for reset notifications',
            priority: 'medium',
            assignee: 'backend-dev',
            estimatedTime: '4h',
            issueId: 'ISS-0002',
          },
          // User Registration tasks
          {
            id: 'TSK-0006',
            title: 'Registration Form Component',
            description: 'Create user registration form with validation',
            priority: 'medium',
            assignee: 'fullstack-dev',
            estimatedTime: '5h',
            issueId: 'ISS-0003',
          },
          {
            id: 'TSK-0007',
            title: 'User Registration API',
            description: 'Backend API for user registration and verification',
            priority: 'high',
            assignee: 'fullstack-dev',
            estimatedTime: '4h',
            issueId: 'ISS-0003',
          },
          // Charts tasks
          {
            id: 'TSK-0008',
            title: 'Chart Base Components',
            description: 'Create reusable base chart components',
            priority: 'medium',
            assignee: 'frontend-dev',
            estimatedTime: '6h',
            issueId: 'ISS-0004',
          },
          {
            id: 'TSK-0009',
            title: 'Chart Data Processing',
            description: 'Data transformation utilities for charts',
            priority: 'medium',
            assignee: 'frontend-dev',
            estimatedTime: '4h',
            issueId: 'ISS-0004',
          },
          // Real-time Data tasks
          {
            id: 'TSK-0010',
            title: 'WebSocket Server Setup',
            description: 'Configure WebSocket server for real-time data',
            priority: 'high',
            assignee: 'backend-dev',
            estimatedTime: '5h',
            issueId: 'ISS-0005',
          },
          {
            id: 'TSK-0011',
            title: 'Client WebSocket Integration',
            description: 'Frontend WebSocket client implementation',
            priority: 'high',
            assignee: 'backend-dev',
            estimatedTime: '3h',
            issueId: 'ISS-0005',
          },
          // Database Optimization tasks
          {
            id: 'TSK-0012',
            title: 'Analyze Query Performance',
            description: 'Profile and analyze slow database queries',
            priority: 'high',
            assignee: 'backend-dev',
            estimatedTime: '4h',
            issueId: 'ISS-0006',
          },
          {
            id: 'TSK-0013',
            title: 'Add Database Indexes',
            description: 'Create optimized indexes for frequently queried tables',
            priority: 'medium',
            assignee: 'backend-dev',
            estimatedTime: '3h',
            issueId: 'ISS-0006',
          },
        ],
        prs: [
          {
            id: 'PR-0001',
            title: 'Implement User Login System',
            description: 'Complete implementation of user login with form validation',
            branch: 'feature/user-login',
            targetBranch: 'main',
            issueId: 'ISS-0001',
            status: 'ready',
          },
          {
            id: 'PR-0002',
            title: 'Password Reset Implementation',
            description: 'Add forgot password functionality with email integration',
            branch: 'feature/password-reset',
            targetBranch: 'main',
            issueId: 'ISS-0002',
            status: 'draft',
          },
          {
            id: 'PR-0003',
            title: 'User Registration Flow',
            description: 'Complete user signup process with validation',
            branch: 'feature/user-registration',
            targetBranch: 'main',
            issueId: 'ISS-0003',
            status: 'ready',
          },
          {
            id: 'PR-0004',
            title: 'Analytics Charts Component',
            description: 'Reusable chart components for dashboard analytics',
            branch: 'feature/analytics-charts',
            targetBranch: 'main',
            issueId: 'ISS-0004',
            status: 'approved',
          },
        ],
      },
      comments: [
        {
          ticketId: 'EP-0001',
          ticketType: 'epic',
          content:
            'Starting work on authentication system. Will prioritize login functionality first.',
          author: 'auth-team',
        },
        {
          ticketId: 'ISS-0001',
          ticketType: 'issue',
          content: 'UI mockups completed. Moving to implementation phase.',
          author: 'frontend-dev',
        },
        {
          ticketId: 'ISS-0001',
          ticketType: 'issue',
          content: 'Added additional validation requirements based on security review.',
          author: 'security-team',
        },
        {
          ticketId: 'TSK-0001',
          ticketType: 'task',
          content: 'Component structure finalized. Following design system guidelines.',
          author: 'frontend-dev',
        },
        {
          ticketId: 'PR-0001',
          ticketType: 'pr',
          content: 'Please review the form validation logic before merging.',
          author: 'code-reviewer',
        },
      ],
    };
  }

  /**
   * Creates minimal test data for simple workflow testing
   */
  createMinimalTestData(): ProjectTestData {
    return {
      name: 'minimal-test-project',
      description: 'Minimal test project for basic workflow validation',
      tickets: {
        epics: [
          {
            id: 'EP-0001',
            title: 'Simple Feature',
            description: 'Basic feature implementation',
            priority: 'medium',
            assignee: 'developer',
            estimatedTokens: 500,
          },
        ],
        issues: [
          {
            id: 'ISS-0001',
            title: 'Feature Implementation',
            description: 'Implement the basic feature',
            priority: 'medium',
            assignee: 'developer',
            estimatedTokens: 300,
            epicId: 'EP-0001',
          },
        ],
        tasks: [
          {
            id: 'TSK-0001',
            title: 'Code Implementation',
            description: 'Write the feature code',
            priority: 'medium',
            assignee: 'developer',
            estimatedTime: '4h',
            issueId: 'ISS-0001',
          },
        ],
        prs: [
          {
            id: 'PR-0001',
            title: 'Feature Implementation PR',
            description: 'Pull request for feature implementation',
            branch: 'feature/simple',
            targetBranch: 'main',
            issueId: 'ISS-0001',
            status: 'draft',
          },
        ],
      },
      comments: [
        {
          ticketId: 'EP-0001',
          ticketType: 'epic',
          content: 'Starting work on this feature.',
          author: 'developer',
        },
      ],
    };
  }

  /**
   * Creates multi-project test data for testing project switching
   */
  createMultiProjectTestData(): Array<ProjectTestData> {
    return [
      {
        name: 'frontend-project',
        description: 'Frontend application project',
        tickets: {
          epics: [
            {
              id: 'EP-0001',
              title: 'UI Component Library',
              description: 'Reusable UI components',
              priority: 'high',
              assignee: 'frontend-team',
              estimatedTokens: 1000,
            },
          ],
          issues: [
            {
              id: 'ISS-0001',
              title: 'Button Components',
              description: 'Various button styles and states',
              priority: 'medium',
              assignee: 'ui-dev',
              estimatedTokens: 200,
              epicId: 'EP-0001',
            },
          ],
          tasks: [
            {
              id: 'TSK-0001',
              title: 'Primary Button',
              description: 'Implement primary button component',
              priority: 'medium',
              assignee: 'ui-dev',
              estimatedTime: '2h',
              issueId: 'ISS-0001',
            },
          ],
          prs: [],
        },
        comments: [],
      },
      {
        name: 'backend-project',
        description: 'Backend API project',
        tickets: {
          epics: [
            {
              id: 'EP-0001',
              title: 'API Development',
              description: 'RESTful API endpoints',
              priority: 'high',
              assignee: 'backend-team',
              estimatedTokens: 1200,
            },
          ],
          issues: [
            {
              id: 'ISS-0001',
              title: 'User API Endpoints',
              description: 'CRUD operations for users',
              priority: 'high',
              assignee: 'api-dev',
              estimatedTokens: 400,
              epicId: 'EP-0001',
            },
          ],
          tasks: [
            {
              id: 'TSK-0001',
              title: 'User Creation Endpoint',
              description: 'POST /api/users endpoint',
              priority: 'high',
              assignee: 'api-dev',
              estimatedTime: '3h',
              issueId: 'ISS-0001',
            },
          ],
          prs: [],
        },
        comments: [],
      },
    ];
  }

  /**
   * Physically creates the test data in the file system
   */
  async createTestProject(projectData: ProjectTestData, basePath?: string): Promise<string> {
    const projectPath = basePath || path.join(this.testContext.tempDir, projectData.name);

    try {
      // Create project directory structure with error handling
      fs.mkdirSync(projectPath, { recursive: true });
      fs.mkdirSync(path.join(projectPath, 'tasks'), { recursive: true });
      fs.mkdirSync(path.join(projectPath, 'tasks', 'epics'), { recursive: true });
      fs.mkdirSync(path.join(projectPath, 'tasks', 'issues'), { recursive: true });
      fs.mkdirSync(path.join(projectPath, 'tasks', 'tasks'), { recursive: true });
      fs.mkdirSync(path.join(projectPath, 'tasks', 'prs'), { recursive: true });
      fs.mkdirSync(path.join(projectPath, 'tasks', 'templates'), { recursive: true });
    } catch (error) {
      throw new Error(
        `Failed to create project directory structure: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Create README
    fs.writeFileSync(
      path.join(projectPath, 'README.md'),
      `# ${projectData.name}\n\n${projectData.description}\n`
    );

    // Create epics
    for (const epic of projectData.tickets.epics) {
      await this.createEpicFile(projectPath, epic);
    }

    // Create issues
    for (const issue of projectData.tickets.issues) {
      await this.createIssueFile(projectPath, issue);
    }

    // Create tasks
    for (const task of projectData.tickets.tasks) {
      await this.createTaskFile(projectPath, task);
    }

    // Create PRs
    for (const pr of projectData.tickets.prs) {
      await this.createPRFile(projectPath, pr);
    }

    // Add comments to files
    for (const comment of projectData.comments) {
      await this.addCommentToFile(projectPath, comment);
    }

    // Create pre-built index to prevent rebuilding during tests
    createMockIndex(path.join(projectPath, 'tasks'));

    this.projectsData.set(projectData.name, projectData);
    return projectPath;
  }

  private async createEpicFile(projectPath: string, epic: any): Promise<void> {
    const frontmatter = `---
title: "${epic.title}"
description: "${epic.description}"
status: planning
priority: ${epic.priority}
assignee: "${epic.assignee}"
created_date: ${new Date().toISOString()}
updated_date: ${new Date().toISOString()}
estimated_tokens: ${epic.estimatedTokens}
actual_tokens: 0
ai_context:
  - context/requirements
  - context/constraints
sync_status: local
related_issues: ${epic.relatedIssues ? JSON.stringify(epic.relatedIssues) : '[]'}
dependencies: []
completion_percentage: 0
---

# Epic: ${epic.title}

## Overview
${epic.description}

## Objectives
- [ ] Objective 1
- [ ] Objective 2

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2
`;

    const filename = `${epic.id}-${epic.title.toLowerCase().replace(/\s+/g, '-')}.md`;
    fs.writeFileSync(path.join(projectPath, 'tasks', 'epics', filename), frontmatter);
  }

  private async createIssueFile(projectPath: string, issue: any): Promise<void> {
    const frontmatter = `---
title: "${issue.title}"
description: "${issue.description}"
status: active
priority: ${issue.priority}
assignee: "${issue.assignee}"
created_date: ${new Date().toISOString()}
updated_date: ${new Date().toISOString()}
estimated_tokens: ${issue.estimatedTokens}
actual_tokens: 0
ai_context:
  - context/requirements
sync_status: local
related_epics: ${issue.epicId ? `["${issue.epicId}"]` : '[]'}
related_tasks: ${issue.relatedTasks ? JSON.stringify(issue.relatedTasks) : '[]'}
dependencies: []
completion_percentage: 0
---

# Issue: ${issue.title}

## Description
${issue.description}

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2
`;

    const filename = `${issue.id}-${issue.title.toLowerCase().replace(/\s+/g, '-')}.md`;
    fs.writeFileSync(path.join(projectPath, 'tasks', 'issues', filename), frontmatter);
  }

  private async createTaskFile(projectPath: string, task: any): Promise<void> {
    const frontmatter = `---
title: "${task.title}"
description: "${task.description}"
status: pending
priority: ${task.priority}
assignee: "${task.assignee}"
created_date: ${new Date().toISOString()}
updated_date: ${new Date().toISOString()}
estimated_time: "${task.estimatedTime}"
actual_time: "0h"
related_issue: ${task.issueId ? `"${task.issueId}"` : 'null'}
dependencies: []
completion_percentage: 0
---

# Task: ${task.title}

## Description
${task.description}

## Implementation Notes
- Implementation detail 1
- Implementation detail 2
`;

    const filename = `${task.id}-${task.title.toLowerCase().replace(/\s+/g, '-')}.md`;
    fs.writeFileSync(path.join(projectPath, 'tasks', 'tasks', filename), frontmatter);
  }

  private async createPRFile(projectPath: string, pr: any): Promise<void> {
    const frontmatter = `---
title: "${pr.title}"
description: "${pr.description}"
status: ${pr.status}
branch: "${pr.branch}"
target_branch: "${pr.targetBranch}"
created_date: ${new Date().toISOString()}
updated_date: ${new Date().toISOString()}
related_issue: ${pr.issueId ? `"${pr.issueId}"` : 'null'}
github_pr_number: null
github_url: null
reviewers: []
labels: []
---

# Pull Request: ${pr.title}

## Description
${pr.description}

## Changes
- Change 1
- Change 2

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
`;

    const filename = `${pr.id}-${pr.title.toLowerCase().replace(/\s+/g, '-')}.md`;
    fs.writeFileSync(path.join(projectPath, 'tasks', 'prs', filename), frontmatter);
  }

  private async addCommentToFile(projectPath: string, comment: any): Promise<void> {
    const typeDir =
      comment.ticketType === 'epic'
        ? 'epics'
        : comment.ticketType === 'issue'
          ? 'issues'
          : comment.ticketType === 'task'
            ? 'tasks'
            : 'prs';

    const dir = path.join(projectPath, 'tasks', typeDir);
    const files = fs.readdirSync(dir);
    const targetFile = files.find((f) => f.startsWith(comment.ticketId));

    if (targetFile) {
      const filePath = path.join(dir, targetFile);
      const content = fs.readFileSync(filePath, 'utf-8');

      const commentSection = `

## Comments

### ${new Date().toISOString()} - ${comment.author}
${comment.content}
`;

      fs.writeFileSync(filePath, content + commentSection);
    }
  }

  /**
   * Cleanup method to clean up test data and prevent memory leaks
   */
  cleanup(): void {
    try {
      // Run custom cleanup handlers first
      for (const handler of this.cleanupHandlers) {
        try {
          handler();
        } catch (error) {
          console.warn('Cleanup handler failed:', error);
        }
      }
      this.cleanupHandlers.length = 0;

      // Clear large data structures to free memory immediately
      this.projectsData.clear();

      // Clean up test context with enhanced error handling
      try {
        this.testContext.cleanup();
      } catch (error) {
        console.warn('Test context cleanup failed:', error);
        // Try alternative cleanup if main cleanup fails
        try {
          if (this.testContext.tempDir && fs.existsSync(this.testContext.tempDir)) {
            const rimraf = require('rimraf');
            if (rimraf.sync) {
              rimraf.sync(this.testContext.tempDir);
            } else {
              // Fallback to rm -rf
              require('node:child_process').execSync(`rm -rf "${this.testContext.tempDir}"`, {
                stdio: 'ignore',
              });
            }
          }
        } catch (altError) {
          console.warn('Alternative cleanup also failed:', altError);
        }
      }

      // Force garbage collection if available (helpful in test environments)
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      console.warn('TestDataManager cleanup failed:', error);
    }
  }

  /**
   * Register a cleanup handler for custom cleanup logic
   */
  registerCleanupHandler(handler: () => void): void {
    this.cleanupHandlers.push(handler);
  }

  /**
   * Get test context for accessing temp directories
   */
  getTestContext(): TestContext {
    return this.testContext;
  }

  /**
   * Get created project data
   */
  getProjectData(name: string): ProjectTestData | undefined {
    return this.projectsData.get(name);
  }
}
