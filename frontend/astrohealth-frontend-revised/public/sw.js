// Offline app shell for the *production build* after the first successful visit.
// Development (npm run dev) still needs the Vite server.
const CACHE = "astrohealth-app-shell-v3";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const page = await fetch("/", { cache: "reload" });
    if (!page.ok) return;
    const html = await page.clone().text();
    await cache.put("/", page);
    // Vite output references /assets/name-hash.js and .css from index.html.
    const matches = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g)];
    await cache.addAll(matches.map((match) => match[1]));
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match("/")) || Response.error()));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  })));
});
