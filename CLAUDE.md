# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Development

```bash
py -m http.server 8080
```

No bundler, no transpiler, no `package.json` at the moment. Any static server is enough. Open `http://localhost:8080/` in Chrome or Firefox. Changes to any file are live on refresh.

`index.html` loads an optional local `config.js` for Supabase credentials. The game still boots without that file; the browser may simply report a 404 for it in local dev.

### Cache-busting

Every local `<script src="...">`/`<link href="...">` in `index.html` carries a `?v=<hash>` query string. That hash is a content hash of the referenced file (`sha1`, first 8 hex chars), regenerated automatically by `tools/cache-bust.js` from the `pre-commit` git hook (`.githooks/pre-commit`, enable once via `git config core.hooksPath .githooks`). This means the version tag only ever changes when the file's content actually changes — no more manually incrementing `?v=N` and no risk of forgetting to bump it, which used to allow browsers to serve stale cached assets after a deploy.

To regenerate manually: `node tools/cache-bust.js`. Safe to run anytime; it's a no-op if nothing changed.

---

## Architecture overview

Single-page idle/management game. No framework, no reactive system. Everything is vanilla JS with manual DOM updates.

### Entry points

| File | Role |
|---|---|
| `index.html` | HTML shell — tab structure, static DOM anchors, script tags |
| `app.js` | ES module composition root — imports modules, injects dependencies, registers Scheduler tasks and orchestrates boot |
| `css/base.css` | CSS custom properties (design tokens) + reset |
| `css/game-ui.css` | All component styles |
| `css/intro.css` | Intro/onboarding screen only |

### Second entry point: `gang/` (cosmetic page)

`gang/index.html` is a standalone page served at `pokegang.sterenna.fr/gang/`, hosting the cosmetic panels (music, wallpapers/pins/ball skins, boss title, showcase) that used to live inside the main Gang tab. It reuses `state/store.js` to read/write the same `localStorage['pokeforge.v6']` (same origin as the main game) but **never starts the game loop** (`modules/core/tickManager.js` / `startGameLoop()` are not imported there) — this was the whole point of splitting it out, since the cosmetic UI was fighting the live tick loop for re-renders. `gang/gang-app.js` is its boot script; `gang/panels.js` holds the ported panel-render functions; `gang/environment.js` is a self-contained "vivarium" (showcase + boss team Pokémon wandering, driven by periodic CSS-transition repositioning, no animation engine). When touching cosmetic features (`state.cosmetics`, `state.gang.showcase`, `state.gang.titleA/B/C/D`), check whether `gang/panels.js` needs the same change — `modules/ui/gangTab.js` no longer renders any of this itself, only a link card pointing to `/gang/`.

Because two pages can be open at once and both write the same save, `gang/gang-app.js`'s `saveState()` re-reads `localStorage` fresh right before writing and only patches the narrow set of cosmetic fields it owns, rather than writing back its full in-memory `state` — this bounds (not eliminates) the risk of clobbering unrelated progress made in the other tab.

### Script loading: two distinct contexts

`index.html` loads data files as **classic `<script>` tags** before `app.js`:

```
config.js               → optional SUPABASE_URL, SUPABASE_ANON_KEY
data/loaders.js         → sprite JSON loader helpers on window
data/zones-data.js       → const ZONES, ZONE_BY_ID, ZONE_MUSIC_MAP
data/species-data.js     → const POKEMON_GEN1, SPECIES_BY_EN
data/evolutions-data.js  → const EVOLUTION_CHAINS
data/titles-data.js      → title definitions
... (other data files)
```

`app.js` and `modules/` are loaded as **ES modules** (`type="module"`).

**Critical rule**: Classic-script `const` declarations are **not** on `window`/`globalThis`. They live in the shared global lexical scope. ES modules can access them by **bare name** (`ZONES`, `SPECIES_BY_EN`) but **not** via `globalThis.ZONES` (which is undefined). Always use bare names for classic-script globals inside ES modules — never `globalThis.X`.

