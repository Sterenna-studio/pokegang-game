'use strict';

import { BOSS_TEAM_SLOTS } from '../../data/game-config-data.js';
import { EventBus, EVENTS } from '../core/eventBus.js';
import { esc as _esc } from '../core/escape.js';
import { deferSimulationUi } from '../core/simulationContext.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });
const _dirty  = ()               => EventBus.emit(EVENTS.STATE_DIRTY);
const _topBar = ()               => EventBus.emit(EVENTS.UI_TOPBAR_UPDATE);
const _save   = ()               => globalThis.saveState?.();
const _t = (fr, en) => (globalThis.state?.lang === 'en' ? en : fr);

// deps (globalThis): state, notify, saveState, updateTopBar, switchTab, showConfirm, SFX,
//   pokeSprite, pokeIcon, trainerSprite, pokemonDisplayName,
//   getBossFullTitle, getTitleLabel, getShinySpeciesCount,
//   getDexKantoCaught, getDexNationalCaught, KANTO_DEX_SIZE, NATIONAL_DEX_SIZE,
//   GAME_VERSION, openBossEditModal, openTeamPickerModal,
//   openNameModal, openSpritePicker, _gbase_openExportModal

const _gangCollapsed = { services: false, stats: false };
let _statsViewMode = 'session';

let _gangTabTimer         = null;
let _gangTabPendingRender = false;
let _gangFocusOutWired    = false;

