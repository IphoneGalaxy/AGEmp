import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom', // Necessário para localStorage, DOM, window.matchMedia
    globals: true,        // describe, it, expect disponíveis globalmente
  },
});
