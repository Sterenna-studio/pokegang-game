import assert from 'node:assert/strict';

import { EventBus, EVENTS } from '../modules/core/eventBus.js';
import { ONBOARDING_STEPS } from '../modules/systems/onboardingFlow.js';
import { ONBOARDING_CAPTURE_GOAL, ONBOARDING_ZONE_ID } from '../data/onboarding-data.js';
import { TRAINER_TYPES } from '../data/trainers-data.js';
import {
  configureOnboarding,
  reconcileOnboardingProgress,
  resumeOnboardingV2,
} from '../modules/ui/onboarding.js';

// ── Environnement minimal ─────────────────────────────────────────
// Le contrôleur touche au DOM (fermeture du hub) et à makeRaidSpawn : on
// stubbe juste ce qu'il consomme, le reste est piloté par l'EventBus.
const overlayClasses = new Set(['active']);
globalThis.document = {
  getElementById: id => (id === 'introOverlay'
    ? { classList: { remove: cls => overlayClasses.delete(cls) } }
    : null),
};
// Reproduit le contrat de makeRaidSpawn sur le point qui compte ici : un roster
// imposé fixe le nombre d'assaillants, leur type de combat (`key`) et leur
// visage (`trainer.sprite`).
globalThis.makeRaidSpawn = (zone, zoneId, mastery = 1, { roster = null } = {}) => {
  const entries = roster?.length ? roster : [{ key: 'rocketgrunt' }, { key: 'rocketgrunt' }];
  return {
    type: 'raid',
    raidTrainers: entries.map(entry => ({
      key: entry.key,
      trainer: {
        fr: entry.fr ?? 'Sbire Rocket', en: entry.en ?? 'Rocket Grunt',
        sprite: entry.sprite || entry.key, reward: [10, 20], rep: 5, diff: 4,
      },
      team: [],
    })),
    trainerKey: entries[0].key,
    trainer: { fr: '[RAID]', en: '[RAID]', reward: [10, 20], rep: 5 },
    team: [],
    isRaid: true,
  };
};

const state = {
  lang: 'fr',
  onboarding: {
    version: 3, status: 'active', step: ONBOARDING_STEPS.FREE_CAPTURE,
    startedAt: 1_000, completedAt: null, fieldCaptures: 0, starterSpecies: null,
    ambushAt: null, ambushWon: false, guideAgentId: null, guideSprite: null,
    firstBattleAt: null, completionRewardGrantedAt: null, completionRewardMoney: 0,
  },
  gang: { initialized: true, bossTeam: [], money: 5_000 },
  stats: { totalMoneyEarned: 0 },
  agents: [],
};

let fieldSpawns = [];
const closedZones = [];
let openedZone = null;
let guideRefreshes = 0;
let guideCleared = 0;
let zonesForceRefreshed = 0;
let payoff = null;
let identityOpened = 0;
const analyticsEvents = [];
const completedSteps = [];
// Ordre de la cinématique : ce qui compte est que Giovanni parle sur le terrain
// AVANT que son écran d'identité ne s'ouvre, et qu'il reparte APRÈS.
const cinematic = [];

globalThis.trackEvent = (name, params) => analyticsEvents.push({ name, params });

configureOnboarding({
  getState: () => state,
  saveState: () => {},
  renderAll: () => {},
  notify: () => {},
  switchTab: () => true,
  openZoneWindow: zoneId => { openedZone = zoneId; },
  getZoneSpawns: () => fieldSpawns,
  renderSpawn: () => {},
  removeSpawn: (_zoneId, id) => { fieldSpawns = fieldSpawns.filter(s => s.id !== id); },
  endZoneCombat: zoneId => { cinematic.push(`combat-teardown:${zoneId}`); },
  closeZoneWindow: zoneId => { closedZones.push(zoneId); },
  forceZonesRefresh: () => { zonesForceRefreshed++; },
  getZoneById: zoneId => ({ id: zoneId, fr: 'Zone inconnue', en: 'Unknown Field', spawnRate: 0.5 }),
  getActiveSaveSlot: () => 0,
  openGiovanniIntro: ({ onComplete }) => {
    identityOpened++;
    cinematic.push('identity');
    onComplete?.({});
    return true;
  },
  ambushIntroLine: () => 'intro',
  playAmbushArrival: () => { cinematic.push('ambush-arrival'); return Promise.resolve(true); },
  playGiovanniArrival: ({ won }) => { cinematic.push(`giovanni-arrival:${won}`); return Promise.resolve(true); },
  playGiovanniDeparture: () => { cinematic.push('giovanni-departure'); return Promise.resolve(true); },
  showOnboardingIdlePayoff: options => { payoff = options; return true; },
  placeGuide: () => { guideRefreshes++; },
  refreshGuide: () => { guideRefreshes++; },
  clearGuide: () => { guideCleared++; },
});
EventBus.on(EVENTS.ONBOARDING_STEP_COMPLETED, payload => completedSteps.push(payload));

