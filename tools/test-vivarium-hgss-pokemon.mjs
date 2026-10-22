import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { HGSS_METADATA, HGSS_BODY_HEIGHT } from '../assets/pokemon_hgss/metadata.js';
import { hgssPokemonVariant } from '../gang/hgssPokemon.js';
const root = new URL('../assets/pokemon_hgss/', import.meta.url);
const provenance = JSON.parse(fs.readFileSync(new URL('provenance.json', root)));
assert.equal(provenance.resources.length, 24);
// Les PNG ne sont pas suivis par Git (conditions de l'auteur : pas de redistribution, cf.
// SOURCE-CONDITIONS.txt) : absents en CI ou sur un clone neuf. Métadonnées toujours vérifiées ;
// hash et géométrie des octets seulement quand les fichiers sont présents.
let pngChecked = 0;
for (const r of provenance.resources) {
  const { Idle, Walk } = HGSS_METADATA[r.dex][r.variant];
  const file = new URL(r.file, root);
  if (fs.existsSync(file)) {
    const bytes = fs.readFileSync(file);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), r.sha256);
    assert.equal(bytes.readUInt32BE(16), Walk.w * Walk.n);
    assert.equal(bytes.readUInt32BE(20), Walk.h * Walk.r);
    pngChecked++;
  }
  assert.equal(Idle.file, Walk.file, 'One demand-loaded file for Idle and Walk');
  assert.equal(Idle.static, true);
  assert.equal(Walk.r, 4);
  assert.deepEqual([Idle.ax, Idle.ay], [Walk.ax, Walk.ay]);
  assert.ok(HGSS_BODY_HEIGHT[`${r.dex}/${r.variant}`] > 0);
}
if (pngChecked < provenance.resources.length) console.log(`(HGSS: ${provenance.resources.length - pngChecked} PNG absents — hash/géométrie non vérifiés)`);
assert.ok(hgssPokemonVariant({ dex: 25 }));
assert.equal(hgssPokemonVariant({ dex: 25, shiny: true }), null);
assert.ok(hgssPokemonVariant({ dex: 130, shiny: true }));
assert.equal(hgssPokemonVariant({ dex: 130 }), null);
assert.equal(hgssPokemonVariant({ dex: 52 }), null);
assert.equal(hgssPokemonVariant({ dex: 487 }), null, 'Origin form is not the base species');
assert.equal(hgssPokemonVariant({ dex: 486 }), null, 'Static front-only Regigigas is not a walking sprite');
console.log('PASS HGSS Pokémon: 24 credited variants, hashes/geometry, shared Idle/Walk sheet, shiny-specific and absent-species/form fallback');