### Cross-module communication

App.js exposes its functions and state to extracted modules via `globalThis`:

```js
globalThis.state = state;
globalThis.notify = notify;
globalThis.saveState = saveState;
// etc.
```

Extracted modules in `modules/` and `modules/systems/` read from `globalThis.*` and call back into app.js via those globals. See the comment header at the top of each module file for its exact dependency list.

### State

Single mutable `state` object, plain JS. Shape définie dans **`state/defaultState.js`** (importée par `app.js`). Le `store` réactif de `state/store.js` est instancié au boot (`_createStoreInstance()`) et utilisé pour `load()`/`save()`/migrations — mais les mutations courantes restent directes sur l'objet `state` (pas encore de reactive subscriptions complètes).

```js
state.gang        // boss, money, reputation, titles, showcase
state.pokemons[]  // all pokémon in the PC
state.agents[]    // recruited agents
state.zones{}     // per-zone runtime data (investments, combats, mastery)
state.pokedex{}   // caught/seen/shiny flags by species_en
state.stats{}     // lifetime counters
state.inventory{} // item counts
state.missions{}  // daily/weekly/hourly quest progress
state.settings{}  // user preferences
```

`state/runtimeStore.js` owns the runtime binding between the mutable `state` object, the persistent store from `state/store.js`, the dirty flag, autosave, lookup-map invalidation and the player-activity signal used by leaderboard sync. `app.js` keeps compatibility facades (`setState`, `saveState`, `markDirty`, `migrate`) and injects the runtime store into the rest of the app.

`saveState()` serializes to `localStorage['pokeforge.v6']` (3 slots: `v6`, `v6.s2`, `v6.s3`). Auto-saves every 10 seconds but skips clean state. Explicit saves always write. Pokémon objects are "slimmed" via `slimPokemon()` before serialization (removes derivable/default fields). Schema version: `SAVE_SCHEMA_VERSION`. Migration runs on load via `migrate()`.

Cloud backup via Supabase (optional). Runs hourly via `Scheduler.register('cloudSave', supaCloudSave, TICK_CLOUD_SAVE_MS, ...)` in `app.js` (`TICK_CLOUD_SAVE_MS` = 1h, `data/gameplay-config-data.js`) — not a per-write throttle. Before upserting, `supaCloudSave()` checks whether the cloud row was written more recently and is at least as advanced as the local state, to avoid silently overwriting another device/tab's progress. Uses a custom reentrant JS mutex (`_makeSupaLock`) to avoid GoTrue deadlocks.

### Game loop

`startGameLoop()` enregistre toutes les tâches périodiques dans le **TickManager** (`modules/core/tickManager.js`) — un Scheduler central qui gère un seul tick global et applique `skipWhenHidden` pour économiser le CPU quand l'onglet est en background. `app.js` garde les `Scheduler.register(...)`; les callbacks métier vivent dans leurs modules :

| Interval | What |
|---|---|
| 2s | `agentTick()` — agents act on visible zone spawns (open zones only) |
| 10s | `passiveAgentTick()` — gym-raids automatiques uniquement |
| 10s | Auto-save |
| 30s | Passive XP for pokémon in teams via `modules/systems/pokemon.js` |
| 30s | Pension/egg tick |
| 60s | Training room tick |
| 60s | Hourly quest reset check via `modules/systems/missions.js` |
| 5min | Cloud snapshot + leaderboard via `modules/systems/cloudAccount.js` |
| 1s | Zone timer UI refresh via `modules/ui/zoneWindows.js` |
| _per-zone_ | `backgroundZoneTimers[zoneId]` — simulation background au vrai `spawnRate` |

Version polling and the daily reload cycle are implemented in `modules/core/updateManager.js`; `app.js` injects browser/timer dependencies and registers the Scheduler callbacks.

