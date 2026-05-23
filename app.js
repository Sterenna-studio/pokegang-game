// ============================================================
// POKEFORGE v6 — Gang Wars  (vanilla JS, single-file engine)
// ============================================================

'use strict';

import { Scheduler } from './modules/core/tickManager.js';
import { EventBus, EVENTS } from './modules/core/eventBus.js';
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
import './modules/systems/bossPower.js';
import './modules/systems/agent.js';
import './modules/systems/sessionObjectives.js';
import './modules/systems/trainingRoom.js';
import './modules/systems/pension.js';
import './modules/systems/zoneSystem.js';
import './modules/systems/zoneLevels.js';
import './modules/ui/agentSheet.js';
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
import './modules/systems/johto.js';
import './modules/systems/hoenn.js';
import './modules/systems/sinnoh.js';
import './modules/ui/pickers.js';
import { configureIntro, openGiovanniIntro, openStarterGiftPopup } from './modules/ui/intro.js';
import { checkDarkraiCutscene, triggerDarkraiOnLeagueVictory } from './modules/ui/darkraiEvent.js';
import './modules/systems/pokemon.js';
import './modules/systems/titles.js';
import './modules/ui/cosmetics.js';
import './modules/ui/hubModals.js';
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
import { NATURES, NATURE_KEYS, BOSS_SPRITES, AGENT_NAMES_M, AGENT_NAMES_F, AGENT_SPRITES, AGENT_PERSONALITIES, TITLE_REQUIREMENTS, TITLE_BONUSES, AGENT_RANK_LABELS, RANK_CHAIN, SHOWCASE_SLOTS, MAX_BOSS_NAME_LENGTH, MAX_GANG_NAME_LENGTH, KANTO_DEX_MIN, KANTO_DEX_MAX, JOHTO_DEX_MIN, JOHTO_DEX_MAX, CHROMA_CHARM_COST } from './data/game-config-data.js';
import { I18N } from './data/i18n-data.js';
import { ZONE_BG_URL, GYM_ORDER, JOHTO_GYM_ORDER, HOENN_GYM_ORDER, SINNOH_GYM_ORDER } from './data/zones-config-data.js';
import { HOURLY_QUEST_REROLL_COST, BOOST_DURATIONS, BALL_ASSIST_MIN_BALLS, BALL_ASSIST_DURATION_MS, PASSIVE_XP_PER_TICK, MAX_LOG_ENTRIES, DEFAULT_MUSIC_VOL, DEFAULT_UI_SCALE, DEFAULT_ZONE_SCALE, TICK_AGENT_MS, TICK_PASSIVE_AGENT_MS, TICK_MISSIONS_UI_MS, TICK_HOURLY_CHECK_MS, TICK_MARKET_DECAY_MS, TICK_VERSION_POLL_MS, TICK_VERSION_FIRST_MS, TICK_AUTO_SAVE_MS, TICK_CLOUD_SAVE_MS, TICK_SNAPSHOT_MS, TICK_LEADERBOARD_MS, TICK_TRAINING_MS, TICK_PENSION_MS, TICK_PASSIVE_XP_MS, TICK_ZONE_REFRESH_MS, TICK_DAILY_CHECK_MS, UPDATE_COUNTDOWN_S, DAILY_COUNTDOWN_S, JOHTO_UNLOCK_DELAY_MS } from './data/gameplay-config-data.js';
import { SPECIAL_TRAINER_KEYS, MAX_COMBAT_REWARD } from './data/combat-config-data.js';
import { FALLBACK_TRAINER_SVG, FALLBACK_POKEMON_SVG, BALL_SPRITES, ITEM_SPRITE_URLS, CHEST_SPRITE_URL, SHOWDOWN_SPRITE_BASE, SHOWDOWN_TRAINER_SPRITE_BASE, POKEOS_EGG_BASE_URL, LOGO_URL, LOGO_SMALL_URL, EGG_SPRITE_NB, EGG_SPRITES, CUSTOM_TRAINER_SPRITES } from './data/assets-data.js';
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
import { createStore } from './state/store.js';

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
// KANTO_DEX_MIN/MAX, JOHTO_DEX_MIN/MAX importés depuis data/game-config-data.js
const KANTO_DEX_SIZE    = KANTO_DEX_MAX; // 151
// Pokédex National = toutes les espèces non-cachées disponibles dans le jeu
const NATIONAL_DEX_SIZE = POKEMON_GEN1.filter(s => !s.hidden).length;
const JOHTO_DEX_SIZE    = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= JOHTO_DEX_MIN && s.dex <= JOHTO_DEX_MAX).length;

// Helpers de comptage — centralisés ici pour éviter la duplication partout dans l'UI
function getDexKantoCaught()   { return POKEMON_GEN1.filter(s => !s.hidden && s.dex >= KANTO_DEX_MIN && s.dex <= KANTO_DEX_MAX && state.pokedex[s.en]?.caught).length; }
function getDexJohtoCaught()   { return POKEMON_GEN1.filter(s => !s.hidden && s.dex >= JOHTO_DEX_MIN && s.dex <= JOHTO_DEX_MAX && state.pokedex[s.en]?.caught).length; }
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

// Expose activeSaveSlot as a live getter/setter on globalThis so extracted modules can read it
Object.defineProperty(globalThis, 'activeSaveSlot', {
  get: () => activeSaveSlot,
  set: v => { activeSaveSlot = v; },
  configurable: true,
});

