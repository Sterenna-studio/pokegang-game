// ════════════════════════════════════════════════════════════════
// modules/systems/offlineCatchup.js
// Offline / background idle catchup system
//
// Calcule le temps écoulé depuis la dernière sauvegarde
// et rejoue les ticks idle proportionnellement:
//   - Pension (génération d'œufs + incubation)
//   - Training room (XP)
//   - XP passif équipes
// ════════════════════════════════════════════════════════════════

'use strict';

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
  const EGG_GEN_MS = globalThis.EGG_GEN_MS || 5 * 60 * 1000;

  // Avancer la génération d'œufs : combien d'œufs auraient dû être produits ?
  if (hasPair && p.eggAt) {
    const simulatedNow = p.eggAt + elapsedMs;
    // Chaque cycle = EGG_GEN_MS; on compte les cycles complets
    while (p.eggAt <= now) {
      if (eggsGenerated > 10) break; // cap sécurité anti-spam
      // Appeler pensionTick directement avec un now simulé est complexe ;
      // à la place, on avance juste eggAt pour que le prochain tick réel
      // voie que c'est "prêt" et génère les œufs normalement.
      // On ne génère qu'un seul œuf max en offline pour éviter le spam.
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

  let leveled = false;
  for (const id of teamIds) {
    const p = state.pokemons?.find(pk => pk.id === id);
    if (p && globalThis.levelUpPokemon) {
      globalThis.levelUpPokemon(p, totalXP);
      leveled = true;
    }
  }
  return leveled ? totalXP : 0;
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

function applyOfflineCatchup() {
  const state = globalThis.state;
  if (!state) return;

  const now = Date.now();
  const savedAt = state._savedAt;
  if (!savedAt || typeof savedAt !== 'number') {
    // Pas encore de timestamp → marquer et partir
    state._savedAt = now;
    return;
  }

  const rawElapsed = now - savedAt;
  if (rawElapsed < OFFLINE_MIN_MS) return; // trop court, pas de rattrapage

  const elapsed = Math.min(rawElapsed, OFFLINE_CAP_MS);

  // Appliquer les rattrapages
  const eggsReady  = _catchupPension(elapsed);
  const trainingTicks = _catchupTraining(elapsed);
  _catchupPassiveXP(elapsed);

  // Mettre à jour _savedAt pour éviter un double-rattrapage
  state._savedAt = now;
  globalThis.saveState?.();

  // Notification uniquement si l'absence est significative (> 1 min)
  if (rawElapsed >= 60000) {
    const parts = [];
    if (trainingTicks > 0) parts.push(`${trainingTicks} combats d'entraînement`);
    if (eggsReady > 0) parts.push(`${eggsReady} œuf${eggsReady > 1 ? 's' : ''} éclosable${eggsReady > 1 ? 's' : ''}`);
    const extra = parts.length > 0 ? ` — ${parts.join(', ')}` : '';
    const cappedStr = rawElapsed > OFFLINE_CAP_MS ? ` (plafonné à ${_formatDuration(OFFLINE_CAP_MS)})` : '';
    globalThis.notify?.(
      `⏰ Absent ${_formatDuration(rawElapsed)}${cappedStr}${extra}. Gains appliqués !`,
      'gold',
    );
  }

  // Rafraîchir l'UI si des œufs sont prêts
  if (eggsReady > 0 && globalThis.activeTab === 'tabPC') {
    globalThis.renderPCTab?.();
  }
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

// Rattrapage au retour de l'onglet en foreground
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // Petit délai pour laisser le state être chargé si nécessaire
    setTimeout(applyOfflineCatchup, 500);
  }
});

// Rattrapage au chargement initial (cas navigateur fermé/crash)
window.addEventListener('load', () => {
  // Déclenché après loadState() via le flow normal de app.js
  setTimeout(applyOfflineCatchup, 2000);
});

// ── Expose ────────────────────────────────────────────────────────────────────
globalThis.applyOfflineCatchup = applyOfflineCatchup;
export { applyOfflineCatchup };
