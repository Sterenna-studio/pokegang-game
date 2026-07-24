'use strict';

// ════════════════════════════════════════════════════════════════
//  SINNOH MISSIONS — Team Galaxie · Dialga/Palkia · Giratina · Trio du Lac
//  Trois quêtes parallèles inspirées de Pokémon Diamant/Perle/Platine.
//
//  Quête Galaxie (6 étapes) :
//    1. Vaincre 20 Sbires Galaxie (galactic_hq, mt_coronet, veilstone_gym…)
//    2. Vaincre Mars ET Jupiter (power ≥ 5 000 chacun)
//    3. Vaincre 12 combats au Pilier Axial (spear_pillar)
//    4. Vaincre Cyrus (power ≥ 6 500)
//    5. Choisir Dialga ou Palkia — combat légendaire (power ≥ 7 500)
//
//  Quête Giratina (4 étapes, disponible après avoir vaincu Cyrus) :
//    1. Vaincre 10 combats dans Grotte Retour (turnback_cave)
//    2. Vaincre Saturne (power ≥ 5 500)
//    3. Affronter Giratina dans Source de l'Envol (power ≥ 8 000)
//
//  Quête Trio du Lac (2 étapes × 3, parallèles) :
//    Uxie / Mesprit / Azelf — Rives du Lac (8 combats) → légendaire (power ≥ 4 000)
//
//  Rejouable :
//    1 Fragment Temporel → relance Dialga ou Palkia (déjà capturé)
//    1 Onde Distorsion   → relance Giratina
//    1 Cristal du Lac    → relance un légendaire du Lac
//
//  Déclenchement :
//    checkSinnohMissionsUnlock() — au boot + après victoire à la Ligue Sinnoh
//    openSinnohMissions()        — ouvre le tracker
//
//  Dépendances globalThis :
//    state, saveState, makePokemon, calculateStats, getBossTeamPower, switchTab
//  Dépendances bare-name (classic scripts) :
//    (aucune — zones Sinnoh dans ZONE_BY_ID global après activation)
// ════════════════════════════════════════════════════════════════

import { EventBus, EVENTS } from '../core/eventBus.js';
import { resolveSpecialCombat } from './specialCombat.js';
import { MISSION_REWARD_SHINY_RATE } from '../../data/gameplay-config-data.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });
const _save   = ()               => globalThis.saveState?.();

// ── Sprites ──────────────────────────────────────────────────────
const DIALGA_SPRITE   = 'https://play.pokemonshowdown.com/sprites/gen5ani/dialga.gif';
const PALKIA_SPRITE   = 'https://play.pokemonshowdown.com/sprites/gen5ani/palkia.gif';
const GIRATINA_SPRITE = 'https://play.pokemonshowdown.com/sprites/gen5ani/giratina-origin.gif';
const UXIE_SPRITE     = 'https://play.pokemonshowdown.com/sprites/gen5ani/uxie.gif';
const MESPRIT_SPRITE  = 'https://play.pokemonshowdown.com/sprites/gen5ani/mesprit.gif';
const AZELF_SPRITE    = 'https://play.pokemonshowdown.com/sprites/gen5ani/azelf.gif';
const DIALGA_STATIC   = 'https://play.pokemonshowdown.com/sprites/gen4/dialga.png';
const PALKIA_STATIC   = 'https://play.pokemonshowdown.com/sprites/gen4/palkia.png';
const GIRATINA_STATIC = 'https://play.pokemonshowdown.com/sprites/gen4/giratina-origin.png';
const UXIE_STATIC     = 'https://play.pokemonshowdown.com/sprites/gen4/uxie.png';
const MESPRIT_STATIC  = 'https://play.pokemonshowdown.com/sprites/gen4/mesprit.png';
const AZELF_STATIC    = 'https://play.pokemonshowdown.com/sprites/gen4/azelf.png';

// ── Zones de suivi ────────────────────────────────────────────────
const _GALACTIC_ZONES = new Set([
  'galactic_hq', 'mt_coronet_base', 'mt_coronet_peak', 'eterna_gym',
  'veilstone_gym', 'spear_pillar', 'sunyshore_gym', 'pokemon_league_sinnoh',
]);
const _SPEAR_ZONES    = new Set(['spear_pillar', 'mt_coronet_peak']);
const _TURNBACK_ZONES = new Set(['turnback_cave', 'sendoff_spring']);
const _LAKE_ZONES     = new Set(['lake_trio_shores', 'route211_215', 'solaceon_ruins']);

// ── Config Trio du Lac ─────────────────────────────────────────────
const LAKES = {
  uxie: {
    name: 'Uxie', species: 'uxie',
    sprite: UXIE_SPRITE, static: UXIE_STATIC,
    accent: '#f0d040', icon: '💛',
    power: 4000, catchBase: 0.45, level: 50, pot: 2,
  },
  mesprit: {
    name: 'Mesprit', species: 'mesprit',
    sprite: MESPRIT_SPRITE, static: MESPRIT_STATIC,
    accent: '#ff80b0', icon: '🩷',
    power: 4000, catchBase: 0.45, level: 50, pot: 2,
  },
  azelf: {
    name: 'Azelf', species: 'azelf',
    sprite: AZELF_SPRITE, static: AZELF_STATIC,
    accent: '#6080ff', icon: '💙',
    power: 4000, catchBase: 0.45, level: 50, pot: 2,
  },
};

// ── State accessor ────────────────────────────────────────────────
const _state = () => globalThis.state ?? null;

// ── Helpers ───────────────────────────────────────────────────────
function _power() { return globalThis.getBossTeamPower?.() ?? 0; }

