'use strict';

// deps via configureTabRouter(ctx):
// - getState, getActiveTab, getOpenZones, setPcView
// - renderGangTab, renderZonesTab, renderMarketTab, renderPCTab, renderPokedexTab,
//   renderAgentsTab, renderMissionsTab, renderBattleLogTab,
//   renderLeaderboardTab, renderCompteTab, renderGangCompetitionTab
// - getDexKantoCaught, getDexNationalCaught, getShinySpeciesCount, dex size getters
// classic-script data globals used by hints: POKEMON_GEN1
//
// Dépendances globalThis (switchTab/updateTopBar/renderAll/initKeyboardShortcuts) :
//   state, resetPcRenderCache, notify, checkBallAssist, checkTitleUnlocks, addMoney,
//   _saveSessionActivity, getSessionDelta, getNextObjective, closeZoneWindow

import { EventBus, EVENTS } from '../core/eventBus.js';
import { SFX, MusicPlayer } from './audio.js';
import { ITEM_SPRITE_URLS } from '../../data/assets-data.js';
import { BALLS } from '../../data/economy-data.js';
import { KANTO_DEX_MIN, KANTO_DEX_MAX } from '../../data/game-config-data.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });

let tabRouterCtx = {};

function configureTabRouter(ctx = {}) {
  tabRouterCtx = { ...tabRouterCtx, ...ctx };
}

function callCtx(name, ...args) {
  return tabRouterCtx[name]?.(...args);
}

function getState() { return tabRouterCtx.getState?.() ?? globalThis.state ?? {}; }
function getActiveTab() { return tabRouterCtx.getActiveTab?.() ?? globalThis.activeTab ?? ''; }
function getOpenZones() { return tabRouterCtx.getOpenZones?.() ?? globalThis.openZones ?? new Set(); }
function setPcView(value) { return callCtx('setPcView', value); }
function getDexKantoCaught() { return callCtx('getDexKantoCaught') ?? 0; }
function getDexNationalCaught() { return callCtx('getDexNationalCaught') ?? 0; }
function getShinySpeciesCount() { return callCtx('getShinySpeciesCount') ?? 0; }
function getKantoDexSize() { return callCtx('getKantoDexSize') ?? 151; }
function getNationalDexSize() { return callCtx('getNationalDexSize') ?? 151; }
function renderGangTab(...args) { return callCtx('renderGangTab', ...args); }
function renderZonesTab(...args) { return callCtx('renderZonesTab', ...args); }
function renderMarketTab(...args) { return callCtx('renderMarketTab', ...args); }
function renderPCTab(...args) { return callCtx('renderPCTab', ...args); }
function renderPokedexTab(...args) { return callCtx('renderPokedexTab', ...args); }
function renderAgentsTab(...args) { return callCtx('renderAgentsTab', ...args); }
function renderMissionsTab(...args) { return callCtx('renderMissionsTab', ...args); }
function renderBattleLogTab(...args) { return callCtx('renderBattleLogTab', ...args); }
function renderLeaderboardTab(...args) { return callCtx('renderLeaderboardTab', ...args); }
function renderCompteTab(...args) { return callCtx('renderCompteTab', ...args); }
function renderGangCompetitionTab(...args) { return callCtx('renderGangCompetitionTab', ...args); }

function hintLink(label, tabId) {
  return `<button onclick="switchTab('${tabId}')" style="font-family:var(--font-pixel);font-size:9px;color:var(--red);background:none;border:none;border-bottom:1px solid var(--red);cursor:pointer;padding:0">${label}</button>`;
}

