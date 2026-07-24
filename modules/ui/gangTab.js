'use strict';

import { BOSS_TEAM_SLOTS } from '../../data/game-config-data.js';

import { EventBus, EVENTS } from '../core/eventBus.js';
import { esc as _esc } from '../core/escape.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY,        { msg, type });
const _dirty  = ()               => EventBus.emit(EVENTS.STATE_DIRTY);
const _topBar = ()               => EventBus.emit(EVENTS.UI_TOPBAR_UPDATE);
const _save   = ()               => globalThis.saveState?.();


// deps (globalThis): state, notify, saveState, updateTopBar, switchTab, showConfirm, SFX,
//   pokeSprite, pokeIcon, trainerSprite, pokemonDisplayName,
//   getBossFullTitle, getTitleLabel, getShinySpeciesCount,
//   getDexKantoCaught, getDexNationalCaught, KANTO_DEX_SIZE, NATIONAL_DEX_SIZE,
//   GAME_VERSION, openBossEditModal, openTitleModal, openTeamPickerModal,
//   openNameModal, openSpritePicker, _gbase_openExportModal
//
// La musique, l'apparence (fonds/pins/skins) et la vitrine ont été extraites
// vers la page séparée gang/ (pokegang.sterenna.fr/gang/) — voir
// gang/panels.js et gang/environment.js. Ce fichier ne garde que la partie
// non-cosmétique de l'onglet Gang (stats, services, équipe boss, titre).

const _gangCollapsed = { services: false, stats: false };
let _statsViewMode = 'session';

// ── Render guard — évite les rechargements intempestifs du tab Gang ──
// _gangTabLocked        : posé par les pickers/modals ouverts sur ce tab
// _gangTabTimer         : debounce 80 ms pour regrouper les appels rapides successifs
// _gangTabPendingRender : render différé (lock actif ou focus dans le tab)
// _gangFocusOutWired    : listener focusout déjà posé (évite les doublons)
let _gangTabLocked        = false;
let _gangTabTimer         = null;
let _gangTabPendingRender = false;
let _gangFocusOutWired    = false;

export function lockGangTab()   { _gangTabLocked = true; }
export function unlockGangTab() {
  _gangTabLocked = false;
  if (_gangTabPendingRender) { _gangTabPendingRender = false; renderGangTab(); }
}

