'use strict';

// ── Version identique à app.js ────────────────────────────────────────────────
export const APP_VERSION = '2.2.0';
export const GAME_VERSION = 'v0.1 — pre-alpha';

// Incrémenter à chaque ajout de champ majeur pour déclencher le banner migration.
export const SAVE_SCHEMA_VERSION = 8;

export const SAVE_KEYS = ['pokeforge.v6', 'pokeforge.v6.s2', 'pokeforge.v6.s3'];

export const LEGACY_SAVE_KEYS = [
  'pokeforge.v5',
  'pokeforge.v4',
  'pokeforge.v3',
  'pokeforge.v2',
  'pokeforge.v1',
  'pokeforge',
];

export const DEFAULT_STATE = {
  version: '6.0.0',
  _schemaVersion: SAVE_SCHEMA_VERSION,
  lang: 'fr',
  gang: {
    name: 'Team ???',
    bossName: 'Boss',
    bossSprite: '',
    bossZone: null,
    bossTeam: [],
    bossTeamSlots: [[], [], []],
    activeBossTeamSlot: 0,
    bossTeamSlotsPurchased: [true, false, false],
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
    incense:    0,
    rarescope:  0,
    aura:       0,
    lure:       0,
    superlure:  0,
    chestBoost: 0,
  },
  pokemons: [],
  agents: [],
  zones: {},
  pokedex: {},
  activeEvents: {},
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
    agentsEliteCount: 0,
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
    autoBuyBall: null,
    spriteMode: 'local',   // 'local'|'gen1'|'gen2'|'gen3'|'gen4'|'gen5'|'ani'|'dex'|'home'
    autoEvoChoice: false,
    autoSellAgent: {
      mode: 'all',         // 'all' | 'by_potential'
      potentials: [],
    },
    autoSellEggs: {
      mode: 'all',         // 'all' | 'by_potential'
      potentials: [],
      allowShiny: false,
    },
  },
  log: [],
  marketSales: {},
  favorites: [],
  trainingRoom: {
    pokemon: [],
    log: [],
    level: 1,
    lastFight: null,
    extraSlots: 0,         // 0–6 extra slots achetables
  },
  _savedAt: 0,
  cosmetics: {
    gameBg: null,
    bossBg: null,
    unlockedBgs: [],
    favoriteBgs: [],      // array of bg keys (fabric, image, gradient)
    activePatches: [],    // array of patch pids (max 3)
  },
  lab: {
    trackedSpecies: [],
  },
  purchases: {
    translator: false,
    cosmeticsPanel: false,
    autoIncubator: false,
    autoCollectEnabled: true,
    autoCollect: false,
    chromaCharm: false,
    scientist: false,
    scientistEnabled: true,
    autoSellAgent: false,
    autoSellAgentEnabled: true,
    autoSellEggs: false,
  },
  pension: {
    slots: [],              // array de pokemon IDs (2 base + extra achetés)
    extraSlotsPurchased: 0, // 0–4 extra slots
    eggAt: null,
  },
  eggs: [],
  playerStats: {
    baseStats: { combat: 10, capture: 10, luck: 5 },
    allocatedStats: { combat: 0, capture: 0, luck: 0 },
    statPoints: 0,
    pointsGrantedCount: 0,
  },
  playtime: 0,
  sessionStart: 0,
  openZoneOrder: [],
  favoriteZones: [],
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

export function createDefaultState() {
  return structuredClone(DEFAULT_STATE);
}
