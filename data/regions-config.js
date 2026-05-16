// ════════════════════════════════════════════════════════════════
// PokéForge — Regions Config
// Chargé avant app.js comme <script> ordinaire.
// Doit être chargé APRÈS tous les zones-*-data.js.
//
// Définit la structure régions → zones et les règles de progression.
// Le moteur de jeu (app.js / zoneSystem.js) lit REGIONS_CONFIG pour :
//   • savoir si une région est débloquée (unlock)
//   • savoir quels paliers de rareté sont actifs selon le zone level (poolTiers)
//   • grouper les zones par région dans l'UI
// ════════════════════════════════════════════════════════════════

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Retourne la liste des zones appartenant à une région.
 * Lit ZONES (global défini par zones-data.js + injections).
 */
function getZonesByRegion(regionId) {
  return (typeof ZONES !== 'undefined' ? ZONES : [])
    .filter(z => z.region === regionId);
}

/**
 * Retourne les paliers de rareté actifs pour une zone selon son zone level.
 * @param {string} regionId
 * @param {number} zoneLevel  1-10
 * @returns {string[]}  ex: ['common','uncommon','rare']
 */
function getActivePoolTiers(regionId, zoneLevel) {
  const region = REGION_BY_ID[regionId];
  if (!region) return ['common'];
  const tiers = region.poolTiers;
  const active = ['common'];
  if (zoneLevel >= tiers.uncommon)  active.push('uncommon');
  if (zoneLevel >= tiers.rare)      active.push('rare');
  if (zoneLevel >= tiers.very_rare) active.push('very_rare');
  if (zoneLevel >= tiers.legendary) active.push('legendary');
  return active;
}

/**
 * Vérifie si une région est débloquée pour le joueur.
 * @param {object} region  — entrée REGIONS_CONFIG
 * @param {object} state   — état du jeu
 * @returns {boolean}
 */
function isRegionUnlocked(region, state) {
  if (!region || !state) return false;
  const u = region.unlock;
  switch (u.type) {
    case 'default': return true;
    case 'rep':     return (state.gang?.reputation ?? 0) >= u.repThreshold;
    case 'item':    return !!(state.inventory?.[u.itemId]);
    case 'flag':    return !!(state.progressFlags?.[u.flag]);
    case 'rep+item':
      return (state.gang?.reputation ?? 0) >= u.repThreshold
          && !!(state.inventory?.[u.itemId]);
    default:        return false;
  }
}

// ── Définitions des régions ───────────────────────────────────────

