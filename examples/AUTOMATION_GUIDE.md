# AI-Trackdown Automation Integration Guide

This guide provides comprehensive examples and patterns for integrating ai-trackdown's unified state management with CI/CD pipelines, automation tools, and workflow systems.

## Overview

The unified state management system enables deep integration with automation tools through:
- **Rich state metadata** with automation eligibility tracking
- **Programmatic state transitions** via CLI and API
- **Conditional automation** based on state metadata
- **Audit trails** for all automated actions
- **Manual override capabilities** for emergency situations

## Core Automation Patterns

### 1. State-Triggered Automation

#### Pattern: Trigger Deployment on State Change
```bash
# Watch for tickets reaching ready_for_deployment
aitrackdown status --state ready_for_deployment --watch | while read TICKET; do
  if [[ $(aitrackdown show $TICKET --field automation_eligible) == "true" ]]; then
    echo "Triggering deployment for $TICKET"
    ./deploy.sh $TICKET
    
    # Update state after successful deployment
    if [ $? -eq 0 ]; then
      aitrackdown update $TICKET \
        --state done \
        --transitioned-by deployment-automation \
        --deployment-timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    fi
  fi
done
```

#### Pattern: Conditional Automation Based on Metadata
```bash
#!/bin/bash
# automation-dispatcher.sh

TICKET=$1
CURRENT_STATE=$(aitrackdown show $TICKET --field state)
AUTOMATION_ELIGIBLE=$(aitrackdown show $TICKET --field state_metadata.automation_eligible)
SECURITY_CLEARED=$(aitrackdown show $TICKET --field state_metadata.security_scan_passed)

case $CURRENT_STATE in
  "ready_for_qa")
    if [[ $AUTOMATION_ELIGIBLE == "true" ]]; then
      echo "Starting automated QA pipeline for $TICKET"
      ./run-qa-tests.sh $TICKET
    else
      echo "Manual QA required for $TICKET"
      notify-qa-team.sh $TICKET
    fi
    ;;
    
  "ready_for_deployment")
    if [[ $AUTOMATION_ELIGIBLE == "true" && $SECURITY_CLEARED != "" ]]; then
      echo "Starting automated deployment for $TICKET"
      ./deploy-to-staging.sh $TICKET
    else
      echo "Manual deployment approval required for $TICKET"
      request-deployment-approval.sh $TICKET
    fi
    ;;
esac
```

### 2. CI/CD Pipeline Integration

#### GitHub Actions Complete Workflow
```yaml
name: AI-Trackdown Complete Workflow
on:
  push:
    branches: [main, develop, 'feature/*']
  pull_request:
    types: [opened, synchronize, closed]

jobs:
  extract-tickets:
    runs-on: ubuntu-latest
    outputs:
      tickets: ${{ steps.extract.outputs.tickets }}
    steps:
      - uses: actions/checkout@v3
      
      - name: Extract ticket IDs
        id: extract
        run: |
          # Extract from PR title, commit messages, and branch name
          TICKETS=""
          
          # From PR title
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            TICKETS="$TICKETS $(echo '${{ github.event.pull_request.title }}' | grep -oE 'ISS-[0-9]+|TSK-[0-9]+|PR-[0-9]+')"
          fi
          
          # From recent commits
          TICKETS="$TICKETS $(git log --oneline -10 | grep -oE 'ISS-[0-9]+|TSK-[0-9]+|PR-[0-9]+')"
          
          # From branch name
          TICKETS="$TICKETS $(echo '${{ github.ref }}' | grep -oE 'ISS-[0-9]+|TSK-[0-9]+|PR-[0-9]+')"
          
          # Clean up and deduplicate
          UNIQUE_TICKETS=$(echo $TICKETS | tr ' ' '\n' | sort -u | tr '\n' ' ')
          echo "tickets=$UNIQUE_TICKETS" >> $GITHUB_OUTPUT

  test-and-update:
    needs: extract-tickets
    if: needs.extract-tickets.outputs.tickets != ''
    runs-on: ubuntu-latest
    strategy:
      matrix:
        ticket: ${{ fromJson(needs.extract-tickets.outputs.tickets) }}
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        id: tests
        run: |
          npm test 2>&1 | tee test-results.log
          echo "test_exit_code=$?" >> $GITHUB_OUTPUT
          
      - name: Run security scan
        id: security
        run: |
          npm audit --audit-level high
          npx snyk test
          echo "security_exit_code=$?" >> $GITHUB_OUTPUT
          
      - name: Update ticket on test success
        if: steps.tests.outputs.test_exit_code == '0' && steps.security.outputs.security_exit_code == '0'
        run: |
          aitrackdown ${GITHUB_MATRIX_TICKET%%-*} update ${{ matrix.ticket }} \
            --state ready_for_qa \
            --transitioned-by github-actions \
            --automation-source "github-ci-${{ github.run_id }}" \
            --transition-reason "All tests passed, security scan clean" \
            --test-results-url "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}" \
            --automation-eligible true
            
      - name: Update ticket on test failure
        if: steps.tests.outputs.test_exit_code != '0' || steps.security.outputs.security_exit_code != '0'
        run: |
          aitrackdown ${GITHUB_MATRIX_TICKET%%-*} update ${{ matrix.ticket }} \
            --add-metadata "test_failure_timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            --add-metadata "test_failure_url=${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}" \
            --automation-eligible false \
            --blocked-reason "Tests failed - requires developer attention"

  deployment:
    needs: [extract-tickets, test-and-update]
    if: github.ref == 'refs/heads/main' && needs.extract-tickets.outputs.tickets != ''
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to production
        id: deploy
        run: |
          # Your deployment script here
          ./deploy-production.sh
          echo "deploy_exit_code=$?" >> $GITHUB_OUTPUT
          
      - name: Update tickets on successful deployment
        if: steps.deploy.outputs.deploy_exit_code == '0'
        run: |
          for TICKET in ${{ needs.extract-tickets.outputs.tickets }}; do
            aitrackdown ${TICKET%%-*} update $TICKET \
              --state done \
              --transitioned-by github-actions \
              --automation-source "github-deployment-${{ github.run_id }}" \
              --transition-reason "Successfully deployed to production" \
              --deployment-timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
              --deployed-by "github-actions"
          done
```

