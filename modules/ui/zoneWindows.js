// ════════════════════════════════════════════════════════════════
//  ZONE WINDOWS MODULE
//  Extracted from app.js — DOM rendering + interactions
// ════════════════════════════════════════════════════════════════
//
//  Globals read from app.js via globalThis:
//    state, pick, randInt, uid, notify, saveState
//    initZone, spawnInZone, isZoneDegraded, getZoneMastery
//    getZoneSlotCost, rollChestLoot, activateEvent, makeTrainerTeam
//    tryCapture, applyCombatResult, getCombatRepGain
//    checkForNewlyUnlockedZones, triggerGymRaid
//    startBackgroundZone, stopBackgroundZone
//    levelUpPokemon, getPokemonPower, getTeamPower, getAgentCombatPower
//    checkMoneyMilestone, pokeSprite, pokeSpriteBack, trainerSprite
//    speciesName, addLog, addBattleLogEntry, pushFeedEvent, updateTopBar
//    renderGangTab, renderPCTab, renderZonesTab, renderGangBasePanel
//    showConfirm, showRarePopup, showShinyPopup, getTrainerDialogue
//    checkPlayerStatPoints
//    SFX, activeTab
//    openZones, zoneSpawns, zoneTimers
//    ZONE_BGS, ZONE_SLOT_COSTS, ITEM_SPRITE_URLS, BALL_SPRITES, MAX_COMBAT_REWARD
//    SPECIAL_TRAINER_KEYS
//
//  Classic-script globals accessed by bare name:
//    ZONE_BY_ID, SPECIES_BY_EN, TRAINER_TYPES, SPECIAL_EVENTS
// ════════════════════════════════════════════════════════════════

import {
  renderZoneSelector    as _zsRenderSelector,
  bindZoneActionButtons as _zsBindActions,
  refreshZoneTile       as _zsRefreshTile,
  refreshZoneIncomeTile as _zsRefreshIncome,
  updateZoneButtons     as _zsUpdateButtons,
} from './zoneSelector.js';
import { TRAINER_TYPES } from '../../data/trainers-data.js';

// ── Module-level state ────────────────────────────────────────
const zoneNextSpawn = {}; // zoneId -> { countdown, lastSpawnType }
const zoneSpawnHistory = {}; // zoneId -> { pokemon:N, trainer:N, total:N }
let currentCombat = null;

// ── Wing drop config ──────────────────────────────────────────
const SPECIAL_WING_EVENTS = {
  seafoam_islands: {
    item:            'silver_wing',
    itemName:        "Argent'Aile",
    minDrop:         1,
    maxDrop:         5,
    legendaryShadow: 'lugia',       // espèce dont le sprite est utilisé en ombre
    shadowLabel:     'Ombre de Lugia',
    spawnChance:     0.06,          // 6% par tick de spawn (mastery >= 2)
    despawnMs:       20_000,        // l'ombre disparaît après 20 s si non cliquée
  },
  victory_road: {
    item:            'rainbow_wing',
    itemName:        "Arcenci'Aile",
    minDrop:         1,
    maxDrop:         5,
    legendaryShadow: 'ho-oh',
    shadowLabel:     'Ombre de Ho-Oh',
    spawnChance:     0.06,
    despawnMs:       20_000,
  },
};

// ── Type effectiveness chart ──────────────────────────────────
const TYPE_CHART = {
  Normal:   { Rock:0.5, Ghost:0, Steel:0.5 },
  Fire:     { Fire:0.5, Water:0.5, Grass:2, Ice:2, Bug:2, Rock:0.5, Dragon:0.5, Steel:2 },
  Water:    { Fire:2, Water:0.5, Grass:0.5, Ground:2, Rock:2, Dragon:0.5 },
  Electric: { Water:2, Electric:0.5, Grass:0.5, Ground:0, Flying:2, Dragon:0.5 },
  Grass:    { Fire:0.5, Water:2, Grass:0.5, Poison:0.5, Ground:2, Flying:0.5, Bug:0.5, Rock:2, Dragon:0.5, Steel:0.5 },
  Ice:      { Water:0.5, Grass:2, Ice:0.5, Ground:2, Flying:2, Dragon:2, Steel:0.5 },
  Fighting: { Normal:2, Ice:2, Rock:2, Dark:2, Steel:2, Poison:0.5, Flying:0.5, Psychic:0.5, Bug:0.5, Ghost:0 },
  Poison:   { Grass:2, Fairy:2, Ground:0.5, Rock:0.5, Ghost:0.5, Poison:0.5, Steel:0 },
  Ground:   { Fire:2, Electric:2, Poison:2, Rock:2, Steel:2, Grass:0.5, Bug:0.5, Flying:0 },
  Flying:   { Grass:2, Fighting:2, Bug:2, Electric:0.5, Rock:0.5, Steel:0.5 },
  Psychic:  { Fighting:2, Poison:2, Psychic:0.5, Steel:0.5, Dark:0 },
  Bug:      { Grass:2, Psychic:2, Dark:2, Fire:0.5, Fighting:0.5, Flying:0.5, Ghost:0.5, Steel:0.5, Fairy:0.5 },
  Rock:     { Fire:2, Ice:2, Flying:2, Bug:2, Fighting:0.5, Ground:0.5, Steel:0.5 },
  Ghost:    { Psychic:2, Ghost:2, Normal:0, Dark:0.5 },
  Dragon:   { Dragon:2, Steel:0.5, Fairy:0 },
  Dark:     { Psychic:2, Ghost:2, Fighting:0.5, Dark:0.5, Fairy:0.5 },
  Steel:    { Ice:2, Rock:2, Fairy:2, Fire:0.5, Water:0.5, Electric:0.5, Steel:0.5 },
};

