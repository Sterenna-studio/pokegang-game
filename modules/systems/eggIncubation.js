'use strict';

// Agent-bound egg incubation. Each agent fetches one egg from the Daycare when
// it has none, incubates it for free, then drops it at the base once it is ready
// (the agent is free again; the player opens the egg whenever they like).

const HATCH_MILESTONES = [
  { eggs: 1000, multiplier: 1.35, key: 'legend' },
  { eggs: 500,  multiplier: 1.25, key: 'expert' },
  { eggs: 100,  multiplier: 1.15, key: 'veteran' },
  { eggs: 50,   multiplier: 1.10, key: 'adept' },
  { eggs: 10,   multiplier: 1.05, key: 'trained' },
  { eggs: 0,    multiplier: 1.00, key: 'rookie' },
];

const _t = (fr, en) => (globalThis.state?.lang === 'en' ? en : fr);

function getIncubationConfig(state = globalThis.state) {
  if (!state.pension) state.pension = {};
  if (!state.pension.eggIncubation || typeof state.pension.eggIncubation !== 'object') {
    state.pension.eggIncubation = {};
  }
  const cfg = state.pension.eggIncubation;
  if (!Array.isArray(cfg.priorityAgentIds)) cfg.priorityAgentIds = [];
  if (cfg.preferAvailable === undefined) cfg.preferAvailable = true;
  if (cfg.allowFallback === undefined) cfg.allowFallback = true;
  return cfg;
}

function isEggIncubating(egg) {
  return !!egg?.incubating;
}

function isAgentIncubationEligible(agent) {
  return !!agent && !agent.legacyLocked;
}

function getIncubationAgents(state = globalThis.state) {
  return (state?.agents || []).filter(isAgentIncubationEligible);
}

function getAgentHatchStats(agent) {
  if (!agent.eggStats || typeof agent.eggStats !== 'object') agent.eggStats = {};
  if (!Number.isFinite(agent.eggStats.hatched)) agent.eggStats.hatched = 0;
  return agent.eggStats;
}

function getAgentHatchMilestone(agent) {
  const hatched = getAgentHatchStats(agent).hatched || 0;
  return HATCH_MILESTONES.find(m => hatched >= m.eggs) || HATCH_MILESTONES[HATCH_MILESTONES.length - 1];
}

function getAgentHatchMultiplier(agent) {
  return getAgentHatchMilestone(agent).multiplier;
}

function getAgentHatchTitle(agent, state = globalThis.state) {
  const key = getAgentHatchMilestone(agent).key;
  const en = state?.lang === 'en';
  const labels = {
    rookie:  ['Référent en formation', 'Referent in training'],
    trained: ['Référent fiable', 'Reliable referent'],
    adept:   ['Spécialiste des œufs', 'Egg specialist'],
    veteran: ['Maître incubateur', 'Incubation master'],
    expert:  ['Expert éclosion', 'Hatching expert'],
    legend:  ['Légende des œufs', 'Egg legend'],
  };
  return en ? labels[key]?.[1] : labels[key]?.[0];
}

function getEggIncubationSummary(state = globalThis.state) {
  const eggs = state?.eggs || [];
  const capacity = getIncubationAgents(state).length;
  const active = eggs.filter(isEggIncubating);
  const waiting = eggs.filter(egg => !egg.incubating && egg.status !== 'ready');
  return {
    capacity,
    used: active.length,
    inProgress: active.length,
    ready: eggs.filter(egg => egg.status === 'ready').length,
    waiting: waiting.length,
    free: Math.max(0, capacity - active.length),
  };
}

function getEggIncubationAgent(egg, state = globalThis.state) {
  const id = egg?.incubationAgentId || egg?.agentId || null;
  if (!id) return null;
  return (state?.agents || []).find(agent => agent.id === id) || null;
}

function isAgentAvailableForPriority(agent) {
  return !!agent && !agent.resting && !agent.assignedZone;
}

function _orderedCandidates(state, cfg, usedAgentIds) {
  const agents = getIncubationAgents(state);
  const byId = new Map(agents.map(agent => [agent.id, agent]));
  const priority = (cfg.priorityAgentIds || [])
    .map(id => byId.get(id))
    .filter(agent => agent && !usedAgentIds.has(agent.id));
  const fallback = cfg.allowFallback === false
    ? []
    : agents.filter(agent => !usedAgentIds.has(agent.id) && !priority.includes(agent));
  const ordered = [...priority, ...fallback];
  if (!cfg.preferAvailable) return ordered;
  return [
    ...ordered.filter(isAgentAvailableForPriority),
    ...ordered.filter(agent => !isAgentAvailableForPriority(agent)),
  ];
}

