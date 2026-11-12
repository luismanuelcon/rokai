import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { version } from '../../package.json';

const updatedAt = new Date(process.env.APP_BUILD_DATE || Date.now()).toISOString();
const buildVersion = `${version}+${updatedAt.replace(/\D/g, '').slice(0, 14)}`;

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(buildVersion),
    'import.meta.env.VITE_APP_UPDATED_AT': JSON.stringify(updatedAt),
  },
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
