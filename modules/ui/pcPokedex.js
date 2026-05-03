// ════════════════════════════════════════════════════════════════
//  PC / POKÉDEX UI MODULE
//  Extracted from app.js — PC tab, Pokédex tab, event feed, player stats
// ════════════════════════════════════════════════════════════════
//
//  app.js injects runtime dependencies through configurePcPokedex().
//  global exports remain as temporary compatibility bridges for older modules.
// ════════════════════════════════════════════════════════════════

import { getDexDesc } from '../../data/dex-helpers.js';

let pcPokedexContext = {};

function configurePcPokedex(ctx = {}) {
  pcPokedexContext = { ...pcPokedexContext, ...ctx };
}

function requireContext(name) {
  const value = pcPokedexContext[name];
  if (value === undefined) {
    throw new Error(`[pcPokedex] Missing context dependency: ${name}`);
  }
  return value;
}

function getState() {
  return requireContext('getState')();
}

function getActiveTab() {
  return requireContext('getActiveTab')();
}

function getDocument() {
  return requireContext('document');
}

function getSpeciesList() {
  return requireContext('getSpeciesList')();
}

function getSpeciesMap() {
  return requireContext('getSpeciesMap')();
}

function getWindow() {
  return requireContext('window');
}

function getPcView() {
  return requireContext('getPcView')();
}

function setPcView(value) {
  requireContext('setPcView')(value);
  return value;
}

function getEvolutionsBySpecies() {
  return requireContext('getEvolutionsBySpecies')();
}

function getPotentialUpgradeCosts() {
  return requireContext('getPotentialUpgradeCosts')();
}

function getNatures() {
  return requireContext('getNatures')();
}

function getBalls() {
  return requireContext('getBalls')();
}

function getZones() {
  return requireContext('getZones')();
}

function getZoneById() {
  return requireContext('getZoneById')();
}

function getKantoDexSize() {
  return requireContext('getKantoDexSize')();
}

function getNationalDexSize() {
  return requireContext('getNationalDexSize')();
}

function callContext(name, ...args) {
  const fn = requireContext(name);
  return typeof fn === 'function' ? fn(...args) : undefined;
}

function saveState() { return callContext('saveState'); }
function notify(...args) { return callContext('notify', ...args); }
function showConfirm(...args) { return callContext('showConfirm', ...args); }
function switchTab(...args) { return callContext('switchTab', ...args); }
function updateTopBar() { return callContext('updateTopBar'); }
function calculateStats(pokemon) { return callContext('calculateStats', pokemon) ?? pokemon.stats ?? {}; }
function tryAutoEvolution(pokemon) { return callContext('tryAutoEvolution', pokemon); }
function getPokemonPower(pokemon) { return callContext('getPokemonPower', pokemon) ?? 0; }
function getBaseSpecies(en) { return callContext('getBaseSpecies', en) ?? en; }
function speciesName(en) { return callContext('speciesName', en) ?? en; }
function pokeSprite(en, shiny = false) { return callContext('pokeSprite', en, shiny) ?? ''; }
function calculatePrice(pokemon) { return callContext('calculatePrice', pokemon) ?? 0; }
function getMarketSaturation(species) { return callContext('getMarketSaturation', species) ?? 0; }
function sellPokemon(...args) { return callContext('sellPokemon', ...args); }
function getPensionSlotIds() { return callContext('getPensionSlotIds') ?? new Set(); }
function openAssignToPicker(...args) { return callContext('openAssignToPicker', ...args); }
function renderAgentsTab() { return callContext('renderAgentsTab'); }
function renderGangTab() { return callContext('renderGangTab'); }
function renderLabTabInEl(...args) { return callContext('renderLabTabInEl', ...args); }
function renderTrainingTab(...args) { return callContext('renderTrainingTab', ...args); }
function renderPensionView(...args) { return callContext('renderPensionView', ...args); }
function eggSprite(...args) { return callContext('eggSprite', ...args) ?? ''; }
function eggImgTag(...args) { return callContext('eggImgTag', ...args) ?? ''; }
function getDexKantoCaught() { return callContext('getDexKantoCaught') ?? 0; }
function getDexNationalCaught() { return callContext('getDexNationalCaught') ?? 0; }
function getShinySpeciesCount() { return callContext('getShinySpeciesCount') ?? 0; }
function playSfx(key) {
  return requireContext('playSfx')(key);
}

const state = new Proxy({}, {
  get(_target, prop) {
    return getState()?.[prop];
  },
  set(_target, prop, value) {
    const current = getState();
    if (!current) return false;
    current[prop] = value;
    return true;
  },
  ownKeys() {
    return Reflect.ownKeys(getState() ?? {});
  },
  getOwnPropertyDescriptor(_target, prop) {
    const current = getState() ?? {};
    return Object.getOwnPropertyDescriptor(current, prop) || {
      configurable: true,
      enumerable: true,
      writable: true,
      value: current[prop],
    };
  },
});

const document = new Proxy({}, {
  get(_target, prop) {
    const doc = getDocument();
    const value = doc?.[prop];
    return typeof value === 'function' ? value.bind(doc) : value;
  },
});

const window = new Proxy({}, {
  get(_target, prop) {
    const win = getWindow();
    const value = win?.[prop];
    return typeof value === 'function' ? value.bind(win) : value;
  },
});

function createObjectProxy(getter) {
  return new Proxy({}, {
    get(_target, prop) {
      return getter()?.[prop];
    },
    ownKeys() {
      return Reflect.ownKeys(getter() ?? {});
    },
    getOwnPropertyDescriptor(_target, prop) {
      const source = getter() ?? {};
      return Object.getOwnPropertyDescriptor(source, prop) || {
        configurable: true,
        enumerable: true,
        writable: true,
        value: source[prop],
      };
    },
  });
}

function createArrayProxy(getter) {
  return new Proxy([], {
    get(_target, prop) {
      const list = getter() ?? [];
      const value = list[prop];
      return typeof value === 'function' ? value.bind(list) : value;
    },
    ownKeys() {
      return Reflect.ownKeys(getter() ?? []);
    },
    getOwnPropertyDescriptor(_target, prop) {
      const list = getter() ?? [];
      return Object.getOwnPropertyDescriptor(list, prop) || {
        configurable: true,
        enumerable: true,
        writable: true,
        value: list[prop],
      };
    },
  });
}

const POKEMON_GEN1 = new Proxy([], {
  get(_target, prop) {
    const list = getSpeciesList();
    const value = list?.[prop];
    return typeof value === 'function' ? value.bind(list) : value;
  },
  ownKeys() {
    return Reflect.ownKeys(getSpeciesList());
  },
  getOwnPropertyDescriptor(_target, prop) {
    const list = getSpeciesList();
    return Object.getOwnPropertyDescriptor(list, prop) || {
      configurable: true,
      enumerable: true,
      writable: true,
      value: list[prop],
    };
  },
});

const SPECIES_BY_EN = new Proxy({}, {
  get(_target, prop) {
    return getSpeciesMap()?.[prop];
  },
  ownKeys() {
    return Reflect.ownKeys(getSpeciesMap());
  },
  getOwnPropertyDescriptor(_target, prop) {
    const map = getSpeciesMap();
    return Object.getOwnPropertyDescriptor(map, prop) || {
      configurable: true,
      enumerable: true,
      writable: true,
      value: map[prop],
    };
  },
});

const EVO_BY_SPECIES = createObjectProxy(getEvolutionsBySpecies);
const POT_UPGRADE_COSTS = createArrayProxy(getPotentialUpgradeCosts);
const NATURES = createObjectProxy(getNatures);
const BALLS = createObjectProxy(getBalls);
const ZONES = createArrayProxy(getZones);
const ZONE_BY_ID = createObjectProxy(getZoneById);

// 17.  UI — PC TAB
// ════════════════════════════════════════════════════════════════

let pcSelectedId = null;
let pcSelectedIds = new Set(); // Ctrl/Shift+click multi-selection
let _pcLastClickedIdx = -1;   // ancre pour la sélection par plage (Shift+click)
let _pcSelectedGroups = new Set(); // multi-sélection en mode groupé
let pcPage = 0;
const PC_PAGE_SIZE = 36;
let pcGridCols = 6;   // colonnes de la grille (configurable)
let pcGridRows = 6;   // lignes par page (configurable)
let pcGroupMode = false; // regroupement par espèce
let pcGroupSpecies = null; // espèce sélectionnée en mode groupe
let _pcLastRenderKey = ''; // tracks last filter/sort/page combo to avoid unnecessary rebuilds

function resetPcSelection() {
  pcSelectedId = null;
  pcSelectedIds.clear();
  _pcLastClickedIdx = -1;
  _pcSelectedGroups.clear();
}

function resetPcRenderCache() {
  _pcLastRenderKey = '';
}

function setPcPage(value = 0) {
  pcPage = Math.max(0, Number(value) || 0);
  return pcPage;
}

// ── Filter PC to a specific species (from detail panel or Pokédex) ──
function filterPCBySpecies(species_en) {
  switchTab('tabPC');
  const searchEl = document.getElementById('pcSearch');
  if (searchEl) searchEl.value = speciesName(species_en);
  pcGroupMode = false;
  pcGroupSpecies = null;
  pcPage = 0;
  _pcLastRenderKey = '';
  renderPCTab();
}

// ── Context Menu ──────────────────────────────────────────────
let ctxMenu = null;
function showContextMenu(x, y, items) {
  closeContextMenu();
  ctxMenu = document.createElement('div');
  ctxMenu.id = 'ctxMenu';
  ctxMenu.style.cssText = `position:fixed;left:${x}px;top:${y}px;background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius-sm);z-index:9000;min-width:150px;box-shadow:0 4px 12px rgba(0,0,0,.5);overflow:hidden`;
  ctxMenu.innerHTML = items.filter(it => it !== '---').map(it =>
    `<div class="ctx-item" data-action="${it.action}" style="padding:8px 14px;font-size:11px;cursor:pointer;white-space:nowrap">${it.label}</div>`
  ).join('');
  document.body.appendChild(ctxMenu);
  const actionMap = {};
  items.forEach(it => { if (it !== '---' && it.action) actionMap[it.action] = it.fn; });
  ctxMenu.querySelectorAll('.ctx-item').forEach(el => {
    el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,.07)');
    el.addEventListener('mouseleave', () => el.style.background = '');
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const fn = actionMap[el.dataset.action];
      if (fn) fn();
      closeContextMenu();
    });
  });
  requestAnimationFrame(() => {
    if (!ctxMenu) return;
    const r = ctxMenu.getBoundingClientRect();
    if (r.right > window.innerWidth) ctxMenu.style.left = (x - r.width) + 'px';
    if (r.bottom > window.innerHeight) ctxMenu.style.top = (y - r.height) + 'px';
  });
  setTimeout(() => document.addEventListener('click', closeContextMenu, { once: true }), 0);
}
function closeContextMenu() {
  ctxMenu?.remove();
  ctxMenu = null;
}

// ── Game Event Feed ─────────────────────────────────────────────
// Remplace l'ancien battleLog — reçoit toutes les catégories d'événements.
// Appelé via pushFeedEvent({ category, title, detail?, win? })
const gameFeed = [];
const FEED_MAX = 100;
let feedFilter = 'all';

const FEED_CAT = {
  combat:  { icon: '⚔', label: 'Combat' },
  capture: { icon: '🔴', label: 'Capture' },
  agent:   { icon: '🕵', label: 'Agent' },
  loot:    { icon: '💰', label: 'Butin' },
  zone:    { icon: '🗺', label: 'Zone' },
  system:  { icon: '⚙', label: 'Système' },
};

function pushFeedEvent({ category = 'system', title = '', detail = '', win = null, ...extra } = {}) {
  const cat = FEED_CAT[category] || FEED_CAT.system;
  gameFeed.unshift({ ts: Date.now(), category, icon: cat.icon, title, detail, win, ...extra });
  if (gameFeed.length > FEED_MAX) gameFeed.pop();
  if (getActiveTab() === 'tabBattleLog') renderEventsTab();
}

let feedWinFilter = 'all'; // 'all' | 'win' | 'loss'

