# AI Trackdown Tools - Data Schema Documentation

This document defines the authoritative data structures for the AI Trackdown Tools system.

## Core Data Types

### Issue

```typescript
interface Issue {
  id: string;              // Format: ISS-XXXX (e.g., ISS-0001)
  epicId?: string;         // Format: EP-XXXX (optional)
  title: string;
  description: string;
  status: 'planning' | 'in-progress' | 'completed' | 'closed';
  priority: 'low' | 'medium' | 'high';
  labels: string[];
  assignee?: string;
  createdAt: string;       // ISO 8601 date
  updatedAt: string;       // ISO 8601 date
  closedAt?: string;       // ISO 8601 date (when closed)
  completedAt?: string;    // ISO 8601 date (when completed)
  metadata?: {
    createdBy?: string;
    lastModifiedBy?: string;
    version?: number;
  };
}
```

### Epic

```typescript
interface Epic {
  id: string;              // Format: EP-XXXX (e.g., EP-0001)
  title: string;
  description: string;
  status: 'planning' | 'in-progress' | 'completed' | 'closed';
  labels: string[];
  createdAt: string;       // ISO 8601 date
  updatedAt: string;       // ISO 8601 date
  closedAt?: string;       // ISO 8601 date (when closed)
  completedAt?: string;    // ISO 8601 date (when completed)
  metadata?: {
    createdBy?: string;
    lastModifiedBy?: string;
    version?: number;
  };
}
```

### Comment

```typescript
interface Comment {
  id: string;              // Format: COMMENT-XXXX (e.g., COMMENT-0001)
  issueId: string;         // The issue this comment belongs to
  body: string;            // Comment content (supports markdown)
  author: string;          // Username or identifier
  createdAt: string;       // ISO 8601 date
  updatedAt: string;       // ISO 8601 date
  editedAt?: string;       // ISO 8601 date (when last edited)
  metadata?: {
    edited?: boolean;      // True if comment has been edited
    editorUsed?: string;   // 'cli' | 'editor' | 'api'
    attachments?: string[]; // File paths or URLs
    reactions?: {
      [key: string]: string[]; // e.g., { "+1": ["user1", "user2"], "heart": ["user3"] }
    };
  };
}
```

### Relationship

```typescript
interface Relationship {
  id: string;              // Format: REL-XXXX
  type: 'blocks' | 'blocked-by' | 'relates-to' | 'duplicates' | 'parent-of' | 'child-of';
  sourceId: string;        // ID of the source issue/epic
  targetId: string;        // ID of the target issue/epic
  createdAt: string;       // ISO 8601 date
  metadata?: {
    createdBy?: string;
    reason?: string;
  };
}
```

## Index Structures

### Main Index

```typescript
interface TrackdownIndex {
  version: string;         // Index schema version
  lastUpdated: string;     // ISO 8601 date
  issues: {
    [id: string]: {
      path: string;        // Relative path to issue file
      lastModified: string; // ISO 8601 date
    };
  };
  epics: {
    [id: string]: {
      path: string;        // Relative path to epic file
      lastModified: string; // ISO 8601 date
    };
  };
  comments: {
    [issueId: string]: {
      [commentId: string]: {
        path: string;      // Relative path to comment file
        lastModified: string; // ISO 8601 date
      };
    };
  };
  relationships: {
    [id: string]: Relationship;
  };
}
```

### ID Tracker

```typescript
interface IdTracker {
  lastIssueId: number;     // Last used issue number
  lastEpicId: number;      // Last used epic number
  lastCommentId: number;   // Last used comment number
  lastRelationshipId: number; // Last used relationship number
}
```

## File Structure

### Issues
- Location: `tasks/issues/`
- Filename: `ISS-XXXX-<slugified-title>.md`
- Format: Markdown with YAML frontmatter

### Epics
- Location: `tasks/epics/`
- Filename: `EP-XXXX-<slugified-title>.md`
- Format: Markdown with YAML frontmatter

### Comments
- Location: `tasks/issues/comments/ISS-XXXX/`
- Filename: `COMMENT-XXXX.md`
- Format: Markdown with YAML frontmatter

### Index Files
- Main index: `.trackdown/index.json`
- ID tracker: `.trackdown/id-tracker.json`
- Relationships: `.trackdown/relationships.json`

## Data Validation Rules

### ID Formats
- Issues: `ISS-` followed by 4-digit zero-padded number
- Epics: `EP-` followed by 4-digit zero-padded number
- Comments: `COMMENT-` followed by 4-digit zero-padded number
- Relationships: `REL-` followed by 4-digit zero-padded number

### Status Transitions
- `planning` → `in-progress` → `completed`
- Any status can transition to `closed`
- Closed items cannot transition to other statuses

### Required Fields
- All entities must have: `id`, `createdAt`, `updatedAt`
- Issues must have: `title`, `description`, `status`, `priority`
- Epics must have: `title`, `description`, `status`
- Comments must have: `issueId`, `body`, `author`

### Date Formats
- All dates must be in ISO 8601 format
- Timezone should be included when available
- Example: `2024-01-15T10:30:00-05:00`

## Markdown File Format

### Issue/Epic File Format
```markdown
---
id: ISS-0001
title: Issue Title
status: planning
priority: high
labels: [bug, urgent]
epicId: EP-0001
assignee: username
createdAt: 2024-01-15T10:30:00-05:00
updatedAt: 2024-01-15T10:30:00-05:00
---

# Issue Title

## Description
Detailed description of the issue...

## Acceptance Criteria
- [ ] Criteria 1
- [ ] Criteria 2

## Notes
Additional notes...
```

### Comment File Format
```markdown
---
id: COMMENT-0001
issueId: ISS-0001
author: username
createdAt: 2024-01-15T10:30:00-05:00
updatedAt: 2024-01-15T10:30:00-05:00
---

Comment body text here...
```

## API Compatibility

The schema is designed to be compatible with GitHub's issue tracking system where applicable, allowing for potential future integration or migration.

## Relationship Management

### How Relationships Work

1. **Hierarchical Structure**:
   - Epics are top-level containers
   - Issues belong to Epics (via `epicId` in frontmatter)
   - Tasks belong to Issues (via `issueId` in frontmatter)
   - Comments belong to Issues (via `issueId` in frontmatter and directory structure)

2. **Relationship Storage**:
   - Parent-child relationships are stored in YAML frontmatter ONLY
   - No parent IDs should be duplicated in the ticket body content
   - This ensures a single source of truth and prevents inconsistencies

3. **Comment Organization**:
   - Comments use simple `COMMENT-XXXX` IDs
   - Parent relationship is defined by:
     - Directory structure: `tasks/issues/comments/ISS-XXXX/`
     - Frontmatter field: `issueId: ISS-XXXX`
   - This keeps IDs short while maintaining clear relationships

4. **Dependency Tracking**:
   - Items can have `dependencies`, `blocked_by`, and `blocks` arrays in frontmatter
   - These reference other item IDs to create cross-cutting relationships
   - The RelationshipManager validates these to prevent circular dependencies

## Version History

- v1.0.0 - Initial schema definition with Issues, Epics, Comments, and Relationships
- v1.0.1 - Updated Epic ID format from EPIC-XXXX to EP-XXXX to match implementation
- v1.0.2 - Clarified relationship management patterns and best practices