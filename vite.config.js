import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Evitar que Vite procese los archivos HTML legacy en la raíz del proyecto
  optimizeDeps: {
    entries: ['src/**/*.{js,jsx,ts,tsx}'],
  },
  server: {
    fs: {
      allow: ['.'],
    },
  },
});