function getTypeEffectiveness(atkType, defTypes) {
  const chart = TYPE_CHART[atkType] || {};
  return (defTypes || ['Normal']).reduce((m, dt) => m * (chart[dt] ?? 1.0), 1.0);
}

/** HP d'un Pokémon pour la durée du combat (basé sur sa DEF + niveau) */
function calcCombatHp(stats, level) {
  return Math.max(10, Math.floor(stats.def * 1.5 + level * 2 + 10));
}

/** Dégâts infligés — formule inspirée Gen, × 4 pour un rythme de 3-8 tours */
function calcCombatDamage(atk, def, level, typeMod = 1.0) {
  const rand = 0.85 + Math.random() * 0.15;
  return Math.max(1, Math.floor(((2 * level / 5 + 2) * 60 * (atk / Math.max(1, def)) / 50 + 2) * typeMod * rand * 4));
}

// ── Zone Income Collection ─────────────────────────────────────

function openCollectionModal(zoneId) {
  const state = globalThis.state;
  const zs = globalThis.initZone(zoneId);
  const income = zs.pendingIncome || 0;
  const items  = { ...zs.pendingItems };
  if (income === 0 && Object.keys(items).length === 0) return;

  // Récolte automatique débloquée et activée : skip animation, collecte instantanée
  if (state.purchases?.autoCollect && state.purchases?.autoCollectEnabled !== false) {
    autoCollectZone(zoneId);
    globalThis.saveState();
    globalThis.updateTopBar();
    globalThis.notify(`🤖 +${income.toLocaleString()}₽ (auto-récolte)`, 'gold');
    _zsRefreshIncome(zoneId);
      _zsUpdateButtons();
    return;
  }

  const zoneAgents = state.agents.filter(a => a.assignedZone === zoneId);
  const agentIds   = zoneAgents.map(a => a.id);

  // Vérification mode découverte
  if (state.settings.discoveryMode) {
    const dexCaught = Object.values(state.pokedex).filter(e => e.caught).length;
    const hasBossTeam = (state.gang.bossTeam || []).length > 0;
    if (dexCaught < 10 || !hasBossTeam) {
      const missing = [];
      if (dexCaught < 10) missing.push(`${10 - dexCaught} espèce(s) de plus dans le Pokédex`);
      if (!hasBossTeam) missing.push('au moins 1 Pokémon dans l\'équipe Boss (onglet Gang)');
      globalThis.notify(`⚔ Combat non disponible — il te faut : ${missing.join(' et ')}`, 'error');
      return;
    }
  }
  // Combat direct — sans écran VS intermédiaire
  startZoneCollection(zoneId, agentIds);
}