function renderEventsTab() {
  const filtersEl = document.getElementById('feedFilters');
  const listEl    = document.getElementById('feedList');
  if (!listEl) return;

  if (filtersEl && !filtersEl.dataset.wired) {
    filtersEl.dataset.wired = '1';
    const cats = ['all', ...Object.keys(FEED_CAT)];
    const winFilterHtml = `
      <div class="feed-win-filters" style="display:flex;gap:4px;margin-left:auto">
        <button class="feed-filter-btn" data-wf="all">Tous</button>
        <button class="feed-filter-btn" data-wf="win" style="color:var(--green)">✓ Vic.</button>
        <button class="feed-filter-btn" data-wf="loss" style="color:var(--red)">✗ Déf.</button>
      </div>`;
    filtersEl.innerHTML = cats.map(c => {
      const label = c === 'all' ? 'Tout' : (FEED_CAT[c].icon + ' ' + FEED_CAT[c].label);
      return `<button class="feed-filter-btn" data-ff="${c}">${label}</button>`;
    }).join('') + winFilterHtml;
    filtersEl.querySelectorAll('[data-ff]').forEach(btn => {
      btn.addEventListener('click', () => { feedFilter = btn.dataset.ff; renderEventsTab(); });
    });
    filtersEl.querySelectorAll('[data-wf]').forEach(btn => {
      btn.addEventListener('click', () => { feedWinFilter = btn.dataset.wf; renderEventsTab(); });
    });
  }
  // Highlight active filters
  filtersEl?.querySelectorAll('[data-ff]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.ff === feedFilter);
  });
  filtersEl?.querySelectorAll('[data-wf]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.wf === feedWinFilter);
  });

  let filtered = feedFilter === 'all' ? gameFeed : gameFeed.filter(e => e.category === feedFilter);
  if (feedWinFilter === 'win')  filtered = filtered.filter(e => e.win === true);
  if (feedWinFilter === 'loss') filtered = filtered.filter(e => e.win === false);

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="color:var(--text-dim);text-align:center;padding:24px;font-size:9px">Aucun événement</div>`;
    return;
  }

  listEl.innerHTML = filtered.map((e, i) => {
    const time  = new Date(e.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const color = e.win === true ? 'var(--green)' : e.win === false ? 'var(--red)' : 'var(--text)';
    const hasExpandable = e.detail || e.combatLog?.length || e.species_en;

    // Capture entry: show sprite + stars
    let captureHtml = '';
    if (e.category === 'capture' && e.species_en) {
      const stars = '★'.repeat(e.potential || 0) + '☆'.repeat(5 - (e.potential || 0));
      const shinyGlow = e.shiny ? 'filter:drop-shadow(0 0 4px var(--gold))' : '';
      captureHtml = `<div class="feed-capture-preview" style="display:flex;align-items:center;gap:6px;margin-top:4px">
        <img src="${pokeSprite(e.species_en, e.shiny)}" style="width:32px;height:32px;image-rendering:pixelated;${shinyGlow}" alt="${e.species_en}">
        <span style="font-family:var(--font-pixel);font-size:9px;color:${e.shiny ? 'var(--gold)' : 'var(--text-dim)'}">${stars}${e.byAgent ? ` · ${e.byAgent}` : ''}</span>
      </div>`;
    }

    // Combat log for replay
    let combatLogHtml = '';
    if (e.combatLog?.length) {
      combatLogHtml = `<div class="feed-combat-log" style="display:none;margin-top:6px;border-top:1px solid var(--border);padding-top:4px;max-height:120px;overflow-y:auto">
        ${e.combatLog.map(line => `<div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:1px">${line}</div>`).join('')}
      </div>
      <button class="feed-replay-btn" style="font-family:var(--font-pixel);font-size:7px;margin-top:4px;padding:1px 6px;background:rgba(255,255,255,.07);border:1px solid var(--border);border-radius:2px;cursor:pointer;color:var(--text-dim)">📋 Log combat</button>`;
    }

    return `<div class="feed-entry${hasExpandable ? ' feed-has-detail' : ''}" data-fi="${i}">
      <span class="feed-icon">${e.icon}</span>
      <div class="feed-body">
        <div class="feed-title" style="color:${color}">${e.title}</div>
        ${e.detail ? `<div class="feed-detail">${e.detail}</div>` : ''}
        ${captureHtml}
        ${combatLogHtml}
      </div>
      <span class="feed-time">${time}</span>
    </div>`;
  }).join('');

  // Toggle detail on click + replay log toggle
  listEl.querySelectorAll('.feed-entry.feed-has-detail').forEach(el => {
    el.addEventListener('click', (ev) => {
      if (ev.target.closest('.feed-replay-btn')) return; // handled separately
      el.classList.toggle('feed-open');
    });
  });
  listEl.querySelectorAll('.feed-replay-btn').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const logEl = btn.previousElementSibling;
      if (!logEl) return;
      const isOpen = logEl.style.display !== 'none';
      logEl.style.display = isOpen ? 'none' : 'block';
      btn.textContent = isOpen ? '📋 Log combat' : '▲ Fermer log';
    });
  });
}

// Compatibility shim for legacy addBattleLogEntry calls (gym auto-raids, etc.)
function addBattleLogEntry(entry) {
  const zoneName = entry.zoneName || '?';
  const result   = entry.win
    ? `+${entry.reward || 0}₽ +${entry.repGain || 0}rep`
    : 'Défaite';
  pushFeedEvent({
    category: 'combat',
    title: `${entry.win ? 'Victoire' : 'Défaite'} — ${zoneName} ${result}`,
    detail: (entry.lines || []).join(' · '),
    win: !!entry.win,
  });
}

function openBulkSellModal() {
  const existing = document.getElementById('bulkSellModal');
  if (existing) existing.remove();

  // Compute the set of protected Pokémon IDs
  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
  const trainingIds = new Set(state.trainingRoom?.pokemon || []);
  const pensionIds  = getPensionSlotIds();

  // Default filter state
  let potFilter    = new Set([1, 2]);    // potentials to sell
  let keepBest     = true;               // keep ≥1 top-potential per species
  let keepFav      = true;
  let keepTeam     = true;              // covers team + training + pension

  function computeSellList() {
    return state.pokemons.filter(pk => {
      if (pk.shiny)                              return false;
      if (!potFilter.has(pk.potential))          return false;
      if (keepFav  && pk.favorite)               return false;
      if (keepTeam && (teamIds.has(pk.id) || trainingIds.has(pk.id) || pensionIds.has(pk.id))) return false;
      if (keepBest) {
        // Keep this pokémon if it is the top-potential non-shiny non-protected of its species
        const best = state.pokemons
          .filter(p => p.species_en === pk.species_en && !p.shiny
            && !teamIds.has(p.id) && !trainingIds.has(p.id) && !pensionIds.has(p.id))
          .reduce((a, b) => (b.potential > a.potential ? b : a), pk);
        if (pk.id === best.id) return false;
      }
      return true;
    });
  }

  const modal = document.createElement('div');
  modal.id = 'bulkSellModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;';

  function buildHTML() {
    const list  = computeSellList();
    const total = list.reduce((s, pk) => s + calculatePrice(pk), 0);
    const potLabels = [1, 2, 3, 4, 5].map(n =>
      `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:9px">
        <input type="checkbox" data-pot="${n}" ${potFilter.has(n) ? 'checked' : ''} style="accent-color:var(--gold)">
        ${'★'.repeat(n)}
      </label>`
    ).join('');

    return `<div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:22px 24px;max-width:380px;width:92%;display:flex;flex-direction:column;gap:14px;font-family:var(--font-pixel)">
      <div style="font-size:12px;color:var(--gold)">💸 Vente en masse</div>

      <div>
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">VENDRE LES POTENTIELS</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">${potLabels}</div>
      </div>

      <div style="display:flex;flex-direction:column;gap:6px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:9px">
          <input type="checkbox" id="bsmKeepBest" ${keepBest ? 'checked' : ''} style="accent-color:var(--gold)">
          Garder le meilleur de chaque espèce
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:9px">
          <input type="checkbox" id="bsmKeepFav" ${keepFav ? 'checked' : ''} style="accent-color:var(--gold)">
          Garder les favoris
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:9px">
          <input type="checkbox" id="bsmKeepTeam" ${keepTeam ? 'checked' : ''} style="accent-color:var(--gold)">
          Garder équipes / entraînement / pension
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:default;font-size:9px;opacity:.55">
          <input type="checkbox" checked disabled style="accent-color:var(--gold)">
          ✨ Garder les chromatiques (toujours)
        </label>
      </div>

      <div id="bsmPreview" style="padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);text-align:center">
        <span style="font-size:11px;color:var(--gold)">${list.length} Pokémon — ${total.toLocaleString()}₽</span>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="bsmCancel" style="font-size:9px;padding:8px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
        <button id="bsmSell" style="font-size:9px;padding:8px 14px;background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius-sm);color:#fff;cursor:pointer" ${list.length === 0 ? 'disabled style="opacity:.4"' : ''}>
          Vendre ${list.length}
        </button>
      </div>
    </div>`;
  }

  function refresh() {
    modal.innerHTML = buildHTML();
    bindModalEvents();
  }

  function bindModalEvents() {
    modal.querySelectorAll('[data-pot]').forEach(cb => {
      cb.addEventListener('change', () => {
        const n = parseInt(cb.dataset.pot);
        cb.checked ? potFilter.add(n) : potFilter.delete(n);
        refresh();
      });
    });
    document.getElementById('bsmKeepBest')?.addEventListener('change',  e => { keepBest  = e.target.checked; refresh(); });
    document.getElementById('bsmKeepFav')?.addEventListener('change',   e => { keepFav   = e.target.checked; refresh(); });
    document.getElementById('bsmKeepTeam')?.addEventListener('change',  e => { keepTeam  = e.target.checked; refresh(); });
    document.getElementById('bsmCancel')?.addEventListener('click', () => modal.remove());
    document.getElementById('bsmSell')?.addEventListener('click', () => {
      const list = computeSellList();
      if (!list.length) return;
      const total = list.reduce((s, pk) => s + calculatePrice(pk), 0);
      modal.remove();
      showConfirm(
        `Vendre <b>${list.length}</b> Pokémon pour <b style="color:var(--gold)">${total.toLocaleString()}₽</b> ?<br><span style="color:var(--text-dim);font-size:10px">Shinies et favoris exclus.</span>`,
        () => { sellPokemon(list.map(pk => pk.id)); _pcLastRenderKey = ''; updateTopBar(); renderPCTab(); },
        null, { confirmLabel: 'Vendre', cancelLabel: 'Annuler', danger: true }
      );
    });
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }

  modal.innerHTML = buildHTML();
  document.body.appendChild(modal);
  bindModalEvents();
}

function renderPCTab() {
  // Inject view switcher if not present
  const pcLayout = document.querySelector('#tabPC .pc-layout');
  if (pcLayout) {
    let switcher = document.getElementById('pcViewSwitcher');
    if (!switcher) {
      switcher = document.createElement('div');
      switcher.id = 'pcViewSwitcher';
      switcher.className = 'pc-view-switcher';
      switcher.innerHTML = `
        <button class="pc-view-btn" id="pcBtnGrid" data-pcview="grid">[PC]</button>
        <button class="pc-view-btn" id="pcBtnTraining" data-pcview="training">[FORMATION]</button>
        <button class="pc-view-btn" id="pcBtnLab" data-pcview="lab">[LABO]</button>
        <button class="pc-view-btn" id="pcBtnPension" data-pcview="pension">[PENSION${state.eggs.length ? ` & ${state.eggs.length} 🥚` : ''}]</button>`;
      pcLayout.parentNode.insertBefore(switcher, pcLayout);
      switcher.querySelectorAll('.pc-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          setPcView(btn.dataset.pcview);
          renderPCTab();
        });
      });
    }
    // Redirect legacy 'eggs' pcView to 'pension' (merged)
    if (getPcView() === 'eggs') setPcView('pension');

    // Update active state + eggs count (always refresh)
    switcher.querySelectorAll('.pc-view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.pcview === getPcView());
    });
    const pensionBtn = switcher.querySelector('#pcBtnPension');
    if (pensionBtn) pensionBtn.textContent = `[PENSION${state.eggs.length ? ` & ${state.eggs.length} 🥚` : ''}]`;

    const subViews = ['trainingInPC', 'labInPC', 'pensionInPC'];
    if (getPcView() === 'training') {
      pcLayout.style.display = 'none';
      subViews.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = id === 'trainingInPC' ? '' : 'none'; });
      let trainingInPC = document.getElementById('trainingInPC');
      if (!trainingInPC) {
        trainingInPC = document.createElement('div');
        trainingInPC.id = 'trainingInPC';
        pcLayout.parentNode.appendChild(trainingInPC);
      }
      trainingInPC.style.display = '';
      renderTrainingTab();
      return;
    } else if (getPcView() === 'lab') {
      pcLayout.style.display = 'none';
      subViews.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = id === 'labInPC' ? '' : 'none'; });
      let labInPC = document.getElementById('labInPC');
      if (!labInPC) {
        labInPC = document.createElement('div');
        labInPC.id = 'labInPC';
        pcLayout.parentNode.appendChild(labInPC);
      }
      labInPC.style.display = '';
      renderLabTabInEl(labInPC);
      return;
    } else if (getPcView() === 'pension') {
      pcLayout.style.display = 'none';
      subViews.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = id === 'pensionInPC' ? '' : 'none'; });
      let pensionInPC = document.getElementById('pensionInPC');
      if (!pensionInPC) {
        pensionInPC = document.createElement('div');
        pensionInPC.id = 'pensionInPC';
        pcLayout.parentNode.appendChild(pensionInPC);
      }
      pensionInPC.style.display = '';
      renderPensionView(pensionInPC);
      return;
    } else {
      pcLayout.style.display = '';
      subViews.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    }
  }

  // ── Barre d'outils PC (grille + groupement) ───────────────────
  let pcToolbar = document.getElementById('pcToolbar');
  const pcGrid = document.getElementById('pokemonGrid');
  if (!pcToolbar && pcGrid) {
    pcToolbar = document.createElement('div');
    pcToolbar.id = 'pcToolbar';
    pcGrid.parentNode.insertBefore(pcToolbar, pcGrid);
  }
  if (pcToolbar) {
    pcToolbar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0 4px 2px;flex-wrap:wrap';
    pcToolbar.innerHTML = `
      <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">Grille:</span>
      <select id="pcColsSel" style="font-size:9px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:2px 4px">
        <option value="4" ${pcGridCols===4?'selected':''}>4 col</option>
        <option value="6" ${pcGridCols===6?'selected':''}>6 col</option>
        <option value="8" ${pcGridCols===8?'selected':''}>8 col</option>
        <option value="10" ${pcGridCols===10?'selected':''}>10 col</option>
      </select>
      <select id="pcRowsSel" style="font-size:9px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:2px 4px">
        <option value="4" ${pcGridRows===4?'selected':''}>4 lg</option>
        <option value="6" ${pcGridRows===6?'selected':''}>6 lg</option>
        <option value="8" ${pcGridRows===8?'selected':''}>8 lg</option>
      </select>
      <label style="display:flex;align-items:center;gap:4px;font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);cursor:pointer;user-select:none">
        <input type="checkbox" id="pcGroupChk" ${pcGroupMode?'checked':''} style="accent-color:var(--gold)">
        Grouper
      </label>
      <div style="flex:1"></div>
      <button id="pcBtnSelectPage" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer" title="Sélectionner toute la page (ou Shift+Clic sur les cartes)">☐ Tout</button>
      <button id="pcBtnBulkSell" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">💸 Vendre max</button>`;
    document.getElementById('pcColsSel')?.addEventListener('change', e => {
      pcGridCols = parseInt(e.target.value); pcPage = 0; renderPokemonGrid(true);
    });
    document.getElementById('pcRowsSel')?.addEventListener('change', e => {
      pcGridRows = parseInt(e.target.value); pcPage = 0; renderPokemonGrid(true);
    });
    document.getElementById('pcGroupChk')?.addEventListener('change', e => {
      pcGroupMode = e.target.checked;
      pcGroupSpecies = null; pcPage = 0;
      _pcSelectedGroups.clear(); _pcLastClickedIdx = -1;
      renderPokemonGrid(true); renderPokemonDetail();
    });
    document.getElementById('pcBtnSelectPage')?.addEventListener('click', () => {
      const cards = [...document.querySelectorAll('#pcGrid .pc-pokemon')];
      if (!cards.length) return;
      const allSelected = cards.every(c => pcSelectedIds.has(c.dataset.pkId));
      if (allSelected) {
        cards.forEach(c => { pcSelectedIds.delete(c.dataset.pkId); c.classList.remove('multi-selected'); });
      } else {
        cards.forEach(c => { pcSelectedIds.add(c.dataset.pkId); c.classList.add('multi-selected'); });
      }
      renderPokemonDetail();
    });
    document.getElementById('pcBtnBulkSell')?.addEventListener('click', openBulkSellModal);
  }

  renderPokemonGrid();
  renderPokemonDetail();
}

// Auto-incubation — Infirmière Joëlle corrompue
function tryAutoIncubate() {
  if (!state.purchases?.autoIncubator) return;
  if (state.purchases?.autoIncubatorEnabled === false) return; // en congé
  const incubatorCount = state.inventory?.incubator || 0;
  if (incubatorCount === 0) return;
  const eggs = state.eggs || [];
  let changed = false;
  for (const egg of eggs) {
    if (egg.incubating) continue;
    const incubatingNow = eggs.filter(e => e.incubating && e.status !== 'ready').length;
    if (incubatingNow >= incubatorCount) break;
    egg.incubating = true;
    egg.incubatedAt = Date.now();
    egg.hatchAt = Date.now() + (egg.hatchMs || 2700000);
    changed = true;
  }
  if (changed) { saveState(); notify('💉 Joëlle a mis un oeuf en incubation !', 'success'); }
}

