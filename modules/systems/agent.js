// ════════════════════════════════════════════════════════════════
//  AGENT MODULE
//  Extracted from app.js
// ════════════════════════════════════════════════════════════════

import { resolveTrainerCombat } from './zoneCombat.js';

// ── Système d'atouts (perks) ──────────────────────────────────────
// Toutes les PERK_EVERY niveaux, l'agent peut choisir un atout parmi 3.
const PERK_EVERY = 10;

// Retourne la somme des bonus d'un type donné pour un agent.
// effectType = 'capture_type' | 'shiny' | 'combat' | 'chest_loot' | 'money'
//              'capture_potential' | 'ball_recovery' | 'encounter_rare' | 'trainer_debuff'
// subtype (optionnel) = type Pokémon 'fire','water', etc.
function getAgentPerkBonus(agent, effectType, subtype) {
  if (!agent?.perks?.length) return 0;
  const AGENT_PERKS = globalThis.AGENT_PERKS || [];
  return agent.perks.reduce((total, perkId) => {
    const perk = AGENT_PERKS.find(p => p.id === perkId);
    if (!perk) return total;
    const parts = perk.effect.split(':');
    if (parts[0] !== effectType) return total;
    if (subtype && parts.length === 3 && parts[1] !== subtype) return total;
    return total + parseFloat(parts[parts.length - 1]);
  }, 0);
}

// Pioche 3 perks aléatoires que l'agent ne possède pas encore.
function _rollThreePerks(agent) {
  const AGENT_PERKS = globalThis.AGENT_PERKS || [];
  const owned  = new Set(agent.perks || []);
  const pool   = AGENT_PERKS.filter(p => !owned.has(p.id));
  if (pool.length === 0) return AGENT_PERKS.slice(0, 3); // fallback
  const picks  = [];
  const copy   = [...pool];
  while (picks.length < 3 && copy.length > 0) {
    const i = Math.floor(Math.random() * copy.length);
    picks.push(copy.splice(i, 1)[0]);
  }
  return picks;
}

// Vérifie si l'agent vient de franchir un palier de perk.
function _checkPerkThreshold(agent) {
  if (!agent.perks) agent.perks = [];
  const perksDue = Math.floor(agent.level / PERK_EVERY);
  const perksOwned = agent.perks.length + (agent.pendingPerkChoice ? 1 : 0);
  if (perksDue > perksOwned) {
    agent.pendingPerkChoice = true;
    globalThis.notify(`🎖 ${agent.name} a gagné un nouvel atout ! (Lv.${agent.level})`, 'gold');
    // Déclenche la modale si possible (tab agents actif)
    setTimeout(() => {
      if (globalThis.activeTab === 'tabAgents') {
        openPerkChoiceModal(agent.id);
      }
    }, 600);
  }
}

// Courbe en paliers : ×10 tous les 5 agents.
//   Agents  1- 5 :       5 000₽
//   Agents  6-10 :      50 000₽
//   Agents 11-15 :     500 000₽
//   Agents 16-20 :   5 000 000₽
//   Agents 21-25 :  50 000 000₽
// → frein naturel en mid/late-game, early accessible pour expérimenter.
function getAgentRecruitCost() {
  const state = globalThis.state;
  const n     = state.agents.length;
  const tier  = Math.floor(n / 5);          // palier (0, 1, 2, …)
  return 5_000 * Math.pow(10, tier);
}

function rollNewAgent() {
  const AGENT_NAMES_M = globalThis.AGENT_NAMES_M;
  const AGENT_NAMES_F = globalThis.AGENT_NAMES_F;
  const AGENT_SPRITES = globalThis.AGENT_SPRITES;
  const AGENT_PERSONALITIES = globalThis.AGENT_PERSONALITIES;
  const isFemale = Math.random() < 0.5;
  const name = globalThis.pick(isFemale ? AGENT_NAMES_F : AGENT_NAMES_M);
  const sprite = globalThis.pick(AGENT_SPRITES);
  const personality = [];
  const pool = [...AGENT_PERSONALITIES];
  for (let i = 0; i < 2; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    personality.push(pool.splice(idx, 1)[0]);
  }
  return {
    id: `ag-${globalThis.uid()}`,
    name,
    sprite: globalThis.trainerSprite(sprite),
    spriteKey: sprite,
    title: 'grunt',
    level: 1,
    xp: 0,
    combatsWon: 0,
    natureDefined: true,
    preferredBall: 'pokeball',
    behavior: 'all', // 'all' | 'capture' | 'combat'
    personality,
    team: [],
    assignedZone: null,
    notifyCaptures: true,
    perks: [],
    pendingPerkChoice: false,
    legacyLocked: false,
  };
}

function recruitAgent(agentData) {
  const state = globalThis.state;
  state.agents.push(agentData);
  globalThis.addLog(globalThis.t('recruit_agent') + ': ' + agentData.name);
  // Behavioural log — premier agent recruté
  if (!state.behaviourLogs) state.behaviourLogs = {};
  if (!state.behaviourLogs.firstAgentAt) state.behaviourLogs.firstAgentAt = Date.now();
  globalThis.saveState();
}

function openAgentRecruitModal(onAfterRecruit) {
  const state = globalThis.state;
  const SFX = globalThis.SFX;
  const cost = getAgentRecruitCost();
  if (state.gang.money < cost) {
    globalThis.notify(state.lang === 'fr' ? 'Pas assez d\'argent !' : 'Not enough money!');
    SFX.play('error')
    return;
  }

  const candidates = [rollNewAgent(), rollNewAgent(), rollNewAgent()];

  const cardsHtml = candidates.map((ag, i) => `
    <div class="recruit-card" data-idx="${i}" style="
      flex:1;min-width:140px;max-width:190px;
      background:var(--bg-card);border:1px solid var(--border);
      border-radius:var(--radius);padding:12px 10px;
      display:flex;flex-direction:column;align-items:center;gap:8px;
      cursor:pointer;transition:border-color .15s,box-shadow .15s">
      <img src="${ag.sprite}" style="width:48px;height:48px;image-rendering:pixelated">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--text);text-align:center">${ag.name}</div>
      <div style="font-size:8px;color:var(--text-dim);text-align:center">${ag.personality.map(p => p.fr || p).join(' · ')}</div>
      <div style="font-size:8px;color:var(--text-dim);opacity:.7;font-family:var(--font-pixel);text-align:center">Lv.1 · Grunt</div>
      <button class="recruit-pick-btn" data-idx="${i}" style="
        margin-top:4px;font-family:var(--font-pixel);font-size:8px;
        padding:5px 14px;background:var(--bg);border:1px solid var(--gold-dim);
        border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;width:100%">
        Recruter
      </button>
    </div>`).join('');

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:9999';
  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:640px;width:96%;display:flex;flex-direction:column;gap:14px">
      <div style="font-family:var(--font-pixel);font-size:11px;color:var(--gold);text-align:center">
        ★ RECRUTEMENT — Choisissez un candidat
      </div>
      <div style="font-size:8px;color:var(--text-dim);text-align:center;font-family:var(--font-pixel)">
        Coût : ${cost.toLocaleString()}₽ — Trois candidats disponibles
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">${cardsHtml}</div>
      <div style="text-align:center">
        <button id="recruitCancelBtn" style="font-family:var(--font-pixel);font-size:8px;padding:6px 16px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  // Hover highlight
  modal.querySelectorAll('.recruit-card').forEach(card => {
    card.addEventListener('mouseenter', () => { card.style.borderColor = 'var(--gold-dim)'; card.style.boxShadow = '0 0 10px rgba(255,204,90,.2)'; });
    card.addEventListener('mouseleave', () => { card.style.borderColor = 'var(--border)'; card.style.boxShadow = ''; });
  });

  // Pick
  modal.querySelectorAll('.recruit-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      state.gang.money -= cost;
      recruitAgent(candidates[idx]);
      globalThis.notify(`${state.lang === 'fr' ? 'Recruté' : 'Recruited'}: ${candidates[idx].name}!`, 'gold');
      globalThis.updateTopBar();
      modal.remove();
      onAfterRecruit?.();
    });
  });

  document.getElementById('recruitCancelBtn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function assignAgentToZone(agentId, zoneId) {
  const state = globalThis.state;
  const agent = state.agents.find(a => a.id === agentId);
  if (!agent) return;
  // Remove from old zone
  if (agent.assignedZone) {
    const oldZ = state.zones[agent.assignedZone];
    if (oldZ) {
      oldZ.assignedAgents = oldZ.assignedAgents.filter(id => id !== agentId);
    }
  }
  agent.assignedZone = zoneId;
  if (zoneId) {
    const z = globalThis.initZone(zoneId);
    const maxSlots = z.slots || 1;
    if (!z.assignedAgents.includes(agentId)) {
      if (z.assignedAgents.length < maxSlots) {
        z.assignedAgents.push(agentId);
      } else {
        // Zone pleine — désassigner l'agent sans l'ajouter
        agent.assignedZone = null;
        globalThis.notify(`Zone pleine (${maxSlots} slot${maxSlots > 1 ? 's' : ''}). Améliore la zone pour +1 agent.`, 'error');
        globalThis.saveState();
        return;
      }
    }
  }
  globalThis.saveState();
  // Démarre ou arrête le timer selon le nouvel état (zone active = ouverte OU avec agent)
  globalThis.syncActiveZones?.();
}

