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

export function createStore(options = {}) {
  const {
    localStorageRef = window.localStorage,
    initialState = createDefaultState(),
    notify = () => {},
    cloudSave = null,
    supabaseThrottleMs = 30_000,
    speciesByEn = {},
    uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    now = () => Date.now(),
    onAfterLoad = null,
    onAfterSave = null,
  } = options;

  let state = structuredClone(initialState);
  let listeners = new Set();
  let migrationResult = null;
  let lastCloudSaveAt = 0;
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
  function saveToSlot(slotIdx) {
    const previousSlot = activeSaveSlot;
    state._savedAt = now();
    localStorageRef.setItem(SAVE_KEYS[previousSlot], JSON.stringify(buildSavePayload(state)));
    setActiveSaveSlot(slotIdx);
    return save();
  }
  function loadSlot(slotIdx) {
    setActiveSaveSlot(slotIdx);
    return load();
  }
  function deleteSlot(slotIdx) {
    localStorageRef.removeItem(SAVE_KEYS[slotIdx]);
    if (slotIdx === activeSaveSlot) setActiveSaveSlot(0);
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
    if (typeof cloudSave === 'function') {
      const t = now();
      if (t - lastCloudSaveAt >= supabaseThrottleMs) {
        lastCloudSaveAt = t;
        Promise.resolve(cloudSave(payload)).catch(err => console.error('[Store] cloudSave failed:', err));
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
    saveToSlot,
    loadSlot,
    deleteSlot,
  };
}

function getInitialSaveSlot(localStorageRef) {
  const raw = localStorageRef.getItem('pokeforge.activeSlot') || '0';
  return Math.min(2, parseInt(raw, 10) || 0);
}

function getMigrationFields(saved) {
  const fields = [];
  if (!saved.behaviourLogs) fields.push('Logs comportementaux');
  if (saved.discoveryProgress?.agentsUnlocked === undefined) fields.push('Progression découverte étendue');
  if (saved.settings?.classicSprites === undefined) fields.push('Option sprites');
  if (!saved.eggs) fields.push('Système d’œufs');
  if (!saved.pension) fields.push('Pension');
  if (!saved.trainingRoom) fields.push('Salle d’entraînement');
  if (!saved.missions) fields.push('Missions');
  if (!saved.cosmetics) fields.push('Cosmétiques');
  return fields;
}
