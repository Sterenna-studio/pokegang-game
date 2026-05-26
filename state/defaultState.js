'use strict';

// ── Version identique à app.js ────────────────────────────────────────────────
export const APP_VERSION = '2.3.0';
export const GAME_VERSION = 'v0.2 — pre-alpha';

// Incrémenter à chaque ajout de champ majeur pour déclencher le banner migration.
export const SAVE_SCHEMA_VERSION = 11;

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
    introSeen: false,         // true once the Giovanni intro (or catch-up gift) has been completed
    darkraiCutsceneSeen: false,   // true once the Darkrai Nightmare cutscene has played
    johtoCinematicSeen: false,    // true once the Archer / Johto cinematic has played
    hoennCinematicSeen: false,    // true once the Steven Stone / Hoenn cinematic has played
    bossAutoCombat: false,        // le boss engage automatiquement les dresseurs dans sa zone
    competition: {
      defenseTeam: [null, null, null, null, null, null],
      defenseAgents: [null, null, null],
      defenseAgent: null,
      defenseZone: null,
      defensePublished: false,
      wins:   { attack: 0, defense: 0 },
      losses: { attack: 0, defense: 0 },
      raidCooldowns: {},
      pendingRaids: [],
    },
  },
  inventory: {
    pokeball: 50,   // ressource unique de capture
    lure: 0,
    superlure: 0,
    potion: 0,
    incense: 2,
    rarescope: 1,
    aura: 0,
    evostone: 0,
    rarecandy: 0,
    incubator: 0,
    egg_scanner: 0,
  },
  activeBall: 'pokeball', // skin cosmétique actif (boss/joueur)
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
  zones: {
    // Per-zone runtime shape (populated by initZone):
    // lossStreak: 0, contested: false, reclaimWins: 0
  },
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
    rocketDefeatedJohto: 0,
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
    offlineReportThreshold: 300, // seuil en s pour afficher le rapport au retour (0 = jamais)
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
    protectedSpecies: [],  // species_en never auto-sold by any system
  },
  log: [],
  marketSales: {},
  marketEvents: [],          // Boosts/malus actifs (marketEvents.js)
  blackMarketBulletin: null, // Bulletin marché noir (2h, blackMarket.js)
  bountyProgress: {},        // Progression des contrats trainer_bounty (par listing.id)
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
    fabricMode: 'repeat', // 'repeat' | 'full'
    fabricSize: 320,      // px, used in repeat mode
    fabricOpacity: 72,    // 30–95, alpha % of --bg dark overlay
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
    johtoUnlocked: false,
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
  encounterStats: {
    bySpecies: {},  // { 'pikachu': 12 } — nb de spawns rencontrés par espèce
    byTrainer: {},  // { 'rocketgrunt': 40 } — nb de combats engagés par type de dresseur
  },
  discoveryProgress: {
    sinnohTeaseUnlocked: false, // true after Darkrai cutscene — unlocks Sinnoh section in pokédex
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
