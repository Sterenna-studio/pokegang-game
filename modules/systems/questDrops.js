'use strict';

// ════════════════════════════════════════════════════════════════
//  QUEST ITEM DROPS — objets de quête avec pitié
//
//  Les objets de quête (Argent'Aile, Arcenci'Aile, Météore, Plume Sacrée, Rapport Sylphe, Cristal Bête,
//  Fragment Temporel, Onde Distorsion, Cristal du Lac…) sont décrits comme des SPECIAL_EVENTS « itemGift »
//  dans data/zones-*-data.js. Ces événements ne sont pas dans ACTIVE_EVENT_IDS (zoneSystem.js) : ils ne
//  survenaient donc jamais, et les quêtes Lugia, Ho-Oh et Deoxys, comme les Permis Tourbillon/Carillon,
//  étaient impossibles à terminer. Ils tombent désormais sur chaque victoire de combat dans leurs zones
//  (même `chance`, `minRep` et `zoneIds` que les données), avec une PITIÉ : après ⌈1,5 ÷ chance⌉ tirages
//  ratés d'affilée, le suivant est garanti. La malchance est bornée, la chance moyenne reste celle des données.
//
//  La pitié ne concerne QUE ces objets. Le chroma de chasse n'en a pas : sa rareté est volontairement intacte.
//
//  state.dropPity = { [clé]: nombre de tirages ratés depuis le dernier drop }
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });
const _save   = ()               => globalThis.saveState?.();

// Pitié = 1,5 × le nombre moyen de tirages nécessaires (1 ÷ chance).
export const PITY_FACTOR = 1.5;

export function pityThreshold(chance, factor = PITY_FACTOR) {
  return chance > 0 ? Math.max(1, Math.ceil(factor / chance)) : Infinity;
}

/**
 * Tirage avec pitié. Retourne true si l'objet tombe ; remet alors le compteur à zéro.
 * @param {object} state   état du jeu (state.dropPity est créé au besoin)
 * @param {string} key     clé du compteur (id de l'événement ou de la source)
 * @param {number} chance  probabilité de base par tirage (0-1)
 */
export function pityRoll(state, key, chance, { random = Math.random, pityAfter = pityThreshold(chance) } = {}) {
  if (!state.dropPity || typeof state.dropPity !== 'object') state.dropPity = {};
  const fails = state.dropPity[key] || 0;
  if (fails >= pityAfter || random() < chance) {
    delete state.dropPity[key];
    return true;
  }
  state.dropPity[key] = fails + 1;
  return false;
}

// Événements « objet de quête » : ceux dont la récompense est un objet, sans combat, avec une chance et des zones.
function _dropTable() {
  const events = typeof SPECIAL_EVENTS !== 'undefined' ? SPECIAL_EVENTS : [];
  return events.filter(ev => ev?.reward?.itemGift && !ev.trainerKey && ev.chance > 0 && Array.isArray(ev.zoneIds));
}

function _grant(state, ev) {
  const itemId = ev.reward.itemGift;
  state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
  EventBus.emit(EVENTS.ITEM_RECEIVED, { itemId, qty: 1 });
  globalThis.onItemGiftReceived?.(itemId);      // hook Deoxys (Météores)
  const label = state.lang === 'en' ? (ev.en || ev.fr) : ev.fr;
  _notify(`${ev.icon || '🎁'} ${label}`, 'gold');
}

/** Un combat vient d'être gagné dans `zoneId` : tire les objets de quête de cette zone (un seul par victoire). */
export function rollQuestItemDrops(zoneId, state = globalThis.state) {
  if (!state || !zoneId) return false;
  const rep = state.gang?.reputation ?? 0;
  for (const ev of _dropTable()) {
    if (rep < (ev.minRep ?? 0) || !ev.zoneIds.includes(zoneId)) continue;
    if (pityRoll(state, ev.id, ev.chance)) {
      _grant(state, ev);
      _save();
      return true;
    }
  }
  return false;
}

let _registered = false;
export function registerQuestDrops() {
  if (_registered) return;
  _registered = true;
  EventBus.on(EVENTS.COMBAT_WON, ({ zoneId } = {}) => { rollQuestItemDrops(zoneId); });
}

registerQuestDrops();

Object.assign(globalThis, { pityRoll, rollQuestItemDrops });
