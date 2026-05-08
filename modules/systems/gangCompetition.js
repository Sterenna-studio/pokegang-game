'use strict';

// ════════════════════════════════════════════════════════════════
//  GANG COMPETITION MODULE  —  PvP en ligne
//  Dépendances injectées via configureGangCompetition(ctx) :
//    getState, saveState, notify, slimPokemon, getSupabaseClient, getSupaSession
//  Dépendances globalThis :
//    state, TITLE_BONUSES, getPokemonPower, getTeamPower, playerStats
// ════════════════════════════════════════════════════════════════
//
// Tables Supabase requises : voir docs/supabase-setup.md et
// docs/supabase-schema.sql.
// ════════════════════════════════════════════════════════════════

const RAID_PENALTY      = 100_000;   // pokédollars perdus si raid échoue
const RAID_NO_DEFENSE_PENALTY_MULT = 2; // défense auto/vide : malus doublé pour le perdant
const REP_STEAL_RATIO   = 0.05;      // base de butin: 5% de la réputation snapshot, sans transfert de rép
const RAID_GOLD_PER_REP = 200;       // gold par point de base de butin
const RAID_GOLD_MAX     = 1_000_000; // plafond d'or par raid (1M)
const RAID_COOLDOWN_MS  = 60 * 60 * 1000; // 1 heure par cible
const PVP_AGENT_SLOTS   = 3;

let _ctx = {};

export function configureGangCompetition(ctx = {}) {
  _ctx = { ..._ctx, ...ctx };
}

function getState()           { return _ctx.getState?.() ?? globalThis.state ?? {}; }
function saveState()          { return _ctx.saveState?.(); }
function notify(msg, type)    { return _ctx.notify?.(msg, type) ?? globalThis.notify?.(msg, type); }
function slimPokemon(p)       { return _ctx.slimPokemon?.(p) ?? p; }
function getSupabaseClient()  { return _ctx.getSupabaseClient?.(); }
function getSupaSession()     { return _ctx.getSupaSession?.(); }

// ── Puissance d'un pokemon stocké (stats pré-calculées incluses) ──
function _defPokemonPower(p) {
  if (!p || !p.stats) return 0;
  return Math.round(p.stats.atk + p.stats.def + p.stats.spd);
}

function _agentPower(agent, teamPower = 0) {
  if (!agent) return 0;
  const TITLE_BONUSES = globalThis.TITLE_BONUSES ?? {};
  const stats = agent.stats ?? {};
  const bonus = 1 + (TITLE_BONUSES[agent.title] || 0);
  return Math.round(((stats.combat ?? 0) * 10 + (teamPower || 0)) * bonus);
}

function _agentTeamPower(agent, state = getState()) {
  let teamPower = 0;
  for (const pkId of (agent?.team || [])) {
    const p = state.pokemons?.find(pk => pk.id === pkId);
    if (p) teamPower += globalThis.getPokemonPower?.(p) ?? _defPokemonPower(p);
  }
  return teamPower;
}

function _sortedAgentsByPower(state = getState()) {
  return [...(state.agents || [])]
    .sort((a, b) => {
      const levelDiff = (b.level ?? 1) - (a.level ?? 1);
      if (levelDiff !== 0) return levelDiff;
      return _agentPower(b, _agentTeamPower(b, state)) - _agentPower(a, _agentTeamPower(a, state));
    });
}

function _pickDefaultAgents(count = PVP_AGENT_SLOTS, state = getState()) {
  return _sortedAgentsByPower(state).slice(0, count);
}

function _pickDefaultAgent(state = getState()) {
  return _pickDefaultAgents(1, state)[0] ?? null;
}

function _snapshotPokemon(p, { defaulted = false } = {}) {
  if (!p) return null;
  const stats = p.stats ?? globalThis.calculateStats?.(p) ?? { atk: 0, def: 0, spd: 0 };
  return {
    id: p.id,
    species_en: p.species_en,
    level: p.level,
    shiny: p.shiny ?? false,
    potential: p.potential ?? 1,
    stats: { atk: stats.atk, def: stats.def, spd: stats.spd },
    defaulted,
  };
}

function _snapshotAgent(agent, state = getState(), { defaulted = false } = {}) {
  if (!agent) return null;
  const teamPower = _agentTeamPower(agent, state);
  const team = (agent.team || [])
    .map(pkId => state.pokemons?.find(pk => pk.id === pkId))
    .map(p => _snapshotPokemon(p))
    .filter(Boolean);
  return {
    id:        agent.id,
    name:      agent.name,
    sprite:    agent.spriteKey ?? '',
    stats:     { combat: agent.stats?.combat ?? 0 },
    level:     agent.level ?? 1,
    title:     agent.title ?? 'grunt',
    teamPower,
    power:     _agentPower(agent, teamPower),
    team,
    defaulted,
  };
}

