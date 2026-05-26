'use strict';

// ════════════════════════════════════════════════════════════════
//  JOHTO EVENT — "Signal Rocket — Archer vous contacte"
//
//  Scénario en 5 étapes :
//    0. Fade-in / parasites radio
//    1. Signal identifié — choix (décrypter / couper)
//    2. Archer — portrait + voix
//    3. La proposition — typewriter + 3 réponses
//    4. Final — accord + offre Johto
//
//  Déclenchement :
//    showJohtoCinematic()   — lancé par checkJohtoUnlock() dans johto.js
//
//  Conditions (dans johto.js) :
//    - indigo_plateau gymDefeated
//    - reputation >= 500
//
//  Dépendances globalThis :
//    state, saveState, notify, switchTab, renderAll,
//    trainerSprite, activateJohtoRegion
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });
const _save   = ()               => globalThis.saveState?.();

// ── État interne ──────────────────────────────────────────────────
let _overlay = null;

// ── Helpers ───────────────────────────────────────────────────────
const _state = () => globalThis.state ?? {};
function _wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Typewriter ────────────────────────────────────────────────────
function _typewrite(el, text, speed = 22) {
  return new Promise(resolve => {
    el.textContent = '';
    let i = 0;
    const tick = () => {
      if (i < text.length) {
        el.textContent += text[i++];
        setTimeout(tick, speed);
      } else {
        resolve();
      }
    };
    tick();
  });
}

