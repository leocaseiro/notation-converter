import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base must match the GitHub Pages repo path: https://<user>.github.io/notation-converter/
export default defineConfig({
  base: '/notation-converter/',
  plugins: [react()],
});
