// Loaded only when help is requested. No state, storage, polling or animation.
export function openVivariumTour(zone, { en = false, onClose = () => {} } = {}) {
  const t = (fr, english) => en ? english : fr;
  const steps = [
    ['#gangSpriteModeSelect', t('Le style des Pokémon', 'Pokémon style'),
      t('Choisissez Donjon Mystère, 2D ou HGSS. Ce réglage concerne uniquement le vivarium ; un sprite classique prend le relais si une variante manque.',
        'Choose Mystery Dungeon, 2D or HGSS. This affects the vivarium only; a classic sprite is used when a variant is missing.')],
    ['#gangSizeModeSelect', t('La taille des Pokémon', 'Pokémon size'),
      t('True size utilise les tailles du Pokédex, avec des limites pour garder la scène lisible. Choisissez Standard pour des tailles plus uniformes.',
        'True size uses Pokédex sizes, capped to keep the scene readable. Choose Standard for more uniform sizes.')],
    ['#gangZoneBgBtn', t('Le fond du vivarium', 'Vivarium background'),
      t('La palette permet de sélectionner un fond personnalisé. Dans « Décor et taille », choisissez QG pour revenir au fond par défaut et à ses différents lieux.',
        'Use the palette to select a custom background. Under “Scene and size”, choose HQ to restore the default background and its activity areas.')],
    ['#gangZoneSrcBtn', t('Plus ou moins de Pokémon', 'More or fewer Pokémon'),
      t('L’œil permet de choisir les sources affichées : vitrine, équipe, pension et formation. Activez ou retirez des sources pour peupler le vivarium ; un même Pokémon n’apparaît qu’une fois.',
        'The eye lets you choose displayed sources: showcase, team, daycare and training. Enable or remove sources to populate the vivarium; each Pokémon appears only once.')],
    ['#gangEnvViewport', t('Des visites et des événements', 'Visitors and events'),
      t('Des événements peuvent survenir ici ! Cliquez sur les visiteurs pour interagir. Ho-Oh accélère et laisse une Arcenci’Aile à chaque clic. Les agents viennent aussi discuter dans la salle d’événements, même lorsqu’ils sont affectés à une zone.',
        'Events can happen here! Click visitors to interact. Ho-Oh speeds up and drops a Rainbow Wing with each click. Agents also visit the event lounge to chat, even when assigned to a zone.')],
  ];
  const previousFocus = zone.querySelector('#gangVivariumHelp') || document.activeElement;
  const details = zone.querySelector('.gang-scene-options');
  const wasOpen = details.open;
  const overlay = document.createElement('div');
  overlay.className = 'gang-tour';
  overlay.innerHTML = `<div class="gang-tour-spot" aria-hidden="true"></div>
    <svg class="gang-tour-arrow" aria-hidden="true"><defs><marker id="gangTourArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs><path marker-end="url(#gangTourArrow)"/></svg>
    <section class="gang-tour-card" role="dialog" aria-modal="true" aria-labelledby="gangTourTitle" aria-describedby="gangTourText">
      <button type="button" class="gang-tour-close" aria-label="${t('Fermer l’aide', 'Close guide')}">×</button>
      <small class="gang-tour-progress"></small><h2 id="gangTourTitle"></h2><p id="gangTourText" aria-live="polite"></p>
      <div class="gang-tour-actions"><button type="button" data-tour-prev>${t('Précédent', 'Previous')}</button><button type="button" data-tour-next></button></div>
    </section>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector('.gang-tour-card'), spot = overlay.querySelector('.gang-tour-spot');
  const arrow = overlay.querySelector('.gang-tour-arrow path[marker-end]');
  const previous = overlay.querySelector('[data-tour-prev]'), next = overlay.querySelector('[data-tour-next]');
  let index = 0, closed = false, target;

  function position() {
    if (closed) return;
    if (!zone.isConnected || !target?.isConnected) { close(); return; }
    const r = target.getBoundingClientRect();
    const w = document.documentElement.clientWidth, h = window.innerHeight;
    // The events step points inside the scene rather than highlighting a huge
    // viewport that could cover both the arrow and popup on mobile.
    const events = index === steps.length - 1;
    const x = events ? r.left + r.width * .5 - 28 : r.left - 5;
    const y = events ? r.top + r.height * .5 - 28 : r.top - 5;
    const left = Math.max(4, x), top = Math.max(4, y);
    const right = Math.min(w - 4, x + (events ? 56 : r.width + 10));
    const bottom = Math.min(h - 4, y + (events ? 56 : r.height + 10));
    Object.assign(spot.style, { left: `${left}px`, top: `${top}px`,
      width: `${Math.max(0, right - left)}px`, height: `${Math.max(0, bottom - top)}px` });
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const cx = Math.max(12, Math.min(w - cw - 12, (left + right - cw) / 2));
    const above = top >= ch + 42;
    const cy = Math.max(12, Math.min(h - ch - 12, above ? top - ch - 32 : bottom + 32));
    Object.assign(card.style, { left: `${cx}px`, top: `${cy}px` });
    const startX = Math.max(cx + 20, Math.min(cx + cw - 20, (left + right) / 2));
    const startY = above ? cy + ch + 3 : cy - 3;
    arrow.setAttribute('d', `M${startX},${startY} L${(left + right) / 2},${above ? top - 3 : bottom + 3}`);
  }

  function show() {
    details.open = index === 1;
    target = zone.querySelector(steps[index][0]);
    if (!target) { close(); return; }
    overlay.querySelector('#gangTourTitle').textContent = steps[index][1];
    overlay.querySelector('#gangTourText').textContent = steps[index][2];
    overlay.querySelector('.gang-tour-progress').textContent = `${index + 1} / ${steps.length}`;
    previous.disabled = index === 0;
    next.textContent = index === steps.length - 1 ? t('Terminer', 'Done') : t('Suivant', 'Next');
    target.scrollIntoView({ block: 'center', behavior: 'instant' });
    position();
    next.focus({ preventScroll: true });
  }
  function keydown(event) {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const buttons = [...card.querySelectorAll('button:not(:disabled)')];
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  function close() {
    if (closed) return;
    closed = true;
    window.removeEventListener('resize', position);
    document.removeEventListener('scroll', position, true);
    document.removeEventListener('keydown', keydown, true);
    details.open = wasOpen;
    overlay.remove();
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    onClose();
  }
  previous.addEventListener('click', () => { if (index > 0) { index--; show(); } });
  next.addEventListener('click', () => { if (index === steps.length - 1) close(); else { index++; show(); } });
  overlay.querySelector('.gang-tour-close').addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  window.addEventListener('resize', position);
  document.addEventListener('scroll', position, true);
  document.addEventListener('keydown', keydown, true);
  show();
  return close;
}
