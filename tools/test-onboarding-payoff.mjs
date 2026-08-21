import assert from 'node:assert/strict';

import {
  formatOperationCountdown,
  getOperationEstimateSeconds,
  getOnboardingIdlePayoffCopy,
} from '../modules/ui/onboardingPayoff.js';
import { ONBOARDING_STEPS, getOnboardingArcProgress } from '../modules/systems/onboardingFlow.js';

assert.equal(getOperationEstimateSeconds({ spawnRate: 0.07 }), 14);
assert.equal(getOperationEstimateSeconds({ spawnRate: 0.01 }), 100);
assert.equal(getOperationEstimateSeconds({ spawnRate: 0 }), null);
assert.equal(getOperationEstimateSeconds(null), null);

assert.equal(formatOperationCountdown(0), '00:00');
assert.equal(formatOperationCountdown(14), '00:14');
assert.equal(formatOperationCountdown(102), '01:42');
assert.equal(formatOperationCountdown(-5), '00:00');

// Le décompte de l'arc vient de getOnboardingArcProgress, jamais d'un
// littéral : le carton annonçait « 5/5 » en dur alors que l'arc compte 6
// jalons depuis l'ajout de l'embuscade, et le HUD affichait bien « x/6 ».
const completedState = { onboarding: { step: ONBOARDING_STEPS.COMPLETED } };
const arcFr = getOnboardingArcProgress(completedState);
const arcEn = getOnboardingArcProgress({ ...completedState, lang: 'en' });

const fr = getOnboardingIdlePayoffCopy('fr', 'market', 500, arcFr);
assert.equal(fr.title, 'AGENT EN MISSION');
assert.equal(fr.timerLabel, 'Prochaine opération ~');
assert.equal(fr.unlockName, 'Marché');
assert.match(fr.offline, /pendant ton absence/);
assert.match(fr.reward, /500/);
assert.equal(fr.arcComplete, `NOUVEAU BOSS ${arcFr.completed}/${arcFr.total} TERMINÉ`);
assert.match(fr.arcComplete, new RegExp(`${arcFr.total}/${arcFr.total}`));

const en = getOnboardingIdlePayoffCopy('en', 'market', 500, arcEn);
assert.equal(en.title, 'AGENT ON MISSION');
assert.equal(en.timerLabel, 'Next operation ~');
assert.equal(en.unlockName, 'Market');
assert.match(en.offline, /while you are away/);
assert.match(en.reward, /500/);
assert.equal(en.arcComplete, `NEW BOSS ${arcEn.completed}/${arcEn.total} COMPLETE`);

// Sans arc fourni, le carton reste lisible plutôt que d'afficher « 0/0 ».
const noArc = getOnboardingIdlePayoffCopy('en', 'market', 0);
assert.equal(noArc.arcComplete, 'NEW BOSS COMPLETE');
assert.equal(noArc.reward, '');

console.log('onboarding payoff tests: ok');
