'use strict';

// ════════════════════════════════════════════════════════════════
//  BOSS POWER MODULE — puissance de l'équipe du chef de gang
//
//  Fournit getBossTeamPower(state?) avec cache auto-invalidé.
//  Le cache est valide tant que :
//    • les IDs de bossTeam n'ont pas changé (ajout/retrait)
//    • aucun Pokémon de l'équipe n'a changé de niveau, d'espèce
//      ni de potentiel (couvre niveaux, évolutions, fusions)
//
//  Utilisation :
//    getBossTeamPower()             → puissance courante (cached)
//    getBossTeamPower(state)        → idem en passant state explicitement
//    invalidateBossTeamPower()      → force-invalide le cache
//
//  Dépendances globalThis :
//    state, getPokemonPower
// ════════════════════════════════════════════════════════════════

import { BOSS_TEAM_SLOTS } from '../../data/game-config-data.js';
import {
  POWER_W_ATK, POWER_W_DEF, POWER_W_SPD,
  POWER_SOFT_CAP, POWER_SOFT_RATE,
} from '../../data/power-config-data.js';

// ── Cache interne ─────────────────────────────────────────────────
let _cache = {
  power:       0,
  fingerprint: null,   // null = invalide (force recalcul au prochain appel)
};

// ── Empreinte de l'équipe ─────────────────────────────────────────
// Chaîne stable qui représente l'état courant de bossTeam.
// Changement de niveau, d'espèce ou de potentiel ⇒ empreinte différente.
function _fingerprint(state) {
  const team = (state?.gang?.bossTeam || []).slice(0, BOSS_TEAM_SLOTS);
  if (team.length === 0) return '';
  return team.map(id => {
    if (!id) return 'empty';
    const p = state.pokemons?.find(pk => pk.id === id);
    return p ? `${id}:${p.level}:${p.species_en}:${p.potential ?? 0}` : `${id}:missing`;
  }).join('|');
}

// ── Fallback si getPokemonPower non disponible ────────────────────
// Utilise la même formule pondérée + soft-cap que computePokemonPC.
function _fallbackPower(pokemon) {
  const s = pokemon?.stats ?? {};
  const raw = (s.atk ?? 0) * POWER_W_ATK
            + (s.def ?? 0) * POWER_W_DEF
            + (s.spd ?? 0) * POWER_W_SPD;
  const pc = raw <= POWER_SOFT_CAP
    ? raw
    : POWER_SOFT_CAP + (raw - POWER_SOFT_CAP) * POWER_SOFT_RATE;
  return Math.round(pc);
}

// ── API publique ──────────────────────────────────────────────────

/**
 * Retourne la puissance totale de l'équipe Boss.
 * Utilise un cache invalidé automatiquement si l'équipe a changé.
 * @param {object} [state] - Optionnel : passer state explicitement (utile en tests).
 * @returns {number} Puissance totale arrondie.
 */
export function getBossTeamPower(state) {
  const s = state ?? globalThis.state ?? {};
  const fp = _fingerprint(s);

  // Cache valide → retour immédiat
  if (_cache.fingerprint !== null && _cache.fingerprint === fp) {
    return _cache.power;
  }

  // Recalcul
  const team = (s.gang?.bossTeam || []).filter(Boolean).slice(0, BOSS_TEAM_SLOTS);
  const getPower = globalThis.getPokemonPower ?? _fallbackPower;
  const power = Math.round(
    team.reduce((sum, id) => {
      const p = s.pokemons?.find(pk => pk.id === id);
      return sum + (p ? getPower(p) : 0);
    }, 0)
  );

  _cache = { power, fingerprint: fp };
  return power;
}

/**
 * Invalide manuellement le cache (utile après une mutation directe de stats
 * qui ne change pas le niveau ni l'espèce, ex: changement de nature).
 */
export function invalidateBossTeamPower() {
  _cache = { power: 0, fingerprint: null };
}

// Exposer sur globalThis pour les modules sans import direct
Object.assign(globalThis, { getBossTeamPower, invalidateBossTeamPower });

export {};
