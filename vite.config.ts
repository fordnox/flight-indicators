import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Examples live in examples/<name>/. Dev playground: `npm run dev`. Static demo site: `npm run build:demo` (output in demo-dist/).
export default defineConfig({
  root: 'examples/instruments',
  // Relative asset paths so the demo works from any host or sub-path.
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../demo-dist',
    emptyOutDir: true,
    // Gallery plus the VOR / ILS page.
    rollupOptions: {
      input: {
        main: 'examples/instruments/index.html',
        navigation: 'examples/instruments/navigation.html',
      },
    },
  },
});
