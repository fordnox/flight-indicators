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
    // Gallery plus the VOR / ILS page and the Cessna 182T panel.
    rollupOptions: {
      input: {
        main: 'examples/instruments/index.html',
        navigation: 'examples/instruments/navigation.html',
        panel182: 'examples/instruments/panel182.html',
      },
    },
  },
});
