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
//    ZONE_BY_ID, ZONES, ZONE_JOHTO_BY_ID, SPECIES_BY_EN, SPECIAL_EVENTS, CHEST_LOOT
//  ES module imports:
//    TRAINER_TYPES (from data/trainers-data.js)
//  ES module globals (exposed on globalThis by app.js):
//    GYM_ORDER, JOHTO_GYM_ORDER
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

function isJohtoZone(zoneId) {
  return typeof ZONE_JOHTO_BY_ID !== 'undefined' && !!ZONE_JOHTO_BY_ID[zoneId];
}

// Ensemble des types de dresseurs Rocket (pour le tracking)
const ROCKET_TRAINER_KEYS = new Set(['rocketgrunt','rocketgruntf','scientist','archer','ariana','proton','giovanni']);

// ── Spawn weights par rareté ──────────────────────────────────
// Pokémon communs spawnt plus souvent que les rares dans le même pool.
// Les légendaires sont gérés séparément (formule ~1 % total).
const RARITY_SPAWN_WEIGHT = {
  common:    10,
  uncommon:   5,
  rare:       2,
  very_rare:  1,
};

// ── Événements actifs ─────────────────────────────────────────
// La majorité des événements est désactivée en pre-alpha pour réduire le bruit.
// Retirer un id d'ici pour le réactiver quand son système sera prêt.
const ACTIVE_EVENT_IDS = new Set([
  // Kanto — boost
  'shiny_swarm',
  'rare_migration',
  // Johto — boost + combat Rocket
  'raikou_sighting',
  'rocket_radio_takeover',
]);

function getEligibleSpecialEvents(zoneId) {
  const state = globalThis.state;
  const zoneIsJohto = isJohtoZone(zoneId);
  return SPECIAL_EVENTS.filter(ev =>
    ACTIVE_EVENT_IDS.has(ev.id) &&
    state.gang.reputation >= ev.minRep &&
    (!ev.zoneIds || ev.zoneIds.includes(zoneId)) &&
    (!ev.region || ev.region !== 'johto' || zoneIsJohto)
  );
}

// Purge les entrées expirées — appelé à chaque tick de spawn
function cleanExpiredZoneActivities() {
  const now = Date.now();
  for (const zoneId of Object.keys(zoneActivity)) {
    const a = zoneActivity[zoneId];
    if (a?.expiresAt && now > a.expiresAt) {
      delete zoneActivity[zoneId];
    }
  }
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
  const zs = state.zones[zoneId];
  // Migration
  if (zs.captures        === undefined) zs.captures        = 0;
  if (zs.pendingIncome   === undefined) zs.pendingIncome   = 0;
  if (zs.pendingItems    === undefined) zs.pendingItems    = {};
  if (zs.slots           === undefined) zs.slots           = 1;
  if (!Array.isArray(zs.assignedAgents)) zs.assignedAgents = [];
  // Persistent unlock flag: derive from historical activity if not set yet
  if (zs.unlocked === undefined) {
    zs.unlocked = (zs.combatsWon > 0 || zs.captures > 0 || zs.invested === true);
  }
  // Remove legacy invest fields (AFTER reading invested for migration above)
  delete zs.invested;
  delete zs.investPower;
  return zs;
}

