// Offline return owner: collect business results, coordinate the chunked catchup,
// then render one concise report. The visual styling lives in offline-report.css.

import {
  aggregateOfflineReport,
  buildOfflineHighlights,
  createOfflineReport,
  getOfflineReportCopy,
  recordOfflineCapture,
  recordOfflineCombat,
  recordOfflineMoney,
  shouldShowOfflineReport,
} from './offlineReportModel.js';
import { runOfflineReturnFlow } from './offlineBatch.js';

const REPORT_MODAL_ID = 'offlineReportModal';
const SYNC_SURFACE_ID = 'offlineReportSync';
const REPORT_THRESHOLD_DEFAULT = 300;

let _collector = null;
let _hiddenSince = null;
let _visibilityGeneration = 0;
let _scheduledReturn = null;
let _catchupQueue = Promise.resolve();
let _lastDiagnostics = null;

function _lang() {
  return globalThis.state?.lang === 'en' ? 'en' : 'fr';
}

function _copy() {
  return getOfflineReportCopy(_lang());
}

function _escape(value) {
  const raw = String(value ?? '');
  if (typeof globalThis.escapeHtml === 'function') return globalThis.escapeHtml(raw);
  return raw.replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]);
}

function _formatDuration(ms) {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  if (totalMinutes < 1) return _lang() === 'en' ? 'less than 1 min' : 'moins d\'1 min';
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h${String(minutes).padStart(2, '0')}` : `${hours}h`;
}

function _formatMoney(value, { forceSign = false } = {}) {
  const amount = Number(value) || 0;
  const sign = amount > 0 && forceSign ? '+' : amount < 0 ? '−' : '';
  return `${sign}${Math.abs(amount).toLocaleString(_lang() === 'en' ? 'en-US' : 'fr-FR')}₽`;
}

function _speciesName(speciesEn) {
  return globalThis.speciesName?.(speciesEn) ?? speciesEn;
}

export function startCollecting(absentSince = null) {
  _collector = createOfflineReport({ absentSince });
  return _collector;
}

export function stopCollecting() {
  const report = _collector;
  _collector = null;
  return report;
}

export function isCollecting() {
  return _collector !== null;
}

export function pushCapture(data) {
  if (_collector) recordOfflineCapture(_collector, data);
}

export function pushCombat(won, reward = 0) {
  if (_collector) recordOfflineCombat(_collector, won, reward);
}

export function pushChest() {
  if (_collector) _collector.chests++;
}

export function pushMoney(delta, source = 'other') {
  if (_collector) recordOfflineMoney(_collector, delta, source);
}

export function pushItems(items = {}) {
  if (!_collector) return;
  for (const [itemId, quantity] of Object.entries(items)) {
    if (!quantity) continue;
    _collector.itemsDelta[itemId] = (_collector.itemsDelta[itemId] || 0) + quantity;
  }
}

export function pushPensionResult({ eggsReady = 0 } = {}) {
  if (_collector) _collector.eggsReady += eggsReady;
}

export function pushTrainingTicks(count) {
  if (_collector && count) _collector.trainingTicks += count;
}

export function pushXPTicks(count) {
  if (_collector && count) _collector.xpTicks += count;
}

export function pushLevelUp(data) {
  if (_collector && data) _collector.levelUps.push(data);
}

export function pushAgentEvent(data) {
  if (_collector && data) _collector.agentEvents.push(data);
}

export function getReportThreshold() {
  const configured = globalThis.state?.settings?.offlineReportThreshold;
  return typeof configured === 'number' ? Math.max(0, configured) : REPORT_THRESHOLD_DEFAULT;
}

export function shouldShowReport(report) {
  return shouldShowOfflineReport(report, {
    thresholdSeconds: getReportThreshold(),
    now: Date.now(),
  });
}

function _kpiCard(label, value, detail = '', modifier = '') {
  return `
    <article class="offline-report__kpi ${modifier}">
      <span class="offline-report__kpi-label">${_escape(label)}</span>
      <strong class="offline-report__kpi-value">${_escape(value)}</strong>
      ${detail ? `<span class="offline-report__kpi-detail">${_escape(detail)}</span>` : ''}
    </article>`;
}

function _buildKpis(report, aggregate, copy) {
  const cards = [];
  if (aggregate.capturesTotal > 0) {
    const shinyDetail = aggregate.shinyTotal > 0 ? `${aggregate.shinyTotal} ✨` : '';
    cards.push(_kpiCard(copy.captures, aggregate.capturesTotal, shinyDetail));
  }
  if (report.sales.count > 0) {
    cards.push(_kpiCard(copy.sales, report.sales.count, _formatMoney(report.sales.revenue, { forceSign: true }), 'offline-report__kpi--sales'));
  }
  if (aggregate.combats.total > 0) {
    cards.push(_kpiCard(
      copy.combats,
      aggregate.combats.total,
      `${aggregate.combats.won} ${copy.winsShort} / ${aggregate.combats.lost} ${copy.lossesShort}`,
    ));
  }
  if (aggregate.totalEarned !== 0) {
    cards.push(_kpiCard(copy.money, _formatMoney(aggregate.totalEarned, { forceSign: true }), copy.totalEarned, 'offline-report__kpi--money'));
  }
  if (report.eggsReady > 0) cards.push(_kpiCard(copy.eggs, report.eggsReady));
  if (report.trainingTicks > 0) cards.push(_kpiCard(copy.training, report.trainingTicks));
  return `<section class="offline-report__kpis" aria-label="${_escape(copy.totalEarned)}">${cards.join('')}</section>`;
}

function _highlightLabel(highlight, copy) {
  if (highlight.kind === 'eggs') {
    return `${highlight.count} ${highlight.count > 1 ? copy.eggsReady : copy.eggReady}`;
  }
  if (highlight.kind === 'level_up') {
    return `${highlight.name || highlight.species_en || ''} · ${copy.levelUp}`;
  }
  if (highlight.kind === 'exhausted') {
    return `${highlight.name || ''} · ${copy.exhausted}`;
  }
  if (highlight.kind === 'promotion') {
    return `${highlight.name || ''} · ${copy.promotion} ${highlight.title || ''}`;
  }
  const name = _speciesName(highlight.species_en);
  if (highlight.kind === 'shiny') return `${name} · ✨ ${copy.shiny}`;
  if (highlight.kind === 'legendary') return `${name} · 🏆 ${copy.legendary}`;
  if (highlight.kind === 'very_rare') return `${name} · ⭐ ${copy.veryRare}`;
  return `${name} · ${'★'.repeat(highlight.potential || 1)}`;
}

function _buildHighlights(report, copy) {
  const highlights = buildOfflineHighlights(report, { limit: 4 });
  if (!highlights.length) return '';
  const rows = highlights.map(highlight => {
    const sprite = highlight.species_en
      ? globalThis.pokeSprite?.(highlight.species_en, !!highlight.shiny)
      : '';
    return `
      <li class="offline-report__highlight offline-report__highlight--${_escape(highlight.kind)}">
        ${sprite ? `<img class="offline-report__highlight-sprite" src="${_escape(sprite)}" alt="">` : '<span class="offline-report__highlight-icon">◆</span>'}
        <span>${_escape(_highlightLabel(highlight, copy))}</span>
      </li>`;
  }).join('');
  return `
    <section class="offline-report__highlights">
      <h3>${_escape(copy.highlights)}</h3>
      <ul>${rows}</ul>
    </section>`;
}

function _buildCaptureDetails(aggregate, copy) {
  if (!aggregate.captureGroups.length) return '';
  const groups = aggregate.captureGroups.map(group => {
    const name = _speciesName(group.species_en);
    const sprite = globalThis.pokeSprite?.(group.species_en, group.shinyCount > 0);
    const facts = [];
    if (group.keptCount > 0) facts.push(`<span class="offline-report__kept">${_escape(copy.kept)} ×${group.keptCount}</span>`);
    if (group.soldCount > 0) {
      facts.push(`<span class="offline-report__sold">${_escape(copy.sold)} ×${group.soldCount} · ${_escape(_formatMoney(group.salesRevenue, { forceSign: true }))}</span>`);
    }
    facts.push(`<span>${_escape(copy.best)} : <b class="offline-report__stars">${'★'.repeat(group.maxPotential)}</b></span>`);
    if (group.shinyCount > 0) facts.push(`<span class="offline-report__shiny">✨ ${_escape(copy.shiny)} ×${group.shinyCount}</span>`);
    return `
      <article class="offline-report__capture-group">
        ${sprite ? `<img class="offline-report__capture-sprite" src="${_escape(sprite)}" alt="">` : '<span class="offline-report__capture-sprite-placeholder"></span>'}
        <div class="offline-report__capture-copy">
          <div class="offline-report__capture-name"><strong>${_escape(name)}</strong><span>×${group.count}</span></div>
          <div class="offline-report__capture-facts">${facts.join('')}</div>
        </div>
      </article>`;
  }).join('');
  return `
    <details class="offline-report__details">
      <summary>${_escape(copy.viewDetails)} (${aggregate.capturesTotal})</summary>
      <div class="offline-report__capture-groups">${groups}</div>
    </details>`;
}

function _buildEconomyFootnote(report, copy) {
  const parts = [];
  if (report.sales.revenue) parts.push(`${copy.salesIncome} ${_formatMoney(report.sales.revenue, { forceSign: true })}`);
  if (report.combats.totalReward) parts.push(`${copy.combatIncome} ${_formatMoney(report.combats.totalReward, { forceSign: true })}`);
  if (report.moneySources.chest) parts.push(`${copy.chestIncome} ${_formatMoney(report.moneySources.chest, { forceSign: true })}`);
  for (const [itemId, quantity] of Object.entries(report.itemsDelta)) {
    const ball = globalThis.BALLS?.[itemId];
    const label = (_lang() === 'en' ? ball?.en : ball?.fr) || itemId;
    parts.push(`${quantity > 0 ? '+' : ''}${quantity} ${label}`);
  }
  return parts.length ? `<p class="offline-report__economy-note">${parts.map(_escape).join(' · ')}</p>` : '';
}

export function buildOfflineReportHTML(report) {
  const copy = _copy();
  const aggregate = aggregateOfflineReport(report);
  const absentMs = report.absentSince ? Date.now() - report.absentSince : 0;
  return `
    <section class="offline-report" role="dialog" aria-modal="true" aria-labelledby="offlineReportTitle">
      <header class="offline-report__header">
        <span class="offline-report__eyebrow">PokéGang · Offline</span>
        <h2 id="offlineReportTitle">${_escape(copy.workedWhileAway)} <strong>${_escape(_formatDuration(absentMs))}</strong></h2>
      </header>
      <div class="offline-report__body">
        ${_buildKpis(report, aggregate, copy)}
        ${_buildEconomyFootnote(report, copy)}
        ${_buildHighlights(report, copy)}
        ${_buildCaptureDetails(aggregate, copy)}
      </div>
      <footer class="offline-report__footer">
        <button id="offlineReportClose" class="offline-report__close" type="button">${_escape(copy.close)}</button>
      </footer>
    </section>`;
}

export function showOfflineReportModal(report) {
  document.getElementById(REPORT_MODAL_ID)?.remove();
  const overlay = document.createElement('div');
  overlay.id = REPORT_MODAL_ID;
  overlay.className = 'offline-report-overlay';
  overlay.innerHTML = buildOfflineReportHTML(report);
  document.body.appendChild(overlay);
  overlay.querySelector('#offlineReportClose')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', event => {
    if (event.target === overlay) overlay.remove();
  });
}

function _showSyncSurface() {
  if (document.getElementById(SYNC_SURFACE_ID)) return;
  const surface = document.createElement('div');
  surface.id = SYNC_SURFACE_ID;
  surface.className = 'offline-sync';
  surface.setAttribute('role', 'status');
  surface.setAttribute('aria-live', 'polite');
  surface.innerHTML = `<span class="offline-sync__spinner" aria-hidden="true"></span><span>${_escape(_copy().syncing)}</span>`;
  document.body.appendChild(surface);
}

function _hideSyncSurface() {
  document.getElementById(SYNC_SURFACE_ID)?.remove();
}

function _diagnosticsEnabled() {
  if (globalThis.__POKEGANG_OFFLINE_DEBUG__ === true) return true;
  const host = globalThis.location?.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function _refreshAfterCatchup() {
  globalThis.invalidateLookupMaps?.();
  globalThis.resetPcRenderCache?.();
  globalThis.renderAll?.();
}

export async function runCatchupAndReport(absentSince) {
  try {
    const result = await runOfflineReturnFlow({
      absentSince,
      startCollecting,
      stopCollecting,
      applyIdleCatchup: options => globalThis.applyOfflineCatchup?.(options),
      applyZoneCatchup: options => globalThis._catchupHiddenZones?.(options),
      save: () => globalThis.saveState?.(),
      refreshUi: _refreshAfterCatchup,
      resumeTimers: () => {
        if (document.hidden) globalThis._pauseAllZoneTimers?.();
        else globalThis._resumeAllZoneTimers?.();
      },
      shouldShowReport,
      showReport: showOfflineReportModal,
      showSync: _showSyncSurface,
      hideSync: _hideSyncSurface,
    });
    _lastDiagnostics = result.metrics;
    if (_diagnosticsEnabled()) console.info('[OfflineReport] catchup completed', result.metrics);
    return result;
  } catch (error) {
    _lastDiagnostics = error?.offlineMetrics || null;
    console.warn('[OfflineReport] catchup orchestration failed:', error);
    throw error;
  }
}

function _queueReturn(absentSince, generation) {
  _catchupQueue = _catchupQueue
    .catch(() => {})
    .then(async () => {
      if (document.hidden || generation !== _visibilityGeneration) return;
      await runCatchupAndReport(absentSince);
    });
  _catchupQueue.catch(() => {});
}

function _onVisibilityChange() {
  _visibilityGeneration++;
  if (_scheduledReturn !== null) {
    clearTimeout(_scheduledReturn);
    _scheduledReturn = null;
  }

  if (document.hidden) {
    if (!_hiddenSince) _hiddenSince = Date.now();
    globalThis._pauseAllZoneTimers?.();
    _hideSyncSurface();
    return;
  }

  const absentSince = _hiddenSince;
  _hiddenSince = null;
  if (!absentSince) {
    globalThis._resumeAllZoneTimers?.();
    return;
  }

  const generation = _visibilityGeneration;
  _scheduledReturn = setTimeout(() => {
    _scheduledReturn = null;
    _queueReturn(absentSince, generation);
  }, 0);
}

async function _runDevHarness({ absentMs = 5 * 60_000, zoneIds = null } = {}) {
  if (!_diagnosticsEnabled()) throw new Error('Offline report harness is only available in local DEV mode.');
  if (isCollecting()) throw new Error('An offline catchup is already running.');
  globalThis._pauseAllZoneTimers?.();
  const zones = globalThis._zsys_prepareOfflineCatchupForDev?.(absentMs, zoneIds) || [];
  const result = await runCatchupAndReport(Date.now() - absentMs);
  return { ...result, preparedZones: zones };
}

document.addEventListener('visibilitychange', _onVisibilityChange);

globalThis.OfflineReport = {
  startCollecting,
  stopCollecting,
  isCollecting,
  isBatching: isCollecting,
  pushCapture,
  pushCombat,
  pushChest,
  pushMoney,
  pushItems,
  pushPensionResult,
  pushTrainingTicks,
  pushXPTicks,
  pushLevelUp,
  pushAgentEvent,
  getReportThreshold,
  shouldShowReport,
  showOfflineReportModal,
  runCatchupAndReport,
  runDevHarness: _runDevHarness,
  getLastDiagnostics: () => _lastDiagnostics,
};
