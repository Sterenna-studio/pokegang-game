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
  // ── Livraison espèce x N (revu : reward × 3) ─────────────────────
  species_bulk: {
    weight: 28,
    generate() {
      const speciesEN = _pickInterestingSpecies();
      if (!speciesEN) return null;
      const SPECIES_BY_EN = globalThis.SPECIES_BY_EN || {};
      const sp = SPECIES_BY_EN[speciesEN];
      const isLegend = sp?.rarity === 'legendary' || sp?.rarity === 'very_rare';
      const qty = isLegend ? 1 : (2 + Math.floor(Math.random() * 4));
      const minLevel = 20 + Math.floor(Math.random() * 40);
      const speciesName = globalThis.speciesName?.(speciesEN) ?? speciesEN;
      const baseReward = (globalThis.BASE_PRICE?.[sp?.rarity] || 200) * qty * 18; // ×3 vs avant
      const items = isLegend ? { masterball: 1 } : (Math.random() < 0.5 ? { ultraball: 5 } : null);
      return {
        type: 'species_bulk', target: speciesEN, qty, minLevel,
        emoji: '🎯',
        label: `Livraison : ${qty}× ${speciesName} Lv.${minLevel}+`,
        detail: `${speciesName} en bonne condition pour un collectionneur fortuné.`,
        reward: { money: baseReward, rep: Math.round(baseReward / 1000) * 4, items },
      };
    },
  },

  // ── Recherche shiny (revu : 500k → 1.2M) ─────────────────────────
  shiny_demand: {
    weight: 12,
    generate() {
      const speciesEN = _pickSpeciesPlayerHas();
      if (!speciesEN) return null;
      const speciesName = globalThis.speciesName?.(speciesEN) ?? speciesEN;
      return {
        type: 'shiny_demand', target: speciesEN, qty: 1, shiny: true,
        emoji: '✨',
        label: `Recherche shiny : ${speciesName}`,
        detail: 'Un acheteur fortuné paie le prix fort pour un spécimen chromatique.',
        reward: { money: 1200000, rep: 200, items: { aura: 1 } },
      };
    },
  },

  // ── Lignée évolutive complète (revu : ×2 reward + items) ─────────
  family_complete: {
    weight: 18,
    generate() {
      const chains = globalThis.EVOLUTION_CHAINS || {};
      const keys = Object.keys(chains);
      if (!keys.length) return null;
      const head = keys[Math.floor(Math.random() * keys.length)];
      const family = [head, ...(chains[head]?.flatMap(c => c.to ? [c.to] : []) ?? [])];
      const headName = globalThis.speciesName?.(head) ?? head;
      const money = 160000 + family.length * 50000;
      return {
        type: 'family_complete', target: head, members: family, qty: family.length,
        emoji: '🌳',
        label: `Lignée complète : ${headName}`,
        detail: `Livrez 1 spécimen de chaque évolution (${family.length} pokémon).`,
        reward: { money, rep: 60 + family.length * 15, items: { evostone: 5 } },
      };
    },
  },

  // ── Boost de zone temporaire (revu : ×3 multiplier + 4h) ─────────
  zone_boost: {
    weight: 12,
    generate() {
      const ZONES = globalThis.ZONES || [];
      const openableZones = ZONES.filter(z => z.type === 'route' || z.type === 'special');
      if (!openableZones.length) return null;
      const z = openableZones[Math.floor(Math.random() * openableZones.length)];
      return {
        type: 'zone_boost', target: z.id, qty: 1,
        emoji: '🗺️',
        label: `Rumeurs sur ${z.fr || z.id}`,
        detail: 'Validez pour booster ×3 le taux de raretés pendant 4h dans cette zone.',
        reward: { rareBoost: { zoneId: z.id, durationMs: 4 * 3600000, multiplier: 3 }, money: 30000 },
      };
    },
  },

  // ── Blanchiment d'argent (revu : multiplicateur jusqu'à ×2.2) ────
  bulk_money: {
    weight: 10,
    generate() {
      const baseTarget = [100000, 250000, 500000, 1000000, 2000000][Math.floor(Math.random() * 5)];
      const rewardMult = 1.7 + Math.random() * 0.5; // 1.7x → 2.2x
      return {
        type: 'bulk_money', target: 'money', qty: baseTarget,
        emoji: '💰',
        label: `Dépôt en cash : ${baseTarget.toLocaleString()}₽`,
        detail: `Versez ${baseTarget.toLocaleString()}₽ — le syndicat les blanchit à un multiplicateur premium.`,
        reward: { money: Math.round(baseTarget * rewardMult), rep: Math.round(baseTarget / 3000) },
      };
    },
  },

  // ── NEW : Collection de Pokémon rares ────────────────────────────
  rare_collection: {
    weight: 8,
    generate() {
      const SPECIES_BY_EN = globalThis.SPECIES_BY_EN || {};
      const tier = Math.random() < 0.5 ? 'rare' : 'very_rare';
      const allByTier = Object.values(SPECIES_BY_EN).filter(s => s.rarity === tier).map(s => s.en);
      if (allByTier.length < 3) return null;
      // 3-5 espèces rares au choix
      const qty = 3 + Math.floor(Math.random() * 3);
      const money = tier === 'very_rare' ? 1800000 : 800000;
      return {
        type: 'rare_collection', target: tier, qty,
        emoji: '💎',
        label: `Collection ${tier === 'very_rare' ? 'extra-rare' : 'rare'} : ${qty} espèces différentes`,
        detail: `Livrez ${qty} Pokémon différents de tier "${tier}" — niveau libre.`,
        reward: { money, rep: tier === 'very_rare' ? 250 : 120, items: { ultraball: 3, evostone: 1 } },
      };
    },
  },

  // ── NEW : Spécimen parfait (5★) ──────────────────────────────────
  perfect_specimen: {
    weight: 8,
    generate() {
      const speciesEN = _pickSpeciesPlayerHas();
      if (!speciesEN) return null;
      const speciesName = globalThis.speciesName?.(speciesEN) ?? speciesEN;
      const minLevel = 50 + Math.floor(Math.random() * 30);
      return {
        type: 'perfect_specimen', target: speciesEN, qty: 1, minLevel, minPotential: 5,
        emoji: '⭐',
        label: `Spécimen parfait : ${speciesName} 5★ Lv.${minLevel}+`,
        detail: `Un sponsor cherche un ${speciesName} de potentiel maximum (5 étoiles).`,
        reward: { money: 1500000, rep: 180, items: { evostone: 5 } },
      };
    },
  },

  // ── NEW : Équipe d'élite (6 pokémon haut niveau) ────────────────
  elite_squad: {
    weight: 6,
    generate() {
      const minLevel = 70 + Math.floor(Math.random() * 25);
      return {
        type: 'elite_squad', target: 'team', qty: 6, minLevel,
        emoji: '🛡️',
        label: `Escouade d'élite : 6 Pokémon Lv.${minLevel}+`,
        detail: `Livrez 6 Pokémon libres de niveau ${minLevel}+ pour une mission black-ops.`,
        reward: { money: 2500000, rep: 350, items: { masterball: 1, evostone: 3 } },
      };
    },
  },

  // ── NEW : Smuggling d'items (échange contre money premium) ───────
  item_smuggle: {
    weight: 8,
    generate() {
      const POOLS = [
        { id: 'evostone',   qty: [2, 4],  reward: 120000 },
        { id: 'aura',       qty: [1, 2],  reward: 200000 },
        { id: 'ultraball',  qty: [5, 10], reward: 60000  },
        { id: 'masterball', qty: [1, 1],  reward: 800000 },
      ];
      const pool = POOLS[Math.floor(Math.random() * POOLS.length)];
      const qty = pool.qty[0] + Math.floor(Math.random() * (pool.qty[1] - pool.qty[0] + 1));
      const ITEM_LABELS = { evostone:'Pierre Évolution', aura:'Aura Shiny', ultraball:'Hyper Ball', masterball:'Master Ball' };
      const label = ITEM_LABELS[pool.id] || pool.id;
      return {
        type: 'item_smuggle', target: pool.id, qty,
        emoji: '📦',
        label: `Contrebande : ${qty}× ${label}`,
        detail: `Livrez ${qty}× ${label} contre du cash sale.`,
        reward: { money: pool.reward * qty, rep: 30 + qty * 5 },
      };
    },
  },

  // ── NEW : Bounty sur dresseur — défier un dresseur spécial ───────
  trainer_bounty: {
    weight: 8,
    generate() {
      // Listing passif — récompense pour avoir gagné N combats spéciaux
      const targets = [
        { count: 3,  reward: 300000,  rep: 80,  label: '3 combats Élite remportés' },
        { count: 5,  reward: 700000,  rep: 200, label: '5 combats Élite remportés' },
        { count: 10, reward: 1800000, rep: 500, label: '10 combats Élite remportés' },
      ];
      const t = targets[Math.floor(Math.random() * targets.length)];
      return {
        type: 'trainer_bounty', target: 'elite_wins', qty: t.count,
        emoji: '🔫',
        label: `Contrat : ${t.label}`,
        detail: `Gagnez ${t.count} combats contre un dresseur Élite ou Champion (tier ≥ Difficile) pour valider ce contrat.`,
        reward: { money: t.reward, rep: t.rep, items: { masterball: t.count >= 10 ? 1 : 0 } },
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

function _isFree(p, state) {
  if (!p) return false;
  if (globalThis.getPensionSlotIds?.()?.has(p.id)) return false;
  if (state.gang.bossTeam.includes(p.id)) return false;
  if (state.agents.some(a => a.team?.includes(p.id))) return false;
  if (state.trainingRoom?.pokemon?.includes(p.id)) return false;
  return true;
}

function _validateListing(listing) {
  const state = globalThis.state;
  switch (listing.type) {
    case 'species_bulk': {
      const candidates = state.pokemons.filter(p =>
        p.species_en === listing.target &&
        p.level >= (listing.minLevel || 1) &&
        _isFree(p, state)
      );
      if (candidates.length < listing.qty) {
        return { ok: false, reason: `Il faut ${listing.qty} ${globalThis.speciesName?.(listing.target)} Lv.${listing.minLevel}+ libres (tu en as ${candidates.length}).` };
      }
      return { ok: true, candidates: candidates.slice(0, listing.qty) };
    }
    case 'shiny_demand': {
      const candidate = state.pokemons.find(p => p.species_en === listing.target && p.shiny && _isFree(p, state));
      if (!candidate) return { ok: false, reason: `Aucun ${globalThis.speciesName?.(listing.target)} shiny libre dans ta collection.` };
      return { ok: true, candidates: [candidate] };
    }
    case 'family_complete': {
      const members = listing.members || [listing.target];
      const picks = [];
      const missing = [];
      for (const en of members) {
        const candidate = state.pokemons.find(p => p.species_en === en && _isFree(p, state));
        if (candidate) picks.push(candidate);
        else missing.push(en);
      }
      if (missing.length) {
        return { ok: false, reason: `Lignée incomplète : ${missing.length} espèce(s) libre(s) manquante(s).` };
      }
      return { ok: true, candidates: picks };
    }
    case 'zone_boost': return { ok: true };
    case 'bulk_money': {
      if (state.gang.money < listing.qty) {
        return { ok: false, reason: `Pas assez d'argent (${state.gang.money.toLocaleString()}₽ / ${listing.qty.toLocaleString()}₽).` };
      }
      return { ok: true };
    }
    case 'rare_collection': {
      const SPECIES_BY_EN = globalThis.SPECIES_BY_EN || {};
      const distinctOwned = new Set(
        state.pokemons
          .filter(p => _isFree(p, state) && SPECIES_BY_EN[p.species_en]?.rarity === listing.target)
          .map(p => p.species_en)
      );
      if (distinctOwned.size < listing.qty) {
        return { ok: false, reason: `Il faut ${listing.qty} espèces différentes "${listing.target}" libres (tu en as ${distinctOwned.size}).` };
      }
      // Sélectionner 1 spécimen de chaque, jusqu'à qty
      const picks = [];
      for (const en of distinctOwned) {
        if (picks.length >= listing.qty) break;
        const p = state.pokemons.find(p => p.species_en === en && _isFree(p, state));
        if (p) picks.push(p);
      }
      return { ok: true, candidates: picks };
    }
    case 'perfect_specimen': {
      const candidate = state.pokemons.find(p =>
        p.species_en === listing.target &&
        p.potential >= (listing.minPotential || 5) &&
        p.level >= (listing.minLevel || 1) &&
        _isFree(p, state)
      );
      if (!candidate) return { ok: false, reason: `Aucun ${globalThis.speciesName?.(listing.target)} ${listing.minPotential}★ Lv.${listing.minLevel}+ libre.` };
      return { ok: true, candidates: [candidate] };
    }
    case 'elite_squad': {
      const eligibles = state.pokemons.filter(p =>
        p.level >= (listing.minLevel || 1) && _isFree(p, state)
      );
      if (eligibles.length < listing.qty) {
        return { ok: false, reason: `Il faut ${listing.qty} Pokémon libres Lv.${listing.minLevel}+ (tu en as ${eligibles.length}).` };
      }
      // Trier par level desc pour livrer les plus solides (politesse joueur)
      const sorted = [...eligibles].sort((a, b) => b.level - a.level);
      return { ok: true, candidates: sorted.slice(0, listing.qty) };
    }
    case 'item_smuggle': {
      const owned = state.inventory?.[listing.target] || 0;
      if (owned < listing.qty) {
        return { ok: false, reason: `Pas assez de ${listing.target} (${owned}/${listing.qty}).` };
      }
      return { ok: true };
    }
    case 'trainer_bounty': {
      const progress = state.bountyProgress?.[listing.id] || 0;
      if (progress < listing.qty) {
        return { ok: false, reason: `Contrat en cours : ${progress}/${listing.qty} combats Élite remportés.` };
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
    case 'rare_collection':
    case 'perfect_specimen':
    case 'elite_squad':
      // Retirer les pokémon des assignations (agents, boss, vitrine, favoris...) + collection
      for (const p of valid.candidates) {
        globalThis.removePokemonFromAllAssignments?.(p.id);
        const idx = state.pokemons.findIndex(pk => pk.id === p.id);
        if (idx >= 0) state.pokemons.splice(idx, 1);
      }
      break;
    case 'bulk_money':
      state.gang.money -= listing.qty;
      break;
    case 'item_smuggle':
      state.inventory[listing.target] = (state.inventory[listing.target] || 0) - listing.qty;
      break;
    case 'zone_boost':
    case 'trainer_bounty':
      // Rien à consommer
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
  if (r.items) {
    state.inventory = state.inventory || {};
    for (const [itemId, qty] of Object.entries(r.items)) {
      if (!qty) continue;
      state.inventory[itemId] = (state.inventory[itemId] || 0) + qty;
    }
  }
  if (r.rareBoost) {
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
