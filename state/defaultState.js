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
    meteore: 0,         // Fragment météorique — relance le combat contre Deoxys
    sigle_magma: 0,     // Emblème Magma — relance le combat contre Groudon
    sceau_aqua: 0,      // Sceau Aqua — relance le combat contre Kyogre
    silver_wing: 0,     // Argent'Aile — collecte pour Lugia (quête + permit ×50)
    rainbow_wing: 0,    // Arcenci'Aile — collecte pour Ho-Oh (quête + permit ×50)
    cristal_bete: 0,    // Cristal Bête — relance le combat contre la Bête Sacrée choisie
    rapport_sylphe: 0,  // Rapport Sylphe — relance le combat contre Mewtwo
    plume_sacree: 0,    // Plume Sacrée — relance le combat contre un Oiseau Légendaire Kanto
    fragment_temporel: 0,  // Fragment Temporel — relance le combat contre Dialga ou Palkia
    onde_distorsion: 0,    // Onde Distorsion — relance le combat contre Giratina
    cristal_lac: 0,        // Cristal du Lac — relance le combat contre un légendaire du Lac
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
    // Captures & combats par région (missions région-aware)
    kantoCaught:    0, johtoCaught:    0, hoennCaught:    0, sinnohCaught:    0,
    kantoFightsWon: 0, johtoFightsWon: 0, hoennFightsWon: 0, sinnohFightsWon: 0,
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
    johtoUnlocked:  false,
    hoennUnlocked:  false,
    sinnohUnlocked: false,
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
  groudonMission: {
    active:          false,
    step:            0,     // 0=off 1=magma fights 2=hideout 3=admin 4=maxie 5=groudon 6=done
    magmaFightsWon:  0,     // step 1: target 20
    hideoutFightsWon: 0,    // step 2: target 12
    adminDefeated:   false, // step 3 (Tabitha)
    maxieDefeated:   false, // step 4
    groudonOwned:    false,
    totalCaptures:   0,
  },
  kyogreMission: {
    active:          false,
    step:            0,     // 0=off 1=aqua fights 2=hideout 3=admin 4=archie 5=kyogre 6=done
    aquaFightsWon:   0,     // step 1: target 20
    hideoutFightsWon: 0,    // step 2: target 12
    adminDefeated:   false, // step 3 (Matt)
    archieDefeated:  false, // step 4
    kyogreOwned:     false,
    totalCaptures:   0,
  },
  deoxysMission: {
    active:           false,  // true once quest intro shown
    step:             0,      // 0=not started 1=trainers 2=meteores 3=lab 4=director 5=deoxys 6=complete
    trainersDefeated: 0,      // step 1: target 20
    labFightsWon:     0,      // step 3: target 10
    labBossDefeated:  false,  // step 4
    deoxysOwned:      false,  // captured at least once
    totalCaptures:    0,      // total Deoxys captures (repeatable)
  },
  // ── Quêtes Johto ─────────────────────────────────────────────────────────────
  betesMission: {
    active:          false,
    step:            0,      // 0=off 1=rocket fights 2=hq fights 3=petrel 4=ariana 5=beast 6=done
    rocketFightsWon: 0,      // step 1: target 30
    hqFightsWon:     0,      // step 2: target 15
    petrelDefeated:  false,  // step 3
    arianaDefeated:  false,  // step 4
    chosenBeast:     null,   // 'raikou'|'entei'|'suicune' — chosen at step 5
    beastOwned:      false,
    totalCaptures:   0,
  },
  lugiaMission: {
    active:           false,
    step:             0,      // 0=off 1=marine fights 2=silver wings 3=eusine 4=whirl fights 5=lugia 6=done
    marineFightsWon:  0,      // step 1: target 20
    silverWings:      0,      // step 2: target 5 (auto-increments on silver_wing pickup)
    eusineDefeated:   false,  // step 3
    whirlFightsWon:   0,      // step 4: target 15
    lugiaOwned:       false,
    totalCaptures:    0,
  },
  hoohMission: {
    active:           false,
    step:             0,      // 0=off 1=rural fights 2=rainbow wings 3=kimono 4=tin fights 5=hooh 6=done
    ruralFightsWon:   0,      // step 1: target 20
    rainbowWings:     0,      // step 2: target 5 (auto-increments on rainbow_wing pickup)
    kimonoDefeated:   false,  // step 3
    tinFightsWon:     0,      // step 4: target 15
    hoohOwned:        false,
    totalCaptures:    0,
  },
  // ── Quêtes Kanto ─────────────────────────────────────────────────────────────
  birdsMission: {
    articuno: { active: false, step: 0, fightsWon: 0, bossDefeated: false, owned: false, captures: 0 },
    zapdos:   { active: false, step: 0, fightsWon: 0, bossDefeated: false, owned: false, captures: 0 },
    moltres:  { active: false, step: 0, fightsWon: 0, bossDefeated: false, owned: false, captures: 0 },
  },
  mewtwoMission: {
    active:           false,
    step:             0,      // 0=off 1=rocket fights 2=rapport 3=mansion fights 4=giovanni 5=mewtwo 6=done
    rocketFightsWon:  0,      // step 1: target 20
    rapportSylphe:    0,      // step 2: target 3 (auto-increments on rapport_sylphe pickup)
    mansionFightsWon: 0,      // step 3: target 15
    giovanniDefeated: false,  // step 4
    mewtwoOwned:      false,
    totalCaptures:    0,
  },
  // ── Quêtes Sinnoh ─────────────────────────────────────────────────────────────
  galaxieMission: {
    active:              false,
    step:                0,      // 0=off 1=galactic fights 2=commanders 3=spear pillar 4=cyrus 5=legend choice 6=done
    galacticFightsWon:   0,      // step 1: target 20
    marsDefeated:        false,  // step 2a
    jupiterDefeated:     false,  // step 2b
    spearFightsWon:      0,      // step 3: target 12
    cyrusDefeated:       false,  // step 4
    chosenLegend:        null,   // 'dialga'|'palkia'
    legendOwned:         false,
    totalCaptures:       0,
  },
  giratinaMission: {
    active:              false,
    step:                0,      // 0=off 1=turnback fights 2=saturn 3=giratina 4=done
    turnbackFightsWon:   0,      // step 1: target 10
    saturnDefeated:      false,  // step 2
    giratinaOwned:       false,
    totalCaptures:       0,
  },
  lakeMission: {
    uxie:    { active: false, step: 0, fightsWon: 0, owned: false, captures: 0 },
    mesprit: { active: false, step: 0, fightsWon: 0, owned: false, captures: 0 },
    azelf:   { active: false, step: 0, fightsWon: 0, owned: false, captures: 0 },
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
