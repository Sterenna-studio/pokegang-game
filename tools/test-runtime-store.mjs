import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const tmpRoot = path.join(root, 'tools', '.tmp-runtime-store-tests');

class FakeStorage {
  constructor(seed = {}) {
    this.map = new Map(Object.entries(seed));
    this.setCalls = [];
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    const stringValue = String(value);
    this.map.set(key, stringValue);
    this.setCalls.push([key, stringValue]);
  }

  removeItem(key) {
    this.map.delete(key);
  }
}

async function writeModuleCopy(sourcePath, targetPath, replacements = []) {
  let source = await readFile(path.join(root, sourcePath), 'utf8');
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, source);
}

async function prepareModules() {
  await rm(tmpRoot, { recursive: true, force: true });
  await mkdir(path.join(tmpRoot, 'state'), { recursive: true });
  await mkdir(path.join(tmpRoot, 'data'), { recursive: true });
  await mkdir(path.join(tmpRoot, 'modules', 'ui'), { recursive: true });

  await writeModuleCopy('state/runtimeStore.js', path.join(tmpRoot, 'state', 'runtimeStore.mjs'), [
    ['./defaultState.js', './defaultState.mjs'],
    ['./store.js', './store.mjs'],
    ['./migrateSave.js', './migrateSave.mjs'],
  ]);
  await writeModuleCopy('state/store.js', path.join(tmpRoot, 'state', 'store.mjs'), [
    ['./defaultState.js', './defaultState.mjs'],
    ['./serialization.js', './serialization.mjs'],
    ['./migrateSave.js', './migrateSave.mjs'],
    ['../modules/ui/modals.js', '../modules/ui/modals.mjs'],
  ]);
  await writeModuleCopy('state/defaultState.js', path.join(tmpRoot, 'state', 'defaultState.mjs'));
  await writeModuleCopy('state/serialization.js', path.join(tmpRoot, 'state', 'serialization.mjs'));
  await writeModuleCopy('state/migrateSave.js', path.join(tmpRoot, 'state', 'migrateSave.mjs'), [
    ['../data/game-config-data.js', '../data/game-config-data.mjs'],
  ]);
  await writeModuleCopy('data/game-config-data.js', path.join(tmpRoot, 'data', 'game-config-data.mjs'));
  await writeFile(
    path.join(tmpRoot, 'modules', 'ui', 'modals.mjs'),
    "export function openImportPreviewModal() {}\n",
  );
}

function makeSpeciesMap() {
  return {
    pikachu: { en: 'pikachu', fr: 'Pikachu', dex: 25, rarity: 'common' },
    eevee: { en: 'eevee', fr: 'Evoli', dex: 133, rarity: 'rare' },
    missingno: { en: 'missingno', fr: 'MissingNo', dex: 0, hidden: true },
  };
}

function makeRuntime(createRuntimeStore, storage, nowRef = { value: 1_000 }) {
  let uidCounter = 0;
  return createRuntimeStore({
    localStorageRef: storage,
    speciesByEn: makeSpeciesMap(),
    uid: () => `uid-${++uidCounter}`,
    now: () => nowRef.value,
    notify: () => {},
  });
}

function clone(value) {
  return structuredClone(value);
}

