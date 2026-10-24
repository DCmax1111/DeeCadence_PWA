const CACHE_NAME = "deecadence-v3-3-37";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./sync.js",
  "./style.css",
  "./manifest.json",
  "./icons/deecadence.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/deecadence-home-dark.jpg",
  "./images/deecadence-home-light.jpg",
  "./sounds/block-complete.wav",
  "./sounds/session-complete.wav",
  "./sounds/brown-noise.wav",
  "./sounds/rain_and_thunder.mp3",
  "./sounds/classical_music.mp3",
  "./sounds/wind.wav"
];

// App code files: always try the network first so updates land immediately.
// Everything else (images, sounds, icons): serve from cache instantly and
// refresh in the background.
const CORE_FILES = new Set([
  "./",
  "./index.html",
  "./app.js",
  "./sync.js",
  "./style.css",
  "./manifest.json"
]);

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

  let isCore = false;
  try {
    const url = new URL(event.request.url);
    if (url.origin === self.location.origin) {
      const path = "./" + (url.pathname.replace(/^\/+/, "") || "");
      isCore = event.request.mode === "navigate" || CORE_FILES.has(path);
    }
  } catch (error) {
    isCore = false;
  }

  if (isCore) {
    // Network-first: fresh code whenever online, cached copy when offline.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match("./index.html"))
        )
    );
    return;
  }

  // Stale-while-revalidate for media and other static assets.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkUpdate = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => null);

      if (cached) return cached;

      return networkUpdate.then((result) => result || caches.match("./index.html"));
    })
  );
});
