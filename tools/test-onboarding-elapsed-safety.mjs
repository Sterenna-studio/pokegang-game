import assert from 'node:assert/strict';

import { getOnboardingElapsedSeconds } from '../modules/systems/onboardingFlow.js';

const now = 10_000;

assert.equal(getOnboardingElapsedSeconds({ startedAt: null }, now), 0);
assert.equal(getOnboardingElapsedSeconds({ startedAt: 0 }, now), 0);
assert.equal(getOnboardingElapsedSeconds({ startedAt: -1 }, now), 0);
assert.equal(getOnboardingElapsedSeconds({ startedAt: 20_000 }, now), 0);
assert.equal(getOnboardingElapsedSeconds({ startedAt: 1_000 }, 5_000), 4);
assert.equal(getOnboardingElapsedSeconds({ startedAt: 1_000, completedAt: 8_000 }, now), 7);
assert.equal(getOnboardingElapsedSeconds({ startedAt: 5_000, completedAt: 2_000 }, now), 5);

console.log('✓ onboarding elapsed timestamp safety');
