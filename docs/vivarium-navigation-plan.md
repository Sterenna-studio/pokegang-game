# Préparation des murs et routes du QG

Cette étape est planifiée ; le fond actuel reste une image sans collisions
avec les bâtiments. Ne pas présenter ses murs visuels comme déjà bloquants.

La géométrie sera déclarée dans un petit module local associé à la scène QG,
séparé du SVG : murs/obstacles en rectangles ou polygones normalisés [0–1],
routes en segments et quelques points de passage (carrefour, entrées, cours).
Les identifiants existants `pc`, `pension`, `rest`, `training` restent stables.
La salle `rest` est bien la salle d’événements, ouverte aux agents affectés.

Les unités normalisées seront converties au chargement/redimensionnement,
sans analyse d’image, requête serveur, calcul par pixel ou nouvelle simulation.
Les collisions utiliseront l’empreinte au sol du personnage, pas l’enveloppe
graphique d’un grand Pokémon, pour élargir les obstacles de la marge nécessaire.

Le choix borné des destinations et les transitions CSS restent en place.
L’intégration se fera dans `_pickTarget` et les étapes de caméo : vérifier le
segment complet depuis la position réelle vers chaque cible ; une destination
libre ne suffit pas si la ligne droite traverse un mur. Relier les lieux par
quelques points de passage sûrs et préétablis, puis visiter les points dans
l’ordre. Pas de recherche globale de chemin à chaque frame.

En cas de trajet bloqué, reprendre quelques candidats au maximum, ou rester
en Idle et réessayer plus tard ; ne jamais choisir un candidat traversant un
mur comme solution de secours. Les résidents restent dans leurs cours et les
visiteurs empruntent les allées pour atteindre leur lieu. Les agents gardent
leurs affectations réelles : seules leurs représentations cosmétiques circulent.
Le survol de Ho-Oh sera explicitement exempt des obstacles terrestres.

Le décor personnalisé reste compatible, sans murs invisibles issus du QG.
Les snapshots OBS réutiliseront la même géométrie publique locale à partir de
`scene: 'hq'` ; aucune table serveur ou information de sauvegarde supplémentaire
n’est nécessaire. Le panneau dev pourra dessiner les murs, empreintes élargies,
routes et trajet choisi uniquement lorsqu’il est ouvert.

Vérifications à prévoir lors de l’ajout : points de départ/arrivée et segments
hors obstacles, passage d’une entrée, changements de lieu via le carrefour,
agents affectés, groupes denses, bulles attachées pendant les étapes, True size,
mobile/redimensionnement, changement de fond, survol et anciens snapshots OBS.