function isZoneUnlocked(zoneId) {
  const state = globalThis.state;
  const zone = ZONE_BY_ID[zoneId];
  if (!zone) return false;
  // Persistent flag: once unlocked, zone stays accessible even if rep drops
  // (still requires unlockItem purchase if applicable)
  const zoneState = state.zones[zoneId];
  const wasPreviouslyAccessed = zoneState && (
    zoneState.unlocked === true ||
    zoneState.combatsWon > 0   ||
    zoneState.captures > 0
  );
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
    const johtoIdx = globalThis.JOHTO_GYM_ORDER?.indexOf(zoneId) ?? -1;
    if (johtoIdx >= 0) {
      if (johtoIdx > 0) {
        const prevId = globalThis.JOHTO_GYM_ORDER[johtoIdx - 1];
        if (!state.zones[prevId]?.gymDefeated) return false;
      }
    } else {
      const idx = globalThis.GYM_ORDER.indexOf(zoneId);
      if (idx > 0) {
        const prevId = globalThis.GYM_ORDER[idx - 1];
        if (!state.zones[prevId]?.gymDefeated) return false;
      }
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

// ── Tier de difficulté sélectionné par le joueur ──────────────
// Retourne selectedTier si le joueur en a choisi un (1–mastery),
// sinon retourne le niveau de mastery débloqué.
function getZoneDifficulty(zoneId) {
  const mastery = getZoneMastery(zoneId);
  const z = globalThis.state?.zones?.[zoneId];
  const sel = z?.selectedTier;
  if (sel && sel >= 1 && sel <= mastery) return sel;
  return mastery;
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
    const level = Math.min(100, baseLevel + (zone.zoneLevelBonus || 0) + scaling.levelBonus);
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

// ── Encounter tracking helper ─────────────────────────────────
function _trackSpawnEncounter(spawn) {
  if (!spawn) return;
  const state = globalThis.state;
  if (!state.encounterStats) state.encounterStats = { bySpecies: {}, byTrainer: {} };
  if (!state.encounterStats.bySpecies) state.encounterStats.bySpecies = {};
  if (!state.encounterStats.byTrainer) state.encounterStats.byTrainer = {};
  if (spawn.type === 'pokemon' && spawn.species_en) {
    state.encounterStats.bySpecies[spawn.species_en] = (state.encounterStats.bySpecies[spawn.species_en] || 0) + 1;
  } else if (spawn.type === 'trainer' && spawn.trainerKey) {
    state.encounterStats.byTrainer[spawn.trainerKey] = (state.encounterStats.byTrainer[spawn.trainerKey] || 0) + 1;
  }
}

function spawnInZone(zoneId) {
  cleanExpiredZoneActivities(); // purge les événements expirés avant de spawner
  const state = globalThis.state;
  const zone = ZONE_BY_ID[zoneId];
  if (!zone) return null;
  const zState = initZone(zoneId);
  const isDegraded = isZoneDegraded(zoneId);
  const isChestBoosted = globalThis.isBoostActive('chestBoost');
  const r = Math.random();

  // Niveau de difficulté : mastery ou tier sélectionné manuellement
  const mastery = getZoneDifficulty(zoneId);
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
    const eligible = getEligibleSpecialEvents(zoneId);
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
    const _ts = { type: 'trainer', trainerKey, trainer, team };
    _trackSpawnEncounter(_ts);
    return _ts;
  }

  // 5. City zones — extra trainer chance (no fallback to combat-only, pokemon can also spawn)
  if (zone.type === 'city' && r < 0.55 && zone.trainers.length > 0) {
    const trainerKey = globalThis.pick(zone.trainers);
    const trainer = TRAINER_TYPES[trainerKey];
    if (trainer) {
      const _ts = { type: 'trainer', trainerKey, trainer, team: makeTrainerTeam(zone, trainerKey, undefined, mastery) };
      _trackSpawnEncounter(_ts);
      return _ts;
    }
  }

  // 6. Pokemon spawn — Rare Scope triples chance of rare+ species
  let speciesEN;
  // Bébés Pokémon (babyOnly:true) : jamais en spawn sauvage — œuf uniquement
  const _spawnPool = zone.pool.filter(en => !SPECIES_BY_EN[en]?.babyOnly);
  if (_spawnPool.length === 0) return null; // pool vide après filtrage
  const _spawnRarePool = zone.rarePool
    ? zone.rarePool.filter(e => !SPECIES_BY_EN[typeof e === 'string' ? e : e.en]?.babyOnly)
    : null;
  // Safari rarePool: 10% chance to pick from rare uncapturable pool (boosted by rarescope)
  const rarePoolChance = _spawnRarePool?.length ? (globalThis.isBoostActive('rarescope') ? 0.30 : 0.10) : 0;
  if (_spawnRarePool?.length && Math.random() < rarePoolChance) {
    speciesEN = globalThis.weightedPick(_spawnRarePool);
  } else if (globalThis.isBoostActive('rarescope') && Math.random() < 0.5) {
    const filteredRare = _spawnPool.filter(en => {
      const sp = SPECIES_BY_EN[en];
      return sp && (sp.rarity === 'rare' || sp.rarity === 'very_rare');
      // légendaires exclus du boost rarescope
    });
    speciesEN = filteredRare.length > 0 ? globalThis.pick(filteredRare) : globalThis.pick(_spawnPool);
  } else {
    // Poids par rareté : commun spawne plus souvent que rare/très rare.
    // Légendaires : ~1 % de chance combinée quelle que soit la taille du pool.
    const _legCount    = _spawnPool.filter(en => SPECIES_BY_EN[en]?.rarity === 'legendary').length;
    const _nonLegTotal = _spawnPool.reduce((s, en) => {
      const r = SPECIES_BY_EN[en]?.rarity;
      return r === 'legendary' ? s : s + (RARITY_SPAWN_WEIGHT[r] ?? 5);
    }, 0);
    // legendaryW : chaque légendaire représente ~1 % du pool total
    const _legendaryW  = _legCount > 0 && _nonLegTotal > 0
      ? (_nonLegTotal / 99) / _legCount
      : 1;
    const poolWithWeights = _spawnPool.map(en => {
      const rarity = SPECIES_BY_EN[en]?.rarity;
      return {
        en,
        w: rarity === 'legendary' ? _legendaryW : (RARITY_SPAWN_WEIGHT[rarity] ?? 5),
      };
    });
    const totalW = poolWithWeights.reduce((s, x) => s + x.w, 0);
    let roll = Math.random() * totalW;
    speciesEN = poolWithWeights[poolWithWeights.length - 1].en;
    for (const x of poolWithWeights) {
      roll -= x.w;
      if (roll <= 0) { speciesEN = x.en; break; }
    }
  }
  const _pokemonSpawn = { type: 'pokemon', species_en: speciesEN };
  _trackSpawnEncounter(_pokemonSpawn);
  return _pokemonSpawn;
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
          if (!state.pokedex[pokemon.species_en]) {
            state.pokedex[pokemon.species_en] = { seen: true, caught: true, shiny: pokemon.shiny, count: 1 };
          } else {
            state.pokedex[pokemon.species_en].caught = true;
            state.pokedex[pokemon.species_en].count++;
          }
          globalThis._unlockFabricBg?.(pokemon.dex, pokemon.shiny);
          const pName = globalThis.speciesName(pokemon.species_en);
          const stars = '★'.repeat(pokemon.potential);
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
      // Legacy loot type — converti en pokeballs (masterball n'existe plus en inventaire)
      const pbBonus = 20;
      state.inventory.pokeball = (state.inventory.pokeball || 0) + pbBonus;
      return { msg: `📦 ${pbBonus}× Poké Balls !`, type: 'gold' };
    }
    case 'event': {
      // Trigger a random event
      const eligible = getEligibleSpecialEvents(zoneId);
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
  const label = state.lang === 'fr' ? event.fr : event.en;
  state.stats.eventsCompleted++;

  // Collect all reward messages before notifying once
  const parts = [];

  if (reward.shinyBoost) {
    state.activeBoosts.aura = Math.max(state.activeBoosts.aura || 0, Date.now() + reward.shinyBoost);
    parts.push('✨ Aura Shiny');
  }
  if (reward.chestBoost) {
    state.activeBoosts.chestBoost = Math.max(state.activeBoosts.chestBoost || 0, Date.now() + reward.chestBoost);
    parts.push('📦 Coffres boostés');
  }
  if (reward.rareBoost) {
    state.activeBoosts.rarescope = Math.max(state.activeBoosts.rarescope || 0, Date.now() + reward.rareBoost);
    parts.push('🔭 Rares boostés');
  }
  if (reward.money) {
    const amount = globalThis.randInt(reward.money[0], reward.money[1]);
    state.gang.money += amount;
    state.stats.totalMoneyEarned += amount;
    if (reward.rep) state.gang.reputation += reward.rep;
    parts.push(`+${amount.toLocaleString()}₽`);
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
        parts.push(`${globalThis.speciesName(reward.pokemonGift)} rejoint le gang !`);
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
      parts.push('🥚 Un œuf mystérieux est apparu…');
    }
  }

  // Single notification for the whole event
  const suffix = parts.length > 0 ? ` — ${parts.join(' · ')}` : '';
  globalThis.notify(`${event.icon} ${label}${suffix}`, 'gold');

  // Événements sans combat : résolus instantanément → zone repasse idle
  // Événements avec combat : setZoneActivity déjà fait dans spawnInZone au moment du spawn,
  // la zone reste 'event' jusqu'à la victoire ou l'expiration TTL
  if (!event.trainerKey) {
    clearZoneActivity(zoneId);
  }
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
  zState.unlocked = true;  // persistent: zone stays accessible even if rep drops later
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
  const BALLS = globalThis.BALLS;
  // pokeball = ressource unique de capture ; activeBall = skin cosmétique uniquement
  if ((state.inventory.pokeball || 0) <= 0) {
    globalThis.notify(globalThis.t('no_balls', { ball: 'Poké Ball' }));
    globalThis.SFX.play('error');
    return null;
  }
  state.inventory.pokeball--;
  const visualBall = state.activeBall || 'pokeball'; // skin affiché dans l'historique
  const pokemon = globalThis.makePokemon(speciesEN, zoneId, visualBall);
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
  // Fabric BG unlock
  globalThis._unlockFabricBg?.(pokemon.dex, pokemon.shiny);
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
  // Feed event — skip si un agent gère son propre feed event (évite les doublons)
  if (!globalThis._agentCaptureCtx) {
    const zoneName = ZONE_BY_ID?.[zoneId]?.fr || zoneId || '?';
    globalThis.pushFeedEvent({
      category: 'capture',
      title: `${name}${pokemon.shiny ? ' ✨' : ''} — ${stars}`,
      detail: `${zoneName} · ${BALLS[visualBall]?.fr || visualBall}`,
      win: true,
      species_en: pokemon.species_en,
      level: pokemon.level,
      potential: pokemon.potential,
      shiny: pokemon.shiny,
      byAgent: null,
      zone: zoneName,
      ball: BALLS[visualBall]?.fr || visualBall,
    });
  }
  // SFX
  globalThis.SFX.play('capture', pokemon.potential, pokemon.shiny);
  globalThis.saveState();
  return pokemon;
}

// Type-coverage multiplier: bonus/malus (0.7–1.4) based on how well the player's
// pokemon moves match up against the enemy team's types.
function _typeCoverageMult(playerPks, enemyPks) {
  const getEff = globalThis.getTypeEffectiveness;
  if (!getEff || typeof MOVES_DATA === 'undefined') return 1;
  const enemyTypes = enemyPks.flatMap(ep => SPECIES_BY_EN[ep.species_en]?.types || ['Normal']);
  if (enemyTypes.length === 0) return 1;
  let total = 0, count = 0;
  for (const pk of playerPks) {
    const sp = SPECIES_BY_EN[pk.species_en];
    const dmgMoves = (pk.moves || []).filter(m => (MOVES_DATA[m]?.basePower || 0) > 0);
    if (dmgMoves.length === 0) { total += 1; count++; continue; }
    let best = 0;
    for (const m of dmgMoves) {
      const mType = MOVES_DATA[m].type;
      const stab = (sp?.types || []).includes(mType) ? 1.5 : 1;
      const avgEff = enemyTypes.reduce((s, et) => s + getEff(mType, [et]), 0) / enemyTypes.length;
      const mult = avgEff * stab;
      if (mult > best) best = mult;
    }
    total += best;
    count++;
  }
  const raw = count > 0 ? total / count : 1;
  return Math.min(1.4, Math.max(0.7, raw));
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
  const playerPks = playerTeamIds.map(id => state.pokemons.find(pk => pk.id === id)).filter(Boolean);
  const covMult = _typeCoverageMult(playerPks, trainerData.team);
  const pRoll = playerPower * covMult * (0.8 + Math.random() * 0.4);
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
  // Mark zone as permanently unlocked (persists even if rep drops later)
  if (trainerData.zoneId && state.zones[trainerData.zoneId]) {
    state.zones[trainerData.zoneId].unlocked = true;
  }
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
    // Ball drops for regular trainer battles — toujours des Poké Balls (ressource unique)
    if (!trainerData.isSpecial && !trainerData.isRaid) {
      if (Math.random() < 0.5) { // 50% de chance
        state.inventory.pokeball = (state.inventory.pokeball || 0) + 1;
      }
    }
    if (ROCKET_TRAINER_KEYS.has(trainerData.trainerKey)) {
      state.stats.rocketDefeated = (state.stats.rocketDefeated || 0) + 1;
      if (isJohtoZone(trainerData.zoneId)) {
        state.stats.rocketDefeatedJohto = (state.stats.rocketDefeatedJohto || 0) + 1;
        // Auto-award Johto Rocket passes
        const johtoRockets = state.stats.rocketDefeatedJohto;
        if (johtoRockets >= 50 && !state.purchases.rocket_hq_keycard) {
          state.purchases.rocket_hq_keycard = true;
          globalThis.notify('🔑 Badge QG Rocket obtenu ! Le QG Rocket d\'Acajou est accessible.', 'gold');
          setTimeout(() => globalThis.renderZonesTab?.(), 300);
        }
        if (johtoRockets >= 100 && !state.purchases.rocket_uniform) {
          state.purchases.rocket_uniform = true;
          globalThis.notify('👔 Uniforme Rocket obtenu ! La Tour Radio de Doublonville est accessible.', 'gold');
          setTimeout(() => globalThis.renderZonesTab?.(), 300);
        }
      }
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
        // Vérifie si l'offre Johto doit être déclenchée (après la victoire au Plateau Indigo)
        if (trainerData.zoneId === 'indigo_plateau') {
          setTimeout(() => globalThis.checkJohtoUnlock?.(), 2500);
        }
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
    // Cities require previous city to be defeated (Kanto or Johto order)
    if (z.type === 'city') {
      const johtoIdx = globalThis.JOHTO_GYM_ORDER?.indexOf(z.id) ?? -1;
      if (johtoIdx >= 0) {
        if (johtoIdx > 0) {
          const prevId = globalThis.JOHTO_GYM_ORDER[johtoIdx - 1];
          if (!state.zones[prevId]?.gymDefeated) return false;
        }
      } else {
        const idx = globalThis.GYM_ORDER.indexOf(z.id);
        if (idx > 0) {
          const prevId = globalThis.GYM_ORDER[idx - 1];
          if (!state.zones[prevId]?.gymDefeated) return false;
        }
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
    const raidAgents = state.agents.filter(a => a.assignedZone === zoneId);
    const agentPower = raidAgents.reduce((s, a) => s + globalThis.getAgentCombatPower(a), 0);
    const playerPks = raidAgents.flatMap(a => a.team.map(id => state.pokemons.find(pk => pk.id === id)).filter(Boolean));
    let enemyPower = 0;
    for (const t of team) enemyPower += (t.stats.atk + t.stats.def + t.stats.spd);
    const covMult = _typeCoverageMult(playerPks, team);
    const win = agentPower * covMult * (0.8 + Math.random() * 0.4) >= enemyPower * (0.8 + Math.random() * 0.4);
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
// ── Modèle actif / pausé ──────────────────────────────────────────
// Une zone est ACTIVE si : le joueur l'a ouverte OU ≥1 agent y est assigné.
// Sinon, elle est PAUSÉE : aucun calcul, aucun timer.
//
// Un seul dict "zoneTimers" remplace les anciens zoneSpawnTimers + backgroundZoneTimers.
// À chaque tick le callback décide du mode selon openZones :
//   • zone ouverte → tickZoneSpawn   (spawns visuels)
//   • zone fermée  → resolveBackgroundSpawnForZone  (résolution silencieuse)

function isZoneActive(zoneId) {
  const openZones = globalThis.openZones;
  const state     = globalThis.state;
  return openZones?.has(zoneId) || state.agents.some(a => a.assignedZone === zoneId);
}

function startActiveZone(zoneId) {
  const zoneTimers = globalThis.zoneTimers;
  if (zoneTimers[zoneId]) return; // déjà actif
  const zone = ZONE_BY_ID[zoneId];
  if (!zone || !zone.spawnRate) return;
  const interval = Math.round(1000 / zone.spawnRate);
  zoneTimers[zoneId] = setInterval(() => {
    // Page en arrière-plan : on résout silencieusement uniquement les zones sans fenêtre ouverte.
    // Les zones ouvertes (visuelles) ne génèrent pas de nouveaux spawns DOM quand la page est masquée.
    if (document.hidden) {
      if (!globalThis.openZones?.has(zoneId)) {
        globalThis.resolveBackgroundSpawnForZone?.(zoneId);
      }
      // Zone ouverte + page masquée → aucun spawn visuel, la queue s'accumule à la réouverture
      return;
    }
    if (globalThis.openZones?.has(zoneId)) {
      globalThis.tickZoneSpawn?.(zoneId);               // mode visuel
    } else {
      globalThis.resolveBackgroundSpawnForZone?.(zoneId); // mode silencieux
    }
  }, interval);
}

function stopActiveZone(zoneId) {
  const zoneTimers = globalThis.zoneTimers;
  if (zoneTimers[zoneId]) {
    clearInterval(zoneTimers[zoneId]);
    delete zoneTimers[zoneId];
  }
}

// Délai de grâce 5 s avant de pauser — évite l'arrêt/redémarrage du timer
// quand le joueur ferme et rouvre rapidement une zone.
function pauseZoneIfIdle(zoneId) {
  setTimeout(() => {
    if (!isZoneActive(zoneId)) stopActiveZone(zoneId);
  }, 5000);
}

// Recalcule quels timers sont nécessaires (appelé au boot + assign/unassign agent)
function syncActiveZones() {
  const state    = globalThis.state;
  const openZones = globalThis.openZones;
  if (!openZones) return;
  // Démarrer les timers manquants
  for (const zoneId of openZones) startActiveZone(zoneId);
  for (const a of state.agents) { if (a.assignedZone) startActiveZone(a.assignedZone); }
  // Arrêter les timers orphelins (zone ni ouverte ni avec agent)
  const zoneTimers = globalThis.zoneTimers;
  for (const zoneId of Object.keys(zoneTimers)) {
    if (!isZoneActive(zoneId)) stopActiveZone(zoneId);
  }
}

// Aliases de compatibilité (appelés depuis app.js wrappers, gardés temporairement)
const startBackgroundZone = startActiveZone;
const stopBackgroundZone  = stopActiveZone;
const syncBackgroundZones = syncActiveZones;

Object.assign(globalThis, {
  // Zone activity (état exclusif par zone)
  zoneActivity,
  getZoneActivityMode,
  setZoneActivity,
  clearZoneActivity,
  cleanExpiredZoneActivities,
  // Zone system pure logic
  _zsys_getZoneSlotCost:              getZoneSlotCost,
  _zsys_initZone:                     initZone,
  _zsys_isZoneUnlocked:               isZoneUnlocked,
  _zsys_isZoneDegraded:               isZoneDegraded,
  _zsys_getZoneMastery:               getZoneMastery,
  _zsys_getZoneDifficulty:            getZoneDifficulty,
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
  // Unified active/paused zone timer (accès via préfixe _zsys_ — évite les conflits avec wrappers app.js)
  _zsys_isZoneActive:                 isZoneActive,
  _zsys_startActiveZone:              startActiveZone,
  _zsys_stopActiveZone:               stopActiveZone,
  _zsys_pauseZoneIfIdle:              pauseZoneIfIdle,
  _zsys_syncActiveZones:              syncActiveZones,
  // Aliases de compatibilité
  _zsys_startBackgroundZone:          startActiveZone,
  _zsys_stopBackgroundZone:           stopActiveZone,
  _zsys_syncBackgroundZones:          syncActiveZones,
  ZONE_DIFFICULTY_SCALING,
});

export {};
