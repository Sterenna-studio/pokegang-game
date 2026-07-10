'use strict';

// ════════════════════════════════════════════════════════════════
//  DEOXYS MISSION — "Opération : Forme ADN"
//  Quête légendaire late-game inspirée du film Destiny Deoxys
//
//  5 objectifs en séquence :
//    1. Signal Anomal      — Vaincre 20 dresseurs dans les zones Hoenn
//    2. Fragments          — Collecter 3 Météores (0,5 % par combat Hoenn)
//    3. Infiltration       — Vaincre 10 combats dans le Laboratoire Spatial
//    4. Prise de Contrôle  — Vaincre le Directeur du Laboratoire
//    5. Confrontation      — Combat final contre Deoxys
//  Rejouable : 1 Météore permet de relancer l'étape 5 uniquement.
//
//  Déclenchement :
//    checkDeoxysMissionUnlock()   — à appeler au boot et après Ever Grande
//    openDeoxysMission()          — ouvre le tracker de quête
//
//  Dépendances globalThis :
//    state, saveState, notify, makePokemon, speciesName,
//    calculateStats, getBossTeamPower, switchTab
//  Dépendances bare-name (classic scripts) :
//    ZONE_HOENN_BY_ID, SPECIES_BY_EN
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';
import { resolveSpecialCombat } from './specialCombat.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });
const _save   = ()               => globalThis.saveState?.();

// ── Assets ────────────────────────────────────────────────────
const DEOXYS_SPRITE     = 'assets/pokemon_sprite/legendary_fight_by_muzyun/deoxys.png';
const DEOXYS_FIGHT_FULL = 'assets/pokemon_sprite/legendary_fight_by_muzyun/deoxys_fight_full.png';
const DEOXYS_FIGHT_HALF = 'assets/pokemon_sprite/legendary_fight_by_muzyun/deoxys_fight_half.png';

// ── Config ────────────────────────────────────────────────────
const TARGET_TRAINERS    = 20;
const TARGET_METEORES    = 3;
const TARGET_LAB_FIGHTS  = 10;
const METEORE_DROP_CHANCE = 0.005;   // 0.5 % par combat Hoenn
const LAB_ZONE_ID        = 'laboratoire_spatial';

// Seuils de puissance boss
const DIRECTOR_POWER_THRESHOLD = 1500;
const DEOXYS_POWER_THRESHOLD   = 3500;
const DEOXYS_CATCH_BASE        = 0.45; // taux de capture de base si puissance >= seuil

// ── Helpers ───────────────────────────────────────────────────
const _state = ()  => globalThis.state ?? null;

function _qs() {
  const s = _state();
  if (!s) return null;
  if (!s.deoxysMission) {
    s.deoxysMission = {
      active: false, step: 0,
      trainersDefeated: 0, labFightsWon: 0,
      labBossDefeated: false, deoxysOwned: false, totalCaptures: 0,
    };
  }
  return s.deoxysMission;
}

function _isHoennZone(zoneId) {
  if (!zoneId) return false;
  if (typeof ZONE_HOENN_BY_ID !== 'undefined' && ZONE_HOENN_BY_ID[zoneId]) return true;
  // Fallback : ids contenus dans des data strings
  return false;
}

function _wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function _typewrite(el, text, speed = 24) {
  return new Promise(resolve => {
    el.textContent = '';
    let i = 0;
    const tick = () => {
      if (i < text.length) { el.textContent += text[i++]; setTimeout(tick, speed); }
      else resolve();
    };
    tick();
  });
}

// ── EventBus : tracking objectifs ─────────────────────────────
let _registered = false;

function _register() {
  if (_registered) return;
  _registered = true;
  EventBus.on(EVENTS.COMBAT_WON, _onCombatWon);
}

function _onCombatWon({ zoneId } = {}) {
  const q = _qs();
  if (!q?.active) return;
  const hoenn = _isHoennZone(zoneId);

  // Objectif 1 — combats Hoenn
  if (q.step === 1 && hoenn) {
    q.trainersDefeated = Math.min((q.trainersDefeated || 0) + 1, TARGET_TRAINERS);
    if (q.trainersDefeated >= TARGET_TRAINERS) {
      q.step = 2;
      _notify('☄️ Signal localisé ! Collectez 3 Météores dans les zones Hoenn.', 'gold');
    }
    _save();
  }

  // Objectif 3 — combats dans le labo
  if (q.step === 3 && zoneId === LAB_ZONE_ID) {
    q.labFightsWon = Math.min((q.labFightsWon || 0) + 1, TARGET_LAB_FIGHTS);
    if (q.labFightsWon >= TARGET_LAB_FIGHTS) {
      q.step = 4;
      _notify('☄️ Laboratoire infiltré ! Affrontez le Directeur Devon depuis la quête.', 'gold');
    }
    _save();
  }

  // Drop météore (0,5 % sur toute zone Hoenn à partir de l'étape 1)
  if (hoenn && q.step >= 1 && q.step <= 4) {
    if (Math.random() < METEORE_DROP_CHANCE) {
      const inv = _state().inventory;
      inv.meteore = (inv.meteore || 0) + 1;
      _notify('☄️ Météore récupéré ! Consultez la quête Deoxys.', 'gold');

      // Objectif 2 — check seuil météores
      if (q.step === 2 && inv.meteore >= TARGET_METEORES) {
        inv.meteore -= TARGET_METEORES;      // consomme les 3 météores
        q.step = 3;
        _notify('☄️ Fragments récoltés ! Infiltrez le Laboratoire Spatial Devon.', 'gold');
      }
      _save();
    }
  }
}

