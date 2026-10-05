import assert from 'node:assert/strict';

import {
  pityRoll, pityThreshold, rollQuestItemDrops,
} from '../modules/systems/questDrops.js';
import {
  rollQuestCapture, rollQuestPotential, finalizeQuestPokemon, QUEST_MIN_POTENTIAL,
} from '../modules/systems/questCombat.js';
import { EventBus, EVENTS } from '../modules/core/eventBus.js';
import { MISSION_REWARD_SHINY_RATE, BASE_SHINY_RATE } from '../data/gameplay-config-data.js';
import { migrateSave } from '../state/migrateSave.js';
import { DEFAULT_STATE, SAVE_SCHEMA_VERSION } from '../state/defaultState.js';

const seq = (...values) => { let i = 0; return () => values[Math.min(i++, values.length - 1)]; };

// ── 1. Capture garantie ───────────────────────────────────────────────────────
assert.deepEqual(rollQuestCapture(), { caught: true, chance: 1 });

// ── 2. Potentiel : plancher ★3, plafond ★5, affaiblissement = meilleur tirage ─
assert.equal(QUEST_MIN_POTENTIAL, 3);
assert.equal(rollQuestPotential({ minPot: 3, random: () => 0 }), 3);
assert.equal(rollQuestPotential({ minPot: 3, random: () => 0.59 }), 3);
assert.equal(rollQuestPotential({ minPot: 3, random: () => 0.6 }), 4);
assert.equal(rollQuestPotential({ minPot: 3, random: () => 0.9 }), 5);
assert.equal(rollQuestPotential({ minPot: 2, random: () => 0 }), 3, 'les ★2 (Trio du Lac) montent au plancher ★3');
assert.equal(rollQuestPotential({ minPot: 5, random: () => 0.99 }), 5, 'un légendaire ★5 reste ★5');
assert.equal(rollQuestPotential({ minPot: 4, random: () => 0.95 }), 5, 'plafond ★5');
assert.equal(rollQuestPotential({ minPot: 3, weakenPct: 0.6, random: () => 0.3 }), 4, 'affaibli : +0,3 sur le tirage');
assert.equal(rollQuestPotential({ minPot: 3, weakenPct: 0.6, random: () => 0.61 }), 5);

{
  // Distribution mesurée : sans affaiblissement ~60/30/10 ; à −60 % ~30/30/40.
  const dist = weakenPct => {
    const n = 200000, out = { 3: 0, 4: 0, 5: 0 };
    for (let i = 0; i < n; i++) out[rollQuestPotential({ minPot: 3, weakenPct })]++;
    return [3, 4, 5].map(k => out[k] / n);
  };
  const base = dist(0), weak = dist(0.6);
  assert.ok(Math.abs(base[0] - 0.6) < 0.01 && Math.abs(base[1] - 0.3) < 0.01 && Math.abs(base[2] - 0.1) < 0.01, `base ${base}`);
  assert.ok(Math.abs(weak[0] - 0.3) < 0.01 && Math.abs(weak[1] - 0.3) < 0.01 && Math.abs(weak[2] - 0.4) < 0.01, `affaibli ${weak}`);
}

// ── 3. Chroma de quête : 2 %, et le taux de chasse n'a pas bougé ──────────────
assert.equal(MISSION_REWARD_SHINY_RATE, BASE_SHINY_RATE * 4);
assert.equal(BASE_SHINY_RATE, 0.005, 'taux de chasse inchangé');
{
  const notes = [];
  const off = EventBus.on(EVENTS.UI_NOTIFY, p => notes.push(p));
  const mk = () => ({ id: 'pk', level: 1, potential: 1, shiny: false });
  const normal = finalizeQuestPokemon(mk(), { level: 54, potential: 4 }, () => 0.5);
  assert.deepEqual([normal.level, normal.potential, normal.shiny], [54, 4, false]);
  const shiny = finalizeQuestPokemon(mk(), { level: 70, potential: 5 }, () => MISSION_REWARD_SHINY_RATE - 1e-9);
  assert.equal(shiny.shiny, true);
  assert.equal(notes.length, 1, 'une notification pour un légendaire chromatique');
  const edge = finalizeQuestPokemon(mk(), { level: 70, potential: 5 }, () => MISSION_REWARD_SHINY_RATE);
  assert.equal(edge.shiny, false);
  if (typeof off === 'function') off();
}

