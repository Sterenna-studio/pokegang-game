'use strict';

// ES imports: none.
// Injected deps via configureUpdateManager(ctx):
// - appVersion, scheduler, saveState, switchTab
// - versionPollInterval, versionFirstDelay, dailyCheckInterval
// - updateCountdownSeconds, dailyCountdownSeconds
// - localStorageRef, documentRef, locationRef, fetchRef
// - setTimeoutRef, setIntervalRef, clearIntervalRef, now
// Classic-script globals used: none.
// Temporary globalThis access: default browser dependency fallbacks only.

let updateContext = {};
let remoteVersionBannerShown = false;
let dailyReloadLastHour = -1;
let dailyCountdownActive = false;

export function configureUpdateManager(ctx = {}) {
  updateContext = { ...updateContext, ...ctx };
}

export function resetUpdateManagerState() {
  remoteVersionBannerShown = false;
  dailyReloadLastHour = -1;
  dailyCountdownActive = false;
}

function getAppVersion() {
  return updateContext.appVersion ?? '';
}

function getScheduler() {
  return updateContext.scheduler;
}

function saveState() {
  return updateContext.saveState?.();
}

function switchTab(...args) {
  return updateContext.switchTab?.(...args);
}

function getLocalStorage() {
  return updateContext.localStorageRef ?? globalThis.localStorage;
}

function getDocument() {
  return updateContext.documentRef ?? globalThis.document;
}

function getLocation() {
  return updateContext.locationRef ?? globalThis.location;
}

function getFetch() {
  return updateContext.fetchRef ?? globalThis.fetch?.bind(globalThis);
}

function setTimeoutRef(...args) {
  return (updateContext.setTimeoutRef ?? globalThis.setTimeout)(...args);
}

function setIntervalRef(...args) {
  return (updateContext.setIntervalRef ?? globalThis.setInterval)(...args);
}

function clearIntervalRef(...args) {
  return (updateContext.clearIntervalRef ?? globalThis.clearInterval)(...args);
}

function nowMs() {
  const value = updateContext.now?.() ?? Date.now();
  return value instanceof Date ? value.getTime() : value;
}

function nowDate() {
  const value = updateContext.now?.();
  if (value instanceof Date) return value;
  return new Date(value ?? Date.now());
}

function getVersionPollInterval() {
  return updateContext.versionPollInterval;
}

function getVersionFirstDelay() {
  return updateContext.versionFirstDelay;
}

function getDailyCheckInterval() {
  return updateContext.dailyCheckInterval;
}

function getUpdateCountdownSeconds() {
  return updateContext.updateCountdownSeconds ?? 0;
}

function getDailyCountdownSeconds() {
  return updateContext.dailyCountdownSeconds ?? 0;
}

export function checkVersionOnBoot() {
  const PG_VER_KEY = 'pg.appVersion';
  const storage = getLocalStorage();
  const appVersion = getAppVersion();
  const stored = storage.getItem(PG_VER_KEY);
  if (stored && stored !== appVersion) {
    storage.setItem(PG_VER_KEY, appVersion);
    getLocation().reload(true);
    return true;
  }
  storage.setItem(PG_VER_KEY, appVersion);
  return false;
}

export function pollRemoteVersion() {
  if (remoteVersionBannerShown) return false;
  const fetchRef = getFetch();
  if (!fetchRef) return false;
  return fetchRef(`./index.html?_v=${nowMs()}`, { cache: 'no-store' })
    .then(r => r.text())
    .then(html => {
      const match = html.match(/<meta\s+name="app-version"\s+content="([^"]+)"/);
      if (!match) return;
      const remoteVer = match[1];
      if (remoteVer !== getAppVersion() && !remoteVersionBannerShown) {
        remoteVersionBannerShown = true;
        showUpdateBanner(remoteVer);
      }
    })
    .catch(() => {});
}

export function showUpdateBanner(newVer) {
  const document = getDocument();
  const location = getLocation();
  document.getElementById('updateBanner')?.remove();

  let remaining = getUpdateCountdownSeconds();

  const banner = document.createElement('div');
  banner.id = 'updateBanner';
  banner.style.cssText = `
    position:fixed; top:0; left:0; right:0; z-index:99999;
    background:#cc3333; color:#fff; text-align:center;
    padding:10px 16px; font-size:13px; font-family:inherit;
    display:flex; align-items:center; justify-content:center; gap:12px;
    box-shadow:0 2px 12px rgba(0,0,0,0.5);
  `;
  banner.innerHTML = `
    <span id="updateBannerMsg">⚡ Nouvelle version <strong>${newVer}</strong> — rechargement dans <strong id="updateCountdown">${getUpdateCountdownSeconds()}</strong>s</span>
    <button id="updateBannerBtn" style="
      background:#fff; color:#cc3333; border:none; border-radius:4px;
      padding:4px 12px; font-size:12px; cursor:pointer; font-weight:bold;
    ">Recharger maintenant</button>
  `;
  document.body.prepend(banner);

  const doReload = () => { saveState(); location.reload(true); };

  document.getElementById('updateBannerBtn')?.addEventListener('click', doReload);

  const ticker = setIntervalRef(() => {
    remaining--;
    const el = document.getElementById('updateCountdown');
    if (el) el.textContent = remaining;
    if (remaining <= 0) { clearIntervalRef(ticker); doReload(); }
  }, 1000);
}

export function startDailyReloadSchedule() {
  getScheduler()?.register?.('dailyReload', checkDailyReloadTick, getDailyCheckInterval(), { skipWhenHidden: false });
}

export function startUpdateChecks() {
  getScheduler()?.register?.('versionPoll', pollRemoteVersion, getVersionPollInterval(), { skipWhenHidden: false });
  setTimeoutRef(pollRemoteVersion, getVersionFirstDelay());
  startDailyReloadSchedule();
}

export function checkDailyReloadTick() {
  const current = nowDate();
  const h = current.getHours();
  const m = current.getMinutes();

  const isReloadHour = (h === 11 && m === 59) || (h === 23 && m === 59);
  const reloadKey = h < 12 ? 0 : 12;

  if (isReloadHour && dailyReloadLastHour !== reloadKey && !dailyCountdownActive) {
    dailyCountdownActive = true;
    dailyReloadLastHour = reloadKey;
    runDailyCountdown(getDailyCountdownSeconds());
  }

  const isMissedReload = (h === 12 || h === 0) && m === 0 && dailyReloadLastHour !== reloadKey;
  if (isMissedReload) {
    dailyReloadLastHour = reloadKey;
    saveState();
    getLocation().reload(true);
  }
}

export function runDailyCountdown(seconds) {
  const document = getDocument();
  const ticker = document.getElementById('notifTicker');
  if (!ticker) { triggerDailyReload(); return; }

  const showCountdown = (remaining) => {
    ticker.className = 'notif-ticker notif-ticker-error';
    ticker.innerHTML = `<span class="notif-ticker-icon">⚠</span>`
      + `<span class="notif-ticker-text">🔄 Maintenance — rechargement dans ${remaining}s</span>`;
    ticker.style.opacity = '1';
    ticker.style.transform = 'translateY(0)';
  };
  showCountdown(seconds);

  let remaining = seconds;
  const interval = setIntervalRef(() => {
    remaining--;
    showCountdown(remaining);
    if (remaining <= 0) { clearIntervalRef(interval); triggerDailyReload(); }
  }, 1000);
}

export function triggerDailyReload() {
  saveState();
  switchTab('tabGang');
  setTimeoutRef(() => getLocation().reload(true), 500);
}