function _explicitDefenseIds(comp) {
  return (comp?.defenseTeam || []).filter(Boolean);
}

function _defaultDefenseIds(state = getState()) {
  return [...new Set((state.gang?.bossTeam || []).filter(Boolean))].slice(0, 6);
}

function _effectiveDefenseIds(state = getState()) {
  const explicit = _explicitDefenseIds(state.gang?.competition);
  return explicit.length ? explicit.slice(0, 6) : _defaultDefenseIds(state);
}

function _explicitDefenseAgentIds(comp) {
  const agents = Array.isArray(comp?.defenseAgents) ? comp.defenseAgents : [];
  if (agents.some(Boolean)) return agents.filter(Boolean).slice(0, PVP_AGENT_SLOTS);
  return comp?.defenseAgent ? [comp.defenseAgent] : [];
}

function _effectiveDefenseAgentIds(state = getState()) {
  const comp = state.gang?.competition ?? {};
  const manual = Array.from({ length: PVP_AGENT_SLOTS }, (_, idx) =>
    Array.isArray(comp.defenseAgents) ? comp.defenseAgents[idx] ?? null : null,
  );
  if (!manual.some(Boolean) && comp.defenseAgent) manual[0] = comp.defenseAgent;

  const used = new Set(manual.filter(Boolean));
  const fallback = _pickDefaultAgents(PVP_AGENT_SLOTS, state)
    .map(a => a.id)
    .filter(id => !used.has(id));

  return manual
    .map(id => id || fallback.shift() || null)
    .filter(Boolean)
    .slice(0, PVP_AGENT_SLOTS);
}

function _defenseAgentsFromData(defData) {
  const raw = defData?.defense_agent;
  if (Array.isArray(raw)) return raw.filter(Boolean).slice(0, PVP_AGENT_SLOTS);
  return raw ? [raw] : [];
}

function _hasPublishedDefense(defData) {
  return (defData?.defense_pokemon || []).filter(Boolean).length > 0 || _defenseAgentsFromData(defData).length > 0;
}

function _isDefaultDefense(defData) {
  if (!_hasPublishedDefense(defData)) return true;
  return (defData?.defense_pokemon || []).some(p => p?.defaulted) || _defenseAgentsFromData(defData).some(a => a?.defaulted);
}

// ── Puissance de défense calculée depuis les données stockées ─────
function _defensePokemonPower(defData) {
  let power = 0;
  for (const p of (defData?.defense_pokemon || [])) {
    power += _defPokemonPower(p);
  }
  return power;
}

function _defenderPower(defData) {
  let power = _defensePokemonPower(defData);
  for (const agent of _defenseAgentsFromData(defData)) {
    power += agent.power ?? _agentPower(agent, agent.teamPower || 0);
  }
  return power;
}

function _attackAgentSnapshots(agentIds = null, state = getState()) {
  const ids = Array.isArray(agentIds) ? agentIds.filter(Boolean).slice(0, PVP_AGENT_SLOTS) : [];
  const agents = ids.length
    ? ids.map(id => state.agents?.find(a => a.id === id)).filter(Boolean)
    : _pickDefaultAgents(PVP_AGENT_SLOTS, state);
  return agents.map(agent => _snapshotAgent(agent, state)).filter(Boolean);
}

// ── Puissance d'attaque du joueur local ───────────────────────────
// agentIds: array d'IDs d'agents sélectionnés (null = fallback agent auto)
function _attackerPower(agentIds = null) {
  const state = getState();
  const bossTeamPower = globalThis.getTeamPower?.(state.gang.bossTeam) ?? 0;
  const ps = state.playerStats;
  const combatStat = (ps?.baseStats?.combat ?? 10) + (ps?.allocatedStats?.combat ?? 0);
  const agentPower = _attackAgentSnapshots(agentIds, state).reduce((sum, agent) => sum + (agent.power ?? 0), 0);
  return bossTeamPower + agentPower + combatStat * 10;
}

export function getAttackerPower(agentIds = null) { return _attackerPower(agentIds); }

