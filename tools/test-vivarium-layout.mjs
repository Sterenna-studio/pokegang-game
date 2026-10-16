import assert from 'node:assert/strict';
import { groundClearance, groundIndex, pickGroundTarget, createVivariumLayout,
  DEFAULT_FOOTPRINT, LAYOUT_STEP_MS } from '../gang/vivariumLayout.js';

const fp = DEFAULT_FOOTPRINT;
assert.equal(LAYOUT_STEP_MS, 125);
assert.equal(groundClearance({ x: 0, y: 0, ...fp }, { x: 42, y: 0, ...fp }), 1);
assert.equal(groundClearance({ x: 0, y: 0, ...fp }, { x: 0, y: 24, ...fp }), 1);
assert.ok(groundClearance({ x: 0, y: 0, ...fp }, { x: 0, y: 22, ...fp }) < 1);
// Dense deterministic placement: no global RNG overrides, use a seeded stream.
let seed = 173;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const range = { minX: 0, maxX: 550, minY: 0, maxY: 175 };
const occupied = [];
for (let i = 0; i < 24; i++) {
  const p = pickGroundTarget(range, fp, occupied, { random, seek: false });
  const foot = { x: p.x + 24, y: p.y + 40, ...fp };
  assert.ok(occupied.every(other => groundClearance(foot, other) >= 1), `Spawn ${i} has clear feet`);
  occupied.push(foot);
}
// A neighbor-seeking candidate cannot bypass occupancy checks at viewport edges.
const edge = { minX: 0, maxX: 100, minY: 0, maxY: 70 };
const obstacle = { x: 24, y: 40, ...fp };
let calls = 0;
const target = pickGroundTarget(edge, fp, [obstacle], { random: () => (++calls <= 3 ? 0 : 0.99) });
assert.ok(groundClearance({ x: target.x + 24, y: target.y + 40, ...fp }, obstacle) >= 1);
assert.ok(Number.isFinite(pickGroundTarget({ minX: 0, maxX: 0, minY: 0, maxY: 0 }, fp, [obstacle]).x), 'Saturated scenes still return a bounded candidate');
const reserved = pickGroundTarget(edge, fp, [{ x: 123, y: 109, ...fp, reserved: true }], { random: () => 0.99, attempts: 1 });
assert.ok(reserved.x <= edge.maxX && reserved.y <= edge.maxY);
const points = Array.from({ length: 1000 }, (_, i) => ({ x: i * 100, y: 0 }));
assert.ok(groundIndex(points).neighbors(points[500]).length <= 3, 'Far actors do not produce all-pairs motion checks');
assert.equal(groundIndex([{ x: -1, y: -1 }, { x: 1, y: 1 }]).neighbors({ x: 0, y: 0 }).length, 2);

const jobs = new Map(), events = new Map(); let serial = 0;
const node = () => ({ style: {}, isConnected: true, children: [],
  appendChild(child) { this.children.push(child); }, remove() { this.removed = true; } });
const doc = { hidden: false, createElement: node, addEventListener: (e, fn) => events.set(e, fn), removeEventListener: e => events.delete(e) };
const viewport = node(), blocked = [];
const layout = createVivariumLayout(viewport, { doc, readPosition: el => ({ ...el.position }),
  onBlocked: (entry, position) => { blocked.push(entry); entry.el.position = position; },
  later: fn => { jobs.set(++serial, fn); return serial; }, cancel: id => jobs.delete(id) });
const makeEntry = (x, y) => ({ el: { ...node(), position: { x, y } }, x, y, w: 48, h: 48 });
const a = makeEntry(100, 100), b = makeEntry(145, 130);
layout.register(a, { yieldable: true }); layout.register(b, { yieldable: true });
assert.equal(jobs.size, 0, 'Idle scene creates no tracking timer');
assert.ok(a.el.style.zIndex < b.el.style.zIndex);
// Cross depth while moving: sample real position, ignore destination until reached.
b.x = 400; b.y = 400; layout.moving(b, true);
assert.equal(jobs.size, 1);
const step = () => { const [id, fn] = jobs.entries().next().value; jobs.delete(id); fn(); };
b.el.position = { x: 145, y: 80 }; step();
assert.ok(b.el.style.zIndex < a.el.style.zIndex, 'Actual feet control depth during transitions');
layout.moving(b, false);
assert.equal(jobs.size, 0);
// Approaching actor gives way; an existing overlap can escape.
b.el.position = { x: 145, y: 100 }; layout.refresh(b);
layout.moving(b, true); b.el.position = { x: 130, y: 100 }; step();
assert.equal(blocked.length, 1);
layout.moving(b, false);
layout.moving(b, true); b.el.position = { x: 139, y: 100 }; step();
assert.equal(blocked.length, 1, 'Walking out of an overlap is allowed');
layout.moving(b, false);
// Annotations share the target, with a compositor timeline rather than an
// independently restarted CSS transition (real interpolation tested in Chromium).
a.el.style.transition = 'transform 2s ease-in-out'; a.el.style.transform = 'translate(200px,100px)';
const cleanup = layout.annotate(a, node());
const annotation = layout.overlayLayer.children[0];
assert.equal(annotation.style.transform, a.el.style.transform);
assert.equal(annotation.style.transition, 'none');
cleanup(); assert.equal(annotation.removed, true);
layout.inspect(() => {}); assert.equal(jobs.size, 1);
layout.inspect(null); assert.equal(jobs.size, 0, 'Closing inspector stops idle sampling');
layout.moving(a, true); doc.hidden = true; events.get('visibilitychange')(); assert.equal(jobs.size, 0);
doc.hidden = false; events.get('visibilitychange')(); assert.equal(jobs.size, 1);
layout.unregister(a); layout.unregister(b); assert.equal(jobs.size, 0);
layout.dispose(); assert.equal(events.size, 0);
console.log('PASS vivarium layout: dense placement, occupied targets, local index, actual depth, yielding/escape, smooth annotations, visibility and cleanup');
