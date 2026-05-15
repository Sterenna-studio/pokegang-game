// ════════════════════════════════════════════════════════════════
// Zones Data V2 — Extension du système de zones (alpha)
//
// DUAL VERSION : zones-data.js reste intact (classic script, ZONES global).
// Ce fichier ES module ajoute : niveaux de zone, XP, événements de zone.
// Aucune donnée de zones-data.js n'est dupliquée ici.
// ════════════════════════════════════════════════════════════════

'use strict';

// ── Zone level system ─────────────────────────────────────────
// XP total cumulé pour atteindre chaque niveau (index 0 = niveau 1 = base).
// Pour atteindre le niveau N, il faut ZONE_LEVEL_XP_THRESHOLDS[N-1] XP.
const ZONE_LEVEL_XP_THRESHOLDS = [
  0,     // niveau 1  (base)
  50,    // niveau 2
  150,   // niveau 3
  350,   // niveau 4
  700,   // niveau 5
  1200,  // niveau 6
  1900,  // niveau 7
  2800,  // niveau 8
  4000,  // niveau 9
  5500,  // niveau 10 (max)
];

const ZONE_MAX_LEVEL = ZONE_LEVEL_XP_THRESHOLDS.length; // 10

// ── XP sources ───────────────────────────────────────────────
// XP octroyé à la zone par type d'action
const ZONE_XP_SOURCES = {
  capture_common:    2,
  capture_uncommon:  3,
  capture_rare:      5,
  capture_very_rare: 8,
  capture_legendary: 15,
  combat_win:        3,
  chest:             2,
  event_complete:    10,
};

// ── Level bonuses ─────────────────────────────────────────────
// Bonus additifs appliqués à la zone selon son niveau.
// Toutes les clés sont optionnelles — absence = pas de bonus.
//   spawnRate   : +X% taux de spawn de la zone
//   moneyMult   : +X% argent gagné dans la zone
//   rareChance  : +X% chance de spawn rare dans le pool
//   shinyBonus  : +X% chance shiny dans la zone
//   agentXpBonus: +X% XP agent pour les actions dans la zone
const ZONE_LEVEL_BONUSES = {
  1:  {},
  2:  { spawnRate: 0.05 },
  3:  { spawnRate: 0.10, moneyMult: 0.05 },
  4:  { spawnRate: 0.15, moneyMult: 0.10, rareChance: 0.05 },
  5:  { spawnRate: 0.20, moneyMult: 0.15, rareChance: 0.10, agentXpBonus: 0.10 },
  6:  { spawnRate: 0.25, moneyMult: 0.20, rareChance: 0.15, agentXpBonus: 0.15 },
  7:  { spawnRate: 0.30, moneyMult: 0.25, rareChance: 0.20, shinyBonus: 0.05, agentXpBonus: 0.20 },
  8:  { spawnRate: 0.35, moneyMult: 0.30, rareChance: 0.25, shinyBonus: 0.10, agentXpBonus: 0.25 },
  9:  { spawnRate: 0.40, moneyMult: 0.35, rareChance: 0.30, shinyBonus: 0.15, agentXpBonus: 0.30 },
  10: { spawnRate: 0.50, moneyMult: 0.50, rareChance: 0.40, shinyBonus: 0.20, agentXpBonus: 0.40 },
};

// ── Zone events ───────────────────────────────────────────────
// Délai entre deux événements par zone (en ms).
// Chaque niveau de zone réduit le délai maximum de levelReduction.
const ZONE_EVENT_INTERVAL_MS = {
  min:            25 * 60 * 1000, // 25 min
  max:            90 * 60 * 1000, // 90 min
  levelReduction:  5 * 60 * 1000, // -5 min par niveau
};

// Durée des événements à effet temporaire (null = résolution instantanée)
const ZONE_EVENT_DURATION_MS = {
  territory_bonus:    20 * 60 * 1000, // 20 min
  bounty_hunt:        15 * 60 * 1000, // 15 min
  legendary_sighting: 10 * 60 * 1000, // 10 min
  rival_invasion:     null,            // instantané (combat)
  trainer_tournament: null,            // instantané (3 combats)
};

