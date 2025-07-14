# AI-Trackdown Workflow Patterns

This guide demonstrates common team workflow patterns using the unified state management system. Each pattern shows how different team structures and processes can leverage state metadata for effective collaboration.

## Core Workflow Patterns

### 1. Standard Agile Development Flow

#### Team Structure
- **Product Owner**: Requirements and prioritization
- **Developers**: Implementation and code review
- **QA Engineers**: Testing and quality assurance
- **DevOps**: Deployment and infrastructure

#### State Transition Flow
```
planning → ready_for_engineering → active → ready_for_qa → ready_for_deployment → done
```

#### Example Configuration
```yaml
workflow_config:
  name: "standard_agile"
  teams:
    product:
      states: ["planning", "ready_for_engineering"]
      permissions: ["create", "prioritize", "approve_requirements"]
    
    engineering:
      states: ["ready_for_engineering", "active", "ready_for_qa"]
      permissions: ["implement", "code_review", "transition_to_qa"]
    
    qa:
      states: ["ready_for_qa", "ready_for_deployment"]
      permissions: ["test", "approve_quality", "transition_to_deployment"]
    
    devops:
      states: ["ready_for_deployment", "done"]
      permissions: ["deploy", "monitor", "mark_complete"]

  automation_rules:
    code_to_qa:
      trigger: "code_review_approved"
      condition: "all_tests_pass"
      auto_transition: true
    
    qa_to_deployment:
      trigger: "qa_approved"
      condition: "security_scan_clean"
      auto_transition: true
```

### 2. Cross-Functional Team Pattern

#### Team Structure
- **Feature Teams**: Full-stack developers with product ownership
- **Platform Teams**: Infrastructure and shared services
- **Security Team**: Security review and compliance

#### State Transition Flow
```yaml
workflow_name: "cross_functional"
states:
  planning:
    owner: "feature_team"
    required_approvals: ["product_owner"]
    
  active:
    owner: "feature_team"
    parallel_work: ["development", "testing", "documentation"]
    
  ready_for_security_review:
    owner: "security_team"
    sla: "2_business_days"
    escalation: "security_manager"
    
  ready_for_deployment:
    owner: "platform_team"
    automation_eligible: true
    deployment_windows: ["tuesday", "thursday"]
    
  done:
    post_actions: ["metrics_update", "stakeholder_notification"]
```

#### Example Implementation
```bash
# Feature team workflow automation
feature_team_workflow() {
  local ticket=$1
  local current_state=$(aitrackdown show $ticket --field state)
  
  case $current_state in
    "planning")
      # Check if requirements are complete
      if check_requirements_complete $ticket; then
        aitrackdown update $ticket \
          --state active \
          --transitioned-by "feature-team-lead" \
          --transition-reason "Requirements approved, starting development"
      fi
      ;;
      
    "active")
      # Check if development is complete and tests pass
      if check_development_complete $ticket && check_tests_pass $ticket; then
        aitrackdown update $ticket \
          --state ready_for_security_review \
          --transitioned-by "feature-team-lead" \
          --reviewer "security-team" \
          --transition-reason "Development complete, ready for security review"
      fi
      ;;
  esac
}
```

### 3. Microservices Architecture Pattern

#### Team Structure
- **Service Teams**: Own individual microservices
- **Platform Team**: Shared infrastructure and tooling
- **API Team**: API gateway and contracts
- **SRE Team**: Monitoring and reliability

#### Multi-Service Coordination
```yaml
workflow_config:
  name: "microservices"
  coordination_required: true
  
  service_dependencies:
    user_service:
      dependencies: ["auth_service", "notification_service"]
      deployment_order: 3
    
    auth_service:
      dependencies: []
      deployment_order: 1
    
    notification_service:
      dependencies: ["user_service"]
      deployment_order: 2

  state_transitions:
    service_ready:
      condition: "service_tests_pass AND dependencies_deployed"
      auto_transition: true
    
    integration_ready:
      condition: "all_dependent_services_ready"
      requires_approval: true
      approver: "platform_team"
```

