# State Management Automation Guide

This guide provides practical examples and patterns for integrating AI-Trackdown state management with CI/CD pipelines and automation systems.

## Overview

The state management system in AI-Trackdown is designed to integrate seamlessly with modern development workflows. By automating state transitions, you can:

- Reduce manual overhead in ticket management
- Ensure consistency across development workflows
- Provide real-time visibility into project progress
- Enable data-driven project management decisions

## GitHub Actions Integration

### Basic PR to QA Workflow

```yaml
# .github/workflows/auto-resolve-qa.yml
name: Auto-resolve to QA
on:
  pull_request:
    types: [closed]
    branches: [main, develop]

jobs:
  auto-resolve-qa:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install AI-Trackdown Tools
        run: npm install -g @bobmatnyc/ai-trackdown-tools

      - name: Extract Issue ID from PR
        id: extract-issue
        run: |
          # Multiple patterns to extract issue IDs
          ISSUE_ID=""
          
          # From PR title: "Fix login bug (ISS-0123)"
          ISSUE_ID=$(echo "${{ github.event.pull_request.title }}" | grep -o 'ISS-[0-9]\+' | head -1)
          
          # From branch name: "feature/ISS-0123-login-fix"
          if [ -z "$ISSUE_ID" ]; then
            ISSUE_ID=$(echo "${{ github.event.pull_request.head.ref }}" | grep -o 'ISS-[0-9]\+' | head -1)
          fi
          
          # From PR body
          if [ -z "$ISSUE_ID" ]; then
            ISSUE_ID=$(echo "${{ github.event.pull_request.body }}" | grep -o 'ISS-[0-9]\+' | head -1)
          fi
          
          echo "issue_id=$ISSUE_ID" >> $GITHUB_OUTPUT
          echo "Found Issue ID: $ISSUE_ID"

      - name: Resolve to QA
        if: steps.extract-issue.outputs.issue_id != ''
        run: |
          aitrackdown resolve qa ${{ steps.extract-issue.outputs.issue_id }} \
            --reason "PR #${{ github.event.pull_request.number }} merged to ${{ github.event.pull_request.base.ref }}" \
            --reviewer "${{ github.event.pull_request.user.login }}" \
            --assignee "qa-team@company.com" \
            --automation-source "github-actions"

      - name: Comment on PR
        if: steps.extract-issue.outputs.issue_id != ''
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Automatically resolved ${{ steps.extract-issue.outputs.issue_id }} to QA state for testing.'
            })
```

### Deployment Pipeline Integration

```yaml
# .github/workflows/deploy-and-resolve.yml
name: Deploy and Resolve
on:
  workflow_run:
    workflows: ["CI/CD Pipeline"]
    types: [completed]
    branches: [main]

jobs:
  deploy-and-resolve:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Install AI-Trackdown Tools
        run: npm install -g @bobmatnyc/ai-trackdown-tools

      - name: Get deployment info
        id: deployment
        run: |
          # Get commit messages from the deployment
          COMMIT_MESSAGES=$(git log --oneline ${{ github.event.workflow_run.head_sha }}^..${{ github.event.workflow_run.head_sha }})
          echo "commit_messages=$COMMIT_MESSAGES" >> $GITHUB_OUTPUT

      - name: Find and resolve deployed issues
        run: |
          # Extract all issue IDs from commit messages
          ISSUE_IDS=$(echo "${{ steps.deployment.outputs.commit_messages }}" | grep -o 'ISS-[0-9]\+' | sort | uniq)
          
          for ISSUE_ID in $ISSUE_IDS; do
            echo "Processing $ISSUE_ID..."
            
            # Check current state
            CURRENT_STATE=$(aitrackdown state show $ISSUE_ID --format json | jq -r '.state')
            
            if [ "$CURRENT_STATE" = "ready_for_deployment" ]; then
              # Resolve to done
              aitrackdown resolve done $ISSUE_ID \
                --reason "Deployed to production in workflow run ${{ github.event.workflow_run.id }}" \
                --automation-source "github-actions-deploy"
              
              echo "✅ Resolved $ISSUE_ID to done"
            else
              echo "⚠️  Skipped $ISSUE_ID (current state: $CURRENT_STATE)"
            fi
          done
```

