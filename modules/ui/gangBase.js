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
//    openTeamPicker, switchTab, showConfirm, buyItem
//    getBossFullTitle, getTitleLabel
//    getDexKantoCaught, getDexNationalCaught, getShinySpeciesCount
//    sanitizeSpriteName
//    openZones, pokemonById, renderZoneSelector, refreshZoneTile (Gang Park Window)
//    BASE_PRICE, POTENTIAL_MULT, COSMETIC_BGS, ZONE_BGS, SHOP_ITEMS
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
import { TRAINER_TYPES } from '../../data/trainers-data.js';

import { EventBus, EVENTS } from '../core/eventBus.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY,        { msg, type });
const _dirty  = ()               => EventBus.emit(EVENTS.STATE_DIRTY);
const _topBar = ()               => EventBus.emit(EVENTS.UI_TOPBAR_UPDATE);
const _save   = ()               => globalThis.saveState?.();
const _t      = (...a)           => globalThis.t?.(...a) ?? a[0];

// HTML escape — sécurise les strings user-input (bossName, gangName) avant injection via innerHTML
const _esc = s => String(s ?? '').replace(/[&<>"']/g, ch => (
  ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;'));

// ── Sprite helpers — wrappers lazy (résolus à l'appel, pas au chargement du module) ───
const pokeSprite    = (...a) => globalThis.pokeSprite?.(...a)    ?? '';
const trainerSprite = (...a) => globalThis.trainerSprite?.(...a) ?? '';
const speciesName   = (...a) => globalThis.speciesName?.(...a)   ?? a[0] ?? '';
const itemSprite    = (...a) => globalThis.itemSprite?.(...a)     ?? '';


/* globals ZONES, ZONE_BY_ID, SPECIES_BY_EN */

// ── Gang Base Window ──────────────────────────────────────────

let _boostMult = 1; // multiplicateur actif pour les boosts (x1/x5/x10)
let _gangBaseViewMode = 'v1'; // 'v1' | 'v2' — persisté dans state.settings.gangBaseView

const BASE_RARITY_ORDER = ['common', 'uncommon', 'rare', 'very_rare', 'legendary'];
const BASE_RANK_FR = {
  grunt: 'Grunt',
  sergent: 'Sergent',
  lieutenant: 'Lieutenant',
  commandant: 'Commandant',
  elite: 'Elite',
  general: 'General',
};

// ── Ball skins — cosmétique uniquement, débloqué via state.purchases.skin_X
// (jamais via state.inventory, contrairement aux boosts/objets empilables).
function _ballSkinPrice(id) {
  return (globalThis.SHOP_ITEMS || []).find(i => i.ballSkin === id)?.cost || 0;
}

function _fmtCompactPrice(n) {
  if (n >= 1000000) return (n / 1000000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'M₽';
  if (n >= 1000)     return (n / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'k₽';
  return n + '₽';
}

// Clic sur une tuile de ball dans le sac : si c'est un skin non débloqué,
// propose l'achat (même flux que buyItem() côté marché) au lieu d'équiper
// silencieusement un skin jamais acheté.
function _handleBallTileClick(id) {
  const state = globalThis.state;
  if (id !== 'pokeball' && !state.purchases?.[`skin_${id}`]) {
    const item = (globalThis.SHOP_ITEMS || []).find(i => i.ballSkin === id);
    if (!item) return;
    const name = state.lang === 'en' ? (item.en || item.id) : (item.fr || item.id);
    globalThis.showConfirm?.(
      _t('gang_base_buy_skin_confirm', { name, cost: item.cost.toLocaleString() }),
      () => { globalThis.buyItem?.(item); renderGangBasePanel(); },
    );
    return;
  }
  state.activeBall = id;
  _save();
  globalThis.renderZoneWindows?.();
  renderGangBasePanel();
}

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
  if (!zone) return _t('gang_base_no_front');
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
  const label = _t('rarity_' + BASE_RARITY_ORDER[Math.max(0, best)]);
  if (zone.rarePool?.length) return `${label} +`;
  return label;
}

function _baseZoneStatus(zone, state, zState, assignedCount) {
  if (!zone) return { stateLabel: '—', dangerLabel: '—' };
  const open = globalThis.openZones?.has(zone.id);
  const degraded = globalThis.isZoneDegraded?.(zone.id);
  const repGap = Math.max(0, (zone.rep || 0) - (state.gang?.reputation || 0));
  // NB : il y avait ici un pourcentage de « Possession » — une formule
  // fabriquée pour l'affichage (mastery + combats + captures + agents), qui
  // ne correspondait à aucune donnée persistée et ne pilotait aucune
  // mécanique. Retiré : les libellés ci-dessous, eux, décrivent de vraies
  // propriétés de la zone (seuil de réputation, état dégradé, occupation).
  const dangerScore = (zone.rep || 0) + (zone.type === 'city' ? 140 : 0) + (zone.type === 'special' ? 90 : 0) + (degraded ? 250 : 0);
  const dangerLabel = degraded ? _t('gang_base_danger_critical') : dangerScore >= 900 ? _t('gang_base_danger_extreme') : dangerScore >= 550 ? _t('gang_base_danger_high') : dangerScore >= 250 ? _t('gang_base_danger_moderate') : _t('gang_base_danger_low');
  const stateLabel = degraded ? _t('gang_base_state_weakened') : open ? _t('gang_base_state_open') : assignedCount > 0 ? _t('gang_base_state_held') : repGap > 0 ? _t('gang_base_state_locked') : _t('gang_base_state_available');
  return { stateLabel, dangerLabel };
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
const _CRAFT_IDS = ['evostone'];
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
    _boostMult,
  ].join('|');
}

/** Le gang base est visible uniquement sur l'onglet Zones — skip render sinon. */
function _isGangBaseVisible() {
  if (globalThis.activeTab && globalThis.activeTab !== 'tabZones') return false;
  const c = document.getElementById('gangBaseContainer');
  if (!c) return false;
  // offsetParent === null si display:none (ou ancêtre)
  return c.offsetParent !== null || c.children.length === 0; // children.length === 0 = pas encore rendu, on autorise le 1er paint
}

function _renderGangBasePanelImpl({ force = false } = {}) {
  const gangContainer = document.getElementById('gangBaseContainer');
  if (!gangContainer) return;

  // Skip si pas visible (économie CPU + DOM)
  if (!force && !_isGangBaseVisible()) {
    // On invalide la signature pour forcer un full render à la prochaine
    // visibilité — le state a peut-être changé pendant qu'on était caché.
    _lastRenderSig = '';
    return;
  }

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
      const isBall     = _BALL_IDS.includes(id);
      const isBallSkin = isBall && id !== 'pokeball';
      const qty        = id === 'pokeball' ? Infinity : (state.inventory?.[id] || 0);
      const owned      = isBallSkin ? !!state.purchases?.[`skin_${id}`] : qty > 0;
      const isBoost    = _BOOST_IDS.includes(id);
      const isActive   = isBall && state.activeBall === id;
      const isBoosted  = isBoost && isBoostActive?.(id);

      // Active/boosted classes
      tile.classList.toggle('active', isActive);
      tile.classList.toggle('boosted', !!isBoosted);
      const spriteEl = tile.querySelector('.base-item-sprite');
      if (spriteEl) spriteEl.classList.toggle('locked', !owned);

      // Quantity badge
      const qtyEl = tile.querySelector('.base-item-qty');
      if (qtyEl) {
        qtyEl.textContent = isBallSkin
          ? (owned ? '✓' : _fmtCompactPrice(_ballSkinPrice(id)))
          : owned ? (id === 'pokeball' ? '∞' : qty > 99 ? '99+' : '×' + qty) : '0';
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
      tile.title = isBallSkin
        ? `${id}${owned ? '' : ' — ' + _fmtCompactPrice(_ballSkinPrice(id))}`
        : `${id} ${id === 'pokeball' ? '∞' : '×'+qty}`;
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
      tile.title = `${id} — ${owned ? _t('gang_base_key_obtained') : _t('gang_base_key_not_obtained')}`;
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

    // 4. Territory cards — danger, rareté, état. L'ordre doit rester aligné
    // sur celui construit dans renderGangBaseWindow (territoryCards).
    const focusZone = _baseFocusZone(state);
    if (focusZone) {
      const focusState  = state.zones?.[focusZone.id] || {};
      const focusAgents = (state.agents || []).filter(a => a.assignedZone === focusZone.id);
      const focusMeta   = _baseZoneStatus(focusZone, state, focusState, focusAgents.length);
      const focusRarity = _baseZoneRarity(focusZone);
      const isFocusOpen = !!globalThis.openZones?.has(focusZone.id);

      const cards = win.querySelectorAll('.base-status-strip .base-status-card, .base-status-grid .base-status-card');
      const updates = [
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
      const html = Array.from({ length: BOSS_TEAM_SLOTS }, (_, i) => {
        const pkId = state.gang.bossTeam[i];
        const pk = pkId ? state.pokemons.find(p => p.id === pkId) : null;
        if (pk) {
          return `<div class="base-team-slot filled" data-boss-slot="${i}" title="${speciesName(pk.species_en)} Lv.${pk.level}">
            <img src="${pokeSprite(pk.species_en, pk.shiny)}" alt="${speciesName(pk.species_en)}">
          </div>`;
        }
      return `<div class="base-team-slot" data-boss-slot="${i}" title="${_t('gang_base_assign_pokemon')}">+</div>`;
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
    return `<div class="base-team-slot" data-boss-slot="${i}" title="${_t('gang_base_assign_pokemon')}">+</div>`;
  }).join('');

  // ── Item tiles
  const BALL_IDS  = ['pokeball','greatball','ultraball','duskball','masterball'];
  const BOOST_IDS = ['lure','superlure','incense','rarescope','aura'];
  const CRAFT_IDS = ['evostone'];
  const KEY_IDS   = ['incubator','map_pallet','casino_ticket','silph_keycard','boat_ticket'];

  function makeItemTile(id) {
    const isBall     = BALL_IDS.includes(id);
    const isBallSkin = isBall && id !== 'pokeball';
    const qty        = id === 'pokeball' ? Infinity : (state.inventory?.[id] || 0);
    const isBoost    = BOOST_IDS.includes(id);
    const isActive   = isBall && state.activeBall === id;
    const isBoosted  = isBoost && isBoostActive(id);
    const owned      = isBallSkin ? !!state.purchases?.[`skin_${id}`] : qty > 0;
    const remStr     = isBoosted ? `<span class="base-item-rem">${Math.ceil(boostRemaining(id))}s</span>` : '';
    const qtyBadge = isBallSkin
      ? (owned ? `<span class="base-item-qty on">✓</span>` : `<span class="base-item-qty zero">${_fmtCompactPrice(_ballSkinPrice(id))}</span>`)
      : owned
        ? `<span class="base-item-qty">${id === 'pokeball' ? '∞' : qty > 99 ? '99+' : '×'+qty}</span>`
        : `<span class="base-item-qty zero">0</span>`;
    const titleAttr = isBallSkin
      ? `${id}${owned ? '' : ' — ' + _fmtCompactPrice(_ballSkinPrice(id))}`
      : `${id} ${id === 'pokeball' ? '∞' : '×'+qty}`;
    return `<div class="base-item-tile${isActive ? ' active' : ''}${isBoosted ? ' boosted' : ''}" data-bag-item="${id}" title="${titleAttr}">
      <div class="base-item-sprite${owned ? '' : ' locked'}">${itemSprite(id)}</div>
      ${qtyBadge}${remStr}
    </div>`;
  }

  function makeKeyTile(id) {
    const qty   = state.inventory?.[id] || 0;
    const owned = qty > 0;
    const badge = owned
      ? `<span class="base-item-qty on">✓</span>`
      : `<span class="base-item-qty off">✗</span>`;
    return `<div class="base-item-tile${owned ? '' : ' locked-key'}" data-bag-item="${id}" title="${id}${owned ? _t('gang_base_key_owned') : _t('gang_base_key_missing')}">
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
            title="${egg.species_en}${isReady ? _t('gang_base_egg_ready_suffix') : timeLeftMin !== null ? ` — ${timeLeftMin}min` : ''}">
            <img src="${eggSrc}" class="base-inc-egg" alt="">
            <div class="base-inc-bar">
              <div class="base-inc-fill ${isReady ? 'done' : ''}" style="width:${isReady ? 100 : progress}%"></div>
            </div>
            ${isReady
              ? `<span class="base-inc-ready">!</span>`
              : timeLeftMin !== null ? `<span class="base-inc-time">${timeLeftMin}m</span>` : ''}
          </div>`;
      } else {
        incSlotsHtml += `<div class="base-inc-slot empty"><span class="base-inc-placeholder">🥚</span></div>`;
      }
    }
  }

  const focusZone = _baseFocusZone(state);
  const focusZoneId = focusZone?.id || '';
  const focusState = focusZone ? (state.zones?.[focusZone.id] || {}) : {};
  const focusAgents = focusZone ? (state.agents || []).filter(a => a.assignedZone === focusZone.id) : [];
  const focusName = _baseZoneName(focusZone, state);
  const focusRarity = _baseZoneRarity(focusZone);
  const focusMeta = _baseZoneStatus(focusZone, state, focusState, focusAgents.length);
  const isFocusOpen = !!(focusZone && globalThis.openZones?.has(focusZone.id));
  const bossTitle = globalThis.getBossFullTitle?.() || globalThis.getTitleLabel?.(state.gang.title) || 'Boss';
  const bossPatches = (() => {
    const pids = state.cosmetics?.activePatches || [];
    const patchUrlFn = globalThis.patchUrl;
    if (!pids.length || !patchUrlFn) return '';
    const positions = ['bottom:0;right:-4px', 'bottom:0;left:-4px', 'top:0;right:-4px'];
    return pids.slice(0, 3).map((pid, i) =>
      `<img src="${patchUrlFn(pid)}" class="base-boss-patch" style="${positions[i]}" onerror="this.style.display='none'" alt="">`
    ).join('');
  })();

  // Encart localisation boss
  const focusTypeLabel = focusZone?.type ? _t('gang_base_zone_type_' + focusZone.type) : '—';
  const locStatusClass = isFocusOpen ? 'open' : focusAgents.length ? 'held' : 'idle';
  const locAgentLine   = focusAgents.length
    ? `${focusAgents.length} agent${focusAgents.length > 1 ? 's' : ''}`
    : _t('gang_base_no_agent');
  const locationHtml = focusZone
    ? `<div class="base-boss-location">
        <span class="base-loc-pin">📍</span>
        <div class="base-loc-main">
          <span class="base-loc-name">${focusName}</span>
          <span class="base-loc-meta">${focusTypeLabel} · ${locAgentLine}</span>
        </div>
        <span class="base-loc-status ${locStatusClass}">${focusMeta.stateLabel}</span>
      </div>`
    : `<div class="base-boss-location idle">
        <span class="base-loc-pin">📍</span>
        <span class="base-loc-name">${_t('gang_base_open_zone_hint')}</span>
      </div>`;

  const territoryCards = [
    [_t('gang_base_danger'), focusMeta.dangerLabel, 'base-danger', focusMeta.dangerLabel === _t('gang_base_danger_critical') ? '100%' : focusMeta.dangerLabel === _t('gang_base_danger_extreme') ? '84%' : focusMeta.dangerLabel === _t('gang_base_danger_high') ? '66%' : focusMeta.dangerLabel === _t('gang_base_danger_moderate') ? '42%' : '22%'],
    [_t('gang_base_rarity'), focusRarity, 'base-rarity', focusRarity.includes('+') || focusRarity.includes('Legendaire') ? '86%' : focusRarity.includes('Rare') ? '66%' : '38%'],
    [_t('gang_base_state'), focusMeta.stateLabel, 'base-state', isFocusOpen ? '100%' : focusAgents.length ? '68%' : '36%'],
  ].map(([label, value, cls, fill]) => `
    <div class="base-status-card ${cls}">
      <span>${label}</span>
      <strong>${value}</strong>
      <i><b style="width:${fill}"></b></i>
    </div>`).join('');

  return `<div class="gang-base-window" id="gangBaseWin" data-base-focus-zone="${focusZoneId}">

    <div class="base-window-header base-command-header">
      <div class="base-header-gang">
        <span class="base-hq-icon">HQ</span>
        <span><strong>${_esc(state.gang.name)}</strong><em>${_esc(state.gang.bossName)} · ${bossTitle}</em></span>
      </div>
      <div class="base-header-stats">
        <span>₽${(state.gang.money || 0).toLocaleString()}</span>
        <span>⭐${(state.gang.reputation || 0).toLocaleString()}</span>
        <button class="gb-view-toggle" data-gb-view="v2" title="${_t('gang_base_view_v2')}">V2</button>
        <button class="base-export-btn" title="${_t('gang_base_export')}">📷</button>
      </div>
    </div>

    <div class="base-command-shell">
      <section class="base-command-main">
        <!-- Boss stage compact : sprite + nom/titre | localisation | équipe pleine largeur -->
        <div class="base-boss-stage base-boss-stage-compact">
          <div class="base-boss-header">
            <div class="base-boss-frame">
              ${bossPatches}
              ${state.gang.bossSprite
                ? `<img class="base-boss-sprite" src="${trainerSprite(state.gang.bossSprite)}" alt="Boss" onerror="this.src='${FALLBACK_TRAINER_SVG}';this.onerror=null">`
                : '<div class="base-boss-empty">?</div>'}
            </div>
            <div class="base-boss-info">
              <div class="base-boss-name">${_esc(state.gang.bossName)}</div>
              <div class="base-boss-title-line">${bossTitle}</div>
            </div>
          </div>
          ${locationHtml}
          <div class="base-team-slots">${bossTeamHtml}</div>
          <div class="base-boss-auto-row">
            <span class="base-boss-auto-label">⚔️ ${_t('gang_base_auto_combat')}</span>
            <button
              class="base-boss-auto-toggle${state.gang.bossAutoCombat ? ' active' : ''}"
              data-base-boss-auto
              title="${state.gang.bossAutoCombat
                ? _t('gang_base_auto_combat_on_hint')
                : _t('gang_base_auto_combat_off_hint')}"
            >${state.gang.bossAutoCombat ? 'ON' : 'OFF'}</button>
          </div>
        </div>

        <!-- Strip territoire : 4 métriques compactes en ligne -->
        <div class="base-status-strip">${territoryCards}</div>
      </section>

      <section class="base-modules-grid">
        <div class="base-inv-section base-module-card">
          ${_baseModuleTitle(_t('gang_base_balls'), state.activeBall || '')}
          <div class="base-inv-row">${ballsHtml}</div>
        </div>
        <div class="base-inv-section base-module-card">
          <div class="base-module-head">
            <span>${_t('gang_base_boosts')}</span>
            <div class="base-boost-tabs">
              ${[1,5,10,100].map(n => `<button data-boost-mult="${n}" class="${_boostMult === n ? 'active' : ''}">×${n}</button>`).join('')}
            </div>
          </div>
          <div class="base-inv-row">${boostsHtml}</div>
        </div>
        <div class="base-inv-section base-module-card">
          ${_baseModuleTitle(_t('gang_base_items'), _t('gang_base_logistics'))}
          <div class="base-inv-row">${craftHtml}${keysHtml}</div>
        </div>
        <div class="base-inv-section base-module-card"${incCount > 0 ? ' data-base-action="pension"' : ''}>
          ${_baseModuleTitle(_t('gang_base_incubators'), waitingEggs.length > 0 ? `+${waitingEggs.length}` : '')}
          ${incCount > 0
            ? `<div class="base-inc-slots">${incSlotsHtml}</div>`
            : `<div class="base-empty-note">${_t('gang_base_no_incubators')}</div>`}
        </div>
      </section>

      <!-- Side panels v1 retirés (Agents, Feed, Zones secondaires) :
           Agents → onglet Agents dédié
           Feed   → panneau notifications + BattleLog
           Zones  → zone-selector (fogmap) -->
    </div>

  </div>`;
}

// ── Gang Base Window — V2 ────────────────────────────────────
// Layout 3 colonnes : gauche (boss+zones) | centre (actions+inv) | droite (agents)

function renderGangBaseWindowV2() {
  const state         = globalThis.state;
  const isBoostActive = globalThis.isBoostActive;
  const boostRemaining= globalThis.boostRemaining;
  const getPokemonPower = globalThis.getPokemonPower;

  const focusZone   = _baseFocusZone(state);
  const focusZoneId = focusZone?.id || '';
  const focusState  = focusZone ? (state.zones?.[focusZone.id] || {}) : {};
  const focusAgents = focusZone ? (state.agents || []).filter(a => a.assignedZone === focusZone.id) : [];
  const focusName   = _baseZoneName(focusZone, state);
  const focusType   = focusZone?.type || 'route';
  const focusTypeFR = _t('gang_base_zone_type_' + focusType);
  const focusMeta   = _baseZoneStatus(focusZone, state, focusState, focusAgents.length);
  const isFocusOpen = !!(focusZone && globalThis.openZones?.has(focusZone.id));
  const bossTitle   = globalThis.getBossFullTitle?.() || globalThis.getTitleLabel?.(state.gang.title) || 'Boss';
  const dangerClass = focusMeta.dangerLabel === _t('gang_base_danger_critical') ? 'critique'
    : focusMeta.dangerLabel === _t('gang_base_danger_extreme') ? 'extreme'
    : focusMeta.dangerLabel === _t('gang_base_danger_high') ? 'eleve'
    : focusMeta.dangerLabel === _t('gang_base_danger_moderate') ? 'modere'
    : 'faible';
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
    const agents  = (state.agents || []).filter(a => a.assignedZone === zone.id).length;
    const isFocus = zone.id === focusZoneId;
    const isOpen  = globalThis.openZones?.has(zone.id);
    const icon    = zone.type === 'city' ? '🏙' : zone.type === 'special' ? '⭐' : '🛤';
    // La colonne de droite ne portait qu'un pourcentage de « Possession »
    // fabriqué ; seul le point « zone ouverte » y disait quelque chose de vrai.
    return `<div class="gb2-zone-row${isFocus ? ' focus' : ''}" data-gb2-zone-select="${zone.id}">
      <span class="gb2-zone-row-icon">${icon}</span>
      <div class="gb2-zone-row-info">
        <div class="gb2-zone-row-name">${_baseZoneName(zone, state)}</div>
        <div class="gb2-zone-row-sub">${_t('gang_base_agent_count', { n: agents })}${isOpen ? ` · ${_t('gang_base_state_open')}` : ''}</div>
      </div>
      <div class="gb2-zone-row-open">${isOpen ? '●' : ''}</div>
    </div>`;
  }).join('') || `<div class="base-empty-note">${_t('gang_base_no_unlocked_front')}</div>`;

  // ── Inventaire ──
  const BALL_IDS  = ['pokeball','greatball','ultraball','duskball','masterball'];
  const BOOST_IDS = ['lure','superlure','incense','rarescope','aura'];
  const CRAFT_IDS = ['evostone'];
  const KEY_IDS   = ['incubator','map_pallet','casino_ticket','silph_keycard','boat_ticket'];

  function _v2tile(id, isKey = false) {
    const isBall     = BALL_IDS.includes(id);
    const isBallSkin = isBall && id !== 'pokeball';
    const qty        = id === 'pokeball' ? Infinity : (state.inventory?.[id] || 0);
    const isBoost    = BOOST_IDS.includes(id);
    const isActive   = isBall && state.activeBall === id;
    const isBoosted  = isBoost && isBoostActive?.(id);
    const owned      = isBallSkin ? !!state.purchases?.[`skin_${id}`] : qty > 0;
    const remStr     = isBoosted ? `<span class="gb2-item-rem">${Math.ceil(boostRemaining?.(id) || 0)}s</span>` : '';
    const qtyBadge = isKey
      ? `<span class="gb2-item-qty ${owned ? 'on' : 'off'}">${owned ? '✓' : '✗'}</span>`
      : isBallSkin
        ? `<span class="gb2-item-qty">${owned ? '✓' : _fmtCompactPrice(_ballSkinPrice(id))}</span>`
        : `<span class="gb2-item-qty">${id === 'pokeball' ? '∞' : qty > 99 ? '99+' : qty > 0 ? '×'+qty : '0'}</span>`;
    const lockCls  = isKey && !owned ? ' locked-key' : '';
    const spriteCls = !owned && !isKey ? ' locked' : '';
    const titleAttr = isBallSkin ? `${id}${owned ? '' : ' — ' + _fmtCompactPrice(_ballSkinPrice(id))}` : id;
    return `<div class="gb2-item-tile${isActive ? ' active' : ''}${isBoosted ? ' boosted' : ''}${lockCls}" data-bag-item="${id}" title="${titleAttr}">
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
          <div class="gb2-inc-bar"><div class="gb2-inc-fill${isReady?' done':''}" style="width:${isReady?100:progress}%"></div></div>
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
  // Pas de repli sur le nom de la zone : il sert déjà de titre à la ligne de
  // feed juste en dessous, et la plupart des routes n'ont pas de description —
  // on affichait donc « Route 1 » deux fois. À défaut de description, le
  // nombre d'agents sur place dit au moins quelque chose.
  const zoneDesc      = focusZone
    ? ((state.lang === 'fr' ? focusZone.desc_fr : focusZone.desc_en)
        || _t('gang_base_agent_count', { n: focusAgents.length }))
    : _t('gang_base_start_operations_hint');

  const feedHtml = [
    focusZone ? {
      tag:    focusMeta.stateLabel,
      title:  focusName,
      detail: pendingIncome > 0 ? _t('gang_base_income_to_collect') : zoneDesc,
      cls:    focusMeta.dangerLabel === _t('gang_base_danger_critical') || focusMeta.dangerLabel === _t('gang_base_danger_extreme') ? 'alert'
              : isFocusOpen ? 'ok' : '',
    } : null,
    readyEggs > 0
      ? { tag: _t('gang_base_pension'), title: _t('gang_base_ready_eggs', { n: readyEggs }), detail: _t('gang_base_incubators_available'), cls: 'ok' }
      : null,
    focusAgents.length === 0
      ? { tag: _t('gang_base_cell'), title: _t('gang_base_front_without_agent'), detail: _t('gang_base_assign_agent_background_hint'), cls: 'alert' }
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
    const zoneName  = agent.assignedZone ? _baseZoneName(_baseZoneById(agent.assignedZone), state) : _t('gang_base_reserve');
    const rank      = globalThis.getAgentRankLabel?.(agent) || BASE_RANK_FR[agent.title] || agent.title || 'Agent';
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
        <div class="gb2-az-label">${_t('gang_base_zone')}</div>
        <div class="gb2-az-zone ${isAssigned ? 'assigned' : ''}">${zoneName}</div>
        <button class="gb2-agent-assign-btn ${inFocus ? 'retirer' : ''}"
          data-gb2-assign-agent="${agent.id}" data-gb2-target-zone="${focusZoneId}">
          ${inFocus ? _t('gang_base_remove') : _t('gang_base_assign')}
        </button>
      </div>
    </div>`;
  }).join('') : `<div class="base-empty-note">${_t('gang_base_no_recruited_agent')}</div>`;

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
        <span class="base-hq-icon gb2-hq-icon">HQ</span>
        <span class="gb2-h-name">${_esc(state.gang.name)}</span>
        <span class="gb2-h-boss">— ${_esc(state.gang.bossName)}</span>
      </div>
      <div class="gb2-h-right">
        <span class="gb2-h-money">₽${(state.gang.money||0).toLocaleString()}</span>
        <span class="gb2-h-rep">⭐${(state.gang.reputation||0).toLocaleString()}</span>
        <button class="gb-view-toggle v2-active" data-gb-view="v1" title="${_t('gang_base_view_v1')}">V1</button>
        <button class="base-export-btn" title="${_t('gang_base_export_short')}">📷</button>
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
                ? `<img src="${trainerSprite(state.gang.bossSprite)}" class="gb2-boss-sprite-img" alt="Boss" onerror="this.src='${FALLBACK_TRAINER_SVG}';this.onerror=null">`
                : `<div class="gb2-boss-placeholder">?</div>`}
              ${bossPatches}
            </div>
            <div class="gb2-boss-main-info">
              <div class="gb2-gang-name">${_esc(state.gang.name)}</div>
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
        <div class="gb2-focus-status">
          <div class="gb2-focus-status-top">${_t('gang_base_agent_count', { n: focusAgents.length })}</div>
          <div class="gb2-focus-badges">
            <span class="gb2-pbadge ${dangerClass}">${focusMeta.dangerLabel}</span>
            <span class="gb2-pbadge ${stateClass}">${focusMeta.stateLabel}</span>
          </div>
        </div>
        <div class="gb2-zone-list-wrap">
          <div class="gb2-zone-list-head">
            <span>${_t('gang_base_fronts')} <strong class="gb2-fronts-count">${unlockedZones.length}</strong></span>
          </div>
          <div>${zoneListHtml}</div>
        </div>
      </div>

      <!-- ══ CENTRE : Actions + Inventaire + Feed ══ -->
      <div class="gb2-center">
        <div class="gb2-action-bar">
          <button class="gb2-act-btn primary" data-base-command="intervene" data-zone="${focusZoneId}">⚔ ${_t('gang_base_intervene')}</button>
          <button class="gb2-act-btn" data-base-command="toggle-zone" data-zone="${focusZoneId}">${isFocusOpen ? _t('gang_base_close') : _t('gang_base_open')}</button>
          <button class="gb2-act-btn" data-base-command="assign-agent" data-zone="${focusZoneId}">👥 ${_t('gang_base_assign')}</button>
          <div class="gb2-act-sep"></div>
          <button class="gb2-act-btn warn" data-base-command="retake" data-zone="${focusZoneId}">↩ ${_t('gang_base_retake')}</button>
        </div>
        <div class="gb2-center-scroll">
          <!-- Équipe du boss -->
          <div class="gb2-inv-block">
            <div class="gb2-inv-block-head">
              <span class="gb2-inv-section-label">${_t('gang_base_boss_team')}</span>
              <span class="gb2-inv-section-label">${state.gang.bossTeam.filter(Boolean).length}/${BOSS_TEAM_SLOTS}</span>
            </div>
            <div class="gb2-team-center">
              ${Array.from({length: BOSS_TEAM_SLOTS}, (_, i) => {
                const pkId = state.gang.bossTeam[i];
                const pk   = pkId ? state.pokemons.find(p => p.id === pkId) : null;
                if (pk) {
                  const stats = globalThis.calculateStats?.(pk) || {};
                  const power = globalThis.getPokemonPower?.(pk) || 0;
                  return `<div class="gb2-boss-team-card filled" data-boss-slot="${i}" title="${_t('gang_base_remove_pokemon', { name: speciesName(pk.species_en) })}">
                    <img src="${pokeSprite(pk.species_en, pk.shiny)}" alt="">
                    <div class="gb2-btc-name">${speciesName(pk.species_en)}${pk.shiny ? ' ✨' : ''}</div>
                    <div class="gb2-btc-level">Lv.${pk.level} ${'★'.repeat(pk.potential)}</div>
                    <div class="gb2-btc-power">${power} pw</div>
                  </div>`;
                }
                return `<div class="gb2-boss-team-card empty" data-boss-slot="${i}">
                  <span class="gb2-btc-plus">+</span>
                  <div class="gb2-btc-name empty">${_t('gang_base_slot', { n: i + 1 })}</div>
                </div>`;
              }).join('')}
            </div>
          </div>
          <!-- Boosts -->
          <div class="gb2-inv-block">
            <div class="gb2-inv-block-head">
              <span class="gb2-inv-section-label">${_t('gang_base_boosts')}</span>
              <div class="gb2-boost-tabs">
                ${[1,5,10,100].map(n => `<button class="gb2-boost-tab${_boostMult===n?' active':''}" data-boost-mult="${n}">×${n}</button>`).join('')}
              </div>
            </div>
            <div class="gb2-inv-row">${boostsHtml}</div>
          </div>
          <!-- Balls + Objets + Clés -->
          <div class="gb2-inv-block">
            <div class="gb2-inv-block-head">
              <span class="gb2-inv-section-label">${_t('gang_base_balls_items')}</span>
              <span class="gb2-inv-section-label">${_t('gang_base_active_ball', { ball: state.activeBall || 'pokeball' })}</span>
            </div>
            <div class="gb2-inv-row">${ballsHtml}${craftHtml}${keysHtml}</div>
          </div>
          ${incCount > 0 ? `<div class="gb2-inv-block" data-base-action="pension">
            <div class="gb2-inv-block-head">
              <span class="gb2-inv-section-label">${_t('gang_base_incubators')}</span>
              ${waitingEggs.length > 0 ? `<span class="gb2-inv-section-label gold">${_t('gang_base_waiting_count', { n: waitingEggs.length })}</span>` : ''}
            </div>
            <div class="gb2-inv-row">${incSlotsHtml}</div>
          </div>` : ''}
          <div class="gb2-feed-section">
            <div class="gb2-feed-lbl">${_t('gang_base_hq_intel')}</div>
            ${feedHtml || `<div class="base-empty-note">${_t('gang_base_no_recent_activity')}</div>`}
          </div>
        </div>
      </div>

      <!-- ══ DROITE : Agents ══ -->
      <div class="gb2-right">
        <div class="gb2-panel-head">
          <div class="gb2-ph-title">${_t('gang_base_agents')}</div>
          <div class="gb2-ph-meta">${_t('gang_base_operational_count', { n: allAgents.length })}</div>
        </div>
        <div class="gb2-agents-wrap">${agentsHtml}</div>
        <div class="gb2-zap">
          <div class="gb2-zap-title">${_t('gang_base_assigned_cell')}</div>
          <div class="gb2-zap-zone-name">${focusName}</div>
          <div class="gb2-zap-slots">${zapSlots.join('')}</div>
          <div class="gb2-zap-info">${focusAgents.length > 0 ? focusAgents.map(a => a.name).join(', ') : _t('gang_base_no_agent_on_front')}</div>
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
      _notify(newZone
        ? _t('gang_base_agent_assigned_notice', { agent: agent.name, zone: _baseZoneName(targetZone, state) })
        : _t('gang_base_agent_removed_notice', { agent: agent.name }), newZone ? 'success' : '');
      _refreshBaseRuntime();
    });
  });

  // Boss team slots
  container.querySelectorAll('[data-boss-slot]').forEach(slot => {
    slot.addEventListener('click', () => {
      const idx  = parseInt(slot.dataset.bossSlot);
      const pkId = state.gang.bossTeam[idx];
      if (pkId) {
        // Retirer le pokémon → refresh immédiat
        state.gang.bossTeam.splice(idx, 1);
        _save();
        globalThis.renderZoneWindows?.();
        renderGangBasePanel();
      } else {
        // Ajouter via picker → refresh dans le callback, après sélection
        globalThis.openTeamPicker('boss', null, () => {
          globalThis.renderZoneWindows?.();
          renderGangBasePanel();
        });
      }
    });
  });

  // Boss auto-combat toggle (V2)
  container.querySelector('[data-base-boss-auto]')?.addEventListener('click', btn => {
    const el = btn.currentTarget;
    state.gang.bossAutoCombat = !state.gang.bossAutoCombat;
    const on = state.gang.bossAutoCombat;
    el.textContent = on ? 'ON' : 'OFF';
    el.classList.toggle('active', on);
    el.title = on
      ? _t('gang_base_auto_combat_on_hint')
      : _t('gang_base_auto_combat_off_hint');
    _save();
    _notify(on
      ? _t('gang_base_auto_enabled_notice', { boss: state.gang.bossName })
      : _t('gang_base_manual_notice', { boss: state.gang.bossName }), '');
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
        _handleBallTileClick(id);
        return;
      }
      if (BOOST_IDS.includes(id)) {
        const uses = Math.min(_boostMult, qty);
        if (uses > 0) {
          for (let i = 0; i < uses; i++) globalThis.activateBoost?.(id, { save: false });
          _save();
          _notify(_t('gang_base_boost_enabled', { n: uses, seconds: Math.ceil(globalThis.boostRemaining?.(id) || 0) }), 'success');
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
  if (notify) _notify(_t('gang_base_boss_repositioned', { zone: _baseZoneName(zone, state) }), 'gold');
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
    const currentZone = agent.assignedZone ? _baseZoneName(_baseZoneById(agent.assignedZone), state) : _t('gang_base_reserve');
    const rank = globalThis.getAgentRankLabel?.(agent) || BASE_RANK_FR[agent.title] || agent.title || 'Agent';
    return `<button class="base-picker-agent${sameZone ? ' active' : ''}" data-pick-agent="${agent.id}">
      <img src="${agent.sprite || globalThis.trainerSprite?.('acetrainer') || ''}" alt="" onerror="this.src='${globalThis.trainerSprite?.('acetrainer') || ''}'">
      <span><strong>${agent.name}</strong><em>${rank} · ${currentZone}</em></span>
      <b>${sameZone ? _t('gang_base_remove') : _t('gang_base_assign')}</b>
    </button>`;
  }).join('') || `<div class="base-empty-note">${_t('gang_base_no_recruited_agent')}</div>`;

  const modal = document.createElement('div');
  modal.id = 'baseAgentPickerModal';
  modal.className = 'base-command-modal';
  modal.innerHTML = `
    <div class="base-command-dialog">
      <div class="base-dialog-head">
        <span>${_t('gang_base_assign')} · ${zoneName}</span>
        <button data-base-dialog-close>×</button>
      </div>
      <div class="base-dialog-sub">${_t('gang_base_assigned_count', { n: assignedCount })}</div>
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
      _notify(targetZone
        ? _t('gang_base_agent_assigned_notice', { agent: agent.name, zone: zoneName })
        : _t('gang_base_agent_removed_notice', { agent: agent.name }), targetZone ? 'success' : '');
      modal.remove();
      _refreshBaseRuntime();
    });
  });
}


function _handleBaseCommand(command, zoneId) {
  const state = globalThis.state;
  const zone = _baseZoneById(zoneId);
  if (!state || !zone) {
    _notify(_t('gang_base_no_zone_available'), 'error');
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
    _notify(_t('gang_base_intervention_started', { zone: _baseZoneName(zone, state) }), 'gold');
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
        renderGangBasePanel();
      } else {
        globalThis.openTeamPicker('boss', null, () => {
          globalThis.renderZoneWindows();
          renderGangBasePanel();
        });
      }
    });
  });

  // Boss auto-combat toggle
  container.querySelector('[data-base-boss-auto]')?.addEventListener('click', btn => {
    const el = btn.currentTarget;
    state.gang.bossAutoCombat = !state.gang.bossAutoCombat;
    const on = state.gang.bossAutoCombat;
    el.textContent = on ? 'ON' : 'OFF';
    el.classList.toggle('active', on);
    el.title = on
      ? _t('gang_base_auto_combat_on_hint')
      : _t('gang_base_auto_combat_off_hint');
    _save();
    _notify(on
      ? _t('gang_base_auto_enabled_notice', { boss: state.gang.bossName })
      : _t('gang_base_manual_notice', { boss: state.gang.bossName }), '');
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
        _handleBallTileClick(id);
        return;
      }
      if (BOOST_IDS.includes(id)) {
        const uses = Math.min(_boostMult, qty);
        if (uses > 0) {
          for (let i = 0; i < uses; i++) globalThis.activateBoost(id, { save: false });
          _save();
          const rem = Math.ceil(globalThis.boostRemaining(id));
          _notify(_t('gang_base_boost_enabled', { n: uses, seconds: rem }), 'success');
        }
        globalThis.renderZoneWindows();
        renderGangBasePanel();
        return;
      }
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
  const RARITY_ORDER = ['common','uncommon','rare','very_rare','legendary'];
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
          <td style="padding:5px 10px;font-weight:bold;color:${RARITY_COLOR[r]};white-space:nowrap">${_t('rarity_' + r)}</td>
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
              <th style="padding:6px 10px;text-align:left;color:#888">${_t('gang_base_codex_rarity')}</th>
              <th style="padding:6px 10px;color:#888">${_t('gang_base_codex_base')}</th>
              ${headCells}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="margin-top:10px;font-size:9px;color:#555;font-family:'Courier New',monospace">
        ${_t('gang_base_codex_nature_note')}
      </div>`;
  }

  function buildSpawnsTab() {
    const TYPE_LABEL_KEY = { route:'gang_base_codex_type_route', city:'gang_base_codex_type_city', special:'gang_base_codex_type_special' };
    const TYPE_COLOR = { route:'#5be06c', city:'#e05b5b', special:'#e0c05b' };
    const RARITY_C   = { common:'#aaa', uncommon:'#5be06c', rare:'#5b9be0', very_rare:'#c05be0', legendary:'#ffcc5a' };

    const sections = { route:[], city:[], special:[] };
    for (const zone of ZONES) sections[zone.type || 'route']?.push(zone);

    let html = '';
    for (const [type, zones] of Object.entries(sections)) {
      if (!zones.length) continue;
      html += `<div style="margin-bottom:20px">
        <div style="font-family:var(--font-pixel);font-size:9px;color:${TYPE_COLOR[type]};margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,.08)">
          ${_t(TYPE_LABEL_KEY[type])} — ${_t('gang_base_codex_zone_count', { n: zones.length })}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">`;

      for (const zone of zones) {
        const bg     = ZONE_BGS[zone.id];
        const bgImg  = bg ? `url('${bg.url}'),linear-gradient(180deg,${bg.fb})` : `linear-gradient(180deg,#1a1a1a,#0d0d0d)`;

        const poolHtml = (zone.pool || []).map(en => {
          const sp  = SPECIES_BY_EN[en];
          const col = RARITY_C[sp?.rarity] || '#aaa';
          return `<div style="display:flex;flex-direction:column;align-items:center;gap:1px" title="${speciesName(en)}">
            <img src="${pokeSprite(en)}" style="width:26px;height:26px;image-rendering:pixelated;filter:drop-shadow(0 1px 3px rgba(0,0,0,.9))">
            <div style="width:4px;height:4px;border-radius:50%;background:${col};opacity:.8"></div>
          </div>`;
        }).join('');

        const rareHtml = zone.rarePool ? `
          <div style="margin-top:6px;padding-top:5px;border-top:1px solid rgba(255,255,255,.06)">
            <span style="font-size:7px;font-family:var(--font-pixel);color:#888">✨ ${_t('gang_base_codex_rare')} (10%) : </span>
            ${zone.rarePool.slice(0,6).map(e => {
              return `<img src="${pokeSprite(e.en)}" style="width:20px;height:20px;image-rendering:pixelated;opacity:.7" title="${speciesName(e.en)} (w:${e.w})">`;
            }).join('')}
          </div>` : '';

        const gymHtml = zone.gymLeader ? (() => {
          const gymType = TRAINER_TYPES[zone.gymLeader];
          const gymLabel = gymType ? (state.lang === 'en' ? gymType.en : gymType.fr) : zone.gymLeader;
          const gymSprite = gymType?.sprite || zone.gymLeader;
          return `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;padding-top:5px;border-top:1px solid rgba(255,255,255,.06)">
            <img src="${trainerSprite(gymSprite)}" style="width:28px;height:28px;image-rendering:pixelated">
            <div>
              <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold)">${gymLabel}</div>
              <div style="font-size:8px;color:var(--text-dim)">XP ×${zone.xpBonus}</div>
            </div>
          </div>`;
        })() : '';

        html += `<div style="border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,.08)">
          <div style="position:relative;height:44px;background-image:${bgImg};background-size:cover;background-position:center">
            <div style="position:absolute;inset:0;background:rgba(0,0,0,.55)"></div>
            <div style="position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;padding:4px 8px;height:100%">
              <div>
                <div style="font-family:var(--font-pixel);font-size:8px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.9)">${_baseZoneName(zone, state)}</div>
                <div style="font-size:7px;color:rgba(255,255,255,.5)">${_t('gang_base_codex_reputation_short')} ≥ ${zone.rep}${zone.unlockItem ? ' · 🔑' : ''}</div>
              </div>
              <div style="text-align:right;font-size:7px;color:rgba(255,255,255,.5)">
                ${zone.spawnRate ? `${_t('gang_base_codex_spawn')} ×${zone.spawnRate}` : ''}
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
        <span style="font-family:var(--font-pixel);font-size:11px;color:var(--gold)">📖 ${_t('gang_base_codex_title')}</span>
        <button id="codexClose" style="background:transparent;border:none;color:#aaa;font-size:18px;cursor:pointer;line-height:1">×</button>
      </div>
      <div style="display:flex;gap:0;border-bottom:1px solid var(--border)">
        <button class="codex-tab active" data-ct="prix" style="font-family:var(--font-pixel);font-size:9px;padding:10px 18px;background:transparent;border:none;border-bottom:2px solid var(--gold);color:var(--gold);cursor:pointer">💰 ${_t('gang_base_codex_prices')}</button>
        <button class="codex-tab" data-ct="spawns" style="font-family:var(--font-pixel);font-size:9px;padding:10px 18px;background:transparent;border:none;border-bottom:2px solid transparent;color:#888;cursor:pointer">🗺 ${_t('gang_base_codex_spawns')}</button>
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
    ['showVitrine',  '🎭', _t('gang_base_export_toggle_vitrine')],
    ['showTitres',   '🏆', _t('gang_base_export_toggle_titles')],
    ['showBossTeam', '⚔',  _t('gang_base_export_toggle_boss_team')],
    ['showStats',    '📊', _t('gang_base_export_toggle_stats')],
    ['showBadges',   '🎖',  _t('gang_base_export_toggle_badges')],
    ['showAgents',   '👥', _t('gang_base_agents')],
  ];

  const chkStyle   = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:9px;color:var(--text);user-select:none';
  const chkInputStyle = 'width:14px;height:14px;accent-color:var(--gold);cursor:pointer';
  const radioStyle = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:9px;color:var(--text);user-select:none';

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--red);border-radius:var(--radius);
      padding:24px;max-width:480px;width:95%;display:flex;flex-direction:column;gap:16px;max-height:90vh;overflow-y:auto">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">${_t('gang_base_export_modal_title')}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="font-size:8px;color:var(--text-dim);font-family:var(--font-pixel);border-bottom:1px solid var(--border);padding-bottom:4px">${_t('gang_base_export_sections_label')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px">
          ${toggleDefs.map(([key, icon, label]) => `
            <label style="${chkStyle}">
              <input type="checkbox" data-opt="${key}" ${opts[key] ? 'checked' : ''} style="${chkInputStyle}">
              ${icon} ${label}
            </label>`).join('')}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="font-size:8px;color:var(--text-dim);font-family:var(--font-pixel);border-bottom:1px solid var(--border);padding-bottom:4px">${_t('gang_base_export_sprite_style_label')}</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <label style="${radioStyle}"><input type="radio" name="xpSprite" value="game" checked class="gb-radio-gold"> ${_t('gang_base_export_sprite_game')}</label>
          <label style="${radioStyle}"><input type="radio" name="xpSprite" value="gen5" class="gb-radio-gold"> ${_t('gang_base_export_sprite_gen5')}</label>
          <label style="${radioStyle}"><input type="radio" name="xpSprite" value="gen1" class="gb-radio-gold"> ${_t('gang_base_export_sprite_gen1')}</label>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button id="xpOpen" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:12px;background:var(--red);border:2px solid var(--red);border-radius:var(--radius-sm);color:#fff;cursor:pointer;min-width:140px">${_t('gang_base_export_open_sheet')}</button>
        <button id="xpCancel" style="font-family:var(--font-pixel);font-size:8px;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">${_t('gang_base_export_cancel')}</button>
      </div>
      <div style="font-size:8px;color:var(--text-dim);line-height:1.6">${_t('gang_base_export_help_hint')}</div>
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
  const state       = globalThis.state;
  const g           = state.gang;
  const card        = buildExportCard(opts);
  const spriteLabel = {
    game: _t('gang_base_export_sprite_label_game'),
    gen5: _t('gang_base_export_sprite_label_gen5'),
    gen1: _t('gang_base_export_sprite_label_gen1'),
  }[opts.spriteGen] || _t('gang_base_export_sprite_label_game');
  const initials    = (g.name || 'PG').split(' ').map(w => (w[0] || '').toUpperCase()).join('').slice(0, 4) || 'PG';
  const htmlLang    = state.lang === 'en' ? 'en' : 'fr';

  const html = `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8">
  <title>${_esc(_t('gang_base_export_doc_title', { name: g.name }))}</title>
  <link rel="icon" href="assets/pokegang_logo/pokegang_logo_little.png">
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Special+Elite&family=Stardos+Stencil:wght@400;700&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0404;display:flex;flex-direction:column;align-items:center;padding:54px 16px 40px;min-height:100vh;font-family:'Special Elite','Courier New',monospace}
    .toolbar{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(14,4,4,.97);border-bottom:2px solid #cc3333;display:flex;align-items:center;justify-content:space-between;padding:10px 20px;gap:12px;flex-wrap:wrap}
    .toolbar::after{content:"";position:absolute;left:0;right:0;bottom:-8px;height:6px;background:repeating-linear-gradient(135deg,#1a0e0e 0 14px,#ffcc5a 14px 28px);opacity:.55}
    .toolbar-title{font-family:'Stardos Stencil',monospace;font-weight:700;font-size:13px;color:#cc3333;letter-spacing:.18em;white-space:nowrap}
    .toolbar-hint{font-size:11px;color:#777;flex:1;text-align:center;font-family:'Special Elite',monospace}
    .btns{display:flex;gap:8px;flex-shrink:0}
    .btn{font-family:'Stardos Stencil',monospace;font-size:11px;letter-spacing:.12em;padding:8px 14px;border-radius:2px;cursor:pointer;border:1px solid;background:transparent;transition:all .15s}
    .btn-pdf{border-color:#aaa;color:#aaa}.btn-pdf:hover{background:rgba(255,255,255,.1)}
    .btn-png{border-color:#4fc3f7;color:#4fc3f7}.btn-png:hover{background:rgba(79,195,247,.1)}
    @media print{.toolbar{display:none!important}body{padding:0!important;background:#0a0404!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{margin:5mm;size:A4 portrait;background:#0a0404}}
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-title">${_esc(_t('gang_base_export_toolbar_title', { name: g.name }))}</span>
    <span class="toolbar-hint">${_esc(_t('gang_base_export_toolbar_hint', { label: spriteLabel }))}</span>
    <div class="btns">
      <button class="btn btn-pdf" onclick="window.print()">${_esc(_t('gang_base_export_print_btn'))}</button>
      <button class="btn btn-png" onclick="const el=document.querySelector('#export-card-root');if(el){el.style.outline='3px solid #4fc3f7';setTimeout(()=>el.style.outline='',2000);}alert('${_esc(_t('gang_base_export_png_help_alert')).replace(/'/g, "\\'")}')">${_esc(_t('gang_base_export_png_btn'))}</button>
    </div>
  </div>
  ${card.outerHTML}
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { _notify(_t('gang_base_export_popup_blocked'), 'error'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  _notify(_t('gang_base_export_ready_notice'), 'success');
}

// ── EXPORT CARD ───────────────────────────────────────────────────────────
// ⚠️ Les styles inline ci-dessous sont DÉLIBÉRÉS : la carte d'export est
// capturée vers une image (canvas/html2canvas). Les classes externes (game-ui.css)
// ne sont PAS appliquées lors de la capture → les styles doivent être inline pour
// rendre correctement dans l'export. NE PAS extraire ces styles vers CSS.
function buildExportCard(opts = {}) {
  const state              = globalThis.state;
  const calculatePrice     = globalThis.calculatePrice;
  const pokemonDisplayName = globalThis.pokemonDisplayName;
  const sanitizeSpriteName = globalThis.sanitizeSpriteName;

  const g = state.gang;
  const s = state.stats;

  // ── Sprite helper ────────────────────────────────────────────────────────
  const gen = opts.spriteGen || 'game';
  function _pkSprite(species_en, shiny) {
    if (gen === 'gen5') {
      const base = shiny ? 'gen5-shiny' : 'gen5';
      return 'https://play.pokemonshowdown.com/sprites/' + base + '/' + sanitizeSpriteName(species_en) + '.png';
    }
    if (gen === 'gen1') {
      const base = shiny ? 'gen2-shiny' : 'gen1';
      return 'https://play.pokemonshowdown.com/sprites/' + base + '/' + sanitizeSpriteName(species_en) + '.png';
    }
    return pokeSprite(species_en, shiny);
  }

  // ── Dossier metadata ─────────────────────────────────────────────────────
  const initials  = (g.name || 'PG').split(' ').map(w => (w[0] || '').toUpperCase()).join('').slice(0, 4) || 'PG';
  const yr        = new Date().getFullYear();
  const repK      = String(Math.floor((g.reputation || 0) / 100)).padStart(3, '0');
  const fileRef   = initials + '-' + yr + '-' + repK;
  const bookingNr = initials + '—' + String(g.money || 0).replace(/(\d)(?=(\d{3})+$)/g, '$1 ');
  const dateStr   = new Date().toLocaleDateString(state.lang === 'en' ? 'en-US' : 'fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const purchases = state.purchases || {};
  const regionStr = ['KANTO',
    purchases.johtoUnlocked  ? 'JOHTO'  : null,
    purchases.hoennUnlocked  ? 'HOENN'  : null,
    purchases.sinnohUnlocked ? 'SINNOH' : null,
  ].filter(Boolean).join(' · ');

  // ── Game data ────────────────────────────────────────────────────────────
  const teamPks     = g.bossTeam.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
  const mvp         = state.pokemons.length > 0
    ? state.pokemons.reduce((best, p) => calculatePrice(p) > calculatePrice(best) ? p : best)
    : null;
  const showcaseIds = Array.from({ length: SHOWCASE_SLOTS }, (_, i) => (g.showcase?.[i] ?? null));
  const showcasePks = showcaseIds.map(id => (id ? state.pokemons.find(p => p.id === id) : null) || null);
  const kantoCaught = globalThis.getDexKantoCaught();
  const kantoTotal  = globalThis.KANTO_DEX_SIZE;
  const natCaught   = globalThis.getDexNationalCaught();
  const natTotal    = globalThis.NATIONAL_DEX_SIZE;
  const shinySpecies= globalThis.getShinySpeciesCount();
  const mainTitle   = globalThis.getBossFullTitle();
  const tC          = globalThis.getTitleLabel(g.titleC);
  const tD          = globalThis.getTitleLabel(g.titleD);
  const agents      = state.agents.slice(0, 16);

  const badges = [];
  if (kantoCaught >= kantoTotal)     badges.push({ label:_t('gang_base_export_badge_kanto_complete'),   color:'#ffcc5a', icon:'🏅' });
  if (natCaught   >= natTotal)       badges.push({ label:_t('gang_base_export_badge_national_complete'), color:'#4fc3f7', icon:'🌐' });
  if (shinySpecies >= 30)            badges.push({ label:_t('gang_base_export_badge_shiny_hunter'),   color:'#e879f9', icon:'✦' });
  if ((s.totalFightsWon||0) >= 100)  badges.push({ label:_t('gang_base_export_badge_veteran'),          color:'#f97316', icon:'⚔' });
  if ((s.totalCaught||0)   >= 500)   badges.push({ label:_t('gang_base_export_badge_master_hunter'),   color:'#22c55e', icon:'◎' });

  // ── Layout helpers ───────────────────────────────────────────────────────
  const hazardBand = (h, op, extra='') =>
    '<div style="height:' + h + 'px;background:repeating-linear-gradient(135deg,#1a0e0e 0 18px,#ffcc5a 18px 36px);opacity:' + op + (extra ? ';'+extra : '') + '"></div>';

  const sectionHdr = (label, sub) =>
    '<div style="display:flex;align-items:center;gap:10px;margin:6px 0 14px">' +
    '<div style="flex:0 0 auto;background:#cc3333;color:#070202;font-family:\'Stardos Stencil\',monospace;font-weight:700;font-size:11px;letter-spacing:.18em;padding:4px 10px">▮ ' + label + '</div>' +
    '<div style="flex:1;height:1px;background:repeating-linear-gradient(90deg,#cc3333 0 8px,transparent 8px 14px)"></div>' +
    (sub ? '<div style="font-family:\'Special Elite\',monospace;font-size:9px;color:#888;letter-spacing:.1em">— ' + sub + ' —</div>' : '') +
    '</div>';

  const perfDivider = () =>
    '<div style="height:10px;margin:6px 14px;background:radial-gradient(circle at 7px 5px,#0a0404 3px,transparent 3.5px) 0 0/14px 10px,' +
    'repeating-linear-gradient(90deg,rgba(204,51,51,.4) 0 8px,transparent 8px 12px) center/100% 1px no-repeat"></div>';

  const threatOf = pot => {
    if ((pot || 0) >= 5) return [_t('gang_base_export_threat_critical'), '#a81c1c'];
    if ((pot || 0) >= 4) return [_t('gang_base_export_threat_high'),     '#f97316'];
    if ((pot || 0) >= 3) return [_t('gang_base_export_threat_moderate'), '#ffcc5a'];
    return                     [_t('gang_base_export_threat_low'),      '#888888'];
  };

  // ── Build sections ───────────────────────────────────────────────────────
  let sections = '';

  // ─ Header strip ─────────────────────────────────────────────────────────
  sections +=
    '<div style="position:relative;z-index:2;background:#070202;border-bottom:1px solid #2a0a0a">' +
    hazardBand(14, '.85', 'border-bottom:1px solid rgba(0,0,0,.6)') +
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 22px 10px;gap:14px">' +
    '<div style="display:flex;align-items:center;gap:14px">' +
    '<div style="display:inline-block;background:#cc3333;color:#070202;font-family:\'Stardos Stencil\',monospace;font-weight:700;font-size:11px;letter-spacing:.16em;padding:5px 10px;clip-path:polygon(0 0,100% 0,calc(100% - 8px) 100%,0 100%)">' +
      _esc(_t('gang_base_export_file_no', { ref: fileRef })) +
    '</div>' +
    '<div style="font-family:\'Stardos Stencil\',monospace;font-size:10px;letter-spacing:.22em;color:#888">' + _esc(_t('gang_base_export_division', { region: regionStr })) + '</div>' +
    '</div>' +
    '<div style="font-family:\'Special Elite\',monospace;font-size:10px;color:#666;letter-spacing:.06em">' + _esc(_t('gang_base_export_opened', { date: dateStr })) + '</div>' +
    '</div>' +
    '<div style="border-top:1px solid rgba(204,51,51,.4);border-bottom:1px dashed rgba(204,51,51,.35);padding:6px 22px;font-family:\'Stardos Stencil\',monospace;font-size:10px;letter-spacing:.32em;color:#cc3333">' +
    _esc(_t('gang_base_export_classification_band')) + '</div>' +
    '</div>';

  // ─ Suspect card (manila) ─────────────────────────────────────────────────
  const pids       = state.cosmetics?.activePatches || [];
  const patchUrlFn = globalThis.patchUrl;
  const _ppos      = ['bottom:0;right:0', 'bottom:0;left:0', 'top:0;right:0'];
  const patchesHtml = (pids.length && patchUrlFn)
    ? pids.slice(0, 3).map((pid, i) =>
        '<img src="' + patchUrlFn(pid) + '" style="position:absolute;width:22px;height:22px;' + _ppos[i] + ';object-fit:contain;image-rendering:pixelated" onerror="this.style.display=\'none\'">'
      ).join('')
    : '';

  sections +=
    '<div style="position:relative;z-index:2;padding:18px 18px 14px">' +
    '<div style="position:relative;background:linear-gradient(180deg,#d8c79a 0%,#c8b783 50%,#bda671 100%);border:1px solid #6b5630;border-radius:2px;box-shadow:0 2px 0 #4a3a1f,0 6px 14px rgba(0,0,0,.5);padding:18px 18px 16px;overflow:hidden">' +
    // paper grain overlay
    '<div style="position:absolute;inset:0;background-image:repeating-linear-gradient(90deg,rgba(74,58,31,.06) 0 1px,transparent 1px 4px),repeating-linear-gradient(0deg,rgba(74,58,31,.08) 0 1px,transparent 1px 6px),radial-gradient(circle at 70% 20%,rgba(74,58,31,.18) 0,transparent 50%),radial-gradient(circle at 20% 80%,rgba(74,58,31,.15) 0,transparent 45%);pointer-events:none;mix-blend-mode:multiply"></div>' +
    // coffee stain
    '<div style="position:absolute;top:-22px;right:38px;width:64px;height:64px;border-radius:50%;background:radial-gradient(circle,rgba(94,42,18,.32) 0,rgba(94,42,18,.18) 50%,transparent 70%);pointer-events:none"></div>' +
    // CLASSIFIÉ stamp
    '<div style="position:absolute;top:8px;right:14px;transform:rotate(-9deg);font-family:\'Stardos Stencil\',monospace;font-weight:700;font-size:24px;letter-spacing:.18em;color:rgba(168,28,28,.55);border:3px solid rgba(168,28,28,.55);padding:4px 12px;border-radius:2px;pointer-events:none;mix-blend-mode:multiply">' + _esc(_t('gang_base_export_classified_stamp')) + '</div>' +
    '<div style="position:relative;display:flex;align-items:flex-start;gap:18px;z-index:1">' +
    // mugshot frame
    '<div style="flex-shrink:0;width:112px">' +
    '<div style="position:relative;width:112px;height:128px;background:linear-gradient(180deg,#1a0e08 0%,#2a1810 100%);border:2px solid #3a2410;box-shadow:inset 0 0 0 1px #6b5630,inset 0 0 22px rgba(0,0,0,.7);display:flex;align-items:flex-end;justify-content:center;overflow:hidden">' +
    '<div style="position:absolute;left:3px;top:6px;bottom:6px;display:flex;flex-direction:column;justify-content:space-between;font-family:\'Special Elite\',monospace;font-size:7px;color:rgba(216,199,154,.75);line-height:1"><span>6\'2</span><span>—</span><span>6\'0</span><span>—</span><span>5\'10</span><span>—</span><span>5\'8</span></div>' +
    (g.bossSprite
      ? '<img src="' + trainerSprite(g.bossSprite) + '" width="96" height="96" style="image-rendering:pixelated;display:block;margin-bottom:4px;filter:contrast(1.05)" onerror="this.style.visibility=\'hidden\'">'
      : '<div style="width:88px;height:88px;margin-bottom:4px;display:flex;align-items:center;justify-content:center;color:rgba(216,199,154,.3);font-size:32px">?</div>') +
    patchesHtml +
    '</div>' +
    '<div style="margin-top:4px;background:#1a0e08;border:1px solid #3a2410;color:#d8c79a;font-family:\'Stardos Stencil\',monospace;font-size:10px;letter-spacing:.16em;text-align:center;padding:3px 0">' + bookingNr + '</div>' +
    '</div>' +
    // dossier form
    '<div style="flex:1;color:#2a1a0e;min-width:0">' +
    '<div style="font-family:\'Stardos Stencil\',monospace;font-size:10px;letter-spacing:.22em;color:#5a3a1a;border-bottom:1px solid #6b5630;padding-bottom:3px;margin-bottom:8px">' + _esc(_t('gang_base_export_suspect_form')) + '</div>' +
    '<div style="font-family:\'Press Start 2P\',monospace;font-size:24px;color:#a81c1c;line-height:1.1;text-shadow:1px 1px 0 rgba(74,58,31,.35);margin-bottom:6px">' + _esc(g.name) + '</div>' +
    '<div style="display:flex;flex-direction:column;gap:3px;font-family:\'Special Elite\',monospace;font-size:11px;line-height:1.35">' +
    '<div style="display:flex;gap:6px"><span style="color:#6b5630;min-width:74px">' + _esc(_t('gang_base_export_alias')) + '</span><span style="flex:1;border-bottom:1px dotted #6b5630;color:#1a0a04;font-weight:700">' + _esc(g.bossName) + '</span></div>' +
    (opts.showTitres && mainTitle
      ? '<div style="display:flex;gap:6px"><span style="color:#6b5630;min-width:74px">' + _esc(_t('gang_base_export_title_field')) + '</span><span style="flex:1;border-bottom:1px dotted #6b5630;color:#7a4a14">' + _esc(mainTitle) + '</span></div>'
      : '') +
    ((tC || tD) && opts.showTitres
      ? '<div style="display:flex;gap:6px"><span style="color:#6b5630;min-width:74px">' + _esc(_t('gang_base_export_labels_field')) + '</span><span style="display:inline-flex;gap:4px;flex-wrap:wrap">' +
        (tC ? '<span style="font-size:9px;padding:1px 7px;border:1px solid #2a6b8a;color:#1a4a6b;background:rgba(79,195,247,.18);border-radius:1px">' + _esc(tC) + '</span>' : '') +
        (tD ? '<span style="font-size:9px;padding:1px 7px;border:1px solid #6b2a8a;color:#4a1a6b;background:rgba(206,147,216,.18);border-radius:1px">' + _esc(tD) + '</span>' : '') +
        '</span></div>'
      : '') +
    '</div>' +
    // key figures
    '<div style="display:flex;gap:16px;margin-top:10px;padding:8px 10px;background:rgba(74,58,31,.12);border:1px dashed #6b5630;border-radius:1px">' +
    '<div style="flex:1"><div style="font-family:\'Stardos Stencil\',monospace;font-size:8px;letter-spacing:.18em;color:#6b5630">' + _esc(_t('gang_base_export_reputation')) + '</div><div style="font-family:\'Press Start 2P\',monospace;font-size:11px;color:#1a0a04;margin-top:3px">' + (g.reputation || 0).toLocaleString() + '<span style="font-size:8px;color:#7a4a14"> ' + _esc(_t('gang_base_export_rep_suffix')) + '</span></div></div>' +
    '<div style="flex:1;border-left:1px dashed #6b5630;padding-left:14px"><div style="font-family:\'Stardos Stencil\',monospace;font-size:8px;letter-spacing:.18em;color:#6b5630">' + _esc(_t('gang_base_export_funds')) + '</div><div style="font-family:\'Press Start 2P\',monospace;font-size:11px;color:#1a0a04;margin-top:3px">' + (g.money || 0).toLocaleString() + '<span style="font-size:8px;color:#7a4a14"> ₽</span></div></div>' +
    '<div style="flex:1;border-left:1px dashed #6b5630;padding-left:14px"><div style="font-family:\'Stardos Stencil\',monospace;font-size:8px;letter-spacing:.18em;color:#6b5630">' + _esc(_t('gang_base_export_headcount')) + '</div><div style="font-family:\'Press Start 2P\',monospace;font-size:11px;color:#1a0a04;margin-top:3px">' + state.pokemons.length + '<span style="font-size:8px;color:#7a4a14"> pkmn</span></div></div>' +
    '</div>' +
    // signature line
    '<div style="display:flex;justify-content:space-between;font-family:\'Special Elite\',monospace;font-size:9px;color:#6b5630;margin-top:10px"><span>' + _esc(_t('gang_base_export_signature')) + '</span><span>' + _esc(_t('gang_base_export_date_field')) + '</span></div>' +
    '</div>' + // end dossier form
    '</div>' + // end flex row
    '</div>' + // end manila
    '</div>';  // end section wrapper

  // ─ Vitrine (Pièces à conviction) ─────────────────────────────────────────
  if (opts.showVitrine) {
    const polRots  = ['-1.2deg', '.8deg', '-.4deg', '1.4deg'];
    const tapeRots = ['-3deg',   '2deg',  '-1deg',  '3deg'];
    const polHtml  = showcasePks.map((pk, i) => {
      const rot  = polRots[i % 4];
      const tape = tapeRots[i % 4];
      if (!pk) {
        return '<div style="position:relative;width:158px;background:rgba(216,199,154,.08);padding:10px 10px 32px;border:1px dashed #6b5630;transform:rotate(' + rot + ');opacity:.5">' +
          '<div style="background:rgba(0,0,0,.5);height:118px;display:flex;align-items:center;justify-content:center;border:1px dashed #6b5630;font-family:\'Stardos Stencil\',monospace;font-size:11px;letter-spacing:.18em;color:#6b5630">' + _esc(_t('gang_base_export_vacant')) + '</div>' +
          '<div style="font-family:\'Special Elite\',monospace;font-size:10px;color:#6b5630;margin-top:8px">' + _esc(_t('gang_base_export_pending')) + '</div>' +
          '<div style="position:absolute;bottom:-10px;left:-8px;transform:rotate(-3deg);background:#3a2410;color:#d8c79a;font-family:\'Stardos Stencil\',monospace;font-size:9px;letter-spacing:.14em;padding:3px 8px;border:1px solid #1a0a04">Nº A-00' + (i + 1) + '</div>' +
          '</div>';
      }
      return '<div style="position:relative;width:158px;background:#ebe2cd;padding:10px 10px 32px;border:1px solid #6b5630;box-shadow:0 4px 10px rgba(0,0,0,.55);transform:rotate(' + rot + ')">' +
        '<div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%) rotate(' + tape + ');width:48px;height:14px;background:rgba(255,204,90,.55);border:1px solid rgba(107,86,48,.4);box-shadow:0 1px 2px rgba(0,0,0,.3)"></div>' +
        '<div style="background:#1a0e08;height:118px;display:flex;align-items:center;justify-content:center;border:1px solid #3a2410">' +
        '<img src="' + _pkSprite(pk.species_en, pk.shiny) + '" width="86" height="86" style="image-rendering:pixelated;filter:contrast(1.05)" onerror="this.style.visibility=\'hidden\'">' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:8px;color:#2a1a0e">' +
        '<span style="font-family:\'Special Elite\',monospace;font-size:11px;font-weight:700">' + _esc(pokemonDisplayName(pk)) + (pk.shiny ? ' ✦' : '') + '</span>' +
        '<span style="font-family:\'Special Elite\',monospace;font-size:8px;color:#7a4a14">Lv.' + (pk.level || 1) + '</span>' +
        '</div>' +
        '<div style="font-family:\'Special Elite\',monospace;font-size:8px;color:#7a4a14">' + _esc(_t('gang_base_export_potential')) + ' ' + '★'.repeat(pk.potential || 0) + '</div>' +
        '<div style="position:absolute;bottom:-10px;left:-8px;transform:rotate(-' + (3 + i) + 'deg);background:#cc3333;color:#fff;font-family:\'Stardos Stencil\',monospace;font-size:9px;letter-spacing:.14em;padding:3px 8px;border:1px solid #4a0c0c;box-shadow:0 1px 3px rgba(0,0,0,.6)">Nº A-00' + (i + 1) + ' · ' + calculatePrice(pk).toLocaleString() + '₽</div>' +
        '</div>';
    }).join('');

    sections +=
      '<div style="position:relative;z-index:2;padding:4px 22px 24px">' +
      sectionHdr(_t('gang_base_export_evidence_hdr'), _t('gang_base_export_evidence_sub')) +
      '<div style="display:flex;justify-content:center;gap:18px;flex-wrap:wrap">' + polHtml + '</div>' +
      '</div>';
    sections += perfDivider();
  }

  // ─ Boss team (Complices identifiés) ──────────────────────────────────────
  if (opts.showBossTeam) {
    const tcols        = teamPks.length > 3 ? 3 : Math.max(teamPks.length, 1);
    const mugshotsHtml = teamPks.map((pk, i) => {
      const [threat, tColor] = threatOf(pk.potential);
      return '<div style="background:linear-gradient(180deg,#1a0e08,#0a0404);border:1px solid #3a2410;padding:8px;position:relative">' +
        '<div style="position:absolute;top:-1px;left:8px;font-family:\'Stardos Stencil\',monospace;font-size:8px;color:#a81c1c;background:#0a0404;padding:0 4px;letter-spacing:.16em">Nº C-' + String(i + 1).padStart(3, '0') + '</div>' +
        '<div style="background:#070202;height:84px;display:flex;align-items:center;justify-content:center;border:1px solid #2a1810;margin-top:4px">' +
        '<img src="' + _pkSprite(pk.species_en, pk.shiny) + '" width="72" height="72" style="image-rendering:pixelated;filter:grayscale(.4) contrast(1.1)" onerror="this.style.visibility=\'hidden\'">' +
        '</div>' +
        '<div style="font-family:\'Special Elite\',monospace;font-size:10px;color:#e0e0e0;font-weight:700;margin-top:6px">' + _esc(speciesName(pk.species_en)) + (pk.shiny ? ' ✦' : '') + '</div>' +
        '<div style="display:flex;justify-content:space-between;font-family:\'Special Elite\',monospace;font-size:8px;color:#888;margin-top:1px"><span>' + '★'.repeat(pk.potential || 0) + '</span><span>Lv.' + (pk.level || 1) + '</span></div>' +
        '<div style="font-family:\'Special Elite\',monospace;font-size:7px;color:' + tColor + ';letter-spacing:.1em;margin-top:3px">' + _esc(_t('gang_base_export_threat')) + ' ' + threat + '</div>' +
        '</div>';
    }).join('');

    const mvpHtml = mvp
      ? '<div style="flex:0 0 200px;position:relative;background:linear-gradient(180deg,#2a1a08,#1a0e04);border:2px solid #ffcc5a;padding:10px;box-shadow:0 0 14px rgba(255,204,90,.25),inset 0 0 0 1px #4a3a1f">' +
        '<div style="position:absolute;top:-2px;left:-2px;width:14px;height:14px;border-top:3px solid #cc3333;border-left:3px solid #cc3333"></div>' +
        '<div style="position:absolute;top:-2px;right:-2px;width:14px;height:14px;border-top:3px solid #cc3333;border-right:3px solid #cc3333"></div>' +
        '<div style="position:absolute;bottom:-2px;left:-2px;width:14px;height:14px;border-bottom:3px solid #cc3333;border-left:3px solid #cc3333"></div>' +
        '<div style="position:absolute;bottom:-2px;right:-2px;width:14px;height:14px;border-bottom:3px solid #cc3333;border-right:3px solid #cc3333"></div>' +
        '<div style="text-align:center;font-family:\'Stardos Stencil\',monospace;font-weight:700;font-size:10px;letter-spacing:.2em;color:#ffcc5a;border-bottom:1px dashed rgba(255,204,90,.4);padding-bottom:6px;margin-bottom:8px">' + _esc(_t('gang_base_export_top_priority')) + '</div>' +
        '<div style="background:#070202;height:108px;display:flex;align-items:center;justify-content:center;border:1px solid #4a3a1f;position:relative">' +
        '<div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent 49%,rgba(204,51,51,.35) 49%,rgba(204,51,51,.35) 51%,transparent 51%),linear-gradient(0deg,transparent 49%,rgba(204,51,51,.35) 49%,rgba(204,51,51,.35) 51%,transparent 51%);mix-blend-mode:screen"></div>' +
        '<div style="position:absolute;inset:14px;border:1px dashed rgba(255,204,90,.35);border-radius:50%"></div>' +
        '<img src="' + _pkSprite(mvp.species_en, mvp.shiny) + '" width="92" height="92" style="image-rendering:pixelated;position:relative" onerror="this.style.visibility=\'hidden\'">' +
        '</div>' +
        '<div style="text-align:center;font-family:\'Special Elite\',monospace;font-size:12px;color:#fff;margin-top:8px;font-weight:700">' + _esc(speciesName(mvp.species_en)) + (mvp.shiny ? ' ✦' : '') + '</div>' +
        '<div style="text-align:center;font-family:\'Stardos Stencil\',monospace;font-size:9px;letter-spacing:.18em;color:#ffcc5a;margin-top:2px">' + _esc(_t('gang_base_export_bounty')) + ' ' + calculatePrice(mvp).toLocaleString() + ' ₽</div>' +
        '</div>'
      : '';

    sections +=
      '<div style="position:relative;z-index:2;padding:6px 22px 14px">' +
      sectionHdr(_t('gang_base_export_accomplices_hdr'), _t('gang_base_export_accomplices_sub')) +
      '<div style="display:flex;align-items:flex-start;gap:14px">' +
      (teamPks.length
        ? '<div style="flex:1;display:grid;grid-template-columns:repeat(' + tcols + ',1fr);gap:10px">' + mugshotsHtml + '</div>'
        : '<div style="flex:1;font-family:\'Special Elite\',monospace;font-size:11px;color:#555;padding:10px 0">' + _esc(_t('gang_base_export_no_accomplice')) + '</div>') +
      mvpHtml +
      '</div>' +
      '</div>';
    sections += perfDivider();
  }

  // ─ Stats + Badges (Casier judiciaire) ────────────────────────────────────
  if (opts.showStats || opts.showBadges) {
    const statEntries = [
      [_t('gang_base_export_stat_wins'),     (s.totalFightsWon || 0).toLocaleString(),         '#fff'],
      [_t('gang_base_export_stat_catches'),      (s.totalCaught    || 0).toLocaleString(),         '#fff'],
      [_t('gang_base_export_stat_shinies'),  (s.shinyCaught    || 0).toLocaleString(),         '#ffcc5a'],
      [_t('gang_base_export_stat_shiny_species'), String(shinySpecies),                        '#ffcc5a'],
      [_t('gang_base_export_stat_chests'),       (s.chestsOpened   || 0).toLocaleString(),         '#fff'],
      [_t('gang_base_export_stat_agents'),        String(state.agents.length),                      '#fff'],
      [_t('gang_base_export_stat_money_now'),       (g.money           || 0).toLocaleString() + '₽','#fff'],
      [_t('gang_base_export_stat_money_total'),   (s.totalMoneyEarned||0).toLocaleString() + '₽','#fff'],
      [_t('gang_base_export_stat_kanto'),         kantoCaught + ' / ' + kantoTotal,       '#4fc3f7'],
      [_t('gang_base_export_stat_national'),      natCaught   + ' / ' + natTotal,         '#fff'],
    ];
    const statRowsHtml = opts.showStats
      ? statEntries.map(([label, value, color]) =>
          '<div style="display:flex;align-items:baseline;gap:6px;padding:4px 0;border-bottom:1px dotted rgba(204,51,51,.18)">' +
          '<span style="color:#888;font-family:\'Special Elite\',monospace;font-size:11px">' + label + '</span>' +
          '<span style="flex:1;border-bottom:1px dotted rgba(170,170,170,.18);min-height:1px"></span>' +
          '<span style="color:' + color + ';font-weight:700;font-family:\'Special Elite\',monospace;font-size:11px">' + value + '</span>' +
          '</div>'
        ).join('')
      : '';

    const badgesHtml = opts.showBadges && badges.length
      ? badges.map(b =>
          '<div style="position:relative;background:linear-gradient(180deg,rgba(26,14,8,.9),rgba(14,6,4,.9));border:1px solid ' + b.color + ';padding:6px 12px 6px 22px;display:flex;align-items:center;gap:8px">' +
          '<span style="position:absolute;left:6px;top:50%;transform:translateY(-50%);width:8px;height:8px;border-radius:50%;background:' + b.color + ';box-shadow:0 0 4px ' + b.color + '"></span>' +
          '<span style="font-size:13px">' + b.icon + '</span>' +
          '<span style="font-family:\'Stardos Stencil\',monospace;font-size:9px;letter-spacing:.12em;color:' + b.color + '">' + b.label + '</span>' +
          '</div>'
        ).join('')
      : '';

    sections +=
      '<div style="position:relative;z-index:2;padding:6px 22px 14px">' +
      sectionHdr(_t('gang_base_export_record_hdr'), _t('gang_base_export_record_sub')) +
      '<div style="display:flex;gap:16px;align-items:flex-start">' +
      (opts.showStats
        ? '<div style="flex:1;background:linear-gradient(180deg,rgba(216,199,154,.04),rgba(216,199,154,.02));border:1px solid rgba(107,86,48,.45);padding:12px 14px;position:relative">' +
          '<div style="position:absolute;top:-7px;left:10px;background:#0a0404;padding:0 6px;font-family:\'Stardos Stencil\',monospace;font-size:9px;letter-spacing:.18em;color:#cc3333">' + _esc(_t('gang_base_export_form_ref')) + '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 22px">' + statRowsHtml + '</div>' +
          '</div>'
        : '') +
      (opts.showBadges && badges.length
        ? '<div style="flex:0 0 210px;display:flex;flex-direction:column;gap:8px">' +
          '<div style="font-family:\'Stardos Stencil\',monospace;font-size:9px;letter-spacing:.2em;color:#888;text-align:right">' + _esc(_t('gang_base_export_distinctions')) + '</div>' +
          badgesHtml +
          '</div>'
        : '') +
      '</div>' +
      '</div>';
    sections += perfDivider();
  }

  // ─ Agents (Informants) ────────────────────────────────────────────────────
  if (opts.showAgents && agents.length > 0) {
    const agRowsHtml = agents.map((ag, idx) => {
      const agPks    = ag.team.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
      const zoneName = ag.assignedZone ? _baseZoneName(ZONE_BY_ID[ag.assignedZone], state) : _t('gang_base_reserve');
      const miniPks  = agPks.slice(0, 3).map(pk =>
        '<div style="display:flex;flex-direction:column;align-items:center">' +
        '<img src="' + _pkSprite(pk.species_en, pk.shiny) + '" width="30" height="30" style="image-rendering:pixelated" onerror="this.style.visibility=\'hidden\'">' +
        '<span style="font-size:6px;color:#555">' + (pk.level || 1) + '</span>' +
        '</div>'
      ).join('');
      return '<div style="display:flex;align-items:center;gap:8px;background:linear-gradient(180deg,#1a0e08,#0e0606);border:1px solid #2a1810;border-left:3px solid #cc3333;padding:6px 8px;position:relative">' +
        '<div style="position:absolute;top:2px;right:6px;font-family:\'Special Elite\',monospace;font-size:7px;color:#555;letter-spacing:.1em">Nº I-' + String(idx + 1).padStart(2, '0') + '</div>' +
        '<img src="' + (ag.sprite || trainerSprite('acetrainer')) + '" width="38" height="38" style="image-rendering:pixelated;filter:grayscale(.3)" onerror="this.style.visibility=\'hidden\'">' +
        '<div style="flex:0 0 110px;overflow:hidden">' +
        '<div style="font-family:\'Special Elite\',monospace;font-size:11px;color:#e0e0e0;font-weight:700">' + _esc(ag.name) + ' <span style="color:#888;font-size:9px;font-weight:400">Lv.' + (ag.level || 1) + '</span></div>' +
        '<div style="font-family:\'Special Elite\',monospace;font-size:8px;color:#888">' + _esc(zoneName.slice(0, 16)) + '</div>' +
        '<div style="font-family:\'Special Elite\',monospace;font-size:7px;color:#555">ATK:' + (ag.stats?.combat || 0) + ' CAP:' + (ag.stats?.capture || 0) + ' LCK:' + (ag.stats?.luck || 0) + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:4px;flex:1">' + miniPks + '</div>' +
        '</div>';
    }).join('');

    sections +=
      '<div style="position:relative;z-index:2;padding:6px 22px 18px">' +
      sectionHdr(_t('gang_base_export_informants_hdr'), _t('gang_base_export_informants_sub')) +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 10px">' + agRowsHtml + '</div>' +
      '</div>';
  }

  // ─ Footer ─────────────────────────────────────────────────────────────────
  sections +=
    '<div style="position:relative;z-index:2;background:#070202;border-top:1px solid #2a0a0a;margin-top:6px">' +
    '<div style="display:flex;align-items:center;gap:14px;padding:14px 22px">' +
    '<div style="flex:0 0 auto;transform:rotate(-4deg);font-family:\'Stardos Stencil\',monospace;font-weight:700;font-size:14px;letter-spacing:.18em;color:rgba(204,51,51,.6);border:2px solid rgba(204,51,51,.6);padding:3px 10px">' + _esc(_t('gang_base_export_end_of_file')) + '</div>' +
    '<div style="flex:1;font-family:\'Special Elite\',monospace;font-size:9px;color:#666;text-align:center;line-height:1.5">' +
    '<div>' + _esc(_t('gang_base_export_footer_quote')) + '</div>' +
    '<div style="color:#444;margin-top:2px">' + _esc(_t('gang_base_export_footer_bureau', { region: regionStr, yr: String(yr) })) + '</div>' +
    '</div>' +
    '<div style="font-family:\'Stardos Stencil\',monospace;font-size:10px;letter-spacing:.16em;color:#cc3333;text-align:right">' + _esc(_t('gang_base_export_page')) + '</div>' +
    '</div>' +
    hazardBand(14, '.85', 'border-top:1px solid rgba(0,0,0,.6)') +
    '</div>';

  // ── Assemble DOM card ─────────────────────────────────────────────────────
  const card = document.createElement('div');
  card.id = 'export-card-root';
  card.style.cssText = [
    'width:794px;min-width:794px',
    "font-family:'Special Elite','Courier New',monospace;color:#e0e0e0",
    'border:3px double #cc3333;border-radius:2px',
    'box-shadow:0 0 48px rgba(204,51,51,.4),inset 0 0 0 1px rgba(0,0,0,.4)',
    'background:#0a0404;position:relative',
  ].join(';');

  // Subtle grunge overlay (sections sit at z-index:2, this at z-index:1)
  const grunge = document.createElement('div');
  grunge.style.cssText = [
    'position:absolute;inset:0;pointer-events:none;z-index:1',
    'background-image:radial-gradient(circle at 20% 30%,rgba(204,51,51,.06) 0,transparent 40%),' +
      'radial-gradient(circle at 80% 70%,rgba(204,51,51,.05) 0,transparent 45%),' +
      'repeating-linear-gradient(0deg,transparent 0 2px,rgba(0,0,0,.18) 2px 3px)',
  ].join(';');
  card.appendChild(grunge);

  const content = document.createElement('div');
  content.style.cssText = 'position:relative;z-index:2';
  content.innerHTML = sections;
  card.appendChild(content);
  return card;
}

// Legacy stub
function exportGangImage() { openExportModal(); }

// ── Gang Park Window ─────────────────────────────────────────────
// Panneau persistant du QG, affiché parmi les fenêtres de zone
let _gangParkOpen = false;

function toggleGangParkWindow() {
  const state = globalThis.state;
  _gangParkOpen = !_gangParkOpen;
  globalThis.openZones?.[_gangParkOpen ? 'add' : 'delete']('gang_park');
  const container = document.getElementById('zoneWindows');
  if (!container) return;
  const existing = document.getElementById('zw-gang_park');
  if (_gangParkOpen) {
    if (!existing) {
      const el = document.createElement('div');
      el.id = 'zw-gang_park';
      el.className = 'zone-window gang-park-window';
      // Plafonné à la hauteur du panneau Gang Base voisin (#gangBaseContainer) —
      // sinon la liste d'agents grandit sans limite avec le recrutement et casse
      // l'alignement côte à côte des deux panneaux. La section agents/formation/
      // pension a déjà son propre overflow-y:auto ci-dessous ; il lui faut juste
      // un parent borné pour que ça serve à quelque chose.
      const baseHeight = document.getElementById('gangBaseContainer')?.offsetHeight;
      const maxHeight  = baseHeight > 200 ? `${baseHeight}px` : '520px';
      el.style.cssText = `min-width:340px;max-width:420px;max-height:${maxHeight};flex-shrink:0;border:2px solid var(--gold-dim);border-radius:var(--radius);background:linear-gradient(160deg,#1a1a2e,#16213e);overflow:hidden;display:flex;flex-direction:column`;
      container.prepend(el);
      renderGangParkWindow(el);
    }
  } else if (existing) {
    existing.remove();
  }
  globalThis.renderZoneSelector?.();
  globalThis.refreshZoneTile?.('gang_park');
}

function renderGangParkWindow(el) {
  const state = globalThis.state;
  const agentRows = state.agents.map(agent => {
    const teamHtml = agent.team.map(id => {
      const pk = globalThis.pokemonById?.(id);
      return pk ? `<img src="${pokeSprite(pk.species_en, pk.shiny)}" title="${speciesName(pk.species_en)} Lv.${pk.level}" style="width:28px;height:28px;image-rendering:pixelated${pk.shiny ? ';filter:drop-shadow(0 0 3px gold)' : ''}">` : '';
    }).join('');
    const _azdef = agent.assignedZone ? ZONE_BY_ID[agent.assignedZone] : null;
    const zoneName = agent.assignedZone ? ((_azdef ? (state.lang === 'en' ? (_azdef.en || _azdef.fr) : _azdef.fr) : null) || agent.assignedZone) : '—';
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.07)">
      <img src="${agent.sprite || trainerSprite('acetrainer')}" style="width:32px;height:32px;image-rendering:pixelated" alt="" onerror="this.src='${trainerSprite('acetrainer')}'">
      <div style="flex:1;min-width:0">
        <div style="font-size:9px;color:var(--text)">${agent.name}</div>
        <div style="font-size:7px;color:var(--text-dim)">${zoneName}</div>
      </div>
      <div style="display:flex;gap:2px;flex-wrap:wrap;max-width:100px;justify-content:flex-end">${teamHtml || '<span style="font-size:8px;color:var(--text-dim)">—</span>'}</div>
    </div>`;
  }).join('') || `<div style="font-size:9px;color:var(--text-dim);padding:10px;text-align:center">${_t('gang_base_no_recruited_agent')}</div>`;

  const trainingIds = state.trainingRoom?.pokemon || [];
  const trainingHtml = trainingIds.map(id => {
    const pk = globalThis.pokemonById?.(id);
    return pk ? `<div style="display:flex;align-items:center;gap:6px;padding:4px 8px">
      <img src="${pokeSprite(pk.species_en)}" style="width:28px;height:28px;image-rendering:pixelated">
      <div style="font-size:9px">${speciesName(pk.species_en)} Lv.${pk.level} ${'★'.repeat(pk.potential)}</div>
    </div>` : '';
  }).join('') || `<div style="font-size:9px;color:var(--text-dim);padding:8px">${_t('gang_base_empty_training_room')}</div>`;

  const pensionIds = state.pension?.slots || [];
  const pensionHtml = pensionIds.map(id => {
    const pk = globalThis.pokemonById?.(id);
    return pk ? `<div style="display:flex;align-items:center;gap:6px;padding:4px 8px">
      <img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:28px;height:28px;image-rendering:pixelated">
      <div style="font-size:9px">${speciesName(pk.species_en)} Lv.${pk.level}${pk.shiny ? ' ✨' : ''}</div>
    </div>` : '';
  }).join('') || `<div style="font-size:9px;color:var(--text-dim);padding:8px">${_t('gang_base_empty_pension')}</div>`;

  // Random ambient event (purely cosmetic)
  const AMBIENT_EVENTS = [
    _t('gang_base_ambient_pikachu'),
    _t('gang_base_ambient_egg'),
    _t('gang_base_ambient_rain'),
    _t('gang_base_ambient_training'),
    _t('gang_base_ambient_meloetta'),
    _t('gang_base_ambient_petals'),
    _t('gang_base_ambient_feast'),
    _t('gang_base_ambient_raichu'),
    _t('gang_base_ambient_snorlax'),
    _t('gang_base_ambient_motivation'),
  ];
  const ambient = AMBIENT_EVENTS[Math.floor(Date.now() / 30000) % AMBIENT_EVENTS.length];

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(0,0,0,.3);border-bottom:1px solid rgba(255,255,255,.1)">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:16px">🏛️</span>
        <div>
          <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">${state.gang.name}</div>
          <div style="font-size:8px;color:var(--text-dim)">${_t('gang_base_headquarters')}</div>
        </div>
      </div>
      <button class="gp-close" style="font-size:11px;background:none;border:none;color:var(--text-dim);cursor:pointer">✕</button>
    </div>

    <div style="padding:6px 8px;background:rgba(255,204,90,.06);border-bottom:1px solid rgba(255,255,255,.07);font-size:8px;color:var(--text-dim)">
      ${ambient}
    </div>

    <div style="overflow-y:auto;flex:1">
      <div style="padding:8px 12px">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin-bottom:6px;letter-spacing:1px">${_t('gang_base_agents').toUpperCase()} (${state.agents.length})</div>
        ${agentRows}
      </div>

      ${trainingIds.length > 0 ? `
      <div style="padding:8px 12px;border-top:1px solid rgba(255,255,255,.07)">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin-bottom:4px;letter-spacing:1px">${_t('gang_base_training').toUpperCase()} (${trainingIds.length})</div>
        ${trainingHtml}
      </div>` : ''}

      ${pensionIds.length > 0 ? `
      <div style="padding:8px 12px;border-top:1px solid rgba(255,255,255,.07)">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin-bottom:4px;letter-spacing:1px">${_t('gang_base_pension').toUpperCase()} (${pensionIds.length})</div>
        ${pensionHtml}
      </div>` : ''}
    </div>`;

  el.querySelector('.gp-close')?.addEventListener('click', () => toggleGangParkWindow());
}

// ── Auto-refresh via EventBus ─────────────────────────────────
// Le module s'abonne lui-même aux signaux pertinents → les callers n'ont plus
// besoin d'appeler explicitement renderGangBasePanel(). Le rAF debounce
// fusionne les bursts d'events en un seul rendu/frame.
//
// Filets de sécurité conservés :
// - Les appels directs globalThis.renderGangBasePanel() restent valides
//   (no-op s'ils tombent dans la même frame que l'event-driven render)
// - Le visibility check court-circuite si l'onglet Zones n'est pas actif
EventBus.on(EVENTS.STATE_DIRTY,      () => renderGangBasePanel());
EventBus.on(EVENTS.UI_TOPBAR_UPDATE, () => renderGangBasePanel());

// Re-render forcé au changement d'onglet (quand on revient sur Zones)
// pour rattraper les états manqués pendant l'absence.
EventBus.on(EVENTS.UI_TAB_CHANGED, ({ tabId } = {}) => {
  if (tabId === 'tabZones') renderGangBasePanelForce();
});

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
  _gbase_toggleGangParkWindow:     toggleGangParkWindow,
  _gbase_renderGangParkWindow:     renderGangParkWindow,
});

export {};
