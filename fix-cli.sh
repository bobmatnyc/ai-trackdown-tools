#!/bin/bash

# Fix AI Trackdown CLI Script
echo "🔧 Starting AI Trackdown CLI Fix..."

# Change to project directory
cd "$(dirname "$0")"

echo "📍 Working directory: $(pwd)"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Clean dist directory
echo "🧹 Cleaning dist directory..."
rm -rf dist

# Rebuild the project
echo "🔨 Building project..."
npm run build

# Check if build was successful
if [ ! -f "dist/index.js" ]; then
    echo "❌ ESM build failed!"
    exit 1
fi

if [ ! -f "dist/index.cjs" ]; then
    echo "❌ CJS build failed!"
    exit 1
fi

# Test both versions
echo "🧪 Testing ESM version..."
if node dist/index.js --help > /dev/null 2>&1; then
    echo "✅ ESM version works!"
    ESM_WORKS=true
else
    echo "❌ ESM version failed"
    ESM_WORKS=false
fi

echo "🧪 Testing CJS version..."
if node dist/index.cjs --help > /dev/null 2>&1; then
    echo "✅ CJS version works!"
    CJS_WORKS=true
else
    echo "❌ CJS version failed"
    CJS_WORKS=false
fi

# Update package.json to use working version
if [ "$CJS_WORKS" = true ]; then
    echo "📝 Configuring to use CJS version..."
    sed -i.bak 's/"aitrackdown": "dist\/index\.js"/"aitrackdown": "dist\/index.cjs"/g' package.json
    sed -i.bak 's/"atd": "dist\/index\.js"/"atd": "dist\/index.cjs"/g' package.json
    rm package.json.bak
    echo "✅ CLI fixed! Using CJS version."
elif [ "$ESM_WORKS" = true ]; then
    echo "📝 Configuring to use ESM version..."
    sed -i.bak 's/"aitrackdown": "dist\/index\.cjs"/"aitrackdown": "dist\/index.js"/g' package.json
    sed -i.bak 's/"atd": "dist\/index\.cjs"/"atd": "dist\/index.js"/g' package.json
    rm package.json.bak
    echo "✅ CLI fixed! Using ESM version."
else
    echo "❌ Both versions failed! Check build errors."
    exit 1
fi

# Final test
echo "🎯 Final CLI test..."
if node dist/index.cjs --help > /dev/null 2>&1 || node dist/index.js --help > /dev/null 2>&1; then
    echo "🎉 AI Trackdown CLI is now working!"
    echo ""
    echo "Test commands:"
    echo "  node dist/index.cjs --help"
    echo "  node dist/index.cjs --version"
    echo "  node dist/index.cjs init --help"
    echo ""
else
    echo "❌ Final test failed"
    exit 1
fi