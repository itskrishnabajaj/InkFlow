/**
 * service-worker.js — InkCraft
 *
 * Caches the app shell (HTML/CSS/JS modules/icons) and the Three.js CDN module
 * so the game works offline after the first online load. Cache-first with a
 * background revalidate; runtime-caches any other same-origin / CDN GETs.
 */

'use strict';

const CACHE_NAME = 'inkcraft-v1';

const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './src/main.js',
  './src/engine/noise.js',
  './src/engine/blocks.js',
  './src/engine/textures.js',
  './src/world/world.js',
  './src/world/chunk.js',
  './src/world/chunkManager.js',
  './src/world/sky.js',
  './src/player/player.js',
  './src/player/controls.js',
  './src/ui/hud.js',
  './src/audio/sfx.js',
  './src/save/storage.js',
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      try { await cache.addAll(SHELL_ASSETS); } catch (err) {
        console.warn('[SW] shell cache partial failure', err);
      }
      for (const url of CDN_ASSETS) {
        try { await cache.add(url); } catch (_) {}
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.protocol === 'blob:' || url.protocol === 'data:' || url.protocol === 'chrome-extension:') return;
  e.respondWith(cacheFirst(e.request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    fetchAndCache(request, cache).catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
    return response;
  } catch (err) {
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function fetchAndCache(request, cache) {
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
  return response;
}
