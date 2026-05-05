'use strict';
// ════════════════════════════════════════════════════════════════
//  Notification Panel
//  Remplace le système de toasts flottants (#notifications) par :
//    • Un ticker — une seule ligne éphmère en bas à droite,
//      non-overlapping (file d'attente interne).
//    • Un drawer déployable — historique des 150 dernières notifs
//      avec filtres par catégorie.
//  Seul #rarePopup reste en dehors (notification cliquable spawn rare).
//
//  API publique (globalThis) :
//    _npanel_push({ category?, title, detail?, type? })
//    _npanel_open() / _npanel_close() / _npanel_toggle()
// ════════════════════════════════════════════════════════════════

const MAX_QUEUE   = 150;
const TICKER_DURATION = 2800;  // ms d'affichage par notif
const TICKER_STALE    = 3000;  // ms au-delà desquelles on saute les entrées en attente

const _queue      = [];   // { id, ts, category, icon, title, detail, type, count }
let   _unread     = 0;
let   _isOpen     = false;
let   _filter     = 'all';

let   _tickerTimer  = null;
const _tickerQueue  = [];   // file d'attente ticker

// ── Catégories ──────────────────────────────────────────────────
const CATS = {
  gold:    { icon: '⭐', label: 'Importants'  },
  success: { icon: '✓',  label: 'Succès'     },
  error:   { icon: '⚠',  label: 'Erreurs'    },
  levelup: { icon: '📈', label: 'Niveaux'    },
  system:  { icon: '🔔', label: 'Système'    },
};

const FILTER_TABS = [
  { key: 'all',     label: 'Tout'   },
  { key: 'gold',    label: '⭐'     },
  { key: 'success', label: '✓'     },
  { key: 'error',   label: '⚠'     },
  { key: 'levelup', label: '📈'    },
];

// ── Push ─────────────────────────────────────────────────────────
function _push({ category = 'system', title = '', detail = '', type = '' } = {}) {
  const effectiveCat = (type && CATS[type]) ? type : (CATS[category] ? category : 'system');
  const cat = CATS[effectiveCat];

  // Dedup : même titre en tête de queue → incrémenter le compteur
  const last = _queue[0];
  if (last && last.title === title && last.category === effectiveCat) {
    last.count = (last.count || 1) + 1;
    last.ts    = Date.now();
    _unread++;
    _updateBadge();
    _tickerEnqueue(last);
    if (_isOpen) _renderList();
    return;
  }

  const entry = {
    id:       Date.now() + Math.random(),
    ts:       Date.now(),
    category: effectiveCat,
    icon:     cat.icon,
    title,
    detail,
    type,
    count:    1,
  };
  _queue.unshift(entry);
  if (_queue.length > MAX_QUEUE) _queue.length = MAX_QUEUE;
  _unread++;
  _updateBadge();
  _tickerEnqueue(entry);
  if (_isOpen) _renderList();
}

// ── Ticker ───────────────────────────────────────────────────────
function _tickerEnqueue(entry) {
  _tickerQueue.push({ ...entry, enqueuedAt: Date.now() });
  if (_tickerQueue.length === 1) _tickerShowNext();
}

function _tickerShowNext() {
  // Purge les entrées périmées (en attente depuis trop longtemps)
  const now = Date.now();
  while (_tickerQueue.length > 0 && now - _tickerQueue[0].enqueuedAt > TICKER_STALE) {
    _tickerQueue.shift();
  }
  if (_tickerQueue.length === 0) return;

  const entry = _tickerQueue[0];
  const el    = document.getElementById('notifTicker');
  if (!el) { _tickerQueue.shift(); return; }

  el.className = `notif-ticker notif-ticker-${entry.category}`;
  el.innerHTML  = `<span class="notif-ticker-icon">${entry.icon}</span>`
                + `<span class="notif-ticker-text">${_esc(entry.title)}${entry.count > 1 ? ` <span class="notif-count">×${entry.count}</span>` : ''}</span>`;
  el.style.opacity   = '1';
  el.style.transform = 'translateY(0)';

  clearTimeout(_tickerTimer);
  _tickerTimer = setTimeout(() => {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => {
      _tickerQueue.shift();
      if (_tickerQueue.length > 0) _tickerShowNext();
    }, 220);
  }, TICKER_DURATION);
}

// ── Badge ────────────────────────────────────────────────────────
function _updateBadge() {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  badge.textContent   = _unread > 99 ? '99+' : String(_unread);
  badge.style.display = _unread > 0 ? '' : 'none';
}

