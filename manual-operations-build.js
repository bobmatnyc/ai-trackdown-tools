#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Manual Operations Build Process\n');

// Step 1: Clean dist directory
console.log('🧹 Step 1: Cleaning dist directory...');
try {
  const distPath = path.join(__dirname, 'dist');
  const files = fs.readdirSync(distPath);
  
  files.forEach(file => {
    if (file !== '.gitkeep') {
      const filePath = path.join(distPath, file);
      fs.unlinkSync(filePath);
      console.log(`   Removed: ${file}`);
    }
  });
  
  console.log('✅ Dist directory cleaned');
} catch (error) {
  console.log('⚠️  Dist directory already clean or not accessible');
}

// Step 2: Run tsup build using spawn for better control
console.log('\n🔨 Step 2: Running tsup build...');

const buildProcess = spawn('npx', ['tsup'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: __dirname
});

let buildOutput = '';
let buildError = '';

buildProcess.stdout.on('data', (data) => {
  const output = data.toString();
  buildOutput += output;
  console.log(output.replace(/\n$/, ''));
});

buildProcess.stderr.on('data', (data) => {
  const error = data.toString();
  buildError += error;
  console.error(error.replace(/\n$/, ''));
});

buildProcess.on('close', (code) => {
  console.log(`\n📋 Build process exited with code: ${code}`);
  
  if (code === 0) {
    console.log('✅ Build completed successfully');
    
    // Step 3: Verify artifacts
    console.log('\n📁 Step 3: Verifying build artifacts...');
    
    const requiredFiles = [
      'dist/index.js',
      'dist/index.cjs', 
      'dist/index.d.ts'
    ];
    
    let allFilesExist = true;
    requiredFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        console.log(`✅ ${file} (${stats.size} bytes)`);
      } else {
        console.log(`❌ ${file} MISSING`);
        allFilesExist = false;
      }
    });
    
    if (allFilesExist) {
      console.log('\n✅ All required build artifacts created');
      
      // Step 4: Test CLI execution
      console.log('\n🧪 Step 4: Testing CLI execution...');
      testCLIExecution();
    } else {
      console.log('\n❌ Build artifacts verification failed');
    }
    
  } else {
    console.log('❌ Build failed');
    console.log('Build output:', buildOutput);
    console.log('Build error:', buildError);
  }
});

buildProcess.on('error', (error) => {
  console.log('❌ Failed to start build process:', error.message);
});

function testCLIExecution() {
  const tests = [
    { file: 'dist/index.cjs', args: ['--help'], name: 'CJS Help' },
    { file: 'dist/index.cjs', args: ['--version'], name: 'CJS Version' },
    { file: 'dist/index.js', args: ['--help'], name: 'ESM Help' },
    { file: 'dist/index.js', args: ['--version'], name: 'ESM Version' }
  ];
  
  let passedTests = 0;
  let currentTest = 0;
  
  function runNextTest() {
    if (currentTest >= tests.length) {
      // All tests completed
      console.log(`\n📊 Test Results: ${passedTests}/${tests.length} passed`);
      
      if (passedTests === tests.length) {
        console.log('\n🎉 SUCCESS: All CLI tests passed!');
        console.log('✅ ATT-005 Operations Fix: COMPLETE');
      } else if (passedTests > 0) {
        console.log('\n⚠️  PARTIAL: Some tests passed');
      } else {
        console.log('\n❌ FAILED: No tests passed');
      }
      
      return;
    }
    
    const test = tests[currentTest];
    console.log(`\nTesting: node ${test.file} ${test.args.join(' ')}`);
    
    const testProcess = spawn('node', [test.file, ...test.args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: __dirname,
      timeout: 5000
    });
    
    let testOutput = '';
    let testError = '';
    
    testProcess.stdout.on('data', (data) => {
      testOutput += data.toString();
    });
    
    testProcess.stderr.on('data', (data) => {
      testError += data.toString();
    });
    
    testProcess.on('close', (code) => {
      if (code === 0 && testOutput && !testOutput.includes('Error') && testOutput.length > 10) {
        console.log(`✅ ${test.name}: PASSED`);
        console.log(`   Output preview: ${testOutput.substring(0, 50)}...`);
        passedTests++;
      } else {
        console.log(`❌ ${test.name}: FAILED`);
        console.log(`   Exit code: ${code}`);
        console.log(`   Output: ${testOutput.substring(0, 100)}...`);
        if (testError) {
          console.log(`   Error: ${testError.substring(0, 100)}...`);
        }
      }
      
      currentTest++;
      runNextTest();
    });
    
    testProcess.on('error', (error) => {
      console.log(`❌ ${test.name}: ERROR (${error.message})`);
      currentTest++;
      runNextTest();
    });
  }
  
  runNextTest();
}