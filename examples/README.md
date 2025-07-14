# AI-Trackdown State Management Examples

This directory contains comprehensive examples demonstrating the unified state-resolution model in ai-trackdown. These examples show practical usage patterns, state transitions, automation integration, and migration scenarios.

## Overview

The unified state management system introduces a new `state` field with rich metadata to replace the simple `status` field, providing:

- **5 Resolution States**: "ready for Engineering", "ready for QA", "ready for Deployment", "won't do", "done"
- **Rich State Metadata**: Timestamps, assignees, reviewers, automation eligibility
- **Backward Compatibility**: Legacy `status` field continues to work
- **Automation Integration**: Built-in support for CI/CD workflows

## Resolution States

| State | Description | Use Cases |
|-------|-------------|-----------|
| `ready_for_engineering` | Specifications complete, ready for development | Design approved, requirements finalized |
| `ready_for_qa` | Development complete, ready for testing | Code review passed, implementation done |
| `ready_for_deployment` | QA complete, ready for production | All tests passed, deployment approved |
| `won_t_do` | Deliberately not implementing | Cancelled, out of scope, duplicate |
| `done` | Completed and deployed | Live in production, objectives met |

## Example Categories

### 1. Ticket Lifecycle Examples (`lifecycle/`)
- Complete progression from planning to deployment
- State transitions with metadata
- Human and automated transitions
- Real-world development scenarios

### 2. Migration Examples (`migration/`)
- Legacy status to state field migration
- Backward compatibility demonstrations
- Batch migration scenarios
- Rollback and validation examples

### 3. Automation Examples (`automation/`)
- CI/CD pipeline integration
- Automated state transitions
- GitHub Actions workflows
- Deployment automation triggers

### 4. Team Workflow Examples (`workflows/`)
- Different team structures and processes
- Cross-functional collaboration patterns
- Review and approval workflows
- Escalation and conflict resolution

## Using the Examples

### Basic Usage
```bash
# View example ticket structure
cat examples/lifecycle/ISS-EX001-feature-development.md

# Copy template for new tickets  
cp examples/templates/issue-with-state.yaml my-issue-template.yaml
```

### Integration with CLI
```bash
# Create ticket using example template
aitrackdown issue create --template examples/templates/issue-with-state.yaml

# Transition ticket state
aitrackdown issue update ISS-001 --state ready_for_qa --reviewer john.doe

# View state-aware status
aitrackdown status --group-by state
```

### Automation Integration
```yaml
# GitHub Actions example
- name: Transition to QA
  run: |
    aitrackdown issue update ${{ env.ISSUE_ID }} \
      --state ready_for_qa \
      --transitioned-by github-actions \
      --automation-source ci-pipeline
```

## State Metadata Fields

All state transitions include rich metadata:

- **transitioned_at**: ISO timestamp of transition
- **transitioned_by**: User or system making the transition
- **previous_state**: Previous state for audit trail
- **automation_eligible**: Whether transition can be automated
- **automation_source**: Source system for automated transitions
- **reviewer**: Human reviewer for approval-required transitions
- **transition_reason**: Why the transition was made
- **approval_required**: Whether transition needs approval
- **blocked_reason**: If blocked, why transition cannot proceed

## Migration from Legacy Status

The system maintains full backward compatibility:

```yaml
# Legacy format (still works)
status: active

# New format (recommended)
status: active  # Kept for compatibility
state: ready_for_engineering
state_metadata:
  transitioned_at: "2025-07-14T10:30:00Z"
  transitioned_by: "product-manager"
  automation_eligible: true
```

## Best Practices

1. **Always include state metadata** for new tickets
2. **Use descriptive transition reasons** for audit trails
3. **Set automation eligibility** appropriately for your workflows
4. **Include reviewers** for approval-required transitions
5. **Maintain legacy status** during migration period

## Example Files Index

### Core Examples
- `lifecycle/` - Complete ticket lifecycles
- `migration/` - Legacy to new format migration
- `automation/` - CI/CD integration patterns
- `workflows/` - Team collaboration patterns

### Templates
- `templates/` - Updated templates with state field
- `schemas/` - Validation schemas and examples

### Documentation
- `MIGRATION_GUIDE.md` - Step-by-step migration instructions
- `AUTOMATION_GUIDE.md` - CI/CD integration guide
- `WORKFLOW_PATTERNS.md` - Common team workflow examples

## Getting Started

1. **Review the lifecycle examples** to understand basic state transitions
2. **Check migration examples** if upgrading from legacy status format
3. **Explore automation examples** for CI/CD integration
4. **Use workflow examples** to model your team's processes

For detailed implementation guidance, see the main documentation and the TypeScript usage examples in `src/examples/state-management-usage.ts`.