const REGIONS_CONFIG = [

  // ══ KANTO ═══════════════════════════════════════════════════════
  {
    id:     'kanto',
    gen:    1,
    fr:     'Kanto',
    en:     'Kanto',
    icon:   '🔴',
    dexRange: [1, 151],

    // Toujours disponible — région de départ
    unlock: { type: 'default' },

    // Seuils zone level → palier de rareté débloqué
    // Kanto : progression douce, légendaires très tardifs
    poolTiers: {
      uncommon:  1,   // toujours dispo
      rare:      3,   // zone level 3+
      very_rare: 6,   // zone level 6+
      legendary: 10,  // zone level 10 uniquement
    },

    // Zone level max atteignable dans cette région
    maxZoneLevel: 10,

    // Bonus de zone par palier (appliqués en plus des bonus de zones-v2-config.js)
    // shinyBonus : additif à rollShiny  |  moneyMult : multiplicateur income combat
    levelBonusScale: {
      //        lv1    lv2    lv3    lv4    lv5    lv6    lv7    lv8    lv9   lv10
      shinyBonus: [0, 0.001, 0.002, 0.003, 0.005, 0.007, 0.009, 0.012, 0.015, 0.020],
      moneyMult:  [1,   1.1,   1.2,   1.3,   1.5,   1.7,   2.0,   2.3,   2.7,  3.0],
    },

    // Musique par défaut si zone non mappée
    defaultMusic: 'forest',

    // Zone d'entrée (premier spawn en ouvrant la région)
    startZoneId: 'route1',

    // Couleur UI (hex)
    color: '#cc1111',
  },

  // ══ JOHTO ════════════════════════════════════════════════════════
  {
    id:     'johto',
    gen:    2,
    fr:     'Johto',
    en:     'Johto',
    icon:   '🥈',
    dexRange: [152, 251],

    // Débloqué par REP global ≥ 1000 (fin de la progression Kanto mid-game)
    unlock: {
      type:         'rep',
      repThreshold: 1000,
      // Message affiché dans l'UI quand verrouillé
      hint_fr: 'Atteignez 1 000 de Réputation pour accéder à Johto.',
      hint_en: 'Reach 1 000 Reputation to access Johto.',
    },

    // Johto : progression plus rapide, très_rares dès level 5
    poolTiers: {
      uncommon:  1,
      rare:      3,
      very_rare: 5,   // plus tôt qu'à Kanto
      legendary: 9,   // légendaires un peu plus accessibles
    },

    maxZoneLevel: 10,

    levelBonusScale: {
      shinyBonus: [0, 0.002, 0.003, 0.005, 0.007, 0.010, 0.013, 0.016, 0.020, 0.025],
      moneyMult:  [1,   1.2,   1.4,   1.6,   1.9,   2.2,   2.6,   3.0,   3.5,  4.0],
    },

    defaultMusic: 'forest',
    startZoneId:  'route29',
    color: '#4488cc',
  },

  // ══ HOENN (futur) ════════════════════════════════════════════════
  {
    id:     'hoenn',
    gen:    3,
    fr:     'Hoenn',
    en:     'Hoenn',
    icon:   '🌊',
    dexRange: [252, 386],

    unlock: {
      type:         'rep+item',
      repThreshold: 2000,
      itemId:       'hoenn_pass',
      hint_fr: 'Atteignez 2 000 REP et obtenez le Pass Hoenn.',
      hint_en: 'Reach 2 000 REP and obtain the Hoenn Pass.',
    },

    poolTiers: {
      uncommon:  1,
      rare:      2,   // Hoenn : raretés encore plus rapides
      very_rare: 5,
      legendary: 8,
    },

    maxZoneLevel: 10,

    levelBonusScale: {
      shinyBonus: [0, 0.003, 0.005, 0.007, 0.010, 0.013, 0.017, 0.021, 0.026, 0.032],
      moneyMult:  [1,   1.3,   1.6,   2.0,   2.4,   2.9,   3.4,   4.0,   4.7,  5.5],
    },

    defaultMusic: 'sea',
    startZoneId:  null, // à définir quand zones-hoenn-data.js existera
    color: '#44aa77',

    _todo: 'zones-hoenn-data.js à créer',
  },

  // ══ SINNOH (futur) ═══════════════════════════════════════════════
  {
    id:     'sinnoh',
    gen:    4,
    fr:     'Sinnoh',
    en:     'Sinnoh',
    icon:   '❄️',
    dexRange: [387, 493],

    unlock: {
      type:         'rep+item',
      repThreshold: 3500,
      itemId:       'sinnoh_pass',
      hint_fr: 'Atteignez 3 500 REP et obtenez le Pass Sinnoh.',
      hint_en: 'Reach 3 500 REP and obtain the Sinnoh Pass.',
    },

    poolTiers: {
      uncommon:  1,
      rare:      2,
      very_rare: 4,
      legendary: 7,
    },

    maxZoneLevel: 10,

    levelBonusScale: {
      shinyBonus: [0, 0.004, 0.007, 0.010, 0.014, 0.018, 0.023, 0.028, 0.034, 0.042],
      moneyMult:  [1,   1.5,   1.9,   2.4,   3.0,   3.7,   4.5,   5.4,   6.5,  8.0],
    },

    defaultMusic: 'cave',
    startZoneId:  null,
    color: '#9966cc',

    _todo: 'zones-sinnoh-data.js à créer',
  },
];

// ── Lookup rapide ─────────────────────────────────────────────────
const REGION_BY_ID = {};
REGIONS_CONFIG.forEach(r => REGION_BY_ID[r.id] = r);

// ── Injection du champ region sur les zones Kanto existantes ──────
// Les zones Johto ont déjà region:'johto' via zones-johto-data.js.
// Kanto n'avait pas ce champ — on l'ajoute ici rétroactivement.
if (typeof ZONES !== 'undefined') {
  ZONES.forEach(z => {
    if (!z.region) z.region = 'kanto';
  });
}

// ── Exports globaux ───────────────────────────────────────────────
Object.assign(typeof globalThis !== 'undefined' ? globalThis : window, {
  REGIONS_CONFIG,
  REGION_BY_ID,
  getZonesByRegion,
  getActivePoolTiers,
  isRegionUnlocked,
});
