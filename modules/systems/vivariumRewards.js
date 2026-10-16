// Small shared reward helpers; no timers, storage or game loop.
export function advanceRainbowWingQuest(state) {
  const mission = state.hoohMission;
  if (!mission?.active || mission.step !== 2) return false;
  mission.rainbowWings = Math.min((mission.rainbowWings || 0) + 1, 5);
  if (mission.rainbowWings === 5) mission.step = 3;
  return mission.step === 3;
}

export function collectVivariumWing(state, itemReceived) {
  state.inventory ||= {};
  state.inventory.rainbow_wing = (state.inventory.rainbow_wing || 0) + 1;
  // The main game already advances quests through ITEM_RECEIVED. The cosmetic
  // page has no quest scheduler/listeners and uses the same pure rule directly.
  if (itemReceived) itemReceived({ itemId: 'rainbow_wing', qty: 1 });
  else advanceRainbowWingQuest(state);
}
