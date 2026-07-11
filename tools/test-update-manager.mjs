import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const tmpRoot = path.join(root, 'tools', '.tmp-update-manager-tests');

class FakeStorage {
  constructor(seed = {}) {
    this.map = new Map(Object.entries(seed));
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(key, String(value));
  }
}

class FakeElement {
  constructor(documentRef, tagName = 'div') {
    this.documentRef = documentRef;
    this.tagName = tagName;
    this.children = [];
    this.listeners = {};
    this.style = {};
    this.className = '';
    this.textContent = '';
    this.parentNode = null;
    this._id = '';
    this._innerHTML = '';
  }

  set id(value) {
    this._id = value;
    if (value) this.documentRef.elements.set(value, this);
  }

  get id() {
    return this._id;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    const idPattern = /id="([^"]+)"/g;
    let match = idPattern.exec(this._innerHTML);
    while (match) {
      const child = new FakeElement(this.documentRef, 'div');
      child.id = match[1];
      child.parentNode = this;
      this.children.push(child);
      match = idPattern.exec(this._innerHTML);
    }
  }

  get innerHTML() {
    return this._innerHTML;
  }

  addEventListener(type, handler) {
    this.listeners[type] = handler;
  }

  prepend(child) {
    child.parentNode = this;
    this.children.unshift(child);
    if (child.id) this.documentRef.elements.set(child.id, child);
  }

  remove() {
    if (this.id) this.documentRef.elements.delete(this.id);
    for (const child of this.children) child.remove();
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    }
    this.parentNode = null;
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.body = new FakeElement(this, 'body');
  }

  createElement(tagName) {
    return new FakeElement(this, tagName);
  }

  getElementById(id) {
    return this.elements.get(id) ?? null;
  }

  addElement(id) {
    const element = new FakeElement(this);
    element.id = id;
    return element;
  }
}

function createTimers() {
  let nextId = 1;
  const intervals = new Map();
  const timeouts = new Map();
  return {
    intervals,
    timeouts,
    setInterval(fn, delay) {
      const id = nextId++;
      intervals.set(id, { fn, delay, cleared: false });
      return id;
    },
    clearInterval(id) {
      const entry = intervals.get(id);
      if (entry) entry.cleared = true;
    },
    setTimeout(fn, delay) {
      const id = nextId++;
      timeouts.set(id, { fn, delay });
      return id;
    },
    runIntervals(times = 1) {
      for (let i = 0; i < times; i++) {
        for (const entry of [...intervals.values()]) {
          if (!entry.cleared) entry.fn();
        }
      }
    },
    runTimeouts() {
      for (const entry of [...timeouts.values()]) entry.fn();
      timeouts.clear();
    },
  };
}

function configureForTest(api, overrides = {}) {
  const storage = overrides.storage ?? new FakeStorage();
  const documentRef = overrides.documentRef ?? new FakeDocument();
  const timers = overrides.timers ?? createTimers();
  const reloads = [];
  const saveCalls = [];
  const switchedTabs = [];
  const locationRef = { reload: force => reloads.push(force) };
  let nowValue = overrides.nowValue ?? new Date('2026-07-12T10:00:00');

  api.resetUpdateManagerState();
  api.configureUpdateManager({
    appVersion: '1.0.0',
    scheduler: overrides.scheduler,
    saveState: () => { saveCalls.push(true); },
    switchTab: tab => { switchedTabs.push(tab); },
    versionPollInterval: 300_000,
    versionFirstDelay: 10_000,
    dailyCheckInterval: 1_000,
    updateCountdownSeconds: 3,
    dailyCountdownSeconds: 3,
    localStorageRef: storage,
    documentRef,
    locationRef,
    fetchRef: overrides.fetchRef,
    setTimeoutRef: timers.setTimeout,
    setIntervalRef: timers.setInterval,
    clearIntervalRef: timers.clearInterval,
    now: () => nowValue,
  });

  return {
    storage,
    documentRef,
    timers,
    reloads,
    saveCalls,
    switchedTabs,
    setNow(value) { nowValue = value; },
  };
}