function showCollectionEncounter(zoneId, agentIds, income, items) {
  const state = globalThis.state;
  // En mode découverte, bloquer si < 10 pokédex et pas de boss team
  if (state.settings.discoveryMode) {
    const dexCaught = Object.values(state.pokedex).filter(e => e.caught).length;
    const hasBossTeam = (state.gang.bossTeam || []).length > 0;
    if (dexCaught < 10 || !hasBossTeam) {
      const missing = [];
      if (dexCaught < 10) missing.push(`${10 - dexCaught} espèce(s) de plus dans le Pokédex`);
      if (!hasBossTeam) missing.push('au moins 1 Pokémon dans l\'équipe Boss (onglet Gang)');
      globalThis.notify(`⚔ Combat non disponible — il te faut : ${missing.join(' et ')}`, 'error');
      return;
    }
  }
  const zone = ZONE_BY_ID[zoneId];
  const zoneName = zone ? (state.lang === 'fr' ? zone.fr : zone.en) : zoneId;
  const zoneAgents = agentIds.map(id => state.agents.find(a => a.id === id)).filter(Boolean);

  // Ennemis : policier aléatoire
  const policePool = ['officer', 'policeman', 'acetrainer', 'sabrina', 'officer'];
  const enemyKey = policePool[Math.floor(Math.random() * policePool.length)];

  // Pokémon du boss
  const bossPks = state.gang.bossTeam.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);

  const modal = document.createElement('div');
  modal.id = 'collectionEncounter';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9200;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;';

  const trainerSprite = globalThis.trainerSprite;
  const pokeSprite = globalThis.pokeSprite;

  const agentSpritesHtml = zoneAgents.map(a =>
    `<img src="${a.sprite}" style="width:44px;height:44px;image-rendering:pixelated" onerror="this.src='${trainerSprite('acetrainer')}'"><span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">${a.name}</span>`
  ).join('');

  const bossPksHtml = bossPks.slice(0,3).map(pk =>
    `<img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:36px;height:36px;image-rendering:pixelated">`
  ).join('');

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:24px;max-width:480px;width:92%;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">⚡ INTERCEPTION — ${zoneName}</div>

      <!-- Scène de rencontre -->
      <div style="display:flex;align-items:center;justify-content:center;gap:24px;width:100%;padding:12px;background:rgba(0,0,0,.4);border-radius:var(--radius-sm);border:1px solid var(--border)">
        <!-- Côté Boss -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px" id="encounterPlayerSide">
          ${state.gang.bossSprite
            ? `<img src="${trainerSprite(state.gang.bossSprite)}" style="width:56px;height:56px;image-rendering:pixelated;animation:trainerLeft 1s ease-in-out infinite">`
            : ''}
          ${zoneAgents.length > 0 ? `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">${agentSpritesHtml}</div>` : ''}
          <div style="display:flex;gap:3px;margin-top:2px">${bossPksHtml}</div>
          <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text)">${state.gang.bossName}</span>
        </div>

        <!-- VS -->
        <div style="font-family:var(--font-pixel);font-size:16px;color:var(--red)">VS</div>

        <!-- Côté ennemi -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
          <img src="${trainerSprite(enemyKey)}" style="width:56px;height:56px;image-rendering:pixelated;animation:trainerRight 1s ease-in-out infinite;transform:scaleX(-1)">
          <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">Officier Jenny</span>
        </div>
      </div>

      <div style="font-size:10px;color:var(--text-dim)">La police intercepte le convoy de récolte...</div>

      <button id="btnEncounterFight" style="font-family:var(--font-pixel);font-size:9px;padding:10px 24px;background:var(--red-dark);border:2px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer;animation:glow 1.5s ease-in-out infinite alternate">⚔ COMBATTRE !</button>
    </div>`;

  document.body.appendChild(modal);

  modal.querySelector('#btnEncounterFight').addEventListener('click', () => {
    modal.remove();
    startZoneCollection(zoneId, agentIds);
  });

  // Clic hors modal = fermer sans combattre
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function startZoneCollection(zoneId, agentIds) {
  const state = globalThis.state;
  const zs = globalThis.initZone(zoneId);
  const income = zs.pendingIncome || 0;
  const items  = { ...zs.pendingItems } || {};

  // Player power: boss team + selected agents
  let playerPower = 0;
  for (const pkId of state.gang.bossTeam) {
    const p = state.pokemons.find(pk => pk.id === pkId);
    if (p) playerPower += globalThis.getPokemonPower(p);
  }
  for (const agId of agentIds) {
    const ag = state.agents.find(a => a.id === agId);
    if (ag) playerPower += globalThis.getAgentCombatPower(ag);
  }

  const enemyBase = 800 + Math.floor(income / 100);
  const enemyPower = enemyBase * (0.8 + Math.random() * 0.4);
  const playerRoll = playerPower * (0.75 + Math.random() * 0.5);
  const win = playerRoll >= enemyPower;

  const collected = Math.round(income * (win ? 1.0 : 0.50));

  state.gang.money += collected;
  globalThis.checkMoneyMilestone();
  zs.pendingIncome = 0;

  for (const [itemId, qty] of Object.entries(items)) {
    state.inventory[itemId] = (state.inventory[itemId] || 0) + qty;
  }
  zs.pendingItems = {};

  if (win) {
    state.stats.totalFightsWon = (state.stats.totalFightsWon || 0) + 1;
  } else {
    state.gang.reputation = Math.max(0, state.gang.reputation - 3);
  }

  globalThis.saveState();
  globalThis.updateTopBar();

  showCollectionResult(win, collected, items, agentIds);
}

function showCollectionResult(win, amount, items, agentIds) {
  const state = globalThis.state;
  const modal = document.createElement('div');
  modal.id = 'collectionResult';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9300;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;';

  const itemsHtml = Object.entries(items).length > 0
    ? `<div style="display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;margin-top:8px">
        ${Object.entries(items).map(([id, qty]) => `${globalThis.itemSprite(id)}<span style="font-size:10px;color:var(--text)">×${qty}</span>`).join('')}
       </div>` : '';

  // Generate a random police opponent
  const policeTrainers = ['officer', 'policeman', 'acetrainer', 'sabrina'];
  const policeKey = policeTrainers[Math.floor(Math.random() * policeTrainers.length)];
  const policeName = 'Officier Jenny';

  const trainerSprite = globalThis.trainerSprite;

  // Battle scene HTML
  const combatSceneHtml = `
    <div style="display:flex;align-items:center;justify-content:center;gap:16px;padding:10px;background:rgba(0,0,0,.4);border-radius:var(--radius-sm);border:1px solid ${win ? 'var(--gold-dim)' : 'var(--red)'}">
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
        ${state.gang.bossSprite ? `<img src="${trainerSprite(state.gang.bossSprite)}" style="width:40px;height:40px;image-rendering:pixelated;${win ? '' : 'opacity:0.5;filter:grayscale(1)'}">` : ''}
        ${(agentIds || []).slice(0,2).map(id => { const ag = state.agents.find(a => a.id === id); return ag ? `<img src="${ag.sprite}" style="width:28px;height:28px;image-rendering:pixelated;${win ? '' : 'opacity:0.5;filter:grayscale(1)'}">` : ''; }).join('')}
        <span style="font-size:8px;color:${win ? 'var(--green)' : 'var(--red)'}">${win ? 'Victoire' : 'KO'}</span>
      </div>
      <div style="font-family:var(--font-pixel);font-size:14px;color:${win ? 'var(--gold)' : 'var(--red)'}">VS</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
        <img src="${trainerSprite(policeKey)}" style="width:40px;height:40px;image-rendering:pixelated;${win ? 'opacity:0.5;filter:grayscale(1)' : ''}">
        <span style="font-size:8px;color:var(--text-dim)">${policeName}</span>
      </div>
    </div>`;

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid ${win ? 'var(--gold)' : 'var(--red)'};border-radius:var(--radius);padding:28px;max-width:400px;width:90%;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center">
      ${combatSceneHtml}
      <div style="font-family:var(--font-pixel);font-size:12px;color:${win ? 'var(--gold)' : 'var(--red)'}">
        ${win ? 'Récolte réussie !' : 'Défaite — 50% récupérés'}
      </div>
      <div style="font-family:var(--font-pixel);font-size:18px;color:var(--gold)" id="collectAmountDisplay">0₽</div>
      ${itemsHtml}
      <button id="collectResultClose" style="font-family:var(--font-pixel);font-size:9px;padding:8px 20px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;margin-top:4px">Fermer</button>
    </div>`;

  document.body.appendChild(modal);
  document.getElementById('collectResultClose').addEventListener('click', () => { modal.remove(); renderZonesTab(); });
  modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); renderZonesTab(); } });

  const display = document.getElementById('collectAmountDisplay');
  const steps = 55;
  const K = 5; // courbure exponentielle (plus grand = démarrage plus lent / fin plus rapide)
  const expMax = Math.exp(K) - 1;
  let step = 0;
  const interval = setInterval(() => {
    step++;
    const t = step / steps;
    const eased = (Math.exp(K * t) - 1) / expMax; // 0→0, 0.5→~8%, 1→100%
    const current = Math.min(amount, Math.round(amount * eased));
    display.textContent = current.toLocaleString() + '₽';
    if (step >= steps) {
      display.textContent = amount.toLocaleString() + '₽';
      clearInterval(interval);
      globalThis.SFX.play('coin');
      // Animation de pièces après décompte
      setTimeout(() => spawnCoinRain(win, amount), 200);
    }
  }, 25);
}