const capture = (zoneId = ONBOARDING_ZONE_ID, species = 'rattata') =>
  EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: { species_en: species }, zoneId });

// ── Capture libre ─────────────────────────────────────────────────
capture(ONBOARDING_ZONE_ID, 'meowth');
assert.equal(state.onboarding.fieldCaptures, 1);
// The very first catch is what Giovanni shows on his summary screen.
assert.equal(state.onboarding.starterSpecies, 'meowth');
assert.equal(analyticsEvents.at(-1).name, 'first_wild_capture');

// Captures elsewhere must not feed the field counter.
capture('route1', 'pidgey');
assert.equal(state.onboarding.fieldCaptures, 1);

for (let i = 1; i < ONBOARDING_CAPTURE_GOAL - 1; i++) capture();
assert.equal(state.onboarding.fieldCaptures, ONBOARDING_CAPTURE_GOAL - 1);
assert.equal(state.onboarding.step, ONBOARDING_STEPS.FREE_CAPTURE);

// ── Embuscade ─────────────────────────────────────────────────────
capture();
assert.equal(state.onboarding.step, ONBOARDING_STEPS.ROCKET_AMBUSH);
assert.equal(openedZone, ONBOARDING_ZONE_ID);
assert.equal(fieldSpawns.length, 1);
assert.equal(fieldSpawns[0].spawnCtx.ambush, true);
assert.equal(fieldSpawns[0].raidTrainers.length, 3);
assert.ok(analyticsEvents.some(e => e.name === 'ambush_started'));
// Le trio d'assaillants est tiré ici et persisté : c'est lui que la modale du
// transfuge proposera, et il doit survivre à un rechargement en pleine scène.
assert.equal(state.onboarding.ambushSprites.length, 3);
assert.equal(new Set(state.onboarding.ambushSprites).size, 3);
// Les visages du raid SONT le tirage persisté — sinon le joueur choisit son
// transfuge parmi des têtes qu'il n'a jamais vues.
assert.deepEqual(
  fieldSpawns[0].raidTrainers.map(rt => rt.trainer.sprite),
  state.onboarding.ambushSprites,
);
// …et chacun se bat sous une clé TRAINER_TYPES réelle, pas sous sa clé de sprite.
assert.ok(fieldSpawns[0].raidTrainers.every(rt => TRAINER_TYPES[rt.key]));
// La réplique d'intro est portée par le sprite, pas par un toast : elle doit
// vivre sur le spawn pour survivre à une fermeture/réouverture de la zone.
assert.equal(fieldSpawns[0].bubble, 'intro');
assert.equal(fieldSpawns[0].bubbleHostile, true);
assert.deepEqual(cinematic, ['ambush-arrival']);

// Losing is the expected outcome and must still move the story forward.
EventBus.emit(EVENTS.COMBAT_LOST, { zoneId: ONBOARDING_ZONE_ID, trainerKey: 'rocketgrunt' });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.IDENTITY);
assert.equal(state.onboarding.ambushWon, false);
// COMBAT_LOST est émis par applyCombatResult, donc AVANT la première image du
// combat : le terrain doit rester en place le temps que la séquence visuelle
// se joue. Couper ici supprimait l'unique combat de la première session.
assert.equal(fieldSpawns.length, 1);
assert.deepEqual(cinematic, ['ambush-arrival']);

