import assert from 'node:assert/strict';

import {
  formatOperationCountdown,
  getOperationEstimateSeconds,
  getOnboardingIdlePayoffCopy,
} from '../modules/ui/onboardingPayoff.js';

assert.equal(getOperationEstimateSeconds({ spawnRate: 0.07 }), 14);
assert.equal(getOperationEstimateSeconds({ spawnRate: 0.01 }), 100);
assert.equal(getOperationEstimateSeconds({ spawnRate: 0 }), null);
assert.equal(getOperationEstimateSeconds(null), null);

assert.equal(formatOperationCountdown(0), '00:00');
assert.equal(formatOperationCountdown(14), '00:14');
assert.equal(formatOperationCountdown(102), '01:42');
assert.equal(formatOperationCountdown(-5), '00:00');

const fr = getOnboardingIdlePayoffCopy('fr');
assert.equal(fr.title, 'AGENT EN MISSION');
assert.equal(fr.timerLabel, 'Prochaine opération ~');
assert.equal(fr.unlockName, 'Marché');
assert.match(fr.offline, /pendant ton absence/);

const en = getOnboardingIdlePayoffCopy('en');
assert.equal(en.title, 'AGENT ON MISSION');
assert.equal(en.timerLabel, 'Next operation ~');
assert.equal(en.unlockName, 'Market');
assert.match(en.offline, /while you are away/);

console.log('onboarding payoff tests: ok');
