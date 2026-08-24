'use strict';

// ════════════════════════════════════════════════════════════════
//  firstRunSplash.js — first paint / readiness pour un nouveau joueur itch
//  (issue #76)
//
//  Le splash lui-même est du markup statique déjà présent dans index.html
//  (#firstRunSplash) — voir le petit <script> classique juste après dans le
//  <body>, qui pose `body.first-run-splash-skip` de façon synchrone, avant
//  même que ce module ES ne charge, pour ne jamais laisser un joueur
//  web/itch-avec-save voir le shell du jeu flasher derrière le splash. Ce
//  module ne fait que : (a) exposer la même décision en JS pur pour
//  app.js/showIntroIfNeeded (shouldShowFirstRunSplash, dérivée de
//  shouldAutoStartFirstGame — même fonction que le hub, pas de logique
//  dupliquée) et (b) retirer le splash une fois que le briefing est prêt à
//  prendre le relais (hideFirstRunSplash).
//
//  Dépendances injectées via configureFirstRunSplash : getSlotPreview
// ════════════════════════════════════════════════════════════════

import { detectPlatform } from '../systems/analytics.js';
import { shouldAutoStartFirstGame } from './hub.js';

let _ctx = {};
export function configureFirstRunSplash(ctx = {}) {
  _ctx = { ..._ctx, ...ctx };
}

/** Même décision que le hub (itch + aucune save) — réutilisée telle quelle. */
export function shouldShowFirstRunSplash() {
  const hasAnySave = [0, 1, 2].some(index => !!_ctx.getSlotPreview?.(index));
  return shouldAutoStartFirstGame(detectPlatform(), hasAnySave);
}

/**
 * Retire le splash (classe posée par le bootstrap inline si elle ne l'était
 * pas déjà) — idempotent, sûr à appeler même si le bootstrap l'a déjà fait.
 */
export function hideFirstRunSplash() {
  document.body?.classList.add('first-run-splash-skip');
}
