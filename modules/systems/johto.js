'use strict';

import { EventBus, EVENTS } from '../core/eventBus.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY,        { msg, type });
const _save   = ()               => globalThis.saveState?.();

// ── Johto region unlock system ───────────────────────────────────────────────
// Logique d'activation et de cinématique de déblocage de la région Johto.
//
// Dépendances classiques (bare name — classic <script> globals) :
//   ZONES, ZONES_JOHTO, ZONE_BY_ID, ZONE_MUSIC_MAP, ZONE_MUSIC_MAP_JOHTO
//   SPECIAL_EVENTS, SPECIAL_EVENTS_JOHTO
//
// Dépendances globalThis :
//   state, notify, saveState, trainerSprite, renderZonesTab, switchTab,
//   activeTab, _zsel_setActiveRegion

function registerJohtoSpecialEvents() {
  if (typeof SPECIAL_EVENTS === 'undefined' || typeof SPECIAL_EVENTS_JOHTO === 'undefined') return;
  const existingEventIds = new Set(SPECIAL_EVENTS.map(ev => ev.id));
  SPECIAL_EVENTS_JOHTO.forEach(ev => {
    if (existingEventIds.has(ev.id)) return;
    SPECIAL_EVENTS.push({ ...ev, region: 'johto' });
    existingEventIds.add(ev.id);
  });
}

function activateJohtoRegion() {
  if (!ZONES.find(z => z.id === 'route29')) {
    ZONES.push(...ZONES_JOHTO);
    ZONES_JOHTO.forEach(z => { ZONE_BY_ID[z.id] = z; });
    Object.assign(ZONE_MUSIC_MAP, ZONE_MUSIC_MAP_JOHTO);
  }
  registerJohtoSpecialEvents();
  globalThis.state.purchases.johtoUnlocked = true;
  globalThis._zsel_setActiveRegion?.('kanto');
  if (globalThis.activeTab === 'tabZones') globalThis.renderZonesTab?.();
  _save();
}