// ── Styles ────────────────────────────────────────────────────────
function _injectStyles() {
  if (document.getElementById('johto-event-styles')) return;
  const style = document.createElement('style');
  style.id = 'johto-event-styles';
  style.textContent = `
    @keyframes joe-fadein  { from { opacity:0; } to { opacity:1; } }
    @keyframes joe-appear  {
      from { opacity:0; transform:scale(.84) translateY(18px); filter:blur(7px); }
      to   { opacity:1; transform:scale(1)   translateY(0);    filter:blur(0);   }
    }
    @keyframes joe-bob     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
    @keyframes joe-signal  {
      0%   { opacity:.15; transform:scaleY(.3); }
      50%  { opacity:1;   transform:scaleY(1);  }
      100% { opacity:.15; transform:scaleY(.3); }
    }
    @keyframes joe-flash {
      0%   { background:rgba(20,180,80,.0);  }
      30%  { background:rgba(20,180,80,.3);  }
      65%  { background:rgba(180,20,20,.12); }
      100% { background:rgba(20,180,80,.0);  }
    }

    #johto-event-overlay {
      position:fixed; inset:0; z-index:9998;
      background: radial-gradient(ellipse at 50% 25%, #040e08 0%, #020c06 55%, #000 100%);
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      padding:24px 16px;
      animation:joe-fadein .85s ease forwards;
      user-select:none;
      overflow-y:auto;
    }

    /* Scanlines légères */
    #johto-event-overlay::before {
      content:'';
      position:fixed; inset:0;
      background:repeating-linear-gradient(
        0deg,
        transparent, transparent 2px,
        rgba(0,0,0,.07) 2px, rgba(0,0,0,.07) 4px
      );
      pointer-events:none;
    }

    .joe-box {
      max-width:540px; width:100%;
      background:rgba(2,8,4,.97);
      border:1px solid rgba(20,120,60,.35);
      border-top:2px solid rgba(30,180,80,.45);
      padding:26px 28px 24px;
      position:relative;
      box-shadow:0 0 40px rgba(10,80,30,.35), inset 0 0 0 1px rgba(255,255,255,.02);
    }

    .joe-title {
      font-family:var(--font-pixel,monospace);
      font-size:6.5px; letter-spacing:4px; text-transform:uppercase;
      color:rgba(40,200,100,.8);
      margin-bottom:18px; text-align:center;
    }

    .joe-text {
      font-family:var(--font-pixel,monospace);
      font-size:8.5px; line-height:2;
      color:#c0d8c4; min-height:70px;
      margin-bottom:18px; white-space:pre-wrap;
    }

    .joe-voice {
      font-family:var(--font-pixel,monospace);
      font-size:8.5px; line-height:2.2;
      color:#7ada9a; letter-spacing:1.5px;
      white-space:pre-wrap; margin-bottom:16px;
      font-style:italic;
      border-left:2px solid rgba(30,160,70,.45);
      padding-left:14px;
    }

    .joe-letter {
      font-family:var(--font-pixel,monospace);
      font-size:8px; line-height:2;
      color:#b0ccb4; white-space:pre-wrap;
      background:rgba(10,30,15,.55);
      border:1px solid rgba(20,100,50,.4);
      border-left:3px solid rgba(200,30,30,.55);
      padding:14px 16px; margin-bottom:16px;
    }
    .joe-letter-sig {
      text-align:right;
      color:rgba(200,30,30,.8);
      font-style:italic; margin-top:8px;
    }

    .joe-choices { display:flex; flex-direction:column; gap:8px; }

    .joe-btn {
      background:none;
      border:1px solid rgba(20,80,40,.4);
      color:#6aaa7a;
      font-family:var(--font-pixel,monospace);
      font-size:7px; padding:10px 14px;
      text-align:left; cursor:pointer; letter-spacing:1px;
      transition:border-color .18s, color .18s, background .18s;
    }
    .joe-btn:hover { border-color:rgba(40,180,80,.8); color:#aaeeaa; background:rgba(20,120,50,.08); }
    .joe-btn.green { border-color:rgba(40,180,80,.6); color:#6adc8a; }
    .joe-btn.green:hover { background:rgba(30,160,70,.07); }
    .joe-btn.red   { border-color:rgba(200,30,30,.5); color:#dd6666; }
    .joe-btn.red:hover { border-color:rgba(220,50,50,.8); background:rgba(200,20,20,.06); }

    /* Portrait Archer */
    .joe-portrait {
      display:flex; align-items:center; gap:14px;
      background:rgba(8,20,12,.6);
      border:1px solid rgba(20,100,50,.35);
      border-radius:4px;
      padding:10px 14px; margin-bottom:16px;
    }
    .joe-portrait-name {
      font-family:var(--font-pixel,monospace);
      font-size:6.5px; letter-spacing:1px;
      color:rgba(210,40,40,.9); text-transform:uppercase; margin-bottom:4px;
    }
    .joe-portrait-role {
      font-family:var(--font-pixel,monospace);
      font-size:6px; color:rgba(100,160,110,.7); letter-spacing:.5px;
    }
    .joe-portrait-sprite {
      width:72px; height:72px; image-rendering:pixelated; flex-shrink:0;
      filter:drop-shadow(0 6px 18px rgba(180,20,20,.4));
      animation:joe-bob 3s ease-in-out infinite, joe-appear .6s both;
    }

    /* Barres signal */
    .joe-signal-bar {
      display:flex; gap:3px; align-items:flex-end;
      margin-bottom:16px; justify-content:center;
    }
    .joe-signal-bar span {
      width:4px; background:rgba(30,180,80,.75); border-radius:2px;
      animation:joe-signal 1.2s ease-in-out infinite;
    }

    /* Flash */
    .joe-flash-overlay {
      position:fixed; inset:0; z-index:10000;
      pointer-events:none;
      animation:joe-flash .55s ease forwards;
    }

    .joe-location {
      font-family:var(--font-pixel,monospace);
      font-size:6px; letter-spacing:2px; text-transform:uppercase;
      color:rgba(30,160,70,.6); margin-bottom:12px;
    }

    .joe-divider {
      border:none; border-top:1px solid rgba(20,80,40,.35); margin:14px 0;
    }

    .joe-region-badge {
      display:inline-flex; align-items:center; gap:6px;
      font-family:var(--font-pixel,monospace);
      font-size:7px; letter-spacing:1.5px; text-transform:uppercase;
      color:rgba(40,200,100,.85);
      background:rgba(8,30,14,.55);
      border:1px solid rgba(20,140,60,.4);
      border-radius:3px; padding:6px 12px; margin-bottom:14px;
    }
  `;
  document.head.appendChild(style);
}

