// Lazy-loaded on allowlisted development hosts only. Never reads/writes saves.
import { devFeaturesEnabled } from '../modules/core/devFeatures.js';

export function mountVivariumDev({ zone, viewport, layout, bounds }) {
  if (!devFeaturesEnabled()) return null;
  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = new URL('./vivariumDev.css', import.meta.url).href;
  document.head.appendChild(style);
  const panel = document.createElement('details');
  panel.id = 'vivariumDevPanel';
  panel.className = 'vivarium-dev-panel';
  panel.innerHTML = `<summary>🛠 Vivarium · Dev</summary>
    <div class="vivarium-dev-body">
      <p>Inspection locale · aucune sauvegarde modifiée</p>
      <fieldset><legend>Afficher</legend>
        <label><input type="checkbox" data-debug="feet" checked> Empreintes au sol</label>
        <label><input type="checkbox" data-debug="visual"> Enveloppes des sprites</label>
        <label><input type="checkbox" data-debug="click"> Zones de clic</label>
        <label><input type="checkbox" data-debug="anchors" checked> Ancrages et profondeur</label>
        <label><input type="checkbox" data-debug="targets"> Destinations réservées</label>
        <label><input type="checkbox" data-debug="ground" checked> Bande de déplacement</label>
      </fieldset>
      <label class="vivarium-dev-select">Inspecter un acteur
        <select aria-label="Acteur à inspecter"><option value="">Tous les acteurs</option></select>
      </label>
      <output class="vivarium-dev-actor">Sélectionnez un acteur pour ses mesures.</output>
      <output class="vivarium-dev-stats" aria-live="off"></output>
      <p class="vivarium-dev-legend">Vert : sol · bleu : image · orange : clic · rose : destination.<br>
        Les empreintes limitent les regroupements ; elles ne sont pas des collisions rigides.
        Les enveloppes peuvent inclure du transparent.</p>
      <p>Fermer ce panneau coupe les dessins de debug. Échap pour replier.</p>
      <p><a href="${new URL('../tools/gang-base-history/index.html', import.meta.url).href}" target="_blank" rel="noopener noreferrer">Comparer les anciennes bases du gang ↗</a></p>
    </div>`;
  document.body.appendChild(panel);
  const canvas = document.createElement('canvas');
  canvas.className = 'vivarium-dev-overlay';
  canvas.setAttribute('aria-hidden', 'true'); canvas.hidden = true;
  canvas.width = canvas.height = 0;
  const ctx = canvas.getContext('2d');
  const toggles = Object.fromEntries([...panel.querySelectorAll('[data-debug]')].map(input => [input.dataset.debug, input]));
  const select = panel.querySelector('select'), info = panel.querySelector('.vivarium-dev-actor');
  const stats = panel.querySelector('.vivarium-dev-stats');
  let signature = '', disposed = false;

  function draw() {
    if (disposed || !panel.open || !zone.isConnected || !ctx) return;
    const width = viewport.clientWidth, height = viewport.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (!width || !height) return;
    if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
    if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
    ctx.font = '10px monospace'; ctx.lineWidth = 1;
    if (toggles.ground.checked) {
      ctx.fillStyle = 'rgba(70,230,130,.06)'; ctx.strokeStyle = 'rgba(70,230,130,.5)';
      const top = bounds.groundTop + 40, h = Math.max(0, bounds.groundHeight - 48);
      ctx.fillRect(24, top, Math.max(0, width - 48), h);
      ctx.strokeRect(24, top, Math.max(0, width - 48), h);
    }
    const actors = layout.view();
    const nextSignature = actors.map(s => `${s.order}:${s.entry.label}`).join('|');
    if (signature !== nextSignature) {
      signature = nextSignature;
      const previous = select.value;
      select.replaceChildren(new Option('Tous les acteurs', ''));
      for (const state of actors) select.add(new Option(`#${state.order} ${state.entry.label || 'Acteur'}`, String(state.order)));
      if (actors.some(s => String(s.order) === previous)) select.value = previous;
    }
    for (const state of actors) {
      const { entry, position, x, y, rx, ry } = state;
      const selected = String(state.order) === select.value;
      ctx.lineWidth = selected ? 2 : 1;
      if (toggles.feet.checked) {
        ctx.strokeStyle = selected ? '#fff' : '#5dff9c';
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (toggles.visual.checked) {
        const box = entry.animator?.visualBounds || entry.fallbackMetrics?.visualBounds || { x: 0, y: 0, w: entry.w, h: entry.h };
        ctx.strokeStyle = '#60cfff'; ctx.strokeRect(position.x + box.x, position.y + box.y, box.w, box.h);
      }
      if (toggles.click.checked && entry.el.classList.contains('gang-env-clickable')) {
        ctx.strokeStyle = '#ffb44e'; ctx.setLineDash([3, 3]);
        ctx.strokeRect(position.x, position.y, entry.w, entry.h); ctx.setLineDash([]);
      }
      if (toggles.anchors.checked) {
        ctx.strokeStyle = '#fff'; ctx.beginPath();
        ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y); ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3); ctx.stroke();
        const label = `#${state.order} z:${state.z}`;
        ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(x + 5, y + 3, ctx.measureText(label).width + 4, 13);
        ctx.fillStyle = '#fff'; ctx.fillText(label, x + 7, y + 13);
      }
      if (toggles.targets.checked && state.moving && Number.isFinite(entry.x) && Number.isFinite(entry.y)) {
        ctx.strokeStyle = '#ff80df'; ctx.setLineDash([3, 4]); ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(entry.x + 24, entry.y + 40); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeRect(entry.x + 21, entry.y + 37, 6, 6);
      }
      if (selected) {
        info.textContent = `${entry.label || 'Acteur'} · #${state.order}\n`
          + `Sol : ${Math.round(x)}, ${Math.round(y)} · z ${state.z}\n`
          + `Empreinte : ${Math.round(rx * 2)} × ${Math.round(ry * 2)} px\n`
          + `${state.moving ? 'Marche' : 'Repos'} · direction ${entry.direction || 0}`;
      }
    }
    if (!select.value) info.textContent = 'Sélectionnez un acteur pour ses mesures.';
    const s = layout.stats();
    stats.textContent = `${s.actors} acteurs · ${s.moving} en mouvement\n`
      + `Placement : 8 Hz maximum · ${s.ticks} passages\n`
      + `${s.checks} voisinages testés · ${s.yields} arrêts d'évitement`;
  }
  panel.addEventListener('toggle', () => {
    if (disposed) return;
    canvas.hidden = !panel.open;
    if (panel.open) viewport.appendChild(canvas);
    else { canvas.remove(); canvas.width = canvas.height = 0; }
    layout.inspect(panel.open ? draw : null);
  });
  panel.addEventListener('change', draw);
  const escape = event => { if (event.key === 'Escape' && panel.open) { panel.open = false; panel.querySelector('summary').focus(); } };
  document.addEventListener('keydown', escape);
  return { dispose() {
    disposed = true;
    layout.inspect(null);
    document.removeEventListener('keydown', escape);
    canvas.remove(); panel.remove(); style.remove();
  } };
}
