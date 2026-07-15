'use strict';

import {
  DEFAULT_STATE,
  SAVE_KEYS,
  LEGACY_SAVE_KEYS,
  SAVE_SCHEMA_VERSION,
  createDefaultState,
} from './defaultState.js';

import { buildSavePayload } from './serialization.js';
import { migrateSave, getMigrationSummary } from './migrateSave.js';
import { openImportPreviewModal } from '../modules/ui/modals.js';

export function createStore(options = {}) {
  const {
    localStorageRef = window.localStorage,
    initialState = createDefaultState(),
    notify = () => {},
    speciesByEn = {},
    uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    now = () => Date.now(),
    onAfterLoad = null,
    onAfterSave = null,
  } = options;

  let state = structuredClone(initialState);
  let listeners = new Set();
  let migrationResult = null;
  let activeSaveSlot = getInitialSaveSlot(localStorageRef);
  let saveKey = SAVE_KEYS[activeSaveSlot];

  function getState() { return state; }
  function setState(nextState, { emit = true } = {}) {
    state = nextState;
    if (emit) emitChange();
    return state;
  }
  function patchState(patch, { emit = true } = {}) {
    state = { ...state, ...patch };
    if (emit) emitChange();
    return state;
  }
  function resetState({ emit = true } = {}) {
    state = createDefaultState();
    if (emit) emitChange();
    return state;
  }
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
  function emitChange() {
    for (const listener of listeners) {
      try { listener(state); } catch (err) { console.error('[Store] listener error:', err); }
    }
  }
  function getActiveSaveSlot() { return activeSaveSlot; }
  function getSaveKey() { return saveKey; }
  function setActiveSaveSlot(slot, { persist = true } = {}) {
    activeSaveSlot = Math.max(0, Math.min(SAVE_KEYS.length - 1, Number(slot) || 0));
    saveKey = SAVE_KEYS[activeSaveSlot];
    if (persist) localStorageRef.setItem('pokeforge.activeSlot', String(activeSaveSlot));
    return activeSaveSlot;
  }
  function accumulatePlaytime() {
    if (state.sessionStart) {
      state.playtime = (state.playtime || 0) + Math.floor((now() - state.sessionStart) / 1000);
      state.sessionStart = now();
    }
  }
  function save() {
    if (!state.marketSales) state.marketSales = {};
    accumulatePlaytime();
    state._savedAt = now();
    const payload = buildSavePayload(state);
    payload._savedAt = state._savedAt;
    const data = JSON.stringify(payload);
    try {
      localStorageRef.setItem(saveKey, data);
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        notify('⚠ Save trop volumineuse — historiques supprimés', 'error');
        try {
          const emergency = JSON.parse(data);
          for (const p of emergency.pokemons || []) delete p.history;
          localStorageRef.setItem(saveKey, JSON.stringify(emergency));
        } catch (emergencyErr) {
          console.error('[Store] emergency save failed:', emergencyErr);
        }
      } else {
        throw e;
      }
    }
    if (typeof onAfterSave === 'function') onAfterSave(state);
    return true;
  }
  function load() {
    let raw = localStorageRef.getItem(saveKey);
    let legacyKey = null;
    if (!raw) {
      for (const key of LEGACY_SAVE_KEYS) {
        const legacyRaw = localStorageRef.getItem(key);
        if (legacyRaw) { raw = legacyRaw; legacyKey = key; break; }
      }
    }
    if (!raw) return null;
    try {
      const saved = JSON.parse(raw);
      migrationResult = legacyKey
        ? { from: `clé ${legacyKey}`, toLegacyKey: legacyKey, fields: getMigrationFields(saved) }
        : getMigrationSummary(saved, { SAVE_SCHEMA_VERSION });
      const migrated = migrateSave(saved, {
        DEFAULT_STATE,
        SAVE_SCHEMA_VERSION,
        SPECIES_BY_EN: speciesByEn,
        uid,
        now,
      });
      if (legacyKey) {
        try { localStorageRef.removeItem(legacyKey); } catch (err) { console.warn('[Store] failed removing legacy key:', legacyKey, err); }
      }
      state = migrated;
      if (typeof onAfterLoad === 'function') onAfterLoad(state, migrationResult);
      emitChange();
      return state;
    } catch (e) {
      console.error('[Store] load error:', e);
      return null;
    }
  }
  function exportSave(pretty = true) { return JSON.stringify(state, null, pretty ? 2 : 0); }
  function importSaveObject(rawSave, { emit = true, autoSave = true } = {}) {
    const migrated = migrateSave(rawSave, {
      DEFAULT_STATE,
      SAVE_SCHEMA_VERSION,
      SPECIES_BY_EN: speciesByEn,
      uid,
      now,
    });
    state = migrated;
    if (autoSave) save();
    if (emit) emitChange();
    return state;
  }
  function getMigrationResult() { return migrationResult; }

  return {
    getState,
    setState,
    patchState,
    resetState,
    subscribe,
    save,
    load,
    exportSave,
    importSaveObject,
    getMigrationResult,
    getActiveSaveSlot,
    getSaveKey,
    getSaveKeys: () => [...SAVE_KEYS],
    setActiveSaveSlot,
  };
}

