// Détecte les appels qui ne peuvent JAMAIS rien faire, masqués par l'optional chaining.
//
//   node tools/check-dead-calls.mjs          (depuis la racine du dépôt)
//   node tools/check-dead-calls.mjs <racine> (pour pointer un autre arbre)
//
// Pourquoi : `globalThis.renderTopBar?.()` ne lève rien quand `renderTopBar` n'existe
// pas, il ne fait simplement jamais rien. C'est ce qui a laissé la barre du haut non
// rafraîchie après un achat, et les noms de zone en id brut dans deux quêtes. Deux
// familles de ce bug sont vérifiées :
//
//   A. globalThis.X(...) / globalThis.X?.(...) où X n'est exposé nulle part.
//   B. contexte injecté : un module lit `_ctx.x?.()` / callContext('x') alors que
//      app.js ne lui injecte jamais `x` (et que `x` n'existe pas non plus en repli
//      sur globalThis).
//
// Règle sur les scripts classiques (data/*.js) : leurs `function` et `var` de premier
// niveau sont des propriétés de globalThis ; leurs `const`/`let` NE LE SONT PAS (voir
// CLAUDE.md). Un `globalThis.CONST_FN()` est donc un bug même si la const existe.
//
// Sortie non nulle s'il reste des cas. Les faux positifs connus sont dans ALLOW,
// chacun avec la raison pour laquelle il est légitime.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || '.');
const SKIP = new Set(['dist-itch', 'node_modules', '.git', 'archive', 'tools', 'test', 'supabase', 'studio']);

// Faux positifs connus : "famille:nom" → raison.
const ALLOW = {
  'A:fn':                  "occurrence dans un commentaire de modules/core/eventBus.js",
  'A:gtag':                "défini par le snippet Google Analytics d'index.html, pas par le code applicatif",
  'B:random':              "point d'injection de test voulu : `_ctx.random?.() ?? Math.random()`",
};

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.js$/.test(e.name)) files.push(p);
  }
})(ROOT);
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
const src = new Map(files.map(f => [rel(f), fs.readFileSync(f, 'utf8')]));
const all = [...src.values()].join('\n');
const lineOf = (s, i) => s.slice(0, i).split('\n').length;

// ── Ce qui est réellement exposé sur globalThis ──────────────────────────────
const onGlobal = new Set();
for (const m of all.matchAll(/globalThis\.([A-Za-z_$][\w$]*)\s*=[^=]/g)) onGlobal.add(m[1]);
for (const m of all.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=[^=]/g)) onGlobal.add(m[1]);
for (const m of all.matchAll(/Object\.assign\(\s*globalThis\s*,\s*\{([\s\S]*?)\}\s*\)/g))
  for (const k of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*(?::|,|$)/gm)) onGlobal.add(k[1]);
for (const [f, s] of src) {
  if (!f.startsWith('data/') && f !== 'config.js') continue;
  // classic scripts : function/var seulement (const/let restent dans la portée lexicale globale)
  for (const m of s.matchAll(/^(?:function|var)\s+([A-Za-z_$][\w$]*)/gm)) onGlobal.add(m[1]);
}
const BUILTINS = new Set(['structuredClone', 'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'alert', 'confirm', 'prompt', 'open', 'addEventListener',
  'removeEventListener', 'dispatchEvent', 'matchMedia', 'getComputedStyle', 'queueMicrotask', 'btoa', 'atob',
  'requestIdleCallback', 'scrollTo', 'print', 'close']);

const findings = [];
const add = (family, name, where, detail) => {
  if (ALLOW[family + ':' + name]) return;
  findings.push({ family, name, where, detail });
};

