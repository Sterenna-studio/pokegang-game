# Build itch.io

PokéGang est publié en parallèle sur [itch.io](https://sterenna.itch.io) (page id `4826039`), en plus de `pokegang.sterenna.fr`. Ce document rassemble tout ce qu'il faut savoir pour produire et publier un nouveau build — historique complet dans les issues GitHub [#57](../../../issues/57) (portabilité + build initial) et [#58](../../../issues/58) (localisation anglaise, qui a motivé le défaut EN sur itch).

## Générer un build

```bash
node tools/build-itch.js
```

Produit `dist-itch/` (dossier stagé, pour inspection manuelle) et `dist-itch.zip` (à uploader tel quel) à la racine du repo — les deux sont dans `.gitignore`, régénérés à chaque run. Rien à installer, aucune dépendance ajoutée : le script est pur Node (`fs.cpSync` pour la copie récursive) + `Compress-Archive` (**pwsh 7+** sur Windows) ou `zip` (autres OS) pour la compression.

## Ce que le script fait

1. **Copie uniquement ce qui est nécessaire au runtime** : `index.html`, `app.js`, `css/`, `data/`, `modules/`, `state/`, `assets/`, `gang/`. Exclut tout le reste (`.git`, `.claude`, `.github`, `.githooks`, `docs`, `info`, `test`, `tools`, `supabase`, `README.md`, `CLAUDE.md`, `_headers`, `deploy.yml`, `deploy-trigger.txt`, `config.js`).
2. **Patch la langue par défaut** — `state/defaultState.js` : `lang: 'fr'` → `lang: 'en'`, **uniquement dans la copie stagée**, jamais dans le repo commité (`pokegang.sterenna.fr` reste en français).
3. **Zippe** avec `index.html` à la racine de l'archive (obligatoire pour qu'itch serve le jeu correctement).
4. **Valide l'archive** et fait échouer le build si quoi que ce soit clochait (voir ci-dessous).

## ⚠ Piège : séparateurs de chemin du zip (bug réellement livré une fois)

