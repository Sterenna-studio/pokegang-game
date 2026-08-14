'use strict';

import {
  ONBOARDING_CAPTURE_GOAL,
  ONBOARDING_GUIDE_LINES,
  ONBOARDING_ZONE_ID,
} from '../../data/onboarding-data.js';

// Bumped from 2 when the funnel changed shape (free capture on an unknown
// field → Rocket ambush → Giovanni → defector guide). Analytics needs to keep
// the two cohorts apart, and saves written by the V2 preview must not be
// replayed through steps that no longer exist.
export const ONBOARDING_VERSION = 3;
export const ONBOARDING_COMPLETION_REWARD = 500;

export const ONBOARDING_STEPS = Object.freeze({
  NOT_STARTED: 'not_started',
  FREE_CAPTURE: 'free_capture',
  ROCKET_AMBUSH: 'rocket_ambush',
  IDENTITY: 'identity',
  GUIDE_MET: 'guide_met',
  GUIDE_TEAM: 'guide_team',
  GUIDE_ZONE: 'guide_zone',
  GUIDE_COMBAT: 'guide_combat',
  COMPLETED: 'completed',
});

const NEXT_STEP = Object.freeze({
  [ONBOARDING_STEPS.NOT_STARTED]: ONBOARDING_STEPS.FREE_CAPTURE,
  [ONBOARDING_STEPS.FREE_CAPTURE]: ONBOARDING_STEPS.ROCKET_AMBUSH,
  [ONBOARDING_STEPS.ROCKET_AMBUSH]: ONBOARDING_STEPS.IDENTITY,
  [ONBOARDING_STEPS.IDENTITY]: ONBOARDING_STEPS.GUIDE_MET,
  [ONBOARDING_STEPS.GUIDE_MET]: ONBOARDING_STEPS.GUIDE_TEAM,
  [ONBOARDING_STEPS.GUIDE_TEAM]: ONBOARDING_STEPS.GUIDE_ZONE,
  [ONBOARDING_STEPS.GUIDE_ZONE]: ONBOARDING_STEPS.GUIDE_COMBAT,
  [ONBOARDING_STEPS.GUIDE_COMBAT]: ONBOARDING_STEPS.COMPLETED,
});

/** Ordre de progression — sert aux comparaisons "au moins arrivé à". */
const STEP_ORDER = Object.freeze([
  ONBOARDING_STEPS.NOT_STARTED,
  ONBOARDING_STEPS.FREE_CAPTURE,
  ONBOARDING_STEPS.ROCKET_AMBUSH,
  ONBOARDING_STEPS.IDENTITY,
  ONBOARDING_STEPS.GUIDE_MET,
  ONBOARDING_STEPS.GUIDE_TEAM,
  ONBOARDING_STEPS.GUIDE_ZONE,
  ONBOARDING_STEPS.GUIDE_COMBAT,
  ONBOARDING_STEPS.COMPLETED,
]);

export function defaultOnboardingState() {
  return {
    version: ONBOARDING_VERSION,
    status: ONBOARDING_STEPS.NOT_STARTED,
    step: ONBOARDING_STEPS.NOT_STARTED,
    startedAt: null,
    completedAt: null,
    fieldCaptures: 0,
    starterSpecies: null,
    ambushAt: null,
    ambushWon: false,
    guideAgentId: null,
    guideSprite: null,
    firstBattleAt: null,
    completionRewardGrantedAt: null,
    completionRewardMoney: 0,
  };
}

function _statusForStep(step) {
  if (step === ONBOARDING_STEPS.COMPLETED) return 'completed';
  if (step === ONBOARDING_STEPS.NOT_STARTED) return 'not_started';
  return 'active';
}

export function normalizeOnboardingState(value) {
  const base = defaultOnboardingState();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  // An unknown step means a save written by an older funnel (or a corrupted
  // field). Treat it as "no onboarding" rather than replaying a step that no
  // longer exists — migrateSave decides whether such a save is already done.
  const step = Object.values(ONBOARDING_STEPS).includes(value.step)
    ? value.step
    : base.step;
  return {
    ...base,
    ...value,
    version: ONBOARDING_VERSION,
    step,
    fieldCaptures: Math.max(0, Math.floor(Number(value.fieldCaptures) || 0)),
    status: _statusForStep(step),
  };
}

