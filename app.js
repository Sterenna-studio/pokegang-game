// ============================================================
// POKEFORGE v6 — Gang Wars  (vanilla JS, single-file engine)
// ============================================================

'use strict';

import {
  checkSecretCode,
  configureSecretCodes,
} from './modules/secretCodes.js';
import {
  configureSaveSlots,
  getSlotPreview,
  openSaveSlotModal,
  saveToSlot,
  loadSlot,
} from './state/saveSlots.js';
import {
  configureSaveRepair,
  applyAutoMutation,
  cleanObsoleteData,
  repairSave,
} from './state/saveRepair.js';
import './modules/systems/llm.js';
import './modules/systems/missions.js';
import './modules/systems/market.js';
import './modules/systems/agent.js';
import './modules/systems/sessionObjectives.js';
import './modules/systems/trainingRoom.js';
import './modules/systems/pension.js';
import './modules/systems/zoneSystem.js';
import {
  configureCloudAccount,
  initSupabase,
  renderLeaderboardTab,
  renderCompteTab,
  supaCloudSave,
  supaWriteSnapshot,
  supaUpdateLeaderboardAnon,
  getSupabaseClient,
  getSupaSession,
} from './modules/systems/cloudAccount.js';
import { configureGangCompetition } from './modules/systems/gangCompetition.js';
import {
  configureZoneCombat,
  resolveTrainerCombat,
  getTrainerCombatPreview,
} from './modules/systems/zoneCombat.js';
import { renderGangCompetitionTab } from './modules/ui/gangCompetitionTab.js';
import {
  MusicPlayer,
  JinglePlayer,
  MUSIC_TRACKS,
  SFX,
  playSE,
  playTone,
} from './modules/ui/audio.js';
import {
  configureBagTab,
  renderBagTab as renderBagTabImpl,
} from './modules/ui/bagTab.js';
import {
  configureModals,
  openHubImportModal as openHubImportModalImpl,
  openImportPreviewModal as openImportPreviewModalImpl,
  openLegacyImportModal as openLegacyImportModalImpl,
  showConfirm as showConfirmImpl,
  showInfoModal as showInfoModalImpl,
  showMigrationBanner as showMigrationBannerImpl,
} from './modules/ui/modals.js';
import {
  configureTabRouter,
  getTabHint as getTabHintImpl,
  hintLink as hintLinkImpl,
  renderActiveTab as renderActiveTabImpl,
  renderHint as renderHintImpl,
  showFirstVisitHint as showFirstVisitHintImpl,
} from './modules/ui/tabRouter.js';
import {
  addBattleLogEntry,
  checkPlayerStatPoints,
  configurePcPokedex,
  filterPCBySpecies,
  openBulkSellModal,
  openDexAssistant,
  openPlayerStatModal,
  pushFeedEvent,
  rebuildPokedex,
  renderDexDetail,
  renderEggsView,
  renderPCTab,
  renderPokedexTab,
  renderPokemonDetail,
  renderPokemonDetailGroup,
  renderPokemonGrid,
  renderPokemonHistory,
  resetPcRenderCache,
  resetPcSelection,
  showContextMenu,
  setPcPage,
  tryAutoIncubate,
} from './modules/ui/pcPokedex.js';
import { renderAgentsTab } from './modules/ui/agentsTab.js';
import { renderBattleLogTab } from './modules/ui/battleLogTab.js';
import { renderCosmeticsTab } from './modules/ui/cosmeticsTab.js';
import { renderLabTab, renderLabTabInEl } from './modules/ui/labTab.js';
import { renderMarketTab } from './modules/ui/marketTab.js';
import { renderMissionsTab } from './modules/ui/missionsTab.js';
import {
  configureSettingsModal,
  initSettings,
  openSettingsModal,
} from './modules/ui/settingsModal.js';
import './modules/ui/notifPanel.js';
import './modules/ui/zoneWindows.js';
import './modules/ui/gangBase.js';
import './modules/ui/gangTab.js';
import { configureIntro, openGiovanniIntro, openStarterGiftPopup } from './modules/ui/intro.js';
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
import { ZONE_BGS, COSMETIC_BGS, FABRIC_SPECIES, PATCH_PIDS, fabricBgUrl, fabricEmbUrl, patchUrl } from './data/zones-visuals-data.js';
import { MISSIONS, HOURLY_QUEST_POOL } from './data/missions-data.js';
import { TRAINER_TYPES } from './data/trainers-data.js';
import { getDexDesc, buildSpeciesNameMaps } from './data/dex-helpers.js';
import { BALLS, SHOP_ITEMS, MYSTERY_EGG_BASE_COST, MYSTERY_EGG_POOL, MYSTERY_EGG_HATCH_MS, POTENTIAL_MULT, BASE_PRICE, getMysteryEggCost as computeMysteryEggCost } from './data/economy-data.js';
import { NATURES, NATURE_KEYS, BOSS_SPRITES, AGENT_NAMES_M, AGENT_NAMES_F, AGENT_SPRITES, AGENT_PERSONALITIES, TITLE_REQUIREMENTS, TITLE_BONUSES, AGENT_RANK_LABELS, RANK_CHAIN } from './data/game-config-data.js';
import { I18N } from './data/i18n-data.js';
import { ZONE_BG_URL, GYM_ORDER, JOHTO_GYM_ORDER } from './data/zones-config-data.js';
import { HOURLY_QUEST_REROLL_COST, BOOST_DURATIONS } from './data/gameplay-config-data.js';
import { SPECIAL_TRAINER_KEYS, MAX_COMBAT_REWARD } from './data/combat-config-data.js';
import { FALLBACK_TRAINER_SVG, FALLBACK_POKEMON_SVG, BALL_SPRITES, ITEM_SPRITE_URLS, CHEST_SPRITE_URL } from './data/assets-data.js';
import { TRANSLATOR_PHRASES_FR } from './data/flavor-data.js';
import {
  APP_VERSION,
  GAME_VERSION,
  SAVE_SCHEMA_VERSION,
  SAVE_KEYS,
  LEGACY_SAVE_KEYS,
  DEFAULT_STATE,
  createDefaultState,
} from './state/defaultState.js';
import { slimPokemon, buildSavePayload, MAX_HISTORY } from './state/serialization.js';
import { migrateSave, getMigrationSummary } from './state/migrateSave.js';

// ════════════════════════════════════════════════════════════════
//  1.  CONFIG & CONSTANTS
// ════════════════════════════════════════════════════════════════

// Secret code logic moved to modules/secretCodes.js

// Pokédex descriptions moved to data/pokedex-desc.js

// Dex helper logic moved to data/dex-helpers.js

// FR→EN / EN→FR name maps moved to data/dex-helpers.js
const { FR_TO_EN, EN_TO_FR } = buildSpeciesNameMaps(POKEMON_GEN1);

