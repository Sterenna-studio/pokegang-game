// ============================================================
// POKEFORGE v6 — Gang Wars  (vanilla JS, single-file engine)
// ============================================================

'use strict';

import {
  checkSecretCode,
  configureSecretCodes,
} from './modules/secretCodes.js';
import {
  saveState as _smSaveState,
  loadState as _smLoadState,
  migrate as _smMigrate,
  exportSave as _smExportSave,
  importSave as _smImportSave,
  slimPokemon,
  formatPlaytime,
  MAX_HISTORY,
} from './modules/stateManagement.js';
import {
  APP_VERSION,
  GAME_VERSION,
  SAVE_KEYS,
  LEGACY_SAVE_KEYS,
  SAVE_SCHEMA_VERSION,
  DEFAULT_STATE,
  createDefaultState,
} from './state/defaultState.js';
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
  renderCompteTab,
  renderLeaderboardTab,
  supaCloudSave,
  supaUpdateLeaderboardAnon,
  supaWriteSnapshot,
} from './modules/systems/cloudAccount.js';
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
  renderEventsTab,
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
import {
  configureSettingsModal,
  initSettings,
  openSettingsModal,
} from './modules/ui/settingsModal.js';
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

let activeSaveSlot = Math.min(2, parseInt(localStorage.getItem('pokeforge.activeSlot') || '0'));
let SAVE_KEY = SAVE_KEYS[activeSaveSlot];
function setActiveSaveSlotValue(value, { persist = false } = {}) {
  activeSaveSlot = Math.min(2, Math.max(0, Number(value) || 0));
  SAVE_KEY = SAVE_KEYS[activeSaveSlot];
  if (persist) localStorage.setItem('pokeforge.activeSlot', String(activeSaveSlot));
  return activeSaveSlot;
}
// Résultat de migration exposé au boot pour afficher le banner
let _migrationResult = null; // null | { from: string, fields: string[] }

let state = createDefaultState();
Object.defineProperty(globalThis, 'state', {
  get: () => state,
  set: nextState => { state = nextState; },
  configurable: true,
});

function setState(nextState) {
  state = nextState;
  return state;
}

function stateManagementContext() {
  return {
    DEFAULT_STATE,
    SAVE_SCHEMA_VERSION,
    LEGACY_SAVE_KEYS,
    SPECIES_BY_EN,
    localStorage,
    getState: () => state,
    setState,
    getSaveKey: () => SAVE_KEY,
    getActiveSaveSlot: () => activeSaveSlot,
    setMigrationResult: result => { _migrationResult = result; },
    setPlayerWasActive: value => { _playerWasActive = value; },
    notify,
    uid,
    openImportPreviewModal,
  };
}

function saveState() {
  return _smSaveState(stateManagementContext());
}

function loadState() {
  return _smLoadState(stateManagementContext());
}

function migrate(saved) {
  return _smMigrate(stateManagementContext(), saved);
}

function exportSave() {
  return _smExportSave(stateManagementContext());
}