function hatchEgg(eggId) {
  const egg = state.eggs.find(e => e.id === eggId);
  if (!egg) return;

  // Always hatch as the lowest evolution stage (Dodrio → Doduo, etc.)
  const baseEn  = getBaseSpecies(egg.species_en);
  const hatched = makePokemon(baseEn, 'pension', 'pokeball');
  if (!hatched) { state.eggs = state.eggs.filter(e => e.id !== eggId); saveState(); renderPCTab(); return; }

  hatched.level = 1; hatched.xp = 0;
  hatched.potential = egg.potential;
  hatched.shiny     = egg.shiny;
  hatched.stats     = calculateStats(hatched);
  hatched.history   = [{ type: 'hatched', ts: Date.now() }];

  state.eggs = state.eggs.filter(e => e.id !== eggId);
  state.pokemons.push(hatched);
  state.stats.totalCaught++;
  state.stats.eggsHatched = (state.stats.eggsHatched || 0) + 1;
  if (!state.pokedex[baseEn]) {
    state.pokedex[baseEn] = { seen: true, caught: true, shiny: egg.shiny, count: 1 };
  } else {
    state.pokedex[baseEn].caught = true;
    state.pokedex[baseEn].count++;
    if (egg.shiny) state.pokedex[baseEn].shiny = true;
  }
  saveState();

  // ── Animation popup ─────────────────────────────────────────────
  // Try PokéOS species egg for pension eggs, fallback to rarity sprite
  const _sp = SPECIES_BY_EN[egg.species_en];
  const _dex = _sp?.dex;
  const _hasPokeos = _dex && (egg.parentA || egg.scanned);
  const eggUrl = _hasPokeos
    ? `https://s3.pokeos.com/pokeos-uploads/forgotten-dex/eggs/${_dex}-animegg.png`
    : eggSprite(egg);
  const eggFallback = eggSprite(egg);
  const pkUrl  = pokeSprite(baseEn, egg.shiny);
  const name   = speciesName(baseEn);
  const stars  = '★'.repeat(hatched.potential || 0);

  const modal = document.createElement('div');
  modal.id = 'hatchModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9400;background:rgba(0,0,0,.95);display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <style>
      @keyframes _eggWobble {
        0%,100%{transform:rotate(0deg)}
        20%{transform:rotate(-9deg)}
        40%{transform:rotate(9deg)}
        60%{transform:rotate(-5deg)}
        80%{transform:rotate(5deg)}
      }
      @keyframes _eggCrack {
        0%{transform:scale(1);opacity:1}
        50%{transform:scale(1.2);opacity:.8}
        100%{transform:scale(0) rotate(20deg);opacity:0}
      }
      @keyframes _pkReveal {
        0%{transform:scale(0) translateY(16px);opacity:0}
        65%{transform:scale(1.15) translateY(-4px);opacity:1}
        100%{transform:scale(1) translateY(0);opacity:1}
      }
      #_hatchEgg { animation:_eggWobble .55s ease-in-out infinite; }
      #_hatchEgg.cracking { animation:_eggCrack .45s ease-in forwards; }
      #_hatchPk { display:none; animation:_pkReveal .5s cubic-bezier(.17,.67,.37,1.3) forwards; image-rendering:pixelated; }
      #_hatchPk.visible { display:block; }
    </style>
    <div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);padding:32px 28px;max-width:300px;width:90%;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold);letter-spacing:.1em">✦ ÉCLOSION ✦</div>
      <div style="position:relative;width:88px;height:88px;display:flex;align-items:center;justify-content:center">
        <img id="_hatchEgg" src="${eggUrl}" style="width:64px;height:64px;object-fit:contain" onerror="if(!this._f){this._f=1;this.src='${eggFallback}'}">
        <img id="_hatchPk"  src="${pkUrl}"  style="width:88px;height:88px;position:absolute;inset:0;${egg.shiny ? 'filter:drop-shadow(0 0 8px gold)' : ''}">
      </div>
      <div id="_hatchInfo" style="opacity:0;transition:opacity .4s;display:flex;flex-direction:column;gap:6px">
        <div style="font-family:var(--font-pixel);font-size:12px;${egg.shiny ? 'color:gold' : 'color:var(--text)'}">${egg.shiny ? '✨ SHINY !  ' : ''}${name}</div>
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">Lv. 1 &nbsp; ${stars}</div>
      </div>
      <button id="_hatchClose" style="font-family:var(--font-pixel);font-size:8px;padding:6px 22px;background:var(--bg);border:1px solid var(--gold);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;opacity:0;pointer-events:none;transition:opacity .3s">OK !</button>
    </div>`;
  document.body.appendChild(modal);

  // Wobble 2.4s → crack → reveal pokemon
  setTimeout(() => document.getElementById('_hatchEgg')?.classList.add('cracking'), 2400);
  setTimeout(() => {
    const eggEl = document.getElementById('_hatchEgg');
    const pkEl  = document.getElementById('_hatchPk');
    const info  = document.getElementById('_hatchInfo');
    const btn   = document.getElementById('_hatchClose');
    if (eggEl) eggEl.style.display = 'none';
    if (pkEl)  pkEl.classList.add('visible');
    if (info)  info.style.opacity  = '1';
    if (btn)   { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; }
    playSfx('unlock');
  }, 3000);

  document.getElementById('_hatchClose').addEventListener('click', () => {
    modal.remove();
    updateTopBar();
    renderPCTab();
  });
}

function renderEggsView(container) {
  const eggs = state.eggs || [];
  const incubatorCount = state.inventory?.incubator || 0;
  const incubatingCount = eggs.filter(e => e.incubating && e.status !== 'ready').length;
  const freeIncubators = incubatorCount - incubatingCount;

  if (eggs.length === 0) {
    container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-dim);font-family:var(--font-pixel);font-size:10px">Aucun oeuf pour le moment.<br><br>Utilise la <b style="color:var(--text)">Pension</b> ou achète un <b style="color:var(--text)">Oeuf Mystère</b> au Marché.</div>`;
    return;
  }

  const now = Date.now();
  container.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:12px;padding:8px">
      ${eggs.map(egg => {
        const isReady = egg.status === 'ready' || (egg.incubating && egg.hatchAt && egg.hatchAt <= now);
        const isIncubating = egg.incubating && !isReady;
        const timeLeft = isIncubating && egg.hatchAt ? Math.max(0, Math.ceil((egg.hatchAt - now) / 60000)) : null;
        const progress = isIncubating && egg.hatchAt && egg.incubatedAt
          ? Math.min(100, Math.round((now - egg.incubatedAt) / (egg.hatchAt - egg.incubatedAt) * 100))
          : 0;

        // Parents info
        let parentHtml = '';
        if (egg.parentA && egg.parentB) {
          const pA = state.pokemons.find(p => p.id === egg.parentA) || { species_en: egg.parentASpecies };
          const pB = state.pokemons.find(p => p.id === egg.parentB) || { species_en: egg.parentBSpecies };
          const pAName = pA?.species_en ? speciesName(pA.species_en) : '?';
          const pBName = pB?.species_en ? speciesName(pB.species_en) : '?';
          const pALvl = pA?.level ? ` Lv.${pA.level}` : '';
          const pBLvl = pB?.level ? ` Lv.${pB.level}` : '';
          const pAPot = pA?.potential ? ' ' + '★'.repeat(pA.potential) : '';
          const pBPot = pB?.potential ? ' ' + '★'.repeat(pB.potential) : '';
          parentHtml = `<div style="display:flex;flex-direction:column;gap:3px;margin-top:4px;align-items:center">
            <div style="display:flex;align-items:center;gap:4px">
              ${pA?.species_en ? `<img src="${pokeSprite(pA.species_en)}" style="width:22px;height:22px" title="${pAName}${pALvl}${pAPot}">` : ''}
              <span style="font-size:9px;color:var(--red)">♥</span>
              ${pB?.species_en ? `<img src="${pokeSprite(pB.species_en)}" style="width:22px;height:22px" title="${pBName}${pBLvl}${pBPot}">` : ''}
            </div>
            <div style="font-size:7px;color:var(--text-dim);text-align:center">${pAName}${pAPot} × ${pBName}${pBPot}</div>
          </div>`;
        } else if (egg.source) {
          parentHtml = `<div style="font-size:8px;color:var(--text-dim);margin-top:4px">${egg.source}</div>`;
        } else {
          parentHtml = `<div style="font-size:8px;color:var(--text-dim);margin-top:4px">Mystère</div>`;
        }

        const statusColor = isReady ? 'var(--green)' : isIncubating ? 'var(--gold)' : 'var(--text-dim)';
        const statusText = isReady
          ? '✅ Prêt à éclore !'
          : isIncubating ? `🥚 ${timeLeft}min restantes`
          : '⏳ En attente d\'incubateur';

        return `<div style="background:var(--bg-card);border:1px solid ${isReady ? 'var(--green)' : 'var(--border)'};border-radius:var(--radius);padding:10px;min-width:130px;max-width:150px;display:flex;flex-direction:column;align-items:center;gap:6px;${isReady ? 'box-shadow:0 0 8px rgba(68,187,85,.3)' : ''}">
          ${eggImgTag(egg, isReady, `width:64px;height:64px;${isReady ? 'filter:drop-shadow(0 0 6px var(--green))' : ''}`)}
          ${parentHtml}
          <div style="font-size:8px;color:${statusColor};text-align:center;font-family:var(--font-pixel);line-height:1.4">${statusText}</div>
          ${isIncubating && !isReady ? `
            <div style="width:100%;height:4px;background:var(--bg);border-radius:2px;overflow:hidden">
              <div style="height:100%;width:${progress}%;background:var(--gold);transition:width .5s"></div>
            </div>` : ''}
          <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center">
            ${isReady ? `<button class="egg-hatch-btn" data-egg-id="${egg.id}" style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--green);border:none;border-radius:var(--radius-sm);color:#000;cursor:pointer">Éclore !</button>` : ''}
            ${!isIncubating && freeIncubators > 0 ? `<button class="egg-incubate-btn" data-egg-id="${egg.id}" style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Incuber</button>` : ''}
            ${!isIncubating && incubatorCount > 0 && freeIncubators === 0 ? `<span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">Incubateurs pleins</span>` : ''}
            ${!isIncubating && incubatorCount === 0 ? `<span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">Aucun incubateur</span>` : ''}
            <button class="egg-sell-btn" data-egg-id="${egg.id}" style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Vendre</button>
            ${!egg.scanned && (state.inventory?.egg_scanner || 0) > 0
              ? `<button class="egg-scan-btn" data-egg-id="${egg.id}" style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--bg);border:1px solid #c05be0;border-radius:var(--radius-sm);color:#c05be0;cursor:pointer">🔬 Scanner</button>`
              : ''}
            ${egg.scanned && egg.revealedSpecies
              ? `<div style="font-size:8px;color:#c05be0;text-align:center;font-family:var(--font-pixel)">🔬 ${speciesName(egg.revealedSpecies)}</div>`
              : egg.scanned && !egg.revealedSpecies
              ? `<div style="font-size:8px;color:#666;text-align:center">🔬 Inconnu…</div>`
              : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;

  // Bind buttons
  container.querySelectorAll('.egg-hatch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const egg = state.eggs.find(e => e.id === btn.dataset.eggId);
      if (egg) hatchEgg(egg.id);
      renderPCTab();
    });
  });
  container.querySelectorAll('.egg-incubate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const egg = state.eggs.find(e => e.id === btn.dataset.eggId);
      if (!egg) return;
      egg.incubating = true;
      egg.incubatedAt = Date.now();
      egg.hatchAt = Date.now() + (egg.hatchMs || 2700000); // 45min default
      saveState();
      renderPCTab();
      notify('Oeuf mis en incubation !', 'success');
    });
  });
  container.querySelectorAll('.egg-sell-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const egg = state.eggs.find(e => e.id === btn.dataset.eggId);
      if (!egg) return;
      const price = egg.sellPrice || 500;
      showConfirm(
        `Vendre cet oeuf pour <strong style="color:var(--gold)">${price.toLocaleString()}₽</strong> ?<br><span style="color:var(--text-dim);font-size:11px">Tu ne sauras jamais quel Pokémon était dedans.</span>`,
        () => {
          state.eggs = state.eggs.filter(e => e.id !== egg.id);
          state.gang.money += price;
          saveState();
          renderPCTab();
          notify(`Oeuf vendu — ${price}₽`, 'gold');
        },
        null,
        { confirmLabel: 'Vendre', cancelLabel: 'Garder', danger: true }
      );
    });
  });
  container.querySelectorAll('.egg-scan-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const egg = state.eggs.find(e => e.id === btn.dataset.eggId);
      if (!egg || egg.scanned) return;
      if ((state.inventory.egg_scanner || 0) < 1) { notify('Aucun Scanneur d\'Oeuf disponible.', 'error'); return; }
      // Roll d100: 1-89 = reveal (scanner survives), 90-99 = scanner détruit, 100 = oeuf détruit
      const roll = Math.random() * 100;
      if (roll < 89) {
        egg.revealedSpecies = egg.species_en;
        egg.scanned = true;
        notify(`🔬 Scan réussi ! C'est un ${speciesName(egg.species_en)} !`, 'gold');
      } else if (roll < 99) {
        state.inventory.egg_scanner--;
        egg.scanned = true;
        egg.revealedSpecies = null;
        notify('🔬 Scanneur détruit dans l\'opération… Espèce inconnue.', 'error');
      } else {
        state.inventory.egg_scanner--;
        const idx = state.eggs.indexOf(egg);
        if (idx !== -1) state.eggs.splice(idx, 1);
        notify('💥 L\'oeuf a été détruit par le scan défectueux !', 'error');
        saveState();
        const eggsEl = document.getElementById('eggsInPC');
        if (eggsEl) renderEggsView(eggsEl);
        return;
      }
      saveState();
      const eggsEl = document.getElementById('eggsInPC');
      if (eggsEl) renderEggsView(eggsEl);
    });
  });
}

// ── PC grid helpers ──────────────────────────────────────────────────────────

function _buildPCCard(p, teamIds, trainingIds, pensionIds) {
  const inTeam = teamIds.has(p.id);
  const inTraining = trainingIds.has(p.id);
  const inPension = pensionIds ? pensionIds.has(p.id) : false;
  return `<div class="pc-pokemon ${p.shiny ? 'shiny' : ''} ${pcSelectedId === p.id ? 'selected' : ''} ${pcSelectedIds.has(p.id) ? 'multi-selected' : ''} ${inTeam ? 'in-team' : ''} ${inTraining ? 'in-training' : ''}" data-pk-id="${p.id}" title="${speciesName(p.species_en)} Lv.${p.level} ${'★'.repeat(p.potential)}${p.shiny ? ' ✨' : ''}${inTraining ? ' [ENTRAINEMENT]' : ''}${inPension ? ' [PENSION]' : ''}">
    <img src="${pokeSprite(p.species_en, p.shiny)}" alt="${speciesName(p.species_en)}">
    ${p.favorite ? '<div class="pc-fav-badge">FAV</div>' : ''}
    ${inTeam ? '<div class="pc-team-badge">EQ</div>' : ''}
    ${inTraining ? '<div class="pc-training-badge">TR</div>' : ''}
    ${inPension ? '<div class="pc-pension-badge">PS</div>' : ''}
  </div>`;
}

function _bindPCCardListeners(el) {
  el.addEventListener('click', (e) => {
    const cards = [...document.querySelectorAll('#pcGrid .pc-pokemon')];
    const idx   = cards.indexOf(el);

    if (e.shiftKey && _pcLastClickedIdx >= 0 && idx >= 0) {
      // Shift+Click : sélection de plage
      const lo = Math.min(_pcLastClickedIdx, idx);
      const hi = Math.max(_pcLastClickedIdx, idx);
      cards.slice(lo, hi + 1).forEach(c => { pcSelectedIds.add(c.dataset.pkId); c.classList.add('multi-selected'); });
      renderPokemonDetail();
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click : basculer la multi-sélection sans rebuild complet
      const id = el.dataset.pkId;
      if (pcSelectedIds.has(id)) {
        pcSelectedIds.delete(id);
        el.classList.remove('multi-selected');
      } else {
        pcSelectedIds.add(id);
        el.classList.add('multi-selected');
      }
      _pcLastClickedIdx = idx;
      renderPokemonDetail();
    } else {
      // Clic normal : effacer la multi-sélection, sélectionner ce Pokémon
      if (pcSelectedIds.size > 0) {
        pcSelectedIds.clear();
        document.querySelectorAll('.pc-pokemon.multi-selected').forEach(c => c.classList.remove('multi-selected'));
      }
      _pcLastClickedIdx = idx;
      pcSelectedId = el.dataset.pkId;
      renderPCTab();
    }
  });
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const pId = el.dataset.pkId;
    const pk = state.pokemons.find(p => p.id === pId);
    if (!pk) return;
    const price = calculatePrice(pk);
    const inTeam = state.gang.bossTeam.includes(pk.id) || state.agents.some(a => a.team.includes(pk.id));
    const hasCandy = (state.inventory.rarecandy || 0) > 0;
    const sameSpecies = state.pokemons.filter(p => p.species_en === pk.species_en && p.id !== pk.id && !p.shiny);
    const sameSpeciesTotal = calculatePrice(pk) * sameSpecies.length;
    const has5StarDonor = state.pokemons.some(p =>
      p.species_en === pk.species_en && p.id !== pk.id && p.potential === 5 && !p.shiny
      && !state.gang.bossTeam.includes(p.id) && !state.agents.some(a => a.team.includes(p.id))
    );
    const items = [
      { action:'sell', label:`Vendre (${price}₽)${pk.shiny ? ' ✨' : ''}`, fn: () => {
        if (pk.shiny) {
          showConfirm(`<span style="color:gold">✨ CHROMATIQUE !</span><br>Vendre <b>${speciesName(pk.species_en)}</b> pour <b>${price.toLocaleString()}₽</b> ?<br><span style="color:var(--text-dim);font-size:11px">Cette action est irréversible.</span>`,
            () => { sellPokemon([pk.id]); renderPCTab(); updateTopBar(); },
            null, { confirmLabel: 'Vendre', cancelLabel: 'Garder', danger: true });
        } else { sellPokemon([pk.id]); renderPCTab(); updateTopBar(); }
      }},
      sameSpecies.length > 0 ? { action:'sellSpecies', label:`Vendre tout (${speciesName(pk.species_en)}) ×${sameSpecies.length} — ${sameSpeciesTotal.toLocaleString()}₽`, fn: () => {
        showConfirm(`Vendre <b>${sameSpecies.length}× ${speciesName(pk.species_en)}</b> pour <b>${sameSpeciesTotal.toLocaleString()}₽</b> ?<br><span style="color:var(--text-dim);font-size:11px">Shinies exclus.</span>`,
          () => { sellPokemon(sameSpecies.map(p => p.id)); renderPCTab(); updateTopBar(); },
          null, { confirmLabel: 'Vendre tout', cancelLabel: 'Annuler', danger: true });
      }} : null,
      sameSpecies.filter(p => p.potential < 5).length > 0 ? { action:'sellSpeciesNon5', label:`Vendre ${speciesName(pk.species_en)} (sauf ★★★★★)`, fn: () => {
        const toSell = sameSpecies.filter(p => p.potential < 5);
        const total = toSell.reduce((s, p) => s + calculatePrice(p), 0);
        showConfirm(`Vendre <b>${toSell.length}× ${speciesName(pk.species_en)}</b> (hors ★★★★★) pour <b>${total.toLocaleString()}₽</b> ?`,
          () => { sellPokemon(toSell.map(p => p.id)); renderPCTab(); updateTopBar(); },
          null, { confirmLabel: 'Vendre', cancelLabel: 'Annuler', danger: true });
      }} : null,
      state.purchases.scientist && state.purchases.scientistEnabled !== false && pk.potential < 5 && has5StarDonor ? { action:'scientist', label:`🧬 Mutation (sacrifice 1× ★★★★★ ${speciesName(pk.species_en)})`, fn: () => {
        const donor = state.pokemons.find(p =>
          p.species_en === pk.species_en && p.id !== pk.id && p.potential === 5 && !p.shiny
          && !state.gang.bossTeam.includes(p.id) && !state.agents.some(a => a.team.includes(p.id))
        );
        if (!donor) { notify('Aucun donneur ★★★★★ disponible.', 'error'); return; }
        showConfirm(`Sacrifier <b>${speciesName(donor.species_en)} ★★★★★</b> pour élever <b>${speciesName(pk.species_en)}</b> de ★${pk.potential} à ★${pk.potential + 1} ?<br><span style="color:var(--red);font-size:11px">Le donneur sera détruit.</span>`,
          () => {
            state.pokemons = state.pokemons.filter(p => p.id !== donor.id);
            pk.potential = Math.min(5, pk.potential + 1);
            pk.stats = calculateStats(pk);
            saveState(); notify(`🧬 ${speciesName(pk.species_en)} est maintenant ${'★'.repeat(pk.potential)} !`, 'gold');
            renderPCTab(); updateTopBar();
          },
          null, { confirmLabel: 'Confirmer', cancelLabel: 'Annuler', danger: true });
      }} : null,
      inTeam
        ? { action:'unteam', label:'Retirer de l\'equipe', fn: () => { state.gang.bossTeam = state.gang.bossTeam.filter(id => id !== pk.id); state.agents.forEach(a => { a.team = a.team.filter(id => id !== pk.id); }); saveState(); renderPCTab(); } }
        : { action:'team', label:'Attribuer a...', fn: () => { openAssignToPicker(pk.id); } },
      { action:'candy', label:`Super Bonbon${hasCandy ? '' : ' (aucun)'}`, fn: () => { if (!hasCandy) return; state.inventory.rarecandy--; if (pk.level < 100) { pk.level++; pk.xp = 0; pk.stats = calculateStats(pk); tryAutoEvolution(pk); } saveState(); notify(`🍬 ${speciesName(pk.species_en)} → Lv.${pk.level}`, 'gold'); renderPCTab(); updateTopBar(); } },
      { action:'fav', label: pk.favorite ? 'Retirer favori' : 'Ajouter favori', fn: () => { pk.favorite = !pk.favorite; saveState(); renderPCTab(); } },
    ].filter(Boolean);
    showContextMenu(e.clientX, e.clientY, items);
  });
}

