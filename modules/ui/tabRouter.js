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
//   state, resetPcRenderCache, notify, checkTitleUnlocks, addMoney,
//   _saveSessionActivity, getSessionDelta, getNextObjective, closeZoneWindow

import { EventBus, EVENTS } from '../core/eventBus.js';
import { SFX, MusicPlayer } from './audio.js';
import { ITEM_SPRITE_URLS } from '../../data/assets-data.js';
import { KANTO_DEX_MIN, KANTO_DEX_MAX } from '../../data/game-config-data.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type });
const _t = (fr, en) => (globalThis.state?.lang === 'en' ? en : fr);

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
      if (!state.gang.initialized) return _t('Crée ton gang pour commencer.', 'Create your gang to get started.');
      if (bossTeam === 0 && pc === 0) return _t(
        `Capture des Pokémon dans ${hintLink('Zones', 'tabZones')} puis assigne-en à ton équipe Boss.`,
        `Catch Pokémon in ${hintLink('Zones', 'tabZones')} then assign some to your Boss team.`);
      if (bossTeam === 0) return _t(
        `Assigne des Pokémon à ton équipe Boss depuis le ${hintLink('PC', 'tabPC')} — clique sur un Pokémon → Équipe.`,
        `Assign Pokémon to your Boss team from the ${hintLink('PC', 'tabPC')} — click a Pokémon → Team.`);
      if (!hasZone) return _t(
        `Ouvre une zone dans ${hintLink('Zones', 'tabZones')} pour explorer et combattre.`,
        `Open a zone in ${hintLink('Zones', 'tabZones')} to explore and battle.`);
      return _t(
        `Vitrine : montre tes meilleurs Pokémon. L\'équipe Boss combat quand tu entres en zone.`,
        `Showcase: display your best Pokémon. The Boss team fights when you enter a zone.`);
    case 'tabAgents':
      if (pc === 0) return _t(
        `Capture des Pokémon en ${hintLink('Zones', 'tabZones')} — tu pourras en recruter comme agents.`,
        `Catch Pokémon in ${hintLink('Zones', 'tabZones')} — you can recruit them as agents.`);
      if (agents === 0) return _t(
        `Recrute un agent depuis le ${hintLink('PC', 'tabPC')} : clique sur un Pokémon → Recruter Agent. Les agents explorent les zones et ramènent de l'argent automatiquement.`,
        `Recruit an agent from the ${hintLink('PC', 'tabPC')}: click a Pokémon → Recruit Agent. Agents explore zones and earn money automatically.`);
      if (!hasZone) return _t(
        `Assigne tes agents à une zone depuis ${hintLink('Zones', 'tabZones')} ou directement ici via le menu déroulant.`,
        `Assign your agents to a zone from ${hintLink('Zones', 'tabZones')} or directly here via the dropdown.`);
      return _t(
        `Les agents assignés à une zone génèrent des ₽ toutes les 5 min. Collecte depuis l'onglet ${hintLink('Zones', 'tabZones')}.`,
        `Agents assigned to a zone earn ₽ every 5 min. Collect from the ${hintLink('Zones', 'tabZones')} tab.`);
    case 'tabZones':
      if (!hasZone) return _t(
        `Clique sur <b>Route 1</b> puis sur <b>Ouvrir</b> pour explorer ta première zone.`,
        `Click on <b>Route 1</b> then <b>Open</b> to explore your first zone.`);
      if (bossTeam === 0) return _t(
        `Entre dans une zone avec ton boss — assigne d'abord un Pokémon à ton équipe depuis le ${hintLink('PC', 'tabPC')}.`,
        `Enter a zone with your boss — first assign a Pokémon to your team from the ${hintLink('PC', 'tabPC')}.`);
      return _t(
        `Capture des Pokémon, bats des dresseurs. 10 victoires → combats élites. Clique 💰 pour collecter les revenus.`,
        `Catch Pokémon, beat trainers. 10 wins → elite battles. Click 💰 to collect earnings.`);
    case 'tabMarket':
      if (money < 500) return _t(
        `Tu n'as presque plus d'argent. Bats des dresseurs ou vends des Pokémon en double depuis le ${hintLink('PC', 'tabPC')}.`,
        `You're almost out of money. Beat trainers or sell duplicate Pokémon from the ${hintLink('PC', 'tabPC')}.`);
      return _t(
        `Boutique : objets de boost, incubateurs. Quêtes : missions journalières pour des récompenses.`,
        `Shop: boost items, incubators. Quests: daily missions for rewards.`);
    case 'tabPC':
      if (pc === 0) return _t(
        `Ton PC est vide. Capture des Pokémon en ${hintLink('Zones', 'tabZones')} pour les voir ici.`,
        `Your PC is empty. Catch Pokémon in ${hintLink('Zones', 'tabZones')} to see them here.`);
      if (bossTeam === 0) return _t(
        `Clique sur un Pokémon → menu → <b>Équipe Boss</b> pour l'ajouter à ton équipe de combat.`,
        `Click a Pokémon → menu → <b>Boss Team</b> to add it to your battle team.`);
      return _t(
        `Filtre (Eq/Tr/PS), trie par prix/niveau/potentiel, vends les doublons.`,
        `Filter (Team/Train/Pension), sort by price/level/potential, sell duplicates.`);
    case 'tabTraining':
      if (pc === 0) return _t(
        `Capture des Pokémon en ${hintLink('Zones', 'tabZones')} pour les entraîner.`,
        `Catch Pokémon in ${hintLink('Zones', 'tabZones')} to train them.`);
      return _t(
        `Place 2 à 6 Pokémon — ils s'affrontent automatiquement toutes les 60s. Gagnant : XP ×1.25, tous gagnent de l'XP.`,
        `Place 2 to 6 Pokémon — they battle automatically every 60s. Winner: XP ×1.25, all gain XP.`);
    case 'tabLab':
      if (pc < 3) return _t(
        `Capture plusieurs exemplaires du même Pokémon pour les fusionner au Labo et augmenter le Potentiel.`,
        `Catch multiple copies of the same Pokémon to merge them in the Lab and raise Potential.`);
      return _t(
        `Potentiel (⭐) = multiplicateur de prix et de stats. Sacrifie des doublons pour monter jusqu'à 5⭐ (max).`,
        `Potential (⭐) = price and stat multiplier. Sacrifice duplicates to reach 5⭐ (max).`);
    case 'tabMissions':
      return _t(
        `Missions journalières et hebdomadaires = source de ₽ et d'objets rares. Reviens chaque jour.`,
        `Daily and weekly missions = source of ₽ and rare items. Come back every day.`);
    case 'tabPokedex':
      return _t(
        `Kanto ${getDexKantoCaught()}/${getKantoDexSize()} · National ${getDexNationalCaught()}/${getNationalDexSize()} · Chromas ${getShinySpeciesCount()} espèces. Explore toutes les zones pour compléter !`,
        `Kanto ${getDexKantoCaught()}/${getKantoDexSize()} · National ${getDexNationalCaught()}/${getNationalDexSize()} · Shinies ${getShinySpeciesCount()} species. Explore all zones to complete!`);
    case 'tabCompetition':
      return _t(
        `Défie les gangs adverses. Côté défense, publie 3 agents DEF + le Boss. Côté attaque, envoie jusqu'à 3 agents en raid : les combats s'enchaînent un à un avant le Boss.`,
        `Challenge rival gangs. Defence: post 3 DEF agents + the Boss. Attack: send up to 3 agents on a raid — battles chain one by one before the Boss.`);
    default:
      return null;
  }
}

