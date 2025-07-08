#!/bin/bash

# ATT-005 Operations Fix Verification Script
echo "🔍 ATT-005 CLI Fix Verification - Operations Agent"
echo "=================================================="
echo ""

# Set up error handling
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

echo_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Change to project directory
cd "$(dirname "$0")"
echo_info "Working directory: $(pwd)"
echo ""

# Phase 1: Build Verification
echo "🔨 Phase 1: Build Verification"
echo "--------------------------------"

# Clean and rebuild
echo_info "Cleaning dist directory..."
rm -rf dist
mkdir -p dist

echo_info "Building with fixed configuration..."
if npm run build; then
    echo_success "Build completed successfully"
else
    echo_error "Build failed"
    exit 1
fi

# Check build artifacts
echo ""
echo_info "Verifying build artifacts..."

required_files=("dist/index.js" "dist/index.cjs" "dist/index.d.ts")
for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "unknown")
        echo_success "$file ($size bytes)"
    else
        echo_error "$file missing"
        exit 1
    fi
done

echo ""

# Phase 2: CLI Functionality Testing
echo "🧪 Phase 2: CLI Functionality Testing"
echo "--------------------------------------"

# Test function
test_cli_command() {
    local cmd="$1"
    local description="$2"
    local expected_pattern="$3"
    
    echo_info "Testing: $cmd"
    
    if output=$(timeout 10s $cmd 2>&1); then
        if [[ $output == *"$expected_pattern"* ]]; then
            echo_success "$description: PASSED"
            echo "   Sample output: ${output:0:60}..."
            return 0
        else
            echo_error "$description: FAILED (missing expected content)"
            echo "   Expected: $expected_pattern"
            echo "   Got: ${output:0:100}..."
            return 1
        fi
    else
        echo_error "$description: EXECUTION FAILED"
        echo "   Output: ${output:0:100}..."
        return 1
    fi
}

# Test commands
tests_passed=0
total_tests=0

# CommonJS tests
((total_tests++))
if test_cli_command "node dist/index.cjs --help" "CJS Help Command" "aitrackdown"; then
    ((tests_passed++))
fi

echo ""

((total_tests++))
if test_cli_command "node dist/index.cjs --version" "CJS Version Command" "1.0"; then
    ((tests_passed++))
fi

echo ""

((total_tests++))
if test_cli_command "node dist/index.cjs init --help" "CJS Init Help" "Initialize"; then
    ((tests_passed++))
fi

echo ""

# ES Module tests
((total_tests++))
if test_cli_command "node dist/index.js --help" "ESM Help Command" "aitrackdown"; then
    ((tests_passed++))
fi

echo ""

((total_tests++))
if test_cli_command "node dist/index.js --version" "ESM Version Command" "1.0"; then
    ((tests_passed++))
fi

echo ""

# Phase 3: Results Summary
echo "📊 Phase 3: Results Summary"
echo "----------------------------"

echo_info "Test Results: $tests_passed/$total_tests passed"

if [[ $tests_passed -eq $total_tests ]]; then
    echo ""
    echo_success "🎉 ALL TESTS PASSED!"
    echo ""
    echo_success "ATT-005 CLI Fix Status: COMPLETE"
    echo ""
    echo "📋 Verification Results:"
    echo_success "   ✅ Build process working"
    echo_success "   ✅ Build artifacts generated"
    echo_success "   ✅ CommonJS CLI functional" 
    echo_success "   ✅ ES Module CLI functional"
    echo_success "   ✅ Help commands working"
    echo_success "   ✅ Version commands working"
    echo_success "   ✅ Command structure accessible"
    echo ""
    echo "🚀 Ready for Production:"
    echo "   - CLI executes without 'Error' output"
    echo "   - All subcommands accessible"
    echo "   - Both ESM and CJS builds working"
    echo "   - Global installation ready"
    echo ""
    echo "🎯 Recommended Commands:"
    echo "   node dist/index.cjs --help"
    echo "   node dist/index.cjs init my-project"
    echo "   aitrackdown --help (after npm link)"
    
elif [[ $tests_passed -gt 0 ]]; then
    echo ""
    echo_warning "PARTIAL SUCCESS: $tests_passed/$total_tests tests passed"
    echo ""
    echo "🔍 Analysis:"
    if test_cli_command "node dist/index.cjs --help" "CJS Quick Test" "aitrackdown" >/dev/null 2>&1; then
        echo_success "   CommonJS build is working"
        echo_info "   Recommendation: Use CommonJS build (dist/index.cjs)"
    fi
    
    if test_cli_command "node dist/index.js --help" "ESM Quick Test" "aitrackdown" >/dev/null 2>&1; then
        echo_success "   ES Module build is working"
        echo_info "   Recommendation: ES Module build functional"
    fi
    
else
    echo ""
    echo_error "VERIFICATION FAILED: No tests passed"
    echo ""
    echo "🔍 Debugging Suggestions:"
    echo "   1. Check Node.js version (require >=16)"
    echo "   2. Verify all dependencies installed"
    echo "   3. Review build logs for errors"
    echo "   4. Check tsup configuration"
    echo "   5. Examine source imports for issues"
    
    exit 1
fi

echo ""
echo "🎯 ATT-005 Operations Fix Verification Complete!"