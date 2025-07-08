#!/usr/bin/env node

// Test script for the CLI build fix
const { execSync, spawn } = require('child_process');
const fs = require('fs');

console.log('🔧 Testing CLI Build Fix\n');

// Step 1: Clean and build
console.log('🧹 Cleaning and building...');
try {
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true });
    console.log('✅ Cleaned dist directory');
  }
  
  console.log('🔨 Building with tsup...');
  const buildOutput = execSync('npx tsup', { encoding: 'utf8', stdio: 'pipe' });
  console.log('✅ Build completed');
  if (buildOutput.trim()) {
    console.log('Build output:', buildOutput.trim());
  }
} catch (error) {
  console.log('❌ Build failed:', error.message);
  if (error.stdout) console.log('STDOUT:', error.stdout.toString());
  if (error.stderr) console.log('STDERR:', error.stderr.toString());
  process.exit(1);
}

console.log('');

// Step 2: Check built files
console.log('📁 Checking built files:');
const files = ['dist/index.js', 'dist/index.cjs'];
files.forEach(file => {
  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    console.log(`✅ ${file} (${stats.size} bytes)`);
  } else {
    console.log(`❌ ${file} missing`);
    return;
  }
});

console.log('');

// Step 3: Test CLI execution
console.log('🧪 Testing CLI execution:');

function testCommand(command, description) {
  return new Promise((resolve) => {
    console.log(`Testing: ${command}`);
    
    const [cmd, ...args] = command.split(' ');
    const child = spawn(cmd, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0 && stdout.includes('aitrackdown')) {
        console.log(`✅ ${description}: SUCCESS`);
        console.log(`   Output contains expected CLI help`);
      } else if (code === 0) {
        console.log(`⚠️  ${description}: Command ran but output unexpected`);
        console.log(`   Exit code: ${code}`);
        console.log(`   STDOUT: ${stdout.substring(0, 100)}...`);
      } else {
        console.log(`❌ ${description}: FAILED`);
        console.log(`   Exit code: ${code}`);
        if (stdout) console.log(`   STDOUT: ${stdout.substring(0, 100)}...`);
        if (stderr) console.log(`   STDERR: ${stderr.substring(0, 100)}...`);
      }
      console.log('');
      resolve(code === 0);
    });
    
    child.on('error', (error) => {
      console.log(`❌ ${description}: ERROR - ${error.message}`);
      console.log('');
      resolve(false);
    });
  });
}

async function runTests() {
  const results = [];
  
  // Test CJS
  if (fs.existsSync('dist/index.cjs')) {
    results.push(await testCommand('node dist/index.cjs --help', 'CJS --help'));
    results.push(await testCommand('node dist/index.cjs --version', 'CJS --version'));
  }
  
  // Test ESM  
  if (fs.existsSync('dist/index.js')) {
    results.push(await testCommand('node dist/index.js --help', 'ESM --help'));
    results.push(await testCommand('node dist/index.js --version', 'ESM --version'));
  }
  
  const successCount = results.filter(Boolean).length;
  const totalCount = results.length;
  
  console.log(`🎯 Test Results: ${successCount}/${totalCount} tests passed`);
  
  if (successCount === totalCount) {
    console.log('🎉 All tests passed! CLI execution fixed!');
  } else {
    console.log('❌ Some tests failed. CLI still has issues.');
  }
}

runTests().catch(console.error);