function importSave(file) {
  return _smImportSave(stateManagementContext(), file);
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
          setState(migrate(raw));
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
    const fresh = createDefaultState();
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

    setState(migrate(fresh));
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
Object.defineProperty(globalThis, 'pcView', {
  get: () => pcView,
  set: value => { pcView = value; },
  configurable: true,
});
let _statsViewMode = 'session';   // 'session' | 'global'
let _sessionStatsBase = null;     // snapshot of state.stats at session start
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
    resetPcRenderCache();
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
Object.defineProperty(globalThis, 'activeTab', {
  get: () => activeTab,
  set: value => { activeTab = value; },
  configurable: true,
});
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
  tabGang:     { icon: '👑', title: 'Ton Gang', body: 'Ta base d\'opérations. Gère l\'équipe Boss (3 slots sauvegardables), place tes meilleurs Pokémon en vitrine, et débloque des upgrades spéciaux au Marché.' },
  tabAgents:   { icon: '👥', title: 'Les Agents', body: 'Assigne-leur une zone → ils capturent et combattent automatiquement, même zones fermées. Chaque agent a un comportement (tout / capture / combat) et une stat de chance qui augmente les potentiels.' },
  tabZones:    { icon: '🗺', title: 'Zones', body: 'Ouvre jusqu\'à 6 zones simultanément pour capturer des Pokémon et battre des dresseurs. Les zones fermées avec agent continuent de se jouer en arrière-plan. Ton Boss participe aux combats de toutes les zones ouvertes.' },
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

  // ── Stats (session vs global toggle) ──
  const _sb = _sessionStatsBase || {};
  const _isSession = _statsViewMode === 'session';
  const _sv = k => _isSession ? Math.max(0, (s[k] || 0) - (_sb[k] || 0)) : (s[k] || 0);
  const statsHtml = [
    [state.pokemons.length,                                        'Possédés'],
    [_sv('totalCaught'),                                           'Capturés'],
    [_sv('totalSold'),                                             'Vendus'],
    [_isSession ? _sv('shinyCaught') : getShinySpeciesCount(),     _isSession ? '✨ Chromas' : '✨ Espèces chroma'],
    [_isSession ? '' : s.shinyCaught,                              _isSession ? '' : '✨ Chromas (total)'],
    [`${_sv('totalFightsWon')}/${_sv('totalFights')}`,             'Combats'],
    [`${_sv('totalMoneyEarned').toLocaleString()}₽`,               'Gains'],
  ].filter(([val]) => val !== '').map(([val, label]) => `<div class="gang-stat-card"><div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>`).join('');

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

    <!-- ── Collapsible: SERVICES ── -->
    <div class="gang-section-label gang-collapsible-header" data-section="services" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
      <span>— SERVICES —</span>
      <span style="font-size:9px;color:var(--text-dim)">${_gangCollapsed.services ? '▶' : '▼'}</span>
    </div>
    <div class="gang-collapsible-body" data-section-body="services" style="${_gangCollapsed.services ? 'display:none' : ''}">
      <div style="padding:0 2px 8px;display:flex;flex-direction:column;gap:8px">

        ${/* ── Récolte automatique ──────────────────────────────── */(() => {
          const own = !!state.purchases.autoCollect;
          const en  = state.purchases.autoCollectEnabled !== false;
          return `<div style="background:var(--bg);border:1px solid ${own ? (en ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
            <div style="font-size:22px;flex-shrink:0;${own && !en ? 'opacity:.4;filter:grayscale(1)' : ''}">🪙</div>
            <div style="flex:1">
              <div style="font-family:var(--font-pixel);font-size:8px;color:${own ? (en ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">Récolte automatique</div>
              <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Collecte les revenus de zone sans animation. Combat calculé en arrière-plan.</div>
              ${own
                ? `<div style="display:flex;align-items:center;gap:8px">
                     <span style="font-family:var(--font-pixel);font-size:7px;color:${en ? 'var(--green)' : 'var(--text-dim)'}">${en ? '✓ ACTIVE' : '✗ INACTIVE'}</span>
                     <button id="btnToggleAutoCollect" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${en ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${en ? 'var(--red)' : 'var(--green)'};cursor:pointer">${en ? 'Désactiver' : 'Activer'}</button>
                   </div>`
                : `<button id="btnBuyAutoCollect" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Acheter — 100 000₽</button>`}
            </div>
          </div>`;
        })()}

        ${/* ── Vente automatique (captures agents) ─────────────── */(() => {
          const own = !!state.purchases.autoSellAgent;
          const en  = state.purchases.autoSellAgentEnabled !== false;
          return `<div style="background:var(--bg);border:1px solid ${own ? (en ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
            <div style="font-size:22px;flex-shrink:0;${own && !en ? 'opacity:.4;filter:grayscale(1)' : ''}">🤖</div>
            <div style="flex:1">
              <div style="font-family:var(--font-pixel);font-size:8px;color:${own ? (en ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">Vente automatique (captures agent)</div>
              <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Vend automatiquement les Pokémon capturés par les agents. Shinies toujours protégés.</div>
              ${own
                ? `<div style="display:flex;flex-direction:column;gap:6px">
                     <div style="display:flex;align-items:center;gap:8px">
                       <span style="font-family:var(--font-pixel);font-size:7px;color:${en ? 'var(--green)' : 'var(--text-dim)'}">${en ? '✓ ACTIVE' : '✗ INACTIVE'}</span>
                       <button id="btnToggleAutoSellAgent" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${en ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${en ? 'var(--red)' : 'var(--green)'};cursor:pointer">${en ? 'Désactiver' : 'Activer'}</button>
                     </div>
                     <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                       <label style="display:flex;align-items:center;gap:4px;font-size:8px;cursor:pointer"><input type="radio" name="autoSellMode" value="all" ${(state.settings.autoSellAgent?.mode || 'all') === 'all' ? 'checked' : ''}> Tout vendre</label>
                       <label style="display:flex;align-items:center;gap:4px;font-size:8px;cursor:pointer"><input type="radio" name="autoSellMode" value="by_potential" ${state.settings.autoSellAgent?.mode === 'by_potential' ? 'checked' : ''}> Par potentiel</label>
                     </div>
                     ${state.settings.autoSellAgent?.mode === 'by_potential' ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${[1,2,3,4,5].map(p => `<label style="display:flex;align-items:center;gap:3px;font-size:8px;cursor:pointer"><input type="checkbox" class="autoSellPot" value="${p}" ${(state.settings.autoSellAgent?.potentials || []).includes(p) ? 'checked' : ''}> ${'★'.repeat(p)}</label>`).join('')}</div>` : ''}
                   </div>`
                : `<button id="btnBuyAutoSellAgent" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Acheter — 10 000 000₽</button>`}
            </div>
          </div>`;
        })()}

        ${/* ── Infirmière Joëlle corrompue ─────────────────────── */(() => {
          const own = !!state.purchases.autoIncubator;
          const en  = state.purchases.autoIncubatorEnabled !== false;
          return `<div style="background:var(--bg);border:1px solid ${own ? (en ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
            <img src="${trainerSprite('nurse')}" style="width:36px;height:36px;image-rendering:pixelated;flex-shrink:0;${own && !en ? 'opacity:.4;filter:grayscale(1)' : ''}" onerror="this.style.display='none'">
            <div style="flex:1">
              <div style="font-family:var(--font-pixel);font-size:8px;color:${own ? (en ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">Infirmière Joëlle corrompue</div>
              <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Auto-incube les œufs dès qu'un incubateur est libre.</div>
              ${own
                ? `<div style="display:flex;align-items:center;gap:8px">
                     <span style="font-family:var(--font-pixel);font-size:7px;color:${en ? 'var(--green)' : 'var(--text-dim)'}">${en ? '✓ EN POSTE' : '✗ CONGÉ'}</span>
                     <button id="btnToggleNurse" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${en ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${en ? 'var(--red)' : 'var(--green)'};cursor:pointer">${en ? 'Mettre en congé' : 'Rappeler'}</button>
                   </div>`
                : `<button id="btnBuyNurse" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Embaucher — 300 000₽</button>`}
            </div>
          </div>`;
        })()}

        ${/* ── Scientifique peu scrupuleux ─────────────────────── */(() => {
          const own = !!state.purchases.scientist;
          const en  = state.purchases.scientistEnabled !== false;
          return `<div style="background:var(--bg);border:1px solid ${own ? (en ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
            <img src="${trainerSprite('scientist')}" style="width:36px;height:36px;image-rendering:pixelated;flex-shrink:0;${own && !en ? 'opacity:.4;filter:grayscale(1)' : ''}" onerror="this.style.display='none'">
            <div style="flex:1">
              <div style="font-family:var(--font-pixel);font-size:8px;color:${own ? (en ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">Scientifique peu scrupuleux</div>
              <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Révèle l'espèce des œufs (10k₽) · Mutation artificielle : sacrifice ★★★★★ même espèce pour potentiel max.</div>
              ${own
                ? `<div style="display:flex;align-items:center;gap:8px">
                     <span style="font-family:var(--font-pixel);font-size:7px;color:${en ? 'var(--green)' : 'var(--text-dim)'}">${en ? '✓ EN POSTE' : '✗ RENVOYÉ'}</span>
                     <button id="btnToggleScientist" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${en ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${en ? 'var(--red)' : 'var(--green)'};cursor:pointer">${en ? 'Renvoyer' : 'Rappeler'}</button>
                   </div>`
                : `<button id="btnBuyScientist" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Engager — 5 000 000₽</button>`}
            </div>
          </div>`;
        })()}

        ${/* ── 🛒 ACHATS SPÉCIAUX ──────────────────────────────── */(() => {
          const SPECIALS = [
            { id:'title_richissime',    icon:'💰', label:'Titre "Richissime"',       desc:'Débloque le titre légendaire. Ostentation maximale.',  cost:5_000_000,
              owned:() => !!state.purchases.title_richissime || (state.unlockedTitles||[]).includes('richissime') },
            { id:'title_doublerichissim', icon:'💎', label:'Titre "Double Richissime"', desc:'Débloque le titre ultime. Noblesse oblige.',           cost:10_000_000,
              owned:() => !!state.purchases.title_doublerichissim || (state.unlockedTitles||[]).includes('doublerichissim') },
            { id:'chromaCharm',         icon:'✨', label:'Charme Chroma',            desc:'Double le taux de Pokémon chromatiques. Permanent.',    cost:5_000_000,
              owned:() => !!state.purchases.chromaCharm },
          ];
          return `<div>
            <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin:4px 0 6px;letter-spacing:1px">🛒 ACHATS SPÉCIAUX</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${SPECIALS.map(sp => {
                const own = sp.owned();
                return `<div style="background:var(--bg);border:1px solid ${own ? 'var(--green)' : 'var(--border)'};border-radius:var(--radius-sm);padding:8px;display:flex;gap:10px;align-items:center">
                  <div style="font-size:20px;flex-shrink:0">${sp.icon}</div>
                  <div style="flex:1">
                    <div style="font-family:var(--font-pixel);font-size:8px;color:${own ? 'var(--green)' : 'var(--text)'};margin-bottom:2px">${sp.label}</div>
                    <div style="font-size:7px;color:var(--text-dim)">${sp.desc}</div>
                  </div>
                  ${own
                    ? `<div style="font-family:var(--font-pixel);font-size:7px;color:var(--green);white-space:nowrap">✓ ACTIF</div>`
                    : `<button class="btn-special-buy" data-sp-id="${sp.id}" style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;white-space:nowrap">${sp.cost.toLocaleString()}₽</button>`}
                </div>`;
              }).join('')}
            </div>
          </div>`;
        })()}

      </div>
    </div>

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
      <div style="display:flex;align-items:center;gap:8px">
        <button id="btnToggleStatsView" onclick="event.stopPropagation()" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:${_isSession ? 'var(--gold)' : 'var(--text-dim)'};cursor:pointer">${_isSession ? '⏱ SESSION' : '🌐 GLOBAL'}</button>
        <span style="font-size:9px;color:var(--text-dim)">${_gangCollapsed.stats ? '▶' : '▼'}</span>
      </div>
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

  // ── Stats view toggle (session ↔ global) ──
  tab.querySelector('#btnToggleStatsView')?.addEventListener('click', e => {
    e.stopPropagation();
    _statsViewMode = _statsViewMode === 'session' ? 'global' : 'session';
    renderGangTab();
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

  // ── Scientist service handlers ──
  tab.querySelector('#btnBuyScientist')?.addEventListener('click', () => {
    if (state.gang.money < 5_000_000) { notify('Fonds insuffisants.', 'error'); return; }
    showConfirm('Engager le Scientifique peu scrupuleux pour <b>5 000 000₽</b> ?<br><span style="font-size:10px;color:var(--text-dim)">Permet la mutation artificielle depuis le menu contextuel du PC et du Labo.</span>', () => {
      state.gang.money -= 5_000_000;
      state.purchases.scientist = true;
      state.purchases.scientistEnabled = true;
      saveState(); updateTopBar(); SFX.play('unlock');
      notify('🧬 Le scientifique est en poste !', 'gold');
      renderGangTab();
    }, null, { confirmLabel: 'Engager', cancelLabel: 'Annuler' });
  });
  tab.querySelector('#btnToggleScientist')?.addEventListener('click', () => {
    state.purchases.scientistEnabled = state.purchases.scientistEnabled === false;
    saveState();
    notify(state.purchases.scientistEnabled !== false ? '🧬 Scientifique rappelé !' : '🚫 Scientifique renvoyé.', 'success');
    renderGangTab();
  });

  // ── AutoCollect service handlers ──
  tab.querySelector('#btnBuyAutoCollect')?.addEventListener('click', () => {
    if (state.gang.money < 100_000) { notify('Fonds insuffisants.', 'error'); return; }
    showConfirm('Acheter la <b>Récolte automatique</b> pour <b>100 000₽</b> ?<br><span style="font-size:10px;color:var(--text-dim)">Collecte les revenus de zone sans animation.</span>', () => {
      state.gang.money -= 100_000;
      state.purchases.autoCollect = true;
      state.purchases.autoCollectEnabled = true;
      saveState(); updateTopBar(); SFX.play('unlock');
      notify('🪙 Récolte automatique activée !', 'gold');
      renderGangTab();
    }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
  });
  tab.querySelector('#btnToggleAutoCollect')?.addEventListener('click', () => {
    state.purchases.autoCollectEnabled = state.purchases.autoCollectEnabled === false;
    saveState();
    notify(state.purchases.autoCollectEnabled !== false ? '🪙 Récolte automatique activée !' : '🚫 Récolte automatique désactivée.', '');
    renderGangTab();
  });

  // ── AutoSellAgent service handlers ──
  tab.querySelector('#btnBuyAutoSellAgent')?.addEventListener('click', () => {
    if (state.gang.money < 10_000_000) { notify('Fonds insuffisants.', 'error'); return; }
    showConfirm('Acheter la <b>Vente automatique</b> pour <b>10 000 000₽</b> ?<br><span style="font-size:10px;color:var(--text-dim)">Vend automatiquement les captures des agents. Shinies toujours protégés.</span>', () => {
      state.gang.money -= 10_000_000;
      state.purchases.autoSellAgent = true;
      state.purchases.autoSellAgentEnabled = true;
      if (!state.settings.autoSellAgent) state.settings.autoSellAgent = { mode: 'all', potentials: [] };
      saveState(); updateTopBar(); SFX.play('unlock');
      notify('🤖 Vente automatique activée !', 'gold');
      renderGangTab();
    }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
  });
  tab.querySelector('#btnToggleAutoSellAgent')?.addEventListener('click', () => {
    state.purchases.autoSellAgentEnabled = state.purchases.autoSellAgentEnabled === false;
    saveState();
    notify(state.purchases.autoSellAgentEnabled !== false ? '🤖 Vente automatique activée !' : '🚫 Vente automatique désactivée.', '');
    renderGangTab();
  });

  // ── Nurse (autoIncubator) service handlers ──
  tab.querySelector('#btnBuyNurse')?.addEventListener('click', () => {
    if (state.gang.money < 300_000) { notify('Fonds insuffisants.', 'error'); return; }
    showConfirm('Embaucher l\'<b>Infirmière Joëlle</b> pour <b>300 000₽</b> ?<br><span style="font-size:10px;color:var(--text-dim)">Auto-incube les œufs dès qu\'un incubateur est libre.</span>', () => {
      state.gang.money -= 300_000;
      state.purchases.autoIncubator = true;
      state.purchases.autoIncubatorEnabled = true;
      saveState(); updateTopBar(); SFX.play('unlock');
      notify('💉 Joëlle est en poste !', 'gold');
      renderGangTab();
    }, null, { confirmLabel: 'Embaucher', cancelLabel: 'Annuler' });
  });
  tab.querySelector('#btnToggleNurse')?.addEventListener('click', () => {
    state.purchases.autoIncubatorEnabled = state.purchases.autoIncubatorEnabled === false;
    saveState();
    notify(state.purchases.autoIncubatorEnabled !== false ? '💉 Joëlle est de retour !' : '💤 Joëlle en congé.', '');
    renderGangTab();
  });

  // ── Special purchases handlers ──
  const SPECIAL_DEFS = {
    title_richissime:     { cost: 5_000_000,  label: 'Titre "Richissime"' },
    title_doublerichissim:{ cost: 10_000_000, label: 'Titre "Double Richissime"' },
    chromaCharm:          { cost: 5_000_000,  label: 'Charme Chroma' },
  };
  tab.querySelectorAll('.btn-special-buy').forEach(btn => {
    btn.addEventListener('click', () => {
      const spId = btn.dataset.spId;
      const def  = SPECIAL_DEFS[spId];
      if (!def) return;
      if (state.gang.money < def.cost) { notify('Fonds insuffisants.', 'error'); return; }
      showConfirm(`Acheter <b>${def.label}</b> pour <b>${def.cost.toLocaleString()}₽</b> ?`, () => {
        state.gang.money -= def.cost;
        state.purchases[spId] = true;
        if (spId === 'title_richissime') {
          if (!state.unlockedTitles) state.unlockedTitles = [];
          if (!state.unlockedTitles.includes('richissime')) state.unlockedTitles.push('richissime');
        } else if (spId === 'title_doublerichissim') {
          if (!state.unlockedTitles) state.unlockedTitles = [];
          if (!state.unlockedTitles.includes('doublerichissim')) state.unlockedTitles.push('doublerichissim');
        }
        saveState(); updateTopBar(); SFX.play('unlock');
        notify(`✨ ${def.label} débloqué !`, 'gold');
        renderGangTab();
      }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
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
// 17.  UI — PC / POKÉDEX
// ════════════════════════════════════════════════════════════════
// Extracted to modules/ui/pcPokedex.js.

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
          <div class="agent-title agent-rank-${a.title}" style="display:flex;align-items:baseline;gap:5px;flex-wrap:nowrap;overflow:hidden">
            <span style="font-size:7px;opacity:.75;flex-shrink:0">[${getAgentRankLabel(a)}]</span>
            <span style="font-family:var(--font-pixel);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.name}</span>
            <span style="font-size:8px;opacity:.7;flex-shrink:0">Lv.${a.level}</span>
          </div>
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
        ${(() => {
          const owned   = !!state.purchases.scientist;
          const enabled = state.purchases.scientistEnabled !== false;
          const color   = owned ? (enabled ? 'var(--green)' : 'var(--border)') : 'var(--border)';
          return `<div style="background:var(--bg-panel);border:1px solid ${color};border-radius:var(--radius);padding:10px;display:flex;gap:10px;align-items:flex-start">
            <img src="${trainerSprite('scientist')}" style="width:36px;height:36px;image-rendering:pixelated;flex-shrink:0;${owned && !enabled ? 'opacity:.4;filter:grayscale(1)' : ''}" onerror="this.style.display='none'">
            <div style="flex:1">
              <div style="font-family:var(--font-pixel);font-size:8px;color:${owned ? (enabled ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">Scientifique peu scrupuleux</div>
              <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Mutation artificielle : sacrifice d'un ★★★★★ même espèce → potentiel max.</div>
              ${owned
                ? `<div style="display:flex;align-items:center;gap:8px">
                     <span style="font-family:var(--font-pixel);font-size:7px;color:${enabled ? 'var(--green)' : 'var(--text-dim)'}">${enabled ? '✓ EN POSTE' : '✗ RENVOYÉ'}</span>
                     <button id="btnLabToggleScientist" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${enabled ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${enabled ? 'var(--red)' : 'var(--green)'};cursor:pointer">${enabled ? 'Renvoyer' : 'Rappeler'}</button>
                   </div>`
                : `<button id="btnLabBuyScientist" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Engager — 5 000 000₽</button>`}
            </div>
          </div>`;
        })()}
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:12px">${mutationHtml}</div>
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:12px">${trackerHtml}</div>
      </div>
    </div>`;

  // ── Scientist card handlers (Lab) ──
  tab.querySelector('#btnLabBuyScientist')?.addEventListener('click', () => {
    if (state.gang.money < 5_000_000) { notify('Fonds insuffisants.', 'error'); return; }
    showConfirm('Engager le Scientifique peu scrupuleux pour <b>5 000 000₽</b> ?<br><span style="font-size:10px;color:var(--text-dim)">Permet la mutation artificielle depuis ce Labo et le menu contextuel du PC.</span>', () => {
      state.gang.money -= 5_000_000;
      state.purchases.scientist = true;
      state.purchases.scientistEnabled = true;
      saveState(); updateTopBar(); SFX.play('unlock');
      notify('🧬 Le scientifique est en poste !', 'gold');
      if (pcView === 'lab') renderPCTab(); else renderLabTab();
    }, null, { confirmLabel: 'Engager', cancelLabel: 'Annuler' });
  });
  tab.querySelector('#btnLabToggleScientist')?.addEventListener('click', () => {
    state.purchases.scientistEnabled = state.purchases.scientistEnabled === false;
    saveState();
    notify(state.purchases.scientistEnabled !== false ? '🧬 Scientifique rappelé !' : '🚫 Scientifique renvoyé.', 'success');
    if (pcView === 'lab') renderPCTab(); else renderLabTab();
  });

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
    resetPcRenderCache();
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
let _playerWasActive = false; // set by saveState(); consumed by the 2h leaderboard timer

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

 

  // Snapshot every 10 minutes tick, but supaWriteSnapshot() throttles itself to 30 min
  setInterval(supaWriteSnapshot, 10 * 60 * 1000);

  // Leaderboard push every 10 minutes (has its own 1h dirty-check throttle)
  setInterval(supaUpdateLeaderboardAnon, 10 * 60 * 1000);
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
// 23.  SUPABASE — AUTH & CLOUD SAVE
// ════════════════════════════════════════════════════════════════
// Extracted to modules/systems/cloudAccount.js.

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
  getMysteryEggCost, trainerSprite, safeTrainerImg, safePokeImg,
  // UI / state helpers
  notify, saveState, setState, migrate, renderAll, slimPokemon,
  updateTopBar, tryAutoIncubate,
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
  startActiveZone, stopActiveZone, pauseZoneIfIdle, syncActiveZones,
  startBackgroundZone, stopBackgroundZone, syncBackgroundZones, // aliases
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
  POKEMON_GEN1, SPECIES_BY_EN, EVO_BY_SPECIES, POT_UPGRADE_COSTS,
  ZONES, ZONE_BY_ID, getBaseSpecies,
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
  renderLabTabInEl, getDexDesc,
  // zoneSelector module — zone helpers + data it reads from globalThis
  isZoneDegraded, getZoneMastery,
  getZoneSlotCost, ZONE_SLOT_COSTS, ZONE_BGS, SHOP_ITEMS,
  // Zone UI helpers — called by agent.js background ticks
  refreshZoneIncomeTile: _refreshZoneIncomeTile,
  updateZoneButtons: _updateZoneButtons,
  // gangBase module — helpers needed by modules/ui/gangBase.js
  openTeamPicker, openRareCandyPicker,
  pokemonDisplayName, sanitizeSpriteName,
  getDexKantoCaught, getDexNationalCaught, getShinySpeciesCount,
  getBossFullTitle, getTitleLabel,
  KANTO_DEX_SIZE, NATIONAL_DEX_SIZE, COSMETIC_BGS,
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
  openAssignToPicker,
  renderAgentsTab,
  renderGangTab,
  renderLabTabInEl,
  renderTrainingTab,
  renderPensionView,
  eggSprite,
  eggImgTag,
  getDexKantoCaught,
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
  _sessionStatsBase = { ...state.stats };

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
