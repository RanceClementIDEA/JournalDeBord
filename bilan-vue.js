/* ═══════════════════════════════════════════════════════════
   BILAN — rendu

   Les graphiques sont en HTML/CSS, pas en SVG. Ce n'est pas un repli :
   les libellés restent du vrai texte — sélectionnable, lu par un lecteur
   d'écran, qui suit la taille de police du système et se réagence à 375 px.
   Un <text> SVG ne fait aucune de ces quatre choses correctement.

   Aucune valeur n'est calculée ici : tout vient de calculerBilan().
═══════════════════════════════════════════════════════════ */

/* Période d'observation, en jours. null = tout l'historique. */
let periodeBilan = 30;
/* Filtre du journal des difficultés : "toutes" | "ouvertes" | "resolues". */
let filtreDiff = "toutes";
/* Au-delà, les colonnes deviennent illisibles ; on le DIT plutôt que de tronquer en silence. */
const MAX_SEMAINES = 26;

/* ── Rendu principal ─────────────────────────────────── */
function renderBilan() {
    const racine = qs("#bilanRoot");
    if (!racine) return;

    const b = calculerBilan(periodeBilan);

    qsa("#bilanPeriode .seg-btn").forEach(btn => {
        const actif = String(btn.dataset.jours || "") === String(periodeBilan || "");
        btn.classList.toggle("actif", actif);
        btn.setAttribute("aria-pressed", String(actif));
    });

    racine.innerHTML = "";
    racine.appendChild(blocKPI(b));
    racine.appendChild(blocAvancement(b));
    if (b.retards.liste.length) racine.appendChild(blocRetards(b));
    racine.appendChild(blocGraphiques(b));
    racine.appendChild(blocDifficultes(b));
}

