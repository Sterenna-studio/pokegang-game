'use strict';

// ════════════════════════════════════════════════════════════════
//  itemsIntroPopup.js — le transfuge présente les objets consommables
//
//  Un joueur qui trouve son premier objet (leurre, encens...) n'a aucune
//  idée de ce que ça fait ni où s'en servir — le nom seul dans l'inventaire
//  ne suffit pas. Dès le premier objet obtenu (hors onboarding, pour ne pas
//  se superposer aux fenêtres du tunnel), le transfuge lui en offre un lot
//  et explique chacun, avec une invite à aller les utiliser au Marché.
//  Une seule fois par save (state.discoveryProgress.itemsIntroShown).
//
//  Dépendances injectées via configureItemsIntroPopup :
//    getState, saveState, switchTab
// ════════════════════════════════════════════════════════════════

import { isOnboardingActive } from '../systems/onboardingFlow.js';

let _ctx = {};
export function configureItemsIntroPopup(ctx = {}) {
  _ctx = { ..._ctx, ...ctx };
}

const _state = () => _ctx.getState?.() ?? globalThis.state;
const _t = (fr, en) => (_state()?.lang === 'en' ? en : fr);

const OVERLAY_ID = 'items-intro-popup';
const GIFT_QTY = 5;

// Les 5 consommables "boost" du shop (data/economy-data.js) — hors skins de
// ball, débloqueurs de zone et objets cachés, qui n'ont rien à faire dans un
// cadeau de bienvenue.
const BOOST_ITEM_IDS = ['lure', 'superlure', 'incense', 'rarescope', 'aura'];

function _shopEntry(id) {
  return globalThis.SHOP_ITEMS?.find(item => item.id === id) ?? null;
}

/**
 * Appelé après tout octroi d'objet (butin de coffre, etc.) — n'affiche rien
 * tant que le joueur n'a pas encore d'objet consommable en poche, pendant
 * l'onboarding (qui a déjà ses propres fenêtres), ou après la première fois.
 */
export function maybeShowItemsIntro() {
  const state = _state();
  if (!state || isOnboardingActive(state)) return false;
  if (state.discoveryProgress?.itemsIntroShown) return false;
  const hasAnyBoostItem = BOOST_ITEM_IDS.some(id => (state.inventory?.[id] || 0) > 0);
  if (!hasAnyBoostItem) return false;
  if (document.getElementById(OVERLAY_ID)) return false;
  return _open();
}

function _open() {
  const state = _state();
  if (!state.discoveryProgress) state.discoveryProgress = {};
  state.discoveryProgress.itemsIntroShown = true;

  // Le cadeau lui-même : 5 de chaque, par-dessus ce que le joueur a déjà.
  if (!state.inventory) state.inventory = {};
  for (const id of BOOST_ITEM_IDS) {
    state.inventory[id] = (state.inventory[id] || 0) + GIFT_QTY;
  }
  _ctx.saveState?.();

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:7500;
    background:rgba(6,6,10,.75);
    display:flex; align-items:center; justify-content:center;
    padding:16px; animation:fadeIn .2s ease;
  `;

  const itemsHtml = BOOST_ITEM_IDS.map(id => {
    const item = _shopEntry(id);
    if (!item) return '';
    const url = globalThis.ITEM_SPRITE_URLS?.[id] ?? '';
    const name = _t(item.fr, item.en);
    const desc = _t(item.desc_fr, item.desc_en);
    return `<div style="display:flex;align-items:center;gap:10px;padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.06)">
      <img src="${url}" alt="" style="width:28px;height:28px;image-rendering:pixelated;flex-shrink:0" onerror="this.style.visibility='hidden'">
      <div style="min-width:0">
        <div style="font-size:11px;color:var(--text)">${name} <span style="color:var(--gold);font-size:10px">×${GIFT_QTY}</span></div>
        <div style="font-size:9px;color:var(--text-dim)">${desc}</div>
      </div>
    </div>`;
  }).join('');

  const box = document.createElement('div');
  box.style.cssText = `
    width:min(420px,92vw);
    background:var(--bg-card); border:2px solid var(--gold-dim);
    border-radius:var(--radius); padding:18px;
    box-shadow:0 12px 40px rgba(0,0,0,.6);
    font-family:var(--font-body);
  `;
  box.innerHTML = `
    <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold);margin-bottom:10px;text-align:center">
      ${_t('🎒 UN CADEAU DU TRANSFUGE', '🎒 A GIFT FROM THE DEFECTOR')}
    </div>
    <div style="font-size:12px;color:var(--text-dim);line-height:1.5;margin-bottom:12px;text-align:center">
      ${_t(
        "Boss, j'ai trouvé ça dans un buisson — cinq de chaque. On peut s'en servir pour être plus efficaces.",
        "Boss, I found this in a bush — five of each. We can use these to work more efficiently.",
      )}
    </div>
    <div style="margin-bottom:14px">${itemsHtml}</div>
    <button id="iip-market-btn" style="
      display:flex; align-items:center; justify-content:center; gap:6px;
      width:100%; padding:10px; border:none; border-radius:6px;
      background:var(--gold-dim); color:#1a1a1a; font-family:var(--font-pixel); font-size:10px;
      cursor:pointer;
    ">${_t('Aller les utiliser au Marché', 'Go use them at the Market')} <span class="iip-arrow">→</span></button>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  overlay.querySelector('#iip-market-btn').addEventListener('click', () => {
    overlay.remove();
    _ctx.switchTab?.('tabMarket');
  });

  return true;
}

Object.assign(globalThis, { maybeShowItemsIntro });
