'use strict';

// ════════════════════════════════════════════════════════════════
//  JOHTO MISSIONS — Bêtes Sacrées · Lugia · Ho-Oh
//  Trois quêtes parallèles inspirées de Pokémon Or/Argent.
//
//  Le suivi de progression (grind de combats de zone, collecte d'objets)
//  reste géré via l'overlay tracker (_buildTracker/openJohtoMissions). Les
//  affrontements de quête (dresseur intermédiaire + légendaire final) ne se
//  déclenchent plus depuis cet overlay : une fois l'étape atteinte,
//  getJohtoQuestEncounterForZone(zoneId) fait apparaître le dresseur/
//  légendaire comme sprite persistant dans sa zone (agrégé par
//  modules/ui/zoneWindows.js) ; un clic ouvre un vrai combat tour-par-tour
//  (modules/ui/questEncounterPopup.js + modules/systems/questCombat.js),
//  avec possibilité d'envoyer des agents affaiblir l'adversaire avant de
//  l'affronter directement — même patron que kantoMissions.js.
//
//  Quête Bêtes Sacrées (5 étapes) :
//    1. Vaincre 30 membres Rocket dans les zones Johto
//    2. Infiltrer le QG Rocket (15 combats dans team_rocket_hq)
//    3. Vaincre Petrel — Admin Rocket — team_rocket_hq
//    4. Vaincre Ariana  — Admin Rocket — team_rocket_hq
//    5. Choisir puis affronter une Bête Sacrée — route36_37
//
//  Quête Lugia (5 étapes) :
//    1. Vaincre 20 combats dans les zones marines Johto
//    2. Collecter 5 Argent'Ailes (drop auto dans zones Johto)
//    3. Vaincre Eusine — cianwood_gym
//    4. Vaincre 15 combats dans les Îles Tourbillon
//    5. Affronter Lugia — whirl_islands
//
//  Quête Ho-Oh (5 étapes) :
//    1. Vaincre 20 combats dans les zones rurales Johto
//    2. Collecter 5 Arcenci'Ailes (drop auto dans zones Johto)
//    3. Vaincre les Filles Kimono — national_park
//    4. Vaincre 15 combats dans la Tour Carillon
//    5. Affronter Ho-Oh — tin_tower
//
//  Rejouable :
//    1 Cristal Bête   → relance combat Bête Sacrée choisie
//    1 Argent'Aile    → relance combat Lugia
//    1 Arcenci'Aile   → relance combat Ho-Oh
//
//  Déclenchement :
//    checkJohtoMissionsUnlock()        — au boot + après déblocage Johto
//    openJohtoMissions()               — ouvre le tracker (progression)
//    getJohtoQuestEncounterForZone(id) — sprite de combat pour une zone
//
//  Dépendances globalThis :
//    state, saveState, makePokemon, calculateStats, registerPokedexCapture,
//    trainerSprite, openQuestEncounterPopup, patchZoneWindow
//  Dépendances import :
//    defaultEncounterState (modules/systems/questCombat.js)
//  Dépendances bare-name (classic scripts) :
//    ZONE_BY_ID (Johto zones are merged into ZONES global)
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';
import { requestSimulationSave, suppressSimulationNotification } from '../core/simulationContext.js';
import { defaultEncounterState } from './questCombat.js';

const _notify = (msg, type = '') => {
  if (!suppressSimulationNotification()) EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });
};
const _save = () => {
  requestSimulationSave(() => globalThis.saveState?.());
};
const _t = (fr, en) => (globalThis.state?.lang === 'en' ? en : fr);