// Fin de l'animation → c'est seulement maintenant que le terrain se vide et
// que la cinématique de Giovanni peut prendre la main sur le DOM de la zone.
EventBus.emit(EVENTS.COMBAT_SEQUENCE_ENDED, { zoneId: ONBOARDING_ZONE_ID });
assert.equal(fieldSpawns.length, 0);

// Une autre zone qui finit son combat ne doit pas piloter l'embuscade.
EventBus.emit(EVENTS.COMBAT_SEQUENCE_ENDED, { zoneId: 'route1' });

// ── Giovanni ──────────────────────────────────────────────────────
await new Promise(resolve => setTimeout(resolve, 1_000));
assert.equal(identityOpened, 1);
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_MET);
assert.equal(overlayClasses.has('active'), false);
// Giovanni arrive et parle sur le terrain, PUIS son écran s'ouvre, PUIS il
// repart — l'ordre est tout l'intérêt de la scène.
// Le combat est coupé avant la scène : tant qu'il tient le DOM de la zone,
// aucun acteur de cinématique ne peut s'y afficher.
assert.deepEqual(cinematic, [
  'ambush-arrival', `combat-teardown:${ONBOARDING_ZONE_ID}`,
  'giovanni-arrival:false', 'identity', 'giovanni-departure',
]);

// ── Le transfuge ──────────────────────────────────────────────────
const { onGuideRecruited } = await import('../modules/ui/onboarding.js');
state.agents.push({ id: 'guide-1', name: 'Zane', assignedZone: null, team: [], autoCombat: false });
assert.equal(onGuideRecruited('guide-1', 'rocketgrunt'), true);
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_TEAM);
assert.equal(state.onboarding.guideSprite, 'rocketgrunt');
// Le recrutement s'est joué dans une popup par-dessus le jeu (enchaînée
// depuis le départ de Giovanni) : même besoin de refresh forcé qu'à la
// complétion finale, sinon l'onglet resterait construit avec l'état d'avant.
assert.equal(zonesForceRefreshed, 1);
// Recruiting twice must not double-advance, and must not force a second refresh.
assert.equal(onGuideRecruited('guide-1', 'rocketgrunt'), false);
assert.equal(zonesForceRefreshed, 1);

// « Confie-moi un Pokémon » — seule SON équipe compte.
EventBus.emit(EVENTS.TEAM_MEMBER_SET, { team: 'boss', pokemonId: 'pk-1', source: 'test' });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_TEAM);
EventBus.emit(EVENTS.TEAM_MEMBER_SET, { team: 'agent', agentId: 'someone-else', pokemonId: 'pk-1' });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_TEAM);
state.agents[0].team.push('pk-1');
EventBus.emit(EVENTS.TEAM_MEMBER_SET, { team: 'agent', agentId: 'guide-1', pokemonId: 'pk-1', source: 'pc-picker' });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_ZONE);

// « Assigne-moi à une zone » — un désassignement ne compte pas.
EventBus.emit(EVENTS.AGENT_ASSIGNED, { agentId: 'guide-1', zoneId: null });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_ZONE);
state.agents[0].assignedZone = 'route1';
EventBus.emit(EVENTS.AGENT_ASSIGNED, { agentId: 'guide-1', zoneId: 'route1' });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_COMBAT);
// Assignation faite depuis l'onglet Agents, comme le recrutement plus haut —
// même besoin de refresh forcé, sinon la fenêtre de zone (bulle du guide)
// resterait construite avec l'état d'avant tant que le joueur ne rouvre pas
// Zones lui-même.
assert.equal(zonesForceRefreshed, 2);

// « Active mon option de combat » — le bon drapeau, la bonne valeur, le bon agent.
EventBus.emit(EVENTS.AGENT_FLAG_CHANGED, { agentId: 'guide-1', flag: 'autoCapture', value: true });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_COMBAT);
EventBus.emit(EVENTS.AGENT_FLAG_CHANGED, { agentId: 'guide-1', flag: 'autoCombat', value: false });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_COMBAT);
EventBus.emit(EVENTS.AGENT_FLAG_CHANGED, { agentId: 'other', flag: 'autoCombat', value: true });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_COMBAT);