// ── 4. Pitié ──────────────────────────────────────────────────────────────────
assert.equal(pityThreshold(0.02), 75, 'ailes : 75 tirages');
assert.equal(pityThreshold(0.01), 150);
assert.equal(pityThreshold(0.5), 3);
assert.equal(pityThreshold(0), Infinity);
{
  const state = {};
  // Malchance totale : le drop est garanti au tirage suivant la pitié, jamais plus tard.
  const never = () => 0.999;
  let rolls = 0, dropped = false;
  while (!dropped) { rolls++; dropped = pityRoll(state, 'wing', 0.02, { random: never }); assert.ok(rolls < 1000); }
  assert.equal(rolls, 76, 'pitié après 75 ratés : le 76e tirage tombe');
  assert.equal(state.dropPity.wing, undefined, 'compteur remis à zéro');

  // Chance normale : un tirage chanceux remet aussi le compteur à zéro.
  state.dropPity = { wing: 10 };
  assert.equal(pityRoll(state, 'wing', 0.02, { random: () => 0 }), true);
  assert.equal(state.dropPity.wing, undefined);
  assert.equal(pityRoll(state, 'wing', 0.02, { random: () => 0.5 }), false);
  assert.equal(state.dropPity.wing, 1);

  // La pitié ne fausse pas la moyenne : drop moyen ≈ 1 / chance sans pitié, un peu moins avec.
  let total = 0, runs = 5000;
  for (let r = 0; r < runs; r++) {
    const st = {}; let n = 0;
    do { n++; } while (!pityRoll(st, 'x', 0.02));
    total += n;
    assert.ok(n <= 76);
  }
  const mean = total / runs;
  assert.ok(mean > 35 && mean < 50, `moyenne ${mean} (≈ 44 attendue : 50 sans pitié, bornée à 76)`);
}

// ── 5. Drops de zone : mêmes données que les SPECIAL_EVENTS ──────────────────
globalThis.SPECIAL_EVENTS = [
  { id: 'silver_wing_found', fr: "Argent'Aile trouvée !", en: 'Silver Wing Found!', icon: '🪶',
    trainerKey: null, chance: 0.02, minRep: 400, zoneIds: ['whirl_islands'], reward: { itemGift: 'silver_wing' } },
  { id: 'raikou_sighting', trainerKey: 'x', chance: 1, minRep: 0, zoneIds: ['whirl_islands'], reward: {} },
];
{
  const received = [];
  const off = EventBus.on(EVENTS.ITEM_RECEIVED, p => received.push(p.itemId));
  const state = { gang: { reputation: 500 }, inventory: {}, lang: 'fr', dropPity: { silver_wing_found: 75 } };
  assert.equal(rollQuestItemDrops('route1', state), false, 'autre zone : rien');
  assert.equal(rollQuestItemDrops('whirl_islands', { ...state, gang: { reputation: 100 } }), false, 'réputation insuffisante');
  assert.equal(rollQuestItemDrops('whirl_islands', state), true, 'pitié atteinte : drop garanti');
  assert.equal(state.inventory.silver_wing, 1);
  assert.deepEqual(received, ['silver_wing']);
  assert.equal(state.dropPity.silver_wing_found, undefined);
  if (typeof off === 'function') off();
}

// ── 6. Migration : dropPity ──────────────────────────────────────────────────
{
  const opts = { DEFAULT_STATE, SAVE_SCHEMA_VERSION, SPECIES_BY_EN: {}, uid: () => 'uid' };
  assert.deepEqual(migrateSave({ _schemaVersion: 20, gang: { money: 0 } }, opts).dropPity, {});
  const kept = migrateSave({ _schemaVersion: 20, gang: { money: 0 }, dropPity: { a: 3 } }, opts);
  assert.deepEqual(kept.dropPity, { a: 3 });
}

console.log('test-quest-rewards: OK');
