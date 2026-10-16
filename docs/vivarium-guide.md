# Valeurs par défaut et aide du vivarium

Sans préférence enregistrée, le vivarium utilise Donjon Mystère et True size.
Le décor QG reste le fond par défaut ; un fond personnalisé déjà enregistré
reste choisi. Les choix explicites 2D, HGSS ou taille standard sont conservés,
y compris au chargement d’une ancienne sauvegarde. Aucune migration de format
ni écriture automatique n’est nécessaire pour consulter le vivarium.

Le bouton « ? » dans le vivarium de la page Gang (également disponible dans
la fenêtre du jeu) propose cinq étapes : sprites, taille, fond, sources des
Pokémon, visites/événements. Chaque étape affiche une fenêtre avec Précédent,
Suivant/Terminer et une flèche vers le contrôle réel. Le texte existe en FR/EN.

Le module `gang/vivariumTour.js` est importé uniquement au clic. Aucun asset,
service, intervalle, boucle d’animation ou état de tutoriel persistant n’est
ajouté. Le cadre et la flèche se repositionnent au scroll/redimensionnement
uniquement pendant l’ouverture du guide. L’aide ouvre temporairement le détail
de taille puis restaure son état ; elle ne change aucun réglage ni sauvegarde.

Échap ou × ferme le guide ; Tab reste dans la boîte de dialogue et le focus
revient au bouton ?. La fermeture/changement du panneau nettoie l’aide et ses
listeners. Le module n’est pas demandé par le renderer OBS, dont les anciens
snapshots sans préférences restent compatibles (PMD, taille standard).

Validation : 48 suites Node, contrôles événements/appels morts/cache-busting,
parcours Chromium guide desktop/mobile, QG, visiteurs et PMD. Le parcours
`tools/check-vivarium-tour-browser.mjs` vérifie les valeurs par défaut, le
chargement à la demande, les cinq flèches, retour/suivant, les limites du popup
mobile, Tab/Échap, la restauration du focus, l’absence d’écriture, le maintien
des choix explicites après rechargement et le nettoyage. Les profils de test
sont isolés des sauvegardes des joueurs. Build itch valide : 51,02 Mo,
2643 entrées, pas d’upload itch. Les essais mobiles utilisent un viewport
Chromium ; aucun benchmark sur téléphone physique. Compteur tokens exact
indisponible dans cette session.
