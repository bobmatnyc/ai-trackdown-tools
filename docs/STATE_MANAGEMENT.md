# State Management System

The AI-Trackdown CLI now includes a comprehensive state management system that extends beyond the traditional status field to provide advanced resolution tracking and workflow automation.

## Overview

The state management system introduces:

- **Unified State Field**: A new `state` field that encompasses both legacy statuses and resolution states
- **State Metadata**: Detailed tracking of state transitions with timestamps, reviewers, and automation data
- **Workflow Validation**: Automatic validation of state transitions based on predefined rules
- **Resolution States**: Specific states for engineering, QA, and deployment workflows
- **Migration Tools**: Utilities to migrate from legacy status-based tickets to the new state system
- **Automation Integration**: Built-in hooks for CI/CD automation and workflow automation

## State Types

### Legacy Status States
- `planning` - Item is being planned
- `active` - Item is actively being worked on
- `completed` - Item is complete (legacy)
- `archived` - Item is archived

### Resolution States
- `ready_for_engineering` - Ready for development work
- `ready_for_qa` - Ready for quality assurance testing
- `ready_for_deployment` - Ready for deployment to production
- `won_t_do` - Item will not be implemented (rejected)
- `done` - Item is fully completed

## State Workflow

```
planning → ready_for_engineering → ready_for_qa → ready_for_deployment → done → archived
    |                |                  |              |
    |                |                  |              └── won_t_do → archived
    |                |                  └── ready_for_engineering (back to dev)
    |                └── ready_for_qa (skip engineering review)
    └── won_t_do → archived (reject at any stage)
```

## CLI Commands

### Resolve Commands

Transition items to resolution states with proper validation:

```bash
# Resolve to engineering
aitrackdown resolve engineering ISS-0001 --reason "Development ready"
aitrackdown resolve engineering ISS-0001 --assignee "dev@example.com" --reviewer "pm@example.com"

# Resolve to QA
aitrackdown resolve qa ISS-0001 --reason "Development complete"
aitrackdown resolve qa ISS-0001 --assignee "qa@example.com"

# Resolve to deployment
aitrackdown resolve deployment ISS-0001 --reason "QA testing passed"
aitrackdown resolve deployment ISS-0001 --assignee "devops@example.com"

# Mark as done
aitrackdown resolve done ISS-0001 --reason "Successfully deployed"

# Reject item
aitrackdown resolve reject ISS-0001 --reason "Out of scope for current sprint"

# Show resolution status
aitrackdown resolve status ISS-0001 --verbose
```

### Batch Resolve Operations

Process multiple items at once:

```bash
# Batch resolve to engineering
aitrackdown resolve batch-engineering ISS-0001 ISS-0002 ISS-0003 --reason "Sprint planning complete"

# Batch resolve to QA
aitrackdown resolve batch-qa ISS-0001 ISS-0002 --assignee "qa-team@example.com"

# Batch resolve to deployment
aitrackdown resolve batch-deployment ISS-0001 ISS-0002 --reason "QA approval received"
```

### State Commands

Query and manage states directly:

```bash
# List items with state information
aitrackdown state list --show-state
aitrackdown state list --state ready_for_qa
aitrackdown state list --type issue --format json

# Show detailed state information
aitrackdown state show ISS-0001
aitrackdown state show ISS-0001 --show-transitions --verbose

# Update state directly
aitrackdown state update ISS-0001 ready_for_deployment --reason "QA passed"
aitrackdown state update ISS-0001 done --reviewer "manager@example.com"

# Batch state updates
aitrackdown state batch-update ready_for_qa ISS-0001 ISS-0002 ISS-0003
```

### State Analytics

Get insights into state distribution and workflow health:

```bash
# Show state analytics
aitrackdown state analytics
aitrackdown state analytics --type issue --verbose
aitrackdown state analytics --format json

# Show workflow information
aitrackdown state workflow
aitrackdown state workflow --from active
aitrackdown state workflow --to done --verbose
```

### State Validation

Ensure state consistency across your project:

```bash
# Validate all items
aitrackdown state validate

# Validate specific item type
aitrackdown state validate --type issue --verbose

# Automatic fixing (when implemented)
aitrackdown state validate --fix
```

## Migration Commands

Convert legacy status-based tickets to the new state system:

