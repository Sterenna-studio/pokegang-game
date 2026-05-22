// ════════════════════════════════════════════════════════════════
//  GANG BASE MODULE
//  Extracted from app.js — gang base window, codex, export card
// ════════════════════════════════════════════════════════════════
//
//  Globals read from app.js via globalThis:
//    state, notify, saveState, renderZoneWindows
//    speciesName, pokeSprite, trainerSprite, itemSprite, pokemonDisplayName
//    getPokemonPower, calculateStats, calculatePrice
//    isBoostActive, boostRemaining, activateBoost
//    openTeamPicker, openRareCandyPicker, switchTab
//    getBossFullTitle, getTitleLabel
//    getDexKantoCaught, getDexNationalCaught, getShinySpeciesCount
//    sanitizeSpriteName
//    BASE_PRICE, POTENTIAL_MULT, COSMETIC_BGS, ZONE_BGS
//    KANTO_DEX_SIZE, NATIONAL_DEX_SIZE
//
//  Classic-script globals accessed by bare name:
//    ZONES, ZONE_BY_ID, SPECIES_BY_EN
//
//  ES module imports:
//    FALLBACK_TRAINER_SVG (from data/assets-data.js)
//    MUSIC_TRACKS         (from data/music-data.js — if present)
// ════════════════════════════════════════════════════════════════

import { FALLBACK_TRAINER_SVG } from '../../data/assets-data.js';
import { BOSS_TEAM_SLOTS, SHOWCASE_SLOTS } from '../../data/game-config-data.js';

import { EventBus, EVENTS } from '../core/eventBus.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY,        { msg, type });
const _dirty  = ()               => EventBus.emit(EVENTS.STATE_DIRTY);
const _topBar = ()               => EventBus.emit(EVENTS.UI_TOPBAR_UPDATE);
const _save   = ()               => globalThis.saveState?.();


/* globals ZONES, ZONE_BY_ID, SPECIES_BY_EN */

// ── Gang Base Window ──────────────────────────────────────────

let _boostMult = 1; // multiplicateur actif pour les boosts (x1/x5/x10)
let _gangBaseViewMode = 'v1'; // 'v1' | 'v2' — persisté dans state.settings.gangBaseView

const BASE_RARITY_ORDER = ['common', 'uncommon', 'rare', 'very_rare', 'legendary'];
const BASE_RARITY_FR = {
  common: 'Commun',
  uncommon: 'Peu commun',
  rare: 'Rare',
  very_rare: 'Tres rare',
  legendary: 'Legendaire',
};
const BASE_ZONE_TYPE_FR = {
  route: 'Front sauvage',
  city: 'Ville',
  special: 'Lieu special',
  gang_park: 'QG',
};
const BASE_RANK_FR = {
  grunt: 'Grunt',
  sergent: 'Sergent',
  lieutenant: 'Lieutenant',
  commandant: 'Commandant',
  elite: 'Elite',
  general: 'General',
};

function _baseZoneById(zoneId) {
  if (!zoneId) return null;
  if (typeof ZONE_BY_ID !== 'undefined' && ZONE_BY_ID[zoneId]) return ZONE_BY_ID[zoneId];
  if (typeof ZONE_JOHTO_BY_ID !== 'undefined' && ZONE_JOHTO_BY_ID[zoneId]) return ZONE_JOHTO_BY_ID[zoneId];
  return null;
}

function _baseAllZones() {
  if (typeof ZONES === 'undefined') return [];
  return ZONES.filter(z => z.type !== 'gang_park');
}

function _baseUnlockedZones(state) {
  return _baseAllZones().filter(z => {
    if (globalThis.isZoneUnlocked) return globalThis.isZoneUnlocked(z.id);
    return (state.gang?.reputation || 0) >= (z.rep || 0);
  });
}

function _baseFocusZone(state) {
  const unlocked = _baseUnlockedZones(state);
  const fromBoss = _baseZoneById(state.gang?.bossZone);
  if (fromBoss && unlocked.some(z => z.id === fromBoss.id)) return fromBoss;
  const open = [...(globalThis.openZones || [])].map(_baseZoneById).find(Boolean);
  if (open && unlocked.some(z => z.id === open.id)) return open;
  const assigned = (state.agents || []).map(a => _baseZoneById(a.assignedZone)).find(Boolean);
  if (assigned && unlocked.some(z => z.id === assigned.id)) return assigned;
  return unlocked[0] || _baseAllZones()[0] || null;
}

function _baseZoneName(zone, state) {
  if (!zone) return state.lang === 'fr' ? 'Aucun front' : 'No front';
  return state.lang === 'fr' ? (zone.fr || zone.en || zone.id) : (zone.en || zone.fr || zone.id);
}

function _baseZoneRarity(zone) {
  if (!zone) return '—';
  let best = 0;
  const pools = [...(zone.pool || []), ...(zone.rarePool || []).map(e => e.en)];
  for (const species of pools) {
    const rarity = SPECIES_BY_EN?.[species]?.rarity || 'common';
    best = Math.max(best, BASE_RARITY_ORDER.indexOf(rarity));
  }
  const label = BASE_RARITY_FR[BASE_RARITY_ORDER[Math.max(0, best)]] || 'Commun';
  if (zone.rarePool?.length) return `${label} +`;
  return label;
}

function _baseZoneStatus(zone, state, zState, assignedCount) {
  if (!zone) return { stateLabel: '—', dangerLabel: '—', possession: 0 };
  const open = globalThis.openZones?.has(zone.id);
  const degraded = globalThis.isZoneDegraded?.(zone.id);
  const combats = zState?.combatsWon || 0;
  const captures = zState?.captures || 0;
  const mastery = globalThis.getZoneMastery?.(zone.id) || 0;
  const repGap = Math.max(0, (zone.rep || 0) - (state.gang?.reputation || 0));
  const possession = Math.max(5, Math.min(100,
    18 + mastery * 18 + Math.min(24, combats * 2) + Math.min(18, captures) + assignedCount * 12 + (open ? 10 : 0)
  ));
  const dangerScore = (zone.rep || 0) + (zone.type === 'city' ? 140 : 0) + (zone.type === 'special' ? 90 : 0) + (degraded ? 250 : 0);
  const dangerLabel = degraded ? 'Critique' : dangerScore >= 900 ? 'Extreme' : dangerScore >= 550 ? 'Eleve' : dangerScore >= 250 ? 'Modere' : 'Faible';
  const stateLabel = degraded ? 'Fragilise' : open ? 'Ouverte' : assignedCount > 0 ? 'Tenue' : repGap > 0 ? 'Verrouillee' : 'Disponible';
  return { stateLabel, dangerLabel, possession };
}

function _baseModuleTitle(text, meta = '') {
  return `<div class="base-module-head"><span>${text}</span>${meta ? `<em>${meta}</em>` : ''}</div>`;
}

function _applyGangBaseViewMode() {
  const zonesTopArea = document.getElementById('zonesTopArea');
  if (zonesTopArea) zonesTopArea.classList.toggle('gb-v2-mode', _gangBaseViewMode === 'v2');
}

// ── Chantier 5 — Debounce rAF + patch ciblé ──────────────────────
// renderGangBasePanel() est appelée par 18 sites. Au lieu de regénérer
// systématiquement le HTML complet, on essaie d'abord un patch ciblé sur
// les sections qui changent réellement (stats header, items, incubateurs,
// cartes territoire, équipe boss).
//
// Si la STRUCTURE change (view mode, focus zone, agent count, side zones),
// la signature diffère → full render fallback.
//
// Si un caller a besoin d'un rendu synchrone immédiat (cas rare — ex: avant
// d'ouvrir une modal qui lit le DOM rendu), utiliser renderGangBasePanelSync().
let _rafGangBaseId = 0;
let _lastRenderSig = '';

const _BALL_IDS  = ['pokeball','greatball','ultraball','duskball','masterball'];
const _BOOST_IDS = ['lure','superlure','incense','rarescope','aura'];
const _CRAFT_IDS = ['rarecandy','evostone'];
const _KEY_IDS   = ['incubator','map_pallet','casino_ticket','silph_keycard','boat_ticket'];

/**
 * Signature des éléments structurels — si elle change, full render est requis
 * car le HTML produit serait sensiblement différent (focus zone, agents, etc.).
 */
function _buildRenderSig(state) {
  if (!state) return '';
  const focusId    = _baseFocusZone(state)?.id || '';
  const openZ      = [...(globalThis.openZones || [])].sort().join(',');
  const agentsSig  = (state.agents || []).map(a => `${a.id}:${a.assignedZone || ''}`).join(',');
  const bossTeam   = (state.gang.bossTeam || []).join(',');
  const patches    = (state.cosmetics?.activePatches || []).join(',');
  return [
    _gangBaseViewMode, focusId, openZ, agentsSig, bossTeam, patches,
    state.gang.bossSprite || '',
    state.inventory?.incubator || 0,
    (state.eggs || []).length,
  ].join('|');
}

function _renderGangBasePanelImpl({ force = false } = {}) {
  const gangContainer = document.getElementById('gangBaseContainer');
  if (!gangContainer) return;

  // Sync view mode from settings (persisted across reloads)
  const state = globalThis.state;
  const savedView = state?.settings?.gangBaseView;
  if (savedView && savedView !== _gangBaseViewMode) _gangBaseViewMode = savedView;

  _applyGangBaseViewMode();

  const sig = _buildRenderSig(state);
  const existingBase = gangContainer.querySelector('#gangBaseWin');

  // Patch ciblé : structure identique + DOM déjà construit + pas forcé + view v1
  if (!force && existingBase && sig === _lastRenderSig && _gangBaseViewMode === 'v1') {
    if (_patchGangBaseV1(existingBase, state)) return;
  }

  // Full render fallback
  const gangHtml = _gangBaseViewMode === 'v2' ? renderGangBaseWindowV2() : renderGangBaseWindow();
  if (existingBase) {
    const tmp = document.createElement('div');
    tmp.innerHTML = gangHtml;
    gangContainer.replaceChild(tmp.firstElementChild, existingBase);
  } else {
    gangContainer.innerHTML = gangHtml;
  }
  if (_gangBaseViewMode === 'v2') {
    bindGangBaseV2(gangContainer);
  } else {
    bindGangBase(gangContainer);
  }
  _lastRenderSig = sig;
}

/**
 * Patch ciblé v1 : met à jour les sections "live" sans recréer le DOM.
 * @returns {boolean} true si patch appliqué avec succès, false si fallback requis
 */
