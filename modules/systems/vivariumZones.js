// Original static QG plan, normalized coordinates. No runtime service or engine.
export const HQ_BACKGROUND = { type: 'image', scene: 'hq',
  url: new URL('../../assets/vivarium/hq.svg', import.meta.url).href };
export const HQ_AREAS = [
  { id: 'pc', fr: 'Accueil · PC', en: 'Lobby · PC', x: .065, y: .30, w: .35, h: .13 },
  { id: 'pension', fr: 'Pension', en: 'Daycare', x: .585, y: .30, w: .35, h: .13 },
  { id: 'rest', fr: 'Repos des agents', en: 'Agent lounge', x: .065, y: .80, w: .35, h: .16 },
  { id: 'training', fr: 'Formation', en: 'Training', x: .585, y: .80, w: .35, h: .16 },
];

export function wantsHq(state) {
  const cosmetics = state?.cosmetics || {};
  return cosmetics.vivariumScene === 'hq'
    || (cosmetics.vivariumScene !== 'classic' && !cosmetics.bossBg);
}

export function vivariumDisplay(state) {
  const cosmetics = state?.cosmetics || {};
  return { trueSize: cosmetics.vivariumTrueSize === true,
    spriteMode: ['2d', 'pmd', 'hgss'].includes(cosmetics.vivariumSpriteMode) ? cosmetics.vivariumSpriteMode : 'pmd' };
}

export function residentLocation(id, state) {
  if (state.pension?.slots?.includes(id)) return 'pension';
  if (state.trainingRoom?.pokemon?.includes(id)) return 'training';
  return 'pc'; // active team and showcase remain deduplicated in the lobby.
}

export function cameoLocation(entry) {
  if (entry.type === 'nurse') return 'pension';
  if (entry.type === 'scientist') return 'training';
  if (entry.type === 'agent' && entry.resting) return 'rest';
  return 'pc';
}

export function hqRange(id, bounds, footprint, envelope) {
  const area = HQ_AREAS.find(a => a.id === id) || HQ_AREAS[0];
  const height = bounds.height || 480;
  const minX = Math.max(envelope.minX, area.x * bounds.width + footprint.rx + 3 - 24);
  const maxX = Math.min(envelope.maxX, (area.x + area.w) * bounds.width - footprint.rx - 3 - 24);
  const minY = Math.max(0, area.y * height + footprint.ry + 3 - 40);
  const maxY = (area.y + area.h) * height - footprint.ry - 3 - 40;
  return { minX, maxX: Math.max(minX, maxX), minY, maxY: Math.max(minY, maxY) };
}
