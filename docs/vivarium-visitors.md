# Visiteurs interactifs

Tous les caméos du vivarium répondent au clic ou à Entrée/Espace avec leur
réplique contextuelle, ou un salut pour un Pokémon sans dialogue. Leurs
bulles automatiques avec portrait classique restent disponibles.

Ho-Oh est aussi proposé comme événement dans le pool existant, sans nouveau
timer de simulation : tirage habituel toutes les 45–90 secondes avec 50 %
de chance de visite, puis un type tiré au hasard. Il peut aussi être un favori
de passage. Il traverse vers 35 % de la hauteur, au-dessus du bord inférieur.
Un Ho-Oh résident conserve ses interactions de résident et ne donne pas d’aile.

Chaque activation d’un Ho-Oh visiteur accorde une Arcenci’Aile dans l’inventaire
et multiplie sa vitesse par 1,4, jusqu’à ×8. Le trajet CSS est repris depuis la
position courante, sans téléportation et sans empiler des timers. Les bulles
répétées se remplacent. Le personnage continue sa traversée puis disparaît.
Les autres visiteurs conservent leur vitesse, leurs pauses et leurs dialogues.

Dans le jeu principal, la récompense émet ITEM_RECEIVED comme les drops de
zone : la quête Ho-Oh progresse une seule fois. Dans la page cosmétique, qui
n’exécute pas les systèmes du jeu, le callback recharge d’abord la sauvegarde
fraîche, ajoute l’aile et applique la même règle de quête (étape 2, cinq ailes,
puis étape 3). Il ne réécrit pas l’ancien inventaire de la page cosmétique.
Le format des sauvegardes reste identique.

Le renderer de snapshots est toujours en lecture seule, même si une ancienne
variable globale state subsiste : aucun inventaire, localStorage ou callback
de récompense n’est consulté. Les réactions restent purement visuelles dans OBS.

La zone interne `rest` conserve son identifiant pour les anciens snapshots,
mais s’intitule désormais Salle d’événements. Tous les agents peuvent la
visiter, affectés ou au repos. Le label n’annonce plus un effectif d’agents
permanents qui ne correspondrait pas aux visiteurs effectivement présents.

Coût : aucun nouvel asset, service distant, intervalle, boucle RAF ni scan de
collision. Les listeners sont attachés aux seuls visiteurs présents ; les
timeouts restent dans le registre du vivarium et sont annulés à son arrêt.
True size relève ses plafonds à 144px visibles/192px de frame, avec toujours
28px/mètre et le même calcul à l’attachement/changement de mode uniquement.

Validation : `node tools/test-vivarium-visitors.mjs` et
`node tools/check-vivarium-visitors-browser.mjs` (Chromium isolé, vrais PNG,
longs timers de visite pilotés). Ce dernier vérifie clic, clavier, accélération,
récompense persistée sur sauvegarde fraîche, passage de quête 2→3, bulle unique,
cible mobile, snapshots sans localStorage et annulation des timers.

Les 48 suites Node passent, ainsi que les parcours Chromium visiteurs, QG,
personnages, placement/debug et PMD. Contrôles d’événements/appels morts et
cache-busting valides. Build itch généré : 51,02 Mo, 2641 entrées ; pas
d’upload itch. Les tests mobiles sont des viewports Chromium, pas un essai
sur téléphone physique. OBS est testé par snapshots injectés, sans connexion
réelle au service cloud. Aucun compteur de tokens exact n’est exposé.
