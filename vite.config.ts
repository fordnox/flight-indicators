import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev playground: `npm run dev`. Static demo site: `npm run build:demo` (output in demo-dist/).
export default defineConfig({
  root: 'example',
  // Relative asset paths so the demo works from any host or sub-path.
  base: './',
  plugins: [react()],
  build: {
    outDir: '../demo-dist',
    emptyOutDir: true,
  },
});
