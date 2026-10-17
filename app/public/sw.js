/* Nemor Cards — hand-written service worker (no Workbox).
 *
 * Strategy:
 *   - Navigations (mode === 'navigate'): network-first, fall back to the cached
 *     SPA shell ('/') when offline.
 *   - Same-origin GET static assets (.js/.css/.png/.woff2/...):
 *     stale-while-revalidate.
 *   - /api/* : NEVER cached — always go to the network, bypass the SW logic.
 *
 * Bump CACHE_VERSION to invalidate old caches on the next activate.
 */

const CACHE_VERSION = 'nemor-v1';
const APP_SHELL = ['/', '/manifest.json'];

// Static assets we serve stale-while-revalidate.
const STATIC_RE = /\.(?:js|mjs|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|otf|json|map)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET; let everything else hit the network untouched.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never touch the API — always straight to the network, no caching.
  if (url.pathname.startsWith('/api/')) return;

  // SPA navigations: network-first, fall back to the cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request));
    return;
  }

  // Same-origin static assets: stale-while-revalidate.
  if (url.origin === self.location.origin && STATIC_RE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirstShell(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const fresh = await fetch(request);
    // Keep the shell warm for the next offline visit.
    cache.put('/', fresh.clone()).catch(() => {});
    return fresh;
  } catch (_) {
    return (await cache.match('/')) || (await cache.match(request)) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === 'basic') {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}
