// Real DOM/CSS/PNG and isolated saves; only long cameo timers are stepped.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.POKEGANG_PLAYWRIGHT_PATH || 'playwright-core');
const root = path.resolve(import.meta.dirname, '..');
const server = http.createServer(async (req, res) => {
  try {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://local').pathname);
    if (!file.startsWith(root + path.sep)) throw Error('outside');
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.POKEGANG_VISITORS_BASE_URL?.replace(/\/$/, '') || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.POKEGANG_CHROMIUM_PATH || undefined });
try {
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const seed = await fs.readFile(path.join(root, 'tools/dev-seed-save.json'), 'utf8');
  await page.addInitScript(json => localStorage.setItem('pokeforge.v6', json), seed);
  await page.goto(base + '/gang/index.html');
  await page.waitForSelector('#gangSpriteModeSelect');
  await page.evaluate(async base => {
    window.env = await import(base + '/gang/environment.js');
    env.stopEnvironmentZone();
    window.pending = new Map();
    let serial = 0;
    window.setTimeout = (fn, ms) => { pending.set(++serial, { fn, ms }); return serial; };
    window.clearTimeout = id => pending.delete(id);
    window.runTimer = id => { const job = pending.get(id); pending.delete(id); job.fn(); };
    Math.random = () => .1;
    state.cosmetics.vivariumTrueSize = true;
    state.cosmetics.vivariumSpriteMode = 'pmd';
    env.renderEnvironmentZone(document);
    // Simulate progress saved by the main game while cosmetics held older data.
    const fresh = JSON.parse(localStorage.getItem('pokeforge.v6'));
    fresh.inventory ||= {};
    fresh.inventory.rainbow_wing = 17;
    fresh.hoohMission = { active: true, step: 2, rainbowWings: 4 };
    fresh.stats = { ...fresh.stats, qaSentinel: 1234 };
    localStorage.setItem('pokeforge.v6', JSON.stringify(fresh));
    runTimer([...pending].find(([, job]) => job.ms >= 45000 && job.ms <= 90000)[0]);
    runTimer([...pending].find(([, job]) => job.ms === 0)[0]);
  }, base);
  await page.waitForSelector('.gang-env-cameo canvas:not([hidden])');
  const hooh = page.locator('.gang-env-cameo');
  await hooh.evaluate(el => {
    el.style.transition = 'none';
    el.style.transform = 'translate(160px,100px)';
    el.getBoundingClientRect();
  });
  await hooh.click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pokeforge.v6')).inventory.rainbow_wing), 18);
  assert.deepEqual(await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('pokeforge.v6'));
    return [saved.hoohMission.step, saved.hoohMission.rainbowWings, saved.stats.qaSentinel];
  }), [3, 5, 1234], 'Reward preserves fresh progress and advances the quest');
  const speed = Number(await hooh.getAttribute('data-speed-factor'));
  await hooh.focus();
  await page.keyboard.press('Enter');
  assert.ok(Number(await hooh.getAttribute('data-speed-factor')) > speed);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pokeforge.v6')).inventory.rainbow_wing), 19);
  assert.equal(await page.locator('.gang-env-speech-bubble').count(), 1, 'Rapid clicks replace the previous reward bubble');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await hooh.evaluate(el => {
    const p = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    const viewport = document.querySelector('#gangEnvViewport');
    return p.m42 >= 0 && p.m42 + 48 < viewport.clientHeight;
  }), 'Ho-Oh touch target stays above the bottom edge');
  await fs.mkdir(path.join(root, 'coverage'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'coverage/vivarium-visitors-mobile.png'), fullPage: true });
  const remote = await page.evaluate(async base => {
    env.stopEnvironmentZone();
    if (pending.size) throw Error('Local visit timers leaked');
    const sizes = await import(base + '/gang/pokemonSize.js');
    const blob = { residents: [], cameoPool: [{ type: 'event', dex: 250, label: 'Ho-Oh',
      spriteUrl: base + '/assets/pokemon_pmd/250/Idle.png', lines: [] }],
      backgroundData: { type: 'gradient', value: 'linear-gradient(#345,#456)' } };
    // Even a same-page switch to OBS must disable rewards; a stale global
    // state/reward callback must not accidentally enable writes.
    const saved = localStorage.getItem('pokeforge.v6');
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw Error('OBS storage access'); } });
    try {
      env.renderEnvironmentZoneFromSnapshot(document, blob);
      runTimer([...pending].find(([, job]) => job.ms >= 45000 && job.ms <= 90000)[0]);
      runTimer([...pending].find(([, job]) => job.ms === 0)[0]);
      document.querySelector('.gang-env-cameo').click();
      env.stopEnvironmentZone();
      if (pending.size) throw Error('Remote visit timers leaked');
      blob.cameoPool = [{ type: 'agent', trainerKey: 'rocketgrunt',
        label: 'Agent en patrouille', spriteUrl: blob.cameoPool[0].spriteUrl,
        lines: ['Petite pause entre deux patrouilles.'], location: 'rest', resting: false }];
      env.renderEnvironmentZoneFromSnapshot(document, blob);
      runTimer([...pending].find(([, job]) => job.ms >= 45000 && job.ms <= 90000)[0]);
      runTimer([...pending].find(([, job]) => job.ms === 0)[0]);
      document.querySelector('.gang-env-cameo').click();
      if (!document.querySelector('.gang-env-speech-bubble').textContent.includes('entre deux patrouilles')) throw Error('Assigned agent has no contextual click dialogue');
      if (!document.querySelector('.gang-env-cameo').classList.contains('idle')) throw Error('Talking agent did not pause');
      if (![...pending.values()].some(job => job.ms >= 6500 && job.ms <= 14000)) throw Error('Insufficient reading time');
      env.stopEnvironmentZone();
      if (pending.size) throw Error('Agent visit timers leaked');
    } finally { Object.defineProperty(window, 'localStorage', descriptor); }
    return { unchanged: saved === localStorage.getItem('pokeforge.v6'),
      groudon: sizes.pokemonDisplayHeight(383, true), rayquaza: sizes.pokemonDisplayHeight(384, true) };
  }, base);
  assert.equal(remote.unchanged, true);
  assert.ok(remote.groudon > 88 && remote.rayquaza > remote.groudon);
  assert.deepEqual(errors, []);
  console.log('PASS Chromium visitors: real Ho-Oh, click/keyboard wings and acceleration, fresh-save preservation, quest completion, one bubble, mobile target, readonly OBS, zero leftover timers');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
