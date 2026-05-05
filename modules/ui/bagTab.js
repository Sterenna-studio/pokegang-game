'use strict';

// deps via configureBagTab(ctx):
// - getState, getActiveTab, notify, saveState, updateTopBar, switchTab, showConfirm
// - isBoostActive, boostRemaining, activateBoost, itemSprite, openRareCandyPicker, renderPCTab
// data imports: BALLS

import { BALLS } from '../../data/economy-data.js';

let bagCtx = {};

function configureBagTab(ctx = {}) {
  bagCtx = { ...bagCtx, ...ctx };
}

function callCtx(name, ...args) {
  return bagCtx[name]?.(...args);
}

function getState() { return bagCtx.getState?.() ?? globalThis.state ?? {}; }
function getActiveTab() { return bagCtx.getActiveTab?.() ?? globalThis.activeTab ?? ''; }
function notify(...args) { return callCtx('notify', ...args); }
function saveState(...args) { return callCtx('saveState', ...args); }
function updateTopBar(...args) { return callCtx('updateTopBar', ...args); }
function isBoostActive(...args) { return callCtx('isBoostActive', ...args); }
function boostRemaining(...args) { return callCtx('boostRemaining', ...args) ?? 0; }
function activateBoost(...args) { return callCtx('activateBoost', ...args); }
function itemSprite(...args) { return callCtx('itemSprite', ...args) ?? ''; }
function openRareCandyPicker(...args) { return callCtx('openRareCandyPicker', ...args); }
function renderPCTab(...args) { return callCtx('renderPCTab', ...args); }

function renderBagTab() {
  const state = getState();
  const grid = document.getElementById('bagGrid');
  if (!grid) return;

  const items = [
    { id: 'pokeball',  icon: 'PB', fr: 'Poke Ball',      en: 'Poke Ball',      desc_fr: 'Ball standard',         desc_en: 'Standard ball' },
    { id: 'greatball', icon: 'GB', fr: 'Super Ball',      en: 'Great Ball',     desc_fr: 'Meilleur potentiel',    desc_en: 'Better potential' },
    { id: 'ultraball', icon: 'UB', fr: 'Hyper Ball',      en: 'Ultra Ball',     desc_fr: 'Excellent potentiel',   desc_en: 'Excellent potential' },
    { id: 'duskball',  icon: 'DB', fr: 'Sombre Ball',     en: 'Dusk Ball',      desc_fr: 'Potentiel equilibre',   desc_en: 'Balanced potential' },
    { id: 'lure',      icon: 'LR', fr: 'Leurre',          en: 'Lure',           desc_fr: 'x2 spawns 60s',         desc_en: 'x2 spawns 60s',      usable: true },
    { id: 'superlure', icon: 'SL', fr: 'Super Leurre',    en: 'Super Lure',     desc_fr: 'x3 spawns 60s',         desc_en: 'x3 spawns 60s',      usable: true },
    { id: 'incense',   icon: 'IN', fr: 'Encens Chance',   en: 'Lucky Incense',  desc_fr: '*+1 potentiel 90s',     desc_en: '*+1 potential 90s',  usable: true },
    { id: 'rarescope', icon: 'SC', fr: 'Rarioscope',       en: 'Rare Scope',     desc_fr: 'Spawns rares x3 90s',   desc_en: 'Rare spawns x3 90s', usable: true },
    { id: 'aura',      icon: 'AU', fr: 'Aura Shiny',       en: 'Shiny Aura',     desc_fr: 'Shiny x5 90s',          desc_en: 'Shiny x5 90s',       usable: true },
    { id: 'evostone',  icon: 'EV', fr: 'Pierre Evol.',     en: 'Evo Stone',      desc_fr: 'Evolution par pierre',  desc_en: 'Stone evolution' },
    { id: 'rarecandy', icon: 'RC', fr: 'Super Bonbon',     en: 'Rare Candy',     desc_fr: '+1 niveau',              desc_en: '+1 level',          usable: true },
    { id: 'masterball',icon: 'MB', fr: 'Master Ball',      en: 'Master Ball',    desc_fr: '***** garanti',         desc_en: '***** guaranteed' },
  ];

  grid.innerHTML = items.map(item => {
    const qty = state.inventory[item.id] || 0;
    const name = state.lang === 'fr' ? item.fr : item.en;
    const desc = state.lang === 'fr' ? item.desc_fr : item.desc_en;
    const active = isBoostActive(item.id);
    const remaining = active ? boostRemaining(item.id) : 0;
    return `<div class="bag-item" ${active ? 'style="border-color:var(--gold)"' : ''}>
      <span class="bag-icon">${itemSprite(item.id)}</span>
      <div class="bag-info">
        <div class="bag-name">${name}</div>
        <div class="bag-qty">x${qty}${active ? ` (${remaining}s)` : ''}</div>
        <div class="bag-desc">${desc}</div>
      </div>
      ${item.usable && qty > 0 ? `<button class="bag-use-btn" data-use-item="${item.id}">${state.lang === 'fr' ? 'Utiliser' : 'Use'}</button>` : ''}
    </div>`;
  }).join('');

  // Active ball selector
  grid.innerHTML += `
    <div class="bag-item" style="grid-column:1/-1;border-color:var(--gold-dim)">
      <span class="bag-icon">🎯</span>
      <div class="bag-info">
        <div class="bag-name">${state.lang === 'fr' ? 'Ball active' : 'Active Ball'}</div>
        <div class="bag-desc">${state.lang === 'fr' ? 'Ball utilisée pour les captures' : 'Ball used for captures'}</div>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${Object.entries(BALLS).map(([key, ball]) => `
          <button style="font-size:9px;padding:3px 8px;border-radius:4px;cursor:pointer;
            background:${state.activeBall === key ? 'var(--red-dark)' : 'var(--bg)'};
            border:1px solid ${state.activeBall === key ? 'var(--red)' : 'var(--border)'};
            color:var(--text)" data-bag-ball="${key}">
            ${state.lang === 'fr' ? ball.fr : ball.en} (${state.inventory[key] || 0})
          </button>
        `).join('')}
      </div>
    </div>`;

  // Bind use buttons
  grid.querySelectorAll('[data-use-item]').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.useItem;
      if (itemId === 'rarecandy') {
        openRareCandyPicker();
      } else if (activateBoost(itemId)) {
        notify(state.lang === 'fr' ? 'Boost activé !' : 'Boost activated!', 'success');
      }
      renderBagTab();
    });
  });

  // Ball selector
  grid.querySelectorAll('[data-bag-ball]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeBall = btn.dataset.bagBall;
      saveState();
      renderBagTab();
    });
  });
}



export { configureBagTab, renderBagTab };
