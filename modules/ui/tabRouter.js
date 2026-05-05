'use strict';

// deps via configureTabRouter(ctx):
// - getState, getActiveTab, getOpenZones, switchTab, setPcView
// - renderGangTab, renderZonesTab, renderMarketTab, renderPCTab, renderPokedexTab,
//   renderAgentsTab, renderCosmeticsTab, renderMissionsTab, renderBattleLogTab,
//   renderLeaderboardTab, renderCompteTab
// - getDexKantoCaught, getDexNationalCaught, getShinySpeciesCount, dex size getters
// classic-script data globals used by hints: POKEMON_GEN1

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
function switchTab(...args) { return callCtx('switchTab', ...args); }
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
function renderCosmeticsTab(...args) { return callCtx('renderCosmeticsTab', ...args); }
function renderMissionsTab(...args) { return callCtx('renderMissionsTab', ...args); }
function renderBattleLogTab(...args) { return callCtx('renderBattleLogTab', ...args); }
function renderLeaderboardTab(...args) { return callCtx('renderLeaderboardTab', ...args); }
function renderCompteTab(...args) { return callCtx('renderCompteTab', ...args); }

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
    case 'tabBag':
      return null;
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
    default:
      return null;
  }
}

// ── First-visit contextual hint (non-bloquant, disparaît en 6s ou au clic) ──
const _FIRST_VISIT_HINTS = {
  tabGang:     { icon: '👑', title: 'Ton Gang', body: 'Ta base d\'opérations. Gère l\'équipe Boss (3 slots sauvegardables), place tes meilleurs Pokémon en vitrine, et débloque des upgrades spéciaux au Marché.' },
  tabAgents:   { icon: '👥', title: 'Les Agents', body: 'Assigne-leur une zone → ils capturent et combattent automatiquement, même zones fermées. Chaque agent a un comportement (tout / capture / combat) et une stat de chance qui augmente les potentiels.' },
  tabZones:    { icon: '🗺', title: 'Zones', body: 'Ouvre jusqu\'à 6 zones simultanément pour capturer des Pokémon et battre des dresseurs. Les zones fermées avec agent continuent de se jouer en arrière-plan. Ton Boss participe aux combats de toutes les zones ouvertes.' },
  tabMarket:   { icon: '🛒', title: 'Marché', body: 'Achète des Pokéballs pour capturer, des incubateurs pour faire éclore des œufs, et plus encore.' },
  tabPC:       { icon: '💾', title: 'Le PC', body: 'Tous tes Pokémon sont ici. Assigne-les à ton équipe, à un agent, à la pension ou à la salle d\'entraînement.' },
  tabTraining: { icon: '🏋', title: 'Salle d\'entraînement', body: 'Tes Pokémon s\'entraînent automatiquement. Parfait pour monter en niveau des Pokémon que tu n\'utilises pas.' },
  tabLab:      { icon: '🔬', title: 'Laboratoire', body: 'Le Potentiel (⭐) multiplie la valeur et les stats d\'un Pokémon. Fusionne des doublons pour monter jusqu\'à 5⭐.' },
  tabMissions: { icon: '📋', title: 'Missions', body: 'Objectifs quotidiens et hebdomadaires. Complète-les pour des ₽ et des objets rares.' },
  tabPokedex:  { icon: '📖', title: 'Pokédex', body: 'Chaque espèce capturée est enregistrée ici. Vise 151/151 pour tout débloquer.' },
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
    case 'tabBag':        switchTab('tabMarket'); break;
    case 'tabCosmetics':   renderCosmeticsTab(); break;
    case 'tabMissions':    renderMissionsTab(); break;
    case 'tabBattleLog':   renderBattleLogTab(); break;
    case 'tabTraining': setPcView('training'); switchTab('tabPC'); break;
    case 'tabLab':      setPcView('lab'); switchTab('tabPC'); break;
    case 'tabLeaderboard': renderLeaderboardTab(); break;
    case 'tabCompte':      renderCompteTab(); break;
  }
}



export {
  configureTabRouter,
  getTabHint,
  hintLink,
  renderActiveTab,
  renderHint,
  showFirstVisitHint,
};
