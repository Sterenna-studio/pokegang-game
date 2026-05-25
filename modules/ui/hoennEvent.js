'use strict';

// ════════════════════════════════════════════════════════════════
//  HOENN EVENT — "L'épreuve d'acier — Pierre vous observe"
//
//  Scénario en 6 étapes :
//    0. Fade-in / noir
//    1. Alerte côtière — agent de garde signale une barge
//    1b. Détour selon choix (envoyer agent / aller soi-même)
//    2. La barge — Metagross silhouette + lettre
//    3. La lettre de Pierre — typewriter + 3 répliques
//    4. Épreuve d'acier — combat scriptés animé
//    5. Pierre Stone — dialogue final + offre Hoenn
//    6. Fin → activateHoennRegion() + switch zones
//
//  Déclenchement :
//    showHoennCinematic()       — lancé par checkHoennUnlock() dans hoenn.js
//
//  Conditions de déclenchement (dans hoenn.js) :
//    - indigo_johto gymDefeated
//    - reputation >= 2000
//    - getBossTeamPower() + total agentPower >= HOENN_POWER_THRESHOLD
//
//  Dépendances globalThis :
//    state, saveState, notify, switchTab, renderAll,
//    trainerSprite, activateHoennRegion
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });
const _save   = ()               => globalThis.saveState?.();

