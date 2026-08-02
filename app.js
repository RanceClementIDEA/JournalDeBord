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
const getTolerance = () => getContrat().toleranceMin;
/* Objectif net d'une journée ouvrée : la tolérance est déjà déduite du temps pointé. */
const getObjectifJour = () => { const c = getContrat(); return c.objectifJourMin - c.toleranceMin; };

function initHeaderClock() {
    const dateEl = qs("#headerDate");
    const fillEl = qs("#dayProgressFill");
    const timeEl = qs("#dayProgressTime");

    function tick() {
        const now = new Date();
        if (dateEl) {
            dateEl.textContent = now.toLocaleDateString("fr-FR", {
                weekday: "long", day: "numeric", month: "long", year: "numeric"
            });
        }

        // Progression de la journée de travail (configurable dans Admin)
        const wh = getWorkHours();
        const workStart = parseHM(wh.start);
        const workEnd   = parseHM(wh.end);
        const currentMin = now.getHours() * 60 + now.getMinutes();
        const pct = (isNaN(workStart) || isNaN(workEnd) || workEnd <= workStart)
            ? 0
            : Math.min(100, Math.max(0, ((currentMin - workStart) / (workEnd - workStart)) * 100));

        if (fillEl) fillEl.style.width = pct.toFixed(1) + "%";
        if (timeEl) {
            timeEl.textContent =
                String(now.getHours()).padStart(2, "0") + ":" +
                String(now.getMinutes()).padStart(2, "0") +
                " · " + pct.toFixed(0) + "% journée (" + wh.start + "–" + wh.end + ")";
        }
    }

    tick();
    setInterval(tick, 30000);
}

/* ── Thème clair/sombre ──────────────────────────────── */
const LS_THEME = "jb_theme";
function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = qs("#themeToggleBtn");
    if (btn) btn.textContent = theme === "light" ? "☀️" : "🌙";
}
function initTheme() {
    const saved = localStorage.getItem(LS_THEME) || "dark";
    applyTheme(saved);
    qs("#themeToggleBtn").onclick = () => {
        const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
        localStorage.setItem(LS_THEME, next);
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

    initQuickAdd();
    initRaccourcisClavier();

    qs("#liveBannerStop").onclick = () => stopTracker(false);

    qs("#tab-today").onclick    = () => { show("today"); renderToday(); };
    qs("#tab-journal").onclick  = () => show("journal");
    qs("#tab-pointage").onclick = () => show("pointage");
    qs("#tab-admin").onclick    = () => { show("admin"); initAdmin(); };

    // L'application s'ouvre sur la journée en cours
    initJournal();
    initPointage();
    initToday();
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
    else if (action === "pointage") { show("pointage"); qs("#pArr").focus(); }
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
    const endDate    = new Date(last.end);
    const fmt2 = n => String(n).padStart(2, "0");
    const timeRange = `${fmt2(startDate.getHours())}:${fmt2(startDate.getMinutes())}-${fmt2(endDate.getHours())}:${fmt2(endDate.getMinutes())}`;

    const journal = getJournal();
    journal[t.day] = journal[t.day] || [];
    journal[t.day].push({
        id: nouvelIdTache(),
        timeRange,
        text: t.text,
        cat: t.cat,
        notes: t.sessions.length > 1 ? `Suivi en direct — ${t.sessions.length} session(s) (pauses incluses).` : ""
    });
    setJournal(journal);
    setTrackerState(null);
    renderTrackerIdle();
    renderJournal();
    renderJournalStats();

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
        minuteurRecherche = setTimeout(renderJournal, 180);
    };
    qs("#filterCat").onchange  = renderJournal;
    qs("#filterFrom").onchange = renderJournal;
    qs("#filterTo").onchange   = renderJournal;
    qs("#clearFiltersBtn").onclick = () => {
        qs("#searchText").value = "";
        qs("#filterCat").value  = "";
        qs("#filterFrom").value = "";
        qs("#filterTo").value   = "";
        renderJournal();
    };

    // Retire en un clic le filtre « aujourd'hui » appliqué au démarrage
    qs("#showAllBtn").onclick = () => {
        qs("#filterFrom").value = "";
        qs("#filterTo").value   = "";
        renderJournal();
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
        renderJournal();
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

        const cible = e.target;
        const dansUnChamp = cible && (/^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName) || cible.isContentEditable);
        if (dansUnChamp || e.ctrlKey || e.metaKey || e.altKey) return;

        switch (e.key.toLowerCase()) {
            case "a": e.preventDefault(); openQuickAdd(); break;
            case "1": show("today"); renderToday(); break;
            case "2": show("journal"); break;
            case "3": show("pointage"); break;
            case "4": show("admin"); initAdmin(); break;
            case "/": e.preventDefault(); show("journal"); qs("#searchText").focus(); break;
            case "?": afficherAideRaccourcis(); break;
        }
    });
}

