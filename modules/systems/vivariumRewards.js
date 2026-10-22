// Small shared reward helpers; no timers, storage or game loop.

// Ho-Oh (visiteur d'événement) : un clic = une plume, mais chaque plume le rend plus
// difficile à re-cliquer. Un délai minimal coupe l'autoclic, et l'accélération par clic
// augmente avec le nombre de plumes déjà tombées pendant la visite : cumuler les
// récompenses devient mécaniquement de plus en plus dur.
export const HOOH_CLICK_COOLDOWN_MS = 100;
export const HOOH_BASE_BOOST = 1.4;
export const HOOH_BOOST_PER_WING = 0.12;
export const HOOH_MAX_SPEED_FACTOR = 14;

/** Facteur de vitesse après un clic ; `wingsDropped` = plumes déjà tombées cette visite
 *  (celle du clic en cours comprise quand elle a été accordée). */
export function nextHoohSpeedFactor(current, wingsDropped = 0) {
  const boost = HOOH_BASE_BOOST + HOOH_BOOST_PER_WING * Math.max(0, wingsDropped);
  return Math.min(HOOH_MAX_SPEED_FACTOR, Math.max(1, current) * boost);
}

/** Vrai si ce clic tombe dans le délai de grâce du précédent (à ignorer). */
export function isWithinClickCooldown(lastClickAt, now, cooldownMs = HOOH_CLICK_COOLDOWN_MS) {
  return Number.isFinite(lastClickAt) && now - lastClickAt < cooldownMs;
}

/** Seul le cameo d'événement dispense des plumes : un Ho-Oh mis en favori reste un visiteur. */
export function isHoohEventCameo(pokemon) {
  return pokemon?.type === 'event' && pokemon.dex === 250;
}
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
