# Journal de Bord

Suivi d'alternance : ce que je fais au jour le jour, où en sont mes projets,
ce qu'il reste à faire. Fonctionne intégralement hors ligne, sans compte ni serveur.

## Le principe

L'application ne stocke que deux choses : **les activités** (ce que j'ai fait, quand,
sur quoi) et **les projets** (leurs dates prévues et leurs étapes).

Tout le reste est **recalculé à chaque affichage** depuis les activités : la période
réellement travaillée, le temps cumulé, l'avancement, les retards, le planning.
Rien ne peut donc se désynchroniser, et aucun chiffre ne devient faux avec le temps.

Conséquence pratique : le planning est déjà rempli dès la première ouverture, à partir
de l'historique existant, sans avoir à ressaisir quoi que ce soit.

## Écrans

| Onglet | Contenu |
| --- | --- |
| Aujourd'hui | Activités du jour, saisie rapide, et les étapes à cocher des projets travaillés |
| Historique | Toutes les activités : recherche, filtres, export PDF, rapport d'alternance |
| Projets | Feuille de route et planning. Bascule Liste ↔ Planning |
| Réglages | Projets, sauvegarde, exports CSV, données archivées |

## Le planning

Chaque projet occupe une ligne :

- une **barre pleine** = la période réellement travaillée, déduite des activités ;
- une **barre en pointillé** = la période prévue, si vous avez saisi les dates.
  Elle passe au rouge quand l'échéance est dépassée et que le projet n'est pas fini ;
- des **losanges** = les étapes. Pleins quand elles sont faites, rouges en retard.

L'échelle (jour, semaine, mois) est choisie automatiquement : la plus fine qui reste
lisible. Une échelle qui ne tiendrait pas est grisée plutôt que proposée puis subie.
Sur téléphone, le nom du projet passe au-dessus de sa piste — le planning change de
forme au lieu de rétrécir, et rien ne défile latéralement.

## Suivi de l'avancement

L'avancement d'un projet est le rapport de ses étapes terminées sur son total.
Sans étape, aucun pourcentage n'est affiché — mieux vaut pas de chiffre qu'un chiffre
inventé.

Pour que l'avancement ne se fige pas, les étapes non terminées des projets sur lesquels
vous avez travaillé dans la journée remontent dans l'onglet Aujourd'hui, cochables en
un geste.

## Vos données

Elles sont dans le `localStorage` du navigateur et **ne quittent jamais l'appareil** :
aucune requête réseau n'est émise, ni au chargement ni à l'usage. Les polices et la
bibliothèque PDF sont servies depuis le dépôt.

Conséquence importante : vider les données de site du navigateur efface tout. L'onglet
Réglages permet d'exporter une sauvegarde `.json`, et l'application le rappelle au bout
de deux semaines sans export.

| Clé | Contenu |
| --- | --- |
| `jb_journal` | Activités, indexées par date `AAAA-MM-JJ` |
| `jb_sujets` | Projets : dates prévues, étapes, archivage |
| `jb_cats` | Miroir des noms de projets, pour compatibilité |
| `jb_sort`, `jb_theme` | Préférences d'affichage |

Les sauvegardes des versions antérieures s'importent sans modification : les projets
sont recréés à partir des catégories et des activités existantes.

> Les clés `jb_pointage`, `jb_contrat` et `jb_workhours` proviennent de la version
> précédente. Elles ne sont plus utilisées, mais restent en base et dans chaque
> sauvegarde — une fonctionnalité retirée n'emporte pas les données saisies.
> Elles sont exportables en CSV depuis Réglages → Données archivées.

## Raccourcis clavier

`A` ajout rapide · `/` rechercher · `1` à `4` naviguer · `?` aide · `Échap` fermer

## Installation

Aucune étape de build. Servir le dossier avec n'importe quel serveur statique :

```bash
npx http-server . -p 4321 -c-1
```

Le service worker nécessite `http://localhost` ou une origine HTTPS ; en `file://`
l'application fonctionne mais sans cache hors ligne ni installation PWA.

Sur mobile, « Ajouter à l'écran d'accueil » installe l'application.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `app.js` | Stockage, activités, historique, exports, réglages |
| `projets.js` | Feuille de route : cartes de projet, étapes |
| `gantt.js` | Planning : axe des temps, barres, jalons |

## Dépendances

- [jsPDF](https://github.com/parallax/jsPDF) 2.5.1 (MIT), dans `vendor/`
- [Inter](https://rsms.me/inter/) et [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (SIL Open Font License), dans `fonts/`
