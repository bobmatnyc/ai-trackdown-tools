#!/usr/bin/env node

// Debug script to understand CLI execution error
const { spawn } = require('child_process');

console.log('🔍 Debug CLI Error Analysis\n');

function testCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`Testing: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
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
      resolve({
        command: `${command} ${args.join(' ')}`,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
    
    child.on('error', (error) => {
      reject({
        command: `${command} ${args.join(' ')}`,
        error: error.message
      });
    });
  });
}

async function runTests() {
  const tests = [
    ['node', ['dist/index.js', '--help']],
    ['node', ['dist/index.cjs', '--help']],
    ['node', ['dist/index.js', '--version']],
    ['node', ['dist/index.cjs', '--version']]
  ];
  
  for (const [command, args] of tests) {
    try {
      const result = await testCommand(command, args);
      console.log(`Exit code: ${result.code}`);
      
      if (result.stdout) {
        console.log(`STDOUT:\n${result.stdout}`);
      }
      
      if (result.stderr) {
        console.log(`STDERR:\n${result.stderr}`);
      }
      
      if (result.code === 0) {
        console.log('✅ SUCCESS');
      } else {
        console.log('❌ FAILED');
      }
      
      console.log('─'.repeat(50));
      
    } catch (error) {
      console.log(`❌ ERROR: ${error.error}`);
      console.log('─'.repeat(50));
    }
  }
}

runTests().catch(console.error);