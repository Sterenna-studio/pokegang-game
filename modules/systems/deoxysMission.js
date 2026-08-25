'use strict';

// ════════════════════════════════════════════════════════════════
//  DEOXYS MISSION — "Opération : Forme ADN"
//  Quête légendaire late-game inspirée du film Destiny Deoxys
//
//  5 objectifs en séquence :
//    1. Signal Anomal      — Vaincre 20 dresseurs dans les zones Hoenn
//    2. Fragments          — Collecter 3 Météores (event de zone meteore_crash, Hoenn)
//    3. Infiltration       — Vaincre 10 combats dans le Laboratoire Spatial
//    4. Prise de Contrôle  — Vaincre le Directeur du Laboratoire
//    5. Confrontation      — Combat final contre Deoxys
//  Rejouable : 1 Météore permet de relancer l'étape 5 uniquement.
//
//  L'intro cinématique (_showQuestIntro/_showQuestStep2) et le tracker
//  restent gérés ici tels quels. Les affrontements de quête (Directeur,
//  Deoxys) ne se déclenchent plus depuis un modal à jet de probabilité
//  (`resolveSpecialCombat`) : une fois l'étape atteinte,
//  getDeoxysQuestEncounterForZone(zoneId) fait apparaître le dresseur/
//  légendaire comme sprite persistant dans laboratoire_spatial (agrégé par
//  modules/ui/zoneWindows.js) ; un clic ouvre un vrai combat tour-par-tour
//  (modules/ui/questEncounterPopup.js + modules/systems/questCombat.js) —
//  même patron que kantoMissions.js/johtoMissions.js/legendaryMissions.js/
//  sinnohMissions.js.
//
//  La révélation en 3 phases de Deoxys (_deoxysPhases) est une cinématique
//  cosmétique — elle ne détermine jamais l'issue, seul le combat qui suit
//  compte. Conservée telle quelle, mais jouée UNE SEULE FOIS (gardée par
//  deoxysPhasesShown) : un joueur qui relance juste après une défaite ne
//  doit pas se retaper 20 secondes de texte à chaque tentative.
//
//  Les anciens seuils de puissance (DIRECTOR_POWER_THRESHOLD,
//  DEOXYS_POWER_THRESHOLD) servaient à bloquer l'accès au combat avant
//  même de le lancer — aucune région migrée ne fait ça : la difficulté
//  passe uniquement par statMult + niveau d'équipe, et le joueur peut
//  toujours envoyer des agents affaiblir l'adversaire avant d'y aller lui-
//  même. Supprimés ; la puissance du boss reste affichée dans le tracker à
//  titre indicatif, comme Hoenn/Sinnoh le font déjà.
//
//  Déclenchement :
//    checkDeoxysMissionUnlock()      — à appeler au boot et après Ever Grande
//    openDeoxysMission()             — ouvre le tracker de quête
//    getDeoxysQuestEncounterForZone() — sprite de combat pour une zone
//
//  Dépendances globalThis :
//    state, saveState, makePokemon, calculateStats, registerPokedexCapture,
//    trainerSprite, getBossTeamPower, switchTab, openQuestEncounterPopup,
//    patchZoneWindow
//  Dépendances import :
//    defaultEncounterState (modules/systems/questCombat.js)
//  Dépendances bare-name (classic scripts) :
//    ZONE_HOENN_BY_ID
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';
import { defaultEncounterState } from './questCombat.js';

const _notify = (msg, type = '') => {
  if (!globalThis.OfflineReport?.isBatching?.()) EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });
};
const _save = () => {
  if (!globalThis.OfflineReport?.isBatching?.()) globalThis.saveState?.();
};
const _t = (fr, en) => (globalThis.state?.lang === 'en' ? en : fr);

// ── Assets ────────────────────────────────────────────────────
const DEOXYS_SPRITE     = 'assets/pokemon_sprite/legendary_fight_by_muzyun/deoxys.png';
const DEOXYS_FIGHT_HALF = 'assets/pokemon_sprite/legendary_fight_by_muzyun/deoxys_fight_half.png';

// ── Config ────────────────────────────────────────────────────
const TARGET_TRAINERS   = 20;
const TARGET_METEORES   = 3;
const TARGET_LAB_FIGHTS = 10;
const LAB_ZONE_ID       = 'laboratoire_spatial';