// Hook depuis zoneSystem.js (reward.itemGift)
function _onItemGiftReceived(itemId) {
  if (itemId !== 'meteore') return;
  const q = _qs();
  if (!q?.active || q.step !== 2) return;
  const inv = _state()?.inventory;
  if (!inv) return;
  if (inv.meteore >= TARGET_METEORES) {
    inv.meteore -= TARGET_METEORES;
    q.step = 3;
    _notify('☄️ Fragments récoltés ! Infiltrez le Laboratoire Spatial Devon.', 'gold');
    _save();
  }
}

// ── Styles (prefix dxq-) ──────────────────────────────────────
function _injectStyles() {
  if (document.getElementById('dxq-styles')) return;
  const style = document.createElement('style');
  style.id = 'dxq-styles';
  style.textContent = `
    /* ── Overlay de base ── */
    #dxq-overlay {
      position:fixed; inset:0; z-index:9100;
      background:#03030f;
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      padding:20px 16px;
      overflow-y:auto;
      animation:dxq-fadein .5s ease both;
      user-select:none;
    }
    @keyframes dxq-fadein  { from{opacity:0} to{opacity:1} }
    @keyframes dxq-fadeout { from{opacity:1} to{opacity:0} }
    @keyframes dxq-pulse   { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
    @keyframes dxq-holo    {
      0%   { filter:hue-rotate(0deg)   brightness(1.2); }
      50%  { filter:hue-rotate(60deg)  brightness(1.5); }
      100% { filter:hue-rotate(0deg)   brightness(1.2); }
    }
    @keyframes dxq-bob     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
    @keyframes dxq-tremble { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-2px,1px)} 75%{transform:translate(2px,-1px)} }
    @keyframes dxq-appear  { from{opacity:0;transform:scale(.85) translateY(14px)} to{opacity:1;transform:none} }
    @keyframes dxq-flash   { 0%{opacity:0} 15%{opacity:1} 100%{opacity:0} }

    /* ── Boîte principale ── */
    .dxq-box {
      max-width:540px; width:100%;
      background:rgba(4,4,20,.97);
      border:1px solid rgba(0,200,255,.2);
      padding:22px 24px 20px;
      position:relative;
      box-shadow:0 0 40px rgba(0,150,255,.08), inset 0 0 0 1px rgba(255,255,255,.03);
    }
    .dxq-box::before {
      content:'';
      position:absolute; left:0; top:0; bottom:0; width:3px;
      background:linear-gradient(to bottom,#00c8ff,#7b2fff,#00c8ff);
      opacity:.7;
    }

    /* ── Typo ── */
    .dxq-label {
      font-family:var(--font-pixel,monospace);
      font-size:7px; letter-spacing:3px;
      text-transform:uppercase;
      color:rgba(0,200,255,.7);
      margin-bottom:14px;
    }
    .dxq-title {
      font-family:var(--font-pixel,monospace);
      font-size:10px; letter-spacing:2px;
      text-transform:uppercase;
      color:#00e5ff;
      margin-bottom:6px;
    }
    .dxq-text {
      font-family:var(--font-pixel,monospace);
      font-size:8.5px; line-height:2;
      color:#bcd8e8;
      min-height:60px;
      margin-bottom:16px;
      white-space:pre-wrap;
    }
    .dxq-voice {
      font-family:var(--font-pixel,monospace);
      font-size:8px; line-height:2.2;
      color:#7b8fff;
      text-align:center; letter-spacing:1px;
      white-space:pre-wrap; font-style:italic;
      margin-bottom:14px;
    }

    /* ── Boutons ── */
    .dxq-choices { display:flex; flex-direction:column; gap:8px; }
    .dxq-btn {
      background:none;
      border:1px solid rgba(0,150,255,.25);
      color:#7a9ab8;
      font-family:var(--font-pixel,monospace);
      font-size:7px; padding:10px 14px;
      text-align:left; cursor:pointer;
      letter-spacing:1px;
      transition:border-color .18s, color .18s, background .18s;
    }
    .dxq-btn:hover { border-color:#00c8ff; color:#e0f4ff; background:rgba(0,200,255,.06); }
    .dxq-btn.cyan  { border-color:#00c8ff; color:#00e5ff; }
    .dxq-btn.cyan:hover { background:rgba(0,200,255,.1); }
    .dxq-btn.gold  { border-color:#ffcc5a; color:#ffcc5a; }
    .dxq-btn.gold:hover { background:rgba(255,204,90,.08); }
    .dxq-btn.red   { border-color:#cc1111; color:#e63535; }
    .dxq-btn:disabled { opacity:.35; cursor:not-allowed; }

    /* ── Sprite Deoxys ── */
    .dxq-sprite-wrap {
      text-align:center; margin-bottom:16px;
      position:relative; display:inline-block;
    }
    .dxq-sprite-wrap.aura::before {
      content:'';
      position:absolute; inset:-16px;
      border-radius:50%; pointer-events:none;
      background:radial-gradient(ellipse,rgba(0,200,255,.3) 0%,rgba(123,47,255,.15) 50%,transparent 75%);
      animation:dxq-pulse 2.2s ease-in-out infinite;
    }
    .dxq-sprite {
      width:110px; height:110px;
      image-rendering:pixelated;
      animation:dxq-appear .6s .1s both, dxq-bob 3s ease-in-out infinite;
      position:relative; z-index:1;
    }
    .dxq-sprite.silhouette { filter:brightness(0) drop-shadow(0 0 10px rgba(0,200,255,.5)); }
    .dxq-sprite.revealed   {
      filter:brightness(.1) saturate(0)
             drop-shadow(0 0 14px rgba(0,200,255,.6))
             drop-shadow(0 0 6px rgba(123,47,255,.7));
    }
    .dxq-sprite.holo { animation:dxq-bob 3s ease-in-out infinite, dxq-holo 3s linear infinite; }

    /* ── Combat backdrop ── */
    .dxq-fight-bg {
      width:100%; max-height:180px; object-fit:cover;
      object-position:center top;
      border:1px solid rgba(0,200,255,.15);
      margin-bottom:12px;
      image-rendering:pixelated;
    }

    /* ── Quest tracker ── */
    .dxq-tracker { display:flex; flex-direction:column; gap:10px; }
    .dxq-step {
      display:flex; align-items:flex-start; gap:12px;
      padding:10px 12px;
      background:rgba(0,0,0,.3);
      border:1px solid rgba(0,200,255,.1);
      border-radius:3px;
      transition:border-color .2s;
    }
    .dxq-step.active  { border-color:rgba(0,200,255,.5); background:rgba(0,200,255,.05); }
    .dxq-step.done    { border-color:rgba(0,255,120,.3); background:rgba(0,255,120,.04); opacity:.8; }
    .dxq-step.locked  { opacity:.35; }
    .dxq-step-num {
      font-family:var(--font-pixel,monospace);
      font-size:16px; font-weight:700;
      color:rgba(0,200,255,.4);
      flex:0 0 28px; line-height:1;
      margin-top:2px;
    }
    .dxq-step.active .dxq-step-num { color:#00e5ff; }
    .dxq-step.done   .dxq-step-num { color:#00ff88; }
    .dxq-step-body { flex:1; min-width:0; }
    .dxq-step-title {
      font-family:var(--font-pixel,monospace);
      font-size:8px; letter-spacing:1px;
      color:#9ab8d0; margin-bottom:4px;
    }
    .dxq-step.active .dxq-step-title { color:#c8eeff; }
    .dxq-step.done   .dxq-step-title { color:#88ffaa; }
    .dxq-step-desc {
      font-size:8px; color:#5a7a90;
      line-height:1.7;
    }
    .dxq-step.active .dxq-step-desc { color:#8ab4cc; }
    .dxq-progress-bar {
      height:3px; background:rgba(0,200,255,.12);
      border-radius:2px; margin-top:6px; overflow:hidden;
    }
    .dxq-progress-fill {
      height:100%; background:linear-gradient(90deg,#00c8ff,#7b2fff);
      border-radius:2px;
      transition:width .4s ease;
    }
    .dxq-step-action { margin-top:8px; }

    /* ── Power bar ── */
    .dxq-power-row {
      display:flex; align-items:center; gap:10px;
      padding:10px 12px;
      background:rgba(0,0,0,.4);
      border:1px solid rgba(255,204,90,.15);
      border-radius:3px;
      margin-top:12px;
    }
    .dxq-power-label { font-family:var(--font-pixel,monospace); font-size:7px; color:#8a9ab0; flex:1; }
    .dxq-power-val   { font-family:var(--font-pixel,monospace); font-size:9px; color:#ffcc5a; }

    /* ── Météore counter ── */
    .dxq-meteore-row {
      display:flex; align-items:center; gap:8px;
      padding:8px 12px;
      background:rgba(255,204,90,.04);
      border:1px solid rgba(255,204,90,.15);
      border-radius:3px;
      font-family:var(--font-pixel,monospace);
      font-size:8px; color:#ffcc5a;
      margin-top:8px;
    }

    /* ── Flash overlay ── */
    #dxq-flash {
      position:fixed; inset:0; z-index:9200;
      background:#fff;
      pointer-events:none;
      animation:dxq-flash .6s ease forwards;
    }

    /* ── Result badge ── */
    .dxq-badge {
      font-family:var(--font-pixel,monospace);
      font-size:9px; letter-spacing:2px;
      color:#00e5ff; text-align:center;
      border:1px solid rgba(0,200,255,.3);
      padding:8px 14px;
      margin-bottom:14px;
      text-transform:uppercase;
    }
    .dxq-badge.gold  { color:#ffcc5a; border-color:rgba(255,204,90,.4); }
    .dxq-badge.green { color:#00ff88; border-color:rgba(0,255,136,.4); }
    .dxq-badge.red   { color:#ff8080; border-color:rgba(255,128,128,.4); }
  `;
  document.head.appendChild(style);
}

