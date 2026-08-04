/* Vérifie les métriques du Bilan sans navigateur.
   Les dépendances d'app.js sont fournies en global, exactement comme
   la page les fournit — on teste donc le vrai code, pas une copie. */

const fs = require('fs');
const path = 'C:/Users/rance/OneDrive/Documents/Claude code/JournalDeBord-main/bilan.js';

// --- dépendances issues d'app.js, reprises à l'identique ---
global.ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
global.parseYMD = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
global.parseHM = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t).trim()); return m ? +m[1] * 60 + +m[2] : NaN; };
global.parsePlage = texte => {
    if (typeof texte !== "string" || !texte.trim()) return null;
    const [a, b] = texte.replace(/[–—]/g, "-").split("-");
    const debut = global.parseHM(a || ""), fin = global.parseHM(b || "");
    if (isNaN(debut) || isNaN(fin) || fin < debut) return null;
    return { debut, fin, duree: fin - debut };
};
global.numeroSemaine = d => {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    t.setDate(t.getDate() + 4 - (t.getDay() || 7));
    return Math.ceil(((t - new Date(t.getFullYear(), 0, 1)) / 86400000 + 1) / 7);
};
global.GRAVITES = [
    { cle: "bloquant", libelle: "Bloquant", rang: 3 },
    { cle: "genant",   libelle: "Gênant",   rang: 2 },
    { cle: "mineur",   libelle: "Mineur",   rang: 1 }
];

// jeu de données maîtrisé
const AUJ = '2026-08-04';
global.__auj = AUJ;
const OrigDate = Date;
global.Date = class extends OrigDate {
    constructor(...a) { return a.length ? new OrigDate(...a) : new OrigDate(AUJ + 'T12:00:00'); }
    static now() { return new OrigDate(AUJ + 'T12:00:00').getTime(); }
};

const JOURNAL = {
    '2026-07-20': [{ timeRange: '09:00-12:00', text: 'A', cat: 'NEF2' }, { timeRange: '13:00-17:00', text: 'B', cat: 'NEF2' }],
    '2026-07-21': [{ timeRange: '09:00-11:00', text: 'C', cat: 'Réunion' }],
    '2026-07-28': [{ timeRange: '08:00-16:00', text: 'D', cat: 'NEF2' }],
    '2026-08-03': [{ timeRange: '10:00-12:00', text: 'E', cat: 'Piéton' }, { timeRange: '', text: 'sans horaire', cat: 'NEF2' }],
    '2026-01-05': [{ timeRange: '09:00-17:00', text: 'vieux', cat: 'NEF2' }]   // hors période 30 j
};
const SUJETS = [
    { nom: 'NEF2', actif: true, debut: '2026-02-24', fin: '2026-06-30', jalons: [
        { t: 'État des lieux',      e: '2026-03-14', f: '2026-03-10' },  // à l'heure
        { t: 'Simulation',          e: '2026-04-30', f: '2026-05-02' },  // livré en retard : 2 j
        { t: 'Validation',          e: '2026-06-15', f: '' },            // retard courant : 50 j
        { t: 'Déploiement',         e: '2026-09-20', f: '' },            // à venir
        { t: 'Sans date',           e: '',           f: '' }             // hors calcul
    ]},
    { nom: 'Réunion', actif: true, debut: '', fin: '', jalons: [] },
    { nom: 'Piéton', actif: true, debut: '2026-07-01', fin: '2026-12-31', jalons: [
        { t: 'Relevé', e: '2026-08-01', f: '2026-08-01' }                // à l'heure (égalité)
    ]}
];
const DIFFS = [
    { id: 1, date: '2026-07-20', texte: 'Plan introuvable', projet: 'NEF2', gravite: 'bloquant', resolue: '2026-07-24', resolution: 'Retrouvé aux archives' },
    { id: 2, date: '2026-07-25', texte: 'Logiciel instable', projet: 'NEF2', gravite: 'genant', resolue: '', resolution: '' },
    { id: 3, date: '2026-08-01', texte: 'Attente validation', projet: 'Piéton', gravite: 'bloquant', resolue: '', resolution: '' },
    { id: 4, date: '2026-01-10', texte: 'Vieux souci', projet: '', gravite: 'mineur', resolue: '2026-01-12', resolution: 'ok' }
];