function getTabHint(tabId) {
  const state = getState();
  const openZones = getOpenZones();
  const pc       = state.pokemons.length;
  const agents   = state.agents.length;
  const money    = state.gang.money;
  const bossTeam = state.gang.bossTeam.length;
  const hasZone  = openZones.size > 0;

  switch (tabId) {
    case 'tabGang':
      if (!state.gang.initialized) return 'Crée ton gang pour commencer.';
      if (bossTeam === 0 && pc === 0) return `Capture des Pokémon dans ${hintLink('Zones', 'tabZones')} puis assigne-en à ton équipe Boss.`;
      if (bossTeam === 0) return `Assigne des Pokémon à ton équipe Boss depuis le ${hintLink('PC', 'tabPC')} — clique sur un Pokémon → Équipe.`;
      if (!hasZone) return `Ouvre une zone dans ${hintLink('Zones', 'tabZones')} pour explorer et combattre.`;
      return `Vitrine : montre tes meilleurs Pokémon. L\'équipe Boss combat quand tu entres en zone.`;
    case 'tabAgents':
      if (pc === 0) return `Capture des Pokémon en ${hintLink('Zones', 'tabZones')} — tu pourras en recruter comme agents.`;
      if (agents === 0) return `Recrute un agent depuis le ${hintLink('PC', 'tabPC')} : clique sur un Pokémon → Recruter Agent. Les agents explorent les zones et ramènent de l'argent automatiquement.`;
      if (!hasZone) return `Assigne tes agents à une zone depuis ${hintLink('Zones', 'tabZones')} ou directement ici via le menu déroulant.`;
      return `Les agents assignés à une zone génèrent des ₽ toutes les 5 min. Collecte depuis l'onglet ${hintLink('Zones', 'tabZones')}.`;
    case 'tabZones':
      if (!hasZone) return `Clique sur <b>Route 1</b> puis sur <b>Ouvrir</b> pour explorer ta première zone.`;
      if (bossTeam === 0) return `Entre dans une zone avec ton boss — assigne d'abord un Pokémon à ton équipe depuis le ${hintLink('PC', 'tabPC')}.`;
      return `Capture des Pokémon, bats des dresseurs. 10 victoires → combats élites. Clique 💰 pour collecter les revenus.`;
    case 'tabMarket':
      if (money < 500) return `Tu n'as presque plus d'argent. Bats des dresseurs ou vends des Pokémon en double depuis le ${hintLink('PC', 'tabPC')}.`;
      if (!state.inventory.pokeball) return `Achète des Pokéballs (100₽) dans la boutique pour pouvoir capturer des Pokémon.`;
      return `Boutique : Pokéballs, objets de boost, incubateurs. Quêtes : missions journalières pour des récompenses.`;
    case 'tabPC':
      if (pc === 0) return `Ton PC est vide. Capture des Pokémon en ${hintLink('Zones', 'tabZones')} pour les voir ici.`;
      if (bossTeam === 0) return `Clique sur un Pokémon → menu → <b>Équipe Boss</b> pour l'ajouter à ton équipe de combat.`;
      return `Filtre (Eq/Tr/PS), trie par prix/niveau/potentiel, vends les doublons.`;
    case 'tabTraining':
      if (pc === 0) return `Capture des Pokémon en ${hintLink('Zones', 'tabZones')} pour les entraîner.`;
      return `Place 2 à 6 Pokémon — ils s'affrontent automatiquement toutes les 60s. Gagnant : XP ×1.25, tous gagnent de l'XP.`;
    case 'tabLab':
      if (pc < 3) return `Capture plusieurs exemplaires du même Pokémon pour les fusionner au Labo et augmenter le Potentiel.`;
      return `Potentiel (⭐) = multiplicateur de prix et de stats. Sacrifie des doublons pour monter jusqu'à 5⭐ (max).`;
    case 'tabMissions':
      return `Missions journalières et hebdomadaires = source de ₽ et d'objets rares. Reviens chaque jour.`;
    case 'tabPokedex':
      return `Kanto ${getDexKantoCaught()}/${getKantoDexSize()} · National ${getDexNationalCaught()}/${getNationalDexSize()} · Chromas ${getShinySpeciesCount()} espèces. Explore toutes les zones pour compléter !`;
    case 'tabCompetition':
      return `Défie les gangs adverses. Côté défense, publie 3 agents DEF + le Boss. Côté attaque, envoie jusqu'à 3 agents en raid : les combats s'enchaînent un à un avant le Boss.`;
    default:
      return null;
  }
}

