# Lisibilité des combats et arrivée du chef

Le résultat victoire/défaite est ancré en bas du viewport de zone, au-dessus
des commandes, au lieu de son centre. Le bandeau de difficulté est retiré au
bilan ; le HUD utilise une grille compacte qui reste dans la largeur disponible.
La fenêtre conserve sa taille et les commandes vitesse/fuite/fermeture restent
accessibles. Les Pokémon et les tours de combat ne sont pas modifiés.

Avant un combat manuel, le chef est affecté à la zone puis son élément DOM est
préparé synchroniquement, avant le verrou du replay. L’ancien élément de la
zone précédente est nettoyé ; une ancre absente dans une zone déjà assignée
est réparée. Aucun timer ou effet de trajet supplémentaire n’est nécessaire.
Un replay automatique qui possède encore l’ancre du chef empêche sa mutation.
Le raid manuel ne consomme son cooldown que si le combat a effectivement ouvert.
Les raids automatiques conservent leur fonctionnement.

Validation : `node tools/check-combat-layout-browser.mjs` vérifie dans Chromium
l’arrivée avant le replay, l’ancre conservée, les doublons, le verrou et le
cooldown, les positions du HUD/bilan desktop et mobile, les commandes, une
ancre manquante et un chef non assigné. Les images externes sont des substituts
dans ce test de disposition ; il ne valide pas leur apparence artistique.
Les 46 suites Node, check-events et cache-busting passent. Build itch valide.