function spawnCoinRain(win, amount) {
  // Sprite mascotte
  const mascotKey = win ? 'meowth' : 'growlithe';
  const mascotSrc = globalThis.pokeSprite(mascotKey);
  const topBar = document.getElementById('topBar');
  if (!topBar) return;
  const tbRect = topBar.getBoundingClientRect();

  // Afficher la mascotte en bas à droite brièvement
  const mascot = document.createElement('div');
  mascot.style.cssText = `position:fixed;bottom:60px;right:30px;z-index:9500;animation:fvhIn .3s ease;`;
  mascot.innerHTML = `<img src="${mascotSrc}" style="width:64px;height:64px;image-rendering:pixelated;${win ? '' : 'filter:grayscale(.5)'}">`;
  document.body.appendChild(mascot);
  setTimeout(() => mascot.remove(), 2500);

  // Nombre de pièces proportionnel au montant (max 20)
  const coinCount = Math.min(20, Math.max(4, Math.floor(amount / 500)));
  const symbol = win ? '₽' : '−₽';
  const color  = win ? '#ffcc5a' : '#cc4444';

  for (let i = 0; i < coinCount; i++) {
    setTimeout(() => {
      const coin = document.createElement('div');
      const startX = 60 + Math.random() * (window.innerWidth - 120);
      const startY = window.innerHeight - 80 - Math.random() * 120;
      coin.style.cssText = `
        position:fixed;z-index:9400;pointer-events:none;
        font-family:var(--font-pixel);font-size:11px;color:${color};
        left:${startX}px;top:${startY}px;
        text-shadow:0 0 4px ${color};
      `;
      coin.textContent = symbol;
      document.body.appendChild(coin);

      // Voler vers la topbar
      const targetX = tbRect.left + tbRect.width / 2 + (Math.random() - 0.5) * 80;
      const targetY = tbRect.top + tbRect.height / 2;
      const duration = 600 + Math.random() * 400;

      coin.animate([
        { left: startX + 'px', top: startY + 'px', opacity: 1, transform: 'scale(1)' },
        { left: targetX + 'px', top: targetY + 'px', opacity: 0.8, transform: 'scale(0.6)' },
      ], { duration, easing: 'ease-in', fill: 'forwards' }).onfinish = () => {
        coin.remove();
        globalThis.SFX.play('coin');
      };
    }, i * 60);
  }
}