function renderPokemonGrid(forceRebuild = false) {
  const grid = document.getElementById('pokemonGrid');
  if (!grid) return;

  let list = [...state.pokemons];

  // Search filter
  const search = document.getElementById('pcSearch')?.value?.toLowerCase() || '';
  if (search) list = list.filter(p => speciesName(p.species_en).toLowerCase().includes(search) || p.species_en.includes(search));

  // Filter
  const filter = document.getElementById('pcFilter')?.value || 'all';
  if (filter === 'shiny') list = list.filter(p => p.shiny);
  else if (filter === 'fav') list = list.filter(p => p.favorite);
  else if (filter === 'team') {
    const tIds = new Set([...state.gang.bossTeam]);
    for (const a of state.agents) a.team.forEach(id => tIds.add(id));
    list = list.filter(p => tIds.has(p.id));
  }
  else if (filter.startsWith('pot')) list = list.filter(p => p.potential === parseInt(filter.replace('pot', '')));
  else if (filter === 'pension') {
    const psIds = getPensionSlotIds();
    list = list.filter(p => psIds.has(p.id));
  }
  else if (filter === 'training') list = list.filter(p => state.trainingRoom?.pokemon?.includes(p.id));

  // Sort
  const sort = document.getElementById('pcSort')?.value || 'recent';
  switch (sort) {
    case 'id':        list.sort((a, b) => a.dex - b.dex); break;
    case 'name':      list.sort((a, b) => speciesName(a.species_en).localeCompare(speciesName(b.species_en))); break;
    case 'cp':        list.sort((a, b) => getPokemonPower(b) - getPokemonPower(a)); break;
    case 'potential': list.sort((a, b) => (b.potential + (b.shiny ? 10 : 0)) - (a.potential + (a.shiny ? 10 : 0))); break;
    case 'level':     list.sort((a, b) => b.level - a.level); break;
    case 'species':   list.sort((a, b) => a.dex - b.dex || (b.potential - a.potential)); break;
    case 'price':     list.sort((a, b) => calculatePrice(b) - calculatePrice(a)); break;
    case 'recent':    break;
  }
  if (filter !== 'fav') list.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));

  const pageSize = pcGroupMode ? list.length : (pcGridCols * pcGridRows);
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  if (pcPage >= totalPages) pcPage = totalPages - 1;
  const pageList = list.slice(pcPage * pageSize, (pcPage + 1) * pageSize);

  const pagination = document.getElementById('pcPagination');
  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
  const trainingIds = new Set(state.trainingRoom.pokemon);
  const pensionIds = getPensionSlotIds();

  // Render key: rebuild on any change (list length catches sells/releases, species catches evolutions)
  const speciesHash = list.slice(pcPage * pageSize, (pcPage + 1) * pageSize).map(p => p.species_en + p.level).join(',').length;
  const renderKey = `${search}|${filter}|${sort}|${pcPage}|${totalPages}|${list.length}|${speciesHash}|${pcGroupMode}|${pcGridCols}|${pcGroupSpecies}`;
  const needsRebuild = forceRebuild || renderKey !== _pcLastRenderKey;

  if (needsRebuild) {
    _pcLastRenderKey = renderKey;

    // Apply dynamic grid columns
    grid.style.gridTemplateColumns = `repeat(${pcGridCols}, 1fr)`;

    // Pagination (hidden in group mode)
    if (pagination) {
      pagination.innerHTML = (pcGroupMode || totalPages <= 1) ? '' :
        `<button class="pc-page-btn" id="pcPrev" ${pcPage === 0 ? 'disabled' : ''}>&lt;</button>
         <span style="font-size:9px;color:var(--text-dim)">${pcPage + 1} / ${totalPages} (${list.length})</span>
         <button class="pc-page-btn" id="pcNext" ${pcPage >= totalPages - 1 ? 'disabled' : ''}>&gt;</button>`;
      pagination.querySelector('#pcPrev')?.addEventListener('click', () => { pcPage--; renderPokemonGrid(true); });
      pagination.querySelector('#pcNext')?.addEventListener('click', () => { pcPage++; renderPokemonGrid(true); });
    }

    if (pcGroupMode) {
      // ── Mode regroupement : une carte par espèce ──────────────
      const groups = {};
      for (const p of list) {
        if (!groups[p.species_en]) groups[p.species_en] = [];
        groups[p.species_en].push(p);
      }
      const sortedGroups = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
      grid.innerHTML = sortedGroups.map(([species, pks]) => {
        const maxPot = Math.max(...pks.map(p => p.potential));
        const maxLvl = Math.max(...pks.map(p => p.level));
        const hasShiny = pks.some(p => p.shiny);
        const hasFav   = pks.some(p => p.favorite);
        const isSelected = pcGroupSpecies === species;
        return `<div class="pc-group-card${isSelected ? ' selected' : ''}" data-group-species="${species}"
          style="position:relative;cursor:pointer;padding:4px 2px;border-radius:var(--radius-sm);
          border:2px solid ${isSelected ? 'var(--gold)' : 'var(--border)'};
          background:var(--bg-card);text-align:center;transition:border-color .15s;overflow:hidden">
          <img src="${pokeSprite(species, hasShiny)}" style="width:48px;height:48px;${hasShiny ? 'filter:drop-shadow(0 0 4px gold)' : ''}">
          <div style="font-size:7px;font-family:var(--font-pixel);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px">${speciesName(species)}</div>
          <div style="font-size:8px;color:var(--gold)">×${pks.length}</div>
          <div style="font-size:6px;color:var(--text-dim)">${'★'.repeat(maxPot)} Lv.${maxLvl}</div>
          ${hasFav  ? '<div style="position:absolute;top:2px;right:2px;font-size:9px;line-height:1">⭐</div>' : ''}
          ${hasShiny ? '<div style="position:absolute;top:2px;left:2px;font-size:9px;line-height:1">✨</div>' : ''}
        </div>`;
      }).join('') || '<div style="color:var(--text-dim);padding:16px;grid-column:1/-1;text-align:center">Aucun Pokémon</div>';

      grid.querySelectorAll('.pc-group-card').forEach(el => {
        el.addEventListener('click', (e) => {
          const species = el.dataset.groupSpecies;
          if (e.ctrlKey || e.metaKey) {
            // Ctrl+Click : multi-sélection de groupes
            if (_pcSelectedGroups.has(species)) {
              _pcSelectedGroups.delete(species);
              el.style.border = '2px solid var(--border)';
            } else {
              _pcSelectedGroups.add(species);
              el.style.border = '2px solid var(--gold)';
            }
            renderPokemonDetail();
          } else {
            _pcSelectedGroups.clear();
            pcGroupSpecies = species;
            _grpPotFilter = 0;
            renderPokemonGrid(true);
            renderPokemonDetailGroup(pcGroupSpecies);
          }
        });
      });

    } else {
      // ── Mode normal : une carte par Pokémon ───────────────────
      grid.innerHTML = pageList.map(p => _buildPCCard(p, teamIds, trainingIds, pensionIds)).join('')
        || '<div style="color:var(--text-dim);padding:16px;grid-column:1/-1;text-align:center">Aucun Pokémon</div>';
      grid.querySelectorAll('.pc-pokemon').forEach(el => _bindPCCardListeners(el));
    }

  } else {
    // Soft update: append new cards, sync classes — no full rebuild
    if (!pcGroupMode) {
      const existingIds = new Set([...grid.querySelectorAll('.pc-pokemon')].map(el => el.dataset.pkId));
      let added = 0;
      for (const p of pageList) {
        if (!existingIds.has(p.id)) {
          const wrap = document.createElement('div');
          wrap.innerHTML = _buildPCCard(p, teamIds, trainingIds, pensionIds);
          const card = wrap.firstElementChild;
          if (card) { grid.appendChild(card); _bindPCCardListeners(card); added++; }
        }
      }
      grid.querySelectorAll('.pc-pokemon').forEach(el => {
        el.classList.toggle('selected', el.dataset.pkId === pcSelectedId);
        el.classList.toggle('multi-selected', pcSelectedIds.has(el.dataset.pkId));
      });
      if (added > 0 && pagination) {
        const countEl = pagination.querySelector('span');
        if (countEl) countEl.textContent = `${pcPage + 1} / ${totalPages} (${list.length})`;
      }
    }
  }
}

function renderPotentialUpgradePanel(p) {
  if (p.potential >= 5) return '';
  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
  const cost = POT_UPGRADE_COSTS[p.potential - 1];
  const donors = state.pokemons.filter(d =>
    d.species_en === p.species_en && d.id !== p.id &&
    !d.shiny && d.potential <= p.potential &&
    !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id)
  );
  const canUpgrade = donors.length >= cost;
  return `<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
    <div style="font-size:9px;color:var(--text-dim);margin-bottom:6px">MUTATION DE POTENTIEL</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <div style="font-size:10px;flex:1">
        ${'*'.repeat(p.potential)} <span style="color:var(--text-dim)">→</span> ${'*'.repeat(p.potential + 1)}
        <span style="font-size:9px;color:${canUpgrade ? 'var(--green)' : 'var(--red)'}"> (${donors.length}/${cost} specimens)</span>
      </div>
    </div>
    <button id="btnPotUpgrade" style="width:100%;font-size:9px;padding:5px;background:var(--bg);border:1px solid ${canUpgrade ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);color:${canUpgrade ? 'var(--gold)' : 'var(--text-dim)'};cursor:${canUpgrade ? 'pointer' : 'default'}"${canUpgrade ? '' : ' disabled'}>
      ${canUpgrade ? 'MUTER LE POTENTIEL' : 'Pas assez de specimens'}
    </button>
  </div>`;
}

function renderEvolutionPanel(p) {
  const evos = EVO_BY_SPECIES[p.species_en];
  if (!evos || evos.length === 0) return '';

  const hasStone      = (state.inventory.evostone || 0) > 0;
  const itemEvos      = evos.filter(e => e.req === 'item');
  const levelEvos     = evos.filter(e => e.req !== 'item' && typeof e.req === 'number');
  const readyLvlEvos  = levelEvos.filter(e => p.level >= e.req);
  const multiItem     = itemEvos.length > 1;
  const multiLevel    = readyLvlEvos.length > 1;

  let html = '<div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--border)">';
  html += '<div style="font-size:10px;color:var(--text-dim);margin-bottom:6px">' + (state.lang === 'fr' ? 'Évolution' : 'Evolution') + '</div>';

  for (const evo of evos) {
    const targetSp = SPECIES_BY_EN[evo.to];
    if (!targetSp) continue;
    const targetName = state.lang === 'fr' ? targetSp.fr : evo.to;

    if (evo.req === 'item') {
      html += '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">'
        + '<img src="' + pokeSprite(evo.to) + '" style="width:32px;height:32px;opacity:' + (hasStone ? 1 : 0.4) + '">'
        + '<div style="flex:1;font-size:10px">' + targetName + '</div>';
      if (!multiItem) {
        // Single item evo → direct button
        html += '<button class="btn-evolve-item" data-evo-target="' + evo.to + '" style="font-size:9px;padding:4px 10px;background:' + (hasStone ? 'var(--gold-dim)' : 'var(--bg)') + ';border:1px solid ' + (hasStone ? 'var(--gold)' : 'var(--border)') + ';border-radius:var(--radius-sm);color:' + (hasStone ? 'var(--bg)' : 'var(--text-dim)') + ';cursor:' + (hasStone ? 'pointer' : 'default') + '"' + (hasStone ? '' : ' disabled') + '>💎 Évoluer</button>';
      }
      html += '</div>';
    } else {
      const ready = p.level >= evo.req;
      html += '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">'
        + '<img src="' + pokeSprite(evo.to) + '" style="width:32px;height:32px;opacity:' + (ready ? 1 : 0.4) + '">'
        + '<div style="flex:1;font-size:10px">' + targetName + ' (Lv.' + evo.req + ')</div>';
      if (ready && !multiLevel) {
        // Single ready level evo → direct button
        html += '<button class="btn-evolve-level" data-evo-target="' + evo.to + '" style="font-size:9px;padding:4px 10px;background:var(--green);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--bg);cursor:pointer">Évoluer!</button>';
      } else if (!ready) {
        html += '<span style="font-size:9px;color:var(--text-dim)">Lv.' + p.level + '/' + evo.req + '</span>';
      }
      // If ready && multiLevel: individual button omitted — group button below
      html += '</div>';
    }
  }

  // Multi-choice group buttons (card popup)
  if (multiLevel) {
    html += '<button class="btn-evolve-level-multi" style="margin-top:10px;width:100%;font-family:var(--font-pixel);font-size:8px;padding:6px;background:var(--green);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--bg);cursor:pointer">🎴 Choisir l\'évolution (' + readyLvlEvos.length + ' options)</button>';
  }
  if (multiItem) {
    html += '<button class="btn-evolve-item-multi"' + (hasStone ? '' : ' disabled') + ' style="margin-top:6px;width:100%;font-family:var(--font-pixel);font-size:8px;padding:6px;background:' + (hasStone ? 'var(--gold-dim)' : 'var(--bg)') + ';border:1px solid ' + (hasStone ? 'var(--gold)' : 'var(--border)') + ';border-radius:var(--radius-sm);color:' + (hasStone ? 'var(--bg)' : 'var(--text-dim)') + ';cursor:' + (hasStone ? 'pointer' : 'default') + '">🎴 Choisir l\'évolution 💎 (' + itemEvos.length + ' options)</button>';
  }

  html += '</div>';
  return html;
}

// ── Évoluer un Pokémon jusqu'au stade maximum (level + item) ──
function _evolveToMax(pk) {
  let evolved = false;
  let sanity = 10;
  while (sanity-- > 0) {
    const evos = EVO_BY_SPECIES[pk.species_en];
    if (!evos || evos.length === 0) break;
    // Try level evolution first
    const levelEvo = evos.find(e => e.req !== 'item' && typeof e.req === 'number' && pk.level >= e.req);
    if (levelEvo) { evolvePokemon(pk, levelEvo.to); evolved = true; continue; }
    // Item evolution: consume a stone
    const itemEvo = evos.find(e => e.req === 'item');
    if (itemEvo && (state.inventory.evostone || 0) > 0) {
      state.inventory.evostone--;
      evolvePokemon(pk, itemEvo.to);
      evolved = true; continue;
    }
    break;
  }
  return evolved;
}

