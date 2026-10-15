# Vivarium : renderer PMD et état de livraison

## État

L'infrastructure est implémentée mais l'intégration artistique reste bloquée.
**Aucun sprite PMD n'est distribué ou activé**, y compris dans la build itch.
Voir [l'audit des droits et crédits](../assets/pokemon_pmd/CREDITS.md).
La PR doit rester en brouillon tant que les ressources ne sont pas validées,
importées et vérifiées visuellement. Il ne s'agit pas d'une intégration PMD
terminée et il n'existe pas de démonstration avec les images originales.

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
- `assets/pokemon_pmd/metadata.js` : catalogue vide, sans import non validé.
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
Les nombres de lignes, les pixels et les ancrages des images originales n'ont
pas été validés visuellement. Aucun offset original n'a été importé.
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

Le serveur et les intercepts de ce test ne servent que des formes géométriques
générées en mémoire. Ils ne modifient aucun fichier du catalogue.

| Scénario demandé | Preuve / limite |
| --- | --- |
| 1–3. Miaouss, Nosferapti, Fantominus Idle/Walk | Géométries vérifiées ; animation et directions testées avec des feuilles synthétiques ; vrais dessins bloqués |
| 4. Shiny | Variante synthétique distincte, chargement et dimensions testés ; art original bloqué |
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

Avant activation : importer uniquement les ressources autorisées avec leurs
crédits et métadonnées générées, vérifier les quinze scénarios avec les vraies
images, notamment pieds/ombres, huit directions de Nosferapti, passage
Idle/Walk de Fantominus, changements de sources avec les images PMD et caméos,
puis réaliser les essais sur mobile physique et OBS réel.

### Résultats de cette livraison

- Suite complète : **40 fichiers `tools/test-*.mjs` passent**, dont le test PMD
  et le round-trip des sauvegardes.
- Chromium réel : `tools/check-vivarium-pmd-browser.mjs` passe avec le catalogue
  synthétique décrit ci-dessus. Ce contrôle reste séparé de la suite sans
  dépendances utilisée en CI.
- `node tools/check-events.js`, `node tools/check-dead-calls.mjs` et
  `node tools/test-data-integrity.mjs` passent.
- `node tools/cache-bust.js` exécuté, puis `node tools/test-cache-bust.mjs` passe.
- `node tools/build-itch.js` passe : v0.5.2, 569 entrées, 30,67 Mo,
  séparateurs ZIP corrects, configuration privée exclue, FR web / EN itch.
  L'archive générée n'est ni commitée ni publiée.