function afficherAideRaccourcis() {
    toast(
        "Raccourcis clavier",
        "A : ajout rapide · / : rechercher · 1 : Aujourd'hui · 2 : Historique · 3 : Pointage · 4 : Réglages · Échap : fermer",
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

    qs("#todaySaveBtn").onclick = enregistrerPointageDuJourDepuisToday;
    qs("#todayAddBtn").onclick  = ajouterTacheDepuisToday;
    qs("#todayText").onkeydown  = e => { if (e.key === "Enter") ajouterTacheDepuisToday(); };

    // Pointage en un clic : inscrit l'heure courante dans le champ correspondant
    const tamponner = (selecteur) => () => {
        const now = new Date();
        qs(selecteur).value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        enregistrerPointageDuJourDepuisToday(true);
    };
    qs("#stampArrBtn").onclick = tamponner("#tArr");
    qs("#stampPDBtn").onclick  = tamponner("#tPD");
    qs("#stampPFBtn").onclick  = tamponner("#tPF");
    qs("#stampDepBtn").onclick = tamponner("#tDep");

    qs("#goToHistoryBtn").onclick = () => {
        show("journal");
        qs("#filterFrom").value = "";
        qs("#filterTo").value   = "";
        renderJournal();
    };
    qs("#goToWeekBtn").onclick = () => show("pointage");

    renderToday();
}

function renderToday() {
    const auj = ymd(new Date());

    /* ── Pointage du jour ── */
    const r = getPoint()[auj] || {};
    qs("#tArr").value = r.arrivee    || "";
    qs("#tPD").value  = r.pauseDebut || "";
    qs("#tPF").value  = r.pauseFin   || "";
    qs("#tDep").value = r.depart     || "";

    const complet = r.arrivee && r.pauseDebut && r.pauseFin && r.depart;
    qs("#todayTotal").textContent = complet ? hm(r.total || 0) : "—";

    const statut = qs("#todayPointStatus");
    if (complet) {
        const objectif = getObjectifJour();
        const ecart = (r.total || 0) - objectif;
        statut.textContent = `Objectif du jour : ${hm(objectif)} · écart ${ecart >= 0 ? "+" : "−"}${hm(Math.abs(ecart))}`;
        statut.className = "small-hint" + (ecart >= 0 ? "" : " amber");
    } else if (r.arrivee) {
        statut.textContent = "Journée commencée — complétez la pause et le départ pour obtenir le total.";
        statut.className = "small-hint";
    } else {
        statut.textContent = "Aucun pointage aujourd'hui.";
        statut.className = "small-hint";
    }

    /* ── Catégories ── */
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

    if (!taches.length) {
        racine.innerHTML = `<p class="small-hint" style="text-align:center;padding:18px 0;">Rien de noté aujourd'hui. Ajoutez votre première tâche ci-dessus.</p>`;
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
            <span class="chip" style="background:${couleur}22;border-color:${couleur}55;color:${couleur};">${escapeHtml(t.cat || "Général")}</span>
            <button class="btn-danger" style="padding:5px 9px;font-size:.72rem;"
                    aria-label="Supprimer : ${escapeHtml(t.text.slice(0, 40))}" title="Supprimer">✕</button>`;
        ligne.querySelector("button").onclick = () => supprimerTache(auj, t.id);
        racine.appendChild(ligne);
    });
}

function enregistrerPointageDuJourDepuisToday(silencieux = false) {
    const auj = ymd(new Date());
    const valeurs = {
        arrivee:    qs("#tArr").value,
        pauseDebut: qs("#tPD").value,
        pauseFin:   qs("#tPF").value,
        depart:     qs("#tDep").value
    };

    const minutes = Object.values(valeurs).map(parseHM);
    const complet = minutes.every(m => !isNaN(m));

    // Tant que la journée est incomplète, on conserve la saisie partielle
    // sans calculer de total : pointer l'arrivée le matin doit fonctionner.
    if (complet) {
        const [A, PD, PF, D] = minutes;
        if (!(A <= PD && PD <= PF && PF <= D)) {
            return toast("Heures incohérentes", "Ordre attendu : arrivée ≤ pause début ≤ pause fin ≤ départ.", "error", 6000);
        }
        valeurs.total = Math.max(0, (PD - A) + (D - PF) - getTolerance());
    } else {
        valeurs.total = 0;
    }

    const p = getPoint();
    p[auj] = valeurs;
    if (!setPoint(p)) return;

    renderToday();
    renderWeek(); renderMonth(); renderWeekKPI();
    if (qs("#pDate").value === auj) chargerPointageDuJour();

    if (!silencieux) {
        toast("Journée enregistrée", complet ? `${hm(valeurs.total)} de temps effectif` : "Saisie partielle conservée.", complet ? "success" : "info");
    }
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

/* Couleur par catégorie (palette fixe + hash) */
function colorForCat(cat) {
    const palette = [
        "#7c4dff","#00e5ff","#00e096","#ffc947",
        "#ff4d6d","#ff6d00","#00b0ff","#69f0ae",
        "#ea80fc","#ff6e40","#40c4ff","#ccff90"
    ];
    let hash = 0;
    for (let i = 0; i < cat.length; i++) hash = (hash * 31 + cat.charCodeAt(i)) >>> 0;
    return palette[hash % palette.length];
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

    days.forEach(day => {
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
                        <span class="chip" style="background:${color}22;border-color:${color}55;color:${color};">${escapeHtml(task.cat || "Général")}</span>
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
   POINTAGE
═══════════════════════════════════════════════════════ */
function initPointage() {
    const today = ymd(new Date());
    qs("#pDate").value    = today;
    qs("#weekRef").value  = today;
    qs("#monthRef").value = today.slice(0, 7);

    qs("#savePointBtn").onclick    = savePoint;
    qs("#pDate").onchange          = chargerPointageDuJour;
    chargerPointageDuJour();

    qs("#prevWeek").onclick        = () => shiftWeek(-7);
    qs("#nextWeek").onclick        = () => shiftWeek(+7);
    qs("#prevMonth").onclick       = () => shiftMonth(-1);
    qs("#nextMonth").onclick       = () => shiftMonth(+1);
    qs("#exportWeekPdf").onclick   = () => exportPointagePdf("week");
    qs("#exportMonthPdf").onclick  = () => exportPointagePdf("month");

    majTexteCalcul();
    renderWeek();
    renderMonth();
    renderWeekKPI();
}

/* Le texte d'aide du pointage reflète les valeurs réellement paramétrées. */
function majTexteCalcul() {
    const el = qs("#calculHint");
    if (!el) return;
    const c = getContrat();
    el.textContent = `Calcul : (Pause début − Arrivée) + (Départ − Pause fin) − ${c.toleranceMin} min de tolérance · objectif ${hm(c.objectifJourMin)} par jour ouvré`;
}

/* Recharge le formulaire avec le pointage déjà enregistré pour la date choisie.
   Sans cela, changer de date laissait les champs précédents et « Enregistrer »
   écrasait silencieusement la journée. */
function chargerPointageDuJour() {
    const date = qs("#pDate").value;
    const r = getPoint()[date] || {};
    qs("#pArr").value = r.arrivee    || "";
    qs("#pPD").value  = r.pauseDebut || "";
    qs("#pPF").value  = r.pauseFin   || "";
    qs("#pDep").value = r.depart     || "";

    const dejaSaisi = qs("#pointageExistant");
    if (dejaSaisi) {
        dejaSaisi.classList.toggle("hidden", !r.arrivee);
        if (r.arrivee) dejaSaisi.textContent = `Journée déjà enregistrée (${hm(r.total || 0)}) — modifier puis réenregistrer.`;
    }
}

function savePoint() {
    const date = qs("#pDate").value;
    if (!date) return toast("Date manquante", "Choisissez la journée à pointer.", "warn");

    const champs = [
        ["Arrivée",     qs("#pArr").value],
        ["Pause début", qs("#pPD").value],
        ["Pause fin",   qs("#pPF").value],
        ["Départ",      qs("#pDep").value]
    ];
    const invalides = champs.filter(([, v]) => isNaN(parseHM(v))).map(([n]) => n);
    if (invalides.length) {
        return toast("Heures invalides", `À corriger : ${invalides.join(", ")}. Format attendu : HH:MM (entre 00:00 et 23:59).`, "error", 6000);
    }

    const [A, PD, PF, D] = champs.map(([, v]) => parseHM(v));

    // L'ordre doit être cohérent, sinon le total devient négatif et fausse tous les cumuls.
    if (!(A <= PD && PD <= PF && PF <= D)) {
        return toast(
            "Heures incohérentes",
            "L'ordre attendu est : arrivée ≤ pause début ≤ pause fin ≤ départ.",
            "error", 6000
        );
    }

    const total = (PD - A) + (D - PF) - getTolerance();
    const p = getPoint();
    p[date] = {
        arrivee: qs("#pArr").value,
        pauseDebut: qs("#pPD").value,
        pauseFin: qs("#pPF").value,
        depart: qs("#pDep").value,
        total: Math.max(0, total)
    };
    if (!setPoint(p)) return;

    renderWeek();
    renderMonth();
    renderWeekKPI();
    chargerPointageDuJour();
    renderToday();

    if (isWeekendDate(date)) {
        toast("Pointage enregistré", `${hm(total)} h le ${fmtFR(date)} — ⚠️ ce jour est un week-end, il n'apparaît pas dans les tableaux.`, "warn");
    } else if (isHoliday(date)) {
        toast("Pointage enregistré", `${hm(total)} h le ${fmtFR(date)} — 🎌 jour férié (${holidayLabel(date)}), exclu de l'objectif.`, "warn");
    } else {
        toast("Pointage enregistré", `${hm(total)} heures le ${fmtFR(date)}`, "success");
    }
}

function weekDays(ref) {
    const d   = new Date(ref);
    const day = (d.getDay() + 6) % 7;
    const mon = new Date(d);
    mon.setDate(d.getDate() - day);
    return Array.from({ length: 7 }, (_, i) => {
        const tmp = new Date(mon);
        tmp.setDate(mon.getDate() + i);
        return ymd(tmp);
    });
}

/* Jours ouvrés (lun-ven) de la semaine, week-ends exclus */
const workDaysInWeek = ref => weekDays(ref).filter(d => !isWeekendDate(d));

/* KPI semaine */
function renderWeekKPI() {
    const kpiEl = qs("#weekKPI");
    if (!kpiEl) return;

    const ref  = qs("#weekRef").value || ymd(new Date());
    const days = workDaysInWeek(ref);
    const p    = getPoint();

    const workableDays = days.filter(d => !isHoliday(d));
    let sum = 0, worked = 0;
    days.forEach(d => {
        const r = p[d];
        if (r) { sum += (r.total || 0); worked++; }
    });

    const target = workableDays.length * getObjectifJour();
    const pct    = target ? Math.min(100, Math.round((sum / target) * 100)) : 0;
    const avg    = worked ? Math.round(sum / worked) : 0;
    const nbHolidays = days.length - workableDays.length;

    kpiEl.innerHTML = `
        <div class="kpi-box"><div class="kpi-val cyan">${hm(sum)}</div><div class="kpi-label">Total semaine</div></div>
        <div class="kpi-box"><div class="kpi-val">${worked}/${workableDays.length}</div><div class="kpi-label">Jours pointés${nbHolidays ? " (hors fériés)" : ""}</div></div>
        <div class="kpi-box"><div class="kpi-val ${pct >= 100 ? "green" : pct >= 80 ? "accent" : "red"}">${pct}%</div><div class="kpi-label">Objectif semaine</div></div>
        <div class="kpi-box"><div class="kpi-val">${avg > 0 ? hm(avg) : "--:--"}</div><div class="kpi-label">Moy. / jour</div></div>
        ${nbHolidays ? `<div class="kpi-box"><div class="kpi-val amber">${nbHolidays}</div><div class="kpi-label">Jour${nbHolidays > 1 ? "s" : ""} férié${nbHolidays > 1 ? "s" : ""}</div></div>` : ""}
    `;
}

function renderWeek() {
    const ref   = qs("#weekRef").value;
    const days  = workDaysInWeek(ref);
    const p     = getPoint();
    const table = qs("#weekTable");
    let sum = 0;

    table.innerHTML = `
        <thead><tr>
            <th>Jour</th><th>Arrivée</th><th>Pause</th><th>Départ</th><th>Temps effectif</th>
        </tr></thead><tbody></tbody>
        <tfoot><tr><th colspan="4">Total semaine (jours ouvrés)</th><th id="weekTotal"></th></tr></tfoot>`;

    const tbody = table.querySelector("tbody");

    days.forEach(d => {
        const r    = p[d] || {};
        const min  = r.total || 0;
        const holiday = holidayLabel(d);
        sum += min;

        const tr = document.createElement("tr");
        if (holiday) tr.className = "row-holiday";

        tr.innerHTML = `
            <td style="font-weight:600;">${fmtFR(d)} ${holiday ? `<span class="holiday-badge" title="${escapeHtml(holiday)}">🎌 Férié</span>` : ""}</td>
            <td class="mono">${r.arrivee   || "—"}</td>
            <td class="mono">${r.pauseDebut || "—"} – ${r.pauseFin || "—"}</td>
            <td class="mono">${r.depart    || "—"}</td>
            <td class="time-mono ${min >= 420 ? "total-positive" : min > 0 ? "" : ""}">${min ? hm(min) : "—"}</td>`;
        tbody.appendChild(tr);
    });

    const totalEl = table.querySelector("#weekTotal");
    if (totalEl) {
        totalEl.className = "time-mono " + (sum >= 2100 ? "total-positive" : sum > 0 ? "" : "");
        totalEl.textContent = sum ? hm(sum) : "—";
    }

    renderWeekKPI();
}

function renderMonth() {
    const ref   = qs("#monthRef").value;
    if (!ref) return;
    const [Y, M] = ref.split("-").map(Number);
    const last  = new Date(Y, M, 0).getDate();
    const p     = getPoint();
    const table = qs("#monthTable");
    let sum = 0, workableDays = 0, pointedDays = 0, workableEcoules = 0;
    const aujourdhui = ymd(new Date());

    table.innerHTML = `
        <thead><tr>
            <th>Date</th><th>Arrivée</th><th>Pause</th><th>Départ</th><th>Temps effectif</th>
        </tr></thead><tbody></tbody>
        <tfoot><tr><th colspan="4">Total mois (jours ouvrés)</th><th id="monthTotal"></th></tr></tfoot>`;

    const tbody = table.querySelector("tbody");

    for (let d = 1; d <= last; d++) {
        const key  = `${Y}-${String(M).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (isWeekendDate(key)) continue; // week-ends masqués

        const r    = p[key] || {};
        const min  = r.total || 0;
        const holiday = holidayLabel(key);
        sum += min;
        if (r.total) pointedDays++;
        if (!holiday) {
            workableDays++;
            // Les jours à venir ne doivent pas peser dans l'objectif :
            // sinon le 2 du mois affiche 5 % et l'indicateur ne veut rien dire.
            if (key <= aujourdhui) workableEcoules++;
        }

        const tr = document.createElement("tr");
        if (holiday) tr.className = "row-holiday";

        tr.innerHTML = `
            <td style="font-weight:600;">${fmtFR(key)} ${holiday ? `<span class="holiday-badge" title="${escapeHtml(holiday)}">🎌 Férié</span>` : ""}</td>
            <td class="mono">${r.arrivee    || "—"}</td>
            <td class="mono">${r.pauseDebut || "—"} – ${r.pauseFin || "—"}</td>
            <td class="mono">${r.depart     || "—"}</td>
            <td class="time-mono">${min ? hm(min) : "—"}</td>`;
        tbody.appendChild(tr);
    }

    const totalEl = table.querySelector("#monthTotal");
    if (totalEl) totalEl.textContent = sum ? hm(sum) : "—";

    const monthKpiEl = qs("#monthKPI");
    if (monthKpiEl) {
        const moisEnCours = ref === aujourdhui.slice(0, 7);
        const base   = moisEnCours ? workableEcoules : workableDays;
        const target = base * getObjectifJour();
        const pct    = target ? Math.min(100, Math.round((sum / target) * 100)) : 0;
        const restant = (workableDays - base);

        monthKpiEl.innerHTML = `
            <div class="kpi-box"><div class="kpi-val cyan">${hm(sum)}</div><div class="kpi-label">Total mois</div></div>
            <div class="kpi-box"><div class="kpi-val">${pointedDays}/${base}</div><div class="kpi-label">Jours pointés${moisEnCours ? " à ce jour" : " (hors fériés)"}</div></div>
            <div class="kpi-box"><div class="kpi-val ${pct >= 100 ? "green" : pct >= 80 ? "accent" : "red"}">${pct}%</div><div class="kpi-label">Objectif${moisEnCours ? " à ce jour" : " mois"}</div></div>
            ${moisEnCours && restant > 0 ? `<div class="kpi-box"><div class="kpi-val">${restant}</div><div class="kpi-label">Jours ouvrés restants</div></div>` : ""}
        `;
    }
}

function shiftWeek(n) {
    const d = new Date(qs("#weekRef").value);
    d.setDate(d.getDate() + n);
    qs("#weekRef").value = ymd(d);
    renderWeek();
}

function shiftMonth(n) {
    const [y, m] = qs("#monthRef").value.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    qs("#monthRef").value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    renderMonth();
}

/* Export PDF pointage */
function exportPointagePdf(mode) {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) return toast("jsPDF manquant", "", "error");

    const pdf   = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageH = pdf.internal.pageSize.getHeight();
    let y = 22;

    const title = mode === "week" ? "Pointage — Semaine" : "Pointage — Mois";
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text(title, 10, y); y += 10;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);

    const p    = getPoint();
    const rows = mode === "week"
        ? workDaysInWeek(qs("#weekRef").value).map(d => [d, p[d] || {}])
        : (() => {
            const ref = qs("#monthRef").value;
            const [Y, M] = ref.split("-").map(Number);
            const last = new Date(Y, M, 0).getDate();
            return Array.from({ length: last }, (_, i) => {
                const key = `${Y}-${String(M).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                return [key, p[key] || {}];
            }).filter(([key]) => !isWeekendDate(key));
        })();

    let sum = 0;
    pdf.setFont("helvetica", "bold");
    pdf.text("Date                    Arrivée  Pause          Départ  Total", 10, y); y += 7;
    pdf.setFont("helvetica", "normal");

    rows.forEach(([d, r]) => {
        if (y > pageH - 15) { pdf.addPage(); y = 20; }
        const min = r.total || 0;
        const holiday = holidayLabel(d);
        sum += min;
        if (holiday) pdf.setTextColor(190, 140, 0); else pdf.setTextColor(0, 0, 0);
        pdf.text(
            `${(fmtFR(d) + (holiday ? "  [Férié]" : "")).padEnd(32)} ${(r.arrivee || "--:--").padEnd(9)} ${(r.pauseDebut || "--:--")} – ${(r.pauseFin || "--:--").padEnd(6)} ${(r.depart || "--:--").padEnd(8)} ${hm(min)}`,
            10, y
        );
        y += 6;
    });
    pdf.setTextColor(0, 0, 0);

    y += 4;
    pdf.setFont("helvetica", "bold");
    pdf.text(`Total (jours ouvrés) : ${hm(sum)}`, 10, y);

    pdf.save(`pointage_${mode}.pdf`);
    toast("Export PDF réussi", `pointage_${mode}.pdf`, "success");
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
    const d   = new Date(refDate);
    const day = (d.getDay() + 6) % 7;
    const mon = new Date(d);
    mon.setDate(d.getDate() - day);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return [ymd(mon), ymd(sun)];
}

