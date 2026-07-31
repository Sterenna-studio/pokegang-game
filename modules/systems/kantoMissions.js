'use strict';

// ════════════════════════════════════════════════════════════════
//  KANTO MISSIONS — Trio des Oiseaux · Mewtwo
//  Quatre quêtes parallèles inspirées de Pokémon Rouge/Bleu/Jaune.
//
//  Le suivi de progression (grind de combats de zone, collecte d'objets)
//  reste géré ici via l'overlay tracker (_buildTracker/openKantoMissions).
//  Les affrontements de quête (dresseur intermédiaire + légendaire final)
//  ne se déclenchent plus depuis cet overlay : une fois l'étape atteinte,
//  getKantoQuestEncounterForZone(zoneId) fait apparaître le dresseur/
//  légendaire comme sprite persistant dans sa zone de lore (agrégé par
//  modules/ui/zoneWindows.js) ; un clic ouvre un vrai combat tour-par-tour
//  (modules/ui/questEncounterPopup.js + modules/systems/questCombat.js),
//  avec possibilité d'envoyer des agents affaiblir l'adversaire avant de
//  l'affronter directement avec l'équipe du boss.
//
//  Trio des Oiseaux (3 étapes chacun, parallèles) :
//    Articuno — seafoam_islands (10 combats) → Lorelei → Articuno
//    Zapdos   — power_plant      (10 combats) → Lt. Surge → Zapdos
//    Moltres  — victory_road     (10 combats) → Blaine     → Moltres
//
//  Quête Mewtwo (5 étapes) :
//    1. Vaincre 20 membres Rocket dans les zones Kanto
//    2. Collecter 3 Rapports Sylphe (drop auto depuis silph_co)
//    3. Vaincre 15 combats dans le Manoir Pokémon
//    4. Vaincre Giovanni — pokemon_mansion
//    5. Affronter Mewtwo — unknown_cave (Grotte Cerulean)
//
//  Rejouable :
//    1 Plume Sacrée   → relance le combat contre l'un des Oiseaux (déjà capturé)
//    1 Rapport Sylphe → relance le combat contre Mewtwo
//
//  Déclenchement :
//    checkKantoMissionsUnlock()        — au boot
//    openKantoMissions()               — ouvre le tracker (progression)
//    getKantoQuestEncounterForZone(id) — sprite de combat pour une zone
//
//  Dépendances globalThis :
//    state, saveState, makePokemon, calculateStats, registerPokedexCapture,
//    trainerSprite, openQuestEncounterPopup, getAgentCombatPower
//  Dépendances import :
//    defaultEncounterState (modules/systems/questCombat.js)
//  Dépendances bare-name (classic scripts) :
//    (aucune — zones Kanto dans ZONE_BY_ID global)
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';
import { defaultEncounterState } from './questCombat.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });
const _save   = ()               => globalThis.saveState?.();
// Traduction inline légère — même convention que le reste du codebase
// (state.lang === 'fr' ? ... : ...), enveloppée ici pour éviter de répéter
// la condition sur les dizaines de chaînes de ce module.
const _t = (fr, en) => (globalThis.state?.lang === 'en' ? en : fr);

// ── Sprites ──────────────────────────────────────────────────────
const ARTICUNO_SPRITE = 'https://play.pokemonshowdown.com/sprites/gen5ani/articuno.gif';
const ZAPDOS_SPRITE   = 'https://play.pokemonshowdown.com/sprites/gen5ani/zapdos.gif';
const MOLTRES_SPRITE  = 'https://play.pokemonshowdown.com/sprites/gen5ani/moltres.gif';
const ARTICUNO_STATIC = 'https://play.pokemonshowdown.com/sprites/gen1/articuno.png';
const ZAPDOS_STATIC   = 'https://play.pokemonshowdown.com/sprites/gen1/zapdos.png';
const MOLTRES_STATIC  = 'https://play.pokemonshowdown.com/sprites/gen1/moltres.png';
const MEWTWO_STATIC   = 'https://play.pokemonshowdown.com/sprites/gen1/mewtwo.png';

// ── Zones de suivi ───────────────────────────────────────────────
const _ROCKET_KANTO = new Set([
  'silph_co', 'pokemon_tower', 'celadon_casino', 'saffron_gym', 'mt_moon',
  'viridian_forest', 'pokemon_mansion', 'ss_anne',
]);
// Sous-ensemble strict de TRAINER_TYPES pour le drop combat de Rapport
// Sylphe ci-dessous — contrairement à _ROCKET_KANTO (qui ne teste que la
// zone), on veut ici une victoire contre un membre Rocket identifié.
// Exclut volontairement 'scientist' : présent dans le pool de zones Rocket
// (silph_co) mais aussi dans des zones sans rapport (power_plant,
// cinnabar_gym, pokemon_mansion) — pas exclusif à la Team Rocket.
const _ROCKET_TRAINER_KEYS = new Set(['rocketgrunt', 'rocketgruntf', 'archer', 'ariana', 'proton', 'giovanni']);

