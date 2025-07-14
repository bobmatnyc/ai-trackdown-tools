---
issue_id: ISS-LEGACY-001
epic_id: EP-LEGACY-001
title: Legacy Issue Before Migration
description: Example of issue using old status field only
status: active
priority: medium
assignee: developer-team
created_date: 2025-07-01T10:00:00Z
updated_date: 2025-07-10T15:30:00Z
estimated_tokens: 300
actual_tokens: 150
ai_context:
  - legacy-system
  - migration-example
related_tasks:
  - TSK-LEGACY-001
sync_status: local
tags:
  - legacy
  - before-migration
dependencies: []
---

# Issue: Legacy Issue Before Migration

## Description
This is an example of a legacy issue that only uses the old `status` field. It represents tickets created before the unified state management system was implemented.

## Legacy Status Information
- **Current Status**: active
- **Status History**: planning → active (no detailed metadata)
- **No State Metadata**: Legacy issues lack rich transition information

## Tasks
- TSK-LEGACY-001: Legacy task implementation

## Acceptance Criteria
- [ ] Implement core functionality
- [ ] Add basic tests
- [ ] Update documentation

## Migration Notes
This issue will be migrated to the new state management system:
- `status: active` will map to `state: active` 
- State metadata will be generated based on available information
- Legacy status field will be preserved for backward compatibility

## Current Limitations
- No detailed transition history
- No automation eligibility information
- No reviewer or approval tracking
- No transition reasons recorded
- Basic audit trail only

## After Migration Benefits
- Rich state metadata with timestamps
- Detailed transition history
- Automation eligibility tracking
- Reviewer and approval workflow support
- Enhanced audit capabilities
- CI/CD integration support

## Notes
This issue demonstrates the typical structure and limitations of legacy tickets before state management enhancement.