import assert from 'node:assert/strict';

import { EventBus, EVENTS } from '../modules/core/eventBus.js';
import { ONBOARDING_STEPS } from '../modules/systems/onboardingFlow.js';
import {
  configureOnboarding,
  reconcileOnboardingProgress,
  resumeOnboardingV2,
} from '../modules/ui/onboarding.js';

const state = {
  lang: 'fr',
  onboarding: {
    version: 2,
    status: 'active',
    step: ONBOARDING_STEPS.TEAM_SETUP,
    startedAt: 1_000,
    completedAt: null,
    starterSpecies: 'zubat',
    firstBattleStartedAt: null,
    firstBattleAt: null,
    firstAgentId: null,
  },
  gang: { initialized: true, bossTeam: [], money: 5_000 },
  stats: { totalMoneyEarned: 0 },
  agents: [],
};

let saveCount = 0;
let recruitPrompt = null;
let switchedTab = null;
let payoff = null;
const completedSteps = [];
const completedOnboardings = [];
const analyticsEvents = [];

globalThis.trackEvent = (name, params) => analyticsEvents.push({ name, params });

configureOnboarding({
  getState: () => state,
  saveState: () => { saveCount++; },
  renderAll: () => {},
  notify: () => {},
  switchTab: tabId => { switchedTab = tabId; return true; },
  openAgentRecruitModal: (_callback, options) => { recruitPrompt = options; return true; },
  getZoneById: zoneId => ({ id: zoneId, fr: 'Route 1', en: 'Route 1', spawnRate: 0.07 }),
  showOnboardingIdlePayoff: options => { payoff = options; return true; },
});
EventBus.on(EVENTS.ONBOARDING_STEP_COMPLETED, payload => completedSteps.push(payload));
EventBus.on(EVENTS.ONBOARDING_COMPLETED, payload => completedOnboardings.push(payload));

state.gang.bossTeam.push('starter-pk');
EventBus.emit(EVENTS.TEAM_MEMBER_SET, {
  team: 'boss', pokemonId: 'starter-pk', slot: 0, source: 'test',
});
assert.equal(state.onboarding.step, ONBOARDING_STEPS.FIRST_BATTLE);
assert.equal(analyticsEvents.at(-1).name, 'first_team_member_set');
EventBus.emit(EVENTS.TEAM_MEMBER_SET, {
  team: 'boss', pokemonId: 'starter-pk', slot: 0, source: 'duplicate',
});
assert.equal(analyticsEvents.filter(event => event.name === 'first_team_member_set').length, 1);

EventBus.emit(EVENTS.COMBAT_STARTED, {
  mode: 'manual', initiatedBy: 'player', zoneId: 'route1', trainerKey: 'youngster',
});
const firstBattleStartedAt = state.onboarding.firstBattleStartedAt;
assert.ok(Number.isFinite(firstBattleStartedAt));
assert.equal(analyticsEvents.at(-1).name, 'first_battle_started');
EventBus.emit(EVENTS.COMBAT_STARTED, {
  mode: 'manual', initiatedBy: 'player', zoneId: 'route1', trainerKey: 'youngster',
});
assert.equal(state.onboarding.firstBattleStartedAt, firstBattleStartedAt);
assert.equal(analyticsEvents.filter(event => event.name === 'first_battle_started').length, 1);

EventBus.emit(EVENTS.COMBAT_WON, { mode: 'agent', initiatedBy: 'agent' });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.FIRST_BATTLE);

EventBus.emit(EVENTS.COMBAT_WON, {
  mode: 'manual', initiatedBy: 'player', zoneId: 'route1', trainerKey: 'youngster',
});
assert.equal(state.onboarding.step, ONBOARDING_STEPS.FIRST_AGENT);
assert.equal(analyticsEvents.at(-1).name, 'first_battle_won');
assert.ok(Number.isInteger(analyticsEvents.at(-1).params.seconds_since_new_game));
assert.equal(switchedTab, 'tabAgents');
await new Promise(resolve => setTimeout(resolve, 0));
assert.deepEqual(recruitPrompt, { cost: 0, source: 'onboarding' });

state.agents.push({ id: 'first-agent', name: 'Jessie', assignedZone: null });
EventBus.emit(EVENTS.AGENT_RECRUITED, { agentId: 'first-agent', source: 'onboarding', cost: 0 });
assert.equal(state.onboarding.firstAgentId, 'first-agent');
assert.equal(analyticsEvents.at(-1).name, 'first_agent_recruited');
EventBus.emit(EVENTS.AGENT_RECRUITED, { agentId: 'first-agent', source: 'onboarding', cost: 0 });
assert.equal(analyticsEvents.filter(event => event.name === 'first_agent_recruited').length, 1);

