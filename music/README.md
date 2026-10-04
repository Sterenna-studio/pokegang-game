# 🎵 PokéGang — Musiques de fond

Assets audio importés depuis `C:\DEV\repos\pokeforge\game\music`.

Les pistes utilisées par PokéGang sont référencées dans `modules/ui/audio.js` :

- `MUSIC_TRACKS` pour les musiques de fond (`music/BGM/...`) ;
- `JINGLES` pour les introductions / jingles (`music/ME/...`) ;
- `SE_SOUNDS` pour les effets audio (`music/SE/...`).

## Catalogue de pistes attendues

| Fichier référencé | Usage |
|-------------------|-------|
| `BGM/First Town.mp3` | Base / onglets gang-zones |
| `BGM/Route 1.mp3` | Routes, forêt, safari |
| `BGM/Cave.mp3` | Cavernes, tour, manoir |
| `BGM/Lab.mp3` | Ville / Silph |
| `BGM/Introduction.mp3` | Mer / bateau |
| `BGM/VSTrainer.mp3` | Arènes |
| `BGM/VSRival.mp3` | Rocket |
| `BGM/VSLegend.mp3` | Élite 4 / sommet |
| `BGM/MysteryGift.mp3` | Casino / mystery gift |
| `BGM/Hall of Fame.mp3` | Tableau d'honneur |
| `BGM/Title.mp3` | Titre |

## Bibliothèque vs. ce qui est livré

Ce dossier est une **bibliothèque** (~945 fichiers, ~43 Mo) où l'on pioche : il
contient des `.mp3`, mais aussi des `.wav`, `.ogg` et `.mid` que le moteur ne lit
jamais (`MusicPlayer` passe par `HTMLAudioElement`, sans support MIDI).

Le jeu n'en référence que **24 fichiers**, tous en `.mp3`. Les deux chemins de
livraison filtrent donc :

| Cible | Ce qui part | Mécanisme |
|---|---|---|
| itch.io | uniquement les 24 pistes référencées | `collectReferencedMusic()` dans `tools/build-itch.js` |
| pokegang.sterenna.fr | tous les `.mp3`, aucun wav/mid/ogg | excludes rsync dans `.github/workflows/deploy-ovh.yml` |

**Conséquence** : déposer un fichier ici ne suffit pas à l'embarquer. Il faut le
référencer dans `modules/ui/audio.js` **sous forme de chaîne littérale** (un chemin
construit dynamiquement échapperait au scan et ne ferait 404 qu'en production).
Détails et garde-fous dans `docs/itch-build.md`.

Les fichiers non référencés sont conservés volontairement : les supprimer ne
réduirait pas le dépôt (l'historique git les garde) et ils servent de réserve pour
les prochaines pistes.

## Format recommandé
- Format : **MP3** (bonne compatibilité navigateur)
- Bitrate : 128–192 kbps (équilibre qualité/taille)
- Durée : 1–3 minutes (la boucle est gérée par le moteur)
- Loop : les fichiers doivent pouvoir se boucler proprement (même silence au début et à la fin)

## Comment ajouter une piste
1. Placez votre fichier `.mp3` dans ce dossier
2. Dans `MUSIC_TRACKS` (`modules/ui/audio.js`), la clé `file` référence le chemin depuis la racine du jeu (ex: `'music/BGM/Route 1.mp3'`)
3. Dans `data/zones-data.js`, associez l'ID de zone à la clé de piste via la propriété `music`

## Crossfade
Le moteur (`MusicPlayer`) effectue un fondu croisé de **2 secondes** entre les pistes.
Quand une zone est ouverte, sa musique démarre. À la fermeture, le contexte passe
à la prochaine zone ouverte ou s'arrête progressivement.