// Pose un listener focusout unique sur le tab pour déclencher le render différé
// dès que l'utilisateur quitte l'input actif.
function _ensureGangFocusOutHandler(tab) {
  if (_gangFocusOutWired) return;
  _gangFocusOutWired = true;
  tab.addEventListener('focusout', function onFocusOut(e) {
    // Ignorer si le focus reste dans le tab (ex: passer d'un range à un bouton)
    if (tab.contains(e.relatedTarget)) return;
    _gangFocusOutWired = false;
    tab.removeEventListener('focusout', onFocusOut);
    if (_gangTabPendingRender) { _gangTabPendingRender = false; renderGangTab(); }
  });
}
// ── Services HTML builder ─────────────────────────────────────────────────────
function _buildServicesHtml(state) {
  const parts = [];

  // Auto collect
  const ownAC = !!state.purchases.autoCollect;
  const enAC  = state.purchases.autoCollectEnabled !== false;
  parts.push(`<div style="background:var(--bg);border:1px solid ${ownAC ? (enAC ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
    <div style="font-size:22px;flex-shrink:0;${ownAC && !enAC ? 'opacity:.4;filter:grayscale(1)' : ''}">🪙</div>
    <div style="flex:1">
      <div style="font-family:var(--font-pixel);font-size:8px;color:${ownAC ? (enAC ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">Récolte automatique</div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Collecte les revenus de zone sans animation. Combat calculé en arrière-plan.</div>
      ${ownAC
        ? `<div style="display:flex;align-items:center;gap:8px">
             <span style="font-family:var(--font-pixel);font-size:7px;color:${enAC ? 'var(--green)' : 'var(--text-dim)'}">${enAC ? '✓ ACTIVE' : '✗ INACTIVE'}</span>
             <button id="btnToggleAutoCollect" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${enAC ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${enAC ? 'var(--red)' : 'var(--green)'};cursor:pointer">${enAC ? 'Désactiver' : 'Activer'}</button>
           </div>`
        : `<button id="btnBuyAutoCollect" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Acheter — 100 000₽</button>`}
    </div>
  </div>`);

  // Auto sell agent
  const ownAS = !!state.purchases.autoSellAgent;
  const enAS  = state.purchases.autoSellAgentEnabled !== false;
  parts.push(`<div style="background:var(--bg);border:1px solid ${ownAS ? (enAS ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
    <div style="font-size:22px;flex-shrink:0;${ownAS && !enAS ? 'opacity:.4;filter:grayscale(1)' : ''}">🤖</div>
    <div style="flex:1">
      <div style="font-family:var(--font-pixel);font-size:8px;color:${ownAS ? (enAS ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">Vente automatique (captures agent)</div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Vend automatiquement les Pokémon capturés par les agents. Shinies toujours protégés.</div>
      ${ownAS
        ? `<div style="display:flex;flex-direction:column;gap:6px">
             <div style="display:flex;align-items:center;gap:8px">
               <span style="font-family:var(--font-pixel);font-size:7px;color:${enAS ? 'var(--green)' : 'var(--text-dim)'}">${enAS ? '✓ ACTIVE' : '✗ INACTIVE'}</span>
               <button id="btnToggleAutoSellAgent" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${enAS ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${enAS ? 'var(--red)' : 'var(--green)'};cursor:pointer">${enAS ? 'Désactiver' : 'Activer'}</button>
             </div>
             <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
               <label style="display:flex;align-items:center;gap:4px;font-size:8px;cursor:pointer"><input type="radio" name="autoSellMode" value="all" ${(state.settings.autoSellAgent?.mode || 'all') === 'all' ? 'checked' : ''}> Tout vendre</label>
               <label style="display:flex;align-items:center;gap:4px;font-size:8px;cursor:pointer"><input type="radio" name="autoSellMode" value="by_potential" ${state.settings.autoSellAgent?.mode === 'by_potential' ? 'checked' : ''}> Par potentiel</label>
             </div>
             ${state.settings.autoSellAgent?.mode === 'by_potential' ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${[1,2,3,4,5].map(p => `<label style="display:flex;align-items:center;gap:3px;font-size:8px;cursor:pointer"><input type="checkbox" class="autoSellPot" value="${p}" ${(state.settings.autoSellAgent?.potentials || []).includes(p) ? 'checked' : ''}> ${'★'.repeat(p)}</label>`).join('')}</div>` : ''}
           </div>`
        : `<button id="btnBuyAutoSellAgent" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Acheter — 10 000 000₽</button>`}
    </div>
  </div>`);

  // Nurse
  const ownN = !!state.purchases.autoIncubator;
  const enN  = state.purchases.autoIncubatorEnabled !== false;
  parts.push(`<div style="background:var(--bg);border:1px solid ${ownN ? (enN ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
    <img src="${globalThis.trainerSprite('nurse')}" style="width:36px;height:36px;image-rendering:pixelated;flex-shrink:0;${ownN && !enN ? 'opacity:.4;filter:grayscale(1)' : ''}" onerror="this.style.display='none'">
    <div style="flex:1">
      <div style="font-family:var(--font-pixel);font-size:8px;color:${ownN ? (enN ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">Infirmière Joëlle corrompue</div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Auto-incube les œufs dès qu'un incubateur est libre.</div>
      ${ownN
        ? `<div style="display:flex;align-items:center;gap:8px">
             <span style="font-family:var(--font-pixel);font-size:7px;color:${enN ? 'var(--green)' : 'var(--text-dim)'}">${enN ? '✓ EN POSTE' : '✗ CONGÉ'}</span>
             <button id="btnToggleNurse" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${enN ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${enN ? 'var(--red)' : 'var(--green)'};cursor:pointer">${enN ? 'Mettre en congé' : 'Rappeler'}</button>
           </div>`
        : `<button id="btnBuyNurse" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Embaucher — 300 000₽</button>`}
    </div>
  </div>`);

  // Scientist
  const ownSc = !!state.purchases.scientist;
  const enSc  = state.purchases.scientistEnabled !== false;
  parts.push(`<div style="background:var(--bg);border:1px solid ${ownSc ? (enSc ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
    <img src="${globalThis.trainerSprite('scientist')}" style="width:36px;height:36px;image-rendering:pixelated;flex-shrink:0;${ownSc && !enSc ? 'opacity:.4;filter:grayscale(1)' : ''}" onerror="this.style.display='none'">
    <div style="flex:1">
      <div style="font-family:var(--font-pixel);font-size:8px;color:${ownSc ? (enSc ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">Scientifique peu scrupuleux</div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Révèle l'espèce des œufs (10k₽) · Mutation artificielle : sacrifice ★★★★★ même espèce pour potentiel max.</div>
      ${ownSc
        ? `<div style="display:flex;align-items:center;gap:8px">
             <span style="font-family:var(--font-pixel);font-size:7px;color:${enSc ? 'var(--green)' : 'var(--text-dim)'}">${enSc ? '✓ EN POSTE' : '✗ RENVOYÉ'}</span>
             <button id="btnToggleScientist" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${enSc ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${enSc ? 'var(--red)' : 'var(--green)'};cursor:pointer">${enSc ? 'Renvoyer' : 'Rappeler'}</button>
           </div>`
        : `<button id="btnBuyScientist" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Engager — 15 000₽</button>`}
    </div>
  </div>`);

  // Special purchases
  const SPECIALS = [
    { id:'title_richissime',     icon:'💰', label:'Titre "Richissime"',        desc:'Débloque le titre légendaire. Ostentation maximale.',  cost:5_000_000,
      owned: () => !!state.purchases.title_richissime || (state.unlockedTitles||[]).includes('richissime') },
    { id:'title_doublerichissim', icon:'💎', label:'Titre "Double Richissime"', desc:'Débloque le titre ultime. Noblesse oblige.',           cost:10_000_000,
      owned: () => !!state.purchases.title_doublerichissim || (state.unlockedTitles||[]).includes('doublerichissim') },
    { id:'chromaCharm',           icon:'✨', label:'Charme Chroma',             desc:'Double le taux de Pokémon chromatiques. Permanent.',   cost:5_000_000,
      owned: () => !!state.purchases.chromaCharm },
  ];
  parts.push(`<div>
    <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin:4px 0 6px;letter-spacing:1px">🛒 ACHATS SPÉCIAUX</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${SPECIALS.map(sp => {
        const own = sp.owned();
        return `<div style="background:var(--bg);border:1px solid ${own ? 'var(--green)' : 'var(--border)'};border-radius:var(--radius-sm);padding:8px;display:flex;gap:10px;align-items:center">
          <div style="font-size:20px;flex-shrink:0">${sp.icon}</div>
          <div style="flex:1">
            <div style="font-family:var(--font-pixel);font-size:8px;color:${own ? 'var(--green)' : 'var(--text)'};margin-bottom:2px">${sp.label}</div>
            <div style="font-size:7px;color:var(--text-dim)">${sp.desc}</div>
          </div>
          ${own
            ? `<div style="font-family:var(--font-pixel);font-size:7px;color:var(--green);white-space:nowrap">✓ ACTIF</div>`
            : `<button class="btn-special-buy" data-sp-id="${sp.id}" style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;white-space:nowrap">${sp.cost.toLocaleString()}₽</button>`}
        </div>`;
      }).join('')}
    </div>
  </div>`);

  return parts.join('');
}

// ── Targeted DOM patch helpers (avoid full re-render on every click) ──────────

function _patchActiveBg(container, newKey) {
  container.querySelectorAll('.cosm-card:not(.cosm-fabric-card)').forEach(el => {
    const k = el.dataset.cosm;
    const isAct = (newKey === null && k === 'none') || k === newKey;
    el.classList.toggle('cosm-active', isAct);
    el.style.borderColor = isAct ? 'var(--gold)' : (el.dataset.owned === '1' ? 'var(--green)' : 'var(--border)');
    const sub = el.querySelector('[data-cosm-sub]');
    if (sub) sub.style.color = isAct ? 'var(--gold)' : (el.dataset.owned === '1' ? 'var(--green)' : 'var(--text-dim)');
  });
}

function _patchActiveFabric(container, newKey) {
  container.querySelectorAll('.cosm-fabric-card').forEach(el => {
    const k = el.dataset.cosm;
    const isAct = k === newKey;
    el.classList.toggle('cosm-active', isAct);
    el.style.borderColor = isAct ? 'var(--gold)' : (el.dataset.owned === '1' ? 'var(--green)' : 'var(--border)');
  });
}

function _patchFabricSettings(container, cosmetics) {
  const settings = container.querySelector('#fabricSettings');
  if (!settings) return;
  const mode = cosmetics.fabricMode || 'repeat';
  settings.querySelectorAll('.fabric-mode-btn').forEach(btn => {
    const act = btn.dataset.mode === mode;
    btn.style.borderColor = act ? 'var(--gold)' : 'var(--border)';
    btn.style.background  = act ? 'rgba(255,200,0,0.10)' : 'var(--bg)';
    btn.style.color       = act ? 'var(--gold)' : 'var(--text-dim)';
  });
  const sizeRange = settings.querySelector('#fabricSizeRange');
  if (sizeRange) {
    const sizeWrap = sizeRange.closest('div');
    if (sizeWrap) sizeWrap.style.opacity = mode === 'repeat' ? '1' : '0.35';
    sizeRange.style.pointerEvents = mode === 'repeat' ? '' : 'none';
  }
}

function _patchPinCards(container, activePatches) {
  container.querySelectorAll('.cosm-patch-card').forEach(el => {
    const pid = parseInt(el.dataset.patchPid, 10);
    const isAct = activePatches.includes(pid);
    el.style.borderColor = isAct ? 'var(--gold)' : 'var(--border)';
    el.style.background  = isAct ? 'rgba(255,200,0,0.08)' : 'var(--bg-card)';
    const labels = el.querySelectorAll('div');
    if (labels.length) labels[labels.length - 1].style.color = isAct ? 'var(--gold)' : 'var(--text-dim)';
    let onTag = el.querySelector('.cosm-on-tag');
    if (isAct && !onTag) {
      onTag = document.createElement('div');
      onTag.className = 'cosm-on-tag';
      onTag.style.cssText = 'font-size:7px;color:var(--gold)';
      onTag.textContent = '[ ON ]';
      el.appendChild(onTag);
    } else if (!isAct && onTag) {
      onTag.remove();
    }
  });
}

// ── Main Gang tab ─────────────────────────────────────────────────────────────
function renderGangTab() {
  if (_gangTabLocked) { _gangTabPendingRender = true; return; }
  if (_gangTabTimer) { clearTimeout(_gangTabTimer); _gangTabTimer = null; }
  _gangTabTimer = setTimeout(() => {
    _gangTabTimer = null;
    // Ne pas reconstruire le DOM si l'utilisateur a le focus sur un input/range/select
    // (évite de reset les sliders, radios, dropdowns en cours d'interaction)
    const focused = document.activeElement;
    const tab = document.getElementById('tabGang');
    if (focused && tab?.contains(focused) && ['INPUT', 'SELECT', 'TEXTAREA'].includes(focused.tagName)) {
      _gangTabPendingRender = true;
      _ensureGangFocusOutHandler(tab);
      return;
    }
    _doRenderGangTab();
  }, 80);
}

// ── Fragments partagés rebuild complet / patch ciblé ──────────────
function _buildGangStatsHtml(state) {
  const s          = state.stats;
  const _sb        = globalThis._gangSessionStatsBase || {};
  const _isSession = _statsViewMode === 'session';
  const _sv        = k => _isSession ? Math.max(0, (s[k] || 0) - (_sb[k] || 0)) : (s[k] || 0);
  return [
    [state.pokemons.length,                                                      'Possédés'],
    [_sv('totalCaught'),                                                         'Capturés'],
    [_sv('totalSold'),                                                           'Vendus'],
    [_isSession ? _sv('shinyCaught') : globalThis.getShinySpeciesCount?.(),      _isSession ? '✨ Chromas' : '✨ Espèces chroma'],
    [_isSession ? '' : s.shinyCaught,                                            _isSession ? '' : '✨ Chromas (total)'],
    [`${_sv('totalFightsWon')}/${_sv('totalFights')}`,                           'Combats'],
    [`${_sv('totalMoneyEarned').toLocaleString()}₽`,                             'Gains'],
  ].filter(([val]) => val !== '').map(([val, label]) =>
    `<div class="gang-stat-card"><div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>`
  ).join('');
}

function _gangHeaderDexHtml() {
  return `📖 ${globalThis.getDexKantoCaught?.() ?? 0}/${globalThis.KANTO_DEX_SIZE ?? 151} <span style="font-size:8px;opacity:.6">[${globalThis.getDexNationalCaught?.() ?? 0}/${globalThis.NATIONAL_DEX_SIZE ?? 151}]</span>`;
}

function _doRenderGangTab() {
  const tab = document.getElementById('tabGang');
  if (!tab) return;

  // Sauvegarder les positions de scroll avant reconstruction
  const _savedTabScroll  = tab.scrollTop;

  const state      = globalThis.state;
  const g          = state.gang;
  const activeSlot = g.activeBossTeamSlot || 0;
  const teamPks    = (g.bossTeam || []).map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);

  // Boss team tabs
  const SLOT_COSTS = [0, 500_000, 1_000_000];
  const purchased  = g.bossTeamSlotsPurchased || [true, false, false];
  const teamTabsHtml = [0, 1, 2].map(i => {
    const isAct  = i === activeSlot;
    const isPur  = purchased[i];
    const label  = i === 0 ? 'Slot 1' : isPur ? `Slot ${i+1}` : `Slot ${i+1} — ${SLOT_COSTS[i].toLocaleString()}₽`;
    return `<button class="gang-team-slot-tab${isAct ? ' active' : ''}${!isPur ? ' locked' : ''}" data-team-slot="${i}"
      style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;border-radius:var(--radius-sm) var(--radius-sm) 0 0;border:1px solid ${isAct ? 'var(--gold-dim)' : 'var(--border)'};border-bottom:${isAct ? '1px solid var(--bg-panel)' : '1px solid var(--border)'};background:${isAct ? 'var(--bg-panel)' : 'var(--bg)'};color:${isAct ? 'var(--gold)' : 'var(--text-dim)'};cursor:pointer;opacity:${isPur || isAct ? '1' : '.7'}">
      ${!isPur ? '🔒 ' : ''}${label}
    </button>`;
  }).join('');

  const teamHtml = Array.from({length: BOSS_TEAM_SLOTS}, (_, i) => {
    const pk = teamPks[i];
    if (pk) return `<div class="gang-team-slot filled" data-boss-slot="${i}" title="${globalThis.pokemonDisplayName(pk)} Lv.${pk.level}">
      <img src="${globalThis.pokeIcon(pk.species_en)}" style="width:40px;height:30px;image-rendering:pixelated;${pk.shiny ? 'filter:drop-shadow(0 0 3px var(--gold))' : ''}" onerror="this.src='${globalThis.pokeSprite(pk.species_en, pk.shiny)}';this.style.width='40px';this.style.height='40px'">
      <div style="font-size:7px;margin-top:2px;color:${pk.shiny ? 'var(--gold)' : 'var(--text)'}">${globalThis.pokemonDisplayName(pk)}</div>
      <div class="gang-slot-lv" style="font-size:7px;color:var(--text-dim)">Lv.${pk.level}</div>
    </div>`;
    return `<div class="gang-team-slot empty" data-boss-slot="${i}"><span style="font-size:7px;color:var(--text-dim)">Slot ${i+1}</span></div>`;
  }).join('');

  // Stats (fragment partagé avec _patchGangTabDynamic)
  const _isSession = _statsViewMode === 'session';
  const statsHtml  = _buildGangStatsHtml(state);

  const repPct = Math.min(100, g.reputation);

  tab.innerHTML = `
  <div class="gang-card-layout">
    <div class="gang-section-label gang-collapsible-header" data-section="stats" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
      <span>— STATISTIQUES —</span>
      <div style="display:flex;align-items:center;gap:8px">
        <button id="btnToggleStatsView" onclick="event.stopPropagation()" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:${_isSession ? 'var(--gold)' : 'var(--text-dim)'};cursor:pointer">${_isSession ? '⏱ SESSION' : '🌐 GLOBAL'}</button>
        <span class="gang-collapse-arrow" style="font-size:9px;color:var(--text-dim)">${_gangCollapsed.stats ? '▶' : '▼'}</span>
      </div>
    </div>
    <div class="gang-collapsible-body" data-section-body="stats" style="${_gangCollapsed.stats ? 'display:none' : ''}">
      <div class="gang-stats-row">${statsHtml}</div>
    </div>

    <div class="gang-card-header" style="flex-direction:column;gap:0;padding:0">
      <div style="display:flex;align-items:flex-start;gap:14px;padding:14px">
        <div class="gang-boss-sprite">
          ${g.bossSprite ? `<img src="${globalThis.trainerSprite(g.bossSprite)}" style="width:72px;height:72px;image-rendering:pixelated">` : '<div style="width:72px;height:72px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm)"></div>'}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-family:var(--font-pixel);font-size:15px;color:var(--red);line-height:1.3">${g.name}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:2px">Boss : <span style="color:var(--text)">${_esc(g.bossName)}</span></div>
          <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin-top:2px;letter-spacing:.5px">${globalThis.getBossFullTitle?.() || ''}</div>
          ${(() => {
            const tC = globalThis.getTitleLabel?.(g.titleC);
            const tD = globalThis.getTitleLabel?.(g.titleD);
            const badges = [tC, tD].filter(Boolean);
            if (!badges.length) return '';
            const colors = ['#4fc3f7','#ce93d8'];
            return `<div style="display:flex;gap:5px;margin-top:3px;flex-wrap:wrap">${badges.map((b,bi) => `<span style="font-family:var(--font-pixel);font-size:6px;padding:2px 6px;border-radius:10px;border:1px solid ${colors[bi]};color:${colors[bi]}">${b}</span>`).join('')}</div>`;
          })()}
          <button id="btnOpenTitles" style="margin-top:4px;font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">🏆 Titres</button>
          <div style="display:flex;gap:14px;margin-top:6px;flex-wrap:wrap">
            <span id="gangHeaderRep" style="font-size:10px;color:var(--gold)">⭐ ${g.reputation.toLocaleString()}</span>
            <span id="gangHeaderMoney" style="font-size:10px;color:var(--text)">₽ ${g.money.toLocaleString()}</span>
            <span id="gangHeaderDex" style="font-size:10px;color:var(--text-dim)" title="Pokédex Kanto / National">${_gangHeaderDexHtml()}</span>
          </div>
          <div style="margin-top:8px;background:var(--border);border-radius:2px;height:4px;max-width:200px">
            <div id="gangRepBarFill" style="background:var(--gold-dim);height:4px;border-radius:2px;width:${repPct}%;transition:width .5s"></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0">
          <button id="btnExportGang" style="font-family:var(--font-pixel);font-size:7px;padding:5px 8px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">📋 Exporter</button>
          <button id="btnEditBoss"   style="font-family:var(--font-pixel);font-size:7px;padding:5px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">✏ Modifier</button>
        </div>
      </div>
      <div style="border-top:1px solid var(--border);padding:10px 14px 14px">
        <div style="font-family:var(--font-pixel);font-size:7px;color:var(--gold-dim);letter-spacing:1px;margin-bottom:6px">— ÉQUIPE BOSS —</div>
        <div style="display:flex;gap:0;margin-bottom:-1px">${teamTabsHtml}</div>
        <div style="border:1px solid var(--border);border-radius:0 var(--radius-sm) var(--radius-sm) var(--radius-sm);padding:8px;background:var(--bg-panel)">
          <div class="gang-team-row" style="margin-bottom:0">${teamHtml}</div>
        </div>
      </div>
    </div>

    <div class="gang-section-label gang-collapsible-header" data-section="services" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
      <span>— SERVICES —</span><span class="gang-collapse-arrow" style="font-size:9px;color:var(--text-dim)">${_gangCollapsed.services ? '▶' : '▼'}</span>
    </div>
    <div class="gang-collapsible-body" data-section-body="services" style="${_gangCollapsed.services ? 'display:none' : ''}">
      <div style="padding:0 2px 8px;display:flex;flex-direction:column;gap:8px">${_buildServicesHtml(state)}</div>
    </div>

    <a href="/gang/" id="btnOpenGangCustomization" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:4px;padding:14px;background:var(--bg-card);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);text-decoration:none;cursor:pointer">
      <div>
        <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">🎨 Personnalisation</div>
        <div style="font-size:9px;color:var(--text-dim);margin-top:3px">Musique, apparence, titre, vitrine — pokegang.sterenna.fr/gang</div>
      </div>
      <span style="font-family:var(--font-pixel);font-size:12px;color:var(--gold-dim)">→</span>
    </a>

    <div style="margin-top:16px;text-align:center;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);letter-spacing:1px;opacity:.5">${globalThis.GAME_VERSION || ''}</div>
  </div>`;

  // Restaurer le scroll du tab immédiatement après reconstruction
  tab.scrollTop = _savedTabScroll;

  // Collapsible toggles
  tab.querySelectorAll('.gang-collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.dataset.section;
      _gangCollapsed[section] = !_gangCollapsed[section];
      const body  = tab.querySelector(`[data-section-body="${section}"]`);
      const arrow = header.querySelector('.gang-collapse-arrow');
      if (body)  body.style.display  = _gangCollapsed[section] ? 'none' : '';
      if (arrow) arrow.textContent   = _gangCollapsed[section] ? '▶' : '▼';
    });
  });

  // Stats toggle
  tab.querySelector('#btnToggleStatsView')?.addEventListener('click', e => {
    e.stopPropagation();
    _statsViewMode = _statsViewMode === 'session' ? 'global' : 'session';
    renderGangTab();
  });

  // Auto-sell mode radios
  tab.querySelectorAll('input[name="autoSellMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (!globalThis.state.settings.autoSellAgent) globalThis.state.settings.autoSellAgent = { mode: 'all', potentials: [] };
      globalThis.state.settings.autoSellAgent.mode = radio.value;
      _save(); renderGangTab();
    });
  });
  tab.querySelectorAll('.autoSellPot').forEach(cb => {
    cb.addEventListener('change', () => {
      if (!globalThis.state.settings.autoSellAgent) globalThis.state.settings.autoSellAgent = { mode: 'by_potential', potentials: [] };
      const pot  = parseInt(cb.value);
      const pots = globalThis.state.settings.autoSellAgent.potentials || [];
      globalThis.state.settings.autoSellAgent.potentials = cb.checked
        ? [...new Set([...pots, pot])] : pots.filter(p => p !== pot);
      _save();
    });
  });

  // Services handlers
  tab.querySelector('#btnBuyScientist')?.addEventListener('click', () => {
    const st = globalThis.state;
    if (st.gang.money < 15_000) { _notify('Fonds insuffisants.', 'error'); return; }
    globalThis.showConfirm('Engager le <b>Scientifique peu scrupuleux</b> pour <b>15 000₽</b> ?', () => {
      st.gang.money -= 15_000; st.purchases.scientist = true; st.purchases.scientistEnabled = true;
      _save(); _topBar(); globalThis.SFX.play('unlock');
      _notify('🧬 Le scientifique est en poste !', 'gold'); renderGangTab();
    }, null, { confirmLabel: 'Engager', cancelLabel: 'Annuler' });
  });
  tab.querySelector('#btnToggleScientist')?.addEventListener('click', () => {
    const st = globalThis.state;
    st.purchases.scientistEnabled = st.purchases.scientistEnabled === false;
    _save();
    _notify(st.purchases.scientistEnabled !== false ? '🧬 Scientifique rappelé !' : '🚫 Scientifique renvoyé.', 'success');
    renderGangTab();
  });

  tab.querySelector('#btnBuyAutoCollect')?.addEventListener('click', () => {
    const st = globalThis.state;
    if (st.gang.money < 100_000) { _notify('Fonds insuffisants.', 'error'); return; }
    globalThis.showConfirm('Acheter la <b>Récolte automatique</b> pour <b>100 000₽</b> ?', () => {
      st.gang.money -= 100_000; st.purchases.autoCollect = true; st.purchases.autoCollectEnabled = true;
      _save(); _topBar(); globalThis.SFX.play('unlock');
      _notify('🪙 Récolte automatique activée !', 'gold'); renderGangTab();
    }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
  });
  tab.querySelector('#btnToggleAutoCollect')?.addEventListener('click', () => {
    const st = globalThis.state;
    st.purchases.autoCollectEnabled = st.purchases.autoCollectEnabled === false;
    _save();
    _notify(st.purchases.autoCollectEnabled !== false ? '🪙 Récolte automatique activée !' : '🚫 Récolte automatique désactivée.', '');
    renderGangTab();
  });

  tab.querySelector('#btnBuyAutoSellAgent')?.addEventListener('click', () => {
    const st = globalThis.state;
    if (st.gang.money < 10_000_000) { _notify('Fonds insuffisants.', 'error'); return; }
    globalThis.showConfirm('Acheter la <b>Vente automatique</b> pour <b>10 000 000₽</b> ?', () => {
      st.gang.money -= 10_000_000; st.purchases.autoSellAgent = true; st.purchases.autoSellAgentEnabled = true;
      if (!st.settings.autoSellAgent) st.settings.autoSellAgent = { mode: 'all', potentials: [] };
      _save(); _topBar(); globalThis.SFX.play('unlock');
      _notify('🤖 Vente automatique activée !', 'gold'); renderGangTab();
    }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
  });
  tab.querySelector('#btnToggleAutoSellAgent')?.addEventListener('click', () => {
    const st = globalThis.state;
    st.purchases.autoSellAgentEnabled = st.purchases.autoSellAgentEnabled === false;
    _save();
    _notify(st.purchases.autoSellAgentEnabled !== false ? '🤖 Vente automatique activée !' : '🚫 Vente automatique désactivée.', '');
    renderGangTab();
  });

  tab.querySelector('#btnBuyNurse')?.addEventListener('click', () => {
    const st = globalThis.state;
    if (st.gang.money < 300_000) { _notify('Fonds insuffisants.', 'error'); return; }
    globalThis.showConfirm("Embaucher l'<b>Infirmière Joëlle</b> pour <b>300 000₽</b> ?", () => {
      st.gang.money -= 300_000; st.purchases.autoIncubator = true; st.purchases.autoIncubatorEnabled = true;
      _save(); _topBar(); globalThis.SFX.play('unlock');
      _notify('💉 Joëlle est en poste !', 'gold'); renderGangTab();
    }, null, { confirmLabel: 'Embaucher', cancelLabel: 'Annuler' });
  });
  tab.querySelector('#btnToggleNurse')?.addEventListener('click', () => {
    const st = globalThis.state;
    st.purchases.autoIncubatorEnabled = st.purchases.autoIncubatorEnabled === false;
    _save();
    _notify(st.purchases.autoIncubatorEnabled !== false ? '💉 Joëlle est de retour !' : '💤 Joëlle en congé.', '');
    renderGangTab();
  });

  const SPECIAL_DEFS = {
    title_richissime:      { cost: 5_000_000,  label: 'Titre "Richissime"' },
    title_doublerichissim: { cost: 10_000_000, label: 'Titre "Double Richissime"' },
    chromaCharm:           { cost: 5_000_000,  label: 'Charme Chroma' },
  };
  tab.querySelectorAll('.btn-special-buy').forEach(btn => {
    btn.addEventListener('click', () => {
      const spId = btn.dataset.spId;
      const def  = SPECIAL_DEFS[spId];
      if (!def) return;
      const st = globalThis.state;
      if (st.gang.money < def.cost) { _notify('Fonds insuffisants.', 'error'); return; }
      globalThis.showConfirm(`Acheter <b>${def.label}</b> pour <b>${def.cost.toLocaleString()}₽</b> ?`, () => {
        st.gang.money -= def.cost;
        st.purchases[spId] = true;
        if (spId === 'title_richissime') {
          if (!st.unlockedTitles) st.unlockedTitles = [];
          if (!st.unlockedTitles.includes('richissime')) st.unlockedTitles.push('richissime');
        } else if (spId === 'title_doublerichissim') {
          if (!st.unlockedTitles) st.unlockedTitles = [];
          if (!st.unlockedTitles.includes('doublerichissim')) st.unlockedTitles.push('doublerichissim');
        }
        _save(); _topBar(); globalThis.SFX.play('unlock');
        _notify(`✨ ${def.label} débloqué !`, 'gold'); renderGangTab();
      }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
    });
  });

  // Header buttons
  tab.querySelector('#btnOpenTitles')?.addEventListener('click', () => globalThis.openTitleModal?.());
  tab.querySelector('#btnExportGang')?.addEventListener('click', () => globalThis._gbase_openExportModal?.());
  tab.querySelector('#btnEditBoss')?.addEventListener('click', () => globalThis.openBossEditModal?.(() => renderGangTab()));

  // Boss team slot tabs
  tab.querySelectorAll('.gang-team-slot-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const st      = globalThis.state;
      const slotIdx = parseInt(btn.dataset.teamSlot);
      const isPur   = (st.gang.bossTeamSlotsPurchased || [true, false, false])[slotIdx];
      if (!isPur) {
        const cost = SLOT_COSTS[slotIdx];
        globalThis.showConfirm(`Débloquer le Slot ${slotIdx + 1} pour ${cost.toLocaleString()}₽ ?`, () => {
          if (st.gang.money < cost) { _notify('Fonds insuffisants.', 'error'); globalThis.SFX.play('error'); return; }
          st.gang.money -= cost;
          st.gang.bossTeamSlotsPurchased[slotIdx] = true;
          st.gang.activeBossTeamSlot = slotIdx;
          st.gang.bossTeam = [...(st.gang.bossTeamSlots[slotIdx] || [])];
          _save(); _topBar(); globalThis.SFX.play('unlock'); renderGangTab();
        }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' }); return;
      }
      st.gang.activeBossTeamSlot = slotIdx;
      st.gang.bossTeam = [...(st.gang.bossTeamSlots[slotIdx] || [])];
      _save(); renderGangTab();
    });
  });

  // Boss team slots
  tab.querySelectorAll('.gang-team-slot').forEach(el => {
    el.addEventListener('click', () => {
      const st = globalThis.state;
      const i  = parseInt(el.dataset.bossSlot);
      if (el.classList.contains('filled')) {
        st.gang.bossTeam.splice(i, 1);
        st.gang.bossTeamSlots[st.gang.activeBossTeamSlot || 0] = [...st.gang.bossTeam];
        _save(); renderGangTab();
      } else {
        globalThis.openTeamPickerModal?.(i, () => renderGangTab());
      }
    });
  });

}

