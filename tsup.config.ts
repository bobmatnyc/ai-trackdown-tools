import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/cli.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  target: 'node16',
  minify: false,
  bundle: true,
  external: [
    // Node.js built-in modules
    'events',
    'child_process',
    'path',
    'fs',
    'process',
    'tty',
    'os',
    'util',
    'stream',
    'crypto',
    'readline',
    'url',
    'querystring',
    // External npm packages
    'commander',
    'chalk',
    'inquirer',
    'ora',
    'boxen',
    'figlet',
    'js-yaml',
    'yaml',
    'semver',
    'gray-matter',
  ],
  noExternal: [],
  treeshake: false,
  platform: 'node',
  banner: {
    js: '#!/usr/bin/env node',
  },
  shims: true,
  keepNames: true,
  onSuccess: async () => {
    console.log('✅ Build completed successfully');

    // Copy templates to dist
    const srcTemplatesDir = path.join(process.cwd(), 'src', 'templates');
    const distTemplatesDir = path.join(process.cwd(), 'dist', 'templates');

    if (fs.existsSync(srcTemplatesDir)) {
      // Create dist/templates directory
      if (!fs.existsSync(distTemplatesDir)) {
        fs.mkdirSync(distTemplatesDir, { recursive: true });
      }

      // Copy all template files
      const templateFiles = fs.readdirSync(srcTemplatesDir);
      for (const file of templateFiles) {
        if (file.endsWith('.yaml')) {
          const srcPath = path.join(srcTemplatesDir, file);
          const distPath = path.join(distTemplatesDir, file);
          fs.copyFileSync(srcPath, distPath);
          console.log(`📦 Copied template: ${file}`);
        }
      }

      console.log('✅ Templates bundled successfully');
    } else {
      console.warn('⚠️  No templates directory found at src/templates');
    }
  },
});