// ── Sprites ──────────────────────────────────────────────────────
// Seuls les sprites statiques sont utilisés (sprite affiché dans le popup
// de combat de quête) — pas de variante animée conservée ici (cf. suppression
// équivalente de MEWTWO_SPRITE côté kantoMissions.js).
const LUGIA_STATIC    = 'https://play.pokemonshowdown.com/sprites/gen2/lugia.png';
const HOOH_STATIC     = 'https://play.pokemonshowdown.com/sprites/gen2/ho-oh.png';
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
// Ancrages sans grind de zone dédié dans le state machine (leur étape
// précédente est une collecte d'objets, pas du combat) — zone choisie par
// cohérence thématique, réutilisant des zones Johto déjà existantes.
const _PETREL_ZONE = 'team_rocket_hq';
const _ARIANA_ZONE = 'team_rocket_hq';
const _EUSINE_ZONE = 'cianwood_gym';
const _KIMONO_ZONE = 'national_park';
const _BEAST_ZONE  = 'route36_37';

// ── Helpers ───────────────────────────────────────────────────────
const _state = () => globalThis.state ?? null;

function _qBetes()  { return _state()?.betesMission  ?? null; }
function _qLugia()  { return _state()?.lugiaMission  ?? null; }
function _qHooh()   { return _state()?.hoohMission   ?? null; }

// ── Config dresseurs de quête (Petrel/Ariana/Eusine/Filles Kimono) ────────
// Équipes structurées pour le vrai combat (questCombat.js) — remplace les
// descriptions en texte libre d'avant la refonte "sprite sur zone".
const BOSSES = {
  petrel: {
    name: 'Petrel', name_en: 'Petrel', role: 'Admin Rocket', role_en: 'Rocket Admin',
    zone: _PETREL_ZONE, icon: '🚀', spriteKey: 'petrel',
    team: [
      { species_en: 'raticate', level: 52 }, { species_en: 'arbok', level: 53 }, { species_en: 'arbok', level: 54 },
    ],
    winMsg: 'Petrel est vaincu. Il révèle l\'emplacement du QG. Ariana est votre prochain obstacle.',
    winMsg_en: 'Petrel is defeated. He reveals the HQ location. Ariana is your next obstacle.',
    onWin: bm => { bm.petrelDefeated = true; bm.step = 4; },
    getMission: _qBetes,
  },
  ariana: {
    name: 'Ariana', name_en: 'Ariana', role: 'Admin Rocket', role_en: 'Rocket Admin',
    zone: _ARIANA_ZONE, icon: '🚀', spriteKey: 'ariana',
    team: [
      { species_en: 'arbok', level: 56 }, { species_en: 'murkrow', level: 55 }, { species_en: 'victreebel', level: 57 },
    ],
    winMsg: 'Ariana est vaincue. L\'opération Rocket s\'effondre. Choisissez maintenant votre Bête Sacrée.',
    winMsg_en: 'Ariana is defeated. The Rocket operation collapses. Now choose your Sacred Beast.',
    onWin: bm => { bm.arianaDefeated = true; bm.step = 5; },
    getMission: _qBetes,
  },
  eusine: {
    name: 'Eusine', name_en: 'Eusine', role: 'Chasseur de Suicune', role_en: 'Suicune Hunter',
    zone: _EUSINE_ZONE, icon: '🔭', spriteKey: 'eusine',
    team: [
      { species_en: 'drowzee', level: 58 }, { species_en: 'haunter', level: 59 }, { species_en: 'electrode', level: 60 },
    ],
    winMsg: 'Eusine est vaincu. Il vous confie le chemin secret vers les Îles Tourbillon. Lugia vous attend.',
    winMsg_en: 'Eusine is defeated. He entrusts you with the secret path to the Whirl Islands. Lugia awaits.',
    onWin: lm => { lm.eusineDefeated = true; lm.step = 4; },
    getMission: _qLugia,
  },
  kimono: {
    name: 'Filles Kimono', name_en: 'Kimono Girls', role: 'Gardiennes de Ho-Oh', role_en: 'Guardians of Ho-Oh',
    zone: _KIMONO_ZONE, icon: '🎎', spriteKey: 'kimonogirl-gen2',
    team: [
      { species_en: 'espeon', level: 60 }, { species_en: 'umbreon', level: 60 }, { species_en: 'vaporeon', level: 61 },
      { species_en: 'flareon', level: 61 }, { species_en: 'jolteon', level: 62 },
    ],
    winMsg: 'Les Filles Kimono vous reconnaissent comme l\'Élu. Elles vous ouvrent les portes de la Tour Carillon.',
    winMsg_en: 'The Kimono Girls recognize you as the Chosen One. They open the gates of the Tin Tower for you.',
    onWin: hm => { hm.kimonoDefeated = true; hm.step = 4; },
    getMission: _qHooh,
  },
};