// ── Overlay helpers ───────────────────────────────────────────
let _overlay = null;

function _buildOverlay() {
  _injectStyles();
  const el = document.createElement('div');
  el.id = 'dxq-overlay';
  document.body.appendChild(el);
  _overlay = el;
  return el;
}

function _clearOverlay() { if (_overlay) _overlay.innerHTML = ''; }

function _closeOverlay(ms = 400) {
  if (!_overlay) return;
  _overlay.style.transition = `opacity ${ms}ms ease`;
  _overlay.style.opacity = '0';
  setTimeout(() => { _overlay?.remove(); _overlay = null; }, ms);
}

function _box() {
  const b = document.createElement('div');
  b.className = 'dxq-box';
  _overlay.appendChild(b);
  return b;
}

function _label(box, text) {
  const el = document.createElement('div');
  el.className = 'dxq-label';
  el.textContent = text;
  box.appendChild(el);
  return el;
}

function _titleEl(box, text) {
  const el = document.createElement('div');
  el.className = 'dxq-title';
  el.textContent = text;
  box.appendChild(el);
  return el;
}

function _textEl(box) {
  const el = document.createElement('div');
  el.className = 'dxq-text';
  box.appendChild(el);
  return el;
}

function _choices(box) {
  const el = document.createElement('div');
  el.className = 'dxq-choices';
  box.appendChild(el);
  return el;
}