### Tab system

Tabs: `tabZones`, `tabPC`, `tabAgents`, `tabMarket`, `tabGang`, `tabPokedex`, `tabBattleLog`, `tabMissions`, `tabCompte`.

`switchTab(tabId)` → sets `activeTab` → calls `renderActiveTab()` → dispatches to the appropriate `render*Tab()` function. Tabs render lazily (only when activated). Some tabs are hidden until discovery milestones are reached (`state.discoveryProgress`).

### Boot sequence

`boot()` in `app.js` should stay readable as orchestration:

1. version check;
2. `initializeRuntimeState()`;
3. global UI bindings;
4. system initialization;
5. intro/cosmetics/session restore;
6. initial render and async asset loading;
7. intro module configuration;
8. Scheduler startup;
9. EventBus bridges;
10. scripted boot checks.

EventBus bridges are guarded so repeated `boot()` calls during tests or hot reload do not double-subscribe.

### Zone system

- `ZONES` array (classic script) — static zone definitions (id, rep threshold, spawn pool, trainer types)
- `openZones` Set — currently open zone windows
- `zoneSpawns{}` — active spawns per open zone (max 5 per zone)
- `tickZoneSpawn(zoneId)` — called by spawn timer, generates a new spawn (pokémon / trainer / chest / event)
- Zone windows rendered by `buildZoneWindowEl()`, patched live by `patchZoneWindow()`
- Zone selector (fogmap) extracted to `modules/ui/zoneSelector.js`

#### Les trois états d'une zone

| État | Condition | Comportement |
|---|---|---|
| **Open** | `openZones.has(zoneId)` | Fenêtre visible, spawns visuels, combat interactif, timer `zoneSpawnTimers[zoneId]` actif |
| **Closed + agent** | `!openZones.has(zoneId)` + `≥1 agent assigné` | Simulation silencieuse via `backgroundZoneTimers[zoneId]` au vrai `spawnRate` |
| **Inactive** | `!openZones.has(zoneId)` + `0 agent` | Rien ne tourne |

**Cycle de vie des timers background** (dans `app.js`) :

```js
startBackgroundZone(zoneId)   // démarre setInterval au spawnRate de la zone
stopBackgroundZone(zoneId)    // clearInterval + supprime l'entrée
syncBackgroundZones()         // recalcule tous les timers selon l'état courant
```

`syncBackgroundZones()` est appelé au boot (`startGameLoop`), à chaque `openZoneWindow`/`closeZoneWindow`, et à chaque assign/unassign d'agent.

**Résolution background** (`modules/systems/agent.js`) :

```js
resolveBackgroundSpawnForZone(zoneId)
// Appelé par backgroundZoneTimers à chaque tick.
// 1. spawnInZone(zoneId) → génère un spawn
// 2. Pour pokémon   → premier agent CAP avec une pokéball capture silencieusement
// 3. Pour dresseur  → puissance combinée de tous les agents combat, résolution immédiate
// 4. Pour coffre    → loot silencieux via rollChestLoot()
// 5. saveState() + updateTopBar() si changement
```

`passiveAgentTick` (toutes les 10 s) ne gère plus que les **gym-raids automatiques** (logique de spawn déléguée aux `backgroundZoneTimers`).

### Combat

`openCombatPopup(zoneId, spawnObj)` → construit le combat dans le viewport de la zone → `executeCombat()` simule les échanges tour-par-tour avec animations. `currentCombat` global empêche les combats simultanés.

- **Viewport** : sprites Pokémon + HP overlays uniquement. Le log de combat texte n'est **pas** affiché dans la zone (HUD minimal `zone-combat-hud-minimal`). Les lignes de combat sont enregistrées dans `combatLogLines[]` pour l'onglet BattleLog.
- **Raid** : plusieurs dresseurs ennemis (`raidTrainers[]`). Le boss + les agents assignés participent côté joueur via `gangTrainers[]`.
- **Agents en zone ouverte** : `agentAutoCombat()` déclenche le combat automatique sur les spawns dresseurs visibles.

