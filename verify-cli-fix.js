#!/usr/bin/env node

// Comprehensive CLI fix verification
const fs = require('fs');
const { execSync } = require('child_process');

console.log('🔍 Comprehensive CLI Fix Verification\n');

// Check if we need to build first
if (!fs.existsSync('dist/index.js') || !fs.existsSync('dist/index.cjs')) {
  console.log('📦 Built files missing, building first...');
  try {
    execSync('npx tsup', { stdio: 'inherit' });
    console.log('✅ Build completed\n');
  } catch (error) {
    console.log('❌ Build failed:', error.message);
    process.exit(1);
  }
}

// Function to check file content
function analyzeFile(filePath, format) {
  console.log(`🔍 Analyzing ${format} file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return false;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const stats = fs.statSync(filePath);
  
  console.log(`   File size: ${stats.size} bytes`);
  console.log(`   Content length: ${content.length} characters`);
  
  // Check for shebang
  if (content.startsWith('#!/usr/bin/env node')) {
    console.log('   ✅ Has correct shebang');
  } else {
    console.log('   ❌ Missing or incorrect shebang');
  }
  
  // Check for main() call
  const mainCallMatches = content.match(/main\(\)/g);
  if (mainCallMatches && mainCallMatches.length > 0) {
    console.log(`   ✅ Found ${mainCallMatches.length} main() calls`);
  } else {
    console.log('   ❌ No main() calls found');
  }
  
  // Check for conditional execution (the problematic pattern)
  if (content.includes('import.meta.url') || content.includes('pathToFileURL(__filename)')) {
    console.log('   ⚠️  Contains conditional execution logic (potential issue)');
  } else {
    console.log('   ✅ No conditional execution logic found');
  }
  
  // Check for commander imports
  if (content.includes('commander') || content.includes('Command')) {
    console.log('   ✅ Commander.js imported');
  } else {
    console.log('   ❌ Commander.js not found');
  }
  
  // Check for chalk imports  
  if (content.includes('chalk')) {
    console.log('   ✅ Chalk imported');
  } else {
    console.log('   ❌ Chalk not found');
  }
  
  // Look for error patterns
  const errorPatterns = ['SyntaxError', 'ReferenceError', 'TypeError', 'undefined is not'];
  const foundErrors = errorPatterns.filter(pattern => content.includes(pattern));
  if (foundErrors.length > 0) {
    console.log(`   ❌ Potential errors found: ${foundErrors.join(', ')}`);
  } else {
    console.log('   ✅ No obvious error patterns found');
  }
  
  // Extract the end of the file to see execution logic
  const endContent = content.slice(-500);
  console.log('   Last 200 chars:', endContent.slice(-200).replace(/\n/g, '\\n'));
  
  console.log('');
  return true;
}

// Function to test execution
function testExecution(filePath, format) {
  console.log(`🧪 Testing ${format} execution: ${filePath}`);
  
  try {
    const result = execSync(`node ${filePath} --help`, { 
      encoding: 'utf8', 
      timeout: 5000,
      stdio: 'pipe'
    });
    
    if (result.includes('aitrackdown') || result.includes('Usage:') || result.includes('Commands:')) {
      console.log('   ✅ CLI help output looks correct');
      console.log('   Sample output:', result.substring(0, 100).replace(/\n/g, ' ') + '...');
      return true;
    } else {
      console.log('   ❌ CLI help output unexpected');
      console.log('   Output:', result.substring(0, 200));
      return false;
    }
  } catch (error) {
    console.log('   ❌ Execution failed:', error.message);
    if (error.stdout) {
      console.log('   STDOUT:', error.stdout.toString().substring(0, 100));
    }
    if (error.stderr) {
      console.log('   STDERR:', error.stderr.toString().substring(0, 100));
    }
    return false;
  } finally {
    console.log('');
  }
}

// Main verification process
console.log('📋 File Analysis:');
const cjsAnalyzed = analyzeFile('dist/index.cjs', 'CommonJS');
const esmAnalyzed = analyzeFile('dist/index.js', 'ES Module');

console.log('🧪 Execution Testing:');
let cjsWorks = false;
let esmWorks = false;

if (cjsAnalyzed) {
  cjsWorks = testExecution('dist/index.cjs', 'CommonJS');
}

if (esmAnalyzed) {
  esmWorks = testExecution('dist/index.js', 'ES Module');
}

// Summary
console.log('📊 Summary:');
console.log(`   CommonJS build: ${cjsAnalyzed ? '✅' : '❌'} analyzed, ${cjsWorks ? '✅' : '❌'} working`);
console.log(`   ES Module build: ${esmAnalyzed ? '✅' : '❌'} analyzed, ${esmWorks ? '✅' : '❌'} working`);

if (cjsWorks || esmWorks) {
  console.log('\n🎉 SUCCESS: At least one CLI build is working!');
  
  if (cjsWorks) {
    console.log('   Recommended command: node dist/index.cjs --help');
  }
  if (esmWorks) {
    console.log('   Recommended command: node dist/index.js --help');
  }
} else {
  console.log('\n❌ FAILURE: Neither CLI build is working properly');
}

console.log('\n🎯 Verification complete!');