// ════════════════════════════════════════════════════════════════
//  TICK MANAGER
//  Remplace les ~20 setInterval indépendants par un seul master
//  clock à 1 s qui dispatche chaque tâche selon son intervalle.
//
//  Avantages vs N setInterval :
//  - Pause/resume global en une ligne
//  - Guard document.hidden centralisé (skipWhenHidden)
//  - Dérive maxi +1 s par tick (acceptable pour un idle game)
//  - Debug : Scheduler.dump() liste toutes les tâches + timing
//
//  Usage :
//    import { Scheduler } from './modules/core/tickManager.js';
//    Scheduler.register('agentTick', agentTick, 2_000);
//    Scheduler.register('autoSave', _autoSave, 10_000, { skipWhenHidden: false });
//    Scheduler.start();
// ════════════════════════════════════════════════════════════════

const _tasks = new Map();
let _masterInterval = null;
let _paused = false;
let _tickCount = 0;

/**
 * Enregistre une tâche dans le scheduler.
 *
 * @param {string}   name           - Identifiant unique (pour debug + unregister)
 * @param {Function} fn             - Fonction à exécuter
 * @param {number}   intervalMs     - Intervalle cible en millisecondes
 * @param {object}   [opts]
 * @param {boolean}  [opts.skipWhenHidden=true]  - Skip si document.hidden
 * @param {boolean}  [opts.runImmediately=false] - Exécuter dès le premier tick
 */
function register(name, fn, intervalMs, opts = {}) {
  const { skipWhenHidden = true, runImmediately = false } = opts;
  _tasks.set(name, {
    fn,
    intervalMs,
    skipWhenHidden,
    lastRun: runImmediately ? 0 : Date.now(),
    runCount: 0,
    lastDurationMs: 0,
  });
}

/**
 * Supprime une tâche (ex: agentTick quand plus de zone ouverte).
 */
function unregister(name) {
  _tasks.delete(name);
}

/**
 * Vérifie si une tâche est enregistrée.
 */
function has(name) {
  return _tasks.has(name);
}

/**
 * Met à jour l'intervalle d'une tâche existante.
 */
function setInterval_(name, intervalMs) {
  const t = _tasks.get(name);
  if (t) t.intervalMs = intervalMs;
}

/** Pause toutes les tâches (document.hidden non pris en compte). */
function pause() { _paused = true; }

/** Reprend toutes les tâches. */
function resume() { _paused = false; }

/** Retourne true si le scheduler est en pause. */
function isPaused() { return _paused; }

/** Dump pour debug — liste toutes les tâches avec leur état. */
function dump() {
  const now = Date.now();
  const rows = [];
  for (const [name, t] of _tasks) {
    rows.push({
      name,
      intervalMs: t.intervalMs,
      skipWhenHidden: t.skipWhenHidden,
      sinceLastRun: `${Math.round((now - t.lastRun) / 1000)}s`,
      runCount: t.runCount,
      lastDurationMs: `${t.lastDurationMs}ms`,
    });
  }
  console.table(rows);
  return rows;
}

/** Lance le master clock (setInterval 1 s). Idempotent. */
function start() {
  if (_masterInterval) return;
  _masterInterval = globalThis.setInterval(_tick, 1_000);
}

/** Arrête le master clock (pour tests ou reload). */
function stop() {
  if (_masterInterval) {
    globalThis.clearInterval(_masterInterval);
    _masterInterval = null;
  }
}

// ── Master tick ───────────────────────────────────────────────
function _tick() {
  if (_paused) return;
  _tickCount++;

  const now = Date.now();
  const hidden = globalThis.document?.hidden ?? false;

  for (const [name, task] of _tasks) {
    if (hidden && task.skipWhenHidden) continue;
    if (now - task.lastRun < task.intervalMs) continue;

    task.lastRun = now;
    task.runCount++;

    const t0 = performance.now();
    try {
      task.fn();
    } catch (err) {
      console.error(`[TickManager] Erreur dans la tâche "${name}" :`, err);
    }
    task.lastDurationMs = Math.round(performance.now() - t0);
  }
}

export const Scheduler = {
  register,
  unregister,
  has,
  setInterval: setInterval_,
  pause,
  resume,
  isPaused,
  start,
  stop,
  dump,
  get tickCount() { return _tickCount; },
};
