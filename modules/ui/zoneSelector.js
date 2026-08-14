// ══════════════════════════════════════════════════════════════
//  Zone Selector UI — fogmap grid, filter tabs, context menu
//  Extracted from app.js for modularity.
//
//  Accesses globalThis for cross-module state:
//    state, openZones, ZONES, ZONE_BY_ID, ZONES_JOHTO, ZONE_JOHTO_BY_ID,
//    ZONE_BGS, SPECIES_BY_EN,
//    isZoneUnlocked, isZoneDegraded, getZoneMastery,
//    openZoneWindow, closeZoneWindow, openCollectionModal,
//    assignAgentToZone, initZone,
//    notify, saveState, updateTopBar, SFX, showConfirm,
//    pokeSprite, SHOP_ITEMS, collectAllZones, renderZonesTab
// ══════════════════════════════════════════════════════════════
'use strict';

import { EventBus, EVENTS } from '../core/eventBus.js';
import { isOnboardingActive } from '../systems/onboardingFlow.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY,        { msg, type });
const _dirty  = ()               => EventBus.emit(EVENTS.STATE_DIRTY);
const _topBar = ()               => EventBus.emit(EVENTS.UI_TOPBAR_UPDATE);
const _save   = ()               => globalThis.saveState?.();
const _t      = (...a)           => globalThis.t?.(...a) ?? a[0];

function _localized(record) {
  return record?.[globalThis.state?.lang] ?? record?.en ?? record?.fr ?? '';
}


// ── Internal state ────────────────────────────────────────────
let _zoneFilter    = 'all'; // 'all' | 'fav' | 'route' | 'city' | 'special'
let _activeRegion  = 'kanto';
let _ctxMenu       = null;  // active context menu DOM node

// ── Classic-script globals (const → pas sur window, mais dans la portée ──
// lexicale globale partagée entre tous les scripts de la page).
// Déclarés ici pour que les moteurs strict-mode ne les rejettent pas.
/* globals ZONES, ZONE_BY_ID, ZONES_JOHTO, ZONE_JOHTO_BY_ID,
           ZONES_HOENN, ZONE_HOENN_BY_ID, ZONES_SINNOH, ZONE_SINNOH_BY_ID,
           SPECIES_BY_EN */

const _REGIONS = ['kanto', 'johto', 'hoenn', 'sinnoh'];

function setActiveRegion(region) {
  _activeRegion = _REGIONS.includes(region) ? region : 'kanto';
}

function getActiveRegion() {
  return _activeRegion;
}

function _isJohtoZone(zoneId) {
  return typeof ZONE_JOHTO_BY_ID !== 'undefined' && !!ZONE_JOHTO_BY_ID[zoneId];
}
function _isHoennZone(zoneId) {
  return typeof ZONE_HOENN_BY_ID !== 'undefined' && !!ZONE_HOENN_BY_ID[zoneId];
}
function _isSinnohZone(zoneId) {
  return typeof ZONE_SINNOH_BY_ID !== 'undefined' && !!ZONE_SINNOH_BY_ID[zoneId];
}

function _getActiveZones() {
  if (_activeRegion === 'johto')  return typeof ZONES_JOHTO  !== 'undefined' ? ZONES_JOHTO  : [];
  if (_activeRegion === 'hoenn')  return typeof ZONES_HOENN  !== 'undefined' ? ZONES_HOENN  : [];
  if (_activeRegion === 'sinnoh') return typeof ZONES_SINNOH !== 'undefined' ? ZONES_SINNOH : [];
  // Kanto — exclure les zones des autres régions qui ont été pushées dans ZONES,
  // et le terrain de départ dès que l'onboarding est fini : isZoneUnlocked le
  // considère débloqué à vie une fois qu'on y a capturé, donc sans ce filtre il
  // resterait sur la carte pour toujours.
  const onboarding = isOnboardingActive(globalThis.state);
  return ZONES.filter(z => !_isJohtoZone(z.id) && !_isHoennZone(z.id) && !_isSinnohZone(z.id)
    && (onboarding || z.type !== 'onboarding'));
}

function _getActiveZoneById() {
  if (_activeRegion === 'johto')  return typeof ZONE_JOHTO_BY_ID  !== 'undefined' ? ZONE_JOHTO_BY_ID  : ZONE_BY_ID;
  if (_activeRegion === 'hoenn')  return typeof ZONE_HOENN_BY_ID  !== 'undefined' ? ZONE_HOENN_BY_ID  : ZONE_BY_ID;
  if (_activeRegion === 'sinnoh') return typeof ZONE_SINNOH_BY_ID !== 'undefined' ? ZONE_SINNOH_BY_ID : ZONE_BY_ID;
  return ZONE_BY_ID;
}

