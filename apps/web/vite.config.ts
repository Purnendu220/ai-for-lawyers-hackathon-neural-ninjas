import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

type HostingHeaders = { hosting: { headers: { headers: { key: string; value: string }[] }[] } };

/**
 * The Content-Security-Policy Firebase Hosting sends (firebase.json), so `vite preview` runs the
 * build under the same policy. The emulator build also talks to the local emulators over HTTP.
 */
function hostingCsp(mode: string): string {
  const config = JSON.parse(
    readFileSync(new URL('../../firebase.json', import.meta.url), 'utf8'),
  ) as HostingHeaders;
  const csp = config.hosting.headers
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === 'Content-Security-Policy')?.value;
  if (!csp) throw new Error('firebase.json has no Content-Security-Policy header');
  if (mode !== 'emulator') return csp;
  return csp
    .replace('connect-src', 'connect-src http://127.0.0.1:*')
    .replace(/;\s*upgrade-insecure-requests/, '');
}

export default defineConfig(({ mode }) => ({
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
  preview: {
    port: 4173,
    strictPort: true,
    headers: { 'Content-Security-Policy': hostingCsp(mode) },
  },
}));
