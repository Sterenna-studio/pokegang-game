'use strict';

function ensureObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

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

  const merged = {
    ...structuredClone(DEFAULT_STATE),
    ...saved,
  };

  merged.gang = { ...structuredClone(DEFAULT_STATE.gang), ...ensureObject(saved.gang) };
  merged.inventory = { ...structuredClone(DEFAULT_STATE.inventory), ...ensureObject(saved.inventory) };
  merged.stats = { ...structuredClone(DEFAULT_STATE.stats), ...ensureObject(saved.stats) };
  merged.settings = { ...structuredClone(DEFAULT_STATE.settings), ...ensureObject(saved.settings) };
  merged.activeBoosts = { ...structuredClone(DEFAULT_STATE.activeBoosts), ...ensureObject(saved.activeBoosts) };
  merged.discoveryProgress = { ...structuredClone(DEFAULT_STATE.discoveryProgress), ...ensureObject(saved.discoveryProgress) };
  merged.trainingRoom = { ...structuredClone(DEFAULT_STATE.trainingRoom), ...ensureObject(saved.trainingRoom) };
  merged.cosmetics = { ...structuredClone(DEFAULT_STATE.cosmetics), ...ensureObject(saved.cosmetics) };
  merged.lab = { ...structuredClone(DEFAULT_STATE.lab), ...ensureObject(saved.lab) };
  merged.pension = { ...structuredClone(DEFAULT_STATE.pension), ...ensureObject(saved.pension) };
  merged.purchases = { ...structuredClone(DEFAULT_STATE.purchases), ...ensureObject(saved.purchases) };

  if (!merged.behaviourLogs) merged.behaviourLogs = structuredClone(DEFAULT_STATE.behaviourLogs);
  if (!merged.behaviourLogs.tabViewCounts) merged.behaviourLogs.tabViewCounts = {};

  if (merged.settings.discoveryMode === undefined) merged.settings.discoveryMode = false;
  if (merged.settings.autoBuyBall === undefined) merged.settings.autoBuyBall = null;
  if (merged.settings.classicSprites === undefined) merged.settings.classicSprites = false;
  if (merged.settings.uiScale === undefined) merged.settings.uiScale = 100;
  if (merged.settings.musicVol === undefined) merged.settings.musicVol = 50;
  if (merged.settings.sfxVol === undefined) merged.settings.sfxVol = 80;
  if (merged.settings.zoneScale === undefined) merged.settings.zoneScale = 100;
  if (merged.settings.lightTheme === undefined) merged.settings.lightTheme = false;
  if (merged.settings.lowSpec === undefined) merged.settings.lowSpec = false;
  if (!merged.settings.sfxIndividual) merged.settings.sfxIndividual = {};

  merged.activeEvents = ensureObject(saved.activeEvents, {});
  if (!merged.marketSales) merged.marketSales = {};
  if (!Array.isArray(merged.favorites)) merged.favorites = [];
  if (!Array.isArray(merged.favoriteZones)) merged.favoriteZones = [];
  if (!Array.isArray(merged.eggs)) merged.eggs = [];
  if (!Array.isArray(merged.pokemons)) merged.pokemons = [];
  if (!Array.isArray(merged.agents)) merged.agents = [];
  if (!Array.isArray(merged.unlockedTitles)) merged.unlockedTitles = ['recrue', 'fondateur'];

  if (!merged.gang.bossTeam) merged.gang.bossTeam = [];
  if (!merged.gang.showcase) merged.gang.showcase = [null, null, null];
  if (!merged.gang.titleA) merged.gang.titleA = 'recrue';
  if (merged.gang.titleB === undefined) merged.gang.titleB = null;
  if (merged.gang.titleLiaison === undefined) merged.gang.titleLiaison = '';
  if (merged.gang.titleC === undefined) merged.gang.titleC = null;
  if (merged.gang.titleD === undefined) merged.gang.titleD = null;

  if (!merged.missions) merged.missions = structuredClone(DEFAULT_STATE.missions);
  if (!merged.missions.daily) merged.missions.daily = { reset: 0, progress: {}, claimed: [] };
  if (!merged.missions.weekly) merged.missions.weekly = { reset: 0, progress: {}, claimed: [] };
  if (!merged.missions.hourly) merged.missions.hourly = { reset: 0, slots: [], baseline: {}, claimed: [] };
  if (!Array.isArray(merged.missions.completed)) merged.missions.completed = [];

  // ── Migration grades agents (v2) ────────────────────────────
  // Ancien système : grunt / lieutenant / captain
  // Nouveau système : grunt / sergent / lieutenant / commandant / elite / general
  if (!merged.stats.agentsEliteCount) merged.stats.agentsEliteCount = 0;

  for (const agent of merged.agents) {
    if (agent.notifyCaptures === undefined) agent.notifyCaptures = true;
    if (!Array.isArray(agent.perkLevels)) agent.perkLevels = [];
    if (agent.pendingPerk === undefined) agent.pendingPerk = false;

    // ── Nouveau système stat points ──────────────────────────────
    // baseStats = snapshot des stats actuelles (inclut anciens perks baked in)
    if (!agent.baseStats) {
      agent.baseStats = { capture: agent.stats.capture, combat: agent.stats.combat, luck: agent.stats.luck };
    }
    if (!agent.allocatedStats) agent.allocatedStats = { capture: 0, combat: 0, luck: 0 };
    if (agent.statPoints === undefined) {
      // Convertir un éventuel pendingPerk en 1 pt
      agent.statPoints = agent.pendingPerk ? 1 : 0;
      agent.pendingPerk = false;
    }
    if (!agent.preferredBall) agent.preferredBall = 'pokeball';
    if (!agent.behavior)      agent.behavior      = 'all';

    // Convertir l'ancien grade 'captain' → 'commandant'
    if (agent.title === 'captain') agent.title = 'commandant';

    // Recalcul des promotions manquantes selon le niveau actuel
    // (ex : un grunt lv.60 doit être promu sergent + lieutenant)
    const lvl = agent.level || 1;
    const CHAIN = [
      { from: 'grunt',      to: 'sergent',    lvl: 25 },
      { from: 'sergent',    to: 'lieutenant', lvl: 50 },
      { from: 'lieutenant', to: 'commandant', lvl: 75 },
    ];
    for (const step of CHAIN) {
      if (agent.title === step.from && lvl >= step.lvl) {
        agent.title = step.to;
      }
    }
    // Palier 100 : si commandant niveau 100 sans grade élite/général encore affecté
    if (agent.title === 'commandant' && lvl >= 100) {
      if (merged.stats.agentsEliteCount < 4) {
        agent.title = 'elite';
        merged.stats.agentsEliteCount++;
      } else {
        agent.title = 'general';
      }
    }
  }

  for (const p of merged.pokemons) {
    const species = SPECIES_BY_EN?.[p.species_en];
    if (!p.species_fr) p.species_fr = species?.fr || p.species_en;
    if (p.dex === undefined) p.dex = species?.dex ?? 0;
    if (p.assignedTo === undefined) p.assignedTo = null;
    if (p.cooldown === undefined) p.cooldown = 0;
    if (p.homesick === undefined) p.homesick = false;
    if (p.favorite === undefined) p.favorite = false;
    if (p.xp === undefined) p.xp = 0;
    if (!Array.isArray(p.history)) p.history = [];
  }

  for (const egg of merged.eggs) {
    if (egg.incubating === undefined) {
      egg.incubating = false;
      egg.hatchAt = null;
    }
    if (!egg.rarity) egg.rarity = SPECIES_BY_EN?.[egg.species_en]?.rarity || 'common';
  }

  if (!merged.inventory.incubator) merged.inventory.incubator = 0;
  // ── playerStats ───────────────────────────────────────────────
  if (!merged.playerStats) {
    merged.playerStats = {
      baseStats:      { combat: 10, capture: 10, luck: 5 },
      allocatedStats: { combat: 0,  capture: 0,  luck: 0  },
      statPoints: 0,
      pointsGrantedCount: 0,
    };
  }
  if (!merged.playerStats.baseStats)      merged.playerStats.baseStats      = { combat: 10, capture: 10, luck: 5 };
  if (!merged.playerStats.allocatedStats) merged.playerStats.allocatedStats = { combat: 0, capture: 0, luck: 0 };
  if (merged.playerStats.statPoints      === undefined) merged.playerStats.statPoints      = 0;
  if (merged.playerStats.pointsGrantedCount === undefined) merged.playerStats.pointsGrantedCount = 0;

  if (merged.purchases.cosmeticsPanel === undefined) merged.purchases.cosmeticsPanel = false;
  if (merged.purchases.autoIncubator === undefined) merged.purchases.autoIncubator = false;
  if (merged.purchases.chromaCharm === undefined) merged.purchases.chromaCharm = false;

  const allIds = new Set(merged.pokemons.map(p => p.id));
  merged.trainingRoom.pokemon = (merged.trainingRoom.pokemon || []).filter(id => allIds.has(id));

  {
    const teamSet = new Set(merged.gang.bossTeam || []);
    if (merged.pension.slotA && teamSet.has(merged.pension.slotA)) merged.pension.slotA = null;
    if (merged.pension.slotB && teamSet.has(merged.pension.slotB)) merged.pension.slotB = null;
    const pensionSet = new Set([merged.pension.slotA, merged.pension.slotB].filter(Boolean));
    merged.trainingRoom.pokemon = (merged.trainingRoom.pokemon || []).filter(id => !teamSet.has(id) && !pensionSet.has(id));
  }

  const LEGENDARY_CONVERT = new Set(['lugia', 'ho-oh']);
  const legendaryFound = merged.pokemons.filter(pk => LEGENDARY_CONVERT.has(pk.species_en));
  if (legendaryFound.length > 0) {
    merged.pokemons = merged.pokemons.filter(pk => !LEGENDARY_CONVERT.has(pk.species_en));
    merged.gang.bossTeam = (merged.gang.bossTeam || []).filter(id => !legendaryFound.some(p => p.id === id));
    merged.inventory = merged.inventory || {};
    for (const pk of legendaryFound) {
      if (pk.species_en === 'lugia') merged.inventory.silver_wing = (merged.inventory.silver_wing || 0) + 2;
      else merged.inventory.rainbow_wing = (merged.inventory.rainbow_wing || 0) + 2;
    }
    merged._gen2MigrationCount = legendaryFound.length;
  }

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
    if ((pk.level || 1) > 100) { pk.level = 100; limitViolation = true; }
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

  // Initialiser dexCaught depuis le pokédex existant si absent ou à 0
  if (!merged.stats.dexCaught) {
    merged.stats.dexCaught = Object.values(merged.pokedex || {}).filter(e => e.caught).length;
  }

  // ── Migration schema v8 : intégrité Pokédex ──────────────────
  // Pour les anciennes saves, s'assurer que chaque Pokémon possédé
  // est bien marqué caught/seen dans le Pokédex, et que le flag
  // shiny n'est jamais rétrogradé (seen/caught/shiny = historiques).
  if ((saved?._schemaVersion ?? 0) < 8) {
    for (const pk of merged.pokemons || []) {
      const en = pk.species_en;
      if (!en) continue;
      if (!merged.pokedex[en]) merged.pokedex[en] = { seen: false, caught: false, shiny: false, count: 0 };
      merged.pokedex[en].caught = true;
      merged.pokedex[en].seen   = true;
      merged.pokedex[en].count  = (merged.pokedex[en].count || 0) + 1;
      if (pk.shiny) merged.pokedex[en].shiny = true;
    }
    // Recalcul shinyCaught — only correct upward
    const ownedShiny = (merged.pokemons || []).filter(p => p.shiny).length;
    if ((merged.stats.shinyCaught || 0) < ownedShiny) merged.stats.shinyCaught = ownedShiny;
    // Recalcul dexCaught
    merged.stats.dexCaught = Object.values(merged.pokedex || {}).filter(e => e.caught).length;
  }

  merged._schemaVersion = SAVE_SCHEMA_VERSION;
  return merged;
}

export function getMigrationSummary(saved, deps) {
  const { SAVE_SCHEMA_VERSION } = deps;
  const fromVersion = saved?._schemaVersion ?? saved?.version ?? 'inconnue';
  const needsMigration = saved?._schemaVersion !== SAVE_SCHEMA_VERSION;
  if (!saved || !needsMigration) return null;

  const fields = [];
  if (!saved.behaviourLogs) fields.push('Logs comportementaux');
  if (saved.discoveryProgress?.agentsUnlocked === undefined) fields.push('Progression découverte étendue');
  if (saved.settings?.classicSprites === undefined) fields.push('Option sprites');
  if (!saved.eggs) fields.push('Système d\'œufs');
  if (!saved.pension) fields.push('Pension');
  if (!saved.trainingRoom) fields.push('Salle d\'entraînement');
  if (!saved.missions) fields.push('Missions');
  if (!saved.cosmetics) fields.push('Cosmétiques');

  return {
    from: `schéma v${fromVersion}`,
    fields,
  };
}
