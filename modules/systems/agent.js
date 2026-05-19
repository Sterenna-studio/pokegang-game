// ════════════════════════════════════════════════════════════════
//  AGENT MODULE
//  Extracted from app.js
// ════════════════════════════════════════════════════════════════

import { resolveTrainerCombat } from './zoneCombat.js';

// ── Slots d'équipe par rang ─────────────────────────────────────────
// grunt=1, sergent=2, lieutenant et au-delà=3.
// Commandant/Général/Élite ont le même nombre de slots (3) ;
// leur avantage passe par le multiplicateur TITLE_BONUSES.
function getAgentTeamSlots(agent) {
  const title = agent?.title;
  if (title === 'grunt')   return 1;
  if (title === 'sergent') return 2;
  return 3; // lieutenant, commandant, general, elite
}

function isZoneContested(zoneId) {
  return !!(globalThis.state?.zones?.[zoneId]?.contested);
}

// Courbe d'accès aux agents (coût pour recruter le (n+1)ième agent) :
//   Agent 1  :      5 000₽
//   Agent 2  :     50 000₽
//   Agent 3  :    100 000₽
//   Agent 4  :    250 000₽
//   Agent 5  :    500 000₽
//   Agent 6  :  1 000 000₽
//   Agent 7  :  2 000 000₽
//   Agent 8  :  3 000 000₽  ← palier +1M jusqu'à 10M
//   …
//   Agent 15 : 10 000 000₽  ← palier +10M au-delà
//   Agent 16 : 20 000 000₽
//   …
function _agentCostAtIndex(n) {
  const FIXED = [5_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_000_000];
  if (n < FIXED.length) return FIXED[n];
  const steps   = n - 7;
  const linearM = 3 + steps;
  if (linearM <= 10) return linearM * 1_000_000;
  const stepsPast = linearM - 10;
  return (10 + stepsPast * 10) * 1_000_000;
}

function getAgentRecruitCost() {
  return _agentCostAtIndex(globalThis.state.agents.length);
}

function rollNewAgent() {
  const AGENT_NAMES_M    = globalThis.AGENT_NAMES_M;
  const AGENT_NAMES_F    = globalThis.AGENT_NAMES_F;
  const AGENT_SPRITES    = globalThis.AGENT_SPRITES;
  const AGENT_PERSONALITIES = globalThis.AGENT_PERSONALITIES;
  const isFemale = Math.random() < 0.5;
  const name   = globalThis.pick(isFemale ? AGENT_NAMES_F : AGENT_NAMES_M);
  const sprite = globalThis.pick(AGENT_SPRITES);
  const personality = [];
  const pool = [...AGENT_PERSONALITIES];
  for (let i = 0; i < 2; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    personality.push(pool.splice(idx, 1)[0]);
  }

  return {
    id:            `ag-${globalThis.uid()}`,
    name,
    sprite:        globalThis.trainerSprite(sprite),
    spriteKey:     sprite,
    title:         'grunt',
    level:         1,
    xp:            0,
    combatsWon:    0,
    ball: 'pokeball', // skin cosmétique — pas d'effet mécanique
    behavior:      'all',
    personality,
    team:          [],
    assignedZone:  null,
    notifyCaptures: true,
    legacyLocked:  false,
    energy:        10,
    maxEnergy:     10,
    resting:       false,
    restUntil:     null,
    lastEnergyReset: 0,
  };
}

function recruitAgent(agentData) {
  const state = globalThis.state;
  state.agents.push(agentData);
  globalThis.addLog(globalThis.t('recruit_agent') + ': ' + agentData.name);
  if (!state.behaviourLogs) state.behaviourLogs = {};
  if (!state.behaviourLogs.firstAgentAt) state.behaviourLogs.firstAgentAt = Date.now();
  globalThis.saveState();
}

