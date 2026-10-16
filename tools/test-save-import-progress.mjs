import assert from 'node:assert/strict';
import { makeSaveProgressFixture, progressOf } from './fixtures/save-progress.mjs';
import { DEFAULT_STATE, SAVE_SCHEMA_VERSION } from '../state/defaultState.js';
import { migrateSave } from '../state/migrateSave.js';
import { buildSavePayload } from '../state/serialization.js';
import { cleanObsoleteData, configureSaveRepair } from '../state/saveRepair.js';
import { getKnownSaveZones, getObsoleteSaveZoneIds } from '../state/zoneCatalog.js';

const { state, catalogs } = makeSaveProgressFixture();
Object.assign(globalThis, catalogs);
const original = structuredClone(state);
const kantoIds = new Set(catalogs.ZONES.map(z => z.id));
assert.ok(Object.keys(state.zones).some(id => !kantoIds.has(id)), 'Old hub catalog loses regional gyms');
assert.deepEqual(getObsoleteSaveZoneIds(state), []);
configureSaveRepair({ getZones: getKnownSaveZones });
const deps = { DEFAULT_STATE, SAVE_SCHEMA_VERSION, SPECIES_BY_EN: {}, uid: () => 'unused' };
for (const serialize of [s => JSON.stringify(s), s => JSON.stringify(buildSavePayload(s))]) {
  const draft = JSON.parse(serialize(state));
  draft.zones.retired_test_zone = { gymDefeated: true };
  assert.deepEqual(getObsoleteSaveZoneIds(draft), ['retired_test_zone']);
  assert.equal(cleanObsoleteData(draft), 1);
  const migrated = migrateSave(draft, deps);
  assert.deepEqual(progressOf(migrated), progressOf(original));
  assert.equal(migrated.inventory.silver_wing, 3);
  assert.equal(migrated.inventory.fragment_temporel, 2);
  assert.deepEqual(progressOf(migrateSave(JSON.parse(JSON.stringify(migrated)), deps)), progressOf(original));
}
assert.deepEqual(state, original, 'Export and validation must not mutate the source save');
assert.equal(catalogs.ZONES.length, kantoIds.size, 'Validation does not activate other regions');
console.log(`PASS import progress: ${Object.keys(state.zones).length} gyms across four regions, obsolete cleanup, daily/weekly/hourly claims, all legendary quests, counters and second reload`);