function _patchGangBaseV1(win, state) {
  try {
    // 1. Header stats — money + reputation
    const headerStats = win.querySelector('.base-header-stats');
    if (headerStats) {
      const spans = headerStats.children;
      if (spans[0]) spans[0].textContent = `₽${(state.gang.money || 0).toLocaleString()}`;
      if (spans[1]) spans[1].textContent = `⭐${(state.gang.reputation || 0).toLocaleString()}`;
    }

    // 2. Item tiles — quantités, active ball, boost remaining
    const isBoostActive  = globalThis.isBoostActive;
    const boostRemaining = globalThis.boostRemaining;
    const allItems = [..._BALL_IDS, ..._BOOST_IDS, ..._CRAFT_IDS];
    for (const id of allItems) {
      const tile = win.querySelector(`[data-bag-item="${id}"]`);
      if (!tile) continue;
      const qty   = state.inventory?.[id] || 0;
      const owned = qty > 0;
      const isBall    = _BALL_IDS.includes(id);
      const isBoost   = _BOOST_IDS.includes(id);
      const isActive  = isBall && state.activeBall === id;
      const isBoosted = isBoost && isBoostActive?.(id);

      // Active/boosted classes
      tile.classList.toggle('active', isActive);
      tile.classList.toggle('boosted', !!isBoosted);
      const spriteEl = tile.querySelector('.base-item-sprite');
      if (spriteEl) spriteEl.classList.toggle('locked', !owned);

      // Quantity badge
      const qtyEl = tile.querySelector('.base-item-qty');
      if (qtyEl) {
        qtyEl.textContent = owned ? (qty > 99 ? '99+' : '×' + qty) : '0';
        qtyEl.style.color   = owned ? '' : 'var(--text-dim)';
        qtyEl.style.opacity = owned ? '' : '0.4';
      }

      // Boost remaining time
      let remEl = tile.querySelector('.base-item-rem');
      if (isBoosted) {
        const remStr = `${Math.ceil(boostRemaining?.(id) || 0)}s`;
        if (remEl) remEl.textContent = remStr;
        else tile.insertAdjacentHTML('beforeend', `<span class="base-item-rem">${remStr}</span>`);
      } else if (remEl) {
        remEl.remove();
      }

      // Title attr
      tile.title = `${id} ×${qty}`;
    }

    // Clés (KEY_IDS) — juste maj du badge ✓/✗
    for (const id of _KEY_IDS) {
      const tile = win.querySelector(`[data-bag-item="${id}"]`);
      if (!tile) continue;
      const qty   = state.inventory?.[id] || 0;
      const owned = qty > 0;
      tile.classList.toggle('locked-key', !owned);
      const sprite = tile.querySelector('.base-item-sprite');
      if (sprite) sprite.classList.toggle('locked', !owned);
      const badge = tile.querySelector('.base-item-qty');
      if (badge) {
        badge.textContent = owned ? '✓' : '✗';
        badge.style.color   = owned ? 'var(--green)' : 'var(--text-dim)';
        badge.style.opacity = owned ? '' : '0.35';
      }
      tile.title = `${id}${owned ? ' — Obtenu' : ' — Non obtenu'}`;
    }

    // 3. Incubator slots — progress fill + time
    const incCount = state.inventory?.incubator || 0;
    if (incCount > 0) {
      const incubatingEggs = (state.eggs || []).filter(e => e.incubating);
      const now = Date.now();
      const slots = win.querySelectorAll('.base-inc-slot[data-egg-id]');
      for (const slot of slots) {
        const eggId = slot.dataset.eggId;
        const egg = incubatingEggs.find(e => e.id === eggId);
        if (!egg) continue;
        const isReady  = egg.status === 'ready';
        const progress = (egg.hatchAt && egg.incubatedAt)
          ? Math.min(100, Math.round((now - egg.incubatedAt) / (egg.hatchAt - egg.incubatedAt) * 100))
          : 0;
        slot.classList.toggle('ready',  isReady);
        slot.classList.toggle('active', !isReady);
        const fill = slot.querySelector('.base-inc-fill');
        if (fill) {
          fill.style.width = (isReady ? 100 : progress) + '%';
          fill.style.background = isReady ? 'var(--green)' : 'var(--gold)';
        }
        const timeEl = slot.querySelector('.base-inc-time');
        if (!isReady && egg.hatchAt && timeEl) {
          const tm = Math.max(0, Math.ceil((egg.hatchAt - now) / 60000));
          timeEl.textContent = `${tm}m`;
        }
      }
    }

    // 4. Territory cards — possession, danger, rareté, état
    const focusZone = _baseFocusZone(state);
    if (focusZone) {
      const focusState  = state.zones?.[focusZone.id] || {};
      const focusAgents = (state.agents || []).filter(a => a.assignedZone === focusZone.id);
      const focusMeta   = _baseZoneStatus(focusZone, state, focusState, focusAgents.length);
      const focusRarity = _baseZoneRarity(focusZone);
      const isFocusOpen = !!globalThis.openZones?.has(focusZone.id);

      const cards = win.querySelectorAll('.base-status-grid .base-status-card');
      const updates = [
        { value: `${focusMeta.possession}%`, fill: `${Math.max(4, focusMeta.possession)}%` },
        { value: focusMeta.dangerLabel,      fill: focusMeta.dangerLabel === 'Critique' ? '100%' : focusMeta.dangerLabel === 'Extreme' ? '84%' : focusMeta.dangerLabel === 'Eleve' ? '66%' : focusMeta.dangerLabel === 'Modere' ? '42%' : '22%' },
        { value: focusRarity,                fill: focusRarity.includes('+') || focusRarity.includes('Legendaire') ? '86%' : focusRarity.includes('Rare') ? '66%' : '38%' },
        { value: focusMeta.stateLabel,       fill: isFocusOpen ? '100%' : focusAgents.length ? '68%' : '36%' },
      ];
      for (let i = 0; i < cards.length && i < updates.length; i++) {
        const strong = cards[i].querySelector('strong');
        const fillB  = cards[i].querySelector('i > b');
        if (strong) strong.textContent  = updates[i].value;
        if (fillB)  fillB.style.width  = updates[i].fill;
      }
    }

    // 5. Boss team slots — re-render local de cette petite section
    const teamRow = win.querySelector('.base-team-slots');
    if (teamRow) {
      const pokeSprite  = globalThis.pokeSprite;
      const speciesName = globalThis.speciesName;
      const html = Array.from({ length: BOSS_TEAM_SLOTS }, (_, i) => {
        const pkId = state.gang.bossTeam[i];
        const pk = pkId ? state.pokemons.find(p => p.id === pkId) : null;
        if (pk) {
          return `<div class="base-team-slot filled" data-boss-slot="${i}" title="${speciesName(pk.species_en)} Lv.${pk.level}">
            <img src="${pokeSprite(pk.species_en, pk.shiny)}" alt="${speciesName(pk.species_en)}">
          </div>`;
        }
        return `<div class="base-team-slot" data-boss-slot="${i}" title="${state.lang === 'fr' ? 'Assigner un Pokémon' : 'Assign a Pokémon'}">+</div>`;
      }).join('');
      teamRow.innerHTML = html;
    }

    return true;
  } catch (e) {
    console.warn('[gangBase] patch failed, fallback to full render:', e);
    return false;
  }
}

function renderGangBasePanel() {
  if (_rafGangBaseId) return; // déjà en attente cette frame
  _rafGangBaseId = requestAnimationFrame(() => {
    _rafGangBaseId = 0;
    _renderGangBasePanelImpl();
  });
}

/** Rendu synchrone immédiat. À utiliser uniquement si le caller doit lire
 *  le DOM rendu juste après (modal, focus, etc.). */
function renderGangBasePanelSync() {
  if (_rafGangBaseId) {
    cancelAnimationFrame(_rafGangBaseId);
    _rafGangBaseId = 0;
  }
  _renderGangBasePanelImpl();
}

/** Force un full render (jamais de patch ciblé). À utiliser après un changement
 *  qui invalide la structure (changement de focus zone, view, etc.). */
function renderGangBasePanelForce() {
  if (_rafGangBaseId) {
    cancelAnimationFrame(_rafGangBaseId);
    _rafGangBaseId = 0;
  }
  _renderGangBasePanelImpl({ force: true });
}

