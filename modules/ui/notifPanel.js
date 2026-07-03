'use strict';
// ════════════════════════════════════════════════════════════════
//  Notification Panel
//  Remplace le système de toasts flottants (#notifications) par :
//    • Un ticker — une seule ligne éphmère en bas à droite,
//      non-overlapping (file d'attente interne).
//    • Un drawer déployable — historique des 150 dernières notifs
//      avec filtres par catégorie.
//    • Un digest — les captures/combats "routiniers" (type success,
//      hors shiny/légendaire/erreur) se regroupent en une seule entrée
//      cumulative tant que le joueur ne rouvre pas le panel, au lieu de
//      spammer une entrée par événement (utile pendant l'AFK avec
//      plusieurs agents actifs en arrière-plan). Les entrées notables
//      (gold, error, levelup...) restent toujours individuelles.
//  Seul #rarePopup reste en dehors (notification cliquable spawn rare).
//
//  API publique (globalThis) :
//    _npanel_push({ category?, title, detail?, type? })
//    _npanel_open() / _npanel_close() / _npanel_toggle()
// ════════════════════════════════════════════════════════════════

const MAX_QUEUE   = 150;
const TICKER_DURATION = 2800;  // ms d'affichage par notif
const TICKER_STALE    = 3000;  // ms au-delà desquelles on saute les entrées en attente
const DIGEST_WINDOW_MS = 2 * 60 * 1000; // fenêtre d'inactivité au-delà de laquelle un digest se referme

const _queue      = [];   // { id, ts, category, icon, title, detail, type, count, isDigest?, seen? }
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
  capture: { icon: '🔴', label: 'Captures'   },
  combat:  { icon: '⚔',  label: 'Combats'    },
  system:  { icon: '🔔', label: 'Système'    },
};

// Catégories éligibles au regroupement en digest — uniquement le "routinier" (type success) ;
// shiny/légendaire (gold), défaites (error) etc. restent toujours individuelles.
const DIGEST_CATS = new Set(['capture', 'combat']);
function _isDigestible(category, type) {
  return DIGEST_CATS.has(category) && type === 'success';
}

const FILTER_TABS = [
  { key: 'all',     label: 'Tout'   },
  { key: 'capture', label: '🔴'     },
  { key: 'combat',  label: '⚔'     },
  { key: 'gold',    label: '⭐'     },
  { key: 'success', label: '✓'     },
  { key: 'error',   label: '⚠'     },
  { key: 'levelup', label: '📈'    },
];

// ── Push ─────────────────────────────────────────────────────────
function _push({ category = 'system', title = '', detail = '', type = '' } = {}) {
  // category (explicite, ex: 'capture'/'combat') prime sur type (ex: 'gold'/'error')
  const effectiveCat = (category && CATS[category]) ? category : (type && CATS[type]) ? type : 'system';
  const cat = CATS[effectiveCat];

  if (_isDigestible(effectiveCat, type)) {
    _pushDigest(effectiveCat, cat);
    return;
  }

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

// ── Digest — regroupe les notifs routinières (capture/combat "success") ──
// Un digest actif est suivi PAR CATÉGORIE (_activeDigests), pas par position
// dans la queue : capture et combat s'entrelacent en permanence en jeu, donc
// se fier à _queue[0] ferait "perdre" le digest en cours dès qu'un événement
// d'une autre catégorie s'intercale (cas courant avec plusieurs agents actifs).
// Tant qu'un digest est actif (pas vu, pas périmé, toujours dans la queue), les
// nouveaux événements l'incrémentent silencieusement sans re-déclencher le
// ticker ni le compteur "non lu" — seule la CRÉATION d'un digest compte comme
// nouveauté. Ouvrir le panel "scelle" les digests actifs (voir _open()) :
// toute activité suivante démarre un nouveau digest, donc redevient visible.
const _activeDigests = {}; // { [category]: entry }

function _pushDigest(effectiveCat, cat) {
  const now = Date.now();
  const ref = _activeDigests[effectiveCat];
  const isActive = ref && !ref.seen
    && (now - ref.ts) < DIGEST_WINDOW_MS
    && _queue.includes(ref);

  // Titre statique (ex: "Combats") — le suffixe "×N" existant (rendu par
  // _renderList/_tickerShowNext à partir de `count`) affiche déjà le total,
  // pas besoin de le répéter dans le titre.
  if (isActive) {
    ref.count = (ref.count || 1) + 1;
    ref.ts    = now;
    if (_isOpen) _renderList();
    return; // pas de ticker ni de +1 non-lu : le digest est déjà signalé
  }

  const entry = {
    id:       now + Math.random(),
    ts:       now,
    category: effectiveCat,
    icon:     cat.icon,
    title:    cat.label,
    detail:   '',
    type:     '',
    count:    1,
    isDigest: true,
    seen:     false,
  };
  _activeDigests[effectiveCat] = entry;
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
  // Scelle les digests actifs : toute nouvelle activité routinière démarrera
  // un digest frais (donc redeviendra visible) plutôt que de continuer à
  // grossir un total déjà consulté.
  for (const e of _queue) { if (e.isDigest) e.seen = true; }
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