// ── Constantes Pokédex ─────────────────────────────────────────
// Pokédex Kanto = les 151 espèces originales (dex 1–151) + MissingNo (dex 0, caché)
const KANTO_DEX_SIZE    = 151;
// Pokédex National = toutes les espèces non-cachées disponibles dans le jeu
const NATIONAL_DEX_SIZE = POKEMON_GEN1.filter(s => !s.hidden).length;
const JOHTO_DEX_SIZE    = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 152 && s.dex <= 251).length;

// Helpers de comptage — centralisés ici pour éviter la duplication partout dans l'UI
function getDexKantoCaught()   { return POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151 && state.pokedex[s.en]?.caught).length; }
function getDexJohtoCaught()   { return POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 152 && s.dex <= 251 && state.pokedex[s.en]?.caught).length; }
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

// ── Save slot (runtime mutable) ───────────────────────────────────────────────
let activeSaveSlot = Math.min(2, parseInt(localStorage.getItem('pokeforge.activeSlot') || '0'));
let SAVE_KEY = SAVE_KEYS[activeSaveSlot];

// Résultat de migration exposé au boot pour afficher le banner
let _migrationResult = null; // null | { from: string, fields: string[] }

let state = structuredClone(DEFAULT_STATE);
globalThis.state = state;

function setState(nextState) {
  state = nextState;
  globalThis.state = state;
  return state;
}

// ── Sérialisation slim des pokémons ──────────────────────────────────────────
// On ne touche PAS les objets en mémoire : on crée un clone allégé pour la save.
// Champs supprimés : dérivables au runtime (species_fr, dex) + valeurs par défaut
// (assignedTo=null, cooldown=0, homesick=false, favorite=false, xp=0).
// Gain moyen : ~35% sur la section pokemons soit ~20-25% sur la save totale.
// slimPokemon — importée depuis state/serialization.js

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

  // Sérialisation slim via state/serialization.js
  const payload = buildSavePayload(state);
  payload._savedAt = state._savedAt;
  const data = JSON.stringify(payload);

  try {
    localStorage.setItem(SAVE_KEY, data);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      notify('⚠ Save trop volumineuse — historiques supprimés', 'error');
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

      if (legacyKey) {
        try { localStorage.removeItem(legacyKey); } catch {}
      }
    }

    migrated._schemaVersion = SAVE_SCHEMA_VERSION;
    return migrated;
  } catch (e) {
    console.error('[PokéForge] Erreur loadState() — save corrompue ou illisible :', e);
    return null;
  }
}

// ── migrate() — délègue à state/migrateSave.js ───────────────────────────────
function migrate(saved) {
  return migrateSave(saved, {
    DEFAULT_STATE,
    SAVE_SCHEMA_VERSION,
    SPECIES_BY_EN,
    uid,
    now: () => Date.now(),
  });
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
  return openImportPreviewModalImpl(raw);
}