function pickEggIncubationAgent(state = globalThis.state, egg = null) {
  const cfg = getIncubationConfig(state);
  const used = new Set((state.eggs || [])
    .filter(other => other !== egg && other.incubating && other.incubationAgentId)
    .map(other => other.incubationAgentId));
  return _orderedCandidates(state, cfg, used)[0] || null;
}

function _effectiveBaseMs(egg, baseMs) {
  const raw = Number(baseMs ?? egg?.hatchMs);
  return Number.isFinite(raw) && raw > 0 ? raw : 45 * 60 * 1000;
}

function startEggIncubation(egg, {
  state = globalThis.state,
  baseMs = null,
  now = Date.now(),
  forceExisting = false,
} = {}) {
  if (!egg || egg.incubating) return false;
  const summary = getEggIncubationSummary(state);
  if (!forceExisting && summary.free <= 0) return false;
  const agent = pickEggIncubationAgent(state, egg);
  if (!agent) return false;
  const multiplier = getAgentHatchMultiplier(agent);
  // Reprise après suspension : on repart du reliquat déjà exprimé en temps de
  // base, recalculé au multiplicateur du NOUVEAU référent (il peut différer).
  const remaining = Number(egg.incubationRemainingMs);
  const base = Number.isFinite(remaining) && remaining > 0 ? remaining : _effectiveBaseMs(egg, baseMs);
  const duration = Math.max(1000, Math.round(base / multiplier));
  egg.incubating = true;
  egg.status = egg.status === 'ready' ? undefined : egg.status;
  egg.incubatedAt = now;
  egg.hatchAt = now + duration;
  egg.hatchMs = _effectiveBaseMs(egg, baseMs);
  egg.incubationBaseMs = base;   // base de CE cycle (reliquat compris)
  delete egg.incubationRemainingMs;
  egg.incubationAgentId = agent.id;
  egg.incubationSpeedMultiplier = multiplier;
  return true;
}

// Un œuf dont plus aucun agent ne peut être référent (agents renvoyés, prestige)
// était laissé incubating:true avec incubationAgentId:null — il continuait son
// compte à rebours sans référent, personne n'était crédité à l'éclosion, et
// summary.used dépassait summary.capacity. On le remet en attente en gardant la
// progression déjà acquise, exprimée en temps de base (donc indépendante du
// multiplicateur de l'ancien référent).
function suspendEggIncubation(egg, now = Date.now()) {
  if (!egg?.incubating || egg.status === 'ready') return false;
  const mult    = Number(egg.incubationSpeedMultiplier) || 1;
  const started = Number(egg.incubatedAt);
  const total   = Number(egg.incubationBaseMs) > 0 ? Number(egg.incubationBaseMs) : _effectiveBaseMs(egg, null);
  const served  = Number.isFinite(started) ? Math.max(0, now - started) * mult : 0;
  egg.incubationRemainingMs = Math.max(1000, Math.round(total - served));
  egg.incubating = false;
  egg.incubationAgentId = null;
  delete egg.hatchAt;
  delete egg.incubatedAt;
  delete egg.incubationSpeedMultiplier;
  return true;
}

// Œufs arrivés à terme : l'agent les dépose à la base (status 'ready',
// incubating false) et redevient libre pour aller chercher le suivant. Le
// référent reste mémorisé sur l'œuf pour être crédité à l'ouverture. Normalise
// aussi les anciennes sauvegardes où un œuf prêt gardait son slot.
function markEggsReady(state = globalThis.state, now = Date.now()) {
  let delivered = 0;
  for (const egg of state?.eggs || []) {
    if (egg.status === 'ready') {
      egg.incubating = false;
      continue;
    }
    if (!egg.incubating || !egg.hatchAt || egg.hatchAt > now) continue;
    egg.status = 'ready';
    egg.incubating = false;
    egg.deliveredAt = now;
    delivered++;
  }
  return delivered;
}

