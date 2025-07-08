# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-07-08

### Major Release - Complete Redesign for ai-trackdown Compliance

**BREAKING CHANGES**: Complete architectural transformation from GitHub API tool to ai-trackdown framework

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
- **GitHub API Integration**: Complete removal of GitHub dependencies (BREAKING)
- **Legacy Commands**: Removed GitHub Issues-specific commands
- **OAuth Requirements**: No longer requires GitHub authentication

### Changed
- **Project Structure**: New `epics/issues/tasks/` directory structure (BREAKING)
- **Data Format**: YAML frontmatter replaces JSON data files (BREAKING)
- **Command Interface**: Complete redesign of all CLI commands (BREAKING)
- **Configuration**: `.ai-trackdown/config.yaml` replaces `.trackdownrc.json` (BREAKING)

### Technical Improvements
- **Zero Dependencies**: Git-native storage with local file operations
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

[0.1.0]: https://github.com/user/ai-trackdown-tooling/releases/tag/v0.1.0