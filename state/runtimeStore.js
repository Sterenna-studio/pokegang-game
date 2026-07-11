'use strict';

// ES imports:
// - default state/save constants from state/defaultState.js
// - persistent store + lookup invalidation from state/store.js
// - migration logic from state/migrateSave.js
// Injected deps via createRuntimeStore():
// - localStorageRef, notify, speciesByEn, uid, now, globalRef
// Classic-script globals used: none; species maps are injected by app.js.
// Temporary globalThis access:
// - writes state, _store and activeSaveSlot compatibility bridges.

import {
  DEFAULT_STATE,
  SAVE_KEYS,
  SAVE_SCHEMA_VERSION,
  createDefaultState,
} from './defaultState.js';
import { createStore, invalidateLookupMaps } from './store.js';
import { migrateSave } from './migrateSave.js';

function clampSlot(slot) {
  return Math.max(0, Math.min(SAVE_KEYS.length - 1, Number(slot) || 0));
}

function getInitialSaveSlot(localStorageRef) {
  const raw = localStorageRef?.getItem?.('pokeforge.activeSlot') || '0';
  return clampSlot(parseInt(raw, 10) || 0);
}

export function createRuntimeStore(options = {}) {
  const {
    localStorageRef = globalThis.localStorage,
    notify = () => {},
    speciesByEn = {},
    uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    now = () => Date.now(),
    globalRef = globalThis,
    initialState = createDefaultState(),
  } = options;

  let state = structuredClone(initialState || DEFAULT_STATE);
  let store = null;
  let stateDirty = true;
  let playerWasActive = false;
  let activeSaveSlot = getInitialSaveSlot(localStorageRef);
  let saveKey = SAVE_KEYS[activeSaveSlot];

  function syncGlobalState() {
    if (globalRef) globalRef.state = state;
  }

  function syncDebugStore() {
    if (globalRef) globalRef._store = store;
  }

  function installActiveSlotBridge() {
    if (!globalRef) return;
    Object.defineProperty(globalRef, 'activeSaveSlot', {
      get: () => activeSaveSlot,
      set: value => { setActiveSaveSlotValue(value, { persist: false }); },
      configurable: true,
    });
  }

  function createStoreInstance() {
    store = createStore({
      localStorageRef,
      initialState: createDefaultState(),
      notify,
      speciesByEn,
      uid,
      now,
    });
    store.setActiveSaveSlot(activeSaveSlot, { persist: false });
    syncDebugStore();
    return store;
  }

  function ensureStore() {
    return store || createStoreInstance();
  }

  function getState() {
    return state;
  }

  function getStore() {
    return store;
  }

  function getActiveSaveSlot() {
    return activeSaveSlot;
  }

  function getSaveKey() {
    return saveKey;
  }

  function setActiveSaveSlotValue(slotIdx, opts = {}) {
    activeSaveSlot = clampSlot(slotIdx);
    saveKey = SAVE_KEYS[activeSaveSlot];
    if (opts?.persist) localStorageRef?.setItem?.('pokeforge.activeSlot', String(activeSaveSlot));
    store?.setActiveSaveSlot(activeSaveSlot, { persist: false });
    return activeSaveSlot;
  }

  function setState(nextState, { dirty = true, emit = false } = {}) {
    state = nextState;
    syncGlobalState();
    store?.setState(nextState, { emit });
    invalidateLookupMaps();
    if (dirty) stateDirty = true;
    return state;
  }

  function loadCurrentSlot() {
    const loaded = ensureStore().load();
    if (!loaded) return null;
    setState(ensureStore().getState(), { dirty: false, emit: false });
    stateDirty = false;
    return state;
  }

  function initialize() {
    ensureStore();
    return loadCurrentSlot();
  }

  function markDirty() {
    stateDirty = true;
    invalidateLookupMaps();
  }

  function isDirty() {
    return stateDirty;
  }

  function saveState({ markActivity = true } = {}) {
    stateDirty = false;
    syncGlobalState();
    if (markActivity) playerWasActive = true;
    ensureStore().setState(state, { emit: false });
    return ensureStore().save();
  }

  function autoSave() {
    if (!stateDirty) return false;
    return saveState();
  }

  function migrate(saved) {
    return migrateSave(saved, {
      DEFAULT_STATE,
      SAVE_SCHEMA_VERSION,
      SPECIES_BY_EN: speciesByEn,
      uid,
      now,
    });
  }

  function getMigrationResult() {
    return store?.getMigrationResult() ?? null;
  }

  function markPlayerActivity() {
    playerWasActive = true;
  }

  function consumePlayerActivity() {
    const wasActive = playerWasActive;
    playerWasActive = false;
    return wasActive;
  }

  function exportSaveString(pretty = true) {
    ensureStore().setState(state, { emit: false });
    return ensureStore().exportSave(pretty);
  }

  function importSaveObject(rawSave, opts = {}) {
    const imported = ensureStore().importSaveObject(rawSave, opts);
    state = imported;
    syncGlobalState();
    invalidateLookupMaps();
    stateDirty = opts?.autoSave === false;
    if (opts?.autoSave !== false) playerWasActive = true;
    return state;
  }

  syncGlobalState();
  installActiveSlotBridge();

  return {
    createStoreInstance,
    initialize,
    loadCurrentSlot,
    getState,
    getStore,
    getActiveSaveSlot,
    getSaveKey,
    setActiveSaveSlotValue,
    setState,
    markDirty,
    isDirty,
    saveState,
    autoSave,
    migrate,
    getMigrationResult,
    markPlayerActivity,
    consumePlayerActivity,
    exportSaveString,
    importSaveObject,
  };
}
