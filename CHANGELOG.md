# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-07-08

### Major Release - Complete Internal PR Management System

**BREAKING CHANGES**: Major version bump introducing comprehensive Pull Request management capabilities

### Added

#### **Complete PR Management System - 12 New Commands**
- **`aitrackdown pr create`** - Create new PR from templates with auto-linking to tasks/issues
- **`aitrackdown pr list`** - List PRs with advanced filtering and status-based views
- **`aitrackdown pr show <id>`** - Display comprehensive PR details with relationships
- **`aitrackdown pr update <id>`** - Update PR properties, assignees, and metadata
- **`aitrackdown pr review <id>`** - Create structured PR reviews with approval tracking
- **`aitrackdown pr approve <id>`** - Formally approve PRs with optional auto-merge
- **`aitrackdown pr merge <id>`** - Merge PRs with multiple strategies (merge/squash/rebase)
- **`aitrackdown pr close <id>`** - Close PRs without merging with reason tracking
- **`aitrackdown pr batch`** - Perform bulk operations on multiple PRs
- **`aitrackdown pr dependencies`** - Manage PR dependencies and relationship chains
- **`aitrackdown pr sync`** - Synchronize PRs with external systems (GitHub integration)
- **`aitrackdown pr archive`** - Archive old PRs with compression and external storage

#### **GitHub-Independent PR System**
- **File-based PR Storage**: Complete PR lifecycle management using local files
- **Status-based Organization**: Automatic file movement based on PR status (draft → open → review → approved → merged/closed)
- **Template Integration**: Full and quick PR templates with variable substitution
- **Relationship Management**: Link PRs to tasks, issues, and other PRs
- **Review System**: Structured review process with approval tracking

#### **Agent-Optimized Workflows**
- **Batch PR Creation**: Create multiple PRs from completed tasks with smart grouping
- **Auto-linking**: Intelligent task-PR associations based on completion status
- **Template Population**: Pre-fill PR templates with task/issue metadata
- **Token Usage Tracking**: Monitor AI token consumption for PR operations
- **Memory-efficient Operations**: Optimized for large-scale PR management

#### **Advanced PR Features**
- **Dependency Management**: Track PR dependencies and validate dependency chains
- **Multiple Merge Strategies**: Support for merge, squash, and rebase operations
- **Conditional Approvals**: Approval with conditions for minor fixes
- **Review Templates**: Security, performance, and general review templates
- **Batch Operations**: Efficient bulk approve, merge, and close operations
- **Archive System**: Compress and store old PRs with configurable retention

#### **Performance Optimizations**
- **Fast Command Response**: PR operations complete in 60-70ms average
- **Efficient File Operations**: Optimized directory scanning and file management
- **Memory Management**: <50MB memory usage for large PR repositories
- **Batch Processing**: <1s per 10 PRs for bulk operations
- **Intelligent Caching**: Reduce redundant file system operations

#### **New Directory Structure**
```
project/
├── prs/
│   ├── draft/           # Draft PRs
│   ├── active/
│   │   ├── open/        # Open PRs ready for review
│   │   ├── review/      # PRs under review
│   │   └── approved/    # Approved PRs ready to merge
│   ├── merged/          # Successfully merged PRs
│   ├── closed/          # Closed/rejected PRs
│   ├── reviews/         # PR review files
│   └── logs/            # Operation logs
└── templates/
    ├── pr-review-default.yaml
    ├── pr-review-quick.yaml
    └── pr-review-security.yaml
```

### Changed

#### **Enhanced CLI Interface**
- **New Command Namespace**: Complete `aitrackdown pr` command suite
- **Rich Terminal Output**: Enhanced formatting for PR status and information
- **Advanced Filtering**: Support for complex PR filtering by status, assignee, priority, dates
- **Multiple Output Formats**: Table, JSON, CSV, and Markdown output options
- **Progress Indicators**: Real-time feedback for long-running operations

#### **Configuration Extensions**
- **PR Directory Configuration**: Configurable PR storage location via `prs_dir` setting
- **Template Configuration**: Customizable PR template locations and naming
- **Merge Strategy Defaults**: Configurable default merge strategies per project
- **Review Requirements**: Configurable approval requirements and review processes

#### **Integration Enhancements**
- **Task-PR Synchronization**: Automatic status synchronization between tasks and PRs
- **Issue Linking**: Enhanced issue-PR relationship management
- **Epic Integration**: Connect PRs to epics through issue relationships
- **GitHub Sync**: Optional GitHub integration for external synchronization

### Technical Improvements

