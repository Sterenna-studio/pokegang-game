// ════════════════════════════════════════════════════════════════
//  AGENT MODULE
//  Extracted from app.js
// ════════════════════════════════════════════════════════════════

// Exponential cost scaling: 5k → 20k → 80k → 320k → 1.28M → …
function getAgentRecruitCost() {
  const state = globalThis.state;
  const n = state.agents.length;
  const base = Math.round(5000 * Math.pow(4, n));
  // Au-dessus de 1M : palier linéaire = N millions (N = nb agents actuels)
  return base > 1_000_000 ? n * 1_000_000 : base;
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
    stats: {
      capture: globalThis.randInt(3, 18),
      combat: globalThis.randInt(3, 18),
      luck: globalThis.randInt(1, 12),
    },
    personality,
    team: [],
    assignedZone: null,
    notifyCaptures: true,
    perkLevels: [],
    pendingPerk: false,
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

  const TITLE_FR = { grunt:'Grunt', sergent:'Sergent', lieutenant:'Lieutenant', commandant:'Commandant', elite:'Élite', general:'Général' };
  function statBar(val, max = 20) {
    const pct = Math.round(Math.min(val / max, 1) * 100);
    return `<div style="height:4px;background:var(--bg);border-radius:2px;width:80px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--gold)"></div></div>`;
  }

  const cardsHtml = candidates.map((ag, i) => `
    <div class="recruit-card" data-idx="${i}" style="
      flex:1;min-width:140px;max-width:190px;
      background:var(--bg-card);border:1px solid var(--border);
      border-radius:var(--radius);padding:12px 10px;
      display:flex;flex-direction:column;align-items:center;gap:8px;
      cursor:pointer;transition:border-color .15s,box-shadow .15s">
      <img src="${ag.sprite}" style="width:48px;height:48px;image-rendering:pixelated">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--text);text-align:center">${ag.name}</div>
      <div style="font-size:8px;color:var(--text-dim)">${ag.personality.map(p => p.fr || p).join(' · ')}</div>
      <div style="display:flex;flex-direction:column;gap:4px;width:100%;margin-top:2px">
        <div style="display:flex;justify-content:space-between;align-items:center;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">
          <span>ATK</span>${statBar(ag.stats.combat)}
          <span style="color:var(--text)">${ag.stats.combat}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">
          <span>CAP</span>${statBar(ag.stats.capture)}
          <span style="color:var(--text)">${ag.stats.capture}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">
          <span>LCK</span>${statBar(ag.stats.luck, 12)}
          <span style="color:var(--text)">${ag.stats.luck}</span>
        </div>
      </div>
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
}

function grantAgentXP(agent, amount) {
  agent.xp += amount;
  const needed = agent.level * 30;
  while (agent.xp >= needed && agent.level < 100) {
    agent.xp -= needed;
    agent.level++;
    if (agent.level % 5 === 0) {
      agent.pendingPerk = true;
      globalThis.notify(`${agent.name} a gagne un perk ! (Lv.${agent.level})`, 'gold');
    }
  }
  checkPromotion(agent);
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

function getAgentCombatPower(agent) {
  const state = globalThis.state;
  const TITLE_BONUSES = globalThis.TITLE_BONUSES;
  const bonus = 1 + (TITLE_BONUSES[agent.title] || 0);
  let teamPower = 0;
  for (const pkId of agent.team) {
    const p = state.pokemons.find(pk => pk.id === pkId);
    if (p) teamPower += globalThis.getPokemonPower(p);
  }
  return Math.round((agent.stats.combat * 10 + teamPower) * bonus);
}

// ── Passive agent tick (background, no open window needed) ───────
// Runs every ~10s and simulates agent activity for closed zones
function passiveAgentTick() {
  const state = globalThis.state;
  if (!state.settings.autoCombat) return;
  let changed = false;
  const now = Date.now();
  const openZones = globalThis.openZones;
  const ZONE_BY_ID = globalThis.ZONE_BY_ID;
  if (!openZones || !ZONE_BY_ID) return; // pas encore initialisé

  for (const agent of state.agents) {
    if (!agent.assignedZone) continue;
    const zoneId = agent.assignedZone;
    // Skip zones already handled by the visual tick this frame
    if (openZones.has(zoneId)) continue;

    const zone = ZONE_BY_ID[zoneId];
    if (!zone || zone.spawnRate === 0) continue;

    // Chance to act this tick (proportional to agent capture stat)
    const actChance = 0.4 + agent.stats.capture / 100;
    if (Math.random() > actChance) continue;

    // Roll what would spawn
    const entry = globalThis.spawnInZone(zoneId);
    if (!entry) continue;

    if (entry.type === 'pokemon') {
      // Agent captures silently
      const ball = 'pokeball';
      if ((state.inventory[ball] || 0) <= 0) continue;
      const pokemon = globalThis.makePokemon(entry.species_en, zoneId, ball);
      if (!pokemon) continue;
      // Crit de capture : basé sur la stat CAP de l'agent
      const agentCritChance = (agent.stats.capture || 0) / 100;
      if (Math.random() < agentCritChance) {
        pokemon.potential = Math.min(5, (pokemon.potential || 1) + 1);
        if (agent.notifyCaptures) globalThis.notify(`★ ${agent.name} — Capture critique ! ★`, 'gold');
      }
      state.inventory[ball]--;
      state.pokemons.push(pokemon);
      state.stats.totalCaught++;
      if (!state.pokedex[pokemon.species_en]) {
        state.pokedex[pokemon.species_en] = { seen: true, caught: true, shiny: pokemon.shiny, count: 1 };
        state.stats.dexCaught = (state.stats.dexCaught || 0) + 1;
      } else {
        state.pokedex[pokemon.species_en].caught = true;
        state.pokedex[pokemon.species_en].count++;
        if (pokemon.shiny) state.pokedex[pokemon.species_en].shiny = true;
      }
      if (pokemon.shiny) state.stats.shinyCaught++;
      grantAgentXP(agent, 5);
      const name = globalThis.speciesName(pokemon.species_en);
      const stars = '★'.repeat(pokemon.potential);
      if (agent.notifyCaptures) {
        globalThis.notify(`👤 ${agent.name} → ${name} ${stars}${pokemon.shiny ? ' ✨' : ''}`, pokemon.shiny ? 'gold' : 'success');
      }
      globalThis.addLog(globalThis.t('agent_catch', { agent: agent.name, pokemon: name }));
      changed = true;

    } else if (entry.type === 'trainer' || entry.type === 'raid') {
      // Agent auto-fights (raids are tougher — need zone group power)
      const agentPower = entry.type === 'raid'
        ? state.agents.filter(a => a.assignedZone === zoneId).reduce((s, a) => s + getAgentCombatPower(a), 0)
        : getAgentCombatPower(agent);
      let enemyPower = 0;
      for (const t of entry.team) enemyPower += (t.stats.atk + t.stats.def + t.stats.spd);
      const pRoll = agentPower * (0.8 + Math.random() * 0.4);
      const eRoll = enemyPower * (0.8 + Math.random() * 0.4);
      const win = pRoll >= eRoll;
      if (win) {
        const reward = Math.min(globalThis.MAX_COMBAT_REWARD, globalThis.randInt(entry.trainer.reward[0], entry.trainer.reward[1]));
        const repGain = globalThis.getCombatRepGain(entry.trainerKey || entry.trainer?.sprite, true);
        // Accumulate in zone instead of direct payment
        const zs = globalThis.initZone(zoneId);
        zs.pendingIncome = (zs.pendingIncome || 0) + reward;
        state.stats.totalMoneyEarned += reward;
        state.gang.reputation += repGain;
        state.stats.totalFights++;
        state.stats.totalFightsWon++;
        agent.combatsWon = (agent.combatsWon || 0) + 1;
        if (entry.trainerKey === 'rocketgrunt' || entry.trainerKey === 'rocketgruntf' || entry.trainerKey === 'giovanni') {
          state.stats.rocketDefeated++;
        }
        if (entry.trainerKey === 'blue') {
          state.stats.blueDefeated = (state.stats.blueDefeated || 0) + 1;
        }
        const xpEach = Math.round((10 + entry.trainer.diff * 5) * 0.75);
        grantAgentXP(agent, xpEach);
        for (const pkId of agent.team) {
          const p = state.pokemons.find(pk => pk.id === pkId);
          if (p) globalThis.levelUpPokemon(p, xpEach);
        }
        // Zone combats counter
        zs.combatsWon = (zs.combatsWon || 0) + 1;
        if (agent.notifyCaptures) {
          globalThis.notify(`[WIN] ${agent.name} +${reward}P`, 'success');
        }
        globalThis.addLog(globalThis.t('agent_win', { agent: agent.name }));
        globalThis.addBattleLogEntry({
          ts: Date.now(),
          zoneName: `[Agent] ${agent.name} — ${ZONE_BY_ID[zoneId]?.fr || zoneId}`,
          win: true,
          reward: reward,
          repGain: repGain,
          lines: [`${agent.name} a battu un dresseur. +${reward}₽ +${repGain}rep`],
          trainerKey: entry.trainerKey,
          isAgent: true,
        });
      } else {
        state.stats.totalFights++;
        state.gang.reputation = Math.max(0, state.gang.reputation - 5);
        if (agent.notifyCaptures) globalThis.notify(`[KO] ${agent.name} defaite...`);
        globalThis.addLog(globalThis.t('agent_lose', { agent: agent.name }));
        globalThis.addBattleLogEntry({
          ts: Date.now(),
          zoneName: `[Agent] ${agent.name} — ${ZONE_BY_ID[zoneId]?.fr || zoneId}`,
          win: false,
          reward: 0,
          repGain: 0,
          lines: [`${agent.name} a perdu un combat.`],
          trainerKey: entry.trainerKey,
          isAgent: true,
        });
      }
      changed = true;

    } else if (entry.type === 'chest') {
      state.stats.chestsOpened = (state.stats.chestsOpened || 0) + 1;
      const loot = globalThis.rollChestLoot(zoneId, true);
      if (agent.notifyCaptures) globalThis.notify(`📦 ${agent.name} — ${loot.msg}`, loot.type);
      changed = true;
    }
  }

  // Auto gym raid: for each city zone with gymLeader, if cooldown passed + agent assigned + 1 manual win
  const raidCooldownMs = 5 * 60 * 1000;
  const checkedRaidZones = new Set();
  for (const agent of state.agents) {
    if (!agent.assignedZone) continue;
    const zid = agent.assignedZone;
    if (checkedRaidZones.has(zid)) continue;
    if (openZones.has(zid)) continue;
    const raidZone = ZONE_BY_ID[zid];
    if (!raidZone || raidZone.type !== 'city' || !raidZone.gymLeader) continue;
    const rzs = state.zones[zid];
    if (!rzs || !rzs.gymDefeated) continue; // need at least 1 manual win
    if ((rzs.combatsWon || 0) < 10) continue;
    if (Date.now() - (rzs.gymRaidLastFight || 0) < raidCooldownMs) continue;
    checkedRaidZones.add(zid);
    if (globalThis.triggerGymRaid(zid, true)) changed = true;
  }

  if (changed) {
    globalThis.saveState();
    globalThis.updateTopBar();
    // Agent capture: only refresh grid (not full rebuild) to avoid resetting pcSelectedId / view state
    if (globalThis.activeTab === 'tabPC') {
      if (globalThis.pcView === 'grid') globalThis.renderPokemonGrid();
      else if (globalThis.pcView === 'eggs') { const el = document.getElementById('eggsInPC'); if (el) globalThis.renderEggsView(el); }
      // Update eggs button count
      const eggsBtn = document.getElementById('pcBtnEggs');
      if (eggsBtn) eggsBtn.textContent = `[OEUFS${state.eggs.length ? ` (${state.eggs.length})` : ''}]`;
    }
    if (globalThis.activeTab === 'tabGang') globalThis.renderGangTab();
  }
}

// Agent automation tick — agents interact with VISIBLE spawns in zone windows
function agentTick() {
  const state = globalThis.state;
  if (!state.settings.autoCombat) return; // auto-combat off = agents idle
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
    // Chance to act this tick based on agent capture stat (higher = more active)
    const actChance = 0.5 + agent.stats.capture / 60;
    if (Math.random() > actChance) continue;

    // Priority: raids > trainers > pokemon > chests
    const trainerSpawn = spawns.find(s => (s.type === 'trainer' || s.type === 'raid') && !s._agentClaimed);
    const pokemonSpawn = spawns.find(s => s.type === 'pokemon' && !s._agentClaimed && !s.playerCatching);
    const chestSpawn = spawns.find(s => s.type === 'chest' && !s._agentClaimed);

    if (trainerSpawn) {
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

  // Find agent sprite position in zone
  const agentEls = viewport.querySelectorAll('.zone-agent');
  let agentEl = null;
  for (const el of agentEls) {
    const label = el.querySelector('.agent-label');
    if (label && label.textContent === agent.name) { agentEl = el; break; }
  }
  let startX = 40, startY = 150;
  if (agentEl) {
    const r = agentEl.getBoundingClientRect();
    const wr = viewport.getBoundingClientRect();
    startX = r.left - wr.left + r.width / 2;
    startY = r.top - wr.top;
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
    // Try capture using tryCapture (uses balls from inventory)
    const caught = globalThis.tryCapture(zoneId, spawnObj.species_en);
    if (caught) {
      // Luck reroll for agents
      if (agent.stats.luck > 8 && caught.potential < 3 && Math.random() < 0.3) {
        caught.potential = globalThis.randInt(3, 5);
        caught.stats = globalThis.calculateStats(caught);
      }
      globalThis.showCaptureBurst(viewport, targetX, targetY, caught.potential, caught.shiny);
      grantAgentXP(agent, 2);
      if (agent.notifyCaptures !== false) {
        globalThis.notify(globalThis.t('agent_catch', { agent: agent.name, pokemon: globalThis.speciesName(spawnObj.species_en) }), 'success');
      }
      globalThis.addLog(globalThis.t('agent_catch', { agent: agent.name, pokemon: globalThis.speciesName(spawnObj.species_en) }));
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

// Agent auto-fights a trainer — opens inline combat and auto-executes
function agentAutoCombat(zoneId, spawnObj, agent) {
  // Don't start if a combat is already running
  if (globalThis.currentCombat) return;
  // Show VS badge on the spawn element
  const _win = document.getElementById(`zw-${zoneId}`);
  const _vp  = _win?.querySelector('.zone-viewport');
  const _el  = _vp?.querySelector(`[data-spawn-id="${spawnObj.id}"]`);
  if (_el) globalThis._addVSBadge(_el);
  // Open combat popup (same as player click)
  globalThis.openCombatPopup(zoneId, spawnObj);
  // Auto-execute after a brief delay so the player can see it
  setTimeout(() => {
    if (!globalThis.currentCombat) return;
    globalThis.executeCombat();
    // Auto-close after showing result
    setTimeout(() => {
      const arena = document.getElementById('battleArena');
      if (arena && arena.classList.contains('active')) {
        globalThis.closeCombatPopup();
        globalThis.removeSpawn(zoneId, spawnObj.id);
        globalThis.updateTopBar();
        if (globalThis.activeTab === 'tabGang') globalThis.renderGangTab();
      }
    }, 1500);
  }, 800);
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

Object.assign(globalThis, {
  getAgentRecruitCost,
  rollNewAgent,
  recruitAgent,
  openAgentRecruitModal,
  assignAgentToZone,
  grantAgentXP,
  checkPromotion,
  getAgentRankLabel,
  getAgentCombatPower,
  passiveAgentTick,
  agentTick,
  agentCaptureVisibleSpawn,
  agentAutoCombat,
  agentOpenChest,
});

export {};
