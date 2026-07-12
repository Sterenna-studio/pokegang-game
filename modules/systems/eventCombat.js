'use strict';
// ════════════════════════════════════════════════════════════════
//  EVENT COMBAT MODULE — vrai combat pokémon-par-pokémon partagé par les
//  PNJ d'événement de zone et les combats dresseur normaux.
//
//  Résolution pure : pas d'accès DOM, pas de mutation de state.
//  Le combat de zone "normal" garde ses previews/récompenses dans
//  zoneCombat.js, mais rejoue désormais ses tours via ce moteur pur.
//
//  API :
//    resolveEventBattle({ playerTeam, enemyTeam, random? })
//      → { win, turns: [...], playerFinal, enemyFinal }
//
//  playerTeam / enemyTeam : liste ordonnée de Pokémon
//    { species_en, level, stats:{atk,def,spd}, shiny?, moves? }
//  Les Pokémon de l'équipe joueur viennent de state.pokemons (moves déjà
//  assignés à la capture, cf. rollMoves dans pokemon.js) ; ceux du
//  dresseur d'événement viennent de makeTrainerTeam (pas de moves
//  persistées) — assignés ici via globalThis.rollMoves si absents.
//
//  Classic-script globals accédés par nom brut : SPECIES_BY_EN, MOVES_DATA
//  Globals lus via globalThis : rollMoves, getTypeEffectiveness
// ════════════════════════════════════════════════════════════════

const FALLBACK_MOVE_NAME = 'Charge';
const FALLBACK_MOVE = { type: 'Normal', basePower: 50, category: 'physical' };

// Échelle de dégâts — calibrée pour qu'un duel dure ~3-5 échanges avec des PV
// calculés via calcHp (def×1.5 + niveau×2 + 10, volontairement petit) et des
// moves ~50-80 basePower à ratio atk/def ≈ 1 (raw ≈ 70 × SCALE ≈ PV/4).
const DAMAGE_SCALE = 0.6;
const MAX_ROUNDS = 60; // filet de sécurité anti-boucle infinie

function speciesOf(species_en) {
  return (typeof SPECIES_BY_EN !== 'undefined' ? SPECIES_BY_EN[species_en] : null) || {};
}

/** PV de combat — même formule que calcCombatHp dans zoneWindows.js, dupliquée
 *  ici pour éviter une dépendance UI→systems (précédent : _computePC dupliqué
 *  dans zoneCombat.js). Doit rester strictement identique. */
function calcHp(stats, level) {
  return Math.max(10, Math.floor((stats?.def ?? 0) * 1.5 + (level ?? 1) * 2 + 10));
}

function movesOf(pk) {
  if (pk.moves?.length) return pk.moves;
  return globalThis.rollMoves?.(pk.species_en) ?? [FALLBACK_MOVE_NAME];
}

function moveData(name) {
  return (typeof MOVES_DATA !== 'undefined' ? MOVES_DATA[name] : null) || FALLBACK_MOVE;
}

function buildCombatant(pk, side) {
  const stats = pk.stats || {};
  const maxHp = calcHp(stats, pk.level);
  return {
    side,
    species_en: pk.species_en,
    level: pk.level ?? 1,
    shiny: !!pk.shiny,
    stats,
    types: speciesOf(pk.species_en).types || ['Normal'],
    moves: movesOf(pk),
    maxHp,
    hp: maxHp,
    fainted: false,
  };
}

// Choisit l'attaque à dégâts la plus efficace contre le défenseur actuel
// (basePower × STAB × efficacité de type) — pas juste la plus puissante brute.
function pickMove(attacker, defender) {
  const dmgMoves = attacker.moves.filter(m => (moveData(m).basePower || 0) > 0);
  if (dmgMoves.length === 0) return { name: FALLBACK_MOVE_NAME, data: FALLBACK_MOVE };
  let best = null;
  let bestScore = -1;
  for (const name of dmgMoves) {
    const data = moveData(name);
    const stab = attacker.types.includes(data.type) ? 1.5 : 1;
    const eff = globalThis.getTypeEffectiveness?.(data.type, defender.types) ?? 1;
    const score = data.basePower * stab * eff;
    if (score > bestScore) { bestScore = score; best = { name, data }; }
  }
  return best;
}

