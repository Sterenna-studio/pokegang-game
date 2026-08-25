import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
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

const albumDir = new URL('./screenshot-studio/album/', import.meta.url);
const albumHtml = await readFile(new URL('./screenshot-studio/album.html', import.meta.url), 'utf8');
const albumFiles = (await readdir(albumDir)).sort();
const referencedFiles = [...albumHtml.matchAll(/file:\s*'album\/([^']+)'/g)]
  .map(match => match[1])
  .sort();

assert.deepEqual(referencedFiles, albumFiles, 'every album asset must have exactly one card');
assert.equal(new Set(referencedFiles).size, referencedFiles.length, 'album cards must not repeat a file');

const hashes = new Map();
for (const file of albumFiles) {
  assert.match(file, /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:gif|png)$/, `${file} must use a stable kebab-case name`);
  const contents = await readFile(new URL(`./screenshot-studio/album/${file}`, import.meta.url));
  const hash = createHash('sha256').update(contents).digest('hex');
  assert.ok(!hashes.has(hash), `${file} duplicates ${hashes.get(hash)}`);
  hashes.set(hash, file);
}

console.log(`screenshot studio: ${SCENES.length} scenes and ${albumFiles.length} album assets OK`);
