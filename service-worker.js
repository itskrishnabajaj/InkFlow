/**
 * service-worker.js — InkFlow PWA Service Worker
 *
 * Strategy:
 *   - App shell (HTML/CSS/JS/fonts): Cache-first, network fallback
 *   - PDF.js CDN assets: Cache-first (these are large and immutable)
 *   - PDF files (user content): NOT cached here (stored in IndexedDB by app)
 *
 * The SW ensures the app works offline after first load.
 */

'use strict';

const CACHE_NAME   = 'inkflow-v1';
const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './gestures.js',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
];

const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
];

/* ── Install: pre-cache shell ── */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache shell assets (must all succeed)
      try { await cache.addAll(SHELL_ASSETS); } catch (err) {
        console.warn('[SW] Shell caching partial failure:', err);
      }
      // Cache CDN assets individually (non-fatal if network unavailable at install)
      for (const url of CDN_ASSETS) {
        try { await cache.add(url); } catch (_) {}
      }
    })
  );
  // Activate immediately
  self.skipWaiting();
});

/* ── Activate: clean old caches ── */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ── Fetch: smart routing ── */
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip non-GET requests
  if (e.request.method !== 'GET') return;

  // Skip blob: and data: URLs
  if (url.protocol === 'blob:' || url.protocol === 'data:') return;

  // Skip IndexedDB / chrome-extension
  if (url.protocol === 'chrome-extension:') return;

  // CDN assets — cache-first, long TTL
  if (url.host === 'cdnjs.cloudflare.com') {
    e.respondWith(cacheFirst(e.request, true));
    return;
  }

  // App shell — cache-first, network fallback
  e.respondWith(cacheFirst(e.request, false));
});

/**
 * Cache-first strategy.
 * @param {Request} request
 * @param {boolean} updateIfFresh — if true, return cache even if network newer (CDN)
 */
async function cacheFirst(request, updateIfFresh) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    // Optionally revalidate in background (stale-while-revalidate for shell)
    if (!updateIfFresh) {
      fetchAndCache(request, cache).catch(() => {});
    }
    return cached;
  }

  // Not in cache — fetch from network
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Offline fallback — return index.html for navigation requests
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function fetchAndCache(request, cache) {
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}
