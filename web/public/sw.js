// Gym Tracker service worker. Plain JS, no build step.
//
// - Hashed Next.js assets and icons: cache-first (their URLs change when they do).
// - Page loads: network-first; a copy of each page you open is kept so the app
//   can show it again when launched without a connection, falling back to
//   /offline for pages never opened.
// - API calls, Server Actions and RSC requests always go to the network.
//
// Bump VERSION to drop old caches after changing this file.
const VERSION = 'v1';
const STATIC_CACHE = `static-${VERSION}`;
const PAGES_CACHE = `pages-${VERSION}`;
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== PAGES_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'clear-pages') event.waitUntil(caches.delete(PAGES_CACHE));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate' && !request.headers.has('RSC')) {
    event.respondWith(networkFirstPage(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    // Keep only real pages: not the sign-in redirect, not errors.
    const url = new URL(response.url);
    if (response.ok && !response.redirected && url.pathname !== '/sign-in') {
      const cache = await caches.open(PAGES_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (
      (await caches.match(request, { cacheName: PAGES_CACHE })) ??
      (await caches.match(OFFLINE_URL)) ??
      new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
    );
  }
}
