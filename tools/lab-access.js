import { devFeaturesEnabled } from '../modules/core/devFeatures.js';

export function openLab() {
  const allowed = devFeaturesEnabled();
  document.querySelector('#lab').hidden = !allowed;
  const gate = document.querySelector('#gate');
  gate.hidden = allowed;
  gate.textContent = allowed ? '' : 'Ces outils sont réservés au lab et au développement local.';
  return allowed;
}