```bash
# Preview migration
aitrackdown migrate-state preview
aitrackdown migrate-state preview --type issue --verbose

# Show migration status
aitrackdown migrate-state status
aitrackdown migrate-state status --format json

# Validate migration readiness
aitrackdown migrate-state validate

# Perform migration
aitrackdown migrate-state --dry-run --verbose
aitrackdown migrate-state --backup --migrated-by "admin@example.com"
aitrackdown migrate-state --type issue --log-file migration.json

# Rollback migration (if needed)
aitrackdown migrate-state rollback migration.json --dry-run
```

## Integration with Existing Commands

### Creating Items with States

```bash
# Create issue with initial state
aitrackdown issue create "New Feature" --state ready_for_engineering
aitrackdown issue create "Bug Fix" --state active --assignee "dev@example.com"

# Create with state metadata
aitrackdown task create "Implementation Task" --issue ISS-0001 --state ready_for_engineering
```

### Updating Items

```bash
# Update with state transition
aitrackdown issue update ISS-0001 --state ready_for_qa --reason "Development complete"
aitrackdown issue update ISS-0001 --state done --reviewer "pm@example.com"

# Combined updates
aitrackdown issue update ISS-0001 --state ready_for_deployment --assignee "devops@example.com" --priority high
```

### Listing with State Filters

```bash
# Filter by state
aitrackdown issue list --state ready_for_qa --show-state
aitrackdown task list --state done --format json

# Show state in output
aitrackdown issue list --show-state --assignee "qa@example.com"
```

## State Metadata

Each state transition includes rich metadata:

```yaml
state_metadata:
  transitioned_at: "2024-01-15T14:30:00.000Z"
  transitioned_by: "user@example.com"
  previous_state: "ready_for_engineering"
  automation_eligible: true
  automation_source: "ci-pipeline"
  transition_reason: "All tests passed"
  reviewer: "tech-lead@example.com"
```

### Metadata Fields

- **transitioned_at**: ISO timestamp of when the transition occurred
- **transitioned_by**: User or system that performed the transition
- **previous_state**: The state before this transition
- **automation_eligible**: Whether this transition can be automated
- **automation_source**: Source of automation (e.g., "ci-pipeline", "github-actions")
- **transition_reason**: Human-readable reason for the transition
- **reviewer**: Person who approved the transition (optional)

## Automation Integration

### CI/CD Workflow Integration

```bash
# Automated engineering resolution
aitrackdown resolve engineering $ISSUE_ID --reason "PR merged" --reviewer "$PR_REVIEWER"

# Automated QA resolution after tests pass
aitrackdown resolve qa $ISSUE_ID --reason "All tests passed" --automation-source "ci-pipeline"

# Automated deployment resolution
aitrackdown resolve deployment $ISSUE_ID --reason "Deployed to production" --automation-source "deployment-pipeline"
```

### GitHub Actions Example

```yaml
name: Auto-resolve to QA
on:
  pull_request:
    types: [closed]
    branches: [main]

jobs:
  auto-resolve:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Resolve to QA
        run: |
          # Extract issue ID from PR title or branch
          ISSUE_ID=$(echo "${{ github.event.pull_request.title }}" | grep -o 'ISS-[0-9]*')
          if [ ! -z "$ISSUE_ID" ]; then
            aitrackdown resolve qa $ISSUE_ID \
              --reason "PR #${{ github.event.pull_request.number }} merged" \
              --reviewer "${{ github.event.pull_request.user.login }}" \
              --automation-source "github-actions"
          fi
```

## Backward Compatibility

The state management system maintains full backward compatibility:

- **Legacy Status**: The original `status` field is preserved
- **Effective State**: Items without state field use status as effective state
- **Migration Path**: Gradual migration from status to state
- **API Compatibility**: All existing commands continue to work

### Mixed Environment Support

During migration, you may have items with different approaches:

```yaml
# Legacy item (status only)
status: active

# Migrated item (both fields)
status: active  # Preserved for compatibility
state: ready_for_engineering
state_metadata: { ... }

# Modern item (state only, future)
state: ready_for_qa
state_metadata: { ... }
```

## Advanced Features

### Custom Validation Rules

Future versions will support custom validation rules:

```json
{
  "state_validation": {
    "custom_rules": [
      {
        "from_state": "ready_for_qa",
        "to_state": "ready_for_deployment",
        "required_role": "qa-lead",
        "prerequisites": ["all_tests_passed", "security_review_complete"]
      }
    ]
  }
}
```

### State Hooks

