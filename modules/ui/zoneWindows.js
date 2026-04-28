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
//    openZones, zoneSpawns, zoneSpawnTimers, backgroundZoneTimers
//    ZONE_BGS, ZONE_SLOT_COSTS, ITEM_SPRITE_URLS, BALL_SPRITES, MAX_COMBAT_REWARD
//    SPECIAL_TRAINER_KEYS
//
//  Classic-script globals accessed by bare name:
//    ZONE_BY_ID, SPECIES_BY_EN, TRAINER_TYPES, SPECIAL_EVENTS
// ════════════════════════════════════════════════════════════════

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
    globalThis._zsRefreshIncome?.(zoneId);
    globalThis._zsUpdateButtons?.();
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
    zones.forEach(zid => globalThis._zsRefreshIncome?.(zid));
    globalThis._zsUpdateButtons?.();
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
    zoneRows.forEach(r => globalThis._zsRefreshIncome?.(r.zid));
    globalThis._zsUpdateButtons?.();
  });
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.remove();
      zoneRows.forEach(r => globalThis._zsRefreshIncome?.(r.zid));
      globalThis._zsUpdateButtons?.();
    }
  });
}

// ════════════════════════════════════════════════════════════════
// Zone Tab + Windows
// ════════════════════════════════════════════════════════════════

function renderZonesTab() {
  globalThis._zsRenderSelector?.();
  renderZoneWindows();
  globalThis._zsBindActions?.();
  globalThis.renderGangBasePanel();
}

function openZoneWindow(zoneId) {
  const state = globalThis.state;
  const openZones = globalThis.openZones;
  const zoneSpawns = globalThis.zoneSpawns;
  const zoneSpawnTimers = globalThis.zoneSpawnTimers;

  // Guard : si déjà ouverte, ne rien faire (évite les timers orphelins)
  if (openZones.has(zoneId)) { globalThis._zsRefreshTile?.(zoneId); return; }
  openZones.add(zoneId);
  // Zone passe en mode visuel → arrêter le timer background si actif
  globalThis.stopBackgroundZone(zoneId);
  // Persister l'ordre pour la musique et le rechargement
  if (!state.openZoneOrder) state.openZoneOrder = [];
  if (!state.openZoneOrder.includes(zoneId)) state.openZoneOrder.push(zoneId);
  globalThis.saveState();
  globalThis.initZone(zoneId);
  zoneSpawns[zoneId] = [];
  // Boss auto-moves to first opened zone if not set
  if (!state.gang.bossZone || !openZones.has(state.gang.bossZone)) {
    state.gang.bossZone = zoneId;
  }
  // Nettoyer un éventuel timer résiduel avant d'en créer un nouveau
  if (zoneSpawnTimers[zoneId]) { clearInterval(zoneSpawnTimers[zoneId]); delete zoneSpawnTimers[zoneId]; }
  // Start spawn timer
  const zone = ZONE_BY_ID[zoneId];
  if (zone) {
    const interval = Math.round(1000 / zone.spawnRate);
    zoneSpawnTimers[zoneId] = setInterval(() => tickZoneSpawn(zoneId), interval);
  }
  globalThis.MusicPlayer?.updateFromContext();
  // Mise à jour ciblée : tuile + fenêtres + base — sans reconstruire tout le sélecteur
  globalThis._zsRefreshTile?.(zoneId);
  globalThis.renderGangBasePanel();
  renderZoneWindows();
  globalThis._zsUpdateButtons?.();
}

function closeZoneWindow(zoneId) {
  const state = globalThis.state;
  const openZones = globalThis.openZones;
  const zoneSpawns = globalThis.zoneSpawns;
  const zoneSpawnTimers = globalThis.zoneSpawnTimers;

  openZones.delete(zoneId);
  // Retirer de l'ordre persisté → MusicPlayer ne lira plus cette zone
  state.openZoneOrder = (state.openZoneOrder || []).filter(id => id !== zoneId);
  globalThis.saveState();
  if (zoneSpawnTimers[zoneId]) {
    clearInterval(zoneSpawnTimers[zoneId]);
    delete zoneSpawnTimers[zoneId];
  }
  // Clean up spawns
  if (zoneSpawns[zoneId]) {
    for (const s of zoneSpawns[zoneId]) {
      if (s.timeout) clearTimeout(s.timeout);
    }
    delete zoneSpawns[zoneId];
  }
  // Zone fermée → démarrer timer background si agents présents
  const hasAgents = state.agents.some(a => a.assignedZone === zoneId);
  if (hasAgents) globalThis.startBackgroundZone(zoneId);
  globalThis.MusicPlayer?.updateFromContext();
  // Mise à jour ciblée : tuile + fenêtres + base — sans reconstruire tout le sélecteur
  globalThis._zsRefreshTile?.(zoneId);
  globalThis.renderGangBasePanel();
  renderZoneWindows();
  globalThis._zsUpdateButtons?.();
}

