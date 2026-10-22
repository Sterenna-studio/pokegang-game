# Tableau de bord de la preview

URL : https://lab.sterenna.fr/pokegang-preview/tools/.

- Galerie historique : 14 dispositions de la base, comparables par paires.
- Laboratoire de sprites : dex 1–493, normal/shiny, Idle/Walk, huit directions
  demandées (quatre réelles pour HGSS), True size borné, pose fixe. Renderer du
  vivarium réutilisé avec une seule boucle, cache de planches limité et suspension
  quand la page est masquée. Les PNG ne sont chargés que pour le dex affiché.
  La colonne 2D utilise les images classiques publiques de PokéAPI ; les images
  PMD/HGSS sont les ressources locales du jeu. Aucun état joueur n’est utilisé.
- Comparateur de sauvegardes : deux fichiers locaux, lecture seule. Résumé des
  arènes/récompenses/quêtes et différences de progression, ou de tous les champs.
  Affichage limité aux 300 premières différences ; les champs sensibles sont
  masqués. Un changement de période de quête peut expliquer un reset légitime.
  Les données des fichiers ne sont ni transmises ni importées dans le jeu.
- Diagnostic sur demande : HEAD des ressources publiques critiques, avec
  vérification du code HTTP et du type MIME, sans chargement de catalogues.
- Accès au Screenshot Studio, à son album et à l’éditeur de zones existants.

Le tableau de bord et les nouveaux laboratoires vérifient l’hôte avec
`devFeaturesEnabled()`. Le répertoire `tools/` reste exclu du déploiement de jeu
en production et du build itch. Le studio publié séparément à `/studio/` conserve
son fonctionnement. `tools/deploy-ovh-previews.ps1 -Target web` publie une liste
explicite de fichiers de ces outils dans le lab ; aucun script de build, fixture
de sauvegarde ou fichier de travail privé n’est publié.

Pour une mise à jour des outils sans retransférer le jeu :
`./tools/deploy-ovh-previews.ps1 -Target web -ToolsOnly`.
La liste publique est dans `tools/lab-public-files.json`. Les outils sont
transférés en une archive compressée, pas fichier par fichier.

Validation : `node tools/test-lab-tools.mjs` (pertes de progression, masquage,
limite des différences et whitelist) et `node tools/check-lab-tools-browser.mjs`
(diagnostic des 12 ressources, fichiers JSON locaux, sprites réels PMD/HGSS,
chargement à la demande, mobile, absence d’accès aux sauvegardes, garde d’hôte).
Le parcours navigateur passe en local et sur le lab. Les 48 suites Node,
check-events, check-dead-calls et le build itch passent.