// Directeur/Deoxys : niveaux calibrés en conservant l'écart relatif des
// anciens seuils de puissance (Directeur 1500 < Deoxys 3500), nettement en
// dessous des seuils Hoenn (admin 2000 / chef 3000 / légendaire 4500) — cette
// quête était déjà, dans l'ancien système, plus accessible que les quêtes
// Magma/Aqua malgré son positionnement narratif "final".
const DIRECTOR_TEAM = [
  { species_en: 'metang', level: 48 }, { species_en: 'claydol', level: 49 }, { species_en: 'porygon-z', level: 50 },
];
const DEOXYS_SPECIES = 'deoxys';
const DEOXYS_LEVEL = 80;   // valeur déjà explicite dans l'ancien système — conservée
const DEOXYS_POT   = 5;    // idem
const DEOXYS_CATCH_BASE = 0.45; // idem
const DEOXYS_STAT_MULT  = 1.5;

// ── Helpers ───────────────────────────────────────────────────
const _state = () => globalThis.state ?? null;

function _qs() {
  const s = _state();
  if (!s) return null;
  if (!s.deoxysMission) {
    s.deoxysMission = {
      active: false, step: 0,
      trainersDefeated: 0, labFightsWon: 0,
      labBossDefeated: false, deoxysOwned: false, totalCaptures: 0,
      deoxysPhasesShown: false,
    };
  }
  return s.deoxysMission;
}

function _isHoennZone(zoneId) {
  if (!zoneId) return false;
  if (typeof ZONE_HOENN_BY_ID !== 'undefined' && ZONE_HOENN_BY_ID[zoneId]) return true;
  return false;
}

function _repatchZone(zoneId) {
  const win = document.getElementById(`zw-${zoneId}`);
  if (win) globalThis.patchZoneWindow?.(zoneId, win);
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

  if (q.step === 1 && hoenn) {
    q.trainersDefeated = Math.min((q.trainersDefeated || 0) + 1, TARGET_TRAINERS);
    if (q.trainersDefeated >= TARGET_TRAINERS) {
      q.step = 2;
      _notify(_t('☄️ Signal localisé ! Collectez 3 Météores dans les zones Hoenn.', '☄️ Signal located! Collect 3 Meteorites in the Hoenn zones.'), 'gold');
      const inv0 = _state().inventory;
      if ((inv0.meteore || 0) >= TARGET_METEORES) {
        inv0.meteore -= TARGET_METEORES;
        q.step = 3;
        _notify(_t('☄️ Fragments récoltés ! Infiltrez le Laboratoire Spatial Devon.', '☄️ Fragments recovered! Infiltrate the Devon Space Lab.'), 'gold');
      }
    }
    _save();
  }

  if (q.step === 3 && zoneId === LAB_ZONE_ID) {
    q.labFightsWon = Math.min((q.labFightsWon || 0) + 1, TARGET_LAB_FIGHTS);
    if (q.labFightsWon >= TARGET_LAB_FIGHTS) {
      q.step = 4;
      _notify(_t('☄️ Laboratoire infiltré ! Rendez-vous au Laboratoire Spatial pour affronter le Directeur.', '☄️ Lab infiltrated! Head to the Space Lab to face the Director.'), 'gold');
      _repatchZone(LAB_ZONE_ID);
    }
    _save();
  }

  // Le drop météore passe uniquement par l'event SPECIAL_EVENTS "meteore_crash"
  // (data/zones-hoenn-data.js) — voir _onItemGiftReceived ci-dessous.
}

function _onItemGiftReceived(itemId) {
  if (itemId !== 'meteore') return;
  const q = _qs();
  if (!q?.active || q.step !== 2) return;
  const inv = _state()?.inventory;
  if (!inv) return;
  if (inv.meteore >= TARGET_METEORES) {
    inv.meteore -= TARGET_METEORES;
    q.step = 3;
    _notify(_t('☄️ Fragments récoltés ! Infiltrez le Laboratoire Spatial Devon.', '☄️ Fragments recovered! Infiltrate the Devon Space Lab.'), 'gold');
    _save();
  }
}

