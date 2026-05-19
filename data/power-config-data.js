'use strict';

// ════════════════════════════════════════════════════════════════
//  POWER CONFIG — paramètres de la formule de puissance Pokémon
//
//  La puissance (PC) d'un Pokémon se calcule en deux temps :
//    1. Somme pondérée des stats (ATK, DEF, SPD) avec des poids
//       différenciés selon le rôle offensif/défensif de chaque stat.
//    2. Soft cap : au-delà de POWER_SOFT_CAP, les gains supplémentaires
//       sont atténués pour limiter les outliers (Crustabri, Groudon…).
//
//  Ajuster ici — ne pas hardcoder dans pokemon.js / zoneCombat.js.
// ════════════════════════════════════════════════════════════════

// ── Poids des stats ───────────────────────────────────────────────
// ATK : légèrement valorisée (rôle actif en combat / capture)
// DEF : pénalisée — une DEF très haute ne se traduit pas directement
//       en puissance d'action ; elle résiste mais n'attaque pas.
// SPD : légèrement valorisée (présence active = captures + combats)
export const POWER_W_ATK = 1.25;
export const POWER_W_DEF = 0.65;
export const POWER_W_SPD = 1.10;

// ── Soft cap ──────────────────────────────────────────────────────
// PC raw > POWER_SOFT_CAP : seul POWER_SOFT_RATE × l'excédent est comptabilisé.
// Exemples au seuil actuel :
//   raw=620 → PC=620    raw=900 → PC=620+(280×0.52)=766
//   raw=1000 → PC=620+(380×0.52)=818
export const POWER_SOFT_CAP  = 620;
export const POWER_SOFT_RATE = 0.52;

// ── Malus homesick ────────────────────────────────────────────────
// Multiplicateur appliqué sur le PC si le Pokémon est "homesick"
// (loin de sa zone de capture depuis trop longtemps).
export const POWER_HOMESICK_MULT = 0.75;

// ════════════════════════════════════════════════════════════════
//  Référence de l'ancienne formule (archivée pour comparaison) :
//    PC = atk + def + spd   (poids 1:1:1, pas de cap)
//    Crustabri Lv100 pot5 : 1035 PC — meta non intentionnel
//  Nouvelle formule :
//    PC = soft_cap(atk×1.25 + def×0.65 + spd×1.10)
//    Crustabri Lv100 pot5 : ~785 PC — Mewtwo : ~826 PC ✓
// ════════════════════════════════════════════════════════════════
