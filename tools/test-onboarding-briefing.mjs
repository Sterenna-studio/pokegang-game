import assert from 'node:assert/strict';

import { ONBOARDING_BRIEFING_SLIDES } from '../data/onboarding-data.js';

// ── Contenu ────────────────────────────────────────────────────────
assert.ok(ONBOARDING_BRIEFING_SLIDES.length >= 4 && ONBOARDING_BRIEFING_SLIDES.length <= 5,
  'issue #76 asks for 4-5 slides max');
assert.equal(ONBOARDING_BRIEFING_SLIDES.length, 5);
for (const slide of ONBOARDING_BRIEFING_SLIDES) {
  assert.ok(slide.id, 'each slide needs a stable id');
  for (const lang of ['fr', 'en']) {
    assert.ok(slide[lang]?.title?.length > 0, `${slide.id}.${lang}.title must not be empty`);
    assert.ok(slide[lang]?.body?.length > 0, `${slide.id}.${lang}.body must not be empty`);
  }
}
// La 3e slide met la vente en avant-plan (commentaire de révision de
// l'issue #76) — pas de CTA de vente réelle, texte narratif uniquement.
assert.equal(ONBOARDING_BRIEFING_SLIDES[2].id, 'sell');
assert.match(ONBOARDING_BRIEFING_SLIDES[2].fr.title, /VENDS/i);
// La dernière slide doit amener naturellement sur l'apparition d'un Pokémon.
assert.match(ONBOARDING_BRIEFING_SLIDES.at(-1).fr.body, /bouge/i);

// ── Environnement minimal ────────────────────────────────────────────
// Le briefing ne dépend d'aucun DOM réel : juste document.createElement,
// document.body, getElementById (garde anti-double-ouverture) et
// document/overlay.addEventListener pour le clavier/le clic. innerHTML
// n'est jamais réellement parsé : querySelector() détecte juste la présence
// d'un `data-action="…"` dans le HTML généré et renvoie un faux bouton dont
// on peut invoquer le handler enregistré — suffisant pour vérifier la
// navigation sans reconstruire un DOM complet.
class FakeEl {
  constructor() {
    this.id = '';
    this.className = '';
    this._html = '';
    this._listeners = {};
    this._buttonHandlers = {};
    this._removed = false;
  }
  set innerHTML(value) {
    this._html = String(value);
    this._buttonHandlers = {};
  }
  get innerHTML() { return this._html; }
  querySelector(sel) {
    const m = /\[data-action="(\w+)"\]/.exec(sel);
    if (!m) return null;
    const action = m[1];
    if (!this._html.includes(`data-action="${action}"`)) return null;
    const handlers = this._buttonHandlers;
    return { addEventListener: (type, handler) => { handlers[action] = handler; } };
  }
  addEventListener(type, handler) { this._listeners[type] = handler; }
  removeEventListener(type) { delete this._listeners[type]; }
  remove() { this._removed = true; }
  click() { this._listeners.click?.({}); }
  clickButton(action) { this._buttonHandlers[action]?.({ stopPropagation() {} }); }
}

const created = [];
let keydownHandler = null;
globalThis.document = {
  getElementById: id => created.find(el => el.id === id && !el._removed) || null,
  createElement: () => { const el = new FakeEl(); created.push(el); return el; },
  body: { appendChild: () => {} },
  addEventListener: (type, handler) => { if (type === 'keydown') keydownHandler = handler; },
  removeEventListener: (type) => { if (type === 'keydown') keydownHandler = null; },
};

const analyticsEvents = [];
globalThis.trackEvent = (name, params) => analyticsEvents.push({ name, params });

const { showOnboardingBriefing } = await import('../modules/ui/onboardingBriefing.js');

function currentOverlay() {
  return created.find(el => el.id === 'onboardingBriefing' && !el._removed);
}

// ── Navigation par clic (bouton "Suivant") ───────────────────────────
let doneCount = 0;
assert.equal(showOnboardingBriefing({ onDone: () => { doneCount++; } }), true);
assert.ok(analyticsEvents.some(e => e.name === 'onboarding_briefing_started'));
// Un briefing déjà ouvert ne doit pas s'en ouvrir un second.
assert.equal(showOnboardingBriefing({ onDone: () => { doneCount++; } }), false);

let overlay = currentOverlay();
assert.ok(overlay, 'overlay should be mounted');
assert.match(overlay.innerHTML, /DIRIGE TON GANG|LEAD YOUR GANG/); // slide 0

// Le bouton stoppe sa propre propagation : un clic dessus ne doit avancer
// qu'une fois, pas deux (bouton + catch-all de l'overlay).
overlay.clickButton('next');
assert.match(currentOverlay().innerHTML, /CAPTURE DES POKÉMON|CATCH POKÉMON/); // slide 1

// Clic n'importe où (pas sur un bouton) avance aussi.
overlay = currentOverlay();
overlay.click();
assert.match(currentOverlay().innerHTML, /VENDS LE SURPLUS|SELL THE SURPLUS/); // slide 2

overlay = currentOverlay();
overlay.clickButton('next');
assert.match(currentOverlay().innerHTML, /RECRUTE DES AGENTS|RECRUIT AGENTS/); // slide 3

overlay = currentOverlay();
overlay.click();
assert.match(currentOverlay().innerHTML, /ATTENTION|WATCH OUT/); // slide 4 (last)

// Dernière slide : ni bouton Suivant ni bouton Passer.
overlay = currentOverlay();
assert.equal(/data-action="next"/.test(overlay.innerHTML), false);
assert.equal(/data-action="skip"/.test(overlay.innerHTML), false);

// Un clic sur la dernière slide termine immédiatement (sans attendre le délai auto).
overlay.click();
assert.equal(doneCount, 1);
assert.equal(currentOverlay(), undefined, 'overlay should be removed');
assert.ok(analyticsEvents.some(e => e.name === 'onboarding_briefing_completed'));
const completedEvt = analyticsEvents.find(e => e.name === 'onboarding_briefing_completed');
assert.equal(completedEvt.params.slides_seen, ONBOARDING_BRIEFING_SLIDES.length);

// ── Passer ────────────────────────────────────────────────────────────
analyticsEvents.length = 0;
doneCount = 0;
showOnboardingBriefing({ onDone: () => { doneCount++; } });
currentOverlay().clickButton('skip');
assert.equal(doneCount, 1);
assert.ok(analyticsEvents.some(e => e.name === 'onboarding_briefing_skipped'));
assert.equal(analyticsEvents.some(e => e.name === 'onboarding_briefing_completed'), false);

// ── Clavier ───────────────────────────────────────────────────────────
analyticsEvents.length = 0;
doneCount = 0;
showOnboardingBriefing({ onDone: () => { doneCount++; } });
keydownHandler({ key: 'ArrowRight', preventDefault() {} });
assert.match(currentOverlay().innerHTML, /CAPTURE DES POKÉMON|CATCH POKÉMON/);
keydownHandler({ key: 'Escape' });
assert.equal(doneCount, 1);
assert.ok(analyticsEvents.some(e => e.name === 'onboarding_briefing_skipped'));

console.log('onboarding briefing tests: ok');
