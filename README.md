# PokéGang

Jeu idle/management Pokémon en page unique : recrute des agents, ouvre des zones de Kanto, capture des Pokémon, gagne de la réputation et développe ton gang.

Le projet est volontairement simple côté outillage : HTML, CSS et JavaScript vanilla, sans bundler ni build step.

## Lancer le jeu

Depuis la racine du repo, lance un serveur statique :

```bash
py -m http.server 8080
```

Puis ouvre :

```text
http://localhost:8080/
```

Un autre serveur statique convient aussi. Le repo n'a pas de `package.json`, donc `npm run dev` n'est pas disponible actuellement.

## Fonctionnalités

- **Zones** : routes, villes, lieux spéciaux, arène, raids, coffres et événements.
- **Capture** : animations de lancer de ball, potentiel, shiny, raretés et sprites configurables.
- **Agents** : recrutement, assignation aux zones, progression, équipes et automatisation.
- **Gang** : boss, base, titres, organigramme, export et statistiques.
- **PC** : grille de Pokémon, filtres, tri, détails, pension, formation et laboratoire.
- **Marché** : boutique, achat de balls/items, troc, vente et boosts temporaires.
- **Pokédex** : suivi caught/seen/shiny et descriptions.
- **Missions** : objectifs horaires, journaliers et hebdomadaires.
- **Compte cloud optionnel** : auth, cloud save et leaderboard via Supabase si configuré.
- **LLM optionnel** : dialogues de dresseurs via Ollama, OpenAI ou Anthropic selon les réglages.

## Structure du repo

| Chemin | Rôle |
|---|---|
| `index.html` | Shell HTML, onglets, modales et chargement des scripts |
| `app.js` | Moteur principal encore majoritairement monolithique |
| `css/` | Styles de base, interface de jeu et intro |
| `data/` | Données de gameplay, zones, Pokémon, sprites, missions, économie |
| `modules/` | Systèmes et UI extraits progressivement de `app.js` |
| `state/` | Store, migrations et sérialisation en cours de refactor |
| `info/zones.md` | Référence maintenue des zones |
| `tools/zone-editor.html` | Outil visuel pour inspecter/modifier les zones |

## Sauvegarde

Les saves locales sont stockées dans `localStorage` :

- `pokeforge.v6`
- `pokeforge.v6.s2`
- `pokeforge.v6.s3`

Le slot actif est stocké dans `pokeforge.activeSlot`. Le schéma courant est versionné dans `SAVE_SCHEMA_VERSION`.

## Supabase

Supabase est optionnel. `index.html` tente de charger `config.js`, mais le jeu fonctionne sans ce fichier.

Pour activer le compte cloud et le leaderboard, crée localement un `config.js` à la racine avec :

```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

Le schéma SQL du leaderboard est documenté dans la section Supabase de `app.js`.

## Notes de dev

- Les fichiers `data/*.js` chargés par `index.html` sont des scripts classiques. Leurs `const` sont accessibles par nom nu depuis `app.js`, pas via `globalThis`.
- Les modules extraits communiquent surtout avec `app.js` via des fonctions exposées sur `globalThis`.
- Quand un champ d'état est ajouté, mets à jour `DEFAULT_STATE` dans `app.js` et `state/defaultState.js`, puis ajoute une garde de migration dans `app.js` et `state/migrateSave.js`.
- Les sprites et backgrounds Showdown n'envoient pas d'en-têtes CORS. Ne pas ajouter `crossorigin="anonymous"` sur ces images.
