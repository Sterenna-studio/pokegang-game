import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function importSource(relativePath) {
  const source = await readFile(path.join(process.cwd(), relativePath), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

const {
  DEFAULT_OFFLINE_CHUNK_SIZE,
  runOfflineCatchupBatch,
  runOfflineReturnFlow,
} = await importSource('modules/systems/offlineBatch.js');

assert.ok(DEFAULT_OFFLINE_CHUNK_SIZE >= 20 && DEFAULT_OFFLINE_CHUNK_SIZE <= 50);

{
  let resolutions = 0;
  let yields = 0;
  const result = await runOfflineCatchupBatch({
    jobs: [
      { zoneId: 'route_1', ticks: 300 },
      { zoneId: 'forest', ticks: 320 },
    ],
    resolveTick: async () => { resolutions++; return true; },
    chunkSize: 40,
    yieldFn: async () => { yields++; },
  });

  assert.equal(resolutions, 620, 'all planned multi-zone resolutions run');
  assert.equal(result.zones, 2);
  assert.equal(result.ticksPlanned, 620);
  assert.equal(result.ticksProcessed, 620);
  assert.equal(result.yields, 15, '620 ticks are split into 16 chunks');
  assert.equal(yields, 15);
}

{
  const visited = [];
  const result = await runOfflineCatchupBatch({
    jobs: [
      { zoneId: 'empty', ticks: 10 },
      { zoneId: 'active', ticks: 3 },
    ],
    resolveTick: async zoneId => {
      visited.push(zoneId);
      return zoneId !== 'empty';
    },
    chunkSize: 2,
    yieldFn: async () => {},
  });

  assert.deepEqual(visited, ['empty', 'active', 'active', 'active']);
  assert.equal(result.ticksProcessed, 4, 'a stopped zone does not stop later zones');
}

{
  let saves = 0;
  let refreshes = 0;
  let resumes = 0;
  let collectorStops = 0;
  let reportShown = 0;
  let loaderCallback = null;
  let loaderShown = 0;
  let loaderHidden = 0;
  let initialYields = 0;
  const report = { captures: [{ species_en: 'zubat' }] };
  const flowMetrics = {};

  const result = await runOfflineReturnFlow({
    absentSince: 1_000,
    now: () => 61_000,
    startCollecting: () => {},
    stopCollecting: () => { collectorStops++; return report; },
    applyIdleCatchup: async options => {
      assert.equal(options.deferSave, true);
      assert.equal(options.silent, true);
      return { elapsed: 60_000 };
    },
    applyZoneCatchup: async () => {
      loaderCallback?.();
      return { zones: 2, ticksPlanned: 600, ticksProcessed: 600, yields: 14 };
    },
    save: () => { saves++; },
    refreshUi: () => { refreshes++; },
    resumeTimers: () => { resumes++; },
    shouldShowReport: value => value === report,
    showReport: () => { reportShown++; },
    showSync: () => { loaderShown++; },
    hideSync: () => { loaderHidden++; },
    initialYield: async () => { initialYields++; },
    setTimeoutRef: callback => { loaderCallback = callback; return 7; },
    clearTimeoutRef: id => assert.equal(id, 7),
    metrics: flowMetrics,
  });

  assert.equal(saves, 1, 'one final persistence for the whole return flow');
  assert.equal(refreshes, 1, 'one coherent final UI refresh');
  assert.equal(resumes, 1, 'timers resume after success');
  assert.equal(collectorStops, 1);
  assert.equal(reportShown, 1);
  assert.equal(loaderShown, 1);
  assert.equal(loaderHidden, 1);
  assert.equal(initialYields, 1);
  assert.equal(result.metrics.absentMs, 60_000);
  assert.equal(result.metrics.zones, 2);
  assert.equal(result.metrics.ticksProcessed, 600);
  assert.equal(result.metrics.saveCalls, 1);
  assert.equal(result.metrics.uiRefreshes, 1);
  assert.equal(result.metrics, flowMetrics, 'the orchestrator fills the shared transaction metrics');
}

{
  let collectorActive = false;
  let collectorStops = 0;
  let saves = 0;
  let refreshes = 0;
  let resumes = 0;
  let loaderHidden = 0;
  await assert.rejects(
    runOfflineReturnFlow({
      absentSince: 10,
      now: () => 20,
      startCollecting: () => { collectorActive = true; },
      stopCollecting: () => { collectorActive = false; collectorStops++; return null; },
      applyIdleCatchup: async () => null,
      applyZoneCatchup: async () => { throw new Error('forced catchup failure'); },
      save: () => { saves++; },
      refreshUi: () => { refreshes++; },
      resumeTimers: () => { resumes++; },
      shouldShowReport: () => false,
      showReport: () => assert.fail('no report should be shown after failure'),
      showSync: () => {},
      hideSync: () => { loaderHidden++; },
      initialYield: async () => {},
    }),
    /forced catchup failure/,
  );

  assert.equal(collectorActive, false, 'collector is cleaned after failure');
  assert.equal(collectorStops, 1);
  assert.equal(saves, 1, 'partial business progress is persisted once');
  assert.equal(refreshes, 1, 'partial progress is rendered coherently once');
  assert.equal(resumes, 1, 'timers resume after failure');
  assert.equal(loaderHidden, 1, 'loader is removed after failure');
}

console.log('offline batch tests passed');
