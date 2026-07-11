'use strict';

// ES imports: none.
// Injected deps via configureRegionUnlockChecks(ctx):
// - getState, checkHoennUnlock, checkSinnohUnlock
// Classic-script globals used: none.
// Temporary globalThis access:
// - fallback reads state, checkHoennUnlock, checkSinnohUnlock during migration.

let regionUnlockContext = {};

export function configureRegionUnlockChecks(ctx = {}) {
  regionUnlockContext = { ...regionUnlockContext, ...ctx };
}

function getState() {
  return regionUnlockContext.getState?.() ?? globalThis.state;
}

function checkHoennUnlock() {
  return regionUnlockContext.checkHoennUnlock?.() ?? globalThis.checkHoennUnlock?.();
}

function checkSinnohUnlock() {
  return regionUnlockContext.checkSinnohUnlock?.() ?? globalThis.checkSinnohUnlock?.();
}

export function checkPeriodicRegionUnlocksTick() {
  const state = getState();
  if (!state.purchases?.hoennUnlocked) checkHoennUnlock();
  if (!state.purchases?.sinnohUnlocked) checkSinnohUnlock();
}