function _ownedCount(species) {
  const s = _state();
  if (!s) return 0;
  return (s.pokemons || []).filter(p => p.species_en === species).length;
}

// ── Capture légendaire ───────────────────────────────────────────────────────
function _captureLegend(species, level, catchBase, pot, missionKey, ownedField) {
  const s = _state();
  if (!s) return;
  const power = _power();
  const powerRatio = power / 4000;
  const catchRate  = Math.min(0.92, catchBase + Math.max(0, powerRatio - 1) * 0.25);
  if (Math.random() > catchRate) {
    _notify('❌ Échec de la capture — réessayez !', 'error');
    return;
  }
  const pk = globalThis.makePokemon?.(species, null, 'pokeball');
  if (!pk) return;
  pk.level     = level;
  pk.shiny     = Math.random() < MISSION_REWARD_SHINY_RATE;
  pk.potential = pot;
  if (globalThis.calculateStats) pk.stats = globalThis.calculateStats(pk);
  if (!s.pokemons) s.pokemons = [];
  s.pokemons.push(pk);
  EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: pk, zoneId: null });
  globalThis.registerPokedexCapture?.(s, pk);
  if (missionKey && ownedField && s[missionKey]) {
    s[missionKey][ownedField] = true;
    s[missionKey].totalCaptures = (s[missionKey].totalCaptures ?? 0) + 1;
  }
  _notify(`✅ ${species.charAt(0).toUpperCase() + species.slice(1)} capturé${pk.shiny ? ' ✨ SHINY !' : ' !'}`, 'success');
  _save();
  setTimeout(() => openSinnohMissions(), 400);
}

function _captureLakeLegend(key) {
  const s = _state();
  if (!s || !s.lakeMission?.[key]) return;
  const cfg   = LAKES[key];
  const power = _power();
  if (power < cfg.power) {
    _notify(`⚠️ Puissance insuffisante — il faut ≥ ${cfg.power.toLocaleString()} !`, 'error');
    return;
  }
  const powerRatio = power / cfg.power;
  const catchRate  = Math.min(0.92, cfg.catchBase + Math.max(0, powerRatio - 1) * 0.25);
  if (Math.random() > catchRate) {
    _notify('❌ Échec de la capture — réessayez !', 'error');
    return;
  }
  const pk = globalThis.makePokemon?.(cfg.species, null, 'pokeball');
  if (!pk) return;
  pk.level     = cfg.level;
  pk.shiny     = Math.random() < MISSION_REWARD_SHINY_RATE;
  pk.potential = cfg.pot;
  if (globalThis.calculateStats) pk.stats = globalThis.calculateStats(pk);
  if (!s.pokemons) s.pokemons = [];
  s.pokemons.push(pk);
  EventBus.emit(EVENTS.POKEMON_CAPTURED, { pokemon: pk, zoneId: null });
  globalThis.registerPokedexCapture?.(s, pk);
  s.lakeMission[key].owned    = true;
  s.lakeMission[key].captures = (s.lakeMission[key].captures ?? 0) + 1;
  s.lakeMission[key].step     = 3; // done
  _notify(`✅ ${cfg.name} capturé${pk.shiny ? ' ✨ SHINY !' : ' !'}`, 'success');
  _save();
  setTimeout(() => openSinnohMissions(), 400);
}

