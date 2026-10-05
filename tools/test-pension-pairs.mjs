import assert from 'node:assert/strict';

import {
  EGG_GEN_MS,
  getMaxPensionPairs,
  getNextPairPrice,
  reconcilePensionPairs,
  removeFromPension,
} from '../modules/systems/pensionPairs.js';
import {
  getEggIncubationSummary,
  markEggsReady,
  recordEggHatched,
  tryAutoIncubateWithAgents,
} from '../modules/systems/eggIncubation.js';
import { migrateSave } from '../state/migrateSave.js';
import { DEFAULT_STATE, SAVE_SCHEMA_VERSION } from '../state/defaultState.js';

const pk = id => ({ id });
function stateOf({ slots = [], extraPairs = 0, pokemons = null } = {}) {
  return {
    pokemons: pokemons || slots.map(pk),
    agents: [],
    eggs: [],
    purchases: {},
    pension: { slots: [...slots], pairs: [], extraPairsPurchased: extraPairs, eggAt: null,
      eggIncubation: { priorityAgentIds: [], preferAvailable: true, allowFallback: true } },
  };
}

// ── Couples : sièges fixes, un minuteur par couple ───────────────────────────
{
  const state = stateOf({ slots: ['a', 'b', 'c'], extraPairs: 1, pokemons: ['a', 'b', 'c', 'd'].map(pk) });
  reconcilePensionPairs(state, 1000);
  const [p1, p2] = state.pension.pairs;
  assert.deepEqual([p1.a, p1.b, p2.a, p2.b], ['a', 'b', 'c', null]);
  assert.equal(p1.eggAt, 1000 + EGG_GEN_MS, 'complete pair starts its own timer');
  assert.equal(p2.eggAt, null, 'half-empty pair has no timer');

  // Retirer un membre libère SON siège : l'autre couple ne bouge pas.
  removeFromPension('a', state);
  assert.deepEqual([p1.a, p1.b, p2.a, p2.b], [null, 'b', 'c', null]);
  assert.equal(p1.eggAt, null, 'incomplete pair loses its timer');

  // Un nouvel arrivant prend le premier siège libre, sans re-tirer les couples.
  state.pension.slots.push('d');
  reconcilePensionPairs(state, 2000);
  assert.deepEqual([p1.a, p1.b, p2.a, p2.b], ['d', 'b', 'c', null]);
  assert.equal(state.pension.eggAt, p1.eggAt, 'p.eggAt mirrors the earliest pair timer');
}

{
  const state = stateOf({ slots: ['a', 'b', 'c'], extraPairs: 0 });
  reconcilePensionPairs(state, 0);
  assert.deepEqual(state.pension.slots, ['a', 'b'], 'residents beyond the bought pairs are dropped');
  assert.equal(getMaxPensionPairs(state), 1);
  assert.equal(getNextPairPrice(state), 200000);
  state.pension.extraPairsPurchased = 2;
  assert.equal(getNextPairPrice(state), null, 'pairs are capped at 3');
}

// L'ancien minuteur unique alimente le premier couple (migration).
{
  const state = stateOf({ slots: ['a', 'b'] });
  state.pension.eggAt = 5000;
  reconcilePensionPairs(state, 0);
  assert.equal(state.pension.pairs[0].eggAt, 5000);
}

