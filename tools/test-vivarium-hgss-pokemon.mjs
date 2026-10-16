import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { HGSS_METADATA, HGSS_BODY_HEIGHT } from '../assets/pokemon_hgss/metadata.js';
import { hgssPokemonVariant } from '../gang/hgssPokemon.js';
const root = new URL('../assets/pokemon_hgss/', import.meta.url);
const provenance = JSON.parse(fs.readFileSync(new URL('provenance.json', root)));
assert.equal(provenance.resources.length, 24);
for (const r of provenance.resources) {
  const bytes = fs.readFileSync(new URL(r.file, root));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), r.sha256);
  const { Idle, Walk } = HGSS_METADATA[r.dex][r.variant];
  assert.equal(bytes.readUInt32BE(16), Walk.w * Walk.n);
  assert.equal(bytes.readUInt32BE(20), Walk.h * Walk.r);
  assert.equal(Idle.file, Walk.file, 'One demand-loaded file for Idle and Walk');
  assert.equal(Idle.static, true);
  assert.equal(Walk.r, 4);
  assert.deepEqual([Idle.ax, Idle.ay], [Walk.ax, Walk.ay]);
  assert.ok(HGSS_BODY_HEIGHT[`${r.dex}/${r.variant}`] > 0);
}
assert.ok(hgssPokemonVariant({ dex: 25 }));
assert.equal(hgssPokemonVariant({ dex: 25, shiny: true }), null);
assert.ok(hgssPokemonVariant({ dex: 130, shiny: true }));
assert.equal(hgssPokemonVariant({ dex: 130 }), null);
assert.equal(hgssPokemonVariant({ dex: 52 }), null);
assert.equal(hgssPokemonVariant({ dex: 487 }), null, 'Origin form is not the base species');
assert.equal(hgssPokemonVariant({ dex: 486 }), null, 'Static front-only Regigigas is not a walking sprite');
console.log('PASS HGSS Pokémon: 24 credited variants, hashes/geometry, shared Idle/Walk sheet, shiny-specific and absent-species/form fallback');
