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
