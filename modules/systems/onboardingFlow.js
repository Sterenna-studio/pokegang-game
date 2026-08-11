'use strict';

export const ONBOARDING_VERSION = 2;

export const ONBOARDING_STEPS = Object.freeze({
  NOT_STARTED: 'not_started',
  FIRST_ENCOUNTER: 'first_encounter',
  IDENTITY: 'identity',
  TEAM_SETUP: 'team_setup',
  FIRST_BATTLE: 'first_battle',
  FIRST_AGENT: 'first_agent',
  COMPLETED: 'completed',
});

const NEXT_STEP = Object.freeze({
  [ONBOARDING_STEPS.NOT_STARTED]: ONBOARDING_STEPS.FIRST_ENCOUNTER,
  [ONBOARDING_STEPS.FIRST_ENCOUNTER]: ONBOARDING_STEPS.IDENTITY,
  [ONBOARDING_STEPS.IDENTITY]: ONBOARDING_STEPS.TEAM_SETUP,
  [ONBOARDING_STEPS.TEAM_SETUP]: ONBOARDING_STEPS.FIRST_BATTLE,
  [ONBOARDING_STEPS.FIRST_BATTLE]: ONBOARDING_STEPS.FIRST_AGENT,
  [ONBOARDING_STEPS.FIRST_AGENT]: ONBOARDING_STEPS.COMPLETED,
});

export function defaultOnboardingState() {
  return {
    version: ONBOARDING_VERSION,
    status: ONBOARDING_STEPS.NOT_STARTED,
    step: ONBOARDING_STEPS.NOT_STARTED,
    startedAt: null,
    completedAt: null,
    starterSpecies: null,
  };
}

export function normalizeOnboardingState(value) {
  const base = defaultOnboardingState();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  const step = Object.values(ONBOARDING_STEPS).includes(value.step)
    ? value.step
    : base.step;
  return {
    ...base,
    ...value,
    version: ONBOARDING_VERSION,
    step,
    status: step === ONBOARDING_STEPS.COMPLETED ? 'completed' : (step === ONBOARDING_STEPS.NOT_STARTED ? 'not_started' : 'active'),
  };
}

export function startOnboarding(value, now = Date.now()) {
  const current = normalizeOnboardingState(value);
  if (current.step !== ONBOARDING_STEPS.NOT_STARTED) return current;
  return {
    ...current,
    status: 'active',
    step: ONBOARDING_STEPS.FIRST_ENCOUNTER,
    startedAt: now,
    completedAt: null,
  };
}

export function advanceOnboarding(value, nextStep, details = {}, now = Date.now()) {
  const current = normalizeOnboardingState(value);
  const expected = NEXT_STEP[current.step];
  if (nextStep !== expected) {
    throw new Error(`[onboarding] Invalid transition ${current.step} -> ${nextStep}; expected ${expected || 'none'}`);
  }
  return {
    ...current,
    ...details,
    status: nextStep === ONBOARDING_STEPS.COMPLETED ? 'completed' : 'active',
    step: nextStep,
    completedAt: nextStep === ONBOARDING_STEPS.COMPLETED ? now : null,
  };
}

export function getOnboardingElapsedSeconds(value, now = Date.now()) {
  const current = normalizeOnboardingState(value);
  if (!Number.isFinite(current.startedAt)) return 0;
  const end = Number.isFinite(current.completedAt) ? current.completedAt : now;
  return Math.max(0, Math.floor((end - current.startedAt) / 1000));
}

export function shouldRunOnboardingV2(state) {
  return !!state && !state.gang?.initialized;
}
