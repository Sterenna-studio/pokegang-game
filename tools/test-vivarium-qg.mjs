import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HQ_BACKGROUND, HQ_AREAS, wantsHq, hqRange, residentLocation, cameoLocation } from '../modules/systems/vivariumZones.js';
import { buildVivariumBackgroundData, buildVivariumResidents } from '../modules/systems/vivariumSnapshot.js';
assert.equal(wantsHq({ cosmetics: {} }), true);
assert.equal(wantsHq({ cosmetics: { bossBg: 'forest' } }), false);
assert.equal(wantsHq({ cosmetics: { vivariumScene: 'classic' } }), false);
assert.equal(wantsHq({ cosmetics: { bossBg: 'forest', vivariumScene: 'hq' } }), true);
assert.equal(buildVivariumBackgroundData({ cosmetics: {} }).url, HQ_BACKGROUND.url);
assert.equal(new Set(HQ_AREAS.map(a => a.id)).size, 4);
for (const area of HQ_AREAS) {
  assert.ok(area.x >= 0 && area.y >= 0 && area.x + area.w <= 1 && area.y + area.h <= 1);
}
const svg = fs.readFileSync(new URL('../assets/vivarium/hq.svg', import.meta.url), 'utf8');
assert.ok(svg.length < 8000);
assert.ok(!svg.includes('<script') && !svg.includes('<image'), 'Standalone original static artwork');
globalThis.SPECIES_BY_EN = { meowth: { dex: 52 } };
globalThis.pokeSprite = () => 'fallback.png';
const state = { cosmetics: { vivariumSources: ['showcase', 'team', 'pension', 'training'] },
  gang: { showcase: ['p'], bossTeamSlots: [['p', 'q']] }, pension: { slots: ['p'] },
  trainingRoom: { pokemon: ['q'] }, agents: [{ resting: true }],
  pokemons: [{ id: 'p', species_en: 'meowth' }, { id: 'q', species_en: 'meowth' }] };
const before = JSON.stringify(state);
assert.equal(residentLocation('p', state), 'pension');
assert.equal(cameoLocation({ type: 'agent', resting: true }), 'rest');
assert.equal(cameoLocation({ type: 'agent', resting: false, assignedZone: 'route1' }), 'rest');
assert.equal(cameoLocation({ type: 'nurse' }), 'pension');
assert.equal(cameoLocation({ type: 'scientist' }), 'training');
assert.deepEqual(buildVivariumResidents(state).map(r => r.location), ['pension', 'training']);
assert.deepEqual(buildVivariumBackgroundData(state).occupancy, { pc: 0, pension: 1, training: 1 });
for (const area of HQ_AREAS) {
  const r = hqRange(area.id, { width: 390, height: 480 }, { rx: 18, ry: 9 }, { minX: 0, maxX: 342 });
  assert.ok(r.maxX >= r.minX && r.maxY >= r.minY && r.minX >= 0 && r.maxX <= 342);
}
assert.equal(JSON.stringify(state), before);
console.log('PASS QG: optional scene, custom backgrounds preserved, four bounded areas and standalone static SVG');
