/* =========================================================
   JOURNAL DE BORD — PROJETS
   Feuille de route et avancement.

   Principe : un projet ne stocke que ce qui ne peut pas être déduit —
   son début prévu, sa fin prévue, ses étapes. Tout le reste (période
   réelle, temps passé, nombre d'activités, avancement, retard) est
   recalculé depuis le journal à chaque rendu. Rien ne peut donc se
   désynchroniser, et le planning est déjà rempli au premier lancement.
========================================================= */

/* Vue courante de l'onglet : "liste" ou "gantt". */
let vueProjets = "liste";
/* Nom du projet déplié dans la liste, ou null. */
let projetDeplie = null;

/* ── Rendu principal ─────────────────────────────────── */
function renderProjets() {
    const racine = qs("#projetsRoot");
    if (!racine) return;

    const journal = getJournal();
    const stats = getSujets()
        .filter(s => s.actif !== false)
        .map(s => statsSujet(s.nom, journal))
        // Les projets vivants d'abord, puis les plus récemment touchés
        .sort((a, b) => (b.derniere || "").localeCompare(a.derniere || ""));

    renderProjetsKPI(stats);

    qs("#ganttWrap").classList.toggle("hidden", vueProjets !== "gantt");
    racine.classList.toggle("hidden", vueProjets === "gantt");
    qs("#segListe").classList.toggle("actif", vueProjets === "liste");
    qs("#segGantt").classList.toggle("actif", vueProjets === "gantt");
    qs("#segListe").setAttribute("aria-pressed", String(vueProjets === "liste"));
    qs("#segGantt").setAttribute("aria-pressed", String(vueProjets === "gantt"));

    if (vueProjets === "gantt") { renderGantt(stats, journal); return; }

    racine.innerHTML = "";
    if (!stats.length) {
        racine.innerHTML = `<p class="small-hint" style="text-align:center;padding:24px 0;">
            Aucun projet actif. Créez-en un ci-dessous, ou notez une activité : le projet correspondant apparaîtra ici.</p>`;
        return;
    }
    stats.forEach(st => racine.appendChild(carteProjet(st)));
}

function renderProjetsKPI(stats) {
    const el = qs("#projetsKPI");
    if (!el) return;
    const minutes = stats.reduce((s, x) => s + x.minutes, 0);
    const avecJalons = stats.filter(s => s.avancement !== null);
    const moyen = avecJalons.length
        ? Math.round(avecJalons.reduce((s, x) => s + x.avancement, 0) / avecJalons.length) : null;
    const retard = stats.filter(s => s.enRetard).length;

    el.innerHTML = `
        <div class="kpi-box"><div class="kpi-val accent">${stats.length}</div><div class="kpi-label">Projets actifs</div></div>
        <div class="kpi-box"><div class="kpi-val cyan">${hm(minutes)}</div><div class="kpi-label">Temps cumulé</div></div>
        <div class="kpi-box"><div class="kpi-val ${moyen === null ? "" : moyen >= 80 ? "green" : moyen >= 40 ? "accent" : "red"}">${moyen === null ? "—" : moyen + "%"}</div><div class="kpi-label">Avancement moyen</div></div>
        ${retard ? `<div class="kpi-box"><div class="kpi-val red">${retard}</div><div class="kpi-label">En retard</div></div>` : ""}
    `;
}

/* ── Une carte de projet ─────────────────────────────── */
function carteProjet(st) {
    const carte = document.createElement("div");
    carte.className = "projet-carte" + (st.enRetard ? " en-retard" : "");
    carte.dataset.sujet = st.nom;

    const depliee = projetDeplie === st.nom;
    const pct = st.avancement;
    const periode = st.debut && st.fin
        ? `${fmtCourt(st.debut)} → ${fmtCourt(st.fin)}`
        : (st.premiere ? `activité du ${fmtCourt(st.premiere)} au ${fmtCourt(st.derniere)}` : "aucune activité");

    carte.innerHTML = `
        <button class="projet-tete" aria-expanded="${depliee}">
            <span class="chip" style="${stylePuceCat(st.nom)}">${escapeHtml(st.nom)}</span>
            <span class="projet-meta">
                ${st.entrees} activité${st.entrees > 1 ? "s" : ""} · ${hm(st.minutes)}
                ${st.joursDepuis !== null && st.joursDepuis > 0 ? ` · il y a ${st.joursDepuis} j` : ""}
            </span>
            <span class="projet-chevron" aria-hidden="true">${depliee ? "▾" : "▸"}</span>
        </button>
        <div class="projet-avance">
            <div class="barre-avance" role="img" aria-label="Avancement ${pct === null ? "non défini" : pct + " pour cent"}">
                <div class="barre-avance-fill" style="width:${pct === null ? 0 : pct}%"></div>
            </div>
            <span class="projet-pct">${pct === null ? "—" : pct + "%"}</span>
        </div>
        <p class="small-hint projet-periode">${escapeHtml(periode)}${st.enRetard ? " · <strong>échéance dépassée</strong>" : ""}</p>
    `;

    carte.querySelector(".projet-tete").onclick = () => {
        projetDeplie = depliee ? null : st.nom;
        renderProjets();
    };

    if (depliee) carte.appendChild(detailProjet(st));
    return carte;
}

