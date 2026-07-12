const FALLBACK_URL = '/cold-start-fallback.html';
const CACHE_NAME = 'archislop-cold-start-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(FALLBACK_URL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  if (event.request.url.includes(FALLBACK_URL)) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        if (response.status !== 429) return response;
      } catch {
        // Fall through to branded cold-start shell.
      }

      const cache = await caches.open(CACHE_NAME);
      const fallback = await cache.match(FALLBACK_URL);
      if (fallback) {
        const redirectUrl = new URL(FALLBACK_URL, self.location.origin);
        redirectUrl.searchParams.set('returnTo', event.request.url);
        return Response.redirect(redirectUrl.toString(), 302);
      }

      return fetch(event.request);
    })()
  );
});
