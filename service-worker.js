const CACHE_NAME = "alfred-pwa-v0.4.9";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/styles.css?v=0.4.9",
  "/app.js",
  "/app.js?v=0.4.9",
  "/agent-avatars.js",
  "/manifest.json",
  "/offline.html",
  "/icons/alfred-icon.svg",
  "/icons/alfred-maskable.svg",
  "/assets/avatars/alfred.svg",
  "/assets/avatars/olivia.svg",
  "/assets/avatars/sarah.svg",
  "/assets/avatars/westbridge-property-director.svg",
  "/assets/avatars/sentinel.svg",
  "/assets/avatars/maya.svg",
  "/assets/avatars/alex.svg",
  "/assets/avatars/ethan.svg",
  "/assets/avatars/liam.svg",
  "/assets/avatars/james.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/offline.html")),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    })),
  );
});
