# AI-Trackdown Migration Guide

## Overview

This guide helps you migrate from legacy trackdown to the new AI-Trackdown architecture (ATT-003 Complete Redesign).

## What's Changed

### ✅ Removed Dependencies
- **GitHub API Integration**: All GitHub API dependencies removed
- **Legacy Commands**: `label`, `milestone`, `project`, `bulk` commands deprecated
- **External APIs**: Self-contained local file system only

### ✅ New Architecture
- **Hierarchical Structure**: Epic → Issue → Task hierarchy
- **YAML Frontmatter**: Structured metadata in markdown files
- **Local File System**: No external dependencies
- **AI Integration**: Token tracking and context management

### ✅ Migration Tooling
- **Automatic Migration**: Convert `.trackdownrc.json` to `.ai-trackdown/config.yaml`
- **File Structure**: Migrate `active/completed/` to `epics/issues/tasks/`
- **Frontmatter Addition**: Add YAML metadata to existing files

## Migration Process

### Step 1: Backup Your Data
```bash
# Create backup before migration
aitrackdown migrate --backup --dry-run
```

### Step 2: Preview Migration
```bash
# See what will be migrated without making changes
aitrackdown migrate --dry-run --verbose
```

### Step 3: Run Migration
```bash
# Perform actual migration
aitrackdown migrate --verbose
```

### Step 4: Verify Migration
```bash
# Check new structure
aitrackdown status --verbose
```

## New Directory Structure

### Before (Legacy)
```
project/
├── .trackdownrc.json
├── active/
│   ├── feature-login.md
│   └── bug-auth.md
└── completed/
    └── setup-project.md
```

### After (AI-Trackdown)
```
project/
├── .ai-trackdown/
│   ├── config.yaml
│   ├── epics/
│   │   └── EP-0001.md
│   ├── issues/
│   │   ├── ISS-0001.md
│   │   └── ISS-0002.md
│   └── tasks/
│       ├── TSK-0001.md
│       └── TSK-0002.md
└── active-legacy/        # Archived legacy files
    └── completed-legacy/
```

## New File Format

### Epic File Example
```yaml
---
epic_id: EP-0001
title: User Authentication System
status: in_progress
priority: high
assignee: john.doe
labels:
  - authentication
  - security
story_points: 13
completion_percentage: 45
created_date: 2025-01-15T10:00:00Z
updated_date: 2025-01-20T14:30:00Z
estimated_completion: 2025-02-01
---

# User Authentication System

Implement comprehensive user authentication including login, registration, and password reset functionality.

## Requirements
- Secure password hashing
- JWT token management
- Multi-factor authentication support
```

### Issue File Example
```yaml
---
issue_id: ISS-0001
epic_id: EP-0001
title: Implement login form
status: todo
priority: medium
assignee: jane.smith
labels:
  - ui
  - frontend
story_points: 3
created_date: 2025-01-15T10:30:00Z
updated_date: 2025-01-15T10:30:00Z
---

# Implement Login Form

Create responsive login form with validation and error handling.
```

### Task File Example
```yaml
---
task_id: TSK-0001
issue_id: ISS-0001
epic_id: EP-0001
title: Create login UI components
status: todo
priority: medium
assignee: bob.wilson
labels:
  - react
  - components
estimated_hours: 4
actual_hours: 0
created_date: 2025-01-15T11:00:00Z
updated_date: 2025-01-15T11:00:00Z
---

# Create Login UI Components

Build reusable React components for the login form.
```

## Command Changes

### Deprecated Commands
These commands are deprecated and will be removed:
```bash
# OLD (deprecated)
aitrackdown label create "bug"
aitrackdown milestone create "Sprint 1"
aitrackdown bulk assign --issues "1-10" --assignee john
aitrackdown issue close 123
aitrackdown issue reopen 123
```

