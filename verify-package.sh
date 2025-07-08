#!/bin/bash

echo "🔍 Verifying @bobmatnyc/ai-trackdown-tools package..."
echo ""

echo "📦 Checking package info..."
npm info @bobmatnyc/ai-trackdown-tools

echo ""
echo "🔍 Checking package access..."
npm access list packages @bobmatnyc | grep ai-trackdown-tools

echo ""
echo "📥 Testing package installation..."
mkdir -p /tmp/test-install-$$ 
cd /tmp/test-install-$$
npm init -y
npm install @bobmatnyc/ai-trackdown-tools@latest

echo ""
echo "🧪 Testing CLI command..."
npx aitrackdown --version

echo ""
echo "🧹 Cleaning up..."
cd /
rm -rf /tmp/test-install-$$

echo ""
echo "✅ Package verification complete!"