import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'simple-cli': 'src/simple-cli.ts',
  },
  format: ['esm', 'cjs'],
  dts: false,
  splitting: false,
  sourcemap: false,
  clean: false,
  outDir: 'dist',
  target: 'node16',
  minify: false,
  bundle: true,
  external: [],
  noExternal: ['chalk', 'commander', 'figlet'],
  treeshake: false,
  platform: 'node',
  banner: {
    js: '#!/usr/bin/env node',
  },
  shims: true,
  keepNames: true,
  onSuccess: async () => {
    console.log('✅ Simple CLI build completed successfully');
  },
});