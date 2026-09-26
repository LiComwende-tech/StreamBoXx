const CACHE_NAME = 'streamboxx-shell-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/streamboxx-192.png',
  '/icons/streamboxx-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('streamboxx-') && key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      return caches.open(CACHE_NAME).then((cache) => cache.put('/', copy)).then(() => response);
    }).catch(() => caches.match('/')));
    return;
  }

  if (['script', 'style', 'image', 'font'].includes(request.destination)) {
    event.respondWith(caches.match(request).then((cached) => {
      const fresh = fetch(request).then((response) => {
        const contentType = response.headers.get('content-type') ?? '';
        if (response.ok && !contentType.toLowerCase().includes('text/html')) {
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())));
        }
        return response;
      });
      return cached || fresh;
    }));
  }
});
