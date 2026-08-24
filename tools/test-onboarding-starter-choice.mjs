import assert from 'node:assert/strict';

import { EventBus, EVENTS } from '../modules/core/eventBus.js';
import { resetStoryLockForTests } from '../modules/core/storyLock.js';
import { ONBOARDING_STEPS } from '../modules/systems/onboardingFlow.js';
import { ONBOARDING_STARTERS, ONBOARDING_ZONE_ID } from '../data/onboarding-data.js';
import {
  configureOnboarding,
  ensureOnboardingStarterChoice,
  startOnboardingV2,
} from '../modules/ui/onboarding.js';

// ── Environnement minimal — même patron que test-onboarding-controller.mjs ──
resetStoryLockForTests();

const overlayClasses = new Set(['active']);
globalThis.document = {
  getElementById: id => (id === 'introOverlay'
    ? { classList: { remove: cls => overlayClasses.delete(cls) } }
    : null),
};

const state = {
  lang: 'fr',
  onboarding: { version: 3, status: 'not_started', step: ONBOARDING_STEPS.NOT_STARTED },
  gang: { initialized: false, bossTeam: [], money: 0 },
  stats: { totalMoneyEarned: 0 },
  agents: [],
};

let fieldSpawns = [];
let openedZone = null;
const analyticsEvents = [];

globalThis.trackEvent = (name, params) => analyticsEvents.push({ name, params });

configureOnboarding({
  getState: () => state,
  resetStateForNewGame: () => {}, // state ci-dessus est déjà "neuf"
  setActiveSaveSlot: () => {},
  saveState: () => {},
  notify: () => {},
  initMissions: () => {},
  switchTab: () => true,
  openZoneWindow: zoneId => { openedZone = zoneId; },
  getZoneSpawns: () => fieldSpawns,
  renderSpawn: (_zoneId, spawn) => { /* le push dans fieldSpawns suffit au test */ },
  removeSpawn: (_zoneId, id) => { fieldSpawns = fieldSpawns.filter(s => s.id !== id); },
  notifyFieldIntro: () => {},
  renderAll: () => {},
});

const capture = (species) => {
  // tryCapture()/doCaptureAttempt() retirent déjà le spawn capturé AVANT
  // d'émettre POKEMON_CAPTURED (zoneWindows.js) — reproduit ici pour que le
  // handler ne voie que les deux non choisis à nettoyer, comme en vrai.
  fieldSpawns = fieldSpawns.filter(s => s.species_en !== species);
  EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: { species_en: species }, zoneId: ONBOARDING_ZONE_ID });
};

// ── Démarrage frais : le trio doit apparaître d'un coup ─────────────────
assert.equal(startOnboardingV2({ slotIdx: 0, resume: false }), true);
await Promise.resolve();

assert.equal(openedZone, ONBOARDING_ZONE_ID);
assert.equal(state.onboarding.step, ONBOARDING_STEPS.FREE_CAPTURE);
assert.equal(fieldSpawns.length, 3);
assert.deepEqual(
  fieldSpawns.map(s => s.species_en).sort(),
  ONBOARDING_STARTERS.map(s => s.en).sort(),
);
assert.ok(fieldSpawns.every(s => s.spawnCtx?.starterChoice === true));
assert.ok(fieldSpawns.every(s => s.timeout === undefined), 'le trio ne doit jamais expirer avant un choix');
assert.ok(analyticsEvents.some(e => e.name === 'starter_choice_shown'));

// Rouvrir la fenêtre (ou tout autre appel) avant un choix ne doit pas dupliquer le trio.
assert.equal(ensureOnboardingStarterChoice(), true);
assert.equal(fieldSpawns.length, 3);

// ── Capture de l'un des trois : les deux autres disparaissent ───────────
const chosen = ONBOARDING_STARTERS[1].en; // nosferapti/zubat
capture(chosen);

assert.equal(fieldSpawns.length, 0, 'les deux non choisis doivent disparaître');
assert.equal(state.onboarding.starterSpecies, chosen);
assert.equal(state.onboarding.fieldCaptures, 1);

const shownEvt = analyticsEvents.find(e => e.name === 'starter_choice_shown');
const completedEvt = analyticsEvents.find(e => e.name === 'starter_choice_completed');
const firstCaptureEvt = analyticsEvents.find(e => e.name === 'first_wild_capture');
assert.ok(shownEvt, 'starter_choice_shown should fire');
assert.ok(completedEvt, 'starter_choice_completed should fire');
assert.equal(completedEvt.params.species, chosen);
assert.ok(firstCaptureEvt, 'first_wild_capture should still fire for the chosen starter');
assert.equal(firstCaptureEvt.params.species, chosen);
// Ordre : montré avant complété avant la capture "officielle" du tunnel.
assert.ok(analyticsEvents.indexOf(shownEvt) < analyticsEvents.indexOf(completedEvt));
assert.ok(analyticsEvents.indexOf(completedEvt) <= analyticsEvents.indexOf(firstCaptureEvt));

// ── Idempotence après résolution : plus jamais de replant ───────────────
assert.equal(ensureOnboardingStarterChoice(), false);
assert.equal(fieldSpawns.length, 0);

// Une capture normale ultérieure ne doit plus toucher au trio ni le déclencher.
capture('rattata');
assert.equal(state.onboarding.fieldCaptures, 2);
assert.equal(state.onboarding.starterSpecies, chosen); // inchangé
assert.equal(analyticsEvents.filter(e => e.name === 'starter_choice_completed').length, 1);

console.log('onboarding starter-choice tests: ok');