// ── Récolte automatique ───────────────────────────────────────
function autoCollectZone(zoneId) {
  const state = globalThis.state;
  const zs = globalThis.initZone(zoneId);
  const income = zs.pendingIncome || 0;
  const items = { ...zs.pendingItems };
  if (income === 0 && Object.keys(items).length === 0) return 0;
  state.gang.money += income;
  globalThis.checkMoneyMilestone();
  zs.pendingIncome = 0;
  for (const [id, qty] of Object.entries(items)) {
    state.inventory[id] = (state.inventory[id] || 0) + qty;
  }
  zs.pendingItems = {};
  return income;
}

// ── Tout récolter ─────────────────────────────────────────────
function collectAllZones() {
  const state = globalThis.state;
  // Include ALL zones (open or closed) that have pending income from agents
  const zones = Object.keys(state.zones).filter(zid => (state.zones[zid]?.pendingIncome || 0) > 0);
  if (zones.length === 0) { globalThis.notify('Aucune récolte en attente.', ''); return; }

  // Si auto-collect débloqué et activé → récolte silencieuse instantanée
  if (state.purchases?.autoCollect && state.purchases?.autoCollectEnabled !== false) {
    let total = 0;
    for (const zid of zones) total += autoCollectZone(zid);
    globalThis.saveState();
    globalThis.updateTopBar();
    globalThis.notify(`🤖 Récolte auto : +${total.toLocaleString()}₽`, 'gold');
    zones.forEach(zid => _zsRefreshIncome(zid));
      _zsUpdateButtons();
    return;
  }

  // Sinon → combat puis affichage séquentiel
  const modal = document.createElement('div');
  modal.id = 'collectAllModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9300;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;';

  // Calcul combat global (pool de force combiné)
  let playerPower = 0;
  for (const pkId of state.gang.bossTeam) {
    const p = state.pokemons.find(pk => pk.id === pkId);
    if (p) playerPower += globalThis.getPokemonPower(p);
  }
  for (const a of state.agents) {
    if (zones.includes(a.assignedZone)) playerPower += globalThis.getAgentCombatPower(a);
  }
  const totalIncome = zones.reduce((s, zid) => s + (state.zones[zid]?.pendingIncome || 0), 0);
  const enemyBase = 800 + Math.floor(totalIncome / 200);
  const win = (playerPower * (0.75 + Math.random() * 0.5)) >= enemyBase * (0.8 + Math.random() * 0.4);

  // Mascotte centrale
  const mascotKey = win ? 'meowth' : 'growlithe';
  const mascotSrc = globalThis.pokeSprite(mascotKey);
  const collected = Math.round(totalIncome * (win ? 1.0 : 0.50));

  // Résultat par zone (lignes)
  const zoneRows = zones.map(zid => {
    const zone = ZONE_BY_ID[zid];
    const inc = state.zones[zid]?.pendingIncome || 0;
    const got = Math.round(inc * (win ? 1.0 : 0.50));
    return { zid, name: zone ? (state.lang === 'fr' ? zone.fr : zone.en) : zid, inc, got };
  });

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid ${win ? 'var(--gold)' : 'var(--red)'};border-radius:var(--radius);padding:24px;max-width:480px;width:92%;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center">
      <img src="${mascotSrc}" style="width:80px;height:80px;image-rendering:pixelated;${win ? '' : 'filter:grayscale(.5)'}">
      <div style="font-family:var(--font-pixel);font-size:12px;color:${win ? 'var(--gold)' : 'var(--red)'}">${win ? '✓ Récolte réussie !' : '✗ Défaite — 50% récupérés'}</div>
      <div id="collectAllRows" style="width:100%;display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto">
        ${zoneRows.map((r, i) => `<div id="collectRow_${i}" style="display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid var(--border);font-size:10px;opacity:.4">
          <span style="color:var(--text-dim)">${r.name}</span>
          <span id="collectRowAmt_${i}" style="color:var(--gold)">—</span>
        </div>`).join('')}
      </div>
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim)">TOTAL</div>
      <div style="font-family:var(--font-pixel);font-size:20px;color:var(--gold)" id="collectAllTotal">—</div>
      <button id="collectAllClose" style="font-family:var(--font-pixel);font-size:9px;padding:8px 20px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;opacity:0" disabled>Fermer</button>
    </div>`;

  document.body.appendChild(modal);

  // Vider toutes les zones et créditer le bon montant (100% victoire, 50% défaite)
  for (const row of zoneRows) {
    const zs = globalThis.initZone(row.zid);
    for (const [id, qty] of Object.entries(zs.pendingItems || {})) {
      state.inventory[id] = (state.inventory[id] || 0) + qty;
    }
    zs.pendingIncome = 0;
    zs.pendingItems = {};
  }
  state.gang.money += collected;
  globalThis.checkMoneyMilestone();
  if (!win) state.gang.reputation = Math.max(0, state.gang.reputation - 3);
  else state.stats.totalFightsWon = (state.stats.totalFightsWon || 0) + 1;
  globalThis.saveState();
  globalThis.updateTopBar();

  // Animate rows sequentially, then reveal total
  let idx = 0;
  function revealNext() {
    if (idx < zoneRows.length) {
      const row = document.getElementById(`collectRow_${idx}`);
      const amt = document.getElementById(`collectRowAmt_${idx}`);
      if (row) row.style.opacity = '1';
      if (amt) { amt.textContent = '+' + zoneRows[idx].got.toLocaleString() + '₽'; globalThis.SFX.play('coin'); }
      idx++;
      setTimeout(revealNext, 400);
    } else {
      // Reveal total
      const totalEl = document.getElementById('collectAllTotal');
      if (totalEl) totalEl.textContent = collected.toLocaleString() + '₽';
      const closeBtn = document.getElementById('collectAllClose');
      if (closeBtn) { closeBtn.style.opacity = '1'; closeBtn.disabled = false; }
    }
  }
  setTimeout(revealNext, 300);

  document.getElementById('collectAllClose')?.addEventListener('click', () => {
    modal.remove();
    zoneRows.forEach(r => _zsRefreshIncome(r.zid));
      _zsUpdateButtons();
  });
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.remove();
      zoneRows.forEach(r => _zsRefreshIncome(r.zid));
        _zsUpdateButtons();
    }
  });
}

// ════════════════════════════════════════════════════════════════
// Zone Tab + Windows
// ════════════════════════════════════════════════════════════════

// ── Zone view mode (fog | stats) ────────────────────────────────
let _zonesViewMode = 'fog';

function renderZonesTab() {
  _zsRenderSelector();
  renderZoneWindows();
  _zsBindActions();
  globalThis.renderGangBasePanel();
  // Bind stats toggle (idempotent via _bound flag)
  const btnStats = document.getElementById('btnToggleZoneStats');
  if (btnStats && !btnStats._bound) {
    btnStats._bound = true;
    btnStats.addEventListener('click', () => {
      _zonesViewMode = _zonesViewMode === 'fog' ? 'stats' : 'fog';
      _applyZoneViewMode();
    });
  }
  _applyZoneViewMode();
}

function _applyZoneViewMode() {
  const btn = document.getElementById('btnToggleZoneStats');
  if (_zonesViewMode === 'stats') {
    if (btn) { btn.textContent = '🗺'; btn.title = 'Vue carte'; btn.style.background = 'rgba(255,204,90,.2)'; btn.style.borderColor = 'var(--gold-dim)'; }
    _renderZoneStatsView();
  } else {
    if (btn) { btn.textContent = '📊'; btn.title = 'Vue statistiques'; btn.style.background = ''; btn.style.borderColor = ''; }
    // Restore normal fogmap — hide stats overlay if present
    const overlay = document.getElementById('zoneStatsOverlay');
    if (overlay) overlay.remove();
    document.getElementById('zoneSelector')?.style.removeProperty('display');
    document.querySelector('.fog-fav-sidebar')?.style.removeProperty('display');
  }
}

function _renderZoneStatsView() {
  const state       = globalThis.state;
  const openZones   = globalThis.openZones;
  const zoneTimers  = globalThis.zoneTimers || {};

  // Hide fogmap, show stats overlay in same container
  document.getElementById('zoneSelector')?.style.setProperty('display', 'none');
  document.querySelector('.fog-fav-sidebar')?.style.setProperty('display', 'none');

  const fogLayout = document.querySelector('.fog-map-layout');
  if (!fogLayout) return;

  // Only include zones that are either unlocked or have activity
  const allZones = ZONES.filter(z => z.type !== 'gang_park' && (
    globalThis.isZoneUnlocked?.(z.id) ||
    (state.zones?.[z.id]?.combatsWon || 0) > 0
  ));

  const rows = allZones.map(zone => {
    const zs       = state.zones?.[zone.id] || {};
    const isVisible = openZones?.has(zone.id);          // fenêtre ouverte
    const isRunning = !!zoneTimers[zone.id];             // timer actif (ouverte OU agent)
    const agents   = state.agents.filter(a => a.assignedZone === zone.id);
    const income   = zs.pendingIncome || 0;
    const combats  = zs.combatsWon   || 0;
    const caps     = zs.captures     || 0;

    // Deux dimensions indépendantes :
    //   Activité : ACTIF (vert) si timer tourne, INACTIF (gris) sinon
    //   Fenêtre  : Visible (or) si ouverte, Fond (gris) si agent seul, rien si inactif
    const actifBadge = isRunning
      ? `<span style="font-family:var(--font-pixel);font-size:7px;color:var(--green)">ACTIF</span>`
      : `<span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">INACTIF</span>`;
    const fenetreBadge = isRunning
      ? `<span style="font-family:var(--font-pixel);font-size:6px;color:${isVisible ? 'var(--gold)' : 'var(--text-dim)'}">
           ${isVisible ? '👁 Visible' : '⚙ Fond'}
         </span>`
      : '';
    const statusCell = `<div style="display:flex;flex-direction:column;align-items:center;gap:1px">${actifBadge}${fenetreBadge}</div>`;

    const agentNames = agents.map(a => a.name).join(', ') || '—';
    const incomeFmt  = income > 0 ? `<b style="color:var(--gold)">${income.toLocaleString()}₽</b>` : '<span style="color:var(--text-dim)">0₽</span>';

    const collectBtn = income > 0
      ? `<button class="zstat-collect" data-zone="${zone.id}" style="font-family:var(--font-pixel);font-size:7px;padding:2px 7px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;white-space:nowrap">₽ Récolter</button>`
      : '';
    const openBtn = !isVisible
      ? `<button class="zstat-open" data-zone="${zone.id}" style="font-family:var(--font-pixel);font-size:7px;padding:2px 7px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;white-space:nowrap">▶ Ouvrir</button>`
      : `<button class="zstat-close" data-zone="${zone.id}" style="font-family:var(--font-pixel);font-size:7px;padding:2px 7px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;white-space:nowrap">✕ Fermer</button>`;

    return `<tr style="border-bottom:1px solid var(--border);${income > 0 ? 'background:rgba(255,204,90,.04)' : ''}">
      <td style="padding:5px 8px;font-size:9px;white-space:nowrap">
        <span style="font-family:var(--font-pixel);font-size:8px;color:var(--text)">${state.lang === 'fr' ? zone.fr : zone.en}</span>
        <span style="font-size:7px;color:var(--text-dim);margin-left:4px">${zone.type}</span>
      </td>
      <td style="padding:5px 8px;text-align:center">${statusCell}</td>
      <td style="padding:5px 8px;font-size:8px;color:var(--text-dim);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${agentNames}">${agentNames}</td>
      <td style="padding:5px 8px;font-size:8px;text-align:right">${incomeFmt}</td>
      <td style="padding:5px 8px;font-size:8px;color:var(--text-dim);text-align:center">${combats > 0 ? `⚔ ${combats}` : '—'}</td>
      <td style="padding:5px 8px;font-size:8px;color:var(--text-dim);text-align:center">${caps > 0 ? `🎯 ${caps}` : '—'}</td>
      <td style="padding:5px 8px;text-align:right;white-space:nowrap;display:flex;gap:4px;justify-content:flex-end">${collectBtn}${openBtn}</td>
    </tr>`;
  }).join('');

  const totalIncome = Object.values(state.zones || {}).reduce((s, zs) => s + (zs.pendingIncome || 0), 0);

  let overlay = document.getElementById('zoneStatsOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'zoneStatsOverlay';
    overlay.style.cssText = 'width:100%;overflow-x:auto';
    fogLayout.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div style="padding:8px 4px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">📊 STATISTIQUES DES ZONES</div>
      ${totalIncome > 0 ? `<button id="zstatCollectAll" style="font-family:var(--font-pixel);font-size:8px;padding:4px 10px;background:rgba(255,204,90,.12);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">₽ Tout récolter (${totalIncome.toLocaleString()}₽)</button>` : ''}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:9px">
      <thead>
        <tr style="border-bottom:2px solid var(--border)">
          <th style="padding:4px 8px;text-align:left;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);font-weight:normal">ZONE</th>
          <th style="padding:4px 8px;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);font-weight:normal">ÉTAT</th>
          <th style="padding:4px 8px;text-align:left;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);font-weight:normal">AGENTS</th>
          <th style="padding:4px 8px;text-align:right;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);font-weight:normal">À RÉCOLTER</th>
          <th style="padding:4px 8px;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);font-weight:normal">COMBATS</th>
          <th style="padding:4px 8px;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);font-weight:normal">CAPTURES</th>
          <th style="padding:4px 8px;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);font-weight:normal"></th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="7" style="padding:16px;text-align:center;color:var(--text-dim);font-size:9px">Aucune zone accessible</td></tr>'}</tbody>
    </table>`;

  // Bind buttons
  overlay.querySelectorAll('.zstat-collect').forEach(btn => {
    btn.addEventListener('click', () => globalThis.openCollectionModal?.(btn.dataset.zone));
  });
  overlay.querySelectorAll('.zstat-open').forEach(btn => {
    btn.addEventListener('click', () => { globalThis.openZoneWindow?.(btn.dataset.zone); _renderZoneStatsView(); });
  });
  overlay.querySelectorAll('.zstat-close').forEach(btn => {
    btn.addEventListener('click', () => { globalThis.closeZoneWindow?.(btn.dataset.zone); _renderZoneStatsView(); });
  });
  overlay.querySelector('#zstatCollectAll')?.addEventListener('click', () => globalThis.collectAllZones?.());
}

// Expose for live refresh from background ticks
globalThis._refreshZoneStatsView = () => {
  if (_zonesViewMode === 'stats') _renderZoneStatsView();
  // Always refresh income tiles in fog mode
  if (_zonesViewMode === 'fog') {
    const state = globalThis.state;
    Object.keys(state.zones || {}).forEach(zid => _zsRefreshIncome(zid));
    _zsUpdateButtons();
  }
};

function openZoneWindow(zoneId) {
  const state     = globalThis.state;
  const openZones = globalThis.openZones;
  const zoneSpawns = globalThis.zoneSpawns;

  // Guard : si déjà ouverte, ne rien faire
  if (openZones.has(zoneId)) { _zsRefreshTile(zoneId); return; }

  openZones.add(zoneId);
  // Le timer unifié existe peut-être déjà (zone avait des agents) → startActiveZone est idempotent.
  // Le callback branché sur openZones.has(zoneId) basculera automatiquement en mode visuel.
  globalThis.startActiveZone(zoneId);

  if (!state.openZoneOrder) state.openZoneOrder = [];
  if (!state.openZoneOrder.includes(zoneId)) state.openZoneOrder.push(zoneId);
  globalThis.saveState();
  globalThis.initZone(zoneId);
  zoneSpawns[zoneId] = []; // liste visuelle de spawns — fraîche à chaque ouverture
  if (!state.gang.bossZone || !openZones.has(state.gang.bossZone)) state.gang.bossZone = zoneId;

  globalThis.MusicPlayer?.updateFromContext();
  _zsRefreshTile(zoneId);
  globalThis.renderGangBasePanel();
  renderZoneWindows();
  _zsUpdateButtons();
}

function closeZoneWindow(zoneId) {
  const state     = globalThis.state;
  const openZones = globalThis.openZones;
  const zoneSpawns = globalThis.zoneSpawns;

  openZones.delete(zoneId);
  state.openZoneOrder = (state.openZoneOrder || []).filter(id => id !== zoneId);
  globalThis.saveState();

  // Nettoyer les spawns visuels
  if (zoneSpawns[zoneId]) {
    for (const s of zoneSpawns[zoneId]) { if (s.timeout) clearTimeout(s.timeout); }
    delete zoneSpawns[zoneId];
  }

  // Délai de grâce 5 s : si aucun agent n'est assigné après 5 s, le timer s'arrête.
  // Si des agents sont présents, le timer continue en mode silencieux automatiquement.
  globalThis.pauseZoneIfIdle(zoneId);

  globalThis.MusicPlayer?.updateFromContext();
  _zsRefreshTile(zoneId);
  globalThis.renderGangBasePanel();
  renderZoneWindows();
  _zsUpdateButtons();
}