state.agents[0].assignedZone = 'route1';
EventBus.emit(EVENTS.AGENT_ASSIGNED, {
  agentId: 'first-agent', zoneId: 'route1', previousZoneId: null, source: 'test',
});
assert.equal(state.onboarding.step, ONBOARDING_STEPS.COMPLETED);
assert.equal(completedSteps.length, 3);
assert.equal(saveCount, 5);
assert.equal(analyticsEvents.at(-1).name, 'first_agent_assigned');
assert.equal(state.gang.money, 5_500);
assert.equal(state.stats.totalMoneyEarned, 500);
assert.ok(Number.isFinite(state.onboarding.completionRewardGrantedAt));
assert.equal(state.onboarding.completionRewardMoney, 500);
assert.equal(completedOnboardings.length, 1);
assert.equal(completedOnboardings[0].version, 2);
assert.ok(Number.isInteger(completedOnboardings[0].secondsSinceNewGame));
assert.equal(payoff.agent.name, 'Jessie');
assert.equal(payoff.zone.id, 'route1');
assert.equal(payoff.lang, 'fr');
assert.equal(payoff.nextUnlock, 'market');
assert.equal(payoff.rewardMoney, 500);
assert.equal(payoff.progress.completed, 5);

EventBus.emit(EVENTS.AGENT_ASSIGNED, {
  agentId: 'first-agent', zoneId: 'route1', previousZoneId: null, source: 'duplicate',
});
assert.equal(completedSteps.length, 3);
assert.equal(analyticsEvents.filter(event => event.name === 'first_agent_assigned').length, 1);
assert.equal(state.gang.money, 5_500);

for (const name of [
  'first_team_member_set',
  'first_battle_started',
  'first_battle_won',
  'first_agent_recruited',
  'first_agent_assigned',
]) {
  const event = analyticsEvents.find(candidate => candidate.name === name);
  assert.ok(event, `${name} should be tracked`);
  assert.equal(event.params.onboarding_version, 2);
  assert.ok(Number.isInteger(event.params.seconds_since_new_game));
}

state.onboarding = {
  version: 2,
  status: 'active',
  step: ONBOARDING_STEPS.FIRST_AGENT,
  startedAt: 2_000,
  completedAt: null,
  starterSpecies: 'zubat',
  firstBattleStartedAt: 3_000,
  firstBattleAt: 4_000,
  firstAgentId: 'resume-agent',
  completionRewardGrantedAt: null,
  completionRewardMoney: 0,
};
state.gang.money = 7_000;
state.stats.totalMoneyEarned = 0;
state.agents = [{ id: 'resume-agent', name: 'James', assignedZone: 'route1' }];
payoff = null;

reconcileOnboardingProgress();
assert.equal(state.onboarding.step, ONBOARDING_STEPS.COMPLETED);
assert.equal(state.gang.money, 7_500);
assert.equal(state.stats.totalMoneyEarned, 500);
assert.equal(payoff.agent.name, 'James');
assert.equal(payoff.rewardMoney, 500);

reconcileOnboardingProgress();
assert.equal(state.gang.money, 7_500);
assert.equal(state.stats.totalMoneyEarned, 500);

// ── Resuming reconciles milestones already reached in the save ────
// The hub's play button routes here rather than to startOnboardingV2, which
// skipped reconciliation and left the player staring at an objective they had
// already fulfilled (a full boss team while still on step team_setup).
const overlayClasses = new Set(['active']);
globalThis.document = {
  getElementById: id => (id === 'introOverlay'
    ? { classList: { remove: cls => overlayClasses.delete(cls) } }
    : null),
};

const resumeEvents = [];
EventBus.on(EVENTS.ONBOARDING_RESUMED, payload => resumeEvents.push(payload));

state.onboarding = {
  version: 2,
  status: 'active',
  step: ONBOARDING_STEPS.TEAM_SETUP,
  startedAt: 5_000,
  completedAt: null,
  starterSpecies: 'zubat',
  firstBattleStartedAt: null,
  firstBattleAt: null,
  firstAgentId: null,
  completionRewardGrantedAt: null,
  completionRewardMoney: 0,
};
state.gang.bossTeam = ['already-placed-pk'];
state.agents = [];

assert.equal(resumeOnboardingV2({ slotIdx: 1 }), true);
assert.equal(state.onboarding.step, ONBOARDING_STEPS.FIRST_BATTLE);
assert.equal(resumeEvents.length, 1);
// Reconciliation runs first, so the tracked step is where the player actually
// re-enters the funnel — not the stale one the save was written with.
assert.equal(resumeEvents[0].step, ONBOARDING_STEPS.FIRST_BATTLE);
// The hub overlay must come down: no later step opens an overlay of its own.
assert.equal(overlayClasses.has('active'), false);

// A completed save is not an onboarding to resume.
state.onboarding = { ...state.onboarding, step: ONBOARDING_STEPS.COMPLETED, status: 'completed' };
assert.equal(resumeOnboardingV2({ slotIdx: 1 }), false);
assert.equal(resumeEvents.length, 1);

console.log('onboarding controller tests: ok');
