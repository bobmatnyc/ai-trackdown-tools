# AI-Trackdown State Management Migration Guide

This guide provides step-by-step instructions for migrating from the legacy `status` field to the unified state management system with rich metadata.

## Migration Overview

### What's Changing
- **Legacy**: Simple `status` field with basic values
- **Enhanced**: Rich `state` field with comprehensive metadata
- **Compatibility**: Legacy `status` field preserved during transition

### Benefits of Migration
- ✅ **Rich Audit Trails**: Detailed transition history with timestamps and reasons
- ✅ **Automation Integration**: CI/CD pipeline compatibility with automation flags
- ✅ **Approval Workflows**: Built-in reviewer and approval tracking
- ✅ **Cross-Team Coordination**: Enhanced collaboration with role-based transitions
- ✅ **Analytics and Reporting**: Better insights into workflow performance
- ✅ **Backward Compatibility**: Existing tools continue to work

## Pre-Migration Assessment

### 1. Inventory Current Status Values
```bash
# Analyze current status distribution
aitrackdown status --format json | jq -r '.[].status' | sort | uniq -c | sort -nr

# Sample output:
#   245 active
#   123 completed
#    89 planning
#    67 testing
#    45 review
#    23 cancelled
#    12 blocked
```

### 2. Map Status to State Transitions
Create a mapping file (`status-mapping.json`):
```json
{
  "status_mappings": {
    "planning": "planning",
    "active": "active", 
    "in-progress": "active",
    "development": "active",
    "testing": "ready_for_qa",
    "qa": "ready_for_qa",
    "review": "ready_for_qa",
    "staging": "ready_for_deployment",
    "deployment": "ready_for_deployment",
    "completed": "done",
    "finished": "done",
    "cancelled": "won_t_do",
    "rejected": "won_t_do",
    "blocked": "active"
  },
  "default_metadata": {
    "transitioned_by": "migration-automation",
    "automation_eligible": true,
    "approval_required": false,
    "transition_reason": "Migrated from legacy status field"
  }
}
```

### 3. Backup Current Data
```bash
# Create full backup before migration
aitrackdown export --format json > backup-pre-migration-$(date +%Y%m%d).json

# Verify backup integrity
jq length backup-pre-migration-$(date +%Y%m%d).json
```

## Migration Process

### Phase 1: Preparation (1-2 days)

#### Step 1: Install Migration Tools
```bash
# Update to latest version with state management
npm install -g @bobmatnyc/ai-trackdown-tools@latest

# Verify migration capabilities
aitrackdown migrate --help
```

#### Step 2: Create Migration Configuration
```yaml
# migration-config.yaml
migration:
  name: "legacy-to-unified-state"
  version: "1.0"
  
  options:
    preserve_legacy_status: true
    validate_transitions: true
    create_audit_log: true
    backup_on_failure: true
    
  status_mappings:
    planning: 
      state: "planning"
      automation_eligible: true
    active: 
      state: "active"
      automation_eligible: true
    in-progress: 
      state: "active"
      automation_eligible: true
    testing: 
      state: "ready_for_qa"
      automation_eligible: true
    qa: 
      state: "ready_for_qa"
      automation_eligible: false  # Manual QA approval
    review: 
      state: "ready_for_qa"
      automation_eligible: false
    staging: 
      state: "ready_for_deployment"
      automation_eligible: true
    completed: 
      state: "done"
      automation_eligible: true
    cancelled: 
      state: "won_t_do"
      automation_eligible: false
    blocked: 
      state: "active"
      automation_eligible: false
      
  metadata_inference:
    # Infer previous state from update history
    analyze_history: true
    # Set reasonable defaults for missing data
    use_defaults: true
    # Preserve original timestamps
    maintain_timestamps: true
```

#### Step 3: Test on Sample Data
```bash
# Create test environment
cp -r tasks test-migration-tasks

# Run migration in test mode
aitrackdown migrate legacy-to-state \
  --config migration-config.yaml \
  --test-mode \
  --target test-migration-tasks \
  --verbose

# Validate test results
aitrackdown migrate validate \
  --source tasks \
  --target test-migration-tasks \
  --report migration-test-report.json
```

### Phase 2: Migration Execution (1 day)

#### Step 1: Pre-Migration Checks
```bash
# Verify system health
aitrackdown health

# Check for any locked files
find tasks -name "*.md" -exec fuser {} \; 2>/dev/null

# Validate current data integrity
aitrackdown validate --comprehensive

# Ensure backup is current
aitrackdown export --format json > final-backup-$(date +%Y%m%d-%H%M).json
```

