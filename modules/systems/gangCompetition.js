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
const REP_STEAL_RATIO   = 0.05;      // 5% de la réputation snapshot
const RAID_GOLD_PER_REP = 200;       // gold par point de rép volée
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

// ── Puissance de défense calculée depuis les données stockées ─────
function _defenderPower(defData) {
  let power = 0;
  for (const p of (defData.defense_pokemon || [])) {
    power += _defPokemonPower(p);
  }
  const agent = defData.defense_agent;
  if (agent) {
    const TITLE_BONUSES = globalThis.TITLE_BONUSES ?? {};
    const bonus = 1 + (TITLE_BONUSES[agent.title] || 0);
    power += Math.round((agent.stats.combat * 10 + (agent.teamPower || 0)) * bonus);
  }
  return power;
}

// ── Puissance d'attaque du joueur local ───────────────────────────
function _attackerPower() {
  const state = getState();
  const bossTeamPower = globalThis.getTeamPower?.(state.gang.bossTeam) ?? 0;
  const ps = state.playerStats;
  const combatStat = (ps?.baseStats?.combat ?? 10) + (ps?.allocatedStats?.combat ?? 0);
  return bossTeamPower + combatStat * 10;
}

// ── Résolution PvP ────────────────────────────────────────────────
export function resolveRaidCombat(defData) {
  const aPow = _attackerPower();
  const dPow = _defenderPower(defData);
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
  const TITLE_BONUSES = globalThis.TITLE_BONUSES ?? {};

  const pokemons = comp.defenseTeam.map(id => {
    if (!id) return null;
    const p = state.pokemons.find(pk => pk.id === id);
    if (!p) return null;
    const stats = p.stats ?? globalThis.calculateStats?.(p) ?? { atk: 0, def: 0, spd: 0 };
    return { id: p.id, species_en: p.species_en, level: p.level, shiny: p.shiny ?? false, potential: p.potential ?? 1, stats: { atk: stats.atk, def: stats.def, spd: stats.spd } };
  });

  let agentPayload = null;
  if (comp.defenseAgent) {
    const agent = state.agents.find(a => a.id === comp.defenseAgent);
    if (agent) {
      let teamPower = 0;
      for (const pkId of (agent.team || [])) {
        const p = state.pokemons.find(pk => pk.id === pkId);
        if (p) teamPower += globalThis.getPokemonPower?.(p) ?? 0;
      }
      const bonus = 1 + (TITLE_BONUSES[agent.title] || 0);
      agentPayload = {
        id:        agent.id,
        name:      agent.name,
        sprite:    agent.spriteKey ?? '',
        stats:     { combat: agent.stats?.combat ?? 0 },
        level:     agent.level ?? 1,
        title:     agent.title ?? 'grunt',
        teamPower,
        power:     Math.round((agent.stats?.combat * 10 + teamPower) * bonus),
      };
    }
  }

  return {
    gang_name:           state.gang.name,
    boss_name:           state.gang.bossName,
    boss_sprite:         state.gang.bossSprite ?? '',
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
  const hasAny  = comp.defenseTeam.some(id => id !== null);
  if (!hasAny) { notify('Assigne au moins un Pokémon à la défense.', 'error'); return false; }

  const payload = buildDefensePayload();
  try {
    const { error } = await db.from('gang_defenses').upsert({
      user_id:   session.user.id,
      ...payload,
      updated_at: new Date().toISOString(),
    });
    if (error) { notify('Erreur publication : ' + error.message, 'error'); return false; }
    comp.defensePublished = true;
    saveState();
    notify('Défense publiée !', 'success');
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
      .select('user_id, gang_name, boss_name, boss_sprite, reputation_snapshot, defense_pokemon, defense_agent, defense_zone, updated_at')
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
export async function executeRaid(defData) {
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

  const { attackerWin, attackerPower, defenderPower } = resolveRaidCombat(defData);
  const snapRep  = defData.reputation_snapshot ?? 0;
  const repDelta = attackerWin ? Math.max(1, Math.floor(snapRep * REP_STEAL_RATIO)) : 0;
  const goldWon  = attackerWin ? repDelta * RAID_GOLD_PER_REP : 0;
  const result   = attackerWin ? 'attacker_win' : 'defender_win';

  try {
    const { error } = await db.from('gang_raids').insert({
      attacker_id:       session.user.id,
      defender_id:       defData.user_id,
      attacker_gang:     state.gang.name,
      defender_gang:     defData.gang_name,
      result,
      rep_delta:         repDelta,
      money_penalty:     attackerWin ? 0 : RAID_PENALTY,
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
    notify(`Raid réussi ! +${repDelta} rép. +${goldWon.toLocaleString('fr-FR')} ₽`, 'success');
  } else {
    state.gang.money  = Math.max(0, (state.gang.money ?? 0) - RAID_PENALTY);
    comp.losses.attack = (comp.losses.attack ?? 0) + 1;
    notify(`Raid échoué — défense trop forte. -${RAID_PENALTY.toLocaleString('fr-FR')} ₽`, 'error');
  }

  saveState();
  return { attackerWin, attackerPower, defenderPower, repDelta, goldWon };
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

export { RAID_PENALTY, REP_STEAL_RATIO, RAID_GOLD_PER_REP, RAID_COOLDOWN_MS };
