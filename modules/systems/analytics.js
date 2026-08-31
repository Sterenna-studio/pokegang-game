'use strict';

// ════════════════════════════════════════════════════════════════
//  ANALYTICS — GA4 gameplay event tracking
//
//  gtag.js itself is loaded as a classic <script> in index.html (the
//  measurement ID is public, not a secret, so the exact same snippet
//  ships on the main site AND the itch.io build — no config.js
//  dependency, unlike Supabase). This module only decides WHEN to
//  call the global gtag() function, and tags every event with
//  `platform` (web/itch/dev) so both populations land in one GA4
//  property and can be compared/filtered.
//
//  `runtime_context` adds a deliberately low-cardinality second axis so dev
//  previews can be separated from localhost without sending raw hostnames.
//
//  The generic first_capture milestone is gated on persisted lifetime stats.
//  Onboarding-specific funnel events (including first_battle_won) are emitted
//  by the V2 controller, which persists each transition before tracking it.
//
//  Dépendances globalThis : state, gtag (posé par index.html)
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';
import { suppressSimulationAnalytics } from '../core/simulationContext.js';
import { GAME_VERSION } from '../../state/defaultState.js';

// Exportée : modules/ui/hub.js s'en sert aussi pour gater le démarrage
// automatique d'une première partie sur itch (voir shouldAutoStartFirstGame).
export function detectPlatform() {
  const h = location.hostname;
  if (h.endsWith('.itch.io') || h.includes('itch.zone') || h.endsWith('.hwcdn.st')) return 'itch';
  if (h === 'pokegang.sterenna.fr') return 'web';
  return 'dev';
}

/**
 * Contexte de distribution stable et volontairement peu cardinal.
 * Ne jamais remplacer ceci par location.hostname dans GA4 : le but est de
 * pouvoir comparer itch / site public / lab / local sans collection inutile.
 */
export function detectRuntimeContext() {
  const h = location.hostname.toLowerCase();
  if (h.endsWith('.itch.io') || h.includes('itch.zone') || h.endsWith('.hwcdn.st')) return 'itch';
  if (h === 'pokegang.sterenna.fr') return 'public_site';
  if (h === 'lab.sterenna.fr') return 'lab';
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return 'localhost';
  return 'other_dev';
}

const _platform = detectPlatform();
const _runtimeContext = detectRuntimeContext();

// ── Testeur interne ───────────────────────────────────────────────
// `platform` isole déjà localhost, mais PAS nos propres parties jouées sur la
// vraie build web/itch : elles se confondent avec celles des joueurs. D'où ce
// marqueur volontaire, posé une fois par navigateur et renvoyé sur CHAQUE
// événement, pour pouvoir exclure ce trafic dans GA4 (et lever l'ambiguïté du
// genre « cette ville, c'est probablement nous »).
//
// Activation : ajouter ?internalTester=1 à l'URL (persisté ensuite), ou poser
// localStorage['pg.internalTester'] = '1' à la main. ?internalTester=0 lève le
// marqueur. Rien n'est envoyé de plus qu'un booléen.
const INTERNAL_TESTER_KEY = 'pg.internalTester';

function _readInternalTester() {
  try {
    const param = new URLSearchParams(location.search).get('internalTester');
    if (param === '1' || param === 'true') localStorage.setItem(INTERNAL_TESTER_KEY, '1');
    else if (param === '0' || param === 'false') localStorage.removeItem(INTERNAL_TESTER_KEY);
    return localStorage.getItem(INTERNAL_TESTER_KEY) === '1';
  } catch {
    return false; // storage indisponible (itch en mode restreint, navigation privée)
  }
}
let _internalTester = _readInternalTester();

/** Bascule le marqueur depuis la console : `pgSetInternalTester(true)`. */
function setInternalTester(on) {
  try {
    if (on) localStorage.setItem(INTERNAL_TESTER_KEY, '1');
    else localStorage.removeItem(INTERNAL_TESTER_KEY);
  } catch { /* stockage indisponible — le marqueur ne survivra pas au reload */ }
  _internalTester = !!on;
  return _internalTester;
}