#### Jenkins Pipeline Integration
```groovy
pipeline {
    agent any
    
    environment {
        TICKETS = sh(
            script: "git log --oneline -5 | grep -oE 'ISS-[0-9]+|TSK-[0-9]+|PR-[0-9]+' | sort -u | tr '\n' ' '",
            returnStdout: true
        ).trim()
    }
    
    stages {
        stage('Extract Tickets') {
            steps {
                script {
                    if (env.TICKETS) {
                        echo "Found tickets: ${env.TICKETS}"
                        env.TICKET_LIST = env.TICKETS.split(' ')
                    } else {
                        echo "No tickets found in recent commits"
                        currentBuild.result = 'SUCCESS'
                        return
                    }
                }
            }
        }
        
        stage('Test') {
            steps {
                script {
                    try {
                        sh 'npm test'
                        
                        // Update tickets on test success
                        env.TICKET_LIST.each { ticket ->
                            sh """
                                aitrackdown \${ticket%-*} update ${ticket} \\
                                    --state ready_for_qa \\
                                    --transitioned-by jenkins-ci \\
                                    --automation-source "jenkins-build-${env.BUILD_NUMBER}" \\
                                    --transition-reason "Tests passed in Jenkins build" \\
                                    --test-results-url "${env.BUILD_URL}testReport/" \\
                                    --automation-eligible true
                            """
                        }
                    } catch (Exception e) {
                        // Update tickets on test failure
                        env.TICKET_LIST.each { ticket ->
                            sh """
                                aitrackdown \${ticket%-*} update ${ticket} \\
                                    --add-metadata "test_failure_timestamp=\$(date -u +%Y-%m-%dT%H:%M:%SZ)" \\
                                    --add-metadata "test_failure_url=${env.BUILD_URL}" \\
                                    --automation-eligible false \\
                                    --blocked-reason "Jenkins tests failed - build ${env.BUILD_NUMBER}"
                            """
                        }
                        throw e
                    }
                }
            }
        }
        
        stage('Deploy') {
            when {
                branch 'main'
                expression { env.TICKETS != '' }
            }
            steps {
                script {
                    // Deploy to production
                    sh './deploy-production.sh'
                    
                    // Update tickets on successful deployment
                    env.TICKET_LIST.each { ticket ->
                        sh """
                            aitrackdown \${ticket%-*} update ${ticket} \\
                                --state done \\
                                --transitioned-by jenkins-deployment \\
                                --automation-source "jenkins-deployment-${env.BUILD_NUMBER}" \\
                                --deployment-timestamp "\$(date -u +%Y-%m-%dT%H:%M:%SZ)" \\
                                --deployed-by "jenkins-automation"
                        """
                    }
                }
            }
        }
    }
    
    post {
        failure {
            script {
                if (env.TICKETS) {
                    env.TICKET_LIST.each { ticket ->
                        sh """
                            aitrackdown \${ticket%-*} update ${ticket} \\
                                --add-metadata "pipeline_failure_timestamp=\$(date -u +%Y-%m-%dT%H:%M:%SZ)" \\
                                --add-metadata "pipeline_failure_url=${env.BUILD_URL}" \\
                                --transition-reason "Jenkins pipeline failed at stage: ${env.STAGE_NAME}"
                        """
                    }
                }
            }
        }
    }
}
```