// ── Auto-sell on agent capture ────────────────────────────────────
// Returns true and sells if the auto-sell purchase is active and the
// Pokémon matches the configured filter.
function _autoSellCaptured(pokemon) {
  const state = globalThis.state;
  if (!state.purchases?.autoSellAgent) return false;
  if (state.purchases?.autoSellAgentEnabled === false) return false;
  if (pokemon.favorite) return false;
  const protected_ = state.settings?.protectedSpecies || [];
  if (protected_.includes(pokemon.species_en)) return false;
  // Shinies always protected unless explicitly unprotected per-species in Pokédex
  if (pokemon.shiny && !state.pokedex?.[pokemon.species_en]?.shinyUnprotected) return false;
  const cfg = state.settings?.autoSellAgent;
  if (!cfg) return false;
  if (cfg.mode === 'by_potential') {
    const targets = cfg.potentials || [];
    if (!targets.includes(pokemon.potential)) return false;
  }
  // Sell: directly mutate state (mirrors sellPokemon but silent, no confirm)
  const idx = state.pokemons.findIndex(p => p.id === pokemon.id);
  if (idx === -1) return false;
  const price = globalThis.calculatePrice(pokemon);
  state.pokemons.splice(idx, 1);
  state.gang.money += price;
  state.stats.totalSold++;
  state.stats.totalMoneyEarned += price;
  if (!state.stats.mostExpensiveSold || price > (state.stats.mostExpensiveSold.price || 0)) {
    state.stats.mostExpensiveSold = { name: globalThis.speciesName(pokemon.species_en), price };
  }
  globalThis.addLog(`[Auto-vente] ${globalThis.speciesName(pokemon.species_en)} → ${price}₽`);
  return true;
}

// XP variable selon la rareté du Pokémon capturé
const RARITY_XP = { common: 3, uncommon: 5, rare: 8, epic: 12, legendary: 20 };
function captureXP(species_en, potential, shiny) {
  const sp = globalThis.SPECIES_BY_EN?.[species_en];
  const base = RARITY_XP[sp?.rarity] ?? 3;
  return base + Math.max(0, (potential || 1) - 1) * 2 + (shiny ? 10 : 0);
}

function grantAgentXP(agent, amount) {
  if (agent.legacyLocked) return; // locked agents don't earn XP
  // Perk: xp_bonus — multiplicateur d'XP
  const xpMult = 1 + getAgentPerkBonus(agent, 'xp_bonus');
  agent.xp += Math.round(amount * xpMult);
  const prevLevel = agent.level;
  const needed = () => agent.level * 30;
  while (agent.xp >= needed() && agent.level < 100) {
    agent.xp -= needed();
    agent.level++;
  }
  if (agent.level > prevLevel) {
    globalThis.notify(`📈 ${agent.name} Lv.${agent.level} !`, 'gold');
    _checkPerkThreshold(agent);
    checkPromotion(agent);
  }
}


// Retourne le label d'affichage du grade d'un agent (avec nom de gang pour élite/général)
function getAgentRankLabel(agent) {
  const AGENT_RANK_LABELS = globalThis.AGENT_RANK_LABELS;
  const state = globalThis.state;
  const def = AGENT_RANK_LABELS?.[agent.title];
  if (!def) return agent.title;
  const base = state.lang === 'fr' ? def.fr : def.en;
  if (agent.title === 'elite' || agent.title === 'general') {
    return `${base} ${state.gang?.name || ''}`.trim();
  }
  return base;
}

// Vérifie et applique la promotion de grade pour un agent.
// Chaîne : grunt → sergent (25) → lieutenant (50) → commandant (75) → élite/général (100)
// Les 4 premiers à atteindre le niveau 100 sont "Élite [gang]", les suivants "Général [gang]".
function checkPromotion(agent) {
  const RANK_CHAIN = globalThis.RANK_CHAIN; // ['grunt','sergent','lieutenant','commandant']
  const TITLE_REQUIREMENTS = globalThis.TITLE_REQUIREMENTS;
  const AGENT_RANK_LABELS = globalThis.AGENT_RANK_LABELS;
  const state = globalThis.state;

  // Escalier de promotions fixes
  const steps = [
    { from: 'grunt',      to: 'sergent',    level: TITLE_REQUIREMENTS.sergent.level },
    { from: 'sergent',    to: 'lieutenant', level: TITLE_REQUIREMENTS.lieutenant.level },
    { from: 'lieutenant', to: 'commandant', level: TITLE_REQUIREMENTS.commandant.level },
  ];

  let promoted = false;

  for (const step of steps) {
    if (agent.title === step.from && agent.level >= step.level) {
      agent.title = step.to;
      const label = AGENT_RANK_LABELS?.[step.to]?.fr || step.to;
      globalThis.notify(`🏅 ${agent.name} promu ${label} !`, 'gold');
      globalThis.addLog(`${agent.name} — promotion : ${label}`);
      promoted = true;
    }
  }

  // Palier niveau 100 : élite (4 premiers) ou général (les suivants)
  if (agent.title === 'commandant' && agent.level >= 100) {
    if (!state.stats) state.stats = {};
    const eliteCount = state.stats.agentsEliteCount || 0;
    const gangName = state.gang?.name || '';
    if (eliteCount < 4) {
      agent.title = 'elite';
      state.stats.agentsEliteCount = eliteCount + 1;
      globalThis.notify(`★★ ${agent.name} est désormais Élite ${gangName} ! ★★`, 'gold');
      globalThis.addLog(`${agent.name} — grade ÉLITE ${gangName} obtenu !`);
    } else {
      agent.title = 'general';
      globalThis.notify(`★ ${agent.name} est désormais Général ${gangName} !`, 'gold');
      globalThis.addLog(`${agent.name} — grade GÉNÉRAL ${gangName} obtenu !`);
    }
    promoted = true;
  }

  // Refresh immédiat de l'onglet actif si une promotion a eu lieu
  if (promoted) {
    if (globalThis.activeTab === 'tabAgents') globalThis.renderAgentsTab?.();
    if (globalThis.activeTab === 'tabGang')   globalThis.renderGangTab?.();
  }
}

