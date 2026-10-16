# Personnages vus du dessus dans le vivarium

Les caméos compatibles utilisent les planches HGSS/DPPt de PurpleZaffre.
Les portraits de face existants restent utilisés dans leurs bulles de dialogue.
Les textes contextuels, icônes de Pokémon/œuf, pauses, vitesses et probabilités
d'apparition sont conservés. Les caméos restent non cliquables, comme auparavant.

Cette intégration ne change ni les portraits hors vivarium, ni les Pokémon,
ni les sauvegardes. Elle n'ajoute pas le troisième mode Pokémon HGSS.

## Données et rendu

- `gang/characterSprites.js` résout les identités : 33 planches, alias de classes
  équivalentes et variantes Gen 1–4 connues. Une identité inconnue conserve son
  portrait existant ; un favori Pokémon n'est jamais traité comme un personnage.
- Le snapshot ajoute seulement le champ facultatif `trainerKey` aux caméos.
  Les anciens snapshots sont résolus depuis le nom de fichier du portrait.
  Aucune donnée de jeu complète, authentification ni localStorage supplémentaire
  n'est nécessaire pour les ressources publiques dans OBS.
- `gang/pmdSprites.js` expose une petite entrée de métadonnées d'animation
  réutilisable. Pokémon et personnages utilisent **le même RAF et le même LRU**,
  avec une clé de cache fondée sur l'URL complète (les deux catalogues sont séparés).
- La planche contient 4 directions et 4 poses. Le repos conserve une pose fixe
  dans la dernière direction ; la marche avance toutes les 150 ms. Les diagonales
  sont ramenées aux directions cardinales par le renderer partagé. L'ancrage des
  pieds reste `(24,40)` dans l'enveloppe de déplacement existante.
- Les images manquantes ou invalides gardent le portrait de secours. La boucle
  est suspendue en page masquée et avec `prefers-reduced-motion`; le démontage
  du panneau détruit également les acteurs de personnages et vide le cache.

## Coût mesuré

33 PNG, **103 861 octets au total** (environ 101 Kio), plus les petites
métadonnées. Le pack source complet n'est pas inclus. La réduction exacte ×2
des planches sources conserve leurs pixels d'origine ; les PNG runtime sont
en 128 × 128 et rendus avec `image-rendering: pixelated`.

Une seule requête de planche par identité réellement affichée ; Idle et Walk
partagent ce téléchargement. **Aucune planche de personnage téléchargée à
l'ouverture**, aucun nouvel intervalle, aucune boucle par agent. Le cache
global reste borné à 64 planches hors ressources encore actives. Chaque planche
de personnage représente environ 64 Kio de pixels RGBA décodés, hors surcoût
du navigateur. Aucun appel serveur supplémentaire pour le gameplay.

Le test Chromium affiche cinq identités + un Pokémon PMD, observe cinq requêtes
PNG de personnages, un seul RAF, puis zéro RAF/timer après démontage. Ce sont
des mesures de requêtes et de cycle de vie, pas un benchmark CPU/FPS sur mobile
physique. Les captures sont produites dans `coverage/` (ignoré par Git).

## Validation

```sh
node tools/test-vivarium-characters.mjs
node tools/test-pmd-sprites.mjs
node tools/check-vivarium-characters-browser.mjs
POKEGANG_PMD_REAL_ASSETS=1 node tools/check-vivarium-pmd-browser.mjs
```

Les scripts Chromium nécessitent `POKEGANG_PLAYWRIGHT_PATH` et éventuellement
`POKEGANG_CHROMIUM_PATH`. Le test de personnages décode les vrais PNG et anime
leurs frames dans Chromium, mais déclenche explicitement les timers de trajet
pour contrôler les apparitions. Les portraits de ce test sont des fixtures ;
les portraits du jeu ne sont pas remplacés. Les tests PMD existants couvrent
aussi les sources, les rencontres, le clic, le fond, le mobile et les sauvegardes.

Le build itch inclut automatiquement ce répertoire d'assets. La limite de
nombre de fichiers de l'hébergement HTML5 itch, déjà signalée pour le catalogue
PMD complet, reste à traiter séparément ; un ZIP généré n'est pas une preuve
d'acceptation par itch.io.

## Suite conseillée pour garder un vivarium léger

1. **Placement et profondeur** : corriger le regroupement observé dans l'issue
   #98 par des empreintes simples et des destinations moins concentrées.
   Réutiliser les scans existants, pas de solveur physique ni de pathfinding.
   Mettre à jour l'ordre visuel seulement lorsqu'il change, dans une tâche commune.
2. **Décor statique** : partir d'une esquisse de QG puis d'un fond compressé,
   sans effets ou boucles supplémentaires. Les bâtiments préparent la carte.
3. **Carte de QG simple** : matérialiser pension/PC/repos et leurs occupations
   avec les données existantes. Commencer en lecture seule, avec des zones fixes.
4. **True size** : table locale des tailles et échelle calculée au changement
   d'option ; aucun appel Pokédex à l'exécution ni recalcul par frame.
5. **Mode Pokémon HGSS supplémentaire** : réutiliser le renderer, importer
   seulement les ressources utiles et annoncer sa couverture partielle.

Le déplacement de caméra reste hors de ce lot. Les crédits et conditions sont
dans [CREDITS.md](../assets/vivarium_characters/CREDITS.md).
