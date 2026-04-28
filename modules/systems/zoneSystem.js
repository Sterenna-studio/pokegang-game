// ════════════════════════════════════════════════════════════════
//  ZONE SYSTEM MODULE
//  Extracted from app.js — pure logic, no DOM access
// ════════════════════════════════════════════════════════════════
//
//  Globals read from app.js via globalThis:
//    state, pick, randInt, uid, clamp, weightedPick
//    calculateStats, makePokemon, speciesName, notify, saveState
//    isBoostActive, isBallAssistActive, grantAgentXP, levelUpPokemon
//    tryAutoIncubate, updateTopBar, openCombatPopup
//    addBattleLogEntry, pushFeedEvent, addLog
//    resolveBackgroundSpawnForZone, backgroundZoneTimers, openZones
//    checkForNewlyUnlockedZones, openZoneWindow, closeZoneWindow, renderZoneWindows
//    ZONE_SLOT_COSTS, BOOST_DURATIONS
//    MAX_COMBAT_REWARD, SPECIAL_TRAINER_KEYS
//    SFX
//
//  Classic-script globals accessed by bare name:
//    ZONE_BY_ID, ZONES, SPECIES_BY_EN, SPECIAL_EVENTS, CHEST_LOOT
//  ES module imports:
//    TRAINER_TYPES (from data/trainers-data.js)
//  ES module globals (exposed on globalThis by app.js):
//    GYM_ORDER
// ════════════════════════════════════════════════════════════════

import { TRAINER_TYPES } from '../../data/trainers-data.js';

// État exclusif par zone : une seule activité à la fois
// zoneActivity[zoneId] = { mode: 'idle' | 'event', eventId?, expiresAt? }
const zoneActivity = {};
globalThis.zoneActivity = zoneActivity;

function getZoneActivityMode(zoneId) {
  const a = zoneActivity[zoneId];
  if (!a) return 'idle';
  if (a.mode === 'event' && a.expiresAt && Date.now() > a.expiresAt) {
    // Event expiré → retour idle
    delete zoneActivity[zoneId];
    return 'idle';
  }
  return a.mode || 'idle';
}

function setZoneActivity(zoneId, mode, opts = {}) {
  zoneActivity[zoneId] = { mode, ...opts };
}

function clearZoneActivity(zoneId) {
  delete zoneActivity[zoneId];
}

function getZoneSlotCost(zoneId, slotIndex) {
  const base = globalThis.ZONE_SLOT_COSTS[slotIndex] ?? 9999;
  const zone = ZONE_BY_ID[zoneId];
  // tier based on zone unlock reputation: higher zone = more expensive slots
  const rep = zone?.rep || 0;
  const tier = rep < 50 ? 1 : rep < 150 ? 1.5 : rep < 300 ? 2 : rep < 600 ? 3 : rep < 1000 ? 4 : 5;
  return Math.round(base * tier);
}

function initZone(zoneId) {
  const state = globalThis.state;
  if (!state.zones[zoneId]) {
    state.zones[zoneId] = {
      unlocked: false,
      combatsWon: 0,
      captures: 0,
      assignedAgents: [],
      pendingIncome: 0,
      pendingItems: {},
      slots: 1,
    };
  }
  // Migration
  if (state.zones[zoneId].captures === undefined) state.zones[zoneId].captures = 0;
  if (state.zones[zoneId].pendingIncome === undefined) state.zones[zoneId].pendingIncome = 0;
  if (state.zones[zoneId].pendingItems === undefined) state.zones[zoneId].pendingItems = {};
  if (state.zones[zoneId].slots === undefined) state.zones[zoneId].slots = 1;
  // Remove legacy invest fields
  delete state.zones[zoneId].invested;
  delete state.zones[zoneId].investPower;
  return state.zones[zoneId];
}

function isZoneUnlocked(zoneId) {
  const state = globalThis.state;
  const zone = ZONE_BY_ID[zoneId];
  if (!zone) return false;
  // Check if zone was previously accessed (degraded mode: rep dropped, but still accessible)
  const zoneState = state.zones[zoneId];
  const wasPreviouslyAccessed = zoneState && (zoneState.combatsWon > 0 || zoneState.invested > 0 || zoneState.captures > 0);
  if (wasPreviouslyAccessed) {
    // Zone stays open (degraded if rep dropped), but still check unlock item
    if (zone.unlockItem && !state.purchases?.[zone.unlockItem]) return false;
    return true;
  }
  // Never visited: requires full conditions
  if (state.gang.reputation < zone.rep) return false;
  if (zone.unlockItem && !state.purchases?.[zone.unlockItem]) return false;
  // Cities (gyms) require sequential unlock: previous city must be defeated
  if (zone.type === 'city') {
    const idx = globalThis.GYM_ORDER.indexOf(zoneId);
    if (idx > 0) {
      const prevId = globalThis.GYM_ORDER[idx - 1];
      if (!state.zones[prevId]?.gymDefeated) return false;
    }
  }
  return true;
}

// Is a zone in "degraded" mode? (rep below threshold → combat only, no pokemon spawns)
function isZoneDegraded(zoneId) {
  const state = globalThis.state;
  const zone = ZONE_BY_ID[zoneId];
  if (!zone || zone.rep === 0) return false;
  return state.gang.reputation < zone.rep;
}

