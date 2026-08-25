// Transactional context for simulated gameplay (offline catchup today, other
// deterministic simulations later). Consumers can keep accepting a local
// options object; missing flags inherit from the active context.

const NORMAL_CONTEXT = Object.freeze({
  batch: false,
  silent: false,
  collecting: false,
  deferSave: false,
  deferUi: false,
  suppressAnalytics: false,
  metrics: null,
  effects: null,
});

let _activeContext = null;

export function createSimulationContext({
  batch = true,
  silent = batch,
  collecting = batch,
  deferSave = batch,
  deferUi = batch,
  suppressAnalytics = batch,
  metrics = null,
} = {}) {
  return {
    batch: !!batch,
    silent: !!silent,
    collecting: !!collecting,
    deferSave: !!deferSave,
    deferUi: !!deferUi,
    suppressAnalytics: !!suppressAnalytics,
    metrics,
    effects: {
      saveRequested: false,
      uiInvalidations: new Set(),
      notificationsSuppressed: 0,
      analyticsSuppressed: 0,
    },
  };
}

export function getActiveSimulationContext() {
  return _activeContext;
}

export function resolveSimulationContext(overrides = null) {
  const base = _activeContext || NORMAL_CONTEXT;
  if (!overrides) return base;
  if (overrides === base) return base;
  return {
    ...base,
    ...overrides,
    metrics: overrides.metrics ?? base.metrics,
    effects: overrides.effects ?? base.effects,
  };
}

export async function withSimulationContext(context, callback) {
  if (!context || typeof callback !== 'function') {
    throw new TypeError('withSimulationContext requires a context and callback');
  }
  const previous = _activeContext;
  _activeContext = context;
  try {
    return await callback(context);
  } finally {
    _activeContext = previous;
  }
}

function _incrementMetric(context, key) {
  if (!context.metrics) return;
  context.metrics[key] = (context.metrics[key] || 0) + 1;
}

export function requestSimulationSave(save, overrides = null) {
  const context = resolveSimulationContext(overrides);
  if (!context.deferSave) {
    save?.();
    return true;
  }
  if (context.effects) context.effects.saveRequested = true;
  _incrementMetric(context, 'deferredSaveCalls');
  return false;
}

export function deferSimulationUi(domain = 'global', overrides = null) {
  const context = resolveSimulationContext(overrides);
  if (!context.deferUi) return false;
  context.effects?.uiInvalidations.add(domain);
  _incrementMetric(context, 'deferredUiRefreshes');
  return true;
}

export function suppressSimulationNotification(overrides = null) {
  const context = resolveSimulationContext(overrides);
  if (!context.silent) return false;
  if (context.effects) context.effects.notificationsSuppressed++;
  return true;
}

export function suppressSimulationAnalytics(overrides = null) {
  const context = resolveSimulationContext(overrides);
  if (!context.suppressAnalytics) return false;
  if (context.effects) context.effects.analyticsSuppressed++;
  return true;
}

export function isSimulationBatchActive() {
  return !!_activeContext?.batch;
}

export function snapshotSimulationEffects(context = _activeContext) {
  if (!context?.effects) return {
    saveRequested: false,
    uiInvalidations: [],
    notificationsSuppressed: 0,
    analyticsSuppressed: 0,
  };
  return {
    saveRequested: context.effects.saveRequested,
    uiInvalidations: [...context.effects.uiInvalidations],
    notificationsSuppressed: context.effects.notificationsSuppressed,
    analyticsSuppressed: context.effects.analyticsSuppressed,
  };
}