// ── Vente groupée: évoluer plusieurs Pokémon avec gestion des pierres ──
function _bulkEvolve(evolvable, stoneNeeded, stoneHave) {
  const doEvolve = () => {
    let count = 0;
    for (const pk of evolvable) { if (_evolveToMax(pk)) count++; }
    saveState();
    _pcLastRenderKey = ''; renderPCTab();
    notify(`${count} Pokémon évolué${count > 1 ? 's' : ''} !`, 'gold');
  };

  if (stoneNeeded === 0 || stoneHave >= stoneNeeded) {
    doEvolve();
    return;
  }

  // Not enough stones — show popup
  const shortage = stoneNeeded - stoneHave;
  const stoneCost = 5000; // price per stone from shop
  const buyCost = shortage * stoneCost;
  const canAfford = state.gang.money >= buyCost;

  showConfirm(
    `<b>Évoluer nécessite ${stoneNeeded} Pierre${stoneNeeded > 1 ? 's' : ''} Évolution</b><br>
     Vous en avez : <span style="color:var(--gold)">${stoneHave}</span> — il en manque <span style="color:var(--red)">${shortage}</span><br>
     ${canAfford
       ? `Acheter ${shortage} pierre${shortage > 1 ? 's' : ''} pour <span style="color:var(--gold)">${buyCost.toLocaleString()}₽</span> et évoluer ?`
       : `<span style="color:var(--text-dim)">Fonds insuffisants pour acheter ${shortage} pierre${shortage > 1 ? 's' : ''} (${buyCost.toLocaleString()}₽)</span>`}`,
    () => {
      if (canAfford) {
        state.gang.money -= buyCost;
        state.inventory.evostone = (state.inventory.evostone || 0) + shortage;
        updateTopBar();
      }
      doEvolve();
    },
    null,
    {
      confirmLabel: canAfford ? `Acheter (${buyCost.toLocaleString()}₽) + Évoluer` : 'Évoluer avec stock actuel',
      cancelLabel: 'Annuler',
      danger: !canAfford,
    }
  );
}

function renderPokemonDetail() {
  const panel = document.getElementById('pokemonDetail');
  if (!panel) return;

  // ── Mode groupe — multi-sélection de groupes (Ctrl+Clic) ─────
  if (pcGroupMode && _pcSelectedGroups.size > 0) {
    panel.classList.remove('hidden');
    const tIds = new Set([...state.gang.bossTeam]);
    for (const a of state.agents) a.team.forEach(id => tIds.add(id));
    const allPks = [..._pcSelectedGroups].flatMap(sp =>
      state.pokemons.filter(p => p.species_en === sp)
    );
    const sellable = allPks.filter(pk => !pk.shiny && !pk.favorite && !tIds.has(pk.id));
    const totalValue = sellable.reduce((s, pk) => s + calculatePrice(pk), 0);
    const shinyCount = allPks.filter(p => p.shiny).length;

    panel.innerHTML = `
      <div style="padding:10px;font-family:var(--font-pixel)">
        <div style="font-size:11px;color:var(--gold);margin-bottom:4px">${_pcSelectedGroups.size} espèces sélectionnées</div>
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:8px">Ctrl+Clic pour ajouter/retirer des espèces</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px;justify-content:center;margin-bottom:10px">
          ${[..._pcSelectedGroups].slice(0, 10).map(sp => `<img src="${pokeSprite(sp, false)}" style="width:32px;height:32px">`).join('')}
          ${_pcSelectedGroups.size > 10 ? `<div style="font-size:9px;color:var(--text-dim);align-self:center">+${_pcSelectedGroups.size - 10}</div>` : ''}
        </div>
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:8px">
          ${allPks.length} Pokémon au total — ${sellable.length} vendables
          ${shinyCount > 0 ? `<br><span style="color:var(--gold)">✨×${shinyCount} exclu${shinyCount > 1 ? 's' : ''}</span>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:5px">
          ${sellable.length > 0 ? `
          <button id="btnSellGroupMulti" style="width:100%;font-size:9px;padding:6px;background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer">
            Vendre ${sellable.length} Pokémon (${totalValue.toLocaleString()}₽)
          </button>` : ''}
          <button id="btnClearGroupMulti" style="width:100%;font-size:9px;padding:5px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
            Annuler la sélection
          </button>
        </div>
      </div>`;

    document.getElementById('btnSellGroupMulti')?.addEventListener('click', () => {
      const ids = sellable.map(pk => pk.id);
      showConfirm(`Vendre <b>${ids.length}</b> Pokémon (${[..._pcSelectedGroups].map(sp => speciesName(sp)).join(', ')}) pour <b style="color:var(--gold)">${totalValue.toLocaleString()}₽</b> ?`, () => {
        sellPokemon(ids);
        _pcSelectedGroups.clear();
        _pcLastRenderKey = '';
        updateTopBar(); renderPCTab();
      }, null, { confirmLabel: 'Vendre', cancelLabel: 'Annuler', danger: true });
    });
    document.getElementById('btnClearGroupMulti')?.addEventListener('click', () => {
      _pcSelectedGroups.clear();
      renderPokemonGrid(true); renderPokemonDetail();
    });
    return;
  }

  // ── Mode groupe — espèce unique sélectionnée ──────────────────
  if (pcGroupMode && pcGroupSpecies) {
    renderPokemonDetailGroup(pcGroupSpecies);
    return;
  }

  // ── Multi-sélection ───────────────────────────────────────────
  if (pcSelectedIds.size > 1) {
    panel.classList.remove('hidden');
    const pks = [...pcSelectedIds].map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
    const tIds = new Set([...state.gang.bossTeam]);
    for (const a of state.agents) a.team.forEach(id => tIds.add(id));
    // Shinies excluded from group sell by default — must sell from individual sheet
    const sellable = pks.filter(pk => !pk.favorite && !pk.shiny && !tIds.has(pk.id));
    const totalValue = sellable.reduce((s, pk) => s + calculatePrice(pk), 0);
    const shinyCount = pks.filter(pk => pk.shiny).length;
    const favCount   = pks.filter(pk => pk.favorite).length;
    const allFav     = pks.every(pk => pk.favorite);

    // Evolvable Pokémon analysis
    const evolvable = pks.filter(pk => {
      const evos = EVO_BY_SPECIES[pk.species_en];
      return evos && evos.length > 0;
    });
    const itemEvolvable = evolvable.filter(pk =>
      (EVO_BY_SPECIES[pk.species_en] || []).some(e => e.req === 'item')
    );
    const stoneNeeded = itemEvolvable.length;
    const stoneHave   = state.inventory.evostone || 0;

    panel.innerHTML = `
      <div style="padding:10px;font-family:var(--font-pixel)">
        <div style="font-size:11px;color:var(--gold);margin-bottom:4px">${pks.length} sélectionnés</div>
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:8px">Ctrl+Clic pour ajouter/retirer</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px;justify-content:center;margin-bottom:10px">
          ${pks.slice(0, 15).map(pk => `<img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:28px;height:28px;${pk.shiny ? 'filter:drop-shadow(0 0 3px gold)' : ''}">`).join('')}
          ${pks.length > 15 ? `<div style="font-size:9px;color:var(--text-dim);align-self:center">+${pks.length - 15}</div>` : ''}
        </div>

        <div style="display:flex;flex-direction:column;gap:5px">

          <!-- Favoris -->
          <button id="btnMultiFav" style="width:100%;font-size:9px;padding:6px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">
            ${allFav ? '☆ Retirer favori (tous)' : `⭐ Marquer favori (${pks.length - favCount} sans fav)`}
          </button>

          <!-- Évoluer -->
          ${evolvable.length > 0 ? `
          <button id="btnMultiEvolve" style="width:100%;font-size:9px;padding:6px;background:var(--bg);border:1px solid var(--green,#4caf50);border-radius:var(--radius-sm);color:var(--green,#4caf50);cursor:pointer">
            ✦ Évoluer (${evolvable.length}) ${stoneNeeded > 0 ? `— 💎×${stoneNeeded}` : ''}
          </button>` : ''}

          <!-- Vente groupée -->
          ${sellable.length > 0 ? `
          <div style="font-size:8px;color:var(--text-dim);margin-top:4px">
            ${sellable.length} vendables — <span style="color:var(--gold)">${totalValue.toLocaleString()}₽</span>
            ${shinyCount > 0 ? `<br><span style="color:var(--gold)">✨×${shinyCount} exclu${shinyCount > 1 ? 's' : ''}</span>` : ''}
          </div>
          <button id="btnSellMulti" style="width:100%;font-size:9px;padding:6px;background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer">
            Vendre ${sellable.length} Pokémon (${totalValue.toLocaleString()}₽)
          </button>` : (shinyCount > 0 ? `<div style="font-size:8px;color:var(--text-dim);margin-top:4px">✨ Chromatiques non vendables ici</div>` : '')}

          <!-- Annuler -->
          <button id="btnClearMulti" style="width:100%;font-size:9px;padding:5px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
            Annuler la sélection
          </button>
        </div>
      </div>`;

    // Favourite toggle
    document.getElementById('btnMultiFav')?.addEventListener('click', () => {
      const newFav = !allFav;
      pks.forEach(pk => { pk.favorite = newFav; });
      saveState();
      _pcLastRenderKey = ''; renderPCTab();
    });

    // Bulk evolve
    document.getElementById('btnMultiEvolve')?.addEventListener('click', () => {
      _bulkEvolve(evolvable, stoneNeeded, stoneHave);
    });

    // Sell
    document.getElementById('btnSellMulti')?.addEventListener('click', () => {
      const ids = sellable.map(pk => pk.id);
      showConfirm(`Vendre <b>${ids.length}</b> Pokémon pour <b style="color:var(--gold)">${totalValue.toLocaleString()}₽</b> ?`, () => {
        sellPokemon(ids);
        pcSelectedIds.clear();
        _pcLastRenderKey = '';
        updateTopBar(); renderPCTab();
      }, null, { confirmLabel: 'Vendre', cancelLabel: 'Annuler', danger: true });
    });

    document.getElementById('btnClearMulti')?.addEventListener('click', () => {
      pcSelectedIds.clear();
      document.querySelectorAll('.pc-pokemon.multi-selected').forEach(c => c.classList.remove('multi-selected'));
      renderPokemonDetail();
    });
    return;
  }

  if (!pcSelectedId) {
    panel.classList.add('hidden');
    return;
  }

  const p = state.pokemons.find(pk => pk.id === pcSelectedId);
  if (!p) {
    panel.classList.add('hidden');
    pcSelectedId = null;
    return;
  }

  panel.classList.remove('hidden');
  const sp = SPECIES_BY_EN[p.species_en];
  const nat = NATURES[p.nature];
  const natName = nat ? (state.lang === 'fr' ? nat.fr : nat.en) : p.nature;
  const zoneDef = ZONE_BY_ID[p.capturedIn];
  const zoneName = zoneDef ? (state.lang === 'fr' ? zoneDef.fr : zoneDef.en) : p.capturedIn;
  const power = getPokemonPower(p);
  const price = calculatePrice(p);

  panel.innerHTML = `
    <div style="text-align:center;margin-bottom:12px">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:96px;height:96px;${p.shiny ? 'filter:drop-shadow(0 0 6px var(--gold))' : ''}">
      <div style="font-family:var(--font-pixel);font-size:12px;margin-top:4px">${speciesName(p.species_en)}${p.shiny ? ' ✨' : ''}</div>
      <div style="font-size:10px;color:var(--text-dim)">#${String(p.dex).padStart(3, '0')} — ${sp?.types.map(typeFr).join('/') || '?'}</div>
      ${p.homesick ? '<div style="display:inline-block;margin-top:4px;padding:2px 8px;background:#1a100a;border:1px solid #8b4513;border-radius:3px;font-size:9px;color:#cd853f">🏠 Mal du pays (-25%)</div>' : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;margin-bottom:12px">
      <div>${t('level')}: <b>${p.level}</b></div>
      <div>${t('nature')}: <b>${natName}</b></div>
      <div>${t('potential')}: <b style="color:var(--gold)">${'★'.repeat(p.potential)}</b></div>
      <div>PC: <b>${power}</b></div>
    </div>
    <div style="font-size:11px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="color:var(--text-dim)">${t('moves')}:</span>
        <button id="btnChangeMoves" style="font-size:8px;padding:2px 7px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer" title="Changer les attaques (10 000₽)">🔄 10k₽</button>
      </div>
      ${p.moves.map(m => `<div style="padding:2px 0">▸ ${m}</div>`).join('')}
    </div>
    <div style="font-size:11px;margin-bottom:8px">
      ${(() => {
        const ref = { species_en: p.species_en, potential: 5, nature: 'hardy', level: p.level };
        ref.stats = calculateStats(ref);
        const pct = v => Math.min(100, Math.round(v / ref.stats[Object.keys(ref.stats)[0]] * 100));
        const bar = (val, max, color) => `<div style="flex:1;background:var(--border);border-radius:2px;height:5px"><div style="background:${color};width:${Math.min(100,Math.round(val/max*100))}%;height:5px;border-radius:2px"></div></div>`;
        return `<div style="display:flex;flex-direction:column;gap:3px">
          <div style="display:flex;align-items:center;gap:6px"><span style="font-size:9px;width:30px">ATK</span>${bar(p.stats.atk, ref.stats.atk,'#e57373')}<span style="font-size:9px;color:var(--text-dim)">${p.stats.atk}<span style="color:var(--border-light)">/${ref.stats.atk}</span></span></div>
          <div style="display:flex;align-items:center;gap:6px"><span style="font-size:9px;width:30px">DEF</span>${bar(p.stats.def, ref.stats.def,'#64b5f6')}<span style="font-size:9px;color:var(--text-dim)">${p.stats.def}<span style="color:var(--border-light)">/${ref.stats.def}</span></span></div>
          <div style="display:flex;align-items:center;gap:6px"><span style="font-size:9px;width:30px">SPD</span>${bar(p.stats.spd, ref.stats.spd,'#81c784')}<span style="font-size:9px;color:var(--text-dim)">${p.stats.spd}<span style="color:var(--border-light)">/${ref.stats.spd}</span></span></div>
          <div style="font-size:7px;color:var(--text-dim);margin-top:1px">/ ref ★★★★★ Hardy Lv.${p.level}</div>
        </div>`;
      })()}
    </div>
    <div style="font-size:10px;color:var(--text-dim);margin-bottom:8px">${t('zone_caught')}: ${zoneName}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <div style="font-size:10px;color:var(--gold);flex:1">Valeur: ${price}₽${getMarketSaturation(p.species_en) > 0 ? ` <span style="color:var(--red);font-size:9px">▼${getMarketSaturation(p.species_en)}% offre</span>` : ''}</div>
      <button id="btnFavToggle" style="font-size:10px;padding:4px 10px;background:${p.favorite ? 'var(--gold-dim)' : 'var(--bg)'};border:1px solid ${p.favorite ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);color:${p.favorite ? 'var(--bg)' : 'var(--text-dim)'};cursor:pointer">${p.favorite ? '⭐ Favori' : '☆ Favori'}</button>
    </div>
    ${(() => {
      const hasCandy = (state.inventory.rarecandy || 0) > 0;
      return `<div style="margin-bottom:8px"><button id="btnRareCandy" style="width:100%;font-size:10px;padding:5px;background:${hasCandy ? 'var(--bg)' : 'var(--bg)'};border:1px solid ${hasCandy ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);color:${hasCandy ? 'var(--gold)' : 'var(--text-dim)'};cursor:${hasCandy ? 'pointer' : 'default'}"${hasCandy ? '' : ' disabled'}>🍬 Super Bonbon (+1 niveau) — stock: ${state.inventory.rarecandy || 0}</button></div>`;
    })()}
    ${(() => {
      // Check if in a team
      const inBossTeam = state.gang.bossTeam.includes(p.id);
      const inAgentTeam = state.agents.find(a => a.team.includes(p.id));
      const teamLabel = inBossTeam ? (state.lang === 'fr' ? 'Équipe Boss' : 'Boss Team')
        : inAgentTeam ? (state.lang === 'fr' ? 'Équipe ' + inAgentTeam.name : inAgentTeam.name + ' Team')
        : null;
      if (teamLabel) {
        return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer" id="btnRemoveFromTeam">🔓 ' + (state.lang === 'fr' ? 'Retirer de ' : 'Remove from ') + teamLabel + '</button></div>';
      }
      return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--green);cursor:pointer" id="btnAssignTo">📋 ' + (state.lang === 'fr' ? 'Attribuer à...' : 'Assign to...') + '</button></div>';
    })()}
    ${(() => {
      const pensionSlots = state.pension?.slots || [];
      const maxPensionSlots = 2 + (state.pension?.extraSlotsPurchased || 0);
      const inPension = pensionSlots.includes(p.id);
      const inTraining = state.trainingRoom?.pokemon?.includes(p.id);
      const inTeam = state.gang.bossTeam.includes(p.id) || state.agents.some(a => a.team.includes(p.id));
      if (inTeam) return '';
      const pensionFull = pensionSlots.length >= maxPensionSlots;
      const trainingFull = (state.trainingRoom?.pokemon?.length || 0) >= 6 + (state.trainingRoom?.extraSlots || 0);
      let btns = '';
      if (!inPension && !inTraining) {
        btns += `<button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:${pensionFull ? 'var(--text-dim)' : 'var(--text)'};cursor:${pensionFull ? 'default' : 'pointer'}" id="btnSendPension"${pensionFull ? ' disabled' : ''}>Pension ${pensionFull ? '(pleine)' : ''}</button>`;
        btns += `<button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:${trainingFull ? 'var(--text-dim)' : 'var(--text)'};cursor:${trainingFull ? 'default' : 'pointer'}" id="btnSendTraining"${trainingFull ? ' disabled' : ''}>Formation ${trainingFull ? '(pleine)' : ''}</button>`;
      } else if (inPension) {
        btns += `<button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer" id="btnRemovePension">Retirer pension</button>`;
      } else if (inTraining) {
        btns += `<button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer" id="btnRemoveTraining">Retirer formation</button>`;
      }
      return btns ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${btns}</div>` : '';
    })()}
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button style="flex:1;font-size:10px;padding:6px;background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer" id="btnSellOne">${t('sell')} (${price}₽)</button>
      <button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer" id="btnRelease">${t('release')}</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
      <button id="btnRename" style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">✏ Renommer</button>
    </div>
    <div style="margin-top:8px">
      <button id="btnFilterSpecies" style="width:100%;font-size:9px;padding:5px;background:var(--bg);border:1px solid var(--blue);border-radius:var(--radius-sm);color:var(--blue);cursor:pointer;font-family:var(--font-pixel)">
        🔍 Voir tous les ${speciesName(p.species_en)} (×${state.pokemons.filter(x => x.species_en === p.species_en).length})
      </button>
    </div>
    ${renderEvolutionPanel(p)}
    ${renderPotentialUpgradePanel(p)}
    ${renderPokemonHistory(p)}
  `;

  document.getElementById('btnFavToggle')?.addEventListener('click', () => {
    p.favorite = !p.favorite;
    saveState();
    renderPCTab();
  });

  document.getElementById('btnChangeMoves')?.addEventListener('click', () => {
    const cost = 10000;
    if (state.gang.money < cost) { notify('Fonds insuffisants (10 000₽).', 'error'); return; }
    const sp2 = SPECIES_BY_EN[p.species_en];
    if (!sp2 || !sp2.moves?.length) { notify('Aucune attaque disponible pour cette espèce.', 'error'); return; }
    showConfirm(`Changer les attaques de <b>${speciesName(p.species_en)}</b> pour <b>10 000₽</b> ?<br><span style="color:var(--text-dim);font-size:10px">Les nouvelles attaques seront tirées aléatoirement dans le pool de l'espèce.</span>`,
      () => {
        state.gang.money -= cost;
        state.stats.totalMoneySpent = (state.stats.totalMoneySpent || 0) + cost;
        p.moves = rollMoves(p.species_en);
        saveState();
        notify(`Attaques changées → ${p.moves.join(', ')}`, 'gold');
        renderPCTab();
        updateTopBar();
      },
      null, { confirmLabel: 'Changer', cancelLabel: 'Annuler' }
    );
  });

  document.getElementById('btnRareCandy')?.addEventListener('click', () => {
    if ((state.inventory.rarecandy || 0) <= 0) return;
    state.inventory.rarecandy--;
    if (p.level < 100) { p.level++; p.xp = 0; p.stats = calculateStats(p); tryAutoEvolution(p); }
    saveState();
    notify(`🍬 ${speciesName(p.species_en)} → Lv.${p.level}`, 'gold');
    renderPCTab();
    updateTopBar();
  });

  document.getElementById('btnSellOne')?.addEventListener('click', () => {
    sellPokemon([p.id]);
    pcSelectedId = null;
    updateTopBar();
    renderPCTab();
  });
  document.getElementById('btnRelease')?.addEventListener('click', () => {
    // Unassign from agent
    for (const agent of state.agents) {
      agent.team = agent.team.filter(id => id !== p.id);
    }
    state.gang.bossTeam = state.gang.bossTeam.filter(id => id !== p.id);
    state.pokemons = state.pokemons.filter(pk => pk.id !== p.id);
    pcSelectedId = null;
    saveState();
    renderPCTab();
  });
  document.getElementById('btnAssignTo')?.addEventListener('click', () => {
    openAssignToPicker(p.id);
  });
  document.getElementById('btnRemoveFromTeam')?.addEventListener('click', () => {
    // Remove from all teams
    state.gang.bossTeam = state.gang.bossTeam.filter(id => id !== p.id);
    for (const agent of state.agents) {
      agent.team = agent.team.filter(id => id !== p.id);
    }
    saveState();
    renderPCTab();
    notify(state.lang === 'fr' ? 'Retiré de l\'équipe' : 'Removed from team', 'success');
  });

  document.getElementById('btnSendPension')?.addEventListener('click', () => {
    removePokemonFromAllAssignments(p.id);
    const maxSlots = 2 + (state.pension?.extraSlotsPurchased || 0);
    if ((state.pension.slots || []).length >= maxSlots) { notify('Pension pleine'); return; }
    if (!state.pension.slots.includes(p.id)) state.pension.slots.push(p.id);
    saveState();
    notify(`${speciesName(p.species_en)} → Pension`, 'success');
    renderPCTab();
  });
  document.getElementById('btnSendTraining')?.addEventListener('click', () => {
    removePokemonFromAllAssignments(p.id);
    if (!state.trainingRoom.pokemon) state.trainingRoom.pokemon = [];
    if (state.trainingRoom.pokemon.length >= 6 + (state.trainingRoom.extraSlots || 0)) { notify(`Salle pleine (max ${6 + (state.trainingRoom.extraSlots || 0)})`); return; }
    if (!state.trainingRoom.pokemon.includes(p.id)) state.trainingRoom.pokemon.push(p.id);
    saveState();
    notify(`${speciesName(p.species_en)} → Formation`, 'success');
    renderPCTab();
  });
  document.getElementById('btnRemovePension')?.addEventListener('click', () => {
    state.pension.slots = (state.pension.slots || []).filter(id => id !== p.id);
    saveState();
    notify(`${speciesName(p.species_en)} retiré de la pension`, 'success');
    renderPCTab();
  });
  document.getElementById('btnRemoveTraining')?.addEventListener('click', () => {
    state.trainingRoom.pokemon = state.trainingRoom.pokemon.filter(id => id !== p.id);
    saveState();
    notify(`${speciesName(p.species_en)} retiré de la formation`, 'success');
    renderPCTab();
  });

  document.getElementById('btnFilterSpecies')?.addEventListener('click', () => {
    filterPCBySpecies(p.species_en);
  });

  document.getElementById('btnRename')?.addEventListener('click', () => {
    openRenameModal(p.id);
  });

  // Potential upgrade button
  document.getElementById('btnPotUpgrade')?.addEventListener('click', () => {
    if (p.potential >= 5) return;
    const teamIds = new Set([...state.gang.bossTeam]);
    for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
    const cost = POT_UPGRADE_COSTS[p.potential - 1];
    const donors = state.pokemons.filter(d =>
      d.species_en === p.species_en && d.id !== p.id && !d.shiny &&
      !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id)
    );
    if (donors.length < cost) return;
    donors.slice(0, cost).forEach(d => {
      state.pokemons = state.pokemons.filter(pk => pk.id !== d.id);
    });
    p.potential++;
    p.stats = calculateStats(p);
    saveState();
    notify(`${speciesName(p.species_en)} est maintenant ${'*'.repeat(p.potential)} !`, 'gold');
    renderPCTab();
    updateTopBar();
  });

  // Evolution buttons
  // Single level evo
  panel.querySelectorAll('.btn-evolve-level').forEach(btn => {
    btn.addEventListener('click', () => {
      evolvePokemon(p, btn.dataset.evoTarget);
      _pcLastRenderKey = ''; renderPCTab();
    });
  });
  // Multi level evo → card popup
  panel.querySelector('.btn-evolve-level-multi')?.addEventListener('click', () => {
    const readyEvos = (EVO_BY_SPECIES[p.species_en] || []).filter(e => e.req !== 'item' && typeof e.req === 'number' && p.level >= e.req);
    if (!readyEvos.length) return;
    showEvolutionChoicePopup(p, readyEvos, targetEN => {
      evolvePokemon(p, targetEN);
      _pcLastRenderKey = ''; renderPCTab();
    });
  });
  // Single item evo
  panel.querySelectorAll('.btn-evolve-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if ((state.inventory.evostone || 0) <= 0) return;
      state.inventory.evostone--;
      evolvePokemon(p, btn.dataset.evoTarget);
      _pcLastRenderKey = ''; renderPCTab();
    });
  });
  // Multi item evo → card popup
  panel.querySelector('.btn-evolve-item-multi')?.addEventListener('click', () => {
    if ((state.inventory.evostone || 0) <= 0) return;
    const itemEvos = (EVO_BY_SPECIES[p.species_en] || []).filter(e => e.req === 'item');
    if (!itemEvos.length) return;
    showEvolutionChoicePopup(p, itemEvos, targetEN => {
      state.inventory.evostone--;
      evolvePokemon(p, targetEN);
      _pcLastRenderKey = ''; renderPCTab();
    });
  });
}

