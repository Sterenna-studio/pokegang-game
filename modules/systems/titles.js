'use strict';

// ── Titres et modal de titres ────────────────────────────────────────────────
//
// Dépendances classiques (bare name — classic <script> globals) :
//   TITLES, POKEMON_GEN1
//
// Dépendances globalThis :
//   state, notify, saveState, renderGangTab, activeTab

import { EventBus, EVENTS } from '../core/eventBus.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY,        { msg, type });
const _save   = ()               => globalThis.saveState?.();

function getTitleLabel(titleId) {
  const t = TITLES.find(t => t.id === titleId);
  if (!t) return '';
  return globalThis.state?.lang === 'en' ? (t.label_en || t.label) : t.label;
}

function getBossFullTitle() {
  const state = globalThis.state;
  const t1 = getTitleLabel(state.gang.titleA);
  const t2 = getTitleLabel(state.gang.titleB);
  const lia = state.gang.titleLiaison || '';
  if (!t1 && !t2) return state.lang === 'en' ? 'Recruit' : 'Recrue';
  if (t1 && !t2) return t1;
  if (!t1 && t2) return t2;
  return `${t1}${lia ? ' ' + lia : ''} ${t2}`;
}

function checkTitleUnlocks() {
  const state = globalThis.state;
  const unlocked = new Set(state.unlockedTitles || []);
  const newOnes = [];
  for (const t of TITLES) {
    if (unlocked.has(t.id)) continue;
    let unlock = false;
    if (t.category === 'rep') {
      unlock = state.gang.reputation >= t.repReq;
    } else if (t.category === 'type_capture') {
      const count = state.pokemons.filter(p => {
        const sp = POKEMON_GEN1.find(s => s.en === p.species_en);
        return sp?.types?.includes(t.typeReq);
      }).length;
      unlock = count >= t.countReq;
    } else if (t.category === 'stat') {
      unlock = (state.stats[t.statReq] || 0) >= t.countReq;
    } else if (t.category === 'special' && t.id === 'fondateur') {
      unlock = true;
    } else if (t.category === 'special' && t.id === 'glitcheur') {
      unlock = state.pokemons.some(p => p.species_en === 'missingno');
    } else if (t.category === 'pokedex') {
      if (t.dexType === 'kanto') {
        const kantoCount = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151 && state.pokedex[s.en]?.caught).length;
        const kantoTotal = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151).length;
        unlock = kantoCount >= kantoTotal;
      } else if (t.dexType === 'full') {
        const fullCount = POKEMON_GEN1.filter(s => !s.hidden && state.pokedex[s.en]?.caught).length;
        const fullTotal = POKEMON_GEN1.filter(s => !s.hidden).length;
        unlock = fullCount >= fullTotal;
      }
    } else if (t.category === 'shiny_special') {
      if (t.shinyType === 'starters') {
        unlock = ['bulbasaur','charmander','squirtle'].every(s => state.pokedex[s]?.shiny);
      } else if (t.shinyType === 'legendaries') {
        unlock = POKEMON_GEN1.filter(s => s.rarity === 'legendary' && !s.hidden).every(s => state.pokedex[s.en]?.shiny);
      } else if (t.shinyType === 'full_dex') {
        unlock = POKEMON_GEN1.filter(s => !s.hidden).every(s => state.pokedex[s.en]?.shiny);
      } else if (t.shinyType === 'species') {
        unlock = !!(state.pokedex[t.speciesReq]?.shiny);
      } else if (t.shinyType === 'collection') {
        unlock = Array.isArray(t.speciesReq) && t.speciesReq.every(s => state.pokedex[s]?.shiny);
      }
    } else if (t.category === 'collection') {
      if (Array.isArray(t.speciesReq)) {
        unlock = t.speciesReq.every(s => state.pokedex[s]?.caught);
      }
    }
    if (unlock) { unlocked.add(t.id); newOnes.push(t); }
  }
  if (newOnes.length > 0) {
    state.unlockedTitles = [...unlocked];
    if (!state.gang.titleA) state.gang.titleA = state.unlockedTitles[0] || 'recrue';
    newOnes.forEach(t => {
      const label = state.lang === 'en' ? (t.label_en || t.label) : t.label;
      const msg = state.lang === 'en' ? `🏆 Title unlocked: "${label}"!` : `🏆 Titre débloqué : "${label}" !`;
      _notify(msg, 'gold');
    });
    _save();
  }
}


Object.assign(globalThis, {
  getTitleLabel, getBossFullTitle, checkTitleUnlocks,
});

export {};
