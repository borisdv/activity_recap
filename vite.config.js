import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` makes the build work from any folder or sub-path
// (GitHub Pages, Netlify, a plain file server...).
export default defineConfig({
  base: './',
  plugins: [react()],
});
