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
  external: [],
  noExternal: [
    'chalk', 
    'commander', 
    'inquirer', 
    'ora', 
    'boxen', 
    'figlet',
    'js-yaml',
    'yaml',
    'semver',
    'gray-matter'
  ],
  treeshake: false,
  platform: 'node',
  banner: {
    js: '#!/usr/bin/env node',
  },
  shims: true,
  keepNames: true,
  onSuccess: async () => {
    console.log('✅ Build completed successfully');
  },
});
