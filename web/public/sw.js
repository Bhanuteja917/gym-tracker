// SetStack service worker. Plain JS, no build step. See docs/OFFLINE-PLAN.md.
//
// Its only job is making the app open without a connection. Workout data
// never goes through here: it lives in IndexedDB and syncs via /api/sync/*,
// which this worker never touches.
//
// - App pages are static shells with no user data (screens render from the
//   on-device database), so all of them are downloaded at install, with every
//   JS/CSS file they reference, and served cache-first. Each launch re-fetches
//   the opened page in the background; when its files changed (a new deploy),
//   every shell is refreshed. A shell is replaced only after all its files are
//   cached, so an offline launch never finds a page without its code.
// - Hashed Next.js files and icons: cache-first (their URLs change when they do).
// - Everything else (API, auth, Server Actions): network only.
//
// Bump VERSION when changing this file's caching to drop old caches.
const VERSION = 'v4';
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;

const SHELLS = ['/', '/workout', '/plan', '/plan/day', '/history', '/exercises', '/exercise', '/settings', '/sign-in', '/offline'];
const STATIC_FILES = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/apple-icon.png', '/icon.svg'];

self.addEventListener('install', (event) => {
  // Install even if some files can't be fetched; launches fill the gaps.
  event.waitUntil(refreshAll().catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'refresh') event.waitUntil(refreshAll().catch(() => {}));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/') || STATIC_FILES.includes(url.pathname) || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === 'navigate' && !request.headers.has('RSC')) {
    if (SHELLS.includes(url.pathname)) {
      event.respondWith(shell(url.pathname, event));
    } else {
      event.respondWith(fetch(request).catch(() => offlinePage()));
    }
  }
});

/** Every /_next/static URL a page references (scripts, styles, preloads, RSC chunk lists). */
function assetUrls(html) {
  return new Set(html.match(/\/_next\/static\/[^"'\s)\\<>]+/g) ?? []);
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

/** Caches the given files (skipping ones already cached). Rejects if any fails. */
async function cacheAssets(urls) {
  const cache = await caches.open(ASSET_CACHE);
  await Promise.all(
    [...urls].map(async (url) => {
      if (await cache.match(url)) return;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url}: ${response.status}`);
      await cache.put(url, response);
    }),
  );
}

/**
 * Downloads a shell page and its files; stores the page only once its files
 * are all cached. Returns the page's file set, or null if it couldn't.
 */
async function updateShell(path) {
  const response = await fetch(path, { cache: 'no-cache', credentials: 'same-origin' });
  if (!response.ok || response.redirected) return null;
  const html = await response.clone().text();
  const assets = assetUrls(html);
  await cacheAssets(assets);
  const cache = await caches.open(SHELL_CACHE);
  await cache.put(path, response);
  return assets;
}

/** Refreshes every shell, then drops files no shell references any more. */
async function refreshAll() {
  await cacheAssets(STATIC_FILES).catch(() => {});
  const results = await Promise.allSettled(SHELLS.map(updateShell));
  if (results.some((r) => r.status === 'rejected' || r.value === null)) return;
  const keep = new Set(results.flatMap((r) => [...r.value]).map((u) => new URL(u, self.location.origin).href));
  for (const u of STATIC_FILES) keep.add(new URL(u, self.location.origin).href);
  const assets = await caches.open(ASSET_CACHE);
  for (const request of await assets.keys()) {
    if (!keep.has(new URL(request.url).origin + new URL(request.url).pathname)) await assets.delete(request);
  }
}

/** Cache-first shell, revalidated in the background. */
async function shell(path, event) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(path);
  const revalidate = (async () => {
    const before = cached ? assetUrls(await cached.clone().text()) : new Set();
    const after = await updateShell(path);
    // New files mean a new deploy: bring the other screens up to date too.
    if (after && [...after].some((u) => !before.has(u))) await refreshAll();
  })().catch(() => {});
  if (cached) {
    event.waitUntil(revalidate);
    return cached;
  }
  try {
    const response = await fetch(path, { credentials: 'same-origin' });
    event.waitUntil(revalidate);
    return response;
  } catch {
    return offlinePage();
  }
}

async function offlinePage() {
  return (
    (await caches.match('/offline', { cacheName: SHELL_CACHE })) ??
    new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  );
}
