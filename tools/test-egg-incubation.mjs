import assert from 'node:assert/strict';

import {
  getEggIncubationSummary,
  getAgentHatchMultiplier,
  pickEggIncubationAgent,
  reconcileEggIncubationAssignments,
  recordEggHatched,
  setEggIncubationPriority,
  startEggIncubation,
  tryAutoIncubateWithAgents,
} from '../modules/systems/eggIncubation.js';
import { migrateSave } from '../state/migrateSave.js';
import { DEFAULT_STATE, SAVE_SCHEMA_VERSION } from '../state/defaultState.js';

function agent(id, extras = {}) {
  return {
    id,
    name: id,
    legacyLocked: false,
    resting: false,
    assignedZone: null,
    eggStats: { hatched: 0, lastHatchedAt: null },
    ...extras,
  };
}

function stateOf({ agents = [], eggs = [], auto = true } = {}) {
  return {
    agents,
    eggs,
    purchases: { autoIncubator: auto, autoIncubatorEnabled: true },
    pension: {
      slots: [],
      extraSlotsPurchased: 0,
      eggAt: null,
      eggIncubation: { priorityAgentIds: [], preferAvailable: true, allowFallback: true },
    },
  };
}

{
  const state = stateOf({
    agents: [agent('a1'), agent('a2')],
    eggs: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }],
  });

  assert.equal(tryAutoIncubateWithAgents({ state, baseMsForEgg: 60000, now: 1000 }), 2);
  assert.deepEqual(getEggIncubationSummary(state), {
    capacity: 2,
    used: 2,
    inProgress: 2,
    ready: 0,
    waiting: 1,
    free: 0,
  });
  assert.equal(state.eggs[0].incubationAgentId, 'a1');
  assert.equal(state.eggs[1].incubationAgentId, 'a2');
  assert.equal(state.eggs[2].incubating, undefined);
}

{
  const state = stateOf({
    agents: [
      agent('busy', { assignedZone: 'route1' }),
      agent('free'),
      agent('fallback'),
    ],
    eggs: [{ id: 'e1' }],
  });
  setEggIncubationPriority(['busy', 'free'], state);
  assert.equal(pickEggIncubationAgent(state, state.eggs[0]).id, 'free', 'preferAvailable skips busy priority first');
  state.pension.eggIncubation.preferAvailable = false;
  assert.equal(pickEggIncubationAgent(state, state.eggs[0]).id, 'busy', 'priority order is kept when preferAvailable is off');
}

{
  const state = stateOf({
    agents: [agent('a1'), agent('a2')],
    eggs: [
      { id: 'e1', incubating: true, incubationAgentId: 'missing', hatchAt: 9999 },
      { id: 'e2', incubating: true, incubationAgentId: 'a2', hatchAt: 9999 },
    ],
  });
  assert.equal(reconcileEggIncubationAssignments(state), true);
  assert.equal(state.eggs[0].incubationAgentId, 'a1');
  assert.equal(state.eggs[0].hatchAt, 9999, 'reassignment preserves progress timestamps');
}

{
  const ref = agent('ref', { eggStats: { hatched: 50, lastHatchedAt: null } });
  const state = stateOf({ agents: [ref], eggs: [{ id: 'e1' }] });
  assert.equal(getAgentHatchMultiplier(ref), 1.10);
  assert.equal(startEggIncubation(state.eggs[0], { state, baseMs: 110000, now: 0 }), true);
  assert.equal(state.eggs[0].hatchAt, 100000, 'hatch duration is divided by referent multiplier');
  assert.equal(recordEggHatched(state.eggs[0], state).id, 'ref');
  assert.equal(ref.eggStats.hatched, 51);
}

{
  const saved = {
    _schemaVersion: 17,
    agents: [{ id: 'a1', name: 'A1' }],
    eggs: [{ id: 'e1', species_en: 'pichu', incubating: true, hatchAt: 1234 }],
    pension: {},
  };
  const migrated = migrateSave(saved, {
    DEFAULT_STATE,
    SAVE_SCHEMA_VERSION,
    SPECIES_BY_EN: { pichu: { rarity: 'common' } },
    uid: () => 'uid',
  });
  assert.equal(migrated.agents[0].eggStats.hatched, 0);
  assert.equal(migrated.eggs[0].incubationAgentId, 'a1');
  assert.deepEqual(migrated.pension.eggIncubation.priorityAgentIds, []);
}

console.log('egg incubation tests passed');