function showJohtoUnlockModal() {
  const state = globalThis.state;
  if (state.purchases?.johtoUnlocked) return;
  if (document.getElementById('johto-intro-overlay')) return; // déjà ouvert

  const archerSprite = globalThis.trainerSprite('archer');
  const bossName = state.gang?.bossName || 'Parrain';

  const MESSAGE =
    `« J'ai entendu parler de vous, ${bossName}.\n\n` +
    `Le Plateau Indigo est tombé. Votre réputation a traversé le Détroit Tohjo.\n\n` +
    `Notre organisation traverse une période... difficile. ` +
    `Les territoires de Johto sont vacants. Les Bêtes Sacrées rôdent sans maître. ` +
    `Lugia dort dans les Îles Tourbillon. Ho-Oh attend un gardien digne de lui.\n\n` +
    `Une opportunité unique — pour ceux qui savent saisir leur chance.\n\n` +
    `Johto vous tend les bras. »`;

  // ── Overlay ───────────────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'johto-intro-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:8100;
    background:linear-gradient(160deg,#06100a 0%,#0a150d 45%,#080f0c 100%);
    display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
    font-family:var(--font-system,sans-serif);
    overflow:hidden;opacity:0;transition:opacity .4s ease;
  `;
  overlay.innerHTML = `
    <div style="position:absolute;inset:0;pointer-events:none;
      background:radial-gradient(ellipse at 50% 20%,rgba(20,160,80,.06) 0%,transparent 60%),
                 radial-gradient(ellipse at 80% 75%,rgba(0,80,60,.05) 0%,transparent 50%)"></div>
    <div id="ji-stage" style="position:absolute;inset:0;display:flex;flex-direction:column;
      align-items:center;justify-content:flex-end;padding:0 16px 0;"></div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  const stage = overlay.querySelector('#ji-stage');

  // ── Portrait Archer ───────────────────────────────────────────────────────
  const portrait = document.createElement('div');
  portrait.style.cssText = `
    position:absolute;top:0;left:50%;transform:translateX(-50%);
    width:100%;max-width:560px;
    display:flex;align-items:flex-start;justify-content:center;
    padding-top:32px;pointer-events:none;
  `;
  portrait.innerHTML = `
    <div style="position:relative;text-align:center">
      <img src="${archerSprite}"
        style="width:140px;height:140px;image-rendering:pixelated;
               filter:drop-shadow(0 8px 28px rgba(20,160,80,.4));
               animation:ji-bob 2.8s ease-in-out infinite"
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
    background:rgba(4,10,8,.96);
    border:2px solid rgba(20,120,70,.55);
    border-radius:8px;
    padding:16px 18px 18px;
    margin-bottom:24px;
    box-shadow:0 -4px 32px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.03);
    position:relative;
  `;
  dialog.innerHTML = `
    <div style="font-family:var(--font-pixel,monospace);font-size:7px;
      color:rgba(40,200,100,.85);letter-spacing:.8px;text-transform:uppercase;
      margin-bottom:8px">Archer — QG Johto</div>
    <div id="ji-text" style="font-size:14px;color:#ddeedd;line-height:1.7;min-height:46px;
      white-space:pre-wrap"></div>
    <div id="ji-actions" style="margin-top:16px;display:none;
      justify-content:flex-end;gap:10px"></div>
    <div id="ji-cursor" style="position:absolute;bottom:14px;right:16px;
      font-size:10px;color:rgba(40,200,100,.65);
      animation:ji-blink 1s ease-in-out infinite;display:none">▶</div>`;
  stage.appendChild(dialog);

  // ── Animations CSS ────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ji-bob   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
    @keyframes ji-blink { 0%,100%{opacity:.7} 50%{opacity:.15} }
    @keyframes ji-fadein{ from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    #ji-stage > div { animation:ji-fadein .3s ease }
    .ji-btn-accept {
      font-family:var(--font-pixel,monospace);font-size:10px;
      padding:10px 20px;border-radius:6px;cursor:pointer;
      background:rgba(20,120,60,.9);color:#aaffcc;
      border:1px solid rgba(40,180,90,.6);
      transition:background .15s,transform .1s;
    }
    .ji-btn-accept:hover  { background:rgba(30,160,80,.9);color:#ccffdd; }
    .ji-btn-accept:active { transform:scale(.97) }
    .ji-btn-dismiss {
      font-family:var(--font-pixel,monospace);font-size:9px;
      padding:8px 14px;border-radius:6px;cursor:pointer;
      background:transparent;color:rgba(255,255,255,.4);
      border:1px solid rgba(255,255,255,.12);
      transition:color .15s,border-color .15s;
    }
    .ji-btn-dismiss:hover { color:rgba(255,255,255,.7);border-color:rgba(255,255,255,.3); }
  `;
  document.head.appendChild(style);

  // ── Machine à écrire ──────────────────────────────────────────────────────
  const textEl    = dialog.querySelector('#ji-text');
  const actionsEl = dialog.querySelector('#ji-actions');
  const cursor    = dialog.querySelector('#ji-cursor');
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

  // Clic pour passer à la fin
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
      <button class="ji-btn-dismiss" id="ji-dismiss">Pas encore...</button>
      <button class="ji-btn-accept"  id="ji-accept">→ Traverser vers Johto</button>`;

    actionsEl.querySelector('#ji-accept').addEventListener('click', () => {
      _close();
      activateJohtoRegion();
      globalThis._zsel_setActiveRegion?.('johto');
      document.querySelectorAll('#regionSwitcher .region-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.region === 'johto');
      });
      globalThis.switchTab?.('tabZones');
      _notify('🌏 Johto débloqué ! Bienvenue à New Bark Town, Parrain...', 'gold');
    });

    actionsEl.querySelector('#ji-dismiss').addEventListener('click', () => {
      _close();
      _notify('📡 L\'offre reste disponible — bouton Johto ✉ dans les zones.', '');
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

function checkJohtoUnlock() {
  const state = globalThis.state;
  if (state.purchases?.johtoUnlocked) return;
  if (!state.zones?.['indigo_plateau']?.gymDefeated) return;
  if (state.gang.reputation < 500) return;

  // Cinématique déjà vue (joueur avait cliqué "Pas encore") → modal simple
  if (state.gang?.johtoCinematicSeen) {
    setTimeout(() => showJohtoUnlockModal(), 1200);
    return;
  }

  // Première fois → cinématique complète (johtoEvent.js)
  setTimeout(() => globalThis.showJohtoCinematic?.(), 1800);
}

Object.assign(globalThis, {
  activateJohtoRegion,
  showJohtoUnlockModal,
  checkJohtoUnlock,
});

export {};
