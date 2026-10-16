# QG cosmétique et modes d’affichage

Le décor original `assets/vivarium/hq.svg` est un SVG statique de 3,4 Ko sans
scripts, tuiles empruntées ni ressources externes. Ses zones normalisées sont
déclarées dans `modules/systems/vivariumZones.js`. Un fond personnalisé choisi
auparavant reste sélectionné ; le sélecteur Décor permet d’opter pour le QG.

Pension et formation suivent les identifiants déjà présents dans l’état du jeu,
même pour un Pokémon aussi présent en vitrine. Les autres résidents sont à
l’accueil/PC. L’infirmière passe à la pension, le scientifique à la formation,
les agents au repos dans leur espace. Les autres visiteurs passent à l’accueil.
Le jeu conserve sa simulation et ses données. Aucun appel serveur supplémentaire.
Les compteurs sont calculés lors de la construction du snapshot uniquement.

## True size

Préférence facultative `cosmetics.vivariumTrueSize`, absente = taille standard.
Table locale des 493 espèces : hauteurs PokéAPI en décimètres, révision et SHA
documentés dans `assets/vivarium/sizes-provenance.json`. Licence de PokéAPI et
attribution conservées dans `assets/vivarium/PokeAPI-LICENSE.md` (Paul Hallett
et contributeurs). Unités : https://pokeapi.co/docs/v2#pokemon.
Régénération : `python tools/build-vivarium-sizes.py chemin/pokemon.csv` (Pillow).

Référence visuelle 28 pixels/mètre, hauteur visible limitée à 16–88 pixels,
enveloppe de frame limitée à 128 pixels pour éviter les grandes marges vides.
Les limites privilégient la lisibilité ; les longueurs du Pokédex, notamment
les Pokémon serpentins, ne constituent pas une simulation anatomique.
Les mesures alpha des sprites PMD sont calculées hors ligne. L’échelle reste
constante entre Idle et Walk et n’est pas recalculée à chaque frame.
Les images 2D de secours utilisent leur boîte carrée en conservant leurs
proportions ; leur hauteur apparente peut différer à cause de marges internes.

Les réglages d’affichage sont transportés avec les résidents et caméos du
snapshot public. Les anciens snapshots gardent PMD/taille standard. Une mise
à jour identique conserve les éléments DOM et la phase des animations.
Les préférences restent limitées au vivarium ; pas de migration de sauvegarde.

## Pokémon HGSS

Troisième choix du sélecteur natif. 24 variantes du pack PurpleZaffre :
23 espèces normales et Léviator shiny. Crédits, exclusions et SHA-256 dans
`assets/pokemon_hgss/`. Le catalogue est incomplet ; chaque variante absente
reprend directement le sprite classique de `pokeSprite()`. Aucun shiny n’est
remplacé par un Pokémon normal. Les personnages gardent leur renderer HGSS.
Les animations partagent la boucle et le cache LRU de 64 planches du renderer
existant. Une seule planche par variante, demandée uniquement à son affichage.
Le repos est une pose fixe et ne maintient pas seul une boucle d’animation.
True size fonctionne aussi dans ce mode. Les autres écrans du jeu sont inchangés.

## Validation et livraison

Branche `feat/vivarium-qg-modes`, empilée sur `feat/vivarium-layout-debug`
(PR #100, elle-même dépendante de #99). Étapes poussées séparément :
`c8d03e3` décor, `fe43a10` activités, `a44a354` True size, `ae34848` Pokémon HGSS.

- 45 suites `tools/test-*.mjs` passent, dont le cache-busting et les SHA des assets.
- `node tools/check-events.js` passe.
- Quatre parcours Chromium locaux passent : PMD, personnages, placement/debug,
  QG/tailles/HGSS. Ils utilisent des PNG réels, une sauvegarde de test isolée,
  des scénarios OBS sans accès localStorage et des viewports desktop/mobile.
- Parcours QG et placement/debug exécutés aussi sur la preview publique.
- `node tools/build-itch.js` : build valide, 51,01 Mo, 2639 entrées. Pas d’upload
  itch. La limite de fichiers HTML5 itch déjà signalée pour le catalogue PMD
  reste à résoudre avant une publication sur cette plateforme.
- Pas de benchmark sur téléphone physique ni validation d’une connexion OBS
  réelle à Supabase sur le lab : les snapshots publics sont exercés directement.

Preview : https://lab.sterenna.fr/pokegang-preview/gang/.
Patch ciblé de 44 fichiers runtime vérifié par SHA-256 après transfert.
Pas de fusion automatique ni publication en production.
Captures QA générées sous `coverage/vivarium-qg-{desktop,mobile}.png` et
`coverage/vivarium-hgss-mobile.png` (non versionnées).

Le décor ne fait aucun calcul par frame. Les tailles sont des constantes
locales et l’échelle est fixée à l’attachement/changement de mode. Les nouveaux
PNG HGSS totalisent 60 906 octets. Aucun chargement global du catalogue et
aucune boucle supplémentaire par Pokémon. Les empreintes et la profondeur
réutilisent le gestionnaire 8 Hz existant, suspendu lorsque la scène est inactive.

Les bilans tokens ont été communiqués après chaque étape : le compteur de
consommation exact n’est pas exposé par cette session, aucun total chiffré
fiable n’est donc annoncé.