// ── Sprites ───────────────────────────────────────────────────────
const METAGROSS_SPRITE = 'https://play.pokemonshowdown.com/sprites/gen5/metagross.png';
const KYOGRE_ICON      = 'assets/pokemon_sprite/poke_pixel_pp_16x16/kyogre.png';
const GROUDON_ICON     = 'assets/pokemon_sprite/poke_pixel_pp_16x16/groudon.png';

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
  if (document.getElementById('hoenn-event-styles')) return;
  const style = document.createElement('style');
  style.id = 'hoenn-event-styles';
  style.textContent = `
    @keyframes hoe-fadein  { from { opacity:0; } to { opacity:1; } }
    @keyframes hoe-fadeout { from { opacity:1; } to { opacity:0; } }
    @keyframes hoe-appear  {
      from { opacity:0; transform:scale(.84) translateY(18px); filter:blur(7px); }
      to   { opacity:1; transform:scale(1)   translateY(0);    filter:blur(0);   }
    }
    @keyframes hoe-bob     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
    @keyframes hoe-shake   {
      0%,100%{transform:translate(0,0)}
      15%{transform:translate(-3px,2px)}
      30%{transform:translate(3px,-2px)}
      45%{transform:translate(-2px,3px)}
      60%{transform:translate(2px,-1px)}
      75%{transform:translate(-1px,2px)}
    }
    @keyframes hoe-steel-pulse {
      0%,100% { opacity:.65; transform:scale(1); }
      50%      { opacity:1;   transform:scale(1.10); }
    }
    @keyframes hoe-flash {
      0%   { background:rgba(80,160,255,.0); }
      30%  { background:rgba(80,160,255,.45); }
      60%  { background:rgba(120,80,255,.3); }
      100% { background:rgba(80,160,255,.0); }
    }
    @keyframes hoe-scanline {
      0%   { transform:translateY(-100%); }
      100% { transform:translateY(100vh); }
    }

    #hoenn-event-overlay {
      position:fixed; inset:0; z-index:9998;
      background: radial-gradient(ellipse at 50% 30%,#040d1a 0%,#020810 60%,#000 100%);
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      padding:24px 16px;
      animation:hoe-fadein .85s ease forwards;
      user-select:none;
      overflow-y:auto;
    }

    /* Ocean ambiance — vagues subtiles en bas */
    #hoenn-event-overlay::before {
      content:'';
      position:fixed; bottom:0; left:0; right:0; height:120px;
      background:linear-gradient(to top,rgba(10,40,80,.35) 0%,transparent 100%);
      pointer-events:none;
    }

    .hoe-box {
      max-width:540px; width:100%;
      background:rgba(2,8,18,.97);
      border:1px solid rgba(40,100,200,.35);
      border-top:2px solid rgba(60,140,220,.55);
      padding:26px 28px 24px;
      position:relative;
      box-shadow:0 0 40px rgba(10,50,120,.4), inset 0 0 0 1px rgba(255,255,255,.02);
    }

    .hoe-title {
      font-family:var(--font-pixel,monospace);
      font-size:6.5px;
      letter-spacing:4px;
      text-transform:uppercase;
      color:rgba(70,160,255,.85);
      margin-bottom:18px;
      text-align:center;
    }

    .hoe-text {
      font-family:var(--font-pixel,monospace);
      font-size:8.5px;
      line-height:2;
      color:#c8d8ea;
      min-height:70px;
      margin-bottom:18px;
      white-space:pre-wrap;
    }

    .hoe-voice {
      font-family:var(--font-pixel,monospace);
      font-size:8.5px;
      line-height:2.2;
      color:#6ab0ff;
      letter-spacing:1.5px;
      white-space:pre-wrap;
      margin-bottom:16px;
      font-style:italic;
      border-left:2px solid rgba(60,120,220,.45);
      padding-left:14px;
    }

    .hoe-letter {
      font-family:var(--font-pixel,monospace);
      font-size:8px;
      line-height:2;
      color:#b8ccdd;
      white-space:pre-wrap;
      background:rgba(15,35,65,.55);
      border:1px solid rgba(40,90,160,.4);
      border-left:3px solid rgba(60,140,220,.6);
      padding:14px 16px;
      margin-bottom:16px;
    }
    .hoe-letter-sig {
      text-align:right;
      color:rgba(70,160,255,.8);
      font-style:italic;
      margin-top:8px;
    }

    .hoe-choices { display:flex; flex-direction:column; gap:8px; }

    .hoe-btn {
      background:none;
      border:1px solid rgba(40,80,160,.4);
      color:#7aaccc;
      font-family:var(--font-pixel,monospace);
      font-size:7px;
      padding:10px 14px;
      text-align:left;
      cursor:pointer;
      letter-spacing:1px;
      transition:border-color .18s, color .18s, background .18s;
    }
    .hoe-btn:hover { border-color:rgba(60,140,220,.8); color:#c8e0f8; background:rgba(30,80,180,.08); }
    .hoe-btn.blue  { border-color:rgba(60,140,220,.6); color:#6ab0ff; }
    .hoe-btn.gold  { border-color:#ffcc5a; color:#ffcc5a; }
    .hoe-btn.gold:hover { background:rgba(255,204,90,.07); }
    .hoe-btn.steel { border-color:rgba(160,190,220,.5); color:#c0d0e0; }
    .hoe-btn.steel:hover { border-color:#c0d0e0; background:rgba(180,200,220,.06); }

    /* Metagross sprite */
    .hoe-sprite-wrap {
      position:relative; display:inline-block;
      text-align:center; margin-bottom:14px;
    }
    .hoe-sprite-wrap.steel-aura::before {
      content:'';
      position:absolute; inset:-20px;
      border-radius:50%;
      background:radial-gradient(ellipse at center,
        rgba(80,140,220,.28) 0%,
        rgba(60,100,180,.12) 45%,
        transparent 70%);
      animation:hoe-steel-pulse 2.6s ease-in-out infinite;
      pointer-events:none;
    }
    .hoe-sprite-wrap.steel-aura::after {
      content:'';
      position:absolute; inset:-8px;
      border-radius:50%;
      background:radial-gradient(ellipse at center,
        rgba(180,220,255,.22) 0%,
        rgba(100,160,220,.08) 50%,
        transparent 72%);
      animation:hoe-steel-pulse 2.6s ease-in-out infinite;
      animation-delay:1.3s;
      pointer-events:none;
    }
    .hoe-sprite {
      position:relative; z-index:1;
      width:112px; height:112px;
      image-rendering:pixelated;
      animation:hoe-appear .7s .1s both;
    }
    .hoe-sprite.silhouette {
      filter:brightness(0) drop-shadow(0 0 10px rgba(60,120,200,.7));
    }
    .hoe-sprite.steel {
      filter:drop-shadow(0 0 8px rgba(80,160,255,.5)) brightness(.85) saturate(.6);
    }
    .hoe-sprite.trainer {
      width:88px; height:88px;
      filter:drop-shadow(0 6px 20px rgba(30,100,200,.5));
      animation:hoe-bob 3s ease-in-out infinite, hoe-appear .6s both;
    }
    .hoe-sprite.anim-shake { animation:hoe-shake .35s; }

    /* Combat sequence */
    .hoe-combat-log {
      font-family:var(--font-pixel,monospace);
      font-size:7.5px;
      line-height:2;
      color:#8ab8d8;
      min-height:80px;
      margin-bottom:14px;
      border:1px solid rgba(30,70,140,.35);
      background:rgba(5,15,35,.6);
      padding:12px 14px;
    }
    .hoe-combat-log .hit  { color:#e8e8e8; }
    .hoe-combat-log .boss { color:#ffcc5a; }
    .hoe-combat-log .meta { color:#80c0ff; }
    .hoe-combat-log .sys  { color:rgba(100,160,220,.6); letter-spacing:.5px; }

    .hoe-hp-row {
      display:flex; gap:10px; align-items:center;
      margin-bottom:12px;
      font-family:var(--font-pixel,monospace); font-size:6.5px;
    }
    .hoe-hp-label { color:#7aaccc; width:90px; flex-shrink:0; }
    .hoe-hp-bar {
      flex:1; height:7px;
      background:rgba(20,50,100,.55);
      border:1px solid rgba(40,90,160,.4);
      border-radius:2px; overflow:hidden;
    }
    .hoe-hp-fill {
      height:100%; border-radius:2px;
      background:linear-gradient(90deg,#3080cc,#60b0ff);
      transition:width .6s ease;
    }
    .hoe-hp-fill.boss-fill {
      background:linear-gradient(90deg,#cc8800,#ffcc5a);
    }

    /* Flash overlay */
    .hoe-flash-overlay {
      position:fixed; inset:0; z-index:10000;
      pointer-events:none;
      animation:hoe-flash .55s ease forwards;
    }

    /* Steven portrait strip at top */
    .hoe-portrait {
      display:flex; align-items:center; gap:14px;
      background:rgba(10,30,70,.6);
      border:1px solid rgba(40,100,190,.35);
      border-radius:4px;
      padding:10px 14px;
      margin-bottom:16px;
    }
    .hoe-portrait-name {
      font-family:var(--font-pixel,monospace);
      font-size:6.5px; letter-spacing:1px;
      color:rgba(80,170,255,.85);
      text-transform:uppercase;
      margin-bottom:4px;
    }
    .hoe-portrait-role {
      font-family:var(--font-pixel,monospace);
      font-size:6px; color:rgba(100,140,180,.7);
      letter-spacing:.5px;
    }

    /* Divider */
    .hoe-divider {
      border:none; border-top:1px solid rgba(30,70,140,.35);
      margin:14px 0;
    }

    /* Location tag */
    .hoe-location {
      font-family:var(--font-pixel,monospace);
      font-size:6px; letter-spacing:2px; text-transform:uppercase;
      color:rgba(60,120,200,.6);
      margin-bottom:12px;
    }

    /* Input */
    .hoe-input {
      width:100%; box-sizing:border-box;
      background:#060a14;
      border:1px solid rgba(30,70,140,.5);
      border-top:none;
      color:#c8d8ea;
      font-family:var(--font-pixel,monospace);
      font-size:8px;
      padding:9px 12px; outline:none;
    }
    .hoe-input:focus { border-color:rgba(60,140,220,.8); }

    /* Hoenn region badge */
    .hoe-region-badge {
      display:inline-flex; align-items:center; gap:6px;
      font-family:var(--font-pixel,monospace);
      font-size:7px; letter-spacing:1.5px;
      color:rgba(80,170,255,.85);
      background:rgba(10,40,100,.5);
      border:1px solid rgba(40,100,200,.4);
      border-radius:3px;
      padding:6px 12px;
      margin-bottom:14px;
      text-transform:uppercase;
    }

    .hoe-tag-icons { display:flex; gap:6px; margin-bottom:10px; align-items:center; }
    .hoe-tag-icon  { width:16px; height:16px; image-rendering:pixelated; opacity:.7; }
  `;
  document.head.appendChild(style);
}

