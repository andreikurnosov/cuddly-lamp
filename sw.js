const APP_CACHE = "radio-t-app-v2";
const APP_ASSETS = ["/", "/index.html", "/episodes-fallback.json", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(APP_CACHE).then(cache => cache.addAll(APP_ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith("radio-t-app-") && k !== APP_CACHE).map(k => caches.delete(k)));
    await caches.delete("radio-t-media-v1");
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        const cache = await caches.open(APP_CACHE);
        cache.put("/index.html", fresh.clone()).catch(()=>{});
        return fresh;
      } catch {
        const cache = await caches.open(APP_CACHE);
        return (await cache.match("/index.html")) || (await cache.match("/"));
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const fresh = await fetch(event.request);
      if (fresh.ok) cache.put(event.request, fresh.clone()).catch(()=>{});
      return fresh;
    } catch (err) {
      throw err;
    }
  })());
});