function _getAnyZoneById(zoneId) {
  return ZONE_BY_ID?.[zoneId]
    || (typeof ZONE_JOHTO_BY_ID  !== 'undefined' && ZONE_JOHTO_BY_ID?.[zoneId])
    || (typeof ZONE_HOENN_BY_ID  !== 'undefined' && ZONE_HOENN_BY_ID?.[zoneId])
    || (typeof ZONE_SINNOH_BY_ID !== 'undefined' && ZONE_SINNOH_BY_ID?.[zoneId])
    || null;
}

// ── Dex completion helpers ────────────────────────────────────
function _getZoneSpecies(zone) {
  const pool = new Set(zone.pool || []);
  (zone.rarePool || []).forEach(r => pool.add(r.en));
  return [...pool].filter(en => SPECIES_BY_EN?.[en] && !SPECIES_BY_EN[en].hidden);
}

function _getZoneDexPct(zone) {
  const state = globalThis.state;
  const species = _getZoneSpecies(zone);
  if (!species.length) return 100;
  const caught = species.filter(en => state.pokedex?.[en]?.caught).length;
  return { caught, total: species.length, pct: Math.round(caught / species.length * 100) };
}

function _getZoneShinyPct(zone) {
  const state = globalThis.state;
  const species = _getZoneSpecies(zone);
  if (!species.length) return { caught: 0, total: 0, pct: 100 };
  const caught = species.filter(en => state.pokedex?.[en]?.shiny).length;
  return { caught, total: species.length, pct: Math.round(caught / species.length * 100) };
}

// ── Filter helpers ────────────────────────────────────────────
function _getFilteredZones() {
  const state = globalThis.state;
  const activeZones = _getActiveZones();
  const gangPark = activeZones.find(z => z.type === 'gang_park');
  const vivarium = activeZones.find(z => z.type === 'vivarium');
  const isPinned = z => z.type === 'gang_park' || z.type === 'vivarium';
  // Les données de zones sont des const de scripts classiques accessibles par nom nu.
  let filtered;
  switch (_zoneFilter) {
    case 'fav':      filtered = activeZones.filter(z => !isPinned(z) && (state.favoriteZones || []).includes(z.id)); break;
    case 'route':    filtered = activeZones.filter(z => z.type === 'route'); break;
    case 'city':     filtered = activeZones.filter(z => z.type === 'city'); break;
    case 'special':  filtered = activeZones.filter(z => z.type === 'special'); break;
    case 'dex':      filtered = activeZones.filter(z => !isPinned(z) && globalThis.isZoneUnlocked?.(z.id) && _getZoneDexPct(z).pct < 100); break;
    case 'dex_shiny':filtered = activeZones.filter(z => !isPinned(z) && globalThis.isZoneUnlocked?.(z.id) && _getZoneShinyPct(z).pct < 100); break;
    default:         filtered = activeZones.filter(z => !isPinned(z)); break;
  }
  // Gang Park + Vivarium toujours en tête (sauf filtre strict par type)
  const showPark = !['route','city','special','dex','dex_shiny'].includes(_zoneFilter);
  const pinned = [gangPark, vivarium].filter(Boolean);
  return showPark && pinned.length ? [...pinned, ...filtered] : filtered;
}

// ── Favorite helpers ──────────────────────────────────────────
function toggleZoneFav(zoneId) {
  const state = globalThis.state;
  if (!state.favoriteZones) state.favoriteZones = [];
  const idx = state.favoriteZones.indexOf(zoneId);
  const zone = _getActiveZoneById()?.[zoneId];
  const name = _localized(zone);
  if (idx === -1) {
    state.favoriteZones.push(zoneId);
    _notify(_t('zone_selector_added_favorite', { name }), 'success');
  } else {
    state.favoriteZones.splice(idx, 1);
    _notify(_t('zone_selector_removed_favorite', { name }), 'success');
  }
  globalThis.SFX?.play('click');
  _save();

  // Update in-tile fav button if tile visible
  const tile = document.querySelector(`#zoneSelector [data-zone="${zoneId}"]`);
  const favBtn = tile?.querySelector('.zone-fav-btn');
  if (favBtn) {
    const isFav = state.favoriteZones.includes(zoneId);
    favBtn.textContent = isFav ? '★' : '☆';
    favBtn.title = isFav ? _t('zone_selector_remove_favorite') : _t('zone_selector_favorite_hint');
    favBtn.classList.toggle('active', isFav);
  }

  // Update sidebar pill
  _syncFavPill();

  // If currently filtering by fav and zone was unfavorited, re-render
  if (_zoneFilter === 'fav') renderZoneSelector();
}

