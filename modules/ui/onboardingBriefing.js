'use strict';

// ════════════════════════════════════════════════════════════════
//  onboardingBriefing.js — briefing de bienvenue (issue #76)
//
//  Écran plein page affiché une fois avant l'ouverture du terrain, pour un
//  nouveau joueur itch sans save (cf. modules/ui/firstRunSplash.js). Ne fait
//  partie d'aucune étape de state.onboarding — il tourne AVANT que
//  startOnboardingV2() ne soit appelé, purement présentationnel : le contenu
//  vit dans data/onboarding-data.js (ONBOARDING_BRIEFING_SLIDES), la
//  présentation dans css/onboarding.css sous le préfixe `ob-*`.
//
//  Navigation : clic n'importe où, bouton Suivant, flèche/Espace/Entrée
//  avancent d'une slide ; Échap ou le bouton Passer terminent directement.
//  La dernière slide (« Attention… ») n'a ni bouton Suivant ni bouton
//  Passer — elle enchaîne seule après une courte pause sur l'ouverture du
//  terrain, qu'un clic peut aussi écourter. Aucune slide ne câble d'action
//  de vente réelle : la 3e est de la pure copie narrative.
//
//  Dépendances injectées via configureOnboardingBriefing : getState
// ════════════════════════════════════════════════════════════════

import { ONBOARDING_BRIEFING_SLIDES } from '../../data/onboarding-data.js';
import { ONBOARDING_VERSION } from '../systems/onboardingFlow.js';

let _ctx = {};
export function configureOnboardingBriefing(ctx = {}) { _ctx = { ..._ctx, ...ctx }; }

const OVERLAY_ID = 'onboardingBriefing';
const LAST_SLIDE_HOLD_MS = 1800;

const _state = () => _ctx.getState?.() ?? globalThis.state;
const _t = (fr, en) => (_state()?.lang === 'en' ? en : fr);

// Tourne avant que state.onboarding n'existe (gang.initialized encore false)
// — ne peut pas réutiliser le _track() d'onboarding.js, qui lit
// state.onboarding.step. Wrapper local minimal, même convention par ailleurs.
function _track(name, params = {}) {
  globalThis.trackEvent?.(name, { onboarding_version: ONBOARDING_VERSION, ...params });
}

/**
 * Affiche le briefing. `onDone` est appelé exactement une fois, que le
 * joueur ait terminé naturellement, cliqué Passer, ou pressé Échap.
 * Renvoie false si un briefing est déjà affiché (jamais deux à la fois).
 */
export function showOnboardingBriefing({ onDone } = {}) {
  if (document.getElementById(OVERLAY_ID)) return false;

  const slides = ONBOARDING_BRIEFING_SLIDES;
  let index = 0;
  let done = false;
  let lastSlideTimer = 0;

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'ob-overlay';
  document.body.appendChild(overlay);

  function _clearLastSlideTimer() {
    if (!lastSlideTimer) return;
    clearTimeout(lastSlideTimer);
    lastSlideTimer = 0;
  }

  function _finish(reason) {
    if (done) return;
    done = true;
    _clearLastSlideTimer();
    _track(reason === 'skipped' ? 'onboarding_briefing_skipped' : 'onboarding_briefing_completed',
      reason === 'skipped' ? { slide_index: index } : { slides_seen: index + 1 });
    document.removeEventListener('keydown', _onKeydown);
    overlay.remove();
    onDone?.();
  }

  function _advance() {
    if (done) return;
    if (index >= slides.length - 1) { _finish('completed'); return; }
    index++;
    _render();
  }

  function _onKeydown(e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); _advance(); }
    else if (e.key === 'Escape') { _finish('skipped'); }
  }
  document.addEventListener('keydown', _onKeydown);

  function _render() {
    _clearLastSlideTimer();
    const slide = slides[index];
    const copy = _t(slide.fr, slide.en);
    const isLast = index === slides.length - 1;
    const dots = slides.map((_s, i) => `<div class="ob-dot${i === index ? ' active' : ''}${i < index ? ' done' : ''}"></div>`).join('');

    overlay.innerHTML = `
      ${isLast ? '' : `<button class="ob-skip" data-action="skip">${_t('Passer', 'Skip')}</button>`}
      <div class="ob-box">
        <div class="ob-title">${copy.title}</div>
        <div class="ob-body">${copy.body}</div>
        <div class="ob-dots">${dots}</div>
        ${isLast ? '' : `<button class="ob-next" data-action="next">${_t('Suivant →', 'Next →')}</button>`}
      </div>`;

    overlay.querySelector('[data-action="next"]')?.addEventListener('click', e => { e.stopPropagation(); _advance(); });
    overlay.querySelector('[data-action="skip"]')?.addEventListener('click', e => { e.stopPropagation(); _finish('skipped'); });

    if (isLast) lastSlideTimer = setTimeout(() => _finish('completed'), LAST_SLIDE_HOLD_MS);
  }

  // Clic n'importe où sur l'overlay avance — les boutons stoppent leur
  // propre clic (stopPropagation) pour ne jamais avancer deux fois d'un
  // même geste.
  overlay.addEventListener('click', () => {
    if (index >= slides.length - 1) _finish('completed');
    else _advance();
  });

  _track('onboarding_briefing_started', {});
  _render();
  return true;
}
