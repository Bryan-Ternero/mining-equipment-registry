import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// VITE_API_URL is read from the repository root .env (local) or the build environment (deploy)
export default defineConfig({
  plugins: [react()],
  envDir: '../..',
  server: { port: 5173 },
});
