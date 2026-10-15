// Deterministic renderer tests use synthetic images; the shipped PNG catalog
// is also checked against its provenance hashes and geometry, without network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createPmdRenderer, directionFromVector, frameAt } from '../gang/pmdSprites.js';
import { PMD_METADATA } from '../assets/pokemon_pmd/metadata.js';
import { buildVivariumResidents, buildVivariumCameoPool } from '../modules/systems/vivariumSnapshot.js';

for (const [i, [x, y]] of [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]].entries()) {
  assert.equal(directionFromVector(x, y), i);
}
assert.equal(directionFromVector(0, 0, 7), 7);
assert.equal(frameAt([6, 10, 6, 10], 99), 0);
assert.equal(frameAt([6, 10, 6, 10], 100), 1);
assert.equal(frameAt([6, 10, 6, 10], 534), 0);
assert.deepEqual(Object.keys(PMD_METADATA).sort(), ['41', '52', '92']);
const assetRoot = new URL('../assets/pokemon_pmd/', import.meta.url);
const provenance = JSON.parse(fs.readFileSync(new URL('provenance.json', assetRoot), 'utf8'));
assert.equal(provenance.resources.length, 12);
for (const resource of provenance.resources) {
  const bytes = fs.readFileSync(new URL(resource.file, assetRoot));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), resource.sha256, resource.file);
  const a = PMD_METADATA[resource.dex][resource.variant][resource.animation];
  assert.equal(a.file, resource.file);
  assert.equal(a.d.length, a.n);
  assert.ok(a.d.every(d => d > 0));
  assert.equal(bytes.readUInt32BE(16), a.w * a.n, 'PNG width matches frame geometry');
  assert.equal(bytes.readUInt32BE(20), a.h * a.r, 'PNG height matches direction rows');
  assert.equal(a.r, 8);
}

const anim = (file, w = 24, h = 32, d = [6, 10, 6, 10]) => ({ file, w, h, n: d.length, r: 8, d, ax: w / 2, ay: 20 });
const normal = { Idle: anim('52/Idle.png', 32), Walk: anim('52/Walk.png') };
const shiny = { Idle: anim('52/s/Idle.png', 40), Walk: anim('52/s/Walk.png', 48) };
const metadata = { 52: { normal, shiny } };
const images = [], frames = new Map(), listeners = new Map(), draws = [];
const classes = () => ({ add() {}, remove() {} });
const node = () => ({ style: {}, hidden: false, classList: classes(), setAttribute() {},
  remove() { this.removed = true; }, getContext: () => ({ clearRect() {}, drawImage: (...args) => draws.push(args) }) });