### Test Results to State Automation

```yaml
# .github/workflows/test-to-state.yml
name: Test Results to State
on:
  workflow_run:
    workflows: ["Test Suite"]
    types: [completed]

jobs:
  update-states-based-on-tests:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Install AI-Trackdown Tools
        run: npm install -g @bobmatnyc/ai-trackdown-tools

      - name: Download test results
        uses: actions/download-artifact@v3
        with:
          name: test-results
          github-token: ${{ secrets.GITHUB_TOKEN }}
          run-id: ${{ github.event.workflow_run.id }}

      - name: Process test results
        run: |
          # Parse test results and update states accordingly
          if [ -f "test-results.json" ]; then
            # Get failed tests
            FAILED_TESTS=$(jq -r '.failures[] | .test' test-results.json)
            
            # Get associated issue IDs from test files
            for TEST in $FAILED_TESTS; do
              # Extract issue ID from test file path or content
              ISSUE_ID=$(grep -o 'ISS-[0-9]\+' "$TEST" | head -1)
              
              if [ ! -z "$ISSUE_ID" ]; then
                # Move back to engineering if QA tests fail
                CURRENT_STATE=$(aitrackdown state show $ISSUE_ID --format json | jq -r '.state')
                
                if [ "$CURRENT_STATE" = "ready_for_qa" ] || [ "$CURRENT_STATE" = "ready_for_deployment" ]; then
                  aitrackdown resolve engineering $ISSUE_ID \
                    --reason "Test failure in: $TEST" \
                    --automation-source "test-automation"
                  
                  echo "🔄 Moved $ISSUE_ID back to engineering due to test failure"
                fi
              fi
            done
            
            # Process passed tests
            PASSED_COUNT=$(jq -r '.passed | length' test-results.json)
            if [ "$PASSED_COUNT" -gt 0 ]; then
              # Find issues ready for QA that passed all tests
              aitrackdown state list --state ready_for_qa --format json | \
              jq -r '.[].id' | while read ISSUE_ID; do
                # Check if this issue has tests and they all passed
                if grep -q "$ISSUE_ID" test-results.json; then
                  aitrackdown resolve deployment $ISSUE_ID \
                    --reason "All QA tests passed ($(date))" \
                    --automation-source "test-automation"
                  
                  echo "✅ Advanced $ISSUE_ID to deployment ready"
                fi
              done
            fi
          fi
```

## Jenkins Integration