function getZoneMastery(zoneId) {
  const state = globalThis.state;
  const z = state.zones[zoneId];
  if (!z) return 0;
  if (z.combatsWon >= 50) return 3;
  if (z.combatsWon >= 10) return 2;
  return 1;
}

function getZoneAgentSlots(zoneId) {
  const m = getZoneMastery(zoneId);
  if (m >= 3) return 2;
  if (m >= 2) return 1;
  return 0;
}

// ── Scaling de difficulté par niveau de mastery ───────────────
// Plus une zone a de combats gagnés (→ mastery élevée), plus les ennemis sont forts.
// Ces constantes sont paramétrables librement.
const ZONE_DIFFICULTY_SCALING = {
  //  mastery: { levelBonus, statMult, raidChanceBonus, tripleRaidChance, potentialBoost }
  1: { levelBonus: 0,  statMult: 1.00, raidChanceBonus: 0.00, tripleRaidChance: 0.00, potentialBoost: 0 },
  2: { levelBonus: 4,  statMult: 1.15, raidChanceBonus: 0.06, tripleRaidChance: 0.00, potentialBoost: 0 },
  3: { levelBonus: 10, statMult: 1.35, raidChanceBonus: 0.15, tripleRaidChance: 0.12, potentialBoost: 1 },
};

// masteryLevel (1-3) permet de renforcer les équipes ennemies selon la progression de zone.
function makeTrainerTeam(zone, trainerKey, forcedSize, masteryLevel = 1) {
  const trainer = TRAINER_TYPES[trainerKey];
  if (!trainer) return [];
  const clamp = globalThis.clamp;
  const teamSize = forcedSize ?? clamp(trainer.diff, 1, 3);
  const scaling = ZONE_DIFFICULTY_SCALING[masteryLevel] || ZONE_DIFFICULTY_SCALING[1];
  const team = [];
  for (let i = 0; i < teamSize; i++) {
    const sp = globalThis.pick(zone.pool);
    const baseLevel = globalThis.randInt(5 + trainer.diff * 3, 10 + trainer.diff * 5);
    const level = Math.min(100, baseLevel + scaling.levelBonus);
    const potential = Math.min(5, 2 + scaling.potentialBoost);
    const stats = globalThis.calculateStats({ species_en: sp, level, nature: 'hardy', potential });
    // Multiplier les stats offensives/défensives selon le scaling
    if (scaling.statMult !== 1.0) {
      stats.atk = Math.round(stats.atk * scaling.statMult);
      stats.def = Math.round(stats.def * scaling.statMult);
      stats.spd = Math.round(stats.spd * scaling.statMult);
    }
    team.push({ species_en: sp, level, stats });
  }
  return team;
}

// Build a raid: 2-3 trainers combined into one encounter
function makeRaidSpawn(zone, zoneId, masteryLevel = 1) {
  const trainerKeys = zone.trainers.length >= 2
    ? [globalThis.pick(zone.trainers), globalThis.pick(zone.trainers), zone.eliteTrainer || globalThis.pick(zone.trainers)]
    : [zone.eliteTrainer || 'acetrainer', zone.eliteTrainer || 'acetrainer', zone.eliteTrainer || 'acetrainer'];

  const scaling = ZONE_DIFFICULTY_SCALING[masteryLevel] || ZONE_DIFFICULTY_SCALING[1];
  // Mastery 3 : chance de raid à 3 dresseurs (triple raid)
  const forceTriple = masteryLevel >= 3 && Math.random() < scaling.tripleRaidChance;
  // Pick 2-3 distinct trainers
  const numTrainers = forceTriple ? 3 : globalThis.randInt(2, 3);
  const raidTrainers = [];
  const usedKeys = [];
  for (let i = 0; i < numTrainers; i++) {
    let key = globalThis.pick(trainerKeys);
    if (!TRAINER_TYPES[key]) key = zone.eliteTrainer || 'acetrainer';
    raidTrainers.push({
      key,
      trainer: TRAINER_TYPES[key],
      team: makeTrainerTeam(zone, key, 2, masteryLevel),
    });
    usedKeys.push(key);
  }

  // Combined enemy team (all trainers' Pokémon)
  const combinedTeam = raidTrainers.flatMap(rt => rt.team);

  // Combined reward + rep (sum of all trainers, x1.5)
  const totalReward = raidTrainers.reduce((s, rt) => {
    return [s[0] + rt.trainer.reward[0], s[1] + rt.trainer.reward[1]];
  }, [0, 0]).map(v => Math.round(v * 1.5));
  const totalRep = Math.round(raidTrainers.reduce((s, rt) => s + rt.trainer.rep, 0) * 1.5);
  const maxDiff = Math.max(...raidTrainers.map(rt => rt.trainer.diff));

  return {
    type: 'raid',
    raidTrainers,
    trainerKey: raidTrainers[0].key,
    trainer: {
      ...raidTrainers[0].trainer,
      fr: `[RAID] (${numTrainers} dresseurs)`,
      en: `[RAID] (${numTrainers} trainers)`,
      sprite: raidTrainers[0].key,
      diff: maxDiff + 1,
      reward: totalReward,
      rep: totalRep,
    },
    team: combinedTeam,
    isRaid: true,
  };
}

