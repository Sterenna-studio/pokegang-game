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
const base = process.env.POKEGANG_TOUR_BASE_URL?.replace(/\/$/, '') || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.POKEGANG_CHROMIUM_PATH || undefined });
const fixture = JSON.parse(await fs.readFile(path.join(root, 'tools/dev-seed-save.json'), 'utf8'));
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1200, height: 900 } });
    await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    await context.addInitScript(seed => {
      if (!localStorage.getItem('pokeforge.v6')) localStorage.setItem('pokeforge.v6', JSON.stringify(seed));
    }, fixture);
    const page = await context.newPage(), errors = [], tourRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', r => { if (r.url().includes('/vivariumTour.js')) tourRequests.push(r.url()); });
    await page.goto(base + '/gang/index.html');
    await page.waitForSelector('#gangVivariumHelp');
    assert.equal(await page.locator('#gangSpriteModeSelect').inputValue(), 'pmd');
    assert.equal(await page.locator('#gangSizeModeSelect').inputValue(), 'true');
    assert.equal(await page.locator('#gangSceneSelect').inputValue(), 'hq');
    assert.equal(tourRequests.length, 0, 'No guide download before help is requested');
    const saved = await page.evaluate(() => localStorage.getItem('pokeforge.v6'));
    await page.locator('#gangVivariumHelp').click();
    await page.waitForSelector('.gang-tour-card');
    const selectors = ['#gangSpriteModeSelect', '#gangSizeModeSelect', '#gangZoneBgBtn', '#gangZoneSrcBtn', '#gangEnvViewport'];
    for (let i = 0; i < selectors.length; i++) {
      assert.equal(await page.locator('.gang-tour-progress').textContent(), `${i + 1} / 5`);
      assert.ok(await page.locator('.gang-tour-arrow path[marker-end]').getAttribute('d'));
      assert.ok(await page.locator('.gang-tour-card').evaluate(el => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
      }), `Popup fits viewport at step ${i + 1}`);
      assert.ok(await page.evaluate(selector => {
        const t = document.querySelector(selector).getBoundingClientRect();
        const s = document.querySelector('.gang-tour-spot').getBoundingClientRect();
        return t.width > 0 && t.height > 0 && s.left <= t.right && s.right >= t.left && s.top <= t.bottom && s.bottom >= t.top;
      }, selectors[i]), 'Spotlight points to the actual control');
      if (i === 1) assert.equal(await page.locator('.gang-scene-options').evaluate(el => el.open), true);
      if (i === 2) {
        await page.locator('[data-tour-prev]').click();
        assert.equal(await page.locator('.gang-tour-progress').textContent(), '2 / 5');
        await page.locator('[data-tour-next]').click();
      }
      if (i === 4) {
        assert.match(await page.locator('#gangTourText').textContent(), /Ho-Oh/);
        await fs.mkdir(path.join(root, 'coverage'), { recursive: true });
        await page.screenshot({ path: path.join(root, `coverage/vivarium-guide-${mobile ? 'mobile' : 'desktop'}.png`), fullPage: true });
      }
      await page.locator('[data-tour-next]').click();
    }
    assert.equal(await page.locator('.gang-tour').count(), 0);
    assert.equal(await page.locator('.gang-scene-options').evaluate(el => el.open), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'gangVivariumHelp');
    assert.equal(await page.evaluate(() => localStorage.getItem('pokeforge.v6')), saved, 'Guide never changes the save');
    await page.locator('#gangVivariumHelp').click();
    await page.waitForSelector('.gang-tour-card');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'gang-tour-close', 'Tab stays inside the dialog');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.gang-tour').count(), 0);
    // Explicit user preferences survive both save migration and the new defaults.
    await page.locator('.gang-scene-options summary').click();
    await page.locator('#gangSizeModeSelect').selectOption('standard');
    await page.locator('#gangSpriteModeSelect').selectOption('2d');
    await page.reload();
    await page.waitForSelector('#gangVivariumHelp');
    assert.equal(await page.locator('#gangSizeModeSelect').inputValue(), 'standard');
    assert.equal(await page.locator('#gangSpriteModeSelect').inputValue(), '2d');
    await page.locator('#gangVivariumHelp').click();
    await page.waitForSelector('.gang-tour');
    await page.evaluate(async base => (await import(base + '/gang/environment.js')).stopEnvironmentZone(), base);
    assert.equal(await page.locator('.gang-tour').count(), 0, 'Closing the panel disposes the tour');
    await page.setViewportSize({ width: 650, height: 500 });
    await page.evaluate(() => document.dispatchEvent(new Event('scroll')));
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('PASS Chromium guide: PMD/True size/HQ defaults, lazy loading, five anchored steps, back/next, mobile, focus trap/Escape, saved choices, no save writes, cleanup');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
