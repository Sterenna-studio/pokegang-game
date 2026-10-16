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
