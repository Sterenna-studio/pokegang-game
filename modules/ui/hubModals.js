'use strict';

import { EventBus, EVENTS } from '../core/eventBus.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY,        { msg, type });
const _dirty  = ()               => EventBus.emit(EVENTS.STATE_DIRTY);
const _topBar = ()               => EventBus.emit(EVENTS.UI_TOPBAR_UPDATE);
const _save   = ()               => globalThis.saveState?.();

function _t(key, vars = {}) {
  const lang = globalThis.state?.lang || 'fr';
  const I18N  = globalThis.I18N ?? {};
  const entry = I18N[key];
  if (!entry) return key;
  let str = entry[lang] || entry.fr || key;
  for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v);
  return str;
}

// ── Modales du hub : réparation de slot + validateur de sprite boss ──────────
//
// Dépendances classiques (bare name — classic <script> globals) :
//   TITLES
//
// Dépendances globalThis :
//   state, notify, saveState, showConfirm, renderAll, trainerSprite, BOSS_SPRITES,
//   getSlotPreview, activeSaveSlot (defineProperty), SAVE_KEYS, migrate, MAX_HISTORY,
//   setState, showIntro

/**
 * Hub-screen slot repair modal.
 * Lets the user pick a slot and re-applies migrate() + cleanups on it.
 */
function openHubSlotRepairModal() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';

  const activeSaveSlot = globalThis.activeSaveSlot ?? 0;
  const SAVE_KEYS = globalThis.SAVE_KEYS || [];

  const slotHtml = [0, 1, 2].map(i => {
    const prev = globalThis.getSlotPreview?.(i);
    const label = prev
      ? `<b style="color:var(--text)">${prev.name}</b> <span style="color:var(--text-dim);font-size:9px">(${prev.pokemon} pkm · ⭐${prev.rep})</span>`
      : `<span style="color:#555;font-style:italic">${_t('hub_slot_empty_label')}</span>`;
    return `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;background:var(--bg);${!prev ? 'opacity:.4;pointer-events:none' : ''}">
      <input type="radio" name="repairTargetSlot" value="${i}" ${i === activeSaveSlot ? 'checked' : ''} ${!prev ? 'disabled' : ''} style="accent-color:#ffa000">
      <span style="font-family:var(--font-pixel);font-size:8px;color:#ffa000">SLOT ${i+1}</span>
      <span style="font-size:10px">${label}</span>
    </label>`;
  }).join('');

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid #ffa000;border-radius:var(--radius);padding:24px;max-width:480px;width:100%;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-family:var(--font-pixel);font-size:11px;color:#ffa000">${_t('hub_slot_repair_title')}</div>
        <button id="btnRepairSlotClose" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
      </div>
      <div style="font-size:9px;color:var(--text-dim);line-height:1.5">
        ${_t('hub_repair_desc')}
        <b style="color:var(--text)">${_t('hub_repair_data_safe')}</b>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">${slotHtml}</div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button id="btnRepairSlotConfirm" style="flex:1;font-family:var(--font-pixel);font-size:9px;padding:10px;background:var(--bg);border:2px solid #ffa000;border-radius:var(--radius-sm);color:#ffa000;cursor:pointer">
          ${_t('hub_slot_repair_btn')}
        </button>
        <button id="btnRepairSlotCancel" style="font-family:var(--font-pixel);font-size:8px;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
          ${_t('hub_cancel')}
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#btnRepairSlotClose')?.addEventListener('click',  () => overlay.remove());
  overlay.querySelector('#btnRepairSlotCancel')?.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#btnRepairSlotConfirm')?.addEventListener('click', () => {
    const targetSlot = parseInt(overlay.querySelector('input[name="repairTargetSlot"]:checked')?.value ?? activeSaveSlot);
    const raw = localStorage.getItem(SAVE_KEYS[targetSlot]);
    if (!raw) { _notify(_t('hub_slot_empty'), 'error'); overlay.remove(); return; }

    globalThis.showConfirm?.(
      `${_t('hub_slot_repair_confirm', { slot: targetSlot + 1 })}<br><span style="color:var(--text-dim);font-size:10px">${_t('hub_slot_repair_body')}</span>`,
      () => {
        try {
          const parsed = JSON.parse(raw);
          const fixed = globalThis.migrate?.(parsed) ?? parsed;

          // Trim histories
          let histTrimmed = 0;
          const MAX_HISTORY = globalThis.MAX_HISTORY ?? 200;
          for (const p of fixed.pokemons || []) {
            if (p.history && p.history.length > MAX_HISTORY) {
              histTrimmed += p.history.length - MAX_HISTORY;
              p.history = p.history.slice(-MAX_HISTORY);
            }
          }

          // Remove ghost IDs
          const allIds = new Set((fixed.pokemons || []).map(p => p.id));
          fixed.gang.bossTeam = (fixed.gang.bossTeam || []).filter(id => allIds.has(id));
          if (fixed.pension?.slots) fixed.pension.slots = fixed.pension.slots.filter(id => allIds.has(id));
          if (fixed.trainingRoom?.pokemon) fixed.trainingRoom.pokemon = fixed.trainingRoom.pokemon.filter(id => allIds.has(id));

          // Invalid title slots
          const allTitleIds = new Set((TITLES || []).map(t => t.id));
          ['titleA','titleB','titleC','titleD'].forEach(slot => {
            if (fixed.gang[slot] && !allTitleIds.has(fixed.gang[slot])) fixed.gang[slot] = null;
          });

          localStorage.setItem(SAVE_KEYS[targetSlot], JSON.stringify(fixed));

          if (targetSlot === (globalThis.activeSaveSlot ?? 0)) {
            globalThis.setState?.(fixed);
            _save();
          }

          overlay.remove();
          _notify(
            histTrimmed > 0
              ? _t('hub_slot_repaired_hist', { slot: targetSlot + 1, n: histTrimmed })
              : _t('hub_slot_repaired',      { slot: targetSlot + 1 }),
            'success'
          );

          // Refresh hub
          const introOverlay = document.getElementById('introOverlay');
          if (introOverlay?.classList.contains('active')) {
            introOverlay.classList.remove('active');
            globalThis.showIntro?.();
          }
        } catch (err) {
          _notify(_t('hub_repair_error'), 'error');
          console.error(err);
        }
      },
      null,
      { confirmLabel: _t('hub_slot_repair_btn'), cancelLabel: _t('hub_cancel') }
    );
  });
}

