import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const source = await readFile(
  path.join(process.cwd(), 'modules', 'core', 'simulationContext.js'),
  'utf8',
);
const simulation = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);

const {
  createSimulationContext,
  deferSimulationUi,
  getActiveSimulationContext,
  isSimulationBatchActive,
  requestSimulationSave,
  resolveSimulationContext,
  snapshotSimulationEffects,
  suppressSimulationAnalytics,
  suppressSimulationNotification,
  withSimulationContext,
} = simulation;

{
  let saves = 0;
  assert.equal(requestSimulationSave(() => { saves++; }), true);
  assert.equal(saves, 1, 'normal gameplay persists immediately');
  assert.equal(deferSimulationUi('pc'), false);
  assert.equal(suppressSimulationNotification(), false);
  assert.equal(suppressSimulationAnalytics(), false);
  assert.equal(isSimulationBatchActive(), false);
}

{
  const metrics = { deferredSaveCalls: 0, deferredUiRefreshes: 0 };
  const context = createSimulationContext({ metrics });
  let saves = 0;

  await withSimulationContext(context, async active => {
    assert.equal(getActiveSimulationContext(), active);
    assert.equal(isSimulationBatchActive(), true);
    assert.equal(resolveSimulationContext().collecting, true);
    assert.equal(resolveSimulationContext({ collecting: false }).deferSave, true);

    requestSimulationSave(() => { saves++; });
    requestSimulationSave(() => { saves++; }, { metrics });
    assert.equal(deferSimulationUi('pc'), true);
    assert.equal(deferSimulationUi('pc'), true);
    assert.equal(deferSimulationUi('gang'), true);
    assert.equal(suppressSimulationNotification(), true);
    assert.equal(suppressSimulationAnalytics(), true);

    await Promise.resolve();
    assert.equal(getActiveSimulationContext(), active, 'context survives async yields');
  });

  assert.equal(saves, 0);
  assert.equal(metrics.deferredSaveCalls, 2);
  assert.equal(metrics.deferredUiRefreshes, 3);
  assert.equal(getActiveSimulationContext(), null, 'context is cleared after success');
  assert.deepEqual(snapshotSimulationEffects(context), {
    saveRequested: true,
    uiInvalidations: ['pc', 'gang'],
    notificationsSuppressed: 1,
    analyticsSuppressed: 1,
  });
}

{
  const outer = createSimulationContext();
  const inner = createSimulationContext({ silent: false });
  await withSimulationContext(outer, async () => {
    await withSimulationContext(inner, async () => {
      assert.equal(getActiveSimulationContext(), inner);
    });
    assert.equal(getActiveSimulationContext(), outer, 'nested context restores its parent');
  });
}

await assert.rejects(
  withSimulationContext(createSimulationContext(), async () => {
    throw new Error('forced context failure');
  }),
  /forced context failure/,
);
assert.equal(getActiveSimulationContext(), null, 'context is cleared after failure');

console.log('simulation context tests passed');