// ── A. globalThis.X(...) vers un nom jamais exposé ───────────────────────────
for (const [f, s] of src) {
  for (const m of s.matchAll(/globalThis\??\.([A-Za-z_$][\w$]*)\s*\??\.?\s*\(/g)) {
    const name = m[1];
    if (onGlobal.has(name) || BUILTINS.has(name)) continue;
    // on ignore les occurrences dans un commentaire de ligne
    const ls = s.lastIndexOf('\n', m.index) + 1;
    if (/^\s*(\/\/|\*)/.test(s.slice(ls, m.index + 1))) continue;
    add('A', name, f + ':' + lineOf(s, m.index), 'globalThis.' + name + '() n\'est exposé nulle part');
  }
}

// ── B. contexte injecté ───────────────────────────────────────────────────────
function matchBrace(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (c === '/' && n === '/') { i = s.indexOf('\n', i); if (i < 0) return -1; continue; }
    if (c === '/' && n === '*') { i = s.indexOf('*/', i) + 1; continue; }
    if (c === "'" || c === '"') { for (i++; i < s.length && s[i] !== c; i++) if (s[i] === '\\') i++; continue; }
    if (c === '`') {
      for (i++; i < s.length && s[i] !== '`'; i++) {
        if (s[i] === '\\') { i++; continue; }
        if (s[i] === '$' && s[i + 1] === '{') { i = matchBrace(s, i + 1); if (i < 0) return -1; }
      }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}
function topLevelKeys(body) {
  const keys = new Set(); let spread = false, depth = 0, atStart = true;
  for (let i = 0; i < body.length; i++) {
    const c = body[i], n = body[i + 1];
    if (c === '/' && n === '/') { i = body.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && n === '*') { i = body.indexOf('*/', i) + 1; continue; }
    if (depth === 0 && atStart) {
      const m = body.slice(i).match(/^\s*(\.\.\.|(?:async\s+)?['"]?([A-Za-z_$][\w$]*)['"]?)/);
      if (m) { if (m[1] === '...') spread = true; else keys.add(m[2]); atStart = false; i += m[0].length - 1; continue; }
    }
    if (c === "'" || c === '"') { for (i++; i < body.length && body[i] !== c; i++) if (body[i] === '\\') i++; continue; }
    if (c === '`') {
      for (i++; i < body.length && body[i] !== '`'; i++) {
        if (body[i] === '\\') { i++; continue; }
        if (body[i] === '$' && body[i + 1] === '{') { i = matchBrace(body, i + 1); if (i < 0) break; }
      }
      continue;
    }
    if ('{[('.includes(c)) depth++;
    else if ('}])'.includes(c)) depth--;
    else if (c === ',' && depth === 0) atStart = true;
  }
  return { keys, spread };
}

const injected = new Map();   // configureX -> { keys, spread }
for (const [, s] of src) {
  for (const m of s.matchAll(/\b(configure[A-Z]\w*)\s*\(\s*\{/g)) {
    const open = m.index + m[0].length - 1, close = matchBrace(s, open);
    if (close < 0) continue;
    const { keys, spread } = topLevelKeys(s.slice(open + 1, close));
    const e = injected.get(m[1]) || { keys: new Set(), spread: false };
    keys.forEach(k => e.keys.add(k)); e.spread ||= spread;
    injected.set(m[1], e);
  }
}

for (const [f, s] of src) {
  const cfg = s.match(/function\s+(configure[A-Z]\w*)\s*\(/);
  if (!cfg) continue;
  const inj = injected.get(cfg[1]);
  if (!inj || inj.spread) continue;   // injecté via variable ou spread : non analysable statiquement
  const v = (s.match(/\b(\w+)\s*=\s*\{\s*\.\.\.\1\s*,\s*\.\.\.ctx/) || s.match(/\b(\w+)\s*=\s*ctx\b/) || [])[1];
  const reads = new Map();
  const note = (name, silent, idx) => { if (!reads.has(name) || silent) reads.set(name, { silent, line: lineOf(s, idx) }); };
  if (v) {
    for (const m of s.matchAll(new RegExp('\\b' + v + '\\??\\.([A-Za-z_$][\\w$]*)(\\s*\\?\\.\\()?', 'g'))) note(m[1], !!m[2], m.index);
    for (const m of s.matchAll(new RegExp('const\\s*\\{([^}]*)\\}\\s*=\\s*' + v + '\\b', 'g')))
      for (const k of m[1].split(',')) { const n = k.trim().split(/[:=\s]/)[0]; if (n) note(n, false, m.index); }
  }
  // wrappers *Ctx* / *Context* appelés avec un nom littéral : callCtx('x'), callContext('x'), requireContext('x')…
  for (const m of s.matchAll(/\b(\w*(?:[Cc]tx|[Cc]ontext)\w*)\(\s*['"]([\w$]+)['"]/g)) {
    if (/^configure/.test(m[1])) continue;
    note(m[2], !/^require/i.test(m[1]), m.index);
  }
  for (const [name, d] of reads) {
    if (inj.keys.has(name) || onGlobal.has(name)) continue;
    add('B', name, f + ':' + d.line, cfg[1] + ' ne reçoit jamais « ' + name + ' »' + (d.silent ? ' (lecture silencieuse : no-op)' : ' (lève au premier appel)'));
  }
}

// ── Sortie ─────────────────────────────────────────────────────────────────────
const nA = findings.filter(x => x.family === 'A').length, nB = findings.length - nA;
if (!findings.length) {
  console.log('OK — aucun appel mort (' + files.length + ' fichiers, ' + injected.size + ' contextes injectés vérifiés, '
    + Object.keys(ALLOW).length + ' faux positifs connus ignorés).');
  process.exit(0);
}
console.error(findings.length + ' appel(s) mort(s) : ' + nA + ' globalThis, ' + nB + ' contexte\n');
for (const x of findings) console.error('  [' + x.family + '] ' + x.where + '\n        ' + x.detail);
console.error('\nUn faux positif légitime se déclare dans ALLOW, avec sa raison.');
process.exit(1);