function renderGangBaseWindow() {
  const state = globalThis.state;
  const pokeSprite    = globalThis.pokeSprite;
  const trainerSprite = globalThis.trainerSprite;
  const speciesName   = globalThis.speciesName;
  const itemSprite    = globalThis.itemSprite;
  const isBoostActive = globalThis.isBoostActive;
  const boostRemaining= globalThis.boostRemaining;
  const getPokemonPower = globalThis.getPokemonPower;

  // ── Boss team slots (6 Pokémon)
  const bossTeamHtml = Array.from({length: BOSS_TEAM_SLOTS}, (_, i) => {
    const pkId = state.gang.bossTeam[i];
    const pk = pkId ? state.pokemons.find(p => p.id === pkId) : null;
    if (pk) {
      return `<div class="base-team-slot filled" data-boss-slot="${i}" title="${speciesName(pk.species_en)} Lv.${pk.level}">
        <img src="${pokeSprite(pk.species_en, pk.shiny)}" alt="${speciesName(pk.species_en)}">
      </div>`;
    }
    return `<div class="base-team-slot" data-boss-slot="${i}" title="${state.lang === 'fr' ? 'Assigner un Pokémon' : 'Assign a Pokémon'}">+</div>`;
  }).join('');

  // ── Glass background: top Pokémon + agents floutés
  const _BG_POSITIONS = [
    {left:'6%',bottom:'28%'},{left:'18%',bottom:'58%'},{left:'32%',bottom:'18%'},
    {left:'48%',bottom:'50%'},{left:'62%',bottom:'68%'},{left:'76%',bottom:'26%'},
    {left:'86%',bottom:'46%'},{left:'12%',bottom:'78%'},{left:'42%',bottom:'74%'},
    {left:'58%',bottom:'12%'},{left:'28%',bottom:'44%'},{left:'70%',bottom:'82%'},
  ];
  const _bgPokes = [...state.pokemons].sort((a, b) => getPokemonPower(b) - getPokemonPower(a)).slice(0, 12);
  const _bgPokeHtml = _bgPokes.map((p, i) => {
    const pos = _BG_POSITIONS[i % _BG_POSITIONS.length];
    const sz = i < 3 ? 48 : i < 6 ? 36 : 28;
    return `<img src="${pokeSprite(p.species_en, p.shiny)}" style="position:absolute;left:${pos.left};bottom:${pos.bottom};width:${sz}px;height:${sz}px;image-rendering:pixelated;opacity:.35;filter:brightness(.5)" alt="">`;
  }).join('');
  const _agentPositions = [{left:'4%',bottom:'4%'},{left:'72%',bottom:'4%'},{left:'22%',bottom:'4%'},{left:'50%',bottom:'4%'},{left:'88%',bottom:'4%'}];
  const _bgAgentHtml = state.agents.slice(0, 5).map((a, i) => {
    const pos = _agentPositions[i];
    return `<img src="${a.sprite}" style="position:absolute;left:${pos.left};bottom:${pos.bottom};width:30px;height:30px;image-rendering:pixelated;opacity:.28;filter:brightness(.45)" onerror="this.src='${trainerSprite('acetrainer')}'" alt="">`;
  }).join('');

  // ── Item tiles
  const BALL_IDS  = ['pokeball','greatball','ultraball','duskball','masterball'];
  const BOOST_IDS = ['lure','superlure','incense','rarescope','aura'];
  const CRAFT_IDS = ['rarecandy','evostone'];
  const KEY_IDS   = ['incubator','map_pallet','casino_ticket','silph_keycard','boat_ticket'];

  function makeItemTile(id) {
    const qty      = state.inventory?.[id] || 0;
    const isBall   = BALL_IDS.includes(id);
    const isBoost  = BOOST_IDS.includes(id);
    const isActive = isBall && state.activeBall === id;
    const isBoosted= isBoost && isBoostActive(id);
    const owned    = qty > 0;
    const remStr   = isBoosted ? `<span class="base-item-rem">${Math.ceil(boostRemaining(id))}s</span>` : '';
    const qtyBadge = owned
      ? `<span class="base-item-qty">${qty > 99 ? '99+' : '×'+qty}</span>`
      : `<span class="base-item-qty" style="color:var(--text-dim);opacity:.4">0</span>`;
    return `<div class="base-item-tile${isActive ? ' active' : ''}${isBoosted ? ' boosted' : ''}" data-bag-item="${id}" title="${id} ×${qty}">
      <div class="base-item-sprite${owned ? '' : ' locked'}">${itemSprite(id)}</div>
      ${qtyBadge}${remStr}
    </div>`;
  }

  function makeKeyTile(id) {
    const qty   = state.inventory?.[id] || 0;
    const owned = qty > 0;
    const badge = owned
      ? `<span class="base-item-qty" style="color:var(--green)">✓</span>`
      : `<span class="base-item-qty" style="color:var(--text-dim);opacity:.35">✗</span>`;
    return `<div class="base-item-tile${owned ? '' : ' locked-key'}" data-bag-item="${id}" title="${id}${owned ? ' — Obtenu' : ' — Non obtenu'}">
      <div class="base-item-sprite${owned ? '' : ' locked'}">${itemSprite(id)}</div>
      ${badge}
    </div>`;
  }

  const ballsHtml  = BALL_IDS.map(makeItemTile).join('');
  const boostsHtml = BOOST_IDS.map(makeItemTile).join('');
  const craftHtml  = CRAFT_IDS.map(makeItemTile).join('');
  const keysHtml   = KEY_IDS.map(makeKeyTile).join('');

  // ── Incubator slots
  const incCount       = state.inventory?.incubator || 0;
  const eggs           = state.eggs || [];
  const incubatingEggs = eggs.filter(e => e.incubating);
  const waitingEggs    = eggs.filter(e => !e.incubating);
  const now            = Date.now();

  let incSlotsHtml = '';
  if (incCount > 0) {
    for (let i = 0; i < incCount; i++) {
      const egg = incubatingEggs[i];
      if (egg) {
        const isReady   = egg.status === 'ready';
        const progress  = (egg.hatchAt && egg.incubatedAt)
          ? Math.min(100, Math.round((now - egg.incubatedAt) / (egg.hatchAt - egg.incubatedAt) * 100))
          : 0;
        const timeLeftMin = (!isReady && egg.hatchAt) ? Math.max(0, Math.ceil((egg.hatchAt - now) / 60000)) : null;
        const eggSrc = globalThis.eggSprite?.(egg, isReady) || '';
        incSlotsHtml += `
          <div class="base-inc-slot ${isReady ? 'ready' : 'active'}" data-egg-id="${egg.id}"
            title="${egg.species_en}${isReady ? ' — PRÊT !' : timeLeftMin !== null ? ' — '+timeLeftMin+'min' : ''}"
            style="${isReady ? 'cursor:pointer;' : ''}">
            <img src="${eggSrc}" class="base-inc-egg" alt="">
            <div class="base-inc-bar">
              <div class="base-inc-fill" style="width:${isReady ? 100 : progress}%;background:${isReady ? 'var(--green)' : 'var(--gold)'}"></div>
            </div>
            ${isReady
              ? `<span class="base-inc-ready">!</span>`
              : timeLeftMin !== null ? `<span class="base-inc-time">${timeLeftMin}m</span>` : ''}
          </div>`;
      } else {
        incSlotsHtml += `<div class="base-inc-slot empty"><span style="font-size:18px;opacity:.25">🥚</span></div>`;
      }
    }
  }

  const focusZone = _baseFocusZone(state);
  const focusZoneId = focusZone?.id || '';
  const focusState = focusZone ? (state.zones?.[focusZone.id] || {}) : {};
  const focusAgents = focusZone ? (state.agents || []).filter(a => a.assignedZone === focusZone.id) : [];
  const focusName = _baseZoneName(focusZone, state);
  const focusType = focusZone ? (BASE_ZONE_TYPE_FR[focusZone.type] || focusZone.type || 'Front') : '—';
  const focusRarity = _baseZoneRarity(focusZone);
  const focusMeta = _baseZoneStatus(focusZone, state, focusState, focusAgents.length);
  const isFocusOpen = !!(focusZone && globalThis.openZones?.has(focusZone.id));
  const pendingIncome = focusState?.pendingIncome || 0;
  const pendingItemsCount = Object.values(focusState?.pendingItems || {}).reduce((sum, n) => sum + (n || 0), 0);
  const readyEggs = incubatingEggs.filter(e => e.status === 'ready').length;
  const bossTitle = globalThis.getBossFullTitle?.() || globalThis.getTitleLabel?.(state.gang.title) || 'Boss';
  const zoneDesc = focusZone
    ? (state.lang === 'fr' ? (focusZone.desc_fr || focusZone.desc || focusZone.en) : (focusZone.desc_en || focusZone.desc || focusZone.fr))
    : 'Ouvrez une zone pour lancer les operations du gang.';
  const activeZones = [...(globalThis.openZones || [])].filter(id => _baseZoneById(id));
  const unlockedZones = _baseUnlockedZones(state);
  const sideZones = [
    ...activeZones.map(id => _baseZoneById(id)).filter(Boolean),
    ...unlockedZones.filter(z => !activeZones.includes(z.id)),
  ].filter((z, idx, arr) => z.id !== focusZoneId && arr.findIndex(other => other.id === z.id) === idx).slice(0, 6);
  const topAgents = [
    ...focusAgents,
    ...(state.agents || []).filter(a => a.assignedZone !== focusZoneId),
  ].slice(0, 5);

  const bossPatches = (() => {
    const pids = state.cosmetics?.activePatches || [];
    const patchUrlFn = globalThis.patchUrl;
    if (!pids.length || !patchUrlFn) return '';
    const positions = ['bottom:0;right:-4px', 'bottom:0;left:-4px', 'top:0;right:-4px'];
    return pids.slice(0, 3).map((pid, i) =>
      `<img src="${patchUrlFn(pid)}" class="base-boss-patch" style="${positions[i]}" onerror="this.style.display='none'" alt="">`
    ).join('');
  })();

  const territoryCards = [
    ['Possession', `${focusMeta.possession}%`, 'base-possession', `${Math.max(4, focusMeta.possession)}%`],
    ['Danger', focusMeta.dangerLabel, 'base-danger', focusMeta.dangerLabel === 'Critique' ? '100%' : focusMeta.dangerLabel === 'Extreme' ? '84%' : focusMeta.dangerLabel === 'Eleve' ? '66%' : focusMeta.dangerLabel === 'Modere' ? '42%' : '22%'],
    ['Rarete', focusRarity, 'base-rarity', focusRarity.includes('+') || focusRarity.includes('Legendaire') ? '86%' : focusRarity.includes('Rare') ? '66%' : '38%'],
    ['Etat', focusMeta.stateLabel, 'base-state', isFocusOpen ? '100%' : focusAgents.length ? '68%' : '36%'],
  ].map(([label, value, cls, fill]) => `
    <div class="base-status-card ${cls}">
      <span>${label}</span>
      <strong>${value}</strong>
      <i><b style="width:${fill}"></b></i>
    </div>`).join('');

  const agentRows = topAgents.length ? topAgents.map(agent => {
    const inFocus = agent.assignedZone === focusZoneId;
    const zoneName = agent.assignedZone ? _baseZoneName(_baseZoneById(agent.assignedZone), state) : 'Reserve';
    const rank = globalThis.getAgentRankLabel?.(agent.title) || BASE_RANK_FR[agent.title] || agent.title || 'Agent';
    return `<button class="base-agent-row${inFocus ? ' active' : ''}" data-base-agent="${agent.id}" data-base-zone="${focusZoneId}">
      <img src="${agent.sprite || trainerSprite('acetrainer')}" alt="" onerror="this.src='${trainerSprite('acetrainer')}'">
      <span><strong>${agent.name}</strong><em>${rank} · ${zoneName}</em></span>
      <b>${(agent.team || []).filter(Boolean).length}/${globalThis.getAgentTeamSlots?.(agent) || 1}</b>
    </button>`;
  }).join('') : `<div class="base-empty-note">Aucun agent recrute</div>`;

  const feedItems = [
    focusZone ? {
      tag: focusMeta.stateLabel,
      title: `${focusName} · ${focusMeta.possession}%`,
      detail: pendingIncome > 0
        ? `${pendingIncome.toLocaleString()}₽ a recuperer${pendingItemsCount ? ` · ${pendingItemsCount} objet(s)` : ''}`
        : zoneDesc,
      alert: focusMeta.dangerLabel === 'Critique' || focusMeta.dangerLabel === 'Extreme',
    } : null,
    readyEggs > 0 ? { tag: 'Pension', title: `${readyEggs} oeuf(s) pret(s)`, detail: 'Incubateurs disponibles dans le QG.', alert: false } : null,
    focusAgents.length > 0 ? { tag: 'Cellule', title: `${focusAgents.length} agent(s) sur le front`, detail: focusAgents.map(a => a.name).join(', '), alert: false } : { tag: 'Cellule', title: 'Front sans agent', detail: 'Assignez un agent pour produire hors fenetre.', alert: true },
  ].filter(Boolean).slice(0, 3).map(item => `
    <div class="base-feed-item${item.alert ? ' alert' : ''}">
      <span>${item.tag}</span>
      <strong>${item.title}</strong>
      <p>${item.detail}</p>
    </div>`).join('');

  const sideZoneRows = sideZones.length ? sideZones.map(zone => {
    const zs = state.zones?.[zone.id] || {};
    const assigned = (state.agents || []).filter(a => a.assignedZone === zone.id).length;
    const meta = _baseZoneStatus(zone, state, zs, assigned);
    const open = globalThis.openZones?.has(zone.id);
    return `<button class="base-zone-row${open ? ' open' : ''}" data-base-zone-select="${zone.id}">
      <span><strong>${_baseZoneName(zone, state)}</strong><em>${BASE_ZONE_TYPE_FR[zone.type] || zone.type} · ${assigned} agent(s)</em></span>
      <b>${meta.possession}%</b>
    </button>`;
  }).join('') : `<div class="base-empty-note">Aucun front secondaire disponible</div>`;

  return `<div class="gang-base-window" id="gangBaseWin" data-base-focus-zone="${focusZoneId}">

    <div class="base-window-header base-command-header">
      <div class="base-header-gang">
        <span class="base-hq-icon">HQ</span>
        <span><strong>${state.gang.name}</strong><em>${state.gang.bossName} · ${bossTitle}</em></span>
      </div>
      <div class="base-header-stats">
        <span>₽${(state.gang.money || 0).toLocaleString()}</span>
        <span>⭐${(state.gang.reputation || 0).toLocaleString()}</span>
        <button class="gb-view-toggle" data-gb-view="v2" title="Vue v2 — 3 colonnes">V2</button>
        <button class="base-export-btn" title="${state.lang === 'fr' ? 'Exporter mon gang' : 'Export my gang'}">📷</button>
      </div>
    </div>

    <div class="base-command-shell">
      <section class="base-command-main">
        <div class="base-focus-bar">
          <span class="base-chip red">${focusName}</span>
          <span class="base-chip">${focusType}</span>
          <span class="base-chip gold">${focusRarity}</span>
          <span class="base-chip ${focusMeta.stateLabel === 'Ouverte' || focusMeta.stateLabel === 'Tenue' ? 'green' : ''}">${focusMeta.stateLabel}</span>
        </div>

        <div class="base-env-viewport base-command-viewport">
          <div class="base-bg-layer">
            ${_bgPokeHtml}${_bgAgentHtml}
            <div class="base-bg-overlay"></div>
          </div>
          <div class="base-boss-stage">
            <div class="base-boss-kicker">Gang Base principale</div>
            <div class="base-boss-frame">
              <div class="base-boss-halo"></div>
              ${bossPatches}
              ${state.gang.bossSprite
                ? `<img class="base-boss-sprite" src="${trainerSprite(state.gang.bossSprite)}" alt="Boss" onerror="this.src='${FALLBACK_TRAINER_SVG}';this.onerror=null">`
                : '<div class="base-boss-empty">?</div>'}
            </div>
            <div class="base-boss-name">${state.gang.bossName}</div>
            <div class="base-boss-zone">${zoneDesc}</div>
            <div class="base-team-label">Equipe du boss</div>
            <div class="base-team-slots">${bossTeamHtml}</div>
          </div>
        </div>

        <div class="base-status-grid">${territoryCards}</div>
      </section>

      <section class="base-modules-grid">
        <div class="base-inv-section base-module-card">
          ${_baseModuleTitle('Balls', state.activeBall || '')}
          <div class="base-inv-row">${ballsHtml}</div>
        </div>
        <div class="base-inv-section base-module-card">
          <div class="base-module-head">
            <span>Boosts</span>
            <div class="base-boost-tabs">
              ${[1,5,10].map(n => `<button data-boost-mult="${n}" class="${_boostMult === n ? 'active' : ''}">×${n}</button>`).join('')}
            </div>
          </div>
          <div class="base-inv-row">${boostsHtml}</div>
        </div>
        <div class="base-inv-section base-module-card">
          ${_baseModuleTitle('Objets', 'logistique')}
          <div class="base-inv-row">${craftHtml}${keysHtml}</div>
        </div>
        <div class="base-inv-section base-module-card"${incCount > 0 ? ' data-base-action="pension"' : ''}>
          ${_baseModuleTitle('Incubateurs', waitingEggs.length > 0 ? `+${waitingEggs.length}` : '')}
          ${incCount > 0
            ? `<div class="base-inc-slots">${incSlotsHtml}</div>`
            : `<div class="base-empty-note">${state.lang === 'fr' ? 'Aucun incubateur' : 'No incubators'}</div>`}
        </div>
      </section>

      <section class="base-side-panels">
        <div class="base-side-panel">
          <div class="base-side-title"><span>Agents</span><em>${focusAgents.length}/${focusState?.slots || 1}</em></div>
          <div class="base-agent-list">${agentRows}</div>
        </div>
        <div class="base-side-panel">
          <div class="base-side-title"><span>Feed</span><em>QG</em></div>
          <div class="base-feed-list">${feedItems}</div>
        </div>
        <div class="base-side-panel">
          <div class="base-side-title"><span>Zones secondaires</span><em>${sideZones.length}</em></div>
          <div class="base-zone-list">${sideZoneRows}</div>
        </div>
      </section>
    </div>

  </div>`;
}

// ── Gang Base Window — V2 ────────────────────────────────────
// Layout 3 colonnes : gauche (boss+zones) | centre (actions+inv) | droite (agents)

