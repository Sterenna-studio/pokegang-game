import assert from 'node:assert/strict';
import { SCENES, DEFAULT_SCENE_ID, getScene } from './screenshot-studio/scenes.mjs';

assert.ok(SCENES.length >= 12, 'expected a useful screenshot scene set');
assert.equal(new Set(SCENES.map(scene => scene.id)).size, SCENES.length, 'scene ids must be unique');
assert.ok(getScene(DEFAULT_SCENE_ID), 'default scene must exist');

for (const scene of SCENES) {
  for (const lang of ['fr', 'en']) {
    const html = scene.render({ lang, width: 1280, height: 720 });
    assert.match(html, /shot-scene/, `${scene.id}/${lang} must render a shot scene`);
    assert.ok(html.length > 300, `${scene.id}/${lang} render is unexpectedly small`);
  }
}

console.log(`screenshot studio scenes: ${SCENES.length} scenes OK`);