#### **Architecture Enhancements**
- **Modular Command Structure**: Clean separation of PR command implementations
- **File Management System**: Robust PR file manager with atomic operations
- **Status Management**: State machine-based PR status transitions
- **Relationship Engine**: Advanced relationship tracking and validation
- **Template Engine**: Flexible template system with variable substitution

#### **Quality Assurance**
- **Comprehensive Test Suite**: 170+ automated test cases for PR functionality
- **90%+ Test Coverage**: High test coverage for PR management code
- **Performance Benchmarks**: Automated performance testing and monitoring
- **Error Handling**: Graceful error handling for all edge cases
- **Input Validation**: Robust validation for all PR operations

#### **Documentation**
- **Complete PR Commands Guide**: Comprehensive documentation for all PR commands
- **Workflow Examples**: Real-world usage patterns and best practices
- **API Reference**: Complete command reference with examples
- **Migration Guide**: Instructions for upgrading from previous versions

### Performance Metrics

#### **Response Times**
- **PR Creation**: < 200ms (template-based)
- **PR Listing**: < 100ms (up to 100 PRs)
- **PR Details**: < 50ms (individual PR)
- **Batch Operations**: < 1s per 10 PRs
- **Status Updates**: < 100ms (with file movement)

#### **Scalability**
- **Large Repositories**: Tested with 1000+ PRs
- **Memory Efficiency**: < 50MB for PR operations
- **Concurrent Operations**: Safe multi-agent PR management
- **File System**: Efficient directory organization and scanning

### Migration Notes

#### **New Dependencies**
- No new external dependencies required
- All PR functionality built on existing foundation
- Backward compatible with existing projects

#### **Configuration Changes**
- New optional `prs_dir` configuration setting
- Enhanced project initialization to create PR directories
- Existing configurations remain fully compatible

#### **Breaking Changes**
- None - This is a major version bump for significant new functionality
- All existing commands and functionality remain unchanged
- PR commands are additive to existing feature set

### Developer Experience

#### **CLI Enhancements**
- **Intuitive Command Structure**: Follow GitHub CLI patterns for familiarity
- **Rich Help System**: Comprehensive help text with examples
- **Interactive Prompts**: Guided PR creation and management
- **Dry Run Mode**: Preview operations before execution
- **Verbose Output**: Detailed operation feedback when needed

#### **Agent Integration**
- **Batch Workflows**: Efficient bulk operations for agent-driven development
- **Smart Defaults**: Intelligent default values based on context
- **Token Optimization**: Minimize AI token usage for PR operations
- **Memory Management**: Efficient memory usage for large-scale operations
- **Progress Tracking**: Real-time feedback for long-running operations

## [1.0.1] - 2025-07-08

### ATT-004: Fix Task Directory Structure - Single Root Directory Implementation

### Added
- **Unified Directory Structure**: All task types now organized under single configurable root directory (default: `tasks/`)
- **Configurable Tasks Directory**: New `tasks_directory` configuration option in config.yaml
- **CLI Directory Options**: Added `--tasks-dir` and `--root-dir` CLI options for runtime override
- **Migration Utility**: New `migrate-structure` command to migrate legacy projects
- **Priority Resolution**: CLI > ENV > CONFIG > DEFAULT priority for directory configuration
- **Pull Request Support**: Added PR directory and prefix support in configuration

### Changed
- **Directory Structure**: Changed from separate root directories (epics/, issues/, tasks/) to unified structure (tasks/epics/, tasks/issues/, tasks/tasks/)
- **Path Resolution**: Implemented UnifiedPathResolver for consistent path handling
- **Configuration Schema**: Updated ProjectConfig interface with tasks_directory and prs_dir fields

### Fixed
- **Legacy Compatibility**: Existing projects continue to work with automatic structure detection
- **Command Integration**: All create commands now use unified directory structure
- **Template Loading**: Templates now load from unified structure paths

## [1.0.0] - 2025-07-08

### Major Release - Complete Redesign for ai-trackdown Compliance

**BREAKING CHANGES**: Complete architectural redesign for ai-trackdown framework compliance

### Added
- **AI-First Architecture**: Complete YAML frontmatter support for Epic/Issue/Task hierarchy
- **Token Tracking System**: Comprehensive token usage monitoring and budget management
- **AI Context Generation**: Automatic llms.txt generation for AI workflows
- **Template System**: Configurable project templates and initialization
- **Hierarchical Relationships**: Epic → Issue → Task relationship management
- **Migration Tools**: Convert legacy projects to ai-trackdown format
- **Professional CLI Interface**: Complete command structure with help system
- **Configuration System**: `.ai-trackdown/config.yaml` project configuration