// ── DOM helpers ───────────────────────────────────────────────────
function _buildOverlay() {
  _injectStyles();
  const el = document.createElement('div');
  el.id = 'johto-event-overlay';
  document.body.appendChild(el);
  return el;
}

function _clear() { if (_overlay) _overlay.innerHTML = ''; }

function _box() {
  const b = document.createElement('div');
  b.className = 'joe-box';
  _overlay.appendChild(b);
  return b;
}

function _title(box, text) {
  const el = document.createElement('div');
  el.className = 'joe-title';
  el.textContent = text;
  box.appendChild(el);
  return el;
}

function _text(box) {
  const el = document.createElement('div');
  el.className = 'joe-text';
  box.appendChild(el);
  return el;
}

function _choices(box) {
  const el = document.createElement('div');
  el.className = 'joe-choices';
  box.appendChild(el);
  return el;
}

function _btn(label, cls = '') {
  const el = document.createElement('button');
  el.className = 'joe-btn' + (cls ? ' ' + cls : '');
  el.textContent = label;
  return el;
}

function _location(box, text) {
  const el = document.createElement('div');
  el.className = 'joe-location';
  el.textContent = text;
  box.appendChild(el);
}

function _divider(box) {
  const hr = document.createElement('hr');
  hr.className = 'joe-divider';
  box.appendChild(hr);
}

function _flash() {
  const f = document.createElement('div');
  f.className = 'joe-flash-overlay';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 600);
}

function _signalBars(box) {
  const wrap = document.createElement('div');
  wrap.className = 'joe-signal-bar';
  [8, 14, 20, 26, 20, 14, 8, 14, 20].forEach((h, i) => {
    const s = document.createElement('span');
    s.style.height = h + 'px';
    s.style.animationDelay = (i * 0.13) + 's';
    wrap.appendChild(s);
  });
  box.appendChild(wrap);
}

// ── Steps ─────────────────────────────────────────────────────────

async function _step0() {
  _clear();
  await _wait(900);
  _step1();
}

async function _step1() {
  _clear();
  const box = _box();
  _location(box, '◈ Quartier général — 23h44');
  _title(box, '— Signal parasité —');
  _signalBars(box);
  const txt = _text(box);
  const ch  = _choices(box);

  await _typewrite(txt,
    'Les moniteurs de surveillance se couvrent de parasites.\n\n' +
    'Une fréquence inconnue force l\'accès aux canaux internes\n' +
    'du gang. Signal chiffré — codage ancienne génération.\n\n' +
    'Quelqu\'un cherche à vous contacter depuis l\'intérieur\n' +
    'du réseau Team Rocket.',
  );

  await _wait(300);

  const b1 = _btn('▸  Décrypter le signal');
  b1.onclick = () => _step1b_decrypt();
  ch.appendChild(b1);

  const b2 = _btn('▸  Couper la fréquence', 'red');
  b2.onclick = () => _step1b_cut();
  ch.appendChild(b2);
}

async function _step1b_decrypt() {
  _clear();
  const box = _box();
  _location(box, '◈ Fréquence TR-7 — Mahogany Town');
  _title(box, '— Identification —');
  const txt = _text(box);
  const ch  = _choices(box);

  await _typewrite(txt,
    'Signal décrypté.\n\n' +
    'Origine : tour-relais abandonnée de Mahogany Town.\n' +
    'Protocole : Team Rocket, chiffrement de 2e génération.\n\n' +
    'Empreinte vocale reconnue : Archer.\n' +
    'Numéro deux de l\'organisation — ou ce qu\'il en reste.',
    26,
  );

  await _wait(400);
  const b = _btn('▸  Répondre à la communication…');
  b.onclick = () => _step2();
  ch.appendChild(b);
}

async function _step1b_cut() {
  _clear();
  const box = _box();
  _location(box, '◈ Quartier général — 23h46');
  _title(box, '— Signal persistant —');
  const txt = _text(box);
  const ch  = _choices(box);

  await _typewrite(txt,
    'Le signal est coupé.\n\n' +
    'Il revient immédiatement. Plus fort. Plus direct.\n\n' +
    'Une voix, cette fois — calme, précise,\n' +
    'habituée à ne pas être interrompue.',
    26,
  );

  await _wait(400);
  const b = _btn('▸  Écouter…');
  b.onclick = () => _step2();
  ch.appendChild(b);
}

