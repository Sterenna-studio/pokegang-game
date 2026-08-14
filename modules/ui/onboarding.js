'use strict';

import { EventBus, EVENTS } from '../core/eventBus.js';
import {
  releaseStoryLock,
  requestStory,
  STORY_PRIORITIES,
} from '../core/storyLock.js';
import {
  ONBOARDING_STEPS,
  ONBOARDING_VERSION,
  ONBOARDING_COMPLETION_REWARD,
  advanceOnboarding,
  getOnboardingArcProgress,
  getOnboardingElapsedSeconds,
  isOnboardingActive,
  isManualPlayerCombatWin,
  normalizeOnboardingState,
  shouldRunOnboardingV2,
  startOnboarding,
} from '../systems/onboardingFlow.js';
import { openFirstEncounter } from './firstEncounter.js';

const LOCK_OWNER = 'onboarding-v2';
let _ctx = {};
let _running = false;
let _eventsBound = false;
let _lastResumeFingerprint = '';

export function configureOnboarding(ctx = {}) {
  _ctx = { ..._ctx, ...ctx };
  _bindOnboardingEvents();
}

function _state() {
  return _ctx.getState?.();
}

function _track(name, params = {}) {
  const state = _state();
  globalThis.trackEvent?.(name, {
    onboarding_version: ONBOARDING_VERSION,
    step: state?.onboarding?.step ?? null,
    seconds_since_new_game: getOnboardingElapsedSeconds(state?.onboarding),
    ...params,
  });
}

function _saveOrRestore(previous) {
  try {
    _ctx.saveState?.();
    return true;
  } catch (error) {
    const state = _state();
    if (state) state.onboarding = previous;
    throw error;
  }
}

function _commitStep(expectedStep, nextStep, details = {}, onCommitted = null) {
  const state = _state();
  if (!state) return false;
  const current = normalizeOnboardingState(state.onboarding);
  if (current.step !== expectedStep) return false;

  const previous = state.onboarding;
  const next = advanceOnboarding(current, nextStep, details);
  state.onboarding = next;
  _saveOrRestore(previous);
  onCommitted?.(next);

  const secondsSinceNewGame = getOnboardingElapsedSeconds(next);
  EventBus.emit(EVENTS.ONBOARDING_STEP_COMPLETED, {
    version: ONBOARDING_VERSION,
    step: expectedStep,
    nextStep,
    secondsSinceNewGame,
  });
  if (nextStep === ONBOARDING_STEPS.COMPLETED) {
    EventBus.emit(EVENTS.ONBOARDING_COMPLETED, {
      version: ONBOARDING_VERSION,
      secondsSinceNewGame,
    });
    _ctx.notify?.(
      state.lang === 'en' ? 'Onboarding complete — your gang is operational.' : 'Onboarding terminé — ton gang est opérationnel.',
      'gold',
    );
  }
  _ctx.renderAll?.();
  return true;
}

function _updateOnboardingDetails(details, { render = true } = {}) {
  const state = _state();
  if (!state) return false;
  const previous = state.onboarding;
  state.onboarding = { ...normalizeOnboardingState(previous), ...details };
  _saveOrRestore(previous);
  if (render) _ctx.renderAll?.();
  return true;
}

function _openFirstAgentRecruitment() {
  const state = _state();
  const onboarding = normalizeOnboardingState(state?.onboarding);
  if (onboarding.step !== ONBOARDING_STEPS.FIRST_AGENT || onboarding.firstAgentId) return false;
  return _ctx.openAgentRecruitModal?.(
    () => _ctx.renderAll?.(),
    { cost: 0, source: 'onboarding' },
  ) ?? false;
}

function _completeOnboarding(agentId, zoneId, source = 'assignment') {
  const state = _state();
  const onboarding = normalizeOnboardingState(state?.onboarding);
  if (!state || onboarding.step !== ONBOARDING_STEPS.FIRST_AGENT
    || !zoneId || !onboarding.firstAgentId || agentId !== onboarding.firstAgentId) return false;

  const previousMoney = state.gang?.money ?? 0;
  const previousTotalMoneyEarned = state.stats?.totalMoneyEarned ?? 0;
  const rewardMoney = onboarding.completionRewardGrantedAt ? 0 : ONBOARDING_COMPLETION_REWARD;
  const grantedAt = rewardMoney > 0 ? Date.now() : onboarding.completionRewardGrantedAt;
  if (rewardMoney > 0) {
    state.gang.money = previousMoney + rewardMoney;
    if (state.stats) state.stats.totalMoneyEarned = previousTotalMoneyEarned + rewardMoney;
  }

  let committed = false;
  try {
    committed = _commitStep(
      ONBOARDING_STEPS.FIRST_AGENT,
      ONBOARDING_STEPS.COMPLETED,
      {
        completionRewardGrantedAt: grantedAt,
        completionRewardMoney: rewardMoney || onboarding.completionRewardMoney || 0,
      },
      () => _track('first_agent_assigned', { zone: zoneId, source }),
    );
  } catch (error) {
    if (rewardMoney > 0) {
      state.gang.money = previousMoney;
      if (state.stats) state.stats.totalMoneyEarned = previousTotalMoneyEarned;
    }
    throw error;
  }
  if (!committed) {
    if (rewardMoney > 0) {
      state.gang.money = previousMoney;
      if (state.stats) state.stats.totalMoneyEarned = previousTotalMoneyEarned;
    }
    return false;
  }

  if (rewardMoney > 0) {
    EventBus.emit(EVENTS.MONEY_CHANGED, { delta: rewardMoney, newTotal: state.gang.money });
  }
  _ctx.showOnboardingIdlePayoff?.({
    agent: state.agents?.find(item => item.id === agentId),
    zone: _ctx.getZoneById?.(zoneId),
    lang: state.lang,
    nextUnlock: 'market',
    rewardMoney,
    progress: getOnboardingArcProgress(state),
  });
  return true;
}

