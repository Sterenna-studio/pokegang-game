'use strict';

// ════════════════════════════════════════════════════════════════
//  JOHTO MISSIONS — Bêtes Sacrées · Lugia · Ho-Oh
//  Trois quêtes parallèles inspirées de Pokémon Or/Argent.
//
//  Quête Bêtes Sacrées (5 étapes) :
//    1. Vaincre 30 membres Rocket dans les zones Johto
//    2. Infiltrer le QG Rocket (15 combats dans team_rocket_hq)
//    3. Vaincre Petrel — Admin Rocket (puissance ≥ 2 000)
//    4. Vaincre Ariana  — Admin Rocket (puissance ≥ 2 800)
//    5. Choisir et affronter une Bête Sacrée (puissance ≥ 4 000)
//
//  Quête Lugia (5 étapes) :
//    1. Vaincre 20 combats dans les zones marines Johto
//    2. Collecter 5 Argent'Ailes (drop auto dans zones Johto)
//    3. Vaincre Eusine (puissance ≥ 2 500)
//    4. Vaincre 15 combats dans les Îles Tourbillon
//    5. Affronter Lugia (puissance ≥ 5 000)
//
//  Quête Ho-Oh (5 étapes) :
//    1. Vaincre 20 combats dans les zones rurales Johto
//    2. Collecter 5 Arcenci'Ailes (drop auto dans zones Johto)
//    3. Vaincre les Filles Kimono (puissance ≥ 2 500)
//    4. Vaincre 15 combats dans la Tour Carillon
//    5. Affronter Ho-Oh (puissance ≥ 5 500)
//
//  Rejouable :
//    1 Cristal Bête   → relance combat Bête Sacrée choisie
//    1 Argent'Aile    → relance combat Lugia
//    1 Arcenci'Aile   → relance combat Ho-Oh
//
//  Déclenchement :
//    checkJohtoMissionsUnlock()  — au boot + après déblocage Johto
//    openJohtoMissions()         — ouvre le tracker triple
//
//  Dépendances globalThis :
//    state, saveState, makePokemon, calculateStats, getBossTeamPower,
//    trainerSprite, switchTab
//  Dépendances bare-name (classic scripts) :
//    ZONE_BY_ID (Johto zones are merged into ZONES global)
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';
import { resolveSpecialCombat } from './specialCombat.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });
const _save   = ()               => globalThis.saveState?.();

// ── Sprites ──────────────────────────────────────────────────────
const LUGIA_SPRITE    = 'https://play.pokemonshowdown.com/sprites/gen5ani/lugia.gif';
const LUGIA_STATIC    = 'https://play.pokemonshowdown.com/sprites/gen2/lugia.png';
const HOOH_SPRITE     = 'https://play.pokemonshowdown.com/sprites/gen5ani/ho-oh.gif';
const HOOH_STATIC     = 'https://play.pokemonshowdown.com/sprites/gen2/ho-oh.png';
const RAIKOU_SPRITE   = 'https://play.pokemonshowdown.com/sprites/gen5ani/raikou.gif';
const ENTEI_SPRITE    = 'https://play.pokemonshowdown.com/sprites/gen5ani/entei.gif';
const SUICUNE_SPRITE  = 'https://play.pokemonshowdown.com/sprites/gen5ani/suicune.gif';
const RAIKOU_STATIC   = 'https://play.pokemonshowdown.com/sprites/gen2/raikou.png';
const ENTEI_STATIC    = 'https://play.pokemonshowdown.com/sprites/gen2/entei.png';
const SUICUNE_STATIC  = 'https://play.pokemonshowdown.com/sprites/gen2/suicune.png';

// ── Zones de suivi ───────────────────────────────────────────────
const _ROCKET_JOHTO = new Set([
  'team_rocket_hq', 'radio_tower', 'slowpoke_well', 'johto_gang_hq', 'mahogany_gym',
]);
const _MARINE_JOHTO = new Set([
  'whirl_islands', 'cianwood_gym', 'olivine_gym', 'route44_45_46', 'azalea_gym', 'dragons_den',
]);
const _RURAL_JOHTO = new Set([
  'route29', 'route30_31', 'ilex_forest', 'national_park', 'route36_37', 'mt_mortar', 'route42_43',
]);
const _WHIRL_ZONE  = 'whirl_islands';
const _TIN_ZONE    = 'tin_tower';

// ── Helpers ───────────────────────────────────────────────────────
const _state = () => globalThis.state ?? null;

function _qBetes()  { return _state()?.betesMission  ?? null; }
function _qLugia()  { return _state()?.lugiaMission  ?? null; }
function _qHooh()   { return _state()?.hoohMission   ?? null; }

function _isJohtoZone(zoneId) {
  if (!zoneId) return false;
  // ZONE_BY_ID is the merged kanto+johto global; Johto zones have ids we can identify by prefix or set
  if (typeof ZONE_BY_ID !== 'undefined') return !!ZONE_BY_ID[zoneId];
  return false;
}

