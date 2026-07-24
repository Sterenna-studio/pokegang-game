'use strict';

// ════════════════════════════════════════════════════════════════
//  LEGENDARY MISSIONS — Team Magma / Groudon  ·  Team Aqua / Kyogre
//  Deux quêtes parallèles inspirées du conflit Hoenn.
//
//  Quête Magma (5 étapes) :
//    1. Vaincre 20 membres Magma dans leurs zones (mt_chimney, QG, …)
//    2. Infiltrer le QG Magma (12 combats dans team_magma_hideout)
//    3. Vaincre Tabitha — Admin Magma (puissance ≥ 2 000)
//    4. Vaincre Maxie   — Chef Magma  (puissance ≥ 3 000)
//    5. Affronter Groudon dans la Caverne Originelle (puissance ≥ 4 500)
//
//  Quête Aqua (5 étapes, parallèle) :
//    1. Vaincre 20 membres Aqua dans leurs zones (QG Aqua, routes côtières, …)
//    2. Infiltrer le QG Aqua (12 combats dans team_aqua_hideout)
//    3. Vaincre Matt   — Admin Aqua  (puissance ≥ 2 000)
//    4. Vaincre Archie — Chef Aqua   (puissance ≥ 3 000)
//    5. Affronter Kyogre dans la Caverne Originelle (puissance ≥ 4 500)
//
//  Rejouable :
//    1 Sigle Magma (drop 1,5 % zones Magma) → relance combat Groudon
//    1 Sceau Aqua  (drop 1,5 % zones Aqua)  → relance combat Kyogre
//
//  Déclenchement :
//    checkLegendaryMissionsUnlock()  — à appeler au boot + après activation Hoenn
//    openLegendaryMissions()         — ouvre le tracker dual
//
//  Dépendances globalThis :
//    state, saveState, makePokemon, calculateStats, getBossTeamPower,
//    trainerSprite, switchTab
//  Dépendances bare-name (classic scripts) :
//    ZONE_HOENN_BY_ID
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';
import { resolveSpecialCombat } from './specialCombat.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });
const _save   = ()               => globalThis.saveState?.();

// ── Sprites ──────────────────────────────────────────────────────
// Showdown gen5 animated sprites (display-only, pas de crossorigin)
const GROUDON_SPRITE = 'https://play.pokemonshowdown.com/sprites/gen5ani/groudon.gif';
const KYOGRE_SPRITE  = 'https://play.pokemonshowdown.com/sprites/gen5ani/kyogre.gif';
const GROUDON_STATIC = 'https://play.pokemonshowdown.com/sprites/gen3/groudon.png';
const KYOGRE_STATIC  = 'https://play.pokemonshowdown.com/sprites/gen3/kyogre.png';

// ── Zones de suivi ───────────────────────────────────────────────
const _MAGMA_ZONES = new Set([
  'mt_chimney', 'jagged_pass', 'team_magma_hideout', 'scorched_slab', 'route114_115',
]);
const _AQUA_ZONES = new Set([
  'team_aqua_hideout', 'route104_106', 'route110', 'route119', 'route120_121', 'cave_of_origin',
]);

// ── Config des deux quêtes ───────────────────────────────────────
const QUESTS = {
  groudon: {
    key:         'groudonMission',
    rerunItem:   'sigle_magma',
    rerunLabel:  '🔴 Sigle Magma',
    zones1:      _MAGMA_ZONES,
    hideout:     'team_magma_hideout',
    target1:     20,
    target2:     12,
    admin:       { key: 'tabitha',   name: 'Tabitha',       team: 'Numéra, Camérupt',  power: 2000 },
    chief:       { key: 'maxieGen3', name: 'Maxie',         team: 'Camérupt, Crobat, Claydol', power: 3000 },
    legendary:   { name: 'Groudon', sprite: GROUDON_SPRITE, static: GROUDON_STATIC,
                   species: 'groudon', power: 4500, catchBase: 0.40, level: 70, pot: 4 },
    theme:       { accent: '#e63535', glow: 'rgba(230,53,53,.4)', bg: '#110606', label: '🌋 MAGMA',
                   intro:  'linear-gradient(160deg,#110606 0%,#1a0a04 100%)',
                   stepBorder: 'rgba(230,53,53,.25)', stepActiveBorder: 'rgba(230,53,53,.7)' },
    title:       'Opération Magma',
    stepTitles:  ['Quadriller Hoenn', 'Infiltrer le QG', 'Neutraliser Tabitha',
                  'Stopper Maxie', 'Affronter Groudon'],
  },
  kyogre: {
    key:         'kyogreMission',
    rerunItem:   'sceau_aqua',
    rerunLabel:  '🔵 Sceau Aqua',
    zones1:      _AQUA_ZONES,
    hideout:     'team_aqua_hideout',
    target1:     20,
    target2:     12,
    admin:       { key: 'matt',      name: 'Matt',          team: 'Sharpedo, Golbat',  power: 2000 },
    chief:       { key: 'archieGen3',name: 'Archie',        team: 'Sharpedo, Mantine, Crobat', power: 3000 },
    legendary:   { name: 'Kyogre', sprite: KYOGRE_SPRITE, static: KYOGRE_STATIC,
                   species: 'kyogre', power: 4500, catchBase: 0.40, level: 70, pot: 4 },
    theme:       { accent: '#2299ff', glow: 'rgba(34,153,255,.4)', bg: '#040b11', label: '🌊 AQUA',
                   intro:  'linear-gradient(160deg,#040b11 0%,#041a2a 100%)',
                   stepBorder: 'rgba(34,153,255,.25)', stepActiveBorder: 'rgba(34,153,255,.7)' },
    title:       'Opération Aqua',
    stepTitles:  ['Quadriller Hoenn', 'Infiltrer le QG', 'Neutraliser Matt',
                  'Stopper Archie', 'Affronter Kyogre'],
  },
};

// ── Helpers d'état ───────────────────────────────────────────────
const _state = () => globalThis.state ?? null;

function _qs(questId) {
  const s = _state();
  if (!s) return null;
  const key = QUESTS[questId].key;
  if (!s[key]) s[key] = _defaultQS(questId);
  return s[key];
}

