// ════════════════════════════════════════════════════════════════
//  BLACK MARKET BULLETIN — Demandes spécifiques toutes les 2h
//
//  Le marché noir publie périodiquement (~2h) un bulletin de 3-5 demandes
//  ciblées qui poussent le joueur à farmer des objectifs précis :
//
//   "Le syndicat cherche 5× Lapras Lv.30+ → 250 000₽ + 50 rep"
//   "Demande urgente : 3× Pikachu shiny → 1M₽"
//   "Boost spawn : route5 ×2 raretés pendant 2h"
//   "Recherche : Lignée Bulbizarre complète → 80 000₽"
//
//  Les demandes peuvent être validées (turn-in) une fois remplies.
//
//  State : state.blackMarketBulletin = {
//    issuedAt, expiresAt, listings: [{ id, type, target, qty, reward, accepted, completed }]
//  }
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });

const BULLETIN_LIFE_MS  = 2 * 60 * 60 * 1000; // 2h
const LISTINGS_PER_ISSUE = 4;

// ── Templates de listing ──────────────────────────────────────────

const LISTING_TYPES = {
  // Acheter N pokémon d'une espèce avec contraintes
  species_bulk: {
    weight: 35,
    generate() {
      const speciesEN = _pickInterestingSpecies();
      if (!speciesEN) return null;
      const SPECIES_BY_EN = globalThis.SPECIES_BY_EN || {};
      const sp = SPECIES_BY_EN[speciesEN];
      const isLegend = sp?.rarity === 'legendary' || sp?.rarity === 'very_rare';
      const qty = isLegend ? 1 : (2 + Math.floor(Math.random() * 4)); // 2-5 ou 1 si rare
      const minLevel = 20 + Math.floor(Math.random() * 30);
      const speciesName = globalThis.speciesName?.(speciesEN) ?? speciesEN;
      const baseReward = (globalThis.BASE_PRICE?.[sp?.rarity] || 200) * qty * 6;
      return {
        type: 'species_bulk',
        target: speciesEN,
        qty,
        minLevel,
        emoji: '🎯',
        label: `Livraison : ${qty}× ${speciesName} Lv.${minLevel}+`,
        detail: `${speciesName} en bonne condition demandé par un collectionneur.`,
        reward: { money: baseReward, rep: Math.round(baseReward / 1000) * 3 },
      };
    },
  },
  // Acheter un shiny d'une famille
  shiny_demand: {
    weight: 15,
    generate() {
      const speciesEN = _pickSpeciesPlayerHas();
      if (!speciesEN) return null;
      const speciesName = globalThis.speciesName?.(speciesEN) ?? speciesEN;
      return {
        type: 'shiny_demand',
        target: speciesEN,
        qty: 1,
        shiny: true,
        emoji: '✨',
        label: `Recherche shiny : ${speciesName}`,
        detail: 'Un acheteur paie le prix fort pour un spécimen chromatique.',
        reward: { money: 500000, rep: 100 },
      };
    },
  },
  // Famille évolutive complète
  family_complete: {
    weight: 20,
    generate() {
      const chains = globalThis.EVOLUTION_CHAINS || {};
      const keys = Object.keys(chains);
      if (!keys.length) return null;
      const head = keys[Math.floor(Math.random() * keys.length)];
      const family = [head, ...(chains[head]?.flatMap(c => c.to ? [c.to] : []) ?? [])];
      const headName = globalThis.speciesName?.(head) ?? head;
      return {
        type: 'family_complete',
        target: head,
        members: family,
        qty: family.length,
        emoji: '🌳',
        label: `Lignée complète : ${headName}`,
        detail: `Livrez 1 spécimen de chaque évolution (${family.length} pokémon).`,
        reward: { money: 80000 + family.length * 25000, rep: 40 + family.length * 10 },
      };
    },
  },
  // Boost de zone temporaire
  zone_boost: {
    weight: 15,
    generate() {
      const ZONES = globalThis.ZONES || [];
      const openableZones = ZONES.filter(z => z.type === 'route' || z.type === 'special');
      if (!openableZones.length) return null;
      const z = openableZones[Math.floor(Math.random() * openableZones.length)];
      return {
        type: 'zone_boost',
        target: z.id,
        qty: 1,
        emoji: '🗺️',
        label: `Rumeurs sur ${z.fr || z.id}`,
        detail: 'Activez cette demande pour booster ×2 le taux de raretés pendant 2h dans cette zone.',
        reward: { rareBoost: { zoneId: z.id, durationMs: 2 * 3600000, multiplier: 2 } },
      };
    },
  },
  // Achat de coffres / loot
  bulk_money: {
    weight: 15,
    generate() {
      const baseTarget = [50000, 100000, 200000, 500000][Math.floor(Math.random() * 4)];
      const rewardMult = 1.4 + Math.random() * 0.4; // 1.4x → 1.8x
      return {
        type: 'bulk_money',
        target: 'money',
        qty: baseTarget,
        emoji: '💰',
        label: `Dépôt en cash : ${baseTarget.toLocaleString()}₽`,
        detail: `Versez ${baseTarget.toLocaleString()}₽ au marché noir pour les blanchir.`,
        reward: { money: Math.round(baseTarget * rewardMult), rep: Math.round(baseTarget / 5000) },
      };
    },
  },
};