function _btn(label, cls = '') {
  const el = document.createElement('button');
  el.className = 'dxq-btn' + (cls ? ' ' + cls : '');
  el.textContent = label;
  return el;
}

// ── Flash blanc ───────────────────────────────────────────────
function _flash() {
  const el = document.createElement('div');
  el.id = 'dxq-flash';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 650);
}

// ════════════════════════════════════════════════════════════════
//  INTRO — déclenchée quand les conditions sont remplies
// ════════════════════════════════════════════════════════════════

async function _showQuestIntro() {
  if (_overlay) return;
  _buildOverlay();

  // Étape 0 : noir pendant 800ms
  await _wait(800);

  // Étape 1 : message Devon Research
  _clearOverlay();
  const box = _box();
  _label(box, 'Devon Research Corporation — Signal classifié');
  _titleEl(box, '☄️  Anomalie Extraterrestre Détectée');
  const txt = _textEl(box);

  await _typewrite(txt,
    'Professeur Cozmo vient de nous transmettre des données alarmantes.\n\n' +
    'Un objet non-identifié a pénétré l\'atmosphère il y a 72 heures.\n' +
    'Les relevés indiquent une signature ADN… vivante.\n\n' +
    'Devon a localisé le signal : il émane de plusieurs zones Hoenn.\n' +
    'Nos laboratoires sont en alerte maximale.\n\n' +
    'Nous avons besoin d\'une organisation capable de mener une opération discrète.\n' +
    'Votre réputation vous précède, Parrain.',
  );

  const ch = _choices(box);
  const bAcc = _btn('▸  Accepter l\'opération "Forme ADN"', 'cyan');
  const bDec = _btn('▸  Pas maintenant — fermer');

  bAcc.onclick = () => {
    const q = _qs();
    if (!q) return;
    q.active = true;
    q.step   = 1;
    _save();
    _showQuestStep2();
  };
  bDec.onclick = () => {
    _closeOverlay();
    _notify('☄️ Quête Deoxys disponible — rouvrez-la depuis les zones Hoenn.', '');
  };

  ch.appendChild(bAcc);
  ch.appendChild(bDec);
}

async function _showQuestStep2() {
  _clearOverlay();
  const box = _box();
  _label(box, 'Devon Research Corporation');

  // Deoxys silhouette
  const sw = document.createElement('div');
  sw.className = 'dxq-sprite-wrap aura';
  sw.style.display = 'block';
  sw.style.textAlign = 'center';
  sw.style.marginBottom = '16px';
  const img = document.createElement('img');
  img.src = DEOXYS_SPRITE;
  img.className = 'dxq-sprite silhouette';
  img.alt = '???';
  sw.appendChild(img);
  box.appendChild(sw);

  const txt = _textEl(box);
  await _typewrite(txt,
    'Les scanners captent une présence aux abords de la Tour Céleste\n' +
    'et du Mont Chimère. Elle se déplace. Elle observe.\n\n' +
    'Nous l\'appelons provisoirement… "Forme ADN".\n\n' +
    'Première mission : établissez votre emprise sur Hoenn.\n' +
    'Affrontez les dresseurs locaux — 20 combats — pour repérer\n' +
    'les zones d\'activité du signal.',
  );

  const ch = _choices(box);
  const bStart = _btn('▸  Commencer la mission →', 'cyan');
  bStart.onclick = () => {
    _closeOverlay();
    globalThis.switchTab?.('tabZones');
    _notify('☄️ Étape 1/5 — Vaincre 20 dresseurs dans les zones Hoenn.', 'gold');
  };
  ch.appendChild(bStart);
}

// ════════════════════════════════════════════════════════════════
//  TRACKER — vue d'ensemble de la quête
// ════════════════════════════════════════════════════════════════

function openDeoxysMission() {
  if (_overlay) return;
  const q = _qs();
  if (!q) return;

  // Si pas encore active → montrer l'intro
  if (!q.active) {
    _showQuestIntro();
    return;
  }

  _buildOverlay();
  _renderTracker();
}

