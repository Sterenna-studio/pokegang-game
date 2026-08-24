'use strict';

// Combat replay lifecycle shared by standard trainer battles, raids and
// permanent event trainers. Kept DOM-light so the invariants can be tested
// headlessly without a browser dependency.

import { FALLBACK_POKEMON_SVG } from '../../data/assets-data.js';

export function createCombatSequenceManager({
  setTimeoutRef = globalThis.setTimeout,
  clearTimeoutRef = globalThis.clearTimeout,
} = {}) {
  let generation = 0;
  let activeSequence = null;

  function isActive(sequence) {
    return !!sequence && sequence === activeSequence && sequence.active === true;
  }

  function cancel(sequence) {
    if (!sequence) return false;
    sequence.active = false;
    for (const timer of sequence.timers) clearTimeoutRef(timer);
    sequence.timers.clear();
    if (activeSequence === sequence) activeSequence = null;
    return true;
  }

  function begin(metadata = {}) {
    if (activeSequence) cancel(activeSequence);
    const sequence = {
      id: ++generation,
      metadata: { ...metadata },
      timers: new Set(),
      active: true,
      ended: false,
    };
    activeSequence = sequence;
    return sequence;
  }

  function schedule(sequence, callback, delayMs) {
    if (!isActive(sequence)) return null;
    let timer = null;
    const guardedCallback = () => {
      sequence.timers.delete(timer);
      if (!isActive(sequence)) return;
      callback();
    };
    timer = setTimeoutRef(guardedCallback, delayMs);
    sequence.timers.add(timer);
    return timer;
  }

  function finish(sequence, callback) {
    if (!isActive(sequence) || sequence.ended) return false;
    sequence.ended = true;
    cancel(sequence);
    callback?.();
    return true;
  }

  return { begin, schedule, cancel, finish, isActive, getActive: () => activeSequence };
}

export function suspendCombatSpawnExpiry(spawn, {
  clearTimeoutRef = globalThis.clearTimeout,
  now = Date.now(),
} = {}) {
  if (!spawn) return 0;
  const hadExpiry = spawn.timeout != null || Number.isFinite(spawn.expiresAt);
  if (spawn.timeout != null) clearTimeoutRef(spawn.timeout);
  const remainingMs = Number.isFinite(spawn.expiresAt)
    ? Math.max(0, spawn.expiresAt - now)
    : 0;
  spawn.timeout = null;
  spawn.expiresAt = null;
  spawn.combatExpiryWasActive = hadExpiry;
  spawn.combatExpiryRemainingMs = remainingMs;
  return remainingMs;
}

export function resumeCombatSpawnExpiry(spawn, onExpire, {
  setTimeoutRef = globalThis.setTimeout,
  now = Date.now(),
  minimumMs = 300,
} = {}) {
  if (!spawn || typeof onExpire !== 'function' || spawn.timeout != null) return null;
  if (!spawn.combatExpiryWasActive) {
    delete spawn.combatExpiryRemainingMs;
    delete spawn.combatExpiryWasActive;
    return null;
  }
  const delayMs = Math.max(minimumMs, spawn.combatExpiryRemainingMs || minimumMs);
  spawn.expiresAt = now + delayMs;
  spawn.timeout = setTimeoutRef(onExpire, delayMs);
  delete spawn.combatExpiryRemainingMs;
  delete spawn.combatExpiryWasActive;
  return spawn.timeout;
}

function resetSpriteVisibility(img) {
  img.hidden = false;
  img.removeAttribute?.('hidden');
  if (!img.style) return;
  img.style.display = 'block';
  img.style.visibility = 'visible';
  img.style.opacity = '1';
  img.style.transform = '';
}

export function renderCombatPokemonSprite({
  anchor,
  previous = null,
  src,
  alt,
  className,
  style = '',
  insertBefore = true,
  fallbackSrc = FALLBACK_POKEMON_SVG,
} = {}) {
  if (!anchor) return null;
  const doc = anchor.ownerDocument ?? globalThis.document;
  const img = previous?.parentNode === anchor ? previous : doc?.createElement?.('img');
  if (!img) return null;

  img.className = className || 'combat-pokemon-sprite';
  img.classList?.remove('fainted', 'ko', 'leaving', 'combat-hit', 'combat-sprite-fallback');
  if (img.style) img.style.cssText = style;
  resetSpriteVisibility(img);
  img.alt = alt || '';
  delete img.dataset?.combatFallback;

  img.onerror = function combatSpriteFallback() {
    resetSpriteVisibility(this);
    this.classList?.remove('fainted', 'ko', 'leaving', 'combat-hit');
    this.classList?.add('combat-sprite-fallback');
    if (this.dataset?.combatFallback === '1' || this.src === fallbackSrc) {
      this.onerror = null;
      return;
    }
    if (this.dataset) this.dataset.combatFallback = '1';
    this.src = fallbackSrc;
  };

  // Assign after resetting the reusable node: a previous failed request may
  // have left inline visibility state or a fallback handler on this same img.
  img.src = src || fallbackSrc;
  if (!img.parentNode) {
    if (insertBefore && anchor.firstChild) anchor.insertBefore(img, anchor.firstChild);
    else anchor.appendChild(img);
  }
  return img;
}

export function isCombatSpriteVisible(img) {
  if (!img || img.isConnected === false || img.hidden) return false;
  const inline = img.style || {};
  if (inline.display === 'none' || inline.visibility === 'hidden' || Number(inline.opacity) === 0) return false;
  const view = img.ownerDocument?.defaultView;
  const computed = view?.getComputedStyle?.(img);
  if (!computed) return true;
  return computed.display !== 'none' && computed.visibility !== 'hidden' && Number(computed.opacity) !== 0;
}

export function warnIfActiveEnemySpriteMissing({
  sequenceId,
  zoneId,
  spawnId = null,
  raidId = null,
  enemy,
  spriteEl,
  warn = console.warn,
} = {}) {
  if (!enemy || enemy.hp <= 0 || isCombatSpriteVisible(spriteEl)) return false;
  warn('[combat] active enemy has no visible sprite', {
    sequenceId,
    zoneId,
    spawnId,
    raidId,
    side: 'enemy',
    oldIndex: enemy.oldIndex ?? null,
    newIndex: enemy.index ?? null,
    species: enemy.species_en,
    hp: enemy.hp,
    spriteUrl: enemy.spriteUrl,
    domNodePresent: !!spriteEl,
    src: spriteEl?.src ?? null,
    display: spriteEl?.style?.display ?? null,
    visibility: spriteEl?.style?.visibility ?? null,
    opacity: spriteEl?.style?.opacity ?? null,
  });
  return true;
}
