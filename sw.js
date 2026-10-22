/* Service Worker: holt immer zuerst den aktuellen Stand aus dem Netz und
   legt ihn ab; ohne Netz öffnet sich die Seite mit dem zuletzt geladenen Stand. */
const CACHE = "stundenplan-v3";
const CORE = ["./", "./index.html", "./state.json", "./manifest.webmanifest", "./reminder-core.js", "./reminders.js", "./icons/v2/icon.svg", "./icons/v2/icon-180.png", "./icons/v2/icon-192.png", "./icons/v2/icon-512.png", "./icons/v2/icon-maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("stundenplan-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil((async () => {
    const data=e.notification.data||{};
    const app=new URL("./",self.registration.scope);
    let target=app;
    try{
      const candidate=new URL(data.url);
      if(candidate.origin===app.origin&&candidate.pathname===app.pathname)target=candidate;
    }catch{}
    if(e.action==="join"&&data.link){
      try{const link=new URL(data.link);if(link.protocol==="https:"){await self.clients.openWindow(link.href);return;}}catch{}
    }
    for(const client of await self.clients.matchAll({type:"window",includeUncontrolled:true})){
      const url=new URL(client.url);
      if(url.origin===app.origin&&url.pathname.startsWith(app.pathname)){
        client.postMessage({type:"open-lecture",key:target.searchParams.get("lecture")});
        await client.focus();return;
      }
    }
    await self.clients.openWindow(target.href);
  })());
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