// ── First-visit contextual hint (non-bloquant, disparaît en 6s ou au clic) ──
const _FIRST_VISIT_HINTS = {
  tabGang:     { icon: '👑', title: 'Ton Gang', body: 'Ta base d\'opérations. Gère l\'équipe Boss (3 slots sauvegardables), place tes meilleurs Pokémon en vitrine, et débloque des upgrades spéciaux au Marché.' },
  tabAgents:   { icon: '👥', title: 'Les Agents', body: 'Assigne-leur une zone → ils capturent et combattent automatiquement, même zones fermées. Chaque agent a un comportement (tout / capture / combat) et une stat de chance qui augmente les potentiels.' },
  tabZones:    { icon: '🗺', title: 'Zones', body: 'Ouvre jusqu\'à 6 zones simultanément pour capturer des Pokémon et battre des dresseurs. Les zones fermées avec agent continuent en arrière-plan. Double-clic sur une zone pour y envoyer ton Boss — il ne combat que dans la zone où il est assigné.' },
  tabMarket:   { icon: '🛒', title: 'Marché', body: 'Achète des Pokéballs pour capturer, des incubateurs pour faire éclore des œufs, et plus encore.' },
  tabPC:       { icon: '💾', title: 'Le PC', body: 'Tous tes Pokémon sont ici. Assigne-les à ton équipe, à un agent, à la pension ou à la salle d\'entraînement.' },
  tabTraining: { icon: '🏋', title: 'Salle d\'entraînement', body: 'Tes Pokémon s\'entraînent automatiquement. Parfait pour monter en niveau des Pokémon que tu n\'utilises pas.' },
  tabLab:      { icon: '🔬', title: 'Laboratoire', body: 'Le Potentiel (⭐) multiplie la valeur et les stats d\'un Pokémon. Fusionne des doublons pour monter jusqu\'à 5⭐.' },
  tabMissions: { icon: '📋', title: 'Missions', body: 'Objectifs quotidiens et hebdomadaires. Complète-les pour des ₽ et des objets rares.' },
  tabPokedex:   { icon: '📖', title: 'Pokédex', body: 'Chaque espèce capturée est enregistrée ici. Vise 151/151 pour tout débloquer.' },
  tabCompetition: { icon: '⚔️', title: 'Compétition', body: `Affronte les gangs des autres joueurs avec des raids séquentiels : 3 agents DEF plus le Boss en face, jusqu'à 3 attaquants envoyés au combat, puis le Boss adverse prend le relais.` },
};

