const CACHE_NAME = "journal-cache-v46"; // ← incrémenter à chaque déploiement

/* Tout ce dont l'application a besoin pour démarrer et fonctionner sans réseau.
   jsPDF y figure : sans lui, les exports PDF échouaient hors ligne. */
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./vendor/jspdf.umd.min.js",
  "./fonts/fonts.css",
  "./fonts/Inter.woff2",
  "./fonts/JetBrainsMono.woff2",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./favicon-64.png"
];

self.addEventListener("install", e => {
  self.skipWaiting(); // active la nouvelle version sans attendre la fermeture des onglets
  e.waitUntil(
    caches.open(CACHE_NAME).then(c =>
      // On tolère les absences (addAll échouerait en bloc), et surtout on force
      // un aller réseau : cache.add() passe par le cache HTTP du navigateur et
      // remplissait le nouveau cache avec les fichiers de la version précédente
      // (GitHub Pages sert un max-age=600).
      Promise.all(ASSETS.map(url =>
        fetch(url, { cache: "reload" })
          .then(rep => { if (rep.ok) return c.put(url, rep); throw new Error("HTTP " + rep.status); })
          .catch(err => console.warn("Non mis en cache :", url, err))
      ))
    )
  );
});

/* Le stockage de caches est partagé par toute l'origine : sur
   *.github.io, d'autres projets du même compte y cohabitent. On ne
   supprime donc QUE les caches portant notre propre préfixe — purger
   tout ce qui n'est pas CACHE_NAME détruirait leurs données. */
const PREFIXE_CACHE = "journal-cache-";

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith(PREFIXE_CACHE) && k !== CACHE_NAME)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // prend le contrôle des pages déjà ouvertes
  );
});

/* On ne met en cache que ce qui appartient à l'application.
   Auparavant, toute réponse « ok » était stockée — y compris les fichiers de
   sauvegarde ouverts depuis l'app, qui gonflaient le cache inutilement. */
function estRessourceApplicative(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.endsWith(".json") && !url.pathname.endsWith("manifest.json")) return false;
  return /\.(html|css|js|png|svg|woff2?)$/.test(url.pathname) || url.pathname.endsWith("/");
}

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);

  e.respondWith(
    fetch(e.request)
      .then(reponse => {
        if (reponse.ok && estRessourceApplicative(url)) {
          const copie = reponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, copie));
        }
        return reponse;
      })
      .catch(async () => {
        const enCache = await caches.match(e.request);
        if (enCache) return enCache;
        // Navigation hors ligne vers une URL non mise en cache : on sert l'app
        if (e.request.mode === "navigate") {
          const accueil = await caches.match("./index.html");
          if (accueil) return accueil;
        }
        return new Response("Ressource indisponible hors ligne.", {
          status: 504, headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      })
  );
});
