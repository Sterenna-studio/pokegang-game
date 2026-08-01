'use strict';

// ════════════════════════════════════════════════════════════════
//  LEGENDARY MISSIONS — Team Magma / Groudon  ·  Team Aqua / Kyogre
//  Deux quêtes parallèles inspirées du conflit Hoenn.
//
//  L'intro cinématique (_showQuestIntro) et le tracker dual (openLegendaryMissions/
//  _renderDualTracker) restent gérés ici tels quels. Les affrontements de quête
//  (admin/chef + légendaire final) ne se déclenchent plus depuis le tracker :
//  une fois l'étape atteinte, getHoennQuestEncounterForZone(zoneId) fait
//  apparaître le dresseur/légendaire comme sprite persistant dans sa zone
//  (agrégé par modules/ui/zoneWindows.js) ; un clic ouvre un vrai combat
//  tour-par-tour (modules/ui/questEncounterPopup.js + modules/systems/
//  questCombat.js), avec possibilité d'envoyer des agents affaiblir
//  l'adversaire avant de l'affronter directement — même patron que
//  kantoMissions.js/johtoMissions.js.
//
//  Quête Magma (5 étapes) :
//    1. Vaincre 20 membres Magma dans leurs zones (mt_chimney, QG, …)
//    2. Infiltrer le QG Magma (12 combats dans team_magma_hideout)
//    3. Vaincre Tabitha — Admin Magma — team_magma_hideout
//    4. Vaincre Maxie   — Chef Magma  — team_magma_hideout
//    5. Affronter Groudon — cave_of_origin
//
//  Quête Aqua (5 étapes, parallèle) :
//    1. Vaincre 20 membres Aqua dans leurs zones (QG Aqua, routes côtières, …)
//    2. Infiltrer le QG Aqua (12 combats dans team_aqua_hideout)
//    3. Vaincre Matt   — Admin Aqua  — team_aqua_hideout
//    4. Vaincre Archie — Chef Aqua   — team_aqua_hideout
//    5. Affronter Kyogre — cave_of_origin
//
//  Rejouable :
//    1 Sigle Magma (drop 1,5 % zones Magma) → relance combat Groudon
//    1 Sceau Aqua  (drop 1,5 % zones Aqua)  → relance combat Kyogre
//
//  Déclenchement :
//    checkLegendaryMissionsUnlock()      — à appeler au boot + après activation Hoenn
//    openLegendaryMissions()             — ouvre le tracker dual (progression)
//    getHoennQuestEncounterForZone(id)   — sprite de combat pour une zone
//
//  Dépendances globalThis :
//    state, saveState, makePokemon, calculateStats, registerPokedexCapture,
//    trainerSprite, switchTab, openQuestEncounterPopup, patchZoneWindow
//  Dépendances import :
//    defaultEncounterState (modules/systems/questCombat.js)
//  Dépendances bare-name (classic scripts) :
//    ZONE_HOENN_BY_ID
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';
import { defaultEncounterState } from './questCombat.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });
const _save   = ()               => globalThis.saveState?.();
const _t = (fr, en) => (globalThis.state?.lang === 'en' ? en : fr);

