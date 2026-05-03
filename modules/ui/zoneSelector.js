// ══════════════════════════════════════════════════════════════
//  Zone Selector UI — fogmap grid, filter tabs, context menu
//  Extracted from app.js for modularity.
//
//  Accesses globalThis for cross-module state:
//    state, openZones, ZONES, ZONE_BY_ID, ZONE_BGS, SPECIES_BY_EN,
//    isZoneUnlocked, isZoneDegraded, getZoneMastery,
//    openZoneWindow, closeZoneWindow, openCollectionModal,
//    assignAgentToZone, getZoneSlotCost, initZone,
//    notify, saveState, updateTopBar, SFX, showConfirm,
//    pokeSprite, SHOP_ITEMS, collectAllZones, renderZonesTab
// ══════════════════════════════════════════════════════════════
'use strict';

// ── Internal state ────────────────────────────────────────────
let _zoneFilter = 'all'; // 'all' | 'fav' | 'route' | 'city' | 'special'
let _ctxMenu    = null;  // active context menu DOM node

// ── Classic-script globals (const → pas sur window, mais dans la portée ──
// lexicale globale partagée entre tous les scripts de la page).
// Déclarés ici pour que les moteurs strict-mode ne les rejettent pas.
/* globals ZONES, ZONE_BY_ID, SPECIES_BY_EN */

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
  const gangPark = ZONES.find(z => z.type === 'gang_park');
  // ZONES est un const de script classique, accessible par nom nu
  let filtered;
  switch (_zoneFilter) {
    case 'fav':      filtered = ZONES.filter(z => z.type !== 'gang_park' && (state.favoriteZones || []).includes(z.id)); break;
    case 'route':    filtered = ZONES.filter(z => z.type === 'route'); break;
    case 'city':     filtered = ZONES.filter(z => z.type === 'city'); break;
    case 'special':  filtered = ZONES.filter(z => z.type === 'special'); break;
    case 'dex':      filtered = ZONES.filter(z => z.type !== 'gang_park' && globalThis.isZoneUnlocked?.(z.id) && _getZoneDexPct(z).pct < 100); break;
    case 'dex_shiny':filtered = ZONES.filter(z => z.type !== 'gang_park' && globalThis.isZoneUnlocked?.(z.id) && _getZoneShinyPct(z).pct < 100); break;
    default:         filtered = ZONES.filter(z => z.type !== 'gang_park'); break;
  }
  // Gang Park toujours en tête (sauf filtre strict par type)
  const showPark = !['route','city','special','dex','dex_shiny'].includes(_zoneFilter);
  return showPark && gangPark ? [gangPark, ...filtered] : filtered;
}

