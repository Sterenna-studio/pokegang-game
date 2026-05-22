// ════════════════════════════════════════════════════════════════
// modules/systems/offlineCatchup.js
// Offline / background idle catchup system
//
// Calcule le temps écoulé depuis la dernière sauvegarde
// et rejoue les ticks idle proportionnellement:
//   - Pension (génération d'œufs + incubation)
//   - Training room (XP)
//   - XP passif équipes
//
// Note : le déclenchement (visibilitychange) est orchestré par
// modules/systems/offlineReport.js qui rassemble aussi les captures
// de zone et affiche le rapport final.
// ════════════════════════════════════════════════════════════════

'use strict';

import { EventBus, EVENTS } from '../core/eventBus.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY,        { msg, type });
const _save   = ()               => globalThis.saveState?.();

// Cap maximum de rattrapage offline (12 heures)
const OFFLINE_CAP_MS = 12 * 60 * 60 * 1000;

// Seuil minimum pour déclencher un rattrapage (30 secondes)
const OFFLINE_MIN_MS = 30 * 1000;

// ── Helpers temporels ─────────────────────────────────────────────────────────

function _formatDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

// ── Catchup pension silencieux ────────────────────────────────────────────────
// Rejoue la logique de génération d'œufs et d'incubation sans notification UI
// en avançant les timestamps directement dans le state.

function _catchupPension(elapsedMs) {
  const state = globalThis.state;
  if (!state?.pension) return 0;

  const p = state.pension;
  const now = Date.now();
  let eggsGenerated = 0;

  const slots = p.slots || [];
  const hasPair = slots.length >= 2;

  // Avancer la génération d'œufs : combien d'œufs auraient dû être produits ?
  if (hasPair && p.eggAt) {
    while (p.eggAt <= now) {
      if (eggsGenerated > 10) break; // cap sécurité anti-spam
      if (eggsGenerated === 0) p.eggAt = now; // forcé prêt pour le prochain tick
      eggsGenerated++;
      break;
    }
  }

  // Avancer l'incubation : réduire hatchAt des œufs en cours
  const eggs = state.eggs || [];
  let eggsReady = 0;
  for (const egg of eggs) {
    if (!egg.incubating || egg.status === 'ready') continue;
    if (egg.hatchAt) {
      egg.hatchAt = Math.max(egg.hatchAt - elapsedMs, Date.now());
      if (egg.hatchAt <= now) {
        egg.status = 'ready';
        eggsReady++;
      }
    }
  }

  return eggsReady;
}

// ── Catchup XP équipes ────────────────────────────────────────────────────────
// Calcule l'XP passif accumulé (3 XP / 30s) pendant elapsedMs

function _catchupPassiveXP(elapsedMs) {
  const state = globalThis.state;
  if (!state) return 0;

  const ticksOf30s = Math.floor(elapsedMs / 30000);
  if (ticksOf30s <= 0) return 0;

  const xpPerTick = 3;
  const totalXP = ticksOf30s * xpPerTick;

  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
  if (teamIds.size === 0) return 0;

  for (const id of teamIds) {
    const p = state.pokemons?.find(pk => pk.id === id);
    if (p && globalThis.levelUpPokemon) globalThis.levelUpPokemon(p, totalXP);
  }
  return ticksOf30s;
}

// ── Catchup salle d'entraînement ──────────────────────────────────────────────
// Rejoue les ticks de combat (1 tick = 60s)

function _catchupTraining(elapsedMs) {
  const state = globalThis.state;
  const room = state?.trainingRoom;
  if (!room || room.pokemon.length < 2) return 0;

  const ticks = Math.min(Math.floor(elapsedMs / 60000), 60); // cap 60 ticks (1h)
  if (ticks <= 0) return 0;

  const fighters = room.pokemon
    .map(id => state.pokemons?.find(p => p.id === id))
    .filter(Boolean);
  if (fighters.length < 2) return 0;

  const roomLevel = room.level || 1;
  const mult = 1 + 0.25 * (roomLevel - 1);
  const winXP  = Math.round(25 * mult * 1.25 * ticks);
  const loseXP = Math.round(10 * mult * ticks);

  // Distribuer l'XP agrégée à tous les fighters (offline = pas de distinction W/L)
  const avgXP = Math.round((winXP + loseXP) / 2);
  for (const p of fighters) {
    globalThis.levelUpPokemon?.(p, avgXP);
    globalThis.tryAutoEvolution?.(p);
  }

  return ticks;
}

// ── Fonction principale ───────────────────────────────────────────────────────

/**
 * @param {object} [opts]
 * @param {boolean} [opts.silent=false] - Si true, n'affiche pas la notif
 *   classique (utile quand le rapport global prend le relais).
 * @returns {{ elapsed: number, eggsReady: number, trainingTicks: number, xpTicks: number } | null}
 */
function applyOfflineCatchup({ silent = false } = {}) {
  const state = globalThis.state;
  if (!state) return null;

  const now = Date.now();
  const savedAt = state._savedAt;
  if (!savedAt || typeof savedAt !== 'number') {
    // Pas encore de timestamp → marquer et partir
    state._savedAt = now;
    return null;
  }

  const rawElapsed = now - savedAt;
  if (rawElapsed < OFFLINE_MIN_MS) return null; // trop court, pas de rattrapage

  const elapsed = Math.min(rawElapsed, OFFLINE_CAP_MS);

  // Appliquer les rattrapages
  const eggsReady     = _catchupPension(elapsed);
  const trainingTicks = _catchupTraining(elapsed);
  const xpTicks       = _catchupPassiveXP(elapsed);

  // Mettre à jour _savedAt pour éviter un double-rattrapage
  state._savedAt = now;
  _save();

  // Alimenter le rapport global si actif
  const collecting = globalThis.OfflineReport?.isCollecting?.();
  if (collecting) {
    globalThis.OfflineReport.pushPensionResult({ eggsReady });
    globalThis.OfflineReport.pushTrainingTicks(trainingTicks);
    globalThis.OfflineReport.pushXPTicks(xpTicks);
  } else if (!silent && rawElapsed >= 60000) {
    // Fallback notif classique (boot initial, pas de collector actif)
    const parts = [];
    if (trainingTicks > 0) parts.push(`${trainingTicks} combats d'entraînement`);
    if (eggsReady > 0) parts.push(`${eggsReady} œuf${eggsReady > 1 ? 's' : ''} éclosable${eggsReady > 1 ? 's' : ''}`);
    const extra = parts.length > 0 ? ` — ${parts.join(', ')}` : '';
    const cappedStr = rawElapsed > OFFLINE_CAP_MS ? ` (plafonné à ${_formatDuration(OFFLINE_CAP_MS)})` : '';
    _notify(
      `⏰ Absent ${_formatDuration(rawElapsed)}${cappedStr}${extra}. Gains appliqués !`,
      'gold',
    );
  }

  // Rafraîchir l'UI si des œufs sont prêts
  if (eggsReady > 0 && globalThis.activeTab === 'tabPC') {
    globalThis.renderPCTab?.();
  }

  return { elapsed: rawElapsed, eggsReady, trainingTicks, xpTicks };
}

// ── Hooks de boot uniquement ─────────────────────────────────────────────────
// Le rattrapage de visibilitychange est orchestré par offlineReport.js.
// On garde uniquement le rattrapage initial au chargement (navigateur fermé/crash).
window.addEventListener('load', () => {
  setTimeout(() => applyOfflineCatchup(), 2000);
});

// ── Expose ────────────────────────────────────────────────────────────────────
globalThis.applyOfflineCatchup = applyOfflineCatchup;
export { applyOfflineCatchup };