function showFirstVisitHint(tabId) {
  const def = _FIRST_VISIT_HINTS[tabId];
  if (!def) return;
  // Remove any existing hint
  document.getElementById('firstVisitHint')?.remove();

  const el = document.createElement('div');
  el.id = 'firstVisitHint';
  el.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:4000;
    background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);
    padding:12px 14px;max-width:260px;box-shadow:0 4px 20px rgba(0,0,0,.6);
    animation:fvhIn .3s ease;cursor:pointer;
  `;
  el.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px">
      <span style="font-size:20px;flex-shrink:0">${def.icon}</span>
      <div>
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);margin-bottom:4px">${def.title}</div>
        <div style="font-size:10px;color:var(--text-dim);line-height:1.5">${def.body}</div>
      </div>
      <button style="background:none;border:none;color:var(--text-dim);font-size:14px;cursor:pointer;padding:0;flex-shrink:0;line-height:1" onclick="document.getElementById('firstVisitHint')?.remove()">✕</button>
    </div>`;

  document.body.appendChild(el);

  // Auto-dismiss after 7s
  const timer = setTimeout(() => {
    el.style.animation = 'fvhOut .3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 7000);
  el.addEventListener('click', () => { clearTimeout(timer); el.remove(); });
}

function renderHint(tabId) {
  const bar = document.getElementById('hintBar');
  if (!bar) return;
  const hint = getTabHint(tabId);
  if (hint) {
    bar.innerHTML = '&gt;&gt; ' + hint;
    bar.style.display = 'block';
  } else {
    bar.style.display = 'none';
  }
}

function renderActiveTab() {
  const activeTab = getActiveTab();
  switch (activeTab) {
    case 'tabGang':     renderGangTab(); break;
    case 'tabZones':    renderZonesTab(); break;
    case 'tabMarket':   renderMarketTab(); break;
    case 'tabPC':       renderPCTab(); break;
    case 'tabPokedex':  renderPokedexTab(); break;
    case 'tabAgents':   renderAgentsTab(); break;
    case 'tabMissions':    renderMissionsTab(); break;
    case 'tabBattleLog':   renderBattleLogTab(); break;
    case 'tabTraining': setPcView('training'); switchTab('tabPC'); break;
    case 'tabLab':      setPcView('lab'); switchTab('tabPC'); break;
    case 'tabLeaderboard': renderLeaderboardTab(); break;
    case 'tabCompte':      renderCompteTab(); break;
    case 'tabCompetition': renderGangCompetitionTab(); break;
  }
}

// Track which tabs have been seen (first-visit hints)
const _visitedTabs = new Set(JSON.parse(sessionStorage.getItem('pg_visited_tabs') || '[]'));

function switchTab(tabId) {
  const state = getState();
  if (tabId !== 'tabPC') globalThis.resetPcRenderCache?.(); // force full rebuild on next PC visit
  SFX.play('tabSwitch');
  globalThis.activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
  // Notifie les modules abonnés (ex: gangBase auto-refresh à l'arrivée sur Zones)
  EventBus.emit(EVENTS.UI_TAB_CHANGED, { tabId });
  renderHint(tabId);
  renderActiveTab();
  MusicPlayer.updateFromContext();
  updateTopBar(); // refresh objective / session on tab change
  // First-visit contextual hint
  if (!_visitedTabs.has(tabId)) {
    _visitedTabs.add(tabId);
    sessionStorage.setItem('pg_visited_tabs', JSON.stringify([..._visitedTabs]));
    showFirstVisitHint(tabId);
  }
  // Behavioural log — compteur de visites par onglet
  if (!state.behaviourLogs) state.behaviourLogs = {};
  if (!state.behaviourLogs.tabViewCounts) state.behaviourLogs.tabViewCounts = {};
  state.behaviourLogs.tabViewCounts[tabId] = (state.behaviourLogs.tabViewCounts[tabId] || 0) + 1;
}

// ── Chantier 5 — updateTopBar debounce + dex badge cache ─────────────────────
// updateTopBar() est appelée ~80× par tick d'agent (capture + save + topBar).
// On la debounce via rAF (1 seul DOM write par frame) et on cache le badge dex
// (scan O(n) sur POKEMON_GEN1) jusqu'à ce que le compte de pokémons capturés change.

let _topBarRafId   = 0;           // rAF handle pour debounce
let _dexBadgeCache = '';          // icon cached
let _dexBadgeCaughtCount = -1;    // invalidation clé : nb de pokémons distincts capturés

function _updateTopBarImpl() {
  const state = getState();
  const gangEl = document.getElementById('gangNameDisplay');
  const moneyEl = document.getElementById('moneyDisplay');
  if (gangEl) {
    const caughtCount = Object.keys(state.pokedex).filter(k => state.pokedex[k]?.caught).length;
    if (caughtCount !== _dexBadgeCaughtCount) {
      _dexBadgeCaughtCount = caughtCount;
      const kantoComplete = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= KANTO_DEX_MIN && s.dex <= KANTO_DEX_MAX).every(s => state.pokedex[s.en]?.caught);
      const fullComplete  = POKEMON_GEN1.filter(s => !s.hidden).every(s => state.pokedex[s.en]?.caught);
      _dexBadgeCache      = fullComplete ? ' 🌟' : kantoComplete ? ' 📖' : '';
    }
    gangEl.textContent = state.gang.name + _dexBadgeCache;
  }
  if (moneyEl) moneyEl.innerHTML = `<span>₽</span> ${state.gang.money.toLocaleString()}`;
  const repEl = document.getElementById('repDisplay');
  if (repEl) repEl.innerHTML = `<span>⭐</span> ${state.gang.reputation.toLocaleString()}`;
  const pkCountEl = document.getElementById('pokemonCountDisplay');
  if (pkCountEl) pkCountEl.innerHTML = `<img src="${ITEM_SPRITE_URLS.pokeball}" style="width:20px;height:20px;image-rendering:pixelated" onerror="this.style.display='none'"> ${state.pokemons.length.toLocaleString()}`;

  // ── Ball assist silencieux (early-game) ───────────────────
  globalThis.checkBallAssist?.();
  globalThis.checkTitleUnlocks?.();
  // Auto-buy ball
  if (state.settings.autoBuyBall) {
    const ballId = state.settings.autoBuyBall;
    if ((state.inventory[ballId] || 0) === 0) {
      const ballDef = BALLS[ballId];
      if (ballDef && state.gang.money >= ballDef.cost) {
        state.inventory[ballId] = (state.inventory[ballId] || 0) + 1;
        globalThis.addMoney?.(-ballDef.cost);
        _notify(`🔄 Achat auto : 1× ${ballDef.fr}`, 'success');
      }
    }
  }

  // ── Session delta bar ──────────────────────────────────────
  globalThis._saveSessionActivity?.();
  const sessionBar = document.getElementById('sessionBar');
  if (sessionBar) {
    const delta = globalThis.getSessionDelta?.();
    if (delta) {
      sessionBar.innerHTML = `<span style="color:var(--text-dim);font-family:var(--font-pixel);font-size:7px;letter-spacing:.05em">SESSION</span> ${delta}`;
      sessionBar.style.display = 'flex';
    } else {
      sessionBar.style.display = 'none';
    }
  }

  // ── Objective bar ──────────────────────────────────────────
  const objBar = document.getElementById('objectiveBar');
  if (objBar) {
    const obj = globalThis.getNextObjective?.();
    if (obj) {
      const tabBtn = obj.tab
        ? `<button onclick="switchTab('${obj.tab}')" style="font-family:var(--font-pixel);font-size:7px;color:var(--red);background:none;border:none;border-bottom:1px solid var(--red);cursor:pointer;padding:0;margin-left:6px">${obj.detail || obj.tab}</button>`
        : (obj.detail ? `<span style="color:var(--text-dim);font-size:9px;margin-left:6px">${obj.detail}</span>` : '');
      objBar.innerHTML = `<span style="font-family:var(--font-pixel);font-size:7px;color:var(--gold-dim,#999);margin-right:6px">▶</span><span style="font-size:9px;color:var(--text)">${obj.text}</span>${tabBtn}`;
      objBar.style.display = 'flex';
    } else {
      objBar.style.display = 'none';
    }
  }
}