function _wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function _typewrite(el, text, speed = 26) {
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

// ── Enregistrement EventBus ───────────────────────────────────────
let _registered = false;

function _register() {
  if (_registered) return;
  _registered = true;
  EventBus.on(EVENTS.COMBAT_WON, _onCombatWon);
  EventBus.on(EVENTS.ITEM_RECEIVED, _onItemReceived);
}

function _onCombatWon({ zoneId } = {}) {
  const s = _state();
  if (!s) return;
  let dirty = false;

  // ── Bêtes Sacrées ────────────────────────────────────────────
  const bm = _qBetes();
  if (bm?.active) {
    if (bm.step === 1 && _ROCKET_JOHTO.has(zoneId)) {
      bm.rocketFightsWon = Math.min((bm.rocketFightsWon || 0) + 1, 30);
      if (bm.rocketFightsWon >= 30) {
        bm.step = 2;
        _notify('🐅 30 membres Rocket vaincus ! Infiltrez maintenant le QG Rocket.', 'gold');
      }
      dirty = true;
    }
    if (bm.step === 2 && zoneId === 'team_rocket_hq') {
      bm.hqFightsWon = Math.min((bm.hqFightsWon || 0) + 1, 15);
      if (bm.hqFightsWon >= 15) {
        bm.step = 3;
        _notify('🐅 QG Rocket infiltré ! Affrontez Petrel depuis la quête.', 'gold');
      }
      dirty = true;
    }
  }

  // ── Lugia ─────────────────────────────────────────────────────
  const lm = _qLugia();
  if (lm?.active) {
    if (lm.step === 1 && _MARINE_JOHTO.has(zoneId)) {
      lm.marineFightsWon = Math.min((lm.marineFightsWon || 0) + 1, 20);
      if (lm.marineFightsWon >= 20) {
        lm.step = 2;
        _notify("🌊 Zones marines quadrillées ! Collectez 5 Argent'Ailes.", 'gold');
      }
      dirty = true;
    }
    if (lm.step === 4 && zoneId === _WHIRL_ZONE) {
      lm.whirlFightsWon = Math.min((lm.whirlFightsWon || 0) + 1, 15);
      if (lm.whirlFightsWon >= 15) {
        lm.step = 5;
        _notify('🌊 Îles Tourbillon domptées ! Lugia vous attend dans les profondeurs.', 'gold');
      }
      dirty = true;
    }
  }

  // ── Ho-Oh ─────────────────────────────────────────────────────
  const hm = _qHooh();
  if (hm?.active) {
    if (hm.step === 1 && _RURAL_JOHTO.has(zoneId)) {
      hm.ruralFightsWon = Math.min((hm.ruralFightsWon || 0) + 1, 20);
      if (hm.ruralFightsWon >= 20) {
        hm.step = 2;
        _notify("🌈 Zones rurales sécurisées ! Collectez 5 Arcenci'Ailes.", 'gold');
      }
      dirty = true;
    }
    if (hm.step === 4 && zoneId === _TIN_ZONE) {
      hm.tinFightsWon = Math.min((hm.tinFightsWon || 0) + 1, 15);
      if (hm.tinFightsWon >= 15) {
        hm.step = 5;
        _notify('🌈 Tour Carillon conquise ! Ho-Oh vous attend au sommet.', 'gold');
      }
      dirty = true;
    }
  }

  if (dirty) _save();
}

function _onItemReceived({ itemId } = {}) {
  const s = _state();
  if (!s) return;
  let dirty = false;

  // Argent'Aile → progression quête Lugia étape 2
  if (itemId === 'silver_wing') {
    const lm = _qLugia();
    if (lm?.active && lm.step === 2) {
      lm.silverWings = Math.min((lm.silverWings || 0) + 1, 5);
      if (lm.silverWings >= 5) {
        lm.step = 3;
        _notify("🌊 5 Argent'Ailes réunies ! Affrontez Eusine depuis la quête Lugia.", 'gold');
      }
      dirty = true;
    }
  }

  // Arcenci'Aile → progression quête Ho-Oh étape 2
  if (itemId === 'rainbow_wing') {
    const hm = _qHooh();
    if (hm?.active && hm.step === 2) {
      hm.rainbowWings = Math.min((hm.rainbowWings || 0) + 1, 5);
      if (hm.rainbowWings >= 5) {
        hm.step = 3;
        _notify("🌈 5 Arcenci'Ailes réunies ! Affrontez les Filles Kimono depuis la quête Ho-Oh.", 'gold');
      }
      dirty = true;
    }
  }

  if (dirty) _save();
}

// ── Styles (prefix jhm-) ─────────────────────────────────────────
function _injectStyles() {
  if (document.getElementById('jhm-styles')) return;
  const s = document.createElement('style');
  s.id = 'jhm-styles';
  s.textContent = `
    #jhm-overlay {
      position:fixed; inset:0; z-index:9100;
      background:#040a04;
      display:flex; flex-direction:column; align-items:center;
      padding:16px 12px 20px; overflow-y:auto;
      animation:jhm-fadein .4s ease both;
    }
    @keyframes jhm-fadein  { from{opacity:0} to{opacity:1} }
    @keyframes jhm-fadeout { from{opacity:1} to{opacity:0} }
    @keyframes jhm-float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
    @keyframes jhm-appear  { from{opacity:0;transform:scale(.9) translateY(10px)} to{opacity:1;transform:none} }
    @keyframes jhm-pulse   { 0%,100%{opacity:.4} 50%{opacity:1} }

    .jhm-wrap {
      width:100%; max-width:860px;
      display:flex; flex-direction:column; gap:12px;
    }
    .jhm-header {
      text-align:center; padding:8px 0 4px;
    }
    .jhm-header-label {
      font-family:var(--font-pixel,monospace);
      font-size:7px; letter-spacing:4px; text-transform:uppercase;
      color:rgba(120,200,120,.6); margin-bottom:4px;
    }
    .jhm-header-title {
      font-family:var(--font-pixel,monospace);
      font-size:11px; letter-spacing:2px; text-transform:uppercase;
      color:#90ee90; text-shadow:0 0 12px rgba(100,200,100,.6);
    }

    /* Grille triple */
    .jhm-triple {
      display:grid; grid-template-columns:repeat(3,1fr);
      gap:10px; width:100%;
    }
    @media(max-width:680px) { .jhm-triple { grid-template-columns:1fr; } }

    /* Carte de quête */
    .jhm-card {
      background:rgba(4,10,4,.95);
      border:1px solid rgba(80,160,80,.2);
      border-left:3px solid var(--jhm-accent,#4a9);
      padding:14px 14px 12px;
      display:flex; flex-direction:column; gap:8px;
      box-shadow:0 0 20px rgba(50,150,50,.06);
      position:relative;
      animation:jhm-appear .4s ease both;
    }
    .jhm-card-label {
      font-family:var(--font-pixel,monospace);
      font-size:6px; letter-spacing:3px; text-transform:uppercase;
      color:var(--jhm-accent,#4a9); opacity:.8;
    }
    .jhm-card-title {
      font-family:var(--font-pixel,monospace);
      font-size:9px; letter-spacing:1px; text-transform:uppercase;
      color:var(--jhm-accent,#4a9);
    }
    .jhm-sprite-row {
      display:flex; align-items:center; justify-content:center;
      gap:10px; padding:6px 0;
      min-height:72px;
    }
    .jhm-sprite {
      image-rendering:pixelated; height:64px; width:auto;
      animation:jhm-float 3s ease-in-out infinite;
    }
    .jhm-sprite.grey { filter:grayscale(1) brightness(.5); animation:jhm-pulse 2s ease-in-out infinite; }
    .jhm-sprite-alt { display:flex; gap:4px; align-items:center; }
    .jhm-sprite-alt img { image-rendering:pixelated; height:48px; width:auto; }
    .jhm-sprite-alt img.grey { filter:grayscale(1) brightness(.4); }

    /* Steps */
    .jhm-steps { display:flex; flex-direction:column; gap:4px; }
    .jhm-step {
      display:flex; align-items:flex-start; gap:6px;
      font-family:var(--font-pixel,monospace);
      font-size:7.5px; line-height:1.6;
      color:rgba(180,220,180,.5);
      border-left:2px solid rgba(80,160,80,.1);
      padding:3px 0 3px 7px;
    }
    .jhm-step.active {
      color:#c8e6c8;
      border-left-color:var(--jhm-accent,#4a9);
      background:rgba(50,150,50,.06);
    }
    .jhm-step.done {
      color:rgba(100,180,100,.6);
      border-left-color:rgba(80,160,80,.25);
      text-decoration:line-through;
    }
    .jhm-step-num {
      font-size:6px; opacity:.7; flex-shrink:0;
      margin-top:1px; min-width:10px;
    }
    .jhm-step-bar {
      height:2px; background:rgba(80,160,80,.15);
      border-radius:1px; margin-top:2px;
    }
    .jhm-step-bar-fill {
      height:100%; background:var(--jhm-accent,#4a9);
      border-radius:1px; transition:width .3s;
    }

    /* Actions */
    .jhm-actions { display:flex; gap:6px; flex-wrap:wrap; margin-top:4px; }
    .jhm-btn {
      font-family:var(--font-pixel,monospace); font-size:7.5px;
      letter-spacing:.5px; text-transform:uppercase;
      padding:5px 10px; border:1px solid var(--jhm-accent,#4a9);
      background:transparent; color:var(--jhm-accent,#4a9);
      cursor:pointer; transition:background .15s, color .15s;
    }
    .jhm-btn:hover { background:var(--jhm-accent,#4a9); color:#010a01; }
    .jhm-btn:disabled { opacity:.35; cursor:not-allowed; }
    .jhm-btn.primary { background:var(--jhm-accent,#4a9); color:#010a01; }
    .jhm-btn.primary:hover { filter:brightness(1.15); }
    .jhm-btn.gold { border-color:var(--gold,#ffcc5a); color:var(--gold,#ffcc5a); }
    .jhm-btn.gold:hover { background:var(--gold,#ffcc5a); color:#080400; }
    .jhm-rerun-note {
      font-family:var(--font-pixel,monospace); font-size:6.5px;
      color:rgba(200,200,160,.4); text-align:center; padding-top:2px;
    }

    /* Popup de sélection de bête */
    .jhm-beast-grid {
      display:grid; grid-template-columns:repeat(3,1fr);
      gap:10px; width:100%; margin:12px 0;
    }
    .jhm-beast-card {
      background:rgba(5,15,5,.9);
      border:1px solid rgba(80,160,80,.2);
      padding:12px 8px 10px;
      display:flex; flex-direction:column; align-items:center; gap:6px;
      cursor:pointer; transition:border-color .2s, background .2s;
    }
    .jhm-beast-card:hover { border-color:var(--jhm-accent,#4a9); background:rgba(50,150,50,.1); }
    .jhm-beast-name {
      font-family:var(--font-pixel,monospace);
      font-size:8px; letter-spacing:1px; text-transform:uppercase;
      color:#c8e6c8;
    }
    .jhm-beast-type {
      font-family:var(--font-pixel,monospace);
      font-size:6.5px; color:rgba(180,220,180,.5); letter-spacing:.5px;
    }

    /* Boîte de combat / résolution */
    .jhm-fight-box {
      background:rgba(3,8,3,.98);
      border:1px solid rgba(80,160,80,.3);
      padding:20px 22px 18px;
      width:100%; max-width:520px;
      position:relative;
      animation:jhm-appear .4s ease both;
    }
    .jhm-fight-box::before {
      content:''; position:absolute; left:0; top:0; bottom:0; width:3px;
      background:var(--jhm-accent,#4a9); opacity:.8;
    }
    .jhm-fight-title {
      font-family:var(--font-pixel,monospace);
      font-size:9px; letter-spacing:2px; text-transform:uppercase;
      color:var(--jhm-accent,#4a9); margin-bottom:10px;
    }
    .jhm-fight-text {
      font-family:var(--font-pixel,monospace);
      font-size:8px; line-height:2; color:#c0d8c0;
      min-height:50px; margin-bottom:14px; white-space:pre-wrap;
    }
    .jhm-power-row {
      display:flex; gap:10px; margin-bottom:12px; flex-wrap:wrap;
    }
    .jhm-power-chip {
      font-family:var(--font-pixel,monospace); font-size:7px;
      padding:3px 8px; border:1px solid rgba(80,160,80,.3);
      color:rgba(180,220,180,.8); letter-spacing:.5px;
    }
    .jhm-result-banner {
      text-align:center; padding:10px 0;
      font-family:var(--font-pixel,monospace);
      font-size:10px; letter-spacing:2px;
    }
    .jhm-close-btn {
      position:fixed; top:14px; right:18px;
      font-family:var(--font-pixel,monospace); font-size:8px;
      color:rgba(100,180,100,.5); cursor:pointer; z-index:9200;
      padding:4px 8px; letter-spacing:1px;
      transition:color .15s;
    }
    .jhm-close-btn:hover { color:#90ee90; }
  `;
  document.head.appendChild(s);
}

// ── Tracker UI ────────────────────────────────────────────────────
function _buildTracker() {
  const s = _state();
  if (!s) return;
  const bm = _qBetes();
  const lm = _qLugia();
  const hm = _qHooh();

  const inv = s.inventory;
  const canRerunBetes = (bm?.step === 6) && (inv.cristal_bete > 0);
  const canRerunLugia = (lm?.step === 6) && (inv.silver_wing > 0);
  const canRerunHooh  = (hm?.step === 6) && (inv.rainbow_wing > 0);

  // ── Card Bêtes Sacrées ────────────────────────────────────────
  const betesSpriteHtml = () => {
    const chosen = bm?.chosenBeast;
    const sprites = { raikou: RAIKOU_STATIC, entei: ENTEI_STATIC, suicune: SUICUNE_STATIC };
    const names   = { raikou: 'Raikou', entei: 'Entei', suicune: 'Suicune' };
    if (chosen) {
      const done = bm.step === 6;
      return `<div class="jhm-sprite-row">
        <img class="jhm-sprite${done?'':' grey'}" src="${sprites[chosen]}" alt="${names[chosen]}">
      </div>`;
    }
    return `<div class="jhm-sprite-row">
      <div class="jhm-sprite-alt">
        <img class="grey" src="${RAIKOU_STATIC}" alt="Raikou">
        <img class="grey" src="${ENTEI_STATIC}" alt="Entei">
        <img class="grey" src="${SUICUNE_STATIC}" alt="Suicune">
      </div>
    </div>`;
  };

  const betesSteps = [
    { label:'Vaincre 30 membres Rocket (Johto)', done: bm?.rocketFightsWon >= 30, prog: bm?.rocketFightsWon ?? 0, max: 30 },
    { label:'Infiltrer le QG Rocket (15 combats)', done: bm?.hqFightsWon >= 15, prog: bm?.hqFightsWon ?? 0, max: 15 },
    { label:'Vaincre Petrel — Admin Rocket', done: bm?.petrelDefeated ?? false, prog: null, max: null },
    { label:'Vaincre Ariana — Admin Rocket', done: bm?.arianaDefeated ?? false, prog: null, max: null },
    { label:'Affronter la Bête Sacrée choisie', done: bm?.beastOwned ?? false, prog: null, max: null },
  ];
  const betesActive = bm?.step ?? 0;
  const betesStepsHtml = betesSteps.map((st, i) => {
    const idx = i + 1;
    const isDone = st.done;
    const isAct  = !isDone && idx === betesActive;
    const cls    = isDone ? 'done' : isAct ? 'active' : '';
    let bar = '';
    if (isAct && st.max) {
      const pct = Math.round((st.prog / st.max) * 100);
      bar = `<div class="jhm-step-bar"><div class="jhm-step-bar-fill" style="width:${pct}%"></div></div>`;
    }
    const extra = isAct && st.max ? ` (${st.prog}/${st.max})` : '';
    return `<div class="jhm-step ${cls}">
      <span class="jhm-step-num">${isDone ? '✓' : idx + '.'}</span>
      <div>${st.label}${extra}${bar}</div>
    </div>`;
  }).join('');

  const betesActions = () => {
    if (!bm?.active) return '';
    if (bm.step === 3 && !bm.petrelDefeated) {
      return `<button class="jhm-btn primary" data-jhm="petrel">⚔️ Affronter Petrel</button>`;
    }
    if (bm.step === 4 && !bm.arianaDefeated) {
      return `<button class="jhm-btn primary" data-jhm="ariana">⚔️ Affronter Ariana</button>`;
    }
    if (bm.step === 5) {
      if (!bm.chosenBeast) return `<button class="jhm-btn primary" data-jhm="choose-beast">🐅 Choisir une Bête</button>`;
      return `<button class="jhm-btn primary" data-jhm="beast-fight">⚔️ Affronter ${_beastName(bm.chosenBeast)}</button>`;
    }
    if (bm.step === 6) {
      if (canRerunBetes) return `<button class="jhm-btn gold" data-jhm="rerun-betes">💎 Relancer (${inv.cristal_bete}× Cristal)</button>`;
      return `<span class="jhm-rerun-note">Cristal Bête requis pour rejouer</span>`;
    }
    return '';
  };

  // ── Card Lugia ────────────────────────────────────────────────
  const lugiaStepsData = [
    { label:'Vaincre 20 combats (zones marines Johto)', done: lm?.marineFightsWon >= 20, prog: lm?.marineFightsWon ?? 0, max: 20 },
    { label:"Collecter 5 Argent'Ailes", done: lm?.silverWings >= 5, prog: lm?.silverWings ?? 0, max: 5 },
    { label:'Vaincre Eusine', done: lm?.eusineDefeated ?? false, prog: null, max: null },
    { label:'Vaincre 15 combats (Îles Tourbillon)', done: lm?.whirlFightsWon >= 15, prog: lm?.whirlFightsWon ?? 0, max: 15 },
    { label:'Affronter Lugia', done: lm?.lugiaOwned ?? false, prog: null, max: null },
  ];
  const lugiaActive = lm?.step ?? 0;
  const lugiaStepsHtml = lugiaStepsData.map((st, i) => {
    const idx = i + 1;
    const isDone = st.done;
    const isAct  = !isDone && idx === lugiaActive;
    const cls    = isDone ? 'done' : isAct ? 'active' : '';
    let bar = '';
    if (isAct && st.max) {
      const pct = Math.round((st.prog / st.max) * 100);
      bar = `<div class="jhm-step-bar"><div class="jhm-step-bar-fill" style="width:${pct}%"></div></div>`;
    }
    const extra = isAct && st.max ? ` (${st.prog}/${st.max})` : '';
    return `<div class="jhm-step ${cls}">
      <span class="jhm-step-num">${isDone ? '✓' : idx + '.'}</span>
      <div>${st.label}${extra}${bar}</div>
    </div>`;
  }).join('');

  const lugiaActions = () => {
    if (!lm?.active) return '';
    if (lm.step === 3 && !lm.eusineDefeated) {
      return `<button class="jhm-btn primary" data-jhm="eusine" style="--jhm-accent:#5599cc">⚔️ Affronter Eusine</button>`;
    }
    if (lm.step === 5) {
      return `<button class="jhm-btn primary" data-jhm="lugia" style="--jhm-accent:#5599cc">⚔️ Affronter Lugia</button>`;
    }
    if (lm.step === 6) {
      if (canRerunLugia) return `<button class="jhm-btn gold" data-jhm="rerun-lugia">🪶 Relancer (${inv.silver_wing}× Argent'Aile)</button>`;
      return `<span class="jhm-rerun-note">Argent'Aile requise pour rejouer</span>`;
    }
    return '';
  };

  // ── Card Ho-Oh ────────────────────────────────────────────────
  const hoohStepsData = [
    { label:'Vaincre 20 combats (zones rurales Johto)', done: hm?.ruralFightsWon >= 20, prog: hm?.ruralFightsWon ?? 0, max: 20 },
    { label:"Collecter 5 Arcenci'Ailes", done: hm?.rainbowWings >= 5, prog: hm?.rainbowWings ?? 0, max: 5 },
    { label:'Vaincre les Filles Kimono', done: hm?.kimonoDefeated ?? false, prog: null, max: null },
    { label:'Vaincre 15 combats (Tour Carillon)', done: hm?.tinFightsWon >= 15, prog: hm?.tinFightsWon ?? 0, max: 15 },
    { label:'Affronter Ho-Oh', done: hm?.hoohOwned ?? false, prog: null, max: null },
  ];
  const hoohActive = hm?.step ?? 0;
  const hoohStepsHtml = hoohStepsData.map((st, i) => {
    const idx = i + 1;
    const isDone = st.done;
    const isAct  = !isDone && idx === hoohActive;
    const cls    = isDone ? 'done' : isAct ? 'active' : '';
    let bar = '';
    if (isAct && st.max) {
      const pct = Math.round((st.prog / st.max) * 100);
      bar = `<div class="jhm-step-bar"><div class="jhm-step-bar-fill" style="width:${pct}%"></div></div>`;
    }
    const extra = isAct && st.max ? ` (${st.prog}/${st.max})` : '';
    return `<div class="jhm-step ${cls}">
      <span class="jhm-step-num">${isDone ? '✓' : idx + '.'}</span>
      <div>${st.label}${extra}${bar}</div>
    </div>`;
  }).join('');

  const hoohActions = () => {
    if (!hm?.active) return '';
    if (hm.step === 3 && !hm.kimonoDefeated) {
      return `<button class="jhm-btn primary" data-jhm="kimono" style="--jhm-accent:#cc9944">⚔️ Affronter les Kimono</button>`;
    }
    if (hm.step === 5) {
      return `<button class="jhm-btn primary" data-jhm="hooh" style="--jhm-accent:#cc9944">⚔️ Affronter Ho-Oh</button>`;
    }
    if (hm.step === 6) {
      if (canRerunHooh) return `<button class="jhm-btn gold" data-jhm="rerun-hooh">🌈 Relancer (${inv.rainbow_wing}× Arcenci'Aile)</button>`;
      return `<span class="jhm-rerun-note">Arcenci'Aile requise pour rejouer</span>`;
    }
    return '';
  };

  const html = `
    <div id="jhm-overlay">
      <span class="jhm-close-btn" id="jhm-close">✕ FERMER</span>
      <div class="jhm-wrap">
        <div class="jhm-header">
          <div class="jhm-header-label">Quêtes Légendaires</div>
          <div class="jhm-header-title">✦ JOHTO ✦</div>
        </div>
        <div class="jhm-triple">

          <!-- Bêtes Sacrées -->
          <div class="jhm-card" style="--jhm-accent:#e8a030">
            <div class="jhm-card-label">🐅 Bêtes Sacrées</div>
            <div class="jhm-card-title">Opération Rocket</div>
            ${betesSpriteHtml()}
            <div class="jhm-steps">${betesStepsHtml}</div>
            <div class="jhm-actions">${betesActions()}</div>
          </div>

          <!-- Lugia -->
          <div class="jhm-card" style="--jhm-accent:#5599cc">
            <div class="jhm-card-label">🌊 Lugia</div>
            <div class="jhm-card-title">Profondeurs</div>
            <div class="jhm-sprite-row">
              <img class="jhm-sprite${lm?.step === 6 ? '' : ' grey'}" src="${LUGIA_STATIC}" alt="Lugia">
            </div>
            <div class="jhm-steps">${lugiaStepsHtml}</div>
            <div class="jhm-actions">${lugiaActions()}</div>
          </div>

          <!-- Ho-Oh -->
          <div class="jhm-card" style="--jhm-accent:#cc9944">
            <div class="jhm-card-label">🌈 Ho-Oh</div>
            <div class="jhm-card-title">Tour Carillon</div>
            <div class="jhm-sprite-row">
              <img class="jhm-sprite${hm?.step === 6 ? '' : ' grey'}" src="${HOOH_STATIC}" alt="Ho-Oh">
            </div>
            <div class="jhm-steps">${hoohStepsHtml}</div>
            <div class="jhm-actions">${hoohActions()}</div>
          </div>

        </div>
      </div>
    </div>`;
  return html;
}

function _beastName(k) { return { raikou:'Raikou', entei:'Entei', suicune:'Suicune' }[k] ?? k; }
function _beastSprite(k) { return { raikou:RAIKOU_SPRITE, entei:ENTEI_SPRITE, suicune:SUICUNE_SPRITE }[k] ?? RAIKOU_SPRITE; }
function _beastStatic(k) { return { raikou:RAIKOU_STATIC, entei:ENTEI_STATIC, suicune:SUICUNE_STATIC }[k] ?? RAIKOU_STATIC; }
function _beastType(k)  { return { raikou:'Électrik · Légendaire', entei:'Feu · Légendaire', suicune:'Eau · Légendaire' }[k] ?? ''; }

// ── Sélecteur de Bête ─────────────────────────────────────────────
async function _openBeastChooser() {
  const s = _state();
  if (!s) return;
  const bm = _qBetes();
  if (!bm || bm.chosenBeast) return;

  const ol = document.getElementById('jhm-overlay');
  if (!ol) return;

  const chooserHtml = `
    <div id="jhm-beast-chooser" style="
      position:absolute; inset:0; z-index:10;
      background:rgba(2,6,2,.97);
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      padding:24px; animation:jhm-appear .3s ease both;
    ">
      <div class="jhm-fight-box" style="max-width:480px; --jhm-accent:#e8a030">
        <div class="jhm-fight-title">🐅 Choisissez Votre Bête Sacrée</div>
        <div class="jhm-fight-text">Ariana est vaincue. Les Bêtes Sacrées libérées par la Tour Cendrée parcourent Johto.\n\nVous ne pouvez en lier qu'une seule à votre destin.</div>
        <div class="jhm-beast-grid">
          <div class="jhm-beast-card" data-beast="raikou" style="--jhm-accent:#e8d040">
            <img src="${RAIKOU_STATIC}" style="height:52px;image-rendering:pixelated" alt="Raikou">
            <div class="jhm-beast-name" style="color:#e8d040">Raikou</div>
            <div class="jhm-beast-type">⚡ Électrik</div>
          </div>
          <div class="jhm-beast-card" data-beast="entei" style="--jhm-accent:#e86020">
            <img src="${ENTEI_STATIC}" style="height:52px;image-rendering:pixelated" alt="Entei">
            <div class="jhm-beast-name" style="color:#e86020">Entei</div>
            <div class="jhm-beast-type">🔥 Feu</div>
          </div>
          <div class="jhm-beast-card" data-beast="suicune" style="--jhm-accent:#40a0e8">
            <img src="${SUICUNE_STATIC}" style="height:52px;image-rendering:pixelated" alt="Suicune">
            <div class="jhm-beast-name" style="color:#40a0e8">Suicune</div>
            <div class="jhm-beast-type">💧 Eau</div>
          </div>
        </div>
      </div>
    </div>`;

  const div = document.createElement('div');
  div.innerHTML = chooserHtml;
  ol.style.position = 'relative';
  ol.appendChild(div.firstElementChild);

  const chooser = ol.querySelector('#jhm-beast-chooser');
  chooser.querySelectorAll('[data-beast]').forEach(card => {
    card.addEventListener('click', () => {
      const beast = card.dataset.beast;
      bm.chosenBeast = beast;
      _save();
      chooser.remove();
      openJohtoMissions(); // refresh tracker
    });
  });
}

// ── Combat Boss (Petrel / Ariana / Eusine / Kimono) ──────────────
async function _launchBoss(key) {
  const cfg = {
    petrel: {
      name: 'Petrel', role: 'Admin Rocket',
      team: 'Ratatatat, Arbok, Arbok', power: 2000,
      accent: '#e8a030', icon: '🚀',
      winMsg: 'Petrel est vaincu. Il révèle l\'emplacement du QG. Ariana est votre prochain obstacle.',
      winFn: () => { const bm = _qBetes(); if(bm){ bm.petrelDefeated = true; bm.step = 4; } },
    },
    ariana: {
      name: 'Ariana', role: 'Admin Rocket',
      team: 'Arbok, Fouinard, Victreebel', power: 2800,
      accent: '#e8a030', icon: '🚀',
      winMsg: 'Ariana est vaincue. L\'opération Rocket s\'effondre. Choisissez maintenant votre Bête Sacrée.',
      winFn: () => { const bm = _qBetes(); if(bm){ bm.arianaDefeated = true; bm.step = 5; } },
    },
    eusine: {
      name: 'Eusine', role: 'Chasseur de Suicune',
      team: 'Hypnomade, Haunter, Electrode', power: 2500,
      accent: '#5599cc', icon: '🔭',
      winMsg: 'Eusine est vaincu. Il vous confie le chemin secret vers les Îles Tourbillon. Lugia vous attend.',
      winFn: () => { const lm = _qLugia(); if(lm){ lm.eusineDefeated = true; lm.step = 4; } },
    },
    kimono: {
      name: 'Filles Kimono', role: 'Gardiennes de Ho-Oh',
      team: 'Mentali, Noctali, Aquali, Pyroli, Voltali', power: 2500,
      accent: '#cc9944', icon: '🎎',
      winMsg: 'Les Filles Kimono vous reconnaissent comme l\'Élu. Elles vous ouvrent les portes de la Tour Carillon.',
      winFn: () => { const hm = _qHooh(); if(hm){ hm.kimonoDefeated = true; hm.step = 4; } },
    },
  };

  const boss = cfg[key];
  if (!boss) return;

  const power    = globalThis.getBossTeamPower?.() ?? 0;
  const needed   = boss.power;
  const enough   = power >= needed;

  const ol = document.getElementById('jhm-overlay');
  if (!ol) return;

  const div = document.createElement('div');
  div.id = 'jhm-fight-modal';
  div.style.cssText = 'position:absolute;inset:0;z-index:10;background:rgba(1,4,1,.96);display:flex;align-items:center;justify-content:center;padding:20px;animation:jhm-appear .3s ease both';
  div.innerHTML = `
    <div class="jhm-fight-box" style="--jhm-accent:${boss.accent}">
      <div class="jhm-fight-title">${boss.icon} ${boss.name} — ${boss.role}</div>
      <div class="jhm-fight-text">${boss.team}</div>
      <div class="jhm-power-row">
        <div class="jhm-power-chip">👊 Votre puissance : ${power.toLocaleString()}</div>
        <div class="jhm-power-chip" style="${enough?'color:#90ee90':'color:#ff8080'}">🎯 Requis : ${needed.toLocaleString()}</div>
      </div>
      <div id="jhm-fight-result"></div>
      <div class="jhm-actions">
        ${enough
          ? `<button class="jhm-btn primary" id="jhm-fight-go">⚔️ Combattre</button>`
          : `<span style="font-family:var(--font-pixel,monospace);font-size:7.5px;color:#ff8080">Puissance insuffisante (${needed - power} manquants)</span>`
        }
        <button class="jhm-btn" id="jhm-fight-cancel">Annuler</button>
      </div>
    </div>`;

  ol.style.position = 'relative';
  ol.appendChild(div);

  div.querySelector('#jhm-fight-cancel')?.addEventListener('click', () => { div.remove(); });

  const goBtn = div.querySelector('#jhm-fight-go');
  if (goBtn) {
    goBtn.addEventListener('click', async () => {
      goBtn.disabled = true;
      const resEl = div.querySelector('#jhm-fight-result');
      resEl.innerHTML = `<div class="jhm-result-banner" style="color:${boss.accent}">⚔️ Combat en cours…</div>`;
      await _wait(900);
      const { win } = resolveSpecialCombat({ power, requiredPower: needed });
      if (!win) {
        resEl.innerHTML = `<div class="jhm-result-banner" style="color:#ff8080">✗ Défaite…</div>
          <div style="font-family:var(--font-pixel,monospace);font-size:7.5px;color:#c0d8c0;line-height:2;margin-top:6px">${boss.name} vous a repoussé. Renforcez votre équipe et retentez votre chance.</div>`;
        await _wait(2200);
        div.remove();
        return;
      }
      boss.winFn();
      _save();
      resEl.innerHTML = `<div class="jhm-result-banner" style="color:#90ee90">✓ Victoire !</div>
        <div style="font-family:var(--font-pixel,monospace);font-size:7.5px;color:#c0d8c0;line-height:2;margin-top:6px">${boss.winMsg}</div>`;
      await _wait(2200);
      div.remove();
      openJohtoMissions();
    });
  }
}

// ── Combat Légendaire ─────────────────────────────────────────────
async function _launchLegendary(key) {
  const s = _state();
  if (!s) return;

  const cfgMap = {
    beast: () => {
      const bm = _qBetes();
      const beast = bm?.chosenBeast ?? 'raikou';
      const names = { raikou:'Raikou', entei:'Entei', suicune:'Suicune' };
      const lvl   = { raikou:60, entei:60, suicune:60 };
      const pot   = 3;
      return {
        name: names[beast], species: beast,
        sprite: _beastSprite(beast), static: _beastStatic(beast),
        power: 4000, catchBase: 0.50,
        level: lvl[beast], pot,
        accent: { raikou:'#e8d040', entei:'#e86020', suicune:'#40a0e8' }[beast],
        icon: { raikou:'⚡', entei:'🔥', suicune:'💧' }[beast],
        winFn: () => {
          if(bm){ bm.beastOwned = true; bm.step = 6; }
        },
      };
    },
    lugia: () => ({
      name:'Lugia', species:'lugia',
      sprite:LUGIA_SPRITE, static:LUGIA_STATIC,
      power:5000, catchBase:0.35,
      level:70, pot:4,
      accent:'#5599cc', icon:'🌊',
      winFn: () => { const lm = _qLugia(); if(lm){ lm.lugiaOwned = true; lm.step = 6; } },
    }),
    hooh: () => ({
      name:'Ho-Oh', species:'ho-oh',
      sprite:HOOH_SPRITE, static:HOOH_STATIC,
      power:5500, catchBase:0.30,
      level:70, pot:5,
      accent:'#cc9944', icon:'🌈',
      winFn: () => { const hm = _qHooh(); if(hm){ hm.hoohOwned = true; hm.step = 6; } },
    }),
  };

  const getCfg = cfgMap[key];
  if (!getCfg) return;
  const cfg = getCfg();

  const power  = globalThis.getBossTeamPower?.() ?? 0;
  const enough = power >= cfg.power;

  const ol = document.getElementById('jhm-overlay');
  if (!ol) return;

  const div = document.createElement('div');
  div.id = 'jhm-legendary-modal';
  div.style.cssText = 'position:absolute;inset:0;z-index:10;background:rgba(1,4,1,.98);display:flex;align-items:center;justify-content:center;padding:20px;animation:jhm-appear .35s ease both';
  div.innerHTML = `
    <div class="jhm-fight-box" style="--jhm-accent:${cfg.accent}">
      <div class="jhm-fight-title">${cfg.icon} ${cfg.name} — Lv.${cfg.level}</div>
      <div class="jhm-sprite-row" style="margin-bottom:10px">
        <img src="${cfg.static}" style="height:72px;image-rendering:pixelated" alt="${cfg.name}">
      </div>
      <div class="jhm-power-row">
        <div class="jhm-power-chip">👊 Votre puissance : ${power.toLocaleString()}</div>
        <div class="jhm-power-chip" style="${enough?'color:#90ee90':'color:#ff8080'}">🎯 Requis : ${cfg.power.toLocaleString()}</div>
      </div>
      <div id="jhm-leg-result"></div>
      <div class="jhm-actions">
        ${enough
          ? `<button class="jhm-btn primary" id="jhm-leg-go" style="--jhm-accent:${cfg.accent}">⚔️ Affronter ${cfg.name}</button>`
          : `<span style="font-family:var(--font-pixel,monospace);font-size:7.5px;color:#ff8080">Puissance insuffisante (${cfg.power - power} manquants)</span>`
        }
        <button class="jhm-btn" id="jhm-leg-cancel">Annuler</button>
      </div>
    </div>`;

  ol.style.position = 'relative';
  ol.appendChild(div);
  div.querySelector('#jhm-leg-cancel')?.addEventListener('click', () => div.remove());

  const goBtn = div.querySelector('#jhm-leg-go');
  if (goBtn) {
    goBtn.addEventListener('click', async () => {
      goBtn.disabled = true;
      const resEl = div.querySelector('#jhm-leg-result');
      resEl.innerHTML = `<div class="jhm-result-banner" style="color:${cfg.accent}">⚔️ Combat légendaire…</div>`;
      await _wait(1200);

      // Capture roll
      const powerRatio = power / cfg.power;
      const catchRate  = Math.min(cfg.catchBase + Math.max(0, powerRatio - 1) * 0.25, 0.92);
      const caught     = Math.random() < catchRate;

      // Mark as won (regardless of catch — "controlling" means neutralizing)
      cfg.winFn();

      if (caught) {
        // Add Pokémon to PC
        const pk = globalThis.makePokemon?.(cfg.species, null, 'pokeball');
        if (pk) {
          pk.level     = cfg.level;
          pk.shiny     = false;
          pk.potential = cfg.pot;
          if (globalThis.calculateStats) pk.stats = globalThis.calculateStats(pk);
          s.pokemons.push(pk);
          const _legendZoneMap = { lugia: _WHIRL_ZONE, hooh: _TIN_ZONE };
          EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: pk, zoneId: _legendZoneMap[key] ?? null });
          if (!s.pokedex[cfg.species]) s.pokedex[cfg.species] = {};
          s.pokedex[cfg.species].caught = true;
          // Increment totalCaptures on the right mission state
          const mMap = { beast:'betesMission', lugia:'lugiaMission', hooh:'hoohMission' };
          const mKey = mMap[key];
          if (mKey && s[mKey]) s[mKey].totalCaptures = (s[mKey].totalCaptures || 0) + 1;
          resEl.innerHTML = `<div class="jhm-result-banner" style="color:#90ee90">✨ ${cfg.name} capturé !</div>
            <div style="font-family:var(--font-pixel,monospace);font-size:7.5px;color:#c0d8c0;line-height:2;margin-top:6px">
              ${cfg.name} Lv.${cfg.level} ajouté à votre PC — Pot.${cfg.pot} ★
            </div>`;
        } else {
          resEl.innerHTML = `<div class="jhm-result-banner" style="color:#90ee90">✓ ${cfg.name} neutralisé !</div>`;
        }
      } else {
        resEl.innerHTML = `<div class="jhm-result-banner" style="color:#e8d040">⚡ ${cfg.name} s'échappe !</div>
          <div style="font-family:var(--font-pixel,monospace);font-size:7.5px;color:#aaa;line-height:2;margin-top:6px">
            Taux de capture : ${Math.round(catchRate * 100)}%. Utilisez un item de relance pour réessayer.
          </div>`;
      }

      _save();
      await _wait(2500);
      div.remove();
      openJohtoMissions();
    });
  }
}