// ── Styles (prefix dxq-) — intro cinématique + phases uniquement ──
function _injectStyles() {
  if (document.getElementById('dxq-styles')) return;
  const style = document.createElement('style');
  style.id = 'dxq-styles';
  style.textContent = `
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
    .dxq-close-btn {
      position:fixed; top:14px; right:18px;
      font-family:var(--font-pixel,monospace); font-size:8px;
      color:rgba(0,200,255,.5); cursor:pointer; z-index:9200;
      padding:4px 8px; letter-spacing:1px;
      transition:color .15s;
    }
    .dxq-close-btn:hover { color:#00e5ff; }
    @keyframes dxq-fadein  { from{opacity:0} to{opacity:1} }
    @keyframes dxq-pulse   { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
    @keyframes dxq-holo    {
      0%   { filter:hue-rotate(0deg)   brightness(1.2); }
      50%  { filter:hue-rotate(60deg)  brightness(1.5); }
      100% { filter:hue-rotate(0deg)   brightness(1.2); }
    }
    @keyframes dxq-bob     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
    @keyframes dxq-appear  { from{opacity:0;transform:scale(.85) translateY(14px)} to{opacity:1;transform:none} }
    @keyframes dxq-flash   { 0%{opacity:0} 15%{opacity:1} 100%{opacity:0} }

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
    .dxq-btn:disabled { opacity:.35; cursor:not-allowed; }

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
    .dxq-sprite.holo { animation:dxq-bob 3s ease-in-out infinite, dxq-holo 3s linear infinite; }

    .dxq-fight-bg {
      width:100%; max-height:180px; object-fit:cover;
      object-position:center top;
      border:1px solid rgba(0,200,255,.15);
      margin-bottom:12px;
      image-rendering:pixelated;
    }

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
    .dxq-goto { color:#ffcc5a; font-size:8px; margin-top:6px; }

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

    #dxq-flash {
      position:fixed; inset:0; z-index:9200;
      background:#fff;
      pointer-events:none;
      animation:dxq-flash .6s ease forwards;
    }

    .dxq-badge {
      font-family:var(--font-pixel,monospace);
      font-size:9px; letter-spacing:2px;
      color:#00e5ff; text-align:center;
      border:1px solid rgba(0,200,255,.3);
      padding:8px 14px;
      margin-bottom:14px;
      text-transform:uppercase;
    }
  `;
  document.head.appendChild(style);
}

// ── Overlay helpers ───────────────────────────────────────────
let _overlay = null;
let _closeBtnEl = null;

function _buildOverlay() {
  _injectStyles();
  const el = document.createElement('div');
  el.id = 'dxq-overlay';
  document.body.appendChild(el);
  _overlay = el;

  const closeBtn = document.createElement('span');
  closeBtn.className = 'dxq-close-btn';
  closeBtn.textContent = `✕ ${_t('FERMER', 'CLOSE')}`;
  closeBtn.onclick = () => _closeOverlay();
  document.body.appendChild(closeBtn);
  _closeBtnEl = closeBtn;

  return el;
}

function _clearOverlay() { if (_overlay) _overlay.innerHTML = ''; }

function _closeOverlay(ms = 400) {
  if (!_overlay) return;
  const el = _overlay;
  el.style.transition = `opacity ${ms}ms ease`;
  el.style.opacity = '0';
  _closeBtnEl?.remove();
  _closeBtnEl = null;
  _overlay = null;
  setTimeout(() => { el.remove(); }, ms);
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

  await _wait(800);
  if (!_overlay) return;

  _clearOverlay();
  const box = _box();
  _label(box, _t('Devon Research Corporation — Signal classifié', 'Devon Research Corporation — Classified Signal'));
  _titleEl(box, _t('☄️  Anomalie Extraterrestre Détectée', '☄️  Extraterrestrial Anomaly Detected'));
  const txt = _textEl(box);

  await _typewrite(txt, _t(
    'Professeur Cozmo vient de nous transmettre des données alarmantes.\n\n' +
    'Un objet non-identifié a pénétré l\'atmosphère il y a 72 heures.\n' +
    'Les relevés indiquent une signature ADN… vivante.\n\n' +
    'Devon a localisé le signal : il émane de plusieurs zones Hoenn.\n' +
    'Nos laboratoires sont en alerte maximale.\n\n' +
    'Nous avons besoin d\'une organisation capable de mener une opération discrète.\n' +
    'Votre réputation vous précède, Parrain.',
    'Professor Cozmo has just transmitted alarming data to us.\n\n' +
    'An unidentified object entered the atmosphere 72 hours ago.\n' +
    'Readings show a DNA signature… a living one.\n\n' +
    'Devon has located the signal: it\'s emanating from several Hoenn zones.\n' +
    'Our laboratories are on maximum alert.\n\n' +
    'We need an organization capable of running a discreet operation.\n' +
    'Your reputation precedes you, Boss.',
  ));

  const ch = _choices(box);
  const bAcc = _btn(_t('▸  Accepter l\'opération "Forme ADN"', '▸  Accept Operation "DNA Form"'), 'cyan');
  const bDec = _btn(_t('▸  Pas maintenant — fermer', '▸  Not now — close'));

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
    _notify(_t('☄️ Quête Deoxys disponible — rouvrez-la depuis les zones Hoenn.', '☄️ Deoxys quest available — reopen it from the Hoenn zones.'), '');
  };

  ch.appendChild(bAcc);
  ch.appendChild(bDec);
}

