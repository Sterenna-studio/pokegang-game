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

// ── Filter helpers ────────────────────────────────────────────
function _getFilteredZones() {
  const ZONES = globalThis.ZONES || [];
  const state = globalThis.state;
  switch (_zoneFilter) {
    case 'fav':     return ZONES.filter(z => (state.favoriteZones || []).includes(z.id));
    case 'route':   return ZONES.filter(z => z.type === 'route');
    case 'city':    return ZONES.filter(z => z.type === 'city');
    case 'special': return ZONES.filter(z => z.type === 'special');
    default:        return ZONES;
  }
}

// ── Favorite helpers ──────────────────────────────────────────
function toggleZoneFav(zoneId) {
  const state = globalThis.state;
  if (!state.favoriteZones) state.favoriteZones = [];
  const idx = state.favoriteZones.indexOf(zoneId);
  const zone = globalThis.ZONE_BY_ID?.[zoneId];
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
  const zone      = globalThis.ZONE_BY_ID?.[zoneId];
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
          ? (globalThis.ZONE_BY_ID?.[a.assignedZone]?.fr || a.assignedZone)
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

// ── Tile builder ──────────────────────────────────────────────
function _buildTile(zone) {
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
        title="${globalThis.SPECIES_BY_EN?.[en]?.fr || en}">`
    ).join('');

    return `<div class="fog-tile unlocked ${isOpen ? 'fog-open' : ''} zone-type-${zone.type}${degraded ? ' fog-degraded' : ''}"
      data-zone="${zone.id}" style="${bgStyle}">
      <div class="fog-tile-overlay"></div>
      <div class="fog-tile-pool-preview">${poolPreview}</div>
      <div class="fog-tile-content">
        <div class="fog-tile-name">${displayName}${degradedTag}</div>
        <div class="fog-tile-stats">${'★'.repeat(mastery)}${mastery ? ' ' : ''}${combats}W${musicIcon}</div>
        <div class="fog-tile-status">${isOpen ? '[OUVERT]' : (degraded ? '[COMBAT]' : '[ENTRER]')}</div>
      </div>
      ${incomeHtml}
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
      if (globalThis.openZones?.has(zid)) globalThis.closeZoneWindow?.(zid);
      else globalThis.openZoneWindow?.(zid);
    });
    // ── Right-click: context menu ──────────────────────────
    tile.addEventListener('contextmenu', e => {
      e.preventDefault();
      showZoneContextMenu(tile.dataset.zone, e.clientX, e.clientY);
    });
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
  const isOpen = globalThis.openZones?.has(zoneId);
  tile.classList.toggle('fog-open', isOpen);
  const statusEl = tile.querySelector('.fog-tile-status');
  if (statusEl) {
    const degraded = globalThis.isZoneDegraded?.(zoneId);
    statusEl.textContent = isOpen ? '[OUVERT]' : degraded ? '[COMBAT]' : '[ENTRER]';
  }
  refreshZoneIncomeTile(zoneId);
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
    const hasPending = hasOpen && [...openZones].some(zid => (state.zones[zid]?.pendingIncome || 0) > 0);
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
