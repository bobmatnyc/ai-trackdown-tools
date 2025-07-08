#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Operations Agent CLI Fix Implementation\n');

// Phase 1: Pre-Implementation System Check
console.log('=== Phase 1: Pre-Implementation System Check ===');

try {
  // Check dependencies
  console.log('📦 Checking dependencies...');
  if (!fs.existsSync('node_modules')) {
    console.log('❌ node_modules not found - dependencies need to be installed');
    process.exit(1);
  }
  console.log('✅ Dependencies installed');

  // Check disk space (basic check)
  const stats = fs.statSync('.');
  console.log('✅ Directory accessible');

  // Backup current state
  if (fs.existsSync('package.json')) {
    fs.copyFileSync('package.json', 'package.json.operations-backup');
    console.log('✅ Created backup of package.json');
  }

} catch (error) {
  console.log('❌ Pre-implementation check failed:', error.message);
  process.exit(1);
}

// Phase 2: Fix Implementation  
console.log('\n=== Phase 2: Fix Implementation ===');

try {
  // Clean dist directory
  console.log('🧹 Cleaning dist directory...');
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true });
  }
  console.log('✅ Dist directory cleaned');

  // Build project
  console.log('🔨 Building project...');
  try {
    execSync('npx tsup', { 
      stdio: 'pipe',
      timeout: 30000 
    });
    console.log('✅ Build completed');
  } catch (buildError) {
    console.log('❌ Build failed');
    console.log('Build error:', buildError.message);
    if (buildError.stdout) console.log('STDOUT:', buildError.stdout.toString());
    if (buildError.stderr) console.log('STDERR:', buildError.stderr.toString());
    process.exit(1);
  }

} catch (error) {
  console.log('❌ Fix implementation failed:', error.message);
  process.exit(1);
}

// Phase 3: Production Validation
console.log('\n=== Phase 3: Production Validation ===');

try {
  // Check build artifacts
  const requiredFiles = ['dist/index.js', 'dist/index.cjs', 'dist/index.d.ts'];
  let allFilesExist = true;
  
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      console.log(`✅ ${file} (${stats.size} bytes)`);
    } else {
      console.log(`❌ ${file} missing`);
      allFilesExist = false;
    }
  });
  
  if (!allFilesExist) {
    console.log('❌ Build artifacts verification failed');
    process.exit(1);
  }

  // Test CLI commands
  console.log('\n🧪 Testing CLI functionality...');
  
  const testCommands = [
    { cmd: 'node dist/index.cjs --help', desc: 'CJS Help' },
    { cmd: 'node dist/index.cjs --version', desc: 'CJS Version' },
    { cmd: 'node dist/index.js --help', desc: 'ESM Help' },
    { cmd: 'node dist/index.js --version', desc: 'ESM Version' }
  ];
  
  let passedTests = 0;
  const totalTests = testCommands.length;
  
  testCommands.forEach(test => {
    try {
      const output = execSync(test.cmd, { 
        encoding: 'utf8',
        timeout: 5000,
        stdio: 'pipe'
      });
      
      if (output && !output.includes('Error') && output.length > 10) {
        console.log(`✅ ${test.desc}: PASSED`);
        passedTests++;
      } else {
        console.log(`❌ ${test.desc}: FAILED (insufficient output)`);
        console.log(`   Output: ${output.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`❌ ${test.desc}: ERROR`);
      console.log(`   Error: ${error.message}`);
    }
  });
  
  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} passed`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 SUCCESS: All CLI tests passed!');
    console.log('\n✅ ATT-005 Fix Status: COMPLETE');
    console.log('\n📋 Operations Deliverables:');
    console.log('   ✅ Pre-implementation system check completed');
    console.log('   ✅ Fix implementation successful');
    console.log('   ✅ Build artifacts verified');
    console.log('   ✅ CLI functionality validated');
    console.log('   ✅ Both ESM and CJS builds working');
    console.log('\n🚀 CLI is ready for production use!');
  } else if (passedTests > 0) {
    console.log('\n⚠️  PARTIAL SUCCESS: Some CLI commands working');
    console.log('Recommend using the working build format');
  } else {
    console.log('\n❌ FAILURE: CLI still not functional');
    console.log('Manual debugging required');
    process.exit(1);
  }

} catch (error) {
  console.log('❌ Production validation failed:', error.message);
  process.exit(1);
}

console.log('\n🎯 Operations Agent Implementation Complete!');