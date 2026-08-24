import assert from 'node:assert/strict';

// analytics.js lit location.hostname au chargement du module — mock minimal
// avant l'import, même convention que test-hub-autostart.mjs.
globalThis.location = { hostname: 'localhost' };

const classes = new Set();
globalThis.document = { body: { classList: { add: cls => classes.add(cls) } } };

const {
  configureFirstRunSplash,
  hideFirstRunSplash,
  shouldShowFirstRunSplash,
} = await import('../modules/ui/firstRunSplash.js');

// ── Décision : identique à shouldAutoStartFirstGame (itch + aucune save) ──
let previews = {};
configureFirstRunSplash({ getSlotPreview: index => previews[index] ?? null });

globalThis.location.hostname = 'foo.itch.io';
previews = {};
assert.equal(shouldShowFirstRunSplash(), true, 'itch + aucune save → splash');

previews = { 1: { name: 'Team Fury' } };
assert.equal(shouldShowFirstRunSplash(), false, 'itch + une save existe → pas de splash');

previews = {};
globalThis.location.hostname = 'pokegang.sterenna.fr';
assert.equal(shouldShowFirstRunSplash(), false, 'site principal → jamais, même sans save');

globalThis.location.hostname = 'localhost';
assert.equal(shouldShowFirstRunSplash(), false, 'environnement dev/preview → jamais');

// ── hideFirstRunSplash : pose la classe, idempotent ──────────────────────
assert.equal(classes.has('first-run-splash-skip'), false);
hideFirstRunSplash();
assert.equal(classes.has('first-run-splash-skip'), true);
hideFirstRunSplash(); // ne doit pas planter en étant rappelée
assert.equal(classes.size, 1);

console.log('first-run splash tests: ok');
