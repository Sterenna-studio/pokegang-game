// tools/cache-bust.js : les hashs `?v=` ne doivent dépendre que du CONTENU des fichiers.
//
// Avant la normalisation, le hash portait sur les octets bruts de la copie de travail :
// un checkout Windows (core.autocrlf=true) en CRLF donnait un autre hash que le checkout
// Linux (LF) de la CI qui déploie, pour un contenu identique. Chaque commit venant d'une
// machine en CRLF réécrivait des `?v=` sans raison, et le hash ne correspondait jamais
// aux octets réellement servis.
//
//   node tools/test-cache-bust.mjs

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { HTML_FILES, TAG_RE, stripCR, contentHash, processFile } = require('./cache-bust.js');

const sha8 = buf => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8);
const B = s => Buffer.from(s, 'utf8');

const failures = [];
const check = (label, fn) => {
  try { fn(); console.log('  ok   ' + label); }
  catch (e) { failures.push(label + ' — ' + e.message); console.log('  FAIL ' + label + '\n         ' + e.message); }
};

console.log('\n── normalisation des fins de ligne ───────────────────────────────');

check('CRLF et LF donnent le même hash', () => {
  const lf = B('const a = 1;\nconst b = 2;\n');
  const crlf = B('const a = 1;\r\nconst b = 2;\r\n');
  assert.equal(contentHash(crlf), contentHash(lf));
});

check('fins de ligne mélangées : même hash que la version LF', () => {
  const lf = B('a\nb\nc\nd\n');
  const mixed = B('a\r\nb\nc\r\nd\n');
  assert.equal(contentHash(mixed), contentHash(lf));
});

check('le hash est celui des octets LF, donc de ce que la CI Linux déploie', () => {
  const lf = B('body { color: red; }\n');
  assert.equal(contentHash(B('body { color: red; }\r\n')), sha8(lf));
});

check('un vrai changement de contenu change le hash', () => {
  assert.notEqual(contentHash(B('x = 1;\n')), contentHash(B('x = 2;\n')));
  assert.notEqual(contentHash(B('x = 1;\r\n')), contentHash(B('x = 1; \r\n')), 'un espace en fin de ligne est un changement');
});

check('un CR isolé (sans LF) n\'est pas du contenu jetable', () => {
  const lone = B('a\rb\n');
  assert.deepEqual([...stripCR(lone)], [...lone], 'un CR non suivi de LF doit rester');
  assert.notEqual(contentHash(lone), contentHash(B('ab\n')));
});

check('un fichier sans aucun saut de ligne est inchangé', () => {
  assert.equal(contentHash(B('x')), sha8(B('x')));
  assert.equal(contentHash(Buffer.alloc(0)), sha8(Buffer.alloc(0)));
});

check('les octets non-ASCII (UTF-8) survivent à la normalisation', () => {
  const s = '// accents : é à ü — œuf ₽ 🥚\r\nlet x;\r\n';
  assert.equal(contentHash(B(s)), sha8(B(s.replace(/\r\n/g, '\n'))));
});

console.log('\n── processFile : même HTML final quelle que soit la fin de ligne ──');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-bust-'));
const quiet = fn => { const l = console.log, w = console.warn; console.log = console.warn = () => {}; try { return fn(); } finally { console.log = l; console.warn = w; } };

function makeSite(name, eol) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'app.js'), 'const a = 1;\nconst b = 2;\n'.replace(/\n/g, eol));
  fs.writeFileSync(path.join(dir, 'style.css'), 'body {\n  margin: 0;\n}\n'.replace(/\n/g, eol));
  const html = path.join(dir, 'index.html');
  fs.writeFileSync(html, [
    '<link rel="stylesheet" href="./style.css">',                     // pas encore de ?v=
    '<script src="./app.js?v=deadbeef"></script>',                    // ?v= périmé
    '<script src="https://cdn.example.com/lib.js"></script>',         // distant : intouché
    '<script src="./manquant.js"></script>',                          // fichier absent : ignoré
  ].join('\n'));
  return html;
}

check('LF et CRLF produisent exactement le même HTML', () => {
  const a = makeSite('lf', '\n'), b = makeSite('crlf', '\r\n');
  quiet(() => { processFile(a); processFile(b); });
  assert.equal(fs.readFileSync(a, 'utf8'), fs.readFileSync(b, 'utf8'));
});

check('ajoute les ?v= manquants, corrige les périmés, ignore le reste', () => {
  const html = fs.readFileSync(path.join(tmp, 'lf', 'index.html'), 'utf8');
  assert.match(html, /href="\.\/style\.css\?v=[0-9a-f]{8}"/, 'ajout du ?v= manquant');
  assert.doesNotMatch(html, /deadbeef/, 'ancien hash remplacé');
  assert.match(html, /src="https:\/\/cdn\.example\.com\/lib\.js"/, 'URL distante inchangée');
  assert.match(html, /src="\.\/manquant\.js"/, 'fichier absent laissé tel quel');
});

check('idempotent : un second passage ne change plus rien', () => {
  const html = path.join(tmp, 'crlf', 'index.html');
  const before = fs.readFileSync(html, 'utf8');
  quiet(() => processFile(html));
  assert.equal(fs.readFileSync(html, 'utf8'), before);
});

fs.rmSync(tmp, { recursive: true, force: true });

console.log('\n── le dépôt lui-même ─────────────────────────────────────────────');

check('les hashs commités correspondent au contenu actuel des fichiers', () => {
  const stale = [];
  for (const htmlPath of HTML_FILES) {
    const html = fs.readFileSync(htmlPath, 'utf8');
    for (const m of html.matchAll(new RegExp(TAG_RE.source + '', 'g'))) {
      const rel = m[2];
      const abs = path.join(path.dirname(htmlPath), rel);
      if (!fs.existsSync(abs)) continue;
      const wanted = contentHash(fs.readFileSync(abs));
      const tag = html.slice(m.index, m.index + 400).match(/\?v=([0-9a-f]+)"/);
      const have = tag && tag[1];
      if (have !== wanted) stale.push(path.relative(process.cwd(), htmlPath) + ' → ' + rel + ' (a ' + have + ', devrait être ' + wanted + ')');
    }
  }
  assert.equal(stale.length, 0, stale.length + ' hash périmé(s) — lancer `node tools/cache-bust.js` :\n           ' + stale.slice(0, 5).join('\n           '));
});

console.log('');
if (failures.length) {
  console.error(failures.length + ' échec(s) :');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('OK — les hashs de cache ne dépendent que du contenu.');