// Pool d'événements par type de zone (weight = poids de tirage)
const ZONE_EVENT_POOLS = {
  route: [
    { type: 'territory_bonus',    weight: 30, minLevel: 1 },
    { type: 'bounty_hunt',        weight: 25, minLevel: 2 },
    { type: 'rival_invasion',     weight: 20, minLevel: 3 },
    { type: 'trainer_tournament', weight: 15, minLevel: 4 },
    { type: 'legendary_sighting', weight: 10, minLevel: 5 },
  ],
  city: [
    { type: 'territory_bonus',    weight: 25, minLevel: 1 },
    { type: 'rival_invasion',     weight: 30, minLevel: 2 },
    { type: 'trainer_tournament', weight: 25, minLevel: 3 },
    { type: 'bounty_hunt',        weight: 15, minLevel: 2 },
    { type: 'legendary_sighting', weight:  5, minLevel: 6 },
  ],
  special: [
    { type: 'territory_bonus',    weight: 20, minLevel: 1 },
    { type: 'bounty_hunt',        weight: 20, minLevel: 1 },
    { type: 'rival_invasion',     weight: 25, minLevel: 2 },
    { type: 'legendary_sighting', weight: 20, minLevel: 3 },
    { type: 'trainer_tournament', weight: 15, minLevel: 4 },
  ],
  gang_park: [], // pas d'événements au QG
};

// Définitions complètes des types d'événements
const ZONE_EVENT_DEFINITIONS = {
  territory_bonus: {
    fr: '🏴 Contrôle Renforcé',
    en: '🏴 Reinforced Control',
    desc_fr: 'Votre présence est établie — revenus ×2 dans cette zone pendant 20 min.',
    desc_en: 'Your presence is established — ×2 income in this zone for 20 min.',
    effect: { moneyMult: 2.0 },
    xpReward: 10,
    moneyReward: [500, 2000],
    repReward: 0,
  },
  bounty_hunt: {
    fr: '🎯 Chasse à la Prime',
    en: '🎯 Bounty Hunt',
    desc_fr: 'Capturez 5 Pokémon dans cette zone pour décrocher la prime !',
    desc_en: 'Capture 5 Pokémon in this zone to claim the bounty!',
    captureTarget: 5,
    xpReward: 15,
    moneyReward: [1000, 5000],
    repReward: 10,
  },
  rival_invasion: {
    fr: '⚔️ Invasion Rivale',
    en: '⚔️ Rival Invasion',
    desc_fr: 'Un gang rival tente de prendre le contrôle ! Défendez votre zone.',
    desc_en: 'A rival gang is trying to take over! Defend your zone.',
    trainerKey: 'rocketexecutive',
    xpReward: 20,
    moneyReward: [2000, 8000],
    repReward: 15,
  },
  trainer_tournament: {
    fr: '🏆 Tournoi de Dresseurs',
    en: '🏆 Trainer Tournament',
    desc_fr: '3 dresseurs d\'élite consécutifs. Battez-les tous pour le jackpot.',
    desc_en: '3 consecutive elite trainers. Beat them all for the jackpot.',
    rounds: 3,
    xpReward: 25,
    moneyReward: [3000, 10000],
    repReward: 20,
  },
  legendary_sighting: {
    fr: '🌟 Apparition Légendaire',
    en: '🌟 Legendary Sighting',
    desc_fr: 'Un légendaire a été aperçu ! Agissez vite — 10 min.',
    desc_en: 'A legendary has been spotted! Act fast — 10 min.',
    xpReward: 30,
    moneyReward: [0, 0],
    repReward: 25,
  },
};

export {
  ZONE_LEVEL_XP_THRESHOLDS,
  ZONE_MAX_LEVEL,
  ZONE_XP_SOURCES,
  ZONE_LEVEL_BONUSES,
  ZONE_EVENT_INTERVAL_MS,
  ZONE_EVENT_DURATION_MS,
  ZONE_EVENT_POOLS,
  ZONE_EVENT_DEFINITIONS,
};
