import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HQ_BACKGROUND, HQ_AREAS, wantsHq } from '../modules/systems/vivariumZones.js';
import { buildVivariumBackgroundData } from '../modules/systems/vivariumSnapshot.js';
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
console.log('PASS QG: optional scene, custom backgrounds preserved, four bounded areas and standalone static SVG');