// ── Boss sprite validator — détecte un sprite cassé au chargement de la save ──

function checkBossSpriteValidity() {
  const state = globalThis.state;
  if (!state.gang.initialized || !state.gang.bossSprite) return;
  const url = globalThis.trainerSprite?.(state.gang.bossSprite);
  if (!url) return;
  const testImg = new Image();
  testImg.onload = () => {};
  testImg.onerror = () => { showBossSpriteRepairModal(); };
  testImg.src = url + '?v=' + Date.now();
}

function showBossSpriteRepairModal() {
  if (document.getElementById('spriteRepairModal')) return;

  const state = globalThis.state;
  const BOSS_SPRITES = globalThis.BOSS_SPRITES || [];
  const modal = document.createElement('div');
  modal.id = 'spriteRepairModal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.85);
    display:flex;align-items:center;justify-content:center;
  `;

  const spriteOptionsHtml = BOSS_SPRITES.map(s =>
    `<div class="sprite-option" data-sprite="${s}" style="
      display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;
      border:2px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;
      background:var(--bg-card);transition:border-color .15s;min-width:60px
    ">
      <img src="${globalThis.trainerSprite?.(s) ?? ''}" style="width:44px;height:44px;image-rendering:pixelated"
           onerror="this.parentElement.style.display='none'">
      <span style="font-family:var(--font-pixel);font-size:6px;color:var(--text-dim)">${s}</span>
    </div>`
  ).join('');

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--red);border-radius:var(--radius);padding:24px;max-width:600px;width:90%;max-height:80vh;display:flex;flex-direction:column;gap:16px">
      <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold)">${_t('hub_sprite_invalid_title')}</div>
      <div style="font-size:13px;color:var(--text-dim)">
        ${_t('hub_sprite_invalid_body', { sprite: state.gang.bossSprite })}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;overflow-y:auto;max-height:320px;padding:4px">
        ${spriteOptionsHtml}
      </div>
      <button id="spriteRepairConfirm" style="
        font-family:var(--font-pixel);font-size:10px;padding:10px 20px;
        background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius));
        color:var(--text);cursor:pointer;align-self:center
      ">${_t('hub_sprite_confirm')}</button>
    </div>
  `;

  document.body.appendChild(modal);

  let selected = BOSS_SPRITES[0] || '';

  modal.querySelectorAll('.sprite-option').forEach(opt => {
    opt.addEventListener('click', () => {
      modal.querySelectorAll('.sprite-option').forEach(o => o.style.borderColor = 'var(--border)');
      opt.style.borderColor = 'var(--gold)';
      selected = opt.dataset.sprite;
    });
  });

  const firstVisible = modal.querySelector('.sprite-option');
  if (firstVisible) firstVisible.style.borderColor = 'var(--gold)';

  modal.querySelector('#spriteRepairConfirm')?.addEventListener('click', () => {
    state.gang.bossSprite = selected;
    _save();
    modal.remove();
    document.querySelectorAll('[data-boss-sprite-img]').forEach(img => {
      img.src = globalThis.trainerSprite?.(selected) ?? '';
    });
    globalThis.renderAll?.();
    _notify(_t('hub_sprite_updated'), 'success');
  });
}

Object.assign(globalThis, {
  openHubSlotRepairModal, checkBossSpriteValidity, showBossSpriteRepairModal,
});

export {};
