import assert from 'node:assert/strict';

import { EventBus, EVENTS } from '../modules/core/eventBus.js';
import { ONBOARDING_STEPS } from '../modules/systems/onboardingFlow.js';
import { ONBOARDING_CAPTURE_GOAL, ONBOARDING_ZONE_ID } from '../data/onboarding-data.js';
import {
  configureOnboarding,
  reconcileOnboardingProgress,
  resumeOnboardingV2,
} from '../modules/ui/onboarding.js';

// ── Environnement minimal ─────────────────────────────────────────
// Le contrôleur touche au DOM (fermeture du hub) et à makeRaidSpawn : on
// stubbe juste ce qu'il consomme, le reste est piloté par l'EventBus.
const overlayClasses = new Set(['active']);
globalThis.document = {
  getElementById: id => (id === 'introOverlay'
    ? { classList: { remove: cls => overlayClasses.delete(cls) } }
    : null),
};
globalThis.makeRaidSpawn = () => ({
  type: 'raid',
  raidTrainers: [{ key: 'rocketgrunt' }, { key: 'rocketgrunt' }, { key: 'rocketgrunt' }],
  trainerKey: 'rocketgrunt',
  trainer: { fr: '[RAID]', en: '[RAID]', reward: [10, 20], rep: 5 },
  team: [],
  isRaid: true,
});

const state = {
  lang: 'fr',
  onboarding: {
    version: 3, status: 'active', step: ONBOARDING_STEPS.FREE_CAPTURE,
    startedAt: 1_000, completedAt: null, fieldCaptures: 0, starterSpecies: null,
    ambushAt: null, ambushWon: false, guideAgentId: null, guideSprite: null,
    firstBattleAt: null, completionRewardGrantedAt: null, completionRewardMoney: 0,
  },
  gang: { initialized: true, bossTeam: [], money: 5_000 },
  stats: { totalMoneyEarned: 0 },
  agents: [],
};

let fieldSpawns = [];
let openedZone = null;
let guideRefreshes = 0;
let guideCleared = 0;
let payoff = null;
let identityOpened = 0;
const analyticsEvents = [];
const completedSteps = [];

globalThis.trackEvent = (name, params) => analyticsEvents.push({ name, params });

configureOnboarding({
  getState: () => state,
  saveState: () => {},
  renderAll: () => {},
  notify: () => {},
  switchTab: () => true,
  openZoneWindow: zoneId => { openedZone = zoneId; },
  getZoneSpawns: () => fieldSpawns,
  renderSpawn: () => {},
  removeSpawn: (_zoneId, id) => { fieldSpawns = fieldSpawns.filter(s => s.id !== id); },
  getZoneById: zoneId => ({ id: zoneId, fr: 'Zone inconnue', en: 'Unknown Field', spawnRate: 0.5 }),
  getActiveSaveSlot: () => 0,
  openGiovanniIntro: ({ onComplete }) => { identityOpened++; onComplete?.({}); return true; },
  showOnboardingIdlePayoff: options => { payoff = options; return true; },
  placeGuide: () => { guideRefreshes++; },
  refreshGuide: () => { guideRefreshes++; },
  clearGuide: () => { guideCleared++; },
});
EventBus.on(EVENTS.ONBOARDING_STEP_COMPLETED, payload => completedSteps.push(payload));

const capture = (zoneId = ONBOARDING_ZONE_ID, species = 'rattata') =>
  EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: { species_en: species }, zoneId });

// ── Capture libre ─────────────────────────────────────────────────
capture(ONBOARDING_ZONE_ID, 'meowth');
assert.equal(state.onboarding.fieldCaptures, 1);
// The very first catch is what Giovanni shows on his summary screen.
assert.equal(state.onboarding.starterSpecies, 'meowth');
assert.equal(analyticsEvents.at(-1).name, 'first_wild_capture');

// Captures elsewhere must not feed the field counter.
capture('route1', 'pidgey');
assert.equal(state.onboarding.fieldCaptures, 1);

for (let i = 1; i < ONBOARDING_CAPTURE_GOAL - 1; i++) capture();
assert.equal(state.onboarding.fieldCaptures, ONBOARDING_CAPTURE_GOAL - 1);
assert.equal(state.onboarding.step, ONBOARDING_STEPS.FREE_CAPTURE);

// ── Embuscade ─────────────────────────────────────────────────────
capture();
assert.equal(state.onboarding.step, ONBOARDING_STEPS.ROCKET_AMBUSH);
assert.equal(openedZone, ONBOARDING_ZONE_ID);
assert.equal(fieldSpawns.length, 1);
assert.equal(fieldSpawns[0].spawnCtx.ambush, true);
assert.equal(fieldSpawns[0].raidTrainers.length, 3);
assert.ok(analyticsEvents.some(e => e.name === 'ambush_started'));
// Le trio d'assaillants est tiré ici et persisté : c'est lui que la modale du
// transfuge proposera, et il doit survivre à un rechargement en pleine scène.
assert.equal(state.onboarding.ambushSprites.length, 3);
assert.equal(new Set(state.onboarding.ambushSprites).size, 3);

// Losing is the expected outcome and must still move the story forward.
EventBus.emit(EVENTS.COMBAT_LOST, { zoneId: ONBOARDING_ZONE_ID, trainerKey: 'rocketgrunt' });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.IDENTITY);
assert.equal(state.onboarding.ambushWon, false);
// The grunts leave the field behind them.
assert.equal(fieldSpawns.length, 0);

