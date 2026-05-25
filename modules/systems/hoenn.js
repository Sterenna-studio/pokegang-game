'use strict';

import { EventBus, EVENTS } from '../core/eventBus.js';
import { getBossTeamPower } from './bossPower.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });
const _save   = ()               => globalThis.saveState?.();

// ── Hoenn region unlock system ───────────────────────────────────────────────
// Conditions de déblocage basées sur la puissance du gang (pas d'item requis).
//
// SEUIL : puissance combinée (équipe boss + agents de combat) >= HOENN_POWER_THRESHOLD
//         + Ligue Johto vaincue + réputation >= 2000
//
// Dépendances classiques (bare name — classic <script> globals) :
//   ZONES, ZONES_HOENN, ZONE_BY_ID, ZONE_MUSIC_MAP, ZONE_MUSIC_MAP_HOENN
//   SPECIAL_EVENTS, SPECIAL_EVENTS_HOENN
//
// Dépendances globalThis :
//   state, notify, saveState, trainerSprite, renderZonesTab, switchTab,
//   activeTab, _zsel_setActiveRegion, showHoennCinematic (set by hoennEvent.js)

// Puissance de gang minimale pour déclencher la cinématique Hoenn.
// Représente une équipe boss d'environ 4-5 Pokémon niv.30+ + quelques agents.
const HOENN_POWER_THRESHOLD = 2500;

// ── Helpers puissance gang ────────────────────────────────────────────────────

function _getAgentsTotalPower() {
  const agents = globalThis.state?.agents ?? [];
  // getAgentCombatPower est exposé par agent.js sur globalThis
  const fn = globalThis.getAgentCombatPower;
  if (!fn) return 0;
  return agents.reduce((sum, a) => sum + fn(a), 0);
}

function getGangPower() {
  const bossTeamPower = getBossTeamPower();
  const agentPower    = _getAgentsTotalPower();
  return bossTeamPower + agentPower;
}

// ── Activation de la région ────────────────────────────────────────────────────

function registerHoennSpecialEvents() {
  if (typeof SPECIAL_EVENTS === 'undefined' || typeof SPECIAL_EVENTS_HOENN === 'undefined') return;
  const existingEventIds = new Set(SPECIAL_EVENTS.map(ev => ev.id));
  SPECIAL_EVENTS_HOENN.forEach(ev => {
    if (existingEventIds.has(ev.id)) return;
    SPECIAL_EVENTS.push({ ...ev, region: 'hoenn' });
    existingEventIds.add(ev.id);
  });
}

function activateHoennRegion() {
  if (!ZONES.find(z => z.id === 'route101')) {
    ZONES.push(...ZONES_HOENN);
    ZONES_HOENN.forEach(z => { ZONE_BY_ID[z.id] = z; });
    Object.assign(ZONE_MUSIC_MAP, ZONE_MUSIC_MAP_HOENN);
  }
  registerHoennSpecialEvents();
  globalThis.state.purchases.hoennUnlocked = true;
  globalThis._zsel_setActiveRegion?.('kanto');
  if (globalThis.activeTab === 'tabZones') globalThis.renderZonesTab?.();
  _save();
}

// ── Modal silencieux (fallback si cinématique déjà vue mais unlock pas encore fait) ────

