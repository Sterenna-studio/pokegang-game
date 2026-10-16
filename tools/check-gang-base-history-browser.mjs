// Real JSON download/file chooser/confirmation flow, in an isolated QA profile.
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
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' })[path.extname(file)] || 'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.POKEGANG_HISTORY_BASE_URL?.replace(/\/$/, '') || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.POKEGANG_CHROMIUM_PATH || undefined });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const requests = [], errors = [];
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on('request', r => requests.push(r.url()));
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw Error('Gallery accessed a save'); } }));
  await page.goto(base + '/tools/gang-base-history/index.html');
  await page.waitForSelector('#controls:not([hidden])');
  assert.equal(await page.locator('#version option').count(), 14);
  assert.equal(requests.filter(url => /\/previews\//.test(url)).length, 1, 'One initial image only');
  await page.locator('#compare').check();
  assert.equal(await page.locator('#secondary img').count(), 1);
  for (let i = 0; i < 14; i++) {
    await page.locator('#version').selectOption(String(i));
    await page.waitForFunction(() => { const img = document.querySelector('#primary img'); return img?.complete && img.naturalWidth > 0; });
  }
  await page.screenshot({ path: path.join(root, 'coverage/gang-base-history-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: path.join(root, 'coverage/gang-base-history-mobile.png'), fullPage: true });
  await page.locator('#compare').uncheck();
  assert.equal(await page.locator('#secondary img').count(), 0);
  assert.ok(!requests.some(url => /\/(state\/store|gangBase|tickManager|cloudAccount)\.js/.test(url)), 'No game engine, store or cloud modules loaded');
  const prod = await browser.newContext();
  const productionRequests = [];
  await prod.route('**/*', async route => {
    const pathname = new URL(route.request().url()).pathname;
    productionRequests.push(pathname);
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) return route.abort();
    const contentType = ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream';
    try { return route.fulfill({ contentType, body: await fs.readFile(file) }); } catch { return route.abort(); }
  });
  const blocked = await prod.newPage();
  await blocked.goto('https://pokegang.sterenna.fr/tools/gang-base-history/index.html');
  await blocked.waitForFunction(() => document.querySelector('#status').textContent.includes('réservée'));
  assert.ok(!productionRequests.some(url => /versions\.json|\/previews\//.test(url)));
  assert.deepEqual(errors, []);
  console.log('PASS history gallery: 14 images, native selectors/comparison, lazy selected images, no save/game engine access, mobile layout, production origin gate (simulated)');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
