'use strict';

// ════════════════════════════════════════════════════════════════
//  ZONE COMBAT MODULE — trainer vs gang resolution
//  Pure resolution: no DOM access and no state mutation.
// ════════════════════════════════════════════════════════════════
//
//  Dependencies from app.js are read through globalThis, with an optional
//  configure hook for focused tests. Classic-script data such as SPECIES_BY_EN
//  is accessed by bare name to match the rest of this codebase.
// ════════════════════════════════════════════════════════════════

const ZONE_AGENT_SLOTS = 3;
const ZONE_BOSS_TEAM_SLOTS = 3;

const TRAINER_TYPE_MULTIPLIERS = {
  normal: 1,
  elite: 1.20,
  special: 1.25,
  gym: 1.30,
  raid: 1.35,
  gymRaid: 1.45,
};

let _ctx = {};

export function configureZoneCombat(ctx = {}) {
  _ctx = { ..._ctx, ...ctx };
}

function getState() {
  return _ctx.getState?.() ?? globalThis.state ?? {};
}

function getRandom() {
  return _ctx.random?.() ?? Math.random();
}

function getPokemonPower(pokemon) {
  return _ctx.getPokemonPower?.(pokemon)
    ?? globalThis.getPokemonPower?.(pokemon)
    ?? fallbackStoredPokemonPower(pokemon);
}

function getTeamPower(pokemonIds = [], state = getState()) {
  if (_ctx.getTeamPower) return _ctx.getTeamPower(pokemonIds);
  if (globalThis.getTeamPower) return globalThis.getTeamPower(pokemonIds);
  return pokemonIds.reduce((sum, id) => {
    const pokemon = state.pokemons?.find(pk => pk.id === id);
    return sum + (pokemon ? getPokemonPower(pokemon) : 0);
  }, 0);
}

function fallbackStoredPokemonPower(pokemon) {
  if (!pokemon) return 0;
  const stats = pokemon.stats ?? {};
  return Math.round((stats.atk ?? 0) + (stats.def ?? 0) + (stats.spd ?? 0));
}

function speciesMap() {
  return typeof SPECIES_BY_EN !== 'undefined' ? SPECIES_BY_EN : {};
}

function trainerPokemonPower(pokemon) {
  if (!pokemon) return 0;
  const species = speciesMap()[pokemon.species_en] ?? {};
  const atk = species.baseAtk ?? pokemon.stats?.atk ?? 50;
  const def = species.baseDef ?? pokemon.stats?.def ?? 50;
  const spd = species.baseSpd ?? pokemon.stats?.spd ?? 50;
  const level = pokemon.level ?? 1;
  return Math.round(level * ((atk + def + spd) / 3));
}

function trainerTypeForSpawn(spawn) {
  if (spawn?.trainerType && TRAINER_TYPE_MULTIPLIERS[spawn.trainerType]) return spawn.trainerType;
  if (spawn?.isGymRaid) return 'gymRaid';
  if (spawn?.isRaid || spawn?.type === 'raid') return 'raid';
  if (spawn?.isSpecial) return 'special';
  if (spawn?.elite) return 'elite';

  const zone = typeof ZONE_BY_ID !== 'undefined' && spawn?.zoneId ? ZONE_BY_ID[spawn.zoneId] : null;
  if (zone?.gymLeader && spawn?.trainerKey === zone.gymLeader) return 'gym';

  const diff = spawn?.trainer?.diff ?? 0;
  if (diff >= 6) return 'elite';
  return 'normal';
}

function trainerTypeMultiplier(spawn) {
  return TRAINER_TYPE_MULTIPLIERS[trainerTypeForSpawn(spawn)] ?? 1;
}

function trainerName(trainer, key = 'trainer') {
  return trainer?.fr ?? trainer?.en ?? key ?? 'Dresseur';
}

function trainerPokemonSummary(pokemon, multiplier = 1) {
  return {
    species_en: pokemon?.species_en ?? null,
    level: pokemon?.level ?? 1,
    shiny: pokemon?.shiny ?? false,
    power: Math.round(trainerPokemonPower(pokemon) * multiplier),
  };
}

function trainerTeamPower(team = [], multiplier = 1) {
  return Math.round(
    team.filter(Boolean).reduce((sum, pokemon) => sum + trainerPokemonPower(pokemon), 0) * multiplier,
  );
}

function trainerPokemonEntries(spawn) {
  if ((spawn?.isRaid || spawn?.type === 'raid') && Array.isArray(spawn.raidTrainers) && spawn.raidTrainers.length) {
    return spawn.raidTrainers.flatMap((entry, trainerIdx) =>
      (entry.team || []).filter(Boolean).map((pokemon, pokemonIdx) => ({
        pokemon,
        trainerKey: entry.key ?? spawn.trainerKey ?? `raid-${trainerIdx}`,
        trainerName: trainerName(entry.trainer, entry.key),
        index: pokemonIdx,
      })),
    );
  }

  return (spawn?.team || []).filter(Boolean).map((pokemon, index) => ({
    pokemon,
    trainerKey: spawn?.trainerKey ?? 'trainer',
    trainerName: trainerName(spawn?.trainer, spawn?.trainerKey),
    index,
  }));
}

