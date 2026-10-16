import { openLab } from './lab-access.js';

const ASSETS = [
  ['Fond du QG', '../assets/vivarium/hq.svg', 'image/svg+xml'],
  ['PMD · Miaouss Idle', '../assets/pokemon_pmd/52/Idle.png', 'image/png'],
  ['PMD · Miaouss Walk', '../assets/pokemon_pmd/52/Walk.png', 'image/png'],
  ['PMD · Nosferapti Walk', '../assets/pokemon_pmd/41/Walk.png', 'image/png'],
  ['PMD · Fantominus Idle', '../assets/pokemon_pmd/92/Idle.png', 'image/png'],
  ['PMD · Miaouss shiny', '../assets/pokemon_pmd/52/s/Walk.png', 'image/png'],
  ['HGSS · Pikachu', '../assets/pokemon_hgss/25/Walk.png', 'image/png'],
  ['HGSS · Léviator shiny', '../assets/pokemon_hgss/130/s/Walk.png', 'image/png'],
  ['Personnage · infirmière', '../assets/vivarium_characters/nurse/Walk.png', 'image/png'],
  ['Personnage · scientifique', '../assets/vivarium_characters/scientist/Walk.png', 'image/png'],
  ['Vue OBS', '../gang/live.html', 'text/html'],
  ['Galerie historique', './gang-base-history/versions.json', 'application/json'],
];
if (openLab()) document.querySelector('#checkAssets').addEventListener('click', async event => {
  event.currentTarget.disabled = true;
  const status = document.querySelector('#checkStatus');
  status.textContent = 'Vérification en cours…';
  const rows = ASSETS.map(([name]) => {
    const tr = document.createElement('tr');
    for (const value of [name, 'En cours…', '—']) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
    return tr;
  });
  document.querySelector('#assetResults').replaceChildren(...rows);
  let success = 0;
  await Promise.all(ASSETS.map(async ([, relative, expected], i) => {
    try {
      const response = await fetch(new URL(relative, import.meta.url), { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(10000) });
      const type = response.headers.get('content-type')?.split(';')[0] || 'absent';
      const ok = response.ok && type === expected;
      if (ok) success++;
      rows[i].children[1].textContent = ok ? `OK · ${response.status}` : `Erreur · ${response.status}`;
      rows[i].children[1].className = ok ? 'ok' : 'error';
      rows[i].children[2].textContent = type;
    } catch { rows[i].children[1].textContent = 'Indisponible'; rows[i].children[1].className = 'error'; }
  }));
  status.textContent = `${success}/${ASSETS.length} ressources disponibles avec le type attendu.`;
  document.querySelector('#checkAssets').disabled = false;
});
