import assert from 'node:assert/strict';

import {
  ONBOARDING_STEPS,
  ONBOARDING_VERSION,
  advanceOnboarding,
  defaultOnboardingState,
  getOnboardingArcProgress,
  getOnboardingCaptureProgress,
  getOnboardingElapsedSeconds,
  getOnboardingGuideLine,
  getOnboardingObjective,
  getOnboardingTabAccess,
  hasReachedStep,
  isManualPlayerCombatWin,
  isOnboardingActive,
  isOnboardingFreeCapture,
  isOnboardingFreeAgentPending,
  isOnboardingZoneFrozen,
  normalizeOnboardingState,
  shouldRunOnboardingV2,
  startOnboarding,
} from '../modules/systems/onboardingFlow.js';
import { ONBOARDING_CAPTURE_GOAL, ONBOARDING_ZONE_ID } from '../data/onboarding-data.js';
import { migrateSave } from '../state/migrateSave.js';
import { DEFAULT_STATE, SAVE_SCHEMA_VERSION } from '../state/defaultState.js';

// ── Transitions ───────────────────────────────────────────────────
const fresh = defaultOnboardingState();
assert.equal(fresh.step, ONBOARDING_STEPS.NOT_STARTED);
assert.equal(fresh.fieldCaptures, 0);
assert.equal(fresh.version, ONBOARDING_VERSION);

const started = startOnboarding(null, 1_000);
assert.equal(started.step, ONBOARDING_STEPS.FREE_CAPTURE);
assert.equal(started.status, 'active');
// Restarting an already-running onboarding must not rewind it.
assert.equal(startOnboarding(started, 9_999).startedAt, 1_000);

// Skipping a step has to throw rather than silently land somewhere plausible.
assert.throws(
  () => advanceOnboarding(started, ONBOARDING_STEPS.IDENTITY),
  /Invalid transition/,
);

let flow = advanceOnboarding(started, ONBOARDING_STEPS.ROCKET_AMBUSH, { fieldCaptures: 10 }, 2_000);
flow = advanceOnboarding(flow, ONBOARDING_STEPS.IDENTITY, { ambushWon: false }, 3_000);
flow = advanceOnboarding(flow, ONBOARDING_STEPS.GUIDE_MET, {}, 4_000);
flow = advanceOnboarding(flow, ONBOARDING_STEPS.GUIDE_TEAM, { guideAgentId: 'ag-1' }, 5_000);
flow = advanceOnboarding(flow, ONBOARDING_STEPS.GUIDE_ZONE, {}, 6_000);
flow = advanceOnboarding(flow, ONBOARDING_STEPS.GUIDE_COMBAT, {}, 7_000);
flow = advanceOnboarding(flow, ONBOARDING_STEPS.COMPLETED, {}, 8_000);
assert.equal(flow.status, 'completed');
assert.equal(flow.completedAt, 8_000);
assert.equal(getOnboardingElapsedSeconds(flow), 7);

// ── Normalisation ─────────────────────────────────────────────────
assert.equal(normalizeOnboardingState(null).step, ONBOARDING_STEPS.NOT_STARTED);
assert.equal(normalizeOnboardingState('nope').step, ONBOARDING_STEPS.NOT_STARTED);
// A step from the retired funnel must not be replayed.
assert.equal(normalizeOnboardingState({ step: 'first_encounter' }).step, ONBOARDING_STEPS.NOT_STARTED);
assert.equal(normalizeOnboardingState({ step: 'guide_zone' }).status, 'active');
assert.equal(normalizeOnboardingState({ fieldCaptures: -4 }).fieldCaptures, 0);
assert.equal(normalizeOnboardingState({ fieldCaptures: '7' }).fieldCaptures, 7);

// ── Prédicats de zone ─────────────────────────────────────────────
const freeCapture = { lang: 'fr', agents: [], onboarding: { step: ONBOARDING_STEPS.FREE_CAPTURE } };
const ambush      = { lang: 'fr', agents: [], onboarding: { step: ONBOARDING_STEPS.ROCKET_AMBUSH } };
const guideTeam   = { lang: 'fr', agents: [], onboarding: { step: ONBOARDING_STEPS.GUIDE_TEAM, guideAgentId: 'ag-1' } };

