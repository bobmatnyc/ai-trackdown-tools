# AI Trackdown CLI v2.0.0

A professional CLI tool for AI-first project management with hierarchical Epic→Issue→Task workflows, comprehensive Pull Request management, token tracking, and YAML frontmatter support.

## Features

✅ **AI-First Design**: Built for AI collaboration with context generation and token tracking  
✅ **Hierarchical Structure**: Epic → Issue → Task relationships with YAML frontmatter  
✅ **Complete PR Management**: 12 comprehensive PR commands with GitHub-independent workflows  
✅ **Agent-Optimized**: Batch operations and intelligent automation for AI-driven development  
✅ **Token Management**: Comprehensive token tracking and budget alerts  
✅ **AI Context Generation**: Automatic llms.txt generation for AI workflows  
✅ **Template System**: Consistent project templates and initialization  
✅ **Git-Native**: Local file-based storage with git integration  

## Installation

```bash
npm install -g ai-trackdown-tools
```

## Quick Start

```bash
# Initialize a new ai-trackdown project
aitrackdown init --framework ai-trackdown

# Create an epic
aitrackdown epic create "User Authentication System" --priority high

# Create an issue under the epic
aitrackdown issue create "Login Flow Implementation" --epic EP-0001

# Create a task under the issue
aitrackdown task create "JWT Token Validation" --issue ISS-0001

# Check project status
aitrackdown status

# Generate AI context file
aitrackdown ai generate-llms-txt
```

## AI-First Workflow

The CLI supports comprehensive AI development workflows:

```bash
# Epic Management
aitrackdown epic list --status active --show-progress
aitrackdown epic complete EP-0001 --actual-tokens 1500

# Issue Management  
aitrackdown issue assign ISS-0001 developer
aitrackdown issue complete ISS-0001 --auto-complete-tasks

# Task Management with Token Tracking
aitrackdown task complete TSK-0001 --tokens 250
aitrackdown task list --show-time --issue ISS-0001

# AI Features
aitrackdown ai track-tokens --report --format table
aitrackdown ai context --item-id EP-0001 --add "requirements context"
```

## Pull Request Management

Version 2.0.0 introduces comprehensive PR management with 12 powerful commands:

```bash
# Create PR from completed tasks
aitrackdown pr create "Implement user authentication" --issue ISS-0001 --from-tasks TSK-0001,TSK-0002

# List and filter PRs
aitrackdown pr list --status open --assignee @developer --priority high
aitrackdown pr list --format table --show-stats

# Review and approve PRs
aitrackdown pr review PR-0001 --approve --comments "LGTM! Great implementation"
aitrackdown pr approve PR-0001 --auto-merge --merge-strategy squash

# Batch operations for multiple PRs
aitrackdown pr batch --operation approve --filter status:open --filter assignee:@team
aitrackdown pr batch --operation merge --filter status:approved --merge-strategy squash

# Advanced PR management
aitrackdown pr dependencies PR-0001 --add-dependency PR-0002
aitrackdown pr sync --github --repo owner/repo --update-status
aitrackdown pr archive --status merged --older-than 6months
```

### PR Features

- **GitHub-Independent**: Complete PR lifecycle without external dependencies
- **File-based Storage**: PRs stored as markdown files with YAML frontmatter
- **Status-based Organization**: Automatic file movement (draft → open → review → approved → merged)
- **Template Integration**: Full and quick PR templates with variable substitution
- **Batch Operations**: Efficient bulk operations for agent-driven workflows
- **Review System**: Structured reviews with approval tracking
- **Performance Optimized**: 60-70ms average response times

## Project Structure

ai-trackdown creates a hierarchical project structure:

```
project/
├── .ai-trackdown/
│   ├── config.yaml              # Project configuration
│   ├── templates/               # YAML frontmatter templates
│   └── cache/                   # Local cache files
├── epics/
│   └── EP-0001-feature-name.md  # Epic with YAML frontmatter
├── issues/
│   └── ISS-0001-issue-name.md   # Issues linked to epics
├── tasks/
│   └── TSK-0001-task-name.md    # Tasks linked to issues
├── prs/                         # Pull Request management (v2.0.0)
│   ├── draft/                   # Draft PRs
│   ├── active/
│   │   ├── open/                # Open PRs ready for review
│   │   ├── review/              # PRs under review
│   │   └── approved/            # Approved PRs ready to merge
│   ├── merged/                  # Successfully merged PRs
│   ├── closed/                  # Closed/rejected PRs
│   ├── reviews/                 # PR review files
│   └── logs/                    # Operation logs
├── templates/
│   ├── pr-review-default.yaml   # Default PR review template
│   ├── pr-review-quick.yaml     # Quick PR review template
│   └── pr-review-security.yaml  # Security PR review template
└── llms.txt                     # Generated AI context
```

## YAML Frontmatter

All items use structured YAML frontmatter for metadata:

```yaml
---
epic_id: EP-0001
title: User Authentication System
status: active
priority: high
assignee: developer
estimated_tokens: 2000
actual_tokens: 1500
ai_context: [authentication, security, user-management]
related_issues: [ISS-0001, ISS-0002]
---

# Epic Description
Comprehensive user authentication system with JWT tokens...
```

## Migration from Legacy Systems

Convert existing projects to ai-trackdown format:

```bash
# Migrate from old trackdown structure
aitrackdown migrate --from-trackdown ./old-project

# Import from various formats
aitrackdown migrate --from-json project-data.json
aitrackdown migrate --from-csv tasks.csv
```

## Command Reference

### Epic Commands
- `epic create` - Create new epic with YAML frontmatter
- `epic list` - List epics with filtering and progress
- `epic show` - Show detailed epic with relationships
- `epic update` - Update epic fields and metadata
- `epic complete` - Mark epic complete with token tracking

### Issue Commands  
- `issue create` - Create issue linked to epic
- `issue assign` - Assign issue to team member
- `issue complete` - Complete issue with auto-task completion
- `issue list` - List issues with filtering
- `issue show` - Show detailed issue information

### Task Commands
- `task create` - Create task linked to issue
- `task complete` - Complete task with time/token tracking
- `task list` - List tasks with time tracking display
- `task update` - Update task status and metadata

### Pull Request Commands (v2.0.0)
- `pr create` - Create PR from templates with auto-linking
- `pr list` - List PRs with advanced filtering
- `pr show` - Show detailed PR with relationships
- `pr update` - Update PR properties and metadata
- `pr review` - Create structured PR reviews
- `pr approve` - Approve PR with optional auto-merge
- `pr merge` - Merge PR with strategy selection
- `pr close` - Close PR without merging
- `pr batch` - Perform bulk operations on multiple PRs
- `pr dependencies` - Manage PR dependencies
- `pr sync` - Synchronize with external systems
- `pr archive` - Archive old PRs with compression

### AI Commands
- `ai generate-llms-txt` - Generate AI context file
- `ai track-tokens` - Track and report token usage
- `ai context` - Manage AI context for items

### Project Commands
- `init` - Initialize new ai-trackdown project
- `status` - Show project overview with metrics
- `export` - Export project data in various formats