// ── Config oiseaux ────────────────────────────────────────────────
// `boss.team`/`team` : équipes structurées pour le vrai combat (questCombat.js)
// — remplace les descriptions en texte libre d'avant la refonte "sprite sur
// zone". `statMult` buffe l'oiseau pour le combat spécial (pas ses stats une
// fois capturé, qui restent définies par level/pot ci-dessous).
const BIRDS = {
  articuno: {
    name: 'Artikodin', name_en: 'Articuno', species: 'articuno',
    sprite: ARTICUNO_SPRITE, static: ARTICUNO_STATIC,
    accent: '#70b8ff', icon: '❄️',
    zone: 'seafoam_islands', zoneLabel: 'Grottes Ecume', zoneLabel_en: 'Seafoam Islands',
    boss: {
      name: 'Lorelei', role: 'Conseil des 4 — Glace', role_en: 'Elite Four — Ice', key: 'lorelei',
      team: [
        { species_en: 'dewgong', level: 52 }, { species_en: 'cloyster', level: 53 },
        { species_en: 'slowbro', level: 52 }, { species_en: 'jynx', level: 54 },
        { species_en: 'lapras', level: 56 },
      ],
    },
    power: 3500, catchBase: 0.50, level: 54, pot: 3,
    team: [{ species_en: 'articuno', level: 54, potential: 3 }], statMult: 1.6,
  },
  zapdos: {
    name: 'Électhor', name_en: 'Zapdos', species: 'zapdos',
    sprite: ZAPDOS_SPRITE, static: ZAPDOS_STATIC,
    accent: '#f0d040', icon: '⚡',
    zone: 'power_plant', zoneLabel: 'Centrale Électrique', zoneLabel_en: 'Power Plant',
    boss: {
      name: 'Lt. Surge', role: 'Champion Vermilion', role_en: 'Vermilion Gym Leader', key: 'ltsurge',
      team: [
        { species_en: 'raichu', level: 51 }, { species_en: 'electrode', level: 52 },
        { species_en: 'electrode', level: 52 }, { species_en: 'magneton', level: 53 },
      ],
    },
    power: 3500, catchBase: 0.50, level: 50, pot: 3,
    team: [{ species_en: 'zapdos', level: 50, potential: 3 }], statMult: 1.6,
  },
  moltres: {
    name: 'Sulfura', name_en: 'Moltres', species: 'moltres',
    sprite: MOLTRES_SPRITE, static: MOLTRES_STATIC,
    accent: '#ff7030', icon: '🔥',
    zone: 'victory_road', zoneLabel: 'Route Victoire', zoneLabel_en: 'Victory Road',
    boss: {
      name: 'Blaine', role: 'Champion Cramois\'île', role_en: 'Cinnabar Gym Leader', key: 'blaine',
      team: [
        { species_en: 'growlithe', level: 51 }, { species_en: 'ponyta', level: 51 },
        { species_en: 'rapidash', level: 52 }, { species_en: 'arcanine', level: 54 },
      ],
    },
    power: 3500, catchBase: 0.50, level: 50, pot: 3,
    team: [{ species_en: 'moltres', level: 50, potential: 3 }], statMult: 1.6,
  },
};

// ── Config dresseur/légendaire hors trio (Giovanni, Mewtwo) ───────
const GIOVANNI_CFG = {
  name: 'Giovanni', role: 'Chef de la Team Rocket', role_en: 'Team Rocket Boss',
  zone: 'pokemon_mansion', accent: '#cc2222', icon: '💼',
  team: [
    { species_en: 'nidoqueen', level: 58 }, { species_en: 'nidoking', level: 58 },
    { species_en: 'rhyhorn', level: 56 }, { species_en: 'kangaskhan', level: 57 },
  ],
};
const MEWTWO_CFG = {
  name: 'Mewtwo', species: 'mewtwo', zone: 'unknown_cave',
  sprite: MEWTWO_STATIC, accent: '#cc2222', icon: '🧬',
  power: 6000, catchBase: 0.30, level: 70, pot: 5,
  team: [{ species_en: 'mewtwo', level: 70, potential: 5 }], statMult: 1.9,
};

// Accesseurs bilingues — le nom du dresseur/boss (proper noun officiel) ne
// change pas, seuls le nom FR de l'oiseau, le libellé de zone et le rôle
// diffèrent entre les deux langues.
const _birdName  = bird => _t(bird.name, bird.name_en);
const _zoneLabel = bird => _t(bird.zoneLabel, bird.zoneLabel_en);
const _bossRole  = boss => _t(boss.role, boss.role_en || boss.role);

// ── Helpers ───────────────────────────────────────────────────────
const _state = () => globalThis.state ?? null;
function _qBirds()  { return _state()?.birdsMission  ?? null; }
function _qMewtwo() { return _state()?.mewtwoMission ?? null; }

// ── EventBus ──────────────────────────────────────────────────────
let _registered = false;

function _register() {
  if (_registered) return;
  _registered = true;
  EventBus.on(EVENTS.COMBAT_WON, _onCombatWon);
  EventBus.on(EVENTS.ITEM_RECEIVED, _onItemReceived);
}