function openAgentRecruitModal(onAfterRecruit) {
  const state = globalThis.state;
  const SFX   = globalThis.SFX;
  const cost  = getAgentRecruitCost();

  if ((state.gang?.money || 0) < cost) {
    globalThis.notify(`Fonds insuffisants (${cost.toLocaleString()}₽ requis)`, 'error');
    SFX?.play('error');
    return;
  }

  const candidates = [rollNewAgent(), rollNewAgent(), rollNewAgent()];

  const cardsHtml = candidates.map((ag, i) => `
    <div class="recruit-card" data-idx="${i}" style="
      flex:1;min-width:140px;max-width:190px;
      background:var(--bg-card);border:2px solid var(--gold-dim);
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
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;z-index:9999';
  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:640px;width:96%;display:flex;flex-direction:column;gap:14px">
      <div style="text-align:center">
        <div style="font-family:var(--font-pixel);font-size:11px;color:var(--gold);letter-spacing:1px">RECRUTEMENT</div>
        <div style="font-size:8px;color:var(--text-dim);margin-top:4px">
          Agent ${state.agents.length + 1} — Coût : <span style="color:var(--gold);font-family:var(--font-pixel)">${cost.toLocaleString()}₽</span>
        </div>
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">${cardsHtml}</div>
      <div style="text-align:center">
        <button id="recruitCancelBtn" style="font-family:var(--font-pixel);font-size:8px;padding:6px 16px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelectorAll('.recruit-card').forEach(card => {
    card.addEventListener('mouseenter', () => { card.style.borderColor = 'var(--gold)'; card.style.boxShadow = '0 0 10px rgba(255,200,0,.2)'; });
    card.addEventListener('mouseleave', () => { card.style.borderColor = 'var(--gold-dim)'; card.style.boxShadow = ''; });
  });

  modal.querySelectorAll('.recruit-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      state.gang.money -= cost;
      recruitAgent(candidates[idx]);
      globalThis.notify(`${candidates[idx].name} rejoint votre organisation !`, 'gold');
      globalThis.updateTopBar();
      modal.remove();
      onAfterRecruit?.();
    });
  });

  modal.querySelector('#recruitCancelBtn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function assignAgentToZone(agentId, zoneId) {
  const state = globalThis.state;
  const agent = state.agents.find(a => a.id === agentId);
  if (!agent) return;

  // ── Hard cap : 1 agent par zone ──────────────────────────────
  if (zoneId) {
    const occupant = state.agents.find(a => a.id !== agentId && a.assignedZone === zoneId);
    if (occupant) {
      globalThis.notify?.(`${occupant.name} est déjà assigné à cette zone.`, 'error');
      return;
    }
  }

  // Retirer l'agent de son ancienne zone
  if (agent.assignedZone) {
    const oldZ = state.zones[agent.assignedZone];
    if (oldZ) {
      oldZ.assignedAgents = oldZ.assignedAgents.filter(id => id !== agentId);
    }
  }

  agent.assignedZone = zoneId;
  if (zoneId) {
    const z = globalThis.initZone(zoneId);
    if (!z.assignedAgents.includes(agentId)) {
      z.assignedAgents.push(agentId);
    }
  }
  globalThis.saveState();
  globalThis.syncActiveZones?.();
}

// ── Auto-sell on agent capture ────────────────────────────────────
function _autoSellCaptured(pokemon) {
  const state = globalThis.state;
  if (!state.purchases?.autoSellAgent) return false;
  if (state.purchases?.autoSellAgentEnabled === false) return false;
  if (pokemon.favorite) return false;
  const protected_ = state.settings?.protectedSpecies || [];
  if (protected_.includes(pokemon.species_en)) return false;
  if (pokemon.shiny && !state.pokedex?.[pokemon.species_en]?.shinyUnprotected) return false;
  const cfg = state.settings?.autoSellAgent;
  if (!cfg) return false;
  if (cfg.mode === 'by_potential') {
    const targets = cfg.potentials || [];
    if (!targets.includes(pokemon.potential)) return false;
  }
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
  const sp = SPECIES_BY_EN[species_en];
  const base = RARITY_XP[sp?.rarity] ?? 3;
  return base + Math.max(0, (potential || 1) - 1) * 2 + (shiny ? 10 : 0);
}

function grantAgentXP(agent, amount) {
  if (agent.legacyLocked) return;
  agent.xp += amount;
  const prevLevel = agent.level;
  const needed = () => agent.level * 30;
  while (agent.xp >= needed() && agent.level < 100) {
    agent.xp -= needed();
    agent.level++;
  }
  if (agent.level > prevLevel) {
    globalThis.notify(`📈 ${agent.name} Lv.${agent.level} !`, 'gold');
    checkPromotion(agent);
  }
}

// Retourne le label d'affichage du grade d'un agent
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
function checkPromotion(agent) {
  const RANK_CHAIN        = globalThis.RANK_CHAIN;
  const TITLE_REQUIREMENTS = globalThis.TITLE_REQUIREMENTS;
  const AGENT_RANK_LABELS  = globalThis.AGENT_RANK_LABELS;
  const state = globalThis.state;

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

  if (agent.title === 'commandant' && agent.level >= 100) {
    if (!state.stats) state.stats = {};
    const eliteCount = state.stats.agentsEliteCount || 0;
    const gangName   = state.gang?.name || '';
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

  if (promoted) {
    if (globalThis.activeTab === 'tabAgents') globalThis.renderAgentsTab?.();
    if (globalThis.activeTab === 'tabGang')   globalThis.renderGangTab?.();
  }
}

// Type-coverage multiplier
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
      const mType  = MOVES_DATA[m].type;
      const stab   = (sp?.types || []).includes(mType) ? 1.5 : 1;
      const avgEff = enemyTypes.reduce((s, et) => s + getEff(mType, [et]), 0) / enemyTypes.length;
      const mult   = avgEff * stab;
      if (mult > best) best = mult;
    }
    total += best;
    count++;
  }
  const raw = count > 0 ? total / count : 1;
  return Math.min(1.4, Math.max(0.7, raw));
}

// Puissance de combat d'un agent.
// Formula : sum(pokemonPower sur slots actifs) × rankMult
// Le niveau de l'agent n'entre plus en compte directement :
// il se reflète via l'évolution de son équipe Pokémon et son rang.
function getAgentCombatPower(agent) {
  const state = globalThis.state;
  const rankMult = globalThis.TITLE_BONUSES?.[agent.title] ?? 1.0;
  const slots = getAgentTeamSlots(agent);
  let teamPower = 0;
  for (const pkId of (agent.team || []).slice(0, slots)) {
    const p = state.pokemons.find(pk => pk.id === pkId);
    if (p) teamPower += globalThis.getPokemonPower(p);
  }
  return Math.round(teamPower * rankMult);
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

// Assemble les IDs Pokémon pour un combat d'agents dans une zone.
// Le boss n'est ajouté que s'il est physiquement dans la zone (state.gang.bossZone).
function _combatTeamIdsForAgents(agentIds = [], zoneId = null) {
  const state = globalThis.state;
  const ids = [];
  const bossInZone = zoneId && state.gang?.bossZone === zoneId;
  if (bossInZone) {
    for (const id of state.gang?.bossTeam || []) {
      if (id) ids.push(id);
    }
  }
  for (const agentId of agentIds) {
    const agent = state.agents.find(a => a.id === agentId);
    if (!agent) continue;
    const slots = getAgentTeamSlots(agent);
    for (const id of (agent.team || []).slice(0, slots)) {
      if (id) ids.push(id);
    }
  }
  return [...new Set(ids)].filter(id => state.pokemons.some(pokemon => pokemon.id === id));
}

function _trainerCombatLogLines(result, mainAgentName, trainerName, reward, repGain) {
  const bossName = globalThis.state?.gang?.bossName || 'Boss';
  const bossContrib = (result.bossTeamPower ?? 0) > 0;
  const agentNames = (result.attackers || []).map(a => a.name);
  const allParties = [...(bossContrib ? [bossName] : []), ...agentNames];
  const allies = allParties.length ? allParties.join(' + ') : bossName;
  const lines = [
    `${allies} vs ${trainerName} — ⚡${Math.round(result.attackerPower ?? 0)} / 🛡${Math.round(result.defenderPower ?? 0)}`,
    result.attackerWin
      ? `Victoire ! +${reward}₽ +${repGain}rep`
      : `Défaite contre ${trainerName}.`,
  ];
  return lines;
}

function _applyResolvedAgentCombat(zoneId, spawnObj, combatAgents, result) {
  const state = globalThis.state;
  const agentIds   = combatAgents.map(agent => agent.id);
  const teamIds    = _combatTeamIdsForAgents(agentIds, zoneId);
  const trainerData = { ...spawnObj, zoneId };
  const trainer    = trainerData.trainer || {};
  const rewardRange = trainer.reward || [10, 50];
  const zStateForReward = state.zones?.[zoneId] || {};
  const rewardMult = zStateForReward.contested ? 0.7 : 1;
  const reward     = result.attackerWin
    ? Math.round(Math.min(globalThis.MAX_COMBAT_REWARD, globalThis.randInt(rewardRange[0], rewardRange[1])) * rewardMult)
    : 0;
  const repGain    = globalThis.getCombatRepGain(trainerData.trainerKey || trainerData.trainer?.sprite, result.attackerWin);
  const mainAgent  = combatAgents[0];
  const trainerName = trainer.fr || trainer.en || trainerData.trainerKey || 'dresseur';

  globalThis.applyCombatResult({ win: result.attackerWin, reward, repGain }, teamIds, trainerData);

  if (result.attackerWin) {
    const zoneState = state.zones[zoneId];
    if (zoneState) zoneState.combatsWon = (zoneState.combatsWon || 0) + 1;
    globalThis.addZoneXP?.(zoneId, 'combat_win'); // XP de zone v2
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

// ── Énergie agent ─────────────────────────────────────────────────
function _tickAgentEnergy(agent) {
  if (!agent.resting) return;
  if (Date.now() >= (agent.restUntil || 0)) {
    agent.resting = false;
    agent.restUntil = null;
    agent.energy = 5; // retour à 5, pas full
    globalThis.notify?.(`${agent.name} est reposé et reprend du service.`, 'success');
  }
}

// ── Résolution background d'un spawn pour une zone fermée ────────
function resolveBackgroundSpawnForZone(zoneId) {
  const state = globalThis.state;
  if (!state.settings.autoCombat) return false;

  const zone = ZONE_BY_ID[zoneId];
  if (!zone || zone.spawnRate === 0) return false;

  const allAgents = state.agents.filter(a => a.assignedZone === zoneId);
  if (allAgents.length === 0) return false;

  // Tick énergie + filtre agents en repos
  for (const agent of allAgents) { _tickAgentEnergy(agent); }
  const agents = allAgents.filter(a => !a.resting);
  if (agents.length === 0) return false;

  const zState = state.zones[zoneId] || {};

  const entry = globalThis.spawnInZone(zoneId);
  if (!entry) return false;

  let changed = false;

  // ── Pokémon ──────────────────────────────────────────────────
  if (entry.type === 'pokemon') {
    const capAgents = agents.filter(a => a.autoCapture !== false);
    let capturer = null;
    // pokeball = ressource unique ; on cherche juste un agent disponible
    if ((state.inventory.pokeball || 0) > 0) {
      capturer = capAgents[0] || null;
    }
    const ball = 'pokeball';
    if (!capturer) {
      const _now = Date.now();
      if (!resolveBackgroundSpawnForZone._noBallWarnAt || _now - resolveBackgroundSpawnForZone._noBallWarnAt > 120_000) {
        resolveBackgroundSpawnForZone._noBallWarnAt = _now;
        globalThis.notify(`⚠️ Plus de Poké Balls — les agents de ${zone?.fr || zoneId} ne capturent plus !`, 'error');
      }
      return false;
    }

    // Malus zone contestée sur la capture
    if (zState.contested) {
      if (Math.random() < 0.5) {
        // Capture ratée à cause du malus
        return false;
      }
    }

    const visualBall = capturer.ball || 'pokeball'; // skin cosmétique de l'agent
    const pokemon = globalThis.makePokemon(entry.species_en, zoneId, visualBall);
    if (!pokemon) return false;

    // Crit de capture basé sur le niveau de l'agent
    const isCrit = Math.random() < capturer.level / 200;
    if (isCrit) {
      pokemon.potential = Math.min(5, (pokemon.potential || 1) + 1);
    }

    state.inventory.pokeball--;
    state.pokemons.push(pokemon);
    state.stats.totalCaught++;
    capturer.captureCount = (capturer.captureCount || 0) + 1;
    // XP de zone v2
    const _rarity = SPECIES_BY_EN?.[pokemon.species_en]?.rarity || 'common';
    globalThis.addZoneXP?.(capturer.assignedZone, `capture_${_rarity}`);
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
    globalThis._unlockFabricBg?.(pokemon.dex, pokemon.shiny);
    grantAgentXP(capturer, captureXP(entry.species_en, pokemon.potential, pokemon.shiny));

    const name    = globalThis.speciesName(pokemon.species_en);
    const stars   = '★'.repeat(pokemon.potential) + '☆'.repeat(5 - pokemon.potential);
    const rarity  = SPECIES_BY_EN[pokemon.species_en]?.rarity;
    const zoneName = ZONE_BY_ID[zoneId]?.fr || zoneId;
    const ballName = globalThis.BALLS?.[visualBall]?.fr || visualBall;

    if (pokemon.shiny) {
      globalThis.notify(`✨ ${capturer.name} — SHINY ! ${name} ${stars} ✨`, 'gold');
      setTimeout(() => globalThis.showShinyPopup?.(pokemon.species_en), 200);
    } else if (rarity === 'legendary') {
      globalThis.notify(`🏆 ${capturer.name} — LÉGENDAIRE ! ${name} ${stars}`, 'gold');
    } else if (rarity === 'very_rare') {
      globalThis.notify(`⭐ ${capturer.name} — Très rare ! ${name} ${stars}`, 'gold');
    }
    globalThis.addLog(globalThis.t('agent_catch', { agent: capturer.name, pokemon: name }));
    globalThis.pushFeedEvent?.({
      category: 'capture',
      title:    `${name}${pokemon.shiny ? ' ✨' : ''} — ${stars}`,
      detail:   `${capturer.name} · ${zoneName} · ${ballName}`,
      win: true,
      species_en: pokemon.species_en,
      level:      pokemon.level,
      potential:  pokemon.potential,
      shiny:      pokemon.shiny,
      byAgent:    capturer.name,
      zone:       zoneName,
      ball:       ballName,
    });
    changed = true;

  // ── Dresseur / Raid ──────────────────────────────────────────
  } else if (entry.type === 'trainer' || entry.type === 'raid') {
    const isRaid = entry.type === 'raid';
    const combatAgents = _zoneCombatAgents(zoneId, { isRaid });
    if (combatAgents.length === 0) return false;
    const result = resolveTrainerCombat({ ...entry, zoneId }, combatAgents.map(agent => agent.id));
    _applyResolvedAgentCombat(zoneId, entry, combatAgents, result);

    // ── Zone contestée : gestion lossStreak / reclaimWins ────
    const zoneName = zone?.fr || zoneId;
    const mainAgent = combatAgents[0];
    if (!result.attackerWin) {
      // Défaite
      zState.lossStreak = (zState.lossStreak || 0) + 1;
      const tier = zone?.tier || 1;
      const energyCost = tier >= 4 ? 3 : 2;
      if (mainAgent) {
        mainAgent.energy = Math.max(0, (mainAgent.energy ?? 10) - energyCost);
        if (mainAgent.energy === 0) {
          mainAgent.resting = true;
          mainAgent.restUntil = Date.now() + 60 * 60 * 1000; // 1h
          globalThis.notify?.(`${mainAgent.name} est épuisé — repos 1h.`, 'error');
          globalThis.pushFeedEvent?.({ category:'zone', title:`${mainAgent.name} KO — repos forcé`, detail:`Zone ${zoneId} · reprend à 50% d'énergie dans 1h`, win:false });
        }
      }
      if (zState.lossStreak >= 10) {
        zState.contested = true;
        zState.lossStreak = 0;
        zState.reclaimWins = 0;
        globalThis.notify?.(`⚠ Zone contestée : ${zoneName}`, 'error');
        globalThis.pushFeedEvent?.({ category:'zone', title:`Zone contestée — ${zoneName}`, detail:'10 défaites — malus actifs (-50% captures, -30% revenus)', win:false });
      }
    } else {
      // Victoire
      if (zState.contested) {
        zState.reclaimWins = (zState.reclaimWins || 0) + 1;
        zState.lossStreak = 0;
        if (zState.reclaimWins >= 5) {
          zState.contested = false;
          zState.reclaimWins = 0;
          zState.lossStreak = 0;
          globalThis.notify?.(`Zone reprise : ${zoneName} !`, 'gold');
        }
      } else {
        zState.lossStreak = Math.max(0, (zState.lossStreak || 0) - 1);
      }
    }

    changed = true;

  // ── Coffre ───────────────────────────────────────────────────
  } else if (entry.type === 'chest') {
    state.stats.chestsOpened = (state.stats.chestsOpened || 0) + 1;
    const loot      = globalThis.rollChestLoot(zoneId, true);
    const mainAgent = agents[0];
    if (mainAgent?.notifyCaptures !== false) globalThis.notify(`📦 ${mainAgent.name} — ${loot.msg}`, loot.type);
    changed = true;

  // ── Événement spécial — ignoré en background ──────────────────
  } else if (entry.type === 'event') {
    // nécessite interaction joueur
  }

  if (changed) {
    globalThis.saveState();
    globalThis.updateTopBar();
    globalThis.refreshZoneIncomeTile?.(zoneId);
    globalThis.updateZoneButtons?.();
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

  // Raid hostile sur zone occupée (≈ 1 % / spawn)
  if (Math.random() < 0.01 && agents.length > 0) {
    _resolveOccupiedZoneRaid(zoneId, agents);
  }

  return changed;
}