// Type-coverage multiplier: bonus/malus (0.7–1.4) based on how well the player's
// pokemon moves match up against the enemy team's types. Uses MOVES_DATA (classic-script
// global) and getTypeEffectiveness exported from zoneWindows.js.
function _typeCoverageMult(playerPks, enemyPks) {
  const getEff = globalThis.getTypeEffectiveness;
  if (!getEff || typeof MOVES_DATA === 'undefined') return 1;
  const enemyTypes = enemyPks.flatMap(ep => SPECIES_BY_EN[ep.species_en]?.types || ['Normal']);
  if (enemyTypes.length === 0) return 1;
  let total = 0, count = 0;
  for (const pk of playerPks) {
    const sp = SPECIES_BY_EN[pk.species_en];
    const dmgMoves = (pk.moves || []).filter(m => (MOVES_DATA[m]?.basePower || 0) > 0);
    if (dmgMoves.length === 0) { total += 1; count++; continue; }
    let best = 0;
    for (const m of dmgMoves) {
      const mType = MOVES_DATA[m].type;
      const stab = (sp?.types || []).includes(mType) ? 1.5 : 1;
      const avgEff = enemyTypes.reduce((s, et) => s + getEff(mType, [et]), 0) / enemyTypes.length;
      const mult = avgEff * stab;
      if (mult > best) best = mult;
    }
    total += best;
    count++;
  }
  const raw = count > 0 ? total / count : 1;
  return Math.min(1.4, Math.max(0.7, raw));
}

function getAgentCombatPower(agent) {
  const state = globalThis.state;
  const TITLE_BONUSES = globalThis.TITLE_BONUSES;
  const bonus = 1 + (TITLE_BONUSES[agent.title] || 0);
  let teamPower = 0;
  for (const pkId of agent.team) {
    const p = state.pokemons.find(pk => pk.id === pkId);
    if (p) teamPower += globalThis.getPokemonPower(p);
  }
  // Level-based power: 15 pts/level replaces the old stats.combat * 10
  return Math.round((agent.level * 15 + teamPower) * bonus);
}

function _zoneCombatAgents(zoneId, { isRaid = false, preferredAgent = null } = {}) {
  const state = globalThis.state;
  const preferredId = preferredAgent?.id ?? null;
  return [...(state.agents || [])]
    .filter(agent => agent.assignedZone === zoneId)
    .filter(agent => isRaid ? agent.autoRaid !== false : agent.autoCombat !== false)
    .sort((a, b) => {
      if (a.id === preferredId) return -1;
      if (b.id === preferredId) return 1;
      return getAgentCombatPower(b) - getAgentCombatPower(a);
    })
    .slice(0, 3);
}

function _combatTeamIdsForAgents(agentIds = []) {
  const state = globalThis.state;
  const ids = [];
  for (const id of state.gang?.bossTeam || []) {
    if (id) ids.push(id);
  }
  for (const agentId of agentIds) {
    const agent = state.agents.find(a => a.id === agentId);
    for (const id of agent?.team || []) {
      if (id) ids.push(id);
    }
  }
  return [...new Set(ids)].filter(id => state.pokemons.some(pokemon => pokemon.id === id));
}

function _trainerCombatLogLines(result, mainAgentName, trainerName, reward, repGain) {
  const lines = [];
  for (const duel of result.duels || []) {
    lines.push(`${duel.attacker.name} vs ${duel.defender.name}: ${duel.attackerWin ? 'win' : 'loss'}`);
  }
  if (result.finalBattle?.skipped) {
    lines.push('Boss battle skipped: attackers defeated');
  } else if (result.finalBattle) {
    lines.push(`Boss battle: ${result.finalBattle.attackerWin ? 'win' : 'loss'} (${result.finalBattle.attackerPower}/${result.finalBattle.defenderPower})`);
  }
  lines.push(result.attackerWin
    ? `${mainAgentName} a battu ${trainerName}. +${reward}₽ +${repGain}rep`
    : `${mainAgentName} a perdu contre ${trainerName}.`);
  return lines;
}

function _applyResolvedAgentCombat(zoneId, spawnObj, combatAgents, result) {
  const state = globalThis.state;
  const agentIds = combatAgents.map(agent => agent.id);
  const teamIds = _combatTeamIdsForAgents(agentIds);
  const trainerData = { ...spawnObj, zoneId };
  const trainer = trainerData.trainer || {};
  const rewardRange = trainer.reward || [10, 50];
  const mainAgentForMoney = combatAgents[0];
  const moneyPerkBonus = getAgentPerkBonus(mainAgentForMoney, 'money');
  const reward = result.attackerWin
    ? Math.min(globalThis.MAX_COMBAT_REWARD, Math.round(globalThis.randInt(rewardRange[0], rewardRange[1]) * (1 + moneyPerkBonus)))
    : 0;
  const repGain = globalThis.getCombatRepGain(trainerData.trainerKey || trainerData.trainer?.sprite, result.attackerWin);
  const mainAgent = combatAgents[0];
  const trainerName = trainer.fr || trainer.en || trainerData.trainerKey || 'dresseur';

  globalThis.applyCombatResult({ win: result.attackerWin, reward, repGain }, teamIds, trainerData);

  if (result.attackerWin) {
    const zoneState = state.zones[zoneId];
    if (zoneState) zoneState.combatsWon = (zoneState.combatsWon || 0) + 1;
    const xpEach = Math.round((10 + (trainer.diff || 1) * 5) * 0.75);
    for (const agent of combatAgents) {
      agent.combatsWon = (agent.combatsWon || 0) + 1;
      grantAgentXP(agent, xpEach);
    }
    if (mainAgent?.notifyCaptures !== false) globalThis.notify(`⚔️ ${mainAgent.name} +${reward}₽ +${repGain}rep`, 'success');
    globalThis.addLog(globalThis.t('agent_win', { agent: mainAgent?.name || 'Agent' }));
  } else {
    if (mainAgent?.notifyCaptures !== false) globalThis.notify(`💀 ${mainAgent?.name || 'Agent'} — défaite`, 'error');
    globalThis.addLog(globalThis.t('agent_lose', { agent: mainAgent?.name || 'Agent' }));
  }

  globalThis.addBattleLogEntry?.({
    ts: Date.now(),
    zoneName: `[BG] ${mainAgent?.name || 'Agent'} — ${ZONE_BY_ID[zoneId]?.fr || zoneId}`,
    win: result.attackerWin,
    reward,
    repGain,
    lines: _trainerCombatLogLines(result, mainAgent?.name || 'Agent', trainerName, reward, repGain),
    trainerKey: trainerData.trainerKey,
    isAgent: true,
  });

  globalThis.saveState?.();
  return { reward, repGain };
}

