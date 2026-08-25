// Pure orchestration helpers for the offline return path.
// Browser globals are injected so the same control flow can be exercised headlessly.

export const DEFAULT_OFFLINE_CHUNK_SIZE = 40;
export const OFFLINE_SYNC_DELAY_MS = 75;

export function yieldToBrowser(setTimeoutRef = setTimeout) {
  return new Promise(resolve => setTimeoutRef(resolve, 0));
}

export async function runOfflineCatchupBatch({
  jobs = [],
  resolveTick,
  chunkSize = DEFAULT_OFFLINE_CHUNK_SIZE,
  yieldFn = () => yieldToBrowser(),
} = {}) {
  if (typeof resolveTick !== 'function') throw new TypeError('resolveTick is required');
  const safeChunkSize = Math.max(1, Math.floor(chunkSize));
  const queue = jobs
    .filter(job => job?.zoneId && Number.isFinite(job.ticks) && job.ticks > 0)
    .map(job => ({ zoneId: job.zoneId, ticks: Math.floor(job.ticks) }));
  const ticksPlanned = queue.reduce((sum, job) => sum + job.ticks, 0);
  let ticksProcessed = 0;
  let yields = 0;
  let chunkWork = 0;

  for (let jobIndex = 0; jobIndex < queue.length; jobIndex++) {
    const job = queue[jobIndex];
    for (let tick = 0; tick < job.ticks; tick++) {
      const changed = await resolveTick(job.zoneId, tick);
      ticksProcessed++;
      chunkWork++;
      if (changed === false) break;

      const hasMoreInJob = tick + 1 < job.ticks;
      const hasMoreJobs = jobIndex + 1 < queue.length;
      if (chunkWork >= safeChunkSize && (hasMoreInJob || hasMoreJobs)) {
        await yieldFn();
        yields++;
        chunkWork = 0;
      }
    }
  }

  return {
    zones: queue.length,
    ticksPlanned,
    ticksProcessed,
    yields,
  };
}

function _captureCleanupError(currentError, nextError) {
  if (!currentError) return nextError;
  console.warn('[OfflineReport] cleanup step failed:', nextError);
  return currentError;
}

export async function runOfflineReturnFlow({
  absentSince,
  startCollecting,
  stopCollecting,
  applyIdleCatchup,
  applyZoneCatchup,
  save,
  refreshUi,
  resumeTimers,
  shouldShowReport,
  showReport,
  showSync = () => {},
  hideSync = () => {},
  loaderDelayMs = OFFLINE_SYNC_DELAY_MS,
  initialYield = () => yieldToBrowser(),
  setTimeoutRef = setTimeout,
  clearTimeoutRef = clearTimeout,
  now = () => Date.now(),
} = {}) {
  const startedAt = now();
  const metrics = {
    absentMs: Math.max(0, startedAt - (absentSince || startedAt)),
    zones: 0,
    ticksPlanned: 0,
    ticksProcessed: 0,
    saveCalls: 0,
    uiRefreshes: 0,
    yields: 0,
    deferredSaveCalls: 0,
    deferredUiRefreshes: 0,
    durationMs: 0,
  };
  let collectorActive = false;
  let report = null;
  let flowError = null;
  let loaderTimer = null;

  try {
    startCollecting?.(absentSince);
    collectorActive = true;
    loaderTimer = setTimeoutRef(() => {
      try { showSync(); }
      catch (error) { console.warn('[OfflineReport] sync feedback failed:', error); }
    }, loaderDelayMs);

    // Give the restored tab one paint opportunity before any business work.
    await initialYield();

    const idleMetrics = await applyIdleCatchup?.({
      silent: true,
      deferSave: true,
      metrics,
    });
    if (idleMetrics?.deferredSaveCalls) {
      metrics.deferredSaveCalls += idleMetrics.deferredSaveCalls;
    }

    const zoneMetrics = await applyZoneCatchup?.({ metrics });
    if (zoneMetrics) {
      metrics.zones = zoneMetrics.zones || 0;
      metrics.ticksPlanned = zoneMetrics.ticksPlanned || 0;
      metrics.ticksProcessed = zoneMetrics.ticksProcessed || 0;
      metrics.yields = zoneMetrics.yields || 0;
    }

    report = stopCollecting?.() ?? null;
    collectorActive = false;
  } catch (error) {
    flowError = error;
  } finally {
    if (collectorActive) {
      try { stopCollecting?.(); }
      catch (error) { flowError = _captureCleanupError(flowError, error); }
      collectorActive = false;
    }

    if (loaderTimer !== null) clearTimeoutRef(loaderTimer);
    try { hideSync(); }
    catch (error) { flowError = _captureCleanupError(flowError, error); }

    // Persist partial progress too: a failed tick must not be replayed on the next focus.
    try {
      metrics.saveCalls++;
      save?.();
    } catch (error) {
      flowError = _captureCleanupError(flowError, error);
    }

    try {
      metrics.uiRefreshes++;
      refreshUi?.();
    } catch (error) {
      flowError = _captureCleanupError(flowError, error);
    }

    try { resumeTimers?.(); }
    catch (error) { flowError = _captureCleanupError(flowError, error); }
    metrics.durationMs = Math.max(0, now() - startedAt);
  }

  if (flowError) {
    if (flowError && typeof flowError === 'object' && !flowError.offlineMetrics) {
      flowError.offlineMetrics = metrics;
    }
    throw flowError;
  }
  if (report && shouldShowReport?.(report)) showReport?.(report);
  return { report, metrics };
}