function showHoennUnlockModal() {
  const state = globalThis.state;
  if (state.purchases?.hoennUnlocked) return;
  if (document.getElementById('hoenn-intro-overlay')) return;

  const stevenSprite = globalThis.trainerSprite?.('steven') ?? '';
  const bossName = state.gang?.bossName || 'Parrain';

  const MESSAGE =
    `« ${bossName}. J'ai peu de temps, alors je serai direct.\n\n` +
    `Hoenn est une région à part. La mer y règne, la terre y gronde. ` +
    `Deux organisations se disputent le continent — la Team Magma, la Team Aqua. ` +
    `Leur folie pourrait réveiller des forces endormies depuis des millénaires.\n\n` +
    `La Ligue d'Hoenn a besoin d'un équilibre. Et vous avez la réputation pour le maintenir.\n\n` +
    `Je vous offre un accès : les routes de Bourg Natal sont ouvertes. ` +
    `Ne laissez pas Maxie ou Archie faire une erreur que le monde entier paierait.\n\n` +
    `Bonne chance. »`;

  const overlay = document.createElement('div');
  overlay.id = 'hoenn-intro-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:8100;
    background:linear-gradient(160deg,#02080e 0%,#061018 45%,#040c14 100%);
    display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
    font-family:var(--font-system,sans-serif);
    overflow:hidden;opacity:0;transition:opacity .4s ease;
  `;
  overlay.innerHTML = `
    <div style="position:absolute;inset:0;pointer-events:none;
      background:radial-gradient(ellipse at 50% 20%,rgba(20,100,200,.07) 0%,transparent 60%),
                 radial-gradient(ellipse at 20% 80%,rgba(0,160,100,.05) 0%,transparent 50%)"></div>
    <div id="hi-stage" style="position:absolute;inset:0;display:flex;flex-direction:column;
      align-items:center;justify-content:flex-end;padding:0 16px 0;"></div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '1'; });

  const stage = overlay.querySelector('#hi-stage');

  const portrait = document.createElement('div');
  portrait.style.cssText = `
    position:absolute;top:0;left:50%;transform:translateX(-50%);
    width:100%;max-width:560px;
    display:flex;align-items:flex-start;justify-content:center;
    padding-top:32px;pointer-events:none;
  `;
  portrait.innerHTML = `
    <div style="position:relative;text-align:center">
      <img src="${stevenSprite}"
        style="width:140px;height:140px;image-rendering:pixelated;
               filter:drop-shadow(0 8px 28px rgba(30,140,220,.45));
               animation:hi-bob 2.8s ease-in-out infinite"
        onerror="this.style.opacity='.25'">
      <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);
        width:80px;height:10px;
        background:radial-gradient(ellipse,rgba(0,0,0,.5) 0%,transparent 70%);
        filter:blur(3px)"></div>
    </div>`;
  overlay.appendChild(portrait);

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    width:100%;max-width:560px;
    background:rgba(2,6,12,.96);
    border:2px solid rgba(30,100,200,.5);
    border-radius:8px;
    padding:16px 18px 18px;
    margin-bottom:24px;
    box-shadow:0 -4px 32px rgba(0,0,0,.6),inset 0 0 0 1px rgba(255,255,255,.03);
    position:relative;
  `;
  dialog.innerHTML = `
    <div style="font-family:var(--font-pixel,monospace);font-size:7px;
      color:rgba(80,180,255,.85);letter-spacing:.8px;text-transform:uppercase;
      margin-bottom:8px">Pierre — Champion Hoenn</div>
    <div id="hi-text" style="font-size:14px;color:#ddeeff;line-height:1.7;min-height:46px;
      white-space:pre-wrap"></div>
    <div id="hi-actions" style="margin-top:16px;display:none;
      justify-content:flex-end;gap:10px"></div>
    <div id="hi-cursor" style="position:absolute;bottom:14px;right:16px;
      font-size:10px;color:rgba(80,180,255,.65);
      animation:hi-blink 1s ease-in-out infinite;display:none">▶</div>`;
  stage.appendChild(dialog);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes hi-bob   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
    @keyframes hi-blink { 0%,100%{opacity:.7} 50%{opacity:.15} }
    @keyframes hi-fadein{ from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
    #hi-stage > div { animation:hi-fadein .3s ease }
    .hi-btn-accept {
      font-family:var(--font-pixel,monospace);font-size:10px;
      padding:10px 20px;border-radius:6px;cursor:pointer;
      background:rgba(20,80,180,.9);color:#aaccff;
      border:1px solid rgba(60,140,220,.6);
      transition:background .15s,transform .1s;
    }
    .hi-btn-accept:hover  { background:rgba(30,100,210,.9);color:#cce0ff; }
    .hi-btn-accept:active { transform:scale(.97) }
    .hi-btn-dismiss {
      font-family:var(--font-pixel,monospace);font-size:9px;
      padding:8px 14px;border-radius:6px;cursor:pointer;
      background:transparent;color:rgba(255,255,255,.4);
      border:1px solid rgba(255,255,255,.12);
      transition:color .15s,border-color .15s;
    }
    .hi-btn-dismiss:hover { color:rgba(255,255,255,.7);border-color:rgba(255,255,255,.3); }
  `;
  document.head.appendChild(style);

  const textEl    = dialog.querySelector('#hi-text');
  const actionsEl = dialog.querySelector('#hi-actions');
  const cursor    = dialog.querySelector('#hi-cursor');
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
      <button class="hi-btn-dismiss" id="hi-dismiss">Pas encore...</button>
      <button class="hi-btn-accept"  id="hi-accept">→ Traverser vers Hoenn</button>`;

    actionsEl.querySelector('#hi-accept').addEventListener('click', () => {
      _close();
      activateHoennRegion();
      globalThis._zsel_setActiveRegion?.('hoenn');
      document.querySelectorAll('#regionSwitcher .region-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.region === 'hoenn');
      });
      globalThis.switchTab?.('tabZones');
      _notify('🌊 Hoenn débloqué ! Bienvenue à Bourg Natal, Parrain...', 'gold');
    });

    actionsEl.querySelector('#hi-dismiss').addEventListener('click', () => {
      _close();
      _notify("📡 L'offre reste disponible — bouton Hoenn ✉ dans les zones.", '');
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

// ── Vérification de déclenchement ─────────────────────────────────────────────

function checkHoennUnlock() {
  const state = globalThis.state;
  if (state.purchases?.hoennUnlocked) return;

  // Pré-requis 1 : Ligue Johto vaincue
  if (!state.zones?.['indigo_johto']?.gymDefeated) return;

  // Pré-requis 2 : Réputation suffisante
  if ((state.gang?.reputation ?? 0) < 2000) return;

  // Pré-requis 3 : Puissance de gang suffisante
  const gangPower = getGangPower();
  if (gangPower < HOENN_POWER_THRESHOLD) return;

  // Si la cinématique a déjà été vue mais Hoenn n'est pas encore activé
  // (ex: joueur a cliqué "Pas encore") → modal simple de confirmation
  if (state.gang?.hoennCinematicSeen) {
    setTimeout(() => showHoennUnlockModal(), 1200);
    return;
  }

  // Sinon : déclencher la cinématique complète
  setTimeout(() => globalThis.showHoennCinematic?.(), 1800);
}

Object.assign(globalThis, {
  activateHoennRegion,
  showHoennUnlockModal,
  checkHoennUnlock,
  getGangPower,
});

export {};