#### Cross-Service Deployment Coordination
```bash
#!/bin/bash
# microservices-deployment-coordinator.sh

coordinate_microservices_deployment() {
  local epic_id=$1
  
  # Get all services involved in this epic
  local services=$(aitrackdown epic show $epic_id --field related_issues | \
    xargs -I {} aitrackdown show {} --field service_name | sort -u)
  
  echo "Coordinating deployment for services: $services"
  
  # Check deployment readiness for each service
  local all_ready=true
  for service in $services; do
    local service_tickets=$(aitrackdown status --filter "service_name=$service" --state ready_for_deployment)
    
    if [[ -z "$service_tickets" ]]; then
      echo "Service $service not ready for deployment"
      all_ready=false
    else
      echo "Service $service ready: $service_tickets"
    fi
  done
  
  if [[ $all_ready == "true" ]]; then
    echo "All services ready - starting coordinated deployment"
    
    # Deploy in dependency order
    local deployment_order=(auth_service user_service notification_service)
    
    for service in "${deployment_order[@]}"; do
      if [[ " $services " =~ " $service " ]]; then
        echo "Deploying $service..."
        deploy_service $service
        
        # Wait for health check
        wait_for_service_health $service
        
        # Update tickets
        local service_tickets=$(aitrackdown status --filter "service_name=$service" --state ready_for_deployment)
        for ticket in $service_tickets; do
          aitrackdown update $ticket \
            --state done \
            --transitioned-by "microservices-coordinator" \
            --deployment-timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            --deployment-service "$service"
        done
      fi
    done
  else
    echo "Not all services ready - deployment postponed"
  fi
}
```

### 4. Enterprise Approval Workflow

#### Team Structure
- **Development Teams**: Implementation
- **Architecture Review Board**: Technical governance
- **Security Team**: Security and compliance
- **Change Advisory Board**: Production change approval

#### Multi-Gate Approval Process
```yaml
workflow_config:
  name: "enterprise_approval"
  approval_gates:
    architecture_review:
      required_for: ["major_changes", "api_changes", "database_changes"]
      approvers: ["architecture_review_board"]
      sla: "5_business_days"
      
    security_review:
      required_for: ["all_changes"]
      approvers: ["security_team"]
      sla: "3_business_days"
      parallel_with: ["architecture_review"]
      
    change_advisory:
      required_for: ["production_deployment"]
      approvers: ["change_advisory_board"]
      sla: "2_business_days"
      requires: ["architecture_review", "security_review"]

  escalation_rules:
    approval_timeout:
      threshold: "sla + 1_business_day"
      escalate_to: "department_head"
    
    approval_conflict:
      multiple_rejections: true
      escalate_to: "cto"
```

#### Implementation Example
```bash
# Enterprise approval workflow
enterprise_approval_workflow() {
  local ticket=$1
  local change_type=$(aitrackdown show $ticket --field change_type)
  local current_state=$(aitrackdown show $ticket --field state)
  
  case $current_state in
    "ready_for_review")
      # Determine required approvals based on change type
      local required_approvals=()
      
      if [[ $change_type =~ "major_changes|api_changes|database_changes" ]]; then
        required_approvals+=("architecture_review")
      fi
      
      required_approvals+=("security_review")
      
      # Submit for parallel reviews
      for approval in "${required_approvals[@]}"; do
        aitrackdown update $ticket \
          --add-metadata "approval_requested_$approval=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
          --add-metadata "approval_status_$approval=pending" \
          --reviewer "${approval}_team"
      done
      ;;
      
    "reviews_complete")
      # Check if all required approvals received
      local all_approved=true
      
      for approval in architecture_review security_review; do
        local status=$(aitrackdown show $ticket --field state_metadata.approval_status_$approval)
        if [[ $status != "approved" ]]; then
          all_approved=false
          break
        fi
      done
      
      if [[ $all_approved == "true" ]]; then
        # Submit to Change Advisory Board
        aitrackdown update $ticket \
          --state ready_for_change_approval \
          --reviewer "change_advisory_board" \
          --transition-reason "All technical reviews approved"
      fi
      ;;
  esac
}
```

### 5. Open Source Contribution Pattern

#### Community Structure
- **Contributors**: External developers
- **Maintainers**: Core team members
- **Security Team**: Security review for sensitive changes
- **Release Team**: Release management

#### Contribution Workflow
```yaml
workflow_config:
  name: "open_source"
  public_visibility: true
  
  contributor_workflow:
    external_submission:
      state: "community_review"
      required_checks: ["cla_signed", "tests_pass", "ci_green"]
      
    maintainer_review:
      approvers: ["core_maintainers"]
      criteria: ["code_quality", "design_consistency", "documentation"]
      
    security_review:
      trigger: "security_sensitive_changes"
      required_for: ["auth_changes", "crypto_changes", "network_changes"]
      
    release_integration:
      milestone_assignment: true
      changelog_update: automatic
      
  automation_rules:
    ci_feedback:
      on_failure: "comment_on_pr"
      on_success: "label_ready_for_review"
      
    stale_contributions:
      threshold: "30_days"
      action: "comment_and_close"
```