async function _showQuestStep2() {
  _clearOverlay();
  const box = _box();
  _label(box, 'Devon Research Corporation');

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
  await _typewrite(txt, _t(
    'Les scanners captent une présence aux abords de la Tour Céleste\n' +
    'et du Mont Chimère. Elle se déplace. Elle observe.\n\n' +
    'Nous l\'appelons provisoirement… "Forme ADN".\n\n' +
    'Première mission : établissez votre emprise sur Hoenn.\n' +
    'Affrontez les dresseurs locaux — 20 combats — pour repérer\n' +
    'les zones d\'activité du signal.',
    'Scanners are picking up a presence near Sky Pillar\n' +
    'and Mt. Chimney. It moves. It watches.\n\n' +
    'We\'re provisionally calling it… "DNA Form".\n\n' +
    'First mission: establish your grip on Hoenn.\n' +
    'Face local trainers — 20 battles — to pinpoint\n' +
    'the signal\'s zones of activity.',
  ));

  const ch = _choices(box);
  const bStart = _btn(_t('▸  Commencer la mission →', '▸  Start the mission →'), 'cyan');
  bStart.onclick = () => {
    _closeOverlay();
    globalThis.switchTab?.('tabZones');
    _notify(_t('☄️ Étape 1/5 — Vaincre 20 dresseurs dans les zones Hoenn.', '☄️ Step 1/5 — Defeat 20 trainers in the Hoenn zones.'), 'gold');
  };
  ch.appendChild(bStart);
}

// ════════════════════════════════════════════════════════════════
//  RENCONTRES DE QUÊTE (sprite sur zone → popup de combat réel)
// ════════════════════════════════════════════════════════════════

function _openDirector() {
  const q = _qs();
  if (!q || q.step !== 4) return;
  if (!q.directorEncounter) q.directorEncounter = defaultEncounterState();
  globalThis.openQuestEncounterPopup?.({
    id: 'dxq-director', kind: 'trainer',
    name: 'Devon Stone', icon: '☄️',
    spriteUrl: globalThis.trainerSprite?.('scientist') ?? '',
    lore: _t('Directeur du Laboratoire Devon', 'Devon Lab Director'),
    team: DIRECTOR_TEAM,
    encounterState: q.directorEncounter,
    onResolved: (result) => {
      if (!result.won) return;
      q.labBossDefeated = true;
      q.step = 5;
      _notify(_t('☄️ Devon Stone est vaincu. Rendez-vous au Laboratoire Spatial pour affronter Deoxys.', '☄️ Devon Stone is defeated. Head to the Space Lab to face Deoxys.'), 'gold');
      _save();
      _repatchZone(LAB_ZONE_ID);
    },
  });
}

