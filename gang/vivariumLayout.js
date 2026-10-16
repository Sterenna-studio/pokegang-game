// Cosmetic ground-plane placement. No game state, physics engine or pathfinder.
export const GROUND_ANCHOR = Object.freeze({ x: 24, y: 40 });
export const DEFAULT_FOOTPRINT = Object.freeze({ rx: 18, ry: 9 });
export const LAYOUT_STEP_MS = 125; // 8 Hz, only while moving or inspecting.

export function groundClearance(a, b, padding = 6) {
  return Math.hypot((a.x - b.x) / (a.rx + b.rx + padding),
    (a.y - b.y) / (a.ry + b.ry + padding));
}

// Bounded random choices, checked against real positions AND reserved targets.
// Return the least crowded candidate if a small viewport is already saturated.
export function pickGroundTarget(range, footprint, occupied, {
  random = Math.random, seek = true, attempts = 12,
} = {}) {
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  let best = { x: range.minX, y: range.minY }, bestScore = -Infinity;
  function score(point) {
    const foot = { x: point.x + 24, y: point.y + 40, ...footprint };
    let clearance = Infinity;
    for (const other of occupied) clearance = Math.min(clearance, groundClearance(foot, other));
    if (clearance > bestScore) { best = point; bestScore = clearance; }
    return clearance >= 1;
  }
  const peers = occupied.filter(p => !p.reserved);
  if (seek && peers.length && random() < 0.35) {
    const peer = peers[Math.floor(random() * peers.length)];
    const angle = random() * Math.PI * 2;
    const point = {
      x: clamp(peer.x - 24 + Math.cos(angle) * (footprint.rx + peer.rx + 12), range.minX, range.maxX),
      y: clamp(peer.y - 40 + Math.sin(angle) * (footprint.ry + peer.ry + 12), range.minY, range.maxY),
    };
    if (score(point)) return point;
  }
  for (let i = 0; i < attempts; i++) {
    const point = { x: range.minX + random() * (range.maxX - range.minX),
      y: range.minY + random() * (range.maxY - range.minY) };
    if (score(point)) return point;
  }
  return best;
}

