// Real Chromium + original sheets. Movement timers are stepped explicitly;
// frame animation, image decoding, DOM and CSS run in the actual browser.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.POKEGANG_PLAYWRIGHT_PATH || 'playwright-core');
const root = path.resolve(import.meta.dirname, '..');
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://local').pathname;
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) throw Error('outside root');
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = process.env.POKEGANG_CHARACTERS_BASE_URL?.replace(/\/$/, '')
  || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.POKEGANG_CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 850, height: 600 } });
const page = await context.newPage();
const errors = [], requests = new Map();
page.on('pageerror', error => errors.push(error.message));
page.on('request', req => {
  const url = new URL(req.url());
  if (url.pathname.includes('/vivarium_characters/')) requests.set(url.pathname, (requests.get(url.pathname) || 0) + 1);
});
await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
try {
  await page.goto(origin + '/gang/live.html');
  await page.evaluate(async base => {
    window.env = await import(base + '/gang/environment.js');
    const later = window.setTimeout, cancel = window.clearTimeout;
    window.originalTimers = { later, cancel };
    window.pending = new Map();
    let serial = 0;
    window.setTimeout = (fn, ms) => { pending.set(++serial, { fn, ms }); return serial; };
    window.clearTimeout = id => pending.delete(id);
    const raf = window.requestAnimationFrame, caf = window.cancelAnimationFrame;
    window.rafs = new Set();
    window.requestAnimationFrame = fn => { const id = raf(time => { rafs.delete(id); fn(time); }); rafs.add(id); return id; };
    window.cancelAnimationFrame = id => { rafs.delete(id); caf(id); };
    window.runTimer = id => { const job = pending.get(id); pending.delete(id); job.fn(); };
    Math.random = () => 0.1; // deterministic cameo choice, route and first-leg dialogue
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw Error('localStorage forbidden'); } });
    document.body.innerHTML = '<div id="root"><div id="gangEnvironmentZone" class="gang-environment-zone"></div></div>';
    window.testRoot = document.querySelector('#root');
    window.portraitUrl = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="48"><rect width="32" height="48" fill="orange"/></svg>');
    window.snapshot = { residents: [{ id: 'pk', dex: 52, spriteUrl: portraitUrl, label: 'Miaouss' }], cameoPool: [], backgroundData: { type: 'gradient', value: 'linear-gradient(#30472b,#455b32)' } };
    env.renderEnvironmentZoneFromSnapshot(testRoot, snapshot);
    window.spawnCharacter = entry => {
      snapshot.cameoPool = [entry];
      const resident = document.querySelector('.gang-env-clickable');
      env.updateEnvironmentSnapshot(snapshot);
      if (resident !== document.querySelector('.gang-env-clickable')) throw Error('OBS resident replaced');
      runTimer([...pending].find(([, job]) => job.ms >= 45000 && job.ms <= 90000)[0]);
      runTimer([...pending].find(([, job]) => job.ms === 0)[0]);
    };
  }, origin);
  assert.equal([...requests.keys()].filter(url => url.endsWith('.png')).length, 0, 'No character sheet downloaded at startup');
  const identities = [
    { type: 'nurse', trainerKey: 'nurse' },
    { type: 'scientist', trainerKey: 'scientist' },
    { type: 'agent', trainerKey: 'rocketgrunt' },
    { type: 'rival', trainerKey: 'rocketgruntf', hostile: true },
    { type: 'boss', trainerKey: 'giovanni' },
  ];
  for (const [index, identity] of identities.entries()) {
    await page.evaluate(({ identity, index }) => {
      spawnCharacter({ ...identity, label: identity.type, spriteUrl: portraitUrl, lines: ['Action de test'], followIconUrl: portraitUrl });
      const node = [...document.querySelectorAll('.gang-env-cameo')].at(-1);
      // Pose the actors for a readable reference image; production paths unchanged.
      node.style.transition = 'none';
      node.style.transform = `translate(${100 + index * 125}px,210px)`;
    }, { identity, index });
  }
  await page.waitForFunction(() => document.querySelectorAll('.gang-env-character canvas:not([hidden])').length === 5);
  assert.equal(await page.locator('.gang-env-character').count(), 5);
  assert.equal(await page.evaluate(() => rafs.size), 1, 'All PMD + character actors use one RAF');
  const orientations = await page.evaluate(() => {
    const node = document.querySelector('.gang-env-character');
    return [0, 2, 4, 6].map(direction => {
      node._pmdAnimator.set('Idle', direction);
      const canvas = node.querySelector('canvas');
      return Array.from(canvas.getContext('2d').getImageData(0, 0, 32, 32).data).join(',');
    });
  });
  assert.equal(new Set(orientations).size, 4, 'Real artwork has four distinct orientations');
  await page.evaluate(() => {
    const node = document.querySelector('.gang-env-character');
    node._pmdAnimator.set('Walk', 2);
    window.pixelHash = () => {
      const canvas = node.querySelector('canvas');
      return Array.from(canvas.getContext('2d').getImageData(0, 0, 32, 32).data).join(',');
    };
    window.walkBefore = pixelHash();
  });
  await page.waitForFunction(() => pixelHash() !== walkBefore);
  // Complete the five first legs through the controlled movement timers.
  await page.evaluate(() => {
    const completions = [...pending].filter(([, job]) => job.ms > 3000 && job.ms < 30000);
    for (const [id] of completions) runTimer(id);
  });
  assert.equal(await page.locator('.gang-env-speech-portrait').count(), 5);
  assert.equal(await page.locator('.gang-env-speech-bubble.hostile').count(), 1);
  assert.equal(await page.locator('.gang-env-character .gang-env-cameo-follow').count(), 5);
  await page.evaluate(() => { window.idleBefore = pixelHash(); });
  await page.waitForTimeout(240);
  assert.equal(await page.evaluate(() => pixelHash() === idleBefore), true, 'Idle holds a resting pose');
  await fs.mkdir(path.join(root, 'coverage'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'coverage/vivarium-hgss-characters-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(root, 'coverage/vivarium-hgss-characters-mobile.png'), fullPage: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => rafs.size === 0);
  assert.equal(await page.evaluate(() => rafs.size), 0);
  // Legacy URL-only trainer identity works; unsupported identities stay portraits.
  await page.evaluate(() => {
    spawnCharacter({ type: 'nurse', spriteUrl: '/sprites/nurse.png', lines: [] });
    spawnCharacter({ type: 'agent', trainerKey: 'unsupported', spriteUrl: portraitUrl, lines: [] });
  });
  await page.waitForFunction(() => document.querySelectorAll('.gang-env-character canvas:not([hidden])').length === 6);
  assert.equal(await page.locator('.gang-env-cameo:not(.gang-env-character)').count(), 1);
  assert.ok([...requests].filter(([url]) => url.endsWith('.png')).every(([, count]) => count === 1), 'Repeated nurse appearance reuses one decoded sheet');
  const pngRequests = [...requests.keys()].filter(url => url.endsWith('.png'));
  assert.equal(pngRequests.length, 5, 'Only the five displayed identities download sheets');
  await context.route('**/vivarium_characters/pokefan/Walk.png', route => route.abort());
  await page.evaluate(() => {
    spawnCharacter({ type: 'fan', trainerKey: 'pokefan', spriteUrl: portraitUrl, lines: [] });
  });
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.gang-env-character').last().locator('.gang-env-sprite-inner > img').first().evaluate(img => img.hidden), false, 'Failed sheet leaves the portrait visible');
  assert.equal(await page.locator('.gang-env-character').last().locator('canvas').evaluate(canvas => canvas.hidden), true);
  await page.evaluate(() => env.stopEnvironmentZone());
  assert.deepEqual(await page.evaluate(() => [pending.size, rafs.size, document.querySelectorAll('canvas').length]), [0, 0, 0]);
  assert.deepEqual(errors, []);
  console.log('PASS Chromium HGSS: 5 original characters + PMD, four directions, Walk/Idle, portraits/dialogue/follow icons, OBS updates without localStorage, legacy identity, fallback, cache, mobile, reduced motion, zero timers/RAF');
  console.log('Character PNG requests:', pngRequests.length);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
