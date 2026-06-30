const CACHE_NAME = "journal-v3-cache-v31"; // ← incrémenter à chaque déploiement
const ASSETS = ["./","./index.html","./style.css","./app.js","./fox.png","./manifest.json"];

self.addEventListener("install", e => {
  self.skipWaiting(); // active la nouvelle version sans attendre la fermeture de tous les onglets
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim()) // prend le contrôle immédiat des pages déjà ouvertes
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(r => {
      const cl = r.clone();
      caches.open(CACHE_NAME).then(cache => { if (cl.ok) cache.put(e.request, cl); });
      return r;
    }).catch(() => caches.match(e.request).then(c => c || caches.match("./index.html")))
  );
});