function setActiveSaveSlotValue(idx, opts = {}) {
  activeSaveSlot = idx;
  SAVE_KEY = SAVE_KEYS[idx];
  if (opts?.persist) localStorage.setItem('pokeforge.activeSlot', String(idx));
  // Sync store slot so store.save() writes to the right key
  _store?.setActiveSaveSlot(idx, { persist: false }); // persist géré ligne au-dessus
}

// Résultat de migration exposé au boot pour afficher le banner
let _migrationResult = null; // null | { from: string, fields: string[] }

let state = structuredClone(DEFAULT_STATE);
globalThis.state = state;

// ── Store (Chantier 2) ────────────────────────────────────────────────────────
// Instancié ici ; chargé et utilisé dans boot().
// Gère la sérialisation, la migration et la persistance localStorage.
// Le cloudSave est null ici — le tick cloudSave du Scheduler le gère séparément.
let _store = null; // initialisé dans _createStoreInstance() appelé au boot

function _createStoreInstance() {
  _store = createStore({
    localStorageRef: localStorage,
    initialState:    createDefaultState(),
    notify:          (msg, type) => notify(msg, type),
    speciesByEn:     SPECIES_BY_EN,
    uid,
    now:             () => Date.now(),
  });
  globalThis._store = _store; // debug access
  return _store;
}

function setState(nextState) {
  state = nextState;
  globalThis.state = state;
  // Synchronise le store avec le nouvel objet state (après loadSlot etc.)
  if (_store) _store.setState(nextState, { emit: false });
  invalidateLookupMaps(); // new state object — maps must be rebuilt
  _stateDirty = true;
  return state;
}

// ── Sérialisation slim des pokémons ──────────────────────────────────────────
// On ne touche PAS les objets en mémoire : on crée un clone allégé pour la save.
// Champs supprimés : dérivables au runtime (species_fr, dex) + valeurs par défaut
// (assignedTo=null, cooldown=0, homesick=false, favorite=false, xp=0).
// Gain moyen : ~35% sur la section pokemons soit ~20-25% sur la save totale.
// slimPokemon — importée depuis state/serialization.js

// _autoSave — called only by the autosave setInterval.
// Skips serialization when nothing changed since last save.
function _autoSave() {
  if (!_stateDirty) return;
  saveState();
}