function _renderTracker() {
  _clearOverlay();
  if (!_overlay) return;
  const q = _qs();
  const s = _state();
  if (!q || !s) return;

  const bosspower = globalThis.getBossTeamPower?.() ?? 0;
  const meteores  = s.inventory?.meteore ?? 0;

  const box = _box();
  _label(box, '— Quête Légendaire —');
  _titleEl(box, '☄️  Opération : Forme ADN');

  // Météore counter
  const mRow = document.createElement('div');
  mRow.className = 'dxq-meteore-row';
  mRow.innerHTML = `☄️ Météores : <strong style="margin-left:4px">${meteores}</strong>
    <span style="opacity:.5;font-size:7px;margin-left:8px">— 0,5 % par combat Hoenn</span>`;
  box.appendChild(mRow);

  // Power
  const pRow = document.createElement('div');
  pRow.className = 'dxq-power-row';
  pRow.innerHTML = `<span class="dxq-power-label">Puissance Boss</span>
    <span class="dxq-power-val">${bosspower.toLocaleString()}</span>`;
  box.appendChild(pRow);

  // ── 5 étapes ──
  const tracker = document.createElement('div');
  tracker.className = 'dxq-tracker';
  tracker.style.marginTop = '14px';
  box.appendChild(tracker);

  const steps = [
    {
      n: 1, title: 'Signal Anomal',
      desc: `Vaincre 20 dresseurs dans les zones Hoenn`,
      progress: q.step > 1 ? 1 : (q.trainersDefeated || 0) / TARGET_TRAINERS,
      progressLabel: `${Math.min(q.trainersDefeated || 0, TARGET_TRAINERS)} / ${TARGET_TRAINERS}`,
    },
    {
      n: 2, title: 'Fragments de Météorite',
      desc: `Collecter 3 Météores (0,5 % par combat Hoenn)\nActuellement : ${meteores} météore${meteores !== 1 ? 's' : ''} en inventaire`,
      progress: q.step > 2 ? 1 : Math.min(meteores, TARGET_METEORES) / TARGET_METEORES,
    },
    {
      n: 3, title: 'Infiltration du Laboratoire',
      desc: `Vaincre 10 combats dans le Laboratoire Spatial Devon`,
      progress: q.step > 3 ? 1 : (q.labFightsWon || 0) / TARGET_LAB_FIGHTS,
      progressLabel: `${Math.min(q.labFightsWon || 0, TARGET_LAB_FIGHTS)} / ${TARGET_LAB_FIGHTS}`,
    },
    {
      n: 4, title: 'Prise de Contrôle',
      desc: `Vaincre le Directeur du Laboratoire Devon\n(Puissance requise : ${DIRECTOR_POWER_THRESHOLD.toLocaleString()})`,
      actionLabel: '⚔ Affronter le Directeur →',
      actionAvail: q.step === 4,
      actionFn: () => { _closeOverlay(); setTimeout(_launchDirectorFight, 300); },
    },
    {
      n: 5, title: 'Confrontation : Forme ADN',
      desc: `Combat final contre Deoxys\n(Puissance requise : ${DEOXYS_POWER_THRESHOLD.toLocaleString()})`,
      actionLabel: q.step === 6 ? '♺ Rejouer (1 Météore)' : '☄ Affronter Deoxys →',
      actionAvail: q.step === 5 || (q.step === 6 && meteores >= 1),
      actionFn: () => {
        if (q.step === 6) {
          // Repeat mode: spend 1 météore
          _state().inventory.meteore--;
          _save();
        }
        _closeOverlay();
        setTimeout(_launchDeoxysFight, 300);
      },
    },
  ];

  for (const st of steps) {
    const div  = document.createElement('div');
    const done = q.step > st.n || (st.n === 5 && q.step === 6 && q.deoxysOwned);
    const active = q.step === st.n || (st.n === 5 && q.step === 6);
    const locked = q.step < st.n && !(st.n === 5 && q.step === 6);

    div.className = 'dxq-step' +
      (done   ? ' done'   : '') +
      (active ? ' active' : '') +
      (locked ? ' locked' : '');

    const numEl = document.createElement('div');
    numEl.className = 'dxq-step-num';
    numEl.textContent = done ? '✓' : String(st.n);

    const body = document.createElement('div');
    body.className = 'dxq-step-body';

    const titleEl = document.createElement('div');
    titleEl.className = 'dxq-step-title';
    titleEl.textContent = st.title;

    const descEl = document.createElement('div');
    descEl.className = 'dxq-step-desc';
    descEl.style.whiteSpace = 'pre-wrap';
    descEl.textContent = st.desc || '';

    body.appendChild(titleEl);
    body.appendChild(descEl);

    // Barre de progression
    if (st.progress !== undefined) {
      const pct = Math.min(Math.round(st.progress * 100), 100);
      const barWrap = document.createElement('div');
      barWrap.className = 'dxq-progress-bar';
      barWrap.title = st.progressLabel || `${pct}%`;
      const fill = document.createElement('div');
      fill.className = 'dxq-progress-fill';
      fill.style.width = pct + '%';
      barWrap.appendChild(fill);
      body.appendChild(barWrap);
    }

    // Bouton d'action
    if (st.actionLabel && (active || (st.n === 5 && q.step === 6))) {
      const actDiv = document.createElement('div');
      actDiv.className = 'dxq-step-action';
      const actBtn = _btn(st.actionLabel, 'cyan');
      if (!st.actionAvail) actBtn.disabled = true;
      else actBtn.onclick = st.actionFn;
      actDiv.appendChild(actBtn);
      body.appendChild(actDiv);
    }

    div.appendChild(numEl);
    div.appendChild(body);
    tracker.appendChild(div);
  }

  // Bouton fermer
  const ch = _choices(box);
  ch.style.marginTop = '14px';
  const bClose = _btn('✕  Fermer');
  bClose.onclick = () => _closeOverlay();
  ch.appendChild(bClose);
}

// ════════════════════════════════════════════════════════════════
//  ÉTAPE 4 — Directeur du Laboratoire
// ════════════════════════════════════════════════════════════════

