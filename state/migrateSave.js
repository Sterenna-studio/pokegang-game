'use strict';

import { SHOWCASE_SLOTS } from '../data/game-config-data.js';

// ── Helper ───────────────────────────────────────────────────────────────────
function ensureObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

// ── Variance déterministe depuis l'ID d'un Pokémon ───────────────────────────
// Utilisée pour les Pokémon existants sans pcVariance dans leur save.
// Produit toujours la même valeur pour le même ID → stable entre sessions.
// Range : [0.90, 1.10] en pas de 0.001.
function _pcVarianceFromId(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  }
  const t = ((h >>> 0) % 201) / 1000; // 0.000 … 0.200
  return parseFloat((0.9 + t).toFixed(3));
}

// ── migrateSave ─────────────────────────────────────────────────────────────
// Parité totale avec migrate() dans app.js.
// deps = { DEFAULT_STATE, SAVE_SCHEMA_VERSION, SPECIES_BY_EN, uid, now? }
export function migrateSave(saved, deps) {
  const {
    DEFAULT_STATE,
    SAVE_SCHEMA_VERSION,
    SPECIES_BY_EN,
    uid,
    now = () => Date.now(),
  } = deps;

  if (!saved || typeof saved !== 'object') {
    const fresh = structuredClone(DEFAULT_STATE);
    fresh._schemaVersion = SAVE_SCHEMA_VERSION;
    return fresh;
  }

  if (!saved.version) saved.version = '6.0.0';

  const merged = { ...structuredClone(DEFAULT_STATE), ...saved };

  // ── Merge objets de premier niveau ─────────────────────────────────────────
  merged.gang         = { ...structuredClone(DEFAULT_STATE.gang),         ...ensureObject(saved.gang) };
  merged.inventory    = { ...structuredClone(DEFAULT_STATE.inventory),    ...ensureObject(saved.inventory) };
  // ── Migration balls → pokeball unique ─────────────────────────────────────
  // Convertir les vieilles balls fonctionnelles en pokeballs équivalentes.
  if (saved.inventory) {
    const gb = saved.inventory.greatball  || 0;
    const ub = saved.inventory.ultraball  || 0;
    const db = saved.inventory.duskball   || 0;
    const mb = saved.inventory.masterball || 0;
    const bonus = gb * 3 + ub * 10 + db * 7 + mb * 20;
    if (bonus > 0) merged.inventory.pokeball = (merged.inventory.pokeball || 0) + bonus;
  }
  delete merged.inventory.greatball;
  delete merged.inventory.ultraball;
  delete merged.inventory.duskball;
  delete merged.inventory.masterball;
  merged.stats        = { ...structuredClone(DEFAULT_STATE.stats),        ...ensureObject(saved.stats) };
  merged.settings     = { ...structuredClone(DEFAULT_STATE.settings),     ...ensureObject(saved.settings) };
  merged.activeBoosts = { ...structuredClone(DEFAULT_STATE.activeBoosts), ...ensureObject(saved.activeBoosts) };
  const savedDiscoveryProgress = ensureObject(saved.discoveryProgress);
  merged.discoveryProgress = {
    ...structuredClone(DEFAULT_STATE.discoveryProgress),
    ...(savedDiscoveryProgress.sinnohTeaseUnlocked === undefined
      ? {}
      : { sinnohTeaseUnlocked: savedDiscoveryProgress.sinnohTeaseUnlocked }),
  };
  merged.trainingRoom = { ...structuredClone(DEFAULT_STATE.trainingRoom), ...ensureObject(saved.trainingRoom) };
  merged.cosmetics    = { ...structuredClone(DEFAULT_STATE.cosmetics),    ...ensureObject(saved.cosmetics) };
  if (!Array.isArray(merged.cosmetics.favoriteBgs))  merged.cosmetics.favoriteBgs  = [];
  if (!Array.isArray(merged.cosmetics.activePatches)) merged.cosmetics.activePatches = [];
  if (merged.cosmetics.fabricMode === undefined)  merged.cosmetics.fabricMode  = 'repeat';
  if (merged.cosmetics.fabricSize === undefined)  merged.cosmetics.fabricSize  = 320;
  if (merged.cosmetics.fabricOpacity === undefined) merged.cosmetics.fabricOpacity = 72;
  // Strip legacy _emb keys (Embroidered feature removed)
  merged.cosmetics.unlockedBgs = (merged.cosmetics.unlockedBgs || []).filter(k => !k.endsWith('_emb'));
  merged.cosmetics.favoriteBgs = (merged.cosmetics.favoriteBgs || []).filter(k => !k.endsWith('_emb'));
  if (merged.cosmetics.gameBg?.endsWith('_emb')) {
    merged.cosmetics.gameBg = merged.cosmetics.gameBg.replace(/_emb$/, '');
  }
  merged.lab          = { ...structuredClone(DEFAULT_STATE.lab),          ...ensureObject(saved.lab) };
  merged.purchases    = { ...structuredClone(DEFAULT_STATE.purchases),    ...ensureObject(saved.purchases) };
  merged.pension      = { ...structuredClone(DEFAULT_STATE.pension),      ...ensureObject(saved.pension) };
  merged.activeEvents = ensureObject(saved.activeEvents, {});
  merged.encounterStats = {
    bySpecies: ensureObject(saved.encounterStats?.bySpecies),
    byTrainer: ensureObject(saved.encounterStats?.byTrainer),
  };

  // ── behaviourLogs ──────────────────────────────────────────────────────────
  if (!merged.behaviourLogs) merged.behaviourLogs = structuredClone(DEFAULT_STATE.behaviourLogs);
  if (!merged.behaviourLogs.tabViewCounts) merged.behaviourLogs.tabViewCounts = {};

  // ── Settings guards ──────────────────────────────────────────────────────────
  if (merged.settings.autoBuyBall   === undefined) merged.settings.autoBuyBall   = null;
  if (merged.settings.uiScale       === undefined) merged.settings.uiScale       = 100;
  if (merged.settings.musicVol      === undefined) merged.settings.musicVol      = 50;
  if (merged.settings.sfxVol        === undefined) merged.settings.sfxVol        = 80;
  if (merged.settings.zoneScale     === undefined) merged.settings.zoneScale     = 100;
  if (merged.settings.lightTheme    === undefined) merged.settings.lightTheme    = false;
  if (merged.settings.lowSpec       === undefined) merged.settings.lowSpec       = false;
  if (!merged.settings.sfxIndividual) merged.settings.sfxIndividual = {};
  if (merged.settings.autoEvoChoice === undefined) merged.settings.autoEvoChoice = false;

  // Migration classicSprites (bool) → spriteMode (string)
  if (merged.settings.spriteMode === undefined) {
    merged.settings.spriteMode = merged.settings.classicSprites ? 'gen5' : 'local';
  }
  delete merged.settings.classicSprites;

  // autoSellAgent / autoSellEggs — nested sous settings
  if (!merged.settings.autoSellAgent) merged.settings.autoSellAgent = { mode: 'all', potentials: [] };
  if (!merged.settings.autoSellEggs)  merged.settings.autoSellEggs  = { mode: 'all', potentials: [], allowShiny: false };
  if (!Array.isArray(merged.settings.protectedSpecies)) merged.settings.protectedSpecies = [];
  if (merged.settings.publicProfile === undefined) merged.settings.publicProfile = false;
  if (merged.settings.profileToken  === undefined) merged.settings.profileToken  = null;
  // Migration clés legacy top-level si présentes (placement erroné temporaire)
  if (merged.autoSellAgentSettings) { Object.assign(merged.settings.autoSellAgent, merged.autoSellAgentSettings); delete merged.autoSellAgentSettings; }
  if (merged.autoSellEggsSettings)  { Object.assign(merged.settings.autoSellEggs,  merged.autoSellEggsSettings);  delete merged.autoSellEggsSettings;  }

  // ── Tableaux de base ─────────────────────────────────────────────────────────────
  if (!merged.marketSales)              merged.marketSales  = {};
  if (!Array.isArray(merged.marketEvents)) merged.marketEvents = [];
  if (typeof merged.blackMarketBulletin === 'undefined') merged.blackMarketBulletin = null;
  if (!merged.bountyProgress || typeof merged.bountyProgress !== 'object') merged.bountyProgress = {};
  if (!Array.isArray(merged.favorites)) merged.favorites    = [];
  if (!Array.isArray(merged.favoriteZones)) merged.favoriteZones = [];
  if (!Array.isArray(merged.eggs))      merged.eggs         = [];
  if (!Array.isArray(merged.pokemons))  merged.pokemons     = [];
  if (!Array.isArray(merged.agents))    merged.agents       = [];
  if (!Array.isArray(merged.unlockedTitles)) merged.unlockedTitles = ['recrue', 'fondateur'];

  // ── Gang ─────────────────────────────────────────────────────────────────────
  if (!merged.gang.bossTeam) merged.gang.bossTeam = [];
  if (!merged.gang.showcase) merged.gang.showcase = [];
  while (merged.gang.showcase.length < SHOWCASE_SLOTS) merged.gang.showcase.push(null);
  // bossTeamSlots (3 slots d'équipe sauvegardés)
  if (!merged.gang.bossTeamSlots) {
    merged.gang.bossTeamSlots = [[...(merged.gang.bossTeam || [])], [], []];
  }
  if (merged.gang.activeBossTeamSlot === undefined) merged.gang.activeBossTeamSlot = 0;
  if (!merged.gang.bossTeamSlotsPurchased) merged.gang.bossTeamSlotsPurchased = [true, false, false];
  // Garder bossTeam en sync avec le slot actif
  merged.gang.bossTeam = [...(merged.gang.bossTeamSlots[merged.gang.activeBossTeamSlot] || [])];
  // Titres
  if (!merged.gang.titleA) merged.gang.titleA = 'recrue';
  if (merged.gang.titleB      === undefined) merged.gang.titleB      = null;
  if (merged.gang.titleLiaison === undefined) merged.gang.titleLiaison = '';
  if (merged.gang.titleC      === undefined) merged.gang.titleC      = null;
  if (merged.gang.titleD      === undefined) merged.gang.titleD      = null;
  // introSeen — false for existing players (they'll get the catch-up popup)
  if (merged.gang.introSeen         === undefined) merged.gang.introSeen         = false;
  // darkraiCutsceneSeen — false for all; existing initialized players will see it on next boot
  if (merged.gang.darkraiCutsceneSeen === undefined) merged.gang.darkraiCutsceneSeen = false;
  // johtoCinematicSeen — true pour les saves qui ont déjà Johto débloqué (ils n'ont pas besoin de revoir la cinématique)
  if (merged.gang.johtoCinematicSeen === undefined) {
    merged.gang.johtoCinematicSeen = merged.purchases?.johtoUnlocked ? true : false;
  }
  // hoennCinematicSeen — false by default; existing players who already unlocked Hoenn skip it
  if (merged.gang.hoennCinematicSeen  === undefined) {
    merged.gang.hoennCinematicSeen = merged.purchases?.hoennUnlocked ? true : false;
  }
  // bossAutoCombat — false par défaut pour les saves existantes
  if (merged.gang.bossAutoCombat === undefined) merged.gang.bossAutoCombat = false;
  // competition — online PvP system
  if (!merged.gang.competition || typeof merged.gang.competition !== 'object' || Array.isArray(merged.gang.competition)) {
    merged.gang.competition = structuredClone(DEFAULT_STATE.gang.competition);
  } else {
    const comp = merged.gang.competition;
    const def  = DEFAULT_STATE.gang.competition;
    if (!Array.isArray(comp.defenseTeam)) {
      comp.defenseTeam = [...def.defenseTeam];
    } else {
      comp.defenseTeam = Array.from({ length: 6 }, (_, idx) =>
        comp.defenseTeam[idx] === undefined ? null : comp.defenseTeam[idx],
      );
    }
    if (!Array.isArray(comp.defenseAgents)) {
      comp.defenseAgents = comp.defenseAgent ? [comp.defenseAgent, null, null] : [...def.defenseAgents];
    } else {
      comp.defenseAgents = Array.from({ length: 3 }, (_, idx) =>
        comp.defenseAgents[idx] === undefined ? null : comp.defenseAgents[idx],
      );
    }
    comp.defenseAgent = comp.defenseAgents.find(Boolean) ?? null;
    if (comp.defenseZone      === undefined) comp.defenseZone      = null;
    if (comp.defensePublished === undefined) comp.defensePublished  = false;
    comp.wins = ensureObject(comp.wins, {});
    if (comp.wins.attack   === undefined) comp.wins.attack   = 0;
    if (comp.wins.defense  === undefined) comp.wins.defense  = 0;
    comp.losses = ensureObject(comp.losses, {});
    if (comp.losses.attack  === undefined) comp.losses.attack  = 0;
    if (comp.losses.defense === undefined) comp.losses.defense = 0;
    comp.raidCooldowns = ensureObject(comp.raidCooldowns, {});
    if (!Array.isArray(comp.pendingRaids)) comp.pendingRaids = [];
  }

  // ── Missions ───────────────────────────────────────────────────────────────────
  if (!merged.missions) merged.missions = structuredClone(DEFAULT_STATE.missions);
  if (!merged.missions.daily)   merged.missions.daily   = { reset: 0, progress: {}, claimed: [] };
  if (!merged.missions.weekly)  merged.missions.weekly  = { reset: 0, progress: {}, claimed: [] };
  if (!merged.missions.hourly)  merged.missions.hourly  = { reset: 0, slots: [], baseline: {}, claimed: [] };
  if (!Array.isArray(merged.missions.completed)) merged.missions.completed = [];

  // ── Agents ─────────────────────────────────────────────────────────────────────
  for (const agent of merged.agents) {
    if (agent.notifyCaptures === undefined) agent.notifyCaptures = true;
    // ── Purge champs Darkrai/perks hérités (schema v9 → v10) ──────────
    delete agent.perkLevels;
    delete agent.pendingPerk;
    delete agent.perks;
    // Migrate legacy behavior string → 3 independent flags
    if (agent.autoCombat === undefined) {
      const b = agent.behavior || 'all';
      agent.autoCombat  = b === 'all' || b === 'combat';
      agent.autoRaid    = b === 'all' || b === 'combat';
      agent.autoCapture = b === 'all' || b === 'capture';
    }
    if (agent.autoRaid    === undefined) agent.autoRaid    = agent.autoCombat ?? true;
    if (agent.autoCapture === undefined) agent.autoCapture = true;
    // Migrer preferredBall → ball (cosmétique uniquement)
    if (!agent.ball && agent.preferredBall) { agent.ball = agent.preferredBall; }
    if (!agent.ball) agent.ball = 'pokeball';
    delete agent.preferredBall;
    // v2 alpha — compteur de captures par agent
    if (agent.captureCount === undefined) agent.captureCount = 0;
    // alpha — énergie agent
    if (agent.energy        === undefined) agent.energy        = 10;
    if (agent.maxEnergy     === undefined) agent.maxEnergy     = 10;
    if (agent.resting       === undefined) agent.resting       = false;
    if (agent.restUntil     === undefined) agent.restUntil     = null;
    if (agent.lastEnergyReset === undefined) agent.lastEnergyReset = 0;
  }

  // ── Pokémons ───────────────────────────────────────────────────────────────────
  for (const p of merged.pokemons) {
    const species = SPECIES_BY_EN?.[p.species_en];
    if (!p.species_fr)             p.species_fr  = species?.fr  || p.species_en;
    if (p.dex       === undefined) p.dex         = species?.dex ?? 0;
    if (p.assignedTo === undefined) p.assignedTo = null;
    if (p.cooldown  === undefined) p.cooldown    = 0;
    if (p.homesick  === undefined) p.homesick    = false;
    if (p.favorite  === undefined) p.favorite    = false;
    if (p.xp        === undefined) p.xp          = 0;
    if (!Array.isArray(p.history)) p.history     = [];
    // pcVariance — variance individuelle [0.90, 1.10] stable par Pokémon.
    // Pokémon existants : valeur déterministe depuis l'ID (jamais re-rollée).
    if (p.pcVariance === undefined) p.pcVariance = _pcVarianceFromId(p.id);
  }

  // ── Œufs ────────────────────────────────────────────────────────────────────────
  for (const egg of merged.eggs) {
    if (egg.incubating === undefined) {
      egg.incubating = false;
      egg.hatchAt = null;
    }
    if (!egg.rarity) egg.rarity = SPECIES_BY_EN?.[egg.species_en]?.rarity || 'common';
  }
  if (!merged.inventory.incubator) merged.inventory.incubator = 0;

  // ── Pension : migration slotA/slotB → slots[] ──────────────────────────────────────
  if (!Array.isArray(merged.pension.slots)) {
    // Convertir l'ancien format slotA/slotB (présents dans la save v5/v6)
    const a = merged.pension.slotA;
    const b = merged.pension.slotB;
    merged.pension.slots = [a, b].filter(id => typeof id === 'string' && id.length > 0);
    delete merged.pension.slotA;
    delete merged.pension.slotB;
  }
  if (merged.pension.extraSlotsPurchased === undefined) merged.pension.extraSlotsPurchased = 0;

  // ── Purchases ───────────────────────────────────────────────────────────────────
  // Purge flag Darkrai/perks (schema v9 → v10)
  delete merged.purchases.agentPerkMigrated;
  if (merged.purchases.cosmeticsPanel    === undefined) merged.purchases.cosmeticsPanel    = false;
  if (merged.purchases.autoIncubator     === undefined) merged.purchases.autoIncubator     = false;
  if (merged.purchases.autoCollect       === undefined) merged.purchases.autoCollect       = false;
  if (merged.purchases.autoCollectEnabled === undefined) merged.purchases.autoCollectEnabled = true;
  if (merged.purchases.chromaCharm       === undefined) merged.purchases.chromaCharm       = false;
  if (merged.purchases.scientist         === undefined) merged.purchases.scientist         = false;
  if (merged.purchases.scientistEnabled  === undefined) merged.purchases.scientistEnabled  = true;
  if (merged.purchases.autoSellAgent     === undefined) merged.purchases.autoSellAgent     = false;
  if (merged.purchases.autoSellAgentEnabled === undefined) merged.purchases.autoSellAgentEnabled = true;
  if (merged.purchases.autoSellEggs      === undefined) merged.purchases.autoSellEggs      = false;
  if (merged.purchases.mysteryEggCount  === undefined) merged.purchases.mysteryEggCount  = 0;
  if (merged.purchases.johtoUnlocked    === undefined) merged.purchases.johtoUnlocked    = false;
  if (merged.purchases.hoennUnlocked    === undefined) merged.purchases.hoennUnlocked    = false;
  if (merged.purchases.sinnohUnlocked   === undefined) merged.purchases.sinnohUnlocked   = false;

  // trainingRoom extraSlots
  if (merged.trainingRoom.extraSlots === undefined) merged.trainingRoom.extraSlots = 0;

  // ── Inventory : items légendaires ─────────────────────────────────────────────
  if (merged.inventory.meteore      === undefined) merged.inventory.meteore      = 0;
  if (merged.inventory.sigle_magma  === undefined) merged.inventory.sigle_magma  = 0;
  if (merged.inventory.sceau_aqua   === undefined) merged.inventory.sceau_aqua   = 0;
  if (merged.inventory.silver_wing  === undefined) merged.inventory.silver_wing  = 0;
  if (merged.inventory.rainbow_wing === undefined) merged.inventory.rainbow_wing = 0;
  if (merged.inventory.cristal_bete  === undefined) merged.inventory.cristal_bete  = 0;
  if (merged.inventory.rapport_sylphe === undefined) merged.inventory.rapport_sylphe = 0;
  if (merged.inventory.plume_sacree  === undefined) merged.inventory.plume_sacree  = 0;

  // ── Groudon Mission ────────────────────────────────────────────────────────────
  if (!merged.groudonMission || typeof merged.groudonMission !== 'object') {
    merged.groudonMission = structuredClone(DEFAULT_STATE.groudonMission);
  } else {
    const gm = merged.groudonMission;
    if (gm.active           === undefined) gm.active           = false;
    if (gm.step             === undefined) gm.step             = 0;
    if (gm.magmaFightsWon   === undefined) gm.magmaFightsWon   = 0;
    if (gm.hideoutFightsWon === undefined) gm.hideoutFightsWon = 0;
    if (gm.adminDefeated    === undefined) gm.adminDefeated    = false;
    if (gm.maxieDefeated    === undefined) gm.maxieDefeated    = false;
    if (gm.groudonOwned     === undefined) gm.groudonOwned     = false;
    if (gm.totalCaptures    === undefined) gm.totalCaptures    = 0;
  }

  // ── Kyogre Mission ─────────────────────────────────────────────────────────────
  if (!merged.kyogreMission || typeof merged.kyogreMission !== 'object') {
    merged.kyogreMission = structuredClone(DEFAULT_STATE.kyogreMission);
  } else {
    const km = merged.kyogreMission;
    if (km.active           === undefined) km.active           = false;
    if (km.step             === undefined) km.step             = 0;
    if (km.aquaFightsWon    === undefined) km.aquaFightsWon    = 0;
    if (km.hideoutFightsWon === undefined) km.hideoutFightsWon = 0;
    if (km.adminDefeated    === undefined) km.adminDefeated    = false;
    if (km.archieDefeated   === undefined) km.archieDefeated   = false;
    if (km.kyogreOwned      === undefined) km.kyogreOwned      = false;
    if (km.totalCaptures    === undefined) km.totalCaptures    = 0;
  }

  // ── Deoxys Mission ─────────────────────────────────────────────────────────────
  if (!merged.deoxysMission || typeof merged.deoxysMission !== 'object') {
    merged.deoxysMission = structuredClone(DEFAULT_STATE.deoxysMission);
  } else {
    const dm = merged.deoxysMission;
    if (dm.active           === undefined) dm.active           = false;
    if (dm.step             === undefined) dm.step             = 0;
    if (dm.trainersDefeated === undefined) dm.trainersDefeated = 0;
    if (dm.labFightsWon     === undefined) dm.labFightsWon     = 0;
    if (dm.labBossDefeated  === undefined) dm.labBossDefeated  = false;
    if (dm.deoxysOwned      === undefined) dm.deoxysOwned      = false;
    if (dm.totalCaptures    === undefined) dm.totalCaptures    = 0;
  }

  // ── Bêtes Sacrées Mission ──────────────────────────────────────────────────────
  if (!merged.betesMission || typeof merged.betesMission !== 'object') {
    merged.betesMission = structuredClone(DEFAULT_STATE.betesMission);
  } else {
    const bm = merged.betesMission;
    if (bm.active          === undefined) bm.active          = false;
    if (bm.step            === undefined) bm.step            = 0;
    if (bm.rocketFightsWon === undefined) bm.rocketFightsWon = 0;
    if (bm.hqFightsWon     === undefined) bm.hqFightsWon     = 0;
    if (bm.petrelDefeated  === undefined) bm.petrelDefeated  = false;
    if (bm.arianaDefeated  === undefined) bm.arianaDefeated  = false;
    if (bm.chosenBeast     === undefined) bm.chosenBeast     = null;
    if (bm.beastOwned      === undefined) bm.beastOwned      = false;
    if (bm.totalCaptures   === undefined) bm.totalCaptures   = 0;
  }

  // ── Lugia Mission ─────────────────────────────────────────────────────────────
  if (!merged.lugiaMission || typeof merged.lugiaMission !== 'object') {
    merged.lugiaMission = structuredClone(DEFAULT_STATE.lugiaMission);
  } else {
    const lm = merged.lugiaMission;
    if (lm.active          === undefined) lm.active          = false;
    if (lm.step            === undefined) lm.step            = 0;
    if (lm.marineFightsWon === undefined) lm.marineFightsWon = 0;
    if (lm.silverWings     === undefined) lm.silverWings     = 0;
    if (lm.eusineDefeated  === undefined) lm.eusineDefeated  = false;
    if (lm.whirlFightsWon  === undefined) lm.whirlFightsWon  = 0;
    if (lm.lugiaOwned      === undefined) lm.lugiaOwned      = false;
    if (lm.totalCaptures   === undefined) lm.totalCaptures   = 0;
  }

  // ── Ho-Oh Mission ─────────────────────────────────────────────────────────────
  if (!merged.hoohMission || typeof merged.hoohMission !== 'object') {
    merged.hoohMission = structuredClone(DEFAULT_STATE.hoohMission);
  } else {
    const hm = merged.hoohMission;
    if (hm.active          === undefined) hm.active          = false;
    if (hm.step            === undefined) hm.step            = 0;
    if (hm.ruralFightsWon  === undefined) hm.ruralFightsWon  = 0;
    if (hm.rainbowWings    === undefined) hm.rainbowWings    = 0;
    if (hm.kimonoDefeated  === undefined) hm.kimonoDefeated  = false;
    if (hm.tinFightsWon    === undefined) hm.tinFightsWon    = 0;
    if (hm.hoohOwned       === undefined) hm.hoohOwned       = false;
    if (hm.totalCaptures   === undefined) hm.totalCaptures   = 0;
  }

  // ── Birds Mission ─────────────────────────────────────────────────────────────
  if (!merged.birdsMission || typeof merged.birdsMission !== 'object') {
    merged.birdsMission = structuredClone(DEFAULT_STATE.birdsMission);
  } else {
    const birds = DEFAULT_STATE.birdsMission;
    for (const key of ['articuno', 'zapdos', 'moltres']) {
      if (!merged.birdsMission[key] || typeof merged.birdsMission[key] !== 'object') {
        merged.birdsMission[key] = structuredClone(birds[key]);
      } else {
        const b = merged.birdsMission[key];
        if (b.active       === undefined) b.active       = false;
        if (b.step         === undefined) b.step         = 0;
        if (b.fightsWon    === undefined) b.fightsWon    = 0;
        if (b.bossDefeated === undefined) b.bossDefeated = false;
        if (b.owned        === undefined) b.owned        = false;
        if (b.captures     === undefined) b.captures     = 0;
      }
    }
  }

  // ── Mewtwo Mission ────────────────────────────────────────────────────────────
  if (!merged.mewtwoMission || typeof merged.mewtwoMission !== 'object') {
    merged.mewtwoMission = structuredClone(DEFAULT_STATE.mewtwoMission);
  } else {
    const mm = merged.mewtwoMission;
    if (mm.active            === undefined) mm.active            = false;
    if (mm.step              === undefined) mm.step              = 0;
    if (mm.rocketFightsWon   === undefined) mm.rocketFightsWon   = 0;
    if (mm.rapportSylphe     === undefined) mm.rapportSylphe     = 0;
    if (mm.mansionFightsWon  === undefined) mm.mansionFightsWon  = 0;
    if (mm.giovanniDefeated  === undefined) mm.giovanniDefeated  = false;
    if (mm.mewtwoOwned       === undefined) mm.mewtwoOwned       = false;
    if (mm.totalCaptures     === undefined) mm.totalCaptures     = 0;
  }

  // ── Sinnoh inventory items ────────────────────────────────────────────────────
  if (merged.inventory.fragment_temporel === undefined) merged.inventory.fragment_temporel = 0;
  if (merged.inventory.onde_distorsion   === undefined) merged.inventory.onde_distorsion   = 0;
  if (merged.inventory.cristal_lac       === undefined) merged.inventory.cristal_lac       = 0;

  // ── Galaxie Mission (Dialga/Palkia) ──────────────────────────────────────────
  if (!merged.galaxieMission || typeof merged.galaxieMission !== 'object') {
    merged.galaxieMission = structuredClone(DEFAULT_STATE.galaxieMission);
  } else {
    const gx = merged.galaxieMission;
    if (gx.active            === undefined) gx.active            = false;
    if (gx.step              === undefined) gx.step              = 0;
    if (gx.galacticFightsWon === undefined) gx.galacticFightsWon = 0;
    if (gx.marsDefeated      === undefined) gx.marsDefeated      = false;
    if (gx.jupiterDefeated   === undefined) gx.jupiterDefeated   = false;
    if (gx.spearFightsWon    === undefined) gx.spearFightsWon    = 0;
    if (gx.cyrusDefeated     === undefined) gx.cyrusDefeated     = false;
    if (gx.chosenLegend      === undefined) gx.chosenLegend      = null;
    if (gx.legendOwned       === undefined) gx.legendOwned       = false;
    if (gx.totalCaptures     === undefined) gx.totalCaptures     = 0;
  }

  // ── Giratina Mission ──────────────────────────────────────────────────────────
  if (!merged.giratinaMission || typeof merged.giratinaMission !== 'object') {
    merged.giratinaMission = structuredClone(DEFAULT_STATE.giratinaMission);
  } else {
    const gtm = merged.giratinaMission;
    if (gtm.active            === undefined) gtm.active            = false;
    if (gtm.step              === undefined) gtm.step              = 0;
    if (gtm.turnbackFightsWon === undefined) gtm.turnbackFightsWon = 0;
    if (gtm.saturnDefeated    === undefined) gtm.saturnDefeated    = false;
    if (gtm.giratinaOwned     === undefined) gtm.giratinaOwned     = false;
    if (gtm.totalCaptures     === undefined) gtm.totalCaptures     = 0;
  }

  // ── Lake Mission (Uxie/Mesprit/Azelf) ────────────────────────────────────────
  if (!merged.lakeMission || typeof merged.lakeMission !== 'object') {
    merged.lakeMission = structuredClone(DEFAULT_STATE.lakeMission);
  } else {
    const lk = DEFAULT_STATE.lakeMission;
    for (const key of ['uxie', 'mesprit', 'azelf']) {
      if (!merged.lakeMission[key] || typeof merged.lakeMission[key] !== 'object') {
        merged.lakeMission[key] = structuredClone(lk[key]);
      } else {
        const l = merged.lakeMission[key];
        if (l.active    === undefined) l.active    = false;
        if (l.step      === undefined) l.step      = 0;
        if (l.fightsWon === undefined) l.fightsWon = 0;
        if (l.owned     === undefined) l.owned     = false;
        if (l.captures  === undefined) l.captures  = 0;
      }
    }
  }

  // ── Agents : slots par rang (v10 → v11) ──────────────────────────────────────────
  // Avant v11 : slots déterminés par captureCount (0/50/150 → 1/2/3).
  // Depuis v11 : slots déterminés par rang (grunt=1, sergent=2, lieutenant+=3).
  // On tronque les équipes pour ne garder que les slots autorisés par le nouveau système.
  // Les Pokémon retirés ne sont pas supprimés du PC — ils restent dans pokemons[].
  {
    const _rankSlots = { grunt: 1, sergent: 2 };
    for (const agent of merged.agents) {
      const maxSlots = _rankSlots[agent.title] ?? 3;
      if (Array.isArray(agent.team) && agent.team.length > maxSlots) {
        agent.team = agent.team.slice(0, maxSlots);
      }
    }
  }

  // ── Intégrité : nettoyer les IDs obsolètes ───────────────────────────────────────
  const allIds    = new Set(merged.pokemons.map(p => p.id));
  const agentIds  = new Set(merged.agents.map(a => a.id));
  merged.trainingRoom.pokemon = (merged.trainingRoom.pokemon || []).filter(id => allIds.has(id));

  // Résoudre les conflits d'affectation : priorité équipe > pension > formation
  {
    const teamSet = new Set(merged.gang.bossTeam || []);
    merged.pension.slots = (merged.pension.slots || []).filter(id => !teamSet.has(id));
    const resolvedPension = new Set(merged.pension.slots);
    merged.trainingRoom.pokemon = (merged.trainingRoom.pokemon || []).filter(
      id => !teamSet.has(id) && !resolvedPension.has(id),
    );
  }

  // ── Zones : reconstruire assignedAgents + flag unlocked ────────────────────────────
  // agent.assignedZone est la source de vérité ; zone.assignedAgents est un cache dérivé.
  // On vide et reconstruit pour éviter les IDs fantômes (agents supprimés, migrations, etc.)
  if (merged.zones && typeof merged.zones === 'object') {
    for (const zs of Object.values(merged.zones)) {
      if (!Array.isArray(zs.assignedAgents)) zs.assignedAgents = [];
      else zs.assignedAgents = zs.assignedAgents.filter(id => agentIds.has(id)); // purge fantômes
      // Migration flag unlocked depuis l'activité historique
      if (zs.unlocked === undefined) {
        zs.unlocked = (zs.combatsWon > 0 || zs.captures > 0 || zs.invested === true);
      }
      // Cleanup système "zone contestée" retiré — supprimer les anciens champs
      delete zs.lossStreak;
      delete zs.contested;
      delete zs.reclaimWins;
    }
    // Rebuild assignedAgents depuis agent.assignedZone (source de vérité)
    for (const agent of merged.agents) {
      if (agent.assignedZone && merged.zones[agent.assignedZone]) {
        const zs = merged.zones[agent.assignedZone];
        if (!zs.assignedAgents.includes(agent.id)) zs.assignedAgents.push(agent.id);
      }
    }
  }

  // ── Limites : valeurs hors-limites → MissingNo reward ──────────────────────────────
  const LIMITS = { incubator: 10 };
  let limitViolation = false;
  for (const [item, max] of Object.entries(LIMITS)) {
    if ((merged.inventory[item] || 0) > max) {
      merged.inventory[item] = max;
      limitViolation = true;
    }
  }
  for (const pk of merged.pokemons) {
    if ((pk.potential || 1) > 5) { pk.potential = 5; limitViolation = true; }
    if ((pk.level     || 1) > 100) { pk.level   = 100; limitViolation = true; }
  }
  if (limitViolation && !merged.pokemons.some(p => p.species_en === 'missingno')) {
    merged.pokemons.push({
      id: uid(),
      species_en: 'missingno',
      species_fr: 'MissingNo',
      dex: 0,
      level: 1,
      xp: 0,
      potential: 1,
      shiny: false,
      history: [{ type: 'migration_reward', ts: now() }],
      moves: ['Morphing', 'Psyko', 'Métronome', 'Surf'],
    });
    merged._limitViolationReward = true;
  }

  merged._schemaVersion = SAVE_SCHEMA_VERSION;
  return merged;
}