#### Step 2: Execute Migration
```bash
# Run the migration
aitrackdown migrate legacy-to-state \
  --config migration-config.yaml \
  --backup-dir ./migration-backups \
  --log-level info \
  --batch-size 50

# Sample output:
# Migration Progress:
# ==================
# Phase 1: Analyzing tickets... ✓ (847 items)
# Phase 2: Validating mappings... ✓ (100% valid)
# Phase 3: Creating backups... ✓ (backup-20250714-140530)
# Phase 4: Migrating metadata... 
#   - Issues: 312/312 ✓
#   - Tasks: 421/421 ✓  
#   - PRs: 89/89 ✓
#   - Epics: 25/25 ✓
# Phase 5: Validating results... ✓ (100% successful)
# 
# Migration completed successfully!
# Total time: 2m 34s
# Items migrated: 847
# Success rate: 100%
```

#### Step 3: Post-Migration Validation
```bash
# Comprehensive validation
aitrackdown migrate validate --post-migration

# Check specific aspects
aitrackdown status --state-summary
aitrackdown migrate audit-trail --report audit-report.json

# Verify automation readiness
aitrackdown status --automation-eligible | wc -l
```

### Phase 3: Validation and Testing (1-2 days)

#### Step 1: Data Integrity Verification
```bash
# Compare pre and post migration counts
echo "Pre-migration items:"
jq length final-backup-$(date +%Y%m%d)*.json

echo "Post-migration items:"
aitrackdown status --format json | jq length

# Verify all status values mapped correctly
aitrackdown status --format json | jq -r '.[] | {id, legacy_status: .status, new_state: .state}'
```

#### Step 2: Functional Testing
```bash
# Test state transitions
aitrackdown issue create --title "Migration Test Issue" --state planning
TEST_ISSUE=$(aitrackdown status --format json | jq -r '.[] | select(.title == "Migration Test Issue") | .issue_id')

# Test transition with metadata
aitrackdown issue update $TEST_ISSUE \
  --state active \
  --transitioned-by test-user \
  --transition-reason "Testing post-migration functionality"

# Verify metadata was set correctly
aitrackdown issue show $TEST_ISSUE --field state_metadata
```

#### Step 3: Integration Testing
```bash
# Test CI/CD integration
if [[ -f .github/workflows/aitrackdown.yml ]]; then
  echo "Testing GitHub Actions integration..."
  # Trigger test workflow
fi

# Test automation eligibility
aitrackdown status --automation-eligible --format json | head -5

# Test approval workflows
TEST_APPROVAL_TICKET=$(aitrackdown status --state ready_for_qa --format json | jq -r '.[0].id')
if [[ $TEST_APPROVAL_TICKET != "null" ]]; then
  aitrackdown update $TEST_APPROVAL_TICKET \
    --reviewer test-reviewer \
    --approval-required true
fi
```

### Phase 4: Team Training and Rollout (2-3 days)

#### Step 1: Update Documentation
```bash
# Generate updated workflow documentation
aitrackdown docs generate --include-state-management

# Create team-specific guides
for TEAM in engineering qa devops product; do
  aitrackdown docs workflow --team $TEAM > docs/workflows/${TEAM}-workflow.md
done
```

#### Step 2: Tool Updates
```bash
# Update CLI wrapper scripts
update_cli_wrappers() {
  for script in bin/*.sh; do
    # Add --state flag to relevant commands
    sed -i 's/--status/--state/g' $script
    # Add automation eligibility checks
    echo "# Check automation eligibility before auto-transitions" >> $script
  done
}

# Update monitoring dashboards
update_dashboards() {
  # Update Grafana dashboards to use state field
  # Update Prometheus queries for state-based metrics
  # Update alerting rules for new state values
  echo "Dashboard update scripts would run here"
}
```

## Post-Migration Operations

### Monitoring Migration Success

#### Metrics to Track
```bash
# State distribution health
aitrackdown status --state-summary

# Automation adoption rate
TOTAL_TICKETS=$(aitrackdown status --format json | jq length)
AUTO_ELIGIBLE=$(aitrackdown status --automation-eligible --format json | jq length)
echo "Automation adoption: $(($AUTO_ELIGIBLE * 100 / $TOTAL_TICKETS))%"

# Transition velocity
aitrackdown analytics transitions --since-migration

# Error rates
grep ERROR migration-*.log | wc -l
```

#### Health Checks
```bash
# Daily health check script
#!/bin/bash
# migration-health-check.sh

echo "=== AI-Trackdown Migration Health Check ==="
echo "Date: $(date)"

# Check for corrupted metadata
CORRUPTED=$(aitrackdown validate --state-metadata 2>&1 | grep ERROR | wc -l)
echo "Corrupted metadata entries: $CORRUPTED"

# Check for missing state fields
MISSING_STATE=$(aitrackdown status --format json | jq '[.[] | select(.state == null)] | length')
echo "Items missing state field: $MISSING_STATE"

# Check automation eligibility distribution
AUTO_ELIGIBLE=$(aitrackdown status --automation-eligible --format json | jq length)
echo "Automation-eligible items: $AUTO_ELIGIBLE"

# Check for stuck transitions
STUCK=$(aitrackdown status --format json | jq '[.[] | select(.state_metadata.transitioned_at < (now - 86400*7))] | length')
echo "Items stuck in state >7 days: $STUCK"

if [[ $CORRUPTED -gt 0 || $MISSING_STATE -gt 0 ]]; then
  echo "❌ HEALTH CHECK FAILED - Manual intervention required"
  exit 1
else
  echo "✅ Health check passed"
fi
```

