/* =========================================================
   JOURNAL DE BORD
   Journal, pointage et rapport d'alternance — 100 % local
========================================================= */

/* ── Sélecteurs rapides ──────────────────────────────── */
const qs  = sel => document.querySelector(sel);
const qsa = sel => [...document.querySelectorAll(sel)];

/* ── Toast system ────────────────────────────────────────
   Le titre et le message viennent parfois de saisies utilisateur
   (nom de tâche, de catégorie) : on les insère en texte, jamais en HTML.
   `action` ajoute un bouton, utilisé pour l'annulation de suppression. */
function toast(title, msg = "", type = "info", duration = 3800, action = null) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const icons = { success: "✅", error: "❌", info: "ℹ️", warn: "⚠️" };

    const el = document.createElement("div");
    el.className = `toast ${type}`;

    const icone = document.createElement("div");
    icone.className = "toast-icon";
    icone.textContent = icons[type] || "ℹ️";

    const corps = document.createElement("div");
    corps.className = "toast-body";

    const titre = document.createElement("div");
    titre.className = "toast-title";
    titre.textContent = title;
    corps.appendChild(titre);

    if (msg) {
        const texte = document.createElement("div");
        texte.className = "toast-msg";
        texte.textContent = msg;
        corps.appendChild(texte);
    }

    el.append(icone, corps);

    const dismiss = () => {
        el.classList.add("out");
        el.addEventListener("animationend", () => el.remove(), { once: true });
    };

    if (action) {
        const btn = document.createElement("button");
        btn.className = "toast-action";
        btn.type = "button";
        btn.textContent = action.label;
        btn.onclick = e => { e.stopPropagation(); action.onClick(); dismiss(); };
        el.appendChild(btn);
    }

    container.appendChild(el);
    setTimeout(dismiss, duration);
    el.addEventListener("click", dismiss);
}

/* ── Date & Heure ────────────────────────────────────── */
/* Accepte 8:30, 08:30, 8h30, 8h 30 — refuse tout ce qui sort de 00:00–23:59.
   L'ancienne expression laissait passer 24:00 à 29:59. */
function parseHM(h) {
    if (typeof h !== "string") return NaN;
    const clean = h.trim().replace(/\s+/g, "").replace(/[hH]/, ":");
    const m = /^(\d{1,2}):(\d{2})$/.exec(clean);
    if (!m) return NaN;
    const H = +m[1], M = +m[2];
    if (H > 23 || M > 59) return NaN;
    return H * 60 + M;
}

/* Analyse une plage « 08:30-10:00 » et renvoie { debut, fin, duree } ou null.
   Une fin antérieure au début est considérée comme une faute de saisie
   plutôt que comme un passage à minuit (cas très rare en alternance). */
function parsePlage(texte) {
    if (typeof texte !== "string" || !texte.trim()) return null;
    const [a, b] = texte.replace(/[–—]/g, "-").split("-");
    const debut = parseHM(a || ""), fin = parseHM(b || "");
    if (isNaN(debut) || isNaN(fin) || fin < debut) return null;
    return { debut, fin, duree: fin - debut };
}

function hm(min) {
    if (isNaN(min)) return "--:--";
    const sign = min < 0 ? "-" : "";
    min = Math.abs(min);
    return sign + String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");
}

function ymd(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* new Date("2026-08-02") est interprété en UTC par la spécification, alors que
   ymd() et le reste de l'application raisonnent en heure locale. Construire la
   date explicitement évite le décalage d'un jour à l'ouest de Greenwich. */
function parseYMD(s) {
    const [y, m, d] = String(s).split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}


/* ── Jours fériés (France) ─────────────────────────────── */
function easterDate(year) {
    // Algorithme de Meeus/Jones/Butcher
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}

const holidayCache = {};
function frenchHolidays(year) {
    if (holidayCache[year]) return holidayCache[year];
    const map = {};
    const add = (m, d, label) => { map[`${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`] = label; };
    add(1, 1, "Jour de l'an");
    add(5, 1, "Fête du travail");
    add(5, 8, "Victoire 1945");
    add(7, 14, "Fête nationale");
    add(8, 15, "Assomption");
    add(11, 1, "Toussaint");
    add(11, 11, "Armistice");
    add(12, 25, "Noël");

    const easter = easterDate(year);
    const fromEaster = (delta, label) => {
        const d = new Date(easter); d.setDate(d.getDate() + delta);
        map[ymd(d)] = label;
    };
    fromEaster(1, "Lundi de Pâques");
    fromEaster(39, "Ascension");
    fromEaster(50, "Lundi de Pentecôte");

    holidayCache[year] = map;
    return map;
}

function holidayLabel(dateStr) {
    return frenchHolidays(+dateStr.slice(0, 4))[dateStr] || null;
}
const isHoliday = dateStr => !!holidayLabel(dateStr);
const isWeekendDate = dateStr => [0, 6].includes(new Date(dateStr + "T12:00:00").getDay());

function fmtFR(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
}

function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])
    );
}

/* ── Stockage ────────────────────────────────────────── */
const DEFAULT_CATS  = ["Général", "Production", "Qualité", "Méthodes", "Réunion", "Documentation", "Test"];

const LS = { CATS: "jb_cats", JOURNAL: "jb_journal", POINT: "jb_pointage", SORT: "jb_sort" };

/* Clés dont le contenu s'est révélé illisible pendant cette session.
   On refuse alors d'écrire par-dessus tant que l'utilisateur n'a pas tranché,
   pour ne jamais détruire des données peut-être récupérables à la main. */
const clesCorrompues = new Set();

/* Lecture tolérante : un JSON illisible ne doit jamais tuer l'application. */
function lireJSON(cle, valeurParDefaut) {
    let brut;
    try { brut = localStorage.getItem(cle); }
    catch { return valeurParDefaut; }          // stockage désactivé (navigation privée stricte)

    if (brut === null || brut === "") return valeurParDefaut;

    try {
        const val = JSON.parse(brut);
        return (val === null || val === undefined) ? valeurParDefaut : val;
    } catch {
        if (!clesCorrompues.has(cle)) {
            clesCorrompues.add(cle);
            console.warn(`Donnée illisible dans « ${cle} » — valeur par défaut utilisée.`);
            signalerStockageCorrompu();
        }
        return valeurParDefaut;
    }
}

/* Écriture tolérante : renvoie true si la donnée est bien enregistrée.
   Les appelants qui modifient des données vérifient ce retour. */
function ecrireJSON(cle, valeur) {
    if (clesCorrompues.has(cle)) return false;  // on n'écrase pas une donnée à récupérer
    try {
        localStorage.setItem(cle, JSON.stringify(valeur));
        return true;
    } catch (err) {
        const quotaAtteint = err && (err.name === "QuotaExceededError" || err.code === 22 || err.code === 1014);
        toast(
            quotaAtteint ? "Stockage plein" : "Enregistrement impossible",
            quotaAtteint
                ? "Votre navigateur a atteint sa limite. Exportez une sauvegarde, puis supprimez d'anciennes données."
                : (err && err.message) || "Le navigateur a refusé l'écriture.",
            "error", 9000
        );
        return false;
    }
}

/* Nom affiché sur le rapport d'alternance.
   Repris de l'ancien « jb_creds » pour conserver le nom déjà enregistré. */
const DEFAULT_AUTHOR = "CRANCE";
const getAuthorName = () => lireJSON("jb_creds", {})?.username || DEFAULT_AUTHOR;

const getCats     = () => { const v = lireJSON(LS.CATS, DEFAULT_CATS); return Array.isArray(v) && v.length ? v : DEFAULT_CATS; };
const setCats     = arr => ecrireJSON(LS.CATS, arr);

/* ── Sujets ───────────────────────────────────────────────────
   Un « sujet » est l'ancienne catégorie promue : c'est ce SUR QUOI on
   travaille. L'identité est le nom lui-même — la jointure avec le journal
   se fait par `entree.cat === sujet.nom`. Volontairement pas d'identifiant :
   un id cassé est irrécupérable à la main, un nom se relit dans le JSON.

   Trois champs seulement sont saisis, et une seule fois : debut, fin, jalons.
   Tout le reste — avancement, temps passé, barre du Gantt, dernière activité —
   est DÉRIVÉ du journal à chaque rendu, donc rien ne peut se désynchroniser. */
const LS_SUJETS = "jb_sujets";

function getSujets() {
    const v = lireJSON(LS_SUJETS, null);
    if (!v || !Array.isArray(v.liste)) return [];
    return v.liste.filter(s => s && typeof s.nom === "string" && s.nom);
}

/* jb_cats est maintenu en miroir : une sauvegarde v2 reste lisible par la v1,
   et si la migration dérape, les catégories d'origine sont toujours là. */
function setSujets(liste) {
    const ok = ecrireJSON(LS_SUJETS, { v: 2, liste });
    if (ok) setCats(liste.map(s => s.nom));
    return ok;
}

const getSujet = nom => getSujets().find(s => s.nom === nom) || null;

function majSujet(nom, modif) {
    const liste = getSujets();
    const i = liste.findIndex(s => s.nom === nom);
    if (i < 0) return false;
    liste[i] = { ...liste[i], ...modif };
    return setSujets(liste);
}

const sujetVierge = nom => ({ nom, actif: true, debut: "", fin: "", jalons: [] });

/* Migration idempotente, jouée à chaque démarrage.
   Elle ne réécrit jamais le journal : les 186 entrées existantes gardent leur
   champ `cat` tel quel. Elle se contente de garantir qu'un sujet existe pour
   chaque valeur de `cat` rencontrée — y compris celles dont la catégorie avait
   été supprimée dans les Réglages de la v1, qui étaient devenues invisibles. */
function migrerVersSujets() {
    const existants = getSujets();
    const connus = new Set(existants.map(s => s.nom));

    const rencontres = new Set();
    Object.values(getJournal()).forEach(liste =>
        (liste || []).forEach(t => rencontres.add((t && t.cat) || "Général"))
    );
    getCats().forEach(c => rencontres.add(c));

    const manquants = [...rencontres].filter(n => n && !connus.has(n));
    if (!existants.length) {
        // Premier passage : on crée tout, dans l'ordre des catégories déclarées
        const ordre = [...getCats().filter(c => rencontres.has(c)),
                       ...[...rencontres].filter(c => !getCats().includes(c))];
        return setSujets(ordre.map(sujetVierge));
    }
    if (manquants.length) {
        // Filet permanent : un `cat` orphelin fait réapparaître son sujet
        return setSujets([...existants, ...manquants.map(sujetVierge)]);
    }
    return true;
}
const getJournal  = () => { const v = lireJSON(LS.JOURNAL, {}); return (v && typeof v === "object" && !Array.isArray(v)) ? v : {}; };
const setJournal  = obj => ecrireJSON(LS.JOURNAL, obj);
const getPoint    = () => { const v = lireJSON(LS.POINT, {}); return (v && typeof v === "object" && !Array.isArray(v)) ? v : {}; };
const setPoint    = obj => ecrireJSON(LS.POINT, obj);
const getSortOrder = () => { try { return localStorage.getItem(LS.SORT) || "desc"; } catch { return "desc"; } };
const setSortOrder = v  => { try { localStorage.setItem(LS.SORT, v); } catch { /* non bloquant */ } };

