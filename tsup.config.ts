import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  target: 'node16',
  minify: false,
  bundle: true,
  external: ['chalk', 'commander'],
  noExternal: [],
  treeshake: true,
  platform: 'node',
  banner: {
    js: '#!/usr/bin/env node',
  },
  onSuccess: async () => {
    console.log('✅ Build completed successfully');
  },
});