function renderGangBaseWindowV2() {
  const state         = globalThis.state;
  const pokeSprite    = globalThis.pokeSprite;
  const trainerSprite = globalThis.trainerSprite;
  const speciesName   = globalThis.speciesName;
  const itemSprite    = globalThis.itemSprite;
  const isBoostActive = globalThis.isBoostActive;
  const boostRemaining= globalThis.boostRemaining;
  const getPokemonPower = globalThis.getPokemonPower;

  const focusZone   = _baseFocusZone(state);
  const focusZoneId = focusZone?.id || '';
  const focusState  = focusZone ? (state.zones?.[focusZone.id] || {}) : {};
  const focusAgents = focusZone ? (state.agents || []).filter(a => a.assignedZone === focusZone.id) : [];
  const focusName   = _baseZoneName(focusZone, state);
  const focusType   = focusZone?.type || 'route';
  const focusTypeFR = BASE_ZONE_TYPE_FR[focusType] || focusType;
  const focusMeta   = _baseZoneStatus(focusZone, state, focusState, focusAgents.length);
  const isFocusOpen = !!(focusZone && globalThis.openZones?.has(focusZone.id));
  const bossTitle   = globalThis.getBossFullTitle?.() || globalThis.getTitleLabel?.(state.gang.title) || 'Boss';
  const poss        = focusMeta.possession;
  const possClass   = poss >= 70 ? 'high' : poss >= 40 ? 'med' : 'low';
  const dangerClass = focusMeta.dangerLabel.toLowerCase();
  const stateClass  = isFocusOpen ? 'ouverte' : focusAgents.length > 0 ? 'tenue' : 'libre';

  // ── Boss team (6 Pokémon) ──
  const bossTeamHtml = Array.from({length: BOSS_TEAM_SLOTS}, (_, i) => {
    const pkId = state.gang.bossTeam[i];
    const pk   = pkId ? state.pokemons.find(p => p.id === pkId) : null;
    if (pk) return `<div class="gb2-team-slot" data-boss-slot="${i}" title="${speciesName(pk.species_en)} Lv.${pk.level}">
      <img src="${pokeSprite(pk.species_en, pk.shiny)}" alt="">
      <div class="sn">${speciesName(pk.species_en)}</div>
    </div>`;
    return `<div class="gb2-team-slot empty" data-boss-slot="${i}"></div>`;
  }).join('');

  // ── Boss patches ──
  const bossPatches = (() => {
    const pids = state.cosmetics?.activePatches || [];
    const pfn  = globalThis.patchUrl;
    if (!pids.length || !pfn) return '';
    const pos = ['bottom:0;right:-2px', 'bottom:0;left:-2px', 'top:0;right:-2px'];
    return pids.slice(0, 3).map((pid, i) =>
      `<img src="${pfn(pid)}" style="position:absolute;${pos[i]};width:20px;height:20px;image-rendering:pixelated;filter:drop-shadow(0 1px 2px rgba(0,0,0,.8))" onerror="this.style.display='none'" alt="">`
    ).join('');
  })();

  // ── Zone list ──
  const unlockedZones = _baseUnlockedZones(state);
  const zoneListHtml  = unlockedZones.map(zone => {
    const zs      = state.zones?.[zone.id] || {};
    const agents  = (state.agents || []).filter(a => a.assignedZone === zone.id).length;
    const meta    = _baseZoneStatus(zone, state, zs, agents);
    const isFocus = zone.id === focusZoneId;
    const isOpen  = globalThis.openZones?.has(zone.id);
    const icon    = zone.type === 'city' ? '🏙' : zone.type === 'special' ? '⭐' : '🛤';
    const pc      = meta.possession >= 70 ? 'hi' : meta.possession >= 40 ? 'med' : '';
    return `<div class="gb2-zone-row${isFocus ? ' focus' : ''}" data-gb2-zone-select="${zone.id}">
      <span class="gb2-zone-row-icon">${icon}</span>
      <div class="gb2-zone-row-info">
        <div class="gb2-zone-row-name">${_baseZoneName(zone, state)}</div>
        <div class="gb2-zone-row-sub">${agents} agent${agents !== 1 ? 's' : ''}${isOpen ? ' · Ouverte' : ''}</div>
      </div>
      <div class="gb2-zone-row-poss ${pc}">${isOpen ? '●' : meta.possession + '%'}</div>
    </div>`;
  }).join('') || `<div class="base-empty-note">Aucun front débloqué</div>`;

  // ── Inventaire ──
  const BALL_IDS  = ['pokeball','greatball','ultraball','duskball','masterball'];
  const BOOST_IDS = ['lure','superlure','incense','rarescope','aura'];
  const CRAFT_IDS = ['rarecandy','evostone'];
  const KEY_IDS   = ['incubator','map_pallet','casino_ticket','silph_keycard','boat_ticket'];

  function _v2tile(id, isKey = false) {
    const qty      = state.inventory?.[id] || 0;
    const isBall   = BALL_IDS.includes(id);
    const isBoost  = BOOST_IDS.includes(id);
    const isActive = isBall && state.activeBall === id;
    const isBoosted= isBoost && isBoostActive?.(id);
    const owned    = qty > 0;
    const remStr   = isBoosted ? `<span class="gb2-item-rem">${Math.ceil(boostRemaining?.(id) || 0)}s</span>` : '';
    const qtyBadge = isKey
      ? `<span class="gb2-item-qty" style="color:${owned ? 'var(--green)' : 'var(--text-dim)'}">${owned ? '✓' : '✗'}</span>`
      : `<span class="gb2-item-qty">${qty > 99 ? '99+' : qty > 0 ? '×'+qty : '0'}</span>`;
    const lockCls  = isKey && !owned ? ' locked-key' : '';
    const spriteCls = !owned && !isKey ? ' locked' : '';
    return `<div class="gb2-item-tile${isActive ? ' active' : ''}${isBoosted ? ' boosted' : ''}${lockCls}" data-bag-item="${id}" title="${id}">
      <div class="${spriteCls}">${itemSprite?.(id) || ''}</div>
      ${qtyBadge}${remStr}
    </div>`;
  }

  const ballsHtml  = BALL_IDS.map(id => _v2tile(id)).join('');
  const boostsHtml = BOOST_IDS.map(id => _v2tile(id)).join('');
  const craftHtml  = CRAFT_IDS.map(id => _v2tile(id)).join('');
  const keysHtml   = KEY_IDS.map(id => _v2tile(id, true)).join('');

  // ── Incubateurs ──
  const incCount       = state.inventory?.incubator || 0;
  const eggs           = state.eggs || [];
  const incubatingEggs = eggs.filter(e => e.incubating);
  const waitingEggs    = eggs.filter(e => !e.incubating);
  const now            = Date.now();
  let   incSlotsHtml   = '';
  if (incCount > 0) {
    for (let i = 0; i < incCount; i++) {
      const egg = incubatingEggs[i];
      if (egg) {
        const isReady  = egg.status === 'ready';
        const progress = (egg.hatchAt && egg.incubatedAt)
          ? Math.min(100, Math.round((now - egg.incubatedAt) / (egg.hatchAt - egg.incubatedAt) * 100)) : 0;
        const tlm = (!isReady && egg.hatchAt) ? Math.max(0, Math.ceil((egg.hatchAt - now) / 60000)) : null;
        const eggSrc = globalThis.eggSprite?.(egg, isReady) || '';
        incSlotsHtml += `<div class="gb2-inc-slot ${isReady ? 'ready' : 'active'}" data-egg-id="${egg.id}">
          <img src="${eggSrc}" alt="">
          <div class="gb2-inc-bar"><div class="gb2-inc-fill" style="width:${isReady?100:progress}%;background:${isReady?'var(--green)':'var(--gold)'}"></div></div>
          <span class="gb2-inc-time">${isReady ? '!' : tlm !== null ? tlm+'m' : ''}</span>
        </div>`;
      } else {
        incSlotsHtml += `<div class="gb2-inc-slot empty"></div>`;
      }
    }
  }

  // ── Feed ──
  const pendingIncome = focusState?.pendingIncome || 0;
  const readyEggs     = incubatingEggs.filter(e => e.status === 'ready').length;
  const zoneDesc      = focusZone
    ? (state.lang === 'fr' ? (focusZone.desc_fr || focusZone.fr) : (focusZone.desc_en || focusZone.en))
    : 'Ouvrez une zone pour démarrer les opérations.';

  const feedHtml = [
    focusZone ? {
      tag:    focusMeta.stateLabel,
      title:  `${focusName} · ${poss}%`,
      detail: pendingIncome > 0 ? `${pendingIncome.toLocaleString()}₽ à récupérer` : zoneDesc,
      cls:    focusMeta.dangerLabel === 'Critique' || focusMeta.dangerLabel === 'Extreme' ? 'alert'
              : isFocusOpen ? 'ok' : '',
    } : null,
    readyEggs > 0
      ? { tag: 'Pension', title: `${readyEggs} œuf(s) prêt(s)`, detail: 'Incubateurs disponibles.', cls: 'ok' }
      : null,
    focusAgents.length === 0
      ? { tag: 'Cellule', title: 'Front sans agent', detail: 'Assignez un agent pour produire hors fenêtre.', cls: 'alert' }
      : null,
  ].filter(Boolean).map(item => `
    <div class="gb2-feed-item ${item.cls || ''}">
      <div class="gb2-fi-tag">${item.tag}</div>
      <div><div class="gb2-fi-title">${item.title}</div><div class="gb2-fi-detail">${item.detail}</div></div>
    </div>`).join('');

  // ── Agents ──
  const allAgents  = state.agents || [];
  const agentsHtml = allAgents.length ? allAgents.map(agent => {
    const inFocus   = agent.assignedZone === focusZoneId;
    const zoneName  = agent.assignedZone ? _baseZoneName(_baseZoneById(agent.assignedZone), state) : 'Réserve';
    const rank      = globalThis.getAgentRankLabel?.(agent.title) || BASE_RANK_FR[agent.title] || agent.title || 'Agent';
    const agPks     = (agent.team || []).map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
    const teamSlots = [0, 1, 2].map(i => {
      const pk = agPks[i];
      return pk
        ? `<div class="gb2-agent-team-slot"><img src="${pokeSprite(pk.species_en, pk.shiny)}" alt=""></div>`
        : `<div class="gb2-agent-team-slot empty"></div>`;
    }).join('');
    const isAssigned = !!agent.assignedZone;
    return `<div class="gb2-agent-card${inFocus ? ' in-focus' : ''}">
      <div class="gb2-agent-sprite-wrap">
        <img src="${agent.sprite || trainerSprite('acetrainer')}" alt="" onerror="this.src='${trainerSprite('acetrainer')}'">
      </div>
      <div class="gb2-agent-body">
        <div class="gb2-agent-name">${agent.name}</div>
        <div class="gb2-agent-rank-zone">${rank}</div>
        <div class="gb2-agent-team-row">${teamSlots}</div>
      </div>
      <div class="gb2-agent-zone-col">
        <div class="gb2-az-label">Zone</div>
        <div class="gb2-az-zone ${isAssigned ? 'assigned' : ''}">${zoneName}</div>
        <button class="gb2-agent-assign-btn ${inFocus ? 'retirer' : ''}"
          data-gb2-assign-agent="${agent.id}" data-gb2-target-zone="${focusZoneId}">
          ${inFocus ? 'Retirer' : 'Assigner'}
        </button>
      </div>
    </div>`;
  }).join('') : `<div class="base-empty-note">Aucun agent recruté</div>`;

  // ── Panneau assignation (bas colonne droite) ──
  const zapSlots = focusAgents.slice(0, 4).map(agent =>
    `<div class="gb2-zap-slot filled" title="${agent.name}">
      <img src="${agent.sprite || trainerSprite('acetrainer')}" alt="" onerror="this.src='${trainerSprite('acetrainer')}'">
      <div class="zsn">${agent.name.split(' ')[0]}</div>
    </div>`
  );
  const maxSlots = Math.min(4, Math.max(focusState.slots || 1, focusAgents.length));
  for (let i = focusAgents.length; i < maxSlots; i++) zapSlots.push(`<div class="gb2-zap-slot empty"></div>`);

  return `<div class="gang-base-window v2" id="gangBaseWin" data-base-focus-zone="${focusZoneId}">

    <!-- Header -->
    <div class="gb2-header">
      <div class="gb2-h-left">
        <span class="base-hq-icon" style="font-size:9px;padding:3px 6px">HQ</span>
        <span style="font-family:var(--font-pixel);font-size:7px;color:var(--red);margin-left:6px">${state.gang.name}</span>
        <span style="font-size:8px;color:var(--text-dim)">— ${state.gang.bossName}</span>
      </div>
      <div class="gb2-h-right">
        <span style="font-family:var(--font-pixel);font-size:7px;color:var(--gold)">₽${(state.gang.money||0).toLocaleString()}</span>
        <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">⭐${(state.gang.reputation||0).toLocaleString()}</span>
        <button class="gb-view-toggle v2-active" data-gb-view="v1" title="Vue v1 — Compacte">V1</button>
        <button class="base-export-btn" title="Exporter">📷</button>
      </div>
    </div>

    <!-- Shell 3 colonnes -->
    <div class="gb2-shell">

      <!-- ══ GAUCHE : Boss + Zones ══ -->
      <div class="gb2-left">
        <div class="gb2-boss-stage">
          <div class="gb2-boss-main">
            <div class="gb2-boss-sprite-wrap">
              ${state.gang.bossSprite
                ? `<img src="${trainerSprite(state.gang.bossSprite)}" alt="Boss" style="width:64px;height:64px;image-rendering:pixelated;filter:drop-shadow(0 0 8px rgba(204,51,51,.35))">`
                : `<div style="width:64px;height:64px;background:var(--bg-card);border:1px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--text-dim)">?</div>`}
              ${bossPatches}
            </div>
            <div style="flex:1;min-width:0">
              <div class="gb2-gang-name">${state.gang.name}</div>
              <div class="gb2-boss-title">${bossTitle}</div>
              <div class="gb2-mini-stats">
                <div class="gb2-stat"><span>${(state.gang.reputation||0) >= 1000 ? Math.floor((state.gang.reputation||0)/1000)+'k' : (state.gang.reputation||0)}</span><em>REP</em></div>
                <div class="gb2-stat"><span>${(state.pokemons||[]).length}</span><em>PKM</em></div>
                <div class="gb2-stat"><span>${(state.agents||[]).length}</span><em>AGT</em></div>
              </div>
            </div>
          </div>
        </div>
        <div class="gb2-focus-header">
          <div class="gb2-focus-zone-name">${focusName}</div>
          <div class="gb2-focus-zone-type ${focusType}">${focusTypeFR.toUpperCase()}</div>
        </div>
        <div class="gb2-possession-meter">
          <div class="gb2-poss-top">
            <div>
              <div class="gb2-poss-label">Possession</div>
              <div class="gb2-poss-val ${possClass}">${poss}%</div>
            </div>
            <div class="gb2-poss-sub">${focusAgents.length} agent(s)</div>
          </div>
          <div class="gb2-poss-bar-track"><div class="gb2-poss-bar-fill" style="width:${poss}%"></div></div>
          <div class="gb2-poss-badges">
            <span class="gb2-pbadge ${dangerClass}">${focusMeta.dangerLabel}</span>
            <span class="gb2-pbadge ${stateClass}">${focusMeta.stateLabel}</span>
          </div>
        </div>
        <div class="gb2-zone-list-wrap">
          <div class="gb2-zone-list-head">
            <span>Fronts <strong style="color:var(--text)">${unlockedZones.length}</strong></span>
          </div>
          <div>${zoneListHtml}</div>
        </div>
      </div>

      <!-- ══ CENTRE : Actions + Inventaire + Feed ══ -->
      <div class="gb2-center">
        <div class="gb2-action-bar">
          <button class="gb2-act-btn primary" data-base-command="intervene" data-zone="${focusZoneId}">⚔ Intervenir</button>
          <button class="gb2-act-btn" data-base-command="toggle-zone" data-zone="${focusZoneId}">${isFocusOpen ? 'Fermer' : 'Ouvrir'}</button>
          <button class="gb2-act-btn" data-base-command="assign-agent" data-zone="${focusZoneId}">👥 Assigner</button>
          <div class="gb2-act-sep"></div>
          <button class="gb2-act-btn warn" data-base-command="retake" data-zone="${focusZoneId}">↩ Reprendre</button>
        </div>
        <div class="gb2-center-scroll">
          <!-- Équipe du boss -->
          <div class="gb2-inv-block">
            <div class="gb2-inv-block-head">
              <span class="gb2-inv-section-label">Équipe du boss</span>
              <span class="gb2-inv-section-label" style="color:var(--text-dim)">${state.gang.bossTeam.filter(Boolean).length}/${BOSS_TEAM_SLOTS}</span>
            </div>
            <div class="gb2-team-center">
              ${Array.from({length: BOSS_TEAM_SLOTS}, (_, i) => {
                const pkId = state.gang.bossTeam[i];
                const pk   = pkId ? state.pokemons.find(p => p.id === pkId) : null;
                if (pk) {
                  const stats = globalThis.calculateStats?.(pk) || {};
                  const power = globalThis.getPokemonPower?.(pk) || 0;
                  return `<div class="gb2-boss-team-card filled" data-boss-slot="${i}" title="Retirer ${speciesName(pk.species_en)}">
                    <img src="${pokeSprite(pk.species_en, pk.shiny)}" alt="">
                    <div class="gb2-btc-name">${speciesName(pk.species_en)}${pk.shiny ? ' ✨' : ''}</div>
                    <div class="gb2-btc-level">Lv.${pk.level} ${'★'.repeat(pk.potential)}</div>
                    <div class="gb2-btc-power">${power} pw</div>
                  </div>`;
                }
                return `<div class="gb2-boss-team-card empty" data-boss-slot="${i}">
                  <span style="font-size:20px;opacity:.2">+</span>
                  <div class="gb2-btc-name" style="opacity:.4">Slot ${i+1}</div>
                </div>`;
              }).join('')}
            </div>
          </div>
          <!-- Boosts -->
          <div class="gb2-inv-block">
            <div class="gb2-inv-block-head">
              <span class="gb2-inv-section-label">Boosts</span>
              <div class="gb2-boost-tabs">
                ${[1,5,10].map(n => `<button class="gb2-boost-tab${_boostMult===n?' active':''}" data-boost-mult="${n}">×${n}</button>`).join('')}
              </div>
            </div>
            <div class="gb2-inv-row">${boostsHtml}</div>
          </div>
          <!-- Balls + Objets + Clés -->
          <div class="gb2-inv-block">
            <div class="gb2-inv-block-head">
              <span class="gb2-inv-section-label">Balls & Objets</span>
              <span class="gb2-inv-section-label" style="color:var(--text-dim)">Active : ${state.activeBall || 'pokeball'}</span>
            </div>
            <div class="gb2-inv-row">${ballsHtml}${craftHtml}${keysHtml}</div>
          </div>
          ${incCount > 0 ? `<div class="gb2-inv-block" data-base-action="pension">
            <div class="gb2-inv-block-head">
              <span class="gb2-inv-section-label">Incubateurs</span>
              ${waitingEggs.length > 0 ? `<span class="gb2-inv-section-label" style="color:var(--gold)">+${waitingEggs.length} en attente</span>` : ''}
            </div>
            <div class="gb2-inv-row">${incSlotsHtml}</div>
          </div>` : ''}
          <div class="gb2-feed-section">
            <div class="gb2-feed-lbl">Intel QG</div>
            ${feedHtml || '<div class="base-empty-note">Aucune activité récente</div>'}
          </div>
        </div>
      </div>

      <!-- ══ DROITE : Agents ══ -->
      <div class="gb2-right">
        <div class="gb2-panel-head">
          <div class="gb2-ph-title">Agents</div>
          <div class="gb2-ph-meta">${allAgents.length} opérationnel(s)</div>
        </div>
        <div class="gb2-agents-wrap">${agentsHtml}</div>
        <div class="gb2-zap">
          <div class="gb2-zap-title">Cellule assignée</div>
          <div class="gb2-zap-zone-name">${focusName}</div>
          <div class="gb2-zap-slots">${zapSlots.join('')}</div>
          <div class="gb2-zap-info">${focusAgents.length > 0 ? focusAgents.map(a => a.name).join(', ') : 'Aucun agent sur ce front'}</div>
        </div>
      </div>

    </div>
  </div>`;
}

