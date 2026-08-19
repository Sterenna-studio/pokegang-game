import assert from 'node:assert/strict';

// analytics.js lit location.hostname au chargement du module (détection de
// plateforme figée une fois pour la session) — mock minimal avant l'import,
// même convention que les autres tests qui simulent des globals navigateur.
globalThis.location = { hostname: 'localhost' };

const { shouldAutoStartFirstGame } = await import('../modules/ui/hub.js');

// ── Uniquement sur itch, uniquement pour un tout premier lancement ──
// Un joueur qui revient (n'importe quel slot déjà occupé, même en plein
// onboarding) ne doit jamais se faire couper l'herbe sous le pied par un
// démarrage automatique qui écraserait son écran de reprise.
assert.equal(shouldAutoStartFirstGame('itch', false), true, 'itch + aucune save → auto-start');
assert.equal(shouldAutoStartFirstGame('itch', true), false, 'itch + une save existe → pas de coupe-file');
assert.equal(shouldAutoStartFirstGame('web', false), false, 'site principal → jamais, même sans save');
assert.equal(shouldAutoStartFirstGame('dev', false), false, 'environnement dev/preview → jamais');
assert.equal(shouldAutoStartFirstGame('web', true), false);
assert.equal(shouldAutoStartFirstGame('dev', true), false);

console.log('hub autostart tests: ok');
