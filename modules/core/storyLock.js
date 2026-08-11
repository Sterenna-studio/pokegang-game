'use strict';

// A single narrative surface may own the screen at a time. The lock is kept
// deliberately small: story modules remain responsible for their own DOM and
// release the lock when their overlay has actually finished closing.
let activeOwner = null;

export function acquireStoryLock(owner) {
  if (!owner || activeOwner !== null) return false;
  activeOwner = owner;
  return true;
}

export function releaseStoryLock(owner) {
  if (activeOwner !== owner) return false;
  activeOwner = null;
  return true;
}

export function getStoryLockOwner() {
  return activeOwner;
}

export function isStoryLocked() {
  return activeOwner !== null;
}

export function resetStoryLockForTests() {
  activeOwner = null;
}
