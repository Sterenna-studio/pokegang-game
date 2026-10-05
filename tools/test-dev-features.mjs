// modules/core/devFeatures.js : la frontière entre « développement / preview QA » et « version
// publiée ». Elle décide si la vue V2 de la base (un essai d'un autre visuel) est atteignable ;
// un faux positif ici exposerait l'essai aux joueurs, d'où le soin sur les hôtes qui RESSEMBLENT
// à un hôte de développement.
//
//   node tools/test-dev-features.mjs

import assert from 'node:assert/strict';
import { isDevHost, devFeaturesEnabled } from '../modules/core/devFeatures.js';

const failures = [];
const check = (label, fn) => {
  try { fn(); console.log('  ok   ' + label); }
  catch (e) { failures.push(label + ' — ' + e.message); console.log('  FAIL ' + label + '\n         ' + e.message); }
};

console.log('\n── hôtes de développement et de preview : fonctionnalités actives ──');

check('localhost, boucle locale IPv4 et IPv6', () => {
  for (const h of ['localhost', '127.0.0.1', '[::1]']) assert.equal(isDevHost(h), true, h);
});

check('sous-domaines *.localhost', () => {
  for (const h of ['app.localhost', 'pokegang.localhost', 'qa-1.localhost']) assert.equal(isDevHost(h), true, h);
});

check('les previews QA (lab.sterenna.fr)', () => {
  assert.equal(isDevHost('lab.sterenna.fr'), true);
  assert.equal(isDevHost('LAB.Sterenna.FR'), true, 'insensible à la casse');
});

console.log('\n── la version publiée : fonctionnalités coupées ──────────────────');

check('le site publié et ses variantes', () => {
  for (const h of ['pokegang.sterenna.fr', 'sterenna.fr', 'www.sterenna.fr', 'nitro.sterenna.fr']) {
    assert.equal(isDevHost(h), false, h);
  }
});

check('itch.io : page, iframe et CDN du jeu', () => {
  for (const h of ['sterenna.itch.io', 'html-classic.itch.zone', 'v6p9d9t4.ssl.hwcdn.net', 'itch.io']) {
    assert.equal(isDevHost(h), false, h);
  }
});

check('un hôte inconnu retombe sur la version publiée', () => {
  for (const h of ['example.com', 'mirror.pokegang.net', '192.168.1.20', '10.0.0.5', '0.0.0.0']) {
    assert.equal(isDevHost(h), false, h);
  }
});

console.log('\n── les hôtes qui RESSEMBLENT à un hôte de développement ──────────');

check('suffixes et préfixes trompeurs', () => {
  for (const h of [
    'lab.sterenna.fr.evil.com',       // le vrai domaine est evil.com
    'evil-lab.sterenna.fr',           // autre sous-domaine, pas lab.
    'notlab.sterenna.fr',
    'lab.sterenna.fr.',               // point final : un autre nom pour l'analyseur, on refuse par prudence
    'localhost.evil.com',
    'evil.com/localhost',
    'notlocalhost',
    'localhostx',
    'xlocalhost',
    'a.b.localhost',                  // un seul niveau accepté : on reste strict
    '127.0.0.1.evil.com',
    '127.0.0.10',
    '1127.0.0.1',
  ]) assert.equal(isDevHost(h), false, h);
});

check('entrées vides ou invalides : jamais actif', () => {
  for (const h of ['', ' ', undefined, null, 0, false, {}, []]) assert.equal(isDevHost(h), false, JSON.stringify(h));
});

check('une espace autour d\'un vrai hôte de dev ne l\'invalide pas', () => {
  assert.equal(isDevHost(' localhost '), true);
});

console.log('\n── devFeaturesEnabled() lit la page courante ─────────────────────');

check('hors navigateur (pas de location) : inactif', () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'location');
  delete globalThis.location;
  try { assert.equal(devFeaturesEnabled(), false); }
  finally { if (saved) Object.defineProperty(globalThis, 'location', saved); }
});

check('suit globalThis.location.hostname', () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'location');
  try {
    Object.defineProperty(globalThis, 'location', { value: { hostname: 'localhost' }, configurable: true, writable: true });
    assert.equal(devFeaturesEnabled(), true, 'localhost');
    globalThis.location = { hostname: 'pokegang.sterenna.fr' };
    assert.equal(devFeaturesEnabled(), false, 'pokegang.sterenna.fr');
    globalThis.location = { hostname: 'html-classic.itch.zone' };
    assert.equal(devFeaturesEnabled(), false, 'itch');
  } finally {
    if (saved) Object.defineProperty(globalThis, 'location', saved); else delete globalThis.location;
  }
});

console.log('');
if (failures.length) {
  console.error(failures.length + ' échec(s) :');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('OK — les fonctionnalités de développement ne s\'activent que sur localhost et les previews QA.');
