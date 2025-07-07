# AI Trackdown Tooling - Project Configuration

## 🚀 PROJECT OVERVIEW

**AI Trackdown Tooling** - Professional CLI tool for ai-trackdown functionality delivered as NPM package.

**Core Mission**: Create a developer-friendly command-line interface that makes trackdown project management accessible via terminal commands.

## 🎯 PROJECT SPECIFICATIONS

### Project Details
- **Project Type**: CLI NPM Package
- **Target Platform**: Cross-platform (Windows, macOS, Linux)
- **Distribution**: NPM registry for global installation
- **Language**: TypeScript with Node.js runtime
- **Architecture**: Commander.js + TypeScript toolchain

### Technical Stack
- **CLI Framework**: Commander.js (182M+ weekly downloads)
- **Language**: TypeScript for type safety and maintainability
- **Bundler**: tsup for ESM/CJS dual output
- **Testing**: Jest with TypeScript support
- **Styling**: Chalk for CLI colors and professional UX
- **Build Target**: Node.js 16+ compatibility

## 📋 LOCAL PROJECT MANAGEMENT

### TrackDown System
This project uses **local TrackDown** management in `trackdown/` directory:

```bash
# View project tickets
ls trackdown/

# Current active ticket
cat trackdown/ATT-001-CLI-FOUNDATION.md

# Project status
find trackdown/ -name "*.md" | head -5
```

### Ticket Naming Convention
- **ATT-XXX**: AI Trackdown Tooling tickets
- Format: `ATT-001-BRIEF-DESCRIPTION.md`
- Status tracking within individual ticket files

### Development Workflow
1. **Check active tickets**: Review `trackdown/` for current work
2. **Follow ticket acceptance criteria**: Each ticket has detailed requirements
3. **Update ticket status**: Mark progress in ticket files
4. **Create new tickets**: For additional features or bug fixes

## 🛠️ DEVELOPMENT COMMANDS

### Setup Commands
```bash
# Install dependencies
npm install

# Development build
npm run dev

# Production build
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run typecheck
```

### CLI Testing
```bash
# Test locally (after build)
./dist/index.js --help

# Test installation simulation
npm link
trackdown --help
npm unlink
```

### Distribution Commands
```bash
# Build for distribution
npm run build:dist

# Package verification
npm pack

# Publish (when ready)
npm publish
```

## 🎯 QUALITY STANDARDS

### Code Requirements
- **TypeScript**: All code must be properly typed
- **Testing**: >90% test coverage required
- **Linting**: ESLint compliance mandatory
- **Formatting**: Prettier formatting enforced
- **Performance**: CLI startup <500ms target

### CLI Standards
- **Cross-platform**: Must work on Windows, macOS, Linux
- **Error handling**: Clear, actionable error messages
- **Help system**: Comprehensive help with examples
- **User experience**: Professional CLI styling with Chalk
- **Bundle size**: <5MB total package size

### Distribution Standards
- **NPM ready**: Proper package.json configuration
- **Dual output**: ESM and CJS compatibility
- **Shebang**: Proper executable configuration
- **Documentation**: Complete README with examples
- **Versioning**: Semantic versioning with changelog

## 🚫 DEVELOPMENT CONSTRAINTS

### Prohibited Actions
- **Direct Code Reading/Writing**: PM Assistant MUST delegate to Engineer agents
- **Configuration Changes**: Must be handled by appropriate specialist agents
- **Testing Implementation**: Delegate to QA agents
- **Technical Documentation**: Delegate to documentation specialists

### Allowed PM Activities
- Read and update project management files (CLAUDE.md, trackdown/)
- Use Bash for project status and directory management
- Create and manage tickets in trackdown/ system
- Coordinate and delegate work to appropriate agents
- Review project status and provide oversight

## 📁 PROJECT STRUCTURE

```
ai-trackdown-tooling/
├── CLAUDE.md                 # This configuration file
├── trackdown/               # Local project management
│   ├── ATT-001-CLI-FOUNDATION.md
│   └── [future tickets]
├── src/                     # Source code (Engineer Agent domain)
│   ├── index.ts            # Main CLI entry
│   ├── commands/           # Command implementations
│   ├── utils/              # Shared utilities
│   └── types/              # TypeScript definitions
├── dist/                   # Built output
├── tests/                  # Test files
├── package.json           # NPM configuration
├── tsconfig.json          # TypeScript config
├── jest.config.js         # Testing config
└── README.md              # Package documentation
```

## 🎯 SUCCESS CRITERIA

### Phase 1: Foundation (Week 1)
- TypeScript project with Commander.js integration
- Basic CLI structure with proper shebang
- tsup build system for dual output
- Initial command hierarchy

### Phase 2: Core Features (Week 2)
- All primary commands implemented (init, track, status, export)
- Professional CLI styling with Chalk
- Comprehensive help system
- Input validation and error handling

### Phase 3: Distribution (Week 3)
- NPM package ready for publication
- Cross-platform testing completed
- Performance optimization (startup <500ms)
- Automated testing pipeline

### Phase 4: Polish (Week 4)
- User acceptance testing completed
- Documentation and examples complete
- Performance profiling done
- Ready for NPM publication

## 🔄 INTEGRATION POINTS

### Claude PM Framework
- Uses managed project structure under `~/Projects/managed/`
- Follows Claude PM ticketing and management conventions
- Integrates with overall framework monitoring

### AI Trackdown Integration
- CLI will interface with existing ai-trackdown functionality
- Must support existing trackdown project formats
- Backward compatibility with current trackdown systems

---

**Project Phase**: Foundation Setup  
**Active Ticket**: ATT-001-CLI-FOUNDATION  
**Next Milestone**: Phase 1 completion (Week 1)  
**PM Review Cycle**: Weekly progress check-ins