// ── Relances ──────────────────────────────────────────────────────
function _doRerun(key) {
  const s = _state();
  if (!s) return;
  const itemMap = { betes:'cristal_bete', lugia:'silver_wing', hooh:'rainbow_wing' };
  const mMap    = { betes:'betesMission', lugia:'lugiaMission', hooh:'hoohMission' };
  const item    = itemMap[key];
  const mKey    = mMap[key];
  if (!item || !mKey) return;
  if ((s.inventory[item] || 0) < 1) return;
  s.inventory[item]--;
  if (s[mKey]) s[mKey].step = 5;
  _save();
  openJohtoMissions();
}

// ── Ouverture du tracker ──────────────────────────────────────────
export function openJohtoMissions() {
  _injectStyles();
  const existing = document.getElementById('jhm-overlay');
  if (existing) existing.remove();

  const s = _state();
  if (!s) return;
  const bm = _qBetes();
  const lm = _qLugia();
  const hm = _qHooh();
  if (!bm?.active && !lm?.active && !hm?.active) return;

  const html = _buildTracker();
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const ol = tmp.firstElementChild;
  document.body.appendChild(ol);

  ol.querySelector('#jhm-close')?.addEventListener('click', () => {
    ol.style.animation = 'jhm-fadeout .3s ease both';
    setTimeout(() => ol.remove(), 300);
  });

  // Action buttons
  ol.addEventListener('click', e => {
    const btn = e.target.closest('[data-jhm]');
    if (!btn) return;
    const action = btn.dataset.jhm;
    switch (action) {
      case 'petrel':       _launchBoss('petrel'); break;
      case 'ariana':       _launchBoss('ariana'); break;
      case 'eusine':       _launchBoss('eusine'); break;
      case 'kimono':       _launchBoss('kimono'); break;
      case 'choose-beast': _openBeastChooser(); break;
      case 'beast-fight':  _launchLegendary('beast'); break;
      case 'lugia':        _launchLegendary('lugia'); break;
      case 'hooh':         _launchLegendary('hooh'); break;
      case 'rerun-betes':  _doRerun('betes'); break;
      case 'rerun-lugia':  _doRerun('lugia'); break;
      case 'rerun-hooh':   _doRerun('hooh'); break;
    }
  });
}

