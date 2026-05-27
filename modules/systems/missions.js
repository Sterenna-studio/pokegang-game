/**
 * Missions Module — extracted from app.js section 7b
 *
 * Depends on globals set by app.js:
 *   state, MISSIONS, HOURLY_QUEST_POOL, HOURLY_QUEST_REROLL_COST,
 *   notify, SFX, saveState, updateTopBar, checkForNewlyUnlockedZones, t
 * Depends on globals from regular scripts: POKEMON_GEN1
 * Exposes: getMissionStat, initMissions, initHourlyQuests, getHourlyQuest,
 *          getHourlyProgress, isHourlyComplete, isHourlyClaimed,
 *          claimHourlyQuest, rerollHourlyQuest, getMissionProgress,
 *          isMissionComplete, isMissionClaimed, claimMission
 */

import { EventBus, EVENTS } from '../core/eventBus.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY,        { msg, type });
const _dirty  = ()               => EventBus.emit(EVENTS.STATE_DIRTY);
const _topBar = ()               => EventBus.emit(EVENTS.UI_TOPBAR_UPDATE);
const _save   = ()               => globalThis.saveState?.();

// ── Tracking des stats par région ───────────────────────────────────────────
// Lit ZONE_BY_ID (classic-script global) pour déduire la région de chaque capture/combat.
// Appelé une seule fois au boot via _initRegionTracking().

let _regionTrackingInit = false;

function _initRegionTracking() {
  if (_regionTrackingInit) return;
  _regionTrackingInit = true;

  EventBus.on(EVENTS.POKEMON_CAPTURED, ({ zoneId } = {}) => {
    if (!zoneId || zoneId === 'pension') return;
    const region = (typeof ZONE_BY_ID !== 'undefined' ? ZONE_BY_ID[zoneId]?.region : null) || 'kanto';
    const state = globalThis.state;
    if (!state?.stats) return;
    const key = region + 'Caught';
    state.stats[key] = (state.stats[key] || 0) + 1;
  });

  EventBus.on(EVENTS.COMBAT_WON, ({ zoneId } = {}) => {
    if (!zoneId) return;
    const region = (typeof ZONE_BY_ID !== 'undefined' ? ZONE_BY_ID[zoneId]?.region : null) || 'kanto';
    const state = globalThis.state;
    if (!state?.stats) return;
    const key = region + 'FightsWon';
    state.stats[key] = (state.stats[key] || 0) + 1;
  });
}

// ════════════════════════════════════════════════════════════════
//  7b. MISSIONS MODULE
// ════════════════════════════════════════════════════════════════

function getMissionStat(statKey) {
  const state = globalThis.state;
  if (statKey === '_reputation') return state.gang.reputation;
  if (statKey === '_agentCount') return state.agents.length;
  if (statKey === '_pokedexCaught') {
    return Object.values(state.pokedex).filter(e => e.caught).length;
  }
  if (statKey === '_starterCount') {
    const starters = ['bulbasaur', 'charmander', 'squirtle'];
    return starters.filter(s => state.pokemons.some(p => p.species_en === s)).length;
  }
  if (statKey === '_fossilCount') {
    const fossils = ['omanyte', 'kabuto', 'aerodactyl'];
    return fossils.filter(s => state.pokemons.some(p => p.species_en === s)).length;
  }
  if (statKey === '_zonesWithCapture') {
    return Object.values(state.zones).filter(z => (z.captures || 0) > 0).length;
  }
  if (statKey === '_dexKantoCaught') {
    return POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151 && state.pokedex[s.en]?.caught).length;
  }
  if (statKey === '_dexFullCaught') {
    return POKEMON_GEN1.filter(s => !s.hidden && state.pokedex[s.en]?.caught).length;
  }
  if (statKey === '_shinyDexCount') {
    return POKEMON_GEN1.filter(s => !s.hidden && state.pokedex[s.en]?.shiny).length;
  }
  if (statKey === '_shinyStarterCount') {
    return ['bulbasaur','charmander','squirtle'].filter(s => state.pokedex[s]?.shiny).length;
  }
  if (statKey === '_shinyLegendaryCount') {
    return POKEMON_GEN1.filter(s => s.rarity === 'legendary' && !s.hidden && state.pokedex[s.en]?.shiny).length;
  }
  return state.stats[statKey] || 0;
}