function bindGangBaseV2(container) {
  const state     = globalThis.state;
  const BALL_IDS  = ['pokeball','greatball','ultraball','duskball','masterball'];
  const BOOST_IDS = ['lure','superlure','incense','rarescope','aura'];

  _bindViewToggle(container);

  // Commandes zone (Intervenir / Ouvrir / Assigner / Reprendre)
  container.querySelectorAll('[data-base-command]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _handleBaseCommand(btn.dataset.baseCommand, btn.dataset.zone);
    });
  });

  // Sélection zone focus (liste gauche)
  container.querySelectorAll('[data-gb2-zone-select]').forEach(el => {
    el.addEventListener('click', () => _setBaseFocusZone(el.dataset.gb2ZoneSelect));
  });

  // Assign agent rapide depuis la colonne droite
  container.querySelectorAll('[data-gb2-assign-agent]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const agentId     = btn.dataset.gb2AssignAgent;
      const targetZoneId= btn.dataset.gb2TargetZone;
      const agent       = state.agents.find(a => a.id === agentId);
      if (!agent) return;
      const isAssigned  = agent.assignedZone === targetZoneId;
      const newZone     = isAssigned ? null : (targetZoneId || null);
      if (globalThis.assignAgentToZone) globalThis.assignAgentToZone(agentId, newZone);
      else { agent.assignedZone = newZone; _save(); }
      const targetZone  = newZone ? _baseZoneById(newZone) : null;
      _notify(newZone ? `${agent.name} → ${_baseZoneName(targetZone, state)}` : `${agent.name} retiré du front`, newZone ? 'success' : '');
      _refreshBaseRuntime();
    });
  });

  // Boss team slots
  container.querySelectorAll('[data-boss-slot]').forEach(slot => {
    slot.addEventListener('click', () => {
      const idx  = parseInt(slot.dataset.bossSlot);
      const pkId = state.gang.bossTeam[idx];
      if (pkId) {
        state.gang.bossTeam.splice(idx, 1);
        _save();
        globalThis.renderZoneWindows?.();
      } else {
        globalThis.openTeamPicker('boss', null, () => globalThis.renderZoneWindows?.());
      }
      renderGangBasePanel();
    });
  });

  // Export
  container.querySelector('.base-export-btn')?.addEventListener('click', openExportModal);

  // Pension (incubateurs)
  container.querySelector('[data-base-action="pension"]')?.addEventListener('click', e => {
    if (e.target.closest('[data-egg-id]')) return;
    globalThis.pcView = 'pension';
    globalThis.switchTab('tabPC');
  });

  // Œufs prêts
  container.querySelectorAll('.gb2-inc-slot.ready[data-egg-id]').forEach(slot => {
    slot.addEventListener('click', e => {
      e.stopPropagation();
      const egg = state.eggs.find(egg => egg.id === slot.dataset.eggId);
      if (egg) globalThis.openHatchAnimation?.(egg, () => renderGangBasePanel());
    });
  });

  // Multiplicateur boosts
  container.querySelectorAll('[data-boost-mult]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _boostMult = parseInt(btn.dataset.boostMult);
      renderGangBasePanel();
    });
  });

  // Item tiles
  container.querySelectorAll('.gb2-item-tile[data-bag-item]').forEach(el => {
    el.addEventListener('click', () => {
      const id  = el.dataset.bagItem;
      const qty = state.inventory?.[id] || 0;
      if (BALL_IDS.includes(id)) {
        state.activeBall = id;
        _save();
        globalThis.renderZoneWindows?.();
        renderGangBasePanel();
        return;
      }
      if (id === 'rarecandy') { globalThis.openRareCandyPicker?.(); return; }
      if (BOOST_IDS.includes(id)) {
        const uses = Math.min(_boostMult, qty);
        if (uses > 0) {
          for (let i = 0; i < uses; i++) globalThis.activateBoost?.(id);
          _notify(`Boost ×${uses} activé — ${Math.ceil(globalThis.boostRemaining?.(id) || 0)}s`, 'success');
        }
        globalThis.renderZoneWindows?.();
        renderGangBasePanel();
      }
    });
  });
}

function _refreshBaseRuntime() {
  _save();
  _topBar();
  globalThis.renderZoneWindows?.();
  renderGangBasePanel();
  globalThis.updateZoneButtons?.();
}

function _setBaseFocusZone(zoneId, notify = false) {
  const state = globalThis.state;
  const zone = _baseZoneById(zoneId);
  if (!state || !zone) return false;
  state.gang.bossZone = zoneId;
  _save();
  globalThis.renderZoneWindows?.();
  renderGangBasePanel();
  if (notify) _notify(`Boss repositionne sur ${_baseZoneName(zone, state)}`, 'gold');
  return true;
}