function spawnInZone(zoneId) {
  const state = globalThis.state;
  const zone = ZONE_BY_ID[zoneId];
  if (!zone) return null;
  const zState = initZone(zoneId);
  const isDegraded = isZoneDegraded(zoneId);
  const isChestBoosted = globalThis.isBoostActive('chestBoost');
  const r = Math.random();

  // Niveau de mastery pour le scaling de difficulté
  const mastery = getZoneMastery(zoneId);
  const diffScaling = ZONE_DIFFICULTY_SCALING[mastery] || ZONE_DIFFICULTY_SCALING[1];

  // DEGRADED MODE: rep dropped below zone threshold — combat only (no pokemon, no chests, no events)
  if (isDegraded) {
    if (zone.trainers.length > 0) {
      const trainerKey = globalThis.pick(zone.trainers);
      const trainer = TRAINER_TYPES[trainerKey];
      if (trainer) return { type: 'trainer', trainerKey, trainer, team: makeTrainerTeam(zone, trainerKey, undefined, mastery) };
    }
    return null;
  }

  // 1. Treasure chest (5% base, 25% during chest event)
  const chestChance = isChestBoosted ? 0.25 : 0.05;
  if (r < chestChance) {
    return { type: 'chest' };
  }

  // Si un event est actif → spawn limité (pokemon/trainer simple seulement, pas d'elite ni raid)
  const eventLocked = getZoneActivityMode(zoneId) === 'event';

  // 2. Special event — exclusif : ne peut spawner que si la zone est idle
  const canEvent = mastery >= 1;
  if (canEvent && r < chestChance + 0.08 && getZoneActivityMode(zoneId) === 'idle') {
    const eligible = SPECIAL_EVENTS.filter(ev =>
      state.gang.reputation >= ev.minRep &&
      (!ev.zoneIds || ev.zoneIds.includes(zoneId)) // zone-specific filter
    );
    if (eligible.length > 0) {
      const event = globalThis.pick(eligible);
      // Marquer la zone comme en événement AVANT de retourner
      setZoneActivity(zoneId, 'event', { eventId: event.id, expiresAt: Date.now() + 60000 });
      return { type: 'event', event };
    }
  }

  // 3. Elite trainer (mastery >= 2, i.e. 10+ wins in zone)
  if (!eventLocked && mastery >= 2 && zone.eliteTrainer && r < chestChance + 0.13) {
    const trainerKey = zone.eliteTrainer;
    const trainer = TRAINER_TYPES[trainerKey];
    if (trainer) {
      // Elite: boosted difficulty (diff+2), bigger team, meilleures récompenses
      // Le scaling mastery s'applique en plus du boost élite de base
      const eliteDiff = trainer.diff + 2;
      const clamp = globalThis.clamp;
      const teamSize = clamp(eliteDiff, 2, 4);
      const team = [];
      for (let i = 0; i < teamSize; i++) {
        const sp = globalThis.pick(zone.pool);
        const baseLevel = globalThis.randInt(10 + eliteDiff * 4, 20 + eliteDiff * 6);
        const level = Math.min(100, baseLevel + diffScaling.levelBonus);
        const potential = Math.min(5, 3 + diffScaling.potentialBoost);
        const stats = globalThis.calculateStats({ species_en: sp, level, nature: 'hardy', potential });
        if (diffScaling.statMult !== 1.0) {
          stats.atk = Math.round(stats.atk * diffScaling.statMult);
          stats.def = Math.round(stats.def * diffScaling.statMult);
          stats.spd = Math.round(stats.spd * diffScaling.statMult);
        }
        team.push({ species_en: sp, level, stats });
      }
      const eliteTrainer = {
        ...trainer,
        fr: '⭐ ' + trainer.fr,
        en: '⭐ ' + trainer.en,
        diff: eliteDiff,
        reward: [trainer.reward[0] * 3, trainer.reward[1] * 3],
        rep: trainer.rep * 2,
      };
      return { type: 'trainer', trainerKey, trainer: eliteTrainer, team, elite: true };
    }
  }

  // 4. Raid — 2+ agents (ou boss+agent) dans la zone + bonus de chance selon mastery
  const zoneAgentCount = state.agents.filter(a => a.assignedZone === zoneId).length;
  const bossHere = state.gang.bossZone === zoneId;
  const canRaid = (zoneAgentCount >= 2 || (zoneAgentCount >= 1 && bossHere)) && zone.trainers.length > 0;
  // Mastery augmente la probabilité de raid : base 10%, +6% mastery 2, +15% mastery 3
  const raidThreshold = 0.30 + 0.10 + diffScaling.raidChanceBonus;
  if (!eventLocked && canRaid && r < raidThreshold) {
    return makeRaidSpawn(zone, zoneId, mastery);
  }

  // 5. Normal trainer (20% base — mastery augmente légèrement la pression via les raids, pas ici)
  if (r < 0.30 && zone.trainers.length > 0) {
    const trainerKey = globalThis.pick(zone.trainers);
    const trainer = TRAINER_TYPES[trainerKey];
    const team = makeTrainerTeam(zone, trainerKey, undefined, mastery);
    return { type: 'trainer', trainerKey, trainer, team };
  }

  // 5. City zones — extra trainer chance (no fallback to combat-only, pokemon can also spawn)
  if (zone.type === 'city' && r < 0.55 && zone.trainers.length > 0) {
    const trainerKey = globalThis.pick(zone.trainers);
    const trainer = TRAINER_TYPES[trainerKey];
    if (trainer) return { type: 'trainer', trainerKey, trainer, team: makeTrainerTeam(zone, trainerKey, undefined, mastery) };
  }

  // 6. Pokemon spawn — Rare Scope triples chance of rare+ species
  let speciesEN;
  // Safari rarePool: 10% chance to pick from rare uncapturable pool (boosted by rarescope)
  const rarePoolChance = zone.rarePool ? (globalThis.isBoostActive('rarescope') ? 0.30 : 0.10) : 0;
  if (zone.rarePool && Math.random() < rarePoolChance) {
    speciesEN = globalThis.weightedPick(zone.rarePool);
  } else if (globalThis.isBoostActive('rarescope') && Math.random() < 0.5) {
    const filteredRare = zone.pool.filter(en => {
      const sp = SPECIES_BY_EN[en];
      return sp && (sp.rarity === 'rare' || sp.rarity === 'very_rare');
      // légendaires exclus du boost rarescope
    });
    speciesEN = filteredRare.length > 0 ? globalThis.pick(filteredRare) : globalThis.pick(zone.pool);
  } else {
    // Légendaires : taux fixe ~1% par légendaire (poids relatif aux non-légendaires)
    const _legCount    = zone.pool.filter(en => SPECIES_BY_EN[en]?.rarity === 'legendary').length;
    const _nonLegCount = zone.pool.length - _legCount;
    // legendaryW donne P(légendaire) ≈ 1% : poids = nonLeg / 99 vs non-leg poids = 1
    const _legendaryW  = _nonLegCount > 0 ? _nonLegCount / 99 : 1;
    const poolWithWeights = zone.pool.map(en => ({
      en,
      w: SPECIES_BY_EN[en]?.rarity === 'legendary' ? _legendaryW : 1,
    }));
    const totalW = poolWithWeights.reduce((s, x) => s + x.w, 0);
    let roll = Math.random() * totalW;
    speciesEN = poolWithWeights[poolWithWeights.length - 1].en;
    for (const x of poolWithWeights) {
      roll -= x.w;
      if (roll <= 0) { speciesEN = x.en; break; }
    }
  }
  return { type: 'pokemon', species_en: speciesEN };
}