// ── Multi-evolution choice popup (face-down cards, random order) ──
// evos: array of { to, req } — the valid evolutions to choose from
// onChoose(targetEN): called after card flip animation with the chosen species_en
function showEvolutionChoicePopup(pokemon, evos, onChoose) {
  // Auto mode: skip popup, pick randomly
  if (state.settings?.autoEvoChoice) {
    onChoose(evos[Math.floor(Math.random() * evos.length)].to);
    return;
  }

  const shuffled = [...evos].sort(() => Math.random() - 0.5);
  const pkName = speciesName(pokemon.species_en);

  const overlay = document.createElement('div');
  overlay.className = 'evo-choice-overlay';
  overlay.innerHTML = `
    <div class="evo-choice-box">
      <div class="evo-choice-title">ÉVOLUTION — ${pkName.toUpperCase()}</div>
      <div class="evo-choice-sub">${shuffled.length} possibilités • Choisissez une carte</div>
      <div class="evo-choice-cards">
        ${shuffled.map((evo, i) => `
          <div class="evo-card-wrap" data-evo-idx="${i}">
            <div class="evo-card-inner">
              <div class="evo-card-face evo-card-back-face">🎴</div>
              <div class="evo-card-face evo-card-front-face">
                <img src="${pokeSprite(evo.to)}">
                <span>${speciesName(evo.to)}</span>
              </div>
            </div>
          </div>`).join('')}
      </div>
      <div class="evo-choice-hint">Cliquez une carte pour révéler • Échap pour annuler</div>
    </div>`;
  document.body.appendChild(overlay);

  let chosen = false;
  overlay.querySelectorAll('.evo-card-wrap').forEach((card, i) => {
    card.addEventListener('click', () => {
      if (chosen) return;
      chosen = true;
      overlay.querySelectorAll('.evo-card-wrap').forEach(c => c.classList.add('selected'));
      card.classList.add('flipped');
      setTimeout(() => { overlay.remove(); onChoose(shuffled[i].to); }, 650);
    });
  });
  overlay.addEventListener('click', e => { if (e.target === overlay && !chosen) overlay.remove(); });
  const escFn = e => { if (e.key === 'Escape' && !chosen) { overlay.remove(); document.removeEventListener('keydown', escFn); } };
  document.addEventListener('keydown', escFn);
}

function openRenameModal(pokemonId) {
  const p = state.pokemons.find(pk => pk.id === pokemonId);
  if (!p) return;
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:320px;width:90%;display:flex;flex-direction:column;gap:12px">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">RENOMMER</div>
      <div style="display:flex;align-items:center;gap:10px">
        <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:48px;height:48px;image-rendering:pixelated">
        <div>
          <div style="font-size:11px">${speciesName(p.species_en)}</div>
          <div style="font-size:9px;color:var(--text-dim)">Nom actuel : ${p.nick || speciesName(p.species_en)}</div>
        </div>
      </div>
      <input id="renameInput" type="text" maxlength="16" placeholder="${p.nick || speciesName(p.species_en)}" value="${p.nick || ''}"
        style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:8px 10px;font-size:12px;outline:none;width:100%;box-sizing:border-box">
      <div style="display:flex;gap:8px">
        <button id="renameClear" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Effacer surnom</button>
        <button id="renameConfirm" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Confirmer</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#renameInput').focus();
  modal.querySelector('#renameConfirm').addEventListener('click', () => {
    const val = modal.querySelector('#renameInput').value.trim();
    p.nick = val || null;
    saveState();
    notify(val ? `${speciesName(p.species_en)} renommé "${val}"` : 'Surnom effacé', 'success');
    modal.remove();
    _pcLastRenderKey = '';
    renderPokemonGrid(true);
  });
  modal.querySelector('#renameClear').addEventListener('click', () => {
    p.nick = null;
    saveState();
    notify('Surnom effacé', 'success');
    modal.remove();
    _pcLastRenderKey = '';
    renderPokemonGrid(true);
  });
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#renameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') modal.querySelector('#renameConfirm').click();
    if (e.key === 'Escape') modal.remove();
  });
}

// ── Vue détail en mode "Grouper" ─────────────────────────────
let _grpPotFilter = 0; // 0 = tous, 1-5 = filtre par potentiel

function renderPokemonDetailGroup(species) {
  const panel = document.getElementById('pokemonDetail');
  if (!panel) return;
  const allPks = state.pokemons.filter(p => p.species_en === species);
  if (!allPks.length) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  const sp = SPECIES_BY_EN[species];
  const tIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => tIds.add(id));

  // Potential filter
  const pks = _grpPotFilter ? allPks.filter(p => p.potential === _grpPotFilter) : allPks;
  // Shinies excluded from group sell — must go through individual sheet
  const sellable = pks.filter(p => !p.favorite && !p.shiny && !tIds.has(p.id));
  const totalValue = sellable.reduce((s, p) => s + calculatePrice(p), 0);
  const shinyCount = allPks.filter(p => p.shiny).length;
  const maxPot = Math.max(...allPks.map(p => p.potential));
  const maxLvl = Math.max(...allPks.map(p => p.level));
  const allFav  = pks.length > 0 && pks.every(p => p.favorite);
  const potsPresent = [...new Set(allPks.map(p => p.potential))].sort();

  panel.innerHTML = `
    <div style="text-align:center;margin-bottom:8px">
      <img src="${pokeSprite(species)}" style="width:64px;height:64px">
      <div style="font-family:var(--font-pixel);font-size:11px;margin-top:4px">${speciesName(species)}</div>
      <div style="font-size:9px;color:var(--text-dim)">#${String(sp?.dex||0).padStart(3,'0')} — ${(sp?.types||[]).join('/')}</div>
      <div style="font-size:9px;margin-top:2px">×${allPks.length} · Max Lv.${maxLvl} · ${'★'.repeat(maxPot)}</div>
    </div>

    <!-- Filtre potentiel -->
    ${potsPresent.length > 1 ? `
    <div style="display:flex;gap:3px;justify-content:center;margin-bottom:8px">
      <button class="grp-pot-btn${_grpPotFilter === 0 ? ' grp-pot-active' : ''}" data-pot="0"
        style="font-size:8px;padding:2px 6px;background:var(--bg);border:1px solid ${_grpPotFilter===0?'var(--gold)':'var(--border)'};border-radius:2px;color:${_grpPotFilter===0?'var(--gold)':'var(--text-dim)'};cursor:pointer">Tous</button>
      ${potsPresent.map(pot => `
        <button class="grp-pot-btn${_grpPotFilter === pot ? ' grp-pot-active' : ''}" data-pot="${pot}"
          style="font-size:8px;padding:2px 6px;background:var(--bg);border:1px solid ${_grpPotFilter===pot?'var(--gold)':'var(--border)'};border-radius:2px;color:${_grpPotFilter===pot?'var(--gold)':'var(--text-dim)'};cursor:pointer">
          ${'★'.repeat(pot)}</button>`).join('')}
    </div>` : ''}

    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px">
      <!-- Favoris groupés -->
      <button id="btnGroupFav" style="width:100%;font-family:var(--font-pixel);font-size:8px;padding:5px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">
        ${allFav ? `☆ Retirer favori (${pks.length})` : `⭐ Marquer favori (${pks.length - pks.filter(p=>p.favorite).length})`}
      </button>

      <!-- Vente groupée (shinies exclus) -->
      ${sellable.length > 0 ? `
      <div style="font-size:8px;color:var(--text-dim);text-align:center">${sellable.length} vendables — <span style="color:var(--gold)">${totalValue.toLocaleString()}₽</span>${shinyCount > 0 ? ` <span style="color:var(--gold)">· ✨×${shinyCount} exclu</span>` : ''}</div>
      <button id="btnGroupSellAll" style="width:100%;font-family:var(--font-pixel);font-size:8px;padding:5px;background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer">
        Vendre ${sellable.length} (${totalValue.toLocaleString()}₽)
      </button>` : (shinyCount > 0 ? `<div style="font-size:8px;color:var(--text-dim);text-align:center">✨ Chromatiques non vendables ici</div>` : '')}
    </div>

    <div style="display:flex;flex-direction:column;gap:3px;max-height:280px;overflow-y:auto">
      ${pks.sort((a,b) => b.potential - a.potential || b.level - a.level).map(p => {
        const inTeam = tIds.has(p.id);
        return `<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid ${p.shiny ? 'var(--gold-dim)' : inTeam ? 'rgba(76,175,80,.4)' : 'var(--border)'};border-radius:3px;background:var(--bg);font-size:9px">
          <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:24px;height:24px">
          <span style="flex:1">${p.shiny ? '✨ ' : ''}Lv.${p.level} ${'★'.repeat(p.potential)}</span>
          <span style="color:var(--text-dim);font-size:8px">${inTeam ? '👥' : p.favorite ? '⭐' : ''}</span>
          <button class="grp-detail-btn" data-pk-id="${p.id}" style="font-size:7px;padding:1px 5px;background:var(--bg);border:1px solid var(--border);border-radius:2px;color:var(--text-dim);cursor:pointer">→</button>
        </div>`;
      }).join('')}
    </div>`;

  // Potential filter buttons
  panel.querySelectorAll('.grp-pot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _grpPotFilter = parseInt(btn.dataset.pot);
      renderPokemonDetailGroup(species);
    });
  });

  // Favourite group toggle
  document.getElementById('btnGroupFav')?.addEventListener('click', () => {
    const newFav = !allFav;
    pks.forEach(p => { p.favorite = newFav; });
    saveState(); _pcLastRenderKey = ''; renderPCTab();
  });

  document.getElementById('btnGroupSellAll')?.addEventListener('click', () => {
    const ids = sellable.map(p => p.id);
    showConfirm(`Vendre <b>${ids.length}</b> ${speciesName(species)} pour <b style="color:var(--gold)">${totalValue.toLocaleString()}₽</b> ?`, () => {
      sellPokemon(ids); pcGroupSpecies = null; _grpPotFilter = 0;
      _pcLastRenderKey = ''; updateTopBar(); renderPCTab();
    }, null, { confirmLabel: 'Vendre', cancelLabel: 'Annuler', danger: true });
  });

  panel.querySelectorAll('.grp-detail-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pcGroupMode = false; pcGroupSpecies = null; _grpPotFilter = 0;
      const chk = document.getElementById('pcGroupChk');
      if (chk) chk.checked = false;
      pcSelectedId = btn.dataset.pkId;
      _pcLastRenderKey = ''; renderPCTab();
    });
  });
}

