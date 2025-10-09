// sw.js — cache static assets (no PHI, no API responses)
const CACHE = "skinfix-static-v6"; // bump this if you changed assets

const ASSETS = [
  "/index.html",
  "/style.css",
  "/app.js",
  "/assets/icon-dark-192.png",
  "/assets/icon-dark-512.png",
  "/assets/icon-light-192.png",
  "/assets/icon-light-512.png",
  "/assets/logo-skinfix-dark.svg",
  "/assets/logo-skinfix-onwhite.svg",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/sw.js"
];


self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// Cache-first for our static assets; fall through to network for everything else
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isStatic = ASSETS.some(p => url.pathname.endsWith(p.replace(/^\//,"")));
  if (!isStatic) return; // do not cache API calls or other requests

  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return resp;
      })
    )
  );
});