function _openBaseAgentPicker(zoneId) {
  const state = globalThis.state;
  const zone = _baseZoneById(zoneId);
  if (!state || !zone) return;
  const assignedCount = (state.agents || []).filter(a => a.assignedZone === zoneId).length;
  const zoneName = _baseZoneName(zone, state);
  document.getElementById('baseAgentPickerModal')?.remove();

  const rows = (state.agents || []).map(agent => {
    const sameZone = agent.assignedZone === zoneId;
    const currentZone = agent.assignedZone ? _baseZoneName(_baseZoneById(agent.assignedZone), state) : 'Reserve';
    const rank = globalThis.getAgentRankLabel?.(agent.title) || BASE_RANK_FR[agent.title] || agent.title || 'Agent';
    return `<button class="base-picker-agent${sameZone ? ' active' : ''}" data-pick-agent="${agent.id}">
      <img src="${agent.sprite || globalThis.trainerSprite?.('acetrainer') || ''}" alt="" onerror="this.src='${globalThis.trainerSprite?.('acetrainer') || ''}'">
      <span><strong>${agent.name}</strong><em>${rank} · ${currentZone}</em></span>
      <b>${sameZone ? 'Retirer' : 'Assigner'}</b>
    </button>`;
  }).join('') || `<div class="base-empty-note">Aucun agent recrute</div>`;

  const modal = document.createElement('div');
  modal.id = 'baseAgentPickerModal';
  modal.className = 'base-command-modal';
  modal.innerHTML = `
    <div class="base-command-dialog">
      <div class="base-dialog-head">
        <span>Assigner · ${zoneName}</span>
        <button data-base-dialog-close>×</button>
      </div>
      <div class="base-dialog-sub">${assignedCount} agent(s) assigné(s)</div>
      <div class="base-picker-list">${rows}</div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector('[data-base-dialog-close]')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelectorAll('[data-pick-agent]').forEach(btn => {
    btn.addEventListener('click', () => {
      const agentId = btn.dataset.pickAgent;
      const agent = state.agents.find(a => a.id === agentId);
      if (!agent) return;
      const targetZone = agent.assignedZone === zoneId ? null : zoneId;
      if (globalThis.assignAgentToZone) globalThis.assignAgentToZone(agentId, targetZone);
      else {
        agent.assignedZone = targetZone;
        _save();
      }
      _notify(targetZone ? `${agent.name} -> ${zoneName}` : `${agent.name} retire du front`, targetZone ? 'success' : '');
      modal.remove();
      _refreshBaseRuntime();
    });
  });
}


function _handleBaseCommand(command, zoneId) {
  const state = globalThis.state;
  const zone = _baseZoneById(zoneId);
  if (!state || !zone) {
    _notify('Aucune zone disponible', 'error');
    return;
  }
  if (command === 'toggle-zone') {
    if (globalThis.openZones?.has(zoneId)) globalThis.closeZoneWindow?.(zoneId);
    else globalThis.openZoneWindow?.(zoneId);
    return;
  }
  if (command === 'assign-agent') {
    _openBaseAgentPicker(zoneId);
    return;
  }
  if (command === 'retake') {
    _setBaseFocusZone(zoneId, true);
    if (!globalThis.openZones?.has(zoneId)) globalThis.openZoneWindow?.(zoneId);
    const pendingIncome = state.zones?.[zoneId]?.pendingIncome || 0;
    if (pendingIncome > 0) globalThis.openCollectionModal?.(zoneId);
    return;
  }
  if (command === 'intervene') {
    _setBaseFocusZone(zoneId);
    const zState = globalThis.initZone?.(zoneId) || state.zones?.[zoneId] || {};
    if (zone.type === 'city' && (zState.combatsWon || 0) >= 10 && globalThis.triggerGymRaid?.(zoneId)) {
      renderGangBasePanel();
      return;
    }
    if (!globalThis.openZones?.has(zoneId)) globalThis.openZoneWindow?.(zoneId);
    _notify(`Intervention lancee sur ${_baseZoneName(zone, state)}`, 'gold');
    setTimeout(() => globalThis.tickZoneSpawn?.(zoneId), 80);
    return;
  }
}

function _bindViewToggle(container) {
  container.querySelectorAll('[data-gb-view]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _gangBaseViewMode = btn.dataset.gbView;
      const st = globalThis.state;
      if (st) { st.settings = st.settings || {}; st.settings.gangBaseView = _gangBaseViewMode; }
      _save();
      renderGangBasePanel();
    });
  });
}

function bindGangBase(container) {
  const state = globalThis.state;
  const BALL_IDS  = ['pokeball','greatball','ultraball','duskball','masterball'];
  const BOOST_IDS = ['lure','superlure','incense','rarescope','aura'];

  _bindViewToggle(container);

  container.querySelectorAll('[data-base-command]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _handleBaseCommand(btn.dataset.baseCommand, btn.dataset.zone);
    });
  });

  container.querySelectorAll('[data-base-zone-select]').forEach(btn => {
    btn.addEventListener('click', () => _setBaseFocusZone(btn.dataset.baseZoneSelect));
  });

  container.querySelectorAll('[data-base-agent]').forEach(btn => {
    btn.addEventListener('click', () => _openBaseAgentPicker(btn.dataset.baseZone));
  });

  // Boss team slot clicks
  container.querySelectorAll('[data-boss-slot]').forEach(slot => {
    slot.addEventListener('click', () => {
      const idx = parseInt(slot.dataset.bossSlot);
      const pkId = state.gang.bossTeam[idx];
      if (pkId) {
        state.gang.bossTeam.splice(idx, 1);
        _save();
        globalThis.renderZoneWindows();
      } else {
        globalThis.openTeamPicker('boss', null, () => globalThis.renderZoneWindows());
      }
    });
  });

  // Incubator section background → pension tab
  container.querySelector('[data-base-action="pension"]')?.addEventListener('click', e => {
    // Don't navigate if clicked directly on a ready egg slot
    if (e.target.closest('[data-egg-id]')) return;
    globalThis.pcView = 'pension';
    globalThis.switchTab('tabPC');
  });

  // Ready egg slots in gang base → hatch animation directly
  container.querySelectorAll('.base-inc-slot.ready[data-egg-id]').forEach(slot => {
    slot.addEventListener('click', e => {
      e.stopPropagation();
      const eggId = slot.dataset.eggId;
      const egg = state.eggs.find(egg => egg.id === eggId);
      if (!egg) return;
      globalThis.openHatchAnimation?.(egg, () => {
        renderGangBasePanel();
      });
    });
  });

  // Boost multiplier buttons
  container.querySelectorAll('[data-boost-mult]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      _boostMult = parseInt(btn.dataset.boostMult);
      renderGangBasePanel();
    });
  });

  // Item tiles
  container.querySelectorAll('.base-item-tile[data-bag-item]').forEach(el => {
    el.addEventListener('click', () => {
      const id  = el.dataset.bagItem;
      const qty = state.inventory?.[id] || 0;

      if (BALL_IDS.includes(id)) {
        state.activeBall = id;
        _save();
        globalThis.renderZoneWindows();
        renderGangBasePanel();
        return;
      }
      if (id === 'rarecandy') { globalThis.openRareCandyPicker(); return; }
      if (BOOST_IDS.includes(id)) {
        const uses = Math.min(_boostMult, qty);
        if (uses > 0) {
          for (let i = 0; i < uses; i++) globalThis.activateBoost(id);
          const rem = Math.ceil(globalThis.boostRemaining(id));
          _notify(`Boost ×${uses} activé — ${rem}s`, 'success');
        }
        globalThis.renderZoneWindows();
        renderGangBasePanel();
        return;
      }
    });
  });

  // Auto-buy ball toggle
  container.querySelectorAll('[data-auto-ball]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const ballId = btn.dataset.autoBall;
      state.settings.autoBuyBall = (state.settings.autoBuyBall === ballId) ? null : ballId;
      _save();
      renderGangBasePanel();
    });
  });

  // Export button
  container.querySelector('.base-export-btn')?.addEventListener('click', openExportModal);
}

// ── Codex Modal ───────────────────────────────────────────────

function openCodexModal() {
  const state         = globalThis.state;
  const BASE_PRICE    = globalThis.BASE_PRICE;
  const POTENTIAL_MULT= globalThis.POTENTIAL_MULT;
  const ZONE_BGS      = globalThis.ZONE_BGS;
  const pokeSprite    = globalThis.pokeSprite;
  const trainerSprite = globalThis.trainerSprite;

  const RARITY_ORDER = ['common','uncommon','rare','very_rare','legendary'];
  const RARITY_FR = { common:'Commun', uncommon:'Peu commun', rare:'Rare', very_rare:'Très rare', legendary:'Légendaire' };
  const RARITY_COLOR = { common:'#aaa', uncommon:'#5be06c', rare:'#5b9be0', very_rare:'#c05be0', legendary:'#ffcc5a' };
  const POTENTIALS = [1,2,3,4,5];
  const POT_MULT   = POTENTIAL_MULT;

  function buildPrixTab() {
    const headCells = POTENTIALS.map(p =>
      `<th style="padding:6px 10px;color:#ccc">★${p}<br><span style="font-size:8px;color:#666">×${POT_MULT[p-1]}</span></th>`
    ).join('');
    const shinyHeadCells = POTENTIALS.map(p =>
      `<th style="padding:6px 10px;color:#ffcc5a">★${p} ✨<br><span style="font-size:8px;color:#888">×${POT_MULT[p-1]*10}</span></th>`
    ).join('');

    const rows = RARITY_ORDER.map(r => {
      const base = BASE_PRICE[r];
      const cells = POTENTIALS.map(p => {
        const v = Math.round(base * POT_MULT[p-1]);
        return `<td style="padding:5px 10px;text-align:right;color:#e0e0e0">${v.toLocaleString()}₽</td>`;
      }).join('');
      const shinyCells = POTENTIALS.map(p => {
        const v = Math.round(base * POT_MULT[p-1] * 10);
        return `<td style="padding:5px 10px;text-align:right;color:#ffcc5a">${v.toLocaleString()}₽</td>`;
      }).join('');
      return `
        <tr>
          <td style="padding:5px 10px;font-weight:bold;color:${RARITY_COLOR[r]};white-space:nowrap">${RARITY_FR[r]}</td>
          <td style="padding:5px 10px;text-align:right;color:#888">${base.toLocaleString()}₽</td>
          ${cells}
        </tr>
        <tr style="background:rgba(255,204,90,0.04)">
          <td style="padding:5px 10px;font-size:9px;color:#ffcc5a;white-space:nowrap">✨ Shiny</td>
          <td style="padding:5px 10px;text-align:right;color:#ffcc5a;font-size:9px">${(base*10).toLocaleString()}₽</td>
          ${shinyCells}
        </tr>`;
    }).join('');

    return `
      <div style="overflow-x:auto">
        <table style="border-collapse:collapse;font-family:'Courier New',monospace;font-size:11px;width:100%">
          <thead>
            <tr style="border-bottom:1px solid #333">
              <th style="padding:6px 10px;text-align:left;color:#888">Rareté</th>
              <th style="padding:6px 10px;color:#888">Base</th>
              ${headCells}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="margin-top:10px;font-size:9px;color:#555;font-family:'Courier New',monospace">
        Nature : toutes les natures ont un multiplicateur moyen de ×1.0 — aucun impact sur le prix final.
      </div>`;
  }

  function buildSpawnsTab() {
    const TYPE_LABEL = { route:'🌿 Routes & Grottes', city:'⚔ Arènes', special:'⭐ Lieux Spéciaux' };
    const TYPE_COLOR = { route:'#5be06c', city:'#e05b5b', special:'#e0c05b' };
    const RARITY_C   = { common:'#aaa', uncommon:'#5be06c', rare:'#5b9be0', very_rare:'#c05be0', legendary:'#ffcc5a' };
    const GYM_LEADER_FR = {
      brock:'Pierre', misty:'Ondine', ltsurge:'Maj. Bob', erika:'Érika',
      koga:'Koga', sabrina:'Morgane', blaine:'Auguste', blue:'Blue',
    };

    const sections = { route:[], city:[], special:[] };
    for (const zone of ZONES) sections[zone.type || 'route']?.push(zone);

    let html = '';
    for (const [type, zones] of Object.entries(sections)) {
      if (!zones.length) continue;
      html += `<div style="margin-bottom:20px">
        <div style="font-family:var(--font-pixel);font-size:9px;color:${TYPE_COLOR[type]};margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,.08)">
          ${TYPE_LABEL[type]} — ${zones.length} zones
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">`;

      for (const zone of zones) {
        const bg     = ZONE_BGS[zone.id];
        const bgImg  = bg ? `url('${bg.url}'),linear-gradient(180deg,${bg.fb})` : `linear-gradient(180deg,#1a1a1a,#0d0d0d)`;

        const poolHtml = (zone.pool || []).map(en => {
          const sp  = SPECIES_BY_EN[en];
          const col = RARITY_C[sp?.rarity] || '#aaa';
          return `<div style="display:flex;flex-direction:column;align-items:center;gap:1px" title="${sp?.fr || en}">
            <img src="${pokeSprite(en)}" style="width:26px;height:26px;image-rendering:pixelated;filter:drop-shadow(0 1px 3px rgba(0,0,0,.9))">
            <div style="width:4px;height:4px;border-radius:50%;background:${col};opacity:.8"></div>
          </div>`;
        }).join('');

        const rareHtml = zone.rarePool ? `
          <div style="margin-top:6px;padding-top:5px;border-top:1px solid rgba(255,255,255,.06)">
            <span style="font-size:7px;font-family:var(--font-pixel);color:#888">✨ Rare (10%) : </span>
            ${zone.rarePool.slice(0,6).map(e => {
              const sp = SPECIES_BY_EN[e.en];
              return `<img src="${pokeSprite(e.en)}" style="width:20px;height:20px;image-rendering:pixelated;opacity:.7" title="${sp?.fr || e.en} (w:${e.w})">`;
            }).join('')}
          </div>` : '';

        const gymHtml = zone.gymLeader ? (() => {
          const lFr = GYM_LEADER_FR[zone.gymLeader] || zone.gymLeader;
          return `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;padding-top:5px;border-top:1px solid rgba(255,255,255,.06)">
            <img src="${trainerSprite(zone.gymLeader)}" style="width:28px;height:28px;image-rendering:pixelated">
            <div>
              <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold)">${lFr}</div>
              <div style="font-size:8px;color:var(--text-dim)">XP ×${zone.xpBonus}</div>
            </div>
          </div>`;
        })() : '';

        html += `<div style="border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,.08)">
          <div style="position:relative;height:44px;background-image:${bgImg};background-size:cover;background-position:center">
            <div style="position:absolute;inset:0;background:rgba(0,0,0,.55)"></div>
            <div style="position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;padding:4px 8px;height:100%">
              <div>
                <div style="font-family:var(--font-pixel);font-size:8px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.9)">${zone.fr}</div>
                <div style="font-size:7px;color:rgba(255,255,255,.5)">Rep ≥ ${zone.rep}${zone.unlockItem ? ' · 🔑' : ''}</div>
              </div>
              <div style="text-align:right;font-size:7px;color:rgba(255,255,255,.5)">
                ${zone.spawnRate ? `Spawn ×${zone.spawnRate}` : ''}
              </div>
            </div>
          </div>
          <div style="background:rgba(0,0,0,.6);padding:6px 8px">
            <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:flex-end">${poolHtml}</div>
            ${rareHtml}
            ${gymHtml}
          </div>
        </div>`;
      }
      html += '</div></div>';
    }
    return html;
  }

  const existing = document.getElementById('codexModal');
  if (existing) { existing.remove(); return; }

  const modal = document.createElement('div');
  modal.id = 'codexModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9300;background:rgba(0,0,0,.88);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow-y:auto';

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--border);border-radius:var(--radius);width:100%;max-width:800px;display:flex;flex-direction:column;gap:0">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border)">
        <span style="font-family:var(--font-pixel);font-size:11px;color:var(--gold)">📖 Codex — Référence</span>
        <button id="codexClose" style="background:transparent;border:none;color:#aaa;font-size:18px;cursor:pointer;line-height:1">×</button>
      </div>
      <div style="display:flex;gap:0;border-bottom:1px solid var(--border)">
        <button class="codex-tab active" data-ct="prix" style="font-family:var(--font-pixel);font-size:9px;padding:10px 18px;background:transparent;border:none;border-bottom:2px solid var(--gold);color:var(--gold);cursor:pointer">💰 Prix</button>
        <button class="codex-tab" data-ct="spawns" style="font-family:var(--font-pixel);font-size:9px;padding:10px 18px;background:transparent;border:none;border-bottom:2px solid transparent;color:#888;cursor:pointer">🗺 Spawns</button>
      </div>
      <div id="codexBody" style="padding:18px;overflow-y:auto;max-height:calc(100vh - 160px)">
        ${buildPrixTab()}
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.querySelector('#codexClose').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelectorAll('.codex-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.codex-tab').forEach(b => {
        b.style.borderBottom = '2px solid transparent';
        b.style.color = '#888';
      });
      btn.style.borderBottom = '2px solid var(--gold)';
      btn.style.color = 'var(--gold)';
      const body = modal.querySelector('#codexBody');
      body.innerHTML = btn.dataset.ct === 'prix' ? buildPrixTab() : buildSpawnsTab();
    });
  });
}