function _defaultQS(questId) {
  const d = { active: false, step: 0, adminDefeated: false, totalCaptures: 0 };
  if (questId === 'groudon') {
    return { ...d, magmaFightsWon: 0, hideoutFightsWon: 0, maxieDefeated: false, groudonOwned: false };
  }
  return { ...d, aquaFightsWon: 0, hideoutFightsWon: 0, archieDefeated: false, kyogreOwned: false };
}

function _fights1(questId, q) {
  return questId === 'groudon' ? (q.magmaFightsWon || 0) : (q.aquaFightsWon || 0);
}
function _setFights1(questId, q, v) {
  if (questId === 'groudon') q.magmaFightsWon = v;
  else q.aquaFightsWon = v;
}
function _legendaryOwned(questId, q) {
  return questId === 'groudon' ? q.groudonOwned : q.kyogreOwned;
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

// ── EventBus ─────────────────────────────────────────────────────
let _registered = false;

function _register() {
  if (_registered) return;
  _registered = true;
  EventBus.on(EVENTS.COMBAT_WON, _onCombatWon);
}

function _onCombatWon({ zoneId } = {}) {
  if (!zoneId) return;
  const s = _state();
  if (!s) return;
  let dirty = false;

  // ── Magma tracking ──
  const gm = _qs('groudon');
  if (gm?.active) {
    if (gm.step === 1 && _MAGMA_ZONES.has(zoneId)) {
      gm.magmaFightsWon = Math.min((gm.magmaFightsWon || 0) + 1, QUESTS.groudon.target1);
      if (gm.magmaFightsWon >= QUESTS.groudon.target1) {
        gm.step = 2;
        _notify('🌋 QG Magma localisé ! Infiltrez le QG Team Magma.', 'gold');
      }
      dirty = true;
    }
    if (gm.step === 2 && zoneId === 'team_magma_hideout') {
      gm.hideoutFightsWon = Math.min((gm.hideoutFightsWon || 0) + 1, QUESTS.groudon.target2);
      if (gm.hideoutFightsWon >= QUESTS.groudon.target2) {
        gm.step = 3;
        _notify('🌋 Laboratoire Magma percé ! Affrontez Tabitha depuis le tracker.', 'gold');
      }
      dirty = true;
    }
    // Drop Sigle Magma (1,5 % dans toutes zones Magma pendant la quête active)
    if (_MAGMA_ZONES.has(zoneId) && Math.random() < 0.015) {
      s.inventory.sigle_magma = (s.inventory.sigle_magma || 0) + 1;
      _notify('🔴 Sigle Magma récupéré ! (relance combat Groudon)', '');
      dirty = true;
    }
  }

  // ── Aqua tracking ──
  const km = _qs('kyogre');
  if (km?.active) {
    if (km.step === 1 && _AQUA_ZONES.has(zoneId)) {
      km.aquaFightsWon = Math.min((km.aquaFightsWon || 0) + 1, QUESTS.kyogre.target1);
      if (km.aquaFightsWon >= QUESTS.kyogre.target1) {
        km.step = 2;
        _notify('🌊 QG Aqua localisé ! Infiltrez le QG Team Aqua.', 'gold');
      }
      dirty = true;
    }
    if (km.step === 2 && zoneId === 'team_aqua_hideout') {
      km.hideoutFightsWon = Math.min((km.hideoutFightsWon || 0) + 1, QUESTS.kyogre.target2);
      if (km.hideoutFightsWon >= QUESTS.kyogre.target2) {
        km.step = 3;
        _notify('🌊 Bases Aqua démantelées ! Affrontez Matt depuis le tracker.', 'gold');
      }
      dirty = true;
    }
    // Drop Sceau Aqua (1,5 %)
    if (_AQUA_ZONES.has(zoneId) && Math.random() < 0.015) {
      s.inventory.sceau_aqua = (s.inventory.sceau_aqua || 0) + 1;
      _notify('🔵 Sceau Aqua récupéré ! (relance combat Kyogre)', '');
      dirty = true;
    }
  }

  if (dirty) _save();
}

// ════════════════════════════════════════════════════════════════
//  STYLES (préfixe lgm-)
// ════════════════════════════════════════════════════════════════

function _injectStyles() {
  if (document.getElementById('lgm-styles')) return;
  const style = document.createElement('style');
  style.id = 'lgm-styles';
  style.textContent = `
    #lgm-overlay {
      position:fixed; inset:0; z-index:9050;
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      padding:18px 14px; overflow-y:auto;
      animation:lgm-fadein .45s ease both;
      user-select:none;
    }
    @keyframes lgm-fadein  { from{opacity:0} to{opacity:1} }
    @keyframes lgm-fadeout { from{opacity:1} to{opacity:0} }
    @keyframes lgm-pulse   { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:1;transform:scale(1.1)} }
    @keyframes lgm-bob     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
    @keyframes lgm-appear  { from{opacity:0;transform:scale(.82) translateY(12px)} to{opacity:1;transform:none} }
    @keyframes lgm-flash   { 0%{opacity:0} 15%{opacity:1} 100%{opacity:0} }
    @keyframes lgm-shake   { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-3px,2px)} 60%{transform:translate(3px,-2px)} }

    .lgm-box {
      max-width:580px; width:100%;
      background:var(--lgm-bg, rgba(6,6,18,.97));
      border:1px solid var(--lgm-border, rgba(100,100,200,.2));
      padding:20px 22px 18px;
      position:relative;
      box-shadow:0 0 50px var(--lgm-glow, rgba(100,100,200,.06)),
                 inset 0 0 0 1px rgba(255,255,255,.03);
    }
    .lgm-box::before {
      content:'';
      position:absolute; left:0; top:0; bottom:0; width:3px;
      background:linear-gradient(to bottom, var(--lgm-accent,#888), transparent, var(--lgm-accent,#888));
      opacity:.8;
    }

    .lgm-sublabel {
      font-family:var(--font-pixel,monospace);
      font-size:7px; letter-spacing:3px; text-transform:uppercase;
      color:var(--lgm-accent,#888); opacity:.8;
      margin-bottom:10px;
    }
    .lgm-title {
      font-family:var(--font-pixel,monospace);
      font-size:11px; letter-spacing:2px; text-transform:uppercase;
      color:var(--lgm-accent,#ccc);
      margin-bottom:4px;
    }
    .lgm-text {
      font-family:var(--font-pixel,monospace);
      font-size:8.5px; line-height:2; color:#bcc8d8;
      min-height:54px; margin-bottom:14px; white-space:pre-wrap;
    }
    .lgm-choices { display:flex; flex-direction:column; gap:8px; }
    .lgm-btn {
      background:none;
      border:1px solid var(--lgm-border, rgba(120,120,200,.25));
      color:#7a8aaa;
      font-family:var(--font-pixel,monospace);
      font-size:7px; padding:10px 14px;
      text-align:left; cursor:pointer; letter-spacing:1px;
      transition:border-color .18s, color .18s, background .18s;
    }
    .lgm-btn:hover { border-color:var(--lgm-accent,#888); color:#e0e8f0; background:rgba(255,255,255,.04); }
    .lgm-btn.accent { border-color:var(--lgm-accent,#888); color:var(--lgm-accent,#ccc); }
    .lgm-btn.accent:hover { background:rgba(255,255,255,.06); }
    .lgm-btn.gold  { border-color:#ffcc5a; color:#ffcc5a; }
    .lgm-btn:disabled { opacity:.3; cursor:not-allowed; }

    /* Sprite légendaire */
    .lgm-sprite-wrap {
      text-align:center; margin-bottom:14px; position:relative; display:block;
    }
    .lgm-sprite-wrap.aura::before {
      content:''; position:absolute; inset:-14px; border-radius:50%;
      background:radial-gradient(ellipse,var(--lgm-glow,rgba(100,100,200,.3)) 0%,transparent 72%);
      animation:lgm-pulse 2.4s ease-in-out infinite; pointer-events:none;
    }
    .lgm-sprite {
      width:120px; height:120px; image-rendering:pixelated;
      animation:lgm-appear .6s .1s both, lgm-bob 3.2s ease-in-out infinite;
      position:relative; z-index:1;
    }
    .lgm-sprite.big { width:150px; height:150px; }

    /* Trainer portrait */
    .lgm-trainer-wrap {
      display:flex; align-items:center; gap:14px; margin-bottom:14px;
    }
    .lgm-trainer-img {
      width:80px; height:80px; image-rendering:pixelated;
      filter:drop-shadow(0 4px 12px var(--lgm-glow,rgba(100,100,200,.4)));
      flex-shrink:0;
    }
    .lgm-trainer-info { flex:1; min-width:0; }
    .lgm-trainer-name {
      font-family:var(--font-pixel,monospace); font-size:9px;
      color:var(--lgm-accent,#ccc); margin-bottom:4px;
    }
    .lgm-trainer-team { font-family:var(--font-pixel,monospace); font-size:7px; color:#5a7a90; }

    /* Power bar */
    .lgm-power-row {
      display:flex; align-items:center; gap:10px;
      padding:9px 12px; margin-bottom:12px;
      background:rgba(0,0,0,.35);
      border:1px solid rgba(255,204,90,.12); border-radius:3px;
    }
    .lgm-power-label { font-family:var(--font-pixel,monospace); font-size:7px; color:#8a9ab0; flex:1; }
    .lgm-power-val   { font-family:var(--font-pixel,monospace); font-size:9px; color:#ffcc5a; }

    /* Badge résultat */
    .lgm-badge {
      font-family:var(--font-pixel,monospace); font-size:9px;
      letter-spacing:2px; text-align:center; text-transform:uppercase;
      border:1px solid var(--lgm-border,rgba(100,100,200,.3));
      color:var(--lgm-accent,#ccc);
      padding:8px 14px; margin-bottom:14px;
    }
    .lgm-badge.green { color:#00ff88; border-color:rgba(0,255,136,.35); }
    .lgm-badge.red   { color:#ff8080; border-color:rgba(255,128,128,.35); }

    /* Warn text */
    .lgm-warn {
      font-family:var(--font-pixel,monospace); font-size:7px;
      color:#cc1111; padding:6px 0; letter-spacing:1px;
    }

    /* ── Dual tracker ── */
    .lgm-dual {
      display:flex; gap:12px; max-width:700px; width:100%; align-items:flex-start;
    }
    @media(max-width:540px) { .lgm-dual { flex-direction:column; } }

    .lgm-card {
      flex:1; min-width:0;
      background:rgba(4,4,16,.98);
      border:1px solid rgba(80,80,160,.18);
      padding:14px 16px 16px;
      position:relative;
    }
    .lgm-card::before {
      content:''; position:absolute; left:0; top:0; bottom:0; width:3px;
      background:var(--lgm-accent,#888);
    }

    .lgm-card-tag {
      font-family:var(--font-pixel,monospace);
      font-size:7px; letter-spacing:3px; text-transform:uppercase;
      color:var(--lgm-accent,#888); margin-bottom:8px;
    }
    .lgm-card-title {
      font-family:var(--font-pixel,monospace); font-size:9px;
      color:var(--lgm-accent,#ccc); margin-bottom:10px;
    }

    .lgm-steps { display:flex; flex-direction:column; gap:6px; margin-bottom:10px; }
    .lgm-step {
      padding:7px 10px; border:1px solid rgba(80,80,160,.12);
      background:rgba(0,0,0,.25); border-radius:2px;
      display:flex; align-items:flex-start; gap:8px;
    }
    .lgm-step.active { border-color:var(--lgm-step-active,rgba(100,100,200,.5)); background:rgba(255,255,255,.03); }
    .lgm-step.done   { border-color:rgba(0,255,136,.25); background:rgba(0,255,136,.03); opacity:.75; }
    .lgm-step.locked { opacity:.3; }
    .lgm-step-n {
      font-family:var(--font-pixel,monospace); font-size:13px;
      color:rgba(140,140,200,.3); flex:0 0 20px; line-height:1; margin-top:2px;
    }
    .lgm-step.active .lgm-step-n { color:var(--lgm-accent,#ccc); }
    .lgm-step.done   .lgm-step-n { color:#00ff88; }
    .lgm-step-body { flex:1; min-width:0; }
    .lgm-step-name { font-family:var(--font-pixel,monospace); font-size:7px; color:#9ab; margin-bottom:3px; }
    .lgm-step.active .lgm-step-name { color:var(--lgm-accent,#ccc); }
    .lgm-step-sub  { font-size:7px; color:#4a6070; line-height:1.6; }
    .lgm-step.active .lgm-step-sub { color:#7a9ab0; }
    .lgm-pbar { height:3px; background:rgba(255,255,255,.08); border-radius:2px; margin-top:5px; }
    .lgm-pfill { height:100%; background:var(--lgm-accent,#888); border-radius:2px; transition:width .4s; }

    .lgm-item-row {
      display:flex; align-items:center; gap:6px;
      font-family:var(--font-pixel,monospace); font-size:7px;
      color:#7a9ab0; margin-bottom:8px; padding:5px 8px;
      background:rgba(0,0,0,.3); border-radius:2px;
    }

    #lgm-flash {
      position:fixed; inset:0; z-index:9200;
      background:#fff; pointer-events:none;
      animation:lgm-flash .55s ease forwards;
    }
  `;
  document.head.appendChild(style);
}

// ── Overlay helpers ───────────────────────────────────────────────
let _overlay = null;

function _setTheme(questId) {
  if (!_overlay) return;
  const t = questId ? QUESTS[questId].theme : { accent:'#aabbcc', glow:'rgba(100,100,200,.3)', bg:'#05050f', border:'rgba(100,100,200,.2)', stepBorder:'rgba(100,100,200,.2)', stepActiveBorder:'rgba(140,140,220,.6)' };
  _overlay.style.background = t.intro || t.bg;
  _overlay.style.setProperty('--lgm-accent',          t.accent);
  _overlay.style.setProperty('--lgm-glow',            t.glow);
  _overlay.style.setProperty('--lgm-border',          t.stepBorder);
  _overlay.style.setProperty('--lgm-step-active',     t.stepActiveBorder);
}

function _buildOverlay(questId) {
  _injectStyles();
  const el = document.createElement('div');
  el.id = 'lgm-overlay';
  document.body.appendChild(el);
  _overlay = el;
  _setTheme(questId ?? null);
  return el;
}

function _clearOv()   { if (_overlay) _overlay.innerHTML = ''; }
function _closeOv(ms = 380) {
  if (!_overlay) return;
  _overlay.style.transition = `opacity ${ms}ms ease`;
  _overlay.style.opacity = '0';
  setTimeout(() => { _overlay?.remove(); _overlay = null; }, ms);
}

function _box(questId) {
  const b = document.createElement('div');
  b.className = 'lgm-box';
  if (questId) {
    const t = QUESTS[questId].theme;
    b.style.setProperty('--lgm-accent', t.accent);
    b.style.setProperty('--lgm-glow',   t.glow);
    b.style.setProperty('--lgm-border', t.stepBorder);
    b.style.background = t.bg;
  }
  _overlay.appendChild(b);
  return b;
}

function _sublabel(box, text) {
  const el = document.createElement('div');
  el.className = 'lgm-sublabel';
  el.textContent = text;
  box.appendChild(el);
  return el;
}

function _titleEl(box, text) {
  const el = document.createElement('div');
  el.className = 'lgm-title';
  el.textContent = text;
  box.appendChild(el);
  return el;
}

function _textEl(box) {
  const el = document.createElement('div');
  el.className = 'lgm-text';
  box.appendChild(el);
  return el;
}

function _choices(box) {
  const el = document.createElement('div');
  el.className = 'lgm-choices';
  box.appendChild(el);
  return el;
}

function _btn(label, cls = '') {
  const b = document.createElement('button');
  b.className = 'lgm-btn' + (cls ? ' ' + cls : '');
  b.textContent = label;
  return b;
}

function _flash() {
  const el = document.createElement('div');
  el.id = 'lgm-flash';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

function _spriteEl(src, big = false) {
  const img = document.createElement('img');
  img.src = src;
  img.className = 'lgm-sprite' + (big ? ' big' : '');
  img.alt = '';
  return img;
}

// ════════════════════════════════════════════════════════════════
//  INTRO CINÉMATIQUE (commune aux deux quêtes)
// ════════════════════════════════════════════════════════════════

let _introShown = false;

async function _showQuestIntro() {
  if (_overlay || _introShown) return;
  _introShown = true;
  _buildOverlay(null);

  await _wait(700);
  _clearOv();

  // Boîte neutre (deux équipes, tension)
  const box = document.createElement('div');
  box.className = 'lgm-box';
  box.style.cssText += ';max-width:560px;background:#07070f;--lgm-accent:#cc9922;--lgm-glow:rgba(200,140,30,.3);--lgm-border:rgba(200,140,30,.25)';
  _overlay.appendChild(box);

  _sublabel(box, '— Alerte Hoenn —');
  _titleEl(box, '⚡  Conflit de Forces Primitives');
  const txt = _textEl(box);

  await _typewrite(txt,
    'Deux organisations se disputent l\'avenir de Hoenn.\n\n' +
    'La Team Magma veut réveiller le Titan du Continent —\n' +
    'étendre les terres, éradiquer les océans.\n\n' +
    'La Team Aqua, elle, cherche à libérer le Maître des Abysses —\n' +
    'engloutir les terres sous des kilomètres d\'eau.\n\n' +
    'Leurs QG sont identifiés. Leurs chefs sont localisés.\n' +
    'Il faut les arrêter — ou les contrôler.\n\n' +
    'Deux quêtes parallèles. À vous de choisir l\'ordre.',
  );

  const ch = _choices(box);
  const bGo = _btn('▸  Accepter les deux opérations', 'accent');
  const bNo = _btn('▸  Pas maintenant');

  bGo.onclick = () => {
    const gm = _qs('groudon');
    const km = _qs('kyogre');
    if (gm) { gm.active = true; if (!gm.step) gm.step = 1; }
    if (km) { km.active = true; if (!km.step) km.step = 1; }
    _save();
    _closeOv();
    _notify('🌋🌊 Opérations Magma & Aqua lancées — consultez le tracker depuis les zones Hoenn.', 'gold');
  };
  bNo.onclick = () => {
    // Sans ce reset, openLegendaryMissions() rappellerait _showQuestIntro() plus
    // tard (le joueur veut finalement accepter) mais elle retournerait aussitôt
    // sans effet — le message ci-dessous promet que la quête reste accessible.
    _introShown = false;
    _closeOv();
    _notify('⚡ Les deux quêtes légendaires Hoenn restent disponibles.', '');
  };

  ch.appendChild(bGo);
  ch.appendChild(bNo);
}

// ════════════════════════════════════════════════════════════════
//  TRACKER DUAL
// ════════════════════════════════════════════════════════════════

function openLegendaryMissions() {
  if (_overlay) return;
  const gm = _qs('groudon');
  const km = _qs('kyogre');

  if (!gm?.active && !km?.active) {
    _showQuestIntro();
    return;
  }

  _buildOverlay(null);
  _overlay.style.background = 'radial-gradient(ellipse at 30% 50%,#100605 0%,#07070f 50%,#040b11 100%)';
  _renderDualTracker();
}

function _renderDualTracker() {
  _clearOv();
  if (!_overlay) return;
  const s = _state();
  if (!s) return;

  const gm     = _qs('groudon');
  const km     = _qs('kyogre');
  const power  = globalThis.getBossTeamPower?.() ?? 0;
  const sigle  = s.inventory?.sigle_magma ?? 0;
  const sceau  = s.inventory?.sceau_aqua  ?? 0;

  // Titre général
  const header = document.createElement('div');
  header.style.cssText = 'font-family:var(--font-pixel,monospace);font-size:7px;letter-spacing:3px;color:#888;text-transform:uppercase;text-align:center;margin-bottom:12px';
  header.textContent = '— Quêtes Légendaires Hoenn —';
  _overlay.appendChild(header);

  const dual = document.createElement('div');
  dual.className = 'lgm-dual';
  _overlay.appendChild(dual);

  // Puissance boss (commun)
  const pBar = document.createElement('div');
  pBar.style.cssText = 'max-width:700px;width:100%;display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(0,0,0,.4);border:1px solid rgba(255,204,90,.12);border-radius:3px;margin-bottom:10px;font-family:var(--font-pixel,monospace);font-size:7px;color:#7a8aaa';
  pBar.innerHTML = `Puissance Boss <span style="margin-left:auto;color:#ffcc5a;font-size:9px">${power.toLocaleString()}</span>`;
  _overlay.appendChild(pBar);
  _overlay.insertBefore(pBar, dual);

  _renderQuestCard(dual, 'groudon', gm, power, sigle);
  _renderQuestCard(dual, 'kyogre',  km, power, sceau);

  // Bouton fermer
  const footer = document.createElement('div');
  footer.style.cssText = 'max-width:700px;width:100%;margin-top:10px;';
  const bClose = _btn('✕  Fermer le tracker');
  bClose.style.cssText = 'width:100%;border-color:rgba(255,255,255,.1);color:#556;';
  bClose.onclick = () => _closeOv();
  footer.appendChild(bClose);
  _overlay.appendChild(footer);
}

function _renderQuestCard(container, questId, q, power, rerunItem) {
  const cfg = QUESTS[questId];
  const t   = cfg.theme;
  const target1 = cfg.target1;
  const target2 = cfg.target2;

  const card = document.createElement('div');
  card.className = 'lgm-card';
  card.style.setProperty('--lgm-accent',      t.accent);
  card.style.setProperty('--lgm-step-active', t.stepActiveBorder);
  container.appendChild(card);

  // Tag + titre
  const tag = document.createElement('div');
  tag.className = 'lgm-card-tag';
  tag.textContent = t.label;
  card.appendChild(tag);

  const ctitle = document.createElement('div');
  ctitle.className = 'lgm-card-title';
  ctitle.textContent = cfg.title;
  card.appendChild(ctitle);

  // Item rerun
  const iRow = document.createElement('div');
  iRow.className = 'lgm-item-row';
  iRow.innerHTML = `${cfg.rerunLabel} : <strong style="color:${t.accent};margin-left:4px">${rerunItem}</strong>
    <span style="opacity:.4;font-size:6px;margin-left:6px">1,5 % / combat</span>`;
  card.appendChild(iRow);

  // Etapes
  const stepsEl = document.createElement('div');
  stepsEl.className = 'lgm-steps';
  card.appendChild(stepsEl);

  const f1 = questId === 'groudon' ? (q?.magmaFightsWon || 0) : (q?.aquaFightsWon || 0);
  const f2 = q?.hideoutFightsWon || 0;
  const qs  = q?.step ?? 0;

  const stepDefs = [
    {
      n:1, name: cfg.stepTitles[0],
      sub: `Zones ${questId === 'groudon' ? 'Magma' : 'Aqua'} — ${Math.min(f1, target1)} / ${target1}`,
      progress: qs > 1 ? 1 : f1 / target1,
    },
    {
      n:2, name: cfg.stepTitles[1],
      sub: `${qs > 2 ? target2 : Math.min(f2, target2)} / ${target2} combats`,
      progress: qs > 2 ? 1 : f2 / target2,
    },
    {
      n:3, name: cfg.stepTitles[2],
      sub: `Puissance requise : ${cfg.admin.power.toLocaleString()}`,
      action: { label: `⚔ Affronter ${cfg.admin.name}`, fn: () => { _closeOv(); setTimeout(() => _launchBossFight('admin', questId), 300); } },
    },
    {
      n:4, name: cfg.stepTitles[3],
      sub: `Puissance requise : ${cfg.chief.power.toLocaleString()}`,
      action: { label: `⚔ Affronter ${cfg.chief.name}`, fn: () => { _closeOv(); setTimeout(() => _launchBossFight('chief', questId), 300); } },
    },
    {
      n:5, name: cfg.stepTitles[4],
      sub: `Puissance requise : ${cfg.legendary.power.toLocaleString()}`,
      action: {
        label: qs === 6 ? `♺ Rejouer (1 ${cfg.rerunLabel})` : `☄ Affronter ${cfg.legendary.name}`,
        fn:    () => { _closeOv(); setTimeout(() => _launchLegendaryFight(questId), 300); },
      },
    },
  ];

  for (const sd of stepDefs) {
    const done   = qs > sd.n;
    const active = qs === sd.n || (sd.n === 5 && qs === 6);
    const locked = qs < sd.n && !(sd.n === 5 && qs === 6);

    const row = document.createElement('div');
    row.className = 'lgm-step' + (done ? ' done' : active ? ' active' : locked ? ' locked' : '');

    const nEl = document.createElement('div');
    nEl.className = 'lgm-step-n';
    nEl.textContent = done ? '✓' : String(sd.n);

    const body = document.createElement('div');
    body.className = 'lgm-step-body';

    const nameEl = document.createElement('div');
    nameEl.className = 'lgm-step-name';
    nameEl.textContent = sd.name;

    const subEl = document.createElement('div');
    subEl.className = 'lgm-step-sub';
    subEl.textContent = sd.sub;

    body.appendChild(nameEl);
    body.appendChild(subEl);

    if (sd.progress !== undefined && !done) {
      const pb = document.createElement('div');
      pb.className = 'lgm-pbar';
      const pf = document.createElement('div');
      pf.className = 'lgm-pfill';
      pf.style.width = Math.min(Math.round(sd.progress * 100), 100) + '%';
      pb.appendChild(pf);
      body.appendChild(pb);
    }

    if (sd.action && (active || (sd.n === 5 && qs === 6)) && q?.active) {
      const aWrap = document.createElement('div');
      aWrap.style.marginTop = '6px';
      const ab = _btn(sd.action.label, 'accent');
      // Disable if step isn't ready
      const canAct = qs === sd.n || (sd.n === 5 && qs === 6 && rerunItem >= 1);
      if (!canAct) ab.disabled = true;
      else ab.onclick = sd.action.fn;
      aWrap.appendChild(ab);
      body.appendChild(aWrap);
    }

    row.appendChild(nEl);
    row.appendChild(body);
    stepsEl.appendChild(row);
  }

  // Si pas encore active
  if (!q?.active) {
    const na = document.createElement('div');
    na.style.cssText = 'font-family:var(--font-pixel,monospace);font-size:7px;color:#446;text-align:center;padding:8px 0';
    na.textContent = 'Quête non démarrée';
    card.appendChild(na);
  }
}

// ════════════════════════════════════════════════════════════════
//  BOSS FIGHT — Admin ou Chef (générique)
// ════════════════════════════════════════════════════════════════

async function _launchBossFight(rank, questId) {
  if (_overlay) return;
  const cfg      = QUESTS[questId];
  const q        = _qs(questId);
  const npcCfg   = rank === 'admin' ? cfg.admin : cfg.chief;
  const reqStep  = rank === 'admin' ? 3 : 4;

  if (!q || q.step !== reqStep) return;

  const bosspower  = globalThis.getBossTeamPower?.() ?? 0;
  const qualified  = bosspower >= npcCfg.power;
  const trainerImg = globalThis.trainerSprite?.(npcCfg.key);

  _buildOverlay(questId);
  const box = _box(questId);

  _sublabel(box, `Étape ${reqStep} — ${cfg.theme.label}`);
  _titleEl(box, `⚔  ${npcCfg.name} — ${rank === 'admin' ? 'Admin' : 'Chef'} ${questId === 'groudon' ? 'Magma' : 'Aqua'}`);

  // Portrait trainer
  if (trainerImg) {
    const tw = document.createElement('div');
    tw.className = 'lgm-trainer-wrap';
    const img = document.createElement('img');
    img.src = trainerImg; img.className = 'lgm-trainer-img'; img.alt = npcCfg.name;
    img.onerror = () => { img.style.display = 'none'; };
    const info = document.createElement('div');
    info.className = 'lgm-trainer-info';
    const nEl = document.createElement('div'); nEl.className = 'lgm-trainer-name'; nEl.textContent = npcCfg.name;
    const tEl = document.createElement('div'); tEl.className = 'lgm-trainer-team'; tEl.textContent = `Équipe : ${npcCfg.team}`;
    info.appendChild(nEl); info.appendChild(tEl);
    tw.appendChild(img); tw.appendChild(info);
    box.appendChild(tw);
  }

  const txt = _textEl(box);
  const texts = {
    tabitha:    `"Vous avez l'audace de vous faufiler ici ?\nSoyez prêts à affronter la flamme de la Team Magma."`,
    matt:       `"Ha ! Vous avez du cran. Mais l'océan n'a pitié de personne.\nLa Team Aqua va vous apprendre ce que ça coûte."`,
    maxieGen3:  `"Impressionnant d'être arrivé jusqu'ici.\nMais Groudon sera réveillé. Rien ne peut arrêter notre vision."\n\nMaxie envoie Camérupt, Crobat, Claydol.`,
    archieGen3: `"Vous êtes plus forts que prévu. Je vous respecte — mais\nKyogre sera libéré. L'océan reprendra ses droits."\n\nArchie envoie Sharpedo, Mantine, Crobat.`,
  };
  await _typewrite(txt, texts[npcCfg.key] || `"Affrontez-moi si vous l'osez !"`, 22);

  // Power row
  const pr = document.createElement('div');
  pr.className = 'lgm-power-row';
  pr.innerHTML = `<span class="lgm-power-label">Puissance Boss</span>
    <span class="lgm-power-val">${bosspower.toLocaleString()} / ${npcCfg.power.toLocaleString()}</span>`;
  box.appendChild(pr);

  if (!qualified) {
    const w = document.createElement('div');
    w.className = 'lgm-warn';
    w.textContent = `Puissance insuffisante — il manque ${(npcCfg.power - bosspower).toLocaleString()} PC.`;
    box.appendChild(w);
  }

  const ch = _choices(box);
  if (qualified) {
    const bFight = _btn(`⚔  Engager le combat →`, 'accent');
    bFight.onclick = async () => {
      bFight.disabled = true;
      await _wait(500);
      _flash();
      await _wait(650);
      _clearOv();
      const { win } = resolveSpecialCombat({ power: bosspower, requiredPower: npcCfg.power });
      if (win) await _bossVictory(rank, questId, npcCfg.name);
      else     await _bossDefeat(rank, questId, npcCfg.name);
    };
    ch.appendChild(bFight);
  }
  const bBack = _btn('← Retour au tracker');
  bBack.onclick = () => { _clearOv(); _renderDualTracker(); };
  ch.appendChild(bBack);
}

async function _bossVictory(rank, questId, npcName) {
  const cfg = QUESTS[questId];
  const q   = _qs(questId);
  const box = _box(questId);

  const badge = document.createElement('div');
  badge.className = 'lgm-badge green';
  badge.textContent = `✓  ${npcName} — Vaincu`;
  box.appendChild(badge);

  const txt = _textEl(box);
  const isAdmin = rank === 'admin';
  const nextName = isAdmin
    ? (questId === 'groudon' ? 'Maxie' : 'Archie')
    : (questId === 'groudon' ? 'Groudon' : 'Kyogre');

  await _typewrite(txt,
    isAdmin
      ? `${npcName} recule, essoufflé.\n\n"Ce n'est pas fini… le Chef saura se venger."\n\nLa voie vers le cœur du QG est dégagée.`
      : `${npcName} s'effondre.\n\nIl vous lance un regard où se mêlent la haine et le respect.\n"Vous ne pouvez pas arrêter ce qui a déjà commencé.\n${nextName} est déjà éveillé."\n\nUn tremblement secoue les murs.`,
    22,
  );

  if (isAdmin) { q.adminDefeated = true; q.step = 4; }
  else         {
    if (questId === 'groudon') q.maxieDefeated = true;
    else q.archieDefeated = true;
    q.step = 5;
  }
  _save();

  _notify(`${cfg.theme.label} — Étape ${isAdmin ? 3 : 4} complète !`, 'gold');

  const ch = _choices(box);
  const bNext = _btn(`▸  Suite →`, 'accent');
  bNext.onclick = () => {
    _clearOv();
    if (isAdmin) setTimeout(() => _launchBossFight('chief', questId), 300);
    else { _closeOv(); setTimeout(() => _launchLegendaryFight(questId), 300); }
  };
  const bTrack = _btn('← Tracker');
  bTrack.onclick = () => { _clearOv(); _renderDualTracker(); };
  ch.appendChild(bNext);
  ch.appendChild(bTrack);
}

async function _bossDefeat(rank, questId, npcName) {
  const cfg = QUESTS[questId];
  const box = _box(questId);

  const badge = document.createElement('div');
  badge.className = 'lgm-badge red';
  badge.textContent = `✗  ${npcName} — Défaite`;
  box.appendChild(badge);

  const txt = _textEl(box);
  await _typewrite(txt,
    `${npcName} repousse votre assaut sans peine.\n\n"Revenez quand vous serez prêts."\n\nRenforcez votre équipe et retentez votre chance.`,
    22,
  );

  _notify(`${cfg.theme.label} — défaite contre ${npcName}.`, 'error');

  const ch = _choices(box);
  const bRetry = _btn(`⚔  Retenter →`, 'accent');
  bRetry.onclick = () => { _clearOv(); setTimeout(() => _launchBossFight(rank, questId), 300); };
  const bTrack = _btn('← Tracker');
  bTrack.onclick = () => { _clearOv(); _renderDualTracker(); };
  ch.appendChild(bRetry);
  ch.appendChild(bTrack);
}

// ════════════════════════════════════════════════════════════════
//  COMBAT LÉGENDAIRE (Groudon / Kyogre)
// ════════════════════════════════════════════════════════════════

async function _launchLegendaryFight(questId) {
  if (_overlay) return;
  const cfg = QUESTS[questId];
  const q   = _qs(questId);
  const s   = _state();
  if (!q || (q.step !== 5 && q.step !== 6)) return;

  // Repeat mode: require the rerun item, but only consume it once the player
  // actually engages the fight (bFight.onclick) — pas au simple ouverture de
  // l'écran, sinon l'objet est perdu si le joueur clique "Reculer".
  if (q.step === 6) {
    const itemKey = cfg.rerunItem;
    if ((s?.inventory?.[itemKey] ?? 0) < 1) return;
  }

  const bosspower = globalThis.getBossTeamPower?.() ?? 0;
  const leg = cfg.legendary;
  const t   = cfg.theme;

  _buildOverlay(questId);
  const box = _box(questId);

  _sublabel(box, `Étape 5 — ${t.label}`);
  _titleEl(box, `☄  ${leg.name} — Titan ${questId === 'groudon' ? 'du Continent' : 'des Abysses'}`);

  // Sprite légendaire
  const sw = document.createElement('div');
  sw.className = 'lgm-sprite-wrap aura';
  sw.appendChild(_spriteEl(leg.sprite, true));
  box.appendChild(sw);

  const txt = _textEl(box);
  const intros = {
    groudon: 'La chaleur est insupportable.\nLa lave fissure le sol autour de lui.\n\nGroudon — le Titan du Continent — vous regarde.\nSes yeux brûlent d\'une lumière ancienne.\n\nIl n\'a pas peur. Il n\'a jamais eu peur.',
    kyogre:  'L\'eau monte. La pression des abysses pèse dans l\'air.\n\nKyogre — le Maître des Abysses — émerge lentement.\nSa silhouette éclaire la caverne d\'une lueur bleue froide.\n\nIl vous observe comme on observe une goutte dans l\'océan.',
  };
  await _typewrite(txt, intros[questId], 22);

  const ch = _choices(box);
  const bFight = _btn(`☄  Engager le combat →`, 'accent');
  const bFlee  = _btn('← Reculer');
  bFight.onclick = async () => {
    bFight.disabled = true; bFlee.disabled = true;
    if (q.step === 6) {
      const itemKey = cfg.rerunItem;
      if ((s?.inventory?.[itemKey] ?? 0) < 1) { _closeOv(); return; }
      s.inventory[itemKey]--;
      _save();
    }
    await _wait(600);
    _flash();
    await _wait(700);
    _clearOv();
    await _legendaryResolution(questId, bosspower);
  };
  bFlee.onclick = () => _closeOv();
  ch.appendChild(bFight);
  ch.appendChild(bFlee);
}

async function _legendaryResolution(questId, bosspower) {
  const cfg    = QUESTS[questId];
  const leg    = cfg.legendary;
  const q      = _qs(questId);
  const box    = _box(questId);

  const qualified  = bosspower >= leg.power;
  const ratio      = bosspower / leg.power;
  // Tentative "quand même" sous le seuil : chance réduite dédiée (pas la formule
  // partagée, qui suppose un jet normal au-dessus du seuil requis).
  const winChance = qualified
    ? resolveSpecialCombat({ power: bosspower, requiredPower: leg.power, baseChance: 0.45, maxChance: 0.92, slope: 0.45 }).chance
    : ratio * 0.25;
  const won = Math.random() < winChance;

  _sublabel(box, `Résultat — ${cfg.theme.label}`);

  // Sprite dans le résultat
  const sw = document.createElement('div');
  sw.className = 'lgm-sprite-wrap';
  const img = _spriteEl(leg.static);
  if (!won) img.style.filter = 'brightness(0.25) saturate(0)';
  sw.appendChild(img);
  box.appendChild(sw);

  const txt = _textEl(box);

  if (won) {
    const catchRoll = Math.random() < (leg.catchBase + Math.max(0, ratio - 1) * 0.25);

    if (catchRoll) {
      const victoryTexts = {
        groudon: 'La sphère touche Groudon.\n\nUn grondement sourd. La lave se fige.\nTrois clics.\n\n…\n\n     ★  Le Titan du Continent est à vous.',
        kyogre:  'La sphère touche Kyogre.\n\nLes eaux se calment. La lumière s\'apaise.\nTrois clics.\n\n…\n\n     ★  Le Maître des Abysses est à vous.',
      };
      await _typewrite(txt, victoryTexts[questId], 26);

      _addLegendaryToPC(questId);
      if (questId === 'groudon') { q.groudonOwned = true; }
      else                       { q.kyogreOwned  = true; }
      q.totalCaptures = (q.totalCaptures || 0) + 1;
      q.step = 6;
      _save();
      _notify(`★ ${leg.name} capturé — Niv.${leg.level} / Pot.${leg.pot} !`, 'gold');

      const badge = document.createElement('div');
      badge.className = 'lgm-badge green';
      badge.textContent = `★  ${leg.name.toUpperCase()} CAPTURÉ`;
      box.appendChild(badge);

      const ch = _choices(box);
      const bPC = _btn(`▸  Voir ${leg.name} dans le PC →`, 'gold');
      bPC.onclick = () => { _closeOv(); globalThis.switchTab?.('tabPC'); };
      const bTr = _btn('← Tracker');
      bTr.onclick = () => { _clearOv(); _renderDualTracker(); };
      ch.appendChild(bPC);
      ch.appendChild(bTr);

    } else {
      // Victoire mais échec capture
      await _typewrite(txt,
        `${leg.name} vacille — mais la sphère rebondit.\n\nUne vague d\'énergie vous repousse.\nIl disparaît dans les profondeurs.\n\nRetrouvez un ${cfg.rerunLabel} pour retenter.`,
        26,
      );
      _save();

      const ch = _choices(box);
      const bRetry = _btn('▸  Réessayer', 'accent');
      bRetry.onclick = () => { _clearOv(); setTimeout(() => _launchLegendaryFight(questId), 300); };
      const bTr = _btn('← Tracker');
      bTr.onclick = () => { _clearOv(); _renderDualTracker(); };
      ch.appendChild(bRetry);
      ch.appendChild(bTr);
    }

  } else {
    // Défaite
    const needed = Math.max(0, leg.power - bosspower);
    const defeatTexts = {
      groudon: `Groudon balaie votre équipe d\'un mouvement.\n"Insignifiant."\n\nLa caverne tremble. Vous reculez.`,
      kyogre:  `Kyogre plonge. Un torrent d\'eau vous emporte.\nQuand vous reprenez vos esprits, il a disparu.`,
    };
    await _typewrite(txt, defeatTexts[questId], 26);

    const w = document.createElement('div');
    w.className = 'lgm-warn';
    w.textContent = qualified
      ? `Défaite (chance : ${Math.round(winChance * 100)}%) — renforcez votre équipe.`
      : `Puissance insuffisante (${bosspower.toLocaleString()} / ${leg.power.toLocaleString()}). Manque : ${needed.toLocaleString()} PC.`;
    box.appendChild(w);

    const ch = _choices(box);
    const bRetry = _btn('▸  Réessayer', 'accent');
    bRetry.onclick = () => { _clearOv(); setTimeout(() => _launchLegendaryFight(questId), 300); };
    const bTr = _btn('← Tracker');
    bTr.onclick = () => { _clearOv(); _renderDualTracker(); };
    ch.appendChild(bRetry);
    ch.appendChild(bTr);
  }
}

function _addLegendaryToPC(questId) {
  const s   = _state();
  const cfg = QUESTS[questId];
  const leg = cfg.legendary;
  if (!s) return;
  try {
    const p = globalThis.makePokemon?.(leg.species, 'cave_of_origin', 'pokeball');
    if (p) {
      p.level     = leg.level;
      p.shiny     = false;
      p.potential = leg.pot;
      if (globalThis.calculateStats) p.stats = globalThis.calculateStats(p);
      s.pokemons.push(p);
      EventBus.emit(EVENTS.STATE_DIRTY);
      EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: p, zoneId: 'cave_of_origin' });
      globalThis.registerPokedexCapture?.(s, p);
    }
  } catch (e) {
    console.warn('[legendaryMissions] makePokemon failed:', e);
  }
}

// ════════════════════════════════════════════════════════════════
//  DÉCLENCHEMENT
// ════════════════════════════════════════════════════════════════

function checkLegendaryMissionsUnlock() {
  const s = _state();
  if (!s) return;
  const gm = _qs('groudon');
  const km = _qs('kyogre');

  if (gm?.active && km?.active) return; // les deux déjà actives

  // Prérequis : Hoenn débloqué + rep 2500
  if (!s.purchases?.hoennUnlocked) return;
  if ((s.gang?.reputation ?? 0) < 2500) return;

  setTimeout(() => _showQuestIntro(), 1800);
}

// ── Init ────────────────────────────────────────────────────────
_register();

// ── Globals ─────────────────────────────────────────────────────
Object.assign(globalThis, {
  openLegendaryMissions,
  checkLegendaryMissionsUnlock,
});

export { openLegendaryMissions, checkLegendaryMissionsUnlock };
export {};
