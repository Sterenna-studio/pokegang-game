// QA-only template, copied into the staged Lab runtime by prepare-pmd-preview.py.
import { devFeaturesEnabled } from '../modules/core/devFeatures.js';
import { FALLBACK_POKEMON_SVG } from '../data/assets-data.js';
import { renderEnvironmentZoneFromSnapshot, updateEnvironmentSnapshot, stopEnvironmentZone } from './environment.js';

if (!devFeaturesEnabled()) {
  document.querySelector('#status').textContent = 'Ce prototype est réservé à la prévisualisation Lab.';
} else {
  const residents = [[52, 'Miaouss'], [41, 'Nosferapti'], [92, 'Fantominus']].flatMap(([dex, name]) =>
    [false, true].map(shiny => ({ id: `preview-${dex}-${shiny}`, dex, shiny,
      label: `${name}${shiny ? ' ★' : ''}`, level: 20, natureLabel: 'Jovial', spriteUrl: FALLBACK_POKEMON_SVG })));
  const backgrounds = ['linear-gradient(180deg,#193a28,#284d28)', 'linear-gradient(180deg,#101d40,#26345e)', 'linear-gradient(180deg,#59432a,#81704b)'];
  let background = 0;
  const blob = () => ({ residents, cameoPool: [], backgroundData: { type: 'gradient', value: backgrounds[background] } });
  const root = document.querySelector('#previewRoot');
  const render = () => renderEnvironmentZoneFromSnapshot(root, blob());
  render();
  document.querySelector('#restart').addEventListener('click', render);
  document.querySelector('#background').addEventListener('click', () => {
    background = (background + 1) % backgrounds.length;
    updateEnvironmentSnapshot(blob());
  });
  document.querySelector('#status').textContent = 'Prototype de six Pokémon · sprites locaux · Idle et Walk · huit directions · aucun accès à la sauvegarde';
  window.addEventListener('pagehide', stopEnvironmentZone, { once: true });
}