/* ── Récupération après corruption ────────────────────── */
function signalerStockageCorrompu() {
    // Affiché une seule fois, après le premier rendu, pour rester visible.
    setTimeout(() => {
        const banniere = qs("#recoveryBanner");
        if (!banniere || !banniere.classList.contains("hidden")) return;
        qs("#recoveryDetail").textContent =
            "Concernée(s) : " + [...clesCorrompues].join(", ") +
            ". L'application fonctionne avec des données vides pour ces éléments ; rien n'a été effacé.";
        banniere.classList.remove("hidden");
    }, 0);
}

function telechargerDonneesBrutes() {
    const brut = {};
    Object.keys(LS).forEach(k => { try { brut[LS[k]] = localStorage.getItem(LS[k]); } catch { /* ignoré */ } });
    const blob = new Blob([JSON.stringify(brut, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `journal_donnees_brutes_${ymd(new Date())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
    toast("Données brutes exportées", "Conservez ce fichier avant toute réparation.", "success");
}

function reparerStockage() {
    if (!confirm(
        "Réinitialiser uniquement les données illisibles ?\n\n" +
        [...clesCorrompues].join(", ") + "\n\n" +
        "Exportez d'abord les données brutes si vous souhaitez tenter une récupération manuelle."
    )) return;

    clesCorrompues.forEach(cle => { try { localStorage.removeItem(cle); } catch { /* ignoré */ } });
    clesCorrompues.clear();
    location.reload();
}

/* ── Métriques dérivées d'un sujet ────────────────────────────
   Rien de ceci n'est stocké : tout se recalcule depuis le journal, ce qui
   garantit qu'aucun chiffre affiché ne peut mentir après trois semaines. */
function statsSujet(nom, journal) {
    journal = journal || getJournal();
    let premiere = "", derniere = "", entrees = 0, minutes = 0;

    Object.keys(journal).sort().forEach(jour => {
        (journal[jour] || []).forEach(t => {
            if ((t.cat || "Général") !== nom) return;
            entrees++;
            if (!premiere) premiere = jour;
            derniere = jour;
            const p = parsePlage(t.timeRange);
            if (p) minutes += p.duree;
        });
    });

    const s = getSujet(nom) || sujetVierge(nom);
    const jalons = s.jalons || [];
    const faits = jalons.filter(j => j.f).length;

    return {
        nom, actif: s.actif !== false,
        debut: s.debut || "", fin: s.fin || "",
        premiere, derniere, entrees, minutes,
        jalons: jalons.length, faits,
        // L'avancement vient des jalons s'il y en a ; sinon il n'est pas inventé.
        avancement: jalons.length ? Math.round((faits / jalons.length) * 100) : null,
        joursDepuis: derniere ? Math.floor((parseYMD(ymd(new Date())) - parseYMD(derniere)) / 86400000) : null,
        // Une échéance dépassée avec des jalons restants = retard réel
        enRetard: !!(s.fin && s.fin < ymd(new Date()) && jalons.length && faits < jalons.length)
    };
}

/* ═══════════════════════════════════════════════════════
   DIFFICULTÉS

   La rubrique « difficultés rencontrées » est attendue dans tout rapport
   d'alternance, et c'est la seule chose qu'un journal ne peut pas déduire :
   une tâche qui a pris trois jours au lieu d'un ne dit pas POURQUOI.
   On stocke donc l'irréductible — l'énoncé, la gravité, ce qui a débloqué —
   et on dérive tout le reste (délai de résolution, taux, répartition).

   `projet` est un nom de sujet, comme `cat` dans le journal : pas d'identifiant,
   pour la même raison qu'ailleurs — un nom se relit dans le JSON.
   Un projet supprimé ne casse rien : la difficulté devient simplement orpheline.
═══════════════════════════════════════════════════════ */
const LS_DIFFS = "jb_difficultes";

/* Trois niveaux, et pas plus : au-delà, personne ne choisit de façon stable.
   L'ordre compte — il sert au tri et au calcul de la gravité dominante. */
const GRAVITES = [
    { cle: "bloquant", libelle: "Bloquant", rang: 3 },
    { cle: "genant",   libelle: "Gênant",   rang: 2 },
    { cle: "mineur",   libelle: "Mineur",   rang: 1 }
];
const graviteValide = g => GRAVITES.some(x => x.cle === g) ? g : "genant";
const libelleGravite = g => (GRAVITES.find(x => x.cle === graviteValide(g)) || GRAVITES[1]).libelle;

function getDifficultes() {
    const v = lireJSON(LS_DIFFS, null);
    if (!v || !Array.isArray(v.liste)) return [];
    return v.liste.filter(d => d && typeof d.texte === "string" && d.texte.trim());
}

const setDifficultes = liste => ecrireJSON(LS_DIFFS, { v: 1, liste });

function ajouterDifficulte({ texte, projet, gravite, date }) {
    const liste = getDifficultes();
    liste.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        date:    date || ymd(new Date()),
        texte:   String(texte || "").trim(),
        projet:  String(projet || "").trim(),
        gravite: graviteValide(gravite),
        resolue: "",          // date de résolution, "" tant qu'elle est ouverte
        resolution: ""        // ce qui a débloqué — le plus utile à la relecture
    });
    return setDifficultes(liste) ? liste[liste.length - 1] : null;
}

function majDifficulte(id, modif) {
    const liste = getDifficultes();
    const i = liste.findIndex(d => d.id === id);
    if (i < 0) return false;
    liste[i] = { ...liste[i], ...modif };
    return setDifficultes(liste);
}

function supprimerDifficulte(id) {
    const liste = getDifficultes();
    const i = liste.findIndex(d => d.id === id);
    if (i < 0) return null;
    const [ote] = liste.splice(i, 1);
    return setDifficultes(liste) ? ote : null;
}

/* ── Navigation ──────────────────────────────────────── */
function show(view) {
    qsa("section").forEach(s => s.classList.add("hidden"));
    const v = qs("#view-" + view);
    if (v) v.classList.remove("hidden");

    qsa(".tab").forEach(t => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
    });
    const tab = qs("#tab-" + view);
    if (tab) {
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
    }
    vueCourante = view;
}
let vueCourante = "journal";

/* ── Header — horloge & progression ─────────────────── */
const LS_WORKHOURS = "jb_workhours";
const getWorkHours = () => {
    const v = lireJSON(LS_WORKHOURS, null);
    return (v && !isNaN(parseHM(v.start)) && !isNaN(parseHM(v.end))) ? v : { start: "08:00", end: "18:00" };
};
const setWorkHours = (start, end) => ecrireJSON(LS_WORKHOURS, { start, end });

/* ── Paramètres du contrat (tolérance & objectif quotidien) ──
   Étaient codés en dur : 20 min de tolérance, 7h48 par jour ouvré. */
const LS_CONTRAT = "jb_contrat";
const CONTRAT_DEFAUT = { toleranceMin: 20, objectifJourMin: 7 * 60 + 48 };
function getContrat() {
    const v = lireJSON(LS_CONTRAT, null);
    if (!v) return { ...CONTRAT_DEFAUT };
    return {
        toleranceMin:    Number.isFinite(v.toleranceMin)    && v.toleranceMin    >= 0 ? v.toleranceMin    : CONTRAT_DEFAUT.toleranceMin,
        objectifJourMin: Number.isFinite(v.objectifJourMin) && v.objectifJourMin > 0 ? v.objectifJourMin : CONTRAT_DEFAUT.objectifJourMin
    };
}
const setContrat = c => ecrireJSON(LS_CONTRAT, c);


function initHeaderClock() {
    const dateEl = qs("#headerDate");
    if (!dateEl) return;

    const tick = () => {
        dateEl.textContent = new Date().toLocaleDateString("fr-FR", {
            weekday: "long", day: "numeric", month: "long", year: "numeric"
        });
    };
    tick();
    setInterval(tick, 60000);
}

/* ── Thème clair/sombre ──────────────────────────────── */
const LS_THEME = "jb_theme";
function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = qs("#themeToggleBtn");
    if (btn) btn.textContent = theme === "light" ? "◑" : "◐";
}
/* localStorage peut lever une exception (navigation privée stricte, stockage
   bloqué par la configuration du navigateur). Sans protection ici, tout le
   démarrage de l'application avortait. */
function initTheme() {
    let saved = "dark";
    try { saved = localStorage.getItem(LS_THEME) || "dark"; } catch { /* thème par défaut */ }
    applyTheme(saved);
    qs("#themeToggleBtn").onclick = () => {
        const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
        try { localStorage.setItem(LS_THEME, next); } catch { /* préférence non mémorisée */ }
        applyTheme(next);
    };
}

/* ── Logo : repli pro si fox.png absent ───────────────── */
function setupLogoFallback() {
    qsa("img.logo-img, img.login-logo-img").forEach(img => {
        img.addEventListener("error", () => {
            const div = document.createElement("div");
            div.className = "logo-fallback" + (img.classList.contains("login-logo-img") ? " logo-fallback-lg" : "");
            div.textContent = "JB";
            img.replaceWith(div);
        }, { once: true });
    });
}

/* ── DOMContentLoaded ────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
    initHeaderClock();
    initTheme();
    setupLogoFallback();

    qs("#recoveryExportBtn").onclick = telechargerDonneesBrutes;
    qs("#recoveryRepairBtn").onclick = reparerStockage;

    // Avant tout rendu : garantit qu'un sujet existe pour chaque `cat` du journal
    migrerVersSujets();

    initQuickAdd();
    initRaccourcisClavier();

    qs("#liveBannerStop").onclick = () => stopTracker(false);

    qs("#tab-today").onclick    = () => { show("today"); renderToday(); };
    qs("#tab-journal").onclick  = () => show("journal");
    qs("#tab-projets").onclick  = () => { show("projets"); renderProjets(); };
    qs("#tab-bilan").onclick    = () => { show("bilan"); renderBilan(); };
    qs("#tab-admin").onclick    = () => { show("admin"); initAdmin(); };

    // L'application s'ouvre sur la journée en cours
    initJournal();
    initToday();
    initProjets();
    initBilan();
    show("today");

    appliquerRaccourciPWA();

    // Corruption repérée avant que le DOM soit prêt : on affiche la bannière maintenant
    if (clesCorrompues.size) signalerStockageCorrompu();

    // Rappel de sauvegarde, après le premier rendu pour ne pas gêner l'ouverture
    setTimeout(rappelerSauvegardeSiBesoin, 2500);
});

/* Raccourcis déclarés dans manifest.json (appui long sur l'icône de l'app). */
function appliquerRaccourciPWA() {
    const action = new URLSearchParams(location.search).get("action");
    if (action === "ajout") openQuickAdd();
    else if (action === "projets") { show("projets"); renderProjets(); }
    if (action) history.replaceState(null, "", location.pathname);
}

/* ═══════════════════════════════════════════════════════
   SUIVI EN DIRECT (chronomètre tâche en cours)
═══════════════════════════════════════════════════════ */
/* localStorage et non sessionStorage : fermer l'onglet ne doit pas
   faire perdre une tâche en cours de chronométrage. */
const LS_TRACKER = "jb_tracker";
function getTrackerState() {
    const t = lireJSON(LS_TRACKER, null)
        // Reprise d'une éventuelle session laissée par l'ancienne version
        || (() => { try { return JSON.parse(sessionStorage.getItem(LS_TRACKER)); } catch { return null; } })();
    if (!t || !Array.isArray(t.sessions) || !t.sessions.length) return null;
    return t;
}
function setTrackerState(obj) {
    try { sessionStorage.removeItem(LS_TRACKER); } catch { /* ignoré */ }
    if (obj) return ecrireJSON(LS_TRACKER, obj);
    try { localStorage.removeItem(LS_TRACKER); } catch { /* ignoré */ }
    return true;
}

let trackerTickHandle = null;
let trackerDayWarned  = false;

function refreshTrackerCatSelect() {
    const sel = qs("#trackerCat");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = "";
    getCats().forEach(c => {
        const o = document.createElement("option");
        o.value = o.textContent = c;
        if (c === current) o.selected = true;
        sel.appendChild(o);
    });
}

function trackerElapsedMs(t) {
    return t.sessions.reduce((s, sess) => s + ((sess.end || Date.now()) - sess.start), 0);
}

function trackerIsPaused(t) {
    return t.sessions[t.sessions.length - 1].end !== null;
}

function fmtTimer(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function renderTrackerIdle() {
    qs("#trackerIdle")?.classList.remove("hidden");
    qs("#trackerActive")?.classList.add("hidden");
    if (qs("#trackerTaskText")) qs("#trackerTaskText").value = "";
    qs("#liveBanner")?.classList.add("hidden");
    clearInterval(trackerTickHandle);
    trackerDayWarned = false;
}

function renderTrackerActive(t) {
    qs("#trackerIdle")?.classList.add("hidden");
    qs("#trackerActive")?.classList.remove("hidden");
    qs("#trackerTaskName").textContent = `${t.text} · ${t.cat}`;
    qs("#liveBanner")?.classList.remove("hidden");

    const paused = trackerIsPaused(t);
    qs("#trackerStateLabel").textContent = paused ? "⏸ Tâche en pause" : "🔴 Tâche en cours";
    qs("#trackerStateLabel").classList.toggle("is-paused", paused);
    qs("#trackerPauseBtn").textContent = paused ? "▶️ Reprendre" : "⏸ Pause";
    if (qs("#liveBannerText")) qs("#liveBannerText").textContent = `${paused ? "⏸" : "🔴"} ${t.text} · ${t.cat}`;

    clearInterval(trackerTickHandle);
    const tick = () => {
        const elapsed = trackerElapsedMs(t);
        const timerEl = qs("#trackerTimer");
        if (!timerEl) { clearInterval(trackerTickHandle); return; }
        timerEl.textContent = fmtTimer(elapsed);
        timerEl.classList.toggle("is-paused", trackerIsPaused(t));
        timerEl.classList.toggle("is-overtime", elapsed > 12 * 3600 * 1000);
        if (qs("#liveBannerClock")) qs("#liveBannerClock").textContent = fmtTimer(elapsed);

        if (!trackerDayWarned && t.day !== ymd(new Date())) {
            trackerDayWarned = true;
            toast("Journée changée", "La tâche en cours a été arrêtée automatiquement à minuit.", "warn");
            stopTracker(true);
        }
    };
    tick();
    trackerTickHandle = setInterval(tick, 1000);
}

function startTracker() {
    const text = qs("#trackerTaskText").value.trim();
    if (!text) return toast("Nom requis", "Indiquez le nom de la tâche à démarrer.", "warn");
    const cat = qs("#trackerCat").value || "Général";

    const t = { text, cat, day: ymd(new Date()), sessions: [{ start: Date.now(), end: null }] };
    setTrackerState(t);
    renderTrackerActive(t);
    toast("Tâche démarrée ▶️", text, "success");
}

function pauseResumeTracker() {
    const t = getTrackerState();
    if (!t) return;
    const last = t.sessions[t.sessions.length - 1];
    if (last.end === null) {
        last.end = Date.now();
        toast("En pause ⏸", t.text, "info");
    } else {
        t.sessions.push({ start: Date.now(), end: null });
        toast("Reprise ▶️", t.text, "info");
    }
    setTrackerState(t);
    renderTrackerActive(t);
}

function stopTracker(auto = false) {
    const t = getTrackerState();
    if (!t) return;

    const last = t.sessions[t.sessions.length - 1];
    if (last.end === null) last.end = Date.now();

    const totalMin = Math.max(1, Math.round(trackerElapsedMs(t) / 60000));
    const startDate = new Date(t.sessions[0].start);
    const fmt2 = n => String(n).padStart(2, "0");

    // La plage enregistrée doit valoir le temps réellement chronométré.
    // En partant de l'heure de fin réelle, les pauses étaient comptées comme
    // du travail dans tous les cumuls du journal.
    const debutMin = startDate.getHours() * 60 + startDate.getMinutes();
    const finMin   = Math.min(23 * 60 + 59, debutMin + totalMin);
    const timeRange = `${fmt2(startDate.getHours())}:${fmt2(startDate.getMinutes())}-${fmt2(Math.floor(finMin / 60))}:${fmt2(finMin % 60)}`;
    const avecPauses = t.sessions.length > 1;

    const journal = getJournal();
    journal[t.day] = journal[t.day] || [];
    journal[t.day].push({
        id: nouvelIdTache(),
        timeRange,
        text: t.text,
        cat: t.cat,
        notes: avecPauses
            ? `Suivi en direct — ${t.sessions.length} sessions, ${hm(totalMin)} travaillées (pauses déduites, horaire de fin ajusté).`
            : ""
    });
    setJournal(journal);
    setTrackerState(null);
    renderTrackerIdle();
    rafraichirVuesTaches();   // la vue Aujourd'hui restait périmée après un arrêt depuis le bandeau

    toast(auto ? "Tâche arrêtée automatiquement" : "Tâche terminée ✅", `${t.text} — ${hm(totalMin)}`, "success");
}

/* Le chrono survit désormais à la fermeture de l'onglet. Si l'application est
   rouverte un autre jour avec une session encore ouverte, on ne compte pas les
   heures pendant lesquelles l'app était fermée : la session est refermée à la
   fin de la journée concernée, puis la tâche est enregistrée. */
function normaliserTrackerAuDemarrage() {
    const t = getTrackerState();
    if (!t || t.day === ymd(new Date())) return;

    const derniere = t.sessions[t.sessions.length - 1];
    if (derniere.end === null) {
        const [Y, M, D] = t.day.split("-").map(Number);
        derniere.end = new Date(Y, M - 1, D, 23, 59, 59).getTime();
    }
    setTrackerState(t);
    stopTracker(true);
    toast(
        "Tâche du " + fmtFR(t.day) + " clôturée",
        "Elle était encore en cours à la fermeture de l'application. Vérifiez son horaire dans le journal.",
        "warn", 9000
    );
}

function initTracker() {
    refreshTrackerCatSelect();

    qs("#trackerStartBtn").onclick = startTracker;
    // .onkeydown (et non addEventListener) : initTracker est rappelé après un import,
    // un écouteur cumulé déclencherait plusieurs fois la même action.
    qs("#trackerTaskText").onkeydown = e => { if (e.key === "Enter") startTracker(); };
    qs("#trackerPauseBtn").onclick = pauseResumeTracker;
    qs("#trackerStopBtn").onclick  = () => stopTracker(false);

    normaliserTrackerAuDemarrage();

    const existing = getTrackerState();
    if (existing) renderTrackerActive(existing); else renderTrackerIdle();
}

/* ═══════════════════════════════════════════════════════
   JOURNAL
═══════════════════════════════════════════════════════ */
function initJournal() {
    const today = ymd(new Date());

    const dateInput = qs("#taskDate");
    if (dateInput && !dateInput.value) dateInput.value = today;

    // Au démarrage, on n'affiche que la journée en cours
    qs("#filterFrom").value = today;
    qs("#filterTo").value   = today;

    const savedSort = getSortOrder();
    const sortSel   = qs("#sortOrder");
    if (sortSel) sortSel.value = savedSort;

    refreshCatSelect();
    refreshFilterCatSelect();
    initTracker();
    renderJournal();
    renderJournalStats();

    qs("#addTaskBtn").onclick = addTask;
    // .onkeydown : initJournal est rappelé après un import de sauvegarde.
    qs("#taskText").onkeydown = e => { if (e.key === "Enter") addTask(); };

    // La recherche reconstruit toute la liste : on attend une courte pause
    // de frappe pour éviter un rendu complet à chaque caractère.
    let minuteurRecherche = null;
    qs("#searchText").oninput = () => {
        clearTimeout(minuteurRecherche);
        minuteurRecherche = setTimeout(rerendreDepuisFiltre, 180);
    };
    qs("#filterCat").onchange  = rerendreDepuisFiltre;
    qs("#filterFrom").onchange = rerendreDepuisFiltre;
    qs("#filterTo").onchange   = rerendreDepuisFiltre;
    qs("#clearFiltersBtn").onclick = () => {
        qs("#searchText").value = "";
        qs("#filterCat").value  = "";
        qs("#filterFrom").value = "";
        qs("#filterTo").value   = "";
        rerendreDepuisFiltre();
    };

    // Retire en un clic le filtre « aujourd'hui » appliqué au démarrage
    qs("#showAllBtn").onclick = () => {
        qs("#filterFrom").value = "";
        qs("#filterTo").value   = "";
        rerendreDepuisFiltre();
    };

    qs("#toggleRapportBtn").onclick = () => {
        qs("#rapportPanel").classList.toggle("hidden");
        if (!qs("#rapportPanel").classList.contains("hidden")) initRapportPanel();
    };
    qs("#generateRapportBtn").onclick = exportRapportAlternancePdf;

    qs("#addCatBtn").onclick = () => {
        const val = qs("#newCat").value.trim();
        if (!val) return toast("Nom requis", "Entrez un nom de catégorie.", "warn");
        const cats = getCats();
        if (cats.includes(val)) return toast("Existe déjà", `La catégorie « ${val} » existe.`, "warn");
        cats.push(val);
        setCats(cats);
        qs("#newCat").value = "";
        refreshCatSelect();
        refreshFilterCatSelect();
        refreshTrackerCatSelect();
        toast("Catégorie ajoutée", `« ${val} » est disponible.`, "success");
    };

    qs("#sortOrder").onchange = () => {
        setSortOrder(qs("#sortOrder").value);
        rerendreDepuisFiltre();
    };

    qs("#exportJournalPdfBtn").onclick = exportJournalPdf;
}

function addTask() {
    const date = qs("#taskDate").value;
    const time = qs("#taskTime").value.trim();
    const text = qs("#taskText").value.trim();
    const cat  = qs("#taskCat").value || "Général";
    const notes = qs("#taskNotes")?.value.trim() || "";

    if (!text) return toast("Description manquante", "Saisissez une description.", "warn");
    if (!date) return toast("Date manquante", "Sélectionnez une date.", "warn");

    // Une plage mal formée était jusqu'ici enregistrée puis ignorée en silence
    // dans tous les cumuls : on prévient au moment de la saisie.
    const plage = time ? parsePlage(time) : null;
    const plageInvalide = !!time && !plage;

    const journal = getJournal();
    journal[date] = journal[date] || [];
    journal[date].push({ id: nouvelIdTache(), timeRange: time, text, cat, notes });
    if (!setJournal(journal)) return;

    qs("#taskTime").value = "";
    qs("#taskText").value = "";
    if (qs("#taskNotes")) qs("#taskNotes").value = "";
    qs("#taskText").focus();

    renderJournal();
    renderJournalStats();
    renderToday();

    if (plageInvalide) {
        toast("Tâche ajoutée, horaire non compris",
              `« ${time} » n'est pas une plage valide (attendu : 08:30-10:00). La tâche ne comptera pas dans les durées tant qu'elle n'est pas corrigée.`,
              "warn", 7000);
    } else {
        toast("Tâche ajoutée", `${cat} — ${text.slice(0, 40)}`, "success");
    }
}

/* Identifiant unique même si deux tâches sont créées dans la même milliseconde. */
let dernierIdTache = 0;
function nouvelIdTache() {
    const maintenant = Date.now();
    dernierIdTache = maintenant > dernierIdTache ? maintenant : dernierIdTache + 1;
    return dernierIdTache;
}

/* ── Ajout rapide (bouton flottant) ───────────────────────
   Réutilise addTask() : on remplit temporairement le formulaire
   principal, puis on restaure son état pour ne rien perturber. */
let elementAvantModale = null;

function quickAddEstOuverte() {
    return !qs("#quickAddOverlay").classList.contains("hidden");
}

function openQuickAdd() {
    const now = new Date();
    const sel = qs("#quickAddCat");
    sel.innerHTML = "";
    getCats().forEach(c => {
        const o = document.createElement("option");
        o.value = o.textContent = c;
        sel.appendChild(o);
    });

    qs("#quickAddText").value = "";
    qs("#quickAddWhen").textContent =
        `${fmtFR(ymd(now))} · ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    elementAvantModale = document.activeElement;
    qs("#quickAddOverlay").classList.remove("hidden");
    qs("#quickAddText").focus();
}

function closeQuickAdd() {
    qs("#quickAddOverlay").classList.add("hidden");
    // On rend le focus à l'élément qui a ouvert la modale
    if (elementAvantModale && document.contains(elementAvantModale)) elementAvantModale.focus();
    elementAvantModale = null;
}

/* Tant que la modale est ouverte, la tabulation ne doit pas en sortir. */
function piegerFocusModale(e) {
    if (e.key !== "Tab" || !quickAddEstOuverte()) return;
    const focusables = qsa("#quickAddOverlay button, #quickAddOverlay input, #quickAddOverlay select")
        .filter(el => !el.disabled && el.offsetParent !== null);
    if (!focusables.length) return;

    const premier = focusables[0], dernier = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
}

function submitQuickAdd() {
    const text = qs("#quickAddText").value.trim();
    if (!text) return toast("Tâche manquante", "Indiquez ce que vous avez fait.", "warn");

    const now = new Date();
    const heure = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Sauvegarde de l'état du formulaire principal
    const backup = {
        date:  qs("#taskDate").value,
        time:  qs("#taskTime").value,
        text:  qs("#taskText").value,
        cat:   qs("#taskCat").value,
        notes: qs("#taskNotes") ? qs("#taskNotes").value : ""
    };

    qs("#taskDate").value = ymd(now);
    qs("#taskTime").value = heure;
    qs("#taskText").value = text;
    qs("#taskCat").value  = qs("#quickAddCat").value;
    if (qs("#taskNotes")) qs("#taskNotes").value = "";

    addTask();

    // Restauration (addTask a déjà vidé heure / texte / note)
    qs("#taskDate").value = backup.date;
    qs("#taskTime").value = backup.time;
    qs("#taskText").value = backup.text;
    qs("#taskCat").value  = backup.cat;
    if (qs("#taskNotes")) qs("#taskNotes").value = backup.notes;
    qs("#taskText").blur();

    closeQuickAdd();
}

function initQuickAdd() {
    qs("#fabAddTask").onclick    = openQuickAdd;
    qs("#quickAddClose").onclick = closeQuickAdd;
    qs("#quickAddSubmit").onclick = submitQuickAdd;

    qs("#quickAddText").onkeydown = e => { if (e.key === "Enter") submitQuickAdd(); };

    // Clic sur le fond : on ferme
    qs("#quickAddOverlay").onclick = e => {
        if (e.target === qs("#quickAddOverlay")) closeQuickAdd();
    };
}

/* ── Raccourcis clavier ───────────────────────────────────
   Ignorés dès que la frappe a lieu dans un champ de saisie. */
function initRaccourcisClavier() {
    document.addEventListener("keydown", e => {
        if (quickAddEstOuverte()) {
            if (e.key === "Escape") return closeQuickAdd();
            return piegerFocusModale(e);
        }
        /* La feuille de saisie du Bilan gère elle-même Échap et la tabulation ;
           sans cette garde, une frappe sur un de ses boutons déclencherait
           les raccourcis d'un seul caractère ci-dessous. */
        if (typeof feuilleEstOuverte === "function" && feuilleEstOuverte()) return;

        const cible = e.target;
        const dansUnChamp = cible && (/^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName) || cible.isContentEditable);
        if (dansUnChamp || e.ctrlKey || e.metaKey || e.altKey) return;

        switch (e.key.toLowerCase()) {
            case "a": e.preventDefault(); openQuickAdd(); break;
            case "1": show("today"); renderToday(); break;
            case "2": show("journal"); break;
            case "3": show("projets"); renderProjets(); break;
            case "4": show("bilan"); renderBilan(); break;
            case "5": show("admin"); initAdmin(); break;
            case "/": e.preventDefault(); show("journal"); qs("#searchText").focus(); break;
            case "?": afficherAideRaccourcis(); break;
        }
    });
}

function afficherAideRaccourcis() {
    toast(
        "Raccourcis clavier",
        "A : ajout rapide · / : rechercher · 1 : Aujourd'hui · 2 : Historique · 3 : Projets · 4 : Bilan · 5 : Réglages · Échap : fermer",
        "info", 8000
    );
}

/* ═══════════════════════════════════════════════════════
   VUE « AUJOURD'HUI »
   Réunit le pointage du jour et les tâches du jour dans un seul écran.
   Aucune donnée nouvelle : on lit et écrit dans jb_pointage et jb_journal
   exactement comme les onglets Pointage et Historique.
═══════════════════════════════════════════════════════ */
function initToday() {
    const auj = ymd(new Date());

    qs("#todaySubtitle").textContent = fmtFR(auj).replace(/^./, c => c.toUpperCase());

    qs("#todayAddBtn").onclick  = ajouterTacheDepuisToday;
    qs("#todayText").onkeydown  = e => { if (e.key === "Enter") ajouterTacheDepuisToday(); };

    qs("#goToHistoryBtn").onclick = () => {
        show("journal");
        qs("#filterFrom").value = "";
        qs("#filterTo").value   = "";
        rerendreDepuisFiltre();
    };
    qs("#goToProjetsBtn").onclick = () => { show("projets"); renderProjets(); };

    renderToday();
}

function renderToday() {
    const auj = ymd(new Date());

    /* ── Sujets ── */
    const sel = qs("#todayCat");
    const courant = sel.value;
    sel.innerHTML = "";
    getCats().forEach(c => {
        const o = document.createElement("option");
        o.value = o.textContent = c;
        if (c === courant) o.selected = true;
        sel.appendChild(o);
    });

    /* ── Tâches du jour ── */
    const taches = (getJournal()[auj] || []).slice();
    const racine = qs("#todayTasksRoot");
    racine.innerHTML = "";

    let minutes = 0;
    taches.forEach(t => { const p = parsePlage(t.timeRange); if (p) minutes += p.duree; });
    qs("#todayTasksSummary").textContent = taches.length
        ? `${taches.length} tâche${taches.length > 1 ? "s" : ""}${minutes ? " · " + hm(minutes) : ""}`
        : "—";

    majDatalistLibelles();
    renderJalonsAPortee(auj);

    if (!taches.length) {
        racine.innerHTML = `<p class="small-hint" style="text-align:center;padding:18px 0;">Rien de noté aujourd'hui. Ajoutez votre première activité ci-dessus.</p>`;
        return;
    }

    // Tri chronologique : les tâches sans horaire exploitable passent en fin
    taches.sort((a, b) => {
        const pa = parsePlage(a.timeRange), pb = parsePlage(b.timeRange);
        if (pa && pb) return pa.debut - pb.debut;
        return pa ? -1 : pb ? 1 : 0;
    });

    taches.forEach(t => {
        const couleur = colorForCat(t.cat || "Général");
        const ligne = document.createElement("div");
        ligne.className = "today-task";
        ligne.innerHTML = `
            <span class="today-task-time">${escapeHtml(t.timeRange || "—")}</span>
            <span class="today-task-text">${escapeHtml(t.text)}</span>
            <span class="chip" style="${stylePuceCat(t.cat)}">${escapeHtml(t.cat || "Général")}</span>
            <button class="btn-danger" style="padding:5px 9px;font-size:.72rem;"
                    aria-label="Supprimer : ${escapeHtml(t.text.slice(0, 40))}" title="Supprimer">✕</button>`;
        ligne.querySelector("button").onclick = () => supprimerTache(auj, t.id);
        racine.appendChild(ligne);
    });
}

