/* ═══════════════════════════════════════════════════════════
   BILAN — métriques dérivées

   Aucune de ces valeurs n'est stockée. Tout se recalcule à chaque rendu
   depuis le journal, les sujets et les difficultés : c'est ce qui garantit
   qu'un chiffre affiché ne peut jamais contredire les données.

   Le fichier ne contient que des fonctions pures — elles prennent leurs
   entrées en paramètre et ne touchent ni au DOM ni au stockage. C'est ce
   qui les rend vérifiables sans navigateur.
═══════════════════════════════════════════════════════════ */

/* ── Vocabulaire des retards ──────────────────────────────
   Un jalon n'a que deux dates : `e` l'échéance, `f` la réalisation.
   Quatre états en découlent, et un seul compte comme « sans objet ».

     e absente                → hors calcul : sans échéance, pas de retard
     f ≤ e                    → à l'heure
     f > e                    → livré en retard   (retard figé = f − e)
     f absente et aujourd'hui > e → en retard courant (retard qui court = today − e)

   La distinction entre les deux derniers est importante : un retard figé
   est de l'histoire, un retard courant est un problème actuel. Les
   confondre dans un même total masque ce qu'il reste à rattraper.
────────────────────────────────────────────────────────── */

const JOUR_MS = 86400000;

function joursEntre(a, b) {
    return Math.round((parseYMD(b) - parseYMD(a)) / JOUR_MS);
}

function etatJalon(j, aujourdhui) {
    if (!j || !j.e) return { etat: "sansEcheance", retard: 0 };
    if (j.f) {
        const r = joursEntre(j.e, j.f);
        return r > 0 ? { etat: "livreEnRetard", retard: r } : { etat: "aLHeure", retard: 0 };
    }
    const r = joursEntre(j.e, aujourdhui);
    return r > 0 ? { etat: "retardCourant", retard: r } : { etat: "aVenir", retard: 0 };
}

/* ── Fenêtre d'observation ────────────────────────────────
   Les KPI de volume portent sur une période ; l'avancement et les retards,
   non — un jalon en retard le reste, qu'on regarde 30 jours ou tout. */
function bornesPeriode(jours, aujourdhui) {
    if (!jours) return { debut: "", fin: aujourdhui };
    const d = parseYMD(aujourdhui);
    d.setDate(d.getDate() - (jours - 1));
    return { debut: ymd(d), fin: aujourdhui };
}

const dansPeriode = (jour, b) => (!b.debut || jour >= b.debut) && jour <= b.fin;

/* ── Volume d'activité ────────────────────────────────────
   « Jours actifs » et non « jours écoulés » : la moyenne d'un alternant
   qui travaille trois jours par semaine n'a aucun sens rapportée à sept. */
function statsVolume(journal, bornes) {
    let minutes = 0, taches = 0, sansHoraire = 0;
    const parJour = {};

    Object.keys(journal).forEach(jour => {
        if (!dansPeriode(jour, bornes)) return;
        (journal[jour] || []).forEach(t => {
            taches++;
            const p = parsePlage(t.timeRange);
            if (p) { minutes += p.duree; parJour[jour] = (parJour[jour] || 0) + p.duree; }
            else sansHoraire++;
        });
    });

    const jours = Object.keys(parJour);
    const durees = jours.map(j => parJour[j]);
    const plusLongue = jours.length
        ? jours.reduce((a, b) => parJour[b] > parJour[a] ? b : a)
        : "";

    return {
        minutes, taches, sansHoraire,
        joursActifs: jours.length,
        moyenneParJourActif: jours.length ? Math.round(minutes / jours.length) : 0,
        medianeParJourActif: mediane(durees),
        plusLongueJournee: plusLongue ? { jour: plusLongue, minutes: parJour[plusLongue] } : null,
        parJour
    };
}

function mediane(nombres) {
    if (!nombres.length) return 0;
    const t = [...nombres].sort((a, b) => a - b);
    const m = Math.floor(t.length / 2);
    return t.length % 2 ? t[m] : Math.round((t[m - 1] + t[m]) / 2);
}

/* ── Avancement ───────────────────────────────────────────
   Global pondéré par le nombre de jalons, et non moyenne des pourcentages :
   un projet à 12 jalons ne pèse pas comme un projet à 2. Les projets sans
   jalon sont exclus — leur avancement n'est pas 0 %, il est inconnu, et
   les compter à zéro ferait mentir le total. */
