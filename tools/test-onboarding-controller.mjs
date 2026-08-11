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
    firstBattleAt: null,
    firstAgentId: null,
  },
  gang: { initialized: true, bossTeam: [] },
  agents: [],
};

let saveCount = 0;
let recruitPrompt = null;
let switchedTab = null;
const completedSteps = [];

configureOnboarding({
  getState: () => state,
  saveState: () => { saveCount++; },
  renderAll: () => {},
  notify: () => {},
  switchTab: tabId => { switchedTab = tabId; return true; },
  openAgentRecruitModal: (_callback, options) => { recruitPrompt = options; return true; },
});
EventBus.on(EVENTS.ONBOARDING_STEP_COMPLETED, payload => completedSteps.push(payload));

state.gang.bossTeam.push('starter-pk');
EventBus.emit(EVENTS.TEAM_MEMBER_SET, {
  team: 'boss', pokemonId: 'starter-pk', slot: 0, source: 'test',
});
assert.equal(state.onboarding.step, ONBOARDING_STEPS.FIRST_BATTLE);

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

state.agents[0].assignedZone = 'route1';
EventBus.emit(EVENTS.AGENT_ASSIGNED, {
  agentId: 'first-agent', zoneId: 'route1', previousZoneId: null, source: 'test',
});
assert.equal(state.onboarding.step, ONBOARDING_STEPS.COMPLETED);
assert.equal(completedSteps.length, 3);
assert.equal(saveCount, 4);

EventBus.emit(EVENTS.AGENT_ASSIGNED, {
  agentId: 'first-agent', zoneId: 'route1', previousZoneId: null, source: 'duplicate',
});
assert.equal(completedSteps.length, 3);

console.log('onboarding controller tests: ok');
