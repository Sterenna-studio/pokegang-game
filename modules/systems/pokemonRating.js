// ════════════════════════════════════════════════════════════════
//  POKÉMON RATING — Évaluation max-level (Lv.100) d'un Pokémon
//  Extrait de pcPokedex.js — partagé entre la fiche détail et la
//  vue TOP Power (modules/ui/pcTopPower.js).
//
//  Dépendances classiques (bare names — chargés via <script>) :
//    NATURES (depuis app.js → globalThis)
//
//  Dépendances globalThis :
//    calculateStats(pokemon)        — recalcule stats pour level/potential/nature
//    getPokemonPower({stats,...})   — applique pcVariance, shiny, homesick
// ════════════════════════════════════════════════════════════════

/**
 * Calcule la projection Lv.100 d'un Pokémon : stats, PC, grade, role.
 *
 * @param {object} p — Pokémon (avec species_en, potential, nature, pcVariance, shiny)
 * @returns {{
 *   lv100:      object,           // pokémon synthétique Lv.100
 *   lv100PC:    number,           // puissance max à Lv.100 avec sa variance/shiny
 *   perfPC:     number,           // référence "5★ Hardy" pour le grading
 *   gradePct:   number,           // % vs référence parfaite
 *   grade:      'S'|'A+'|'A'|'B+'|'B'|'C',
 *   gradeColor: string,           // couleur CSS du grade
 *   nat:        object,           // nature multipliers
 *   natBonus:   string|null,      // ex '+ATK'
 *   natMalus:   string|null,      // ex '−DEF'
 *   s100:       {atk,def,spd},    // stats à Lv.100
 *   roleKey:    'Offensif'|'Défensif'|'Vitesse',
 *   roleIcon:   '⚔'|'🛡'|'⚡',
 * }}
 */
export function getLv100Data(p) {
  const calculateStats  = globalThis.calculateStats;
  const getPokemonPower = globalThis.getPokemonPower;
  const NATURES         = globalThis.NATURES || {};

  const lv100 = { species_en: p.species_en, potential: p.potential, nature: p.nature, level: 100 };
  lv100.stats = calculateStats(lv100);
  const lv100PC = getPokemonPower({ ...lv100, pcVariance: p.pcVariance ?? 1, shiny: p.shiny, homesick: false });

  const perfRef = { species_en: p.species_en, potential: 5, nature: 'hardy', level: 100 };
  perfRef.stats = calculateStats(perfRef);
  const perfPC = getPokemonPower({ ...perfRef, pcVariance: 1, shiny: false, homesick: false });

  const gradePct = perfPC > 0 ? Math.round(lv100PC / perfPC * 100) : 0;
  const grade = gradePct >= 95 ? 'S' : gradePct >= 88 ? 'A+' : gradePct >= 80 ? 'A' : gradePct >= 72 ? 'B+' : gradePct >= 63 ? 'B' : 'C';
  const gradeColor = { S: 'var(--gold)', 'A+': '#4caf50', A: '#81c784', 'B+': '#64b5f6', B: '#90caf9', C: '#aaa' }[grade];

  const nat = NATURES[p.nature] || NATURES.hardy || { atk: 1, def: 1, spd: 1 };
  const natBonus = nat.atk > 1 ? '+ATK' : nat.def > 1 ? '+DEF' : nat.spd > 1 ? '+VIT' : null;
  const natMalus = nat.atk < 1 ? '−ATK' : nat.def < 1 ? '−DEF' : nat.spd < 1 ? '−VIT' : null;

  const s100 = lv100.stats;
  const roleKey = s100.atk >= s100.def && s100.atk >= s100.spd ? 'Offensif' :
                  s100.def >= s100.atk && s100.def >= s100.spd ? 'Défensif' : 'Vitesse';
  const roleIcon = { Offensif: '⚔', Défensif: '🛡', Vitesse: '⚡' }[roleKey];

  return { lv100, lv100PC, perfPC, gradePct, grade, gradeColor, nat, natBonus, natMalus, s100, roleKey, roleIcon };
}

/**
 * Indicateur de "progression" du Pokémon actuel vs son potentiel Lv.100.
 * @returns {number} ratio 0..1 (1 = déjà au max)
 */
export function getProgressionRatio(p) {
  const getPokemonPower = globalThis.getPokemonPower;
  const curPC = getPokemonPower(p);
  const { lv100PC } = getLv100Data(p);
  return lv100PC > 0 ? Math.min(1, curPC / lv100PC) : 0;
}

/**
 * Localisation actuelle d'un Pokémon (équipe, training, pension, PC libre).
 * @param {object} p
 * @param {object} state
 * @returns {{ slot:'team'|'training'|'pension'|'free', label:string, color:string }}
 */
export function getPokemonLocation(p, state) {
  // Boss team
  if (state.gang?.bossTeam?.includes(p.id)) {
    return { slot: 'team', label: '👑 Boss', color: 'var(--gold)' };
  }
  // Agent teams
  for (const agent of state.agents || []) {
    if (agent.team?.includes(p.id)) {
      return { slot: 'team', label: `🧑‍✈️ ${agent.name}`, color: 'var(--green)' };
    }
  }
  // Training room
  if (state.trainingRoom?.slots?.some(s => s?.pokemonId === p.id)) {
    return { slot: 'training', label: '🏋️ Training', color: '#64b5f6' };
  }
  // Pension
  if (state.pension?.slots?.some(s => s?.pokemonId === p.id)) {
    return { slot: 'pension', label: '🥚 Pension', color: '#ce93d8' };
  }
  // Showcase
  if (state.gang?.showcase?.includes(p.id)) {
    return { slot: 'team', label: '✨ Showcase', color: 'var(--gold)' };
  }
  return { slot: 'free', label: 'Libre', color: 'var(--text-dim)' };
}
