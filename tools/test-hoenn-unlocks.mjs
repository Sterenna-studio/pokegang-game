import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { SHOP_ITEMS } from '../data/economy-data.js';
import { DEFAULT_STATE, SAVE_SCHEMA_VERSION } from '../state/defaultState.js';
import { migrateSave } from '../state/migrateSave.js';
import {
  getEarnedHoennStoryUnlocks,
  HOENN_STORY_UNLOCK_IDS,
  reconcileHoennStoryUnlocks,
} from '../modules/systems/hoennUnlocks.js';

function freshState() {
  return structuredClone(DEFAULT_STATE);
}

// Every zone requirement has a localized, non-purchasable definition. This
// prevents the selector from leaking raw technical IDs to players.
assert.deepEqual(HOENN_STORY_UNLOCK_IDS, [
  'magma_hideout_key',
  'aqua_hideout_key',
  'cave_origin_pass',
  'regi_seal',
]);
for (const id of HOENN_STORY_UNLOCK_IDS) {
  const item = SHOP_ITEMS.find(candidate => candidate.id === id);
  assert.ok(item, `${id} must have an item definition`);
  assert.equal(item.hidden, true, `${id} must never be sold in the market`);
  assert.ok(item.fr && item.en && item.desc_fr && item.desc_en);
  assert.equal(DEFAULT_STATE.purchases[id], false);
}

// QG keys are earned independently at each quest's first milestone.
{
  const state = freshState();
  state.groudonMission.active = true;
  state.groudonMission.magmaFightsWon = 19;
  assert.deepEqual(reconcileHoennStoryUnlocks(state), []);
  state.groudonMission.magmaFightsWon = 20;
  assert.deepEqual(reconcileHoennStoryUnlocks(state), ['magma_hideout_key']);
  assert.equal(state.purchases.magma_hideout_key, true);
  assert.equal(state.purchases.aqua_hideout_key, false);
  assert.deepEqual(reconcileHoennStoryUnlocks(state), [], 'reconciliation must be idempotent');
}

{
  const state = freshState();
  state.kyogreMission.active = true;
  state.kyogreMission.step = 2;
  assert.deepEqual(reconcileHoennStoryUnlocks(state), ['aqua_hideout_key']);
}

// Either defeated chief opens the shared Cave of Origin.
{
  const state = freshState();
  state.groudonMission.active = true;
  state.groudonMission.maxieDefeated = true;
  const earned = getEarnedHoennStoryUnlocks(state);
  assert.equal(earned.cave_origin_pass, true);
  assert.deepEqual(reconcileHoennStoryUnlocks(state), ['cave_origin_pass']);
}

// The Regi seal is the capstone after both parallel legendary captures.
{
  const state = freshState();
  state.groudonMission.active = true;
  state.groudonMission.step = 6;
  state.groudonMission.groudonOwned = true;
  state.kyogreMission.active = true;
  state.kyogreMission.step = 5;
  assert.equal(getEarnedHoennStoryUnlocks(state).regi_seal, false);
  state.kyogreMission.step = 6;
  state.kyogreMission.kyogreOwned = true;
  assert.deepEqual(reconcileHoennStoryUnlocks(state), [
    'magma_hideout_key',
    'aqua_hideout_key',
    'cave_origin_pass',
    'regi_seal',
  ]);
}

// Existing saves already past the milestones are repaired during migration.
{
  const saved = freshState();
  saved._schemaVersion = 16;
  for (const id of HOENN_STORY_UNLOCK_IDS) delete saved.purchases[id];
  Object.assign(saved.groudonMission, { active: true, step: 6, groudonOwned: true });
  Object.assign(saved.kyogreMission, { active: true, step: 6, kyogreOwned: true });
  const migrated = migrateSave(saved, {
    DEFAULT_STATE,
    SAVE_SCHEMA_VERSION,
    SPECIES_BY_EN: {},
    uid: () => 'migration-test',
  });
  assert.equal(migrated._schemaVersion, 17);
  for (const id of HOENN_STORY_UNLOCK_IDS) assert.equal(migrated.purchases[id], true);
}

// Live wiring and the opacity regression remain visible to this headless test.
{
  const missionSource = await readFile(new URL('../modules/systems/legendaryMissions.js', import.meta.url), 'utf8');
  const zoneSource = await readFile(new URL('../modules/ui/zoneWindows.js', import.meta.url), 'utf8');
  const marketSource = await readFile(new URL('../modules/ui/marketTab.js', import.meta.url), 'utf8');
  assert.match(missionSource, /_grantEarnedStoryUnlocks\(s\)/);
  assert.match(missionSource, /_grantEarnedStoryUnlocks\(_state\(\)\)/);
  assert.match(marketSource, /!item\.hidden/);
  assert.doesNotMatch(zoneSource, /spawnEl\.style\.opacity = result\.attackerWin/);
  assert.doesNotMatch(zoneSource, /spawnEl\.style\.opacity = win \?/);
  assert.match(zoneSource, /spawnEl\.style\.opacity = '1'/);
}

console.log('Hoenn story unlocks and combat opacity tests: ok');