/* Les libellés se répètent beaucoup d'un jour à l'autre : proposer ceux
   déjà employés évite de retaper, et surtout évite les quasi-doublons
   qui feraient diverger un même travail en plusieurs intitulés. */
function majDatalistLibelles() {
    const dl = qs("#listeLibelles");
    if (!dl) return;
    const compte = {};
    Object.values(getJournal()).flat().forEach(t => {
        const s = (t.text || "").trim();
        if (s) compte[s] = (compte[s] || 0) + 1;
    });
    dl.innerHTML = Object.keys(compte)
        .sort((a, b) => compte[b] - compte[a])
        .slice(0, 60)
        .map(s => `<option value="${escapeHtml(s)}"></option>`).join("");
}

/* Sans ce bloc, personne ne retourne cocher une étape dans l'onglet Projets
   et l'avancement se fige : on ne propose que les étapes des projets
   effectivement travaillés dans la journée. */
function renderJalonsAPortee(jour) {
    const bloc = qs("#todayJalonsBlock");
    const racine = qs("#todayJalonsRoot");
    if (!bloc || !racine) return;

    const travailles = new Set((getJournal()[jour] || []).map(t => t.cat || "Général"));
    const candidats = [];
    getSujets().filter(s => s.actif !== false && travailles.has(s.nom)).forEach(s => {
        (s.jalons || []).forEach((j, i) => { if (!j.f) candidats.push({ sujet: s.nom, jalon: j, index: i }); });
    });

    bloc.classList.toggle("hidden", !candidats.length);
    if (!candidats.length) return;

    qs("#todayJalonsSummary").textContent = `${candidats.length} à faire`;
    racine.innerHTML = "";
    candidats.slice(0, 8).forEach(c => {
        const enRetard = c.jalon.e && c.jalon.e < ymd(new Date());
        const el = document.createElement("div");
        el.className = "jalon" + (enRetard ? " retard" : "");
        el.innerHTML = `
            <button class="jalon-coche" role="checkbox" aria-checked="false"
                    aria-label="Marquer comme terminée : ${escapeHtml(c.jalon.t)}"></button>
            <span class="jalon-texte">${escapeHtml(c.jalon.t)}</span>
            <span class="chip" style="${stylePuceCat(c.sujet)}">${escapeHtml(c.sujet)}</span>
            <span class="jalon-date small-hint">${c.jalon.e ? "pour le " + fmtCourt(c.jalon.e) : ""}</span>`;
        el.querySelector(".jalon-coche").onclick = () => {
            const jalons = [...((getSujet(c.sujet) || {}).jalons || [])];
            jalons[c.index] = { ...jalons[c.index], f: ymd(new Date()) };
            if (majSujet(c.sujet, { jalons })) {
                renderToday();
                toast("Étape terminée ✅", c.jalon.t.slice(0, 50), "success");
            }
        };
        racine.appendChild(el);
    });
}

