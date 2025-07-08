# ATT-002: Configurable Issue Documents Root Directory

**Project**: ai-trackdown-tools  
**Priority**: HIGH  
**Story Points**: 8  
**Epic**: CLI Foundation Fixes  
**Status**: 🚨 CRITICAL BUG - READY FOR DEVELOPMENT  
**Created**: 2025-07-08  
**Assignee**: Engineer Agent (TBD)

## 🚨 CRITICAL ISSUE

**Current Implementation Error**: CLI hardcodes "trackdown/" directory structure instead of using configurable root directory.

**Expected Behavior**: Should default to "tasks/" directory but be configurable via CLI options and configuration files.

## 🎯 OBJECTIVE

Fix the directory structure implementation to use configurable root directory with proper defaults and CLI configuration options.

## 📋 SCOPE

### **Current Problem**
- All commands hardcode `trackdown/` directory paths
- No configuration option to change root directory
- Inconsistent with expected "tasks/" default directory
- No CLI option to override directory location

### **Required Fix**
- Change default from `trackdown/` to `tasks/`
- Add CLI configuration option for root directory
- Update all commands to use configurable paths
- Maintain backward compatibility during transition

## 🔧 TECHNICAL SPECIFICATIONS

### **Implementation Requirements**

#### **1. Configuration Extension**
```typescript
// src/types/index.ts
interface TrackdownConfig {
  // ... existing properties
  rootDirectory: string; // NEW: configurable root directory
  migrateFromTrackdown?: boolean; // NEW: migration flag
}
```

#### **2. CLI Options**
```bash
# Global option
aitrackdown --root-dir ./custom-tasks init myproject
aitrackdown --tasks-dir ./issues track "New issue"

# Configuration command
aitrackdown config set root-directory ./custom-tasks
aitrackdown config get root-directory
```

#### **3. Environment Variable**
```bash
export AITRACKDOWN_ROOT_DIR=./custom-tasks
export AITRACKDOWN_TASKS_DIR=./issues
```

#### **4. Configuration Files**
```json
// .trackdownrc.json
{
  "rootDirectory": "./tasks",
  "migrateFromTrackdown": true
}
```

### **Directory Structure (New Default)**
```
project-root/
├── tasks/                    # NEW DEFAULT (was trackdown/)
│   ├── active/              # Active issues
│   ├── completed/           # Completed issues  
│   ├── templates/           # Issue templates
│   └── archived/            # Archived issues
└── .trackdownrc.json        # Configuration
```

### **Architecture Changes**

#### **PathResolver Service**
```typescript
// src/utils/path-resolver.ts
export class PathResolver {
  constructor(private config: ConfigManager) {}
  
  getRootDirectory(): string {
    // 1. CLI option override
    // 2. Environment variable
    // 3. Config file setting  
    // 4. Default to "tasks/"
  }
  
  getActiveDir(): string { return join(this.getRootDirectory(), 'active'); }
  getCompletedDir(): string { return join(this.getRootDirectory(), 'completed'); }
  // ... other directory methods
}
```

## 🎯 ACCEPTANCE CRITERIA

### **Phase 1: Core Implementation (5 Story Points)**
- [ ] Add `rootDirectory` property to TrackdownConfig interface
- [ ] Implement PathResolver service for configurable paths
- [ ] Add global CLI option `--root-dir <path>` and `--tasks-dir <path>`
- [ ] Add environment variable support `AITRACKDOWN_ROOT_DIR`
- [ ] Update ConfigManager to handle directory configuration
- [ ] Change default from "trackdown/" to "tasks/"

### **Phase 2: Command Updates (2 Story Points)**
- [ ] Update `init` command to use configurable paths
- [ ] Update `track` command to use PathResolver
- [ ] Update `status` command to use PathResolver  
- [ ] Update `export` command to use PathResolver
- [ ] Update all other commands using hardcoded paths

