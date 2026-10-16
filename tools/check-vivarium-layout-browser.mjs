// Original PMD sprites in Chromium. Scene timers are stepped for reproducibility;
// a separate crossing test uses real CSS interpolation. No real player saves.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.POKEGANG_PLAYWRIGHT_PATH || 'playwright-core');
const root = path.resolve(import.meta.dirname, '..');
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' };
async function fileFor(url, prefix = '') {
  const pathname = decodeURIComponent(new URL(url).pathname).slice(prefix.length);
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep)) throw Error('outside root');
  return { body: await fs.readFile(file), contentType: mime[path.extname(file)] || 'application/octet-stream' };
}
const server = http.createServer(async (req, res) => {
  try { const result = await fileFor('http://local' + req.url); res.setHeader('Content-Type', result.contentType); res.end(result.body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.POKEGANG_LAYOUT_BASE_URL?.replace(/\/$/, '') || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.POKEGANG_CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 1100, height: 760 } });
const errors = [], requested = [];
const page = await context.newPage();
page.on('pageerror', e => errors.push(e.message));
page.on('request', r => requested.push(r.url()));
await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
try {
  await page.goto(base + '/gang/live.html');
  await page.evaluate(async base => {
    window.env = await import(base + '/gang/environment.js');
    window.geometry = await import(base + '/gang/vivariumLayout.js');
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw Error('No localStorage in OBS'); } });
    let seed = 271, serial = 0;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    window.pending = new Map();
    window.setTimeout = (fn, ms) => { pending.set(++serial, { fn, ms }); return serial; };
    window.clearTimeout = id => pending.delete(id);
    window.run = id => { const job = pending.get(id); pending.delete(id); job.fn(); };
    window.layoutJobs = () => [...pending].filter(([, job]) => job.ms === 125);
    document.body.innerHTML = '<div id="root"><div id="gangEnvironmentZone" class="gang-environment-zone" style="height:560px"></div></div>';
    window.root = document.querySelector('#root');
    const fallback = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="24" cy="24" r="12" fill="gray"/></svg>');
    const species = [52, 41, 92, 1, 4, 7, 19, 25, 26, 33, 34, 35, 39, 63, 66, 68, 74, 93, 95, 143, 150, 201];
    window.blob = { residents: species.map((dex, i) => ({ id: `layout-${i}`, dex, shiny: i === 0,
      spriteUrl: fallback, label: `Pokémon #${dex}`, level: 20, natureLabel: 'Calme' })), cameoPool: [],
      backgroundData: { type: 'gradient', value: 'linear-gradient(#273d2b,#526a41)' } };
    env.renderEnvironmentZoneFromSnapshot(root, blob);
    // Fix lighting only in this QA scene for readable exported evidence.
    document.querySelector('.gang-env-ambiance').style.background = 'transparent';
  }, base);
  await page.waitForSelector('#vivariumDevPanel');
  await page.waitForFunction(() => document.querySelectorAll('.gang-env-actors canvas:not([hidden])').length === 22);
  assert.equal(await page.locator('.vivarium-dev-overlay').count(), 0, 'No debug canvas before opening');
  assert.equal(await page.evaluate(() => layoutJobs().length), 0, 'Resting actors do not poll positions');
  const initial = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.gang-env-actors > .gang-env-sprite')];
    const feet = nodes.map(node => {
      const p = geometry.readSpritePosition(node);
      return { x: p.x + 24, y: p.y + 40, ...node._pmdAnimator.footprint, z: Number(node.style.zIndex) };
    });
    let overlaps = 0;
    for (let i = 0; i < feet.length; i++) for (let j = i + 1; j < feet.length; j++) if (geometry.groundClearance(feet[i], feet[j]) < 1) overlaps++;
    return { overlaps, sorted: feet.every(a => feet.every(b => a.y >= b.y || a.z < b.z)) };
  });
  assert.equal(initial.overlaps, 0, '22 initial residents have non-overlapping ground footprints');
  assert.equal(initial.sorted, true);
  await page.locator('#vivariumDevPanel summary').click();
  await page.waitForSelector('.vivarium-dev-overlay');
  assert.equal(await page.evaluate(() => layoutJobs().length), 1, 'A single 8Hz inspector task');
  await page.locator('[data-debug="visual"]').check();
  await page.locator('[data-debug="click"]').check();
  await page.locator('[data-debug="targets"]').check();
  await page.locator('#vivariumDevPanel select').selectOption('1');
  assert.match(await page.locator('.vivarium-dev-actor').textContent(), /Empreinte.*px/);
  // The drawer may cover this actor; dispatch its handler independently of it.
  await page.locator('.gang-env-clickable').first().evaluate(el => el.click());
  assert.equal(await page.locator('.gang-env-overlays .gang-env-click-badge').count(), 1);
  assert.ok(await page.locator('.gang-env-overlays').evaluate(el => Number(getComputedStyle(el).zIndex)) > await page.locator('.gang-env-actors').evaluate(el => Number(getComputedStyle(el).zIndex)));
  // Identical OBS update must preserve residents and their current depth.
  assert.ok(await page.evaluate(() => {
    const before = [...document.querySelectorAll('.gang-env-clickable')];
    env.updateEnvironmentSnapshot(structuredClone(blob));
    return before.every((node, i) => node === document.querySelectorAll('.gang-env-clickable')[i]);
  }));
  await fs.mkdir(path.join(root, 'coverage'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'coverage/vivarium-layout-debug-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  await page.evaluate(() => { for (const [id] of layoutJobs()) run(id); });
  assert.ok(await page.locator('#vivariumDevPanel').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
  await page.screenshot({ path: path.join(root, 'coverage/vivarium-layout-debug-mobile.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#vivariumDevPanel').open);
  await page.waitForFunction(() => !document.querySelector('.vivarium-dev-overlay'));
  assert.equal(await page.evaluate(() => layoutJobs().length), 0, 'Closing the inspector releases its task');
  // Actual CSS interpolation, independent of controlled environment timers.
  const before = await page.evaluate(() => {
    const view = document.createElement('div'); document.body.appendChild(view);
    view.style.cssText = 'position:relative;width:300px;height:200px';
    window.cross = geometry.createVivariumLayout(view, {
      later: fn => { window.crossTick = fn; return 1; }, cancel: () => { window.crossTick = null; },
    });
    window.crossActors = [document.createElement('div'), document.createElement('div')].map((el, i) => {
      el.style.transform = `translate(${i * 180}px,${i ? 60 : 110}px)`; cross.actorLayer.appendChild(el);
      const entry = { el, x: i * 180, y: i ? 60 : 110 }; cross.register(entry); return entry;
    });
    const [a, b] = crossActors;
    const front = Number(a.el.style.zIndex) > Number(b.el.style.zIndex);
    a.el.getBoundingClientRect(); cross.moving(a, true);
    a.el.style.transition = 'transform 0.7s linear'; a.el.style.transform = 'translate(0px,20px)';
    return front;
  });
  assert.equal(before, true);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => { crossTick(); return Number(crossActors[0].el.style.zIndex) > Number(crossActors[1].el.style.zIndex); }), true, 'Destination does not prematurely change depth');
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => { crossTick(); return Number(crossActors[0].el.style.zIndex) < Number(crossActors[1].el.style.zIndex); }), true, 'Crossing feet reverses visual depth during CSS movement');
  await page.evaluate(() => { cross.dispose(); env.stopEnvironmentZone(); });
  assert.equal(await page.locator('#vivariumDevPanel, .vivarium-dev-overlay').count(), 0);
  assert.equal(await page.evaluate(() => pending.size), 0);
  assert.deepEqual(errors, []);

  // Also let a dense scene run naturally with unmodified movement timers.
  const natural = await context.newPage();
  natural.on('pageerror', e => errors.push(e.message));
  await natural.goto(base + '/gang/live.html');
  const naturalBlob = await page.evaluate(() => blob);
  await natural.evaluate(async ({ base, blob }) => {
    window.env = await import(base + '/gang/environment.js');
    const later = window.setTimeout, cancel = window.clearTimeout;
    window.naturalPending = new Map();
    window.setTimeout = (fn, ms, ...args) => {
      const id = later(() => { naturalPending.delete(id); fn(...args); }, ms);
      naturalPending.set(id, ms); return id;
    };
    window.clearTimeout = id => { naturalPending.delete(id); cancel(id); };
    document.body.innerHTML = '<div id="root"><div id="gangEnvironmentZone" class="gang-environment-zone"></div></div>';
    env.renderEnvironmentZoneFromSnapshot(document.querySelector('#root'), blob);
    window.initialPositions = [...document.querySelectorAll('.gang-env-clickable')].map(el => getComputedStyle(el).transform);
  }, { base, blob: naturalBlob });
  await natural.waitForTimeout(6000);
  const naturalResult = await natural.evaluate(() => ({
    changed: [...document.querySelectorAll('.gang-env-clickable')].filter((el, i) => getComputedStyle(el).transform !== initialPositions[i]).length,
    samplingTasks: [...naturalPending.values()].filter(ms => ms === 125).length,
    debugOpen: document.querySelector('#vivariumDevPanel')?.open,
  }));
  assert.ok(naturalResult.changed >= 4, 'Residents keep moving in a naturally timed dense scene');
  assert.ok(naturalResult.samplingTasks <= 1, 'Natural movement shares one layout task');
  assert.equal(naturalResult.debugOpen, false);
  await natural.evaluate(() => env.stopEnvironmentZone());
  assert.equal(await natural.evaluate(() => naturalPending.size), 0);
  await natural.close();

  // Serve THIS branch under a simulated production origin; no production writes
  // or player profile. A query string cannot enable the development module.
  const prod = await browser.newContext();
  const prodRequests = [], production = await prod.newPage();
  production.on('request', r => prodRequests.push(r.url()));
  await prod.route('**/*', async route => {
    if (!route.request().url().startsWith('https://pokegang.sterenna.fr/')) return route.abort();
    try { await route.fulfill(await fileFor(route.request().url())); }
    catch { await route.fulfill({ status: 404, body: '' }); }
  });
  await production.goto('https://pokegang.sterenna.fr/gang/live.html?debug=1');
  await production.evaluate(async () => {
    const env = await import('/gang/environment.js');
    document.body.innerHTML = '<div id="root"><div id="gangEnvironmentZone" class="gang-environment-zone"></div></div>';
    env.renderEnvironmentZoneFromSnapshot(document.querySelector('#root'), { residents: [], cameoPool: [] });
  });
  assert.equal(await production.locator('#vivariumDevPanel').count(), 0);
  assert.equal(prodRequests.some(url => /vivariumDev\.(?:js|css)/.test(url)), false, 'Production never downloads the dev panel or its styles');
  await production.evaluate(async () => (await import('/gang/environment.js')).stopEnvironmentZone());
  await prod.close();
  assert.deepEqual(errors, []);
  console.log('PASS Chromium layout/dev: 22 original PMD residents, zero initial footprint overlaps, stable depth/OBS, separate badges, desktop/mobile inspector, close/Escape cleanup, actual CSS crossing, 6s natural dense movement, zero remaining timers, no dev downloads on simulated production');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