export function startOnboarding(value, now = Date.now()) {
  const current = normalizeOnboardingState(value);
  if (current.step !== ONBOARDING_STEPS.NOT_STARTED) return current;
  return {
    ...current,
    status: 'active',
    step: ONBOARDING_STEPS.FREE_CAPTURE,
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
    status: _statusForStep(nextStep),
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
  if (!state) return false;
  return isOnboardingActive(state) || !state.gang?.initialized;
}

export function isOnboardingActive(state) {
  if (!state) return false;
  const step = normalizeOnboardingState(state.onboarding).step;
  return step !== ONBOARDING_STEPS.NOT_STARTED && step !== ONBOARDING_STEPS.COMPLETED;
}

/** True once the run has reached `step` (or gone past it). */
export function hasReachedStep(state, step) {
  const current = normalizeOnboardingState(state?.onboarding).step;
  return STEP_ORDER.indexOf(current) >= STEP_ORDER.indexOf(step);
}

/** The starting field only exists during the onboarding. */
export function isOnboardingFieldZone(zoneId) {
  return zoneId === ONBOARDING_ZONE_ID;
}

/** Free-capture phase: wild spawns run normally and every catch counts. */
export function isOnboardingFreeCapture(state, zoneId = null) {
  if (zoneId !== null && !isOnboardingFieldZone(zoneId)) return false;
  return normalizeOnboardingState(state?.onboarding).step === ONBOARDING_STEPS.FREE_CAPTURE;
}

/**
 * During the ambush the field must stop producing wild Pokémon: the raid is
 * the only thing left to interact with, and a zone capped at five spawns could
 * otherwise leave no room for it.
 */
export function isOnboardingZoneFrozen(state, zoneId = null) {
  if (zoneId !== null && !isOnboardingFieldZone(zoneId)) return false;
  const step = normalizeOnboardingState(state?.onboarding).step;
  return step === ONBOARDING_STEPS.ROCKET_AMBUSH
    || step === ONBOARDING_STEPS.IDENTITY
    || step === ONBOARDING_STEPS.GUIDE_MET;
}

export function getOnboardingCaptureProgress(state) {
  const onboarding = normalizeOnboardingState(state?.onboarding);
  return {
    caught: Math.min(onboarding.fieldCaptures, ONBOARDING_CAPTURE_GOAL),
    goal: ONBOARDING_CAPTURE_GOAL,
    reached: onboarding.fieldCaptures >= ONBOARDING_CAPTURE_GOAL,
  };
}

export function isManualPlayerCombatWin(event = {}) {
  return event.mode === 'manual' && event.initiatedBy === 'player';
}

/**
 * The defector joins for free. Both the recruit modal (which sets the price)
 * and the Agents tab card (which advertises it) must agree, so the rule lives
 * here rather than being restated at each call site.
 */
export function isOnboardingFreeAgentPending(state) {
  const onboarding = normalizeOnboardingState(state?.onboarding);
  return onboarding.step === ONBOARDING_STEPS.GUIDE_MET && !onboarding.guideAgentId;
}

export function getOnboardingTabAccess(state, tabId) {
  if (!isOnboardingActive(state)) return { status: 'available', reason: null };
  const step = normalizeOnboardingState(state.onboarding).step;
  const lang = state?.lang === 'en' ? 'en' : 'fr';
  const reason = lang === 'en' ? 'Keep following the current objective.' : "Continue l'objectif en cours.";

  // Giovanni owns the whole screen here and cannot be dismissed, so nothing is
  // reachable behind it. Spelled out rather than left to fall through the
  // chain, so it stays deliberate if that screen ever becomes closable.
  if (step === ONBOARDING_STEPS.IDENTITY) return { status: 'hidden', reason };

  const available = new Set();
  let lockedTab = null;

  if (step === ONBOARDING_STEPS.FREE_CAPTURE
    || step === ONBOARDING_STEPS.ROCKET_AMBUSH
    || step === ONBOARDING_STEPS.GUIDE_MET) {
    available.add('tabZones');
  } else if (step === ONBOARDING_STEPS.GUIDE_TEAM) {
    // He asks for a Pokémon: the PC is where one is handed over.
    ['tabZones', 'tabPC', 'tabAgents'].forEach(id => available.add(id));
    lockedTab = 'tabGang';
  } else if (step === ONBOARDING_STEPS.GUIDE_ZONE || step === ONBOARDING_STEPS.GUIDE_COMBAT) {
    ['tabZones', 'tabPC', 'tabAgents', 'tabGang'].forEach(id => available.add(id));
    lockedTab = 'tabMarket';
  }

  if (available.has(tabId)) return { status: 'available', reason: null };
  if (tabId === lockedTab) return { status: 'locked', reason };
  return { status: 'hidden', reason };
}

/** The guide's current line, or null when he has nothing to ask for. */
export function getOnboardingGuideLine(state) {
  const onboarding = normalizeOnboardingState(state?.onboarding);
  const en = state?.lang === 'en';
  const line = key => (en ? ONBOARDING_GUIDE_LINES[key].en : ONBOARDING_GUIDE_LINES[key].fr);
  switch (onboarding.step) {
    case ONBOARDING_STEPS.GUIDE_MET:    return line(onboarding.guideAgentId ? 'metFollowUp' : 'met');
    case ONBOARDING_STEPS.GUIDE_TEAM:   return line('team');
    case ONBOARDING_STEPS.GUIDE_ZONE:   return line('zone');
    case ONBOARDING_STEPS.GUIDE_COMBAT: return line('combat');
    default: return null;
  }
}

export function getOnboardingObjective(state) {
  if (!isOnboardingActive(state)) return null;
  const onboarding = normalizeOnboardingState(state.onboarding);
  const en = state?.lang === 'en';
  const progress = getOnboardingArcProgress(state);
  const zoneLabel = en ? '→ Unknown Field' : '→ Zone inconnue';

  switch (onboarding.step) {
    case ONBOARDING_STEPS.FREE_CAPTURE: {
      const { caught, goal } = getOnboardingCaptureProgress(state);
      return {
        text: en
          ? `● Catch Pokémon on this field (${caught}/${goal})`
          : `● Capture des Pokémon sur ce terrain (${caught}/${goal})`,
        detail: zoneLabel, tab: 'tabZones', progress,
      };
    }
    case ONBOARDING_STEPS.ROCKET_AMBUSH:
      return {
        text: en ? '⚔ Team Rocket grunts are blocking your way' : '⚔ Des sbires de la Team Rocket te barrent la route',
        detail: zoneLabel, tab: 'tabZones', progress,
      };
    case ONBOARDING_STEPS.GUIDE_MET:
      return {
        text: en ? '👤 Someone is waiting for you on the field' : '👤 Quelqu’un t’attend sur le terrain',
        detail: zoneLabel, tab: 'tabZones', progress,
      };
    case ONBOARDING_STEPS.GUIDE_TEAM:
      return {
        text: en ? '🎁 Hand a Pokémon over to your agent' : '🎁 Confie un Pokémon à ton agent',
        detail: en ? '→ Pokémon' : '→ Pokémon', tab: 'tabPC', progress,
      };
    case ONBOARDING_STEPS.GUIDE_ZONE:
      return {
        text: en ? '📍 Assign your agent to a zone' : '📍 Assigne ton agent à une zone',
        detail: '→ Agents', tab: 'tabAgents', progress,
      };
    case ONBOARDING_STEPS.GUIDE_COMBAT:
      return {
        text: en ? '⚔️ Switch on your agent’s battle option' : '⚔️ Active l’option combat de ton agent',
        detail: '→ Agents', tab: 'tabAgents', progress,
      };
    default:
      return null;
  }
}

export function getOnboardingArcProgress(state) {
  const onboarding = normalizeOnboardingState(state?.onboarding);
  const en = state?.lang === 'en';
  const reached = step => STEP_ORDER.indexOf(onboarding.step) >= STEP_ORDER.indexOf(step);
  const milestones = [
    {
      id: 'capture',
      label: en ? 'Catch your first Pokémon' : 'Capturer tes premiers Pokémon',
      completed: reached(ONBOARDING_STEPS.ROCKET_AMBUSH),
    },
    {
      id: 'ambush',
      label: en ? 'Face the Rocket grunts' : 'Affronter les sbires Rocket',
      completed: reached(ONBOARDING_STEPS.IDENTITY),
    },
    {
      id: 'gang',
      label: en ? 'Found your gang' : 'Fonder ton gang',
      completed: reached(ONBOARDING_STEPS.GUIDE_MET),
    },
    {
      id: 'recruit',
      label: en ? 'Recruit the defector' : 'Recruter le transfuge',
      completed: reached(ONBOARDING_STEPS.GUIDE_TEAM),
    },
    {
      id: 'equip',
      label: en ? 'Equip and post him' : 'L’équiper et l’assigner',
      completed: reached(ONBOARDING_STEPS.GUIDE_COMBAT),
    },
    {
      id: 'combat',
      label: en ? 'Send him into battle' : 'Le lâcher au combat',
      completed: onboarding.step === ONBOARDING_STEPS.COMPLETED,
    },
  ];
  return {
    label: en ? 'NEW BOSS' : 'NOUVEAU BOSS',
    completed: milestones.filter(item => item.completed).length,
    total: milestones.length,
    milestones,
  };
}