function computeDamage(attacker, defender, random) {
  const { name, data } = pickMove(attacker, defender);
  const stab = attacker.types.includes(data.type) ? 1.5 : 1;
  const eff = globalThis.getTypeEffectiveness?.(data.type, defender.types) ?? 1;
  const statRatio = (attacker.stats.atk || 1) / Math.max(1, defender.stats.def || 1);
  const variance = 0.85 + random() * 0.30;
  const raw = data.basePower * statRatio * stab * eff * DAMAGE_SCALE * variance;
  return { move: name, type: data.type, stab, eff, damage: Math.max(1, Math.round(raw)) };
}

function faster(a, b, random) {
  if (a.stats.spd === b.stats.spd) return random() < 0.5 ? a : b;
  return a.stats.spd > b.stats.spd ? a : b;
}

function switchTurn(c) {
  return { type: 'switch', side: c.side, species_en: c.species_en, level: c.level, shiny: c.shiny, hp: c.hp, maxHp: c.maxHp };
}

/**
 * Simule le combat complet et retourne un log de tours à rejouer côté UI
 * (même convention que buildTrainerCombatTaglines : tout est précalculé,
 * l'UI se contente de rejouer la liste avec des délais).
 *
 * Relève classique : à la mise K.O. d'un Pokémon, le suivant de son équipe
 * entre à pleins PV ; le survivant en face garde ses PV actuels.
 */
export function resolveEventBattle({ playerTeam = [], enemyTeam = [], random = Math.random } = {}) {
  const players = playerTeam.filter(Boolean).map(pk => buildCombatant(pk, 'player'));
  const enemies = enemyTeam.filter(Boolean).map(pk => buildCombatant(pk, 'enemy'));

  const turns = [];
  if (players.length === 0 || enemies.length === 0) {
    return { win: players.length > 0, turns, playerFinal: players, enemyFinal: enemies };
  }

  let pIdx = 0, eIdx = 0;
  turns.push(switchTurn(players[0]));
  turns.push(switchTurn(enemies[0]));

  let rounds = 0;
  while (pIdx < players.length && eIdx < enemies.length && rounds < MAX_ROUNDS) {
    rounds++;
    const pAct = players[pIdx];
    const eAct = enemies[eIdx];
    const first = faster(pAct, eAct, random);
    const order = first === pAct ? [pAct, eAct] : [eAct, pAct];

    for (const attacker of order) {
      const defender = attacker === pAct ? eAct : pAct;
      if (defender.fainted) break; // déjà K.O. par l'attaque précédente ce round
      const hit = computeDamage(attacker, defender, random);
      defender.hp = Math.max(0, defender.hp - hit.damage);
      turns.push({
        type: 'attack', side: attacker.side,
        attackerSpecies: attacker.species_en, defenderSpecies: defender.species_en,
        move: hit.move, damage: hit.damage,
        defenderHp: defender.hp, defenderMaxHp: defender.maxHp,
        effectiveness: hit.eff,
      });
      if (defender.hp <= 0) {
        defender.fainted = true;
        turns.push({ type: 'faint', side: defender.side, species_en: defender.species_en });
        if (defender.side === 'player') pIdx++; else eIdx++;
        const nextTeam = defender.side === 'player' ? players : enemies;
        const nextIdx = defender.side === 'player' ? pIdx : eIdx;
        if (nextIdx < nextTeam.length) turns.push(switchTurn(nextTeam[nextIdx]));
        break; // le round s'arrête dès qu'un Pokémon tombe
      }
    }
  }

  let win;
  if (eIdx >= enemies.length) {
    win = true;
  } else if (pIdx >= players.length) {
    win = false;
  } else {
    // Filet anti-boucle infinie (MAX_ROUNDS atteint) : décision par PV cumulés restants.
    const pHp = players.slice(pIdx).reduce((s, p) => s + p.hp, 0);
    const eHp = enemies.slice(eIdx).reduce((s, p) => s + p.hp, 0);
    win = pHp >= eHp;
  }
  turns.push({ type: 'result', win });

  return { win, turns, playerFinal: players, enemyFinal: enemies };
}

export {};