function getMonthRange(refDate) {
    const d = new Date(refDate);
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
    const [ar, ag, ab] = hexToRgb("#7c4dff");
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
        pdf.setTextColor(124, 77, 255);
        pdf.text("Missions / Contexte", margin, y); y += 6;
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
        pdf.splitTextToSize(missions, pageW - margin * 2).forEach(line => { checkPage(6); pdf.text(line, margin, y); y += 5.5; });
        y += 4;
    }

    /* ── Synthèse KPI ── */
    // Heures réellement pointées sur la période : un rapport d'alternance est
    // attendu avec le temps de présence, pas seulement le détail des tâches.
    const point = getPoint();
    let minutesPointees = 0, joursPointes = 0;
    Object.keys(point).filter(d => d >= start && d <= end).forEach(d => {
        const m = point[d].total || 0;
        if (m > 0) { minutesPointees += m; joursPointes++; }
    });

    checkPage(28);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
    pdf.setTextColor(124, 77, 255);
    pdf.text("Synthèse", margin, y); y += 7;
    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
    pdf.text(`Activités détaillées : ${hm(totalMin)}   ·   Tâches : ${tasks.length}   ·   Jours actifs : ${dates.length}`, margin, y);
    y += 5.5;
    if (joursPointes) {
        pdf.text(`Temps de présence pointé : ${hm(minutesPointees)} sur ${joursPointes} journée(s)`, margin, y);
        y += 5.5;
    }
    y += 4;

    /* ── Répartition par catégorie ── */
    checkPage(12 + Object.keys(byCat).length * 6);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
    pdf.setTextColor(124, 77, 255);
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
    pdf.setTextColor(124, 77, 255);
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
        pdf.setTextColor(124, 77, 255);
        pdf.text("Compétences acquises / Bilan", margin, y); y += 7;
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
        pdf.splitTextToSize(bilan, pageW - margin * 2).forEach(line => { checkPage(6); pdf.text(line, margin, y); y += 5.5; });
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
    toast("Rapport généré ✅", `rapport_alternance_${start}_${end}.pdf`, "success");
}