try {
  await prepareModules();

  const runtimeModule = await import(pathToFileURL(path.join(tmpRoot, 'state', 'runtimeStore.mjs')));
  const storeModule = await import(pathToFileURL(path.join(tmpRoot, 'state', 'store.mjs')));
  const defaultsModule = await import(pathToFileURL(path.join(tmpRoot, 'state', 'defaultState.mjs')));
  const { createRuntimeStore } = runtimeModule;
  const { pokemonById, agentById } = storeModule;
  const { SAVE_KEYS, SAVE_SCHEMA_VERSION } = defaultsModule;

  const emptyStorage = new FakeStorage();
  const runtime = makeRuntime(createRuntimeStore, emptyStorage);

  assert.equal(runtime.getStore(), null, 'store is lazy before creation');
  runtime.createStoreInstance();
  assert.ok(runtime.getStore(), 'store is created');
  assert.equal(runtime.loadCurrentSlot(), null, 'empty storage returns no loaded state');
  assert.equal(runtime.isDirty(), true, 'fresh runtime starts dirty for first autosave');

  assert.equal(runtime.autoSave(), true, 'dirty autosave writes');
  const writesAfterAutosave = emptyStorage.setCalls.length;
  assert.ok(emptyStorage.getItem(SAVE_KEYS[0]), 'autosave writes active slot');
  assert.equal(runtime.isDirty(), false, 'autosave clears dirty flag');
  assert.equal(runtime.autoSave(), false, 'clean autosave is skipped');
  assert.equal(emptyStorage.setCalls.length, writesAfterAutosave, 'skipped autosave does not write');
  assert.equal(runtime.saveState(), true, 'explicit save writes even when clean');
  assert.equal(emptyStorage.setCalls.length, writesAfterAutosave + 1, 'forced save writes again');
  assert.equal(runtime.consumePlayerActivity(), true, 'save marks leaderboard activity');
  assert.equal(runtime.consumePlayerActivity(), false, 'activity signal is consumed once');

  const replaced = clone(runtime.getState());
  replaced.gang.name = 'Lookup Gang';
  replaced.pokemons = [{ id: 'pk-1', species_en: 'pikachu', level: 5, potential: 2 }];
  replaced.agents = [{ id: 'ag-1', sprite: 'rocketgrunt', team: ['pk-1'] }];
  runtime.setState(replaced);
  assert.equal(runtime.isDirty(), true, 'state replacement marks dirty');
  assert.equal(globalThis.state, runtime.getState(), 'global state reference is synced');
  assert.equal(pokemonById('pk-1')?.level, 5, 'pokemon lookup map uses current state');
  assert.equal(agentById('ag-1')?.team[0], 'pk-1', 'agent lookup map uses current state');

  const replacedAgain = clone(runtime.getState());
  replacedAgain.pokemons = [{ id: 'pk-2', species_en: 'eevee', level: 9, potential: 3 }];
  replacedAgain.agents = [];
  runtime.setState(replacedAgain);
  assert.equal(pokemonById('pk-1'), null, 'state replacement invalidates old pokemon lookup');
  assert.equal(pokemonById('pk-2')?.species_en, 'eevee', 'state replacement rebuilds lookup');

  runtime.saveState();
  const roundTripStorage = new FakeStorage(Object.fromEntries(emptyStorage.map));
  const roundTripRuntime = makeRuntime(createRuntimeStore, roundTripStorage);
  roundTripRuntime.createStoreInstance();
  assert.ok(roundTripRuntime.loadCurrentSlot(), 'existing save loads');
  assert.equal(roundTripRuntime.getState().gang.name, 'Lookup Gang', 'round-trip keeps gang data');
  assert.equal(roundTripRuntime.getState().pokemons[0].id, 'pk-2', 'round-trip keeps pokemon data');
  assert.equal(roundTripRuntime.isDirty(), false, 'loaded save is clean');

  const slotStorage = new FakeStorage();
  const slotRuntime = makeRuntime(createRuntimeStore, slotStorage);
  slotRuntime.createStoreInstance();
  for (let slot = 0; slot < SAVE_KEYS.length; slot++) {
    slotRuntime.setActiveSaveSlotValue(slot, { persist: true });
    const slotState = clone(slotRuntime.getState());
    slotState.gang.name = `Slot ${slot + 1}`;
    slotState.pokemons = [{ id: `slot-pk-${slot}`, species_en: 'pikachu', level: slot + 1, potential: 1 }];
    slotRuntime.setState(slotState);
    slotRuntime.saveState();
  }
  for (let slot = 0; slot < SAVE_KEYS.length; slot++) {
    assert.ok(slotStorage.getItem(SAVE_KEYS[slot]), `slot ${slot + 1} was saved`);
    slotRuntime.setActiveSaveSlotValue(slot, { persist: true });
    assert.ok(slotRuntime.loadCurrentSlot(), `slot ${slot + 1} loads`);
    assert.equal(slotRuntime.getState().gang.name, `Slot ${slot + 1}`, `slot ${slot + 1} round-trips`);
  }

  const exported = JSON.parse(slotRuntime.exportSaveString(false));
  assert.equal(exported.gang.name, 'Slot 3', 'export returns current state JSON');
  exported.gang.name = 'Imported Save';
  slotRuntime.importSaveObject(exported, { autoSave: true });
  assert.equal(slotRuntime.getState().gang.name, 'Imported Save', 'import replaces runtime state');
  assert.equal(JSON.parse(slotStorage.getItem(SAVE_KEYS[2])).gang.name, 'Imported Save', 'import autosaves');

  const oldSave = {
    version: '6.0.0',
    _schemaVersion: 1,
    gang: { name: 'Old Gang', bossTeam: [] },
    inventory: { greatball: 2 },
    settings: { classicSprites: true },
    stats: {},
    pokemons: [{ id: 'old-pk', species_en: 'pikachu', level: 101, potential: 6 }],
    agents: [],
  };
  const migrated = slotRuntime.migrate(oldSave);
  assert.equal(migrated._schemaVersion, SAVE_SCHEMA_VERSION, 'old save migrates to current schema');
  assert.equal(migrated.settings.classicSprites, undefined, 'legacy sprite setting is removed');
  assert.equal(migrated.pokemons.find(p => p.id === 'old-pk').level, 100, 'migration clamps level');
  assert.equal(migrated.pokemons.find(p => p.id === 'old-pk').potential, 5, 'migration clamps potential');
  assert.ok(migrated.pokemons.some(p => p.species_en === 'missingno'), 'migration reward is preserved');

  console.log('runtimeStore tests passed');
} finally {
  await rm(tmpRoot, { recursive: true, force: true });
}
