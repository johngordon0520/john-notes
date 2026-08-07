/* John's Notes — offline service worker
   Precaches the whole app on first visit. After that every request is
   served from the cache, so the app opens with no connection at all.
   Bump CACHE_VERSION whenever you change app.jsx or index.html. */

const CACHE_VERSION = "johns-notes-v26";

const PRECACHE = [
  "./",
  "./index.html",
  "./app.jsx",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-180.png",
  // Cached on first run so later launches never touch the network
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone@7.24.7/babel.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // addAll fails the whole install if any single file 404s, so add
      // them individually and let optional extras (fonts) fail quietly.
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(url).catch((e) => console.warn("Skipped caching", url, e))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Scripture lookups must always hit the network — never serve a cached
  // passage response, and never cache one (Crossway caps local storage,
  // and the app manages its own bounded verse cache).
  if (event.request.url.includes("api.esv.org")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Cache-first: instant loads, works with the radio off.
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Stash anything new we successfully fetched.
          // Cache same-origin files AND cross-origin ones (Google Fonts),
          // so the second launch needs no network for anything.
          if (response && (response.ok || response.type === "opaque")) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          // Offline and uncached: fall back to the app shell for navigations.
          if (event.request.mode === "navigate") return caches.match("./index.html");
          return new Response("", { status: 504, statusText: "Offline" });
        });
    })
  );
});
