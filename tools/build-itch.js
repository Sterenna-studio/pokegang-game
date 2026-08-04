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

function which(bin) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [bin], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ⚠ Windows PowerShell 5.1 (`powershell.exe`) produit des entrées zip avec des
// séparateurs `\`, ce que la spec ZIP interdit (APPNOTE 4.4.17.1 impose `/`).
// itch.io traite alors `css\base.css` comme un NOM DE FICHIER littéral au lieu
// d'un chemin : le jeu se charge, mais tous les assets renvoient 404. Bug
// réellement livré une fois — d'où pwsh 7+ en priorité ET la validation
// ci-dessous, qui fait échouer le build au lieu de laisser passer.
function zip() {
  if (process.platform === 'win32') {
    const shell = which('pwsh') ? 'pwsh' : 'powershell';
    if (shell === 'powershell') {
      console.warn('[build-itch] ⚠ pwsh (PowerShell 7+) introuvable, fallback sur powershell 5.1 — ' +
                   'ses séparateurs de chemin sont peut-être invalides, la validation va le dire.');
    }
    execFileSync(shell, [
      '-NoProfile', '-Command',
      `Compress-Archive -Path '${STAGE_DIR}${path.sep}*' -DestinationPath '${ZIP_PATH}' -CompressionLevel Optimal`,
    ], { stdio: 'inherit' });
  } else {
    execFileSync('zip', ['-r', ZIP_PATH, '.'], { cwd: STAGE_DIR, stdio: 'inherit' });
  }
  const { size } = fs.statSync(ZIP_PATH);
  console.log(`[build-itch] dist-itch.zip généré (${(size / (1024 * 1024)).toFixed(2)} Mo).`);
}

// Lit le central directory du zip et retourne la liste des noms d'entrées.
// Implémentation minimale volontaire (pas de dépendance) : on cherche les
// signatures 0x02014b50, il n'y a que le nom qui nous intéresse.
function readZipEntryNames(zipPath) {
  const buf = fs.readFileSync(zipPath);
  const names = [];
  const SIG = 0x02014b50;
  for (let i = 0; i <= buf.length - 46; i++) {
    if (buf.readUInt32LE(i) !== SIG) continue;
    const nameLen  = buf.readUInt16LE(i + 28);
    const extraLen = buf.readUInt16LE(i + 30);
    const cmtLen   = buf.readUInt16LE(i + 32);
    names.push(buf.toString('utf8', i + 46, i + 46 + nameLen));
    i += 46 + nameLen + extraLen + cmtLen - 1;
  }
  return names;
}

function validate() {
  const names = readZipEntryNames(ZIP_PATH);
  if (names.length === 0) {
    throw new Error('[build-itch] aucune entrée lue dans le zip — archive corrompue ou format inattendu.');
  }

  const backslashed = names.filter(n => n.includes('\\'));
  if (backslashed.length) {
    throw new Error(
      `[build-itch] ${backslashed.length}/${names.length} entrées utilisent '\\' comme séparateur ` +
      `(ex: ${backslashed[0]}). La spec ZIP impose '/' — itch.io servirait des 404 sur tous les assets. ` +
      `Installer PowerShell 7+ (pwsh) et relancer.`
    );
  }

  if (!names.includes('index.html')) {
    throw new Error('[build-itch] index.html absent de la racine du zip — itch.io ne saurait pas quoi lancer.');
  }

  // Les dossiers dont le jeu a besoin au runtime doivent être présents en tant
  // que préfixe de chemin (gang/ inclus : dépendance réelle, cf. docs/itch-build.md).
  for (const dir of ['css', 'data', 'modules', 'state', 'assets', 'gang']) {
    if (!names.some(n => n.startsWith(`${dir}/`))) {
      throw new Error(`[build-itch] aucune entrée sous ${dir}/ — le build est incomplet.`);
    }
  }

  console.log(`[build-itch] Validation OK : ${names.length} entrées, séparateurs '/', index.html à la racine.`);
}

function main() {
  clean();
  stage();
  patchLang();
  zip();
  validate();
  console.log('[build-itch] Terminé — dist-itch.zip prêt à uploader sur itch.io (voir docs/itch-build.md).');
}

main();
