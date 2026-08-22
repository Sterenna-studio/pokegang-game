#!/usr/bin/env node
// Builds a self-contained folder + versioned zip ready to upload to itch.io.
// The public itch release metadata lives in release/itch-release.json so the
// upload filename and documentation are driven from one small source of truth.
// The staged copy still flips the default language to English only for itch.
// See docs/itch-build.md for the full release workflow and historical pitfalls.

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const STAGE_DIR = path.join(ROOT, 'dist-itch');
const RELEASE_MANIFEST_PATH = path.join(ROOT, 'release', 'itch-release.json');

function readReleaseManifest() {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(RELEASE_MANIFEST_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`[build-itch] impossible de lire release/itch-release.json: ${error.message}`);
  }

  if (!/^\d+\.\d+\.\d+$/.test(manifest.version || '')) {
    throw new Error('[build-itch] release.version doit être un SemVer simple x.y.z.');
  }

  const expectedUpload = `pokegang-v${manifest.version}-itch.zip`;
  if (manifest.uploadFile !== expectedUpload) {
    throw new Error(
      `[build-itch] uploadFile doit être "${expectedUpload}" pour la version ${manifest.version}.`
    );
  }

  return manifest;
}

const RELEASE = readReleaseManifest();
const ZIP_PATH = path.join(ROOT, RELEASE.uploadFile);

// Tout ce dont le jeu principal a besoin au runtime — voir docs/itch-build.md
// pour le détail (notamment gang/, qui n'est PAS que la page compagnon).
const INCLUDE = ['index.html', 'app.js', 'css', 'data', 'modules', 'state', 'assets', 'gang'];

function clean() {
  fs.rmSync(STAGE_DIR, { recursive: true, force: true });
  fs.rmSync(path.join(ROOT, 'dist-itch.zip'), { force: true }); // ancien nom de build
  fs.rmSync(ZIP_PATH, { force: true });
}

function stage() {
  fs.mkdirSync(STAGE_DIR, { recursive: true });
  for (const entry of INCLUDE) {
    fs.cpSync(path.join(ROOT, entry), path.join(STAGE_DIR, entry), { recursive: true });
  }
  console.log(`[build-itch] ${INCLUDE.length} entrées copiées dans dist-itch/`);
}

// itch.io démarre en anglais par défaut — pokegang.sterenna.fr reste en 'fr'.
// Patché uniquement dans la copie stagée, jamais dans le repo.
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
  console.log('[build-itch] state/defaultState.js patché : langue par défaut = en (copie uniquement).');
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
// séparateurs `\\`, ce que la spec ZIP interdit. itch.io traite alors les
// chemins comme des noms de fichiers littéraux et tous les assets 404. Bug déjà
// livré une fois — d'où pwsh 7+ en priorité ET la validation ci-dessous.
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
  console.log(`[build-itch] ${RELEASE.uploadFile} généré (${(size / (1024 * 1024)).toFixed(2)} Mo).`);
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
    const nameLen = buf.readUInt16LE(i + 28);
    const extraLen = buf.readUInt16LE(i + 30);
    const cmtLen = buf.readUInt16LE(i + 32);
    names.push(buf.toString('utf8', i + 46, i + 46 + nameLen));
    i += 46 + nameLen + extraLen + cmtLen - 1;
  }
  return names;
}

function validateReleaseAlignment() {
  const sourceState = fs.readFileSync(path.join(ROOT, 'state', 'defaultState.js'), 'utf8');
  const stagedState = fs.readFileSync(path.join(STAGE_DIR, 'state', 'defaultState.js'), 'utf8');

  if (!sourceState.includes("lang: 'fr',")) {
    throw new Error('[build-itch] le source principal ne semble plus être FR par défaut.');
  }
  if (!stagedState.includes("lang: 'en', // itch.io build default")) {
    throw new Error('[build-itch] la copie itch n’a pas été basculée en anglais.');
  }

  // GAME_VERSION est volontairement un libellé produit plus large (ex. v0.5)
  // alors que le manifeste itch porte le patch SemVer exact (ex. 0.5.0).
  const gameVersion = sourceState.match(/export const GAME_VERSION = '([^']+)'/)?.[1] || '';
  const releaseMinor = RELEASE.version.split('.').slice(0, 2).join('.');
  if (!gameVersion.startsWith(`v${releaseMinor}`)) {
    throw new Error(
      `[build-itch] GAME_VERSION (${gameVersion || 'introuvable'}) n'est pas aligné avec la release itch v${RELEASE.version}.`
    );
  }

  if (fs.existsSync(path.join(STAGE_DIR, 'config.js'))) {
    throw new Error('[build-itch] config.js ne doit jamais être inclus dans le build itch.');
  }
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

  for (const dir of ['css', 'data', 'modules', 'state', 'assets', 'gang']) {
    if (!names.some(n => n.startsWith(`${dir}/`))) {
      throw new Error(`[build-itch] aucune entrée sous ${dir}/ — le build est incomplet.`);
    }
  }

  validateReleaseAlignment();
  console.log(
    `[build-itch] Validation OK : release v${RELEASE.version}, ${names.length} entrées, ` +
    `séparateurs '/', index.html à la racine, EN itch / FR site, config.js absent.`
  );
}

function main() {
  console.log(`[build-itch] Préparation PokéGang v${RELEASE.version} (${RELEASE.channel}).`);
  clean();
  stage();
  patchLang();
  zip();
  validate();
  console.log(`[build-itch] Terminé — ${RELEASE.uploadFile} prêt à uploader sur itch.io.`);
}

main();
