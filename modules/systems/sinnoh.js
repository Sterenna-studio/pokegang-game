'use strict';

import { EventBus, EVENTS } from '../core/eventBus.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY,        { msg, type });
const _save   = ()               => globalThis.saveState?.();

// ── Sinnoh region unlock system ──────────────────────────────────────────────
// Logique d'activation et de cinématique de déblocage de la région Sinnoh.
//
// Dépendances classiques (bare name — classic <script> globals) :
//   ZONES, ZONES_SINNOH, ZONE_BY_ID, ZONE_MUSIC_MAP, ZONE_MUSIC_MAP_SINNOH
//   SPECIAL_EVENTS, SPECIAL_EVENTS_SINNOH
//
// Dépendances globalThis :
//   state, notify, saveState, trainerSprite, renderZonesTab, switchTab,
//   activeTab, _zsel_setActiveRegion

function registerSinnohSpecialEvents() {
  if (typeof SPECIAL_EVENTS === 'undefined' || typeof SPECIAL_EVENTS_SINNOH === 'undefined') return;
  const existingEventIds = new Set(SPECIAL_EVENTS.map(ev => ev.id));
  SPECIAL_EVENTS_SINNOH.forEach(ev => {
    if (existingEventIds.has(ev.id)) return;
    SPECIAL_EVENTS.push({ ...ev, region: 'sinnoh' });
    existingEventIds.add(ev.id);
  });
}

function activateSinnohRegion() {
  if (!ZONES.find(z => z.id === 'route201_202')) {
    ZONES.push(...ZONES_SINNOH);
    ZONES_SINNOH.forEach(z => { ZONE_BY_ID[z.id] = z; });
    Object.assign(ZONE_MUSIC_MAP, ZONE_MUSIC_MAP_SINNOH);
  }
  registerSinnohSpecialEvents();
  globalThis.state.purchases.sinnohUnlocked = true;
  globalThis._zsel_setActiveRegion?.('kanto');
  if (globalThis.activeTab === 'tabZones') globalThis.renderZonesTab?.();
  _save();
}

