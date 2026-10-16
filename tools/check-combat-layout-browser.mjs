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
const base = process.env.POKEGANG_COMBAT_BASE_URL?.replace(/\/$/, '') || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.POKEGANG_CHROMIUM_PATH || undefined });
try {
  const context = await browser.newContext({ viewport: { width: 1100, height: 850 } });
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.request().resourceType() === 'image' ? route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="24" cy="24" r="18" fill="gold"/></svg>' }) : route.abort());
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const seed = JSON.parse(await fs.readFile(path.join(root, 'tools/dev-seed-save.json'), 'utf8'));
  seed._schemaVersion = 21;
  seed.discoveryProgress = { introFlashbackOffered: true };
  seed.settings = { combatSpeed: 1, autoCombat: false };
  seed.gang.bossZone = 'route1';
  seed.gang.introSeen = seed.gang.darkraiCutsceneSeen = true;
  seed.zones = { route1: { unlocked: true }, pewter_gym: { unlocked: true, combatsWon: 20 }, cerulean_gym: { unlocked: true, combatsWon: 20 } };
  seed.openZoneOrder = ['route1', 'pewter_gym', 'cerulean_gym'];
  seed.agents = [];
  await page.addInitScript(seed => {
    if (!localStorage.getItem('pokeforge.v6')) localStorage.setItem('pokeforge.v6', JSON.stringify(seed));
  }, seed);
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#zw-pewter_gym');
  assert.equal(await page.locator('#zw-route1 .zone-boss').count(), 1);
  assert.equal(await page.locator('#zw-pewter_gym .zone-boss').count(), 0);
  await page.locator('[data-gym-raid="pewter_gym"]').click();
  await page.waitForSelector('#zchud-pewter_gym');
  assert.ok(await page.evaluate(() => {
    const boss = document.querySelector('#zw-pewter_gym .zone-boss');
    return state.gang.bossZone === 'pewter_gym' && boss?.isConnected && currentCombat.playerAnchorEl === boss;
  }), 'Boss is mounted and used as anchor before replay');
  assert.equal(await page.locator('#zw-route1 .zone-boss').count(), 0);
  assert.ok(await page.evaluate(() => {
    const before = state.zones.cerulean_gym.gymRaidLastFight;
    const result = triggerGymRaid('cerulean_gym');
    return result === false && state.gang.bossZone === 'pewter_gym' && state.zones.cerulean_gym.gymRaidLastFight === before;
  }), 'Busy raid does not move boss or consume another cooldown');
  const checkHud = async () => assert.ok(await page.locator('#zchud-pewter_gym').evaluate(el => {
    const r = el.getBoundingClientRect(), v = el.parentElement.getBoundingClientRect();
    return Math.abs(r.bottom - v.bottom) < 2 && r.left >= v.left - 1 && r.right <= v.right + 1 && el.scrollWidth <= el.clientWidth + 1;
  }), 'Compact HUD stays at the bottom without overflowing');
  await checkHud();
  await page.locator('#zw-pewter_gym').screenshot({ path: path.join(root, 'coverage/combat-raid-boss-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await checkHud();
  await page.locator('#zchud-pewter_gym .zchud-speed').click();
  await page.locator('#zchud-pewter_gym .zchud-speed').click();
  await page.waitForSelector('#zw-pewter_gym .zone-combat-result', { timeout: 15000 });
  assert.ok(await page.locator('#zw-pewter_gym .zone-combat-result').evaluate(el => {
    const r = el.getBoundingClientRect(), v = el.parentElement.getBoundingClientRect();
    return r.top >= v.top + v.height / 2 && r.bottom < v.bottom && r.left >= v.left - 1 && r.right <= v.right + 1;
  }), 'Result banner occupies the lower part of the zone');
  await page.locator('#zw-pewter_gym').screenshot({ path: path.join(root, 'coverage/combat-result-mobile.png') });
  await page.locator('#zchud-pewter_gym .zchud-flee').click();
  await page.evaluate(() => {
    state.zones.pewter_gym.gymRaidLastFight = 0;
    document.querySelector('#zw-pewter_gym .zone-boss').remove();
    triggerGymRaid('pewter_gym');
  });
  assert.equal(await page.locator('#zw-pewter_gym .zone-boss').count(), 1, 'Already assigned boss is repaired if its DOM was missing');
  await page.evaluate(() => closeCombatPopup());
  assert.ok(await page.evaluate(() => {
    delete state.gang.bossZone;
    document.querySelectorAll('.zone-boss').forEach(el => el.remove());
    const opened = triggerGymRaid('cerulean_gym');
    const boss = document.querySelector('#zw-cerulean_gym .zone-boss');
    const ready = opened && boss?.isConnected && currentCombat.playerAnchorEl === boss;
    closeCombatPopup();
    return ready;
  }), 'An unassigned boss can arrive for its first raid');
  assert.deepEqual(errors, []);
  console.log('PASS Chromium combat: boss arrives before raid anchor, old sprite removed, busy/cooldown guard, missing anchor repaired, bottom HUD/result desktop/mobile, speed/close controls');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