// ── Boss fight modals ─────────────────────────────────────────────
function _launchBoss(trainerKey, afterFn) {
  const power = _power();
  const configs = {
    mars:       { name: 'Mars', team: 'Golbat, Bronzor, Purugly', required: 5000, role: 'Commandante Team Galaxie', trainerKey: 'mars' },
    jupiter:    { name: 'Jupiter', team: 'Golbat, Bronzor, Skuntank', required: 5000, role: 'Commandante Team Galaxie', trainerKey: 'jupiter' },
    saturn:     { name: 'Saturne', team: 'Golbat, Bronzor, Toxicroak', required: 5500, role: 'Commandant Team Galaxie', trainerKey: 'saturn' },
    cyrus:      { name: 'Cyrus', team: 'Sneasel, Golbat, Honchkrow, Gyarados, Crobat, Weavile', required: 6500, role: 'Chef Team Galaxie', trainerKey: 'cyrus' },
  };
  const cfg = configs[trainerKey];
  if (!cfg) return;
  if (power < cfg.required) {
    _notify(`⚠️ Puissance insuffisante — il faut ≥ ${cfg.required.toLocaleString()} !`, 'error');
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'snm-boss-modal';
  overlay.className = 'snm-modal-overlay';
  overlay.innerHTML = `
    <div class="snm-modal snm-boss-modal">
      <div class="snm-modal-header">
        <span class="snm-modal-title">⚔️ Combat — ${cfg.name}</span>
        <button class="snm-modal-close" data-action="close">✕</button>
      </div>
      <div class="snm-boss-card">
        <img class="snm-boss-sprite" src="https://play.pokemonshowdown.com/sprites/trainers/${cfg.trainerKey}.png"
             alt="${cfg.name}" onerror="this.style.display='none'">
        <div class="snm-boss-info">
          <div class="snm-boss-name">${cfg.name}</div>
          <div class="snm-boss-role">${cfg.role}</div>
          <div class="snm-boss-team">${cfg.team}</div>
        </div>
      </div>
      <div class="snm-power-bar">
        <span class="snm-power-label">Votre puissance</span>
        <span class="snm-power-value ${power >= cfg.required ? 'snm-ok' : 'snm-warn'}">${power.toLocaleString()}</span>
        <span class="snm-power-label">/ ${cfg.required.toLocaleString()} requis</span>
      </div>
      <div class="snm-modal-actions">
        <button class="snm-btn snm-btn-primary" data-action="fight">⚔️ Combattre</button>
        <button class="snm-btn snm-btn-ghost" data-action="close">Annuler</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') { overlay.remove(); return; }
    if (action === 'fight') {
      overlay.remove();
      const { win } = resolveSpecialCombat({ power, requiredPower: cfg.required });
      if (!win) { _notify(`❌ Défaite contre ${cfg.name} — renforcez votre équipe !`, 'error'); return; }
      _notify(`🏆 ${cfg.name} vaincu !`, 'success');
      afterFn?.();
    }
  });
}

function _launchLegend(species, spriteSrc, staticSrc, powerReq, catchBase, level, pot, missionKey, ownedField) {
  const power = _power();
  if (power < powerReq) {
    _notify(`⚠️ Puissance insuffisante — il faut ≥ ${powerReq.toLocaleString()} !`, 'error');
    return;
  }
  const name = species.charAt(0).toUpperCase() + species.slice(1);

  const overlay = document.createElement('div');
  overlay.id = 'snm-legend-modal';
  overlay.className = 'snm-modal-overlay';
  overlay.innerHTML = `
    <div class="snm-modal snm-legend-modal">
      <div class="snm-modal-header">
        <span class="snm-modal-title">⚡ Légendaire — ${name}</span>
        <button class="snm-modal-close" data-action="close">✕</button>
      </div>
      <div class="snm-legend-portrait">
        <img class="snm-legend-gif" src="${spriteSrc}" alt="${name}"
             onerror="this.src='${staticSrc}';this.onerror=null">
      </div>
      <div class="snm-power-bar">
        <span class="snm-power-label">Puissance</span>
        <span class="snm-power-value ${power >= powerReq ? 'snm-ok' : 'snm-warn'}">${power.toLocaleString()}</span>
        <span class="snm-power-label">/ ${powerReq.toLocaleString()} requis</span>
      </div>
      <div class="snm-modal-actions">
        <button class="snm-btn snm-btn-primary" data-action="catch">⚡ Capturer</button>
        <button class="snm-btn snm-btn-ghost" data-action="close">Annuler</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') { overlay.remove(); return; }
    if (action === 'catch') {
      overlay.remove();
      _captureLegend(species, level, catchBase, pot, missionKey, ownedField);
    }
  });
}

// ── Chooser Dialga / Palkia ──────────────────────────────────────────────────
function _showLegendChooser() {
  const s = _state();
  if (!s) return;

  const choices = [
    {
      key: 'dialga',
      name: 'Dialga',
      sprite: DIALGA_SPRITE,
      static: DIALGA_STATIC,
      accent: '#4060d0',
      icon: '💎',
      desc: 'Maître du Temps — son rugissement fait vibrer le passé et le futur.',
      catchBase: 0.45,
      level: 70,
    },
    {
      key: 'palkia',
      name: 'Palkia',
      sprite: PALKIA_SPRITE,
      static: PALKIA_STATIC,
      accent: '#c050a0',
      icon: '🌀',
      desc: 'Maître de l\'Espace — il distord les dimensions à sa guise.',
      catchBase: 0.45,
      level: 70,
    },
  ];

  const overlay = document.createElement('div');
  overlay.id = 'snm-chooser-modal';
  overlay.className = 'snm-modal-overlay';
  overlay.innerHTML = `
    <div class="snm-modal snm-chooser-modal">
      <div class="snm-modal-header">
        <span class="snm-modal-title">🌌 Choisissez votre légendaire</span>
      </div>
      <p class="snm-chooser-sub">Au Pilier Axial, deux portes s'ouvrent. Laquelle franchissez-vous ?</p>
      <div class="snm-chooser-grid">
        ${choices.map(c => `
          <div class="snm-chooser-card" data-key="${c.key}" style="--accent:${c.accent}">
            <img class="snm-chooser-gif" src="${c.sprite}" alt="${c.name}"
                 onerror="this.src='${c.static}';this.onerror=null">
            <div class="snm-chooser-name">${c.icon} ${c.name}</div>
            <div class="snm-chooser-desc">${c.desc}</div>
            <button class="snm-btn snm-btn-accent" data-action="choose" data-key="${c.key}">
              Choisir ${c.name}
            </button>
          </div>`).join('')}
      </div>
      <button class="snm-btn snm-btn-ghost snm-chooser-cancel" data-action="close">Annuler</button>
    </div>`;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    const key    = e.target.closest('[data-key]')?.dataset.key;
    if (action === 'close') { overlay.remove(); return; }
    if (action === 'choose' && key) {
      overlay.remove();
      const s2 = _state();
      if (!s2 || !s2.galaxieMission) return;
      s2.galaxieMission.chosenLegend = key;
      _save();
      const cfg = choices.find(c => c.key === key);
      _launchLegend(
        cfg.key, cfg.sprite, cfg.static, 7500, cfg.catchBase, cfg.level, 3,
        'galaxieMission', 'legendOwned'
      );
    }
  });
}

// ── Re-run (rejeu) ─────────────────────────────────────────────────────────────
function _doGalaxieRerun() {
  const s = _state();
  if (!s || !s.galaxieMission?.legendOwned) return;
  if (!s.inventory.fragment_temporel || s.inventory.fragment_temporel < 1) {
    _notify('⚠️ Aucun Fragment Temporel en inventaire.', 'error');
    return;
  }
  s.inventory.fragment_temporel--;
  const chosen = s.galaxieMission.chosenLegend ?? 'dialga';
  const sprite  = chosen === 'dialga' ? DIALGA_SPRITE : PALKIA_SPRITE;
  const staticS = chosen === 'dialga' ? DIALGA_STATIC : PALKIA_STATIC;
  _save();
  _launchLegend(chosen, sprite, staticS, 7500, 0.45, 70, 3, 'galaxieMission', 'legendOwned');
}