// ── Chest loot resolution ─────────────────────────────────────
function rollChestLoot(zoneId, passive = false) {
  const state = globalThis.state;
  const totalWeight = CHEST_LOOT.reduce((s, l) => s + l.weight, 0);
  let roll = Math.random() * totalWeight;
  let loot = CHEST_LOOT[0];
  for (const l of CHEST_LOOT) {
    roll -= l.weight;
    if (roll <= 0) { loot = l; break; }
  }
  const zone = ZONE_BY_ID[zoneId];
  const name = state.lang === 'fr' ? loot.fr : loot.en;

  switch (loot.type) {
    case 'balls': {
      let qty = globalThis.randInt(loot.qty[0], loot.qty[1]);
      if (globalThis.isBallAssistActive()) qty *= 2; // early-game assist silencieux
      if (passive) {
        const zs = initZone(zoneId);
        zs.pendingItems = zs.pendingItems || {};
        zs.pendingItems[loot.ballType] = (zs.pendingItems[loot.ballType] || 0) + qty;
      } else {
        state.inventory[loot.ballType] = (state.inventory[loot.ballType] || 0) + qty;
      }
      return { msg: `📦 ${qty}x ${name}`, type: 'success' };
    }
    case 'money': {
      const amount = globalThis.randInt(loot.qty[0], loot.qty[1]);
      if (passive) {
        const zs = initZone(zoneId);
        zs.pendingIncome = (zs.pendingIncome || 0) + amount;
      } else {
        state.gang.money += amount;
      }
      state.stats.totalMoneyEarned += amount;
      return { msg: `📦 ${amount}₽`, type: 'gold' };
    }
    case 'rare_pokemon': {
      if (zone) {
        const rarePool = zone.pool.filter(en => {
          const sp = SPECIES_BY_EN[en];
          return sp && sp.rarity !== 'common';
        });
        const speciesEN = rarePool.length > 0 ? globalThis.pick(rarePool) : globalThis.pick(zone.pool);
        const pokemon = globalThis.makePokemon(speciesEN, zoneId, 'ultraball');
        if (pokemon) {
          pokemon.potential = Math.max(pokemon.potential, 3); // guaranteed 3+ stars
          pokemon.stats = globalThis.calculateStats(pokemon);
          state.pokemons.push(pokemon);
          state.stats.totalCaught++;
          const pName = globalThis.speciesName(pokemon.species_en);
          const stars = '★'.repeat(pokemon.potential);
          if (!state.pokedex[pokemon.species_en]) {
            state.pokedex[pokemon.species_en] = { seen: true, caught: true, shiny: pokemon.shiny, count: 1 };
          } else {
            state.pokedex[pokemon.species_en].caught = true;
            state.pokedex[pokemon.species_en].count++;
          }
          return { msg: `📦 ${pName} ${stars}${pokemon.shiny ? ' ✨' : ''}!`, type: 'gold' };
        }
      }
      // Fallback
      state.gang.money += 1000;
      return { msg: `📦 1000₽`, type: 'gold' };
    }
    case 'item': {
      state.inventory[loot.itemId] = (state.inventory[loot.itemId] || 0) + loot.qty;
      return { msg: `📦 ${loot.qty}x ${name}`, type: 'gold' };
    }
    case 'masterball': {
      state.inventory.masterball = (state.inventory.masterball || 0) + 1;
      return { msg: `📦 MASTER BALL !!`, type: 'gold' };
    }
    case 'event': {
      // Trigger a random event
      const eligible = SPECIAL_EVENTS.filter(ev => state.gang.reputation >= ev.minRep);
      if (eligible.length > 0 && zone) {
        const event = globalThis.pick(eligible);
        activateEvent(zoneId, event);
        return { msg: `📦 ${state.lang === 'fr' ? event.fr : event.en}`, type: 'gold' };
      }
      state.gang.money += 2000;
      return { msg: `📦 2000₽`, type: 'gold' };
    }
    default:
      state.gang.money += 500;
      return { msg: `📦 500₽`, type: 'success' };
  }
}

