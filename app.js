/* =========================================================
   JOURNAL DE BORD — PRO
   app.js — Version améliorée complète
========================================================= */

/* ── Sélecteurs rapides ──────────────────────────────── */
const qs  = sel => document.querySelector(sel);
const qsa = sel => [...document.querySelectorAll(sel)];

/* ── Toast system ────────────────────────────────────── */
function toast(title, msg = "", type = "info", duration = 3800) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const icons = { success: "✅", error: "❌", info: "ℹ️", warn: "⚠️" };
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `
        <div class="toast-icon">${icons[type] || "ℹ️"}</div>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            ${msg ? `<div class="toast-msg">${msg}</div>` : ""}
        </div>`;
    container.appendChild(el);

    const dismiss = () => {
        el.classList.add("out");
        el.addEventListener("animationend", () => el.remove(), { once: true });
    };
    setTimeout(dismiss, duration);
    el.addEventListener("click", dismiss);
}

/* ── Date & Heure ────────────────────────────────────── */
function parseHM(h) {
    if (!h) return NaN;
    const clean = h.trim().replace(/[hH]/, ":");
    if (!/^[0-2]?\d:[0-5]\d$/.test(clean)) return NaN;
    const [H, M] = clean.split(":").map(Number);
    return H * 60 + M;
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

const HOLIDAY_NAMES = {};
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
const DEFAULT_CREDS = { username: "CRANCE", password: "4455" };
const DEFAULT_CATS  = ["Général", "Production", "Qualité", "Méthodes", "Réunion", "Documentation", "Test"];

const LS = { CREDS: "jb_creds", CATS: "jb_cats", JOURNAL: "jb_journal", POINT: "jb_pointage", SORT: "jb_sort" };

const getCreds    = () => JSON.parse(localStorage.getItem(LS.CREDS))   || DEFAULT_CREDS;
const setCreds    = (u, p) => localStorage.setItem(LS.CREDS, JSON.stringify({ username: u, password: p }));
const getCats     = () => JSON.parse(localStorage.getItem(LS.CATS))    || DEFAULT_CATS;
const setCats     = arr => localStorage.setItem(LS.CATS, JSON.stringify(arr));
const getJournal  = () => JSON.parse(localStorage.getItem(LS.JOURNAL)) || {};
const setJournal  = obj => localStorage.setItem(LS.JOURNAL, JSON.stringify(obj));
const getPoint    = () => JSON.parse(localStorage.getItem(LS.POINT))   || {};
const setPoint    = obj => localStorage.setItem(LS.POINT, JSON.stringify(obj));
const getSortOrder = () => localStorage.getItem(LS.SORT) || "desc";
const setSortOrder = v  => localStorage.setItem(LS.SORT, v);

/* ── Session ─────────────────────────────────────────── */
const isLogged     = () => sessionStorage.getItem("logged") === "1";
const requireLogin = () => { if (!isLogged()) { toast("Connexion requise", "Veuillez vous connecter.", "warn"); return false; } return true; };

/* ── Navigation ──────────────────────────────────────── */
function show(view) {
    qsa("section").forEach(s => s.classList.add("hidden"));
    const v = qs("#view-" + view);
    if (v) v.classList.remove("hidden");
    qsa(".tab").forEach(t => t.classList.remove("active"));
    const tab = qs("#tab-" + view);
    if (tab) tab.classList.add("active");
}

function initials(name) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")).toUpperCase();
}

function updateUserTab() {
    const loginTab = qs("#tab-login");
    const userMenu = qs("#userMenu");
    const creds = getCreds();
    if (isLogged()) {
        loginTab.classList.add("hidden");
        userMenu.classList.remove("hidden");
        qs("#userAvatar").textContent = initials(creds.username) || "👤";
        qs("#userName").textContent = creds.username;
    } else {
        loginTab.classList.remove("hidden");
        loginTab.textContent = "🔐 Connexion";
        userMenu.classList.add("hidden");
    }
}

/* ── Header — horloge & progression ─────────────────── */
const LS_WORKHOURS = "jb_workhours";
const getWorkHours = () => JSON.parse(localStorage.getItem(LS_WORKHOURS)) || { start: "08:00", end: "18:00" };
const setWorkHours = (start, end) => localStorage.setItem(LS_WORKHOURS, JSON.stringify({ start, end }));

/* ── Rémunération (taux horaire) ──────────────────────── */
const LS_RATE = "jb_rate";
const getRate = () => JSON.parse(localStorage.getItem(LS_RATE)) || { amount: 0, currency: "€" };
const setRate = (amount, currency) => localStorage.setItem(LS_RATE, JSON.stringify({ amount: +amount || 0, currency: currency || "€" }));
const fmtMoney = (min, rate) => {
    const value = (min / 60) * (rate?.amount || 0);
    return value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + (rate?.currency || "€");
};

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
    updateUserTab();
    initTheme();
    setupLogoFallback();

    qs("#togglePassBtn").onclick = () => {
        const inp = qs("#loginPass");
        inp.type = inp.type === "password" ? "text" : "password";
    };

    qs("#fabAddTask").onclick = () => {
        show("journal");
        qs("#taskText").focus();
        window.scrollTo({ top: qs("#taskText").getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" });
    };

    qs("#liveBannerStop").onclick = () => stopTracker(false);

    qs("#tab-login").onclick    = () => show("login");
    qs("#tab-journal").onclick  = () => { if (requireLogin()) show("journal"); };
    qs("#tab-pointage").onclick = () => { if (requireLogin()) show("pointage"); };
    qs("#tab-gantt").onclick    = () => { if (requireLogin()) { show("gantt"); initGantt(); } };
    qs("#tab-dashboard").onclick = () => { if (requireLogin()) { show("dashboard"); initDashboard(); } };
    qs("#tab-admin").onclick    = () => { if (requireLogin()) { show("admin"); initAdmin(); } };

    qs("#loginBtn").onclick = doLogin;
    ["loginUser", "loginPass"].forEach(id => {
        qs("#" + id).addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
    });

    qs("#logoutBtn").onclick = () => {
        sessionStorage.removeItem("logged");
        updateUserTab();
        show("login");
        qs("#fabAddTask").classList.add("hidden");
        toast("Au revoir", "Session terminée.", "info");
    };

    // Reprise de session après rechargement de page (le chrono continue)
    if (isLogged()) {
        initJournal();
        initPointage();
        qs("#fabAddTask").classList.remove("hidden");
        show("journal");
    }
});

