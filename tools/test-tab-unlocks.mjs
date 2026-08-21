import assert from 'node:assert/strict';

import {
  BASE_TABS,
  TAB_UNLOCK_COPY,
  TAB_UNLOCK_RULES,
  UNLOCKABLE_TABS,
} from '../data/tab-unlocks-data.js';
import {
  defaultTabDiscovery,
  evaluateTabUnlocks,
  isTabRevealed,
  normalizeTabDiscovery,
  recordDiscoveryAgentOperation,
  recordDiscoveryCapture,
  recordDiscoverySession,
  revealAllTabs,
  revealTabs,
} from '../modules/systems/tabUnlocks.js';
import { ONBOARDING_STEPS } from '../modules/systems/onboardingFlow.js';
import { migrateSave } from '../state/migrateSave.js';
import { DEFAULT_STATE, SAVE_SCHEMA_VERSION } from '../state/defaultState.js';

const done = () => ({ step: ONBOARDING_STEPS.COMPLETED, status: 'completed' });
const makeState = (over = {}) => ({
  gang: { reputation: 0, initialized: true },
  onboarding: done(),
  discoveryProgress: defaultTabDiscovery(),
  ...over,
});

// ── Cohérence des règles ──────────────────────────────────────────
// Chaque onglet déblocable doit avoir un libellé, sinon la carte annonce un id.
for (const tab of UNLOCKABLE_TABS) {
  assert.ok(TAB_UNLOCK_COPY[tab], `${tab} doit avoir un libellé`);
  assert.ok(!BASE_TABS.includes(tab), `${tab} ne peut pas être à la fois acquis et déblocable`);
}
assert.equal(new Set(UNLOCKABLE_TABS).size, UNLOCKABLE_TABS.length, 'pas de doublon');

// ── Normalisation ─────────────────────────────────────────────────
assert.deepEqual(normalizeTabDiscovery(null), defaultTabDiscovery());
assert.deepEqual(normalizeTabDiscovery({ revealedTabs: 'nope' }).revealedTabs, []);
// Un id inconnu dans la save ne doit pas ressortir comme un onglet ouvert.
assert.deepEqual(normalizeTabDiscovery({ revealedTabs: ['tabMarket', 'tabGhost'] }).revealedTabs, ['tabMarket']);
assert.equal(normalizeTabDiscovery({ capturesSinceOnboarding: -3 }).capturesSinceOnboarding, 0);
assert.equal(normalizeTabDiscovery({ capturesSinceOnboarding: '7' }).capturesSinceOnboarding, 7);

// ── Accès ─────────────────────────────────────────────────────────
const fresh = makeState();
// Les onglets du tunnel restent toujours joignables.
for (const tab of BASE_TABS) assert.equal(isTabRevealed(fresh, tab), true);
// Un onglet hors règles (nouvel écran ajouté plus tard) n'est jamais bloqué.
assert.equal(isTabRevealed(fresh, 'tabSomethingNew'), true);
assert.equal(isTabRevealed(fresh, 'tabMarket'), false);

// ── Rien ne s'ouvre avant que le tunnel n'ait été fait ────────────
// `not_started` n'est pas « actif » non plus : un slot vierge se voyait
// offrir le Marché et le Compte avant la moindre capture.
const untouched = makeState({
  onboarding: { step: ONBOARDING_STEPS.NOT_STARTED, status: 'not_started' },
  gang: { reputation: 0, initialized: false },
});
assert.deepEqual(evaluateTabUnlocks(untouched), []);
assert.equal(recordDiscoverySession(untouched), null);
assert.equal(untouched.discoveryProgress.sessionsSinceOnboarding, 0);

// ── Rien ne s'ouvre pendant le tunnel ─────────────────────────────
// Sinon le déblocage progressif ferait réapparaître ce que
// getOnboardingTabAccess vient tout juste de cacher.
const midFunnel = makeState({ onboarding: { step: ONBOARDING_STEPS.GUIDE_TEAM, status: 'active' } });
assert.deepEqual(evaluateTabUnlocks(midFunnel), []);
assert.equal(recordDiscoveryCapture(midFunnel), null, 'les captures du tunnel ne comptent pas');
assert.equal(recordDiscoverySession(midFunnel), null);
assert.equal(midFunnel.discoveryProgress.capturesSinceOnboarding, 0);

// ── L'échelle, dans l'ordre ───────────────────────────────────────
const run = makeState();
// Fin du tunnel : le Marché, et lui seul — c'est la promesse de la carte de fin.
assert.deepEqual(evaluateTabUnlocks(run), ['tabMarket']);
assert.deepEqual(revealTabs(run, evaluateTabUnlocks(run)), ['tabMarket']);
assert.equal(isTabRevealed(run, 'tabMarket'), true);
// Re-révéler ne renvoie rien : la carte ne doit pas se rejouer.
assert.deepEqual(revealTabs(run, ['tabMarket']), []);
assert.deepEqual(evaluateTabUnlocks(run), []);

// Les captures seules n'ouvrent plus le Pokédex — mur narratif désormais
// (modules/ui/rivalEncounterPopup.js) — mais continuent d'alimenter le
// seuil Missions, inchangé.
recordDiscoveryCapture(run);
assert.deepEqual(evaluateTabUnlocks(run), []);

// Captures 2 à 4 : rien de neuf.
for (let i = 0; i < 3; i++) recordDiscoveryCapture(run);
assert.deepEqual(evaluateTabUnlocks(run), []);
// Cinquième capture → Missions. Le Pokédex, lui, reste verrouillé.
recordDiscoveryCapture(run);
assert.deepEqual(evaluateTabUnlocks(run), ['tabMissions']);
revealTabs(run, evaluateTabUnlocks(run));
assert.equal(isTabRevealed(run, 'tabPokedex'), false);