// ── Event activation/resolution ───────────────────────────────
function activateEvent(zoneId, event) {
  const state = globalThis.state;
  const reward = event.reward;
  state.stats.eventsCompleted++;

  if (reward.rareBoost) {
    state.activeBoosts.rarescope = Math.max(state.activeBoosts.rarescope || 0, Date.now() + reward.rareBoost);
    globalThis.notify(`${event.icon} ${state.lang === 'fr' ? event.fr : event.en}`, 'gold');
  }
  if (reward.money) {
    const amount = globalThis.randInt(reward.money[0], reward.money[1]);
    state.gang.money += amount;
    state.stats.totalMoneyEarned += amount;
    if (reward.rep) state.gang.reputation += reward.rep;
    globalThis.notify(`${event.icon} ${state.lang === 'fr' ? event.fr : event.en} +${amount}₽`, 'gold');
  }
  if (reward.xpBonus) {
    // Grant XP to all pokemon in zone agents
    for (const agent of state.agents) {
      if (agent.assignedZone === zoneId) {
        globalThis.grantAgentXP(agent, reward.xpBonus);
        for (const pkId of agent.team) {
          const p = state.pokemons.find(pk => pk.id === pkId);
          if (p) globalThis.levelUpPokemon(p, reward.xpBonus);
        }
      }
    }
  }

  if (reward.pokemonGift) {
    const sp = SPECIES_BY_EN[reward.pokemonGift];
    if (sp) {
      const p = globalThis.makePokemon(reward.pokemonGift, zoneId, 'pokeball');
      if (p) {
        p.level = Math.max(p.level, 20);
        p.stats = globalThis.calculateStats(p);
        state.pokemons.push(p);
        globalThis.notify(`${event.icon} ${globalThis.speciesName(reward.pokemonGift)} rejoint le gang !`, 'gold');
      }
    }
  }
  if (reward.eggGift) {
    const species_en = globalThis.pick(reward.eggGift);
    const sp = SPECIES_BY_EN[species_en];
    if (sp) {
      const potential = Math.random() < 0.2 ? 3 : 2;
      const shiny = Math.random() < 0.01;
      state.eggs.push({ id: globalThis.uid(), species_en, hatchAt: null, incubating: false, potential, shiny, gifted: true });
      globalThis.tryAutoIncubate();
      globalThis.notify(`${event.icon} 🥚 Un œuf mystérieux est apparu… On se demande ce qu'il contient !`, 'gold');
    }
  }

  // Track active event on zone
  setZoneActivity(zoneId, 'event', { eventId: event.id, expiresAt: Date.now() + 60000 });
  // Garder aussi state.activeEvents pour compatibilité UI
  state.activeEvents[zoneId] = { eventId: event.id, expiresAt: Date.now() + 60000 };
  globalThis.saveState();
}

// ── Zone Investment ───────────────────────────────────────────
function investInZone(zoneId) {
  const state = globalThis.state;
  const zone = ZONE_BY_ID[zoneId];
  if (!zone) return false;
  const zState = initZone(zoneId);
  if (zState.invested) return false;
  const cost = zone.investCost || 0;
  if (state.gang.money < cost) {
    globalThis.notify(state.lang === 'fr' ? 'Pas assez d\'argent !' : 'Not enough money!');
    globalThis.SFX.play('error');
    return false;
  }
  // Need minimum team power in zone
  const minPower = zone.rep * 10;
  let zonePower = 0;
  for (const agent of state.agents) {
    if (agent.assignedZone === zoneId) {
      zonePower += globalThis.getAgentCombatPower(agent);
    }
  }
  if (zonePower < minPower && minPower > 0) {
    globalThis.notify(state.lang === 'fr'
      ? `Puissance insuffisante ! (${zonePower}/${minPower}) Assignez des agents avec des Pokémon.`
      : `Not enough power! (${zonePower}/${minPower}) Assign agents with Pokémon.`);
    globalThis.SFX.play('error');
    return false;
  }
  state.gang.money -= cost;
  state.stats.totalMoneySpent += cost;
  zState.invested = true;
  zState.investPower = zonePower;
  globalThis.notify(state.lang === 'fr'
    ? `🏴 Zone investie ! Événements & élites débloqués.`
    : `🏴 Zone invested! Events & elites unlocked.`, 'gold');
  globalThis.saveState();
  return true;
}