function _doGiratinaRerun() {
  const s = _state();
  if (!s || !s.giratinaMission?.giratinaOwned) return;
  if (!s.inventory.onde_distorsion || s.inventory.onde_distorsion < 1) {
    _notify('⚠️ Aucune Onde Distorsion en inventaire.', 'error');
    return;
  }
  s.inventory.onde_distorsion--;
  _save();
  _launchLegend('giratina-origin', GIRATINA_SPRITE, GIRATINA_STATIC, 8000, 0.42, 70, 3, 'giratinaMission', 'giratinaOwned');
}

function _doLakeRerun(key) {
  const s = _state();
  if (!s || !s.lakeMission?.[key]?.owned) return;
  if (!s.inventory.cristal_lac || s.inventory.cristal_lac < 1) {
    _notify('⚠️ Aucun Cristal du Lac en inventaire.', 'error');
    return;
  }
  s.inventory.cristal_lac--;
  _save();
  const cfg = LAKES[key];
  _launchLegend(cfg.species, cfg.sprite, cfg.static, cfg.power, cfg.catchBase, cfg.level, cfg.pot, null, null);
}

// ── Tracker buttons (zoneWindows regionSwitcher) ─────────────────────────────
function _renderTrackerBtn() {
  const s = _state();
  if (!s?.purchases?.sinnohUnlocked) return '';
  const gx  = s.galaxieMission;
  const gt  = s.giratinaMission;
  const lk  = s.lakeMission;
  if (!gx?.active && !gt?.active && !lk?.uxie?.active) return '';

  const gxLabel  = gx?.active  ? `🌌${gx.step}/5` : '';
  const gtLabel  = gt?.active  ? `👁️${gt.step}/3` : '';
  const lkActive = lk ? ['uxie','mesprit','azelf'].filter(k => lk[k]?.active) : [];
  const lkLabel  = lkActive.length ? `${lkActive.map(k => LAKES[k].icon).join('')}` : '';

  const parts = [gxLabel, gtLabel, lkLabel].filter(Boolean).join(' ');
  return `<button class="zone-region-btn snm-quest-btn" data-snm-open="true" title="Quêtes Sinnoh">${parts}</button>`;
}

