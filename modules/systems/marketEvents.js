// ════════════════════════════════════════════════════════════════
//  MARKET EVENTS — Boosts/malus temporaires sur le prix de vente
//
//  Système d'événements qui modifient la valeur des Pokémon vendus :
//  - "Demande pour Pikachu" : +50% pendant 2h
//  - "Marché saturé en Roucool" : −30% pendant 1h
//  - "Vague shiny" : tous les shinies ×1.5 pendant 3h
//  - "Boom des rares" : tier rare/very_rare +25% pendant 4h
//
//  Apparait via tickManager (toutes les 30 min, 25% chance) ou via
//  triggerMarketEvent() manuel. Affichage centralisé via getActiveEvents().
//
//  State : state.marketEvents = [{ id, type, target, mult, startedAt, expiresAt, label, emoji }]
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });

// ── Pools de générateurs d'événements ─────────────────────────────

const EVENT_TEMPLATES = {
  // Boost d'une espèce spécifique
  species_boost: {
    weight: 30,
    durationMs: () => (1 + Math.random() * 3) * 3600000, // 1-4h
    pickTarget: () => _pickSpeciesFromOwned(),
    generate(target) {
      const mult = 1.3 + Math.random() * 0.7; // 1.3x → 2.0x
      const speciesName = globalThis.speciesName?.(target) ?? target;
      return {
        type: 'species_boost', target, mult,
        emoji: '📈',
        label: `Demande explosive pour ${speciesName}`,
        detail: `+${Math.round((mult - 1) * 100)}% sur la vente`,
      };
    },
  },
  // Malus d'une espèce spécifique
  species_malus: {
    weight: 15,
    durationMs: () => (1 + Math.random() * 2) * 3600000, // 1-3h
    pickTarget: () => _pickSpeciesFromOwned(),
    generate(target) {
      const mult = 0.4 + Math.random() * 0.3; // 0.4x → 0.7x
      const speciesName = globalThis.speciesName?.(target) ?? target;
      return {
        type: 'species_malus', target, mult,
        emoji: '📉',
        label: `Marché saturé en ${speciesName}`,
        detail: `−${Math.round((1 - mult) * 100)}% sur la vente`,
      };
    },
  },
  // Boost d'une rareté
  rarity_boost: {
    weight: 25,
    durationMs: () => (2 + Math.random() * 2) * 3600000, // 2-4h
    pickTarget: () => {
      const rarities = ['common', 'uncommon', 'rare', 'very_rare'];
      return rarities[Math.floor(Math.random() * rarities.length)];
    },
    generate(rarity) {
      const mults = { common: 1.5, uncommon: 1.4, rare: 1.3, very_rare: 1.25 };
      const mult = mults[rarity] || 1.25;
      const labels = {
        common:     'Demande de Pokémon communs',
        uncommon:   'Demande de Pokémon peu communs',
        rare:       'Boom du marché rare',
        very_rare:  'Collectionneurs en chasse',
      };
      return {
        type: 'rarity_boost', target: rarity, mult,
        emoji: '💎',
        label: labels[rarity] || `Boost ${rarity}`,
        detail: `Tous les Pokémon "${rarity}" : +${Math.round((mult - 1) * 100)}%`,
      };
    },
  },
  // Shiny premium
  shiny_premium: {
    weight: 10,
    durationMs: () => (2 + Math.random() * 4) * 3600000, // 2-6h
    pickTarget: () => 'shiny',
    generate() {
      const mult = 1.5 + Math.random() * 0.5; // 1.5x → 2.0x
      return {
        type: 'shiny_premium', target: 'shiny', mult,
        emoji: '✨',
        label: 'Frénésie des chromatiques',
        detail: `Tous les shinies : ×${mult.toFixed(2)}`,
      };
    },
  },
  // Crash shiny (rare, plaisir de joueur)
  shiny_crash: {
    weight: 3,
    durationMs: () => (1 + Math.random() * 2) * 3600000,
    pickTarget: () => 'shiny',
    generate() {
      const mult = 0.5 + Math.random() * 0.2; // 0.5x → 0.7x
      return {
        type: 'shiny_premium', target: 'shiny', mult,
        emoji: '💥',
        label: 'Krach du marché chromatique',
        detail: `Shinies dévalorisés : ×${mult.toFixed(2)}`,
      };
    },
  },
  // Bonus famille évolutive
  family_boost: {
    weight: 17,
    durationMs: () => (2 + Math.random() * 3) * 3600000, // 2-5h
    pickTarget: () => _pickEvoFamilyHead(),
    generate(targetEN) {
      const family = _getEvoFamilyMembers(targetEN);
      const mult = 1.25 + Math.random() * 0.5;
      const head = globalThis.speciesName?.(targetEN) ?? targetEN;
      return {
        type: 'family_boost', target: targetEN, members: family, mult,
        emoji: '🌳',
        label: `Lignée ${head} recherchée`,
        detail: `${family.length} espèces concernées : +${Math.round((mult - 1) * 100)}%`,
      };
    },
  },
};

// ── Helpers de sélection ───────────────────────────────────────────

