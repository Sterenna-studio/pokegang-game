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
//  Milestone events (first_capture, first_battle_won) are gated on
//  persisted lifetime stats (state.stats.totalCaught/totalFightsWon
//  === 1 right after increment), not an in-memory flag — an in-memory
//  flag would be reset on every reload and misfire "first_x" again
//  for returning players on their very next capture/win.
//
//  Dépendances globalThis : state, gtag (posé par index.html)
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';

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
    globalThis.gtag('event', name, { platform: _platform, ...params });
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

// ── Combat ─────────────────────────────────────────────────────────
EventBus.on(EVENTS.COMBAT_WON, ({ zoneId, trainerKey, elite } = {}) => {
  const state = globalThis.state;
  if (state?.stats?.totalFightsWon === 1) {
    trackEvent('first_battle_won', { zone: zoneId ?? null, trainer: trainerKey ?? null, elite: !!elite });
  }
});

Object.assign(globalThis, { trackEvent });
export {};
