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

## Politique : n'y garder que ce qui sert

Ce dossier ne contient que les **24 pistes `.mp3` référencées par le code** (via
`MUSIC_TRACKS`, `JINGLES` et `SE_SOUNDS` dans `modules/ui/audio.js`), soit ~25 Mo.
Il a été élagué : il avait été importé en bloc (945 fichiers, ~43 Mo) depuis
`C:\DEV\repos\pokeforge\game\music`, dont 920 que le moteur ne charge jamais — des
`.wav`, `.ogg` et `.mid` qu'un `HTMLAudioElement` ne sait pas jouer (pas de MIDI),
et des `.mp3` jamais branchés. L'import d'origine et l'historique git les conservent.

**Ajouter une piste** : déposer le `.mp3` ici *et* le référencer dans
`modules/ui/audio.js` **sous forme de chaîne littérale** (un chemin construit
dynamiquement échapperait au scan du build et ne ferait 404 qu'en production).

Deux garde-fous empêchent le dossier de regonfler sans qu'on s'en aperçoive :

| Cible | Mécanisme |
|---|---|
| itch.io | `collectReferencedMusic()` (`tools/build-itch.js`) ne copie que les pistes référencées et la validation refuse une piste manquante ou en trop |
| pokegang.sterenna.fr | excludes rsync `*.wav`, `*.mid`, `*.ogg` dans `.github/workflows/deploy-ovh.yml` |

Détails dans `docs/itch-build.md`.

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