// ── Giovanni ──────────────────────────────────────────────────────
await new Promise(resolve => setTimeout(resolve, 1_000));
assert.equal(identityOpened, 1);
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_MET);
assert.equal(overlayClasses.has('active'), false);

// ── Le transfuge ──────────────────────────────────────────────────
const { onGuideRecruited } = await import('../modules/ui/onboarding.js');
state.agents.push({ id: 'guide-1', name: 'Zane', assignedZone: null, team: [], autoCombat: false });
assert.equal(onGuideRecruited('guide-1', 'rocketgrunt'), true);
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_TEAM);
assert.equal(state.onboarding.guideSprite, 'rocketgrunt');
// Recruiting twice must not double-advance.
assert.equal(onGuideRecruited('guide-1', 'rocketgrunt'), false);

// « Confie-moi un Pokémon » — seule SON équipe compte.
EventBus.emit(EVENTS.TEAM_MEMBER_SET, { team: 'boss', pokemonId: 'pk-1', source: 'test' });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_TEAM);
EventBus.emit(EVENTS.TEAM_MEMBER_SET, { team: 'agent', agentId: 'someone-else', pokemonId: 'pk-1' });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_TEAM);
state.agents[0].team.push('pk-1');
EventBus.emit(EVENTS.TEAM_MEMBER_SET, { team: 'agent', agentId: 'guide-1', pokemonId: 'pk-1', source: 'pc-picker' });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_ZONE);

// « Assigne-moi à une zone » — un désassignement ne compte pas.
EventBus.emit(EVENTS.AGENT_ASSIGNED, { agentId: 'guide-1', zoneId: null });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_ZONE);
state.agents[0].assignedZone = 'route1';
EventBus.emit(EVENTS.AGENT_ASSIGNED, { agentId: 'guide-1', zoneId: 'route1' });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_COMBAT);

// « Active mon option de combat » — le bon drapeau, la bonne valeur, le bon agent.
EventBus.emit(EVENTS.AGENT_FLAG_CHANGED, { agentId: 'guide-1', flag: 'autoCapture', value: true });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_COMBAT);
EventBus.emit(EVENTS.AGENT_FLAG_CHANGED, { agentId: 'guide-1', flag: 'autoCombat', value: false });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_COMBAT);
EventBus.emit(EVENTS.AGENT_FLAG_CHANGED, { agentId: 'other', flag: 'autoCombat', value: true });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_COMBAT);

state.agents[0].autoCombat = true;
EventBus.emit(EVENTS.AGENT_FLAG_CHANGED, { agentId: 'guide-1', flag: 'autoCombat', value: true });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.COMPLETED);
assert.equal(state.gang.money, 5_500);
assert.equal(state.stats.totalMoneyEarned, 500);
assert.equal(payoff.agent.name, 'Zane');
assert.equal(payoff.progress.completed, 6);
assert.equal(guideCleared, 1);
assert.ok(guideRefreshes > 0);

// Rejouer l'événement ne doit ni repayer la prime ni réémettre l'étape.
const stepsAfter = completedSteps.length;
EventBus.emit(EVENTS.AGENT_FLAG_CHANGED, { agentId: 'guide-1', flag: 'autoCombat', value: true });
assert.equal(state.gang.money, 5_500);
assert.equal(completedSteps.length, stepsAfter);

// free_capture_started comes from _runOnboardingV2, which this harness bypasses
// by starting the state mid-funnel; everything below is event-driven.
for (const name of ['first_wild_capture', 'ambush_started', 'ambush_resolved',
  'identity_completed', 'guide_recruited', 'guide_team_set', 'guide_zone_assigned', 'guide_combat_enabled']) {
  const event = analyticsEvents.find(candidate => candidate.name === name);
  assert.ok(event, `${name} should be tracked`);
  assert.equal(event.params.onboarding_version, 3);
  assert.ok(Number.isInteger(event.params.seconds_since_new_game));
}

// ── Réconciliation à la reprise ───────────────────────────────────
// La save a déjà l'agent équipé et posté : reprendre ne doit pas redemander
// ce qui est fait — c'est ce que le bouton ▶ du hub déclenche.
state.onboarding = {
  ...state.onboarding, step: ONBOARDING_STEPS.GUIDE_TEAM, status: 'active',
  completedAt: null, guideAgentId: 'guide-1', completionRewardGrantedAt: null,
};
state.gang.money = 7_000;
state.stats.totalMoneyEarned = 0;
state.agents[0].autoCombat = false;
payoff = null;
reconcileOnboardingProgress();
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_COMBAT);

// Un guide absent de la save ne doit pas bloquer sur une demande sans destinataire.
state.onboarding = { ...state.onboarding, step: ONBOARDING_STEPS.GUIDE_TEAM, guideAgentId: 'ghost' };
reconcileOnboardingProgress();
assert.equal(state.onboarding.guideAgentId, null);

const resumeEvents = [];
EventBus.on(EVENTS.ONBOARDING_RESUMED, payload => resumeEvents.push(payload));
state.onboarding = { ...state.onboarding, step: ONBOARDING_STEPS.COMPLETED, status: 'completed' };
assert.equal(resumeOnboardingV2({ slotIdx: 1 }), false);
assert.equal(resumeEvents.length, 0);

console.log('onboarding controller tests: ok');