function _onCombatWon({ zoneId, trainerKey, elite } = {}) {
  const s = _state();
  if (!s) return;
  let dirty = false;

  // ── Rapport Sylphe — drop combat contre un membre Rocket identifié ────
  // En plus du drop de zone existant (silph_secret_report, data/zones-data.js
  // — chance 3%, minRep 700, silph_co/saffron_gym uniquement). Celui-ci cible
  // spécifiquement une victoire contre un dresseur Rocket (peu importe la
  // zone), avec une chance nettement supérieure contre un élite. Même seuil
  // de réputation que le drop de zone pour rester cohérent entre les deux.
  if (_ROCKET_TRAINER_KEYS.has(trainerKey) && (s.gang?.reputation || 0) >= 700) {
    const chance = elite ? 0.05 : 0.01;
    if (Math.random() < chance) {
      s.inventory.rapport_sylphe = (s.inventory.rapport_sylphe || 0) + 1;
      EventBus.emit(EVENTS.ITEM_RECEIVED, { itemId: 'rapport_sylphe', qty: 1 });
      _notify(_t(
        `📂 Rapport Sylphe récupéré${elite ? ' sur un cadre Rocket' : ''} !`,
        `📂 Silph Report recovered${elite ? ' from a Rocket admin' : ''}!`,
      ), 'gold');
      dirty = true;
    }
  }

  // ── Oiseaux — step 1 (fights in zone) ────────────────────────
  const birds = _qBirds();
  if (birds) {
    for (const [key, bird] of Object.entries(BIRDS)) {
      const b = birds[key];
      if (!b?.active || b.step !== 1) continue;
      if (zoneId === bird.zone) {
        b.fightsWon = Math.min((b.fightsWon || 0) + 1, 10);
        if (b.fightsWon >= 10) {
          b.step = 2;
          _notify(`${bird.icon} ${_t(`Zone maîtrisée ! Affrontez ${bird.boss.name} depuis la quête Oiseaux.`, `Zone mastered! Face ${bird.boss.name} from the Birds quest tracker.`)}`, 'gold');
        }
        dirty = true;
      }
    }
  }

  // ── Mewtwo ────────────────────────────────────────────────────
  const mm = _qMewtwo();
  if (mm?.active) {
    if (mm.step === 1 && _ROCKET_KANTO.has(zoneId)) {
      mm.rocketFightsWon = Math.min((mm.rocketFightsWon || 0) + 1, 20);
      if (mm.rocketFightsWon >= 20) {
        mm.step = 2;
        _notify(_t(
          '🧬 20 membres Rocket vaincus ! Collectez 3 Rapports Sylphe (drop depuis Sylphe Co.).',
          '🧬 20 Rocket members defeated! Collect 3 Silph Reports (drops from Silph Co.).',
        ), 'gold');
      }
      dirty = true;
    }
    if (mm.step === 3 && zoneId === 'pokemon_mansion') {
      mm.mansionFightsWon = Math.min((mm.mansionFightsWon || 0) + 1, 15);
      if (mm.mansionFightsWon >= 15) {
        mm.step = 4;
        _notify(_t(
          '🧬 Manoir infiltré ! Localisez Giovanni pour le combat final.',
          '🧬 Mansion infiltrated! Locate Giovanni for the final battle.',
        ), 'gold');
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

  if (itemId === 'rapport_sylphe') {
    const mm = _qMewtwo();
    if (mm?.active && mm.step === 2) {
      mm.rapportSylphe = Math.min((mm.rapportSylphe || 0) + 1, 3);
      // Consommé pour la progression de la quête — sinon les 3 mêmes rapports
      // restent en inventaire et peuvent aussi servir de relance gratuite après capture.
      s.inventory.rapport_sylphe = Math.max(0, (s.inventory.rapport_sylphe || 0) - 1);
      if (mm.rapportSylphe >= 3) {
        mm.step = 3;
        _notify(_t(
          '🧬 3 Rapports Sylphe réunis ! Infiltrez le Manoir Pokémon (15 combats).',
          '🧬 3 Silph Reports gathered! Infiltrate the Pokémon Mansion (15 battles).',
        ), 'gold');
      }
      dirty = true;
    }
  }

  if (dirty) _save();
}

// ── Styles (prefix ktm-) ─────────────────────────────────────────
function _injectStyles() {
  if (document.getElementById('ktm-styles')) return;
  const s = document.createElement('style');
  s.id = 'ktm-styles';
  s.textContent = `
    #ktm-overlay {
      position:fixed; inset:0; z-index:9100;
      background:#040408;
      display:flex; flex-direction:column; align-items:center;
      padding:16px 12px 20px; overflow-y:auto;
      animation:ktm-fadein .4s ease both;
    }
    @keyframes ktm-fadein  { from{opacity:0} to{opacity:1} }
    @keyframes ktm-fadeout { from{opacity:1} to{opacity:0} }
    @keyframes ktm-float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
    @keyframes ktm-appear  { from{opacity:0;transform:scale(.9) translateY(10px)} to{opacity:1;transform:none} }
    @keyframes ktm-pulse   { 0%,100%{opacity:.4} 50%{opacity:1} }

    .ktm-wrap {
      width:100%; max-width:960px;
      display:flex; flex-direction:column; gap:12px;
    }
    .ktm-header {
      text-align:center; padding:8px 0 4px;
    }
    .ktm-header-label {
      font-family:var(--font-pixel,monospace);
      font-size:7px; letter-spacing:4px; text-transform:uppercase;
      color:rgba(200,160,100,.6); margin-bottom:4px;
    }
    .ktm-header-title {
      font-family:var(--font-pixel,monospace);
      font-size:11px; letter-spacing:2px; text-transform:uppercase;
      color:#ffcc88; text-shadow:0 0 12px rgba(200,150,80,.5);
    }

    /* Ligne des oiseaux (3 colonnes) + Mewtwo (1 col) en dessous */
    .ktm-birds-row {
      display:grid; grid-template-columns:repeat(3,1fr);
      gap:10px;
    }
    .ktm-mewtwo-row { width:100%; }
    @media(max-width:680px) { .ktm-birds-row { grid-template-columns:1fr; } }

    /* Carte */
    .ktm-card {
      background:rgba(4,4,12,.95);
      border:1px solid rgba(var(--ktm-rgb,100,140,200),.2);
      border-left:3px solid var(--ktm-accent,#6688cc);
      padding:14px 14px 12px;
      display:flex; flex-direction:column; gap:8px;
      animation:ktm-appear .4s ease both;
    }
    .ktm-card-label {
      font-family:var(--font-pixel,monospace);
      font-size:6px; letter-spacing:3px; text-transform:uppercase;
      color:var(--ktm-accent,#6688cc); opacity:.8;
    }
    .ktm-card-title {
      font-family:var(--font-pixel,monospace);
      font-size:9px; letter-spacing:1px; text-transform:uppercase;
      color:var(--ktm-accent,#6688cc);
    }
    .ktm-sprite-row {
      display:flex; align-items:center; justify-content:center;
      padding:6px 0; min-height:68px;
    }
    .ktm-sprite {
      image-rendering:pixelated; height:60px; width:auto;
      animation:ktm-float 3s ease-in-out infinite;
    }
    .ktm-sprite.grey { filter:grayscale(1) brightness(.4); animation:ktm-pulse 2s ease-in-out infinite; }
    .ktm-sprite.big  { height:72px; }

    /* Steps */
    .ktm-steps { display:flex; flex-direction:column; gap:4px; }
    .ktm-step {
      display:flex; align-items:flex-start; gap:6px;
      font-family:var(--font-pixel,monospace); font-size:7.5px; line-height:1.6;
      color:rgba(160,180,220,.45);
      border-left:2px solid rgba(100,140,200,.1);
      padding:3px 0 3px 7px;
    }
    .ktm-step.active { color:#c0d0f0; border-left-color:var(--ktm-accent,#6688cc); background:rgba(50,80,200,.06); }
    .ktm-step.done   { color:rgba(100,140,200,.5); text-decoration:line-through; border-left-color:rgba(100,140,200,.2); }
    .ktm-step-num    { font-size:6px; opacity:.7; flex-shrink:0; margin-top:1px; min-width:10px; }
    .ktm-step-bar    { height:2px; background:rgba(100,140,200,.15); border-radius:1px; margin-top:2px; }
    .ktm-step-bar-fill { height:100%; background:var(--ktm-accent,#6688cc); border-radius:1px; transition:width .3s; }

    /* Actions */
    .ktm-actions { display:flex; gap:6px; flex-wrap:wrap; margin-top:4px; }
    .ktm-btn {
      font-family:var(--font-pixel,monospace); font-size:7.5px;
      letter-spacing:.5px; text-transform:uppercase;
      padding:5px 10px; border:1px solid var(--ktm-accent,#6688cc);
      background:transparent; color:var(--ktm-accent,#6688cc);
      cursor:pointer; transition:background .15s, color .15s;
    }
    .ktm-btn:hover { background:var(--ktm-accent,#6688cc); color:#000820; }
    .ktm-btn:disabled { opacity:.35; cursor:not-allowed; }
    .ktm-btn.primary { background:var(--ktm-accent,#6688cc); color:#000820; }
    .ktm-btn.primary:hover { filter:brightness(1.15); }
    .ktm-btn.gold { border-color:var(--gold,#ffcc5a); color:var(--gold,#ffcc5a); }
    .ktm-btn.gold:hover { background:var(--gold,#ffcc5a); color:#080400; }
    .ktm-rerun-note {
      font-family:var(--font-pixel,monospace); font-size:6.5px;
      color:rgba(180,180,140,.4); text-align:center; padding-top:2px;
    }

    /* Fight modal */
    .ktm-fight-modal {
      position:absolute; inset:0; z-index:10;
      background:rgba(1,1,8,.97);
      display:flex; align-items:center; justify-content:center;
      padding:20px; animation:ktm-appear .3s ease both;
    }
    .ktm-fight-box {
      background:rgba(3,3,14,.98);
      border:1px solid rgba(var(--ktm-rgb,100,140,200),.3);
      border-left:3px solid var(--ktm-accent,#6688cc);
      padding:20px 22px 18px;
      width:100%; max-width:520px;
    }
    .ktm-fight-title {
      font-family:var(--font-pixel,monospace); font-size:9px;
      letter-spacing:2px; text-transform:uppercase;
      color:var(--ktm-accent,#6688cc); margin-bottom:10px;
    }
    .ktm-fight-text {
      font-family:var(--font-pixel,monospace); font-size:8px;
      line-height:2; color:#b0c0e0; min-height:40px;
      margin-bottom:12px; white-space:pre-wrap;
    }
    .ktm-power-row { display:flex; gap:10px; margin-bottom:12px; flex-wrap:wrap; }
    .ktm-power-chip {
      font-family:var(--font-pixel,monospace); font-size:7px;
      padding:3px 8px; border:1px solid rgba(100,140,200,.3);
      color:rgba(160,190,240,.8); letter-spacing:.5px;
    }
    .ktm-result-banner {
      text-align:center; padding:10px 0;
      font-family:var(--font-pixel,monospace); font-size:10px; letter-spacing:2px;
    }
    .ktm-close-btn {
      position:fixed; top:14px; right:18px;
      font-family:var(--font-pixel,monospace); font-size:8px;
      color:rgba(100,140,200,.5); cursor:pointer; z-index:9200;
      padding:4px 8px; letter-spacing:1px; transition:color .15s;
    }
    .ktm-close-btn:hover { color:#aac0ff; }
  `;
  document.head.appendChild(s);
}

// ── Helpers rendu ─────────────────────────────────────────────────
function _renderStep(st, idx, activeStep) {
  const isDone = st.done;
  const isAct  = !isDone && idx === activeStep;
  const cls    = isDone ? 'done' : isAct ? 'active' : '';
  let bar = '';
  if (isAct && st.max != null) {
    const pct = Math.round(((st.prog ?? 0) / st.max) * 100);
    bar = `<div class="ktm-step-bar"><div class="ktm-step-bar-fill" style="width:${pct}%"></div></div>`;
  }
  const extra = isAct && st.max != null ? ` (${st.prog ?? 0}/${st.max})` : '';
  return `<div class="ktm-step ${cls}">
    <span class="ktm-step-num">${isDone ? '✓' : idx + '.'}</span>
    <div>${st.label}${extra}${bar}</div>
  </div>`;
}

// ── Construction du tracker ───────────────────────────────────────
function _buildTracker() {
  const s = _state();
  if (!s) return '';
  const birds = _qBirds();
  const mm    = _qMewtwo();
  const inv   = s.inventory;

  // ── Cartes Oiseaux ────────────────────────────────────────────
  const birdCards = Object.entries(BIRDS).map(([key, bird]) => {
    const b   = birds?.[key];
    const active = b?.active ?? false;
    const step   = b?.step ?? 0;
    const owned  = b?.owned ?? false;
    const canRerun = owned && (inv.plume_sacree > 0);

    const stepsData = [
      { label:`${_t('10 combats', '10 battles')} — ${_zoneLabel(bird)}`, done: b?.fightsWon >= 10, prog: b?.fightsWon ?? 0, max: 10 },
      { label:`${_t('Vaincre', 'Defeat')} ${bird.boss.name}`,       done: b?.bossDefeated ?? false, prog: null, max: null },
      { label:`${_t('Affronter', 'Face')} ${_birdName(bird)}`,           done: owned, prog: null, max: null },
    ];
    const stepsHtml = stepsData.map((st, i) => _renderStep(st, i + 1, step)).join('');

    let actions = '';
    if (active) {
      if (step === 2 && !b.bossDefeated) {
        actions = `<span class="ktm-rerun-note">→ ${_t(`Rendez-vous à ${_zoneLabel(bird)} pour affronter ${bird.boss.name.split(' ')[0]}`, `Head to ${_zoneLabel(bird)} to face ${bird.boss.name.split(' ')[0]}`)}</span>`;
      } else if (step === 3) {
        actions = `<span class="ktm-rerun-note">→ ${_t(`Rendez-vous à ${_zoneLabel(bird)} pour affronter ${_birdName(bird)}`, `Head to ${_zoneLabel(bird)} to face ${_birdName(bird)}`)}</span>`;
      } else if (step === 6 || owned) {
        if (canRerun) {
          actions = `<button class="ktm-btn gold" data-ktm="rerun-${key}">🪶 ${_t('Relancer', 'Retry')} (${inv.plume_sacree}× ${_t('Plume', 'Feather')})</button>`;
        } else {
          actions = `<span class="ktm-rerun-note">${_t('Plume Sacrée requise pour rejouer', 'Sacred Feather required to retry')}</span>`;
        }
      }
    }

    return `
      <div class="ktm-card" style="--ktm-accent:${bird.accent}">
        <div class="ktm-card-label">${bird.icon} ${_t('Oiseau Légendaire', 'Legendary Bird')}</div>
        <div class="ktm-card-title">${_birdName(bird)}</div>
        <div class="ktm-sprite-row">
          <img class="ktm-sprite${owned ? '' : ' grey'}" src="${bird.static}" alt="${_birdName(bird)}">
        </div>
        <div class="ktm-steps">${stepsHtml}</div>
        <div class="ktm-actions">${actions}</div>
      </div>`;
  }).join('');

  // ── Carte Mewtwo ──────────────────────────────────────────────
  const mstep    = mm?.step ?? 0;
  const mOwned   = mm?.mewtwoOwned ?? false;
  const canRerunM = mOwned && (inv.rapport_sylphe > 0);

  const mewtwoSteps = [
    { label:_t('20 membres Rocket vaincus (Kanto)', '20 Rocket members defeated (Kanto)'), done: mm?.rocketFightsWon >= 20, prog: mm?.rocketFightsWon ?? 0, max: 20 },
    { label:_t('3 Rapports Sylphe collectés', '3 Silph Reports collected'),       done: mm?.rapportSylphe >= 3,   prog: mm?.rapportSylphe ?? 0, max: 3 },
    { label:`${_t('15 combats', '15 battles')} — ${_t('Manoir Pokémon', 'Pokémon Mansion')}`,        done: mm?.mansionFightsWon >= 15, prog: mm?.mansionFightsWon ?? 0, max: 15 },
    { label:_t('Vaincre Giovanni', 'Defeat Giovanni'),                   done: mm?.giovanniDefeated ?? false, prog: null, max: null },
    { label:_t('Affronter Mewtwo — Grotte Cerulean', 'Face Mewtwo — Cerulean Cave'), done: mOwned, prog: null, max: null },
  ];
  const mewtwoStepsHtml = mewtwoSteps.map((st, i) => _renderStep(st, i + 1, mstep)).join('');

  let mewtwoActions = '';
  if (mm?.active) {
    if (mstep === 4 && !mm.giovanniDefeated) {
      mewtwoActions = `<span class="ktm-rerun-note">→ ${_t('Rendez-vous au Manoir Pokémon pour affronter Giovanni', 'Head to Pokémon Mansion to face Giovanni')}</span>`;
    } else if (mstep === 5) {
      mewtwoActions = `<span class="ktm-rerun-note">→ ${_t('Rendez-vous à la Caverne Azurée pour affronter Mewtwo', 'Head to Cerulean Cave to face Mewtwo')}</span>`;
    } else if (mstep === 6 || mOwned) {
      if (canRerunM) {
        mewtwoActions = `<button class="ktm-btn gold" data-ktm="rerun-mewtwo">📂 ${_t('Relancer', 'Retry')} (${inv.rapport_sylphe}× ${_t('Rapport', 'Report')})</button>`;
      } else {
        mewtwoActions = `<span class="ktm-rerun-note">${_t('Rapport Sylphe requis pour rejouer', 'Silph Report required to retry')}</span>`;
      }
    }
  }

  return `
    <div id="ktm-overlay">
      <span class="ktm-close-btn" id="ktm-close">✕ ${_t('FERMER', 'CLOSE')}</span>
      <div class="ktm-wrap">
        <div class="ktm-header">
          <div class="ktm-header-label">${_t('Quêtes Légendaires', 'Legendary Quests')}</div>
          <div class="ktm-header-title">✦ KANTO ✦</div>
        </div>
        <div class="ktm-birds-row">${birdCards}</div>
        <div class="ktm-mewtwo-row">
          <div class="ktm-card" style="--ktm-accent:#cc2222">
            <div class="ktm-card-label">🧬 ${_t('Mewtwo — Génome Ultime', 'Mewtwo — Ultimate Genome')}</div>
            <div class="ktm-card-title">${_t('Projet Clone', 'Clone Project')}</div>
            <div class="ktm-sprite-row">
              <img class="ktm-sprite big${mOwned ? '' : ' grey'}" src="${MEWTWO_STATIC}" alt="Mewtwo">
            </div>
            <div class="ktm-steps">${mewtwoStepsHtml}</div>
            <div class="ktm-actions">${mewtwoActions}</div>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Rencontres de quête (sprite sur zone → popup de combat réel) ──
// Remplace l'ancien overlay "Combattre" par un vrai combat tour-par-tour
// (questCombat.js) déclenché en cliquant le sprite du dresseur/légendaire
// dans sa zone de lore (voir getKantoQuestEncounterForZone, appelé par
// l'agrégateur de modules/ui/zoneWindows.js).

function _openBirdBoss(key) {
  const bird = BIRDS[key];
  const b = _qBirds()?.[key];
  if (!bird || !b) return;
  if (!b.bossEncounter) b.bossEncounter = defaultEncounterState();
  globalThis.openQuestEncounterPopup?.({
    id: `ktm-boss-${key}`, kind: 'trainer',
    name: bird.boss.name, icon: bird.icon,
    spriteUrl: globalThis.trainerSprite?.(bird.boss.key) ?? '',
    lore: _bossRole(bird.boss),
    team: bird.boss.team,
    encounterState: b.bossEncounter,
    onResolved: (result) => {
      if (!result.won) return;
      b.bossDefeated = true; b.step = 3;
      _notify(_t(
        `${bird.boss.name} est vaincu. La route vers ${_birdName(bird)} est ouverte.`,
        `${bird.boss.name} is defeated. The way to ${_birdName(bird)} is now open.`,
      ), 'gold');
      _save();
    },
  });
}

function _openBirdLegendary(key) {
  const bird = BIRDS[key];
  const b = _qBirds()?.[key];
  if (!bird || !b) return;
  if (!b.legendEncounter) b.legendEncounter = defaultEncounterState();
  globalThis.openQuestEncounterPopup?.({
    id: `ktm-leg-${key}`, kind: 'legendary',
    name: _birdName(bird), icon: bird.icon, spriteUrl: bird.static,
    team: bird.team, statMult: bird.statMult ?? 1, catchBase: bird.catchBase,
    encounterState: b.legendEncounter,
    onResolved: (result) => {
      if (!result.won) return;
      if (!result.captured) {
        _notify(_t(`⚡ ${_birdName(bird)} s'échappe !`, `⚡ ${_birdName(bird)} escapes!`), '');
        return;
      }
      const s = _state();
      const pk = globalThis.makePokemon?.(bird.species, null, 'pokeball');
      if (!pk) return;
      pk.level = bird.level;
      pk.shiny = false;
      pk.potential = bird.pot;
      if (globalThis.calculateStats) pk.stats = globalThis.calculateStats(pk);
      b.owned = true; b.step = 6; b.captures = (b.captures || 0) + 1;
      s.pokemons.push(pk);
      EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: pk, zoneId: bird.zone });
      globalThis.registerPokedexCapture?.(s, pk);
      _notify(_t(`✨ ${_birdName(bird)} capturé !`, `✨ ${_birdName(bird)} caught!`), 'gold');
      _save();
    },
  });
}