function renderZoneWindows() {
  const state = globalThis.state;
  const openZones = globalThis.openZones;
  const zoneSpawns = globalThis.zoneSpawns;

  const container = document.getElementById('zoneWindows');
  if (!container) return;

  // "No zones" placeholder
  let placeholder = container.querySelector('.zone-placeholder');
  if (openZones.size === 0) {
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = 'zone-placeholder';
      placeholder.style.cssText = 'color:var(--text-dim);padding:20px 0;text-align:center;width:100%';
      placeholder.textContent = 'Sélectionnez une zone dans la grille pour commencer';
      container.appendChild(placeholder);
    }
    return;
  }
  placeholder?.remove();

  // ── Remove zone windows that are no longer open ───────────────
  container.querySelectorAll('.zone-window').forEach(el => {
    if (!openZones.has(el.id.replace('zw-', ''))) el.remove();
  });

  // ── Sort open zones by saved order ───────────────────────────
  const ordered = [...openZones].sort((a, b) => {
    const order = state.openZoneOrder || [];
    const oa = order.indexOf(a);
    const ob = order.indexOf(b);
    return (oa === -1 ? 999 : oa) - (ob === -1 ? 999 : ob);
  });

  // ── Update or create each open zone window ────────────────────
  for (const zoneId of ordered) {
    const existing = document.getElementById(`zw-${zoneId}`);
    if (existing) {
      patchZoneWindow(zoneId, existing);
    } else {
      const win = buildZoneWindowEl(zoneId);
      // Drag & drop reordering
      win.setAttribute('draggable', 'true');
      win.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', zoneId);
        win.style.opacity = '0.5';
      });
      win.addEventListener('dragend', () => { win.style.opacity = ''; });
      win.addEventListener('dragover', e => { e.preventDefault(); win.style.borderColor = 'var(--gold)'; });
      win.addEventListener('dragleave', () => { win.style.borderColor = ''; });
      win.addEventListener('drop', e => {
        e.preventDefault();
        win.style.borderColor = '';
        const sourceId = e.dataTransfer.getData('text/plain');
        if (sourceId === zoneId) return;
        const order = [...openZones];
        const fromIdx = order.indexOf(sourceId);
        const toIdx = order.indexOf(zoneId);
        if (fromIdx !== -1 && toIdx !== -1) {
          order.splice(fromIdx, 1);
          order.splice(toIdx, 0, sourceId);
          state.openZoneOrder = order;
          globalThis.saveState();
          renderZoneWindows();
        }
      });
      container.appendChild(win);
      updateZoneTimers(zoneId);
      (zoneSpawns[zoneId] || []).forEach(s => renderSpawnInWindow(zoneId, s));
    }
  }
}

