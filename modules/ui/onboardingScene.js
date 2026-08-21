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
//  Rythme : un beat avec réplique se tape à la machine à écrire (comme les
//  jeux Pokémon d'origine) et n'avance JAMAIS tout seul — un premier clic
//  termine la ligne instantanément si elle est encore en cours de frappe, un
//  second clic passe au beat suivant. Aucun texte ne défile sans que le
//  joueur l'ait demandé. Un beat muet (entrée/sortie de scène, sans
//  réplique) garde lui un délai chronométré : il n'y a rien à lire, le faire
//  attendre un clic serait juste une invite vide. Le capteur de clic couvre
//  le viewport pendant toute la scène, ce qui neutralise aussi le gameplay
//  derrière.
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

/** Beat muet (entrée/sortie de scène) — juste le temps de l'animation. */
const MOVE_HOLD_MS = 700;
/** Durée d'un beat sans réplique et sans animation propre (silence, pause). */
const PAUSE_HOLD_MS = 3_400;
/** Cadence de la machine à écrire — même valeur que modules/ui/intro.js. */
const TYPE_SPEED_MS = 22;

let _ctx = {};
let _actor = null;
let _running = false;
let _cancelled = false;
let _advance = null;      // clic du joueur — termine la frappe, ou avance
let _forceResolve = null; // résout le beat courant sans condition (annulation)
let _pendingAdvance = false; // clic arrivé entre deux beats, le temps qu'un microtask retende _advance
let _timer = 0;
let _typeTimer = 0;
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

function _bubbleEl() {
  return _viewport()?.querySelector('.zone-quest-encounter .zone-speech-bubble') ?? null;
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

// ── Renforts de l'embuscade ───────────────────────────────────────
// L'acteur de scène est unique (un seul .zone-quest-encounter) : pour montrer
// la bande qui encercle le joueur, on pose des sprites décoratifs
// supplémentaires dans le viewport, échelonnés, sans passer par le moteur de
// beats. Ils ne sont jamais cliquables — le capteur de scène est au-dessus.
const BACKUP_CLASS = 'onboarding-backup-grunt';

function _mountBackupGrunts(keys) {
  const viewport = _viewport();
  if (!viewport) return;
  _unmountBackupGrunts();
  keys.forEach((key, i) => {
    const el = document.createElement('img');
    el.className = BACKUP_CLASS;
    el.src = _spriteUrl(key);
    el.alt = '';
    // Répartis vers la droite du terrain, l'acteur occupant déjà la gauche.
    el.style.left = `${38 + i * 17}%`;
    el.style.animationDelay = `${i * 180}ms`;
    el.onerror = function () { this.style.visibility = 'hidden'; };
    viewport.appendChild(el);
  });
}

function _unmountBackupGrunts() {
  // Scopé au viewport : c'est le seul endroit où ils sont posés, et ça évite
  // de dépendre d'un document complet (le harnais de test n'en stubbe qu'une
  // partie).
  _viewport()?.querySelectorAll(`.${BACKUP_CLASS}`).forEach(el => el.remove());
}

// ── Moteur de beats ───────────────────────────────────────────────
export function isOnboardingSceneRunning() {
  return _running;
}

/**
 * Passe au beat suivant. Renvoie false si aucune scène n'attend.
 *
 * Entre le moment où un beat résout sa promesse (_advance mis à null) et
 * celui où le beat suivant repose ses propres handlers, il s'écoule au moins
 * un microtask (l'await de _play) — un clic tombant pile dans cette fenêtre
 * serait sinon silencieusement perdu. On le mémorise plutôt et _armAdvance
 * le rejoue dès que le prochain handler est prêt.
 */
export function advanceOnboardingScene() {
  if (!_running) return false;
  if (_advance) _advance();
  else _pendingAdvance = true;
  return true;
}

/** Pose les handlers du beat courant ; rejoue un clic resté en attente. */
function _armAdvance(advanceFn, forceFn) {
  _advance = advanceFn;
  _forceResolve = forceFn;
  if (_pendingAdvance) {
    _pendingAdvance = false;
    _advance();
  }
}

/** Beat muet : chronométré, un clic le termine en avance. Rien à lire. */
function _hold(ms) {
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(_timer);
      _timer = 0;
      _advance = null;
      _forceResolve = null;
      resolve();
    };
    _timer = setTimeout(finish, ms);
    _armAdvance(finish, finish);
  });
}

/**
 * Beat avec réplique : machine à écrire, aucun délai automatique. Premier
 * clic pendant la frappe → termine la ligne instantanément. Clic une fois la
 * ligne complète → passe au beat suivant. Sans clic, la scène attend
 * indéfiniment — comme les jeux d'origine, jamais de texte qui défile seul.
 */
