'use strict';
// ════════════════════════════════════════════════════════════════
//  Combats Spéciaux — résolution partagée pour les combats de boss
//  des quêtes légendaires (Johto, Kanto, Hoenn, Sinnoh, Deoxys).
//
//  Avant ce module, chaque région réimplémentait sa propre logique :
//  Johto/Kanto/Hoenn gagnaient à 100% une fois le seuil de puissance
//  atteint (aucun vrai combat, juste un texte "Combat en cours…" suivi
//  d'une victoire scriptée) ; seules Sinnoh et Deoxys avaient un vrai
//  jet de probabilité, chacune avec sa propre formule légèrement
//  différente. Ce module unifie le COMPORTEMENT (un vrai risque
//  d'échec partout, formule cohérente) sans toucher à l'habillage
//  visuel propre à chaque région (machine à écrire Hoenn, flash,
//  modales dédiées...).
//
//  API :
//    resolveSpecialCombat({ power, requiredPower, baseChance?, maxChance?, slope? })
//      → { win, chance, powerRatio }
// ════════════════════════════════════════════════════════════════

export function resolveSpecialCombat({ power, requiredPower, baseChance = 0.55, maxChance = 0.95, slope = 0.4 }) {
  const powerRatio = requiredPower > 0 ? power / requiredPower : 1;
  const chance = Math.min(maxChance, baseChance + Math.max(0, powerRatio - 1) * slope);
  const win = Math.random() < chance;
  return { win, chance, powerRatio };
}

export {};