/* ── Login ───────────────────────────────────────────── */
function doLogin() {
    const user  = qs("#loginUser").value.trim();
    const pass  = qs("#loginPass").value.trim();
    const creds = getCreds();

    if (user === creds.username && pass === creds.password) {
        sessionStorage.setItem("logged", "1");
        updateUserTab();
        show("journal");
        initJournal();
        initPointage();
        qs("#fabAddTask").classList.remove("hidden");
        toast("Bienvenue " + user + " 👋", "Journal de bord chargé.", "success");
    } else {
        toast("Identifiants incorrects", "Vérifiez votre nom et mot de passe.", "error");
        qs("#loginPass").value = "";
        qs("#loginPass").focus();
    }
}

/* ═══════════════════════════════════════════════════════
   SUIVI EN DIRECT (chronomètre tâche en cours)
═══════════════════════════════════════════════════════ */
const LS_TRACKER = "jb_tracker";
const getTrackerState = () => { try { return JSON.parse(sessionStorage.getItem(LS_TRACKER)); } catch { return null; } };
const setTrackerState = obj => obj ? sessionStorage.setItem(LS_TRACKER, JSON.stringify(obj)) : sessionStorage.removeItem(LS_TRACKER);

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
        id: Date.now(),
        timeRange,
        text: t.text,
        cat: t.cat,
        priority: "Moyenne",
        status: "Terminé",
        notes: t.sessions.length > 1 ? `Suivi en direct — ${t.sessions.length} session(s) (pauses incluses).` : ""
    });
    setJournal(journal);
    setTrackerState(null);
    renderTrackerIdle();
    renderJournal();
    renderJournalStats();

    toast(auto ? "Tâche arrêtée automatiquement" : "Tâche terminée ✅", `${t.text} — ${hm(totalMin)}`, "success");
}

function initTracker() {
    refreshTrackerCatSelect();

    qs("#trackerStartBtn").onclick = startTracker;
    qs("#trackerTaskText").addEventListener("keydown", e => { if (e.key === "Enter") startTracker(); });
    qs("#trackerPauseBtn").onclick = pauseResumeTracker;
    qs("#trackerStopBtn").onclick  = () => stopTracker(false);

    const existing = getTrackerState();
    if (existing) renderTrackerActive(existing); else renderTrackerIdle();
}

/* ═══════════════════════════════════════════════════════
   JOURNAL
═══════════════════════════════════════════════════════ */
function initJournal() {
    const dateInput = qs("#taskDate");
    if (dateInput && !dateInput.value) dateInput.value = ymd(new Date());

    const savedSort = getSortOrder();
    const sortSel   = qs("#sortOrder");
    if (sortSel) sortSel.value = savedSort;

    refreshCatSelect();
    refreshFilterCatSelect();
    initTracker();
    renderJournal();
    renderJournalStats();

    qs("#addTaskBtn").onclick = addTask;
    qs("#taskText").addEventListener("keydown", e => { if (e.key === "Enter") addTask(); });

    qs("#searchText").oninput  = renderJournal;
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

    qs("#exportJournalPdfBtn").onclick   = exportJournalPdf;
    qs("#exportJournalExcelBtn").onclick = exportJournalExcel;
}

function addTask() {
    const date = qs("#taskDate").value;
    const time = qs("#taskTime").value.trim();
    const text = qs("#taskText").value.trim();
    const cat  = qs("#taskCat").value || "Général";
    const priority = qs("#taskPriority")?.value || "Moyenne";
    const status   = qs("#taskStatus")?.value || "À faire";
    const notes    = qs("#taskNotes")?.value.trim() || "";

    if (!text) return toast("Description manquante", "Saisissez une description.", "warn");
    if (!date) return toast("Date manquante", "Sélectionnez une date.", "warn");

    const journal = getJournal();
    journal[date] = journal[date] || [];
    journal[date].push({ id: Date.now(), timeRange: time, text, cat, priority, status, notes });
    setJournal(journal);

    qs("#taskTime").value = "";
    qs("#taskText").value = "";
    if (qs("#taskNotes")) qs("#taskNotes").value = "";
    qs("#taskText").focus();

    renderJournal();
    renderJournalStats();
    toast("Tâche ajoutée", `${cat} — ${text.slice(0, 40)}`, "success");
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

    let totalMin = 0;
    allTasks.forEach(t => {
        const [a, b] = (t.timeRange || "").replace(/[–—]/g, "-").split("-");
        const s = parseHM(a?.trim()), e = parseHM(b?.trim());
        if (!isNaN(s) && !isNaN(e)) totalMin += (e - s);
    });

    const catCount = new Set(allTasks.map(t => t.cat)).size;

    statsEl.innerHTML = `
        <div class="kpi-box"><div class="kpi-val accent">${Object.keys(journal).length}</div><div class="kpi-label">Jours actifs</div></div>
        <div class="kpi-box"><div class="kpi-val">${allTasks.length}</div><div class="kpi-label">Tâches totales</div></div>
        <div class="kpi-box"><div class="kpi-val cyan">${todayTasks.length}</div><div class="kpi-label">Tâches aujourd'hui</div></div>
        <div class="kpi-box"><div class="kpi-val green">${hm(totalMin)}</div><div class="kpi-label">Temps total saisi</div></div>
        <div class="kpi-box"><div class="kpi-val">${catCount}</div><div class="kpi-label">Catégories utilisées</div></div>
    `;
}

/* État d'édition en cours */
let editingTask = null; // { day, id }