async function _step2() {
  _clear();
  const box = _box();
  _location(box, '◈ Tour Radio — Mahogany Town');
  _title(box, '— Archer —');

  const archerSprite = globalThis.trainerSprite?.('archer') ?? '';
  const portrait = document.createElement('div');
  portrait.className = 'joe-portrait';
  portrait.innerHTML = `
    <img class="joe-portrait-sprite" src="${archerSprite}" alt="Archer" onerror="this.style.opacity='.2'">
    <div>
      <div class="joe-portrait-name">Archer</div>
      <div class="joe-portrait-role">N°2 — Team Rocket · Mahogany Town</div>
    </div>`;
  box.appendChild(portrait);

  const voice = document.createElement('div');
  voice.className = 'joe-voice';
  box.appendChild(voice);

  const ch = _choices(box);

  await _typewrite(voice,
    '« Parrain. Je ne m\'attends pas à ce que vous me fassiez confiance.\n\n' +
    'Notre organisation a commis des choses — certaines que vous\n' +
    'connaissez, d\'autres que vous préférerez ne jamais savoir.\n\n' +
    'Giovanni est parti. L\'organisation se fracture.\n' +
    'Johto est en train de nous échapper.\n\n' +
    'C\'est précisément pourquoi je vous appelle. »',
    20,
  );

  await _wait(400);
  const b = _btn('▸  "Continuez."');
  b.onclick = () => _step3();
  ch.appendChild(b);
}

async function _step3() {
  _clear();
  const box = _box();
  _location(box, '◈ Ligne sécurisée TR — 00h01');
  _title(box, '— La proposition —');

  const state = _state();
  const bossName = state.gang?.bossName || 'Parrain';

  const letter = document.createElement('div');
  letter.className = 'joe-letter';
  box.appendChild(letter);

  const letterText =
    `« ${bossName},\n\n` +
    `Les Bêtes Sacrées errent sans maître depuis la chute de la Tour Tin.\n` +
    `Raikou dans la brousse. Entei dans les montagnes.\n` +
    `Suicune sur les routes — personne ne sait où.\n\n` +
    `Lugia dort aux Îles Tourbillon.\n` +
    `Ho-Oh attend au sommet d'une tour que plus personne ne garde.\n\n` +
    `Johto est un vide. Un territoire sans maître véritable.\n` +
    `Nos hommes encore en poste n'ont ni ordre ni chef.\n\n` +
    `Je vous offre ceci : les routes libres, les territoires vacants,\n` +
    `un accès sans entrave à une région entière.\n` +
    `En échange : si vos hommes croisent les nôtres —\n` +
    `ignorez-les. Laissez-nous nous retirer en silence.\n`;
  const sigText = '— Archer, Team Rocket  »';

  const bodyEl = document.createElement('span');
  letter.appendChild(bodyEl);
  await _typewrite(bodyEl, letterText, 15);

  const sigEl = document.createElement('div');
  sigEl.className = 'joe-letter-sig';
  sigEl.textContent = sigText;
  letter.appendChild(sigEl);

  await _wait(300);

  const ch = _choices(box);

  const b1 = _btn('▸  "Un accord. Johto contre le silence."', 'green');
  b1.onclick = () => _step4();
  ch.appendChild(b1);

  const b2 = _btn('▸  "Les Bêtes Sacrées m\'intéressent plus que vous."');
  b2.onclick = () => _step4();
  ch.appendChild(b2);

  const inputWrap = document.createElement('div');
  const b3 = _btn('▸  [Écrire sa propre réponse…]');
  b3.onclick = () => {
    b3.remove();
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.maxLength = 60;
    inp.placeholder = 'Votre réplique…';
    inp.style.cssText = `
      width:100%;box-sizing:border-box;
      background:#020a04;border:1px solid rgba(20,100,50,.5);border-top:none;
      color:#c0d8c4;font-family:var(--font-pixel,monospace);font-size:8px;
      padding:9px 12px;outline:none;`;
    inp.addEventListener('focus', () => { inp.style.borderColor = 'rgba(40,180,80,.8)'; });
    inputWrap.appendChild(inp);
    const bConfirm = _btn('▸  Répondre', 'green');
    bConfirm.onclick = () => { if (inp.value.trim()) _step4(); };
    inputWrap.appendChild(bConfirm);
    setTimeout(() => inp.focus(), 50);
  };
  inputWrap.appendChild(b3);
  ch.appendChild(inputWrap);
}