// ── L'agent dépose l'œuf prêt à la base et récupère le suivant ───────────────
{
  const agent = { id: 'a1', name: 'A1', legacyLocked: false, eggStats: { hatched: 0 } };
  const state = stateOf();
  state.agents = [agent];
  state.eggs = [{ id: 'e1', hatchMs: 60000 }, { id: 'e2', hatchMs: 60000 }];

  // Sans Joëlle la pension est fermée : aucun agent ne va chercher d'œuf.
  assert.equal(tryAutoIncubateWithAgents({ state, baseMsForEgg: e => e.hatchMs, now: 0 }), 0);
  state.purchases.autoIncubator = true;
  assert.equal(tryAutoIncubateWithAgents({ state, baseMsForEgg: e => e.hatchMs, now: 0 }), 1);
  assert.equal(getEggIncubationSummary(state).free, 0);

  assert.equal(markEggsReady(state, 60000), 1);
  const [e1, e2] = state.eggs;
  assert.equal(e1.status, 'ready');
  assert.equal(e1.incubating, false, 'a ready egg no longer holds the agent slot');
  assert.equal(e1.incubationAgentId, 'a1', 'referent kept to be credited at opening');
  assert.equal(getEggIncubationSummary(state).free, 1);
  assert.equal(getEggIncubationSummary(state).ready, 1);

  assert.equal(tryAutoIncubateWithAgents({ state, baseMsForEgg: e => e.hatchMs, now: 60000 }), 1);
  assert.equal(e2.incubating, true, 'the agent fetched the next waiting egg');

  assert.equal(recordEggHatched(e1, state).id, 'a1');
  assert.equal(agent.eggStats.hatched, 1);
}

// Anciennes sauvegardes : un œuf prêt qui gardait son slot est libéré.
{
  const state = stateOf();
  state.eggs = [{ id: 'old', status: 'ready', incubating: true, hatchAt: 1 }];
  assert.equal(markEggsReady(state, 10), 0);
  assert.equal(state.eggs[0].incubating, false);
}

// ── Migration des slots achetés un par un → couples ──────────────────────────
function migrate(extraSlotsPurchased, money = 0) {
  return migrateSave({
    _schemaVersion: 18,
    gang: { money },
    pension: { slots: [], extraSlotsPurchased },
  }, { DEFAULT_STATE, SAVE_SCHEMA_VERSION, SPECIES_BY_EN: {}, uid: () => 'uid' });
}
{
  assert.equal(migrate(0).pension.extraPairsPurchased, 0);
  assert.equal(migrate(2).pension.extraPairsPurchased, 1);
  assert.equal(migrate(4).pension.extraPairsPurchased, 2);

  const odd1 = migrate(1, 1000);
  assert.equal(odd1.pension.extraPairsPurchased, 0);
  assert.equal(odd1.gang.money, 1000 + 50000, 'lone 3rd slot is refunded');

  const odd3 = migrate(3, 0);
  assert.equal(odd3.pension.extraPairsPurchased, 1);
  assert.equal(odd3.gang.money, 300000, 'lone 5th slot is refunded');

  assert.equal('extraSlotsPurchased' in odd3.pension, false, 'legacy key is dropped (no double refund)');
  assert.equal(migrate(4).gang.money, 0);

  // Idempotent : une sauvegarde déjà migrée ne rembourse rien.
  const again = migrateSave({ ...odd3, _schemaVersion: SAVE_SCHEMA_VERSION - 1 },
    { DEFAULT_STATE, SAVE_SCHEMA_VERSION, SPECIES_BY_EN: {}, uid: () => 'uid' });
  assert.equal(again.gang.money, 300000);
  assert.equal(again.pension.extraPairsPurchased, 1);
}

// ── Joëlle passe de 300 000₽ à 100 000₽ : 200 000₽ rendus une seule fois ─────
{
  const opts = { DEFAULT_STATE, SAVE_SCHEMA_VERSION, SPECIES_BY_EN: {}, uid: () => 'uid' };
  const old = migrateSave({ _schemaVersion: 19, gang: { money: 10 }, purchases: { autoIncubator: true } }, opts);
  assert.equal(old.gang.money, 200010);
  const never = migrateSave({ _schemaVersion: 19, gang: { money: 10 }, purchases: {} }, opts);
  assert.equal(never.gang.money, 10, 'no refund without the purchase');
  const again = migrateSave({ ...old, _schemaVersion: SAVE_SCHEMA_VERSION }, opts);
  assert.equal(again.gang.money, 200010, 'already at the new schema: no second refund');
}

console.log('test-pension-pairs: OK');
