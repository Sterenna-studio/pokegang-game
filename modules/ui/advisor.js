'use strict';

// ════════════════════════════════════════════════════════════════
//  advisor.js — le transfuge reste à l'écran comme conseiller
//
//  À la fin du tunnel, le transfuge disparaissait avec le terrain de départ
//  et la narration s'arrêtait net. Il revient ici en bas de l'écran : un
//  « ! » s'allume quand l'objectif change, un clic ouvre sa bulle.
//
//  Trois règles de conception :
//  - il ne parle QUE hors onboarding (pendant le tunnel il est sur le
//    terrain, via onboardingGuide.js — deux surfaces pour le même
//    personnage se contrediraient) ;
//  - il ne s'ouvre jamais tout seul : le « ! » attire, le joueur décide ;
//  - il n'existe pas sans agent à incarner (save vierge, agent supprimé).
//
//  Dépendances globalThis : state, saveState, getNextObjective,
//    trainerSprite, switchTab
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';
import { esc } from '../core/escape.js';
import {
  ADVISOR_COPY,
  ADVISOR_FALLBACK,
  ADVISOR_IDLE,
  ADVISOR_LINES,
} from '../../data/advisor-data.js';
import { isOnboardingActive, normalizeOnboardingState } from '../systems/onboardingFlow.js';

const ROOT_ID = 'gangAdvisor';

let _ctx = {};
let _open = false;
// Y avait-il du neuf AU MOMENT de l'ouverture ? Ouvrir marque l'objectif comme
// lu, donc sans mémoriser l'état d'avant, le rendu qui suit le clic croit que
// le joueur a déjà tout entendu et sert la réplique « rien de neuf » à la
// place du conseil — précisément ce qu'il venait cliquer pour lire.
let _openedWithNews = false;

export function configureAdvisor(ctx = {}) {
  _ctx = { ..._ctx, ...ctx };
}

const _state = () => _ctx.getState?.() ?? globalThis.state;
const _pick = (entry, state) => (state?.lang === 'en' ? entry.en : entry.fr);

/**
 * Le conseiller EST le transfuge recruté pendant le tunnel. Les saves
 * antérieures à l'onboarding V2 n'en ont jamais eu : on retombe sur le
 * premier agent recruté, pour qu'elles aient elles aussi une voix plutôt
 * qu'un HUD muet.
 */
function _advisorAgent(state) {
  const agents = state?.agents;
  if (!Array.isArray(agents) || !agents.length) return null;
  const guideId = normalizeOnboardingState(state?.onboarding).guideAgentId;
  return (guideId && agents.find(agent => agent.id === guideId)) || agents[0];
}

function _spriteUrl(agent) {
  const sprite = agent?.sprite;
  // Même tolérance que onboardingGuide : `sprite` porte une URL, mais les
  // saves de la préversion ont pu y écrire une clé nue.
  if (typeof sprite === 'string' && /^(https?:|data:|\/)/.test(sprite)) return sprite;
  const key = sprite || agent?.spriteKey || 'rocketgrunt';
  return globalThis.trainerSprite?.(key)
    || `https://play.pokemonshowdown.com/sprites/trainers/${key}.png`;
}

/** Objectif courant + réplique associée. Pur : sert aussi aux tests. */
export function getAdvisorMessage(state) {
  const objective = _ctx.getNextObjective?.() ?? globalThis.getNextObjective?.();
  if (!objective?.id) return null;
  // `unlock_zone:route22` → ligne générique `unlock_zone`, nom injecté.
  const baseId = objective.id.split(':')[0];
  const entry = ADVISOR_LINES[baseId] || ADVISOR_FALLBACK;
  const line = _pick(entry, state).replace('{zone}', objective.zoneName || '');
  return { id: objective.id, line, tab: objective.tab || null };
}

export function isAdvisorVisible(state) {
  // Pendant le tunnel il tient déjà le terrain : pas de doublon.
  if (!state || isOnboardingActive(state)) return false;
  if (!state.gang?.initialized) return false;
  return !!_advisorAgent(state);
}

/** A-t-il du neuf à dire, c'est-à-dire un objectif jamais commenté ? */
export function hasUnseenAdvice(state) {
  if (!isAdvisorVisible(state)) return false;
  const message = getAdvisorMessage(state);
  if (!message) return false;
  return state.discoveryProgress?.advisorLastSeen !== message.id;
}

