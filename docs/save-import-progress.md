# Correctif export/import : arènes et quêtes

Le fichier JSON exporté contient bien `zones`, `missions` et les états des
quêtes légendaires. La perte reproduite se produit lors du nettoyage optionnel
de l’import depuis l’accueil : `ZONES` contient seulement les régions activées
dans la partie courante, pas toutes les zones connues de la version. Avant de
charger une partie, les arènes Johto/Hoenn/Sinnoh peuvent donc être déclarées
obsolètes et supprimées, même si elles existent dans les fichiers de données.

`state/zoneCatalog.js` rassemble les quatre catalogues sans activer de région.
L’aperçu d’import et le nettoyage utilisent désormais cette même définition.
Les zones réellement retirées peuvent toujours être nettoyées. Aucune nouvelle
version de sauvegarde ou requête réseau n’est nécessaire.

Les confirmations des deux imports (accueil et partie active) sont également
placées au-dessus de leur aperçu pour permettre un clic normal.

Validation :

- `node tools/test-save-import-progress.mjs` : 34 arènes des quatre régions,
  victoires/cooldowns/compteurs/revenus, nettoyage d’une vraie zone inconnue,
  missions uniques/quotidiennes/hebdomadaires/horaires et toutes les familles
  de quêtes légendaires, inventaire de quête, deuxième cycle et absence de
  mutation à l’export/validation.
- `node tools/check-save-import-browser.mjs` : véritable téléchargement JSON,
  sélection de fichier depuis l’accueil, nettoyage explicitement activé,
  confirmation au clic, import dans un slot, démarrage réel sur ce slot puis
  import en cours de partie. Profil QA isolé ; aucune sauvegarde joueur utilisée.
  Ce parcours passe en local et sur la preview publique du lab. Les cinq fichiers
  runtime du patch sont contrôlés par SHA-256 après transfert.
- Les tests vérifient la conservation des quêtes non expirées. Les resets
  normaux à échéance restent inchangés ; aucune logique de quête n’est modifiée.

Pour récupérer une progression déjà supprimée par un ancien import, réimporter
le fichier exporté original après ce correctif. Une sauvegarde réexportée après
la perte ne contient plus nécessairement ces informations : le patch ne peut
pas inventer les victoires manquantes.