function tryCapture(zoneId, speciesEN, bonusPotential = 0) {
  const state = globalThis.state;
  const ball = state.activeBall;
  const BALLS = globalThis.BALLS;
  if ((state.inventory[ball] || 0) <= 0) {
    globalThis.notify(globalThis.t('no_balls', { ball: BALLS[ball]?.fr || ball }));
    globalThis.SFX.play('error');
    return null;
  }
  state.inventory[ball]--;
  const pokemon = globalThis.makePokemon(speciesEN, zoneId, ball);
  if (!pokemon) return null;
  if (bonusPotential > 0) pokemon.potential = Math.min(5, pokemon.potential + bonusPotential);
  state.pokemons.push(pokemon);
  state.stats.totalCaught++;
  globalThis.checkPlayerStatPoints?.();
  // Behavioural log — première capture
  if (!state.behaviourLogs) state.behaviourLogs = {};
  if (!state.behaviourLogs.firstCaptureAt) state.behaviourLogs.firstCaptureAt = Date.now();
  // Zone captures counter
  if (zoneId && state.zones[zoneId]) state.zones[zoneId].captures = (state.zones[zoneId].captures || 0) + 1;
  // Pokedex
  if (!state.pokedex[pokemon.species_en]) {
    state.pokedex[pokemon.species_en] = { seen: true, caught: true, shiny: pokemon.shiny, count: 1 };
  } else {
    state.pokedex[pokemon.species_en].caught = true;
    state.pokedex[pokemon.species_en].count++;
    if (pokemon.shiny) state.pokedex[pokemon.species_en].shiny = true;
  }
  if (pokemon.shiny) state.stats.shinyCaught++;
  const name = globalThis.speciesName(pokemon.species_en);
  const stars = '★'.repeat(pokemon.potential) + '☆'.repeat(5 - pokemon.potential);
  const shinyTag = pokemon.shiny ? ' ✨SHINY✨' : '';
  if (pokemon.shiny) {
    globalThis.notify(`${name} ${stars}${shinyTag}`, 'gold');
    setTimeout(() => globalThis.showShinyPopup?.(pokemon.species_en), 200);
  } else {
    globalThis.notify(`${name} ${stars}`, pokemon.potential >= 4 ? 'gold' : 'success');
  }
  globalThis.addLog(globalThis.t('catch_success', { name }) + ` [${stars}]`);
  // Feed event
  globalThis.pushFeedEvent({
    category: 'capture',
    title: `${name}${shinyTag} — ${stars}`,
    detail: `Zone: ${zoneId || '?'} · ${BALLS[ball]?.fr || ball}`,
    win: true,
    species_en: pokemon.species_en,
    potential: pokemon.potential,
    shiny: pokemon.shiny,
    byAgent: null,
  });
  // SFX
  globalThis.SFX.play('capture', pokemon.potential, pokemon.shiny);
  globalThis.saveState();
  return pokemon;
}

// Rep par combat : +1 dresseur normal / +10 spécial (arène, Elite 4, persos d'histoire) / -5 en cas de défaite
function getCombatRepGain(trainerKey, win) {
  if (!win) return -5;
  return globalThis.SPECIAL_TRAINER_KEYS.has(trainerKey) ? 10 : 1;
}

function resolveCombat(playerTeamIds, trainerData) {
  const state = globalThis.state;
  const playerPower = globalThis.getTeamPower(playerTeamIds);
  let enemyPower = 0;
  for (const t of trainerData.team) {
    enemyPower += (t.stats.atk + t.stats.def + t.stats.spd);
  }
  // Add some randomness (±20%)
  const pRoll = playerPower * (0.8 + Math.random() * 0.4);
  const eRoll = enemyPower * (0.8 + Math.random() * 0.4);
  const win = pRoll >= eRoll;
  const reward = win ? Math.min(globalThis.MAX_COMBAT_REWARD, globalThis.randInt(trainerData.trainer.reward[0], trainerData.trainer.reward[1])) : 0;
  const repGain = getCombatRepGain(trainerData.trainerKey || trainerData.trainer?.sprite, win);
  return { win, playerPower, enemyPower, reward, repGain };
}

function applyCombatResult(result, playerTeamIds, trainerData) {
  const state = globalThis.state;
  state.stats.totalFights++;
  // Behavioural log — premier combat
  if (!state.behaviourLogs) state.behaviourLogs = {};
  if (!state.behaviourLogs.firstCombatAt) state.behaviourLogs.firstCombatAt = Date.now();
  if (result.win && result.reward >= 0) {
    state.stats.totalFightsWon++;
    if (result.reward > 0) {
      const zs = initZone(trainerData.zoneId);
      zs.pendingIncome = (zs.pendingIncome || 0) + result.reward;
    }
    state.stats.totalMoneyEarned += result.reward;
    // Rep sur toutes les victoires (spécial = +10, normal = +1)
    if (result.repGain > 0) {
      const prevRep = state.gang.reputation;
      state.gang.reputation += result.repGain;
      checkForNewlyUnlockedZones(prevRep);
    }
    // Ball drops for regular trainer battles (2x less than before)
    if (!trainerData.isSpecial && !trainerData.isRaid) {
      const diff = trainerData.trainer?.diff || 1;
      const ballType = diff >= 5 ? 'ultraball' : diff >= 3 ? 'greatball' : 'pokeball';
      if (Math.random() < 0.5) { // 50% chance = moitié moins en moyenne
        state.inventory[ballType] = (state.inventory[ballType] || 0) + 1;
      }
    }
    if (trainerData.trainerKey === 'rocketgrunt' || trainerData.trainerKey === 'rocketgruntf' || trainerData.trainerKey === 'giovanni') {
      state.stats.rocketDefeated++;
    }
    if (trainerData.trainerKey === 'blue') {
      state.stats.blueDefeated = (state.stats.blueDefeated || 0) + 1;
    }
    // Mark gym as defeated when its leader is beaten
    const combatZone = ZONE_BY_ID[trainerData.zoneId];
    if (combatZone?.gymLeader && trainerData.trainerKey === combatZone.gymLeader) {
      const zs = initZone(trainerData.zoneId);
      const wasDefeated = zs.gymDefeated;
      zs.gymDefeated = true;
      if (!wasDefeated) {
        globalThis.notify(`🏆 ${combatZone.fr} — Champion vaincu ! La voie est libre.`, 'gold');
        // Déclenche la vérification de nouvelles zones débloquées par la séquence
        setTimeout(() => checkForNewlyUnlockedZones(state.gang.reputation - 0.001), 600);
      }
      if (trainerData.isGymRaid) {
        zs.gymRaidLastFight = Date.now();
      }
    }
    // XP to team (gyms give bonus XP)
    const zone = ZONE_BY_ID[trainerData.zoneId];
    const gymBonus = (zone?.type === 'city' && zone?.xpBonus) ? zone.xpBonus : 1;
    const xpEach = Math.round((10 + trainerData.trainer.diff * 5) * gymBonus * 0.75);
    for (const id of playerTeamIds) {
      const p = state.pokemons.find(pk => pk.id === id);
      if (p) {
        globalThis.levelUpPokemon(p, xpEach);
        if (p.history) p.history.push({ type: 'combat', ts: Date.now(), won: true });
      }
    }
  } else {
    state.gang.reputation = Math.max(0, state.gang.reputation + result.repGain);
    for (const id of playerTeamIds) {
      const p = state.pokemons.find(pk => pk.id === id);
      if (p) {
        if (p.history) p.history.push({ type: 'combat', ts: Date.now(), won: false });
      }
    }
  }
  globalThis.saveState();
}