// ── Patch ciblé des valeurs dynamiques ────────────────────────────
// Pendant l'activité background (agents qui combattent/capturent), seuls les
// chiffres bougent : stats, argent/rep du header, niveaux équipe.
// On met à jour ces nœuds en place au lieu de reconstruire les ~1100 lignes de
// HTML du tab à chaque rafale d'events. Le rebuild complet reste réservé aux
// changements structurels : composition d'équipe modifiée (vente d'un Pokémon
// exposé) — détecté ici et dérouté vers renderGangTab().
function _patchGangTabDynamic() {
  if (globalThis.activeTab !== 'tabGang') return;
  const tab = document.getElementById('tabGang');
  if (!tab) return;
  const state = globalThis.state;
  const g     = state.gang;

  const statsRow = tab.querySelector('.gang-stats-row');
  if (!statsRow) { renderGangTab(); return; } // structure inattendue → rebuild
  statsRow.innerHTML = _buildGangStatsHtml(state);

  const repEl = tab.querySelector('#gangHeaderRep');
  if (repEl) repEl.textContent = `⭐ ${g.reputation.toLocaleString()}`;
  const moneyEl = tab.querySelector('#gangHeaderMoney');
  if (moneyEl) moneyEl.textContent = `₽ ${g.money.toLocaleString()}`;
  const dexEl = tab.querySelector('#gangHeaderDex');
  if (dexEl) dexEl.innerHTML = _gangHeaderDexHtml();
  const repFill = tab.querySelector('#gangRepBarFill');
  if (repFill) repFill.style.width = `${Math.min(100, g.reputation)}%`;

  // Équipe boss : niveaux (XP passif/combats). Si la composition a changé
  // sous nos pieds (slot rempli↔vide), c'est structurel → rebuild.
  let structural = false;
  const teamPks = (g.bossTeam || []).map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
  tab.querySelectorAll('.gang-team-slot[data-boss-slot]').forEach(el => {
    const i  = parseInt(el.dataset.bossSlot, 10);
    const pk = teamPks[i];
    if (!!pk !== el.classList.contains('filled')) { structural = true; return; }
    if (pk) {
      const lv = el.querySelector('.gang-slot-lv');
      if (lv) lv.textContent = `Lv.${pk.level}`;
    }
  });
  if (structural) renderGangTab();
}