// ── Résolution background d'un spawn pour une zone fermée ────────
// Appelé par backgroundZoneTimers (app.js) au vrai spawnRate de la zone.
// Génère un spawn et le résout silencieusement via les agents assignés.
function resolveBackgroundSpawnForZone(zoneId) {
  const state = globalThis.state;
  if (!state.settings.autoCombat) return false;

  const ZONE_BY_ID = globalThis.ZONE_BY_ID;
  const zone = ZONE_BY_ID?.[zoneId];
  if (!zone || zone.spawnRate === 0) return false;

  const agents = state.agents.filter(a => a.assignedZone === zoneId);
  if (agents.length === 0) return false;

  const entry = globalThis.spawnInZone(zoneId);
  if (!entry) return false;

  let changed = false;

  // ── Pokémon ──────────────────────────────────────────────────
  if (entry.type === 'pokemon') {
    // Premier agent avec capture autorisée + pokeball disponible
    const capAgents = agents.filter(a => a.autoCapture !== false);
    let capturer = null; let ball = null;
    for (const a of capAgents) {
      const preferred = a.preferredBall || 'pokeball';
      if ((state.inventory[preferred] || 0) > 0)   { capturer = a; ball = preferred; break; }
      if ((state.inventory['pokeball'] || 0) > 0)  { capturer = a; ball = 'pokeball'; break; }
    }
    if (!capturer || !ball) {
      // Notifier une fois par session qu'il n'y a plus de Poké Balls
      const _now = Date.now();
      if (!resolveBackgroundSpawnForZone._noBallWarnAt || _now - resolveBackgroundSpawnForZone._noBallWarnAt > 120_000) {
        resolveBackgroundSpawnForZone._noBallWarnAt = _now;
        const zone = ZONE_BY_ID[zoneId];
        globalThis.notify(`⚠️ Plus de Poké Balls — les agents de ${zone?.fr || zoneId} ne capturent plus !`, 'error');
      }
      return false;
    }

    const pokemon = globalThis.makePokemon(entry.species_en, zoneId, ball);
    if (!pokemon) return false;

    // ── Bonus perk : type affinité → modifie la chance de shiny et potentiel ──
    const sp       = globalThis.SPECIES_BY_EN?.[entry.species_en];
    const pkType   = (sp?.types?.[0] || '').toLowerCase();
    const pkRarity = sp?.rarity || 'common';
    const typeBonus        = getAgentPerkBonus(capturer, 'capture_type', pkType)
                           + getAgentPerkBonus(capturer, 'capture_type', 'all');
    const shinyBonus       = getAgentPerkBonus(capturer, 'shiny')
                           + getAgentPerkBonus(capturer, 'shiny_type', pkType);
    const rarityBonus      = getAgentPerkBonus(capturer, 'capture_rarity', pkRarity);
    const potentialBonus   = getAgentPerkBonus(capturer, 'capture_potential') + rarityBonus;
    const ballRecovProb    = getAgentPerkBonus(capturer, 'ball_recovery');

    // Réappliquer la chance shiny si le perk augmente la probabilité
    if (shinyBonus > 0 && !pokemon.shiny && Math.random() < shinyBonus * 0.002) {
      pokemon.shiny = true;
    }

    // Crit de capture basé sur le niveau + affinité de type (remplace stats.capture)
    const isCrit = Math.random() < capturer.level / 200 + typeBonus * 0.3;
    if (isCrit || potentialBonus > 0) {
      pokemon.potential = Math.min(5, (pokemon.potential || 1) + 1 + Math.floor(potentialBonus));
    }

    // Ball recovery : perk récupère la ball (probabiliste)
    if (Math.random() >= ballRecovProb) {
      state.inventory[ball]--;
    }
    state.pokemons.push(pokemon);
    state.stats.totalCaught++;
    _autoSellCaptured(pokemon);
    if (!state.pokedex[pokemon.species_en]) {
      state.pokedex[pokemon.species_en] = { seen: true, caught: true, shiny: pokemon.shiny, count: 1 };
      state.stats.dexCaught = (state.stats.dexCaught || 0) + 1;
    } else {
      state.pokedex[pokemon.species_en].caught = true;
      state.pokedex[pokemon.species_en].count++;
      if (pokemon.shiny) state.pokedex[pokemon.species_en].shiny = true;
    }
    if (pokemon.shiny) state.stats.shinyCaught++;
    // Fabric BG unlock
    globalThis._unlockFabricBg?.(pokemon.dex, pokemon.shiny);
    grantAgentXP(capturer, captureXP(entry.species_en, pokemon.potential, pokemon.shiny));
    const name   = globalThis.speciesName(pokemon.species_en);
    const stars  = '★'.repeat(pokemon.potential) + '☆'.repeat(5 - pokemon.potential);
    const rarity = globalThis.SPECIES_BY_EN?.[pokemon.species_en]?.rarity;
    const zoneName = ZONE_BY_ID?.[zoneId]?.fr || zoneId;
    const ballName = globalThis.BALLS?.[ball]?.fr || ball;
    // Notifs spéciales uniquement — les captures normales passent par le feed
    if (pokemon.shiny) {
      globalThis.notify(`✨ ${capturer.name} — SHINY ! ${name} ${stars} ✨`, 'gold');
      setTimeout(() => globalThis.showShinyPopup?.(pokemon.species_en), 200);
    } else if (rarity === 'legendary') {
      globalThis.notify(`🏆 ${capturer.name} — LÉGENDAIRE ! ${name} ${stars}`, 'gold');
    } else if (rarity === 'very_rare') {
      globalThis.notify(`⭐ ${capturer.name} — Très rare ! ${name} ${stars}`, 'gold');
    }
    globalThis.addLog(globalThis.t('agent_catch', { agent: capturer.name, pokemon: name }));
    // Feed event — une seule entrée propre par capture
    globalThis.pushFeedEvent?.({
      category: 'capture',
      title: `${name}${pokemon.shiny ? ' ✨' : ''} — ${stars}`,
      detail: `${capturer.name} · ${zoneName} · ${ballName}`,
      win: true,
      species_en: pokemon.species_en,
      level: pokemon.level,
      potential: pokemon.potential,
      shiny: pokemon.shiny,
      byAgent: capturer.name,
      zone: zoneName,
      ball: ballName,
    });
    changed = true;

  // ── Dresseur / Raid ──────────────────────────────────────────
  } else if (entry.type === 'trainer' || entry.type === 'raid') {
    const isRaid = entry.type === 'raid';
    const combatAgents = _zoneCombatAgents(zoneId, { isRaid });
    if (combatAgents.length === 0) return false;

    const result = resolveTrainerCombat({ ...entry, zoneId }, combatAgents.map(agent => agent.id));
    _applyResolvedAgentCombat(zoneId, entry, combatAgents, result);
    changed = true;

  // ── Coffre ───────────────────────────────────────────────────
  } else if (entry.type === 'chest') {
    state.stats.chestsOpened = (state.stats.chestsOpened || 0) + 1;
    const loot = globalThis.rollChestLoot(zoneId, true);
    const mainAgent = agents[0];
    // Perk: passive_income — revenu supplémentaire à chaque coffre
    const passiveIncome = agents.reduce((sum, a) => sum + getAgentPerkBonus(a, 'passive_income'), 0);
    if (passiveIncome > 0) {
      state.gang.money = (state.gang.money || 0) + passiveIncome;
    }
    if (mainAgent?.notifyCaptures !== false) globalThis.notify(`📦 ${mainAgent.name} — ${loot.msg}`, loot.type);
    changed = true;

  // ── Événement spécial — ignoré en background (zones auto) ──────
  // Les events nécessitent une interaction du joueur; ils ne se résolvent que
  // dans les zones ouvertes via tickZoneSpawn → renderSpawnInWindow.
  } else if (entry.type === 'event') {
    // Rien : on laisse le TTL expirer naturellement
  }

  if (changed) {
    globalThis.saveState();
    globalThis.updateTopBar();
    // Refresh fogmap income tile (₽ icon) immediately
    globalThis.refreshZoneIncomeTile?.(zoneId);
    globalThis.updateZoneButtons?.();
    // Refresh stats view if open
    globalThis._refreshZoneStatsView?.();
    if (globalThis.activeTab === 'tabPC') {
      if (globalThis.pcView === 'grid') globalThis.renderPokemonGrid();
      else if (globalThis.pcView === 'pension') {
        const el = document.getElementById('pensionInPC');
        if (el) globalThis.renderPensionView?.(el);
      }
    }
    if (globalThis.activeTab === 'tabGang') globalThis.renderGangTab();
  }

  // ── Raid hostile sur zone occupée ────────────────────────────────────────────
  // Probabilité par tick (≈ 1 % / spawn → rare mais remarqué)
  const OCCUPIED_RAID_CHANCE = 0.01;
  if (Math.random() < OCCUPIED_RAID_CHANCE && agents.length > 0) {
    _resolveOccupiedZoneRaid(zoneId, agents);
  }

  return changed;
}

