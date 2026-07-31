'use strict';

// ════════════════════════════════════════════════════════════════
//  QUEST COMBAT MODULE — vrai combat pokémon-par-pokémon pour les
//  affrontements de quête (dresseurs de quête + légendaires).
//
//  Remplace le jet de probabilité de specialCombat.js par le moteur
//  tour-par-tour partagé (eventCombat.js), avec un mécanisme
//  d'affaiblissement : envoyer un agent contre l'adversaire réduit
//  ses stats de combat (weakenPct, cumulatif, plafonné) pour la
//  tentative suivante — agent ou confrontation finale du boss.
//
//  Résolution pure : pas d'accès DOM. state est lu/écrit uniquement
//  pour : les Pokémon du joueur (state.pokemons), l'équipe du boss
//  (state.gang.bossTeam) et le coût d'énergie d'un agent en cas de
//  défaite (même patron que agent.js:658-677).
//
//  Globals lus via globalThis : calculateStats, getAgentTeamSlots
// ════════════════════════════════════════════════════════════════

import { resolveEventBattle } from './eventCombat.js';
import { AGENT_PRISON_MS } from '../../data/gameplay-config-data.js';

// Affaiblissement cumulatif max : l'adversaire ne descend jamais sous 40% de
// ses stats de base, quel que soit le nombre d'agents envoyés.
const MAX_WEAKEN = 0.6;
// Gain d'affaiblissement par tentative — plus généreux sur une victoire de
// l'agent (il a fait mal) que sur une défaite (il a quand même mordu dedans).
const WEAKEN_GAIN_ON_WIN  = 0.22;
const WEAKEN_GAIN_ON_LOSS = 0.09;
// Coût en énergie d'un agent qui perd face à un adversaire de quête — même
// valeur que le combat de zone en tier élevé (agent.js:662).
const AGENT_LOSS_ENERGY_COST = 3;

function _state() {
  return globalThis.state ?? null;
}

/** Construit un combattant de quête à partir d'une espèce/niveau + un
 *  multiplicateur de stats (buff "combat spécial" et/ou malus d'affaiblissement
 *  cumulé) — même patron que le statMult de makeTrainerTeam (zoneSystem.js). */
function buildQuestCombatant({ species_en, level, potential = 3, nature = 'hardy' }, statMult = 1) {
  const stats = globalThis.calculateStats?.({ species_en, level, nature, potential }) ?? { atk: 10, def: 10, spd: 10 };
  if (statMult !== 1) {
    stats.atk = Math.max(1, Math.round(stats.atk * statMult));
    stats.def = Math.max(1, Math.round(stats.def * statMult));
    stats.spd = Math.max(1, Math.round(stats.spd * statMult));
  }
  return { species_en, level, stats };
}

/** team: [{species_en, level, potential?, nature?}] — config d'un dresseur/
 *  légendaire de quête. baseStatMult : buff fixe de difficulté (ex. le
 *  légendaire final, "combat spécial"). weakenPct : malus additionnel courant. */
function buildOpponentTeam(team = [], baseStatMult = 1, weakenPct = 0) {
  const statMult = baseStatMult * (1 - Math.min(MAX_WEAKEN, weakenPct || 0));
  return team.map(member => buildQuestCombatant(member, statMult));
}

function buildAgentTeam(agent, state) {
  const slots = globalThis.getAgentTeamSlots?.(agent) ?? 3;
  return (agent.team || []).slice(0, slots)
    .map(id => state.pokemons.find(p => p.id === id))
    .filter(Boolean);
}

function buildBossTeam(state) {
  return (state.gang?.bossTeam || [])
    .map(id => state.pokemons.find(p => p.id === id))
    .filter(Boolean);
}

/** État d'affaiblissement par défaut à stocker sur l'objet de quête
 *  (ex. state.birdsMission.articuno.encounter). */
export function defaultEncounterState() {
  return { weakenPct: 0, attempts: 0 };
}

/**
 * Envoie un agent combattre l'adversaire de quête. Modifie encounterState
 * (weakenPct/attempts) et l'agent (energy/resting) en place ; l'appelant est
 * responsable de saveState()/markDirty().
 *
 * @returns {{ error }|{ battle, playerTeam, agentWon, weakenPct, imprisoned }}
 */
export function runAgentWeakenAttempt({ agent, opponentTeam, baseStatMult = 1, encounterState, state = _state() }) {
  if (!state || !agent) return { error: 'no_state' };
  if (agent.resting) return { error: 'agent_resting' };
  const playerTeam = buildAgentTeam(agent, state);
  if (playerTeam.length === 0) return { error: 'no_team' };

  const enemyTeam = buildOpponentTeam(opponentTeam, baseStatMult, encounterState.weakenPct);
  const battle = resolveEventBattle({ playerTeam, enemyTeam });

  encounterState.attempts = (encounterState.attempts || 0) + 1;
  encounterState.weakenPct = Math.min(
    MAX_WEAKEN,
    (encounterState.weakenPct || 0) + (battle.win ? WEAKEN_GAIN_ON_WIN : WEAKEN_GAIN_ON_LOSS),
  );

  let imprisoned = false;
  if (!battle.win) {
    agent.energy = Math.max(0, (agent.energy ?? 10) - AGENT_LOSS_ENERGY_COST);
    if (agent.energy === 0) {
      agent.resting = true;
      agent.restUntil = Date.now() + AGENT_PRISON_MS;
      imprisoned = true;
    }
  }

  return { battle, playerTeam, agentWon: battle.win, weakenPct: encounterState.weakenPct, imprisoned };
}

/**
 * Affronte directement l'adversaire de quête avec l'équipe du boss.
 * Ne modifie pas encounterState (c'est la tentative finale) — l'appelant
 * décide de la suite (capture, défaite du dresseur, etc.) selon `battle.win`.
 *
 * @returns {{ error }|{ battle, playerTeam, win, weakenPctAtStart }}
 */
export function runFinalConfrontation({ opponentTeam, baseStatMult = 1, encounterState, state = _state() }) {
  if (!state) return { error: 'no_state' };
  const playerTeam = buildBossTeam(state);
  if (playerTeam.length === 0) return { error: 'no_boss_team' };

  const weakenPctAtStart = encounterState?.weakenPct || 0;
  const enemyTeam = buildOpponentTeam(opponentTeam, baseStatMult, weakenPctAtStart);
  const battle = resolveEventBattle({ playerTeam, enemyTeam });

  return { battle, playerTeam, win: battle.win, weakenPctAtStart };
}

/** Jet de capture post-victoire pour un légendaire — le bonus lié à
 *  l'affaiblissement préalable est la récompense mécanique d'avoir envoyé
 *  des agents avant l'affrontement direct. */
export function rollQuestCapture({ catchBase = 0.5, weakenPctAtStart = 0, maxChance = 0.95 }) {
  const chance = Math.min(maxChance, catchBase + weakenPctAtStart * 0.5);
  return { caught: Math.random() < chance, chance };
}

Object.assign(globalThis, {
  runAgentWeakenAttempt,
  runFinalConfrontation,
  rollQuestCapture,
  defaultEncounterState,
});

export {};