// ── First-visit contextual hint ───────────────────────────────────────────────
const _FIRST_VISIT_HINTS = {
  tabGang:     {
    icon: '👑',
    titleFr: 'Ton Gang',                              titleEn: 'Your Gang',
    bodyFr:  'Ta base d\'opérations. Gère l\'équipe Boss (3 slots sauvegardables), place tes meilleurs Pokémon en vitrine, et débloque des upgrades spéciaux au Marché.',
    bodyEn:  'Your base of operations. Manage the Boss team (3 saveable slots), showcase your best Pokémon, and unlock special upgrades at the Market.',
  },
  tabAgents:   {
    icon: '👥',
    titleFr: 'Les Agents',                            titleEn: 'Agents',
    bodyFr:  'Assigne-leur une zone → ils capturent et combattent automatiquement, même zones fermées. Chaque agent a un comportement (tout / capture / combat) et une stat de chance qui augmente les potentiels.',
    bodyEn:  'Assign them a zone → they catch and battle automatically, even in closed zones. Each agent has a behaviour (all / catch / battle) and a luck stat that raises potentials.',
  },
  tabZones:    {
    icon: '🗺',
    titleFr: 'Zones',                                 titleEn: 'Zones',
    bodyFr:  'Ouvre jusqu\'à 6 zones simultanément pour capturer des Pokémon et battre des dresseurs. Les zones fermées avec agent continuent en arrière-plan. Double-clic sur une zone pour y envoyer ton Boss — il ne combat que dans la zone où il est assigné.',
    bodyEn:  'Open up to 6 zones simultaneously to catch Pokémon and beat trainers. Closed zones with an agent keep running in the background. Double-click a zone to send your Boss there — he only fights in his assigned zone.',
  },
  tabMarket:   {
    icon: '🛒',
    titleFr: 'Marché',                                titleEn: 'Market',
    bodyFr:  'Achète des Pokéballs pour capturer, des incubateurs pour faire éclore des œufs, et plus encore.',
    bodyEn:  'Buy Pokéballs to catch, incubators to hatch eggs, and more.',
  },
  tabPC:       {
    icon: '💾',
    titleFr: 'Le PC',                                 titleEn: 'PC',
    bodyFr:  'Tous tes Pokémon sont ici. Assigne-les à ton équipe, à un agent, à la pension ou à la salle d\'entraînement.',
    bodyEn:  'All your Pokémon are here. Assign them to your team, an agent, the daycare, or the training room.',
  },
  tabTraining: {
    icon: '🏋',
    titleFr: 'Salle d\'entraînement',                 titleEn: 'Training Room',
    bodyFr:  'Tes Pokémon s\'entraînent automatiquement. Parfait pour monter en niveau des Pokémon que tu n\'utilises pas.',
    bodyEn:  'Your Pokémon train automatically. Perfect for levelling up Pokémon you\'re not using.',
  },
  tabLab:      {
    icon: '🔬',
    titleFr: 'Laboratoire',                           titleEn: 'Laboratory',
    bodyFr:  'Le Potentiel (⭐) multiplie la valeur et les stats d\'un Pokémon. Fusionne des doublons pour monter jusqu\'à 5⭐.',
    bodyEn:  'Potential (⭐) multiplies a Pokémon\'s value and stats. Merge duplicates to reach 5⭐.',
  },
  tabMissions: {
    icon: '📋',
    titleFr: 'Missions',                              titleEn: 'Missions',
    bodyFr:  'Objectifs quotidiens et hebdomadaires. Complète-les pour des ₽ et des objets rares.',
    bodyEn:  'Daily and weekly goals. Complete them for ₽ and rare items.',
  },
  tabPokedex:  {
    icon: '📖',
    titleFr: 'Pokédex',                               titleEn: 'Pokédex',
    bodyFr:  'Chaque espèce capturée est enregistrée ici. Vise 151/151 pour tout débloquer.',
    bodyEn:  'Every caught species is recorded here. Aim for 151/151 to unlock everything.',
  },
  tabCompetition: {
    icon: '⚔️',
    titleFr: 'Compétition',                           titleEn: 'Competition',
    bodyFr:  `Affronte les gangs des autres joueurs avec des raids séquentiels : 3 agents DEF plus le Boss en face, jusqu'à 3 attaquants envoyés au combat, puis le Boss adverse prend le relais.`,
    bodyEn:  `Challenge other players' gangs with sequential raids: 3 DEF agents plus the Boss on the other side, up to 3 attackers sent into battle, then the rival Boss takes over.`,
  },
};