function _openGiovanni() {
  const mm = _qMewtwo();
  if (!mm) return;
  if (!mm.giovanniEncounter) mm.giovanniEncounter = defaultEncounterState();
  globalThis.openQuestEncounterPopup?.({
    id: 'ktm-giovanni', kind: 'trainer',
    name: GIOVANNI_CFG.name, icon: GIOVANNI_CFG.icon,
    spriteUrl: globalThis.trainerSprite?.('giovanni') ?? '',
    lore: _t(GIOVANNI_CFG.role, GIOVANNI_CFG.role_en),
    team: GIOVANNI_CFG.team,
    encounterState: mm.giovanniEncounter,
    onResolved: (result) => {
      if (!result.won) return;
      mm.giovanniDefeated = true; mm.step = 5;
      _notify(_t(
        'Giovanni est vaincu et s\'enfuit. Les coordonnées de la Grotte Cerulean sont maintenant connues.',
        'Giovanni is defeated and flees. The Cerulean Cave coordinates are now known.',
      ), 'gold');
      _save();
    },
  });
}

function _openMewtwo() {
  const mm = _qMewtwo();
  if (!mm) return;
  if (!mm.mewtwoEncounter) mm.mewtwoEncounter = defaultEncounterState();
  globalThis.openQuestEncounterPopup?.({
    id: 'ktm-mewtwo', kind: 'legendary',
    name: MEWTWO_CFG.name, icon: MEWTWO_CFG.icon, spriteUrl: MEWTWO_CFG.sprite,
    team: MEWTWO_CFG.team, statMult: MEWTWO_CFG.statMult, catchBase: MEWTWO_CFG.catchBase,
    encounterState: mm.mewtwoEncounter,
    onResolved: (result) => {
      if (!result.won) return;
      if (!result.captured) {
        _notify(_t('⚡ Mewtwo s\'échappe !', '⚡ Mewtwo escapes!'), '');
        return;
      }
      const s = _state();
      const pk = globalThis.makePokemon?.(MEWTWO_CFG.species, null, 'pokeball');
      if (!pk) return;
      pk.level = MEWTWO_CFG.level;
      pk.shiny = false;
      pk.potential = MEWTWO_CFG.pot;
      if (globalThis.calculateStats) pk.stats = globalThis.calculateStats(pk);
      mm.mewtwoOwned = true; mm.step = 6; mm.totalCaptures = (mm.totalCaptures || 0) + 1;
      s.pokemons.push(pk);
      EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: pk, zoneId: MEWTWO_CFG.zone });
      globalThis.registerPokedexCapture?.(s, pk);
      _notify(_t('✨ Mewtwo capturé !', '✨ Mewtwo caught!'), 'gold');
      _save();
    },
  });
}