// ── Gang Export ───────────────────────────────────────────────

function openExportModal() {
  const opts = {
    showVitrine:  true,
    showTitres:   true,
    showBossTeam: true,
    showStats:    true,
    showBadges:   true,
    showAgents:   true,
    spriteGen:    'game',
  };

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center';

  const toggleDefs = [
    ['showVitrine',  '🎭', 'Vitrine'],
    ['showTitres',   '🏆', 'Titres'],
    ['showBossTeam', '⚔',  'Équipe Boss'],
    ['showStats',    '📊', 'Statistiques'],
    ['showBadges',   '🎖',  'Badges Pokédex'],
    ['showAgents',   '👥', 'Agents'],
  ];

  const chkStyle   = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:9px;color:var(--text);user-select:none';
  const chkInputStyle = 'width:14px;height:14px;accent-color:var(--gold);cursor:pointer';
  const radioStyle = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:9px;color:var(--text);user-select:none';

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--red);border-radius:var(--radius);
      padding:24px;max-width:480px;width:95%;display:flex;flex-direction:column;gap:16px;max-height:90vh;overflow-y:auto">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">📋 EXPORTER MON GANG</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="font-size:8px;color:var(--text-dim);font-family:var(--font-pixel);border-bottom:1px solid var(--border);padding-bottom:4px">SECTIONS À INCLURE</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px">
          ${toggleDefs.map(([key, icon, label]) => `
            <label style="${chkStyle}">
              <input type="checkbox" data-opt="${key}" ${opts[key] ? 'checked' : ''} style="${chkInputStyle}">
              ${icon} ${label}
            </label>`).join('')}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="font-size:8px;color:var(--text-dim);font-family:var(--font-pixel);border-bottom:1px solid var(--border);padding-bottom:4px">STYLE DE SPRITES</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <label style="${radioStyle}"><input type="radio" name="xpSprite" value="game" checked style="accent-color:var(--gold);cursor:pointer"> 🎮 Sprites du jeu</label>
          <label style="${radioStyle}"><input type="radio" name="xpSprite" value="gen5" style="accent-color:var(--gold);cursor:pointer"> 🖼 Showdown Gen 5 (BW)</label>
          <label style="${radioStyle}"><input type="radio" name="xpSprite" value="gen1" style="accent-color:var(--gold);cursor:pointer"> 👾 Rétro Gen 1</label>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button id="xpOpen" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:12px;background:var(--red);border:2px solid var(--red);border-radius:var(--radius-sm);color:#fff;cursor:pointer;min-width:140px">↗ Ouvrir la fiche</button>
        <button id="xpCancel" style="font-family:var(--font-pixel);font-size:8px;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">✕ Annuler</button>
      </div>
      <div style="font-size:8px;color:var(--text-dim);line-height:1.6">💡 Ctrl+P → PDF · Clic droit → Enregistrer pour PNG</div>
    </div>`;

  document.body.appendChild(modal);
  modal.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => { opts[cb.dataset.opt] = cb.checked; });
  });
  modal.querySelectorAll('input[type=radio]').forEach(r => {
    r.addEventListener('change', () => { if (r.checked) opts.spriteGen = r.value; });
  });
  modal.querySelector('#xpOpen').addEventListener('click', () => { modal.remove(); _exportAsPDF(opts); });
  modal.querySelector('#xpCancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function _exportAsPDF(opts) {
  const state = globalThis.state;
  const g    = state.gang;
  const card = buildExportCard(opts);
  const spriteLabel = { game: 'Jeu', gen5: 'Gen 5', gen1: 'Gen 1' }[opts.spriteGen] || 'Jeu';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>PokéGang — ${g.name}</title>
  <link rel="icon" href="assets/pokegang_logo/pokegang_logo_little.png">
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0404;display:flex;flex-direction:column;align-items:center;padding:54px 16px 40px;min-height:100vh}
    .toolbar{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(14,4,4,.97);border-bottom:2px solid #cc3333;display:flex;align-items:center;justify-content:space-between;padding:10px 20px;gap:12px;flex-wrap:wrap}
    .toolbar-title{font-family:'Press Start 2P',monospace;font-size:9px;color:#cc3333;white-space:nowrap}
    .toolbar-hint{font-size:9px;color:#555;flex:1;text-align:center}
    .btns{display:flex;gap:8px;flex-shrink:0}
    .btn{font-family:'Press Start 2P',monospace;font-size:8px;padding:8px 12px;border-radius:4px;cursor:pointer;border:1px solid;background:transparent;transition:all .15s}
    .btn-pdf{border-color:#aaa;color:#aaa}.btn-pdf:hover{background:rgba(255,255,255,.1)}
    .btn-png{border-color:#4fc3f7;color:#4fc3f7}.btn-png:hover{background:rgba(79,195,247,.1)}
    @media print{.toolbar{display:none!important}body{padding:0;background:#0a0404!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:5mm;size:A4 portrait;background:#0a0404}}
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-title">PokéGang — ${g.name}</span>
    <span class="toolbar-hint">Sprites : ${spriteLabel}</span>
    <div class="btns">
      <button class="btn btn-pdf" onclick="window.print()">🖨 Imprimer / PDF</button>
      <button class="btn btn-png" onclick="const el=document.querySelector('#export-card-root');if(el){el.style.outline='3px solid #4fc3f7';setTimeout(()=>el.style.outline='',2000);}alert('Clic droit sur la carte → Enregistrer l\\'image')">🖼 Aide PNG</button>
    </div>
  </div>
  ${card.outerHTML}
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { _notify('Autorise les popups pour l\'export PDF', 'error'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  _notify('📄 PDF prêt dans un nouvel onglet', 'success');
}

function buildExportCard(opts = {}) {
  const state           = globalThis.state;
  const pokeSprite      = globalThis.pokeSprite;
  const trainerSprite   = globalThis.trainerSprite;
  const speciesName     = globalThis.speciesName;
  const calculateStats  = globalThis.calculateStats;
  const calculatePrice  = globalThis.calculatePrice;
  const pokemonDisplayName = globalThis.pokemonDisplayName;
  const sanitizeSpriteName = globalThis.sanitizeSpriteName;
  const COSMETIC_BGS    = globalThis.COSMETIC_BGS;

  const g = state.gang;
  const s = state.stats;

  const LOGO_FULL  = 'assets/pokegang_logo/pokegang_logo_full_B.png';
  const LOGO_SMALL = 'assets/pokegang_logo/pokegang_logo_medium.png';

  const gen = opts.spriteGen || 'game';
  function _pkSprite(species_en, shiny) {
    if (gen === 'gen5') {
      const base = shiny ? 'gen5-shiny' : 'gen5';
      return `https://play.pokemonshowdown.com/sprites/${base}/${sanitizeSpriteName(species_en)}.png`;
    }
    if (gen === 'gen1') {
      const base = shiny ? 'gen2-shiny' : 'gen1';
      return `https://play.pokemonshowdown.com/sprites/${base}/${sanitizeSpriteName(species_en)}.png`;
    }
    return pokeSprite(species_en, shiny);
  }

  const img = (src, w, h) =>
    `<img src="${src}" width="${w}" height="${h}" style="image-rendering:pixelated;display:block;object-fit:contain" onerror="this.style.visibility='hidden'">`;
  const sec = label =>
    `<div style="font-family:'Press Start 2P',monospace;font-size:7px;color:#555;text-align:center;padding:8px 0 6px;letter-spacing:.12em">— ${label} —</div>`;
  const hr = () =>
    `<div style="height:1px;background:rgba(204,51,51,.35);margin:0 20px"></div>`;

  const bgKey   = state.cosmetics?.gameBg;
  const bgUrl   = bgKey ? COSMETIC_BGS[bgKey]?.url : null;
  const bgStyle = bgUrl
    ? `background-image:url('${bgUrl}');background-size:cover;background-position:center`
    : 'background:linear-gradient(180deg,#180606 0%,#200d0d 45%,#160808 80%,#0e0404 100%)';

  const teamPks      = g.bossTeam.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
  const mvp          = state.pokemons.length > 0
    ? state.pokemons.reduce((best, p) => calculatePrice(p) > calculatePrice(best) ? p : best)
    : null;
  const showcaseIds  = Array.from({ length: SHOWCASE_SLOTS }, (_, i) => (g.showcase?.[i] ?? null));
  const showcasePks  = showcaseIds.map(id => (id ? state.pokemons.find(p => p.id === id) : null) || null);
  const kantoCaught  = globalThis.getDexKantoCaught();
  const kantoTotal   = globalThis.KANTO_DEX_SIZE;
  const natCaught    = globalThis.getDexNationalCaught();
  const natTotal     = globalThis.NATIONAL_DEX_SIZE;
  const shinySpecies = globalThis.getShinySpeciesCount();
  const mainTitle    = globalThis.getBossFullTitle();
  const tC           = globalThis.getTitleLabel(g.titleC);
  const tD           = globalThis.getTitleLabel(g.titleD);
  const agents       = state.agents.slice(0, 16);
  const col1         = agents.slice(0, 8);
  const col2         = agents.slice(8, 16);

  const badges = [];
  if (kantoCaught >= kantoTotal)          badges.push({ label:'Kanto Complet',   color:'#ffcc5a', icon:'🏅' });
  if (natCaught >= natTotal)              badges.push({ label:'National Complet', color:'#4fc3f7', icon:'🌐' });
  if (shinySpecies >= 30)                 badges.push({ label:'Chasseur Shiny',   color:'#e879f9', icon:'✨' });
  if ((s.totalFightsWon||0) >= 100)       badges.push({ label:'Vétéran',          color:'#f97316', icon:'⚔' });
  if ((s.totalCaught||0) >= 500)          badges.push({ label:'Grand Chasseur',   color:'#22c55e', icon:'🎯' });

  function _agentRow(ag) {
    const agPks    = ag.team.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
    const zoneName = ag.assignedZone ? (ZONE_BY_ID[ag.assignedZone]?.fr || ag.assignedZone) : 'Sans zone';
    const miniPks  = agPks.slice(0, 6).map(pk =>
      `<div style="display:flex;flex-direction:column;align-items:center">
        ${img(_pkSprite(pk.species_en, pk.shiny), 30, 30)}
        <span style="font-size:6px;color:${pk.shiny ? '#ffcc5a' : '#555'}">${pk.level}</span>
      </div>`
    ).join('');
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:5px 10px;border-bottom:1px solid rgba(255,255,255,.06)">
        ${img(ag.sprite || trainerSprite('acetrainer'), 38, 38)}
        <div style="flex:0 0 105px;overflow:hidden">
          <div style="font-size:9px;color:#e0e0e0;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ag.name}</div>
          <div style="font-size:7px;color:#888">Lv.${ag.level} · ${zoneName.slice(0,14)}</div>
          <div style="font-size:6px;color:#555">ATK:${ag.stats?.combat||0} CAP:${ag.stats?.capture||0} LCK:${ag.stats?.luck||0}</div>
        </div>
        <div style="display:flex;gap:2px;flex-wrap:wrap;flex:1">${miniPks}</div>
      </div>`;
  }
  function _agentCol(list) {
    if (!list.length) return '';
    return `<div style="flex:1;min-width:0;border:1px solid rgba(255,255,255,.1);border-radius:4px;overflow:hidden">${list.map(_agentRow).join('')}</div>`;
  }

  let sections = '';

  sections += `
    <div style="text-align:center;padding:18px 0 12px;background:rgba(0,0,0,.45)">
      <img src="${LOGO_FULL}" style="height:44px;width:auto;max-width:320px" onerror="this.style.display='none'" alt="PokéGang">
    </div>${hr()}`;

  const titlesBlock = opts.showTitres ? `
    <div style="font-family:'Press Start 2P',monospace;font-size:9px;color:#ffcc5a;margin-top:2px">${mainTitle}</div>
    ${(tC||tD) ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:3px">
      ${tC ? `<span style="font-size:7px;padding:2px 8px;border-radius:10px;border:1px solid #4fc3f7;color:#4fc3f7">${tC}</span>` : ''}
      ${tD ? `<span style="font-size:7px;padding:2px 8px;border-radius:10px;border:1px solid #ce93d8;color:#ce93d8">${tD}</span>` : ''}
    </div>` : ''}` : '';

  sections += `
    <div style="display:flex;align-items:flex-start;gap:16px;padding:16px 20px 14px">
      <div style="position:relative;flex-shrink:0;width:96px;height:96px">
        ${g.bossSprite ? img(trainerSprite(g.bossSprite), 96, 96) : ''}
        ${(() => {
          const pids = globalThis.state?.cosmetics?.activePatches || [];
          const patchUrlFn = globalThis.patchUrl;
          if (!pids.length || !patchUrlFn) return '';
          const positions = ['bottom:0;right:0','bottom:0;left:0','top:0;right:0'];
          return pids.slice(0,3).map((pid,i) =>
            `<img src="${patchUrlFn(pid)}" style="position:absolute;width:28px;height:28px;${positions[i]};object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 1px 2px rgba(0,0,0,.8))" onerror="this.style.display='none'">`
          ).join('');
        })()}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:5px">
        <div style="font-family:'Press Start 2P',monospace;font-size:18px;color:#cc3333;line-height:1.2">${g.name}</div>
        <div style="font-size:10px;color:#aaa">Boss : <strong style="color:#e0e0e0">${g.bossName}</strong></div>
        ${titlesBlock}
        <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:4px">
          <span style="font-size:9px;color:#ffcc5a">⭐ ${g.reputation.toLocaleString()} rep</span>
          <span style="font-size:9px;color:#e0e0e0">₽ ${g.money.toLocaleString()}</span>
          <span style="font-size:9px;color:#888">🐾 ${state.pokemons.length} Pokémon</span>
        </div>
      </div>
    </div>${hr()}`;

  if (opts.showVitrine) {
    const showcaseHtml = showcasePks.map((pk, i) => {
      if (!pk) return `<div style="width:130px;text-align:center;opacity:.3"><div style="width:80px;height:80px;border:2px dashed rgba(255,255,255,.2);border-radius:6px;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:24px">?</div><div style="font-size:8px;color:#555;margin-top:6px">Slot ${i+1}</div></div>`;
      return `<div style="width:130px;text-align:center"><div style="display:flex;justify-content:center">${img(_pkSprite(pk.species_en,pk.shiny),80,80)}</div><div style="font-size:9px;color:${pk.shiny?'#ffcc5a':'#e0e0e0'};margin-top:6px">${pokemonDisplayName(pk)}${pk.shiny?' ✨':''}</div><div style="font-size:7px;color:#888">Lv.${pk.level} · ${'★'.repeat(pk.potential)}</div><div style="font-size:8px;color:#ffcc5a">${calculatePrice(pk).toLocaleString()}₽</div></div>`;
    }).join('');
    sections += `${sec('VITRINE')}<div style="display:flex;justify-content:center;gap:24px;padding:10px 20px 16px;flex-wrap:wrap">${showcaseHtml}</div>${hr()}`;
  }

  if (opts.showBossTeam) {
    const teamHtml = teamPks.map(pk => `
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
        <div style="display:flex;justify-content:center">${img(_pkSprite(pk.species_en,pk.shiny),72,72)}</div>
        <span style="font-size:8px;color:${pk.shiny?'#ffcc5a':'#aaa'}">${speciesName(pk.species_en)}</span>
        <span style="font-size:7px;color:#666">${'★'.repeat(pk.potential)} Lv.${pk.level}</span>
      </div>`).join('');
    const mvpHtml = mvp ? `<div style="border:2px solid #ffcc5a;border-radius:6px;padding:10px 14px;background:rgba(255,204,90,.08);text-align:center;flex-shrink:0;min-width:110px"><div style="font-size:7px;color:#ffcc5a;margin-bottom:6px;font-family:'Press Start 2P',monospace">💰 POKÉMON MVP</div><div style="display:flex;justify-content:center">${img(_pkSprite(mvp.species_en,mvp.shiny),72,72)}</div><div style="font-size:9px;color:#e0e0e0;margin-top:6px">${speciesName(mvp.species_en)}${mvp.shiny?' ✨':''}</div><div style="font-size:10px;color:#ffcc5a;font-weight:bold">${calculatePrice(mvp).toLocaleString()}₽</div></div>` : '';
    sections += `${sec('ÉQUIPE BOSS')}<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:10px 20px 16px;flex-wrap:wrap"><div style="display:flex;gap:10px;flex-wrap:wrap;flex:1">${teamHtml}</div>${mvpHtml}</div>${hr()}`;
  }

  if (opts.showStats || opts.showBadges) {
    const statRows = [
      ['⚔ Victoires', s.totalFightsWon||0, '🎯 Captures', s.totalCaught||0],
      ['✨ Chromas cap.', s.shinyCaught||0, '🌈 Espèces shiny', shinySpecies],
      ['📦 Coffres', s.chestsOpened||0, '👥 Agents', state.agents.length],
      ['₽ Actuels', `${g.money.toLocaleString()}₽`, '₽ Gagné', `${(s.totalMoneyEarned||0).toLocaleString()}₽`],
      ['📖 Kanto', `${kantoCaught}/${kantoTotal}`, '🌐 National', `${natCaught}/${natTotal}`],
    ].map(([l1,v1,l2,v2]) => `<div style="display:flex;gap:6px;padding:3px 0;font-size:9px"><span style="flex:1;color:#aaa">${l1} : <strong style="color:#e0e0e0">${v1}</strong></span><span style="flex:1;color:#aaa">${l2} : <strong style="color:#e0e0e0">${v2}</strong></span></div>`).join('');
    const badgesHtml = badges.map(b => `<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;border:1px solid ${b.color};border-radius:4px;background:rgba(0,0,0,.35)"><span style="font-size:14px">${b.icon}</span><span style="font-size:7px;color:${b.color};font-family:'Press Start 2P',monospace">${b.label}</span></div>`).join('');
    sections += `${sec('STATISTIQUES & BADGES')}<div style="display:flex;gap:20px;padding:10px 20px 16px;align-items:flex-start">${opts.showStats?`<div style="flex:1">${statRows}</div>`:''}${opts.showBadges&&badges.length?`<div style="flex:0 0 210px;display:flex;flex-direction:column;gap:6px">${badgesHtml}</div>`:''}</div>${hr()}`;
  }

  if (opts.showAgents && agents.length > 0) {
    sections += `${sec('AGENTS')}<div style="display:flex;gap:10px;padding:10px 16px 16px">${_agentCol(col1)}${col2.length?_agentCol(col2):(col1.length?'<div style="flex:1"></div>':'')}</div>${hr()}`;
  }

  sections += `<div style="display:flex;align-items:center;justify-content:center;padding:14px 0 16px;background:rgba(0,0,0,.45)"><img src="${LOGO_SMALL}" style="height:22px;width:auto;opacity:.35" onerror="this.style.display='none'" alt="PokéGang"></div>`;

  const card = document.createElement('div');
  card.id = 'export-card-root';
  card.style.cssText = ['width:794px;min-width:794px','font-family:Courier New,monospace;color:#e0e0e0','border:2px solid #cc3333;border-radius:6px;overflow:hidden','box-shadow:0 0 48px rgba(204,51,51,.28)',bgStyle,'position:relative'].join(';');
  const darkLayer = document.createElement('div');
  darkLayer.style.cssText = 'position:absolute;inset:0;background:rgba(10,4,4,.84);pointer-events:none;z-index:0';
  card.appendChild(darkLayer);
  const content = document.createElement('div');
  content.style.cssText = 'position:relative;z-index:1';
  content.innerHTML = sections;
  card.appendChild(content);
  return card;
}

// Legacy stub
function exportGangImage() { openExportModal(); }

// ── Expose ────────────────────────────────────────────────────
Object.assign(globalThis, {
  _gbase_renderGangBasePanel:      renderGangBasePanel,
  _gbase_renderGangBasePanelSync:  renderGangBasePanelSync,
  _gbase_renderGangBasePanelForce: renderGangBasePanelForce,
  _gbase_renderGangBaseWindow:     renderGangBaseWindow,
  _gbase_bindGangBase:             bindGangBase,
  _gbase_openCodexModal:           openCodexModal,
  _gbase_openExportModal:          openExportModal,
  _gbase_exportAsPDF:              _exportAsPDF,
  _gbase_exportGangImage:          exportGangImage,
  _gbase_buildExportCard:          buildExportCard,
});

export {};