function showFirstVisitHint(tabId) {
  const def = _FIRST_VISIT_HINTS[tabId];
  if (!def) return;
  document.getElementById('firstVisitHint')?.remove();

  const title = _t(def.titleFr, def.titleEn);
  const body  = _t(def.bodyFr,  def.bodyEn);

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
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);margin-bottom:4px">${title}</div>
        <div style="font-size:10px;color:var(--text-dim);line-height:1.5">${body}</div>
      </div>
      <button style="background:none;border:none;color:var(--text-dim);font-size:14px;cursor:pointer;padding:0;flex-shrink:0;line-height:1" onclick="document.getElementById('firstVisitHint')?.remove()">&#x2715;</button>
    </div>`;

  document.body.appendChild(el);

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
  const prevTab = globalThis.activeTab;
  if (tabId !== 'tabPC') globalThis.resetPcRenderCache?.();
  SFX.play('tabSwitch');
  globalThis.activeTab = tabId;
  if (prevTab === 'tabZones' && tabId !== 'tabZones') globalThis.pauseVivariumWindow?.();
  if (tabId === 'tabZones' && prevTab !== 'tabZones') globalThis.resumeVivariumWindow?.();
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
  EventBus.emit(EVENTS.UI_TAB_CHANGED, { tabId });
  renderHint(tabId);
  renderActiveTab();
  MusicPlayer.updateFromContext();
  updateTopBar();
  if (!_visitedTabs.has(tabId)) {
    _visitedTabs.add(tabId);
    sessionStorage.setItem('pg_visited_tabs', JSON.stringify([..._visitedTabs]));
    showFirstVisitHint(tabId);
  }
}

// ── updateTopBar debounce + dex badge cache ───────────────────────────────────

let _topBarRafId   = 0;
let _dexBadgeCache = '';
let _dexBadgeCaughtCount = -1;

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

  globalThis.checkTitleUnlocks?.();

  // Session delta bar
  globalThis._saveSessionActivity?.();
  const sessionBar = document.getElementById('sessionBar');
  if (sessionBar) {
    const delta = globalThis.getSessionDelta?.();
    if (delta) {
      sessionBar.innerHTML = `<span style="color:var(--text-dim);font-family:var(--font-pixel);font-size:7px;letter-spacing:.05em">${_t('SESSION', 'SESSION')}</span> ${delta}`;
      sessionBar.style.display = 'flex';
    } else {
      sessionBar.style.display = 'none';
    }
  }

  // Objective bar
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

function updateTopBar() {
  if (_topBarRafId) return;
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
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (document.getElementById('settingsModal')?.classList.contains('active')) return;
    if (document.getElementById('confirmModal')) return;

    switch (e.key) {
      case '1': switchTab('tabZones');    break;
      case '2': switchTab('tabPC');       break;
      case '3': switchTab('tabAgents');   break;
      case '4': switchTab('tabMarket');   break;
      case '5': switchTab('tabGang');     break;
      case '6': switchTab('tabPokedex');  break;

      case 'p': case 'P':
        setPcView('grid'); switchTab('tabPC'); break;
      case 'e': case 'E':
        setPcView('pension'); switchTab('tabPC'); break;
      case 't': case 'T':
        setPcView('training'); switchTab('tabPC'); break;
      case 'l': case 'L':
        setPcView('lab'); switchTab('tabPC'); break;

      case 'Escape': {
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
