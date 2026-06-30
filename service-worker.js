const CACHE_NAME = "journal-v3-cache-v30"; // ← incrémenter si besoin
const ASSETS = ["./","./index.html","./style.css","./app.js","./fox.png","./manifest.json"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(c =>
      fetch(e.request).then(r => {
        const cl = r.clone();
        caches.open(CACHE_NAME).then(cache => { if (cl.ok) cache.put(e.request, cl); });
        return r;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
