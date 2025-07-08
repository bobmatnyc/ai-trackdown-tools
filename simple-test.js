#!/usr/bin/env node

// Simple test script to check CLI execution
const fs = require('fs');

console.log('🔍 Simple CLI Test');
console.log('Working directory:', process.cwd());
console.log('Node version:', process.version);
console.log('');

// Check if files exist
const files = ['dist/index.js', 'dist/index.cjs'];
files.forEach(file => {
  if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    console.log(`✅ ${file} exists (${stats.size} bytes)`);
  } else {
    console.log(`❌ ${file} missing`);
  }
});

console.log('');

// Simple execution test using require for CJS
if (fs.existsSync('dist/index.cjs')) {
  console.log('🧪 Testing CJS execution...');
  
  try {
    // Read the file content and check for issues
    const content = fs.readFileSync('dist/index.cjs', 'utf8');
    
    // Check if main execution is there
    if (content.includes('main()')) {
      console.log('✅ main() function call found in CJS');
    } else {
      console.log('❌ main() function call NOT found in CJS');
    }
    
    // Check for obvious syntax issues
    if (content.includes('SyntaxError')) {
      console.log('❌ Syntax error detected in CJS file');
    } else {
      console.log('✅ No obvious syntax errors in CJS');
    }
    
    console.log(`File size: ${content.length} characters`);
    
  } catch (error) {
    console.log('❌ Error reading CJS file:', error.message);
  }
}

console.log('');

// Check ESM file
if (fs.existsSync('dist/index.js')) {
  console.log('🧪 Testing ESM execution...');
  
  try {
    const content = fs.readFileSync('dist/index.js', 'utf8');
    
    // Check if main execution is there
    if (content.includes('main()')) {
      console.log('✅ main() function call found in ESM');
    } else {
      console.log('❌ main() function call NOT found in ESM');
    }
    
    // Check for the problematic conditional
    if (content.includes('import.meta.url')) {
      console.log('⚠️  import.meta.url conditional found (potential issue)');
    }
    
    console.log(`File size: ${content.length} characters`);
    
  } catch (error) {
    console.log('❌ Error reading ESM file:', error.message);
  }
}

console.log('');
console.log('🎯 Simple test complete!');