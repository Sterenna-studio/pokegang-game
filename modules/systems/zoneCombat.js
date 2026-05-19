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

import { BOSS_TEAM_SLOTS } from '../../data/game-config-data.js';
import { getBossTeamPower } from './bossPower.js';
import {
  POWER_W_ATK, POWER_W_DEF, POWER_W_SPD,
  POWER_SOFT_CAP, POWER_SOFT_RATE,
} from '../../data/power-config-data.js';

const ZONE_AGENT_SLOTS     = 3;
const ZONE_BOSS_TEAM_SLOTS = BOSS_TEAM_SLOTS; // boss peut aligner toute son équipe

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

// ── Formule partagée (miroir de computePokemonPC dans pokemon.js) ─
// Dupliquée ici pour éviter une dépendance circulaire entre modules.
// Doit rester strictement identique aux constantes de power-config-data.js.
function _computePC(stats) {
  if (!stats) return 0;
  const raw = (stats.atk ?? 0) * POWER_W_ATK
            + (stats.def ?? 0) * POWER_W_DEF
            + (stats.spd ?? 0) * POWER_W_SPD;
  return raw <= POWER_SOFT_CAP
    ? raw
    : POWER_SOFT_CAP + (raw - POWER_SOFT_CAP) * POWER_SOFT_RATE;
}

function fallbackStoredPokemonPower(pokemon) {
  if (!pokemon) return 0;
  return Math.round(_computePC(pokemon.stats ?? {}));
}

function speciesMap() {
  return typeof SPECIES_BY_EN !== 'undefined' ? SPECIES_BY_EN : {};
}

function trainerPokemonPower(pokemon) {
  if (!pokemon) return 0;
  // Priorité aux stats pré-calculées (présentes sur tous les Pokémon générés par makeTrainerTeam).
  // Elles incluent déjà niveau, potentiel et statMult → même échelle que getPokemonPower.
  if (pokemon.stats?.atk !== undefined) {
    return Math.round(_computePC(pokemon.stats));
  }
  // Fallback : recalcul à partir des stats de base (même formule que calculateStats).
  const species = speciesMap()[pokemon.species_en] ?? {};
  const baseAtk = species.baseAtk ?? 50;
  const baseDef = species.baseDef ?? 50;
  const baseSpd = species.baseSpd ?? 50;
  const level   = pokemon.level ?? 1;
  const potMult = 1 + (pokemon.potential ?? 1) * 0.1;
  const lvlMult = 1 + level / 100;
  const stats = {
    atk: Math.round(baseAtk * potMult * lvlMult),
    def: Math.round(baseDef * potMult * lvlMult),
    spd: Math.round(baseSpd * potMult * lvlMult),
  };
  return Math.round(_computePC(stats));
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

function allTrainerPokemon(spawn) {
  return trainerPokemonEntries(spawn).map(entry => entry.pokemon).filter(Boolean);
}

function agentTeamPower(agent, state = getState()) {
  const slots = globalThis.getAgentTeamSlots?.(agent) ?? 3;
  return (agent?.team || []).slice(0, slots).reduce((sum, pokemonId) => {
    const pokemon = state.pokemons?.find(pk => pk.id === pokemonId);
    return sum + (pokemon ? getPokemonPower(pokemon) : 0);
  }, 0);
}

function agentPower(agent, teamPower = 0) {
  if (!agent) return 0;
  const bonuses = globalThis.TITLE_BONUSES ?? {};
  const rankMult = bonuses[agent.title] ?? 1.0;
  const combatStat = agent.stats?.combat ?? 0;
  return Math.round((combatStat * 10 + teamPower) * rankMult);
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
    const slots = globalThis.getAgentTeamSlots?.(agent) ?? 3;
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
      team: (agent.team || []).slice(0, slots)
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

// Puissance totale côté attaquant : boss (si dans la zone) + agents.
// zoneId=null → preview UI, boss toujours inclus.
// zoneId fourni → boss inclus seulement si state.gang.bossZone === zoneId.
function totalAttackerPower(agentIds = null, state = getState(), zoneId = null) {
  const bossInZone = zoneId === null || state.gang?.bossZone === zoneId;
  let bossTeamPow = 0;
  if (bossInZone) {
    bossTeamPow = getBossTeamPower(state);
  }
  const attackers = attackAgentSnapshots(agentIds, state);
  const agentsPow = attackers.reduce((sum, a) => sum + Math.round(a.power ?? 0), 0);
  return { total: Math.round(bossTeamPow + agentsPow), bossPow: Math.round(bossTeamPow), agentsPow: Math.round(agentsPow), attackers };
}

function attackerPreviewPower(agentIds = null, state = getState()) {
  return totalAttackerPower(agentIds, state, null).total;
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

// ── Combat simplifié ─────────────────────────────────────────────────────────
// Modèle : boss + agents (puissance totale additionnée d'emblée) vs dresseur.
// Un seul jet — pas de duels individuels.
// Grade de l'agent → nombre de Pokémon équipables (grunt:1 … général:6).
export function resolveTrainerCombat(trainerSpawn, agentIds = null) {
  const state = getState();

  // ── Côté attaquant : boss (si dans la zone) + agents ──────────
  const { total: atkTotal, bossPow, agentsPow, attackers } = totalAttackerPower(agentIds, state, trainerSpawn?.zoneId ?? null);

  // ── Côté défenseur : Pokémon du dresseur ───────────────────────
  const trainerType       = trainerTypeForSpawn(trainerSpawn);
  const trainerMultiplier = trainerTypeMultiplier(trainerSpawn);
  const allPk             = allTrainerPokemon(trainerSpawn);
  const defTotal          = Math.round(trainerTeamPower(allPk, trainerMultiplier));

  const rolled      = rollCombat(atkTotal, defTotal);
  const attackerWin = rolled.attackerWin;

  return {
    attackerWin,
    win:                   attackerWin,
    attackerPower:         atkTotal,
    defenderPower:         defTotal,
    bossTeamPower:         bossPow,
    agentsPower:           agentsPow,
    trainerType,
    trainerTypeMultiplier: trainerMultiplier,
    attackers:             attackers.map(agentSummary),
    defenders:             [],
    duels:                 [], // simplifié : plus de duels individuels
    finalBattle:           null,
    remainingAttackers:    [],
    remainingDefenders:    [],
  };
}
