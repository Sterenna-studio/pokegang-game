# Build et publication itch.io

PokéGang est publié en parallèle sur itch.io et sur `pokegang.sterenna.fr`. La build itch est volontairement autonome : anglais par défaut, sauvegarde locale, pas de `config.js` ni de secret Supabase.

## Version de release

La source de vérité de la version itch est :

```text
release/itch-release.json
```

Exemple actuel :

```json
{
  "version": "0.5.0",
  "channel": "open beta",
  "uploadFile": "pokegang-v0.5.0-itch.zip",
  "itchDevlogType": "major_update"
}
```

Le build vérifie que cette version reste cohérente avec le `GAME_VERSION` produit. `APP_VERSION` reste un numéro technique séparé, utilisé pour le mécanisme de rechargement/cache du site.

## Générer le build

```bash
node tools/build-itch.js
```

Le script produit :

- `dist-itch/` : copie stagée inspectable ;
- `pokegang-v<version>-itch.zip` : archive finale à envoyer sur itch.io.

Pour v0.5.0 :

```text
pokegang-v0.5.0-itch.zip
```

Aucune dépendance npm n'est nécessaire.

## Ce que fait le script

1. copie uniquement le runtime : `index.html`, `app.js`, `css/`, `data/`, `modules/`, `state/`, `assets/`, `gang/` ;
2. garde le site principal en français, mais remplace `lang: 'fr'` par `lang: 'en'` dans la copie itch uniquement ;
3. exclut `config.js`, `docs/`, `tools/`, `supabase/`, `.git/` et les fichiers de développement ;
4. crée le ZIP avec `index.html` à la racine ;
5. vérifie les séparateurs ZIP, les dossiers runtime, la langue EN de la copie, la langue FR du source, l'absence de `config.js` et l'alignement de version.

Une build saine se termine par un message du type :

```text
[build-itch] Validation OK : release v0.5.0, ... entrées, séparateurs '/', index.html à la racine, EN itch / FR site, config.js absent.
```

## ⚠ Windows : utiliser PowerShell 7+

Windows PowerShell 5.1 peut produire des archives avec des chemins contenant `\\` au lieu de `/`. itch.io les interprète alors comme des noms de fichiers et tous les CSS/JS/assets renvoient 404.

Le script préfère donc `pwsh` (PowerShell 7+) et fait échouer le build si une entrée ZIP contient `\\`.

Symptôme d'une archive invalide : `index.html` s'ouvre, puis une grande quantité de 404 apparaît sur `css/`, `modules/`, `assets/`, etc.

## Pourquoi `gang/` est inclus

Le dossier `gang/` n'est pas seulement la page cosmétique autonome. Le jeu principal importe aussi `gang/environment.js` et charge `gang/gang.css`. Une archive sans ce dossier peut démarrer tout en ayant un Vivarium incomplet et des 404 silencieux.

## Pourquoi `config.js` n'est pas inclus

La build itch reste jouable sans configuration Supabase :

- sauvegardes dans le `localStorage` du navigateur ;
- pas d'inscription obligatoire ;
- pas de clé privée ni de `service_role` dans l'archive ;
- cloud/leaderboard non requis pour jouer.

Le site principal peut conserver ses fonctions cloud séparément.

## Analytics

GA4 fonctionne sur itch sans `config.js`, car l'ID de mesure est public et embarqué dans `index.html`.

Measurement ID :

```text
G-NP6C2KZ16G
```

Chaque événement de gameplay porte un paramètre `platform` (`web`, `itch`, `dev`) afin de comparer les populations dans la même propriété GA4.

## Test pré-publication

En local :

```bash
node tools/build-itch.js
cd dist-itch
python -m http.server 8091
```

Puis ouvrir `http://localhost:8091`, vider le `localStorage` et recharger.

Pour la v0.5.0, vérifier en particulier :

- l'écran de sauvegarde apparaît en anglais ;
- sans aucune sauvegarde, une nouvelle partie démarre automatiquement après environ 2 secondes si le joueur n'interagit pas ;
- le premier terrain d'onboarding s'affiche correctement ;
- le premier Pokémon est guidé visuellement et peut être capturé ;
- la séquence Rocket/Giovanni et les bulles de dialogue sont lisibles ;
- le recrutement du transfuge permet de poursuivre l'onboarding ;
- aucun 404 n'apparaît, notamment pour `gang/gang.css` et `gang/environment.js` ;
- une requête GA4 part bien vers `google-analytics.com/g/collect` ;
- `config.js` est absent de la copie stagée ;
- la sauvegarde créée reste propre à l'origine itch/local et indépendante du site principal.

## Contrôle automatique GitHub

Le workflow `.github/workflows/itch-release-check.yml` exécute les principaux tests de régression, construit l'archive itch et publie le ZIP validé comme artifact GitHub Actions. Une release ne doit pas être uploadée sur itch tant que ce job n'est pas vert.

## Upload itch.io

Dashboard itch.io → projet PokéGang → **Edit game** → **Uploads** :

1. envoyer `pokegang-v0.5.0-itch.zip` ;
2. Kind : **HTML** ;
3. cocher **This file will be played in the browser** ;
4. Viewport : **Automatically calculate width and height** ;
5. remplacer/désactiver l'ancienne archive seulement après avoir vérifié la nouvelle build ;
6. publier le devlog associé en **Major Update**.

Le brouillon du devlog v0.5.0 est versionné dans :

```text
docs/devlogs/itch-v0.5.0.md
```

## Bruit console itch connu

Les messages provenant du wrapper itch (`monetization`, `xr`, `allowfullscreen`, certains appels dashboard/CORS) ne sont pas nécessairement des erreurs du jeu. Les erreurs importantes à traiter sont celles qui concernent directement les fichiers PokéGang, les imports JS, les assets runtime ou les événements du jeu.
