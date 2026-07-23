/* Gameplay config extracted from app.js */

const HOURLY_QUEST_REROLL_COST = 500; // ₽

// Boost durations in ms per item type
const BOOST_DURATIONS = {
  incense:   90000,
  rarescope: 90000,
  aura:      90000,
  lure:      60000,
  superlure: 60000,
};

// ── Auto-combat visuel (agents, zone visible) ──────────────────
// Durée totale de la séquence décorative dans zoneWindows.js (playAutoCombatVisual)
// — agent.js aligne son délai de résolution/suppression du spawn dessus pour
// que le nettoyage n'arrive jamais avant la fin de l'animation.
const AUTO_COMBAT_VISUAL_MS = 1350;

// ── Ball assist (early-game helper) ──────────────────────────
const BALL_ASSIST_MIN_BALLS    = 10;            // seuil : déclenche l'assist sous ce nombre
const BALL_ASSIST_DURATION_MS  = 2 * 60 * 1000; // 2 minutes

// ── XP passif ────────────────────────────────────────────────
const PASSIVE_XP_PER_TICK = 3; // XP accordé toutes les 30 s aux Pokémon d'équipe

// ── Log ──────────────────────────────────────────────────────
const MAX_LOG_ENTRIES = 50;

// ── UI defaults ──────────────────────────────────────────────
const DEFAULT_MUSIC_VOL    = 80;   // valeur 0-1000 (divisée par 1000 pour MusicPlayer)
const DEFAULT_UI_SCALE     = 100;  // %
const DEFAULT_ZONE_SCALE   = 100;  // %

// ── Game loop intervals (ms) ──────────────────────────────────
const TICK_AGENT_MS          =  2_000;  // agentTick — agents agissent sur les spawns visibles
const TICK_PASSIVE_AGENT_MS  = 10_000;  // passiveAgentTick — gym-raids auto
const TICK_MISSIONS_UI_MS    = 10_000;  // refresh onglet missions
const TICK_HOURLY_CHECK_MS   = 60_000;  // vérification reset quêtes horaires
const TICK_MARKET_DECAY_MS   = 5 * 60_000;  // market decay (5 min)
const TICK_VERSION_POLL_MS   = 60 * 60_000; // poll version distante (1 h)
const TICK_VERSION_FIRST_MS  = 15_000;  // premier poll au démarrage
const TICK_AUTO_SAVE_MS      = 10_000;  // auto-save
const TICK_CLOUD_SAVE_MS     = 60 * 60_000; // cloud save (1 h)
const TICK_SNAPSHOT_MS       =  6 * 60 * 60_000; // snapshot Supabase (6 h)
const TICK_LEADERBOARD_MS    =  2 * 60 * 60_000; // leaderboard push (2 h)
const TICK_TRAINING_MS       = 60_000;  // training room tick
const TICK_PENSION_MS        = 30_000;  // pension / egg tick
const TICK_PASSIVE_XP_MS     = 30_000;  // XP passif Pokémon d'équipe
const TICK_ZONE_REFRESH_MS   =  5_000;  // refresh timers de zone + fogmap
const TICK_DAILY_CHECK_MS    = 30_000;  // vérification reload quotidien

// ── Update / reload banners ───────────────────────────────────
const UPDATE_COUNTDOWN_S = 60; // secondes avant reload forcé (nouvelle version)
const DAILY_COUNTDOWN_S  = 60; // secondes avant reload quotidien

// ── Johto unlock ─────────────────────────────────────────────
const JOHTO_UNLOCK_DELAY_MS = 4_000; // délai avant vérification unlock Johto au démarrage

// ── Shiny (chroma) — taux centralisés ──────────────────────────
// Source unique : toute source de shiny du jeu dérive de BASE_SHINY_RATE
// plutôt que de coder son propre pourcentage, pour qu'un futur rééquilibrage
// n'ait qu'un seul nombre à changer. Les multiplicateurs ci-dessous
// reproduisent exactement les taux historiques de chaque système —
// aucun changement de comportement à l'introduction de ces constantes.
const BASE_SHINY_RATE   = 0.005; // 0.5%  — capture standard (rollShiny, pokemon.js)
const AURA_SHINY_RATE   = 0.025; // 2.5%  — remplace la base quand le boost Aura est actif
const CHROMA_CHARM_MULT = 2;     // ×2 permanent (achat Charme Chroma), s'applique par-dessus base OU aura

const MYSTERY_EGG_SHINY_RATE    = BASE_SHINY_RATE * 4;  // 2%  — market.js (œuf mystère)
const MISSION_REWARD_SHINY_RATE = BASE_SHINY_RATE * 4;  // 2%  — sinnohMissions.js (récompenses légendaires)
const EVENT_EGG_GIFT_SHINY_RATE = BASE_SHINY_RATE * 2;  // 1%  — zoneSystem.js (don d'œuf d'événement)
const PENSION_SHINY_RATE_NONE   = BASE_SHINY_RATE * 2;  // 1%  — pension.js, aucun parent chroma
const PENSION_SHINY_RATE_ONE    = BASE_SHINY_RATE * 10; // 5%  — pension.js, un parent chroma
const PENSION_SHINY_RATE_BOTH   = BASE_SHINY_RATE * 30; // 15% — pension.js, deux parents chroma

export {
  HOURLY_QUEST_REROLL_COST, BOOST_DURATIONS,
  BALL_ASSIST_MIN_BALLS, BALL_ASSIST_DURATION_MS,
  PASSIVE_XP_PER_TICK, MAX_LOG_ENTRIES,
  DEFAULT_MUSIC_VOL, DEFAULT_UI_SCALE, DEFAULT_ZONE_SCALE,
  TICK_AGENT_MS, TICK_PASSIVE_AGENT_MS, TICK_MISSIONS_UI_MS,
  TICK_HOURLY_CHECK_MS, TICK_MARKET_DECAY_MS,
  TICK_VERSION_POLL_MS, TICK_VERSION_FIRST_MS,
  TICK_AUTO_SAVE_MS, TICK_CLOUD_SAVE_MS, TICK_SNAPSHOT_MS, TICK_LEADERBOARD_MS,
  TICK_TRAINING_MS, TICK_PENSION_MS, TICK_PASSIVE_XP_MS,
  TICK_ZONE_REFRESH_MS, TICK_DAILY_CHECK_MS,
  UPDATE_COUNTDOWN_S, DAILY_COUNTDOWN_S,
  JOHTO_UNLOCK_DELAY_MS,
  AUTO_COMBAT_VISUAL_MS,
  BASE_SHINY_RATE, AURA_SHINY_RATE, CHROMA_CHARM_MULT,
  MYSTERY_EGG_SHINY_RATE, MISSION_REWARD_SHINY_RATE, EVENT_EGG_GIFT_SHINY_RATE,
  PENSION_SHINY_RATE_NONE, PENSION_SHINY_RATE_ONE, PENSION_SHINY_RATE_BOTH,
};