async function _launchDirectorFight() {
  if (_overlay) return;
  const q = _qs();
  if (!q || q.step !== 4) return;

  _buildOverlay();

  const bosspower = globalThis.getBossTeamPower?.() ?? 0;
  const qualified = bosspower >= DIRECTOR_POWER_THRESHOLD;

  _clearOverlay();
  const box = _box();
  _label(box, 'Étape 4 — Prise de Contrôle');
  _titleEl(box, '⚔  Combat : Directeur Devon Stone');

  const txt = _textEl(box);
  await _typewrite(txt,
    'Le Directeur Devon Stone bloque l\'accès au cœur du laboratoire.\n\n' +
    'Son équipe de recherche : Metang, Claydol, Porygon-Z.\n' +
    'Des machines de précision, entraînées dans des conditions extrêmes.\n\n' +
    '"Vous n\'avez aucun droit d\'être ici. Mes Pokémon n\'ont pas perdu\n' +
    'depuis 3 ans. Partez pendant que vous le pouvez encore."',
  );

  // Jauge de puissance
  const pct = Math.min(bosspower / DIRECTOR_POWER_THRESHOLD, 1);
  const needed = Math.max(0, DIRECTOR_POWER_THRESHOLD - bosspower);
  const pRow = document.createElement('div');
  pRow.className = 'dxq-power-row';
  pRow.innerHTML = `
    <span class="dxq-power-label">Votre puissance</span>
    <span class="dxq-power-val">${bosspower.toLocaleString()} / ${DIRECTOR_POWER_THRESHOLD.toLocaleString()}</span>`;
  box.appendChild(pRow);

  if (!qualified) {
    const warn = document.createElement('div');
    warn.style.cssText = 'font-family:var(--font-pixel,monospace);font-size:7px;color:#cc1111;padding:8px 0;letter-spacing:1px';
    warn.textContent = `Puissance insuffisante — il vous manque ${needed.toLocaleString()} points. Renforcez votre équipe.`;
    box.appendChild(warn);
  }

  const ch = _choices(box);

  if (qualified) {
    const bFight = _btn('⚔  Engager le combat →', 'cyan');
    bFight.onclick = async () => {
      bFight.disabled = true;
      bFight.textContent = '…';
      await _wait(600);
      _flash();
      await _wait(700);
      _clearOverlay();
      const { win } = resolveSpecialCombat({ power: bosspower, requiredPower: DIRECTOR_POWER_THRESHOLD });
      if (win) await _directorVictory();
      else     await _directorDefeat();
    };
    ch.appendChild(bFight);
  }

  const bBack = _btn('← Revenir au tracker');
  bBack.onclick = () => { _clearOverlay(); _renderTracker(); };
  ch.appendChild(bBack);
}

async function _directorVictory() {
  const q = _qs();
  const box = _box();
  _label(box, 'Étape 4 — Résultat');

  const badge = document.createElement('div');
  badge.className = 'dxq-badge green';
  badge.textContent = '✓  Directeur Devon Stone — Vaincu';
  box.appendChild(badge);

  const txt = _textEl(box);
  await _typewrite(txt,
    'Stone tombe à genoux.\n\n' +
    '"C\'est… impossible. Mon équipe n\'a jamais…"\n\n' +
    'Il se relève lentement, les yeux fixés sur l\'écran principal.\n' +
    'La forme ADN pulse sur les moniteurs, plus forte que jamais.\n\n' +
    '"Si vous pouvez vaincre ça… alors peut-être que vous méritez\n' +
    'ce que vous êtes venu chercher. La chambre de confinement\n' +
    'est au sous-sol. Mais vous n\'êtes pas prêts."\n\n' +
    'Il dégage l\'entrée.',
  );

  q.labBossDefeated = true;
  q.step = 5;
  _save();
  _notify('☄️ Étape 4 complète ! Affrontez Deoxys depuis le tracker.', 'gold');

  const ch = _choices(box);
  const bNext = _btn('▸  Accéder au sous-sol →', 'cyan');
  bNext.onclick = () => { _clearOverlay(); setTimeout(_launchDeoxysFight, 300); };
  const bTrack = _btn('← Retour au tracker');
  bTrack.onclick = () => { _clearOverlay(); _renderTracker(); };
  ch.appendChild(bNext);
  ch.appendChild(bTrack);
}

async function _directorDefeat() {
  const box = _box();
  _label(box, 'Étape 4 — Résultat');

  const badge = document.createElement('div');
  badge.className = 'dxq-badge red';
  badge.textContent = '✗  Directeur Devon Stone — Défaite';
  box.appendChild(badge);

  const txt = _textEl(box);
  await _typewrite(txt,
    'Metang encaisse le dernier assaut sans broncher.\n\n' +
    '"Revenez quand vous serez prêts."\n\n' +
    'Renforcez votre équipe et retentez votre chance.',
  );

  _notify('☄️ Défaite contre le Directeur Devon Stone.', 'error');

  const ch = _choices(box);
  const bRetry = _btn('⚔  Retenter →', 'cyan');
  bRetry.onclick = () => { _clearOverlay(); setTimeout(_launchDirectorFight, 300); };
  const bTrack = _btn('← Retour au tracker');
  bTrack.onclick = () => { _clearOverlay(); _renderTracker(); };
  ch.appendChild(bRetry);
  ch.appendChild(bTrack);
}