// ── Helpers ────────────────────────────────────────────────────────

function _pickInterestingSpecies() {
  // Pondère : espèces que le joueur a déjà vues > nouvelles espèces
  const state = globalThis.state;
  const SPECIES = globalThis.SPECIES_BY_EN || {};
  const seen = Object.keys(state?.pokedex || {}).filter(k => state.pokedex[k].seen);
  const pool = seen.length ? seen : (globalThis.POKEMON_GEN1 || []).map(s => s.en).slice(0, 60);
  // Exclure les noSell + ceux sans data
  const valid = pool.filter(en => SPECIES[en] && !SPECIES[en].noSell);
  if (!valid.length) return null;
  return valid[Math.floor(Math.random() * valid.length)];
}

function _pickSpeciesPlayerHas() {
  const state = globalThis.state;
  const owned = [...new Set((state?.pokemons || []).map(p => p.species_en))];
  if (!owned.length) return _pickInterestingSpecies();
  return owned[Math.floor(Math.random() * owned.length)];
}

function _generateListing() {
  const totalWeight = Object.values(LISTING_TYPES).reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * totalWeight;
  for (const tpl of Object.values(LISTING_TYPES)) {
    r -= tpl.weight;
    if (r <= 0) return tpl.generate();
  }
  return null;
}

// ── API publique ───────────────────────────────────────────────────

/**
 * Génère un nouveau bulletin (appelé toutes les 2h par le Scheduler).
 * Remplace l'ancien bulletin s'il existe.
 */
export function rotateBlackMarketBulletin() {
  const state = globalThis.state;
  if (!state) return null;
  const now = Date.now();

  const listings = [];
  let attempts = 0;
  while (listings.length < LISTINGS_PER_ISSUE && attempts < 20) {
    const l = _generateListing();
    if (l) {
      l.id = `bml-${Math.random().toString(36).slice(2, 9)}`;
      l.completed = false;
      l.accepted  = false;
      listings.push(l);
    }
    attempts++;
  }

  state.blackMarketBulletin = {
    issuedAt:  now,
    expiresAt: now + BULLETIN_LIFE_MS,
    listings,
  };
  EventBus.emit(EVENTS.STATE_DIRTY);
  _notify('🌑 Nouveau bulletin du marché noir disponible', 'gold');
  return state.blackMarketBulletin;
}

/**
 * Tick périodique — rotation automatique du bulletin.
 */
export function blackMarketTick() {
  const state = globalThis.state;
  if (!state) return;
  const b = state.blackMarketBulletin;
  if (!b || Date.now() >= b.expiresAt) {
    rotateBlackMarketBulletin();
  }
}

/**
 * Récupère le bulletin actuel (ou en génère un si aucun).
 */
export function getCurrentBulletin() {
  const state = globalThis.state;
  if (!state) return null;
  if (!state.blackMarketBulletin || Date.now() >= state.blackMarketBulletin.expiresAt) {
    return rotateBlackMarketBulletin();
  }
  return state.blackMarketBulletin;
}

/**
 * Marque un listing comme complété ET applique la récompense.
 * @returns {boolean} true si succès
 */
export function completeBlackMarketListing(listingId) {
  const state = globalThis.state;
  const b = state?.blackMarketBulletin;
  if (!b) return false;
  const listing = b.listings.find(l => l.id === listingId);
  if (!listing || listing.completed) return false;

  // Validation de la demande
  const valid = _validateListing(listing);
  if (!valid.ok) {
    _notify(`❌ ${valid.reason}`, 'error');
    return false;
  }

  // Application : consume + reward
  _consumeListing(listing);
  _applyListingReward(listing);
  listing.completed = true;

  EventBus.emit(EVENTS.STATE_DIRTY);
  _notify(`🌑 Marché noir : "${listing.label}" complété !`, 'gold');
  return true;
}