// ── Raid hostile sur zone occupée ────────────────────────────────────────────
// Un gang adverse attaque silencieusement une zone tenue par vos agents.
// Résultat : victoire (bonus) ou défaite (perte de ₽ modérée) selon les forces.
function _resolveOccupiedZoneRaid(zoneId, agents) {
  const state   = globalThis.state;
  const zone    = globalThis.ZONE_BY_ID?.[zoneId];
  if (!zone) return;

  // Puissance de défense = somme des niveaux × 5 (remplace stats.combat)
  const defensePower = agents.reduce((acc, a) => acc + (a.level || 1) * 5, 0);

  // Puissance d'attaque = difficulté de zone × facteur aléatoire (0.7 – 1.4)
  const zoneDiff     = globalThis.getZoneDifficulty?.(zoneId) ?? 1;
  const attackPower  = Math.round(zoneDiff * 10 * (0.7 + Math.random() * 0.7));

  const zoneName  = zone.fr || zoneId;
  const won       = defensePower >= attackPower;

  if (won) {
    // Victoire : bonus réputation + petit loot
    const repGain = Math.round(zoneDiff * (1 + Math.random()));
    state.gang.reputation = Math.min(100, (state.gang.reputation || 0) + repGain);
    const moneyGain = Math.round(zoneDiff * 200 * (1 + Math.random()));
    state.gang.money = (state.gang.money || 0) + moneyGain;
    globalThis.notify(`🛡 Raid repoussé sur ${zoneName} ! +${repGain} REP +${moneyGain.toLocaleString()}₽`, 'gold');
    globalThis.pushFeedEvent?.({
      category: 'raid',
      title: `Raid repoussé — ${zoneName}`,
      detail: `Défense ${defensePower} vs Attaque ${attackPower} · +${repGain} REP`,
      win: true,
    });
  } else {
    // Défaite : perte d'argent modérée (jamais de perte de pokemon ni d'agent)
    const moneyLoss = Math.round(Math.min(state.gang.money * 0.03, zoneDiff * 500));
    state.gang.money = Math.max(0, (state.gang.money || 0) - moneyLoss);
    globalThis.notify(`⚠️ Raid ennemi sur ${zoneName} ! −${moneyLoss.toLocaleString()}₽`, 'error');
    globalThis.pushFeedEvent?.({
      category: 'raid',
      title: `Raid subi — ${zoneName}`,
      detail: `Défense ${defensePower} vs Attaque ${attackPower} · −${moneyLoss.toLocaleString()}₽`,
      win: false,
    });
  }
  globalThis.saveState();
  globalThis.updateTopBar?.();
}

// ── Passive agent tick (toutes les 10s) ──────────────────────────
// Rôle réduit : gère uniquement les gym raids automatiques.
// La simulation des spawns de zones fermées est maintenant dans
// resolveBackgroundSpawnForZone (appelé par backgroundZoneTimers à taux réel).
function passiveAgentTick() {
  const state = globalThis.state;
  if (!state.settings.autoCombat) return;
  const openZones = globalThis.openZones;
  const ZONE_BY_ID = globalThis.ZONE_BY_ID;
  if (!openZones || !ZONE_BY_ID) return;

  let changed = false;

  // Auto gym raid : zone city avec gymLeader, cooldown passé, 1 victoire manuelle
  const raidCooldownMs = 5 * 60 * 1000;
  const checkedRaidZones = new Set();
  for (const agent of state.agents) {
    if (!agent.assignedZone) continue;
    if (agent.autoRaid === false) continue;       // agent a désactivé les raids
    const zid = agent.assignedZone;
    if (checkedRaidZones.has(zid)) continue;
    if (openZones.has(zid)) continue;
    const raidZone = ZONE_BY_ID[zid];
    if (!raidZone || raidZone.type !== 'city' || !raidZone.gymLeader) continue;
    const rzs = state.zones[zid];
    if (!rzs || !rzs.gymDefeated) continue;
    if ((rzs.combatsWon || 0) < 10) continue;
    if (Date.now() - (rzs.gymRaidLastFight || 0) < raidCooldownMs) continue;
    checkedRaidZones.add(zid);
    if (globalThis.triggerGymRaid(zid, true)) changed = true;
  }

  if (changed) {
    globalThis.saveState();
    globalThis.updateTopBar();
    if (globalThis.activeTab === 'tabGang') globalThis.renderGangTab();
  }
}