// ── Render principal ─────────────────────────────────────────────────────────
function openSinnohMissions() {
  const s = _state();
  if (!s) return;
  if (document.getElementById('snm-modal')) document.getElementById('snm-modal').remove();

  const gx = s.galaxieMission   ?? {};
  const gt = s.giratinaMission  ?? {};
  const lk = s.lakeMission      ?? {};

  function _progress(val, max, label) {
    const pct = Math.min(100, (val / max) * 100);
    return `<div class="snm-prog-row">
      <span class="snm-prog-label">${label}</span>
      <div class="snm-prog-bar"><div class="snm-prog-fill" style="width:${pct}%"></div></div>
      <span class="snm-prog-val">${val}/${max}</span>
    </div>`;
  }

  function _galaxieStepHtml() {
    if (!gx.active) return `<div class="snm-inactive">Victoire à la Ligue Sinnoh requise (Rép ≥ 4 500)</div>`;
    const step = gx.step ?? 1;
    const rows = [];
    rows.push(_progress(gx.galacticFightsWon ?? 0, 20, '1. Sbires Galaxie vaincus'));
    rows.push(`<div class="snm-step-row ${step >= 2 ? 'snm-active' : ''}">
      2. Commandantes — Mars ${gx.marsDefeated ? '✅' : '⬜'} · Jupiter ${gx.jupiterDefeated ? '✅' : '⬜'}
      ${step === 2 ? `<div class="snm-step-btns">
        ${!gx.marsDefeated     ? `<button class="snm-btn snm-btn-sm" data-action="boss-mars">⚔️ Mars</button>` : ''}
        ${!gx.jupiterDefeated  ? `<button class="snm-btn snm-btn-sm" data-action="boss-jupiter">⚔️ Jupiter</button>` : ''}
      </div>` : ''}</div>`);
    rows.push(_progress(gx.spearFightsWon ?? 0, 12, '3. Combats au Pilier Axial'));
    rows.push(`<div class="snm-step-row ${step >= 4 ? 'snm-active' : ''}">
      4. Cyrus ${gx.cyrusDefeated ? '✅' : '⬜'}
      ${step === 4 ? `<button class="snm-btn snm-btn-sm" data-action="boss-cyrus">⚔️ Cyrus</button>` : ''}
    </div>`);
    rows.push(`<div class="snm-step-row ${step >= 5 ? 'snm-active' : ''}">
      5. Légendaire ${gx.legendOwned ? `✅ ${gx.chosenLegend ?? '?'}` : gx.chosenLegend ? `⬜ ${gx.chosenLegend}` : '⬜'}
      ${step === 5 && !gx.chosenLegend ? `<button class="snm-btn snm-btn-sm" data-action="choose-legend">🌌 Choisir</button>` : ''}
      ${step === 5 && gx.chosenLegend && !gx.legendOwned ? `<button class="snm-btn snm-btn-sm" data-action="legend-fight">⚡ Capturer</button>` : ''}
      ${gx.legendOwned ? `<button class="snm-btn snm-btn-sm snm-rerun" data-action="rerun-galaxie">💎 Rejouer</button>` : ''}
    </div>`);
    return rows.join('');
  }

  function _giratinaStepHtml() {
    if (!gt.active) {
      return `<div class="snm-inactive">Déblocable après avoir vaincu Cyrus (quête Galaxie)</div>`;
    }
    const step = gt.step ?? 1;
    const rows = [];
    rows.push(_progress(gt.turnbackFightsWon ?? 0, 10, '1. Combats Grotte Retour'));
    rows.push(`<div class="snm-step-row ${step >= 2 ? 'snm-active' : ''}">
      2. Saturne ${gt.saturnDefeated ? '✅' : '⬜'}
      ${step === 2 ? `<button class="snm-btn snm-btn-sm" data-action="boss-saturn">⚔️ Saturne</button>` : ''}
    </div>`);
    rows.push(`<div class="snm-step-row ${step >= 3 ? 'snm-active' : ''}">
      3. Giratina ${gt.giratinaOwned ? '✅' : '⬜'}
      ${step === 3 && !gt.giratinaOwned ? `<button class="snm-btn snm-btn-sm" data-action="legend-giratina">⚡ Capturer</button>` : ''}
      ${gt.giratinaOwned ? `<button class="snm-btn snm-btn-sm snm-rerun" data-action="rerun-giratina">👁️ Rejouer</button>` : ''}
    </div>`);
    return rows.join('');
  }

  function _lakeCardHtml(key) {
    const m   = lk[key] ?? {};
    const cfg = LAKES[key];
    if (!m.active) return `<div class="snm-lake-card snm-inactive-card">
      <div class="snm-lake-icon">${cfg.icon}</div>
      <div class="snm-lake-name">${cfg.name}</div>
      <div class="snm-lake-status">Pas encore débloqué</div>
    </div>`;
    const step = m.step ?? 1;
    return `<div class="snm-lake-card" style="--accent:${cfg.accent}">
      <img class="snm-lake-gif" src="${cfg.static}" alt="${cfg.name}">
      <div class="snm-lake-name">${cfg.icon} ${cfg.name}</div>
      ${_progress(m.fightsWon ?? 0, 8, 'Combats au Lac')}
      <div class="snm-step-row ${step >= 2 ? 'snm-active' : ''}">
        ${m.owned ? '✅ Capturé' : '⬜ Non capturé'}
        ${step === 2 && !m.owned ? `<button class="snm-btn snm-btn-sm" data-action="legend-lake-${key}">⚡ Capturer</button>` : ''}
        ${m.owned ? `<button class="snm-btn snm-btn-sm snm-rerun" data-action="rerun-lake-${key}">💙 Rejouer</button>` : ''}
      </div>
    </div>`;
  }

  const modal = document.createElement('div');
  modal.id = 'snm-modal';
  modal.className = 'snm-overlay';
  modal.innerHTML = `
    <div class="snm-panel">
      <div class="snm-header">
        <span class="snm-title">🌌 Quêtes Sinnoh — Légendaires</span>
        <button class="snm-close" data-action="close">✕</button>
      </div>

      <!-- Quête Galaxie -->
      <section class="snm-section">
        <div class="snm-section-title">
          <span class="snm-sec-icon">💎🌀</span>
          <span>Quête Galaxie — Dialga & Palkia</span>
          ${gx.active ? `<span class="snm-badge snm-badge-step">Étape ${gx.step ?? 1}/5</span>` : ''}
          ${gx.legendOwned ? '<span class="snm-badge snm-badge-done">✅ COMPLÈTE</span>' : ''}
        </div>
        <div class="snm-steps">${_galaxieStepHtml()}</div>
      </section>

      <!-- Quête Giratina -->
      <section class="snm-section">
        <div class="snm-section-title">
          <span class="snm-sec-icon">👁️</span>
          <span>Quête Distorsion — Giratina</span>
          ${gt.active ? `<span class="snm-badge snm-badge-step">Étape ${gt.step ?? 1}/3</span>` : ''}
          ${gt.giratinaOwned ? '<span class="snm-badge snm-badge-done">✅ COMPLÈTE</span>' : ''}
        </div>
        <div class="snm-steps">${_giratinaStepHtml()}</div>
      </section>

      <!-- Trio du Lac -->
      <section class="snm-section">
        <div class="snm-section-title">
          <span class="snm-sec-icon">💛🩷💙</span>
          <span>Trio du Lac</span>
        </div>
        <div class="snm-lake-grid">
          ${_lakeCardHtml('uxie')}
          ${_lakeCardHtml('mesprit')}
          ${_lakeCardHtml('azelf')}
        </div>
      </section>

      ${_infoBarHtml(s)}
    </div>`;

  document.body.appendChild(modal);
  _injectCss();

  modal.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'close') { modal.remove(); return; }
    if (action === 'boss-mars')     { modal.remove(); _launchBoss('mars', () => { _onBossWin('mars'); }); return; }
    if (action === 'boss-jupiter')  { modal.remove(); _launchBoss('jupiter', () => { _onBossWin('jupiter'); }); return; }
    if (action === 'boss-saturn')   { modal.remove(); _launchBoss('saturn', () => { _onBossWin('saturn'); }); return; }
    if (action === 'boss-cyrus')    { modal.remove(); _launchBoss('cyrus', () => { _onBossWin('cyrus'); }); return; }
    if (action === 'choose-legend') { modal.remove(); _showLegendChooser(); return; }
    if (action === 'legend-fight') {
      modal.remove();
      const s2 = _state();
      const chosen = s2?.galaxieMission?.chosenLegend ?? 'dialga';
      const sprite  = chosen === 'dialga' ? DIALGA_SPRITE : PALKIA_SPRITE;
      const staticS = chosen === 'dialga' ? DIALGA_STATIC : PALKIA_STATIC;
      _launchLegend(chosen, sprite, staticS, 7500, 0.45, 70, 3, 'galaxieMission', 'legendOwned');
      return;
    }
    if (action === 'legend-giratina') {
      modal.remove();
      _launchLegend('giratina-origin', GIRATINA_SPRITE, GIRATINA_STATIC, 8000, 0.42, 70, 3, 'giratinaMission', 'giratinaOwned');
      return;
    }
    if (action === 'rerun-galaxie')  { modal.remove(); _doGalaxieRerun(); return; }
    if (action === 'rerun-giratina') { modal.remove(); _doGiratinaRerun(); return; }
    for (const key of ['uxie','mesprit','azelf']) {
      if (action === `legend-lake-${key}`) { modal.remove(); _captureLakeLegend(key); return; }
      if (action === `rerun-lake-${key}`)  { modal.remove(); _doLakeRerun(key); return; }
    }
  });
}