function defenderPokemonName(pokemon) {
  if (!pokemon?.species_en) return 'Pokémon';
  return globalThis.speciesName?.(pokemon.species_en) ?? pokemon.species_en;
}

function buildTrainerDefenders(spawn) {
  const multiplier = trainerTypeMultiplier(spawn);
  const type = trainerTypeForSpawn(spawn);

  return trainerPokemonEntries(spawn).slice(0, ZONE_AGENT_SLOTS).map((entry, idx) => {
    const summary = trainerPokemonSummary(entry.pokemon, multiplier);
    return {
      id: `${entry.trainerKey}-${entry.index}-${idx}`,
      key: entry.trainerKey,
      name: defenderPokemonName(entry.pokemon),
      trainerName: entry.trainerName,
      trainerType: type,
      typeMultiplier: multiplier,
      team: [summary],
      pokemon: summary,
      power: summary.power,
    };
  });
}

function allTrainerPokemon(spawn) {
  return trainerPokemonEntries(spawn).map(entry => entry.pokemon).filter(Boolean);
}

function agentTeamPower(agent, state = getState()) {
  return (agent?.team || []).reduce((sum, pokemonId) => {
    const pokemon = state.pokemons?.find(pk => pk.id === pokemonId);
    return sum + (pokemon ? getPokemonPower(pokemon) : 0);
  }, 0);
}

function agentPower(agent, teamPower = 0) {
  if (!agent) return 0;
  const bonuses = globalThis.TITLE_BONUSES ?? {};
  const titleBonus = 1 + (bonuses[agent.title] || 0);
  const combatStat = agent.stats?.combat ?? 0;
  return Math.round((combatStat * 10 + teamPower) * titleBonus);
}

function sortedAgentsByPower(state = getState()) {
  return [...(state.agents || [])].sort((a, b) => {
    const levelDiff = (b.level ?? 1) - (a.level ?? 1);
    if (levelDiff !== 0) return levelDiff;
    return agentPower(b, agentTeamPower(b, state)) - agentPower(a, agentTeamPower(a, state));
  });
}

function attackAgentSnapshots(agentIds = null, state = getState()) {
  const ids = Array.isArray(agentIds) ? agentIds.filter(Boolean).slice(0, ZONE_AGENT_SLOTS) : [];
  const agents = ids.length
    ? ids.map(id => state.agents?.find(agent => agent.id === id)).filter(Boolean)
    : sortedAgentsByPower(state).slice(0, ZONE_AGENT_SLOTS);

  return agents.map(agent => {
    const teamPower = agentTeamPower(agent, state);
    return {
      id: agent.id,
      name: agent.name,
      sprite: agent.spriteKey ?? '',
      level: agent.level ?? 1,
      title: agent.title ?? 'grunt',
      stats: { combat: agent.stats?.combat ?? 0 },
      teamPower,
      power: agentPower(agent, teamPower),
      team: (agent.team || [])
        .map(id => state.pokemons?.find(pokemon => pokemon.id === id))
        .filter(Boolean)
        .map(pokemon => ({
          species_en: pokemon.species_en,
          level: pokemon.level,
          shiny: pokemon.shiny ?? false,
        })),
    };
  });
}

function agentSummary(agent) {
  return {
    id: agent?.id ?? null,
    name: agent?.name ?? 'Agent',
    sprite: agent?.sprite ?? '',
    level: agent?.level ?? 1,
    title: agent?.title ?? 'grunt',
    team: agent?.team ?? [],
  };
}

function defenderSummary(defender) {
  return {
    id: defender?.id ?? null,
    key: defender?.key ?? null,
    name: defender?.name ?? 'Dresseur',
    trainerType: defender?.trainerType ?? 'normal',
    typeMultiplier: defender?.typeMultiplier ?? 1,
    team: defender?.team ?? [],
  };
}

function rollCombat(attackerPower, defenderPower) {
  if (attackerPower <= 0 && defenderPower <= 0) {
    return { attackerWin: false, attackerRoll: 0, defenderRoll: 0 };
  }
  if (defenderPower <= 0) {
    return { attackerWin: attackerPower > 0, attackerRoll: attackerPower, defenderRoll: 0 };
  }
  if (attackerPower <= 0) {
    return { attackerWin: false, attackerRoll: 0, defenderRoll: defenderPower };
  }

  const attackerRoll = attackerPower * (0.85 + getRandom() * 0.30);
  const defenderRoll = defenderPower * (0.85 + getRandom() * 0.30);
  return { attackerWin: attackerRoll >= defenderRoll, attackerRoll, defenderRoll };
}