state.agents[0].autoCombat = true;
EventBus.emit(EVENTS.AGENT_FLAG_CHANGED, { agentId: 'guide-1', flag: 'autoCombat', value: true });
assert.equal(state.onboarding.step, ONBOARDING_STEPS.COMPLETED);
assert.equal(state.gang.money, 5_500);
assert.equal(state.stats.totalMoneyEarned, 500);
assert.equal(payoff.agent.name, 'Zane');
assert.equal(payoff.progress.completed, 6);
// Il vient de vivre la cinématique en direct : jamais lui reproposer un
// flashback de sa propre scène (state ne portait même pas discoveryProgress
// au départ — c'est aussi le chemin défensif qui le crée à la volée).
assert.equal(state.discoveryProgress.introFlashbackOffered, true);
assert.equal(guideCleared, 1);
assert.ok(guideRefreshes > 0);
// Le terrain de départ disparaît : il sort du selecteur ET sa fenêtre est
// fermée, sinon le joueur garde à l'écran une zone qu'il ne peut plus rouvrir.
assert.ok(closedZones.includes(ONBOARDING_ZONE_ID));
assert.ok(!(state.openZoneOrder || []).includes(ONBOARDING_ZONE_ID));
// Le joueur est sur Agents à cet instant (dernier geste du transfuge), pas
// Zones — sans ce forçage explicite, le fogmap ne montrerait le Marché
// fraîchement débloqué qu'au prochain clic manuel sur l'onglet Zones.
// 3 au total : le recrutement du transfuge et l'assignation de zone plus
// haut en ont déjà déclenché un chacun.
assert.equal(zonesForceRefreshed, 3);

// Rejouer l'événement ne doit ni repayer la prime ni réémettre l'étape.
const stepsAfter = completedSteps.length;
EventBus.emit(EVENTS.AGENT_FLAG_CHANGED, { agentId: 'guide-1', flag: 'autoCombat', value: true });
assert.equal(state.gang.money, 5_500);
assert.equal(completedSteps.length, stepsAfter);

// free_capture_started comes from _runOnboardingV2, which this harness bypasses
// by starting the state mid-funnel; everything below is event-driven.
for (const name of ['first_wild_capture', 'ambush_started', 'ambush_resolved',
  'identity_completed', 'guide_recruited', 'guide_team_set', 'guide_zone_assigned', 'guide_combat_enabled']) {
  const event = analyticsEvents.find(candidate => candidate.name === name);
  assert.ok(event, `${name} should be tracked`);
  assert.equal(event.params.onboarding_version, 3);
  assert.ok(Number.isInteger(event.params.seconds_since_new_game));
}

// ── Réconciliation à la reprise ───────────────────────────────────
// La save a déjà l'agent équipé et posté : reprendre ne doit pas redemander
// ce qui est fait — c'est ce que le bouton ▶ du hub déclenche.
state.onboarding = {
  ...state.onboarding, step: ONBOARDING_STEPS.GUIDE_TEAM, status: 'active',
  completedAt: null, guideAgentId: 'guide-1', completionRewardGrantedAt: null,
};
state.gang.money = 7_000;
state.stats.totalMoneyEarned = 0;
state.agents[0].autoCombat = false;
payoff = null;
reconcileOnboardingProgress();
assert.equal(state.onboarding.step, ONBOARDING_STEPS.GUIDE_COMBAT);

// Un guide absent de la save ne doit pas bloquer sur une demande sans destinataire.
state.onboarding = { ...state.onboarding, step: ONBOARDING_STEPS.GUIDE_TEAM, guideAgentId: 'ghost' };
reconcileOnboardingProgress();
assert.equal(state.onboarding.guideAgentId, null);

const resumeEvents = [];
EventBus.on(EVENTS.ONBOARDING_RESUMED, payload => resumeEvents.push(payload));
state.onboarding = { ...state.onboarding, step: ONBOARDING_STEPS.COMPLETED, status: 'completed' };
assert.equal(resumeOnboardingV2({ slotIdx: 1 }), false);
assert.equal(resumeEvents.length, 0);

console.log('onboarding controller tests: ok');