// ── getMigrationSummary ──────────────────────────────────────────────────────────
export function getMigrationSummary(saved, deps) {
  const { SAVE_SCHEMA_VERSION } = deps;
  if (!saved || saved._schemaVersion === SAVE_SCHEMA_VERSION) return null;

  const fromVersion = saved._schemaVersion ?? saved.version ?? 'inconnue';
  const fields = [];
  if (!saved.behaviourLogs)       fields.push('Logs comportementaux');
  if (saved.settings?.spriteMode === undefined && saved.settings?.classicSprites === undefined) fields.push('Option sprites');
  if (!saved.eggs)                fields.push('Système d\'\u0153ufs');
  if (!saved.pension)             fields.push('Pension');
  if (!saved.trainingRoom)        fields.push('Salle d\'entraînement');
  if (!saved.missions)            fields.push('Missions');
  if (!saved.cosmetics)           fields.push('Cosmétiques');
  if (!saved.purchases?.scientist) fields.push('Scientifique peu scrupuleux');
  if (!saved.purchases?.autoSellAgent) fields.push('Vente auto agents');
  if (!saved.gang?.bossTeamSlots) fields.push('Slots d\'\u00e9quipe boss (×3)');
  if (!saved.purchases?.mysteryEggCount) fields.push('Compteur œufs mystère');

  return { from: `schéma v${fromVersion}`, fields };
}
