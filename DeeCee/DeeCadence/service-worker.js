const CACHE_NAME = "deecadence-v3-3-cachefirst";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./style.css",
  "./src/styles/theme.css",
  "./manifest.json",
  "./assets/icons/deecadence.svg",
  "./assets/sounds/block-complete.wav",
  "./assets/sounds/session-complete.wav"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Always kick off a background network fetch to keep the cache fresh,
      // but never make the user wait on it.
      const networkUpdate = fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => null);

      if (cached) {
        // Serve instantly from cache; update happens silently in the background.
        networkUpdate;
        return cached;
      }

      // Nothing cached yet (e.g. first visit) — wait on the network, but
      // give up after 8s instead of hanging indefinitely on a slow connection.
      const timeout = new Promise((resolve) =>
        setTimeout(() => resolve(caches.match("./index.html")), 8000)
      );
      return Promise.race([networkUpdate, timeout]).then(
        (result) => result || caches.match("./index.html")
      );
    })
  );
});