### Rollback Procedures

#### Emergency Rollback
```bash
# If critical issues are discovered
emergency_rollback() {
  echo "EMERGENCY: Rolling back state migration"
  
  # Stop all automation
  killall aitrackdown-automation 2>/dev/null
  
  # Restore from backup
  BACKUP_FILE=$(ls backup-pre-migration-*.json | head -1)
  
  if [[ -f $BACKUP_FILE ]]; then
    echo "Restoring from $BACKUP_FILE"
    aitrackdown import --restore-mode $BACKUP_FILE
    
    # Remove state fields (keep legacy status)
    find tasks -name "*.md" -exec sed -i '/^state:/d' {} \;
    find tasks -name "*.md" -exec sed -i '/^state_metadata:/,/^[a-z]/d' {} \;
    
    echo "Rollback completed - system restored to legacy mode"
  else
    echo "ERROR: No backup file found for rollback"
    exit 1
  fi
}
```

#### Partial Rollback
```bash
# Rollback specific items if needed
rollback_items() {
  local items=("$@")
  
  for item in "${items[@]}"; do
    echo "Rolling back $item to legacy status only"
    
    # Remove state and metadata fields
    aitrackdown update $item --remove-field state
    aitrackdown update $item --remove-field state_metadata
    
    echo "Rollback completed for $item"
  done
}
```

## Troubleshooting Common Issues

### Issue 1: Metadata Validation Errors
```bash
# Problem: Invalid state metadata after migration
# Solution: Re-generate metadata for affected items

fix_metadata_errors() {
  local broken_items=$(aitrackdown validate --state-metadata 2>&1 | grep ERROR | cut -d' ' -f3)
  
  for item in $broken_items; do
    echo "Fixing metadata for $item"
    
    aitrackdown update $item \
      --state-metadata-reset \
      --transitioned-by migration-fix \
      --transition-reason "Fixed invalid metadata post-migration"
  done
}
```

### Issue 2: Status/State Mismatch
```bash
# Problem: Legacy status doesn't match new state
# Solution: Synchronize fields

sync_status_state() {
  aitrackdown status --format json | jq -r '.[] | select(.status != .state) | .id' | while read item; do
    local current_state=$(aitrackdown show $item --field state)
    
    echo "Synchronizing $item: setting status to match state ($current_state)"
    aitrackdown update $item --status $current_state
  done
}
```

### Issue 3: Automation Not Working
```bash
# Problem: Automation eligibility not set correctly
# Solution: Update automation flags based on patterns

fix_automation_eligibility() {
  # Enable automation for standard workflow items
  aitrackdown status --state active --format json | jq -r '.[].id' | while read item; do
    local change_type=$(aitrackdown show $item --field change_type)
    
    if [[ $change_type != "security_sensitive" && $change_type != "major_change" ]]; then
      aitrackdown update $item --automation-eligible true
    fi
  done
}
```

## Success Criteria

### Migration Considered Successful When:
- ✅ **100% Data Integrity**: All items have valid state and metadata
- ✅ **Functional Compatibility**: All existing tools continue to work
- ✅ **Enhanced Functionality**: New state-based features are operational
- ✅ **Team Adoption**: Teams are using new workflow features
- ✅ **Automation Working**: CI/CD integration functioning correctly
- ✅ **Performance Maintained**: No degradation in system performance

### Long-term Success Indicators:
- ✅ **Increased Automation**: Growing percentage of automation-eligible items
- ✅ **Faster Workflows**: Reduced cycle time through state automation
- ✅ **Better Visibility**: Enhanced reporting and analytics
- ✅ **Improved Collaboration**: Cross-team workflow coordination
- ✅ **Audit Compliance**: Complete audit trails for all changes

## Conclusion

The migration to unified state management provides significant workflow enhancements while maintaining complete backward compatibility. Following this guide ensures a smooth transition with minimal disruption to existing processes.

**Key Success Factors:**
1. **Thorough Planning**: Understand current workflow before migration
2. **Comprehensive Testing**: Validate migration in test environment first
3. **Gradual Rollout**: Phase implementation to manage risk
4. **Team Training**: Ensure teams understand new capabilities
5. **Continuous Monitoring**: Track success metrics post-migration

For additional support during migration, refer to the examples in this directory and the comprehensive automation and workflow guides.