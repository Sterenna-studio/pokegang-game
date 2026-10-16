import fs from 'node:fs';
import vm from 'node:vm';
import { DEFAULT_STATE } from '../../state/defaultState.js';

// Use every shipped gym, including regions not activated at the hub.
export function makeSaveProgressFixture() {
  const context = vm.createContext({});
  for (const name of ['zones-data', 'zones-johto-data', 'zones-hoenn-data', 'zones-sinnoh-data']) {
    vm.runInContext(fs.readFileSync(new URL(`../../data/${name}.js`, import.meta.url), 'utf8'), context);
  }
  const catalogs = JSON.parse(vm.runInContext('JSON.stringify({ZONES,ZONES_JOHTO,ZONES_HOENN,ZONES_SINNOH})', context));
  const state = structuredClone(DEFAULT_STATE);
  state.gang.initialized = true;
  state.gang.name = 'Import regression';
  state.onboarding.step = 'completed';
  state.purchases = { johtoUnlocked: true, hoennUnlocked: true, sinnohUnlocked: true };
  for (const zone of Object.values(catalogs).flat().filter(z => z.gymLeader)) {
    state.zones[zone.id] = { gymDefeated: true, unlocked: true, combatsWon: 25,
      gymRaidLastFight: Date.now() - 10000, captures: 3, pendingIncome: 1450, assignedAgents: [] };
  }
  const now = Date.now();
  state.missions = {
    completed: ['first_catch', 'boss_10'],
    daily: { reset: now, progress: { totalCaught: 15 }, claimed: ['daily_catch'] },
    weekly: { reset: now, progress: { totalFightsWon: 123 }, claimed: ['weekly_fights'] },
    hourly: { reset: now, slots: ['catch_5', 'fight_10'], baseline: { totalCaught: 10 }, claimed: [0], rerolls: 2 },
  };
  for (const [key, value] of Object.entries(state).filter(([k]) => k.endsWith('Mission'))) {
    const fill = obj => {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'boolean') obj[k] = true;
        else if (typeof v === 'number') obj[k] = k === 'step' ? 3 : 7;
        else if (v && typeof v === 'object') fill(v);
      }
    };
    fill(value);
    if (key === 'betesMission') value.chosenBeast = 'suicune';
    if (key === 'galaxieMission') value.chosenLegend = 'palkia';
  }
  state.dropPity = { silver_wing: 14, rapport_sylphe: 6 };
  state.inventory.silver_wing = 3;
  state.inventory.fragment_temporel = 2;
  return { state, catalogs };
}

export function progressOf(state) {
  return { zones: state.zones, missions: state.missions, dropPity: state.dropPity,
    stories: Object.fromEntries(Object.entries(state).filter(([key]) => key.endsWith('Mission'))) };
}
