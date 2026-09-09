/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Offline support is an architectural commitment (Architecture Decisions D11).
    // The service worker is wired from day one; WHICH operations may run offline
    // is decided per feature in later phases.
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { navigateFallback: '/index.html' },
      manifest: {
        name: 'Motion ERP',
        short_name: 'Motion ERP',
        description: 'Configurable enterprise resource planning platform',
        theme_color: '#1f2933',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
