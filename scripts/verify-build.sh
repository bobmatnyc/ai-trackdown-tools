#!/bin/bash

# AI-Trackdown Build Verification Script
# Verifies that all GitHub API dependencies have been removed and build system is clean

echo "🔧 AI-Trackdown Build System Verification"
echo "=========================================="

# Check 1: Verify no GitHub API imports remain
echo "✅ Checking for remaining GitHub API imports..."
if grep -r "github-api" src/ 2>/dev/null; then
    echo "❌ Found remaining GitHub API imports!"
    exit 1
else
    echo "✅ No GitHub API imports found"
fi

# Check 2: Verify build succeeds
echo "✅ Testing build process..."
if npm run build; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

# Check 3: Verify CLI executable works
echo "✅ Testing CLI executable..."
if ./dist/index.js --version; then
    echo "✅ CLI executable works"
else
    echo "❌ CLI executable failed"
    exit 1
fi

# Check 4: Verify migration command exists
echo "✅ Testing migration command..."
if ./dist/index.js migrate --help > /dev/null 2>&1; then
    echo "✅ Migration command available"
else
    echo "❌ Migration command not found"
    exit 1
fi

# Check 5: Verify YAML dependencies are installed
echo "✅ Checking YAML processing dependencies..."
if npm list yaml gray-matter js-yaml > /dev/null 2>&1; then
    echo "✅ YAML dependencies installed"
else
    echo "❌ Missing YAML dependencies"
    exit 1
fi

# Check 6: Verify package.json has no GitHub API deps
echo "✅ Checking package.json for GitHub API dependencies..."
if grep -E "(octokit|@octokit|github-api)" package.json; then
    echo "❌ Found GitHub API dependencies in package.json"
    exit 1
else
    echo "✅ No GitHub API dependencies in package.json"
fi

# Check 7: Test new architecture commands
echo "✅ Testing new architecture commands..."
commands=("epic" "issue" "task" "ai" "migrate")
for cmd in "${commands[@]}"; do
    if ./dist/index.js "$cmd" --help > /dev/null 2>&1; then
        echo "✅ Command '$cmd' available"
    else
        echo "❌ Command '$cmd' not found"
        exit 1
    fi
done

echo ""
echo "🎉 Build System Verification Complete!"
echo "✅ All GitHub API dependencies removed"
echo "✅ Build system operational"
echo "✅ New ai-trackdown architecture ready"
echo "✅ Migration tooling available"
echo ""
echo "🚀 Ready for production deployment!"