global.getJournal = () => JOURNAL;
global.getSujets = () => SUJETS;
global.getDifficultes = () => DIFFS;
global.statsSujet = (nom) => {
    let minutes = 0, entrees = 0, premiere = '', derniere = '';
    Object.keys(JOURNAL).sort().forEach(j => (JOURNAL[j] || []).forEach(t => {
        if ((t.cat || 'Général') !== nom) return;
        entrees++; if (!premiere) premiere = j; derniere = j;
        const p = global.parsePlage(t.timeRange); if (p) minutes += p.duree;
    }));
    const s = SUJETS.find(x => x.nom === nom) || { jalons: [] };
    const jalons = s.jalons || [], faits = jalons.filter(j => j.f).length;
    return { nom, actif: true, debut: s.debut || '', fin: s.fin || '', premiere, derniere, entrees, minutes,
             jalons: jalons.length, faits,
             avancement: jalons.length ? Math.round((faits / jalons.length) * 100) : null };
};

// charge bilan.js dans ce contexte global
const src = fs.readFileSync(path, 'utf8').replace(/\nif \(typeof module[\s\S]*$/, '');
eval(src);

// ---------------- assertions ----------------
let ok = 0, ko = 0;
const eq = (nom, obtenu, attendu) => {
    const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
    if (a === b) { ok++; console.log('  ✓ ' + nom); }
    else { ko++; console.log('  ✗ ' + nom + '\n      obtenu  : ' + a + '\n      attendu : ' + b); }
};

console.log('\n── États de jalon ──');
eq('à l\'heure (f < e)',        etatJalon({ e: '2026-03-14', f: '2026-03-10' }, AUJ), { etat: 'aLHeure', retard: 0 });
eq('à l\'heure (f = e)',        etatJalon({ e: '2026-08-01', f: '2026-08-01' }, AUJ), { etat: 'aLHeure', retard: 0 });
eq('livré en retard de 2 j',    etatJalon({ e: '2026-04-30', f: '2026-05-02' }, AUJ), { etat: 'livreEnRetard', retard: 2 });
eq('retard courant de 50 j',    etatJalon({ e: '2026-06-15', f: '' }, AUJ),           { etat: 'retardCourant', retard: 50 });
eq('à venir',                   etatJalon({ e: '2026-09-20', f: '' }, AUJ),           { etat: 'aVenir', retard: 0 });
eq('sans échéance',             etatJalon({ e: '', f: '' }, AUJ),                     { etat: 'sansEcheance', retard: 0 });
eq('échéance aujourd\'hui, non fait → pas encore en retard',
                                etatJalon({ e: AUJ, f: '' }, AUJ),                    { etat: 'aVenir', retard: 0 });

console.log('\n── Bornes de période ──');
eq('30 jours inclut aujourd\'hui', bornesPeriode(30, AUJ), { debut: '2026-07-06', fin: AUJ });
eq('tout',                         bornesPeriode(null, AUJ), { debut: '', fin: AUJ });

console.log('\n── Volume (30 j) ──');
const b30 = bornesPeriode(30, AUJ);
const v = statsVolume(JOURNAL, b30);
eq('minutes',        v.minutes, 180 + 240 + 120 + 480 + 120);   // 1140
eq('tâches',         v.taches, 6);
eq('sans horaire',   v.sansHoraire, 1);
eq('jours actifs',   v.joursActifs, 4);
eq('moyenne/jour actif', v.moyenneParJourActif, 285);
eq('plus longue journée', v.plusLongueJournee, { jour: '2026-07-28', minutes: 480 });
eq('médiane',        v.medianeParJourActif, mediane([420, 120, 480, 120]));

console.log('\n── Volume (tout) — la vieille entrée revient ──');
const vt = statsVolume(JOURNAL, bornesPeriode(null, AUJ));
eq('minutes tout', vt.minutes, 1140 + 480);
eq('jours actifs tout', vt.joursActifs, 5);

console.log('\n── Retards ──');
const r = statsRetards(SUJETS);
eq('jalons sans échéance',  r.sansEcheance, 1);
eq('jalons avec échéance',  r.avecEcheance, 5);
eq('à l\'heure',            r.aLHeure, 2);
eq('à venir',               r.aVenir, 1);
eq('livrés en retard',      r.livresEnRetard, 1);
eq('retards courants',      r.retardsCourants, 1);
eq('taux = 2/5',            r.taux, 40);
eq('retard moyen (2 et 50)', r.retardMoyen, 26);
eq('retard max',            r.retardMax, 50);
eq('urgence en tête',       r.liste[0].etat, 'retardCourant');

console.log('\n── Avancement ──');
const a = statsAvancement(SUJETS, JOURNAL);
eq('projets suivis',      a.projetsSuivis, 2);
eq('projets sans jalon',  a.projetsSansJalon, 1);
eq('total jalons',        a.totalJalons, 6);
eq('total faits',         a.totalFaits, 3);
eq('global pondéré 3/6',  a.avancementGlobal, 50);
const nef = a.projets.find(p => p.nom === 'NEF2');
eq('NEF2 : 2/5 jalons faits → 40 %', nef.avancement, 40);
eq('NEF2 : jalons en retard', nef.jalonsEnRetard, 2);

console.log('\n── Risque (avancement attendu vs réel) ──');
eq('NEF2 échéance dépassée → attendu 100 %', nef.risque.attendu, 100);
eq('NEF2 écart = 40 - 100', nef.risque.ecart, -60);
eq('Réunion sans dates → pas de risque', a.projets.find(p => p.nom === 'Réunion').risque, null);

console.log('\n── Difficultés (30 j) ──');
const d = statsDifficultes(DIFFS, b30);
eq('total dans la période', d.total, 3);
eq('ouvertes',              d.ouvertes, 2);
eq('résolues',              d.resolues, 1);
eq('bloquantes ouvertes',   d.bloquantesOuvertes, 1);
eq('délai moyen (4 j)',     d.delaiMoyen, 4);
eq('ouvertes en tête, la plus grave d\'abord', d.liste[0].texte, 'Attente validation');
eq('résolue en dernier',    d.liste[d.liste.length - 1].texte, 'Plan introuvable');

console.log('\n── Difficultés : aucune résolue → délai null, pas 0 ──');
eq('délai null', statsDifficultes([{ date: '2026-08-01', texte: 'x', gravite: 'mineur', resolue: '' }], b30).delaiMoyen, null);

console.log('\n── Répartition ──');
const rep = repartitionParProjet(JOURNAL, b30);
eq('total',              rep.total, 1140);
eq('NEF2 en tête',       rep.lignes[0].nom, 'NEF2');
eq('NEF2 minutes',       rep.lignes[0].minutes, 900);
eq('parts somment à 1',  Math.round(rep.lignes.reduce((n, l) => n + l.part, 0) * 1000) / 1000, 1);

console.log('\n── Série hebdo ──');
const h = serieHebdo(JOURNAL, b30);
eq('lundi de 2026-08-04 (mardi)', lundiDe('2026-08-04'), '2026-08-03');
eq('lundi de 2026-08-03 (lundi)', lundiDe('2026-08-03'), '2026-08-03');
eq('lundi de 2026-08-09 (dimanche)', lundiDe('2026-08-09'), '2026-08-03');
eq('semaines émises sans trou', h.length, 5);
eq('semaine creuse présente',   h.some(s => s.minutes === 0), true);
eq('somme = volume période',    h.reduce((n, s) => n + s.minutes, 0), v.minutes);

console.log('\n── Cas limites ──');
eq('journal vide', statsVolume({}, b30).joursActifs, 0);
eq('aucun sujet → avancement null', statsAvancement([], {}).avancementGlobal, null);
eq('aucun jalon daté → taux null', statsRetards([{ nom: 'X', jalons: [{ t: 'a', e: '', f: '' }] }]).taux, null);
eq('médiane paire', mediane([10, 20, 30, 40]), 25);
eq('médiane impaire', mediane([10, 30, 20]), 20);
eq('médiane vide', mediane([]), 0);

console.log(`\n${ok} assertions réussies, ${ko} échec(s)\n`);
process.exit(ko ? 1 : 0);
