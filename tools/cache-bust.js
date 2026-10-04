#!/usr/bin/env node
// Rewrites every local `?v=` query string in each tracked HTML entry point
// with a short hash of the referenced file's actual content, so a stale-cache
// bug can never happen silently: the version string only changes when the
// file does. Also adds a `?v=` to local tags that don't have one yet.
// Run manually with `node tools/cache-bust.js`, or automatically via the
// pre-commit hook (.githooks/pre-commit).
//
// Line endings are normalised (CRLF → LF) before hashing. The repository stores
// these files with LF, but a Windows checkout with core.autocrlf=true rewrites
// them as CRLF in the working tree. Hashing the raw bytes therefore gave a
// different hash per machine for identical content, and never the hash of the
// bytes the CI checkout (LF) actually deploys — every commit from a CRLF checkout
// flipped the `?v=` values for nothing. With the normalisation the hash is a
// function of the content alone.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const HTML_FILES = ['index.html', 'gang/index.html', 'gang/live.html', 'gang/card.html'].map(f => path.join(ROOT, f));

// Matches src="./foo.js" / href="../foo.css", with an optional existing
// `?v=...` — scoped to local .js/.css assets only (never bare paths,
// http(s):// URLs, icons, or plain navigation links), and a version is
// added even if not already present.
const TAG_RE = /((?:src|href)=")(\.\.?\/[^"?]+\.(?:js|css))(?:\?v=[^"]*)?(")/g;

// CRLF → LF au niveau des octets. Un CR isolé (sans LF derrière) est conservé.
function stripCR(buf) {
  const out = Buffer.allocUnsafe(buf.length);
  let n = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0d && buf[i + 1] === 0x0a) continue;
    out[n++] = buf[i];
  }
  return out.subarray(0, n);
}

function contentHash(buf) {
  return crypto.createHash('sha1').update(stripCR(buf)).digest('hex').slice(0, 8);
}

function hashFile(baseDir, relPath) {
  return contentHash(fs.readFileSync(path.join(baseDir, relPath)));
}

function processFile(htmlPath) {
  const baseDir = path.dirname(htmlPath);
  const html = fs.readFileSync(htmlPath, 'utf8');
  let changed = false;
  const skipped = [];

  const updated = html.replace(TAG_RE, (full, prefix, relPath, suffix) => {
    let hash;
    try {
      hash = hashFile(baseDir, relPath);
    } catch (err) {
      skipped.push(relPath);
      return full;
    }
    const newTag = `${prefix}${relPath}?v=${hash}${suffix}`;
    if (newTag !== full) changed = true;
    return newTag;
  });

  if (skipped.length) {
    console.warn(`[cache-bust] ${path.relative(ROOT, htmlPath)} — fichier(s) introuvable(s), ignoré(s): ${skipped.join(', ')}`);
  }

  if (changed) {
    fs.writeFileSync(htmlPath, updated);
    console.log(`[cache-bust] ${path.relative(ROOT, htmlPath)} mis à jour avec les hashs de contenu actuels.`);
  } else {
    console.log(`[cache-bust] ${path.relative(ROOT, htmlPath)} — rien à faire, tous les hashs sont déjà à jour.`);
  }
}

function main() {
  HTML_FILES.forEach(processFile);
}

if (require.main === module) main();

module.exports = { HTML_FILES, TAG_RE, stripCR, contentHash, hashFile, processFile };
