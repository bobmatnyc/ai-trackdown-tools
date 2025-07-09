# Claude PM Framework Directory Detection Fix Report

## Problem Summary
The Claude PM Framework directory detection was finding the wrong installation path, showing `/Users/masa/Clients/claude-multiagent-pm` instead of the correct `/Users/masa/Projects/claude-multiagent-pm`.

## Root Cause Analysis
The framework detection logic in `cmpm-bridge.py` was searching directories in the wrong priority order:
1. **Original Order**: Checked `~/Clients/claude-multiagent-pm` first, then `~/Projects/claude-multiagent-pm`
2. **Issue**: The first match was returned, causing the wrong directory to be selected

## Solution Implemented

### 1. Fixed Framework Discovery Logic
Updated `discover_framework_path()` function in `/Users/masa/.claude/commands/cmpm-bridge.py`:

**New Priority Order:**
1. Environment variable: `CLAUDE_PM_FRAMEWORK_PATH`
2. NPM global package location (with symlink resolution)
3. `~/Projects/claude-multiagent-pm` (preferred source directory)
4. `~/Clients/claude-multiagent-pm` (legacy location)
5. Current working directory paths

### 2. Enhanced NPM Package Detection
Added intelligent NPM package detection:
- Checks `npm root -g` for global package location
- Resolves symlinks to find actual framework location
- Validates framework structure before returning path

### 3. Directory Conflict Resolution
- **Backed up conflicting installation**: Moved `/Users/masa/Clients/claude-multiagent-pm` to `/Users/masa/Clients/claude-multiagent-pm-backup-20250709_120521`
- **Verified NPM package**: Confirmed global package correctly symlinks to `/Users/masa/Projects/claude-multiagent-pm`

### 4. Updated Error Messages
Improved error messages to reflect new priority order and include NPM installation guidance.

## Verification Results

### Before Fix
```
Framework Location: /Users/masa/Clients/claude-multiagent-pm
```

### After Fix
```
Framework Location: /Users/masa/Projects/claude-multiagent-pm
```

### Commands Tested
- ✅ `python ~/.claude/commands/cmpm-bridge.py health` - Shows correct framework location
- ✅ `python ~/.claude/commands/cmpm-bridge.py agents` - Works with correct path
- ✅ NPM package resolution - Correctly resolves symlink to Projects directory

## Framework Directory Structure
The correct framework installation is now prioritized:
- **Source Directory**: `/Users/masa/Projects/claude-multiagent-pm` (Git repository)
- **NPM Package**: Symlinked to source directory
- **Backup**: Legacy installation safely backed up

## Technical Details

### Key Changes Made
1. **Priority Reordering**: Projects directory now checked before Clients
2. **NPM Integration**: Added subprocess call to `npm root -g` for package detection
3. **Symlink Resolution**: Properly resolves NPM symlinks to actual framework path
4. **Conflict Cleanup**: Safely removed conflicting installation

### Framework Detection Flow
```python
def discover_framework_path():
    # 1. Check environment variable
    # 2. Check NPM global package (with symlink resolution)
    # 3. Check ~/Projects/claude-multiagent-pm (preferred)
    # 4. Check ~/Clients/claude-multiagent-pm (legacy)
    # 5. Check current working directory
```

## Future Recommendations
1. **Environment Variable**: Consider setting `CLAUDE_PM_FRAMEWORK_PATH` for explicit control
2. **NPM Installation**: Use `npm install -g @bobmatnyc/claude-multiagent-pm` for consistent deployment
3. **Single Source**: Maintain only one authoritative framework installation per machine

## Status
✅ **COMPLETED** - Framework directory detection now correctly identifies `/Users/masa/Projects/claude-multiagent-pm` as the authoritative installation.

---
*Fix implemented by Engineer Agent - Framework Deployment Specialist*  
*Date: 2025-07-09*