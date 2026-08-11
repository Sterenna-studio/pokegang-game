import assert from 'node:assert/strict';

import {
  ONBOARDING_STEPS,
  advanceOnboarding,
  defaultOnboardingState,
  getOnboardingElapsedSeconds,
  normalizeOnboardingState,
  shouldRunOnboardingV2,
  startOnboarding,
} from '../modules/systems/onboardingFlow.js';
import {
  acquireStoryLock,
  getStoryLockOwner,
  releaseStoryLock,
  resetStoryLockForTests,
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

resetStoryLockForTests();
assert.equal(acquireStoryLock('onboarding-v2'), true);
assert.equal(acquireStoryLock('johto-cinematic'), false);
assert.equal(getStoryLockOwner(), 'onboarding-v2');
assert.equal(releaseStoryLock('johto-cinematic'), false);
assert.equal(releaseStoryLock('onboarding-v2'), true);
assert.equal(acquireStoryLock('johto-cinematic'), true);
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

const emptySave = migrateSave({
  version: '6.0.0',
  _schemaVersion: 13,
  gang: { initialized: false },
}, migrationDeps);
assert.equal(emptySave.onboarding.step, ONBOARDING_STEPS.NOT_STARTED);

console.log('onboarding flow tests: ok');