function _pickSpeciesFromOwned() {
  const state = globalThis.state;
  const owned = (state?.pokemons || []).map(p => p.species_en);
  if (!owned.length) {
    // Fallback : pick une espèce Kanto random
    const all = (globalThis.POKEMON_GEN1 || []).map(s => s.en);
    return all[Math.floor(Math.random() * all.length)] || 'pikachu';
  }
  // Pondérer par fréquence (les espèces possédées en masse ont +chances d'event)
  const uniq = [...new Set(owned)];
  return uniq[Math.floor(Math.random() * uniq.length)];
}

function _pickEvoFamilyHead() {
  const evoChains = globalThis.EVOLUTION_CHAINS || {};
  const keys = Object.keys(evoChains);
  if (!keys.length) return _pickSpeciesFromOwned();
  return keys[Math.floor(Math.random() * keys.length)];
}

function _getEvoFamilyMembers(headEN) {
  const chains = globalThis.EVOLUTION_CHAINS || {};
  const chain = chains[headEN];
  if (!chain || !Array.isArray(chain)) return [headEN];
  return [headEN, ...chain.flatMap(c => c.to ? [c.to] : [])];
}

// ── API publique ───────────────────────────────────────────────────

/**
 * Tente de générer un nouvel événement de marché aléatoire.
 * Appelé périodiquement par le tickManager (cf. marketEventsTick).
 */
export function triggerMarketEvent() {
  const state = globalThis.state;
  if (!state) return null;
  if (!state.marketEvents) state.marketEvents = [];

  // Ne pas spammer : max 3 events simultanés
  pruneExpiredEvents();
  if (state.marketEvents.length >= 3) return null;

  // Tirage pondéré
  const totalWeight = Object.values(EVENT_TEMPLATES).reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * totalWeight;
  let chosenType = null;
  let chosenTpl = null;
  for (const [type, tpl] of Object.entries(EVENT_TEMPLATES)) {
    r -= tpl.weight;
    if (r <= 0) { chosenType = type; chosenTpl = tpl; break; }
  }
  if (!chosenTpl) return null;

  const target = chosenTpl.pickTarget();
  if (!target) return null;
  const data = chosenTpl.generate(target);
  const now = Date.now();
  const ev = {
    id: `me-${Math.random().toString(36).slice(2, 9)}`,
    ...data,
    startedAt: now,
    expiresAt: now + chosenTpl.durationMs(),
  };

  state.marketEvents.push(ev);
  EventBus.emit(EVENTS.STATE_DIRTY);
  _notify(`${ev.emoji} ${ev.label} — ${ev.detail}`, ev.type.includes('malus') || ev.type === 'shiny_crash' ? 'error' : 'gold');
  return ev;
}

/**
 * Retire les événements expirés.
 */
export function pruneExpiredEvents() {
  const state = globalThis.state;
  if (!state?.marketEvents?.length) return;
  const now = Date.now();
  const expired = state.marketEvents.filter(ev => now >= ev.expiresAt);
  if (expired.length) {
    state.marketEvents = state.marketEvents.filter(ev => now < ev.expiresAt);
    EventBus.emit(EVENTS.STATE_DIRTY);
  }
}

/**
 * Retourne la liste des événements actifs (non expirés).
 */
export function getActiveMarketEvents() {
  pruneExpiredEvents();
  return globalThis.state?.marketEvents || [];
}

/**
 * Calcule le multiplicateur de prix applicable à un Pokémon donné en
 * fonction des événements de marché actifs.
 *
 * @param {object} pokemon — { species_en, shiny, ... }
 * @returns {{ mult: number, contributions: Array<{event,mult}> }}
 */
export function getPriceMultiplier(pokemon) {
  const events = getActiveMarketEvents();
  let mult = 1;
  const contributions = [];
  const SPECIES_BY_EN = globalThis.SPECIES_BY_EN || {};
  const rarity = SPECIES_BY_EN[pokemon.species_en]?.rarity;

  for (const ev of events) {
    let applies = false;
    switch (ev.type) {
      case 'species_boost':
      case 'species_malus':
        applies = (ev.target === pokemon.species_en);
        break;
      case 'rarity_boost':
        applies = (ev.target === rarity);
        break;
      case 'shiny_premium':
        applies = !!pokemon.shiny;
        break;
      case 'family_boost':
        applies = (ev.members || [ev.target]).includes(pokemon.species_en);
        break;
    }
    if (applies) {
      mult *= ev.mult;
      contributions.push({ event: ev, mult: ev.mult });
    }
  }
  return { mult, contributions };
}

/**
 * Tick périodique appelé par le Scheduler — chance d'apparition d'un event.
 */
export function marketEventsTick() {
  pruneExpiredEvents();
  // 35% de chance toutes les 30 min → ~1 event toutes les 1h30 en moyenne
  if (Math.random() < 0.35) {
    triggerMarketEvent();
  }
}

// Expose globalThis pour calculatePrice() qui n'est pas un module ES
Object.assign(globalThis, {
  getMarketPriceMultiplier: getPriceMultiplier,
  getActiveMarketEvents,
  triggerMarketEvent,
});