function saveState() {
  _stateDirty = false;
  globalThis.state = state; // keep modules in sync
  _playerWasActive = true; // signal leaderboard timer that the player is active

  // Délègue sérialisation/persistance au store (Chantier 2).
  // Le store gère : marketSales guard, playtime, _savedAt, slim payload, QuotaError.
  // Cloud sync : géré par le tick cloudSave du Scheduler (pas ici).
  _store.save();
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

// ── Lookup Maps (O(1) Pokémon / Agent access) ────────────────────────────────
// Rebuilt lazily whenever invalidateLookupMaps() is called (i.e. after any
// push/splice/filter mutation on state.pokemons or state.agents).
// Hot-path callers use pokemonById(id) / agentById(id) instead of array.find().
let _pokemonMap = null;
let _agentMap   = null;

function _rebuildLookupMaps() {
  _pokemonMap = new Map(state.pokemons.map(p  => [p.id,  p]));
  _agentMap   = new Map(state.agents.map(a    => [a.id,  a]));
}

function invalidateLookupMaps() {
  _pokemonMap = null;
  _agentMap   = null;
}

function pokemonById(id) {
  if (!_pokemonMap) _rebuildLookupMaps();
  return _pokemonMap.get(id) ?? null;
}

function agentById(id) {
  if (!_agentMap) _rebuildLookupMaps();
  return _agentMap.get(id) ?? null;
}

// ── Dirty flag for autosave ───────────────────────────────────────────────────
// Set to true by markDirty() after any meaningful state mutation.
// The 10s autosave interval skips the serialization when clean.
// Explicit saveState() calls (after user actions) always save regardless.
let _stateDirty = true; // start dirty so first autosave always fires

function markDirty() {
  _stateDirty = true;
  invalidateLookupMaps();
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
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
  if (state.log.length > MAX_LOG_ENTRIES) state.log.length = MAX_LOG_ENTRIES;
}

function sanitizeSpriteName(en) {
  // Showdown sprites use no hyphens for nidoran: nidoranf, nidoranm
  // and some others like mr-mime -> mrmime, farfetchd, etc.
  return en.replace(/[^a-z0-9]/g, '');
}

// ── HTML escape — pour sécuriser toutes les valeurs user-input injectées
//    via innerHTML (bossName, gang.name, agent names, etc.). Préviens les
//    injections type <img onerror=...> stockées dans le state puis exposées
//    via le cloud Supabase aux autres joueurs (gangCompetition).
function escapeHtml(str) {
  if (str == null) return '';
  const s = String(str);
  return s.replace(/[&<>"']/g, ch => (
    ch === '&' ? '&amp;' :
    ch === '<' ? '&lt;'  :
    ch === '>' ? '&gt;'  :
    ch === '"' ? '&quot;':
                 '&#39;'
  ));
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
  return `${SHOWDOWN_SPRITE_BASE}${folder}/${name}.${ext}`;
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
  return `${SHOWDOWN_SPRITE_BASE}bwicons/${name}.png`;
}

// ── Egg sprites ──────────────────────────────────────────────────────────────
// EGG_SPRITES et EGG_SPRITE_NB importés depuis data/assets-data.js

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
  const bwFallback = EGG_SPRITE_NB; // fallback universel NB (pokepedia, toujours dispo)
  const baseStyle = `object-fit:contain;image-rendering:pixelated;${style}`;

  // Pension egg (parents known) or scanned (species revealed) → try PokéOS first
  const isRevealed = (egg?.parentA && egg?.parentB) || (egg?.scanned && egg?.revealedSpecies);
  if (!ready && isRevealed && egg?.species_en) {
    const sp = SPECIES_BY_EN[egg.species_en];
    const dex = sp?.dex;
    if (dex) {
      const pokeos     = `${POKEOS_EGG_BASE_URL}${dex}-animegg.png`;
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

// Custom sprite overrides — importés depuis data/assets-data.js

// ── Trainer sprite resolution ────────────────────────────────────────────────
// Index à plat construit après chargement de trainer-sprites-grouped.json
const _trainerJsonIndex = {};

function _buildTrainerIndex(data) {
  // `data` = résultat de loadTrainerGroups() — TRAINER_GROUPS n'est plus global (IIFE loaders.js)
  if (!data?.trainers) return;
  const groups = data.trainers;
  for (const [groupName, groupData] of Object.entries(groups)) {
    if (groupName === 'factions') {
      for (const [, arr] of Object.entries(groupData)) {
        if (Array.isArray(arr)) arr.forEach(rel => {
          const slug = rel.replace(/\.png$/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
          _trainerJsonIndex[slug] = SHOWDOWN_TRAINER_SPRITE_BASE + rel;
        });
      }
    } else if (typeof groupData === 'object' && !Array.isArray(groupData)) {
      for (const [key, rel] of Object.entries(groupData)) {
        const slug = rel.replace(/\.png$/, '').toLowerCase();
        const keyNorm = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
        _trainerJsonIndex[slug] = SHOWDOWN_TRAINER_SPRITE_BASE + rel;
        _trainerJsonIndex[keyNorm] = SHOWDOWN_TRAINER_SPRITE_BASE + rel;
      }
    }
  }
  // Rafraîchir les images boss de la page de connexion (rendues AVANT le chargement
  // du JSON trainer-sprites-grouped). Sans ça les sprites tombent sur l'URL Showdown
  // directe qui peut 404 selon la casse, et le fallback affiche la silhouette SVG.
  document.querySelectorAll('img.isc-boss-img[data-boss-key]').forEach(img => {
    const key = img.getAttribute('data-boss-key');
    if (!key) return;
    const url = trainerSprite(key);
    if (url && url !== img.src) img.src = url;
  });
}

function trainerSprite(name) {
  if (CUSTOM_TRAINER_SPRITES[name]) return CUSTOM_TRAINER_SPRITES[name];
  // Chercher dans l'index JSON si disponible
  const norm = (name || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (_trainerJsonIndex[norm]) return _trainerJsonIndex[norm];
  // Fallback Showdown
  const fixed = SPRITE_FIX[name] || name;
  return `${SHOWDOWN_TRAINER_SPRITE_BASE}${fixed}.png`;
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
//  4.  POKEMON MODULE  (extracted → modules/systems/pokemon.js)
// ════════════════════════════════════════════════════════════════

function rollNature(...a)         { return globalThis.rollNature?.(...a); }
function rollPotential(...a)      { return globalThis.rollPotential?.(...a); }
function rollShiny(...a)          { return globalThis.rollShiny?.(...a); }
function rollMoves(...a)          { return globalThis.rollMoves?.(...a); }
function calculateStats(...a)     { return globalThis.calculateStats?.(...a); }
function makePokemon(...a)        { return globalThis.makePokemon?.(...a); }
function getPokemonPower(...a)    { return globalThis.getPokemonPower?.(...a); }
function checkEvolution(...a)     { return globalThis.checkEvolution?.(...a); }
function evolvePokemon(...a)      { return globalThis.evolvePokemon?.(...a); }
function tryAutoEvolution(...a)   { return globalThis.tryAutoEvolution?.(...a); }
function showPokemonLevelPopup(...a) { return globalThis.showPokemonLevelPopup?.(...a); }
function levelUpPokemon(...a)     { return globalThis.levelUpPokemon?.(...a); }

// ════════════════════════════════════════════════════════════════
//  5.  ZONE MODULE
// ════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════
//  5b.  TITLES MODULE  (extracted → modules/systems/titles.js)
// ════════════════════════════════════════════════════════════════

function getTitleLabel(...a)      { return globalThis.getTitleLabel?.(...a); }
function getBossFullTitle(...a)   { return globalThis.getBossFullTitle?.(...a); }
function checkTitleUnlocks(...a)  { return globalThis.checkTitleUnlocks?.(...a); }
function openTitleModal(...a)     { return globalThis.openTitleModal?.(...a); }


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
    const p = pokemonById(id);
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

// ── Economy mutation helpers ─────────────────────────────────────────────────
// Préférer addMoney/addReputation aux mutations directes :
//   state.gang.money += delta  ←  ❌ legacy
//   addMoney(delta)            ←  ✅ émet EVENTS.MONEY_CHANGED + markDirty
// Les modules réactifs (achievements, missions, audio) peuvent s'abonner.
function addMoney(delta) {
  if (!delta) return;
  state.gang.money = Math.max(0, (state.gang.money || 0) + delta);
  EventBus.emit(EVENTS.MONEY_CHANGED, { delta, newTotal: state.gang.money });
  EventBus.emit(EVENTS.STATE_DIRTY);
}
function addReputation(delta) {
  if (!delta) return;
  state.gang.reputation = Math.max(0, (state.gang.reputation || 0) + delta);
  EventBus.emit(EVENTS.REP_CHANGED, { delta, newTotal: state.gang.reputation });
  EventBus.emit(EVENTS.STATE_DIRTY);
}
Object.assign(globalThis, { addMoney, addReputation });

function notify(msg, type = '') {
  if (type === 'gold') SFX.play('notify');
  // Routed to notification panel (replaces old #notifications toast system)
  // category = type if recognized, otherwise 'system'
  globalThis._npanel_push?.({ category: type || 'system', title: msg, type });
}

// Milestone : CHROMA_CHARM_COST₽ → Charme Chroma
function checkMoneyMilestone() {
  if (state?.purchases?.chromaCharm) return;
  if (state.gang.money >= CHROMA_CHARM_COST) {
    state.gang.money -= CHROMA_CHARM_COST;
    state.purchases.chromaCharm = true;
    saveState();
    SFX.play('unlock');
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.96);display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:var(--bg-panel);border:3px solid var(--red);border-radius:var(--radius);padding:28px 32px;max-width:440px;width:92%;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px">
        <img src="${LOGO_URL}" style="width:72px;height:72px;image-rendering:pixelated" onerror="this.style.display='none'">
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--red);letter-spacing:2px">⚠ ALERTE — ${CHROMA_CHARM_COST.toLocaleString()}₽ DÉTECTÉS</div>
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
          Vos <b style="color:var(--red)">${CHROMA_CHARM_COST.toLocaleString()}₽</b> ont été convertis en<br>
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
  [btoa('RICHISSIM')]:       { money: CHROMA_CHARM_COST / 2 },
  [btoa('DOUBLERICHISSIM')]: { money: CHROMA_CHARM_COST, title: 'doublerichissim' },
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
  return Object.keys(BALLS).reduce((sum, key) => sum + (inv[key] || 0), 0);
}

function checkBallAssist() {
  if (Date.now() < _ballAssistUntil) return; // déjà actif
  if (getTotalBalls() < BALL_ASSIST_MIN_BALLS) {
    _ballAssistUntil = Date.now() + BALL_ASSIST_DURATION_MS;
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
  // Notifie les modules abonnés (ex: gangBase auto-refresh à l'arrivée sur Zones)
  EventBus.emit(EVENTS.UI_TAB_CHANGED, { tabId });
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

// ── Chantier 5 — updateTopBar debounce + dex badge cache ─────────────────────
// updateTopBar() est appelée ~80× par tick d'agent (capture + save + topBar).
// On la debounce via rAF (1 seul DOM write par frame) et on cache le badge dex
// (scan O(n) sur POKEMON_GEN1) jusqu'à ce que le compte de pokémons capturés change.

let _topBarRafId   = 0;           // rAF handle pour debounce
let _dexBadgeCache = '';          // icon cached
let _dexBadgeCaughtCount = -1;    // invalidation clé : nb de pokémons distincts capturés

function _updateTopBarImpl() {
  const gangEl = document.getElementById('gangNameDisplay');
  const moneyEl = document.getElementById('moneyDisplay');
  if (gangEl) {
    const caughtCount = Object.keys(state.pokedex).filter(k => state.pokedex[k]?.caught).length;
    if (caughtCount !== _dexBadgeCaughtCount) {
      _dexBadgeCaughtCount = caughtCount;
      const kantoComplete = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= KANTO_DEX_MIN && s.dex <= KANTO_DEX_MAX).every(s => state.pokedex[s.en]?.caught);
      const fullComplete  = POKEMON_GEN1.filter(s => !s.hidden).every(s => state.pokedex[s.en]?.caught);
      _dexBadgeCache      = fullComplete ? ' 🌟' : kantoComplete ? ' 📖' : '';
    }
    gangEl.textContent = state.gang.name + _dexBadgeCache;
  }
  if (moneyEl) moneyEl.innerHTML = `<span>₽</span> ${state.gang.money.toLocaleString()}`;
  const repEl = document.getElementById('repDisplay');
  if (repEl) repEl.innerHTML = `<span>⭐</span> ${state.gang.reputation.toLocaleString()}`;
  const pkCountEl = document.getElementById('pokemonCountDisplay');
  if (pkCountEl) pkCountEl.innerHTML = `<img src="${ITEM_SPRITE_URLS.pokeball}" style="width:20px;height:20px;image-rendering:pixelated" onerror="this.style.display='none'"> ${state.pokemons.length.toLocaleString()}`;

  // ── Ball assist silencieux (early-game) ───────────────────
  checkBallAssist();
  checkTitleUnlocks();
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

// updateTopBar publique — debounce via rAF pour éviter N DOM writes par tick.
// Les appels multiples dans la même frame sont fusionnés en un seul rendu.
function updateTopBar() {
  if (_topBarRafId) return; // déjà en attente
  _topBarRafId = requestAnimationFrame(() => {
    _topBarRafId = 0;
    _updateTopBarImpl();
  });
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
//  COSMETICS  (extracted → modules/ui/cosmetics.js)
// ════════════════════════════════════════════════════════════════

function _resolveFabricBgUrl(...a) { return globalThis._resolveFabricBgUrl?.(...a); }
function applyCosmetics(...a)      { return globalThis.applyCosmetics?.(...a); }
function _unlockFabricBg(...a)     { return globalThis._unlockFabricBg?.(...a); }
function openNameModal(...a)       { return globalThis.openNameModal?.(...a); }
function openSpritePicker(...a)    { return globalThis.openSpritePicker?.(...a); }

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
      while (state.gang.showcase.length < SHOWCASE_SLOTS) state.gang.showcase.push(null);
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
        <input id="bossEditName" type="text" maxlength="${MAX_BOSS_NAME_LENGTH}" value="${state.gang.bossName}"
          style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:8px 10px;font-size:12px;outline:none;width:100%;box-sizing:border-box">
        <label style="font-size:9px;color:var(--text-dim)">Nom du Gang</label>
        <input id="bossEditGangName" type="text" maxlength="${MAX_GANG_NAME_LENGTH}" value="${state.gang.name}"
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
    if (newBossName) state.gang.bossName = newBossName.slice(0, MAX_BOSS_NAME_LENGTH);
    if (newGangName) state.gang.name = newGangName.slice(0, MAX_GANG_NAME_LENGTH);
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
      const pk = pokemonById(id);
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
    const pk = pokemonById(id);
    return pk ? `<div style="display:flex;align-items:center;gap:6px;padding:4px 8px">
      <img src="${pokeSprite(pk.species_en)}" style="width:28px;height:28px;image-rendering:pixelated">
      <div style="font-size:9px">${speciesName(pk.species_en)} Lv.${pk.level} ${'★'.repeat(pk.potential)}</div>
    </div>` : '';
  }).join('') || '<div style="font-size:9px;color:var(--text-dim);padding:8px">Salle vide</div>';

  const pensionIds = state.pension?.slots || [];
  const pensionHtml = pensionIds.map(id => {
    const pk = pokemonById(id);
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
// ── Pickers — extraits vers modules/ui/pickers.js ────────────────────────────
function openTeamPicker(type, targetId, onDone) { globalThis.openTeamPicker?.(type, targetId, onDone); }
function openAssignToPicker(pokemonId)           { globalThis.openAssignToPicker?.(pokemonId); }

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

function openRareCandyPicker() { globalThis.openRareCandyPicker?.(); }

function renderBagTab() {
  return renderBagTabImpl();
}

// ════════════════════════════════════════════════════════════════
// 19.  UI — INTRO OVERLAY + HUB MODALS  (extracted → modules/ui/hubModals.js)
// ════════════════════════════════════════════════════════════════

function openHubSlotRepairModal(...a) { return globalThis.openHubSlotRepairModal?.(...a); }

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
              ${preview.bossSprite
                ? `<img src="${trainerSprite(preview.bossSprite)}" class="isc-boss-img" alt="${escapeHtml(preview.bossSprite)}" data-boss-key="${escapeHtml(preview.bossSprite)}" style="width:52px;height:52px;image-rendering:pixelated" onerror="this.src='${FALLBACK_TRAINER_SVG}';this.onerror=null">`
                : '<div style="width:52px;height:52px;background:var(--bg);border-radius:4px;opacity:.3"></div>'}
              <span class="isc-boss-badge"><img src="${LOGO_SMALL_URL}" alt=""></span>
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
            onComplete: () => {
              // slot switch + saveState already done inside _confirm()
              document.getElementById('introOverlay')?.classList.remove('active');
              stopShowcase?.();
              renderAll();
            },
          });
        }
      });
    });
  };
  renderSlots();

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

}