### 6. Compliance and Audit Pattern

#### Regulatory Requirements
- **SOX Compliance**: Financial reporting controls
- **GDPR**: Data privacy requirements
- **HIPAA**: Healthcare data protection
- **SOC 2**: Security and availability controls

#### Audit Trail Configuration
```yaml
workflow_config:
  name: "compliance_audit"
  audit_requirements:
    sox_compliance:
      required_approvals: ["financial_controls_team"]
      documentation_required: true
      audit_trail: "immutable"
      
    gdpr_compliance:
      privacy_impact_assessment: required
      data_protection_review: required
      retention_policy: "automatic"
      
    change_control:
      segregation_of_duties: enforced
      approval_matrix: defined
      emergency_procedures: documented

  state_metadata_requirements:
    required_fields:
      - transitioned_by
      - transition_reason
      - approval_timestamp
      - reviewer_identity
    
    immutable_fields:
      - original_creator
      - creation_timestamp
      - audit_trail_hash
    
    retention_policy:
      duration: "7_years"
      archive_format: "json_signed"
```

#### Compliance Automation
```bash
# Compliance workflow automation
compliance_workflow() {
  local ticket=$1
  local compliance_type=$(aitrackdown show $ticket --field compliance_type)
  
  case $compliance_type in
    "sox")
      # SOX compliance requirements
      ensure_segregation_of_duties $ticket
      require_financial_approval $ticket
      create_audit_documentation $ticket
      ;;
      
    "gdpr")
      # GDPR compliance requirements
      check_privacy_impact $ticket
      require_dpo_approval $ticket
      update_privacy_records $ticket
      ;;
  esac
}

ensure_segregation_of_duties() {
  local ticket=$1
  local creator=$(aitrackdown show $ticket --field created_by)
  local approver=$(aitrackdown show $ticket --field state_metadata.reviewer)
  
  if [[ $creator == $approver ]]; then
    echo "ERROR: SOD violation - creator cannot approve own changes"
    aitrackdown update $ticket \
      --blocked-reason "Segregation of duties violation" \
      --automation-eligible false
    return 1
  fi
}
```

## Pattern Selection Guide

### Choose Based on Team Size

#### Small Teams (2-5 people)
- **Pattern**: Standard Agile (simplified)
- **States**: planning → active → done
- **Automation**: High (minimal approvals)
- **Overhead**: Low

#### Medium Teams (6-20 people)
- **Pattern**: Cross-Functional Teams
- **States**: Full workflow with QA gates
- **Automation**: Medium (selective approvals)
- **Overhead**: Medium

#### Large Teams (20+ people)
- **Pattern**: Microservices or Enterprise
- **States**: Multi-gate approvals
- **Automation**: Low (many manual approvals)
- **Overhead**: High

### Choose Based on Industry

#### Tech Startups
- **Pattern**: Standard Agile
- **Focus**: Speed and flexibility
- **Automation**: Maximum automation

#### Financial Services
- **Pattern**: Compliance and Audit
- **Focus**: Regulatory compliance
- **Automation**: Controlled automation with audit trails

#### Healthcare
- **Pattern**: Enterprise Approval + Compliance
- **Focus**: Patient data protection
- **Automation**: Minimal automation, maximum oversight

#### Open Source Projects
- **Pattern**: Open Source Contribution
- **Focus**: Community collaboration
- **Automation**: CI/CD focused

## Implementation Checklist

### 1. Assess Current Workflow
- [ ] Document existing process
- [ ] Identify bottlenecks
- [ ] Map team responsibilities
- [ ] Understand approval requirements

### 2. Design State Transitions
- [ ] Define required states
- [ ] Map team ownership per state
- [ ] Configure approval gates
- [ ] Plan automation opportunities

### 3. Configure Metadata
- [ ] Define required metadata fields
- [ ] Set up validation rules
- [ ] Configure audit requirements
- [ ] Plan retention policies

### 4. Implement Automation
- [ ] Start with monitoring only
- [ ] Add simple automations
- [ ] Implement safety mechanisms
- [ ] Monitor and adjust

### 5. Train Teams
- [ ] Document new workflow
- [ ] Train on state transitions
- [ ] Explain automation rules
- [ ] Establish escalation procedures

The key to successful workflow implementation is starting simple and gradually adding complexity as teams become comfortable with the state management system.