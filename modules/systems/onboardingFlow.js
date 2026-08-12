'use strict';

export const ONBOARDING_VERSION = 2;
export const ONBOARDING_COMPLETION_REWARD = 500;

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
    firstBattleStartedAt: null,
    firstBattleAt: null,
    firstAgentId: null,
    completionRewardGrantedAt: null,
    completionRewardMoney: 0,
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
  if (!state) return false;
  const onboarding = normalizeOnboardingState(state.onboarding);
  const active = onboarding.step !== ONBOARDING_STEPS.NOT_STARTED
    && onboarding.step !== ONBOARDING_STEPS.COMPLETED;
  return active || !state.gang?.initialized;
}

export function isOnboardingActive(state) {
  if (!state) return false;
  const step = normalizeOnboardingState(state.onboarding).step;
  return step !== ONBOARDING_STEPS.NOT_STARTED && step !== ONBOARDING_STEPS.COMPLETED;
}

export function isManualPlayerCombatWin(event = {}) {
  return event.mode === 'manual' && event.initiatedBy === 'player';
}

export function getOnboardingTabAccess(state, tabId) {
  if (!isOnboardingActive(state)) return { status: 'available', reason: null };
  const step = normalizeOnboardingState(state.onboarding).step;
  const lang = state?.lang === 'en' ? 'en' : 'fr';
  const reason = lang === 'en' ? 'Keep following the current objective.' : "Continue l'objectif en cours.";
  const available = new Set();
  let lockedTab = null;

  if (step === ONBOARDING_STEPS.TEAM_SETUP || step === ONBOARDING_STEPS.FIRST_BATTLE) {
    ['tabZones', 'tabPC', 'tabGang'].forEach(id => available.add(id));
    lockedTab = 'tabAgents';
  } else if (step === ONBOARDING_STEPS.FIRST_AGENT) {
    ['tabZones', 'tabPC', 'tabGang', 'tabAgents'].forEach(id => available.add(id));
    lockedTab = 'tabMarket';
  }

  if (available.has(tabId)) return { status: 'available', reason: null };
  if (tabId === lockedTab) return { status: 'locked', reason };
  return { status: 'hidden', reason };
}

export function getOnboardingObjective(state) {
  if (!isOnboardingActive(state)) return null;
  const onboarding = normalizeOnboardingState(state.onboarding);
  const en = state?.lang === 'en';
  switch (onboarding.step) {
    case ONBOARDING_STEPS.TEAM_SETUP:
      return {
        text: en ? '⚔ Add your captured Pokémon to the Boss team' : "⚔ Ajoute ton Pokémon capturé à l'équipe Boss",
        detail: en ? '→ Pokémon' : '→ Pokémon',
        tab: 'tabPC',
        progress: getOnboardingArcProgress(state),
      };
    case ONBOARDING_STEPS.FIRST_BATTLE:
      return {
        text: en ? '🥊 Win a manual battle in a zone' : '🥊 Remporte un combat manuel dans une zone',
        detail: en ? '→ Zones' : '→ Zones',
        tab: 'tabZones',
        progress: getOnboardingArcProgress(state),
      };
    case ONBOARDING_STEPS.FIRST_AGENT: {
      const agent = state.agents?.find(item => item.id === onboarding.firstAgentId);
      return agent
        ? {
            text: en ? `👤 Assign ${agent.name} to a zone` : `👤 Assigne ${agent.name} à une zone`,
            detail: en ? '→ Agents' : '→ Agents',
            tab: 'tabAgents',
            progress: getOnboardingArcProgress(state),
          }
        : {
            text: en ? '👤 Choose your first free agent' : '👤 Choisis ton premier agent offert',
            detail: en ? '→ Agents' : '→ Agents',
            tab: 'tabAgents',
            progress: getOnboardingArcProgress(state),
          };
    }
    default:
      return null;
  }
}

export function getOnboardingArcProgress(state) {
  const onboarding = normalizeOnboardingState(state?.onboarding);
  const en = state?.lang === 'en';
  const stepOrder = [
    ONBOARDING_STEPS.NOT_STARTED,
    ONBOARDING_STEPS.FIRST_ENCOUNTER,
    ONBOARDING_STEPS.IDENTITY,
    ONBOARDING_STEPS.TEAM_SETUP,
    ONBOARDING_STEPS.FIRST_BATTLE,
    ONBOARDING_STEPS.FIRST_AGENT,
    ONBOARDING_STEPS.COMPLETED,
  ];
  const stepIndex = stepOrder.indexOf(onboarding.step);
  const milestones = [
    {
      id: 'capture',
      label: en ? 'Catch your first Pokémon' : 'Capturer ton premier Pokémon',
      completed: stepIndex >= stepOrder.indexOf(ONBOARDING_STEPS.IDENTITY),
    },
    {
      id: 'team',
      label: en ? 'Build your Boss team' : 'Constituer ton équipe Boss',
      completed: stepIndex >= stepOrder.indexOf(ONBOARDING_STEPS.FIRST_BATTLE),
    },
    {
      id: 'battle',
      label: en ? 'Win your first battle' : 'Gagner ton premier combat',
      completed: stepIndex >= stepOrder.indexOf(ONBOARDING_STEPS.FIRST_AGENT),
    },
    {
      id: 'recruit',
      label: en ? 'Recruit your first agent' : 'Recruter ton premier agent',
      completed: !!onboarding.firstAgentId || onboarding.step === ONBOARDING_STEPS.COMPLETED,
    },
    {
      id: 'assign',
      label: en ? 'Assign your first agent' : 'Assigner ton premier agent',
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
