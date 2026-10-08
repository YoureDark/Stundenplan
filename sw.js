/* Service Worker: holt immer zuerst den aktuellen Stand aus dem Netz und
   legt ihn ab; ohne Netz öffnet sich die Seite mit dem zuletzt geladenen Stand. */
const CACHE = "stundenplan-v1";
const CORE = ["./", "./index.html", "./state.json", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;           // GitHub-API, Schriften usw. nicht anfassen
  const key = url.origin + url.pathname;                  // Cache-Buster (?t=…) ignorieren
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
      return res;
    }).catch(() =>
      caches.match(key).then(hit => hit || caches.match(req, { ignoreSearch: true }))
        .then(hit => hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined))
        .then(hit => hit || Response.error())
    )
  );
});