### New Commands
Use these commands instead:
```bash
# NEW (ai-trackdown)
aitrackdown epic create "User Authentication"
aitrackdown issue create "Login form" --epic EP-0001
aitrackdown task create "UI components" --issue ISS-0001
aitrackdown issue complete ISS-0001
aitrackdown issue update ISS-0001 --status todo  # instead of reopen
```

### AI-Specific Commands
```bash
# Token tracking
aitrackdown ai track-tokens --report
aitrackdown ai generate-llms-txt --format detailed

# Context management
aitrackdown ai context --item-id EP-0001 --add "docs/requirements.md"
```

## Configuration Changes

### Old Configuration (.trackdownrc.json)
```json
{
  "directory_root": "tasks",
  "github": {
    "owner": "myorg",
    "repo": "myproject",
    "token": "ghp_..."
  },
  "default_assignee": "john.doe",
  "labels": ["bug", "feature"]
}
```

### New Configuration (.ai-trackdown/config.yaml)
```yaml
version: '1.0.0'
directory_root: '.ai-trackdown'
defaults:
  assignee: john.doe
  priority: medium
  status: todo
templates:
  epic: default
  issue: default
  task: default
automation:
  auto_assign_ids: true
  auto_update_dates: true
  auto_track_relationships: true
```

## Migration Troubleshooting

### Common Issues

#### Issue: Migration Command Not Found
```bash
# Update to latest version
npm install -g ai-trackdown-tools@latest
```

#### Issue: YAML Parse Errors
```bash
# Validate configuration
aitrackdown init --validate-config
```

#### Issue: File Permission Errors
```bash
# Fix permissions
chmod -R 755 .ai-trackdown/
```

#### Issue: Missing Dependencies
```bash
# Reinstall dependencies
npm install yaml gray-matter js-yaml
```

### Rollback Process
If migration fails, restore from backup:
```bash
# Restore backup (created with --backup flag)
cp -r backup-2025-01-20T10-30-00/* .
rm -rf .ai-trackdown/
```

## Post-Migration Steps

### 1. Update Scripts
Update any scripts that use deprecated commands:
```bash
# OLD
trackdown issue close $ISSUE_NUMBER

# NEW
aitrackdown issue complete $ISSUE_ID
```

### 2. Update CI/CD
Update build pipelines to use new commands:
```yaml
# .github/workflows/trackdown.yml
- name: Track Progress
  run: aitrackdown status --format json > progress.json
```

### 3. Train Team
- Share new command reference
- Demonstrate hierarchical workflow
- Show AI integration features

## Benefits of New Architecture

### ✅ Self-Contained
- No external API dependencies
- Works offline
- Faster operations

### ✅ Hierarchical Organization
- Clear Epic → Issue → Task relationships
- Better project structure
- Improved progress tracking

### ✅ AI Integration
- Token usage tracking
- Context management
- Automated documentation

### ✅ Enhanced Metadata
- Rich YAML frontmatter
- Structured relationships
- Better filtering and search

## Support

### Documentation
- CLI Help: `aitrackdown --help`
- Command Help: `aitrackdown <command> --help`
- Examples: Each command includes usage examples

### Troubleshooting
- Verbose Mode: Add `--verbose` to any command
- Dry Run: Use `--dry-run` for preview mode
- Validation: Use `--validate` for config checks

### Migration Assistance
If you encounter issues during migration:
1. Run with `--verbose` flag for detailed output
2. Check the migration log for errors
3. Use `--dry-run` to preview changes
4. Restore from backup if needed

## Version Compatibility

- **Minimum Node.js**: 16.0.0
- **TypeScript**: 5.8+
- **Dependencies**: All bundled, no global requirements

## Next Steps

After successful migration:
1. Explore new hierarchical commands
2. Set up AI token tracking
3. Configure team workflows
4. Integrate with CI/CD pipelines

For questions or issues, use:
```bash
aitrackdown --help
aitrackdown migrate --help
```