// ── Config légendaires (Lugia/Ho-Oh — la Bête choisie est gérée à part,
// son espèce n'étant connue qu'à l'exécution via state.betesMission.chosenBeast)
const LEGENDARIES = {
  lugia: {
    name: 'Lugia', species: 'lugia', static: LUGIA_STATIC,
    zone: _WHIRL_ZONE, icon: '🌊', catchBase: 0.35, level: 70, pot: 4, statMult: 1.7,
    team: [{ species_en: 'lugia', level: 70, potential: 4 }],
    onWin: lm => { lm.lugiaOwned = true; lm.step = 6; },
    getMission: _qLugia,
  },
  hooh: {
    name: 'Ho-Oh', species: 'ho-oh', static: HOOH_STATIC,
    zone: _TIN_ZONE, icon: '🌈', catchBase: 0.30, level: 70, pot: 5, statMult: 1.8,
    team: [{ species_en: 'ho-oh', level: 70, potential: 5 }],
    onWin: hm => { hm.hoohOwned = true; hm.step = 6; },
    getMission: _qHooh,
  },
};

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
        _notify(_t('🐅 30 membres Rocket vaincus ! Infiltrez maintenant le QG Rocket.', '🐅 30 Rocket members defeated! Now infiltrate the Rocket HQ.'), 'gold');
      }
      dirty = true;
    }
    if (bm.step === 2 && zoneId === 'team_rocket_hq') {
      bm.hqFightsWon = Math.min((bm.hqFightsWon || 0) + 1, 15);
      if (bm.hqFightsWon >= 15) {
        bm.step = 3;
        _notify(_t('🐅 QG Rocket infiltré ! Affrontez Petrel depuis la quête.', '🐅 Rocket HQ infiltrated! Face Petrel from the quest tracker.'), 'gold');
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
        _notify(_t("🌊 Zones marines quadrillées ! Collectez 5 Argent'Ailes.", '🌊 Marine zones secured! Collect 5 Silver Wings.'), 'gold');
      }
      dirty = true;
    }
    if (lm.step === 4 && zoneId === _WHIRL_ZONE) {
      lm.whirlFightsWon = Math.min((lm.whirlFightsWon || 0) + 1, 15);
      if (lm.whirlFightsWon >= 15) {
        lm.step = 5;
        _notify(_t('🌊 Îles Tourbillon domptées ! Lugia vous attend dans les profondeurs.', '🌊 Whirl Islands tamed! Lugia awaits in the depths.'), 'gold');
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
        _notify(_t("🌈 Zones rurales sécurisées ! Collectez 5 Arcenci'Ailes.", '🌈 Rural zones secured! Collect 5 Rainbow Wings.'), 'gold');
      }
      dirty = true;
    }
    if (hm.step === 4 && zoneId === _TIN_ZONE) {
      hm.tinFightsWon = Math.min((hm.tinFightsWon || 0) + 1, 15);
      if (hm.tinFightsWon >= 15) {
        hm.step = 5;
        _notify(_t('🌈 Tour Carillon conquise ! Ho-Oh vous attend au sommet.', '🌈 Tin Tower conquered! Ho-Oh awaits at the summit.'), 'gold');
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
        _notify(_t("🌊 5 Argent'Ailes réunies ! Affrontez Eusine depuis la quête Lugia.", '🌊 5 Silver Wings gathered! Face Eusine from the Lugia quest.'), 'gold');
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
        _notify(_t("🌈 5 Arcenci'Ailes réunies ! Affrontez les Filles Kimono depuis la quête Ho-Oh.", '🌈 5 Rainbow Wings gathered! Face the Kimono Girls from the Ho-Oh quest.'), 'gold');
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
    .jhm-trainer-wrap {
      display:flex; align-items:center; gap:12px; margin-bottom:12px;
    }
    .jhm-trainer-img {
      width:64px; height:64px; image-rendering:pixelated;
      filter:drop-shadow(0 4px 10px rgba(0,0,0,.5));
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
    { label:_t('Vaincre 30 membres Rocket (Johto)', 'Defeat 30 Rocket members (Johto)'), done: bm?.rocketFightsWon >= 30, prog: bm?.rocketFightsWon ?? 0, max: 30 },
    { label:_t('Infiltrer le QG Rocket (15 combats)', 'Infiltrate the Rocket HQ (15 battles)'), done: bm?.hqFightsWon >= 15, prog: bm?.hqFightsWon ?? 0, max: 15 },
    { label:_t('Vaincre Petrel — Admin Rocket', 'Defeat Petrel — Rocket Admin'), done: bm?.petrelDefeated ?? false, prog: null, max: null },
    { label:_t('Vaincre Ariana — Admin Rocket', 'Defeat Ariana — Rocket Admin'), done: bm?.arianaDefeated ?? false, prog: null, max: null },
    { label:_t('Affronter la Bête Sacrée choisie', 'Face your chosen Sacred Beast'), done: bm?.beastOwned ?? false, prog: null, max: null },
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
      return `<span class="jhm-rerun-note">→ ${_t('Rendez-vous au QG Rocket pour affronter Petrel', 'Head to the Rocket HQ to face Petrel')}</span>`;
    }
    if (bm.step === 4 && !bm.arianaDefeated) {
      return `<span class="jhm-rerun-note">→ ${_t('Rendez-vous au QG Rocket pour affronter Ariana', 'Head to the Rocket HQ to face Ariana')}</span>`;
    }
    if (bm.step === 5) {
      if (!bm.chosenBeast) return `<button class="jhm-btn primary" data-jhm="choose-beast">🐅 ${_t('Choisir une Bête', 'Choose a Beast')}</button>`;
      return `<span class="jhm-rerun-note">→ ${_t(`Rendez-vous Route 36-37 pour affronter ${_beastName(bm.chosenBeast)}`, `Head to Route 36-37 to face ${_beastName(bm.chosenBeast)}`)}</span>`;
    }
    if (bm.step === 6) {
      if (canRerunBetes) return `<button class="jhm-btn gold" data-jhm="rerun-betes">💎 ${_t('Relancer', 'Retry')} (${inv.cristal_bete}× ${_t('Cristal', 'Crystal')})</button>`;
      return `<span class="jhm-rerun-note">${_t('Cristal Bête requis pour rejouer', 'Beast Crystal required to retry')}</span>`;
    }
    return '';
  };

  // ── Card Lugia ────────────────────────────────────────────────
  const lugiaStepsData = [
    { label:_t('Vaincre 20 combats (zones marines Johto)', 'Win 20 battles (Johto marine zones)'), done: lm?.marineFightsWon >= 20, prog: lm?.marineFightsWon ?? 0, max: 20 },
    { label:_t("Collecter 5 Argent'Ailes", 'Collect 5 Silver Wings'), done: lm?.silverWings >= 5, prog: lm?.silverWings ?? 0, max: 5 },
    { label:_t('Vaincre Eusine', 'Defeat Eusine'), done: lm?.eusineDefeated ?? false, prog: null, max: null },
    { label:_t('Vaincre 15 combats (Îles Tourbillon)', 'Win 15 battles (Whirl Islands)'), done: lm?.whirlFightsWon >= 15, prog: lm?.whirlFightsWon ?? 0, max: 15 },
    { label:_t('Affronter Lugia', 'Face Lugia'), done: lm?.lugiaOwned ?? false, prog: null, max: null },
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
      return `<span class="jhm-rerun-note">→ ${_t('Rendez-vous à Doublonville pour affronter Eusine', 'Head to Cianwood City to face Eusine')}</span>`;
    }
    if (lm.step === 5) {
      return `<span class="jhm-rerun-note">→ ${_t('Rendez-vous aux Îles Tourbillon pour affronter Lugia', 'Head to the Whirl Islands to face Lugia')}</span>`;
    }
    if (lm.step === 6) {
      if (canRerunLugia) return `<button class="jhm-btn gold" data-jhm="rerun-lugia">🪶 ${_t('Relancer', 'Retry')} (${inv.silver_wing}× ${_t("Argent'Aile", 'Silver Wing')})</button>`;
      return `<span class="jhm-rerun-note">${_t("Argent'Aile requise pour rejouer", 'Silver Wing required to retry')}</span>`;
    }
    return '';
  };

  // ── Card Ho-Oh ────────────────────────────────────────────────
  const hoohStepsData = [
    { label:_t('Vaincre 20 combats (zones rurales Johto)', 'Win 20 battles (Johto rural zones)'), done: hm?.ruralFightsWon >= 20, prog: hm?.ruralFightsWon ?? 0, max: 20 },
    { label:_t("Collecter 5 Arcenci'Ailes", 'Collect 5 Rainbow Wings'), done: hm?.rainbowWings >= 5, prog: hm?.rainbowWings ?? 0, max: 5 },
    { label:_t('Vaincre les Filles Kimono', 'Defeat the Kimono Girls'), done: hm?.kimonoDefeated ?? false, prog: null, max: null },
    { label:_t('Vaincre 15 combats (Tour Carillon)', 'Win 15 battles (Tin Tower)'), done: hm?.tinFightsWon >= 15, prog: hm?.tinFightsWon ?? 0, max: 15 },
    { label:_t('Affronter Ho-Oh', 'Face Ho-Oh'), done: hm?.hoohOwned ?? false, prog: null, max: null },
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
      return `<span class="jhm-rerun-note">→ ${_t('Rendez-vous au Parc National pour affronter les Filles Kimono', 'Head to the National Park to face the Kimono Girls')}</span>`;
    }
    if (hm.step === 5) {
      return `<span class="jhm-rerun-note">→ ${_t('Rendez-vous à la Tour Carillon pour affronter Ho-Oh', 'Head to Tin Tower to face Ho-Oh')}</span>`;
    }
    if (hm.step === 6) {
      if (canRerunHooh) return `<button class="jhm-btn gold" data-jhm="rerun-hooh">🌈 ${_t('Relancer', 'Retry')} (${inv.rainbow_wing}× ${_t("Arcenci'Aile", 'Rainbow Wing')})</button>`;
      return `<span class="jhm-rerun-note">${_t("Arcenci'Aile requise pour rejouer", 'Rainbow Wing required to retry')}</span>`;
    }
    return '';
  };

  const html = `
    <div id="jhm-overlay">
      <span class="jhm-close-btn" id="jhm-close">✕ ${_t('FERMER', 'CLOSE')}</span>
      <div class="jhm-wrap">
        <div class="jhm-header">
          <div class="jhm-header-label">${_t('Quêtes Légendaires', 'Legendary Quests')}</div>
          <div class="jhm-header-title">✦ JOHTO ✦</div>
        </div>
        <div class="jhm-triple">

          <!-- Bêtes Sacrées -->
          <div class="jhm-card" style="--jhm-accent:#e8a030">
            <div class="jhm-card-label">🐅 ${_t('Bêtes Sacrées', 'Legendary Beasts')}</div>
            <div class="jhm-card-title">${_t('Opération Rocket', 'Operation Rocket')}</div>
            ${betesSpriteHtml()}
            <div class="jhm-steps">${betesStepsHtml}</div>
            <div class="jhm-actions">${betesActions()}</div>
          </div>

          <!-- Lugia -->
          <div class="jhm-card" style="--jhm-accent:#5599cc">
            <div class="jhm-card-label">🌊 Lugia</div>
            <div class="jhm-card-title">${_t('Profondeurs', 'The Deep')}</div>
            <div class="jhm-sprite-row">
              <img class="jhm-sprite${lm?.step === 6 ? '' : ' grey'}" src="${LUGIA_STATIC}" alt="Lugia">
            </div>
            <div class="jhm-steps">${lugiaStepsHtml}</div>
            <div class="jhm-actions">${lugiaActions()}</div>
          </div>

          <!-- Ho-Oh -->
          <div class="jhm-card" style="--jhm-accent:#cc9944">
            <div class="jhm-card-label">🌈 Ho-Oh</div>
            <div class="jhm-card-title">${_t('Tour Carillon', 'Tin Tower')}</div>
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
function _beastStatic(k) { return { raikou:RAIKOU_STATIC, entei:ENTEI_STATIC, suicune:SUICUNE_STATIC }[k] ?? RAIKOU_STATIC; }

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
        <div class="jhm-fight-title">🐅 ${_t('Choisissez Votre Bête Sacrée', 'Choose Your Sacred Beast')}</div>
        <div class="jhm-fight-text">${_t(
          "Ariana est vaincue. Les Bêtes Sacrées libérées par la Tour Cendrée parcourent Johto.\n\nVous ne pouvez en lier qu'une seule à votre destin.",
          'Ariana is defeated. The Legendary Beasts freed from the Burned Tower now roam Johto.\n\nYou may bond your destiny to only one of them.',
        )}</div>
        <div class="jhm-beast-grid">
          <div class="jhm-beast-card" data-beast="raikou" style="--jhm-accent:#e8d040">
            <img src="${RAIKOU_STATIC}" style="height:52px;image-rendering:pixelated" alt="Raikou">
            <div class="jhm-beast-name" style="color:#e8d040">Raikou</div>
            <div class="jhm-beast-type">⚡ ${_t('Électrik', 'Electric')}</div>
          </div>
          <div class="jhm-beast-card" data-beast="entei" style="--jhm-accent:#e86020">
            <img src="${ENTEI_STATIC}" style="height:52px;image-rendering:pixelated" alt="Entei">
            <div class="jhm-beast-name" style="color:#e86020">Entei</div>
            <div class="jhm-beast-type">🔥 ${_t('Feu', 'Fire')}</div>
          </div>
          <div class="jhm-beast-card" data-beast="suicune" style="--jhm-accent:#40a0e8">
            <img src="${SUICUNE_STATIC}" style="height:52px;image-rendering:pixelated" alt="Suicune">
            <div class="jhm-beast-name" style="color:#40a0e8">Suicune</div>
            <div class="jhm-beast-type">💧 ${_t('Eau', 'Water')}</div>
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

// ── Rencontres de quête (sprite sur zone → popup de combat réel) ──
// Remplace l'ancien overlay "Combattre" par un vrai combat tour-par-tour
// (questCombat.js) déclenché en cliquant le sprite du dresseur/légendaire
// dans sa zone (voir getJohtoQuestEncounterForZone, appelé par l'agrégateur
// de modules/ui/zoneWindows.js).

function _repatchZone(zoneId) {
  const win = document.getElementById(`zw-${zoneId}`);
  if (win) globalThis.patchZoneWindow?.(zoneId, win);
}

function _openBoss(key) {
  const cfg = BOSSES[key];
  if (!cfg) return;
  const mission = cfg.getMission();
  if (!mission) return;
  const encKey = `${key}Encounter`;
  if (!mission[encKey]) mission[encKey] = defaultEncounterState();
  globalThis.openQuestEncounterPopup?.({
    id: `jhm-boss-${key}`, kind: 'trainer',
    name: _t(cfg.name, cfg.name_en), icon: cfg.icon,
    spriteUrl: globalThis.trainerSprite?.(cfg.spriteKey) ?? '',
    lore: _t(cfg.role, cfg.role_en),
    team: cfg.team,
    encounterState: mission[encKey],
    onResolved: (result) => {
      if (!result.won) return;
      cfg.onWin(mission);
      _notify(_t(cfg.winMsg, cfg.winMsg_en), 'gold');
      _save();
      _repatchZone(cfg.zone);
    },
  });
}

function _openLegendary(key) {
  const cfg = LEGENDARIES[key];
  if (!cfg) return;
  const mission = cfg.getMission();
  if (!mission) return;
  if (!mission.legendEncounter) mission.legendEncounter = defaultEncounterState();
  globalThis.openQuestEncounterPopup?.({
    id: `jhm-leg-${key}`, kind: 'legendary',
    name: cfg.name, icon: cfg.icon, spriteUrl: cfg.static,
    team: cfg.team, statMult: cfg.statMult, catchBase: cfg.catchBase,
    potential: cfg.pot, zoneId: cfg.zone,
    encounterState: mission.legendEncounter,
    onResolved: (result) => {
      if (!result.won) return;
      if (!result.captured) {
        _notify(_t(`⚡ ${cfg.name} s'échappe !`, `⚡ ${cfg.name} escapes!`), '');
        return;
      }
      const s = _state();
      const pk = globalThis.makePokemon?.(cfg.species, null, 'pokeball');
      if (!pk) return;
      pk.level = cfg.level;
      pk.shiny = false;
      pk.potential = cfg.pot;
      if (globalThis.calculateStats) pk.stats = globalThis.calculateStats(pk);
      cfg.onWin(mission);
      mission.totalCaptures = (mission.totalCaptures || 0) + 1;
      s.pokemons.push(pk);
      EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: pk, zoneId: cfg.zone, source: 'quest' });
      globalThis.registerPokedexCapture?.(s, pk);
      _notify(_t(`✨ ${cfg.name} capturé !`, `✨ ${cfg.name} caught!`), 'gold');
      _save();
      _repatchZone(cfg.zone);
    },
  });
}

