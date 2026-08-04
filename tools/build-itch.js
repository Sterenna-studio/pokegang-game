#!/usr/bin/env node
// Builds a self-contained folder + zip ready to upload to itch.io: copies
// only the files the game actually needs at runtime, and flips the default
// language to English in the COPY ONLY (pokegang.sterenna.fr keeps 'fr' in
// the source repo). See docs/itch-build.md for the why behind every choice
// here — most notably why `gang/` must be included even though it looks
// like just the standalone companion page.
//
// Run with `node tools/build-itch.js`. Produces dist-itch/ (staged files,
// for manual inspection) and dist-itch.zip (upload this one) at the repo
// root — both gitignored, regenerated from scratch on every run.

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT      = path.resolve(__dirname, '..');
const STAGE_DIR = path.join(ROOT, 'dist-itch');
const ZIP_PATH  = path.join(ROOT, 'dist-itch.zip');

// Tout ce dont le jeu principal a besoin au runtime — voir docs/itch-build.md
// pour le detail (notamment gang/, qui n'est PAS que la page compagnon).
const INCLUDE = ['index.html', 'app.js', 'css', 'data', 'modules', 'state', 'assets', 'gang'];

function clean() {
  fs.rmSync(STAGE_DIR, { recursive: true, force: true });
  fs.rmSync(ZIP_PATH, { force: true });
}

function stage() {
  fs.mkdirSync(STAGE_DIR, { recursive: true });
  for (const entry of INCLUDE) {
    fs.cpSync(path.join(ROOT, entry), path.join(STAGE_DIR, entry), { recursive: true });
  }
  console.log(`[build-itch] ${INCLUDE.length} entrées copiées dans dist-itch/`);
}

// itch.io démarre en anglais par défaut (issue #57/#58) — pokegang.sterenna.fr
// reste en 'fr'. Patché uniquement dans la copie stagée, jamais dans le repo.
function patchLang() {
  const target = path.join(STAGE_DIR, 'state', 'defaultState.js');
  const src = fs.readFileSync(target, 'utf8');
  const needle = "lang: 'fr',";
  const count = src.split(needle).length - 1;
  if (count !== 1) {
    throw new Error(
      `[build-itch] attendu exactement 1 occurrence de "${needle}" dans state/defaultState.js, ` +
      `trouvé ${count} — le fichier a changé de forme, vérifier le patch de langue à la main.`
    );
  }
  const patched = src.replace(
    needle,
    "lang: 'en', // itch.io build default — pokegang.sterenna.fr keeps 'fr' in the source repo"
  );
  fs.writeFileSync(target, patched);
  console.log('[build-itch] state/defaultState.js patché : lang par défaut = en (copie uniquement).');
}

function zip() {
  if (process.platform === 'win32') {
    execFileSync('powershell', [
      '-NoProfile', '-Command',
      `Compress-Archive -Path '${STAGE_DIR}\\*' -DestinationPath '${ZIP_PATH}' -CompressionLevel Optimal`,
    ], { stdio: 'inherit' });
  } else {
    execFileSync('zip', ['-r', ZIP_PATH, '.'], { cwd: STAGE_DIR, stdio: 'inherit' });
  }
  const { size } = fs.statSync(ZIP_PATH);
  console.log(`[build-itch] dist-itch.zip généré (${(size / (1024 * 1024)).toFixed(2)} Mo).`);
}

function main() {
  clean();
  stage();
  patchLang();
  zip();
  console.log('[build-itch] Terminé — dist-itch.zip prêt à uploader sur itch.io (voir docs/itch-build.md).');
}

main();