// ════════════════════════════════════════════════════════════════
//  ÉTAPE 5 — Combat Deoxys
// ════════════════════════════════════════════════════════════════

async function _launchDeoxysFight() {
  if (_overlay) return;
  const q = _qs();
  if (!q || (q.step !== 5 && q.step !== 6)) return;

  _buildOverlay();

  const bosspower = globalThis.getBossTeamPower?.() ?? 0;

  // ─ Intro ─
  _clearOverlay();
  const box = _box();
  _label(box, 'Étape 5 — Confrontation Finale');

  // Image combat
  const fightImg = document.createElement('img');
  fightImg.src = DEOXYS_FIGHT_HALF;
  fightImg.className = 'dxq-fight-bg';
  fightImg.alt = 'Deoxys';
  box.appendChild(fightImg);

  const txt = _textEl(box);
  await _typewrite(txt,
    'La chambre de confinement vibre.\n\n' +
    'Deoxys flotte au centre, son cristal nucléaire pulsant d\'une\n' +
    'lumière qui transperce l\'obscurité.\n\n' +
    'Il n\'est pas prisonnier.\n' +
    'Il attend.',
    20,
  );

  const ch = _choices(box);
  const bFight = _btn('☄  Engager le combat →', 'cyan');
  const bFlee  = _btn('← Reculer (sans pénalité)');

  bFight.onclick = async () => { bFight.disabled = true; bFlee.disabled = true; await _deoxysPhases(bosspower); };
  bFlee.onclick  = () => { _closeOverlay(); };

  ch.appendChild(bFight);
  ch.appendChild(bFlee);
}

async function _deoxysPhases(bosspower) {
  const phases = [
    {
      name: 'Forme Attaque',
      desc: 'Les tentacules de Deoxys se déploient en lames tranchantes.\nPuissance brute concentrée en un seul impact.',
      color: '#ff3333',
    },
    {
      name: 'Forme Défense',
      desc: 'Le cristal se rétracte. Une carapace translucide\nenveloppe sa silhouette — presque impénétrable.',
      color: '#3399ff',
    },
    {
      name: 'Forme Vitesse',
      desc: 'Il disparaît.\nTu ne le vois plus — tu ne fais que subir.',
      color: '#33ffcc',
    },
  ];

  for (let i = 0; i < phases.length; i++) {
    _clearOverlay();
    const box = _box();
    const phase = phases[i];

    const badge = document.createElement('div');
    badge.className = 'dxq-badge';
    badge.style.borderColor = `rgba(${phase.color.slice(1).match(/../g).map(x=>parseInt(x,16)).join(',')}, .4)`;
    badge.style.color = phase.color;
    badge.textContent = `— PHASE ${i + 1} / 3 — ${phase.name} —`;
    box.appendChild(badge);

    // Deoxys avec style de phase
    const sw = document.createElement('div');
    sw.className = 'dxq-sprite-wrap aura';
    sw.style.display = 'block';
    sw.style.textAlign = 'center';
    const img = document.createElement('img');
    img.src = DEOXYS_SPRITE;
    img.className = 'dxq-sprite holo';
    img.style.filter = `drop-shadow(0 0 18px ${phase.color}) hue-rotate(${i * 90}deg)`;
    img.alt = 'Deoxys';
    sw.appendChild(img);
    box.appendChild(sw);

    const txt = _textEl(box);
    await _typewrite(txt, phase.desc, 28);

    if (i < phases.length - 1) {
      await _wait(400);
      const ch = _choices(box);
      const bNext = _btn(`▸  Phase suivante →`, 'cyan');
      await new Promise(res => { bNext.onclick = () => { ch.innerHTML = ''; res(); }; ch.appendChild(bNext); });
      _flash();
      await _wait(500);
    }
  }

  // ─ Résolution ─
  await _wait(300);
  _flash();
  await _wait(800);
  _deoxysResolution(bosspower);
}