// ── Raid hostile sur zone occupée ────────────────────────────────
function _resolveOccupiedZoneRaid(zoneId, agents) {
  const state  = globalThis.state;
  const zone   = ZONE_BY_ID[zoneId];
  if (!zone) return;

  const defensePower = agents.reduce((acc, a) => acc + getAgentCombatPower(a), 0);
  const zoneDiff     = globalThis.getZoneDifficulty?.(zoneId) ?? 1;
  const attackPower  = Math.round(zoneDiff * 10 * (0.7 + Math.random() * 0.7));
  const zoneName     = zone.fr || zoneId;
  const won          = defensePower >= attackPower;

  if (won) {
    const repGain   = Math.round(zoneDiff * (1 + Math.random()));
    const moneyGain = Math.round(zoneDiff * 200 * (1 + Math.random()));
    state.gang.reputation = (state.gang.reputation || 0) + repGain;
    state.gang.money      = (state.gang.money || 0) + moneyGain;
    globalThis.notify(`🛡 Raid repoussé sur ${zoneName} ! +${repGain} REP +${moneyGain.toLocaleString()}₽`, 'gold');
    globalThis.pushFeedEvent?.({ category: 'raid', title: `Raid repoussé — ${zoneName}`, detail: `Défense ${defensePower} vs Attaque ${attackPower} · +${repGain} REP`, win: true });
  } else {
    const moneyLoss = Math.round(Math.min(state.gang.money * 0.03, zoneDiff * 500));
    state.gang.money = Math.max(0, (state.gang.money || 0) - moneyLoss);
    globalThis.notify(`⚠️ Raid ennemi sur ${zoneName} ! −${moneyLoss.toLocaleString()}₽`, 'error');
    globalThis.pushFeedEvent?.({ category: 'raid', title: `Raid subi — ${zoneName}`, detail: `Défense ${defensePower} vs Attaque ${attackPower} · −${moneyLoss.toLocaleString()}₽`, win: false });
  }
  globalThis.saveState();
  globalThis.updateTopBar?.();
}