assert.equal(isOnboardingFreeCapture(freeCapture, ONBOARDING_ZONE_ID), true);
assert.equal(isOnboardingFreeCapture(freeCapture, 'route1'), false);
assert.equal(isOnboardingFreeCapture(ambush, ONBOARDING_ZONE_ID), false);
// The field must stop spawning wild Pokémon once the raid is the point.
assert.equal(isOnboardingZoneFrozen(ambush, ONBOARDING_ZONE_ID), true);
assert.equal(isOnboardingZoneFrozen(freeCapture, ONBOARDING_ZONE_ID), false);
assert.equal(isOnboardingZoneFrozen(ambush, 'route1'), false);

assert.equal(isOnboardingActive(freeCapture), true);
assert.equal(isOnboardingActive({ onboarding: { step: ONBOARDING_STEPS.COMPLETED } }), false);
assert.equal(shouldRunOnboardingV2({ gang: { initialized: false } }), true);
assert.equal(shouldRunOnboardingV2({ gang: { initialized: true }, onboarding: { step: ONBOARDING_STEPS.COMPLETED } }), false);
assert.equal(hasReachedStep(guideTeam, ONBOARDING_STEPS.IDENTITY), true);
assert.equal(hasReachedStep(freeCapture, ONBOARDING_STEPS.IDENTITY), false);

// ── Compteur de captures ──────────────────────────────────────────
const counting = { onboarding: { step: ONBOARDING_STEPS.FREE_CAPTURE, fieldCaptures: 3 } };
assert.deepEqual(getOnboardingCaptureProgress(counting), { caught: 3, goal: ONBOARDING_CAPTURE_GOAL, reached: false });
const counted = { onboarding: { step: ONBOARDING_STEPS.FREE_CAPTURE, fieldCaptures: ONBOARDING_CAPTURE_GOAL + 5 } };
// Overshooting must clamp for display but still report the goal as reached.
assert.deepEqual(getOnboardingCaptureProgress(counted), { caught: ONBOARDING_CAPTURE_GOAL, goal: ONBOARDING_CAPTURE_GOAL, reached: true });

// ── Accès aux onglets ─────────────────────────────────────────────
assert.equal(getOnboardingTabAccess(freeCapture, 'tabZones').status, 'available');
assert.equal(getOnboardingTabAccess(freeCapture, 'tabPC').status, 'hidden');
assert.equal(getOnboardingTabAccess(guideTeam, 'tabPC').status, 'available');
assert.equal(getOnboardingTabAccess(guideTeam, 'tabAgents').status, 'available');
assert.equal(getOnboardingTabAccess(guideTeam, 'tabGang').status, 'locked');
assert.equal(getOnboardingTabAccess(guideTeam, 'tabMarket').status, 'hidden');
// Giovanni owns the screen: nothing is reachable behind him.
const identity = { onboarding: { step: ONBOARDING_STEPS.IDENTITY } };
assert.equal(getOnboardingTabAccess(identity, 'tabZones').status, 'hidden');
assert.ok(getOnboardingTabAccess(identity, 'tabZones').reason);
// #btnSaveSlots looks like a tab but carries no data-tab; an unknown id must
// resolve to hidden so one selector can sweep the whole bar.
assert.equal(getOnboardingTabAccess(freeCapture, undefined).status, 'hidden');
// Outside the onboarding nothing is restricted.
assert.equal(getOnboardingTabAccess({ onboarding: { step: ONBOARDING_STEPS.COMPLETED } }, 'tabMarket').status, 'available');

// ── Agent offert ──────────────────────────────────────────────────
assert.equal(isOnboardingFreeAgentPending({ onboarding: { step: ONBOARDING_STEPS.GUIDE_MET, guideAgentId: null } }), true);
assert.equal(isOnboardingFreeAgentPending({ onboarding: { step: ONBOARDING_STEPS.GUIDE_MET, guideAgentId: 'ag-1' } }), false);
assert.equal(isOnboardingFreeAgentPending({ onboarding: { step: ONBOARDING_STEPS.GUIDE_TEAM } }), false);
assert.equal(isOnboardingFreeAgentPending(null), false);