`Compress-Archive` de **Windows PowerShell 5.1** (`powershell.exe`) écrit les entrées du zip avec des séparateurs `\`, ce que la spec ZIP interdit ([APPNOTE 4.4.17.1](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT) impose `/`). Conséquence sur itch.io : `css\base.css` est interprété comme un **nom de fichier littéral** et non comme un chemin — donc aucun dossier `css/` n'existe côté serveur, et **tous les assets renvoient 404** alors que `index.html` (à la racine) se charge normalement. Le symptôme est très reconnaissable : une centaine de 404 d'un coup dans la console, sur absolument tous les `.css`/`.js`/`.png`.

Le script utilise donc **`pwsh` (PowerShell 7+) en priorité**, dont le `Compress-Archive` est corrigé, et retombe sur `powershell` seulement s'il est absent (avec un avertissement). Surtout, l'étape de validation lit le *central directory* du zip produit et **fait échouer le build** si :

- une seule entrée contient un `\` ;
- `index.html` n'est pas à la racine ;
- un des dossiers runtime (`css`, `data`, `modules`, `state`, `assets`, `gang`) est absent.

Un build qui affiche `Validation OK : N entrées, séparateurs '/', index.html à la racine.` est sain. Si la validation échoue en fallback `powershell`, installer PowerShell 7+ et relancer.

## Uploader

Dashboard itch.io → projet → Edit game → Uploads → glisser `dist-itch.zip`.
- Kind: **HTML**, cocher **"This file will be played in the browser"**.
- Viewport : **"Automatically calculate width and height"** (le jeu est une page responsive, pas un canvas de taille fixe).
- Description : coller le fragment HTML de [`docs/itch-description.html`](itch-description.html) dans l'éditeur en mode **HTML** (pas le mode texte enrichi, qui aplatit les styles inline) — à garder synchronisé avec l'état réel du jeu, pas juste recopié du README.

## Pourquoi `config.js` n'est PAS inclus

Le jeu boote proprement sans lui (`SUPABASE_URL`/`SUPABASE_ANON_KEY` undefined → fonctionnalités cloud désactivées silencieusement, pas de crash). C'est voulu : la version itch est positionnée comme **100% hors-ligne, sans inscription**, sauvegarde uniquement dans le `localStorage` du navigateur — complémentaire de `pokegang.sterenna.fr` qui offre en plus la sauvegarde cloud, le classement et la compétition entre gangs. Les deux sauvegardes ne sont **pas partagées** entre les deux versions.

## Pourquoi `gang/` doit être inclus (piège déjà tombé dedans une fois)

`gang/` ressemble à la page compagnon cosmétique autonome (`gang/index.html`, servie sur `pokegang.sterenna.fr/gang/`) — mais depuis la feature "Vivarium comme tuile de zone" (commit `a6f5412`), **le jeu principal lui-même** importe `gang/environment.js` (`modules/ui/vivariumZone.js`) et `index.html` charge `gang/gang.css` comme feuille de style. Un zip sans `gang/` boote quand même (pas de crash JS) mais produit deux 404 silencieux et casse la tuile Vivarium. `gang/environment.js` n'importe lui-même que `modules/systems/vivariumSnapshot.js` (déjà inclus) ; `gang/panels.js`/`gang-app.js`/`live.html`/`live-app.js` ne servent qu'à la page autonome — mais le dossier entier ne pèse que ~124 Ko, donc `build-itch.js` le copie en bloc plutôt que de trier.

**Si un futur ajout crée une nouvelle dépendance de ce type** (le jeu principal qui importe un fichier hors de la liste `INCLUDE` du script), il faut soit l'ajouter à `INCLUDE`, soit refactorer pour ne plus en dépendre — vérifier avec :

```bash
grep -rnE "from ['\"]\.\./\.\./|from ['\"]\./" modules/ app.js index.html
```

et confirmer que toute cible pointe bien dans un des dossiers copiés.

## Analytics (GA4)

`index.html` embarque le snippet `gtag.js` avec un **ID de mesure public** (pas un secret comme la clé Supabase) — donc le même snippet fonctionne identiquement sur le site et sur itch, sans dépendance à `config.js`. Voir `modules/systems/analytics.js` pour les événements trackés ; chaque event porte un paramètre `platform` (`web`/`itch`/`dev`, détecté via `location.hostname`) pour distinguer les deux populations dans une seule propriété GA4.

Measurement ID actuel : **`G-NP6C2KZ16G`** (renseigné aux deux endroits dans `index.html` — la balise `<script async src="...?id=...">` et l'appel `gtag('config', ...)`). Un **seul flux de données web** couvre les deux origines volontairement : deux flux séparés fragmenteraient utilisateurs et sessions sans rien apporter, alors que le paramètre `platform` permet déjà de les distinguer dans les rapports.

⚠️ Si l'ID venait à être remplacé par un placeholder ou un ID invalide, le tracking devient un **no-op silencieux** : aucune erreur console, mais plus rien n'arrive dans GA. Vérifier dans l'onglet Réseau qu'une requête part bien vers `google-analytics.com/g/collect` après un chargement de page.

## Bruit console à ignorer après upload sur itch (déjà vérifié, pas un bug du repo)

`Unrecognized feature: 'monetization'/'xr'`, `Allow attribute will take precedence over 'allowfullscreen'` (wrapper iframe d'itch), `itch.io/html-callback ... ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` (pont postMessage d'itch), CORS/403 sur `itch.io/dashboard/game/.../dismiss-checkpoint` (JS du dashboard itch, se déclenche sur la page dashboard elle-même, pas dans l'iframe du jeu).

## Tester avant de publier

```bash
node tools/build-itch.js
cd dist-itch && py -m http.server 8091
```

Ouvrir `http://localhost:8091`, `localStorage.clear()` + reload pour simuler un nouveau joueur (pas de save existante = pas de config Supabase = état itch réel), vérifier :
- le hub d'accueil (choix de sauvegarde) s'affiche bien en anglais ;
- aucune erreur console (surtout pas de 404 sur `gang.css`/`environment.js`) ;
- `localStorage.getItem('pokeforge.v6')` après une partie créée est bien indépendant de tout ce qui existe sur `pokegang.sterenna.fr` dans le même navigateur.
