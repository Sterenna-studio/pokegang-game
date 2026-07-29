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
const _t = (fr, en) => (globalThis.state?.lang === 'en' ? en : fr);

function _localizedListing(listing) {
  if (!listing) return listing;
  return {
    ...listing,
    label: globalThis.state?.lang === 'en' ? (listing.label_en || listing.label) : listing.label,
    detail: globalThis.state?.lang === 'en' ? (listing.detail_en || listing.detail) : listing.detail,
  };
}

function _localizedBulletin(bulletin) {
  if (!bulletin) return bulletin;
  return { ...bulletin, listings: (bulletin.listings || []).map(_localizedListing) };
}

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
      const ballSkin = isLegend ? 'masterball' : (Math.random() < 0.5 ? 'ultraball' : null);
      return {
        type: 'species_bulk', target: speciesEN, qty, minLevel,
        emoji: '🎯',
        label: `Livraison : ${qty}× ${speciesName} Lv.${minLevel}+`,
        detail: `${speciesName} en bonne condition pour un collectionneur fortuné.`,
        label_en: `Delivery: ${qty}× ${speciesName} Lv.${minLevel}+`,
        detail_en: `${speciesName} in good condition for a wealthy collector.`,
        reward: { money: baseReward, rep: Math.round(baseReward / 1000) * 4, ballSkin },
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
        label_en: `Shiny wanted: ${speciesName}`,
        detail_en: 'A wealthy buyer is paying top price for a shiny specimen.',
        reward: { money: 1200000, rep: 200, items: { aura: 1 } },
      };
    },
  },

  // ── Lignée évolutive complète (revu : ×2 reward + items) ─────────
  family_complete: {
    weight: 18,
    generate() {
      const evoBy = globalThis.EVO_BY_SPECIES || {};
      // Ne garder que les formes de base (jamais une cible d'évolution) pour
      // proposer une vraie lignée complète plutôt qu'une lignée tronquée
      // en cours de chaîne.
      const allTargets = new Set(Object.values(evoBy).flatMap(list => list.map(e => e.to)));
      const bases = Object.keys(evoBy).filter(sp => !allTargets.has(sp));
      if (!bases.length) return null;
      const head = bases[Math.floor(Math.random() * bases.length)];
      // Parcourt la chaîne complète (peut ramifier, ex: nidoran-f/nidoran-m).
      const family = [head];
      const queue = [head];
      while (queue.length) {
        const cur = queue.shift();
        for (const e of (evoBy[cur] || [])) {
          if (e.to && !family.includes(e.to)) { family.push(e.to); queue.push(e.to); }
        }
      }
      if (family.length < 2) return null; // pas d'évolution disponible pour cette espèce
      const headName = globalThis.speciesName?.(head) ?? head;
      const money = 160000 + family.length * 50000;
      return {
        type: 'family_complete', target: head, members: family, qty: family.length,
        emoji: '🌳',
        label: `Lignée complète : ${headName}`,
        detail: `Livrez 1 spécimen de chaque évolution (${family.length} pokémon).`,
        label_en: `Complete family: ${headName}`,
        detail_en: `Deliver 1 specimen from each evolution (${family.length} Pokémon).`,
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
        // Pas de mécanisme de rareté "par zone" dans le jeu — active le même
        // boost global rarescope que les récompenses d'événement de zone.
        detail: 'Validez pour booster ×3 le taux de raretés pendant 4h (toutes zones).',
        label_en: `Rumors about ${z.en || z.id}`,
        detail_en: 'Complete to boost rare rates ×3 for 4h in all zones.',
        reward: { rareBoost: 4 * 3600000, money: 30000 },
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
        label_en: `Cash deposit: ${baseTarget.toLocaleString()}₽`,
        detail_en: `Pay ${baseTarget.toLocaleString()}₽ — the syndicate launders it at a premium multiplier.`,
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
        label_en: `${tier === 'very_rare' ? 'Very rare' : 'Rare'} collection: ${qty} different species`,
        detail_en: `Deliver ${qty} different "${tier}" Pokémon — any level.`,
        reward: { money, rep: tier === 'very_rare' ? 250 : 120, items: { evostone: 1 }, ballSkin: 'ultraball' },
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
        label_en: `Perfect specimen: ${speciesName} 5★ Lv.${minLevel}+`,
        detail_en: `A sponsor wants a ${speciesName} with maximum potential (5 stars).`,
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
        label_en: `Elite squad: 6 Pokémon Lv.${minLevel}+`,
        detail_en: `Deliver 6 unassigned Pokémon at level ${minLevel}+ for a black-ops mission.`,
        reward: { money: 2500000, rep: 350, items: { evostone: 3 }, ballSkin: 'masterball' },
      };
    },
  },

  // ── NEW : Smuggling d'items (échange contre money premium) ───────
  item_smuggle: {
    weight: 8,
    generate() {
      // Uniquement des consommables réellement stockables (ultraball/masterball
      // ne sont plus des items d'inventaire — juste des skins cosmétiques
      // débloqués une fois via state.purchases, aucune quantité à livrer).
      const POOLS = [
        { id: 'evostone',   qty: [2, 4],  reward: 120000 },
        { id: 'aura',       qty: [1, 2],  reward: 200000 },
      ];
      const pool = POOLS[Math.floor(Math.random() * POOLS.length)];
      const qty = pool.qty[0] + Math.floor(Math.random() * (pool.qty[1] - pool.qty[0] + 1));
      const ITEM_LABELS = {
        evostone:{ fr:'Pierre Évolution', en:'Evolution Stone' },
        aura:{ fr:'Aura Shiny', en:'Shiny Aura' },
      };
      const itemLabel = ITEM_LABELS[pool.id] || { fr:pool.id, en:pool.id };
      return {
        type: 'item_smuggle', target: pool.id, qty,
        emoji: '📦',
        label: `Contrebande : ${qty}× ${itemLabel.fr}`,
        detail: `Livrez ${qty}× ${itemLabel.fr} contre du cash sale.`,
        label_en: `Smuggling: ${qty}× ${itemLabel.en}`,
        detail_en: `Deliver ${qty}× ${itemLabel.en} for dirty cash.`,
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
        { count: 3,  reward: 300000,  rep: 80,  label: '3 combats Élite remportés', label_en:'3 Elite battles won' },
        { count: 5,  reward: 700000,  rep: 200, label: '5 combats Élite remportés', label_en:'5 Elite battles won' },
        { count: 10, reward: 1800000, rep: 500, label: '10 combats Élite remportés', label_en:'10 Elite battles won' },
      ];
      const t = targets[Math.floor(Math.random() * targets.length)];
      return {
        type: 'trainer_bounty', target: 'elite_wins', qty: t.count,
        emoji: '🔫',
        label: `Contrat : ${t.label}`,
        detail: `Gagnez ${t.count} combats contre un dresseur Élite ou Champion (tier ≥ Difficile) pour valider ce contrat.`,
        label_en: `Contract: ${t.label_en}`,
        detail_en: `Win ${t.count} battles against an Elite or Champion trainer (Hard tier or above) to complete this contract.`,
        reward: { money: t.reward, rep: t.rep, ballSkin: t.count >= 10 ? 'masterball' : null },
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
  _notify(_t('🌑 Nouveau bulletin du marché noir disponible', '🌑 New black market bulletin available'), 'gold');
  return _localizedBulletin(state.blackMarketBulletin);
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
  const needsEnglishRefresh = state.lang === 'en'
    && state.blackMarketBulletin?.listings?.some(listing => !listing.label_en || !listing.detail_en);
  if (!state.blackMarketBulletin || Date.now() >= state.blackMarketBulletin.expiresAt || needsEnglishRefresh) {
    return rotateBlackMarketBulletin();
  }
  return _localizedBulletin(state.blackMarketBulletin);
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
  const displayListing = _localizedListing(listing);
  _notify(_t(
    `🌑 Marché noir : "${displayListing.label}" complété !`,
    `🌑 Black market: "${displayListing.label}" completed!`,
  ), 'gold');
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
        return { ok: false, reason: _t(
          `Il faut ${listing.qty} ${globalThis.speciesName?.(listing.target)} Lv.${listing.minLevel}+ libres (tu en as ${candidates.length}).`,
          `You need ${listing.qty} unassigned ${globalThis.speciesName?.(listing.target)} at Lv.${listing.minLevel}+ (you have ${candidates.length}).`,
        ) };
      }
      return { ok: true, candidates: candidates.slice(0, listing.qty) };
    }
    case 'shiny_demand': {
      const candidate = state.pokemons.find(p => p.species_en === listing.target && p.shiny && _isFree(p, state));
      if (!candidate) return { ok: false, reason: _t(
        `Aucun ${globalThis.speciesName?.(listing.target)} shiny libre dans ta collection.`,
        `No unassigned shiny ${globalThis.speciesName?.(listing.target)} in your collection.`,
      ) };
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
        return { ok: false, reason: _t(
          `Lignée incomplète : ${missing.length} espèce(s) libre(s) manquante(s).`,
          `Incomplete family: ${missing.length} unassigned species missing.`,
        ) };
      }
      return { ok: true, candidates: picks };
    }
    case 'zone_boost': return { ok: true };
    case 'bulk_money': {
      if (state.gang.money < listing.qty) {
        return { ok: false, reason: _t(
          `Pas assez d'argent (${state.gang.money.toLocaleString()}₽ / ${listing.qty.toLocaleString()}₽).`,
          `Not enough money (${state.gang.money.toLocaleString()}₽ / ${listing.qty.toLocaleString()}₽).`,
        ) };
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
        return { ok: false, reason: _t(
          `Il faut ${listing.qty} espèces différentes "${listing.target}" libres (tu en as ${distinctOwned.size}).`,
          `You need ${listing.qty} different unassigned "${listing.target}" species (you have ${distinctOwned.size}).`,
        ) };
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
      if (!candidate) return { ok: false, reason: _t(
        `Aucun ${globalThis.speciesName?.(listing.target)} ${listing.minPotential}★ Lv.${listing.minLevel}+ libre.`,
        `No unassigned ${globalThis.speciesName?.(listing.target)} ${listing.minPotential}★ at Lv.${listing.minLevel}+.`,
      ) };
      return { ok: true, candidates: [candidate] };
    }
    case 'elite_squad': {
      const eligibles = state.pokemons.filter(p =>
        p.level >= (listing.minLevel || 1) && _isFree(p, state)
      );
      if (eligibles.length < listing.qty) {
        return { ok: false, reason: _t(
          `Il faut ${listing.qty} Pokémon libres Lv.${listing.minLevel}+ (tu en as ${eligibles.length}).`,
          `You need ${listing.qty} unassigned Pokémon at Lv.${listing.minLevel}+ (you have ${eligibles.length}).`,
        ) };
      }
      // Trier par level desc pour livrer les plus solides (politesse joueur)
      const sorted = [...eligibles].sort((a, b) => b.level - a.level);
      return { ok: true, candidates: sorted.slice(0, listing.qty) };
    }
    case 'item_smuggle': {
      const owned = state.inventory?.[listing.target] || 0;
      if (owned < listing.qty) {
        return { ok: false, reason: _t(
          `Pas assez de ${listing.target} (${owned}/${listing.qty}).`,
          `Not enough ${listing.target} (${owned}/${listing.qty}).`,
        ) };
      }
      return { ok: true };
    }
    case 'trainer_bounty': {
      const progress = state.bountyProgress?.[listing.id] || 0;
      if (progress < listing.qty) {
        return { ok: false, reason: _t(
          `Contrat en cours : ${progress}/${listing.qty} combats Élite remportés.`,
          `Contract in progress: ${progress}/${listing.qty} Elite battles won.`,
        ) };
      }
      return { ok: true };
    }
  }
  return { ok: false, reason: _t('Type de demande inconnu.', 'Unknown request type.') };
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
      state.gang.money = Math.max(0, state.gang.money - listing.qty);
      EventBus.emit(EVENTS.MONEY_CHANGED, { delta: -listing.qty, newTotal: state.gang.money });
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
    const prevRep = state.gang.reputation;
    state.gang.reputation += r.rep;
    EventBus.emit(EVENTS.REP_CHANGED, { delta: r.rep, newTotal: state.gang.reputation });
    globalThis.checkForNewlyUnlockedZones?.(prevRep);
  }
  if (r.items) {
    state.inventory = state.inventory || {};
    for (const [itemId, qty] of Object.entries(r.items)) {
      if (!qty) continue;
      state.inventory[itemId] = (state.inventory[itemId] || 0) + qty;
    }
  }
  if (r.rareBoost) {
    // Même convention que les rewards d'événement de zone (zoneSystem.js) :
    // rareBoost est une durée en ms qui active le boost global rarescope —
    // il n'existe pas de mécanisme de rareté "par zone" dans le jeu.
    state.activeBoosts = state.activeBoosts || {};
    state.activeBoosts.rarescope = Math.max(state.activeBoosts.rarescope || 0, Date.now() + r.rareBoost);
  }
  if (r.ballSkin) {
    // Skin de ball cosmétique — pas une ressource d'inventaire (voir buyItem()
    // dans market.js). Si déjà possédé, rembourse au prix boutique plutôt que
    // de perdre la récompense.
    state.purchases = state.purchases || {};
    const skinKey = `skin_${r.ballSkin}`;
    if (state.purchases[skinKey]) {
      const price = (globalThis.SHOP_ITEMS || []).find(i => i.ballSkin === r.ballSkin)?.cost || 0;
      if (price > 0) {
        state.gang.money += price;
        state.stats.totalMoneyEarned += price;
        EventBus.emit(EVENTS.MONEY_CHANGED, { delta: price, newTotal: state.gang.money });
      }
    } else {
      state.purchases[skinKey] = true;
    }
  }
}

Object.assign(globalThis, {
  getCurrentBulletin,
  rotateBlackMarketBulletin,
  completeBlackMarketListing,
});