/** Agrégateur appelé par modules/ui/zoneWindows.js pour savoir si un
 *  dresseur/légendaire de quête doit apparaître comme sprite persistant
 *  dans la fenêtre de zone zoneId à l'étape courante. */
export function getKantoQuestEncounterForZone(zoneId) {
  const birds = _qBirds();
  if (birds) {
    for (const [key, bird] of Object.entries(BIRDS)) {
      const b = birds[key];
      if (!b?.active || zoneId !== bird.zone) continue;
      if (b.step === 2 && !b.bossDefeated) {
        return { id: `ktm-boss-${key}`, name: bird.boss.name, icon: bird.icon, spriteUrl: globalThis.trainerSprite?.(bird.boss.key) ?? '', onClick: () => _openBirdBoss(key) };
      }
      if (b.step === 3) {
        return { id: `ktm-leg-${key}`, name: _birdName(bird), icon: bird.icon, spriteUrl: bird.static, onClick: () => _openBirdLegendary(key) };
      }
    }
  }
  const mm = _qMewtwo();
  if (mm?.active) {
    if (mm.step === 4 && !mm.giovanniDefeated && zoneId === GIOVANNI_CFG.zone) {
      return { id: 'ktm-giovanni', name: GIOVANNI_CFG.name, icon: GIOVANNI_CFG.icon, spriteUrl: globalThis.trainerSprite?.('giovanni') ?? '', onClick: _openGiovanni };
    }
    if (mm.step === 5 && zoneId === MEWTWO_CFG.zone) {
      return { id: 'ktm-mewtwo', name: 'Mewtwo', icon: MEWTWO_CFG.icon, spriteUrl: MEWTWO_CFG.sprite, onClick: _openMewtwo };
    }
  }
  return null;
}

