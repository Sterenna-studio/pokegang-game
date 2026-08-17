'use strict';

// ════════════════════════════════════════════════════════════════
//  tabUnlocks.js — déblocage progressif des onglets après l'onboarding
//
//  Applique les règles de data/tab-unlocks-data.js (qui porte l'ordre, les
//  seuils et leur justification) : compteurs de progression, évaluation et
//  annonce. La logique est pure et testable ; le rendu de la barre d'onglets
//  et la carte « nouvel onglet » vivent dans modules/ui/tabRouter.js.
//
//  Dépendances globalThis : state (via getState injecté), saveState
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';
import {
  BASE_TABS,
  TAB_UNLOCK_COPY,
  TAB_UNLOCK_RULES,
  UNLOCKABLE_TABS,
} from '../../data/tab-unlocks-data.js';
import { ONBOARDING_STEPS, hasReachedStep } from './onboardingFlow.js';

/**
 * L'échelle ne démarre qu'une fois le tunnel TERMINÉ — pas simplement « pas en
 * cours ». Une partie encore à `not_started` (slot vierge, joueur qui n'a pas
 * cliqué « Commencer ») n'est pas active non plus, et se voyait offrir le
 * Marché et le Compte avant même d'avoir capturé quoi que ce soit.
 */
function _funnelDone(state) {
  return !!state && hasReachedStep(state, ONBOARDING_STEPS.COMPLETED);
}

export { BASE_TABS, TAB_UNLOCK_COPY, TAB_UNLOCK_RULES, UNLOCKABLE_TABS };

export function defaultTabDiscovery() {
  return {
    revealedTabs: [],
    capturesSinceOnboarding: 0,
    agentOperations: 0,
    sessionsSinceOnboarding: 0,
  };
}

export function normalizeTabDiscovery(value) {
  const base = defaultTabDiscovery();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  const revealed = Array.isArray(value.revealedTabs)
    ? value.revealedTabs.filter(tab => UNLOCKABLE_TABS.includes(tab))
    : base.revealedTabs;
  const counter = key => Math.max(0, Math.floor(Number(value[key]) || 0));
  return {
    revealedTabs: [...new Set(revealed)],
    capturesSinceOnboarding: counter('capturesSinceOnboarding'),
    agentOperations: counter('agentOperations'),
    sessionsSinceOnboarding: counter('sessionsSinceOnboarding'),
  };
}

/**
 * Un onglet est-il accessible ? Tout ce qui n'est pas déblocable l'est
 * toujours — la liste des règles est la seule source de restriction, donc un
 * nouvel onglet ajouté à l'app reste visible tant qu'on ne l'y inscrit pas.
 */
export function isTabRevealed(state, tabId) {
  if (!UNLOCKABLE_TABS.includes(tabId)) return true;
  return normalizeTabDiscovery(state?.discoveryProgress).revealedTabs.includes(tabId);
}

function _ruleMet(rule, state, discovery) {
  switch (rule.rule) {
    case 'onboarding': return _funnelDone(state);
    case 'captures':   return discovery.capturesSinceOnboarding >= rule.threshold;
    case 'agentOps':   return discovery.agentOperations >= rule.threshold;
    case 'reputation': return (state?.gang?.reputation ?? 0) >= rule.threshold;
    case 'sessions':   return discovery.sessionsSinceOnboarding >= rule.threshold;
    // Déblocage narratif : un booléen quelconque de discoveryProgress plutôt
    // qu'un seuil numérique — ex. tabPokedex/rivalPokedexUnlocked, posé par
    // modules/ui/rivalEncounterPopup.js à l'issue de sa scène.
    case 'flag':       return !!state?.discoveryProgress?.[rule.flag];
    default:           return false;
  }
}

/**
 * Onglets qui devraient être ouverts et ne le sont pas encore. Pur : ne
 * touche pas à `state`, pour que l'appelant décide quand committer.
 */
export function evaluateTabUnlocks(state) {
  // Pendant le tunnel, getOnboardingTabAccess reste seul maître à bord : lui
  // superposer ces règles ferait apparaître des onglets qu'il vient de cacher.
  if (!_funnelDone(state)) return [];
  const discovery = normalizeTabDiscovery(state.discoveryProgress);
  return TAB_UNLOCK_RULES
    .filter(rule => !discovery.revealedTabs.includes(rule.tab) && _ruleMet(rule, state, discovery))
    .map(rule => rule.tab);
}

