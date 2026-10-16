// Public QA tools, exercised without reading any game save or starting a game.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { makeSaveProgressFixture } from './fixtures/save-progress.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.POKEGANG_PLAYWRIGHT_PATH || 'playwright-core');
const root = path.resolve(import.meta.dirname, '..');
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://local').pathname;
    const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!file.startsWith(root + path.sep)) throw Error('outside');
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' })[path.extname(file)] || 'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = process.env.POKEGANG_TOOLS_BASE_URL?.replace(/\/$/, '') || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.POKEGANG_CHROMIUM_PATH || undefined });
try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 850 } });
  const requests = [], errors = [];
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue()
    : route.request().resourceType() === 'image' ? route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="24" cy="24" r="16" fill="gold"/></svg>' }) : route.abort());
  const page = await context.newPage();
  page.on('request', r => { if (r.method() !== 'HEAD') requests.push(r.url()); }); page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw Error('Tool accessed a save'); } }));
  await page.goto(base + '/tools/');
  await page.waitForSelector('#lab:not([hidden])');
  assert.equal(await page.locator('.card').count(), 6);
  assert.ok(!requests.some(url => /pokemon_pmd|versions\.json/.test(url)), 'No catalog preloading on hub');
  await page.locator('#checkAssets').click();
  await page.waitForFunction(() => document.querySelector('#checkStatus').textContent.startsWith('12/12'));
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: path.join(root, 'coverage/lab-tools-mobile.png'), fullPage: true });
  await page.goto(base + '/tools/save-compare.html');
  const { state } = makeSaveProgressFixture(), after = structuredClone(state);
  const zone = Object.keys(after.zones)[0]; after.zones[zone].gymDefeated = false;
  after.missions.daily.claimed = [];
  state.settings.llmApiKey = 'PRIVATE-ONE'; after.settings.llmApiKey = 'PRIVATE-TWO';
  const file = (name, value) => ({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await page.locator('#before').setInputFiles(file('before.json', state));
  await page.locator('#after').setInputFiles(file('after.json', after));
  await page.waitForFunction(() => document.querySelector('#resultStatus').textContent.startsWith('2 différence'));
  assert.ok((await page.locator('#diffs').innerText()).includes('gymDefeated'));
  await page.locator('#allFields').check();
  await page.waitForFunction(() => document.querySelector('#diffs').textContent.includes('[masqué]'));
  assert.ok(!(await page.locator('body').innerText()).includes('PRIVATE-'));
  await page.locator('#before').setInputFiles(file('invalid.json', []));
  await page.waitForFunction(() => document.querySelector('#resultStatus').textContent.startsWith('Impossible'));
  assert.equal(await page.locator('#results').isVisible(), false);
  await page.goto(base + '/tools/sprite-lab.html');
  await page.waitForSelector('#pmd canvas:not([hidden])');
  await page.locator('#dex').fill('25'); await page.locator('#dex').dispatchEvent('change');
  await page.waitForSelector('#hgss canvas:not([hidden])');
  await page.locator('#animation').selectOption('Walk');
  await page.locator('#direction').selectOption('5');
  await page.locator('#trueSize').check();
  await page.locator('#still').check();
  await page.waitForFunction(() => document.querySelector('#stats').textContent.includes('arrêtée'));
  await page.locator('#shiny').check();
  assert.equal(await page.locator('#hgss canvas').count(), 0);
  assert.ok((await page.locator('#hgssStatus').innerText()).includes('absente'));
  await page.locator('#dex').fill('130'); await page.locator('#dex').dispatchEvent('change');
  await page.waitForSelector('#hgss canvas:not([hidden])');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: path.join(root, 'coverage/lab-sprites-mobile.png'), fullPage: true });
  const pngs = requests.filter(url => /\/assets\/pokemon_(?:pmd|hgss)\/.*\.png$/.test(url));
  assert.ok(pngs.length < 16, 'Only displayed variants/animations are loaded');
  assert.ok(!requests.some(url => /state\/store|cloudAccount|tickManager/.test(url)));
  const prod = await browser.newContext(), prodRequests = [];
  await prod.route('**/*', async route => {
    const pathname = new URL(route.request().url()).pathname; prodRequests.push(pathname);
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) return route.abort();
    try { return route.fulfill({ contentType: ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] || 'application/octet-stream', body: await fs.readFile(file) }); } catch { return route.abort(); }
  });
  const blocked = await prod.newPage();
  for (const file of ['index.html', 'sprite-lab.html', 'save-compare.html']) {
    await blocked.goto('https://pokegang.sterenna.fr/tools/' + file);
    await blocked.waitForFunction(() => document.querySelector('#gate').textContent.includes('réservés'));
  }
  assert.ok(!prodRequests.some(url => /assets\/|gang\/pmdSprites/.test(url)));
  assert.deepEqual(errors, []);
  console.log('PASS lab hub: 12 resource diagnostics, local read-only save diff/redaction, real PMD/HGSS variants and controls, demand loading, mobile and production-host gate');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