function _syncFavPill() {
  const pill = document.getElementById('btnFavFilter');
  if (!pill) return;
  const active = _zoneFilter === 'fav';
  pill.classList.toggle('active', active);
  pill.title = active ? _t('zone_selector_show_all') : _t('zone_selector_show_favorites');
}

// ── Context menu ──────────────────────────────────────────────
function _dismissCtxMenu() {
  _ctxMenu?.remove();
  _ctxMenu = null;
}

export function showZoneContextMenu(zoneId, x, y) {
  _dismissCtxMenu();

  const state     = globalThis.state;
  const openZones = globalThis.openZones;
  const zone      = _getActiveZoneById()?.[zoneId];
  if (!zone) return;

  const zState     = state.zones[zoneId] || {};
  const isOpen     = openZones?.has(zoneId);
  const hasPending = (zState.pendingIncome || 0) > 0;
  const isFav      = (state.favoriteZones || []).includes(zoneId);
  const name       = _localized(zone);

  _ctxMenu = document.createElement('div');
  _ctxMenu.className = 'zone-ctx-menu';
  _ctxMenu.style.cssText = `left:${x}px;top:${y}px`;

  function renderMain() {
    const items = [
      {
        icon: isOpen ? '✕' : '▶',
        label: isOpen ? _t('zone_selector_close_zone') : _t('zone_selector_open_zone'),
        action: () => isOpen
          ? globalThis.closeZoneWindow?.(zoneId)
          : globalThis.openZoneWindow?.(zoneId),
      },
      hasPending && {
        icon: '₽',
        label: _t('zone_selector_collect_income'),
        action: () => globalThis.openCollectionModal?.(zoneId),
      },
      {
        icon: isFav ? '★' : '☆',
        label: isFav ? _t('zone_selector_remove_favorite') : _t('zone_selector_add_favorite'),
        action: () => { toggleZoneFav(zoneId); _dismissCtxMenu(); },
      },
      {
        icon: '👤', label: `${_t('zone_selector_assign_agent')} →`,
        action: () => renderAgentSubmenu(),
        sub: true,
      },
    ].filter(Boolean);

    _ctxMenu.innerHTML = `
      <div class="zone-ctx-header">${name}</div>
      ${items.map((it, i) => `
        <button class="zone-ctx-item${it.sub ? ' zone-ctx-sub' : ''}" data-idx="${i}">
          <span class="zone-ctx-icon">${it.icon}</span>${it.label}
        </button>`).join('')}
    `;

    _ctxMenu.querySelectorAll('[data-idx]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        items[+btn.dataset.idx].action();
        if (!items[+btn.dataset.idx].sub) _dismissCtxMenu();
      });
    });
  }

  function renderAgentSubmenu() {
    if (!_ctxMenu) return;
    const agents     = state.agents || [];
    const assignedIds = new Set(zState.assignedAgents || []);
    const assigned   = agents.filter(a => assignedIds.has(a.id));
    const available  = agents.filter(a => !assignedIds.has(a.id));
    const canAdd     = true; // slots illimités — tous les agents peuvent être assignés

    let html = `
      <div class="zone-ctx-header">
        <button class="zone-ctx-back" id="ctxBackBtn">← ${name}</button>
      </div>`;

    if (assigned.length > 0) {
      html += `<div class="zone-ctx-section">${_t('zone_selector_assigned_count', { n: assigned.length }).toUpperCase()}</div>`;
      for (const a of assigned) {
        html += `<button class="zone-ctx-item zone-ctx-agent assigned" data-agent-id="${a.id}">
          <span class="zone-ctx-icon">✓</span>${a.name}
          <small style="color:var(--text-dim);margin-left:4px">${a.title}</small>
        </button>`;
      }
    }

    if (available.length > 0) {
      html += `<div class="zone-ctx-section">${_t('zone_selector_available').toUpperCase()}</div>`;
      for (const a of available) {
        const curZone = a.assignedZone
          ? (_localized(_getAnyZoneById(a.assignedZone)) || a.assignedZone)
          : _t('zone_selector_without_zone');
        html += `<button class="zone-ctx-item zone-ctx-agent${canAdd ? '' : ' zone-ctx-disabled'}"
          data-agent-id="${a.id}" ${canAdd ? '' : 'disabled'}>
          <span class="zone-ctx-icon">👤</span>${a.name}
          <small style="color:var(--text-dim);margin-left:4px">${curZone}</small>
        </button>`;
      }
    }

    if (agents.length === 0) {
      html += `<div class="zone-ctx-empty">${_t('zone_selector_no_agent')}</div>`;
    }

    _ctxMenu.innerHTML = html;

    _ctxMenu.querySelector('#ctxBackBtn')?.addEventListener('click', e => {
      e.stopPropagation();
      renderMain();
    });

    _ctxMenu.querySelectorAll('.zone-ctx-agent').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (btn.disabled) return;
        const agentId    = btn.dataset.agentId;
        const isAssigned = btn.classList.contains('assigned');
        if (isAssigned) {
          globalThis.assignAgentToZone?.(agentId, null);
          _notify(_t('zone_selector_agent_removed', { name }), 'success');
        } else {
          globalThis.assignAgentToZone?.(agentId, zoneId);
        }
        _save();
        globalThis.renderZonesTab?.();
        _dismissCtxMenu();
      });
    });
  }

  renderMain();
  document.body.appendChild(_ctxMenu);

  // Reposition if overflowing viewport
  requestAnimationFrame(() => {
    if (!_ctxMenu) return;
    const r = _ctxMenu.getBoundingClientRect();
    if (r.right  > window.innerWidth  - 8) _ctxMenu.style.left = `${x - r.width}px`;
    if (r.bottom > window.innerHeight - 8) _ctxMenu.style.top  = `${y - r.height}px`;
  });

  // Dismiss on outside click or Escape
  setTimeout(() => document.addEventListener('click', _dismissCtxMenu, { once: true }), 0);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') _dismissCtxMenu(); }, { once: true });
}