/* ── Le détail déplié : dates prévues et étapes ──────── */
function detailProjet(st) {
    const d = document.createElement("div");
    d.className = "projet-detail";

    d.innerHTML = `
        <div class="row">
            <div class="field"><label>Début prévu</label><input type="date" class="pj-debut" value="${st.debut}" /></div>
            <div class="field"><label>Fin prévue</label><input type="date" class="pj-fin" value="${st.fin}" /></div>
        </div>
        <p class="small-hint" style="margin-top:2px;">Laissez vide pour que le planning n'affiche que la période réellement travaillée.</p>

        <h4 class="projet-sous-titre">Étapes ${st.jalons ? `<span class="small-hint">(${st.faits}/${st.jalons})</span>` : ""}</h4>
        <div class="jalons"></div>

        <div class="row" style="margin-top:8px;">
            <div class="field" style="flex:2 1 200px;"><label>Nouvelle étape</label><input class="pj-nouveau" placeholder="Ce qu'il reste à faire…" /></div>
            <div class="field" style="flex:.7 1 140px;"><label>Échéance (option.)</label><input type="date" class="pj-nouveau-e" /></div>
            <button class="pj-ajouter">➕ Ajouter</button>
        </div>

        <div class="section-actions" style="margin-top:12px;">
            <button class="btn-ghost pj-voir">🔎 Voir les ${st.entrees} activité${st.entrees > 1 ? "s" : ""}</button>
            <button class="btn-ghost pj-archiver">📦 Archiver</button>
        </div>
    `;

    const sujet = getSujet(st.nom) || sujetVierge(st.nom);

    /* Dates prévues — enregistrées à la volée */
    const majDate = (champ, cle) => {
        d.querySelector(champ).onchange = e => {
            const v = e.target.value;
            const autre = cle === "debut" ? (getSujet(st.nom) || {}).fin : (getSujet(st.nom) || {}).debut;
            if (v && autre) {
                const [a, b] = cle === "debut" ? [v, autre] : [autre, v];
                if (a > b) return toast("Dates incohérentes", "La fin prévue doit suivre le début.", "warn");
            }
            if (majSujet(st.nom, { [cle]: v })) renderProjets();
        };
    };
    majDate(".pj-debut", "debut");
    majDate(".pj-fin", "fin");

    /* Étapes */
    const zone = d.querySelector(".jalons");
    (sujet.jalons || []).forEach((j, i) => zone.appendChild(ligneJalon(st.nom, j, i, sujet.jalons.length)));
    if (!sujet.jalons || !sujet.jalons.length) {
        zone.innerHTML = `<p class="small-hint">Aucune étape. Découpez le projet pour suivre son avancement.</p>`;
    }

    const ajouter = () => {
        const t = d.querySelector(".pj-nouveau").value.trim();
        if (!t) return toast("Étape vide", "Décrivez ce qu'il reste à faire.", "warn");
        const jalons = [...((getSujet(st.nom) || {}).jalons || []), { t, e: d.querySelector(".pj-nouveau-e").value || "", f: "" }];
        if (majSujet(st.nom, { jalons })) { renderProjets(); toast("Étape ajoutée", t.slice(0, 50), "success"); }
    };
    d.querySelector(".pj-ajouter").onclick = ajouter;
    d.querySelector(".pj-nouveau").onkeydown = e => { if (e.key === "Enter") ajouter(); };

    d.querySelector(".pj-voir").onclick = () => {
        show("journal");
        qs("#filterCat").value  = st.nom;
        qs("#filterFrom").value = "";
        qs("#filterTo").value   = "";
        rerendreDepuisFiltre();
    };

    d.querySelector(".pj-archiver").onclick = () => {
        if (!confirm(`Archiver « ${st.nom} » ?\n\nIl disparaît des projets actifs et du planning.\nSes ${st.entrees} activité(s) restent intactes dans l'historique.`)) return;
        if (majSujet(st.nom, { actif: false })) {
            projetDeplie = null;
            renderProjets();
            toast("Projet archivé", st.nom, "warn", 8000, {
                label: "Annuler",
                onClick: () => { majSujet(st.nom, { actif: true }); renderProjets(); }
            });
        }
    };

    return d;
}

