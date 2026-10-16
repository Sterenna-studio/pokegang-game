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