// ── Relances ──────────────────────────────────────────────────────
function _doRerun(key) {
  const s = _state();
  if (!s) return;

  if (key === 'mewtwo') {
    if ((s.inventory.rapport_sylphe || 0) < 1) return;
    s.inventory.rapport_sylphe--;
    if (s.mewtwoMission) { s.mewtwoMission.step = 5; s.mewtwoMission.mewtwoEncounter = defaultEncounterState(); }
  } else if (key in BIRDS) {
    if ((s.inventory.plume_sacree || 0) < 1) return;
    s.inventory.plume_sacree--;
    if (s.birdsMission?.[key]) { s.birdsMission[key].step = 3; s.birdsMission[key].legendEncounter = defaultEncounterState(); }
  } else return;

  _save();
  openKantoMissions();
}

// ── Ouverture du tracker ──────────────────────────────────────────
export function openKantoMissions() {
  _injectStyles();
  const existing = document.getElementById('ktm-overlay');
  if (existing) existing.remove();

  const s = _state();
  if (!s) return;
  const birds = _qBirds();
  const mm    = _qMewtwo();

  const hasAny = Object.values(birds ?? {}).some(b => b?.active)
               || mm?.active;
  if (!hasAny) return;

  const html = _buildTracker();
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const ol = tmp.firstElementChild;
  document.body.appendChild(ol);

  ol.querySelector('#ktm-close')?.addEventListener('click', () => {
    ol.style.animation = 'ktm-fadeout .3s ease both';
    setTimeout(() => ol.remove(), 300);
  });

  ol.addEventListener('click', e => {
    const btn = e.target.closest('[data-ktm]');
    if (!btn) return;
    const action = btn.dataset.ktm;

    for (const bk of ['articuno','zapdos','moltres']) {
      if (action === `rerun-${bk}`) { _doRerun(bk); return; }
    }
    if (action === 'rerun-mewtwo') { _doRerun('mewtwo'); return; }
  });
}