// ── Identifiant de partie ─────────────────────────────────────────
// Le slot ne suffit pas : il est réutilisé d'une partie à l'autre. Cet id est
// propre à UNE partie, persiste dans la save et permet de recoller les
// événements d'une même partie après un rechargement, sans dépendre du seul
// client ID GA (qui saute au changement de navigateur ou au vidage du cache).
// Pseudonyme par construction : tirage aléatoire, aucune donnée personnelle.
//
// Créé à la volée s'il manque — une save antérieure à ce champ en obtient un
// stable dès son premier chargement, plutôt que de rester non identifiable.
function _gameInstanceId() {
  const state = globalThis.state;
  if (!state) return null;
  if (!state.gameInstanceId) {
    state.gameInstanceId = `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    globalThis.markDirty?.();
  }
  return state.gameInstanceId;
}

function trackEvent(name, params = {}) {
  if (typeof globalThis.gtag !== 'function') return;
  try {
    globalThis.gtag('event', name, {
      platform: _platform,
      runtime_context: _runtimeContext,
      game_version: GAME_VERSION,
      internal_tester: _internalTester,
      game_instance_id: _gameInstanceId(),
      slot: globalThis.activeSaveSlot ?? 0,
      ...params,
    });
  } catch (err) {
    console.warn('[Analytics] trackEvent failed:', name, err);
  }
}

// ── Cycle de vie du runtime ───────────────────────────────────────
// `game_loaded` part pendant boot() dans app.js. Ce second jalon n'est émis
// qu'après l'événement window.load : il prouve que le runtime a atteint une
// surface jouable complète, ce qui permet de séparer une visite itch d'un vrai
// lancement de la build sans dépendre du trafic de la page parente.
let _playStartedTracked = false;
function _trackPlayStarted() {
  if (_playStartedTracked) return;
  _playStartedTracked = true;
  const state = globalThis.state;
  trackEvent('play_started', {
    save_state: state?.gang?.initialized ? 'existing' : 'new',
  });
}

if (typeof window !== 'undefined') {
  const schedulePlayStarted = () => {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => _trackPlayStarted());
    } else {
      setTimeout(() => _trackPlayStarted(), 0);
    }
  };
  if (document.readyState === 'complete') schedulePlayStarted();
  else window.addEventListener('load', schedulePlayStarted, { once: true });
}

// ── Captures ───────────────────────────────────────────────────────
// `source` dit QUI a capturé. Sans lui, 500 captures peuvent aussi bien
// signifier beaucoup de jeu actif que de l'automatisation qui tourne seule —
// deux situations produit radicalement différentes.
//
// Valeurs posées par les émetteurs : manual | agent | background | onboarding
// | quest | chest | event | hatch | starter | cheat. `unknown` signale un
// chemin d'émission non annoté, à corriger côté émetteur plutôt qu'ici.
EventBus.on(EVENTS.POKEMON_CAPTURED, ({ pokemon, zoneId, source, agentId, spawnCtx } = {}) => {
  if (suppressSimulationAnalytics()) return;
  const state = globalThis.state;
  const resolved = source
    // Repli : l'embuscade et le terrain d'intro portent déjà ce contexte.
    ?? (spawnCtx?.onboarding ? 'onboarding' : null)
    ?? (agentId ? 'agent' : null)
    ?? 'unknown';
  trackEvent('pokemon_captured', {
    species: pokemon?.species_en ?? null,
    shiny:   !!pokemon?.shiny,
    zone:    zoneId ?? null,
    capture_source: resolved,
  });
  if (state?.stats?.totalCaught === 1) {
    trackEvent('first_capture', {
      species: pokemon?.species_en ?? null,
      capture_source: resolved,
    });
  }
});

EventBus.on(EVENTS.POKEMON_SOLD, ({ pokemonIds, totalPrice } = {}) => {
  if (suppressSimulationAnalytics()) return;
  trackEvent('pokemon_sold', {
    count: Array.isArray(pokemonIds) ? pokemonIds.length : 0,
    total_price: totalPrice ?? 0,
  });
});

// ── Combat / agents ──────────────────────────────────────────────
// Le contrôleur d'onboarding ne consomme plus ces deux-là depuis que le
// tunnel passe par l'embuscade et le transfuge, mais ils restent des signaux
// utiles hors première session — et check-events exige que tout emit ait
// un abonné.
EventBus.on(EVENTS.COMBAT_STARTED, ({ zoneId, trainerKey, mode } = {}) => {
  trackEvent('battle_started', {
    zone: zoneId ?? null, trainer: trainerKey ?? null, mode: mode ?? null,
  });
});

EventBus.on(EVENTS.COMBAT_WON, ({ zoneId, trainerKey, elite, mode, initiatedBy } = {}) => {
  if (suppressSimulationAnalytics()) return;
  trackEvent('battle_won', {
    zone: zoneId ?? null, trainer: trainerKey ?? null,
    elite: !!elite, mode: mode ?? null, initiated_by: initiatedBy ?? null,
  });
});

EventBus.on(EVENTS.COMBAT_LOST, ({ zoneId, trainerKey, mode, initiatedBy } = {}) => {
  if (suppressSimulationAnalytics()) return;
  trackEvent('battle_lost', {
    zone: zoneId ?? null, trainer: trainerKey ?? null,
    mode: mode ?? null, initiated_by: initiatedBy ?? null,
  });
});

EventBus.on(EVENTS.AGENT_RECRUITED, ({ source, cost } = {}) => {
  const state = globalThis.state;
  trackEvent('agent_recruited', {
    source: source ?? null, cost: cost ?? 0, total_agents: state?.agents?.length ?? 0,
  });
});

// Les trois gestes qui font passer un agent d'un figurant à une machine à
// ramener des Pokémon. Suivre leur adoption dit si l'automatisation est
// comprise, ou si les agents restent inertes après leur recrutement.
EventBus.on(EVENTS.TEAM_MEMBER_SET, ({ team, agentId, slot, source } = {}) => {
  trackEvent('team_member_set', {
    team: team ?? null,
    has_agent: !!agentId,
    // `team_slot`, pas `slot` : ce dernier est un paramètre global qui porte
    // le slot de SAUVEGARDE, et le réutiliser ici l'écrasait silencieusement.
    team_slot: slot ?? null,
    source: source ?? null,
  });
});

EventBus.on(EVENTS.AGENT_ASSIGNED, ({ zoneId, previousZoneId, source } = {}) => {
  trackEvent('agent_assigned', {
    zone: zoneId ?? null,
    previous_zone: previousZoneId ?? null,
    unassigned: !zoneId,
    source: source ?? null,
  });
});

EventBus.on(EVENTS.AGENT_FLAG_CHANGED, ({ flag, value, source } = {}) => {
  trackEvent('agent_flag_changed', {
    flag: flag ?? null, value: !!value, source: source ?? null,
  });
});

// ── Navigation ───────────────────────────────────────────────────
// Une ligne par onglet et par session, pas par clic : ce qui nous intéresse
// est « ce joueur a-t-il jamais ouvert le Marché / le Pokédex », pas ses
// allers-retours, qui noieraient le signal sous des centaines d'événements.
const _tabsSeen = new Set();
EventBus.on(EVENTS.UI_TAB_CHANGED, ({ tabId } = {}) => {
  if (!tabId || _tabsSeen.has(tabId)) return;
  _tabsSeen.add(tabId);
  trackEvent('tab_first_view', { tab: tabId });
});

EventBus.on(EVENTS.TABS_REVEALED, ({ tabs } = {}) => {
  for (const tab of tabs || []) trackEvent('tab_unlocked', { tab });
});

// ── Erreurs produit ──────────────────────────────────────────────
// Sans ça, un joueur qui disparaît des données est indistinguable d'un joueur
// qui décroche : on ne sait pas si le jeu a cassé sous lui.
EventBus.on(EVENTS.GAME_ERROR, ({ kind, reason, fatal } = {}) => {
  trackEvent(kind || 'game_error', {
    reason: String(reason ?? '').slice(0, 100), // GA4 tronque à 100 caractères
    fatal: !!fatal,
  });
});

// Les exceptions JS qui échappent aux chemins métier doivent elles aussi être
// visibles. On garde uniquement un message tronqué : pas de stack, URL ou
// donnée de save dans GA4.
if (typeof window !== 'undefined') {
  window.addEventListener('error', event => {
    const reason = String(event?.error?.message || event?.message || 'window_error').slice(0, 100);
    trackEvent('runtime_error', { reason, fatal: false, source: 'window_error' });
  });
  window.addEventListener('unhandledrejection', event => {
    const value = event?.reason;
    const reason = String(value instanceof Error ? value.message : (value ?? 'unhandled_rejection')).slice(0, 100);
    trackEvent('runtime_error', { reason, fatal: false, source: 'unhandled_rejection' });
  });
}

// ── Onboarding V2 ────────────────────────────────────────────────
EventBus.on(EVENTS.ONBOARDING_STARTED, ({ version, slotIdx } = {}) => {
  trackEvent('onboarding_started', { onboarding_version: version, slot: slotIdx });
});

EventBus.on(EVENTS.ONBOARDING_STEP_COMPLETED, ({ step, nextStep, secondsSinceNewGame } = {}) => {
  trackEvent('onboarding_step_completed', {
    step,
    next_step: nextStep,
    seconds_since_new_game: secondsSinceNewGame,
  });
});

EventBus.on(EVENTS.ONBOARDING_RESUMED, ({ version, step, secondsSinceNewGame } = {}) => {
  trackEvent('onboarding_resumed', {
    onboarding_version: version,
    step,
    seconds_since_new_game: secondsSinceNewGame,
  });
});

EventBus.on(EVENTS.ONBOARDING_COMPLETED, ({ version, secondsSinceNewGame } = {}) => {
  trackEvent('onboarding_completed', {
    onboarding_version: version,
    seconds_since_new_game: secondsSinceNewGame,
  });
});

EventBus.on(EVENTS.ONBOARDING_FAILED, ({ version, step, reason } = {}) => {
  trackEvent('onboarding_failed', {
    onboarding_version: version,
    step,
    reason,
  });
});

Object.assign(globalThis, { trackEvent, pgSetInternalTester: setInternalTester });
export { setInternalTester };
