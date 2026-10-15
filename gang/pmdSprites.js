// Vivarium-only renderer. Original implementation; no PokéSurvivor engine code.
import { PMD_METADATA } from '../assets/pokemon_pmd/metadata.js';

export function directionFromVector(dx, dy, previous = 0) {
  if (!dx && !dy) return previous;
  return (Math.round(Math.atan2(dx, dy) / (Math.PI / 4)) + 8) % 8;
}

export function frameAt(durations, elapsedMs) {
  const total = durations.reduce((sum, d) => sum + d, 0);
  let tick = (elapsedMs * 60 / 1000) % total;
  for (let i = 0; i < durations.length; i++) {
    if (tick < durations[i]) return i;
    tick -= durations[i];
  }
  return 0;
}

function validAnimation(a) {
  return a && ['w', 'h', 'n', 'r'].every(k => Number.isInteger(a[k]) && a[k] > 0)
    && a.r <= 8 && a.d?.length === a.n && a.d.every(d => Number.isFinite(d) && d > 0)
    && Number.isFinite(a.ax) && Number.isFinite(a.ay)
    && /^\d+\/(?:s\/)?(?:Idle|Walk)\.png$/.test(a.file);
}

// One scheduler and bounded decoded-sheet cache shared by all residents/cameos.
// Factory dependencies also allow deterministic tests without network or game state.
export function createPmdRenderer({ metadata = PMD_METADATA, doc = document,
  makeImage = () => new Image(),
  raf = fn => requestAnimationFrame(fn), caf = id => cancelAnimationFrame(id),
  motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),
  baseUrl = new URL('../assets/pokemon_pmd/', import.meta.url), maxSheets = 64,
} = {}) {
  const actors = new Set(), cache = new Map();
  let request = null, lastTime = null, listening = false;

  function release(sheet) {
    sheet.img.onload = sheet.img.onerror = null;
    sheet.img.removeAttribute?.('src');
  }
  function trim() {
    for (const [key, sheet] of cache) {
      if (cache.size <= maxSheets) break;
      if (!sheet.users.size) { release(sheet); cache.delete(key); }
    }
  }
  function sheetFor(file, actor) {
    let sheet = cache.get(file);
    if (!sheet) {
      const img = makeImage();
      sheet = { img, users: new Set(), ready: false, failed: false };
      sheet.promise = new Promise(resolve => {
        img.onload = () => { sheet.ready = true; img.onload = img.onerror = null; resolve(sheet); };
        img.onerror = () => { sheet.failed = true; img.onload = img.onerror = null; resolve(sheet); };
      });
      cache.set(file, sheet);
      img.src = new URL(file, baseUrl).href;
    }
    // Touch LRU order; active users are never evicted.
    cache.delete(file); cache.set(file, sheet);
    sheet.users.add(actor); actor.sheets.add(sheet);
    trim();
    return sheet;
  }
  function cancel() {
    if (request !== null) caf(request);
    request = null; lastTime = null;
  }
  function schedule() {
    if (request === null && actors.size && !doc.hidden && !motion?.matches) request = raf(tick);
  }
  function tick(time) {
    request = null;
    const delta = lastTime === null ? 0 : Math.min(100, Math.max(0, time - lastTime));
    lastTime = time;
    for (const actor of actors) {
      if (!actor.host.isConnected) { actor.destroy(); continue; }
      actor.elapsed += delta;
      actor.draw();
    }
    schedule();
  }
  function visibility() {
    cancel();
    for (const actor of actors) actor.draw();
    schedule();
  }
  function listen() {
    if (listening) return;
    listening = true;
    doc.addEventListener('visibilitychange', visibility);
    motion?.addEventListener('change', visibility);
  }
  function unlisten() {
    if (!listening || actors.size) return;
    listening = false;
    cancel();
    doc.removeEventListener('visibilitychange', visibility);
    motion?.removeEventListener('change', visibility);
  }

  function attach(host, { dex, shiny = false } = {}) {
    // Never silently turn a shiny into its normal variant.
    const variant = metadata[dex]?.[shiny ? 'shiny' : 'normal'];
    if (!validAnimation(variant?.Idle) || !validAnimation(variant?.Walk)) return null;
    const fallback = host.querySelector('img');
    const canvas = doc.createElement('canvas');
    canvas.className = 'gang-env-pmd-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.hidden = true;
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); return null; }
    // A species keeps the same scale across both animations; no square stretching.
    const largest = Math.max(...Object.values(variant).flatMap(a => [a.w, a.h]));
    const scale = Math.min(2, 88 / largest);
    const animations = Object.values(variant);
    const insets = {
      left: Math.max(0, ...animations.map(a => a.ax * scale - 24)),
      right: Math.max(0, ...animations.map(a => 24 + (a.w - a.ax) * scale - 48)),
      bottom: Math.max(0, ...animations.map(a => 40 + (a.h - a.ay) * scale - 48)),
    };
    const actor = { host, insets, sheets: new Set(), elapsed: 0, direction: 0, animation: '',
      sheet: null, meta: null, disposed: false, drawn: '',
      draw() {
        const a = actor.meta, sheet = actor.sheet;
        if (actor.disposed || !a || !sheet?.ready || sheet.failed) return;
        if (sheet.img.naturalWidth !== a.w * a.n || sheet.img.naturalHeight !== a.h * a.r) {
          actor.useFallback(); return;
        }
        const frame = motion?.matches ? 0 : frameAt(a.d, actor.elapsed);
        const row = a.r === 1 ? 0 : Math.round(actor.direction * a.r / 8) % a.r;
        const key = `${actor.animation}/${row}/${frame}`;
        if (key === actor.drawn) return;
        actor.drawn = key;
        if (canvas.width !== a.w) canvas.width = a.w;
        if (canvas.height !== a.h) canvas.height = a.h;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, a.w, a.h);
        ctx.drawImage(sheet.img, frame * a.w, row * a.h, a.w, a.h, 0, 0, a.w, a.h);
        Object.assign(canvas.style, { width: `${a.w * scale}px`, height: `${a.h * scale}px`,
          left: `${24 - a.ax * scale}px`, top: `${40 - a.ay * scale}px` });
        canvas.hidden = false;
        if (fallback) fallback.hidden = true;
        host.classList.add('gang-env-pmd');
      },
      useFallback() {
        canvas.hidden = true;
        if (fallback) fallback.hidden = false;
        host.classList.remove('gang-env-pmd');
      },
      set(animation = 'Idle', direction = actor.direction) {
        if (actor.disposed) return;
        actor.direction = ((direction % 8) + 8) % 8;
        if (actor.animation !== animation) {
          actor.animation = animation === 'Walk' ? 'Walk' : 'Idle';
          actor.meta = variant[actor.animation];
          actor.elapsed = 0; actor.drawn = '';
          const sheet = sheetFor(actor.meta.file, actor);
          actor.sheet = sheet;
          actor.useFallback();
          sheet.promise.then(() => {
            if (actor.disposed || actor.sheet !== sheet) return;
            actor.draw();
          });
        }
        actor.draw();
      },
      destroy() {
        if (actor.disposed) return;
        actor.disposed = true;
        actors.delete(actor);
        for (const sheet of actor.sheets) sheet.users.delete(actor);
        actor.sheets.clear(); actor.sheet = null;
        actor.useFallback(); canvas.remove();
        trim(); unlisten();
      },
    };
    actors.add(actor); listen(); actor.set('Idle'); schedule();
    return actor;
  }
  return { attach, dispose() {
    for (const actor of [...actors]) actor.destroy();
    for (const sheet of cache.values()) release(sheet);
    cache.clear(); cancel();
  }, stats: () => ({ actors: actors.size, sheets: cache.size, scheduled: request !== null }) };
}

let shared;
export function attachPmdSprite(host, pokemon) {
  shared ||= createPmdRenderer();
  return shared.attach(host, pokemon);
}
export function stopPmdSprites() {
  shared?.dispose(); shared = null;
}
