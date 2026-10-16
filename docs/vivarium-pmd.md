# Vivarium : renderer PMD et état de livraison

## État

Après validation du prototype Lab, le propriétaire a demandé la publication en
production dans le vrai vivarium, puis le catalogue complet du jeu. **Les 494
entrées de #0 à #493 sont couvertes, chacune en normal et shiny**, pour Idle
et Walk : 1 976 PNG, 21 524 146 octets, hébergés localement. Toutes les variantes
de la révision choisie disposent des ressources nécessaires. Une espèce ou forme
hors catalogue, une ressource indisponible ou une erreur de chargement conserve
automatiquement le sprite habituel. L'activation
est limitée au renderer du vivarium local et distant ; aucun sprite de PC,
combat, zone ou carte n'est modifié. Aucun déplacement de caméra n'est ajouté.

Le sélecteur **Sprites du vivarium : 2D / Donjon Mystère** en haut du vivarium permet
de basculer entre les deux rendus sans recréer les résidents ni interrompre leurs
déplacements ou interactions. Le choix est mémorisé dans le champ cosmétique
optionnel `vivariumSpriteMode` (`pmd` par défaut pour les anciennes sauvegardes).
Il concerne la page locale `/gang/`, indépendamment du réglage général des
sprites. La vue distante OBS conserve son rendu PMD et ses anciens snapshots.
En mode Donjon Mystère, une indication affiche combien de résidents disposent
de ces animations ; si aucun n'est compatible, elle le signale explicitement.
La couverture complète est vérifiable dans `assets/pokemon_pmd/coverage.json`.
Voir [l'audit des droits et crédits](../assets/pokemon_pmd/CREDITS.md).
Le prototype avec les images originales a été vérifié dans Chromium puis
validé par le propriétaire avant l'activation. L'historique de la préparation
et de la publication Lab reste dans [la documentation QA](pmd-lab-preview.md).

## Modifications

- `gang/pmdSprites.js` : renderer canvas indépendant de l'état de jeu et du
  stockage, huit directions, durées en unités de 1/60 s, Idle/Walk, variantes
  séparées, chargement différé, protection contre les réponses asynchrones
  périmées et fallback sur l'image existante.
- `gang/environment.js` : raccordement aux transitions existantes. Le clic et
  les rencontres figent la position réellement affichée avant de passer en
  Idle ; les déplacements reprennent ensuite. Les visiteurs humains et leurs
  accompagnateurs conservent leur rendu. Seuls les caméos `favorite` sont
  éligibles au renderer Pokémon.
- `modules/systems/vivariumSnapshot.js` : champs d'affichage dérivés `id`, `dex`,
  `shiny`, en conservant `spriteUrl`, nom, niveau, nature et déduplication.
- `gang/gang.css` : positionnement des canvas, pixel art, réaction au clic et
  réduction des animations décoratives selon la préférence système.
- `assets/pokemon_pmd/` : catalogue complet du jeu, PNG, crédits par variante,
  licence publiée, couverture et manifeste de provenance avec SHA-256.
- Deux tests ciblés dans `tools/`.

Les points d'entrée local et OBS restent identiques. Le producteur cloud et
l'Edge Function transportent les objets résidents sans filtrer leurs champs
internes : aucune migration SQL, règle d'accès ou modification Supabase n'est
nécessaire. Les anciens snapshots sans dex restent sur `spriteUrl`.
Les snapshots successifs réconcilient les résidents par id (ou par position
dans la liste et identité d'affichage pour l'ancien format), sans recréer les
nœuds inchangés. Un changement de variante ou d'URL remplace le résident concerné.
Le format de sauvegarde et les préférences générales de sprites sont inchangés.

## Contrat des ressources futures

Le catalogue exporte `PMD_METADATA[dex].normal` et éventuellement `.shiny`.
Chaque variante doit fournir ses propres `Idle` et `Walk`, avec
`{ w, h, n, r, d, ax, ay, file }`. Les chemins sont locaux au répertoire
`assets/pokemon_pmd/`, par exemple `52/Walk.png` et `52/s/Walk.png`.
`d.length === n` et chaque durée est strictement positive. Les dimensions PNG
doivent être exactement `w*n` par `h*r`, contrôlées après chargement.
Une variante absente ou incomplète conserve entièrement le fallback ; un shiny
n'est jamais remplacé par son équivalent normal. Les formes sans entrée
explicitement validée doivent conserver le fallback.

Ordre des directions : Down, DownRight, Right, UpRight, Up, UpLeft, Left,
DownLeft. L'angle vient du vecteur écran réel, sans miroir de la feuille PMD.
Une modification de direction ne réinitialise pas l'animation.
L'ancrage `(ax, ay)` de chaque animation est placé au point local `(24, 40)`
de l'emplacement existant du résident. L'échelle est commune à Idle et Walk
pour une espèce/variante : 2 pixels affichés par pixel source, plafonnée pour
que la plus grande dimension d'une frame ne dépasse pas 88 pixels.

### Géométries vérifiées dans les XML sources

Ces informations factuelles servent à contrôler les hypothèses du renderer ;
elles ne constituent pas un import du catalogue PokéSurvivor.

| Espèce | Idle | Walk | Durées Idle / Walk, en ticks |
| --- | --- | --- | --- |
| #52 | 32×32, 4 frames | 24×32, 4 frames | `[12,12,12,12]` / `[6,10,6,10]` |
| #41 | 32×56, 8 frames | 32×56, 8 frames | `[10,6,6,6,6,6,6,8]` / huit fois `6` |
| #92 | 48×56, 6 frames | 48×64, 12 frames | six fois `10` / douze fois `6` |

Les XML shiny examinés ont les mêmes dimensions et durées pour ces animations.
Les huit lignes et dimensions PNG sont vérifiées par les tests du catalogue.
Les ancrages ont été régénérés depuis les ombres sources et le rendu original
a été testé sur le Lab, puis validé visuellement par le propriétaire.
Sources : `sprite/{0041,0052,0092}/AnimData.xml`, ainsi que leurs variantes
`0000/0001`, à la révision SpriteCollab donnée dans les crédits.

## Performances et cycle de vie

Une seule boucle requestAnimationFrame pour tous les canvas, arrêtée quand
la page est masquée, avec gel de l'horloge pendant cette suspension. En mode
reduced-motion, la première frame reste affichée et aucune boucle PMD ne tourne.
Les déplacements CSS existants sont conservés. Chaque canvas est redessiné
uniquement si sa frame ou sa direction change. Idle et Walk sont chargés à leur
première utilisation ; aucun parcours ni préchargement global du Pokédex.

Cache partagé LRU de 64 feuilles inactives/actives au total, avec exception pour
les feuilles encore utilisées : elles restent épinglées jusqu'au retrait de
leurs acteurs. Ce plafond est donc une cible pour le cache, pas une limite dure
en présence de plus de 64 feuilles actives. Les images évincées libèrent leur
source et leurs callbacks. L'arrêt du panneau détruit les acteurs, vide le
cache, retire les listeners de visibilité/préférence, annule la RAF, déconnecte
ResizeObserver et annule les timers du vivarium. Les timers exécutés quittent
immédiatement le registre ; celui-ci ne croît plus pendant une longue session.

Mesure du test Chromium : cinq résidents dont quatre canvas et un fallback,
huit requêtes de feuilles synthétiques, aucune requête répétée, zéro timer et
zéro RAF après arrêt. Ce résultat ne mesure ni les FPS ni le GPU/mémoire des
vrais assets, et ne remplace pas un essai sur téléphone ou dans OBS/CEF.

## Validation

`node tools/test-pmd-sprites.mjs` couvre directions, durées variables, ancrage,
variantes shiny, chargement partagé, réponse périmée, erreur réseau, éviction,
page masquée, reduced-motion, nettoyage, snapshot dérivé et sauvegarde non mutée.

Le test Chromium utilise une installation existante de `playwright-core` sans
ajouter de dépendance runtime au jeu :

```powershell
$env:POKEGANG_PLAYWRIGHT_PATH = 'CHEMIN_VERS/playwright-core'
# Facultatif si le Chromium attendu par cette installation est déjà installé :
$env:POKEGANG_CHROMIUM_PATH = 'CHEMIN_VERS/chrome-headless-shell.exe'
node tools/check-vivarium-pmd-browser.mjs
```

Pour vérifier les vrais assets du catalogue versionné plutôt que les feuilles
synthétiques, définir `$env:POKEGANG_PMD_REAL_ASSETS = '1'` avant cette commande.
Le parcours local utilise une copie isolée de la sauvegarde de développement :
ses sept résidents sont rendus en PMD dans le vrai `/gang/`. Le sélecteur, sa
persistance, les changements de sources et le nettoyage sont vérifiés.

`node tools/check-pmd-catalog-browser.mjs` vérifie séparément les 988 variantes
et 1 976 feuilles dans Chromium, par lots de seize acteurs, en Idle et Walk et
dans les huit directions. Ce test contrôle le décodage réel, les dimensions,
le cache borné et l'arrêt de la RAF ; il ne remplace pas une revue artistique
de chaque Pokémon.

`python tools/import-pmd-catalog.py` régénère uniquement les ressources des
espèces présentes dans `data/species-data.js`, en résolvant les alias XML et
en préservant les crédits. Les fichiers sources téléchargés restent en cache
dans `coverage/pmd-source-cache/`, sans être ajoutés en bloc au runtime.

Le serveur et les intercepts de ce test ne servent que des formes géométriques
générées en mémoire. Ils ne modifient aucun fichier du catalogue.

| Scénario demandé | Preuve / limite |
| --- | --- |
| 1–3. Miaouss, Nosferapti, Fantominus Idle/Walk | Géométries et PNG vérifiés ; tests synthétiques puis vrais assets ; validation visuelle Lab par le propriétaire |
| 4. Shiny | Variantes originales distinctes, chargement et dimensions testés |
| 5. Espèce indisponible | Fallback testé dans Chromium et en test déterministe |
| 6. Plusieurs Pokémon | Quatre canvas simultanés + fallback dans Chromium, boucle unique en test déterministe |
| 7. Rencontre | Rencontre provoquée, badge affiché et reprise des déplacements dans Chromium |
| 8. Clic en marche | Badge nom/niveau/nature dans Chromium |
| 9. Sources | Sauvegarde de développement avec sept résidents dédupliqués ; vrai sélecteur local, retrait/réajout distant testés dans Chromium |
| 10. Fond | Vrai sélecteur local et mise à jour distante sans recréer les résidents testés |
| 11. Redimensionnement | Repositionnement dans les limites vérifié dans Chromium |
| 12. Mobile | Viewport Chromium 390×844 ; appareil physique non testé |
| 13. OBS | Renderer distant avec accès localStorage interdit et snapshots répétés/anciens ; réseau Supabase réel et application OBS non testés |
| 14. Changement de panneau | Navigation locale vers Musique et primitive d'arrêt distante testées : aucun timer/RAF restant |
| 15. Sauvegardes | Tests round-trip existants + vérification que la construction du snapshot ne mute pas l'état |

Les tests Chromium avec les vraies feuilles passent pour le catalogue validé,
y compris le vrai `/gang/` et le changement de sources. La validation visuelle
du prototype Lab a été confirmée par le propriétaire. Le catalogue est ensuite
étendu à toutes les espèces du jeu ; le mobile physique et OBS réel restent
hors de cette validation.

### Résultats de cette livraison

- Suite complète : **40 fichiers `tools/test-*.mjs` passent**, dont le test PMD
  et le round-trip des sauvegardes.
- Chromium réel : `tools/check-vivarium-pmd-browser.mjs` passe avec le catalogue
  synthétique et les vrais assets versionnés. Ce contrôle reste séparé de la suite sans
  dépendances utilisée en CI.
- `node tools/check-events.js`, `node tools/check-dead-calls.mjs` et
  `node tools/test-data-integrity.mjs` passent.
- `node tools/cache-bust.js` exécuté, puis `node tools/test-cache-bust.mjs` passe.
- `node tools/build-itch.js` passe ses contrôles d'archive : v0.5.2,
  2 562 entrées, 50,82 Mo,
  séparateurs ZIP corrects, configuration privée exclue, FR web / EN itch.
  L'archive générée n'est ni commitée ni publiée.

Cette archive complète dépasse la limite standard itch.io de 1 000 fichiers
HTML5 ([documentation itch.io](https://itch.io/docs/creators/html5#zip-file-requirements)).
La validation du ZIP ne vaut donc pas validation d'un upload HTML5 itch.io :
un empaquetage adapté ou une limite relevée sera nécessaire avant une telle
publication. Le déploiement web OVH utilise les fichiers locaux directement.