// ── Zone unlock detection ──────────────────────────────────────
function checkForNewlyUnlockedZones(prevRep) {
  const state = globalThis.state;
  const newZones = ZONES.filter(z => {
    if (!z.rep || z.rep === 0) return false;
    if (z.unlockItem && !state.purchases?.[z.unlockItem]) return false;
    // Cities require previous city to be defeated
    if (z.type === 'city') {
      const idx = globalThis.GYM_ORDER.indexOf(z.id);
      if (idx > 0) {
        const prevId = globalThis.GYM_ORDER[idx - 1];
        if (!state.zones[prevId]?.gymDefeated) return false;
      }
    }
    return prevRep < z.rep && state.gang.reputation >= z.rep;
  });
  newZones.forEach((zone, i) => {
    setTimeout(() => showZoneUnlockPopup(zone), 400 + i * 300);
  });
}

let _zoneUnlockQueue = [];
let _zoneUnlockActive = false;

function showZoneUnlockPopup(zone) {
  _zoneUnlockQueue.push(zone);
  if (!_zoneUnlockActive) _processZoneUnlockQueue();
}

function _processZoneUnlockQueue() {
  const state = globalThis.state;
  if (_zoneUnlockQueue.length === 0) { _zoneUnlockActive = false; return; }
  _zoneUnlockActive = true;
  const zone = _zoneUnlockQueue.shift();
  const popup = document.getElementById('zoneUnlockPopup');
  const nameEl = document.getElementById('zoneUnlockName');
  const repEl  = document.getElementById('zoneUnlockRep');
  if (!popup || !nameEl) return;
  nameEl.textContent = state.lang === 'fr' ? zone.fr : zone.en;
  if (repEl) repEl.textContent = `Réputation requise : ${zone.rep}`;
  popup._zoneId = zone.id;
  popup.classList.add('show');
}

