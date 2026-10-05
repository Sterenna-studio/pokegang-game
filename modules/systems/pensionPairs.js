'use strict';

// Pension pairs. The Daycare is bought and managed in breeding pairs: each pair
// is two fixed seats with its own egg timer, so the player decides exactly who
// breeds with whom (no random pairing among all residents).
//
// `state.pension.slots` stays the flat list of resident ids (other modules read
// it for membership checks); `state.pension.pairs` owns the seating. They are
// reconciled here, so any code that only adds or removes ids from `slots`
// (PC detail panel, market sale, save repair…) keeps working: a removed id
// frees its seat, a new id takes the first free seat.

const EGG_GEN_MS = 5 * 60 * 1000;
const EGG_STOCK_CAP = 24;               // œufs (attente + couvaison + prêts) — au-delà la production se met en pause
const MAX_PAIRS = 3;
const PAIR_PRICES = [0, 200000, 800000]; // prix du couple n (index 0 = offert)

function getMaxPensionPairs(state = globalThis.state) {
  return Math.min(MAX_PAIRS, 1 + (state?.pension?.extraPairsPurchased || 0));
}

function getMaxPensionSlots(state = globalThis.state) {
  return getMaxPensionPairs(state) * 2;
}

function getNextPairPrice(state = globalThis.state) {
  const n = getMaxPensionPairs(state);
  return n < MAX_PAIRS ? PAIR_PRICES[n] : null;
}

function reconcilePensionPairs(state = globalThis.state, now = Date.now()) {
  const p = state.pension;
  if (!p) return;
  const maxPairs = getMaxPensionPairs(state);
  const alive = new Set((state.pokemons || []).map(pk => pk.id));
  const slots = Array.isArray(p.slots) ? p.slots : [];
  const wanted = new Set(slots.filter(id => alive.has(id)));
  if (!Array.isArray(p.pairs)) p.pairs = [];

  while (p.pairs.length < maxPairs) p.pairs.push({ a: null, b: null, eggAt: null });
  p.pairs.length = maxPairs;
  for (const pair of p.pairs) {
    if (!wanted.has(pair.a)) pair.a = null;
    if (!wanted.has(pair.b)) pair.b = null;
  }

  const seated = new Set();
  for (const pair of p.pairs) { if (pair.a) seated.add(pair.a); if (pair.b) seated.add(pair.b); }
  for (const id of slots) {
    if (!wanted.has(id) || seated.has(id)) continue;
    const pair = p.pairs.find(x => !x.a || !x.b);
    if (!pair) continue;              // plus de siège : le Pokémon sort de la pension
    if (!pair.a) pair.a = id; else pair.b = id;
    seated.add(id);
  }

  p.slots = p.pairs.flatMap(pair => [pair.a, pair.b]).filter(Boolean);

  // L'ancien minuteur unique alimente le premier couple complet (migration).
  let legacy = p.pairs.some(pair => pair.eggAt) ? null : (p.eggAt || null);
  for (const pair of p.pairs) {
    if (!pair.a || !pair.b) { pair.eggAt = null; continue; }
    if (!pair.eggAt) {
      pair.eggAt = legacy || (now + EGG_GEN_MS);
      legacy = null;
    }
  }
  const timers = p.pairs.map(pair => pair.eggAt).filter(Boolean);
  p.eggAt = timers.length ? Math.min(...timers) : null;   // miroir pour l'affichage du vivarium
}

// Retire un Pokémon de la pension en libérant son siège exact.
function removeFromPension(id, state = globalThis.state) {
  const p = state.pension;
  if (!p) return false;
  const before = (p.slots || []).length;
  p.slots = (p.slots || []).filter(x => x !== id);
  reconcilePensionPairs(state);
  return p.slots.length < before;
}

export {
  EGG_GEN_MS, EGG_STOCK_CAP, MAX_PAIRS, PAIR_PRICES,
  getMaxPensionPairs, getMaxPensionSlots, getNextPairPrice,
  reconcilePensionPairs, removeFromPension,
};
