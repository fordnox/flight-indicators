import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  // Components use hooks, so mark the bundle as client-only for Next.js App Router / RSC.
  banner: { js: '"use client";' },
});