function _validateListing(listing) {
  const state = globalThis.state;
  switch (listing.type) {
    case 'species_bulk': {
      const candidates = state.pokemons.filter(p =>
        p.species_en === listing.target &&
        p.level >= (listing.minLevel || 1) &&
        !globalThis.getPensionSlotIds?.()?.has(p.id) &&
        !state.gang.bossTeam.includes(p.id) &&
        !state.agents.some(a => a.team?.includes(p.id))
      );
      if (candidates.length < listing.qty) {
        return { ok: false, reason: `Il faut ${listing.qty} ${globalThis.speciesName?.(listing.target)} Lv.${listing.minLevel}+ libres (tu en as ${candidates.length}).` };
      }
      return { ok: true, candidates: candidates.slice(0, listing.qty) };
    }
    case 'shiny_demand': {
      const candidate = state.pokemons.find(p => p.species_en === listing.target && p.shiny);
      if (!candidate) return { ok: false, reason: `Aucun ${globalThis.speciesName?.(listing.target)} shiny dans ta collection.` };
      return { ok: true, candidates: [candidate] };
    }
    case 'family_complete': {
      const members = listing.members || [listing.target];
      const missing = members.filter(en => !state.pokemons.some(p => p.species_en === en));
      if (missing.length) {
        return { ok: false, reason: `Lignée incomplète : il manque ${missing.length} espèce(s).` };
      }
      // 1 spécimen de chaque
      const picks = members.map(en => state.pokemons.find(p => p.species_en === en)).filter(Boolean);
      return { ok: true, candidates: picks };
    }
    case 'zone_boost': {
      return { ok: true };
    }
    case 'bulk_money': {
      if (state.gang.money < listing.qty) {
        return { ok: false, reason: `Pas assez d'argent (${state.gang.money.toLocaleString()}₽ / ${listing.qty.toLocaleString()}₽).` };
      }
      return { ok: true };
    }
  }
  return { ok: false, reason: 'Type de demande inconnu.' };
}

function _consumeListing(listing) {
  const state = globalThis.state;
  const valid = _validateListing(listing);
  if (!valid.ok) return;
  switch (listing.type) {
    case 'species_bulk':
    case 'shiny_demand':
    case 'family_complete':
      // Retirer les pokémon des assignations + collection
      for (const p of valid.candidates) {
        for (const agent of state.agents) {
          agent.team = (agent.team || []).filter(id => id !== p.id);
        }
        state.gang.bossTeam = state.gang.bossTeam.filter(id => id !== p.id);
        const idx = state.pokemons.findIndex(pk => pk.id === p.id);
        if (idx >= 0) state.pokemons.splice(idx, 1);
      }
      break;
    case 'bulk_money':
      state.gang.money -= listing.qty;
      break;
    case 'zone_boost':
      // Rien à consumer, juste activer le boost
      break;
  }
}

function _applyListingReward(listing) {
  const state = globalThis.state;
  const r = listing.reward || {};
  if (r.money) {
    state.gang.money += r.money;
    state.stats.totalMoneyEarned += r.money;
    EventBus.emit(EVENTS.MONEY_CHANGED, { delta: r.money, newTotal: state.gang.money });
  }
  if (r.rep) {
    state.gang.reputation += r.rep;
    EventBus.emit(EVENTS.REP_CHANGED, { delta: r.rep, newTotal: state.gang.reputation });
  }
  if (r.rareBoost) {
    // Activer un boost de rareté sur la zone via marketEvents (utilise le système d'events comme delivery mechanism)
    if (!state.marketEvents) state.marketEvents = [];
    state.marketEvents.push({
      id: `bml-rareBoost-${Math.random().toString(36).slice(2, 7)}`,
      type: 'zone_rare_boost',
      target: r.rareBoost.zoneId,
      mult: r.rareBoost.multiplier,
      emoji: '🗺️',
      label: `Boost rares : ${r.rareBoost.zoneId}`,
      detail: `×${r.rareBoost.multiplier} sur les rares`,
      startedAt: Date.now(),
      expiresAt: Date.now() + r.rareBoost.durationMs,
    });
  }
}

Object.assign(globalThis, {
  getCurrentBulletin,
  rotateBlackMarketBulletin,
  completeBlackMarketListing,
});
