# Prototype PMD réservé au Lab

Le catalogue versionné `assets/pokemon_pmd/metadata.js` reste vide. La production
et la build itch continuent donc d'utiliser les sprites ordinaires.
La copie locale préparée dans `coverage/pmd-preview-runtime/` contient un
catalogue distinct pour le test : Miaouss #52, Nosferapti #41 et Fantominus #92,
chacun en normal et shiny, Idle et Walk. Les douze PNG représentent 143 054 octets.
Les ressources ne sont pas ajoutées à Git. Leurs droits restent documentés dans
[`assets/pokemon_pmd/CREDITS.md`](../assets/pokemon_pmd/CREDITS.md).

Le préparateur n'effectue aucun déploiement. La publication de ce prototype
public exige la clarification de la restriction initiale du propriétaire sur
les ressources aux droits incertains. Une décision de test ne constitue pas
une autorisation supplémentaire des ayants droit.

## Préparation et contrôle local

```powershell
python tools/prepare-pmd-preview.py
$env:POKEGANG_RUNTIME_ROOT = 'coverage/pmd-preview-runtime'
# Installation existante de playwright-core et navigateur correspondant :
$env:POKEGANG_PLAYWRIGHT_PATH = 'CHEMIN_VERS/playwright-core'
$env:POKEGANG_CHROMIUM_PATH = 'CHEMIN_VERS/chrome-headless-shell.exe'
node tools/check-vivarium-pmd-browser.mjs
```

Pillow est nécessaire au préparateur. Les téléchargements sont mis en cache sous
`coverage/pmd-source-cache/`, à la révision SpriteCollab
`e7868e9a7f6b931d1fb826756a490d4633879d03`.
Les PNG sont copiés sans recompression. Les dimensions et durées viennent des
XML originaux ; les huit lignes sont vérifiées dans les PNG. L'ancrage constant
est régénéré à partir du centre médian des ombres sur toutes les frames et
directions. Les petits déplacements internes des ombres, jusqu'à deux pixels
source pour Nosferapti, sont conservés comme partie de l'animation.
Les crédits et XML de chaque variante, la licence publiée, les noms d'artistes,
les chemins sources et les empreintes SHA-256 accompagnent la copie.

Le contrôle Chromium a passé avec les vraies feuilles préparées : normal et
shiny, Idle/Walk, rencontre et reprise, clic en marche, snapshot ancien et
répété, fallback, fond, viewport mobile, reduced-motion et nettoyage sans timer
ou RAF restant. Huit feuilles téléchargées, sans doublon, pour les quatre
acteurs PMD du scénario ; la démonstration séparée affiche les six variantes.
Les captures locales sont dans `coverage/pmd-lab-desktop.png` et
`coverage/pmd-lab-mobile.png`. Cela ne valide pas OBS/CEF, Supabase réel ni un
téléphone physique.

Le contrôle visuel a révélé un regroupement des sprites au bord droit au
redimensionnement. Le renderer expose désormais les marges de son enveloppe
Idle/Walk ; le placement réserve cet espace et le redimensionnement conserve
les positions relatives plutôt que de rabattre les résidents au même bord.

## Publication de la copie préparée

Après clarification de la restriction de diffusion :

```powershell
.\tools\deploy-ovh-previews.ps1 -Target web -WebSourceRoot .\coverage\pmd-preview-runtime
```

La destination du script reste exclusivement
`/home/sterenn/lab/pokegang-preview`. La production et la preview itch ne sont
pas concernées par `-Target web`.

- Jeu : <https://lab.sterenna.fr/pokegang-preview/>
- Vivarium du joueur : <https://lab.sterenna.fr/pokegang-preview/gang/>
- Démonstration sans sauvegarde :
  <https://lab.sterenna.fr/pokegang-preview/gang/pmd-preview.html>

La démonstration n'accède pas au stockage du navigateur. Dans le jeu et `/gang/`,
seules les trois espèces du prototype utilisent PMD ; les autres gardent leur
fallback. Les règles de cache désactivé et noindex existantes sont conservées.
La seule préparation locale ne rend pas ces URL actives : vérifier HTTP et le
rendu dans un navigateur après tout transfert avant d'annoncer la publication.
