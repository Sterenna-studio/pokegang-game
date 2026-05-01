'use strict';

// ── Helper ───────────────────────────────────────────────────────────────────
function ensureObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
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
  merged.stats        = { ...structuredClone(DEFAULT_STATE.stats),        ...ensureObject(saved.stats) };
  merged.settings     = { ...structuredClone(DEFAULT_STATE.settings),     ...ensureObject(saved.settings) };
  merged.activeBoosts = { ...structuredClone(DEFAULT_STATE.activeBoosts), ...ensureObject(saved.activeBoosts) };
  merged.discoveryProgress = { ...structuredClone(DEFAULT_STATE.discoveryProgress), ...ensureObject(saved.discoveryProgress) };
  merged.trainingRoom = { ...structuredClone(DEFAULT_STATE.trainingRoom), ...ensureObject(saved.trainingRoom) };
  merged.cosmetics    = { ...structuredClone(DEFAULT_STATE.cosmetics),    ...ensureObject(saved.cosmetics) };
  merged.lab          = { ...structuredClone(DEFAULT_STATE.lab),          ...ensureObject(saved.lab) };
  merged.purchases    = { ...structuredClone(DEFAULT_STATE.purchases),    ...ensureObject(saved.purchases) };
  merged.pension      = { ...structuredClone(DEFAULT_STATE.pension),      ...ensureObject(saved.pension) };
  merged.activeEvents = ensureObject(saved.activeEvents, {});

  // ── behaviourLogs ──────────────────────────────────────────────────────────
  if (!merged.behaviourLogs) merged.behaviourLogs = structuredClone(DEFAULT_STATE.behaviourLogs);
  if (!merged.behaviourLogs.tabViewCounts) merged.behaviourLogs.tabViewCounts = {};

  // ── Settings guards ──────────────────────────────────────────────────────────
  // Nouveau joueur → discovery ON ; joueur existant sans ce champ → OFF
  if (merged.settings.discoveryMode === undefined) merged.settings.discoveryMode = false;
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
  // Migration clés legacy top-level si présentes (placement erroné temporaire)
  if (merged.autoSellAgentSettings) { Object.assign(merged.settings.autoSellAgent, merged.autoSellAgentSettings); delete merged.autoSellAgentSettings; }
  if (merged.autoSellEggsSettings)  { Object.assign(merged.settings.autoSellEggs,  merged.autoSellEggsSettings);  delete merged.autoSellEggsSettings;  }

  // ── Tableaux de base ─────────────────────────────────────────────────────────────
  if (!merged.marketSales)              merged.marketSales  = {};
  if (!Array.isArray(merged.favorites)) merged.favorites    = [];
  if (!Array.isArray(merged.favoriteZones)) merged.favoriteZones = [];
  if (!Array.isArray(merged.eggs))      merged.eggs         = [];
  if (!Array.isArray(merged.pokemons))  merged.pokemons     = [];
  if (!Array.isArray(merged.agents))    merged.agents       = [];
  if (!Array.isArray(merged.unlockedTitles)) merged.unlockedTitles = ['recrue', 'fondateur'];

  // ── Gang ─────────────────────────────────────────────────────────────────────
  if (!merged.gang.bossTeam) merged.gang.bossTeam = [];
  if (!merged.gang.showcase) merged.gang.showcase = [];
  while (merged.gang.showcase.length < 6) merged.gang.showcase.push(null);
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

  // ── Missions ───────────────────────────────────────────────────────────────────
  if (!merged.missions) merged.missions = structuredClone(DEFAULT_STATE.missions);
  if (!merged.missions.daily)   merged.missions.daily   = { reset: 0, progress: {}, claimed: [] };
  if (!merged.missions.weekly)  merged.missions.weekly  = { reset: 0, progress: {}, claimed: [] };
  if (!merged.missions.hourly)  merged.missions.hourly  = { reset: 0, slots: [], baseline: {}, claimed: [] };
  if (!Array.isArray(merged.missions.completed)) merged.missions.completed = [];

  // ── Agents ─────────────────────────────────────────────────────────────────────
  for (const agent of merged.agents) {
    if (agent.notifyCaptures === undefined) agent.notifyCaptures = true;
    if (!Array.isArray(agent.perkLevels)) agent.perkLevels = [];
    if (agent.pendingPerk === undefined) agent.pendingPerk = false;
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
  if (merged.purchases.mysteryEggCount   === undefined) merged.purchases.mysteryEggCount   = 0;

  // trainingRoom extraSlots
  if (merged.trainingRoom.extraSlots === undefined) merged.trainingRoom.extraSlots = 0;

  // ── Intégrité : nettoyer les IDs obsolètes ───────────────────────────────────────
  const allIds = new Set(merged.pokemons.map(p => p.id));
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
  if (saved.discoveryProgress?.agentsUnlocked === undefined) fields.push('Progression découverte étendue');
  if (saved.settings?.spriteMode === undefined && saved.settings?.classicSprites === undefined) fields.push('Option sprites');
  if (!saved.eggs)                fields.push('Système d\'œufs');
  if (!saved.pension)             fields.push('Pension');
  if (!saved.trainingRoom)        fields.push('Salle d\'entraînement');
  if (!saved.missions)            fields.push('Missions');
  if (!saved.cosmetics)           fields.push('Cosmétiques');
  if (!saved.purchases?.scientist) fields.push('Scientifique peu scrupuleux');
  if (!saved.purchases?.autoSellAgent) fields.push('Vente auto agents');
  if (!saved.gang?.bossTeamSlots) fields.push('Slots d\'équipe boss (×3)');
  if (!saved.purchases?.mysteryEggCount) fields.push('Compteur œufs mystère');

  return { from: `schéma v${fromVersion}`, fields };
}
