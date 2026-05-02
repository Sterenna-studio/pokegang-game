// ════════════════════════════════════════════════════════════════
//  STATE MANAGEMENT MODULE
//  Persistence, migration and import/export helpers extracted from app.js.
//  Runtime dependencies are injected by app.js to avoid circular imports.
// ════════════════════════════════════════════════════════════════

'use strict';

export const MAX_HISTORY = 30;

export function slimPokemon(p) {
  const s = { ...p };
  delete s.species_fr;
  delete s.dex;
  if (s.assignedTo === null)  delete s.assignedTo;
  if (s.cooldown   === 0)     delete s.cooldown;
  if (s.homesick   === false) delete s.homesick;
  if (s.favorite   === false) delete s.favorite;
  if (s.xp         === 0)     delete s.xp;
  if (s.history && s.history.length > MAX_HISTORY) s.history = s.history.slice(-MAX_HISTORY);
  if (!s.history || s.history.length === 0) delete s.history;
  return s;
}

export function saveState(ctx) {
  const state = ctx.getState();
  if (!state.marketSales) state.marketSales = {};
  ctx.setPlayerWasActive?.(true);

  if (state.sessionStart) {
    state.playtime = (state.playtime || 0) + Math.floor((Date.now() - state.sessionStart) / 1000);
    state.sessionStart = Date.now();
  }

  state._savedAt = Date.now();

  const slim = ctx.slimPokemon || slimPokemon;
  const payload = { ...state, pokemons: state.pokemons.map(slim) };
  const data = JSON.stringify(payload);

  try {
    ctx.localStorage.setItem(ctx.getSaveKey(), data);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      ctx.notify('⚠ Save trop volumineuse — historiques supprimés', 'error');
      const emergency = JSON.parse(data);
      for (const p of emergency.pokemons) delete p.history;
      try { ctx.localStorage.setItem(ctx.getSaveKey(), JSON.stringify(emergency)); } catch {}
    }
  }
}

export function formatPlaytime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}

export function loadState(ctx) {
  let raw = ctx.localStorage.getItem(ctx.getSaveKey());
  let legacyKey = null;

  if (!raw) {
    for (const key of ctx.LEGACY_SAVE_KEYS) {
      const legacy = ctx.localStorage.getItem(key);
      if (legacy) { raw = legacy; legacyKey = key; break; }
    }
  }

  if (!raw) return null;
  try {
    const saved = JSON.parse(raw);
    const fromVersion = saved._schemaVersion ?? saved.version ?? 'inconnue';
    const needsMigration = legacyKey || (saved._schemaVersion !== ctx.SAVE_SCHEMA_VERSION);
    const migrated = migrate(ctx, saved);

    if (needsMigration) {
      ctx.setMigrationResult?.({
        from: legacyKey ? `clé ${legacyKey}` : `schéma v${fromVersion}`,
        toLegacyKey: legacyKey,
        fields: getMigrationFields(saved),
      });

      if (legacyKey) {
        try { ctx.localStorage.removeItem(legacyKey); } catch {}
      }
    } else {
      ctx.setMigrationResult?.(null);
    }

    migrated._schemaVersion = ctx.SAVE_SCHEMA_VERSION;
    return migrated;
  } catch (e) {
    console.error('[PokéForge] Erreur loadState() — save corrompue ou illisible :', e);
    return null;
  }
}

