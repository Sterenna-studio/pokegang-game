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
const REP_STEAL_RATIO   = 0.05;      // 5% de la réputation snapshot
const RAID_GOLD_PER_REP = 200;       // gold par point de rép volée
const RAID_GOLD_MAX     = 1_000_000; // plafond d'or par raid (1M)
const RAID_COOLDOWN_MS  = 60 * 60 * 1000; // 1 heure par cible

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

function _pickDefaultAgent(state = getState()) {
  return [...(state.agents || [])]
    .sort((a, b) => {
      const levelDiff = (b.level ?? 1) - (a.level ?? 1);
      if (levelDiff !== 0) return levelDiff;
      return _agentPower(b, _agentTeamPower(b, state)) - _agentPower(a, _agentTeamPower(a, state));
    })[0] ?? null;
}

function _snapshotAgent(agent, state = getState(), { defaulted = false } = {}) {
  if (!agent) return null;
  const teamPower = _agentTeamPower(agent, state);
  return {
    id:        agent.id,
    name:      agent.name,
    sprite:    agent.spriteKey ?? '',
    stats:     { combat: agent.stats?.combat ?? 0 },
    level:     agent.level ?? 1,
    title:     agent.title ?? 'grunt',
    teamPower,
    power:     _agentPower(agent, teamPower),
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

function _hasPublishedDefense(defData) {
  return (defData?.defense_pokemon || []).filter(Boolean).length > 0 || !!defData?.defense_agent;
}

function _isDefaultDefense(defData) {
  if (!_hasPublishedDefense(defData)) return true;
  return (defData?.defense_pokemon || []).some(p => p?.defaulted) || !!defData?.defense_agent?.defaulted;
}

// ── Puissance de défense calculée depuis les données stockées ─────
function _defenderPower(defData) {
  let power = 0;
  for (const p of (defData.defense_pokemon || [])) {
    power += _defPokemonPower(p);
  }
  const agent = defData.defense_agent;
  if (agent) {
    power += agent.power ?? _agentPower(agent, agent.teamPower || 0);
  }
  return power;
}

// ── Puissance d'attaque du joueur local ───────────────────────────
// agentIds: array d'IDs d'agents sélectionnés (null = fallback agent auto)
function _attackerPower(agentIds = null) {
  const state = getState();
  const bossTeamPower = globalThis.getTeamPower?.(state.gang.bossTeam) ?? 0;
  const ps = state.playerStats;
  const combatStat = (ps?.baseStats?.combat ?? 10) + (ps?.allocatedStats?.combat ?? 0);
  let agentPower = 0;
  if (agentIds && agentIds.length > 0) {
    for (const id of agentIds) {
      const agent = state.agents?.find(a => a.id === id);
      if (agent) agentPower += globalThis.getAgentCombatPower?.(agent) ?? _agentPower(agent, _agentTeamPower(agent, state));
    }
  } else {
    const defaultAgent = _pickDefaultAgent(state);
    agentPower = defaultAgent
      ? (globalThis.getAgentCombatPower?.(defaultAgent) ?? _agentPower(defaultAgent, _agentTeamPower(defaultAgent, state)))
      : 0;
  }
  return bossTeamPower + agentPower + combatStat * 10;
}

export function getAttackerPower(agentIds = null) { return _attackerPower(agentIds); }

// ── Résolution PvP ────────────────────────────────────────────────
export function resolveRaidCombat(defData, agentIds = null) {
  const aPow = _attackerPower(agentIds);
  const dPow = _defenderPower(defData);
  if (aPow <= 0 && dPow <= 0) {
    return {
      attackerWin: false,
      attackerPower: 0,
      defenderPower: 0,
    };
  }
  const aRoll = aPow * (0.85 + Math.random() * 0.30);
  const dRoll = dPow * (0.85 + Math.random() * 0.30);
  return {
    attackerWin: aRoll >= dRoll,
    attackerPower: Math.round(aPow),
    defenderPower: Math.round(dPow),
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
    const stats = p.stats ?? globalThis.calculateStats?.(p) ?? { atk: 0, def: 0, spd: 0 };
    return { id: p.id, species_en: p.species_en, level: p.level, shiny: p.shiny ?? false, potential: p.potential ?? 1, stats: { atk: stats.atk, def: stats.def, spd: stats.spd }, defaulted: !hasExplicitTeam };
  });

  const explicitAgent = comp.defenseAgent
    ? state.agents.find(a => a.id === comp.defenseAgent)
    : null;
  const defaultAgent = explicitAgent ? null : _pickDefaultAgent(state);
  const agentPayload = _snapshotAgent(explicitAgent || defaultAgent, state, { defaulted: !explicitAgent && !!defaultAgent });

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

  const { attackerWin, attackerPower, defenderPower } = resolveRaidCombat(defData, agentIds);
  const noDefense = !_hasPublishedDefense(defData);
  const defaultDefense = _isDefaultDefense(defData);
  const snapRep  = defData.reputation_snapshot ?? 0;
  const baseRepDelta = Math.max(1, Math.floor(snapRep * REP_STEAL_RATIO));
  const repDelta = attackerWin ? baseRepDelta * (defaultDefense ? RAID_NO_DEFENSE_PENALTY_MULT : 1) : 0;
  const goldWon  = attackerWin ? Math.min(repDelta * RAID_GOLD_PER_REP, RAID_GOLD_MAX) : 0;
  const moneyPenalty = attackerWin ? 0 : RAID_PENALTY * (defaultDefense ? RAID_NO_DEFENSE_PENALTY_MULT : 1);
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
    state.gang.reputation = (state.gang.reputation ?? 0) + repDelta;
    state.gang.money      = (state.gang.money ?? 0) + goldWon;
    comp.wins.attack      = (comp.wins.attack ?? 0) + 1;
    const bonus = defaultDefense ? ` ×${RAID_NO_DEFENSE_PENALTY_MULT}` : '';
    notify(`Raid réussi${bonus} ! +${repDelta} rép. +${goldWon.toLocaleString('fr-FR')} ₽`, 'success');
  } else {
    state.gang.money  = Math.max(0, (state.gang.money ?? 0) - moneyPenalty);
    comp.losses.attack = (comp.losses.attack ?? 0) + 1;
    const reason = noDefense ? 'base vide' : 'défense trop forte';
    notify(`Raid échoué — ${reason}. -${moneyPenalty.toLocaleString('fr-FR')} ₽`, 'error');
  }

  saveState();
  return { attackerWin, attackerPower, defenderPower, repDelta, goldWon, noDefense, defaultDefense, moneyPenalty };
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

  let totalRepLost  = 0;
  let totalGoldGain = 0;
  let defWins       = 0;
  let defLosses     = 0;

  for (const raid of raids) {
    if (raid.result === 'attacker_win') {
      totalRepLost += raid.rep_delta ?? 0;
      defLosses++;
    } else {
      totalGoldGain += raid.money_penalty ?? 0;
      defWins++;
    }
  }

  state.gang.reputation    = Math.max(0, (state.gang.reputation ?? 0) - totalRepLost);
  state.gang.money         = (state.gang.money ?? 0) + totalGoldGain;
  comp.wins.defense        = (comp.wins.defense  ?? 0) + defWins;
  comp.losses.defense      = (comp.losses.defense ?? 0) + defLosses;
  comp.pendingRaids        = [];

  saveState();

  const parts = [];
  if (totalRepLost  > 0) parts.push(`-${totalRepLost} rép.`);
  if (totalGoldGain > 0) parts.push(`+${totalGoldGain.toLocaleString('fr-FR')} ₽`);
  if (parts.length) notify(`Raids acquittés : ${parts.join('  ')}`, totalRepLost > 0 ? 'error' : 'success');
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
};

