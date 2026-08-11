'use strict';

import { EventBus, EVENTS } from '../core/eventBus.js';
import { acquireStoryLock, releaseStoryLock } from '../core/storyLock.js';
import {
  ONBOARDING_STEPS,
  ONBOARDING_VERSION,
  advanceOnboarding,
  getOnboardingElapsedSeconds,
  normalizeOnboardingState,
  shouldRunOnboardingV2,
  startOnboarding,
} from '../systems/onboardingFlow.js';
import { openFirstEncounter } from './firstEncounter.js';

const LOCK_OWNER = 'onboarding-v2';
let _ctx = {};
let _running = false;

export function configureOnboarding(ctx = {}) {
  _ctx = { ..._ctx, ...ctx };
}

function _state() {
  return _ctx.getState?.();
}

function _track(name, params = {}) {
  const state = _state();
  globalThis.trackEvent?.(name, {
    seconds_since_new_game: getOnboardingElapsedSeconds(state?.onboarding),
    ...params,
  });
}

function _setStep(nextStep, details = {}) {
  const state = _state();
  const previousStep = state.onboarding.step;
  state.onboarding = advanceOnboarding(state.onboarding, nextStep, details);
  const secondsSinceNewGame = getOnboardingElapsedSeconds(state.onboarding);
  EventBus.emit(EVENTS.ONBOARDING_STEP_COMPLETED, {
    step: previousStep,
    nextStep,
    secondsSinceNewGame,
  });
  _ctx.saveState?.();
}

function _openIdentity({ slotIdx, starterSpecies }) {
  return new Promise((resolve, reject) => {
    _track('identity_started', { slot: slotIdx });
    const opened = _ctx.openGiovanniIntro?.({
      slotIdx,
      starterEn: starterSpecies,
      identityOnly: true,
      lockOwner: LOCK_OWNER,
      onComplete: payload => resolve(payload),
    });
    if (opened === false) reject(new Error('[onboarding] Giovanni identity screen could not open'));
  });
}

/** Browser controller backed by the pure onboardingFlow state machine. */
export async function startOnboardingV2({ slotIdx = 0, resume = false, onComplete } = {}) {
  let state = _state();
  if (_running || !shouldRunOnboardingV2(state)) return false;
  if (!acquireStoryLock(LOCK_OWNER)) {
    _ctx.notify?.(
      state?.lang === 'en' ? 'Another story sequence is already playing.' : 'Une autre séquence narrative est déjà en cours.',
      'error',
    );
    return false;
  }

  _running = true;
  try {
    if (!resume) {
      _ctx.resetStateForNewGame?.();
      state = _state();
    }
    _ctx.setActiveSaveSlot?.(slotIdx);
    const isStarting = !resume || normalizeOnboardingState(state.onboarding).step === ONBOARDING_STEPS.NOT_STARTED;
    state.onboarding = resume
      ? normalizeOnboardingState(state.onboarding)
      : startOnboarding(null);
    if (state.onboarding.step === ONBOARDING_STEPS.NOT_STARTED) {
      state.onboarding = startOnboarding(state.onboarding);
    }
    _ctx.saveState?.();

    if (isStarting) {
      EventBus.emit(EVENTS.ONBOARDING_STARTED, {
        version: ONBOARDING_VERSION,
        slotIdx,
        startedAt: state.onboarding.startedAt,
      });
      _track('first_encounter_started', { slot: slotIdx });
    }

    if (state.onboarding.step === ONBOARDING_STEPS.FIRST_ENCOUNTER) {
      const result = await openFirstEncounter({
        pokeSprite: _ctx.pokeSprite,
        ballSprite: _ctx.getBallSprite?.(),
        onCapture: species => {
          const pokemon = _ctx.tryCapture?.('onboarding', species, 2, { onboarding: true });
          if (pokemon) {
            _setStep(ONBOARDING_STEPS.IDENTITY, { starterSpecies: species });
            _track('first_wild_capture', { species, slot: slotIdx });
          }
          return pokemon;
        },
      });
      if (state.onboarding.starterSpecies !== result.species) {
        throw new Error('[onboarding] Captured starter was not persisted');
      }
    }

    if (state.onboarding.step === ONBOARDING_STEPS.IDENTITY) {
      const starterSpecies = state.onboarding.starterSpecies;
      if (!starterSpecies) throw new Error('[onboarding] Missing captured starter before identity setup');
      const identity = await _openIdentity({ slotIdx, starterSpecies });
      _setStep(ONBOARDING_STEPS.TEAM_SETUP);
      _track('identity_completed', { slot: slotIdx });
      document.getElementById('introOverlay')?.classList.remove('active');
      _ctx.renderAll?.();
      onComplete?.({ identity, onboarding: state.onboarding });
    }

    return true;
  } catch (error) {
    console.error('[onboarding] V2 flow failed:', error);
    _ctx.notify?.(
      state?.lang === 'en' ? 'The onboarding sequence could not continue.' : "La séquence d'onboarding n'a pas pu continuer.",
      'error',
    );
    return false;
  } finally {
    _running = false;
    releaseStoryLock(LOCK_OWNER);
  }
}