function reconcileEggIncubationAssignments(state = globalThis.state) {
  let changed = false;
  const agents = getIncubationAgents(state);
  const existing = new Set(agents.map(agent => agent.id));
  const used = new Set();
  for (const egg of state?.eggs || []) {
    if (!egg.incubating) continue;
    const current = egg.incubationAgentId;
    if (current && existing.has(current) && !used.has(current)) {
      used.add(current);
      continue;
    }
    const next = _orderedCandidates(state, getIncubationConfig(state), used)[0] || null;
    if (next) {
      egg.incubationAgentId = next.id;
      egg.incubationSpeedMultiplier = getAgentHatchMultiplier(next);
      used.add(next.id);
    } else {
      suspendEggIncubation(egg);
    }
    changed = true;
  }
  return changed;
}

function recordEggHatched(egg, state = globalThis.state) {
  delete egg.incubationBaseMs;
  delete egg.incubationRemainingMs;
  const agent = getEggIncubationAgent(egg, state);
  if (!agent) return null;
  const stats = getAgentHatchStats(agent);
  stats.hatched += 1;
  stats.lastHatchedAt = Date.now();
  return agent;
}

function tryAutoIncubateWithAgents({
  state = globalThis.state,
  baseMsForEgg = null,
  now = Date.now(),
} = {}) {
  // La pension n'ouvre qu'avec l'Infirmière Joëlle : sans elle, les agents ne vont pas chercher d'œufs.
  if (!state?.purchases?.autoIncubator) return 0;
  reconcileEggIncubationAssignments(state);
  let started = 0;
  for (const egg of state.eggs || []) {
    if (egg.incubating || egg.status === 'ready') continue;
    const baseMs = typeof baseMsForEgg === 'function' ? baseMsForEgg(egg) : baseMsForEgg;
    if (!startEggIncubation(egg, { state, baseMs, now })) break;
    started++;
  }
  return started;
}

function setEggIncubationPriority(agentIds = [], state = globalThis.state) {
  const ids = new Set(getIncubationAgents(state).map(agent => agent.id));
  const cfg = getIncubationConfig(state);
  cfg.priorityAgentIds = [...new Set(agentIds)].filter(id => ids.has(id));
  return cfg.priorityAgentIds;
}

function getAgentEggDialogueLines(agent, state = globalThis.state) {
  const eggs = state?.eggs || [];
  const egg = eggs.find(e => e.incubating && e.incubationAgentId === agent?.id);
  const lines = [];
  if (!egg && eggs.some(e => e.status === 'ready' && e.incubationAgentId === agent?.id)) {
    lines.push(_t("J'ai déposé un œuf à la base, il n'attend que toi !", 'I left an egg at the base, it is waiting for you!'));
  }
  if (egg) {
    const remaining = egg.hatchAt ? egg.hatchAt - Date.now() : Infinity;
    if (remaining <= 5 * 60 * 1000) {
      lines.push(_t('Je crois que mon œuf va bientôt éclore !', 'I think my egg will hatch soon!'));
    } else if (remaining <= 15 * 60 * 1000) {
      lines.push(_t('Mon œuf commence à bouger…', 'My egg is starting to move…'));
    } else {
      lines.push(_t("J'ai récupéré un œuf à la pension.", 'I picked up an egg from the Daycare.'));
    }
  }
  const hatched = getAgentHatchStats(agent).hatched || 0;
  if (hatched >= 10) {
    lines.push(_t("Je m'y connais de mieux en mieux en œufs.", 'I am getting better and better with eggs.'));
  }
  return lines;
}

Object.assign(globalThis, {
  HATCH_MILESTONES,
  getIncubationConfig,
  getIncubationAgents,
  getAgentHatchStats,
  getAgentHatchMilestone,
  getAgentHatchMultiplier,
  getAgentHatchTitle,
  getEggIncubationSummary,
  getEggIncubationAgent,
  pickEggIncubationAgent,
  startEggIncubation,
  reconcileEggIncubationAssignments,
  markEggsReady,
  suspendEggIncubation,
  recordEggHatched,
  tryAutoIncubateWithAgents,
  setEggIncubationPriority,
  getAgentEggDialogueLines,
});

export {
  HATCH_MILESTONES,
  getIncubationConfig,
  getIncubationAgents,
  getAgentHatchStats,
  getAgentHatchMilestone,
  getAgentHatchMultiplier,
  getAgentHatchTitle,
  getEggIncubationSummary,
  getEggIncubationAgent,
  pickEggIncubationAgent,
  startEggIncubation,
  reconcileEggIncubationAssignments,
  markEggsReady,
  suspendEggIncubation,
  recordEggHatched,
  tryAutoIncubateWithAgents,
  setEggIncubationPriority,
  getAgentEggDialogueLines,
};