function showSinnohUnlockModal() {
  const state = globalThis.state;
  if (state.purchases?.sinnohUnlocked) return;
  if (document.getElementById('sinnoh-intro-overlay')) return;

  const cynthiaSprite = globalThis.trainerSprite?.('cynthia') ?? '';
  const bossName = state.gang?.bossName || 'Parrain';

  const MESSAGE =
    `« Je vous attendais, ${bossName}.\n\n` +
    `Sinnoh n'est pas une région ordinaire. Le temps et l'espace y ont une forme, ` +
    `une présence que les autres régions ne connaissent pas. ` +
    `Dialga, Palkia, Giratina — ils dorment au fond du Mont Couronné et du Pilier Axial.\n\n` +
    `Mais la Team Galaxie veut détruire le monde pour en recréer un selon la vision de Cyrus. ` +
    `Un homme sans émotion qui croit que les sentiments sont une faiblesse.\n\n` +
    `Votre gang a ce que Cyrus ne comprend pas — des liens, des ambitions, une raison de se battre.\n\n` +
    `Sinnoh a besoin de vous. Bonaugure est ouvert. »`;

  // ── Overlay ───────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'sinnoh-intro-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:8100;
    background:linear-gradient(160deg,#06040e 0%,#0c0818 45%,#080410 100%);
    display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
    font-family:var(--font-system,sans-serif);
    overflow:hidden;opacity:0;transition:opacity .4s ease;
  `;
  overlay.innerHTML = `
    <div style="position:absolute;inset:0;pointer-events:none;
      background:radial-gradient(ellipse at 50% 20%,rgba(120,60,220,.07) 0%,transparent 60%),
                 radial-gradient(ellipse at 80% 75%,rgba(60,20,160,.05) 0%,transparent 50%)"></div>
    <div id="si-stage" style="position:absolute;inset:0;display:flex;flex-direction:column;
      align-items:center;justify-content:flex-end;padding:0 16px 0;"></div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  const stage = overlay.querySelector('#si-stage');

  // ── Portrait Cynthia ──────────────────────────────────────────────────────
  const portrait = document.createElement('div');
  portrait.style.cssText = `
    position:absolute;top:0;left:50%;transform:translateX(-50%);
    width:100%;max-width:560px;
    display:flex;align-items:flex-start;justify-content:center;
    padding-top:32px;pointer-events:none;
  `;
  portrait.innerHTML = `
    <div style="position:relative;text-align:center">
      <img src="${cynthiaSprite}"
        style="width:140px;height:140px;image-rendering:pixelated;
               filter:drop-shadow(0 8px 28px rgba(140,80,255,.45));
               animation:si-bob 2.8s ease-in-out infinite"
        onerror="this.style.opacity='.25'">
      <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
        width:80px;height:10px;
        background:radial-gradient(ellipse,rgba(0,0,0,.5) 0%,transparent 70%);
        filter:blur(3px)"></div>
    </div>`;
  overlay.appendChild(portrait);

  // ── Boîte de dialogue ─────────────────────────────────────────────────────
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    width:100%;max-width:560px;
    background:rgba(6,2,12,.96);
    border:2px solid rgba(120,60,200,.5);
    border-radius:8px;
    padding:16px 18px 18px;
    margin-bottom:24px;
    box-shadow:0 -4px 32px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.03);
    position:relative;
  `;
  dialog.innerHTML = `
    <div style="font-family:var(--font-pixel,monospace);font-size:7px;
      color:rgba(180,120,255,.85);letter-spacing:.8px;text-transform:uppercase;
      margin-bottom:8px">Cynthia — Championne Sinnoh</div>
    <div id="si-text" style="font-size:14px;color:#eeddff;line-height:1.7;min-height:46px;
      white-space:pre-wrap"></div>
    <div id="si-actions" style="margin-top:16px;display:none;
      justify-content:flex-end;gap:10px"></div>
    <div id="si-cursor" style="position:absolute;bottom:14px;right:16px;
      font-size:10px;color:rgba(180,120,255,.65);
      animation:si-blink 1s ease-in-out infinite;display:none">▶</div>`;
  stage.appendChild(dialog);

  // ── Animations CSS ────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    @keyframes si-bob   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
    @keyframes si-blink { 0%,100%{opacity:.7} 50%{opacity:.15} }
    @keyframes si-fadein{ from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    #si-stage > div { animation:si-fadein .3s ease }
    .si-btn-accept {
      font-family:var(--font-pixel,monospace);font-size:10px;
      padding:10px 20px;border-radius:6px;cursor:pointer;
      background:rgba(100,40,180,.9);color:#ddccff;
      border:1px solid rgba(160,100,240,.6);
      transition:background .15s,transform .1s;
    }
    .si-btn-accept:hover  { background:rgba(120,60,210,.9);color:#eeddff; }
    .si-btn-accept:active { transform:scale(.97) }
    .si-btn-dismiss {
      font-family:var(--font-pixel,monospace);font-size:9px;
      padding:8px 14px;border-radius:6px;cursor:pointer;
      background:transparent;color:rgba(255,255,255,.4);
      border:1px solid rgba(255,255,255,.12);
      transition:color .15s,border-color .15s;
    }
    .si-btn-dismiss:hover { color:rgba(255,255,255,.7);border-color:rgba(255,255,255,.3); }
  `;
  document.head.appendChild(style);

  // ── Machine à écrire ──────────────────────────────────────────────────────
  const textEl    = dialog.querySelector('#si-text');
  const actionsEl = dialog.querySelector('#si-actions');
  const cursor    = dialog.querySelector('#si-cursor');
  let _tw = null;

  function _typewrite(text, onDone) {
    textEl.textContent = '';
    let i = 0;
    cursor.style.display = 'none';
    _tw = setInterval(() => {
      textEl.textContent += text[i++];
      if (i >= text.length) {
        clearInterval(_tw);
        cursor.style.display = 'block';
        onDone?.();
      }
    }, 18);
  }

  dialog.addEventListener('click', () => {
    if (_tw) {
      clearInterval(_tw);
      _tw = null;
      textEl.textContent = MESSAGE;
      cursor.style.display = 'block';
      _showActions();
    }
  }, { once: true });

  function _showActions() {
    cursor.style.display = 'none';
    actionsEl.style.display = 'flex';
    actionsEl.innerHTML = `
      <button class="si-btn-dismiss" id="si-dismiss">Pas encore...</button>
      <button class="si-btn-accept"  id="si-accept">→ Traverser vers Sinnoh</button>`;

    actionsEl.querySelector('#si-accept').addEventListener('click', () => {
      _close();
      activateSinnohRegion();
      globalThis._zsel_setActiveRegion?.('sinnoh');
      document.querySelectorAll('#regionSwitcher .region-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.region === 'sinnoh');
      });
      globalThis.switchTab?.('tabZones');
      _notify('❄️ Sinnoh débloqué ! Bienvenue à Bonaugure, Parrain...', 'gold');
    });

    actionsEl.querySelector('#si-dismiss').addEventListener('click', () => {
      _close();
      _notify("📡 L'offre reste disponible — bouton Sinnoh ✉ dans les zones.", '');
    });
  }

  function _close() {
    if (_tw) clearInterval(_tw);
    overlay.style.transition = 'opacity .35s ease';
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.remove(); style.remove(); }, 360);
  }

  setTimeout(() => _typewrite(MESSAGE, _showActions), 400);
}

function checkSinnohUnlock() {
  const state = globalThis.state;
  if (state.purchases?.sinnohUnlocked) return;
  // Débloqué après la victoire à la Ligue Hoenn + rep suffisante + pass Sinnoh
  if (!state.zones?.['ever_grande_hoenn']?.gymDefeated) return;
  if ((state.gang?.reputation ?? 0) < 3500) return;
  if (!state.inventory?.sinnoh_pass) return;
  setTimeout(() => showSinnohUnlockModal(), 1800);
}

Object.assign(globalThis, {
  activateSinnohRegion,
  showSinnohUnlockModal,
  checkSinnohUnlock,
});

export {};
