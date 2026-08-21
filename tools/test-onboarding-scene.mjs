import assert from 'node:assert/strict';

import {
  acquireStoryLock,
  getStoryLockOwner,
  releaseStoryLock,
} from '../modules/core/storyLock.js';
import { ONBOARDING_GIOVANNI_LINES, ONBOARDING_AMBUSH_LINES } from '../data/onboarding-data.js';

// ── Environnement minimal ─────────────────────────────────────────
// La scène ne dessine rien elle-même : elle pose un acteur et demande à
// zoneWindows de repeindre. Il lui faut juste un viewport où planter son
// capteur de clic — sans lui elle refuse de jouer, cf. le cas « pas de
// terrain à l'écran » plus bas.
// La bulle est un vrai nœud (textContent mutable) : la machine à écrire de
// onboardingScene.js la cherche via querySelector et la tape dessus. Sans
// elle, _typeAndWait retomberait silencieusement sur l'ancien comportement
// chronométré et le test ne couvrirait rien de neuf.
const bubbleEl = { textContent: '' };
const viewport = {
  children: [],
  appendChild(el) { this.children.push(el); el.remove = () => {}; },
  querySelector: sel => (sel === '.zone-quest-encounter .zone-speech-bubble' ? bubbleEl : null),
};
let fieldOnScreen = true;
globalThis.document = {
  getElementById: id => (fieldOnScreen && id === 'zw-unknown_field'
    ? { querySelector: sel => (sel === '.zone-viewport' ? viewport : null) }
    : null),
  createElement: () => ({ className: '', addEventListener() {}, remove() {}, isConnected: false }),
};
globalThis.trainerSprite = key => `sprite:${key}`;

const {
  advanceOnboardingScene,
  cancelOnboardingScene,
  configureOnboardingScene,
  getOnboardingSceneEncounterForZone,
  isOnboardingSceneRunning,
  playGiovanniArrival,
  playGiovanniDeparture,
} = await import('../modules/ui/onboardingScene.js');

const state = {
  lang: 'fr',
  onboarding: { step: 'identity', ambushSprites: ['burglar', 'gambler', 'rocker'] },
};
configureOnboardingScene({ getState: () => state });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Avance la scène beat par beat en enregistrant chaque réplique affichée.
 * Deux clics par beat, sans condition : un beat avec réplique a besoin du
 * premier pour terminer la frappe et du second pour avancer ; un beat muet
 * résout dès le premier, le second ne fait alors rien (advanceOnboardingScene
 * renvoie false hors scène active) — la même paire marche donc pour les deux.
 */
async function drain(promise, zoneId = 'unknown_field') {
  const seen = [];
  while (isOnboardingSceneRunning()) {
    const actor = getOnboardingSceneEncounterForZone(zoneId);
    if (actor) seen.push(`${actor.name}|${actor.bubble}|${actor.cls}`);
    advanceOnboardingScene();
    advanceOnboardingScene();
    await sleep(0);
  }
  await promise;
  return seen;
}

// ── Machine à écrire : jamais d'avance automatique ─────────────────
// Reproduit un joueur qui n'agit pas du tout : un beat avec réplique ne doit
// JAMAIS avancer tout seul — c'était tout le problème de l'ancien minuteur
// (BEAT_HOLD_MS) qui pouvait faire défiler du texte sans que personne l'ait lu.
{
  const typingScene = playGiovanniArrival({ won: false });
  const fullLine = ONBOARDING_AMBUSH_LINES.lost.fr;
  await sleep(90); // largement moins que le temps de frappe complet (~22ms/caractère)
  assert.ok(isOnboardingSceneRunning(), 'toujours en cours sans clic — pas de minuteur qui avance seul');
  assert.equal(getOnboardingSceneEncounterForZone('unknown_field').name, 'Sbire Rocket');
  assert.ok(bubbleEl.textContent.length > 0, 'la frappe a commencé');
  assert.ok(bubbleEl.textContent.length < fullLine.length, 'pas encore fini de taper à 90ms');

  // Premier clic : termine la ligne affichée, mais n'avance PAS au beat suivant.
  advanceOnboardingScene();
  assert.equal(bubbleEl.textContent, fullLine, 'le premier clic complète la frappe en cours');
  assert.equal(getOnboardingSceneEncounterForZone('unknown_field').name, 'Sbire Rocket', 'toujours le même beat');

  // Attendre après une ligne complète ne fait rien avancer non plus.
  await sleep(120);
  assert.equal(getOnboardingSceneEncounterForZone('unknown_field').name, 'Sbire Rocket', 'aucun minuteur derrière une ligne terminée');

  // Second clic : avance réellement au beat suivant.
  advanceOnboardingScene();
  await sleep(0);
  assert.equal(getOnboardingSceneEncounterForZone('unknown_field').name, 'Giovanni', 'le second clic avance');

  cancelOnboardingScene();
  await typingScene;
  assert.equal(getStoryLockOwner(), null);
}

