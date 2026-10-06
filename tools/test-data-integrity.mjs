// Cross-references between the static data files: every species, trainer and
// evolution a zone or a chain points to must exist. A broken key fails silently
// in game (an unknown trainer is skipped or swapped for the zone's elite), so
// it has to be caught here. Run: node tools/test-data-integrity.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { TRAINER_TYPES } from '../data/trainers-data.js';

// The zone/species/evolution files are classic scripts: their top-level
// `const` live in one shared lexical scope, as in the browser.
const ctx = vm.createContext({ console });
const classic = [
  'data/species-data.js',
  'data/evolutions-data.js',
  'data/zones-data.js',
  'data/zones-johto-data.js',
  'data/zones-hoenn-data.js',
  'data/zones-sinnoh-data.js',
];
vm.runInContext(
  classic.map(f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n;\n')
    + '\n;globalThis.__data = { SPECIES_BY_EN, EVO_BY_SPECIES, ZONES, ZONES_JOHTO, ZONES_HOENN, ZONES_SINNOH };',
  ctx,
);
const { SPECIES_BY_EN, EVO_BY_SPECIES, ZONES, ZONES_JOHTO, ZONES_HOENN, ZONES_SINNOH } = ctx.__data;

const problems = [];
const zones = [...ZONES, ...ZONES_JOHTO, ...ZONES_HOENN, ...ZONES_SINNOH];
const seenIds = new Set();
for (const zone of zones) {
  if (seenIds.has(zone.id)) problems.push(`duplicate zone id ${zone.id}`);
  seenIds.add(zone.id);
  for (const entry of zone.pool || []) {
    const en = typeof entry === 'string' ? entry : entry?.species_en ?? entry?.en;
    if (!SPECIES_BY_EN[en]) problems.push(`zone ${zone.id}: unknown species ${JSON.stringify(entry)}`);
  }
  for (const key of zone.trainers || []) {
    if (!TRAINER_TYPES[key]) problems.push(`zone ${zone.id}: unknown trainer ${key}`);
  }
  if (typeof zone.eliteTrainer === 'string' && !TRAINER_TYPES[zone.eliteTrainer]) {
    problems.push(`zone ${zone.id}: unknown elite trainer ${zone.eliteTrainer}`);
  }
}

for (const [from, evolutions] of Object.entries(EVO_BY_SPECIES)) {
  if (!SPECIES_BY_EN[from]) problems.push(`evolution from unknown species ${from}`);
  for (const { to } of evolutions) {
    if (!SPECIES_BY_EN[to]) problems.push(`evolution ${from} -> unknown species ${to}`);
  }
}

assert.ok(zones.length > 100, `expected every region's zones, got ${zones.length}`);
assert.deepEqual(problems, []);
console.log(`✓ data integrity: ${zones.length} zones, ${Object.keys(TRAINER_TYPES).length} trainers, ${Object.keys(EVO_BY_SPECIES).length} evolution sources`);
