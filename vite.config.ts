import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev playground: `npm run dev`
export default defineConfig({
  root: 'example',
  plugins: [react()],
});
