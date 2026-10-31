import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // El API corre aparte; el proxy mantiene el mismo origen y evita CORS.
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: false },
    },
  },
  // Sin sourcemap en producción: eran 1,6 MB servidos públicamente (y el código fuente con ellos).
  build: { outDir: 'dist', sourcemap: false },
});