function _openBeast() {
  const bm = _qBetes();
  if (!bm?.chosenBeast) return;
  const beast = bm.chosenBeast;
  const names = { raikou: 'Raikou', entei: 'Entei', suicune: 'Suicune' };
  const icons = { raikou: '⚡', entei: '🔥', suicune: '💧' };
  if (!bm.beastEncounter) bm.beastEncounter = defaultEncounterState();
  globalThis.openQuestEncounterPopup?.({
    id: 'jhm-beast', kind: 'legendary',
    name: names[beast], icon: icons[beast], spriteUrl: _beastStatic(beast),
    team: [{ species_en: beast, level: 60, potential: 3 }], statMult: 1.5, catchBase: 0.50,
    potential: 3, zoneId: _BEAST_ZONE,
    encounterState: bm.beastEncounter,
    onResolved: (result) => {
      if (!result.won) return;
      if (!result.captured) {
        _notify(_t(`⚡ ${names[beast]} s'échappe !`, `⚡ ${names[beast]} escapes!`), '');
        return;
      }
      const s = _state();
      const pk = globalThis.makePokemon?.(beast, null, 'pokeball');
      if (!pk) return;
      pk.level = 60;
      pk.shiny = false;
      pk.potential = 3;
      if (globalThis.calculateStats) pk.stats = globalThis.calculateStats(pk);
      bm.beastOwned = true; bm.step = 6; bm.totalCaptures = (bm.totalCaptures || 0) + 1;
      s.pokemons.push(pk);
      EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: pk, zoneId: _BEAST_ZONE, source: 'quest' });
      globalThis.registerPokedexCapture?.(s, pk);
      _notify(_t(`✨ ${names[beast]} capturé !`, `✨ ${names[beast]} caught!`), 'gold');
      _save();
      _repatchZone(_BEAST_ZONE);
    },
  });
}