/* Affichage journal */
function renderJournal() {
    const root    = qs("#journalRoot");
    const journal = getFilteredJournal();
    const order   = getSortOrder();

    const days = Object.keys(journal).sort((a, b) =>
        order === "asc" ? a.localeCompare(b) : b.localeCompare(a)
    );

    if (!days.length) {
        root.innerHTML = `<p class="small-hint" style="text-align:center;padding:24px 0;">Aucune tâche ne correspond.</p>`;
        return;
    }

    root.innerHTML = "";

    days.forEach(day => {
        const tasks   = journal[day];
        const block   = document.createElement("div");
        block.className = "day-block";

        // Temps total du jour
        let dayMin = 0;
        tasks.forEach(t => {
            const [a, b] = (t.timeRange || "").replace(/[–—]/g, "-").split("-");
            const s = parseHM(a?.trim()), e = parseHM(b?.trim());
            if (!isNaN(s) && !isNaN(e)) dayMin += (e - s);
        });

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
                        <div class="row" style="margin:0 0 8px;">
                            <select class="grow edit-priority" style="flex:.5 1 130px;">
                                ${["Haute","Moyenne","Basse"].map(p => `<option value="${p}" ${p === (task.priority || "Moyenne") ? "selected" : ""}>${p === "Haute" ? "🔴" : p === "Basse" ? "🟢" : "⚪"} ${p}</option>`).join("")}
                            </select>
                            <select class="grow edit-status" style="flex:.6 1 140px;">
                                ${["À faire","En cours","Terminé"].map(s => `<option value="${s}" ${s === (task.status || "À faire") ? "selected" : ""}>${s === "Terminé" ? "✅" : s === "En cours" ? "🔄" : "📍"} ${s}</option>`).join("")}
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
                        t.priority  = row.querySelector(".edit-priority").value;
                        t.status    = row.querySelector(".edit-status").value;
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
            const priority = task.priority || "Moyenne";
            const status   = task.status || "À faire";
            const hasNotes = !!(task.notes && task.notes.trim());

            row.innerHTML = `
                <div class="task-left" style="flex-direction:column; align-items:flex-start; gap:6px;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        <span class="chip" style="background:${color}22;border-color:${color}55;color:${color};">${escapeHtml(task.cat || "Général")}</span>
                        ${task.timeRange ? `<span class="task-time">${escapeHtml(task.timeRange)}</span>` : ""}
                        <span class="priority-badge" data-priority="${priority}">${priority === "Haute" ? "🔴" : priority === "Basse" ? "🟢" : "⚪"} ${priority}</span>
                        <span class="status-badge" data-status="${status}">${status === "Terminé" ? "✅" : status === "En cours" ? "🔄" : "📍"} ${status}</span>
                    </div>
                    <span class="task-text">${escapeHtml(task.text)}</span>
                    ${hasNotes ? `<button type="button" class="task-note-toggle">📝 Voir la note</button><div class="task-note-body hidden"></div>` : ""}
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn-ghost edit-btn" data-id="${task.id}" data-day="${day}" style="padding:6px 10px;font-size:.75rem;">✏️</button>
                    <button class="btn-danger del-btn" data-id="${task.id}" data-day="${day}" style="padding:6px 10px;font-size:.75rem;">✕</button>
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
                const j  = getJournal();
                const id = +this.dataset.id;
                const d  = this.dataset.day;
                j[d] = j[d].filter(t => t.id !== id);
                if (!j[d].length) delete j[d];
                setJournal(j);
                renderJournal();
                renderJournalStats();
                toast("Tâche supprimée", "", "warn");
            };

            block.appendChild(row);
        });

        root.appendChild(block);
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
            const text  = `  • [${t.timeRange || "--:--"}] (${t.cat}) ${t.status || "À faire"} — ${t.text}`;
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

/* Export Excel journal */
function exportJournalExcel() {
    const journal = getJournal();
    const dates   = Object.keys(journal).sort();
    if (!dates.length) return toast("Rien à exporter", "", "warn");

    const rows = [["Date", "Heure", "Catégorie", "Priorité", "Statut", "Description", "Note"]];
    dates.forEach(d => {
        journal[d].forEach(t => {
            rows.push([d, t.timeRange || "", t.cat, t.priority || "Moyenne", t.status || "À faire", t.text, t.notes || ""]);
        });
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 14 }, { wch: 13 }, { wch: 16 }, { wch: 10 }, { wch: 11 }, { wch: 45 }, { wch: 35 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Journal");
    XLSX.writeFile(wb, "journal_de_bord.xlsx");
    toast("Export Excel réussi", "journal_de_bord.xlsx téléchargé.", "success");
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
    qs("#prevWeek").onclick        = () => shiftWeek(-7);
    qs("#nextWeek").onclick        = () => shiftWeek(+7);
    qs("#prevMonth").onclick       = () => shiftMonth(-1);
    qs("#nextMonth").onclick       = () => shiftMonth(+1);
    qs("#exportWeekPdf").onclick   = () => exportPointagePdf("week");
    qs("#exportMonthPdf").onclick  = () => exportPointagePdf("month");
    qs("#exportWeekExcel").onclick   = () => exportPointageExcel("week");
    qs("#exportMonthExcel").onclick  = () => exportPointageExcel("month");

    renderWeek();
    renderMonth();
    renderWeekKPI();
}

function savePoint() {
    const date = qs("#pDate").value;
    const A  = parseHM(qs("#pArr").value);
    const PD = parseHM(qs("#pPD").value);
    const PF = parseHM(qs("#pPF").value);
    const D  = parseHM(qs("#pDep").value);

    if ([A, PD, PF, D].some(isNaN)) {
        return toast("Heures invalides", "Format attendu : HH:MM", "error");
    }

    const total = (PD - A) + (D - PF) - 20;
    const p = getPoint();
    p[date] = {
        arrivee: qs("#pArr").value,
        pauseDebut: qs("#pPD").value,
        pauseFin: qs("#pPF").value,
        depart: qs("#pDep").value,
        total
    };
    setPoint(p);
    renderWeek();
    renderMonth();
    renderWeekKPI();

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

    const target = workableDays.length * (7 * 60 + 48 - 20); // ~7h28 / jour ouvré non férié
    const pct    = target ? Math.min(100, Math.round((sum / target) * 100)) : 0;
    const avg    = worked ? Math.round(sum / worked) : 0;
    const nbHolidays = days.length - workableDays.length;
    const rate = getRate();

    kpiEl.innerHTML = `
        <div class="kpi-box"><div class="kpi-val cyan">${hm(sum)}</div><div class="kpi-label">Total semaine</div></div>
        <div class="kpi-box"><div class="kpi-val">${worked}/${workableDays.length}</div><div class="kpi-label">Jours pointés${nbHolidays ? " (hors fériés)" : ""}</div></div>
        <div class="kpi-box"><div class="kpi-val ${pct >= 100 ? "green" : pct >= 80 ? "accent" : "red"}">${pct}%</div><div class="kpi-label">Objectif semaine</div></div>
        <div class="kpi-box"><div class="kpi-val">${avg > 0 ? hm(avg) : "--:--"}</div><div class="kpi-label">Moy. / jour</div></div>
        ${nbHolidays ? `<div class="kpi-box"><div class="kpi-val amber">${nbHolidays}</div><div class="kpi-label">Jour${nbHolidays > 1 ? "s" : ""} férié${nbHolidays > 1 ? "s" : ""}</div></div>` : ""}
        ${rate.amount > 0 ? `<div class="kpi-box"><div class="kpi-val green">💶 ${fmtMoney(sum, rate)}</div><div class="kpi-label">Rémunération semaine</div></div>` : ""}
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
    let sum = 0, workableDays = 0, pointedDays = 0;

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
        if (!holiday) workableDays++;

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
        const target = workableDays * (7 * 60 + 48 - 20);
        const pct = target ? Math.min(100, Math.round((sum / target) * 100)) : 0;
        const rate = getRate();
        monthKpiEl.innerHTML = `
            <div class="kpi-box"><div class="kpi-val cyan">${hm(sum)}</div><div class="kpi-label">Total mois</div></div>
            <div class="kpi-box"><div class="kpi-val">${pointedDays}/${workableDays}</div><div class="kpi-label">Jours pointés (hors fériés)</div></div>
            <div class="kpi-box"><div class="kpi-val ${pct >= 100 ? "green" : pct >= 80 ? "accent" : "red"}">${pct}%</div><div class="kpi-label">Objectif mois</div></div>
            ${rate.amount > 0 ? `<div class="kpi-box"><div class="kpi-val green">💶 ${fmtMoney(sum, rate)}</div><div class="kpi-label">Rémunération mois</div></div>` : ""}
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

    const rate = getRate();
    if (rate.amount > 0) {
        y += 7;
        pdf.setTextColor(0, 150, 90);
        pdf.text(`Rémunération estimée : ${fmtMoney(sum, rate)}  (taux : ${rate.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${rate.currency}/h)`, 10, y);
        pdf.setTextColor(0, 0, 0);
    }

    pdf.save(`pointage_${mode}.pdf`);
    toast("Export PDF réussi", `pointage_${mode}.pdf`, "success");
}

/* Export Excel pointage */
function exportPointageExcel(mode) {
    const p    = getPoint();
    const rate = getRate();
    const header = ["Date", "Jour férié", "Arrivée", "Pause Début", "Pause Fin", "Départ", "Total (min)", "Total (HH:MM)"];
    if (rate.amount > 0) header.push(`Rémunération (${rate.currency})`);
    const rows = [header];

    const entries = mode === "week"
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

    let sumMin = 0;
    entries.forEach(([d, r]) => {
        if (r.arrivee) {
            sumMin += r.total || 0;
            const row = [d, holidayLabel(d) || "", r.arrivee, r.pauseDebut, r.pauseFin, r.depart, r.total || 0, hm(r.total || 0)];
            if (rate.amount > 0) row.push(+(((r.total || 0) / 60) * rate.amount).toFixed(2));
            rows.push(row);
        }
    });

    if (rate.amount > 0) {
        const emptyRow = header.map(() => "");
        rows.push(emptyRow);
        const totalRow = header.map(() => "");
        totalRow[5] = "Total"; totalRow[6] = sumMin; totalRow[7] = hm(sumMin);
        totalRow[8] = +((sumMin / 60) * rate.amount).toFixed(2);
        rows.push(totalRow);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 13 }, { wch: 10 }, { wch: 10 }, { wch: 13 }, { wch: 14 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pointage");
    XLSX.writeFile(wb, `pointage_${mode}.xlsx`);
    toast("Export Excel réussi", `pointage_${mode}.xlsx`, "success");
}

/* ═══════════════════════════════════════════════════════
   GANTT
═══════════════════════════════════════════════════════ */
const ganttState = { tasks: [], days: [], bars: [] };

function rangeDays(start, end) {
    const out = [];
    const d   = new Date(start);
    while (ymd(d) <= end) { out.push(ymd(d)); d.setDate(d.getDate() + 1); }
    return out;
}

function tasksInRange(journal, start, end) {
    const out = [];
    Object.keys(journal).filter(d => d >= start && d <= end).sort().forEach(date => {
        journal[date].forEach(t => {
            if (!t.timeRange) return;
            const [a, b] = t.timeRange.replace(/[–—]/g, "-").split("-");
            const s = parseHM(a?.trim()), e = parseHM(b?.trim());
            if (isNaN(s) || isNaN(e)) return;
            out.push({ date, cat: t.cat || "Général", text: t.text || "", startMin: s, endMin: e });
        });
    });
    return out;
}

function renderGantt() {
    const canvas = qs("#ganttCanvas");
    const ctx    = canvas.getContext("2d");
    const start  = qs("#gStart").value;
    const end    = qs("#gEnd").value;

    if (!start || !end || end < start) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ganttState.tasks = []; ganttState.days = []; ganttState.bars = [];
        return;
    }

    const journal = getJournal();
    const tasks   = tasksInRange(journal, start, end);
    const days    = rangeDays(start, end);

    ganttState.tasks = tasks;
    ganttState.days  = days;
    ganttState.bars  = [];

    const rowH    = 36;
    const headerH = 70;
    const leftW   = 200;
    const rightPad = 20;
    const minHour  = 7;
    const maxHour  = 19;
    const spanMin  = (maxHour - minHour) * 60;

    const container = canvas.parentElement;
    canvas.width  = Math.max(900, container.clientWidth - 20);
    canvas.height = headerH + days.length * rowH + 24;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* ── Background ── */
    ctx.fillStyle = "rgba(7,6,26,.0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    /* ── Title ── */
    ctx.fillStyle = "#f0eeff";
    ctx.font = "bold 16px Inter, Arial";
    ctx.fillText("Diagramme de Gantt", 14, 28);

    ctx.font = "12px JetBrains Mono, monospace";
    ctx.fillStyle = "#8a82b4";
    ctx.fillText(`${start}  →  ${end}  ·  ${days.length} jour${days.length > 1 ? "s" : ""}  ·  ${tasks.length} tâche${tasks.length > 1 ? "s" : ""}`, 14, 48);

    const chartX = leftW;
    const chartW = canvas.width - leftW - rightPad;
    const chartY = headerH;

    /* ── Colonnes d'heures ── */
    ctx.font = "11px JetBrains Mono, monospace";
    for (let h = minHour; h <= maxHour; h++) {
        const x = chartX + ((h * 60 - minHour * 60) / spanMin) * chartW;
        ctx.strokeStyle = "rgba(255,255,255,.07)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, chartY - 10); ctx.lineTo(x, chartY + days.length * rowH); ctx.stroke();
        ctx.fillStyle = "#554f7a";
        ctx.fillText(String(h).padStart(2, "0") + "h", x - 10, chartY - 14);
    }

    /* ── Lignes de jours ── */
    days.forEach((d, i) => {
        const y   = chartY + i * rowH;
        const isWE = isWeekendDate(d);
        const holiday = holidayLabel(d);

        ctx.fillStyle = holiday
            ? "rgba(255,201,71,.06)"
            : isWE
                ? "rgba(255,255,255,.015)"
                : (i % 2 ? "rgba(255,255,255,.025)" : "rgba(255,255,255,.04)");
        ctx.fillRect(0, y, canvas.width, rowH);

        ctx.fillStyle = holiday ? "#ffc947" : isWE ? "#554f7a" : "#c4bcf0";
        ctx.font = "12px Inter, Arial";
        ctx.fillText(
            new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) + (holiday ? " 🎌" : ""),
            10, y + 22
        );
    });

    /* ── Barres de tâches ── */
    tasks.forEach(t => {
        const i = days.indexOf(t.date);
        if (i < 0) return;

        const y  = chartY + i * rowH + 6;
        const x1 = chartX + ((t.startMin - minHour * 60) / spanMin) * chartW;
        const x2 = chartX + ((t.endMin   - minHour * 60) / spanMin) * chartW;
        const w  = Math.max(12, x2 - x1);
        const color = colorForCat(t.cat);

        /* Ombre de la barre */
        ctx.shadowColor = color + "66";
        ctx.shadowBlur  = 8;

        /* Barre */
        ctx.fillStyle = color + "cc";
        const bh = rowH - 12;
        roundRect(ctx, x1, y, w, bh, 5);
        ctx.fill();

        ctx.shadowBlur = 0;

        /* Texte */
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px Inter, Arial";
        ctx.save();
        ctx.beginPath();
        ctx.rect(x1 + 2, y, w - 4, bh);
        ctx.clip();
        ctx.fillText(t.text, x1 + 7, y + 15, w - 10);
        ctx.restore();

        ganttState.bars.push({ x: x1, y, w, h: bh, task: t });
    });

    renderGanttCategoryChart(tasks);
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function renderGanttCategoryChart(tasks) {
    const canvas = qs("#ganttCatCanvas");
    const legend = qs("#ganttCatLegend");
    if (!canvas || !legend) return;

    const ctx = canvas.getContext("2d");
    canvas.width = 340; canvas.height = 260;
    ctx.clearRect(0, 0, 340, 260);
    legend.innerHTML = "";

    const byCat  = {};
    tasks.forEach(t => { byCat[t.cat] = (byCat[t.cat] || 0) + (t.endMin - t.startMin); });

    const cats  = Object.keys(byCat);
    const total = cats.reduce((s, c) => s + byCat[c], 0);
    if (!total) return;

    const cx = 130, cy = 130, R = 100, r = 48;
    let angle = -Math.PI / 2;

    cats.forEach(cat => {
        const slice = (byCat[cat] / total) * Math.PI * 2;
        const color = colorForCat(cat);

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, angle, angle + slice);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.shadowColor = color + "44";
        ctx.shadowBlur  = 6;
        ctx.fill();
        ctx.shadowBlur  = 0;

        angle += slice;
    });

    /* Trou donut */
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    /* Texte central */
    ctx.fillStyle = "#f0eeff";
    ctx.font = "bold 17px JetBrains Mono, monospace";
    const totalHM = hm(total);
    ctx.fillText(totalHM, cx - ctx.measureText(totalHM).width / 2, cy + 6);
    ctx.font = "11px Inter, Arial";
    ctx.fillStyle = "#8a82b4";
    ctx.fillText("total", cx - ctx.measureText("total").width / 2, cy + 22);

    /* Légende */
    const titleDiv = document.createElement("div");
    titleDiv.style.cssText = "font-weight:700; font-size:.82rem; margin-bottom:8px; color:#f0eeff;";
    titleDiv.textContent = `Répartition — ${hm(total)}`;
    legend.appendChild(titleDiv);

    cats.sort((a, b) => byCat[b] - byCat[a]).forEach(cat => {
        const pct  = Math.round((byCat[cat] / total) * 100);
        const item = document.createElement("div");
        item.className = "legend-item";
        item.innerHTML = `
            <span class="legend-swatch" style="background:${colorForCat(cat)};"></span>
            <span style="flex:1;">${escapeHtml(cat)}</span>
            <span style="font-family:'JetBrains Mono',monospace; font-size:.75rem; color:#8a82b4;">${hm(byCat[cat])} · ${pct}%</span>
        `;
        legend.appendChild(item);
    });
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

function applyGanttPreset() {
    const preset = qs("#gPreset").value;
    const ref    = qs("#gStart").value || ymd(new Date());
    if (preset === "week")  { const [s, e] = getWeekRange(ref);  qs("#gStart").value = s; qs("#gEnd").value = e; }
    if (preset === "month") { const [s, e] = getMonthRange(ref); qs("#gStart").value = s; qs("#gEnd").value = e; }
    renderGantt();
}

function shiftGantt(delta) {
    const preset = qs("#gPreset").value;
    const ref    = qs("#gStart").value || ymd(new Date());
    const d      = new Date(ref);

    if (preset === "week")  { d.setDate(d.getDate() + delta * 7); const [s, e] = getWeekRange(ymd(d)); qs("#gStart").value = s; qs("#gEnd").value = e; }
    else if (preset === "month") { d.setMonth(d.getMonth() + delta); const [s, e] = getMonthRange(ymd(d)); qs("#gStart").value = s; qs("#gEnd").value = e; }
    else { const s = new Date(qs("#gStart").value), e = new Date(qs("#gEnd").value); s.setDate(s.getDate() + delta); e.setDate(e.getDate() + delta); qs("#gStart").value = ymd(s); qs("#gEnd").value = ymd(e); }

    renderGantt();
}

function initGanttHover() {
    const canvas = qs("#ganttCanvas");
    const tip    = qs("#ganttTooltip");
    if (!canvas || !tip) return;

    canvas.onmousemove = e => {
        const rect  = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top)  * scaleY;

        const hit = ganttState.bars.find(b => cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h);
        if (!hit) return (tip.style.display = "none");

        const t = hit.task;
        tip.innerHTML = `
            <div style="font-weight:700;margin-bottom:4px;color:${colorForCat(t.cat)};">${escapeHtml(t.cat)}</div>
            <div style="font-weight:600;margin-bottom:3px;">${escapeHtml(t.text)}</div>
            <div style="color:#8a82b4;font-size:.78rem;">${fmtFR(t.date)}</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:.78rem;color:#00e5ff;margin-top:2px;">${hm(t.startMin)} → ${hm(t.endMin)} · ${hm(t.endMin - t.startMin)}</div>
        `;
        tip.style.left    = (e.clientX - canvas.getBoundingClientRect().left + 12) + "px";
        tip.style.top     = (e.clientY - canvas.getBoundingClientRect().top  + 12) + "px";
        tip.style.display = "block";
    };
    canvas.onmouseleave = () => (tip.style.display = "none");
}

function initGantt() {
    const today     = ymd(new Date());
    const [ws, we]  = getWeekRange(today);

    qs("#gPreset").value = "week";
    qs("#gStart").value  = ws;
    qs("#gEnd").value    = we;

    qs("#gPreset").onchange = applyGanttPreset;
    qs("#gStart").onchange  = () => { qs("#gPreset").value = "custom"; renderGantt(); };
    qs("#gEnd").onchange    = () => { qs("#gPreset").value = "custom"; renderGantt(); };

    qs("#gPrevWeek").onclick  = () => shiftGantt(-1);
    qs("#gNextWeek").onclick  = () => shiftGantt(+1);
    qs("#gPrevMonth").onclick = () => { qs("#gPreset").value = "month"; applyGanttPreset(); shiftGantt(-1); };
    qs("#gNextMonth").onclick = () => { qs("#gPreset").value = "month"; applyGanttPreset(); shiftGantt(+1); };

    qs("#exportGanttPdf").onclick   = exportGanttPdf;
    qs("#exportGanttPng").onclick   = exportGanttPng;
    qs("#exportGanttExcel").onclick = exportGanttExcel;

    renderGantt();
    initGanttHover();
}

function saveBlob(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

function exportGanttPdf() {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) return toast("jsPDF manquant", "", "error");

    const canvas = qs("#ganttCanvas");
    const pdf    = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW  = pdf.internal.pageSize.getWidth();
    const margin = 10;
    const imgW   = pageW - margin * 2;
    const imgH   = (canvas.height * imgW) / canvas.width;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("Diagramme de Gantt", margin, 12);
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, 18, imgW, Math.min(imgH, pdf.internal.pageSize.getHeight() - 28));
    pdf.save("gantt.pdf");
    toast("Export PDF", "gantt.pdf téléchargé.", "success");
}

function exportGanttPng() {
    qs("#ganttCanvas").toBlob(blob => { if (blob) saveBlob(blob, "gantt.png"); });
    toast("Export PNG", "gantt.png téléchargé.", "success");
}

function exportGanttExcel() {
    const start = qs("#gStart").value, end = qs("#gEnd").value;
    const data  = tasksInRange(getJournal(), start, end);
    if (!data.length) return toast("Rien à exporter", "Aucune tâche dans cette période.", "warn");

    const rows = [["Date", "Catégorie", "Activité", "Début", "Fin", "Durée"]];
    data.forEach(t => rows.push([t.date, t.cat, t.text, hm(t.startMin), hm(t.endMin), hm(t.endMin - t.startMin)]));

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 13 }, { wch: 14 }, { wch: 45 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gantt");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `gantt_${start}_${end}.xlsx`);
    toast("Export Excel", `gantt_${start}_${end}.xlsx`, "success");
}

/* ═══════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════ */
function dashRange() {
    const preset = qs("#dPreset").value;
    const today  = ymd(new Date());
    if (preset === "week")  return getWeekRange(today);
    if (preset === "month") return getMonthRange(today);
    if (preset === "all") {
        const days = Object.keys(getJournal()).sort();
        return days.length ? [days[0], days[days.length - 1]] : [today, today];
    }
    return [qs("#dStart").value || today, qs("#dEnd").value || today];
}

function initDashboard() {
    const today = ymd(new Date());
    qs("#dPreset").value = "week";
    const [s, e] = getWeekRange(today);
    qs("#dStart").value = s;
    qs("#dEnd").value   = e;

    qs("#dPreset").onchange = () => {
        const preset = qs("#dPreset").value;
        if (preset === "week")  { const [s, e] = getWeekRange(today); qs("#dStart").value = s; qs("#dEnd").value = e; }
        if (preset === "month") { const [s, e] = getMonthRange(today); qs("#dStart").value = s; qs("#dEnd").value = e; }
        if (preset === "all")   { const [s, e] = dashRange(); qs("#dStart").value = s; qs("#dEnd").value = e; }
        renderDashboard();
    };
    qs("#dStart").onchange = () => { qs("#dPreset").value = "custom"; renderDashboard(); };
    qs("#dEnd").onchange   = () => { qs("#dPreset").value = "custom"; renderDashboard(); };

    renderDashboard();
}

function renderDashboard() {
    const [start, end] = dashRange();
    const tasks = tasksInRange(getJournal(), start, end);

    let totalMin = 0;
    const byDay = {};
    tasks.forEach(t => {
        const min = t.endMin - t.startMin;
        totalMin += min;
        byDay[t.date] = (byDay[t.date] || 0) + min;
    });
    const daysActive = Object.keys(byDay).length;
    const avgPerDay  = daysActive ? Math.round(totalMin / daysActive) : 0;

    qs("#dashboardKPI").innerHTML = `
        <div class="kpi-box"><div class="kpi-val accent">${hm(totalMin)}</div><div class="kpi-label">Temps total</div></div>
        <div class="kpi-box"><div class="kpi-val">${tasks.length}</div><div class="kpi-label">Tâches</div></div>
        <div class="kpi-box"><div class="kpi-val cyan">${daysActive}</div><div class="kpi-label">Jours actifs</div></div>
        <div class="kpi-box"><div class="kpi-val green">${hm(avgPerDay)}</div><div class="kpi-label">Moy. / jour actif</div></div>
    `;

    renderDashCatChart(tasks);
    renderDashBarChart(start, end, byDay);
    renderDashCompare();
}

function renderDashCatChart(tasks) {
    const canvas = qs("#dashCatCanvas");
    const legend = qs("#dashCatLegend");
    if (!canvas || !legend) return;
    const ctx = canvas.getContext("2d");
    canvas.width = 340; canvas.height = 260;
    ctx.clearRect(0, 0, 340, 260);
    legend.innerHTML = "";

    const byCat = {};
    tasks.forEach(t => { byCat[t.cat] = (byCat[t.cat] || 0) + (t.endMin - t.startMin); });
    const cats  = Object.keys(byCat);
    const total = cats.reduce((s, c) => s + byCat[c], 0);

    if (!total) {
        legend.innerHTML = `<p class="small-hint">Aucune donnée sur cette période.</p>`;
        return;
    }

    const cx = 130, cy = 130, R = 100, r = 48;
    let angle = -Math.PI / 2;
    cats.forEach(cat => {
        const slice = (byCat[cat] / total) * Math.PI * 2;
        const color = colorForCat(cat);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, angle, angle + slice);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.shadowColor = color + "44";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
        angle += slice;
    });

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    ctx.fillStyle = "#f0eeff";
    ctx.font = "bold 17px JetBrains Mono, monospace";
    const totalHM = hm(total);
    ctx.fillText(totalHM, cx - ctx.measureText(totalHM).width / 2, cy + 6);
    ctx.font = "11px Inter, Arial";
    ctx.fillStyle = "#8a82b4";
    ctx.fillText("total", cx - ctx.measureText("total").width / 2, cy + 22);

    cats.sort((a, b) => byCat[b] - byCat[a]).forEach(cat => {
        const pct  = Math.round((byCat[cat] / total) * 100);
        const item = document.createElement("div");
        item.className = "legend-item";
        item.innerHTML = `
            <span class="legend-swatch" style="background:${colorForCat(cat)};"></span>
            <span style="flex:1;">${escapeHtml(cat)}</span>
            <span style="font-family:'JetBrains Mono',monospace; font-size:.75rem; color:#8a82b4;">${hm(byCat[cat])} · ${pct}%</span>
        `;
        legend.appendChild(item);
    });
}

function renderDashBarChart(start, end, byDay) {
    const canvas = qs("#dashBarCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const container = canvas.parentElement;
    canvas.width  = Math.max(360, container.clientWidth - 24);
    canvas.height = 260;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const days = rangeDays(start, end);
    if (!days.length) return;

    const padL = 46, padB = 26, padT = 16, padR = 10;
    const chartW = canvas.width - padL - padR;
    const chartH = canvas.height - padT - padB;
    const maxMin = Math.max(60, ...days.map(d => byDay[d] || 0));
    const barW   = Math.max(6, chartW / days.length - 6);

    // axes
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + chartH);
    ctx.lineTo(padL + chartW, padT + chartH);
    ctx.stroke();

    ctx.font = "10px JetBrains Mono, monospace";
    ctx.fillStyle = "#554f7a";
    [0, .5, 1].forEach(f => {
        const y = padT + chartH - f * chartH;
        ctx.fillText(hm(Math.round(maxMin * f)), 2, y + 3);
    });

    days.forEach((d, i) => {
        const min = byDay[d] || 0;
        const h   = (min / maxMin) * chartH;
        const x   = padL + i * (chartW / days.length) + 3;
        const y   = padT + chartH - h;
        const isWE = isWeekendDate(d);
        const holiday = isHoliday(d);

        ctx.fillStyle = min > 0
            ? (holiday ? "#ffc947" : isWE ? "#9b6dff88" : "#7c4dff")
            : "rgba(255,255,255,.05)";
        roundRect(ctx, x, y, barW, Math.max(2, h), 4);
        ctx.fill();

        if (days.length <= 31) {
            ctx.save();
            ctx.translate(x + barW / 2, padT + chartH + 14);
            ctx.rotate(days.length > 14 ? -Math.PI / 3 : 0);
            ctx.fillStyle = "#8a82b4";
            ctx.font = "9px Inter, Arial";
            ctx.textAlign = days.length > 14 ? "right" : "center";
            ctx.fillText(new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), 0, 0);
            ctx.restore();
        }
    });
    ctx.textAlign = "left";
}

function renderDashCompare() {
    const el = qs("#dashCompareKPI");
    if (!el) return;
    const today = ymd(new Date());
    const [curS, curE]   = getWeekRange(today);
    const prevRef = new Date(curS); prevRef.setDate(prevRef.getDate() - 7);
    const [prevS, prevE] = getWeekRange(ymd(prevRef));

    const sumMin = (s, e) => tasksInRange(getJournal(), s, e).reduce((a, t) => a + (t.endMin - t.startMin), 0);
    const curMin  = sumMin(curS, curE);
    const prevMin = sumMin(prevS, prevE);
    const diff    = curMin - prevMin;
    const diffPct = prevMin ? Math.round((diff / prevMin) * 100) : (curMin ? 100 : 0);

    el.innerHTML = `
        <div class="kpi-box"><div class="kpi-val">${hm(prevMin)}</div><div class="kpi-label">Semaine précédente</div></div>
        <div class="kpi-box"><div class="kpi-val accent">${hm(curMin)}</div><div class="kpi-label">Semaine actuelle</div></div>
        <div class="kpi-box"><div class="kpi-val ${diff >= 0 ? "green" : "red"}">${diff >= 0 ? "+" : ""}${hm(Math.abs(diff))}</div><div class="kpi-label">Écart</div></div>
        <div class="kpi-box"><div class="kpi-val ${diffPct >= 0 ? "green" : "red"}">${diffPct >= 0 ? "+" : ""}${diffPct}%</div><div class="kpi-label">Évolution</div></div>
    `;
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
    const author   = getCreds().username;

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
    checkPage(22);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
    pdf.setTextColor(124, 77, 255);
    pdf.text("Synthèse", margin, y); y += 7;
    pdf.setTextColor(0, 0, 0);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
    pdf.text(`Temps total : ${hm(totalMin)}   ·   Tâches : ${tasks.length}   ·   Jours actifs : ${dates.length}`, margin, y);
    y += 9;

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
            const line  = `${t.timeRange ? "[" + t.timeRange + "] " : ""}(${t.cat}) [${t.status || "À faire"}] ${t.text}`;
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
        pdf.text("Généré depuis Journal de Bord — Pro", margin, pageH - 8);
    }

    pdf.save(`rapport_alternance_${start}_${end}.pdf`);
    toast("Rapport généré ✅", `rapport_alternance_${start}_${end}.pdf`, "success");
}

/* ═══════════════════════════════════════════════════════
   ADMIN
═══════════════════════════════════════════════════════ */
function initAdmin() {
    const creds = getCreds();
    qs("#admUser").value = creds.username;
    qs("#admPass").value = "";

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
        localStorage.removeItem(LS_WORKHOURS);
        const def = getWorkHours();
        qs("#admWorkStart").value = def.start;
        qs("#admWorkEnd").value   = def.end;
        toast("Réinitialisé", "08:00 – 18:00", "info");
    };

    const rate = getRate();
    qs("#admHourlyRate").value = rate.amount || "";
    qs("#admCurrency").value   = rate.currency || "€";

    qs("#saveRateBtn").onclick = () => {
        const amount   = parseFloat(qs("#admHourlyRate").value);
        const currency = qs("#admCurrency").value;
        if (isNaN(amount) || amount < 0) return toast("Taux invalide", "Saisissez un montant valide.", "warn");
        setRate(amount, currency);
        if (qs("#weekRef").value) renderWeekKPI();
        if (qs("#monthRef").value) renderMonth();
        toast("Taux horaire enregistré", `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${currency} / h`, "success");
    };

    qs("#resetRateBtn").onclick = () => {
        localStorage.removeItem(LS_RATE);
        qs("#admHourlyRate").value = "";
        qs("#admCurrency").value   = "€";
        if (qs("#weekRef").value) renderWeekKPI();
        if (qs("#monthRef").value) renderMonth();
        toast("Rémunération désactivée", "", "info");
    };

    qs("#saveCredsBtn").onclick = () => {
        const u = qs("#admUser").value.trim();
        const p = qs("#admPass").value.trim();
        if (!u || !p) return toast("Champs requis", "Nom et mot de passe obligatoires.", "warn");
        setCreds(u, p);
        updateUserTab();
        toast("Identifiants mis à jour", `Nom : ${u}`, "success");
    };

    qs("#resetCredsBtn").onclick = () => {
        localStorage.removeItem(LS.CREDS);
        const def = getCreds();
        qs("#admUser").value = def.username;
        qs("#admPass").value = "";
        updateUserTab();
        toast("Réinitialisés", "Identifiants par défaut restaurés.", "info");
    };

    qs("#chooseBackupFileBtn").onclick  = chooseBackupFile;
    qs("#exportBackupBtn").onclick      = manualBackup;
    qs("#importBackupBtn").onclick      = importBackupFile;
    qs("#restoreFromBackupBtn").onclick = restoreFromConfiguredBackup;
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
                const newCats = getCats().filter(c => c !== cat);
                setCats(newCats);
                const j = getJournal();
                Object.keys(j).forEach(d => { j[d] = j[d].map(t => t.cat === cat ? { ...t, cat: "Général" } : t); });
                setJournal(j);
                refreshCatSelect();
                refreshFilterCatSelect();
                refreshTrackerCatSelect();
                renderAdmCats();
                renderJournal();
                toast("Catégorie supprimée", `« ${cat} » → Général`, "warn");
            };
            item.appendChild(del);
        }

        zone.appendChild(item);
    });
}

/* ── Backup ──────────────────────────────────────────── */
let backupFileHandle = null;

function buildBackupObject() {
    return {
        creds: getCreds(), cats: getCats(), journal: getJournal(),
        pointage: getPoint(), sort: getSortOrder(), workHours: getWorkHours(), rate: getRate(), date: new Date().toISOString()
    };
}

async function chooseBackupFile() {
    try {
        backupFileHandle = await window.showSaveFilePicker({
            suggestedName: "journal_backup.json",
            types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
        });
        toast("Fichier configuré", "Sauvegarde automatique prête.", "success");
    } catch {
        toast("Annulé", "Aucun fichier sélectionné.", "info");
    }
}

async function manualBackup() {
    if (!backupFileHandle) return toast("Aucun fichier", "Choisissez d'abord un fichier cible.", "warn");
    try {
        const writable = await backupFileHandle.createWritable();
        await writable.write(JSON.stringify(buildBackupObject(), null, 2));
        await writable.close();
        toast("Sauvegarde effectuée ✅", new Date().toLocaleTimeString("fr-FR"), "success");
    } catch (err) {
        toast("Erreur sauvegarde", err.message, "error");
    }
}

function importBackupFile() {
    const inp = qs("#backupFileInput");
    inp.value = "";
    inp.onchange = async () => {
        const file = inp.files[0];
        if (!file) return;
        try {
            const obj = JSON.parse(await file.text());
            applyBackup(obj);
        } catch {
            toast("Fichier invalide", "Impossible de lire la sauvegarde.", "error");
        }
    };
    inp.click();
}

async function restoreFromConfiguredBackup() {
    if (!backupFileHandle) return toast("Aucun fichier", "Configurez d'abord un fichier.", "warn");
    try {
        const obj = JSON.parse(await (await backupFileHandle.getFile()).text());
        applyBackup(obj);
    } catch (err) {
        toast("Erreur restauration", err.message, "error");
    }
}

function applyBackup(obj) {
    if (!obj || !obj.journal || !obj.pointage) return toast("Sauvegarde invalide", "Structure non reconnue.", "error");
    setCreds(obj.creds.username, obj.creds.password);
    setCats(obj.cats);
    setJournal(obj.journal);
    setPoint(obj.pointage);
    setSortOrder(obj.sort || "desc");
    if (obj.workHours) setWorkHours(obj.workHours.start, obj.workHours.end);
    if (obj.rate) setRate(obj.rate.amount, obj.rate.currency);
    initJournal();
    initPointage();
    initAdmin();
    toast("Restauration complète ✅", `Sauvegarde du ${new Date(obj.date).toLocaleDateString("fr-FR")}`, "success");
}

console.log("✅ Journal de Bord Pro — chargé");

/* ── PWA : enregistrement du service worker ───────────── */
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js")
            .then(() => console.log("✅ Service worker enregistré"))
            .catch(err => console.warn("Service worker non enregistré :", err));
    });
}
