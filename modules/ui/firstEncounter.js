'use strict';

import { esc } from '../core/escape.js';
import { ONBOARDING_STARTERS } from '../../data/onboarding-data.js';

const _t = (fr, en) => (globalThis.state?.lang === 'en' ? en : fr);
const _name = starter => _t(starter.fr, starter.nameEn);

function _injectStyles() {
  if (document.getElementById('onboarding-first-encounter-styles')) return;
  const style = document.createElement('style');
  style.id = 'onboarding-first-encounter-styles';
  style.textContent = `
    #onboarding-first-encounter{position:fixed;inset:0;z-index:8100;background:radial-gradient(circle at 50% 35%,#172317 0,#090d0b 58%,#050506 100%);display:flex;align-items:center;justify-content:center;padding:20px;font-family:var(--font-system,sans-serif)}
    .ofe-panel{width:min(720px,96vw);border:1px solid rgba(252,200,0,.35);border-radius:12px;background:rgba(9,10,12,.96);padding:24px;box-shadow:0 24px 80px rgba(0,0,0,.7);text-align:center}
    .ofe-kicker{font-family:var(--font-pixel,monospace);font-size:8px;letter-spacing:.14em;color:var(--gold);margin-bottom:12px}
    .ofe-title{font-family:var(--font-pixel,monospace);font-size:13px;line-height:1.6;color:var(--text);margin-bottom:8px}
    .ofe-help{font-size:12px;color:var(--text-dim);margin-bottom:20px}
    .ofe-field{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;min-height:190px;align-items:end}
    .ofe-target{border:1px solid var(--border);border-radius:9px;background:rgba(255,255,255,.025);padding:12px 8px;cursor:pointer;transition:.18s transform,.18s border-color,.18s background;position:relative;overflow:visible}
    .ofe-target:hover,.ofe-target.selected{transform:translateY(-5px);border-color:var(--gold);background:rgba(252,200,0,.07)}
    .ofe-target img{width:82px;height:82px;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 8px 10px rgba(0,0,0,.6))}
    .ofe-name{font-family:var(--font-pixel,monospace);font-size:8px;color:var(--text);margin-top:8px}
    .ofe-types{font-size:9px;color:var(--text-dim);margin-top:5px}
    .ofe-actions{display:flex;justify-content:center;margin-top:22px;min-height:42px}
    .ofe-capture{font-family:var(--font-pixel,monospace);font-size:9px;border:1px solid var(--gold);border-radius:6px;background:#302600;color:#fff;padding:11px 20px;cursor:pointer}
    .ofe-capture:disabled{opacity:.35;cursor:default}
    .ofe-ball{position:absolute;width:28px;height:28px;left:50%;bottom:-38px;transform:translateX(-50%);z-index:3;pointer-events:none}
    .ofe-ball img{width:28px;height:28px;image-rendering:pixelated}
    .ofe-ball.throw{animation:ofeThrow .45s ease-out forwards}
    .ofe-ball.wobble{animation:ballWobble .42s ease-in-out 3}
    .ofe-success{font-family:var(--font-pixel,monospace);font-size:9px;color:var(--gold);line-height:1.8}
    @keyframes ofeThrow{0%{bottom:-38px;transform:translateX(-50%) scale(.75) rotate(0)}100%{bottom:64px;transform:translateX(-50%) scale(1) rotate(540deg)}}
    @media(max-width:620px){.ofe-field{grid-template-columns:1fr;align-items:center}.ofe-target{display:grid;grid-template-columns:80px 1fr;align-items:center;text-align:left}.ofe-target img{grid-row:1/3}.ofe-panel{max-height:94vh;overflow:auto}}
  `;
  document.head.appendChild(style);
}

/**
 * First playable action of onboarding V2. Mutation remains delegated to the
 * injected onCapture callback so this UI uses the normal capture system.
 */
export function openFirstEncounter({ pokeSprite, ballSprite, onCapture } = {}) {
  if (document.getElementById('onboarding-first-encounter')) {
    return Promise.reject(new Error('[onboarding] First encounter is already open'));
  }
  _injectStyles();

  return new Promise((resolve, reject) => {
    let selected = null;
    let resolving = false;
    const overlay = document.createElement('div');
    overlay.id = 'onboarding-first-encounter';
    overlay.innerHTML = `
      <section class="ofe-panel" role="dialog" aria-modal="true" aria-labelledby="ofeTitle">
        <div class="ofe-kicker">${_t('PREMIÈRE OPÉRATION', 'FIRST OPERATION')}</div>
        <div class="ofe-title" id="ofeTitle">${_t('Trois silhouettes surgissent. Laquelle vas-tu capturer ?', 'Three silhouettes appear. Which one will you catch?')}</div>
        <div class="ofe-help">${_t('Choisis une cible, puis lance ta Poké Ball. Cette première capture est garantie.', 'Choose a target, then throw your Poké Ball. This first catch is guaranteed.')}</div>
        <div class="ofe-field">
          ${ONBOARDING_STARTERS.map(starter => `
            <button class="ofe-target" type="button" data-species="${starter.en}" aria-label="${esc(_name(starter))}">
              <img src="${pokeSprite?.(starter.en, false) || ''}" alt="${esc(_name(starter))}">
              <div class="ofe-name">${esc(_name(starter))}</div>
              <div class="ofe-types">${(_t(starter.types, starter.typesEn) || []).join(' · ')}</div>
            </button>`).join('')}
        </div>
        <div class="ofe-actions"><button class="ofe-capture" type="button" disabled>${_t('Lancer la Poké Ball', 'Throw the Poké Ball')}</button></div>
      </section>`;
    document.body.appendChild(overlay);

    const captureBtn = overlay.querySelector('.ofe-capture');
    overlay.querySelectorAll('.ofe-target').forEach(target => {
      target.addEventListener('click', () => {
        if (resolving) return;
        overlay.querySelectorAll('.ofe-target').forEach(el => el.classList.remove('selected'));
        target.classList.add('selected');
        selected = target.dataset.species;
        captureBtn.disabled = false;
      });
    });

    captureBtn.addEventListener('click', async () => {
      if (!selected || resolving) return;
      resolving = true;
      captureBtn.disabled = true;
      const target = overlay.querySelector(`[data-species="${selected}"]`);
      const ball = document.createElement('div');
      ball.className = 'ofe-ball throw';
      ball.innerHTML = `<img src="${ballSprite || ''}" alt="">`;
      target.appendChild(ball);
      globalThis.SFX?.play?.('ballThrow');

      try {
        await new Promise(done => setTimeout(done, 470));
        ball.className = 'ofe-ball wobble';
        await new Promise(done => setTimeout(done, 1320));
        const pokemon = await onCapture?.(selected);
        if (!pokemon) throw new Error(`Unable to capture onboarding starter: ${selected}`);
        target.querySelector('img').style.filter = 'brightness(2) drop-shadow(0 0 16px gold)';
        overlay.querySelector('.ofe-actions').innerHTML = `<div class="ofe-success">${_t('CAPTURE RÉUSSIE !', 'CAUGHT!')}<br>${esc(_name(ONBOARDING_STARTERS.find(item => item.en === selected)))}</div>`;
        await new Promise(done => setTimeout(done, 850));
        overlay.remove();
        resolve({ species: selected, pokemon });
      } catch (error) {
        overlay.remove();
        reject(error);
      }
    });
  });
}