// ── Event icon helper ──────────────────────────────────────────
function _eventIcon(type) {
  const icons = {
    territory_bonus:    '🏴',
    bounty_hunt:        '🎯',
    rival_invasion:     '⚔',
    trainer_tournament: '🏆',
    legendary_sighting: '✨',
  };
  return icons[type] || '📍';
}

// ── Gang Park tile (special — always unlocked, not a standard zone) ──
function _buildGangParkTile(zone) {
  const state = globalThis.state;
  const openZones = globalThis.openZones;
  const isOpen = openZones?.has('gang_park');
  const agentCount = state.agents.length;
  const trainingCount = (state.trainingRoom?.pokemon || []).length;
  const pensionCount = (state.pension?.slots || []).length;
  const name = _localized(zone);
  return `<div class="fog-tile unlocked gang-park-tile${isOpen ? ' zone-open' : ''}" data-zone="gang_park"
    style="background:linear-gradient(135deg,#1a1a2e,#16213e);border:2px solid ${isOpen ? 'var(--gold)' : 'var(--border-light)'};position:relative;cursor:pointer">
    <div class="fog-tile-content" style="gap:3px">
      <div style="font-size:18px">🏛️</div>
      <div class="fog-tile-name" style="color:${isOpen ? 'var(--gold)' : 'var(--text)'};font-size:8px">${name}</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:center;margin-top:2px">
        ${agentCount > 0 ? `<span style="font-size:7px;color:var(--text-dim)">👥${agentCount}</span>` : ''}
        ${trainingCount > 0 ? `<span style="font-size:7px;color:var(--text-dim)">🏋${trainingCount}</span>` : ''}
        ${pensionCount > 0 ? `<span style="font-size:7px;color:var(--text-dim)">🏠${pensionCount}</span>` : ''}
      </div>
      ${isOpen ? `<div style="font-size:7px;color:var(--gold);margin-top:2px">${_t('zone_selector_open').toUpperCase()}</div>` : ''}
    </div>
  </div>`;
}

