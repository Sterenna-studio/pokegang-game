import assert from 'node:assert/strict';

import {
  getAgentReadyEggs,
  getAgentEggDialogueLines,
  getEggIncubationSummary,
  getReadyEggs,
  groupReadyEggsByAgent,
  markEggsReady,
  getAgentHatchMultiplier,
  pickEggIncubationAgent,
  reconcileEggIncubationAssignments,
  recordEggHatched,
  setEggIncubationPriority,
  startEggIncubation,
  suspendEggIncubation,
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

// ── Suspension / reprise ──────────────────────────────────────────────────────
// Un œuf dont plus aucun agent ne peut être référent (agents renvoyés, prestige)
// restait incubating:true avec incubationAgentId:null : il poursuivait son compte
// à rebours sans référent, personne n'était crédité à l'éclosion, et
// summary.used dépassait summary.capacity.
{
  const state = stateOf({ agents: [agent('a1')], eggs: [{ id: 'e1' }] });
  startEggIncubation(state.eggs[0], { state, baseMs: 60000, now: 0 });
  state.agents = [];
  assert.equal(reconcileEggIncubationAssignments(state), true);

  const egg = state.eggs[0];
  assert.equal(egg.incubating, false, 'egg is released instead of left orphaned');
  assert.equal(egg.incubationAgentId, null);
  assert.ok(egg.incubationRemainingMs > 0, 'progress is preserved');

  const summary = getEggIncubationSummary(state);
  assert.ok(summary.used <= summary.capacity, 'used never exceeds capacity');
  assert.equal(summary.waiting, 1, 'egg shows up as waiting again');
}

// Un œuf prêt reste éclosable même sans référent.
{
  const egg = { id: 'e1', incubating: true, status: 'ready' };
  assert.equal(suspendEggIncubation(egg), false);
  assert.equal(egg.incubating, true);
}

// La progression ne doit JAMAIS remonter entre deux cycles suspension/reprise :
// la base du cycle en cours est mémorisée, sinon la 2e suspension repartait de
// hatchMs et redonnait au joueur le temps déjà acquis.
{
  const MIN = 60000;
  const state = stateOf({ agents: [agent('rookie')], eggs: [{ id: 'e1' }] });
  const egg = state.eggs[0];
  let t = 1000000;

  startEggIncubation(egg, { state, baseMs: 45 * MIN, now: t });
  assert.equal(egg.hatchAt - egg.incubatedAt, 45 * MIN, 'rookie referent: no speed-up');

  t += 10 * MIN;
  suspendEggIncubation(egg, t);
  const after10 = egg.incubationRemainingMs;
  assert.equal(Math.round(after10 / MIN), 35, '45 - 10 x 1.00');

  state.agents = [agent('expert', { eggStats: { hatched: 120, lastHatchedAt: null } })];
  startEggIncubation(egg, { state, now: t });
  assert.equal(Math.round((egg.hatchAt - egg.incubatedAt) / MIN), 30, '35 / 1.15 real minutes');
  assert.equal(egg.incubationRemainingMs, undefined, 'remainder is consumed on resume');

  t += 5 * MIN;
  suspendEggIncubation(egg, t);
  assert.ok(egg.incubationRemainingMs < after10, 'progress must never go backwards');
  assert.equal(Math.round(egg.incubationRemainingMs / MIN), 29, '35 - 5 x 1.15');
}

// Les clés techniques ne doivent pas survivre à l'éclosion.
{
  const state = stateOf({ agents: [agent('a1')], eggs: [{ id: 'e1' }] });
  startEggIncubation(state.eggs[0], { state, baseMs: 60000, now: 0 });
  recordEggHatched(state.eggs[0], state);
  assert.equal(state.eggs[0].incubationBaseMs, undefined);
  assert.equal(state.eggs[0].incubationRemainingMs, undefined);
}

// « À éclore » : l'œuf prêt reste rattaché à son agent (pile), sans bloquer son slot —
// l'agent couve le suivant pendant que les prêts s'empilent.
{
  const MIN = 60000;
  const state = stateOf({
    agents: [agent('a1'), agent('a2')],
    eggs: [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }, { id: 'e4' }],
  });
  const a1 = state.agents[0];
  let t = 1000;

  // a1 et a2 couvent e1 / e2 ; e3 et e4 attendent un slot libre.
  assert.equal(tryAutoIncubateWithAgents({ state, baseMsForEgg: 10 * MIN, now: t }), 2);
  const owner = id => state.eggs.find(e => e.id === id).incubationAgentId;
  assert.equal(owner('e1'), 'a1');

  // e1 arrive à terme : prêt, rattaché à a1, et le slot de a1 est libre.
  t += 10 * MIN;
  assert.equal(markEggsReady(state, t), 2, 'e1 et e2 livrés');
  assert.equal(getEggIncubationSummary(state).used, 0, 'les œufs prêts ne tiennent plus de slot');
  assert.deepEqual(getAgentReadyEggs(a1, state).map(e => e.id), ['e1']);
  assert.equal(owner('e1'), 'a1', 'le référent reste mémorisé sur l’œuf prêt');

  // a1 repart chercher un œuf PENDANT que le sien attend d'être ouvert : ça s'empile.
  assert.equal(tryAutoIncubateWithAgents({ state, baseMsForEgg: 10 * MIN, now: t }), 2);
  assert.equal(owner('e3'), 'a1');
  t += 10 * MIN;
  markEggsReady(state, t);
  assert.deepEqual(getAgentReadyEggs(a1, state).map(e => e.id), ['e1', 'e3'], 'pile triée par livraison');
  assert.equal(getReadyEggs(state).length, 4);

  const { byAgent, orphans } = groupReadyEggsByAgent(state);
  assert.equal(byAgent.get('a1').length, 2);
  assert.equal(byAgent.get('a2').length, 2);
  assert.equal(orphans.length, 0);

  // L'agent annonce sa pile même s'il couve déjà autre chose.
  const lines = getAgentEggDialogueLines(a1, state);
  assert.ok(lines.some(l => /2 œufs/.test(l) || /2 eggs/.test(l)), 'la pile est annoncée avec son nombre');

  // Un agent renvoyé : ses œufs prêts restent ouvrables, en « orphelins ».
  state.agents = state.agents.filter(a => a.id !== 'a2');
  const regrouped = groupReadyEggsByAgent(state);
  assert.equal(regrouped.byAgent.has('a2'), false);
  assert.deepEqual(regrouped.orphans.map(e => e.id).sort(), ['e2', 'e4']);
}

console.log('egg incubation tests passed');