function resolveAgentDuel(attacker, defender) {
  const attackerPower = Math.round(attacker?.power ?? 0);
  const defenderPower = Math.round(defender?.power ?? 0);
  const rolled = rollCombat(attackerPower, defenderPower);
  return {
    type: 'agent_trainer_duel',
    attacker: agentSummary(attacker),
    defender: defenderSummary(defender),
    attackerPower,
    defenderPower,
    attackerRoll: Math.round(rolled.attackerRoll),
    defenderRoll: Math.round(rolled.defenderRoll),
    attackerWin: rolled.attackerWin,
  };
}

function bossAttackPower(state, survivingAgents) {
  const bossTeamIds = (state.gang?.bossTeam || []).filter(Boolean).slice(0, ZONE_BOSS_TEAM_SLOTS);
  const bossTeamPower = getTeamPower(bossTeamIds, state);
  const playerStats = state.playerStats;
  const combatStat = (playerStats?.baseStats?.combat ?? 10) + (playerStats?.allocatedStats?.combat ?? 0);
  const survivingPower = survivingAgents.reduce((sum, agent) => sum + Math.round(agent?.power ?? 0), 0);
  return Math.round(bossTeamPower + survivingPower + combatStat * 10);
}

function attackerPreviewPower(agentIds = null, state = getState()) {
  const attackers = attackAgentSnapshots(agentIds, state);
  return bossAttackPower(state, attackers);
}

function defenderPreviewPower(spawn) {
  return Math.round(trainerTeamPower(allTrainerPokemon(spawn), trainerTypeMultiplier(spawn)));
}

export function getTrainerCombatPreview(trainerSpawn, agentIds = null) {
  const state = getState();
  return {
    attackerPower: attackerPreviewPower(agentIds, state),
    defenderPower: defenderPreviewPower(trainerSpawn),
    trainerType: trainerTypeForSpawn(trainerSpawn),
    trainerTypeMultiplier: trainerTypeMultiplier(trainerSpawn),
  };
}

export function resolveTrainerCombat(trainerSpawn, agentIds = null) {
  const state = getState();
  const attackers = attackAgentSnapshots(agentIds, state);
  const defenders = buildTrainerDefenders(trainerSpawn);
  const duels = [];
  let attackerIndex = 0;
  let defenderIndex = 0;

  while (attackerIndex < attackers.length && defenderIndex < defenders.length) {
    const duel = resolveAgentDuel(attackers[attackerIndex], defenders[defenderIndex]);
    duels.push(duel);
    if (duel.attackerWin) defenderIndex++;
    else attackerIndex++;
  }

  const survivingAttackers = attackers.slice(attackerIndex);
  const remainingDefenders = defenders.slice(defenderIndex);
  const trainerType = trainerTypeForSpawn(trainerSpawn);
  const trainerMultiplier = trainerTypeMultiplier(trainerSpawn);
  const finalTeam = allTrainerPokemon(trainerSpawn).slice(defenderIndex);
  let finalBattle = null;
  let attackerWin = false;

  if (defenderIndex >= defenders.length && survivingAttackers.length > 0) {
    const finalAttackerPower = bossAttackPower(state, survivingAttackers);
    const finalDefenderPower = trainerTeamPower(finalTeam, trainerMultiplier);
    const rolled = rollCombat(finalAttackerPower, finalDefenderPower);
    attackerWin = rolled.attackerWin;
    finalBattle = {
      type: 'boss_battle',
      attackerPower: finalAttackerPower,
      defenderPower: finalDefenderPower,
      attackerRoll: Math.round(rolled.attackerRoll),
      defenderRoll: Math.round(rolled.defenderRoll),
      attackerWin,
      survivingAttackers: survivingAttackers.map(agentSummary),
      defenderTeam: finalTeam.map(pokemon => trainerPokemonSummary(pokemon, trainerMultiplier)),
    };
  } else {
    finalBattle = {
      type: 'boss_battle',
      skipped: true,
      reason: attackers.length === 0 ? 'no_attackers' : 'attackers_defeated',
      remainingDefenders: remainingDefenders.map(defenderSummary),
    };
  }

  return {
    attackerWin,
    win: attackerWin,
    attackerPower: attackerPreviewPower(agentIds, state),
    defenderPower: defenderPreviewPower(trainerSpawn),
    trainerType,
    trainerTypeMultiplier: trainerMultiplier,
    attackers: attackers.map(agentSummary),
    defenders: defenders.map(defenderSummary),
    duels,
    finalBattle,
    remainingAttackers: survivingAttackers.map(agentSummary),
    remainingDefenders: remainingDefenders.map(defenderSummary),
  };
}
