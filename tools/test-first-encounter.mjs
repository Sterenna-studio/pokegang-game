import assert from 'node:assert/strict';

import { EventBus, EVENTS } from '../modules/core/eventBus.js';
import {
  FIRST_ENCOUNTER_ZONE_ID,
  createFirstEncounterSpawns,
  openFirstEncounter,
  reseedFirstEncounterSpawns,
} from '../modules/ui/firstEncounter.js';

let id = 0;
const built = createFirstEncounterSpawns(() => `spawn-${++id}`);
assert.deepEqual(built.map(spawn => spawn.species_en), ['meowth', 'zubat', 'gastly']);
assert.equal(new Set(built.map(spawn => spawn.id)).size, 3);
assert.ok(built.every(spawn => spawn.type === 'pokemon'));
assert.ok(built.every(spawn => spawn.spawnCtx.onboarding));
assert.ok(built.every(spawn => spawn.spawnCtx.firstEncounter));

// ── Re-seed guard ────────────────────────────────────────────────
// Closing the Route 1 window deletes its spawn list while tickZoneSpawn is
// muted for this step, which used to strand the player on an empty zone with
// every other tab locked.
const emptied = [];
const reseedRendered = [];
assert.equal(
  reseedFirstEncounterSpawns(emptied, { uid: () => `re-${++id}`, renderSpawn: (zoneId, spawn) => reseedRendered.push({ zoneId, spawn }) }),
  true,
);
assert.deepEqual(emptied.map(spawn => spawn.species_en), ['meowth', 'zubat', 'gastly']);
assert.equal(reseedRendered.length, 3);
assert.ok(reseedRendered.every(entry => entry.zoneId === FIRST_ENCOUNTER_ZONE_ID));

// Never duplicates onto a zone that still holds its starters, and tolerates a
// missing spawn list (zone closed between the check and the call).
assert.equal(reseedFirstEncounterSpawns(emptied, { uid: () => 'dup' }), false);
assert.equal(emptied.length, 3);
assert.equal(reseedFirstEncounterSpawns(undefined, { uid: () => 'nope' }), false);

const zoneSpawns = [{ id: 'stale-spawn', type: 'pokemon', species_en: 'rattata' }];
const rendered = [];
const removed = [];
let switchedTab = null;
let openedZone = null;
let hubHidden = false;
let captured = null;

const removeSpawn = (_zoneId, spawnId) => {
  removed.push(spawnId);
  const index = zoneSpawns.findIndex(spawn => spawn.id === spawnId);
  if (index >= 0) zoneSpawns.splice(index, 1);
};

const encounter = openFirstEncounter({
  switchTab: tabId => { switchedTab = tabId; return true; },
  openZoneWindow: zoneId => { openedZone = zoneId; },
  getZoneSpawns: () => zoneSpawns,
  renderSpawn: (zoneId, spawn) => rendered.push({ zoneId, spawn }),
  removeSpawn,
  uid: () => `runtime-${++id}`,
  hideHub: () => { hubHidden = true; },
  notify: () => {},
  onCaptured: pokemon => { captured = pokemon; return true; },
});

assert.equal(switchedTab, 'tabZones');
assert.equal(openedZone, FIRST_ENCOUNTER_ZONE_ID);
assert.equal(hubHidden, true);
assert.equal(removed.includes('stale-spawn'), true);
assert.equal(zoneSpawns.length, 3);
assert.equal(rendered.length, 3);

EventBus.emit(EVENTS.POKEMON_CAPTURED, {
  pokemon: { species_en: 'rattata' },
  zoneId: FIRST_ENCOUNTER_ZONE_ID,
  spawnCtx: {},
});
assert.equal(captured, null);

// Simulate the re-seed that a close/reopen triggers: the ids the encounter
// closed over are gone, so cleanup has to work off the live spawn list.
const staleSpawnIds = zoneSpawns.map(spawn => spawn.id);
zoneSpawns.length = 0;
zoneSpawns.push(...createFirstEncounterSpawns(() => `reseeded-${++id}`));

const selectedSpawn = zoneSpawns.find(spawn => spawn.species_en === 'zubat');
const liveSpawnIds = zoneSpawns.map(spawn => spawn.id);
const selectedPokemon = { id: 'pk-zubat', species_en: 'zubat', capturedIn: 'route1' };
EventBus.emit(EVENTS.POKEMON_CAPTURED, {
  pokemon: selectedPokemon,
  zoneId: FIRST_ENCOUNTER_ZONE_ID,
  spawnCtx: selectedSpawn.spawnCtx,
});

const result = await encounter;
assert.equal(result.species, 'zubat');
assert.equal(result.pokemon, selectedPokemon);
assert.equal(captured, selectedPokemon);
// Every starter still on the zone is cleared, whatever its id generation.
assert.deepEqual(zoneSpawns, []);
assert.ok(liveSpawnIds.every(spawnId => removed.includes(spawnId)));
assert.ok(staleSpawnIds.every(spawnId => !removed.includes(spawnId)));

console.log('first encounter tests: ok');
