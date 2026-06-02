'use strict';

// ════════════════════════════════════════════════════════════════
//  KANTO MISSIONS — Trio des Oiseaux · Mewtwo
//  Quatre quêtes parallèles inspirées de Pokémon Rouge/Bleu/Jaune.
//
//  Trio des Oiseaux (3 étapes chacun, parallèles) :
//    Articuno — seafoam_islands (10 combats) → Lorelei (pwr ≥ 3 000) → Articuno (pwr ≥ 3 500)
//    Zapdos   — power_plant      (10 combats) → Lt. Surge (pwr ≥ 2 800) → Zapdos  (pwr ≥ 3 500)
//    Moltres  — victory_road     (10 combats) → Blaine     (pwr ≥ 2 800) → Moltres  (pwr ≥ 3 500)
//
//  Quête Mewtwo (5 étapes) :
//    1. Vaincre 20 membres Rocket dans les zones Kanto
//    2. Collecter 3 Rapports Sylphe (drop auto depuis silph_co)
//    3. Vaincre 15 combats dans le Manoir Pokémon
//    4. Vaincre Giovanni (puissance ≥ 4 500)
//    5. Affronter Mewtwo dans la Grotte Cerulean (puissance ≥ 6 000)
//
//  Rejouable :
//    1 Plume Sacrée   → relance le combat contre l'un des Oiseaux (déjà capturé)
//    1 Rapport Sylphe → relance le combat contre Mewtwo
//
//  Déclenchement :
//    checkKantoMissionsUnlock()  — au boot
//    openKantoMissions()         — ouvre le tracker
//
//  Dépendances globalThis :
//    state, saveState, makePokemon, calculateStats, getBossTeamPower, switchTab
//  Dépendances bare-name (classic scripts) :
//    (aucune — zones Kanto dans ZONE_BY_ID global)
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });
const _save   = ()               => globalThis.saveState?.();

// ── Sprites ──────────────────────────────────────────────────────
const ARTICUNO_SPRITE = 'https://play.pokemonshowdown.com/sprites/gen5ani/articuno.gif';
const ZAPDOS_SPRITE   = 'https://play.pokemonshowdown.com/sprites/gen5ani/zapdos.gif';
const MOLTRES_SPRITE  = 'https://play.pokemonshowdown.com/sprites/gen5ani/moltres.gif';
const MEWTWO_SPRITE   = 'https://play.pokemonshowdown.com/sprites/gen5ani/mewtwo.gif';
const ARTICUNO_STATIC = 'https://play.pokemonshowdown.com/sprites/gen1/articuno.png';
const ZAPDOS_STATIC   = 'https://play.pokemonshowdown.com/sprites/gen1/zapdos.png';
const MOLTRES_STATIC  = 'https://play.pokemonshowdown.com/sprites/gen1/moltres.png';
const MEWTWO_STATIC   = 'https://play.pokemonshowdown.com/sprites/gen1/mewtwo.png';

// ── Zones de suivi ───────────────────────────────────────────────
const _ROCKET_KANTO = new Set([
  'silph_co', 'pokemon_tower', 'celadon_casino', 'saffron_gym', 'mt_moon',
  'viridian_forest', 'pokemon_mansion', 'ss_anne',
]);
const _BIRD_ZONES = {
  articuno: 'seafoam_islands',
  zapdos:   'power_plant',
  moltres:  'victory_road',
};

// ── Config oiseaux ────────────────────────────────────────────────
const BIRDS = {
  articuno: {
    name: 'Artikodin', species: 'articuno',
    sprite: ARTICUNO_SPRITE, static: ARTICUNO_STATIC,
    accent: '#70b8ff', icon: '❄️',
    zone: 'seafoam_islands', zoneLabel: 'Grottes Ecume',
    boss: { name: 'Lorelei (Olga)', role: 'Conseil des 4 — Glace', team: 'Loktok, Cloyster, Slowbro, Jinx, Lippoutou', power: 3000, key: 'lorelei' },
    power: 3500, catchBase: 0.50, level: 54, pot: 3,
  },
  zapdos: {
    name: 'Électhor', species: 'zapdos',
    sprite: ZAPDOS_SPRITE, static: ZAPDOS_STATIC,
    accent: '#f0d040', icon: '⚡',
    zone: 'power_plant', zoneLabel: 'Centrale Électrique',
    boss: { name: 'Maj. Bob', role: 'Champion Vermilion', team: 'Raichu, Electrode, Electrode, Magneton', power: 2800, key: 'ltsurge' },
    power: 3500, catchBase: 0.50, level: 50, pot: 3,
  },
  moltres: {
    name: 'Sulfura', species: 'moltres',
    sprite: MOLTRES_SPRITE, static: MOLTRES_STATIC,
    accent: '#ff7030', icon: '🔥',
    zone: 'victory_road', zoneLabel: 'Route Victoire',
    boss: { name: 'Capitaine (Pyros)', role: 'Champion Cramois\'île', team: 'Growlithe, Ponyta, Rapidash, Arcanine', power: 2800, key: 'blaine' },
    power: 3500, catchBase: 0.50, level: 50, pot: 3,
  },
};