// ── Refresh automatique via EventBus ──────────────────────────────────────────
// Filet de sécurité : ces événements changent des données affichées dans le tab
// (argent, rep, stats de captures/ventes/combats) et doivent le rafraîchir
// quel que soit l'endroit du code qui les déclenche — plutôt que de compter sur
// un appel manuel `if (activeTab === 'tabGang') renderGangTab()` ajouté à la main
// à chaque nouveau point d'entrée (source d'oublis constatée dans agent.js,
// zoneWindows.js, etc.). Les cas plus spécifiques (loot de coffre, promotion
// d'agent, déblocage de titre) restent gérés par leurs appels directs existants.
// Debounce dédié : avec plusieurs agents actifs en arrière-plan, ces events
// arrivent en rafale — on regroupe la rafale en UN patch ciblé (pas un rebuild,
// voir _patchGangTabDynamic). Le chemin des clics utilisateur (renderGangTab()
// appelé directement depuis les handlers du tab) garde son rebuild complet.
const GANG_TAB_EVENT_DEBOUNCE_MS = 400;
let _gangTabEventDebounceTimer = null;

let _gangTabEventsRegistered = false;
function _registerGangTabEvents() {
  if (_gangTabEventsRegistered) return;
  _gangTabEventsRegistered = true;
  const _refreshIfActive = () => {
    if (globalThis.activeTab !== 'tabGang') return;
    clearTimeout(_gangTabEventDebounceTimer);
    _gangTabEventDebounceTimer = setTimeout(_patchGangTabDynamic, GANG_TAB_EVENT_DEBOUNCE_MS);
  };
  EventBus.on(EVENTS.MONEY_CHANGED,    _refreshIfActive);
  EventBus.on(EVENTS.REP_CHANGED,      _refreshIfActive);
  EventBus.on(EVENTS.POKEMON_CAPTURED, _refreshIfActive);
  EventBus.on(EVENTS.POKEMON_SOLD,     _refreshIfActive);
  EventBus.on(EVENTS.COMBAT_WON,       _refreshIfActive);
}
_registerGangTabEvents();

Object.assign(globalThis, {
  _gtab_renderGangTab: renderGangTab,
  lockGangTab,
  unlockGangTab,
});