// ════════════════════════════════════════════════════════════════
// 19b. BOSS SPRITE VALIDATOR  (extracted → modules/ui/hubModals.js)
// ════════════════════════════════════════════════════════════════

function checkBossSpriteValidity(...a)   { return globalThis.checkBossSpriteValidity?.(...a); }
function showBossSpriteRepairModal(...a) { return globalThis.showBossSpriteRepairModal?.(...a); }

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

let _gameLoopStarted  = false; // guard against double-start
let _playerWasActive = false; // set by saveState(); consumed by the 2h leaderboard timer

// ── Fonctions nommées pour le Scheduler ──────────────────────
// (extraites des lambdas inline de startGameLoop)
function _tickMissionsUI() {
  if (activeTab === 'tabMissions') renderMissionsTab();
}
function _tickHourlyCheck() {
  if (!state.missions?.hourly) return;
  if (Date.now() - state.missions.hourly.reset < HOUR_MS) return;
  initHourlyQuests();
  if (activeTab === 'tabMissions') renderMissionsTab();
  notify('⏰ Nouvelles quêtes horaires disponibles !', 'gold');
}
function _tickLeaderboard() {
  if (!_playerWasActive) return;
  _playerWasActive = false;
  supaUpdateLeaderboardAnon();
}
function _tickPassiveXP() {
  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
  if (teamIds.size === 0) return;
  let leveled = false;
  for (const id of teamIds) {
    const p = pokemonById(id);
    if (p) leveled = levelUpPokemon(p, PASSIVE_XP_PER_TICK) || leveled;
  }
  if (leveled) saveState();
}
function _tickZoneRefresh() {
  for (const zoneId of openZones) {
    updateZoneTimers(zoneId);
    _refreshRaidBtn(zoneId);
  }
  if (activeTab === 'tabZones') _zsRefreshAllTiles();
}

