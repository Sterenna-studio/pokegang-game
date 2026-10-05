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
    // Délai de regroupement des sauvegardes explicites. 0 = écriture synchrone
    // (comportement historique, utilisé par les tests). > 0 : saveState() ne
    // fait que planifier l'écriture, qui coûte ~55 ms avec 7 000 Pokémon.
    saveDeferMs = 0,
  } = options;

  let state = structuredClone(initialState || DEFAULT_STATE);
  let store = null;
  let stateDirty = true;
  let playerWasActive = false;
  let activeSaveSlot = getInitialSaveSlot(localStorageRef);
  let saveKey = SAVE_KEYS[activeSaveSlot];
  let pendingSaveTimer = null;
  let savePending = false;

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
    // Une écriture en attente appartient au slot courant : la vider avant de changer de clé.
    if (savePending && clampSlot(slotIdx) !== activeSaveSlot) flushSave();
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

  function writeNow() {
    if (pendingSaveTimer !== null) { clearTimeout(pendingSaveTimer); pendingSaveTimer = null; }
    savePending = false;
    stateDirty = false;
    syncGlobalState();
    ensureStore().setState(state, { emit: false });
    return ensureStore().save();
  }

  function saveState({ markActivity = true, immediate = false } = {}) {
    if (markActivity) playerWasActive = true;
    if (immediate || saveDeferMs <= 0) return writeNow();
    // Différée : l'état reste « sale » jusqu'à l'écriture réelle, que l'autosave
    // ou flushSave (évènements de cycle de vie) rattrapent si le timer saute.
    stateDirty = true;
    savePending = true;
    if (pendingSaveTimer === null) pendingSaveTimer = setTimeout(writeNow, saveDeferMs);
    return true;
  }

  /** Écrit tout de suite si une sauvegarde différée est en attente. */
  function flushSave() {
    return savePending ? writeNow() : false;
  }

  function autoSave() {
    if (!stateDirty) return false;
    return writeNow();
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
    flushSave,
    autoSave,
    migrate,
    getMigrationResult,
    markPlayerActivity,
    consumePlayerActivity,
    exportSaveString,
    importSaveObject,
  };
}