// updateTopBar publique — debounce via rAF pour éviter N DOM writes par tick.
// Les appels multiples dans la même frame sont fusionnés en un seul rendu.
function updateTopBar() {
  if (_topBarRafId) return; // déjà en attente
  _topBarRafId = requestAnimationFrame(() => {
    _topBarRafId = 0;
    _updateTopBarImpl();
  });
}

function renderAll() {
  updateTopBar();
  renderHint(getActiveTab());
  renderActiveTab();
}

// ════════════════════════════════════════════════════════════════
// RACCOURCIS CLAVIER GLOBAUX
//  1-7 → onglets  |  Échap → ferme modale/fenêtre de zone
// ════════════════════════════════════════════════════════════════
function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    // Ignore si le focus est dans un champ texte
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    // Ignore si une modale bloquante est ouverte
    if (document.getElementById('settingsModal')?.classList.contains('active')) return;
    if (document.getElementById('confirmModal')) return;

    switch (e.key) {
      // ── Onglets principaux ───────────────────────────────────
      case '1': switchTab('tabZones');    break;
      case '2': switchTab('tabPC');       break;
      case '3': switchTab('tabAgents');   break;
      case '4': switchTab('tabMarket');   break;
      case '5': switchTab('tabGang');     break;
      case '6': switchTab('tabPokedex');  break;

      // ── Sous-vues PC ─────────────────────────────────────────
      case 'p': case 'P':
        setPcView('grid'); switchTab('tabPC'); break;
      case 'e': case 'E':
        setPcView('pension'); switchTab('tabPC'); break;
      case 't': case 'T':
        setPcView('training'); switchTab('tabPC'); break;
      case 'l': case 'L':
        setPcView('lab'); switchTab('tabPC'); break;

      // ── Fermeture rapide ─────────────────────────────────────
      case 'Escape': {
        // Ferme d'abord les fenêtres de zone ouvertes
        const openZones = getOpenZones();
        if (openZones && openZones.size > 0) {
          for (const zid of [...openZones]) globalThis.closeZoneWindow?.(zid);
        }
        break;
      }
    }
  });
}

export {
  configureTabRouter,
  getTabHint,
  hintLink,
  renderActiveTab,
  renderHint,
  showFirstVisitHint,
  renderGangCompetitionTab,
  switchTab,
  updateTopBar,
  renderAll,
  initKeyboardShortcuts,
};