// ── Vivarium tile (special — cosmetic showcase/boss team roaming display) ──
function _buildVivariumTile(zone) {
  const openZones = globalThis.openZones;
  const isOpen = openZones?.has('vivarium');
  const name = _localized(zone);
  return `<div class="fog-tile unlocked vivarium-tile${isOpen ? ' zone-open' : ''}" data-zone="vivarium"
    style="background:linear-gradient(135deg,#0a1a12,#0d2418);border:2px solid ${isOpen ? 'var(--gold)' : 'var(--border-light)'};position:relative;cursor:pointer">
    <div class="fog-tile-content" style="gap:3px">
      <div style="font-size:18px">🌳</div>
      <div class="fog-tile-name" style="color:${isOpen ? 'var(--gold)' : 'var(--text)'};font-size:8px">${name}</div>
      ${isOpen ? `<div style="font-size:7px;color:var(--gold);margin-top:2px">${_t('zone_selector_open').toUpperCase()}</div>` : ''}
    </div>
  </div>`;
}

// ── Tile builder ──────────────────────────────────────────────
function _buildTile(zone) {
  // Special tile for Gang Park
  if (zone.type === 'gang_park') return _buildGangParkTile(zone);
  if (zone.type === 'vivarium') return _buildVivariumTile(zone);

  const state     = globalThis.state;
  const openZones = globalThis.openZones;
  const ZONE_BGS  = globalThis.ZONE_BGS;
  const unlocked  = globalThis.isZoneUnlocked?.(zone.id);
  const isOpen    = openZones?.has(zone.id);
  const name      = _localized(zone);
  const bg        = ZONE_BGS?.[zone.id];
  const bgStyle   = bg
    ? `background-image:url('${bg.url}'),linear-gradient(180deg,${bg.fb});background-size:cover;background-position:center;`
    : `background:var(--bg-panel);`;
  const zState    = state.zones[zone.id] || {};
  const combats   = zState.combatsWon || 0;
  const mastery   = globalThis.getZoneMastery?.(zone.id) || 0;
  const degraded  = globalThis.isZoneDegraded?.(zone.id);

  if (unlocked) {
    const degradedTag  = degraded ? ' ⚠' : '';
    const income       = zState.pendingIncome || 0;
    const incomeTier   = income <= 0 ? 0 : income < 500 ? 1 : income < 2000 ? 2 : income < 5000 ? 3 : income < 15000 ? 4 : 5;
    const incomeHtml   = incomeTier > 0
      ? `<div class="zone-income-btn income-tier${incomeTier}" data-collect-zone="${zone.id}">₽</div>` : '';
    const isFav        = (state.favoriteZones || []).includes(zone.id);
    const isCity       = zone.type === 'city';
    const musicIcon    = zone.music ? ' 🎵' : '';
    const hasAgent     = state.agents.some(a => a.assignedZone === zone.id);
    const activityMode = globalThis.getZoneActivityMode?.(zone.id) || 'idle';
    const hasEvent     = activityMode === 'event';

    let displayName = name;
    if (isCity) {
      const raidReady = (zState.combatsWon || 0) >= 10 && zone.gymLeader;
      displayName = zState.gymDefeated
        ? `<span style="color:var(--gold)">${name} ⚔</span>`
        : raidReady
          ? `<span style="color:var(--red)">${name} !</span>`
          : `<span style="color:var(--text-dim)">${name}</span>`;
    }

    const poolPreview = (zone.pool || []).slice(0, 5).map(en =>
      `<img src="${globalThis.pokeSprite?.(en) || ''}"
        style="width:16px;height:16px;image-rendering:pixelated;filter:drop-shadow(0 1px 3px rgba(0,0,0,1))"
        title="${_localized(SPECIES_BY_EN?.[en]) || en}">`
    ).join('');

    // Barre de complétion Pokédex / Chroma (visible dans les filtres dédiés)
    let dexBarHtml = '';
    if (_zoneFilter === 'dex' || _zoneFilter === 'dex_shiny') {
      const comp    = _zoneFilter === 'dex' ? _getZoneDexPct(zone) : _getZoneShinyPct(zone);
      const color   = _zoneFilter === 'dex_shiny' ? 'var(--gold)' : 'var(--accent)';
      const label   = _zoneFilter === 'dex_shiny' ? '✨' : '📖';
      dexBarHtml = `
        <div style="position:absolute;bottom:0;left:0;right:0;padding:2px 4px;background:rgba(0,0,0,.55)">
          <div style="display:flex;justify-content:space-between;font-family:var(--font-pixel);font-size:7px;color:${color};margin-bottom:1px">
            <span>${label} ${comp.caught}/${comp.total}</span><span>${comp.pct}%</span>
          </div>
          <div style="height:3px;background:rgba(255,255,255,.12);border-radius:2px;overflow:hidden">
            <div style="height:100%;width:${comp.pct}%;background:${color};border-radius:2px;transition:width .3s"></div>
          </div>
        </div>`;
    }

    // Calcul du statut affiché sur la tuile
    const statusText = isOpen
      ? _t('zone_selector_status_open')
      : hasEvent
        ? _t('zone_selector_status_event')
        : degraded
          ? _t('zone_selector_status_combat')
          : hasAgent
              ? _t('zone_selector_status_auto')
              : _t('zone_selector_status_enter');

    const tileClass = [
      'fog-tile unlocked',
      isOpen      ? 'fog-open'      : '',
      degraded    ? 'fog-degraded'  : '',
      hasEvent    ? 'fog-event'     : '',
      hasAgent && !isOpen ? 'fog-auto' : '',
    ].filter(Boolean).join(' ');

    const zoneLevel   = globalThis.getZoneLevel?.(zone.id) || 1;
    const activeEvent = zState.activeEvent && !zState.activeEvent.resolved ? zState.activeEvent : null;
    const levelBadge  = zoneLevel > 1
      ? `<div class="fog-tile-level-badge">${_t('zone_selector_level_short')}${zoneLevel}</div>` : '';
    const eventBadge  = activeEvent
      ? `<div class="fog-tile-event-badge">${_eventIcon(activeEvent.type)}</div>` : '';

    return `<div class="${tileClass} zone-type-${zone.type}"
      data-zone="${zone.id}" style="${bgStyle}">
      <div class="fog-tile-overlay"></div>
      <div class="fog-tile-pool-preview">${poolPreview}</div>
      <div class="fog-tile-content">
        <div class="fog-tile-name">${displayName}${degradedTag}</div>
        <div class="fog-tile-stats">${'★'.repeat(mastery)}${mastery ? ' ' : ''}${_t('zone_selector_wins_short', { n: combats })}${musicIcon}</div>
        <div class="fog-tile-status">${statusText}</div>
      </div>
      ${levelBadge}${eventBadge}
      ${incomeHtml}
      ${dexBarHtml}
      <button class="zone-fav-btn${isFav ? ' active' : ''}" data-fav-zone="${zone.id}"
        title="${isFav ? _t('zone_selector_remove_favorite') : _t('zone_selector_favorite_hint')}">${isFav ? '★' : '☆'}</button>
    </div>`;
  } else {
    const SHOP_ITEMS = globalThis.SHOP_ITEMS;
    const repDiff    = zone.rep > state.gang.reputation ? zone.rep - state.gang.reputation : 0;
    const needsItem  = zone.unlockItem && !state.purchases?.[zone.unlockItem];
    const itemDef    = needsItem ? SHOP_ITEMS?.find(s => s.id === zone.unlockItem) : null;
    const isWingPermit = needsItem &&
      (zone.unlockItem === 'tourbillon_permit' || zone.unlockItem === 'carillon_permit');

    let lockHint, lockSub;
    if (isWingPermit) {
      const wingId   = zone.unlockItem === 'tourbillon_permit' ? 'silver_wing' : 'rainbow_wing';
      const wingName = zone.unlockItem === 'tourbillon_permit'
        ? _t('zone_selector_silver_wing')
        : _t('zone_selector_rainbow_wing');
      const have     = state.inventory?.[wingId] || 0;
      const pct      = Math.min(100, Math.round(have / 50 * 100));
      lockHint = wingName;
      lockSub  = `<div style="height:3px;background:rgba(255,255,255,0.15);border-radius:2px;margin:3px 0;overflow:hidden">
                    <div style="height:100%;width:${pct}%;background:var(--gold);border-radius:2px"></div>
                  </div>
                  <div style="font-size:8px;color:var(--gold)">${have}/50</div>`;
    } else if (needsItem) {
      lockHint = _localized(itemDef) || zone.unlockItem;
      lockSub  = '';
    } else {
      lockHint = _t('zone_selector_reputation_required', { value: repDiff });
      lockSub  = '';
    }

    return `<div class="fog-tile locked">
      <div class="fog-tile-overlay fog"></div>
      <div class="fog-tile-content">
        <div class="fog-tile-name" style="letter-spacing:2px;color:rgba(255,255,255,0.3)">?????</div>
        <div class="fog-tile-stats" style="${needsItem ? 'color:var(--gold)' : ''}">${lockHint}</div>
        ${lockSub}
      </div>
    </div>`;
  }
}

