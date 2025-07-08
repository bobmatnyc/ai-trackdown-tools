#!/usr/bin/env node

// Verification script for AI Trackdown CLI fix
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${filePath} exists (${stats.size} bytes)`);
    return true;
  } else {
    console.log(`❌ ${filePath} missing`);
    return false;
  }
}

function testCommand(command, description) {
  return new Promise((resolve) => {
    exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        console.log(`❌ ${description}: ${error.message}`);
        resolve(false);
      } else {
        console.log(`✅ ${description}: Success`);
        if (stdout) console.log(`   Output: ${stdout.trim().substring(0, 100)}...`);
        resolve(true);
      }
    });
  });
}

async function verify() {
  console.log('🔍 Verifying AI Trackdown CLI Fix...\n');
  
  // Check if required files exist
  console.log('📁 Checking build files:');
  const cjsExists = checkFile('dist/index.cjs');
  const esmExists = checkFile('dist/index.js');
  const packageExists = checkFile('package.json');
  
  if (!packageExists) {
    console.log('❌ Cannot proceed without package.json');
    return;
  }
  
  // Check package.json configuration
  console.log('\n📝 Checking package.json configuration:');
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const binConfig = packageJson.bin;
  console.log(`   aitrackdown binary: ${binConfig.aitrackdown}`);
  console.log(`   atd binary: ${binConfig.atd}`);
  
  // Test CLI commands
  console.log('\n🧪 Testing CLI commands:');
  
  if (cjsExists) {
    await testCommand('node dist/index.cjs --help', 'CJS Help command');
    await testCommand('node dist/index.cjs --version', 'CJS Version command');
    await testCommand('node dist/index.cjs init --help', 'CJS Init help');
  }
  
  if (esmExists) {
    await testCommand('node dist/index.js --help', 'ESM Help command');
    await testCommand('node dist/index.js --version', 'ESM Version command');
    await testCommand('node dist/index.js init --help', 'ESM Init help');
  }
  
  console.log('\n🎯 Verification complete!');
  
  if (cjsExists || esmExists) {
    console.log('\n💡 Recommended test commands:');
    if (binConfig.aitrackdown.includes('index.cjs')) {
      console.log('   node dist/index.cjs --help');
      console.log('   node dist/index.cjs --version');
    } else {
      console.log('   node dist/index.js --help');
      console.log('   node dist/index.js --version');
    }
  }
}

verify().catch(console.error);