function _raidPreview(defData, agentIds = null) {
  const attackerPower = Math.round(_attackerPower(agentIds));
  const defenderPower = Math.round(_defenderPower(defData));
  const noDefense = !_hasPublishedDefense(defData);
  const defaultDefense = _isDefaultDefense(defData);
  const snapRep = defData?.reputation_snapshot ?? 0;
  const goldBasis = Math.max(1, Math.floor(snapRep * REP_STEAL_RATIO));
  const goldOnWin = Math.min(goldBasis * (defaultDefense ? RAID_NO_DEFENSE_PENALTY_MULT : 1) * RAID_GOLD_PER_REP, RAID_GOLD_MAX);
  const moneyPenaltyOnLoss = RAID_PENALTY * (defaultDefense ? RAID_NO_DEFENSE_PENALTY_MULT : 1);

  return {
    attackerPower,
    defenderPower,
    noDefense,
    defaultDefense,
    goldBasis,
    repDeltaOnWin: 0,
    goldOnWin,
    moneyPenaltyOnLoss,
  };
}

export function getRaidPreview(defData, agentIds = null) { return _raidPreview(defData, agentIds); }

function _rollCombat(attackerPower, defenderPower) {
  if (attackerPower <= 0 && defenderPower <= 0) return { attackerWin: false, attackerRoll: 0, defenderRoll: 0 };
  if (defenderPower <= 0) return { attackerWin: attackerPower > 0, attackerRoll: attackerPower, defenderRoll: 0 };
  if (attackerPower <= 0) return { attackerWin: false, attackerRoll: 0, defenderRoll: defenderPower };

  const attackerRoll = attackerPower * (0.85 + Math.random() * 0.30);
  const defenderRoll = defenderPower * (0.85 + Math.random() * 0.30);
  return { attackerWin: attackerRoll >= defenderRoll, attackerRoll, defenderRoll };
}

function _agentBattlePower(agent) {
  return Math.round(agent?.power ?? _agentPower(agent, agent?.teamPower || 0));
}

function _agentSummary(agent) {
  return {
    id: agent?.id ?? null,
    name: agent?.name ?? 'Agent',
    sprite: agent?.sprite ?? '',
    team: (agent?.team || []).map(p => ({
      species_en: p.species_en,
      level: p.level,
      shiny: p.shiny ?? false,
    })),
  };
}

function _resolveAgentDuel(attacker, defender) {
  const attackerPower = _agentBattlePower(attacker);
  const defenderPower = _agentBattlePower(defender);
  const rolled = _rollCombat(attackerPower, defenderPower);
  return {
    type: 'agent_duel',
    attacker: _agentSummary(attacker),
    defender: _agentSummary(defender),
    attackerPower,
    defenderPower,
    attackerWin: rolled.attackerWin,
  };
}

function _bossAttackPower(state, survivingAgents) {
  const bossTeamPower = globalThis.getTeamPower?.(state.gang.bossTeam) ?? 0;
  const ps = state.playerStats;
  const combatStat = (ps?.baseStats?.combat ?? 10) + (ps?.allocatedStats?.combat ?? 0);
  const agentPower = survivingAgents.reduce((sum, agent) => sum + _agentBattlePower(agent), 0);
  return Math.round(bossTeamPower + agentPower + combatStat * 10);
}

// ── Résolution PvP ────────────────────────────────────────────────
export function resolveRaidCombat(defData, agentIds = null) {
  const state = getState();
  const attackers = _attackAgentSnapshots(agentIds, state);
  const defenders = _defenseAgentsFromData(defData);
  const duels = [];
  let attackerIndex = 0;
  let defenderIndex = 0;

  while (attackerIndex < attackers.length && defenderIndex < defenders.length) {
    const duel = _resolveAgentDuel(attackers[attackerIndex], defenders[defenderIndex]);
    duels.push(duel);
    if (duel.attackerWin) defenderIndex++;
    else attackerIndex++;
  }

  const survivingAttackers = attackers.slice(attackerIndex);
  let finalBattle = null;
  let attackerWin = false;

  if (defenderIndex >= defenders.length) {
    const finalAttackerPower = _bossAttackPower(state, survivingAttackers);
    const finalDefenderPower = Math.round(_defensePokemonPower(defData));
    const rolled = _rollCombat(finalAttackerPower, finalDefenderPower);
    attackerWin = rolled.attackerWin;
    finalBattle = {
      type: 'boss_battle',
      attackerPower: finalAttackerPower,
      defenderPower: finalDefenderPower,
      attackerWin,
      survivingAttackers: survivingAttackers.map(_agentSummary),
    };
  } else {
    finalBattle = {
      type: 'boss_battle',
      skipped: true,
      reason: 'attackers_defeated',
      remainingDefenders: defenders.slice(defenderIndex).map(_agentSummary),
    };
  }

  return {
    attackerWin,
    attackerPower: Math.round(_attackerPower(agentIds)),
    defenderPower: Math.round(_defenderPower(defData)),
    duels,
    finalBattle,
    remainingAttackers: survivingAttackers.map(_agentSummary),
  };
}