function _infoBarHtml(s) {
  const inv = s.inventory ?? {};
  const ft  = inv.fragment_temporel ?? 0;
  const od  = inv.onde_distorsion   ?? 0;
  const cl  = inv.cristal_lac       ?? 0;
  if (!ft && !od && !cl) return '';
  return `<div class="snm-info-bar">
    <span class="snm-info-label">Inventaire quêtes :</span>
    ${ft ? `<span class="snm-info-item">💎 Fragment Temporel ×${ft}</span>` : ''}
    ${od ? `<span class="snm-info-item">👁️ Onde Distorsion ×${od}</span>` : ''}
    ${cl ? `<span class="snm-info-item">💙 Cristal du Lac ×${cl}</span>` : ''}
  </div>`;
}

// ── Gestionnaire des combats gagnés ──────────────────────────────────────────
function _onCombatWon({ zoneId, trainerKey: tk } = {}) {
  const s = _state();
  if (!s?.purchases?.sinnohUnlocked) return;

  const gx = s.galaxieMission;
  const gt = s.giratinaMission;
  const lk = s.lakeMission;
  let changed = false;

  // Galactic grunt fights (step 1)
  if (gx?.active && gx.step === 1 && _GALACTIC_ZONES.has(zoneId) &&
      ['galacticgrunt','galacticgruntf'].includes(tk)) {
    gx.galacticFightsWon = (gx.galacticFightsWon ?? 0) + 1;
    if (gx.galacticFightsWon >= 20) {
      gx.step = 2;
      _notify('🌌 Quête Galaxie — Étape 2 : Défiez Mars et Jupiter !', 'gold');
    }
    changed = true;
  }

  // Spear Pillar fights (step 3)
  if (gx?.active && gx.step === 3 && _SPEAR_ZONES.has(zoneId)) {
    gx.spearFightsWon = (gx.spearFightsWon ?? 0) + 1;
    if (gx.spearFightsWon >= 12) {
      gx.step = 4;
      _notify('🌌 Quête Galaxie — Étape 4 : Affrontez Cyrus !', 'gold');
    }
    changed = true;
  }

  // Turnback cave fights (step 1 Giratina)
  if (gt?.active && gt.step === 1 && _TURNBACK_ZONES.has(zoneId)) {
    gt.turnbackFightsWon = (gt.turnbackFightsWon ?? 0) + 1;
    if (gt.turnbackFightsWon >= 10) {
      gt.step = 2;
      _notify('👁️ Quête Distorsion — Étape 2 : Défiez Saturne !', 'gold');
    }
    changed = true;
  }

  // Lake trio fights (step 1 for each)
  if (lk && _LAKE_ZONES.has(zoneId)) {
    for (const key of ['uxie','mesprit','azelf']) {
      const m = lk[key];
      if (m?.active && m.step === 1) {
        m.fightsWon = (m.fightsWon ?? 0) + 1;
        if (m.fightsWon >= 8) {
          m.step = 2;
          _notify(`${LAKES[key].icon} ${LAKES[key].name} — Prêt à être capturé !`, 'gold');
        }
        changed = true;
        break; // each fight counts for one pokemon at a time
      }
    }
  }

  if (changed) _save();
}

function _onBossWin(bossKey) {
  const s = _state();
  if (!s) return;
  const gx = s.galaxieMission;
  const gt = s.giratinaMission;

  if (bossKey === 'mars' && gx) {
    gx.marsDefeated = true;
    if (gx.jupiterDefeated) { gx.step = 3; _notify('🌌 Quête Galaxie — Étape 3 : Combattez au Pilier Axial !', 'gold'); }
    else _notify('🌌 Mars vaincue ! Défiez maintenant Jupiter.', 'gold');
    _save(); setTimeout(() => openSinnohMissions(), 400);
  }
  if (bossKey === 'jupiter' && gx) {
    gx.jupiterDefeated = true;
    if (gx.marsDefeated) { gx.step = 3; _notify('🌌 Quête Galaxie — Étape 3 : Combattez au Pilier Axial !', 'gold'); }
    else _notify('🌌 Jupiter vaincue ! Défiez maintenant Mars.', 'gold');
    _save(); setTimeout(() => openSinnohMissions(), 400);
  }
  if (bossKey === 'cyrus' && gx) {
    gx.cyrusDefeated = true;
    gx.step = 5;
    _notify('🌌 Quête Galaxie — Étape 5 : Choisissez votre légendaire !', 'gold');
    // Unlock Giratina quest
    if (gt && !gt.active) {
      gt.active = true;
      gt.step   = 1;
      _notify('👁️ Quête Distorsion débloquée — Cyrus a ouvert une fissure dans l\'espace…', 'gold');
    }
    _save(); setTimeout(() => openSinnohMissions(), 400);
  }
  if (bossKey === 'saturn' && gt) {
    gt.saturnDefeated = true;
    gt.step = 3;
    _notify('👁️ Quête Distorsion — Étape 3 : Affrontez Giratina dans la Source de l\'Envol !', 'gold');
    _save(); setTimeout(() => openSinnohMissions(), 400);
  }
}

