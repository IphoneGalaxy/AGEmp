import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Garante escuta em IPv4; sem isso, em alguns ambientes o Vite fica só em [::1]
  // e http://127.0.0.1:5173 falha com ERR_CONNECTION_REFUSED.
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom', // Necessário para localStorage, DOM, window.matchMedia
    globals: true,        // describe, it, expect disponíveis globalmente
  },
});
