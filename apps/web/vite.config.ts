import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// VITE_API_URL se lee del .env de la raíz del repositorio (local) o del entorno de build (deploy)
export default defineConfig({
  plugins: [react()],
  envDir: '../..',
  server: { port: 5173 },
});
