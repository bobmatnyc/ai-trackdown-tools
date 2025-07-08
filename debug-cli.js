#!/usr/bin/env node

// Debug script to identify CLI execution issues
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Debugging CLI Execution Issues...\n');

// Check Node version
console.log('Node version:', process.version);
console.log('Working directory:', process.cwd());

// Check if files exist
const files = [
  'dist/index.js',
  'dist/index.cjs',
  'package.json',
  'VERSION'
];

console.log('\n📁 File existence check:');
files.forEach(file => {
  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    console.log(`✅ ${file} (${stats.size} bytes)`);
  } else {
    console.log(`❌ ${file} missing`);
  }
});

// Test basic Node execution
console.log('\n🧪 Testing Node execution:');

function testNodeExecution(command, description) {
  return new Promise((resolve) => {
    console.log(`Testing: ${command}`);
    
    const child = spawn('node', command.split(' ').slice(1), {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
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
      console.log(`  Exit code: ${code}`);
      
      if (stdout) {
        console.log(`  STDOUT: ${stdout.substring(0, 200)}${stdout.length > 200 ? '...' : ''}`);
      }
      
      if (stderr) {
        console.log(`  STDERR: ${stderr.substring(0, 200)}${stderr.length > 200 ? '...' : ''}`);
      }
      
      console.log('');
      resolve({ code, stdout, stderr });
    });
    
    child.on('error', (error) => {
      console.log(`  Error: ${error.message}`);
      console.log('');
      resolve({ error: error.message });
    });
  });
}

async function runTests() {
  // Test 1: Simple node execution
  await testNodeExecution('node -e "console.log(\'Node works\')"', 'Basic Node test');
  
  // Test 2: Test ES module loading with a simple test
  await testNodeExecution('node -e "import(\\"./dist/index.js\\").then(() => console.log(\'Import success\')).catch(e => console.error(\'Import error:\', e.message))"', 'ES Module import test');
  
  // Test 3: Test CJS loading
  await testNodeExecution('node dist/index.cjs --help', 'CJS CLI help');
  
  // Test 4: Test ESM loading
  await testNodeExecution('node dist/index.js --help', 'ESM CLI help');
  
  console.log('🎯 Debug testing complete!');
}

runTests().catch(console.error);