### Jenkinsfile with State Management

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    environment {
        ISSUE_ID = sh(
            script: "echo '${env.BRANCH_NAME}' | grep -o 'ISS-[0-9]\\+' || echo ''",
            returnStdout: true
        ).trim()
    }
    
    stages {
        stage('Extract Issue Info') {
            steps {
                script {
                    if (env.ISSUE_ID) {
                        echo "Found Issue ID: ${env.ISSUE_ID}"
                        // Get current state
                        def currentState = sh(
                            script: "aitrackdown state show ${env.ISSUE_ID} --format json | jq -r '.state'",
                            returnStdout: true
                        ).trim()
                        env.CURRENT_STATE = currentState
                        echo "Current state: ${currentState}"
                    }
                }
            }
        }
        
        stage('Build') {
            steps {
                script {
                    // Your build steps here
                    sh 'npm install'
                    sh 'npm run build'
                }
            }
            post {
                success {
                    script {
                        if (env.ISSUE_ID && env.CURRENT_STATE == 'planning') {
                            sh """
                                aitrackdown resolve engineering ${env.ISSUE_ID} \
                                    --reason "Build successful on ${env.BUILD_ID}" \
                                    --automation-source "jenkins-build"
                            """
                        }
                    }
                }
            }
        }
        
        stage('Test') {
            steps {
                script {
                    sh 'npm test'
                    // Run specific tests for the issue
                    if (env.ISSUE_ID) {
                        sh "npm test -- --grep='${env.ISSUE_ID}'"
                    }
                }
            }
            post {
                success {
                    script {
                        if (env.ISSUE_ID && env.CURRENT_STATE == 'ready_for_engineering') {
                            sh """
                                aitrackdown resolve qa ${env.ISSUE_ID} \
                                    --reason "All tests passed in build ${env.BUILD_ID}" \
                                    --automation-source "jenkins-test"
                            """
                        }
                    }
                }
                failure {
                    script {
                        if (env.ISSUE_ID) {
                            sh """
                                aitrackdown resolve engineering ${env.ISSUE_ID} \
                                    --reason "Tests failed in build ${env.BUILD_ID}" \
                                    --automation-source "jenkins-test"
                            """
                        }
                    }
                }
            }
        }
        
        stage('Deploy to Staging') {
            when {
                anyOf {
                    branch 'develop'
                    branch 'staging'
                }
            }
            steps {
                script {
                    // Your deployment steps
                    sh 'npm run deploy:staging'
                }
            }
            post {
                success {
                    script {
                        if (env.ISSUE_ID && env.CURRENT_STATE == 'ready_for_qa') {
                            sh """
                                aitrackdown resolve deployment ${env.ISSUE_ID} \
                                    --reason "Successfully deployed to staging" \
                                    --automation-source "jenkins-deploy"
                            """
                        }
                    }
                }
            }
        }
        
        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                script {
                    sh 'npm run deploy:production'
                }
            }
            post {
                success {
                    script {
                        if (env.ISSUE_ID && env.CURRENT_STATE == 'ready_for_deployment') {
                            sh """
                                aitrackdown resolve done ${env.ISSUE_ID} \
                                    --reason "Successfully deployed to production" \
                                    --automation-source "jenkins-production"
                            """
                        }
                    }
                }
            }
        }
    }
    
    post {
        always {
            script {
                if (env.ISSUE_ID) {
                    // Generate status report
                    sh """
                        echo "=== Build Report for ${env.ISSUE_ID} ===" > build-report.txt
                        echo "Build: ${env.BUILD_ID}" >> build-report.txt
                        echo "Branch: ${env.BRANCH_NAME}" >> build-report.txt
                        echo "Status: ${currentBuild.currentResult}" >> build-report.txt
                        aitrackdown state show ${env.ISSUE_ID} >> build-report.txt
                    """
                    
                    archiveArtifacts artifacts: 'build-report.txt'
                }
            }
        }
    }
}
```

## GitLab CI Integration

```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - deploy
  - notify

variables:
  ISSUE_ID: ""

before_script:
  - npm install -g @bobmatnyc/ai-trackdown-tools
  - export ISSUE_ID=$(echo $CI_COMMIT_REF_NAME | grep -o 'ISS-[0-9]\+' || echo "")
  - echo "Issue ID: $ISSUE_ID"

build:
  stage: build
  script:
    - npm install
    - npm run build
  after_script:
    - |
      if [ ! -z "$ISSUE_ID" ]; then
        CURRENT_STATE=$(aitrackdown state show $ISSUE_ID --format json | jq -r '.state' || echo "")
        if [ "$CURRENT_STATE" = "planning" ]; then
          aitrackdown resolve engineering $ISSUE_ID \
            --reason "Build completed successfully" \
            --automation-source "gitlab-ci"
        fi
      fi

test:
  stage: test
  script:
    - npm test
    - npm run test:coverage
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  after_script:
    - |
      if [ ! -z "$ISSUE_ID" ] && [ "$CI_JOB_STATUS" = "success" ]; then
        aitrackdown resolve qa $ISSUE_ID \
          --reason "All tests passed with coverage" \
          --automation-source "gitlab-ci-test"
      elif [ ! -z "$ISSUE_ID" ] && [ "$CI_JOB_STATUS" = "failed" ]; then
        aitrackdown resolve engineering $ISSUE_ID \
          --reason "Tests failed in pipeline $CI_PIPELINE_ID" \
          --automation-source "gitlab-ci-test"
      fi