### 3. Kubernetes Integration

#### Deployment Operator
```yaml
# k8s-deployment-operator.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: aitrackdown-operator
spec:
  replicas: 1
  selector:
    matchLabels:
      app: aitrackdown-operator
  template:
    metadata:
      labels:
        app: aitrackdown-operator
    spec:
      containers:
      - name: operator
        image: aitrackdown-operator:latest
        env:
        - name: AITRACKDOWN_CONFIG
          value: "/config/aitrackdown.json"
        volumeMounts:
        - name: config
          mountPath: /config
        command:
        - /bin/bash
        - -c
        - |
          #!/bin/bash
          while true; do
            # Check for tickets ready for deployment
            READY_TICKETS=$(aitrackdown status --state ready_for_deployment --format json | jq -r '.[] | select(.state_metadata.automation_eligible == true) | .id')
            
            for TICKET in $READY_TICKETS; do
              echo "Processing deployment for $TICKET"
              
              # Get deployment configuration from ticket metadata
              NAMESPACE=$(aitrackdown show $TICKET --field deployment_namespace || echo "default")
              APP_NAME=$(aitrackdown show $TICKET --field app_name)
              IMAGE_TAG=$(aitrackdown show $TICKET --field docker_image_tag)
              
              if [[ -n "$APP_NAME" && -n "$IMAGE_TAG" ]]; then
                # Deploy using kubectl
                kubectl set image deployment/$APP_NAME $APP_NAME=$IMAGE_TAG -n $NAMESPACE
                
                # Wait for rollout
                if kubectl rollout status deployment/$APP_NAME -n $NAMESPACE --timeout=300s; then
                  # Deployment successful
                  aitrackdown ${TICKET%%-*} update $TICKET \
                    --state done \
                    --transitioned-by kubernetes-operator \
                    --deployment-timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
                    --deployed-namespace "$NAMESPACE"
                else
                  # Deployment failed
                  aitrackdown ${TICKET%%-*} update $TICKET \
                    --add-metadata "deployment_failure_timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
                    --add-metadata "deployment_failure_namespace=$NAMESPACE" \
                    --blocked-reason "Kubernetes deployment failed"
                fi
              fi
            done
            
            sleep 30
          done
      volumes:
      - name: config
        configMap:
          name: aitrackdown-config
```

### 4. Slack Integration

#### Slack Bot for State Notifications
```javascript
// slack-bot.js
const { App } = require('@slack/bolt');
const { exec } = require('child_process');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// Listen for state transition notifications
app.event('message', async ({ event, client }) => {
  if (event.text && event.text.includes('aitrackdown-notification')) {
    const ticketMatch = event.text.match(/(ISS|TSK|PR)-\d+/);
    if (ticketMatch) {
      const ticketId = ticketMatch[0];
      
      // Get current ticket state
      exec(`aitrackdown show ${ticketId} --format json`, (error, stdout) => {
        if (!error) {
          const ticket = JSON.parse(stdout);
          const state = ticket.state;
          const metadata = ticket.state_metadata;
          
          // Format notification message
          const message = {
            channel: event.channel,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*${ticketId}*: ${ticket.title}\n*State*: ${state}\n*Updated by*: ${metadata.transitioned_by}`
                }
              }
            ]
          };
          
          // Add action buttons based on state
          if (state === 'ready_for_qa') {
            message.blocks.push({
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Approve QA" },
                  action_id: "approve_qa",
                  value: ticketId
                },
                {
                  type: "button",
                  text: { type: "plain_text", text: "Request Changes" },
                  action_id: "request_changes",
                  value: ticketId
                }
              ]
            });
          }
          
          client.chat.postMessage(message);
        }
      });
    }
  }
});

// Handle approval actions
app.action('approve_qa', async ({ ack, body, client }) => {
  await ack();
  
  const ticketId = body.actions[0].value;
  const userId = body.user.id;
  
  // Get user info for attribution
  const userInfo = await client.users.info({ user: userId });
  const userName = userInfo.user.real_name || userInfo.user.name;
  
  // Update ticket state
  exec(`aitrackdown ${ticketId.split('-')[0].toLowerCase()} update ${ticketId} --state ready_for_deployment --transitioned-by "${userName}" --reviewer "${userName}" --transition-reason "Approved via Slack"`, (error) => {
    if (!error) {
      client.chat.postMessage({
        channel: body.channel.id,
        text: `✅ ${ticketId} approved for deployment by ${userName}`
      });
    }
  });
});

app.start(process.env.PORT || 3000);
```

### 5. Monitoring and Alerting

#### Prometheus Metrics Export
```bash
#!/bin/bash
# metrics-exporter.sh - Export ai-trackdown metrics for Prometheus