function _typeAndWait(beat) {
  return new Promise(resolve => {
    const el = _bubbleEl();
    const fullText = beat.actor?.bubble || '';
    if (!el || !fullText) {
      // Rien à taper (bulle vide ou pas encore montée) : comportement de
      // repli identique à un beat muet plutôt que d'attendre un clic sur rien.
      _hold(beat.hold ?? PAUSE_HOLD_MS).then(resolve);
      return;
    }
    el.textContent = '';
    let i = 0;
    let typing = true;

    const finishTyping = () => {
      clearInterval(_typeTimer);
      _typeTimer = 0;
      el.textContent = fullText;
      typing = false;
    };
    const finish = () => {
      clearInterval(_typeTimer);
      _typeTimer = 0;
      _advance = null;
      _forceResolve = null;
      resolve();
    };
    _typeTimer = setInterval(() => {
      el.textContent += fullText[i++];
      if (i >= fullText.length) finishTyping();
    }, TYPE_SPEED_MS);
    _armAdvance(() => { if (typing) finishTyping(); else finish(); }, finish);
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
  _pendingAdvance = false;
  _mountCatcher();
  try {
    for (const beat of beats) {
      if (_cancelled) break;
      beat.enter?.();
      if (beat.actor !== undefined) {
        // Même personnage plantant dans la même pose (nom + classe CSS) que le
        // beat précédent, qui a déjà une bulle montée : on laisse _typeAndWait
        // retaper la bulle existante plutôt que de démonter/remonter tout
        // .zone-quest-encounter. Sans ça, `float` repart de zéro à chaque
        // beat (nouveau nœud DOM = animation relancée) et le sprite semble
        // sursauter/réapparaître à chaque réplique enchaînée (ex. les trois
        // lignes de Giovanni : arrivée, revendication, offre).
        const chained = !!_actor && beat.actor
          && beat.actor.name === _actor.name
          && (beat.actor.cls || '') === (_actor.cls || '')
          && !!_bubbleEl();
        _actor = beat.actor;
        if (!chained) _repaint();
      } else if (beat.repaint) {
        _repaint();
      }
      // Une réplique se tape et attend un clic ; un beat muet reste
      // chronométré — rien n'y défile puisqu'il n'y a rien à y lire.
      if (beat.actor?.bubble) await _typeAndWait(beat);
      else await _hold(beat.hold ?? PAUSE_HOLD_MS);
      beat.exit?.();
    }
  } catch (error) {
    console.error('[onboarding] scene failed:', error);
  } finally {
    _running = false;
    _advance = null;
    _forceResolve = null;
    _pendingAdvance = false;
    clearTimeout(_timer);
    clearInterval(_typeTimer);
    _timer = 0;
    _typeTimer = 0;
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
    // la scène : c'est l'invitation au combat, elle doit survivre au clic. Ce
    // n'est pas un beat de _play (le spawn n'est pas un `actor`), donc pas de
    // machine à écrire ici — juste la pause avant que le raid soit cliquable.
    { hold: PAUSE_HOLD_MS },
  ]);
}

/**
 * L'embuscade elle-même, entièrement scénarisée : le joueur sort son premier
 * Pokémon, le sbire s'en moque, la bande le rejoint et l'issue est écrite —
 * il se fait prendre. Remplace le vrai combat qui se jouait ici : la défaite
 * était de toute façon l'issue attendue (une équipe de première session contre
 * six Pokémon), mais elle passait par le moteur de combat, avec ses aléas et
 * son rythme mal adapté à un moment narratif.
 *
 * Le sbire qui parle est celui dont le sprite sera proposé juste après comme
 * transfuge : c'est volontairement la même tête.
 */
export function playScriptedAmbush({ starterSpeciesEn = '', starterShiny = false } = {}) {
  const starterSprite = globalThis.pokeSprite?.(starterSpeciesEn, starterShiny) || '';
  const starterName = globalThis.speciesName?.(starterSpeciesEn) || starterSpeciesEn || '';
  // Des sbires « classiques » pour les renforts, distincts de la tête qui parle.
  const speakerKey = _gruntSpriteKey();
  const backupKeys = ['rocketgrunt', 'rocketgruntf', 'rocketgrunt']
    .filter(k => k !== speakerKey)
    .slice(0, 2);

  return _play([
    // Le joueur envoie son Pokémon : il entre seul, en silence.
    {
      actor: {
        name: starterName,
        bubble: '',
        cls: 'scene-arrive',
        icon: '⚔',
        spriteUrl: starterSprite,
      },
      hold: MOVE_HOLD_MS,
    },
    // Le sbire se moque du geste.
    { actor: _grunt(_line(ONBOARDING_AMBUSH_LINES.taunt)) },
    // La bande arrive — beat muet, le temps que les sprites entrent.
    {
      actor: _grunt(''),
      hold: MOVE_HOLD_MS + 400,
      enter: () => _mountBackupGrunts(backupKeys),
    },
  ]).finally(() => _unmountBackupGrunts());
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
    // Il entre EN SILENCE d'abord (bulle vide → aucun nœud .zone-speech-bubble
    // rendu, cf. _questEncounterHtml) : le texte n'apparaît qu'une fois le
    // sprite immobile, jamais pendant qu'il glisse encore. Une temporisation
    // CSS (opacity + animation-delay) avait été tentée mais ne survit pas au
    // rafraîchissement périodique du timer de zone (1s, updateZoneTimers) qui
    // reconstruit .zone-quest-encounter et relance l'animation à chaque tick —
    // un beat muet séparé, comme scene-leave plus bas, est robuste à ça.
    { actor: _giovanni('', 'scene-arrive'), hold: MOVE_HOLD_MS },
    { actor: _giovanni(arrival) },
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
  // Les renforts sont posés hors du moteur de beats : le `finally` de
  // playScriptedAmbush les retire au retour normal, mais une annulation qui
  // n'attend pas la promesse les laisserait plantés sur le terrain.
  _unmountBackupGrunts();
  if (!_running) return false;
  _cancelled = true;
  // _forceResolve, pas _advance : en pleine frappe, _advance() ne ferait que
  // terminer la ligne (comportement clic normal) sans jamais résoudre le
  // beat — l'annulation doit sauter par-dessus, pas se comporter comme un clic.
  _forceResolve?.();
  return true;
}

Object.assign(globalThis, {
  getOnboardingSceneEncounterForZone,
  advanceOnboardingScene,
});