// ── Helpers ───────────────────────────────────────────────────────
const _state = () => globalThis.state ?? null;
function _qBirds()  { return _state()?.birdsMission  ?? null; }
function _qMewtwo() { return _state()?.mewtwoMission ?? null; }
function _wait(ms)  { return new Promise(r => setTimeout(r, ms)); }

// ── EventBus ──────────────────────────────────────────────────────
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
          _notify(`${bird.icon} Zone maîtrisée ! Affrontez ${bird.boss.name} depuis la quête Oiseaux.`, 'gold');
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
        _notify('🧬 20 membres Rocket vaincus ! Collectez 3 Rapports Sylphe (drop depuis Sylphe Co.).', 'gold');
      }
      dirty = true;
    }
    if (mm.step === 3 && zoneId === 'pokemon_mansion') {
      mm.mansionFightsWon = Math.min((mm.mansionFightsWon || 0) + 1, 15);
      if (mm.mansionFightsWon >= 15) {
        mm.step = 4;
        _notify('🧬 Manoir infiltré ! Localisez Giovanni pour le combat final.', 'gold');
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
      if (mm.rapportSylphe >= 3) {
        mm.step = 3;
        _notify('🧬 3 Rapports Sylphe réunis ! Infiltrez le Manoir Pokémon (15 combats).', 'gold');
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
      { label:`10 combats — ${bird.zoneLabel}`, done: b?.fightsWon >= 10, prog: b?.fightsWon ?? 0, max: 10 },
      { label:`Vaincre ${bird.boss.name}`,       done: b?.bossDefeated ?? false, prog: null, max: null },
      { label:`Affronter ${bird.name}`,           done: owned, prog: null, max: null },
    ];
    const stepsHtml = stepsData.map((st, i) => _renderStep(st, i + 1, step)).join('');

    let actions = '';
    if (active) {
      if (step === 2 && !b.bossDefeated) {
        actions = `<button class="ktm-btn primary" data-ktm="boss-${key}" style="--ktm-accent:${bird.accent}">${bird.icon} Affronter ${bird.boss.name.split(' ')[0]}</button>`;
      } else if (step === 3) {
        actions = `<button class="ktm-btn primary" data-ktm="bird-${key}" style="--ktm-accent:${bird.accent}">${bird.icon} Affronter ${bird.name}</button>`;
      } else if (step === 6 || owned) {
        if (canRerun) {
          actions = `<button class="ktm-btn gold" data-ktm="rerun-${key}">🪶 Relancer (${inv.plume_sacree}× Plume)</button>`;
        } else {
          actions = `<span class="ktm-rerun-note">Plume Sacrée requise pour rejouer</span>`;
        }
      }
    }

    return `
      <div class="ktm-card" style="--ktm-accent:${bird.accent}">
        <div class="ktm-card-label">${bird.icon} Oiseau Légendaire</div>
        <div class="ktm-card-title">${bird.name}</div>
        <div class="ktm-sprite-row">
          <img class="ktm-sprite${owned ? '' : ' grey'}" src="${bird.static}" alt="${bird.name}">
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
    { label:'20 membres Rocket vaincus (Kanto)', done: mm?.rocketFightsWon >= 20, prog: mm?.rocketFightsWon ?? 0, max: 20 },
    { label:'3 Rapports Sylphe collectés',       done: mm?.rapportSylphe >= 3,   prog: mm?.rapportSylphe ?? 0, max: 3 },
    { label:'15 combats — Manoir Pokémon',        done: mm?.mansionFightsWon >= 15, prog: mm?.mansionFightsWon ?? 0, max: 15 },
    { label:'Vaincre Giovanni',                   done: mm?.giovanniDefeated ?? false, prog: null, max: null },
    { label:'Affronter Mewtwo — Grotte Cerulean', done: mOwned, prog: null, max: null },
  ];
  const mewtwoStepsHtml = mewtwoSteps.map((st, i) => _renderStep(st, i + 1, mstep)).join('');

  let mewtwoActions = '';
  if (mm?.active) {
    if (mstep === 4 && !mm.giovanniDefeated) {
      mewtwoActions = `<button class="ktm-btn primary" data-ktm="giovanni" style="--ktm-accent:#cc2222">⚔️ Affronter Giovanni</button>`;
    } else if (mstep === 5) {
      mewtwoActions = `<button class="ktm-btn primary" data-ktm="mewtwo" style="--ktm-accent:#cc2222">🧬 Affronter Mewtwo</button>`;
    } else if (mstep === 6 || mOwned) {
      if (canRerunM) {
        mewtwoActions = `<button class="ktm-btn gold" data-ktm="rerun-mewtwo">📂 Relancer (${inv.rapport_sylphe}× Rapport)</button>`;
      } else {
        mewtwoActions = `<span class="ktm-rerun-note">Rapport Sylphe requis pour rejouer</span>`;
      }
    }
  }

  return `
    <div id="ktm-overlay">
      <span class="ktm-close-btn" id="ktm-close">✕ FERMER</span>
      <div class="ktm-wrap">
        <div class="ktm-header">
          <div class="ktm-header-label">Quêtes Légendaires</div>
          <div class="ktm-header-title">✦ KANTO ✦</div>
        </div>
        <div class="ktm-birds-row">${birdCards}</div>
        <div class="ktm-mewtwo-row">
          <div class="ktm-card" style="--ktm-accent:#cc2222">
            <div class="ktm-card-label">🧬 Mewtwo — Génome Ultime</div>
            <div class="ktm-card-title">Projet Clone</div>
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

// ── Combat Boss (Lorelei / Lt. Surge / Blaine / Giovanni) ─────────
async function _launchBoss(key, birdKey) {
  const s = _state();
  if (!s) return;
  const power = globalThis.getBossTeamPower?.() ?? 0;

  let cfg;
  if (birdKey) {
    const bird = BIRDS[birdKey];
    if (!bird) return;
    cfg = { ...bird.boss, accent: bird.accent, icon: bird.icon, birdKey };
  } else if (key === 'giovanni') {
    cfg = {
      name: 'Giovanni', role: 'Chef de la Team Rocket',
      team: 'Bagon, Nidoqueen, Nidoking, Rhyhorn, Dugtrio',
      power: 4500, accent: '#cc2222', icon: '💼', key: 'giovanni',
      winMsg: 'Giovanni est vaincu et s\'enfuit. Les coordonnées de la Grotte Cerulean sont maintenant connues.',
      winFn: () => { const mm = _qMewtwo(); if(mm){ mm.giovanniDefeated = true; mm.step = 5; } },
    };
  } else return;

  if (birdKey && !cfg.winMsg) {
    const bird = BIRDS[birdKey];
    cfg.winMsg = `${bird.boss.name} est vaincu. La route vers ${bird.name} est ouverte.`;
    cfg.winFn  = () => {
      const b = _qBirds()?.[birdKey];
      if (b) { b.bossDefeated = true; b.step = 3; }
    };
  }

  const enough = power >= cfg.power;

  const ol = document.getElementById('ktm-overlay');
  if (!ol) return;

  const div = document.createElement('div');
  div.className = 'ktm-fight-modal';
  div.innerHTML = `
    <div class="ktm-fight-box" style="--ktm-accent:${cfg.accent}">
      <div class="ktm-fight-title">${cfg.icon} ${cfg.name} — ${cfg.role}</div>
      <div class="ktm-fight-text">${cfg.team}</div>
      <div class="ktm-power-row">
        <div class="ktm-power-chip">👊 Votre puissance : ${power.toLocaleString()}</div>
        <div class="ktm-power-chip" style="${enough?'color:#90ee90':'color:#ff8080'}">🎯 Requis : ${cfg.power.toLocaleString()}</div>
      </div>
      <div id="ktm-boss-result"></div>
      <div class="ktm-actions">
        ${enough
          ? `<button class="ktm-btn primary" id="ktm-boss-go">⚔️ Combattre</button>`
          : `<span style="font-family:var(--font-pixel,monospace);font-size:7.5px;color:#ff8080">Puissance insuffisante (${cfg.power - power} manquants)</span>`
        }
        <button class="ktm-btn" id="ktm-boss-cancel">Annuler</button>
      </div>
    </div>`;

  ol.style.position = 'relative';
  ol.appendChild(div);
  div.querySelector('#ktm-boss-cancel')?.addEventListener('click', () => div.remove());

  const goBtn = div.querySelector('#ktm-boss-go');
  if (goBtn) {
    goBtn.addEventListener('click', async () => {
      goBtn.disabled = true;
      const resEl = div.querySelector('#ktm-boss-result');
      resEl.innerHTML = `<div class="ktm-result-banner" style="color:${cfg.accent}">⚔️ Combat en cours…</div>`;
      await _wait(900);
      cfg.winFn();
      _save();
      resEl.innerHTML = `<div class="ktm-result-banner" style="color:#90ee90">✓ Victoire !</div>
        <div style="font-family:var(--font-pixel,monospace);font-size:7.5px;color:#b0c0e0;line-height:2;margin-top:6px">${cfg.winMsg}</div>`;
      await _wait(2000);
      div.remove();
      openKantoMissions();
    });
  }
}

// ── Combat Légendaire ─────────────────────────────────────────────
async function _launchLegendary(key) {
  const s = _state();
  if (!s) return;
  const power = globalThis.getBossTeamPower?.() ?? 0;

  let cfg;
  if (key in BIRDS) {
    const bird = BIRDS[key];
    cfg = {
      name: bird.name, species: bird.species,
      sprite: bird.static, accent: bird.accent, icon: bird.icon,
      power: bird.power, catchBase: bird.catchBase,
      level: bird.level, pot: bird.pot,
      winFn: () => {
        const b = _qBirds()?.[key];
        if (b) { b.owned = true; b.step = 6; }
      },
      captureKey: key,   // for totalCaptures increment
    };
  } else if (key === 'mewtwo') {
    cfg = {
      name: 'Mewtwo', species: 'mewtwo',
      sprite: MEWTWO_STATIC, accent: '#cc2222', icon: '🧬',
      power: 6000, catchBase: 0.30, level: 70, pot: 5,
      winFn: () => {
        const mm = _qMewtwo();
        if (mm) { mm.mewtwoOwned = true; mm.step = 6; }
      },
      captureKey: 'mewtwo',
    };
  } else return;

  const enough = power >= cfg.power;
  const ol = document.getElementById('ktm-overlay');
  if (!ol) return;

  const div = document.createElement('div');
  div.className = 'ktm-fight-modal';
  div.innerHTML = `
    <div class="ktm-fight-box" style="--ktm-accent:${cfg.accent}">
      <div class="ktm-fight-title">${cfg.icon} ${cfg.name} — Lv.${cfg.level}</div>
      <div class="ktm-sprite-row" style="margin-bottom:10px">
        <img src="${cfg.sprite}" style="height:64px;image-rendering:pixelated" alt="${cfg.name}">
      </div>
      <div class="ktm-power-row">
        <div class="ktm-power-chip">👊 Votre puissance : ${power.toLocaleString()}</div>
        <div class="ktm-power-chip" style="${enough?'color:#90ee90':'color:#ff8080'}">🎯 Requis : ${cfg.power.toLocaleString()}</div>
      </div>
      <div id="ktm-leg-result"></div>
      <div class="ktm-actions">
        ${enough
          ? `<button class="ktm-btn primary" id="ktm-leg-go">⚔️ Affronter ${cfg.name}</button>`
          : `<span style="font-family:var(--font-pixel,monospace);font-size:7.5px;color:#ff8080">Puissance insuffisante (${cfg.power - power} manquants)</span>`
        }
        <button class="ktm-btn" id="ktm-leg-cancel">Annuler</button>
      </div>
    </div>`;

  ol.style.position = 'relative';
  ol.appendChild(div);
  div.querySelector('#ktm-leg-cancel')?.addEventListener('click', () => div.remove());

  const goBtn = div.querySelector('#ktm-leg-go');
  if (goBtn) {
    goBtn.addEventListener('click', async () => {
      goBtn.disabled = true;
      const resEl = div.querySelector('#ktm-leg-result');
      resEl.innerHTML = `<div class="ktm-result-banner" style="color:${cfg.accent}">⚔️ Combat légendaire…</div>`;
      await _wait(1200);

      const powerRatio = power / cfg.power;
      const catchRate  = Math.min(cfg.catchBase + Math.max(0, powerRatio - 1) * 0.25, 0.92);
      const caught     = Math.random() < catchRate;

      cfg.winFn();

      if (caught) {
        const pk = globalThis.makePokemon?.({
          species_en: cfg.species,
          level:      cfg.level,
          potential:  cfg.pot,
          shiny:      false,
          source:     'legendary_quest',
        });
        if (pk) {
          s.pokemons.push(pk);
          if (!s.pokedex[cfg.species]) s.pokedex[cfg.species] = {};
          s.pokedex[cfg.species].caught = true;
          // totalCaptures
          const mKey = cfg.captureKey === 'mewtwo' ? 'mewtwoMission' : null;
          const bKey = cfg.captureKey !== 'mewtwo' ? cfg.captureKey : null;
          if (mKey && s[mKey]) s[mKey].totalCaptures = (s[mKey].totalCaptures || 0) + 1;
          if (bKey && s.birdsMission?.[bKey]) s.birdsMission[bKey].captures = (s.birdsMission[bKey].captures || 0) + 1;
          resEl.innerHTML = `<div class="ktm-result-banner" style="color:#90ee90">✨ ${cfg.name} capturé !</div>
            <div style="font-family:var(--font-pixel,monospace);font-size:7.5px;color:#b0c0e0;line-height:2;margin-top:6px">
              ${cfg.name} Lv.${cfg.level} ajouté au PC — Pot.${cfg.pot} ★
            </div>`;
        }
      } else {
        resEl.innerHTML = `<div class="ktm-result-banner" style="color:#e8d040">⚡ ${cfg.name} s'échappe !</div>
          <div style="font-family:var(--font-pixel,monospace);font-size:7.5px;color:#888;line-height:2;margin-top:6px">
            Taux de capture : ${Math.round(catchRate * 100)}%. Utilisez une Plume Sacrée pour réessayer.
          </div>`;
      }

      _save();
      await _wait(2500);
      div.remove();
      openKantoMissions();
    });
  }
}

// ── Relances ──────────────────────────────────────────────────────
function _doRerun(key) {
  const s = _state();
  if (!s) return;

  if (key === 'mewtwo') {
    if ((s.inventory.rapport_sylphe || 0) < 1) return;
    s.inventory.rapport_sylphe--;
    if (s.mewtwoMission) s.mewtwoMission.step = 5;
  } else if (key in BIRDS) {
    if ((s.inventory.plume_sacree || 0) < 1) return;
    s.inventory.plume_sacree--;
    if (s.birdsMission?.[key]) s.birdsMission[key].step = 3;
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

    // Boss fights for birds
    for (const bk of ['articuno','zapdos','moltres']) {
      if (action === `boss-${bk}`) { _launchBoss(null, bk); return; }
      if (action === `bird-${bk}`) { _launchLegendary(bk); return; }
      if (action === `rerun-${bk}`) { _doRerun(bk); return; }
    }
    // Mewtwo
    if (action === 'giovanni')     { _launchBoss('giovanni', null); return; }
    if (action === 'mewtwo')       { _launchLegendary('mewtwo'); return; }
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
        _notify(`${bird.icon} Quête débloquée : ${bird.name} — explorez ${bird.zoneLabel} !`, 'gold');
        changed = true;
      }
    }
  }

  // Unlock Mewtwo at rep >= 900
  if (rep >= 900 && !s.mewtwoMission.active) {
    s.mewtwoMission.active = true; s.mewtwoMission.step = 1;
    _notify("🧬 Quête débloquée : Mewtwo — Des rapports confidentiels circulent chez Sylphe Co. !", 'gold');
    changed = true;
  }

  if (changed) { _register(); _save(); }
}

// ── Boot ──────────────────────────────────────────────────────────
_register();

globalThis.openKantoMissions        = openKantoMissions;
globalThis.checkKantoMissionsUnlock = checkKantoMissionsUnlock;
