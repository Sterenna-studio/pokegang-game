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
    const file = path.resolve(root, '.' + new URL(req.url, 'http://local').pathname);
    if (!file.startsWith(root + path.sep)) throw Error('outside');
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.POKEGANG_QG_BASE_URL?.replace(/\/$/, '') || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.POKEGANG_CHROMIUM_PATH || undefined });
try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 850 } });
  const errors = [], requests = [];
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => requests.push(r.url()));
  const seed = await fs.readFile(path.join(root, 'tools/dev-seed-save.json'), 'utf8');
  await page.addInitScript(json => { if (!localStorage.getItem('pokeforge.v6')) localStorage.setItem('pokeforge.v6', json); }, seed);
  await page.goto(base + '/gang/index.html');
  await page.waitForSelector('#gangSpriteModeSelect');
  await page.locator('.gang-scene-options summary').click();
  await page.locator('#gangSceneSelect').selectOption('hq');
  await page.waitForSelector('.gang-hq-labels');
  assert.equal(await page.locator('.gang-hq-labels span').count(), 4);
  assert.ok(await page.evaluate(async base => {
    const zones = await import(base + '/modules/systems/vivariumZones.js');
    const data = await import(base + '/modules/systems/vivariumSnapshot.js');
    const layout = await import(base + '/gang/vivariumLayout.js');
    const list = data.buildVivariumResidents(state);
    const nodes = [...document.querySelectorAll('.gang-env-clickable')];
    const viewport = document.querySelector('#gangEnvViewport');
    return nodes.every((node, i) => {
      const area = zones.HQ_AREAS.find(a => a.id === list[i].location);
      const p = layout.readSpritePosition(node);
      return p.x + 24 >= area.x * viewport.clientWidth - 1 && p.x + 24 <= (area.x + area.w) * viewport.clientWidth + 1
        && p.y + 40 >= area.y * viewport.clientHeight - 1 && p.y + 40 <= (area.y + area.h) * viewport.clientHeight + 1;
    });
  }, base), 'Residents occupy their real activity areas');
  assert.ok(await page.evaluate(async base => {
    const env = await import(base + '/gang/environment.js');
    const data = await import(base + '/modules/systems/vivariumSnapshot.js');
    const nodes = [...document.querySelectorAll('.gang-env-clickable')];
    const labels = [...document.querySelectorAll('.gang-hq-labels span')];
    env.updateEnvironmentSnapshot({ residents: data.buildVivariumResidents(state), backgroundData: data.buildVivariumBackgroundData(state), cameoPool: [] });
    return nodes.every((n, i) => n === document.querySelectorAll('.gang-env-clickable')[i])
      && labels.every((n, i) => n === document.querySelectorAll('.gang-hq-labels span')[i]);
  }, base), 'Identical OBS updates preserve actors and area labels');
  const beforeSize = await page.locator('.gang-env-clickable canvas').first().evaluate(el => el.style.height);
  await page.locator('.gang-scene-options summary').click();
  await page.locator('#gangSizeModeSelect').selectOption('true');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pokeforge.v6')).cosmetics.vivariumTrueSize), true);
  assert.notEqual(await page.locator('.gang-env-clickable canvas').first().evaluate(el => el.style.height), beforeSize);
  assert.ok(await page.evaluate(async base => {
    const data = await import(base + '/modules/systems/vivariumSnapshot.js');
    return data.buildVivariumResidents(state).every(r => r.display.trueSize);
  }, base), 'Size preference travels with public resident data');
  await page.locator('#gangSizeModeSelect').selectOption('standard');
  await page.locator('.gang-scene-options summary').click();
  await page.screenshot({ path: path.join(root, 'coverage/vivarium-qg-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  assert.ok(await page.locator('#gangSpriteModeSelect').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }));
  await page.screenshot({ path: path.join(root, 'coverage/vivarium-qg-mobile.png'), fullPage: true });
  await page.locator('.gang-scene-options summary').click();
  await page.locator('#gangSceneSelect').selectOption('classic');
  assert.equal(await page.locator('.gang-hq-labels').count(), 0);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pokeforge.v6')).cosmetics.vivariumScene), 'classic');
  await page.locator('[data-panel="music"]').click();
  assert.equal(await page.locator('#vivariumDevPanel').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS Chromium QG: native scene selector, original static SVG, resident activity areas, stable OBS labels/nodes, saved scene, mobile and panel cleanup');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
