'use strict';

// ════════════════════════════════════════════════════════════════
//  onboardingScene.js — la cinématique d'ouverture
//
//  Les beats de la première session ne sont plus des toasts : les sbires
//  entrent sur le terrain, parlent au-dessus de leur sprite, et Giovanni
//  arrive en personne avant que son écran d'identité ne s'ouvre. Tout se
//  joue dans le viewport de la zone de départ, via les ancrages déjà en
//  place — .zone-quest-encounter pour l'acteur, .zone-speech-bubble pour
//  sa réplique — donc ce module ne dessine rien lui-même : il tient
//  l'acteur courant et laisse zoneWindows le rendre.
//
//  Rythme : chaque beat a une durée, et un clic n'importe où dans le
//  viewport passe au suivant sans attendre. Il n'y a pas de saut global —
//  au tout premier run, un clic réflexe ne doit pas escamoter la mise en
//  place. Le capteur de clic couvre le viewport pendant la scène, ce qui
//  neutralise aussi le gameplay derrière.
//
//  Dépendances globalThis : trainerSprite, patchZoneWindow
// ════════════════════════════════════════════════════════════════

import {
  acquireStoryLock,
  getStoryLockOwner,
  releaseStoryLock,
} from '../core/storyLock.js';
import {
  ONBOARDING_AMBUSH_LINES,
  ONBOARDING_GIOVANNI_LINES,
  ONBOARDING_ZONE_ID,
  resolveAmbushSprites,
} from '../../data/onboarding-data.js';
import { normalizeOnboardingState } from '../systems/onboardingFlow.js';

const LOCK_OWNER = 'onboarding-v2';
const SCENE_ENCOUNTER_ID = 'onboarding-scene';
const AMBUSH_SPAWN_SELECTOR = '[data-spawn-id="onboarding-ambush"]';
const CATCHER_CLASS = 'onboarding-scene-catcher';

/** Durée par défaut d'une réplique avant enchaînement automatique. */
const BEAT_HOLD_MS = 3_400;
/** Beat muet (entrée/sortie de scène) — juste le temps de l'animation. */
const MOVE_HOLD_MS = 700;

let _ctx = {};
let _actor = null;
let _running = false;
let _cancelled = false;
let _advance = null;
let _timer = 0;
let _catcher = null;

export function configureOnboardingScene(ctx = {}) {
  _ctx = { ..._ctx, ...ctx };
}

const _state = () => _ctx.getState?.() ?? globalThis.state;
const _line = (entry) => (_state()?.lang === 'en' ? entry.en : entry.fr);
const _t = (fr, en) => (_state()?.lang === 'en' ? en : fr);

function _spriteUrl(key) {
  return globalThis.trainerSprite?.(key)
    || `https://play.pokemonshowdown.com/sprites/trainers/${key}.png`;
}

/** Le sbire qui porte les répliques : le premier assaillant du tirage persisté. */
function _gruntSpriteKey() {
  const resolved = resolveAmbushSprites(normalizeOnboardingState(_state()?.onboarding).ambushSprites);
  return resolved[0]?.key || 'rocketgrunt';
}

// ── Rendu ─────────────────────────────────────────────────────────
/**
 * Branché en tête du chaînage des rencontres de quête de zoneWindows : tant
 * qu'une scène tient un acteur, c'est lui qui occupe le terrain — y compris à
 * la place du transfuge, dont la réplique ne doit pas s'afficher pendant que
 * Giovanni parle.
 */
export function getOnboardingSceneEncounterForZone(zoneId) {
  if (zoneId !== ONBOARDING_ZONE_ID || !_actor) return null;
  return {
    id: SCENE_ENCOUNTER_ID,
    name: _actor.name,
    bubble: _actor.bubble,
    hostile: !!_actor.hostile,
    cls: _actor.cls || '',
    icon: _actor.icon || '',
    spriteUrl: _actor.spriteUrl,
    // Cliquer l'acteur revient à cliquer la scène : on avance d'un beat.
    onClick: advanceOnboardingScene,
  };
}

function _repaint() {
  const win = document.getElementById(`zw-${ONBOARDING_ZONE_ID}`);
  if (win) globalThis.patchZoneWindow?.(ONBOARDING_ZONE_ID, win);
}

function _viewport() {
  return document.getElementById(`zw-${ONBOARDING_ZONE_ID}`)?.querySelector('.zone-viewport') ?? null;
}

function _mountCatcher() {
  if (_catcher?.isConnected) return;
  const viewport = _viewport();
  if (!viewport) return;
  _catcher = document.createElement('div');
  _catcher.className = CATCHER_CLASS;
  _catcher.addEventListener('click', () => { advanceOnboardingScene(); });
  viewport.appendChild(_catcher);
}

function _unmountCatcher() {
  _catcher?.remove();
  _catcher = null;
}

// ── Moteur de beats ───────────────────────────────────────────────
export function isOnboardingSceneRunning() {
  return _running;
}

/** Passe au beat suivant. Renvoie false si aucune scène n'attend. */
export function advanceOnboardingScene() {
  if (!_running || !_advance) return false;
  _advance();
  return true;
}