export function migrate(ctx, saved) {
  const { DEFAULT_STATE, SAVE_SCHEMA_VERSION, SPECIES_BY_EN } = ctx;
  const uid = ctx.uid || (() => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

  if (!saved.version) saved.version = '6.0.0';
  const merged = { ...structuredClone(DEFAULT_STATE), ...saved };
  merged.gang = { ...structuredClone(DEFAULT_STATE.gang), ...saved.gang };
  merged.inventory = { ...structuredClone(DEFAULT_STATE.inventory), ...saved.inventory };
  merged.stats = { ...structuredClone(DEFAULT_STATE.stats), ...saved.stats };
  merged.settings = { ...structuredClone(DEFAULT_STATE.settings), ...saved.settings };
  merged.discoveryProgress = { ...structuredClone(DEFAULT_STATE.discoveryProgress), ...(saved.discoveryProgress || {}) };
  if (!merged.behaviourLogs) merged.behaviourLogs = { firstCombatAt:0, firstCaptureAt:0, firstPurchaseAt:0, firstAgentAt:0, firstMissionAt:0, tabViewCounts:{} };
  if (!merged.behaviourLogs.tabViewCounts) merged.behaviourLogs.tabViewCounts = {};
  if (merged.settings.discoveryMode === undefined) merged.settings.discoveryMode = false;
  if (merged.settings.autoBuyBall === undefined) merged.settings.autoBuyBall = null;
  if (merged.settings.spriteMode === undefined) {
    merged.settings.spriteMode = merged.settings.classicSprites ? 'gen5' : 'local';
  }
  delete merged.settings.classicSprites;
  if (merged.settings.autoEvoChoice  === undefined) merged.settings.autoEvoChoice  = false;
  merged.activeBoosts = { ...structuredClone(DEFAULT_STATE.activeBoosts), ...(saved.activeBoosts || {}) };
  merged.activeEvents = saved.activeEvents || {};
  if (!merged.gang.bossTeam) merged.gang.bossTeam = [];
  if (!merged.gang.showcase) merged.gang.showcase = [];
  while (merged.gang.showcase.length < 6) merged.gang.showcase.push(null);
  if (!merged.gang.bossTeamSlots) merged.gang.bossTeamSlots = [[...(merged.gang.bossTeam || [])], [], []];
  if (merged.gang.activeBossTeamSlot === undefined) merged.gang.activeBossTeamSlot = 0;
  if (!merged.gang.bossTeamSlotsPurchased) merged.gang.bossTeamSlotsPurchased = [true, false, false];
  merged.gang.bossTeam = [...(merged.gang.bossTeamSlots[merged.gang.activeBossTeamSlot] || [])];
  if (!merged.unlockedTitles) merged.unlockedTitles = ['recrue', 'fondateur'];
  if (!merged.gang.titleA) merged.gang.titleA = 'recrue';
  if (merged.gang.titleB === undefined) merged.gang.titleB = null;
  if (merged.gang.titleLiaison === undefined) merged.gang.titleLiaison = '';
  if (merged.gang.titleC === undefined) merged.gang.titleC = null;
  if (merged.gang.titleD === undefined) merged.gang.titleD = null;
  if (!merged.marketSales) merged.marketSales = {};
  if (!merged.favorites) merged.favorites = [];

  for (const agent of (merged.agents || [])) {
    if (agent.notifyCaptures === undefined) agent.notifyCaptures = true;
  }

  for (const p of (merged.pokemons || [])) {
    const sp = SPECIES_BY_EN[p.species_en];
    if (!p.species_fr)              p.species_fr  = sp?.fr  || p.species_en;
    if (p.dex === undefined)        p.dex         = sp?.dex ?? 0;
    if (p.assignedTo === undefined) p.assignedTo  = null;
    if (p.cooldown   === undefined) p.cooldown    = 0;
    if (p.homesick   === undefined) p.homesick    = false;
    if (p.favorite   === undefined) p.favorite    = false;
    if (p.xp         === undefined) p.xp          = 0;
    if (!p.history)                 p.history     = [];
  }

  if (!merged.missions) {
    merged.missions = structuredClone(DEFAULT_STATE.missions);
  }
  if (!merged.missions.daily) merged.missions.daily = { reset: 0, progress: {}, claimed: [] };
  if (!merged.missions.weekly) merged.missions.weekly = { reset: 0, progress: {}, claimed: [] };
  if (!merged.missions.completed) merged.missions.completed = [];
  if (!merged.missions.hourly) merged.missions.hourly = { reset: 0, slots: [], baseline: {}, claimed: [] };

  if (!merged.trainingRoom) merged.trainingRoom = structuredClone(DEFAULT_STATE.trainingRoom);
  merged.trainingRoom = { ...structuredClone(DEFAULT_STATE.trainingRoom), ...merged.trainingRoom };
  if (!merged.cosmetics) merged.cosmetics = { gameBg: null, bossBg: null, unlockedBgs: [] };
  if (!merged.lab) merged.lab = { trackedSpecies: [] };
  if (!merged.lab.trackedSpecies) merged.lab.trackedSpecies = [];
  if (!merged.purchases) merged.purchases = { translator: false, mysteryEggCount: 0 };
  if (merged.purchases.mysteryEggCount === undefined) merged.purchases.mysteryEggCount = 0;
  if (merged.purchases.cosmeticsPanel === undefined) merged.purchases.cosmeticsPanel = false;
  if (merged.purchases.autoIncubator === undefined) merged.purchases.autoIncubator = false;
  if (merged.purchases.autoCollect === undefined) merged.purchases.autoCollect = false;
  if (merged.purchases.autoCollectEnabled === undefined) merged.purchases.autoCollectEnabled = true;
  if (merged.purchases.autoSellAgentEnabled === undefined) merged.purchases.autoSellAgentEnabled = true;
  if (merged.purchases.chromaCharm === undefined) merged.purchases.chromaCharm = false;
  if (merged.purchases.scientist === undefined) merged.purchases.scientist = false;
  if (merged.purchases.scientistEnabled === undefined) merged.purchases.scientistEnabled = true;
  if (merged.purchases.autoSellAgent === undefined) merged.purchases.autoSellAgent = false;
  if (merged.purchases.autoSellEggs === undefined) merged.purchases.autoSellEggs = false;
  if (merged.purchases.autoSellEggsEnabled === undefined) merged.purchases.autoSellEggsEnabled = true;
  if (!merged.settings.autoSellAgent) merged.settings.autoSellAgent = { mode: 'all', potentials: [] };
  if (!merged.settings.autoSellEggs) merged.settings.autoSellEggs = { mode: 'all', potentials: [], allowShiny: false };
  if (merged.autoSellAgentSettings) { Object.assign(merged.settings.autoSellAgent, merged.autoSellAgentSettings); delete merged.autoSellAgentSettings; }
  if (merged.autoSellEggsSettings)  { Object.assign(merged.settings.autoSellEggs,  merged.autoSellEggsSettings);  delete merged.autoSellEggsSettings; }
  merged.playerStats = {
    ...structuredClone(DEFAULT_STATE.playerStats),
    ...(merged.playerStats || {}),
  };
  merged.playerStats.baseStats = {
    ...structuredClone(DEFAULT_STATE.playerStats.baseStats),
    ...(merged.playerStats.baseStats || {}),
  };
  merged.playerStats.allocatedStats = {
    ...structuredClone(DEFAULT_STATE.playerStats.allocatedStats),
    ...(merged.playerStats.allocatedStats || {}),
  };
  if (merged.playerStats.statPoints === undefined) merged.playerStats.statPoints = 0;
  if (merged.playerStats.pointsGrantedCount === undefined) merged.playerStats.pointsGrantedCount = 0;
  if (!merged.favoriteZones) merged.favoriteZones = [];
  if (merged.settings.uiScale === undefined) merged.settings.uiScale = 100;
  if (merged.settings.musicVol === undefined) merged.settings.musicVol = 50;
  if (merged.settings.sfxVol === undefined)   merged.settings.sfxVol   = 80;
  if (merged.settings.zoneScale === undefined) merged.settings.zoneScale = 100;
  if (merged.settings.lightTheme === undefined) merged.settings.lightTheme = false;
  if (merged.settings.lowSpec === undefined)   merged.settings.lowSpec  = false;
  if (!merged.settings.sfxIndividual)          merged.settings.sfxIndividual = {};

  if (!merged.pension) merged.pension = { slots: [], extraSlotsPurchased: 0, eggAt: null };
  if (merged.pension.slotA !== undefined || merged.pension.slotB !== undefined) {
    merged.pension.slots = [merged.pension.slotA, merged.pension.slotB].filter(Boolean);
    delete merged.pension.slotA;
    delete merged.pension.slotB;
  }

  if (merged.pension.extraSlotsPurchased === undefined) merged.pension.extraSlotsPurchased = 0;
  if (!merged.eggs) merged.eggs = [];
  for (const egg of merged.eggs) {
    if (egg.incubating === undefined) {
      egg.incubating = false;
      egg.hatchAt = null;
    }
    if (!egg.rarity) egg.rarity = SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
  }
  if (!merged.inventory.incubator) merged.inventory.incubator = 0;

  for (const agent of (merged.agents || [])) {
    if (!agent.perkLevels) agent.perkLevels = [];
    if (agent.pendingPerk === undefined) agent.pendingPerk = false;
  }

  merged.pokemons.forEach(p => { if (p.homesick === undefined) p.homesick = false; });

  const allIds = new Set((merged.pokemons || []).map(p => p.id));
  merged.trainingRoom.pokemon = (merged.trainingRoom.pokemon || []).filter(id => allIds.has(id));
  {
    const teamSet = new Set(merged.gang.bossTeam || []);
    merged.pension.slots = (merged.pension.slots || []).filter(id => !teamSet.has(id));
    const resolvedPension = new Set(merged.pension.slots || []);
    merged.trainingRoom.pokemon = (merged.trainingRoom.pokemon || []).filter(id => !teamSet.has(id) && !resolvedPension.has(id));
  }

  const LIMITS = { incubator: 10 };
  let limitViolation = false;
  for (const [item, max] of Object.entries(LIMITS)) {
    if ((merged.inventory[item] || 0) > max) {
      merged.inventory[item] = max;
      limitViolation = true;
    }
  }
  for (const pk of merged.pokemons || []) {
    if ((pk.potential || 1) > 5) { pk.potential = 5; limitViolation = true; }
    if ((pk.level || 1) > 100)   { pk.level = 100; limitViolation = true; }
  }
  if (limitViolation && !(merged.pokemons || []).some(p => p.species_en === 'missingno')) {
    const reward = { id: uid(), species_en:'missingno', species_fr:'MissingNo', dex:0,
      level:1, xp:0, potential:1, shiny:false, history:[{ type:'migration_reward', ts:Date.now() }],
      moves:['Morphing','Psyko','Métronome','Surf'] };
    merged.pokemons = merged.pokemons || [];
    merged.pokemons.push(reward);
    merged._limitViolationReward = true;
  }

  merged._schemaVersion = SAVE_SCHEMA_VERSION;
  return merged;
}

export function exportSave(ctx) {
  const blob = new Blob([JSON.stringify(ctx.getState(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pokeforge-v6-save-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importSave(ctx, file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const raw = JSON.parse(e.target.result);
      if (!raw || typeof raw !== 'object' || (!raw.gang && !raw.pokemons)) {
        ctx.notify('Import échoué — fichier invalide ou non-reconnu.', 'error');
        return;
      }
      ctx.openImportPreviewModal(raw);
    } catch {
      ctx.notify('Import échoué — fichier JSON invalide.', 'error');
    }
  };
  reader.readAsText(file);
}

function getMigrationFields(saved) {
  const fields = [];
  if (!saved.behaviourLogs)       fields.push('Logs comportementaux');
  if (saved.discoveryProgress?.agentsUnlocked === undefined)
                                 fields.push('Progression découverte étendue');
  if (saved.settings?.spriteMode === undefined && saved.settings?.classicSprites === undefined) fields.push('Option sprites');
  if (!saved.eggs)                fields.push('Système d\'œufs');
  if (!saved.pension)             fields.push('Pension');
  if (!saved.trainingRoom)        fields.push('Salle d\'entraînement');
  if (!saved.missions)            fields.push('Missions');
  if (!saved.cosmetics)           fields.push('Cosmétiques');
  return fields;
}
