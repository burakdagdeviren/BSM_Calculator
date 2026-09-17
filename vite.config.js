import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative assets allow the same build to run at a domain root or a
  // repository path such as /BSM_Calculator/ on GitHub Pages.
  base: './',
});
