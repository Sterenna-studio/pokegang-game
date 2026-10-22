// Vivarium-only renderer. Original implementation; no PokéSurvivor engine code.
import { PMD_METADATA } from '../assets/pokemon_pmd/metadata.js';
import { PMD_BODY_HEIGHT } from '../assets/vivarium/sizes.js';
import { pokemonDisplayHeight, pokemonScale } from './pokemonSize.js';

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
    && /^(?:\d+\/(?:s\/)?|[a-z][a-z0-9_-]*\/)(?:Idle|Walk)\.png$/.test(a.file);
}

// Le build itch.io plafonne l'archive à 1 000 fichiers (HTML5) : les ~2 000 feuilles PMD n'y sont
// pas embarquées (cf. tools/build-itch.js). Sur itch, elles sont donc servies par le site web —
// un simple <img>/drawImage inter-origine (aucune lecture de pixels, donc pas de CORS), comme les
// sprites Showdown déjà chargés à distance. Ailleurs : les fichiers locaux.
export const PMD_REMOTE_BASE_URL = 'https://pokegang.sterenna.fr/assets/pokemon_pmd/';
export function isItchHost(hostname = globalThis.location?.hostname || '') {
  return hostname.endsWith('.itch.io') || hostname.includes('itch.zone') || hostname.endsWith('.hwcdn.st');
}
export function pmdAssetBaseUrl(hostname) {
  return isItchHost(hostname) ? new URL(PMD_REMOTE_BASE_URL) : new URL('../assets/pokemon_pmd/', import.meta.url);
}

// Une feuille en échec est retentée au bout de ce délai (coupure réseau passagère) plutôt que
// de rester 2D jusqu'au prochain rendu complet — notamment sur l'overlay OBS qui ne re-rend pas.
const SHEET_RETRY_MS = 15000;

// One scheduler and bounded decoded-sheet cache shared by all residents/cameos.
// Factory dependencies also allow deterministic tests without network or game state.
export function createPmdRenderer({ metadata = PMD_METADATA, doc = document,
  makeImage = () => new Image(),
  raf = fn => requestAnimationFrame(fn), caf = id => cancelAnimationFrame(id),
  motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),
  baseUrl = pmdAssetBaseUrl(), maxSheets = 64, now = () => Date.now(),
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
  function sheetFor(file, actor, assetBaseUrl) {
    const key = new URL(file, assetBaseUrl).href;
    let sheet = cache.get(key);
    if (sheet?.failed && now() - sheet.failedAt >= SHEET_RETRY_MS) {
      release(sheet); cache.delete(key); sheet = null;
    }
    if (!sheet) {
      const img = makeImage();
      sheet = { img, users: new Set(), ready: false, failed: false };
      sheet.promise = new Promise(resolve => {
        img.onload = () => { sheet.ready = true; img.onload = img.onerror = null; resolve(sheet); };
        img.onerror = () => { sheet.failed = true; sheet.failedAt = now(); img.onload = img.onerror = null; resolve(sheet); };
      });
      cache.set(key, sheet);
      img.src = key;
    }
    // Touch LRU order; active users are never evicted.
    cache.delete(key); cache.set(key, sheet);
    sheet.users.add(actor); actor.sheets.add(sheet);
    trim();
    return sheet;
  }
  function cancel() {
    if (request !== null) caf(request);
    request = null; lastTime = null;
  }
  function schedule() {
    // Character Idle is a fixed pose. With 2D Pokémon selected, a paused
    // character must not keep an otherwise unnecessary RAF alive.
    let animated = false;
    for (const actor of actors) { if (!actor.meta?.static) { animated = true; break; } }
    if (!animated) { cancel(); return; }
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

  function attach(host, { dex, shiny = false, trueSize = false } = {}) {
    // Never silently turn a shiny into its normal variant.
    const variant = metadata[dex]?.[shiny ? 'shiny' : 'normal'];
    return attachAnimation(host, variant, { displayHeight: pokemonDisplayHeight(dex, trueSize),
      bodyHeight: PMD_BODY_HEIGHT[`${dex}/${shiny ? 'shiny' : 'normal'}`] });
  }

  // Trusted local character metadata shares this scheduler/cache with Pokémon.
  function attachAnimation(host, variant, { assetBaseUrl = baseUrl, displayHeight, bodyHeight } = {}) {
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
    const scale = pokemonScale(displayHeight, bodyHeight, largest, Math.min(2, 88 / largest));
    const animations = Object.values(variant);
    const width = Math.max(...animations.map(a => a.w * scale));
    const height = Math.max(...animations.map(a => a.h * scale));
    const footprint = { rx: Math.max(12, Math.min(26, width / 4)),
      ry: Math.max(6, Math.min(12, height / 10)) };
    const left = Math.min(...animations.map(a => 24 - a.ax * scale));
    const top = Math.min(...animations.map(a => 40 - a.ay * scale));
    const visualBounds = { x: left, y: top,
      w: Math.max(...animations.map(a => 24 + (a.w - a.ax) * scale)) - left,
      h: Math.max(...animations.map(a => 40 + (a.h - a.ay) * scale)) - top };
    const insets = {
      left: Math.max(0, ...animations.map(a => a.ax * scale - 24)),
      right: Math.max(0, ...animations.map(a => 24 + (a.w - a.ax) * scale - 48)),
      bottom: Math.max(0, ...animations.map(a => 40 + (a.h - a.ay) * scale - 48)),
    };
    const actor = { host, insets, footprint, visualBounds, sheets: new Set(), elapsed: 0, direction: 0, animation: '',
      sheet: null, meta: null, disposed: false, drawn: '',
      draw() {
        const a = actor.meta, sheet = actor.sheet;
        if (actor.disposed || !a || !sheet?.ready || sheet.failed) return;
        if (sheet.img.naturalWidth !== a.w * a.n || sheet.img.naturalHeight !== a.h * a.r) {
          actor.useFallback(); return;
        }
        const frame = motion?.matches || a.static ? 0 : frameAt(a.d, actor.elapsed);
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
          const sheet = sheetFor(actor.meta.file, actor, assetBaseUrl);
          actor.sheet = sheet;
          actor.useFallback();
          sheet.promise.then(() => {
            if (actor.disposed || actor.sheet !== sheet) return;
            actor.draw();
          });
        }
        actor.draw();
        schedule();
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
  return { attach, attachAnimation, dispose() {
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
export function attachVivariumAnimation(host, animations, assetBaseUrl, sizing = {}) {
  shared ||= createPmdRenderer();
  return shared.attachAnimation(host, animations, { assetBaseUrl, ...sizing });
}
export function stopPmdSprites() {
  shared?.dispose(); shared = null;
}