function initMissions() {
  const state = globalThis.state;
  // Démarrer le tracking région au premier appel
  _initRegionTracking();
  if (!state.missions) {
    state.missions = { completed: [], daily: { reset: 0, progress: {}, claimed: [] }, weekly: { reset: 0, progress: {}, claimed: [] } };
  }
  // Reset daily/weekly if expired
  const now = Date.now();
  const DAY = 86400000;
  const WEEK = 604800000;
  if (now - state.missions.daily.reset >= DAY) {
    // Snapshot current stats as baseline
    const baseline = {};
    for (const m of globalThis.MISSIONS.filter(m => m.type === 'daily')) {
      baseline[m.stat] = getMissionStat(m.stat);
    }
    state.missions.daily = { reset: now, progress: baseline, claimed: [] };
  }
  if (now - state.missions.weekly.reset >= WEEK) {
    const baseline = {};
    for (const m of globalThis.MISSIONS.filter(m => m.type === 'weekly')) {
      baseline[m.stat] = getMissionStat(m.stat);
    }
    state.missions.weekly = { reset: now, progress: baseline, claimed: [] };
  }
}

// ── Hourly quests ─────────────────────────────────────────────
const HOUR_MS = 3600000;

function initHourlyQuests() {
  const state = globalThis.state;
  if (!state.missions.hourly) state.missions.hourly = { reset: 0, slots: [], baseline: {}, claimed: [] };
  const h = state.missions.hourly;
  if (Date.now() - h.reset >= HOUR_MS) {
    const HOURLY_QUEST_POOL = globalThis.HOURLY_QUEST_POOL;
    // Filtrer par région débloquée (les quêtes sans région sont toujours disponibles)
    const purchases = state.purchases || {};
    const _regionOk = q => !q.region
      || (q.region === 'johto'  && purchases.johtoUnlocked)
      || (q.region === 'hoenn'  && purchases.hoennUnlocked)
      || (q.region === 'sinnoh' && purchases.sinnohUnlocked);
    // Draw 3 medium + 2 hard from pool (no duplicates)
    const medium = HOURLY_QUEST_POOL.filter(q => q.diff === 'medium' && _regionOk(q));
    const hard   = HOURLY_QUEST_POOL.filter(q => q.diff === 'hard'   && _regionOk(q));
    const pickRand = (arr, n) => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, n).map(q => q.id);
    };
    const slots = [...pickRand(medium, 3), ...pickRand(hard, 2)];
    const baseline = {};
    for (const qId of slots) {
      const q = HOURLY_QUEST_POOL.find(x => x.id === qId);
      if (q) baseline[q.stat] = (baseline[q.stat] === undefined) ? getMissionStat(q.stat) : baseline[q.stat];
    }
    state.missions.hourly = { reset: Date.now(), slots, baseline, claimed: [] };
    _save();
  }
}

function getHourlyQuest(slotIdx) {
  const state = globalThis.state;
  const id = state.missions.hourly?.slots?.[slotIdx];
  return id ? globalThis.HOURLY_QUEST_POOL.find(q => q.id === id) : null;
}

function getHourlyProgress(q) {
  const baseline = globalThis.state.missions.hourly.baseline?.[q.stat] || 0;
  return Math.min(getMissionStat(q.stat) - baseline, q.target);
}

function isHourlyComplete(q)  { return getHourlyProgress(q) >= q.target; }
function isHourlyClaimed(idx) { return (globalThis.state.missions.hourly.claimed || []).includes(idx); }