function _hold(ms) {
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(_timer);
      _timer = 0;
      _advance = null;
      resolve();
    };
    _advance = finish;
    _timer = setTimeout(finish, ms);
  });
}

/**
 * Joue une suite de beats. Le verrou narratif est pris pour la durée de la
 * scène — sauf s'il est déjà tenu sous le même nom par l'appelant, cas de la
 * séquence Giovanni où l'écran d'identité s'ouvre entre deux scènes et exige
 * que le verrou n'ait pas été relâché entre-temps.
 */
async function _play(beats) {
  if (_running) return false;
  // Pas de scène sans scène : si le terrain n'est pas à l'écran (reprise
  // depuis le hub, fenêtre de zone fermée), jouer les beats ferait attendre le
  // joueur devant rien. L'appelant enchaîne alors directement sur la suite.
  if (!_viewport()) return false;
  const inherited = getStoryLockOwner() === LOCK_OWNER;
  if (!inherited && !acquireStoryLock(LOCK_OWNER)) return false;

  _running = true;
  _cancelled = false;
  _mountCatcher();
  try {
    for (const beat of beats) {
      if (_cancelled) break;
      beat.enter?.();
      if (beat.actor !== undefined) _actor = beat.actor;
      if (beat.actor !== undefined || beat.repaint) _repaint();
      await _hold(beat.hold ?? BEAT_HOLD_MS);
      beat.exit?.();
    }
  } catch (error) {
    console.error('[onboarding] scene failed:', error);
  } finally {
    _running = false;
    _advance = null;
    clearTimeout(_timer);
    _unmountCatcher();
    if (_cancelled) { _actor = null; _repaint(); }
    // Rendre le verrou exactement dans le cas où on l'a pris : le laisser
    // traîner bloquerait toute autre surface narrative pour la session, et
    // le rendre alors qu'il est hérité couperait la scène de l'appelant.
    if (!inherited) releaseStoryLock(LOCK_OWNER);
  }
  return !_cancelled;
}

function _giovanni(bubble, cls = '') {
  return { name: 'Giovanni', bubble, cls, spriteUrl: _spriteUrl('giovanni'), icon: '💼' };
}

function _grunt(bubble, cls = '') {
  return {
    name: _t('Sbire Rocket', 'Rocket Grunt'),
    bubble, cls, hostile: true, icon: '💬',
    spriteUrl: _spriteUrl(_gruntSpriteKey()),
  };
}

// ── Scènes ────────────────────────────────────────────────────────
/**
 * Les sbires entrent en scène. Ils ne sont pas un acteur de cinématique mais
 * le vrai spawn de raid — c'est lui que le joueur devra cliquer juste après —
 * donc ce beat anime l'élément de spawn au lieu de poser un acteur.
 */
export function playAmbushArrival() {
  const spawnEl = () => _viewport()?.querySelector(AMBUSH_SPAWN_SELECTOR) ?? null;
  return _play([
    {
      hold: MOVE_HOLD_MS,
      enter: () => spawnEl()?.classList.add('onboarding-arriving'),
      exit: () => spawnEl()?.classList.remove('onboarding-arriving'),
    },
    // La bulle d'intro vit sur le spawn (spawn.bubble) et reste affichée après
    // la scène : c'est l'invitation au combat, elle doit survivre au clic.
    { hold: BEAT_HOLD_MS },
  ]);
}

/**
 * L'après-embuscade : les sbires ont le dernier mot, puis Giovanni arrive et
 * enchaîne ses répliques. L'écran d'identité ne s'ouvre qu'au retour de cette
 * promesse — d'où le fait que l'appelant garde le verrou.
 */
export function playGiovanniArrival({ won = false } = {}) {
  const aftermath = _line(won ? ONBOARDING_AMBUSH_LINES.won : ONBOARDING_AMBUSH_LINES.lost);
  const arrival = _line(won ? ONBOARDING_GIOVANNI_LINES.arrivalWon : ONBOARDING_GIOVANNI_LINES.arrival);
  return _play([
    { actor: _grunt(aftermath) },
    { actor: _giovanni(arrival, 'scene-arrive') },
    { actor: _giovanni(_line(ONBOARDING_GIOVANNI_LINES.claim)) },
    { actor: _giovanni(_line(ONBOARDING_GIOVANNI_LINES.offer)) },
    // Terrain rendu avant l'ouverture de l'écran d'identité.
    { actor: null, hold: 250 },
  ]);
}

/**
 * Giovanni repart. Le sbire qui reste planté là n'est pas joué ici : c'est le
 * transfuge, rendu par onboardingGuide dès que la scène rend le terrain.
 */
export function playGiovanniDeparture() {
  return _play([
    { actor: _giovanni(_line(ONBOARDING_GIOVANNI_LINES.farewell)) },
    { actor: _giovanni('', 'scene-leave'), hold: MOVE_HOLD_MS },
    { actor: null, hold: 200 },
  ]);
}

/** Coupe une scène en cours (changement de slot, abandon de l'onboarding). */
export function cancelOnboardingScene() {
  if (!_running) return false;
  _cancelled = true;
  _advance?.();
  return true;
}

Object.assign(globalThis, {
  getOnboardingSceneEncounterForZone,
  advanceOnboardingScene,
});