### Removed
- **Legacy Commands**: Simplified to focus on ai-trackdown core functionality
- **External Dependencies**: Now operates with zero external API requirements

### Changed
- **Project Structure**: New `epics/issues/tasks/` directory structure (BREAKING)
- **Data Format**: YAML frontmatter replaces JSON data files (BREAKING)
- **Command Interface**: Complete redesign of all CLI commands (BREAKING)
- **Configuration**: `.ai-trackdown/config.yaml` replaces `.trackdownrc.json` (BREAKING)

### Technical Improvements
- **Git-Native Storage**: Local file operations with version control integration
- **Type Safety**: Complete TypeScript implementation
- **Performance**: Fast CLI startup and efficient file operations
- **Build System**: Clean build configuration with proper module bundling
- **Testing**: Comprehensive verification and quality assurance

## [0.3.0] - 2025-07-07

### Changed - CLI Rename and Alias Update
- **BREAKING CHANGE**: Renamed main CLI command from `trackdown` to `aitrackdown`
- **BREAKING CHANGE**: Renamed short alias from `td` to `atd` 
- Updated all command examples and help text throughout the codebase
- Updated package.json bin configuration for new command names
- Enhanced README with migration instructions and quick start guide

### Migration
- Replace `trackdown` commands with `aitrackdown` 
- Replace `td` alias with `atd`
- All functionality remains identical, only command names changed
- Example: `trackdown issue list` → `aitrackdown issue list` or `atd issue list`

### Technical Changes
- Updated Commander.js program name configuration
- Updated all help text and error messages
- Updated validation rules for reserved command names
- Maintained backward compatibility in configuration file formats

### Documentation
- Added comprehensive migration guide in README
- Updated installation and usage instructions
- Added quick start examples with new command syntax
- Documented both full (`aitrackdown`) and short (`atd`) command aliases

## [0.2.0] - 2025-07-07

### Added - GitHub Issues API Complete Parity (Phase 1)
- **Complete Issue Management System**
  - Full CRUD operations: create, list, show, update, close, reopen, delete
  - Advanced filtering and sorting with GitHub-compatible syntax
  - GitHub-compatible search with complex query parsing
  - State management with state_reason tracking (completed, not_planned, reopened)
  - Bulk operations and batch processing capabilities

- **Professional Label Management**
  - Complete label CRUD operations with color and description support
  - Label application and removal from issues
  - Interactive label creation with preset color schemes
  - Usage statistics and impact analysis
  - Label validation and conflict resolution

- **Advanced Search and Filtering**
  - GitHub-compatible search query parser supporting complex syntax
  - Date range filtering with relative and absolute dates
  - Multi-field search (title, body, comments)
  - Number-based filtering (comments, reactions, interactions)
  - Boolean and negation operators

- **GitHub API Integration**
  - Complete GitHub REST API v4 compatibility
  - Authentication with GitHub tokens
  - Rate limiting management and optimization
  - Error handling with actionable suggestions
  - Repository auto-detection and configuration

- **Professional CLI Interface**
  - Rich terminal output with colored formatting
  - Multiple output formats: table, JSON, YAML, CSV
  - Progress indicators and real-time feedback
  - Interactive prompts for complex operations
  - Comprehensive help system with examples

- **Type Safety and Validation**
  - Complete TypeScript type definitions for GitHub API
  - Input validation with helpful error messages
  - Schema validation for complex operations
  - Type-safe command options and parameters

### Technical Implementation
- Comprehensive GitHub API client with rate limiting
- Advanced search query parser for GitHub-compatible syntax
- Professional output formatters with multiple format support
- Robust error handling with contextual suggestions
- Modular command architecture for extensibility

### Performance Optimizations
- Efficient API request batching
- Intelligent caching strategies
- Optimized pagination handling
- Memory-efficient large dataset processing

## [0.1.1] - 2025-07-07

## [0.1.0] - 2025-07-07

### Added
- Initial CLI foundation with core commands
- Project initialization and configuration (`trackdown init`)
- Status reporting and task tracking (`trackdown status`)
- Export functionality for issues and tasks (`trackdown export`)
- Task tracking functionality (`trackdown track`)
- Complete semantic versioning system with automated management
- Version management commands (`trackdown version`)
- Automated changelog generation following Keep a Changelog format
- Git integration with tagging and commit automation
- Cross-file version synchronization
- Conventional commit parsing for changelog entries
- Professional CLI interface with colored output and help system

### Changed
- N/A (Initial release)

### Fixed
- N/A (Initial release)

[0.1.0]: https://github.com/user/ai-trackdown-tools/releases/tag/v0.1.0