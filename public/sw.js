const CACHE = 'tantu-shell-v3';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/images/loom.png', '/images/paithani.png', '/images/diyas.png', '/images/jute.png', '/images/indigo-jute.png', '/images/pottery.png'])));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('tantu-shell-') && key !== CACHE).map((key) => caches.delete(key)))),
    self.clients.claim(),
  ]));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const path = new URL(request.url).pathname;
  if (path.startsWith('/api/')) {
    event.respondWith(fetch(request).then(async (response) => {
      let publicData = path === '/api/products' || path.startsWith('/api/artisans/') || path.startsWith('/api/passports/');
      if (response.ok && /^\/api\/products\/[^/]+$/.test(path)) {
        try { publicData = (await response.clone().json()).product?.status === 'published'; } catch { publicData = false; }
      }
      if (response.ok && publicData) {
        const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match(request).then((saved) => saved || new Response(JSON.stringify({ error: 'Offline. This data is not cached.' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))));
    return;
  }
  event.respondWith(fetch(request).then((response) => {
    if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); }
    return response;
  }).catch(() => caches.match(request).then((saved) => saved || (request.mode === 'navigate' ? caches.match('/') : Response.error()))));
});