// ── Vérification de déclenchement ────────────────────────────────
export function checkJohtoMissionsUnlock() {
  const s = _state();
  if (!s?.purchases?.johtoUnlocked) return;
  const rep = s.gang?.reputation ?? 0;
  if (rep < 800) return;  // Johto mid-game threshold

  let changed = false;

  if (!s.betesMission) s.betesMission = { active:false, step:0, rocketFightsWon:0, hqFightsWon:0, petrelDefeated:false, arianaDefeated:false, chosenBeast:null, beastOwned:false, totalCaptures:0 };
  if (!s.lugiaMission) s.lugiaMission = { active:false, step:0, marineFightsWon:0, silverWings:0, eusineDefeated:false, whirlFightsWon:0, lugiaOwned:false, totalCaptures:0 };
  if (!s.hoohMission)  s.hoohMission  = { active:false, step:0, ruralFightsWon:0, rainbowWings:0, kimonoDefeated:false, tinFightsWon:0, hoohOwned:false, totalCaptures:0 };

  if (!s.betesMission.active) {
    s.betesMission.active = true; s.betesMission.step = 1;
    _notify('🐅 Quête débloquée : Les Bêtes Sacrées de Johto — ouvrez le tracker Johto !', 'gold');
    changed = true;
  }
  if (!s.lugiaMission.active && rep >= 1000) {
    s.lugiaMission.active = true; s.lugiaMission.step = 1;
    _notify("🌊 Quête débloquée : Lugia — les Ailes Sacrées vous guideront vers les profondeurs !", 'gold');
    changed = true;
  }
  if (!s.hoohMission.active && rep >= 1000) {
    s.hoohMission.active = true; s.hoohMission.step = 1;
    _notify('🌈 Quête débloquée : Ho-Oh — l\'Oiseau Arc-en-Ciel attend votre épreuve !', 'gold');
    changed = true;
  }

  if (changed) { _register(); _save(); }
}

// ── Boot ──────────────────────────────────────────────────────────
_register();

globalThis.openJohtoMissions        = openJohtoMissions;
globalThis.checkJohtoMissionsUnlock = checkJohtoMissionsUnlock;