// ════════════════════════════════════════════════════════════════
// JOHTO — Extension régionale
// ════════════════════════════════════════════════════════════════

// ── Johto — extraite vers modules/systems/johto.js ───────────────────────────
function activateJohtoRegion() { globalThis.activateJohtoRegion?.(); }

function showJohtoUnlockModal() { globalThis.showJohtoUnlockModal?.(); }
function checkJohtoUnlock()     { globalThis.checkJohtoUnlock?.(); }

// ── Hoenn — extraite vers modules/systems/hoenn.js ───────────────────────────
function activateHoennRegion()  { globalThis.activateHoennRegion?.(); }
function showHoennUnlockModal() { globalThis.showHoennUnlockModal?.(); }
function checkHoennUnlock()     { globalThis.checkHoennUnlock?.(); }

// ── Sinnoh — extraite vers modules/systems/sinnoh.js ─────────────────────────
function activateSinnohRegion()  { globalThis.activateSinnohRegion?.(); }
function showSinnohUnlockModal() { globalThis.showSinnohUnlockModal?.(); }
function checkSinnohUnlock()     { globalThis.checkSinnohUnlock?.(); }

function startGameLoop() {
  // Guard: only start once — prevents interval accumulation on hot-reload
  if (_gameLoopStarted) return;
  _gameLoopStarted = true;

  // Initialiser les timers background pour les zones fermées avec agents
  syncBackgroundZones();

  // Initialiser les niveaux de zone v2
  initZoneLevels();

  // ── Tick Manager — enregistrement de toutes les tâches ──────
  // skipWhenHidden:true  = skip si document.hidden (onglet caché)
  // skipWhenHidden:false = tourne toujours (saves, cloud, versions)

  // Gameplay — critique, skip si onglet caché
  Scheduler.register('agentTick',       agentTick,          TICK_AGENT_MS,        { skipWhenHidden: true  });
  Scheduler.register('passiveAgentTick',passiveAgentTick,   TICK_PASSIVE_AGENT_MS,{ skipWhenHidden: true  });
  Scheduler.register('tickHourlyCheck', _tickHourlyCheck,   TICK_HOURLY_CHECK_MS, { skipWhenHidden: true  });
  Scheduler.register('tickMissionsUI',  _tickMissionsUI,    TICK_MISSIONS_UI_MS,  { skipWhenHidden: true  });
  Scheduler.register('zoneEvents',      tickAllZoneEvents,  TICK_TRAINING_MS,     { skipWhenHidden: true  });
  Scheduler.register('trainingRoom',    trainingRoomTick,   TICK_TRAINING_MS,     { skipWhenHidden: true  });
  Scheduler.register('pensionTick',     pensionTick,        TICK_PENSION_MS,      { skipWhenHidden: true  });
  Scheduler.register('passiveXP',       _tickPassiveXP,     TICK_PASSIVE_XP_MS,   { skipWhenHidden: true  });
  Scheduler.register('zoneRefresh',     _tickZoneRefresh,   TICK_ZONE_REFRESH_MS, { skipWhenHidden: true  });
  Scheduler.register('marketDecay',     decayMarketSales,   TICK_MARKET_DECAY_MS, { skipWhenHidden: true  });

  // Persistance — tourne même en arrière-plan
  Scheduler.register('autoSave',        _autoSave,          TICK_AUTO_SAVE_MS,    { skipWhenHidden: false });
  Scheduler.register('cloudSave',       supaCloudSave,      TICK_CLOUD_SAVE_MS,   { skipWhenHidden: false });
  Scheduler.register('snapshot',        supaWriteSnapshot,  TICK_SNAPSHOT_MS,     { skipWhenHidden: false });
  Scheduler.register('leaderboard',     _tickLeaderboard,   TICK_LEADERBOARD_MS,  { skipWhenHidden: false });
  Scheduler.register('versionPoll',     pollRemoteVersion,  TICK_VERSION_POLL_MS, { skipWhenHidden: false });

  // Premier poll de version peu après le boot (setTimeout conservé)
  setTimeout(pollRemoteVersion, TICK_VERSION_FIRST_MS);

  // Daily reload at 12h00 + 00h00
  startDailyReloadSchedule();

  // Lance le master clock (un seul setInterval à 1 s pour tout)
  Scheduler.start();

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

  let remaining = UPDATE_COUNTDOWN_S;

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
    <span id="updateBannerMsg">⚡ Nouvelle version <strong>${newVer}</strong> — rechargement dans <strong id="updateCountdown">${UPDATE_COUNTDOWN_S}</strong>s</span>
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
  // Enregistré dans le Scheduler central — `skipWhenHidden:false` car le
  // check doit tourner même onglet en background (pour proposer le reload
  // à heure fixe au retour).
  Scheduler.register('dailyReload', _checkDailyReload, TICK_DAILY_CHECK_MS, { skipWhenHidden: false });
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
    _runDailyCountdown(DAILY_COUNTDOWN_S);
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
  // Lookup maps + dirty flag
  pokemonById, agentById, invalidateLookupMaps, markDirty,
  // Utility functions
  t, pick, weightedPick, uid, randInt, addLog, speciesName, playSE,
  getMysteryEggCost, trainerSprite, safeTrainerImg, safePokeImg,
  // UI / state helpers
  notify, saveState, setState, migrate, renderAll, slimPokemon,
  updateTopBar, tryAutoIncubate,
  renderMarketTab, renderMissionsTab, renderCosmeticsTab, renderBattleLogTab, renderLabTab,
  renderZonesTab, renderGangTab, renderAgentsTab, renderPokemonGrid, renderEggsView, renderGangBasePanel,
  // activateJohtoRegion, showJohtoUnlockModal, checkJohtoUnlock   — set by modules/systems/johto.js
  // activateHoennRegion, showHoennUnlockModal, checkHoennUnlock   — set by modules/systems/hoenn.js
  // activateSinnohRegion, showSinnohUnlockModal, checkSinnohUnlock — set by modules/systems/sinnoh.js
  renderGangCompetitionTab,
  // Audio
  SFX, MusicPlayer, JinglePlayer, MUSIC_TRACKS, playTone,
  // Zone system — logique pure (zoneSystem.js)
  // makePokemon, getPokemonPower, levelUpPokemon, calculateStats, tryAutoEvolution
  //   → set by modules/systems/pokemon.js (stubs in app.js must NOT overwrite)
  initZone, spawnInZone, makeTrainerTeam, makeRaidSpawn,
  getZoneAgentSlots,
  getCombatRepGain, resolveCombat, resolveTrainerCombat, getTrainerCombatPreview, applyCombatResult,
  addBattleLogEntry, pushFeedEvent, rollChestLoot,
  triggerGymRaid, investInZone,
  tryCapture, showCaptureBurst,
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
  checkMoneyMilestone, showRarePopup, showShinyPopup, checkPlayerStatPoints,
  pokeSpriteBack,
  // Data constants
  POKEMON_GEN1, SPECIES_BY_EN, EVO_BY_SPECIES, POT_UPGRADE_COSTS,
  ZONES, ZONE_BY_ID, getBaseSpecies,
  GYM_ORDER, JOHTO_GYM_ORDER, HOENN_GYM_ORDER, SINNOH_GYM_ORDER,
  MISSIONS, HOURLY_QUEST_POOL, HOURLY_QUEST_REROLL_COST,
  BASE_PRICE, POTENTIAL_MULT, NATURES, NATURE_KEYS, BALLS, MYSTERY_EGG_POOL,
  MAX_COMBAT_REWARD, BALL_SPRITES, FALLBACK_TRAINER_SVG,
  AGENT_NAMES_M, AGENT_NAMES_F, AGENT_SPRITES, AGENT_PERSONALITIES,
  TITLE_REQUIREMENTS, TITLE_BONUSES, AGENT_RANK_LABELS, RANK_CHAIN,
  // sessionObjectives module
  isZoneUnlocked,
  BOOST_DURATIONS, ITEM_SPRITE_URLS,
  // trainingRoom module
  // tryAutoEvolution → set by modules/systems/pokemon.js
  pokeSprite,
  // pension module
  renderBagTab,
  showConfirm, showInfoModal, renderPCTab, switchTab, showContextMenu,
  openPlayerStatModal, resetPcRenderCache,
  getMaxPensionSlots, getPensionSlotIds,
  eggSprite, eggImgTag, EGG_SPRITES,
  renderLabTabInEl, getDexDesc,
  // zoneSelector module — zone helpers + data it reads from globalThis
  isZoneDegraded, getZoneMastery, getZoneDifficulty,
  ZONE_BGS, SHOP_ITEMS,
  // Zone UI helpers — called by agent.js background ticks
  refreshZoneIncomeTile: _refreshZoneIncomeTile,
  updateZoneButtons: _updateZoneButtons,
  // gangBase module — helpers needed by modules/ui/gangBase.js
  // openTeamPicker, openAssignToPicker, openRareCandyPicker — set by modules/ui/pickers.js
  pokemonDisplayName, sanitizeSpriteName, escapeHtml,
  getDexKantoCaught, getDexJohtoCaught, getDexNationalCaught, getShinySpeciesCount,
  // getBossFullTitle, getTitleLabel → set by modules/systems/titles.js
  KANTO_DEX_SIZE, JOHTO_DEX_SIZE, NATIONAL_DEX_SIZE, COSMETIC_BGS,
  // Fabric BG unlock helper
  // _unlockFabricBg, applyCosmetics, openNameModal, openSpritePicker
  //   → set by modules/ui/cosmetics.js (stubs must NOT overwrite)
  FABRIC_SPECIES, PATCH_PIDS, fabricBgUrl, fabricEmbUrl, patchUrl,
  // gangTab module
  // openTitleModal → set by modules/systems/titles.js
  MusicPlayer, MUSIC_TRACKS, GAME_VERSION,
  pokeIcon, openBossEditModal, openShowcasePicker,
  openTeamPickerModal, showEvoPreviewModal,
  // hubModals module — needs these from app.js scope
  BOSS_SPRITES, SAVE_KEYS, MAX_HISTORY,
  formatPlaytime, getTotalBalls, getSlotPreview,
  setActiveSaveSlotValue,
  showIntro,
  // Core infrastructure
  Scheduler, EventBus, EVENTS,
  get _store() { return _store; }, // debug access (also set in _createStoreInstance)
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

// ── Chargement async des credentials Supabase ────────────────────────────────
// Source principale : Nitro shared (/shared/config.js) — CORS autorisé depuis
// pokegang.sterenna.fr. Plus besoin de déployer un config.js local.
// Fallback : ./config.js local (utile en dev offline ou si Nitro est down).
//
// initSupabase() est appelé une fois dans boot() ET re-déclenché depuis l'IIFE
// quand les credentials arrivent (idempotent) — gère le race condition
// async config vs boot synchrone.
let _localSupabaseConfig = { url: '', anonKey: '' };
(async () => {
  let loaded = false;

  // 1. Tenter Nitro shared en premier
  try {
    const { getNitroSupabaseConfig } = await import('./modules/nitro/nitro-supabase.js');
    const nitroCfg = await getNitroSupabaseConfig();
    if (nitroCfg?.url && nitroCfg?.anonKey) {
      _localSupabaseConfig = nitroCfg;
      console.info('[PokéGang] Supabase credentials source : Nitro shared');
      loaded = true;
    }
  } catch (e) {
    console.warn('[PokéGang] Nitro shared config import failed:', e.message);
  }

  // 2. Fallback : config.js local (gitignored, dev only)
  if (!loaded) {
    try {
      const cfg = await import('./config.js');
      _localSupabaseConfig = {
        url:     cfg.SUPABASE_URL ?? cfg.default?.SUPABASE_URL ?? '',
        anonKey: cfg.SUPABASE_ANON_KEY ?? cfg.SUPABASE_PUBLISHABLE_KEY ?? cfg.default?.SUPABASE_ANON_KEY ?? '',
      };
      if (_localSupabaseConfig.url && _localSupabaseConfig.anonKey) {
        console.info('[PokéGang] Supabase credentials source : local config.js (fallback)');
        loaded = true;
      }
    } catch {
      // Pas de config.js → silencieux, on continue sans cloud
    }
  }

  if (loaded) {
    // Si boot() a déjà appelé initSupabase() avant que la config arrive,
    // _supabase est encore null. Relancer (idempotent).
    try { initSupabase(); } catch (e) { console.warn('[PokéGang] late initSupabase failed:', e.message); }
  } else {
    console.info('[PokéGang] No Supabase credentials — cloud features disabled');
  }
})();

configureCloudAccount({
  getState: () => state,
  getActiveTab: () => activeTab,
  getActiveSaveSlot: () => activeSaveSlot,
  getSupabaseConfig: () => ({
    url:     _localSupabaseConfig.url,
    anonKey: _localSupabaseConfig.anonKey,
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

  // Initialiser le store (Chantier 2)
  _createStoreInstance();

  // Try to load saved state via store
  const loaded = _store.load();   // migre + persiste dans _store.state
  if (loaded) {
    state = _store.getState();    // récupère la référence (même objet)
    globalThis.state = state;
    invalidateLookupMaps();
    _stateDirty = false;          // vient d'être chargé — pas dirty
  }

  // Fallback legacy si le store n'a rien trouvé (compatibilité)
  // loadState() reste disponible mais n'est plus appelé au boot normal
  // (gardé pour les outils de debug et les tests)

  state.sessionStart = Date.now();
  _sessionStatsBase = globalThis._gangSessionStatsBase = { ...state.stats };

  // ── Banner de migration si save convertie ────────────────────────────────
  const migRes = _store.getMigrationResult();
  if (migRes) {
    setTimeout(() => showMigrationBanner(migRes), 1200);
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
  const savedScale = state.settings?.uiScale ?? DEFAULT_UI_SCALE;
  document.documentElement.style.setProperty('--ui-scale', (savedScale / 100).toFixed(2));
  document.documentElement.style.setProperty('--zone-scale', ((state.settings?.zoneScale ?? DEFAULT_ZONE_SCALE) / 100).toFixed(2));
  document.body.classList.toggle('theme-light', state.settings?.lightTheme === true);
  document.body.classList.toggle('low-spec',    state.settings?.lowSpec === true);
  // Apply saved music volume
  MusicPlayer.setVolume((state.settings?.musicVol ?? DEFAULT_MUSIC_VOL) / 1000);

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

  // Réactiver les régions si déjà débloquées (save existante)
  if (state.purchases?.johtoUnlocked)  activateJohtoRegion();
  if (state.purchases?.hoennUnlocked)  activateHoennRegion();
  if (state.purchases?.sinnohUnlocked) activateSinnohRegion();

  // Configure intro module
  configureIntro({
    getState: () => state,
    makePokemon,
    calculateStats,
    pokeSprite,
    trainerSprite,
    BOSS_SPRITES,
    setActiveSaveSlot: slotIdx => setActiveSaveSlotValue(slotIdx, { persist: true }),
    saveState,
    notify,
  });

  // Start game loop
  startGameLoop();

  // ── EventBus bridges ─────────────────────────────────────────
  // Modules can emit these events instead of calling globalThis.fn()
  // directly. Both pathways work during the progressive migration.
  EventBus.on(EVENTS.UI_NOTIFY,        ({ msg, type = '' } = {}) => notify(msg, type));
  EventBus.on(EVENTS.UI_TOPBAR_UPDATE, ()                        => updateTopBar());
  EventBus.on(EVENTS.STATE_DIRTY,      ()                        => markDirty());

  // Check if region unlock offers should be presented at this session
  if (!state.purchases?.johtoUnlocked) {
    setTimeout(() => checkJohtoUnlock(), JOHTO_UNLOCK_DELAY_MS);
  }
  if (!state.purchases?.hoennUnlocked) {
    setTimeout(() => checkHoennUnlock(), JOHTO_UNLOCK_DELAY_MS + 500);
  }
  if (!state.purchases?.sinnohUnlocked) {
    setTimeout(() => checkSinnohUnlock(), JOHTO_UNLOCK_DELAY_MS + 1000);
  }

  // Catch-up starter gift: existing players who never saw the Giovanni intro
  if (state.gang?.initialized && !state.gang?.introSeen) {
    setTimeout(() => {
      openStarterGiftPopup({ onComplete: () => renderAll() });
    }, 800);
  }

  // Darkrai Nightmare cutscene — existing players with a save (≥ 3 pokémon)
  if (state.gang?.initialized && !state.gang?.darkraiCutsceneSeen) {
    // Delay slightly so any other boot popups (starter gift, johto) register first
    setTimeout(() => checkDarkraiCutscene(), 1600);
  }
}

window.addEventListener('DOMContentLoaded', boot);
