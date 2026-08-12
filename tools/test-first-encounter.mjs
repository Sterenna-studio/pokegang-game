import assert from 'node:assert/strict';

import { EventBus, EVENTS } from '../modules/core/eventBus.js';
import {
  FIRST_ENCOUNTER_ZONE_ID,
  createFirstEncounterSpawns,
  openFirstEncounter,
} from '../modules/ui/firstEncounter.js';

let id = 0;
const built = createFirstEncounterSpawns(() => `spawn-${++id}`);
assert.deepEqual(built.map(spawn => spawn.species_en), ['meowth', 'zubat', 'gastly']);
assert.equal(new Set(built.map(spawn => spawn.id)).size, 3);
assert.ok(built.every(spawn => spawn.type === 'pokemon'));
assert.ok(built.every(spawn => spawn.spawnCtx.onboarding));
assert.ok(built.every(spawn => spawn.spawnCtx.guaranteedCapture));

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

const selectedSpawn = zoneSpawns.find(spawn => spawn.species_en === 'zubat');
const rejectedSpawnIds = zoneSpawns
  .filter(spawn => spawn.species_en !== 'zubat')
  .map(spawn => spawn.id);
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
assert.deepEqual(zoneSpawns.map(spawn => spawn.species_en), ['zubat']);
assert.ok(rejectedSpawnIds.every(spawnId => removed.includes(spawnId)));

console.log('first encounter tests: ok');