// ── Répliques du guide ────────────────────────────────────────────
assert.ok(getOnboardingGuideLine({ lang: 'fr', onboarding: { step: ONBOARDING_STEPS.GUIDE_MET } }));
assert.notEqual(
  getOnboardingGuideLine({ lang: 'fr', onboarding: { step: ONBOARDING_STEPS.GUIDE_TEAM } }),
  getOnboardingGuideLine({ lang: 'fr', onboarding: { step: ONBOARDING_STEPS.GUIDE_ZONE } }),
);
assert.notEqual(
  getOnboardingGuideLine({ lang: 'en', onboarding: { step: ONBOARDING_STEPS.GUIDE_COMBAT } }),
  getOnboardingGuideLine({ lang: 'fr', onboarding: { step: ONBOARDING_STEPS.GUIDE_COMBAT } }),
);
assert.equal(getOnboardingGuideLine({ onboarding: { step: ONBOARDING_STEPS.FREE_CAPTURE } }), null);

// ── Objectifs + arc ───────────────────────────────────────────────
const captureObjective = getOnboardingObjective(counting);
assert.equal(captureObjective.tab, 'tabZones');
assert.ok(captureObjective.text.includes(`3/${ONBOARDING_CAPTURE_GOAL}`));
assert.equal(getOnboardingObjective(guideTeam).tab, 'tabPC');
assert.equal(getOnboardingObjective({ onboarding: { step: ONBOARDING_STEPS.GUIDE_COMBAT } }).tab, 'tabAgents');
assert.equal(getOnboardingObjective({ onboarding: { step: ONBOARDING_STEPS.COMPLETED } }), null);

const arc = getOnboardingArcProgress(guideTeam);
assert.equal(arc.total, 6);
assert.equal(arc.completed, 4);
assert.equal(getOnboardingArcProgress({ onboarding: { step: ONBOARDING_STEPS.COMPLETED } }).completed, 6);
assert.equal(getOnboardingArcProgress(freeCapture).completed, 0);

// ── Combat manuel ─────────────────────────────────────────────────
assert.equal(isManualPlayerCombatWin({ mode: 'manual', initiatedBy: 'player' }), true);
assert.equal(isManualPlayerCombatWin({ mode: 'agent', initiatedBy: 'agent' }), false);

// ── Migration ─────────────────────────────────────────────────────
const migrationDeps = {
  DEFAULT_STATE, SAVE_SCHEMA_VERSION, SPECIES_BY_EN: {}, uid: () => 'test', now: () => 42_000,
};
const legacySave = migrateSave({ _schemaVersion: 13, gang: { initialized: true } }, migrationDeps);
assert.equal(legacySave.onboarding.step, ONBOARDING_STEPS.COMPLETED);
assert.equal(legacySave._schemaVersion, SAVE_SCHEMA_VERSION);
// A save written by the retired V2 funnel must be treated as done, never
// resumed onto a step that no longer exists.
const v2Save = migrateSave({
  _schemaVersion: 15, gang: { initialized: true },
  onboarding: { version: 2, step: 'team_setup', status: 'active' },
}, migrationDeps);
assert.equal(v2Save.onboarding.step, ONBOARDING_STEPS.COMPLETED);
assert.equal(v2Save.onboarding.version, ONBOARDING_VERSION);
// Never initialized → gets the new funnel from scratch.
assert.equal(migrateSave({ gang: { initialized: false } }, migrationDeps).onboarding.step, ONBOARDING_STEPS.NOT_STARTED);
// A run already on the new funnel survives untouched.
const v3Save = migrateSave({
  gang: { initialized: true },
  onboarding: { version: 3, step: 'guide_zone', status: 'active', fieldCaptures: 12, guideAgentId: 'ag-9' },
}, migrationDeps);
assert.equal(v3Save.onboarding.step, ONBOARDING_STEPS.GUIDE_ZONE);
assert.equal(v3Save.onboarding.guideAgentId, 'ag-9');

console.log('onboarding flow tests: ok');
