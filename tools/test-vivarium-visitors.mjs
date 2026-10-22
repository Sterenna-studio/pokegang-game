import assert from 'node:assert/strict';
import {
  HOOH_CLICK_COOLDOWN_MS, HOOH_MAX_SPEED_FACTOR,
  advanceRainbowWingQuest, collectVivariumWing, isHoohEventCameo, isWithinClickCooldown, nextHoohSpeedFactor,
} from '../modules/systems/vivariumRewards.js';
import { buildVivariumCameoPool } from '../modules/systems/vivariumSnapshot.js';
import { cameoLocation } from '../modules/systems/vivariumZones.js';
import { vivariumSpeechDuration } from '../gang/vivariumSpeech.js';

assert.equal(vivariumSpeechDuration('Bonjour !'), 6500);
assert.ok(vivariumSpeechDuration('Une longue discussion entre deux patrouilles. '.repeat(4)) > 10000);
assert.equal(vivariumSpeechDuration('x'.repeat(1000)), 14000);

const state = { inventory: { rainbow_wing: 7, silver_wing: 2 },
  hoohMission: { active: true, step: 2, rainbowWings: 3 }, gang: {},
  agents: [{ name: 'Patrouilleur', assignedZone: 'route1', resting: false, team: [] }], pokemons: [] };
globalThis.pokeSprite = name => `${name}.png`;
globalThis.trainerSprite = name => `${name}.png`;
globalThis.ZONE_BY_ID = { route1: {} };
globalThis.TITLES = [];
const before = JSON.stringify(state);
const pool = buildVivariumCameoPool(state);
assert.equal(JSON.stringify(state), before, 'Visit planning never moves or interrupts an agent');
assert.equal(pool.find(c => c.type === 'agent').location, 'rest');
assert.equal(cameoLocation({ type: 'agent', resting: false }), 'rest');
assert.equal(pool.find(c => c.type === 'event').dex, 250);
collectVivariumWing(state);
assert.equal(state.inventory.rainbow_wing, 8);
assert.equal(state.hoohMission.rainbowWings, 4);
collectVivariumWing(state);
assert.equal(state.hoohMission.step, 3);
assert.equal(state.hoohMission.rainbowWings, 5);
collectVivariumWing(state);
assert.equal(state.hoohMission.rainbowWings, 5);
assert.equal(state.inventory.silver_wing, 2);
const main = { inventory: {}, hoohMission: { active: true, step: 2, rainbowWings: 0 } };
let received = 0;
collectVivariumWing(main, payload => {
  assert.deepEqual(payload, { itemId: 'rainbow_wing', qty: 1 });
  received++;
  advanceRainbowWingQuest(main);
});
assert.equal(received, 1);
assert.equal(main.hoohMission.rainbowWings, 1, 'Main-game quest listener handles the wing once');
assert.equal(main.inventory.rainbow_wing, 1);
const locked = { hoohMission: { active: false, step: 2, rainbowWings: 0 } };
collectVivariumWing(locked);
assert.equal(locked.hoohMission.rainbowWings, 0);
// Ho-Oh : délai de 0,1 s entre deux clics, et chaque plume tombée rend la suivante plus dure.
assert.equal(HOOH_CLICK_COOLDOWN_MS, 100);
assert.equal(isWithinClickCooldown(null, 1000), false, 'premier clic toujours accepté');
assert.equal(isWithinClickCooldown(1000, 1050), true);
assert.equal(isWithinClickCooldown(1000, 1100), false);
let factor = 1, last = 1;
const steps = [];
for (let wings = 1; wings <= 6; wings++) {
  const next = nextHoohSpeedFactor(factor, wings);
  steps.push(next / factor);
  assert.ok(next > factor || next === HOOH_MAX_SPEED_FACTOR);
  factor = next;
}
assert.ok(steps.every((r, i) => i === 0 || r > steps[i - 1] || factor === HOOH_MAX_SPEED_FACTOR),
  'le rapport d’accélération grandit avec les plumes déjà tombées');
for (let i = 0; i < 50; i++) factor = nextHoohSpeedFactor(factor, 50);
assert.equal(factor, HOOH_MAX_SPEED_FACTOR, 'plafonné');
assert.ok(nextHoohSpeedFactor(1, 0) < nextHoohSpeedFactor(1, 4), 'sans plume, l’accélération reste douce');
// Seul le cameo d’événement dispense des plumes : un Ho-Oh mis en favori n’est qu’un visiteur.
assert.equal(isHoohEventCameo({ type: 'event', dex: 250 }), true);
assert.equal(isHoohEventCameo({ type: 'favorite', dex: 250 }), false);
assert.equal(isHoohEventCameo({ type: 'event', dex: 25 }), false);
assert.equal(isHoohEventCameo(null), false);

console.log('PASS visitors: assigned agents visit without mutation; wings persist, quest progresses once, inactive quests stay inactive');