// ── Pokemon History ──────────────────────────────────────────
function renderPokemonHistory(pokemon) {
  if (!pokemon.history || pokemon.history.length === 0) return '';
  const entries = pokemon.history.slice(-10).reverse().map(h => {
    const date = new Date(h.ts);
    const timeStr = date.toLocaleTimeString(state.lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    switch (h.type) {
      case 'captured': {
        const zDef = ZONE_BY_ID[h.zone];
        const zName = zDef ? (state.lang === 'fr' ? zDef.fr : zDef.en) : h.zone;
        const ballName = BALLS[h.ball] ? (state.lang === 'fr' ? BALLS[h.ball].fr : BALLS[h.ball].en) : h.ball;
        return `<div class="history-entry">${timeStr} — ${state.lang === 'fr' ? 'Capturé' : 'Captured'} (${ballName}) @ ${zName}</div>`;
      }
      case 'combat':
        return `<div class="history-entry">${timeStr} — ${h.won ? (state.lang === 'fr' ? 'Combat gagné' : 'Won battle') : (state.lang === 'fr' ? 'Combat perdu' : 'Lost battle')}</div>`;
      case 'levelup':
        return `<div class="history-entry">${timeStr} — ${state.lang === 'fr' ? 'Niveau' : 'Level'} ${h.level}</div>`;
      case 'evolved':
        return `<div class="history-entry" style="color:var(--gold)">${timeStr} — ${h.from} → ${h.to} ✨</div>`;
      default:
        return `<div class="history-entry">${timeStr} — ${h.type}</div>`;
    }
  }).join('');
  return `<div class="pokemon-history">
    <div class="history-title">${state.lang === 'fr' ? '📜 Historique' : '📜 History'}</div>
    ${entries}
  </div>`;
}

// ════════════════════════════════════════════════════════════════
// 18.  UI — POKEDEX TAB
// ════════════════════════════════════════════════════════════════

let dexSelectedEn  = null;
let dexViewFilter  = 'kanto'; // 'kanto' | 'national' | 'shiny' | 'missing'

function getSpawnZones(species_en) {
  return ZONES
    .filter(z => z.pool && z.pool.includes(species_en))
    .map(z => ({ name: state.lang === 'fr' ? z.fr : z.en, rate: z.spawnRate, id: z.id }));
}

// ── Pokédex Assistant (Professeur Oak) ───────────────────────────────────────

const DEX_ASSISTANT_PRICES = {
  common:    100,
  uncommon:  300,
  rare:     1000,
  very_rare: 3000,
  legendary: 8000,
};

const DEX_ASSISTANT_TIPS = {
  legendary: [
    'Les légendaires sont extrêmement rares (≈1% par spawn). Installe plusieurs agents dans les zones concernées et sois patient.',
    'Un légendaire peut aussi apparaître pendant un raid de zone. Concentre tes forces !',
    'Active le mode "Rare Scope" depuis le marché pour forcer l\'apparition des espèces rares (légendaires exclus, mais ça libère de la place dans le pool).',
  ],
  very_rare: [
    'Cette espèce est très rare. Le "Rare Scope" du marché triple ses chances d\'apparition.',
    'Assigne plusieurs agents dans les zones indiquées pour multiplier les chances de rencontre.',
    'Un niveau de maîtrise élevé dans la zone augmente la fréquence des spawns globaux.',
  ],
  rare: [
    'Espèce rare — plusieurs sessions de farm seront nécessaires. Garde les Poké Balls prêtes !',
    'Le "Rare Scope" peut aider à filtrer les espèces communes et augmenter le taux des rares.',
    'En mode automatique, assigne un agent spécialisé en capture dans la zone la plus active.',
  ],
  uncommon: [
    'Espèce peu commune. Quelques heures de farm avec un agent en capture suffisent généralement.',
    'Privilégie la zone avec le meilleur spawnRate (affiché dans Zones de Spawn).',
    'Les coffres de zone peuvent parfois contenir des Pokémon de rareté peu commune.',
  ],
  common: [
    'Espèce commune — tu devrais en trouver rapidement, même sans agent assigné.',
    'Lance une capture manuelle depuis la zone ou laisse un agent s\'en occuper.',
    'Si tu en as besoin en shiny, active le Charme Chroma depuis le marché cosmétiques.',
  ],
};

function _getDexAssistantCostHtml(sp) {
  const price = DEX_ASSISTANT_PRICES[sp.rarity] ?? 500;
  const canAfford = state.gang.money >= price;
  return `<button id="dexAssistantBtn" style="
    width:100%;font-family:var(--font-pixel);font-size:8px;padding:7px 10px;
    background:rgba(255,204,90,.06);border:1px solid ${canAfford ? 'rgba(255,204,90,.4)' : 'var(--border)'};
    border-radius:var(--radius-sm);color:${canAfford ? 'var(--gold)' : 'var(--text-dim)'};
    cursor:${canAfford ? 'pointer' : 'default'};text-align:left;
    display:flex;align-items:center;justify-content:space-between;gap:6px
  ">
    <span>🎓 Conseil du Professeur</span>
    <span style="font-family:sans-serif;font-size:9px;color:${canAfford ? 'var(--gold-dim)' : '#444'}">${price.toLocaleString()}₽</span>
  </button>`;
}

function openDexAssistant(species_en) {
  const sp = SPECIES_BY_EN[species_en];
  if (!sp) return;

  const price = DEX_ASSISTANT_PRICES[sp.rarity] ?? 500;
  if (state.gang.money < price) {
    notify(`Fonds insuffisants — ${price.toLocaleString()}₽ requis.`, 'error');
    return;
  }

  const spawnZones = getSpawnZones(sp.en);
  const rarity     = sp.rarity ?? 'common';
  const rarityFR   = { common:'Commun', uncommon:'Peu commun', rare:'Rare', very_rare:'Très rare', legendary:'Légendaire' };
  const rarityCol  = { common:'#aaa', uncommon:'#5be06c', rare:'#5b9be0', very_rare:'#c05be0', legendary:'#ffcc5a' };

  // Pick 2 random tips for this rarity
  const pool = DEX_ASSISTANT_TIPS[rarity] ?? DEX_ASSISTANT_TIPS.common;
  const tips = pool.length <= 2 ? pool : [pool[Math.floor(Math.random() * pool.length)]];

  // Best zone by spawnRate
  const bestZone = spawnZones.sort((a, b) => b.rate - a.rate)[0];

  const zonesHtml = spawnZones.length
    ? spawnZones.map(z => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:9px">${z.name}</span>
          <span style="font-size:8px;color:var(--text-dim)">${(z.rate * 100).toFixed(1)}% / tick</span>
        </div>`).join('')
    : `<div style="font-size:9px;color:var(--text-dim)">Aucune zone connue pour cette espèce.</div>`;

  const tipsHtml = tips.map(tip =>
    `<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="color:var(--gold);font-size:12px;flex-shrink:0">💡</span>
      <span style="font-size:9px;color:var(--text);line-height:1.5">${tip}</span>
    </div>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:22px;max-width:440px;width:100%;max-height:88vh;overflow-y:auto;display:flex;flex-direction:column;gap:14px">

      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">🎓 Professeur Oak</div>
        <button id="btnDexAssistClose" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
      </div>

      <!-- En-tête Pokémon -->
      <div style="display:flex;align-items:center;gap:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px">
        <img src="${pokeSprite(sp.en, false)}" style="width:52px;height:52px;image-rendering:pixelated">
        <div>
          <div style="font-family:var(--font-pixel);font-size:11px">${sp.fr}</div>
          <div style="font-size:8px;color:var(--text-dim)">#${String(sp.dex).padStart(3,'0')} — ${sp.types.map(typeFr).join('/')}</div>
          <div style="margin-top:4px">
            <span style="font-size:8px;padding:2px 8px;border-radius:8px;background:rgba(255,204,90,.12);border:1px solid ${rarityCol[rarity]};color:${rarityCol[rarity]}">${rarityFR[rarity]}</span>
          </div>
        </div>
      </div>

      <!-- Zones de spawn -->
      <div>
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:6px">📍 ZONES DE SPAWN</div>
        ${zonesHtml}
        ${bestZone ? `<div style="font-size:8px;color:var(--green);margin-top:6px">✓ Meilleure zone : <b>${bestZone.name}</b> (${(bestZone.rate * 100).toFixed(1)}% / tick)</div>` : ''}
      </div>

      <!-- Conseils -->
      <div>
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:4px">📋 CONSEILS</div>
        ${tipsHtml}
      </div>

      <!-- Coût déduit -->
      <div style="font-size:8px;color:var(--text-dim);border-top:1px solid var(--border);padding-top:8px;text-align:right">
        −${price.toLocaleString()}₽ déduits · Solde : <span style="color:var(--gold)">${(state.gang.money - price).toLocaleString()}₽</span>
      </div>
    </div>`;

  // Déduire le prix
  state.gang.money -= price;
  updateTopBar();
  saveState();

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#btnDexAssistClose')?.addEventListener('click', () => overlay.remove());

  // Refresh le bouton dans le détail (plus assez d'argent peut-être)
  renderDexDetail(species_en);
}

function renderDexDetail(species_en) {
  const panel = document.getElementById('dexDetail');
  if (!panel) return;
  const sp = SPECIES_BY_EN[species_en];
  if (!sp) { panel.classList.add('hidden'); return; }

  const entry = state.pokedex[sp.en] || {};
  const caught = entry.caught || false;
  const ownedCount = state.pokemons.filter(p => p.species_en === sp.en).length;
  const spawnZones = getSpawnZones(sp.en);

  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div style="text-align:center;margin-bottom:10px">
      <div style="display:inline-flex;gap:8px;align-items:flex-end;justify-content:center">
        <div style="position:relative;display:inline-block">
          <img src="${pokeSprite(sp.en, false)}" style="width:80px;height:80px;${!caught ? 'filter:grayscale(1) brightness(.5)' : ''}">
        </div>
        ${caught && entry.shiny ? `<div style="position:relative;display:inline-block">
          <img src="${pokeSprite(sp.en, true)}" style="width:64px;height:64px;filter:drop-shadow(0 0 6px gold)">
          <span style="position:absolute;top:-4px;right:-4px;font-size:11px">✨</span>
        </div>` : ''}
      </div>
      <div style="font-family:var(--font-pixel);font-size:11px;margin-top:4px">${caught ? (state.lang === 'fr' ? sp.fr : sp.en) : '???'}</div>
      <div style="font-size:9px;color:var(--text-dim)">#${String(sp.dex).padStart(3,'0')} — ${caught ? sp.types.map(typeFr).join('/') : '?'}</div>
    </div>

    ${caught ? `
    <div style="font-size:9px;color:var(--text);margin-bottom:10px;line-height:1.5;border-top:1px solid var(--border);padding-top:8px">
      ${getDexDesc(sp.en, SPECIES_BY_EN)}
    </div>

    <div style="font-size:9px;margin-bottom:10px">
      <div style="color:var(--text-dim);margin-bottom:4px;font-family:var(--font-pixel)">CAPTURES</div>
      <div>Total capturés : <b style="color:var(--gold)">${entry.count || 0}</b></div>
      <div>Dans le PC : <b>${ownedCount}</b></div>
      ${entry.shiny ? '<div style="color:var(--gold)">✨ Chromatique obtenu !</div>' : ''}
    </div>

    <div style="font-size:9px;margin-bottom:10px">
      <div style="color:var(--text-dim);margin-bottom:4px;font-family:var(--font-pixel)">ZONES DE SPAWN</div>
      ${spawnZones.length ? spawnZones.map(z => {
        const interval = (1 / z.rate).toFixed(0);
        return `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)">
          <span>${z.name}</span>
          <span style="color:var(--text-dim)">1/${interval}s</span>
        </div>`;
      }).join('') : '<div style="color:var(--text-dim)">Aucune zone connue</div>'}
    </div>

    <div style="font-size:9px">
      <div style="color:var(--text-dim);margin-bottom:4px;font-family:var(--font-pixel)">BASE STATS</div>
      <div style="display:flex;flex-direction:column;gap:3px">
        ${[['ATK', sp.baseAtk], ['DEF', sp.baseDef], ['SPD', sp.baseSpd]].map(([label, val]) => `
          <div style="display:flex;align-items:center;gap:6px">
            <span style="width:28px;color:var(--text-dim)">${label}</span>
            <div style="flex:1;background:var(--border);border-radius:2px;height:4px">
              <div style="background:var(--gold-dim);height:4px;border-radius:2px;width:${Math.round(val/150*100)}%"></div>
            </div>
            <span style="width:24px;text-align:right">${val}</span>
          </div>`).join('')}
      </div>
    </div>
    ${ownedCount > 0 ? `
    <div style="margin-top:10px">
      <button id="dexFilterPCBtn" style="width:100%;font-size:9px;padding:6px;background:var(--bg);border:1px solid var(--blue);border-radius:var(--radius-sm);color:var(--blue);cursor:pointer;font-family:var(--font-pixel)">
        🔍 Voir dans le PC (×${ownedCount})
      </button>
    </div>` : ''}
    ${state.purchases.autoSellAgent && entry.shiny ? `
    <div style="margin-top:10px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm)">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:9px">
        <input type="checkbox" id="dexShinyUnprotect" ${entry.shinyUnprotected ? 'checked' : ''} style="width:14px;height:14px">
        <span>✨ Autoriser la vente auto du Shiny<br><span style="color:var(--text-dim);font-size:8px">Les shinies de cette espèce pourront être auto-vendus</span></span>
      </label>
    </div>` : ''}
    <div style="margin-top:8px">
      ${_getDexAssistantCostHtml(sp)}
    </div>
    ` : `
    <div style="color:var(--text-dim);font-size:10px;padding:20px;text-align:center">Pas encore rencontré</div>
    <div style="margin-top:4px">
      ${_getDexAssistantCostHtml(sp)}
    </div>`}
  `;

  document.getElementById('dexFilterPCBtn')?.addEventListener('click', () => filterPCBySpecies(sp.en));
  document.getElementById('dexAssistantBtn')?.addEventListener('click', () => openDexAssistant(species_en));
  document.getElementById('dexShinyUnprotect')?.addEventListener('change', (e) => {
    if (!state.pokedex[sp.en]) state.pokedex[sp.en] = {};
    state.pokedex[sp.en].shinyUnprotected = e.target.checked;
    saveState();
    notify(e.target.checked ? `⚠ Shinies de ${speciesName(sp.en)} déprotégés.` : `✅ Shinies de ${speciesName(sp.en)} à nouveau protégés.`, e.target.checked ? '' : 'success');
  });
}

// ── Player stat modal ────────────────────────────────────────────
const PLAYER_STAT_POINT_EVERY = 25; // 1 pt par tranche de 25 captures

function checkPlayerStatPoints() {
  const ps  = state.playerStats || {};
  const total = Math.floor((state.stats?.totalCaught || 0) / PLAYER_STAT_POINT_EVERY);
  const granted = ps.pointsGrantedCount || 0;
  if (total > granted) {
    const newPts = total - granted;
    ps.statPoints = (ps.statPoints || 0) + newPts;
    ps.pointsGrantedCount = total;
    state.playerStats = ps;
    if (newPts > 0) notify(`📊 +${newPts} pt${newPts > 1 ? 's' : ''} de stat joueur disponible${newPts > 1 ? 's' : ''} !`, 'gold');
  }
}

function openPlayerStatModal() {
  checkPlayerStatPoints();
  const ps = state.playerStats;
  if (!ps) return;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:10000;display:flex;align-items:center;justify-content:center';

  function render() {
    const alloc = ps.allocatedStats || { combat: 0, capture: 0, luck: 0 };
    const base  = ps.baseStats      || { combat: 10, capture: 10, luck: 5 };
    const pts   = ps.statPoints || 0;
    const stats = [
      { key:'combat',  label:'⚔️ ATK (combat)',  color:'#e05c5c' },
      { key:'capture', label:'🎯 CAP (capture)',  color:'#7eb8f7' },
      { key:'luck',    label:'🍀 LCK (chance)',   color:'#6ecf8a' },
    ];
    overlay.innerHTML = `
      <div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);padding:24px;width:320px;max-width:96vw">
        <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold);margin-bottom:4px">📊 FICHE JOUEUR</div>
        <div style="font-size:9px;color:var(--text-dim);margin-bottom:12px">${state.gang.bossName || 'Boss'} · 1 pt tous les ${PLAYER_STAT_POINT_EVERY} captures</div>
        <div style="font-family:var(--font-pixel);font-size:9px;margin-bottom:14px;color:${pts > 0 ? 'var(--gold)' : 'var(--text-dim)'}">
          Points disponibles : <b style="font-size:12px">${pts}</b>
        </div>
        ${stats.map(s => {
          const tot  = (base[s.key] || 0) + (alloc[s.key] || 0);
          const add  = alloc[s.key] || 0;
          return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
            <div style="flex:1;font-size:9px;color:${s.color}">${s.label}</div>
            <button data-ps="${s.key}" data-dir="-10" title="-10" style="padding:0 5px;height:22px;border:1px solid var(--border);background:var(--bg);color:var(--text-dim);border-radius:4px;cursor:pointer;font-size:8px" ${add < 10 ? 'disabled' : ''}>−10</button>
            <button data-ps="${s.key}" data-dir="-1"  title="-1"  style="width:22px;height:22px;border:1px solid var(--border);background:var(--bg);color:var(--text);border-radius:4px;cursor:pointer;font-size:13px;line-height:1" ${add <= 0 ? 'disabled' : ''}>−</button>
            <div style="min-width:48px;text-align:center;font-family:var(--font-pixel);font-size:10px">
              <span style="color:${s.color};font-size:12px">${tot}</span>
              ${add > 0 ? `<span style="font-size:7px;color:var(--gold)"> (+${add})</span>` : ''}
            </div>
            <button data-ps="${s.key}" data-dir="1"  title="+1"  style="width:22px;height:22px;border:1px solid var(--gold);background:rgba(255,204,90,.08);color:var(--gold);border-radius:4px;cursor:pointer;font-size:13px;line-height:1" ${pts <= 0 ? 'disabled' : ''}>+</button>
            <button data-ps="${s.key}" data-dir="10" title="+10" style="padding:0 5px;height:22px;border:1px solid var(--gold);background:rgba(255,204,90,.08);color:var(--gold);border-radius:4px;cursor:pointer;font-size:8px" ${pts < 10 ? 'disabled' : ''}>+10</button>
          </div>`;
        }).join('')}
        <div style="display:flex;gap:8px;margin-top:18px">
          <button id="psConfirm" style="flex:1;padding:9px;background:var(--gold);color:#000;border:none;border-radius:var(--radius-sm);font-family:var(--font-pixel);font-size:8px;cursor:pointer">CONFIRMER</button>
          <button id="psCancel" style="flex:1;padding:9px;background:var(--bg);border:1px solid var(--border);color:var(--text-dim);border-radius:var(--radius-sm);font-family:var(--font-pixel);font-size:8px;cursor:pointer">FERMER</button>
        </div>
      </div>`;

    overlay.querySelectorAll('[data-ps][data-dir]').forEach(btn => {
      btn.addEventListener('click', () => {
        const s    = btn.dataset.ps;
        const dir  = parseInt(btn.dataset.dir);
        const step = Math.abs(dir);
        const alloc = ps.allocatedStats || { combat: 0, capture: 0, luck: 0 };
        if (dir > 0) { const n = Math.min(step, ps.statPoints); alloc[s] += n; ps.statPoints -= n; }
        else         { const n = Math.min(step, alloc[s]);      alloc[s] -= n; ps.statPoints += n; }
        ps.allocatedStats = alloc;
        render();
      });
    });
    overlay.querySelector('#psConfirm')?.addEventListener('click', () => {
      saveState();
      overlay.remove();
      if (getActiveTab() === 'tabAgents') renderAgentsTab();
    });
    overlay.querySelector('#psCancel')?.addEventListener('click', () => overlay.remove());
  }

  render();
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── Pokédex integrity check ───────────────────────────────────────
// Rebuilds state.pokedex caught/shiny/count from the actual pokemon list.
// "seen" flags are preserved (they can't be reconstructed from ownership).
function rebuildPokedex() {
  // Step 1 — preserve existing seen AND shiny flags (both are historical — never reset)
  // "shiny" = has ever obtained a chroma of this species (includes sold ones)
  const next = {};
  // seen / caught / shiny = historical flags → only ever go UP, never down
  // count = rebuilt from current ownership (can go down if sold)
  for (const [en, entry] of Object.entries(state.pokedex)) {
    next[en] = {
      seen:   !!entry.seen,
      caught: !!entry.caught, // preserved — may have been sold but was once caught
      shiny:  !!entry.shiny,  // preserved — may have been sold but was once obtained
      count:  0,              // rebuilt from current ownership below
    };
  }

  // Step 2 — add missing entries + rebuild count from owned pokemons
  for (const pk of state.pokemons) {
    const en = pk.species_en;
    if (!next[en]) next[en] = { seen: true, caught: false, shiny: false, count: 0 };
    next[en].caught = true;   // add only
    next[en].seen   = true;   // add only
    next[en].count  = (next[en].count || 0) + 1;
    if (pk.shiny) next[en].shiny = true; // add only
  }

  // Step 3 — eggs: mark species as seen
  for (const egg of state.eggs || []) {
    if (!egg.species_en) continue;
    if (!next[egg.species_en]) next[egg.species_en] = { seen: false, caught: false, shiny: false, count: 0 };
    next[egg.species_en].seen = true;
  }

  // Step 4 — detect discrepancies before committing
  let fixedCaught = 0, fixedShiny = 0, fixedCount = 0;
  for (const en of Object.keys(next)) {
    const old = state.pokedex[en] || {};
    if (!!old.caught !== next[en].caught) fixedCaught++;
    if (!!old.shiny  !== next[en].shiny)  fixedShiny++;
    if ((old.count || 0) !== next[en].count) fixedCount++;
  }

  // Step 5 — commit
  state.pokedex = next;

  // Step 6 — rebuild derived stats
  state.stats.dexCaught = POKEMON_GEN1.filter(s => !s.hidden && next[s.en]?.caught).length;
  // shinyCaught = cumulative total captures ever (includes sold).
  // Only correct upward: if currently owned shinies exceed the stored counter
  // (e.g. counter was never saved), bring it up — but never reduce it.
  const ownedShinyNow = state.pokemons.filter(p => p.shiny).length;
  if ((state.stats.shinyCaught || 0) < ownedShinyNow) {
    state.stats.shinyCaught = ownedShinyNow;
  }
  // shinySpeciesCount is derived on-the-fly from pokedex[en].shiny (getShinySpeciesCount())
  // — no separate stat to store; the dex flags are the source of truth.

  saveState();

  const kanto    = getDexKantoCaught();
  const shinyEsp = getShinySpeciesCount();
  const parts = [];
  if (fixedCaught) parts.push(`${fixedCaught} capturés corrigés`);
  if (fixedShiny)  parts.push(`${fixedShiny} chromas corrigés`);
  if (fixedCount)  parts.push(`${fixedCount} compteurs corrigés`);
  const detail = parts.length ? ` (${parts.join(', ')})` : ' — tout était déjà cohérent';
  notify(`✅ Pokédex recalibré${detail} · Kanto ${kanto}/${getKantoDexSize()} · ${shinyEsp} esp. chroma`, 'success');

  renderPokedexTab();
  renderGangTab();
}

function renderPokedexTab() {
  const grid = document.getElementById('pokedexGrid');
  if (!grid) return;

  // ── Counter bar (Kanto / National / Chromas) ─────────────────
  const kantoCaught    = getDexKantoCaught();
  const nationalCaught = getDexNationalCaught();
  const shinySpecies   = getShinySpeciesCount();

  let dexCounter = document.getElementById('dexCounter');
  if (!dexCounter) {
    dexCounter = document.createElement('div');
    dexCounter.id = 'dexCounter';
    dexCounter.style.cssText = 'font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:6px;display:flex;gap:12px;flex-wrap:wrap;align-items:center';
    grid.parentNode.insertBefore(dexCounter, grid);
  }
  dexCounter.innerHTML = `
    <span title="Pokédex Kanto (151 espèces originales)">📖 Kanto&nbsp;<b style="color:var(--text)">${kantoCaught}/${getKantoDexSize()}</b></span>
    <span title="Pokédex National (toutes espèces disponibles)" style="opacity:.7">🌐 National&nbsp;<b style="color:var(--text)">${nationalCaught}/${getNationalDexSize()}</b></span>
    <span title="Espèces uniques dont au moins un exemplaire chromatique">✨&nbsp;<b style="color:var(--gold)">${shinySpecies}</b></span>
    <button id="dexRebuildBtn" title="Reconstruire le Pokédex depuis tes Pokémon réels" style="margin-left:auto;font-family:var(--font-pixel);font-size:7px;padding:3px 7px;background:rgba(255,204,90,.08);border:1px solid rgba(255,204,90,.35);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;white-space:nowrap">🔄 Recalibrer</button>
  `;
  document.getElementById('dexRebuildBtn')?.addEventListener('click', rebuildPokedex);

  // ── Filter tabs ────────────────────────────────────────────────
  const DEX_FILTERS = [
    { id: 'kanto',    label: 'Kanto',       title: 'Pokémon #001–151' },
    { id: 'national', label: 'National',    title: 'Toutes les espèces disponibles' },
    { id: 'shiny',    label: '✨ Chromas',  title: 'Espèces dont tu possèdes un chromatique' },
    { id: 'missing',  label: '❓ Manquants',title: 'Espèces non encore capturées' },
  ];
  let dexFilterBar = document.getElementById('dexFilterBar');
  if (!dexFilterBar) {
    dexFilterBar = document.createElement('div');
    dexFilterBar.id = 'dexFilterBar';
    dexFilterBar.style.cssText = 'display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap';
    grid.parentNode.insertBefore(dexFilterBar, grid);
  }
  dexFilterBar.innerHTML = DEX_FILTERS.map(f => `
    <button data-dexfilter="${f.id}" title="${f.title}" style="
      font-family:var(--font-pixel);font-size:7px;padding:3px 8px;border-radius:var(--radius-sm);cursor:pointer;
      background:${dexViewFilter === f.id ? 'var(--gold)' : 'var(--bg-card)'};
      color:${dexViewFilter === f.id ? '#000' : 'var(--text-dim)'};
      border:1px solid ${dexViewFilter === f.id ? 'var(--gold)' : 'var(--border)'};
      font-weight:${dexViewFilter === f.id ? 'bold' : 'normal'};
      transition:background .15s,color .15s">${f.label}</button>
  `).join('');
  dexFilterBar.querySelectorAll('[data-dexfilter]').forEach(btn => {
    btn.addEventListener('click', () => {
      dexViewFilter = btn.dataset.dexfilter;
      renderPokedexTab();
    });
  });

  // ── Build species pool (always complete — filter only dims) ──────
  const search = document.getElementById('dexSearchInput')?.value?.toLowerCase() || '';

  // Pool = full dex for this view (never shrinks due to filter)
  const isNational = dexViewFilter === 'national';
  let pool = isNational
    ? POKEMON_GEN1.filter(sp => !sp.hidden)
    : POKEMON_GEN1.filter(sp => !sp.hidden && sp.dex >= 1 && sp.dex <= 151);

  // Text search hides entries (intentional user action)
  if (search) {
    pool = pool.filter(sp =>
      sp.en.includes(search) || sp.fr.toLowerCase().includes(search) ||
      String(sp.dex).includes(search)
    );
  }

  // Predicate: is this entry "highlighted" by the current filter?
  function isHighlighted(sp) {
    switch (dexViewFilter) {
      case 'shiny':   return !!state.pokedex[sp.en]?.shiny;
      case 'missing': return !state.pokedex[sp.en]?.caught;
      default:        return true; // kanto / national → tout est mis en avant
    }
  }
  const hasActiveOverlay = dexViewFilter === 'shiny' || dexViewFilter === 'missing';

  // ── Render grid ────────────────────────────────────────────────
  grid.innerHTML = pool.length ? pool.map(sp => {
    const entry    = state.pokedex[sp.en];
    const caught   = entry?.caught;
    const seen     = entry?.seen;
    const sel      = dexSelectedEn === sp.en ? 'selected' : '';
    const hasShiny = !!entry?.shiny;
    const dimmed   = hasActiveOverlay && !isHighlighted(sp) ? 'dex-dimmed' : '';
    return `<div class="dex-entry ${caught ? 'caught' : ''} ${!seen && !caught ? 'unseen' : ''} ${dimmed} ${sel}" data-dex-en="${sp.en}" style="position:relative">
      ${caught || seen
        ? `<img src="${pokeSprite(sp.en, hasShiny)}" style="width:36px;height:36px;${!caught ? 'filter:brightness(0)' : ''}">`
        : `<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:14px">?</div>`
      }
      ${hasShiny ? `<span style="position:absolute;top:-3px;right:-3px;font-size:9px;line-height:1;pointer-events:none" title="Chromatique obtenu">✨</span>` : ''}
      <div class="dex-number">#${String(sp.dex).padStart(3, '0')}</div>
    </div>`;
  }).join('') : `<div style="color:var(--text-dim);font-size:9px;padding:16px;font-family:var(--font-pixel)">Aucun résultat.</div>`;

  grid.querySelectorAll('.dex-entry[data-dex-en]').forEach(el => {
    el.addEventListener('click', () => {
      dexSelectedEn = el.dataset.dexEn;
      grid.querySelectorAll('.dex-entry').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      renderDexDetail(dexSelectedEn);
    });
  });

  // Search input wiring (once)
  const searchInput = document.getElementById('dexSearchInput');
  if (searchInput && !searchInput.dataset.wired) {
    searchInput.dataset.wired = '1';
    searchInput.addEventListener('input', () => renderPokedexTab());
  }

  // Restore detail panel
  if (dexSelectedEn) renderDexDetail(dexSelectedEn);
}

// ════════════════════════════════════════════════════════════════

Object.assign(globalThis, {
  configurePcPokedex,
  resetPcRenderCache,
  filterPCBySpecies, showContextMenu, closeContextMenu,
  pushFeedEvent, renderEventsTab, addBattleLogEntry,
  openBulkSellModal, tryAutoIncubate, hatchEgg, renderEggsView,
  renderPCTab, renderPokemonGrid, renderPokemonDetail,
  renderPokemonDetailGroup, renderPokemonHistory,
  openDexAssistant, renderDexDetail, checkPlayerStatPoints, openPlayerStatModal,
  rebuildPokedex, renderPokedexTab,
});

export {
  configurePcPokedex,
  resetPcSelection, resetPcRenderCache, setPcPage,
  filterPCBySpecies, showContextMenu, closeContextMenu,
  pushFeedEvent, renderEventsTab, addBattleLogEntry,
  openBulkSellModal, tryAutoIncubate, hatchEgg, renderEggsView,
  renderPCTab, renderPokemonGrid, renderPokemonDetail,
  renderPokemonDetailGroup, renderPokemonHistory,
  openDexAssistant, renderDexDetail, checkPlayerStatPoints, openPlayerStatModal,
  rebuildPokedex, renderPokedexTab,
};
