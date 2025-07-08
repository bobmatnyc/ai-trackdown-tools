#!/usr/bin/env node

// Test the CJS version
console.log('Testing CJS version...');
console.log('Arguments:', process.argv);

try {
  require('./dist/index.cjs');
} catch (error) {
  console.error('CJS test failed:', error.message);
  console.error(error.stack);
}