// ── Passive agent tick (toutes les 10s) ──────────────────────────
// Gère uniquement les gym raids automatiques.
function passiveAgentTick() {
  const state = globalThis.state;
  if (!state.settings.autoCombat) return;
  const openZones = globalThis.openZones;
  if (!openZones) return;

  // ── Reset quotidien de l'énergie des agents ──────────────────
  const now = Date.now();
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  for (const agent of state.agents) {
    if (!agent.resting && (agent.lastEnergyReset || 0) < todayMidnight.getTime()) {
      agent.energy = agent.maxEnergy || 10;
      agent.lastEnergyReset = now;
    }
  }

  let changed = false;
  const raidCooldownMs = 5 * 60 * 1000;
  const checkedRaidZones = new Set();
  for (const agent of state.agents) {
    if (!agent.assignedZone) continue;
    if (agent.autoRaid === false) continue;
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

// ── Agent tick (toutes les 2s) — zones ouvertes uniquement ───────
let _hiddenAgentTicks = 0;

function agentTick() {
  const state = globalThis.state;
  if (!state.settings.autoCombat) return;
  if (document.hidden) { _hiddenAgentTicks++; return; }

  const openZones  = globalThis.openZones;
  const zoneSpawns = globalThis.zoneSpawns;
  const zoneDone   = new Set();
  for (const agent of state.agents) {
    if (!agent.assignedZone) continue;
    const zoneId = agent.assignedZone;
    if (!openZones.has(zoneId)) continue;
    const spawns = zoneSpawns[zoneId];
    if (!spawns || spawns.length === 0) continue;
    if (zoneDone.has(zoneId)) continue;
    const actChance = Math.min(0.95, 0.4 + agent.level / 100);
    if (Math.random() > actChance) continue;

    const canCombat  = agent.autoCombat  !== false;
    const canRaid    = agent.autoRaid    !== false;
    const canCapture = agent.autoCapture !== false;
    const raidSpawn    = canRaid    ? spawns.find(s => s.type === 'raid'    && !s._agentClaimed) : null;
    const trainerSpawn = canCombat  ? spawns.find(s => s.type === 'trainer' && !s._agentClaimed) : null;
    const pokemonSpawn = canCapture ? spawns.find(s => s.type === 'pokemon' && !s._agentClaimed && !s.playerCatching) : null;
    const chestSpawn   = spawns.find(s => s.type === 'chest' && !s._agentClaimed);

    if (raidSpawn) {
      raidSpawn._agentClaimed = true; zoneDone.add(zoneId);
      agentAutoCombat(zoneId, raidSpawn, agent);
    } else if (trainerSpawn) {
      trainerSpawn._agentClaimed = true; zoneDone.add(zoneId);
      agentAutoCombat(zoneId, trainerSpawn, agent);
    } else if (pokemonSpawn) {
      pokemonSpawn._agentClaimed = true; zoneDone.add(zoneId);
      agentCaptureVisibleSpawn(agent, zoneId, pokemonSpawn);
    } else if (chestSpawn) {
      chestSpawn._agentClaimed = true; zoneDone.add(zoneId);
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
  if (spawnObj.playerCatching) return;
  spawnEl.classList.add('catching');

  const agentEls = win.querySelectorAll('.zone-agent');
  let agentEl = null;
  for (const el of agentEls) {
    const label = el.querySelector('.agent-label');
    if (label && label.textContent === agent.name) { agentEl = el; break; }
  }
  let startX = viewport.clientWidth / 2;
  let startY  = viewport.clientHeight - 8;
  if (agentEl) {
    const r  = agentEl.getBoundingClientRect();
    const wr = viewport.getBoundingClientRect();
    startX = r.left - wr.left + r.width / 2;
    startY = Math.min(viewport.clientHeight - 8, r.top - wr.top);
  }
  const targetX = parseInt(spawnEl.style.left) + 28;
  const targetY = parseInt(spawnEl.style.top) + 28;

  const ball = document.createElement('div');
  ball.className = 'ball-projectile';
  ball.innerHTML = `<img src="${BALL_SPRITES.pokeball}">`;
  ball.style.left = startX + 'px';
  ball.style.top  = startY + 'px';
  viewport.appendChild(ball);

  globalThis.SFX.play('ballThrow');
  requestAnimationFrame(() => {
    ball.style.transition = 'left .35s ease-out, top .35s ease-in';
    ball.style.left = targetX + 'px';
    ball.style.top  = targetY + 'px';
  });

  setTimeout(() => {
    ball.remove();
    const state   = globalThis.state;
    // pokeball = ressource unique ; agent.ball = skin cosmétique
    const usedBall  = agent.ball || 'pokeball'; // pour l'historique
    const prevBall  = state.activeBall;
    state.activeBall = usedBall; // temporairement pour que tryCapture log le bon skin
    globalThis._agentCaptureCtx = { agentName: agent.name, ball: usedBall, zoneId };
    const caught = globalThis.tryCapture(zoneId, spawnObj.species_en);
    globalThis._agentCaptureCtx = null;
    state.activeBall = prevBall;
    if (caught) {
      if (agent.level >= 20 && caught.potential < 3 && Math.random() < agent.level / 100) {
        caught.potential = globalThis.randInt(3, 5);
        caught.stats = globalThis.calculateStats(caught);
      }
      _autoSellCaptured(caught);
      globalThis.showCaptureBurst(viewport, targetX, targetY, caught.potential, caught.shiny);
      grantAgentXP(agent, captureXP(caught.species_en, caught.potential, caught.shiny));
      const cName   = globalThis.speciesName(caught.species_en);
      const cStars  = '★'.repeat(caught.potential || 0) + '☆'.repeat(5 - (caught.potential || 0));
      const cRarity = SPECIES_BY_EN[caught.species_en]?.rarity;
      const zoneName = ZONE_BY_ID?.[zoneId]?.fr || zoneId;
      const ballName = globalThis.BALLS?.[usedBall]?.fr || usedBall;
      if (caught.shiny) {
        globalThis.notify(`✨ ${agent.name} — SHINY ! ${cName} ${cStars} ✨`, 'gold');
      } else if (cRarity === 'legendary') {
        globalThis.notify(`🏆 ${agent.name} — LÉGENDAIRE ! ${cName} ${cStars}`, 'gold');
      } else if (cRarity === 'very_rare') {
        globalThis.notify(`⭐ ${agent.name} — Très rare ! ${cName} ${cStars}`, 'gold');
      }
      globalThis.addLog(globalThis.t('agent_catch', { agent: agent.name, pokemon: cName }));
      globalThis.pushFeedEvent({
        category: 'capture',
        title:    `${cName}${caught.shiny ? ' ✨' : ''} — ${cStars}`,
        detail:   `${agent.name} · ${zoneName} · ${ballName}`,
        win: true,
        species_en: caught.species_en,
        level:      caught.level,
        potential:  caught.potential,
        shiny:      caught.shiny,
        byAgent:    agent.name,
        zone:       zoneName,
        ball:       ballName,
      });
      globalThis.removeSpawn(zoneId, spawnObj.id);
      globalThis.updateTopBar();
      globalThis.updateZoneTimers(zoneId);
    } else {
      spawnEl.classList.remove('catching');
      spawnObj._agentClaimed = false;
    }
  }, 380);
}

// Agent auto-fights a trainer
function agentAutoCombat(zoneId, spawnObj, agent) {
  if (globalThis.currentCombat) { spawnObj._agentClaimed = false; return; }
  const isRaid = spawnObj.type === 'raid' || spawnObj.isRaid;
  const combatAgents = _zoneCombatAgents(zoneId, { isRaid, preferredAgent: agent });
  if (combatAgents.length === 0) { spawnObj._agentClaimed = false; return; }

  const _win = document.getElementById(`zw-${zoneId}`);
  const _vp  = _win?.querySelector('.zone-viewport');
  const _el  = _vp?.querySelector(`[data-spawn-id="${spawnObj.id}"]`);
  if (_el) globalThis._addVSBadge(_el);

  setTimeout(() => {
    if (globalThis.currentCombat) { spawnObj._agentClaimed = false; return; }
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

// ── Déverrouillage d'un agent bloqué (slot 6+) ───────────────────
function getAgentUnlockCost(agentIndex) {
  return _agentCostAtIndex(agentIndex);
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

// ── Rattrapage des ticks agents quand le joueur revient ──────────
document.addEventListener('visibilitychange', () => {
  if (document.hidden || _hiddenAgentTicks === 0) return;
  // Cap volontaire à 30 ticks : évite un freeze UI si l'onglet est resté
  // masqué très longtemps. Le rattrapage long terme est géré par
  // offlineCatchup.js au boot (rejoignez l'état après une vraie absence).
  const toProcess = Math.min(_hiddenAgentTicks, 30);
  _hiddenAgentTicks = 0;
  const state = globalThis.state;
  if (!state?.settings?.autoCombat) return;
  for (let i = 0; i < toProcess; i++) {
    for (const agent of state.agents) {
      if (agent.assignedZone && !globalThis.openZones?.has(agent.assignedZone)) {
        globalThis.resolveBackgroundSpawnForZone?.(agent.assignedZone);
      }
    }
  }
  globalThis.updateTopBar?.();
  if (globalThis.activeTab === 'tabGang') globalThis.renderGangTab?.();
});

Object.assign(globalThis, {
  getAgentTeamSlots,
  isZoneContested,
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
});

export {};
