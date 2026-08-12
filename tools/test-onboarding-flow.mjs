import assert from 'node:assert/strict';

import {
  ONBOARDING_STEPS,
  advanceOnboarding,
  defaultOnboardingState,
  getOnboardingElapsedSeconds,
  getOnboardingArcProgress,
  getOnboardingObjective,
  getOnboardingTabAccess,
  isManualPlayerCombatWin,
  normalizeOnboardingState,
  shouldRunOnboardingV2,
  startOnboarding,
} from '../modules/systems/onboardingFlow.js';
import {
  acquireStoryLock,
  getPendingStoryOwners,
  getStoryLockOwner,
  requestStory,
  releaseStoryLock,
  resetStoryLockForTests,
  STORY_PRIORITIES,
} from '../modules/core/storyLock.js';
import { DEFAULT_STATE, SAVE_SCHEMA_VERSION } from '../state/defaultState.js';
import { migrateSave } from '../state/migrateSave.js';

const started = startOnboarding(defaultOnboardingState(), 1_000);
assert.equal(started.step, ONBOARDING_STEPS.FIRST_ENCOUNTER);
assert.equal(started.startedAt, 1_000);
assert.equal(getOnboardingElapsedSeconds(started, 4_999), 3);

const identity = advanceOnboarding(started, ONBOARDING_STEPS.IDENTITY, { starterSpecies: 'zubat' }, 2_000);
assert.equal(identity.starterSpecies, 'zubat');
assert.throws(
  () => advanceOnboarding(identity, ONBOARDING_STEPS.FIRST_BATTLE),
  /Invalid transition identity -> first_battle/,
);

let flow = advanceOnboarding(identity, ONBOARDING_STEPS.TEAM_SETUP, {}, 3_000);
flow = advanceOnboarding(flow, ONBOARDING_STEPS.FIRST_BATTLE, {}, 4_000);
flow = advanceOnboarding(flow, ONBOARDING_STEPS.FIRST_AGENT, {}, 5_000);
flow = advanceOnboarding(flow, ONBOARDING_STEPS.COMPLETED, {}, 6_000);
assert.equal(flow.status, 'completed');
assert.equal(flow.completedAt, 6_000);
assert.equal(getOnboardingElapsedSeconds(flow, 99_000), 5);

assert.equal(normalizeOnboardingState({ step: 'unknown' }).step, ONBOARDING_STEPS.NOT_STARTED);
assert.equal(shouldRunOnboardingV2({ gang: { initialized: false } }), true);
assert.equal(shouldRunOnboardingV2({ gang: { initialized: true } }), false);
assert.equal(shouldRunOnboardingV2({
  gang: { initialized: true },
  onboarding: { step: ONBOARDING_STEPS.FIRST_BATTLE },
}), true);

const firstBattleState = {
  lang: 'fr',
  gang: { initialized: true },
  agents: [],
  onboarding: { step: ONBOARDING_STEPS.FIRST_BATTLE },
};
assert.equal(getOnboardingTabAccess(firstBattleState, 'tabZones').status, 'available');
assert.equal(getOnboardingTabAccess(firstBattleState, 'tabAgents').status, 'locked');
assert.equal(getOnboardingTabAccess(firstBattleState, 'tabMarket').status, 'hidden');
assert.equal(getOnboardingObjective(firstBattleState).tab, 'tabZones');
assert.equal(getOnboardingObjective(firstBattleState).progress.completed, 2);
assert.equal(getOnboardingArcProgress(firstBattleState).total, 5);
assert.equal(getOnboardingArcProgress({
  ...firstBattleState,
  onboarding: { step: ONBOARDING_STEPS.FIRST_AGENT, firstAgentId: 'agent-1' },
}).completed, 4);
assert.equal(getOnboardingArcProgress({
  ...firstBattleState,
  onboarding: { step: ONBOARDING_STEPS.COMPLETED, firstAgentId: 'agent-1' },
}).completed, 5);
assert.equal(isManualPlayerCombatWin({ mode: 'manual', initiatedBy: 'player' }), true);
assert.equal(isManualPlayerCombatWin({ mode: 'agent', initiatedBy: 'agent' }), false);
assert.equal(getOnboardingObjective({
  ...firstBattleState,
  onboarding: { step: ONBOARDING_STEPS.COMPLETED },
}), null);

resetStoryLockForTests();
assert.equal(acquireStoryLock('onboarding-v2'), true);
assert.equal(acquireStoryLock('johto-cinematic'), false);
assert.equal(getStoryLockOwner(), 'onboarding-v2');
assert.equal(releaseStoryLock('johto-cinematic'), false);
assert.equal(releaseStoryLock('onboarding-v2'), true);
assert.equal(acquireStoryLock('johto-cinematic'), true);
resetStoryLockForTests();

const storyStarts = [];
assert.equal(acquireStoryLock('active-story'), true);
assert.equal(requestStory('boot-story', () => { storyStarts.push('boot'); return true; }), true);
assert.equal(requestStory('gameplay-story', () => { storyStarts.push('gameplay'); return true; }, {
  priority: STORY_PRIORITIES.GAMEPLAY,
}), true);
assert.deepEqual(getPendingStoryOwners(), ['gameplay-story', 'boot-story']);
assert.equal(requestStory('boot-story', () => true), false);
assert.equal(releaseStoryLock('active-story'), true);
assert.deepEqual(storyStarts, ['gameplay']);
assert.equal(releaseStoryLock('gameplay-story'), true);
assert.deepEqual(storyStarts, ['gameplay', 'boot']);
assert.equal(releaseStoryLock('boot-story'), true);

assert.equal(requestStory('stale-story', () => { storyStarts.push('stale'); return true; }, {
  isEligible: () => false,
}), true);
assert.equal(getStoryLockOwner(), null);
assert.equal(storyStarts.includes('stale'), false);

const originalConsoleError = console.error;
console.error = () => {};
assert.equal(requestStory('failing-story', () => { throw new Error('expected'); }), true);
console.error = originalConsoleError;
assert.equal(getStoryLockOwner(), null);
resetStoryLockForTests();

const migrationDeps = {
  DEFAULT_STATE,
  SAVE_SCHEMA_VERSION,
  SPECIES_BY_EN: {},
  uid: () => 'test',
  now: () => 42_000,
};
const existingSave = migrateSave({
  version: '6.0.0',
  _schemaVersion: 13,
  gang: { initialized: true },
}, migrationDeps);
assert.equal(existingSave.onboarding.step, ONBOARDING_STEPS.COMPLETED);
assert.equal(existingSave.onboarding.firstAgentId, null);
assert.equal(existingSave._schemaVersion, SAVE_SCHEMA_VERSION);

const emptySave = migrateSave({
  version: '6.0.0',
  _schemaVersion: 13,
  gang: { initialized: false },
}, migrationDeps);
assert.equal(emptySave.onboarding.step, ONBOARDING_STEPS.NOT_STARTED);

console.log('onboarding flow tests: ok');
