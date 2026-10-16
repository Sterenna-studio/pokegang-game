// Real JSON download/file chooser/confirmation flow, in an isolated QA profile.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { makeSaveProgressFixture, progressOf } from './fixtures/save-progress.mjs';
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
const base = process.env.POKEGANG_SAVE_BASE_URL?.replace(/\/$/, '') || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.POKEGANG_CHROMIUM_PATH || undefined });
try {
  const context = await browser.newContext({ acceptDownloads: true });
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => { errors.push(e.message); console.error('Browser error:', e.message); });
  page.setDefaultTimeout(12000);
  await page.goto(base + '/index.html');
  await page.waitForSelector('#btnHubImportSave');
  const { state } = makeSaveProgressFixture();
  assert.equal(await page.evaluate(() => ZONES.some(z => z.id === ZONES_JOHTO[0].id)), false, 'Regional runtime catalog not activated at hub');
  const downloaded = page.waitForEvent('download');
  await page.evaluate(async ({ state, base }) => {
    window.state = state;
    const { exportSave } = await import(base + '/state/store.js');
    exportSave();
  }, { state, base });
  const json = await fs.readFile(await (await downloaded).path());
  assert.deepEqual(progressOf(JSON.parse(json)), progressOf(state), 'Downloaded export includes every progress field');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#btnHubImportSave').click();
  await (await chooser).setFiles({ name: 'save-roundtrip.json', mimeType: 'application/json', buffer: json });
  await page.waitForSelector('#btnHubImportConfirm');
  assert.equal(await page.locator('#chkCleanObsolete').isChecked(), false, 'Locked region gyms are not reported as obsolete');
  // Enable cleanup deliberately: existing regional progress must survive it.
  await page.locator('#chkCleanObsolete').check();
  await page.locator('input[name="hubTargetSlot"][value="1"]').check();
  await page.locator('#btnHubImportConfirm').click();
  await page.locator('#confirmModalOk').click();
  const imported = await page.evaluate(() => JSON.parse(localStorage.getItem('pokeforge.v6.s2')));
  assert.deepEqual(progressOf(imported), progressOf(state));
  assert.equal(imported.inventory.silver_wing, state.inventory.silver_wing);
  await page.reload();
  const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem('pokeforge.v6.s2')));
  assert.deepEqual(progressOf(reloaded), progressOf(state));
  // Actually load the imported slot through boot, including mission init and
  // regional activation; new runtime/default zone fields may be added.
  await page.evaluate(() => localStorage.setItem('pokeforge.activeSlot', '1'));
  await page.reload();
  await page.waitForFunction(() => window.state?.gang?.name === 'Import regression' && typeof window.initMissions === 'function', null, { timeout: 30000 });
  const loaded = await page.evaluate(() => JSON.parse(JSON.stringify(window.state)));
  for (const [id, zone] of Object.entries(state.zones)) {
    for (const [key, value] of Object.entries(zone)) assert.deepEqual(loaded.zones[id][key], value, `${id}.${key}`);
  }
  assert.deepEqual(loaded.missions, state.missions);
  assert.deepEqual(progressOf(loaded).stories, progressOf(state).stories);
  // In-game importer uses a different overlay; its confirmation must also
  // be clickable and replacing the active state must retain all progress.
  await page.evaluate(async ({ base, state }) => {
    const { openImportPreviewModal } = await import(base + '/modules/ui/modals.js');
    openImportPreviewModal(state);
  }, { base, state });
  await page.locator('#btnImportFull').click();
  await page.locator('#confirmModalOk').click();
  const active = await page.evaluate(() => JSON.parse(JSON.stringify(window.state)));
  for (const id of Object.keys(state.zones)) assert.equal(active.zones[id].gymDefeated, true, id);
  assert.deepEqual(active.missions, state.missions);
  assert.deepEqual(progressOf(active).stories, progressOf(state).stories);
  assert.deepEqual(errors, []);
  console.log('PASS Chromium save export/import: real JSON download, hub file picker/cleanup, both clickable confirmations, active import, 34 gyms, periodic/legendary quests and actual boot reload');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