// Build a fresh zone window element (used on first open)
function buildZoneWindowEl(zoneId) {
  const state = globalThis.state;
  const openZones = globalThis.openZones;
  const zone = ZONE_BY_ID[zoneId];
  const zState = state.zones[zoneId] || {};
  const mastery = globalThis.getZoneMastery(zoneId);
  const name = state.lang === 'fr' ? zone.fr : zone.en;
  const degraded = globalThis.isZoneDegraded(zoneId);
  const ZONE_BGS = globalThis.ZONE_BGS;
  const ZONE_SLOT_COSTS = globalThis.ZONE_SLOT_COSTS;
  const trainerSprite = globalThis.trainerSprite;

  const boosts = [];
  if (globalThis.isBoostActive('incense'))    boosts.push('INC');
  if (globalThis.isBoostActive('rarescope'))  boosts.push('SCO');
  if (globalThis.isBoostActive('aura'))       boosts.push('AUR');
  if (globalThis.isBoostActive('chestBoost')) boosts.push('CHT');

  const activeEvt = state.activeEvents[zoneId];
  const eventActive = activeEvt && activeEvt.expiresAt > Date.now();
  const eventDef = eventActive ? SPECIAL_EVENTS.find(e => e.id === activeEvt.eventId) : null;

  const assignedAgents = state.agents.filter(a => a.assignedZone === zoneId);
  const gymDefeated = zState.gymDefeated;
  const combats = zState.combatsWon || 0;
  const captures = zState.captures || 0;
  const nextMastery = mastery < 3 ? (mastery < 2 ? 10 : 50) : null;
  const progressText = zone.type === 'city'
    ? `Combats: ${combats}${gymDefeated ? ' ✓GYM' : combats >= 10 && zone.gymLeader ? ' — RAID!' : ''}`
    : `Combats: ${combats}${nextMastery ? `/${nextMastery}` : ''} | Cap: ${captures}`;

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

  const _slotCost = (() => {
    const nextSlot = (zState.slots || 1);
    const cost = globalThis.getZoneSlotCost(zoneId, nextSlot - 1);
    const canAfford = state.gang.money >= cost;
    return { nextSlot, cost, canAfford };
  })();

  win.innerHTML = `
    <div class="zone-headbar${degraded ? ' zone-headbar-degraded' : ''}" data-zone-hb="${zoneId}">
      <span class="headbar-name">${name}${gymDefeated ? ' [V]' : ''}${degraded ? ' ⚠' : ''}</span>
      <span class="headbar-stats">${'*'.repeat(mastery)} ${boosts.map(b => `<span class="boost-tag">${b}</span>`).join('')}</span>
      <button class="headbar-collect-btn" data-headbar-collect="${zoneId}" style="display:${(zState.pendingIncome||0) > 0 ? 'flex' : 'none'};font-family:var(--font-pixel);font-size:7px;padding:1px 6px;background:rgba(200,160,40,.25);border:1px solid var(--gold-dim);border-radius:2px;color:var(--gold);cursor:pointer;align-items:center;gap:2px">₽ ${(zState.pendingIncome||0) > 0 ? (zState.pendingIncome).toLocaleString() : ''}</button>
      <button class="headbar-close" data-close-zone="${zoneId}" title="Fermer">✕</button>
    </div>
    <div class="zone-viewport">
      ${degraded ? `<div class="zone-degraded-banner">⚠ ${state.lang === 'fr' ? 'MODE COMBAT — Réputation insuffisante' : 'COMBAT MODE — Reputation too low'}</div>` : ''}
      ${boosts.length ? `<div class="zone-boosts">${boosts.map(b => `<span class="boost-badge">${b}</span>`).join('')}</div>` : ''}
      ${eventActive && eventDef ? `<div class="zone-event-banner">${state.lang === 'fr' ? eventDef.fr : eventDef.en}</div>` : ''}
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
          <span class="slot-count" style="color:var(--text-dim)">Agents: ${assignedAgents.length}/${zState.slots || 1}</span>
          ${(zState.slots || 1) < ZONE_SLOT_COSTS.length + 1 ? `<button class="zone-slot-upgrade" data-zone-upgrade="${zoneId}" data-cost="${_slotCost.cost}"
            style="font-family:var(--font-pixel);font-size:7px;padding:2px 6px;background:var(--bg);
            border:1px solid ${_slotCost.canAfford ? 'var(--gold-dim)' : 'var(--border)'};border-radius:2px;
            color:${_slotCost.canAfford ? 'var(--gold)' : 'var(--text-dim)'};cursor:${_slotCost.canAfford ? 'pointer' : 'default'}"
            ${_slotCost.canAfford ? '' : 'disabled'}>+slot ${_slotCost.cost.toLocaleString()}₽</button>` : `<span style="color:var(--gold)">FULL</span>`}
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
    globalThis.saveState();
    renderZoneWindows();
  });

  win.querySelector(`[data-gym-raid="${zoneId}"]`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    globalThis.triggerGymRaid(zoneId);
  });

  win.querySelector(`[data-zone-upgrade="${zoneId}"]`)?.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const zs = globalThis.initZone(zoneId);
    const nextSlot = zs.slots || 1;
    const cost = globalThis.getZoneSlotCost(zoneId, nextSlot - 1);
    if (!cost || state.gang.money < cost) { globalThis.notify('Pokédollars insuffisants', 'error'); return; }
    globalThis.showConfirm(`Dépenser ${cost.toLocaleString()}₽ pour débloquer un slot agent ?`, () => {
      state.gang.money -= cost;
      zs.slots = nextSlot + 1;
      globalThis.saveState();
      globalThis.updateTopBar();
      globalThis.notify(`Zone améliorée ! Slots agents: ${zs.slots}`, 'gold');
      renderZoneWindows();
    }, null, { confirmLabel: 'Oui', cancelLabel: 'Non' });
  });

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
  const ZONE_SLOT_COSTS = globalThis.ZONE_SLOT_COSTS;
  const trainerSprite = globalThis.trainerSprite;
  const gymDefeated = zState.gymDefeated;
  const combats = zState.combatsWon || 0;
  const captures = zState.captures || 0;
  const nextMastery = mastery < 3 ? (mastery < 2 ? 10 : 50) : null;
  const progressText = zone.type === 'city'
    ? `Combats: ${combats}${gymDefeated ? ' ✓GYM' : combats >= 10 && zone.gymLeader ? ' — RAID!' : ''}`
    : `Combats: ${combats}${nextMastery ? `/${nextMastery}` : ''} | Cap: ${captures}`;

  const boosts = [];
  if (globalThis.isBoostActive('incense'))    boosts.push('INC');
  if (globalThis.isBoostActive('rarescope'))  boosts.push('SCO');
  if (globalThis.isBoostActive('aura'))       boosts.push('AUR');
  if (globalThis.isBoostActive('chestBoost')) boosts.push('CHT');

  // Headbar
  const headbar = win.querySelector(`[data-zone-hb="${zoneId}"]`);
  if (headbar) {
    headbar.className = `zone-headbar${degraded ? ' zone-headbar-degraded' : ''}`;
    const nameEl = headbar.querySelector('.headbar-name');
    if (nameEl) nameEl.innerHTML = `${name}${gymDefeated ? ' [V]' : ''}${degraded ? ' ⚠' : ''}`;
    const statsEl = headbar.querySelector('.headbar-stats');
    if (statsEl) statsEl.innerHTML = `${'*'.repeat(mastery)} ${boosts.map(b => `<span class="boost-tag">${b}</span>`).join('')}`;
    // ₽ collect button
    const collectBtn = headbar.querySelector(`[data-headbar-collect="${zoneId}"]`);
    const income = zState.pendingIncome || 0;
    if (collectBtn) {
      collectBtn.style.display = income > 0 ? 'flex' : 'none';
      if (income > 0) collectBtn.textContent = `₽ ${income.toLocaleString()}`;
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
    banner.textContent = `⚠ ${state.lang === 'fr' ? 'MODE COMBAT — Réputation insuffisante' : 'COMBAT MODE — Reputation too low'}`;
    viewport.insertBefore(banner, viewport.firstChild);
  } else if (!degraded && banner) {
    banner.remove();
  }

  // Update progress bar
  const progressBar = win.querySelector(`#zpb-${zoneId}`);
  if (progressBar) progressBar.textContent = `${progressText}${zone.type === 'city' ? ` — XP×${zone.xpBonus}` : ''}`;

  // Agent elements — remove + re-add in footer bar (left of zone-footer-right)
  const slotsBar = win.querySelector('.zone-slots-bar');
  const footerRight = slotsBar?.querySelector('.zone-footer-right');
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

  // Refresh slot-info section inside zone-footer-right
  const freshAssigned = state.agents.filter(a => a.assignedZone === zoneId);
  const freshZState2 = state.zones[zoneId] || {};
  const freshMaxSlots = freshZState2.slots || 1;
  const freshCanUpgrade = freshMaxSlots < ZONE_SLOT_COSTS.length + 1;
  const freshCost = freshCanUpgrade ? globalThis.getZoneSlotCost(zoneId, freshMaxSlots - 1) : null;
  const freshCanAfford = freshCost && state.gang.money >= freshCost;
  const slotInfo = win.querySelector('.zone-slot-info');
  if (slotInfo) {
    slotInfo.innerHTML = `
      <span class="slot-count" style="color:var(--text-dim)">Agents: ${freshAssigned.length}/${freshMaxSlots}</span>
      ${freshCanUpgrade
        ? `<button class="zone-slot-upgrade" data-zone-upgrade="${zoneId}" data-cost="${freshCost}"
            style="font-family:var(--font-pixel);font-size:7px;padding:2px 6px;background:var(--bg);
            border:1px solid ${freshCanAfford ? 'var(--gold-dim)' : 'var(--border)'};border-radius:2px;
            color:${freshCanAfford ? 'var(--gold)' : 'var(--text-dim)'};cursor:${freshCanAfford ? 'pointer' : 'default'}"
            ${freshCanAfford ? '' : 'disabled'}>+slot ${freshCost.toLocaleString()}₽</button>`
        : '<span style="color:var(--gold)">FULL</span>'}
    `;
    // Rebind dblclick upgrade
    slotInfo.querySelector(`[data-zone-upgrade="${zoneId}"]`)?.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const zs2 = globalThis.initZone(zoneId);
      const ns = zs2.slots || 1;
      const uc = globalThis.getZoneSlotCost(zoneId, ns - 1);
      if (!uc || state.gang.money < uc) { globalThis.notify('Pokédollars insuffisants', 'error'); return; }
      globalThis.showConfirm(`Dépenser ${uc.toLocaleString()}₽ pour débloquer un slot agent ?`, () => {
        state.gang.money -= uc;
        zs2.slots = ns + 1;
        globalThis.saveState();
        globalThis.updateTopBar();
        globalThis.notify(`Zone améliorée ! Slots agents: ${zs2.slots}`, 'gold');
        renderZoneWindows();
      }, null, { confirmLabel: 'Oui', cancelLabel: 'Non' });
    });
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
      ? `Combats: ${combats}${zState.gymDefeated ? ' ✓GYM' : combats >= 10 && zone.gymLeader ? ' — RAID!' : ''}`
      : `Combats: ${combats}${nextMastery ? `/${nextMastery}` : ''} | Cap: ${captures}`;
    progressBar.textContent = `${progressText}${zone.type === 'city' ? ` — XP×${zone.xpBonus}` : ''}`;
  }

  // Refresh slot count
  const countSpan = win.querySelector('.slot-count');
  if (countSpan) {
    const assignedCount = state.agents.filter(a => a.assignedZone === zoneId).length;
    const maxSlots = (state.zones[zoneId]?.slots) || 1;
    countSpan.textContent = `Agents: ${assignedCount}/${maxSlots}`;
  }

  // Cooldown display on agents in footer bar
  for (const agent of state.agents.filter(a => a.assignedZone === zoneId)) {
    const agentEl = win.querySelector(`[data-agent-id="${agent.id}"] .agent-cd-label`);
    if (!agentEl) continue;
    const agentPks = agent.team.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
    const allCd = agentPks.length > 0 && agentPks.every(p => (p.cooldown || 0) > 0);
    if (allCd) {
      const maxCd = Math.max(...agentPks.map(p => p.cooldown || 0));
      agentEl.textContent = `CD ${maxCd * 10}s`;
      agentEl.style.display = '';
    } else {
      agentEl.style.display = 'none';
    }
  }
  // Boss cooldown
  const bossCdLabel = win.querySelector('.boss-cd-label');
  if (bossCdLabel) {
    const bossPks = state.gang.bossTeam.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
    const allBossCd = bossPks.length > 0 && bossPks.every(p => (p.cooldown || 0) > 0);
    if (allBossCd) {
      const maxCd = Math.max(...bossPks.map(p => p.cooldown || 0));
      bossCdLabel.textContent = `CD ${maxCd * 10}s`;
      bossCdLabel.style.display = '';
    } else {
      bossCdLabel.style.display = 'none';
    }
  }
}