// ── Favorite helpers ──────────────────────────────────────────
function toggleZoneFav(zoneId) {
  const state = globalThis.state;
  if (!state.favoriteZones) state.favoriteZones = [];
  const idx = state.favoriteZones.indexOf(zoneId);
  const zone = ZONE_BY_ID?.[zoneId];
  const name = state.lang === 'fr' ? zone?.fr : zone?.en;
  if (idx === -1) {
    state.favoriteZones.push(zoneId);
    globalThis.notify?.(`${name} ajoutée aux favoris`, 'success');
  } else {
    state.favoriteZones.splice(idx, 1);
    globalThis.notify?.(`${name} retirée des favoris`, 'success');
  }
  globalThis.SFX?.play('click');
  globalThis.saveState?.();

  // Update in-tile fav button if tile visible
  const tile = document.querySelector(`#zoneSelector [data-zone="${zoneId}"]`);
  const favBtn = tile?.querySelector('.zone-fav-btn');
  if (favBtn) {
    const isFav = state.favoriteZones.includes(zoneId);
    favBtn.textContent = isFav ? '★' : '☆';
    favBtn.title = isFav ? 'Retirer des favoris' : "Favori (s'ouvre au démarrage)";
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
  pill.title = active ? 'Voir toutes les zones' : 'Voir uniquement les favoris';
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
  const zone      = ZONE_BY_ID?.[zoneId];
  if (!zone) return;

  const zState     = state.zones[zoneId] || {};
  const isOpen     = openZones?.has(zoneId);
  const hasPending = (zState.pendingIncome || 0) > 0;
  const isFav      = (state.favoriteZones || []).includes(zoneId);
  const name       = state.lang === 'fr' ? zone.fr : zone.en;
  const maxSlots   = zState.slots || 1;
  const isFullSlot = maxSlots >= ((globalThis.ZONE_SLOT_COSTS?.length ?? 5) + 1);

  _ctxMenu = document.createElement('div');
  _ctxMenu.className = 'zone-ctx-menu';
  _ctxMenu.style.cssText = `left:${x}px;top:${y}px`;

  function renderMain() {
    const items = [
      {
        icon: isOpen ? '✕' : '▶',
        label: isOpen ? 'Fermer la zone' : 'Ouvrir la zone',
        action: () => isOpen
          ? globalThis.closeZoneWindow?.(zoneId)
          : globalThis.openZoneWindow?.(zoneId),
      },
      hasPending && {
        icon: '₽',
        label: 'Récolter les gains',
        action: () => globalThis.openCollectionModal?.(zoneId),
      },
      {
        icon: isFav ? '★' : '☆',
        label: isFav ? 'Retirer des favoris' : 'Mettre en favori',
        action: () => { toggleZoneFav(zoneId); _dismissCtxMenu(); },
      },
      {
        icon: '👤', label: 'Assigner un agent →',
        action: () => renderAgentSubmenu(),
        sub: true,
      },
      !isFullSlot && {
        icon: '🔓', label: 'Acheter un slot',
        action: () => _buySlotFromCtx(zoneId),
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
    const canAdd     = assignedIds.size < maxSlots;

    let html = `
      <div class="zone-ctx-header">
        <button class="zone-ctx-back" id="ctxBackBtn">← ${name}</button>
      </div>`;

    if (assigned.length > 0) {
      html += `<div class="zone-ctx-section">ASSIGNÉS (${assigned.length}/${maxSlots})</div>`;
      for (const a of assigned) {
        html += `<button class="zone-ctx-item zone-ctx-agent assigned" data-agent-id="${a.id}">
          <span class="zone-ctx-icon">✓</span>${a.name}
          <small style="color:var(--text-dim);margin-left:4px">${a.title}</small>
        </button>`;
      }
    }

    if (available.length > 0) {
      html += `<div class="zone-ctx-section">DISPONIBLES</div>`;
      for (const a of available) {
        const curZone = a.assignedZone
          ? (ZONE_BY_ID?.[a.assignedZone]?.fr || a.assignedZone)
          : 'sans zone';
        html += `<button class="zone-ctx-item zone-ctx-agent${canAdd ? '' : ' zone-ctx-disabled'}"
          data-agent-id="${a.id}" ${canAdd ? '' : 'disabled'}>
          <span class="zone-ctx-icon">👤</span>${a.name}
          <small style="color:var(--text-dim);margin-left:4px">${curZone}</small>
        </button>`;
      }
    }

    if (agents.length === 0) {
      html += `<div class="zone-ctx-empty">Aucun agent recruté</div>`;
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
          globalThis.notify?.(`Agent retiré de ${name}`, 'info');
        } else {
          globalThis.assignAgentToZone?.(agentId, zoneId);
        }
        globalThis.saveState?.();
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

function _buySlotFromCtx(zoneId) {
  _dismissCtxMenu();
  const state = globalThis.state;
  const zs    = globalThis.initZone?.(zoneId);
  if (!zs) return;
  const nextSlot = zs.slots || 1;
  const cost     = globalThis.getZoneSlotCost?.(zoneId, nextSlot - 1);
  if (!cost) { globalThis.notify?.('Slots maximum atteint', 'error'); return; }
  if (state.gang.money < cost) { globalThis.notify?.('Pokédollars insuffisants', 'error'); return; }
  globalThis.showConfirm?.(
    `Dépenser ${cost.toLocaleString()}₽ pour débloquer un slot agent ?`,
    () => {
      state.gang.money -= cost;
      zs.slots = nextSlot + 1;
      globalThis.saveState?.();
      globalThis.updateTopBar?.();
      globalThis.notify?.(`Zone améliorée ! Slots agents : ${zs.slots}`, 'gold');
      globalThis.renderZonesTab?.();
    },
    null,
    { confirmLabel: 'Oui', cancelLabel: 'Non' },
  );
}

// ── Gang Park tile (special — always unlocked, not a standard zone) ──
function _buildGangParkTile(zone) {
  const state = globalThis.state;
  const openZones = globalThis.openZones;
  const isOpen = openZones?.has('gang_park');
  const agentCount = state.agents.length;
  const trainingCount = (state.trainingRoom?.pokemon || []).length;
  const pensionCount = (state.pension?.slots || []).length;
  const name = state.lang === 'fr' ? zone.fr : zone.en;
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
      ${isOpen ? `<div style="font-size:7px;color:var(--gold);margin-top:2px">OUVERT</div>` : ''}
    </div>
  </div>`;
}

// ── Tile builder ──────────────────────────────────────────────
function _buildTile(zone) {
  // Special tile for Gang Park
  if (zone.type === 'gang_park') return _buildGangParkTile(zone);

  const state     = globalThis.state;
  const openZones = globalThis.openZones;
  const ZONE_BGS  = globalThis.ZONE_BGS;
  const unlocked  = globalThis.isZoneUnlocked?.(zone.id);
  const isOpen    = openZones?.has(zone.id);
  const name      = state.lang === 'fr' ? zone.fr : zone.en;
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
        title="${SPECIES_BY_EN?.[en]?.fr || en}">`
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
      ? '[OUVERT]'
      : hasEvent
        ? '[ÉVÉNEMENT]'
        : degraded
          ? '[COMBAT]'
          : hasAgent
            ? '[AUTO]'
            : '[ENTRER]';

    const tileClass = [
      'fog-tile unlocked',
      isOpen    ? 'fog-open'    : '',
      degraded  ? 'fog-degraded': '',
      hasEvent  ? 'fog-event'   : '',
      hasAgent && !isOpen ? 'fog-auto' : '',
    ].filter(Boolean).join(' ');

    return `<div class="${tileClass} zone-type-${zone.type}"
      data-zone="${zone.id}" style="${bgStyle}">
      <div class="fog-tile-overlay"></div>
      <div class="fog-tile-pool-preview">${poolPreview}</div>
      <div class="fog-tile-content">
        <div class="fog-tile-name">${displayName}${degradedTag}</div>
        <div class="fog-tile-stats">${'★'.repeat(mastery)}${mastery ? ' ' : ''}${combats}W${musicIcon}</div>
        <div class="fog-tile-status">${statusText}</div>
      </div>
      ${incomeHtml}
      ${dexBarHtml}
      <button class="zone-fav-btn${isFav ? ' active' : ''}" data-fav-zone="${zone.id}"
        title="${isFav ? 'Retirer des favoris' : "Favori (s'ouvre au démarrage)"}">${isFav ? '★' : '☆'}</button>
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
      const wingName = zone.unlockItem === 'tourbillon_permit' ? "Argent'Aile" : "Arcenci'Aile";
      const have     = state.inventory?.[wingId] || 0;
      const pct      = Math.min(100, Math.round(have / 50 * 100));
      lockHint = wingName;
      lockSub  = `<div style="height:3px;background:rgba(255,255,255,0.15);border-radius:2px;margin:3px 0;overflow:hidden">
                    <div style="height:100%;width:${pct}%;background:var(--gold);border-radius:2px"></div>
                  </div>
                  <div style="font-size:8px;color:var(--gold)">${have}/50</div>`;
    } else if (needsItem) {
      lockHint = state.lang === 'fr' ? (itemDef?.fr || zone.unlockItem) : (itemDef?.en || zone.unlockItem);
      lockSub  = '';
    } else {
      lockHint = `Rep +${repDiff}`;
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
      // Gang Park has its own toggle
      if (zid === 'gang_park') {
        globalThis.toggleGangParkWindow?.();
        return;
      }
      if (globalThis.openZones?.has(zid)) globalThis.closeZoneWindow?.(zid);
      else globalThis.openZoneWindow?.(zid);
    });
    // ── Right-click: context menu (not for gang park) ─────
    if (tile.dataset.zone !== 'gang_park') {
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
  const zone      = ZONE_BY_ID?.[zoneId];
  if (!zone) return;
  const zState   = state?.zones?.[zoneId] || {};
  const isOpen   = openZones?.has(zoneId);
  const degraded = globalThis.isZoneDegraded?.(zoneId);
  const mastery  = globalThis.getZoneMastery?.(zoneId) || 0;
  const combats  = zState.combatsWon || 0;
  const name     = state?.lang === 'fr' ? zone.fr : zone.en;

  const hasAgent     = state?.agents?.some(a => a.assignedZone === zoneId);
  const activityMode = globalThis.getZoneActivityMode?.(zoneId) || 'idle';
  const hasEvent     = activityMode === 'event';

  tile.classList.toggle('fog-open',    !!isOpen);
  tile.classList.toggle('fog-degraded',!!degraded);
  tile.classList.toggle('fog-event',   !!hasEvent && !isOpen);
  tile.classList.toggle('fog-auto',    !!hasAgent && !isOpen);

  const statusEl = tile.querySelector('.fog-tile-status');
  if (statusEl) statusEl.textContent = isOpen
    ? '[OUVERT]'
    : hasEvent   ? '[ÉVÉNEMENT]'
    : degraded   ? '[COMBAT]'
    : hasAgent   ? '[AUTO]'
    : '[ENTRER]';

  const statsEl = tile.querySelector('.fog-tile-stats');
  if (statsEl) statsEl.textContent = `${'★'.repeat(mastery)}${mastery ? ' ' : ''}${combats}W${zone.music ? ' 🎵' : ''}`;

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
  const hasOpen   = (openZones?.size || 0) > 0;
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
      [...(globalThis.openZones || [])].forEach(zid => globalThis.closeZoneWindow?.(zid));
    });
  }
  const btnCollectAll = document.getElementById('btnCollectAllZones');
  if (btnCollectAll && !btnCollectAll._bound) {
    btnCollectAll._bound = true;
    btnCollectAll.addEventListener('click', () => globalThis.collectAllZones?.());
  }
  updateZoneButtons();
}