// ── Snapshot de la défense locale pour publication ────────────────
export function buildDefensePayload() {
  const state = getState();
  const comp  = state.gang.competition;

  const hasExplicitTeam = _explicitDefenseIds(comp).length > 0;
  const defenseIds = _effectiveDefenseIds(state);
  const pokemons = defenseIds.map(id => {
    if (!id) return null;
    const p = state.pokemons.find(pk => pk.id === id);
    if (!p) return null;
    return _snapshotPokemon(p, { defaulted: !hasExplicitTeam });
  });

  const explicitAgentIds = _explicitDefenseAgentIds(comp);
  const explicitAgentSet = new Set(explicitAgentIds);
  const agentPayload = _effectiveDefenseAgentIds(state)
    .map(id => {
      const agent = state.agents.find(a => a.id === id);
      return _snapshotAgent(agent, state, { defaulted: !explicitAgentSet.has(id) });
    })
    .filter(Boolean);

  return {
    gang_name:           state.gang.name,
    boss_name:           state.gang.bossName,
    boss_sprite:         state.gang.bossSprite ?? '',
    boss_title:          [state.gang.titleA, state.gang.titleB].filter(Boolean).join(' · ') || null,
    reputation_snapshot: state.gang.reputation,
    defense_pokemon:     pokemons,
    defense_agent:       agentPayload,
    defense_zone:        comp.defenseZone,
  };
}

// ── Publier la défense ────────────────────────────────────────────
export async function publishDefense() {
  const db      = getSupabaseClient();
  const session = getSupaSession();
  if (!db || !session) { notify('Connexion Supabase requise pour publier.', 'error'); return false; }

  const state   = getState();
  const comp    = state.gang.competition;

  const payload = buildDefensePayload();
  const hasAny  = _hasPublishedDefense(payload);
  try {
    const { error } = await db.from('gang_defenses').upsert({
      user_id:   session.user.id,
      ...payload,
      updated_at: new Date().toISOString(),
    });
    if (error) { notify('Erreur publication : ' + error.message, 'error'); return false; }
    comp.defensePublished = true;
    saveState();
    notify(hasAny ? 'Défense publiée !' : 'Base publiée sans défense.', hasAny ? 'success' : 'gold');
    return true;
  } catch (e) {
    notify('Erreur réseau lors de la publication.', 'error');
    return false;
  }
}

// ── Charger la liste des gangs adverses ──────────────────────────
export async function loadGangList() {
  const db      = getSupabaseClient();
  const session = getSupaSession();
  if (!db) return [];

  const myId = session?.user?.id ?? null;
  try {
    let q = db
      .from('gang_defenses')
      .select('user_id, gang_name, boss_name, boss_sprite, boss_title, reputation_snapshot, defense_pokemon, defense_agent, defense_zone, updated_at')
      .order('reputation_snapshot', { ascending: false })
      .limit(20);
    const { data, error } = await q;
    if (error || !data) return [];
    return myId ? data.filter(r => r.user_id !== myId) : data;
  } catch {
    return [];
  }
}