function _bossEntry(key) {
  const cfg = BOSSES[key];
  return { id: `jhm-boss-${key}`, name: _t(cfg.name, cfg.name_en), icon: cfg.icon, spriteUrl: globalThis.trainerSprite?.(cfg.spriteKey) ?? '', onClick: () => _openBoss(key) };
}

function _legendEntry(key) {
  const cfg = LEGENDARIES[key];
  return { id: `jhm-leg-${key}`, name: cfg.name, icon: cfg.icon, spriteUrl: cfg.static, onClick: () => _openLegendary(key) };
}

function _beastEntry(beast) {
  const names = { raikou: 'Raikou', entei: 'Entei', suicune: 'Suicune' };
  const icons = { raikou: '⚡', entei: '🔥', suicune: '💧' };
  return { id: 'jhm-beast', name: names[beast], icon: icons[beast], spriteUrl: _beastStatic(beast), onClick: _openBeast };
}

/** Agrégateur appelé par modules/ui/zoneWindows.js pour savoir si un
 *  dresseur/légendaire de quête doit apparaître comme sprite persistant
 *  dans la fenêtre de zone zoneId à l'étape courante. */
export function getJohtoQuestEncounterForZone(zoneId) {
  const bm = _qBetes();
  if (bm?.active) {
    if (bm.step === 3 && !bm.petrelDefeated && zoneId === BOSSES.petrel.zone) return _bossEntry('petrel');
    if (bm.step === 4 && !bm.arianaDefeated && zoneId === BOSSES.ariana.zone) return _bossEntry('ariana');
    if (bm.step === 5 && bm.chosenBeast && zoneId === _BEAST_ZONE) return _beastEntry(bm.chosenBeast);
  }
  const lm = _qLugia();
  if (lm?.active) {
    if (lm.step === 3 && !lm.eusineDefeated && zoneId === BOSSES.eusine.zone) return _bossEntry('eusine');
    if (lm.step === 5 && zoneId === LEGENDARIES.lugia.zone) return _legendEntry('lugia');
  }
  const hm = _qHooh();
  if (hm?.active) {
    if (hm.step === 3 && !hm.kimonoDefeated && zoneId === BOSSES.kimono.zone) return _bossEntry('kimono');
    if (hm.step === 5 && zoneId === LEGENDARIES.hooh.zone) return _legendEntry('hooh');
  }
  return null;
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
  if (s[mKey]) {
    s[mKey].step = 5;
    if (key === 'betes') s[mKey].beastEncounter = defaultEncounterState();
    else s[mKey].legendEncounter = defaultEncounterState();
  }
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
      case 'choose-beast': _openBeastChooser(); break;
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
    _notify(_t('🐅 Quête débloquée : Les Bêtes Sacrées de Johto — ouvrez le tracker Johto !', '🐅 Quest unlocked: The Legendary Beasts of Johto — open the Johto tracker!'), 'gold');
    changed = true;
  }
  if (!s.lugiaMission.active && rep >= 1000) {
    s.lugiaMission.active = true; s.lugiaMission.step = 1;
    _notify(_t("🌊 Quête débloquée : Lugia — les Ailes Sacrées vous guideront vers les profondeurs !", '🌊 Quest unlocked: Lugia — the Sacred Wings will guide you to the depths!'), 'gold');
    changed = true;
  }
  if (!s.hoohMission.active && rep >= 1000) {
    s.hoohMission.active = true; s.hoohMission.step = 1;
    _notify(_t('🌈 Quête débloquée : Ho-Oh — l\'Oiseau Arc-en-Ciel attend votre épreuve !', '🌈 Quest unlocked: Ho-Oh — the Rainbow Bird awaits your trial!'), 'gold');
    changed = true;
  }

  if (changed) { _register(); _save(); }
}

// ── Boot ──────────────────────────────────────────────────────────
_register();

globalThis.openJohtoMissions               = openJohtoMissions;
globalThis.checkJohtoMissionsUnlock        = checkJohtoMissionsUnlock;
globalThis.getJohtoQuestEncounterForZone   = getJohtoQuestEncounterForZone;
