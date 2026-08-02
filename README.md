# Journal de Bord

Application web de suivi d'alternance : journal d'activité, pointage des heures et
génération de rapports. Fonctionne intégralement hors ligne, sans compte ni serveur.

## Fonctionnement

Les données sont stockées dans le `localStorage` du navigateur et **ne quittent jamais
l'appareil** — aucune requête réseau n'est émise au chargement ni à l'usage. Les polices
et la bibliothèque PDF sont servies depuis le dépôt, pas depuis un CDN.

Conséquence importante : vider les données de site du navigateur efface tout.
L'onglet Réglages permet d'exporter une sauvegarde `.json`, et l'application rappelle
de le faire au bout de deux semaines sans export.

## Écrans

| Onglet | Contenu |
| --- | --- |
| Aujourd'hui | Pointage du jour (horodatage en un clic) et tâches de la journée |
| Historique | Toutes les tâches, recherche, filtres, export PDF et rapport d'alternance |
| Pointage | Tableaux semaine et mois, objectifs, export PDF |
| Réglages | Catégories, horaires, paramètres du contrat, sauvegarde et export CSV |

## Raccourcis clavier

`A` ajout rapide · `/` rechercher · `1` à `4` naviguer entre les onglets · `?` aide · `Échap` fermer

## Installation

Aucune étape de build. Servir le dossier avec n'importe quel serveur statique :

```bash
npx http-server . -p 4321 -c-1
```

Le service worker nécessite `http://localhost` ou une origine HTTPS ; en `file://`
l'application fonctionne mais sans mise en cache hors ligne ni installation PWA.

Sur mobile, « Ajouter à l'écran d'accueil » installe l'application. Deux raccourcis
sont disponibles par appui long sur l'icône : ajout rapide et pointage.

## Données

Le format de stockage est stable entre les versions :

| Clé | Contenu |
| --- | --- |
| `jb_journal` | Tâches, indexées par date `AAAA-MM-JJ` |
| `jb_pointage` | Heures d'arrivée, de pause et de départ, par date |
| `jb_cats` | Catégories |
| `jb_contrat` | Objectif quotidien et tolérance déduite |
| `jb_workhours` | Plage horaire affichée dans la barre de progression |

Les sauvegardes produites par les versions antérieures s'importent sans modification :
les champs devenus inutiles (`creds`, `rate`, `priority`, `status`) sont ignorés.

> Les fichiers de sauvegarde contiennent des données d'activité réelles.
> Ils sont exclus du dépôt par `.gitignore` — ne les committez pas.

## Dépendances

- [jsPDF](https://github.com/parallax/jsPDF) 2.5.1 (MIT), dans `vendor/`
- [Inter](https://rsms.me/inter/) et [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (SIL Open Font License), dans `fonts/`
