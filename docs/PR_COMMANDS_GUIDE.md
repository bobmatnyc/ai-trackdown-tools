# PR Commands User Guide

**AI Trackdown Tools - Pull Request Management**

This guide provides comprehensive documentation for all Pull Request (PR) management commands in the AI Trackdown CLI. The PR system enables complete lifecycle management of pull requests with GitHub-independent tracking and agent-optimized workflows.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Core Commands](#core-commands)
- [Advanced Features](#advanced-features)
- [Workflow Examples](#workflow-examples)
- [Performance & Best Practices](#performance--best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The AI Trackdown PR system provides:
- **Complete PR Lifecycle Management**: Draft → Open → Review → Approved → Merged/Closed
- **File-based Organization**: Status-based directory structure with automatic file movement
- **Template Integration**: Full and quick PR templates with variable substitution
- **Review System**: Structured review process with approval tracking
- **Batch Operations**: Efficient bulk operations for multiple PRs
- **Agent Optimization**: Memory usage tracking and intelligent workflows

### Directory Structure

```
project/
├── prs/
│   ├── draft/          # Draft PRs
│   ├── active/
│   │   ├── open/       # Open PRs ready for review
│   │   ├── review/     # PRs under review
│   │   └── approved/   # Approved PRs ready to merge
│   ├── merged/         # Successfully merged PRs
│   ├── closed/         # Closed/rejected PRs
│   ├── reviews/        # PR review files
│   └── logs/           # Operation logs
└── templates/
    ├── pr-template.md       # Full PR template
    └── pr-quick-template.md # Quick PR template
```

## Quick Start

### 1. Initialize Project

```bash
# Initialize AI Trackdown project
aitrackdown init

# Or initialize with custom PR directory
aitrackdown init --prs-dir pull-requests
```

### 2. Create Your First PR

```bash
# Create a basic PR
aitrackdown pr create \
  --title "Add user authentication" \
  --issue ISSUE-001 \
  --description "Implements JWT-based user authentication" \
  --assignee @developer

# Create with more options
aitrackdown pr create \
  --title "Add user authentication" \
  --issue ISSUE-001 \
  --description "Implements JWT-based user authentication" \
  --assignee @developer \
  --branch-name feature/auth \
  --reviewers @senior-dev,@security-expert \
  --priority high \
  --template full
```

### 3. List and Manage PRs

```bash
# List all PRs
aitrackdown pr list

# List open PRs
aitrackdown pr list --status open

# Show specific PR
aitrackdown pr show PR-001
```

### 4. Review and Approve

```bash
# Add review
aitrackdown pr review PR-001 \
  --approve \
  --comments "Great implementation! LGTM."

# Approve for merge
aitrackdown pr approve PR-001 \
  --comments "Ready to merge"
```

### 5. Merge PR

```bash
# Merge with default settings
aitrackdown pr merge PR-001

# Merge with specific strategy
aitrackdown pr merge PR-001 \
  --strategy squash \
  --close-linked-tasks
```

## Core Commands

### `aitrackdown pr create`

Create a new pull request from template or custom options.

#### Basic Syntax
```bash
aitrackdown pr create [options]
```

#### Required Options
- `--title <title>` - PR title (required)
- `--issue <issue-id>` - Linked issue ID (required)

#### Common Options
- `--description <desc>` - PR description
- `--assignee <user>` - Assigned user/agent
- `--branch-name <branch>` - Source branch name
- `--target-branch <branch>` - Target branch (default: main)
- `--reviewers <users>` - Comma-separated reviewer list
- `--priority <level>` - Priority level (low|medium|high|critical)
- `--template <type>` - Template type (full|quick)
- `--tags <tags>` - Comma-separated tags
- `--dry-run` - Preview without creating

#### Advanced Options
- `--epic <epic-id>` - Link to epic
- `--dependencies <prs>` - Dependent PR IDs
- `--blocks <prs>` - PRs blocked by this PR
- `--estimated-tokens <num>` - Estimated AI token usage
- `--from-tasks <task-ids>` - Create from completed tasks

#### Examples

```bash
# Minimal PR creation
aitrackdown pr create \
  --title "Fix authentication bug" \
  --issue ISSUE-042

# Full featured PR
aitrackdown pr create \
  --title "Implement OAuth integration" \
  --issue ISSUE-123 \
  --description "Adds OAuth 2.0 support for Google and GitHub" \
  --assignee @backend-team \
  --branch-name feature/oauth-integration \
  --target-branch develop \
  --reviewers @security-team,@lead-dev \
  --priority high \
  --template full \
  --tags security,authentication \
  --estimated-tokens 500

# Create from completed tasks
aitrackdown pr create \
  --title "User profile enhancements" \
  --from-tasks TASK-001,TASK-002,TASK-003 \
  --auto-link

# Dry run to preview
aitrackdown pr create \
  --title "Test PR" \
  --issue ISSUE-001 \
  --dry-run
```

### `aitrackdown pr list`

List and filter pull requests with various display options.

#### Basic Syntax
```bash
aitrackdown pr list [options]
```

#### Filter Options
- `--status <statuses>` - Filter by status (draft|open|review|approved|merged|closed)
- `--pr-status <statuses>` - Alias for --status
- `--priority <levels>` - Filter by priority
- `--assignee <user>` - Filter by assignee
- `--reviewer <user>` - Filter by reviewer
- `--issue <issue-id>` - Filter by linked issue
- `--epic <epic-id>` - Filter by linked epic
- `--branch <branch>` - Filter by branch name
- `--tags <tags>` - Filter by tags
- `--created-after <date>` - Created after date
- `--created-before <date>` - Created before date
- `--updated-after <date>` - Updated after date

#### Display Options
- `--format <format>` - Output format (table|json|csv|markdown)
- `--sort <field>` - Sort by field (created|updated|priority|status)
- `--reverse` - Reverse sort order
- `--limit <num>` - Limit number of results
- `--show-stats` - Show summary statistics

#### Examples

```bash
# List all PRs
aitrackdown pr list

# List open PRs in table format
aitrackdown pr list --status open --format table

# List high priority PRs assigned to specific user
aitrackdown pr list \
  --priority high \
  --assignee @developer \
  --format json

# List recent PRs for specific issue
aitrackdown pr list \
  --issue ISSUE-123 \
  --created-after 2025-01-01 \
  --sort created \
  --reverse

# List PRs with statistics
aitrackdown pr list --show-stats

# List approved PRs ready to merge
aitrackdown pr list \
  --status approved \
  --format table \
  --sort updated
```

### `aitrackdown pr show`

Display detailed information about a specific pull request.

#### Basic Syntax
```bash
aitrackdown pr show <pr-id> [options]
```

#### Display Options
- `--format <format>` - Output format (default|json|yaml|markdown)
- `--show-content` - Include PR content/body
- `--show-relationships` - Show linked tasks/issues/PRs
- `--show-history` - Show change history
- `--show-reviews` - Include review details
- `--show-files` - Show changed files (if tracked)
- `--show-stats` - Show token usage and metrics

#### Examples

```bash
# Basic PR details
aitrackdown pr show PR-001

# Full details with content
aitrackdown pr show PR-001 \
  --show-content \
  --show-relationships \
  --show-reviews

# JSON output for scripting
aitrackdown pr show PR-001 --format json

# Complete information dump
aitrackdown pr show PR-001 \
  --show-content \
  --show-relationships \
  --show-history \
  --show-reviews \
  --show-files \
  --show-stats
```

### `aitrackdown pr update`

Update pull request properties and metadata.

#### Basic Syntax
```bash
aitrackdown pr update <pr-id> [options]
```

#### Update Options
- `--title <title>` - Update PR title
- `--description <desc>` - Update description
- `--status <status>` - Update workflow status
- `--priority <level>` - Update priority
- `--assignee <user>` - Change assignee
- `--branch-name <branch>` - Update source branch
- `--target-branch <branch>` - Update target branch

#### Reviewer Management
- `--add-reviewer <user>` - Add reviewer
- `--remove-reviewer <user>` - Remove reviewer
- `--reviewers <users>` - Replace all reviewers

#### Tag Management
- `--add-tag <tag>` - Add tag
- `--remove-tag <tag>` - Remove tag
- `--tags <tags>` - Replace all tags

#### Advanced Options
- `--add-dependency <pr-id>` - Add dependency
- `--remove-dependency <pr-id>` - Remove dependency
- `--add-blocker <pr-id>` - Add blocking PR
- `--remove-blocker <pr-id>` - Remove blocking PR
- `--estimated-tokens <num>` - Update token estimate
- `--dry-run` - Preview changes

#### Examples

```bash
# Update basic information
aitrackdown pr update PR-001 \
  --title "Updated: Add OAuth integration" \
  --priority high

# Change assignee and add reviewers
aitrackdown pr update PR-001 \
  --assignee @new-developer \
  --add-reviewer @security-expert

# Update status to ready for review
aitrackdown pr update PR-001 --status review

# Add tags and dependencies
aitrackdown pr update PR-001 \
  --add-tag urgent \
  --add-dependency PR-002

# Bulk update with dry run
aitrackdown pr update PR-001 \
  --title "New title" \
  --description "New description" \
  --priority critical \
  --dry-run
```

### `aitrackdown pr review`

Create or update PR reviews with structured feedback.

#### Basic Syntax
```bash
aitrackdown pr review <pr-id> [options]
```

#### Review Actions
- `--approve` - Approve the PR
- `--request-changes` - Request changes
- `--comment` - Add comment without approval

#### Review Options
- `--comments <text>` - Review comments/feedback
- `--reviewer <user>` - Reviewer identity
- `--template <type>` - Review template (security|performance|general)
- `--checklist <items>` - Review checklist items
- `--severity <level>` - Issue severity (low|medium|high|critical)

#### File-specific Reviews
- `--file <file>` - Review specific file
- `--line <num>` - Comment on specific line
- `--suggestion <text>` - Code suggestion

#### Examples

```bash
# Simple approval
aitrackdown pr review PR-001 \
  --approve \
  --comments "Looks good! LGTM."

# Request changes with detailed feedback
aitrackdown pr review PR-001 \
  --request-changes \
  --comments "Please address security concerns in auth.ts" \
  --severity high

# Add comment without approval
aitrackdown pr review PR-001 \
  --comment \
  --comments "Consider adding more test coverage"

# Security review with template
aitrackdown pr review PR-001 \
  --approve \
  --template security \
  --comments "Security review passed. No vulnerabilities found."

# File-specific review
aitrackdown pr review PR-001 \
  --file src/auth.ts \
  --line 42 \
  --suggestion "Use bcrypt.compare() instead of direct comparison"
```

### `aitrackdown pr approve`

Formally approve a PR for merging with optional auto-merge.

#### Basic Syntax
```bash
aitrackdown pr approve <pr-id> [options]
```

#### Approval Options
- `--comments <text>` - Approval comments
- `--reviewer <user>` - Approving reviewer
- `--auto-merge` - Auto-merge when all approvals received
- `--merge-strategy <strategy>` - Merge strategy (merge|squash|rebase)
- `--bypass-checks` - Bypass pre-merge checks
- `--conditional` - Conditional approval pending minor fixes

#### Examples

```bash
# Basic approval
aitrackdown pr approve PR-001

# Approval with auto-merge
aitrackdown pr approve PR-001 \
  --auto-merge \
  --merge-strategy squash \
  --comments "Approved for auto-merge"

# Conditional approval
aitrackdown pr approve PR-001 \
  --conditional \
  --comments "Approved pending documentation updates"
```

### `aitrackdown pr merge`

Merge approved pull requests with customizable strategies.

#### Basic Syntax
```bash
aitrackdown pr merge <pr-id> [options]
```

#### Merge Options
- `--strategy <strategy>` - Merge strategy (merge|squash|rebase)
- `--close-linked-tasks` - Auto-close linked tasks
- `--delete-source-branch` - Delete source branch after merge
- `--update-milestone` - Update milestone progress

#### Safety Options
- `--require-approval` - Require approval before merge
- `--run-pre-merge-checks` - Run pre-merge validation
- `--auto-archive` - Archive related files

#### Examples

```bash
# Default merge
aitrackdown pr merge PR-001

# Squash merge with cleanup
aitrackdown pr merge PR-001 \
  --strategy squash \
  --close-linked-tasks \
  --delete-source-branch

# Safe merge with checks
aitrackdown pr merge PR-001 \
  --require-approval \
  --run-pre-merge-checks \
  --strategy merge
```

### `aitrackdown pr close`

Close pull requests without merging.

#### Basic Syntax
```bash
aitrackdown pr close <pr-id> [options]
```

#### Close Options
- `--reason <reason>` - Close reason (cancelled|superseded|rejected|duplicate|stale|other)
- `--comments <text>` - Close comments
- `--update-linked-tasks` - Update linked task status
- `--archive-files` - Archive PR files
- `--delete-source-branch` - Delete source branch

#### Examples

```bash
# Close with reason
aitrackdown pr close PR-001 \
  --reason cancelled \
  --comments "Requirements changed"

# Close and clean up
aitrackdown pr close PR-001 \
  --reason superseded \
  --update-linked-tasks \
  --archive-files
```

## Advanced Features

### Batch Operations

#### `aitrackdown pr batch`

Perform bulk operations on multiple PRs.

```bash
# Batch approve open PRs
aitrackdown pr batch \
  --operation approve \
  --filter status:open \
  --filter assignee:@developer

# Batch merge approved PRs
aitrackdown pr batch \
  --operation merge \
  --filter status:approved \
  --merge-strategy squash

# Batch close stale PRs
aitrackdown pr batch \
  --operation close \
  --filter created-before:2024-01-01 \
  --reason stale
```

### Dependencies and Relationships

#### `aitrackdown pr dependencies`

Manage PR dependencies and relationships.

```bash
# Show PR dependencies
aitrackdown pr dependencies PR-001

# Add dependency
aitrackdown pr dependencies PR-001 \
  --add-dependency PR-002

# Validate dependency chain
aitrackdown pr dependencies \
  --validate-chain \
  --start-from PR-001
```

### Synchronization

#### `aitrackdown pr sync`

Synchronize PRs with external systems.

```bash
# Sync with GitHub
aitrackdown pr sync \
  --github \
  --repo owner/repo \
  --token $GITHUB_TOKEN

# Sync specific PR
aitrackdown pr sync PR-001 \
  --github \
  --update-status
```

### Archive Management

#### `aitrackdown pr archive`

Archive old or completed PRs.

```bash
# Archive merged PRs older than 6 months
aitrackdown pr archive \
  --status merged \
  --older-than 6months

# Archive to external storage
aitrackdown pr archive \
  --compress \
  --destination /archive/prs/
```

## Workflow Examples

### Basic Development Workflow

```bash
# 1. Create PR from completed task
aitrackdown pr create \
  --title "Implement user registration" \
  --issue ISSUE-001 \
  --from-tasks TASK-001,TASK-002

# 2. Update PR for review
aitrackdown pr update PR-001 --status review

# 3. Add reviewers
aitrackdown pr update PR-001 \
  --add-reviewer @senior-dev \
  --add-reviewer @security-team

# 4. Review process
aitrackdown pr review PR-001 \
  --approve \
  --comments "Code looks good, tests pass"

# 5. Final approval
aitrackdown pr approve PR-001 \
  --auto-merge \
  --merge-strategy squash

# 6. Merge (or auto-merged)
aitrackdown pr merge PR-001 --close-linked-tasks
```

### Feature Branch Workflow

```bash
# 1. Create feature PR
aitrackdown pr create \
  --title "Add payment processing" \
  --issue ISSUE-100 \
  --branch-name feature/payment-processing \
  --target-branch develop \
  --template full

# 2. Track progress
aitrackdown pr update PR-001 \
  --add-tag in-progress \
  --estimated-tokens 1000

# 3. Request review when ready
aitrackdown pr update PR-001 \
  --status review \
  --remove-tag in-progress \
  --add-tag ready-for-review

# 4. Security review
aitrackdown pr review PR-001 \
  --template security \
  --approve \
  --comments "Security review passed"

# 5. Final merge to develop
aitrackdown pr merge PR-001 \
  --strategy merge \
  --close-linked-tasks
```

### Hotfix Workflow

```bash
# 1. Create urgent hotfix PR
aitrackdown pr create \
  --title "Fix critical authentication bug" \
  --issue ISSUE-CRITICAL \
  --priority critical \
  --branch-name hotfix/auth-bug \
  --target-branch main \
  --template quick

# 2. Fast-track review
aitrackdown pr review PR-001 \
  --approve \
  --comments "Hotfix verified, deploying immediately"

# 3. Emergency merge
aitrackdown pr merge PR-001 \
  --strategy merge \
  --bypass-checks \
  --close-linked-tasks
```

## Performance & Best Practices

### Performance Targets

The AI Trackdown PR system is optimized for high performance:

- **PR Creation**: < 200ms
- **PR Listing**: < 100ms  
- **PR Details**: < 50ms
- **Batch Operations**: < 1s per 10 PRs
- **Memory Usage**: < 50MB for large repositories

### Best Practices

#### 1. Efficient PR Management

```bash
# Use filters to reduce data processing
aitrackdown pr list --status open --limit 20

# Use JSON format for scripting
aitrackdown pr list --format json | jq '.[] | select(.priority == "high")'

# Batch operations for bulk changes
aitrackdown pr batch --operation approve --filter assignee:@team
```

#### 2. Template Usage

```bash
# Use quick template for simple changes
aitrackdown pr create --template quick --title "Fix typo"

# Use full template for feature work
aitrackdown pr create --template full --title "Add new feature"
```

#### 3. Review Efficiency

```bash
# Use review templates
aitrackdown pr review PR-001 --template security --approve

# Batch approve related PRs
aitrackdown pr batch --operation approve --filter epic:EP-001
```

#### 4. Memory Management

```bash
# Archive old PRs regularly
aitrackdown pr archive --status merged --older-than 3months

# Use dry-run for testing
aitrackdown pr batch --operation merge --dry-run
```

### Monitoring Performance

```bash
# Run performance benchmark
npm run benchmark

# Check detailed performance report
npm run benchmark:report
```

## Troubleshooting

### Common Issues

#### 1. PR Not Found

```bash
# Check PR exists
aitrackdown pr list | grep PR-001

# Check all statuses
aitrackdown pr list --status merged,closed | grep PR-001
```

#### 2. Permission Errors

```bash
# Check directory permissions
ls -la prs/

# Reinitialize if needed
aitrackdown init --force
```

#### 3. Template Issues

```bash
# Validate templates exist
ls -la templates/

# Create missing templates
aitrackdown init --create-templates
```

#### 4. Performance Issues

```bash
# Run diagnostic
npm run benchmark

# Check large files
find prs/ -size +1M -type f

# Archive old data
aitrackdown pr archive --older-than 6months
```

### Error Messages

#### "PR not found"
- Verify PR ID is correct
- Check if PR is in different status directory
- Use `aitrackdown pr list` to find correct ID

#### "Invalid status transition"
- Check current PR status with `aitrackdown pr show`
- Review valid transitions in documentation
- Use `--force` flag if absolutely necessary

#### "Template not found"
- Verify template files exist in `templates/` directory
- Run `aitrackdown init --create-templates`
- Check template name spelling

#### "Insufficient permissions"
- Check file/directory permissions
- Ensure write access to PR directories
- Run with appropriate user permissions

### Getting Help

```bash
# General PR help
aitrackdown pr --help

# Specific command help
aitrackdown pr create --help
aitrackdown pr review --help

# Show examples
aitrackdown pr create --examples
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=aitrackdown:* aitrackdown pr list

# Verbose output
aitrackdown pr show PR-001 --verbose

# Dry run for testing
aitrackdown pr merge PR-001 --dry-run
```

---

## Summary

The AI Trackdown PR system provides a comprehensive, file-based pull request management solution that operates independently of external platforms while maintaining integration capabilities. With optimized performance, structured workflows, and agent-friendly features, it enables efficient PR lifecycle management for any development team or AI-driven project.

For additional help or advanced usage, refer to the CLI help system or check the latest documentation at the project repository.

**Last Updated**: Phase 4 Implementation (2025-07-08)  
**Version**: 1.0.1