deploy_staging:
  stage: deploy
  script:
    - npm run deploy:staging
  environment:
    name: staging
    url: https://staging.example.com
  only:
    - develop
  after_script:
    - |
      if [ ! -z "$ISSUE_ID" ]; then
        aitrackdown resolve deployment $ISSUE_ID \
          --reason "Deployed to staging environment" \
          --automation-source "gitlab-ci-deploy"
      fi

deploy_production:
  stage: deploy
  script:
    - npm run deploy:production
  environment:
    name: production
    url: https://example.com
  only:
    - main
  when: manual
  after_script:
    - |
      if [ ! -z "$ISSUE_ID" ]; then
        aitrackdown resolve done $ISSUE_ID \
          --reason "Successfully deployed to production" \
          --automation-source "gitlab-ci-production"
      fi

notify_completion:
  stage: notify
  script:
    - |
      if [ ! -z "$ISSUE_ID" ]; then
        # Generate completion report
        aitrackdown state show $ISSUE_ID --verbose > completion-report.txt
        echo "Pipeline completed for $ISSUE_ID"
        
        # Send to Slack, email, etc.
        # curl -X POST -H 'Content-type: application/json' \
        #   --data "{\"text\":\"Issue $ISSUE_ID completed pipeline\"}" \
        #   $SLACK_WEBHOOK_URL
      fi
  when: always