// ── DOM helpers ───────────────────────────────────────────────────
function _buildOverlay() {
  _injectStyles();
  const el = document.createElement('div');
  el.id = 'hoenn-event-overlay';
  document.body.appendChild(el);
  return el;
}

function _clear() { if (_overlay) _overlay.innerHTML = ''; }

function _box() {
  const b = document.createElement('div');
  b.className = 'hoe-box';
  _overlay.appendChild(b);
  return b;
}

function _title(box, text) {
  const el = document.createElement('div');
  el.className = 'hoe-title';
  el.textContent = text;
  box.appendChild(el);
  return el;
}

function _text(box) {
  const el = document.createElement('div');
  el.className = 'hoe-text';
  box.appendChild(el);
  return el;
}

function _choices(box) {
  const el = document.createElement('div');
  el.className = 'hoe-choices';
  box.appendChild(el);
  return el;
}

function _btn(label, cls = '') {
  const el = document.createElement('button');
  el.className = 'hoe-btn' + (cls ? ' ' + cls : '');
  el.textContent = label;
  return el;
}

function _location(box, text) {
  const el = document.createElement('div');
  el.className = 'hoe-location';
  el.textContent = text;
  box.appendChild(el);
}

function _divider(box) {
  const hr = document.createElement('hr');
  hr.className = 'hoe-divider';
  box.appendChild(hr);
}

