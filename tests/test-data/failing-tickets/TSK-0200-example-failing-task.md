---
task_id: TSK-0200
issue_id: ISS-0075
title: Example failing task format
description: Task that belongs to an issue without epic_id
status: planning
priority: medium
assignee: developer
created_date: 2025-07-13T20:00:00.000Z
updated_date: 2025-07-13T20:00:00.000Z
estimated_tokens: 80
actual_tokens: 0
ai_context: []
sync_status: local
time_estimate: "3h"
completion_percentage: 0
blocked_by: []
blocks: []
---

# Task: Example failing task format

This task is associated with ISS-0075 which doesn't have an epic_id.

## Current Problem
The parser currently requires task_id, issue_id, AND epic_id on lines 78-80 of parseTask() method.

## Expected Behavior After Fix
This task should parse successfully with only task_id and issue_id present.