/* ═══════════════════════════════════════════════════════
   RÉGLAGES
═══════════════════════════════════════════════════════ */
function initAdmin() {
    const wh = getWorkHours();
    qs("#admWorkStart").value = wh.start;
    qs("#admWorkEnd").value   = wh.end;

    renderAdmCats();

    qs("#saveWorkHoursBtn").onclick = () => {
        const s = qs("#admWorkStart").value;
        const e = qs("#admWorkEnd").value;
        if (!s || !e || parseHM(s) >= parseHM(e)) {
            return toast("Horaires invalides", "L'heure de fin doit suivre l'heure de début.", "warn");
        }
        setWorkHours(s, e);
        toast("Horaires mis à jour", `${s} – ${e}`, "success");
    };

    qs("#resetWorkHoursBtn").onclick = () => {
        try { localStorage.removeItem(LS_WORKHOURS); } catch { /* ignoré */ }
        const def = getWorkHours();
        qs("#admWorkStart").value = def.start;
        qs("#admWorkEnd").value   = def.end;
        toast("Réinitialisé", "08:00 – 18:00", "info");
    };

    /* ── Contrat : objectif quotidien et tolérance ── */
    const appliquerContratDansFormulaire = () => {
        const c = getContrat();
        qs("#admObjectif").value  = hm(c.objectifJourMin);
        qs("#admTolerance").value = c.toleranceMin;
        majTexteCalcul();
    };
    appliquerContratDansFormulaire();

    qs("#saveContratBtn").onclick = () => {
        const objectif  = parseHM(qs("#admObjectif").value);
        const tolerance = parseInt(qs("#admTolerance").value, 10);
        if (isNaN(objectif) || objectif <= 0) return toast("Objectif invalide", "Indiquez une durée, par exemple 07:48.", "warn");
        if (isNaN(tolerance) || tolerance < 0 || tolerance > 120) return toast("Tolérance invalide", "Entre 0 et 120 minutes.", "warn");
        if (tolerance >= objectif) return toast("Valeurs incohérentes", "La tolérance doit rester inférieure à l'objectif.", "warn");

        setContrat({ objectifJourMin: objectif, toleranceMin: tolerance });
        majTexteCalcul();
        renderWeek(); renderMonth(); renderWeekKPI();
        toast("Contrat enregistré", `${hm(objectif)} par jour · ${tolerance} min de tolérance`, "success");
    };

    qs("#resetContratBtn").onclick = () => {
        try { localStorage.removeItem(LS_CONTRAT); } catch { /* ignoré */ }
        appliquerContratDansFormulaire();
        renderWeek(); renderMonth(); renderWeekKPI();
        toast("Contrat réinitialisé", "7h48 par jour · 20 min de tolérance", "info");
    };

    qs("#exportBackupBtn").onclick = exportBackupFile;
    qs("#importBackupBtn").onclick = importBackupFile;
    qs("#exportJournalCsvBtn").onclick  = exportJournalCsv;
    qs("#exportPointageCsvBtn").onclick = exportPointageCsv;
    majEtatSauvegarde();
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
                <span class="chip" style="background:${color}22;border-color:${color}55;color:${color};">${escapeHtml(cat)}</span>
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
        const s = String(v ?? "");
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
function buildBackupObject() {
    return {
        cats: getCats(), journal: getJournal(),
        pointage: getPoint(), sort: getSortOrder(), workHours: getWorkHours(), date: new Date().toISOString()
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
    if (!estDico(obj.journal) || !estDico(obj.pointage)) {
        return { valide: false, raison: "Les sections « journal » et « pointage » sont absentes ou illisibles." };
    }

    const estDate = k => /^\d{4}-\d{2}-\d{2}$/.test(k);
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

    const pointage = {};
    Object.keys(obj.pointage).forEach(jour => {
        const p = obj.pointage[jour];
        if (!estDate(jour) || !estDico(p)) { ignores++; return; }
        pointage[jour] = {
            arrivee:    typeof p.arrivee    === "string" ? p.arrivee    : "",
            pauseDebut: typeof p.pauseDebut === "string" ? p.pauseDebut : "",
            pauseFin:   typeof p.pauseFin   === "string" ? p.pauseFin   : "",
            depart:     typeof p.depart     === "string" ? p.depart     : "",
            total:      Number.isFinite(p.total) ? p.total : 0
        };
    });

    const cats = Array.isArray(obj.cats)
        ? [...new Set(["Général", ...obj.cats.filter(c => typeof c === "string" && c.trim())])]
        : null;

    return {
        valide: true, ignores, taches,
        jours: Object.keys(journal).length,
        pointages: Object.keys(pointage).length,
        propre: {
            journal, pointage, cats,
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
    const ok = setJournal(d.journal) && setPoint(d.pointage);
    setSortOrder(d.sort);
    if (d.workHours) setWorkHours(d.workHours.start, d.workHours.end);

    initJournal();
    initPointage();
    initAdmin();

    if (!ok) return toast("Restauration incomplète", "Le navigateur a refusé d'enregistrer toutes les données.", "error", 9000);

    const quand = d.date && !isNaN(new Date(d.date)) ? ` du ${new Date(d.date).toLocaleDateString("fr-FR")}` : "";
    toast(
        "Restauration complète ✅",
        `Sauvegarde${quand} — ${bilan.taches} tâche(s), ${bilan.pointages} pointage(s)` +
        (bilan.ignores ? ` · ${bilan.ignores} entrée(s) illisible(s) ignorée(s)` : ""),
        "success"
    );
}

console.log("✅ Journal de Bord — chargé");

/* ── PWA : enregistrement du service worker ───────────── */
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        console.log("✅ Nouvelle version du service worker active.");
    });
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js")
            .then(() => console.log("✅ Service worker enregistré"))
            .catch(err => console.warn("Service worker non enregistré :", err));
    });
}
