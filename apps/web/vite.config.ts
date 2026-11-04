import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Our own service worker (src/pwa/sw.ts) so FCM push can share it later (docs/ARCHITECTURE.md §4.6).
      strategies: 'injectManifest',
      srcDir: 'src/pwa',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['**/pdf.worker*'],
      },
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'CasePilot AI',
        short_name: 'CasePilot',
        description:
          'AI-powered legal case management: court orders become reviewable action plans.',
        start_url: '/dashboard',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#1e2a4a',
        background_color: '#f8fafc',
        lang: 'en-IN',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'New case', url: '/cases/new' },
          { name: 'My tasks', url: '/tasks' },
        ],
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