function _ensureGangFocusOutHandler(tab) {
  if (_gangFocusOutWired) return;
  _gangFocusOutWired = true;
  tab.addEventListener('focusout', function onFocusOut(e) {
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
      <div style="font-family:var(--font-pixel);font-size:8px;color:${ownAC ? (enAC ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">${_t('Récolte automatique', 'Auto collect')}</div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">${_t('Collecte les revenus de zone sans animation. Combat calculé en arrière-plan.', 'Collects zone earnings without animation. Battle computed in background.')}</div>
      ${ownAC
        ? `<div style="display:flex;align-items:center;gap:8px">
             <span style="font-family:var(--font-pixel);font-size:7px;color:${enAC ? 'var(--green)' : 'var(--text-dim)'}">${enAC ? _t('✓ ACTIVE', '✓ ACTIVE') : _t('✗ INACTIVE', '✗ INACTIVE')}</span>
             <button id="btnToggleAutoCollect" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${enAC ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${enAC ? 'var(--red)' : 'var(--green)'};cursor:pointer">${enAC ? _t('Désactiver', 'Disable') : _t('Activer', 'Enable')}</button>
           </div>`
        : `<button id="btnBuyAutoCollect" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">${_t('Acheter — 100 000₽', 'Buy — 100,000₽')}</button>`}
    </div>
  </div>`);

  // Auto sell agent
  const ownAS = !!state.purchases.autoSellAgent;
  const enAS  = state.purchases.autoSellAgentEnabled !== false;
  parts.push(`<div style="background:var(--bg);border:1px solid ${ownAS ? (enAS ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
    <div style="font-size:22px;flex-shrink:0;${ownAS && !enAS ? 'opacity:.4;filter:grayscale(1)' : ''}">🤖</div>
    <div style="flex:1">
      <div style="font-family:var(--font-pixel);font-size:8px;color:${ownAS ? (enAS ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">${_t('Vente automatique (captures agent)', 'Auto-sell (agent catches)')}</div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">${_t('Vend automatiquement les Pokémon capturés par les agents. Shinies toujours protégés.', 'Automatically sells Pokémon caught by agents. Shinies are always protected.')}</div>
      ${ownAS
        ? `<div style="display:flex;flex-direction:column;gap:6px">
             <div style="display:flex;align-items:center;gap:8px">
               <span style="font-family:var(--font-pixel);font-size:7px;color:${enAS ? 'var(--green)' : 'var(--text-dim)'}">${enAS ? _t('✓ ACTIVE', '✓ ACTIVE') : _t('✗ INACTIVE', '✗ INACTIVE')}</span>
               <button id="btnToggleAutoSellAgent" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${enAS ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${enAS ? 'var(--red)' : 'var(--green)'};cursor:pointer">${enAS ? _t('Désactiver', 'Disable') : _t('Activer', 'Enable')}</button>
             </div>
             <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
               <label style="display:flex;align-items:center;gap:4px;font-size:8px;cursor:pointer"><input type="radio" name="autoSellMode" value="all" ${(state.settings.autoSellAgent?.mode || 'all') === 'all' ? 'checked' : ''}> ${_t('Tout vendre', 'Sell all')}</label>
               <label style="display:flex;align-items:center;gap:4px;font-size:8px;cursor:pointer"><input type="radio" name="autoSellMode" value="by_potential" ${state.settings.autoSellAgent?.mode === 'by_potential' ? 'checked' : ''}> ${_t('Par potentiel', 'By potential')}</label>
             </div>
             ${state.settings.autoSellAgent?.mode === 'by_potential' ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${[1,2,3,4,5].map(p => `<label style="display:flex;align-items:center;gap:3px;font-size:8px;cursor:pointer"><input type="checkbox" class="autoSellPot" value="${p}" ${(state.settings.autoSellAgent?.potentials || []).includes(p) ? 'checked' : ''}> ${'★'.repeat(p)}</label>`).join('')}</div>` : ''}
           </div>`
        : `<button id="btnBuyAutoSellAgent" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">${_t('Acheter — 10 000 000₽', 'Buy — 10,000,000₽')}</button>`}
    </div>
  </div>`);

  // Nurse
  const ownN = !!state.purchases.autoIncubator;
  const enN  = state.purchases.autoIncubatorEnabled !== false;
  parts.push(`<div style="background:var(--bg);border:1px solid ${ownN ? (enN ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
    <img src="${globalThis.trainerSprite('nurse')}" style="width:36px;height:36px;image-rendering:pixelated;flex-shrink:0;${ownN && !enN ? 'opacity:.4;filter:grayscale(1)' : ''}" onerror="this.style.display='none'">
    <div style="flex:1">
      <div style="font-family:var(--font-pixel);font-size:8px;color:${ownN ? (enN ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">${_t('Infirmière Joëlle corrompue', 'Corrupted Nurse Joy')}</div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">${_t('Auto-incube les œufs dès qu\'un incubateur est libre.', 'Auto-incubates eggs as soon as an incubator is free.')}</div>
      ${ownN
        ? `<div style="display:flex;align-items:center;gap:8px">
             <span style="font-family:var(--font-pixel);font-size:7px;color:${enN ? 'var(--green)' : 'var(--text-dim)'}">${enN ? _t('✓ EN POSTE', '✓ ON DUTY') : _t('✗ CONGÉ', '✗ OFF DUTY')}</span>
             <button id="btnToggleNurse" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${enN ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${enN ? 'var(--red)' : 'var(--green)'};cursor:pointer">${enN ? _t('Mettre en congé', 'Send on leave') : _t('Rappeler', 'Recall')}</button>
           </div>`
        : `<button id="btnBuyNurse" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">${_t('Embaucher — 300 000₽', 'Hire — 300,000₽')}</button>`}
    </div>
  </div>`);

  // Scientist
  const ownSc = !!state.purchases.scientist;
  const enSc  = state.purchases.scientistEnabled !== false;
  parts.push(`<div style="background:var(--bg);border:1px solid ${ownSc ? (enSc ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:10px;align-items:flex-start">
    <img src="${globalThis.trainerSprite('scientist')}" style="width:36px;height:36px;image-rendering:pixelated;flex-shrink:0;${ownSc && !enSc ? 'opacity:.4;filter:grayscale(1)' : ''}" onerror="this.style.display='none'">
    <div style="flex:1">
      <div style="font-family:var(--font-pixel);font-size:8px;color:${ownSc ? (enSc ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:3px">${_t('Scientifique peu scrupuleux', 'Unscrupulous Scientist')}</div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">${_t('Révèle l\'espèce des œufs (10k₽) · Mutation artificielle : sacrifice ★★★★★ même espèce pour potentiel max.', 'Reveals egg species (10k₽) · Artificial mutation: sacrifice ★★★★★ same species for max potential.')}</div>
      ${ownSc
        ? `<div style="display:flex;align-items:center;gap:8px">
             <span style="font-family:var(--font-pixel);font-size:7px;color:${enSc ? 'var(--green)' : 'var(--text-dim)'}">${enSc ? _t('✓ EN POSTE', '✓ ON DUTY') : _t('✗ RENVOYÉ', '✗ DISMISSED')}</span>
             <button id="btnToggleScientist" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid ${enSc ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${enSc ? 'var(--red)' : 'var(--green)'};cursor:pointer">${enSc ? _t('Renvoyer', 'Dismiss') : _t('Rappeler', 'Recall')}</button>
           </div>`
        : `<button id="btnBuyScientist" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">${_t('Engager — 15 000₽', 'Hire — 15,000₽')}</button>`}
    </div>
  </div>`);

  // Special purchases
  const SPECIALS = [
    { id:'title_richissime',      icon:'💰',
      labelFr:'Titre "Richissime"',         labelEn:'Title "Filthy Rich"',
      descFr:'Débloque le titre légendaire. Ostentation maximale.',  descEn:'Unlocks the legendary title. Maximum ostentation.',
      cost:5_000_000,
      owned: () => !!state.purchases.title_richissime || (state.unlockedTitles||[]).includes('richissime') },
    { id:'title_doublerichissim', icon:'💎',
      labelFr:'Titre "Double Richissime"',  labelEn:'Title "Double Filthy Rich"',
      descFr:'Débloque le titre ultime. Noblesse oblige.',           descEn:'Unlocks the ultimate title. Noblesse oblige.',
      cost:10_000_000,
      owned: () => !!state.purchases.title_doublerichissim || (state.unlockedTitles||[]).includes('doublerichissim') },
    { id:'chromaCharm',           icon:'✨',
      labelFr:'Charme Chroma',              labelEn:'Shiny Charm',
      descFr:'Double le taux de Pokémon chromatiques. Permanent.',   descEn:'Doubles the shiny Pokémon rate. Permanent.',
      cost:5_000_000,
      owned: () => !!state.purchases.chromaCharm },
  ];
  parts.push(`<div>
    <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin:4px 0 6px;letter-spacing:1px">🛒 ${_t('ACHATS SPÉCIAUX', 'SPECIAL PURCHASES')}</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${SPECIALS.map(sp => {
        const own   = sp.owned();
        const label = _t(sp.labelFr, sp.labelEn);
        const desc  = _t(sp.descFr,  sp.descEn);
        return `<div style="background:var(--bg);border:1px solid ${own ? 'var(--green)' : 'var(--border)'};border-radius:var(--radius-sm);padding:8px;display:flex;gap:10px;align-items:center">
          <div style="font-size:20px;flex-shrink:0">${sp.icon}</div>
          <div style="flex:1">
            <div style="font-family:var(--font-pixel);font-size:8px;color:${own ? 'var(--green)' : 'var(--text)'};margin-bottom:2px">${label}</div>
            <div style="font-size:7px;color:var(--text-dim)">${desc}</div>
          </div>
          ${own
            ? `<div style="font-family:var(--font-pixel);font-size:7px;color:var(--green);white-space:nowrap">${_t('✓ ACTIF', '✓ ACTIVE')}</div>`
            : `<button class="btn-special-buy" data-sp-id="${sp.id}" style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;white-space:nowrap">${sp.cost.toLocaleString()}₽</button>`}
        </div>`;
      }).join('')}
    </div>
  </div>`);

  return parts.join('');
}

// ── Main Gang tab ─────────────────────────────────────────────────────────────
function renderGangTab() {
  if (_gangTabTimer) { clearTimeout(_gangTabTimer); _gangTabTimer = null; }
  _gangTabTimer = setTimeout(() => {
    _gangTabTimer = null;
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

function _buildGangStatsHtml(state) {
  const s          = state.stats;
  const _sb        = globalThis._gangSessionStatsBase || {};
  const _isSession = _statsViewMode === 'session';
  const _sv        = k => _isSession ? Math.max(0, (s[k] || 0) - (_sb[k] || 0)) : (s[k] || 0);
  return [
    [state.pokemons.length,                                                      _t('Possédés',           'Owned')],
    [_sv('totalCaught'),                                                         _t('Capturés',           'Caught')],
    [_sv('totalSold'),                                                           _t('Vendus',             'Sold')],
    [_isSession ? _sv('shinyCaught') : globalThis.getShinySpeciesCount?.(),      _isSession ? _t('✨ Chromas', '✨ Shinies') : _t('✨ Espèces chroma', '✨ Shiny species')],
    [_isSession ? '' : s.shinyCaught,                                            _isSession ? '' : _t('✨ Chromas (total)', '✨ Shinies (total)')],
    [`${_sv('totalFightsWon')}/${_sv('totalFights')}`,                           _t('Combats',            'Battles')],
    [`${_sv('totalMoneyEarned').toLocaleString()}₽`,                             _t('Gains',              'Earnings')],
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

  const _savedTabScroll = tab.scrollTop;
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

  const _isSession = _statsViewMode === 'session';
  const statsHtml  = _buildGangStatsHtml(state);
  const repPct     = Math.min(100, g.reputation);

  tab.innerHTML = `
  <div class="gang-card-layout">
    <div class="gang-section-label gang-collapsible-header" data-section="stats" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
      <span>— ${_t('STATISTIQUES', 'STATISTICS')} —</span>
      <div style="display:flex;align-items:center;gap:8px">
        <button id="btnToggleStatsView" onclick="event.stopPropagation()" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:${_isSession ? 'var(--gold)' : 'var(--text-dim)'};cursor:pointer">${_isSession ? _t('⏱ SESSION', '⏱ SESSION') : _t('🌐 GLOBAL', '🌐 GLOBAL')}</button>
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
          <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${_t('Boss', 'Boss')} : <span style="color:var(--text)">${_esc(g.bossName)}</span></div>
          <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin-top:2px;letter-spacing:.5px">${globalThis.getBossFullTitle?.() || ''}</div>
          ${(() => {
            const tC = globalThis.getTitleLabel?.(g.titleC);
            const tD = globalThis.getTitleLabel?.(g.titleD);
            const badges = [tC, tD].filter(Boolean);
            if (!badges.length) return '';
            const colors = ['#4fc3f7','#ce93d8'];
            return `<div style="display:flex;gap:5px;margin-top:3px;flex-wrap:wrap">${badges.map((b,bi) => `<span style="font-family:var(--font-pixel);font-size:6px;padding:2px 6px;border-radius:10px;border:1px solid ${colors[bi]};color:${colors[bi]}">${b}</span>`).join('')}</div>`;
          })()}
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
          <button id="btnExportGang" style="font-family:var(--font-pixel);font-size:7px;padding:5px 8px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">📋 ${_t('Exporter', 'Export')}</button>
          <button id="btnEditBoss"   style="font-family:var(--font-pixel);font-size:7px;padding:5px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">✏ ${_t('Modifier', 'Edit')}</button>
        </div>
      </div>
      <div style="border-top:1px solid var(--border);padding:10px 14px 14px">
        <div style="font-family:var(--font-pixel);font-size:7px;color:var(--gold-dim);letter-spacing:1px;margin-bottom:6px">— ${_t('ÉQUIPE BOSS', 'BOSS TEAM')} —</div>
        <div style="display:flex;gap:0;margin-bottom:-1px">${teamTabsHtml}</div>
        <div style="border:1px solid var(--border);border-radius:0 var(--radius-sm) var(--radius-sm) var(--radius-sm);padding:8px;background:var(--bg-panel)">
          <div class="gang-team-row" style="margin-bottom:0">${teamHtml}</div>
        </div>
      </div>
    </div>

    <div class="gang-section-label gang-collapsible-header" data-section="services" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none">
      <span>— ${_t('SERVICES', 'SERVICES')} —</span><span class="gang-collapse-arrow" style="font-size:9px;color:var(--text-dim)">${_gangCollapsed.services ? '▶' : '▼'}</span>
    </div>
    <div class="gang-collapsible-body" data-section-body="services" style="${_gangCollapsed.services ? 'display:none' : ''}">
      <div style="padding:0 2px 8px;display:flex;flex-direction:column;gap:8px">${_buildServicesHtml(state)}</div>
    </div>

    <a href="https://pokegang.sterenna.fr/gang/" target="_blank" rel="noopener" id="btnOpenGangCustomization" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:4px;padding:14px;background:var(--bg-card);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);text-decoration:none;cursor:pointer">
      <div>
        <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">🎨 ${_t('Personnalisation', 'Customisation')}</div>
        <div style="font-size:9px;color:var(--text-dim);margin-top:3px">${_t('Musique, apparence, titre, vitrine — pokegang.sterenna.fr/gang', 'Music, appearance, title, showcase — pokegang.sterenna.fr/gang')}</div>
      </div>
      <span style="font-family:var(--font-pixel);font-size:12px;color:var(--gold-dim)">→</span>
    </a>

    <div style="margin-top:16px;text-align:center;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);letter-spacing:1px;opacity:.5">${globalThis.GAME_VERSION || ''}</div>
  </div>`;

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
    if (st.gang.money < 15_000) { _notify(_t('Fonds insuffisants.', 'Insufficient funds.'), 'error'); return; }
    globalThis.showConfirm(_t('Engager le <b>Scientifique peu scrupuleux</b> pour <b>15 000₽</b> ?', 'Hire the <b>Unscrupulous Scientist</b> for <b>15,000₽</b>?'), () => {
      st.gang.money -= 15_000; st.purchases.scientist = true; st.purchases.scientistEnabled = true;
      _save(); _topBar(); globalThis.SFX.play('unlock');
      _notify(_t('🧬 Le scientifique est en poste !', '🧬 The scientist is on duty!'), 'gold'); renderGangTab();
    }, null, { confirmLabel: _t('Engager', 'Hire'), cancelLabel: _t('Annuler', 'Cancel') });
  });
  tab.querySelector('#btnToggleScientist')?.addEventListener('click', () => {
    const st = globalThis.state;
    st.purchases.scientistEnabled = st.purchases.scientistEnabled === false;
    _save();
    _notify(st.purchases.scientistEnabled !== false ? _t('🧬 Scientifique rappelé !', '🧬 Scientist recalled!') : _t('🚫 Scientifique renvoyé.', '🚫 Scientist dismissed.'), 'success');
    renderGangTab();
  });

  tab.querySelector('#btnBuyAutoCollect')?.addEventListener('click', () => {
    const st = globalThis.state;
    if (st.gang.money < 100_000) { _notify(_t('Fonds insuffisants.', 'Insufficient funds.'), 'error'); return; }
    globalThis.showConfirm(_t('Acheter la <b>Récolte automatique</b> pour <b>100 000₽</b> ?', 'Buy <b>Auto collect</b> for <b>100,000₽</b>?'), () => {
      st.gang.money -= 100_000; st.purchases.autoCollect = true; st.purchases.autoCollectEnabled = true;
      _save(); _topBar(); globalThis.SFX.play('unlock');
      _notify(_t('🪙 Récolte automatique activée !', '🪙 Auto collect enabled!'), 'gold'); renderGangTab();
    }, null, { confirmLabel: _t('Acheter', 'Buy'), cancelLabel: _t('Annuler', 'Cancel') });
  });
  tab.querySelector('#btnToggleAutoCollect')?.addEventListener('click', () => {
    const st = globalThis.state;
    st.purchases.autoCollectEnabled = st.purchases.autoCollectEnabled === false;
    _save();
    _notify(st.purchases.autoCollectEnabled !== false ? _t('🪙 Récolte automatique activée !', '🪙 Auto collect enabled!') : _t('🚫 Récolte automatique désactivée.', '🚫 Auto collect disabled.'), '');
    renderGangTab();
  });

  tab.querySelector('#btnBuyAutoSellAgent')?.addEventListener('click', () => {
    const st = globalThis.state;
    if (st.gang.money < 10_000_000) { _notify(_t('Fonds insuffisants.', 'Insufficient funds.'), 'error'); return; }
    globalThis.showConfirm(_t('Acheter la <b>Vente automatique</b> pour <b>10 000 000₽</b> ?', 'Buy <b>Auto-sell</b> for <b>10,000,000₽</b>?'), () => {
      st.gang.money -= 10_000_000; st.purchases.autoSellAgent = true; st.purchases.autoSellAgentEnabled = true;
      if (!st.settings.autoSellAgent) st.settings.autoSellAgent = { mode: 'all', potentials: [] };
      _save(); _topBar(); globalThis.SFX.play('unlock');
      _notify(_t('🤖 Vente automatique activée !', '🤖 Auto-sell enabled!'), 'gold'); renderGangTab();
    }, null, { confirmLabel: _t('Acheter', 'Buy'), cancelLabel: _t('Annuler', 'Cancel') });
  });
  tab.querySelector('#btnToggleAutoSellAgent')?.addEventListener('click', () => {
    const st = globalThis.state;
    st.purchases.autoSellAgentEnabled = st.purchases.autoSellAgentEnabled === false;
    _save();
    _notify(st.purchases.autoSellAgentEnabled !== false ? _t('🤖 Vente automatique activée !', '🤖 Auto-sell enabled!') : _t('🚫 Vente automatique désactivée.', '🚫 Auto-sell disabled.'), '');
    renderGangTab();
  });

  tab.querySelector('#btnBuyNurse')?.addEventListener('click', () => {
    const st = globalThis.state;
    if (st.gang.money < 300_000) { _notify(_t('Fonds insuffisants.', 'Insufficient funds.'), 'error'); return; }
    globalThis.showConfirm(_t("Embaucher l'<b>Infirmière Joëlle</b> pour <b>300 000₽</b> ?", 'Hire <b>Nurse Joy</b> for <b>300,000₽</b>?'), () => {
      st.gang.money -= 300_000; st.purchases.autoIncubator = true; st.purchases.autoIncubatorEnabled = true;
      _save(); _topBar(); globalThis.SFX.play('unlock');
      _notify(_t('💉 Joëlle est en poste !', '💉 Nurse Joy is on duty!'), 'gold'); renderGangTab();
    }, null, { confirmLabel: _t('Embaucher', 'Hire'), cancelLabel: _t('Annuler', 'Cancel') });
  });
  tab.querySelector('#btnToggleNurse')?.addEventListener('click', () => {
    const st = globalThis.state;
    st.purchases.autoIncubatorEnabled = st.purchases.autoIncubatorEnabled === false;
    _save();
    _notify(st.purchases.autoIncubatorEnabled !== false ? _t('💉 Joëlle est de retour !', '💉 Nurse Joy is back!') : _t('💤 Joëlle en congé.', '💤 Nurse Joy on leave.'), '');
    renderGangTab();
  });

  const SPECIAL_DEFS = {
    title_richissime:      { cost: 5_000_000,  labelFr: 'Titre "Richissime"',         labelEn: 'Title "Filthy Rich"' },
    title_doublerichissim: { cost: 10_000_000, labelFr: 'Titre "Double Richissime"',  labelEn: 'Title "Double Filthy Rich"' },
    chromaCharm:           { cost: 5_000_000,  labelFr: 'Charme Chroma',              labelEn: 'Shiny Charm' },
  };
  tab.querySelectorAll('.btn-special-buy').forEach(btn => {
    btn.addEventListener('click', () => {
      const spId = btn.dataset.spId;
      const def  = SPECIAL_DEFS[spId];
      if (!def) return;
      const label = _t(def.labelFr, def.labelEn);
      const st = globalThis.state;
      if (st.gang.money < def.cost) { _notify(_t('Fonds insuffisants.', 'Insufficient funds.'), 'error'); return; }
      globalThis.showConfirm(_t(`Acheter <b>${def.labelFr}</b> pour <b>${def.cost.toLocaleString()}₽</b> ?`, `Buy <b>${def.labelEn}</b> for <b>${def.cost.toLocaleString()}₽</b>?`), () => {
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
        _notify(_t(`✨ ${def.labelFr} débloqué !`, `✨ ${def.labelEn} unlocked!`), 'gold'); renderGangTab();
      }, null, { confirmLabel: _t('Acheter', 'Buy'), cancelLabel: _t('Annuler', 'Cancel') });
    });
  });

  // Header buttons
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
        globalThis.showConfirm(_t(`Débloquer le Slot ${slotIdx + 1} pour ${cost.toLocaleString()}₽ ?`, `Unlock Slot ${slotIdx + 1} for ${cost.toLocaleString()}₽?`), () => {
          if (st.gang.money < cost) { _notify(_t('Fonds insuffisants.', 'Insufficient funds.'), 'error'); globalThis.SFX.play('error'); return; }
          st.gang.money -= cost;
          st.gang.bossTeamSlotsPurchased[slotIdx] = true;
          st.gang.activeBossTeamSlot = slotIdx;
          st.gang.bossTeam = [...(st.gang.bossTeamSlots[slotIdx] || [])];
          _save(); _topBar(); globalThis.SFX.play('unlock'); renderGangTab();
        }, null, { confirmLabel: _t('Acheter', 'Buy'), cancelLabel: _t('Annuler', 'Cancel') }); return;
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
function _patchGangTabDynamic() {
  if (globalThis.activeTab !== 'tabGang') return;
  const tab = document.getElementById('tabGang');
  if (!tab) return;
  const state = globalThis.state;
  const g     = state.gang;

  const statsRow = tab.querySelector('.gang-stats-row');
  if (!statsRow) { renderGangTab(); return; }
  statsRow.innerHTML = _buildGangStatsHtml(state);

  const repEl = tab.querySelector('#gangHeaderRep');
  if (repEl) repEl.textContent = `⭐ ${g.reputation.toLocaleString()}`;
  const moneyEl = tab.querySelector('#gangHeaderMoney');
  if (moneyEl) moneyEl.textContent = `₽ ${g.money.toLocaleString()}`;
  const dexEl = tab.querySelector('#gangHeaderDex');
  if (dexEl) dexEl.innerHTML = _gangHeaderDexHtml();
  const repFill = tab.querySelector('#gangRepBarFill');
  if (repFill) repFill.style.width = `${Math.min(100, g.reputation)}%`;

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
const GANG_TAB_EVENT_DEBOUNCE_MS = 400;
let _gangTabEventDebounceTimer = null;
let _gangTabEventsRegistered = false;

function _registerGangTabEvents() {
  if (_gangTabEventsRegistered) return;
  _gangTabEventsRegistered = true;
  const _refreshIfActive = () => {
    if (deferSimulationUi('gang')) return;
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
});
