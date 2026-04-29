// ============================================================
// POKEFORGE v6 — Gang Wars  (vanilla JS, single-file engine)
// ============================================================

'use strict';

import './modules/secretCodes.js';
import './modules/systems/llm.js';
import './modules/systems/missions.js';
import './modules/systems/market.js';
import './modules/systems/agent.js';
import './modules/systems/sessionObjectives.js';
import './modules/systems/trainingRoom.js';
import './modules/systems/pension.js';
import './modules/systems/zoneSystem.js';
import './modules/ui/zoneWindows.js';
import './modules/ui/gangBase.js';
import {
  renderZoneSelector    as _zsRenderSelector,
  refreshZoneTile       as _zsRefreshTile,
  refreshZoneIncomeTile as _zsRefreshIncome,
  refreshAllFogTiles    as _zsRefreshAllTiles,
  updateZoneButtons     as _zsUpdateButtons,
  bindZoneActionButtons as _zsBindActions,
  showZoneContextMenu   as _zsShowCtxMenu,
} from './modules/ui/zoneSelector.js';

import { POKEDEX_DESC } from './data/pokedex-desc.js';
import { ZONE_BGS, COSMETIC_BGS } from './data/zones-visuals-data.js';
import { MISSIONS, HOURLY_QUEST_POOL } from './data/missions-data.js';
import { TRAINER_TYPES } from './data/trainers-data.js';
import { getDexDesc, buildSpeciesNameMaps } from './data/dex-helpers.js';
import { BALLS, SHOP_ITEMS, MYSTERY_EGG_BASE_COST, MYSTERY_EGG_POOL, MYSTERY_EGG_HATCH_MS, POTENTIAL_MULT, BASE_PRICE, getMysteryEggCost as computeMysteryEggCost } from './data/economy-data.js';
import { NATURES, NATURE_KEYS, BOSS_SPRITES, AGENT_NAMES_M, AGENT_NAMES_F, AGENT_SPRITES, AGENT_PERSONALITIES, TITLE_REQUIREMENTS, TITLE_BONUSES, AGENT_RANK_LABELS, RANK_CHAIN } from './data/game-config-data.js';
import { I18N } from './data/i18n-data.js';
import { ZONE_BG_URL, GYM_ORDER } from './data/zones-config-data.js';
import { HOURLY_QUEST_REROLL_COST, BOOST_DURATIONS } from './data/gameplay-config-data.js';
import { SPECIAL_TRAINER_KEYS, MAX_COMBAT_REWARD } from './data/combat-config-data.js';
import { FALLBACK_TRAINER_SVG, FALLBACK_POKEMON_SVG, BALL_SPRITES, ITEM_SPRITE_URLS, CHEST_SPRITE_URL } from './data/assets-data.js';
import { TRANSLATOR_PHRASES_FR } from './data/flavor-data.js';

// ════════════════════════════════════════════════════════════════
//  1.  CONFIG & CONSTANTS
// ════════════════════════════════════════════════════════════════

// Secret code logic moved to modules/secretCodes.js
// Exposes _mkTitleExec, SECRET_CODES, checkSecretCode and showRewardChoicePopup on globalThis.

// Pokédex descriptions moved to data/pokedex-desc.js

// Dex helper logic moved to data/dex-helpers.js

// FR→EN / EN→FR name maps moved to data/dex-helpers.js
const { FR_TO_EN, EN_TO_FR } = buildSpeciesNameMaps(POKEMON_GEN1);

// ── Constantes Pokédex ─────────────────────────────────────────
// Pokédex Kanto = les 151 espèces originales (dex 1–151) + MissingNo (dex 0, caché)
const KANTO_DEX_SIZE    = 151;
// Pokédex National = toutes les espèces non-cachées disponibles dans le jeu
const NATIONAL_DEX_SIZE = POKEMON_GEN1.filter(s => !s.hidden).length;

// Helpers de comptage — centralisés ici pour éviter la duplication partout dans l'UI
function getDexKantoCaught()   { return POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151 && state.pokedex[s.en]?.caught).length; }
function getDexNationalCaught(){ return POKEMON_GEN1.filter(s => !s.hidden && state.pokedex[s.en]?.caught).length; }
// Nombre d'espèces UNIQUES avec au moins un exemplaire chromatique (≠ shinyCaught qui compte les doublons)
function getShinySpeciesCount(){ return POKEMON_GEN1.filter(s => !s.hidden && state.pokedex[s.en]?.shiny).length; }

// Nature config moved to data/game-config-data.js

// Zone visuals/config moved to data/zones-visuals-data.js and data/zones-config-data.js

// Gym unlock order moved to data/zones-config-data.js

// → Moved to data/zones-data.js
// Applique le mapping aux objets de zone
Object.entries(ZONE_MUSIC_MAP).forEach(([id, track]) => {
  if (ZONE_BY_ID[id]) ZONE_BY_ID[id].music = track;
});

// Mission data moved to data/missions-data.js
// Hourly quest reroll cost moved to data/gameplay-config-data.js

// Trainer/combat config moved to data/trainers-data.js and data/combat-config-data.js

// Economy/shop config moved to data/economy-data.js
function getMysteryEggCost() {
  return computeMysteryEggCost(state);
}

// Game config moved to data/game-config-data.js

// I18N dictionary moved to data/i18n-data.js

function t(key, vars = {}) {
  const entry = I18N[key];
  if (!entry) return key;
  let str = entry[state.lang] || entry.fr || key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}

// ════════════════════════════════════════════════════════════════
//  2.  STATE MANAGEMENT
// ════════════════════════════════════════════════════════════════

// ── App version — bump on every deploy to force client reload ──
const APP_VERSION = '2.2.0';
const GAME_VERSION = 'v0.1 — pre-alpha';

const SAVE_KEYS = ['pokeforge.v6', 'pokeforge.v6.s2', 'pokeforge.v6.s3'];
let activeSaveSlot = Math.min(2, parseInt(localStorage.getItem('pokeforge.activeSlot') || '0'));
let SAVE_KEY = SAVE_KEYS[activeSaveSlot];

// ── Versionnage du schéma de save ────────────────────────────────────────────
// Incrémenter à chaque ajout de champ majeur pour déclencher le banner migration.
const SAVE_SCHEMA_VERSION = 8;

// Anciennes clés localStorage (versions antérieures à v6)
const LEGACY_SAVE_KEYS = ['pokeforge.v5', 'pokeforge.v4', 'pokeforge.v3', 'pokeforge.v2', 'pokeforge.v1', 'pokeforge'];

// Résultat de migration exposé au boot pour afficher le banner
let _migrationResult = null; // null | { from: string, fields: string[] }

const DEFAULT_STATE = {
  version: '6.0.0',
  _schemaVersion: SAVE_SCHEMA_VERSION,
  lang: 'fr',
  gang: {
    name: 'Team ???',
    bossName: 'Boss',
    bossSprite: '',
    bossZone: null, // the zone the boss is currently in
    bossTeam: [], // array of up to 3 pokemon IDs for boss combat (mirrors activeBossTeamSlot)
    bossTeamSlots: [[], [], []], // 3 saved team configurations
    activeBossTeamSlot: 0,       // which slot is currently active (0/1/2)
    bossTeamSlotsPurchased: [true, false, false], // slot 2 costs 500k, slot 3 costs 1M
    showcase: [null, null, null, null, null, null],
    reputation: 0,
    money: 5000,
    initialized: false,
    titleA: 'recrue',
    titleB: null,
    titleLiaison: '',
    titleC: null,
    titleD: null,
  },
  inventory: {
    pokeball: 50,
    greatball: 0,
    ultraball: 0,
    duskball: 0,
    lure: 0,
    superlure: 0,
    potion: 0,
    incense: 2,
    rarescope: 1,
    aura: 0,
    evostone: 0,
    rarecandy: 0,
    masterball: 0,
    incubator: 0,
    egg_scanner: 0,
  },
  activeBall: 'pokeball',
  activeBoosts: {
    incense:   0, // timestamp when expires (0 = inactive)
    rarescope: 0,
    aura:      0,
    lure:      0,
    superlure: 0,
    chestBoost:0,
  },
  pokemons: [],
  agents: [],
  zones: {},
  pokedex: {},
  activeEvents: {}, // zoneId -> { eventId, expiresAt, data }
  missions: {
    completed: [],
    daily:  { reset: 0, progress: {}, claimed: [] },
    weekly: { reset: 0, progress: {}, claimed: [] },
    hourly: { reset: 0, slots: [], baseline: {}, claimed: [] },
  },
  stats: {
    totalCaught: 0,
    totalSold: 0,
    totalFights: 0,
    totalFightsWon: 0,
    totalMoneyEarned: 0,
    totalMoneySpent: 0,
    shinyCaught: 0,
    rocketDefeated: 0,
    chestsOpened: 0,
    eventsCompleted: 0,
    eggsHatched: 0,
    blueDefeated: 0,
  },
  settings: {
    llmEnabled: false,
    llmProvider: 'none',
    llmUrl: 'http://localhost:11434',
    llmModel: 'llama3',
    llmApiKey: '',
    sfxEnabled: true,
    musicVol: 50,
    uiScale: 100,
    musicEnabled: false,
    sfxVol: 80,
    zoneScale: 100,
    lightTheme: false,
    lowSpec: false,
    sfxIndividual: {},
    autoCombat: true,
    discoveryMode: true,
    autoBuyBall: null,  // null | 'pokeball' | 'greatball' | 'ultraball'
    spriteMode: 'local',   // 'local'|'gen1'|'gen2'|'gen3'|'gen4'|'gen5'|'ani'|'dex'|'home'
    autoEvoChoice: false,  // true = évolution multi choisie automatiquement (aléatoire, sans popup)
    autoSellAgent: {       // vente auto à la capture agent (après achat purchases.autoSellAgent)
      mode: 'all',         // 'all' | 'by_potential'
      potentials: [],      // potentials ciblés si mode === 'by_potential'
    },
    autoSellEggs: {        // vente auto des œufs éclots (après achat purchases.autoSellEggs)
      mode: 'all',         // 'all' | 'by_potential'
      potentials: [],
      allowShiny: false,   // autoriser la vente de chromatiques
    },
  },
  log: [],
  marketSales: {}, // { [species_en]: { count, lastSale } } — supply/demand
  favorites: [],   // array of pokemon IDs marked as favorite
  trainingRoom: {
    pokemon: [],      // up to 6 pokemon IDs training here
    log: [],          // recent training events
    level: 1,         // room upgrade level
    lastFight: null,  // timestamp du dernier combat d'entraînement
  },
  _savedAt: 0,       // timestamp de la dernière sauvegarde
  cosmetics: {
    gameBg: null,       // CSS gradient/color for game background
    bossBg: null,       // CSS for boss panel background
    unlockedBgs: [],    // IDs of unlocked cosmetic backgrounds
  },
  lab: {
    trackedSpecies: [], // espèces suivies dans le tracker du labo
  },
  purchases: {
    translator: false,
    cosmeticsPanel: false,    // 50 000₽ — débloque l'onglet Cosmétiques
    autoIncubator: false,     // 300 000₽ — Infirmière Joëlle corrompue (auto-incubation)
    autoCollectEnabled: true, // toggle on/off après achat
    autoCollect: false,       // 100 000₽ — Récolte automatique (skip combat animation)
    chromaCharm: false,       // Gagné à 10 000 000₽ — taux shiny ×2
    scientist: false,         // 5 000 000₽ — Scientifique peu scrupuleux
    autoSellAgent: false,     // 10 000 000₽ — Vente auto à la capture agent
    autoSellEggs: false,      // 5 000 000₽ — Vente auto des œufs éclots
  },
  pension: {
    slots: [],              // array of pokemon IDs (2 base + up to 4 extra purchased)
    extraSlotsPurchased: 0, // 0–4 extra slots (each costs progressively more)
    eggAt: null,            // timestamp when next egg generates
  },
  eggs: [],         // [{ id, species_en, hatchAt, potential, shiny }]
  playtime: 0,      // secondes de jeu total
  sessionStart: 0,  // timestamp début session
  openZoneOrder: [],
  favoriteZones: [], // zones ouvertes automatiquement au chargement
  claimedCodes: {},
  discoveryProgress: {
    marketUnlocked: false,
    pokedexUnlocked: false,
    missionsUnlocked: false,
    agentsUnlocked: false,
    battleLogUnlocked: false,
    cosmeticsUnlocked: false,
  },
  behaviourLogs: {
    firstCombatAt: 0,
    firstCaptureAt: 0,
    firstPurchaseAt: 0,
    firstAgentAt: 0,
    firstMissionAt: 0,
    tabViewCounts: {},
  },
};

let state = structuredClone(DEFAULT_STATE);
globalThis.state = state;


const MAX_HISTORY = 30; // cap des entrées d'historique par Pokémon (anti-QuotaExceeded)

// ── Sérialisation slim des pokémons ──────────────────────────────────────────
// On ne touche PAS les objets en mémoire : on crée un clone allégé pour la save.
// Champs supprimés : dérivables au runtime (species_fr, dex) + valeurs par défaut
// (assignedTo=null, cooldown=0, homesick=false, favorite=false, xp=0).
// Gain moyen : ~35% sur la section pokemons soit ~20-25% sur la save totale.
function slimPokemon(p) {
  const s = { ...p };
  // Dérivable depuis species_en via SPECIES_BY_EN
  delete s.species_fr;
  delete s.dex;
  // Valeurs par défaut — omises pour gagner de la place
  if (s.assignedTo === null)  delete s.assignedTo;
  if (s.cooldown   === 0)     delete s.cooldown;
  if (s.homesick   === false) delete s.homesick;
  if (s.favorite   === false) delete s.favorite;
  if (s.xp         === 0)     delete s.xp;
  // History : cap + suppression si vide
  if (s.history && s.history.length > MAX_HISTORY) s.history = s.history.slice(-MAX_HISTORY);
  if (!s.history || s.history.length === 0) delete s.history;
  return s;
}

function saveState() {
  globalThis.state = state; // keep modules in sync
  if (!state.marketSales) state.marketSales = {}; // guard: toujours initialisé
  _playerWasActive = true; // signal leaderboard timer that the player is active

  // Playtime accumulation
  if (state.sessionStart) {
    state.playtime = (state.playtime || 0) + Math.floor((Date.now() - state.sessionStart) / 1000);
    state.sessionStart = Date.now();
  }

  state._savedAt = Date.now();

  // Sérialisation slim : les objets en mémoire restent intacts
  const payload = { ...state, pokemons: state.pokemons.map(slimPokemon) };
  const data = JSON.stringify(payload);

  try {
    localStorage.setItem(SAVE_KEY, data);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      notify('⚠ Save trop volumineuse — historiques supprimés', 'error');
      // Fallback : retirer tous les historiques
      const emergency = JSON.parse(data);
      for (const p of emergency.pokemons) delete p.history;
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(emergency)); } catch {}
    }
  }
  // Cloud sync : géré par le tick 5 min dans startGameLoop (pas ici)
}

function formatPlaytime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}

function loadState() {
  let raw = localStorage.getItem(SAVE_KEY);
  let legacyKey = null;

  // ── Détection save legacy (clés anciennes) ────────────────────────────────
  if (!raw) {
    for (const key of LEGACY_SAVE_KEYS) {
      const legacy = localStorage.getItem(key);
      if (legacy) { raw = legacy; legacyKey = key; break; }
    }
  }

  if (!raw) return null;
  try {
    const saved = JSON.parse(raw);
    const fromVersion = saved._schemaVersion ?? saved.version ?? 'inconnue';
    const needsMigration = legacyKey || (saved._schemaVersion !== SAVE_SCHEMA_VERSION);

    const migrated = migrate(saved);

    if (needsMigration) {
      // Lister les champs qui ont été ajoutés (présents dans DEFAULT_STATE mais absents du raw)
      const addedFields = [];
      if (!saved.behaviourLogs)       addedFields.push('Logs comportementaux');
      if (saved.discoveryProgress?.agentsUnlocked === undefined)
                                       addedFields.push('Progression découverte étendue');
      if (saved.settings?.spriteMode === undefined && saved.settings?.classicSprites === undefined) addedFields.push('Option sprites');
      if (!saved.eggs)                addedFields.push('Système d\'œufs');
      if (!saved.pension)             addedFields.push('Pension');
      if (!saved.trainingRoom)        addedFields.push('Salle d\'entraînement');
      if (!saved.missions)            addedFields.push('Missions');
      if (!saved.cosmetics)           addedFields.push('Cosmétiques');

      _migrationResult = {
        from: legacyKey ? `clé ${legacyKey}` : `schéma v${fromVersion}`,
        toLegacyKey: legacyKey,
        fields: addedFields,
      };

      // Si c'était une clé legacy, migrer dans la clé v6 et nettoyer l'ancienne
      if (legacyKey) {
        try { localStorage.removeItem(legacyKey); } catch {}
      }
    }

    // Stamper le schéma courant dans la save migrée
    migrated._schemaVersion = SAVE_SCHEMA_VERSION;
    return migrated;
  } catch (e) {
    console.error('[PokéForge] Erreur loadState() — save corrompue ou illisible :', e);
    return null;
  }
}

function migrate(saved) {
  if (!saved.version) saved.version = '6.0.0';
  const merged = { ...structuredClone(DEFAULT_STATE), ...saved };
  merged.gang = { ...structuredClone(DEFAULT_STATE.gang), ...saved.gang };
  merged.inventory = { ...structuredClone(DEFAULT_STATE.inventory), ...saved.inventory };
  merged.stats = { ...structuredClone(DEFAULT_STATE.stats), ...saved.stats };
  merged.settings = { ...structuredClone(DEFAULT_STATE.settings), ...saved.settings };
  // Migration: discoveryProgress — merge avec valeurs par défaut complètes
  merged.discoveryProgress = { ...structuredClone(DEFAULT_STATE.discoveryProgress), ...(saved.discoveryProgress || {}) };
  if (!merged.behaviourLogs) merged.behaviourLogs = { firstCombatAt:0, firstCaptureAt:0, firstPurchaseAt:0, firstAgentAt:0, firstMissionAt:0, tabViewCounts:{} };
  if (!merged.behaviourLogs.tabViewCounts) merged.behaviourLogs.tabViewCounts = {};
  // Nouveau joueur → découverte ON ; joueur existant sans ce champ → OFF (déjà habitué)
  if (merged.settings.discoveryMode === undefined) merged.settings.discoveryMode = false;
  if (merged.settings.autoBuyBall === undefined) merged.settings.autoBuyBall = null;
  // Migration classicSprites (bool) → spriteMode (string)
  if (merged.settings.spriteMode === undefined) {
    merged.settings.spriteMode = merged.settings.classicSprites ? 'gen5' : 'local';
  }
  delete merged.settings.classicSprites;
  if (merged.settings.autoEvoChoice  === undefined) merged.settings.autoEvoChoice  = false;
  merged.activeBoosts = { ...structuredClone(DEFAULT_STATE.activeBoosts), ...(saved.activeBoosts || {}) };
  merged.activeEvents = saved.activeEvents || {};
  // Migration: bossTeam + save slots
  if (!merged.gang.bossTeam) merged.gang.bossTeam = [];
  if (!merged.gang.showcase) merged.gang.showcase = [];
  while (merged.gang.showcase.length < 6) merged.gang.showcase.push(null);
  if (!merged.gang.bossTeamSlots) merged.gang.bossTeamSlots = [[...(merged.gang.bossTeam || [])], [], []];
  if (merged.gang.activeBossTeamSlot === undefined) merged.gang.activeBossTeamSlot = 0;
  if (!merged.gang.bossTeamSlotsPurchased) merged.gang.bossTeamSlotsPurchased = [true, false, false];
  // Keep bossTeam in sync with active slot
  merged.gang.bossTeam = [...(merged.gang.bossTeamSlots[merged.gang.activeBossTeamSlot] || [])];
  // Migration: titles
  if (!merged.unlockedTitles) merged.unlockedTitles = ['recrue', 'fondateur'];
  if (!merged.gang.titleA) merged.gang.titleA = 'recrue';
  if (merged.gang.titleB === undefined) merged.gang.titleB = null;
  if (merged.gang.titleLiaison === undefined) merged.gang.titleLiaison = '';
  if (merged.gang.titleC === undefined) merged.gang.titleC = null;
  if (merged.gang.titleD === undefined) merged.gang.titleD = null;
  // Migration: marketSales + favorites
  if (!merged.marketSales) merged.marketSales = {};
  if (!merged.favorites) merged.favorites = [];
  // Migration: agent notifyCaptures
  for (const agent of (merged.agents || [])) {
    if (agent.notifyCaptures === undefined) agent.notifyCaptures = true;
  }
  // Migration: pokemon history + favorite
  for (const p of (merged.pokemons || [])) {
    // Restituer les champs omis par slimPokemon()
    const sp = SPECIES_BY_EN[p.species_en];
    if (!p.species_fr)             p.species_fr  = sp?.fr  || p.species_en;
    if (p.dex === undefined)       p.dex         = sp?.dex ?? 0;
    if (p.assignedTo === undefined) p.assignedTo = null;
    if (p.cooldown   === undefined) p.cooldown   = 0;
    if (p.homesick   === undefined) p.homesick   = false;
    if (p.favorite   === undefined) p.favorite   = false;
    if (p.xp         === undefined) p.xp         = 0;
    if (!p.history)                p.history     = [];
  }
  // Migration: missions
  if (!merged.missions) {
    merged.missions = structuredClone(DEFAULT_STATE.missions);
  }
  if (!merged.missions.daily) merged.missions.daily = { reset: 0, progress: {}, claimed: [] };
  if (!merged.missions.weekly) merged.missions.weekly = { reset: 0, progress: {}, claimed: [] };
  if (!merged.missions.completed) merged.missions.completed = [];
  if (!merged.missions.hourly) merged.missions.hourly = { reset: 0, slots: [], baseline: {}, claimed: [] };
  // Migration: trainingRoom + cosmetics + purchases
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
  if (merged.purchases.chromaCharm === undefined) merged.purchases.chromaCharm = false;
  if (merged.purchases.scientist === undefined) merged.purchases.scientist = false;
  if (merged.purchases.autoSellAgent === undefined) merged.purchases.autoSellAgent = false;
  if (merged.purchases.autoSellEggs === undefined) merged.purchases.autoSellEggs = false;
  // Auto-sell config — nested under settings (consistent with sfxIndividual, etc.)
  if (!merged.settings.autoSellAgent) merged.settings.autoSellAgent = { mode: 'all', potentials: [] };
  if (!merged.settings.autoSellEggs) merged.settings.autoSellEggs = { mode: 'all', potentials: [], allowShiny: false };
  // Migrate legacy top-level keys if present (from a brief wrong placement)
  if (merged.autoSellAgentSettings) { Object.assign(merged.settings.autoSellAgent, merged.autoSellAgentSettings); delete merged.autoSellAgentSettings; }
  if (merged.autoSellEggsSettings)  { Object.assign(merged.settings.autoSellEggs,  merged.autoSellEggsSettings);  delete merged.autoSellEggsSettings; }
  if (!merged.favoriteZones) merged.favoriteZones = [];
  if (merged.settings.uiScale === undefined) merged.settings.uiScale = 100;
  if (merged.settings.musicVol === undefined) merged.settings.musicVol = 50;
  if (merged.settings.sfxVol === undefined)   merged.settings.sfxVol   = 80;
  if (merged.settings.zoneScale === undefined) merged.settings.zoneScale = 100;
  if (merged.settings.lightTheme === undefined) merged.settings.lightTheme = false;
  if (merged.settings.lowSpec === undefined)   merged.settings.lowSpec  = false;
  if (!merged.settings.sfxIndividual)          merged.settings.sfxIndividual = {};
  // Migration pension slotA/slotB → slots[]
  if (!merged.pension) merged.pension = { slots: [], extraSlotsPurchased: 0, eggAt: null };
  if (merged.pension.slotA !== undefined || merged.pension.slotB !== undefined) {
    // Convert legacy fields to array
    merged.pension.slots = [merged.pension.slotA, merged.pension.slotB].filter(Boolean);
    delete merged.pension.slotA;
    delete merged.pension.slotB;
  }

  if (merged.pension.extraSlotsPurchased === undefined) merged.pension.extraSlotsPurchased = 0;
  if (!merged.eggs) merged.eggs = [];
  // Migration: eggs need incubating flag; auto-hatching eggs get paused
  for (const egg of merged.eggs) {
    if (egg.incubating === undefined) {
      egg.incubating = false;
      egg.hatchAt = null; // require manual incubation
    }
    if (!egg.rarity) egg.rarity = SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
  }
  if (!merged.inventory.incubator) merged.inventory.incubator = 0;
  // Migration: agent perkLevels / pendingPerk
  for (const agent of (merged.agents || [])) {
    if (!agent.perkLevels) agent.perkLevels = [];
    if (agent.pendingPerk === undefined) agent.pendingPerk = false;
  }
  // Migration: homesick flag for imported pokemon
  merged.pokemons.forEach(p => { if (p.homesick === undefined) p.homesick = false; });
  // Clean up stale training room IDs (deleted pokemon)
  const allIds = new Set((merged.pokemons || []).map(p => p.id));
  merged.trainingRoom.pokemon = (merged.trainingRoom.pokemon || []).filter(id => allIds.has(id));
  // Résoudre les conflits d'affectation : priorité équipe > pension > formation
  {
    const teamSet = new Set(merged.gang.bossTeam || []);
    // Pension : retirer si aussi en équipe
    merged.pension.slots = (merged.pension.slots || []).filter(id => !teamSet.has(id));
    // Formation : retirer si en équipe ou en pension
    const resolvedPension = new Set(merged.pension.slots || []);
    merged.trainingRoom.pokemon = (merged.trainingRoom.pokemon || []).filter(id => !teamSet.has(id) && !resolvedPension.has(id));
  }
  // Migration Gen 2 retirée : Lugia et Ho-Oh sont des Pokémon légitimes capturables
  // via leurs zones dédiées (Îles Tourbillon / Victory Road) — conversion en ailes supprimée.

  // ── Migration limites : valeurs hors-limites → MissingNo reward ─
  // Limite incubateur = 10 (cohérent avec le shop qui bloque à owned >= 10)
  const LIMITS = { incubator: 10 };
  let limitViolation = false;
  for (const [item, max] of Object.entries(LIMITS)) {
    if ((merged.inventory[item] || 0) > max) {
      merged.inventory[item] = max;
      limitViolation = true;
    }
  }
  // Pokémon avec potential > 5 ou level > 100
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

  // Toujours stamper la version schéma courante
  merged._schemaVersion = SAVE_SCHEMA_VERSION;
  return merged;
}

function exportSave() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pokeforge-v6-save-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importSave(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const raw = JSON.parse(e.target.result);
      if (!raw || typeof raw !== 'object' || (!raw.gang && !raw.pokemons)) {
        notify('Import échoué — fichier invalide ou non-reconnu.', 'error'); return;
      }
      openImportPreviewModal(raw);
    } catch {
      notify('Import échoué — fichier JSON invalide.', 'error');
    }
  };
  reader.readAsText(file);
}

// ── Modal de prévisualisation + conversion d'import ──────────────────────────
function openImportPreviewModal(raw) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:20000;display:flex;align-items:center;justify-content:center;padding:16px';

  // ── Analyse de la save importée ──────────────────────────────────────────
  const schemaVer   = raw._schemaVersion ?? raw.version ?? '?';
  const isLegacy    = !raw.eggs || !raw.pension || !raw.trainingRoom;
  const isVeryOld   = !raw.gang || !raw.pokemons;
  const gangName    = raw.gang?.name    ?? '—';
  const bossName    = raw.gang?.bossName ?? '—';
  const reputation  = (raw.gang?.reputation ?? 0).toLocaleString();
  const money       = (raw.gang?.money ?? 0).toLocaleString();
  const pokeCount   = (raw.pokemons  || []).length;
  const agentCount  = (raw.agents    || []).length;
  const _dexRaw     = raw.pokedex || {};
  const dexKanto    = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151 && _dexRaw[s.en]?.caught).length;
  const dexCaught   = POKEMON_GEN1.filter(s => !s.hidden && _dexRaw[s.en]?.caught).length;
  const shinyCount  = POKEMON_GEN1.filter(s => !s.hidden && _dexRaw[s.en]?.shiny).length;
  const savedAt     = raw._savedAt ? new Date(raw._savedAt).toLocaleString('fr-FR') : '—';
  const playtime    = raw.playtime  ? formatPlaytime(raw.playtime) : '—';

  // ── Liste des champs qui seront ajoutés/migrés ───────────────────────────
  const migrations = [];
  if (!raw.eggs)             migrations.push('Système d\'œufs');
  if (!raw.pension)          migrations.push('Pension');
  if (!raw.trainingRoom)     migrations.push('Salle d\'entraînement');
  if (!raw.missions)         migrations.push('Missions');
  if (!raw.cosmetics)        migrations.push('Cosmétiques');
  if (!raw.unlockedTitles)   migrations.push('Titres débloqués');
  if (raw.gang?.titleC === undefined) migrations.push('Slots de titres (×4)');
  if (!raw.behaviourLogs)    migrations.push('Logs comportementaux');
  if (!raw.lab)              migrations.push('Laboratoire');
  if (!raw.purchases)        migrations.push('Achats spéciaux');
  if (!raw.eggs && !raw.inventory?.incubator) migrations.push('Inventaire incubateurs');
  if (raw.settings?.uiScale === undefined) migrations.push('Paramètres UI avancés');

  const migHtml = migrations.length
    ? migrations.map(m => `<div style="display:flex;gap:6px;align-items:center;font-size:8px;color:var(--text-dim)"><span style="color:var(--green)">✓</span>${m}</div>`).join('')
    : '<div style="font-size:8px;color:var(--green)">Aucune migration nécessaire — save à jour</div>';

  const versionBadge = isLegacy
    ? `<span style="font-size:7px;padding:2px 6px;border-radius:8px;background:rgba(255,160,0,.15);border:1px solid #ffa000;color:#ffa000">Version ancienne</span>`
    : `<span style="font-size:7px;padding:2px 6px;border-radius:8px;background:rgba(0,200,100,.1);border:1px solid var(--green);color:var(--green)">Format compatible</span>`;

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:24px;max-width:620px;width:100%;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;gap:16px">

      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-family:var(--font-pixel);font-size:11px;color:var(--gold)">📥 Importer une Save</div>
        <button id="btnImportClose" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

        <!-- Infos save importée -->
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim)">SAVE IMPORTÉE</div>
            ${versionBadge}
          </div>
          <div style="font-family:var(--font-pixel);font-size:12px;color:var(--red)">${gangName}</div>
          <div style="font-size:9px;color:var(--text-dim)">Boss : <span style="color:var(--text)">${bossName}</span></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:4px">
            <div style="font-size:8px;color:var(--text-dim)">🎯 Pokémon <span style="color:var(--text)">${pokeCount}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">👤 Agents <span style="color:var(--text)">${agentCount}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">⭐ Rép. <span style="color:var(--gold)">${reputation}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">₽ <span style="color:var(--text)">${money}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">📖 Kanto <span style="color:var(--text)">${dexKanto}/${KANTO_DEX_SIZE}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">🌐 National <span style="color:var(--text)">${dexCaught}/${NATIONAL_DEX_SIZE}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">✨ Espèces chromas <span style="color:var(--text)">${shinyCount}</span></div>
          </div>
          <div style="font-size:7px;color:var(--text-dim);border-top:1px solid var(--border);padding-top:6px;margin-top:2px">
            Sauvegardé le ${savedAt}<br>Temps de jeu : ${playtime} · Schéma v${schemaVer}
          </div>
        </div>

        <!-- Champs à migrer -->
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:6px">
          <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:4px">MIGRATION AUTOMATIQUE</div>
          ${migHtml}
        </div>
      </div>

      <!-- Avertissement écrasement -->
      <div style="background:rgba(204,51,51,.08);border:1px solid rgba(204,51,51,.3);border-radius:var(--radius-sm);padding:10px;font-size:9px;color:var(--text-dim)">
        ⚠ <b style="color:var(--red)">Import complet</b> : remplacera définitivement la save active (slot ${activeSaveSlot + 1}).
        Exporte d'abord ta save actuelle si tu veux la conserver.
      </div>

      <div style="display:flex;flex-direction:column;gap:8px">
        <button id="btnImportBackupFirst" style="font-family:var(--font-pixel);font-size:8px;padding:8px 12px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;text-align:left">
          💾 Exporter ma save actuelle avant d'importer
        </button>
        <div style="display:flex;gap:8px">
          <button id="btnImportFull" style="flex:2;font-family:var(--font-pixel);font-size:9px;padding:12px;background:var(--bg);border:2px solid var(--gold);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">
            ⚡ Import complet<br><span style="font-size:7px;color:var(--text-dim);font-family:sans-serif">Tous les données migrées automatiquement</span>
          </button>
          ${isLegacy ? `<button id="btnImportHeritage" style="flex:1;font-family:var(--font-pixel);font-size:9px;padding:12px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
            🏆 Mode héritage<br><span style="font-size:7px;font-family:sans-serif">1 agent + 2 Pokémon</span>
          </button>` : ''}
        </div>
        <button id="btnImportCancel" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
          Annuler
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#btnImportClose')?.addEventListener('click',  () => overlay.remove());
  overlay.querySelector('#btnImportCancel')?.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#btnImportBackupFirst')?.addEventListener('click', () => {
    exportSave();
    overlay.querySelector('#btnImportBackupFirst').textContent = '✅ Save actuelle exportée !';
    overlay.querySelector('#btnImportBackupFirst').style.color = 'var(--green)';
  });

  overlay.querySelector('#btnImportFull')?.addEventListener('click', () => {
    showConfirm(
      `Remplacer la save du slot ${activeSaveSlot + 1} par la save importée de "${gangName}" ?`,
      () => {
        try {
          state = migrate(raw);
          saveState();
          overlay.remove();
          renderAll();
          notify(`✅ Save de "${gangName}" importée et convertie au format actuel.`, 'success');
        } catch (err) {
          notify('Erreur lors de la conversion — save non-importée.', 'error');
          console.error(err);
        }
      },
      null,
      { confirmLabel: 'Importer', cancelLabel: 'Annuler' }
    );
  });

  overlay.querySelector('#btnImportHeritage')?.addEventListener('click', () => {
    overlay.remove();
    openLegacyImportModal(raw);
  });
}

function openLegacyImportModal(legacyData) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';

  const agents = legacyData.agents || [];
  const pokemons = legacyData.pokemons || [];

  const agentHtml = agents.length
    ? agents.map(a => `<label style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid var(--border);cursor:pointer">
        <input type="radio" name="legacyAgent" value="${a.id}" style="accent-color:var(--gold)">
        <img src="${a.sprite || ''}" style="width:32px;height:32px" onerror="this.style.display='none'">
        <span style="font-size:10px">${a.name} — Lv.${a.level} (${getAgentRankLabel?.(a) ?? a.title})</span>
      </label>`).join('')
    : '<div style="color:var(--text-dim);font-size:10px;padding:8px">Aucun agent dans cette save</div>';

  const pokeHtml = pokemons.slice(0, 60).map(p => `<label style="display:flex;align-items:center;gap:6px;padding:4px;border-bottom:1px solid var(--border);cursor:pointer">
      <input type="checkbox" name="legacyPoke" value="${p.id}" style="accent-color:var(--gold)">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:28px;height:28px">
      <span style="font-size:9px">${speciesName(p.species_en)} Lv.${p.level} ${'*'.repeat(p.potential)}${p.shiny?' [S]':''}</span>
    </label>`).join('') || '<div style="color:var(--text-dim);font-size:10px">Aucun Pokémon</div>';

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto">
      <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold);margin-bottom:8px">IMPORT HERITAGE</div>
      <div style="font-size:10px;color:var(--text-dim);margin-bottom:16px">
        Save d'une version antérieure détectée. Tu peux conserver <b style="color:var(--text)">1 agent</b> et <b style="color:var(--text)">2 Pokémon</b>.<br>
        Les 2 Pokémon seront placés à la Pension pour pondre un oeuf de départ.
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:8px">CHOISIR 1 AGENT</div>
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:200px;overflow-y:auto">${agentHtml}</div>
        </div>
        <div>
          <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:8px">CHOISIR 2 POKEMON</div>
          <div id="legacyPokeCount" style="font-size:9px;color:var(--red);margin-bottom:4px">0/2 sélectionnés</div>
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:200px;overflow-y:auto">${pokeHtml}</div>
        </div>
      </div>

      <div style="margin-top:16px;display:flex;gap:8px">
        <button id="btnLegacyConfirm" style="flex:1;font-family:var(--font-pixel);font-size:10px;padding:10px;background:var(--bg);border:2px solid var(--gold);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">COMMENCER</button>
        <button id="btnLegacyCancel" style="font-family:var(--font-pixel);font-size:10px;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Limit pokemon checkboxes to 2
  overlay.querySelectorAll('input[name="legacyPoke"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const checked = [...overlay.querySelectorAll('input[name="legacyPoke"]:checked')];
      const countEl = document.getElementById('legacyPokeCount');
      if (checked.length > 2) { cb.checked = false; return; }
      if (countEl) countEl.textContent = `${checked.length}/2 sélectionnés`;
    });
  });

  document.getElementById('btnLegacyCancel')?.addEventListener('click', () => overlay.remove());

  document.getElementById('btnLegacyConfirm')?.addEventListener('click', () => {
    const agentId = overlay.querySelector('input[name="legacyAgent"]:checked')?.value;
    const pokeIds = [...overlay.querySelectorAll('input[name="legacyPoke"]:checked')].map(cb => cb.value);

    if (pokeIds.length !== 2) {
      notify('Sélectionne exactement 2 Pokémon.'); return;
    }

    // Build fresh state
    const fresh = structuredClone(DEFAULT_STATE);
    // Transfer gang basics from legacy
    fresh.gang.name = legacyData.gang?.name || 'La Gang';
    fresh.gang.bossName = legacyData.gang?.bossName || 'Boss';
    fresh.gang.bossSprite = legacyData.gang?.bossSprite || 'rocketgrunt';

    // Transfer chosen agent
    if (agentId) {
      const agent = agents.find(a => a.id === agentId);
      if (agent) {
        agent.team = []; // reset team
        agent.pendingPerk = false;
        fresh.agents = [agent];
      }
    }

    // Transfer chosen pokemon to pension
    const chosenPokes = pokeIds.map(id => pokemons.find(p => p.id === id)).filter(Boolean);
    chosenPokes.forEach(p => { p.homesick = true; });
    fresh.pokemons = chosenPokes;
    fresh.pension.slots = chosenPokes.slice(0, 2).map(p => p.id);
    fresh.pension.eggAt = Date.now() + 60000; // first egg in 1 minute

    state = migrate(fresh);
    saveState();
    overlay.remove();
    renderAll();
    notify('Nouvelle partie héritée commencée ! Les Pokémon sont à la Pension.', 'gold');
    switchTab('tabPC');
  });
}

// ════════════════════════════════════════════════════════════════
//  3.  CORE UTILS
// ════════════════════════════════════════════════════════════════

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function formatIncome(n) {
  if (n >= 10000) return Math.round(n / 1000) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}
function weightedPick(arr) {
  // arr: [{en, w}, ...] — returns en string
  const total = arr.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const e of arr) { r -= e.w; if (r <= 0) return e.en; }
  return arr[arr.length - 1].en;
}
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Pension helpers ──────────────────────────────────────────────
/** Max pension slots (2 base + purchased extras). */
function getMaxPensionSlots() { return 2 + (state.pension?.extraSlotsPurchased || 0); }
/** Set of pokemon IDs currently in pension. */
function getPensionSlotIds() { return new Set(state.pension?.slots || []); }

function addLog(msg) {
  state.log.unshift({ msg, ts: Date.now() });
  if (state.log.length > 50) state.log.length = 50;
}

function sanitizeSpriteName(en) {
  // Showdown sprites use no hyphens for nidoran: nidoranf, nidoranm
  // and some others like mr-mime -> mrmime, farfetchd, etc.
  return en.replace(/[^a-z0-9]/g, '');
}

// ── Pokémon sprite resolution ────────────────────────────────────────────────
// Variants disponibles (depuis pokemon-sprites-kanto.json) :
//   'main'         → FireRed/LeafGreen (défaut)
//   'showdown'     → Animated GIF Showdown
//   'icon'         → Icône miniature Gen 7
//   'artwork'      → Artwork officiel haute résolution
//   'artworkShiny' → Artwork officiel shiny
//   'back'         → Dos face
//   'shiny'        → Version brillante face
//   'backShiny'    → Dos brillant
//   'retroRedBlue' → Sprite Rogue/Bleu
//   'retroYellow'  → Sprite Jaune
// ── Showdown sprite folder resolver ──────────────────────────────
// mode: 'gen1'|'gen2'|'gen3'|'gen4'|'gen5'|'ani'|'dex'|'home'
// back: true = dos, shiny: true = brillant
function _showdownSpriteUrl(en, mode, { shiny = false, back = false } = {}) {
  const name = sanitizeSpriteName(en);
  const sh   = shiny ? '-shiny' : '';
  const bk   = back  ? '-back'  : '';
  // ani & gen5ani → .gif ; tout le reste → .png
  const isGif = mode === 'ani';
  const ext   = isGif ? 'gif' : 'png';
  let folder;
  switch (mode) {
    case 'gen1': folder = back ? `gen1${sh}` : `gen1${sh}`; break; // gen1 has no back-shiny; use gen1
    case 'gen2': folder = `gen2${bk}${sh}`; break;
    case 'gen3': folder = `gen3${bk}${sh}`; break;
    case 'gen4': folder = `gen4${bk}${sh}`; break;
    case 'ani':  folder = `ani${bk}${sh}`;  break;
    case 'dex':  folder = back ? `gen5${bk}${sh}` : `dex${sh}`; break;   // dex has no back → fallback gen5
    case 'home': folder = back ? `gen5${bk}${sh}` : `home-centered${sh}`; break; // home has no back
    default:     folder = `gen5${bk}${sh}`; break; // 'gen5' or unknown
  }
  return `https://play.pokemonshowdown.com/sprites/${folder}/${name}.${ext}`;
}

function pokeSpriteVariant(en, variant = 'main', shiny = false) {
  const mode = state?.settings?.spriteMode ?? 'local';
  // Mode local (JSON FireRed/LeafGreen) — sauf si variante explicitement Showdown
  if (mode === 'local' && variant !== 'showdown') {
    const sp = SPECIES_BY_EN[en];
    const dexId = sp?.dex;
    if (dexId && typeof getPokemonSprite === 'function') {
      const key = shiny && variant === 'main' ? 'shiny'
                : shiny && variant === 'back'  ? 'backShiny'
                : variant;
      const url = getPokemonSprite(dexId, key);
      if (url) return url;
    }
  }
  // Mode Showdown (gen1→home) ou fallback local
  const sdMode = mode === 'local' ? 'gen5' : mode;
  return _showdownSpriteUrl(en, sdMode, { shiny });
}

function pokeSprite(en, shiny = false) {
  return pokeSpriteVariant(en, 'main', shiny);
}

// Icône miniature BW (~40×30px) — pour les slots d'équipe
function pokeIcon(en) {
  const name = sanitizeSpriteName(en);
  return `https://play.pokemonshowdown.com/sprites/bwicons/${name}.png`;
}

// ── Egg sprites ──────────────────────────────────────────────────────────────
// Pokémon-specific anime eggs (PokéOS) : {dex}-egg-anime.png
// Rarity-coded GO eggs (Pokepedia)     : mystery / unknown species
const EGG_SPRITES = {
  // Generic rarity-based (mystery eggs)
  common:    'https://archives.bulbagarden.net/media/upload/e/ed/Spr_5b_Egg.png',
  uncommon:  'https://www.pokepedia.fr/images/a/ab/Sprite_%C5%92uf_5_km_GO.png',
  rare:      'https://www.pokepedia.fr/images/7/70/Sprite_%C5%92uf_10_km_GO.png',
  very_rare: 'https://www.pokepedia.fr/images/a/a8/Sprite_%C5%92uf_12_km_GO.png',
  legendary: 'https://www.pokepedia.fr/images/a/a8/Sprite_%C5%92uf_12_km_GO.png',
  // Special states
  ready:     'https://archives.bulbagarden.net/media/upload/0/06/HOMEEgg.png',
  // Default fallback
  default:   'https://archives.bulbagarden.net/media/upload/e/ed/Spr_5b_Egg.png',
};

// Returns the generic fallback egg sprite URL (rarity-coded).
function eggSprite(egg, ready = false) {
  if (ready) return EGG_SPRITES.ready;
  const rarity = egg?.rarity || 'common';
  return EGG_SPRITES[rarity] || EGG_SPRITES.default;
}

// Returns a full <img> HTML string with PokéOS species egg (if pension/revealed)
// and automatic onerror fallback chain to rarity sprite → BW generic.
// style: optional inline CSS string to add to the img.
function eggImgTag(egg, ready = false, style = '') {
  const fallback = eggSprite(egg, ready);
  const bwFallback = EGG_SPRITES.default;
  const baseStyle = `object-fit:contain;image-rendering:pixelated;${style}`;

  // Pension egg (parents known) or scanned (species revealed) → try PokéOS first
  const isRevealed = (egg?.parentA && egg?.parentB) || (egg?.scanned && egg?.revealedSpecies);
  if (!ready && isRevealed && egg?.species_en) {
    const sp = SPECIES_BY_EN[egg.species_en];
    const dex = sp?.dex;
    if (dex) {
      const pokeos = `https://s3.pokeos.com/pokeos-uploads/forgotten-dex/eggs/${dex}-animegg.png`;
      // onerror chain: PokéOS → rarity fallback → BW generic
      return `<img src="${pokeos}" style="${baseStyle}" onerror="if(!this._f1){this._f1=1;this.src='${fallback}'}else if(!this._f2){this._f2=1;this.src='${bwFallback}'}">`;
    }
  }
  // Generic / mystery egg — single fallback to BW generic
  return `<img src="${fallback}" style="${baseStyle}" onerror="if(!this._f1){this._f1=1;this.src='${bwFallback}'}">`;
}

function pokeSpriteBack(en, shiny = false) {
  const mode = state?.settings?.spriteMode ?? 'local';
  if (mode === 'local') {
    const sp = SPECIES_BY_EN[en];
    const dexId = sp?.dex;
    if (dexId && typeof getPokemonSprite === 'function') {
      const url = getPokemonSprite(dexId, shiny ? 'backShiny' : 'back');
      if (url) return url;
    }
  }
  const sdMode = mode === 'local' ? 'gen5' : mode;
  return _showdownSpriteUrl(en, sdMode, { shiny, back: true });
}

const SPRITE_FIX = {
  // ltsurge, rocketgrunt, rocketgruntf exist directly on Showdown — no fix needed
  // Elite Four sprites need suffix
  agatha:          'agatha-gen1',
  lorelei:         'lorelei-gen1',
  phoebe:          'phoebe-gen3',
  drake:           'drake-gen3',
  // Common trainers that 404 without suffix
  channeler:       'channeler-gen1',
  cueball:         'cueball-gen1',
  rocker:          'rocker-gen1',
  tamer:           'tamer-gen1',
  // cooltrainer doesn't exist on Showdown → use acetrainer
  cooltrainer:     'acetrainer',
  cooltrainerf:    'acetrainerf',
  // New trainers — pick the most iconic version
  rocketexecutive: 'rocketexecutive-gen2',
  pokemonrangerf:  'pokemonrangerf-gen3',
  policeman:       'policeman-gen8',
};

// Custom sprite overrides (non-Showdown sources)
const CUSTOM_TRAINER_SPRITES = {
  giovanni: 'https://www.pokepedia.fr/images/archive/7/73/20230124191924%21Sprite_Giovanni_RB.png',
};

// ── Trainer sprite resolution ────────────────────────────────────────────────
// Index à plat construit après chargement de trainer-sprites-grouped.json
const _trainerJsonIndex = {};

function _buildTrainerIndex(data) {
  // `data` = résultat de loadTrainerGroups() — TRAINER_GROUPS n'est plus global (IIFE loaders.js)
  if (!data?.trainers) return;
  const base = 'https://play.pokemonshowdown.com/sprites/trainers/';
  const groups = data.trainers;
  for (const [groupName, groupData] of Object.entries(groups)) {
    if (groupName === 'factions') {
      for (const [, arr] of Object.entries(groupData)) {
        if (Array.isArray(arr)) arr.forEach(rel => {
          const slug = rel.replace(/\.png$/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
          _trainerJsonIndex[slug] = base + rel;
        });
      }
    } else if (typeof groupData === 'object' && !Array.isArray(groupData)) {
      for (const [key, rel] of Object.entries(groupData)) {
        const slug = rel.replace(/\.png$/, '').toLowerCase();
        const keyNorm = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
        _trainerJsonIndex[slug] = base + rel;
        _trainerJsonIndex[keyNorm] = base + rel;
      }
    }
  }
}

function trainerSprite(name) {
  if (CUSTOM_TRAINER_SPRITES[name]) return CUSTOM_TRAINER_SPRITES[name];
  // Chercher dans l'index JSON si disponible
  const norm = (name || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (_trainerJsonIndex[norm]) return _trainerJsonIndex[norm];
  // Fallback Showdown
  const fixed = SPRITE_FIX[name] || name;
  return `https://play.pokemonshowdown.com/sprites/trainers/${fixed}.png`;
}

// Asset fallbacks moved to data/assets-data.js

// Safe image helpers — with automatic fallback on load error
function safeTrainerImg(name, { style = '', cls = '' } = {}) {
  const src = trainerSprite(name);
  return `<img src="${src}" ${cls ? `class="${cls}"` : ''} style="${style}" alt="${name}" onerror="this.src='${FALLBACK_TRAINER_SVG}';this.onerror=null">`;
}
function safePokeImg(species_en, { shiny = false, back = false, variant = 'main', style = '', cls = '' } = {}) {
  const src = back ? pokeSpriteBack(species_en, shiny) : pokeSpriteVariant(species_en, variant, shiny);
  return `<img src="${src}" ${cls ? `class="${cls}"` : ''} style="${style}" alt="${species_en}" onerror="this.src='${FALLBACK_POKEMON_SVG}';this.onerror=null">`;
}

function speciesName(en) {
  if (!SPECIES_BY_EN[en]) return en;
  return state.lang === 'fr' ? SPECIES_BY_EN[en].fr : en.charAt(0).toUpperCase() + en.slice(1);
}

function pokemonDisplayName(p) {
  return p.nick || speciesName(p.species_en);
}

// ── SESSION TRACKING … itemSprite extracted → modules/systems/sessionObjectives.js ──

let pcView = 'grid'; // 'grid' | 'lab'
let _pcLastRenderKey = ''; // tracks last filter/sort/page combo to avoid unnecessary rebuilds
let labSelectedId = null;
let labShowAll    = false;

// Chest sprite URL moved to data/assets-data.js

// ── SFX Engine (Web Audio API) ────────────────────────────────
const SFX = (() => {
  let ctx;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function playTone(freq, duration, type = 'square', volume = 0.15) {
    const c = getCtx();
    if (c.state === 'suspended') { c.resume().catch(() => {}); return; }
    const osc = c.createOscillator();
    const gain = c.createGain();
    const sfxMult = (state?.settings?.sfxVol ?? 80) / 100;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(volume * sfxMult, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration + 0.05); // +50 ms buffer → élimine le click/scratch à l'arrêt
  }
  return {
    ballThrow() {
      // Whoosh sound: descending noise
      playTone(800, 0.15, 'sawtooth', 0.08);
      setTimeout(() => playTone(400, 0.1, 'sawtooth', 0.06), 80);
    },
    capture(potential, shiny) {
      // Base capture jingle
      const base = 520;
      playTone(base, 0.12, 'square', 0.12);
      setTimeout(() => playTone(base * 1.25, 0.12, 'square', 0.12), 100);
      setTimeout(() => playTone(base * 1.5, 0.15, 'square', 0.12), 200);
      // Extra notes for high potential
      if (potential >= 4) {
        setTimeout(() => playTone(base * 2, 0.2, 'square', 0.15), 320);
      }
      if (potential >= 5 || shiny) {
        setTimeout(() => playTone(base * 2.5, 0.25, 'sine', 0.18), 440);
        setTimeout(() => playTone(base * 3, 0.3, 'sine', 0.15), 580);
      }
      if (shiny) {
        // Sparkle effect
        setTimeout(() => {
          for (let i = 0; i < 5; i++) {
            setTimeout(() => playTone(1200 + i * 200, 0.08, 'sine', 0.1), i * 60);
          }
        }, 700);
      }
    },
    error() {
      playTone(200, 0.2, 'sawtooth', 0.1);
    },
    levelUp() {
      // Ascending fanfare
      playTone(523, 0.1, 'square', 0.1);
      setTimeout(() => playTone(659, 0.1, 'square', 0.1), 110);
      setTimeout(() => playTone(784, 0.15, 'square', 0.1), 220);
      setTimeout(() => playTone(1047, 0.2, 'sine',  0.12), 360);
    },
    coin() {
      // Money sound
      playTone(988, 0.06, 'sine', 0.1);
      setTimeout(() => playTone(1318, 0.1, 'sine', 0.1), 80);
    },
    click() {
      // UI button click — tick léger
      playTone(1200, 0.04, 'square', 0.05);
    },
    tabSwitch() {
      // Changement d'onglet — glissement court
      playTone(660, 0.06, 'sine', 0.07);
      setTimeout(() => playTone(880, 0.05, 'sine', 0.05), 50);
    },
    buy() {
      // Achat confirmé — coin sound plus grave
      playTone(659, 0.08, 'sine', 0.1);
      setTimeout(() => playTone(880, 0.12, 'sine', 0.12), 80);
    },
    unlock() {
      // Déverrouillage / découverte — fanfare ascendante
      playTone(440, 0.08, 'square', 0.1);
      setTimeout(() => playTone(554, 0.08, 'square', 0.1), 100);
      setTimeout(() => playTone(659, 0.08, 'square', 0.1), 200);
      setTimeout(() => playTone(880, 0.16, 'sine',   0.12), 310);
      setTimeout(() => playTone(1108, 0.2, 'sine',   0.1),  450);
    },
    menuOpen() {
      // Ouverture modale / menu
      playTone(880, 0.08, 'sine', 0.07);
      setTimeout(() => playTone(1100, 0.1, 'sine', 0.06), 80);
    },
    menuClose() {
      // Fermeture modale
      playTone(660, 0.07, 'sine', 0.06);
      setTimeout(() => playTone(440, 0.09, 'sine', 0.05), 70);
    },
    chest() {
      // Coffre ouvert — effet magique
      playTone(660, 0.08, 'square', 0.08);
      setTimeout(() => playTone(880, 0.08, 'square', 0.09), 80);
      setTimeout(() => playTone(1100, 0.08, 'square', 0.1), 160);
      setTimeout(() => {
        for (let i = 0; i < 4; i++) {
          setTimeout(() => playTone(1200 + i * 180, 0.07, 'sine', 0.07), i * 55);
        }
      }, 260);
    },
    notify() {
      // Notification — ping doux
      playTone(880, 0.07, 'sine', 0.08);
      setTimeout(() => playTone(1108, 0.1, 'sine', 0.07), 90);
    },
    sell() {
      // Vente Pokémon
      playTone(660, 0.05, 'sine', 0.08);
      setTimeout(() => playTone(440, 0.08, 'sawtooth', 0.06), 70);
    },
    evolve() {
      // Évolution — fanfare complète
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) => setTimeout(() => playTone(f, 0.15, 'square', 0.12), i * 120));
      setTimeout(() => {
        for (let i = 0; i < 6; i++) setTimeout(() => playTone(1200 + i * 150, 0.1, 'sine', 0.1), i * 60);
      }, notes.length * 120 + 100);
    },
    _enabled() { return state?.settings?.sfxEnabled !== false; },
    play(name, ...args) {
      if (!this._enabled()) return;
      if (state?.settings?.sfxIndividual?.[name] === false) return;
      try { this[name]?.(...args); } catch {}
    },
  };
})();

// ════════════════════════════════════════════════════════════════
//  3b.  MUSIC PLAYER (zone-aware, crossfade progressif)
// ════════════════════════════════════════════════════════════════

/**
 * MUSIC_TRACKS — catalogue de toutes les pistes audio.
 * Ajoutez des pistes ici + placez les fichiers dans game/music/.
 * Chaque zone référence une clé via sa propriété `music`.
 *
 * Structure :
 *   key:  identifiant unique (référencé dans ZONES[].music)
 *   file: chemin relatif depuis game/
 *   loop: true pour boucle continue
 *   vol:  volume de base 0–1
 */
const MUSIC_TRACKS = {
  // ── Base / Routes ─────────────────────────────────────────────
  base:        { file: 'music/BGM/First Town.mp3',    loop: true,  vol: 0.45, fr: 'Base du Gang'       },
  forest:      { file: 'music/BGM/Route 1.mp3',       loop: true,  vol: 0.50, fr: 'Route'               },
  cave:        { file: 'music/BGM/Cave.mp3',           loop: true,  vol: 0.45, fr: 'Caverne'             },
  city:        { file: 'music/BGM/Lab.mp3',            loop: true,  vol: 0.50, fr: 'Ville'               },
  sea:         { file: 'music/BGM/Introduction.mp3',   loop: true,  vol: 0.45, fr: 'Mer / Bateau'        },
  safari:      { file: 'music/BGM/Route 1.mp3',        loop: true,  vol: 0.45, fr: 'Parc Safari'         },
  lavender:    { file: 'music/BGM/Cave.mp3',           loop: true,  vol: 0.30, fr: 'Lavanville'          },
  tower:       { file: 'music/BGM/Cave.mp3',           loop: true,  vol: 0.28, fr: 'Tour Pokémon'        },
  mansion:     { file: 'music/BGM/Cave.mp3',           loop: true,  vol: 0.35, fr: 'Manoir Pokémon'      },
  // ── Combat / Arènes ───────────────────────────────────────────
  gym:         { file: 'music/BGM/VSTrainer.mp3',      loop: true,  vol: 0.55, fr: 'Arène'               },
  rocket:      { file: 'music/BGM/VSRival.mp3',        loop: true,  vol: 0.55, fr: 'Team Rocket'         },
  silph:       { file: 'music/BGM/Lab.mp3',            loop: true,  vol: 0.50, fr: 'Sylphe SARL'         },
  elite4:      { file: 'music/BGM/VSLegend.mp3',       loop: true,  vol: 0.60, fr: 'Élite 4 / Sommet'    },
  // ── Ambiances spéciales ────────────────────────────────────────
  casino:      { file: 'music/BGM/MysteryGift.mp3',    loop: true,  vol: 0.55, fr: 'Casino'              },
  halloffame:  { file: 'music/BGM/Hall of Fame.mp3',   loop: false, vol: 0.60, fr: 'Tableau d\'Honneur'  },
  title:       { file: 'music/BGM/Title.mp3',          loop: true,  vol: 0.50, fr: 'Titre'               },
};

/**
 * MusicPlayer — gère la lecture de fond avec crossfade.
 * Utilise deux éléments <audio> pour un fondu croisé doux.
 */
const MusicPlayer = (() => {
  let _trackA = null;   // HTMLAudioElement actif
  let _trackB = null;   // HTMLAudioElement en fondu entrant
  let _current = null;  // clé du morceau en cours
  let _fadeTimer = null;

  const FADE_DURATION = 2000; // ms

  function _createAudio(src, vol, loop) {
    const a = new Audio(src);
    a.loop = loop;
    a.volume = 0;
    a.preload = 'auto';
    a.dataset.targetVol = vol;
    return a;
  }

  function _isEnabled() {
    return state?.settings?.musicEnabled === true;
  }

  function _setVol(el, v) {
    if (el) el.volume = Math.max(0, Math.min(1, v));
  }

  function _fade(el, fromVol, toVol, durationMs, onDone) {
    const steps = 30;
    const dt = durationMs / steps;
    const delta = (toVol - fromVol) / steps;
    let step = 0;
    const id = setInterval(() => {
      step++;
      _setVol(el, fromVol + delta * step);
      if (step >= steps) {
        clearInterval(id);
        _setVol(el, toVol);
        if (onDone) onDone();
      }
    }, dt);
    return id;
  }

  return {
    /**
     * Joue la piste `trackId` avec crossfade si une piste est déjà active.
     * Ne fait rien si la piste est déjà en cours ou si la musique est désactivée.
     */
    play(trackId) {
      if (!_isEnabled()) return;
      if (!trackId || !MUSIC_TRACKS[trackId]) return;
      if (_current === trackId) return; // déjà en cours

      const def = MUSIC_TRACKS[trackId];
      const newAudio = _createAudio(def.file, def.vol, def.loop);
      const targetVol = def.vol;

      _current = trackId;

      if (_trackA && !_trackA.paused) {
        // Crossfade : fade out A, fade in B
        const oldA = _trackA;
        _trackB = newAudio;
        _trackB.play().catch(() => {});
        _fade(_trackB, 0, targetVol, FADE_DURATION);
        _fade(oldA, oldA.volume, 0, FADE_DURATION, () => {
          oldA.pause();
          oldA.src = '';
          _trackA = _trackB;
          _trackB = null;
        });
      } else {
        // Pas de piste active — démarre directement avec fade in
        if (_trackA) { _trackA.pause(); _trackA.src = ''; }
        _trackA = newAudio;
        _trackA.play().catch(() => {});
        _fade(_trackA, 0, targetVol, FADE_DURATION);
      }
    },

    /** Arrête la musique avec fade out. */
    stop() {
      if (_trackA) {
        const old = _trackA;
        _trackA = null;
        _current = null;
        _fade(old, old.volume, 0, FADE_DURATION / 2, () => {
          old.pause(); old.src = '';
        });
      }
    },

    /** Appelé lors du changement de zone ouverte ou d'onglet actif. */
    updateFromContext() {
      if (!_isEnabled()) { this.stop(); return; }

      // Priorité 0 : jukebox manuel
      if (state?.settings?.jukeboxTrack) {
        this.play(state.settings.jukeboxTrack);
        return;
      }

      // Priorité : première zone ouverte qui a une musique définie
      for (const zId of (state.openZoneOrder || [])) {
        const zone = ZONE_BY_ID[zId];
        if (zone?.music) { this.play(zone.music); return; }
      }
      // Fallback : musique de l'onglet actif
      if (activeTab === 'tabGang' || activeTab === 'tabZones') {
        this.play('base');
      } else {
        // Pas de zones ouvertes et onglet neutre → silence progressif
        this.stop();
      }
    },

    /** Volume global 0–1 */
    setVolume(v) {
      if (_trackA) _setVol(_trackA, Math.max(0, Math.min(1, v)) * (parseFloat(_trackA.dataset.targetVol) || 0.5));
    },

    get current() { return _current; },
  };
})();

/**
 * JinglePlayer — joue des courts extraits audio (ME) en one-shot.
 * Ne bloque pas la musique de fond — les deux coexistent.
 */
const JINGLES = {
  trainer_encounter: 'music/ME/VSTrainer_Intro.mp3',
  wild_encounter:    'music/ME/VSWildPoke_Intro.mp3',
  legend_encounter:  'music/ME/VSLegend_Intro.mp3',
  rival_encounter:   'music/ME/VSRival_Intro.mp3',
  youngster:         'music/ME/Encounter_Youngster.mp3',
  mystery_gift:      'music/BGM/MysteryGift.mp3',
  low_hp:            'music/ME/lowhp.mp3',
  slots_win:         'music/ME/SlotsWin.mp3',
  slots_big:         'music/ME/SlotsBigWin.mp3',
};

const JinglePlayer = (() => {
  let _current = null;
  function _enabled() { return state?.settings?.musicEnabled === true; }

  return {
    play(key) {
      if (!_enabled()) return;
      const src = JINGLES[key];
      if (!src) return;
      if (_current) { _current.pause(); _current = null; }
      const a = new Audio(src);
      a.volume = 0.7;
      a.play().catch(() => {});
      _current = a;
      a.addEventListener('ended', () => { _current = null; });
    },
    stop() { if (_current) { _current.pause(); _current = null; } },
  };
})();

/**
 * SE (Sound Effects) — sons d'attaque et événements gameplay.
 * Utilise Audio HTML plutôt que Web Audio pour les fichiers complexes.
 */
const SE_SOUNDS = {
  buy:        'music/SE/Charm.mp3',
  level_up:   'music/SE/BW2Summary.mp3',
  slash:      'music/SE/Slash.mp3',
  metronome:  'music/SE/Metronome.mp3',
  explosion:  'music/SE/Explosion.mp3',
  protect:    'music/SE/Protect.mp3',
  flash:      'music/SE/Flash.mp3',
};

function playSE(key, vol = 0.6) {
  if (state?.settings?.sfxEnabled === false) return;
  const src = SE_SOUNDS[key];
  if (!src) return;
  const a = new Audio(src);
  a.volume = vol;
  a.play().catch(() => {});
}

// ════════════════════════════════════════════════════════════════
//  3c.  DOPAMINE POPUP HELPERS
// ════════════════════════════════════════════════════════════════

let _shinyPopupTimer = null;

function showShinyPopup(species_en) {
  try {
    const el = document.getElementById('shinyPopup');
    const sprite = document.getElementById('shinyPopupSprite');
    const label  = document.getElementById('shinyPopupLabel');
    if (!el) return;
    sprite.src = pokeSprite(species_en, true);
    label.textContent = (state.lang === 'fr' ? '✨ SHINY ' : '✨ SHINY ') + speciesName(species_en) + ' !';
    el.classList.add('show');
    clearTimeout(_shinyPopupTimer);
    _shinyPopupTimer = setTimeout(() => el.classList.remove('show'), 3000);
  } catch {}
}

let _rarePopupTimer = null;

function showRarePopup(species_en, zoneId) {
  try {
    const el     = document.getElementById('rarePopup');
    const sprite = document.getElementById('rarePopupSprite');
    const label  = document.getElementById('rarePopupLabel');
    const hint   = document.getElementById('rarePopupHint');
    if (!el) return;
    sprite.src = pokeSprite(species_en);
    label.textContent = (state.lang === 'fr' ? '⚡ Rare aperçu : ' : '⚡ Rare spotted: ') + speciesName(species_en);

    // Afficher le nom de la zone et le hint cliquable
    if (zoneId && hint) {
      const zone = ZONE_BY_ID[zoneId];
      const zoneName = zone ? (state.lang === 'fr' ? zone.fr : zone.en) : zoneId;
      hint.textContent = `→ ${zoneName}`;
    } else if (hint) {
      hint.textContent = '';
    }

    // Stocker le zoneId pour le clic
    el.dataset.targetZone = zoneId || '';

    el.classList.add('show');
    clearTimeout(_rarePopupTimer);
    _rarePopupTimer = setTimeout(() => el.classList.remove('show'), 3500);
  } catch {}
}

// ── Clic sur le popup rare → switch vers la zone ──────────────
(function _bindRarePopupClick() {
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('rarePopup');
    if (!el) return;
    el.addEventListener('click', () => {
      const zoneId = el.dataset.targetZone;
      if (!zoneId) return;
      clearTimeout(_rarePopupTimer);
      el.classList.remove('show');
      // Ouvrir l'onglet Zones et y ouvrir la zone cible
      switchTab('tabZones');
      // S'assurer que la zone est ouverte dans les fenêtres
      if (!openZones.has(zoneId)) {
        openZones.add(zoneId);
        if (!state.openZoneOrder) state.openZoneOrder = [];
        if (!state.openZoneOrder.includes(zoneId)) state.openZoneOrder.push(zoneId);
      }
      renderZonesTab();
      // Scroll vers la fenêtre de zone après le rendu
      setTimeout(() => {
        const zoneWin = document.getElementById(`zw-${zoneId}`);
        zoneWin?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Bref highlight visuel
        zoneWin?.classList.add('zone-highlight');
        setTimeout(() => zoneWin?.classList.remove('zone-highlight'), 1500);
      }, 100);
    });
  });
})();

// ════════════════════════════════════════════════════════════════
//  3c.  MODAL HELPERS (confirm + info)
// ════════════════════════════════════════════════════════════════

function showConfirm(message, onConfirm, onCancel = null, opts = {}) {
  const existing = document.getElementById('confirmModal');
  if (existing) existing.remove();
  SFX.play('menuOpen');

  const modal = document.createElement('div');
  modal.id = 'confirmModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;';

  const danger = opts.danger ? 'var(--red)' : 'var(--gold-dim)';
  const confirmLabel = opts.confirmLabel || (opts.lang === 'fr' ? 'Confirmer' : 'Confirm');
  const cancelLabel  = opts.cancelLabel  || (opts.lang === 'fr' ? 'Annuler'   : 'Cancel');

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid ${danger};border-radius:var(--radius);padding:24px 28px;max-width:440px;width:90%;display:flex;flex-direction:column;gap:16px">
      <div style="font-size:13px;color:var(--text);line-height:1.6">${message}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="confirmModalCancel" style="font-family:var(--font-pixel);font-size:9px;padding:8px 16px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">${cancelLabel}</button>
        <button id="confirmModalOk" style="font-family:var(--font-pixel);font-size:9px;padding:8px 16px;background:${opts.danger ? 'var(--red-dark)' : 'var(--bg)'};border:1px solid ${danger};border-radius:var(--radius-sm);color:${opts.danger ? '#fff' : 'var(--gold)'};cursor:pointer">${confirmLabel}</button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  document.getElementById('confirmModalOk').addEventListener('click', () => { SFX.play('menuClose'); modal.remove(); onConfirm?.(); });
  document.getElementById('confirmModalCancel').addEventListener('click', () => { SFX.play('menuClose'); modal.remove(); onCancel?.(); });
  modal.addEventListener('click', e => { if (e.target === modal) { SFX.play('menuClose'); modal.remove(); onCancel?.(); } });
}

function showInfoModal(tabId) {
  const INFO = {
    tabGang: {
      title: '💀 LE GANG',
      body: `
        <strong>Réputation</strong> — Débloque zones, quêtes et achats. Visible dans la barre en haut à droite.<br><br>
        <strong>Argent (₽)</strong> — Les récompenses de combat s'accumulent dans les zones. Récupère-les via le bouton ₽ jaune (un combat est nécessaire).<br><br>
        <strong>Boss</strong> — Ton avatar. Assigne jusqu'à <strong>3 Pokémon</strong> à son équipe depuis le PC.<br><br>
        <strong>Sac</strong> — Clique sur une Ball pour l'activer. Clique sur un boost pour le lancer. L'incubateur ouvre la gestion des œufs.<br><br>
        <span class="dim">Conseil : assigne tes meilleurs Pokémon au Boss pour maximiser tes chances en combat.</span>
      `
    },
    tabAgents: {
      title: '👥 AGENTS',
      body: `
        <strong>CAP (Capture)</strong> — Chance de capturer automatiquement des Pokémon dans les zones non-ouvertes. Plus c'est haut, plus l'agent est efficace.<br><br>
        <strong>LCK (Chance)</strong> — Influence la rareté des captures passives et la qualité des récompenses de coffres.<br><br>
        <strong>ATK (Combat)</strong> — Puissance en combat automatique. Un agent fort bat des dresseurs difficiles.<br><br>
        <strong>Grade</strong> — Grunt → Lieutenant (50+ combats gagnés) → Captain (200+). Chaque grade donne un bonus ATK.<br><br>
        <strong>Zone assignée</strong> — L'agent farm passivement : captures, combats contre dresseurs, ouverture de coffres.<br><br>
        <span class="dim">Un agent sans zone assignée ne fait rien. Assigne-les toujours !</span>
      `
    },
    tabZones: {
      title: '🗺️ ZONES',
      body: `
        <strong>Zone de capture</strong> (field / safari / water / cave) — Des Pokémon sauvages apparaissent. Agents et Boss capturent automatiquement.<br><br>
        <strong>Zone d'arène</strong> (gym / elite) — Uniquement des combats. Récompenses en ₽ et réputation élevées.<br><br>
        <strong>Récolte ₽</strong> — Les gains de combat s'accumulent (icône jaune ₽). Clique pour lancer une récolte avec combat défensif.<br><br>
        <strong>Maîtrise ★</strong> — Augmente avec les victoires. Améliore les spawns et débloque des dresseurs élites.<br><br>
        <strong>Slots d'agents</strong> — Coût en réputation, croissant avec le niveau de la zone.<br><br>
        <span class="dim">Les zones dégradées (⚠) n'ont que des combats — remonte ta réputation pour les débloquer.</span>
      `
    },
    tabMarket: {
      title: '💰 MARCHÉ',
      body: `
        <strong>Quêtes horaires</strong> — 3 quêtes Moyennes + 2 Difficiles, réinitialisées toutes les heures. Reroll possible contre 10 rep.<br><br>
        <strong>Histoire & Objectifs</strong> — Quêtes permanentes liées à la progression. Complète-les pour des grosses récompenses.<br><br>
        <strong>Balls</strong> — Chaque type améliore le potentiel max capturé. Troc (onglet Troc) : 10 PB→1 GB, 10 GB→1 UB, 100 UB⇄1 MB.<br><br>
        <strong>Multiplicateur ×1/×5/×10</strong> — Achète en lot depuis la boutique.<br><br>
        <strong>Boosts temporaires</strong> — S'activent depuis le Sac dans la fenêtre de zone. Durée 60–90s.<br><br>
        <span class="dim">Vends des Pokémon depuis le PC pour financer tes achats.</span>
      `
    },
    tabPC: {
      title: '💻 PC',
      body: `
        <strong>Potentiel ★</strong> — Permanent, détermine le plafond de puissance. ★5 = top tier. Dépend de la Ball utilisée.<br><br>
        <strong>Nature</strong> — Chaque nature booste 2 stats et en pénalise 1. <em>Hardy</em> = équilibré.<br><br>
        <strong>ATK/DEF/SPD</strong> — Calculées depuis base × nature × niveau × potentiel.<br><br>
        <strong>Vente</strong> — Prix = rareté × potentiel × nature. Pas de malus de revente.<br><br>
        <strong>Labo</strong> — Fais évoluer tes Pokémon (pierre ou niveau requis).<br><br>
        <strong>Pension</strong> — 2 Pokémon compatibles → oeuf. Nécessite un incubateur. Les Pokémon de pension ont le "mal du pays" et ne peuvent pas être vendus.<br><br>
        <strong>Oeufs</strong> — Gère tes oeufs en attente d'incubation ou prêts à éclore.<br><br>
        <span class="dim">Filtre par rareté, type ou shiny pour retrouver facilement tes Pokémon.</span>
      `
    },
    tabPokedex: {
      title: '📖 POKÉDEX',
      body: `
        <strong>Vu 👁</strong> — Tu as aperçu ce Pokémon dans une zone (spawn visible).<br><br>
        <strong>Capturé ✓</strong> — Tu en possèdes au moins un dans ton PC.<br><br>
        <strong>Shiny ✨</strong> — Tu as capturé une version chromatique. Chance de base très faible, boostée par l'Aura Shiny.<br><br>
        <strong>Progression</strong> — Compléter le Pokédex donne des bonus de réputation et de récompenses de quêtes.<br><br>
        <span class="dim">Les légendaires et très rares n'apparaissent que dans des zones spécifiques avec le bon équipement.</span>
      `
    },
  };

  const info = INFO[tabId];
  if (!info) return;

  document.getElementById('infoModalTitle').textContent = info.title;
  document.getElementById('infoModalBody').innerHTML = info.body;
  document.getElementById('infoModal').classList.add('active');
}

// ════════════════════════════════════════════════════════════════
//  4.  POKEMON MODULE
// ════════════════════════════════════════════════════════════════

function rollNature() { return pick(NATURE_KEYS); }

function rollPotential(ballType) {
  const dist = BALLS[ballType]?.potential || BALLS.pokeball.potential;
  const r = Math.random() * 100;
  let acc = 0;
  let result = 1;
  for (let i = 0; i < dist.length; i++) {
    acc += dist[i];
    if (r < acc) { result = i + 1; break; }
  }
  // Lucky Incense: +1 potential (capped at 5)
  if (isBoostActive('incense') && result < 5) result++;
  return result;
}

function rollShiny() {
  // Shiny Aura: x5 rate (1/40 instead of 1/200) ; Chroma Charm: ×2 permanent
  let rate = isBoostActive('aura') ? 0.025 : 0.005;
  if (state?.purchases?.chromaCharm) rate *= 2;
  return Math.random() < rate;
}

function rollMoves(speciesEN) {
  const sp = SPECIES_BY_EN[speciesEN];
  if (!sp) return ['Charge', 'Griffe'];
  const pool = [...sp.moves];
  // Shuffle and pick 2 unique (or as many as available)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const unique = [...new Set(pool)];
  return unique.slice(0, 2);
}

function calculateStats(pokemon) {
  const sp = SPECIES_BY_EN[pokemon.species_en];
  if (!sp) return { atk: 10, def: 10, spd: 10 };
  const nat = NATURES[pokemon.nature] || NATURES.hardy;
  const potMult = 1 + pokemon.potential * 0.1;
  const lvlMult = 1 + pokemon.level / 100;
  return {
    atk: Math.round(sp.baseAtk * potMult * nat.atk * lvlMult),
    def: Math.round(sp.baseDef * potMult * nat.def * lvlMult),
    spd: Math.round(sp.baseSpd * potMult * nat.spd * lvlMult),
  };
}

function makePokemon(speciesEN, zoneId, ballType = 'pokeball') {
  const sp = SPECIES_BY_EN[speciesEN];
  if (!sp) return null;
  const nature = rollNature();
  const potential = rollPotential(ballType);
  const shiny = rollShiny();
  const level = randInt(3, 12);
  const pokemon = {
    id: `pk-${uid()}`,
    species_fr: sp.fr,
    species_en: sp.en,
    dex: sp.dex,
    level,
    xp: 0,
    nature,
    potential,
    shiny,
    moves: rollMoves(speciesEN),
    capturedIn: zoneId,
    stats: {},
    assignedTo: null,
    cooldown: 0,
    history: [],
    favorite: false,
  };
  pokemon.stats = calculateStats(pokemon);
  // Initial history entry
  pokemon.history.push({ type: 'captured', ts: Date.now(), zone: zoneId, ball: ballType });
  // Track most expensive obtained
  const obtainedValue = calculatePrice(pokemon);
  if (!state.stats.mostExpensiveObtained || obtainedValue > (state.stats.mostExpensiveObtained.price || 0)) {
    state.stats.mostExpensiveObtained = { name: speciesName(pokemon.species_en), price: obtainedValue };
  }
  return pokemon;
}

function getPokemonPower(pokemon) {
  const s = pokemon.stats;
  return Math.round((s.atk + s.def + s.spd) * (pokemon.homesick ? 0.75 : 1));
}

// → Moved to data/evolutions-data.js
function checkEvolution(pokemon) {
  const evos = EVO_BY_SPECIES[pokemon.species_en];
  if (!evos) return null;
  // Collect all valid level-based evolutions (multi-evo = random pick)
  const valid = evos.filter(e => e.req !== 'item' && typeof e.req === 'number' && pokemon.level >= e.req);
  if (valid.length === 0) return null;
  return valid[Math.floor(Math.random() * valid.length)];
}

function evolvePokemon(pokemon, targetEN) {
  const sp = SPECIES_BY_EN[targetEN];
  if (!sp) return false;
  const oldName = speciesName(pokemon.species_en);
  pokemon.species_en = sp.en;
  pokemon.species_fr = sp.fr;
  pokemon.dex = sp.dex;
  pokemon.stats = calculateStats(pokemon);
  pokemon.moves = rollMoves(sp.en);
  if (pokemon.history) {
    pokemon.history.push({ type: 'evolved', ts: Date.now(), from: oldName, to: speciesName(sp.en) });
  }
  // Update pokedex
  if (!state.pokedex[sp.en]) {
    state.pokedex[sp.en] = { seen: true, caught: true, shiny: pokemon.shiny, count: 1 };
  } else {
    state.pokedex[sp.en].caught = true;
    state.pokedex[sp.en].count++;
    if (pokemon.shiny) state.pokedex[sp.en].shiny = true;
  }
  showPokemonLevelPopup(pokemon, pokemon.level);
  notify(`${oldName} ${state.lang === 'fr' ? 'évolue en' : 'evolved into'} ${speciesName(sp.en)} !`, 'gold');
  SFX.play('evolve'); // Evolution fanfare
  saveState();
  return true;
}

function tryAutoEvolution(pokemon) {
  const evos = EVO_BY_SPECIES[pokemon.species_en];
  if (!evos) return false;
  const valid = evos.filter(e => e.req !== 'item' && typeof e.req === 'number' && pokemon.level >= e.req);
  if (valid.length === 0) return false;

  if (valid.length === 1 || state.settings?.autoEvoChoice) {
    // Single choice or auto mode: pick immediately
    evolvePokemon(pokemon, valid[Math.floor(Math.random() * valid.length)].to);
    return true;
  }

  // Multiple choices + manual mode: show card popup
  showEvolutionChoicePopup(pokemon, valid, targetEN => {
    evolvePokemon(pokemon, targetEN);
    _pcLastRenderKey = '';
    if (activeTab === 'tabPC') renderPCTab();
  });
  return false; // evolution pending user choice
}

function showPokemonLevelPopup(pokemon, newLevel) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:80px;right:16px;background:var(--bg-card);border:1px solid var(--gold-dim);border-radius:var(--radius);padding:8px 12px;font-family:var(--font-pixel);font-size:9px;color:var(--gold);z-index:9999;display:flex;align-items:center;gap:8px;animation:fadeIn .2s ease;pointer-events:none';
  el.innerHTML = `<img src="${pokeSprite(pokemon.species_en, pokemon.shiny)}" style="width:32px;height:32px"><span>${speciesName(pokemon.species_en)}<br>Lv.${newLevel} !</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function levelUpPokemon(pokemon, xpGain) {
  pokemon.xp += xpGain;
  const xpNeeded = pokemon.level * 20;
  let leveled = false;
  while (pokemon.xp >= xpNeeded && pokemon.level < 100) {
    pokemon.xp -= xpNeeded;
    pokemon.level++;
    leveled = true;
    if (pokemon.history) {
      pokemon.history.push({ type: 'levelup', ts: Date.now(), level: pokemon.level });
    }
  }
  if (leveled) {
    pokemon.stats = calculateStats(pokemon);
    tryAutoEvolution(pokemon);
    // Show popup only for boss team / active training (not passive background XP spam)
    const isBossTeam = state.gang.bossTeam.includes(pokemon.id);
    const isInTraining = state.trainingRoom?.pokemon?.includes(pokemon.id);
    if (isBossTeam || isInTraining) {
      playSE('level_up', 0.5);
      showPokemonLevelPopup(pokemon, pokemon.level);
      SFX.play('levelUp')
    }
  }
  return leveled;
}

// ════════════════════════════════════════════════════════════════
//  5.  ZONE MODULE
// ════════════════════════════════════════════════════════════════

// Coûts en ₽ pour débloquer des slots d'agents par zone
// slot 2 → 2000₽, slot 3 → 6000₽, etc.
const ZONE_SLOT_COSTS = [2000, 6000, 15000, 50000, 150000]; // base costs (₽)

// → Moved to data/titles-data.js
const LIAISONS = ['', 'de', "de l'", 'du', 'des', 'à', 'et', '&', 'alias', 'dit'];

function getTitleLabel(titleId) {
  return TITLES.find(t => t.id === titleId)?.label || '';
}

function getBossFullTitle() {
  const t1 = getTitleLabel(state.gang.titleA);
  const t2 = getTitleLabel(state.gang.titleB);
  const lia = state.gang.titleLiaison || '';
  if (!t1 && !t2) return 'Recrue';
  if (t1 && !t2) return t1;
  if (!t1 && t2) return t2;
  return `${t1}${lia ? ' ' + lia : ''} ${t2}`;
}

function checkTitleUnlocks() {
  const unlocked = new Set(state.unlockedTitles || []);
  const newOnes = [];
  for (const t of TITLES) {
    if (unlocked.has(t.id)) continue;
    let unlock = false;
    if (t.category === 'rep') {
      unlock = state.gang.reputation >= t.repReq;
    } else if (t.category === 'type_capture') {
      const count = state.pokemons.filter(p => {
        const sp = POKEMON_GEN1.find(s => s.en === p.species_en);
        return sp?.types?.includes(t.typeReq);
      }).length;
      unlock = count >= t.countReq;
    } else if (t.category === 'stat') {
      unlock = (state.stats[t.statReq] || 0) >= t.countReq;
    } else if (t.category === 'special' && t.id === 'fondateur') {
      unlock = true; // toujours débloqué
    } else if (t.category === 'special' && t.id === 'glitcheur') {
      unlock = state.pokemons.some(p => p.species_en === 'missingno');
    } else if (t.category === 'pokedex') {
      if (t.dexType === 'kanto') {
        const kantoCount = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151 && state.pokedex[s.en]?.caught).length;
        const kantoTotal = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151).length;
        unlock = kantoCount >= kantoTotal;
      } else if (t.dexType === 'full') {
        const fullCount = POKEMON_GEN1.filter(s => !s.hidden && state.pokedex[s.en]?.caught).length;
        const fullTotal = POKEMON_GEN1.filter(s => !s.hidden).length;
        unlock = fullCount >= fullTotal;
      }
    } else if (t.category === 'shiny_special') {
      if (t.shinyType === 'starters') {
        unlock = ['bulbasaur','charmander','squirtle'].every(s => state.pokedex[s]?.shiny);
      } else if (t.shinyType === 'legendaries') {
        unlock = POKEMON_GEN1.filter(s => s.rarity === 'legendary' && !s.hidden).every(s => state.pokedex[s.en]?.shiny);
      } else if (t.shinyType === 'full_dex') {
        unlock = POKEMON_GEN1.filter(s => !s.hidden).every(s => state.pokedex[s.en]?.shiny);
      }
    }
    if (unlock) { unlocked.add(t.id); newOnes.push(t); }
  }
  if (newOnes.length > 0) {
    state.unlockedTitles = [...unlocked];
    // Set default titleA to best rep title
    if (!state.gang.titleA) state.gang.titleA = state.unlockedTitles[0] || 'recrue';
    newOnes.forEach(t => notify(`🏆 Titre débloqué : "${t.label}" !`, 'gold'));
    saveState();
  }
}

function updateDiscovery() {
  if (!state.settings.discoveryMode) {
    // Tout visible — aucune restriction
    ['tabMarket','tabPokedex','tabMissions','tabAgents','tabBattleLog','tabCosmetics'].forEach(id => {
      const btn = document.querySelector(`[data-tab="${id}"]`);
      if (btn) btn.style.display = '';
    });
    return;
  }

  const dexCaught = Object.values(state.pokedex).filter(e => e.caught).length;
  const totalFightsWon = state.stats?.totalFightsWon || 0;

  // Marché : débloqué quand 0 balls pour la première fois
  if (!state.discoveryProgress.marketUnlocked) {
    const totalBalls = getTotalBalls();
    if (totalBalls === 0) {
      state.discoveryProgress.marketUnlocked = true;
      saveState();
      notify('🏪 Le Marché est maintenant accessible ! Achète des Balls pour continuer.', 'gold');
    }
  }

  // Pokédex : débloqué quand 5+ espèces capturées
  if (!state.discoveryProgress.pokedexUnlocked && dexCaught >= 5) {
    state.discoveryProgress.pokedexUnlocked = true;
    saveState();
    notify('📖 Le Pokédex est maintenant accessible !', 'gold');
  }

  // Agents : débloqué quand 3+ combats gagnés
  if (!state.discoveryProgress.agentsUnlocked && totalFightsWon >= 3) {
    state.discoveryProgress.agentsUnlocked = true;
    saveState();
    notify('👥 Les Agents sont maintenant accessibles ! Assigne des Pokémon pour récolter en automatique.', 'gold');
  }

  // Missions : débloqué quand 10+ combats gagnés
  if (!state.discoveryProgress.missionsUnlocked && totalFightsWon >= 10) {
    state.discoveryProgress.missionsUnlocked = true;
    saveState();
    notify('📋 Les Missions sont maintenant accessibles !', 'gold');
  }

  // Log de combat : débloqué quand 15+ combats gagnés
  if (!state.discoveryProgress.battleLogUnlocked && totalFightsWon >= 15) {
    state.discoveryProgress.battleLogUnlocked = true;
    saveState();
    notify('⚔ Le Log de combat est maintenant accessible !', 'gold');
  }

  // Cosmétiques : débloqué quand 30+ combats gagnés
  if (!state.discoveryProgress.cosmeticsUnlocked && totalFightsWon >= 30) {
    state.discoveryProgress.cosmeticsUnlocked = true;
    saveState();
    notify('🎨 Les Cosmétiques sont maintenant accessibles !', 'gold');
  }

  // Appliquer la visibilité
  // PC (Pokémon) : TOUJOURS visible, jamais masqué
  const pcBtn = document.querySelector('[data-tab="tabPC"]');
  if (pcBtn) pcBtn.style.display = '';

  const marketBtn = document.querySelector('[data-tab="tabMarket"]');
  if (marketBtn) marketBtn.style.display = state.discoveryProgress.marketUnlocked ? '' : 'none';

  const dexBtn = document.querySelector('[data-tab="tabPokedex"]');
  if (dexBtn) dexBtn.style.display = state.discoveryProgress.pokedexUnlocked ? '' : 'none';

  const agentsBtn = document.querySelector('[data-tab="tabAgents"]');
  if (agentsBtn) agentsBtn.style.display = state.discoveryProgress.agentsUnlocked ? '' : 'none';

  const missionsBtn = document.querySelector('[data-tab="tabMissions"]');
  if (missionsBtn) missionsBtn.style.display = state.discoveryProgress.missionsUnlocked ? '' : 'none';

  const battleLogBtn = document.querySelector('[data-tab="tabBattleLog"]');
  if (battleLogBtn) battleLogBtn.style.display = state.discoveryProgress.battleLogUnlocked ? '' : 'none';

  const cosmeticsBtn = document.querySelector('[data-tab="tabCosmetics"]');
  if (cosmeticsBtn) cosmeticsBtn.style.display = state.discoveryProgress.cosmeticsUnlocked ? '' : 'none';
}

function openTitleModal() {
  const unlocked = new Set(state.unlockedTitles || []);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9700;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:16px';

  // Slot colors: 1=gold, 2=red, 3=cyan, 4=violet
  const SLOT_DEFS = [
    { key:'titleA', label:'Titre 1', color:'var(--gold)',     bg:'rgba(255,204,90,.15)' },
    { key:'titleB', label:'Titre 2', color:'var(--red)',      bg:'rgba(204,51,51,.15)' },
    { key:'titleC', label:'Badge 1', color:'#4fc3f7',         bg:'rgba(79,195,247,.12)' },
    { key:'titleD', label:'Badge 2', color:'#ce93d8',         bg:'rgba(206,147,216,.12)' },
  ];

  const categories = {
    rep:'Réputation', type_capture:'Type', stat:'Exploit',
    shop:'Boutique', special:'Spécial',
    pokedex:'Pokédex', shiny_special:'Chromatique'
  };

  let _activeSlot = 0; // index into SLOT_DEFS

  const renderModal = () => {
    const slots = SLOT_DEFS.map(s => state.gang[s.key]);
    const lia = state.gang.titleLiaison || '';
    const activeSlotDef = SLOT_DEFS[_activeSlot];

    const liaOptions = LIAISONS.map(l => `<option value="${l}" ${l === lia ? 'selected' : ''}>${l || '(aucun)'}</option>`).join('');

    // ── Slot selector buttons ──────────────────────────────────
    const slotBtns = SLOT_DEFS.map((s, i) => {
      const isActive = i === _activeSlot;
      const val = slots[i];
      const lbl = val ? getTitleLabel(val) : '—';
      return `<button class="slot-sel-btn" data-slot="${i}"
        style="flex:1;font-family:var(--font-pixel);font-size:7px;padding:5px 4px;border-radius:var(--radius-sm);cursor:pointer;
               background:${isActive ? s.bg : 'var(--bg)'};
               border:2px solid ${isActive ? s.color : 'var(--border)'};
               color:${isActive ? s.color : 'var(--text-dim)'}">
        ${s.label}<br><span style="font-size:6px;opacity:.8">${lbl}</span>
      </button>`;
    }).join('');

    // ── Liaison row (only relevant for titleA+titleB) ──────────
    const liaRow = `<div style="display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;margin-top:6px">
      <span style="font-size:8px;color:var(--text-dim)">Liaison :</span>
      <select id="titleLiaison" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;font-size:8px;padding:2px 4px">${liaOptions}</select>
      <button id="btnClearTitles" style="font-size:7px;padding:2px 6px;background:var(--bg);border:1px solid var(--border);border-radius:3px;color:var(--text-dim);cursor:pointer">Tout effacer</button>
    </div>`;

    let titlesHtml = '';
    for (const [cat, catLabel] of Object.entries(categories)) {
      const group = TITLES.filter(t => t.category === cat);
      if (group.length === 0) continue;
      titlesHtml += `<div style="margin-bottom:12px">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">${catLabel}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">`;
      for (const t of group) {
        const isUnlocked = unlocked.has(t.id);
        const slotIdx = slots.findIndex(s => s === t.id);
        let hint = '';
        if (!isUnlocked) {
          if (t.category === 'rep') hint = `⭐ ${t.repReq} rep`;
          else if (t.category === 'type_capture') hint = `${t.countReq}× type ${t.typeReq}`;
          else if (t.category === 'stat') hint = `${t.countReq}× ${t.statReq}`;
          else if (t.category === 'shop') hint = `${(t.shopPrice||0).toLocaleString()}₽`;
          else if (t.category === 'pokedex') hint = t.dexType === 'kanto' ? 'Compléter le Pokédex Kanto (151)' : 'Compléter tout le Pokédex';
          else if (t.category === 'shiny_special') hint = t.shinyType === 'starters' ? '3 starters chromatiques' : t.shinyType === 'legendaries' ? 'Tous légendaires chromatiques' : 'Pokédex chromatique complet';
          else hint = '???';
        }
        const assigned = slotIdx >= 0;
        const assignedColor = assigned ? SLOT_DEFS[slotIdx].color : '';
        const assignedBg    = assigned ? SLOT_DEFS[slotIdx].bg    : '';
        const style = isUnlocked
          ? `background:${assigned ? assignedBg : 'var(--bg-card)'};border:1px solid ${assigned ? assignedColor : 'var(--border)'};color:${assigned ? assignedColor : 'var(--text)'};cursor:pointer`
          : 'background:var(--bg);border:1px solid var(--border);color:var(--text-dim);opacity:.4;cursor:not-allowed';
        const badge = assigned ? ` <span style="font-size:6px;opacity:.7">${SLOT_DEFS[slotIdx].label}</span>` : '';
        titlesHtml += `<div class="title-chip ${isUnlocked ? 'title-unlocked' : 'title-locked'}" data-title-id="${t.id}"
          style="font-family:var(--font-pixel);font-size:8px;padding:4px 8px;border-radius:var(--radius-sm);${style}"
          title="${isUnlocked ? (assigned ? `Slot: ${SLOT_DEFS[slotIdx].label} — Cliquer pour retirer` : `Assigner au ${activeSlotDef.label}`) : hint}">
          ${t.label}${badge}
        </div>`;
      }
      titlesHtml += '</div></div>';
    }

    // Current title preview
    const mainTitle = getBossFullTitle();
    const tC = getTitleLabel(state.gang.titleC);
    const tD = getTitleLabel(state.gang.titleD);
    const badgesPreview = [tC, tD].filter(Boolean).map((b, i) => {
      const color = i === 0 ? '#4fc3f7' : '#ce93d8';
      return `<span style="font-family:var(--font-pixel);font-size:7px;padding:2px 6px;border-radius:10px;border:1px solid ${color};color:${color}">${b}</span>`;
    }).join('');

    overlay.innerHTML = `
      <div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);padding:20px;max-width:600px;width:100%;max-height:85vh;display:flex;flex-direction:column;gap:12px;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-family:var(--font-pixel);font-size:11px;color:var(--gold)">🏆 Titres</div>
          <button id="btnCloseTitleModal" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
        </div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;text-align:center">
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold-dim);margin-bottom:4px">${mainTitle}</div>
          ${badgesPreview ? `<div style="display:flex;gap:6px;justify-content:center;margin-bottom:4px">${badgesPreview}</div>` : ''}
          ${liaRow}
        </div>
        <div style="display:flex;gap:6px">
          <span style="font-size:8px;color:var(--text-dim);align-self:center;white-space:nowrap">Slot actif :</span>
          ${slotBtns}
        </div>
        <div style="font-size:8px;color:var(--text-dim);text-align:center">
          Clic → Assigner au <span style="color:${activeSlotDef.color}">${activeSlotDef.label}</span> &nbsp;|&nbsp; Clic sur badge → Retirer
        </div>
        <div style="overflow-y:auto;flex:1">${titlesHtml}</div>
      </div>`;

    overlay.querySelector('#btnCloseTitleModal')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#titleLiaison')?.addEventListener('change', e => {
      state.gang.titleLiaison = e.target.value;
      saveState(); renderModal();
      if (activeTab === 'tabGang') renderGangTab();
    });
    overlay.querySelector('#btnClearTitles')?.addEventListener('click', () => {
      state.gang.titleA = 'recrue'; state.gang.titleB = null;
      state.gang.titleC = null;    state.gang.titleD = null;
      saveState(); renderModal();
      if (activeTab === 'tabGang') renderGangTab();
    });

    // Slot selector clicks
    overlay.querySelectorAll('.slot-sel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeSlot = Number(btn.dataset.slot);
        renderModal();
      });
    });

    // Title chip clicks
    overlay.querySelectorAll('.title-unlocked').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.titleId;
        const slotKey = SLOT_DEFS[_activeSlot].key;
        // If already in this slot → deselect
        if (state.gang[slotKey] === id) {
          state.gang[slotKey] = _activeSlot === 0 ? 'recrue' : null;
        } else {
          // Remove from any other slot first (avoid duplicates)
          for (const s of SLOT_DEFS) {
            if (state.gang[s.key] === id) state.gang[s.key] = s.key === 'titleA' ? null : null;
          }
          state.gang[slotKey] = id;
        }
        saveState(); renderModal();
        if (activeTab === 'tabGang') renderGangTab();
      });
    });
  };

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  renderModal();
}

function getZoneSlotCost(zoneId, slotIndex) { return globalThis._zsys_getZoneSlotCost(zoneId, slotIndex); }

function initZone(zoneId) { return globalThis._zsys_initZone(zoneId); }

function isZoneUnlocked(zoneId) { return globalThis._zsys_isZoneUnlocked(zoneId); }

// Is a zone in "degraded" mode? (rep below threshold → combat only, no pokemon spawns)
function isZoneDegraded(zoneId) { return globalThis._zsys_isZoneDegraded(zoneId); }

function getZoneMastery(zoneId) { return globalThis._zsys_getZoneMastery(zoneId); }

function getZoneAgentSlots(zoneId) { return globalThis._zsys_getZoneAgentSlots(zoneId); }

// ZONE_DIFFICULTY_SCALING → now defined in modules/systems/zoneSystem.js, exposed on globalThis.ZONE_DIFFICULTY_SCALING

// Open zone windows tracking
const openZones = new Set();
const zoneSpawnTimers = {};
const zoneSpawns = {}; // zoneId -> [{ type, data, el, timeout }]
// Expose for agent module (const objects — mutated in-place, reference stays valid)
globalThis.openZones = openZones;
globalThis.zoneSpawns = zoneSpawns;
globalThis.zoneSpawnTimers = zoneSpawnTimers;

// Background zone timers (closed zones with ≥1 agent assigned)
// Tick at real spawn rate — agent module resolves spawns silently
const backgroundZoneTimers = {};
globalThis.backgroundZoneTimers = backgroundZoneTimers;

// masteryLevel (1-3) permet de renforcer les équipes ennemies selon la progression de zone.
function makeTrainerTeam(zone, trainerKey, forcedSize, masteryLevel = 1) { return globalThis._zsys_makeTrainerTeam(zone, trainerKey, forcedSize, masteryLevel); }

// Build a raid: 2-3 trainers combined into one encounter
function makeRaidSpawn(zone, zoneId, masteryLevel = 1) { return globalThis._zsys_makeRaidSpawn(zone, zoneId, masteryLevel); }

function spawnInZone(zoneId) { return globalThis._zsys_spawnInZone(zoneId); }

// ── Chest loot resolution ─────────────────────────────────────
function rollChestLoot(zoneId, passive = false) { return globalThis._zsys_rollChestLoot(zoneId, passive); }

// ── Event activation/resolution ───────────────────────────────
function activateEvent(zoneId, event) { return globalThis._zsys_activateEvent(zoneId, event); }

// ── Zone Investment ───────────────────────────────────────────
function investInZone(zoneId) { return globalThis._zsys_investInZone(zoneId); }

// ════════════════════════════════════════════════════════════════
//  6.  CAPTURE MODULE
// ════════════════════════════════════════════════════════════════

function tryCapture(zoneId, speciesEN, bonusPotential = 0) { return globalThis._zsys_tryCapture(zoneId, speciesEN, bonusPotential); }

// ════════════════════════════════════════════════════════════════
//  7.  COMBAT MODULE
// ════════════════════════════════════════════════════════════════

// Rep par combat : +1 dresseur normal / +10 spécial (arène, Elite 4, persos d'histoire) / -5 en cas de défaite
function getCombatRepGain(trainerKey, win) { return globalThis._zsys_getCombatRepGain(trainerKey, win); }

function getTeamPower(pokemonIds) {
  let power = 0;
  for (const id of pokemonIds) {
    const p = state.pokemons.find(pk => pk.id === id);
    if (p) power += getPokemonPower(p);
  }
  return power;
}

function resolveCombat(playerTeamIds, trainerData) { return globalThis._zsys_resolveCombat(playerTeamIds, trainerData); }

function applyCombatResult(result, playerTeamIds, trainerData) { return globalThis._zsys_applyCombatResult(result, playerTeamIds, trainerData); }

// ── Zone unlock detection ──────────────────────────────────────
function checkForNewlyUnlockedZones(prevRep) { return globalThis._zsys_checkForNewlyUnlockedZones(prevRep); }
function showZoneUnlockPopup(zone)            { return globalThis._zsys_showZoneUnlockPopup(zone); }
function _processZoneUnlockQueue()            { return globalThis._zsys_processZoneUnlockQueue(); }

// ── getMissionStat … claimMission extracted → modules/systems/missions.js ──

// ── getAgentRecruitCost … agentOpenChest extracted → modules/systems/agent.js ──

// ── calculatePrice … buyItem extracted → modules/systems/market.js ──

// ── detectLLM … getTrainerDialogue extracted → modules/systems/llm.js ──

// ════════════════════════════════════════════════════════════════
// 11.  UI — NOTIFICATIONS
// ════════════════════════════════════════════════════════════════

function notify(msg, type = '') {
  const container = document.getElementById('notifications');
  if (!container) return;
  if (type === 'gold') SFX.play('notify');
  // Stack identical toasts instead of spamming duplicates
  const existing = [...container.querySelectorAll('.toast')].find(el =>
    el.dataset.notifyMsg === msg && el.dataset.notifyType === (type || '')
  );
  if (existing) {
    const count = (parseInt(existing.dataset.notifyCount) || 1) + 1;
    existing.dataset.notifyCount = String(count);
    existing.textContent = `${msg} ×${count}`;
    clearTimeout(parseInt(existing.dataset.timerId || '0'));
    const tid = setTimeout(() => { existing.classList.add('leaving'); setTimeout(() => existing.remove(), 300); }, 3000);
    existing.dataset.timerId = String(tid);
    return;
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  el.dataset.notifyMsg = msg;
  el.dataset.notifyType = type || '';
  el.dataset.notifyCount = '1';
  container.appendChild(el);
  const tid = setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 300); }, 3000);
  el.dataset.timerId = String(tid);
}

// Milestone : 10 000 000₽ → Charme Chroma
function checkMoneyMilestone() {
  if (state?.purchases?.chromaCharm) return;
  if (state.gang.money >= 10_000_000) {
    state.gang.money -= 10_000_000;
    state.purchases.chromaCharm = true;
    saveState();
    SFX.play('unlock');
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.96);display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:var(--bg-panel);border:3px solid var(--red);border-radius:var(--radius);padding:28px 32px;max-width:440px;width:92%;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px">
        <img src="https://lab.sterenna.fr/PG/pokegang_logo.png" style="width:72px;height:72px;image-rendering:pixelated" onerror="this.style.display='none'">
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--red);letter-spacing:2px">⚠ ALERTE — 10 000 000₽ DÉTECTÉS</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:20px">
          <img src="${trainerSprite('scientist')}" style="width:52px;height:52px;image-rendering:pixelated">
          <img src="${trainerSprite('giovanni')}" style="width:52px;height:52px;image-rendering:pixelated">
        </div>
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);line-height:2">
          L'équipe de développement vous remercie<br>
          pour ces ressources utiles à la création<br>
          de son empire...<br>
          <span style="font-size:13px;color:var(--red)">MOUAHAHAHA !</span>
        </div>
        <div style="font-size:10px;color:var(--text-dim);line-height:1.6">
          Vos <b style="color:var(--red)">10 000 000₽</b> ont été convertis en<br>
          <b style="color:var(--gold)">✨ Charme Chroma</b> — taux shiny ×2 permanent !
        </div>
        <button style="font-family:var(--font-pixel);font-size:9px;padding:9px 24px;background:var(--red-dark);border:2px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer" id="btnChromaCharmClose">... Très bien.</button>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#btnChromaCharmClose').addEventListener('click', () => modal.remove());
    notify('✨ Charme Chroma obtenu ! Taux shiny ×2', 'gold');
  }
}

// ── Cheat Codes ───────────────────────────────────────────────
const _CHEAT_CODES = {
  [btoa('RICHISSIM')]:       { money: 5_000_000 },
  [btoa('DOUBLERICHISSIM')]: { money: 10_000_000, title: 'doublerichissim' },
};
const _usedCodes = new Set();

function tryCheatCode(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const raw = input.value.trim().toUpperCase();
  input.value = '';
  if (!raw) return;

  // 1. Essaie d'abord SECRET_CODES (codes titres, codes spéciaux)
  if (checkSecretCode(raw)) {
    // checkSecretCode gère déjà les notifications et la sauvegarde
    // Refresh cosmétiques si tab actif
    if (activeTab === 'tabCosmetics') renderCosmeticsTab();
    return;
  }

  // 2. Sinon legacy _CHEAT_CODES
  const key = btoa(raw);
  if (_usedCodes.has(key)) { notify('❌ Code déjà utilisé cette session', 'error'); return; }
  const code = _CHEAT_CODES[key];
  if (!code) { notify('❌ Code invalide', 'error'); SFX.play('error'); return; }
  _usedCodes.add(key);
  if (code.money) {
    state.gang.money += code.money;
    updateTopBar();
    notify(`💰 +${code.money.toLocaleString()}₽ !`, 'gold');
    SFX.play('unlock');
  }
  if (code.title) {
    state.purchases[`title_${code.title}`] = true;
    notify(`🏆 Titre obtenu : ${code.title}`, 'gold');
  }
  saveState();
  if (activeTab === 'tabCosmetics') renderCosmeticsTab();
}

// ── Gym Raid (manual + auto) ──────────────────────────────────
function triggerGymRaid(zoneId, isAuto) { return globalThis._zsys_triggerGymRaid(zoneId, isAuto); }

// ════════════════════════════════════════════════════════════════
// 12.  UI — TABS & LAYOUT
// ════════════════════════════════════════════════════════════════

let activeTab = 'tabZones';
// zoneFilter state is now managed inside modules/ui/zoneSelector.js

function hintLink(label, tabId) {
  return `<button onclick="switchTab('${tabId}')" style="font-family:var(--font-pixel);font-size:9px;color:var(--red);background:none;border:none;border-bottom:1px solid var(--red);cursor:pointer;padding:0">${label}</button>`;
}

function getTabHint(tabId) {
  const pc       = state.pokemons.length;
  const agents   = state.agents.length;
  const money    = state.gang.money;
  const bossTeam = state.gang.bossTeam.length;
  const hasZone  = openZones.size > 0;

  switch (tabId) {
    case 'tabGang':
      if (!state.gang.initialized) return 'Crée ton gang pour commencer.';
      if (bossTeam === 0 && pc === 0) return `Capture des Pokémon dans ${hintLink('Zones', 'tabZones')} puis assigne-en à ton équipe Boss.`;
      if (bossTeam === 0) return `Assigne des Pokémon à ton équipe Boss depuis le ${hintLink('PC', 'tabPC')} — clique sur un Pokémon → Équipe.`;
      if (!hasZone) return `Ouvre une zone dans ${hintLink('Zones', 'tabZones')} pour explorer et combattre.`;
      return `Vitrine : montre tes meilleurs Pokémon. L\'équipe Boss combat quand tu entres en zone.`;
    case 'tabAgents':
      if (pc === 0) return `Capture des Pokémon en ${hintLink('Zones', 'tabZones')} — tu pourras en recruter comme agents.`;
      if (agents === 0) return `Recrute un agent depuis le ${hintLink('PC', 'tabPC')} : clique sur un Pokémon → Recruter Agent. Les agents explorent les zones et ramènent de l'argent automatiquement.`;
      if (!hasZone) return `Assigne tes agents à une zone depuis ${hintLink('Zones', 'tabZones')} ou directement ici via le menu déroulant.`;
      return `Les agents assignés à une zone génèrent des ₽ toutes les 5 min. Collecte depuis l'onglet ${hintLink('Zones', 'tabZones')}.`;
    case 'tabZones':
      if (!hasZone) return `Clique sur <b>Route 1</b> puis sur <b>Ouvrir</b> pour explorer ta première zone.`;
      if (bossTeam === 0) return `Entre dans une zone avec ton boss — assigne d'abord un Pokémon à ton équipe depuis le ${hintLink('PC', 'tabPC')}.`;
      return `Capture des Pokémon, bats des dresseurs. 10 victoires → combats élites. Clique 💰 pour collecter les revenus.`;
    case 'tabBag':
      return null;
    case 'tabMarket':
      if (money < 500) return `Tu n'as presque plus d'argent. Bats des dresseurs ou vends des Pokémon en double depuis le ${hintLink('PC', 'tabPC')}.`;
      if (!state.inventory.pokeball) return `Achète des Pokéballs (100₽) dans la boutique pour pouvoir capturer des Pokémon.`;
      return `Boutique : Pokéballs, objets de boost, incubateurs. Quêtes : missions journalières pour des récompenses.`;
    case 'tabPC':
      if (pc === 0) return `Ton PC est vide. Capture des Pokémon en ${hintLink('Zones', 'tabZones')} pour les voir ici.`;
      if (bossTeam === 0) return `Clique sur un Pokémon → menu → <b>Équipe Boss</b> pour l'ajouter à ton équipe de combat.`;
      return `Filtre (Eq/Tr/PS), trie par prix/niveau/potentiel, vends les doublons.`;
    case 'tabTraining':
      if (pc === 0) return `Capture des Pokémon en ${hintLink('Zones', 'tabZones')} pour les entraîner.`;
      return `Place 2 à 6 Pokémon — ils s'affrontent automatiquement toutes les 60s. Gagnant : XP ×1.25, tous gagnent de l'XP.`;
    case 'tabLab':
      if (pc < 3) return `Capture plusieurs exemplaires du même Pokémon pour les fusionner au Labo et augmenter le Potentiel.`;
      return `Potentiel (⭐) = multiplicateur de prix et de stats. Sacrifie des doublons pour monter jusqu'à 5⭐ (max).`;
    case 'tabMissions':
      return `Missions journalières et hebdomadaires = source de ₽ et d'objets rares. Reviens chaque jour.`;
    case 'tabPokedex':
      return `Kanto ${getDexKantoCaught()}/${KANTO_DEX_SIZE} · National ${getDexNationalCaught()}/${NATIONAL_DEX_SIZE} · Chromas ${getShinySpeciesCount()} espèces. Explore toutes les zones pour compléter !`;
    default:
      return null;
  }
}

// ── First-visit contextual hint (non-bloquant, disparaît en 6s ou au clic) ──
const _FIRST_VISIT_HINTS = {
  tabGang:     { icon: '👑', title: 'Ton Gang', body: 'C\'est ta base. Gère ton équipe Boss, place des Pokémon en vitrine et exporte ta fiche.' },
  tabAgents:   { icon: '👥', title: 'Les Agents', body: 'Assigne-leur une zone → ils récoltent de l\'argent automatiquement, même quand tu ne joues pas.' },
  tabZones:    { icon: '🗺', title: 'Zones', body: 'Explore des zones avec ton Boss pour capturer des Pokémon et battre des dresseurs. Plus tu progresses, plus tu débloques de zones.' },
  tabMarket:   { icon: '🛒', title: 'Marché', body: 'Achète des Pokéballs pour capturer, des incubateurs pour faire éclore des œufs, et plus encore.' },
  tabPC:       { icon: '💾', title: 'Le PC', body: 'Tous tes Pokémon sont ici. Assigne-les à ton équipe, à un agent, à la pension ou à la salle d\'entraînement.' },
  tabTraining: { icon: '🏋', title: 'Salle d\'entraînement', body: 'Tes Pokémon s\'entraînent automatiquement. Parfait pour monter en niveau des Pokémon que tu n\'utilises pas.' },
  tabLab:      { icon: '🔬', title: 'Laboratoire', body: 'Le Potentiel (⭐) multiplie la valeur et les stats d\'un Pokémon. Fusionne des doublons pour monter jusqu\'à 5⭐.' },
  tabMissions: { icon: '📋', title: 'Missions', body: 'Objectifs quotidiens et hebdomadaires. Complète-les pour des ₽ et des objets rares.' },
  tabPokedex:  { icon: '📖', title: 'Pokédex', body: 'Chaque espèce capturée est enregistrée ici. Vise 151/151 pour tout débloquer.' },
};

function showFirstVisitHint(tabId) {
  const def = _FIRST_VISIT_HINTS[tabId];
  if (!def) return;
  // Remove any existing hint
  document.getElementById('firstVisitHint')?.remove();

  const el = document.createElement('div');
  el.id = 'firstVisitHint';
  el.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:4000;
    background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);
    padding:12px 14px;max-width:260px;box-shadow:0 4px 20px rgba(0,0,0,.6);
    animation:fvhIn .3s ease;cursor:pointer;
  `;
  el.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px">
      <span style="font-size:20px;flex-shrink:0">${def.icon}</span>
      <div>
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);margin-bottom:4px">${def.title}</div>
        <div style="font-size:10px;color:var(--text-dim);line-height:1.5">${def.body}</div>
      </div>
      <button style="background:none;border:none;color:var(--text-dim);font-size:14px;cursor:pointer;padding:0;flex-shrink:0;line-height:1" onclick="document.getElementById('firstVisitHint')?.remove()">✕</button>
    </div>`;

  document.body.appendChild(el);

  // Auto-dismiss after 7s
  const timer = setTimeout(() => {
    el.style.animation = 'fvhOut .3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 7000);
  el.addEventListener('click', () => { clearTimeout(timer); el.remove(); });
}

function renderHint(tabId) {
  const bar = document.getElementById('hintBar');
  if (!bar) return;
  const hint = getTabHint(tabId);
  if (hint) {
    bar.innerHTML = '&gt;&gt; ' + hint;
    bar.style.display = 'block';
  } else {
    bar.style.display = 'none';
  }
}

// Track which tabs have been seen (first-visit hints)
const _visitedTabs = new Set(JSON.parse(sessionStorage.getItem('pg_visited_tabs') || '[]'));

// ── "Ball assist" early-game helper (silencieux, jamais affiché au joueur) ──
let _ballAssistUntil = 0; // timestamp de fin de l'assist en cours

function getTotalBalls() {
  const inv = state.inventory;
  return (inv.pokeball || 0) + (inv.greatball || 0) + (inv.ultraball || 0)
       + (inv.duskball || 0) + (inv.masterball || 0);
}

function checkBallAssist() {
  if (Date.now() < _ballAssistUntil) return; // déjà actif
  if (getTotalBalls() < 10) {
    _ballAssistUntil = Date.now() + 2 * 60 * 1000; // 2 minutes
  }
}

function isBallAssistActive() {
  return Date.now() < _ballAssistUntil;
}

// ════════════════════════════════════════════════════════════════
// RACCOURCIS CLAVIER GLOBAUX
//  1-7 → onglets  |  Échap → ferme modale/fenêtre de zone
// ════════════════════════════════════════════════════════════════
function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    // Ignore si le focus est dans un champ texte
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    // Ignore si une modale bloquante est ouverte
    if (document.getElementById('settingsModal')?.classList.contains('active')) return;
    if (document.getElementById('confirmModal')) return;

    switch (e.key) {
      // ── Onglets principaux ───────────────────────────────────
      case '1': switchTab('tabZones');    break;
      case '2': switchTab('tabPC');       break;
      case '3': switchTab('tabAgents');   break;
      case '4': switchTab('tabMarket');   break;
      case '5': switchTab('tabGang');     break;
      case '6': switchTab('tabPokedex');  break;
      case '7': switchTab('tabCosmetics'); break;

      // ── Sous-vues PC ─────────────────────────────────────────
      case 'p': case 'P':
        pcView = 'grid'; switchTab('tabPC'); break;
      case 'e': case 'E':
        pcView = 'eggs'; switchTab('tabPC'); break;
      case 't': case 'T':
        pcView = 'training'; switchTab('tabPC'); break;
      case 'l': case 'L':
        pcView = 'lab'; switchTab('tabPC'); break;

      // ── Fermeture rapide ─────────────────────────────────────
      case 'Escape': {
        // Ferme d'abord les fenêtres de zone ouvertes
        if (openZones && openZones.size > 0) {
          for (const zid of [...openZones]) closeZoneWindow(zid);
        }
        break;
      }
    }
  });
}

function switchTab(tabId) {
  if (tabId !== 'tabPC') _pcLastRenderKey = ''; // force full rebuild on next PC visit
  SFX.play('tabSwitch');
  activeTab = tabId;
  globalThis.activeTab = activeTab;
  globalThis.pcView = pcView; // sync in case pcView changed before this call
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
  renderHint(tabId);
  renderActiveTab();
  MusicPlayer.updateFromContext();
  updateTopBar(); // refresh objective / session on tab change
  // First-visit contextual hint
  if (!_visitedTabs.has(tabId)) {
    _visitedTabs.add(tabId);
    sessionStorage.setItem('pg_visited_tabs', JSON.stringify([..._visitedTabs]));
    showFirstVisitHint(tabId);
  }
  // Behavioural log — compteur de visites par onglet
  if (!state.behaviourLogs) state.behaviourLogs = {};
  if (!state.behaviourLogs.tabViewCounts) state.behaviourLogs.tabViewCounts = {};
  state.behaviourLogs.tabViewCounts[tabId] = (state.behaviourLogs.tabViewCounts[tabId] || 0) + 1;
}

function updateTopBar() {
  const gangEl = document.getElementById('gangNameDisplay');
  const moneyEl = document.getElementById('moneyDisplay');
  if (gangEl) {
    const kantoComplete = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151).every(s => state.pokedex[s.en]?.caught);
    const fullComplete  = POKEMON_GEN1.filter(s => !s.hidden).every(s => state.pokedex[s.en]?.caught);
    const dexIcon = fullComplete ? ' 🌟' : kantoComplete ? ' 📖' : '';
    gangEl.textContent = state.gang.name + dexIcon;
  }
  if (moneyEl) moneyEl.innerHTML = `<span>₽</span> ${state.gang.money.toLocaleString()}`;
  const repEl = document.getElementById('repDisplay');
  if (repEl) repEl.innerHTML = `<span>⭐</span> ${state.gang.reputation.toLocaleString()}`;
  const pkCountEl = document.getElementById('pokemonCountDisplay');
  if (pkCountEl) pkCountEl.innerHTML = `<img src="${ITEM_SPRITE_URLS.pokeball}" style="width:20px;height:20px;image-rendering:pixelated" onerror="this.style.display='none'"> ${state.pokemons.length.toLocaleString()}`;

  // ── Ball assist silencieux (early-game) ───────────────────
  checkBallAssist();
  checkTitleUnlocks();
  updateDiscovery();
  // Auto-buy ball
  if (state.settings.autoBuyBall) {
    const ballId = state.settings.autoBuyBall;
    if ((state.inventory[ballId] || 0) === 0) {
      const ballDef = BALLS[ballId];
      if (ballDef && state.gang.money >= ballDef.cost) {
        state.inventory[ballId] = (state.inventory[ballId] || 0) + 1;
        state.gang.money -= ballDef.cost;
        notify(`🔄 Achat auto : 1× ${ballDef.fr}`, 'success');
      }
    }
  }

  // ── Session delta bar ──────────────────────────────────────
  _saveSessionActivity();
  const sessionBar = document.getElementById('sessionBar');
  if (sessionBar) {
    const delta = getSessionDelta();
    if (delta) {
      sessionBar.innerHTML = `<span style="color:var(--text-dim);font-family:var(--font-pixel);font-size:7px;letter-spacing:.05em">SESSION</span> ${delta}`;
      sessionBar.style.display = 'flex';
    } else {
      sessionBar.style.display = 'none';
    }
  }

  // ── Objective bar ──────────────────────────────────────────
  const objBar = document.getElementById('objectiveBar');
  if (objBar) {
    const obj = getNextObjective();
    if (obj) {
      const tabBtn = obj.tab
        ? `<button onclick="switchTab('${obj.tab}')" style="font-family:var(--font-pixel);font-size:7px;color:var(--red);background:none;border:none;border-bottom:1px solid var(--red);cursor:pointer;padding:0;margin-left:6px">${obj.detail || obj.tab}</button>`
        : (obj.detail ? `<span style="color:var(--text-dim);font-size:9px;margin-left:6px">${obj.detail}</span>` : '');
      objBar.innerHTML = `<span style="font-family:var(--font-pixel);font-size:7px;color:var(--gold-dim,#999);margin-right:6px">▶</span><span style="font-size:9px;color:var(--text)">${obj.text}</span>${tabBtn}`;
      objBar.style.display = 'flex';
    } else {
      objBar.style.display = 'none';
    }
  }
}

function renderAll() {
  updateTopBar();
  renderHint(activeTab);
  renderActiveTab();
}

function renderActiveTab() {
  switch (activeTab) {
    case 'tabGang':     renderGangTab(); break;
    case 'tabZones':    renderZonesTab(); break;
    case 'tabMarket':   renderMarketTab(); break;
    case 'tabPC':       renderPCTab(); break;
    case 'tabPokedex':  renderPokedexTab(); break;
    case 'tabAgents':   renderAgentsTab(); break;
    case 'tabBag':        switchTab('tabMarket'); break;
    case 'tabCosmetics':   renderCosmeticsTab(); break;
    case 'tabMissions':    renderMissionsTab(); break;
    case 'tabBattleLog':   renderEventsTab(); break;
    case 'tabTraining': pcView = 'training'; switchTab('tabPC'); break;
    case 'tabLab':      pcView = 'lab'; switchTab('tabPC'); break;
    case 'tabLeaderboard': renderLeaderboardTab(); break;
    case 'tabCompte':      renderCompteTab(); break;
  }
}

// ════════════════════════════════════════════════════════════════
//  SAVE SLOTS
// ════════════════════════════════════════════════════════════════

function getSlotPreview(slotIdx) {
  const raw = localStorage.getItem(SAVE_KEYS[slotIdx]);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    const teamIds = s.gang?.bossTeam || [];
    const teamSprites = teamIds.slice(0, 3).map(id => {
      const pk = (s.pokemons || []).find(p => p.id === id);
      return pk ? pk.species_en : null;
    }).filter(Boolean);
    const agentSprites = (s.agents || []).slice(0, 3).map(a => a.sprite);
    return {
      name: s.gang?.name || '???',
      money: s.gang?.money || 0,
      pokemon: (s.pokemons || []).length,
      rep: s.gang?.reputation || 0,
      ts: s._savedAt || 0,
      playtime: s.playtime || 0,
      bossName: s.gang?.bossName || 'Boss',
      bossSprite: s.gang?.bossSprite || '',
      teamSprites,
      agentCount: (s.agents || []).length,
      agentSprites,
    };
  } catch { return null; }
}

function openSaveSlotModal() {
  const overlay = document.createElement('div');
  overlay.id = 'saveSlotModal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center';

  const slots = [0, 1, 2].map(i => {
    const prev = getSlotPreview(i);
    const isActive = i === activeSaveSlot;
    const label = prev
      ? `<div style="font-family:var(--font-pixel);font-size:9px;color:${isActive ? 'var(--gold)' : 'var(--text)'};margin-bottom:4px">${prev.name}</div>
         <div style="font-size:10px;color:var(--text-dim)">${prev.pokemon} Pokemon  |  ${prev.money.toLocaleString()}P  |  Rep ${prev.rep}</div>
         <div style="font-size:9px;color:var(--text-dim);margin-top:2px">${prev.ts ? new Date(prev.ts).toLocaleString() : ''}${prev.playtime ? ' — ' + formatPlaytime(prev.playtime) : ''}</div>`
      : `<div style="font-size:10px;color:var(--text-dim);font-style:italic">Slot vide</div>`;
    return `<div style="border:2px solid ${isActive ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius);padding:12px;margin-bottom:10px;background:var(--bg-panel)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim)">SLOT ${i + 1}</span>
        ${isActive ? '<span style="font-size:9px;color:var(--gold);margin-left:auto">[ACTIF]</span>' : ''}
      </div>
      ${label}
      <div style="display:flex;gap:6px;margin-top:10px">
        ${prev ? `<button class="slot-load" data-slot="${i}" style="flex:1;font-size:9px;padding:5px;background:var(--bg);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--green);cursor:pointer">Charger</button>` : ''}
        <button class="slot-save" data-slot="${i}" style="flex:1;font-size:9px;padding:5px;background:var(--bg);border:1px solid var(--blue);border-radius:var(--radius-sm);color:var(--blue);cursor:pointer">Sauvegarder</button>
        ${prev && !isActive ? `<button class="slot-del" data-slot="${i}" style="flex:1;font-size:9px;padding:5px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">Supprimer</button>` : ''}
      </div>
    </div>`;
  }).join('');

  overlay.innerHTML = `<div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);width:90%;max-width:420px;padding:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <span style="font-family:var(--font-pixel);font-size:11px;color:var(--gold)">SAUVEGARDES</span>
      <button id="closeSlotModal" style="background:none;border:none;color:var(--text-dim);font-size:20px;cursor:pointer">&times;</button>
    </div>
    ${slots}
  </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#closeSlotModal').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelectorAll('.slot-load').forEach(btn => {
    btn.addEventListener('click', () => { loadSlot(parseInt(btn.dataset.slot)); overlay.remove(); });
  });
  overlay.querySelectorAll('.slot-save').forEach(btn => {
    btn.addEventListener('click', () => { saveToSlot(parseInt(btn.dataset.slot)); overlay.remove(); });
  });
  overlay.querySelectorAll('.slot-del').forEach(btn => {
    btn.addEventListener('click', () => {
      showConfirm(`Supprimer le slot ${parseInt(btn.dataset.slot) + 1} ?`, () => {
        localStorage.removeItem(SAVE_KEYS[parseInt(btn.dataset.slot)]);
        overlay.remove();
        notify('Slot supprime.', 'success');
      }, null, { danger: true, confirmLabel: 'Supprimer', cancelLabel: 'Annuler' });
    });
  });
}

function saveToSlot(slotIdx) {
  // If switching slot: save current first
  const prev = activeSaveSlot;
  state._savedAt = Date.now();
  localStorage.setItem(SAVE_KEYS[prev], JSON.stringify(state));
  // Now copy to target slot
  activeSaveSlot = slotIdx;
  SAVE_KEY = SAVE_KEYS[slotIdx];
  localStorage.setItem('pokeforge.activeSlot', String(slotIdx));
  saveState();
  notify(`Sauvegarde Slot ${slotIdx + 1}`, 'success');
}

function loadSlot(slotIdx) {
  const raw = localStorage.getItem(SAVE_KEYS[slotIdx]);
  if (!raw) { notify('Slot vide.'); return; }
  try {
    state = migrate(JSON.parse(raw));
    activeSaveSlot = slotIdx;
    SAVE_KEY = SAVE_KEYS[slotIdx];
    localStorage.setItem('pokeforge.activeSlot', String(slotIdx));
    renderAll();
    notify(`Slot ${slotIdx + 1} charge !`, 'success');
  } catch { notify('Erreur de chargement.'); }
}

// ════════════════════════════════════════════════════════════════
//  COSMETICS
// ════════════════════════════════════════════════════════════════

function applyCosmetics() {
  const bgKey = state.cosmetics?.gameBg;
  const bg = bgKey ? COSMETIC_BGS[bgKey] : null;
  const _bgTargets = [document.documentElement, document.body];
  if (bg?.type === 'image') {
    _bgTargets.forEach(el => {
      el.style.backgroundImage = `url('${bg.url}')`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundAttachment = 'fixed';
      el.style.backgroundPosition = 'center';
      el.style.backgroundRepeat = 'no-repeat';
    });
    document.documentElement.style.setProperty('--bg', 'rgba(10,10,10,0.72)');
    document.documentElement.style.setProperty('--bg-card', 'rgba(20,20,20,0.70)');
    document.documentElement.style.setProperty('--bg-panel', 'rgba(26,26,26,0.70)');
    document.documentElement.style.setProperty('--bg-hover', 'rgba(34,34,34,0.80)');
  } else if (bg?.type === 'gradient') {
    _bgTargets.forEach(el => {
      el.style.backgroundImage = bg.gradient;
      el.style.backgroundSize = 'cover';
      el.style.backgroundAttachment = 'fixed';
      el.style.backgroundPosition = 'center';
      el.style.backgroundRepeat = 'no-repeat';
    });
    document.documentElement.style.setProperty('--bg', '#0a0a0a');
    document.documentElement.style.setProperty('--bg-card', '#141414');
    document.documentElement.style.setProperty('--bg-panel', '#1a1a1a');
    document.documentElement.style.setProperty('--bg-hover', '#222');
  } else {
    _bgTargets.forEach(el => { el.style.backgroundImage = ''; });
    document.documentElement.style.setProperty('--bg', '#0a0a0a');
    document.documentElement.style.setProperty('--bg-card', '#141414');
    document.documentElement.style.setProperty('--bg-panel', '#1a1a1a');
    document.documentElement.style.setProperty('--bg-hover', '#222');
  }
}

// ── In-game text input modal — replaces all browser prompt() calls ────────
// opts: { title, placeholder, current, maxLength, cost, confirmLabel, onConfirm }
function openNameModal(opts = {}) {
  const {
    title        = 'Entrer un nom',
    placeholder  = '',
    current      = '',
    maxLength    = 16,
    cost         = 0,
    confirmLabel = 'Confirmer',
    onConfirm    = () => {},
  } = opts;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9600;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:340px;width:92%;display:flex;flex-direction:column;gap:12px">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">${title}</div>
      <input id="nameModalInput" type="text" maxlength="${maxLength}" placeholder="${placeholder}"
        value="${current.replace(/"/g,'&quot;')}"
        style="padding:9px 12px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text);font-size:12px;outline:none;width:100%;box-sizing:border-box">
      ${cost ? `<div style="font-size:8px;color:var(--text-dim);font-family:var(--font-pixel)">Coût : <span style="color:var(--gold)">${cost.toLocaleString()}₽</span> &nbsp;·&nbsp; Solde : ${(state.gang.money||0).toLocaleString()}₽</div>` : ''}
      <div style="display:flex;gap:8px">
        <button id="nameModalConfirm" style="flex:1;font-family:var(--font-pixel);font-size:9px;padding:9px;background:var(--red);border:none;border-radius:var(--radius-sm);color:#fff;cursor:pointer">${confirmLabel}</button>
        <button id="nameModalCancel" style="font-family:var(--font-pixel);font-size:9px;padding:9px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const input   = overlay.querySelector('#nameModalInput');
  const confirm = overlay.querySelector('#nameModalConfirm');
  const cancel  = overlay.querySelector('#nameModalCancel');

  input.focus();
  input.select();

  const submit = () => {
    const val = input.value.trim().slice(0, maxLength);
    if (!val) { input.style.borderColor = 'var(--red)'; return; }
    overlay.remove();
    onConfirm(val);
  };

  confirm.addEventListener('click', submit);
  cancel.addEventListener('click',  () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') overlay.remove();
  });
}

function openSpritePicker(currentSprite, callback) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:16px;max-width:500px;width:95%;display:flex;flex-direction:column;gap:12px">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">Choisir un sprite</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;max-height:280px;overflow-y:auto" id="spritePickerGrid">
        ${BOSS_SPRITES.map(s => `
          <div class="spr-opt" data-spr="${s}" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px;border:2px solid ${s === currentSprite ? 'var(--gold)' : 'var(--border)'};border-radius:4px;cursor:pointer;background:var(--bg-card)">
            <img src="${trainerSprite(s)}" style="width:36px;height:36px;image-rendering:pixelated">
            <span style="font-size:7px;color:var(--text-dim)">${s}</span>
          </div>`).join('')}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="spritePickerCancel" style="font-family:var(--font-pixel);font-size:9px;padding:6px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
        <button id="spritePickerConfirm" style="font-family:var(--font-pixel);font-size:9px;padding:6px 12px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Confirmer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  let selectedSpr = currentSprite || BOSS_SPRITES[0];
  overlay.querySelectorAll('.spr-opt').forEach(el => {
    el.addEventListener('click', () => {
      overlay.querySelectorAll('.spr-opt').forEach(o => o.style.borderColor = 'var(--border)');
      el.style.borderColor = 'var(--gold)';
      selectedSpr = el.dataset.spr;
    });
  });

  document.getElementById('spritePickerCancel').addEventListener('click', () => overlay.remove());
  document.getElementById('spritePickerConfirm').addEventListener('click', () => {
    overlay.remove();
    if (selectedSpr) callback(selectedSpr);
  });
}

function renderCosmeticsPanel(container) {
  const unlocked = new Set(state.cosmetics?.unlockedBgs || []);
  const active = state.cosmetics?.gameBg || null;

  // ── Jukebox ──────────────────────────────────────────────────
  const JUKEBOX_TRACKS = [
    { key: 'base',     icon: '🏠', label: 'Base' },
    { key: 'forest',   icon: '🌿', label: 'Route' },
    { key: 'cave',     icon: '⛏', label: 'Caverne' },
    { key: 'city',     icon: '🏙', label: 'Ville' },
    { key: 'sea',      icon: '🌊', label: 'Mer' },
    { key: 'safari',   icon: '🦒', label: 'Safari' },
    { key: 'lavender', icon: '💜', label: 'Lavanville' },
    { key: 'tower',    icon: '👻', label: 'Tour' },
    { key: 'mansion',  icon: '🕯', label: 'Manoir' },
    { key: 'gym',      icon: '⚔', label: 'Arène' },
    { key: 'rocket',   icon: '🚀', label: 'Rocket' },
    { key: 'silph',    icon: '🔬', label: 'Sylphe' },
    { key: 'elite4',   icon: '👑', label: 'Élite 4' },
    { key: 'casino',   icon: '🎰', label: 'Casino' },
  ];
  const isTrackUnlocked = (key) => {
    if (key === 'base') return true;
    return ZONES.some(z => z.music === key && isZoneUnlocked(z.id));
  };
  const currentJuke = state.settings?.jukeboxTrack || null;
  const jukeHtml = JUKEBOX_TRACKS.map(t => {
    const tUnlocked = isTrackUnlocked(t.key);
    const tActive = currentJuke === t.key;
    return `<div class="jukebox-track${tActive ? ' active' : ''}${tUnlocked ? '' : ' locked'}" data-jukebox-track="${t.key}" title="${t.label}${tUnlocked ? '' : ' — Verrou'}">
      <span class="juke-icon">${tUnlocked ? t.icon : '🔒'}</span>
      <span class="juke-label">${t.label}</span>
    </div>`;
  }).join('');

  // ── Fonds d'écran ─────────────────────────────────────────────
  const bgImagesHtml = Object.entries(COSMETIC_BGS).filter(([,c]) => c.type === 'image').map(([key, c]) => {
    const own = unlocked.has(key);
    const isActive = active === key;
    return `<div class="cosm-card ${isActive ? 'cosm-active' : ''}" data-cosm="${key}" style="border:2px solid ${isActive ? 'var(--gold)' : own ? 'var(--green)' : 'var(--border)'};border-radius:var(--radius-sm);padding:8px;cursor:pointer;background:var(--bg-card)">
      <div style="height:50px;background-image:url('${c.url}');background-size:cover;background-position:center;border-radius:2px;margin-bottom:6px"></div>
      <div style="font-size:9px">${c.fr}</div>
      <div style="font-size:8px;color:${isActive ? 'var(--gold)' : own ? 'var(--green)' : 'var(--text-dim)'}">
        ${isActive ? '[ ACTIF ]' : own ? 'Équiper' : c.cost.toLocaleString() + '₽'}
      </div>
    </div>`;
  }).join('');

  const bgGradientsHtml = Object.entries(COSMETIC_BGS).filter(([,c]) => c.type === 'gradient').map(([key, c]) => {
    const own = unlocked.has(key);
    const isActive = active === key;
    return `<div class="cosm-card ${isActive ? 'cosm-active' : ''}" data-cosm="${key}" style="border:2px solid ${isActive ? 'var(--gold)' : own ? 'var(--green)' : 'var(--border)'};border-radius:var(--radius-sm);padding:8px;cursor:pointer;background:var(--bg-card)">
      <div style="height:50px;background:${c.gradient};border-radius:2px;margin-bottom:6px"></div>
      <div style="font-size:9px">${c.fr}</div>
      <div style="font-size:8px;color:${isActive ? 'var(--gold)' : own ? 'var(--green)' : 'var(--text-dim)'}">
        ${isActive ? '[ ACTIF ]' : own ? 'Équiper' : c.cost.toLocaleString() + '₽'}
      </div>
    </div>`;
  }).join('');

  container.innerHTML = `
    <!-- ── Jukebox ── -->
    <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:8px">🎵 JUKEBOX
      <span style="font-size:7px;color:var(--text-dim);font-weight:normal;margin-left:6px">${currentJuke ? MUSIC_TRACKS[currentJuke]?.fr || currentJuke : 'AUTO'}</span>
    </div>
    <div class="base-jukebox" style="margin-bottom:18px">${jukeHtml}
      <div class="jukebox-track${!currentJuke ? ' active' : ''}" data-jukebox-track="__auto__" title="Musique automatique selon la zone">
        <span class="juke-icon">🔄</span>
        <span class="juke-label">AUTO</span>
      </div>
    </div>

    <!-- ── Fonds d'écran photo ── -->
    <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:10px">🖼 FOND D'ÉCRAN</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:8px">
      <div class="cosm-card ${!active ? 'cosm-active' : ''}" data-cosm="none" style="border:2px solid ${!active ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);padding:8px;cursor:pointer;background:var(--bg-card)">
        <div style="height:50px;background:linear-gradient(180deg,#0a0a0a,#1a1a1a);border-radius:2px;margin-bottom:6px"></div>
        <div style="font-size:9px">Défaut</div>
        <div style="font-size:8px;color:${!active ? 'var(--gold)' : 'var(--text-dim)'}">Gratuit ${!active ? '[ ACTIF ]' : ''}</div>
      </div>
      ${bgImagesHtml}
    </div>

    <!-- ── Thèmes couleur ── -->
    <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:10px;margin-top:6px">🎨 THÈMES</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">
      ${bgGradientsHtml}
    </div>`;

  // Jukebox handlers
  container.querySelectorAll('[data-jukebox-track]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.jukeboxTrack;
      if (el.classList.contains('locked')) { notify('🔒 Débloquez cette zone pour accéder à cette musique', 'error'); return; }
      if (key === '__auto__') {
        state.settings.jukeboxTrack = null;
        notify('🎵 Jukebox → Auto', 'success');
      } else {
        state.settings.jukeboxTrack = key;
        notify(`🎵 ${MUSIC_TRACKS[key]?.fr || key}`, 'success');
      }
      saveState();
      MusicPlayer.updateFromContext();
      renderCosmeticsPanel(container);
    });
  });

  // Wallpaper / theme handlers
  container.querySelectorAll('.cosm-card').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.cosm;
      if (key === 'none') {
        state.cosmetics.gameBg = null;
        saveState(); applyCosmetics();
        renderCosmeticsPanel(container);
        return;
      }
      const c = COSMETIC_BGS[key];
      if (!c) return;
      if (unlocked.has(key)) {
        state.cosmetics.gameBg = key;
        saveState(); applyCosmetics();
        renderCosmeticsPanel(container);
      } else {
        if (state.gang.money < c.cost) { notify('Fonds insuffisants.', 'error'); return; }
        showConfirm(`Acheter "${c.fr}" pour ${c.cost.toLocaleString()}₽ ?`, () => {
          state.gang.money -= c.cost;
          state.cosmetics.unlockedBgs = [...(state.cosmetics.unlockedBgs || []), key];
          state.cosmetics.gameBg = key;
          saveState(); applyCosmetics();
          updateTopBar();
          notify(`🎨 "${c.fr}" débloqué !`, 'gold');
          SFX.play('unlock');
          renderCosmeticsPanel(container);
        }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
      }
    });
  });

  // Appearance section (reputation-based)
  const appHtml = `
    <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-top:18px;margin-bottom:10px">APPARENCE</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;background:var(--bg-card)">
        <div style="font-size:9px;margin-bottom:6px">👤 Boss: <strong>${state.gang.bossName}</strong></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="cosm-action-btn" data-cosm-action="rename-boss" style="font-family:var(--font-pixel);font-size:8px;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">✏ Renommer (2 000₽)</button>
          <button class="cosm-action-btn" data-cosm-action="sprite-boss" style="font-family:var(--font-pixel);font-size:8px;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">🎨 Sprite (5 000₽)</button>
        </div>
      </div>
      ${state.agents.map(a => `
      <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;background:var(--bg-card)" data-agent-cosm="${a.id}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <img src="${a.sprite}" style="width:28px;height:28px;image-rendering:pixelated" onerror="this.src='${trainerSprite('acetrainer')}'">
          <span style="font-size:9px">Agent: <strong>${a.name}</strong></span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="cosm-action-btn" data-cosm-action="rename-agent" data-agent-id="${a.id}" style="font-family:var(--font-pixel);font-size:8px;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">✏ Renommer (2 000₽)</button>
          <button class="cosm-action-btn" data-cosm-action="sprite-agent" data-agent-id="${a.id}" style="font-family:var(--font-pixel);font-size:8px;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">🎨 Sprite (5 000₽)</button>
        </div>
      </div>`).join('')}
    </div>`;

  const appDiv = document.createElement('div');
  appDiv.innerHTML = appHtml;
  container.appendChild(appDiv);

  // Bind appearance buttons
  container.querySelectorAll('.cosm-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.cosmAction;
      const agentId = btn.dataset.agentId;

      if (action === 'rename-boss') {
        if (state.gang.money < 2000) { notify('Pokédollars insuffisants (2000₽)', 'error'); return; }
        openNameModal({ title: 'Renommer le Boss', current: state.gang.bossName, cost: 2000, onConfirm: (val) => {
          state.gang.money -= 2000;
          state.gang.bossName = val;
          saveState(); updateTopBar(); renderCosmeticsPanel(container);
          notify(`Boss renommé : ${val}`, 'gold');
        }});
      } else if (action === 'rename-agent') {
        if (state.gang.money < 2000) { notify('Pokédollars insuffisants (2000₽)', 'error'); return; }
        const agent = state.agents.find(a => a.id === agentId);
        if (!agent) return;
        openNameModal({ title: `Renommer ${agent.name}`, current: agent.name, cost: 2000, onConfirm: (val) => {
          state.gang.money -= 2000;
          agent.name = val;
          saveState(); updateTopBar(); renderCosmeticsPanel(container);
          notify(`Agent renommé : ${val}`, 'gold');
        }});
      } else if (action === 'sprite-boss') {
        if (state.gang.money < 5000) { notify('Pokédollars insuffisants (5000₽)', 'error'); return; }
        openSpritePicker(state.gang.bossSprite, (newSprite) => {
          state.gang.money -= 5000;
          state.gang.bossSprite = newSprite;
          saveState(); updateTopBar(); renderZonesTab(); renderCosmeticsPanel(container);
          notify('Sprite du Boss mis à jour !', 'gold');
        });
      } else if (action === 'sprite-agent') {
        if (state.gang.money < 5000) { notify('Pokédollars insuffisants (5000₽)', 'error'); return; }
        const agent = state.agents.find(a => a.id === agentId);
        if (!agent) return;
        openSpritePicker(null, (newSprite) => {
          state.gang.money -= 5000;
          agent.sprite = trainerSprite(newSprite);
          saveState(); renderCosmeticsPanel(container);
          notify(`Sprite de ${agent.name} mis à jour !`, 'gold');
        });
      }
    });
  });

  // ── Section TITRES ─────────────────────────────────────────────
  const titresDiv = document.createElement('div');
  titresDiv.style.cssText = 'margin-top:20px';
  const t1id = state.gang.titleA; const t2id = state.gang.titleB;
  const lia  = state.gang.titleLiaison || '';
  const t1label = t1id ? (TITLES.find(t => t.id === t1id)?.label || t1id) : '—';
  const t2label = t2id ? (TITLES.find(t => t.id === t2id)?.label || t2id) : '—';
  const titleStr = [t1label, lia, t2label].filter(Boolean).join(' ');
  const tCLabel = getTitleLabel(state.gang.titleC);
  const tDLabel = getTitleLabel(state.gang.titleD);
  const badgesHtml = [tCLabel, tDLabel].filter(Boolean).map((b, i) => {
    const color = i === 0 ? '#4fc3f7' : '#ce93d8';
    return `<span style="font-family:var(--font-pixel);font-size:7px;padding:2px 7px;border-radius:10px;border:1px solid ${color};color:${color}">${b}</span>`;
  }).join('');
  titresDiv.innerHTML = `
    <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:10px">TITRES</div>
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;display:flex;flex-direction:column;gap:8px">
      <div style="font-size:9px;color:var(--text-dim)">Titre principal :</div>
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold);min-height:1em">${titleStr || '(aucun)'}</div>
      ${badgesHtml ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${badgesHtml}</div>` : ''}
      <div style="font-size:8px;color:var(--text-dim)">${(state.unlockedTitles||[]).length} titres débloqués</div>
      <button id="btnOpenTitlesFromCosm" style="font-family:var(--font-pixel);font-size:8px;padding:6px 12px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;align-self:flex-start">🏷 Gérer les titres</button>
    </div>`;
  container.appendChild(titresDiv);
  titresDiv.querySelector('#btnOpenTitlesFromCosm')?.addEventListener('click', () => {
    openTitleModal();
  });

  // ── Infirmière Joëlle corrompue ────────────────────────────────
  const nurseDiv = document.createElement('div');
  nurseDiv.style.cssText = 'margin-top:20px';
  const nurseOwned   = !!state.purchases?.autoIncubator;
  const nurseEnabled = state.purchases?.autoIncubatorEnabled !== false; // true par défaut
  nurseDiv.innerHTML = `
    <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:10px">SERVICES SPÉCIAUX</div>
    <div style="background:var(--bg-card);border:1px solid ${nurseOwned ? (nurseEnabled ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:12px;align-items:flex-start">
      <img src="${trainerSprite('nurse')}" style="width:48px;height:48px;image-rendering:pixelated;flex-shrink:0;${nurseOwned && !nurseEnabled ? 'opacity:.4;filter:grayscale(1)' : ''}" onerror="this.style.display='none'">
      <div style="flex:1">
        <div style="font-family:var(--font-pixel);font-size:9px;color:${nurseOwned ? (nurseEnabled ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:4px">Infirmière Joëlle corrompue</div>
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:8px">Met automatiquement les oeufs en incubation dès qu'un incubateur est libre.</div>
        ${nurseOwned
          ? `<div style="display:flex;align-items:center;gap:8px">
               <span style="font-family:var(--font-pixel);font-size:8px;color:${nurseEnabled ? 'var(--green)' : 'var(--text-dim)'}">
                 ${nurseEnabled ? '✓ EN POSTE' : '✗ CONGÉ'}
               </span>
               <button id="btnToggleNurse" style="font-family:var(--font-pixel);font-size:8px;padding:4px 10px;background:var(--bg);border:1px solid ${nurseEnabled ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${nurseEnabled ? 'var(--red)' : 'var(--green)'};cursor:pointer">
                 ${nurseEnabled ? 'Mettre en congé' : 'Rappeler'}
               </button>
             </div>`
          : `<button id="btnBuyNurse" style="font-family:var(--font-pixel);font-size:8px;padding:6px 12px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Embaucher — 300 000₽</button>`}
      </div>
    </div>`;
  container.appendChild(nurseDiv);
  nurseDiv.querySelector('#btnBuyNurse')?.addEventListener('click', () => {
    if (state.gang.money < 300000) { notify('Fonds insuffisants.', 'error'); SFX.play('error'); return; }
    showConfirm('Embaucher l\'Infirmière Joëlle corrompue pour 300 000₽ ? (permanent)', () => {
      state.gang.money -= 300000;
      state.purchases.autoIncubator = true;
      state.purchases.autoIncubatorEnabled = true;
      saveState(); updateTopBar();
      SFX.play('unlock');
      notify('💉 Joëlle est en poste ! Les oeufs seront auto-incubés.', 'gold');
      tryAutoIncubate();
      renderCosmeticsPanel(container);
    }, null, { confirmLabel: 'Embaucher', cancelLabel: 'Annuler' });
  });
  nurseDiv.querySelector('#btnToggleNurse')?.addEventListener('click', () => {
    state.purchases.autoIncubatorEnabled = !nurseEnabled;
    saveState();
    const msg = state.purchases.autoIncubatorEnabled
      ? '💉 Joëlle est de retour en poste !'
      : '😴 Joëlle est en congé.';
    notify(msg, 'success');
    renderCosmeticsPanel(container);
  });

  // ── Récolte automatique ────────────────────────────────────────
  const acOwned   = !!state.purchases?.autoCollect;
  const acEnabled = state.purchases?.autoCollectEnabled !== false;
  const acDiv = document.createElement('div');
  acDiv.style.cssText = 'margin-top:10px';
  acDiv.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid ${acOwned ? (acEnabled ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:12px;align-items:flex-start">
      <div style="font-size:24px;flex-shrink:0;${acOwned && !acEnabled ? 'opacity:.4;filter:grayscale(1)' : ''}">🪙</div>
      <div style="flex:1">
        <div style="font-family:var(--font-pixel);font-size:9px;color:${acOwned ? (acEnabled ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:4px">Récolte automatique</div>
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:8px">Collecte les revenus de zone sans animation de combat. Le combat reste calculé en arrière-plan.</div>
        ${acOwned
          ? `<div style="display:flex;align-items:center;gap:8px">
               <span style="font-family:var(--font-pixel);font-size:8px;color:${acEnabled ? 'var(--green)' : 'var(--text-dim)'}">
                 ${acEnabled ? '✓ ACTIVE' : '✗ INACTIVE'}
               </span>
               <button id="btnToggleAutoCollect" style="font-family:var(--font-pixel);font-size:8px;padding:4px 10px;background:var(--bg);border:1px solid ${acEnabled ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${acEnabled ? 'var(--red)' : 'var(--green)'};cursor:pointer">
                 ${acEnabled ? 'Désactiver' : 'Activer'}
               </button>
             </div>`
          : `<button id="btnBuyAutoCollect" style="font-family:var(--font-pixel);font-size:8px;padding:6px 12px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Acheter — 100 000₽</button>`}
      </div>
    </div>`;
  container.appendChild(acDiv);
  acDiv.querySelector('#btnBuyAutoCollect')?.addEventListener('click', () => {
    if (state.gang.money < 100_000) { notify('Fonds insuffisants.', 'error'); SFX.play('error'); return; }
    showConfirm('Acheter la Récolte automatique pour 100 000₽ ?', () => {
      state.gang.money -= 100_000;
      state.purchases.autoCollect = true;
      state.purchases.autoCollectEnabled = true;
      saveState(); updateTopBar();
      SFX.play('unlock');
      notify('🪙 Récolte automatique activée !', 'gold');
      renderCosmeticsPanel(container);
    }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
  });
  acDiv.querySelector('#btnToggleAutoCollect')?.addEventListener('click', () => {
    state.purchases.autoCollectEnabled = !acEnabled;
    saveState();
    notify(state.purchases.autoCollectEnabled ? '🪙 Récolte automatique activée !' : '⏸ Récolte automatique désactivée.', 'success');
    renderCosmeticsPanel(container);
  });

  // ── Achats spéciaux (Titres, Charme Chroma) ───────────────────
  const SPECIAL_PURCHASES = [
    {
      id: 'title_richissime',
      icon: '💰', label: 'Titre "Richissime"',
      desc: 'Débloque le titre légendaire. Ostentation maximale.',
      cost: 5_000_000,
      owned: () => !!state.purchases?.title_richissime || (state.unlockedTitles || []).includes('richissime'),
      buy: () => {
        state.purchases = state.purchases || {};
        state.purchases.title_richissime = true;
        state.unlockedTitles = [...new Set([...(state.unlockedTitles || []), 'richissime'])];
        notify('💰 Titre "Richissime" débloqué !', 'gold');
      },
    },
    {
      id: 'title_doublerichissim',
      icon: '💎', label: 'Titre "Double Richissime"',
      desc: 'Débloque le titre ultime. Noblesse oblige.',
      cost: 10_000_000,
      owned: () => !!state.purchases?.title_doublerichissim || (state.unlockedTitles || []).includes('doublerichissim'),
      buy: () => {
        state.purchases = state.purchases || {};
        state.purchases.title_doublerichissim = true;
        state.unlockedTitles = [...new Set([...(state.unlockedTitles || []), 'doublerichissim'])];
        notify('💎 Titre "Double Richissime" débloqué !', 'gold');
      },
    },
    {
      id: 'chromaCharm',
      icon: '✨', label: 'Charme Chroma',
      desc: 'Double le taux de Pokémon chromatiques. Permanent.',
      cost: 5_000_000,
      owned: () => !!state.purchases?.chromaCharm,
      buy: () => {
        state.purchases.chromaCharm = true;
        notify('✨ Charme Chroma obtenu ! Taux shiny ×2', 'gold');
      },
    },
  ];

  const specialDiv = document.createElement('div');
  specialDiv.style.cssText = 'margin-top:24px';
  specialDiv.innerHTML = `
    <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:12px">🛒 ACHATS SPÉCIAUX</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${SPECIAL_PURCHASES.map(sp => {
        const owned = sp.owned();
        return `<div style="background:var(--bg-card);border:1px solid ${owned ? 'var(--green)' : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:12px;align-items:center">
          <div style="font-size:24px;flex-shrink:0">${sp.icon}</div>
          <div style="flex:1">
            <div style="font-family:var(--font-pixel);font-size:9px;color:${owned ? 'var(--green)' : 'var(--text)'};margin-bottom:2px">${sp.label}</div>
            <div style="font-size:8px;color:var(--text-dim)">${sp.desc}</div>
          </div>
          ${owned
            ? `<div style="font-family:var(--font-pixel);font-size:8px;color:var(--green);white-space:nowrap">✓ ACTIF</div>`
            : `<button class="btn-special-buy" data-sp-id="${sp.id}" style="font-family:var(--font-pixel);font-size:8px;padding:6px 10px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;white-space:nowrap">${sp.cost.toLocaleString()}₽</button>`}
        </div>`;
      }).join('')}
    </div>`;
  container.appendChild(specialDiv);

  specialDiv.querySelectorAll('.btn-special-buy').forEach(btn => {
    btn.addEventListener('click', () => {
      const sp = SPECIAL_PURCHASES.find(s => s.id === btn.dataset.spId);
      if (!sp || sp.owned()) return;
      if (state.gang.money < sp.cost) { notify('Fonds insuffisants.', 'error'); SFX.play('error'); return; }
      showConfirm(`Acheter "${sp.label}" pour ${sp.cost.toLocaleString()}₽ ?`, () => {
        state.gang.money -= sp.cost;
        sp.buy();
        saveState(); updateTopBar();
        SFX.play('unlock');
        renderCosmeticsPanel(container);
      }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 13.  UI — GANG TAB
// ════════════════════════════════════════════════════════════════

// Persists collapsed state across renders (does not survive page reload — intentional)
const _gangCollapsed = { cosmetics: false, stats: false };

function renderGangTab() {
  const tab = document.getElementById('tabGang');
  if (!tab) return;

  const g = state.gang;
  const s = state.stats;
  const activeSlot = g.activeBossTeamSlot || 0;
  const teamPks = (g.bossTeam || []).map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);

  // ── Vitrine (showcase — 6 slots) ──
  const showcaseArr = (g.showcase || []);
  while (showcaseArr.length < 6) showcaseArr.push(null);
  const showcaseHtml = showcaseArr.slice(0, 6).map((pkId, i) => {
    const pk = pkId ? state.pokemons.find(p => p.id === pkId) : null;
    if (pk) {
      const evos = EVO_BY_SPECIES[pk.species_en];
      const evoHint = evos && evos.length > 0 ? `<button class="gang-evo-hint" data-pk-id="${pk.id}" title="Voir évolution">❓</button>` : '';
      return `<div class="gang-showcase-slot filled" data-showcase-idx="${i}">
        <img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:48px;height:48px;image-rendering:pixelated;${pk.shiny ? 'filter:drop-shadow(0 0 4px var(--gold))' : ''}">
        <div style="font-size:7px;margin-top:2px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${pokemonDisplayName(pk)}${pk.shiny ? ' ✨' : ''}</div>
        <div style="font-size:7px;color:var(--text-dim)">Lv.${pk.level} ${'★'.repeat(pk.potential)}</div>
        <div style="display:flex;gap:3px;margin-top:3px;align-items:center;justify-content:center">
          ${evoHint}
          <button class="gang-showcase-remove" data-idx="${i}" style="font-size:7px;padding:1px 4px;background:var(--bg);border:1px solid var(--red);border-radius:2px;color:var(--red);cursor:pointer">✕</button>
        </div>
      </div>`;
    }
    return `<div class="gang-showcase-slot empty" data-showcase-idx="${i}">
      <div style="font-size:16px;opacity:.3">🏆</div>
      <div style="font-size:7px;color:var(--text-dim);margin-top:3px">Slot ${i+1}</div>
      <button class="gang-showcase-add" data-idx="${i}" style="margin-top:5px;font-size:7px;padding:2px 5px;background:var(--bg);border:1px solid var(--border-light);border-radius:2px;color:var(--text-dim);cursor:pointer">+</button>
    </div>`;
  }).join('');

  // ── Boss team save slots tabs ──
  const SLOT_COSTS = [0, 500_000, 1_000_000];
  const purchased = g.bossTeamSlotsPurchased || [true, false, false];
  const teamTabsHtml = [0, 1, 2].map(i => {
    const isActive = i === activeSlot;
    const isPurchased = purchased[i];
    const label = i === 0 ? 'Slot 1' : isPurchased ? `Slot ${i+1}` : `Slot ${i+1} — ${SLOT_COSTS[i].toLocaleString()}₽`;
    return `<button class="gang-team-slot-tab${isActive ? ' active' : ''}${!isPurchased ? ' locked' : ''}" data-team-slot="${i}"
      style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;border-radius:var(--radius-sm) var(--radius-sm) 0 0;border:1px solid ${isActive ? 'var(--gold-dim)' : 'var(--border)'};border-bottom:${isActive ? '1px solid var(--bg-panel)' : '1px solid var(--border)'};background:${isActive ? 'var(--bg-panel)' : 'var(--bg)'};color:${isActive ? 'var(--gold)' : isPurchased ? 'var(--text-dim)' : 'var(--text-dim)'};cursor:pointer;opacity:${isPurchased || isActive ? '1' : '.7'}">
      ${!isPurchased ? '🔒 ' : ''}${label}
    </button>`;
  }).join('');

  // ── Boss team slots ──
  const teamHtml = [0, 1, 2].map(i => {
    const pk = teamPks[i];
    if (pk) return `<div class="gang-team-slot filled" data-boss-slot="${i}" title="${pokemonDisplayName(pk)} Lv.${pk.level}">
      <img src="${pokeIcon(pk.species_en)}" style="width:40px;height:30px;image-rendering:pixelated;${pk.shiny ? 'filter:drop-shadow(0 0 3px var(--gold))' : ''}" onerror="this.src='${pokeSprite(pk.species_en, pk.shiny)}';this.style.width='40px';this.style.height='40px'">
      <div style="font-size:7px;margin-top:2px;color:${pk.shiny ? 'var(--gold)' : 'var(--text)'}">${pokemonDisplayName(pk)}</div>
      <div style="font-size:7px;color:var(--text-dim)">Lv.${pk.level}</div>
    </div>`;
    return `<div class="gang-team-slot empty" data-boss-slot="${i}"><span style="font-size:7px;color:var(--text-dim)">Slot ${i+1}</span></div>`;
  }).join('');

  // ── Stats ──
  const statsHtml = [
    [state.pokemons.length,                  'Possédés'],
    [s.totalCaught,                          'Capturés'],
    [s.totalSold,                            'Vendus'],
    [getShinySpeciesCount(),                  '✨ Espèces chroma'],
    [s.shinyCaught,                          '✨ Chromas (total)'],
    [`${s.totalFightsWon}/${s.totalFights}`, 'Combats'],
    [`${s.totalMoneyEarned.toLocaleString()}₽`, 'Gains'],
  ].map(([val, label]) => `<div class="gang-stat-card"><div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>`).join('');

  const repPct = Math.min(100, g.reputation);

  tab.innerHTML = `
  <div class="gang-card-layout">
    <!-- ── Header: Boss info + Vitrine + Équipe ── -->
    <div class="gang-card-header" style="flex-direction:column;gap:0;padding:0">

      <!-- Boss info row -->
      <div style="display:flex;align-items:flex-start;gap:14px;padding:14px">
        <div class="gang-boss-sprite">
          ${g.bossSprite ? `<img src="${trainerSprite(g.bossSprite)}" style="width:72px;height:72px;image-rendering:pixelated">` : '<div style="width:72px;height:72px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm)"></div>'}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--font-pixel);font-size:15px;color:var(--red);line-height:1.3">${g.name}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:2px">Boss : <span style="color:var(--text)">${g.bossName}</span></div>
          <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin-top:2px;letter-spacing:.5px">${getBossFullTitle()}</div>
          ${(() => {
            const tC = getTitleLabel(g.titleC);
            const tD = getTitleLabel(g.titleD);
            const badges = [tC, tD].filter(Boolean);
            if (!badges.length) return '';
            const colors = ['#4fc3f7','#ce93d8'];
            return `<div style="display:flex;gap:5px;margin-top:3px;flex-wrap:wrap">${badges.map((b,bi)=>`<span style="font-family:var(--font-pixel);font-size:6px;padding:2px 6px;border-radius:10px;border:1px solid ${colors[bi]};color:${colors[bi]}">${b}</span>`).join('')}</div>`;
          })()}
          <button id="btnOpenTitles" style="margin-top:4px;font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">🏆 Titres</button>
          <div style="display:flex;gap:14px;margin-top:6px;flex-wrap:wrap">
            <span style="font-size:10px;color:var(--gold)">⭐ ${g.reputation.toLocaleString()}</span>
            <span style="font-size:10px;color:var(--text)">₽ ${g.money.toLocaleString()}</span>
            <span style="font-size:10px;color:var(--text-dim)" title="Pokédex Kanto (151) / National (${NATIONAL_DEX_SIZE})">📖 ${getDexKantoCaught()}/${KANTO_DEX_SIZE} <span style="font-size:8px;opacity:.6">[${getDexNationalCaught()}/${NATIONAL_DEX_SIZE}]</span></span>
          </div>
          <div style="margin-top:8px;background:var(--border);border-radius:2px;height:4px;max-width:200px">
            <div style="background:var(--gold-dim);height:4px;border-radius:2px;width:${repPct}%;transition:width .5s"></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0">
          <button id="btnExportGang" style="font-family:var(--font-pixel);font-size:7px;padding:5px 8px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">📋 Exporter</button>
          <button id="btnEditBoss" style="font-family:var(--font-pixel);font-size:7px;padding:5px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">✏ Modifier</button>
        </div>
      </div>

      <!-- Vitrine 6 slots -->
      <div style="border-top:1px solid var(--border);padding:10px 14px">
        <div style="font-family:var(--font-pixel);font-size:7px;color:var(--gold-dim);letter-spacing:1px;margin-bottom:7px">— VITRINE —</div>
        <div class="gang-showcase-row">${showcaseHtml}</div>
      </div>

      <!-- Équipe Boss + save slots -->
      <div style="border-top:1px solid var(--border);padding:10px 14px 14px">
        <div style="font-family:var(--font-pixel);font-size:7px;color:var(--gold-dim);letter-spacing:1px;margin-bottom:6px">— ÉQUIPE BOSS —</div>
        <div style="display:flex;gap:0;margin-bottom:-1px">${teamTabsHtml}</div>
        <div style="border:1px solid var(--border);border-radius:0 var(--radius-sm) var(--radius-sm) var(--radius-sm);padding:8px;background:var(--bg-panel)">
          <div class="gang-team-row" style="margin-bottom:0">${teamHtml}</div>
        </div>
      </div>
    </div>

    <!-- ── Collapsible: AUTOMATISATION ── -->
    ${state.purchases.autoSellAgent ? `
    <div class="gang-section-label gang-collapsible-header" data-section="automation" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
      <span>— AUTOMATISATION —</span>
      <span style="font-size:9px;color:var(--text-dim)">${_gangCollapsed.automation ? '▶' : '▼'}</span>
    </div>
    <div class="gang-collapsible-body" data-section-body="automation" style="${_gangCollapsed.automation ? 'display:none' : ''}">
      <div style="padding:10px 14px">
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:8px">🤖 VENTE AUTO — CAPTURES AGENT</div>
        <div style="font-size:9px;color:var(--text-dim);margin-bottom:8px">Les Shinies sont toujours protégés.</div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
          <label style="font-size:9px;color:var(--text)">Mode :</label>
          <label style="display:flex;align-items:center;gap:4px;font-size:9px;cursor:pointer">
            <input type="radio" name="autoSellMode" value="all" ${(state.settings.autoSellAgent?.mode || 'all') === 'all' ? 'checked' : ''}> Tout vendre
          </label>
          <label style="display:flex;align-items:center;gap:4px;font-size:9px;cursor:pointer">
            <input type="radio" name="autoSellMode" value="by_potential" ${state.settings.autoSellAgent?.mode === 'by_potential' ? 'checked' : ''}> Par potentiel
          </label>
        </div>
        ${state.settings.autoSellAgent?.mode === 'by_potential' ? `
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
          <span style="font-size:9px;color:var(--text-dim)">Vendre si :</span>
          ${[1,2,3,4,5].map(p => `<label style="display:flex;align-items:center;gap:3px;font-size:9px;cursor:pointer">
            <input type="checkbox" class="autoSellPot" value="${p}" ${(state.settings.autoSellAgent?.potentials || []).includes(p) ? 'checked' : ''}> ${'★'.repeat(p)}
          </label>`).join('')}
        </div>` : ''}
      </div>
    </div>` : ''}

    <!-- ── Collapsible: APPARENCE & MUSIQUE ── -->
    <div class="gang-section-label gang-collapsible-header" data-section="cosmetics" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
      <span>— APPARENCE & MUSIQUE —</span>
      <span style="font-size:9px;color:var(--text-dim)">${_gangCollapsed.cosmetics ? '▶' : '▼'}</span>
    </div>
    <div class="gang-collapsible-body" data-section-body="cosmetics" style="${_gangCollapsed.cosmetics ? 'display:none' : ''}">
      <div id="gangCosmContainer" style="padding:0 2px 8px"></div>
    </div>

    <!-- ── Collapsible: STATISTIQUES ── -->
    <div class="gang-section-label gang-collapsible-header" data-section="stats" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
      <span>— STATISTIQUES —</span>
      <span style="font-size:9px;color:var(--text-dim)">${_gangCollapsed.stats ? '▶' : '▼'}</span>
    </div>
    <div class="gang-collapsible-body" data-section-body="stats" style="${_gangCollapsed.stats ? 'display:none' : ''}">
      <div class="gang-stats-row">${statsHtml}</div>
    </div>

    <!-- ── Version ── -->
    <div style="margin-top:16px;text-align:center;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);letter-spacing:1px;opacity:.5">${GAME_VERSION}</div>
  </div>`;

  // ── Collapsible toggles ──
  tab.querySelectorAll('.gang-collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.dataset.section;
      _gangCollapsed[section] = !_gangCollapsed[section];
      const body = tab.querySelector(`[data-section-body="${section}"]`);
      if (body) body.style.display = _gangCollapsed[section] ? 'none' : '';
      const arrow = header.querySelector('span:last-child');
      if (arrow) arrow.textContent = _gangCollapsed[section] ? '▶' : '▼';
    });
  });

  // ── Auto-sell mode toggle ──
  tab.querySelectorAll('input[name="autoSellMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (!state.settings.autoSellAgent) state.settings.autoSellAgent = { mode: 'all', potentials: [] };
      state.settings.autoSellAgent.mode = radio.value;
      saveState();
      renderGangTab();
    });
  });
  tab.querySelectorAll('.autoSellPot').forEach(cb => {
    cb.addEventListener('change', () => {
      if (!state.settings.autoSellAgent) state.settings.autoSellAgent = { mode: 'by_potential', potentials: [] };
      const pot = parseInt(cb.value);
      const pots = state.settings.autoSellAgent.potentials || [];
      state.settings.autoSellAgent.potentials = cb.checked
        ? [...new Set([...pots, pot])]
        : pots.filter(p => p !== pot);
      saveState();
    });
  });

  // ── Handlers ──
  tab.querySelector('#btnOpenTitles')?.addEventListener('click', openTitleModal);
  tab.querySelector('#btnExportGang')?.addEventListener('click', () => openExportModal());
  tab.querySelector('#btnEditBoss')?.addEventListener('click', () => openBossEditModal(() => renderGangTab()));

  // Boss team save slot tabs
  tab.querySelectorAll('.gang-team-slot-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const slotIdx = parseInt(btn.dataset.teamSlot);
      const isPurchased = (g.bossTeamSlotsPurchased || [true, false, false])[slotIdx];
      if (!isPurchased) {
        const cost = SLOT_COSTS[slotIdx];
        showConfirm(`Débloquer le Slot ${slotIdx + 1} pour ${cost.toLocaleString()}₽ ?`, () => {
          if (state.gang.money < cost) { notify('Fonds insuffisants.', 'error'); SFX.play('error'); return; }
          state.gang.money -= cost;
          state.gang.bossTeamSlotsPurchased[slotIdx] = true;
          state.gang.activeBossTeamSlot = slotIdx;
          state.gang.bossTeam = [...(state.gang.bossTeamSlots[slotIdx] || [])];
          saveState(); updateTopBar(); SFX.play('unlock');
          renderGangTab();
        }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
        return;
      }
      // Switch to this slot
      state.gang.activeBossTeamSlot = slotIdx;
      state.gang.bossTeam = [...(state.gang.bossTeamSlots[slotIdx] || [])];
      saveState();
      renderGangTab();
    });
  });

  // Showcase add
  tab.querySelectorAll('.gang-showcase-add').forEach(btn => {
    btn.addEventListener('click', () => openShowcasePicker(parseInt(btn.dataset.idx)));
  });
  tab.querySelectorAll('.gang-showcase-slot.filled').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.classList.contains('gang-showcase-remove') || e.target.classList.contains('gang-evo-hint')) return;
      openShowcasePicker(parseInt(el.dataset.showcaseIdx));
    });
  });
  tab.querySelectorAll('.gang-showcase-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      while (state.gang.showcase.length < 6) state.gang.showcase.push(null);
      state.gang.showcase[idx] = null;
      saveState();
      renderGangTab();
    });
  });

  // Evo hint
  tab.querySelectorAll('.gang-evo-hint').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const pk = state.pokemons.find(p => p.id === btn.dataset.pkId);
      if (pk) showEvoPreviewModal(pk);
    });
  });

  // Boss team slots — click filled to remove, empty to add
  tab.querySelectorAll('.gang-team-slot').forEach(el => {
    el.addEventListener('click', () => {
      const i = parseInt(el.dataset.bossSlot);
      if (el.classList.contains('filled')) {
        state.gang.bossTeam.splice(i, 1);
        state.gang.bossTeamSlots[state.gang.activeBossTeamSlot || 0] = [...state.gang.bossTeam];
        saveState();
        renderGangTab();
      } else {
        openTeamPickerModal(i, () => renderGangTab());
      }
    });
  });

  // ── Cosmetics panel (embedded) ──
  const cosmContainer = tab.querySelector('#gangCosmContainer');
  if (cosmContainer) renderCosmeticsPanel(cosmContainer);
}

function openExportModal()  { return globalThis._gbase_openExportModal(); }

function openShowcasePicker(slotIdx) {
  const usedIds = new Set((state.gang.showcase || []).filter(Boolean));
  const teamIds = new Set(state.gang.bossTeam);
  const candidates = state.pokemons.filter(p => !teamIds.has(p.id));

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center';
  const listHtml = candidates.map(p => `
    <div class="showcase-pick-item" data-pk-id="${p.id}" style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid var(--border);cursor:pointer">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:36px;height:36px;image-rendering:pixelated">
      <div style="flex:1">
        <div style="font-size:10px">${pokemonDisplayName(p)}${p.shiny ? ' ✨' : ''} ${'★'.repeat(p.potential)}</div>
        <div style="font-size:9px;color:var(--text-dim)">Lv.${p.level}</div>
      </div>
    </div>`).join('') || `<div style="padding:16px;text-align:center;color:var(--text-dim);font-size:10px">Aucun Pokémon disponible</div>`;

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:360px;width:90%;display:flex;flex-direction:column;gap:12px;max-height:80vh">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">VITRINE — SLOT ${slotIdx + 1}</div>
      <div style="overflow-y:auto;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:360px">${listHtml}</div>
      <button id="showcasePickCancel" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelectorAll('.showcase-pick-item').forEach(el => {
    el.addEventListener('click', () => {
      if (!state.gang.showcase) state.gang.showcase = [];
      while (state.gang.showcase.length < 6) state.gang.showcase.push(null);
      state.gang.showcase[slotIdx] = el.dataset.pkId;
      saveState();
      modal.remove();
      renderGangTab();
    });
  });
  modal.querySelector('#showcasePickCancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function showEvoPreviewModal(p) {
  const evos = EVO_BY_SPECIES[p.species_en] || [];
  if (!evos.length) return;

  // Stat la plus haute → détermine quelle evo suggérer si plusieurs
  const stats = p.stats || calculateStats(p);
  const statKeys = Object.keys(stats);
  let bestEvo = evos[0];
  if (evos.length > 1) {
    // Choisir selon la stat dominante (ATK → dernier, DEF → avant-dernier, SPD → premier)
    const maxStatKey = statKeys.reduce((a, b) => (stats[a] || 0) >= (stats[b] || 0) ? a : b, statKeys[0]);
    // Heuristique simple : si SPD dominant → première evo, si DEF → dernière, sinon première
    bestEvo = evos[0];
  }

  const sp = SPECIES_BY_EN[bestEvo.to];
  const reqText = bestEvo.req === 'item' ? 'Pierre d\'évolution' : `Niveau ${bestEvo.req}`;
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:300px;width:90%;display:flex;flex-direction:column;align-items:center;gap:12px">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">ÉVOLUTION</div>
      <div style="display:flex;align-items:center;gap:16px">
        <div style="text-align:center">
          <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:64px;height:64px;image-rendering:pixelated">
          <div style="font-size:9px;margin-top:4px">${pokemonDisplayName(p)}</div>
          <div style="font-size:8px;color:var(--text-dim)">Lv.${p.level}</div>
        </div>
        <div style="font-size:18px;color:var(--gold)">→</div>
        <div style="text-align:center">
          <img src="${pokeSprite(bestEvo.to)}" style="width:64px;height:64px;image-rendering:pixelated;filter:brightness(.6)">
          <div style="font-size:9px;margin-top:4px;color:var(--gold)">${speciesName(bestEvo.to)}</div>
          <div style="font-size:8px;color:var(--text-dim)">${reqText}</div>
        </div>
      </div>
      ${evos.length > 1 ? `<div style="font-size:8px;color:var(--text-dim);text-align:center">Autres formes : ${evos.slice(1).map(e => speciesName(e.to)).join(', ')}</div>` : ''}
      <button style="font-family:var(--font-pixel);font-size:8px;padding:8px 16px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer" id="evoModalClose">Fermer</button>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#evoModalClose').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function openTeamPickerModal(slotIdx, onDone) {
  openTeamPicker('boss', null, onDone);
}

function openBossEditModal(onDone) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:340px;width:90%;display:flex;flex-direction:column;gap:12px">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">MODIFIER LE BOSS</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <label style="font-size:9px;color:var(--text-dim)">Nom du Boss</label>
        <input id="bossEditName" type="text" maxlength="16" value="${state.gang.bossName}"
          style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:8px 10px;font-size:12px;outline:none;width:100%;box-sizing:border-box">
        <label style="font-size:9px;color:var(--text-dim)">Nom du Gang</label>
        <input id="bossEditGangName" type="text" maxlength="24" value="${state.gang.name}"
          style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:8px 10px;font-size:12px;outline:none;width:100%;box-sizing:border-box">
      </div>
      <button id="bossEditSprite" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">🎨 Changer le sprite</button>
      <div style="display:flex;gap:8px">
        <button id="bossEditCancel" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
        <button id="bossEditConfirm" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Confirmer</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#bossEditConfirm').addEventListener('click', () => {
    const newBossName = modal.querySelector('#bossEditName').value.trim();
    const newGangName = modal.querySelector('#bossEditGangName').value.trim();
    if (newBossName) state.gang.bossName = newBossName.slice(0, 16);
    if (newGangName) state.gang.name = newGangName.slice(0, 24);
    saveState();
    updateTopBar();
    notify('Gang mis à jour', 'success');
    modal.remove();
    if (onDone) onDone();
  });
  modal.querySelector('#bossEditSprite').addEventListener('click', () => {
    openSpritePicker(state.gang.bossSprite, (newSprite) => {
      state.gang.bossSprite = newSprite;
      saveState();
      updateTopBar();
      modal.remove();
      if (onDone) onDone();
    });
  });
  modal.querySelector('#bossEditCancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ════════════════════════════════════════════════════════════════
// 13b.  ZONE INCOME COLLECTION
// ════════════════════════════════════════════════════════════════

function openCollectionModal(zoneId)                                 { return globalThis._zwin_openCollectionModal(zoneId); }
function showCollectionEncounter(zoneId, agentIds, income, items)   { return globalThis._zwin_showCollectionEncounter(zoneId, agentIds, income, items); }
function startZoneCollection(zoneId, agentIds)                       { return globalThis._zwin_startZoneCollection(zoneId, agentIds); }
function showCollectionResult(win, amount, items, agentIds)          { return globalThis._zwin_showCollectionResult(win, amount, items, agentIds); }
function spawnCoinRain(win, amount)                                  { return globalThis._zwin_spawnCoinRain(win, amount); }
function autoCollectZone(zoneId)                                     { return globalThis._zwin_autoCollectZone(zoneId); }
function collectAllZones()                                           { return globalThis._zwin_collectAllZones(); }

// ════════════════════════════════════════════════════════════════
// 14.  UI — ZONES TAB
// ════════════════════════════════════════════════════════════════

function renderZonesTab() { return globalThis._zwin_renderZonesTab(); }

// ── Zone selector UI — delegated to modules/ui/zoneSelector.js ──
function renderZoneSelector()           { _zsRenderSelector(); }
function _refreshZoneTile(zoneId)       { _zsRefreshTile(zoneId); }
function _refreshZoneIncomeTile(zoneId) { _zsRefreshIncome(zoneId); }
function _updateZoneButtons()           { _zsUpdateButtons(); }

// ── Background zone simulation ─────────────────────────────────
// Zones fermées avec ≥1 agent : tick au vrai spawnRate, résolution silencieuse.
// État zone : Open (fenêtre visible) | Closed+agent (background) | Inactive (rien)
function startBackgroundZone(zoneId) { return globalThis._zsys_startBackgroundZone(zoneId); }
function stopBackgroundZone(zoneId)  { return globalThis._zsys_stopBackgroundZone(zoneId); }
function syncBackgroundZones()       { return globalThis._zsys_syncBackgroundZones(); }

function openZoneWindow(zoneId)  { return globalThis._zwin_openZoneWindow(zoneId); }
function closeZoneWindow(zoneId) { return globalThis._zwin_closeZoneWindow(zoneId); }

// Track headbar expanded state per zone
// headbarExpanded removed — collapsible headbar-content section eliminated

function renderGangBasePanel() { return globalThis._gbase_renderGangBasePanel(); }

function renderZoneWindows() { return globalThis._zwin_renderZoneWindows(); }

// Build a fresh zone window element (used on first open)
// Build a fresh zone window element (used on first open)
function buildZoneWindowEl(zoneId) { return globalThis._zwin_buildZoneWindowEl(zoneId); }

// Patch an existing zone window in place — leaves spawns untouched
function patchZoneWindow(zoneId, win) { return globalThis._zwin_patchZoneWindow(zoneId, win); }


// ── Gang Base Window (always first in zone windows) ─────────
function renderGangBaseWindow() { return globalThis._gbase_renderGangBaseWindow(); }
function bindGangBase(container) { return globalThis._gbase_bindGangBase(container); }
function openCodexModal()      { return globalThis._gbase_openCodexModal(); }
function buildExportCard(opts = {}) { return globalThis._gbase_buildExportCard(opts); }
function _exportAsPDF(opts)     { return globalThis._gbase_exportAsPDF(opts); }
// ── (legacy stub — kept so old call-sites don't break) ────────
function exportGangImage()      { return globalThis._gbase_exportGangImage(); }

// ── Team Picker Modal ────────────────────────────────────────
// type: 'boss' | 'agent', targetId: agentId or null for boss
function openTeamPicker(type, targetId, onDone) {
  // Get all already-assigned IDs
  const assignedIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => assignedIds.add(id));
  const available = state.pokemons
    .filter(p => !assignedIds.has(p.id))
    .sort((a, b) => getPokemonPower(b) - getPokemonPower(a));

  if (available.length === 0) {
    notify(state.lang === 'fr' ? 'Aucun Pokémon disponible' : 'No Pokémon available');
    return;
  }

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.id = 'teamPickerOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease';

  const targetLabel = type === 'boss'
    ? (state.lang === 'fr' ? 'Équipe du Boss' : 'Boss Team')
    : (state.agents.find(a => a.id === targetId)?.name || 'Agent');

  let listHtml = available.slice(0, 30).map(p => {
    const power = getPokemonPower(p);
    return `<div class="picker-pokemon" data-pick-id="${p.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:40px;height:40px">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px">${speciesName(p.species_en)} ${'★'.repeat(p.potential)}${p.shiny ? ' ✨' : ''}</div>
        <div style="font-size:10px;color:var(--text-dim)">Lv.${p.level} — PC: ${power}</div>
      </div>
    </div>`;
  }).join('');

  overlay.innerHTML = `<div style="background:var(--bg-panel);border:2px solid var(--border);border-radius:var(--radius);width:90%;max-width:400px;max-height:70vh;display:flex;flex-direction:column">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:2px solid var(--border)">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">${state.lang === 'fr' ? 'Choisir un Pokémon' : 'Choose a Pokémon'} → ${targetLabel}</div>
      <button id="btnClosePicker" style="background:none;border:none;color:var(--text-dim);font-size:20px;cursor:pointer;line-height:1">&times;</button>
    </div>
    <div style="padding:6px 10px;border-bottom:1px solid var(--border)">
      <input id="pickerSearch" type="text" placeholder="Filtrer..." style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:11px;padding:4px 8px;box-sizing:border-box">
    </div>
    <div id="pickerList" style="overflow-y:auto;flex:1">${listHtml}</div>
  </div>`;

  document.body.appendChild(overlay);

  // Close
  overlay.querySelector('#btnClosePicker').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // Pick handler
  overlay.querySelectorAll('[data-pick-id]').forEach(el => {
    el.addEventListener('click', () => {
      const pkId = el.dataset.pickId;
      const pk = state.pokemons.find(p => p.id === pkId);
      if (!pk) return;
      if (type === 'boss') {
        if (state.gang.bossTeam.length < 3) {
          removePokemonFromAllAssignments(pkId);
          state.gang.bossTeam.push(pkId);
          if (state.gang.bossTeamSlots) state.gang.bossTeamSlots[state.gang.activeBossTeamSlot || 0] = [...state.gang.bossTeam];
        }
      } else {
        const agent = state.agents.find(a => a.id === targetId);
        if (agent && agent.team.length < 3) {
          agent.team.push(pkId);
        }
      }
      saveState();
      overlay.remove();
      notify(`${speciesName(pk.species_en)} → ${targetLabel}`, 'success');
      if (onDone) onDone();
    });
  });

  // Search filter
  const searchInput = overlay.querySelector('#pickerSearch');
  const pickerList = overlay.querySelector('#pickerList');
  if (searchInput && pickerList) {
    const bindPickHandlers = (container) => {
      container.querySelectorAll('[data-pick-id]').forEach(el => {
        el.addEventListener('click', () => {
          const pkId = el.dataset.pickId;
          const pk = state.pokemons.find(p => p.id === pkId);
          if (!pk) return;
          if (type === 'boss') {
            if (state.gang.bossTeam.length < 3) {
              removePokemonFromAllAssignments(pkId);
              state.gang.bossTeam.push(pkId);
              if (state.gang.bossTeamSlots) state.gang.bossTeamSlots[state.gang.activeBossTeamSlot || 0] = [...state.gang.bossTeam];
            }
          } else {
            const agent = state.agents.find(a => a.id === targetId);
            if (agent && agent.team.length < 3) agent.team.push(pkId);
          }
          saveState();
          overlay.remove();
          notify(`${speciesName(pk.species_en)} → ${targetLabel}`, 'success');
          if (onDone) onDone();
        });
      });
    };
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      const filtered = q ? available.filter(p => speciesName(p.species_en).toLowerCase().includes(q)) : available;
      pickerList.innerHTML = filtered.slice(0, 50).map(p => {
        const power = getPokemonPower(p);
        return `<div class="picker-pokemon" data-pick-id="${p.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s">
          <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:40px;height:40px">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px">${speciesName(p.species_en)} ${'★'.repeat(p.potential)}${p.shiny ? ' ✨' : ''}</div>
            <div style="font-size:10px;color:var(--text-dim)">Lv.${p.level} — PC: ${power}</div>
          </div>
        </div>`;
      }).join('');
      bindPickHandlers(pickerList);
    });
  }
}

// Assign a pokemon to a team from PC (shows picker for destination)
function openAssignToPicker(pokemonId) {
  const pk = state.pokemons.find(p => p.id === pokemonId);
  if (!pk) return;

  // Check if already assigned
  const assignedIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => assignedIds.add(id));
  if (assignedIds.has(pokemonId)) {
    notify(state.lang === 'fr' ? 'Déjà dans une équipe !' : 'Already in a team!');
    return;
  }

  // Build list of destinations (Boss + all agents with < 3 team members)
  const destinations = [];
  if (state.gang.bossTeam.length < 3) {
    destinations.push({ type: 'boss', id: null, label: state.gang.bossName + ' (Boss)', sprite: state.gang.bossSprite ? trainerSprite(state.gang.bossSprite) : null });
  }
  for (const a of state.agents) {
    if (a.team.length < 3) {
      destinations.push({ type: 'agent', id: a.id, label: a.name, sprite: a.sprite });
    }
  }

  if (destinations.length === 0) {
    notify(state.lang === 'fr' ? 'Toutes les équipes sont pleines !' : 'All teams are full!');
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'teamPickerOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease';

  let listHtml = destinations.map(d => `
    <div class="picker-dest" data-dest-type="${d.type}" data-dest-id="${d.id || ''}" style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s">
      ${d.sprite ? `<img src="${d.sprite}" style="width:40px;height:40px;image-rendering:pixelated">` : '<div style="width:40px;height:40px;background:var(--bg);border-radius:4px;display:flex;align-items:center;justify-content:center">👤</div>'}
      <div style="font-size:12px">${d.label}</div>
      <div style="font-size:10px;color:var(--text-dim);margin-left:auto">${d.type === 'boss' ? state.gang.bossTeam.length : state.agents.find(a => a.id === d.id)?.team.length || 0}/3</div>
    </div>
  `).join('');

  overlay.innerHTML = `<div style="background:var(--bg-panel);border:2px solid var(--border);border-radius:var(--radius);width:90%;max-width:360px;max-height:60vh;display:flex;flex-direction:column">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:2px solid var(--border)">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">${speciesName(pk.species_en)} → ?</div>
      <button id="btnClosePicker" style="background:none;border:none;color:var(--text-dim);font-size:20px;cursor:pointer;line-height:1">&times;</button>
    </div>
    <div style="overflow-y:auto;flex:1">${listHtml}</div>
  </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#btnClosePicker').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelectorAll('.picker-dest').forEach(el => {
    el.addEventListener('click', () => {
      const destType = el.dataset.destType;
      const destId = el.dataset.destId;
      if (destType === 'boss') {
        if (state.gang.bossTeam.length < 3) { removePokemonFromAllAssignments(pokemonId); state.gang.bossTeam.push(pokemonId); }
      } else {
        const agent = state.agents.find(a => a.id === destId);
        if (agent && agent.team.length < 3) agent.team.push(pokemonId);
      }
      saveState();
      overlay.remove();
      const destLabel = destType === 'boss' ? state.gang.bossName : (state.agents.find(a => a.id === destId)?.name || 'Agent');
      notify(`${speciesName(pk.species_en)} → ${destLabel}`, 'success');
      renderPCTab();
    });
  });
}

// ── Zone timers, spawn, combat — delegated to modules/ui/zoneWindows.js ──────
// Module-level state (zoneNextSpawn, zoneSpawnHistory, currentCombat) live in the module.
// Exposed on globalThis by the module: zoneNextSpawn, zoneSpawnHistory.
function updateZoneTimers(zoneId)                                  { return globalThis._zwin_updateZoneTimers(zoneId); }
function tickZoneSpawn(zoneId)                                     { return globalThis._zwin_tickZoneSpawn(zoneId); }
function _tryWingDrop(zoneId)                                      { return globalThis._zwin_tryWingDrop(zoneId); }
function _addVSBadge(el)                                           { return globalThis._zwin_addVSBadge(el); }
function renderSpawnInWindow(zoneId, spawnObj)                     { return globalThis._zwin_renderSpawnInWindow(zoneId, spawnObj); }
function removeSpawn(zoneId, spawnId)                              { return globalThis._zwin_removeSpawn(zoneId, spawnId); }
function animateCapture(zoneId, spawnObj, spawnEl)                 { return globalThis._zwin_animateCapture(zoneId, spawnObj, spawnEl); }
function showCaptureBurst(container, x, y, potential, shiny)      { return globalThis._zwin_showCaptureBurst(container, x, y, potential, shiny); }
function buildPlayerTeamForZone(zoneId)                            { return globalThis._zwin_buildPlayerTeamForZone(zoneId); }
function openCombatPopup(zoneId, spawnObj)                        { return globalThis._zwin_openCombatPopup(zoneId, spawnObj); }
function executeCombat()                                           { return globalThis._zwin_executeCombat(); }
function closeCombatPopup()                                        { return globalThis._zwin_closeCombatPopup(); }
function _refreshRaidBtn(zoneId)                                   { return globalThis._zwin_refreshRaidBtn(zoneId); }


// ════════════════════════════════════════════════════════════════
// 15b. UI — COSMETICS TAB (panel dédié, débloquable 50 000₽)
// ════════════════════════════════════════════════════════════════

const COSMETICS_UNLOCK_COST = 50000;

function renderCosmeticsTab() {
  const tab = document.getElementById('tabCosmetics');
  if (!tab) return;

  // L'atelier cosmétique est maintenant intégré dans l'onglet Gang
  tab.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;gap:16px;text-align:center">
      <div style="font-size:36px">👑</div>
      <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold)">ATELIER COSMÉTIQUES</div>
      <div style="font-size:11px;color:var(--text-dim);max-width:260px">L'atelier est maintenant intégré dans l'onglet Gang.</div>
      <button id="btnGoGangTab" style="font-family:var(--font-pixel);font-size:9px;padding:8px 18px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">
        → Aller à l'onglet Gang
      </button>
    </div>`;

  tab.querySelector('#btnGoGangTab')?.addEventListener('click', () => switchTab('tabGang'));
}

// ════════════════════════════════════════════════════════════════
// 16.  UI — MARKET TAB
// ════════════════════════════════════════════════════════════════

function renderMarketTab() {
  renderQuestPanel();
  renderShopPanel();
  renderBarterPanel();
}

// ── Troc d'objets ─────────────────────────────────────────────
const BARTER_RECIPES = [
  // [donnerItemId, donnerQty, recevoirItemId, recevoirQty, label]
  ['pokeball',  10, 'greatball',  1,   '10 Poké Balls → 1 Super Ball'],
  ['greatball', 10, 'ultraball',  1,   '10 Super Balls → 1 Hyper Ball'],
  // index 2 = MB ⇄ HB (bidirectionnel — voir _barterMbReverse)
  ['ultraball', 100, 'masterball', 1,  '100 Hyper Balls → 1 Master Ball'],
  ['lure',       5, 'superlure',  1,   '5 Leurres → 1 Super Leurre'],
  ['superlure',  3, 'evostone',   1,   '3 Super Leurres → 1 Pierre Évol.'],
  ['rarecandy',  3, 'evostone',   1,   '3 Super Bonbons → 1 Pierre Évol.'],
  ['incense',    3, 'aura',       1,   '3 Encens → 1 Aura Shiny'],
  ['potion',    10, 'rarecandy',  1,   '10 Potions → 1 Super Bonbon'],
];

// Sens du troc MB ⇄ HB (false = 100 HB→1 MB ; true = 1 MB→100 HB)
let _barterMbReverse = false;

function renderBarterPanel() {
  const panel = document.querySelector('#barterPanel .barter-list');
  if (!panel) return;

  // Recette active pour le troc MB (index 2), sens selon _barterMbReverse
  const mbRecipe = _barterMbReverse
    ? ['masterball', 1,   'ultraball', 100, '1 Master Ball → 100 Hyper Balls']
    : ['ultraball',  100, 'masterball', 1,  '100 Hyper Balls → 1 Master Ball'];
  const recipes = [...BARTER_RECIPES];
  recipes[2] = mbRecipe;

  // Bouton toggle sens MB en tête de panel
  const toggleBtn = `<div style="padding:6px 4px 4px;border-bottom:1px solid var(--border)">
    <button id="btnBarterMbToggle" style="font-family:var(--font-pixel);font-size:7px;padding:4px 10px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">
      ⇄ ${_barterMbReverse ? 'MB → 100 HB' : '100 HB → MB'}
    </button>
  </div>`;

  // ── Recettes d'items classiques ────────────────────────────────
  const recipesHtml = recipes.map((r, i) => {
    const [giveId, giveQty, getId, getQty, label] = r;
    const owned = state.inventory?.[giveId] || 0;
    const canAfford = owned >= giveQty;
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border);opacity:${canAfford ? 1 : 0.5}">
      ${itemSprite(giveId)}
      <div style="flex:1;font-size:9px;color:var(--text)">${label}</div>
      <div style="font-size:8px;color:${canAfford ? 'var(--gold-dim)' : 'var(--text-dim)'}">×${owned}</div>
      <button data-barter="${i}" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:${canAfford ? 'var(--bg-hover)' : 'var(--bg)'};border:1px solid ${canAfford ? 'var(--gold-dim)' : 'var(--border)'};border-radius:var(--radius-sm);color:${canAfford ? 'var(--gold)' : 'var(--text-dim)'};cursor:${canAfford ? 'pointer' : 'default'}" ${canAfford ? '' : 'disabled'}>Troquer</button>
    </div>`;
  }).join('');

  // ── Échange d'ailes (bidirectionnel) ──────────────────────────
  const WING_EXCHANGES = [
    { giveId:'silver_wing',  giveQty:2, getId:'rainbow_wing', getQty:1, label:"2 Argent'Ailes → 1 Arcenci'Aile" },
    { giveId:'rainbow_wing', giveQty:2, getId:'silver_wing',  getQty:1, label:"2 Arcenci'Ailes → 1 Argent'Aile" },
  ];
  const wingExchangeHtml = `
    <div style="padding:8px 4px 4px;border-top:2px solid var(--border);margin-top:2px">
      <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);margin-bottom:6px;letter-spacing:1px">— ÉCHANGE D'AILES —</div>
      ${WING_EXCHANGES.map((wx, i) => {
        const owned = state.inventory?.[wx.giveId] || 0;
        const canAfford = owned >= wx.giveQty;
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border);opacity:${canAfford ? 1 : 0.5}">
          ${itemSprite(wx.giveId)}
          <div style="flex:1;font-size:9px;color:var(--text)">${wx.label}</div>
          <div style="font-size:8px;color:${canAfford ? 'var(--gold-dim)' : 'var(--text-dim)'}">×${owned}</div>
          <button data-wing-barter="${i}" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:${canAfford ? 'var(--bg-hover)' : 'var(--bg)'};border:1px solid ${canAfford ? 'var(--gold-dim)' : 'var(--border)'};border-radius:var(--radius-sm);color:${canAfford ? 'var(--gold)' : 'var(--text-dim)'};cursor:${canAfford ? 'pointer' : 'default'}" ${canAfford ? '' : 'disabled'}>Troquer</button>
        </div>`;
      }).join('')}
    </div>`;

  // ── Section déblocage zones via ailes ──────────────────────────
  const WING_PERMITS = [
    { permitId:'tourbillon_permit', wingId:'silver_wing', wingName:"Argent'Aile",  wingQty:50,
      zoneName:'Îles Tourbillon', icon:'🌊', legendary:'Lugia' },
    { permitId:'carillon_permit',   wingId:'rainbow_wing', wingName:"Arcenci'Aile", wingQty:50,
      zoneName:'Tour Carillon',   icon:'🔔', legendary:'Ho-Oh' },
  ];
  const wingZonesHtml = `
    <div style="padding:8px 4px 4px;border-top:2px solid var(--border);margin-top:2px">
      <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);margin-bottom:6px;letter-spacing:1px">— ZONES LÉGENDAIRES —</div>
      ${WING_PERMITS.map(wp => {
        const have = state.inventory?.[wp.wingId] || 0;
        const alreadyOwned = !!state.purchases?.[wp.permitId];
        const canBuy = !alreadyOwned && have >= wp.wingQty;
        const pct = Math.min(100, Math.round(have / wp.wingQty * 100));
        const progressColor = alreadyOwned ? 'var(--green)' : have >= wp.wingQty ? 'var(--gold)' : 'var(--red)';
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border);opacity:${alreadyOwned ? 0.6 : 1}">
          ${itemSprite(wp.wingId)}
          <div style="flex:1">
            <div style="font-size:9px;color:var(--text)">${wp.wingQty}× ${wp.wingName} → ${wp.icon} ${wp.zoneName}</div>
            <div style="font-size:8px;color:var(--text-dim);margin-top:2px">Légendaire : ${wp.legendary}</div>
            <div style="height:4px;background:var(--border);border-radius:2px;margin-top:4px;overflow:hidden">
              <div style="height:100%;width:${alreadyOwned ? 100 : pct}%;background:${progressColor};border-radius:2px;transition:width .3s"></div>
            </div>
            <div style="font-size:8px;color:${progressColor};margin-top:2px">${alreadyOwned ? '✓ Zone débloquée' : `${have} / ${wp.wingQty} ${wp.wingName}`}</div>
          </div>
          <button data-wing-permit="${wp.permitId}" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:${canBuy ? 'var(--bg-hover)' : 'var(--bg)'};border:1px solid ${canBuy ? 'var(--gold-dim)' : 'var(--border)'};border-radius:var(--radius-sm);color:${alreadyOwned ? 'var(--green)' : canBuy ? 'var(--gold)' : 'var(--text-dim)'};cursor:${canBuy ? 'pointer' : 'default'}" ${canBuy ? '' : 'disabled'}>${alreadyOwned ? 'Acquis' : 'Échanger'}</button>
        </div>`;
      }).join('')}
    </div>`;

  panel.innerHTML = toggleBtn + recipesHtml + wingExchangeHtml + wingZonesHtml;

  document.getElementById('btnBarterMbToggle')?.addEventListener('click', () => {
    _barterMbReverse = !_barterMbReverse;
    renderBarterPanel();
  });

  panel.querySelectorAll('[data-barter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [giveId, giveQty, getId, getQty] = recipes[parseInt(btn.dataset.barter)];
      if ((state.inventory?.[giveId] || 0) < giveQty) { SFX.play('error'); return; }
      state.inventory[giveId] -= giveQty;
      state.inventory[getId] = (state.inventory[getId] || 0) + getQty;
      saveState(); updateTopBar(); SFX.play('buy');
      notify(`Troc effectué !`, 'success');
      renderBarterPanel();
    });
  });

  panel.querySelectorAll('[data-wing-barter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const wx = WING_EXCHANGES[parseInt(btn.dataset.wingBarter)];
      if (!wx) return;
      if ((state.inventory?.[wx.giveId] || 0) < wx.giveQty) { SFX.play('error'); return; }
      state.inventory[wx.giveId] -= wx.giveQty;
      state.inventory[wx.getId] = (state.inventory[wx.getId] || 0) + wx.getQty;
      saveState(); updateTopBar(); SFX.play('buy');
      notify(`🪶 Échange effectué !`, 'success');
      renderBarterPanel();
    });
  });

  panel.querySelectorAll('[data-wing-permit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const permitId = btn.dataset.wingPermit;
      const itemDef = SHOP_ITEMS.find(s => s.id === permitId);
      if (!itemDef) return;
      if (buyItem(itemDef)) {
        SFX.play('buy');
        renderBarterPanel();
        renderShopPanel();
        if (activeTab === 'tabZones') renderZonesTab();
      }
    });
  });
}

// ── Quest Panel (replaces sell panel) ────────────────────────────
function renderQuestPanel() {
  const panel = document.querySelector('#questPanel .quest-list');
  if (!panel) return;
  initMissions();
  initHourlyQuests();

  // ── Helper: build a classic mission section ──────────────────
  function buildSection(title, timer, missions) {
    if (missions.length === 0) return '';
    let html = `<div class="quest-section-title">${title}${timer ? `<span class="quest-timer">${timer}</span>` : ''}</div>`;
    for (const m of missions) {
      const progress = getMissionProgress(m);
      const complete  = isMissionComplete(m);
      const claimed   = isMissionClaimed(m);
      const pct = Math.min(100, (progress / m.target) * 100);
      const name = state.lang === 'fr' ? m.fr : m.en;
      const rewardStr = [m.reward.money ? m.reward.money.toLocaleString() + '₽' : '', m.reward.rep ? '+' + m.reward.rep + ' rep' : ''].filter(Boolean).join('  ');
      const fillColor = complete ? 'var(--green)' : 'var(--red)';
      html += `<div class="quest-entry${claimed ? ' claimed' : ''}">
        <span class="quest-icon">${m.icon}</span>
        <div class="quest-body">
          <div class="quest-name${claimed ? ' done' : ''}">${name}</div>
          ${m.desc_fr ? `<div class="quest-desc">${state.lang === 'fr' ? m.desc_fr : m.desc_en}</div>` : ''}
          <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${pct}%;background:${fillColor}"></div></div>
          <div class="quest-reward">${progress}/${m.target}${rewardStr ? '  —  ' + rewardStr : ''}</div>
        </div>
        ${complete && !claimed
          ? `<button class="btn-claim-quest" data-mission-id="${m.id}">Réclamer</button>`
          : claimed ? '<span style="font-size:12px;color:var(--green)">✓</span>' : ''}
      </div>`;
    }
    return html;
  }

  // ── Hourly section ────────────────────────────────────────────
  const hourlyRem = Math.max(0, HOUR_MS - (Date.now() - state.missions.hourly.reset));
  const hMin = Math.floor(hourlyRem / 60000);
  const hSec = Math.floor((hourlyRem % 60000) / 1000);
  const hourlyCountdown = `${hMin}m${String(hSec).padStart(2,'0')}s`;

  let hourlyHtml = `<div class="quest-section-title">Quêtes Horaires <span class="quest-timer">${hourlyCountdown}</span></div>`;
  for (let i = 0; i < 5; i++) {
    const q = getHourlyQuest(i);
    if (!q) continue;
    const progress = getHourlyProgress(q);
    const complete  = isHourlyComplete(q);
    const claimed   = isHourlyClaimed(i);
    const pct = Math.min(100, (progress / q.target) * 100);
    const rewardStr = [q.reward.money ? q.reward.money.toLocaleString() + '₽' : '', q.reward.rep ? '+' + q.reward.rep + ' rep' : ''].filter(Boolean).join('  ');
    const diffColor = q.diff === 'hard' ? 'var(--red)' : 'var(--blue)';
    const fillColor = complete ? 'var(--green)' : diffColor;
    hourlyHtml += `<div class="quest-entry${claimed ? ' claimed' : ''}" style="border-left:3px solid ${diffColor};padding-left:6px">
      <span class="quest-icon">${q.icon}</span>
      <div class="quest-body">
        <div class="quest-name${claimed ? ' done' : ''}" style="display:flex;align-items:center;gap:5px">
          ${q.fr}
          <span style="font-size:7px;padding:1px 4px;border-radius:3px;background:${diffColor};color:#fff;font-family:var(--font-pixel)">${q.diff === 'hard' ? 'HARD' : 'MED'}</span>
        </div>
        <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${pct}%;background:${fillColor}"></div></div>
        <div class="quest-reward">${progress}/${q.target}  —  ${rewardStr}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
        ${complete && !claimed
          ? `<button class="btn-claim-quest btn-claim-hourly" data-slot="${i}">Réclamer</button>`
          : claimed ? '<span style="font-size:12px;color:var(--green)">✓</span>' : ''}
        ${!claimed ? `<button class="btn-reroll-hourly" data-slot="${i}" title="Reroll (-${HOURLY_QUEST_REROLL_COST}₽)" style="font-size:7px;padding:3px 6px;background:var(--bg);border:1px solid var(--border);border-radius:3px;color:var(--text-dim);cursor:pointer">↻ ${HOURLY_QUEST_REROLL_COST}₽</button>` : ''}
      </div>
    </div>`;
  }

  // ── Regular missions ──────────────────────────────────────────
  const story   = MISSIONS.filter(m => m.type === 'story' && !isMissionClaimed(m));
  const done    = MISSIONS.filter(m => m.type === 'story' &&  isMissionClaimed(m));

  panel.innerHTML = hourlyHtml +
    buildSection('Histoire & Objectifs', '', story) +
    (done.length ? buildSection('Terminées ✓', '', done) : '');

  // Bind buttons
  panel.querySelectorAll('.btn-claim-quest').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = MISSIONS.find(m => m.id === btn.dataset.missionId);
      if (m) { claimMission(m); renderQuestPanel(); }
    });
  });
  panel.querySelectorAll('.btn-claim-hourly').forEach(btn => {
    btn.addEventListener('click', () => {
      claimHourlyQuest(parseInt(btn.dataset.slot));
      renderQuestPanel();
    });
  });
  panel.querySelectorAll('.btn-reroll-hourly').forEach(btn => {
    btn.addEventListener('click', () => {
      rerollHourlyQuest(parseInt(btn.dataset.slot));
      renderQuestPanel();
    });
  });
}

let shopMultiplier = 1; // ×1, ×5, ×10

function renderShopPanel() {
  const panel = document.querySelector('#shopPanel .shop-list');
  if (!panel) return;

  const ZONE_UNLOCK_ITEM_IDS = new Set(['map_pallet','casino_ticket','silph_keycard','boat_ticket','tourbillon_permit','carillon_permit']);
  const ONE_OFF_IDS = new Set(['mysteryegg','incubator','translator','map_pallet','casino_ticket','silph_keycard','boat_ticket','tourbillon_permit','carillon_permit']);
  const WING_PERMIT_IDS = new Set(['tourbillon_permit','carillon_permit']);

  // ── Multiplier toolbar ─────────────────────────────────────────
  const multBar = [1,5,10].map(m =>
    `<button class="shop-mult-btn" data-mult="${m}" style="font-family:var(--font-pixel);font-size:9px;padding:4px 10px;border-radius:var(--radius-sm);cursor:pointer;
      background:${shopMultiplier===m?'var(--gold-dim)':'var(--bg)'};
      border:1px solid ${shopMultiplier===m?'var(--gold)':'var(--border)'};
      color:${shopMultiplier===m?'#0a0a0a':'var(--text)'}"
    >×${m}</button>`
  ).join('');

  // ── Shop items ─────────────────────────────────────────────────
  const itemsHtml = SHOP_ITEMS.map(item => {
    const ballInfo = BALLS[item.id];
    const name = ballInfo ? (state.lang === 'fr' ? ballInfo.fr : ballInfo.en) : (state.lang === 'fr' ? (item.fr || item.id) : (item.en || item.id));
    const owned = state.inventory[item.id] || 0;
    const isOneOff = ONE_OFF_IDS.has(item.id);
    const mult = isOneOff ? 1 : shopMultiplier;
    const baseCost = item.id === 'mysteryegg' ? getMysteryEggCost()
      : item.id === 'incubator' ? Math.round(15000 * Math.pow(2, owned))
      : item.cost;
    const totalCost = baseCost * mult;
    const totalQty  = item.qty * mult;
    const isUnlockItem = ZONE_UNLOCK_ITEM_IDS.has(item.id);
    const alreadyOwned = isUnlockItem && state.purchases?.[item.id];
    const incubatorMaxed = item.id === 'incubator' && owned >= 10;
    const desc = item.desc_fr
      ? (state.lang === 'fr' ? item.desc_fr : item.desc_en)
      : `×${totalQty}`;
    const isWingPermit = WING_PERMIT_IDS.has(item.id);
    const wingHave = isWingPermit ? (state.inventory[item.wingCost?.item] || 0) : 0;
    const wingName = isWingPermit
      ? (item.wingCost?.item === 'silver_wing' ? "Argent'Aile" : "Arcenci'Aile")
      : '';
    const extraInfo = item.id === 'mysteryegg'
      ? `<div style="font-size:9px;color:var(--text-dim)">Achat #${(state.purchases?.mysteryEggCount||0)+1} — 45min éclosion</div>`
      : item.id === 'incubator'
        ? `<div style="font-size:10px;color:var(--text-dim)">Possédés: ${owned}/10${incubatorMaxed ? ' <span style="color:var(--red)">MAX</span>' : ''}</div>`
        : isWingPermit
          ? `<div style="font-size:10px;color:${alreadyOwned?'var(--green)':wingHave>=(item.wingCost?.qty||50)?'var(--gold)':'var(--red)'}">
              ${alreadyOwned ? '✓ Possédé' : `${wingName} : ${wingHave}/${item.wingCost?.qty||50}`}
             </div>`
          : isUnlockItem
            ? `<div style="font-size:10px;color:${alreadyOwned?'var(--green)':'var(--text-dim)'}"> ${alreadyOwned ? '✓ Possédé' : 'Débloque une zone'}</div>`
            : `<div style="font-size:10px;color:var(--text-dim)">Stock: ${owned}${!isOneOff && mult>1 ? ` (+${totalQty})` : ''}</div>`;
    const btnDisabled = alreadyOwned || incubatorMaxed || (isWingPermit && wingHave < (item.wingCost?.qty || 50));
    const btnLabel = (alreadyOwned || incubatorMaxed)
      ? (incubatorMaxed ? 'MAX' : 'Acquis')
      : isWingPermit
        ? `${item.wingCost?.qty||50}× ${wingName}`
        : `${totalCost.toLocaleString()}₽${mult>1&&!isOneOff ? ` ×${mult}` : ''}`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid var(--border);opacity:${btnDisabled?'0.6':'1'}">
      ${itemSprite(item.id)}
      <div style="flex:1">
        <div style="font-size:12px">${name} <span style="color:var(--text-dim)">(${desc})</span></div>
        ${extraInfo}
      </div>
      <button style="font-family:var(--font-pixel);font-size:9px;padding:6px 10px;background:var(--bg);
        border:1px solid ${btnDisabled?'var(--border)':'var(--gold-dim)'};border-radius:var(--radius-sm);
        color:${btnDisabled?'var(--text-dim)':'var(--gold)'};cursor:${btnDisabled?'default':'pointer'};white-space:nowrap"
        data-shop-idx="${SHOP_ITEMS.indexOf(item)}" data-shop-mult="${mult}" ${btnDisabled?'disabled':''}>${btnLabel}</button>
    </div>`;
  }).join('');

  // ── Active ball selector ───────────────────────────────────────
  const ballSel = `
    <div style="padding:10px 4px;border-top:2px solid var(--border);margin-top:4px">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:8px">— BALL ACTIVE —</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${Object.entries(BALLS).map(([key, ball]) => `
          <button data-ball="${key}" style="font-size:10px;padding:4px 10px;border-radius:var(--radius-sm);cursor:pointer;
            background:${state.activeBall===key?'var(--red-dark)':'var(--bg)'};
            border:1px solid ${state.activeBall===key?'var(--red)':'var(--border)'};color:var(--text)">
            ${state.lang==='fr'?ball.fr:ball.en} (${state.inventory[key]||0})
          </button>`).join('')}
      </div>
    </div>`;

  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;padding:6px 4px 8px;border-bottom:1px solid var(--border)">
      <span style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim)">Quantité :</span>
      ${multBar}
    </div>
    ${itemsHtml}${ballSel}`;

  // ── Bind events ────────────────────────────────────────────────
  panel.querySelectorAll('.shop-mult-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      shopMultiplier = parseInt(btn.dataset.mult);
      renderShopPanel();
    });
  });
  panel.querySelectorAll('[data-shop-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = SHOP_ITEMS[parseInt(btn.dataset.shopIdx)];
      const mult = parseInt(btn.dataset.shopMult) || 1;
      if (!item || btn.disabled) return;
      for (let i = 0; i < mult; i++) {
        if (!buyItem(item)) break;
      }
      updateTopBar();
      renderShopPanel();
      if (activeTab === 'tabZones') renderZoneWindows();
    });
  });
  panel.querySelectorAll('[data-ball]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeBall = btn.dataset.ball;
      saveState();
      renderShopPanel();
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 17.  UI — PC TAB
// ════════════════════════════════════════════════════════════════

let pcSelectedId = null;
let pcSelectedIds = new Set(); // Ctrl+click multi-selection
let pcPage = 0;
const PC_PAGE_SIZE = 36;
let pcGridCols = 6;   // colonnes de la grille (configurable)
let pcGridRows = 6;   // lignes par page (configurable)
let pcGroupMode = false; // regroupement par espèce
let pcGroupSpecies = null; // espèce sélectionnée en mode groupe

// ── Filter PC to a specific species (from detail panel or Pokédex) ──
function filterPCBySpecies(species_en) {
  switchTab('tabPC');
  const searchEl = document.getElementById('pcSearch');
  if (searchEl) searchEl.value = speciesName(species_en);
  pcGroupMode = false;
  pcGroupSpecies = null;
  pcPage = 0;
  _pcLastRenderKey = '';
  renderPCTab();
}

// ── Context Menu ──────────────────────────────────────────────
let ctxMenu = null;
function showContextMenu(x, y, items) {
  closeContextMenu();
  ctxMenu = document.createElement('div');
  ctxMenu.id = 'ctxMenu';
  ctxMenu.style.cssText = `position:fixed;left:${x}px;top:${y}px;background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius-sm);z-index:9000;min-width:150px;box-shadow:0 4px 12px rgba(0,0,0,.5);overflow:hidden`;
  ctxMenu.innerHTML = items.filter(it => it !== '---').map(it =>
    `<div class="ctx-item" data-action="${it.action}" style="padding:8px 14px;font-size:11px;cursor:pointer;white-space:nowrap">${it.label}</div>`
  ).join('');
  document.body.appendChild(ctxMenu);
  const actionMap = {};
  items.forEach(it => { if (it !== '---' && it.action) actionMap[it.action] = it.fn; });
  ctxMenu.querySelectorAll('.ctx-item').forEach(el => {
    el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,.07)');
    el.addEventListener('mouseleave', () => el.style.background = '');
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const fn = actionMap[el.dataset.action];
      if (fn) fn();
      closeContextMenu();
    });
  });
  requestAnimationFrame(() => {
    if (!ctxMenu) return;
    const r = ctxMenu.getBoundingClientRect();
    if (r.right > window.innerWidth) ctxMenu.style.left = (x - r.width) + 'px';
    if (r.bottom > window.innerHeight) ctxMenu.style.top = (y - r.height) + 'px';
  });
  setTimeout(() => document.addEventListener('click', closeContextMenu, { once: true }), 0);
}
function closeContextMenu() {
  ctxMenu?.remove();
  ctxMenu = null;
}

// ── Game Event Feed ─────────────────────────────────────────────
// Remplace l'ancien battleLog — reçoit toutes les catégories d'événements.
// Appelé via pushFeedEvent({ category, title, detail?, win? })
const gameFeed = [];
const FEED_MAX = 100;
let feedFilter = 'all';

const FEED_CAT = {
  combat:  { icon: '⚔', label: 'Combat' },
  capture: { icon: '🔴', label: 'Capture' },
  agent:   { icon: '🕵', label: 'Agent' },
  loot:    { icon: '💰', label: 'Butin' },
  zone:    { icon: '🗺', label: 'Zone' },
  system:  { icon: '⚙', label: 'Système' },
};

function pushFeedEvent({ category = 'system', title = '', detail = '', win = null, ...extra } = {}) {
  const cat = FEED_CAT[category] || FEED_CAT.system;
  gameFeed.unshift({ ts: Date.now(), category, icon: cat.icon, title, detail, win, ...extra });
  if (gameFeed.length > FEED_MAX) gameFeed.pop();
  if (activeTab === 'tabBattleLog') renderEventsTab();
}

let feedWinFilter = 'all'; // 'all' | 'win' | 'loss'

function renderEventsTab() {
  const filtersEl = document.getElementById('feedFilters');
  const listEl    = document.getElementById('feedList');
  if (!listEl) return;

  if (filtersEl && !filtersEl.dataset.wired) {
    filtersEl.dataset.wired = '1';
    const cats = ['all', ...Object.keys(FEED_CAT)];
    const winFilterHtml = `
      <div class="feed-win-filters" style="display:flex;gap:4px;margin-left:auto">
        <button class="feed-filter-btn" data-wf="all">Tous</button>
        <button class="feed-filter-btn" data-wf="win" style="color:var(--green)">✓ Vic.</button>
        <button class="feed-filter-btn" data-wf="loss" style="color:var(--red)">✗ Déf.</button>
      </div>`;
    filtersEl.innerHTML = cats.map(c => {
      const label = c === 'all' ? 'Tout' : (FEED_CAT[c].icon + ' ' + FEED_CAT[c].label);
      return `<button class="feed-filter-btn" data-ff="${c}">${label}</button>`;
    }).join('') + winFilterHtml;
    filtersEl.querySelectorAll('[data-ff]').forEach(btn => {
      btn.addEventListener('click', () => { feedFilter = btn.dataset.ff; renderEventsTab(); });
    });
    filtersEl.querySelectorAll('[data-wf]').forEach(btn => {
      btn.addEventListener('click', () => { feedWinFilter = btn.dataset.wf; renderEventsTab(); });
    });
  }
  // Highlight active filters
  filtersEl?.querySelectorAll('[data-ff]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ff === feedFilter);
  });
  filtersEl?.querySelectorAll('[data-wf]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.wf === feedWinFilter);
  });

  let filtered = feedFilter === 'all' ? gameFeed : gameFeed.filter(e => e.category === feedFilter);
  if (feedWinFilter === 'win')  filtered = filtered.filter(e => e.win === true);
  if (feedWinFilter === 'loss') filtered = filtered.filter(e => e.win === false);

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="color:var(--text-dim);text-align:center;padding:24px;font-size:9px">Aucun événement</div>`;
    return;
  }

  listEl.innerHTML = filtered.map((e, i) => {
    const time  = new Date(e.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const color = e.win === true ? 'var(--green)' : e.win === false ? 'var(--red)' : 'var(--text)';
    const hasExpandable = e.detail || e.combatLog?.length || e.species_en;

    // Capture entry: show sprite + stars
    let captureHtml = '';
    if (e.category === 'capture' && e.species_en) {
      const stars = '★'.repeat(e.potential || 0) + '☆'.repeat(5 - (e.potential || 0));
      const shinyGlow = e.shiny ? 'filter:drop-shadow(0 0 4px var(--gold))' : '';
      captureHtml = `<div class="feed-capture-preview" style="display:flex;align-items:center;gap:6px;margin-top:4px">
        <img src="${pokeSprite(e.species_en, e.shiny)}" style="width:32px;height:32px;image-rendering:pixelated;${shinyGlow}" alt="${e.species_en}">
        <span style="font-family:var(--font-pixel);font-size:9px;color:${e.shiny ? 'var(--gold)' : 'var(--text-dim)'}">${stars}${e.byAgent ? ` · ${e.byAgent}` : ''}</span>
      </div>`;
    }

    // Combat log for replay
    let combatLogHtml = '';
    if (e.combatLog?.length) {
      combatLogHtml = `<div class="feed-combat-log" style="display:none;margin-top:6px;border-top:1px solid var(--border);padding-top:4px;max-height:120px;overflow-y:auto">
        ${e.combatLog.map(line => `<div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:1px">${line}</div>`).join('')}
      </div>
      <button class="feed-replay-btn" style="font-family:var(--font-pixel);font-size:7px;margin-top:4px;padding:1px 6px;background:rgba(255,255,255,.07);border:1px solid var(--border);border-radius:2px;cursor:pointer;color:var(--text-dim)">📋 Log combat</button>`;
    }

    return `<div class="feed-entry${hasExpandable ? ' feed-has-detail' : ''}" data-fi="${i}">
      <span class="feed-icon">${e.icon}</span>
      <div class="feed-body">
        <div class="feed-title" style="color:${color}">${e.title}</div>
        ${e.detail ? `<div class="feed-detail">${e.detail}</div>` : ''}
        ${captureHtml}
        ${combatLogHtml}
      </div>
      <span class="feed-time">${time}</span>
    </div>`;
  }).join('');

  // Toggle detail on click + replay log toggle
  listEl.querySelectorAll('.feed-entry.feed-has-detail').forEach(el => {
    el.addEventListener('click', (ev) => {
      if (ev.target.closest('.feed-replay-btn')) return; // handled separately
      el.classList.toggle('feed-open');
    });
  });
  listEl.querySelectorAll('.feed-replay-btn').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const logEl = btn.previousElementSibling;
      if (!logEl) return;
      const isOpen = logEl.style.display !== 'none';
      logEl.style.display = isOpen ? 'none' : 'block';
      btn.textContent = isOpen ? '📋 Log combat' : '▲ Fermer log';
    });
  });
}

// Compatibility shim for legacy addBattleLogEntry calls (gym auto-raids, etc.)
function addBattleLogEntry(entry) {
  const zoneName = entry.zoneName || '?';
  const result   = entry.win
    ? `+${entry.reward || 0}₽ +${entry.repGain || 0}rep`
    : 'Défaite';
  pushFeedEvent({
    category: 'combat',
    title: `${entry.win ? 'Victoire' : 'Défaite'} — ${zoneName} ${result}`,
    detail: (entry.lines || []).join(' · '),
    win: !!entry.win,
  });
}

function renderPCTab() {
  // Inject view switcher if not present
  const pcLayout = document.querySelector('#tabPC .pc-layout');
  if (pcLayout) {
    let switcher = document.getElementById('pcViewSwitcher');
    if (!switcher) {
      switcher = document.createElement('div');
      switcher.id = 'pcViewSwitcher';
      switcher.className = 'pc-view-switcher';
      switcher.innerHTML = `
        <button class="pc-view-btn" id="pcBtnGrid" data-pcview="grid">[PC]</button>
        <button class="pc-view-btn" id="pcBtnTraining" data-pcview="training">[FORMATION]</button>
        <button class="pc-view-btn" id="pcBtnLab" data-pcview="lab">[LABO]</button>
        <button class="pc-view-btn" id="pcBtnPension" data-pcview="pension">[PENSION]</button>
        <button class="pc-view-btn" id="pcBtnEggs" data-pcview="eggs">[OEUFS${state.eggs.length ? ` (${state.eggs.length})` : ''}]</button>`;
      pcLayout.parentNode.insertBefore(switcher, pcLayout);
      switcher.querySelectorAll('.pc-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          pcView = btn.dataset.pcview;
          globalThis.pcView = pcView;
          renderPCTab();
        });
      });
    }
    // Update active state + eggs count (always refresh)
    switcher.querySelectorAll('.pc-view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.pcview === pcView);
    });
    const eggsBtn = switcher.querySelector('#pcBtnEggs');
    if (eggsBtn) eggsBtn.textContent = `[OEUFS${state.eggs.length ? ` (${state.eggs.length})` : ''}]`;

    const subViews = ['trainingInPC', 'labInPC', 'pensionInPC', 'eggsInPC'];
    if (pcView === 'training') {
      pcLayout.style.display = 'none';
      subViews.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = id === 'trainingInPC' ? '' : 'none'; });
      let trainingInPC = document.getElementById('trainingInPC');
      if (!trainingInPC) {
        trainingInPC = document.createElement('div');
        trainingInPC.id = 'trainingInPC';
        pcLayout.parentNode.appendChild(trainingInPC);
      }
      trainingInPC.style.display = '';
      renderTrainingTab();
      return;
    } else if (pcView === 'lab') {
      pcLayout.style.display = 'none';
      subViews.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = id === 'labInPC' ? '' : 'none'; });
      let labInPC = document.getElementById('labInPC');
      if (!labInPC) {
        labInPC = document.createElement('div');
        labInPC.id = 'labInPC';
        pcLayout.parentNode.appendChild(labInPC);
      }
      labInPC.style.display = '';
      renderLabTabInEl(labInPC);
      return;
    } else if (pcView === 'pension') {
      pcLayout.style.display = 'none';
      subViews.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = id === 'pensionInPC' ? '' : 'none'; });
      let pensionInPC = document.getElementById('pensionInPC');
      if (!pensionInPC) {
        pensionInPC = document.createElement('div');
        pensionInPC.id = 'pensionInPC';
        pcLayout.parentNode.appendChild(pensionInPC);
      }
      pensionInPC.style.display = '';
      renderPensionView(pensionInPC);
      return;
    } else if (pcView === 'eggs') {
      pcLayout.style.display = 'none';
      subViews.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = id === 'eggsInPC' ? '' : 'none'; });
      let eggsInPC = document.getElementById('eggsInPC');
      if (!eggsInPC) {
        eggsInPC = document.createElement('div');
        eggsInPC.id = 'eggsInPC';
        pcLayout.parentNode.appendChild(eggsInPC);
      }
      eggsInPC.style.display = '';
      renderEggsView(eggsInPC);
      return;
    } else {
      pcLayout.style.display = '';
      subViews.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    }
  }

  // ── Barre d'outils PC (grille + groupement) ───────────────────
  let pcToolbar = document.getElementById('pcToolbar');
  const pcGrid = document.getElementById('pokemonGrid');
  if (!pcToolbar && pcGrid) {
    pcToolbar = document.createElement('div');
    pcToolbar.id = 'pcToolbar';
    pcGrid.parentNode.insertBefore(pcToolbar, pcGrid);
  }
  if (pcToolbar) {
    pcToolbar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0 4px 2px;flex-wrap:wrap';
    pcToolbar.innerHTML = `
      <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">Grille:</span>
      <select id="pcColsSel" style="font-size:9px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:2px 4px">
        <option value="4" ${pcGridCols===4?'selected':''}>4 col</option>
        <option value="6" ${pcGridCols===6?'selected':''}>6 col</option>
        <option value="8" ${pcGridCols===8?'selected':''}>8 col</option>
        <option value="10" ${pcGridCols===10?'selected':''}>10 col</option>
      </select>
      <select id="pcRowsSel" style="font-size:9px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:2px 4px">
        <option value="4" ${pcGridRows===4?'selected':''}>4 lg</option>
        <option value="6" ${pcGridRows===6?'selected':''}>6 lg</option>
        <option value="8" ${pcGridRows===8?'selected':''}>8 lg</option>
      </select>
      <label style="display:flex;align-items:center;gap:4px;font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);cursor:pointer;user-select:none">
        <input type="checkbox" id="pcGroupChk" ${pcGroupMode?'checked':''} style="accent-color:var(--gold)">
        Grouper
      </label>`;
    document.getElementById('pcColsSel')?.addEventListener('change', e => {
      pcGridCols = parseInt(e.target.value); pcPage = 0; renderPokemonGrid(true);
    });
    document.getElementById('pcRowsSel')?.addEventListener('change', e => {
      pcGridRows = parseInt(e.target.value); pcPage = 0; renderPokemonGrid(true);
    });
    document.getElementById('pcGroupChk')?.addEventListener('change', e => {
      pcGroupMode = e.target.checked;
      pcGroupSpecies = null; pcPage = 0;
      renderPokemonGrid(true); renderPokemonDetail();
    });
  }

  renderPokemonGrid();
  renderPokemonDetail();
}

// Auto-incubation — Infirmière Joëlle corrompue
function tryAutoIncubate() {
  if (!state.purchases?.autoIncubator) return;
  if (state.purchases?.autoIncubatorEnabled === false) return; // en congé
  const incubatorCount = state.inventory?.incubator || 0;
  if (incubatorCount === 0) return;
  const eggs = state.eggs || [];
  let changed = false;
  for (const egg of eggs) {
    if (egg.incubating) continue;
    const incubatingNow = eggs.filter(e => e.incubating && e.status !== 'ready').length;
    if (incubatingNow >= incubatorCount) break;
    egg.incubating = true;
    egg.incubatedAt = Date.now();
    egg.hatchAt = Date.now() + (egg.hatchMs || 2700000);
    changed = true;
  }
  if (changed) { saveState(); notify('💉 Joëlle a mis un oeuf en incubation !', 'success'); }
}

function hatchEgg(eggId) {
  const egg = state.eggs.find(e => e.id === eggId);
  if (!egg) return;

  // Always hatch as the lowest evolution stage (Dodrio → Doduo, etc.)
  const baseEn  = getBaseSpecies(egg.species_en);
  const hatched = makePokemon(baseEn, 'pension', 'pokeball');
  if (!hatched) { state.eggs = state.eggs.filter(e => e.id !== eggId); saveState(); renderPCTab(); return; }

  hatched.level = 1; hatched.xp = 0;
  hatched.potential = egg.potential;
  hatched.shiny     = egg.shiny;
  hatched.stats     = calculateStats(hatched);
  hatched.history   = [{ type: 'hatched', ts: Date.now() }];

  state.eggs = state.eggs.filter(e => e.id !== eggId);
  state.pokemons.push(hatched);
  state.stats.totalCaught++;
  state.stats.eggsHatched = (state.stats.eggsHatched || 0) + 1;
  if (!state.pokedex[baseEn]) {
    state.pokedex[baseEn] = { seen: true, caught: true, shiny: egg.shiny, count: 1 };
  } else {
    state.pokedex[baseEn].caught = true;
    state.pokedex[baseEn].count++;
    if (egg.shiny) state.pokedex[baseEn].shiny = true;
  }
  saveState();

  // ── Animation popup ─────────────────────────────────────────────
  // Try PokéOS species egg for pension eggs, fallback to rarity sprite
  const _sp = SPECIES_BY_EN[egg.species_en];
  const _dex = _sp?.dex;
  const _hasPokeos = _dex && (egg.parentA || egg.scanned);
  const eggUrl = _hasPokeos
    ? `https://s3.pokeos.com/pokeos-uploads/forgotten-dex/eggs/${_dex}-animegg.png`
    : eggSprite(egg);
  const eggFallback = eggSprite(egg);
  const pkUrl  = pokeSprite(baseEn, egg.shiny);
  const name   = speciesName(baseEn);
  const stars  = '★'.repeat(hatched.potential || 0);

  const modal = document.createElement('div');
  modal.id = 'hatchModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9400;background:rgba(0,0,0,.95);display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <style>
      @keyframes _eggWobble {
        0%,100%{transform:rotate(0deg)}
        20%{transform:rotate(-9deg)}
        40%{transform:rotate(9deg)}
        60%{transform:rotate(-5deg)}
        80%{transform:rotate(5deg)}
      }
      @keyframes _eggCrack {
        0%{transform:scale(1);opacity:1}
        50%{transform:scale(1.2);opacity:.8}
        100%{transform:scale(0) rotate(20deg);opacity:0}
      }
      @keyframes _pkReveal {
        0%{transform:scale(0) translateY(16px);opacity:0}
        65%{transform:scale(1.15) translateY(-4px);opacity:1}
        100%{transform:scale(1) translateY(0);opacity:1}
      }
      #_hatchEgg { animation:_eggWobble .55s ease-in-out infinite; }
      #_hatchEgg.cracking { animation:_eggCrack .45s ease-in forwards; }
      #_hatchPk { display:none; animation:_pkReveal .5s cubic-bezier(.17,.67,.37,1.3) forwards; image-rendering:pixelated; }
      #_hatchPk.visible { display:block; }
    </style>
    <div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);padding:32px 28px;max-width:300px;width:90%;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold);letter-spacing:.1em">✦ ÉCLOSION ✦</div>
      <div style="position:relative;width:88px;height:88px;display:flex;align-items:center;justify-content:center">
        <img id="_hatchEgg" src="${eggUrl}" style="width:64px;height:64px;object-fit:contain" onerror="if(!this._f){this._f=1;this.src='${eggFallback}'}">
        <img id="_hatchPk"  src="${pkUrl}"  style="width:88px;height:88px;position:absolute;inset:0;${egg.shiny ? 'filter:drop-shadow(0 0 8px gold)' : ''}">
      </div>
      <div id="_hatchInfo" style="opacity:0;transition:opacity .4s;display:flex;flex-direction:column;gap:6px">
        <div style="font-family:var(--font-pixel);font-size:12px;${egg.shiny ? 'color:gold' : 'color:var(--text)'}">${egg.shiny ? '✨ SHINY !  ' : ''}${name}</div>
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">Lv. 1 &nbsp; ${stars}</div>
      </div>
      <button id="_hatchClose" style="font-family:var(--font-pixel);font-size:8px;padding:6px 22px;background:var(--bg);border:1px solid var(--gold);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;opacity:0;pointer-events:none;transition:opacity .3s">OK !</button>
    </div>`;
  document.body.appendChild(modal);

  // Wobble 2.4s → crack → reveal pokemon
  setTimeout(() => document.getElementById('_hatchEgg')?.classList.add('cracking'), 2400);
  setTimeout(() => {
    const eggEl = document.getElementById('_hatchEgg');
    const pkEl  = document.getElementById('_hatchPk');
    const info  = document.getElementById('_hatchInfo');
    const btn   = document.getElementById('_hatchClose');
    if (eggEl) eggEl.style.display = 'none';
    if (pkEl)  pkEl.classList.add('visible');
    if (info)  info.style.opacity  = '1';
    if (btn)   { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; }
    SFX.play?.('unlock');
  }, 3000);

  document.getElementById('_hatchClose').addEventListener('click', () => {
    modal.remove();
    updateTopBar();
    renderPCTab();
  });
}

function renderEggsView(container) {
  const eggs = state.eggs || [];
  const incubatorCount = state.inventory?.incubator || 0;
  const incubatingCount = eggs.filter(e => e.incubating && e.status !== 'ready').length;
  const freeIncubators = incubatorCount - incubatingCount;

  if (eggs.length === 0) {
    container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-dim);font-family:var(--font-pixel);font-size:10px">Aucun oeuf pour le moment.<br><br>Utilise la <b style="color:var(--text)">Pension</b> ou achète un <b style="color:var(--text)">Oeuf Mystère</b> au Marché.</div>`;
    return;
  }

  const now = Date.now();
  container.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:12px;padding:8px">
      ${eggs.map(egg => {
        const isReady = egg.status === 'ready' || (egg.incubating && egg.hatchAt && egg.hatchAt <= now);
        const isIncubating = egg.incubating && !isReady;
        const timeLeft = isIncubating && egg.hatchAt ? Math.max(0, Math.ceil((egg.hatchAt - now) / 60000)) : null;
        const progress = isIncubating && egg.hatchAt && egg.incubatedAt
          ? Math.min(100, Math.round((now - egg.incubatedAt) / (egg.hatchAt - egg.incubatedAt) * 100))
          : 0;

        // Parents info
        let parentHtml = '';
        if (egg.parentA && egg.parentB) {
          const pA = state.pokemons.find(p => p.id === egg.parentA) || { species_en: egg.parentASpecies };
          const pB = state.pokemons.find(p => p.id === egg.parentB) || { species_en: egg.parentBSpecies };
          const pAName = pA?.species_en ? speciesName(pA.species_en) : '?';
          const pBName = pB?.species_en ? speciesName(pB.species_en) : '?';
          const pALvl = pA?.level ? ` Lv.${pA.level}` : '';
          const pBLvl = pB?.level ? ` Lv.${pB.level}` : '';
          const pAPot = pA?.potential ? ' ' + '★'.repeat(pA.potential) : '';
          const pBPot = pB?.potential ? ' ' + '★'.repeat(pB.potential) : '';
          parentHtml = `<div style="display:flex;flex-direction:column;gap:3px;margin-top:4px;align-items:center">
            <div style="display:flex;align-items:center;gap:4px">
              ${pA?.species_en ? `<img src="${pokeSprite(pA.species_en)}" style="width:22px;height:22px" title="${pAName}${pALvl}${pAPot}">` : ''}
              <span style="font-size:9px;color:var(--red)">♥</span>
              ${pB?.species_en ? `<img src="${pokeSprite(pB.species_en)}" style="width:22px;height:22px" title="${pBName}${pBLvl}${pBPot}">` : ''}
            </div>
            <div style="font-size:7px;color:var(--text-dim);text-align:center">${pAName}${pAPot} × ${pBName}${pBPot}</div>
          </div>`;
        } else if (egg.source) {
          parentHtml = `<div style="font-size:8px;color:var(--text-dim);margin-top:4px">${egg.source}</div>`;
        } else {
          parentHtml = `<div style="font-size:8px;color:var(--text-dim);margin-top:4px">Mystère</div>`;
        }

        const statusColor = isReady ? 'var(--green)' : isIncubating ? 'var(--gold)' : 'var(--text-dim)';
        const statusText = isReady
          ? '✅ Prêt à éclore !'
          : isIncubating ? `🥚 ${timeLeft}min restantes`
          : '⏳ En attente d\'incubateur';

        return `<div style="background:var(--bg-card);border:1px solid ${isReady ? 'var(--green)' : 'var(--border)'};border-radius:var(--radius);padding:10px;min-width:130px;max-width:150px;display:flex;flex-direction:column;align-items:center;gap:6px;${isReady ? 'box-shadow:0 0 8px rgba(68,187,85,.3)' : ''}">
          ${eggImgTag(egg, isReady, `width:64px;height:64px;${isReady ? 'filter:drop-shadow(0 0 6px var(--green))' : ''}`)}
          ${parentHtml}
          <div style="font-size:8px;color:${statusColor};text-align:center;font-family:var(--font-pixel);line-height:1.4">${statusText}</div>
          ${isIncubating && !isReady ? `
            <div style="width:100%;height:4px;background:var(--bg);border-radius:2px;overflow:hidden">
              <div style="height:100%;width:${progress}%;background:var(--gold);transition:width .5s"></div>
            </div>` : ''}
          <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center">
            ${isReady ? `<button class="egg-hatch-btn" data-egg-id="${egg.id}" style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--green);border:none;border-radius:var(--radius-sm);color:#000;cursor:pointer">Éclore !</button>` : ''}
            ${!isIncubating && freeIncubators > 0 ? `<button class="egg-incubate-btn" data-egg-id="${egg.id}" style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Incuber</button>` : ''}
            ${!isIncubating && incubatorCount > 0 && freeIncubators === 0 ? `<span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">Incubateurs pleins</span>` : ''}
            ${!isIncubating && incubatorCount === 0 ? `<span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">Aucun incubateur</span>` : ''}
            <button class="egg-sell-btn" data-egg-id="${egg.id}" style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Vendre</button>
            ${!egg.scanned && (state.inventory?.egg_scanner || 0) > 0
              ? `<button class="egg-scan-btn" data-egg-id="${egg.id}" style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--bg);border:1px solid #c05be0;border-radius:var(--radius-sm);color:#c05be0;cursor:pointer">🔬 Scanner</button>`
              : ''}
            ${egg.scanned && egg.revealedSpecies
              ? `<div style="font-size:8px;color:#c05be0;text-align:center;font-family:var(--font-pixel)">🔬 ${speciesName(egg.revealedSpecies)}</div>`
              : egg.scanned && !egg.revealedSpecies
              ? `<div style="font-size:8px;color:#666;text-align:center">🔬 Inconnu…</div>`
              : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;

  // Bind buttons
  container.querySelectorAll('.egg-hatch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const egg = state.eggs.find(e => e.id === btn.dataset.eggId);
      if (egg) hatchEgg(egg.id);
      renderPCTab();
    });
  });
  container.querySelectorAll('.egg-incubate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const egg = state.eggs.find(e => e.id === btn.dataset.eggId);
      if (!egg) return;
      egg.incubating = true;
      egg.incubatedAt = Date.now();
      egg.hatchAt = Date.now() + (egg.hatchMs || 2700000); // 45min default
      saveState();
      renderPCTab();
      notify('Oeuf mis en incubation !', 'success');
    });
  });
  container.querySelectorAll('.egg-sell-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const egg = state.eggs.find(e => e.id === btn.dataset.eggId);
      if (!egg) return;
      const price = egg.sellPrice || 500;
      showConfirm(
        `Vendre cet oeuf pour <strong style="color:var(--gold)">${price.toLocaleString()}₽</strong> ?<br><span style="color:var(--text-dim);font-size:11px">Tu ne sauras jamais quel Pokémon était dedans.</span>`,
        () => {
          state.eggs = state.eggs.filter(e => e.id !== egg.id);
          state.gang.money += price;
          saveState();
          renderPCTab();
          notify(`Oeuf vendu — ${price}₽`, 'gold');
        },
        null,
        { confirmLabel: 'Vendre', cancelLabel: 'Garder', danger: true }
      );
    });
  });
  container.querySelectorAll('.egg-scan-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const egg = state.eggs.find(e => e.id === btn.dataset.eggId);
      if (!egg || egg.scanned) return;
      if ((state.inventory.egg_scanner || 0) < 1) { notify('Aucun Scanneur d\'Oeuf disponible.', 'error'); return; }
      // Roll d100: 1-89 = reveal (scanner survives), 90-99 = scanner détruit, 100 = oeuf détruit
      const roll = Math.random() * 100;
      if (roll < 89) {
        egg.revealedSpecies = egg.species_en;
        egg.scanned = true;
        notify(`🔬 Scan réussi ! C'est un ${speciesName(egg.species_en)} !`, 'gold');
      } else if (roll < 99) {
        state.inventory.egg_scanner--;
        egg.scanned = true;
        egg.revealedSpecies = null;
        notify('🔬 Scanneur détruit dans l\'opération… Espèce inconnue.', 'error');
      } else {
        state.inventory.egg_scanner--;
        const idx = state.eggs.indexOf(egg);
        if (idx !== -1) state.eggs.splice(idx, 1);
        notify('💥 L\'oeuf a été détruit par le scan défectueux !', 'error');
        saveState();
        const eggsEl = document.getElementById('eggsInPC');
        if (eggsEl) renderEggsView(eggsEl);
        return;
      }
      saveState();
      const eggsEl = document.getElementById('eggsInPC');
      if (eggsEl) renderEggsView(eggsEl);
    });
  });
}

// ── PC grid helpers ──────────────────────────────────────────────────────────

function _buildPCCard(p, teamIds, trainingIds, pensionIds) {
  const inTeam = teamIds.has(p.id);
  const inTraining = trainingIds.has(p.id);
  const inPension = pensionIds ? pensionIds.has(p.id) : false;
  return `<div class="pc-pokemon ${p.shiny ? 'shiny' : ''} ${pcSelectedId === p.id ? 'selected' : ''} ${pcSelectedIds.has(p.id) ? 'multi-selected' : ''} ${inTeam ? 'in-team' : ''} ${inTraining ? 'in-training' : ''}" data-pk-id="${p.id}" title="${speciesName(p.species_en)} Lv.${p.level} ${'★'.repeat(p.potential)}${p.shiny ? ' ✨' : ''}${inTraining ? ' [ENTRAINEMENT]' : ''}${inPension ? ' [PENSION]' : ''}">
    <img src="${pokeSprite(p.species_en, p.shiny)}" alt="${speciesName(p.species_en)}">
    ${p.favorite ? '<div class="pc-fav-badge">FAV</div>' : ''}
    ${inTeam ? '<div class="pc-team-badge">EQ</div>' : ''}
    ${inTraining ? '<div class="pc-training-badge">TR</div>' : ''}
    ${inPension ? '<div class="pc-pension-badge">PS</div>' : ''}
  </div>`;
}

function _bindPCCardListeners(el) {
  el.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click : basculer la multi-sélection sans rebuild complet
      const id = el.dataset.pkId;
      if (pcSelectedIds.has(id)) {
        pcSelectedIds.delete(id);
        el.classList.remove('multi-selected');
      } else {
        pcSelectedIds.add(id);
        el.classList.add('multi-selected');
      }
      renderPokemonDetail();
    } else {
      // Clic normal : effacer la multi-sélection, sélectionner ce Pokémon
      if (pcSelectedIds.size > 0) {
        pcSelectedIds.clear();
        document.querySelectorAll('.pc-pokemon.multi-selected').forEach(c => c.classList.remove('multi-selected'));
      }
      pcSelectedId = el.dataset.pkId;
      renderPCTab();
    }
  });
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const pId = el.dataset.pkId;
    const pk = state.pokemons.find(p => p.id === pId);
    if (!pk) return;
    const price = calculatePrice(pk);
    const inTeam = state.gang.bossTeam.includes(pk.id) || state.agents.some(a => a.team.includes(pk.id));
    const hasCandy = (state.inventory.rarecandy || 0) > 0;
    const sameSpecies = state.pokemons.filter(p => p.species_en === pk.species_en && p.id !== pk.id && !p.shiny);
    const sameSpeciesTotal = calculatePrice(pk) * sameSpecies.length;
    const has5StarDonor = state.pokemons.some(p =>
      p.species_en === pk.species_en && p.id !== pk.id && p.potential === 5 && !p.shiny
      && !state.gang.bossTeam.includes(p.id) && !state.agents.some(a => a.team.includes(p.id))
    );
    const items = [
      { action:'sell', label:`Vendre (${price}₽)${pk.shiny ? ' ✨' : ''}`, fn: () => {
        if (pk.shiny) {
          showConfirm(`<span style="color:gold">✨ CHROMATIQUE !</span><br>Vendre <b>${speciesName(pk.species_en)}</b> pour <b>${price.toLocaleString()}₽</b> ?<br><span style="color:var(--text-dim);font-size:11px">Cette action est irréversible.</span>`,
            () => { sellPokemon([pk.id]); renderPCTab(); updateTopBar(); },
            null, { confirmLabel: 'Vendre', cancelLabel: 'Garder', danger: true });
        } else { sellPokemon([pk.id]); renderPCTab(); updateTopBar(); }
      }},
      sameSpecies.length > 0 ? { action:'sellSpecies', label:`Vendre tout (${speciesName(pk.species_en)}) ×${sameSpecies.length} — ${sameSpeciesTotal.toLocaleString()}₽`, fn: () => {
        showConfirm(`Vendre <b>${sameSpecies.length}× ${speciesName(pk.species_en)}</b> pour <b>${sameSpeciesTotal.toLocaleString()}₽</b> ?<br><span style="color:var(--text-dim);font-size:11px">Shinies exclus.</span>`,
          () => { sellPokemon(sameSpecies.map(p => p.id)); renderPCTab(); updateTopBar(); },
          null, { confirmLabel: 'Vendre tout', cancelLabel: 'Annuler', danger: true });
      }} : null,
      sameSpecies.filter(p => p.potential < 5).length > 0 ? { action:'sellSpeciesNon5', label:`Vendre ${speciesName(pk.species_en)} (sauf ★★★★★)`, fn: () => {
        const toSell = sameSpecies.filter(p => p.potential < 5);
        const total = toSell.reduce((s, p) => s + calculatePrice(p), 0);
        showConfirm(`Vendre <b>${toSell.length}× ${speciesName(pk.species_en)}</b> (hors ★★★★★) pour <b>${total.toLocaleString()}₽</b> ?`,
          () => { sellPokemon(toSell.map(p => p.id)); renderPCTab(); updateTopBar(); },
          null, { confirmLabel: 'Vendre', cancelLabel: 'Annuler', danger: true });
      }} : null,
      state.purchases.scientist && pk.potential < 5 && has5StarDonor ? { action:'scientist', label:`🧬 Mutation (sacrifice 1× ★★★★★ ${speciesName(pk.species_en)})`, fn: () => {
        const donor = state.pokemons.find(p =>
          p.species_en === pk.species_en && p.id !== pk.id && p.potential === 5 && !p.shiny
          && !state.gang.bossTeam.includes(p.id) && !state.agents.some(a => a.team.includes(p.id))
        );
        if (!donor) { notify('Aucun donneur ★★★★★ disponible.', 'error'); return; }
        showConfirm(`Sacrifier <b>${speciesName(donor.species_en)} ★★★★★</b> pour élever <b>${speciesName(pk.species_en)}</b> de ★${pk.potential} à ★${pk.potential + 1} ?<br><span style="color:var(--red);font-size:11px">Le donneur sera détruit.</span>`,
          () => {
            state.pokemons = state.pokemons.filter(p => p.id !== donor.id);
            pk.potential = Math.min(5, pk.potential + 1);
            pk.stats = calculateStats(pk);
            saveState(); notify(`🧬 ${speciesName(pk.species_en)} est maintenant ${'★'.repeat(pk.potential)} !`, 'gold');
            renderPCTab(); updateTopBar();
          },
          null, { confirmLabel: 'Confirmer', cancelLabel: 'Annuler', danger: true });
      }} : null,
      inTeam
        ? { action:'unteam', label:'Retirer de l\'equipe', fn: () => { state.gang.bossTeam = state.gang.bossTeam.filter(id => id !== pk.id); state.agents.forEach(a => { a.team = a.team.filter(id => id !== pk.id); }); saveState(); renderPCTab(); } }
        : { action:'team', label:'Attribuer a...', fn: () => { openAssignToPicker(pk.id); } },
      { action:'candy', label:`Super Bonbon${hasCandy ? '' : ' (aucun)'}`, fn: () => { if (!hasCandy) return; state.inventory.rarecandy--; if (pk.level < 100) { pk.level++; pk.xp = 0; pk.stats = calculateStats(pk); tryAutoEvolution(pk); } saveState(); notify(`🍬 ${speciesName(pk.species_en)} → Lv.${pk.level}`, 'gold'); renderPCTab(); updateTopBar(); } },
      { action:'fav', label: pk.favorite ? 'Retirer favori' : 'Ajouter favori', fn: () => { pk.favorite = !pk.favorite; saveState(); renderPCTab(); } },
    ].filter(Boolean);
    showContextMenu(e.clientX, e.clientY, items);
  });
}

function renderPokemonGrid(forceRebuild = false) {
  const grid = document.getElementById('pokemonGrid');
  if (!grid) return;

  let list = [...state.pokemons];

  // Search filter
  const search = document.getElementById('pcSearch')?.value?.toLowerCase() || '';
  if (search) list = list.filter(p => speciesName(p.species_en).toLowerCase().includes(search) || p.species_en.includes(search));

  // Filter
  const filter = document.getElementById('pcFilter')?.value || 'all';
  if (filter === 'shiny') list = list.filter(p => p.shiny);
  else if (filter === 'fav') list = list.filter(p => p.favorite);
  else if (filter === 'team') {
    const tIds = new Set([...state.gang.bossTeam]);
    for (const a of state.agents) a.team.forEach(id => tIds.add(id));
    list = list.filter(p => tIds.has(p.id));
  }
  else if (filter.startsWith('pot')) list = list.filter(p => p.potential === parseInt(filter.replace('pot', '')));
  else if (filter === 'pension') {
    const psIds = getPensionSlotIds();
    list = list.filter(p => psIds.has(p.id));
  }
  else if (filter === 'training') list = list.filter(p => state.trainingRoom?.pokemon?.includes(p.id));

  // Sort
  const sort = document.getElementById('pcSort')?.value || 'recent';
  switch (sort) {
    case 'id':        list.sort((a, b) => a.dex - b.dex); break;
    case 'name':      list.sort((a, b) => speciesName(a.species_en).localeCompare(speciesName(b.species_en))); break;
    case 'cp':        list.sort((a, b) => getPokemonPower(b) - getPokemonPower(a)); break;
    case 'potential': list.sort((a, b) => (b.potential + (b.shiny ? 10 : 0)) - (a.potential + (a.shiny ? 10 : 0))); break;
    case 'level':     list.sort((a, b) => b.level - a.level); break;
    case 'species':   list.sort((a, b) => a.dex - b.dex || (b.potential - a.potential)); break;
    case 'price':     list.sort((a, b) => calculatePrice(b) - calculatePrice(a)); break;
    case 'recent':    break;
  }
  if (filter !== 'fav') list.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));

  const pageSize = pcGroupMode ? list.length : (pcGridCols * pcGridRows);
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  if (pcPage >= totalPages) pcPage = totalPages - 1;
  const pageList = list.slice(pcPage * pageSize, (pcPage + 1) * pageSize);

  const pagination = document.getElementById('pcPagination');
  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
  const trainingIds = new Set(state.trainingRoom.pokemon);
  const pensionIds = getPensionSlotIds();

  // Render key: rebuild on any change (list length catches sells/releases, species catches evolutions)
  const speciesHash = list.slice(pcPage * pageSize, (pcPage + 1) * pageSize).map(p => p.species_en + p.level).join(',').length;
  const renderKey = `${search}|${filter}|${sort}|${pcPage}|${totalPages}|${list.length}|${speciesHash}|${pcGroupMode}|${pcGridCols}|${pcGroupSpecies}`;
  const needsRebuild = forceRebuild || renderKey !== _pcLastRenderKey;

  if (needsRebuild) {
    _pcLastRenderKey = renderKey;

    // Apply dynamic grid columns
    grid.style.gridTemplateColumns = `repeat(${pcGridCols}, 1fr)`;

    // Pagination (hidden in group mode)
    if (pagination) {
      pagination.innerHTML = (pcGroupMode || totalPages <= 1) ? '' :
        `<button class="pc-page-btn" id="pcPrev" ${pcPage === 0 ? 'disabled' : ''}>&lt;</button>
         <span style="font-size:9px;color:var(--text-dim)">${pcPage + 1} / ${totalPages} (${list.length})</span>
         <button class="pc-page-btn" id="pcNext" ${pcPage >= totalPages - 1 ? 'disabled' : ''}>&gt;</button>`;
      pagination.querySelector('#pcPrev')?.addEventListener('click', () => { pcPage--; renderPokemonGrid(true); });
      pagination.querySelector('#pcNext')?.addEventListener('click', () => { pcPage++; renderPokemonGrid(true); });
    }

    if (pcGroupMode) {
      // ── Mode regroupement : une carte par espèce ──────────────
      const groups = {};
      for (const p of list) {
        if (!groups[p.species_en]) groups[p.species_en] = [];
        groups[p.species_en].push(p);
      }
      const sortedGroups = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
      grid.innerHTML = sortedGroups.map(([species, pks]) => {
        const maxPot = Math.max(...pks.map(p => p.potential));
        const maxLvl = Math.max(...pks.map(p => p.level));
        const hasShiny = pks.some(p => p.shiny);
        const hasFav   = pks.some(p => p.favorite);
        const isSelected = pcGroupSpecies === species;
        return `<div class="pc-group-card${isSelected ? ' selected' : ''}" data-group-species="${species}"
          style="position:relative;cursor:pointer;padding:4px 2px;border-radius:var(--radius-sm);
          border:2px solid ${isSelected ? 'var(--gold)' : 'var(--border)'};
          background:var(--bg-card);text-align:center;transition:border-color .15s;overflow:hidden">
          <img src="${pokeSprite(species, hasShiny)}" style="width:48px;height:48px;${hasShiny ? 'filter:drop-shadow(0 0 4px gold)' : ''}">
          <div style="font-size:7px;font-family:var(--font-pixel);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px">${speciesName(species)}</div>
          <div style="font-size:8px;color:var(--gold)">×${pks.length}</div>
          <div style="font-size:6px;color:var(--text-dim)">${'★'.repeat(maxPot)} Lv.${maxLvl}</div>
          ${hasFav  ? '<div style="position:absolute;top:2px;right:2px;font-size:9px;line-height:1">⭐</div>' : ''}
          ${hasShiny ? '<div style="position:absolute;top:2px;left:2px;font-size:9px;line-height:1">✨</div>' : ''}
        </div>`;
      }).join('') || '<div style="color:var(--text-dim);padding:16px;grid-column:1/-1;text-align:center">Aucun Pokémon</div>';

      grid.querySelectorAll('.pc-group-card').forEach(el => {
        el.addEventListener('click', () => {
          pcGroupSpecies = el.dataset.groupSpecies;
          _grpPotFilter = 0; // reset potential filter on species change
          renderPokemonGrid(true);
          renderPokemonDetailGroup(pcGroupSpecies);
        });
      });

    } else {
      // ── Mode normal : une carte par Pokémon ───────────────────
      grid.innerHTML = pageList.map(p => _buildPCCard(p, teamIds, trainingIds, pensionIds)).join('')
        || '<div style="color:var(--text-dim);padding:16px;grid-column:1/-1;text-align:center">Aucun Pokémon</div>';
      grid.querySelectorAll('.pc-pokemon').forEach(el => _bindPCCardListeners(el));
    }

  } else {
    // Soft update: append new cards, sync classes — no full rebuild
    if (!pcGroupMode) {
      const existingIds = new Set([...grid.querySelectorAll('.pc-pokemon')].map(el => el.dataset.pkId));
      let added = 0;
      for (const p of pageList) {
        if (!existingIds.has(p.id)) {
          const wrap = document.createElement('div');
          wrap.innerHTML = _buildPCCard(p, teamIds, trainingIds, pensionIds);
          const card = wrap.firstElementChild;
          if (card) { grid.appendChild(card); _bindPCCardListeners(card); added++; }
        }
      }
      grid.querySelectorAll('.pc-pokemon').forEach(el => {
        el.classList.toggle('selected', el.dataset.pkId === pcSelectedId);
        el.classList.toggle('multi-selected', pcSelectedIds.has(el.dataset.pkId));
      });
      if (added > 0 && pagination) {
        const countEl = pagination.querySelector('span');
        if (countEl) countEl.textContent = `${pcPage + 1} / ${totalPages} (${list.length})`;
      }
    }
  }
}

function renderPotentialUpgradePanel(p) {
  if (p.potential >= 5) return '';
  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
  const cost = POT_UPGRADE_COSTS[p.potential - 1];
  const donors = state.pokemons.filter(d =>
    d.species_en === p.species_en && d.id !== p.id &&
    !d.shiny && d.potential <= p.potential &&
    !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id)
  );
  const canUpgrade = donors.length >= cost;
  return `<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
    <div style="font-size:9px;color:var(--text-dim);margin-bottom:6px">MUTATION DE POTENTIEL</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <div style="font-size:10px;flex:1">
        ${'*'.repeat(p.potential)} <span style="color:var(--text-dim)">→</span> ${'*'.repeat(p.potential + 1)}
        <span style="font-size:9px;color:${canUpgrade ? 'var(--green)' : 'var(--red)'}"> (${donors.length}/${cost} specimens)</span>
      </div>
    </div>
    <button id="btnPotUpgrade" style="width:100%;font-size:9px;padding:5px;background:var(--bg);border:1px solid ${canUpgrade ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);color:${canUpgrade ? 'var(--gold)' : 'var(--text-dim)'};cursor:${canUpgrade ? 'pointer' : 'default'}"${canUpgrade ? '' : ' disabled'}>
      ${canUpgrade ? 'MUTER LE POTENTIEL' : 'Pas assez de specimens'}
    </button>
  </div>`;
}

function renderEvolutionPanel(p) {
  const evos = EVO_BY_SPECIES[p.species_en];
  if (!evos || evos.length === 0) return '';

  const hasStone      = (state.inventory.evostone || 0) > 0;
  const itemEvos      = evos.filter(e => e.req === 'item');
  const levelEvos     = evos.filter(e => e.req !== 'item' && typeof e.req === 'number');
  const readyLvlEvos  = levelEvos.filter(e => p.level >= e.req);
  const multiItem     = itemEvos.length > 1;
  const multiLevel    = readyLvlEvos.length > 1;

  let html = '<div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--border)">';
  html += '<div style="font-size:10px;color:var(--text-dim);margin-bottom:6px">' + (state.lang === 'fr' ? 'Évolution' : 'Evolution') + '</div>';

  for (const evo of evos) {
    const targetSp = SPECIES_BY_EN[evo.to];
    if (!targetSp) continue;
    const targetName = state.lang === 'fr' ? targetSp.fr : evo.to;

    if (evo.req === 'item') {
      html += '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">'
        + '<img src="' + pokeSprite(evo.to) + '" style="width:32px;height:32px;opacity:' + (hasStone ? 1 : 0.4) + '">'
        + '<div style="flex:1;font-size:10px">' + targetName + '</div>';
      if (!multiItem) {
        // Single item evo → direct button
        html += '<button class="btn-evolve-item" data-evo-target="' + evo.to + '" style="font-size:9px;padding:4px 10px;background:' + (hasStone ? 'var(--gold-dim)' : 'var(--bg)') + ';border:1px solid ' + (hasStone ? 'var(--gold)' : 'var(--border)') + ';border-radius:var(--radius-sm);color:' + (hasStone ? 'var(--bg)' : 'var(--text-dim)') + ';cursor:' + (hasStone ? 'pointer' : 'default') + '"' + (hasStone ? '' : ' disabled') + '>💎 Évoluer</button>';
      }
      html += '</div>';
    } else {
      const ready = p.level >= evo.req;
      html += '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">'
        + '<img src="' + pokeSprite(evo.to) + '" style="width:32px;height:32px;opacity:' + (ready ? 1 : 0.4) + '">'
        + '<div style="flex:1;font-size:10px">' + targetName + ' (Lv.' + evo.req + ')</div>';
      if (ready && !multiLevel) {
        // Single ready level evo → direct button
        html += '<button class="btn-evolve-level" data-evo-target="' + evo.to + '" style="font-size:9px;padding:4px 10px;background:var(--green);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--bg);cursor:pointer">Évoluer!</button>';
      } else if (!ready) {
        html += '<span style="font-size:9px;color:var(--text-dim)">Lv.' + p.level + '/' + evo.req + '</span>';
      }
      // If ready && multiLevel: individual button omitted — group button below
      html += '</div>';
    }
  }

  // Multi-choice group buttons (card popup)
  if (multiLevel) {
    html += '<button class="btn-evolve-level-multi" style="margin-top:10px;width:100%;font-family:var(--font-pixel);font-size:8px;padding:6px;background:var(--green);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--bg);cursor:pointer">🎴 Choisir l\'évolution (' + readyLvlEvos.length + ' options)</button>';
  }
  if (multiItem) {
    html += '<button class="btn-evolve-item-multi"' + (hasStone ? '' : ' disabled') + ' style="margin-top:6px;width:100%;font-family:var(--font-pixel);font-size:8px;padding:6px;background:' + (hasStone ? 'var(--gold-dim)' : 'var(--bg)') + ';border:1px solid ' + (hasStone ? 'var(--gold)' : 'var(--border)') + ';border-radius:var(--radius-sm);color:' + (hasStone ? 'var(--bg)' : 'var(--text-dim)') + ';cursor:' + (hasStone ? 'pointer' : 'default') + '">🎴 Choisir l\'évolution 💎 (' + itemEvos.length + ' options)</button>';
  }

  html += '</div>';
  return html;
}

// ── Évoluer un Pokémon jusqu'au stade maximum (level + item) ──
function _evolveToMax(pk) {
  let evolved = false;
  let sanity = 10;
  while (sanity-- > 0) {
    const evos = EVO_BY_SPECIES[pk.species_en];
    if (!evos || evos.length === 0) break;
    // Try level evolution first
    const levelEvo = evos.find(e => e.req !== 'item' && typeof e.req === 'number' && pk.level >= e.req);
    if (levelEvo) { evolvePokemon(pk, levelEvo.to); evolved = true; continue; }
    // Item evolution: consume a stone
    const itemEvo = evos.find(e => e.req === 'item');
    if (itemEvo && (state.inventory.evostone || 0) > 0) {
      state.inventory.evostone--;
      evolvePokemon(pk, itemEvo.to);
      evolved = true; continue;
    }
    break;
  }
  return evolved;
}

// ── Vente groupée: évoluer plusieurs Pokémon avec gestion des pierres ──
function _bulkEvolve(evolvable, stoneNeeded, stoneHave) {
  const doEvolve = () => {
    let count = 0;
    for (const pk of evolvable) { if (_evolveToMax(pk)) count++; }
    saveState();
    _pcLastRenderKey = ''; renderPCTab();
    notify(`${count} Pokémon évolué${count > 1 ? 's' : ''} !`, 'gold');
  };

  if (stoneNeeded === 0 || stoneHave >= stoneNeeded) {
    doEvolve();
    return;
  }

  // Not enough stones — show popup
  const shortage = stoneNeeded - stoneHave;
  const stoneCost = 5000; // price per stone from shop
  const buyCost = shortage * stoneCost;
  const canAfford = state.gang.money >= buyCost;

  showConfirm(
    `<b>Évoluer nécessite ${stoneNeeded} Pierre${stoneNeeded > 1 ? 's' : ''} Évolution</b><br>
     Vous en avez : <span style="color:var(--gold)">${stoneHave}</span> — il en manque <span style="color:var(--red)">${shortage}</span><br>
     ${canAfford
       ? `Acheter ${shortage} pierre${shortage > 1 ? 's' : ''} pour <span style="color:var(--gold)">${buyCost.toLocaleString()}₽</span> et évoluer ?`
       : `<span style="color:var(--text-dim)">Fonds insuffisants pour acheter ${shortage} pierre${shortage > 1 ? 's' : ''} (${buyCost.toLocaleString()}₽)</span>`}`,
    () => {
      if (canAfford) {
        state.gang.money -= buyCost;
        state.inventory.evostone = (state.inventory.evostone || 0) + shortage;
        updateTopBar();
      }
      doEvolve();
    },
    null,
    {
      confirmLabel: canAfford ? `Acheter (${buyCost.toLocaleString()}₽) + Évoluer` : 'Évoluer avec stock actuel',
      cancelLabel: 'Annuler',
      danger: !canAfford,
    }
  );
}

function renderPokemonDetail() {
  const panel = document.getElementById('pokemonDetail');
  if (!panel) return;

  // ── Mode groupe ───────────────────────────────────────────────
  if (pcGroupMode && pcGroupSpecies) {
    renderPokemonDetailGroup(pcGroupSpecies);
    return;
  }

  // ── Multi-sélection ───────────────────────────────────────────
  if (pcSelectedIds.size > 1) {
    panel.classList.remove('hidden');
    const pks = [...pcSelectedIds].map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
    const tIds = new Set([...state.gang.bossTeam]);
    for (const a of state.agents) a.team.forEach(id => tIds.add(id));
    // Shinies excluded from group sell by default — must sell from individual sheet
    const sellable = pks.filter(pk => !pk.favorite && !pk.shiny && !tIds.has(pk.id));
    const totalValue = sellable.reduce((s, pk) => s + calculatePrice(pk), 0);
    const shinyCount = pks.filter(pk => pk.shiny).length;
    const favCount   = pks.filter(pk => pk.favorite).length;
    const allFav     = pks.every(pk => pk.favorite);

    // Evolvable Pokémon analysis
    const evolvable = pks.filter(pk => {
      const evos = EVO_BY_SPECIES[pk.species_en];
      return evos && evos.length > 0;
    });
    const itemEvolvable = evolvable.filter(pk =>
      (EVO_BY_SPECIES[pk.species_en] || []).some(e => e.req === 'item')
    );
    const stoneNeeded = itemEvolvable.length;
    const stoneHave   = state.inventory.evostone || 0;

    panel.innerHTML = `
      <div style="padding:10px;font-family:var(--font-pixel)">
        <div style="font-size:11px;color:var(--gold);margin-bottom:4px">${pks.length} sélectionnés</div>
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:8px">Ctrl+Clic pour ajouter/retirer</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px;justify-content:center;margin-bottom:10px">
          ${pks.slice(0, 15).map(pk => `<img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:28px;height:28px;${pk.shiny ? 'filter:drop-shadow(0 0 3px gold)' : ''}">`).join('')}
          ${pks.length > 15 ? `<div style="font-size:9px;color:var(--text-dim);align-self:center">+${pks.length - 15}</div>` : ''}
        </div>

        <div style="display:flex;flex-direction:column;gap:5px">

          <!-- Favoris -->
          <button id="btnMultiFav" style="width:100%;font-size:9px;padding:6px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">
            ${allFav ? '☆ Retirer favori (tous)' : `⭐ Marquer favori (${pks.length - favCount} sans fav)`}
          </button>

          <!-- Évoluer -->
          ${evolvable.length > 0 ? `
          <button id="btnMultiEvolve" style="width:100%;font-size:9px;padding:6px;background:var(--bg);border:1px solid var(--green,#4caf50);border-radius:var(--radius-sm);color:var(--green,#4caf50);cursor:pointer">
            ✦ Évoluer (${evolvable.length}) ${stoneNeeded > 0 ? `— 💎×${stoneNeeded}` : ''}
          </button>` : ''}

          <!-- Vente groupée -->
          ${sellable.length > 0 ? `
          <div style="font-size:8px;color:var(--text-dim);margin-top:4px">
            ${sellable.length} vendables — <span style="color:var(--gold)">${totalValue.toLocaleString()}₽</span>
            ${shinyCount > 0 ? `<br><span style="color:var(--gold)">✨×${shinyCount} exclu${shinyCount > 1 ? 's' : ''}</span>` : ''}
          </div>
          <button id="btnSellMulti" style="width:100%;font-size:9px;padding:6px;background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer">
            Vendre ${sellable.length} Pokémon (${totalValue.toLocaleString()}₽)
          </button>` : (shinyCount > 0 ? `<div style="font-size:8px;color:var(--text-dim);margin-top:4px">✨ Chromatiques non vendables ici</div>` : '')}

          <!-- Annuler -->
          <button id="btnClearMulti" style="width:100%;font-size:9px;padding:5px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
            Annuler la sélection
          </button>
        </div>
      </div>`;

    // Favourite toggle
    document.getElementById('btnMultiFav')?.addEventListener('click', () => {
      const newFav = !allFav;
      pks.forEach(pk => { pk.favorite = newFav; });
      saveState();
      _pcLastRenderKey = ''; renderPCTab();
    });

    // Bulk evolve
    document.getElementById('btnMultiEvolve')?.addEventListener('click', () => {
      _bulkEvolve(evolvable, stoneNeeded, stoneHave);
    });

    // Sell
    document.getElementById('btnSellMulti')?.addEventListener('click', () => {
      const ids = sellable.map(pk => pk.id);
      showConfirm(`Vendre <b>${ids.length}</b> Pokémon pour <b style="color:var(--gold)">${totalValue.toLocaleString()}₽</b> ?`, () => {
        sellPokemon(ids);
        pcSelectedIds.clear();
        _pcLastRenderKey = '';
        updateTopBar(); renderPCTab();
      }, null, { confirmLabel: 'Vendre', cancelLabel: 'Annuler', danger: true });
    });

    document.getElementById('btnClearMulti')?.addEventListener('click', () => {
      pcSelectedIds.clear();
      document.querySelectorAll('.pc-pokemon.multi-selected').forEach(c => c.classList.remove('multi-selected'));
      renderPokemonDetail();
    });
    return;
  }

  if (!pcSelectedId) {
    panel.classList.add('hidden');
    return;
  }

  const p = state.pokemons.find(pk => pk.id === pcSelectedId);
  if (!p) {
    panel.classList.add('hidden');
    pcSelectedId = null;
    return;
  }

  panel.classList.remove('hidden');
  const sp = SPECIES_BY_EN[p.species_en];
  const nat = NATURES[p.nature];
  const natName = nat ? (state.lang === 'fr' ? nat.fr : nat.en) : p.nature;
  const zoneDef = ZONE_BY_ID[p.capturedIn];
  const zoneName = zoneDef ? (state.lang === 'fr' ? zoneDef.fr : zoneDef.en) : p.capturedIn;
  const power = getPokemonPower(p);
  const price = calculatePrice(p);

  panel.innerHTML = `
    <div style="text-align:center;margin-bottom:12px">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:96px;height:96px;${p.shiny ? 'filter:drop-shadow(0 0 6px var(--gold))' : ''}">
      <div style="font-family:var(--font-pixel);font-size:12px;margin-top:4px">${speciesName(p.species_en)}${p.shiny ? ' ✨' : ''}</div>
      <div style="font-size:10px;color:var(--text-dim)">#${String(p.dex).padStart(3, '0')} — ${sp?.types.map(typeFr).join('/') || '?'}</div>
      ${p.homesick ? '<div style="display:inline-block;margin-top:4px;padding:2px 8px;background:#1a100a;border:1px solid #8b4513;border-radius:3px;font-size:9px;color:#cd853f">🏠 Mal du pays (-25%)</div>' : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;margin-bottom:12px">
      <div>${t('level')}: <b>${p.level}</b></div>
      <div>${t('nature')}: <b>${natName}</b></div>
      <div>${t('potential')}: <b style="color:var(--gold)">${'★'.repeat(p.potential)}</b></div>
      <div>PC: <b>${power}</b></div>
    </div>
    <div style="font-size:11px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="color:var(--text-dim)">${t('moves')}:</span>
        <button id="btnChangeMoves" style="font-size:8px;padding:2px 7px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer" title="Changer les attaques (10 000₽)">🔄 10k₽</button>
      </div>
      ${p.moves.map(m => `<div style="padding:2px 0">▸ ${m}</div>`).join('')}
    </div>
    <div style="font-size:11px;margin-bottom:8px">
      ${(() => {
        const ref = { species_en: p.species_en, potential: 5, nature: 'hardy', level: p.level };
        ref.stats = calculateStats(ref);
        const pct = v => Math.min(100, Math.round(v / ref.stats[Object.keys(ref.stats)[0]] * 100));
        const bar = (val, max, color) => `<div style="flex:1;background:var(--border);border-radius:2px;height:5px"><div style="background:${color};width:${Math.min(100,Math.round(val/max*100))}%;height:5px;border-radius:2px"></div></div>`;
        return `<div style="display:flex;flex-direction:column;gap:3px">
          <div style="display:flex;align-items:center;gap:6px"><span style="font-size:9px;width:30px">ATK</span>${bar(p.stats.atk, ref.stats.atk,'#e57373')}<span style="font-size:9px;color:var(--text-dim)">${p.stats.atk}<span style="color:var(--border-light)">/${ref.stats.atk}</span></span></div>
          <div style="display:flex;align-items:center;gap:6px"><span style="font-size:9px;width:30px">DEF</span>${bar(p.stats.def, ref.stats.def,'#64b5f6')}<span style="font-size:9px;color:var(--text-dim)">${p.stats.def}<span style="color:var(--border-light)">/${ref.stats.def}</span></span></div>
          <div style="display:flex;align-items:center;gap:6px"><span style="font-size:9px;width:30px">SPD</span>${bar(p.stats.spd, ref.stats.spd,'#81c784')}<span style="font-size:9px;color:var(--text-dim)">${p.stats.spd}<span style="color:var(--border-light)">/${ref.stats.spd}</span></span></div>
          <div style="font-size:7px;color:var(--text-dim);margin-top:1px">/ ref ★★★★★ Hardy Lv.${p.level}</div>
        </div>`;
      })()}
    </div>
    <div style="font-size:10px;color:var(--text-dim);margin-bottom:8px">${t('zone_caught')}: ${zoneName}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <div style="font-size:10px;color:var(--gold);flex:1">Valeur: ${price}₽${getMarketSaturation(p.species_en) > 0 ? ` <span style="color:var(--red);font-size:9px">▼${getMarketSaturation(p.species_en)}% offre</span>` : ''}</div>
      <button id="btnFavToggle" style="font-size:10px;padding:4px 10px;background:${p.favorite ? 'var(--gold-dim)' : 'var(--bg)'};border:1px solid ${p.favorite ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);color:${p.favorite ? 'var(--bg)' : 'var(--text-dim)'};cursor:pointer">${p.favorite ? '⭐ Favori' : '☆ Favori'}</button>
    </div>
    ${(() => {
      const hasCandy = (state.inventory.rarecandy || 0) > 0;
      return `<div style="margin-bottom:8px"><button id="btnRareCandy" style="width:100%;font-size:10px;padding:5px;background:${hasCandy ? 'var(--bg)' : 'var(--bg)'};border:1px solid ${hasCandy ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);color:${hasCandy ? 'var(--gold)' : 'var(--text-dim)'};cursor:${hasCandy ? 'pointer' : 'default'}"${hasCandy ? '' : ' disabled'}>🍬 Super Bonbon (+1 niveau) — stock: ${state.inventory.rarecandy || 0}</button></div>`;
    })()}
    ${(() => {
      // Check if in a team
      const inBossTeam = state.gang.bossTeam.includes(p.id);
      const inAgentTeam = state.agents.find(a => a.team.includes(p.id));
      const teamLabel = inBossTeam ? (state.lang === 'fr' ? 'Équipe Boss' : 'Boss Team')
        : inAgentTeam ? (state.lang === 'fr' ? 'Équipe ' + inAgentTeam.name : inAgentTeam.name + ' Team')
        : null;
      if (teamLabel) {
        return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer" id="btnRemoveFromTeam">🔓 ' + (state.lang === 'fr' ? 'Retirer de ' : 'Remove from ') + teamLabel + '</button></div>';
      }
      return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--green);cursor:pointer" id="btnAssignTo">📋 ' + (state.lang === 'fr' ? 'Attribuer à...' : 'Assign to...') + '</button></div>';
    })()}
    ${(() => {
      const pensionSlots = state.pension?.slots || [];
      const maxPensionSlots = 2 + (state.pension?.extraSlotsPurchased || 0);
      const inPension = pensionSlots.includes(p.id);
      const inTraining = state.trainingRoom?.pokemon?.includes(p.id);
      const inTeam = state.gang.bossTeam.includes(p.id) || state.agents.some(a => a.team.includes(p.id));
      if (inTeam) return '';
      const pensionFull = pensionSlots.length >= maxPensionSlots;
      const trainingFull = (state.trainingRoom?.pokemon?.length || 0) >= 6;
      let btns = '';
      if (!inPension && !inTraining) {
        btns += `<button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:${pensionFull ? 'var(--text-dim)' : 'var(--text)'};cursor:${pensionFull ? 'default' : 'pointer'}" id="btnSendPension"${pensionFull ? ' disabled' : ''}>Pension ${pensionFull ? '(pleine)' : ''}</button>`;
        btns += `<button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:${trainingFull ? 'var(--text-dim)' : 'var(--text)'};cursor:${trainingFull ? 'default' : 'pointer'}" id="btnSendTraining"${trainingFull ? ' disabled' : ''}>Formation ${trainingFull ? '(pleine)' : ''}</button>`;
      } else if (inPension) {
        btns += `<button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer" id="btnRemovePension">Retirer pension</button>`;
      } else if (inTraining) {
        btns += `<button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer" id="btnRemoveTraining">Retirer formation</button>`;
      }
      return btns ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${btns}</div>` : '';
    })()}
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button style="flex:1;font-size:10px;padding:6px;background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer" id="btnSellOne">${t('sell')} (${price}₽)</button>
      <button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer" id="btnRelease">${t('release')}</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
      <button id="btnRename" style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">✏ Renommer</button>
    </div>
    <div style="margin-top:8px">
      <button id="btnFilterSpecies" style="width:100%;font-size:9px;padding:5px;background:var(--bg);border:1px solid var(--blue);border-radius:var(--radius-sm);color:var(--blue);cursor:pointer;font-family:var(--font-pixel)">
        🔍 Voir tous les ${speciesName(p.species_en)} (×${state.pokemons.filter(x => x.species_en === p.species_en).length})
      </button>
    </div>
    ${renderEvolutionPanel(p)}
    ${renderPotentialUpgradePanel(p)}
    ${renderPokemonHistory(p)}
  `;

  document.getElementById('btnFavToggle')?.addEventListener('click', () => {
    p.favorite = !p.favorite;
    saveState();
    renderPCTab();
  });

  document.getElementById('btnChangeMoves')?.addEventListener('click', () => {
    const cost = 10000;
    if (state.gang.money < cost) { notify('Fonds insuffisants (10 000₽).', 'error'); return; }
    const sp2 = SPECIES_BY_EN[p.species_en];
    if (!sp2 || !sp2.moves?.length) { notify('Aucune attaque disponible pour cette espèce.', 'error'); return; }
    showConfirm(`Changer les attaques de <b>${speciesName(p.species_en)}</b> pour <b>10 000₽</b> ?<br><span style="color:var(--text-dim);font-size:10px">Les nouvelles attaques seront tirées aléatoirement dans le pool de l'espèce.</span>`,
      () => {
        state.gang.money -= cost;
        state.stats.totalMoneySpent = (state.stats.totalMoneySpent || 0) + cost;
        p.moves = rollMoves(p.species_en);
        saveState();
        notify(`Attaques changées → ${p.moves.join(', ')}`, 'gold');
        renderPCTab();
        updateTopBar();
      },
      null, { confirmLabel: 'Changer', cancelLabel: 'Annuler' }
    );
  });

  document.getElementById('btnRareCandy')?.addEventListener('click', () => {
    if ((state.inventory.rarecandy || 0) <= 0) return;
    state.inventory.rarecandy--;
    if (p.level < 100) { p.level++; p.xp = 0; p.stats = calculateStats(p); tryAutoEvolution(p); }
    saveState();
    notify(`🍬 ${speciesName(p.species_en)} → Lv.${p.level}`, 'gold');
    renderPCTab();
    updateTopBar();
  });

  document.getElementById('btnSellOne')?.addEventListener('click', () => {
    sellPokemon([p.id]);
    pcSelectedId = null;
    updateTopBar();
    renderPCTab();
  });
  document.getElementById('btnRelease')?.addEventListener('click', () => {
    // Unassign from agent
    for (const agent of state.agents) {
      agent.team = agent.team.filter(id => id !== p.id);
    }
    state.gang.bossTeam = state.gang.bossTeam.filter(id => id !== p.id);
    state.pokemons = state.pokemons.filter(pk => pk.id !== p.id);
    pcSelectedId = null;
    saveState();
    renderPCTab();
  });
  document.getElementById('btnAssignTo')?.addEventListener('click', () => {
    openAssignToPicker(p.id);
  });
  document.getElementById('btnRemoveFromTeam')?.addEventListener('click', () => {
    // Remove from all teams
    state.gang.bossTeam = state.gang.bossTeam.filter(id => id !== p.id);
    for (const agent of state.agents) {
      agent.team = agent.team.filter(id => id !== p.id);
    }
    saveState();
    renderPCTab();
    notify(state.lang === 'fr' ? 'Retiré de l\'équipe' : 'Removed from team', 'success');
  });

  document.getElementById('btnSendPension')?.addEventListener('click', () => {
    removePokemonFromAllAssignments(p.id);
    const maxSlots = 2 + (state.pension?.extraSlotsPurchased || 0);
    if ((state.pension.slots || []).length >= maxSlots) { notify('Pension pleine'); return; }
    if (!state.pension.slots.includes(p.id)) state.pension.slots.push(p.id);
    saveState();
    notify(`${speciesName(p.species_en)} → Pension`, 'success');
    renderPCTab();
  });
  document.getElementById('btnSendTraining')?.addEventListener('click', () => {
    removePokemonFromAllAssignments(p.id);
    if (!state.trainingRoom.pokemon) state.trainingRoom.pokemon = [];
    if (state.trainingRoom.pokemon.length >= 6) { notify('Salle pleine (max 6)'); return; }
    if (!state.trainingRoom.pokemon.includes(p.id)) state.trainingRoom.pokemon.push(p.id);
    saveState();
    notify(`${speciesName(p.species_en)} → Formation`, 'success');
    renderPCTab();
  });
  document.getElementById('btnRemovePension')?.addEventListener('click', () => {
    state.pension.slots = (state.pension.slots || []).filter(id => id !== p.id);
    saveState();
    notify(`${speciesName(p.species_en)} retiré de la pension`, 'success');
    renderPCTab();
  });
  document.getElementById('btnRemoveTraining')?.addEventListener('click', () => {
    state.trainingRoom.pokemon = state.trainingRoom.pokemon.filter(id => id !== p.id);
    saveState();
    notify(`${speciesName(p.species_en)} retiré de la formation`, 'success');
    renderPCTab();
  });

  document.getElementById('btnFilterSpecies')?.addEventListener('click', () => {
    filterPCBySpecies(p.species_en);
  });

  document.getElementById('btnRename')?.addEventListener('click', () => {
    openRenameModal(p.id);
  });

  // Potential upgrade button
  document.getElementById('btnPotUpgrade')?.addEventListener('click', () => {
    if (p.potential >= 5) return;
    const teamIds = new Set([...state.gang.bossTeam]);
    for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
    const cost = POT_UPGRADE_COSTS[p.potential - 1];
    const donors = state.pokemons.filter(d =>
      d.species_en === p.species_en && d.id !== p.id && !d.shiny &&
      !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id)
    );
    if (donors.length < cost) return;
    donors.slice(0, cost).forEach(d => {
      state.pokemons = state.pokemons.filter(pk => pk.id !== d.id);
    });
    p.potential++;
    p.stats = calculateStats(p);
    saveState();
    notify(`${speciesName(p.species_en)} est maintenant ${'*'.repeat(p.potential)} !`, 'gold');
    renderPCTab();
    updateTopBar();
  });

  // Evolution buttons
  // Single level evo
  panel.querySelectorAll('.btn-evolve-level').forEach(btn => {
    btn.addEventListener('click', () => {
      evolvePokemon(p, btn.dataset.evoTarget);
      _pcLastRenderKey = ''; renderPCTab();
    });
  });
  // Multi level evo → card popup
  panel.querySelector('.btn-evolve-level-multi')?.addEventListener('click', () => {
    const readyEvos = (EVO_BY_SPECIES[p.species_en] || []).filter(e => e.req !== 'item' && typeof e.req === 'number' && p.level >= e.req);
    if (!readyEvos.length) return;
    showEvolutionChoicePopup(p, readyEvos, targetEN => {
      evolvePokemon(p, targetEN);
      _pcLastRenderKey = ''; renderPCTab();
    });
  });
  // Single item evo
  panel.querySelectorAll('.btn-evolve-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if ((state.inventory.evostone || 0) <= 0) return;
      state.inventory.evostone--;
      evolvePokemon(p, btn.dataset.evoTarget);
      _pcLastRenderKey = ''; renderPCTab();
    });
  });
  // Multi item evo → card popup
  panel.querySelector('.btn-evolve-item-multi')?.addEventListener('click', () => {
    if ((state.inventory.evostone || 0) <= 0) return;
    const itemEvos = (EVO_BY_SPECIES[p.species_en] || []).filter(e => e.req === 'item');
    if (!itemEvos.length) return;
    showEvolutionChoicePopup(p, itemEvos, targetEN => {
      state.inventory.evostone--;
      evolvePokemon(p, targetEN);
      _pcLastRenderKey = ''; renderPCTab();
    });
  });
}

// ── Multi-evolution choice popup (face-down cards, random order) ──
// evos: array of { to, req } — the valid evolutions to choose from
// onChoose(targetEN): called after card flip animation with the chosen species_en
function showEvolutionChoicePopup(pokemon, evos, onChoose) {
  // Auto mode: skip popup, pick randomly
  if (state.settings?.autoEvoChoice) {
    onChoose(evos[Math.floor(Math.random() * evos.length)].to);
    return;
  }

  const shuffled = [...evos].sort(() => Math.random() - 0.5);
  const pkName = speciesName(pokemon.species_en);

  const overlay = document.createElement('div');
  overlay.className = 'evo-choice-overlay';
  overlay.innerHTML = `
    <div class="evo-choice-box">
      <div class="evo-choice-title">ÉVOLUTION — ${pkName.toUpperCase()}</div>
      <div class="evo-choice-sub">${shuffled.length} possibilités • Choisissez une carte</div>
      <div class="evo-choice-cards">
        ${shuffled.map((evo, i) => `
          <div class="evo-card-wrap" data-evo-idx="${i}">
            <div class="evo-card-inner">
              <div class="evo-card-face evo-card-back-face">🎴</div>
              <div class="evo-card-face evo-card-front-face">
                <img src="${pokeSprite(evo.to)}">
                <span>${speciesName(evo.to)}</span>
              </div>
            </div>
          </div>`).join('')}
      </div>
      <div class="evo-choice-hint">Cliquez une carte pour révéler • Échap pour annuler</div>
    </div>`;
  document.body.appendChild(overlay);

  let chosen = false;
  overlay.querySelectorAll('.evo-card-wrap').forEach((card, i) => {
    card.addEventListener('click', () => {
      if (chosen) return;
      chosen = true;
      overlay.querySelectorAll('.evo-card-wrap').forEach(c => c.classList.add('selected'));
      card.classList.add('flipped');
      setTimeout(() => { overlay.remove(); onChoose(shuffled[i].to); }, 650);
    });
  });
  overlay.addEventListener('click', e => { if (e.target === overlay && !chosen) overlay.remove(); });
  const escFn = e => { if (e.key === 'Escape' && !chosen) { overlay.remove(); document.removeEventListener('keydown', escFn); } };
  document.addEventListener('keydown', escFn);
}

function openRenameModal(pokemonId) {
  const p = state.pokemons.find(pk => pk.id === pokemonId);
  if (!p) return;
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:320px;width:90%;display:flex;flex-direction:column;gap:12px">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">RENOMMER</div>
      <div style="display:flex;align-items:center;gap:10px">
        <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:48px;height:48px;image-rendering:pixelated">
        <div>
          <div style="font-size:11px">${speciesName(p.species_en)}</div>
          <div style="font-size:9px;color:var(--text-dim)">Nom actuel : ${p.nick || speciesName(p.species_en)}</div>
        </div>
      </div>
      <input id="renameInput" type="text" maxlength="16" placeholder="${p.nick || speciesName(p.species_en)}" value="${p.nick || ''}"
        style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:8px 10px;font-size:12px;outline:none;width:100%;box-sizing:border-box">
      <div style="display:flex;gap:8px">
        <button id="renameClear" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Effacer surnom</button>
        <button id="renameConfirm" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Confirmer</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#renameInput').focus();
  modal.querySelector('#renameConfirm').addEventListener('click', () => {
    const val = modal.querySelector('#renameInput').value.trim();
    p.nick = val || null;
    saveState();
    notify(val ? `${speciesName(p.species_en)} renommé "${val}"` : 'Surnom effacé', 'success');
    modal.remove();
    _pcLastRenderKey = '';
    renderPokemonGrid(true);
  });
  modal.querySelector('#renameClear').addEventListener('click', () => {
    p.nick = null;
    saveState();
    notify('Surnom effacé', 'success');
    modal.remove();
    _pcLastRenderKey = '';
    renderPokemonGrid(true);
  });
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#renameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') modal.querySelector('#renameConfirm').click();
    if (e.key === 'Escape') modal.remove();
  });
}

// ── Vue détail en mode "Grouper" ─────────────────────────────
let _grpPotFilter = 0; // 0 = tous, 1-5 = filtre par potentiel

function renderPokemonDetailGroup(species) {
  const panel = document.getElementById('pokemonDetail');
  if (!panel) return;
  const allPks = state.pokemons.filter(p => p.species_en === species);
  if (!allPks.length) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  const sp = SPECIES_BY_EN[species];
  const tIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => tIds.add(id));

  // Potential filter
  const pks = _grpPotFilter ? allPks.filter(p => p.potential === _grpPotFilter) : allPks;
  // Shinies excluded from group sell — must go through individual sheet
  const sellable = pks.filter(p => !p.favorite && !p.shiny && !tIds.has(p.id));
  const totalValue = sellable.reduce((s, p) => s + calculatePrice(p), 0);
  const shinyCount = allPks.filter(p => p.shiny).length;
  const maxPot = Math.max(...allPks.map(p => p.potential));
  const maxLvl = Math.max(...allPks.map(p => p.level));
  const allFav  = pks.length > 0 && pks.every(p => p.favorite);
  const potsPresent = [...new Set(allPks.map(p => p.potential))].sort();

  panel.innerHTML = `
    <div style="text-align:center;margin-bottom:8px">
      <img src="${pokeSprite(species)}" style="width:64px;height:64px">
      <div style="font-family:var(--font-pixel);font-size:11px;margin-top:4px">${speciesName(species)}</div>
      <div style="font-size:9px;color:var(--text-dim)">#${String(sp?.dex||0).padStart(3,'0')} — ${(sp?.types||[]).join('/')}</div>
      <div style="font-size:9px;margin-top:2px">×${allPks.length} · Max Lv.${maxLvl} · ${'★'.repeat(maxPot)}</div>
    </div>

    <!-- Filtre potentiel -->
    ${potsPresent.length > 1 ? `
    <div style="display:flex;gap:3px;justify-content:center;margin-bottom:8px">
      <button class="grp-pot-btn${_grpPotFilter === 0 ? ' grp-pot-active' : ''}" data-pot="0"
        style="font-size:8px;padding:2px 6px;background:var(--bg);border:1px solid ${_grpPotFilter===0?'var(--gold)':'var(--border)'};border-radius:2px;color:${_grpPotFilter===0?'var(--gold)':'var(--text-dim)'};cursor:pointer">Tous</button>
      ${potsPresent.map(pot => `
        <button class="grp-pot-btn${_grpPotFilter === pot ? ' grp-pot-active' : ''}" data-pot="${pot}"
          style="font-size:8px;padding:2px 6px;background:var(--bg);border:1px solid ${_grpPotFilter===pot?'var(--gold)':'var(--border)'};border-radius:2px;color:${_grpPotFilter===pot?'var(--gold)':'var(--text-dim)'};cursor:pointer">
          ${'★'.repeat(pot)}</button>`).join('')}
    </div>` : ''}

    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px">
      <!-- Favoris groupés -->
      <button id="btnGroupFav" style="width:100%;font-family:var(--font-pixel);font-size:8px;padding:5px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">
        ${allFav ? `☆ Retirer favori (${pks.length})` : `⭐ Marquer favori (${pks.length - pks.filter(p=>p.favorite).length})`}
      </button>

      <!-- Vente groupée (shinies exclus) -->
      ${sellable.length > 0 ? `
      <div style="font-size:8px;color:var(--text-dim);text-align:center">${sellable.length} vendables — <span style="color:var(--gold)">${totalValue.toLocaleString()}₽</span>${shinyCount > 0 ? ` <span style="color:var(--gold)">· ✨×${shinyCount} exclu</span>` : ''}</div>
      <button id="btnGroupSellAll" style="width:100%;font-family:var(--font-pixel);font-size:8px;padding:5px;background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer">
        Vendre ${sellable.length} (${totalValue.toLocaleString()}₽)
      </button>` : (shinyCount > 0 ? `<div style="font-size:8px;color:var(--text-dim);text-align:center">✨ Chromatiques non vendables ici</div>` : '')}
    </div>

    <div style="display:flex;flex-direction:column;gap:3px;max-height:280px;overflow-y:auto">
      ${pks.sort((a,b) => b.potential - a.potential || b.level - a.level).map(p => {
        const inTeam = tIds.has(p.id);
        return `<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid ${p.shiny ? 'var(--gold-dim)' : inTeam ? 'rgba(76,175,80,.4)' : 'var(--border)'};border-radius:3px;background:var(--bg);font-size:9px">
          <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:24px;height:24px">
          <span style="flex:1">${p.shiny ? '✨ ' : ''}Lv.${p.level} ${'★'.repeat(p.potential)}</span>
          <span style="color:var(--text-dim);font-size:8px">${inTeam ? '👥' : p.favorite ? '⭐' : ''}</span>
          <button class="grp-detail-btn" data-pk-id="${p.id}" style="font-size:7px;padding:1px 5px;background:var(--bg);border:1px solid var(--border);border-radius:2px;color:var(--text-dim);cursor:pointer">→</button>
        </div>`;
      }).join('')}
    </div>`;

  // Potential filter buttons
  panel.querySelectorAll('.grp-pot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _grpPotFilter = parseInt(btn.dataset.pot);
      renderPokemonDetailGroup(species);
    });
  });

  // Favourite group toggle
  document.getElementById('btnGroupFav')?.addEventListener('click', () => {
    const newFav = !allFav;
    pks.forEach(p => { p.favorite = newFav; });
    saveState(); _pcLastRenderKey = ''; renderPCTab();
  });

  document.getElementById('btnGroupSellAll')?.addEventListener('click', () => {
    const ids = sellable.map(p => p.id);
    showConfirm(`Vendre <b>${ids.length}</b> ${speciesName(species)} pour <b style="color:var(--gold)">${totalValue.toLocaleString()}₽</b> ?`, () => {
      sellPokemon(ids); pcGroupSpecies = null; _grpPotFilter = 0;
      _pcLastRenderKey = ''; updateTopBar(); renderPCTab();
    }, null, { confirmLabel: 'Vendre', cancelLabel: 'Annuler', danger: true });
  });

  panel.querySelectorAll('.grp-detail-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pcGroupMode = false; pcGroupSpecies = null; _grpPotFilter = 0;
      const chk = document.getElementById('pcGroupChk');
      if (chk) chk.checked = false;
      pcSelectedId = btn.dataset.pkId;
      _pcLastRenderKey = ''; renderPCTab();
    });
  });
}

// ── Pokemon History ──────────────────────────────────────────
function renderPokemonHistory(pokemon) {
  if (!pokemon.history || pokemon.history.length === 0) return '';
  const entries = pokemon.history.slice(-10).reverse().map(h => {
    const date = new Date(h.ts);
    const timeStr = date.toLocaleTimeString(state.lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    switch (h.type) {
      case 'captured': {
        const zDef = ZONE_BY_ID[h.zone];
        const zName = zDef ? (state.lang === 'fr' ? zDef.fr : zDef.en) : h.zone;
        const ballName = BALLS[h.ball] ? (state.lang === 'fr' ? BALLS[h.ball].fr : BALLS[h.ball].en) : h.ball;
        return `<div class="history-entry">${timeStr} — ${state.lang === 'fr' ? 'Capturé' : 'Captured'} (${ballName}) @ ${zName}</div>`;
      }
      case 'combat':
        return `<div class="history-entry">${timeStr} — ${h.won ? (state.lang === 'fr' ? 'Combat gagné' : 'Won battle') : (state.lang === 'fr' ? 'Combat perdu' : 'Lost battle')}</div>`;
      case 'levelup':
        return `<div class="history-entry">${timeStr} — ${state.lang === 'fr' ? 'Niveau' : 'Level'} ${h.level}</div>`;
      case 'evolved':
        return `<div class="history-entry" style="color:var(--gold)">${timeStr} — ${h.from} → ${h.to} ✨</div>`;
      default:
        return `<div class="history-entry">${timeStr} — ${h.type}</div>`;
    }
  }).join('');
  return `<div class="pokemon-history">
    <div class="history-title">${state.lang === 'fr' ? '📜 Historique' : '📜 History'}</div>
    ${entries}
  </div>`;
}

// ════════════════════════════════════════════════════════════════
// 18.  UI — POKEDEX TAB
// ════════════════════════════════════════════════════════════════

let dexSelectedEn  = null;
let dexViewFilter  = 'kanto'; // 'kanto' | 'national' | 'shiny' | 'missing'

function getSpawnZones(species_en) {
  return ZONES
    .filter(z => z.pool && z.pool.includes(species_en))
    .map(z => ({ name: state.lang === 'fr' ? z.fr : z.en, rate: z.spawnRate, id: z.id }));
}

// ── Pokédex Assistant (Professeur Oak) ───────────────────────────────────────

const DEX_ASSISTANT_PRICES = {
  common:    100,
  uncommon:  300,
  rare:     1000,
  very_rare: 3000,
  legendary: 8000,
};

const DEX_ASSISTANT_TIPS = {
  legendary: [
    'Les légendaires sont extrêmement rares (≈1% par spawn). Installe plusieurs agents dans les zones concernées et sois patient.',
    'Un légendaire peut aussi apparaître pendant un raid de zone. Concentre tes forces !',
    'Active le mode "Rare Scope" depuis le marché pour forcer l\'apparition des espèces rares (légendaires exclus, mais ça libère de la place dans le pool).',
  ],
  very_rare: [
    'Cette espèce est très rare. Le "Rare Scope" du marché triple ses chances d\'apparition.',
    'Assigne plusieurs agents dans les zones indiquées pour multiplier les chances de rencontre.',
    'Un niveau de maîtrise élevé dans la zone augmente la fréquence des spawns globaux.',
  ],
  rare: [
    'Espèce rare — plusieurs sessions de farm seront nécessaires. Garde les Poké Balls prêtes !',
    'Le "Rare Scope" peut aider à filtrer les espèces communes et augmenter le taux des rares.',
    'En mode automatique, assigne un agent spécialisé en capture dans la zone la plus active.',
  ],
  uncommon: [
    'Espèce peu commune. Quelques heures de farm avec un agent en capture suffisent généralement.',
    'Privilégie la zone avec le meilleur spawnRate (affiché dans Zones de Spawn).',
    'Les coffres de zone peuvent parfois contenir des Pokémon de rareté peu commune.',
  ],
  common: [
    'Espèce commune — tu devrais en trouver rapidement, même sans agent assigné.',
    'Lance une capture manuelle depuis la zone ou laisse un agent s\'en occuper.',
    'Si tu en as besoin en shiny, active le Charme Chroma depuis le marché cosmétiques.',
  ],
};

function _getDexAssistantCostHtml(sp) {
  const price = DEX_ASSISTANT_PRICES[sp.rarity] ?? 500;
  const canAfford = state.gang.money >= price;
  return `<button id="dexAssistantBtn" style="
    width:100%;font-family:var(--font-pixel);font-size:8px;padding:7px 10px;
    background:rgba(255,204,90,.06);border:1px solid ${canAfford ? 'rgba(255,204,90,.4)' : 'var(--border)'};
    border-radius:var(--radius-sm);color:${canAfford ? 'var(--gold)' : 'var(--text-dim)'};
    cursor:${canAfford ? 'pointer' : 'default'};text-align:left;
    display:flex;align-items:center;justify-content:space-between;gap:6px
  ">
    <span>🎓 Conseil du Professeur</span>
    <span style="font-family:sans-serif;font-size:9px;color:${canAfford ? 'var(--gold-dim)' : '#444'}">${price.toLocaleString()}₽</span>
  </button>`;
}

function openDexAssistant(species_en) {
  const sp = SPECIES_BY_EN[species_en];
  if (!sp) return;

  const price = DEX_ASSISTANT_PRICES[sp.rarity] ?? 500;
  if (state.gang.money < price) {
    notify(`Fonds insuffisants — ${price.toLocaleString()}₽ requis.`, 'error');
    return;
  }

  const spawnZones = getSpawnZones(sp.en);
  const rarity     = sp.rarity ?? 'common';
  const rarityFR   = { common:'Commun', uncommon:'Peu commun', rare:'Rare', very_rare:'Très rare', legendary:'Légendaire' };
  const rarityCol  = { common:'#aaa', uncommon:'#5be06c', rare:'#5b9be0', very_rare:'#c05be0', legendary:'#ffcc5a' };

  // Pick 2 random tips for this rarity
  const pool = DEX_ASSISTANT_TIPS[rarity] ?? DEX_ASSISTANT_TIPS.common;
  const tips = pool.length <= 2 ? pool : [pool[Math.floor(Math.random() * pool.length)]];

  // Best zone by spawnRate
  const bestZone = spawnZones.sort((a, b) => b.rate - a.rate)[0];

  const zonesHtml = spawnZones.length
    ? spawnZones.map(z => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:9px">${z.name}</span>
          <span style="font-size:8px;color:var(--text-dim)">${(z.rate * 100).toFixed(1)}% / tick</span>
        </div>`).join('')
    : `<div style="font-size:9px;color:var(--text-dim)">Aucune zone connue pour cette espèce.</div>`;

  const tipsHtml = tips.map(tip =>
    `<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="color:var(--gold);font-size:12px;flex-shrink:0">💡</span>
      <span style="font-size:9px;color:var(--text);line-height:1.5">${tip}</span>
    </div>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:22px;max-width:440px;width:100%;max-height:88vh;overflow-y:auto;display:flex;flex-direction:column;gap:14px">

      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">🎓 Professeur Oak</div>
        <button id="btnDexAssistClose" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
      </div>

      <!-- En-tête Pokémon -->
      <div style="display:flex;align-items:center;gap:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px">
        <img src="${pokeSprite(sp.en, false)}" style="width:52px;height:52px;image-rendering:pixelated">
        <div>
          <div style="font-family:var(--font-pixel);font-size:11px">${sp.fr}</div>
          <div style="font-size:8px;color:var(--text-dim)">#${String(sp.dex).padStart(3,'0')} — ${sp.types.map(typeFr).join('/')}</div>
          <div style="margin-top:4px">
            <span style="font-size:8px;padding:2px 8px;border-radius:8px;background:rgba(255,204,90,.12);border:1px solid ${rarityCol[rarity]};color:${rarityCol[rarity]}">${rarityFR[rarity]}</span>
          </div>
        </div>
      </div>

      <!-- Zones de spawn -->
      <div>
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:6px">📍 ZONES DE SPAWN</div>
        ${zonesHtml}
        ${bestZone ? `<div style="font-size:8px;color:var(--green);margin-top:6px">✓ Meilleure zone : <b>${bestZone.name}</b> (${(bestZone.rate * 100).toFixed(1)}% / tick)</div>` : ''}
      </div>

      <!-- Conseils -->
      <div>
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:4px">📋 CONSEILS</div>
        ${tipsHtml}
      </div>

      <!-- Coût déduit -->
      <div style="font-size:8px;color:var(--text-dim);border-top:1px solid var(--border);padding-top:8px;text-align:right">
        −${price.toLocaleString()}₽ déduits · Solde : <span style="color:var(--gold)">${(state.gang.money - price).toLocaleString()}₽</span>
      </div>
    </div>`;

  // Déduire le prix
  state.gang.money -= price;
  updateTopBar();
  saveState();

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#btnDexAssistClose')?.addEventListener('click', () => overlay.remove());

  // Refresh le bouton dans le détail (plus assez d'argent peut-être)
  renderDexDetail(species_en);
}

function renderDexDetail(species_en) {
  const panel = document.getElementById('dexDetail');
  if (!panel) return;
  const sp = SPECIES_BY_EN[species_en];
  if (!sp) { panel.classList.add('hidden'); return; }

  const entry = state.pokedex[sp.en] || {};
  const caught = entry.caught || false;
  const ownedCount = state.pokemons.filter(p => p.species_en === sp.en).length;
  const spawnZones = getSpawnZones(sp.en);

  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div style="text-align:center;margin-bottom:10px">
      <div style="display:inline-flex;gap:8px;align-items:flex-end;justify-content:center">
        <div style="position:relative;display:inline-block">
          <img src="${pokeSprite(sp.en, false)}" style="width:80px;height:80px;${!caught ? 'filter:grayscale(1) brightness(.5)' : ''}">
        </div>
        ${caught && entry.shiny ? `<div style="position:relative;display:inline-block">
          <img src="${pokeSprite(sp.en, true)}" style="width:64px;height:64px;filter:drop-shadow(0 0 6px gold)">
          <span style="position:absolute;top:-4px;right:-4px;font-size:11px">✨</span>
        </div>` : ''}
      </div>
      <div style="font-family:var(--font-pixel);font-size:11px;margin-top:4px">${caught ? (state.lang === 'fr' ? sp.fr : sp.en) : '???'}</div>
      <div style="font-size:9px;color:var(--text-dim)">#${String(sp.dex).padStart(3,'0')} — ${caught ? sp.types.map(typeFr).join('/') : '?'}</div>
    </div>

    ${caught ? `
    <div style="font-size:9px;color:var(--text);margin-bottom:10px;line-height:1.5;border-top:1px solid var(--border);padding-top:8px">
      ${getDexDesc(sp.en)}
    </div>

    <div style="font-size:9px;margin-bottom:10px">
      <div style="color:var(--text-dim);margin-bottom:4px;font-family:var(--font-pixel)">CAPTURES</div>
      <div>Total capturés : <b style="color:var(--gold)">${entry.count || 0}</b></div>
      <div>Dans le PC : <b>${ownedCount}</b></div>
      ${entry.shiny ? '<div style="color:var(--gold)">✨ Chromatique obtenu !</div>' : ''}
    </div>

    <div style="font-size:9px;margin-bottom:10px">
      <div style="color:var(--text-dim);margin-bottom:4px;font-family:var(--font-pixel)">ZONES DE SPAWN</div>
      ${spawnZones.length ? spawnZones.map(z => {
        const interval = (1 / z.rate).toFixed(0);
        return `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)">
          <span>${z.name}</span>
          <span style="color:var(--text-dim)">1/${interval}s</span>
        </div>`;
      }).join('') : '<div style="color:var(--text-dim)">Aucune zone connue</div>'}
    </div>

    <div style="font-size:9px">
      <div style="color:var(--text-dim);margin-bottom:4px;font-family:var(--font-pixel)">BASE STATS</div>
      <div style="display:flex;flex-direction:column;gap:3px">
        ${[['ATK', sp.baseAtk], ['DEF', sp.baseDef], ['SPD', sp.baseSpd]].map(([label, val]) => `
          <div style="display:flex;align-items:center;gap:6px">
            <span style="width:28px;color:var(--text-dim)">${label}</span>
            <div style="flex:1;background:var(--border);border-radius:2px;height:4px">
              <div style="background:var(--gold-dim);height:4px;border-radius:2px;width:${Math.round(val/150*100)}%"></div>
            </div>
            <span style="width:24px;text-align:right">${val}</span>
          </div>`).join('')}
      </div>
    </div>
    ${ownedCount > 0 ? `
    <div style="margin-top:10px">
      <button id="dexFilterPCBtn" style="width:100%;font-size:9px;padding:6px;background:var(--bg);border:1px solid var(--blue);border-radius:var(--radius-sm);color:var(--blue);cursor:pointer;font-family:var(--font-pixel)">
        🔍 Voir dans le PC (×${ownedCount})
      </button>
    </div>` : ''}
    <div style="margin-top:8px">
      ${_getDexAssistantCostHtml(sp)}
    </div>
    ` : `
    <div style="color:var(--text-dim);font-size:10px;padding:20px;text-align:center">Pas encore rencontré</div>
    <div style="margin-top:4px">
      ${_getDexAssistantCostHtml(sp)}
    </div>`}
  `;

  document.getElementById('dexFilterPCBtn')?.addEventListener('click', () => filterPCBySpecies(sp.en));
  document.getElementById('dexAssistantBtn')?.addEventListener('click', () => openDexAssistant(species_en));
}

// ── Player stat modal ────────────────────────────────────────────
const PLAYER_STAT_POINT_EVERY = 25; // 1 pt par tranche de 25 captures

function checkPlayerStatPoints() {
  const ps  = state.playerStats || {};
  const total = Math.floor((state.stats?.totalCaught || 0) / PLAYER_STAT_POINT_EVERY);
  const granted = ps.pointsGrantedCount || 0;
  if (total > granted) {
    const newPts = total - granted;
    ps.statPoints = (ps.statPoints || 0) + newPts;
    ps.pointsGrantedCount = total;
    state.playerStats = ps;
    if (newPts > 0) notify(`📊 +${newPts} pt${newPts > 1 ? 's' : ''} de stat joueur disponible${newPts > 1 ? 's' : ''} !`, 'gold');
  }
}

function openPlayerStatModal() {
  checkPlayerStatPoints();
  const ps = state.playerStats;
  if (!ps) return;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:10000;display:flex;align-items:center;justify-content:center';

  function render() {
    const alloc = ps.allocatedStats || { combat: 0, capture: 0, luck: 0 };
    const base  = ps.baseStats      || { combat: 10, capture: 10, luck: 5 };
    const pts   = ps.statPoints || 0;
    const stats = [
      { key:'combat',  label:'⚔️ ATK (combat)',  color:'#e05c5c' },
      { key:'capture', label:'🎯 CAP (capture)',  color:'#7eb8f7' },
      { key:'luck',    label:'🍀 LCK (chance)',   color:'#6ecf8a' },
    ];
    overlay.innerHTML = `
      <div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);padding:24px;width:320px;max-width:96vw">
        <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold);margin-bottom:4px">📊 FICHE JOUEUR</div>
        <div style="font-size:9px;color:var(--text-dim);margin-bottom:12px">${state.gang.bossName || 'Boss'} · 1 pt tous les ${PLAYER_STAT_POINT_EVERY} captures</div>
        <div style="font-family:var(--font-pixel);font-size:9px;margin-bottom:14px;color:${pts > 0 ? 'var(--gold)' : 'var(--text-dim)'}">
          Points disponibles : <b style="font-size:12px">${pts}</b>
        </div>
        ${stats.map(s => {
          const tot  = (base[s.key] || 0) + (alloc[s.key] || 0);
          const add  = alloc[s.key] || 0;
          return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
            <div style="flex:1;font-size:9px;color:${s.color}">${s.label}</div>
            <button data-ps="${s.key}" data-dir="-10" title="-10" style="padding:0 5px;height:22px;border:1px solid var(--border);background:var(--bg);color:var(--text-dim);border-radius:4px;cursor:pointer;font-size:8px" ${add < 10 ? 'disabled' : ''}>−10</button>
            <button data-ps="${s.key}" data-dir="-1"  title="-1"  style="width:22px;height:22px;border:1px solid var(--border);background:var(--bg);color:var(--text);border-radius:4px;cursor:pointer;font-size:13px;line-height:1" ${add <= 0 ? 'disabled' : ''}>−</button>
            <div style="min-width:48px;text-align:center;font-family:var(--font-pixel);font-size:10px">
              <span style="color:${s.color};font-size:12px">${tot}</span>
              ${add > 0 ? `<span style="font-size:7px;color:var(--gold)"> (+${add})</span>` : ''}
            </div>
            <button data-ps="${s.key}" data-dir="1"  title="+1"  style="width:22px;height:22px;border:1px solid var(--gold);background:rgba(255,204,90,.08);color:var(--gold);border-radius:4px;cursor:pointer;font-size:13px;line-height:1" ${pts <= 0 ? 'disabled' : ''}>+</button>
            <button data-ps="${s.key}" data-dir="10" title="+10" style="padding:0 5px;height:22px;border:1px solid var(--gold);background:rgba(255,204,90,.08);color:var(--gold);border-radius:4px;cursor:pointer;font-size:8px" ${pts < 10 ? 'disabled' : ''}>+10</button>
          </div>`;
        }).join('')}
        <div style="display:flex;gap:8px;margin-top:18px">
          <button id="psConfirm" style="flex:1;padding:9px;background:var(--gold);color:#000;border:none;border-radius:var(--radius-sm);font-family:var(--font-pixel);font-size:8px;cursor:pointer">CONFIRMER</button>
          <button id="psCancel" style="flex:1;padding:9px;background:var(--bg);border:1px solid var(--border);color:var(--text-dim);border-radius:var(--radius-sm);font-family:var(--font-pixel);font-size:8px;cursor:pointer">FERMER</button>
        </div>
      </div>`;

    overlay.querySelectorAll('[data-ps][data-dir]').forEach(btn => {
      btn.addEventListener('click', () => {
        const s    = btn.dataset.ps;
        const dir  = parseInt(btn.dataset.dir);
        const step = Math.abs(dir);
        const alloc = ps.allocatedStats || { combat: 0, capture: 0, luck: 0 };
        if (dir > 0) { const n = Math.min(step, ps.statPoints); alloc[s] += n; ps.statPoints -= n; }
        else         { const n = Math.min(step, alloc[s]);      alloc[s] -= n; ps.statPoints += n; }
        ps.allocatedStats = alloc;
        render();
      });
    });
    overlay.querySelector('#psConfirm')?.addEventListener('click', () => {
      saveState();
      overlay.remove();
      if (activeTab === 'tabAgents') renderAgentsTab();
    });
    overlay.querySelector('#psCancel')?.addEventListener('click', () => overlay.remove());
  }

  render();
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── Pokédex integrity check ───────────────────────────────────────
// Rebuilds state.pokedex caught/shiny/count from the actual pokemon list.
// "seen" flags are preserved (they can't be reconstructed from ownership).
function rebuildPokedex() {
  // Step 1 — preserve existing seen AND shiny flags (both are historical — never reset)
  // "shiny" = has ever obtained a chroma of this species (includes sold ones)
  const next = {};
  // seen / caught / shiny = historical flags → only ever go UP, never down
  // count = rebuilt from current ownership (can go down if sold)
  for (const [en, entry] of Object.entries(state.pokedex)) {
    next[en] = {
      seen:   !!entry.seen,
      caught: !!entry.caught, // preserved — may have been sold but was once caught
      shiny:  !!entry.shiny,  // preserved — may have been sold but was once obtained
      count:  0,              // rebuilt from current ownership below
    };
  }

  // Step 2 — add missing entries + rebuild count from owned pokemons
  for (const pk of state.pokemons) {
    const en = pk.species_en;
    if (!next[en]) next[en] = { seen: true, caught: false, shiny: false, count: 0 };
    next[en].caught = true;   // add only
    next[en].seen   = true;   // add only
    next[en].count  = (next[en].count || 0) + 1;
    if (pk.shiny) next[en].shiny = true; // add only
  }

  // Step 3 — eggs: mark species as seen
  for (const egg of state.eggs || []) {
    if (!egg.species_en) continue;
    if (!next[egg.species_en]) next[egg.species_en] = { seen: false, caught: false, shiny: false, count: 0 };
    next[egg.species_en].seen = true;
  }

  // Step 4 — detect discrepancies before committing
  let fixedCaught = 0, fixedShiny = 0, fixedCount = 0;
  for (const en of Object.keys(next)) {
    const old = state.pokedex[en] || {};
    if (!!old.caught !== next[en].caught) fixedCaught++;
    if (!!old.shiny  !== next[en].shiny)  fixedShiny++;
    if ((old.count || 0) !== next[en].count) fixedCount++;
  }

  // Step 5 — commit
  state.pokedex = next;

  // Step 6 — rebuild derived stats
  state.stats.dexCaught = POKEMON_GEN1.filter(s => !s.hidden && next[s.en]?.caught).length;
  // shinyCaught = cumulative total captures ever (includes sold).
  // Only correct upward: if currently owned shinies exceed the stored counter
  // (e.g. counter was never saved), bring it up — but never reduce it.
  const ownedShinyNow = state.pokemons.filter(p => p.shiny).length;
  if ((state.stats.shinyCaught || 0) < ownedShinyNow) {
    state.stats.shinyCaught = ownedShinyNow;
  }
  // shinySpeciesCount is derived on-the-fly from pokedex[en].shiny (getShinySpeciesCount())
  // — no separate stat to store; the dex flags are the source of truth.

  saveState();

  const kanto    = getDexKantoCaught();
  const shinyEsp = getShinySpeciesCount();
  const parts = [];
  if (fixedCaught) parts.push(`${fixedCaught} capturés corrigés`);
  if (fixedShiny)  parts.push(`${fixedShiny} chromas corrigés`);
  if (fixedCount)  parts.push(`${fixedCount} compteurs corrigés`);
  const detail = parts.length ? ` (${parts.join(', ')})` : ' — tout était déjà cohérent';
  notify(`✅ Pokédex recalibré${detail} · Kanto ${kanto}/${KANTO_DEX_SIZE} · ${shinyEsp} esp. chroma`, 'success');

  renderPokedexTab();
  renderGangTab();
}

function renderPokedexTab() {
  const grid = document.getElementById('pokedexGrid');
  if (!grid) return;

  // ── Counter bar (Kanto / National / Chromas) ─────────────────
  const kantoCaught    = getDexKantoCaught();
  const nationalCaught = getDexNationalCaught();
  const shinySpecies   = getShinySpeciesCount();

  let dexCounter = document.getElementById('dexCounter');
  if (!dexCounter) {
    dexCounter = document.createElement('div');
    dexCounter.id = 'dexCounter';
    dexCounter.style.cssText = 'font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:6px;display:flex;gap:12px;flex-wrap:wrap;align-items:center';
    grid.parentNode.insertBefore(dexCounter, grid);
  }
  dexCounter.innerHTML = `
    <span title="Pokédex Kanto (151 espèces originales)">📖 Kanto&nbsp;<b style="color:var(--text)">${kantoCaught}/${KANTO_DEX_SIZE}</b></span>
    <span title="Pokédex National (toutes espèces disponibles)" style="opacity:.7">🌐 National&nbsp;<b style="color:var(--text)">${nationalCaught}/${NATIONAL_DEX_SIZE}</b></span>
    <span title="Espèces uniques dont au moins un exemplaire chromatique">✨&nbsp;<b style="color:var(--gold)">${shinySpecies}</b></span>
    <button id="dexRebuildBtn" title="Reconstruire le Pokédex depuis tes Pokémon réels" style="margin-left:auto;font-family:var(--font-pixel);font-size:7px;padding:3px 7px;background:rgba(255,204,90,.08);border:1px solid rgba(255,204,90,.35);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;white-space:nowrap">🔄 Recalibrer</button>
  `;
  document.getElementById('dexRebuildBtn')?.addEventListener('click', rebuildPokedex);

  // ── Filter tabs ────────────────────────────────────────────────
  const DEX_FILTERS = [
    { id: 'kanto',    label: 'Kanto',       title: 'Pokémon #001–151' },
    { id: 'national', label: 'National',    title: 'Toutes les espèces disponibles' },
    { id: 'shiny',    label: '✨ Chromas',  title: 'Espèces dont tu possèdes un chromatique' },
    { id: 'missing',  label: '❓ Manquants',title: 'Espèces non encore capturées' },
  ];
  let dexFilterBar = document.getElementById('dexFilterBar');
  if (!dexFilterBar) {
    dexFilterBar = document.createElement('div');
    dexFilterBar.id = 'dexFilterBar';
    dexFilterBar.style.cssText = 'display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap';
    grid.parentNode.insertBefore(dexFilterBar, grid);
  }
  dexFilterBar.innerHTML = DEX_FILTERS.map(f => `
    <button data-dexfilter="${f.id}" title="${f.title}" style="
      font-family:var(--font-pixel);font-size:7px;padding:3px 8px;border-radius:var(--radius-sm);cursor:pointer;
      background:${dexViewFilter === f.id ? 'var(--gold)' : 'var(--bg-card)'};
      color:${dexViewFilter === f.id ? '#000' : 'var(--text-dim)'};
      border:1px solid ${dexViewFilter === f.id ? 'var(--gold)' : 'var(--border)'};
      font-weight:${dexViewFilter === f.id ? 'bold' : 'normal'};
      transition:background .15s,color .15s">${f.label}</button>
  `).join('');
  dexFilterBar.querySelectorAll('[data-dexfilter]').forEach(btn => {
    btn.addEventListener('click', () => {
      dexViewFilter = btn.dataset.dexfilter;
      renderPokedexTab();
    });
  });

  // ── Build species pool (always complete — filter only dims) ──────
  const search = document.getElementById('dexSearchInput')?.value?.toLowerCase() || '';

  // Pool = full dex for this view (never shrinks due to filter)
  const isNational = dexViewFilter === 'national';
  let pool = isNational
    ? POKEMON_GEN1.filter(sp => !sp.hidden)
    : POKEMON_GEN1.filter(sp => !sp.hidden && sp.dex >= 1 && sp.dex <= 151);

  // Text search hides entries (intentional user action)
  if (search) {
    pool = pool.filter(sp =>
      sp.en.includes(search) || sp.fr.toLowerCase().includes(search) ||
      String(sp.dex).includes(search)
    );
  }

  // Predicate: is this entry "highlighted" by the current filter?
  function isHighlighted(sp) {
    switch (dexViewFilter) {
      case 'shiny':   return !!state.pokedex[sp.en]?.shiny;
      case 'missing': return !state.pokedex[sp.en]?.caught;
      default:        return true; // kanto / national → tout est mis en avant
    }
  }
  const hasActiveOverlay = dexViewFilter === 'shiny' || dexViewFilter === 'missing';

  // ── Render grid ────────────────────────────────────────────────
  grid.innerHTML = pool.length ? pool.map(sp => {
    const entry    = state.pokedex[sp.en];
    const caught   = entry?.caught;
    const seen     = entry?.seen;
    const sel      = dexSelectedEn === sp.en ? 'selected' : '';
    const hasShiny = !!entry?.shiny;
    const dimmed   = hasActiveOverlay && !isHighlighted(sp) ? 'dex-dimmed' : '';
    return `<div class="dex-entry ${caught ? 'caught' : ''} ${!seen && !caught ? 'unseen' : ''} ${dimmed} ${sel}" data-dex-en="${sp.en}" style="position:relative">
      ${caught || seen
        ? `<img src="${pokeSprite(sp.en, hasShiny)}" style="width:36px;height:36px;${!caught ? 'filter:brightness(0)' : ''}">`
        : `<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:14px">?</div>`
      }
      ${hasShiny ? `<span style="position:absolute;top:-3px;right:-3px;font-size:9px;line-height:1;pointer-events:none" title="Chromatique obtenu">✨</span>` : ''}
      <div class="dex-number">#${String(sp.dex).padStart(3, '0')}</div>
    </div>`;
  }).join('') : `<div style="color:var(--text-dim);font-size:9px;padding:16px;font-family:var(--font-pixel)">Aucun résultat.</div>`;

  grid.querySelectorAll('.dex-entry[data-dex-en]').forEach(el => {
    el.addEventListener('click', () => {
      dexSelectedEn = el.dataset.dexEn;
      grid.querySelectorAll('.dex-entry').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      renderDexDetail(dexSelectedEn);
    });
  });

  // Search input wiring (once)
  const searchInput = document.getElementById('dexSearchInput');
  if (searchInput && !searchInput.dataset.wired) {
    searchInput.dataset.wired = '1';
    searchInput.addEventListener('input', () => renderPokedexTab());
  }

  // Restore detail panel
  if (dexSelectedEn) renderDexDetail(dexSelectedEn);
}

// ════════════════════════════════════════════════════════════════
// 18b. UI — AGENTS TAB
// ════════════════════════════════════════════════════════════════

function renderAgentPerkModal(agentId) {
  const agent = state.agents.find(a => a.id === agentId);
  if (!agent) return;

  const overlay = document.createElement('div');
  overlay.className = 'perk-modal-overlay';
  overlay.innerHTML = `
    <div class="perk-modal-box">
      <div class="perk-modal-title">${agent.name} — PERK Lv.${agent.level}</div>
      <div style="font-size:10px;color:var(--text-dim);margin-bottom:12px">Choisis une amelioration :</div>
      <div class="perk-modal-btns">
        <button class="perk-modal-btn" data-perk="combat">+3 ATK</button>
        <button class="perk-modal-btn" data-perk="capture">+3 CAP</button>
        <button class="perk-modal-btn" data-perk="luck">+3 LCK</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelectorAll('[data-perk]').forEach(btn => {
    btn.addEventListener('click', () => {
      const stat = btn.dataset.perk;
      agent.stats[stat] = (agent.stats[stat] || 0) + 3;
      if (!agent.perkLevels) agent.perkLevels = [];
      agent.perkLevels.push({ level: agent.level, stat });
      agent.pendingPerk = false;
      saveState();
      overlay.remove();
      renderAgentsTab();
    });
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

const AGENT_BALLS = ['pokeball','greatball','ultraball','duskball','masterball'];
const AGENT_BALL_LABELS = { pokeball:'Poké Ball', greatball:'Super Ball', ultraball:'Hyper Ball', duskball:'Sombre Ball', masterball:'Master Ball' };
const BEHAVIOR_CFG = [
  { key:'all',     icon:'⚡', label:'Tout' },
  { key:'capture', icon:'🎯', label:'Capture' },
  { key:'combat',  icon:'⚔️',  label:'Combat' },
];

function renderAgentsTab() {
  const grid = document.getElementById('agentsGrid');
  if (!grid) return;

  const unlockedZones = ZONES.filter(z => isZoneUnlocked(z.id));
  const RECRUIT_COST  = getAgentRecruitCost();

  // ── Player stat card ────────────────────────────────────────────
  const ps      = state.playerStats || {};
  const psBase  = ps.baseStats  || { combat: 10, capture: 10, luck: 5 };
  const psAlloc = ps.allocatedStats || { combat: 0, capture: 0, luck: 0 };
  const psPts   = ps.statPoints || 0;
  const psAtk   = (psBase.combat  || 0) + (psAlloc.combat  || 0);
  const psCap   = (psBase.capture || 0) + (psAlloc.capture || 0);
  const psLck   = (psBase.luck    || 0) + (psAlloc.luck    || 0);
  const PLAYER_STAT_POINT_EVERY = 25;
  const playerTotalPoints = Math.floor((state.stats?.totalCaught || 0) / PLAYER_STAT_POINT_EVERY);

  let html = `
    <div class="agent-card-full" style="border-color:var(--gold)" id="playerStatCard">
      <div class="agent-header">
        ${state.gang.bossSprite ? `<img src="${trainerSprite(state.gang.bossSprite)}" alt="Boss" style="width:44px;height:44px;image-rendering:pixelated">` : '<div style="width:44px;height:44px;background:var(--bg-card);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:20px">👤</div>'}
        <div class="agent-meta">
          <div class="agent-name" style="color:var(--gold)">${state.gang.bossName || 'Boss'}</div>
          <div class="agent-title" style="color:var(--gold)">Chef de gang</div>
          <div style="font-size:8px;color:var(--text-dim)">Pts gagnés : ${playerTotalPoints} · Distribués : ${playerTotalPoints - psPts} · Disponibles : <b style="color:var(--gold)">${psPts}</b></div>
        </div>
      </div>
      <div class="agent-stats-row">
        <span title="Base: ${psBase.combat}">ATK ${psAtk}${psAlloc.combat > 0 ? ` <small style="color:var(--gold)">(+${psAlloc.combat})</small>` : ''}</span>
        <span title="Base: ${psBase.capture}">CAP ${psCap}${psAlloc.capture > 0 ? ` <small style="color:var(--gold)">(+${psAlloc.capture})</small>` : ''}</span>
        <span title="Base: ${psBase.luck}">LCK ${psLck}${psAlloc.luck > 0 ? ` <small style="color:var(--gold)">(+${psAlloc.luck})</small>` : ''}</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:6px">
        <button id="btnPlayerStatModal" style="flex:1;font-family:var(--font-pixel);font-size:7px;padding:4px;background:rgba(255,204,90,.1);border:1px solid var(--gold);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">📊 Attribuer les stats${psPts > 0 ? ` (${psPts} pts)` : ''}</button>
      </div>
    </div>`;

  // ── Global ball setters ─────────────────────────────────────────
  const availBalls = AGENT_BALLS.filter(b => (state.inventory[b] || 0) > 0 || b === 'pokeball');
  html += `<div id="agentGlobalControls" style="grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);margin-bottom:4px">
    <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">TOUT :</span>
    ${availBalls.map(b => `<button data-setallball="${b}" title="Définir ${AGENT_BALL_LABELS[b]} pour tous" style="display:flex;align-items:center;gap:3px;padding:3px 7px;font-size:8px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--text)">
      <img src="${BALL_SPRITES[b] || ''}" style="width:14px;height:14px;image-rendering:pixelated"> ${AGENT_BALL_LABELS[b]}
    </button>`).join('')}
    <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);margin-left:8px">MODE :</span>
    ${BEHAVIOR_CFG.map(b => `<button data-setallbehavior="${b.key}" title="Mode ${b.label} pour tous" style="padding:3px 7px;font-size:8px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;color:var(--text)">${b.icon} ${b.label}</button>`).join('')}
  </div>`;

  // ── Agent cards ─────────────────────────────────────────────────
  for (const a of state.agents) {
    const xpNeeded = a.level * 30;
    const xpPct    = Math.min(100, (a.xp / xpNeeded) * 100);
    const alloc    = a.allocatedStats || { capture: 0, combat: 0, luck: 0 };
    const zoneOptions = unlockedZones.map(z =>
      `<option value="${z.id}" ${a.assignedZone === z.id ? 'selected' : ''}>${state.lang === 'fr' ? z.fr : z.en}</option>`
    ).join('');

    const teamSlots = [0, 1, 2].map(i => {
      const pkId = a.team[i];
      const pk   = pkId ? state.pokemons.find(p => p.id === pkId) : null;
      if (pk) return `<div class="agent-team-slot filled" data-agent-team="${a.id}" data-slot="${i}" title="${speciesName(pk.species_en)} Lv.${pk.level}"><img src="${pokeIcon(pk.species_en)}" style="${pk.shiny ? 'filter:drop-shadow(0 0 2px var(--gold))' : ''}" onerror="this.src='${pokeSprite(pk.species_en, pk.shiny)}'"></div>`;
      return `<div class="agent-team-slot" data-agent-team="${a.id}" data-slot="${i}">+</div>`;
    }).join('');

    // Ball selector
    const curBall   = a.preferredBall || 'pokeball';
    const curBallSp = BALL_SPRITES[curBall] || '';
    const ballBtns  = AGENT_BALLS.map(b => {
      const qty = state.inventory[b] || 0;
      const active = b === curBall;
      return `<button data-agent-ball="${a.id}" data-ball="${b}" title="${AGENT_BALL_LABELS[b]} (×${qty})" style="padding:2px 4px;border:1px solid ${active ? 'var(--gold)' : 'var(--border)'};background:${active ? 'rgba(255,204,90,.15)' : 'var(--bg)'};border-radius:3px;cursor:pointer;opacity:${qty > 0 || active ? '1' : '.4'}">
        <img src="${BALL_SPRITES[b] || ''}" style="width:16px;height:16px;image-rendering:pixelated">
      </button>`;
    }).join('');

    // Behavior toggle
    const bh = a.behavior || 'all';
    const bhCfg = BEHAVIOR_CFG.find(x => x.key === bh) || BEHAVIOR_CFG[0];
    const bhBtns = BEHAVIOR_CFG.map(b =>
      `<button data-agent-behavior="${a.id}" data-bh="${b.key}" style="padding:2px 7px;font-size:8px;border:1px solid ${bh === b.key ? 'var(--gold)' : 'var(--border)'};background:${bh === b.key ? 'rgba(255,204,90,.15)' : 'var(--bg)'};border-radius:3px;cursor:pointer;color:${bh === b.key ? 'var(--gold)' : 'var(--text-dim)'}">${b.icon} ${b.label}</button>`
    ).join('');

    const statPts = a.statPoints || 0;

    const cosmUnlockedAgent = state.purchases?.cosmeticsPanel;
    html += `<div class="agent-card-full" data-agent-id="${a.id}">
      <div class="agent-header">
        <img src="${a.sprite}" alt="${a.name}" onerror="this.src='${FALLBACK_TRAINER_SVG}';this.onerror=null">
        <div class="agent-meta">
          <div class="agent-title agent-rank-${a.title}">${getAgentRankLabel(a)}</div>
          <div class="agent-name">${a.name}</div>
          <div class="agent-level" style="font-size:8px;color:var(--text-dim)">Lv.${a.level}</div>
          <div class="agent-xp-bar"><div class="agent-xp-fill" style="width:${xpPct}%"></div></div>
        </div>
        ${cosmUnlockedAgent ? `<div style="display:flex;flex-direction:column;gap:3px;margin-left:auto;padding-left:6px">
          <button class="agent-card-rename" data-agent-id="${a.id}" title="Renommer (2 000₽)" style="font-size:10px;padding:2px 5px;background:var(--bg);border:1px solid var(--border);border-radius:3px;cursor:pointer;color:var(--text-dim)">✏</button>
          <button class="agent-card-sprite" data-agent-id="${a.id}" title="Changer sprite (5 000₽)" style="font-size:10px;padding:2px 5px;background:var(--bg);border:1px solid var(--border);border-radius:3px;cursor:pointer;color:var(--text-dim)">🎨</button>
        </div>` : ''}
      </div>
      <div class="agent-stats-row">
        <span title="Base: ${a.baseStats?.combat ?? a.stats.combat}">ATK ${a.stats.combat}${alloc.combat > 0 ? ` <small style="color:var(--gold)">(+${alloc.combat})</small>` : ''}</span>
        <span title="Base: ${a.baseStats?.capture ?? a.stats.capture}">CAP ${a.stats.capture}${alloc.capture > 0 ? ` <small style="color:var(--gold)">(+${alloc.capture})</small>` : ''}</span>
        <span title="Base: ${a.baseStats?.luck ?? a.stats.luck}">LCK ${a.stats.luck}${alloc.luck > 0 ? ` <small style="color:var(--gold)">(+${alloc.luck})</small>` : ''}</span>
      </div>

      <!-- Ball selector -->
      <div style="display:flex;align-items:center;gap:4px;margin:4px 0;flex-wrap:wrap">
        <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">BALL :</span>
        ${ballBtns}
      </div>

      <!-- Behavior toggle -->
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:6px;flex-wrap:wrap">
        <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">MODE :</span>
        ${bhBtns}
      </div>

      <div style="font-size:9px">
        <select class="agents-zone-select" data-agent-id="${a.id}" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;font-size:9px;padding:2px 4px;width:100%">
          <option value="">— Aucune zone —</option>
          ${zoneOptions}
        </select>
      </div>
      <div class="agent-team-slots">${teamSlots}</div>
      <div class="agent-personality">${a.personality.join(', ')}</div>

      <!-- Stat points & respec -->
      ${!a.natureDefined
        ? `<div style="margin-top:6px">
            <button data-agent-statmodal="${a.id}" style="width:100%;font-family:var(--font-pixel);font-size:7px;padding:6px;background:rgba(224,92,92,.12);border:2px solid #e05c5c;border-radius:var(--radius-sm);color:#e05c5c;cursor:pointer;animation:pulse 1.6s infinite">
              🌟 DÉFINIR SA NATURE PROFONDE
            </button>
          </div>`
        : `<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
            <button data-agent-statmodal="${a.id}" style="flex:1;font-family:var(--font-pixel);font-size:7px;padding:4px;background:${statPts > 0 ? 'rgba(255,204,90,.12)' : 'var(--bg)'};border:1px solid ${statPts > 0 ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);color:${statPts > 0 ? 'var(--gold)' : 'var(--text-dim)'};cursor:pointer">
              📊 Stats${statPts > 0 ? ` (${statPts} pts !)` : ''}
            </button>
            <button data-agent-respec="${a.id}" title="Réattribuer les stats (1 000 000₽)" style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">🔄 Respec</button>
          </div>`
      }

      <label class="agent-notify-toggle">
        <input type="checkbox" class="agent-notify-cb" data-agent-id="${a.id}" ${a.notifyCaptures !== false ? 'checked' : ''}>
        ${a.notifyCaptures !== false ? '🔔' : '🔕'} Notifications
      </label>
    </div>`;
  }

  // Recruit button
  html += `<div class="agent-card-full" style="display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px dashed var(--border-light);min-height:120px" id="btnRecruitAgentFull">
    <div style="text-align:center">
      <div style="font-size:28px">➕</div>
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text);margin-top:6px">Recruter</div>
      <div style="font-size:10px;color:var(--gold)">₽ ${RECRUIT_COST.toLocaleString()}</div>
    </div>
  </div>`;

  grid.innerHTML = html;

  // Agent tree toggle
  const treeBtn = document.getElementById('btnToggleAgentTree');
  const treeCon = document.getElementById('agentTreeContainer');
  if (treeBtn && treeCon) {
    treeBtn.addEventListener('click', () => {
      const open = treeCon.style.display === 'none';
      treeCon.style.display = open ? 'block' : 'none';
      treeBtn.textContent  = open ? '🌳 Masquer l\'arbre' : '🌳 Afficher l\'arbre';
      if (open) renderAgentTree(treeCon);
    });
  }

  // Wire unequip-all button (once, guarded)
  const unequipBtn = document.getElementById('btnUnequipAll');
  if (unequipBtn && !unequipBtn.dataset.wired) {
    unequipBtn.dataset.wired = '1';
    unequipBtn.addEventListener('click', () => {
      for (const a of state.agents) a.team = [];
      saveState();
      renderAgentsTab();
      notify(state.lang === 'fr' ? 'Toutes les équipes vidées' : 'All teams cleared', 'success');
    });
  }

  // Bind events
  // Recruit
  document.getElementById('btnRecruitAgentFull')?.addEventListener('click', () => {
    openAgentRecruitModal(() => renderAgentsTab());
  });

  // Zone assignment
  grid.querySelectorAll('.agents-zone-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      assignAgentToZone(e.target.dataset.agentId, e.target.value || null);
      if (activeTab === 'tabZones') renderZoneWindows();
    });
  });

  // Team slot clicks
  grid.querySelectorAll('[data-agent-team]').forEach(slot => {
    slot.addEventListener('click', () => {
      const agentId = slot.dataset.agentTeam;
      const slotIdx = parseInt(slot.dataset.slot);
      const agent = state.agents.find(a => a.id === agentId);
      if (!agent) return;
      const pkId = agent.team[slotIdx];
      if (pkId) {
        // Remove from team
        agent.team.splice(slotIdx, 1);
        saveState();
        renderAgentsTab();
      } else {
        // Show picker
        openTeamPicker('agent', agentId, () => renderAgentsTab());
      }
    });
  });

  // Notification toggle
  grid.querySelectorAll('.agent-notify-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const agent = state.agents.find(a => a.id === e.target.dataset.agentId);
      if (agent) {
        agent.notifyCaptures = e.target.checked;
        saveState();
        renderAgentsTab();
      }
    });
  });

  // Ball selector per agent
  grid.querySelectorAll('[data-agent-ball]').forEach(btn => {
    btn.addEventListener('click', () => {
      const agent = state.agents.find(a => a.id === btn.dataset.agentBall);
      if (!agent) return;
      agent.preferredBall = btn.dataset.ball;
      saveState();
      renderAgentsTab();
    });
  });

  // Behavior per agent
  grid.querySelectorAll('[data-agent-behavior]').forEach(btn => {
    btn.addEventListener('click', () => {
      const agent = state.agents.find(a => a.id === btn.dataset.agentBehavior);
      if (!agent) return;
      agent.behavior = btn.dataset.bh;
      saveState();
      renderAgentsTab();
    });
  });

  // Global ball setters
  grid.querySelectorAll('[data-setallball]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ball = btn.dataset.setallball;
      state.agents.forEach(a => { a.preferredBall = ball; });
      saveState();
      renderAgentsTab();
      notify(`Tous les agents → ${AGENT_BALL_LABELS[ball]}`, 'success');
    });
  });

  // Global behavior setters
  grid.querySelectorAll('[data-setallbehavior]').forEach(btn => {
    btn.addEventListener('click', () => {
      const bh = btn.dataset.setallbehavior;
      state.agents.forEach(a => { a.behavior = bh; });
      saveState();
      renderAgentsTab();
      const cfg = BEHAVIOR_CFG.find(x => x.key === bh);
      notify(`Tous les agents → mode ${cfg?.label || bh}`, 'success');
    });
  });

  // Stat modal per agent — route to nature modal if not yet defined
  grid.querySelectorAll('[data-agent-statmodal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const agentId = btn.dataset.agentStatmodal;
      const agent   = state.agents.find(a => a.id === agentId);
      if (!agent) return;
      if (!agent.natureDefined) openAgentNatureModal(agentId);
      else                      openAgentStatModal(agentId);
    });
  });

  // Respec per agent
  grid.querySelectorAll('[data-agent-respec]').forEach(btn => {
    btn.addEventListener('click', () => respecAgentStats(btn.dataset.agentRespec));
  });

  // Player stat modal
  document.getElementById('btnPlayerStatModal')?.addEventListener('click', openPlayerStatModal);

  // Right-click context menu on agent cards
  grid.querySelectorAll('.agent-card-full[data-agent-id]').forEach(card => {
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const aId = card.dataset.agentId;
      const agent = state.agents.find(a => a.id === aId);
      if (!agent) return;
      const unlockedZones = ZONES.filter(z => isZoneUnlocked(z.id));
      const zoneItems = unlockedZones.slice(0, 8).map(z => ({
        action: 'zone_' + z.id,
        label: (state.lang === 'fr' ? z.fr : z.en),
        fn: () => { agent.assignedZone = z.id; saveState(); renderAgentsTab(); notify(agent.name + ' -> ' + (state.lang === 'fr' ? z.fr : z.en), 'success'); syncBackgroundZones(); }
      }));
      showContextMenu(e.clientX, e.clientY, [
        { action:'clearteam', label:'Vider l\'equipe', fn: () => { agent.team = []; saveState(); renderAgentsTab(); } },
        { action:'autoteam', label:'Auto-equipe (top 3)', fn: () => {
          const usedIds = new Set();
          state.agents.forEach(a => { if (a.id !== agent.id) a.team.forEach(id => usedIds.add(id)); });
          state.gang.bossTeam.forEach(id => usedIds.add(id));
          const avail = state.pokemons.filter(p => !usedIds.has(p.id)).sort((a,b) => getPokemonPower(b) - getPokemonPower(a));
          agent.team = avail.slice(0, 3).map(p => p.id);
          saveState(); renderAgentsTab(); notify('Equipe auto assignee', 'success');
        }},
        ...zoneItems.length ? [{ action:'envoyer', label:'Envoyer en zone', fn: () => {} }, ...zoneItems] : [],
        { action:'unassign', label:'Retirer de la zone', fn: () => { agent.assignedZone = null; saveState(); renderAgentsTab(); syncBackgroundZones(); } },
      ]);
    });
  });

  // Rename / sprite buttons (cosmétiques dans agents tab)
  grid.querySelectorAll('.agent-card-rename').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.gang.money < 2000) { notify('Fonds insuffisants (2 000₽)', 'error'); return; }
      const agent = state.agents.find(a => a.id === btn.dataset.agentId);
      if (!agent) return;
      openNameModal({ title: `Renommer ${agent.name}`, current: agent.name, cost: 2000, onConfirm: (val) => {
        state.gang.money -= 2000;
        agent.name = val;
        saveState(); renderAgentsTab();
        notify(`Agent renommé : ${val}`, 'gold');
      }});
    });
  });
  grid.querySelectorAll('.agent-card-sprite').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.gang.money < 5000) { notify('Fonds insuffisants (5 000₽)', 'error'); return; }
      const agent = state.agents.find(a => a.id === btn.dataset.agentId);
      if (!agent) return;
      openSpritePicker(null, (newSprite) => {
        state.gang.money -= 5000;
        agent.sprite = trainerSprite(newSprite);
        saveState(); renderAgentsTab();
        notify(`Sprite de ${agent.name} mis à jour !`, 'gold');
      });
    });
  });

}

// ── Agent org-chart (proto — visual only, no mechanical assignment yet) ──
// Ranks: grunt → sergent → lieutenant → commandant → elite/général
// Capacity per rank (how many direct reports they can have):
const RANK_CAPACITY = { grunt: 0, sergent: 2, lieutenant: 3, commandant: 4, elite: 5, general: 6 };
// Rank level (higher = more senior)
const RANK_LEVEL = { grunt: 0, sergent: 1, lieutenant: 2, commandant: 3, elite: 4, general: 5 };

function renderAgentTree(container) {
  const RANK_COLOR = {
    grunt:      'var(--text-dim)',
    sergent:    '#7ecfff',
    lieutenant: '#b07cff',
    commandant: 'var(--gold)',
    elite:      '#ff8c5a',
    general:    'var(--red)',
  };
  const RANK_FR = { grunt:'Grunt', sergent:'Sergent', lieutenant:'Lieutenant', commandant:'Commandant', elite:'Élite', general:'Général' };

  // Sort agents by rank level desc
  const sorted = [...state.agents].sort((a, b) => (RANK_LEVEL[b.title] ?? 0) - (RANK_LEVEL[a.title] ?? 0));

  // Group by rank
  const byRank = {};
  for (const a of sorted) {
    (byRank[a.title] = byRank[a.title] || []).push(a);
  }

  // Build level columns (boss + each rank level)
  const rankOrder = ['general','elite','commandant','lieutenant','sergent','grunt'];
  const usedRanks = rankOrder.filter(r => byRank[r]?.length);

  const agentNode = (a) => {
    const cap  = RANK_CAPACITY[a.title] || 0;
    const col  = RANK_COLOR[a.title]   || 'var(--text-dim)';
    const zone = a.assignedZone ? (ZONE_BY_ID[a.assignedZone]?.fr || a.assignedZone) : '—';
    return `<div class="agent-tree-node" style="border-color:${col};background:var(--bg-panel)">
      <img src="${a.sprite}" style="width:32px;height:32px;image-rendering:pixelated" onerror="this.style.display='none'">
      <div>
        <div style="font-family:var(--font-pixel);font-size:7px;color:${col}">${RANK_FR[a.title] || a.title}</div>
        <div style="font-size:9px;margin-top:1px">${a.name}</div>
        <div style="font-size:8px;color:var(--text-dim);margin-top:1px">Lv.${a.level} · ${zone}</div>
        ${cap > 0 ? `<div style="font-size:7px;color:var(--text-dim);margin-top:2px;font-family:var(--font-pixel)">⬇ ${cap} max</div>` : ''}
      </div>
    </div>`;
  };

  const bossNode = `<div class="agent-tree-node" style="border-color:var(--gold);background:rgba(255,204,90,.06)">
    ${state.gang.bossSprite ? `<img src="${trainerSprite(state.gang.bossSprite)}" style="width:36px;height:36px;image-rendering:pixelated">` : '<span style="font-size:26px">👤</span>'}
    <div>
      <div style="font-family:var(--font-pixel);font-size:7px;color:var(--gold)">BOSS</div>
      <div style="font-size:9px;margin-top:1px">${state.gang.bossName || 'Boss'}</div>
      <div style="font-size:8px;color:var(--text-dim);margin-top:1px">${getBossFullTitle()}</div>
    </div>
  </div>`;

  const columns = [
    { label: 'Boss', nodes: [bossNode] },
    ...usedRanks.map(r => ({
      label: RANK_FR[r] + (byRank[r].length > 1 ? ` ×${byRank[r].length}` : ''),
      color: RANK_COLOR[r],
      nodes: byRank[r].map(agentNode),
    })),
  ];

  if (!state.agents.length) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-dim);font-size:10px;font-family:var(--font-pixel)">Recrutez des agents pour construire votre organisation.</div>`;
    return;
  }

  container.innerHTML = `
    <div style="display:flex;gap:0;align-items:flex-start;min-width:max-content">
      ${columns.map((col, ci) => `
        <div style="display:flex;flex-direction:column;align-items:center;position:relative">
          <!-- connector line to next column -->
          ${ci < columns.length - 1 ? '<div class="agent-tree-connector"></div>' : ''}
          <div style="font-family:var(--font-pixel);font-size:7px;color:${col.color || 'var(--gold)'};margin-bottom:8px;white-space:nowrap">${col.label}</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${col.nodes.join('')}
          </div>
        </div>
      `).join('')}
    </div>
    <div style="margin-top:12px;font-size:8px;color:var(--text-dim);font-family:var(--font-pixel);opacity:.6">
      ⚠ PROTO — L'assignation hiérarchique n'est pas encore implémentée.
    </div>`;
}

// ════════════════════════════════════════════════════════════════
// 18c. UI — MISSIONS TAB
// ════════════════════════════════════════════════════════════════

function renderMissionsTab() {
  const el = document.getElementById('tabMissions');
  if (!el) return;
  initMissions();

  const renderSection = (title, missions) => {
    let html = `<div style="margin-bottom:20px">
      <h3 style="font-family:var(--font-pixel);font-size:11px;color:var(--gold);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">${title}</h3>`;
    for (const m of missions) {
      const progress = getMissionProgress(m);
      const complete = isMissionComplete(m);
      const claimed = isMissionClaimed(m);
      const pct = Math.min(100, (progress / m.target) * 100);
      const name = state.lang === 'fr' ? m.fr : m.en;
      const rewardStr = [];
      if (m.reward.money) rewardStr.push(m.reward.money.toLocaleString() + '₽');
      if (m.reward.rep) rewardStr.push('+' + m.reward.rep + ' rep');

      html += `<div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--border);opacity:${claimed ? '.5' : '1'}">
        <span style="font-size:20px">${m.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;${claimed ? 'text-decoration:line-through' : ''}">${name}</div>
          ${m.desc_fr ? `<div style="font-size:9px;color:var(--text-dim);margin-top:2px">${state.lang === 'fr' ? m.desc_fr : m.desc_en}</div>` : ''}
          <div style="background:var(--bg);border-radius:3px;height:6px;margin-top:4px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${complete ? 'var(--green)' : 'var(--red)'};transition:width .3s"></div>
          </div>
          <div style="font-size:9px;color:var(--text-dim);margin-top:2px">${progress}/${m.target} — ${rewardStr.join(', ')}</div>
        </div>
        ${complete && !claimed
          ? `<button class="btn-claim-mission" data-mission-id="${m.id}" style="font-family:var(--font-pixel);font-size:9px;padding:6px 12px;background:var(--green);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--bg);cursor:pointer;white-space:nowrap;animation:glow 1.5s ease-in-out infinite">${state.lang === 'fr' ? 'Récupérer' : 'Claim'}</button>`
          : claimed
          ? '<span style="font-size:9px;color:var(--green)">✓</span>'
          : ''}
      </div>`;
    }
    html += '</div>';
    return html;
  };

  // Daily reset countdown
  const dailyRem = Math.max(0, 86400000 - (Date.now() - state.missions.daily.reset));
  const dailyH = Math.floor(dailyRem / 3600000);
  const dailyM = Math.floor((dailyRem % 3600000) / 60000);
  const weeklyRem = Math.max(0, 604800000 - (Date.now() - state.missions.weekly.reset));
  const weeklyD = Math.floor(weeklyRem / 86400000);
  const weeklyH = Math.floor((weeklyRem % 86400000) / 3600000);

  const dailyMissions = MISSIONS.filter(m => m.type === 'daily');
  const weeklyMissions = MISSIONS.filter(m => m.type === 'weekly');
  const storyMissions = MISSIONS.filter(m => m.type === 'story');
  const unclaimedStory = storyMissions.filter(m => !isMissionClaimed(m));
  const claimedStory = storyMissions.filter(m => isMissionClaimed(m));

  let content = '';
  content += renderSection(
    `${state.lang === 'fr' ? 'Missions Quotidiennes' : 'Daily Missions'} (${dailyH}h${String(dailyM).padStart(2,'0')})`,
    dailyMissions
  );
  content += renderSection(
    `${state.lang === 'fr' ? 'Missions Hebdomadaires' : 'Weekly Missions'} (${weeklyD}j ${weeklyH}h)`,
    weeklyMissions
  );
  if (unclaimedStory.length > 0) {
    content += renderSection(
      state.lang === 'fr' ? 'Histoire & Objectifs' : 'Story & Objectives',
      unclaimedStory
    );
  }
  if (claimedStory.length > 0) {
    content += renderSection(
      state.lang === 'fr' ? 'Terminés' : 'Completed',
      claimedStory
    );
  }

  // ── Bouton "Tout réclamer" ──
  const claimableMissions = MISSIONS.filter(m => isMissionComplete(m) && !isMissionClaimed(m));
  const claimAllBtn = claimableMissions.length > 0
    ? `<button id="btnClaimAllMissions" style="font-family:var(--font-pixel);font-size:9px;padding:7px 16px;background:var(--green);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--bg);cursor:pointer;margin-bottom:14px;animation:glow 1.5s ease-in-out infinite">✓ Tout réclamer (${claimableMissions.length})</button>`
    : '';
  el.innerHTML = `<div style="padding:12px">${claimAllBtn}${content}</div>`;
  if (claimableMissions.length > 0) {
    document.getElementById('btnClaimAllMissions')?.addEventListener('click', () => {
      claimableMissions.forEach(m => claimMission(m));
      saveState(); updateTopBar();
      renderMissionsTab();
    });
  }

  // Claim buttons
  el.querySelectorAll('.btn-claim-mission').forEach(btn => {
    btn.addEventListener('click', () => {
      const mission = MISSIONS.find(m => m.id === btn.dataset.missionId);
      if (mission) {
        claimMission(mission);
        renderMissionsTab();
      }
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 18d. UI — BAG TAB
// ════════════════════════════════════════════════════════════════

function openRareCandyPicker() {
  if ((state.inventory.rarecandy || 0) <= 0) return;

  // Build candidate list: team pokemon first, then others, all below lv100
  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));

  const candidates = state.pokemons
    .filter(p => p.level < 100)
    .sort((a, b) => {
      const aTeam = teamIds.has(a.id) ? 1 : 0;
      const bTeam = teamIds.has(b.id) ? 1 : 0;
      if (bTeam !== aTeam) return bTeam - aTeam;
      return getPokemonPower(b) - getPokemonPower(a);
    });

  if (candidates.length === 0) {
    notify(state.lang === 'fr' ? 'Tous les Pokémon sont au max !' : 'All Pokémon are maxed!');
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'rareCandyOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease';

  const listHtml = candidates.slice(0, 25).map(p => {
    const inTeam = teamIds.has(p.id);
    return `<div class="picker-pokemon" data-candy-id="${p.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border);cursor:pointer">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:40px;height:40px">
      <div style="flex:1">
        <div style="font-size:12px">${inTeam ? '[EQ] ' : ''}${speciesName(p.species_en)} ${'*'.repeat(p.potential)}${p.shiny ? ' [S]' : ''}</div>
        <div style="font-size:10px;color:var(--text-dim)">Lv.${p.level} → Lv.~${Math.min(100, p.level + 5)}</div>
      </div>
      ${inTeam ? '<span style="font-size:9px;color:var(--green)">Équipe</span>' : ''}
    </div>`;
  }).join('');

  overlay.innerHTML = `<div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);width:90%;max-width:380px;max-height:70vh;display:flex;flex-direction:column">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:2px solid var(--border)">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">🍬 Super Bonbon — stock: ${state.inventory.rarecandy}</div>
      <button id="btnCloseCandy" style="background:none;border:none;color:var(--text-dim);font-size:20px;cursor:pointer">&times;</button>
    </div>
    <div style="overflow-y:auto;flex:1">${listHtml}</div>
  </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#btnCloseCandy').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelectorAll('[data-candy-id]').forEach(el => {
    el.addEventListener('mouseenter', () => { el.style.background = 'var(--bg-hover)'; });
    el.addEventListener('mouseleave', () => { el.style.background = ''; });
    el.addEventListener('click', () => {
      if ((state.inventory.rarecandy || 0) <= 0) { overlay.remove(); return; }
      const p = state.pokemons.find(pk => pk.id === el.dataset.candyId);
      if (!p) return;
      const oldLv = p.level;
      state.inventory.rarecandy--;
      if (p.level < 100) { p.level++; p.xp = 0; p.stats = calculateStats(p); tryAutoEvolution(p); }
      saveState();
      notify(`🍬 ${speciesName(p.species_en)} Lv.${oldLv} → Lv.${p.level}`, 'gold');
      overlay.remove();
      renderBagTab();
      if (activeTab === 'tabPC') renderPCTab();
      updateTopBar();
    });
  });
}

function renderBagTab() {
  const grid = document.getElementById('bagGrid');
  if (!grid) return;

  const items = [
    { id: 'pokeball',  icon: 'PB', fr: 'Poke Ball',      en: 'Poke Ball',      desc_fr: 'Ball standard',         desc_en: 'Standard ball' },
    { id: 'greatball', icon: 'GB', fr: 'Super Ball',      en: 'Great Ball',     desc_fr: 'Meilleur potentiel',    desc_en: 'Better potential' },
    { id: 'ultraball', icon: 'UB', fr: 'Hyper Ball',      en: 'Ultra Ball',     desc_fr: 'Excellent potentiel',   desc_en: 'Excellent potential' },
    { id: 'duskball',  icon: 'DB', fr: 'Sombre Ball',     en: 'Dusk Ball',      desc_fr: 'Potentiel equilibre',   desc_en: 'Balanced potential' },
    { id: 'lure',      icon: 'LR', fr: 'Leurre',          en: 'Lure',           desc_fr: 'x2 spawns 60s',         desc_en: 'x2 spawns 60s',      usable: true },
    { id: 'superlure', icon: 'SL', fr: 'Super Leurre',    en: 'Super Lure',     desc_fr: 'x3 spawns 60s',         desc_en: 'x3 spawns 60s',      usable: true },
    { id: 'incense',   icon: 'IN', fr: 'Encens Chance',   en: 'Lucky Incense',  desc_fr: '*+1 potentiel 90s',     desc_en: '*+1 potential 90s',  usable: true },
    { id: 'rarescope', icon: 'SC', fr: 'Rarioscope',       en: 'Rare Scope',     desc_fr: 'Spawns rares x3 90s',   desc_en: 'Rare spawns x3 90s', usable: true },
    { id: 'aura',      icon: 'AU', fr: 'Aura Shiny',       en: 'Shiny Aura',     desc_fr: 'Shiny x5 90s',          desc_en: 'Shiny x5 90s',       usable: true },
    { id: 'evostone',  icon: 'EV', fr: 'Pierre Evol.',     en: 'Evo Stone',      desc_fr: 'Evolution par pierre',  desc_en: 'Stone evolution' },
    { id: 'rarecandy', icon: 'RC', fr: 'Super Bonbon',     en: 'Rare Candy',     desc_fr: '+1 niveau',              desc_en: '+1 level',          usable: true },
    { id: 'masterball',icon: 'MB', fr: 'Master Ball',      en: 'Master Ball',    desc_fr: '***** garanti',         desc_en: '***** guaranteed' },
  ];

  grid.innerHTML = items.map(item => {
    const qty = state.inventory[item.id] || 0;
    const name = state.lang === 'fr' ? item.fr : item.en;
    const desc = state.lang === 'fr' ? item.desc_fr : item.desc_en;
    const active = isBoostActive(item.id);
    const remaining = active ? boostRemaining(item.id) : 0;
    return `<div class="bag-item" ${active ? 'style="border-color:var(--gold)"' : ''}>
      <span class="bag-icon">${itemSprite(item.id)}</span>
      <div class="bag-info">
        <div class="bag-name">${name}</div>
        <div class="bag-qty">x${qty}${active ? ` (${remaining}s)` : ''}</div>
        <div class="bag-desc">${desc}</div>
      </div>
      ${item.usable && qty > 0 ? `<button class="bag-use-btn" data-use-item="${item.id}">${state.lang === 'fr' ? 'Utiliser' : 'Use'}</button>` : ''}
    </div>`;
  }).join('');

  // Active ball selector
  grid.innerHTML += `
    <div class="bag-item" style="grid-column:1/-1;border-color:var(--gold-dim)">
      <span class="bag-icon">🎯</span>
      <div class="bag-info">
        <div class="bag-name">${state.lang === 'fr' ? 'Ball active' : 'Active Ball'}</div>
        <div class="bag-desc">${state.lang === 'fr' ? 'Ball utilisée pour les captures' : 'Ball used for captures'}</div>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${Object.entries(BALLS).map(([key, ball]) => `
          <button style="font-size:9px;padding:3px 8px;border-radius:4px;cursor:pointer;
            background:${state.activeBall === key ? 'var(--red-dark)' : 'var(--bg)'};
            border:1px solid ${state.activeBall === key ? 'var(--red)' : 'var(--border)'};
            color:var(--text)" data-bag-ball="${key}">
            ${state.lang === 'fr' ? ball.fr : ball.en} (${state.inventory[key] || 0})
          </button>
        `).join('')}
      </div>
    </div>`;

  // Bind use buttons
  grid.querySelectorAll('[data-use-item]').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.useItem;
      if (itemId === 'rarecandy') {
        openRareCandyPicker();
      } else if (activateBoost(itemId)) {
        notify(state.lang === 'fr' ? 'Boost activé !' : 'Boost activated!', 'success');
      }
      renderBagTab();
    });
  });

  // Ball selector
  grid.querySelectorAll('[data-bag-ball]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeBall = btn.dataset.bagBall;
      saveState();
      renderBagTab();
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 19.  UI — INTRO OVERLAY
// ════════════════════════════════════════════════════════════════

// ── Hub-Import helpers ────────────────────────────────────────────────────────

/**
 * Upgrades every 4★ pokémon to 5★ automatically.
 * Priority: shiny first → highest level → PC order (array index).
 * Note: shinies can't be used as recipe material in-game, but here
 * we just bulk-upgrade all 4★, shinies first (they benefit most).
 * Returns the number of pokémon mutated.
 */
function applyAutoMutation(pokemons) {
  const candidates = pokemons
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => p.potential === 4);

  // Sort: shiny first → level desc → PC order
  candidates.sort((a, b) => {
    const aS = a.p.shiny ? 1 : 0, bS = b.p.shiny ? 1 : 0;
    if (bS !== aS) return bS - aS;
    const aL = a.p.level ?? 0, bL = b.p.level ?? 0;
    if (bL !== aL) return bL - aL;
    return a.idx - b.idx;
  });

  for (const { p } of candidates) p.potential = 5;
  return candidates.length;
}

/**
 * Removes zone states for zone IDs no longer present in the current ZONES list.
 * Returns the number of orphan zones removed.
 */
function cleanObsoleteData(s) {
  const validIds = new Set(ZONES.map(z => z.id));
  let removed = 0;
  if (s.zones) {
    for (const zoneId of Object.keys(s.zones)) {
      if (!validIds.has(zoneId)) {
        delete s.zones[zoneId];
        removed++;
      }
    }
  }
  return removed;
}

/**
 * Hub-screen slot repair modal.
 * Lets the user pick a slot and re-applies migrate() + cleanups on it.
 */
function openHubSlotRepairModal() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';

  const slotHtml = [0, 1, 2].map(i => {
    const prev = getSlotPreview(i);
    const label = prev
      ? `<b style="color:var(--text)">${prev.name}</b> <span style="color:var(--text-dim);font-size:9px">(${prev.pokemon} pkm · ⭐${prev.rep})</span>`
      : `<span style="color:#555;font-style:italic">Vide</span>`;
    return `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;background:var(--bg);${!prev ? 'opacity:.4;pointer-events:none' : ''}">
      <input type="radio" name="repairTargetSlot" value="${i}" ${i === activeSaveSlot ? 'checked' : ''} ${!prev ? 'disabled' : ''} style="accent-color:#ffa000">
      <span style="font-family:var(--font-pixel);font-size:8px;color:#ffa000">SLOT ${i+1}</span>
      <span style="font-size:10px">${label}</span>
    </label>`;
  }).join('');

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid #ffa000;border-radius:var(--radius);padding:24px;max-width:480px;width:100%;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-family:var(--font-pixel);font-size:11px;color:#ffa000">🔧 Réparer un slot</div>
        <button id="btnRepairSlotClose" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
      </div>
      <div style="font-size:9px;color:var(--text-dim);line-height:1.5">
        Réapplique toutes les migrations, corrige les champs manquants et nettoie les incohérences.
        <b style="color:var(--text)">Tes données ne seront pas effacées.</b>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">${slotHtml}</div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button id="btnRepairSlotConfirm" style="flex:1;font-family:var(--font-pixel);font-size:9px;padding:10px;background:var(--bg);border:2px solid #ffa000;border-radius:var(--radius-sm);color:#ffa000;cursor:pointer">
          🔧 Réparer ce slot
        </button>
        <button id="btnRepairSlotCancel" style="font-family:var(--font-pixel);font-size:8px;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
          Annuler
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#btnRepairSlotClose')?.addEventListener('click',  () => overlay.remove());
  overlay.querySelector('#btnRepairSlotCancel')?.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#btnRepairSlotConfirm')?.addEventListener('click', () => {
    const targetSlot = parseInt(overlay.querySelector('input[name="repairTargetSlot"]:checked')?.value ?? activeSaveSlot);
    const raw = localStorage.getItem(SAVE_KEYS[targetSlot]);
    if (!raw) { notify('Slot vide — rien à réparer.', 'error'); overlay.remove(); return; }

    showConfirm(`Réparer le Slot ${targetSlot + 1} ?<br><span style="color:var(--text-dim);font-size:10px">Toutes les migrations seront réappliquées. Données intactes.</span>`, () => {
      try {
        const parsed = JSON.parse(raw);
        // Re-run migrate
        const fixed = migrate(parsed);
        // Trim histories
        let histTrimmed = 0;
        for (const p of fixed.pokemons || []) {
          if (p.history && p.history.length > MAX_HISTORY) {
            histTrimmed += p.history.length - MAX_HISTORY;
            p.history = p.history.slice(-MAX_HISTORY);
          }
        }
        // Ghost IDs
        const allIds = new Set((fixed.pokemons || []).map(p => p.id));
        fixed.gang.bossTeam = (fixed.gang.bossTeam || []).filter(id => allIds.has(id));
        if (fixed.pension?.slots) fixed.pension.slots = fixed.pension.slots.filter(id => allIds.has(id));
        if (fixed.trainingRoom?.pokemon) fixed.trainingRoom.pokemon = fixed.trainingRoom.pokemon.filter(id => allIds.has(id));
        // Invalid title slots
        const allTitleIds = new Set((TITLES || []).map(t => t.id));
        ['titleA','titleB','titleC','titleD'].forEach(slot => {
          if (fixed.gang[slot] && !allTitleIds.has(fixed.gang[slot])) fixed.gang[slot] = null;
        });

        localStorage.setItem(SAVE_KEYS[targetSlot], JSON.stringify(fixed));

        // If we just repaired the active slot, reload state
        if (targetSlot === activeSaveSlot) {
          state = fixed;
          saveState();
        }

        overlay.remove();
        notify(`✅ Slot ${targetSlot + 1} réparé.${histTrimmed > 0 ? ` ${histTrimmed} entrées d'historique nettoyées.` : ''}`, 'success');

        // Refresh hub
        const introOverlay = document.getElementById('introOverlay');
        if (introOverlay?.classList.contains('active')) {
          introOverlay.classList.remove('active');
          showIntro();
        }
      } catch (err) {
        notify('Erreur lors de la réparation — slot non modifié.', 'error');
        console.error(err);
      }
    }, null, { confirmLabel: 'Réparer', cancelLabel: 'Annuler' });
  });
}

/**
 * Hub-screen import modal.
 * Shows a save preview, a slot destination picker and optional cleanup options,
 * then writes the migrated save to the chosen slot.
 */
function openHubImportModal(raw) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';

  // ── Save preview data ────────────────────────────────────────────────────
  const gangName    = raw.gang?.name     ?? '—';
  const bossName    = raw.gang?.bossName ?? '—';
  const reputation  = (raw.gang?.reputation ?? 0).toLocaleString();
  const money       = (raw.gang?.money ?? 0).toLocaleString();
  const pokeCount   = (raw.pokemons  || []).length;
  const count4star  = (raw.pokemons  || []).filter(p => p.potential === 4).length;
  const count4shiny = (raw.pokemons  || []).filter(p => p.potential === 4 && p.shiny).length;
  const agentCount  = (raw.agents    || []).length;
  const rawDex      = raw.pokedex || {};
  const dexKanto    = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151 && rawDex[s.en]?.caught).length;
  const dexNat      = POKEMON_GEN1.filter(s => !s.hidden && rawDex[s.en]?.caught).length;
  const shinyCount  = POKEMON_GEN1.filter(s => !s.hidden && rawDex[s.en]?.shiny).length;
  const savedAt     = raw._savedAt ? new Date(raw._savedAt).toLocaleString('fr-FR') : '—';
  const playtime    = raw.playtime  ? formatPlaytime(raw.playtime) : '—';
  const schemaVer   = raw._schemaVersion ?? raw.version ?? '?';

  // Detect potential orphan zones
  const validIds = new Set(ZONES.map(z => z.id));
  const orphanZones = Object.keys(raw.zones || {}).filter(id => !validIds.has(id));

  // ── Slot picker HTML ─────────────────────────────────────────────────────
  const slotHtml = [0, 1, 2].map(i => {
    const prev = getSlotPreview(i);
    const label = prev
      ? `<b style="color:var(--text)">${prev.name}</b> <span style="color:var(--text-dim);font-size:9px">(${prev.pokemon} pkm · ⭐${prev.rep})</span>`
      : `<span style="color:#555;font-style:italic">Vide</span>`;
    return `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;background:var(--bg);transition:border-color .15s" id="hubSlotLabel${i}">
      <input type="radio" name="hubTargetSlot" value="${i}" ${i === 0 ? 'checked' : ''} style="accent-color:var(--gold)">
      <span style="font-family:var(--font-pixel);font-size:8px;color:var(--gold)">SLOT ${i+1}</span>
      <span style="font-size:10px">${label}</span>
    </label>`;
  }).join('');

  // ── Warnings ─────────────────────────────────────────────────────────────
  const warnMutation = count4star > 0
    ? `<span style="color:#ffa040">${count4star} Pokémon 4★ détectés${count4shiny > 0 ? ` (dont ${count4shiny} ✨ shiny)` : ''} — tous passeront en 5★</span>`
    : `<span style="color:var(--text-dim)">Aucun Pokémon 4★ détecté</span>`;
  const warnClean = orphanZones.length > 0
    ? `<span style="color:#ffa040">${orphanZones.length} zone(s) obsolète(s) supprimée(s)</span>`
    : `<span style="color:var(--text-dim)">Aucune zone obsolète</span>`;

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid #ffa040;border-radius:var(--radius);padding:24px;max-width:640px;width:100%;max-height:92vh;overflow-y:auto;display:flex;flex-direction:column;gap:16px">

      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-family:var(--font-pixel);font-size:11px;color:#ffa040">📥 Importer une Save</div>
        <button id="btnHubImportClose" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
      </div>

      <!-- Save preview -->
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:6px">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:4px">SAVE IMPORTÉE</div>
        <div style="font-family:var(--font-pixel);font-size:13px;color:var(--red)">${gangName}</div>
        <div style="font-size:9px;color:var(--text-dim)">Boss : <span style="color:var(--text)">${bossName}</span></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:4px">
          <div style="font-size:8px;color:var(--text-dim)">🎯 Pokémon <span style="color:var(--text)">${pokeCount}</span></div>
          <div style="font-size:8px;color:var(--text-dim)">👤 Agents <span style="color:var(--text)">${agentCount}</span></div>
          <div style="font-size:8px;color:var(--text-dim)">⭐ Rép. <span style="color:var(--gold)">${reputation}</span></div>
          <div style="font-size:8px;color:var(--text-dim)">₽ <span style="color:var(--text)">${money}</span></div>
          <div style="font-size:8px;color:var(--text-dim)">📖 Pokédex Kanto <span style="color:var(--text)">${dexKanto}/151</span> <span style="opacity:.6">(Nat. ${dexNat})</span></div>
          <div style="font-size:8px;color:var(--text-dim)">✨ Espèces chroma <span style="color:var(--text)">${shinyCount}</span></div>
        </div>
        <div style="font-size:7px;color:var(--text-dim);border-top:1px solid var(--border);padding-top:6px;margin-top:2px">
          Sauvegardé le ${savedAt} · Temps de jeu : ${playtime} · Schéma v${schemaVer}
        </div>
      </div>

      <!-- Slot picker -->
      <div>
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);margin-bottom:8px;letter-spacing:1px">SLOT DE DESTINATION</div>
        <div style="display:flex;flex-direction:column;gap:6px" id="hubSlotPicker">
          ${slotHtml}
        </div>
      </div>

      <!-- Options -->
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);letter-spacing:1px">OPTIONS D'IMPORT</div>

        <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);cursor:pointer">
          <input type="checkbox" id="chkAutoMutation" ${count4star > 0 ? 'checked' : ''} style="margin-top:2px;accent-color:var(--gold)">
          <div>
            <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text);margin-bottom:3px">⚡ Mutation auto 4★ → 5★</div>
            <div style="font-size:9px;color:var(--text-dim)">Améliore tous les Pokémon 4★ en 5★ automatiquement.<br>Priorité : ✨ shiny → niveau → ordre PC. Les shinys ne seront jamais utilisés comme matière première.</div>
            <div style="font-size:8px;margin-top:4px">${warnMutation}</div>
          </div>
        </label>

        <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);cursor:pointer">
          <input type="checkbox" id="chkCleanObsolete" ${orphanZones.length > 0 ? 'checked' : ''} style="margin-top:2px;accent-color:var(--gold)">
          <div>
            <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text);margin-bottom:3px">🧹 Nettoyage des données obsolètes</div>
            <div style="font-size:9px;color:var(--text-dim)">Supprime les zones, états et environnements qui n'existent plus dans la version actuelle du jeu.<br>Ces données seront remplacées par <i>"information perdue avec le temps"</i>.</div>
            <div style="font-size:8px;margin-top:4px">${warnClean}</div>
          </div>
        </label>
      </div>

      <!-- Warning -->
      <div style="background:rgba(255,140,0,.08);border:1px solid rgba(255,140,0,.3);border-radius:var(--radius-sm);padding:10px;font-size:9px;color:var(--text-dim)">
        ⚠ Le slot de destination sera <b style="color:#ffa040">écrasé</b>. Exporte ta save actuelle si tu veux la conserver.
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:8px">
        <button id="btnHubImportBackup" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:10px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
          💾 Exporter ma save actuelle
        </button>
        <button id="btnHubImportConfirm" style="flex:2;font-family:var(--font-pixel);font-size:9px;padding:10px;background:var(--bg);border:2px solid #ffa040;border-radius:var(--radius-sm);color:#ffa040;cursor:pointer">
          📥 Importer dans ce slot
        </button>
      </div>
      <button id="btnHubImportCancel" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
        Annuler
      </button>

    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#btnHubImportClose')?.addEventListener('click',  () => overlay.remove());
  overlay.querySelector('#btnHubImportCancel')?.addEventListener('click', () => overlay.remove());

  // Slot label hover effect
  overlay.querySelectorAll('#hubSlotPicker label').forEach(lbl => {
    lbl.addEventListener('mouseenter', () => lbl.style.borderColor = '#ffa040');
    lbl.addEventListener('mouseleave', () => lbl.style.borderColor = 'var(--border)');
  });

  overlay.querySelector('#btnHubImportBackup')?.addEventListener('click', () => {
    exportSave();
    const btn = overlay.querySelector('#btnHubImportBackup');
    btn.textContent = '✅ Save exportée !';
    btn.style.color = 'var(--green)';
  });

  overlay.querySelector('#btnHubImportConfirm')?.addEventListener('click', () => {
    const targetSlot = parseInt(overlay.querySelector('input[name="hubTargetSlot"]:checked')?.value ?? '0');
    const doMutation = overlay.querySelector('#chkAutoMutation')?.checked ?? false;
    const doClean    = overlay.querySelector('#chkCleanObsolete')?.checked ?? false;

    showConfirm(
      `Importer la save de <b>${gangName}</b> dans le Slot ${targetSlot + 1} ?<br><span style="color:var(--text-dim);font-size:10px">Le contenu actuel du slot sera effacé.</span>`,
      () => {
        try {
          // Deep clone before mutation
          const draft = JSON.parse(JSON.stringify(raw));

          // Apply optional steps before migration
          let mutated = 0, cleaned = 0;
          if (doMutation && draft.pokemons) mutated = applyAutoMutation(draft.pokemons);
          if (doClean)                      cleaned  = cleanObsoleteData(draft);

          // Full migration to current schema
          const migrated = migrate(draft);

          // Add cleaned-zone log if relevant
          if (doClean && cleaned > 0) {
            if (!migrated.behaviourLogs) migrated.behaviourLogs = {};
            migrated.behaviourLogs._importCleanedZones = cleaned;
            // Add a visible log to pokedex area isn't natural — add a note to notifications array if present
            if (!migrated._importNotes) migrated._importNotes = [];
            migrated._importNotes.push(`information perdue avec le temps (${cleaned} zone(s) obsolète(s) supprimée(s))`);
          }

          // Save to the target slot (don't affect current active game)
          localStorage.setItem(SAVE_KEYS[targetSlot], JSON.stringify(migrated));

          overlay.remove();

          // Compose summary message
          const parts = [`✅ Save de "${gangName}" importée dans le Slot ${targetSlot + 1}.`];
          if (mutated > 0) parts.push(`⚡ ${mutated} Pokémon 4★ → 5★.`);
          if (cleaned > 0) parts.push(`🧹 ${cleaned} zone(s) obsolète(s) supprimée(s).`);
          parts.push('Clique ▶ sur le slot pour jouer.');
          notify(parts.join(' '), 'success');

          // Refresh hub slot display if introOverlay is visible
          const introSlots = document.getElementById('introSlots');
          if (introSlots) {
            // Re-trigger showIntro rendering by dispatching a custom event, or simply reload slots
            // We call the global renderSlots if accessible — it's locally scoped, so refresh the overlay
            const introOverlay = document.getElementById('introOverlay');
            if (introOverlay?.classList.contains('active')) {
              // Remove active class to reset, then re-show
              introOverlay.classList.remove('active');
              showIntro();
            }
          }
        } catch (err) {
          notify('Erreur lors de l\'importation — save non modifiée.', 'error');
          console.error(err);
        }
      },
      null,
      { confirmLabel: 'Importer', cancelLabel: 'Annuler' }
    );
  });
}

function showIntro() {
  const overlay = document.getElementById('introOverlay');
  if (!overlay) return;
  overlay.classList.add('active');

  // ── Settings gear button ──────────────────────────────────────
  document.getElementById('introSettingsBtn')?.addEventListener('click', () => {
    openSettingsModal();
  });

  // ── Animated showcase ─────────────────────────────────────────
  const SHOWCASE_SCENES = [
    {
      key: 'capture',
      render: () => {
        const poke = 'pikachu';
        return `
          <div class="intro-scene-title">Capturez des Pokémon rares</div>
          <div class="intro-scene-sprites" style="flex-direction:column;gap:8px">
            <img src="${pokeSprite(poke)}" style="animation:pokeBounce 1s ease-in-out infinite;image-rendering:pixelated;width:64px;height:64px">
            <div style="font-size:18px;animation:pokeballFall 1.2s ease forwards">⚪</div>
          </div>
          <div class="intro-scene-desc">Des centaines d'espèces à attraper</div>`;
      }
    },
    {
      key: 'combat',
      render: () => {
        return `
          <div class="intro-scene-title">Combattez des Dresseurs</div>
          <div class="intro-scene-sprites" style="gap:12px;align-items:flex-end">
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
              <img src="${trainerSprite('red')}" style="animation:trainerLeft 1.2s ease-in-out infinite;image-rendering:pixelated;width:56px;height:56px">
              <div class="intro-hp-bar"><div class="intro-hp-fill" id="introHpLeft" style="width:70%;background:#4c4"></div></div>
            </div>
            <div style="font-family:var(--font-pixel);font-size:10px;color:var(--red);align-self:center">VS</div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
              <img src="${trainerSprite('lance')}" style="animation:trainerRight 1.2s ease-in-out infinite 0.3s;image-rendering:pixelated;width:56px;height:56px">
              <div class="intro-hp-bar"><div class="intro-hp-fill" id="introHpRight" style="width:40%;background:#c44"></div></div>
            </div>
          </div>
          <div class="intro-scene-desc">Montez en puissance et dominez</div>`;
      }
    },
    {
      key: 'gang',
      render: () => {
        return `
          <div class="intro-scene-title">Développez votre Gang</div>
          <div class="intro-scene-sprites" style="gap:16px">
            <img src="${trainerSprite('giovanni')}" style="image-rendering:pixelated;width:56px;height:56px">
            <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start">
              <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">RÉPUTATION</div>
              <div style="font-size:22px;font-family:var(--font-pixel);color:var(--gold);animation:repTick .5s ease-in-out infinite alternate" id="introRepCounter">1 337</div>
              <div style="font-size:10px;color:var(--text-dim)">Agents: 5 &nbsp;|&nbsp; Zones: 4</div>
            </div>
          </div>
          <div class="intro-scene-desc">Conquiers Kanto, un territoire à la fois</div>`;
      }
    }
  ];

  let sceneIdx = 0;
  let showcaseInterval = null;

  const renderScene = (idx) => {
    const container = document.getElementById('introSceneContainer');
    if (!container) return;
    container.innerHTML = SHOWCASE_SCENES[idx].render();
    container.style.animation = 'none';
    container.offsetHeight; // reflow
    container.style.animation = 'sceneIn .4s ease';
    // Update dots
    const dots = document.querySelectorAll('#introSceneDots .intro-dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  };

  renderScene(0);
  showcaseInterval = setInterval(() => {
    sceneIdx = (sceneIdx + 1) % SHOWCASE_SCENES.length;
    renderScene(sceneIdx);
  }, 3000);

  // Stop interval when overlay closes
  const stopShowcase = () => {
    if (showcaseInterval) { clearInterval(showcaseInterval); showcaseInterval = null; }
  };

  // ── Save slots ────────────────────────────────────────────────
  let selectedSlotIdx = 0; // default new game slot
  const slotsContainer = document.getElementById('introSlots');
  const renderSlots = () => {
    if (!slotsContainer) return;
    slotsContainer.innerHTML = [0, 1, 2].map(i => {
      const preview = getSlotPreview(i);
      if (preview) {
        const d = new Date(preview.ts);
        const dateStr = preview.ts ? d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '—';
        const teamSpritesHtml = (preview.teamSprites || []).map(sp =>
          `<img class="isc-mini" src="${pokeSprite(sp)}" alt="${sp}" onerror="this.style.display='none'">`
        ).join('');
        const agentSpritesHtml = (preview.agentSprites || []).map(url =>
          `<img class="isc-mini" src="${url}" alt="" onerror="this.style.display='none'">`
        ).join('');
        return `<div class="intro-slot-card has-data" data-slot="${i}">
          <div class="isc-left">
            <div class="isc-slot-label">SLOT ${i+1}</div>
            <div class="isc-boss-wrap">
              ${preview.bossSprite ? `<img src="${trainerSprite(preview.bossSprite)}" style="width:52px;height:52px;image-rendering:pixelated" onerror="this.style.display='none'">` : '<div style="width:52px;height:52px;background:var(--bg);border-radius:4px;opacity:.3"></div>'}
              <span class="isc-boss-badge"><img src="https://lab.sterenna.fr/PG/pokegang_logo/pokegang_logo_little.png" alt=""></span>
            </div>
          </div>
          <div class="isc-info">
            <div class="isc-gang-name">${preview.name}</div>
            <div class="isc-boss-name">Boss : ${preview.bossName || '—'} · ${preview.agentCount || 0} agent${(preview.agentCount || 0) > 1 ? 's' : ''}</div>
            <div class="isc-meta">${preview.pokemon} Pkm · ₽${(preview.money||0).toLocaleString()} · ⭐${preview.rep}</div>
            <div class="isc-date">${dateStr}${preview.playtime ? ' · ' + formatPlaytime(preview.playtime) : ''}</div>
            <div class="isc-sprites-row">
              <div class="isc-sprites-group">
                <span class="isc-sprites-label">Équipe</span>
                ${teamSpritesHtml || '<span style="font-size:8px;color:#555">—</span>'}
              </div>
              ${agentSpritesHtml ? `<div class="isc-sprites-group" style="opacity:.72">
                <span class="isc-sprites-label">Agents</span>
                ${agentSpritesHtml}
              </div>` : ''}
            </div>
          </div>
          <div class="isc-actions">
            <button class="isc-btn isc-play" data-slot="${i}" title="Jouer">▶</button>
            <button class="isc-btn isc-del" data-slot="${i}" title="Supprimer">🗑</button>
          </div>
        </div>`;
      } else {
        const isSelected = selectedSlotIdx === i;
        return `<div class="intro-slot-card empty${isSelected ? ' selected-new' : ''}" data-slot="${i}" data-empty="1">
          <div class="isc-left">
            <div class="isc-slot-label">SLOT ${i+1}</div>
            <div style="font-size:22px;opacity:.2">💾</div>
          </div>
          <div class="isc-info">
            <div style="font-size:10px;color:#555">Vide — cliquer pour nouvelle partie</div>
          </div>
          <div class="isc-actions">
            <button class="isc-btn isc-new" data-slot="${i}" title="Sélectionner">✓</button>
          </div>
        </div>`;
      }
    }).join('');

    // Handlers
    slotsContainer.querySelectorAll('.isc-play').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.slot);
        stopShowcase();
        loadSlot(idx);
        overlay.classList.remove('active');
        renderAll();
      });
    });
    slotsContainer.querySelectorAll('.isc-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.slot);
        showConfirm(`Supprimer la sauvegarde Slot ${idx+1} ?<br><span style="color:var(--text-dim);font-size:11px">Cette action est irréversible.</span>`, () => {
          localStorage.removeItem(SAVE_KEYS[idx]);
          if (idx === activeSaveSlot) {
            activeSaveSlot = 0;
            SAVE_KEY = SAVE_KEYS[0];
            localStorage.setItem('pokeforge.activeSlot', '0');
          }
          renderSlots();
        }, null, { danger: true, confirmLabel: 'Supprimer', cancelLabel: 'Annuler' });
      });
    });
    slotsContainer.querySelectorAll('.isc-new, .intro-slot-card.empty').forEach(btn => {
      btn.addEventListener('click', e => {
        const el = btn.closest ? btn.closest('[data-slot]') : btn;
        const idx = parseInt((el || btn).dataset.slot);
        if (idx !== undefined && !isNaN(idx)) {
          selectedSlotIdx = idx;
          renderSlots();
          openNewGameModal(idx);
        }
      });
    });
  };
  renderSlots();

  const newGameModal = document.getElementById('newGameModal');
  const newGameSelectedSlotLabel = document.getElementById('newGameSelectedSlotLabel');
  const closeNewGameModal = () => {
    if (!newGameModal) return;
    newGameModal.classList.remove('active');
    newGameModal.setAttribute('aria-hidden', 'true');
  };
  const openNewGameModal = (slotIdx) => {
    selectedSlotIdx = slotIdx;
    renderSlots();
    if (newGameSelectedSlotLabel) newGameSelectedSlotLabel.textContent = `Slot sélectionné : ${slotIdx + 1}`;
    if (newGameModal) {
      newGameModal.classList.add('active');
      newGameModal.setAttribute('aria-hidden', 'false');
    }
    document.getElementById('inputBossName').value = '';
    document.getElementById('inputGangName').value = '';
    picker?.querySelectorAll('.sprite-option').forEach(o => o.classList.remove('selected'));
    picker?.querySelector('.sprite-option')?.classList.add('selected');
    document.getElementById('inputBossName')?.focus();
  };

  document.getElementById('btnCloseNewGameModal')?.addEventListener('click', closeNewGameModal);
  document.querySelectorAll('[data-close-new-game]').forEach(el => el.addEventListener('click', closeNewGameModal));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && newGameModal?.classList.contains('active')) closeNewGameModal();
  });

  // ── Hub repair button ─────────────────────────────────────────
  document.getElementById('btnHubRepairSlot')?.addEventListener('click', () => openHubSlotRepairModal());

  // ── Hub import button ─────────────────────────────────────────
  document.getElementById('btnHubImportSave')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const parsed = JSON.parse(e.target.result);
          openHubImportModal(parsed);
        } catch {
          notify('Fichier invalide — impossible de lire la save.', 'error');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  });

  // ── Sprite picker ─────────────────────────────────────────────
  const picker = document.getElementById('spritePicker');
  if (picker) {
    picker.innerHTML = BOSS_SPRITES.map(s => `
      <div class="sprite-option" data-sprite="${s}">
        <img src="${trainerSprite(s)}" alt="${s}">
      </div>
    `).join('');
    picker.querySelectorAll('.sprite-option').forEach(opt => {
      opt.addEventListener('click', () => {
        picker.querySelectorAll('.sprite-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });
    picker.querySelector('.sprite-option')?.classList.add('selected');
  }

  // ── Start button ──────────────────────────────────────────────
  document.getElementById('btnStartGame')?.addEventListener('click', () => {
    const bossName = document.getElementById('inputBossName')?.value.trim() || 'Boss';
    const gangName = document.getElementById('inputGangName')?.value.trim() || 'Team Fury';
    const selectedSprite = picker?.querySelector('.sprite-option.selected')?.dataset.sprite || 'rocketgrunt';

    state.gang.bossName = bossName;
    state.gang.name = gangName;
    state.gang.bossSprite = selectedSprite;
    state.gang.initialized = true;
    saveToSlot(selectedSlotIdx);
    closeNewGameModal();
    stopShowcase();
    overlay.classList.remove('active');
    renderAll();
  });
}

// ════════════════════════════════════════════════════════════════
// 19b. BOSS SPRITE VALIDATOR — detect broken sprite on save load
// ════════════════════════════════════════════════════════════════

function checkBossSpriteValidity() {
  if (!state.gang.initialized || !state.gang.bossSprite) return;
  const url = trainerSprite(state.gang.bossSprite);
  const testImg = new Image();
  testImg.onload = () => {}; // fine
  testImg.onerror = () => {
    // Sprite is broken — show picker modal
    showBossSpriteRepairModal();
  };
  testImg.src = url + '?v=' + Date.now(); // cache-bust
}

function showBossSpriteRepairModal() {
  // Avoid opening twice
  if (document.getElementById('spriteRepairModal')) return;

  const modal = document.createElement('div');
  modal.id = 'spriteRepairModal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.85);
    display:flex;align-items:center;justify-content:center;
  `;

  const spriteOptionsHtml = BOSS_SPRITES.map(s =>
    `<div class="sprite-option" data-sprite="${s}" style="
      display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;
      border:2px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;
      background:var(--bg-card);transition:border-color .15s;min-width:60px
    ">
      <img src="${trainerSprite(s)}" style="width:44px;height:44px;image-rendering:pixelated"
           onerror="this.parentElement.style.display='none'">
      <span style="font-family:var(--font-pixel);font-size:6px;color:var(--text-dim)">${s}</span>
    </div>`
  ).join('');

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--red);border-radius:var(--radius);padding:24px;max-width:600px;width:90%;max-height:80vh;display:flex;flex-direction:column;gap:16px">
      <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold)">⚠ Sprite invalide</div>
      <div style="font-size:13px;color:var(--text-dim)">
        ${state.lang === 'fr'
          ? `Le sprite "<b style="color:var(--text)">${state.gang.bossSprite}</b>" est introuvable. Choisis un nouveau sprite pour ton Boss :`
          : `The sprite "<b style="color:var(--text)">${state.gang.bossSprite}</b>" could not be found. Pick a new sprite for your Boss:`
        }
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;overflow-y:auto;max-height:320px;padding:4px">
        ${spriteOptionsHtml}
      </div>
      <button id="spriteRepairConfirm" style="
        font-family:var(--font-pixel);font-size:10px;padding:10px 20px;
        background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius);
        color:var(--text);cursor:pointer;align-self:center
      ">${state.lang === 'fr' ? 'Confirmer' : 'Confirm'}</button>
    </div>
  `;

  document.body.appendChild(modal);

  let selected = BOSS_SPRITES[0];

  // Selection logic
  modal.querySelectorAll('.sprite-option').forEach(opt => {
    opt.addEventListener('click', () => {
      modal.querySelectorAll('.sprite-option').forEach(o => o.style.borderColor = 'var(--border)');
      opt.style.borderColor = 'var(--gold)';
      selected = opt.dataset.sprite;
    });
  });
  // Auto-select first visible
  const firstVisible = modal.querySelector('.sprite-option');
  if (firstVisible) firstVisible.style.borderColor = 'var(--gold)';

  document.getElementById('spriteRepairConfirm').addEventListener('click', () => {
    state.gang.bossSprite = selected;
    saveState();
    modal.remove();
    // Refresh boss sprite displays
    document.querySelectorAll('[data-boss-sprite-img]').forEach(img => {
      img.src = trainerSprite(selected);
    });
    renderAll();
    notify(state.lang === 'fr' ? 'Sprite mis à jour !' : 'Sprite updated!', 'success');
  });
}

// ════════════════════════════════════════════════════════════════
// 20.  UI — SETTINGS MODAL
// ════════════════════════════════════════════════════════════════

// ── SFX individual sound labels ────────────────────────────────
const SFX_LABELS = {
  levelUp:   'Montée de niveau',
  capture:   'Capture',
  evolve:    'Évolution',
  ballThrow: 'Lancer de Ball',
  notify:    'Notification',
  coin:      'Argent / Récolte',
  buy:       'Achat',
  unlock:    'Déverrouillage',
  chest:     'Coffre',
  sell:      'Vente',
  error:     'Erreur',
  click:     'Clic UI',
  tabSwitch: 'Changement onglet',
  menuOpen:  'Ouverture menu',
  menuClose: 'Fermeture menu',
};

// ── Snapshot pour live-preview + revert ─────────────────────────────────────
let _settingsSnap     = null;   // structuredClone(state.settings) au moment d'ouvrir
let _settingsLangSnap = 'fr';   // state.lang au moment d'ouvrir

// Ouvre la fenêtre de paramètres : snapshot + render + bind live
function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;
  _settingsSnap     = structuredClone(state.settings);
  _settingsLangSnap = state.lang;
  renderSettingsPanel();
  _bindSettingsLive();
  modal.classList.add('active');
}

// Applique immédiatement les effets visuels/audio depuis l'UI (working copy)
function _applySettingsLive() {
  const el = document.getElementById('settingsContent');
  if (!el) return;
  const readTog = (id, def) => {
    const b = el.querySelector(`[data-toggle-id="${id}"]`);
    return b ? b.dataset.on === 'true' : def;
  };

  const lightTheme  = readTog('lightTheme', false);
  const lowSpec     = readTog('lowSpec',    false);
  const musicOn     = readTog('music',      false);
  const sfxOn       = readTog('sfx',        true);
  const musicVol    = parseInt(document.getElementById('sVolMusic')?.value)   || 80;
  const sfxVol      = parseInt(document.getElementById('sVolSFX')?.value)     || 80;
  const uiScale     = parseInt(document.getElementById('sUIScale')?.value)    || 100;
  const zoneScale   = parseInt(document.getElementById('sZoneScale')?.value)  || 100;

  // DOM / CSS (effets immédiats)
  document.body.classList.toggle('theme-light', lightTheme);
  document.body.classList.toggle('low-spec',    lowSpec);
  document.documentElement.style.setProperty('--ui-scale',   (uiScale   / 100).toFixed(2));
  document.documentElement.style.setProperty('--zone-scale', (zoneScale / 100).toFixed(2));

  // Musique
  if (musicOn) {
    MusicPlayer.setVolume(musicVol / 1000);
    MusicPlayer.updateFromContext?.();
  } else {
    MusicPlayer.stop();
  }

  // Écriture dans state (working copy — pas encore sauvegardé)
  // spriteMode est écrit directement au clic de la carte (pas besoin de le lire ici)
  Object.assign(state.settings, {
    lightTheme, lowSpec, sfxEnabled: sfxOn, sfxVol,
    musicEnabled: musicOn, musicVol, uiScale, zoneScale,
  });
}

// Restaure l'état d'avant ouverture (bouton ×)
function _revertSettings() {
  if (!_settingsSnap) return;
  state.settings = structuredClone(_settingsSnap);
  state.lang      = _settingsLangSnap;

  const S = state.settings;
  document.body.classList.toggle('theme-light', S.lightTheme === true);
  document.body.classList.toggle('low-spec',    S.lowSpec    === true);
  document.documentElement.style.setProperty('--ui-scale',   ((S.uiScale   ?? 100) / 100).toFixed(2));
  document.documentElement.style.setProperty('--zone-scale', ((S.zoneScale ?? 100) / 100).toFixed(2));
  if (S.musicEnabled) {
    MusicPlayer.setVolume((S.musicVol ?? 80) / 1000);
    MusicPlayer.updateFromContext?.();
  } else {
    MusicPlayer.stop();
  }
}

// Bind tous les listeners live sur les contrôles (appelé après renderSettingsPanel)
function _bindSettingsLive() {
  const el = document.getElementById('settingsContent');
  if (!el) return;

  // Toggles principaux → live apply
  el.querySelectorAll('.s-toggle[data-toggle-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const on = btn.dataset.on !== 'true';
      btn.dataset.on  = String(on);
      btn.textContent = on ? 'Activé' : 'Désactivé';
      _applySettingsLive();
    });
  });

  // SFX individuels → mise à jour working copy immédiate
  el.querySelectorAll('.s-toggle[data-sfx-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const on = btn.dataset.on !== 'true';
      btn.dataset.on  = String(on);
      btn.textContent = on ? 'Activé' : 'Désactivé';
      if (!state.settings.sfxIndividual) state.settings.sfxIndividual = {};
      state.settings.sfxIndividual[btn.dataset.sfxKey] = on;
    });
  });

  // Boutons preview ▶ — joue le son directement (ignore le mute individuel)
  el.querySelectorAll('.sfx-preview-btn[data-sfx-preview]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sfxPreview;
      try { SFX[key]?.(); } catch {}
      // Flash visuel bref
      btn.textContent = '♪';
      setTimeout(() => { btn.textContent = '▶'; }, 400);
    });
  });

  // Sliders → mise à jour du label + apply live
  const bindSlider = (id, labelId, suffix, applyFn) => {
    const slider = document.getElementById(id);
    const label  = document.getElementById(labelId);
    if (!slider) return;
    slider.addEventListener('input', function () {
      if (label) label.textContent = this.value + suffix;
      applyFn?.(this.value);
      _applySettingsLive();
    });
  };
  bindSlider('sVolMusic',  'sVolMusicVal',  '%');
  bindSlider('sVolSFX',    'sVolSFXVal',    '%');
  bindSlider('sUIScale',   'sUIScaleVal',   '%');
  bindSlider('sZoneScale', 'sZoneScaleVal', '%');

  // Accordéon sons individuels
  document.getElementById('btnSfxSubToggle')?.addEventListener('click', () => {
    const inner = document.getElementById('sfxSubList');
    if (inner) {
      inner.classList.toggle('open');
      const arrow = inner.classList.contains('open') ? '▾' : '▸';
      const b = document.getElementById('btnSfxSubToggle');
      if (b) b.textContent = `${arrow} Sons individuels`;
    }
  });

  // Sélecteur sprite mode
  document.getElementById('spriteModeGrid')?.querySelectorAll('.sprite-mode-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.sprite-mode-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.settings.spriteMode = card.dataset.spriteMode;
    });
  });

  // Boutons d'action (export / import / purge / reset / code)
  _bindSettingsActionButtons();

  // Version
  const vEl = document.getElementById('settingsVersion');
  if (vEl) vEl.textContent = GAME_VERSION;
}

// Rendu HTML uniquement (pas de listeners — séparation claire)
function renderSettingsPanel() {
  const el = document.getElementById('settingsContent');
  if (!el) return;

  const S = state.settings;

  const tog = (id, on) =>
    `<button class="s-toggle" data-toggle-id="${id}" data-on="${!!on}">${on ? 'Activé' : 'Désactivé'}</button>`;

  const sfxRows = Object.entries(SFX_LABELS).map(([key, label]) => {
    const on = S.sfxIndividual?.[key] !== false;
    return `<div class="sfx-sub-row">
      <label>${label}</label>
      <div style="display:flex;align-items:center;gap:6px">
        <button class="sfx-preview-btn" data-sfx-preview="${key}" title="Écouter" style="font-family:var(--font-pixel);font-size:9px;padding:2px 7px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;line-height:1">▶</button>
        <button class="s-toggle" data-sfx-key="${key}" data-on="${on}">${on ? 'Activé' : 'Désactivé'}</button>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <!-- Langue -->
    <div class="settings-section">
      <h4>🌐 Langue</h4>
      <div class="settings-row">
        <label>Langue du jeu</label>
        <select id="settingLang">
          <option value="fr" ${S.lang === 'fr' || state.lang === 'fr' ? 'selected' : ''}>Français</option>
          <option value="en" ${state.lang === 'en' ? 'selected' : ''}>English</option>
        </select>
      </div>
    </div>

    <!-- Gameplay -->
    <div class="settings-section">
      <h4>🎮 Gameplay</h4>
      <div class="settings-row">
        <label>Auto-combat agents</label>
        ${tog('autoCombat', S.autoCombat !== false)}
      </div>
      <div class="settings-row">
        <label>Mode Découverte <span style="font-size:.75em;opacity:.6">(tutoriel progressif)</span></label>
        ${tog('discoveryMode', S.discoveryMode !== false)}
      </div>
      <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:8px">
        <label style="margin-bottom:2px">🖼 Mode sprites Pokémon</label>
        ${(() => {
          const SPRITE_MODES = [
            { id:'local', label:'FireRed', sub:'Local HD', img: (() => { const sp = SPECIES_BY_EN['pikachu']; const id = sp?.dex; return (id && typeof getPokemonSprite==='function') ? getPokemonSprite(id,'main') : null; })() },
            { id:'gen1',  label:'Gen 1',  sub:'Rogue/Bleu',     img:`https://play.pokemonshowdown.com/sprites/gen1/pikachu.png` },
            { id:'gen2',  label:'Gen 2',  sub:'Or/Argent',      img:`https://play.pokemonshowdown.com/sprites/gen2/pikachu.png` },
            { id:'gen3',  label:'Gen 3',  sub:'RS/FRLG',        img:`https://play.pokemonshowdown.com/sprites/gen3/pikachu.png` },
            { id:'gen4',  label:'Gen 4',  sub:'DP/Platine',     img:`https://play.pokemonshowdown.com/sprites/gen4/pikachu.png` },
            { id:'gen5',  label:'Gen 5',  sub:'Noir/Blanc',     img:`https://play.pokemonshowdown.com/sprites/gen5/pikachu.png` },
            { id:'ani',   label:'Animé',  sub:'GIF Gen 6+',     img:`https://play.pokemonshowdown.com/sprites/ani/pikachu.gif` },
            { id:'dex',   label:'Dex',    sub:'XY/ORAS HD',     img:`https://play.pokemonshowdown.com/sprites/dex/pikachu.png` },
            { id:'home',  label:'HOME',   sub:'Switch HD',      img:`https://play.pokemonshowdown.com/sprites/home-centered/pikachu.png` },
          ];
          const cur = S.spriteMode || 'local';
          return `<div class="sprite-mode-grid" id="spriteModeGrid">${
            SPRITE_MODES.map(m => `
              <div class="sprite-mode-card${m.id===cur?' active':''}" data-sprite-mode="${m.id}" title="${m.sub}">
                <img src="${m.img||''}" style="width:40px;height:40px;image-rendering:pixelated;object-fit:contain" onerror="this.style.opacity='.3'">
                <span class="smc-label">${m.label}</span>
                <span class="smc-sub">${m.sub}</span>
              </div>`).join('')
          }</div>`;
        })()}
      </div>
      <div class="settings-row">
        <label>Évolution auto <span style="font-size:.75em;opacity:.6">(choix aléatoire, sans cartes)</span></label>
        ${tog('autoEvoChoice', S.autoEvoChoice === true)}
      </div>
    </div>

    <!-- Audio -->
    <div class="settings-section">
      <h4>🔊 Audio</h4>
      <div class="settings-row">
        <label>Musique de fond</label>
        ${tog('music', S.musicEnabled === true)}
      </div>
      <div class="settings-row">
        <label>Volume musique <span id="sVolMusicVal" style="color:var(--gold);margin-left:4px">${S.musicVol ?? 80}%</span></label>
        <input type="range" id="sVolMusic" min="0" max="100" step="5" value="${S.musicVol ?? 80}" style="width:110px">
      </div>
      <div class="settings-row">
        <label>Effets sonores (SFX)</label>
        ${tog('sfx', S.sfxEnabled !== false)}
      </div>
      <div class="settings-row">
        <label>Volume SFX <span id="sVolSFXVal" style="color:var(--gold);margin-left:4px">${S.sfxVol ?? 80}%</span></label>
        <input type="range" id="sVolSFX" min="0" max="100" step="5" value="${S.sfxVol ?? 80}" style="width:110px">
      </div>
      <div class="sfx-sublist">
        <button id="btnSfxSubToggle" style="font-family:var(--font-pixel);font-size:8px;padding:4px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;width:100%;text-align:left">
          ▸ Sons individuels
        </button>
        <div class="sfx-sublist-inner" id="sfxSubList">
          ${sfxRows}
        </div>
      </div>
    </div>

    <!-- Affichage -->
    <div class="settings-section">
      <h4>🖥 Affichage</h4>
      <div class="settings-row">
        <label>Thème clair</label>
        ${tog('lightTheme', S.lightTheme === true)}
      </div>
      <div class="settings-row">
        <label>Mode légère <span style="font-size:.75em;opacity:.6">(réduit animations)</span></label>
        ${tog('lowSpec', S.lowSpec === true)}
      </div>
      <div class="settings-row">
        <label>Taille interface <span id="sUIScaleVal" style="color:var(--gold);margin-left:4px">${S.uiScale ?? 100}%</span></label>
        <input type="range" id="sUIScale" min="70" max="130" step="5" value="${S.uiScale ?? 100}" style="width:110px">
      </div>
      <div class="settings-row">
        <label>Sprites zones <span id="sZoneScaleVal" style="color:var(--gold);margin-left:4px">${S.zoneScale ?? 100}%</span></label>
        <input type="range" id="sZoneScale" min="50" max="200" step="10" value="${S.zoneScale ?? 100}" style="width:110px">
      </div>
    </div>

    <!-- Sauvegarde -->
    <div class="settings-section">
      <h4>💾 Sauvegarde</h4>
      <div class="settings-actions">
        <button id="btnExportSave">📤 Exporter</button>
        <button id="btnImportSave">📥 Importer</button>
      </div>
    </div>

    <!-- Cache -->
    <div class="settings-section">
      <h4>🗑 Cache</h4>
      <div class="settings-actions">
        <button id="btnPurgeSprites" class="danger">Purger sprites</button>
        <button id="btnResetAll" class="danger">Reset complet</button>
      </div>
    </div>

    <!-- Code récompense -->
    <div class="settings-section">
      <h4>🎁 Code récompense</h4>
      <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;gap:6px">
          <input type="text" id="rewardCodeInput" placeholder="Entre un code..." style="flex:1;text-transform:uppercase;letter-spacing:1px">
          <button id="btnRedeemCode" style="font-family:var(--font-pixel);font-size:8px;padding:6px 10px;background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer;white-space:nowrap">Valider</button>
        </div>
        <div style="font-size:9px;color:var(--text-dim)">Les codes sont distribués sur le Discord.</div>
      </div>
    </div>

    <!-- Aide -->
    <div class="settings-section">
      <h4>ℹ Aide &amp; Contact</h4>
      <div style="font-size:10px;color:var(--text-dim);line-height:1.6;margin-bottom:10px">
        <b style="color:var(--gold)">PokéForge — Gang Wars</b><br>
        Capturez des Pokémon, recrutez des agents, combattez des dresseurs et élargissez votre gang.<br><br>
        <b style="color:var(--text)">Progression :</b> Gagnez de la réputation via les <b>combats spéciaux</b> et les <b>raids</b>.<br>
        <b style="color:var(--text)">Oeufs :</b> Élevez des Pokémon à la Pension — achetez un <b>incubateur</b> au Marché.<br>
        <b style="color:var(--text)">Agents :</b> Recrutez des agents et assignez-les à des zones pour automatiser captures et combats.<br>
        <b style="color:var(--text)">Labo :</b> Sacrifiez des doublons pour améliorer le potentiel de vos meilleurs Pokémon.
      </div>
      <div style="padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:10px;text-align:center">
        Contact &amp; Support — Discord : <b style="color:var(--gold)">mutenrock</b>
      </div>
    </div>
  `;
}

function repairSave() {
  showConfirm(
    'Réparer la save : reappliquer toutes les migrations et corriger les champs manquants ?\nTes données ne seront pas effacées.',
    () => {
      try {
        // Snapshot avant
        const before = { pokemons: state.pokemons.length, agents: state.agents.length, money: state.gang.money, rep: state.gang.reputation };

        // Réappliquer migrate() sur le state courant
        const raw = JSON.parse(JSON.stringify(state)); // deep clone sérialisable
        state = migrate(raw);

        // Nettoyage supplémentaire
        // 1. Historiques trop longs
        let histTrimmed = 0;
        for (const p of state.pokemons) {
          if (p.history && p.history.length > MAX_HISTORY) {
            histTrimmed += p.history.length - MAX_HISTORY;
            p.history = p.history.slice(-MAX_HISTORY);
          }
        }
        // 2. IDs fantômes en équipe boss
        const allIds = new Set(state.pokemons.map(p => p.id));
        const teamBefore = state.gang.bossTeam.length;
        state.gang.bossTeam = state.gang.bossTeam.filter(id => allIds.has(id));
        // 3. IDs fantômes en pension
        if (state.pension.slots) state.pension.slots = state.pension.slots.filter(id => allIds.has(id));
        // 4. IDs fantômes en salle d'entraînement
        const trainBefore = state.trainingRoom.pokemon.length;
        state.trainingRoom.pokemon = state.trainingRoom.pokemon.filter(id => allIds.has(id));
        // 5. Titres dans les slots qui n'existent plus
        const validTitleIds = new Set(TITLES.map(t => t.id));
        for (const key of ['titleA','titleB','titleC','titleD']) {
          if (state.gang[key] && !validTitleIds.has(state.gang[key])) state.gang[key] = null;
        }
        if (!state.gang.titleA) state.gang.titleA = 'recrue';

        saveState();

        // Rapport
        const ghostTeam  = teamBefore - state.gang.bossTeam.length;
        const ghostTrain = trainBefore - state.trainingRoom.pokemon.length;
        const after = { pokemons: state.pokemons.length, agents: state.agents.length };
        const lines = [
          `✅ Migrations reappliquées`,
          histTrimmed   ? `📋 ${histTrimmed} entrée(s) d'historique tronquées` : null,
          ghostTeam     ? `👥 ${ghostTeam} ID fantôme(s) retiré(s) de l'équipe boss` : null,
          ghostTrain    ? `🏋 ${ghostTrain} ID fantôme(s) retiré(s) de la salle d'entraînement` : null,
          before.pokemons !== after.pokemons ? `⚠ Nombre de Pokémon modifié (${before.pokemons} → ${after.pokemons})` : null,
          `💾 Save sauvegardée — ${after.pokemons} Pokémon, ${after.agents} agents`,
        ].filter(Boolean);

        // Afficher le rapport dans un mini-modal
        const rpt = document.createElement('div');
        rpt.style.cssText = 'position:fixed;inset:0;z-index:10100;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:20px';
        rpt.innerHTML = `
          <div style="background:var(--bg-panel);border:2px solid #ffa000;border-radius:var(--radius);padding:20px;max-width:380px;width:100%;display:flex;flex-direction:column;gap:10px">
            <div style="font-family:var(--font-pixel);font-size:10px;color:#ffa000">🔧 Rapport de réparation</div>
            <div style="display:flex;flex-direction:column;gap:6px">${lines.map(l => `<div style="font-size:9px;color:var(--text)">${l}</div>`).join('')}</div>
            <button id="btnRptClose" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid #ffa000;border-radius:var(--radius-sm);color:#ffa000;cursor:pointer;margin-top:4px">Fermer</button>
          </div>`;
        document.body.appendChild(rpt);
        rpt.querySelector('#btnRptClose').addEventListener('click', () => { rpt.remove(); renderAll(); });

      } catch (err) {
        console.error('[PokéForge] repairSave() error:', err);
        notify('Erreur lors de la réparation — save non-modifiée.', 'error');
      }
    },
    null,
    { confirmLabel: 'Réparer', cancelLabel: 'Annuler' }
  );
}

function _bindSettingsActionButtons() {
  document.getElementById('btnExportSave')?.addEventListener('click', exportSave);
  document.getElementById('btnImportSave')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      if (input.files[0]) importSave(input.files[0]);
    });
    input.click();
  });
  document.getElementById('btnPurgeSprites')?.addEventListener('click', () => {
    // Tente de vider le cache navigateur via Cache API, puis recharge
    const doReload = () => { saveState(); location.reload(true); };
    if ('caches' in window) {
      caches.keys().then(names => {
        Promise.all(names.map(n => caches.delete(n))).then(doReload).catch(doReload);
      }).catch(doReload);
    } else {
      doReload();
    }
    notify('🗑 Cache purgé — rechargement en cours…', 'success');
  });
  document.getElementById('btnResetAll')?.addEventListener('click', () => {
    showConfirm(t('reset_confirm'), () => {
      localStorage.removeItem(SAVE_KEY);
      state = structuredClone(DEFAULT_STATE);
      // Close all zone windows
      for (const zid of [...openZones]) closeZoneWindow(zid);
      pcSelectedId = null;
      selectedForSale.clear();
      showIntro();
    }, null, { danger: true, confirmLabel: 'Réinitialiser', cancelLabel: 'Annuler' });
  });
  document.getElementById('btnRedeemCode')?.addEventListener('click', () => tryCheatCode('rewardCodeInput'));
  document.getElementById('rewardCodeInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') tryCheatCode('rewardCodeInput');
  });
}

function initSettings() {
  // Ouvre depuis la barre principale
  document.getElementById('btnSettings')?.addEventListener('click', () => {
    SFX.play('menuOpen');
    openSettingsModal();
  });

  // × Ferme sans sauvegarder → revert vers le snapshot
  document.getElementById('btnCloseSettings')?.addEventListener('click', () => {
    _revertSettings();
    SFX.play('menuClose');
    document.getElementById('settingsModal')?.classList.remove('active');
  });

  // ✓ Valider → finalise la lecture UI → save → ferme
  document.getElementById('btnSaveSettings')?.addEventListener('click', () => {
    const el = document.getElementById('settingsContent');
    const readToggle = (id, def = true) => {
      const btn = el?.querySelector(`[data-toggle-id="${id}"]`);
      return btn ? btn.dataset.on === 'true' : def;
    };

    // Langue
    const langSel = document.getElementById('settingLang');
    if (langSel) state.lang = langSel.value;

    // Toggles (lecture complète — _applySettingsLive a déjà écrit la plupart, mais on consolide)
    state.settings.autoCombat     = readToggle('autoCombat',    true);
    state.settings.discoveryMode  = readToggle('discoveryMode', true);
    // spriteMode est écrit directement au clic — pas de toggle à relire ici
    state.settings.autoEvoChoice  = readToggle('autoEvoChoice', false);
    state.settings.musicEnabled   = readToggle('music',         false);
    state.settings.sfxEnabled     = readToggle('sfx',           true);
    state.settings.lightTheme     = readToggle('lightTheme',    false);
    state.settings.lowSpec        = readToggle('lowSpec',        false);

    // Sliders
    state.settings.musicVol  = parseInt(document.getElementById('sVolMusic')?.value)   || 80;
    state.settings.sfxVol    = parseInt(document.getElementById('sVolSFX')?.value)     || 80;
    state.settings.uiScale   = parseInt(document.getElementById('sUIScale')?.value)    || 100;
    state.settings.zoneScale = parseInt(document.getElementById('sZoneScale')?.value)  || 100;

    // SFX individuels
    if (!state.settings.sfxIndividual) state.settings.sfxIndividual = {};
    el?.querySelectorAll('.s-toggle[data-sfx-key]').forEach(btn => {
      state.settings.sfxIndividual[btn.dataset.sfxKey] = btn.dataset.on === 'true';
    });

    // Applique les effets définitifs
    document.body.classList.toggle('theme-light', state.settings.lightTheme === true);
    document.body.classList.toggle('low-spec',    state.settings.lowSpec    === true);
    document.documentElement.style.setProperty('--ui-scale',   (state.settings.uiScale   / 100).toFixed(2));
    document.documentElement.style.setProperty('--zone-scale', (state.settings.zoneScale / 100).toFixed(2));
    if (state.settings.musicEnabled) { MusicPlayer.setVolume(state.settings.musicVol / 1000); MusicPlayer.updateFromContext(); }
    else MusicPlayer.stop();

    saveState();
    detectLLM();
    SFX.play('menuClose');
    document.getElementById('settingsModal')?.classList.remove('active');

    // Rechargement auto si mode sprite ou thème/langue changé (modifications visuelles globales)
    const needsReload = (_settingsSnap?.spriteMode !== state.settings.spriteMode)
                     || (_settingsLangSnap         !== state.lang);
    if (needsReload) {
      setTimeout(() => location.reload(true), 150);
    } else {
      renderAll();
    }
  });
}

// ════════════════════════════════════════════════════════════════
// 21.  GAME LOOP & BOOT
// ════════════════════════════════════════════════════════════════
// ── renderTrainingTab / trainingRoomTick extracted → modules/systems/trainingRoom.js ──

// ════════════════════════════════════════════════════════════════
// 22.  PENSION & EGGS
// ════════════════════════════════════════════════════════════════
// ── pensionTick / renderPensionView extracted → modules/systems/pension.js ──

// ════════════════════════════════════════════════════════════════
// LAB TAB
// ════════════════════════════════════════════════════════════════
function renderLabTabInEl(tab) {
  if (!tab) return;

  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
  const pensionSet = getPensionSlotIds();

  const allUpgradeable = state.pokemons
    .filter(p => p.potential < 5)
    .sort((a, b) => b.potential - a.potential || getPokemonPower(b) - getPokemonPower(a));

  const possible = allUpgradeable.filter(p => {
    const cost = POT_UPGRADE_COSTS[p.potential - 1] || 99;
    const donors = state.pokemons.filter(d =>
      d.species_en === p.species_en && d.id !== p.id &&
      !d.shiny && d.potential <= p.potential &&
      !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id) &&
      !pensionSet.has(d.id)
    );
    return donors.length >= cost;
  });

  const displayList = labShowAll ? allUpgradeable : possible;
  const selected = labSelectedId ? state.pokemons.find(p => p.id === labSelectedId) : null;

  // ── Panneau mutation ────────────────────────────────────────
  let mutationHtml = `
    <div style="color:var(--text-dim);font-size:9px;padding:16px;text-align:center;line-height:1.6">
      Sélectionne un Pokémon<br><br>
      <span style="font-size:8px">Par défaut, seules les mutations<br>réalisables sont affichées.</span>
    </div>`;
  if (selected) {
    const cost = POT_UPGRADE_COSTS[selected.potential - 1] || 99;
    const donors = state.pokemons.filter(d =>
      d.species_en === selected.species_en && d.id !== selected.id &&
      !d.shiny && d.potential <= selected.potential &&
      !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id) &&
      !pensionSet.has(d.id)
    );
    const canUpgrade = donors.length >= cost && selected.potential < 5;
    mutationHtml = `
      <div style="text-align:center;margin-bottom:12px">
        <img src="${pokeSprite(selected.species_en, selected.shiny)}" style="width:80px;height:80px">
        <div style="font-family:var(--font-pixel);font-size:10px;margin-top:4px">${speciesName(selected.species_en)}</div>
        <div style="font-size:10px;color:var(--gold)">${'*'.repeat(selected.potential)} → ${'*'.repeat(selected.potential + 1)}</div>
      </div>
      <div style="font-size:10px;margin-bottom:8px">
        <div>Potentiel : <b>${selected.potential}/5</b></div>
        <div>Spécimens : <b style="color:${donors.length >= cost ? 'var(--green)' : 'var(--red)'}">${donors.length}/${cost}</b></div>
      </div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:10px">Équipe + Formation protégées.</div>
      <button id="btnLabUpgrade" style="width:100%;font-size:10px;padding:8px;background:var(--bg);
        border:2px solid ${canUpgrade ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);
        color:${canUpgrade ? 'var(--gold)' : 'var(--text-dim)'};cursor:${canUpgrade ? 'pointer' : 'default'}"
        ${canUpgrade ? '' : 'disabled'}>
        ${canUpgrade ? '⚗ MUTER LE POTENTIEL' : 'Spécimens insuffisants'}
      </button>
      <div style="margin-top:12px">
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:4px">COÛTS</div>
        ${POT_UPGRADE_COSTS.map((c, i) =>
          `<div style="font-size:8px;${selected.potential - 1 === i ? 'color:var(--gold)' : 'color:var(--text-dim)'}">
            ${'★'.repeat(i+1)} → ${'★'.repeat(i+2)}: ${c} specimens
          </div>`
        ).join('')}
      </div>`;
  }

  // ── Panneau tracker ─────────────────────────────────────────
  const tracked = state.lab?.trackedSpecies || [];
  const ownedSpecies = [...new Set(state.pokemons.map(p => p.species_en))].sort((a, b) =>
    speciesName(a).localeCompare(speciesName(b))
  );
  const trackerHtml = `
    <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:8px">🔍 TRACKER</div>
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <select id="labTrackerSel" style="flex:1;font-size:9px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:3px">
        <option value="">— Espèce —</option>
        ${ownedSpecies.map(en => `<option value="${en}">${speciesName(en)}</option>`).join('')}
      </select>
      <button id="btnLabTrack" style="font-size:10px;padding:3px 10px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:3px;color:var(--gold);cursor:pointer">+</button>
    </div>
    ${tracked.length === 0
      ? '<div style="font-size:9px;color:var(--text-dim)">Aucune espèce suivie.</div>'
      : tracked.map(species => {
          const owned = state.pokemons.filter(p => p.species_en === species);
          const byPot = [1,2,3,4,5].map(pot => owned.filter(p => p.potential === pot).length);
          const mutPossible = [1,2,3,4].some(pot => {
            const cost = POT_UPGRADE_COSTS[pot - 1] || 99;
            const donors = owned.filter(d => d.potential === pot &&
              !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id));
            const targets = owned.filter(d => d.potential === pot);
            return targets.length > 0 && donors.length >= cost + 1;
          });
          return `<div style="border:1px solid ${mutPossible ? 'var(--gold-dim)' : 'var(--border)'};border-radius:var(--radius-sm);padding:8px;background:var(--bg);margin-bottom:6px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
              <img src="${pokeSprite(species)}" style="width:26px;height:26px">
              <span style="font-size:9px;flex:1"><b>${speciesName(species)}</b> — <span style="color:var(--gold)">${owned.length}</span></span>
              <button class="lab-untrack" data-untrack="${species}" style="font-size:8px;padding:1px 5px;background:var(--bg);border:1px solid var(--red);border-radius:2px;color:var(--red);cursor:pointer">✕</button>
            </div>
            <div style="display:flex;gap:3px;flex-wrap:wrap">
              ${byPot.map((n, i) => `<div style="font-size:8px;padding:2px 5px;border-radius:2px;
                background:${n > 0 ? 'rgba(255,204,90,0.12)' : 'rgba(0,0,0,0)'};
                border:1px solid ${n > 0 ? 'var(--gold-dim)' : 'var(--border)'}">
                ${'★'.repeat(i+1)}: <b>${n}</b>
              </div>`).join('')}
            </div>
            ${mutPossible ? '<div style="font-size:8px;color:var(--green);margin-top:4px">⚡ Mutation possible !</div>' : ''}
          </div>`;
        }).join('')
    }`;

  // ── Liste candidates ────────────────────────────────────────
  const listHtml = displayList.map(p => {
    const cost = POT_UPGRADE_COSTS[p.potential - 1] || 99;
    const donors = state.pokemons.filter(d =>
      d.species_en === p.species_en && d.id !== p.id &&
      !d.shiny && d.potential <= p.potential &&
      !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id)
    );
    const ready = donors.length >= cost;
    return `<div class="lab-candidate" data-lab-id="${p.id}"
      style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border);
      cursor:pointer;background:${labSelectedId === p.id ? 'var(--bg-hover)' : ''}">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:36px;height:36px">
      <div style="flex:1">
        <div style="font-size:10px">${speciesName(p.species_en)} ${'★'.repeat(p.potential)}</div>
        <div style="font-size:9px;color:${ready ? 'var(--green)' : 'var(--text-dim)'}">
          ${ready ? `✓ Prêt (${donors.length}/${cost})` : `${donors.length}/${cost} spécimens`}
        </div>
      </div>
    </div>`;
  }).join('') || `<div style="color:var(--text-dim);font-size:9px;padding:14px;text-align:center">
    ${labShowAll ? 'Tous vos Pokémon sont au potentiel max' : 'Aucune mutation réalisable actuellement.<br>Activez « Tous » pour voir tous les candidats.'}
  </div>`;

  // ── Rendu principal ─────────────────────────────────────────
  tab.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 290px;gap:14px;padding:12px;min-height:400px">
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">LABORATOIRE</div>
          <button id="btnLabToggleAll" style="font-family:var(--font-pixel);font-size:8px;padding:3px 8px;
            background:${labShowAll ? 'var(--gold-dim)' : 'var(--bg)'};
            border:1px solid ${labShowAll ? 'var(--gold)' : 'var(--border)'};border-radius:3px;
            color:${labShowAll ? 'var(--bg)' : 'var(--text-dim)'};cursor:pointer">
            ${labShowAll ? '✓ TOUS' : 'PRÊTS seulement'}
          </button>
        </div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);flex:1;overflow-y:auto;max-height:520px">${listHtml}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;overflow-y:auto;max-height:600px">
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:12px">${mutationHtml}</div>
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:12px">${trackerHtml}</div>
      </div>
    </div>`;

  tab.querySelectorAll('.lab-candidate').forEach(el => {
    el.addEventListener('click', () => {
      labSelectedId = el.dataset.labId;
      if (pcView === 'lab') renderPCTab(); else renderLabTab();
    });
  });

  tab.querySelector('#btnLabToggleAll')?.addEventListener('click', () => {
    labShowAll = !labShowAll;
    if (pcView === 'lab') renderPCTab(); else renderLabTab();
  });

  tab.querySelector('#btnLabUpgrade')?.addEventListener('click', () => {
    if (!selected) return;
    const cost = POT_UPGRADE_COSTS[selected.potential - 1];
    const donors = state.pokemons.filter(d =>
      d.species_en === selected.species_en && d.id !== selected.id &&
      !d.shiny && d.potential <= selected.potential &&
      !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id) &&
      !pensionSet.has(d.id)
    );
    if (donors.length < cost) return;
    const toSacrifice = donors.slice(0, cost).map(p => p.id);
    state.pokemons = state.pokemons.filter(p => !toSacrifice.includes(p.id));
    selected.potential++;
    saveState();
    _pcLastRenderKey = '';
    notify(`${speciesName(selected.species_en)} est maintenant ${'★'.repeat(selected.potential)} !`, 'gold');
    if (pcView === 'lab') renderPCTab(); else renderLabTab();
    updateTopBar();
  });

  tab.querySelector('#btnLabTrack')?.addEventListener('click', () => {
    const val = document.getElementById('labTrackerSel')?.value;
    if (!val) return;
    if (!state.lab.trackedSpecies.includes(val)) {
      state.lab.trackedSpecies.push(val);
      saveState();
      if (pcView === 'lab') renderPCTab(); else renderLabTab();
    }
  });

  tab.querySelectorAll('.lab-untrack').forEach(btn => {
    btn.addEventListener('click', () => {
      state.lab.trackedSpecies = state.lab.trackedSpecies.filter(s => s !== btn.dataset.untrack);
      saveState();
      if (pcView === 'lab') renderPCTab(); else renderLabTab();
    });
  });
}

function renderLabTab() {
  const tab = document.getElementById('tabLab');
  if (!tab) return;
  renderLabTabInEl(tab);
}

// ════════════════════════════════════════════════════════════════
// GAME LOOP VARS
// ════════════════════════════════════════════════════════════════
const HOUR_MS = 3600000;

let agentTickInterval = null;
let autoSaveInterval  = null;
let cooldownInterval  = null;
let _gameLoopStarted  = false; // guard against double-start

function startGameLoop() {
  // Guard: only start once — prevents interval accumulation on hot-reload
  if (_gameLoopStarted) return;
  _gameLoopStarted = true;

  // Initialiser les timers background pour les zones fermées avec agents
  syncBackgroundZones();

  // Agent automation every 2 seconds (agents interact with visible spawns)
  agentTickInterval = setInterval(agentTick, 2000);

  // Passive agent tick every 10 seconds (closed zones, background activity)
  setInterval(passiveAgentTick, 10000);

  // Hourly quests countdown refresh (every 10s when market tab open)
  setInterval(() => {
    if (activeTab === 'tabMarket') renderQuestPanel();
  }, 10000);

  // Hourly quest reset check (every minute)
  setInterval(() => {
    if (state.missions?.hourly && Date.now() - state.missions.hourly.reset >= HOUR_MS) {
      initHourlyQuests();
      if (activeTab === 'tabMarket') renderQuestPanel();
      notify('⏰ Nouvelles quêtes horaires disponibles !', 'gold');
    }
  }, 60000);

  // Market decay every 5 minutes
  setInterval(decayMarketSales, 300000);

  // Remote version polling every hour (detects new deploys)
  setInterval(pollRemoteVersion, 3600000);
  setTimeout(pollRemoteVersion, 15000); // first check 15s after boot

  // Daily reload at 12h00 + 00h00 to flush new versions
  startDailyReloadSchedule();

  // Auto-save every 10 seconds
  autoSaveInterval = setInterval(saveState, 10000);

  // Cloud save every hour (dirty-checked — skipped if nothing changed)
  setInterval(supaCloudSave, 60 * 60 * 1000);

  // Snapshot check every hour — supaWriteSnapshot() throttles itself to 30 min internally
  setInterval(supaWriteSnapshot, 60 * 60 * 1000);

  // Leaderboard push every 2h, only if player was active since last push
  setInterval(() => {
    if (_playerWasActive) {
      _playerWasActive = false;
      supaUpdateLeaderboardAnon();
    }
  }, 2 * 60 * 60 * 1000);

  // Cooldown tick removed — cooldowns no longer exist in gameplay

  // Training room tick every 60 seconds
  setInterval(trainingRoomTick, 60000);

  // Pension / egg tick every 30 seconds
  setInterval(pensionTick, 30000);

  // Passive XP for pokemon in teams every 30 seconds
  setInterval(() => {
    const teamIds = new Set([...state.gang.bossTeam]);
    for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
    if (teamIds.size === 0) return;
    let leveled = false;
    for (const id of teamIds) {
      const p = state.pokemons.find(pk => pk.id === id);
      if (p) leveled = levelUpPokemon(p, 3) || leveled; // 3 XP/30s passif
    }
    if (leveled) saveState();
  }, 30000);

  // Zone timers + raid button + fogmap refresh every second
  setInterval(() => {
    for (const zoneId of openZones) {
      updateZoneTimers(zoneId);
      _refreshRaidBtn(zoneId);
    }
    if (activeTab === 'tabZones') _zsRefreshAllTiles();
  }, 1000);

}

// ════════════════════════════════════════════════════════════════
// 23.  SUPABASE — AUTH & CLOUD SAVE
// ════════════════════════════════════════════════════════════════

let _supabase    = null;
let supaSession = null;
let supaLastSync = null;   // timestamp dernier cloud save réussi
let supaSyncing  = false;

// ── Session token — identifies a player row in the leaderboard, even if anonymous
// Persisted in localStorage so it survives page reloads.
const _LB_TOKEN_KEY = 'pg.lbToken';
let _lbToken = localStorage.getItem(_LB_TOKEN_KEY);
if (!_lbToken) {
  _lbToken = 'anon_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  localStorage.setItem(_LB_TOKEN_KEY, _lbToken);
}

let _lbLastPushAt = 0;
let _playerWasActive = false; // set to true on any saveState() call; consumed by 2h lb timer
const LB_PUSH_THROTTLE_MS = 60 * 60 * 1000; // push at most once every hour
let _lbLastFingerprint = ''; // dirty check — skip push if nothing changed

// ── Helpers ───────────────────────────────────────────────────────
function supaConfigured() {
  return typeof SUPABASE_URL !== 'undefined'
    && SUPABASE_URL
    && !SUPABASE_URL.includes('VOTRE_PROJET');
}

// ── Custom fetch : timeout 12 s ───────────────────────────────────────
function _supaFetch(url, options = {}) {
  const ctrl = new AbortController();
  const existing = options.signal;
  if (existing?.addEventListener) existing.addEventListener('abort', () => ctrl.abort());
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  return fetch(url, { ...options, signal: ctrl.signal })
    .catch(err => {
      if (err.name === 'AbortError') throw new Error('Supabase request timeout (12s)');
      throw err;
    })
    .finally(() => clearTimeout(timer));
}

// ── Mutex réentrant JS — remplace le Web Locks API pour GoTrue ───────
// Raison : GoTrue appelle _recoverAndRefresh() DEPUIS l'intérieur du lock
// courant quand une requête échoue (504). Le Web Locks API ne supporte pas la
// réentrance → deadlock de 5s → vol de lock → "Uncaught (in promise)".
// Un mutex JS simple est réentrant par nature (même thread) et évite tout ça.
function _makeSupaLock() {
  let _promise = Promise.resolve(); // chaîne de promesses sérialisées
  let _depth   = 0;                 // compteur de réentrance
  return async function supaLock(_name, _acquireTimeout, fn) {
    if (_depth > 0) {
      // Réentrant : exécuter fn directement sans attendre le mutex
      _depth++;
      try { return await fn(); } finally { _depth--; }
    }
    // Première acquisition : sérialiser derrière les appels précédents
    let release;
    const next = new Promise(r => (release = r));
    const prev = _promise;
    _promise    = next;
    await prev;
    _depth = 1;
    try {
      return await fn();
    } catch (err) {
      throw err;
    } finally {
      _depth = 0;
      release();
    }
  };
}

// ── Init ──────────────────────────────────────────────────────────
function initSupabase() {
  if (!supaConfigured()) return;
  if (typeof window.supabase === 'undefined') {
    console.warn('PokéForge: Supabase SDK non chargé.');
    return;
  }
  try {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession:     true,
        autoRefreshToken:   true,
        detectSessionInUrl: false,
        lock: _makeSupaLock(), // mutex JS réentrant, pas de Web Locks API
      },
      global: { fetch: _supaFetch },
    });

    // Restaurer la session existante (localStorage Supabase)
    _supabase.auth.getSession()
      .then(({ data }) => {
        supaSession = data.session || null;
        updateSupaIndicator();
        if (activeTab === 'tabCompte') renderCompteTab();
      })
      .catch(err => {
        console.warn('PokéForge: getSession failed (réseau?)', err?.message ?? err);
      });

    // Écouter les changements d'auth (login / logout / refresh token)
    _supabase.auth.onAuthStateChange((_event, session) => {
      supaSession = session;
      updateSupaIndicator();
      updateSupaTabLabel();
      if (activeTab === 'tabCompte') renderCompteTab();
    });
  } catch (e) {
    console.warn('PokéForge: Supabase init error', e);
  }
}

// ── Auth ──────────────────────────────────────────────────────────
async function supaSignIn(email, password) {
  if (!_supabase) return { error: 'Supabase non configuré' };
  const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  // Après connexion : proposer de charger la save cloud si plus récente
  await supaCheckCloudLoad();
  return { data };
}

async function supaSignUp(email, password) {
  if (!_supabase) return { error: 'Supabase non configuré' };
  const { data, error } = await _supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  return { data };
}

async function supaSignOut() {
  if (!_supabase) return;
  await _supabase.auth.signOut();
  supaLastSync    = null;
  supaSession     = null;
  _snapshotCount  = -1;   // reset so next login re-fetches real count
  _lbLastFingerprint = ''; // force leaderboard push on next login
  updateSupaIndicator();
  updateSupaTabLabel();
  if (activeTab === 'tabCompte') renderCompteTab();
}

// ── Cloud Save ────────────────────────────────────────────────────
// Dirty-check fingerprint for cloud save — avoids upsert when nothing changed
let _cloudSaveFingerprint = '';

async function supaCloudSave() {
  if (!_supabase || !supaSession) return;
  if (supaSyncing) return;

  // Skip the upsert if key stats haven't changed since the last successful cloud write.
  // Uses the same fields as the leaderboard fingerprint + pokémon count + money.
  const fp = `${state.gang.reputation}|${state.stats?.totalCaught}|${state.pokemons?.length}|${state.gang.money}|${state._savedAt}`;
  if (fp === _cloudSaveFingerprint) return;

  supaSyncing = true;
  updateSupaIndicator();
  try {
    // Slim the payload the same way saveState() does for localStorage — avoids
    // writing derivable/default fields and keeps the JSONB blob as small as possible.
    const payload = { ...state, pokemons: state.pokemons.map(slimPokemon) };
    const { error } = await _supabase
      .from('player_saves')
      .upsert({
        user_id:  supaSession.user.id,
        slot:     activeSaveSlot,
        state:    payload,
        saved_at: new Date().toISOString(),
      });
    if (!error) {
      supaLastSync = Date.now();
      _cloudSaveFingerprint = fp;
    }
  } catch { /* silencieux — la save locale est toujours là */ }
  supaSyncing = false;
  updateSupaIndicator();
  if (activeTab === 'tabCompte') renderCompteTab();
}

async function supaCheckCloudLoad() {
  if (!_supabase || !supaSession) return;
  let data, error;
  try {
    ({ data, error } = await _supabase
      .from('player_saves')
      .select('state, saved_at')
      .eq('user_id', supaSession.user.id)
      .eq('slot', activeSaveSlot)
      .single());
  } catch { return; }
  if (error || !data) return;

  const cloudTs = new Date(data.saved_at).getTime();
  const localTs = state._savedAt || 0;
  if (cloudTs > localTs) {
    const fmt = new Date(cloudTs).toLocaleString('fr-FR');
    showConfirm(
      `Une sauvegarde cloud plus récente existe (${fmt}).<br>Charger la sauvegarde cloud ? <span style="color:var(--text-dim);font-size:11px">(La save locale sera remplacée)</span>`,
      () => {
        state = migrate(data.state);
        saveState();
        renderAll();
        notify('Sauvegarde cloud chargée !', 'success');
      },
      null,
      { confirmLabel: 'Charger', cancelLabel: 'Ignorer' }
    );
  }
}

async function supaForceCloudLoad() {
  if (!_supabase || !supaSession) return;
  let data, error;
  try {
    ({ data, error } = await _supabase
      .from('player_saves')
      .select('state, saved_at')
      .eq('user_id', supaSession.user.id)
      .eq('slot', activeSaveSlot)
      .single());
  } catch { notify('Erreur réseau — réessaie dans un moment.', 'error'); return; }
  if (error || !data) { notify('Aucune sauvegarde cloud trouvée.', 'error'); return; }

  const fmt = new Date(data.saved_at).toLocaleString('fr-FR');
  showConfirm(
    `Charger la save cloud du ${fmt} ?<br><span style="color:var(--text-dim);font-size:11px">La save locale sera écrasée.</span>`,
    () => {
      state = migrate(data.state);
      saveState();
      renderAll();
      notify('Sauvegarde cloud chargée !', 'success');
    },
    null,
    { confirmLabel: 'Charger', cancelLabel: 'Annuler', danger: true }
  );
}

// ── Rolling snapshots ─────────────────────────────────────────────
const MAX_SNAPSHOTS = 2;
let _snapshotCount = -1; // -1 = unknown (fetched lazily); avoids SELECT on every write

// Snapshot throttle — one snapshot per session at most every 30 minutes.
// The 5-min game loop calls this but the guard prevents actual DB writes more often.
let _lastSnapshotAt = 0;
const SNAPSHOT_THROTTLE_MS = 30 * 60 * 1000; // 30 min minimum between snapshots

async function supaWriteSnapshot() {
  if (!_supabase || !supaSession) return;

  // Rate-limit to one snapshot per 30 minutes (previously fired every 5 min)
  const now = Date.now();
  if (now - _lastSnapshotAt < SNAPSHOT_THROTTLE_MS) return;

  try {
    // Slim the payload — same as cloud save and localStorage
    const payload = { ...state, pokemons: state.pokemons.map(slimPokemon) };

    // 1. Insert new snapshot
    const { error } = await _supabase.from('save_snapshots').insert({
      user_id:   supaSession.user.id,
      slot:      activeSaveSlot,
      state:     payload,
      gang_name: state.gang?.name || 'Team ???',
      rep:       state.gang?.reputation || 0,
      saved_at:  new Date().toISOString(),
    });
    if (error) return;

    _lastSnapshotAt = now;

    // Track count client-side to avoid a SELECT on every write
    if (_snapshotCount < 0) {
      // First write since page load — fetch real count once
      const { count } = await _supabase
        .from('save_snapshots')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', supaSession.user.id)
        .eq('slot', activeSaveSlot);
      _snapshotCount = count ?? MAX_SNAPSHOTS;
    } else {
      _snapshotCount++;
    }

    // 2. Prune only when over limit (avoids SELECT+DELETE every write)
    if (_snapshotCount > MAX_SNAPSHOTS) {
      const { data: rows } = await _supabase
        .from('save_snapshots')
        .select('id, saved_at')
        .eq('user_id', supaSession.user.id)
        .eq('slot', activeSaveSlot)
        .order('saved_at', { ascending: false });

      if (rows && rows.length > MAX_SNAPSHOTS) {
        const toDelete = rows.slice(MAX_SNAPSHOTS).map(r => r.id);
        await _supabase.from('save_snapshots').delete().in('id', toDelete);
        _snapshotCount = MAX_SNAPSHOTS;
      }
    }
  } catch { /* silencieux */ }
}

async function supaFetchSnapshots() {
  if (!_supabase || !supaSession) return [];
  const { data, error } = await _supabase
    .from('save_snapshots')
    .select('id, gang_name, rep, saved_at')
    .eq('user_id', supaSession.user.id)
    .eq('slot', activeSaveSlot)
    .order('saved_at', { ascending: false })
    .limit(MAX_SNAPSHOTS);
  return (error || !data) ? [] : data;
}

async function supaRestoreSnapshot(snapshotId) {
  if (!_supabase || !supaSession) return;
  const { data, error } = await _supabase
    .from('save_snapshots')
    .select('state, saved_at')
    .eq('id', snapshotId)
    .eq('user_id', supaSession.user.id)
    .single();
  if (error || !data) { notify('Snapshot introuvable.', 'error'); return; }

  const fmt = new Date(data.saved_at).toLocaleString('fr-FR');
  showConfirm(
    `Restaurer le snapshot du <b>${fmt}</b> ?<br><span style="color:var(--text-dim);font-size:11px">La save actuelle sera écrasée — exporte-la d'abord si nécessaire.</span>`,
    () => {
      state = migrate(data.state);
      saveState();
      renderAll();
      notify(`⏪ Snapshot du ${fmt} restauré !`, 'success');
    },
    null,
    { confirmLabel: 'Restaurer', cancelLabel: 'Annuler', danger: true }
  );
}

async function supaUpdateLeaderboard() {
  if (!_supabase || !supaSession) return;
  await _supabase.from('players').upsert({
    user_id:            supaSession.user.id,
    gang_name:          state.gang.name        || 'Team ???',
    boss_name:          state.gang.bossName    || 'Boss',
    reputation:         state.gang.reputation  || 0,
    total_caught:       state.stats?.totalCaught  || 0,
    total_sold:         state.stats?.totalSold    || 0,
    shiny_count:        state.stats?.shinyCaught  || 0,
    shiny_species_count: getShinySpeciesCount(),
    dex_kanto_count:    getDexKantoCaught(),
    dex_national_count: getDexNationalCaught(),
    agents_count:       (state.agents || []).length,
    agents_elite_count: state.stats?.agentsEliteCount || 0,
    updated_at:         new Date().toISOString(),
  });
}

// ── Anonymous leaderboard push (works with or without auth) ──────
// Uses _lbToken as primary key; links user_id when authenticated.
// SQL schema for the 'leaderboard' table (run once in Supabase SQL editor):
//
//   CREATE TABLE leaderboard (
//     token                TEXT PRIMARY KEY,
//     user_id              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
//     gang_name            TEXT,
//     boss_name            TEXT,
//     boss_sprite          TEXT,
//     reputation           BIGINT  DEFAULT 0,
//     total_caught         INT     DEFAULT 0,
//     shiny_count          INT     DEFAULT 0,
//     shiny_species_count  INT     DEFAULT 0,
//     dex_kanto_count      INT     DEFAULT 0,
//     dex_national_count   INT     DEFAULT 0,
//     agents_count         INT     DEFAULT 0,
//     is_anonymous         BOOLEAN DEFAULT TRUE,
//     updated_at           TIMESTAMPTZ DEFAULT NOW()
//   );
//   ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "lb_read"   ON leaderboard FOR SELECT USING (true);
//   CREATE POLICY "lb_insert" ON leaderboard FOR INSERT WITH CHECK (true);
//   CREATE POLICY "lb_update" ON leaderboard FOR UPDATE USING (true) WITH CHECK (true);
async function supaUpdateLeaderboardAnon() {
  if (!_supabase) return;
  const now = Date.now();
  if (now - _lbLastPushAt < LB_PUSH_THROTTLE_MS) return;

  // Dirty check — skip if key stats haven't changed since last push
  const fp = `${state.gang.reputation}|${state.stats?.totalCaught}|${state.stats?.shinyCaught}|${state.gang.name}`;
  if (fp === _lbLastFingerprint) return;
  _lbLastFingerprint = fp;
  _lbLastPushAt = now;

  try {
    await _supabase.from('leaderboard').upsert({
      token:               _lbToken,
      user_id:             supaSession?.user?.id ?? null,
      gang_name:           state.gang.name        || 'Team ???',
      boss_name:           state.gang.bossName    || 'Boss',
      boss_sprite:         state.gang.bossSprite  || null,
      reputation:          state.gang.reputation  || 0,
      total_caught:        state.stats?.totalCaught        || 0,
      shiny_count:         state.stats?.shinyCaught        || 0,
      shiny_species_count: getShinySpeciesCount(),
      dex_kanto_count:     getDexKantoCaught(),
      dex_national_count:  getDexNationalCaught(),
      total_sold:          state.stats?.totalSold          || 0,
      total_money_earned:  state.stats?.totalMoneyEarned   || 0,
      agents_count:        (state.agents || []).length,
      is_anonymous:        !supaSession,
      updated_at:          new Date().toISOString(),
    }, { onConflict: 'token' });
  } catch { /* silencieux */ }
}

// ── Top-bar indicator ─────────────────────────────────────────────
function updateSupaIndicator() {
  const el = document.getElementById('supaIndicator');
  if (!el) return;
  if (!supaConfigured()) { el.style.display = 'none'; return; }

  el.style.display = 'flex';
  if (!supaSession) {
    el.textContent = '☁';
    el.style.color = 'var(--text-dim)';
    el.title       = 'Non connecté — cliquer pour se connecter';
  } else if (supaSyncing) {
    el.textContent = '⟳';
    el.style.color = 'var(--gold)';
    el.title       = 'Synchronisation en cours…';
  } else if (supaLastSync) {
    const ago = Math.round((Date.now() - supaLastSync) / 1000);
    el.textContent = '☁';
    el.style.color = 'var(--green)';
    el.title       = `Cloud syncé il y a ${ago}s`;
  } else {
    el.textContent = '☁';
    el.style.color = '#ff9900';
    el.title       = 'Connecté — non encore syncé';
  }

  // Clic = aller sur l'onglet Compte
  el.onclick = () => switchTab('tabCompte');
}

// Mettre à jour le label du bouton tab Compte (connecté / non connecté)
function updateSupaTabLabel() {
  const btn = document.getElementById('tabBtnCompte');
  if (!btn) return;
  btn.textContent = supaSession ? '☁ Compte ●' : '☁ Compte';
  btn.style.color = supaSession ? 'var(--green)' : '';
}

// ── Leaderboard Tab ───────────────────────────────────────────────
let _lbSortBy   = 'reputation';  // sort column key
let _lbPeriod   = 'alltime';    // 'alltime' | 'weekly' | 'daily'

// ── Leaderboard Tab ─────────────────────────────────────────────────
async function renderLeaderboardTab() {
  const tab = document.getElementById('tabLeaderboard');
  if (!tab) return;

  if (!supaConfigured()) {
    tab.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-dim);font-family:var(--font-pixel);font-size:10px">
      \u{1F3C6} CLASSEMENT<br><br><span style="font-size:9px;font-family:inherit">Supabase non configuré — le classement n'est pas disponible en mode hors-ligne.</span>
    </div>`;
    return;
  }

  const SORTS = [
    { key: 'reputation',          label: '⭐ Réputation'   },
    { key: 'dex_kanto_count',     label: '\u{1F4D6} Dex Kanto'   },
    { key: 'dex_national_count',  label: '\u{1F4D7} Dex National' },
    { key: 'shiny_species_count', label: '✨ Chromas'       },
    { key: 'total_caught',        label: '\u{1F3AF} Capturés'    },
    { key: 'total_sold',          label: '\u{1F4B0} Ventes'      },
    { key: 'total_money_earned',  label: '\u{1F4B5} Gains total'  },
  ];

  const PERIODS = [
    { key: 'alltime', label: 'All time' },
    { key: 'weekly',  label: 'Cette semaine' },
    { key: 'daily',   label: "Aujourd'hui" },
  ];

  const btnStyle = (active) =>
    `font-family:var(--font-pixel);font-size:7px;padding:4px 9px;border-radius:var(--radius-sm);cursor:pointer;` +
    `background:${active ? 'var(--red)' : 'var(--bg)'};` +
    `border:1px solid ${active ? 'var(--red)' : 'var(--border)'};` +
    `color:${active ? '#fff' : 'var(--text-dim)'}`;

  tab.innerHTML = `
    <div style="padding:16px;max-width:820px">
      <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold);margin-bottom:12px">\u{1F3C6} CLASSEMENT MONDIAL</div>

      <!-- Période -->
      <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;align-items:center">
        <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">PÉRIODE :</span>
        ${PERIODS.map(p => `<button class="lb-period-btn" data-period="${p.key}" style="${btnStyle(_lbPeriod === p.key)}">${p.label}</button>`).join('')}
        <button id="btnLbRefresh" style="${btnStyle(false)};margin-left:auto">⟳</button>
      </div>

      <!-- Catégorie -->
      <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
        <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">CATÉGORIE :</span>
        ${SORTS.map(s => `<button class="lb-sort-btn" data-sort="${s.key}" style="${btnStyle(_lbSortBy === s.key)}">${s.label}</button>`).join('')}
      </div>

      <!-- Ma position -->
      <div id="lbMyEntry" style="margin-bottom:10px;padding:10px 12px;background:rgba(255,204,90,.07);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);font-size:9px;color:var(--text-dim)">
        Chargement de votre position…
      </div>

      <!-- Tableau -->
      <div id="lbTable" style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;min-height:120px">
        <div style="padding:16px;color:var(--text-dim);font-size:10px;text-align:center">Chargement…</div>
      </div>

      <div style="margin-top:8px;font-size:8px;color:var(--text-dim);text-align:right">
        Top 50 · Mis à jour toutes les 2h si actif ·
        ${supaSession ? `<span style="color:var(--green)">Connecté ✓</span>` : `<span>Anonyme — <a href="#" id="lbGoLogin" style="color:var(--gold);text-decoration:none">Connecte-toi</a></span>`}
      </div>
    </div>`;

  tab.querySelectorAll('.lb-sort-btn').forEach(btn => {
    btn.addEventListener('click', () => { _lbSortBy = btn.dataset.sort; renderLeaderboardTab(); });
  });
  tab.querySelectorAll('.lb-period-btn').forEach(btn => {
    btn.addEventListener('click', () => { _lbPeriod = btn.dataset.period; renderLeaderboardTab(); });
  });
  tab.querySelector('#btnLbRefresh')?.addEventListener('click', () => renderLeaderboardTab());
  tab.querySelector('#lbGoLogin')?.addEventListener('click', e => { e.preventDefault(); switchTab('tabCompte'); });

  await supaUpdateLeaderboardAnon();
  _loadLeaderboardTable();
}

async function _loadLeaderboardTable() {
  if (!_supabase) return;

  const SORT_COLS = {
    reputation:          'reputation',
    dex_kanto_count:     'dex_kanto_count',
    dex_national_count:  'dex_national_count',
    shiny_species_count: 'shiny_species_count',
    total_caught:        'total_caught',
    total_sold:          'total_sold',
    total_money_earned:  'total_money_earned',
  };
  const SORT_LABELS = {
    reputation:          '⭐ Rép.',
    dex_kanto_count:     '\u{1F4D6} Kanto',
    dex_national_count:  '\u{1F4D7} National',
    shiny_species_count: '✨ Chroma',
    total_caught:        '\u{1F3AF} Cap.',
    total_sold:          '\u{1F4B0} Ventes',
    total_money_earned:  '\u{1F4B5} Gains',
  };

  const col = SORT_COLS[_lbSortBy] || 'reputation';

  // Period filter via updated_at
  const PERIOD_MS = { daily: 86400_000, weekly: 604800_000 };
  const cutoff = PERIOD_MS[_lbPeriod]
    ? new Date(Date.now() - PERIOD_MS[_lbPeriod]).toISOString()
    : null;

  let query = _supabase
    .from('leaderboard')
    .select('token, user_id, gang_name, boss_name, boss_sprite, reputation, total_caught, shiny_count, shiny_species_count, dex_kanto_count, dex_national_count, total_sold, total_money_earned, agents_count, is_anonymous, updated_at')
    .order(col, { ascending: false })
    .limit(50);

  if (cutoff) query = query.gte('updated_at', cutoff);

  const { data: rows, error } = await query;

  // Own entry (always alltime for "my rank" banner)
  const { data: myRow } = await _supabase
    .from('leaderboard')
    .select('gang_name, reputation, total_caught, shiny_species_count, dex_kanto_count, dex_national_count, total_sold, total_money_earned, updated_at')
    .eq('token', _lbToken)
    .maybeSingle();

  // Own rank in current period+sort
  let myRank = '—';
  if (myRow) {
    let rankQ = _supabase.from('leaderboard').select('token', { count: 'exact', head: true }).gt(col, myRow[col] || 0);
    if (cutoff) rankQ = rankQ.gte('updated_at', cutoff);
    const { count } = await rankQ;
    if (count !== null) myRank = `#${count + 1}`;
  }

  // My entry banner
  const myEntryEl = document.getElementById('lbMyEntry');
  if (myEntryEl) {
    if (myRow) {
      const updAgo = myRow.updated_at ? _lbAgo(new Date(myRow.updated_at)) : '?';
      myEntryEl.innerHTML = `
        <span style="color:var(--gold);font-family:var(--font-pixel);font-size:9px">${myRow.gang_name}</span>
        <span style="margin-left:12px">Rang <b style="color:var(--gold)">${myRank}</b></span>
        <span style="margin-left:12px;color:var(--text-dim)">⭐ ${(myRow.reputation||0).toLocaleString('fr-FR')}</span>
        <span style="margin-left:12px;color:var(--text-dim)">✨ ${myRow.shiny_species_count||0}</span>
        <span style="margin-left:12px;color:var(--text-dim)">\u{1F4D6} ${myRow.dex_kanto_count||0}/151</span>
        <span style="margin-left:auto;font-size:8px;opacity:.6">mis à jour ${updAgo}</span>`;
      myEntryEl.style.cssText += ';display:flex;align-items:center;gap:0';
    } else {
      myEntryEl.textContent = "Votre entrée n'est pas encore dans le classement.";
    }
  }

  const tableEl = document.getElementById('lbTable');
  if (!tableEl) return;

  if (error || !rows?.length) {
    const periodLabel = { alltime: 'all time', weekly: 'cette semaine', daily: "aujourd'hui" }[_lbPeriod] || '';
    tableEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-dim);font-size:10px">Aucune entrée ${periodLabel} — sois le premier !</div>`;
    return;
  }

  const MEDALS = ['\u{1F947}','\u{1F948}','\u{1F949}'];
  const sortLabel = SORT_LABELS[_lbSortBy] || '⭐ Rép.';

  tableEl.innerHTML = `
    <div style="display:grid;grid-template-columns:36px 1fr auto;border-bottom:1px solid var(--border);padding:6px 10px;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">
      <span>#</span><span>Gang</span><span style="text-align:right">${sortLabel}   ✨   \u{1F4D6}</span>
    </div>
    ${rows.map((p, i) => {
      const isMe  = p.token === _lbToken;
      const medal = MEDALS[i] || `<span style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim)">${i+1}</span>`;
      const nameTag = p.is_anonymous
        ? `<span style="font-size:8px;color:var(--text-dim)">Joueur anonyme <span style="opacity:.5">#${p.token.slice(-5)}</span></span>`
        : `<span style="font-size:9px">${p.gang_name}</span>`;
      const sprite = p.boss_sprite
        ? `<img src="https://play.pokemonshowdown.com/sprites/gen5/${p.boss_sprite}.png" style="width:32px;height:32px;image-rendering:pixelated" onerror="this.style.display='none'">`
        : `<div style="width:32px;height:32px;background:var(--bg);border-radius:4px"></div>`;
      const val = p[col] ?? 0;
      const valStr = typeof val === 'number' ? val.toLocaleString('fr-FR') : val;
      const ago = p.updated_at ? _lbAgo(new Date(p.updated_at)) : '';
      return `<div style="display:grid;grid-template-columns:36px auto 1fr auto;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--border);background:${isMe ? 'rgba(255,204,90,.07)' : ''};border-left:3px solid ${isMe ? 'var(--gold)' : 'transparent'}">
        <span style="text-align:center;font-size:14px">${medal}</span>
        ${sprite}
        <div style="min-width:0">
          ${isMe ? `<div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">${p.gang_name} <span style="font-size:7px;opacity:.7">◄ toi</span></div>` : nameTag}
          <div style="font-size:8px;color:var(--text-dim);margin-top:1px">${p.boss_name || ''}${ago ? ` · ${ago}` : ''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">${valStr}</div>
          <div style="font-size:8px;color:var(--text-dim);margin-top:2px">✨ ${p.shiny_species_count||0}   \u{1F4D6} ${p.dex_kanto_count||0}/151</div>
        </div>
      </div>`;
    }).join('')}`;
}

function _lbAgo(date) {
  const ms = Date.now() - date.getTime();
  if (ms < 60_000)    return "à l'instant";
  if (ms < 3600_000)  return `il y a ${Math.round(ms/60_000)}min`;
  if (ms < 86400_000) return `il y a ${Math.round(ms/3600_000)}h`;
  return `il y a ${Math.round(ms/86400_000)}j`;
}

// ── Compte Tab UI ─────────────────────────────────────────────────
async function renderCompteTab() {
  const tab = document.getElementById('tabCompte');
  if (!tab) return;

  if (!supaConfigured()) {
    tab.innerHTML = `
      <div style="padding:40px;text-align:center;color:var(--text-dim)">
        <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold);margin-bottom:20px">☁ COMPTE CLOUD</div>
        <div style="font-size:11px;margin-bottom:12px">Supabase non configuré.</div>
        <div style="font-size:10px;line-height:1.8">
          1. Copie <code style="color:var(--gold)">game/config.example.js</code> → <code style="color:var(--gold)">game/config.js</code><br>
          2. Remplis <code>SUPABASE_URL</code> et <code>SUPABASE_ANON_KEY</code><br>
          3. Suis le guide SQL dans <code>docs/supabase-setup.md</code>
        </div>
      </div>`;
    return;
  }

  if (!supaSession) {
    // ── Formulaire de connexion ──────────────────────────────────
    tab.innerHTML = `
      <div style="max-width:380px;margin:48px auto;padding:28px;background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius)">
        <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold);margin-bottom:8px;text-align:center">☁ COMPTE CLOUD</div>
        <div style="font-size:9px;color:var(--text-dim);text-align:center;margin-bottom:24px">
          Connecte-toi pour activer la sauvegarde cloud et le classement.
        </div>
        <div id="supaMsg" style="font-size:10px;min-height:18px;text-align:center;margin-bottom:12px"></div>
        <div style="margin-bottom:12px">
          <label style="font-size:9px;display:block;margin-bottom:4px;color:var(--text-dim);letter-spacing:.05em">EMAIL</label>
          <input id="supaEmail" type="email" placeholder="joueur@exemple.com" style="width:100%;padding:9px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:11px;outline:none">
        </div>
        <div style="margin-bottom:24px">
          <label style="font-size:9px;display:block;margin-bottom:4px;color:var(--text-dim);letter-spacing:.05em">MOT DE PASSE</label>
          <input id="supaPassword" type="password" placeholder="••••••••" style="width:100%;padding:9px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:11px;outline:none">
        </div>
        <div style="display:flex;gap:8px">
          <button id="btnSupaLogin"    style="flex:1;padding:11px;background:var(--red);border:none;border-radius:var(--radius-sm);color:#fff;font-family:var(--font-pixel);font-size:9px;cursor:pointer;letter-spacing:.04em">CONNEXION</button>
          <button id="btnSupaRegister" style="flex:1;padding:11px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font-pixel);font-size:9px;cursor:pointer;letter-spacing:.04em">CRÉER COMPTE</button>
        </div>
      </div>`;

    const msg = () => tab.querySelector('#supaMsg');
    const setMsg = (txt, color) => {
      const el = msg();
      if (el) { el.textContent = txt; el.style.color = color || 'var(--text)'; }
    };

    tab.querySelector('#btnSupaLogin')?.addEventListener('click', async () => {
      const email    = tab.querySelector('#supaEmail')?.value.trim();
      const password = tab.querySelector('#supaPassword')?.value;
      if (!email || !password) { setMsg('Remplis tous les champs.', 'var(--red)'); return; }
      setMsg('Connexion…', 'var(--gold)');
      const { error } = await supaSignIn(email, password);
      if (error) setMsg(error, 'var(--red)');
    });

    tab.querySelector('#btnSupaRegister')?.addEventListener('click', async () => {
      const email    = tab.querySelector('#supaEmail')?.value.trim();
      const password = tab.querySelector('#supaPassword')?.value;
      if (!email || !password) { setMsg('Remplis tous les champs.', 'var(--red)'); return; }
      if (password.length < 6) { setMsg('Mot de passe trop court (6 caractères min).', 'var(--red)'); return; }
      setMsg('Création du compte…', 'var(--gold)');
      const { error } = await supaSignUp(email, password);
      if (error) setMsg(error, 'var(--red)');
      else setMsg('Compte créé ! Vérifie ton email pour confirmer, puis connecte-toi.', 'var(--green)');
    });

  } else {
    // ── Interface connectée ──────────────────────────────────────
    const user     = supaSession.user;
    const syncAgo  = supaLastSync
      ? `il y a ${Math.round((Date.now() - supaLastSync) / 1000)}s`
      : 'jamais';
    const syncColor = supaLastSync ? 'var(--green)' : '#ff9900';
    const syncLabel = supaSyncing ? '⟳ Synchronisation…' : supaLastSync ? `✅ Syncé ${syncAgo}` : '⚠ Non encore syncé';

    tab.innerHTML = `
      <div style="padding:16px;max-width:760px">
        <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold);margin-bottom:16px">☁ COMPTE CLOUD</div>

        <!-- Carte joueur -->
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          ${state.gang.bossSprite
            ? `<img src="https://play.pokemonshowdown.com/sprites/gen5/${state.gang.bossSprite}.png" style="width:64px;height:64px;image-rendering:pixelated">`
            : ''}
          <div style="flex:1;min-width:160px">
            <div style="font-family:var(--font-pixel);font-size:11px;margin-bottom:6px">${state.gang.name}</div>
            <div style="font-size:10px;color:var(--text-dim);margin-bottom:4px">${user.email}</div>
            <div style="font-size:10px">⭐ <b style="color:var(--gold)">${state.gang.reputation || 0}</b> réputation</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;min-width:160px">
            <div style="font-size:9px;color:${syncColor};text-align:right;margin-bottom:2px">${syncLabel}</div>
            <button id="btnSupaForceSave"  style="padding:7px 12px;background:var(--bg);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--green);font-size:9px;cursor:pointer;letter-spacing:.04em">↑ Sauvegarder maintenant</button>
            <button id="btnSupaLoadCloud"  style="padding:7px 12px;background:var(--bg);border:1px solid var(--blue);border-radius:var(--radius-sm);color:var(--blue);font-size:9px;cursor:pointer;letter-spacing:.04em">↓ Charger depuis le cloud</button>
            <button id="btnSupaLogout"     style="padding:7px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);font-size:9px;cursor:pointer">Déconnexion</button>
          </div>
        </div>

        <!-- Historique des snapshots -->
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px">
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--blue);margin-bottom:12px">📸 HISTORIQUE CLOUD <span style="font-size:7px;opacity:.6">(toutes les 5 min · 6 max)</span></div>
          <div id="supaSnapshots" style="min-height:40px">
            <div style="color:var(--text-dim);font-size:10px;padding:4px">Chargement…</div>
          </div>
        </div>

        <!-- Lien classement -->
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:14px;display:flex;align-items:center;gap:12px">
          <div style="flex:1">
            <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:4px">🏆 CLASSEMENT MONDIAL</div>
            <div style="font-size:9px;color:var(--text-dim)">Visible depuis l'onglet dédié — disponible pour tous, même sans compte.</div>
          </div>
          <button id="btnGoLeaderboard" style="font-family:var(--font-pixel);font-size:8px;padding:8px 14px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;white-space:nowrap">Voir 🏆</button>
        </div>
      </div>`;

    tab.querySelector('#btnSupaForceSave')?.addEventListener('click', async () => {
      _lbLastPushAt        = 0;   // forcer le throttle leaderboard
      _lbLastFingerprint   = '';   // forcer le dirty check leaderboard
      _cloudSaveFingerprint = '';  // forcer le dirty check cloud save
      await supaCloudSave();
      await supaUpdateLeaderboardAnon();
    });
    tab.querySelector('#btnSupaLoadCloud')?.addEventListener('click', async () => {
      await supaForceCloudLoad();
    });
    tab.querySelector('#btnSupaLogout')?.addEventListener('click', () => {
      showConfirm('Se déconnecter du compte cloud ?', async () => { await supaSignOut(); }, null, { danger: true, confirmLabel: 'Déconnecter', cancelLabel: 'Annuler' });
    });
    tab.querySelector('#btnGoLeaderboard')?.addEventListener('click', () => switchTab('tabLeaderboard'));

    // Charger les snapshots en async
    supaFetchSnapshots().then(snapshots => {
      const el = document.getElementById('supaSnapshots');
      if (!el) return;
      if (!snapshots.length) {
        el.innerHTML = `<div style="color:var(--text-dim);font-size:9px;font-style:italic">Aucun snapshot disponible — le premier sera créé dans 5 minutes.</div>`;
        return;
      }
      const now = Date.now();
      el.innerHTML = snapshots.map(s => {
        const ts      = new Date(s.saved_at);
        const diffMs  = now - ts.getTime();
        const diffMin = Math.round(diffMs / 60000);
        const ago     = diffMin < 1 ? 'à l\'instant'
                      : diffMin < 60 ? `il y a ${diffMin} min`
                      : `il y a ${Math.round(diffMin / 60)}h`;
        const label   = ts.toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
        return `<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;min-width:0">
            <div style="font-size:9px;color:var(--text)">${s.gang_name}</div>
            <div style="font-size:8px;color:var(--text-dim)">⭐ ${(s.rep||0).toLocaleString('fr-FR')} rép · ${label} <span style="opacity:.6">(${ago})</span></div>
          </div>
          <button data-snapshot-id="${s.id}" style="flex-shrink:0;font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--bg);border:1px solid var(--blue);border-radius:var(--radius-sm);color:var(--blue);cursor:pointer;white-space:nowrap">⏪ Restaurer</button>
        </div>`;
      }).join('');

      el.querySelectorAll('[data-snapshot-id]').forEach(btn => {
        btn.addEventListener('click', () => supaRestoreSnapshot(Number(btn.dataset.snapshotId)));
      });
    });

  }
}

// ════════════════════════════════════════════════════════════════

// ── Version check on boot ─────────────────────────────────────
// If the stored version doesn't match APP_VERSION, a new deploy
// has happened → store the new version then hard-reload.
function checkVersionOnBoot() {
  const PG_VER_KEY = 'pg.appVersion';
  const stored = localStorage.getItem(PG_VER_KEY);
  if (stored && stored !== APP_VERSION) {
    localStorage.setItem(PG_VER_KEY, APP_VERSION);
    location.reload(true);
    return true; // signal: reload in progress
  }
  localStorage.setItem(PG_VER_KEY, APP_VERSION);
  return false;
}

// ── Remote version polling (every 5 min) ─────────────────────
// Fetches index.html with a cache-buster, reads the meta tag,
// shows a sticky banner if a new version is available.
let _remoteVersionBannerShown = false;
function pollRemoteVersion() {
  if (_remoteVersionBannerShown) return;
  fetch(`./index.html?_v=${Date.now()}`, { cache: 'no-store' })
    .then(r => r.text())
    .then(html => {
      const match = html.match(/<meta\s+name="app-version"\s+content="([^"]+)"/);
      if (!match) return;
      const remoteVer = match[1];
      if (remoteVer !== APP_VERSION && !_remoteVersionBannerShown) {
        _remoteVersionBannerShown = true;
        showUpdateBanner(remoteVer);
      }
    })
    .catch(() => {}); // silently ignore network errors
}

function showUpdateBanner(newVer) {
  document.getElementById('updateBanner')?.remove();

  const COUNTDOWN = 60; // secondes avant reload forcé
  let remaining = COUNTDOWN;

  const banner = document.createElement('div');
  banner.id = 'updateBanner';
  banner.style.cssText = `
    position:fixed; top:0; left:0; right:0; z-index:99999;
    background:#cc3333; color:#fff; text-align:center;
    padding:10px 16px; font-size:13px; font-family:inherit;
    display:flex; align-items:center; justify-content:center; gap:12px;
    box-shadow:0 2px 12px rgba(0,0,0,0.5);
  `;
  banner.innerHTML = `
    <span id="updateBannerMsg">⚡ Nouvelle version <strong>${newVer}</strong> — rechargement dans <strong id="updateCountdown">${COUNTDOWN}</strong>s</span>
    <button id="updateBannerBtn" style="
      background:#fff; color:#cc3333; border:none; border-radius:4px;
      padding:4px 12px; font-size:12px; cursor:pointer; font-weight:bold;
    ">Recharger maintenant</button>
  `;
  document.body.prepend(banner);

  const doReload = () => { saveState(); location.reload(true); };

  document.getElementById('updateBannerBtn')?.addEventListener('click', doReload);

  const ticker = setInterval(() => {
    remaining--;
    const el = document.getElementById('updateCountdown');
    if (el) el.textContent = remaining;
    if (remaining <= 0) { clearInterval(ticker); doReload(); }
  }, 1000);
}

// ── Daily scheduled reload at 12h00 and 00h00 ────────────────
// 30s before the deadline a toast countdown starts,
// then saveState() + hard reload to pick up the new deploy.
let _dailyReloadLastHour = -1;   // prevents double-trigger in same minute
let _dailyCountdownActive = false;

function startDailyReloadSchedule() {
  setInterval(_checkDailyReload, 30000); // check every 30 seconds
}

function _checkDailyReload() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  // Trigger 1 minute before 12:00 or 00:00 to show countdown
  const isReloadHour = (h === 11 && m === 59) || (h === 23 && m === 59);
  const reloadKey = h < 12 ? 0 : 12; // 0 or 12 identifies which window

  if (isReloadHour && _dailyReloadLastHour !== reloadKey && !_dailyCountdownActive) {
    _dailyCountdownActive = true;
    _dailyReloadLastHour = reloadKey;
    _runDailyCountdown(60); // 60 second countdown
  }

  // Safety: if we somehow missed the countdown, force reload at the exact hour
  const isMissedReload = (h === 12 || h === 0) && m === 0 && _dailyReloadLastHour !== reloadKey;
  if (isMissedReload) {
    _dailyReloadLastHour = reloadKey;
    saveState();
    location.reload(true);
  }
}

function _runDailyCountdown(seconds) {
  // Show persistent warning toast
  const container = document.getElementById('notifications');
  if (!container) { _triggerDailyReload(); return; }

  const el = document.createElement('div');
  el.className = 'toast warning';
  el.id = 'dailyReloadToast';
  el.style.cssText = 'position:relative; min-width:220px; pointer-events:none;';
  el.textContent = `🔄 Maintenance — rechargement dans ${seconds}s`;
  container.appendChild(el);

  let remaining = seconds;
  const interval = setInterval(() => {
    remaining--;
    const toastEl = document.getElementById('dailyReloadToast');
    if (toastEl) toastEl.textContent = `🔄 Maintenance — rechargement dans ${remaining}s`;
    if (remaining <= 0) {
      clearInterval(interval);
      _triggerDailyReload();
    }
  }, 1000);
}

function _triggerDailyReload() {
  saveState();
  // Navigate to hub tab before reload so player lands on it after
  switchTab('tabGang');
  setTimeout(() => location.reload(true), 500);
}

function showMigrationBanner({ from, toLegacyKey, fields }) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:12000;
    display:flex;align-items:center;justify-content:center;padding:16px;
    animation:fadeIn .3s ease
  `;
  const fieldsHtml = fields.length
    ? `<ul style="margin:8px 0 0 0;padding-left:18px;font-size:9px;color:var(--text-dim);line-height:1.8">
        ${fields.map(f => `<li>${f}</li>`).join('')}
      </ul>`
    : '';
  const legacyNote = toLegacyKey
    ? `<div style="margin-top:8px;font-size:9px;color:var(--red);background:rgba(255,0,0,.07);padding:6px 8px;border-radius:4px;border-left:2px solid var(--red)">
        ⚠ Ancienne sauvegarde détectée (<code style="font-size:9px">${toLegacyKey}</code>).<br>
        Convertie et transférée vers le slot actuel. L'ancienne clé a été supprimée.
      </div>`
    : '';

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);
                padding:22px 24px;max-width:420px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,.6)">
      <div style="font-family:var(--font-pixel);font-size:11px;color:var(--gold);margin-bottom:4px">
        🔄 SAVE MISE À JOUR
      </div>
      <div style="font-size:10px;color:var(--text-dim);margin-bottom:4px">
        Depuis : <span style="color:var(--text)">${from}</span> →
        schéma <span style="color:var(--gold)">v${SAVE_SCHEMA_VERSION}</span>
      </div>
      ${fields.length ? `<div style="font-size:9px;color:var(--text-dim);margin-top:6px">Nouveaux éléments ajoutés :</div>${fieldsHtml}` : ''}
      ${legacyNote}
      <div style="margin-top:8px;font-size:9px;color:var(--text-dim)">
        Ta progression, Pokémon et argent sont intacts. ✅
      </div>
      <div style="margin-top:16px;text-align:right">
        <button id="btnMigrationOk" class="btn-gold" style="padding:6px 20px;font-size:10px">
          OK, continuer →
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#btnMigrationOk').addEventListener('click', () => {
    overlay.remove();
    saveState(); // persiste le nouveau schéma
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ════════════════════════════════════════════════════════════════
// GLOBAL EXPORTS — functions/constants needed by extracted modules
// ════════════════════════════════════════════════════════════════
Object.assign(globalThis, {
  // Utility functions
  t, pick, weightedPick, uid, randInt, addLog, speciesName, playSE,
  getMysteryEggCost, trainerSprite,
  // UI / state helpers
  notify, saveState,
  checkForNewlyUnlockedZones, updateTopBar, tryAutoIncubate,
  renderZonesTab, renderGangTab, renderAgentsTab, renderPokemonGrid, renderEggsView, renderGangBasePanel,
  // Audio
  SFX,
  // Zone system — logique pure (zoneSystem.js)
  initZone, spawnInZone, makePokemon, makeTrainerTeam, makeRaidSpawn,
  getPokemonPower, levelUpPokemon, getZoneAgentSlots,
  getCombatRepGain, resolveCombat, applyCombatResult,
  addBattleLogEntry, pushFeedEvent, rollChestLoot,
  triggerGymRaid, investInZone,
  tryCapture, calculateStats, showCaptureBurst,
  checkForNewlyUnlockedZones, showZoneUnlockPopup, _processZoneUnlockQueue,
  startBackgroundZone, stopBackgroundZone, syncBackgroundZones,
  activateEvent, isBallAssistActive, clamp, getTeamPower,
  SPECIAL_TRAINER_KEYS,
  // Zone UI — fenêtres (zoneWindows.js)
  openZoneWindow, closeZoneWindow,
  renderZoneWindows, buildZoneWindowEl, patchZoneWindow,
  removeSpawn, updateZoneTimers, tickZoneSpawn,
  renderSpawnInWindow, animateCapture, buildPlayerTeamForZone,
  _tryWingDrop, _addVSBadge, _refreshRaidBtn,
  openCollectionModal, showCollectionEncounter, startZoneCollection,
  showCollectionResult, spawnCoinRain, autoCollectZone, collectAllZones,
  openCombatPopup, executeCombat, closeCombatPopup,
  // Finance / combat / UI helpers
  checkMoneyMilestone, showRarePopup, checkPlayerStatPoints,
  pokeSpriteBack,
  // Data constants
  GYM_ORDER,
  MISSIONS, HOURLY_QUEST_POOL, HOURLY_QUEST_REROLL_COST,
  BASE_PRICE, POTENTIAL_MULT, NATURES, BALLS, MYSTERY_EGG_POOL,
  MAX_COMBAT_REWARD, BALL_SPRITES,
  AGENT_NAMES_M, AGENT_NAMES_F, AGENT_SPRITES, AGENT_PERSONALITIES,
  TITLE_REQUIREMENTS, TITLE_BONUSES, AGENT_RANK_LABELS, RANK_CHAIN,
  // sessionObjectives module
  isZoneUnlocked,
  BOOST_DURATIONS, ITEM_SPRITE_URLS,
  // trainingRoom module
  pokeSprite, tryAutoEvolution,
  // pension module
  showConfirm, renderPCTab, switchTab,
  getMaxPensionSlots, getPensionSlotIds,
  eggSprite, eggImgTag, EGG_SPRITES,
  // zoneSelector module — zone helpers + data it reads from globalThis
  isZoneDegraded, getZoneMastery,
  getZoneSlotCost, ZONE_SLOT_COSTS, ZONE_BGS, SHOP_ITEMS,
  // gangBase module — helpers needed by modules/ui/gangBase.js
  openTeamPicker, openRareCandyPicker,
  pokemonDisplayName, sanitizeSpriteName,
  getDexKantoCaught, getDexNationalCaught, getShinySpeciesCount,
  getBossFullTitle, getTitleLabel,
  KANTO_DEX_SIZE, NATIONAL_DEX_SIZE, COSMETIC_BGS,
});

// ── Intercepteur global des rejets non gérés GoTrue ──────────────────
// GoTrue peut générer des "unhandledrejection" liés aux locks ou aux timeouts réseau.
// On les absorbe silencieusement pour éviter le bruit console côté dev.
window.addEventListener('unhandledrejection', e => {
  const msg = e.reason?.message || String(e.reason || '');
  if (
    msg.includes('Lock') && msg.includes('stole') ||
    msg.includes('lock:sb-') ||
    msg.includes('AuthRetryableFetchError') ||
    msg.includes('Supabase request timeout')
  ) {
    e.preventDefault(); // supprime le log "Uncaught (in promise)"
  }
});

function boot() {
  // Version check — must run before anything else; may trigger reload
  if (checkVersionOnBoot()) return;

  // Try to load saved state
  const saved = loadState();
  if (saved) {
    state = saved;
    globalThis.state = state;
  }
  state.sessionStart = Date.now();

  // ── Banner de migration si save convertie ────────────────────────────────
  if (_migrationResult) {
    setTimeout(() => showMigrationBanner(_migrationResult), 1200);
  }

  // ── Notification limite dépassée → MissingNo reward ──────────
  if (state._limitViolationReward) {
    setTimeout(() => notify(
      '⚠️ Valeurs hors-limites détectées et corrigées — MissingNo Lv.1 ajouté au PC !'
    , 'gold'), 2000);
    delete state._limitViolationReward;
    saveState();
  }

  // Init tab navigation
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Tab drag-to-reorder
  (() => {
    const tabNav = document.querySelector('.tab-nav');
    if (!tabNav) return;
    tabNav.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.setAttribute('draggable', 'true');
      btn.addEventListener('dragstart', e => {
        e.dataTransfer.setData('tabReorderId', btn.dataset.tab);
        btn.style.opacity = '0.5';
      });
      btn.addEventListener('dragend', () => { btn.style.opacity = ''; });
      btn.addEventListener('dragover', e => { e.preventDefault(); btn.style.outline = '1px solid var(--gold)'; });
      btn.addEventListener('dragleave', () => { btn.style.outline = ''; });
      btn.addEventListener('drop', e => {
        e.preventDefault();
        btn.style.outline = '';
        const fromId = e.dataTransfer.getData('tabReorderId');
        if (!fromId || fromId === btn.dataset.tab) return;
        const fromBtn = tabNav.querySelector(`.tab-btn[data-tab="${fromId}"]`);
        if (!fromBtn) return;
        const allBtns = [...tabNav.querySelectorAll('.tab-btn[data-tab]')];
        const fromIdx = allBtns.indexOf(fromBtn);
        const toIdx   = allBtns.indexOf(btn);
        if (fromIdx < toIdx) btn.after(fromBtn); else btn.before(fromBtn);
        SFX.play('click');
      });
    });
  })();

  document.getElementById('btnSaveSlots')?.addEventListener('click', openSaveSlotModal);
  document.getElementById('btnBackToIntro')?.addEventListener('click', () => showIntro());
  document.getElementById('btnCodex')?.addEventListener('click', openCodexModal);

  // (legacy battle log drag code removed — battle log is now the Events tab)
  // Events tab renders on demand (switchTab triggers renderEventsTab via renderActiveTab)

  // Init filter/sort listeners for PC (reset page on change, force full rebuild)
  document.getElementById('pcSearch')?.addEventListener('input', () => {
    const val = document.getElementById('pcSearch')?.value || '';
    if (checkSecretCode(val)) {
      document.getElementById('pcSearch').value = '';
      return;
    }
    if (activeTab === 'tabPC') { pcPage = 0; renderPokemonGrid(true); }
  });
  document.getElementById('pcSort')?.addEventListener('change', () => {
    if (activeTab === 'tabPC') { pcPage = 0; renderPokemonGrid(true); }
  });
  document.getElementById('pcFilter')?.addEventListener('change', () => {
    if (activeTab === 'tabPC') { pcPage = 0; renderPokemonGrid(true); }
  });

  // Info buttons (ℹ on tab nav)
  document.querySelectorAll('.tab-info-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      showInfoModal(btn.dataset.infoTab);
    });
  });
  document.getElementById('infoModalClose')?.addEventListener('click', () => {
    document.getElementById('infoModal')?.classList.remove('active');
  });
  document.getElementById('infoModal')?.addEventListener('click', e => {
    if (e.target.id === 'infoModal') e.target.classList.remove('active');
  });

  // Init settings
  initSettings();

  // Raccourcis clavier globaux
  initKeyboardShortcuts();

  // Init missions
  initMissions();

  // Detect LLM
  detectLLM();

  // Init Supabase (auth + cloud save)
  initSupabase();

  // Show intro if not initialized
  if (!state.gang.initialized) {
    showIntro();
  }

  // Zone unlock popup bindings
  document.getElementById('zoneUnlockGo')?.addEventListener('click', () => {
    const popup = document.getElementById('zoneUnlockPopup');
    if (!popup) return;
    popup.classList.remove('show');
    const zoneId = popup._zoneId;
    if (!zoneId) { _processZoneUnlockQueue(); return; }
    switchTab('tabZones');
    if (!openZones.has(zoneId)) openZoneWindow(zoneId);
    else renderZonesTab();
    setTimeout(() => {
      const zw = document.getElementById(`zw-${zoneId}`);
      if (zw) { zw.scrollIntoView({ behavior: 'smooth' }); zw.classList.add('zone-highlight'); setTimeout(() => zw.classList.remove('zone-highlight'), 1500); }
    }, 150);
    _processZoneUnlockQueue();
  });
  document.getElementById('zoneUnlockClose')?.addEventListener('click', () => {
    document.getElementById('zoneUnlockPopup')?.classList.remove('show');
    _processZoneUnlockQueue();
  });
  document.getElementById('zoneUnlockPopup')?.addEventListener('click', e => {
    if (e.target.id === 'zoneUnlockPopup') { e.target.classList.remove('show'); _processZoneUnlockQueue(); }
  });

  // Apply cosmetics (bg theme)
  applyCosmetics();

  // Init session tracking (must be after state is loaded)
  initSession();

  // Auto-ouvre les zones favorites au chargement
  for (const zId of (state.favoriteZones || [])) {
    if (isZoneUnlocked(zId) && !openZones.has(zId)) {
      openZones.add(zId);
      initZone(zId);
      zoneSpawns[zId] = [];
      const zone = ZONE_BY_ID[zId];
      if (zone) {
        const interval = Math.round(1000 / zone.spawnRate);
        zoneSpawnTimers[zId] = setInterval(() => tickZoneSpawn(zId), interval);
      }
      if (!state.openZoneOrder) state.openZoneOrder = [];
      if (!state.openZoneOrder.includes(zId)) state.openZoneOrder.push(zId);
    }
  }

  // Apply saved UI scale
  const savedScale = state.settings?.uiScale ?? 100;
  document.documentElement.style.setProperty('--ui-scale', (savedScale / 100).toFixed(2));
  document.documentElement.style.setProperty('--zone-scale', ((state.settings?.zoneScale ?? 100) / 100).toFixed(2));
  document.body.classList.toggle('theme-light', state.settings?.lightTheme === true);
  document.body.classList.toggle('low-spec',    state.settings?.lowSpec === true);
  // Apply saved music volume
  MusicPlayer.setVolume((state.settings?.musicVol ?? 80) / 1000);

  // Initial render — force l'onglet actif correct au chargement
  switchTab(activeTab);
  renderAll();

  // Check boss sprite validity (broken save migration)
  checkBossSpriteValidity();

  // ── Charger les données de sprites (async, non-bloquant) ─────────────────
  // loaders.js doit être chargé avant app.js dans le HTML
  if (typeof loadPokemonSprites === 'function') {
    Promise.allSettled([
      loadPokemonSprites(),
      loadItemSprites(),
      loadTrainerGroups().then(data => _buildTrainerIndex(data)),
      loadZoneTrainerPools(),
    ]).then(results => {
      const labels = ['pokemon-sprites', 'item-sprites', 'trainer-sprites', 'zone-trainer-pools'];
      results.forEach((r, i) => {
        if (r.status === 'rejected') console.warn(`[Sprites] Échec chargement ${labels[i]} :`, r.reason);
      });
    });
  }

  // Start game loop
  startGameLoop();
}

window.addEventListener('DOMContentLoaded', boot);