function ajouterTacheDepuisToday() {
    const texte = qs("#todayText").value.trim();
    if (!texte) return toast("Tâche manquante", "Indiquez ce que vous avez fait.", "warn");

    const horaire = qs("#todayTime").value.trim();
    const plageInvalide = !!horaire && !parsePlage(horaire);

    const auj = ymd(new Date());
    const journal = getJournal();
    journal[auj] = journal[auj] || [];
    journal[auj].push({
        id: nouvelIdTache(),
        timeRange: horaire,
        text: texte,
        cat: qs("#todayCat").value || "Général",
        notes: ""
    });
    if (!setJournal(journal)) return;

    qs("#todayTime").value = "";
    qs("#todayText").value = "";
    qs("#todayText").focus();

    renderToday();
    renderJournal();
    renderJournalStats();

    if (plageInvalide) {
        toast("Tâche ajoutée, horaire non compris", `« ${horaire} » n'est pas une plage valide (attendu : 09:00-10:30).`, "warn", 7000);
    } else {
        toast("Tâche ajoutée", texte.slice(0, 50), "success");
    }
}

/* Couleur par catégorie (palette fixe + hash).
   Deux variantes par teinte : la version vive est lisible sur le fond
   sombre, la version assombrie atteint 4,5:1 sur le fond clair. */
