# Placement, profondeur et inspecteur du vivarium

Ce lot prolonge les personnages HGSS de la PR #99. Il corrige les destinations
occupées et ajoute un évitement local, sans reconstruire les déplacements ou
modifier les règles du jeu. La caméra et la carte du QG restent hors périmètre.

## Essayer le panneau sur la preview

Ouvrir <https://lab.sterenna.fr/pokegang-preview/gang/>, puis déployer
**« 🛠 Vivarium · Dev »**, sur le côté droit de la fenêtre. Le panneau est
également disponible sur localhost et sur la vue OBS du lab. Il est replié
par défaut, ne modifie aucune sauvegarde et se ferme avec Échap.

- **Empreintes au sol**, vert : ellipses utilisées pour l'espacement.
- **Enveloppes des sprites**, bleu : dimensions maximales des images entre
  les animations, comprenant leurs marges transparentes ; pas des collisions.
- **Zones de clic**, orange : boîtes logiques des Pokémon résidents cliquables.
- **Ancrages et profondeur** : point d'appui au sol et rang d'affichage `z`.
- **Destinations réservées**, rose : trajet vers la cible de déplacement.
- **Bande de déplacement** : zone théorique des points d'appui ; les marges
  propres aux espèces peuvent la réduire.
- **Inspecter un acteur** : nom, coordonnées des pieds, empreinte, direction
  et état marche/repos. Les compteurs indiquent les passages et évitements.

L'autorisation repose sur `modules/core/devFeatures.js` : lab et hôtes locaux
connus uniquement. Le module et sa feuille de style sont chargés dynamiquement
sur ces hôtes. Un paramètre `?debug=1` ne les active pas en production ou sur
itch.io. Replier le panneau retire le canvas, libère son buffer et arrête son
échantillonnage si aucun acteur ne se déplace.

## Règles de placement

`gang/vivariumLayout.js` définit le repère des pieds `(24,40)` et des empreintes
elliptiques. Le renderer fournit une approximation bornée de l'empreinte selon
les dimensions de l'espèce ; la hauteur de l'image n'est pas une profondeur
physique. Les sprites classiques utilisent une empreinte de secours.

Chaque destination candidate est vérifiée contre les positions visibles et
les destinations déjà réservées, y compris lors d'une approche vers un voisin.
Le nombre d'essais est borné à 12. Dans une scène trop dense, le candidat le
moins encombré est conservé : aucune boucle de recherche infinie.

Pendant la marche, les voisins proches sont trouvés par cellules de 64 px.
Un résident qui se rapproche trop peut s'arrêter puis choisir une autre cible
après une courte pause. Le départ d'une zone déjà encombrée reste permis.
Les caméos conservent leur traversée et les rencontres restent possibles.
Il s'agit d'un évitement souple : les silhouettes peuvent se recouvrir selon
la perspective, surtout si le viewport est saturé, sans rendre les acteurs
physiquement rigides ou créer un moteur de pathfinding.

Le redimensionnement conserve les positions relatives, puis réespace seulement
les empreintes devenues trop proches. Les mises à jour OBS identiques gardent
les mêmes nœuds, positions, directions et animations.

## Profondeur et couches

La profondeur suit les **pieds réellement interpolés par CSS**, et non la
destination future. Le rang reste stable à égalité. Les écritures de `z-index`
ne sont effectuées que si le rang change.

- Acteurs : couche 1, avec leur propre ordre de profondeur.
- Météo : couche 3.
- Bulles et badges : couche 4, hors des contextes d'empilement des acteurs.
- Contrôles : couche 5 ; teinte d'ambiance : couche 10.
- Canvas de debug : couche 11, sans capture des clics ; panneau dans la page.

Les annotations reprennent les transitions CSS de leur acteur. Elles suivent
donc les mouvements sans calcul de position de badge à chaque frame.

## Budget et vérifications

Un seul timer de placement à **8 Hz maximum**, actif pendant un déplacement ou
l'inspection. Il est suspendu quand la page est masquée, et annulé au démontage.
Une scène immobile avec le panneau replié n'échantillonne pas les positions.
La boucle de frames PMD/HGSS reste indépendante et partagée, inchangée.

Les lectures de positions sont groupées avant les écritures de profondeur.
Le scan de rencontres existant lit désormais chaque résident une seule fois
par passage, avec recherche locale. Aucun service, appel réseau de gameplay,
asset graphique ou dépendance n'est ajouté. En production, les fichiers de
debug ne sont pas téléchargés ; le module de placement pèse environ 9 Ko avant
compression HTTP.

```sh
node tools/test-vivarium-layout.mjs
node tools/check-vivarium-layout-browser.mjs
```

Le script Chromium utilise les variables `POKEGANG_PLAYWRIGHT_PATH` et
`POKEGANG_CHROMIUM_PATH`, ainsi que `POKEGANG_LAYOUT_BASE_URL` pour tester le lab
publié. Il vérifie 22 Pokémon PMD normaux/shiny, le placement initial, les
annotations séparées, l'inspecteur desktop/mobile, un croisement CSS réel,
une scène dense en mouvement pendant six secondes avec ses timers naturels,
le nettoyage et l'absence de téléchargements de debug sur une origine de
production simulée. Le reste du scénario utilise des timers de trajet contrôlés.
Les captures sont dans `coverage/vivarium-layout-debug-*.png`.

Ces mesures ne constituent pas un benchmark FPS sur téléphone physique.
Le build itch est vérifié séparément ; la limite de nombre de fichiers HTML5
précédemment signalée pour le catalogue PMD reste à traiter avant un upload itch.
