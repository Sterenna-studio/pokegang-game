'use strict';

// Taux de chroma — fonctions pures (aucun global), pour pouvoir les tester.
//
//   probabilité = (taux de base ou Aura + bonus de zone) × Charme Chroma
//
// Le bonus de zone vient de l'échelle de la région (regions-config.js,
// `levelBonusScale.shinyBonus`, indexée par niveau de zone 1-10) et est plafonné.
// Avant : le bonus venait de ZONE_LEVEL_BONUSES (+5 à +20 points dès le niveau 7,
// soit 20,5 % de chroma par capture au niveau 10) et le Charme ne le multipliait pas.

function zoneShinyBonus(region, level, cap = Infinity) {
  const scale = region?.levelBonusScale?.shinyBonus;
  if (!Array.isArray(scale)) return 0;
  const idx = Math.max(1, Math.min(scale.length, Math.floor(level) || 1)) - 1;
  return Math.min(cap, Math.max(0, Number(scale[idx]) || 0));
}

function shinyRate({ base, aura, auraRate, charm, charmMult, zoneBonus = 0 }) {
  const start = aura ? auraRate : base;
  const mult = charm ? charmMult : 1;
  return Math.min(1, (start + zoneBonus) * mult);
}

export { zoneShinyBonus, shinyRate };