/* Douze teintes, deux variantes. Les luminosités ne sont volontairement PAS
   égalisées : la luminance est le seul canal qui survive à une dichromatie,
   et l'étaler en zigzag contre la rotation de teinte fait passer la
   séparabilité de 1,8 à 5,0 ΔE00 pour un contraste identique.
   Chaque teinte tient au moins 4,5:1 sur les cinq fonds où elle peut poser. */
const PALETTE_CATS = [
    { sombre: "#7DCEFF", clair: "#004C6C" },
    { sombre: "#53CCDF", clair: "#006774" },
    { sombre: "#40B3AC", clair: "#004A47" },
    { sombre: "#84D0AA", clair: "#00623F" },
    { sombre: "#90B177", clair: "#437026" },
    { sombre: "#A39A5C", clair: "#444100" },
    { sombre: "#F1BF8D", clair: "#7F4E0B" },
    { sombre: "#EEA58C", clair: "#803118" },
    { sombre: "#FFBBBC", clair: "#8E2938" },
    { sombre: "#E29DC8", clair: "#77225D" },
    { sombre: "#AE92CC", clair: "#62428A" },
    { sombre: "#8AAEEA", clair: "#0063AC" }
];

function indexCat(cat) {
    let hash = 0;
    const s = String(cat || "Général");
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    return hash % PALETTE_CATS.length;
}

function colorForCat(cat) {
    return PALETTE_CATS[indexCat(cat)].sombre;
}

/* Attributs de style d'une puce de catégorie.
   Les deux teintes sont posées en variables CSS : le changement de
   thème est alors purement visuel, sans re-rendu de la liste. */
function stylePuceCat(cat) {
    const c = PALETTE_CATS[indexCat(cat)];
    return `--c:${c.sombre};--c-clair:${c.clair}`;
}

function refreshCatSelect() {
    const sel = qs("#taskCat");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = "";
    getCats().forEach(c => {
        const o = document.createElement("option");
        o.value = o.textContent = c;
        if (c === current) o.selected = true;
        sel.appendChild(o);
    });
}

function refreshFilterCatSelect() {
    const sel = qs("#filterCat");
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">Toutes catégories</option>`;
    getCats().forEach(c => {
        const o = document.createElement("option");
        o.value = o.textContent = c;
        if (c === current) o.selected = true;
        sel.appendChild(o);
    });
}

/* Filtrage : recherche texte + catégorie + plage de dates */
function getFilteredJournal() {
    const journal = getJournal();
    const q    = (qs("#searchText")?.value || "").trim().toLowerCase();
    const cat  = qs("#filterCat")?.value || "";
    const from = qs("#filterFrom")?.value || "";
    const to   = qs("#filterTo")?.value || "";

    const out = {};
    Object.keys(journal).forEach(day => {
        if (from && day < from) return;
        if (to && day > to) return;
        const tasks = journal[day].filter(t => {
            if (cat && t.cat !== cat) return false;
            if (q && !(`${t.text} ${t.cat} ${t.timeRange || ""}`.toLowerCase().includes(q))) return false;
            return true;
        });
        if (tasks.length) out[day] = tasks;
    });
    return out;
}

/* Statistiques rapides du journal */
function renderJournalStats() {
    const statsEl = qs("#journalStats");
    if (!statsEl) return;

    const journal = getJournal();
    const allTasks = Object.values(journal).flat();
    const today    = ymd(new Date());
    const todayTasks = journal[today] || [];

    let totalMin = 0, sansDuree = 0;
    allTasks.forEach(t => {
        const p = parsePlage(t.timeRange);
        if (p) totalMin += p.duree; else sansDuree++;
    });

    const catCount = new Set(allTasks.map(t => t.cat)).size;

    statsEl.innerHTML = `
        <div class="kpi-box"><div class="kpi-val accent">${Object.keys(journal).length}</div><div class="kpi-label">Jours actifs</div></div>
        <div class="kpi-box"><div class="kpi-val">${allTasks.length}</div><div class="kpi-label">Tâches totales</div></div>
        <div class="kpi-box"><div class="kpi-val cyan">${todayTasks.length}</div><div class="kpi-label">Tâches aujourd'hui</div></div>
        <div class="kpi-box"><div class="kpi-val green">${hm(totalMin)}</div><div class="kpi-label">Temps total saisi</div></div>
        <div class="kpi-box"><div class="kpi-val">${catCount}</div><div class="kpi-label">Catégories utilisées</div></div>
        ${sansDuree ? `<div class="kpi-box"><div class="kpi-val amber">${sansDuree}</div><div class="kpi-label">Sans durée exploitable</div></div>` : ""}
    `;
}

/* État d'édition en cours */
let editingTask = null; // { day, id }

/* Affichage journal */
/* Nombre de jours montés dans #journalRoot. Remis au palier de départ dès que
   le critère d'affichage change (filtre, tri, recherche). */
const PAS_HISTORIQUE = 30;
let joursAffiches = PAS_HISTORIQUE;

/* À passer en gestionnaire partout où l'utilisateur change ce qu'il regarde :
   la fenêtre doit repartir du début, sinon elle reste ouverte sur 300 jours. */
function rerendreDepuisFiltre() {
    joursAffiches = PAS_HISTORIQUE;
    renderJournal();
}

