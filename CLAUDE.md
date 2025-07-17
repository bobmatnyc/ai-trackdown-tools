# AI Trackdown Tools - Claude Instructions

## Project Overview
AI Trackdown Tools is a CLI-based issue tracking and project management system.

## Critical Instructions for AI Assistant

### 📋 MANDATORY: Data Structure Reference

**ALWAYS consult SCHEMA.md when working with data structures or making data-related changes.**

The SCHEMA.md file contains the authoritative definitions for all data types including:
- Issues
- Epics
- Comments
- Relationships
- Index structures

**NEVER modify data structures without first reviewing SCHEMA.md.**

### 🎯 MANDATORY: Ticket Operations

**ALWAYS use the `aitrackdown` CLI for ALL ticket operations. NEVER create or modify ticket files directly.**

#### Available Commands:

**Issue Management:**
```bash
# Create a new issue
aitrackdown issue create --title "Title" --description "Description" [--epic EPIC-ID] [--labels "label1,label2"] [--priority high|medium|low] [--project /path/to/project]

# List issues
aitrackdown issue list [--status planning|in-progress|completed] [--epic EPIC-ID]

# Update issue
aitrackdown issue update ISS-XXX --status in-progress|completed [--title "New Title"] [--description "New Description"]

# Close issue
aitrackdown issue close ISS-XXX [--reason "Reason for closing"]

# Search issues
aitrackdown issue search "search terms" [--status STATUS] [--epic EPIC-ID]

# Show issue details
aitrackdown issue show ISS-XXX

# Complete issue (mark as done)
aitrackdown issue complete ISS-XXX [--notes "Completion notes"]
```

**Epic Management:**
```bash
# Create epic
aitrackdown epic create --title "Epic Title" --description "Epic Description" [--labels "label1,label2"]

# List epics
aitrackdown epic list [--status planning|in-progress|completed]

# Update epic
aitrackdown epic update EPIC-XXX --status in-progress|completed [--title "New Title"]

# Show epic details
aitrackdown epic show EPIC-XXX

# Complete epic
aitrackdown epic complete EPIC-XXX [--notes "Completion notes"]
```

**Comment Management:**
```bash
# Add comment to issue
aitrackdown comment add ISS-XXX --body "Comment text" [--project /path/to/project]

# List comments for an issue
aitrackdown comment list ISS-XXX [--sort created|updated] [--direction asc|desc]

# Update comment
aitrackdown comment update ISS-XXX COMMENT-ID --body "Updated comment text"

# Delete comment
aitrackdown comment delete ISS-XXX COMMENT-ID [--confirm]

# Move comment to another issue
aitrackdown comment move ISS-XXX COMMENT-ID --to ISS-YYY
```

**Backlog Management:**
```bash
# View enhanced backlog with relationship visualization
aitrackdown backlog-enhanced
```

### 🚨 IMPORTANT: Cross-Project Operations

When working in one project but needing to create tickets in another project, use the `--project` flag:

```bash
# Create ticket in a different project
aitrackdown issue create --project ~/Projects/claude-multiagent-pm --title "Title" --description "Description"

# The --project flag accepts full paths to other projects
```

### 🔧 AI Context Commands

```bash
# Generate context for AI assistants
aitrackdown ai context [--epic EPIC-ID] [--status STATUS]

# Generate llms.txt file
aitrackdown ai generate-llms-txt
```

### ❌ FORBIDDEN ACTIONS

1. **NEVER** directly create or edit files in `tasks/issues/` or `tasks/epics/` directories
2. **NEVER** manually generate issue or epic IDs
3. **NEVER** modify the `.trackdown/` index files directly
4. **ALWAYS** use the CLI commands for all ticket operations

### 📋 Best Practices

1. Always use the CLI to ensure proper ID generation and index updates
2. Use descriptive titles and detailed descriptions
3. Apply appropriate labels for categorization
4. Link issues to epics when they're part of a larger initiative
5. Use the `--project` flag when creating tickets in other projects

### 🎯 Common Workflows

**Creating a bug report:**
```bash
aitrackdown issue create --title "Fix: Component rendering issue" --description "Detailed description..." --labels "bug,ui" --priority high
```

**Creating a feature request in another project:**
```bash
aitrackdown issue create --project ~/Projects/other-project --title "Feature: Add dark mode" --description "..." --labels "feature,enhancement"
```

**Updating issue status:**
```bash
aitrackdown issue update ISS-123 --status in-progress
```

**Completing an issue:**
```bash
aitrackdown issue complete ISS-123 --notes "Fixed by implementing XYZ solution"
```

## Project Structure

- `tasks/issues/` - Issue tracking files (DO NOT MODIFY DIRECTLY)
- `tasks/epics/` - Epic tracking files (DO NOT MODIFY DIRECTLY)
- `.trackdown/` - Index and state files (DO NOT MODIFY DIRECTLY)
- `src/` - Source code for the CLI tool
- `dist/` - Compiled JavaScript output

## Remember

The `aitrackdown` CLI is the ONLY approved method for interacting with tickets. This ensures data integrity, proper ID generation, and index synchronization.