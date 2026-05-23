// ════════════════════════════════════════════════════════════════
//  DIFFICULTY TIER — Évalue la difficulté d'un combat avant engagement
//
//  Le scaling existant ne correspond pas toujours à la puissance du joueur
//  (sous-leveled ou sur-leveled selon la progression). Ce module compare
//  la puissance du joueur (boss + agents en zone) à celle du dresseur
//  ennemi et propose un "tier" coloré : trivial → impossible.
//
//  Usage :
//    import { getDifficultyTier } from '../systems/difficultyTier.js';
//    const tier = getDifficultyTier(playerPower, enemyPower);
//    // → { id, label, emoji, color, rewardMult, rationale }
//
//  Le tier est affiché :
//    - sur le sprite du dresseur (badge coloré)
//    - dans le popup de combat (header)
//
//  Le `rewardMult` peut être appliqué aux gains (combat plus dur = plus
//  de récompense pour pousser le joueur à challenger sa puissance).
// ════════════════════════════════════════════════════════════════

const TIERS = [
  { id: 'trivial',    label: 'Trivial',   emoji: '⚪',  color: '#888',     rewardMult: 0.7, max: 0.20 },
  { id: 'easy',       label: 'Facile',    emoji: '🟢',  color: '#4caf50',  rewardMult: 0.9, max: 0.50 },
  { id: 'standard',   label: 'Standard',  emoji: '🔵',  color: '#64b5f6',  rewardMult: 1.0, max: 1.20 },
  { id: 'hard',       label: 'Difficile', emoji: '🟡',  color: '#ffb74d',  rewardMult: 1.3, max: 2.00 },
  { id: 'elite',      label: 'Élite',     emoji: '🟠',  color: '#ff7043',  rewardMult: 1.6, max: 3.50 },
  { id: 'extreme',    label: 'Extrême',   emoji: '🔴',  color: '#e53935',  rewardMult: 2.0, max: 6.00 },
  { id: 'impossible', label: 'Suicide',   emoji: '💀',  color: '#9b27b0',  rewardMult: 2.5, max: Infinity },
];

/**
 * Calcule le tier de difficulté d'un combat.
 * @param {number} playerPower
 * @param {number} enemyPower
 * @returns {{
 *   id: string,
 *   label: string,
 *   emoji: string,
 *   color: string,
 *   rewardMult: number,
 *   ratio: number,
 *   rationale: string,
 * }}
 */
export function getDifficultyTier(playerPower, enemyPower) {
  if (!enemyPower || enemyPower <= 0) {
    return { ...TIERS[0], ratio: 0, rationale: 'Adversaire sans puissance détectée' };
  }
  if (!playerPower || playerPower <= 0) {
    return { ...TIERS[6], ratio: Infinity, rationale: 'Aucune équipe assignée' };
  }
  const ratio = enemyPower / playerPower;
  const tier = TIERS.find(t => ratio <= t.max) || TIERS[TIERS.length - 1];
  const rationale = `Adversaire ${Math.round(ratio * 100)}% de ta puissance`;
  return { ...tier, ratio, rationale };
}

/**
 * Pour usage en UI : retourne un badge HTML compact à afficher
 * en overlay sur un sprite de dresseur.
 */
export function getDifficultyBadgeHtml(tier) {
  if (!tier) return '';
  return `<div class="diff-tier-badge" style="background:${tier.color}1a;border-color:${tier.color};color:${tier.color}" title="${tier.label} — ${tier.rationale} (récompense ×${tier.rewardMult})">
    ${tier.emoji}
  </div>`;
}

/**
 * Helper inverse : à partir d'un trainerSpawn et des agents/boss en zone,
 * renvoie directement le tier (utilise getTrainerCombatPreview en interne).
 *
 * @param {object} trainerSpawn — spawn objet { trainerKey, team, zoneId, ... }
 * @param {string[]} [agentIds] — null pour tous les agents en zone
 * @returns {object|null} tier ou null si preview impossible
 */
export function tierForTrainerSpawn(trainerSpawn, agentIds = null) {
  const preview = globalThis.getTrainerCombatPreview?.(trainerSpawn, agentIds);
  if (!preview) return null;
  return getDifficultyTier(preview.attackerPower, preview.defenderPower);
}

export { TIERS };