# Create metrics file
METRICS_FILE="/var/lib/prometheus/textfile/aitrackdown.prom"

{
  echo "# HELP aitrackdown_tickets_by_state Number of tickets in each state"
  echo "# TYPE aitrackdown_tickets_by_state gauge"
  
  for STATE in planning active ready_for_qa ready_for_deployment done won_t_do; do
    COUNT=$(aitrackdown status --state $STATE --format json | jq length)
    echo "aitrackdown_tickets_by_state{state=\"$STATE\"} $COUNT"
  done
  
  echo "# HELP aitrackdown_automation_eligible Number of automation-eligible tickets"
  echo "# TYPE aitrackdown_automation_eligible gauge"
  
  AUTO_COUNT=$(aitrackdown status --format json | jq '[.[] | select(.state_metadata.automation_eligible == true)] | length')
  echo "aitrackdown_automation_eligible $AUTO_COUNT"
  
  echo "# HELP aitrackdown_stuck_tickets Number of tickets stuck in state > 24h"
  echo "# TYPE aitrackdown_stuck_tickets gauge"
  
  STUCK_COUNT=$(aitrackdown status --format json | jq "[.[] | select(.state_metadata.transitioned_at < (now - 86400))] | length")
  echo "aitrackdown_stuck_tickets $STUCK_COUNT"
  
} > $METRICS_FILE
```

#### Alerting Rules
```yaml
# prometheus-alerts.yml
groups:
- name: aitrackdown
  rules:
  - alert: TicketsStuckInQA
    expr: aitrackdown_tickets_by_state{state="ready_for_qa"} > 10
    for: 1h
    labels:
      severity: warning
    annotations:
      summary: "Too many tickets stuck in QA"
      description: "{{ $value }} tickets have been in ready_for_qa state for over 1 hour"
      
  - alert: AutomationDisabled
    expr: increase(aitrackdown_automation_eligible[1h]) < 0
    for: 30m
    labels:
      severity: critical
    annotations:
      summary: "Automation eligibility decreasing"
      description: "Tickets are losing automation eligibility, manual intervention may be required"
      
  - alert: DeploymentBacklog
    expr: aitrackdown_tickets_by_state{state="ready_for_deployment"} > 5
    for: 2h
    labels:
      severity: warning
    annotations:
      summary: "Deployment backlog building up"
      description: "{{ $value }} tickets ready for deployment - consider increasing deployment frequency"
```

## Best Practices for Automation

### 1. Gradual Automation Rollout
```bash
# Start with monitoring only
aitrackdown status --state ready_for_qa --watch | while read TICKET; do
  echo "Would process $TICKET for QA automation"
  # Log but don't act
done

# Add dry-run mode
if [[ $DRY_RUN == "true" ]]; then
  echo "DRY RUN: Would transition $TICKET to $NEW_STATE"
else
  aitrackdown update $TICKET --state $NEW_STATE
fi
```

### 2. Safety Mechanisms
```bash
# Check for manual override before automation
check_automation_allowed() {
  local ticket=$1
  local automation_eligible=$(aitrackdown show $ticket --field state_metadata.automation_eligible)
  local manual_override=$(aitrackdown show $ticket --field state_metadata.manual_override)
  
  if [[ $automation_eligible == "true" && $manual_override != "true" ]]; then
    return 0  # Automation allowed
  else
    return 1  # Manual intervention required
  fi
}
```

### 3. Error Handling and Recovery
```bash
# Robust automation with error handling
automate_transition() {
  local ticket=$1
  local new_state=$2
  local reason=$3
  
  # Validate inputs
  if ! aitrackdown show $ticket >/dev/null 2>&1; then
    echo "ERROR: Invalid ticket $ticket"
    return 1
  fi
  
  # Check automation eligibility
  if ! check_automation_allowed $ticket; then
    echo "SKIP: Automation not allowed for $ticket"
    return 0
  fi
  
  # Attempt transition with retry
  local attempts=0
  while [[ $attempts -lt 3 ]]; do
    if aitrackdown update $ticket --state $new_state --transition-reason "$reason"; then
      echo "SUCCESS: Transitioned $ticket to $new_state"
      return 0
    else
      attempts=$((attempts + 1))
      echo "RETRY: Attempt $attempts failed for $ticket"
      sleep $((attempts * 5))
    fi
  done
  
  # Failed after retries
  echo "FAILED: Could not transition $ticket after 3 attempts"
  # Disable automation for this ticket
  aitrackdown update $ticket --automation-eligible false --blocked-reason "Automation failed after retries"
  return 1
}
```

This comprehensive automation guide provides the foundation for integrating ai-trackdown's state management with your existing CI/CD and automation infrastructure, enabling streamlined workflows while maintaining proper oversight and control.