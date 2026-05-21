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

// LIAISONS list (défini ici — absent de titles-data.js)
const LIAISONS = ['', 'de', "de l'", 'du', 'des', 'à', 'et', '&', 'alias', 'dit'];

const SLOT_DEFS = [
  { key:'titleA', label:'Titre 1', color:'var(--gold)',  bg:'rgba(255,204,90,.15)' },
  { key:'titleB', label:'Titre 2', color:'var(--red)',   bg:'rgba(204,51,51,.15)' },
  { key:'titleC', label:'Badge 1', color:'#4fc3f7',      bg:'rgba(79,195,247,.12)' },
  { key:'titleD', label:'Badge 2', color:'#ce93d8',      bg:'rgba(206,147,216,.12)' },
];

function getTitleLabel(titleId) {
  return TITLES.find(t => t.id === titleId)?.label || '';
}

function getBossFullTitle() {
  const state = globalThis.state;
  const t1 = getTitleLabel(state.gang.titleA);
  const t2 = getTitleLabel(state.gang.titleB);
  const lia = state.gang.titleLiaison || '';
  if (!t1 && !t2) return 'Recrue';
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
    newOnes.forEach(t => _notify(`🏆 Titre débloqué : "${t.label}" !`, 'gold'));
    _save();
  }
}

