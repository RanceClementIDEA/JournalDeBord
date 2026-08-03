/* =========================================================
   JOURNAL DE BORD — PLANNING (Gantt)

   Rendu en DOM + CSS Grid, pas en canvas : le tap, la netteté sur
   écran haute densité et le changement de thème sont alors gratuits.

   Aucune arithmétique de pixels ni de pourcentages : une barre occupe
   des COLONNES de grille. C'est ce qui supprime par construction le
   décalage d'un jour et la dérive d'arrondi, plaies des Gantt maison.

   Les colonnes sont fractionnaires (1fr) : la piste fait donc toujours
   exactement la largeur disponible. Le débordement horizontal est
   impossible — quand ça ne tient pas, c'est l'échelle qui s'élargit.
========================================================= */

/* "j" jour · "s" semaine · "m" mois — null = choix automatique */
let echelleGantt = null;

/* ── Construction de l'axe des temps ─────────────────── */
function construirePeriodes(d0, d1, echelle) {
    const periodes = [];
    let c = parseYMD(d0);

    if (echelle === "j") {
        const fin = parseYMD(d1);
        while (c <= fin) {
            const s = ymd(c);
            periodes.push({ d0: s, d1: s, label: String(c.getDate()), mois: c.getMonth() });
            c.setDate(c.getDate() + 1);
        }
    } else if (echelle === "s") {
        c.setDate(c.getDate() - ((c.getDay() + 6) % 7));       // recale au lundi
        const fin = parseYMD(d1);
        while (c <= fin) {
            const debut = new Date(c);
            const finSem = new Date(c); finSem.setDate(finSem.getDate() + 6);
            periodes.push({ d0: ymd(debut), d1: ymd(finSem), label: "S" + numeroSemaine(debut), mois: debut.getMonth() });
            c.setDate(c.getDate() + 7);
        }
    } else {
        c = new Date(c.getFullYear(), c.getMonth(), 1);
        const fin = parseYMD(d1);
        while (c <= fin) {
            const debut = new Date(c);
            const finMois = new Date(c.getFullYear(), c.getMonth() + 1, 0);
            periodes.push({
                d0: ymd(debut), d1: ymd(finMois),
                label: debut.toLocaleDateString("fr-FR", { month: "short" }), mois: debut.getMonth()
            });
            c.setMonth(c.getMonth() + 1);
        }
    }
    return periodes;
}

function numeroSemaine(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const jan1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil((((t - jan1) / 86400000) + 1) / 7);
}

/* LA fonction de projection. Bornée : un élément hors fenêtre est
   rabattu sur le bord, jamais ignoré — sinon sa barre disparaîtrait. */
function colonnePourDate(dateStr, periodes) {
    if (!dateStr || !periodes.length) return -1;
    if (dateStr < periodes[0].d0) return 0;
    if (dateStr > periodes[periodes.length - 1].d1) return periodes.length - 1;
    const i = periodes.findIndex(p => dateStr >= p.d0 && dateStr <= p.d1);
    return i < 0 ? 0 : i;
}

/* Échelle automatique : la plus fine qui reste lisible. */
function choisirEchelle(d0, d1, largeur) {
    const minPx = largeur < 500 ? 8 : 12;
    for (const e of ["j", "s", "m"]) {
        const n = construirePeriodes(d0, d1, e).length;
        if (e === "j" && n > 180) continue;          // au-delà, illisible même au large
        if (n && largeur / n >= minPx) return e;
    }
    return "m";
}