// ── Modale de choix d'atout ──────────────────────────────────────────────────
function openPerkChoiceModal(agentId) {
  const state = globalThis.state;
  const agent = state.agents.find(a => a.id === agentId);
  if (!agent || !agent.pendingPerkChoice) return;

  const picks = _rollThreePerks(agent);

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:16px';

  const cardsHtml = picks.map(perk => `
    <div class="perk-pick-card" data-perk-id="${perk.id}"
      style="flex:1;min-width:130px;max-width:170px;background:var(--bg-card);border:2px solid var(--border);
             border-radius:var(--radius);padding:14px 10px;cursor:pointer;text-align:center;
             display:flex;flex-direction:column;align-items:center;gap:8px;
             transition:border-color .15s,box-shadow .15s">
      <div style="font-size:28px;line-height:1">${perk.icon}</div>
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">${perk.fr}</div>
      <div style="font-size:8px;color:var(--text-dim);line-height:1.4">${perk.desc}</div>
      <button class="perk-pick-btn" data-perk-id="${perk.id}"
        style="margin-top:auto;font-family:var(--font-pixel);font-size:8px;padding:5px 12px;
               background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);
               color:var(--gold);cursor:pointer;width:100%">Choisir</button>
    </div>`).join('');

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);
                padding:22px;max-width:560px;width:100%;display:flex;flex-direction:column;gap:16px">
      <div style="text-align:center">
        <div style="font-family:var(--font-pixel);font-size:11px;color:var(--gold);margin-bottom:6px">
          🎖 ATOUT — ${agent.name} · Lv.${agent.level}
        </div>
        <div style="font-size:8px;color:var(--text-dim)">Choisissez un atout permanent pour cet agent</div>
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">${cardsHtml}</div>
    </div>`;

  document.body.appendChild(overlay);

  // Hover
  overlay.querySelectorAll('.perk-pick-card').forEach(card => {
    card.addEventListener('mouseenter', () => { card.style.borderColor = 'var(--gold)'; card.style.boxShadow = '0 0 12px rgba(255,200,0,.25)'; });
    card.addEventListener('mouseleave', () => { card.style.borderColor = 'var(--border)'; card.style.boxShadow = ''; });
  });

  // Pick
  overlay.querySelectorAll('.perk-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const perkId = btn.dataset.perkId;
      if (!agent.perks) agent.perks = [];
      agent.perks.push(perkId);
      agent.pendingPerkChoice = false;
      const perk = picks.find(p => p.id === perkId);
      globalThis.notify(`🎖 ${agent.name} — Atout : ${perk?.fr || perkId}`, 'gold');
      globalThis.saveState();
      overlay.remove();
      globalThis.renderAgentsTab?.();
    });
  });
}

// ── Migration XP → nouveau système de niveaux + atouts ───────────────────────
// Appelé une seule fois au boot si state.purchases.agentPerkMigrated !== true.
// Convertit l'XP accumulée pendant le freeze en niveaux réels + attribue
// automatiquement les atouts correspondants (choix aléatoire, déterministe
// basé sur le nom de l'agent pour la reproductibilité).
function migrateAgentPerkSystem() {
  const state = globalThis.state;
  if (state.purchases?.agentPerkMigrated) return false; // déjà fait

  const AGENT_PERKS = globalThis.AGENT_PERKS || [];
  let anyChange = false;

  for (let agIdx = 0; agIdx < state.agents.length; agIdx++) {
    const agent = state.agents[agIdx];
    if (!agent.perks) agent.perks = [];
    if (agent.pendingPerkChoice === undefined) agent.pendingPerkChoice = false;
    // Ensure new fields exist
    if (agent.legacyLocked === undefined) agent.legacyLocked = agIdx >= 10;
    agent.natureDefined = true; // remove old nature modal requirement

    // Totaliser l'XP : XP déjà "brûlée" pour atteindre le niveau courant
    // + XP accumulée pendant le freeze
    const xpForCurrentLevel = 15 * agent.level * (agent.level - 1);
    const totalXP = xpForCurrentLevel + (agent.xp || 0);

    // Calculer le niveau réel correspondant (formule inverse : level*(level-1) = totalXP/15)
    // x² - x - totalXP/15 = 0 → x = (1 + sqrt(1 + 4*totalXP/15)) / 2
    const rawLevel = Math.floor((1 + Math.sqrt(1 + 4 * totalXP / 15)) / 2);
    const newLevel = Math.max(agent.level, Math.min(99, rawLevel));

    // XP résiduelle au nouveau niveau
    const xpUsed = 15 * newLevel * (newLevel - 1);
    agent.xp     = Math.max(0, totalXP - xpUsed);
    agent.level  = newLevel;

    // Atouts automatiques pour les paliers déjà franchis
    const perksEarned = Math.floor(newLevel / PERK_EVERY);
    const perksNeeded = perksEarned - agent.perks.length;
    if (perksNeeded > 0) {
      // Seed déterministe basé sur le nom de l'agent (évite randomisation à chaque chargement)
      const rng = _seededRng(agent.name + agent.id);
      const pool = [...AGENT_PERKS];
      for (let i = 0; i < perksNeeded; i++) {
        const available = pool.filter(p => !agent.perks.includes(p.id));
        if (available.length === 0) break;
        const pick = available[Math.floor(rng() * available.length)];
        agent.perks.push(pick.id);
      }
    }

    // Si le niveau atteint un palier non encore couvert → pendingPerkChoice
    if (Math.floor(newLevel / PERK_EVERY) > agent.perks.length) {
      agent.pendingPerkChoice = true;
    }

    checkPromotion(agent);
    anyChange = true;
  }

  if (!state.purchases) state.purchases = {};
  state.purchases.agentPerkMigrated = true;
  if (anyChange) globalThis.saveState();
  return anyChange;
}

// Générateur pseudo-aléatoire simple (mulberry32) — seed = chaîne de caractères.
function _seededRng(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(31, h) + seedStr.charCodeAt(i) | 0;
  }
  return function() {
    h |= 0; h = h + 0x6D2B79F5 | 0;
    let t = Math.imul(h ^ h >>> 15, 1 | h);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── Popup narratif Darkrai ────────────────────────────────────────────────────
// Affiché une seule fois pour expliquer la migration au joueur.
function openDarkraiMigrationPopup(onDone) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:10000;
    background:radial-gradient(ellipse at center, #0d0320 0%, #000 100%);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:20px;overflow:hidden`;

  // Étoiles de fond
  const stars = Array.from({length:40}, () => {
    const x = Math.random()*100, y = Math.random()*100, s = 0.5+Math.random()*1.5;
    return `<div style="position:absolute;left:${x}%;top:${y}%;width:${s}px;height:${s}px;background:#fff;border-radius:50%;opacity:${0.3+Math.random()*0.5};animation:twinkle ${1+Math.random()*2}s infinite alternate"></div>`;
  }).join('');

  overlay.innerHTML = `
    <style>
      @keyframes twinkle { from{opacity:.2} to{opacity:.8} }
      @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
      @keyframes fadeIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
    </style>
    <div style="position:absolute;inset:0;overflow:hidden;pointer-events:none">${stars}</div>
    <div style="position:relative;text-align:center;max-width:480px;animation:fadeIn .8s ease">
      <img src="https://play.pokemonshowdown.com/sprites/gen5ani/darkrai.gif"
           style="width:96px;height:96px;image-rendering:pixelated;animation:float 3s ease-in-out infinite;margin-bottom:12px"
           onerror="this.style.display='none'">
      <div style="font-family:var(--font-pixel);font-size:10px;color:#9d6fff;letter-spacing:2px;margin-bottom:16px">
        — VISION DE DARKRAI —
      </div>
      <div style="font-size:11px;color:#ccc;line-height:1.8;margin-bottom:20px;font-style:italic">
        Dans les brumes du Pays des Rêves, le Boss entrevoit<br>
        le véritable potentiel de ses agents.<br><br>
        <span style="color:#fff">L'expérience accumulée dans l'ombre révèle<br>
        des talents cachés — des <span style="color:#9d6fff">atouts mystiques</span><br>
        que seuls les plus dévoués ont développés.</span>
      </div>
      <div style="font-size:9px;color:#666;margin-bottom:20px">
        L'XP de vos agents a été convertie en niveaux.<br>
        Chaque palier de 10 niveaux révèle un <span style="color:#9d6fff">atout permanent</span>.
      </div>
      <button id="darkraiAwake"
        style="font-family:var(--font-pixel);font-size:9px;padding:10px 28px;
               background:linear-gradient(135deg,#4a1a8a,#6a2ab0);
               border:1px solid #9d6fff;border-radius:var(--radius-sm);
               color:#fff;cursor:pointer;letter-spacing:1px">
        ✦ S'ÉVEILLER ✦
      </button>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#darkraiAwake').addEventListener('click', () => {
    overlay.style.transition = 'opacity .5s';
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.remove(); onDone?.(); }, 500);
  });
}

// Agent automation tick — agents interact with VISIBLE spawns in zone windows
// Compteur de ticks sautés quand la page est masquée (utilisé pour le rattrapage).
let _hiddenAgentTicks = 0;

function agentTick() {
  const state = globalThis.state;
  if (!state.settings.autoCombat) return; // auto-combat off = agents idle

  // Page en arrière-plan → on ne touche pas au DOM, on compte juste les ticks
  if (document.hidden) { _hiddenAgentTicks++; return; }

  const openZones = globalThis.openZones;
  const zoneSpawns = globalThis.zoneSpawns;
  const zoneDone = new Set(); // track zones already processed this tick
  for (const agent of state.agents) {
    if (!agent.assignedZone) continue;
    const zoneId = agent.assignedZone;
    if (!openZones.has(zoneId)) continue; // only act in open zone windows
    const spawns = zoneSpawns[zoneId];
    if (!spawns || spawns.length === 0) continue;
    if (zoneDone.has(zoneId)) continue; // one action per zone per tick
    // Chance to act this tick based on agent level (higher = more active)
    const actChance = Math.min(0.95, 0.4 + agent.level / 100);
    if (Math.random() > actChance) continue;

    // Priority: raids > trainers > pokemon > chests — filtered by agent behavior flags
    const canCombat  = agent.autoCombat  !== false;
    const canRaid    = agent.autoRaid    !== false;
    const canCapture = agent.autoCapture !== false;
    const raidSpawn    = canRaid    ? spawns.find(s => s.type === 'raid'    && !s._agentClaimed) : null;
    const trainerSpawn = canCombat  ? spawns.find(s => s.type === 'trainer' && !s._agentClaimed) : null;
    const pokemonSpawn = canCapture ? spawns.find(s => s.type === 'pokemon' && !s._agentClaimed && !s.playerCatching) : null;
    const chestSpawn = spawns.find(s => s.type === 'chest' && !s._agentClaimed);

    if (raidSpawn) {
      raidSpawn._agentClaimed = true;
      zoneDone.add(zoneId);
      agentAutoCombat(zoneId, raidSpawn, agent);
    } else if (trainerSpawn) {
      // Mark claimed so other agents don't try
      trainerSpawn._agentClaimed = true;
      zoneDone.add(zoneId);
      // Open combat popup with auto-execute
      agentAutoCombat(zoneId, trainerSpawn, agent);
    } else if (pokemonSpawn) {
      pokemonSpawn._agentClaimed = true;
      zoneDone.add(zoneId);
      // Agent throws ball at visible pokemon spawn
      agentCaptureVisibleSpawn(agent, zoneId, pokemonSpawn);
    } else if (chestSpawn) {
      chestSpawn._agentClaimed = true;
      zoneDone.add(zoneId);
      // Agent opens chest
      agentOpenChest(agent, zoneId, chestSpawn);
    }
  }
}

// Agent captures a visible pokemon spawn with ball throw animation
function agentCaptureVisibleSpawn(agent, zoneId, spawnObj) {
  const BALL_SPRITES = globalThis.BALL_SPRITES;
  const win = document.getElementById(`zw-${zoneId}`);
  if (!win) return;
  const viewport = win.querySelector('.zone-viewport');
  if (!viewport) return;
  const spawnEl = viewport.querySelector(`[data-spawn-id="${spawnObj.id}"]`);
  if (!spawnEl) return;

  // Skip if player is already capturing this spawn
  if (spawnObj.playerCatching) return;

  // Mark as catching to prevent player clicks
  spawnEl.classList.add('catching');

  // Find agent sprite position (agents are now in footer bar)
  const agentEls = win.querySelectorAll('.zone-agent');
  let agentEl = null;
  for (const el of agentEls) {
    const label = el.querySelector('.agent-label');
    if (label && label.textContent === agent.name) { agentEl = el; break; }
  }
  // Ball starts from bottom of viewport (agent is in footer below viewport)
  let startX = viewport.clientWidth / 2;
  let startY  = viewport.clientHeight - 8;
  if (agentEl) {
    const r  = agentEl.getBoundingClientRect();
    const wr = viewport.getBoundingClientRect();
    startX = r.left - wr.left + r.width / 2;
    startY = Math.min(viewport.clientHeight - 8, r.top - wr.top); // clamp to viewport
  }
  const targetX = parseInt(spawnEl.style.left) + 28;
  const targetY = parseInt(spawnEl.style.top) + 28;

  // Ball projectile
  const ball = document.createElement('div');
  ball.className = 'ball-projectile';
  ball.innerHTML = `<img src="${BALL_SPRITES.pokeball}">`;
  ball.style.left = startX + 'px';
  ball.style.top = startY + 'px';
  viewport.appendChild(ball);

  globalThis.SFX.play('ballThrow')
  requestAnimationFrame(() => {
    ball.style.transition = 'left .35s ease-out, top .35s ease-in';
    ball.style.left = targetX + 'px';
    ball.style.top = targetY + 'px';
  });

  setTimeout(() => {
    ball.remove();
    // Use agent's preferred ball (temporarily override activeBall)
    const state = globalThis.state;
    const preferred = agent.preferredBall || 'pokeball';
    const hasPref = (state.inventory[preferred] || 0) > 0;
    const usedBall = hasPref ? preferred : 'pokeball';
    const prevBall = state.activeBall;
    state.activeBall = (state.inventory[usedBall] || 0) > 0 ? usedBall : prevBall;
    // Poser le contexte agent pour que zoneSystem.js ne pousse pas son propre feed event
    globalThis._agentCaptureCtx = { agentName: agent.name, ball: usedBall, zoneId };
    const caught = globalThis.tryCapture(zoneId, spawnObj.species_en);
    globalThis._agentCaptureCtx = null;
    state.activeBall = prevBall;
    if (caught) {
      // Luck reroll for higher-level agents (replaces stats.luck check)
      if (agent.level >= 20 && caught.potential < 3 && Math.random() < agent.level / 100) {
        caught.potential = globalThis.randInt(3, 5);
        caught.stats = globalThis.calculateStats(caught);
      }
      _autoSellCaptured(caught);
      globalThis.showCaptureBurst(viewport, targetX, targetY, caught.potential, caught.shiny);
      grantAgentXP(agent, 2);
      const cName   = globalThis.speciesName(caught.species_en);
      const cStars  = '★'.repeat(caught.potential || 0) + '☆'.repeat(5 - (caught.potential || 0));
      const cRarity = globalThis.SPECIES_BY_EN?.[caught.species_en]?.rarity;
      const zoneName = ZONE_BY_ID?.[zoneId]?.fr || zoneId;
      const ballName = globalThis.BALLS?.[usedBall]?.fr || usedBall;
      // Notifications spéciales seulement (éviter doublon avec le toast de tryCapture)
      if (caught.shiny) {
        globalThis.notify(`✨ ${agent.name} — SHINY ! ${cName} ${cStars} ✨`, 'gold');
      } else if (cRarity === 'legendary') {
        globalThis.notify(`🏆 ${agent.name} — LÉGENDAIRE ! ${cName} ${cStars}`, 'gold');
      } else if (cRarity === 'very_rare') {
        globalThis.notify(`⭐ ${agent.name} — Très rare ! ${cName} ${cStars}`, 'gold');
      }
      globalThis.addLog(globalThis.t('agent_catch', { agent: agent.name, pokemon: cName }));
      // Feed event unique et complet
      globalThis.pushFeedEvent({
        category: 'capture',
        title: `${cName}${caught.shiny ? ' ✨' : ''} — ${cStars}`,
        detail: `${agent.name} · ${zoneName} · ${ballName}`,
        win: true,
        species_en: caught.species_en,
        level: caught.level,
        potential: caught.potential,
        shiny: caught.shiny,
        byAgent: agent.name,
        zone: zoneName,
        ball: ballName,
      });
      globalThis.removeSpawn(zoneId, spawnObj.id);
      globalThis.updateTopBar();
      globalThis.updateZoneTimers(zoneId);
    } else {
      // No balls left — release spawn
      spawnEl.classList.remove('catching');
      spawnObj._agentClaimed = false;
    }
  }, 380);
}

// Agent auto-fights a trainer silently with the same resolver as manual zone combat.
function agentAutoCombat(zoneId, spawnObj, agent) {
  // Don't steal a spawn while the player is already in a manual combat.
  if (globalThis.currentCombat) {
    spawnObj._agentClaimed = false;
    return;
  }
  const isRaid = spawnObj.type === 'raid' || spawnObj.isRaid;
  const combatAgents = _zoneCombatAgents(zoneId, { isRaid, preferredAgent: agent });
  if (combatAgents.length === 0) {
    spawnObj._agentClaimed = false;
    return;
  }

  // Show VS badge on the spawn element
  const _win = document.getElementById(`zw-${zoneId}`);
  const _vp  = _win?.querySelector('.zone-viewport');
  const _el  = _vp?.querySelector(`[data-spawn-id="${spawnObj.id}"]`);
  if (_el) globalThis._addVSBadge(_el);

  setTimeout(() => {
    if (globalThis.currentCombat) {
      spawnObj._agentClaimed = false;
      return;
    }
    const result = resolveTrainerCombat({ ...spawnObj, zoneId }, combatAgents.map(a => a.id));
    _applyResolvedAgentCombat(zoneId, spawnObj, combatAgents, result);
    globalThis.removeSpawn(zoneId, spawnObj.id);
    globalThis.updateTopBar();
    globalThis.updateZoneTimers?.(zoneId);
    globalThis.refreshZoneIncomeTile?.(zoneId);
    globalThis.updateZoneButtons?.();
    if (globalThis.activeTab === 'tabGang') globalThis.renderGangTab();
  }, 360);
}

// Agent opens a chest
function agentOpenChest(agent, zoneId, spawnObj) {
  const state = globalThis.state;
  state.stats.chestsOpened = (state.stats.chestsOpened || 0) + 1;
  const loot = globalThis.rollChestLoot(zoneId);
  globalThis.notify(`${agent.name}: ${loot.msg}`, loot.type);
  grantAgentXP(agent, 1);
  globalThis.SFX.play('chest');
  globalThis.removeSpawn(zoneId, spawnObj.id);
  globalThis.updateTopBar();
  globalThis.updateZoneTimers(zoneId);
  globalThis.saveState();
}

// (Agent capture animation is now handled by agentCaptureVisibleSpawn above)

// ── Épreuve de Darkrai — re-roll sprite et personnalité ─────────────────────
// Conserve : nom, niveau, XP, atouts, grade, équipe, zone assignée.
// Re-roll   : sprite, spriteKey, personality.
const DARKRAI_TRIAL_COST = 50_000;

function openDarkraiTrial(agentId) {
  const state = globalThis.state;
  const agent = state.agents.find(a => a.id === agentId);
  if (!agent) return;

  if ((state.gang?.money || 0) < DARKRAI_TRIAL_COST) {
    globalThis.notify(`Fonds insuffisants (${DARKRAI_TRIAL_COST.toLocaleString()}₽ requis)`, 'error');
    return;
  }

  const AGENT_SPRITES      = globalThis.AGENT_SPRITES || [];
  const AGENT_PERSONALITIES = globalThis.AGENT_PERSONALITIES || [];

  // Générer 3 candidats (sprite + personnalité) différents du profil actuel
  const candidates = [];
  for (let i = 0; i < 3; i++) {
    let sprite;
    do { sprite = AGENT_SPRITES[Math.floor(Math.random() * AGENT_SPRITES.length)]; }
    while (sprite === agent.spriteKey && AGENT_SPRITES.length > 1);
    const pool = [...AGENT_PERSONALITIES];
    const personality = [];
    for (let j = 0; j < 2; j++) {
      const idx = Math.floor(Math.random() * pool.length);
      personality.push(pool.splice(idx, 1)[0]);
    }
    candidates.push({ sprite, spriteUrl: globalThis.trainerSprite(sprite), personality });
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.93);z-index:9900;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid #9d6fff;border-radius:var(--radius);
                padding:22px;max-width:520px;width:100%;display:flex;flex-direction:column;gap:14px">
      <div style="text-align:center">
        <img src="https://play.pokemonshowdown.com/sprites/gen5ani/darkrai.gif"
             style="width:56px;image-rendering:pixelated;animation:float 3s ease-in-out infinite"
             onerror="this.style.display='none'">
        <div style="font-family:var(--font-pixel);font-size:10px;color:#9d6fff;margin-top:6px">ÉPREUVE DE DARKRAI</div>
        <div style="font-size:8px;color:var(--text-dim);margin-top:4px">
          ${agent.name} entre dans les rêves de Darkrai — choisissez son nouveau profil.
          <br>Coût : <span style="color:var(--gold)">${DARKRAI_TRIAL_COST.toLocaleString()}₽</span>
        </div>
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        ${candidates.map((c, i) => `
          <div class="darkrai-cand" data-idx="${i}"
            style="flex:1;min-width:120px;max-width:150px;background:var(--bg-card);border:2px solid var(--border);
                   border-radius:var(--radius);padding:12px 8px;text-align:center;cursor:pointer;
                   display:flex;flex-direction:column;align-items:center;gap:6px;transition:border-color .15s">
            <img src="${c.spriteUrl}" style="width:48px;height:48px;image-rendering:pixelated">
            <div style="font-size:8px;color:var(--text-dim)">${c.personality.map(p => p.fr || p).join(' · ')}</div>
            <button class="darkrai-pick" data-idx="${i}"
              style="font-family:var(--font-pixel);font-size:7px;padding:4px 10px;
                     background:var(--bg);border:1px solid #9d6fff;border-radius:var(--radius-sm);
                     color:#9d6fff;cursor:pointer;width:100%">Choisir</button>
          </div>`).join('')}
      </div>
      <div style="text-align:center">
        <button id="darkraiCancel" style="font-family:var(--font-pixel);font-size:8px;padding:5px 16px;
          background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);
          color:var(--text-dim);cursor:pointer">Annuler</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelectorAll('.darkrai-cand').forEach(card => {
    card.addEventListener('mouseenter', () => { card.style.borderColor = '#9d6fff'; });
    card.addEventListener('mouseleave', () => { card.style.borderColor = 'var(--border)'; });
  });

  overlay.querySelectorAll('.darkrai-pick').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = candidates[parseInt(btn.dataset.idx)];
      state.gang.money -= DARKRAI_TRIAL_COST;
      agent.sprite    = c.spriteUrl;
      agent.spriteKey = c.sprite;
      agent.personality = c.personality;
      agent.natureDefined = true;
      globalThis.saveState();
      globalThis.notify(`✦ ${agent.name} a traversé l'épreuve de Darkrai !`, 'gold');
      overlay.remove();
      globalThis.renderAgentsTab?.();
      globalThis.updateTopBar?.();
    });
  });

  overlay.querySelector('#darkraiCancel')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── Déverrouillage d'un agent bloqué (slot 10+) ──────────────────────────────