/* ── Cartouche de KPI ────────────────────────────────── */
function blocKPI(b) {
    const s = document.createElement("div");
    s.className = "bilan-bloc";

    const v = b.volume, a = b.avancement, r = b.retards, d = b.difficultes;
    /* Le taux de retard se lit à l'envers des autres : bas = bon. */
    const tonRetard = r.taux === null ? "" : r.taux === 0 ? "green" : r.taux <= 25 ? "amber" : "red";
    const tonAvance = a.avancementGlobal === null ? ""
        : a.avancementGlobal >= 80 ? "green" : a.avancementGlobal >= 40 ? "accent" : "amber";

    s.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-box">
          <div class="kpi-val accent">${hm(v.minutes)}</div>
          <div class="kpi-label">Temps saisi</div>
          <div class="kpi-sous">${v.joursActifs} jour${v.joursActifs > 1 ? "s" : ""} actif${v.joursActifs > 1 ? "s" : ""} · ${v.taches} tâche${v.taches > 1 ? "s" : ""}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-val neutre">${hm(v.moyenneParJourActif)}</div>
          <div class="kpi-label">Moyenne par jour actif</div>
          <div class="kpi-sous">médiane ${hm(v.medianeParJourActif)}${v.plusLongueJournee ? ` · record ${hm(v.plusLongueJournee.minutes)}` : ""}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-val ${tonAvance}">${a.avancementGlobal === null ? "—" : a.avancementGlobal + " %"}</div>
          <div class="kpi-label">Avancement global</div>
          <div class="kpi-sous">${a.totalFaits}/${a.totalJalons} jalon${a.totalJalons > 1 ? "s" : ""} sur ${a.projetsSuivis} projet${a.projetsSuivis > 1 ? "s" : ""}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-val ${tonRetard}">${r.taux === null ? "—" : r.taux + " %"}</div>
          <div class="kpi-label">Taux de retard</div>
          <div class="kpi-sous">${r.taux === null
              ? "aucune échéance posée"
              : `${r.retardsCourants} en cours · ${r.livresEnRetard} livré${r.livresEnRetard > 1 ? "s" : ""} en retard`}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-val ${r.retardMoyen === 0 ? "green" : r.retardMoyen <= 7 ? "amber" : "red"}">${r.retardMoyen === 0 ? "0" : r.retardMoyen + " j"}</div>
          <div class="kpi-label">Retard moyen</div>
          <div class="kpi-sous">${r.retardMax ? `pire cas ${r.retardMax} j` : "aucun retard"}</div>
        </div>
        <div class="kpi-box">
          <div class="kpi-val ${d.bloquantesOuvertes ? "red" : d.ouvertes ? "amber" : "green"}">${d.ouvertes}</div>
          <div class="kpi-label">Difficultés ouvertes</div>
          <div class="kpi-sous">${d.bloquantesOuvertes
              ? `dont ${d.bloquantesOuvertes} bloquante${d.bloquantesOuvertes > 1 ? "s" : ""}`
              : (d.delaiMoyen !== null ? `résolues en ${d.delaiMoyen} j en moyenne` : "aucune résolue")}</div>
        </div>
      </div>`;
    return s;
}

/* ── Avancement par projet ───────────────────────────── */
function blocAvancement(b) {
    const s = document.createElement("section");
    s.className = "bilan-bloc";
    const projets = b.avancement.projets.filter(p => p.actif !== false);

    if (!projets.length) {
        s.innerHTML = `<h3 class="bilan-titre">Avancement par projet</h3>
          <p class="small-hint">Aucun projet actif.</p>`;
        return s;
    }

    /* Les projets en difficulté remontent : plus en retard d'abord, puis
       les moins avancés. Un tableau de bord qui trie par ordre alphabétique
       oblige à lire toutes les lignes pour trouver le problème. */
    const tri = [...projets].sort((a, c) =>
        (c.jalonsEnRetard - a.jalonsEnRetard)
        || ((a.risque ? a.risque.ecart : 999) - (c.risque ? c.risque.ecart : 999))
        || ((a.avancement === null ? 101 : a.avancement) - (c.avancement === null ? 101 : c.avancement)));

    s.innerHTML = `<h3 class="bilan-titre">Avancement par projet</h3>`;
    const liste = document.createElement("div");
    liste.className = "avance-liste";

    tri.forEach(p => {
        const pct = p.avancement;
        const ligne = document.createElement("div");
        ligne.className = "avance-ligne";

        /* L'écart au prévisionnel n'a de sens qu'avec deux dates ; sinon on
           n'affiche rien plutôt qu'un « 0 » qui passerait pour « à l'heure ». */
        let marqueRisque = "";
        if (p.risque) {
            const e = p.risque.ecart;
            const ton = e >= 0 ? "vert" : e >= -15 ? "ambre" : "rouge";
            marqueRisque = `<span class="avance-ecart ${ton}" title="Avancement attendu à cette date : ${p.risque.attendu} %">
                ${e > 0 ? "+" : ""}${e} pts / prévu</span>`;
        }

        ligne.innerHTML = `
          <div class="avance-tete">
            <span class="chip" style="${stylePuceCat(p.nom)}">${escapeHtml(p.nom)}</span>
            ${marqueRisque}
          </div>
          <div class="avance-mesure">
            <div class="barre-avance" role="img"
                 aria-label="${escapeHtml(p.nom)} : avancement ${pct === null ? "non défini" : pct + " pour cent"}">
              <div class="barre-avance-fill${p.jalonsEnRetard ? " en-retard" : ""}" style="width:${pct === null ? 0 : pct}%"></div>
            </div>
            <span class="avance-pct">${pct === null ? "—" : pct + " %"}</span>
          </div>
          <p class="avance-detail small-hint">
            ${p.jalons ? `${p.faits}/${p.jalons} jalon${p.jalons > 1 ? "s" : ""}` : "aucun jalon"}
            · ${hm(p.minutes)} au total sur ${p.entrees} activité${p.entrees > 1 ? "s" : ""}
            ${p.jalonsEnRetard ? ` · <strong class="txt-rouge">${p.jalonsEnRetard} en retard</strong>` : ""}
            ${p.debut && p.fin ? ` · ${fmtCourt(p.debut)} → ${fmtCourt(p.fin)}` : ""}
          </p>`;
        liste.appendChild(ligne);
    });

    s.appendChild(liste);
    if (b.avancement.projetsSansJalon) {
        const n = document.createElement("p");
        n.className = "small-hint";
        n.textContent = `${b.avancement.projetsSansJalon} projet(s) sans jalon : leur avancement est inconnu, pas nul — ils sont exclus du total global.`;
        s.appendChild(n);
    }
    return s;
}

/* ── Retards ─────────────────────────────────────────── */
function blocRetards(b) {
    const s = document.createElement("section");
    s.className = "bilan-bloc";
    const r = b.retards;

    s.innerHTML = `<h3 class="bilan-titre">Retards <span class="compteur">${r.liste.length}</span></h3>
      <p class="small-hint">Un retard « en cours » court encore ; un retard « livré » est figé.</p>`;

    const tbl = document.createElement("div");
    tbl.className = "retard-liste";
    r.liste.forEach(j => {
        const courant = j.etat === "retardCourant";
        const l = document.createElement("div");
        l.className = "retard-ligne " + (courant ? "courant" : "livre");
        l.innerHTML = `
          <span class="retard-etat">${courant ? "En cours" : "Livré"}</span>
          <span class="retard-titre">${escapeHtml(j.titre)}</span>
          <span class="chip" style="${stylePuceCat(j.projet)}">${escapeHtml(j.projet)}</span>
          <span class="retard-date small-hint">échéance ${fmtCourt(j.echeance)}${j.fait ? ` · fait ${fmtCourt(j.fait)}` : ""}</span>
          <span class="retard-jours">${j.retard} j</span>`;
        tbl.appendChild(l);
    });
    s.appendChild(tbl);
    return s;
}

/* ── Graphiques ──────────────────────────────────────── */
function blocGraphiques(b) {
    const s = document.createElement("section");
    s.className = "bilan-bloc";
    s.innerHTML = `<h3 class="bilan-titre">Graphiques</h3>`;
    s.appendChild(grapheRepartition(b.repartition));
    s.appendChild(grapheHebdo(b.hebdo));
    s.appendChild(graphePonctualite(b.retards));
    return s;
}

/* Barres horizontales : où passe le temps.
   Chaque barre porte la teinte de son projet, la même que dans les pastilles
   et le planning — une couleur veut dire la même chose partout dans l'app. */
function grapheRepartition(rep) {
    const c = document.createElement("figure");
    c.className = "graphe";
    if (!rep.total) {
        c.innerHTML = `<figcaption class="graphe-titre">Répartition du temps</figcaption>
          <p class="small-hint">Aucune activité minutée sur la période.</p>`;
        return c;
    }
    const resume = rep.lignes.slice(0, 3)
        .map(l => `${l.nom} ${Math.round(l.part * 100)} %`).join(", ");

    c.innerHTML = `<figcaption class="graphe-titre">Répartition du temps
        <span class="small-hint">— ${hm(rep.total)} au total</span></figcaption>`;
    const zone = document.createElement("div");
    zone.className = "barres-h";
    zone.setAttribute("role", "img");
    zone.setAttribute("aria-label", `Répartition du temps par projet. ${resume}.`);

    const maxi = rep.lignes[0].minutes;
    rep.lignes.forEach(l => {
        const row = document.createElement("div");
        row.className = "barre-h-ligne";
        row.innerHTML = `
          <span class="barre-h-nom" title="${escapeHtml(l.nom)}">${escapeHtml(l.nom)}</span>
          <span class="barre-h-piste">
            <span class="barre-h-fill" style="${stylePuceCat(l.nom)};width:${(l.minutes / maxi) * 100}%"></span>
          </span>
          <span class="barre-h-val">${hm(l.minutes)}</span>
          <span class="barre-h-pct small-hint">${Math.round(l.part * 100)} %</span>`;
        zone.appendChild(row);
    });
    c.appendChild(zone);
    return c;
}

/* Colonnes hebdomadaires : la régularité, pas seulement le total.
   Les semaines creuses sont dessinées vides et non omises — un trou est
   une information, et une courbe sans trous serait un mensonge par omission. */
function grapheHebdo(serie) {
    const c = document.createElement("figure");
    c.className = "graphe";
    if (!serie.length) {
        c.innerHTML = `<figcaption class="graphe-titre">Activité par semaine</figcaption>
          <p class="small-hint">Aucune activité sur la période.</p>`;
        return c;
    }

    const tronque = serie.length > MAX_SEMAINES;
    const vue = tronque ? serie.slice(-MAX_SEMAINES) : serie;
    const maxi = Math.max(...vue.map(s => s.minutes), 60);
    const actives = vue.filter(s => s.minutes > 0).length;
    const moy = actives ? Math.round(vue.reduce((n, s) => n + s.minutes, 0) / actives) : 0;

    c.innerHTML = `<figcaption class="graphe-titre">Activité par semaine
        <span class="small-hint">— ${actives}/${vue.length} semaines travaillées, ${hm(moy)} en moyenne</span></figcaption>`;

    const zone = document.createElement("div");
    zone.className = "barres-v";
    zone.setAttribute("role", "img");
    zone.setAttribute("aria-label",
        `Activité hebdomadaire sur ${vue.length} semaines. Maximum ${hm(maxi)}, moyenne ${hm(moy)} par semaine travaillée.`);

    vue.forEach(s => {
        const col = document.createElement("div");
        col.className = "barre-v-col" + (s.minutes === 0 ? " creuse" : "");
        col.title = `S${s.numero} — ${hm(s.minutes)}, ${s.taches} tâche(s)`;
        col.innerHTML = `
          <span class="barre-v-piste"><span class="barre-v-fill" style="height:${(s.minutes / maxi) * 100}%"></span></span>
          <span class="barre-v-lab">${s.numero}</span>`;
        zone.appendChild(col);
    });
    c.appendChild(zone);

    const pied = document.createElement("p");
    pied.className = "small-hint";
    pied.textContent = tronque
        ? `Numéros de semaine ISO. ${serie.length - MAX_SEMAINES} semaine(s) plus ancienne(s) non affichée(s) — choisissez « Tout » pour le détail complet.`
        : "Numéros de semaine ISO.";
    c.appendChild(pied);
    return c;
}

/* Barre empilée : la ponctualité d'un coup d'œil.
   Quatre segments, chacun doublé d'une entrée de légende chiffrée — la
   couleur ne porte donc jamais l'information seule. */
function graphePonctualite(r) {
    const c = document.createElement("figure");
    c.className = "graphe";
    const total = r.aLHeure + r.aVenir + r.livresEnRetard + r.retardsCourants;

    if (!total) {
        c.innerHTML = `<figcaption class="graphe-titre">Ponctualité des jalons</figcaption>
          <p class="small-hint">Aucun jalon avec échéance. Posez des dates sur vos étapes pour suivre les retards.</p>`;
        return c;
    }

    const segs = [
        { cle: "alheure", lib: "À l'heure",      n: r.aLHeure },
        { cle: "avenir",  lib: "À venir",        n: r.aVenir },
        { cle: "livre",   lib: "Livré en retard", n: r.livresEnRetard },
        { cle: "courant", lib: "En retard",      n: r.retardsCourants }
    ];

    c.innerHTML = `<figcaption class="graphe-titre">Ponctualité des jalons
        <span class="small-hint">— ${total} jalon${total > 1 ? "s" : ""} daté${total > 1 ? "s" : ""}${r.sansEcheance ? `, ${r.sansEcheance} sans date` : ""}</span></figcaption>`;

    const barre = document.createElement("div");
    barre.className = "empilee";
    barre.setAttribute("role", "img");
    barre.setAttribute("aria-label",
        "Ponctualité des jalons. " + segs.filter(s => s.n).map(s => `${s.lib} : ${s.n}`).join(", ") + ".");
    segs.filter(s => s.n).forEach(s => {
        const el = document.createElement("span");
        el.className = "empilee-seg " + s.cle;
        el.style.width = (s.n / total) * 100 + "%";
        barre.appendChild(el);
    });
    c.appendChild(barre);

    const leg = document.createElement("ul");
    leg.className = "legende";
    segs.forEach(s => {
        const li = document.createElement("li");
        li.className = s.n ? "" : "vide";
        li.innerHTML = `<span class="legende-puce ${s.cle}" aria-hidden="true"></span>${s.lib} <strong>${s.n}</strong>`;
        leg.appendChild(li);
    });
    c.appendChild(leg);
    return c;
}

/* ── Journal des difficultés ─────────────────────────── */
function blocDifficultes(b) {
    const s = document.createElement("section");
    s.className = "bilan-bloc";
    const d = b.difficultes;

    s.innerHTML = `
      <h3 class="bilan-titre">Difficultés rencontrées <span class="compteur">${d.total}</span></h3>
      <p class="small-hint">Ce qu'un journal ne peut pas déduire : pourquoi une tâche a traîné. Cette rubrique alimente le rapport d'alternance.</p>
      <div class="diff-barre">
        <div class="seg seg-mini" role="group" aria-label="Filtrer les difficultés">
          <button class="seg-btn${filtreDiff === "toutes" ? " actif" : ""}"   data-filtre="toutes"   aria-pressed="${filtreDiff === "toutes"}">Toutes</button>
          <button class="seg-btn${filtreDiff === "ouvertes" ? " actif" : ""}" data-filtre="ouvertes" aria-pressed="${filtreDiff === "ouvertes"}">Ouvertes <span class="compteur">${d.ouvertes}</span></button>
          <button class="seg-btn${filtreDiff === "resolues" ? " actif" : ""}" data-filtre="resolues" aria-pressed="${filtreDiff === "resolues"}">Résolues <span class="compteur">${d.resolues}</span></button>
        </div>
        <button id="ajouterDiffBtn" class="btn-ghost">Noter une difficulté</button>
      </div>`;

    s.querySelectorAll("[data-filtre]").forEach(btn => {
        btn.onclick = () => { filtreDiff = btn.dataset.filtre; renderBilan(); };
    });
    s.querySelector("#ajouterDiffBtn").onclick = () => ouvrirDifficulte(null);

    const liste = d.liste.filter(x =>
        filtreDiff === "toutes" || (filtreDiff === "ouvertes" ? !x.resolue : !!x.resolue));

    if (!liste.length) {
        const p = document.createElement("p");
        p.className = "small-hint";
        p.style.padding = "16px 0";
        p.textContent = d.total
            ? "Aucune difficulté dans ce filtre."
            : "Aucune difficulté notée sur la période. Notez-en une dès qu'un point vous bloque : à froid, on ne s'en souvient plus.";
        s.appendChild(p);
        return s;
    }

    const ul = document.createElement("div");
    ul.className = "diff-liste";
    liste.forEach(x => ul.appendChild(ligneDifficulte(x)));
    s.appendChild(ul);
    return s;
}

function ligneDifficulte(x) {
    const l = document.createElement("div");
    l.className = "diff-ligne" + (x.resolue ? " resolue" : " ouverte") + " grav-" + x.gravite;

    const delai = x.resolue ? joursEntre(x.date, x.resolue) : null;

    l.innerHTML = `
      <div class="diff-tete">
        <span class="diff-grav ${x.gravite}">${libelleGravite(x.gravite)}</span>
        <span class="diff-texte">${escapeHtml(x.texte)}</span>
        ${x.projet ? `<span class="chip" style="${stylePuceCat(x.projet)}">${escapeHtml(x.projet)}</span>` : ""}
      </div>
      <p class="diff-meta small-hint">
        ${fmtCourt(x.date)}
        ${x.resolue ? ` → ${fmtCourt(x.resolue)} · résolue en ${delai} j` : " · <strong>ouverte</strong>"}
        ${x.resolution ? ` · ${escapeHtml(x.resolution)}` : ""}
      </p>
      <div class="diff-actions">
        ${x.resolue
            ? `<button class="btn-ghost" data-act="rouvrir">Rouvrir</button>`
            : `<button class="btn-ghost" data-act="resoudre">Marquer résolue</button>`}
        <button class="btn-ghost" data-act="modifier">Modifier</button>
        <button class="btn-ghost" data-act="supprimer">Supprimer</button>
      </div>`;

    l.querySelector('[data-act="modifier"]').onclick = () => ouvrirDifficulte(x);

    const resoudre = l.querySelector('[data-act="resoudre"]');
    if (resoudre) resoudre.onclick = () => ouvrirResolution(x);

    const rouvrir = l.querySelector('[data-act="rouvrir"]');
    if (rouvrir) rouvrir.onclick = () => {
        if (majDifficulte(x.id, { resolue: "", resolution: "" })) {
            toast("Difficulté rouverte", escapeHtml(x.texte).slice(0, 60), "info");
            renderBilan();
        }
    };

    /* Suppression annulable : la même mécanique que partout ailleurs dans
       l'app — pas de fenêtre de confirmation, mais un retour en arrière. */
    l.querySelector('[data-act="supprimer"]').onclick = () => {
        const ote = supprimerDifficulte(x.id);
        if (!ote) return;
        renderBilan();
        toast("Difficulté supprimée", ote.texte.slice(0, 60), "info", 7000, {
            label: "Annuler",
            onClick: () => {
                const liste = getDifficultes();
                liste.push(ote);
                setDifficultes(liste);
                renderBilan();
            }
        });
    };
    return l;
}

/* ── Saisie ──────────────────────────────────────────── */
function ouvrirDifficulte(existante) {
    const projets = getSujets().filter(s => s.actif !== false).map(s => s.nom);
    const d = existante || { texte: "", projet: "", gravite: "genant", date: ymd(new Date()) };

    ouvrirFeuille({
        titre: existante ? "Modifier la difficulté" : "Noter une difficulté",
        champs: `
          <label for="diffTexte">Difficulté rencontrée</label>
          <textarea id="diffTexte" rows="3" placeholder="Ce qui a bloqué, et en quoi">${escapeHtml(d.texte)}</textarea>
          <label for="diffProjet">Projet concerné</label>
          <select id="diffProjet">
            <option value="">— aucun —</option>
            ${projets.map(p => `<option value="${escapeHtml(p)}"${p === d.projet ? " selected" : ""}>${escapeHtml(p)}</option>`).join("")}
          </select>
          <label for="diffGravite">Gravité</label>
          <select id="diffGravite">
            ${GRAVITES.map(g => `<option value="${g.cle}"${g.cle === d.gravite ? " selected" : ""}>${g.libelle}</option>`).join("")}
          </select>
          <label for="diffDate">Date</label>
          <input type="date" id="diffDate" value="${d.date}">`,
        valider: "Enregistrer",
        onValider: () => {
            const texte = qs("#diffTexte").value.trim();
            if (!texte) { toast("Texte requis", "Décrivez la difficulté en une phrase.", "error"); return false; }
            const champs = {
                texte,
                projet:  qs("#diffProjet").value,
                gravite: qs("#diffGravite").value,
                date:    qs("#diffDate").value || ymd(new Date())
            };
            const ok = existante ? majDifficulte(existante.id, champs) : !!ajouterDifficulte(champs);
            if (ok) {
                toast(existante ? "Difficulté modifiée" : "Difficulté notée", texte.slice(0, 60), "success");
                renderBilan();
            }
            return ok;
        }
    });
}

function ouvrirResolution(x) {
    ouvrirFeuille({
        titre: "Résoudre la difficulté",
        champs: `
          <p class="small-hint">${escapeHtml(x.texte)}</p>
          <label for="resTexte">Ce qui a débloqué</label>
          <textarea id="resTexte" rows="3" placeholder="La solution trouvée — c'est ce qui servira au rapport"></textarea>
          <label for="resDate">Date de résolution</label>
          <input type="date" id="resDate" value="${ymd(new Date())}">`,
        valider: "Marquer résolue",
        onValider: () => {
            const date = qs("#resDate").value || ymd(new Date());
            /* Une résolution antérieure à l'apparition rendrait le délai négatif
               et fausserait la moyenne : on refuse plutôt que de corriger en douce. */
            if (date < x.date) {
                toast("Date impossible", `La résolution ne peut pas précéder le ${fmtCourt(x.date)}.`, "error");
                return false;
            }
            const ok = majDifficulte(x.id, { resolue: date, resolution: qs("#resTexte").value.trim() });
            if (ok) { toast("Difficulté résolue", x.texte.slice(0, 60), "success"); renderBilan(); }
            return ok;
        }
    });
}

/* ── Feuille de saisie générique ─────────────────────────
   Même comportement que l'ajout rapide : piège à focus, Échap, clic sur le
   fond, et restitution du focus à l'élément déclencheur. Elle se construit
   à la volée plutôt que d'être posée dans index.html — le balisage dépend
   de l'appelant, et un formulaire caché en permanence dans le document est
   une cible de tabulation en trop. */
let feuilleOuverte = null;
let elementAvantFeuille = null;

function feuilleEstOuverte() { return !!feuilleOuverte; }

function ouvrirFeuille({ titre, champs, valider, onValider }) {
    fermerFeuille();
    elementAvantFeuille = document.activeElement;

    const fond = document.createElement("div");
    fond.className = "feuille-fond";
    fond.innerHTML = `
      <div class="feuille" role="dialog" aria-modal="true" aria-labelledby="feuilleTitre">
        <div class="feuille-tete">
          <h3 id="feuilleTitre">${escapeHtml(titre)}</h3>
          <button class="icon-btn" data-act="fermer" aria-label="Fermer">✕</button>
        </div>
        <div class="feuille-corps">${champs}</div>
        <div class="feuille-pied">
          <button class="btn-ghost" data-act="annuler">Annuler</button>
          <button data-act="valider">${escapeHtml(valider)}</button>
        </div>
      </div>`;

    fond.querySelector('[data-act="fermer"]').onclick  = fermerFeuille;
    fond.querySelector('[data-act="annuler"]').onclick = fermerFeuille;
    fond.querySelector('[data-act="valider"]').onclick = () => { if (onValider() !== false) fermerFeuille(); };
    fond.onclick = e => { if (e.target === fond) fermerFeuille(); };

    /* stopPropagation : sans lui, Échap remonterait au gestionnaire global
       qui ne connaît que la modale d'ajout rapide et ne ferait rien ici. */
    fond.onkeydown = e => {
        if (e.key === "Escape") { e.stopPropagation(); fermerFeuille(); return; }
        if (e.key !== "Tab") return;
        e.stopPropagation();
        const cibles = [...fond.querySelectorAll("button, input, select, textarea")]
            .filter(el => !el.disabled && (el.checkVisibility ? el.checkVisibility() : true));
        if (!cibles.length) return;
        const premier = cibles[0], dernier = cibles[cibles.length - 1];
        if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
        else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    };

    document.body.appendChild(fond);
    feuilleOuverte = fond;
    const premier = fond.querySelector(".feuille-corps textarea, .feuille-corps input, .feuille-corps select");
    if (premier) premier.focus();
}

function fermerFeuille() {
    if (!feuilleOuverte) return;
    feuilleOuverte.remove();
    feuilleOuverte = null;
    if (elementAvantFeuille && document.contains(elementAvantFeuille)) elementAvantFeuille.focus();
    elementAvantFeuille = null;
}

/* ── Initialisation ──────────────────────────────────── */
function initBilan() {
    qsa("#bilanPeriode .seg-btn").forEach(btn => {
        btn.onclick = () => {
            periodeBilan = btn.dataset.jours ? Number(btn.dataset.jours) : null;
            renderBilan();
        };
    });
    const csv = qs("#exportBilanCsvBtn");
    if (csv) csv.onclick = exportBilanCsv;
    const pdf = qs("#exportRoadmapPdfBtn");
    if (pdf) pdf.onclick = exportRoadmapPdf;
    renderBilan();
}

/* ═══════════════════════════════════════════════════════════
   SORTIES — CSV et PDF

   Le CSV est sectionné : plusieurs tableaux dans un seul fichier, séparés
   par une ligne vide. C'est ce qu'un tableur ouvre sans broncher et ce que
   l'on veut vraiment — un bilan n'est pas une table unique.
═══════════════════════════════════════════════════════════ */
function exportBilanCsv() {
    const b = calculerBilan(periodeBilan);
    const periode = periodeBilan ? `${b.bornes.debut} → ${b.bornes.fin}` : "tout l'historique";
    const L = [];

    L.push(["BILAN", periode]);
    L.push([]);

    L.push(["Synthèse"]);
    L.push(["Indicateur", "Valeur"]);
    L.push(["Temps saisi", hm(b.volume.minutes)]);
    L.push(["Jours actifs", b.volume.joursActifs]);
    L.push(["Tâches", b.volume.taches]);
    L.push(["Moyenne par jour actif", hm(b.volume.moyenneParJourActif)]);
    L.push(["Médiane par jour actif", hm(b.volume.medianeParJourActif)]);
    L.push(["Avancement global (%)", b.avancement.avancementGlobal === null ? "non défini" : b.avancement.avancementGlobal]);
    L.push(["Jalons faits / total", `${b.avancement.totalFaits}/${b.avancement.totalJalons}`]);
    L.push(["Taux de retard (%)", b.retards.taux === null ? "aucune échéance" : b.retards.taux]);
    L.push(["Retard moyen (jours)", b.retards.retardMoyen]);
    L.push(["Retard maximum (jours)", b.retards.retardMax]);
    L.push(["Difficultés ouvertes", b.difficultes.ouvertes]);
    L.push(["Difficultés résolues", b.difficultes.resolues]);
    L.push(["Délai moyen de résolution (jours)", b.difficultes.delaiMoyen === null ? "aucune résolue" : b.difficultes.delaiMoyen]);
    L.push([]);

    L.push(["Avancement par projet"]);
    L.push(["Projet", "Début prévu", "Fin prévue", "Avancement (%)", "Attendu (%)", "Écart (pts)",
            "Jalons faits", "Jalons total", "Jalons en retard", "Temps total", "Activités"]);
    b.avancement.projets.forEach(p => L.push([
        p.nom, p.debut, p.fin,
        p.avancement === null ? "non défini" : p.avancement,
        p.risque ? p.risque.attendu : "",
        p.risque ? p.risque.ecart : "",
        p.faits, p.jalons, p.jalonsEnRetard, hm(p.minutes), p.entrees
    ]));
    L.push([]);

    const libEtat = {
        aLHeure: "À l'heure", aVenir: "À venir",
        livreEnRetard: "Livré en retard", retardCourant: "En retard",
        sansEcheance: "Sans échéance"
    };

    L.push(["Jalons"]);
    L.push(["Projet", "Jalon", "Échéance", "Réalisé le", "État", "Retard (jours)"]);
    b.retards.tous.forEach(j => L.push([j.projet, j.titre, j.echeance, j.fait, libEtat[j.etat], j.retard || ""]));
    L.push([]);

    L.push(["Difficultés"]);
    L.push(["Date", "Difficulté", "Projet", "Gravité", "État", "Résolue le", "Délai (jours)", "Résolution"]);
    b.difficultes.liste.forEach(d => L.push([
        d.date, d.texte, d.projet, libelleGravite(d.gravite),
        d.resolue ? "Résolue" : "Ouverte", d.resolue,
        d.resolue ? joursEntre(d.date, d.resolue) : "", d.resolution
    ]));
    L.push([]);

    L.push(["Répartition du temps"]);
    L.push(["Projet", "Temps", "Minutes", "Part (%)"]);
    b.repartition.lignes.forEach(l => L.push([l.nom, hm(l.minutes), l.minutes, Math.round(l.part * 100)]));
    L.push([]);

    L.push(["Activité par semaine"]);
    L.push(["Semaine (lundi)", "N° ISO", "Temps", "Minutes", "Tâches"]);
    b.hebdo.forEach(s => L.push([s.semaine, s.numero, hm(s.minutes), s.minutes, s.taches]));

    telechargerFichier(versCSV(L), `bilan_${ymd(new Date())}.csv`, "text/csv;charset=utf-8");
    toast("Bilan exporté", `${L.length} lignes — 6 tableaux dans un seul fichier.`, "success");
}

/* ── Feuille de route en PDF ─────────────────────────────
   Portrait, une section par projet, jalons datés avec leur état.
   Le retard n'est jamais porté par la seule couleur : chaque ligne
   l'écrit en toutes lettres, et la réalisation d'un jalon se lit à
   une case cochée — un rapport se lit aussi imprimé en noir et blanc. */
function exportRoadmapPdf() {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) return toast("jsPDF manquant", "La bibliothèque PDF n'a pas été chargée.", "error");

    const b = calculerBilan(null);   // la feuille de route porte sur tout
    const projets = b.avancement.projets.filter(p => p.actif !== false && (p.jalons || p.debut || p.entrees));
    if (!projets.length) return toast("Rien à exporter", "Aucun projet à décrire.", "warn");

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const M = 14;
    let y = 0;

    const ACCENT = [31, 92, 155];
    const saut = need => { if (y + need > pageH - 14) { pdf.addPage(); y = 16; } };
    const titre = t => {
        saut(14);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
        pdf.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]); pdf.text(t, M, y);
        pdf.setDrawColor(205, 209, 213); pdf.setLineWidth(0.3);
        pdf.line(M, y + 1.6, pageW - M, y + 1.6);
        pdf.setTextColor(0, 0, 0); pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
        y += 8;
    };

    /* En-tête */
    pdf.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    pdf.rect(0, 0, pageW, 38, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(18);
    pdf.text("Feuille de route", M, 17);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
    pdf.text(`Édité le ${fmtFR(ymd(new Date()))}`, M, 26);
    if (typeof getAuthorName === "function") pdf.text(String(getAuthorName()), M, 32);
    pdf.setTextColor(0, 0, 0);
    y = 48;

    /* Synthèse */
    titre("Synthèse");
    const r = b.retards, a = b.avancement, d = b.difficultes;
    [
        `Avancement global : ${a.avancementGlobal === null ? "non défini" : a.avancementGlobal + " %"}   (${a.totalFaits}/${a.totalJalons} jalons sur ${a.projetsSuivis} projet(s))`,
        `Taux de retard : ${r.taux === null ? "aucune échéance posée" : r.taux + " %"}   ·   ${r.retardsCourants} en cours, ${r.livresEnRetard} livré(s) en retard`,
        `Retard moyen : ${r.retardMoyen} jour(s)   ·   pire cas ${r.retardMax} jour(s)`,
        `Difficultés : ${d.ouvertes} ouverte(s) dont ${d.bloquantesOuvertes} bloquante(s), ${d.resolues} résolue(s)` +
            (d.delaiMoyen === null ? "" : ` en ${d.delaiMoyen} j en moyenne`)
    ].forEach(l => { saut(6); pdf.text(l, M, y); y += 5.5; });
    y += 4;

    /* Un bloc par projet */
    projets.forEach(p => {
        saut(26);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
        pdf.text(String(p.nom), M, y);

        /* Barre d'avancement, doublée du pourcentage écrit à côté. */
        const bw = 46, bx = pageW - M - bw - 20;
        pdf.setFillColor(227, 229, 231);
        pdf.rect(bx, y - 3.4, bw, 3.6, "F");
        if (p.avancement) {
            const c = p.jalonsEnRetard ? [122, 83, 0] : ACCENT;
            pdf.setFillColor(c[0], c[1], c[2]);
            pdf.rect(bx, y - 3.4, bw * (p.avancement / 100), 3.6, "F");
        }
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
        pdf.text(p.avancement === null ? "—" : p.avancement + " %", pageW - M, y, { align: "right" });
        y += 5.5;

        pdf.setFontSize(9); pdf.setTextColor(90, 95, 100);
        const meta = [
            p.debut && p.fin ? `${fmtFR(p.debut)} → ${fmtFR(p.fin)}` : "sans dates prévues",
            `${hm(p.minutes)} sur ${p.entrees} activité(s)`,
            p.risque ? `attendu ${p.risque.attendu} % (${p.risque.ecart > 0 ? "+" : ""}${p.risque.ecart} pts)` : null,
            p.jalonsEnRetard ? `${p.jalonsEnRetard} jalon(s) en retard` : null
        ].filter(Boolean).join("   ·   ");
        pdf.text(meta, M, y);
        pdf.setTextColor(0, 0, 0);
        y += 6;

        const libEtat = {
            aLHeure: "à l'heure", aVenir: "à venir",
            livreEnRetard: "livré en retard", retardCourant: "EN RETARD",
            sansEcheance: "sans échéance"
        };

        if (!p.jalonsDetail.length) {
            saut(6); pdf.setFontSize(9); pdf.text("Aucun jalon défini.", M + 4, y); y += 6;
        } else {
            pdf.setFontSize(9);
            p.jalonsDetail.forEach(j => {
                saut(5.6);
                /* Case cochée ou vide : la réalisation se voit sans couleur. */
                pdf.setDrawColor(120, 125, 130); pdf.setLineWidth(0.25);
                pdf.rect(M + 3, y - 2.7, 2.6, 2.6);
                if (j.f) {
                    pdf.setLineWidth(0.5);
                    pdf.line(M + 3.4, y - 1.4, M + 4.2, y - 0.5);
                    pdf.line(M + 4.2, y - 0.5, M + 5.3, y - 2.4);
                }
                const dates = [
                    j.e ? `échéance ${fmtFR(j.e)}` : "sans échéance",
                    j.f ? `fait ${fmtFR(j.f)}` : null
                ].filter(Boolean).join(", ");
                const suffixe = j.retard ? ` — ${libEtat[j.etat]} de ${j.retard} j` : ` — ${libEtat[j.etat]}`;
                const ligne = pdf.splitTextToSize(`${j.t}  (${dates})${suffixe}`, pageW - M * 2 - 10)[0];
                pdf.text(ligne, M + 8, y);
                y += 5.6;
            });
        }
        y += 4;
    });

    /* Difficultés — la rubrique attendue par tout tuteur */
    if (b.difficultes.liste.length) {
        titre("Difficultés rencontrées");
        b.difficultes.liste.forEach(x => {
            saut(11);
            pdf.setFont("helvetica", "bold"); pdf.setFontSize(9.5);
            pdf.text(`[${libelleGravite(x.gravite)}] ${x.resolue ? "Résolue" : "Ouverte"}`, M, y);
            pdf.setFont("helvetica", "normal");
            const droite = `${fmtFR(x.date)}${x.resolue ? ` → ${fmtFR(x.resolue)} (${joursEntre(x.date, x.resolue)} j)` : ""}${x.projet ? `   ·   ${x.projet}` : ""}`;
            pdf.text(droite, pageW - M, y, { align: "right" });
            y += 5;
            pdf.setFontSize(9.5);
            pdf.splitTextToSize(x.texte, pageW - M * 2 - 4).forEach(l => { saut(5); pdf.text(l, M + 4, y); y += 4.6; });
            if (x.resolution) {
                pdf.setTextColor(90, 95, 100);
                pdf.splitTextToSize("Solution : " + x.resolution, pageW - M * 2 - 4)
                   .forEach(l => { saut(5); pdf.text(l, M + 4, y); y += 4.6; });
                pdf.setTextColor(0, 0, 0);
            }
            y += 3;
        });
    }

    /* Pied de page numéroté, ajouté une fois toutes les pages connues */
    const n = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8); pdf.setTextColor(120, 125, 130);
        pdf.text("Journal de Bord — feuille de route", M, pageH - 8);
        pdf.text(`${i} / ${n}`, pageW - M, pageH - 8, { align: "right" });
    }

    pdf.save(`feuille_de_route_${ymd(new Date())}.pdf`);
    toast("Feuille de route exportée", `${projets.length} projet(s), ${n} page(s).`, "success");
}