// Seul le flag posé par la scène du rival ouvre le Pokédex.
run.discoveryProgress.rivalPokedexUnlocked = true;
assert.deepEqual(evaluateTabUnlocks(run), ['tabPokedex']);
revealTabs(run, evaluateTabUnlocks(run));
assert.equal(isTabRevealed(run, 'tabPokedex'), true);

// Première opération d'agent → Événements.
recordDiscoveryAgentOperation(run);
assert.deepEqual(evaluateTabUnlocks(run), ['tabBattleLog']);
revealTabs(run, evaluateTabUnlocks(run));

// Une capture faite PAR un agent compte pour les deux compteurs.
const byAgent = makeState();
recordDiscoveryCapture(byAgent, { byAgent: true });
assert.equal(byAgent.discoveryProgress.capturesSinceOnboarding, 1);
assert.equal(byAgent.discoveryProgress.agentOperations, 1);

// Réputation → Raids puis Classement, pas les deux d'un coup.
run.gang.reputation = 50;
assert.deepEqual(evaluateTabUnlocks(run), ['tabCompetition']);
revealTabs(run, evaluateTabUnlocks(run));
run.gang.reputation = 99;
assert.deepEqual(evaluateTabUnlocks(run), []);
run.gang.reputation = 100;
assert.deepEqual(evaluateTabUnlocks(run), ['tabLeaderboard']);
revealTabs(run, evaluateTabUnlocks(run));

// Session suivante → Compte.
recordDiscoverySession(run);
assert.deepEqual(evaluateTabUnlocks(run), ['tabCompte']);
revealTabs(run, evaluateTabUnlocks(run));
assert.deepEqual(evaluateTabUnlocks(run), [], 'échelle terminée');
for (const tab of UNLOCKABLE_TABS) assert.equal(isTabRevealed(run, tab), true);

// ── Ouverture en bloc ─────────────────────────────────────────────
const everything = makeState();
assert.deepEqual(revealAllTabs(everything).sort(), [...UNLOCKABLE_TABS].sort());

// ── Migration : ne jamais retirer un onglet à une save existante ───
const migrationDeps = {
  DEFAULT_STATE, SAVE_SCHEMA_VERSION, SPECIES_BY_EN: {}, uid: () => 'test', now: () => 42_000,
};
// Save d'avant ce système : elle avait tous ses onglets, elle les garde.
const legacy = migrateSave({ _schemaVersion: 16, gang: { initialized: true } }, migrationDeps);
assert.deepEqual([...legacy.discoveryProgress.revealedTabs].sort(), [...UNLOCKABLE_TABS].sort());
// Une partie jamais commencée repart de zéro et méritera ses onglets.
const brandNew = migrateSave({ gang: { initialized: false } }, migrationDeps);
assert.deepEqual(brandNew.discoveryProgress.revealedTabs, []);
// Un run interrompu en plein tunnel ne doit pas se voir tout offrir.
const midSave = migrateSave({
  gang: { initialized: true },
  onboarding: { version: 3, step: 'guide_zone', status: 'active' },
}, migrationDeps);
assert.deepEqual(midSave.discoveryProgress.revealedTabs, []);
// Une save qui porte déjà la liste la conserve telle quelle, filtrée.
const partial = migrateSave({
  gang: { initialized: true },
  discoveryProgress: { revealedTabs: ['tabMarket', 'tabGhost'], capturesSinceOnboarding: 4 },
}, migrationDeps);
assert.deepEqual(partial.discoveryProgress.revealedTabs, ['tabMarket']);
assert.equal(partial.discoveryProgress.capturesSinceOnboarding, 4);
// Le drapeau Sinnoh historique traverse la migration intact.
const sinnoh = migrateSave({
  gang: { initialized: true }, discoveryProgress: { sinnohTeaseUnlocked: true },
}, migrationDeps);
assert.equal(sinnoh.discoveryProgress.sinnohTeaseUnlocked, true);

// Chaque règle doit avoir un type connu, et un seuil atteignable — sauf
// 'flag', qui pointe vers un booléen de discoveryProgress plutôt qu'un seuil.
const KNOWN_RULES = new Set(['onboarding', 'captures', 'agentOps', 'reputation', 'sessions', 'flag']);
for (const rule of TAB_UNLOCK_RULES) {
  assert.ok(KNOWN_RULES.has(rule.rule), `règle inconnue : ${rule.rule}`);
  if (rule.rule === 'flag') {
    assert.ok(typeof rule.flag === 'string' && rule.flag.length > 0, `${rule.tab} : flag manquant`);
  } else {
    assert.ok(Number.isFinite(rule.threshold) && rule.threshold >= 0);
  }
}

// ── Règle 'flag' isolée ─────────────────────────────────────────────
// Pas seulement testée via tabPokedex : vérifie le mécanisme générique lui-même.
const flagState = makeState();
assert.deepEqual(evaluateTabUnlocks(flagState), ['tabMarket'], 'sanity : fin du tunnel seule');
revealTabs(flagState, ['tabMarket']);
flagState.discoveryProgress.rivalPokedexUnlocked = false;
assert.equal(evaluateTabUnlocks(flagState).includes('tabPokedex'), false);
flagState.discoveryProgress.rivalPokedexUnlocked = true;
assert.equal(evaluateTabUnlocks(flagState).includes('tabPokedex'), true);

console.log('tab unlocks tests: ok');