// ── Main render ───────────────────────────────────────────────
export function renderZoneSelector() {
  const el = document.getElementById('zoneSelector');
  if (!el) return;

  const filteredZones = _getFilteredZones();
  el.innerHTML = `<div class="fog-map">${filteredZones.map(_buildTile).join('')}</div>`;

  // ── Left-click: open/close zone window ────────────────────
  el.querySelectorAll('.fog-tile.unlocked').forEach(tile => {
    tile.addEventListener('click', () => {
      const zid = tile.dataset.zone;
      // Gang Park / Vivarium have their own toggle
      if (zid === 'gang_park') {
        globalThis.toggleGangParkWindow?.();
        return;
      }
      if (zid === 'vivarium') {
        globalThis.toggleVivariumWindow?.();
        return;
      }
      if (globalThis.openZones?.has(zid)) globalThis.closeZoneWindow?.(zid);
      else globalThis.openZoneWindow?.(zid);
    });
    // ── Right-click: context menu (not for gang park / vivarium) ─────
    if (tile.dataset.zone !== 'gang_park' && tile.dataset.zone !== 'vivarium') {
      tile.addEventListener('contextmenu', e => {
        e.preventDefault();
        showZoneContextMenu(tile.dataset.zone, e.clientX, e.clientY);
      });
    }
  });

  // ── Income ₽ buttons ──────────────────────────────────────
  el.querySelectorAll('[data-collect-zone]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      globalThis.openCollectionModal?.(btn.dataset.collectZone);
    });
  });

  // ── In-tile fav buttons ───────────────────────────────────
  el.querySelectorAll('[data-fav-zone]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleZoneFav(btn.dataset.favZone);
    });
  });

  // ── Filter tabs ───────────────────────────────────────────
  document.querySelectorAll('.zone-ftab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === _zoneFilter);
    if (!btn._filterBound) {
      btn._filterBound = true;
      btn.addEventListener('click', () => {
        _zoneFilter = btn.dataset.filter;
        renderZoneSelector();
      });
    }
  });

  // ── Fav-filter sidebar pill ───────────────────────────────
  const pill = document.getElementById('btnFavFilter');
  if (pill) {
    _syncFavPill();
    if (!pill._pillBound) {
      pill._pillBound = true;
      pill.addEventListener('click', () => {
        _zoneFilter = _zoneFilter === 'fav' ? 'all' : 'fav';
        renderZoneSelector();
      });
    }
  }
}

