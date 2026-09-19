const APP_CACHE = "radio-t-app-v1";
const MEDIA_CACHE = "radio-t-media-v1";
const APP_ASSETS = ["/", "/index.html", "/episodes-fallback.json", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(APP_CACHE).then(cache => cache.addAll(APP_ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("radio-t-app-") && k !== APP_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith((async () => {
    const mediaCache = await caches.open(MEDIA_CACHE);
    const offlineMedia = await mediaCache.match(event.request.url);
    if (offlineMedia) return offlineMedia;

    const appCache = await caches.open(APP_CACHE);
    const cached = await appCache.match(event.request);
    if (cached) return cached;

    try {
      return await fetch(event.request);
    } catch (err) {
      if (event.request.mode === "navigate") {
        return (await appCache.match("/index.html")) || (await appCache.match("/"));
      }
      throw err;
    }
  })());
});