/** Combat réel contre Deoxys — appelé directement en rejeu (phases déjà vues). */
function _openDeoxysFight() {
  const q = _qs();
  if (!q || (q.step !== 5 && q.step !== 6)) return;
  if (!q.deoxysEncounter) q.deoxysEncounter = defaultEncounterState();
  globalThis.openQuestEncounterPopup?.({
    id: 'dxq-deoxys', kind: 'legendary',
    name: 'Deoxys', icon: '☄️', spriteUrl: DEOXYS_SPRITE,
    team: [{ species_en: DEOXYS_SPECIES, level: DEOXYS_LEVEL, potential: DEOXYS_POT }],
    statMult: DEOXYS_STAT_MULT, catchBase: DEOXYS_CATCH_BASE,
    potential: DEOXYS_POT, zoneId: LAB_ZONE_ID,
    encounterState: q.deoxysEncounter,
    onResolved: (result) => {
      if (!result.won) return;
      if (!result.captured) {
        _notify(_t('☄️ Deoxys s\'échappe !', '☄️ Deoxys escapes!'), '');
        return;
      }
      _addDeoxysToPC();
      q.deoxysOwned = true;
      q.totalCaptures = (q.totalCaptures || 0) + 1;
      q.step = 6;
      _notify(_t(`★ Deoxys capturé — Niv.${DEOXYS_LEVEL} / Pot.${DEOXYS_POT} !`, `★ Deoxys caught — Lv.${DEOXYS_LEVEL} / Pot.${DEOXYS_POT}!`), 'gold');
      _save();
      _repatchZone(LAB_ZONE_ID);
    },
  });
}

/** Clic sur le sprite en zone : joue la révélation en 3 phases une seule
 *  fois (cosmétique, ne détermine rien), puis enchaîne sur le vrai combat. */
async function _openDeoxys() {
  const q = _qs();
  if (!q || (q.step !== 5 && q.step !== 6)) return;
  if (q.deoxysPhasesShown) { _openDeoxysFight(); return; }

  _buildOverlay();
  const box = _box();
  _label(box, _t('Étape 5 — Confrontation Finale', 'Step 5 — Final Confrontation'));

  const fightImg = document.createElement('img');
  fightImg.src = DEOXYS_FIGHT_HALF;
  fightImg.className = 'dxq-fight-bg';
  fightImg.alt = 'Deoxys';
  box.appendChild(fightImg);

  const txt = _textEl(box);
  await _typewrite(txt, _t(
    'La chambre de confinement vibre.\n\n' +
    'Deoxys flotte au centre, son cristal nucléaire pulsant d\'une\n' +
    'lumière qui transperce l\'obscurité.\n\n' +
    'Il n\'est pas prisonnier.\n' +
    'Il attend.',
    'The containment chamber vibrates.\n\n' +
    'Deoxys floats at the center, its nucleus crystal pulsing with\n' +
    'a light that pierces the darkness.\n\n' +
    'It is not a prisoner.\n' +
    'It is waiting.',
  ), 20);
  if (!_overlay) return;

  const phases = [
    {
      name: _t('Forme Attaque', 'Attack Forme'),
      desc: _t('Les tentacules de Deoxys se déploient en lames tranchantes.\nPuissance brute concentrée en un seul impact.',
               'Deoxys\'s tentacles unfurl into sharp blades.\nRaw power concentrated into a single impact.'),
      color: '#ff3333',
    },
    {
      name: _t('Forme Défense', 'Defense Forme'),
      desc: _t('Le cristal se rétracte. Une carapace translucide\nenveloppe sa silhouette — presque impénétrable.',
               'The crystal retracts. A translucent shell\nenvelops its form — nearly impenetrable.'),
      color: '#3399ff',
    },
    {
      name: _t('Forme Vitesse', 'Speed Forme'),
      desc: _t('Il disparaît.\nTu ne le vois plus — tu ne fais que subir.',
               'It vanishes.\nYou can no longer see it — you can only endure.'),
      color: '#33ffcc',
    },
  ];

  for (let i = 0; i < phases.length; i++) {
    if (!_overlay) return;
    _clearOverlay();
    const pbox = _box();
    const phase = phases[i];

    const badge = document.createElement('div');
    badge.className = 'dxq-badge';
    badge.style.borderColor = `rgba(${phase.color.slice(1).match(/../g).map(x => parseInt(x, 16)).join(',')}, .4)`;
    badge.style.color = phase.color;
    badge.textContent = `— ${_t('PHASE', 'PHASE')} ${i + 1} / 3 — ${phase.name} —`;
    pbox.appendChild(badge);

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
    pbox.appendChild(sw);

    const ptxt = _textEl(pbox);
    await _typewrite(ptxt, phase.desc, 28);
    if (!_overlay) return;

    if (i < phases.length - 1) {
      await _wait(400);
      const ch = _choices(pbox);
      const bNext = _btn(`▸  ${_t('Phase suivante', 'Next phase')} →`, 'cyan');
      await new Promise(res => { bNext.onclick = () => { ch.innerHTML = ''; res(); }; ch.appendChild(bNext); });
      _flash();
      await _wait(500);
    }
  }

  await _wait(300);
  _flash();
  await _wait(700);
  if (!_overlay) return;

  q.deoxysPhasesShown = true;
  _save();
  _closeOverlay();
  setTimeout(() => _openDeoxysFight(), 300);
}

