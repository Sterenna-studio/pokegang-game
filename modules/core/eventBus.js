// ════════════════════════════════════════════════════════════════
//  EVENT BUS
//  Pub/sub léger (~30 lignes de logique) pour découpler les modules
//  sans passer par globalThis.fn?.().
//
//  Remplace progressivement les patterns :
//    globalThis.notify?.('msg', 'gold')
//    globalThis.markDirty?.()
//    globalThis.saveState?.()
//    globalThis.updateTopBar?.()
//
//  Usage :
//    import { EventBus } from './modules/core/eventBus.js';
//
//    // Émettre un événement
//    EventBus.emit('state:dirty');
//    EventBus.emit('ui:notify', { msg: 'Capturé !', type: 'gold' });
//    EventBus.emit('pokemon:captured', { pokemon, zoneId });
//
//    // S'abonner
//    EventBus.on('pokemon:captured', ({ pokemon, zoneId }) => { ... });
//
//    // Se désabonner (important pour éviter les fuites mémoire)
//    const handler = (data) => { ... };
//    EventBus.on('pokemon:captured', handler);
//    EventBus.off('pokemon:captured', handler);
//
//  Événements standards définis dans EVENTS ci-dessous.
// ════════════════════════════════════════════════════════════════

/** Catalogue des événements connus — pour autocomplete + doc. */
export const EVENTS = {
  // State
  STATE_DIRTY:       'state:dirty',       // state muté, autosave requis

  // UI
  UI_NOTIFY:         'ui:notify',         // { msg, type } → notify()
  UI_TOPBAR_UPDATE:  'ui:topbar',         // updateTopBar() requis
  UI_TAB_CHANGED:    'ui:tab',            // { tabId }
  TABS_REVEALED:     'ui:tabs-revealed',  // { tabs } — déblocage progressif post-onboarding

  // Pokémon
  POKEMON_CAPTURED:  'pokemon:captured',  // { pokemon, zoneId, agentId?, spawnCtx? }
  POKEMON_SOLD:      'pokemon:sold',      // { pokemonIds, totalPrice }

  // Team / agents
  TEAM_MEMBER_SET:   'team:member-set',   // { team: 'boss'|'agent', agentId?, pokemonId, slot, source }
  AGENT_RECRUITED:   'agent:recruited',   // { agentId, source, cost }
  AGENT_ASSIGNED:    'agent:assigned',    // { agentId, zoneId, previousZoneId, source }
  AGENT_FLAG_CHANGED:'agent:flag',        // { agentId, flag, value, source } — autoCombat/autoRaid/autoCapture

  // Combat
  COMBAT_STARTED:    'combat:started',    // { zoneId, trainerKey, mode, initiatedBy }
  COMBAT_WON:        'combat:won',        // { zoneId, trainerKey, elite, mode, initiatedBy }
  COMBAT_LOST:       'combat:lost',       // { zoneId, trainerKey } — consommé par le patch ciblé agentsTab (énergie)
  // { zoneId } — la séquence VISUELLE du combat de zone est terminée et le DOM
  // de la zone est rendu. À ne pas confondre avec COMBAT_WON/LOST, émis bien
  // plus tôt (dès applyCombatResult, avant que le script d'animation ne
  // démarre) : c'est cet écart qui empêchait l'embuscade d'onboarding de
  // s'afficher, son issue coupant le combat avant sa première image.
  COMBAT_SEQUENCE_ENDED: 'combat:sequence-ended',

  // Economy
  MONEY_CHANGED:     'economy:money',     // { delta, newTotal }
  REP_CHANGED:       'economy:rep',       // { delta, newTotal }

  // Inventory
  ITEM_RECEIVED:     'inventory:item',    // { itemId, qty } — fired when itemGift is applied

  // Onboarding / story
  ONBOARDING_STARTED:        'onboarding:started',        // { version, slotIdx, startedAt }
  ONBOARDING_RESUMED:        'onboarding:resumed',        // { version, step, secondsSinceNewGame }
  ONBOARDING_STEP_COMPLETED: 'onboarding:step-completed', // { step, nextStep, secondsSinceNewGame }
  ONBOARDING_COMPLETED:      'onboarding:completed',      // { version, secondsSinceNewGame }
  ONBOARDING_FAILED:         'onboarding:failed',         // { version, step, reason }
};

// ── Internal store ────────────────────────────────────────────
const _handlers = new Map(); // event → Set<Function>
let _debugMode = false;

// ── Public API ────────────────────────────────────────────────

/**
 * Émet un événement avec des données optionnelles.
 * Tous les handlers abonnés sont appelés de façon synchrone.
 */
function emit(event, data) {
  if (_debugMode) console.debug(`[EventBus] emit: ${event}`, data ?? '');
  const handlers = _handlers.get(event);
  if (!handlers || handlers.size === 0) return;
  for (const fn of handlers) {
    try {
      fn(data);
    } catch (err) {
      console.error(`[EventBus] Handler error on "${event}" :`, err);
    }
  }
}

/**
 * S'abonne à un événement.
 * @returns {Function} Fonction de désabonnement (appeler pour se désabonner)
 */
function on(event, handler) {
  if (!_handlers.has(event)) _handlers.set(event, new Set());
  _handlers.get(event).add(handler);
  // Retourne une fonction de cleanup
  return () => off(event, handler);
}

/**
 * Abonnement one-shot : le handler est retiré après le premier appel.
 */
function once(event, handler) {
  const wrapper = (data) => {
    off(event, wrapper);
    handler(data);
  };
  return on(event, wrapper);
}

/**
 * Se désabonne d'un événement.
 */
function off(event, handler) {
  _handlers.get(event)?.delete(handler);
}

/**
 * Supprime tous les handlers d'un événement.
 */
function clear(event) {
  _handlers.delete(event);
}

/**
 * Active/désactive les logs debug (console.debug sur chaque emit).
 */
function setDebug(enabled) {
  _debugMode = !!enabled;
}

/** Dump pour debug — liste tous les événements et le nombre de handlers. */
function dump() {
  const rows = [];
  for (const [event, handlers] of _handlers) {
    rows.push({ event, handlers: handlers.size });
  }
  console.table(rows);
  return rows;
}

export const EventBus = { emit, on, once, off, clear, setDebug, dump, EVENTS };
