'use strict';

// ── Cosmétiques + modales de nom et de sprite ────────────────────────────────
//
// Dépendances classiques (bare name — classic <script> globals) :
//   (aucune)
//
// Dépendances globalThis :
//   state, saveState, notify, COSMETIC_BGS, FABRIC_SPECIES, fabricBgUrl,
//   BOSS_SPRITES, trainerSprite

function _resolveFabricBgUrl(bgKey) {
  const m = bgKey.match(/^fabric_(\d+)(?:_v(\d+))?$/);
  if (!m) return null;
  const pid     = parseInt(m[1], 10);
  const variant = m[2] ? parseInt(m[2], 10) : 1;
  return globalThis.fabricBgUrl?.(pid, variant) ?? null;
}

function applyCosmetics() {
  const state = globalThis.state;
  const COSMETIC_BGS = globalThis.COSMETIC_BGS;
  const bgKey = state.cosmetics?.gameBg;
  const bg = bgKey ? COSMETIC_BGS?.[bgKey] : null;
  const isFabric = bgKey && bgKey.startsWith('fabric_');
  const _bgTargets = [document.documentElement, document.body];

  if (bg?.type === 'image') {
    _bgTargets.forEach(el => {
      el.style.backgroundImage = `url('${bg.url}')`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundAttachment = 'fixed';
      el.style.backgroundPosition = 'center';
      el.style.backgroundRepeat = 'no-repeat';
    });
    document.documentElement.style.setProperty('--bg', 'rgba(10,10,10,0.72)');
    document.documentElement.style.setProperty('--bg-card', 'rgba(20,20,20,0.70)');
    document.documentElement.style.setProperty('--bg-panel', 'rgba(26,26,26,0.70)');
    document.documentElement.style.setProperty('--bg-hover', 'rgba(34,34,34,0.80)');
  } else if (bg?.type === 'gradient') {
    _bgTargets.forEach(el => {
      el.style.backgroundImage = bg.gradient;
      el.style.backgroundSize = 'cover';
      el.style.backgroundAttachment = 'fixed';
      el.style.backgroundPosition = 'center';
      el.style.backgroundRepeat = 'no-repeat';
    });
    document.documentElement.style.setProperty('--bg', '#0a0a0a');
    document.documentElement.style.setProperty('--bg-card', '#141414');
    document.documentElement.style.setProperty('--bg-panel', '#1a1a1a');
    document.documentElement.style.setProperty('--bg-hover', '#222');
  } else if (isFabric) {
    const url = _resolveFabricBgUrl(bgKey);
    if (url) {
      const fMode = state.cosmetics?.fabricMode || 'repeat';
      const fSize = state.cosmetics?.fabricSize ?? 320;
      _bgTargets.forEach(el => {
        el.style.backgroundImage = `url('${url}')`;
        el.style.backgroundAttachment = 'fixed';
        if (fMode === 'full') {
          el.style.backgroundSize     = 'cover';
          el.style.backgroundRepeat   = 'no-repeat';
          el.style.backgroundPosition = 'center';
        } else {
          el.style.backgroundSize     = `${fSize}px`;
          el.style.backgroundRepeat   = 'repeat';
          el.style.backgroundPosition = 'top left';
        }
      });
    }
    const alpha = ((state.cosmetics?.fabricOpacity ?? 72) / 100).toFixed(2);
    document.documentElement.style.setProperty('--bg',       `rgba(10,10,10,${alpha})`);
    document.documentElement.style.setProperty('--bg-card',  `rgba(20,20,20,${alpha})`);
    document.documentElement.style.setProperty('--bg-panel', `rgba(26,26,26,${alpha})`);
    document.documentElement.style.setProperty('--bg-hover', 'rgba(34,34,34,0.80)');
  } else {
    _bgTargets.forEach(el => { el.style.backgroundImage = ''; });
    document.documentElement.style.setProperty('--bg', '#0a0a0a');
    document.documentElement.style.setProperty('--bg-card', '#141414');
    document.documentElement.style.setProperty('--bg-panel', '#1a1a1a');
    document.documentElement.style.setProperty('--bg-hover', '#222');
  }
}