// ── Vérification de déclenchement ────────────────────────────────
export function checkKantoMissionsUnlock() {
  const s = _state();
  if (!s) return;
  const rep = s.gang?.reputation ?? 0;
  let changed = false;

  // Init state if missing
  if (!s.birdsMission) {
    s.birdsMission = {
      articuno: { active:false, step:0, fightsWon:0, bossDefeated:false, owned:false, captures:0 },
      zapdos:   { active:false, step:0, fightsWon:0, bossDefeated:false, owned:false, captures:0 },
      moltres:  { active:false, step:0, fightsWon:0, bossDefeated:false, owned:false, captures:0 },
    };
  }
  if (!s.mewtwoMission) {
    s.mewtwoMission = { active:false, step:0, rocketFightsWon:0, rapportSylphe:0, mansionFightsWon:0, giovanniDefeated:false, mewtwoOwned:false, totalCaptures:0 };
  }

  // Unlock birds individually when their zone becomes accessible
  // Seuils alignés sur les rep requis des zones (zones-data.js) :
  //   zapdos   → power_plant    : rep 700
  //   articuno → seafoam_islands: rep 800
  //   moltres  → victory_road   : rep 950
  const BIRD_THRESHOLDS = { zapdos: 700, articuno: 800, moltres: 950 };
  for (const [key, threshold] of Object.entries(BIRD_THRESHOLDS)) {
    if (rep >= threshold) {
      const b = s.birdsMission[key];
      if (b && !b.active) {
        b.active = true; b.step = 1;
        const bird = BIRDS[key];
        _notify(`${bird.icon} ${_t(`Quête débloquée : ${_birdName(bird)} — explorez ${_zoneLabel(bird)} !`, `Quest unlocked: ${_birdName(bird)} — explore ${_zoneLabel(bird)}!`)}`, 'gold');
        changed = true;
      }
    }
  }

  // Unlock Mewtwo at rep >= 900
  if (rep >= 900 && !s.mewtwoMission.active) {
    s.mewtwoMission.active = true; s.mewtwoMission.step = 1;
    _notify(_t(
      '🧬 Quête débloquée : Mewtwo — Des rapports confidentiels circulent chez Sylphe Co. !',
      '🧬 Quest unlocked: Mewtwo — Confidential reports are circulating at Silph Co.!',
    ), 'gold');
    changed = true;
  }

  if (changed) { _register(); _save(); }
}

// ── Boot ──────────────────────────────────────────────────────────
_register();

globalThis.openKantoMissions               = openKantoMissions;
globalThis.checkKantoMissionsUnlock        = checkKantoMissionsUnlock;
globalThis.getKantoQuestEncounterForZone   = getKantoQuestEncounterForZone;
