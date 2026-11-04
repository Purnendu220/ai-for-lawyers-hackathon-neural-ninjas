/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// SPA fallback. /__/ is reserved by Firebase Hosting (including the /__/auth/handler sign-in
// redirect) and must always reach the network.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/__\//] }),
);

// The pdf.js worker is large, so it is cached on first use instead of precached.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.includes('pdf.worker'),
  new CacheFirst({ cacheName: 'pdf-worker' }),
);

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// Deliberately no routes for Firestore, Storage or Cloud Functions: case data and documents never
// enter service-worker caches.
