import assert from 'node:assert/strict';

import { EventBus, EVENTS } from '../modules/core/eventBus.js';
import { ONBOARDING_STEPS } from '../modules/systems/onboardingFlow.js';
import { configureOnboarding } from '../modules/ui/onboarding.js';

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
  gang: { initialized: true, bossTeam: [] },
  agents: [],
};

let saveCount = 0;
let recruitPrompt = null;
let switchedTab = null;
let payoff = null;
const completedSteps = [];
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
assert.equal(payoff.agent.name, 'Jessie');
assert.equal(payoff.zone.id, 'route1');
assert.equal(payoff.lang, 'fr');
assert.equal(payoff.nextUnlock, 'market');

EventBus.emit(EVENTS.AGENT_ASSIGNED, {
  agentId: 'first-agent', zoneId: 'route1', previousZoneId: null, source: 'duplicate',
});
assert.equal(completedSteps.length, 3);
assert.equal(analyticsEvents.filter(event => event.name === 'first_agent_assigned').length, 1);

console.log('onboarding controller tests: ok');
