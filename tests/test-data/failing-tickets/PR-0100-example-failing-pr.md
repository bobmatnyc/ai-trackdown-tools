---
pr_id: PR-0100
issue_id: ISS-0075
title: Example failing PR format
description: Pull request that belongs to an issue without epic_id
status: active
pr_status: draft
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 100
actual_tokens: 0
ai_context: []
sync_status: local
branch_name: fix/optional-epic-id
source_branch: fix/optional-epic-id
target_branch: main
pr_number: 456
reviewers:
  - reviewer1
blocked_by: []
blocks: []
---

# PR: Example failing PR format

This pull request is associated with ISS-0075 which doesn't have an epic_id.

## Current Problem
The parser currently requires pr_id, issue_id, AND epic_id on lines 99-101 of parsePR() method.

## Expected Behavior After Fix
This PR should parse successfully with only pr_id and issue_id present.