// ── Exécuter un raid ──────────────────────────────────────────────
export async function executeRaid(defData, agentIds = null) {
  const db      = getSupabaseClient();
  const session = getSupaSession();
  if (!db || !session) { notify('Connexion requise pour raider.', 'error'); return null; }

  const state = getState();
  const comp  = state.gang.competition;

  // Vérifier cooldown
  const lastRaid = comp.raidCooldowns?.[defData.user_id] ?? 0;
  if (Date.now() - lastRaid < RAID_COOLDOWN_MS) {
    const remaining = Math.ceil((RAID_COOLDOWN_MS - (Date.now() - lastRaid)) / 60_000);
    notify(`Cooldown actif — encore ${remaining} min avant de raider ce gang.`, 'error');
    return null;
  }

  // Vérifier raids en attente
  if ((comp.pendingRaids ?? []).length > 0) {
    notify('Consultez d\'abord les raids subis avant d\'attaquer.', 'error');
    return null;
  }

  const combatResult = resolveRaidCombat(defData, agentIds);
  const { attackerWin, attackerPower, defenderPower } = combatResult;
  const preview = _raidPreview(defData, agentIds);
  const noDefense = preview.noDefense;
  const defaultDefense = preview.defaultDefense;
  const snapRep  = defData.reputation_snapshot ?? 0;
  const repDelta = 0;
  const goldWon  = attackerWin ? preview.goldOnWin : 0;
  const moneyPenalty = attackerWin ? 0 : preview.moneyPenaltyOnLoss;
  const result   = attackerWin ? 'attacker_win' : 'defender_win';

  try {
    const { error } = await db.from('gang_raids').insert({
      attacker_id:       session.user.id,
      defender_id:       defData.user_id,
      attacker_gang:     state.gang.name,
      defender_gang:     defData.gang_name,
      result,
      rep_delta:         repDelta,
      money_penalty:     moneyPenalty,
      defender_snap_rep: snapRep,
    });
    if (error) { notify('Erreur enregistrement raid : ' + error.message, 'error'); return null; }
  } catch {
    notify('Erreur réseau lors du raid.', 'error');
    return null;
  }

  // Mettre à jour le cooldown
  if (!comp.raidCooldowns) comp.raidCooldowns = {};
  comp.raidCooldowns[defData.user_id] = Date.now();

  // Appliquer résultat immédiat côté attaquant
  if (attackerWin) {
    state.gang.money      = (state.gang.money ?? 0) + goldWon;
    comp.wins.attack      = (comp.wins.attack ?? 0) + 1;
    const bonus = defaultDefense ? ` ×${RAID_NO_DEFENSE_PENALTY_MULT}` : '';
    notify(`Raid réussi${bonus} ! +${goldWon.toLocaleString('fr-FR')} ₽`, 'success');
  } else {
    state.gang.money  = Math.max(0, (state.gang.money ?? 0) - moneyPenalty);
    comp.losses.attack = (comp.losses.attack ?? 0) + 1;
    const reason = noDefense ? 'base vide' : 'défense trop forte';
    notify(`Raid échoué — ${reason}. -${moneyPenalty.toLocaleString('fr-FR')} ₽`, 'error');
  }

  saveState();
  return { ...combatResult, repDelta, goldWon, noDefense, defaultDefense, moneyPenalty };
}

// ── Charger les raids subis non vus ──────────────────────────────
export async function loadPendingRaids() {
  const db      = getSupabaseClient();
  const session = getSupaSession();
  if (!db || !session) return [];

  try {
    const { data, error } = await db
      .from('gang_raids')
      .select('id, attacker_gang, result, rep_delta, money_penalty, defender_snap_rep, executed_at')
      .eq('defender_id', session.user.id)
      .eq('seen_by_defender', false)
      .order('executed_at', { ascending: false });
    if (error || !data) return [];
    const state = getState();
    state.gang.competition.pendingRaids = data;
    saveState();
    return data;
  } catch {
    return [];
  }
}

// ── Reconnaître les raids (appliquer malus + crédits) ────────────
export async function acknowledgeRaids() {
  const db      = getSupabaseClient();
  const session = getSupaSession();
  if (!db || !session) return;

  const state = getState();
  const comp  = state.gang.competition;
  const raids = comp.pendingRaids ?? [];
  if (!raids.length) return;

  const ids = raids.map(r => r.id);
  try {
    const { error } = await db.from('gang_raids').update({ seen_by_defender: true }).in('id', ids);
    if (error) { notify('Erreur acquittement raids : ' + error.message, 'error'); return; }
  } catch {
    notify('Erreur réseau lors de l\'acquittement.', 'error');
    return;
  }

  let totalGoldGain = 0;
  let defWins       = 0;
  let defLosses     = 0;

  for (const raid of raids) {
    if (raid.result === 'attacker_win') {
      defLosses++;
    } else {
      totalGoldGain += raid.money_penalty ?? 0;
      defWins++;
    }
  }

  state.gang.money         = (state.gang.money ?? 0) + totalGoldGain;
  comp.wins.defense        = (comp.wins.defense  ?? 0) + defWins;
  comp.losses.defense      = (comp.losses.defense ?? 0) + defLosses;
  comp.pendingRaids        = [];

  saveState();

  const parts = [];
  if (totalGoldGain > 0) parts.push(`+${totalGoldGain.toLocaleString('fr-FR')} ₽`);
  if (parts.length) notify(`Raids acquittés : ${parts.join('  ')}`, 'success');
  else notify('Raids acquittés.', 'success');
}

// ── Cooldown restant pour une cible (ms) ─────────────────────────
export function getRaidCooldownMs(targetUserId) {
  const state   = getState();
  const last    = state.gang.competition?.raidCooldowns?.[targetUserId] ?? 0;
  return Math.max(0, RAID_COOLDOWN_MS - (Date.now() - last));
}

export {
  RAID_PENALTY,
  RAID_NO_DEFENSE_PENALTY_MULT,
  REP_STEAL_RATIO,
  RAID_GOLD_PER_REP,
  RAID_GOLD_MAX,
  RAID_COOLDOWN_MS,
  PVP_AGENT_SLOTS,
};