// Footprints fit in adjacent 64px cells; only nearby pairs are tested in motion.
export function groundIndex(points, cellSize = 64) {
  const cells = new Map();
  for (const point of points) {
    const key = `${Math.floor(point.x / cellSize)},${Math.floor(point.y / cellSize)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(point);
  }
  return { neighbors(point) {
    const nearby = [], cx = Math.floor(point.x / cellSize), cy = Math.floor(point.y / cellSize);
    for (let x = cx - 1; x <= cx + 1; x++) {
      for (let y = cy - 1; y <= cy + 1; y++) nearby.push(...(cells.get(`${x},${y}`) || []));
    }
    return nearby;
  } };
}

export function readSpritePosition(el) {
  const transform = getComputedStyle(el).transform;
  const values = transform?.match(/^matrix(3d)?\(([^)]+)\)$/);
  if (!values) return { x: 0, y: 0 };
  const n = values[2].split(',').map(Number);
  return { x: n[values[1] ? 12 : 4] || 0, y: n[values[1] ? 13 : 5] || 0 };
}

export function createVivariumLayout(viewport, { onBlocked = () => {}, doc = document,
  readPosition = readSpritePosition, later = fn => setTimeout(fn, LAYOUT_STEP_MS),
  cancel = id => clearTimeout(id),
} = {}) {
  const actors = new Map();
  const elements = new Map();
  const actorLayer = doc.createElement('div'), overlayLayer = doc.createElement('div');
  actorLayer.className = 'gang-env-actors';
  overlayLayer.className = 'gang-env-overlays';
  viewport.appendChild(actorLayer); viewport.appendChild(overlayLayer);
  let serial = 0, timer = null, inspector = null, disposed = false;
  let ticks = 0, checks = 0, yields = 0;

  function measure(state) {
    state.previous = state.position;
    state.position = readPosition(state.entry.el);
    state.footprint = state.entry.animator?.footprint || DEFAULT_FOOTPRINT;
    state.x = state.position.x + 24; state.y = state.position.y + 40;
    state.rx = state.footprint.rx; state.ry = state.footprint.ry;
  }
  function annotations(state) {
    for (const wrapper of state.overlays) {
      wrapper.style.transition = state.entry.el.style.transition;
      wrapper.style.transform = state.entry.el.style.transform;
    }
  }
  function depth() {
    const ordered = [...actors.values()].sort((a, b) => a.y - b.y || a.order - b.order);
    ordered.forEach((state, index) => {
      const z = index + 1;
      if (state.z !== z) { state.z = z; state.entry.el.style.zIndex = z; }
    });
  }
  function wanted() {
    if (disposed || doc.hidden || !viewport.isConnected) return false;
    if (inspector) return true;
    for (const state of actors.values()) if (state.moving) return true;
    return false;
  }
  function schedule() {
    if (!wanted()) { if (timer !== null) cancel(timer); timer = null; return; }
    if (timer === null) timer = later(tick);
  }
  function tick() {
    timer = null;
    if (!wanted()) return;
    ticks++;
    const points = [];
    for (const state of actors.values()) {
      if (state.moving) measure(state);
      else state.previous = state.position;
      points.push(state);
    }
    const index = groundIndex(points);
    for (const state of points) {
      if (!state.moving || !state.yieldable || state.entry.interacting) continue;
      for (const other of index.neighbors(state)) {
        if (other === state) continue;
        // When both can yield, one deterministic actor gives way first.
        if (other.moving && other.yieldable && other.order > state.order) continue;
        checks++;
        if (groundClearance(state, other) >= 1) continue;
        const before = { ...state, x: state.previous.x + 24, y: state.previous.y + 40 };
        const otherBefore = { ...other, x: other.previous.x + 24, y: other.previous.y + 40 };
        // Allow an actor already in a crowded spot to walk OUT of it.
        if (groundClearance(state, other) >= groundClearance(before, otherBefore) - 0.001) continue;
        state.moving = false; yields++;
        onBlocked(state.entry, state.position);
        break;
      }
    }
    depth();
    inspector?.();
    schedule();
  }
  function visibility() {
    for (const state of actors.values()) { measure(state); annotations(state); }
    depth(); schedule();
  }
  doc.addEventListener('visibilitychange', visibility);

  return {
    actorLayer, overlayLayer,
    register(entry, { yieldable = false } = {}) {
      const state = { entry, order: ++serial, moving: entry.animation === 'Walk', yieldable,
        position: { x: entry.x || 0, y: entry.y || 0 }, overlays: new Set() };
      actors.set(entry, state); elements.set(entry.el, state); measure(state); depth(); schedule();
    },
    unregister(entry) {
      const state = actors.get(entry);
      if (!state) return;
      for (const wrapper of state.overlays) wrapper.remove();
      actors.delete(entry); elements.delete(entry.el); depth(); schedule();
    },
    refresh(entry) {
      const state = actors.get(entry);
      if (state) { measure(state); annotations(state); depth(); }
    },
    moving(entry, value) {
      const state = actors.get(entry);
      if (!state) return;
      measure(state); state.moving = value;
      annotations(state); depth(); schedule();
    },
    sync(el) { const state = elements.get(el); if (state) annotations(state); },
    occupied(except) {
      const result = [];
      for (const state of actors.values()) {
        if (state.entry === except) continue;
        result.push({ x: state.x, y: state.y, rx: state.rx, ry: state.ry });
        if (state.moving && Number.isFinite(state.entry.x) && Number.isFinite(state.entry.y)) {
          result.push({ x: state.entry.x + 24, y: state.entry.y + 40,
            rx: state.rx, ry: state.ry, reserved: true });
        }
      }
      return result;
    },
    annotate(entry, content) {
      const state = actors.get(entry);
      if (!state) return () => {};
      const wrapper = doc.createElement('div');
      wrapper.className = 'gang-env-annotation';
      wrapper.style.width = `${entry.w || 48}px`; wrapper.style.height = `${entry.h || 48}px`;
      wrapper.appendChild(content); overlayLayer.appendChild(wrapper);
      state.overlays.add(wrapper); annotations(state);
      return () => { state.overlays.delete(wrapper); wrapper.remove(); };
    },
    inspect(callback) { inspector = callback; inspector?.(); schedule(); },
    view: () => [...actors.values()],
    stats: () => ({ actors: actors.size, moving: [...actors.values()].filter(s => s.moving).length,
      ticks, checks, yields, scheduled: timer !== null }),
    dispose() {
      disposed = true;
      if (timer !== null) cancel(timer);
      timer = null; inspector = null;
      doc.removeEventListener('visibilitychange', visibility);
      actors.clear(); elements.clear(); actorLayer.remove(); overlayLayer.remove();
    },
  };
}