function claimHourlyQuest(idx) {
  const state = globalThis.state;
  const q = getHourlyQuest(idx);
  if (!q || !isHourlyComplete(q) || isHourlyClaimed(idx)) return;
  if (!state.missions.hourly.claimed) state.missions.hourly.claimed = [];
  state.missions.hourly.claimed.push(idx);
  if (q.reward.money) { state.gang.money += q.reward.money; state.stats.totalMoneyEarned += q.reward.money; }
  if (q.reward.rep)   { const prev = state.gang.reputation; state.gang.reputation += q.reward.rep; globalThis.checkForNewlyUnlockedZones(prev); }
  _notify(`✓ Quête : ${q.fr} — +${q.reward.money?.toLocaleString() || 0}₽${q.reward.rep ? ' +'+q.reward.rep+' rep' : ''}`, 'gold');
  globalThis.SFX.play('coin');
  _save();
}

function rerollHourlyQuest(idx) {
  const state = globalThis.state;
  const HOURLY_QUEST_REROLL_COST = globalThis.HOURLY_QUEST_REROLL_COST;
  if (state.gang.money < HOURLY_QUEST_REROLL_COST) { _notify(`Pokédollars insuffisants (${HOURLY_QUEST_REROLL_COST}₽ req)`); return; }
  const h = state.missions.hourly;
  if (!h || isHourlyClaimed(idx)) return;
  const current = getHourlyQuest(idx);
  if (!current) return;
  state.gang.money -= HOURLY_QUEST_REROLL_COST;
  // Pick a different quest of same difficulty
  const HOURLY_QUEST_POOL = globalThis.HOURLY_QUEST_POOL;
  const pool = HOURLY_QUEST_POOL.filter(q => q.diff === current.diff && q.id !== current.id && !h.slots.includes(q.id));
  if (pool.length === 0) { _notify('Aucune quête disponible pour le reroll'); state.gang.money += HOURLY_QUEST_REROLL_COST; return; }
  const newQ = pool[Math.floor(Math.random() * pool.length)];
  h.slots[idx] = newQ.id;
  if (h.baseline[newQ.stat] === undefined) h.baseline[newQ.stat] = getMissionStat(newQ.stat);
  _save();
  _notify(`Reroll : ${newQ.fr}`, 'success');
}

function getMissionProgress(mission) {
  const state = globalThis.state;
  const current = getMissionStat(mission.stat);
  if (mission.type === 'story') {
    return Math.min(current, mission.target);
  }
  const period = mission.type === 'daily' ? state.missions.daily : state.missions.weekly;
  const baseline = period.progress[mission.stat] || 0;
  return Math.min(current - baseline, mission.target);
}

function isMissionComplete(mission) {
  return getMissionProgress(mission) >= mission.target;
}

function isMissionClaimed(mission) {
  const state = globalThis.state;
  if (mission.type === 'story') return state.missions.completed.includes(mission.id);
  const period = mission.type === 'daily' ? state.missions.daily : state.missions.weekly;
  return period.claimed.includes(mission.id);
}

function claimMission(mission) {
  const state = globalThis.state;
  if (!isMissionComplete(mission) || isMissionClaimed(mission)) return;
  // Grant rewards
  if (mission.reward.money) {
    state.gang.money += mission.reward.money;
    state.stats.totalMoneyEarned += mission.reward.money;
  }
  if (mission.reward.rep) {
    state.gang.reputation += mission.reward.rep;
  }
  // Mark as claimed
  if (mission.type === 'story') {
    state.missions.completed.push(mission.id);
  } else {
    const period = mission.type === 'daily' ? state.missions.daily : state.missions.weekly;
    period.claimed.push(mission.id);
  }
  const name = state.lang === 'fr' ? mission.fr : mission.en;
  _notify(`${mission.icon} ${name} — ${state.lang === 'fr' ? 'Récompense récupérée !' : 'Reward claimed!'}`, 'gold');
  _save();
  _topBar();
}

Object.assign(globalThis, {
  getMissionStat,
  initMissions,
  initHourlyQuests,
  getHourlyQuest,
  getHourlyProgress,
  isHourlyComplete,
  isHourlyClaimed,
  claimHourlyQuest,
  rerollHourlyQuest,
  getMissionProgress,
  isMissionComplete,
  isMissionClaimed,
  claimMission,
});
export {};