async function _step4() {
  _clear();
  const box = _box();
  _location(box, '◈ Ligne sécurisée TR — 00h03');
  _title(box, '— Archer —');

  const archerSprite = globalThis.trainerSprite?.('archer') ?? '';
  const portrait = document.createElement('div');
  portrait.className = 'joe-portrait';
  portrait.innerHTML = `
    <img class="joe-portrait-sprite" src="${archerSprite}" alt="Archer" onerror="this.style.opacity='.2'">
    <div>
      <div class="joe-portrait-name">Archer</div>
      <div class="joe-portrait-role">N°2 — Team Rocket · Mahogany Town</div>
    </div>`;
  box.appendChild(portrait);

  const voice = document.createElement('div');
  voice.className = 'joe-voice';
  box.appendChild(voice);

  await _typewrite(voice,
    '« Bien.\n\n' +
    'Je ne vous demande pas d\'être nos alliés.\n' +
    'Juste de ne pas être nos ennemis\n' +
    'pendant que nous disparaissons.\n\n' +
    'Johto est à vous. Faites-en ce que vous voulez.\n' +
    'Les Bêtes ne se laissent pas dompter facilement —\n' +
    'elles choisissent elles-mêmes leur maître.\n\n' +
    'Méfiez-vous de la Tour Tin. »',
    20,
  );

  _flash();
  await _wait(500);

  _divider(box);

  const badge = document.createElement('div');
  badge.className = 'joe-region-badge';
  badge.textContent = '🗾 JOHTO — GÉN. II';
  box.appendChild(badge);

  const ch = _choices(box);

  const bAccept = _btn('→ Traverser vers Johto', 'green');
  bAccept.onclick = () => { _close(); _finish(true); };
  ch.appendChild(bAccept);

  const bDismiss = _btn('▸  Pas encore…');
  bDismiss.onclick = () => { _close(); _finish(false); };
  ch.appendChild(bDismiss);
}

// ── Fin ───────────────────────────────────────────────────────────
function _finish(accepted) {
  const s = _state();
  s.gang.johtoCinematicSeen = true;
  _save();

  if (accepted) {
    globalThis.activateJohtoRegion?.();
    globalThis._zsel_setActiveRegion?.('johto');
    document.querySelectorAll('#regionSwitcher .region-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.region === 'johto');
    });
    globalThis.switchTab?.('tabZones');
    globalThis.renderAll?.();
    _notify('🌏 Johto débloqué — Bienvenue à New Bark Town, Parrain…', 'gold');
  } else {
    _notify("📡 L'accord d'Archer reste ouvert — accédez à Johto via le sélecteur de zones.", '');
  }
}

function _close() {
  if (!_overlay) return;
  _overlay.style.transition = 'opacity .5s';
  _overlay.style.opacity    = '0';
  setTimeout(() => {
    _overlay?.remove();
    _overlay = null;
  }, 520);
}

// ── Déclenchement ─────────────────────────────────────────────────
function _startCinematic() {
  if (_overlay) return;
  _overlay = _buildOverlay();
  _step0();
}

/**
 * Appelé depuis checkJohtoUnlock() dans johto.js
 * quand les conditions de progression sont remplies pour la première fois.
 */
export function showJohtoCinematic() {
  const s = _state();
  if (s.gang?.johtoCinematicSeen) return;
  if (s.purchases?.johtoUnlocked) return; // déjà débloqué silencieusement
  _startCinematic();
}

// Exposer sur globalThis pour modules sans import direct
Object.assign(globalThis, { showJohtoCinematic });

export {};