Integration points for custom automation:

```json
{
  "state_hooks": {
    "on_ready_for_qa": "scripts/notify-qa-team.sh",
    "on_ready_for_deployment": "scripts/prepare-deployment.sh",
    "on_done": "scripts/update-metrics.sh"
  }
}
```

## Best Practices

### State Transition Guidelines

1. **Always provide reasons** for state transitions
2. **Use specific, actionable reasons** ("All tests passed" vs "Ready")
3. **Include reviewers** for important transitions
4. **Automate where possible** but maintain human oversight
5. **Validate before transitioning** to avoid invalid states

### Workflow Organization

1. **Engineering Phase**: Use `ready_for_engineering` for development-ready items
2. **QA Phase**: Use `ready_for_qa` for items ready for testing
3. **Deployment Phase**: Use `ready_for_deployment` for production-ready items
4. **Completion**: Use `done` for fully completed and deployed items
5. **Rejection**: Use `won_t_do` with detailed reasons

### Migration Strategy

1. **Start with preview** to understand impact
2. **Migrate incrementally** by item type
3. **Validate after migration** to ensure consistency
4. **Keep migration logs** for audit and rollback
5. **Train team members** on new commands and workflow

## Troubleshooting

### Common Issues

#### Invalid State Transitions
```bash
# Error: Invalid transition from planning to ready_for_deployment
# Solution: Follow proper workflow sequence
aitrackdown resolve engineering ISS-0001
aitrackdown resolve qa ISS-0001
aitrackdown resolve deployment ISS-0001
```

#### Missing State Metadata
```bash
# Check validation
aitrackdown state validate --verbose

# Fix through migration
aitrackdown migrate-state --type issue
```

#### Automation Not Working
```bash
# Check state metadata
aitrackdown state show ISS-0001 --verbose

# Verify automation eligibility
aitrackdown state workflow --from current_state
```

### Recovery Procedures

#### Rollback Migration
```bash
# Use migration log to rollback
aitrackdown migrate-state rollback migration-log.json
```

#### Fix State Inconsistencies
```bash
# Validate and identify issues
aitrackdown state validate --verbose

# Manual state fixes
aitrackdown state update ISS-0001 correct_state --reason "Manual correction"
```

#### Reset to Legacy Status
```bash
# Remove state fields (future feature)
aitrackdown state reset ISS-0001 --to-legacy
```

## Performance Considerations

### Large Repositories

For repositories with many items:

```bash
# Use pagination and filtering
aitrackdown state list --limit 50 --offset 0 --state ready_for_qa

# Process in batches
aitrackdown migrate-state --type issue  # One type at a time
```

### Automation Load

For high-frequency automation:

```bash
# Use batch operations
aitrackdown resolve batch-qa ISS-001 ISS-002 ISS-003

# Implement rate limiting in CI/CD pipelines
```

## Security Considerations

### Access Control

- **State transitions** can be restricted by role
- **Automation sources** should be validated
- **Migration operations** should require elevated permissions

### Audit Trail

- **All transitions** are logged with timestamps
- **User attribution** is tracked for accountability
- **Reasons are required** for major transitions

## Future Roadmap

### Planned Features

1. **Custom State Types**: Define project-specific states
2. **Role-based Permissions**: Restrict transitions by user role
3. **State Hooks**: Custom scripts triggered by state changes
4. **Advanced Analytics**: Workflow efficiency metrics
5. **Integration APIs**: REST/GraphQL APIs for state management
6. **Notification System**: Automatic notifications on state changes

### API Evolution

The state management system is designed for future expansion:

- **Plugin System**: Custom state handlers
- **External Integrations**: JIRA, Azure DevOps, etc.
- **Metrics Export**: Prometheus, DataDog integration
- **Compliance Reporting**: SOX, audit trail exports

## Support and Resources

### Documentation
- [CLI Reference](./CLI_REFERENCE.md)
- [Migration Guide](./MIGRATION_GUIDE.md)
- [Automation Examples](../examples/automation/)

### Community
- GitHub Issues: [Report bugs and request features](https://github.com/bobmatnyc/ai-trackdown-tools/issues)
- Discussions: [Ask questions and share experiences](https://github.com/bobmatnyc/ai-trackdown-tools/discussions)

### Enterprise Support
For enterprise deployments with custom requirements, contact the development team for:
- Custom state workflows
- Integration consulting
- Training and onboarding
- Priority support