// Coût = getAgentRecruitCost() au moment du déverrouillage (basé sur la position dans la liste).
function getAgentUnlockCost(agentIndex) {
  const tier = Math.floor(agentIndex / 5);
  return 5_000 * Math.pow(10, tier);
}

function unlockAgent(agentId) {
  const state = globalThis.state;
  const idx   = state.agents.findIndex(a => a.id === agentId);
  const agent = state.agents[idx];
  if (!agent || !agent.legacyLocked) return;

  const cost = getAgentUnlockCost(idx);
  if ((state.gang?.money || 0) < cost) {
    globalThis.notify(`Fonds insuffisants (${cost.toLocaleString()}₽ requis)`, 'error');
    return;
  }

  globalThis.showConfirm?.(
    `Débloquer <b>${agent.name}</b> pour <b>${cost.toLocaleString()}₽</b> ?<br>
     <span style="color:var(--text-dim);font-size:10px">
       De nos jours, le management coûte cher…<br>
       Cet agent rejoindra pleinement votre organisation.
     </span>`,
    () => {
      state.gang.money -= cost;
      agent.legacyLocked = false;
      globalThis.saveState();
      globalThis.notify(`✅ ${agent.name} intègre officiellement votre organisation !`, 'success');
      globalThis.renderAgentsTab?.();
      globalThis.updateTopBar?.();
    },
    null,
    { confirmLabel: 'Débloquer', cancelLabel: 'Annuler' }
  );
}

