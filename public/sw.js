const VERSION = "gramin-connect-v2";
const CORE = ["/", "/favicon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone(); caches.open(VERSION).then((cache) => cache.put(request, copy)); return response;
    }).catch(() => caches.match(request).then((cached) => cached || new Response(JSON.stringify({ offline: true }), { headers: { "Content-Type": "application/json" } }))));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok && (url.origin === self.location.origin || url.hostname.endsWith("tile.openstreetmap.org"))) caches.open(VERSION).then((cache) => cache.put(request, response.clone()));
    return response;
  }).catch(() => caches.match("/"))));
});