await rm(tmpRoot, { recursive: true, force: true });
await mkdir(tmpRoot, { recursive: true });
try {
  const source = await readFile(path.join(root, 'modules', 'core', 'updateManager.js'), 'utf8');
  const modulePath = path.join(tmpRoot, 'updateManager.mjs');
  await writeFile(modulePath, source);
  const api = await import(pathToFileURL(modulePath));

  {
    const ctx = configureForTest(api);
    assert.equal(api.checkVersionOnBoot(), false, 'fresh boot does not reload');
    assert.equal(ctx.storage.getItem('pg.appVersion'), '1.0.0', 'fresh boot stores version');
    assert.deepEqual(ctx.reloads, [], 'fresh boot has no reload');
  }

  {
    const ctx = configureForTest(api, { storage: new FakeStorage({ 'pg.appVersion': '0.9.0' }) });
    assert.equal(api.checkVersionOnBoot(), true, 'old stored version reloads');
    assert.equal(ctx.storage.getItem('pg.appVersion'), '1.0.0', 'old boot stores current version');
    assert.deepEqual(ctx.reloads, [true], 'old boot triggers hard reload');
  }

  {
    let fetchCount = 0;
    const ctx = configureForTest(api, {
      fetchRef: (url, options) => {
        fetchCount++;
        assert.equal(url, './index.html?_v=1783850400000', 'poll adds cache buster');
        assert.deepEqual(options, { cache: 'no-store' }, 'poll uses no-store');
        return Promise.resolve({ text: () => Promise.resolve('<meta name="app-version" content="2.0.0">') });
      },
      nowValue: new Date('2026-07-12T10:00:00Z'),
    });
    await api.pollRemoteVersion();
    assert.ok(ctx.documentRef.getElementById('updateBanner'), 'remote version shows banner');
    await api.pollRemoteVersion();
    assert.equal(fetchCount, 1, 'only one banner check runs after banner is shown');
    ctx.documentRef.getElementById('updateBannerBtn').listeners.click();
    assert.equal(ctx.saveCalls.length, 1, 'reload button saves first');
    assert.deepEqual(ctx.reloads, [true], 'reload button hard reloads');
  }

  {
    const ctx = configureForTest(api);
    api.showUpdateBanner('2.0.0');
    ctx.timers.runIntervals(3);
    assert.equal(ctx.saveCalls.length, 1, 'update countdown saves before reload');
    assert.deepEqual(ctx.reloads, [true], 'update countdown hard reloads');
  }

  {
    const ctx = configureForTest(api, { nowValue: new Date('2026-07-12T11:59:00') });
    ctx.documentRef.addElement('notifTicker');
    api.checkDailyReloadTick();
    api.checkDailyReloadTick();
    assert.equal([...ctx.timers.intervals.values()].filter(entry => !entry.cleared).length, 1, 'daily countdown is not duplicated');
    assert.match(ctx.documentRef.getElementById('notifTicker').innerHTML, /rechargement dans 3s/, 'daily countdown writes ticker');
    ctx.timers.runIntervals(3);
    assert.deepEqual(ctx.switchedTabs, ['tabGang'], 'daily final reload switches to gang tab');
    assert.equal(ctx.saveCalls.length, 1, 'daily final reload saves');
    ctx.timers.runTimeouts();
    assert.deepEqual(ctx.reloads, [true], 'daily final reload hard reloads after delay');
  }

  {
    const ctx = configureForTest(api, { nowValue: new Date('2026-07-12T12:00:00') });
    api.checkDailyReloadTick();
    assert.equal(ctx.saveCalls.length, 1, 'missed exact-hour fallback saves');
    assert.deepEqual(ctx.reloads, [true], 'missed exact-hour fallback reloads');
    assert.deepEqual(ctx.switchedTabs, [], 'missed fallback preserves existing no-switch behavior');
  }

  {
    const registrations = [];
    const scheduler = { register: (...args) => registrations.push(args) };
    const ctx = configureForTest(api, { scheduler });
    api.startUpdateChecks();
    assert.equal(registrations[0][0], 'versionPoll', 'startUpdateChecks registers version poll');
    assert.equal(registrations[1][0], 'dailyReload', 'startUpdateChecks registers daily reload');
    assert.equal(ctx.timers.timeouts.size, 1, 'startUpdateChecks schedules first version poll');
  }

  console.log('updateManager tests passed');
} finally {
  await rm(tmpRoot, { recursive: true, force: true });
}
