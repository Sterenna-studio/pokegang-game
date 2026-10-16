// Offline gallery builder: Git markup/CSS -> isolated Chromium -> static PNG.
// Old JS is evaluated only here, never shipped or executed by gallery visitors.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.POKEGANG_PLAYWRIGHT_PATH || 'playwright-core');
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'tools/gang-base-history');
const versions = [
  ['accd88f', 'v1', 'Avril · base initiale', 'Première base extraite dans son module.'],
  ['4d80722', 'v1', 'Mai · refonte du panneau', 'Équipe, inventaire et territoire réorganisés.'],
  ['5e5b168', 'v2', 'Mai · V2 à trois colonnes', 'Première vue alternative V2.'],
  ['4eaf2db', 'v2', 'Mai · V2, équipe au centre', 'Équipe du boss centrale et Balls fusionnées aux objets.'],
  ['e922de8', 'v1', 'Mai · V1 compacte', 'Boss compact et bandeau de territoire.'],
  ['664f898', 'v2', 'Juillet · V2 ajustée', 'Hauteur du QG, agents et affichage des boosts corrigés.'],
  ['77ca49e', 'v1', 'Octobre · nids côte à côte', 'Œufs disposés dans des nids de paille.'],
  ['1e2e0e8', 'v1', 'Octobre · carrousel de nids', 'Une ligne de nids avec navigation horizontale.'],
  ['5b5b59b', 'v1', 'Octobre · prototype étagère', 'Objets sur une étagère, essai réservé aux previews.'],
  ['f1d0e62', 'v1', 'Octobre · pile à éclore', 'Regroupement des œufs prêts dans une pile unique.'],
];
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8e6 });
const server = http.createServer(async (req, res) => {
  try {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://local').pathname);
    if (!file.startsWith(root + path.sep)) throw Error('outside');
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.POKEGANG_CHROMIUM_PATH || undefined });
const images = new Map();
try {
  await fs.mkdir(path.join(out, 'previews'), { recursive: true });
  await fs.mkdir(path.join(root, 'coverage/gang-base-history'), { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    if (route.request().resourceType() !== 'image') return route.abort();
    if (!images.has(url)) images.set(url, (async () => {
      if (['play.pokemonshowdown.com', 'raw.githubusercontent.com', 's3.pokeos.com', 'www.pokepedia.fr'].includes(new URL(url).hostname)) {
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (response.ok) return { body: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') || 'image/png' };
        } catch { /* Existing sprite fallback for a missing/unreachable image. */ }
      }
      return { contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><text x="8" y="24" fill="#aaa">?</text></svg>' };
    })());
    return route.fulfill(await images.get(url));
  });
  const seed = JSON.parse(await fs.readFile(path.join(root, 'tools/dev-seed-save.json'), 'utf8'));
  seed._schemaVersion = 21;
  seed.gang.introSeen = seed.gang.darkraiCutsceneSeen = true;
  seed.discoveryProgress = { introFlashbackOffered: true };
  seed.settings = { spriteMode: 'gen5' };
  seed.inventory = { ...seed.inventory, pokeball: 12, incubator: 2, lure: 3, incense: 2 };
  seed.agents = Array.from({ length: 6 }, (_, i) => ({ ...seed.agents[0],
    id: `ag-${i + 1}`, name: ['Sacha', 'Lina', 'Noé', 'Rose', 'Émile', 'Mia'][i], assignedZone: i < 2 ? 'route1' : null }));
  const manifest = [];
  for (const [revision, mode, title, description] of versions) {
    const sha = git('rev-parse', revision).trim();
    const date = git('show', '-s', '--format=%cs', sha).trim();
    let source = git('show', `${sha}:modules/ui/gangBase.js`);
    const sourceSha256 = createHash('sha256').update(source).digest('hex');
    const css = git('show', `${sha}:css/game-ui.css`);
    const page = await context.newPage();
    await page.addInitScript(seed => localStorage.setItem('pokeforge.v6', JSON.stringify(seed)), seed);
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window._gbase_renderGangBaseWindow === 'function');
    source = source.replace(/(from\s+['"])(\.[^'"]+)(['"])/g, (_, a, relative, b) => a + new URL(relative, base + '/modules/ui/gangBase.js').href + b);
    source += `\nglobalThis.__historyRender = ${mode === 'v2' ? 'renderGangBaseWindowV2' : 'renderGangBaseWindow'};`;
    const html = await page.evaluate(async ({ source, base }) => {
      const { Scheduler } = await import(base + '/modules/core/tickManager.js');
      Scheduler.stop();
      const last = setTimeout(() => {}, 0);
      for (let id = 0; id <= last; id++) clearTimeout(id);
      globalThis.BOSS_TEAM_SLOTS = 6;
      globalThis.SHOWCASE_SLOTS = 6;
      // Common display fixture also illustrates retired incubators and new nests.
      state.inventory.incubator = 4;
      state.inventory.pokeball = 12;
      state.eggs = Array.from({ length: 6 }, (_, i) => ({ id: `gallery-egg-${i}`, species_en: 'pikachu',
        incubating: i < 4, incubationAgentId: `ag-${i + 1}`, status: i < 4 ? 'incubating' : 'ready',
        hatchAt: Date.now() + 300000, hatchStartedAt: Date.now() - 300000, potential: 3, shiny: false }));
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      try { await import(url); return globalThis.__historyRender(); }
      finally { URL.revokeObjectURL(url); }
    }, { source, base });
    assert.ok(html.includes('gangBaseWin'), revision);
    const baseCss = git('show', `${sha}:css/base.css`);
    await page.setContent(`<html lang="fr"><head><style>${baseCss}\n${css}\nbody{margin:0;padding:16px;background:#101010}#zonesTopArea{display:block!important}#gangBaseContainer{margin:0!important}*{animation:none!important;transition:none!important}</style></head><body><div id="zonesTopArea" class="${mode === 'v2' ? 'gb-v2-mode' : ''}"><div id="gangBaseContainer">${html}</div></div></body></html>`);
    await page.evaluate(async () => Promise.all([...document.images].map(img => img.complete ? null : new Promise(resolve => { img.onload = img.onerror = resolve; }))));
    const file = `previews/${revision}-${mode}.png`;
    await page.locator('#gangBaseContainer').screenshot({ path: path.join(out, file) });
    const bytes = await fs.readFile(path.join(out, file));
    manifest.push({ revision: sha, date, mode, title, description, file,
      source_sha256: sourceSha256, css_sha256: createHash('sha256').update(css).digest('hex'),
      image_sha256: createHash('sha256').update(bytes).digest('hex'),
      width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), bytes: bytes.length });
    console.log(`${revision} ${mode}: ${bytes.length} bytes`);
    await page.close();
  }
  for (const [name, title, selector] of [
    ['proto-pokechill-v2', 'Prototype · inspiration Pokéchill V2', 'body'],
    ['proto-gang-zone', 'Prototype · QG territorial', 'body'],
    ['proto-gangbase-v2', 'Prototype · refonte QG V2', 'body'],
    ['pokev3', 'Prototype · Gang Base V3', '.gang-base'],
  ]) {
    const sourcePath = `test/${name}.html`;
    const revision = git('log', '-1', '--format=%H', '--', sourcePath).trim();
    const date = git('show', '-s', '--format=%cs', revision).trim();
    const source = git('show', `${revision}:${sourcePath}`);
    const page = await context.newPage();
    await page.addInitScript(seed => localStorage.setItem('pokeforge.v6', JSON.stringify(seed)), seed);
    // Serve the exact historical prototype while resolving its relative assets.
    await page.route(base + '/' + sourcePath, route => route.fulfill({ contentType: 'text/html', body: source }));
    await page.goto(base + '/' + sourcePath, { waitUntil: 'load' });
    await page.evaluate(async () => Promise.all([...document.images].map(img => img.complete ? null : new Promise(resolve => { img.onload = img.onerror = resolve; }))));
    const file = `previews/${name}.webp`;
    const rawPath = path.join(root, 'coverage/gang-base-history', name + '.png');
    await page.locator(selector).first().screenshot({ path: rawPath, animations: 'disabled' });
    const original = await fs.readFile(rawPath);
    execFileSync('python', ['-c', 'from PIL import Image; import sys; Image.open(sys.argv[1]).save(sys.argv[2], quality=90, method=6)', rawPath, path.join(out, file)]);
    const bytes = await fs.readFile(path.join(out, file));
    manifest.push({ revision, date, mode: 'prototype', title, source_path: sourcePath,
      description: 'Maquette exploratoire distincte des versions intégrées au jeu. Données de démonstration.',
      file, source_sha256: createHash('sha256').update(source).digest('hex'),
      image_sha256: createHash('sha256').update(bytes).digest('hex'),
      width: original.readUInt32BE(16), height: original.readUInt32BE(20), bytes: bytes.length });
    console.log(`${name}: ${bytes.length} bytes`);
    await page.close();
  }
  manifest.sort((a, b) => a.date.localeCompare(b.date));
  await fs.writeFile(path.join(out, 'versions.json'), JSON.stringify(manifest, null, 2) + '\n');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