function _markSeen(state, id) {
  if (!state) return;
  if (!state.discoveryProgress) state.discoveryProgress = {};
  if (state.discoveryProgress.advisorLastSeen === id) return;
  state.discoveryProgress.advisorLastSeen = id;
  _ctx.saveState?.();
}

// ── Rendu ─────────────────────────────────────────────────────────
function _root() {
  return document.getElementById(ROOT_ID);
}

function _ensureRoot() {
  let root = _root();
  if (root) return root;
  root = document.createElement('div');
  root.id = ROOT_ID;
  document.body.appendChild(root);
  return root;
}

export function renderAdvisor() {
  const state = _state();
  if (!isAdvisorVisible(state)) {
    _root()?.remove();
    _open = false;
    return false;
  }
  const agent = _advisorAgent(state);
  const message = getAdvisorMessage(state);
  if (!message) { _root()?.remove(); _open = false; return false; }

  const root = _ensureRoot();
  const unseen = hasUnseenAdvice(state);
  const title = _pick(ADVISOR_COPY.title, state);
  const dismiss = _pick(ADVISOR_COPY.dismiss, state);
  // Sollicité sans rien de neuf, il le dit plutôt que de répéter la consigne.
  const spoken = _open && !_openedWithNews ? _pick(ADVISOR_IDLE, state) : message.line;

  root.className = _open ? 'advisor-open' : '';
  root.innerHTML = `
    ${_open ? `<div class="advisor-bubble" role="dialog" aria-label="${esc(title)}">
      <div class="advisor-bubble-name">${esc(agent.name || title)}</div>
      <div class="advisor-bubble-text">${esc(spoken)}</div>
      <div class="advisor-bubble-actions">
        ${message.tab ? `<button type="button" class="advisor-btn advisor-btn-go" data-advisor-tab="${esc(message.tab)}">→</button>` : ''}
        <button type="button" class="advisor-btn advisor-btn-ghost" data-advisor-close>${esc(dismiss)}</button>
      </div>
    </div>` : ''}
    <button type="button" class="advisor-avatar${unseen ? ' has-news' : ''}"
      data-advisor-toggle aria-label="${esc(title)}" title="${esc(title)}">
      <img src="${_spriteUrl(agent)}" alt="" onerror="this.style.visibility='hidden'">
      ${unseen ? '<span class="advisor-badge" aria-hidden="true">!</span>' : ''}
    </button>`;

  root.querySelector('[data-advisor-toggle]')?.addEventListener('click', () => {
    if (_open) {
      _open = false;
    } else {
      // Lire l'état AVANT de le modifier, puis marquer : ouvrir vaut lecture,
      // donc le « ! » s'éteint pour cet objectif.
      _openedWithNews = hasUnseenAdvice(_state());
      _markSeen(_state(), message.id);
      _open = true;
    }
    renderAdvisor();
  });
  root.querySelector('[data-advisor-close]')?.addEventListener('click', () => {
    _open = false;
    renderAdvisor();
  });
  root.querySelector('[data-advisor-tab]')?.addEventListener('click', event => {
    _open = false;
    globalThis.switchTab?.(event.currentTarget.dataset.advisorTab);
    renderAdvisor();
  });
  return true;
}

/** Referme la bulle sans marquer quoi que ce soit (changement d'écran). */
export function closeAdvisor() {
  if (!_open) return false;
  _open = false;
  renderAdvisor();
  return true;
}

let _bound = false;
function _bindAdvisorEvents() {
  if (_bound) return;
  _bound = true;
  // Les événements qui peuvent faire basculer l'objectif courant. Le rendu
  // est idempotent et ne rouvre jamais la bulle tout seul, donc un
  // rafraîchissement de trop est sans conséquence.
  const refresh = () => { renderAdvisor(); };
  EventBus.on(EVENTS.POKEMON_CAPTURED,   refresh);
  EventBus.on(EVENTS.TEAM_MEMBER_SET,    refresh);
  EventBus.on(EVENTS.AGENT_RECRUITED,    refresh);
  EventBus.on(EVENTS.AGENT_ASSIGNED,     refresh);
  EventBus.on(EVENTS.REP_CHANGED,        refresh);
  EventBus.on(EVENTS.ONBOARDING_COMPLETED, refresh);
  EventBus.on(EVENTS.TABS_REVEALED,      refresh);
}

export function initAdvisor(ctx = {}) {
  configureAdvisor(ctx);
  _bindAdvisorEvents();
  renderAdvisor();
}

Object.assign(globalThis, { renderAdvisor, closeAdvisor });
