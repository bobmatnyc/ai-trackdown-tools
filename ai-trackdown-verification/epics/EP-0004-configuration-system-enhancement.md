---
epic_id: EP-0004
title: Configuration System Enhancement
description: Fix directory structure implementation to use configurable root directory with proper defaults and CLI configuration options
status: active
priority: critical
assignee: Engineer Agent
created_date: 2025-07-08T00:00:00.000Z
updated_date: 2025-07-08T02:30:00.000Z
estimated_tokens: 800
actual_tokens: 0
ai_context:
  - configuration
  - directory-structure
  - path-resolution
  - backward-compatibility
  - critical-bug-fix
related_issues:
  - ISS-0008
  - ISS-0009
  - ISS-0010
sync_status: local
tags:
  - critical
  - configuration
  - bug-fix
  - directory
milestone: v1.0.0
original_ticket: ATT-002-CONFIGURABLE-DIRECTORY-ROOT.md
---

# Epic: Configuration System Enhancement

## 🚨 Critical Issue Overview
**Current Implementation Error**: CLI hardcodes "trackdown/" directory structure instead of using configurable root directory.

**Expected Behavior**: Should default to "tasks/" directory but be configurable via CLI options and configuration files.

## Original Scope (ATT-002)
**Story Points**: 8 total  
**Priority**: CRITICAL BUG - READY FOR DEVELOPMENT

## Problem Statement
- All commands hardcode `trackdown/` directory paths
- No configuration option to change root directory
- Inconsistent with expected "tasks/" default directory
- No CLI option to override directory location

## Required Solution
- Change default from `trackdown/` to `tasks/`
- Add CLI configuration option for root directory
- Update all commands to use configurable paths
- Maintain backward compatibility during transition

## Objectives
- [ ] Implement PathResolver service for configurable directory resolution
- [ ] Add global CLI options --root-dir and --tasks-dir
- [ ] Add environment variable support AITRACKDOWN_ROOT_DIR
- [ ] Update ConfigManager to handle directory configuration
- [ ] Update all commands to use PathResolver instead of hardcoded paths
- [ ] Add migration detection for existing "trackdown/" directories
- [ ] Implement optional migration from "trackdown/" to "tasks/"

## Configuration Priority
1. CLI option override (--root-dir)
2. Environment variable (AITRACKDOWN_ROOT_DIR)
3. Config file setting (.ai-trackdown/config.yaml)
4. Default to "tasks/"

## Success Criteria
- **Default Directory**: CLI uses "tasks/" as default root directory
- **CLI Configuration**: `--root-dir` option works across all commands
- **Environment Override**: `AITRACKDOWN_ROOT_DIR` properly sets directory
- **Config File**: .ai-trackdown/config.yaml `rootDirectory` setting works
- **Backward Compatibility**: Existing "trackdown/" projects continue working
- **Path Consistency**: All commands use same directory resolution logic

## Related Issues
- ISS-0008: Core Implementation - PathResolver Service
- ISS-0009: Command Updates - Integrate PathResolver
- ISS-0010: Migration & Polish - Handle Legacy Projects

## Migration Considerations
- Detect existing "trackdown/" directories
- Offer migration to "tasks/" with user confirmation  
- Maintain backward compatibility during transition period
- Clear migration documentation and examples

## Notes
This is a fundamental error affecting all CLI functionality. The hardcoded "trackdown/" directory is inconsistent with expected behavior and lacks configurability needed for enterprise use.