function _flash() {
  const f = document.createElement('div');
  f.className = 'hoe-flash-overlay';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 600);
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
  _location(box, '◈ Quartier général — 02h14');
  _title(box, '— Alerte côtière —');
  const txt = _text(box);
  const ch  = _choices(box);

  await _typewrite(txt,
    'La radio de permanence grésille.\n\n' +
    'L\'agent de garde signale une barge inconnue qui remonte lentement\n' +
    'la côte depuis le large — sans pavillon, sans signal AIS.\n\n' +
    'Le radar indique un seul occupant à bord.\nPuissant. Très puissant.',
  );

  await _wait(300);

  const b1 = _btn('▸  Envoyer un agent vérifier');
  b1.onclick = () => _step1b_agent();
  ch.appendChild(b1);

  const b2 = _btn('▸  Y aller soi-même');
  b2.onclick = () => _step1b_self();
  ch.appendChild(b2);
}

async function _step1b_agent() {
  _clear();
  const box = _box();
  _location(box, '◈ Débarcadère sud — 02h31');
  _title(box, '— Rapport de l\'agent —');
  const txt = _text(box);
  const ch  = _choices(box);

  await _typewrite(txt,
    'L\'agent revient au bout de dix minutes, pâle comme la lune.\n\n' +
    '"Patron… c\'est un Metagross. Taille réelle. Il est posé là\n' +
    'sur le pont comme une statue. Et il y a une lettre à ses pieds.\n\n' +
    'Je n\'ai pas osé la prendre."',
    28,
  );

  await _wait(400);
  const b = _btn('▸  Descendre au port…');
  b.onclick = () => _step2();
  ch.appendChild(b);
}

async function _step1b_self() {
  _clear();
  const box = _box();
  _location(box, '◈ Débarcadère sud — 02h28');
  _title(box, '— Le port désert —');
  const txt = _text(box);
  const ch  = _choices(box);

  await _typewrite(txt,
    'Le brouillard tient le port dans une étreinte froide.\n\n' +
    'Au bout de la jetée, une silhouette de métal, massive,\n' +
    'repose sur la barge comme si elle y avait toujours été.\n\n' +
    'Quatre yeux rouges s\'allument à votre approche.\n' +
    'Aucun mouvement. Juste une évaluation silencieuse.',
    28,
  );

  await _wait(400);
  const b = _btn('▸  S\'approcher…');
  b.onclick = () => _step2();
  ch.appendChild(b);
}

async function _step2() {
  _clear();
  const box = _box();
  _location(box, '◈ Barge — 02h35');
  _title(box, '— L\'émissaire —');

  // Metagross silhouette
  const sw  = document.createElement('div');
  sw.className = 'hoe-sprite-wrap steel-aura';
  sw.style.cssText = 'display:block;text-align:center;margin-bottom:18px;';
  const img = document.createElement('img');
  img.src       = METAGROSS_SPRITE;
  img.className = 'hoe-sprite silhouette';
  img.alt       = '???';
  sw.appendChild(img);
  box.appendChild(sw);

  const txt = _text(box);
  const ch  = _choices(box);

  await _typewrite(txt,
    'Le colosse d\'acier vous fixe de ses quatre yeux rouges.\n\n' +
    'Pas d\'hostilité — une jauge froide, mécanique.\n' +
    'Il évalue votre puissance comme un instrument calibré.\n\n' +
    'Sous l\'une de ses griffes métalliques : une enveloppe\n' +
    'scellée d\'un cachet argenté en forme de rocher taillé.',
  );

  await _wait(300);

  const b = _btn('▸  Prendre la lettre', 'blue');
  b.onclick = () => _step3();
  ch.appendChild(b);
}

