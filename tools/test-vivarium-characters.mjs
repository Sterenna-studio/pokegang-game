import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { CHARACTER_METADATA } from '../assets/vivarium_characters/metadata.js';
import { resolveCharacterKey } from '../gang/characterSprites.js';
import { createPmdRenderer } from '../gang/pmdSprites.js';
import { buildVivariumCameoPool } from '../modules/systems/vivariumSnapshot.js';

const root = new URL('../assets/vivarium_characters/', import.meta.url);
const provenance = JSON.parse(fs.readFileSync(new URL('provenance.json', root)));
assert.equal(provenance.resources.length, 33);
for (const resource of provenance.resources) {
  const bytes = fs.readFileSync(new URL(resource.file, root));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), resource.sha256);
  const { Idle, Walk } = CHARACTER_METADATA[resource.key];
  assert.equal(Idle.file, Walk.file, 'Idle reuses the downloaded walk sheet');
  assert.equal(Idle.static, true);
  assert.equal(bytes.readUInt32BE(16), Walk.w * Walk.n);
  assert.equal(bytes.readUInt32BE(20), Walk.h * Walk.r);
  assert.deepEqual([Idle.ax, Idle.ay], [Walk.ax, Walk.ay]);
}
assert.equal(resolveCharacterKey({ type: 'agent', trainerKey: 'acetrainerFGen2' }), 'acetrainerf');
assert.equal(resolveCharacterKey({ type: 'nurse', spriteUrl: 'https://play.pokemonshowdown.com/sprites/trainers/nurse.png' }), 'nurse');
assert.equal(resolveCharacterKey({ type: 'rival', spriteUrl: 'https://play.pokemonshowdown.com/sprites/trainers/rocketgruntf.png' }), 'rocketgruntf');
assert.equal(resolveCharacterKey({ type: 'boss', spriteUrl: '/assets/trainer_sprite/trainer_giovanni/Sprite_Giovanni_HGSS.png' }), 'giovanni');
assert.equal(resolveCharacterKey({ type: 'agent', trainerKey: 'unknown', spriteUrl: '/nurse.png' }), null);
assert.equal(resolveCharacterKey({ type: 'favorite', trainerKey: 'nurse', dex: 52 }), null);
assert.equal(resolveCharacterKey({ type: 'agent', spriteUrl: 'data:image/png;base64,abc' }), null);

globalThis.trainerSprite = key => `https://local.invalid/${key}.png`;
globalThis.TITLES = [];
const state = { agents: [{ name: 'Agent', spriteKey: 'rocketgrunt', team: [] }],
  pokemons: [], gang: { reputation: 1000, bossSprite: 'giovanni' }, eggs: ['egg'], pension: {} };
const saved = JSON.stringify(state);
const pool = buildVivariumCameoPool(state);
for (const type of ['agent', 'boss', 'nurse', 'scientist', 'rival', 'fan']) {
  const entry = pool.find(c => c.type === type);
  assert.ok(entry.trainerKey, `${type} snapshots preserve the trainer identity`);
  assert.ok(resolveCharacterKey(entry), `${type} resolves to a supported overworld sprite`);
  assert.ok(entry.spriteUrl, 'Portrait URL kept for older clients and bubbles');
}
assert.equal(JSON.stringify(state), saved, 'Snapshot building never changes the save');

// Shared scheduler + full URL cache keys: PMD and HGSS sheets cannot collide.
const jobs = new Map(), images = [], draws = [];
let seq = 0;
const makeHost = () => {
  const image = { hidden: false };
  return { isConnected: true, querySelector: () => image,
    classList: { add() {}, remove() {} }, appendChild(canvas) { this.canvas = canvas; } };
};
const doc = { hidden: false, addEventListener() {}, removeEventListener() {},
  createElement: () => ({ style: {}, setAttribute() {}, remove() {},
    getContext: () => ({ clearRect() {}, drawImage: (...args) => draws.push(args) }) }) };
const renderer = createPmdRenderer({ doc, motion: null,
  raf: fn => { jobs.set(++seq, fn); return seq; }, caf: id => jobs.delete(id),
  makeImage: () => { const img = {}; images.push(img); return img; } });
const host = makeHost();
const actor = renderer.attachAnimation(host, CHARACTER_METADATA.nurse, { assetBaseUrl: root });
const second = renderer.attachAnimation(makeHost(), CHARACTER_METADATA.nurse, { assetBaseUrl: root });
assert.equal(images.length, 1);
assert.equal(jobs.size, 0, 'Fixed Idle poses need no animation loop');
Object.assign(images[0], { naturalWidth: 128, naturalHeight: 128 });
images[0].onload();
await Promise.resolve();
for (const time of [0, 160, 320]) {
  const pending = [...jobs.values()]; jobs.clear(); pending.forEach(fn => fn(time));
}
assert.equal(draws.at(-1)[1], 0, 'Idle never advances to a walking pose');
actor.set('Walk', 2);
assert.equal(jobs.size, 1, 'Walking restarts the shared loop');
assert.equal(images.length, 1, 'Walking reuses the same sheet');
assert.equal(draws.at(-1)[2], 32, 'Right direction uses the second row');
const pending = [...jobs.values()]; jobs.clear(); pending.forEach(fn => fn(420));
const next = [...jobs.values()]; jobs.clear(); next.forEach(fn => fn(520));
const last = [...jobs.values()]; jobs.clear(); last.forEach(fn => fn(620));
assert.notEqual(draws.at(-1)[1], 0, 'Walk advances');
actor.set('Idle', 6);
assert.equal(jobs.size, 0, 'The loop stops when only fixed Idle poses remain');
assert.equal(draws.at(-1)[2], 96, 'Left direction uses the fourth row');
assert.equal(host.canvas.style.top, '-20px', 'Feet stay anchored at y=40');
actor.destroy(); second.destroy(); renderer.dispose();
assert.equal(jobs.size, 0);
assert.equal(renderer.stats().actors, 0);
console.log('PASS HGSS characters: asset provenance, geometry, identity, legacy snapshots, idle/walk, directions, shared cache and disposal');
