import { HEIGHT_DM } from '../assets/vivarium/sizes.js';

// Cosmetic reference, not a physical simulation: 28px/metre, 16–144px visible
// height in True size, with a 192px full-frame ceiling for padded sheets.
// Pokédex length (e.g. serpents) is treated as height and capped too.
export function pokemonDisplayHeight(dex, enabled) {
  const dm = HEIGHT_DM[dex];
  return enabled && dm > 0 ? Math.max(16, Math.min(144, dm * 2.8)) : null;
}

export function pokemonScale(displayHeight, bodyHeight, largest, standard) {
  return displayHeight && bodyHeight > 0
    ? Math.min(displayHeight / bodyHeight, 192 / largest) : standard;
}

