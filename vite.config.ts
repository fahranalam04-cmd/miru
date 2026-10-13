import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://<user>.github.io/miru/ on GitHub Pages.
export default defineConfig({
  base: '/miru/',
  plugins: [react()],
});
