# AI-Trackdown Project Detection and Path Resolution System

## Implementation Summary

This document provides a comprehensive overview of the robust project detection system implemented for the AI-Trackdown CLI, which automatically determines whether to operate in single-project or multi-project mode and resolves paths accordingly.

## 🏗️ Architecture Overview

The system consists of three core components:

### 1. ProjectDetector (`src/utils/project-detector.ts`)
- **Purpose**: Automatically detects project structure and determines operating mode
- **Key Features**:
  - Auto-detection of single vs multi-project mode
  - Support for environment variable overrides
  - Configuration file mode specification
  - Migration detection for legacy structures
  - Project context management

### 2. Enhanced PathResolver (`src/utils/path-resolver.ts`)
- **Purpose**: Provides intelligent path resolution for both directory structures
- **Key Features**:
  - Project-aware path resolution
  - Support for both single and multi-project modes
  - Environment variable and CLI override support
  - Legacy structure migration detection
  - Contextualized directory structure

### 3. ProjectContextManager (`src/utils/project-context-manager.ts`)
- **Purpose**: Manages project context for CLI operations
- **Key Features**:
  - Context initialization and management
  - Project switching in multi-project mode
  - Project creation and validation
  - Structure validation and health checks
  - Comprehensive error handling

## 🔍 Detection Logic

### Multi-Project Mode Detection
The system detects multi-project mode based on the following indicators (in priority order):

1. **Projects Directory**: Existence of `projects/` directory
2. **PRJ Files**: Presence of `PRJ-XXXX` files in root directory
3. **Multiple .ai-trackdown Directories**: Multiple projects with individual configs

### Single-Project Mode Detection
Single-project mode is the default when no multi-project indicators are found.

### Priority Resolution
The detection system follows this priority order:
1. **CLI Override**: `--project-mode` flag
2. **Environment Variable**: `AITRACKDOWN_PROJECT_MODE`
3. **Configuration File**: `project_mode` setting in config
4. **Auto-Detection**: Based on directory structure analysis
5. **Default**: Single-project mode

## 📁 Directory Structure Support

### Single-Project Mode
```
project-root/
├── .ai-trackdown/
│   └── config.yaml
└── tasks/                    # Configurable root
    ├── epics/
    ├── issues/
    ├── tasks/
    ├── prs/
    └── templates/
```

### Multi-Project Mode
```
project-root/
├── projects/
│   ├── project-a/
│   │   ├── .ai-trackdown/
│   │   │   └── config.yaml
│   │   └── tasks/
│   │       ├── epics/
│   │       ├── issues/
│   │       ├── tasks/
│   │       ├── prs/
│   │       └── templates/
│   └── project-b/
│       ├── .ai-trackdown/
│       │   └── config.yaml
│       └── tasks/
│           ├── epics/
│           ├── issues/
│           ├── tasks/
│           ├── prs/
│           └── templates/
```

## 🔧 Configuration Support

### Environment Variables
- `AITRACKDOWN_PROJECT_MODE`: Force single or multi-project mode
- `AITRACKDOWN_TASKS_DIR`: Override tasks directory location
- `AITRACKDOWN_ROOT_DIR`: Override root directory location

### Configuration File
```yaml
name: project-name
version: 1.0.0
project_mode: single  # or 'multi'
tasks_directory: tasks
structure:
  epics_dir: epics
  issues_dir: issues
  tasks_dir: tasks
  prs_dir: prs
  templates_dir: templates
naming_conventions:
  epic_prefix: EP
  issue_prefix: ISS
  task_prefix: TSK
  pr_prefix: PR
  file_extension: .md
```

## 🚀 Key Features

### 1. Automatic Detection
- Scans directory structure for project indicators
- Provides migration recommendations for legacy structures
- Handles edge cases and mixed configurations

### 2. Flexible Path Resolution
- Supports both directory structures seamlessly
- Maintains backward compatibility
- Provides context-aware path resolution

### 3. Project Context Management
- Manages project switching in multi-project mode
- Validates project structure and configuration
- Provides comprehensive error handling and feedback

### 4. Migration Support
- Detects legacy directory structures
- Provides migration recommendations
- Supports gradual migration paths

### 5. CLI Integration
- Seamless integration with existing CLI commands
- Support for project-specific operations
- Context-aware command execution

## 🔄 Integration Points

### CLI Commands
All CLI commands now support project context:
```bash
# Single-project mode (automatic)
aitrackdown epic create "New Epic"

# Multi-project mode with project selection
aitrackdown --project my-project epic create "New Epic"

# Environment variable override
AITRACKDOWN_PROJECT_MODE=multi aitrackdown epic list
```

### Configuration System
- Integrates with existing ConfigManager
- Supports environment variable overrides
- Maintains backward compatibility

### Path Resolution
- All path operations are context-aware
- Supports both directory structures
- Provides migration guidance

## 🧪 Testing and Validation

### Demo System
The `ProjectDetectionDemo` class provides comprehensive testing:
- Single-project mode demonstration
- Multi-project mode demonstration  
- Environment variable override testing
- Migration detection validation

### Validation Features
- Project structure validation
- Configuration file validation
- Context integrity checks
- Migration path validation

## 📊 Usage Examples

### Basic Usage
```typescript
// Initialize project context
const contextManager = new ProjectContextManager();
const context = await contextManager.initializeContext();

// Get paths for current project
const paths = contextManager.getPaths();
console.log(paths.epicsDir); // Context-aware path
```

### Multi-Project Operations
```typescript
// Switch between projects
await contextManager.switchProject('project-a');
const pathsA = contextManager.getPaths();

await contextManager.switchProject('project-b');
const pathsB = contextManager.getPaths();
```

### Migration Detection
```typescript
// Check for migration needs
const detector = new ProjectDetector();
const detection = detector.detectProjectMode();

if (detection.migrationNeeded) {
  console.log('Migration recommendations:');
  detection.recommendations.forEach(rec => console.log(rec));
}
```

## 🔐 Error Handling

### Comprehensive Error Coverage
- Invalid project names
- Missing project directories
- Configuration validation errors
- Context initialization failures
- Migration path conflicts

### User-Friendly Messages
- Clear error descriptions
- Actionable recommendations
- Context-specific guidance
- Migration assistance

## 🚀 Performance Considerations

### Optimizations
- Lazy initialization of project context
- Cached detection results
- Efficient directory scanning
- Minimal file system operations

### Scalability
- Supports large numbers of projects
- Efficient project switching
- Minimal memory footprint
- Fast path resolution

## 📋 Future Enhancements

### Potential Improvements
1. **Project Templates**: Pre-configured project structures
2. **Workspace Support**: Multi-workspace management
3. **Remote Projects**: Support for remote project repositories
4. **Project Analytics**: Cross-project reporting and analytics
5. **Project Dependencies**: Inter-project dependency management

### Migration Path
The system provides a clear migration path for existing installations:
1. Automatic detection of legacy structures
2. Guided migration recommendations
3. Backward compatibility maintenance
4. Gradual migration support

## 🎯 Conclusion

The implemented project detection and path resolution system provides:

- **Flexibility**: Supports both single and multi-project workflows
- **Intelligence**: Automatic detection with manual override capabilities
- **Reliability**: Comprehensive error handling and validation
- **Usability**: Clear feedback and migration guidance
- **Performance**: Efficient operation with minimal overhead
- **Extensibility**: Designed for future enhancements

The system successfully bridges the gap between simple single-project usage and complex multi-project management while maintaining full backward compatibility and providing a smooth migration path for existing users.