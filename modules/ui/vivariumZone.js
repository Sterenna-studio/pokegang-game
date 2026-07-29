'use strict';

// ════════════════════════════════════════════════════════════════
//  VIVARIUM ZONE — tuile "Vivarium" dans le sélecteur de zones du jeu
//  principal (type:'vivarium' dans data/zones-data.js), miroir de
//  toggleGangParkWindow()/renderGangParkWindow() (modules/ui/gangBase.js)
//  mais affiche le moteur d'animation partagé avec la page cosmétique
//  séparée (gang/environment.js) au lieu du panneau Gang Base.
//
//  gang/environment.js lit directement globalThis.state et gère son
//  propre cycle démarrage/arrêt (setTimeout trackés, jamais de rAF loop)
//  — aucune dépendance à la boucle de jeu principale. On l'arrête
//  explicitement en quittant l'onglet Zones pour ne pas laisser tourner
//  des timers d'animation invisibles en arrière-plan.
//
//  Globals lus via globalThis : openZones, renderZoneSelector, refreshZoneTile
// ════════════════════════════════════════════════════════════════

import { renderEnvironmentZone, stopEnvironmentZone } from '../../gang/environment.js';

let _vivariumOpen = false;

function toggleVivariumWindow() {
  _vivariumOpen = !_vivariumOpen;
  globalThis.openZones?.[_vivariumOpen ? 'add' : 'delete']('vivarium');
  const container = document.getElementById('zoneWindows');
  if (!container) return;
  const existing = document.getElementById('zw-vivarium');
  if (_vivariumOpen) {
    if (!existing) {
      const el = document.createElement('div');
      el.id = 'zw-vivarium';
      el.className = 'zone-window vivarium-window';
      el.innerHTML = `<div id="gangEnvironmentZone" class="gang-environment-zone"></div>`;
      container.prepend(el);
      renderEnvironmentZone(el);
    }
  } else {
    stopEnvironmentZone();
    if (existing) existing.remove();
  }
  globalThis.renderZoneSelector?.();
  globalThis.refreshZoneTile?.('vivarium');
}

// Rappelé quand on revient sur l'onglet Zones avec le vivarium encore
// ouvert — renderEnvironmentZone() arrête proprement les timers existants
// avant de reconstruire, donc rejouable sans état résiduel.
function resumeVivariumWindow() {
  if (!_vivariumOpen) return;
  const el = document.getElementById('zw-vivarium');
  if (el) renderEnvironmentZone(el);
}

// Rappelé en quittant l'onglet Zones — coupe les timers d'animation pendant
// que le joueur regarde un autre onglet (le DOM reste, juste figé).
function pauseVivariumWindow() {
  if (_vivariumOpen) stopEnvironmentZone();
}

Object.assign(globalThis, {
  toggleVivariumWindow,
  resumeVivariumWindow,
  pauseVivariumWindow,
});
export {};
