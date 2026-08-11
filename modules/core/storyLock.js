'use strict';

// A single narrative surface may own the screen at a time. Requests that cannot
// start immediately are queued instead of being dropped. Story modules remain
// responsible for their own DOM and release the lock once their overlay has
// actually finished closing.
let activeOwner = null;
let sequence = 0;
const pending = [];

export const STORY_PRIORITIES = Object.freeze({
  BOOT: 10,
  GAMEPLAY: 20,
  ONBOARDING: 30,
});

function _sortPending() {
  pending.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
}

function _pumpStoryQueue() {
  if (activeOwner !== null) return;

  while (pending.length > 0 && activeOwner === null) {
    const request = pending.shift();
    let eligible = false;
    try {
      eligible = request.isEligible();
    } catch (error) {
      console.error(`[story] Eligibility check failed for "${request.owner}":`, error);
    }
    if (!eligible) continue;

    activeOwner = request.owner;
    try {
      const started = request.start();
      if (started === false) activeOwner = null;
    } catch (error) {
      console.error(`[story] Failed to start "${request.owner}":`, error);
      activeOwner = null;
    }
  }
}

/**
 * Queue a narrative surface. The owner is de-duplicated across the active
 * surface and pending queue. Returns true when accepted (started or queued).
 */
export function requestStory(owner, start, {
  priority = STORY_PRIORITIES.BOOT,
  isEligible = () => true,
} = {}) {
  if (!owner || typeof start !== 'function' || typeof isEligible !== 'function') return false;
  if (activeOwner === owner || pending.some(item => item.owner === owner)) return false;

  pending.push({ owner, start, isEligible, priority, sequence: sequence++ });
  _sortPending();
  _pumpStoryQueue();
  return true;
}

export function acquireStoryLock(owner) {
  if (!owner || activeOwner !== null) return false;
  activeOwner = owner;
  return true;
}

export function releaseStoryLock(owner) {
  if (activeOwner !== owner) return false;
  activeOwner = null;
  _pumpStoryQueue();
  return true;
}

export function getStoryLockOwner() {
  return activeOwner;
}

export function isStoryLocked() {
  return activeOwner !== null;
}

export function getPendingStoryOwners() {
  return pending.map(item => item.owner);
}

export function cancelPendingStory(owner) {
  const index = pending.findIndex(item => item.owner === owner);
  if (index === -1) return false;
  pending.splice(index, 1);
  return true;
}

export function resetStoryLockForTests() {
  activeOwner = null;
  pending.length = 0;
  sequence = 0;
}
