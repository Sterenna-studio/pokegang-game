#!/usr/bin/env node
// Rewrites every local `?v=` query string in index.html with a short hash of
// the referenced file's actual content, so a stale-cache bug can never
// happen silently: the version string only changes when the file does.
// Run manually with `node tools/cache-bust.js`, or automatically via the
// pre-commit hook (.githooks/pre-commit).

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'index.html');

// Matches src="./foo.js?v=1" or href="./foo.css?v=3" — only local,
// relative, already-versioned assets are touched.
const TAG_RE = /((?:src|href)=")(\.\/[^"?]+)\?v=[^"]*(")/g;

function hashFile(relPath) {
  const abs = path.join(ROOT, relPath);
  const buf = fs.readFileSync(abs);
  return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
}

function main() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  let changed = false;
  const skipped = [];

  const updated = html.replace(TAG_RE, (full, prefix, relPath, suffix) => {
    let hash;
    try {
      hash = hashFile(relPath);
    } catch (err) {
      skipped.push(relPath);
      return full;
    }
    const newTag = `${prefix}${relPath}?v=${hash}${suffix}`;
    if (newTag !== full) changed = true;
    return newTag;
  });

  if (skipped.length) {
    console.warn(`[cache-bust] fichier(s) introuvable(s), ignoré(s): ${skipped.join(', ')}`);
  }

  if (changed) {
    fs.writeFileSync(INDEX_HTML, updated);
    console.log('[cache-bust] index.html mis à jour avec les hashs de contenu actuels.');
  } else {
    console.log('[cache-bust] rien à faire — tous les hashs sont déjà à jour.');
  }
}

main();
