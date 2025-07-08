#!/usr/bin/env node

// Simple test to see if node execution works
console.log('CLI Test - Node execution working');
console.log('Arguments:', process.argv);
console.log('Working directory:', process.cwd());

// Try to import the built CLI
try {
  console.log('Attempting to import dist/index.js...');
  
  // Since it's an ES module, we need to use dynamic import
  import('./dist/index.js')
    .then(() => {
      console.log('Successfully imported dist/index.js');
    })
    .catch((error) => {
      console.error('Failed to import dist/index.js:', error.message);
      console.error('Error stack:', error.stack);
    });
} catch (error) {
  console.error('Failed to import:', error.message);
}