function openLegacyImportModal(legacyData) {
  return openLegacyImportModalImpl(legacyData);
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
// Sprite générique NB (Noir & Blanc) — utilisé comme fallback universel.
// Les sprites GO (pokepedia) permettent de distinguer visuellement la rareté.
const _EGG_NB = 'https://www.pokepedia.fr/images/f/f5/Sprite_%C5%92uf_NB.png?20190202195308';

const EGG_SPRITES = {
  // Generic rarity-based (mystery eggs — GO-style coloring)
  common:    _EGG_NB,
  uncommon:  'https://www.pokepedia.fr/images/a/ab/Sprite_%C5%92uf_5_km_GO.png',
  rare:      'https://www.pokepedia.fr/images/7/70/Sprite_%C5%92uf_10_km_GO.png',
  very_rare: 'https://www.pokepedia.fr/images/a/a8/Sprite_%C5%92uf_12_km_GO.png',
  legendary: 'https://www.pokepedia.fr/images/a/a8/Sprite_%C5%92uf_12_km_GO.png',
  // Special states
  ready:     'https://www.pokepedia.fr/images/f/f5/Sprite_%C5%92uf_NB.png?20190202195308',
  // Default fallback (NB générique — toujours accessible)
  default:   _EGG_NB,
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
  const fallback   = eggSprite(egg, ready);
  const bwFallback = _EGG_NB; // fallback universel NB (pokepedia, toujours dispo)
  const baseStyle = `object-fit:contain;image-rendering:pixelated;${style}`;

  // Pension egg (parents known) or scanned (species revealed) → try PokéOS first
  const isRevealed = (egg?.parentA && egg?.parentB) || (egg?.scanned && egg?.revealedSpecies);
  if (!ready && isRevealed && egg?.species_en) {
    const sp = SPECIES_BY_EN[egg.species_en];
    const dex = sp?.dex;
    if (dex) {
      const pokeos     = `https://s3.pokeos.com/pokeos-uploads/forgotten-dex/eggs/${dex}-animegg.png`;
      const showdown   = window.getEggSpriteUrl?.(egg.species_en) ?? fallback;
      // onerror chain: PokéOS → Showdown/manifest → rarity fallback → BW generic
      return `<img src="${pokeos}" style="${baseStyle}" onerror="if(!this._f1){this._f1=1;this.src='${showdown}'}else if(!this._f2){this._f2=1;this.src='${fallback}'}else if(!this._f3){this._f3=1;this.src='${bwFallback}'}">`;
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
Object.defineProperty(globalThis, 'pcView', {
  get: () => pcView,
  set: value => { pcView = value; },
  configurable: true,
});
let _sessionStatsBase = null;     // snapshot of state.stats at session start (also on globalThis._gangSessionStatsBase)

// Chest sprite URL moved to data/assets-data.js

// ── Audio extracted to modules/ui/audio.js ───────────────────────

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
  return showConfirmImpl(message, onConfirm, onCancel, opts);
}

function showInfoModal(tabId) {
  return showInfoModalImpl(tabId);
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
    resetPcRenderCache();
    if (activeTab === 'tabPC') renderPCTab();
  });
  return false; // evolution pending user choice
}

function showPokemonLevelPopup(pokemon, newLevel) {
  // Routed to notification panel — no more overlapping floating divs
  globalThis._npanel_push?.({
    category: 'levelup',
    title:    `${speciesName(pokemon.species_en)} → Lv.${newLevel} !`,
    type:     'gold',
  });
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
      } else if (t.shinyType === 'species') {
        unlock = !!(state.pokedex[t.speciesReq]?.shiny);
      } else if (t.shinyType === 'collection') {
        unlock = Array.isArray(t.speciesReq) && t.speciesReq.every(s => state.pokedex[s]?.shiny);
      }
    } else if (t.category === 'collection') {
      if (Array.isArray(t.speciesReq)) {
        unlock = t.speciesReq.every(s => state.pokedex[s]?.caught);
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
    pokedex:'Pokédex', shiny_special:'Chromatique', collection:'Collection'
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
          else if (t.category === 'shiny_special') {
            if (t.shinyType === 'starters') hint = '3 starters chromatiques';
            else if (t.shinyType === 'legendaries') hint = 'Tous légendaires chromatiques';
            else if (t.shinyType === 'full_dex') hint = 'Pokédex chromatique complet';
            else if (t.shinyType === 'species') {
              const spFr = POKEMON_GEN1.find(s => s.en === t.speciesReq)?.fr || t.speciesReq;
              hint = `✨ ${spFr} chromatique`;
            }
            else if (t.shinyType === 'collection') {
              const names = (t.speciesReq || []).map(s => POKEMON_GEN1.find(p => p.en === s)?.fr || s).join(', ');
              hint = `✨ Chromatiques : ${names}`;
            }
          }
          else if (t.category === 'collection') {
            if (Array.isArray(t.speciesReq)) {
              const names = t.speciesReq.map(s => POKEMON_GEN1.find(p => p.en === s)?.fr || s).join(', ');
              hint = `Capturer : ${names}`;
            }
          }
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

function getZoneMastery(zoneId)    { return globalThis._zsys_getZoneMastery(zoneId); }
function getZoneDifficulty(zoneId) { return globalThis._zsys_getZoneDifficulty(zoneId); }

function getZoneAgentSlots(zoneId) { return globalThis._zsys_getZoneAgentSlots(zoneId); }

// ZONE_DIFFICULTY_SCALING → now defined in modules/systems/zoneSystem.js, exposed on globalThis.ZONE_DIFFICULTY_SCALING

// Open zone windows tracking
const openZones = new Set();
const zoneSpawns = {}; // zoneId -> [{ type, data, el, timeout }]
// Unified timer dict: active if zone is open OR has ≥1 agent assigned
// (replaces former zoneSpawnTimers + backgroundZoneTimers)
const zoneTimers = {};
// Expose for modules (const objects — mutated in-place, reference stays valid)
globalThis.openZones  = openZones;
globalThis.zoneSpawns = zoneSpawns;
globalThis.zoneTimers = zoneTimers;

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
  if (type === 'gold') SFX.play('notify');
  // Routed to notification panel (replaces old #notifications toast system)
  // category = type if recognized, otherwise 'system'
  globalThis._npanel_push?.({ category: type || 'system', title: msg, type });
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
Object.defineProperty(globalThis, 'activeTab', {
  get: () => activeTab,
  set: value => { activeTab = value; },
  configurable: true,
});
// zoneFilter state is now managed inside modules/ui/zoneSelector.js

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

function hintLink(label, tabId) {
  return hintLinkImpl(label, tabId);
}

function getTabHint(tabId) {
  return getTabHintImpl(tabId);
}

function showFirstVisitHint(tabId) {
  return showFirstVisitHintImpl(tabId);
}

function renderHint(tabId) {
  return renderHintImpl(tabId);
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
        pcView = 'pension'; switchTab('tabPC'); break;
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
  if (tabId !== 'tabPC') resetPcRenderCache(); // force full rebuild on next PC visit
  SFX.play('tabSwitch');
  activeTab = tabId;
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
  return renderActiveTabImpl();
}

// ════════════════════════════════════════════════════════════════
//  COSMETICS
// ════════════════════════════════════════════════════════════════

function _resolveFabricBgUrl(bgKey) {
  // bgKey = 'fabric_{pid}' | 'fabric_{pid}_v2'
  const m = bgKey.match(/^fabric_(\d+)(?:_v(\d+))?$/);
  if (!m) return null;
  const pid     = parseInt(m[1], 10);
  const variant = m[2] ? parseInt(m[2], 10) : 1;
  return fabricBgUrl(pid, variant);
}

function applyCosmetics() {
  const bgKey = state.cosmetics?.gameBg;
  const bg = bgKey ? COSMETIC_BGS[bgKey] : null;
  const isFabric = bgKey && bgKey.startsWith('fabric_');
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
  } else if (isFabric) {
    const url = _resolveFabricBgUrl(bgKey);
    if (url) {
      const fMode    = state.cosmetics?.fabricMode    || 'repeat';
      const fSize    = state.cosmetics?.fabricSize    ?? 320;
      _bgTargets.forEach(el => {
        el.style.backgroundImage = `url('${url}')`;
        el.style.backgroundAttachment = 'fixed';
        if (fMode === 'full') {
          el.style.backgroundSize     = 'cover';
          el.style.backgroundRepeat   = 'no-repeat';
          el.style.backgroundPosition = 'center';
        } else {
          el.style.backgroundSize     = `${fSize}px`;
          el.style.backgroundRepeat   = 'repeat';
          el.style.backgroundPosition = 'top left';
        }
      });
    }
    const alpha = ((state.cosmetics?.fabricOpacity ?? 72) / 100).toFixed(2);
    document.documentElement.style.setProperty('--bg',       `rgba(10,10,10,${alpha})`);
    document.documentElement.style.setProperty('--bg-card',  `rgba(20,20,20,${alpha})`);
    document.documentElement.style.setProperty('--bg-panel', `rgba(26,26,26,${alpha})`);
    document.documentElement.style.setProperty('--bg-hover', 'rgba(34,34,34,0.80)');
  } else {
    _bgTargets.forEach(el => { el.style.backgroundImage = ''; });
    document.documentElement.style.setProperty('--bg', '#0a0a0a');
    document.documentElement.style.setProperty('--bg-card', '#141414');
    document.documentElement.style.setProperty('--bg-panel', '#1a1a1a');
    document.documentElement.style.setProperty('--bg-hover', '#222');
  }
}

function _unlockFabricBg(dexNum, isShiny) {
  if (!dexNum || dexNum <= 0) return;
  const spec = FABRIC_SPECIES.find(s => s[0] === dexNum);
  if (!spec) return;
  const unlocked = state.cosmetics.unlockedBgs || [];
  const add = (key) => { if (!unlocked.includes(key)) unlocked.push(key); };
  add(`fabric_${dexNum}`);
  if (spec[2] >= 2) add(`fabric_${dexNum}_v2`);
  state.cosmetics.unlockedBgs = unlocked;
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

function renderCosmeticsPanel(_container) {
  // Moved to modules/ui/gangTab.js → renderAppearancePanel / renderMusicPanel
}

// ════════════════════════════════════════════════════════════════
// 13.  UI — GANG TAB  (extracted to modules/ui/gangTab.js)
// ════════════════════════════════════════════════════════════════

function renderGangTab() {
  globalThis._gtab_renderGangTab?.();
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

// ── Zone active/paused model ────────────────────────────────────
// Active  = zone ouverte OU ≥1 agent assigné → timer unifié dans zoneTimers
// Pausée  = ni ouverte ni agent → aucun calcul (délai de grâce 5 s à la fermeture)
// Les wrappers appellent les clés _zsys_* pour éviter la récursion infinie :
// le grand Object.assign final écrase globalThis.startActiveZone avec ces wrappers,
// mais _zsys_startActiveZone reste toujours la vraie fonction de zoneSystem.js.
function startActiveZone(zoneId)  { return globalThis._zsys_startActiveZone(zoneId); }
function stopActiveZone(zoneId)   { return globalThis._zsys_stopActiveZone(zoneId); }
function pauseZoneIfIdle(zoneId)  { return globalThis._zsys_pauseZoneIfIdle(zoneId); }
function syncActiveZones()        { return globalThis._zsys_syncActiveZones(); }
// Aliases (rétrocompatibilité)
function startBackgroundZone(zoneId) { return globalThis._zsys_startActiveZone(zoneId); }
function stopBackgroundZone(zoneId)  { return globalThis._zsys_stopActiveZone(zoneId); }
function syncBackgroundZones()       { return globalThis._zsys_syncActiveZones(); }

function openZoneWindow(zoneId)  { return globalThis._zwin_openZoneWindow(zoneId); }
function closeZoneWindow(zoneId) { return globalThis._zwin_closeZoneWindow(zoneId); }

// Track headbar expanded state per zone
// headbarExpanded removed — collapsible headbar-content section eliminated

function renderGangBasePanel() { return globalThis._gbase_renderGangBasePanel(); }

function renderZoneWindows() { return globalThis._zwin_renderZoneWindows(); }

// ── Gang Park Window ─────────────────────────────────────────────
// Panneau persistant du QG, affiché parmi les fenêtres de zone
let _gangParkOpen = false;

function toggleGangParkWindow() {
  _gangParkOpen = !_gangParkOpen;
  openZones[_gangParkOpen ? 'add' : 'delete']('gang_park');
  const container = document.getElementById('zoneWindowsContainer');
  if (!container) return;
  const existing = document.getElementById('zw-gang_park');
  if (_gangParkOpen) {
    if (!existing) {
      const el = document.createElement('div');
      el.id = 'zw-gang_park';
      el.className = 'zone-window gang-park-window';
      el.style.cssText = 'min-width:340px;max-width:420px;flex-shrink:0;border:2px solid var(--gold-dim);border-radius:var(--radius);background:linear-gradient(160deg,#1a1a2e,#16213e);overflow:hidden;display:flex;flex-direction:column';
      container.prepend(el);
      renderGangParkWindow(el);
    }
  } else if (existing) {
    existing.remove();
  }
  renderZoneSelector?.();
  _zsRefreshTile?.('gang_park');
}

function renderGangParkWindow(el) {
  const agentRows = state.agents.map(agent => {
    const teamHtml = agent.team.map(id => {
      const pk = state.pokemons.find(p => p.id === id);
      return pk ? `<img src="${pokeSprite(pk.species_en, pk.shiny)}" title="${speciesName(pk.species_en)} Lv.${pk.level}" style="width:28px;height:28px;image-rendering:pixelated${pk.shiny ? ';filter:drop-shadow(0 0 3px gold)' : ''}">` : '';
    }).join('');
    const zoneName = agent.assignedZone ? (ZONE_BY_ID[agent.assignedZone]?.fr || agent.assignedZone) : '—';
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.07)">
      ${safeTrainerImg(agent.sprite || 'acetrainer', { style: 'width:32px;height:32px;image-rendering:pixelated' })}
      <div style="flex:1;min-width:0">
        <div style="font-size:9px;color:var(--text)">${agent.name}</div>
        <div style="font-size:7px;color:var(--text-dim)">${zoneName}</div>
      </div>
      <div style="display:flex;gap:2px;flex-wrap:wrap;max-width:100px;justify-content:flex-end">${teamHtml || '<span style="font-size:8px;color:var(--text-dim)">—</span>'}</div>
    </div>`;
  }).join('') || '<div style="font-size:9px;color:var(--text-dim);padding:10px;text-align:center">Aucun agent recruté</div>';

  const trainingIds = state.trainingRoom?.pokemon || [];
  const trainingHtml = trainingIds.map(id => {
    const pk = state.pokemons.find(p => p.id === id);
    return pk ? `<div style="display:flex;align-items:center;gap:6px;padding:4px 8px">
      <img src="${pokeSprite(pk.species_en)}" style="width:28px;height:28px;image-rendering:pixelated">
      <div style="font-size:9px">${speciesName(pk.species_en)} Lv.${pk.level} ${'★'.repeat(pk.potential)}</div>
    </div>` : '';
  }).join('') || '<div style="font-size:9px;color:var(--text-dim);padding:8px">Salle vide</div>';

  const pensionIds = state.pension?.slots || [];
  const pensionHtml = pensionIds.map(id => {
    const pk = state.pokemons.find(p => p.id === id);
    return pk ? `<div style="display:flex;align-items:center;gap:6px;padding:4px 8px">
      <img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:28px;height:28px;image-rendering:pixelated">
      <div style="font-size:9px">${speciesName(pk.species_en)} Lv.${pk.level}${pk.shiny ? ' ✨' : ''}</div>
    </div>` : '';
  }).join('') || '<div style="font-size:9px;color:var(--text-dim);padding:8px">Pension vide</div>';

  // Random ambient event (purely cosmetic)
  const AMBIENT_EVENTS = [
    '🌿 Un Pikachu se promène dans la cour.',
    '🥚 Un Pokémon dépose un œuf devant la porte.',
    '☁️ Deux Pokémon jouent sous la pluie.',
    '🌙 Les Pokémon en formation s\'entraînent à la lueur de la lune.',
    '🎵 Un Meloetta chante pour booster le moral.',
    '🌸 Des pétales de Cerisaies tombent sur la cour.',
    '🍖 Ton agent prépare un festin pour les Pokémon.',
    '⚡ Un Raichu génère de l\'électricité pour la base.',
    '💤 Snorlax bloque l\'entrée principale... encore.',
    '🏋️ Les Pokémon en formation se motivent entre eux.',
  ];
  const ambient = AMBIENT_EVENTS[Math.floor(Date.now() / 30000) % AMBIENT_EVENTS.length];

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(0,0,0,.3);border-bottom:1px solid rgba(255,255,255,.1)">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:16px">🏛️</span>
        <div>
          <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">${state.gang.name}</div>
          <div style="font-size:8px;color:var(--text-dim)">Quartier Général</div>
        </div>
      </div>
      <button class="gp-close" style="font-size:11px;background:none;border:none;color:var(--text-dim);cursor:pointer">✕</button>
    </div>

    <div style="padding:6px 8px;background:rgba(255,204,90,.06);border-bottom:1px solid rgba(255,255,255,.07);font-size:8px;color:var(--text-dim)">
      ${ambient}
    </div>

    <div style="overflow-y:auto;flex:1">
      <div style="padding:8px 12px">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin-bottom:6px;letter-spacing:1px">AGENTS (${state.agents.length})</div>
        ${agentRows}
      </div>

      ${trainingIds.length > 0 ? `
      <div style="padding:8px 12px;border-top:1px solid rgba(255,255,255,.07)">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin-bottom:4px;letter-spacing:1px">FORMATION (${trainingIds.length})</div>
        ${trainingHtml}
      </div>` : ''}

      ${pensionIds.length > 0 ? `
      <div style="padding:8px 12px;border-top:1px solid rgba(255,255,255,.07)">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin-bottom:4px;letter-spacing:1px">PENSION (${pensionIds.length})</div>
        ${pensionHtml}
      </div>` : ''}
    </div>`;

  el.querySelector('.gp-close')?.addEventListener('click', () => toggleGangParkWindow());
}

Object.assign(globalThis, { toggleGangParkWindow, renderGangParkWindow });

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
// 15b. UI — COSMETICS TAB (extracted to modules/ui/cosmeticsTab.js)
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// 16.  UI — MARKET TAB (extracted to modules/ui/marketTab.js)
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// 17.  UI — PC / POKÉDEX
// ════════════════════════════════════════════════════════════════
// Extracted to modules/ui/pcPokedex.js.

// 18b. UI — AGENTS TAB (extracted to modules/ui/agentsTab.js)
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// 18c. UI — MISSIONS TAB (extracted to modules/ui/missionsTab.js)
// ════════════════════════════════════════════════════════════════

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
  return renderBagTabImpl();
}

// ════════════════════════════════════════════════════════════════
// 19.  UI — INTRO OVERLAY
// ════════════════════════════════════════════════════════════════

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
          setState(fixed);
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
  return openHubImportModalImpl(raw);
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
            setActiveSaveSlotValue(0, { persist: true });
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
          openGiovanniIntro({
            slotIdx: idx,
            onComplete: ({ slotIdx: si }) => {
              saveToSlot(si);
              const hub = document.getElementById('introOverlay');
              hub?.classList.remove('active');
              stopShowcase?.();
              renderAll();
            },
          });
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
// Extracted to modules/ui/settingsModal.js.

// ════════════════════════════════════════════════════════════════
// 21.  GAME LOOP & BOOT
// ════════════════════════════════════════════════════════════════
// ── renderTrainingTab / trainingRoomTick extracted → modules/systems/trainingRoom.js ──

// ════════════════════════════════════════════════════════════════
// 22.  PENSION & EGGS
// ════════════════════════════════════════════════════════════════
// ── pensionTick / renderPensionView extracted → modules/systems/pension.js ──

// ════════════════════════════════════════════════════════════════
// LAB TAB (extracted to modules/ui/labTab.js)
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// GAME LOOP VARS
// ════════════════════════════════════════════════════════════════
const HOUR_MS = 3600000;

let agentTickInterval = null;
let autoSaveInterval  = null;
let cooldownInterval  = null;
let _gameLoopStarted  = false; // guard against double-start
let _playerWasActive = false; // set by saveState(); consumed by the 2h leaderboard timer

// ════════════════════════════════════════════════════════════════
// JOHTO — Extension régionale
// ════════════════════════════════════════════════════════════════

function registerJohtoSpecialEvents() {
  if (typeof SPECIAL_EVENTS === 'undefined' || typeof SPECIAL_EVENTS_JOHTO === 'undefined') return;
  const existingEventIds = new Set(SPECIAL_EVENTS.map(ev => ev.id));
  SPECIAL_EVENTS_JOHTO.forEach(ev => {
    if (existingEventIds.has(ev.id)) return;
    SPECIAL_EVENTS.push({ ...ev, region: 'johto' });
    existingEventIds.add(ev.id);
  });
}

function activateJohtoRegion() {
  // Garder les systèmes legacy compatibles sans polluer la liste Kanto affichée.
  if (!ZONES.find(z => z.id === 'route29')) {
    ZONES.push(...ZONES_JOHTO);
    ZONES_JOHTO.forEach(z => { ZONE_BY_ID[z.id] = z; });
    Object.assign(ZONE_MUSIC_MAP, ZONE_MUSIC_MAP_JOHTO);
  }
  registerJohtoSpecialEvents();
  state.purchases.johtoUnlocked = true;
  globalThis._zsel_setActiveRegion?.('kanto');
  if (activeTab === 'tabZones') renderZonesTab();
  saveState();
}

function showJohtoUnlockModal() {
  if (state.purchases?.johtoUnlocked) return;
  if (document.getElementById('johto-intro-overlay')) return; // already open

  const archerSprite = trainerSprite('archer');
  const bossName = state.gang?.bossName || 'Parrain';

  const MESSAGE =
    `« J'ai entendu parler de vous, ${bossName}.\n\n` +
    `Le Plateau Indigo est tombé. Votre réputation a traversé le Détroit Tohjo.\n\n` +
    `Notre organisation traverse une période... difficile. ` +
    `Les territoires de Johto sont vacants. Les Bêtes Sacrées rôdent sans maître. ` +
    `Lugia dort dans les Îles Tourbillon. Ho-Oh attend un gardien digne de lui.\n\n` +
    `Une opportunité unique — pour ceux qui savent saisir leur chance.\n\n` +
    `Johto vous tend les bras. »`;

  // ── Overlay ─────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'johto-intro-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:8100;
    background:linear-gradient(160deg,#06100a 0%,#0a150d 45%,#080f0c 100%);
    display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
    font-family:var(--font-system,sans-serif);
    overflow:hidden;opacity:0;transition:opacity .4s ease;
  `;
  overlay.innerHTML = `
    <div style="position:absolute;inset:0;pointer-events:none;
      background:radial-gradient(ellipse at 50% 20%,rgba(20,160,80,.06) 0%,transparent 60%),
                 radial-gradient(ellipse at 80% 75%,rgba(0,80,60,.05) 0%,transparent 50%)"></div>
    <div id="ji-stage" style="position:absolute;inset:0;display:flex;flex-direction:column;
      align-items:center;justify-content:flex-end;padding:0 16px 0;"></div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  const stage = overlay.querySelector('#ji-stage');

  // ── Portrait ─────────────────────────────────────────────────────
  const portrait = document.createElement('div');
  portrait.style.cssText = `
    position:absolute;top:0;left:50%;transform:translateX(-50%);
    width:100%;max-width:560px;
    display:flex;align-items:flex-start;justify-content:center;
    padding-top:32px;pointer-events:none;
  `;
  portrait.innerHTML = `
    <div style="position:relative;text-align:center">
      <img src="${archerSprite}"
        style="width:140px;height:140px;image-rendering:pixelated;
               filter:drop-shadow(0 8px 28px rgba(20,160,80,.4));
               animation:ji-bob 2.8s ease-in-out infinite"
        onerror="this.style.opacity='.25'">
      <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
        width:80px;height:10px;
        background:radial-gradient(ellipse,rgba(0,0,0,.5) 0%,transparent 70%);
        filter:blur(3px)"></div>
    </div>`;
  overlay.appendChild(portrait);

  // ── Dialog box ───────────────────────────────────────────────────
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    width:100%;max-width:560px;
    background:rgba(4,10,8,.96);
    border:2px solid rgba(20,120,70,.55);
    border-radius:8px;
    padding:16px 18px 18px;
    margin-bottom:24px;
    box-shadow:0 -4px 32px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.03);
    position:relative;
  `;
  dialog.innerHTML = `
    <div style="font-family:var(--font-pixel,monospace);font-size:7px;
      color:rgba(40,200,100,.85);letter-spacing:.8px;text-transform:uppercase;
      margin-bottom:8px">Archer — QG Johto</div>
    <div id="ji-text" style="font-size:14px;color:#ddeedd;line-height:1.7;min-height:46px;
      white-space:pre-wrap"></div>
    <div id="ji-actions" style="margin-top:16px;display:none;
      justify-content:flex-end;gap:10px"></div>
    <div id="ji-cursor" style="position:absolute;bottom:14px;right:16px;
      font-size:10px;color:rgba(40,200,100,.65);
      animation:ji-blink 1s ease-in-out infinite;display:none">▶</div>`;
  stage.appendChild(dialog);

  // ── CSS animations ────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ji-bob   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
    @keyframes ji-blink { 0%,100%{opacity:.7} 50%{opacity:.15} }
    @keyframes ji-fadein{ from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    #ji-stage > div { animation:ji-fadein .3s ease }
    .ji-btn-accept {
      font-family:var(--font-pixel,monospace);font-size:10px;
      padding:10px 20px;border-radius:6px;border:none;cursor:pointer;
      background:rgba(20,120,60,.9);color:#aaffcc;
      border:1px solid rgba(40,180,90,.6);
      transition:background .15s,transform .1s;
    }
    .ji-btn-accept:hover { background:rgba(30,160,80,.9);color:#ccffdd; }
    .ji-btn-accept:active { transform:scale(.97) }
    .ji-btn-dismiss {
      font-family:var(--font-pixel,monospace);font-size:9px;
      padding:8px 14px;border-radius:6px;cursor:pointer;
      background:transparent;color:rgba(255,255,255,.4);
      border:1px solid rgba(255,255,255,.12);
      transition:color .15s,border-color .15s;
    }
    .ji-btn-dismiss:hover { color:rgba(255,255,255,.7);border-color:rgba(255,255,255,.3); }
  `;
  document.head.appendChild(style);

  // ── Typewriter ────────────────────────────────────────────────────
  const textEl   = dialog.querySelector('#ji-text');
  const actionsEl = dialog.querySelector('#ji-actions');
  const cursor   = dialog.querySelector('#ji-cursor');
  let _tw = null;

  function _typewrite(text, onDone) {
    textEl.textContent = '';
    let i = 0;
    cursor.style.display = 'none';
    _tw = setInterval(() => {
      textEl.textContent += text[i++];
      if (i >= text.length) {
        clearInterval(_tw);
        cursor.style.display = 'block';
        onDone?.();
      }
    }, 18);
  }

  // Skip to end on click
  dialog.addEventListener('click', () => {
    if (_tw) {
      clearInterval(_tw);
      _tw = null;
      textEl.textContent = MESSAGE;
      cursor.style.display = 'block';
      _showActions();
    }
  }, { once: true });

  function _showActions() {
    cursor.style.display = 'none';
    actionsEl.style.display = 'flex';
    actionsEl.innerHTML = `
      <button class="ji-btn-dismiss" id="ji-dismiss">Pas encore...</button>
      <button class="ji-btn-accept"  id="ji-accept">→ Traverser vers Johto</button>`;

    actionsEl.querySelector('#ji-accept').addEventListener('click', () => {
      _close();
      activateJohtoRegion();
      globalThis._zsel_setActiveRegion?.('johto');
      document.querySelectorAll('#regionSwitcher .region-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.region === 'johto');
      });
      switchTab('tabZones');
      notify('🌏 Johto débloqué ! Bienvenue à New Bark Town, Parrain...', 'gold');
    });

    actionsEl.querySelector('#ji-dismiss').addEventListener('click', () => {
      _close();
      notify('📡 L\'offre reste disponible — bouton Johto ✉ dans les zones.', '');
    });
  }

  function _close() {
    if (_tw) clearInterval(_tw);
    overlay.style.transition = 'opacity .35s ease';
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.remove(); style.remove(); }, 360);
  }

  // Start typewriter after a short entrance pause
  setTimeout(() => _typewrite(MESSAGE, _showActions), 400);
}

function checkJohtoUnlock() {
  if (state.purchases?.johtoUnlocked) return;
  if (!state.zones?.['indigo_plateau']?.gymDefeated) return;
  if (state.gang.reputation < 500) return;
  // Affiche l'offre cinématique après un bref délai dramatique
  setTimeout(() => showJohtoUnlockModal(), 1800);
}

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

  // Hourly quests countdown refresh (every 10s when missions tab open)
  setInterval(() => {
    if (activeTab === 'tabMissions') renderMissionsTab();
  }, 10000);

  // Hourly quest reset check (every minute)
  setInterval(() => {
    if (state.missions?.hourly && Date.now() - state.missions.hourly.reset >= HOUR_MS) {
      initHourlyQuests();
      if (activeTab === 'tabMissions') renderMissionsTab();
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

  // Snapshot every 6 h — internally throttled + fingerprint-guarded (skipped if no new progress)
  setInterval(supaWriteSnapshot, 6 * 60 * 60 * 1000);

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
  // Persistent countdown displayed directly in the ticker (sticky until reload)
  const ticker = document.getElementById('notifTicker');
  if (!ticker) { _triggerDailyReload(); return; }

  const _showCountdown = (remaining) => {
    ticker.className  = 'notif-ticker notif-ticker-error';
    ticker.innerHTML  = `<span class="notif-ticker-icon">⚠</span>`
                      + `<span class="notif-ticker-text">🔄 Maintenance — rechargement dans ${remaining}s</span>`;
    ticker.style.opacity   = '1';
    ticker.style.transform = 'translateY(0)';
  };
  _showCountdown(seconds);

  let remaining = seconds;
  const interval = setInterval(() => {
    remaining--;
    _showCountdown(remaining);
    if (remaining <= 0) { clearInterval(interval); _triggerDailyReload(); }
  }, 1000);
}

function _triggerDailyReload() {
  saveState();
  // Navigate to hub tab before reload so player lands on it after
  switchTab('tabGang');
  setTimeout(() => location.reload(true), 500);
}

function showMigrationBanner(opts) {
  return showMigrationBannerImpl(opts);
}

configureModals({
  getState: () => state,
  setState,
  saveState,
  renderAll,
  notify,
  migrate,
  formatPlaytime,
  exportSave,
  createDefaultState,
  getActiveSaveSlot: () => activeSaveSlot,
  getSaveKeys: () => SAVE_KEYS,
  getKantoDexSize: () => KANTO_DEX_SIZE,
  getNationalDexSize: () => NATIONAL_DEX_SIZE,
  getSaveSchemaVersion: () => SAVE_SCHEMA_VERSION,
  getAgentRankLabel: (...args) => globalThis.getAgentRankLabel?.(...args),
  pokeSprite,
  speciesName,
  switchTab,
  showIntro,
  applyAutoMutation,
  cleanObsoleteData,
  getSlotPreview,
});

configureBagTab({
  getState: () => state,
  getActiveTab: () => activeTab,
  notify,
  saveState,
  updateTopBar,
  switchTab,
  showConfirm,
  isBoostActive: (...args) => globalThis.isBoostActive?.(...args),
  boostRemaining: (...args) => globalThis.boostRemaining?.(...args),
  activateBoost: (...args) => globalThis.activateBoost?.(...args),
  itemSprite: (...args) => globalThis.itemSprite?.(...args),
  openRareCandyPicker,
  renderPCTab,
});

configureTabRouter({
  getState: () => state,
  getActiveTab: () => activeTab,
  getOpenZones: () => openZones,
  switchTab,
  setPcView: value => { pcView = value; },
  getDexKantoCaught,
  getDexNationalCaught,
  getShinySpeciesCount,
  getKantoDexSize: () => KANTO_DEX_SIZE,
  getNationalDexSize: () => NATIONAL_DEX_SIZE,
  renderGangTab,
  renderZonesTab,
  renderMarketTab,
  renderPCTab,
  renderPokedexTab,
  renderAgentsTab,
  renderCosmeticsTab,
  renderMissionsTab,
  renderBattleLogTab,
  renderLeaderboardTab,
  renderCompteTab,
  renderGangCompetitionTab,
});

// ════════════════════════════════════════════════════════════════
// GLOBAL EXPORTS — functions/constants needed by extracted modules
// ════════════════════════════════════════════════════════════════
Object.assign(globalThis, {
  // Utility functions
  t, pick, weightedPick, uid, randInt, addLog, speciesName, playSE,
  getMysteryEggCost, trainerSprite, safeTrainerImg, safePokeImg,
  // UI / state helpers
  notify, saveState, setState, migrate, renderAll, slimPokemon,
  updateTopBar, tryAutoIncubate,
  renderMarketTab, renderMissionsTab, renderCosmeticsTab, renderBattleLogTab, renderLabTab,
  renderZonesTab, renderGangTab, renderAgentsTab, renderPokemonGrid, renderEggsView, renderGangBasePanel,
  activateJohtoRegion, showJohtoUnlockModal, checkJohtoUnlock,
  renderGangCompetitionTab,
  // Audio
  SFX, MusicPlayer, JinglePlayer, MUSIC_TRACKS, playTone,
  // Zone system — logique pure (zoneSystem.js)
  initZone, spawnInZone, makePokemon, makeTrainerTeam, makeRaidSpawn,
  getPokemonPower, levelUpPokemon, getZoneAgentSlots,
  getCombatRepGain, resolveCombat, resolveTrainerCombat, getTrainerCombatPreview, applyCombatResult,
  addBattleLogEntry, pushFeedEvent, rollChestLoot,
  triggerGymRaid, investInZone,
  tryCapture, calculateStats, showCaptureBurst,
  checkForNewlyUnlockedZones, showZoneUnlockPopup, _processZoneUnlockQueue,
  startActiveZone, stopActiveZone, pauseZoneIfIdle, syncActiveZones,
  startBackgroundZone, stopBackgroundZone, syncBackgroundZones, // aliases
  activateEvent, isBallAssistActive, clamp, getTeamPower,
  SPECIAL_TRAINER_KEYS,
  // Zone UI — fenêtres (zoneWindows.js)
  openZoneWindow, closeZoneWindow,
  renderZoneWindows, buildZoneWindowEl, patchZoneWindow,
  _appImpl_renderZoneWindows: renderZoneWindows,
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
  POKEMON_GEN1, SPECIES_BY_EN, EVO_BY_SPECIES, POT_UPGRADE_COSTS,
  ZONES, ZONE_BY_ID, getBaseSpecies,
  GYM_ORDER, JOHTO_GYM_ORDER,
  MISSIONS, HOURLY_QUEST_POOL, HOURLY_QUEST_REROLL_COST,
  BASE_PRICE, POTENTIAL_MULT, NATURES, BALLS, MYSTERY_EGG_POOL,
  MAX_COMBAT_REWARD, BALL_SPRITES, FALLBACK_TRAINER_SVG,
  AGENT_NAMES_M, AGENT_NAMES_F, AGENT_SPRITES, AGENT_PERSONALITIES,
  TITLE_REQUIREMENTS, TITLE_BONUSES, AGENT_RANK_LABELS, RANK_CHAIN,
  // sessionObjectives module
  isZoneUnlocked,
  BOOST_DURATIONS, ITEM_SPRITE_URLS,
  // trainingRoom module
  pokeSprite, tryAutoEvolution,
  // pension module
  showConfirm, showInfoModal, renderPCTab, switchTab, showContextMenu,
  openPlayerStatModal, resetPcRenderCache,
  getMaxPensionSlots, getPensionSlotIds,
  eggSprite, eggImgTag, EGG_SPRITES,
  renderLabTabInEl, getDexDesc,
  // zoneSelector module — zone helpers + data it reads from globalThis
  isZoneDegraded, getZoneMastery, getZoneDifficulty,
  getZoneSlotCost, ZONE_SLOT_COSTS, ZONE_BGS, SHOP_ITEMS,
  // Zone UI helpers — called by agent.js background ticks
  refreshZoneIncomeTile: _refreshZoneIncomeTile,
  updateZoneButtons: _updateZoneButtons,
  // gangBase module — helpers needed by modules/ui/gangBase.js
  openTeamPicker, openRareCandyPicker,
  pokemonDisplayName, sanitizeSpriteName,
  getDexKantoCaught, getDexJohtoCaught, getDexNationalCaught, getShinySpeciesCount,
  getBossFullTitle, getTitleLabel,
  KANTO_DEX_SIZE, JOHTO_DEX_SIZE, NATIONAL_DEX_SIZE, COSMETIC_BGS,
  // Fabric BG unlock helper — used by capture modules
  _unlockFabricBg,
  FABRIC_SPECIES, PATCH_PIDS, fabricBgUrl, fabricEmbUrl, patchUrl,
  // gangTab module
  applyCosmetics, MusicPlayer, MUSIC_TRACKS, GAME_VERSION,
  pokeIcon, openBossEditModal, openTitleModal, openShowcasePicker,
  openTeamPickerModal, showEvoPreviewModal, openNameModal, openSpritePicker,
});

configureSecretCodes({
  getState: () => state,
  notify,
  saveState,
  getTitles: () => TITLES,
  getActiveTab: () => activeTab,
  renderGangTab,
  renderCosmeticsTab,
  makePokemon,
  getSpeciesList: () => POKEMON_GEN1,
  pokeSprite,
  renderPokemonGrid,
  updateTopBar,
  document,
  resetPcRenderCache,
});

configureSaveSlots({
  getState: () => state,
  setState,
  getSaveKeys: () => SAVE_KEYS,
  getActiveSaveSlot: () => activeSaveSlot,
  setActiveSaveSlot: slotIdx => setActiveSaveSlotValue(slotIdx, { persist: true }),
  localStorage,
  document,
  formatPlaytime,
  notify,
  showConfirm,
  saveState,
  migrate,
  renderAll,
});

configureSaveRepair({
  getState: () => state,
  setState,
  migrate,
  saveState,
  renderAll,
  notify,
  showConfirm,
  document,
  getTitles: () => TITLES,
  getZones: () => ZONES,
  MAX_HISTORY,
});

configureCloudAccount({
  getState: () => state,
  getActiveTab: () => activeTab,
  getActiveSaveSlot: () => activeSaveSlot,
  getSupabaseConfig: () => ({
    url: typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : '',
    anonKey: typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '',
  }),
  getSupabaseSdk: () => window.supabase,
  localStorage,
  document,
  fetch,
  slimPokemon,
  setState,
  migrate,
  saveState,
  renderAll,
  notify,
  showConfirm,
  getDexKantoCaught,
  getDexNationalCaught,
  getShinySpeciesCount,
  switchTab,
});

configureGangCompetition({
  getState:         () => state,
  saveState,
  notify,
  slimPokemon,
  getSupabaseClient,
  getSupaSession,
});

configureZoneCombat({
  getState: () => state,
  getPokemonPower,
  getTeamPower,
});

configurePcPokedex({
  getState: () => state,
  getActiveTab: () => activeTab,
  getPcView: () => pcView,
  setPcView: value => { pcView = value; },
  window,
  document,
  getSpeciesList: () => POKEMON_GEN1,
  getSpeciesMap: () => SPECIES_BY_EN,
  getEvolutionsBySpecies: () => EVO_BY_SPECIES,
  getPotentialUpgradeCosts: () => POT_UPGRADE_COSTS,
  getNatures: () => NATURES,
  getBalls: () => BALLS,
  getZones: () => ZONES,
  getZoneById: () => ZONE_BY_ID,
  getKantoDexSize: () => KANTO_DEX_SIZE,
  getJohtoDexSize: () => JOHTO_DEX_SIZE,
  getNationalDexSize: () => NATIONAL_DEX_SIZE,
  saveState,
  notify,
  showConfirm,
  switchTab,
  updateTopBar,
  t,
  calculateStats,
  evolvePokemon,
  tryAutoEvolution,
  rollMoves,
  getPokemonPower,
  getBaseSpecies,
  makePokemon,
  speciesName,
  typeFr: value => (typeof typeFr === 'function' ? typeFr(value) : value),
  pokeSprite,
  calculatePrice,
  getMarketSaturation,
  removePokemonFromAllAssignments,
  sellPokemon,
  getPensionSlotIds,
  getMaxPensionSlots,
  openAssignToPicker,
  renderAgentsTab,
  renderGangTab,
  renderLabTabInEl,
  renderTrainingTab,
  renderPensionView,
  eggSprite,
  eggImgTag,
  getDexKantoCaught,
  getDexJohtoCaught,
  getDexNationalCaught,
  getShinySpeciesCount,
  playSfx: key => SFX.play?.(key),
});

configureSettingsModal({
  getState: () => state,
  setState,
  window,
  document,
  localStorage,
  location,
  caches: globalThis.caches,
  MusicPlayer,
  SFX,
  GAME_VERSION,
  getSpeciesMap: () => SPECIES_BY_EN,
  getPokemonSprite: (...args) => (
    typeof getPokemonSprite === 'function' ? getPokemonSprite(...args) : undefined
  ),
  exportSave,
  importSave,
  saveState,
  showConfirm,
  notify,
  t,
  createDefaultState,
  getSaveKey: () => SAVE_KEY,
  getOpenZones: () => openZones,
  closeZoneWindow,
  showIntro,
  tryCheatCode,
  detectLLM: (...args) => globalThis.detectLLM?.(...args),
  renderAll,
  resetTransientSelections: resetPcSelection,
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
    setState(saved);
  }
  state.sessionStart = Date.now();
  _sessionStatsBase = globalThis._gangSessionStatsBase = { ...state.stats };

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
  // Events tab renders on demand (switchTab triggers renderBattleLogTab via renderActiveTab)

  // Init filter/sort listeners for PC (reset page on change, force full rebuild)
  document.getElementById('pcSearch')?.addEventListener('input', () => {
    const val = document.getElementById('pcSearch')?.value || '';
    if (checkSecretCode(val)) {
      document.getElementById('pcSearch').value = '';
      return;
    }
    if (activeTab === 'tabPC') { setPcPage(0); renderPokemonGrid(true); }
  });
  document.getElementById('pcSort')?.addEventListener('change', () => {
    if (activeTab === 'tabPC') { setPcPage(0); renderPokemonGrid(true); }
  });
  document.getElementById('pcFilter')?.addEventListener('change', () => {
    if (activeTab === 'tabPC') { setPcPage(0); renderPokemonGrid(true); }
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
      startActiveZone(zId); // timer unifié (tickZoneSpawn car zone ouverte)
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
      typeof loadEggSprites === 'function' ? loadEggSprites() : Promise.resolve(),
    ]).then(results => {
      const labels = ['pokemon-sprites', 'item-sprites', 'trainer-sprites', 'zone-trainer-pools', 'egg-sprites'];
      results.forEach((r, i) => {
        if (r.status === 'rejected') console.warn(`[Sprites] Échec chargement ${labels[i]} :`, r.reason);
      });
    });
  }

  // Réactiver Johto si déjà débloqué (save existante)
  if (state.purchases?.johtoUnlocked) activateJohtoRegion();

  // Configure intro module
  configureIntro({
    getState: () => state,
    makePokemon,
    calculateStats,
    pokeSprite,
    trainerSprite,
    BOSS_SPRITES,
    saveState,
    notify,
  });

  // Start game loop
  startGameLoop();

  // Check if Johto offer should be presented at this session
  if (!state.purchases?.johtoUnlocked) {
    setTimeout(() => checkJohtoUnlock(), 4000);
  }

  // Catch-up starter gift: existing players who never saw the Giovanni intro
  if (state.gang?.initialized && !state.gang?.introSeen) {
    setTimeout(() => {
      openStarterGiftPopup({ onComplete: () => renderAll() });
    }, 800);
  }
}

window.addEventListener('DOMContentLoaded', boot);