/* ── Une étape ───────────────────────────────────────── */
function ligneJalon(nomSujet, j, i, total) {
    const el = document.createElement("div");
    const enRetard = !j.f && j.e && j.e < ymd(new Date());
    el.className = "jalon" + (j.f ? " fait" : "") + (enRetard ? " retard" : "");

    el.innerHTML = `
        <button class="jalon-coche" role="checkbox" aria-checked="${!!j.f}"
                aria-label="${j.f ? "Marquer comme non terminée" : "Marquer comme terminée"} : ${escapeHtml(j.t)}">${j.f ? "✔" : ""}</button>
        <span class="jalon-texte">${escapeHtml(j.t)}</span>
        <span class="jalon-date small-hint">${j.f ? "fait le " + fmtCourt(j.f) : j.e ? "pour le " + fmtCourt(j.e) : ""}</span>
        <span class="jalon-actions">
            <button class="btn-ghost jalon-haut" aria-label="Monter" ${i === 0 ? "disabled" : ""}>↑</button>
            <button class="btn-ghost jalon-bas" aria-label="Descendre" ${i === total - 1 ? "disabled" : ""}>↓</button>
            <button class="btn-danger jalon-suppr" aria-label="Supprimer l'étape : ${escapeHtml(j.t)}">✕</button>
        </span>
    `;

    const jalonsDe = () => [...((getSujet(nomSujet) || {}).jalons || [])];
    const ecrire = jalons => { if (majSujet(nomSujet, { jalons })) renderProjets(); };

    el.querySelector(".jalon-coche").onclick = () => {
        const jalons = jalonsDe();
        jalons[i] = { ...jalons[i], f: jalons[i].f ? "" : ymd(new Date()) };
        ecrire(jalons);
        if (jalons[i].f) toast("Étape terminée ✅", j.t.slice(0, 50), "success");
    };
    el.querySelector(".jalon-haut").onclick = () => {
        const jalons = jalonsDe();
        [jalons[i - 1], jalons[i]] = [jalons[i], jalons[i - 1]];
        ecrire(jalons);
    };
    el.querySelector(".jalon-bas").onclick = () => {
        const jalons = jalonsDe();
        [jalons[i + 1], jalons[i]] = [jalons[i], jalons[i + 1]];
        ecrire(jalons);
    };
    el.querySelector(".jalon-suppr").onclick = () => {
        const jalons = jalonsDe();
        const retire = jalons.splice(i, 1)[0];
        ecrire(jalons);
        toast("Étape supprimée", retire.t.slice(0, 50), "warn", 8000, {
            label: "Annuler",
            onClick: () => { const j2 = jalonsDe(); j2.splice(Math.min(i, j2.length), 0, retire); ecrire(j2); }
        });
    };
    return el;
}

/* ── Création d'un projet ────────────────────────────── */
function creerProjet() {
    const nom = (prompt("Nom du nouveau projet :") || "").trim();
    if (!nom) return;
    if (getSujets().some(s => s.nom.toLowerCase() === nom.toLowerCase())) {
        return toast("Ce projet existe déjà", nom, "warn");
    }
    if (setSujets([...getSujets(), sujetVierge(nom)])) {
        projetDeplie = nom;
        refreshCatSelect(); refreshFilterCatSelect(); refreshTrackerCatSelect();
        renderProjets(); renderToday();
        toast("Projet créé", nom, "success");
    }
}

/* Date courte, sans l'année quand elle est évidente. */
function fmtCourt(d) {
    if (!d) return "";
    const dd = parseYMD(d);
    const memeAnnee = dd.getFullYear() === new Date().getFullYear();
    return dd.toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(memeAnnee ? {} : { year: "numeric" }) });
}

function initProjets() {
    qs("#segListe").onclick = () => { vueProjets = "liste"; renderProjets(); };
    qs("#segGantt").onclick = () => { vueProjets = "gantt"; renderProjets(); };
    qs("#ajouterProjetBtn").onclick = creerProjet;
    qsa("#ganttWrap .seg-mini .seg-btn").forEach(b => {
        b.onclick = () => { echelleGantt = b.dataset.echelle; renderProjets(); };
    });
}
