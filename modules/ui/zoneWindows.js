// ════════════════════════════════════════════════════════════════
//  ZONE WINDOWS MODULE
//  Extracted from app.js — DOM rendering + interactions
// ════════════════════════════════════════════════════════════════
//
//  Globals read from app.js via globalThis:
//    state, pick, randInt, uid, notify, saveState
//    initZone, spawnInZone, isZoneDegraded, getZoneMastery
//    rollChestLoot, activateEvent, makeTrainerTeam
//    tryCapture, applyCombatResult, getCombatRepGain
//    checkForNewlyUnlockedZones, triggerGymRaid
//    startBackgroundZone, stopBackgroundZone
//    levelUpPokemon, getPokemonPower, getTeamPower, getAgentCombatPower
//    checkMoneyMilestone, pokeSprite, pokeSpriteBack, trainerSprite
//    speciesName, addLog, addBattleLogEntry, pushFeedEvent, updateTopBar
//    renderGangTab, renderPCTab, renderZonesTab
//    showConfirm, showRarePopup, showShinyPopup, getTrainerDialogue
//    SFX, activeTab
//    openZones, zoneSpawns, zoneTimers
//    ZONE_BGS, ITEM_SPRITE_URLS, BALL_SPRITES, MAX_COMBAT_REWARD
//    SPECIAL_TRAINER_KEYS
//    getKantoQuestEncounterForZone (+ getJohtoQuestEncounterForZone /
//    getHoennQuestEncounterForZone / getSinnohQuestEncounterForZone /
//    getDeoxysQuestEncounterForZone once migrated) — sprite persistant de
//    quête dans une fenêtre de zone, voir _getActiveQuestEncounterForZone
//
//  Injected via configureZoneWindowTicks(ctx):
//    getOpenZones, getActiveTab, refreshAllFogTiles
//
//  Classic-script globals accessed by bare name:
//    ZONES, ZONE_BY_ID, ZONES_JOHTO, ZONE_JOHTO_BY_ID,
//    ZONES_HOENN, ZONE_HOENN_BY_ID, ZONES_SINNOH, ZONE_SINNOH_BY_ID,
//    SPECIES_BY_EN, TRAINER_TYPES, SPECIAL_EVENTS
// ════════════════════════════════════════════════════════════════

import {
  renderZoneSelector    as _zsRenderSelector,
  bindZoneActionButtons as _zsBindActions,
  refreshZoneTile       as _zsRefreshTile,
  refreshZoneIncomeTile as _zsRefreshIncome,
  updateZoneButtons     as _zsUpdateButtons,
} from './zoneSelector.js';
import { TRAINER_TYPES } from '../../data/trainers-data.js';
import {
  getTrainerCombatPreview,
  getTrainerCombatSummary,
} from '../systems/zoneCombat.js';
import { resolveEventBattle } from '../systems/eventCombat.js';
import { AUTO_COMBAT_VISUAL_MS } from '../../data/gameplay-config-data.js';

import { EventBus, EVENTS } from '../core/eventBus.js';
import { esc as _esc } from '../core/escape.js';
import { getDifficultyTier, getDifficultyBadgeHtml } from '../systems/difficultyTier.js';
import { isOnboardingFirstEncounter } from '../systems/onboardingFlow.js';

const _notify = (msg, type = '', category = null) => EventBus.emit(EVENTS.UI_NOTIFY, { msg, type, category });
const _dirty  = ()               => EventBus.emit(EVENTS.STATE_DIRTY);
const _topBar = ()               => EventBus.emit(EVENTS.UI_TOPBAR_UPDATE);
const _save   = ()               => globalThis.saveState?.();
const _t      = (...a)           => globalThis.t?.(...a) ?? a[0];
let zoneWindowTickContext = {};

function configureZoneWindowTicks(ctx = {}) {
  zoneWindowTickContext = { ...zoneWindowTickContext, ...ctx };
}

function getTickOpenZones() {
  return zoneWindowTickContext.getOpenZones?.() ?? globalThis.openZones ?? new Set();
}

function getTickActiveTab() {
  return zoneWindowTickContext.getActiveTab?.() ?? globalThis.activeTab;
}

function refreshTickFogTiles() {
  return zoneWindowTickContext.refreshAllFogTiles?.();
}


// ── Module-level state ────────────────────────────────────────
const zoneNextSpawn = {}; // zoneId -> { countdown, lastSpawnType }
const zoneSpawnHistory = {}; // zoneId -> { pokemon:N, trainer:N, total:N }
let currentCombat = null;

function _zwActiveRegion() {
  return globalThis._zsel_getActiveRegion?.() || 'kanto';
}

function _zwIsJohtoZone(zoneId) {
  return typeof ZONE_JOHTO_BY_ID !== 'undefined' && !!ZONE_JOHTO_BY_ID[zoneId];
}
function _zwIsHoennZone(zoneId) {
  return typeof ZONE_HOENN_BY_ID !== 'undefined' && !!ZONE_HOENN_BY_ID[zoneId];
}
function _zwIsSinnohZone(zoneId) {
  return typeof ZONE_SINNOH_BY_ID !== 'undefined' && !!ZONE_SINNOH_BY_ID[zoneId];
}

function _zwActiveZones() {
  const region = _zwActiveRegion();
  if (region === 'johto')  return typeof ZONES_JOHTO  !== 'undefined' ? ZONES_JOHTO  : [];
  if (region === 'hoenn')  return typeof ZONES_HOENN  !== 'undefined' ? ZONES_HOENN  : [];
  if (region === 'sinnoh') return typeof ZONES_SINNOH !== 'undefined' ? ZONES_SINNOH : [];
  // kanto — filter out all other regions
  return ZONES.filter(z => !_zwIsJohtoZone(z.id) && !_zwIsHoennZone(z.id) && !_zwIsSinnohZone(z.id));
}

// ── Wing drop config ──────────────────────────────────────────
// Chaque zone associe un TABLEAU de configs (pas un objet unique) : certaines
// zones proposent plusieurs ombres possibles (ex. seafoam_islands = zone
// d'Articuno ET zone de l'ombre de Lugia). `requiresOwned` (optionnel) gate
// une config sur la capture préalable de l'oiseau correspondant — inutile de
// distribuer un ticket de rejeu avant que le combat original soit gagné.
const SPECIAL_WING_EVENTS = {
  seafoam_islands: [
    {
      item:            'silver_wing',
      itemName:        "Argent'Aile",
      itemNameEn:      'Silver Wing',
      minDrop:         1,
      maxDrop:         5,
      legendaryShadow: 'lugia',       // espèce dont le sprite est utilisé en ombre
      shadowLabel:     'Ombre de Lugia',
      shadowLabelEn:   "Lugia's Shadow",
      spawnChance:     0.06,          // 6% par tick de spawn (mastery >= 2)
      despawnMs:       20_000,        // l'ombre disparaît après 20 s si non cliquée
    },
    {
      item:            'plume_sacree',
      itemName:        'Plume Sacrée',
      itemNameEn:      'Sacred Feather',
      minDrop:         1,
      maxDrop:         1,             // ticket de rejeu rare — pas de variance comme les ailes
      legendaryShadow: 'articuno',
      shadowLabel:     "Ombre d'Artikodin",
      shadowLabelEn:   "Articuno's Shadow",
      spawnChance:     0.05,
      despawnMs:       20_000,
      requiresOwned:   'articuno',
    },
  ],
  power_plant: [
    {
      item:            'plume_sacree',
      itemName:        'Plume Sacrée',
      itemNameEn:      'Sacred Feather',
      minDrop:         1,
      maxDrop:         1,
      legendaryShadow: 'zapdos',
      shadowLabel:     'Ombre de Zapdos',
      shadowLabelEn:   "Zapdos's Shadow",
      spawnChance:     0.05,
      despawnMs:       20_000,
      requiresOwned:   'zapdos',
    },
  ],
  victory_road: [
    {
      item:            'rainbow_wing',
      itemName:        "Arcenci'Aile",
      itemNameEn:      'Rainbow Wing',
      minDrop:         1,
      maxDrop:         5,
      legendaryShadow: 'ho-oh',
      shadowLabel:     'Ombre de Ho-Oh',
      shadowLabelEn:   "Ho-Oh's Shadow",
      spawnChance:     0.06,
      despawnMs:       20_000,
    },
    {
      item:            'plume_sacree',
      itemName:        'Plume Sacrée',
      itemNameEn:      'Sacred Feather',
      minDrop:         1,
      maxDrop:         1,
      legendaryShadow: 'moltres',
      shadowLabel:     'Ombre de Sulfura',
      shadowLabelEn:   "Moltres's Shadow",
      spawnChance:     0.05,
      despawnMs:       20_000,
      requiresOwned:   'moltres',
    },
  ],
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
  Fairy:    { Fighting:2, Dragon:2, Dark:2, Fire:0.5, Poison:0.5, Steel:0.5 },
};

function getTypeEffectiveness(atkType, defTypes) {
  const chart = TYPE_CHART[atkType] || {};
  return (defTypes || ['Normal']).reduce((m, dt) => m * (chart[dt] ?? 1.0), 1.0);
}

/** HP d'un Pokémon pour la durée du combat (basé sur sa DEF + niveau) */
function calcCombatHp(stats, level) {
  return Math.max(10, Math.floor(stats.def * 1.5 + level * 2 + 10));
}

// Exported so other modules (agent, zoneSystem) can use it for coverage calculations
globalThis.getTypeEffectiveness = getTypeEffectiveness;

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
    _save();
    _topBar();
    _notify(_t('zone_auto_collect_notice', { amount: income.toLocaleString() }), 'gold');
    _zsRefreshIncome(zoneId);
      _zsUpdateButtons();
    return;
  }

  const zoneAgents = state.agents.filter(a => a.assignedZone === zoneId);
  const agentIds   = zoneAgents.map(a => a.id);

  // Combat direct — sans écran VS intermédiaire
  startZoneCollection(zoneId, agentIds);
}