function getInitialSaveSlot(localStorageRef) {
  const raw = localStorageRef.getItem('pokeforge.activeSlot') || '0';
  return Math.min(2, parseInt(raw, 10) || 0);
}

function getMigrationFields(saved) {
  const fields = [];
  if (!saved.behaviourLogs) fields.push('Logs comportementaux');
  if (saved.settings?.classicSprites === undefined) fields.push('Option sprites');
  if (!saved.eggs) fields.push('Système d’œufs');
  if (!saved.pension) fields.push('Pension');
  if (!saved.trainingRoom) fields.push('Salle d’entraînement');
  if (!saved.missions) fields.push('Missions');
  if (!saved.cosmetics) fields.push('Cosmétiques');
  return fields;
}

// ── Lookup Maps (O(1) Pokémon / Agent access) ────────────────────────────────
// Fonctions libres opérant sur le state live (globalThis.state) — pas sur une
// instance de store, contrairement à createStore() ci-dessus. Rebuild lazy à
// chaque invalidation (après tout push/splice/filter sur state.pokemons ou
// state.agents). Hot-path : pokemonById/agentById remplacent array.find()
// dans tout le codebase.
let _pokemonMap = null;
let _agentMap   = null;

export function _rebuildLookupMaps() {
  const state = globalThis.state;
  _pokemonMap = new Map(state.pokemons.map(p => [p.id, p]));
  _agentMap   = new Map(state.agents.map(a => [a.id, a]));
}

export function invalidateLookupMaps() {
  _pokemonMap = null;
  _agentMap   = null;
}

export function pokemonById(id) {
  if (!_pokemonMap) _rebuildLookupMaps();
  return _pokemonMap.get(id) ?? null;
}

export function agentById(id) {
  if (!_agentMap) _rebuildLookupMaps();
  return _agentMap.get(id) ?? null;
}

// ── loadState() — helper legacy/debug, PAS utilisé par le boot normal ────────
// Le boot réel passe par createStore().load() (voir load() ci-dessus). Cette
// fonction lit directement le slot actif localStorage et migre, sans instance
// de store — gardée pour compatibilité avec d'anciens outils de debug/tests.
let _migrationResult = null; // null | { from: string, fields: string[] }

export function loadState() {
  const saveKey = SAVE_KEYS[globalThis.activeSaveSlot ?? 0];
  let raw = localStorage.getItem(saveKey);
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

    const migrated = migrateSave(saved, {
      DEFAULT_STATE,
      SAVE_SCHEMA_VERSION,
      SPECIES_BY_EN,
      uid: globalThis.uid,
      now: () => Date.now(),
    });

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

// ── Export / Import de save (fichier JSON téléchargeable) ────────────────────
export function exportSave() {
  const state = globalThis.state;
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pokeforge-v6-save-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importSave(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const raw = JSON.parse(e.target.result);
      if (!raw || typeof raw !== 'object' || (!raw.gang && !raw.pokemons)) {
        globalThis.notify?.('Import échoué — fichier invalide ou non-reconnu.', 'error'); return;
      }
      openImportPreviewModal(raw);
    } catch {
      globalThis.notify?.('Import échoué — fichier JSON invalide.', 'error');
    }
  };
  reader.readAsText(file);
}