const host = () => {
  const fallback = node();
  return { isConnected: true, classList: classes(), fallback,
    querySelector: () => fallback, appendChild(canvas) { this.canvas = canvas; } };
};
const doc = { hidden: false, createElement: node,
  addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
const motion = { matches: false, addEventListener: (name, fn) => listeners.set('motion', fn),
  removeEventListener: () => listeners.delete('motion') };
let serial = 0;
const renderer = createPmdRenderer({ metadata, doc, motion, maxSheets: 1,
  raf: fn => { frames.set(++serial, fn); return serial; }, caf: id => frames.delete(id),
  makeImage: () => { const image = {}; images.push(image); return image; } });
const flush = time => { const batch = [...frames.values()]; frames.clear(); for (const fn of batch) fn(time); };
const load = async (index, a, error = false) => {
  Object.assign(images[index], { naturalWidth: a.w * a.n, naturalHeight: a.h * a.r });
  images[index][error ? 'onerror' : 'onload']();
  await Promise.resolve();
};
assert.equal(renderer.attach(host(), { dex: 999 }), null);
assert.equal(frames.size, 0);
const firstHost = host(), secondHost = host();
const a = renderer.attach(firstHost, { dex: 52 });
const b = renderer.attach(secondHost, { dex: 52 });
assert.deepEqual(a.insets, { left: 8, right: 8, bottom: 16 }, 'Full animation envelope protects viewport edges');
assert.equal(images.length, 1, 'Shared sheet must download once');
assert.equal(frames.size, 1, 'One loop for every actor');
assert.equal(firstHost.fallback.hidden, false, 'Fallback visible while loading');
await load(0, normal.Idle);
assert.equal(firstHost.fallback.hidden, true);
flush(0); flush(100);
assert.equal(a.elapsed, 100);
a.set('Idle', 6);
assert.equal(a.elapsed, 100, 'Facing change must not restart Idle');
assert.equal(draws.at(-1)[2], 6 * 32);
a.set('Walk', 1);
assert.equal(firstHost.fallback.hidden, false);
await load(1, normal.Walk);
assert.equal(firstHost.canvas.style.left, '0px');
assert.equal(firstHost.canvas.style.top, '0px');
assert.equal(firstHost.canvas.style.width, '48px');
a.set('Idle');
assert.equal(firstHost.canvas.style.left, '-8px', 'Different frame widths share the ground anchor');
assert.equal(firstHost.canvas.style.top, '0px');
assert.equal(images.length, 2, 'Already decoded Idle is reused');

const sh = renderer.attach(host(), { dex: 52, shiny: true });
sh.set('Walk');
await load(2, shiny.Idle); // outdated asynchronous Idle response
assert.equal(sh.host.canvas.hidden, true, 'Stale load cannot replace current Walk');
await load(3, shiny.Walk);
assert.equal(sh.host.canvas.style.width, '88px');
sh.set('Walk', 4);
assert.equal(images.length, 4);
doc.hidden = true; listeners.get('visibilitychange')();
assert.equal(frames.size, 0);
doc.hidden = false; listeners.get('visibilitychange')();
assert.equal(frames.size, 1);
motion.matches = true; listeners.get('motion')();
assert.equal(frames.size, 0);
assert.equal(draws.at(-1)[1], 0, 'Reduced motion holds first frame');
motion.matches = false; listeners.get('motion')();
sh.host.isConnected = false; flush(200);
assert.equal(renderer.stats().actors, 2);
a.destroy(); b.destroy();
assert.equal(frames.size, 0);
assert.equal(listeners.size, 0);
assert.ok(renderer.stats().sheets <= 1, 'Unused sheets evicted');
renderer.dispose();
assert.deepEqual(renderer.stats(), { actors: 0, sheets: 0, scheduled: false });

const errorHost = host();
const errorActor = renderer.attach(errorHost, { dex: 52 });
await load(4, normal.Idle, true);
assert.equal(errorHost.fallback.hidden, false);
errorActor.destroy(); renderer.dispose();

// New snapshot fields are derived; existing saves and source deduplication survive.
globalThis.SPECIES_BY_EN = { meowth: { dex: 52 } };
globalThis.pokeSprite = (species, shiny) => `fallback/${species}/${!!shiny}`;
globalThis.trainerSprite = name => `trainer/${name}`;
const state = { gang: { showcase: ['a'], bossTeamSlots: [['a', 'b']] },
  cosmetics: {}, agents: [], pokemons: [
    { id: 'a', species_en: 'meowth', shiny: true, favorite: true, level: 12 },
    { id: 'b', species_en: 'unknown', dex: 999, level: 1 },
  ] };
const before = JSON.stringify(state);
const residents = buildVivariumResidents(state);
assert.equal(residents.length, 2);
assert.deepEqual([residents[0].id, residents[0].dex, residents[0].shiny], ['a', 52, true]);
assert.equal(residents[0].spriteUrl, 'fallback/meowth/true');
assert.equal(buildVivariumCameoPool(state).find(c => c.type === 'favorite').dex, 52);
assert.equal(JSON.stringify(state), before);
console.log('PASS PMD renderer: timing, directions, anchors, shiny, async race, errors, cache, visibility, disposal and snapshots');
