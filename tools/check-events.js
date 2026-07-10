#!/usr/bin/env node
// Analyse statique : chaque EVENTS.X émis (EventBus.emit) doit avoir au moins
// un abonné (EventBus.on/once), et chaque EVENTS.X écouté doit être émis
// quelque part. Ce genre d'écart (event mort, ou event émis dans le vide)
// est un bug silencieux — rien ne plante, une feature ne se déclenche juste
// jamais. Usage : node tools/check-events.js (exit 1 si un écart est trouvé).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'test', 'assets', 'docs', 'info', 'supabase']);

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

function extractEvents(eventBusSrc) {
  const block = eventBusSrc.match(/export const EVENTS = \{([\s\S]*?)\n\};/);
  if (!block) throw new Error('EVENTS block not found in eventBus.js');
  const events = {};
  const re = /^\s*([A-Z0-9_]+):\s*'([^']+)'/gm;
  let m;
  while ((m = re.exec(block[1]))) events[m[1]] = m[2];
  return events;
}

function main() {
  const eventBusPath = path.join(ROOT, 'modules', 'core', 'eventBus.js');
  const events = extractEvents(fs.readFileSync(eventBusPath, 'utf8'));
  const eventKeys = Object.keys(events);

  const files = walk(ROOT, []);
  const emitted = new Map();  // key -> [ "file:line", ... ]
  const listened = new Map(); // key -> [ "file:line", ... ]

  const emitRe = /EventBus\.emit\(\s*EVENTS\.([A-Z0-9_]+)/g;
  const onRe   = /EventBus\.(?:on|once)\(\s*EVENTS\.([A-Z0-9_]+)/g;

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const lineAt = (idx) => src.slice(0, idx).split('\n').length;

    for (const re of [emitRe]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src))) {
        const key = m[1];
        if (!emitted.has(key)) emitted.set(key, []);
        emitted.get(key).push(`${rel}:${lineAt(m.index)}`);
      }
    }
    for (const re of [onRe]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src))) {
        const key = m[1];
        if (!listened.has(key)) listened.set(key, []);
        listened.get(key).push(`${rel}:${lineAt(m.index)}`);
      }
    }
  }

  const unknownEmitted = [...emitted.keys()].filter(k => !eventKeys.includes(k));
  const unknownListened = [...listened.keys()].filter(k => !eventKeys.includes(k));
  const neverListened = eventKeys.filter(k => emitted.has(k) && !listened.has(k));
  const neverEmitted = eventKeys.filter(k => listened.has(k) && !emitted.has(k));
  const declaredButUnused = eventKeys.filter(k => !emitted.has(k) && !listened.has(k));

  let hasIssue = false;

  function report(title, keys, sourceMap) {
    if (keys.length === 0) return;
    hasIssue = true;
    console.log(`\n${title}`);
    for (const k of keys) {
      const sites = sourceMap ? sourceMap.get(k) : null;
      console.log(`  - EVENTS.${k} (${events[k] ?? '?'})${sites ? `\n      ${sites.join('\n      ')}` : ''}`);
    }
  }

  report('EVENTS émis mais jamais écoutés (.emit sans .on) :', neverListened, emitted);
  report('EVENTS écoutés mais jamais émis (.on sans .emit) :', neverEmitted, listened);
  report('EVENTS déclarés dans EVENTS mais totalement inutilisés :', declaredButUnused, null);
  report('Clés EVENTS.X inconnues utilisées dans un .emit() :', unknownEmitted, emitted);
  report('Clés EVENTS.X inconnues utilisées dans un .on()/.once() :', unknownListened, listened);

  if (!hasIssue) {
    console.log('OK — tous les EVENTS.X émis ont un abonné, et vice-versa.');
  }

  process.exit(hasIssue ? 1 : 0);
}

main();
