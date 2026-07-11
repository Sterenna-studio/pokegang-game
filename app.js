// ============================================================
// POKEFORGE v6 — Gang Wars  (vanilla JS, single-file engine)
// ============================================================

'use strict';

import { Scheduler } from './modules/core/tickManager.js';
import { EventBus, EVENTS } from './modules/core/eventBus.js';
import {
  checkDailyReloadTick,
  checkVersionOnBoot,
  configureUpdateManager,
  pollRemoteVersion,
} from './modules/core/updateManager.js';
import './modules/core/utils.js';
import './modules/core/sprites.js';
import { getDifficultyTier as _getDifficultyTier } from './modules/systems/difficultyTier.js';
import { marketEventsTick } from './modules/systems/marketEvents.js';
import { blackMarketTick } from './modules/systems/blackMarket.js';
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
import {
  checkHourlyQuestResetTick,
  refreshMissionsUiTick,
} from './modules/systems/missions.js';
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
  leaderboardSyncTick,
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
  configureModals,
  openHubImportModal as openHubImportModalImpl,
  openImportPreviewModal as openImportPreviewModalImpl,
  openLegacyImportModal as openLegacyImportModalImpl,
  showConfirm as showConfirmImpl,
  showInfoModal as showInfoModalImpl,
  showMigrationBanner as showMigrationBannerImpl,
  showShinyPopup,
  showRarePopup,
} from './modules/ui/modals.js';
import {
  configureTabRouter,
  getTabHint as getTabHintImpl,
  hintLink as hintLinkImpl,
  renderActiveTab as renderActiveTabImpl,
  renderHint as renderHintImpl,
  showFirstVisitHint as showFirstVisitHintImpl,
  switchTab,
  updateTopBar,
  renderAll,
  initKeyboardShortcuts,
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
import { renderLabTab, renderLabTabInEl } from './modules/ui/labTab.js';
import { renderMarketTab } from './modules/ui/marketTab.js';
import { renderMissionsTab } from './modules/ui/missionsTab.js';
import {
  configureSettingsModal,
  initSettings,
  openSettingsModal,
} from './modules/ui/settingsModal.js';
import './modules/ui/notifPanel.js';
import {
  configureZoneWindowTicks,
  refreshZoneWindowsTick,
} from './modules/ui/zoneWindows.js';
import './modules/ui/gangBase.js';
import './modules/ui/gangTab.js';
import './modules/systems/johto.js';
import './modules/systems/hoenn.js';
import './modules/systems/sinnoh.js';
import './modules/ui/pickers.js';
import { configureIntro, openGiovanniIntro, openStarterGiftPopup, showIntro } from './modules/ui/intro.js';
import { checkDarkraiCutscene, triggerDarkraiOnLeagueVictory } from './modules/ui/darkraiEvent.js';
import './modules/ui/hoennEvent.js';
import './modules/ui/johtoEvent.js';
import {
  checkPeriodicRegionUnlocksTick,
  configureRegionUnlockChecks,
} from './modules/systems/regionUnlocks.js';
import { checkDeoxysMissionUnlock } from './modules/systems/deoxysMission.js';
import { checkLegendaryMissionsUnlock } from './modules/systems/legendaryMissions.js';
import { checkJohtoMissionsUnlock } from './modules/systems/johtoMissions.js';
import { checkKantoMissionsUnlock } from './modules/systems/kantoMissions.js';
import { checkSinnohMissionsUnlock } from './modules/systems/sinnohMissions.js';
import {
  configurePassiveProgression,
  grantPassiveTeamXpTick,
} from './modules/systems/pokemon.js';
import './modules/systems/titles.js';
import './modules/ui/cosmetics.js';
import './modules/ui/hubModals.js';
import {
  renderZoneSelector    as _zsRenderSelector,
  refreshZoneTile       as _zsRefreshTile,
  refreshZoneIncomeTile as _zsRefreshIncome,
  refreshAllFogTiles,
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
import { NATURES, NATURE_KEYS, BOSS_SPRITES, AGENT_NAMES_M, AGENT_NAMES_F, AGENT_SPRITES, AGENT_PERSONALITIES, TITLE_REQUIREMENTS, TITLE_BONUSES, AGENT_RANK_LABELS, RANK_CHAIN, KANTO_DEX_MIN, KANTO_DEX_MAX, JOHTO_DEX_MIN, JOHTO_DEX_MAX, CHROMA_CHARM_COST } from './data/game-config-data.js';
import { I18N } from './data/i18n-data.js';
import { ZONE_BG_URL, GYM_ORDER, JOHTO_GYM_ORDER, HOENN_GYM_ORDER, SINNOH_GYM_ORDER } from './data/zones-config-data.js';
import { HOURLY_QUEST_REROLL_COST, BOOST_DURATIONS, BALL_ASSIST_MIN_BALLS, BALL_ASSIST_DURATION_MS, PASSIVE_XP_PER_TICK, MAX_LOG_ENTRIES, DEFAULT_MUSIC_VOL, DEFAULT_UI_SCALE, DEFAULT_ZONE_SCALE, TICK_AGENT_MS, TICK_PASSIVE_AGENT_MS, TICK_MISSIONS_UI_MS, TICK_HOURLY_CHECK_MS, TICK_MARKET_DECAY_MS, TICK_VERSION_POLL_MS, TICK_VERSION_FIRST_MS, TICK_AUTO_SAVE_MS, TICK_CLOUD_SAVE_MS, TICK_SNAPSHOT_MS, TICK_LEADERBOARD_MS, TICK_TRAINING_MS, TICK_PENSION_MS, TICK_PASSIVE_XP_MS, TICK_ZONE_REFRESH_MS, TICK_DAILY_CHECK_MS, UPDATE_COUNTDOWN_S, DAILY_COUNTDOWN_S, JOHTO_UNLOCK_DELAY_MS } from './data/gameplay-config-data.js';
import { SPECIAL_TRAINER_KEYS, MAX_COMBAT_REWARD } from './data/combat-config-data.js';
import { FALLBACK_TRAINER_SVG, BALL_SPRITES, ITEM_SPRITE_URLS, CHEST_SPRITE_URL, LOGO_URL, LOGO_SMALL_URL, EGG_SPRITES } from './data/assets-data.js';
import { TRANSLATOR_PHRASES_FR } from './data/flavor-data.js';
import {
  APP_VERSION,
  GAME_VERSION,
  SAVE_SCHEMA_VERSION,
  SAVE_KEYS,
  createDefaultState,
} from './state/defaultState.js';
import { slimPokemon, MAX_HISTORY } from './state/serialization.js';
import { createRuntimeStore } from './state/runtimeStore.js';
import {
  pokemonById,
  agentById,
  invalidateLookupMaps,
  exportSave,
  importSave,
} from './state/store.js';

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

const runtimeStore = createRuntimeStore({
  localStorageRef: localStorage,
  initialState: createDefaultState(),
  notify: (msg, type) => notify(msg, type),
  speciesByEn: SPECIES_BY_EN,
  uid,
  now: () => Date.now(),
});
let state = runtimeStore.getState();

function _syncStateRef() {
  state = runtimeStore.getState();
  return state;
}

function getActiveSaveSlot() {
  return runtimeStore.getActiveSaveSlot();
}

function getSaveKey() {
  return runtimeStore.getSaveKey();
}

function setActiveSaveSlotValue(idx, opts = {}) {
  return runtimeStore.setActiveSaveSlotValue(idx, opts);
}

function _createStoreInstance() {
  return runtimeStore.createStoreInstance();
}

function setState(nextState) {
  runtimeStore.setState(nextState);
  return _syncStateRef();
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
  const saved = runtimeStore.autoSave();
  _syncStateRef();
  return saved;
}

function saveState() {
  const saved = runtimeStore.saveState();
  _syncStateRef();
  return saved;
}


function formatPlaytime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}

// ── migrate() — délègue à state/migrateSave.js ───────────────────────────────
function migrate(saved) {
  return runtimeStore.migrate(saved);
}

// ── loadState/exportSave/importSave (extracted → state/store.js) ────────────

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

// ── Lookup Maps pokemonById/agentById/invalidateLookupMaps
//    (extracted → state/store.js) ───────────────────────────────────────────

function markDirty() {
  runtimeStore.markDirty();
}

// ── RNG & utilitaires (extracted → modules/core/utils.js) ───────────────────
function pick(...a)         { return globalThis.pick?.(...a); }
function weightedPick(...a) { return globalThis.weightedPick?.(...a); }
function randInt(...a)      { return globalThis.randInt?.(...a); }
function uid(...a)          { return globalThis.uid?.(...a); }
function clamp(...a)        { return globalThis.clamp?.(...a); }

// ── Pension helpers ──────────────────────────────────────────────
/** Max pension slots (2 base + purchased extras). */
function getMaxPensionSlots() { return 2 + (state.pension?.extraSlotsPurchased || 0); }
/** Set of pokemon IDs currently in pension. */
function getPensionSlotIds() { return new Set(state.pension?.slots || []); }

function addLog(msg) {
  state.log.unshift({ msg, ts: Date.now() });
  if (state.log.length > MAX_LOG_ENTRIES) state.log.length = MAX_LOG_ENTRIES;
}

function escapeHtml(...a) { return globalThis.escapeHtml?.(...a); }

// ── Sprites & assets (extracted → modules/core/sprites.js) ──────────────────
function sanitizeSpriteName(...a) { return globalThis.sanitizeSpriteName?.(...a); }
function pokeSpriteVariant(...a)  { return globalThis.pokeSpriteVariant?.(...a); }
function pokeSprite(...a)         { return globalThis.pokeSprite?.(...a); }
function pokeIcon(...a)           { return globalThis.pokeIcon?.(...a); }
function eggSprite(...a)          { return globalThis.eggSprite?.(...a); }
function eggImgTag(...a)          { return globalThis.eggImgTag?.(...a); }
function pokeSpriteBack(...a)     { return globalThis.pokeSpriteBack?.(...a); }
function _buildTrainerIndex(...a) { return globalThis._buildTrainerIndex?.(...a); }
function trainerSprite(...a)      { return globalThis.trainerSprite?.(...a); }
function safeTrainerImg(...a)     { return globalThis.safeTrainerImg?.(...a); }
function safePokeImg(...a)        { return globalThis.safePokeImg?.(...a); }
function speciesName(...a)        { return globalThis.speciesName?.(...a); }
function pokemonDisplayName(...a) { return globalThis.pokemonDisplayName?.(...a); }

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

// ── Popups & confirmations (extracted → modules/ui/modals.js) ───────────────

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
Object.assign(globalThis, { addMoney, addReputation, _getDifficultyTier });

function notify(msg, type = '', category = null) {
  if (type === 'gold') SFX.play('notify');
  // Routed to notification panel (replaces old #notifications toast system)
  // category explicite (ex: 'capture'/'combat') sinon dérivée du type, sinon 'system'
  globalThis._npanel_push?.({ category: category || type || 'system', title: msg, type });
}

// Milestone : CHROMA_CHARM_COST₽ → Charme Chroma
function checkMoneyMilestone() {
  if (state?.purchases?.chromaCharm) return;
  if (state.gang.money >= CHROMA_CHARM_COST) {
    addMoney(-CHROMA_CHARM_COST);
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
    return;
  }

  // 2. Sinon legacy _CHEAT_CODES
  const key = btoa(raw);
  if (_usedCodes.has(key)) { notify('❌ Code déjà utilisé cette session', 'error'); return; }
  const code = _CHEAT_CODES[key];
  if (!code) { notify('❌ Code invalide', 'error'); SFX.play('error'); return; }
  _usedCodes.add(key);
  if (code.money) {
    addMoney(code.money);
    updateTopBar();
    notify(`💰 +${code.money.toLocaleString()}₽ !`, 'gold');
    SFX.play('unlock');
  }
  if (code.title) {
    state.purchases[`title_${code.title}`] = true;
    notify(`🏆 Titre obtenu : ${code.title}`, 'gold');
  }
  saveState();
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

Object.assign(globalThis, { checkBallAssist });

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

// ── switchTab / updateTopBar / renderAll / initKeyboardShortcuts
//    (extracted → modules/ui/tabRouter.js) ───────────────────────────────────

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

// ── Pickers restants (extracted → modules/ui/pickers.js) ────────────────────
function openShowcasePicker(...a)  { return globalThis.openShowcasePicker?.(...a); }
function showEvoPreviewModal(...a) { return globalThis.showEvoPreviewModal?.(...a); }
function openTeamPickerModal(...a) { return globalThis.openTeamPickerModal?.(...a); }
function openBossEditModal(...a)   { return globalThis.openBossEditModal?.(...a); }

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

// ── Gang Park Window (extracted → modules/ui/gangBase.js) ───────────────────
function toggleGangParkWindow() { return globalThis._gbase_toggleGangParkWindow(); }
function renderGangParkWindow(el) { return globalThis._gbase_renderGangParkWindow(el); }

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
function openEventBattlePopup(zoneId)                              { return globalThis._zwin_openEventBattlePopup(zoneId); }
function executeEventBattle()                                      { return globalThis._zwin_executeEventBattle(); }
function closeEventBattle()                                        { return globalThis._zwin_closeEventBattle(); }
function renderEventTrainerInWindow(zoneId)                        { return globalThis._zwin_renderEventTrainerInWindow(zoneId); }
function _refreshRaidBtn(zoneId)                                   { return globalThis._zwin_refreshRaidBtn(zoneId); }


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

// ── showIntro() (extracted → modules/ui/intro.js) ───────────────────────────

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
let _gameLoopStarted  = false; // guard against double-start

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
  Scheduler.register('tickHourlyCheck', checkHourlyQuestResetTick, TICK_HOURLY_CHECK_MS, { skipWhenHidden: true  });
  Scheduler.register('tickMissionsUI',  refreshMissionsUiTick,     TICK_MISSIONS_UI_MS,  { skipWhenHidden: true  });
  // 'zoneEvents' désactivé — système d'événements de zone V2 neutralisé
  // (cf. ZONE_EVENTS_ENABLED dans modules/systems/zoneLevels.js)
  Scheduler.register('trainingRoom',    trainingRoomTick,   TICK_TRAINING_MS,     { skipWhenHidden: true  });
  Scheduler.register('pensionTick',     pensionTick,        TICK_PENSION_MS,      { skipWhenHidden: true  });
  Scheduler.register('passiveXP',       grantPassiveTeamXpTick, TICK_PASSIVE_XP_MS,   { skipWhenHidden: true  });
  Scheduler.register('zoneRefresh',     refreshZoneWindowsTick, TICK_ZONE_REFRESH_MS, { skipWhenHidden: true  });
  Scheduler.register('marketDecay',     decayMarketSales,   TICK_MARKET_DECAY_MS, { skipWhenHidden: true  });
  // Events marché (boosts/maluses temporaires sur prix de vente) — 30 min
  Scheduler.register('regionUnlockCheck', checkPeriodicRegionUnlocksTick, 5 * 60 * 1000, { skipWhenHidden: true });
  Scheduler.register('marketEvents',    marketEventsTick,   30 * 60 * 1000,       { skipWhenHidden: false });
  // Bulletin du marché noir (4 demandes pour 2h) — vérification toutes les 15 min
  Scheduler.register('blackMarket',     blackMarketTick,    15 * 60 * 1000,       { skipWhenHidden: false });

  // Persistance — tourne même en arrière-plan
  Scheduler.register('autoSave',        _autoSave,          TICK_AUTO_SAVE_MS,    { skipWhenHidden: false });
  Scheduler.register('cloudSave',       supaCloudSave,      TICK_CLOUD_SAVE_MS,   { skipWhenHidden: false });
  Scheduler.register('snapshot',        supaWriteSnapshot,  TICK_SNAPSHOT_MS,     { skipWhenHidden: false });
  Scheduler.register('leaderboard',     leaderboardSyncTick, TICK_LEADERBOARD_MS,  { skipWhenHidden: false });
  Scheduler.register('versionPoll',     pollRemoteVersion,  TICK_VERSION_POLL_MS, { skipWhenHidden: false });
  Scheduler.register('dailyReload',     checkDailyReloadTick, TICK_DAILY_CHECK_MS, { skipWhenHidden: false });

  // Premier poll de version peu après le boot (setTimeout conservé)
  setTimeout(pollRemoteVersion, TICK_VERSION_FIRST_MS);

  // Lance le master clock (un seul setInterval à 1 s pour tout)
  Scheduler.start();

}

// ════════════════════════════════════════════════════════════════

function showMigrationBanner(opts) {
  return showMigrationBannerImpl(opts);
}

configureUpdateManager({
  appVersion: APP_VERSION,
  scheduler: Scheduler,
  saveState,
  switchTab,
  versionPollInterval: TICK_VERSION_POLL_MS,
  versionFirstDelay: TICK_VERSION_FIRST_MS,
  dailyCheckInterval: TICK_DAILY_CHECK_MS,
  updateCountdownSeconds: UPDATE_COUNTDOWN_S,
  dailyCountdownSeconds: DAILY_COUNTDOWN_S,
  localStorageRef: localStorage,
  documentRef: document,
  locationRef: location,
  fetchRef: fetch,
  setTimeoutRef: setTimeout,
  setIntervalRef: setInterval,
  clearIntervalRef: clearInterval,
  now: () => Date.now(),
});

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
  getActiveSaveSlot,
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
  getOpenZones: () => openZones,
  renderZonesTab,
});

