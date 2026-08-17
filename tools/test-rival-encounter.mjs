import assert from 'node:assert/strict';

import {
  RIVAL_COMBAT_THRESHOLD,
  RIVAL_TRAINER_KEY,
  shouldOfferRivalEncounter,
} from '../modules/ui/rivalEncounterPopup.js';
import { UNLOCKABLE_TABS } from '../data/tab-unlocks-data.js';
import { TRAINER_TYPES } from '../data/trainers-data.js';
import { ONBOARDING_STEPS } from '../modules/systems/onboardingFlow.js';

// ── Environnement minimal ──────────────────────────────────────────
// shouldOfferRivalEncounter est pure (pas de DOM/EventBus touché) ; la
// popup elle-même (DOM, combat scripté) se vérifie en navigateur, même
// convention que onboardingAmbushPopup/itemsIntroPopup.
const makeState = (over = {}) => ({
  lang: 'fr',
  gang: { initialized: true },
  onboarding: { step: ONBOARDING_STEPS.COMPLETED, status: 'completed' },
  discoveryProgress: {
    revealedTabs: [],
    rivalSceneShown: false,
    rivalPokedexUnlocked: false,
    postOnboardingZoneCombats: 0,
  },
  ...over,
});

// ── Le trainer scripté existe et n'est jamais tiré au hasard ────────
assert.ok(TRAINER_TYPES[RIVAL_TRAINER_KEY], `${RIVAL_TRAINER_KEY} doit exister dans TRAINER_TYPES`);
assert.equal(RIVAL_COMBAT_THRESHOLD, 5, 'le 5e combat en zone déclenche la scène');

// ── Cas nominal : tout est réuni ─────────────────────────────────────
assert.equal(shouldOfferRivalEncounter(makeState()), true);

// ── Jamais pendant l'onboarding ──────────────────────────────────────
assert.equal(shouldOfferRivalEncounter(makeState({
  onboarding: { step: ONBOARDING_STEPS.GUIDE_TEAM, status: 'active' },
})), false);

// ── One-shot : déjà montrée = jamais reproposée ──────────────────────
assert.equal(shouldOfferRivalEncounter(makeState({
  discoveryProgress: { revealedTabs: [], rivalSceneShown: true, rivalPokedexUnlocked: false },
})), false);

// ── Save où le Pokédex est déjà débloqué (ancienne règle 'captures', ou
// save antérieure à ce mur) : la scène ne doit jamais se déclencher, sans
// quoi un joueur avancé se verrait offrir un Pokédex qu'il a déjà. ────
assert.equal(shouldOfferRivalEncounter(makeState({
  discoveryProgress: { revealedTabs: ['tabPokedex'], rivalSceneShown: false, rivalPokedexUnlocked: false },
})), false);

// ── État vide / partie non commencée ─────────────────────────────────
assert.equal(shouldOfferRivalEncounter(null), false);
assert.equal(shouldOfferRivalEncounter(makeState({
  onboarding: { step: ONBOARDING_STEPS.NOT_STARTED, status: 'not_started' },
})), false);

// ── tabPokedex fait bien partie des onglets déblocables (sinon la règle
// 'flag' de data/tab-unlocks-data.js ne serait jamais évaluée) ────────
assert.ok(UNLOCKABLE_TABS.includes('tabPokedex'));

console.log('rival encounter tests: ok');