/** Agrégateur appelé par modules/ui/zoneWindows.js. */
export function getDeoxysQuestEncounterForZone(zoneId) {
  if (zoneId !== LAB_ZONE_ID) return null;
  const q = _qs();
  if (!q?.active) return null;
  if (q.step === 4) {
    return { id: 'dxq-director', name: 'Devon Stone', icon: '☄️', spriteUrl: globalThis.trainerSprite?.('scientist') ?? '', onClick: () => _openDirector() };
  }
  if (q.step === 5 || q.step === 6) {
    return { id: 'dxq-deoxys', name: 'Deoxys', icon: '☄️', spriteUrl: DEOXYS_SPRITE, onClick: () => _openDeoxys() };
  }
  return null;
}

function _addDeoxysToPC() {
  const s = _state();
  if (!s) return;
  try {
    const p = globalThis.makePokemon?.(DEOXYS_SPECIES, LAB_ZONE_ID, 'pokeball');
    if (p) {
      p.level     = DEOXYS_LEVEL;
      p.shiny     = false;
      p.potential = DEOXYS_POT;
      if (globalThis.calculateStats) p.stats = globalThis.calculateStats(p);
      s.pokemons.push(p);
      EventBus.emit(EVENTS.STATE_DIRTY);
      EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: p, zoneId: LAB_ZONE_ID, source: 'quest' });
      globalThis.registerPokedexCapture?.(s, p);
      _notify(_t(`⭐ Deoxys (Niv.${DEOXYS_LEVEL} / Pot.${DEOXYS_POT}) a rejoint le Gang !`, `⭐ Deoxys (Lv.${DEOXYS_LEVEL} / Pot.${DEOXYS_POT}) has joined the Gang!`), 'gold');
    }
  } catch (e) {
    console.warn('[deoxysMission] makePokemon failed:', e);
  }
}

// ════════════════════════════════════════════════════════════════
//  TRACKER — vue d'ensemble de la quête
// ════════════════════════════════════════════════════════════════