// ── Rattrapage des ticks agents quand le joueur revient sur la page ─────────────
// On simule les ticks manqués (state-only, pas de DOM) puis on rafraîchit une fois.
document.addEventListener('visibilitychange', () => {
  if (document.hidden || _hiddenAgentTicks === 0) return;
  const toProcess = Math.min(_hiddenAgentTicks, 30); // cap : 30 ticks ≈ 60 s max
  _hiddenAgentTicks = 0;
  const state = globalThis.state;
  if (!state?.settings?.autoCombat) return;
  // Pour chaque tick manqué on résout en background les zones avec agents
  for (let i = 0; i < toProcess; i++) {
    for (const agent of state.agents) {
      if (agent.assignedZone && !globalThis.openZones?.has(agent.assignedZone)) {
        globalThis.resolveBackgroundSpawnForZone?.(agent.assignedZone);
      }
    }
  }
  // Un seul rafraîchissement UI après tout le rattrapage
  globalThis.updateTopBar?.();
  if (globalThis.activeTab === 'tabGang') globalThis.renderGangTab?.();
});

Object.assign(globalThis, {
  getAgentRecruitCost,
  getAgentUnlockCost,
  unlockAgent,
  rollNewAgent,
  recruitAgent,
  openAgentRecruitModal,
  assignAgentToZone,
  grantAgentXP,
  captureXP,
  checkPromotion,
  getAgentRankLabel,
  getAgentCombatPower,
  resolveBackgroundSpawnForZone,
  passiveAgentTick,
  agentTick,
  agentCaptureVisibleSpawn,
  agentAutoCombat,
  agentOpenChest,
  // ── Perk system ──
  getAgentPerkBonus,
  openPerkChoiceModal,
  migrateAgentPerkSystem,
  openDarkraiMigrationPopup,
  openDarkraiTrial,
  PERK_EVERY,
});

export {};