function _writeDiscovery(state, patch) {
  if (!state) return null;
  const current = normalizeTabDiscovery(state.discoveryProgress);
  const next = { ...current, ...patch };
  state.discoveryProgress = { ...(state.discoveryProgress || {}), ...next };
  return next;
}

export function revealTabs(state, tabs) {
  const wanted = (tabs || []).filter(tab => UNLOCKABLE_TABS.includes(tab));
  if (!state || !wanted.length) return [];
  const current = normalizeTabDiscovery(state.discoveryProgress);
  const added = wanted.filter(tab => !current.revealedTabs.includes(tab));
  if (!added.length) return [];
  _writeDiscovery(state, { revealedTabs: [...current.revealedTabs, ...added] });
  return added;
}

/** Ouvre tout d'un coup — reprise d'une save antérieure à ce système. */
export function revealAllTabs(state) {
  return revealTabs(state, UNLOCKABLE_TABS);
}

// ── Compteurs ─────────────────────────────────────────────────────
export function recordDiscoveryCapture(state, { byAgent = false } = {}) {
  if (!_funnelDone(state)) return null;
  const current = normalizeTabDiscovery(state.discoveryProgress);
  return _writeDiscovery(state, {
    capturesSinceOnboarding: current.capturesSinceOnboarding + 1,
    agentOperations: current.agentOperations + (byAgent ? 1 : 0),
  });
}

export function recordDiscoveryAgentOperation(state) {
  if (!_funnelDone(state)) return null;
  const current = normalizeTabDiscovery(state.discoveryProgress);
  return _writeDiscovery(state, { agentOperations: current.agentOperations + 1 });
}

/**
 * Une session de plus après celle qui a terminé le tunnel. Appelé une fois
 * au boot : c'est ce qui fait apparaître l'onglet Compte au retour du joueur,
 * au moment où « sauvegarder ma progression » veut enfin dire quelque chose.
 */
export function recordDiscoverySession(state) {
  if (!_funnelDone(state)) return null;
  const current = normalizeTabDiscovery(state.discoveryProgress);
  return _writeDiscovery(state, { sessionsSinceOnboarding: current.sessionsSinceOnboarding + 1 });
}

// ── Application ───────────────────────────────────────────────────
let _ctx = {};
let _bound = false;

export function configureTabUnlocks(ctx = {}) {
  _ctx = { ..._ctx, ...ctx };
  _bindTabUnlockEvents();
}

const _state = () => _ctx.getState?.() ?? globalThis.state;

/** Évalue, committe et annonce. Renvoie les onglets nouvellement ouverts. */
export function checkTabUnlocks() {
  const state = _state();
  const pending = evaluateTabUnlocks(state);
  if (!pending.length) return [];
  const revealed = revealTabs(state, pending);
  if (!revealed.length) return [];
  _ctx.saveState?.();
  EventBus.emit(EVENTS.TABS_REVEALED, { tabs: revealed });
  return revealed;
}

function _bindTabUnlockEvents() {
  if (_bound) return;
  _bound = true;

  EventBus.on(EVENTS.POKEMON_CAPTURED, ({ agentId } = {}) => {
    recordDiscoveryCapture(_state(), { byAgent: !!agentId });
    checkTabUnlocks();
  });

  // Une victoire menée par un agent compte comme une opération : c'est
  // exactement ce que l'onglet Événements donne à lire.
  EventBus.on(EVENTS.COMBAT_WON, ({ mode, initiatedBy } = {}) => {
    if (mode === 'agent' || initiatedBy === 'agent') recordDiscoveryAgentOperation(_state());
    checkTabUnlocks();
  });

  EventBus.on(EVENTS.REP_CHANGED, () => { checkTabUnlocks(); });
  EventBus.on(EVENTS.ONBOARDING_COMPLETED, () => { checkTabUnlocks(); });
}

Object.assign(globalThis, { checkTabUnlocks, isTabRevealed });
