// Real Chromium checks. Requires an existing playwright-core installation:
// POKEGANG_PLAYWRIGHT_PATH=/path/to/playwright-core node tools/check-vivarium-pmd-browser.mjs
// All PMD sheets served here are test-only geometric drawings, never Pokémon art.
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
    const urlPath = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    const file = path.resolve(root, '.' + (urlPath === '/' ? '/gang/index.html' : urlPath));
    if (!file.startsWith(root + path.sep)) throw new Error('outside root');
    const data = await fs.readFile(file);
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.POKEGANG_CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 1100, height: 760 } });
const errors = [], requests = new Map();
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('request', req => requests.set(new URL(req.url()).pathname, (requests.get(new URL(req.url()).pathname) || 0) + 1));
// Isolate all graphical tests from real providers, tracking and player profiles.
await context.route('**/*', async route => {
  if (!route.request().url().startsWith(origin)) return route.abort();
  return route.continue();
});
try {
  await page.goto(origin + '/gang/live.html');
  const fixtures = await page.evaluate(() => {
    const metadata = {}, pngs = {};
    for (const [dex, iw, ih, wn, wh, durations] of [
      [52, 32, 32, 4, 32, [6, 10, 6, 10]],
      [41, 32, 56, 8, 56, Array(8).fill(6)],
      [92, 48, 56, 12, 64, Array(12).fill(6)],
    ]) {
      metadata[dex] = {};
      for (const variant of ['normal', 'shiny']) {
        const animations = {};
        for (const name of ['Idle', 'Walk']) {
          const w = dex === 52 && name === 'Walk' ? 24 : iw;
          const h = name === 'Walk' ? wh : ih;
          const d = name === 'Walk' ? durations : dex === 52 ? [12, 12, 12, 12] : dex === 92 ? Array(6).fill(10) : [10, 6, 6, 6, 6, 6, 6, 8];
          const file = `${dex}/${variant === 'shiny' ? 's/' : ''}${name}.png`;
          animations[name] = { file, w, h, n: d.length, r: 8, d, ax: (w - 1) / 2, ay: h / 2 + 3.5 };
          const c = document.createElement('canvas'); c.width = w * d.length; c.height = h * 8;
          const ctx = c.getContext('2d');
          for (let row = 0; row < 8; row++) for (let frame = 0; frame < d.length; frame++) {
            ctx.fillStyle = `hsl(${row * 40 + (variant === 'shiny' ? 20 : 0)} 80% ${40 + frame * 3}%)`;
            ctx.fillRect(frame * w + 5, row * h + 5, w - 10, h - 10);
          }
          pngs['/assets/pokemon_pmd/' + file] = c.toDataURL().split(',')[1];
        }
        metadata[dex][variant] = animations;
      }
    }
    return { metadata, pngs };
  });
  await context.route('**/assets/pokemon_pmd/metadata.js', route => route.fulfill({
    contentType: 'text/javascript', body: `export const PMD_METADATA = ${JSON.stringify(fixtures.metadata)};`,
  }));
  await context.route('**/assets/pokemon_pmd/**/*.png', route => route.fulfill({ contentType: 'image/png',
    body: Buffer.from(fixtures.pngs[new URL(route.request().url()).pathname], 'base64') }));
  // Reload modules with the synthetic catalog, instrument timers before import.
  await page.reload();
  await page.evaluate(async () => {
    const pending = new Set(), frames = new Set();
    const later = window.setTimeout, cancel = window.clearTimeout, raf = window.requestAnimationFrame, caf = window.cancelAnimationFrame;
    window.setTimeout = (fn, ms, ...args) => { const id = later(() => { pending.delete(id); fn(...args); }, ms); pending.add(id); return id; };
    window.clearTimeout = id => { pending.delete(id); cancel(id); };
    window.requestAnimationFrame = fn => { const id = raf(t => { frames.delete(id); fn(t); }); frames.add(id); return id; };
    window.cancelAnimationFrame = id => { frames.delete(id); caf(id); };
    window.testResources = { pending, frames };
    window.env = await import('/gang/environment.js');
    // Snapshot renderer must not depend on localStorage, game state or auth.
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw Error('localStorage forbidden'); } });
    document.body.innerHTML = '<div id="root"><div id="gangEnvironmentZone" class="gang-environment-zone" style="height:480px"></div></div>';
    window.testRoot = document.querySelector('#root');
    const spriteUrl = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="gray"/></svg>');
    window.snapshot = { residents: [52, 41, 92, 52, 999].map((dex, i) => ({
      id: `pk-${i}`, dex, shiny: i === 3, label: `TEST ${dex}`, level: 12, natureLabel: 'Hardy', spriteUrl,
    })), cameoPool: [], backgroundData: { type: 'gradient', value: 'linear-gradient(#143524,#234)' } };
    env.renderEnvironmentZoneFromSnapshot(testRoot, snapshot);
  });
  await page.waitForFunction(() => document.querySelectorAll('canvas:not([hidden])').length === 4);
  assert.equal(await page.locator('.gang-env-sprite').count(), 5);
  assert.equal(await page.locator('.gang-env-sprite-inner > img:not([hidden])').count(), 1);
  // The rendered frame changes at rest and while moving, with no square stretch.
  await page.waitForFunction(() => [...document.querySelectorAll('.gang-env-sprite:not(.idle) canvas')].length > 0);
  await page.waitForFunction(() => Object.keys(performance.getEntriesByType('resource').filter(r => r.name.includes('/Walk.png'))).length > 0);
  const preserved = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.gang-env-sprite')];
    env.updateEnvironmentSnapshot(structuredClone(snapshot));
    return nodes.every((node, i) => node === document.querySelectorAll('.gang-env-sprite')[i]);
  });
  assert.ok(preserved, 'OBS polling preserves resident nodes');
  await page.locator('.gang-env-sprite').first().click({ force: true });
  assert.match(await page.locator('.gang-env-click-badge').first().textContent(), /Lv\.12.*Hardy/);
  // Force an encounter using actual CSS position, then let the existing scan run.
  await page.evaluate(() => {
    for (const [i, node] of [...document.querySelectorAll('.gang-env-sprite')].entries()) {
      node.style.transition = 'none'; node.style.transform = `translate(${100 + i * 3}px,200px)`;
    }
  });
  await page.waitForFunction(() => document.querySelector('.gang-env-interact'), { timeout: 10000 });
  await page.waitForFunction(() => document.querySelector('.gang-env-sprite:not(.idle)'), { timeout: 12000 });
  await page.evaluate(() => {
    snapshot.backgroundData.value = 'linear-gradient(#444,#999)';
    env.updateEnvironmentSnapshot(snapshot);
  });
  assert.match(await page.locator('#gangEnvViewport').evaluate(el => el.style.backgroundImage), /153|999/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  assert.ok(await page.locator('.gang-env-sprite').evaluateAll(nodes => nodes.every(n => {
    const m = new DOMMatrix(getComputedStyle(n).transform);
    return m.m41 >= 0 && m.m41 <= n.parentElement.clientWidth - 48 + 1;
  })), 'Resize clamps actual positions on mobile viewport');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => testResources.frames.size), 0);
  // Removing all sources releases actors; adding them back works from empty.
  await page.evaluate(() => env.updateEnvironmentSnapshot({ residents: [], cameoPool: [] }));
  assert.equal(await page.locator('.gang-env-sprite').count(), 0);
  await page.evaluate(() => env.updateEnvironmentSnapshot(snapshot));
  await page.waitForFunction(() => document.querySelectorAll('canvas:not([hidden])').length === 4);
  // Legacy snapshots still render with URL-only residents.
  await page.evaluate(() => env.updateEnvironmentSnapshot({ residents: [{ spriteUrl: snapshot.residents[0].spriteUrl, label: 'Legacy' }] }));
  assert.equal(await page.locator('canvas').count(), 0);
  await page.evaluate(() => env.stopEnvironmentZone());
  assert.deepEqual(await page.evaluate(() => [testResources.pending.size, testResources.frames.size]), [0, 0]);
  assert.ok([...requests].filter(([url]) => url.endsWith('.png') && url.includes('pokemon_pmd')).every(([, count]) => count === 1), 'No duplicate sheet downloads');
  assert.deepEqual(errors, []);
  console.log('PASS Chromium: 5 residents, normal/shiny synthetic Idle/Walk, fallback, encounter, click, OBS reconciliation, background, mobile resize, reduced motion, source changes, legacy snapshots, zero remaining timers/RAF');
  console.log('PMD sheet requests:', [...requests].filter(([url]) => url.endsWith('.png') && url.includes('pokemon_pmd')).length);

  const local = await context.newPage();
  local.on('pageerror', error => errors.push(error.message));
  const seed = await fs.readFile(path.join(root, 'tools/dev-seed-save.json'), 'utf8');
  await local.addInitScript(json => {
    localStorage.setItem('pokeforge.v6', json);
    const pending = new Set(), later = window.setTimeout, cancel = window.clearTimeout;
    window.setTimeout = (fn, ms, ...args) => { const id = later(() => { pending.delete(id); fn(...args); }, ms); pending.add(id); return id; };
    window.clearTimeout = id => { pending.delete(id); cancel(id); };
    window.testPending = pending;
  }, seed);
  await local.goto(origin + '/gang/index.html');
  await local.waitForFunction(() => document.querySelectorAll('.gang-env-clickable').length === 7);
  await local.locator('#gangZoneSrcBtn').click();
  for (const key of ['showcase', 'team', 'pension', 'training']) {
    await local.locator(`[data-source-key="${key}"]`).uncheck();
  }
  assert.equal(await local.locator('.gang-env-clickable').count(), 0);
  await local.locator('[data-source-key="showcase"]').check();
  assert.equal(await local.locator('.gang-env-clickable').count(), 3);
  await local.locator('#gangSourcesClose').click();
  await local.locator('#gangZoneBgBtn').click();
  await local.locator('.gang-zonebg-card[data-bg-key="none"]').click();
  await local.locator('[data-panel="music"]').click();
  await local.waitForTimeout(3000); // the existing background-picker toast completes
  assert.equal(await local.locator('#gangEnvViewport').count(), 0);
  assert.equal(await local.evaluate(() => testPending.size), 0, 'Panel navigation releases vivarium timers');
  assert.deepEqual(errors, []);
  console.log('PASS local /gang/: existing seed save, 7 deduplicated residents, source picker, background picker, panel navigation with zero timers');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
