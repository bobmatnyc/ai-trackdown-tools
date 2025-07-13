---
issue_id: ISS-0075
title: Example failing ticket format
description: This represents the format of tickets that are currently failing due to missing epic_id
status: active
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 150
actual_tokens: 0
ai_context:
  - context/requirements
sync_status: local
related_tasks: []
related_issues: []
completion_percentage: 0
blocked_by: []
blocks: []
tags:
  - migration
  - standalone
---

# Issue: Example failing ticket format

This ticket represents the format that's currently causing the parser to fail because it has an `issue_id` but no `epic_id` field.

## Description
This issue demonstrates the exact format that needs to be supported after implementing the optional epic_id fix.

## Current Problem
The FrontmatterParser currently requires both `issue_id` AND `epic_id` on lines 57-58 of the parseIssue() method.

## Expected Behavior After Fix
This ticket should parse successfully with only `issue_id` present, treating `epic_id` as optional.