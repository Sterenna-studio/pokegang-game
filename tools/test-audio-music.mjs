#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const intervals = [];
const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;

globalThis.setInterval = (fn) => {
  fn();
  intervals.push(fn);
  return intervals.length;
};
globalThis.clearInterval = () => {};

const createdAudio = [];
class FakeAudio {
  constructor(src) {
    this.src = src;
    this.loop = false;
    this.volume = 0;
    this.preload = '';
    this.paused = true;
    this.dataset = {};
    createdAudio.push(this);
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  addEventListener() {}
}

globalThis.Audio = FakeAudio;
globalThis.state = {
  settings: { musicEnabled: true, musicVol: 50 },
  openZoneOrder: [],
};

const { MusicPlayer } = await import('../modules/ui/audio.js');

MusicPlayer.play('base');
assert.equal(createdAudio.length, 1, 'base track should create one audio element');
assert.equal(createdAudio[0].src, 'music/BGM/First Town.mp3');
assert.equal(Number(createdAudio[0].dataset.targetVol).toFixed(3), '0.225', '50% of base 0.45 volume');

MusicPlayer.setVolume(1);
assert.equal(createdAudio[0].volume.toFixed(2), '0.45', '100% global volume keeps the base track volume');
assert.equal(globalThis.state.settings.musicVol, 100);

MusicPlayer.setVolume(0.25);
assert.equal(createdAudio[0].volume.toFixed(4), '0.1125', '25% global volume scales the base track volume');
assert.equal(globalThis.state.settings.musicVol, 25);

const audioSource = fs.readFileSync(new URL('../modules/ui/audio.js', import.meta.url), 'utf8');
const audioFiles = [...audioSource.matchAll(/['"`](music\/[^'"`]+\.(?:mp3|ogg|wav|WAV|mid))['"`]/g)]
  .map(match => match[1]);
const missingAudioFiles = [...new Set(audioFiles)]
  .filter(file => !fs.existsSync(new URL(`../${file}`, import.meta.url)));
assert.deepEqual(missingAudioFiles, [], 'every audio.js music path should exist in the repo');

globalThis.setInterval = originalSetInterval;
globalThis.clearInterval = originalClearInterval;

console.log('audio music tests: ok');
