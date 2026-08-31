// frontend/vite.config.js
// Proxy /api menuju backend (port 3000) selama development,
// sesuai File 2 Bagian 6.2 (menghindari masalah CORS).

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true, // diperlukan agar auto-cleanup @testing-library/react aktif antar test
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
});
