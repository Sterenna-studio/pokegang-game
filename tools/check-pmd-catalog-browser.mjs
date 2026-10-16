// Optional real-browser audit of every shipped Idle/Walk sheet, in small batches.
// Requires existing playwright-core, configured as for check-vivarium-pmd-browser.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.POKEGANG_PLAYWRIGHT_PATH || 'playwright-core');
const root = path.resolve(import.meta.dirname, '..');
const server = http.createServer(async (req, res) => {
  try {
    const relative = new URL(req.url, 'http://local').pathname;
    if (relative === '/') {
      res.setHeader('Content-Type', 'text/html');
      return res.end('<!doctype html><html><body><main id="gallery"></main></body></html>');
    }
    const file = path.resolve(root, '.' + relative);
    assert.ok(file.startsWith(root + path.sep));
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'text/plain');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
const remoteBase = process.env.POKEGANG_PMD_BASE_URL;
if (!remoteBase) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const runtimeBase = remoteBase || `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.POKEGANG_CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', req => { if (req.url().startsWith(runtimeBase)) errors.push(req.url()); });
  await page.goto(remoteBase ? new URL('gang/live.html', runtimeBase).href : runtimeBase);
  const result = await page.evaluate(async ({ rendererUrl, metadataUrl }) => {
    const { createPmdRenderer } = await import(rendererUrl);
    const { PMD_METADATA } = await import(metadataUrl);
    const renderer = createPmdRenderer({ maxSheets: 40 });
    const variants = Object.entries(PMD_METADATA).flatMap(([dex, v]) => Object.keys(v).map(variant => ({ dex: Number(dex), shiny: variant === 'shiny' })));
    const failures = [];
    let sheets = 0;
    for (let start = 0; start < variants.length; start += 16) {
      const actors = variants.slice(start, start + 16).map(pokemon => {
        const host = document.createElement('div');
        host.innerHTML = '<img alt="fallback">';
        document.body.appendChild(host);
        return { actor: renderer.attach(host, pokemon), host, pokemon };
      });
      for (const name of ['Idle', 'Walk']) {
        for (const { actor } of actors) actor?.set(name);
        await Promise.all(actors.map(({ actor }) => actor?.sheet.promise));
        for (const { actor, host, pokemon } of actors) {
          if (!actor) { failures.push({ ...pokemon, name, reason: 'No renderer' }); continue; }
          const canvas = host.querySelector('canvas');
          const a = actor.meta;
          for (let direction = 0; direction < 8; direction++) {
            actor.set(name, direction);
            if (canvas.hidden || !actor.sheet.ready) {
              failures.push({ ...pokemon, name, direction, reason: 'Failed/hidden canvas' }); break;
            }
            if (canvas.width !== a.w || canvas.height !== a.h) failures.push({ ...pokemon, name, reason: 'Wrong canvas geometry' });
          }
          sheets++;
        }
      }
      for (const { actor, host } of actors) { actor?.destroy(); host.remove(); }
      if (renderer.stats().sheets > 40 || renderer.stats().actors !== 0) failures.push({ reason: 'Batch resource leak', ...renderer.stats() });
    }
    renderer.dispose();
    return { variants: variants.length, sheets, failures, stats: renderer.stats() };
  }, { rendererUrl: new URL('gang/pmdSprites.js', runtimeBase).href, metadataUrl: new URL('assets/pokemon_pmd/metadata.js', runtimeBase).href });
  assert.deepEqual(errors, []);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.stats, { actors: 0, sheets: 0, scheduled: false });
  console.log(`PASS Chromium catalog (${runtimeBase}): ${result.variants} variants, ${result.sheets} Idle/Walk sheets, eight directions, bounded cache, no remaining actors/RAF`);
} finally {
  await browser.close();
  if (server.listening) await new Promise(resolve => server.close(resolve));
}