/* ── Rendu ───────────────────────────────────────────── */
function renderGantt(stats, journal) {
    const racine = qs("#ganttRoot");
    if (!racine) return;
    racine.innerHTML = "";

    const actifs = stats.filter(s => s.premiere || (s.debut && s.fin));
    if (!actifs.length) {
        racine.innerHTML = `<p class="small-hint" style="text-align:center;padding:24px 0;">
            Rien à planifier pour l'instant. Notez une activité ou donnez des dates à un projet.</p>`;
        qs("#ganttInfo").textContent = "";
        return;
    }

    /* Fenêtre ancrée sur les DONNÉES, jamais sur le calendrier seul :
       sinon un historique ancien produirait un planning vide. */
    const auj = ymd(new Date());
    const bornes = [];
    actifs.forEach(s => {
        if (s.premiere) bornes.push(s.premiere, s.derniere);
        if (s.debut) bornes.push(s.debut);
        if (s.fin) bornes.push(s.fin);
        (getSujet(s.nom)?.jalons || []).forEach(j => { if (j.e) bornes.push(j.e); if (j.f) bornes.push(j.f); });
    });
    bornes.push(auj);
    const d0 = bornes.reduce((a, b) => (a < b ? a : b));
    const d1 = bornes.reduce((a, b) => (a > b ? a : b));

    const largeurPiste = Math.max(200, (racine.clientWidth || 320) - (window.innerWidth > 780 ? 140 : 0));
    const echelle = echelleGantt || choisirEchelle(d0, d1, largeurPiste);
    const periodes = construirePeriodes(d0, d1, echelle);

    qs("#ganttInfo").textContent =
        `${fmtCourt(d0)} → ${fmtCourt(d1)} · ${periodes.length} ${echelle === "j" ? "jours" : echelle === "s" ? "semaines" : "mois"}`;
    qsa("#ganttWrap .seg-mini .seg-btn").forEach(b => {
        const n = construirePeriodes(d0, d1, b.dataset.echelle).length;
        const lisible = n && largeurPiste / n >= (largeurPiste < 500 ? 8 : 12) && !(b.dataset.echelle === "j" && n > 180);
        b.disabled = !lisible;
        b.classList.toggle("actif", b.dataset.echelle === echelle);
    });

    const grille = document.createElement("div");
    grille.className = "gantt";
    grille.style.setProperty("--n", periodes.length);

    /* En-tête : libellés de périodes, allégés quand ils sont serrés */
    const pas = Math.max(1, Math.ceil(periodes.length / (largeurPiste / 34)));
    const entete = document.createElement("div");
    entete.className = "g-ligne g-entete";
    entete.innerHTML = `<div class="g-nom"></div><div class="g-piste">${
        periodes.map((p, i) => `<span class="g-lab" style="grid-column:${i + 1}">${i % pas === 0 ? escapeHtml(p.label) : ""}</span>`).join("")
    }</div>`;
    grille.appendChild(entete);

    const colAuj = colonnePourDate(auj, periodes);

    actifs.forEach(st => {
        const sujet = getSujet(st.nom) || sujetVierge(st.nom);
        const ligne = document.createElement("div");
        ligne.className = "g-ligne";
        ligne.dataset.sujet = st.nom;

        const fond = periodes.map((p, i) => {
            const cl = [];
            if (i === colAuj) cl.push("today");
            if (echelle === "j" && isWeekendDate(p.d0)) cl.push("we");
            if (echelle === "j" && holidayLabel(p.d0)) cl.push("ferie");
            if (i > 0 && p.mois !== periodes[i - 1].mois) cl.push("sep");
            return `<i class="${cl.join(" ")}" style="grid-column:${i + 1}"></i>`;
        }).join("");

        let barres = "";
        // Barre PRÉVUE : seulement si les deux dates sont saisies
        if (sujet.debut && sujet.fin) {
            const a = colonnePourDate(sujet.debut, periodes), b = colonnePourDate(sujet.fin, periodes);
            barres += `<div class="g-plan${st.enRetard ? " depasse" : ""}" style="grid-column:${a + 1} / ${b + 2}"></div>`;
        }
        // Barre RÉELLE : dérivée du journal, présente sans aucune saisie
        if (st.premiere) {
            const a = colonnePourDate(st.premiere, periodes), b = colonnePourDate(st.derniere, periodes);
            barres += `<div class="g-reel" style="grid-column:${a + 1} / ${b + 2};${stylePuceCat(st.nom)}"></div>`;
        }
        // Étapes : losange plein si faite, creux sinon, rouge si en retard
        (sujet.jalons || []).forEach(j => {
            const d = j.f || j.e;
            if (!d) return;
            const c = colonnePourDate(d, periodes);
            const cls = j.f ? "fait" : (j.e && j.e < auj ? "retard" : "");
            barres += `<span class="g-jalon ${cls}" style="grid-column:${c + 1}" title="${escapeHtml(j.t)}"></span>`;
        });

        ligne.innerHTML = `
            <div class="g-nom"><span class="chip" style="${stylePuceCat(st.nom)}">${escapeHtml(st.nom)}</span></div>
            <div class="g-piste">
                <div class="g-fond">${fond}</div>
                ${barres}
            </div>`;

        ligne.onclick = () => { vueProjets = "liste"; projetDeplie = st.nom; renderProjets(); };
        grille.appendChild(ligne);
    });

    racine.appendChild(grille);
}
