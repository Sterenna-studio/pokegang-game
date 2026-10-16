import { devFeaturesEnabled } from '../../modules/core/devFeatures.js';

const status = document.querySelector('#status');
if (!devFeaturesEnabled()) {
  status.textContent = 'Cette galerie est réservée au lab et au développement local.';
} else {
  try {
    const response = await fetch('./versions.json');
    if (!response.ok) throw Error('Catalogue indisponible');
    const versions = await response.json();
    const version = document.querySelector('#version');
    const other = document.querySelector('#otherVersion');
    const compare = document.querySelector('#compare');
    for (const [i, item] of versions.entries()) {
      for (const select of [version, other]) {
        const option = document.createElement('option');
        option.value = String(i); option.textContent = `${item.date} · ${item.title}`;
        select.append(option);
      }
    }
    version.value = String(versions.length - 1); other.value = '3';
    function show(figure, item) {
      if (figure.dataset.revision === item.revision + item.mode) return;
      figure.dataset.revision = item.revision + item.mode;
      const caption = document.createElement('figcaption');
      const title = document.createElement('h2'); title.textContent = item.title;
      const description = document.createElement('p'); description.textContent = item.description;
      const source = document.createElement('a');
      source.href = `https://github.com/Sterenna-studio/pokegang-game/commit/${item.revision}`;
      source.textContent = `${item.date} · ${item.revision.slice(0, 7)} · ${item.mode.toUpperCase()}`;
      source.target = '_blank'; source.rel = 'noopener noreferrer'; source.className = 'meta';
      caption.append(title, description, source);
      const link = document.createElement('a'); link.href = item.file;
      link.target = '_blank'; link.rel = 'noopener noreferrer'; link.title = 'Ouvrir la capture à sa taille originale';
      const image = document.createElement('img'); image.className = 'capture';
      image.src = item.file; image.alt = `${item.title}, reconstitution du ${item.date}`;
      image.width = item.width; image.height = item.height; image.decoding = 'async';
      link.append(image); figure.replaceChildren(caption, link);
    }
    function render() {
      const secondary = document.querySelector('#secondary');
      secondary.hidden = !compare.checked;
      document.querySelector('#compareChoice').hidden = !compare.checked;
      document.querySelector('#views').classList.toggle('compare', compare.checked);
      show(document.querySelector('#primary'), versions[Number(version.value)]);
      if (compare.checked) show(secondary, versions[Number(other.value)]);
      else { secondary.replaceChildren(); delete secondary.dataset.revision; }
    }
    document.querySelector('#controls').addEventListener('change', render);
    document.querySelector('#controls').addEventListener('submit', e => e.preventDefault());
    document.querySelector('#controls').hidden = false;
    status.textContent = `${versions.length} versions · seules les captures sélectionnées sont chargées.`;
    render();
  } catch {
    status.textContent = 'Impossible de charger la galerie. Réessaie après un rechargement.';
  }
}