// ── Lightweight tile refresh helpers ──────────────────────────
export function refreshZoneTile(zoneId) {
  const tile = document.querySelector(`#zoneSelector [data-zone="${zoneId}"]`);
  if (!tile) return;
  const state     = globalThis.state;
  const openZones = globalThis.openZones;
  const zone      = _getActiveZoneById()?.[zoneId];
  if (!zone) return;
  const zState   = state?.zones?.[zoneId] || {};
  const isOpen   = openZones?.has(zoneId);
  const degraded = globalThis.isZoneDegraded?.(zoneId);
  const mastery  = globalThis.getZoneMastery?.(zoneId) || 0;
  const combats  = zState.combatsWon || 0;
  const name     = _localized(zone);

  const hasAgent     = state?.agents?.some(a => a.assignedZone === zoneId);
  const activityMode = globalThis.getZoneActivityMode?.(zoneId) || 'idle';
  const hasEvent     = activityMode === 'event';

  tile.classList.toggle('fog-open',      !!isOpen);
  tile.classList.toggle('fog-degraded',  !!degraded);
  tile.classList.toggle('fog-event',     !!hasEvent && !isOpen);
  tile.classList.toggle('fog-auto',      !!hasAgent && !isOpen);

  const statusEl = tile.querySelector('.fog-tile-status');
  if (statusEl) statusEl.textContent = isOpen
    ? _t('zone_selector_status_open')
    : hasEvent    ? _t('zone_selector_status_event')
    : degraded    ? _t('zone_selector_status_combat')
    : hasAgent    ? _t('zone_selector_status_auto')
    : _t('zone_selector_status_enter');

  const statsEl = tile.querySelector('.fog-tile-stats');
  if (statsEl) statsEl.textContent = `${'★'.repeat(mastery)}${mastery ? ' ' : ''}${_t('zone_selector_wins_short', { n: combats })}${zone.music ? ' 🎵' : ''}`;

  const nameEl = tile.querySelector('.fog-tile-name');
  if (nameEl && zone.type === 'city') {
    const raidReady = combats >= 10 && zone.gymLeader;
    nameEl.innerHTML = zState.gymDefeated
      ? `<span style="color:var(--gold)">${name} ⚔</span>`
      : raidReady
        ? `<span style="color:var(--red)">${name} !</span>`
        : `<span style="color:var(--text-dim)">${name}</span>`;
  }

  refreshZoneIncomeTile(zoneId);
}