configureTabRouter({
  getState: () => state,
  getActiveTab: () => activeTab,
  getOpenZones: () => openZones,
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
  t, addLog, playSE,
  getMysteryEggCost,
  // pick, weightedPick, randInt, uid, clamp, escapeHtml → set by modules/core/utils.js
  // speciesName, pokemonDisplayName, sanitizeSpriteName, pokeSprite, pokeSpriteVariant,
  // pokeSpriteBack, pokeIcon, eggSprite, eggImgTag, trainerSprite, safeTrainerImg, safePokeImg,
  // _buildTrainerIndex → set by modules/core/sprites.js (stubs in app.js must NOT overwrite)
  // UI / state helpers
  notify, saveState, setState, migrate, slimPokemon,
  // switchTab, updateTopBar, renderAll, initKeyboardShortcuts sont importés
  // directement (pas de délégateur local) depuis modules/ui/tabRouter.js —
  // les réexporter ici est sûr (même référence, pas de risque de récursion).
  switchTab, updateTopBar, renderAll,
  tryAutoIncubate,
  renderMarketTab, renderMissionsTab, renderBattleLogTab, renderLabTab,
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
  activateEvent, isBallAssistActive, getTeamPower,
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
  // pension module
  showConfirm, showInfoModal, renderPCTab, showContextMenu,
  openPlayerStatModal, resetPcRenderCache,
  getMaxPensionSlots, getPensionSlotIds,
  EGG_SPRITES,
  renderLabTabInEl, getDexDesc,
  // zoneSelector module — zone helpers + data it reads from globalThis
  isZoneDegraded, getZoneMastery, getZoneDifficulty,
  ZONE_BGS, SHOP_ITEMS,
  renderZoneSelector, refreshZoneTile: _zsRefreshTile,
  // Zone UI helpers — called by agent.js background ticks
  refreshZoneIncomeTile: _refreshZoneIncomeTile,
  updateZoneButtons: _updateZoneButtons,
  // gangBase module — helpers needed by modules/ui/gangBase.js
  // openTeamPicker, openAssignToPicker — set by modules/ui/pickers.js
  getDexKantoCaught, getDexJohtoCaught, getDexNationalCaught, getShinySpeciesCount,
  // getBossFullTitle, getTitleLabel → set by modules/systems/titles.js
  KANTO_DEX_SIZE, JOHTO_DEX_SIZE, NATIONAL_DEX_SIZE, COSMETIC_BGS,
  // Fabric BG unlock helper
  // _unlockFabricBg, applyCosmetics, openNameModal, openSpritePicker
  //   → set by modules/ui/cosmetics.js (stubs must NOT overwrite)
  FABRIC_SPECIES, PATCH_PIDS, fabricBgUrl, fabricEmbUrl, patchUrl,
  // gangTab module
  // openTitleModal → set by modules/systems/titles.js
  // openBossEditModal, openShowcasePicker, openTeamPickerModal, showEvoPreviewModal
  //   → set by modules/ui/pickers.js (stubs must NOT overwrite)
  MusicPlayer, MUSIC_TRACKS, GAME_VERSION,
  // hubModals module — needs these from app.js scope
  BOSS_SPRITES, SAVE_KEYS, MAX_HISTORY,
  formatPlaytime, getTotalBalls, getSlotPreview,
  setActiveSaveSlotValue,
  showIntro,
  // Core infrastructure
  Scheduler, EventBus, EVENTS,
  get _store() { return runtimeStore.getStore(); }, // debug access (also set in runtimeStore)
});