### Sprites

- **Pokémon**: `pokeSprite(species_en, shiny)` → lit `state.settings.spriteMode` (string enum). Mode `'local'` utilise `data/pokemon-sprites-kanto.json` (FireRed/LeafGreen HD). Tous les autres modes utilisent Showdown via `_showdownSpriteUrl()`.
- **Modes disponibles** : `'local'` | `'gen1'` | `'gen2'` | `'gen3'` | `'gen4'` | `'gen5'` | `'ani'` (GIF) | `'dex'` | `'home'`
- **Trainers**: `trainerSprite(name)` → Showdown trainer sprites with local JSON mapping
- **All Showdown URLs**: `https://play.pokemonshowdown.com/sprites/{set}/{name}.png`
- ⚠️ Showdown and `lab.sterenna.fr` do not send CORS headers — never add `crossorigin="anonymous"` to these `<img>` tags (breaks display; canvas export not possible with these domains)

### Balancing constants

Isolated in `data/` — edit there, not in `app.js`:

| File | Contains |
|---|---|
| `data/economy-data.js` | Ball prices, shop items, egg costs, price multipliers |
| `data/combat-config-data.js` | Special trainer keys, max combat reward |
| `data/gameplay-config-data.js` | Quest reroll cost, boost durations |
| `data/zones-data.js` | Zone definitions, spawn pools, wing drop config |
| `data/game-config-data.js` | Agent names/sprites, nature config, title requirements, rank chain |

---

## Key conventions

**Adding a new field to state**: add it in `DEFAULT_STATE` dans `state/defaultState.js` (seule source de vérité), puis ajouter une garde de migration dans `state/migrateSave.js` pour préserver les saves existantes.

**Adding a new function accessed by modules**: assign it to `globalThis` after definition in `app.js`:
```js
Object.assign(globalThis, { myNewFunction });
```

**Rendering**: there is no virtual DOM. Functions directly set `.innerHTML` or build/replace DOM nodes. Prefer targeted updates over full re-renders where possible (e.g. `_refreshZoneTile()` instead of full `renderZoneSelector()`).

**Notifications**: `notify(message, type)` — types: `''` (default), `'success'`, `'error'`, `'gold'`.

**Save schema version**: increment `SAVE_SCHEMA_VERSION` when adding a new required state field, to trigger the migration banner for users.

---

## Ongoing refactor

The codebase is mid-refactor. The target architecture extracts systems from `app.js` into `modules/`:

- `modules/systems/` — agent, market, missions, llm, trainingRoom, pension, sessionObjectives
- `modules/ui/zoneSelector.js` — zone fogmap UI
- `state/` — runtimeStore.js, store.js, defaultState.js, migrateSave.js, serialization.js
- `modules/core/updateManager.js` — version polling, update banner and daily reload cycle
- Scheduler callbacks — missions (`modules/systems/missions.js`), passive XP (`modules/systems/pokemon.js`), zone refresh (`modules/ui/zoneWindows.js`), leaderboard (`modules/systems/cloudAccount.js`), regional unlock polling (`modules/systems/regionUnlocks.js`)
- `data/` — constants extracted from app.js (all done)

When touching a system that has both an `app.js` implementation and a `modules/` counterpart, check both. Stub functions in `app.js` delegate to the module (`function renderZoneSelector() { _zsRenderSelector(); }`).

### Available focused tests

```bash
node tools/test-runtime-store.mjs
node tools/test-update-manager.mjs
node tools/check-events.js
```

For ES module syntax checks in this no-`package.json` repo, use the established pattern:

```bash
Get-Content -Raw app.js | node --input-type=module --check
Get-Content -Raw modules/core/updateManager.js | node --input-type=module --check
```