async function _step3() {
  _clear();
  const box = _box();
  _location(box, '◈ Cachet de la Ligue Hoenn');
  _title(box, '— La lettre de Pierre —');

  const state = _state();
  const bossName = state.gang?.bossName || 'Parrain';

  // Letter block
  const letter = document.createElement('div');
  letter.className = 'hoe-letter';
  box.appendChild(letter);

  const letterText =
    `« ${bossName},\n\n` +
    `J'ai peu de temps, alors je serai direct.\n\n` +
    `Mes informateurs m'ont parlé de vous. Votre gang a mis ` +
    `Kanto à genoux et fait trembler le Conseil de Johto.\n` +
    `Ce n'est pas rien — et ce n'est pas passé inaperçu ici.\n\n` +
    `Hoenn souffre. La Team Magma et la Team Aqua se disputent ` +
    `notre continent et risquent de réveiller des forces ` +
    `endormies depuis des millénaires. La Ligue est à bout.\n\n` +
    `Je vous propose un accord : prouvez à mon Metagross que ` +
    `votre gang mérite d'entrer à Hoenn. Si vous résistez, ` +
    `les routes vous sont ouvertes. Pas comme envahisseurs — ` +
    `comme force indépendante.\n\n` +
    `Mon émissaire vous attend.\n`;
  const sigText = '— Pierre, Champion Hoenn  »';

  // Typewrite the letter body
  const bodyEl = document.createElement('span');
  letter.appendChild(bodyEl);
  await _typewrite(bodyEl, letterText, 16);

  const sigEl = document.createElement('div');
  sigEl.className = 'hoe-letter-sig';
  sigEl.textContent = sigText;
  letter.appendChild(sigEl);

  await _wait(300);

  const ch = _choices(box);

  const b1 = _btn('▸  "Un Metagross ? C\'est tout ?"');
  b1.onclick = () => _step4();
  ch.appendChild(b1);

  const b2 = _btn('▸  "Un accord. Votre Metagross contre mon gang."');
  b2.onclick = () => _step4();
  ch.appendChild(b2);

  const inputWrap = document.createElement('div');
  const b3 = _btn('▸  [Écrire sa propre réponse…]');
  b3.onclick = () => {
    b3.remove();
    const inp = document.createElement('input');
    inp.type        = 'text';
    inp.maxLength   = 60;
    inp.placeholder = 'Votre réplique…';
    inp.className   = 'hoe-input';
    inputWrap.appendChild(inp);
    const bConfirm = _btn('▸  Répondre', 'blue');
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
  _location(box, '◈ Débarcadère sud — 02h47');
  _title(box, '— Épreuve d\'acier —');

  // HP bars
  const hpWrap = document.createElement('div');
  hpWrap.style.marginBottom = '12px';

  const metaHpRow = document.createElement('div');
  metaHpRow.className = 'hoe-hp-row';
  metaHpRow.innerHTML = `
    <span class="hoe-hp-label">Metagross (Pierre)</span>
    <div class="hoe-hp-bar"><div id="hoe-meta-hp" class="hoe-hp-fill" style="width:100%"></div></div>`;
  hpWrap.appendChild(metaHpRow);

  const gangHpRow = document.createElement('div');
  gangHpRow.className = 'hoe-hp-row';
  gangHpRow.innerHTML = `
    <span class="hoe-hp-label">Votre gang</span>
    <div class="hoe-hp-bar"><div id="hoe-gang-hp" class="hoe-hp-fill boss-fill" style="width:100%"></div></div>`;
  hpWrap.appendChild(gangHpRow);
  box.appendChild(hpWrap);

  // Combat log
  const log = document.createElement('div');
  log.className = 'hoe-combat-log';
  box.appendChild(log);

  function _addLine(html) {
    const line = document.createElement('div');
    line.innerHTML = html;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  const ch = _choices(box);

  // Scripted combat sequence
  const sequence = [
    { delay: 400,  metaHp: 98, gangHp: 88,
      html: '<span class="sys">— Combat lancé —</span>' },
    { delay: 800,  metaHp: 98, gangHp: 88,
      html: '<span class="meta">Metagross</span> <span class="hit">observe — il calibre votre puissance avec froideur</span>' },
    { delay: 1400, metaHp: 98, gangHp: 75,
      html: '<span class="meta">Metagross</span> frappe avec <span class="hit">Poing Météore</span> — impact lourd, métal contre chair' },
    { delay: 2000, metaHp: 80, gangHp: 75,
      html: '<span class="boss">Votre gang</span> riposte — <span class="hit">coup coordonné, solide</span>' },
    { delay: 2700, metaHp: 80, gangHp: 60,
      html: '<span class="meta">Metagross</span> — <span class="hit">Armure de Fer</span> — sa défense se durcit, l\'impact l\'effleure à peine' },
    { delay: 3400, metaHp: 65, gangHp: 60,
      html: '<span class="boss">Votre gang</span> — <span class="hit">enchaînement ciblé</span> — Metagross accuse le coup' },
    { delay: 4100, metaHp: 65, gangHp: 45,
      html: '<span class="meta">Metagross</span> — <span class="hit">Séisme</span> — le sol de la jetée se fissure' },
    { delay: 4700, metaHp: 50, gangHp: 45,
      html: '<span class="boss">Votre gang</span> tient bon — <span class="hit">contre-attaque précise</span>' },
    { delay: 5400, metaHp: 50, gangHp: 30,
      html: '<span class="meta">Metagross</span> — <span class="hit">Frappe Atlas</span> — votre garde se fissure sous le poids de métal' },
    { delay: 6000, metaHp: 35, gangHp: 30,
      html: '<span class="boss">Votre gang</span> — effort combiné — <span class="hit">Metagross recule d\'un pas</span>' },
    { delay: 6600, metaHp: 35, gangHp: 30,
      html: '<span class="sys">— Pause —</span>' },
    { delay: 7400, metaHp: 35, gangHp: 30,
      html: '<span class="meta">Metagross</span> abaisse lentement sa tête. <span class="hit">Signal de reconnaissance.</span>' },
    { delay: 8200, metaHp: 35, gangHp: 30,
      html: '<span class="sys">— Test terminé — Résultat : puissance suffisante —</span>' },
  ];

  let done = false;
  for (const step of sequence) {
    if (done) break;
    await _wait(step.delay - (sequence[sequence.indexOf(step) - 1]?.delay ?? 0));
    _addLine(step.html);
    const metaEl = document.getElementById('hoe-meta-hp');
    const gangEl = document.getElementById('hoe-gang-hp');
    if (metaEl) metaEl.style.width = step.metaHp + '%';
    if (gangEl) gangEl.style.width = step.gangHp + '%';
  }

  await _wait(700);
  _flash();
  await _wait(600);

  const b = _btn('▸  La suite…', 'steel');
  b.onclick = () => _step5();
  ch.appendChild(b);
}

async function _step5() {
  _clear();
  const box = _box();
  _location(box, '◈ Barge — 03h02');
  _title(box, '— Pierre Stone —');

  const state = _state();
  const bossName = state.gang?.bossName || 'Parrain';

  // Steven portrait
  const portrait = document.createElement('div');
  portrait.className = 'hoe-portrait';

  const stevenSprite = globalThis.trainerSprite?.('steven') ?? '';
  const spriteEl = document.createElement('img');
  spriteEl.src       = stevenSprite;
  spriteEl.className = 'hoe-sprite trainer';
  spriteEl.style.cssText = 'width:72px;height:72px;animation:hoe-appear .6s both,hoe-bob 3s ease-in-out infinite;flex-shrink:0';
  spriteEl.onerror = () => { spriteEl.style.opacity = '.2'; };

  const info = document.createElement('div');
  info.innerHTML = `
    <div class="hoe-portrait-name">Pierre / Steven Stone</div>
    <div class="hoe-portrait-role">Champion Hoenn · Collectionneur de roches</div>`;

  portrait.appendChild(spriteEl);
  portrait.appendChild(info);
  box.appendChild(portrait);

  // Metagross small icon
  const sw = document.createElement('div');
  sw.className = 'hoe-sprite-wrap steel-aura';
  sw.style.cssText = 'display:block;text-align:center;margin-bottom:18px;';
  const metaImg = document.createElement('img');
  metaImg.src       = METAGROSS_SPRITE;
  metaImg.className = 'hoe-sprite steel';
  metaImg.style.cssText = 'width:72px;height:72px;';
  metaImg.alt = 'Metagross';
  sw.appendChild(metaImg);
  box.appendChild(sw);

  const voice = document.createElement('div');
  voice.className = 'hoe-voice';
  box.appendChild(voice);

  const MESSAGE =
    `« Bien.\n\n` +
    `Mon Metagross ne reconnaît que ce qui mérite respect.\n` +
    `Ce soir, c'est vous.\n\n` +
    `L'accord de ma lettre tient toujours. Hoenn vous est ouverte — ` +
    `pas comme envahisseurs, mais comme force indépendante.\n\n` +
    `Une chose que je n'ai pas écrite : la situation est pire que ` +
    `ce que Kanto imagine. Magma et Aqua ne cherchent pas seulement ` +
    `à s'affronter — ils veulent réveiller Groudon et Kyogre. Si ` +
    `l'un d'eux y parvient, plus aucune règion ne sera épargnée.\n\n` +
    `Faites ce que vous savez faire.\n` +
    `Hoenn a besoin de gens qui n'hésitent pas. »`;

  await _typewrite(voice, MESSAGE, 18);

  await _wait(400);

  _divider(box);

  // Region icons teaser
  const tagIcons = document.createElement('div');
  tagIcons.className = 'hoe-tag-icons';
  tagIcons.innerHTML = `
    <span style="font-family:var(--font-pixel,monospace);font-size:6.5px;color:rgba(60,120,200,.7);letter-spacing:1px;text-transform:uppercase;">Région :</span>
    <img class="hoe-tag-icon" src="${KYOGRE_ICON}" alt="Kyogre" title="Kyogre">
    <img class="hoe-tag-icon" src="${GROUDON_ICON}" alt="Groudon" title="Groudon">
    <span style="font-family:var(--font-pixel,monospace);font-size:6.5px;color:rgba(80,140,200,.75);letter-spacing:1px">HOENN — GÉN. III</span>`;
  box.appendChild(tagIcons);

  const ch = _choices(box);

  const bAccept = _btn('→ Traverser vers Hoenn', 'gold');
  bAccept.onclick = () => { _close(); _finish(true); };
  ch.appendChild(bAccept);

  const bDismiss = _btn('▸  Pas encore…');
  bDismiss.onclick = () => { _close(); _finish(false); };
  ch.appendChild(bDismiss);
}

// ── Fin ───────────────────────────────────────────────────────────
function _finish(accepted) {
  const s = _state();

  if (accepted) {
    // Mark cinematic seen to avoid re-trigger
    s.gang.hoennCinematicSeen = true;
    _save();
    // Activate region via hoenn.js
    globalThis.activateHoennRegion?.();
    globalThis._zsel_setActiveRegion?.('hoenn');
    document.querySelectorAll('#regionSwitcher .region-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.region === 'hoenn');
    });
    globalThis.switchTab?.('tabZones');
    globalThis.renderAll?.();
    _notify('🌊 Hoenn débloqué — Bourg Natal vous attend, Parrain…', 'gold');
  } else {
    s.gang.hoennCinematicSeen = true;
    _save();
    _notify("📡 L'accord de Pierre reste ouvert — accédez à Hoenn via le sélecteur de zones.", '');
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
 * À appeler depuis checkHoennUnlock() dans hoenn.js
 * quand les conditions de puissance et de progression sont remplies.
 */
export function showHoennCinematic() {
  const s = _state();
  if (s.gang?.hoennCinematicSeen)  return;
  if (s.purchases?.hoennUnlocked)  return; // already unlocked silently
  _startCinematic();
}

// Exposer sur globalThis pour modules sans import direct
Object.assign(globalThis, { showHoennCinematic });

export {};