// ── Panel list ───────────────────────────────────────────────────
function _renderList() {
  const list = document.getElementById('notifPanelList');
  if (!list) return;
  const filtered = _filter === 'all' ? _queue : _queue.filter(e => e.category === _filter);
  if (filtered.length === 0) {
    list.innerHTML = `<div class="notif-empty">Aucune notification</div>`;
    return;
  }
  list.innerHTML = filtered.map(e => {
    const time = _timeAgo(e.ts);
    return `<div class="notif-entry notif-entry-${e.category}">
      <span class="notif-entry-icon">${e.icon}</span>
      <div class="notif-entry-body">
        <span class="notif-entry-title">${_esc(e.title)}${e.count > 1 ? ` <span class="notif-count">×${e.count}</span>` : ''}</span>
        ${e.detail ? `<div class="notif-entry-detail">${_esc(e.detail)}</div>` : ''}
      </div>
      <span class="notif-entry-time">${time}</span>
    </div>`;
  }).join('');
}

function _renderFilters() {
  const el = document.getElementById('notifFilters');
  if (!el) return;
  el.innerHTML = FILTER_TABS.map(f =>
    `<button class="notif-filter-btn${_filter === f.key ? ' active' : ''}" data-notif-filter="${f.key}">${f.label}</button>`
  ).join('');
  el.querySelectorAll('[data-notif-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      _filter = btn.dataset.notifFilter;
      el.querySelectorAll('[data-notif-filter]').forEach(b => b.classList.toggle('active', b.dataset.notifFilter === _filter));
      _renderList();
    });
  });
}

function _timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)  return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60)  return m + 'm';
  return Math.floor(m / 60) + 'h';
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Open / Close ─────────────────────────────────────────────────
function _open() {
  _isOpen = true;
  _unread = 0;
  _updateBadge();
  document.getElementById('notifPanel')?.classList.add('open');
  document.getElementById('notifPanelOverlay')?.classList.add('show');
  _renderFilters();
  _renderList();
}

function _close() {
  _isOpen = false;
  document.getElementById('notifPanel')?.classList.remove('open');
  document.getElementById('notifPanelOverlay')?.classList.remove('show');
}

function _toggle() { _isOpen ? _close() : _open(); }

// ── DOM injection ─────────────────────────────────────────────────
// Le panel et l'overlay sont injectés par JS pour garder toute
// la structure dans ce module (pas de HTML statique requis).
function _injectDOM() {
  if (document.getElementById('notifPanel')) return; // déjà injecté

  // Panel drawer
  const panel = document.createElement('div');
  panel.id        = 'notifPanel';
  panel.className = 'notif-panel';
  panel.innerHTML = `
    <div class="notif-panel-header">
      <span class="notif-panel-title">🔔 Notifications</span>
      <div style="display:flex;gap:6px;align-items:center">
        <button id="notifPanelClear" class="notif-panel-btn" title="Effacer tout">🗑</button>
        <button id="notifPanelClose" class="notif-panel-btn" title="Fermer">✕</button>
      </div>
    </div>
    <div id="notifFilters" class="notif-filters"></div>
    <div id="notifPanelList" class="notif-panel-list"></div>`;
  document.body.appendChild(panel);

  // Overlay (clic en dehors = fermer)
  const overlay = document.createElement('div');
  overlay.id        = 'notifPanelOverlay';
  overlay.className = 'notif-panel-overlay';
  document.body.appendChild(overlay);

  // Wire
  document.getElementById('notifBell')         ?.addEventListener('click', _toggle);
  document.getElementById('notifPanelClose')   ?.addEventListener('click', _close);
  document.getElementById('notifPanelOverlay') ?.addEventListener('click', _close);
  document.getElementById('notifPanelClear')   ?.addEventListener('click', () => {
    _queue.length = 0; _unread = 0; _updateBadge();
    if (_isOpen) _renderList();
  });
}

// Boot (works whether DOMContentLoaded already fired or not)
if (document.readyState !== 'loading') {
  _injectDOM();
} else {
  document.addEventListener('DOMContentLoaded', _injectDOM);
}

// ── Public API ───────────────────────────────────────────────────
Object.assign(globalThis, {
  _npanel_push:   _push,
  _npanel_open:   _open,
  _npanel_close:  _close,
  _npanel_toggle: _toggle,
});

export {};