function openTitleModal() {
  const state = globalThis.state;
  const unlocked = new Set(state.unlockedTitles || []);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9700;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:16px';

  const categories = {
    rep:'Réputation', type_capture:'Type', stat:'Exploit',
    shop:'Boutique', special:'Spécial',
    pokedex:'Pokédex', shiny_special:'Chromatique', collection:'Collection'
  };

  let _activeSlot = 0;

  const renderModal = () => {
    const slots = SLOT_DEFS.map(s => state.gang[s.key]);
    const lia = state.gang.titleLiaison || '';
    const activeSlotDef = SLOT_DEFS[_activeSlot];

    const liaOptions = LIAISONS.map(l =>
      `<option value="${l}" ${l === lia ? 'selected' : ''}>${l || '(aucun)'}</option>`
    ).join('');

    const slotBtns = SLOT_DEFS.map((s, i) => {
      const isActive = i === _activeSlot;
      const val = slots[i];
      const lbl = val ? getTitleLabel(val) : '—';
      return `<button class="slot-sel-btn" data-slot="${i}"
        style="flex:1;font-family:var(--font-pixel);font-size:7px;padding:5px 4px;border-radius:var(--radius-sm);cursor:pointer;
               background:${isActive ? s.bg : 'var(--bg)'};
               border:2px solid ${isActive ? s.color : 'var(--border)'};
               color:${isActive ? s.color : 'var(--text-dim)'}">
        ${s.label}<br><span style="font-size:6px;opacity:.8">${lbl}</span>
      </button>`;
    }).join('');

    const liaRow = `<div style="display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;margin-top:6px">
      <span style="font-size:8px;color:var(--text-dim)">Liaison :</span>
      <select id="titleLiaison" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;font-size:8px;padding:2px 4px">${liaOptions}</select>
      <button id="btnClearTitles" style="font-size:7px;padding:2px 6px;background:var(--bg);border:1px solid var(--border);border-radius:3px;color:var(--text-dim);cursor:pointer">Tout effacer</button>
    </div>`;

    let titlesHtml = '';
    for (const [cat, catLabel] of Object.entries(categories)) {
      const group = TITLES.filter(t => t.category === cat);
      if (group.length === 0) continue;
      titlesHtml += `<div style="margin-bottom:12px">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">${catLabel}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">`;
      for (const t of group) {
        const isUnlocked = unlocked.has(t.id);
        const slotIdx = slots.findIndex(s => s === t.id);
        let hint = '';
        if (!isUnlocked) {
          if (t.category === 'rep') hint = `⭐ ${t.repReq} rep`;
          else if (t.category === 'type_capture') hint = `${t.countReq}× type ${t.typeReq}`;
          else if (t.category === 'stat') hint = `${t.countReq}× ${t.statReq}`;
          else if (t.category === 'shop') hint = `${(t.shopPrice||0).toLocaleString()}₽`;
          else if (t.category === 'pokedex') hint = t.dexType === 'kanto' ? 'Compléter le Pokédex Kanto (151)' : 'Compléter tout le Pokédex';
          else if (t.category === 'shiny_special') {
            if (t.shinyType === 'starters') hint = '3 starters chromatiques';
            else if (t.shinyType === 'legendaries') hint = 'Tous légendaires chromatiques';
            else if (t.shinyType === 'full_dex') hint = 'Pokédex chromatique complet';
            else if (t.shinyType === 'species') {
              const spFr = POKEMON_GEN1.find(s => s.en === t.speciesReq)?.fr || t.speciesReq;
              hint = `✨ ${spFr} chromatique`;
            } else if (t.shinyType === 'collection') {
              const names = (t.speciesReq || []).map(s => POKEMON_GEN1.find(p => p.en === s)?.fr || s).join(', ');
              hint = `✨ Chromatiques : ${names}`;
            }
          } else if (t.category === 'collection') {
            if (Array.isArray(t.speciesReq)) {
              const names = t.speciesReq.map(s => POKEMON_GEN1.find(p => p.en === s)?.fr || s).join(', ');
              hint = `Capturer : ${names}`;
            }
          } else hint = '???';
        }
        const assigned = slotIdx >= 0;
        const assignedColor = assigned ? SLOT_DEFS[slotIdx].color : '';
        const assignedBg    = assigned ? SLOT_DEFS[slotIdx].bg    : '';
        const style = isUnlocked
          ? `background:${assigned ? assignedBg : 'var(--bg-card)'};border:1px solid ${assigned ? assignedColor : 'var(--border)'};color:${assigned ? assignedColor : 'var(--text)'};cursor:pointer`
          : 'background:var(--bg);border:1px solid var(--border);color:var(--text-dim);opacity:.4;cursor:not-allowed';
        const badge = assigned ? ` <span style="font-size:6px;opacity:.7">${SLOT_DEFS[slotIdx].label}</span>` : '';
        titlesHtml += `<div class="title-chip ${isUnlocked ? 'title-unlocked' : 'title-locked'}" data-title-id="${t.id}"
          style="font-family:var(--font-pixel);font-size:8px;padding:4px 8px;border-radius:var(--radius-sm);${style}"
          title="${isUnlocked ? (assigned ? `Slot: ${SLOT_DEFS[slotIdx].label} — Cliquer pour retirer` : `Assigner au ${activeSlotDef.label}`) : hint}">
          ${t.label}${badge}
        </div>`;
      }
      titlesHtml += '</div></div>';
    }

    const mainTitle = getBossFullTitle();
    const tC = getTitleLabel(state.gang.titleC);
    const tD = getTitleLabel(state.gang.titleD);
    const badgesPreview = [tC, tD].filter(Boolean).map((b, i) => {
      const color = i === 0 ? '#4fc3f7' : '#ce93d8';
      return `<span style="font-family:var(--font-pixel);font-size:7px;padding:2px 6px;border-radius:10px;border:1px solid ${color};color:${color}">${b}</span>`;
    }).join('');

    overlay.innerHTML = `
      <div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);padding:20px;max-width:600px;width:100%;max-height:85vh;display:flex;flex-direction:column;gap:12px;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-family:var(--font-pixel);font-size:11px;color:var(--gold)">🏆 Titres</div>
          <button id="btnCloseTitleModal" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
        </div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;text-align:center">
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold-dim);margin-bottom:4px">${mainTitle}</div>
          ${badgesPreview ? `<div style="display:flex;gap:6px;justify-content:center;margin-bottom:4px">${badgesPreview}</div>` : ''}
          ${liaRow}
        </div>
        <div style="display:flex;gap:6px">
          <span style="font-size:8px;color:var(--text-dim);align-self:center;white-space:nowrap">Slot actif :</span>
          ${slotBtns}
        </div>
        <div style="font-size:8px;color:var(--text-dim);text-align:center">
          Clic → Assigner au <span style="color:${activeSlotDef.color}">${activeSlotDef.label}</span> &nbsp;|&nbsp; Clic sur badge → Retirer
        </div>
        <div style="overflow-y:auto;flex:1">${titlesHtml}</div>
      </div>`;

    overlay.querySelector('#btnCloseTitleModal')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#titleLiaison')?.addEventListener('change', e => {
      state.gang.titleLiaison = e.target.value;
      _save(); renderModal();
      if (globalThis.activeTab === 'tabGang') globalThis.renderGangTab?.();
    });
    overlay.querySelector('#btnClearTitles')?.addEventListener('click', () => {
      state.gang.titleA = 'recrue'; state.gang.titleB = null;
      state.gang.titleC = null;    state.gang.titleD = null;
      _save(); renderModal();
      if (globalThis.activeTab === 'tabGang') globalThis.renderGangTab?.();
    });

    overlay.querySelectorAll('.slot-sel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeSlot = Number(btn.dataset.slot);
        renderModal();
      });
    });

    overlay.querySelectorAll('.title-unlocked').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.titleId;
        const slotKey = SLOT_DEFS[_activeSlot].key;
        if (state.gang[slotKey] === id) {
          state.gang[slotKey] = _activeSlot === 0 ? 'recrue' : null;
        } else {
          for (const s of SLOT_DEFS) {
            if (state.gang[s.key] === id) state.gang[s.key] = null;
          }
          state.gang[slotKey] = id;
        }
        _save(); renderModal();
        if (globalThis.activeTab === 'tabGang') globalThis.renderGangTab?.();
      });
    });
  };

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  renderModal();
}

Object.assign(globalThis, {
  getTitleLabel, getBossFullTitle, checkTitleUnlocks, openTitleModal,
});

export {};