// ── EventBus subscriptions ────────────────────────────────────────────────────
let _registered = false;
function _register() {
  if (_registered) return;
  _registered = true;
  EventBus.on(EVENTS.COMBAT_WON, ({ zoneId, trainerKey } = {}) => {
    _onCombatWon({ zoneId, trainerKey });
  });

  EventBus.on(EVENTS.ITEM_RECEIVED, ({ itemId } = {}) => {
    const s = _state();
    if (!s?.purchases?.sinnohUnlocked) return;
    // Items go straight to inventory (already done in zoneSystem),
    // just trigger a UI refresh if tracker is open
    if (['fragment_temporel','onde_distorsion','cristal_lac'].includes(itemId)) {
      const tracker = document.getElementById('snm-modal');
      if (tracker) { tracker.remove(); setTimeout(() => openSinnohMissions(), 100); }
    }
  });
}

// ── Vérification de déclenchement ────────────────────────────────────────────
export function checkSinnohMissionsUnlock() {
  const s = _state();
  if (!s?.purchases?.sinnohUnlocked) return;
  const rep = s.gang?.reputation ?? 0;
  let changed = false;

  // Init state if missing
  if (!s.galaxieMission) {
    s.galaxieMission = { active:false, step:0, galacticFightsWon:0, marsDefeated:false,
      jupiterDefeated:false, spearFightsWon:0, cyrusDefeated:false,
      chosenLegend:null, legendOwned:false, totalCaptures:0 };
  }
  if (!s.giratinaMission) {
    s.giratinaMission = { active:false, step:0, turnbackFightsWon:0, saturnDefeated:false,
      giratinaOwned:false, totalCaptures:0 };
  }
  if (!s.lakeMission) {
    s.lakeMission = {
      uxie:    { active:false, step:0, fightsWon:0, owned:false, captures:0 },
      mesprit: { active:false, step:0, fightsWon:0, owned:false, captures:0 },
      azelf:   { active:false, step:0, fightsWon:0, owned:false, captures:0 },
    };
  }

  // Unlock lake trio at rep >= 4200
  if (rep >= 4200) {
    for (const key of ['uxie','mesprit','azelf']) {
      const m = s.lakeMission[key];
      if (!m.active) {
        m.active = true; m.step = 1;
        _notify(`${LAKES[key].icon} Quête débloquée : ${LAKES[key].name} — explorez les Rives du Lac !`, 'gold');
        changed = true;
      }
    }
  }

  // Unlock Galaxie quest at rep >= 4500
  if (rep >= 4500 && !s.galaxieMission.active) {
    s.galaxieMission.active = true;
    s.galaxieMission.step   = 1;
    _notify('💎 Quête débloquée : Dialga & Palkia — La Team Galaxie s\'agite au Mont Couronné !', 'gold');
    changed = true;
  }

  if (changed) { _register(); _save(); }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
_register();

globalThis.openSinnohMissions        = openSinnohMissions;
globalThis.checkSinnohMissionsUnlock = checkSinnohMissionsUnlock;
globalThis._snmRenderTrackerBtn      = _renderTrackerBtn;

// ── CSS ───────────────────────────────────────────────────────────────────────
function _injectCss() {
  if (document.getElementById('snm-css')) return;
  const s = document.createElement('style');
  s.id = 'snm-css';
  s.textContent = `
  .snm-overlay {
    position: fixed; inset: 0; z-index: 9998;
    background: rgba(0,0,0,.75); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
  }
  .snm-panel {
    background: #111; border: 1px solid #333; border-radius: 12px;
    width: min(680px, 100%); max-height: 88vh; overflow-y: auto;
    display: flex; flex-direction: column; gap: 0;
    scrollbar-width: thin; scrollbar-color: #333 #111;
  }
  .snm-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; border-bottom: 1px solid #222;
    position: sticky; top: 0; background: #111; z-index: 2;
  }
  .snm-title { font-size: 15px; font-weight: 700; color: #e8d8a0; letter-spacing: .04em; }
  .snm-close {
    background: none; border: none; color: #666; font-size: 16px; cursor: pointer; padding: 4px 8px;
  }
  .snm-close:hover { color: #fff; }
  .snm-section {
    padding: 14px 18px; border-bottom: 1px solid #1a1a1a;
  }
  .snm-section-title {
    display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;
  }
  .snm-section-title > span:nth-child(2) { font-size: 13px; font-weight: 600; color: #ccc; }
  .snm-sec-icon { font-size: 16px; }
  .snm-badge {
    font-size: 9px; padding: 2px 7px; border-radius: 99px; font-weight: 700; letter-spacing: .05em;
  }
  .snm-badge-step { background: #333; color: #aaa; }
  .snm-badge-done { background: #0a2a0a; color: #4f4; border: 1px solid #2a5a2a; }
  .snm-inactive { font-size: 11px; color: #555; font-style: italic; padding: 8px 0; }
  .snm-steps { display: flex; flex-direction: column; gap: 6px; }
  .snm-prog-row {
    display: flex; align-items: center; gap: 8px; font-size: 11px; color: #888;
  }
  .snm-prog-label { flex: 0 0 auto; min-width: 160px; }
  .snm-prog-bar {
    flex: 1; height: 5px; background: #222; border-radius: 3px; overflow: hidden;
  }
  .snm-prog-fill { height: 100%; background: #4488cc; border-radius: 3px; transition: width .3s; }
  .snm-prog-val { flex: 0 0 auto; font-size: 10px; color: #666; }
  .snm-step-row {
    display: flex; align-items: center; gap: 8px; font-size: 11px; color: #666;
    padding: 4px 8px; border-radius: 6px; background: #0d0d0d;
    flex-wrap: wrap;
  }
  .snm-step-row.snm-active { color: #aaa; background: #151515; }
  .snm-step-btns { display: flex; gap: 6px; margin-left: auto; }
  .snm-btn {
    border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;
    padding: 5px 10px; transition: opacity .15s;
  }
  .snm-btn:hover { opacity: .85; }
  .snm-btn-primary { background: #4466cc; color: #fff; }
  .snm-btn-ghost   { background: transparent; color: #888; border: 1px solid #333; }
  .snm-btn-sm      { padding: 3px 8px; font-size: 10px; }
  .snm-btn-accent  { background: var(--accent, #4466cc); color: #fff; width: 100%; margin-top: 8px; }
  .snm-rerun       { background: #2a1a00; color: #c8a040; border: 1px solid #5a3a00; }
  /* Lake grid */
  .snm-lake-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .snm-lake-card {
    background: #0d0d0d; border: 1px solid #222; border-radius: 8px;
    padding: 10px 8px; display: flex; flex-direction: column; align-items: center; gap: 6px;
  }
  .snm-lake-card:not(.snm-inactive-card) { border-color: color-mix(in srgb, var(--accent,#444) 40%, #222); }
  .snm-lake-gif { width: 48px; height: 48px; image-rendering: pixelated; object-fit: contain; }
  .snm-lake-name { font-size: 12px; font-weight: 700; color: #ccc; }
  .snm-lake-status { font-size: 10px; color: #555; font-style: italic; }
  .snm-inactive-card { opacity: .5; }
  /* Boss fight modal */
  .snm-modal-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,.8); display: flex; align-items: center; justify-content: center;
  }
  .snm-modal {
    background: #111; border: 1px solid #333; border-radius: 12px;
    width: min(400px, 92vw); overflow: hidden;
  }
  .snm-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-bottom: 1px solid #222;
  }
  .snm-modal-title { font-size: 13px; font-weight: 700; color: #e8d8a0; }
  .snm-modal-close {
    background: none; border: none; color: #666; font-size: 16px; cursor: pointer;
  }
  .snm-boss-card {
    display: flex; gap: 12px; align-items: center; padding: 16px;
  }
  .snm-boss-sprite { width: 64px; height: 64px; object-fit: contain; }
  .snm-boss-info { display: flex; flex-direction: column; gap: 4px; }
  .snm-boss-name { font-size: 14px; font-weight: 700; color: #ddd; }
  .snm-boss-role { font-size: 10px; color: #888; }
  .snm-boss-team { font-size: 10px; color: #666; font-style: italic; }
  .snm-power-bar {
    display: flex; align-items: center; gap: 6px; padding: 8px 16px; font-size: 11px; color: #888;
  }
  .snm-power-value { font-weight: 700; }
  .snm-ok   { color: #4f8; }
  .snm-warn { color: #f84; }
  .snm-modal-actions {
    display: flex; gap: 8px; padding: 12px 16px; justify-content: flex-end;
  }
  /* Chooser */
  .snm-chooser-modal { width: min(520px, 92vw); }
  .snm-chooser-sub { font-size: 11px; color: #888; padding: 10px 16px 4px; }
  .snm-chooser-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 16px 8px; }
  .snm-chooser-card {
    background: #0d0d0d; border: 1px solid color-mix(in srgb, var(--accent) 30%, #222);
    border-radius: 8px; padding: 12px; display: flex; flex-direction: column;
    align-items: center; gap: 8px; text-align: center;
  }
  .snm-chooser-gif { width: 72px; height: 72px; image-rendering: pixelated; object-fit: contain; }
  .snm-chooser-name { font-size: 13px; font-weight: 700; color: #ddd; }
  .snm-chooser-desc { font-size: 10px; color: #777; }
  .snm-chooser-cancel { margin: 0 16px 12px; }
  /* Legend portrait */
  .snm-legend-modal { width: min(340px, 92vw); }
  .snm-legend-portrait { display: flex; justify-content: center; padding: 20px; }
  .snm-legend-gif { width: 80px; height: 80px; image-rendering: pixelated; object-fit: contain; }
  /* Info bar */
  .snm-info-bar {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    padding: 10px 18px; font-size: 10px; color: #888; background: #0d0d0d;
    border-radius: 0 0 12px 12px;
  }
  .snm-info-label { color: #666; }
  .snm-info-item  { color: #aaa; background: #1a1a1a; padding: 2px 7px; border-radius: 99px; }
  /* Tracker button */
  .snm-quest-btn { font-size: 10px; background: rgba(60,40,100,.6); border-color: #554477; }
  @media (max-width: 480px) {
    .snm-lake-grid { grid-template-columns: 1fr 1fr; }
    .snm-chooser-grid { grid-template-columns: 1fr; }
  }
  `;
  document.head.appendChild(s);
}