function _bindOnboardingEvents() {
  if (_eventsBound) return;
  _eventsBound = true;

  EventBus.on(EVENTS.TEAM_MEMBER_SET, ({ team, slot, source } = {}) => {
    if (team !== 'boss') return;
    _commitStep(
      ONBOARDING_STEPS.TEAM_SETUP,
      ONBOARDING_STEPS.FIRST_BATTLE,
      {},
      () => _track('first_team_member_set', {
        slot: slot ?? null,
        source: source ?? null,
      }),
    );
  });

  EventBus.on(EVENTS.COMBAT_STARTED, event => {
    const onboarding = normalizeOnboardingState(_state()?.onboarding);
    if (onboarding.step !== ONBOARDING_STEPS.FIRST_BATTLE
      || onboarding.firstBattleStartedAt
      || !isManualPlayerCombatWin(event)) return;
    _updateOnboardingDetails({ firstBattleStartedAt: Date.now() }, { render: false });
    _track('first_battle_started', {
      zone: event?.zoneId ?? null,
      trainer: event?.trainerKey ?? null,
    });
  });

  EventBus.on(EVENTS.COMBAT_WON, event => {
    if (!isManualPlayerCombatWin(event)) return;
    if (_commitStep(ONBOARDING_STEPS.FIRST_BATTLE, ONBOARDING_STEPS.FIRST_AGENT, {
      firstBattleAt: Date.now(),
    }, () => _track('first_battle_won', {
      zone: event?.zoneId ?? null,
      trainer: event?.trainerKey ?? null,
    }))) {
      _ctx.switchTab?.('tabAgents');
      setTimeout(_openFirstAgentRecruitment, 0);
    }
  });

  EventBus.on(EVENTS.AGENT_RECRUITED, ({ agentId, source } = {}) => {
    const state = _state();
    const onboarding = normalizeOnboardingState(state?.onboarding);
    if (source !== 'onboarding' || onboarding.step !== ONBOARDING_STEPS.FIRST_AGENT) return;
    if (onboarding.firstAgentId) return;
    if (_updateOnboardingDetails({ firstAgentId: agentId })) {
      _track('first_agent_recruited', { source });
    }
  });

  EventBus.on(EVENTS.AGENT_ASSIGNED, ({ agentId, zoneId } = {}) => {
    _completeOnboarding(agentId, zoneId);
  });

  EventBus.on(EVENTS.UI_TAB_CHANGED, ({ tabId } = {}) => {
    if (tabId === 'tabAgents') setTimeout(_openFirstAgentRecruitment, 0);
  });
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

async function _runOnboardingV2({ slotIdx = 0, resume = false, onComplete } = {}) {
  let state = _state();
  if (_running || (resume && !shouldRunOnboardingV2(state))) {
    releaseStoryLock(LOCK_OWNER);
    return false;
  }

  _running = true;
  try {
    if (!resume) {
      _ctx.resetStateForNewGame?.();
      state = _state();
    }
    _ctx.setActiveSaveSlot?.(slotIdx);
    const current = normalizeOnboardingState(state.onboarding);
    const isStarting = !resume || current.step === ONBOARDING_STEPS.NOT_STARTED;
    state.onboarding = resume ? current : startOnboarding(null);
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
      _track('first_encounter_started', { zone: 'route1', slot: slotIdx });
    }

    if (state.onboarding.step === ONBOARDING_STEPS.FIRST_ENCOUNTER) {
      const result = await openFirstEncounter({
        switchTab: _ctx.switchTab,
        openZoneWindow: _ctx.openZoneWindow,
        getZoneSpawns: _ctx.getZoneSpawns,
        renderSpawn: _ctx.renderSpawn,
        removeSpawn: _ctx.removeSpawn,
        uid: _ctx.uid,
        hideHub: () => document.getElementById('introOverlay')?.classList.remove('active'),
        notify: _ctx.notify,
        onCaptured: pokemon => {
          const species = pokemon?.species_en;
          if (!species) return false;
          const committed = _commitStep(ONBOARDING_STEPS.FIRST_ENCOUNTER, ONBOARDING_STEPS.IDENTITY, {
            starterSpecies: species,
          });
          if (committed) _track('first_wild_capture', { species, zone: 'route1', slot: slotIdx });
          return committed;
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
      _commitStep(ONBOARDING_STEPS.IDENTITY, ONBOARDING_STEPS.TEAM_SETUP);
      _track('identity_completed', { slot: slotIdx });
      document.getElementById('introOverlay')?.classList.remove('active');
      _ctx.renderAll?.();
      onComplete?.({ identity, onboarding: state.onboarding });
    }

    if (isOnboardingActive(state)
      && state.onboarding.step !== ONBOARDING_STEPS.FIRST_ENCOUNTER
      && state.onboarding.step !== ONBOARDING_STEPS.IDENTITY) {
      document.getElementById('introOverlay')?.classList.remove('active');
      _ctx.renderAll?.();
      if (state.onboarding.step === ONBOARDING_STEPS.FIRST_AGENT && !state.onboarding.firstAgentId) {
        setTimeout(_openFirstAgentRecruitment, 0);
      }
    }

    return true;
  } catch (error) {
    console.error('[onboarding] V2 flow failed:', error);
    EventBus.emit(EVENTS.ONBOARDING_FAILED, {
      version: ONBOARDING_VERSION,
      step: state?.onboarding?.step ?? null,
      reason: 'controller_error',
    });
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

/** Queue the guided first encounter and overlay narrative with the highest story priority. */
export function startOnboardingV2(options = {}) {
  const resume = options.resume === true;
  return requestStory(
    LOCK_OWNER,
    () => {
      void _runOnboardingV2(options);
      return true;
    },
    {
      priority: STORY_PRIORITIES.ONBOARDING,
      isEligible: () => !resume || shouldRunOnboardingV2(_state()),
    },
  );
}

/** Reconcile persisted milestones before exposing the current objective. */
export function reconcileOnboardingProgress() {
  const state = _state();
  if (!state) return null;
  state.onboarding = normalizeOnboardingState(state.onboarding);

  if (state.onboarding.step === ONBOARDING_STEPS.TEAM_SETUP && state.gang?.bossTeam?.some(Boolean)) {
    _commitStep(ONBOARDING_STEPS.TEAM_SETUP, ONBOARDING_STEPS.FIRST_BATTLE);
  }
  if (state.onboarding.step === ONBOARDING_STEPS.FIRST_BATTLE && state.onboarding.firstBattleAt) {
    _commitStep(ONBOARDING_STEPS.FIRST_BATTLE, ONBOARDING_STEPS.FIRST_AGENT);
  }
  if (state.onboarding.step === ONBOARDING_STEPS.FIRST_AGENT && state.onboarding.firstAgentId) {
    const agent = state.agents?.find(item => item.id === state.onboarding.firstAgentId);
    if (!agent) _updateOnboardingDetails({ firstAgentId: null });
    else if (agent.assignedZone) _completeOnboarding(agent.id, agent.assignedZone, 'reconcile');
  }
  return state.onboarding;
}

export function resumeOnboardingV2({ slotIdx = 0 } = {}) {
  const state = _state();
  const onboarding = reconcileOnboardingProgress();
  if (!state || !isOnboardingActive(state)) return false;

  const fingerprint = `${slotIdx}:${onboarding.step}:${onboarding.startedAt}`;
  if (_lastResumeFingerprint !== fingerprint) {
    _lastResumeFingerprint = fingerprint;
    EventBus.emit(EVENTS.ONBOARDING_RESUMED, {
      version: ONBOARDING_VERSION,
      step: onboarding.step,
      secondsSinceNewGame: getOnboardingElapsedSeconds(onboarding),
    });
  }

  if (onboarding.step === ONBOARDING_STEPS.FIRST_ENCOUNTER || onboarding.step === ONBOARDING_STEPS.IDENTITY) {
    return startOnboardingV2({ slotIdx, resume: true });
  }
  // Later steps have no overlay of their own to show: hand the player straight
  // back to the game. Closing the hub here matters when this is reached from
  // the hub's play button, not just from boot.
  document.getElementById('introOverlay')?.classList.remove('active');
  if (onboarding.step === ONBOARDING_STEPS.FIRST_AGENT && !onboarding.firstAgentId) {
    setTimeout(_openFirstAgentRecruitment, 0);
  }
  _ctx.renderAll?.();
  return true;
}
