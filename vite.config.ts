import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createKraApiHandler } from './server/kraServer.mjs';

function kraBackendPlugin() {
  const handler = createKraApiHandler(process.cwd());
  return {
    name: 'kra-backend-middleware',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), kraBackendPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true
  }
});