function renderJournal() {
    const root    = qs("#journalRoot");
    const journal = getFilteredJournal();
    const order   = getSortOrder();

    // « Voir tout l'historique » n'a de sens que si un filtre de date est posé
    const filtreDate = !!(qs("#filterFrom")?.value || qs("#filterTo")?.value);
    qs("#showAllBtn")?.classList.toggle("hidden", !filtreDate);

    const days = Object.keys(journal).sort((a, b) =>
        order === "asc" ? a.localeCompare(b) : b.localeCompare(a)
    );

    if (!days.length) {
        root.innerHTML = filtreDate
            ? `<p class="small-hint" style="text-align:center;padding:24px 0;">Aucune tâche sur cette période.<br/>Utilisez « 🗓 Voir tout l'historique » pour afficher toutes vos tâches.</p>`
            : `<p class="small-hint" style="text-align:center;padding:24px 0;">Aucune tâche ne correspond.</p>`;
        return;
    }

    root.innerHTML = "";

    // Sans borne, deux ans d'alternance représentent ~28 000 nœuds reconstruits
    // à CHAQUE rendu — ajout, suppression, tri, frappe dans la recherche. On ne
    // monte qu'une fenêtre, étendue à la demande.
    const visibles = days.slice(0, joursAffiches);

    visibles.forEach(day => {
        const tasks   = journal[day];
        const block   = document.createElement("div");
        block.className = "day-block";

        // Temps total du jour
        let dayMin = 0;
        tasks.forEach(t => { const p = parsePlage(t.timeRange); if (p) dayMin += p.duree; });

        block.innerHTML = `
            <div class="day-block-header">
                <h3>${fmtFR(day)}</h3>
                <span class="day-badge">${tasks.length} tâche${tasks.length > 1 ? "s" : ""}${dayMin > 0 ? " · " + hm(dayMin) : ""}</span>
            </div>`;

        tasks.forEach(task => {
            const row  = document.createElement("div");

            if (editingTask && editingTask.day === day && editingTask.id === task.id) {
                row.className = "task task-editing";
                row.innerHTML = `
                    <div style="flex:1;">
                        <div class="row" style="margin:0 0 8px;">
                            <input class="grow edit-time" value="${escapeHtml(task.timeRange || "")}" placeholder="08:30-10:00" style="flex:.5 1 110px;" />
                            <input class="grow edit-text" value="${escapeHtml(task.text)}" style="flex:2 1 200px;" />
                            <select class="grow edit-cat" style="flex:.6 1 130px;">
                                ${getCats().map(c => `<option value="${escapeHtml(c)}" ${c === task.cat ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
                            </select>
                        </div>
                        <textarea class="edit-notes" rows="2" style="width:100%;margin-bottom:8px;" placeholder="📝 Note détaillée…">${escapeHtml(task.notes || "")}</textarea>
                        <div class="row" style="margin:0;">
                            <button class="edit-save">✔ Enregistrer</button>
                            <button class="btn-ghost edit-cancel">Annuler</button>
                        </div>
                    </div>`;

                row.querySelector(".edit-save").onclick = () => {
                    const j = getJournal();
                    const t = j[day].find(t => t.id === task.id);
                    if (t) {
                        t.timeRange = row.querySelector(".edit-time").value.trim();
                        t.text      = row.querySelector(".edit-text").value.trim() || t.text;
                        t.cat       = row.querySelector(".edit-cat").value;
                        t.notes     = row.querySelector(".edit-notes").value.trim();
                    }
                    setJournal(j);
                    editingTask = null;
                    renderJournal();
                    renderJournalStats();
                    toast("Tâche modifiée", "", "success");
                };
                row.querySelector(".edit-cancel").onclick = () => { editingTask = null; renderJournal(); };

                block.appendChild(row);
                return;
            }

            row.className = "task";
            const color = colorForCat(task.cat);
            const hasNotes = !!(task.notes && task.notes.trim());

            row.innerHTML = `
                <div class="task-left" style="flex-direction:column; align-items:flex-start; gap:6px;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span class="chip" style="${stylePuceCat(task.cat)}">${escapeHtml(task.cat || "Général")}</span>
                        ${task.timeRange ? `<span class="task-time">${escapeHtml(task.timeRange)}</span>` : ""}
                    </div>
                    <span class="task-text">${escapeHtml(task.text)}</span>
                    ${hasNotes ? `<button type="button" class="task-note-toggle">📝 Voir la note</button><div class="task-note-body hidden"></div>` : ""}
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn-ghost edit-btn" data-id="${task.id}" data-day="${day}" style="padding:6px 10px;font-size:.75rem;"
                            aria-label="Modifier : ${escapeHtml(task.text.slice(0, 40))}" title="Modifier">✏️</button>
                    <button class="btn-danger del-btn" data-id="${task.id}" data-day="${day}" style="padding:6px 10px;font-size:.75rem;"
                            aria-label="Supprimer : ${escapeHtml(task.text.slice(0, 40))}" title="Supprimer">✕</button>
                </div>
            `;

            if (hasNotes) {
                const noteBtn  = row.querySelector(".task-note-toggle");
                const noteBody = row.querySelector(".task-note-body");
                noteBody.textContent = task.notes;
                noteBtn.onclick = () => {
                    noteBody.classList.toggle("hidden");
                    noteBtn.textContent = noteBody.classList.contains("hidden") ? "📝 Voir la note" : "📝 Masquer la note";
                };
            }

            row.querySelector(".edit-btn").onclick = function () {
                editingTask = { day: this.dataset.day, id: +this.dataset.id };
                renderJournal();
            };

            row.querySelector(".del-btn").onclick = function () {
                supprimerTache(this.dataset.day, +this.dataset.id);
            };

            block.appendChild(row);
        });

        root.appendChild(block);
    });

    const restants = days.length - visibles.length;
    if (restants > 0) {
        const plus = document.createElement("button");
        plus.className = "btn-ghost";
        plus.style.cssText = "display:block;margin:16px auto;";
        plus.textContent = `Afficher ${Math.min(PAS_HISTORIQUE, restants)} jours de plus (${restants} restants)`;
        plus.onclick = () => { joursAffiches += PAS_HISTORIQUE; renderJournal(); };
        root.appendChild(plus);
    }
}

/* Les tâches sont visibles dans deux vues : toute modification les rafraîchit. */
function rafraichirVuesTaches() {
    renderJournal();
    renderJournalStats();
    renderToday();
}

/* Suppression d'une tâche, avec possibilité d'annuler pendant 8 secondes.
   On restaure la tâche à sa position d'origine, pas en fin de liste. */
function supprimerTache(jour, id) {
    const j = getJournal();
    if (!Array.isArray(j[jour])) return;

    const position = j[jour].findIndex(t => t.id === id);
    if (position < 0) return;
    const tache = j[jour][position];

    j[jour] = j[jour].filter(t => t.id !== id);
    if (!j[jour].length) delete j[jour];
    if (!setJournal(j)) return;

    rafraichirVuesTaches();

    toast("Tâche supprimée", tache.text.slice(0, 60), "warn", 8000, {
        label: "Annuler",
        onClick: () => {
            const retour = getJournal();
            retour[jour] = retour[jour] || [];
            retour[jour].splice(Math.min(position, retour[jour].length), 0, tache);
            if (!setJournal(retour)) return;
            rafraichirVuesTaches();
            toast("Tâche restaurée", tache.text.slice(0, 60), "success");
        }
    });
}

/* Export PDF journal */
function exportJournalPdf() {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) return toast("Bibliothèque manquante", "jsPDF non chargé.", "error");

    const journal = getJournal();
    const dates   = Object.keys(journal).sort();
    if (!dates.length) return toast("Rien à exporter", "Aucune tâche dans le journal.", "warn");

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const lineH = 7;
    const pageH = pdf.internal.pageSize.getHeight();
    let y = 22;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("Journal de Bord", 10, y); y += 8;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(130, 130, 130);
    pdf.text(`Exporté le ${new Date().toLocaleDateString("fr-FR")}`, 10, y); y += 10;
    pdf.setTextColor(0, 0, 0);

    dates.forEach(date => {
        if (y > pageH - 20) { pdf.addPage(); y = 20; }
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.text(fmtFR(date), 10, y); y += lineH;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);

        journal[date].forEach(t => {
            const text  = `  • [${t.timeRange || "--:--"}] (${t.cat}) — ${t.text}`;
            const lines = pdf.splitTextToSize(text, 185);
            lines.forEach(line => {
                if (y > pageH - 15) { pdf.addPage(); y = 20; }
                pdf.text(line, 10, y); y += lineH;
            });
            if (t.notes && t.notes.trim()) {
                pdf.setFontSize(8.5); pdf.setTextColor(120, 120, 120);
                pdf.splitTextToSize(`      📝 ${t.notes.trim()}`, 180).forEach(nl => {
                    if (y > pageH - 15) { pdf.addPage(); y = 20; }
                    pdf.text(nl, 10, y); y += 5;
                });
                pdf.setFontSize(10); pdf.setTextColor(0, 0, 0);
            }
        });
        y += 4;
    });

    pdf.save("journal_de_bord.pdf");
    toast("Export réussi", "journal_de_bord.pdf téléchargé.", "success");
}

/* ═══════════════════════════════════════════════════════
   JOURS OUVRÉS ET FÉRIÉS
   Seules survivances du pointage : le Gantt s'en sert pour griser les
   week-ends et les jours fériés dans son calque de fond.
═══════════════════════════════════════════════════════ */
function weekDays(ref) {
    const d   = parseYMD(ref);
    const day = (d.getDay() + 6) % 7;
    const mon = new Date(d);
    mon.setDate(d.getDate() - day);
    return Array.from({ length: 7 }, (_, i) => {
        const tmp = new Date(mon);
        tmp.setDate(mon.getDate() + i);
        return ymd(tmp);
    });
}

/* ═══════════════════════════════════════════════════════
   UTILITAIRES DE PÉRIODE (utilisés par le rapport d'alternance)
═══════════════════════════════════════════════════════ */
function tasksInRange(journal, start, end) {
    const out = [];
    Object.keys(journal).filter(d => d >= start && d <= end).sort().forEach(date => {
        (journal[date] || []).forEach(t => {
            const p = parsePlage(t.timeRange);
            if (!p) return;
            out.push({ date, cat: t.cat || "Général", text: t.text || "", startMin: p.debut, endMin: p.fin });
        });
    });
    return out;
}

function getWeekRange(refDate) {
    const d   = parseYMD(refDate);
    const day = (d.getDay() + 6) % 7;
    const mon = new Date(d);
    mon.setDate(d.getDate() - day);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return [ymd(mon), ymd(sun)];
}

function getMonthRange(refDate) {
    const d = parseYMD(refDate);
    return [ymd(new Date(d.getFullYear(), d.getMonth(), 1)), ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
}

/* ═══════════════════════════════════════════════════════
   RAPPORT ALTERNANCE (PDF stylé)
═══════════════════════════════════════════════════════ */
function initRapportPanel() {
    const today = ymd(new Date());
    qs("#rapportPreset").value = "week";
    const [s, e] = getWeekRange(today);
    qs("#rapportFrom").value = s;
    qs("#rapportTo").value   = e;

    qs("#rapportPreset").onchange = () => {
        const preset = qs("#rapportPreset").value;
        if (preset === "week")  { const [s, e] = getWeekRange(today); qs("#rapportFrom").value = s; qs("#rapportTo").value = e; }
        if (preset === "month") { const [s, e] = getMonthRange(today); qs("#rapportFrom").value = s; qs("#rapportTo").value = e; }
    };
}

function hexToRgb(hex) {
    hex = hex.replace("#", "");
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function exportRapportAlternancePdf() {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) return toast("jsPDF manquant", "", "error");

    const start = qs("#rapportFrom").value;
    const end   = qs("#rapportTo").value;
    if (!start || !end || end < start) return toast("Période invalide", "Vérifiez les dates.", "warn");

    const journal = getJournal();
    const dates   = Object.keys(journal).filter(d => d >= start && d <= end).sort();
    if (!dates.length) return toast("Rien à exporter", "Aucune tâche sur cette période.", "warn");

    const missions = qs("#rapportMissions").value.trim();
    const bilan    = qs("#rapportBilan").value.trim();
    const author   = getAuthorName();

    const tasks = tasksInRange(journal, start, end);
    let totalMin = 0;
    const byCat = {};
    tasks.forEach(t => { const m = t.endMin - t.startMin; totalMin += m; byCat[t.cat] = (byCat[t.cat] || 0) + m; });

    const pdf    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW  = pdf.internal.pageSize.getWidth();
    const pageH  = pdf.internal.pageSize.getHeight();
    const margin = 14;
    let y = 0;

    /* ── Bandeau d'en-tête ── */
    const [ar, ag, ab] = hexToRgb("#1F5C9B");
    pdf.setFillColor(ar, ag, ab);
    pdf.rect(0, 0, pageW, 38, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("Rapport d'activité — Alternance", margin, 17);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`${fmtFR(start)}  →  ${fmtFR(end)}`, margin, 26);
    pdf.text(`Rédigé par ${author}`, margin, 32);
    pdf.setTextColor(0, 0, 0);
    y = 48;

    const checkPage = need => { if (y + need > pageH - 14) { pdf.addPage(); y = 16; } };

    /* ── Missions / contexte ── */
    if (missions) {
        checkPage(20);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
        pdf.setTextColor(31, 92, 155);
        pdf.text("Missions / Contexte", margin, y); y += 6;
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
        pdf.splitTextToSize(missions, pageW - margin * 2).forEach(line => { checkPage(6); pdf.text(line, margin, y); y += 5.5; });
        y += 4;
    }

    /* ── Synthèse KPI ── */

    checkPage(28);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
    pdf.setTextColor(31, 92, 155);
    pdf.text("Synthèse", margin, y); y += 7;
    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
    pdf.text(`Activités détaillées : ${hm(totalMin)}   ·   Tâches : ${tasks.length}   ·   Jours actifs : ${dates.length}`, margin, y);
    y += 5.5;
    y += 4;

    /* ── Répartition par catégorie ── */
    checkPage(12 + Object.keys(byCat).length * 6);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
    pdf.setTextColor(31, 92, 155);
    pdf.text("Répartition par catégorie", margin, y); y += 7;
    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
    Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]).forEach(cat => {
        checkPage(6);
        const pct = totalMin ? Math.round((byCat[cat] / totalMin) * 100) : 0;
        const [r, g, b] = hexToRgb(colorForCat(cat));
        pdf.setFillColor(r, g, b);
        pdf.circle(margin + 1.3, y - 1.5, 1.3, "F");
        pdf.text(`${cat} — ${hm(byCat[cat])} (${pct}%)`, margin + 6, y);
        y += 6;
    });
    y += 4;

    /* ── Activités réalisées ── */
    checkPage(10);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
    pdf.setTextColor(31, 92, 155);
    pdf.text("Activités réalisées", margin, y); y += 7;
    pdf.setTextColor(0, 0, 0);

    dates.forEach(date => {
        checkPage(10);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(10.5);
        pdf.text(fmtFR(date), margin, y); y += 5.5;
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5);
        journal[date].forEach(t => {
            const line  = `${t.timeRange ? "[" + t.timeRange + "] " : ""}(${t.cat}) ${t.text}`;
            const lines = pdf.splitTextToSize("•  " + line, pageW - margin * 2 - 4);
            lines.forEach(l => { checkPage(5.5); pdf.text(l, margin + 3, y); y += 5; });
            if (t.notes && t.notes.trim()) {
                pdf.setFontSize(8.5); pdf.setTextColor(120, 120, 120);
                pdf.splitTextToSize(`   📝 ${t.notes.trim()}`, pageW - margin * 2 - 6).forEach(nl => {
                    checkPage(5); pdf.text(nl, margin + 5, y); y += 4.6;
                });
                pdf.setFontSize(9.5); pdf.setTextColor(0, 0, 0);
            }
        });
        y += 2;
    });

    /* ── Compétences / Bilan ── */
    if (bilan) {
        checkPage(18);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
        pdf.setTextColor(31, 92, 155);
        pdf.text("Compétences acquises / Bilan", margin, y); y += 7;
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
        pdf.splitTextToSize(bilan, pageW - margin * 2).forEach(line => { checkPage(6); pdf.text(line, margin, y); y += 5.5; });
    }

    /* ── Avancement et difficultés ──
       Un rapport d'alternance qui ne dit que « ce que j'ai fait » est
       incomplet : le tuteur attend où en sont les projets et ce qui a
       coincé. Ces deux sections viennent du Bilan, donc des mêmes
       chiffres que ceux affichés à l'écran. */
    if (typeof calculerBilan === "function") {
        const bil = calculerBilan(null);
        const av = bil.avancement, ret = bil.retards;

        if (av.totalJalons) {
            checkPage(20);
            pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
            pdf.setTextColor(31, 92, 155);
            pdf.text("Avancement des projets", margin, y); y += 7;
            pdf.setTextColor(0, 0, 0);
            pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
            pdf.text(`Avancement global : ${av.avancementGlobal} %  (${av.totalFaits}/${av.totalJalons} jalons)` +
                     (ret.taux === null ? "" : `   ·   taux de retard ${ret.taux} %`), margin, y);
            y += 6;
            pdf.setFontSize(9.5);
            av.projets.filter(p => p.jalons).forEach(p => {
                checkPage(6);
                pdf.text(`${p.nom} — ${p.avancement} % (${p.faits}/${p.jalons})` +
                         (p.jalonsEnRetard ? `, ${p.jalonsEnRetard} jalon(s) en retard` : ""), margin + 4, y);
                y += 5.2;
            });
            y += 4;
        }

        const diffs = bil.difficultes.liste;
        if (diffs.length) {
            checkPage(20);
            pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
            pdf.setTextColor(31, 92, 155);
            pdf.text("Difficultés rencontrées", margin, y); y += 7;
            pdf.setTextColor(0, 0, 0);
            pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5);
            diffs.forEach(x => {
                checkPage(10);
                pdf.setFont("helvetica", "bold");
                pdf.text(`[${libelleGravite(x.gravite)}] ${x.resolue ? "Résolue" : "Ouverte"}` +
                         (x.projet ? ` — ${x.projet}` : ""), margin, y);
                pdf.setFont("helvetica", "normal");
                y += 4.8;
                pdf.splitTextToSize(x.texte, pageW - margin * 2 - 4)
                   .forEach(l => { checkPage(5); pdf.text(l, margin + 4, y); y += 4.6; });
                if (x.resolution) {
                    pdf.setTextColor(90, 95, 100);
                    pdf.splitTextToSize("Solution : " + x.resolution, pageW - margin * 2 - 4)
                       .forEach(l => { checkPage(5); pdf.text(l, margin + 4, y); y += 4.6; });
                    pdf.setTextColor(0, 0, 0);
                }
                y += 2.5;
            });
        }
    }

    /* ── Pied de page ── */
    const pageCount = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Page ${i}/${pageCount}`, pageW - margin - 18, pageH - 8);
        pdf.text("Généré depuis Journal de Bord", margin, pageH - 8);
    }

    pdf.save(`rapport_alternance_${start}_${end}.pdf`);
    toast("Rapport généré", `rapport_alternance_${start}_${end}.pdf`, "success");
}

/* ═══════════════════════════════════════════════════════
   RÉGLAGES
═══════════════════════════════════════════════════════ */
function initAdmin() {
    renderAdmCats();

    qs("#exportBackupBtn").onclick = exportBackupFile;
    qs("#importBackupBtn").onclick = importBackupFile;
    qs("#exportJournalCsvBtn").onclick  = exportJournalCsv;
    qs("#exportPointageCsvBtn").onclick = exportPointageCsv;
    majEtatSauvegarde();
    majEtatArchives();
}

/* Les données de pointage ne sont plus exploitées par l'application, mais elles
   existent encore en base et voyagent dans chaque sauvegarde. On le dit, et on
   laisse un moyen de les récupérer, plutôt que de les faire disparaître en silence. */
function majEtatArchives() {
    const el = qs("#archiveStatus");
    if (!el) return;
    const n = Object.keys(getPoint()).length;
    el.textContent = n
        ? `${n} journée(s) de pointage conservées. Elles ne sont plus utilisées par l'application, mais restent incluses dans vos sauvegardes et exportables en CSV.`
        : "Aucune donnée de pointage archivée.";
    qs("#exportPointageCsvBtn")?.classList.toggle("hidden", !n);
}

function renderAdmCats() {
    const zone = qs("#admCats");
    if (!zone) return;
    zone.innerHTML = "";

    getCats().forEach(cat => {
        const item = document.createElement("div");
        item.className = "cat-item";

        const color = colorForCat(cat);
        item.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;">
                <span class="cat-color-dot" style="background:${color};"></span>
                <span class="chip" style="${stylePuceCat(cat)}">${escapeHtml(cat)}</span>
            </div>`;

        if (cat !== "Général") {
            const del = document.createElement("button");
            del.className   = "btn-danger";
            del.textContent = "Supprimer";
            del.style.cssText = "padding:5px 10px;font-size:.78rem;";

            del.onclick = () => {
                const j = getJournal();
                const concernees = Object.values(j).flat().filter(t => t.cat === cat).length;

                if (!confirm(
                    `Supprimer la catégorie « ${cat} » ?\n\n` +
                    (concernees
                        ? `${concernees} tâche(s) portant cette catégorie seront reclassées en « Général ».`
                        : "Aucune tâche n'utilise cette catégorie.") +
                    "\n\nCette action est irréversible."
                )) return;

                setCats(getCats().filter(c => c !== cat));
                Object.keys(j).forEach(d => { j[d] = j[d].map(t => t.cat === cat ? { ...t, cat: "Général" } : t); });
                setJournal(j);
                refreshCatSelect();
                refreshFilterCatSelect();
                refreshTrackerCatSelect();
                renderAdmCats();
                renderJournal();
                toast("Catégorie supprimée", `« ${cat} » → Général` + (concernees ? ` (${concernees} tâche(s))` : ""), "warn");
            };
            item.appendChild(del);
        }

        zone.appendChild(item);
    });
}

/* ── Rappel de sauvegarde ─────────────────────────────────
   Les données ne vivent que dans ce navigateur : vider les données de site
   les efface définitivement. On rappelle d'exporter quand ça fait longtemps. */
const LS_DERNIER_EXPORT = "jb_dernier_export";
const JOURS_AVANT_RAPPEL = 14;

const getDernierExport = () => { try { return localStorage.getItem(LS_DERNIER_EXPORT); } catch { return null; } };
const marquerExport = () => { try { localStorage.setItem(LS_DERNIER_EXPORT, new Date().toISOString()); } catch { /* ignoré */ } };

function joursDepuisDernierExport() {
    const iso = getDernierExport();
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d)) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function majEtatSauvegarde() {
    const el = qs("#backupStatus");
    if (!el) return;
    const jours = joursDepuisDernierExport();
    const nbTaches = Object.values(getJournal()).flat().length;

    if (!nbTaches) { el.textContent = ""; el.className = "small-hint"; return; }

    if (jours === null) {
        el.textContent = "Aucune sauvegarde exportée depuis cet appareil.";
        el.className = "small-hint amber";
    } else if (jours === 0) {
        el.textContent = "Dernière sauvegarde : aujourd'hui.";
        el.className = "small-hint";
    } else {
        el.textContent = `Dernière sauvegarde il y a ${jours} jour${jours > 1 ? "s" : ""}.`;
        el.className = "small-hint" + (jours >= JOURS_AVANT_RAPPEL ? " amber" : "");
    }
}

function rappelerSauvegardeSiBesoin() {
    const nbTaches = Object.values(getJournal()).flat().length;
    if (nbTaches < 5) return;                       // trop tôt pour déranger
    const jours = joursDepuisDernierExport();
    if (jours !== null && jours < JOURS_AVANT_RAPPEL) return;

    toast(
        "Pensez à sauvegarder",
        jours === null
            ? `${nbTaches} tâches enregistrées et aucune sauvegarde. Vider les données du navigateur les effacerait.`
            : `Dernière sauvegarde il y a ${jours} jours.`,
        "warn", 10000,
        { label: "Exporter", onClick: () => { show("admin"); initAdmin(); exportBackupFile(); } }
    );
}

/* ── Export CSV (tableur) ─────────────────────────────── */
function versCSV(lignes) {
    const echapper = v => {
        let s = String(v ?? "");
        // Une cellule commençant par =, +, - ou @ est interprétée comme une
        // formule par Excel et LibreOffice. Une description de tâche saisie
        // ainsi deviendrait du code exécuté à l'ouverture du fichier.
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    // point-virgule + BOM : Excel en configuration française ouvre le fichier directement
    return "﻿" + lignes.map(l => l.map(echapper).join(";")).join("\r\n");
}

function telechargerFichier(contenu, nom, type) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
}

function exportJournalCsv() {
    const journal = getJournal();
    const jours = Object.keys(journal).sort();
    if (!jours.length) return toast("Rien à exporter", "Aucune tâche dans le journal.", "warn");

    const lignes = [["Date", "Début", "Fin", "Durée (min)", "Catégorie", "Description", "Note"]];
    jours.forEach(j => journal[j].forEach(t => {
        const p = parsePlage(t.timeRange);
        lignes.push([j, p ? hm(p.debut) : (t.timeRange || ""), p ? hm(p.fin) : "", p ? p.duree : "", t.cat || "", t.text || "", t.notes || ""]);
    }));

    telechargerFichier(versCSV(lignes), `journal_${ymd(new Date())}.csv`, "text/csv;charset=utf-8");
    toast("Export CSV réussi", `${lignes.length - 1} ligne(s) exportée(s).`, "success");
}

function exportPointageCsv() {
    const p = getPoint();
    const jours = Object.keys(p).sort();
    if (!jours.length) return toast("Rien à exporter", "Aucun pointage enregistré.", "warn");

    const lignes = [["Date", "Jour férié", "Arrivée", "Pause début", "Pause fin", "Départ", "Total (min)", "Total (HH:MM)"]];
    jours.forEach(j => {
        const r = p[j];
        lignes.push([j, holidayLabel(j) || "", r.arrivee || "", r.pauseDebut || "", r.pauseFin || "", r.depart || "", r.total || 0, hm(r.total || 0)]);
    });

    telechargerFichier(versCSV(lignes), `pointage_${ymd(new Date())}.csv`, "text/csv;charset=utf-8");
    toast("Export CSV réussi", `${lignes.length - 1} journée(s) exportée(s).`, "success");
}

/* ── Backup ──────────────────────────────────────────── */
/* Les clés du pointage (pointage, contrat, workHours) ne sont plus lues par
   l'interface mais restent transportées dans chaque export : les 67 journées
   déjà saisies ne doivent pas disparaître parce qu'un écran a été retiré. */
function buildBackupObject() {
    return {
        cats: getCats(), journal: getJournal(),
        sujets: typeof getSujets === "function" ? getSujets() : undefined,
        difficultes: typeof getDifficultes === "function" ? getDifficultes() : undefined,
        sort: getSortOrder(),
        pointage: getPoint(),
        workHours: getWorkHours(),
        contrat: getContrat(),
        date: new Date().toISOString()
    };
}

/* Export universel — fonctionne sur PC et mobile (téléchargement classique) */
function exportBackupFile() {
    const blob = new Blob([JSON.stringify(buildBackupObject(), null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    const stamp = ymd(new Date());
    a.href = url;
    a.download = `journal_backup_${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    marquerExport();
    majEtatSauvegarde();
    toast("Sauvegarde téléchargée ✅", a.download, "success");
}

function importBackupFile() {
    const inp = qs("#backupFileInput");
    inp.value = "";
    inp.onchange = async () => {
        const file = inp.files[0];
        if (!file) return;
        let obj;
        try {
            obj = JSON.parse(await file.text());
        } catch {
            return toast("Fichier invalide", "Ce fichier n'est pas une sauvegarde JSON lisible.", "error");
        }

        const bilan = analyserSauvegarde(obj);
        if (!bilan.valide) return toast("Sauvegarde invalide", bilan.raison, "error");

        const actuel = Object.values(getJournal()).flat().length;
        const message =
            `Importer cette sauvegarde ?\n\n` +
            `Fichier : ${bilan.jours} jour(s), ${bilan.taches} tâche(s), ${bilan.pointages} pointage(s)` +
            (bilan.ignores ? `\n${bilan.ignores} entrée(s) illisible(s) seront ignorées.` : "") +
            `\n\nVos données actuelles (${actuel} tâche(s)) seront REMPLACÉES.\n` +
            `Cette action est irréversible — exportez d'abord une sauvegarde si besoin.`;
        if (!confirm(message)) return toast("Import annulé", "Vos données n'ont pas été touchées.", "info");

        applyBackup(obj, bilan);
    };
    inp.click();
}

/* Contrôle et normalisation d'un fichier de sauvegarde.
   Tolère les anciens formats (« creds », « rate », « priority », « status ») et
   écarte les entrées malformées plutôt que de les laisser casser l'affichage. */
function analyserSauvegarde(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
        return { valide: false, raison: "Le fichier ne contient pas d'objet de sauvegarde." };
    }
    const estDico = v => v && typeof v === "object" && !Array.isArray(v);
    if (!estDico(obj.journal)) {
        return { valide: false, raison: "La section « journal » est absente ou illisible." };
    }
    // Le pointage n'est plus exigé : une sauvegarde produite après son retrait
    // n'en contient pas. Absent, il est traité comme vide — et non comme une erreur.
    if (obj.pointage !== undefined && !estDico(obj.pointage)) {
        return { valide: false, raison: "La section « pointage » est présente mais illisible." };
    }

    /* Contrôle calendaire, pas seulement structurel : « 2026-13-99 » a la bonne
       forme mais n'existe pas, et se propagerait dans les comparaisons de dates. */
    const estDate = k => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return false;
        const [a, m, j] = k.split("-").map(Number);
        if (m < 1 || m > 12 || j < 1) return false;
        return j <= new Date(a, m, 0).getDate();
    };
    let ignores = 0, taches = 0;

    const journal = {};
    Object.keys(obj.journal).forEach(jour => {
        if (!estDate(jour) || !Array.isArray(obj.journal[jour])) { ignores++; return; }
        const liste = obj.journal[jour]
            .filter(t => t && typeof t === "object" && typeof t.text === "string")
            .map(t => ({
                id:        Number.isFinite(t.id) ? t.id : Date.now() + Math.floor(taches),
                timeRange: typeof t.timeRange === "string" ? t.timeRange : "",
                text:      t.text,
                cat:       typeof t.cat === "string" && t.cat ? t.cat : "Général",
                notes:     typeof t.notes === "string" ? t.notes : ""
            }));
        ignores += obj.journal[jour].length - liste.length;
        if (liste.length) { journal[jour] = liste; taches += liste.length; }
    });

    // Ces valeurs sont réinjectées dans les tableaux Semaine et Mois : on
    // n'accepte qu'un format d'heure strict, jamais une chaîne arbitraire.
    const heureSure = v => (typeof v === "string" && /^([01]?\d|2[0-3]):[0-5]\d$/.test(v.trim())) ? v.trim() : "";

    const pointage = {};
    Object.keys(obj.pointage || {}).forEach(jour => {
        const p = obj.pointage[jour];
        if (!estDate(jour) || !estDico(p)) { ignores++; return; }
        const nettoye = {
            arrivee:    heureSure(p.arrivee),
            pauseDebut: heureSure(p.pauseDebut),
            pauseFin:   heureSure(p.pauseFin),
            depart:     heureSure(p.depart),
            total:      Number.isFinite(p.total) && p.total >= 0 ? p.total : 0
        };
        if (["arrivee","pauseDebut","pauseFin","depart"].some(k => p[k] && !nettoye[k])) ignores++;
        pointage[jour] = nettoye;
    });

    /* Sujets (v2) : un fichier antérieur n'en a pas, on le laisse à null et la
       migration les reconstruira depuis les catégories et le journal. */
    const estDateOuVide = v => v === "" || (typeof v === "string" && estDate(v));
    const sujets = Array.isArray(obj.sujets)
        ? obj.sujets
            .filter(s => s && typeof s === "object" && typeof s.nom === "string" && s.nom.trim())
            .map(s => ({
                nom:    s.nom.trim(),
                actif:  s.actif !== false,
                debut:  estDateOuVide(s.debut) ? s.debut : "",
                fin:    estDateOuVide(s.fin)   ? s.fin   : "",
                jalons: Array.isArray(s.jalons)
                    ? s.jalons
                        .filter(j => j && typeof j === "object" && typeof j.t === "string" && j.t.trim())
                        .map(j => ({
                            t: j.t.trim(),
                            e: estDateOuVide(j.e) ? j.e : "",
                            f: estDateOuVide(j.f) ? j.f : ""
                        }))
                    : []
            }))
        : null;

    /* Difficultés : absentes d'un fichier antérieur, ce qui n'est pas une erreur.
       null signifie « le fichier n'en parle pas », à distinguer de [] qui veut
       dire « le fichier dit qu'il n'y en a aucune » — seul le second écrase. */
    const difficultes = Array.isArray(obj.difficultes)
        ? obj.difficultes
            .filter(d => d && typeof d === "object" && typeof d.texte === "string" && d.texte.trim())
            .map((d, i) => ({
                id:      Number.isFinite(d.id) ? d.id : Date.now() + i,
                date:    estDate(d.date) ? d.date : ymd(new Date()),
                texte:   d.texte.trim(),
                projet:  typeof d.projet === "string" ? d.projet.trim() : "",
                gravite: graviteValide(d.gravite),
                resolue: estDateOuVide(d.resolue) ? d.resolue : "",
                resolution: typeof d.resolution === "string" ? d.resolution : ""
            }))
        : null;

    const contrat = (obj.contrat && Number.isFinite(obj.contrat.objectifJourMin) && Number.isFinite(obj.contrat.toleranceMin)
        && obj.contrat.objectifJourMin > 0 && obj.contrat.toleranceMin >= 0)
        ? { objectifJourMin: obj.contrat.objectifJourMin, toleranceMin: obj.contrat.toleranceMin }
        : null;

    const cats = Array.isArray(obj.cats)
        ? [...new Set(["Général", ...obj.cats.filter(c => typeof c === "string" && c.trim())])]
        : null;

    return {
        valide: true, ignores, taches,
        jours: Object.keys(journal).length,
        pointages: Object.keys(pointage).length,
        difficultes: difficultes ? difficultes.length : 0,
        propre: {
            journal, pointage, cats, contrat, sujets, difficultes,
            sort: obj.sort === "asc" ? "asc" : "desc",
            workHours: (obj.workHours && !isNaN(parseHM(obj.workHours.start)) && !isNaN(parseHM(obj.workHours.end)))
                ? obj.workHours : null,
            date: obj.date
        }
    };
}

function applyBackup(obj, bilan) {
    bilan = bilan || analyserSauvegarde(obj);
    if (!bilan.valide) return toast("Sauvegarde invalide", bilan.raison, "error");

    const d = bilan.propre;
    if (d.cats) setCats(d.cats);

    /* Les sujets étaient validés à l'import mais jamais réécrits : une
       restauration repartait donc sans aucune date de projet ni aucun jalon,
       que la migration reconstruisait vides. L'ordre compte — setSujets écrit
       jb_cats en miroir, et la migration qui suit rattrape les catégories
       présentes dans le journal mais absentes des sujets restaurés. */
    if (d.sujets) setSujets(d.sujets);

    /* null = le fichier ne parle pas de difficultés, on garde les nôtres ;
       [] = le fichier affirme qu'il n'y en a aucune, on écrase. */
    if (d.difficultes) setDifficultes(d.difficultes);

    const ok = setJournal(d.journal) && setPoint(d.pointage);
    setSortOrder(d.sort);
    if (d.workHours) setWorkHours(d.workHours.start, d.workHours.end);
    if (d.contrat) setContrat(d.contrat);

    migrerVersSujets();

    initJournal();
    initToday();      // la vue du jour affichait sinon les données d'avant l'import
    initAdmin();
    if (typeof renderProjets === "function") renderProjets();
    if (typeof renderBilan   === "function") renderBilan();

    if (!ok) return toast("Restauration incomplète", "Le navigateur a refusé d'enregistrer toutes les données.", "error", 9000);

    const quand = d.date && !isNaN(new Date(d.date)) ? ` du ${new Date(d.date).toLocaleDateString("fr-FR")}` : "";
    const detail = [
        `${bilan.taches} tâche(s)`,
        d.sujets ? `${d.sujets.length} projet(s)` : null,
        bilan.difficultes ? `${bilan.difficultes} difficulté(s)` : null
    ].filter(Boolean).join(", ");
    toast(
        "Restauration complète",
        `Sauvegarde${quand} — ${detail}` +
        (bilan.ignores ? ` · ${bilan.ignores} entrée(s) illisible(s) ignorée(s)` : ""),
        "success"
    );
}

console.log("✅ Journal de Bord — chargé");

/* ── PWA : enregistrement du service worker ─────────────
   Une nouvelle version prenait le contrôle sans que la page soit rechargée :
   l'utilisateur continuait d'exécuter l'ancien code jusqu'à fermer l'onglet.
   On le lui signale, sans jamais recharger d'autorité — une saisie en cours
   serait perdue. */
if ("serviceWorker" in navigator) {
    const avaitDejaUnControleur = !!navigator.serviceWorker.controller;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!avaitDejaUnControleur) return;   // première installation : rien à signaler
        toast(
            "Nouvelle version disponible",
            "Rechargez la page pour en bénéficier. Vos données ne sont pas affectées.",
            "info", 20000,
            { label: "Recharger", onClick: () => location.reload() }
        );
    });

    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js")
            .then(reg => {
                console.log("✅ Service worker enregistré");
                // Vérifie l'existence d'une mise à jour au retour sur l'onglet
                document.addEventListener("visibilitychange", () => {
                    if (document.visibilityState === "visible") reg.update().catch(() => {});
                });
            })
            .catch(err => console.warn("Service worker non enregistré :", err));
    });
}
