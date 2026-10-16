import { openLab } from './lab-access.js';

if (openLab()) {
  // Only load catalog metadata after the lab-host gate. PNGs remain on demand.
  const [{ createPmdRenderer }, { HGSS_METADATA, HGSS_BODY_HEIGHT }, { pokemonDisplayHeight }, { FALLBACK_POKEMON_SVG }] = await Promise.all([
    import('../gang/pmdSprites.js'), import('../assets/pokemon_hgss/metadata.js'),
    import('../gang/pokemonSize.js'), import('../data/assets-data.js'),
  ]);
  const media = matchMedia('(prefers-reduced-motion: reduce)'), listeners = new Set();
  const $ = selector => document.querySelector(selector);
  const motion = { get matches() { return media.matches || $('#still').checked; },
    addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) };
  const renderer = createPmdRenderer({ motion });
  const actors = [];
  const report = () => { const stats = renderer.stats(); $('#stats').textContent = `${stats.actors} animations attachées · ${stats.sheets} planches en cache · boucle ${stats.scheduled ? 'active' : 'arrêtée'}`; };
  const refreshMotion = () => { for (const fn of listeners) fn(); report(); };
  media.addEventListener('change', refreshMotion);
  function applyAnimation() {
    for (const actor of actors) actor?.set($('#animation').value, Number($('#direction').value));
    report();
  }
  function render() {
    const dex = Math.max(1, Math.min(493, Number.parseInt($('#dex').value, 10) || 52));
    $('#dex').value = dex;
    const shiny = $('#shiny').checked, trueSize = $('#trueSize').checked;
    for (const actor of actors) actor?.destroy();
    actors.length = 0;
    // PokeAPI's public classic images use numeric dex ids; only selected images.
    const fallback = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shiny ? 'shiny/' : ''}${dex}.png`;
    const height = pokemonDisplayHeight(dex, trueSize);
    for (const id of ['classic', 'pmd', 'hgss']) {
      const img = $(`#${id} img`);
      img.onerror = () => { img.onerror = null; img.src = FALLBACK_POKEMON_SVG; };
      img.src = fallback;
      img.style.width = img.style.height = `${height || 48}px`;
      img.style.left = height ? `${24 - height / 2}px` : '0';
      img.style.top = height ? `${40 - height}px` : '0';
    }
    const pmd = renderer.attach($('#pmd'), { dex, shiny, trueSize });
    const variant = shiny ? 'shiny' : 'normal';
    const hgss = renderer.attachAnimation($('#hgss'), HGSS_METADATA[dex]?.[variant], {
      assetBaseUrl: new URL('../assets/pokemon_hgss/', import.meta.url),
      displayHeight: height, bodyHeight: HGSS_BODY_HEIGHT[`${dex}/${variant}`],
    });
    actors.push(pmd, hgss);
    $('#species').textContent = `Pokémon #${dex}${shiny ? ' · shiny' : ''}${trueSize ? ' · True size limité' : ''}`;
    $('#pmdStatus').textContent = pmd ? 'Variante PMD disponible. Secours classique si une image échoue.' : 'Variante absente : sprite classique.';
    $('#hgssStatus').textContent = hgss ? 'Variante HGSS disponible. Repos fixe et marche directionnelle.' : 'Variante absente : sprite classique.';
    applyAnimation();
  }
  for (const selector of ['#dex', '#shiny', '#trueSize']) $(selector).addEventListener('change', render);
  for (const selector of ['#animation', '#direction']) $(selector).addEventListener('change', applyAnimation);
  $('#still').addEventListener('change', refreshMotion);
  document.addEventListener('visibilitychange', report);
  window.addEventListener('pagehide', event => { if (!event.persisted) { renderer.dispose(); media.removeEventListener('change', refreshMotion); } });
  render();
}