// ── Gym Raid (manual + auto) ──────────────────────────────────
function triggerGymRaid(zoneId, isAuto) {
  const state = globalThis.state;
  const zone = ZONE_BY_ID[zoneId];
  if (!zone || !zone.gymLeader) return false;
  const zs = initZone(zoneId);
  const raidCooldownMs = 5 * 60 * 1000;
  if (Date.now() - (zs.gymRaidLastFight || 0) < raidCooldownMs) {
    if (!isAuto) globalThis.notify('⏳ Raid d\'arène en cooldown !', 'error');
    return false;
  }
  if ((zs.combatsWon || 0) < 10) {
    if (!isAuto) globalThis.notify('⚔ Remportez 10 combats d\'abord !', 'error');
    return false;
  }
  // Auto requires at least 1 manual win
  if (isAuto && !zs.gymDefeated) return false;

  zs.gymRaidLastFight = Date.now();
  globalThis.saveState();

  // Build the gym leader's team
  const trainerKey = zone.gymLeader;
  const trainer = TRAINER_TYPES[trainerKey];
  if (!trainer) return false;

  const eliteDiff = trainer.diff + 3;
  const teamSize = 3;
  const team = [];
  for (let i = 0; i < teamSize; i++) {
    const sp = globalThis.pick(zone.pool);
    const level = globalThis.randInt(15 + eliteDiff * 5, 25 + eliteDiff * 7);
    team.push({ species_en: sp, level, stats: globalThis.calculateStats({ species_en: sp, level, nature: 'hardy', potential: 4 }) });
  }
  const raidTrainer = {
    ...trainer,
    fr: `⚔ ${trainer.fr} (Champion)`,
    en: `⚔ ${trainer.en} (Leader)`,
    diff: eliteDiff,
    reward: [trainer.reward[0] * 5, trainer.reward[1] * 5],
    rep: trainer.rep * 3,
  };

  if (isAuto) {
    // Auto-fight via agent power
    const agentPower = state.agents.filter(a => a.assignedZone === zoneId)
      .reduce((s, a) => s + globalThis.getAgentCombatPower(a), 0);
    let enemyPower = 0;
    for (const t of team) enemyPower += (t.stats.atk + t.stats.def + t.stats.spd);
    const win = agentPower * (0.8 + Math.random() * 0.4) >= enemyPower * (0.8 + Math.random() * 0.4);
    if (win) {
      const reward = Math.min(globalThis.MAX_COMBAT_REWARD, globalThis.randInt(raidTrainer.reward[0], raidTrainer.reward[1]));
      zs.pendingIncome = (zs.pendingIncome || 0) + reward;
      state.gang.reputation += raidTrainer.rep;
      state.stats.totalMoneyEarned += reward;
      state.stats.totalFights++;
      state.stats.totalFightsWon++;
      zs.combatsWon = (zs.combatsWon || 0) + 1;
      zs.gymDefeated = true;
      globalThis.notify(`🏆 RAID AUTO — ${zone.fr} vaincu ! +${reward}₽`, 'gold');
      globalThis.addBattleLogEntry({ ts: Date.now(), zoneName: `[RAID] ${zone.fr}`, win: true,
        reward, repGain: raidTrainer.rep, lines: [`Raid auto réussi contre ${trainerKey}`], trainerKey, isAgent: true });
    } else {
      state.stats.totalFights++;
      globalThis.notify(`❌ Raid auto échoué — ${zone.fr}`, 'error');
    }
    globalThis.saveState();
    globalThis.updateTopBar();
    return win;
  }

  // Manual raid → open combat popup
  globalThis.openCombatPopup(zoneId, { type: 'trainer', trainerKey, trainer: raidTrainer, team, isGymRaid: true });
  return true;
}

// ── Background zone simulation ─────────────────────────────────
function startBackgroundZone(zoneId) {
  const backgroundZoneTimers = globalThis.backgroundZoneTimers;
  if (backgroundZoneTimers[zoneId]) return; // déjà actif
  const zone = ZONE_BY_ID[zoneId];
  if (!zone || !zone.spawnRate) return;
  const interval = Math.round(1000 / zone.spawnRate);
  backgroundZoneTimers[zoneId] = setInterval(() => {
    globalThis.resolveBackgroundSpawnForZone?.(zoneId);
  }, interval);
}

function stopBackgroundZone(zoneId) {
  const backgroundZoneTimers = globalThis.backgroundZoneTimers;
  if (backgroundZoneTimers[zoneId]) {
    clearInterval(backgroundZoneTimers[zoneId]);
    delete backgroundZoneTimers[zoneId];
  }
}

// Recalcule quels timers background sont nécessaires selon l'état actuel
function syncBackgroundZones() {
  const state = globalThis.state;
  const openZones = globalThis.openZones;
  const backgroundZoneTimers = globalThis.backgroundZoneTimers;
  const activeZones = new Set(
    state.agents.filter(a => a.assignedZone).map(a => a.assignedZone)
  );
  // Démarrer les timers manquants
  for (const zoneId of activeZones) {
    if (!openZones.has(zoneId) && !backgroundZoneTimers[zoneId]) {
      startBackgroundZone(zoneId);
    }
  }
  // Arrêter les timers orphelins (zone ouverte ou plus d'agent)
  for (const zoneId of Object.keys(backgroundZoneTimers)) {
    if (!activeZones.has(zoneId) || openZones.has(zoneId)) {
      stopBackgroundZone(zoneId);
    }
  }
}

Object.assign(globalThis, {
  // Zone activity (état exclusif par zone)
  zoneActivity,
  getZoneActivityMode,
  setZoneActivity,
  clearZoneActivity,
  // Zone system pure logic
  _zsys_getZoneSlotCost:              getZoneSlotCost,
  _zsys_initZone:                     initZone,
  _zsys_isZoneUnlocked:               isZoneUnlocked,
  _zsys_isZoneDegraded:               isZoneDegraded,
  _zsys_getZoneMastery:               getZoneMastery,
  _zsys_getZoneAgentSlots:            getZoneAgentSlots,
  _zsys_makeTrainerTeam:              makeTrainerTeam,
  _zsys_makeRaidSpawn:                makeRaidSpawn,
  _zsys_spawnInZone:                  spawnInZone,
  _zsys_rollChestLoot:                rollChestLoot,
  _zsys_activateEvent:                activateEvent,
  _zsys_investInZone:                 investInZone,
  _zsys_tryCapture:                   tryCapture,
  _zsys_getCombatRepGain:             getCombatRepGain,
  _zsys_resolveCombat:                resolveCombat,
  _zsys_applyCombatResult:            applyCombatResult,
  _zsys_checkForNewlyUnlockedZones:   checkForNewlyUnlockedZones,
  _zsys_showZoneUnlockPopup:          showZoneUnlockPopup,
  _zsys_processZoneUnlockQueue:       _processZoneUnlockQueue,
  _zsys_triggerGymRaid:               triggerGymRaid,
  _zsys_startBackgroundZone:          startBackgroundZone,
  _zsys_stopBackgroundZone:           stopBackgroundZone,
  _zsys_syncBackgroundZones:          syncBackgroundZones,
  ZONE_DIFFICULTY_SCALING,
});

export {};