```

## Azure DevOps Integration

```yaml
# azure-pipelines.yml
trigger:
- main
- develop
- feature/*

variables:
  issueId: $[variables['System.PullRequest.SourceBranch']]

stages:
- stage: ExtractIssueInfo
  jobs:
  - job: GetIssueId
    steps:
    - bash: |
        ISSUE_ID=$(echo "$(Build.SourceBranch)" | grep -o 'ISS-[0-9]\+' || echo "")
        echo "##vso[task.setvariable variable=issueId;isOutput=true]$ISSUE_ID"
        echo "Found Issue ID: $ISSUE_ID"
      name: extractIssue

- stage: BuildAndTest
  dependsOn: ExtractIssueInfo
  variables:
    issueId: $[ stageDependencies.ExtractIssueInfo.GetIssueId.outputs['extractIssue.issueId'] ]
  jobs:
  - job: Build
    steps:
    - task: NodeTool@0
      inputs:
        versionSpec: '18.x'
    
    - bash: npm install -g @bobmatnyc/ai-trackdown-tools
      displayName: 'Install AI-Trackdown Tools'
    
    - bash: |
        npm install
        npm run build
      displayName: 'Build application'
    
    - bash: |
        if [ ! -z "$(issueId)" ]; then
          aitrackdown resolve engineering $(issueId) \
            --reason "Build completed in Azure DevOps" \
            --automation-source "azure-devops"
        fi
      displayName: 'Update state after build'
      condition: succeeded()

  - job: Test
    dependsOn: Build
    steps:
    - bash: |
        npm test
        npm run test:e2e
      displayName: 'Run tests'
    
    - bash: |
        if [ ! -z "$(issueId)" ]; then
          aitrackdown resolve qa $(issueId) \
            --reason "All tests passed in Azure DevOps" \
            --automation-source "azure-devops-test"
        fi
      displayName: 'Update state after tests'
      condition: succeeded()
    
    - bash: |
        if [ ! -z "$(issueId)" ]; then
          aitrackdown resolve engineering $(issueId) \
            --reason "Tests failed in Azure DevOps pipeline" \
            --automation-source "azure-devops-test"
        fi
      displayName: 'Revert state on test failure'
      condition: failed()

- stage: Deploy
  dependsOn: BuildAndTest
  condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
  jobs:
  - deployment: DeployProduction
    environment: 'production'
    strategy:
      runOnce:
        deploy:
          steps:
          - bash: |
              # Deployment steps here
              echo "Deploying to production..."
            displayName: 'Deploy to production'
          
          - bash: |
              if [ ! -z "$(issueId)" ]; then
                aitrackdown resolve done $(issueId) \
                  --reason "Successfully deployed to production via Azure DevOps" \
                  --automation-source "azure-devops-deploy"
              fi
            displayName: 'Mark as done after deployment'
```

## Custom Scripts and Hooks

### Pre-commit Hook for State Validation

```bash
#!/bin/sh
# .git/hooks/pre-commit

# Check if any modified files affect tracked issues
MODIFIED_FILES=$(git diff --cached --name-only)
ISSUE_PATTERN='ISS-[0-9]+'

for FILE in $MODIFIED_FILES; do
    # Check if file contains issue references
    if grep -q "$ISSUE_PATTERN" "$FILE"; then
        ISSUE_IDS=$(grep -o "$ISSUE_PATTERN" "$FILE" | sort | uniq)
        
        for ISSUE_ID in $ISSUE_IDS; do
            # Validate issue exists and is in appropriate state
            if ! aitrackdown state show "$ISSUE_ID" >/dev/null 2>&1; then
                echo "Error: Referenced issue $ISSUE_ID not found"
                exit 1
            fi
            
            # Check if issue is in active state
            CURRENT_STATE=$(aitrackdown state show "$ISSUE_ID" --format json | jq -r '.state')
            if [ "$CURRENT_STATE" != "active" ] && [ "$CURRENT_STATE" != "ready_for_engineering" ]; then
                echo "Warning: Issue $ISSUE_ID is in state '$CURRENT_STATE' but being modified"
                echo "Consider updating the issue state before committing"
            fi
        done
    fi
done
```

### Post-receive Hook for Automatic Resolution

```bash
#!/bin/bash
# git-hooks/post-receive

while read oldrev newrev refname; do
    # Only process main branch
    if [ "$refname" = "refs/heads/main" ]; then
        # Get commit messages
        COMMITS=$(git rev-list "$oldrev".."$newrev")
        
        for COMMIT in $COMMITS; do
            MESSAGE=$(git log -1 --pretty=format:"%s" "$COMMIT")
            
            # Extract issue IDs from commit message
            ISSUE_IDS=$(echo "$MESSAGE" | grep -o 'ISS-[0-9]\+' | sort | uniq)
            
            for ISSUE_ID in $ISSUE_IDS; do
                # Check for resolution keywords
                if echo "$MESSAGE" | grep -qi "fix\|close\|resolve\|complete"; then
                    aitrackdown resolve qa "$ISSUE_ID" \
                        --reason "Fixed in commit $COMMIT" \
                        --automation-source "git-hook"
                fi
            done
        done
    fi
done
```

### Slack Integration Script

```bash
#!/bin/bash
# scripts/slack-notify.sh

ISSUE_ID="$1"
STATE="$2"
REASON="$3"

if [ -z "$ISSUE_ID" ] || [ -z "$STATE" ]; then
    echo "Usage: $0 <issue-id> <state> [reason]"
    exit 1
fi

# Get issue details
ISSUE_DATA=$(aitrackdown state show "$ISSUE_ID" --format json)
TITLE=$(echo "$ISSUE_DATA" | jq -r '.title')
ASSIGNEE=$(echo "$ISSUE_DATA" | jq -r '.assignee')

# Format state for display
DISPLAY_STATE=$(echo "$STATE" | tr '_' ' ' | tr '[:lower:]' '[:upper:]')

# Create Slack message
SLACK_MESSAGE=$(cat <<EOF
{
  "channel": "#development",
  "username": "AI-Trackdown Bot",
  "icon_emoji": ":robot_face:",
  "attachments": [
    {
      "color": "good",
      "title": "Issue State Updated",
      "fields": [
        {
          "title": "Issue",
          "value": "$ISSUE_ID: $TITLE",
          "short": false
        },
        {
          "title": "New State",
          "value": "$DISPLAY_STATE",
          "short": true
        },
        {
          "title": "Assignee",
          "value": "$ASSIGNEE",
          "short": true
        }
      ]
    }
  ]
}
EOF
)

if [ ! -z "$REASON" ]; then
    SLACK_MESSAGE=$(echo "$SLACK_MESSAGE" | jq --arg reason "$REASON" '.attachments[0].fields += [{"title": "Reason", "value": $reason, "short": false}]')
fi

# Send to Slack
curl -X POST -H 'Content-type: application/json' \
    --data "$SLACK_MESSAGE" \
    "$SLACK_WEBHOOK_URL"
```

### Email Notification Script

```bash
#!/bin/bash
# scripts/email-notify.sh

ISSUE_ID="$1"
STATE="$2"
ASSIGNEE_EMAIL="$3"

# Get issue details
ISSUE_DATA=$(aitrackdown state show "$ISSUE_ID" --format json)
TITLE=$(echo "$ISSUE_DATA" | jq -r '.title')
CURRENT_STATE=$(echo "$ISSUE_DATA" | jq -r '.state')

# Create email content
EMAIL_SUBJECT="Issue $ISSUE_ID Updated: $TITLE"
EMAIL_BODY=$(cat <<EOF
Issue $ISSUE_ID has been updated.

Title: $TITLE
New State: $(echo "$CURRENT_STATE" | tr '_' ' ' | tr '[:lower:]' '[:upper:]')
Assigned to: $ASSIGNEE_EMAIL

View details: https://your-project.com/issues/$ISSUE_ID

This is an automated notification from AI-Trackdown.
EOF
)

# Send email (using sendmail, SES, etc.)
echo "$EMAIL_BODY" | mail -s "$EMAIL_SUBJECT" "$ASSIGNEE_EMAIL"
```

## Monitoring and Analytics

### Daily State Report Script

```bash
#!/bin/bash
# scripts/daily-report.sh

DATE=$(date +%Y-%m-%d)
REPORT_FILE="reports/state-report-$DATE.json"

# Create reports directory
mkdir -p reports

# Generate comprehensive report
ANALYTICS=$(aitrackdown state analytics --format json)
VALIDATION=$(aitrackdown state validate --format json 2>/dev/null || echo '{"valid": false}')

# Create combined report
REPORT=$(cat <<EOF
{
  "date": "$DATE",
  "analytics": $ANALYTICS,
  "validation": $VALIDATION,
  "active_issues": $(aitrackdown state list --state active --format json),
  "qa_ready": $(aitrackdown state list --state ready_for_qa --format json),
  "deployment_ready": $(aitrackdown state list --state ready_for_deployment --format json)
}
EOF
)

echo "$REPORT" > "$REPORT_FILE"

# Send summary email
TOTAL_ITEMS=$(echo "$ANALYTICS" | jq '.total_items')
QA_COUNT=$(echo "$ANALYTICS" | jq '.state_distribution.ready_for_qa // 0')
DEPLOY_COUNT=$(echo "$ANALYTICS" | jq '.state_distribution.ready_for_deployment // 0')

EMAIL_BODY=$(cat <<EOF
Daily AI-Trackdown State Report - $DATE

Summary:
- Total Items: $TOTAL_ITEMS
- Ready for QA: $QA_COUNT
- Ready for Deployment: $DEPLOY_COUNT

Full report available at: $REPORT_FILE
EOF
)

echo "$EMAIL_BODY" | mail -s "Daily State Report - $DATE" "team@company.com"
```

### Prometheus Metrics Export

```bash
#!/bin/bash
# scripts/export-metrics.sh

# Generate metrics file for Prometheus scraping
METRICS_FILE="/var/lib/prometheus/node-exporter/ai_trackdown.prom"

# Get analytics data
ANALYTICS=$(aitrackdown state analytics --format json)

# Extract metrics
TOTAL_ITEMS=$(echo "$ANALYTICS" | jq '.total_items')
PLANNING_COUNT=$(echo "$ANALYTICS" | jq '.state_distribution.planning // 0')
ACTIVE_COUNT=$(echo "$ANALYTICS" | jq '.state_distribution.active // 0')
QA_COUNT=$(echo "$ANALYTICS" | jq '.state_distribution.ready_for_qa // 0')
DEPLOY_COUNT=$(echo "$ANALYTICS" | jq '.state_distribution.ready_for_deployment // 0')
DONE_COUNT=$(echo "$ANALYTICS" | jq '.state_distribution.done // 0')

# Write Prometheus metrics
cat > "$METRICS_FILE" <<EOF
# HELP ai_trackdown_total_items Total number of tracked items
# TYPE ai_trackdown_total_items gauge
ai_trackdown_total_items $TOTAL_ITEMS

# HELP ai_trackdown_items_by_state Number of items in each state
# TYPE ai_trackdown_items_by_state gauge
ai_trackdown_items_by_state{state="planning"} $PLANNING_COUNT
ai_trackdown_items_by_state{state="active"} $ACTIVE_COUNT
ai_trackdown_items_by_state{state="ready_for_qa"} $QA_COUNT
ai_trackdown_items_by_state{state="ready_for_deployment"} $DEPLOY_COUNT
ai_trackdown_items_by_state{state="done"} $DONE_COUNT
EOF

echo "Metrics exported to $METRICS_FILE"
```

## Error Handling and Recovery

### Automation Error Recovery Script

```bash
#!/bin/bash
# scripts/automation-recovery.sh

# Check for items stuck in invalid states
INVALID_ITEMS=$(aitrackdown state validate --format json | jq -r '.errors[]' 2>/dev/null || echo "")

if [ ! -z "$INVALID_ITEMS" ]; then
    echo "Found invalid items, attempting recovery..."
    
    # Process each invalid item
    echo "$INVALID_ITEMS" | while IFS= read -r ERROR; do
        ISSUE_ID=$(echo "$ERROR" | grep -o 'ISS-[0-9]\+')
        
        if [ ! -z "$ISSUE_ID" ]; then
            echo "Attempting to fix $ISSUE_ID..."
            
            # Get current state
            CURRENT_STATE=$(aitrackdown state show "$ISSUE_ID" --format json | jq -r '.state' 2>/dev/null)
            
            # Try to fix common issues
            if [ -z "$CURRENT_STATE" ] || [ "$CURRENT_STATE" = "null" ]; then
                # Missing state, set to active
                aitrackdown state update "$ISSUE_ID" active \
                    --reason "Automated recovery: missing state" \
                    --automation-source "recovery-script"
            fi
        fi
    done
fi

# Check for items with missing state metadata
aitrackdown state list --format json | jq -r '.[] | select(.state_metadata == null) | .id' | while read ISSUE_ID; do
    if [ ! -z "$ISSUE_ID" ]; then
        echo "Fixing missing metadata for $ISSUE_ID"
        CURRENT_STATE=$(aitrackdown state show "$ISSUE_ID" --format json | jq -r '.state')
        
        # Re-apply current state to generate metadata
        aitrackdown state update "$ISSUE_ID" "$CURRENT_STATE" \
            --reason "Automated recovery: missing metadata" \
            --automation-source "recovery-script"
    fi
done
```

## Best Practices for Automation

### 1. Error Handling
- Always check if issue IDs exist before attempting state changes
- Include meaningful error messages and rollback procedures
- Log all automation actions for audit trails

### 2. State Validation
- Verify current state before attempting transitions
- Use dry-run mode to test automation scripts
- Implement validation checks in automation workflows

### 3. Notification Strategies
- Send notifications for state changes that require human attention
- Use different channels for different types of updates
- Include relevant context in notifications

### 4. Performance Considerations
- Use batch operations for multiple items
- Implement rate limiting for high-frequency automation
- Cache state information when processing many items

### 5. Security and Access Control
- Use dedicated service accounts for automation
- Limit automation permissions to necessary operations only
- Audit and monitor automated state changes

### 6. Testing and Validation
- Test automation scripts in development environments
- Use feature flags to enable/disable automation
- Monitor automation success rates and failures

This comprehensive automation guide provides the foundation for integrating AI-Trackdown state management into modern development workflows. Adapt these examples to your specific tools and requirements for optimal results.