function tickZoneSpawn(zoneId) {
  const openZones = globalThis.openZones;
  const zoneSpawns = globalThis.zoneSpawns;
  if (!openZones.has(zoneId)) return;
  const spawns = zoneSpawns[zoneId];
  if (!spawns) return;
  // Max 5 spawns at once
  if (spawns.length >= 5) { updateZoneTimers(zoneId); return; }

  const entry = globalThis.spawnInZone(zoneId);
  if (!entry) return;

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
  const cfg = SPECIAL_WING_EVENTS[zoneId];
  if (!cfg) return;

  // Mastery minimum 2 (au moins 10 combats gagnés dans la zone)
  if (globalThis.getZoneMastery(zoneId) < 2) return;

  // Max 1 ombre active à la fois dans la zone
  const existing = (zoneSpawns[zoneId] || []).some(s => s.type === 'wing_shadow');
  if (existing) return;

  if (Math.random() > cfg.spawnChance) return;

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
  const x = globalThis.randInt(10, 310);
  const y = globalThis.randInt(10, 160);
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
    el.innerHTML = `<img src="${globalThis.trainerSprite(raidLeaderKey)}" style="width:52px;height:52px;image-rendering:pixelated;filter:drop-shadow(0 0 8px #f44)">
      <div style="font-family:var(--font-pixel);font-size:6px;color:#f66;background:rgba(0,0,0,.75);border-radius:2px;padding:1px 4px;margin-top:2px;text-align:center">⚔ RAID</div>`;
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
    const eliteTag = spawnObj.elite ? ' style="filter:drop-shadow(0 0 6px gold)"' : '';
    el.innerHTML = `<img src="${globalThis.trainerSprite(spawnObj.trainer?.sprite ?? spawnObj.trainerKey)}"${eliteTag} style="width:56px;height:56px${spawnObj.elite ? ';filter:drop-shadow(0 0 6px gold)' : ''}" alt="${spawnObj.trainer?.fr ?? ''}">`;
    el.title = ((state.lang === 'fr' ? (spawnObj.trainer?.fr ?? spawnObj.trainerKey ?? '???') : (spawnObj.trainer?.en ?? spawnObj.trainerKey ?? '???'))) + (spawnObj.elite ? ' ⭐' : '');
    if (spawnObj.elite) el.style.animation = 'glow 1.5s ease-in-out infinite, float 3s ease-in-out infinite';
    el.addEventListener('click', () => {
      if (el.dataset.challenged) return;
      el.dataset.challenged = '1';
      _addVSBadge(el);
      openCombatPopup(zoneId, spawnObj);
    });
  } else if (spawnObj.type === 'chest') {
    el.innerHTML = `<div class="chest-sprite">📦</div>`;
    el.title = state.lang === 'fr' ? 'Coffre au trésor !' : 'Treasure Chest!';
    el.style.animation = 'float 2s ease-in-out infinite';
    el.addEventListener('click', () => {
      if (el.classList.contains('catching')) return;
      el.classList.add('catching');
      // Opening animation
      el.innerHTML = `<div style="font-size:36px;line-height:1;animation:pop .3s ease-out">🎁</div>`;
      state.stats.chestsOpened = (state.stats.chestsOpened || 0) + 1;
      setTimeout(() => {
        const loot = globalThis.rollChestLoot(zoneId);
        globalThis.notify(loot.msg, loot.type);
        globalThis.SFX.play('chest'); // Loot jingle
        removeSpawn(zoneId, spawnObj.id);
        globalThis.updateTopBar();
        updateZoneTimers(zoneId);
        globalThis.saveState();
      }, 400);
    });
  } else if (spawnObj.type === 'wing_shadow') {
    // ── Ombre légendaire cliquable (Lugia / Ho-Oh) ─────────────
    const cfg = spawnObj.wingCfg;
    const spriteUrl = globalThis.pokeSprite(cfg.legendaryShadow);
    el.innerHTML = `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer">
        <img src="${spriteUrl}"
          style="width:64px;height:64px;image-rendering:pixelated;
                 filter:brightness(0) saturate(0) opacity(.75) drop-shadow(0 0 10px rgba(150,120,255,.9));
                 animation:float 2.5s ease-in-out infinite">
        <div style="font-family:var(--font-pixel);font-size:6px;color:rgba(200,180,255,.9);
                    text-shadow:0 0 6px rgba(150,120,255,.8);letter-spacing:.5px">${cfg.shadowLabel}</div>
        <div style="font-size:7px;color:var(--gold);animation:glow 1.5s ease-in-out infinite">✦ ${cfg.itemName}</div>
      </div>`;
    el.title = `${cfg.shadowLabel} — cliquer pour obtenir des ${cfg.itemName}`;
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
        const msg = `✦ ${qty}× ${cfg.itemName} obtenu${qty > 1 ? 's' : ''} ! (${cfg.shadowLabel})`;
        globalThis.notify(msg, 'gold');
        globalThis.addLog(msg);

        // Burst doré à l'endroit du spawn
        showCaptureBurst(viewport, parseInt(el.style.left) + 32, parseInt(el.style.top) + 32, 4, false);

        removeSpawn(zoneId, spawnObj.id);
        globalThis.updateTopBar();
        updateZoneTimers(zoneId);
        globalThis.saveState();
      }, 300);
    });

  } else if (spawnObj.type === 'event') {
    const evt = spawnObj.event;
    // Pokeball sprite based on event difficulty/rarity
    const evtBallKey = evt.trainerKey
      ? (evt.minRep >= 70 ? 'masterball' : evt.minRep >= 40 ? 'ultraball' : 'greatball')
      : 'pokeball';
    el.innerHTML = `<img src="${ITEM_SPRITE_URLS[evtBallKey]}" style="width:44px;height:44px;image-rendering:pixelated;filter:drop-shadow(0 0 8px rgba(255,204,90,.9))">`;
    el.title = state.lang === 'fr' ? evt.fr : evt.en;
    el.style.animation = 'glow 1s ease-in-out infinite, float 2s ease-in-out infinite';
    el.addEventListener('click', () => {
      if (el.classList.contains('catching')) return;
      el.classList.add('catching');
      if (evt.trainerKey) {
        // Event with combat
        const trainer = TRAINER_TYPES[evt.trainerKey];
        if (trainer) {
          const zone = ZONE_BY_ID[zoneId];
          const team = globalThis.makeTrainerTeam(zone, evt.trainerKey);
          // Boosted difficulty
          team.forEach(t => {
            t.level += 10;
            t.stats = globalThis.calculateStats({ species_en: t.species_en, level: t.level, nature: 'hardy', potential: 4 });
          });
          const combatSpawn = {
            ...spawnObj,
            type: 'trainer',
            trainerKey: evt.trainerKey,
            trainer: { ...trainer, fr: trainer.fr, en: trainer.en, diff: trainer.diff + 2, reward: [trainer.reward[0] * 4, trainer.reward[1] * 4], rep: trainer.rep * 3 },
            team,
            elite: true,
            isSpecial: true,
          };
          openCombatPopup(zoneId, combatSpawn);
        }
      } else {
        // Non-combat event: activate immediately
        globalThis.activateEvent(zoneId, evt);
        removeSpawn(zoneId, spawnObj.id);
        updateZoneTimers(zoneId);
      }
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
      const caught = globalThis.tryCapture(zoneId, spawnObj.species_en, isCritical ? 1 : 0);
      if (caught) {
        if (isCritical) globalThis.notify(`★ Capture critique ! +1 potentiel`, 'gold');
        if (caught.shiny) spawnEl.classList.add('shiny-flash');
        globalThis.SFX.play('capture', caught.potential, caught.shiny);
        showCaptureBurst(viewport, targetX, targetY, caught.potential, caught.shiny);
        removeSpawn(zoneId, spawnObj.id);
        globalThis.updateTopBar();
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

// ── Player team builder ───────────────────────────────────────

function buildPlayerTeamForZone(zoneId) {
  const state = globalThis.state;
  const zoneAgents = state.agents.filter(a => a.assignedZone === zoneId);
  let allAllyIds = [];
  // Always include boss team (boss is omnipresent)
  if (state.gang.bossTeam.length > 0) {
    allAllyIds.push(...state.gang.bossTeam);
  }
  for (const agent of zoneAgents) allAllyIds.push(...agent.team);
  if (allAllyIds.length === 0) {
    allAllyIds = state.pokemons
      .sort((a, b) => globalThis.getPokemonPower(b) - globalThis.getPokemonPower(a))
      .slice(0, 3)
      .map(p => p.id);
  }
  return allAllyIds.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
}

// ════════════════════════════════════════════════════════════════
// Combat Popup
// ════════════════════════════════════════════════════════════════

function openCombatPopup(zoneId, spawnObj) {
  const state = globalThis.state;
  if (currentCombat) return;
  const available = buildPlayerTeamForZone(zoneId);
  if (available.length === 0) {
    globalThis.notify('Aucun Pokémon disponible !');
    return;
  }

  const win = document.getElementById(`zw-${zoneId}`);
  const viewport = win?.querySelector('.zone-viewport');
  if (!viewport) return; // zone window not open

  const isRaid = spawnObj.isRaid;
  const trainerName = state.lang === 'fr'
    ? (spawnObj.trainer?.fr ?? spawnObj.trainerKey ?? '???')
    : (spawnObj.trainer?.en ?? spawnObj.trainerKey ?? '???');
  const dialogue = globalThis.getTrainerDialogue();

  // ── Build gang trainers ──────────────────────────────────────
  const mkPkSlot = pk => ({ pk, maxHp: calcCombatHp(pk.stats, pk.level), hp: calcCombatHp(pk.stats, pk.level) });
  const gangTrainers = [];

  const bossPokemons = state.gang.bossTeam.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
  if (bossPokemons.length) {
    const domEl = win.querySelector('.zone-boss'); // boss is now in footer bar
    gangTrainers.push({ id: 'boss', name: state.gang.bossName || 'Boss',
      pkList: bossPokemons.map(mkPkSlot), activeIdx: 0, domEl });
  }
  for (const agent of state.agents.filter(a => a.assignedZone === zoneId)) {
    const agentPks = agent.team.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
    if (agentPks.length) {
      const domEl = win.querySelector(`[data-agent-id="${agent.id}"]`); // agents in footer bar
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

  currentCombat = { zoneId, spawnObj, viewport, spawnEl, playerTeam: available, gangTrainers, enemyTrainers, enemyPool };
  globalThis.currentCombat = currentCombat;

  // ── HP overlays + Pokémon sprites on existing zone sprites ─────
  for (const t of gangTrainers) {
    if (!t.domEl) continue;
    const slot = t.pkList[0];
    if (!slot) continue;
    const ov = document.createElement('div');
    ov.className = 'combat-hp-overlay combat-hp-gang';
    ov.innerHTML = `<div class="chp-name" id="chpname-gang-${t.id}">${globalThis.speciesName(slot.pk.species_en)} Lv.${slot.pk.level}</div>
      <div class="chp-bar"><div class="chp-fill" id="chp-gang-${t.id}" style="width:100%"></div></div>
      <div class="chp-txt" id="chptxt-gang-${t.id}">${slot.maxHp}/${slot.maxHp}</div>`;
    t.domEl.appendChild(ov);
    const pkEl = document.createElement('div');
    pkEl.className = 'combat-sent-pk';
    pkEl.id = `cspk-${t.id}`;
    pkEl.innerHTML = `<img src="${globalThis.pokeSpriteBack(slot.pk.species_en, slot.pk.shiny)}" style="width:40px;height:40px;${slot.pk.shiny ? 'filter:drop-shadow(0 0 4px var(--gold))' : ''}">`;
    t.domEl.appendChild(pkEl);
    t.pkEl = pkEl;
  }
  // Enemy spawn element
  if (spawnEl) {
    const firstEnemy = enemyPool[0];
    spawnEl.style.animation = 'none';
    const ov = document.createElement('div');
    ov.className = 'combat-hp-overlay combat-hp-enemy';
    ov.innerHTML = `<div class="chp-name" id="chpname-enemy-${zoneId}">${globalThis.speciesName(firstEnemy.pk.species_en)} Lv.${firstEnemy.pk.level}</div>
      <div class="chp-bar"><div class="chp-fill chp-fill-red" id="chp-enemy-${zoneId}" style="width:100%"></div></div>
      <div class="chp-txt" id="chptxt-enemy-${zoneId}">${firstEnemy.maxHp}/${firstEnemy.maxHp}</div>`;
    spawnEl.appendChild(ov);
  }

  // ── HUD minimal en bas du viewport ─
  const hud = document.createElement('div');
  hud.className = 'zone-combat-hud zone-combat-hud-minimal';
  hud.id = `zchud-${zoneId}`;
  hud.innerHTML = `
    <span class="zchud-vs">⚔ ${trainerName} <span style="color:var(--text-dim);font-size:7px">${enemyPool.length} Pok.</span></span>
    <button class="zchud-flee" id="zchud-flee-${zoneId}">Fuir</button>`;
  viewport.appendChild(hud);

  // ── Auto-start + flee ─────────────────────────────────────────
  const autoCombatTimer = setTimeout(executeCombat, 600);
  document.getElementById(`zchud-flee-${zoneId}`)?.addEventListener('click', () => {
    clearTimeout(autoCombatTimer);
    closeCombatPopup();
  });
}

function executeCombat() {
  const state = globalThis.state;
  if (!currentCombat) return;
  const { zoneId, spawnObj, viewport, spawnEl, playerTeam, gangTrainers, enemyPool } = currentCombat;
  const logEl = document.getElementById(`zchud-log-${zoneId}`);
  const spawnWithZone = { ...spawnObj, zoneId };
  const teamIds = playerTeam.map(p => p.id);

  let enemyActiveIdx = 0;
  let turn = 0;
  const combatLogLines = [];

  const MAX_LOG_LINES = 5;
  function logMsg(html, color = 'var(--text-dim)') {
    combatLogLines.push(html);
    if (!logEl) return;
    const d = document.createElement('div');
    d.className = 'zchud-line';
    d.style.color = color;
    d.innerHTML = html;
    logEl.appendChild(d);
    while (logEl.children.length > MAX_LOG_LINES) logEl.firstChild.remove();
  }

  function showFloatDmg(targetEl, dmg, isEnemy) {
    if (!targetEl || !viewport) return;
    const floater = document.createElement('div');
    floater.className = 'combat-dmg-float' + (isEnemy ? '' : ' combat-dmg-gang');
    floater.textContent = `−${dmg}`;
    const tRect = targetEl.getBoundingClientRect();
    const vRect = viewport.getBoundingClientRect();
    floater.style.left = `${tRect.left - vRect.left + tRect.width / 2}px`;
    floater.style.top  = `${tRect.top  - vRect.top  + tRect.height / 3}px`;
    viewport.appendChild(floater);
    setTimeout(() => floater.remove(), 1100);
  }

  function shakeEl(el) {
    if (!el) return;
    el.classList.remove('combat-shake');
    void el.offsetWidth;
    el.classList.add('combat-shake');
    setTimeout(() => el.classList.remove('combat-shake'), 350);
  }

  function updateGangBars() {
    for (const t of gangTrainers) {
      const slot = t.pkList[t.activeIdx] ?? t.pkList[t.pkList.length - 1];
      if (!slot) continue;
      const fill = document.getElementById(`chp-gang-${t.id}`);
      const txt  = document.getElementById(`chptxt-gang-${t.id}`);
      const name = document.getElementById(`chpname-gang-${t.id}`);
      const pct  = Math.max(0, slot.hp / slot.maxHp * 100);
      if (fill) { fill.style.width = `${pct}%`; fill.style.background = pct > 50 ? 'var(--green,#4caf50)' : pct > 25 ? '#ff9800' : 'var(--red)'; }
      if (txt)  txt.textContent = `${Math.max(0, slot.hp)}/${slot.maxHp}`;
      if (name && t.pkList[t.activeIdx]) name.textContent = `${globalThis.speciesName(t.pkList[t.activeIdx].pk.species_en)} Lv.${t.pkList[t.activeIdx].pk.level}`;
      if (t.domEl) t.domEl.style.opacity = slot.hp <= 0 ? '0.35' : '1';
      if (t.pkEl) {
        const activeSlot = t.pkList[t.activeIdx];
        if (activeSlot) {
          const img = t.pkEl.querySelector('img');
          if (img) { img.src = globalThis.pokeSpriteBack(activeSlot.pk.species_en, activeSlot.pk.shiny); img.style.opacity = '1'; }
        } else {
          const img = t.pkEl.querySelector('img'); if (img) img.style.opacity = '0.2';
        }
      }
    }
  }

  function updateEnemyDisplay() {
    const cur = enemyPool[enemyActiveIdx];
    if (!cur) return;
    const fill = document.getElementById(`chp-enemy-${zoneId}`);
    const txt  = document.getElementById(`chptxt-enemy-${zoneId}`);
    const name = document.getElementById(`chpname-enemy-${zoneId}`);
    const pct  = Math.max(0, cur.hp / cur.maxHp * 100);
    if (fill) fill.style.width = `${pct}%`;
    if (txt)  txt.textContent = `${Math.max(0, cur.hp)}/${cur.maxHp}`;
    if (name) name.textContent = `${globalThis.speciesName(cur.pk.species_en)} Lv.${cur.pk.level}`;
    if (spawnEl) {
      const img = spawnEl.querySelector('img');
      if (img && cur.pk.species_en) img.src = globalThis.pokeSprite(cur.pk.species_en);
    }
  }

  function isEnemyDefeated() { return enemyPool.every(e => e.hp <= 0); }
  function isGangDefeated()  { return gangTrainers.every(t => t.activeIdx >= t.pkList.length); }
  function getActiveGang(t)  { return t.pkList[t.activeIdx] ?? null; }

  function finishCombat(win) {
    const reward  = win ? Math.min(globalThis.MAX_COMBAT_REWARD, globalThis.randInt(spawnWithZone.trainer.reward[0], spawnWithZone.trainer.reward[1])) : 0;
    const repGain = globalThis.getCombatRepGain(spawnWithZone.trainerKey || spawnWithZone.trainer?.sprite, win);
    globalThis.applyCombatResult({ win, reward, repGain }, teamIds, spawnWithZone);
    if (win) { const z = state.zones[zoneId]; if (z) z.combatsWon = (z.combatsWon || 0) + 1; }

    const zoneDef = ZONE_BY_ID[zoneId];
    const zName   = zoneDef ? (state.lang === 'fr' ? zoneDef.fr : zoneDef.en) : zoneId;
    globalThis.pushFeedEvent({
      category: 'combat',
      title: win
        ? `Victoire — ${spawnWithZone.trainer?.fr || spawnWithZone.trainerKey} +${reward}₽ +${repGain}rep`
        : `Défaite — ${spawnWithZone.trainer?.fr || spawnWithZone.trainerKey}`,
      detail: `Zone: ${zName} · ${turn} tour${turn > 1 ? 's' : ''} · ${enemyPool.length} Pok. adverses`,
      win,
      combatLog: combatLogLines.slice(),
    });

    logMsg(win
      ? `<b>VICTOIRE ! +${reward}₽ · +${repGain} rép</b>`
      : `<b>DÉFAITE…</b>`, win ? 'var(--gold)' : 'var(--red)');

    const hudEl = document.getElementById(`zchud-${zoneId}`);
    if (hudEl) {
      const fleeBtn = hudEl.querySelector('.zchud-flee');
      if (fleeBtn) { fleeBtn.textContent = 'Fermer'; fleeBtn.onclick = doClose; }
    }
    const autoCloseTimer = setTimeout(doClose, 2000);

    function doClose() {
      clearTimeout(autoCloseTimer);
      closeCombatPopup();
      removeSpawn(zoneId, spawnObj.id);
      globalThis.updateTopBar();
      if (globalThis.activeTab === 'tabGang') globalThis.renderGangTab();
    }
  }

  function doTurn() {
    turn++;
    const curEnemy = enemyPool[enemyActiveIdx];
    if (!curEnemy || curEnemy.hp <= 0) { finishCombat(isEnemyDefeated()); return; }

    const eSp    = SPECIES_BY_EN[curEnemy.pk.species_en];
    const eTypes = eSp?.types || ['Normal'];
    const eDef   = curEnemy.stats?.def ?? curEnemy.pk.stats?.def ?? 50;

    // Phase 1 — Gang attacks enemy
    for (const t of gangTrainers) {
      const slot = getActiveGang(t);
      if (!slot || slot.hp <= 0) continue;
      const sp      = SPECIES_BY_EN[slot.pk.species_en];
      const atkType = sp?.types?.[0] || 'Normal';
      const typeMod = getTypeEffectiveness(atkType, eTypes);
      const dmg     = calcCombatDamage(slot.pk.stats.atk, eDef, slot.pk.level, typeMod);
      curEnemy.hp  -= dmg;
      const move    = slot.pk.moves?.[Math.floor(Math.random() * (slot.pk.moves?.length || 1))] || 'Attaque';
      const effTag  = typeMod >= 2 ? ' <b style="color:var(--gold)">Super eff!</b>' : typeMod <= 0.5 && typeMod > 0 ? ' <i style="color:var(--text-dim)">Peu eff…</i>' : typeMod === 0 ? ' <i>Aucun effet</i>' : '';
      logMsg(`<b style="color:var(--gold)">${globalThis.speciesName(slot.pk.species_en)}</b> → <i>${move}</i> <b style="color:var(--red)">−${dmg}</b>${effTag}`);
      showFloatDmg(spawnEl, dmg, true);
      shakeEl(spawnEl);
      if (curEnemy.hp <= 0) { curEnemy.hp = 0; break; }
    }
    updateEnemyDisplay();

    if (isEnemyDefeated()) { finishCombat(true); return; }

    if (curEnemy.hp <= 0) {
      logMsg(`<b style="color:var(--gold)">${globalThis.speciesName(curEnemy.pk.species_en)} K.O. !</b>`);
      enemyActiveIdx++;
      while (enemyActiveIdx < enemyPool.length && enemyPool[enemyActiveIdx].hp <= 0) enemyActiveIdx++;
      if (enemyActiveIdx < enemyPool.length) {
        logMsg(`→ <b>${globalThis.speciesName(enemyPool[enemyActiveIdx].pk.species_en)}</b> entre !`);
        updateEnemyDisplay();
      }
    }

    // Phase 2 — Enemy attacks gang
    setTimeout(() => {
      const attacker = enemyPool[enemyActiveIdx];
      if (!attacker || attacker.hp <= 0) { setTimeout(doTurn, 400); return; }

      let targetT = null, targetS = null;
      for (const t of gangTrainers) {
        const s = getActiveGang(t);
        if (s && s.hp > 0) { targetT = t; targetS = s; break; }
      }
      if (targetS) {
        const eSp2    = SPECIES_BY_EN[attacker.pk.species_en];
        const atkType2 = eSp2?.types?.[0] || 'Normal';
        const dTypes  = SPECIES_BY_EN[targetS.pk.species_en]?.types || ['Normal'];
        const typeMod2 = getTypeEffectiveness(atkType2, dTypes);
        const eAtk    = attacker.stats?.atk ?? attacker.pk.stats?.atk ?? 50;
        const dmg2    = calcCombatDamage(eAtk, targetS.pk.stats.def, attacker.pk.level, typeMod2);
        targetS.hp   -= dmg2;
        const effTag2 = typeMod2 >= 2 ? ' <b style="color:var(--gold)">Super eff!</b>' : typeMod2 <= 0.5 && typeMod2 > 0 ? ' <i style="color:var(--text-dim)">Peu eff…</i>' : '';
        logMsg(`<b style="color:var(--red)">${globalThis.speciesName(attacker.pk.species_en)}</b> → <b>${globalThis.speciesName(targetS.pk.species_en)}</b> <b style="color:var(--red)">−${dmg2}</b>${effTag2}`);
        showFloatDmg(targetT.domEl, dmg2, false);
        shakeEl(targetT.domEl);

        if (targetS.hp <= 0) {
          targetS.hp = 0;
          logMsg(`<b>${globalThis.speciesName(targetS.pk.species_en)}</b> K.O. !`, 'var(--red)');
          targetT.activeIdx++;
          while (targetT.activeIdx < targetT.pkList.length && targetT.pkList[targetT.activeIdx].hp <= 0) targetT.activeIdx++;
          if (targetT.activeIdx < targetT.pkList.length)
            logMsg(`${targetT.name} → <b>${globalThis.speciesName(targetT.pkList[targetT.activeIdx].pk.species_en)}</b> !`);
        }
      }

      updateGangBars();
      if (isGangDefeated()) { finishCombat(false); return; }
      setTimeout(doTurn, 500);
    }, 500);
  }

  setTimeout(doTurn, 400);
}

function closeCombatPopup() {
  if (currentCombat) {
    const { zoneId, viewport, spawnEl } = currentCombat;
    const win = document.getElementById(`zw-${zoneId}`);
    document.getElementById(`zchud-${zoneId}`)?.remove();
    viewport?.querySelectorAll('.combat-hp-overlay').forEach(el => el.remove());
    win?.querySelectorAll('.combat-hp-overlay').forEach(el => el.remove());
    win?.querySelectorAll('.combat-sent-pk').forEach(el => el.remove());
    if (spawnEl) spawnEl.style.animation = '';
    for (const t of currentCombat.gangTrainers) {
      if (t.domEl) t.domEl.style.opacity = '';
    }
    _refreshRaidBtn(zoneId);
  }
  currentCombat = null;
  globalThis.currentCombat = null;
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
  _zwin_buildPlayerTeamForZone:   buildPlayerTeamForZone,
  _zwin_openCombatPopup:          openCombatPopup,
  _zwin_executeCombat:            executeCombat,
  _zwin_closeCombatPopup:         closeCombatPopup,
  _zwin_refreshRaidBtn:           _refreshRaidBtn,
  _zwin_addVSBadge:               _addVSBadge,
  // Expose constants
  TYPE_CHART,
  SPECIAL_WING_EVENTS,
  zoneNextSpawn,
  zoneSpawnHistory,
});

export {};