async function _deoxysResolution(bosspower) {
  _clearOverlay();
  const q = _qs();
  const box = _box();

  const qualified = bosspower >= DEOXYS_POWER_THRESHOLD;
  const powerRatio = bosspower / DEOXYS_POWER_THRESHOLD;
  // Tentative "quand même" sous le seuil : chance réduite dédiée (pas la formule
  // partagée, qui suppose un jet normal au-dessus du seuil requis).
  const winChance = qualified
    ? resolveSpecialCombat({ power: bosspower, requiredPower: DEOXYS_POWER_THRESHOLD, baseChance: 0.5 }).chance
    : powerRatio * 0.3;
  const won = Math.random() < winChance;

  _label(box, 'Résultat du combat');

  // Image plein écran
  const fightImg = document.createElement('img');
  fightImg.src = DEOXYS_FIGHT_FULL;
  fightImg.className = 'dxq-fight-bg';
  fightImg.alt = 'Deoxys';
  box.appendChild(fightImg);

  const txt = _textEl(box);

  if (won) {
    // Tentative de capture
    const catchRoll = Math.random() < (DEOXYS_CATCH_BASE + (powerRatio - 1) * 0.2);

    if (catchRoll) {
      await _typewrite(txt,
        'Deoxys s\'immobilise.\n\n' +
        'Son cristal s\'assombrit, vacille. Puis cède.\n\n' +
        'La Poké Ball roule sur le sol du laboratoire.\n' +
        'Un clic. Deux clics. Trois clics.\n\n' +
        '…\n\n' +
        '          ★  Capturé.',
      );

      // Ajouter Deoxys au PC
      _addDeoxysToPC();
      q.deoxysOwned   = true;
      q.totalCaptures = (q.totalCaptures || 0) + 1;
      q.step = 6; // marqué complet
      _save();

      const badge = document.createElement('div');
      badge.className = 'dxq-badge green';
      badge.textContent = '★  DEOXYS CAPTURÉ — REJOUE AVEC 1 MÉTÉORE';
      box.appendChild(badge);

      const ch = _choices(box);
      const bDone = _btn('▸  Voir Deoxys dans le PC →', 'gold');
      bDone.onclick = () => { _closeOverlay(); globalThis.switchTab?.('tabPC'); };
      ch.appendChild(bDone);
      const bTrack = _btn('← Tracker de quête');
      bTrack.onclick = () => { _clearOverlay(); _renderTracker(); };
      ch.appendChild(bTrack);

    } else {
      // Victoire mais échec de capture
      await _typewrite(txt,
        'Deoxys fléchit.\n\n' +
        'Mais au moment où la Poké Ball touche son cristal,\n' +
        'une explosion d\'énergie la repousse.\n\n' +
        'Deoxys disparaît dans une lueur aveuglante.\n\n' +
        'Il reviendra. Avec un Météore — vous pourrez retenter.',
      );

      // Réinitialiser step 5 pour retry
      if (q.step !== 6) { /* laisse step 5 pour retry gratuit */ }
      _save();
      _notify('☄️ Deoxys s\'est échappé — retry gratuit disponible.', '');

      const ch = _choices(box);
      const bRetry = _btn('▸  Réessayer', 'cyan');
      bRetry.onclick = () => { _clearOverlay(); setTimeout(_launchDeoxysFight, 300); };
      ch.appendChild(bRetry);
      const bTrack = _btn('← Tracker de quête');
      bTrack.onclick = () => { _clearOverlay(); _renderTracker(); };
      ch.appendChild(bTrack);
    }

  } else {
    // Défaite
    const powerNeeded = Math.max(0, DEOXYS_POWER_THRESHOLD - bosspower);
    await _typewrite(txt,
      'Deoxys te traverse d\'un regard vide.\n\n' +
      'En une fraction de seconde, votre équipe est au sol.\n\n' +
      '"…Trop faible."\n\n' +
      'Il tourne le dos et disparaît dans les ténèbres du laboratoire.',
      28,
    );

    const warn = document.createElement('div');
    warn.style.cssText = 'font-family:var(--font-pixel,monospace);font-size:7px;color:#cc1111;padding:8px 0;margin-top:4px;letter-spacing:1px';
    warn.textContent = qualified
      ? `Défaite (chance : ${Math.round(winChance * 100)}%) — renforcez votre équipe et réessayez.`
      : `Puissance insuffisante (${bosspower.toLocaleString()} / ${DEOXYS_POWER_THRESHOLD.toLocaleString()}). Il manque ${powerNeeded.toLocaleString()} pts.`;
    box.appendChild(warn);

    const ch = _choices(box);
    const bRetry = _btn('▸  Réessayer', 'cyan');
    bRetry.onclick = () => { _clearOverlay(); setTimeout(_launchDeoxysFight, 300); };
    ch.appendChild(bRetry);
    const bTrack = _btn('← Tracker de quête');
    bTrack.onclick = () => { _clearOverlay(); _renderTracker(); };
    ch.appendChild(bTrack);
  }
}

function _addDeoxysToPC() {
  const s = _state();
  if (!s) return;
  try {
    const p = globalThis.makePokemon?.('deoxys', 'laboratoire_spatial', 'pokeball');
    if (p) {
      p.level  = 80;
      p.shiny  = false;
      p.potential = 5;
      if (globalThis.calculateStats) p.stats = globalThis.calculateStats(p);
      s.pokemons.push(p);
      EventBus.emit(EVENTS.STATE_DIRTY);
      EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: p, zoneId: 'laboratoire_spatial' });
      _notify(`⭐ Deoxys (Niv.80 / Pot.5) a rejoint le Gang !`, 'gold');
    }
  } catch (e) {
    console.warn('[deoxysMission] makePokemon failed:', e);
  }
}

// ════════════════════════════════════════════════════════════════
//  DÉCLENCHEMENT
// ════════════════════════════════════════════════════════════════

function checkDeoxysMissionUnlock() {
  const s = _state();
  if (!s) return;
  const q = _qs();

  // Déjà actif → rien à faire
  if (q.active) return;

  // Prérequis : Hoenn débloqué + Ever Grande battu + rep 4000+
  if (!s.purchases?.hoennUnlocked) return;
  if (!s.zones?.['ever_grande_hoenn']?.gymDefeated) return;
  if ((s.gang?.reputation ?? 0) < 4000) return;

  // Déclencher l'intro après un court délai (pour ne pas cumuler avec les autres popups)
  setTimeout(() => _showQuestIntro(), 2500);
}

// ── Init ─────────────────────────────────────────────────────
_register();

// ── Exports globalThis ────────────────────────────────────────
Object.assign(globalThis, {
  openDeoxysMission,
  checkDeoxysMissionUnlock,
  onItemGiftReceived: _onItemGiftReceived, // hook depuis zoneSystem
});

export { openDeoxysMission, checkDeoxysMissionUnlock };
export {};
