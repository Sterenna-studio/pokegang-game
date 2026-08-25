import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const tmpRoot = path.join(root, 'tools', '.tmp-offline-agent-tests');

function makeState({ autoSell = true } = {}) {
  return {
    lang: 'fr',
    zoneFocus: 'route_1',
    settings: {
      autoCombat: true,
      protectedSpecies: [],
      autoSellAgent: { mode: 'by_potential', potentials: [2] },
    },
    purchases: { autoSellAgent: autoSell, autoSellAgentEnabled: true },
    pokemons: [],
    pokedex: {},
    zones: { route_1: {} },
    gang: { money: 100, reputation: 0, bossTeam: [] },
    stats: {
      totalCaught: 0,
      totalSold: 0,
      totalMoneyEarned: 0,
      shinyCaught: 0,
      dexCaught: 0,
    },
    agents: [{
      id: 'agent-1', name: 'Jessie', assignedZone: 'route_1', team: [],
      level: 1, xp: 0, energy: 10, autoCapture: true, resting: false,
    }],
  };
}

async function prepareAgentModule() {
  await rm(tmpRoot, { recursive: true, force: true });
  await mkdir(tmpRoot, { recursive: true });
  let source = await readFile(path.join(root, 'modules', 'systems', 'agent.js'), 'utf8');
  source = source
    .replace("./zoneCombat.js", './zoneCombat.mjs')
    .replace("../../data/gameplay-config-data.js", './gameplay-config-data.mjs')
    .replace("../core/eventBus.js", './eventBus.mjs')
    .replace("./onboardingFlow.js", './onboardingFlow.mjs');
  await writeFile(path.join(tmpRoot, 'agent.mjs'), source);
  await writeFile(path.join(tmpRoot, 'zoneCombat.mjs'), 'export function resolveTrainerCombat() { throw new Error("combat not expected"); }\n');
  await writeFile(path.join(tmpRoot, 'gameplay-config-data.mjs'), 'export const AUTO_COMBAT_VISUAL_MS = 1; export const AGENT_PRISON_MS = 3600000;\n');
  await writeFile(path.join(tmpRoot, 'onboardingFlow.mjs'), 'export function isOnboardingFreeAgentPending() { return false; }\n');
  await writeFile(path.join(tmpRoot, 'eventBus.mjs'), `
    export const EVENTS = {
      UI_NOTIFY:'notify', STATE_DIRTY:'dirty', UI_TOPBAR_UPDATE:'topbar',
      MONEY_CHANGED:'money', POKEMON_SOLD:'sold', POKEMON_CAPTURED:'captured',
      REP_CHANGED:'rep', AGENT_RECRUITED:'recruited', AGENT_ASSIGNED:'assigned',
      AGENT_FLAG_CHANGED:'flag'
    };
    export const EventBus = { emit(event, data) { globalThis.__offlineAgentTestEmit?.(event, data); } };
  `);
}

try {
  await prepareAgentModule();

  globalThis.ZONE_BY_ID = { route_1: { id: 'route_1', fr: 'Route 1', en: 'Route 1', spawnRate: 1, tier: 1 } };
  globalThis.SPECIES_BY_EN = { zubat: { en: 'zubat', fr: 'Nosferapti', rarity: 'common' } };
  globalThis.MOVES_DATA = {};
  globalThis.BALLS = { pokeball: { fr: 'Poké Ball', en: 'Poké Ball' } };
  globalThis.RANK_CHAIN = [];
  globalThis.TITLE_REQUIREMENTS = {
    sergent: { level: 25 }, lieutenant: { level: 50 }, commandant: { level: 75 },
  };
  globalThis.AGENT_RANK_LABELS = {};
  globalThis.spawnInZone = () => ({ type: 'pokemon', species_en: 'zubat', spawnCtx: {} });
  globalThis.makePokemon = () => ({
    id: 'pokemon-1', species_en: 'zubat', dex: 41, potential: 2,
    shiny: false, favorite: false, level: 1, xp: 0, history: [],
  });
  globalThis.calculatePrice = () => 500;
  globalThis.speciesName = species => species === 'zubat' ? 'Nosferapti' : species;
  globalThis.calculateStats = () => ({});
  globalThis.addZoneXP = () => false;
  globalThis.registerPokedexCapture = (state, pokemon) => {
    state.pokedex[pokemon.species_en] = { caught: true, count: 1 };
  };
  globalThis._unlockFabricBg = () => {};
  globalThis.addLog = () => {};
  globalThis.t = key => key;
  globalThis.pushFeedEvent = () => {};
  globalThis.openZones = new Set();
  globalThis.activeTab = 'tabZones';
  globalThis.pcView = 'grid';

  await import(`${pathToFileURL(path.join(tmpRoot, 'agent.mjs')).href}?v=${Date.now()}`);

  const originalRandom = Math.random;
  Math.random = () => 0.9;
  try {
    let saves = 0;
    let uiCalls = 0;
    const captures = [];
    globalThis.state = makeState({ autoSell: true });
    globalThis.saveState = () => { saves++; };
    globalThis.refreshZoneIncomeTile = () => { uiCalls++; };
    globalThis.updateZoneButtons = () => { uiCalls++; };
    globalThis._refreshZoneStatsView = () => { uiCalls++; };
    globalThis.__offlineAgentTestEmit = event => { if (event === 'topbar') uiCalls++; };
    globalThis.OfflineReport = {
      isCollecting: () => true,
      pushCapture: capture => captures.push(capture),
      pushLevelUp: () => {},
      pushAgentEvent: () => {},
    };

    const metrics = { deferredSaveCalls: 0, deferredUiRefreshes: 0 };
    for (let tick = 0; tick < 120; tick++) {
      const changed = globalThis.resolveBackgroundSpawnForZone('route_1', {
        deferSave: true,
        deferUi: true,
        silent: true,
        collecting: true,
        metrics,
      });
      assert.equal(changed, true);
    }
    assert.equal(saves, 0, 'the real resolver does not persist during a batch tick');
    assert.equal(uiCalls, 0, 'the real resolver does not refresh UI during a batch tick');
    assert.equal(metrics.deferredSaveCalls, 120);
    assert.equal(metrics.deferredUiRefreshes, 120);
    assert.equal(captures.length, 120);
    assert.equal(captures[0].sold, true);
    assert.equal(captures[0].salePrice, 500);
    assert.equal(globalThis.state.gang.money, 60_100);
    assert.equal(globalThis.state.pokemons.length, 0, 'auto-sold capture is not kept in the PC');

    saves = 0;
    uiCalls = 0;
    globalThis.state = makeState({ autoSell: false });
    globalThis.OfflineReport = { isCollecting: () => false };
    globalThis.resolveBackgroundSpawnForZone('route_1');
    assert.equal(saves, 1, 'normal gameplay keeps its immediate persistence');
    assert.equal(uiCalls, 4, 'normal gameplay keeps its topbar and zone refreshes');
    assert.equal(globalThis.state.pokemons.length, 1);
  } finally {
    Math.random = originalRandom;
  }

  console.log('offline agent batch tests passed');
} finally {
  await rm(tmpRoot, { recursive: true, force: true });
}
