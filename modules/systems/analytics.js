'use strict';

// ════════════════════════════════════════════════════════════════
//  ANALYTICS — GA4 gameplay event tracking
//
//  gtag.js itself is loaded as a classic <script> in index.html (the
//  measurement ID is public, not a secret, so the exact same snippet
//  ships on the main site AND the itch.io build — no config.js
//  dependency, unlike Supabase). This module only decides WHEN to
//  call the global gtag() function, and tags every event with
//  `platform` (web/itch/dev) so both populations land in one GA4
//  property and can be compared/filtered.
//
//  The generic first_capture milestone is gated on persisted lifetime stats.
//  Onboarding-specific funnel events (including first_battle_won) are emitted
//  by the V2 controller, which persists each transition before tracking it.
//
//  Dépendances globalThis : state, gtag (posé par index.html)
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';
import { GAME_VERSION } from '../../state/defaultState.js';

function _detectPlatform() {
  const h = location.hostname;
  if (h.endsWith('.itch.io') || h.includes('itch.zone') || h.endsWith('.hwcdn.st')) return 'itch';
  if (h === 'pokegang.sterenna.fr') return 'web';
  return 'dev';
}
const _platform = _detectPlatform();

function trackEvent(name, params = {}) {
  if (typeof globalThis.gtag !== 'function') return;
  try {
    globalThis.gtag('event', name, { platform: _platform, game_version: GAME_VERSION, ...params });
  } catch (err) {
    console.warn('[Analytics] trackEvent failed:', name, err);
  }
}

// ── Captures ───────────────────────────────────────────────────────
EventBus.on(EVENTS.POKEMON_CAPTURED, ({ pokemon, zoneId } = {}) => {
  const state = globalThis.state;
  trackEvent('pokemon_captured', {
    species: pokemon?.species_en ?? null,
    shiny:   !!pokemon?.shiny,
    zone:    zoneId ?? null,
  });
  if (state?.stats?.totalCaught === 1) {
    trackEvent('first_capture', { species: pokemon?.species_en ?? null });
  }
});

// ── Combat / agents ──────────────────────────────────────────────
// Le contrôleur d'onboarding ne consomme plus ces deux-là depuis que le
// tunnel passe par l'embuscade et le transfuge, mais ils restent des signaux
// utiles hors première session — et check-events exige que tout emit ait
// un abonné.
EventBus.on(EVENTS.COMBAT_STARTED, ({ zoneId, trainerKey, mode } = {}) => {
  trackEvent('battle_started', {
    zone: zoneId ?? null, trainer: trainerKey ?? null, mode: mode ?? null,
  });
});

EventBus.on(EVENTS.AGENT_RECRUITED, ({ source, cost } = {}) => {
  const state = globalThis.state;
  trackEvent('agent_recruited', {
    source: source ?? null, cost: cost ?? 0, total_agents: state?.agents?.length ?? 0,
  });
});

// ── Onboarding V2 ────────────────────────────────────────────────
EventBus.on(EVENTS.ONBOARDING_STARTED, ({ version, slotIdx } = {}) => {
  trackEvent('onboarding_started', { onboarding_version: version, slot: slotIdx });
});

EventBus.on(EVENTS.ONBOARDING_STEP_COMPLETED, ({ step, nextStep, secondsSinceNewGame } = {}) => {
  trackEvent('onboarding_step_completed', {
    step,
    next_step: nextStep,
    seconds_since_new_game: secondsSinceNewGame,
  });
});

EventBus.on(EVENTS.ONBOARDING_RESUMED, ({ version, step, secondsSinceNewGame } = {}) => {
  trackEvent('onboarding_resumed', {
    onboarding_version: version,
    step,
    seconds_since_new_game: secondsSinceNewGame,
  });
});

EventBus.on(EVENTS.ONBOARDING_COMPLETED, ({ version, secondsSinceNewGame } = {}) => {
  trackEvent('onboarding_completed', {
    onboarding_version: version,
    seconds_since_new_game: secondsSinceNewGame,
  });
});

EventBus.on(EVENTS.ONBOARDING_FAILED, ({ version, step, reason } = {}) => {
  trackEvent('onboarding_failed', {
    onboarding_version: version,
    step,
    reason,
  });
});

Object.assign(globalThis, { trackEvent });
export {};
