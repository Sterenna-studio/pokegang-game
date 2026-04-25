# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Development

```bash
npm run dev   # serve on localhost:8080 — no build step, pure static files
```

No bundler, no transpiler. Open `http://localhost:8080/` directly in Chrome or Firefox. Changes to any file are live on refresh.

---

## Architecture overview

Single-page idle/management game. No framework, no reactive system. Everything is vanilla JS with manual DOM updates.

### Entry points

| File | Role |
|---|---|
| `index.html` | HTML shell — tab structure, static DOM anchors, script tags |
| `app.js` | 12 000-line ES module — core engine (state, rendering, game logic) |
| `css/base.css` | CSS custom properties (design tokens) + reset |
| `css/game-ui.css` | All component styles |
| `css/intro.css` | Intro/onboarding screen only |

### Script loading: two distinct contexts

`index.html` loads data files as **classic `<script>` tags** before `app.js`:

```
data/zones-data.js       → const ZONES, ZONE_BY_ID, ZONE_MUSIC_MAP
data/species-data.js     → const POKEMON_GEN1, SPECIES_BY_EN
data/evolutions-data.js  → const EVOLUTION_CHAINS
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

Single mutable `state` object, plain JS. Shape defined in `app.js` as `DEFAULT_STATE` (also in `state/defaultState.js` for the refactored store — both exist in parallel during the ongoing refactor).

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

`saveState()` serializes to `localStorage['pokeforge.v6']` (3 slots: `v6`, `v6.s2`, `v6.s3`). Auto-saves every 10 seconds. Pokémon objects are "slimmed" via `slimPokemon()` before serialization (removes derivable/default fields). Schema version: `SAVE_SCHEMA_VERSION`. Migration runs on load via `migrate()`.

Cloud backup via Supabase (optional). Throttled to 1 save/30s. Uses a custom reentrant JS mutex (`_makeSupaLock`) to avoid GoTrue deadlocks.

### Game loop

`startGameLoop()` wires all intervals:

| Interval | What |
|---|---|
| 2s | `agentTick()` — agents act on visible zone spawns |
| 10s | `passiveAgentTick()` — agents in closed zones earn passively |
| 10s | Auto-save |
| 30s | Passive XP for pokémon in teams |
| 30s | Pension/egg tick |
| 60s | Training room tick |
| 60s | Hourly quest reset check |
| 5min | Cloud snapshot |
| 1s | Zone timer UI refresh (only if zones are open) |

### Tab system

Tabs: `tabZones`, `tabPC`, `tabAgents`, `tabMarket`, `tabGang`, `tabPokedex`, `tabCosmetics`, `tabBattleLog`, `tabMissions`, `tabCompte`.

`switchTab(tabId)` → sets `activeTab` → calls `renderActiveTab()` → dispatches to the appropriate `render*Tab()` function. Tabs render lazily (only when activated). Some tabs are hidden until discovery milestones are reached (`state.discoveryProgress`).

### Zone system

- `ZONES` array (classic script) — static zone definitions (id, rep threshold, spawn pool, trainer types)
- `openZones` Set — currently open zone windows
- `zoneSpawns{}` — active spawns per open zone (max 5 per zone)
- `tickZoneSpawn(zoneId)` — called by spawn timer, generates a new spawn (pokémon / trainer / chest / event)
- Zone windows rendered by `buildZoneWindowEl()`, patched live by `patchZoneWindow()`
- Zone selector (fogmap) extracted to `modules/ui/zoneSelector.js`

### Combat

`openCombatPopup(zoneId, spawnObj)` → builds the combat UI in `#battleArena` → `executeCombat()` simulates turn-by-turn matchups and animates them sequentially. Global `currentCombat` prevents multiple concurrent combats. Results applied via `applyCombatResult()`.

### Sprites

- **Pokémon**: `pokeSprite(species_en, shiny)` → respects `state.settings.classicSprites`. Default mode uses `data/pokemon-sprites-kanto.json` (FireRed/LeafGreen). Classic mode falls back to Showdown gen5 URLs.
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

**Adding a new field to state**: add it in `DEFAULT_STATE` in `app.js` AND in `state/defaultState.js`, then add a migration guard in `migrate()` in `app.js` (and `state/migrateSave.js`) so existing saves don't break.

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
- `state/` — store.js, defaultState.js, migrateSave.js, serialization.js (not yet wired to main app.js)
- `data/` — constants extracted from app.js (all done)

When touching a system that has both an `app.js` implementation and a `modules/` counterpart, check both. Stub functions in `app.js` delegate to the module (`function renderZoneSelector() { _zsRenderSelector(); }`).
