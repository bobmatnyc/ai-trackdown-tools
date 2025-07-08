#!/usr/bin/env node

// Manual build script to rebuild the CLI
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function build() {
  try {
    console.log('Starting manual build...');
    
    // Clean dist directory
    console.log('Cleaning dist directory...');
    await execAsync('rm -rf dist');
    
    // Run tsup build
    console.log('Running tsup build...');
    const { stdout, stderr } = await execAsync('npx tsup');
    
    if (stdout) console.log('Build output:', stdout);
    if (stderr) console.log('Build errors:', stderr);
    
    console.log('Build completed!');
    
    // Test the CLI
    console.log('Testing CLI...');
    const { stdout: testOutput } = await execAsync('node dist/index.js --help');
    console.log('CLI test output:', testOutput);
    
  } catch (error) {
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}

build();