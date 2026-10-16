# Galerie de la base — preview uniquement

Page : `tools/gang-base-history/index.html`. Réservée à `lab.sterenna.fr` et
aux hôtes locaux par `devFeaturesEnabled()`. Ce répertoire sous `tools/` n’est
pas copié par le build itch ni par le déploiement runtime du jeu. Le publier
explicitement dans la preview, sans l’ajouter aux entrées de production.

Dix étapes intégrées d’avril à octobre 2026 : base initiale, refonte de mai,
V2 à trois colonnes, équipe centrale, V1 compacte, ajustements de juillet,
nids, carrousel, étagère et pile commune d’œufs prêts. Les corrections mineures
et traductions sans changement structurel ne sont pas dupliquées.
Quatre maquettes exploratoires complètent la galerie : Pokéchill V2, QG
territorial, refonte QG V2 et Gang Base V3. Elles sont identifiées comme prototypes.

Ce sont des reconstitutions : HTML et CSS extraits de chaque commit identifié
dans `versions.json`, avec les fonctions/data/sprites actuels et une fixture
commune de démonstration, jamais une sauvegarde joueur. L’état est adapté pour
montrer les incubateurs retirés, les nids et les agents. Certains éléments
peuvent utiliser les fallbacks graphiques si la source distante est indisponible.
Les images ne sont pas des captures d’archives d’époque ni des versions jouables.
Les crédits des graphismes utilisés par PokéGang restent applicables.

Régénérer avec Chromium/Playwright et Pillow (compression WebP des grandes maquettes) :

```powershell
node tools/build-gang-base-history.mjs
```

Utilise `POKEGANG_PLAYWRIGHT_PATH` et `POKEGANG_CHROMIUM_PATH` comme les autres
outils navigateur. Le générateur exécute les anciens renderers uniquement dans
des profils QA isolés. La page publiée charge un JSON et une ou deux images,
sans moteur de jeu, localStorage, authentification ni requêtes serveur de gameplay.
Les PNG originaux des grandes maquettes sont conservés sous
`coverage/gang-base-history/` ; leurs WebP compressés sont publiés dans la galerie.
