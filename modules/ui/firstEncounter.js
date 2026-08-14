'use strict';

import { EventBus, EVENTS } from '../core/eventBus.js';
import { ONBOARDING_STARTERS } from '../../data/onboarding-data.js';

export const FIRST_ENCOUNTER_ZONE_ID = 'route1';

const FIRST_ENCOUNTER_POSITIONS = Object.freeze([
  Object.freeze({ x: 45, y: 42 }),
  Object.freeze({ x: 150, y: 92 }),
  Object.freeze({ x: 255, y: 38 }),
]);

let _fallbackId = 0;

/** Build the three runtime spawns shown by the real Route 1 zone renderer. */
export function createFirstEncounterSpawns(uid = null) {
  const makeId = typeof uid === 'function'
    ? uid
    : () => `onboarding-spawn-${Date.now()}-${++_fallbackId}`;
  return ONBOARDING_STARTERS.map((starter, index) => ({
    id: makeId(),
    type: 'pokemon',
    species_en: starter.en,
    position: FIRST_ENCOUNTER_POSITIONS[index],
    // Only `onboarding`/`firstEncounter` are read (by the capture listener below
    // and by tickZoneSpawn). Capture itself is unconditional for every spawn in
    // the game — tryCapture() never rolls — so no "guaranteed" flag is needed.
    spawnCtx: {
      onboarding: true,
      firstEncounter: true,
    },
  }));
}

/**
 * Restore the three starters when the zone lost them — closing the zone window
 * deletes its spawn list, and tickZoneSpawn is deliberately muted during this
 * step, so without this Route 1 would stay empty forever while every other tab
 * is still locked. No-op unless the list is actually empty.
 */
export function reseedFirstEncounterSpawns(spawns, { uid, renderSpawn } = {}) {
  if (!Array.isArray(spawns) || spawns.length > 0) return false;
  const seeded = createFirstEncounterSpawns(uid);
  spawns.push(...seeded);
  for (const spawn of seeded) renderSpawn?.(FIRST_ENCOUNTER_ZONE_ID, spawn);
  return true;
}

/**
 * Opens Route 1 and seeds its actual zone viewport with the three onboarding
 * Pokémon. The normal renderer, click handler, ball animation and capture
 * engine remain authoritative; this module only owns the temporary spawn set.
 */
export function openFirstEncounter({
  switchTab,
  openZoneWindow,
  getZoneSpawns,
  renderSpawn,
  removeSpawn,
  uid,
  hideHub,
  notify,
  onCaptured,
} = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let seededSpawns = [];

    const stopListening = EventBus.on(EVENTS.POKEMON_CAPTURED, payload => {
      const { pokemon, zoneId, spawnCtx } = payload || {};
      if (settled || zoneId !== FIRST_ENCOUNTER_ZONE_ID
        || !spawnCtx?.onboarding || !spawnCtx?.firstEncounter || !pokemon) return;
      settled = true;
      stopListening();

      // tryCapture emits synchronously before it finishes updating the
      // Pokédex/stat counters. Continue the narrative on the next microtask.
      queueMicrotask(async () => {
        try {
          // Read the live spawn list rather than the seeded closure: if the
          // player closed and reopened Route 1, the zone was re-seeded with a
          // fresh set of ids and the original ones no longer exist.
          const liveSpawns = getZoneSpawns?.(FIRST_ENCOUNTER_ZONE_ID) || seededSpawns;
          for (const spawn of [...liveSpawns]) {
            if (spawn.spawnCtx?.firstEncounter) {
              removeSpawn?.(FIRST_ENCOUNTER_ZONE_ID, spawn.id);
            }
          }
          const accepted = await onCaptured?.(pokemon, payload);
          if (accepted === false) throw new Error('[onboarding] First Route 1 capture was rejected');
          resolve({ species: pokemon.species_en, pokemon });
        } catch (error) {
          reject(error);
        }
      });
    });

    try {
      hideHub?.();
      if (switchTab?.('tabZones') === false) {
        throw new Error('[onboarding] Route 1 tab is not available');
      }
      openZoneWindow?.(FIRST_ENCOUNTER_ZONE_ID);
      const zoneSpawns = getZoneSpawns?.(FIRST_ENCOUNTER_ZONE_ID);
      if (!Array.isArray(zoneSpawns)) {
        throw new Error('[onboarding] Route 1 spawn collection is unavailable');
      }

      // A retry in the same runtime must return to the same clean three-choice
      // scene instead of stacking encounters left by an interrupted attempt.
      for (const spawn of [...zoneSpawns]) {
        removeSpawn?.(FIRST_ENCOUNTER_ZONE_ID, spawn.id);
      }
      seededSpawns = createFirstEncounterSpawns(uid);
      zoneSpawns.push(...seededSpawns);
      for (const spawn of seededSpawns) renderSpawn?.(FIRST_ENCOUNTER_ZONE_ID, spawn);

      notify?.(
        globalThis.state?.lang === 'en'
          ? 'Route 1 — choose one of the three wild Pokémon. Your first catch is guaranteed.'
          : 'Route 1 — choisis l’un des trois Pokémon sauvages. Ta première capture est garantie.',
        'gold',
      );
    } catch (error) {
      settled = true;
      stopListening();
      reject(error);
    }
  });
}
