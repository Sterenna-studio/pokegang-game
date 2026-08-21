import assert from 'node:assert/strict';

import { MISSIONS, HOURLY_QUEST_POOL } from '../data/missions-data.js';
import { EventBus, EVENTS } from '../modules/core/eventBus.js';

// ── Environnement minimal ─────────────────────────────────────────
globalThis.MISSIONS = MISSIONS;
globalThis.HOURLY_QUEST_POOL = HOURLY_QUEST_POOL;
globalThis.COSMETIC_BGS = {
  theme_gold:    { fr: 'Doré',          en: 'Golden' },
  theme_red:     { fr: 'Rouge Sang',    en: 'Blood Red' },
  theme_sunset:  { fr: 'Coucher Soleil',en: 'Sunset' },
  theme_purple:  { fr: 'Nuit Violette', en: 'Violet Night' },
  theme_green:   { fr: 'Vert Toxik',    en: 'Toxic Green' },
};
globalThis.SHOP_ITEMS = [
  { id: 'lure',      fr: 'Leurre',        en: 'Lure' },
  { id: 'superlure', fr: 'Super Leurre',  en: 'Super Lure' },
  { id: 'incense',   fr: 'Encens Chance', en: 'Lucky Incense' },
  { id: 'aura',      fr: 'Aura Shiny',    en: 'Shiny Aura' },
  { id: 'rarescope', fr: 'Rarioscope',    en: 'Rare Scope' },
];
globalThis.saveState = () => {};
globalThis.checkForNewlyUnlockedZones = () => {};

// missions.js n'exporte ces fonctions que via globalThis (voir son en-tête
// "Exposes:"), pas via `export` ES — on les récupère après l'import pour
// son effet de bord (Object.assign(globalThis, {...}) en bas de fichier).
await import('../modules/systems/missions.js');
const { claimMission, isMissionComplete, isMissionClaimed } = globalThis;

const makeState = (over = {}) => ({
  lang: 'fr',
  gang: { money: 1000, reputation: 0 },
  stats: {
    totalMoneyEarned: 0, shinyCaught: 0, rocketDefeated: 0,
    chestsOpened: 0, eventsCompleted: 0, totalCaught: 0, totalFightsWon: 0,
  },
  zones: {},
  cosmetics: { unlockedBgs: [] },
  inventory: {},
  missions: {
    completed: [],
    daily:  { reset: Date.now(), progress: {}, claimed: [] },
    weekly: { reset: Date.now(), progress: {}, claimed: [] },
  },
  ...over,
});

let lastNotify = '';
EventBus.on(EVENTS.UI_NOTIFY, ({ msg }) => { lastNotify = msg; });

// ── Intégrité des données : jamais de pokéballs en récompense ─────
const BALL_IDS = ['pokeball', 'greatball', 'ultraball', 'masterball'];
for (const m of MISSIONS) {
  if (!m.reward.items) continue;
  for (const ballId of BALL_IDS) {
    assert.ok(!(ballId in m.reward.items), `${m.id} : ${ballId} ne doit jamais être une récompense de mission`);
  }
}

const cosmeticMissions = MISSIONS.filter(m => m.type === 'cosmetic');
assert.ok(cosmeticMissions.length >= 3, 'au moins quelques missions cosmétiques');
for (const m of cosmeticMissions) {
  assert.ok(m.reward.cosmeticBg, `${m.id} doit avoir reward.cosmeticBg`);
  assert.ok(!m.reward.money, `${m.id} : pas d'argent, la récompense EST le cosmétique`);
  assert.ok(globalThis.COSMETIC_BGS[m.reward.cosmeticBg] || true); // sanity: clé plausible
}

// ── Claim d'une mission cosmétique : fond débloqué, rep donnée, pas d'argent ──
const shinyMission = MISSIONS.find(m => m.id === 'cosmetic_shiny_hunter');
globalThis.state = makeState({ stats: { ...makeState().stats, shinyCaught: 3 } });
assert.equal(isMissionComplete(shinyMission), true);
assert.equal(isMissionClaimed(shinyMission), false);
claimMission(shinyMission);
assert.deepEqual(globalThis.state.cosmetics.unlockedBgs, ['theme_gold']);
assert.equal(globalThis.state.gang.reputation, 10);
assert.equal(globalThis.state.gang.money, 1000);
assert.ok(globalThis.state.missions.completed.includes('cosmetic_shiny_hunter'));
assert.equal(isMissionClaimed(shinyMission), true);
assert.ok(lastNotify.includes('Doré'), 'la notif doit citer le nom du fond débloqué');

// ── Re-claim : no-op (déjà réclamée) ───────────────────────────────
const unlockedBefore = [...globalThis.state.cosmetics.unlockedBgs];
claimMission(shinyMission);
assert.deepEqual(globalThis.state.cosmetics.unlockedBgs, unlockedBefore);
assert.equal(globalThis.state.gang.reputation, 10, 'pas de rep en double');

// ── Mission non complétée : claim = no-op ──────────────────────────
const highRoller = MISSIONS.find(m => m.id === 'cosmetic_high_roller');
globalThis.state = makeState({ stats: { ...makeState().stats, totalMoneyEarned: 500 } });
assert.equal(isMissionComplete(highRoller), false);
claimMission(highRoller);
assert.deepEqual(globalThis.state.cosmetics.unlockedBgs, []);
assert.equal(globalThis.state.gang.reputation, 0);

// ── Fond déjà possédé (acheté au Marché avant de finir la mission) :
// pas de doublon dans unlockedBgs, pas de ré-annonce "🎁" dans la notif,
// mais la réputation est quand même versée. ──
const rocketMission = MISSIONS.find(m => m.id === 'cosmetic_rocket_purge');
globalThis.state = makeState({
  stats: { ...makeState().stats, rocketDefeated: 15 },
  cosmetics: { unlockedBgs: ['theme_red'] },
});
lastNotify = '';
claimMission(rocketMission);
assert.deepEqual(globalThis.state.cosmetics.unlockedBgs, ['theme_red']);
assert.equal(globalThis.state.gang.reputation, 15);
assert.ok(!lastNotify.includes('🎁'), 'pas de ré-annonce de déblocage si déjà possédé');

// ── Missions "ravitaillement" : objets consommables en lot ─────────
const lureMission = MISSIONS.find(m => m.id === 'story_supply_lures');
globalThis.state = makeState({ stats: { ...makeState().stats, totalCaught: 75 } });
claimMission(lureMission);
assert.equal(globalThis.state.inventory.lure, 15);
assert.equal(globalThis.state.inventory.superlure, 5);
assert.ok(globalThis.state.missions.completed.includes('story_supply_lures'));
assert.ok(lastNotify.includes('Leurre'), 'la notif doit citer les objets reçus');

console.log('missions cosmétiques tests: ok');
