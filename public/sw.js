const CACHE_NAME = 'shulea-v12';
const APP_SHELL_URLS = [
  '/',
  '/manifest.json',
  '/shulea-logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/sql-wasm.wasm',
];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(APP_SHELL_URLS.map((url) => cache.add(url)));

  try {
    const response = await fetch('/', { cache: 'reload' });
    if (response && response.ok) {
      await cache.put('/', response.clone());
      const html = await response.text();
      const urls = new Set();
      const matches = html.matchAll(/["'](\/_next\/static\/[^"']+)["']/g);
      for (const match of matches) urls.add(match[1]);
      await Promise.allSettled(Array.from(urls).map((url) => cache.add(url)));
    }
  } catch {
    // Keep any previously cached shell; offline install/update should not break the app.
  }
}

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell());
  self.skipWaiting();
});

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'SHULEA_PRECACHE_URLS') return;
  const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const sameOriginAssets = urls.filter((url) => {
        try {
          const parsed = new URL(url, self.location.origin);
          return parsed.origin === self.location.origin && parsed.pathname.startsWith('/_next/static/');
        } catch {
          return false;
        }
      });
      return Promise.allSettled(sameOriginAssets.map((url) => cache.add(url)));
    })
  );
});

// Fetch event - app-shell navigation fallback plus runtime cache for same-origin assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(() => new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })));
    return;
  }

  if (requestUrl.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;

        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
            return response;
          })
          .catch(() => caches.match(event.request));
      })
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', responseToCache));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        const fetchRequest = event.request.clone();

        return fetch(fetchRequest)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')));
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
