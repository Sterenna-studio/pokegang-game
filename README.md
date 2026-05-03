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

- **Zones** : routes, villes, lieux spéciaux, arènes, raids, coffres et événements. Chaque zone peut être ouverte (interactive) ou confiée à des agents (simulation silencieuse en arrière-plan).
- **Capture** : animations de lancer de ball, potentiel, shiny, raretés et sprites configurables (local FireRed/LeafGreen, Showdown gen1–5, animés, Home…).
- **Agents** : recrutement, assignation aux zones, progression de rang, perks et automatisation des captures/combats.
- **Gang** : boss personnalisable, vitrine (6 slots), équipe boss (3 slots sauvegardables), titres, export carte gang, statistiques session/global.
- **PC** : grille de Pokémon avec filtres/tri, détails et historique, pension (reproduction d'œufs), salle de formation et laboratoire intégrés.
- **Marché** : boutique items, balls, boosts temporaires, troc et vente auto configurable.
- **Pokédex** : suivi caught/seen/shiny et descriptions.
- **Missions** : objectifs horaires, journaliers et hebdomadaires.
- **Cosmétiques** (intégrés dans l'onglet Gang — section APPARENCE & MUSIQUE) :
  - Fonds d'écran scènes & thèmes achetables
  - Fonds tissu Original Stitch débloqués par capture (capture = fond normal, capture chroma = variante brodée)
  - Pins/patches décoratifs sur la carte boss (3 actifs max)
  - Jukebox avec musiques débloquées par zone
- **Compte cloud optionnel** : auth, cloud save et leaderboard via Supabase si configuré.
- **LLM optionnel** : dialogues de dresseurs via Ollama, OpenAI ou Anthropic.

## Navigation

| Onglet | Contenu |
|---|---|
| Zones | Carte des zones + fenêtres de jeu actif |
| PC | Pokémon, pension, formation, laboratoire, Pokédex |
| Agents | Gestion et assignation des agents |
| Marché | Boutique et ventes |
| Gang | Boss, vitrine, services, cosmétiques, stats |
| Missions | Quêtes horaires / journalières / hebdomadaires |
| 📋 Évts | Journal de combats et événements |
| 🏆 | Leaderboard |
| ☁ Compte | Authentification et cloud save |

## Structure du repo

| Chemin | Rôle |
|---|---|
| `index.html` | Shell HTML, onglets, modales et chargement des scripts |
| `app.js` | Moteur principal (état, boucle de jeu, rendu) |
| `css/` | Styles de base, interface de jeu et intro |
| `data/` | Données statiques : zones, Pokémon, sprites, missions, économie, cosmétiques |
| `modules/systems/` | Systèmes extraits : agent, market, missions, pension, trainingRoom, zoneSystem, cloudAccount, llm, offlineCatchup… |
| `modules/ui/` | Composants UI extraits : zoneWindows, zoneSelector, pcPokedex, gangBase, settingsModal, sprites |
| `state/` | defaultState, migrations et sérialisation |
| `tools/zone-editor.html` | Outil visuel pour inspecter/modifier les zones |

## Sauvegarde

Les saves locales sont stockées dans `localStorage` :

- `pokeforge.v6`
- `pokeforge.v6.s2`
- `pokeforge.v6.s3`

Le slot actif est stocké dans `pokeforge.activeSlot`. Le schéma courant est versionné dans `SAVE_SCHEMA_VERSION`.

## Supabase (optionnel)

`index.html` tente de charger `config.js`, mais le jeu fonctionne sans ce fichier.

Pour activer le compte cloud et le leaderboard, crée localement un `config.js` à la racine avec :

```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

## Notes de dev

- Les fichiers `data/*.js` sont des scripts classiques (`<script>` sans `type="module"`). Leurs `const` sont accessibles par nom nu dans `app.js`, **pas** via `globalThis`.
- Les modules extraits communiquent avec `app.js` via `globalThis` : app.js expose ses fonctions dessus, les modules enregistrent les leurs via `Object.assign(globalThis, { _prefix_fn: fn })`.
- Quand un champ d'état est ajouté : mettre à jour `DEFAULT_STATE` dans `app.js` **et** `state/defaultState.js`, puis ajouter une garde de migration dans `app.js` et `state/migrateSave.js`.
- Les sprites Showdown et Original Stitch n'envoient pas d'en-têtes CORS — ne pas ajouter `crossorigin="anonymous"` sur ces images.