// Refresh every tile currently in the fog-map without a full re-render.
// Falls back to full re-render if a previously-locked tile is now unlocked.
export function refreshAllFogTiles() {
  const el = document.getElementById('zoneSelector');
  if (!el) return;

  // If any locked tile became unlocked, do a full re-render
  const lockedTiles = el.querySelectorAll('.fog-tile.locked[data-zone]');
  for (const tile of lockedTiles) {
    if (globalThis.isZoneUnlocked?.(tile.dataset.zone)) {
      renderZoneSelector();
      return;
    }
  }

  // Targeted refresh for each unlocked tile
  el.querySelectorAll('.fog-tile.unlocked[data-zone]').forEach(tile => {
    refreshZoneTile(tile.dataset.zone);
  });

  updateZoneButtons();
}

export function refreshZoneIncomeTile(zoneId) {
  const tile = document.querySelector(`#zoneSelector [data-zone="${zoneId}"]`);
  if (!tile) return;
  const state      = globalThis.state;
  const income     = state.zones?.[zoneId]?.pendingIncome || 0;
  const incomeTier = income <= 0 ? 0 : income < 500 ? 1 : income < 2000 ? 2 : income < 5000 ? 3 : income < 15000 ? 4 : 5;
  const existing   = tile.querySelector('.zone-income-btn');
  if (incomeTier === 0) {
    existing?.remove();
  } else if (existing) {
    existing.className = `zone-income-btn income-tier${incomeTier}`;
  } else {
    const btn = document.createElement('div');
    btn.className = `zone-income-btn income-tier${incomeTier}`;
    btn.dataset.collectZone = zoneId;
    btn.textContent = '₽';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      globalThis.openCollectionModal?.(zoneId);
    });
    tile.appendChild(btn);
  }
}

export function updateZoneButtons() {
  const openZones = globalThis.openZones;
  const state     = globalThis.state;
  const btnClose  = document.getElementById('btnCloseAllZones');
  const btnCollect = document.getElementById('btnCollectAllZones');
  const openCount = openZones?.size || 0;
  const hasOpen   = openCount > 0;
  const counter   = document.getElementById('zoneOpenCount');
  if (counter) {
    counter.textContent = _t('zone_selector_open_count', { n: openCount });
    counter.classList.toggle('zone-open-count-warn', openCount > 10);
    counter.title = openCount > 10
      ? _t('zone_selector_many_open_warning')
      : _t('zone_selector_open_count_title');
  }
  if (btnClose)   btnClose.style.display   = hasOpen ? '' : 'none';
  if (btnCollect) {
    // Show collect button if ANY zone (open OR closed) has pending income from agents
    const hasPending = Object.values(state.zones || {}).some(zs => (zs.pendingIncome || 0) > 0);
    btnCollect.style.display = hasPending ? '' : 'none';
  }
}

export function bindZoneActionButtons() {
  const btnCloseAll = document.getElementById('btnCloseAllZones');
  if (btnCloseAll && !btnCloseAll._bound) {
    btnCloseAll._bound = true;
    btnCloseAll.addEventListener('click', () => {
      // gang_park/vivarium ont leur propre toggle (DOM + timers) — la fermeture
      // générique ne les gère pas et laisserait leur fenêtre affichée.
      [...(globalThis.openZones || [])]
        .filter(zid => zid !== 'gang_park' && zid !== 'vivarium')
        .forEach(zid => globalThis.closeZoneWindow?.(zid));
    });
  }
  const btnCollectAll = document.getElementById('btnCollectAllZones');
  if (btnCollectAll && !btnCollectAll._bound) {
    btnCollectAll._bound = true;
    btnCollectAll.addEventListener('click', () => globalThis.collectAllZones?.());
  }
  updateZoneButtons();
}

Object.assign(globalThis, {
  _zsel_setActiveRegion: setActiveRegion,
  _zsel_getActiveRegion: getActiveRegion,
});