// ── Sprites ──────────────────────────────────────────────────────
// Seul le sprite statique est utilisé (affiché dans le popup de combat de
// quête) — pas de variante animée conservée ici (cf. suppressions
// équivalentes de MEWTWO_SPRITE/LUGIA_SPRITE/HOOH_SPRITE côté Kanto/Johto).
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
    rerunLabel:  '🔴 Sigle Magma', rerunLabel_en: '🔴 Magma Emblem',
    zones1:      _MAGMA_ZONES,
    hideout:     'team_magma_hideout',
    target1:     20,
    target2:     12,
    admin:       { key: 'tabitha',   name: 'Tabitha',
                   team: [{ species_en: 'numel', level: 54 }, { species_en: 'camerupt', level: 56 }], power: 2000 },
    chief:       { key: 'maxieGen3', name: 'Maxie',
                   team: [{ species_en: 'camerupt', level: 58 }, { species_en: 'crobat', level: 58 }, { species_en: 'claydol', level: 60 }], power: 3000 },
    legendary:   { name: 'Groudon', static: GROUDON_STATIC,
                   species: 'groudon', power: 4500, catchBase: 0.40, level: 70, pot: 4,
                   zone: 'cave_of_origin', statMult: 1.7,
                   team: [{ species_en: 'groudon', level: 70, potential: 4 }] },
    theme:       { accent: '#e63535', glow: 'rgba(230,53,53,.4)', bg: '#110606', label: '🌋 MAGMA',
                   intro:  'linear-gradient(160deg,#110606 0%,#1a0a04 100%)',
                   stepBorder: 'rgba(230,53,53,.25)', stepActiveBorder: 'rgba(230,53,53,.7)' },
    title:       'Opération Magma', title_en: 'Operation Magma',
    stepTitles:  ['Quadriller Hoenn', 'Infiltrer le QG', 'Neutraliser Tabitha',
                  'Stopper Maxie', 'Affronter Groudon'],
    stepTitles_en: ['Sweep Hoenn', 'Infiltrate the HQ', 'Neutralize Tabitha',
                  'Stop Maxie', 'Face Groudon'],
  },
  kyogre: {
    key:         'kyogreMission',
    rerunItem:   'sceau_aqua',
    rerunLabel:  '🔵 Sceau Aqua', rerunLabel_en: '🔵 Aqua Seal',
    zones1:      _AQUA_ZONES,
    hideout:     'team_aqua_hideout',
    target1:     20,
    target2:     12,
    admin:       { key: 'matt',      name: 'Matt',
                   team: [{ species_en: 'sharpedo', level: 54 }, { species_en: 'golbat', level: 56 }], power: 2000 },
    chief:       { key: 'archieGen3',name: 'Archie',
                   team: [{ species_en: 'sharpedo', level: 58 }, { species_en: 'mantine', level: 58 }, { species_en: 'crobat', level: 60 }], power: 3000 },
    legendary:   { name: 'Kyogre', static: KYOGRE_STATIC,
                   species: 'kyogre', power: 4500, catchBase: 0.40, level: 70, pot: 4,
                   zone: 'cave_of_origin', statMult: 1.7,
                   team: [{ species_en: 'kyogre', level: 70, potential: 4 }] },
    theme:       { accent: '#2299ff', glow: 'rgba(34,153,255,.4)', bg: '#040b11', label: '🌊 AQUA',
                   intro:  'linear-gradient(160deg,#040b11 0%,#041a2a 100%)',
                   stepBorder: 'rgba(34,153,255,.25)', stepActiveBorder: 'rgba(34,153,255,.7)' },
    title:       'Opération Aqua', title_en: 'Operation Aqua',
    stepTitles:  ['Quadriller Hoenn', 'Infiltrer le QG', 'Neutraliser Matt',
                  'Stopper Archie', 'Affronter Kyogre'],
    stepTitles_en: ['Sweep Hoenn', 'Infiltrate the HQ', 'Neutralize Matt',
                  'Stop Archie', 'Face Kyogre'],
  },
};
// Accesseurs bilingues sur QUESTS[...] — mêmes proper nouns (Tabitha, Maxie,
// Groudon…) des deux côtés, seuls titres/libellés/rosters changent.
const _qTitle      = cfg => _t(cfg.title, cfg.title_en);
const _qStepTitle  = (cfg, i) => _t(cfg.stepTitles[i], cfg.stepTitles_en[i]);
const _qRerunLabel = cfg => _t(cfg.rerunLabel, cfg.rerunLabel_en);

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
        _notify(_t('🌋 QG Magma localisé ! Infiltrez le QG Team Magma.', '🌋 Magma HQ located! Infiltrate the Team Magma HQ.'), 'gold');
      }
      dirty = true;
    }
    if (gm.step === 2 && zoneId === 'team_magma_hideout') {
      gm.hideoutFightsWon = Math.min((gm.hideoutFightsWon || 0) + 1, QUESTS.groudon.target2);
      if (gm.hideoutFightsWon >= QUESTS.groudon.target2) {
        gm.step = 3;
        _notify(_t('🌋 Laboratoire Magma percé ! Affrontez Tabitha depuis le tracker.', '🌋 Magma lab breached! Face Tabitha from the tracker.'), 'gold');
      }
      dirty = true;
    }
    // Drop Sigle Magma (1,5 % dans toutes zones Magma pendant la quête active)
    if (_MAGMA_ZONES.has(zoneId) && Math.random() < 0.015) {
      s.inventory.sigle_magma = (s.inventory.sigle_magma || 0) + 1;
      _notify(_t('🔴 Sigle Magma récupéré ! (relance combat Groudon)', '🔴 Magma Emblem recovered! (retry the Groudon fight)'), 'gold');
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
        _notify(_t('🌊 QG Aqua localisé ! Infiltrez le QG Team Aqua.', '🌊 Aqua HQ located! Infiltrate the Team Aqua HQ.'), 'gold');
      }
      dirty = true;
    }
    if (km.step === 2 && zoneId === 'team_aqua_hideout') {
      km.hideoutFightsWon = Math.min((km.hideoutFightsWon || 0) + 1, QUESTS.kyogre.target2);
      if (km.hideoutFightsWon >= QUESTS.kyogre.target2) {
        km.step = 3;
        _notify(_t('🌊 Bases Aqua démantelées ! Affrontez Matt depuis le tracker.', '🌊 Aqua bases dismantled! Face Matt from the tracker.'), 'gold');
      }
      dirty = true;
    }
    // Drop Sceau Aqua (1,5 %)
    if (_AQUA_ZONES.has(zoneId) && Math.random() < 0.015) {
      s.inventory.sceau_aqua = (s.inventory.sceau_aqua || 0) + 1;
      _notify(_t('🔵 Sceau Aqua récupéré ! (relance combat Kyogre)', '🔵 Aqua Seal recovered! (retry the Kyogre fight)'), 'gold');
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
      position:fixed; inset:0; z-index:9100;
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      padding:18px 14px; overflow-y:auto;
      animation:lgm-fadein .45s ease both;
      user-select:none;
    }
    .lgm-close-btn {
      position:fixed; top:14px; right:18px;
      font-family:var(--font-pixel,monospace); font-size:8px;
      color:rgba(180,180,180,.5); cursor:pointer; z-index:9200;
      padding:4px 8px; letter-spacing:1px;
      transition:color .15s;
    }
    .lgm-close-btn:hover { color:#eee; }
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

let _closeBtnEl = null;

function _buildOverlay(questId) {
  _injectStyles();
  const el = document.createElement('div');
  el.id = 'lgm-overlay';
  document.body.appendChild(el);
  _overlay = el;
  _setTheme(questId ?? null);

  // Bouton fermer fixe (survit aux rebuilds internes via _clearOv, contrairement
  // à un bouton placé dans le contenu du tracker — même patron que Johto/Kanto).
  const closeBtn = document.createElement('span');
  closeBtn.className = 'lgm-close-btn';
  closeBtn.textContent = `✕ ${_t('FERMER', 'CLOSE')}`;
  closeBtn.onclick = () => _closeOv();
  document.body.appendChild(closeBtn);
  _closeBtnEl = closeBtn;

  return el;
}

function _clearOv()   { if (_overlay) _overlay.innerHTML = ''; }
function _closeOv(ms = 380) {
  if (!_overlay) return;
  const el = _overlay;
  el.style.transition = `opacity ${ms}ms ease`;
  el.style.opacity = '0';
  _closeBtnEl?.remove();
  _closeBtnEl = null;
  _overlay = null;
  setTimeout(() => { el.remove(); }, ms);
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

// ════════════════════════════════════════════════════════════════
//  INTRO CINÉMATIQUE (commune aux deux quêtes)
// ════════════════════════════════════════════════════════════════

let _introShown = false;

async function _showQuestIntro() {
  if (_overlay || _introShown) return;
  _introShown = true;
  _buildOverlay(null);

  await _wait(700);
  if (!_overlay) { _introShown = false; return; }
  _clearOv();

  // Boîte neutre (deux équipes, tension)
  const box = document.createElement('div');
  box.className = 'lgm-box';
  box.style.cssText += ';max-width:560px;background:#07070f;--lgm-accent:#cc9922;--lgm-glow:rgba(200,140,30,.3);--lgm-border:rgba(200,140,30,.25)';
  _overlay.appendChild(box);

  _sublabel(box, _t('— Alerte Hoenn —', '— Hoenn Alert —'));
  _titleEl(box, _t('⚡  Conflit de Forces Primitives', '⚡  Clash of Primal Forces'));
  const txt = _textEl(box);

  await _typewrite(txt, _t(
    'Deux organisations se disputent l\'avenir de Hoenn.\n\n' +
    'La Team Magma veut réveiller le Titan du Continent —\n' +
    'étendre les terres, éradiquer les océans.\n\n' +
    'La Team Aqua, elle, cherche à libérer le Maître des Abysses —\n' +
    'engloutir les terres sous des kilomètres d\'eau.\n\n' +
    'Leurs QG sont identifiés. Leurs chefs sont localisés.\n' +
    'Il faut les arrêter — ou les contrôler.\n\n' +
    'Deux quêtes parallèles. À vous de choisir l\'ordre.',
    'Two organizations are fighting over the fate of Hoenn.\n\n' +
    'Team Magma wants to awaken the Continent Titan —\n' +
    'expand the land, eradicate the oceans.\n\n' +
    'Team Aqua, meanwhile, seeks to free the Abyssal Ruler —\n' +
    'sink the land under miles of water.\n\n' +
    'Their HQs are identified. Their leaders are located.\n' +
    'They must be stopped — or controlled.\n\n' +
    'Two parallel quests. The order is yours to choose.',
  ));

  const ch = _choices(box);
  const bGo = _btn(_t('▸  Accepter les deux opérations', '▸  Accept both operations'), 'accent');
  const bNo = _btn(_t('▸  Pas maintenant', '▸  Not now'));

  bGo.onclick = () => {
    const gm = _qs('groudon');
    const km = _qs('kyogre');
    if (gm) { gm.active = true; if (!gm.step) gm.step = 1; }
    if (km) { km.active = true; if (!km.step) km.step = 1; }
    _save();
    _closeOv();
    _notify(_t('🌋🌊 Opérations Magma & Aqua lancées — consultez le tracker depuis les zones Hoenn.', '🌋🌊 Operations Magma & Aqua launched — check the tracker from the Hoenn zones.'), 'gold');
  };
  bNo.onclick = () => {
    // Sans ce reset, openLegendaryMissions() rappellerait _showQuestIntro() plus
    // tard (le joueur veut finalement accepter) mais elle retournerait aussitôt
    // sans effet — le message ci-dessous promet que la quête reste accessible.
    _introShown = false;
    _closeOv();
    _notify(_t('⚡ Les deux quêtes légendaires Hoenn restent disponibles.', '⚡ Both Hoenn legendary quests remain available.'), '');
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
  header.textContent = _t('— Quêtes Légendaires Hoenn —', '— Hoenn Legendary Quests —');
  _overlay.appendChild(header);

  const dual = document.createElement('div');
  dual.className = 'lgm-dual';
  _overlay.appendChild(dual);

  // Puissance boss (commun)
  const pBar = document.createElement('div');
  pBar.style.cssText = 'max-width:700px;width:100%;display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(0,0,0,.4);border:1px solid rgba(255,204,90,.12);border-radius:3px;margin-bottom:10px;font-family:var(--font-pixel,monospace);font-size:7px;color:#7a8aaa';
  pBar.innerHTML = `${_t('Puissance Boss', 'Boss Power')} <span style="margin-left:auto;color:#ffcc5a;font-size:9px">${power.toLocaleString()}</span>`;
  _overlay.appendChild(pBar);
  _overlay.insertBefore(pBar, dual);

  _renderQuestCard(dual, 'groudon', gm, power, sigle);
  _renderQuestCard(dual, 'kyogre',  km, power, sceau);
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
  ctitle.textContent = _qTitle(cfg);
  card.appendChild(ctitle);

  // Item rerun
  const iRow = document.createElement('div');
  iRow.className = 'lgm-item-row';
  iRow.innerHTML = `${_qRerunLabel(cfg)} : <strong style="color:${t.accent};margin-left:4px">${rerunItem}</strong>
    <span style="opacity:.4;font-size:6px;margin-left:6px">${_t('1,5 % / combat', '1.5% / battle')}</span>`;
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
      n:1, name: _qStepTitle(cfg, 0),
      sub: `${_t('Zones', 'Zones')} ${questId === 'groudon' ? 'Magma' : 'Aqua'} — ${Math.min(f1, target1)} / ${target1}`,
      progress: qs > 1 ? 1 : f1 / target1,
    },
    {
      n:2, name: _qStepTitle(cfg, 1),
      sub: `${qs > 2 ? target2 : Math.min(f2, target2)} / ${target2} ${_t('combats', 'battles')}`,
      progress: qs > 2 ? 1 : f2 / target2,
    },
    {
      n:3, name: _qStepTitle(cfg, 2),
      sub: `→ ${_t(`Rendez-vous au QG pour affronter ${cfg.admin.name}`, `Head to the HQ to face ${cfg.admin.name}`)}`,
    },
    {
      n:4, name: _qStepTitle(cfg, 3),
      sub: `→ ${_t(`Rendez-vous au QG pour affronter ${cfg.chief.name}`, `Head to the HQ to face ${cfg.chief.name}`)}`,
    },
    {
      n:5, name: _qStepTitle(cfg, 4),
      sub: qs === 6
        ? `→ ${_t('Rejouable depuis la Caverne Originelle', 'Replayable from the Cave of Origin')}`
        : `→ ${_t(`Rendez-vous à la Caverne Originelle pour affronter ${cfg.legendary.name}`, `Head to the Cave of Origin to face ${cfg.legendary.name}`)}`,
      action: qs === 6
        ? { label: `♺ ${_t('Rejouer', 'Retry')} (1 ${_qRerunLabel(cfg)})`, fn: () => _doRerun(questId) }
        : undefined,
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
    na.textContent = _t('Quête non démarrée', 'Quest not started');
    card.appendChild(na);
  }
}

// ════════════════════════════════════════════════════════════════
//  RENCONTRES DE QUÊTE (sprite sur zone → popup de combat réel)
//  Remplace l'ancien overlay "Combattre" par un vrai combat tour-par-tour
//  (questCombat.js) déclenché en cliquant le sprite du dresseur/légendaire
//  dans sa zone (voir getHoennQuestEncounterForZone, appelé par
//  l'agrégateur de modules/ui/zoneWindows.js).
// ════════════════════════════════════════════════════════════════

function _repatchZone(zoneId) {
  const win = document.getElementById(`zw-${zoneId}`);
  if (win) globalThis.patchZoneWindow?.(zoneId, win);
}

function _openAdmin(questId) {
  const cfg = QUESTS[questId];
  const q = _qs(questId);
  if (!q) return;
  if (!q.adminEncounter) q.adminEncounter = defaultEncounterState();
  globalThis.openQuestEncounterPopup?.({
    id: `lgm-admin-${questId}`, kind: 'trainer',
    name: cfg.admin.name, icon: cfg.theme.label,
    spriteUrl: globalThis.trainerSprite?.(cfg.admin.key) ?? '',
    lore: _t(`Admin ${questId === 'groudon' ? 'Magma' : 'Aqua'}`, `Team ${questId === 'groudon' ? 'Magma' : 'Aqua'} Admin`),
    team: cfg.admin.team,
    encounterState: q.adminEncounter,
    onResolved: (result) => {
      if (!result.won) return;
      q.adminDefeated = true; q.step = 4;
      _notify(_t(`${cfg.admin.name} est vaincu. La voie vers le chef est dégagée.`, `${cfg.admin.name} is defeated. The way to the leader is now clear.`), 'gold');
      _save();
      _repatchZone(cfg.hideout);
    },
  });
}

function _openChief(questId) {
  const cfg = QUESTS[questId];
  const q = _qs(questId);
  if (!q) return;
  if (!q.chiefEncounter) q.chiefEncounter = defaultEncounterState();
  globalThis.openQuestEncounterPopup?.({
    id: `lgm-chief-${questId}`, kind: 'trainer',
    name: cfg.chief.name, icon: cfg.theme.label,
    spriteUrl: globalThis.trainerSprite?.(cfg.chief.key) ?? '',
    lore: _t(`Chef ${questId === 'groudon' ? 'Magma' : 'Aqua'}`, `Team ${questId === 'groudon' ? 'Magma' : 'Aqua'} Leader`),
    team: cfg.chief.team,
    encounterState: q.chiefEncounter,
    onResolved: (result) => {
      if (!result.won) return;
      if (questId === 'groudon') q.maxieDefeated = true; else q.archieDefeated = true;
      q.step = 5;
      _notify(_t(`${cfg.chief.name} est vaincu. ${cfg.legendary.name} s'est réveillé.`, `${cfg.chief.name} is defeated. ${cfg.legendary.name} has awakened.`), 'gold');
      _save();
      _repatchZone(cfg.hideout);
    },
  });
}

function _openLegendary(questId) {
  const cfg = QUESTS[questId];
  const q = _qs(questId);
  if (!q || q.step !== 5) return;
  if (!q.legendEncounter) q.legendEncounter = defaultEncounterState();
  const leg = cfg.legendary;
  globalThis.openQuestEncounterPopup?.({
    id: `lgm-leg-${questId}`, kind: 'legendary',
    name: leg.name, icon: cfg.theme.label, spriteUrl: leg.static,
    team: leg.team, statMult: leg.statMult ?? 1, catchBase: leg.catchBase,
    potential: leg.pot, zoneId: leg.zone,
    encounterState: q.legendEncounter,
    onResolved: (result) => {
      if (!result.won) return;
      if (!result.captured) {
        _notify(_t(`⚡ ${leg.name} s'échappe !`, `⚡ ${leg.name} escapes!`), '');
        return;
      }
      _addLegendaryToPC(questId);
      if (questId === 'groudon') q.groudonOwned = true; else q.kyogreOwned = true;
      q.totalCaptures = (q.totalCaptures || 0) + 1;
      q.step = 6;
      _notify(_t(`★ ${leg.name} capturé — Niv.${leg.level} / Pot.${leg.pot} !`, `★ ${leg.name} caught — Lv.${leg.level} / Pot.${leg.pot}!`), 'gold');
      _save();
      _repatchZone(leg.zone);
    },
  });
}

function _doRerun(questId) {
  const s = _state();
  const cfg = QUESTS[questId];
  const q = _qs(questId);
  if (!s || !q || q.step !== 6) return;
  if ((s.inventory[cfg.rerunItem] || 0) < 1) return;
  s.inventory[cfg.rerunItem]--;
  q.step = 5;
  q.legendEncounter = defaultEncounterState();
  _save();
  if (_overlay) _renderDualTracker();
}

/** Agrégateur appelé par modules/ui/zoneWindows.js pour savoir si un
 *  dresseur/légendaire de quête doit apparaître comme sprite persistant
 *  dans la fenêtre de zone zoneId à l'étape courante. */
export function getHoennQuestEncounterForZone(zoneId) {
  for (const questId of ['groudon', 'kyogre']) {
    const cfg = QUESTS[questId];
    const q = _qs(questId);
    if (!q?.active) continue;
    if (q.step === 3 && zoneId === cfg.hideout) {
      return { id: `lgm-admin-${questId}`, name: cfg.admin.name, icon: cfg.theme.label, spriteUrl: globalThis.trainerSprite?.(cfg.admin.key) ?? '', onClick: () => _openAdmin(questId) };
    }
    if (q.step === 4 && zoneId === cfg.hideout) {
      return { id: `lgm-chief-${questId}`, name: cfg.chief.name, icon: cfg.theme.label, spriteUrl: globalThis.trainerSprite?.(cfg.chief.key) ?? '', onClick: () => _openChief(questId) };
    }
    if (q.step === 5 && zoneId === cfg.legendary.zone) {
      return { id: `lgm-leg-${questId}`, name: cfg.legendary.name, icon: cfg.theme.label, spriteUrl: cfg.legendary.static, onClick: () => _openLegendary(questId) };
    }
  }
  return null;
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
  getHoennQuestEncounterForZone,
});

export { openLegendaryMissions, checkLegendaryMissionsUnlock };
export {};
