'use strict';

// Pure Hoenn story-unlock reconciliation. Kept separate from the mission UI
// so save migration and deterministic tests use the exact same rules as the
// live quest callbacks.

export const HOENN_STORY_UNLOCK_IDS = Object.freeze([
  'magma_hideout_key',
  'aqua_hideout_key',
  'cave_origin_pass',
  'regi_seal',
]);

export function getEarnedHoennStoryUnlocks(state) {
  const groudon = state?.groudonMission;
  const kyogre = state?.kyogreMission;

  const magmaLocated = !!groudon && (
    (groudon.step || 0) >= 2 || (groudon.magmaFightsWon || 0) >= 20
  );
  const aquaLocated = !!kyogre && (
    (kyogre.step || 0) >= 2 || (kyogre.aquaFightsWon || 0) >= 20
  );
  const caveOpened = (
    (!!groudon && ((groudon.step || 0) >= 5 || groudon.maxieDefeated === true))
    || (!!kyogre && ((kyogre.step || 0) >= 5 || kyogre.archieDefeated === true))
  );
  const groudonCaptured = groudon?.groudonOwned === true || (groudon?.step || 0) >= 6;
  const kyogreCaptured = kyogre?.kyogreOwned === true || (kyogre?.step || 0) >= 6;

  return {
    magma_hideout_key: magmaLocated,
    aqua_hideout_key: aquaLocated,
    cave_origin_pass: caveOpened,
    regi_seal: groudonCaptured && kyogreCaptured,
  };
}

export function reconcileHoennStoryUnlocks(state) {
  if (!state) return [];
  if (!state.purchases || typeof state.purchases !== 'object') state.purchases = {};

  const earned = getEarnedHoennStoryUnlocks(state);
  const granted = [];
  for (const id of HOENN_STORY_UNLOCK_IDS) {
    if (!earned[id] || state.purchases[id] === true) continue;
    state.purchases[id] = true;
    granted.push(id);
  }
  return granted;
}