function statsAvancement(sujets, journal) {
    const aujourdhui = ymd(new Date());
    const projets = sujets.map(s => {
        const st = statsSujet(s.nom, journal);
        const jalons = (s.jalons || []).map(j => ({ ...j, ...etatJalon(j, aujourdhui) }));
        const avecEcheance = jalons.filter(j => j.etat !== "sansEcheance");
        const enRetard = jalons.filter(j => j.etat === "retardCourant" || j.etat === "livreEnRetard");
        return {
            ...st,
            jalonsDetail: jalons,
            jalonsAvecEcheance: avecEcheance.length,
            jalonsEnRetard: enRetard.length,
            retardMax: enRetard.length ? Math.max(...enRetard.map(j => j.retard)) : 0,
            /* Un projet est « à risque » si son échéance approche alors qu'il
               reste plus à faire qu'il ne reste de temps, proportionnellement. */
            risque: risqueProjet(st, s, aujourdhui)
        };
    });

    const avecJalons = projets.filter(p => p.jalons > 0);
    const totalJalons = avecJalons.reduce((n, p) => n + p.jalons, 0);
    const totalFaits  = avecJalons.reduce((n, p) => n + p.faits, 0);

    return {
        projets,
        projetsSuivis: avecJalons.length,
        projetsSansJalon: projets.length - avecJalons.length,
        totalJalons, totalFaits,
        avancementGlobal: totalJalons ? Math.round((totalFaits / totalJalons) * 100) : null
    };
}

/* Compare l'avancement réel à l'avancement attendu si le projet progressait
   linéairement entre sa date de début et sa date de fin. Sans les deux dates,
   la question ne se pose pas — on ne devine pas. */
function risqueProjet(st, s, aujourdhui) {
    if (!s.debut || !s.fin || st.avancement === null) return null;
    const total = joursEntre(s.debut, s.fin);
    if (total <= 0) return null;
    const ecoule = Math.min(Math.max(joursEntre(s.debut, aujourdhui), 0), total);
    const attendu = Math.round((ecoule / total) * 100);
    return { attendu, reel: st.avancement, ecart: st.avancement - attendu };
}

/* ── Retards ──────────────────────────────────────────────
   Le taux se calcule sur les jalons AYANT une échéance : inclure ceux qui
   n'en ont pas gonflerait artificiellement le dénominateur et ferait baisser
   le taux à mesure qu'on ajoute des jalons sans date. */
function statsRetards(sujets) {
    const aujourdhui = ymd(new Date());
    const tous = [];

    sujets.forEach(s => (s.jalons || []).forEach(j => {
        const e = etatJalon(j, aujourdhui);
        tous.push({ projet: s.nom, titre: j.t, echeance: j.e, fait: j.f, ...e });
    }));

    const avecEcheance  = tous.filter(j => j.etat !== "sansEcheance");
    const livresEnRetard = tous.filter(j => j.etat === "livreEnRetard");
    const retardsCourants = tous.filter(j => j.etat === "retardCourant");
    const aLHeure = tous.filter(j => j.etat === "aLHeure");
    const enRetard = [...livresEnRetard, ...retardsCourants];

    return {
        tous,
        sansEcheance: tous.length - avecEcheance.length,
        avecEcheance: avecEcheance.length,
        aLHeure: aLHeure.length,
        aVenir: tous.filter(j => j.etat === "aVenir").length,
        livresEnRetard: livresEnRetard.length,
        retardsCourants: retardsCourants.length,
        /* null et non 0 quand aucun jalon n'a d'échéance : « 0 % de retard »
           serait un compliment non mérité. */
        taux: avecEcheance.length ? Math.round((enRetard.length / avecEcheance.length) * 100) : null,
        retardMoyen: enRetard.length
            ? Math.round(enRetard.reduce((n, j) => n + j.retard, 0) / enRetard.length)
            : 0,
        retardMax: enRetard.length ? Math.max(...enRetard.map(j => j.retard)) : 0,
        /* Trié par urgence : ce qui court d'abord, puis le plus en retard. */
        liste: enRetard.sort((a, b) =>
            (a.etat === b.etat ? b.retard - a.retard : (a.etat === "retardCourant" ? -1 : 1)))
    };
}

/* ── Difficultés ──────────────────────────────────────────
   Le délai de résolution ne se calcule que sur les difficultés résolues :
   inclure les ouvertes avec « aujourd'hui » comme fin ferait baisser le
   délai moyen chaque jour où l'on ne résout rien, ce qui est l'inverse
   du signal attendu. */