function showCollectionEncounter(zoneId, agentIds, income, items) {
  const state = globalThis.state;
  const zone = ZONE_BY_ID[zoneId];
  const zoneName = zone ? (state.lang === 'fr' ? zone.fr : zone.en) : zoneId;
  const zoneAgents = agentIds.map(id => globalThis.agentById?.(id) ?? state.agents.find(a => a.id === id)).filter(Boolean);

  // Ennemis : policier aléatoire
  const policePool = ['officer', 'policeman', 'acetrainer', 'sabrina', 'officer'];
  const enemyKey = policePool[Math.floor(Math.random() * policePool.length)];

  // Pokémon du boss
  const bossPks = state.gang.bossTeam.map(id => globalThis.pokemonById?.(id) ?? state.pokemons.find(p => p.id === id)).filter(Boolean);

  const modal = document.createElement('div');
  modal.id = 'collectionEncounter';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9200;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;';

  const trainerSprite = globalThis.trainerSprite;
  const pokeSprite = globalThis.pokeSprite;

  const agentSpritesHtml = zoneAgents.map(a =>
    `<img src="${a.sprite}" style="width:44px;height:44px;image-rendering:pixelated" onerror="this.src='${trainerSprite('acetrainer')}'"><span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">${a.name}</span>`
  ).join('');

  const bossPksHtml = bossPks.slice(0, 6).map(pk =>
    `<img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:36px;height:36px;image-rendering:pixelated">`
  ).join('');

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:24px;max-width:480px;width:92%;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center">
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">⚡ ${_t('zone_interception').toUpperCase()} — ${zoneName}</div>

      <!-- Scène de rencontre -->
      <div style="display:flex;align-items:center;justify-content:center;gap:24px;width:100%;padding:12px;background:rgba(0,0,0,.4);border-radius:var(--radius-sm);border:1px solid var(--border)">
        <!-- Côté Boss -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px" id="encounterPlayerSide">
          ${state.gang.bossSprite
            ? `<img src="${trainerSprite(state.gang.bossSprite)}" style="width:56px;height:56px;image-rendering:pixelated;animation:trainerLeft 1s ease-in-out infinite">`
            : ''}
          ${zoneAgents.length > 0 ? `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">${agentSpritesHtml}</div>` : ''}
          <div style="display:flex;gap:3px;margin-top:2px">${bossPksHtml}</div>
          <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text)">${_esc(state.gang.bossName)}</span>
        </div>

        <!-- VS -->
        <div style="font-family:var(--font-pixel);font-size:16px;color:var(--red)">VS</div>

        <!-- Côté ennemi -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
          <img src="${trainerSprite(enemyKey)}" style="width:56px;height:56px;image-rendering:pixelated;animation:trainerRight 1s ease-in-out infinite;transform:scaleX(-1)">
        <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">${_t('zone_officer_jenny')}</span>
        </div>
      </div>

      <div style="font-size:10px;color:var(--text-dim)">${_t('zone_police_intercepts')}</div>

      <button id="btnEncounterFight" style="font-family:var(--font-pixel);font-size:9px;padding:10px 24px;background:var(--red-dark);border:2px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer;animation:glow 1.5s ease-in-out infinite alternate">⚔ ${_t('zone_fight').toUpperCase()} !</button>
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

  // Player power: boss team (cached) + selected agents
  let playerPower = globalThis.getBossTeamPower(state);
  for (const agId of agentIds) {
    const ag = globalThis.agentById?.(agId) ?? state.agents.find(a => a.id === agId);
    if (ag) playerPower += globalThis.getAgentCombatPower(ag);
  }

  const enemyBase = 800 + Math.floor(income / 100);
  const enemyPower = enemyBase * (0.8 + Math.random() * 0.4);
  const playerRoll = playerPower * (0.75 + Math.random() * 0.5);
  const win = playerRoll >= enemyPower;

  const collected = Math.round(income * (win ? 1.0 : 0.50));

  state.gang.money += collected;
  EventBus.emit(EVENTS.MONEY_CHANGED, { delta: collected, newTotal: state.gang.money });
  globalThis.checkMoneyMilestone();
  zs.pendingIncome = 0;

  for (const [itemId, qty] of Object.entries(items)) {
    state.inventory[itemId] = (state.inventory[itemId] || 0) + qty;
  }
  zs.pendingItems = {};

  if (win) {
    state.stats.totalFightsWon = (state.stats.totalFightsWon || 0) + 1;
  } else {
    const _repBefore = state.gang.reputation;
    state.gang.reputation = Math.max(0, state.gang.reputation - 3);
    EventBus.emit(EVENTS.REP_CHANGED, { delta: state.gang.reputation - _repBefore, newTotal: state.gang.reputation });
  }

  _save();
  _topBar();

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
          <span style="font-size:8px;color:${win ? 'var(--green)' : 'var(--red)'}">${win ? _t('zone_victory') : 'KO'}</span>
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
        ${win ? _t('zone_collect_success') : _t('zone_collect_defeat_half')}
      </div>
      <div style="font-family:var(--font-pixel);font-size:18px;color:var(--gold)" id="collectAmountDisplay">0₽</div>
      ${itemsHtml}
      <button id="collectResultClose" style="font-family:var(--font-pixel);font-size:9px;padding:8px 20px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;margin-top:4px">${_t('zone_close')}</button>
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
  EventBus.emit(EVENTS.MONEY_CHANGED, { delta: income, newTotal: state.gang.money });
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
  if (zones.length === 0) { _notify(_t('zone_no_pending_collection'), ''); return; }

  // Si auto-collect débloqué et activé → récolte silencieuse instantanée
  if (state.purchases?.autoCollect && state.purchases?.autoCollectEnabled !== false) {
    let total = 0;
    for (const zid of zones) total += autoCollectZone(zid);
    _save();
    _topBar();
    _notify(_t('zone_auto_collect_total', { amount: total.toLocaleString() }), 'gold');
    zones.forEach(zid => _zsRefreshIncome(zid));
      _zsUpdateButtons();
    return;
  }

  // Sinon → combat puis affichage séquentiel
  const modal = document.createElement('div');
  modal.id = 'collectAllModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9300;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;';

  // Calcul combat global (pool de force combiné, boss via cache)
  let playerPower = globalThis.getBossTeamPower(state);
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
      <div style="font-family:var(--font-pixel);font-size:12px;color:${win ? 'var(--gold)' : 'var(--red)'}">${win ? _t('zone_collect_success_mark') : _t('zone_collect_defeat_half_mark')}</div>
      <div id="collectAllRows" style="width:100%;display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto">
        ${zoneRows.map((r, i) => `<div id="collectRow_${i}" style="display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid var(--border);font-size:10px;opacity:.4">
          <span style="color:var(--text-dim)">${r.name}</span>
          <span id="collectRowAmt_${i}" style="color:var(--gold)">—</span>
        </div>`).join('')}
      </div>
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim)">${_t('zone_total').toUpperCase()}</div>
      <div style="font-family:var(--font-pixel);font-size:20px;color:var(--gold)" id="collectAllTotal">—</div>
      <button id="collectAllClose" style="font-family:var(--font-pixel);font-size:9px;padding:8px 20px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;opacity:0" disabled>${_t('zone_close')}</button>
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
  EventBus.emit(EVENTS.MONEY_CHANGED, { delta: collected, newTotal: state.gang.money });
  globalThis.checkMoneyMilestone();
  if (!win) {
    const _repBefore = state.gang.reputation;
    state.gang.reputation = Math.max(0, state.gang.reputation - 3);
    EventBus.emit(EVENTS.REP_CHANGED, { delta: state.gang.reputation - _repBefore, newTotal: state.gang.reputation });
  } else {
    state.stats.totalFightsWon = (state.stats.totalFightsWon || 0) + 1;
  }
  _save();
  _topBar();

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
  const switcher = document.getElementById('regionSwitcher');
  if (switcher) {
    // Always visible — region buttons show locked/available/active states
    switcher.style.display = 'flex';
    const state = globalThis.state;
    const johtoUnlocked  = !!state?.purchases?.johtoUnlocked;
    const hoennUnlocked  = !!state?.purchases?.hoennUnlocked;
    const sinnohUnlocked = !!state?.purchases?.sinnohUnlocked;

    const johtoQualified = !johtoUnlocked &&
      !!state?.zones?.['indigo_plateau']?.gymDefeated &&
      (state?.gang?.reputation || 0) >= 500;

    const hoennQualified = !hoennUnlocked && johtoUnlocked &&
      !!state?.zones?.['indigo_johto']?.gymDefeated &&
      (state?.gang?.reputation || 0) >= 2000 &&
      (globalThis.getGangPower?.() || 0) >= 2500;

    const sinnohQualified = !sinnohUnlocked && hoennUnlocked &&
      !!state?.zones?.['ever_grande_hoenn']?.gymDefeated &&
      (state?.gang?.reputation || 0) >= 3500 &&
      (globalThis.getGangPower?.() || 0) >= 5000;

    // Guard: fall back to an unlocked region if the active one is unavailable
    const ar = _zwActiveRegion();
    if (ar === 'sinnoh' && !sinnohUnlocked) {
      globalThis._zsel_setActiveRegion?.(hoennUnlocked ? 'hoenn' : johtoUnlocked ? 'johto' : 'kanto');
    } else if (ar === 'hoenn' && !hoennUnlocked) {
      globalThis._zsel_setActiveRegion?.(johtoUnlocked ? 'johto' : 'kanto');
    } else if (ar === 'johto' && !johtoUnlocked) {
      globalThis._zsel_setActiveRegion?.('kanto');
    }

    // Show Hoenn/Sinnoh buttons (+ separator) only once their prerequisite region is unlocked
    const hoennBtn    = switcher.querySelector('[data-region="hoenn"]');
    const sinnohBtn   = switcher.querySelector('[data-region="sinnoh"]');
    const hoennDivider = document.getElementById('regionDividerHoenn');
    if (hoennBtn)    hoennBtn.style.display    = johtoUnlocked ? '' : 'none';
    if (sinnohBtn)   sinnohBtn.style.display   = hoennUnlocked ? '' : 'none';
    if (hoennDivider) hoennDivider.style.display = johtoUnlocked ? '' : 'none';

    if (!switcher._bound) {
      switcher._bound = true;
      switcher.querySelectorAll('.region-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const region    = btn.dataset.region;
          const jUnlocked = !!globalThis.state?.purchases?.johtoUnlocked;
          const hUnlocked = !!globalThis.state?.purchases?.hoennUnlocked;
          const sUnlocked = !!globalThis.state?.purchases?.sinnohUnlocked;

          if (region === 'johto' && !jUnlocked) {
            const jQual = !!globalThis.state?.zones?.['indigo_plateau']?.gymDefeated &&
              (globalThis.state?.gang?.reputation || 0) >= 500;
            if (jQual) { globalThis.showJohtoUnlockModal?.(); }
            else { _notify("🔒 Johto — Vainquez le Champion Lance au Plateau Indigo d'abord !", 'error'); }
            return;
          }

          if (region === 'hoenn' && !hUnlocked) {
            const hQual = jUnlocked &&
              !!globalThis.state?.zones?.['indigo_johto']?.gymDefeated &&
              (globalThis.state?.gang?.reputation || 0) >= 2000 &&
              (globalThis.getGangPower?.() || 0) >= 2500;
            if (hQual) { globalThis.checkHoennUnlock?.(); }
            else { _notify('🔒 Hoenn — Ligue Johto vaincue · 2 000 REP · Puissance ≥ 2 500 PC', 'error'); }
            return;
          }

          if (region === 'sinnoh' && !sUnlocked) {
            const sQual = hUnlocked &&
              !!globalThis.state?.zones?.['ever_grande_hoenn']?.gymDefeated &&
              (globalThis.state?.gang?.reputation || 0) >= 5000;
            if (sQual) { globalThis.checkSinnohUnlock?.(); }
            else { _notify('🔒 Sinnoh — Ligue Hoenn vaincue · 5 000 REP', 'error'); }
            return;
          }

          globalThis._zsel_setActiveRegion?.(region);
          switcher.querySelectorAll('.region-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.region === region);
          });
          renderZonesTab();
        });
      });
    }

    // Update button visual state on every render
    const activeRegion = _zwActiveRegion();

    const johtoBtn = switcher.querySelector('[data-region="johto"]');
    if (johtoBtn) {
      johtoBtn.classList.remove('active', 'region-btn-locked', 'region-btn-available');
      if (johtoUnlocked) {
        johtoBtn.classList.toggle('active', activeRegion === 'johto');
        johtoBtn.textContent = 'Johto';
        johtoBtn.title = '';
      } else if (johtoQualified) {
        johtoBtn.classList.add('region-btn-available');
        johtoBtn.textContent = 'Johto ✉';
        johtoBtn.title = _t('zone_johto_message_waiting');
      } else {
        johtoBtn.classList.add('region-btn-locked');
        johtoBtn.textContent = 'Johto 🔒';
        johtoBtn.title = _t('zone_johto_unlock_hint');
      }
    }

    if (hoennBtn) {
      hoennBtn.classList.remove('active', 'region-btn-locked', 'region-btn-available');
      if (hoennUnlocked) {
        hoennBtn.classList.toggle('active', activeRegion === 'hoenn');
        hoennBtn.textContent = 'Hoenn';
        hoennBtn.title = '';
      } else if (hoennQualified) {
        hoennBtn.classList.add('region-btn-available');
        hoennBtn.textContent = 'Hoenn ✉';
        hoennBtn.title = _t('zone_hoenn_message_waiting');
      } else {
        hoennBtn.classList.add('region-btn-locked');
        hoennBtn.textContent = 'Hoenn 🔒';
        hoennBtn.title = 'Ligue Johto vaincue · 2 000 REP · Puissance de gang ≥ 2 500 PC';
      }
    }

    if (sinnohBtn) {
      sinnohBtn.classList.remove('active', 'region-btn-locked', 'region-btn-available');
      if (sinnohUnlocked) {
        sinnohBtn.classList.toggle('active', activeRegion === 'sinnoh');
        sinnohBtn.textContent = 'Sinnoh';
        sinnohBtn.title = '';
      } else if (sinnohQualified) {
        sinnohBtn.classList.add('region-btn-available');
        sinnohBtn.textContent = 'Sinnoh ✉';
        sinnohBtn.title = _t('zone_sinnoh_message_waiting');
      } else {
        sinnohBtn.classList.add('region-btn-locked');
        sinnohBtn.textContent = 'Sinnoh 🔒';
        sinnohBtn.title = 'Ligue Hoenn vaincue · 3 500 REP · Puissance de gang ≥ 5 000 PC';
      }
    }

    switcher.querySelector('[data-region="kanto"]')?.classList.toggle('active', activeRegion === 'kanto');

    // ── Bouton quêtes Légendaires Groudon/Kyogre ──
    let lgmBtn = document.getElementById('lgm-quest-btn');
    const showLgm = hoennUnlocked && (state?.gang?.reputation || 0) >= 2500;
    if (showLgm) {
      if (!lgmBtn) {
        lgmBtn = document.createElement('button');
        lgmBtn.id = 'lgm-quest-btn';
        lgmBtn.style.cssText = `
          font-family:var(--font-pixel,monospace);font-size:7px;letter-spacing:1px;
          padding:4px 10px;border-radius:3px;cursor:pointer;
          background:rgba(180,60,200,.07);color:rgba(200,140,50,.85);
          border:1px solid rgba(200,140,50,.25);
          transition:background .15s,color .15s;margin-left:6px;
        `;
        lgmBtn.onmouseenter = () => { lgmBtn.style.background='rgba(200,140,50,.14)'; lgmBtn.style.color='#ffcc5a'; };
        lgmBtn.onmouseleave = () => { lgmBtn.style.background='rgba(180,60,200,.07)'; lgmBtn.style.color='rgba(200,140,50,.85)'; };
        lgmBtn.onclick = () => globalThis.openLegendaryMissions?.();
        switcher.appendChild(lgmBtn);
      }
      lgmBtn.style.display = '';
      const gStep = state?.groudonMission?.step ?? 0;
      const kStep = state?.kyogreMission?.step  ?? 0;
      const gDone = gStep === 6;
      const kDone = kStep === 6;
      if (gDone && kDone) {
        lgmBtn.textContent = '🌋🌊 ✓✓';
        lgmBtn.title = _t('zone_legendary_replay_hint');
        lgmBtn.style.borderColor = 'rgba(0,255,136,.3)'; lgmBtn.style.color = '#00ff88';
      } else if (!state?.groudonMission?.active) {
        lgmBtn.textContent = _t('zone_quests_button');
        lgmBtn.title = _t('zone_legendary_quests_available');
        lgmBtn.style.borderColor = 'rgba(255,204,90,.4)'; lgmBtn.style.color = '#ffcc5a';
      } else {
        const total = (gStep > 0 ? gStep : 0) + (kStep > 0 ? kStep : 0);
        lgmBtn.textContent = `🌋🌊 ${Math.min(gStep, 5)}·${Math.min(kStep, 5)}`;
        lgmBtn.title = _t('zone_legendary_progress', { magma: gStep, aqua: kStep });
      }
    } else if (lgmBtn) {
      lgmBtn.style.display = 'none';
    }

    // ── Bouton quête Deoxys (visible si Hoenn débloqué + quest active ou débloquée) ──
    let dxqBtn = document.getElementById('dxq-quest-btn');
    const deoxysMission = state?.deoxysMission;
    const showDxq = hoennUnlocked && !!state?.zones?.['ever_grande_hoenn']?.gymDefeated;
    if (showDxq) {
      if (!dxqBtn) {
        dxqBtn = document.createElement('button');
        dxqBtn.id = 'dxq-quest-btn';
        dxqBtn.style.cssText = `
          font-family:var(--font-pixel,monospace);font-size:7px;letter-spacing:1px;
          padding:4px 10px;border-radius:3px;cursor:pointer;
          background:rgba(0,200,255,.08);color:rgba(0,200,255,.8);
          border:1px solid rgba(0,200,255,.25);
          transition:background .15s,color .15s;margin-left:6px;
        `;
        dxqBtn.onmouseenter = () => { dxqBtn.style.background='rgba(0,200,255,.15)'; dxqBtn.style.color='#00e5ff'; };
        dxqBtn.onmouseleave = () => { dxqBtn.style.background='rgba(0,200,255,.08)'; dxqBtn.style.color='rgba(0,200,255,.8)'; };
        dxqBtn.onclick = () => globalThis.openDeoxysMission?.();
        switcher.appendChild(dxqBtn);
      }
      const step = deoxysMission?.step ?? 0;
      dxqBtn.style.display = '';
      if (!deoxysMission?.active) {
        dxqBtn.textContent = _t('zone_quest_button');
        dxqBtn.title = _t('zone_deoxys_available');
        dxqBtn.style.borderColor = 'rgba(255,204,90,.4)';
        dxqBtn.style.color = '#ffcc5a';
        dxqBtn.style.background = 'rgba(255,204,90,.06)';
      } else if (step === 6) {
        dxqBtn.textContent = '☄️ Deoxys ✓';
        dxqBtn.title = _t('zone_deoxys_complete');
        dxqBtn.style.borderColor = 'rgba(0,255,136,.3)';
        dxqBtn.style.color = '#00ff88';
        dxqBtn.style.background = 'rgba(0,255,136,.05)';
      } else {
        dxqBtn.textContent = `☄️ Deoxys ${step}/5`;
        dxqBtn.title = _t('zone_deoxys_progress', { step });
        dxqBtn.style.borderColor = 'rgba(0,200,255,.25)';
        dxqBtn.style.color = 'rgba(0,200,255,.8)';
        dxqBtn.style.background = 'rgba(0,200,255,.08)';
      }
    } else if (dxqBtn) {
      dxqBtn.style.display = 'none';
    }

    // ── Bouton quêtes Johto (Bêtes · Lugia · Ho-Oh) ──
    let jhmBtn = document.getElementById('jhm-quest-btn');
    const showJhm = johtoUnlocked && (state?.gang?.reputation || 0) >= 800
                  && (state?.betesMission?.active || state?.lugiaMission?.active || state?.hoohMission?.active);
    if (showJhm) {
      if (!jhmBtn) {
        jhmBtn = document.createElement('button');
        jhmBtn.id = 'jhm-quest-btn';
        jhmBtn.style.cssText = `
          font-family:var(--font-pixel,monospace);font-size:7px;letter-spacing:1px;
          padding:4px 10px;border-radius:3px;cursor:pointer;
          background:rgba(50,150,50,.08);color:rgba(100,200,100,.85);
          border:1px solid rgba(80,180,80,.25);
          transition:background .15s,color .15s;margin-left:6px;
        `;
        jhmBtn.onmouseenter = () => { jhmBtn.style.background='rgba(50,150,50,.18)'; jhmBtn.style.color='#90ee90'; };
        jhmBtn.onmouseleave = () => { jhmBtn.style.background='rgba(50,150,50,.08)'; jhmBtn.style.color='rgba(100,200,100,.85)'; };
        jhmBtn.onclick = () => globalThis.openJohtoMissions?.();
        switcher.appendChild(jhmBtn);
      }
      jhmBtn.style.display = '';
      const bStep = state?.betesMission?.step ?? 0;
      const lStep = state?.lugiaMission?.step  ?? 0;
      const hStep = state?.hoohMission?.step   ?? 0;
      const allDone = bStep === 6 && lStep === 6 && hStep === 6;
      if (allDone) {
        jhmBtn.textContent = '🐅🌊🌈 ✓';
        jhmBtn.title = _t('zone_johto_quests_complete');
        jhmBtn.style.borderColor = 'rgba(0,255,136,.3)'; jhmBtn.style.color = '#00ff88';
      } else {
        jhmBtn.textContent = `🐅🌊🌈 ${Math.min(bStep,5)}·${Math.min(lStep,5)}·${Math.min(hStep,5)}`;
        jhmBtn.title = _t('zone_johto_quests_progress', { beasts: bStep, lugia: lStep, hooh: hStep });
      }
    } else if (jhmBtn) {
      jhmBtn.style.display = 'none';
    }

    // ── Bouton quêtes Kanto (Oiseaux · Mewtwo) ──
    let ktmBtn = document.getElementById('ktm-quest-btn');
    const birdsMission  = state?.birdsMission;
    const mewtwoMission = state?.mewtwoMission;
    const anyBirdActive = birdsMission &&
      (birdsMission.articuno?.active || birdsMission.zapdos?.active || birdsMission.moltres?.active);
    const showKtm = anyBirdActive || mewtwoMission?.active;
    if (showKtm) {
      if (!ktmBtn) {
        ktmBtn = document.createElement('button');
        ktmBtn.id = 'ktm-quest-btn';
        ktmBtn.style.cssText = `
          font-family:var(--font-pixel,monospace);font-size:7px;letter-spacing:1px;
          padding:4px 10px;border-radius:3px;cursor:pointer;
          background:rgba(50,80,180,.08);color:rgba(120,160,230,.85);
          border:1px solid rgba(100,140,220,.25);
          transition:background .15s,color .15s;margin-left:6px;
        `;
        ktmBtn.onmouseenter = () => { ktmBtn.style.background='rgba(50,80,180,.18)'; ktmBtn.style.color='#aac0ff'; };
        ktmBtn.onmouseleave = () => { ktmBtn.style.background='rgba(50,80,180,.08)'; ktmBtn.style.color='rgba(120,160,230,.85)'; };
        ktmBtn.onclick = () => globalThis.openKantoMissions?.();
        switcher.appendChild(ktmBtn);
      }
      ktmBtn.style.display = '';
      const aStep = birdsMission?.articuno?.step ?? 0;
      const zStep = birdsMission?.zapdos?.step   ?? 0;
      const mStep = birdsMission?.moltres?.step  ?? 0;
      const mwStep = mewtwoMission?.step ?? 0;
      const allKantoDone = aStep >= 6 && zStep >= 6 && mStep >= 6 && mwStep >= 6;
      if (allKantoDone) {
        ktmBtn.textContent = '❄️⚡🔥🧬 ✓';
        ktmBtn.title = _t('zone_kanto_quests_complete');
        ktmBtn.style.borderColor = 'rgba(0,255,136,.3)'; ktmBtn.style.color = '#00ff88';
      } else {
        const bDone = [aStep,zStep,mStep].filter(s => s >= 6).length;
        ktmBtn.textContent = `❄️⚡🔥${bDone}/3 · 🧬${Math.min(mwStep,5)}/5`;
        ktmBtn.title = _t('zone_kanto_quests_progress', { articuno: aStep, zapdos: zStep, moltres: mStep, mewtwo: mwStep });
      }
    } else if (ktmBtn) {
      ktmBtn.style.display = 'none';
    }

    // ── Bouton quêtes Sinnoh (Galaxie · Giratina · Trio du Lac) ──
    let snmBtn = document.getElementById('snm-quest-btn');
    const galaxieMission  = state?.galaxieMission;
    const giratinaMission = state?.giratinaMission;
    const lakeMission     = state?.lakeMission;
    const anyLakeActive   = lakeMission &&
      (lakeMission.uxie?.active || lakeMission.mesprit?.active || lakeMission.azelf?.active);
    const showSnm = (galaxieMission?.active || anyLakeActive || giratinaMission?.active) &&
                    state?.purchases?.sinnohUnlocked;
    if (showSnm) {
      if (!snmBtn) {
        snmBtn = document.createElement('button');
        snmBtn.id = 'snm-quest-btn';
        snmBtn.style.cssText = `
          font-family:var(--font-pixel,monospace);font-size:7px;letter-spacing:1px;
          padding:4px 10px;border-radius:3px;cursor:pointer;
          background:rgba(60,40,100,.08);color:rgba(160,120,230,.85);
          border:1px solid rgba(130,90,200,.25);
          transition:background .15s,color .15s;margin-left:6px;
        `;
        snmBtn.onmouseenter = () => { snmBtn.style.background='rgba(60,40,100,.2)'; snmBtn.style.color='#c0a0ff'; };
        snmBtn.onmouseleave = () => { snmBtn.style.background='rgba(60,40,100,.08)'; snmBtn.style.color='rgba(160,120,230,.85)'; };
        snmBtn.onclick = () => globalThis.openSinnohMissions?.();
        switcher.appendChild(snmBtn);
      }
      snmBtn.style.display = '';
      const gxStep = galaxieMission?.step ?? 0;
      const lkDone = ['uxie','mesprit','azelf'].filter(k => lakeMission?.[k]?.owned).length;
      const lkActive = ['uxie','mesprit','azelf'].filter(k => lakeMission?.[k]?.active).length;
      const gtDone   = giratinaMission?.giratinaOwned ? '✓' : giratinaMission?.active ? `${giratinaMission.step}/3` : '';
      const allDone  = gxStep >= 6 && lkDone >= 3 && giratinaMission?.giratinaOwned;
      if (allDone) {
        snmBtn.textContent = '🌌💎👁️💛🩷💙 ✓';
        snmBtn.title = _t('zone_sinnoh_quests_complete');
        snmBtn.style.borderColor = 'rgba(0,255,136,.3)'; snmBtn.style.color = '#00ff88';
      } else {
        const parts = [];
        if (galaxieMission?.active) parts.push(`🌌${Math.min(gxStep,5)}/5`);
        if (giratinaMission?.active) parts.push(`👁️${gtDone}`);
        if (lkActive) parts.push(`💛🩷💙${lkDone}/${lkActive}`);
        snmBtn.textContent = parts.join(' · ');
        snmBtn.title = _t('zone_sinnoh_quests_progress', { galaxy: gxStep, lake: lkDone });
      }
    } else if (snmBtn) {
      snmBtn.style.display = 'none';
    }
  }

  _zsRenderSelector();
  renderZoneWindows();
  _zsBindActions();
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
    if (btn) { btn.textContent = '🗺'; btn.title = _t('zone_view_map'); btn.style.background = 'rgba(255,204,90,.2)'; btn.style.borderColor = 'var(--gold-dim)'; }
    _renderZoneStatsView();
  } else {
    if (btn) { btn.textContent = '📊'; btn.title = _t('zone_view_stats'); btn.style.background = ''; btn.style.borderColor = ''; }
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
  const allZones = _zwActiveZones().filter(z => z.type !== 'gang_park' && z.type !== 'vivarium' && (
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
      ? `<span style="font-family:var(--font-pixel);font-size:7px;color:var(--green)">${_t('zone_active').toUpperCase()}</span>`
      : `<span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">${_t('zone_inactive').toUpperCase()}</span>`;
    const fenetreBadge = isRunning
      ? `<span style="font-family:var(--font-pixel);font-size:6px;color:${isVisible ? 'var(--gold)' : 'var(--text-dim)'}">
           ${isVisible ? _t('zone_stats_visible') : _t('zone_stats_background')}
         </span>`
      : '';
    const statusCell = `<div style="display:flex;flex-direction:column;align-items:center;gap:1px">${actifBadge}${fenetreBadge}</div>`;

    const agentNames = agents.map(a => a.name).join(', ') || '—';
    const incomeFmt  = income > 0 ? `<b style="color:var(--gold)">₽</b>` : '<span style="color:var(--text-dim)">—</span>';

    const collectBtn = income > 0
      ? `<button class="zstat-collect" data-zone="${zone.id}" style="font-family:var(--font-pixel);font-size:7px;padding:2px 7px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;white-space:nowrap">₽ ${_t('zone_collect')}</button>`
      : '';
    const openBtn = !isVisible
      ? `<button class="zstat-open" data-zone="${zone.id}" style="font-family:var(--font-pixel);font-size:7px;padding:2px 7px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;white-space:nowrap">▶ ${_t('zone_open')}</button>`
      : `<button class="zstat-close" data-zone="${zone.id}" style="font-family:var(--font-pixel);font-size:7px;padding:2px 7px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;white-space:nowrap">✕ ${_t('zone_close')}</button>`;

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
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">📊 ${_t('zone_statistics').toUpperCase()}</div>
      ${totalIncome > 0 ? `<button id="zstatCollectAll" style="font-family:var(--font-pixel);font-size:8px;padding:4px 10px;background:rgba(255,204,90,.12);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">₽ ${_t('zone_collect_all')}</button>` : ''}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:9px">
      <thead>
        <tr style="border-bottom:2px solid var(--border)">
          <th style="padding:4px 8px;text-align:left;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);font-weight:normal">${_t('zone_zone').toUpperCase()}</th>
          <th style="padding:4px 8px;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);font-weight:normal">${_t('zone_status').toUpperCase()}</th>
          <th style="padding:4px 8px;text-align:left;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);font-weight:normal">${_t('zone_agents').toUpperCase()}</th>
          <th style="padding:4px 8px;text-align:right;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);font-weight:normal">${_t('zone_to_collect').toUpperCase()}</th>
          <th style="padding:4px 8px;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);font-weight:normal">${_t('zone_battles').toUpperCase()}</th>
          <th style="padding:4px 8px;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);font-weight:normal">${_t('zone_captures').toUpperCase()}</th>
          <th style="padding:4px 8px;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);font-weight:normal"></th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="7" style="padding:16px;text-align:center;color:var(--text-dim);font-size:9px">${_t('zone_none_accessible')}</td></tr>`}</tbody>
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

const ZONE_OPEN_WARNING_THRESHOLD = 10;
let zoneOpenWarningShown = false;

function maybeWarnManyOpenZones(openZones) {
  if (zoneOpenWarningShown || (openZones?.size || 0) <= ZONE_OPEN_WARNING_THRESHOLD) return;
  zoneOpenWarningShown = true;
  const count = openZones.size;
  const message = `<b>${_t('zone_open_count', { n: count })}</b><br><span style="color:var(--text-dim);font-size:11px">${_t('zone_open_performance_hint')}</span>`;
  if (typeof globalThis.showConfirm === 'function') {
    setTimeout(() => globalThis.showConfirm(message, null, null, {
      lang: globalThis.state?.lang || 'fr',
      confirmLabel: _t('zone_understood'),
      cancelLabel: _t('zone_close'),
    }), 0);
  } else {
    _notify(_t('zone_many_open_warning', { n: count }), 'gold');
  }
}

function openZoneWindow(zoneId) {
  const state     = globalThis.state;
  const openZones = globalThis.openZones;
  const zoneSpawns = globalThis.zoneSpawns;

  // Guard : si déjà ouverte, ne rien faire
  if (openZones.has(zoneId)) { _zsRefreshTile(zoneId); return; }

  openZones.add(zoneId);
  globalThis.trackEvent?.('zone_entered', { zone: zoneId });
  maybeWarnManyOpenZones(openZones);
  // Le timer unifié existe peut-être déjà (zone avait des agents) → startActiveZone est idempotent.
  // Le callback branché sur openZones.has(zoneId) basculera automatiquement en mode visuel.
  globalThis.startActiveZone(zoneId);

  if (!state.openZoneOrder) state.openZoneOrder = [];
  if (!state.openZoneOrder.includes(zoneId)) state.openZoneOrder.push(zoneId);
  const _zs = globalThis.initZone(zoneId);
  // Persistent unlock flag — zone reste accessible même si la réputation chute plus tard
  _zs.unlocked = true;
  _save();
  zoneSpawns[zoneId] = []; // liste visuelle de spawns — fraîche à chaque ouverture
  if (!state.gang.bossZone || !openZones.has(state.gang.bossZone)) state.gang.bossZone = zoneId;

  globalThis.MusicPlayer?.updateFromContext();
  _zsRefreshTile(zoneId);
  _dirty();
  renderZoneWindows();
  _zsUpdateButtons();
}

function closeZoneWindow(zoneId) {
  const state     = globalThis.state;
  const openZones = globalThis.openZones;
  const zoneSpawns = globalThis.zoneSpawns;

  // Un combat en cours dans cette zone (interactif OU auto-combat visuel) ne
  // doit pas continuer à tourner dans le vide une fois la fenêtre fermée —
  // sinon ses timers restent actifs sur un DOM détaché jusqu'à la fin
  // naturelle de l'animation, bloquant cette zone (et, pour currentCombat,
  // verrou global, l'auto-combat des agents dans TOUTES les autres zones
  // ouvertes) pendant tout ce temps.
  teardownZoneCombat(zoneId);

  openZones.delete(zoneId);
  state.openZoneOrder = (state.openZoneOrder || []).filter(id => id !== zoneId);
  _save();

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
  _dirty();
  renderZoneWindows();
  _zsUpdateButtons();
}

function renderZoneWindows() {
  const state = globalThis.state;
  const openZones = globalThis.openZones;
  const zoneSpawns = globalThis.zoneSpawns;

  const container = document.getElementById('zoneWindows');
  if (!container) return;

  // Filtrer par région active — seules les zones de la région sélectionnée sont affichées
  const activeRegion = _zwActiveRegion();
  const zoneIds = [...openZones].filter(id => {
    if (!ZONE_BY_ID[id] || ZONE_BY_ID[id].type === 'gang_park' || ZONE_BY_ID[id].type === 'vivarium') return false;
    const isJohto  = _zwIsJohtoZone(id);
    const isHoenn  = _zwIsHoennZone(id);
    const isSinnoh = _zwIsSinnohZone(id);
    if (activeRegion === 'johto')  return isJohto;
    if (activeRegion === 'hoenn')  return isHoenn;
    if (activeRegion === 'sinnoh') return isSinnoh;
    // kanto — exclure toutes les autres régions
    return !isJohto && !isHoenn && !isSinnoh;
  });

  // "No zones" placeholder — pas si gang_park/vivarium (gérées à part) sont ouvertes,
  // sinon le hint "sélectionnez une zone" s'affiche par-dessus une fenêtre déjà ouverte.
  const hasSpecialWindow = openZones?.has('gang_park') || openZones?.has('vivarium');
  let placeholder = container.querySelector('.zone-placeholder');
  if (zoneIds.length === 0 && !hasSpecialWindow) {
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = 'zone-placeholder';
      placeholder.style.cssText = 'color:var(--text-dim);padding:20px 0;text-align:center;width:100%';
      placeholder.textContent = _t('zone_select_grid_hint');
      container.appendChild(placeholder);
    }
    container.querySelectorAll('.zone-window').forEach(el => el.remove());
    return;
  }
  placeholder?.remove();

  // ── Remove zone windows that are no longer open ───────────────
  // gang_park/vivarium are deliberately absent from zoneIds (filtered at the
  // top of this function) — they're managed by their own toggle functions,
  // not this generic open/close loop, so they must be excluded here too.
  const activeIdSet = new Set(zoneIds);
  container.querySelectorAll('.zone-window').forEach(el => {
    const id = el.id.replace('zw-', '');
    if (id === 'gang_park' || id === 'vivarium') return;
    if (!activeIdSet.has(id)) el.remove();
  });

  // ── Sort open zones by saved order ───────────────────────────
  const ordered = zoneIds.sort((a, b) => {
    const order = state.openZoneOrder || [];
    const oa = order.indexOf(a);
    const ob = order.indexOf(b);
    return (oa === -1 ? 999 : oa) - (ob === -1 ? 999 : ob);
  });

  // ── Update or create each open zone window ────────────────────
  const _appendZoneWindow = (zoneId, targetContainer) => {
    if (zoneId === 'gang_park' || zoneId === 'vivarium' || ZONE_BY_ID[zoneId]?.type === 'gang_park' || ZONE_BY_ID[zoneId]?.type === 'vivarium') return;
    const existing = document.getElementById(`zw-${zoneId}`);
    if (existing) {
      patchZoneWindow(zoneId, existing);
    } else {
      const win = buildZoneWindowEl(zoneId);
      win.setAttribute('draggable', 'true');
      win.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', zoneId); win.style.opacity = '0.5'; });
      win.addEventListener('dragend', () => { win.style.opacity = ''; });
      win.addEventListener('dragover', e => { e.preventDefault(); win.style.borderColor = 'var(--gold)'; });
      win.addEventListener('dragleave', () => { win.style.borderColor = ''; });
      win.addEventListener('drop', e => {
        e.preventDefault(); win.style.borderColor = '';
        const sourceId = e.dataTransfer.getData('text/plain');
        if (sourceId === zoneId) return;
        const order = [...openZones];
        const fromIdx = order.indexOf(sourceId);
        const toIdx = order.indexOf(zoneId);
        if (fromIdx !== -1 && toIdx !== -1) {
          order.splice(fromIdx, 1); order.splice(toIdx, 0, sourceId);
          state.openZoneOrder = order; _save(); renderZoneWindows();
        }
      });
      targetContainer.appendChild(win);
      updateZoneTimers(zoneId);
      (zoneSpawns[zoneId] || []).forEach(s => renderSpawnInWindow(zoneId, s));
    }
  };

  for (const zoneId of ordered) _appendZoneWindow(zoneId, container);
}

// ── Zone level badge ─────────────────────────────────────────────
function _zoneLevelHtml(zoneId) {
  const lv = globalThis.getZoneLevel?.(zoneId) || 1;
  return `<span style="font-family:var(--font-pixel);font-size:8px;color:var(--gold)">${_t('zone_level_short', { level: lv })}</span>`;
}

// ── Zone context menu (right-click on viewport) ───────────────────────────────
function _openZoneContextMenu(zoneId, clientX, clientY) {
  // Remove any existing context menu
  document.getElementById('zone-ctx-menu')?.remove();

  const state   = globalThis.state;
  const zone    = ZONE_BY_ID[zoneId] || {};
  const zState  = state.zones[zoneId] || {};
  const mastery = globalThis.getZoneMastery?.(zoneId) ?? 0;
  const assignedAgents = state.agents.filter(a => a.assignedZone === zoneId);
  const name = state.lang === 'fr' ? zone.fr : zone.en;

  // ── Combat preview ────────────────────────────────────────────
  const preview = getTrainerCombatPreview({ zoneId, trainerKey: zone.eliteTrainer }, null);
  const atkPow  = preview.attackerPower;
  const defPow  = preview.defenderPower;
  const winPct  = defPow <= 0 ? 100 : Math.round(Math.min(100, (atkPow / (atkPow + defPow)) * 100));
  const barW    = Math.max(3, Math.min(97, winPct));

  // ── Pokémon pool ──────────────────────────────────────────────
  const pool = zone.pool || [];
  const poolHtml = pool.length
    ? pool.map(sp => {
        const caught = state.pokedex[sp]?.caught;
        const sprUrl = globalThis.pokeSprite(sp, false);
        const spName = globalThis.speciesName?.(sp) ?? sp;
        return `<span title="${spName}" style="display:inline-flex;flex-direction:column;align-items:center;gap:1px;opacity:${caught ? 1 : 0.45}">
          <img src="${sprUrl}" style="width:28px;height:28px;image-rendering:pixelated">
        </span>`;
      }).join('')
    : `<span style="color:var(--text-dim);font-size:10px">—</span>`;

  // ── Trainers ──────────────────────────────────────────────────
  const regularTrainers = (zone.trainers || []);
  const eliteKey = zone.eliteTrainer;
  const gymKey   = zone.gymLeader;
  const gymType  = zone.gymType;
  const gymDefeated = zState.gymDefeated;

  const _trainerRow = (key, badge) => {
    const t = TRAINER_TYPES[key];
    if (!t) return '';
    const tName = state.lang === 'fr' ? t.fr : t.en;
    const tSprite = globalThis.trainerSprite?.(t.sprite || key) ?? '';
    return `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.06)">
      <img src="${tSprite}" style="width:28px;height:28px;image-rendering:pixelated;flex-shrink:0" onerror="this.style.display='none'">
      <div style="flex:1;min-width:0">
        <div style="font-size:10px;color:var(--text)">${tName}</div>
        <div style="font-size:8px;color:var(--text-dim)">${_t('zone_difficulty_short')} ${t.diff} · ${t.reward[0]}–${t.reward[1]}₽ · +${t.rep}⭐</div>
      </div>
      ${badge ? `<span style="font-family:var(--font-pixel);font-size:7px;padding:1px 4px;background:rgba(200,60,60,.3);border:1px solid var(--red);border-radius:2px;color:var(--red);white-space:nowrap">${badge}</span>` : ''}
    </div>`;
  };

  // Deduplicate regular trainers for display
  const uniqRegular = [...new Set(regularTrainers)];
  const trainersHtml = [
    ...uniqRegular.map(k => _trainerRow(k, '')),
    eliteKey && eliteKey !== gymKey ? _trainerRow(eliteKey, _t('zone_elite_badge')) : '',
    gymKey ? _trainerRow(gymKey, gymDefeated ? `GYM ✓ ${gymType}` : `GYM ${gymType}`) : '',
  ].filter(Boolean).join('');

  // ── Mastery stars ─────────────────────────────────────────────
  const masteryStars = ['☆','☆','☆'].map((s, i) => i < mastery ? '★' : '☆').join('');

  // ── Agents ────────────────────────────────────────────────────
  const agentsHtml = assignedAgents.length
    ? assignedAgents.map(a => {
        const tp = (a.team || []).reduce((s, id) => {
          const p = state.pokemons?.find(pk => pk.id === id);
          return s + (p ? (globalThis.getPokemonPower?.(p) ?? 0) : 0);
        }, 0);
        return `<div style="display:flex;align-items:center;gap:5px;font-size:10px;padding:1px 0">
          <img src="${a.sprite}" style="width:20px;height:20px;image-rendering:pixelated" onerror="this.style.display='none'">
          <span>${a.name}</span>
          <span style="color:var(--text-dim);font-size:9px;margin-left:auto">${a.title ?? ''} · PC ${tp}</span>
        </div>`;
      }).join('')
    : `<span style="color:var(--text-dim);font-size:10px">${_t('zone_no_assigned_agent')}</span>`;

  // ── Spawn rate display ────────────────────────────────────────
  const spawnSecs = zone.spawnRate > 0 ? Math.round(1 / zone.spawnRate) : null;
  const spawnLabel = spawnSecs != null ? `~${spawnSecs}s / spawn` : '—';

  // ── Type badge ────────────────────────────────────────────────
  const typeColors = { route:'#2a6', city:'#26a', special:'#96a', gang_park:'#a62' };
  const typeLabels = {
    route: _t('zone_type_route'),
    city: _t('zone_type_city'),
    special: _t('zone_type_special'),
    gang_park: _t('zone_type_hq'),
  };
  const typeBg  = typeColors[zone.type] ?? '#444';
  const typeLabel = typeLabels[zone.type] ?? (zone.type ?? '?').toUpperCase();

  // ── Build panel ───────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'zone-ctx-menu';
  panel.style.cssText = [
    'position:fixed',
    `left:${clientX}px`,
    `top:${clientY}px`,
    'z-index:9999',
    'background:var(--bg-panel,#111)',
    'border:1px solid var(--border,#333)',
    'border-radius:4px',
    'box-shadow:0 4px 24px rgba(0,0,0,.8)',
    'min-width:260px',
    'max-width:300px',
    'max-height:80vh',
    'overflow-y:auto',
    'font-family:var(--font-ui,sans-serif)',
    'font-size:11px',
    'color:var(--text,#e8e8e8)',
    'user-select:none',
    'animation:fadeIn .12s ease',
  ].join(';');

  panel.innerHTML = `
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid var(--border);background:rgba(0,0,0,.3)">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="background:${typeBg};font-family:var(--font-pixel);font-size:7px;padding:1px 4px;border-radius:2px">${typeLabel}</span>
        <span style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">${name}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">${masteryStars}</span>
        <button id="zone-ctx-close" style="background:none;border:none;color:var(--text-dim);font-size:14px;cursor:pointer;line-height:1;padding:0 2px">&times;</button>
      </div>
    </div>

    <!-- Zone stats row -->
    <div style="display:flex;gap:0;border-bottom:1px solid var(--border)">
      ${[
        ['⭐', _t('zone_required_rep_short'), zone.repRequired ?? zone.rep ?? 0],
        ['🎯', _t('zone_captures'), zState.captures || 0],
        ['⚔', _t('zone_battles'), zState.combatsWon || 0],
        ['⏱', _t('zone_spawn'), spawnLabel],
      ].map(([icon, label, val]) => `
        <div style="flex:1;padding:5px 4px;text-align:center;border-right:1px solid var(--border)">
          <div style="font-size:9px;color:var(--text-dim)">${icon} ${label}</div>
          <div style="font-size:10px;color:var(--text);font-weight:bold;margin-top:1px">${val}</div>
        </div>`).join('')}
    </div>

    <!-- Combat power preview -->
    <div style="padding:8px 10px;border-bottom:1px solid var(--border)">
      <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:5px">${_t('zone_combat_power').toUpperCase()}</div>
      <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:4px">
        <span style="color:#5af">${_t('zone_attack')} <strong>${atkPow.toLocaleString()}</strong></span>
        <span style="color:${winPct >= 50 ? '#5a5' : '#a55'}">${_t('zone_win_percent', { percent: winPct })}</span>
        <span style="color:#f55">${_t('zone_defense')} <strong>${defPow.toLocaleString()}</strong></span>
      </div>
      <div style="height:5px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${barW}%;background:linear-gradient(90deg,#4af,#5a5);transition:width .3s"></div>
      </div>
      <div style="font-size:8px;color:var(--text-dim);margin-top:3px">
        ${_t('zone_trainer_type')} <span style="color:var(--text)">${preview.trainerType}</span>
        · ×${preview.trainerTypeMultiplier}
      </div>
    </div>

    <!-- Pokémon pool -->
    <div style="padding:8px 10px;border-bottom:1px solid var(--border)">
      <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:5px">${_t('zone_pokemon').toUpperCase()} (${pool.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:2px">${poolHtml}</div>
    </div>

    <!-- Trainers -->
    <div style="padding:8px 10px;border-bottom:1px solid var(--border)">
      <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:5px">${_t('zone_trainers').toUpperCase()}</div>
      ${trainersHtml || '<span style="color:var(--text-dim);font-size:10px">—</span>'}
    </div>

    <!-- Assigned agents -->
    <div style="padding:8px 10px">
      <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:5px">${_t('zone_assigned_agents').toUpperCase()}</div>
      ${agentsHtml}
    </div>
  `;

  document.body.appendChild(panel);

  // Close button
  panel.querySelector('#zone-ctx-close')?.addEventListener('click', () => panel.remove());

  // Auto-close on outside click
  const _dismiss = (e) => {
    if (!panel.contains(e.target)) {
      panel.remove();
      document.removeEventListener('mousedown', _dismiss, true);
    }
  };
  // Defer so the current click doesn't immediately close it
  setTimeout(() => document.addEventListener('mousedown', _dismiss, true), 0);

  // Clamp to viewport bounds
  requestAnimationFrame(() => {
    const rect = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right  > vw) panel.style.left = `${Math.max(0, vw - rect.width  - 8)}px`;
    if (rect.bottom > vh) panel.style.top  = `${Math.max(0, vh - rect.height - 8)}px`;
  });
}

// Build a fresh zone window element (used on first open)
// ── Quest encounters (dresseur/légendaire de quête) ────────────────
// Agrège les getters exposés par chaque fichier de mission — chacun renvoie
// { id, name, icon, spriteUrl?, onClick } si un adversaire de quête doit
// apparaître comme sprite persistant dans cette zone à l'étape courante,
// sinon null. Défensif (?.()) : les régions pas encore migrées vers ce
// système n'exposent simplement pas leur getter.
function _getActiveQuestEncounterForZone(zoneId) {
  return globalThis.getKantoQuestEncounterForZone?.(zoneId)
    ?? globalThis.getJohtoQuestEncounterForZone?.(zoneId)
    ?? globalThis.getHoennQuestEncounterForZone?.(zoneId)
    ?? globalThis.getSinnohQuestEncounterForZone?.(zoneId)
    ?? globalThis.getDeoxysQuestEncounterForZone?.(zoneId)
    ?? null;
}

function _questEncounterHtml(enc) {
  if (!enc) return '';
  return `<div class="zone-quest-encounter" data-quest-encounter-id="${enc.id}" title="${enc.name}">
    ${enc.spriteUrl ? `<img src="${enc.spriteUrl}" alt="${enc.name}" onerror="this.style.visibility='hidden'">` : ''}
    <span class="quest-encounter-badge">!</span>
    <span class="quest-encounter-name">${enc.icon ? enc.icon + ' ' : ''}${enc.name}</span>
  </div>`;
}

function _bindQuestEncounter(win, enc) {
  if (!enc) return;
  win.querySelector('[data-quest-encounter-id]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    enc.onClick?.();
  });
}

function buildZoneWindowEl(zoneId) {
  const state = globalThis.state;
  const openZones = globalThis.openZones;
  const zone = ZONE_BY_ID[zoneId];
  const zState = state.zones[zoneId] || {};
  const mastery = globalThis.getZoneMastery(zoneId);
  const name = state.lang === 'fr' ? zone.fr : zone.en;
  const degraded = globalThis.isZoneDegraded(zoneId);
  const ZONE_BGS = globalThis.ZONE_BGS;
  const trainerSprite = globalThis.trainerSprite;
  const questEncounter = _getActiveQuestEncounterForZone(zoneId);

  const activeEvt = globalThis.zoneActivity[zoneId];
  const eventActive = globalThis.getZoneActivityMode(zoneId) === 'event';
  const eventDef = eventActive ? SPECIAL_EVENTS.find(e => e.id === activeEvt?.eventId) : null;

  const assignedAgents = state.agents.filter(a => a.assignedZone === zoneId);
  const gymDefeated = zState.gymDefeated;
  const combats = zState.combatsWon || 0;
  const captures = zState.captures || 0;
  const nextMastery = mastery < 3 ? (mastery < 2 ? 10 : 50) : null;
  const progressText = zone.type === 'city'
    ? _t('zone_combat_progress_city', { count: combats, suffix: gymDefeated ? ' ✓GYM' : combats >= 10 && zone.gymLeader ? ' — RAID!' : '' })
    : _t('zone_combat_progress', { count: combats, target: nextMastery ? `/${nextMastery}` : '', captures });

  const bgStyle = (() => {
    const b = ZONE_BGS[zoneId];
    return b ? `background-image:url('${b.url}'),linear-gradient(180deg,${b.fb});background-size:cover,100%;background-position:center,center` : 'background:var(--bg-panel)';
  })();

  const win = document.createElement('div');
  win.className = `zone-window zone-type-${zone.type || 'field'}`;
  win.id = `zw-${zoneId}`;
  win.setAttribute('style', bgStyle);
  const masteryClass = mastery >= 3 ? 'zone-mastery-3' : mastery === 2 ? 'zone-mastery-2' : mastery === 1 ? 'zone-mastery-1' : '';
  if (masteryClass) win.classList.add(masteryClass);


  win.innerHTML = `
    <div class="zone-headbar${degraded ? ' zone-headbar-degraded' : ''}" data-zone-hb="${zoneId}">
      <span class="headbar-name">${name}${gymDefeated ? ' [V]' : ''}${degraded ? ' ⚠' : ''}</span>
      <span class="headbar-stats">${_zoneLevelHtml(zoneId)}</span>
      <button class="headbar-collect-btn" data-headbar-collect="${zoneId}" style="display:${(zState.pendingIncome||0) > 0 ? 'flex' : 'none'};font-family:var(--font-pixel);font-size:7px;padding:1px 6px;background:rgba(200,160,40,.25);border:1px solid var(--gold-dim);border-radius:2px;color:var(--gold);cursor:pointer;align-items:center;gap:2px">₽</button>
      <button class="headbar-close" data-close-zone="${zoneId}" title="${_t('close_zone')}">✕</button>
    </div>
    <div class="zone-viewport">
      ${degraded ? `<div class="zone-degraded-banner">⚠ ${_t('zone_degraded_banner')}</div>` : ''}
      ${eventActive && eventDef ? (() => {
        const secsLeft = activeEvt?.expiresAt ? Math.max(0, Math.ceil((activeEvt.expiresAt - Date.now()) / 1000)) : '?';
        const label = state.lang === 'fr' ? eventDef.fr : eventDef.en;
        return `<div class="zone-event-banner" data-event-zone="${zoneId}">${eventDef.icon} ${label} <span class="event-ttl">${secsLeft}s</span></div>`;
      })() : ''}
      <div id="zpb-${zoneId}" style="position:absolute;top:4px;left:50%;transform:translateX(-50%);font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);background:rgba(0,0,0,.55);border-radius:2px;padding:1px 5px;white-space:nowrap;z-index:2;pointer-events:none">${progressText}${zone.type === 'city' ? ` — XP×${zone.xpBonus}` : ''}</div>
      ${zone.type === 'city' && zone.gymLeader && combats >= 10 ? (() => {
        const lastRaid = zState.gymRaidLastFight || 0;
        const raidCooldownMs = 5 * 60 * 1000;
        const raidReady = Date.now() - lastRaid >= raidCooldownMs;
        const cdSec = raidReady ? 0 : Math.ceil((raidCooldownMs - (Date.now() - lastRaid)) / 1000);
        return `<button class="zone-gym-raid-btn" data-gym-raid="${zoneId}"
          style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);
          font-family:var(--font-pixel);font-size:7px;padding:3px 10px;
          background:${raidReady ? 'rgba(180,20,20,.8)' : 'rgba(60,60,60,.8)'};
          border:1px solid ${raidReady ? 'var(--red)' : 'var(--border)'};
          border-radius:2px;color:${raidReady ? 'var(--text)' : 'var(--text-dim)'};
          cursor:${raidReady ? 'pointer' : 'default'};white-space:nowrap;z-index:3"
          ${raidReady ? '' : 'disabled'}>
          ⚔ RAID ${gymDefeated ? '(re)' : ''}${raidReady ? '' : ` ${cdSec}s`}
        </button>`;
      })() : ''}
      ${state.gang.bossSprite && state.gang.bossZone === zoneId && assignedAgents.length === 0 ? `<div class="zone-boss" data-boss-cd>
        <img src="${trainerSprite(state.gang.bossSprite)}" alt="Boss" onerror="this.src='${trainerSprite('acetrainer')}'">
        <span class="boss-cd-label" style="display:none;font-family:var(--font-pixel);font-size:7px;color:var(--red);background:rgba(0,0,0,.8);border-radius:2px;padding:1px 3px;white-space:nowrap;position:absolute;top:-14px;left:50%;transform:translateX(-50%)"></span>
      </div>` : ''}
      ${_questEncounterHtml(questEncounter)}
    </div>
    <div class="zone-slots-bar">
      ${assignedAgents.map(a => `
        <div class="zone-agent" data-agent-id="${a.id}">
          <span class="agent-label">${a.name}</span>
          <img src="${a.sprite}" alt="${a.name}" onerror="this.src='${trainerSprite('acetrainer')}'">
          <span class="agent-cd-label" style="display:none;font-family:var(--font-pixel);font-size:7px;color:var(--red);background:rgba(0,0,0,.8);border-radius:2px;padding:1px 3px;white-space:nowrap;position:absolute;top:-14px;left:50%;transform:translateX(-50%)"></span>
        </div>
      `).join('')}
      <div class="zone-footer-right">
        ${state.gang.bossSprite && state.gang.bossZone === zoneId && assignedAgents.length > 0 ? `<div class="zone-boss" data-boss-cd>
          <img src="${trainerSprite(state.gang.bossSprite)}" alt="Boss" onerror="this.src='${trainerSprite('acetrainer')}'">
          <span class="boss-cd-label" style="display:none;font-family:var(--font-pixel);font-size:7px;color:var(--red);background:rgba(0,0,0,.8);border-radius:2px;padding:1px 3px;white-space:nowrap;position:absolute;top:-14px;left:50%;transform:translateX(-50%)"></span>
        </div>` : ''}
        <div class="zone-slot-info">
        <span class="slot-count" style="color:var(--text-dim)">${_t('zone_agent_count', { n: assignedAgents.length })}</span>
        </div>
      </div>
    </div>
  `;

  win.querySelector(`[data-close-zone="${zoneId}"]`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeZoneWindow(zoneId);
  });

  win.querySelector(`[data-headbar-collect="${zoneId}"]`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    openCollectionModal(zoneId);
  });

  win.querySelector('.zone-viewport')?.addEventListener('dblclick', (e) => {
    if (e.target.closest('.zone-spawn')) return;
    if (e.target.closest('.zone-gym-raid-btn')) return;
    state.gang.bossZone = zoneId;
    _save();
    renderZoneWindows();
  });

  win.querySelector(`[data-gym-raid="${zoneId}"]`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    globalThis.triggerGymRaid(zoneId);
  });

  win.querySelector('.zone-viewport')?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    _openZoneContextMenu(zoneId, e.clientX, e.clientY);
  });

  _bindQuestEncounter(win, questEncounter);

  return win;
}

// Patch an existing zone window in place — leaves spawns untouched
function patchZoneWindow(zoneId, win) {
  const state = globalThis.state;
  const zone = ZONE_BY_ID[zoneId];
  if (!zone) return;
  const zState = state.zones[zoneId] || {};
  const mastery = globalThis.getZoneMastery(zoneId);
  const name = state.lang === 'fr' ? zone.fr : zone.en;
  const degraded = globalThis.isZoneDegraded(zoneId);
  const trainerSprite = globalThis.trainerSprite;
  const gymDefeated = zState.gymDefeated;
  const combats = zState.combatsWon || 0;
  const captures = zState.captures || 0;
  const nextMastery = mastery < 3 ? (mastery < 2 ? 10 : 50) : null;
  const progressText = zone.type === 'city'
    ? _t('zone_combat_progress_city', { count: combats, suffix: gymDefeated ? ' ✓GYM' : combats >= 10 && zone.gymLeader ? ' — RAID!' : '' })
    : _t('zone_combat_progress', { count: combats, target: nextMastery ? `/${nextMastery}` : '', captures });

  // Headbar
  const headbar = win.querySelector(`[data-zone-hb="${zoneId}"]`);
  if (headbar) {
    headbar.className = `zone-headbar${degraded ? ' zone-headbar-degraded' : ''}`;
    const nameEl = headbar.querySelector('.headbar-name');
    if (nameEl) nameEl.innerHTML = `${name}${gymDefeated ? ' [V]' : ''}${degraded ? ' ⚠' : ''}`;
    const statsEl = headbar.querySelector('.headbar-stats');
    if (statsEl) {
      statsEl.innerHTML = _zoneLevelHtml(zoneId);
    }
    // ₽ collect button — montant volontairement masqué (effet surprise à la collecte)
    const collectBtn = headbar.querySelector(`[data-headbar-collect="${zoneId}"]`);
    const income = zState.pendingIncome || 0;
    if (collectBtn) {
      collectBtn.style.display = income > 0 ? 'flex' : 'none';
      if (income > 0) collectBtn.textContent = '₽';
    }
  }
  win.classList.remove('zone-mastery-1','zone-mastery-2','zone-mastery-3');
  const mc = mastery >= 3 ? 'zone-mastery-3' : mastery === 2 ? 'zone-mastery-2' : mastery === 1 ? 'zone-mastery-1' : '';
  if (mc) win.classList.add(mc);

  const viewport = win.querySelector('.zone-viewport');
  if (!viewport) return;

  // Degraded banner
  let banner = viewport.querySelector('.zone-degraded-banner');
  if (degraded && !banner) {
    banner = document.createElement('div');
    banner.className = 'zone-degraded-banner';
    banner.textContent = `⚠ ${_t('zone_degraded_banner')}`;
    viewport.insertBefore(banner, viewport.firstChild);
  } else if (!degraded && banner) {
    banner.remove();
  }

  // Update progress bar
  const progressBar = win.querySelector(`#zpb-${zoneId}`);
  if (progressBar) progressBar.textContent = `${progressText}${zone.type === 'city' ? ` — XP×${zone.xpBonus}` : ''}`;

  // Agent/boss elements — remove + re-add in footer bar (left of zone-footer-right).
  // Sauté si un combat est en cours dans CETTE zone : executeCombat() a mis en
  // cache une référence DOM directe vers .zone-agent/.zone-boss comme ancrage
  // (sprite envoyé + barre de vie du joueur) et ne la rafraîchit jamais tant
  // que le combat tourne. La recréer ici la détacherait du document — le
  // combat continuerait de tourner correctement en interne, mais le sprite et
  // la barre de vie du joueur disparaîtraient silencieusement de l'écran.
  const combatActiveHere = isZoneCombatBusy(zoneId);
  const slotsBar = win.querySelector('.zone-slots-bar');
  const footerRight = slotsBar?.querySelector('.zone-footer-right');
  if (!combatActiveHere) {
    win.querySelectorAll('.zone-agent').forEach(el => el.remove());
    state.agents.filter(a => a.assignedZone === zoneId).forEach(a => {
      const agEl = document.createElement('div');
      agEl.className = 'zone-agent';
      agEl.dataset.agentId = a.id;
      agEl.innerHTML = `<span class="agent-label">${a.name}</span>`
        + `<img src="${a.sprite}" alt="${a.name}" onerror="this.src='${trainerSprite('acetrainer')}'">`
        + `<span class="agent-cd-label" style="display:none;font-family:var(--font-pixel);font-size:7px;color:var(--red);background:rgba(0,0,0,.8);border-radius:2px;padding:1px 3px;white-space:nowrap;position:absolute;top:-14px;left:50%;transform:translateX(-50%)"></span>`;
      if (slotsBar && footerRight) slotsBar.insertBefore(agEl, footerRight);
      else slotsBar?.appendChild(agEl);
    });

    // Boss element — in viewport when no agents, in footer-right when agents present
    win.querySelectorAll('.zone-boss').forEach(el => el.remove());
    if (state.gang.bossSprite && state.gang.bossZone === zoneId) {
      const freshAssignedForBoss = state.agents.filter(a => a.assignedZone === zoneId);
      const bossEl = document.createElement('div');
      bossEl.className = 'zone-boss';
      bossEl.dataset.bossCd = '';
      bossEl.innerHTML = `<img src="${trainerSprite(state.gang.bossSprite)}" alt="Boss" onerror="this.src='${trainerSprite('acetrainer')}'">`
        + `<span class="boss-cd-label" style="display:none;font-family:var(--font-pixel);font-size:7px;color:var(--red);background:rgba(0,0,0,.8);border-radius:2px;padding:1px 3px;white-space:nowrap;position:absolute;top:-14px;left:50%;transform:translateX(-50%)"></span>`;
      if (freshAssignedForBoss.length === 0) {
        // No agents — boss stands in the viewport
        viewport.appendChild(bossEl);
      } else {
        // Agents present — boss stays in the footer bar
        const _bossSlotInfo = footerRight?.querySelector('.zone-slot-info');
        if (footerRight && _bossSlotInfo) footerRight.insertBefore(bossEl, _bossSlotInfo);
        else footerRight?.appendChild(bossEl);
      }
    }

    // Quest encounter sprite — dresseur/légendaire de quête, réévalué à
    // chaque patch pour apparaître/disparaître avec la progression de la
    // quête sans nécessiter de fermer/rouvrir la fenêtre de zone.
    viewport.querySelectorAll('.zone-quest-encounter').forEach(el => el.remove());
    const questEncounter = _getActiveQuestEncounterForZone(zoneId);
    if (questEncounter) {
      const tmp = document.createElement('div');
      tmp.innerHTML = _questEncounterHtml(questEncounter);
      const encEl = tmp.firstElementChild;
      viewport.appendChild(encEl);
      _bindQuestEncounter(win, questEncounter);
    }
  }

  // Refresh slot-info section inside zone-footer-right
  const freshAssigned = state.agents.filter(a => a.assignedZone === zoneId);
  const slotInfo = win.querySelector('.zone-slot-info');
  if (slotInfo) {
  slotInfo.innerHTML = `<span class="slot-count" style="color:var(--text-dim)">${_t('zone_agent_count', { n: freshAssigned.length })}</span>`;
  }

  updateZoneTimers(zoneId);
}

// ── Zone timers & probability display ─────────────────────────

function updateZoneTimers(zoneId) {
  const state = globalThis.state;
  const win = document.getElementById(`zw-${zoneId}`);
  if (!win) return;
  const zone = ZONE_BY_ID[zoneId];
  if (!zone) return;

  const zState = globalThis.initZone(zoneId);
  const mastery = globalThis.getZoneMastery(zoneId);
  const combats = zState.combatsWon || 0;
  const captures = zState.captures || 0;
  const nextMastery = mastery < 3 ? (mastery < 2 ? 10 : 50) : null;

  // Refresh progress bar in viewport
  const progressBar = win.querySelector(`#zpb-${zoneId}`);
  if (progressBar) {
    const progressText = zone.type === 'city'
      ? _t('zone_combat_progress_city', { count: combats, suffix: zState.gymDefeated ? ' ✓GYM' : combats >= 10 && zone.gymLeader ? ' — RAID!' : '' })
      : _t('zone_combat_progress', { count: combats, target: nextMastery ? `/${nextMastery}` : '', captures });
    progressBar.textContent = `${progressText}${zone.type === 'city' ? ` — XP×${zone.xpBonus}` : ''}`;
  }

  // Refresh slot count
  const countSpan = win.querySelector('.slot-count');
  if (countSpan) {
    const assignedCount = state.agents.filter(a => a.assignedZone === zoneId).length;
    countSpan.textContent = `Agents: ${assignedCount}`;
  }

  // Cooldown display on agents in footer bar
  for (const agent of state.agents.filter(a => a.assignedZone === zoneId)) {
    const agentEl = win.querySelector(`[data-agent-id="${agent.id}"] .agent-cd-label`);
    if (!agentEl) continue;
    const agentPks = agent.team.map(id => globalThis.pokemonById?.(id) ?? state.pokemons.find(p => p.id === id)).filter(Boolean);
    const allCd = agentPks.length > 0 && agentPks.every(p => (p.cooldown || 0) > 0);
    if (allCd) {
      const maxCd = Math.max(...agentPks.map(p => p.cooldown || 0));
      agentEl.textContent = `CD ${maxCd * 10}s`;
      agentEl.style.display = '';
    } else {
      agentEl.style.display = 'none';
    }
  }
  // Event TTL countdown
  const evtBanner = win.querySelector(`[data-event-zone="${zoneId}"] .event-ttl`);
  if (evtBanner) {
    const activity = globalThis.zoneActivity[zoneId];
    if (activity?.expiresAt) {
      const secsLeft = Math.max(0, Math.ceil((activity.expiresAt - Date.now()) / 1000));
      evtBanner.textContent = `${secsLeft}s`;
    }
  }

  // Boss cooldown
  const bossCdLabel = win.querySelector('.boss-cd-label');
  if (bossCdLabel) {
    const bossPks = state.gang.bossTeam.map(id => globalThis.pokemonById?.(id) ?? state.pokemons.find(p => p.id === id)).filter(Boolean);
    const allBossCd = bossPks.length > 0 && bossPks.every(p => (p.cooldown || 0) > 0);
    if (allBossCd) {
      const maxCd = Math.max(...bossPks.map(p => p.cooldown || 0));
      bossCdLabel.textContent = `CD ${maxCd * 10}s`;
      bossCdLabel.style.display = '';
    } else {
      bossCdLabel.style.display = 'none';
    }
  }

  renderEventTrainerInWindow(zoneId);
}

// ── PNJ d'événement persistant ─────────────────────────────────
// Contrairement aux spawns normaux (TTL 10-15s via zoneSpawns/tickZoneSpawn),
// le PNJ d'un événement combat (SPECIAL_EVENTS + trainerKey, ex: Archer /
// Prise d'Antenne Rocket) reste visible et cliquable pendant toute la
// fenêtre d'événement — piloté directement depuis zoneActivity[zoneId],
// idempotent (safe à appeler à chaque tick de updateZoneTimers).
function renderEventTrainerInWindow(zoneId) {
  const win = document.getElementById(`zw-${zoneId}`);
  if (!win) return;
  const viewport = win.querySelector('.zone-viewport');
  if (!viewport) return;

  const activeEvt = globalThis.zoneActivity[zoneId];
  const mode = globalThis.getZoneActivityMode(zoneId);
  const eventDef = mode === 'event' ? SPECIAL_EVENTS.find(e => e.id === activeEvt?.eventId) : null;
  const existing = viewport.querySelector('.zone-event-trainer');

  if (!eventDef || !eventDef.trainerKey) {
    existing?.remove();
    return;
  }
  if (existing || currentCombat) return; // déjà affiché, ou combat en cours (ne pas toucher)

  const trainer = TRAINER_TYPES[eventDef.trainerKey];
  if (!trainer) return;
  const state = globalThis.state;

  const el = document.createElement('div');
  el.className = 'zone-spawn zone-event-trainer pop';
  el.dataset.eventTrainerZone = zoneId;
  el.style.left = '150px';
  el.style.top = '80px';
  el.innerHTML = globalThis.safeTrainerImg(trainer.sprite, { style: 'width:56px;height:56px;filter:drop-shadow(0 0 8px rgba(255,80,80,.85))' });
  el.title = (state.lang === 'fr' ? eventDef.fr : eventDef.en) + ' — ' + (state.lang === 'fr' ? trainer.fr : trainer.en);
  el.style.animation = 'glow 1.2s ease-in-out infinite, float 2.4s ease-in-out infinite';
  el.addEventListener('click', () => {
    if (el.dataset.challenged) return;
    el.dataset.challenged = '1';
    _addVSBadge(el);
    openEventBattlePopup(zoneId);
  });
  viewport.appendChild(el);
}

function tickZoneSpawn(zoneId) {
  const openZones = globalThis.openZones;
  const zoneSpawns = globalThis.zoneSpawns;
  if (!openZones.has(zoneId)) return;
  const spawns = zoneSpawns[zoneId];
  if (!spawns) return;
  // The first playable onboarding beat seeds exactly three real Route 1
  // Pokémon. Keep the regular timer quiet until one is captured so a fourth
  // random encounter cannot obscure that choice.
  if (isOnboardingFirstEncounter(globalThis.state, zoneId)) {
    updateZoneTimers(zoneId);
    return;
  }
  // Max 5 spawns at once
  if (spawns.length >= 5) { updateZoneTimers(zoneId); return; }

  const entry = globalThis.spawnInZone(zoneId);
  if (!entry) {
    // Un événement combat vient peut-être de démarrer sans passer par le
    // pipeline de spawn à TTL court (voir spawnInZone) — le PNJ permanent
    // doit apparaître dès ce tick plutôt qu'attendre le refresh 1s suivant.
    renderEventTrainerInWindow(zoneId);
    return;
  }

  // Track history
  if (!zoneSpawnHistory[zoneId]) zoneSpawnHistory[zoneId] = { pokemon: 0, trainer: 0, chest: 0, event: 0, total: 0 };
  zoneSpawnHistory[zoneId].total++;
  if (entry.type === 'pokemon') zoneSpawnHistory[zoneId].pokemon++;
  else if (entry.type === 'trainer' || entry.type === 'raid') zoneSpawnHistory[zoneId].trainer++;
  else if (entry.type === 'chest') zoneSpawnHistory[zoneId].chest++;
  else if (entry.type === 'event') zoneSpawnHistory[zoneId].event++;

  // Track for timer
  if (!zoneNextSpawn[zoneId]) zoneNextSpawn[zoneId] = {};
  zoneNextSpawn[zoneId].lastSpawnType = entry.type;

  const spawnObj = { ...entry, id: globalThis.uid() };
  spawns.push(spawnObj);

  // TTL: 10-15 seconds
  const ttl = globalThis.randInt(10000, 15000);
  spawnObj.timeout = setTimeout(() => {
    removeSpawn(zoneId, spawnObj.id);
  }, ttl);

  renderSpawnInWindow(zoneId, spawnObj);
  updateZoneTimers(zoneId);

  // ── Wing drop passif (zone au max, mastery >= 3) ─────────────
  _tryWingDrop(zoneId);
}

// Tente de faire apparaître une ombre légendaire cliquable dans la zone.
function _tryWingDrop(zoneId) {
  const zoneSpawns = globalThis.zoneSpawns;
  const configs = SPECIAL_WING_EVENTS[zoneId];
  if (!configs || configs.length === 0) return;

  // Mastery minimum 2 (au moins 10 combats gagnés dans la zone)
  if (globalThis.getZoneMastery(zoneId) < 2) return;

  // Max 1 ombre active à la fois dans la zone
  const existing = (zoneSpawns[zoneId] || []).some(s => s.type === 'wing_shadow');
  if (existing) return;

  // Une zone peut proposer plusieurs ombres possibles (ex. Lugia ET Artikodin
  // sur seafoam_islands) — chacune a sa propre condition (requiresOwned) et
  // son propre jet de spawnChance ; une seule est retenue par tick.
  const eligible = configs.filter(c => !c.requiresOwned || globalThis.state?.birdsMission?.[c.requiresOwned]?.owned);
  const hits = eligible.filter(c => Math.random() <= c.spawnChance);
  if (hits.length === 0) return;
  const cfg = hits[Math.floor(Math.random() * hits.length)];

  // Créer l'objet spawn
  const spawnObj = {
    id:         globalThis.uid(),
    type:       'wing_shadow',
    zoneId,
    wingCfg:    cfg,
  };

  if (!zoneSpawns[zoneId]) zoneSpawns[zoneId] = [];
  zoneSpawns[zoneId].push(spawnObj);
  renderSpawnInWindow(zoneId, spawnObj);
  updateZoneTimers(zoneId);

  // Despawn automatique après cfg.despawnMs si non cliqué
  spawnObj.timeout = setTimeout(() => {
    removeSpawn(zoneId, spawnObj.id);
    updateZoneTimers(zoneId);
  }, cfg.despawnMs);
}

// Adds a red "VS" badge over a trainer spawn element to indicate combat
function _addVSBadge(el) {
  if (!el || el.querySelector('.spawn-vs-badge')) return;
  const badge = document.createElement('div');
  badge.className = 'spawn-vs-badge';
  badge.textContent = 'VS';
  badge.style.cssText = 'position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-family:var(--font-pixel);font-size:9px;font-weight:bold;color:#ff3333;background:rgba(0,0,0,.8);border:1px solid rgba(255,51,51,.5);border-radius:3px;padding:1px 5px;pointer-events:none;z-index:5;animation:pop .2s ease-out';
  el.appendChild(badge);
}

function renderSpawnInWindow(zoneId, spawnObj) {
  const state = globalThis.state;
  const zoneSpawns = globalThis.zoneSpawns;
  const ITEM_SPRITE_URLS = globalThis.ITEM_SPRITE_URLS;
  const win = document.getElementById(`zw-${zoneId}`);
  if (!win) return;
  const viewport = win.querySelector('.zone-viewport') || win;

  const el = document.createElement('div');
  el.className = 'zone-spawn pop';
  el.dataset.spawnId = spawnObj.id;

  // Random position (relative to viewport size)
  const x = Number.isFinite(spawnObj.position?.x) ? spawnObj.position.x : globalThis.randInt(10, 310);
  const y = Number.isFinite(spawnObj.position?.y) ? spawnObj.position.y : globalThis.randInt(10, 160);
  el.style.left = x + 'px';
  el.style.top = y + 'px';

  if (spawnObj.type === 'pokemon') {
    const sp = SPECIES_BY_EN[spawnObj.species_en];
    el.innerHTML = `<img src="${globalThis.pokeSprite(spawnObj.species_en)}" style="width:56px;height:56px" alt="${sp?.fr || spawnObj.species_en}">`;
    el.title = sp ? (state.lang === 'fr' ? sp.fr : sp.en) : spawnObj.species_en;
    // Rare / very_rare / legendary popup notification
    if (sp && (sp.rarity === 'very_rare' || sp.rarity === 'legendary')) {
      setTimeout(() => globalThis.showRarePopup?.(spawnObj.species_en, zoneId), 300);
    }
    el.addEventListener('click', () => {
      if (el.classList.contains('catching')) return;
      el.classList.add('catching');
      spawnObj.playerCatching = true;
      animateCapture(zoneId, spawnObj, el);
    });
  } else if (spawnObj.type === 'raid') {
    // Raid: show the lead trainer sprite (no more Pokéball)
    const raidLeaderKey = spawnObj.raidTrainers?.[0]?.key || spawnObj.trainerKey || 'gymleader';
    const previewR = getTrainerCombatPreview({ ...spawnObj, zoneId }, null);
    const tierR    = getDifficultyTier(previewR.attackerPower, previewR.defenderPower);
    el.innerHTML = globalThis.safeTrainerImg(raidLeaderKey, { style: 'width:52px;height:52px;image-rendering:pixelated;filter:drop-shadow(0 0 8px #f44)' }) +
      getDifficultyBadgeHtml(tierR) +
      `<div style="font-family:var(--font-pixel);font-size:6px;color:#f66;background:rgba(0,0,0,.75);border-radius:2px;padding:1px 4px;margin-top:2px;text-align:center">⚔ ${_t('zone_raid').toUpperCase()}</div>`;
    el.title = state.lang === 'fr'
      ? (spawnObj.trainer?.fr ?? spawnObj.trainerKey ?? 'Raid')
      : (spawnObj.trainer?.en ?? spawnObj.trainerKey ?? 'Raid');
    el.style.animation = 'glow 1s ease-in-out infinite, float 2s ease-in-out infinite';
    el.addEventListener('click', () => {
      if (el.dataset.challenged) return;
      el.dataset.challenged = '1';
      _addVSBadge(el);
      openCombatPopup(zoneId, spawnObj);
    });
  } else if (spawnObj.type === 'trainer') {
    const extraStyle = spawnObj.elite ? 'filter:drop-shadow(0 0 6px gold)' : '';
    const previewT = getTrainerCombatPreview({ ...spawnObj, zoneId }, null);
    const tierT    = getDifficultyTier(previewT.attackerPower, previewT.defenderPower);
    el.innerHTML = globalThis.safeTrainerImg(spawnObj.trainer?.sprite ?? spawnObj.trainerKey, { style: `width:56px;height:56px;${extraStyle}` }) +
      getDifficultyBadgeHtml(tierT);
    el.title = ((state.lang === 'fr' ? (spawnObj.trainer?.fr ?? spawnObj.trainerKey ?? '???') : (spawnObj.trainer?.en ?? spawnObj.trainerKey ?? '???'))) + (spawnObj.elite ? ' ⭐' : '') + ` · ${tierT.label} (${tierT.rationale})`;
    if (spawnObj.elite) el.style.animation = 'glow 1.5s ease-in-out infinite, float 3s ease-in-out infinite';
    el.addEventListener('click', () => {
      if (el.dataset.challenged) return;
      el.dataset.challenged = '1';
      _addVSBadge(el);
      openCombatPopup(zoneId, spawnObj);
    });
  } else if (spawnObj.type === 'chest') {
    el.innerHTML = `<div class="chest-sprite">📦</div>`;
    el.title = _t('zone_treasure_chest');
    el.style.animation = 'float 2s ease-in-out infinite';
    el.addEventListener('click', () => {
      if (el.classList.contains('catching')) return;
      el.classList.add('catching');
      // Opening animation
      el.innerHTML = `<div style="font-size:36px;line-height:1;animation:pop .3s ease-out">🎁</div>`;
      state.stats.chestsOpened = (state.stats.chestsOpened || 0) + 1;
      setTimeout(() => {
        const loot = globalThis.rollChestLoot(zoneId);
        _notify(loot.msg, loot.type);
        globalThis.SFX.play('chest'); // Loot jingle
        removeSpawn(zoneId, spawnObj.id);
        _topBar();
        updateZoneTimers(zoneId);
        _save();
      }, 400);
    });
  } else if (spawnObj.type === 'wing_shadow') {
    // ── Ombre légendaire cliquable (Lugia / Ho-Oh) ─────────────
    const cfg = spawnObj.wingCfg;
    const isEn = globalThis.state?.lang === 'en';
    const shadowLabel = isEn ? (cfg.shadowLabelEn || cfg.shadowLabel) : cfg.shadowLabel;
    const itemLabel   = isEn ? (cfg.itemNameEn   || cfg.itemName)   : cfg.itemName;
    const spriteUrl = globalThis.pokeSprite(cfg.legendaryShadow);
    el.innerHTML = `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer">
        <img src="${spriteUrl}"
          style="width:64px;height:64px;image-rendering:pixelated;
                 filter:brightness(0) saturate(0) opacity(.75) drop-shadow(0 0 10px rgba(150,120,255,.9));
                 animation:float 2.5s ease-in-out infinite">
        <div style="font-family:var(--font-pixel);font-size:6px;color:rgba(200,180,255,.9);
                    text-shadow:0 0 6px rgba(150,120,255,.8);letter-spacing:.5px">${shadowLabel}</div>
        <div style="font-size:7px;color:var(--gold);animation:glow 1.5s ease-in-out infinite">✦ ${itemLabel}</div>
      </div>`;
    el.title = _t('zone_shadow_click_hint', { shadow: shadowLabel, item: itemLabel });
    el.style.animation = 'none'; // override default — sprite se charge de l'animation

    el.addEventListener('click', () => {
      if (el.classList.contains('catching')) return;
      el.classList.add('catching');

      // Annuler le despawn automatique
      if (spawnObj.timeout) { clearTimeout(spawnObj.timeout); spawnObj.timeout = null; }

      // Éclair visuel
      el.style.filter = 'brightness(3)';
      globalThis.SFX.play('chest');

      setTimeout(() => {
        // Drop 1 à 5 ailes
        const qty = globalThis.randInt(cfg.minDrop, cfg.maxDrop);
        state.inventory[cfg.item] = (state.inventory[cfg.item] || 0) + qty;

        // Feedback + log
        const msg = _t('zone_shadow_item_obtained', { qty, item: itemLabel, shadow: shadowLabel });
        _notify(msg, 'gold');
        globalThis.addLog(msg);

        // Burst doré à l'endroit du spawn
        showCaptureBurst(viewport, parseInt(el.style.left) + 32, parseInt(el.style.top) + 32, 4, false);

        removeSpawn(zoneId, spawnObj.id);
        _topBar();
        updateZoneTimers(zoneId);
        _save();
      }, 300);
    });

  } else if (spawnObj.type === 'event') {
    // Événements "boost" uniquement (trainerKey null) — les événements combat
    // sont rendus à part par renderEventTrainerInWindow (PNJ permanent) et ne
    // passent plus par ce pipeline de spawn à TTL court.
    const evt = spawnObj.event;
    el.innerHTML = `<img src="${ITEM_SPRITE_URLS.pokeball}" style="width:44px;height:44px;image-rendering:pixelated;filter:drop-shadow(0 0 8px rgba(255,204,90,.9))">`;
    el.title = state.lang === 'fr' ? evt.fr : evt.en;
    el.style.animation = 'glow 1s ease-in-out infinite, float 2s ease-in-out infinite';
    el.addEventListener('click', () => {
      if (el.classList.contains('catching')) return;
      el.classList.add('catching');
      globalThis.activateEvent(zoneId, evt);
      removeSpawn(zoneId, spawnObj.id);
      updateZoneTimers(zoneId);
    });
  }

  viewport.appendChild(el);
}

function removeSpawn(zoneId, spawnId) {
  const zoneSpawns = globalThis.zoneSpawns;
  const spawns = zoneSpawns[zoneId];
  if (!spawns) return;
  const idx = spawns.findIndex(s => s.id === spawnId);
  if (idx !== -1) {
    if (spawns[idx].timeout) clearTimeout(spawns[idx].timeout);
    spawns.splice(idx, 1);
  }
  // Remove DOM
  const el = document.querySelector(`[data-spawn-id="${spawnId}"]`);
  if (el) {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  }
}

// ── Ball throw + capture burst animation ──────────────────────

function animateCapture(zoneId, spawnObj, spawnEl) {
  const state = globalThis.state;
  const BALL_SPRITES = globalThis.BALL_SPRITES;
  const win = document.getElementById(`zw-${zoneId}`);
  if (!win) return;
  const viewport = win.querySelector('.zone-viewport') || win;

  // Find thrower position (boss in viewport when solo, or in footer bar; agents always in footer)
  const bossEl = win.querySelector('.zone-boss');
  const agentEl = win.querySelector('.zone-agent');
  const thrower = bossEl || agentEl;
  let startX, startY;
  if (thrower) {
    const r = thrower.getBoundingClientRect();
    const wr = viewport.getBoundingClientRect();
    startX = r.left - wr.left + r.width / 2;
    startY = Math.min(viewport.clientHeight - 8, r.top - wr.top); // clamp to viewport bottom
  } else {
    // Default: bottom-center
    startX = viewport.clientWidth / 2;
    startY = viewport.clientHeight - 8;
  }
  const targetX = parseInt(spawnEl.style.left) + 28;
  const targetY = parseInt(spawnEl.style.top) + 28;

  // Create ball projectile
  const ball = document.createElement('div');
  ball.className = 'ball-projectile';
  ball.innerHTML = `<img src="${BALL_SPRITES[state.activeBall] || BALL_SPRITES.pokeball}">`;
  ball.style.left = startX + 'px';
  ball.style.top = startY + 'px';
  viewport.appendChild(ball);

  // Animate ball flight with CSS transition + SFX
  globalThis.SFX.play('ballThrow');
  requestAnimationFrame(() => {
    ball.style.transition = 'left .35s ease-out, top .35s ease-in';
    ball.style.left = targetX + 'px';
    ball.style.top = targetY + 'px';
  });

  setTimeout(() => {
    // Ball lands — wobble 0-3 times (0 = critical catch, ★+1 bonus)
    const wobbles = Math.floor(Math.random() * 4); // 0, 1, 2, 3
    const isCritical = wobbles === 0;

    // Position ball on target (stop flight transition)
    ball.style.transition = 'none';
    ball.style.left = targetX - 10 + 'px';
    ball.style.top  = targetY - 10 + 'px';

    if (isCritical) {
      // Flash gold for critical
      ball.style.filter = 'drop-shadow(0 0 6px gold)';
    }

    function doCaptureAttempt() {
      ball.remove();
      const caught = globalThis.tryCapture(zoneId, spawnObj.species_en, isCritical ? 1 : 0, spawnObj.spawnCtx || {});
      if (caught) {
        if (isCritical) _notify(`★ Capture critique ! +1 potentiel`, 'gold');
        if (caught.shiny) spawnEl.classList.add('shiny-flash');
        globalThis.SFX.play('capture', caught.potential, caught.shiny);
        showCaptureBurst(viewport, targetX, targetY, caught.potential, caught.shiny);
        removeSpawn(zoneId, spawnObj.id);
        _topBar();
        if (globalThis.activeTab === 'tabPC') globalThis.renderPCTab();
        updateZoneTimers(zoneId);
      } else {
        // Fade out au contact, puis fade in si échec
        if (spawnEl) {
          spawnEl.style.transition = 'opacity .15s, transform .15s';
          spawnEl.style.opacity = '0';
          spawnEl.style.transform = 'scale(.7)';
          setTimeout(() => {
            spawnEl.style.opacity = '1';
            spawnEl.style.transform = '';
            spawnEl.classList.remove('catching');
          }, 350);
        }
      }
    }

    if (wobbles === 0) {
      // Critical — instant capture (no wobble)
      setTimeout(doCaptureAttempt, 150);
    } else {
      // Wobble N times then attempt
      let w = 0;
      function nextWobble() {
        w++;
        ball.classList.remove('ball-wobble');
        void ball.offsetWidth; // force reflow to restart animation
        ball.classList.add('ball-wobble');
        if (w < wobbles) {
          setTimeout(nextWobble, 480);
        } else {
          setTimeout(doCaptureAttempt, 520);
        }
      }
      setTimeout(nextWobble, 100);
    }
  }, 380);
}

function showCaptureBurst(container, x, y, potential, shiny) {
  const burst = document.createElement('div');
  burst.className = 'capture-burst';
  if (shiny) burst.classList.add('shiny');
  else if (potential >= 5) burst.classList.add('stars-5');
  else if (potential >= 4) burst.classList.add('stars-4');
  else if (potential >= 3) burst.classList.add('stars-3');
  burst.style.left = x + 'px';
  burst.style.top = y + 'px';

  // Ring
  const ring = document.createElement('div');
  ring.className = 'burst-ring';
  burst.appendChild(ring);

  // Particles
  const numParticles = shiny ? 16 : (potential >= 4 ? 12 : 8);
  for (let i = 0; i < numParticles; i++) {
    const p = document.createElement('div');
    p.className = 'burst-particle';
    const angle = (i / numParticles) * Math.PI * 2;
    const dist = 30 + Math.random() * 30;
    p.style.setProperty('--bx', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--by', Math.sin(angle) * dist + 'px');
    burst.appendChild(p);
  }

  container.appendChild(burst);
  setTimeout(() => burst.remove(), 800);
}

// ── Quest-encounter capture animation ──────────────────────────
// Variante d'animateCapture pour une cible fixe (.zone-quest-encounter,
// positionnée par CSS de classe, pas par style inline) et une issue déjà
// décidée en amont (rollQuestCapture) — pas d'appel à tryCapture ici, cette
// fonction est purement visuelle. Appelée par questEncounterPopup.js après
// fermeture du popup de combat, une fois la capture d'un légendaire de
// quête tranchée.
function animateQuestCapture({ zoneId, encounterId, caught, potential = 3, onDone } = {}) {
  const state = globalThis.state;
  const BALL_SPRITES = globalThis.BALL_SPRITES;
  const win = document.getElementById(`zw-${zoneId}`);
  const viewport = win?.querySelector('.zone-viewport');
  const encounterEl = viewport?.querySelector(`[data-quest-encounter-id="${encounterId}"]`);
  if (!win || !viewport || !encounterEl) { onDone?.(); return; }

  const bossEl = win.querySelector('.zone-boss');
  const agentEl = win.querySelector('.zone-agent');
  const thrower = bossEl || agentEl;
  const wr = viewport.getBoundingClientRect();
  let startX, startY;
  if (thrower) {
    const r = thrower.getBoundingClientRect();
    startX = r.left - wr.left + r.width / 2;
    startY = Math.min(viewport.clientHeight - 8, r.top - wr.top);
  } else {
    startX = viewport.clientWidth / 2;
    startY = viewport.clientHeight - 8;
  }
  // Cible lue via getBoundingClientRect (contrairement à animateCapture qui lit
  // spawnEl.style.left/top — .zone-quest-encounter n'a pas de style inline).
  const er = encounterEl.getBoundingClientRect();
  const targetX = er.left - wr.left + er.width / 2;
  const targetY = er.top - wr.top + er.height / 2;

  const ball = document.createElement('div');
  ball.className = 'ball-projectile';
  ball.innerHTML = `<img src="${BALL_SPRITES[state.activeBall] || BALL_SPRITES.pokeball}">`;
  ball.style.left = startX + 'px';
  ball.style.top = startY + 'px';
  viewport.appendChild(ball);

  globalThis.SFX.play('ballThrow');
  requestAnimationFrame(() => {
    ball.style.transition = 'left .35s ease-out, top .35s ease-in';
    ball.style.left = targetX + 'px';
    ball.style.top = targetY + 'px';
  });

  setTimeout(() => {
    const wobbles = Math.floor(Math.random() * 4); // 0-3, cosmétique — n'affecte pas l'issue
    ball.style.transition = 'none';
    ball.style.left = (targetX - 10) + 'px';
    ball.style.top  = (targetY - 10) + 'px';
    if (wobbles === 0 && caught) ball.style.filter = 'drop-shadow(0 0 6px gold)';

    function resolveOutcome() {
      ball.remove();
      if (caught) {
        globalThis.SFX.play('capture', potential, false);
        showCaptureBurst(viewport, targetX, targetY, potential, false);
        encounterEl.style.transition = 'opacity .3s, transform .3s';
        encounterEl.style.opacity = '0';
        encounterEl.style.transform = 'scale(.6)';
        setTimeout(() => { encounterEl.remove(); onDone?.(); }, 300);
      } else {
        encounterEl.style.transition = 'opacity .15s, transform .15s';
        encounterEl.style.opacity = '.3';
        encounterEl.style.transform = 'scale(.85)';
        setTimeout(() => {
          encounterEl.style.opacity = '1';
          encounterEl.style.transform = '';
        }, 350);
        onDone?.();
      }
    }

    if (wobbles === 0) {
      setTimeout(resolveOutcome, 150);
    } else {
      let w = 0;
      function nextWobble() {
        w++;
        ball.classList.remove('ball-wobble');
        void ball.offsetWidth; // force reflow pour redémarrer l'animation
        ball.classList.add('ball-wobble');
        if (w < wobbles) setTimeout(nextWobble, 480);
        else setTimeout(resolveOutcome, 520);
      }
      setTimeout(nextWobble, 100);
    }
  }, 380);
}

// ── Player team builder ───────────────────────────────────────

function buildPlayerTeamForZone(zoneId) {
  const state = globalThis.state;
  const zoneAgents = state.agents.filter(a => a.assignedZone === zoneId);
  let allAllyIds = [];
  // Boss only if physically assigned to this zone
  if (state.gang.bossZone === zoneId && state.gang.bossTeam.length > 0) {
    allAllyIds.push(...state.gang.bossTeam);
  }
  for (const agent of zoneAgents) {
    const slots = globalThis.getAgentTeamSlots?.(agent) ?? 3;
    allAllyIds.push(...(agent.team || []).slice(0, slots));
  }
  return allAllyIds.map(id => globalThis.pokemonById?.(id) ?? state.pokemons.find(p => p.id === id)).filter(Boolean);
}

// Retourne les agents assignés à la zone (le boss ne participe que s'il est assigné à la zone).
function getZoneCombatAgentIds(zoneId) {
  const state = globalThis.state;
  return (state.agents || [])
    .filter(agent => agent.assignedZone === zoneId && agent.autoCombat !== false)
    .sort((a, b) => (globalThis.getAgentCombatPower?.(b) ?? 0) - (globalThis.getAgentCombatPower?.(a) ?? 0))
    .slice(0, 3)
    .map(agent => agent.id);
}

function buildTrainerCombatTeamIds(agentIds = [], zoneId = null) {
  const state = globalThis.state;
  const teamIds = [];
  // Boss only if assigned to this zone
  if (zoneId === null || state.gang?.bossZone === zoneId) {
    for (const id of state.gang?.bossTeam || []) {
      if (id) teamIds.push(id);
    }
  }
  for (const agentId of agentIds) {
    const agent = globalThis.agentById?.(agentId) ?? state.agents?.find(a => a.id === agentId);
    const slots = globalThis.getAgentTeamSlots?.(agent) ?? 3;
    for (const id of (agent?.team || []).slice(0, slots)) {
      if (id) teamIds.push(id);
    }
  }
  return [...new Set(teamIds)].filter(id => state.pokemons?.some(pokemon => pokemon.id === id));
}

function getTrainerCombatEnemyCount(spawnObj) {
  if ((spawnObj?.isRaid || spawnObj?.type === 'raid') && Array.isArray(spawnObj.raidTrainers)) {
    return spawnObj.raidTrainers.reduce((sum, entry) => sum + (entry.team?.length || 0), 0);
  }
  return (spawnObj?.team || []).filter(Boolean).length;
}

function fmtCombatNum(value) {
  return Math.round(value || 0).toLocaleString('fr-FR');
}

function trainerCombatName(spawnObj) {
  const state = globalThis.state;
  return state.lang === 'fr'
    ? (spawnObj.trainer?.fr ?? spawnObj.trainerKey ?? '???')
    : (spawnObj.trainer?.en ?? spawnObj.trainerKey ?? '???');
}

function buildTrainerCombatTaglines(spawnObj, result, reward, repGain) {
  const tName    = trainerCombatName(spawnObj);
  const bossName = globalThis.state?.gang?.bossName || 'Boss';
  const taglines = [];

  // Participants côté joueur (boss uniquement s'il contribue à la puissance)
  const agentNames  = (result.attackers || []).map(a => a.name);
  const bossContrib = (result.bossTeamPower ?? 0) > 0;
  const allParties  = [...(bossContrib ? [bossName] : []), ...agentNames];
  const alliesList  = allParties.length ? allParties.join(' + ') : bossName;
  const enemyCount  = getTrainerCombatEnemyCount(spawnObj);
  const typeMod     = result.trainerTypeMultiplier > 1
    ? ` (×${result.trainerTypeMultiplier.toFixed(2)} ${result.trainerType})`
    : '';

  taglines.push(_t('zone_allies_face_trainer', { allies: alliesList, trainer: tName }));
  taglines.push(_t('zone_trainer_enemy_count', { trainer: tName, count: enemyCount, mod: typeMod }));
  taglines.push(_t('zone_attack_breakdown', {
    total: fmtCombatNum(result.attackerPower),
    boss: fmtCombatNum(result.bossTeamPower ?? 0),
    agents: fmtCombatNum(result.agentsPower ?? 0),
  }));
  taglines.push(_t('zone_defense_line', { power: fmtCombatNum(result.defenderPower) }));

  if (result.attackerWin) {
    taglines.push(_t('zone_victory_banner'));
    if (reward > 0) taglines.push(_t('zone_reward_line', { reward: fmtCombatNum(reward), rep: fmtCombatNum(repGain) }));
  } else {
    taglines.push(_t('zone_defeat_banner'));
    taglines.push(_t('zone_no_loot'));
  }

  return taglines;
}

function scaleBattleStats(stats = {}, multiplier = 1) {
  return {
    atk: Math.max(1, Math.round((stats.atk ?? 50) * multiplier)),
    def: Math.max(1, Math.round((stats.def ?? 50) * multiplier)),
    spd: Math.max(1, Math.round((stats.spd ?? 50) * multiplier)),
  };
}

function buildTrainerBattleEnemyTeam(enemyPool = [], multiplier = 1) {
  return enemyPool.map(slot => ({
    ...slot.pk,
    stats: scaleBattleStats(slot.stats || slot.pk?.stats, multiplier),
  }));
}

function makeCombatOverlay(anchorEl, side = 'player') {
  if (!anchorEl) return null;
  const ov = document.createElement('div');
  ov.className = `combat-hp-overlay ${side === 'enemy' ? 'combat-hp-enemy' : 'combat-hp-gang'}`;
  ov.innerHTML = `<div class="chp-name"></div><div class="chp-bar"><div class="chp-fill${side === 'enemy' ? ' chp-fill-red' : ''}" style="width:100%"></div></div><div class="chp-txt"></div>`;
  anchorEl.appendChild(ov);
  return { root: ov, name: ov.querySelector('.chp-name'), fill: ov.querySelector('.chp-fill'), txt: ov.querySelector('.chp-txt') };
}

function setCombatHpBar(ov, hp, maxHp) {
  if (!ov) return;
  const safeMax = Math.max(1, maxHp || 1);
  const safeHp = Math.max(0, hp || 0);
  ov.fill.style.width = Math.max(0, Math.min(100, Math.round(safeHp / safeMax * 100))) + '%';
  ov.txt.textContent = `${safeHp}/${safeMax}`;
}

function playCombatHitEffect(el) {
  if (!el) return;
  el.classList.remove('combat-hit');
  void el.offsetWidth;
  el.classList.add('combat-hit');
  setTimeout(() => el.classList.remove('combat-hit'), 340);
}

// ════════════════════════════════════════════════════════════════
// Auto-combat visuel (agents) — zone visible uniquement
// ════════════════════════════════════════════════════════════════
// Contrairement à openCombatPopup/executeCombat (combat manuel, moteur tour
// par tour resolveEventBattle + log texte), cette séquence est purement
// décorative : agentAutoCombat (agent.js) a déjà résolu le combat via
// resolveTrainerCombat (formule de puissance, pas de tours) — on se contente
// d'illustrer visuellement un résultat déjà déterminé, sans texte.
//
// _autoCombatVisualLocks fait office de garde par zone équivalente à
// currentCombat (verrou global, un seul combat interactif à la fois) : ici
// plusieurs zones ouvertes peuvent illustrer un auto-combat en parallèle,
// donc une Map par zoneId plutôt qu'un slot unique. Chaque entrée suit le
// même patron que currentCombat.timers : timers[] + références DOM créées,
// pour permettre une annulation propre (cancelAutoCombatVisual) au lieu de
// dépendre uniquement du setTimeout final pour se nettoyer lui-même — sinon
// fermer la fenêtre de zone en plein milieu, ou une exception pendant la
// construction du visuel, laisse la zone verrouillée indéfiniment.
const _autoCombatVisualLocks = new Map(); // zoneId -> { timers, spawnEl, playerSpriteEl, raidRow, enemySpriteEl }

// Verrou combiné : le DOM combat de cette zone (agents/boss + spawn ciblé)
// est-il actuellement revendiqué par L'UN OU L'AUTRE mécanisme — un combat
// interactif/événement ancré ici (currentCombat.zoneId) OU une séquence
// décorative playAutoCombatVisual encore en vol ? Seul point d'entrée à
// utiliser pour répondre à "puis-je toucher/reconstruire le DOM combat de
// cette zone maintenant ?".
function isZoneCombatBusy(zoneId) {
  return currentCombat?.zoneId === zoneId || _autoCombatVisualLocks.has(zoneId);
}

// Annule proprement une séquence playAutoCombatVisual en cours pour zoneId :
// timers en attente + DOM qu'elle a ajouté. No-op si aucune séquence n'est
// active pour cette zone. Symétrique de closeCombatPopup/closeEventBattle
// pour ce second mécanisme de verrouillage.
function cancelAutoCombatVisual(zoneId) {
  const lock = _autoCombatVisualLocks.get(zoneId);
  if (!lock) return;
  for (const t of lock.timers) clearTimeout(t);
  lock.spawnEl?.classList.remove('zone-spawn-battle', 'combat-hit');
  if (lock.spawnEl) lock.spawnEl.style.animation = '';
  lock.playerSpriteEl?.remove();
  lock.raidRow?.remove();
  lock.enemySpriteEl?.remove();
  _autoCombatVisualLocks.delete(zoneId);
}

// Point d'entrée unique pour closeZoneWindow : nettoie tout ce qui peut
// retenir le DOM combat de cette zone, quel que soit le mécanisme en cause.
function teardownZoneCombat(zoneId) {
  if (currentCombat?.zoneId === zoneId) {
    if (currentCombat.isEventBattle) closeEventBattle();
    else closeCombatPopup();
  }
  cancelAutoCombatVisual(zoneId);
}

function playAutoCombatVisual(zoneId, spawnObj, combatAgents, win) {
  const state = globalThis.state;
  const zoneWin = document.getElementById(`zw-${zoneId}`);
  const viewport = zoneWin?.querySelector('.zone-viewport');
  const spawnEl = viewport?.querySelector(`[data-spawn-id="${spawnObj.id}"]`);
  if (!zoneWin || !viewport || !spawnEl) return;

  // Deux agents résolvant un combat pour LA MÊME zone à quelques instants
  // d'intervalle (spawns différents) partageraient le même ancrage DOM
  // (.zone-agent/.zone-boss). Comme c'est purement décoratif (le résultat et
  // la récompense sont déjà appliqués indépendamment par
  // _applyResolvedAgentCombat), on saute la 2e animation plutôt que
  // d'empiler deux séquences sur le même DOM.
  if (_autoCombatVisualLocks.has(zoneId)) return;

  const lock = { timers: [], spawnEl, playerSpriteEl: null, raidRow: null, enemySpriteEl: null };
  _autoCombatVisualLocks.set(zoneId, lock);

  const queueTimer = (fn, ms) => {
    const t = setTimeout(fn, ms);
    lock.timers.push(t);
    return t;
  };

  try {
    // Ancrage sur l'élément DOM de combatAgents[0] spécifiquement (l'agent
    // choisi par _zoneCombatAgents — preferredAgent puis puissance la plus
    // haute), pas "le premier .zone-agent rencontré dans le DOM" (ordre de
    // state.agents / patchZoneWindow, sans rapport avec qui se bat).
    const fightingAgentId = combatAgents?.[0]?.id;
    const playerAnchorEl = zoneWin.querySelector('.zone-boss')
      || (fightingAgentId != null ? zoneWin.querySelector(`[data-agent-id="${fightingAgentId}"]`) : null)
      || zoneWin.querySelector('.zone-agent');

    const isRaid = spawnObj.type === 'raid' || spawnObj.isRaid;
    // Seul le sprite du meneur est affiché (le reste du roster apparaît via
    // raidRow ci-dessous) — pas besoin d'aplatir l'équipe de tous les
    // dresseurs du raid pour ça.
    const enemyLead = isRaid
      ? spawnObj.raidTrainers?.[0]?.team?.find(Boolean)
      : (spawnObj.team || []).find(Boolean);
    const agentId = combatAgents?.[0]?.team?.find(Boolean);
    const agentPk = agentId != null ? (globalThis.pokemonById?.(agentId) ?? state.pokemons.find(p => p.id === agentId)) : null;

    // Raid : une rangée d'icônes dresseur (en plus du pokémon meneur) pour
    // rendre visible qu'il y a plusieurs adversaires, pas un seul dresseur.
    if (isRaid && spawnObj.raidTrainers?.length) {
      lock.raidRow = document.createElement('div');
      lock.raidRow.className = 'combat-raid-trainers';
      lock.raidRow.innerHTML = spawnObj.raidTrainers.map(rt =>
        globalThis.safeTrainerImg(rt.key, { style: 'width:26px;height:26px;image-rendering:pixelated' })
      ).join('');
      spawnEl.appendChild(lock.raidRow);
    }

    if (enemyLead?.species_en) {
      lock.enemySpriteEl = document.createElement('img');
      lock.enemySpriteEl.className = 'combat-enemy-pk';
      lock.enemySpriteEl.src = globalThis.pokeSprite(enemyLead.species_en, false);
      lock.enemySpriteEl.style.cssText = 'width:56px;height:56px;image-rendering:pixelated';
      spawnEl.insertBefore(lock.enemySpriteEl, spawnEl.firstChild);
    }

    if (playerAnchorEl && agentPk) {
      lock.playerSpriteEl = document.createElement('div');
      lock.playerSpriteEl.className = 'combat-sent-pk';
      lock.playerSpriteEl.innerHTML = `<img src="${globalThis.pokeSpriteBack(agentPk.species_en, agentPk.shiny)}" style="width:40px;height:40px;${agentPk.shiny ? 'filter:drop-shadow(0 0 4px var(--gold))' : ''}">`;
      playerAnchorEl.appendChild(lock.playerSpriteEl);
    }

    spawnEl.classList.add('zone-spawn-battle');
    spawnEl.style.animation = 'none';

    queueTimer(() => playCombatHitEffect(lock.enemySpriteEl || spawnEl), 320);
    queueTimer(() => playCombatHitEffect(lock.playerSpriteEl || playerAnchorEl), 620);
    queueTimer(() => {
      spawnEl.classList.remove('zone-spawn-battle');
      spawnEl.classList.add(win ? 'caught' : 'failed');
      spawnEl.style.opacity = win ? '0.45' : '0.75';
    }, 1000);
    queueTimer(() => {
      lock.playerSpriteEl?.remove();
      lock.raidRow?.remove();
      _autoCombatVisualLocks.delete(zoneId);
    }, AUTO_COMBAT_VISUAL_MS);
  } catch (err) {
    // Ne jamais laisser la zone verrouillée si une étape ci-dessus lève —
    // cancelAutoCombatVisual relit le lock partiellement rempli (timers déjà
    // programmés + DOM déjà créé) et nettoie tout. Erreur avalée (pas de
    // rethrow) : cette fonction est appelée de façon synchrone par
    // agentAutoCombat AVANT que celui-ci ne programme le setTimeout qui
    // applique réellement la récompense/capture — une exception non
    // rattrapée ferait perdre ce résultat de combat en plus de planter le
    // reste de la boucle agentTick() pour ce tick.
    console.error('[zoneWindows] playAutoCombatVisual setup failed, releasing zone lock:', err);
    cancelAutoCombatVisual(zoneId);
  }
}

// ════════════════════════════════════════════════════════════════
// Combat Popup
// ════════════════════════════════════════════════════════════════

function openCombatPopup(zoneId, spawnObj, { mode = 'manual', initiatedBy = 'player' } = {}) {
  const state = globalThis.state;
  // currentCombat est un verrou global (un seul combat joueur interactif à
  // la fois, où qu'il soit) ; isZoneCombatBusy couvre en plus l'auto-combat
  // visuel de CETTE zone (playAutoCombatVisual) — éviter que les deux
  // séquences visuelles se marchent dessus sur le même DOM.
  if (currentCombat || isZoneCombatBusy(zoneId)) return;

  // Le joueur initie un combat → le boss se déplace dans cette zone
  if (state.gang.bossZone !== zoneId) {
    state.gang.bossZone = zoneId;
    globalThis.syncBackgroundZones?.();
  }

  const agentIds = getZoneCombatAgentIds(zoneId);
  const available = buildPlayerTeamForZone(zoneId);
  if (available.length === 0) {
    _notify(_t('zone_equip_boss_required'), 'error');
    return;
  }

  const win = document.getElementById(`zw-${zoneId}`);
  const viewport = win?.querySelector('.zone-viewport');
  if (!viewport) return; // zone window not open

  const isRaid = spawnObj.isRaid || spawnObj.type === 'raid';
  const trainerName = state.lang === 'fr'
    ? (spawnObj.trainer?.fr ?? spawnObj.trainerKey ?? '???')
    : (spawnObj.trainer?.en ?? spawnObj.trainerKey ?? '???');
  const spawnWithZone = { ...spawnObj, zoneId, combatMode: mode, initiatedBy };
  const teamIds = buildTrainerCombatTeamIds(agentIds, zoneId);
  const battlePlayerTeam = teamIds
    .map(id => state.pokemons.find(pokemon => pokemon.id === id))
    .filter(Boolean);
  if (battlePlayerTeam.length === 0) {
    _notify(_t('zone_equip_boss_required'), 'error');
    return;
  }
  const preview = getTrainerCombatPreview(spawnWithZone, agentIds);

  // ── Build gang trainers ──────────────────────────────────────
  const mkPkSlot = pk => ({ pk, maxHp: calcCombatHp(pk.stats, pk.level), hp: calcCombatHp(pk.stats, pk.level) });
  const gangTrainers = [];

  const bossInZone = state.gang.bossZone === zoneId;
  if (bossInZone) {
    const bossPokemons = state.gang.bossTeam.map(id => globalThis.pokemonById?.(id) ?? state.pokemons.find(p => p.id === id)).filter(Boolean);
    if (bossPokemons.length) {
      const domEl = win.querySelector('.zone-boss');
      gangTrainers.push({ id: 'boss', name: state.gang.bossName || 'Boss',
        pkList: bossPokemons.map(mkPkSlot), activeIdx: 0, domEl });
    }
  }
  for (const agent of state.agents.filter(a => a.assignedZone === zoneId)) {
    const slots = globalThis.getAgentTeamSlots?.(agent) ?? 3;
    const agentPks = (agent.team || []).slice(0, slots).map(id => globalThis.pokemonById?.(id) ?? state.pokemons.find(p => p.id === id)).filter(Boolean);
    if (agentPks.length) {
      const domEl = win.querySelector(`[data-agent-id="${agent.id}"]`);
      gangTrainers.push({ id: agent.id, name: agent.name,
        pkList: agentPks.map(mkPkSlot), activeIdx: 0, domEl });
    }
  }
  if (!gangTrainers.length) {
    const domEl = win.querySelector('.zone-boss') || win.querySelector('.zone-agent');
    gangTrainers.push({ id: 'gang', name: state.gang.bossName || 'Gang',
      pkList: available.slice(0, 6).map(mkPkSlot), activeIdx: 0, domEl });
  }

  // ── Build enemy trainers ─────────────────────────────────────
  const mkEnemySlot = ep => {
    const sp = SPECIES_BY_EN[ep.species_en];
    const stats = ep.stats || { atk: sp?.baseAtk || 50, def: sp?.baseDef || 50, spd: sp?.baseSpd || 50 };
    const maxHp = calcCombatHp(stats, ep.level);
    return { pk: ep, stats, maxHp, hp: maxHp };
  };
  let enemyTrainers;
  if (isRaid) {
    enemyTrainers = spawnObj.raidTrainers
      .map(rt => ({ id: rt.key, name: rt.trainer?.fr || rt.key,
        pkList: (rt.team || []).map(mkEnemySlot), activeIdx: 0 }))
      .filter(t => t.pkList.length > 0);
  } else {
    const rawTeam = (spawnObj.team || []).filter(Boolean);
    enemyTrainers = [{ id: spawnObj.trainerKey || 'trainer', name: trainerName,
      pkList: rawTeam.map(mkEnemySlot), activeIdx: 0 }];
  }
  const enemyPool = enemyTrainers.flatMap(t => t.pkList);

  // Impossible de combattre sans équipe ennemie (spawn expiré ou mal formé)
  if (enemyPool.length === 0) { currentCombat = null; globalThis.currentCombat = null; return; }

  // ── Find spawn element (enemy's existing DOM element) ─────────
  const spawnEl = viewport.querySelector(`[data-spawn-id="${spawnObj.id}"]`);
  const playerAnchorEl = gangTrainers.find(t => t.domEl)?.domEl
    || win.querySelector('.zone-boss')
    || win.querySelector('.zone-agent');
  const summary = getTrainerCombatSummary(spawnWithZone, agentIds);
  const enemyTeam = buildTrainerBattleEnemyTeam(enemyPool, summary.trainerTypeMultiplier);

  currentCombat = {
    zoneId,
    spawnObj,
    spawnWithZone,
    viewport,
    spawnEl,
    playerAnchorEl,
    playerTeam: battlePlayerTeam,
    enemyTeam,
    teamIds,
    agentIds,
    gangTrainers,
    enemyTrainers,
    enemyPool,
    summary,
    combatStarted: false,
    timers: [],
  };
  globalThis.currentCombat = currentCombat;

  win.classList.add('zone-window-battle');
  if (spawnEl) {
    spawnEl.classList.add('zone-spawn-battle');
    spawnEl.style.animation = 'none';
  }

  // ── Tier de difficulté (stocké dans currentCombat pour la résolution) ──
  const combatTier = getDifficultyTier(preview.attackerPower, preview.defenderPower);
  currentCombat.tier = combatTier;

  // ── HUD minimal en bas du viewport ─
  const hud = document.createElement('div');
  hud.className = 'zone-combat-hud zone-combat-hud-minimal';
  hud.id = `zchud-${zoneId}`;
  hud.innerHTML = `
    <div class="combat-tier-header" style="border-color:${combatTier.color};color:${combatTier.color}">
      <span class="ct-emoji">${combatTier.emoji}</span>
      <span class="ct-label">${combatTier.label}</span>
      <span class="ct-ratio">${combatTier.rationale}</span>
      <span class="ct-reward">×${combatTier.rewardMult}</span>
    </div>
    <span class="zchud-vs">⚔ ${_esc(trainerName)} <span style="color:var(--text-dim);font-size:7px">${enemyPool.length} Pok. · ⚡${fmtCombatNum(preview.attackerPower)} / 🛡${fmtCombatNum(preview.defenderPower)}</span></span>
      <button class="zchud-flee" id="zchud-flee-${zoneId}">${_t('zone_flee')}</button>`;
  viewport.appendChild(hud);

  // ── Auto-start + flee ─────────────────────────────────────────
  const autoCombatTimer = setTimeout(executeCombat, 600);
  currentCombat.timers.push(autoCombatTimer);
  document.getElementById(`zchud-flee-${zoneId}`)?.addEventListener('click', () => {
    clearTimeout(autoCombatTimer);
    closeCombatPopup();
  });
}

function executeCombat() {
  const state = globalThis.state;
  if (!currentCombat) return;
  if (currentCombat.combatStarted) return;
  currentCombat.combatStarted = true;

  const { zoneId, spawnObj, spawnWithZone, spawnEl, playerAnchorEl, playerTeam, enemyTeam, teamIds, enemyPool, summary } = currentCombat;
  EventBus.emit(EVENTS.COMBAT_STARTED, {
    zoneId,
    trainerKey: spawnWithZone.trainerKey ?? null,
    mode: spawnWithZone.combatMode || 'manual',
    initiatedBy: spawnWithZone.initiatedBy || 'player',
  });
  const logEl = document.getElementById(`zchud-log-${zoneId}`);
  const combatLogLines = [];
  const trainerReward = spawnWithZone.trainer?.reward || [10, 50];
  const battle = resolveEventBattle({ playerTeam, enemyTeam });
  currentCombat.battle = battle;

  const result = {
    ...summary,
    attackerWin: battle.win,
    win: battle.win,
  };
  const reward = result.attackerWin
    ? Math.min(globalThis.MAX_COMBAT_REWARD, globalThis.randInt(trainerReward[0], trainerReward[1]))
    : 0;
  const repGain = globalThis.getCombatRepGain(spawnWithZone.trainerKey || spawnWithZone.trainer?.sprite, result.attackerWin);

  globalThis.applyCombatResult({ win: result.attackerWin, reward, repGain, tier: currentCombat?.tier }, teamIds, spawnWithZone);
  if (result.attackerWin) {
    const zoneState = state.zones[zoneId];
    if (zoneState) zoneState.combatsWon = (zoneState.combatsWon || 0) + 1;
  } else {
    _notify(_t('zone_defeat_no_loot_notice', { trainer: trainerCombatName(spawnWithZone) }), 'error', 'combat');
  }
  _save();

  const taglines = buildTrainerCombatTaglines(spawnWithZone, result, reward, repGain);
  const introLines = taglines.slice(0, 4);
  const resultLines = taglines.slice(4);
  const zoneDef = ZONE_BY_ID[zoneId];
  const zName = zoneDef ? (state.lang === 'fr' ? zoneDef.fr : zoneDef.en) : zoneId;
  globalThis.pushFeedEvent?.({
    category: 'combat',
    title: result.attackerWin
      ? _t('zone_feed_victory', { trainer: trainerCombatName(spawnWithZone), reward, rep: repGain })
      : _t('zone_feed_defeat', { trainer: trainerCombatName(spawnWithZone) }),
    detail: _t('zone_feed_combat_detail', { zone: zName, attack: fmtCombatNum(result.attackerPower), defense: fmtCombatNum(result.defenderPower), count: enemyPool.length }),
    win: result.attackerWin,
    combatLog: [
      ...introLines,
      ...battle.turns.filter(t => t.type === 'attack').map(t => `${globalThis.speciesName(t.attackerSpecies)} → ${t.move} (${t.damage} dgts)`),
      ...resultLines,
    ],
  });

  let playerOv = null;
  let enemyOv = null;
  let playerSpriteEl = null;
  let enemySpriteEl = null;

  function queueTimer(fn, ms) {
    const timer = setTimeout(fn, ms);
    currentCombat?.timers?.push(timer);
    return timer;
  }

  function logLine(text, kind = '') {
    combatLogLines.push(text);
    if (!logEl) return;
    const line = document.createElement('div');
    line.className = 'zchud-line';
    line.textContent = `> ${text}`;
    if (kind === 'result') {
      line.style.color = result.attackerWin ? 'var(--gold)' : 'var(--red)';
      line.style.fontWeight = '700';
    } else if (kind === 'loot') {
      line.style.color = 'var(--gold)';
    } else {
      line.style.color = 'var(--text-dim)';
    }
    logEl.appendChild(line);
    while (logEl.children.length > 7) logEl.firstChild.remove();
    logEl.scrollTop = logEl.scrollHeight;
  }

  function ensurePlayerOverlay() {
    if (!playerAnchorEl) return null;
    if (!playerOv) {
      playerOv = makeCombatOverlay(playerAnchorEl, 'player');
      playerSpriteEl = document.createElement('div');
      playerSpriteEl.className = 'combat-sent-pk';
      playerAnchorEl.appendChild(playerSpriteEl);
    }
    return playerOv;
  }

  function ensureEnemyOverlay() {
    if (!spawnEl) return null;
    if (!enemyOv) enemyOv = makeCombatOverlay(spawnEl, 'enemy');
    return enemyOv;
  }

  function playSwitch(t) {
    if (t.side === 'player') {
      const ov = ensurePlayerOverlay();
      if (ov) {
        ov.name.textContent = `${globalThis.speciesName(t.species_en)} Lv.${t.level}`;
        setCombatHpBar(ov, t.hp, t.maxHp);
        if (playerSpriteEl) {
          playerSpriteEl.innerHTML = `<img src="${globalThis.pokeSpriteBack(t.species_en, t.shiny)}" style="width:40px;height:40px;${t.shiny ? 'filter:drop-shadow(0 0 4px var(--gold))' : ''}">`;
        }
      }
    } else {
      const ov = ensureEnemyOverlay();
      if (ov) {
        ov.name.textContent = `${globalThis.speciesName(t.species_en)} Lv.${t.level}`;
        setCombatHpBar(ov, t.hp, t.maxHp);
      }
      if (spawnEl) {
        enemySpriteEl = spawnEl.querySelector('.combat-enemy-pk') || document.createElement('img');
        enemySpriteEl.className = 'combat-enemy-pk';
        enemySpriteEl.src = globalThis.pokeSprite(t.species_en, t.shiny);
        enemySpriteEl.style.cssText = `width:56px;height:56px;image-rendering:pixelated;${t.shiny ? 'filter:drop-shadow(0 0 6px var(--gold))' : ''}`;
        if (!enemySpriteEl.parentNode) spawnEl.insertBefore(enemySpriteEl, spawnEl.firstChild);
      }
    }
    logLine(`${globalThis.speciesName(t.species_en)} entre en jeu !`);
  }

  function doClose() {
    closeCombatPopup();
    removeSpawn(zoneId, spawnObj.id);
    _topBar();
    updateZoneTimers(zoneId);
    if (globalThis.activeTab === 'tabGang') globalThis.renderGangTab();
  }

  if (spawnEl) {
    spawnEl.classList.add(result.attackerWin ? 'caught' : 'failed');
    spawnEl.style.opacity = result.attackerWin ? '0.45' : '0.75';
  }

  const hudEl = document.getElementById(`zchud-${zoneId}`);
  const fleeBtn = hudEl?.querySelector('.zchud-flee');
  if (fleeBtn) {
    fleeBtn.disabled = true;
    fleeBtn.textContent = _t('zone_combat_in_progress');
  }

  const script = [
    ...introLines.map(text => ({ type: 'log', text })),
    ...battle.turns.filter(t => t.type !== 'result'),
    ...resultLines.map(text => ({ type: 'log', text, final: true })),
  ];

  let index = 0;
  const delay = 650;
  function nextStep() {
    if (!currentCombat || currentCombat.zoneId !== zoneId) return;
    if (index < script.length) {
      const item = script[index++];
      if (item.type === 'log') {
        const text = item.text;
        const kind = text.startsWith('— ') ? 'result' : (text.startsWith('+') || text.includes(_t('zone_no_loot'))) ? 'loot' : '';
        logLine(text, kind);
      } else if (item.type === 'switch') {
        playSwitch(item);
      } else if (item.type === 'attack') {
        const atkName = globalThis.speciesName(item.attackerSpecies);
        const effTxt = item.effectiveness > 1 ? _t('zone_effective_super')
          : (item.effectiveness > 0 && item.effectiveness < 1) ? _t('zone_effective_low')
          : item.effectiveness === 0 ? _t('zone_effective_none') : '';
        logLine(_t('zone_uses_move', { pokemon: atkName, move: item.move, effectiveness: effTxt }));
        const targetOv = item.side === 'player' ? ensureEnemyOverlay() : ensurePlayerOverlay();
        setCombatHpBar(targetOv, item.defenderHp, item.defenderMaxHp);
        playCombatHitEffect(item.side === 'player' ? (enemySpriteEl || spawnEl) : (playerSpriteEl || playerAnchorEl));
      } else if (item.type === 'faint') {
        logLine(_t('zone_knocked_out', { pokemon: globalThis.speciesName(item.species_en) }));
      }
      queueTimer(nextStep, delay);
      return;
    }

    const closeBtn = hudEl?.querySelector('.zchud-flee');
    if (closeBtn) {
      closeBtn.disabled = false;
      closeBtn.textContent = _t('zone_close');
      closeBtn.onclick = doClose;
    }
    queueTimer(doClose, 1800);
  }

  queueTimer(nextStep, 120);
}

function closeCombatPopup() {
  if (currentCombat) {
    const { zoneId, viewport, spawnEl } = currentCombat;
    for (const timer of currentCombat.timers || []) clearTimeout(timer);
    const win = document.getElementById(`zw-${zoneId}`);
    win?.classList.remove('zone-window-battle');
    document.getElementById(`zchud-${zoneId}`)?.remove();
    viewport?.querySelectorAll('.combat-hp-overlay').forEach(el => el.remove());
    win?.querySelectorAll('.combat-hp-overlay').forEach(el => el.remove());
    win?.querySelectorAll('.combat-sent-pk').forEach(el => el.remove());
    if (spawnEl) {
      spawnEl.classList.remove('zone-spawn-battle', 'combat-hit');
      spawnEl.style.animation = '';
    }
    for (const t of currentCombat.gangTrainers || []) {
      if (t.domEl) t.domEl.style.opacity = '';
    }
    _refreshRaidBtn(zoneId);
  }
  currentCombat = null;
  globalThis.currentCombat = null;
}

// ════════════════════════════════════════════════════════════════
// Event Battle — combat réel pokémon-par-pokémon contre un PNJ
// d'événement (SPECIAL_EVENTS + trainerKey, cf. renderEventTrainerInWindow).
// Chemin dédié aux PNJ permanents : il partage le même moteur pur
// resolveEventBattle que le combat de zone normal, avec ses récompenses et
// son nettoyage spécifiques. currentCombat.isEventBattle distingue les deux
// chemins UI.
// ════════════════════════════════════════════════════════════════

function openEventBattlePopup(zoneId) {
  const state = globalThis.state;
  // Même garde combinée que openCombatPopup — voir son commentaire.
  if (currentCombat || isZoneCombatBusy(zoneId)) return;

  const activeEvt = globalThis.zoneActivity[zoneId];
  const mode = globalThis.getZoneActivityMode(zoneId);
  const eventDef = mode === 'event' ? SPECIAL_EVENTS.find(e => e.id === activeEvt?.eventId) : null;
  if (!eventDef?.trainerKey) return;
  const trainerData = TRAINER_TYPES[eventDef.trainerKey];
  if (!trainerData) return;

  // Le joueur initie un combat → le boss se déplace dans cette zone
  if (state.gang.bossZone !== zoneId) {
    state.gang.bossZone = zoneId;
    globalThis.syncBackgroundZones?.();
  }

  const playerPokemon = buildPlayerTeamForZone(zoneId);
  if (playerPokemon.length === 0) {
    _notify(_t('zone_equip_boss_required'), 'error');
    return;
  }

  const win = document.getElementById(`zw-${zoneId}`);
  const viewport = win?.querySelector('.zone-viewport');
  const npcEl = viewport?.querySelector('.zone-event-trainer');
  if (!win || !viewport || !npcEl) return;

  const agentIds = getZoneCombatAgentIds(zoneId);
  const teamIds = buildTrainerCombatTeamIds(agentIds, zoneId);

  // Équipe ennemie boostée — même formule que l'ancien chemin isSpecial.
  const zone = ZONE_BY_ID[zoneId];
  const enemyTeam = globalThis.makeTrainerTeam(zone, eventDef.trainerKey);
  enemyTeam.forEach(t => {
    t.level += 10;
    t.stats = globalThis.calculateStats({ species_en: t.species_en, level: t.level, nature: 'hardy', potential: 4 });
  });

  win.classList.add('zone-window-battle');

  const anchorPlayerEl = win.querySelector('.zone-boss') || win.querySelector('.zone-agent');
  const trainerName = state.lang === 'fr' ? (trainerData.fr ?? eventDef.trainerKey) : (trainerData.en ?? eventDef.trainerKey);
  const zoneDef = ZONE_BY_ID[zoneId];
  const zoneName = zoneDef ? (state.lang === 'fr' ? zoneDef.fr : zoneDef.en) : zoneId;

  currentCombat = {
    zoneId, isEventBattle: true, eventDef, trainerData, trainerName, zoneName,
    viewport, npcEl, anchorPlayerEl, playerPokemon, enemyTeam, teamIds,
    combatStarted: false, timers: [],
  };
  globalThis.currentCombat = currentCombat;

  const hud = document.createElement('div');
  hud.className = 'zone-combat-hud zone-combat-hud-minimal';
  hud.id = `zchud-${zoneId}`;
  hud.innerHTML = `
    <span class="zchud-vs">⚔ ${_esc(trainerName)} <span style="color:var(--text-dim);font-size:7px">${enemyTeam.length} Pok.</span></span>
      <button class="zchud-flee" id="zchud-flee-${zoneId}">${_t('zone_flee')}</button>`;
  viewport.appendChild(hud);

  const autoTimer = setTimeout(executeEventBattle, 600);
  currentCombat.timers.push(autoTimer);
  document.getElementById(`zchud-flee-${zoneId}`)?.addEventListener('click', () => {
    clearTimeout(autoTimer);
    closeEventBattle();
  });
}

function executeEventBattle() {
  if (!currentCombat || !currentCombat.isEventBattle) return;
  if (currentCombat.combatStarted) return;
  currentCombat.combatStarted = true;

  const { zoneId, npcEl, anchorPlayerEl, playerPokemon, enemyTeam, eventDef, trainerData, trainerName, zoneName, teamIds } = currentCombat;
  EventBus.emit(EVENTS.COMBAT_STARTED, {
    zoneId, trainerKey: eventDef.trainerKey, mode: 'event', initiatedBy: 'player',
  });
  const logEl = document.getElementById(`zchud-log-${zoneId}`);
  const battle = resolveEventBattle({ playerTeam: playerPokemon, enemyTeam });
  currentCombat.battle = battle;

  let playerOv = null, enemyOv = null, playerSpriteEl = null;

  function setHpBar(ov, hp, maxHp) {
    if (!ov) return;
    const pct = Math.max(0, Math.min(100, Math.round(hp / maxHp * 100)));
    ov.fill.style.width = pct + '%';
    ov.txt.textContent = `${Math.max(0, hp)}/${maxHp}`;
  }

  function ensurePlayerOverlay() {
    if (!anchorPlayerEl) return null;
    if (!playerOv) {
      const ov = document.createElement('div');
      ov.className = 'combat-hp-overlay combat-hp-gang';
      ov.innerHTML = `<div class="chp-name"></div><div class="chp-bar"><div class="chp-fill" style="width:100%"></div></div><div class="chp-txt"></div>`;
      anchorPlayerEl.appendChild(ov);
      playerOv = { name: ov.querySelector('.chp-name'), fill: ov.querySelector('.chp-fill'), txt: ov.querySelector('.chp-txt') };
      playerSpriteEl = document.createElement('div');
      playerSpriteEl.className = 'combat-sent-pk';
      anchorPlayerEl.appendChild(playerSpriteEl);
    }
    return playerOv;
  }
  function ensureEnemyOverlay() {
    if (!enemyOv) {
      const ov = document.createElement('div');
      ov.className = 'combat-hp-overlay combat-hp-enemy';
      ov.innerHTML = `<div class="chp-name"></div><div class="chp-bar"><div class="chp-fill chp-fill-red" style="width:100%"></div></div><div class="chp-txt"></div>`;
      npcEl.appendChild(ov);
      enemyOv = { name: ov.querySelector('.chp-name'), fill: ov.querySelector('.chp-fill'), txt: ov.querySelector('.chp-txt') };
    }
    return enemyOv;
  }

  function logLine(text, kind = '') {
    if (!logEl) return;
    const line = document.createElement('div');
    line.className = 'zchud-line';
    line.textContent = `> ${text}`;
    if (kind === 'result') { line.style.color = battle.win ? 'var(--gold)' : 'var(--red)'; line.style.fontWeight = '700'; }
    else if (kind === 'loot') line.style.color = 'var(--gold)';
    else line.style.color = 'var(--text-dim)';
    logEl.appendChild(line);
    while (logEl.children.length > 7) logEl.firstChild.remove();
    logEl.scrollTop = logEl.scrollHeight;
  }

  function queueTimer(fn, ms) {
    const t = setTimeout(fn, ms);
    currentCombat?.timers?.push(t);
    return t;
  }

  function playSwitch(t) {
    if (t.side === 'player') {
      const ov = ensurePlayerOverlay();
      if (ov) {
        ov.name.textContent = `${globalThis.speciesName(t.species_en)} Lv.${t.level}`;
        setHpBar(ov, t.hp, t.maxHp);
        if (playerSpriteEl) playerSpriteEl.innerHTML = `<img src="${globalThis.pokeSpriteBack(t.species_en, t.shiny)}" style="width:40px;height:40px;${t.shiny ? 'filter:drop-shadow(0 0 4px var(--gold))' : ''}">`;
      }
    } else {
      const ov = ensureEnemyOverlay();
      ov.name.textContent = `${globalThis.speciesName(t.species_en)} Lv.${t.level}`;
      setHpBar(ov, t.hp, t.maxHp);
      npcEl.querySelector('.event-enemy-sprite')?.remove();
      const img = document.createElement('img');
      img.className = 'event-enemy-sprite';
      img.src = globalThis.pokeSprite(t.species_en, t.shiny);
      img.style.cssText = `width:56px;height:56px;image-rendering:pixelated;${t.shiny ? 'filter:drop-shadow(0 0 6px var(--gold))' : ''}`;
      npcEl.insertBefore(img, npcEl.firstChild);
    }
    logLine(`${globalThis.speciesName(t.species_en)} entre en jeu !`);
  }

  function finalize() {
    const win = battle.win;
    const boostedReward = [trainerData.reward[0] * 4, trainerData.reward[1] * 4];
    const reward = win ? Math.min(globalThis.MAX_COMBAT_REWARD, globalThis.randInt(boostedReward[0], boostedReward[1])) : 0;
    const repGain = globalThis.getCombatRepGain(eventDef.trainerKey, win);
    const spawnData = {
      zoneId, isSpecial: true, trainerKey: eventDef.trainerKey, trainer: trainerData,
      event: eventDef, combatMode: 'event', initiatedBy: 'player',
    };
    globalThis.applyCombatResult({ win, reward, repGain }, teamIds, spawnData);

    if (win) {
      const zoneState = globalThis.state.zones[zoneId];
      if (zoneState) zoneState.combatsWon = (zoneState.combatsWon || 0) + 1;
      globalThis.activateEvent(zoneId, eventDef);
      globalThis.clearZoneActivity?.(zoneId);
      logLine(_t('zone_victory_banner'), 'result');
      if (reward > 0) logLine(_t('zone_reward_line', { reward: fmtCombatNum(reward), rep: fmtCombatNum(repGain) }), 'loot');
    } else {
      logLine(_t('zone_defeat_banner'), 'result');
      logLine(_t('zone_no_loot'), 'loot');
      _notify(_t('zone_defeat_no_loot_notice', { trainer: trainerName }), 'error', 'combat');
    }
    _save();

    globalThis.pushFeedEvent?.({
      category: 'combat',
      title: win ? _t('zone_feed_victory', { trainer: trainerName, reward, rep: repGain }) : _t('zone_feed_defeat', { trainer: trainerName }),
      detail: _t('zone_feed_event_detail', { zone: zoneName, count: enemyTeam.length }),
      win,
      combatLog: battle.turns.filter(t => t.type === 'attack').map(t => `${globalThis.speciesName(t.attackerSpecies)} → ${t.move} (${t.damage} dgts)`),
    });

    const hudEl = document.getElementById(`zchud-${zoneId}`);
    const fleeBtn = hudEl?.querySelector('.zchud-flee');
    if (fleeBtn) { fleeBtn.textContent = _t('zone_close'); fleeBtn.onclick = closeEventBattle; }
    queueTimer(closeEventBattle, 1800);
  }

  let i = 0;
  const delay = 650;
  function nextTurn() {
    if (!currentCombat || currentCombat.zoneId !== zoneId) return;
    if (i >= battle.turns.length) { finalize(); return; }
    const t = battle.turns[i++];
    if (t.type === 'switch') {
      playSwitch(t);
    } else if (t.type === 'attack') {
      const atkName = globalThis.speciesName(t.attackerSpecies);
      const effTxt = t.effectiveness > 1 ? _t('zone_effective_super')
        : (t.effectiveness > 0 && t.effectiveness < 1) ? _t('zone_effective_low')
        : t.effectiveness === 0 ? _t('zone_effective_none') : '';
      logLine(_t('zone_uses_move', { pokemon: atkName, move: t.move, effectiveness: effTxt }));
      const targetOv = t.side === 'player' ? ensureEnemyOverlay() : ensurePlayerOverlay();
      setHpBar(targetOv, t.defenderHp, t.defenderMaxHp);
      playCombatHitEffect(t.side === 'player' ? npcEl : (playerSpriteEl || anchorPlayerEl));
    } else if (t.type === 'faint') {
      logLine(_t('zone_knocked_out', { pokemon: globalThis.speciesName(t.species_en) }));
    }
    queueTimer(nextTurn, delay);
  }

  queueTimer(nextTurn, 120);
}

function closeEventBattle() {
  if (!currentCombat || !currentCombat.isEventBattle) return;
  const { zoneId, viewport, npcEl, anchorPlayerEl, trainerData } = currentCombat;
  for (const t of currentCombat.timers || []) clearTimeout(t);
  const win = document.getElementById(`zw-${zoneId}`);
  win?.classList.remove('zone-window-battle');
  document.getElementById(`zchud-${zoneId}`)?.remove();
  viewport?.querySelectorAll('.combat-hp-overlay').forEach(el => el.remove());
  anchorPlayerEl?.querySelectorAll('.combat-sent-pk').forEach(el => el.remove());
  currentCombat = null;
  globalThis.currentCombat = null;

  renderEventTrainerInWindow(zoneId); // retire le PNJ si l'événement est terminé (victoire)
  if (npcEl?.isConnected) {
    // Toujours là (fuite ou défaite) → restaurer le sprite dresseur, re-cliquable
    npcEl.innerHTML = globalThis.safeTrainerImg(trainerData.sprite, { style: 'width:56px;height:56px;filter:drop-shadow(0 0 8px rgba(255,80,80,.85))' });
    delete npcEl.dataset.challenged;
  }
  _topBar();
  updateZoneTimers(zoneId);
  _refreshRaidBtn(zoneId);
}

function _refreshRaidBtn(zoneId) {
  const state = globalThis.state;
  const win = document.getElementById(`zw-${zoneId}`);
  const btn = win?.querySelector('.zone-gym-raid-btn');
  if (!btn) return;
  const zState = state.zones[zoneId] || {};
  const lastRaid = zState.gymRaidLastFight || 0;
  const raidCooldownMs = 5 * 60 * 1000;
  const raidReady = Date.now() - lastRaid >= raidCooldownMs;
  const cdSec = raidReady ? 0 : Math.ceil((raidCooldownMs - (Date.now() - lastRaid)) / 1000);
  btn.style.background = raidReady ? 'rgba(180,20,20,.8)' : 'rgba(60,60,60,.8)';
  btn.style.borderColor = raidReady ? 'var(--red)' : 'var(--border)';
  btn.style.color = raidReady ? 'var(--text)' : 'var(--text-dim)';
  btn.style.cursor = raidReady ? 'pointer' : 'default';
  btn.disabled = !raidReady;
  btn.textContent = `⚔ RAID ${zState.gymDefeated ? '(re)' : ''}${raidReady ? '' : ` ${cdSec}s`}`;
}

function refreshZoneWindowsTick() {
  for (const zoneId of getTickOpenZones()) {
    updateZoneTimers(zoneId);
    _refreshRaidBtn(zoneId);
  }
  if (getTickActiveTab() === 'tabZones') refreshTickFogTiles();
}

Object.assign(globalThis, {
  // Zone windows UI
  _zwin_openCollectionModal:      openCollectionModal,
  _zwin_showCollectionEncounter:  showCollectionEncounter,
  _zwin_startZoneCollection:      startZoneCollection,
  _zwin_showCollectionResult:     showCollectionResult,
  _zwin_spawnCoinRain:            spawnCoinRain,
  _zwin_autoCollectZone:          autoCollectZone,
  _zwin_collectAllZones:          collectAllZones,
  _zwin_renderZonesTab:           renderZonesTab,
  _zwin_openZoneWindow:           openZoneWindow,
  _zwin_closeZoneWindow:          closeZoneWindow,
  _zwin_renderZoneWindows:        renderZoneWindows,
  _zwin_buildZoneWindowEl:        buildZoneWindowEl,
  _zwin_patchZoneWindow:          patchZoneWindow,
  _zwin_updateZoneTimers:         updateZoneTimers,
  _zwin_tickZoneSpawn:            tickZoneSpawn,
  _zwin_tryWingDrop:              _tryWingDrop,
  _zwin_renderSpawnInWindow:      renderSpawnInWindow,
  _zwin_removeSpawn:              removeSpawn,
  _zwin_animateCapture:           animateCapture,
  _zwin_showCaptureBurst:         showCaptureBurst,
  _zwin_animateQuestCapture:      animateQuestCapture,
  _zwin_buildPlayerTeamForZone:   buildPlayerTeamForZone,
  _zwin_openCombatPopup:          openCombatPopup,
  _zwin_executeCombat:            executeCombat,
  _zwin_closeCombatPopup:         closeCombatPopup,
  _zwin_openEventBattlePopup:     openEventBattlePopup,
  _zwin_executeEventBattle:       executeEventBattle,
  _zwin_closeEventBattle:         closeEventBattle,
  _zwin_renderEventTrainerInWindow: renderEventTrainerInWindow,
  _zwin_refreshRaidBtn:           _refreshRaidBtn,
  _zwin_addVSBadge:               _addVSBadge,
  _zwin_playAutoCombatVisual:     playAutoCombatVisual,
  // Expose constants
  TYPE_CHART,
  SPECIAL_WING_EVENTS,
  zoneNextSpawn,
  zoneSpawnHistory,
});

export {
  configureZoneWindowTicks,
  refreshZoneWindowsTick,
};
