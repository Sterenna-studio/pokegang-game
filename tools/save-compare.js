import { openLab } from './lab-access.js';
import { compareSaves, summarizeSave, validateSave } from './save-compare-core.js';

if (openLab()) {
  let generation = 0;
  function appendRow(body, values) {
    const tr = document.createElement('tr');
    for (const value of values) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
    body.append(tr);
  }
  async function render() {
    const run = ++generation;
    const before = document.querySelector('#before').files[0], after = document.querySelector('#after').files[0];
    const status = document.querySelector('#resultStatus');
    document.querySelector('#results').hidden = true;
    if (!before || !after) { status.textContent = 'Sélectionner les deux fichiers.'; return; }
    try {
      const saves = await Promise.all([before, after].map(async file => validateSave(JSON.parse(await file.text()))));
      if (run !== generation) return;
      const a = summarizeSave(saves[0]), b = summarizeSave(saves[1]);
      const summary = document.querySelector('#summary'); summary.replaceChildren();
      for (const key of Object.keys(a)) appendRow(summary, [key, a[key], b[key]]);
      const result = compareSaves(...saves, { all: document.querySelector('#allFields').checked });
      const body = document.querySelector('#diffs'); body.replaceChildren();
      for (const row of result.rows) appendRow(body, [row.path, row.before, row.after]);
      status.textContent = result.count ? `${result.count} différence(s) · ${result.rows.length} affichée(s).` : 'Aucune différence dans les champs comparés.';
      document.querySelector('#results').hidden = false;
    } catch { if (run === generation) status.textContent = 'Impossible de lire les fichiers : sélectionner deux sauvegardes JSON valides.'; }
  }
  for (const selector of ['#before', '#after', '#allFields']) document.querySelector(selector).addEventListener('change', render);
}