function statsDifficultes(diffs, bornes) {
    const dans = diffs.filter(d => dansPeriode(d.date, bornes));
    const ouvertes = dans.filter(d => !d.resolue);
    const resolues = dans.filter(d => d.resolue);
    const delais = resolues
        .map(d => joursEntre(d.date, d.resolue))
        .filter(n => Number.isFinite(n) && n >= 0);

    const parGravite = {};
    GRAVITES.forEach(g => {
        parGravite[g.cle] = {
            libelle: g.libelle,
            total:    dans.filter(d => d.gravite === g.cle).length,
            ouvertes: ouvertes.filter(d => d.gravite === g.cle).length
        };
    });

    const parProjet = {};
    dans.forEach(d => {
        const p = d.projet || "(sans projet)";
        parProjet[p] = parProjet[p] || { total: 0, ouvertes: 0 };
        parProjet[p].total++;
        if (!d.resolue) parProjet[p].ouvertes++;
    });

    return {
        total: dans.length,
        ouvertes: ouvertes.length,
        resolues: resolues.length,
        bloquantesOuvertes: ouvertes.filter(d => d.gravite === "bloquant").length,
        delaiMoyen: delais.length ? Math.round(delais.reduce((a, b) => a + b, 0) / delais.length) : null,
        delaiMax: delais.length ? Math.max(...delais) : 0,
        parGravite, parProjet,
        /* Les ouvertes d'abord, les plus graves en tête, puis les plus anciennes :
           l'ordre dans lequel on veut les traiter. */
        liste: [...dans].sort((a, b) => {
            if (!!a.resolue !== !!b.resolue) return a.resolue ? 1 : -1;
            const ga = (GRAVITES.find(g => g.cle === a.gravite) || {}).rang || 0;
            const gb = (GRAVITES.find(g => g.cle === b.gravite) || {}).rang || 0;
            return gb - ga || a.date.localeCompare(b.date);
        })
    };
}

/* ── Répartition du temps par projet ──────────────────────
   Trié décroissant : la première ligne répond à « où passe mon temps ». */
function repartitionParProjet(journal, bornes) {
    const parProjet = {};
    let total = 0;
    Object.keys(journal).forEach(jour => {
        if (!dansPeriode(jour, bornes)) return;
        (journal[jour] || []).forEach(t => {
            const p = parsePlage(t.timeRange);
            if (!p) return;
            const nom = t.cat || "Général";
            parProjet[nom] = (parProjet[nom] || 0) + p.duree;
            total += p.duree;
        });
    });
    return {
        total,
        lignes: Object.entries(parProjet)
            .map(([nom, minutes]) => ({ nom, minutes, part: total ? minutes / total : 0 }))
            .sort((a, b) => b.minutes - a.minutes)
    };
}

/* ── Série hebdomadaire ───────────────────────────────────
   Semaines ISO, lundi comme premier jour. On émet aussi les semaines vides :
   un trou dans l'activité est une information, le masquer donnerait une
   courbe faussement régulière. */
function lundiDe(dateStr) {
    const d = parseYMD(dateStr);
    const decalage = (d.getDay() + 6) % 7;   // lundi = 0
    d.setDate(d.getDate() - decalage);
    return ymd(d);
}

function serieHebdo(journal, bornes) {
    const jours = Object.keys(journal).filter(j => dansPeriode(j, bornes)).sort();
    if (!jours.length) return [];

    const debut = lundiDe(bornes.debut || jours[0]);
    const fin   = lundiDe(bornes.fin);
    const parSemaine = {};

    jours.forEach(jour => {
        const l = lundiDe(jour);
        parSemaine[l] = parSemaine[l] || { minutes: 0, taches: 0 };
        (journal[jour] || []).forEach(t => {
            parSemaine[l].taches++;
            const p = parsePlage(t.timeRange);
            if (p) parSemaine[l].minutes += p.duree;
        });
    });

    const serie = [];
    const curseur = parseYMD(debut);
    /* Garde-fou : 520 semaines = 10 ans. Une date aberrante dans le journal
       ne doit pas transformer la boucle en boucle infinie. */
    for (let n = 0; ymd(curseur) <= fin && n < 520; n++) {
        const l = ymd(curseur);
        serie.push({ semaine: l, numero: numeroSemaine(parseYMD(l)), ...(parSemaine[l] || { minutes: 0, taches: 0 }) });
        curseur.setDate(curseur.getDate() + 7);
    }
    return serie;
}

/* ── Assemblage ───────────────────────────────────────────
   Un seul point d'entrée : l'interface ne recalcule jamais rien elle-même. */
function calculerBilan(jours) {
    const journal = getJournal();
    const sujets  = getSujets();
    const diffs   = getDifficultes();
    const bornes  = bornesPeriode(jours, ymd(new Date()));

    return {
        bornes, jours,
        volume:      statsVolume(journal, bornes),
        avancement:  statsAvancement(sujets, journal),
        retards:     statsRetards(sujets),
        difficultes: statsDifficultes(diffs, bornes),
        repartition: repartitionParProjet(journal, bornes),
        hebdo:       serieHebdo(journal, bornes)
    };
}

/* Export pour les tests hors navigateur — ignoré dans la page. */
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        etatJalon, joursEntre, bornesPeriode, dansPeriode, mediane,
        statsVolume, statsAvancement, statsRetards, statsDifficultes,
        repartitionParProjet, serieHebdo, lundiDe, risqueProjet
    };
}