configureSecretCodes({
  getState: () => state,
  notify,
  saveState,
  getTitles: () => TITLES,
  getActiveTab: () => activeTab,
  renderGangTab,
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
  getActiveSaveSlot,
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
  getActiveSaveSlot,
  markPlayerActivity: () => runtimeStore.markPlayerActivity(),
  consumePlayerActivityForLeaderboard: () => runtimeStore.consumePlayerActivity(),
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

configurePassiveProgression({
  getState: () => state,
  pokemonById,
  saveState,
  xpPerTick: PASSIVE_XP_PER_TICK,
});

configureZoneWindowTicks({
  getOpenZones: () => openZones,
  getActiveTab: () => activeTab,
  refreshAllFogTiles,
});

configureRegionUnlockChecks({
  getState: () => state,
  checkHoennUnlock,
  checkSinnohUnlock,
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
  getSaveKey,
  getOpenZones: () => openZones,
  closeZoneWindow,
  showIntro,
  tryCheatCode,
  detectLLM: (...args) => globalThis.detectLLM?.(...args),
  renderAll,
  resetTransientSelections: resetPcSelection,
});

// ── Intercepteur global des rejets non gérés GoTrue ──────────────────
// ── Error boundary global ─────────────────────────────────────────────────────
// Attrape les erreurs JS non gérées et les promet rejetées pour :
//   1. Afficher une notification discrète au joueur (sans crash silencieux)
//   2. Logger le contexte utile pour le debug
//   3. Absorber le bruit GoTrue (locks Supabase)

window.onerror = function(msg, src, line, col, err) {
  const context = {
    tab:    globalThis.activeTab ?? '?',
    schema: globalThis.state?._schemaVersion ?? '?',
    rep:    globalThis.state?.gang?.reputation ?? '?',
  };
  console.error('[PokéGang] Erreur non gérée', { msg, src, line, col, err, context });
  // Notification discrète — n'utilise pas notify() car ça peut être cassé
  try {
    const el = document.getElementById('notification');
    if (el) {
      el.textContent = '⚠ Une erreur est survenue — la partie continue (F12 pour détails)';
      el.className = 'notification show error';
      setTimeout(() => el.classList.remove('show'), 6000);
    }
  } catch (_) {}
  return false; // ne supprime pas le log console natif
};

// GoTrue peut générer des "unhandledrejection" liés aux locks ou aux timeouts réseau.
window.addEventListener('unhandledrejection', e => {
  const msg = e.reason?.message || String(e.reason || '');
  if (
    msg.includes('Lock') && msg.includes('stole') ||
    msg.includes('lock:sb-') ||
    msg.includes('AuthRetryableFetchError') ||
    msg.includes('Supabase request timeout')
  ) {
    e.preventDefault(); // supprime le log "Uncaught (in promise)"
    return;
  }
  // Autres rejections non gérées — log avec contexte
  console.error('[PokéGang] Promise rejetée', {
    reason: e.reason,
    tab: globalThis.activeTab ?? '?',
  });
});

function boot() {
  // Version check — must run before anything else; may trigger reload
  if (checkVersionOnBoot()) return;

  // Initialiser le store (Chantier 2)
  _createStoreInstance();

  // Try to load saved state via store
  const loaded = runtimeStore.loadCurrentSlot();   // migre + persiste dans runtimeStore
  if (loaded) {
    _syncStateRef();              // récupère la référence (même objet)
  }

  // Fallback legacy si le store n'a rien trouvé (compatibilité)
  // loadState() reste disponible mais n'est plus appelé au boot normal
  // (gardé pour les outils de debug et les tests)

  state.sessionStart = Date.now();
  _sessionStatsBase = globalThis._gangSessionStatsBase = { ...state.stats };

  // ── Banner de migration si save convertie ────────────────────────────────
  const migRes = runtimeStore.getMigrationResult();
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

  // ── Réactiver les régions débloquées AVANT de restaurer les zones ────────
  // Sinon les zones Johto/Hoenn/Sinnoh ne sont pas encore enregistrées dans
  // ZONE_BY_ID et seraient écartées à tort comme « zones fantômes » par la
  // passe de nettoyage ci-dessous.
  if (state.purchases?.johtoUnlocked)  activateJohtoRegion();
  if (state.purchases?.hoennUnlocked)  activateHoennRegion();
  if (state.purchases?.sinnohUnlocked) activateSinnohRegion();

  // ── Restaurer les zones ouvertes de la session précédente ────────────────
  // Le joueur reprend exactement là où il s'était arrêté (plus de priorité aux
  // favoris). Une passe de nettoyage « cleaned » écarte les zones fantômes :
  //   • ID inconnu (absent de ZONE_BY_ID — zone supprimée/renommée)
  //   • zone de type gang_park (non jouable)
  //   • zone verrouillée (région reset, item d'unlock manquant…)
  //   • doublons
  // L'ordre d'origine est préservé et la liste nettoyée est réécrite dans
  // state.openZoneOrder pour éviter l'accumulation d'entrées fantômes.
  const _restoredOrder = [];
  for (const zId of (state.openZoneOrder || [])) {
    if (_restoredOrder.includes(zId))            continue; // doublon
    if (!ZONE_BY_ID[zId])                        continue; // zone fantôme (ID inconnu)
    if (ZONE_BY_ID[zId].type === 'gang_park')    continue; // non jouable
    if (!isZoneUnlocked(zId))                    continue; // verrouillée
    openZones.add(zId);
    initZone(zId);
    zoneSpawns[zId] = [];
    startActiveZone(zId); // timer unifié (mode visuel car zone ouverte)
    _restoredOrder.push(zId);
  }
  state.openZoneOrder = _restoredOrder; // liste nettoyée persistée

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

  // (Réactivation des régions déplacée plus haut — avant la restauration des
  //  zones — pour que ZONE_BY_ID soit peuplé au moment du nettoyage cleaned.)

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
    openSettingsModal,
    getSlotPreview,
    formatPlaytime,
    showConfirm,
    getSaveKeys: () => SAVE_KEYS,
    getActiveSaveSlot,
    renderAll,
    loadSlot,
    openHubSlotRepairModal,
    openHubImportModal,
  });

  // Start game loop
  startGameLoop();

  // ── EventBus bridges ─────────────────────────────────────────
  // Modules can emit these events instead of calling globalThis.fn()
  // directly. Both pathways work during the progressive migration.
  EventBus.on(EVENTS.UI_NOTIFY,        ({ msg, type = '', category = null } = {}) => notify(msg, type, category));
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

  // Legendary Missions (Groudon + Kyogre) — mid-Hoenn (rep 2500)
  if (state.purchases?.hoennUnlocked) {
    const gm = state.groudonMission;
    const km = state.kyogreMission;
    if (!gm?.active || !km?.active) {
      setTimeout(() => checkLegendaryMissionsUnlock(), JOHTO_UNLOCK_DELAY_MS + 1500);
    }
  }

  // Deoxys Mission — late-game quest (Hoenn unlocked + Ever Grande + rep 4000)
  if (state.purchases?.hoennUnlocked && !state.deoxysMission?.active) {
    setTimeout(() => checkDeoxysMissionUnlock(), JOHTO_UNLOCK_DELAY_MS + 2500);
  }

  // Johto Missions (Bêtes Sacrées + Lugia + Ho-Oh) — mid-Johto (rep 800+)
  if (state.purchases?.johtoUnlocked) {
    const bm = state.betesMission;
    const lm = state.lugiaMission;
    const hm = state.hoohMission;
    if (!bm?.active || !lm?.active || !hm?.active) {
      setTimeout(() => checkJohtoMissionsUnlock(), JOHTO_UNLOCK_DELAY_MS + 1200);
    }
  }

  // Kanto Missions (Oiseaux + Mewtwo) — available from rep 600/900
  {
    const birds = state.birdsMission;
    const mm    = state.mewtwoMission;
    const allBirdsActive = birds &&
      birds.articuno?.active && birds.zapdos?.active && birds.moltres?.active;
    if (!allBirdsActive || !mm?.active) {
      setTimeout(() => checkKantoMissionsUnlock(), JOHTO_UNLOCK_DELAY_MS + 800);
    }
  }

  // Sinnoh Missions (Trio du Lac + Galaxie + Giratina) — gated by sinnohUnlocked + rep
  if (state.purchases?.sinnohUnlocked) {
    const gx = state.galaxieMission;
    const lk = state.lakeMission;
    const allLakeActive = lk && lk.uxie?.active && lk.mesprit?.active && lk.azelf?.active;
    if (!gx?.active || !allLakeActive) {
      setTimeout(() => checkSinnohMissionsUnlock(), JOHTO_UNLOCK_DELAY_MS + 1600);
    }
  }
}

window.addEventListener('DOMContentLoaded', boot);