function _unlockFabricBg(dexNum, isShiny) {
  if (!dexNum || dexNum <= 0) return;
  const FABRIC_SPECIES = globalThis.FABRIC_SPECIES;
  if (!FABRIC_SPECIES) return;
  const spec = FABRIC_SPECIES.find(s => s[0] === dexNum);
  if (!spec) return;
  const state = globalThis.state;
  const unlocked = state.cosmetics.unlockedBgs || [];
  const add = (key) => { if (!unlocked.includes(key)) unlocked.push(key); };
  add(`fabric_${dexNum}`);
  if (spec[2] >= 2) add(`fabric_${dexNum}_v2`);
  state.cosmetics.unlockedBgs = unlocked;
}

// ── Modale de saisie de texte (remplace browser prompt()) ────────────────────
// opts: { title, placeholder, current, maxLength, cost, confirmLabel, onConfirm }
function openNameModal(opts = {}) {
  const state = globalThis.state;
  const {
    title        = 'Entrer un nom',
    placeholder  = '',
    current      = '',
    maxLength    = 16,
    cost         = 0,
    confirmLabel = 'Confirmer',
    onConfirm    = () => {},
  } = opts;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9600;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:340px;width:92%;display:flex;flex-direction:column;gap:12px">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">${title}</div>
      <input id="nameModalInput" type="text" maxlength="${maxLength}" placeholder="${placeholder}"
        value="${current.replace(/"/g,'&quot;')}"
        style="padding:9px 12px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text);font-size:12px;outline:none;width:100%;box-sizing:border-box">
      ${cost ? `<div style="font-size:8px;color:var(--text-dim);font-family:var(--font-pixel)">Coût : <span style="color:var(--gold)">${cost.toLocaleString()}₽</span> &nbsp;·&nbsp; Solde : ${(state.gang.money||0).toLocaleString()}₽</div>` : ''}
      <div style="display:flex;gap:8px">
        <button id="nameModalConfirm" style="flex:1;font-family:var(--font-pixel);font-size:9px;padding:9px;background:var(--red);border:none;border-radius:var(--radius-sm);color:#fff;cursor:pointer">${confirmLabel}</button>
        <button id="nameModalCancel" style="font-family:var(--font-pixel);font-size:9px;padding:9px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const input   = overlay.querySelector('#nameModalInput');
  const confirm = overlay.querySelector('#nameModalConfirm');
  const cancel  = overlay.querySelector('#nameModalCancel');

  input.focus();
  input.select();

  const submit = () => {
    const val = input.value.trim().slice(0, maxLength);
    if (!val) { input.style.borderColor = 'var(--red)'; return; }
    overlay.remove();
    onConfirm(val);
  };

  confirm.addEventListener('click', submit);
  cancel.addEventListener('click',  () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') overlay.remove();
  });
}

function openSpritePicker(currentSprite, callback) {
  const BOSS_SPRITES = globalThis.BOSS_SPRITES || [];
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:16px;max-width:500px;width:95%;display:flex;flex-direction:column;gap:12px">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">Choisir un sprite</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;max-height:280px;overflow-y:auto" id="spritePickerGrid">
        ${BOSS_SPRITES.map(s => `
          <div class="spr-opt" data-spr="${s}" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px;border:2px solid ${s === currentSprite ? 'var(--gold)' : 'var(--border)'};border-radius:4px;cursor:pointer;background:var(--bg-card)">
            <img src="${globalThis.trainerSprite?.(s) ?? ''}" style="width:36px;height:36px;image-rendering:pixelated">
            <span style="font-size:7px;color:var(--text-dim)">${s}</span>
          </div>`).join('')}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="spritePickerCancel" style="font-family:var(--font-pixel);font-size:9px;padding:6px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
        <button id="spritePickerConfirm" style="font-family:var(--font-pixel);font-size:9px;padding:6px 12px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Confirmer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  let selectedSpr = currentSprite || BOSS_SPRITES[0];
  overlay.querySelectorAll('.spr-opt').forEach(el => {
    el.addEventListener('click', () => {
      overlay.querySelectorAll('.spr-opt').forEach(o => o.style.borderColor = 'var(--border)');
      el.style.borderColor = 'var(--gold)';
      selectedSpr = el.dataset.spr;
    });
  });

  overlay.querySelector('#spritePickerCancel')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('#spritePickerConfirm')?.addEventListener('click', () => {
    overlay.remove();
    if (selectedSpr) callback(selectedSpr);
  });
}

Object.assign(globalThis, {
  _resolveFabricBgUrl, applyCosmetics, _unlockFabricBg,
  openNameModal, openSpritePicker,
});

export {};