// ── Clic dans la fenêtre morte entre deux beats (jamais perdu) ─────
// Entre la résolution d'un beat et la pose des handlers du suivant, il
// s'écoule un microtask (l'await de _play) : un clic tombant pile là ne doit
// pas être avalé. Trois clics synchrones (aucun `await sleep` entre eux, pour
// forcer le pire cas) doivent faire avancer la scène de deux beats complets :
// terminer la frappe du sbire, puis sauter le beat silencieux de Giovanni
// (700ms, scene-arrive) sans attendre son minuteur.
{
  const scene = playGiovanniArrival({ won: false });
  await sleep(90);
  advanceOnboardingScene(); // termine la frappe du sbire
  advanceOnboardingScene(); // avance vers le beat silencieux de Giovanni
  advanceOnboardingScene(); // clic immédiat, sans attendre — ne doit pas se perdre
  await sleep(0);
  const actor = getOnboardingSceneEncounterForZone('unknown_field');
  assert.equal(actor.name, 'Giovanni');
  assert.equal(actor.cls, '', 'le beat silencieux (scene-arrive) a été sauté, pas juste écourté');
  cancelOnboardingScene();
  await scene;
  assert.equal(getStoryLockOwner(), null);
}

// ── Arrivée de Giovanni ───────────────────────────────────────────
assert.equal(getOnboardingSceneEncounterForZone('unknown_field'), null, 'pas de scène = pas d’acteur');

const arrival = playGiovanniArrival({ won: false });
assert.equal(isOnboardingSceneRunning(), true);
// Le verrou est pris pour toute la scène.
assert.equal(getStoryLockOwner(), 'onboarding-v2');

const arrivalBeats = await drain(arrival);
// Les sbires ont le dernier mot, puis Giovanni arrive — en silence d'abord
// (bulle vide tant qu'il marche : jamais de texte pendant que le sprite
// bouge, sinon illisible), sa réplique n'arrive qu'une fois immobile.
assert.ok(arrivalBeats[0].startsWith('Sbire Rocket|' + ONBOARDING_AMBUSH_LINES.lost.fr));
assert.equal(arrivalBeats[1], 'Giovanni||scene-arrive', 'entrée silencieuse, rien à lire pendant qu\'il marche');
assert.ok(arrivalBeats[2].startsWith('Giovanni|' + ONBOARDING_GIOVANNI_LINES.arrival.fr));
assert.ok(arrivalBeats[2].endsWith('|'), 'plus de cls d\'animation une fois immobile');
assert.ok(arrivalBeats[3].includes(ONBOARDING_GIOVANNI_LINES.claim.fr));
assert.ok(arrivalBeats[4].includes(ONBOARDING_GIOVANNI_LINES.offer.fr));
// Le terrain est rendu avant que l'écran d'identité ne s'ouvre.
assert.equal(getOnboardingSceneEncounterForZone('unknown_field'), null);
// …et le verrou aussi : le laisser traîner bloquerait toute autre surface
// narrative pour le reste de la session.
assert.equal(getStoryLockOwner(), null);

// Le joueur qui gagne l'embuscade ne doit pas s'entendre parler d'une défaite.
const wonBeats = await drain(playGiovanniArrival({ won: true }));
assert.ok(wonBeats[0].includes(ONBOARDING_AMBUSH_LINES.won.fr));
assert.ok(wonBeats[2].includes(ONBOARDING_GIOVANNI_LINES.arrivalWon.fr));

// L'acteur n'existe que sur le terrain de départ.
const running = playGiovanniDeparture();
assert.equal(getOnboardingSceneEncounterForZone('route1'), null);
assert.ok(getOnboardingSceneEncounterForZone('unknown_field'));
// Une deuxième scène ne doit pas se superposer à celle qui joue.
assert.equal(await playGiovanniArrival({ won: false }), false);
const departureBeats = await drain(running);
assert.ok(departureBeats[0].includes(ONBOARDING_GIOVANNI_LINES.farewell.fr));
assert.ok(departureBeats.at(-1).endsWith('|scene-leave'), 'il repart en marchant');
assert.equal(getStoryLockOwner(), null);

// ── Verrou hérité ─────────────────────────────────────────────────
// Séquence Giovanni : l'appelant tient le verrou parce que l'écran d'identité
// s'ouvre entre deux scènes. La scène ne doit alors surtout pas le rendre.
acquireStoryLock('onboarding-v2');
await drain(playGiovanniDeparture());
assert.equal(getStoryLockOwner(), 'onboarding-v2', 'un verrou hérité reste à son propriétaire');
releaseStoryLock('onboarding-v2');

// Un verrou tenu par quelqu'un d'autre bloque la scène plutôt que de la voler.
acquireStoryLock('autre-histoire');
assert.equal(await playGiovanniDeparture(), false);
assert.equal(getOnboardingSceneEncounterForZone('unknown_field'), null);
assert.equal(getStoryLockOwner(), 'autre-histoire');
releaseStoryLock('autre-histoire');

// ── Pas de terrain à l'écran ──────────────────────────────────────
// Reprise depuis le hub : la scène se saute d'elle-même plutôt que de faire
// patienter le joueur devant un terrain qu'il ne voit pas.
fieldOnScreen = false;
assert.equal(await playGiovanniArrival({ won: false }), false);
assert.equal(isOnboardingSceneRunning(), false);
assert.equal(getStoryLockOwner(), null, 'une scène sautée ne prend pas le verrou');
fieldOnScreen = true;

// ── Annulation ────────────────────────────────────────────────────
const cancelled = playGiovanniArrival({ won: false });
assert.equal(cancelOnboardingScene(), true);
assert.equal(await cancelled, false);
assert.equal(getOnboardingSceneEncounterForZone('unknown_field'), null, 'le terrain est rendu');
assert.equal(getStoryLockOwner(), null);
assert.equal(cancelOnboardingScene(), false, 'rien à annuler hors scène');

console.log('onboarding scene tests: ok');