function openDeoxysMission() {
  if (_overlay) return;
  const q = _qs();
  if (!q) return;

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
  const zoneName  = globalThis.getZoneById?.(LAB_ZONE_ID)?.[s.lang === 'en' ? 'en' : 'fr'] ?? LAB_ZONE_ID;

  const box = _box();
  _label(box, _t('— Quête Légendaire —', '— Legendary Quest —'));
  _titleEl(box, _t('☄️  Opération : Forme ADN', '☄️  Operation: DNA Form'));

  const mRow = document.createElement('div');
  mRow.className = 'dxq-meteore-row';
  mRow.innerHTML = `☄️ ${_t('Météores', 'Meteorites')} : <strong style="margin-left:4px">${meteores}</strong>
    <span style="opacity:.5;font-size:7px;margin-left:8px">— ${_t('0,5 % par combat Hoenn', '0.5% per Hoenn battle')}</span>`;
  box.appendChild(mRow);

  const pRow = document.createElement('div');
  pRow.className = 'dxq-power-row';
  pRow.innerHTML = `<span class="dxq-power-label">${_t('Puissance Boss', 'Boss Power')}</span>
    <span class="dxq-power-val">${bosspower.toLocaleString()}</span>`;
  box.appendChild(pRow);

  const tracker = document.createElement('div');
  tracker.className = 'dxq-tracker';
  tracker.style.marginTop = '14px';
  box.appendChild(tracker);

  const steps = [
    {
      n: 1, title: _t('Signal Anomal', 'Anomalous Signal'),
      desc: _t('Vaincre 20 dresseurs dans les zones Hoenn', 'Defeat 20 trainers in the Hoenn zones'),
      progress: q.step > 1 ? 1 : (q.trainersDefeated || 0) / TARGET_TRAINERS,
    },
    {
      n: 2, title: _t('Fragments de Météorite', 'Meteorite Fragments'),
      desc: _t(`Collecter 3 Météores (0,5 % par combat Hoenn)\nActuellement : ${meteores} météore${meteores !== 1 ? 's' : ''} en inventaire`,
                `Collect 3 Meteorites (0.5% per Hoenn battle)\nCurrently: ${meteores} meteorite${meteores !== 1 ? 's' : ''} in inventory`),
      progress: q.step > 2 ? 1 : Math.min(meteores, TARGET_METEORES) / TARGET_METEORES,
    },
    {
      n: 3, title: _t('Infiltration du Laboratoire', 'Lab Infiltration'),
      desc: _t('Vaincre 10 combats dans le Laboratoire Spatial Devon', 'Win 10 battles in the Devon Space Lab'),
      progress: q.step > 3 ? 1 : (q.labFightsWon || 0) / TARGET_LAB_FIGHTS,
    },
    {
      n: 4, title: _t('Prise de Contrôle', 'Taking Control'),
      desc: _t('Vaincre le Directeur du Laboratoire Devon', 'Defeat the Devon Lab Director'),
      goto: q.step === 4,
    },
    {
      n: 5, title: _t('Confrontation : Forme ADN', 'Confrontation: DNA Form'),
      desc: _t('Combat final contre Deoxys', 'Final battle against Deoxys'),
      goto: q.step === 5,
      actionLabel: q.step === 6 ? `♺ ${_t('Rejouer', 'Retry')} (1 ${_t('Météore', 'Meteorite')})` : undefined,
      actionAvail: q.step === 6 && meteores >= 1,
      actionFn: () => {
        const inv = _state().inventory;
        if ((inv.meteore || 0) < 1) return;
        inv.meteore--;
        q.step = 5;
        q.deoxysEncounter = defaultEncounterState();
        _save();
        _clearOverlay();
        _renderTracker();
        _repatchZone(LAB_ZONE_ID);
        _notify(_t('☄️ Deoxys réapparaît au Laboratoire Spatial.', '☄️ Deoxys reappears at the Space Lab.'), 'gold');
      },
    },
  ];

  for (const st of steps) {
    const div = document.createElement('div');
    const done = q.step > st.n || (st.n === 5 && q.step === 6 && q.deoxysOwned);
    const active = q.step === st.n || (st.n === 5 && q.step === 6);
    const locked = q.step < st.n && !(st.n === 5 && q.step === 6);

    div.className = 'dxq-step' + (done ? ' done' : '') + (active ? ' active' : '') + (locked ? ' locked' : '');

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

    if (st.progress !== undefined) {
      const pct = Math.min(Math.round(st.progress * 100), 100);
      const barWrap = document.createElement('div');
      barWrap.className = 'dxq-progress-bar';
      const fill = document.createElement('div');
      fill.className = 'dxq-progress-fill';
      fill.style.width = pct + '%';
      barWrap.appendChild(fill);
      body.appendChild(barWrap);
    }

    if (st.goto) {
      const gotoEl = document.createElement('div');
      gotoEl.className = 'dxq-goto';
      gotoEl.textContent = `→ ${_t('Rendez-vous au', 'Head to the')} ${zoneName}`;
      body.appendChild(gotoEl);
    }

    if (st.actionLabel && active) {
      const actDiv = document.createElement('div');
      actDiv.style.marginTop = '8px';
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
}

// ════════════════════════════════════════════════════════════════
//  DÉCLENCHEMENT
// ════════════════════════════════════════════════════════════════

function checkDeoxysMissionUnlock() {
  const s = _state();
  if (!s) return;
  const q = _qs();

  if (q.active) return;

  if (!s.purchases?.hoennUnlocked) return;
  if (!s.zones?.['ever_grande_hoenn']?.gymDefeated) return;
  if ((s.gang?.reputation ?? 0) < 4000) return;

  setTimeout(() => _showQuestIntro(), 2500);
}

// ── Init ─────────────────────────────────────────────────────
_register();

// ── Exports globalThis ────────────────────────────────────────
Object.assign(globalThis, {
  openDeoxysMission,
  checkDeoxysMissionUnlock,
  getDeoxysQuestEncounterForZone,
  onItemGiftReceived: _onItemGiftReceived, // hook depuis zoneSystem
});

export { openDeoxysMission, checkDeoxysMissionUnlock };
export {};
