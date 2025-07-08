#!/usr/bin/env node

// Manual build and test script for CLI debugging
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Manual Build and Test Script\n');

// Function to run command and capture output
function runCommand(command, description) {
  console.log(`🚀 ${description}`);
  console.log(`Command: ${command}`);
  
  try {
    const output = execSync(command, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      cwd: process.cwd()
    });
    
    console.log('✅ Success');
    if (output.trim()) {
      console.log('Output:', output.trim());
    }
    console.log('');
    return true;
  } catch (error) {
    console.log('❌ Failed');
    console.log('Error:', error.message);
    if (error.stdout) {
      console.log('STDOUT:', error.stdout.toString());
    }
    if (error.stderr) {
      console.log('STDERR:', error.stderr.toString());
    }
    console.log('');
    return false;
  }
}

// Function to check file exists and show size
function checkFile(filePath) {
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${filePath} (${stats.size} bytes)`);
    return true;
  } else {
    console.log(`❌ ${filePath} missing`);
    return false;
  }
}

async function main() {
  // Check current status
  console.log('📁 Checking current build files:');
  checkFile('dist/index.js');
  checkFile('dist/index.cjs');
  checkFile('package.json');
  checkFile('tsup.config.ts');
  console.log('');

  // Step 1: Clean build
  console.log('🧹 Cleaning previous build...');
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
    console.log('✅ Cleaned dist directory');
  }
  console.log('');

  // Step 2: Build
  const buildSuccess = runCommand('npx tsup', 'Building with tsup');
  
  if (!buildSuccess) {
    console.log('❌ Build failed, stopping here');
    return;
  }

  // Step 3: Check built files
  console.log('📁 Checking built files:');
  const cjsExists = checkFile('dist/index.cjs');
  const esmExists = checkFile('dist/index.js');
  console.log('');

  // Step 4: Test CLI commands
  console.log('🧪 Testing CLI commands:');
  
  if (cjsExists) {
    runCommand('node dist/index.cjs --help', 'CJS --help');
    runCommand('node dist/index.cjs --version', 'CJS --version');
    runCommand('node dist/index.cjs init --help', 'CJS init --help');
  }
  
  if (esmExists) {
    runCommand('node dist/index.js --help', 'ESM --help');
    runCommand('node dist/index.js --version', 'ESM --version');  
    runCommand('node dist/index.js init --help', 'ESM init --help');
  }

  console.log('🎯 Manual build and test complete!');
}

main().catch(console.error);