### **Phase 3: Migration & Polish (1 Story Point)**
- [ ] Add migration detection for existing "trackdown/" directories
- [ ] Implement optional migration from "trackdown/" to "tasks/"
- [ ] Add `config` subcommand for directory management
- [ ] Update documentation and help text
- [ ] Add comprehensive tests for path resolution

## 🚀 IMPLEMENTATION PLAN

### **Week 1: Core Implementation**
```bash
# Day 1-2: PathResolver Service
- Create PathResolver class with configurable directory resolution
- Add TrackdownConfig.rootDirectory property
- Implement priority: CLI option > env var > config file > default

# Day 3-4: CLI Integration  
- Add global --root-dir and --tasks-dir options
- Add environment variable AITRACKDOWN_ROOT_DIR support
- Update ConfigManager for directory configuration

# Day 5: Command Updates Start
- Update init command to use PathResolver
- Update track command path resolution
```

### **Week 2: Command Migration & Testing**
```bash
# Day 1-3: Remaining Commands
- Update status, export, and all other commands
- Replace all hardcoded "trackdown/" paths
- Ensure consistent path resolution across CLI

# Day 4-5: Migration & Config Command
- Add automatic detection of existing "trackdown/" directories
- Implement optional migration to "tasks/" 
- Add config subcommand for directory management
```

## 📊 SUCCESS METRICS

### **Functional Requirements**
- **Default Directory**: CLI uses "tasks/" as default root directory
- **CLI Configuration**: `--root-dir` option works across all commands
- **Environment Override**: `AITRACKDOWN_ROOT_DIR` properly sets directory
- **Config File**: .trackdownrc.json `rootDirectory` setting works
- **Backward Compatibility**: Existing "trackdown/" projects continue working

### **Technical Requirements**  
- **Path Consistency**: All commands use same directory resolution logic
- **Migration Safety**: No data loss during directory transitions
- **Performance**: Path resolution adds <5ms to command execution
- **Cross-Platform**: Directory handling works on Windows, macOS, Linux

## 🔄 DEPENDENCIES

### **Internal Dependencies**
- ConfigManager class (existing)
- All CLI commands (require updates)
- TrackdownConfig interface (needs extension)

### **External Dependencies**
- None (uses existing Node.js path utilities)

### **Blockers**
- None identified

## 🏗️ IMPLEMENTATION STRATEGY

### **Development Approach**
1. **Service-First**: Create PathResolver before updating commands
2. **Incremental Migration**: Update commands one by one with testing
3. **Backward Compatibility**: Maintain support for existing projects
4. **Configuration Priority**: CLI > Environment > Config > Default

### **Risk Mitigation**
- **Data Safety**: Detect existing directories before creating new ones
- **Migration Testing**: Comprehensive tests for directory transitions  
- **Path Validation**: Validate directory paths and permissions
- **Cross-Platform**: Test on Windows, macOS, and Linux

### **Quality Gates**
- All existing tests passing with new directory structure
- New PathResolver tests with 100% coverage
- Manual testing of migration scenarios
- Cross-platform validation completed

## 📝 NOTES

### **Critical Fix Required**
This is a fundamental error in the current implementation that affects all CLI functionality. The hardcoded "trackdown/" directory is inconsistent with expected behavior and lacks configurability.

### **User Impact**
- **Current Users**: May have projects in "trackdown/" directories
- **New Users**: Expect "tasks/" default with configuration options
- **Enterprise Users**: Need configurable directories for different projects

### **Migration Considerations**
- Detect existing "trackdown/" directories
- Offer migration to "tasks/" with user confirmation
- Maintain backward compatibility during transition period
- Clear migration documentation and examples

---

**Next Action**: Delegate to Engineer Agent for immediate implementation start with Phase 1 core implementation.

**Estimated Completion**: 2 weeks (8 story points)  
**Review Cycle**: Daily check-ins for this critical fix