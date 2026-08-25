# PokéGang Screenshot Studio

Outil interne pour fabriquer rapidement des captures d'écran de PokéGang sans devoir préparer ou rejouer une vraie partie.

Le studio utilise les styles et assets du repo, mais **ne charge pas le moteur du jeu** : les scènes sont des états de communication déterministes. Il ne lit ni ne modifie les saves `pokeforge.*`, ne lance pas Supabase et n'émet pas d'analytics GA4.

## Accès hébergé

Après merge sur `main`, le déploiement OVH publie uniquement ce sous-outil interne à l'adresse :

```text
https://pokegang.sterenna.fr/studio/
```

Il n'est pas lié depuis l'interface publique du jeu. Le reste de `tools/` reste exclu du déploiement.

## Lancer en local

Servir la racine du repo (les modules ES ne doivent pas être ouverts en `file://`) :

```bash
py -m http.server 8080
```

Puis ouvrir :

```text
http://localhost:8080/tools/screenshot-studio/
```

## Utilisation

La colonne de gauche permet de passer immédiatement d'une scène à l'autre. Le bandeau supérieur permet de choisir :

- FR ou EN ;
- 1280×720, 1920×1080, 1080×1080, 1080×1350 ou 1200×1600 ;
- une taille personnalisée ;
- animations actives ou figées ;
- replay de la scène.

`Ouvrir clean` ouvre uniquement le faux écran de jeu, aux dimensions exactes demandées, sans l'interface du studio. C'est la vue prévue pour faire la capture navigateur/OS.

Raccourcis : `←` / `→` scène précédente/suivante, `R` rejoue, `F` ouvre la vue clean.

Les paramètres sont conservés dans l'URL (`scene`, `lang`, `w`, `h`, `anim`) ; `Copier le lien` permet donc de garder un cadrage précis ou de le partager.

## Album marketing

Le lien `Album` du studio ouvre `tools/screenshot-studio/album.html`. Cette page
réunit les covers, bannières, arrière-plans et sources pixel-art conservés pour
la communication. Chaque fichier présent dans `tools/screenshot-studio/album/`
doit être référencé par une carte de l'album.

Les noms suivent la forme `categorie-numero-description.ext`, en minuscules et
avec des tirets. Les noms automatiques de générateur, timestamps et UUID ne sont
pas conservés. Avant d'ajouter un export, comparer son hash aux fichiers déjà
présents afin de ne pas archiver deux copies identiques.

## Scènes incluses

Le premier pack couvre l'introduction (première capture, embuscade Rocket, Giovanni, transfuge), la révélation progressive des zones et du Pokédex, les principaux écrans de gestion, les feedbacks de capture/déblocage et les nouveaux combats Groudon/Kyogre.

## Ajouter une scène

Les presets vivent dans :

```text
tools/screenshot-studio/scenes.mjs
```

Ajouter une entrée à `SCENES` avec un `id` unique, une catégorie, les textes FR/EN et une fonction de rendu. Préférer les helpers existants (`shell`, `chip`, `poke`, `trainer`) afin de garder le rendu cohérent.

Puis vérifier :

```bash
node tools/test-screenshot-studio.mjs
```

Le test vérifie les ids, la scène par défaut et le rendu FR/EN de chaque preset.
Il contrôle aussi que tous les visuels de l'album sont référencés, correctement
nommés et sans doublon binaire.

## Important

Le studio reste volontairement dans `tools/`. Le build itch ne copie que les dossiers runtime (`index.html`, `app.js`, `css/`, `data/`, `modules/`, `state/`, `assets/`, `gang/`) : le Screenshot Studio n'augmente donc pas la taille du jeu publié.

Le workflow OVH traite ce dossier comme une exception explicite et le synchronise vers `/studio/`; aucun autre outil interne n'est exposé par cette règle.

Les scènes sont **fausses mais fidèles** : elles servent à la communication et non à tester la logique gameplay. Pour un bug ou une validation fonctionnelle, utiliser le vrai jeu et les tests runtime.
