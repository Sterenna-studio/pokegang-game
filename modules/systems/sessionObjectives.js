import { EventBus, EVENTS } from '../core/eventBus.js';

import { getOnboardingObjective } from './onboardingFlow.js';

const _notify = (msg, type = '') => EventBus.emit(EVENTS.UI_NOTIFY,        { msg, type });
const _save   = ()               => globalThis.saveState?.();
const _t      = (fr, en)         => (globalThis.state?.lang === 'en' ? en : fr);
const _name   = value            => value?.[globalThis.state?.lang] ?? value?.en ?? value?.fr ?? '';

// ════════════════════════════════════════════════════════════════
// SESSION TRACKING + NEXT OBJECTIVE + BOOST HELPERS + ITEM SPRITE
// Extracted from app.js
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// SESSION TRACKING  (30-min idle = nouvelle session)
// ════════════════════════════════════════════════════════════════
const SESSION_KEY     = 'pg_session_baseline';
const SESSION_IDLE_MS = 30 * 60 * 1000;
let _sessionBaseline  = null;

function initSession() {
  const state = globalThis.state;
  const now = Date.now();
  const raw = localStorage.getItem(SESSION_KEY);
  if (raw) {
    try {
      const saved = JSON.parse(raw);
      if (now - saved.ts < SESSION_IDLE_MS) {
        _sessionBaseline = saved;
        // Migration : anciens saves de session sans caught/sold/startTs
        if (_sessionBaseline.caughtAtStart === undefined) _sessionBaseline.caughtAtStart = state.stats.totalCaught || 0;
        if (_sessionBaseline.soldAtStart   === undefined) _sessionBaseline.soldAtStart   = state.stats.totalSold   || 0;
        if (_sessionBaseline.startTs       === undefined) _sessionBaseline.startTs       = _sessionBaseline.ts;
        return; // session en cours — on la continue
      }
    } catch {}
  }
  // Nouvelle session
  _sessionBaseline = {
    ts:           now,
    startTs:      now, // immuable — contrairement à `ts`, jamais réécrit par _saveSessionActivity()
    money:        state.gang.money,
    rep:          state.gang.reputation,
    pokemon:      state.pokemons.length,
    shinies:      state.stats.shinyCaught    || 0,
    fights:       state.stats.totalFightsWon || 0,
    caughtAtStart: state.stats.totalCaught   || 0,
    soldAtStart:   state.stats.totalSold     || 0,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(_sessionBaseline));
}

function _saveSessionActivity() {
  if (_sessionBaseline) {
    _sessionBaseline.ts = Date.now();
    localStorage.setItem(SESSION_KEY, JSON.stringify(_sessionBaseline));
  }
}

function getSessionDelta() {
  const state = globalThis.state;
  if (!_sessionBaseline) return null;
  const dMoney  = state.gang.money            - _sessionBaseline.money;
  const dRep    = state.gang.reputation       - _sessionBaseline.rep;
  const dCaught = (state.stats.totalCaught   || 0) - (_sessionBaseline.caughtAtStart || 0);
  const dSold   = (state.stats.totalSold     || 0) - (_sessionBaseline.soldAtStart   || 0);
  const dShiny  = (state.stats.shinyCaught   || 0) - (_sessionBaseline.shinies       || 0);
  const dFights = (state.stats.totalFightsWon|| 0) - (_sessionBaseline.fights        || 0);

  const parts = [];
  const fmtPos = (v, icon) => {
    if (v <= 0) return null;
    const color = 'var(--green-dim,#4a8)';
    return `<span style="color:${color}">+${Math.abs(v) >= 1000 ? v.toLocaleString() : v} ${icon}</span>`;
  };
  const fmtAny = (v, icon) => {
    if (v === 0) return null;
    const sign  = v > 0 ? '+' : '';
    const color = v > 0 ? 'var(--green-dim,#4a8)' : 'var(--red)';
    return `<span style="color:${color}">${sign}${Math.abs(v) >= 1000 ? v.toLocaleString() : v} ${icon}</span>`;
  };

  if (dMoney  !== 0) parts.push(fmtAny(dMoney,  '₽'));
  if (dCaught  > 0)  parts.push(fmtPos(dCaught, '🎯'));
  if (dSold    > 0)  parts.push(`<span style="color:var(--text-dim)">-${dSold} 💱</span>`);
  if (dRep    !== 0) parts.push(fmtAny(dRep,    '⭐'));
  if (dShiny   > 0)  parts.push(fmtPos(dShiny,  '✨'));
  if (dFights  > 0)  parts.push(fmtPos(dFights, '⚔'));
  return parts.filter(Boolean).join(' · ');
}

// ── game_segment_completed ────────────────────────────────────────
// ATTENTION à ce que cet événement mesure : un SEGMENT de jeu, pas une
// session. Il part quand l'onglet passe en arrière-plan ou se ferme.
//
// Il s'appelait `session_completed` et se réarmait au retour sur l'onglet :
// un joueur qui alterne entre fenêtres en produisait plusieurs pour une seule
// session logique, ce qui rendait tout comptage de sessions faux — et
// silencieusement, puisque l'événement partait normalement à chaque fois.
// Renommé pour dire ce qu'il mesure vraiment. Pour compter des SESSIONS,
// utiliser `session_start` de GA4, qui applique la fenêtre d'inactivité
// standard ; ces segments servent à mesurer ce qui a été accompli entre deux
// mises en arrière-plan, et se cumulent sur une session GA4.
//
// visibilitychange couvre le mobile (bascule d'app) où pagehide ne part pas
// toujours ; pagehide couvre la fermeture d'onglet sur desktop. Le garde
// empêche le doublon quand les deux se déclenchent pour la même mise en
// arrière-plan.
let _segmentEndSent = false;
let _segmentIndex = 0;
function _sendSegmentCompleted() {
  const state = globalThis.state;
  if (_segmentEndSent || !_sessionBaseline || !state) return;
  _segmentEndSent = true;
  _segmentIndex += 1;
  globalThis.trackEvent?.('game_segment_completed', {
    // Rang du segment dans la session : 1 = premier passage en arrière-plan.
    // Permet de distinguer une vraie fin de session d'un simple aller-retour.
    segment_index: _segmentIndex,
    duration_s:  Math.round((Date.now() - _sessionBaseline.startTs) / 1000),
    money_delta: state.gang.money - _sessionBaseline.money,
    rep_delta:   state.gang.reputation - _sessionBaseline.rep,
    captured:    (state.stats.totalCaught    || 0) - (_sessionBaseline.caughtAtStart || 0),
    shinies:     (state.stats.shinyCaught    || 0) - (_sessionBaseline.shinies       || 0),
    battles_won: (state.stats.totalFightsWon || 0) - (_sessionBaseline.fights        || 0),
  });
}
document.addEventListener('visibilitychange', () => {
  // Le désarmement au retour est volontaire : les deltas sont cumulatifs
  // depuis le début de la session, donc chaque segment est un instantané de
  // la progression totale, pas un double comptage. C'est `segment_index` qui
  // permet de ne garder que le dernier si l'on veut un point par session.
  if (document.visibilityState === 'hidden') _sendSegmentCompleted();
  else _segmentEndSent = false;
});
window.addEventListener('pagehide', _sendSegmentCompleted);

// ════════════════════════════════════════════════════════════════
// NEXT OBJECTIVE
// ════════════════════════════════════════════════════════════════
function getNextObjective() {
  const state = globalThis.state;
  const onboardingObjective = getOnboardingObjective(state);
  if (onboardingObjective) return onboardingObjective;
  const pc     = state.pokemons.length;
  const team   = state.gang.bossTeam.length;
  const agents = state.agents.length;
  const money  = state.gang.money;
  const rep    = state.gang.reputation;
  const openZones = globalThis.openZones;
  const zones  = openZones ? openZones.size : 0;
  const dex    = Object.values(state.pokedex).filter(e => e.caught).length;

  // `id` : clé stable de l'objectif courant, indépendante de la langue et du
  // libellé. Sert au conseiller (modules/ui/advisor.js) pour choisir sa
  // réplique et pour savoir si le joueur a déjà entendu celle-ci.
  if (!state.gang.initialized)
    return { id: 'create_gang', text: _t('👋 Crée ton Gang pour commencer', '👋 Create your Gang to get started'), tab: null };
  if (pc === 0)
    return { id: 'first_catch', text: _t('⚡ Capture ton premier Pokémon', '⚡ Catch your first Pokémon'), detail: '→ Zones', tab: 'tabZones' };
  if (team === 0)
    return { id: 'boss_team_empty', text: _t('⚔ Place un Pokémon dans ton équipe Boss', '⚔ Add a Pokémon to your Boss team'), detail: '→ PC', tab: 'tabPC' };
  if (team < 3)
    return { id: 'boss_team_partial', text: _t('⚔ Complète ton équipe Boss', '⚔ Complete your Boss team'), detail: `${team}/6`, tab: 'tabPC' };
  if (agents === 0) {
    const cost = typeof globalThis.getAgentRecruitCost === 'function' ? globalThis.getAgentRecruitCost() : 10000;
    const progress = money >= cost ? _t('Prêt !', 'Ready!') : `₽${money.toLocaleString()}/${cost.toLocaleString()}`;
    return { id: 'first_agent', text: _t('👤 Recrute ton premier agent', '👤 Recruit your first agent'), detail: progress, tab: 'tabPC' };
  }
  // Rapport d'un agent qui encaisse trop — plus de défaites que de victoires,
  // sur un minimum de combats pour ne pas réagir à une simple malchance
  // ponctuelle. Le pire cas d'abord (le plus de défaites), pour rester une
  // seule remarque à la fois plutôt qu'un rapport par agent en difficulté.
  const strugglingAgent = state.agents
    .filter(a => (a.combatsLost || 0) >= 3 && (a.combatsLost || 0) > (a.combatsWon || 0))
    .sort((a, b) => (b.combatsLost || 0) - (a.combatsLost || 0))[0];
  if (strugglingAgent) {
    return {
      id: `agent_struggling:${strugglingAgent.id}`,
      text: _t(
        `⚠ ${strugglingAgent.name} perd trop souvent (${strugglingAgent.combatsLost} défaites)`,
        `⚠ ${strugglingAgent.name} keeps losing (${strugglingAgent.combatsLost} defeats)`,
      ),
      detail: _t('Équipe-le mieux', 'Give them a better team'),
      tab: 'tabAgents',
      agentName: strugglingAgent.name,
    };
  }
  // Zone suivante verrouillée
  const nextLocked = ZONES.find(z => !globalThis.isZoneUnlocked(z.id));
  if (nextLocked) {
    const req = nextLocked.repRequired || 0;
    if (req > 0)
      return {
        // L'id porte la zone visée : le conseiller doit se taire à nouveau
        // quand la cible change, pas rester muet sur tout le palier.
        id: `unlock_zone:${nextLocked.id}`,
        text: _t(`🗺 Débloquer ${_name(nextLocked)}`, `🗺 Unlock ${_name(nextLocked)}`),
        detail: _t(`Rép. ${rep}/${req}`, `Rep. ${rep}/${req}`),
        tab: 'tabZones',
        zoneName: _name(nextLocked),
      };
  }
  if (agents < 3)
    return { id: 'more_agents', text: _t(`👥 Avoir ${agents+1} agents`, `👥 Recruit ${agents+1} agents`), detail: `${agents}/3`, tab: 'tabAgents' };
  if (dex < 151)
    return {
      id: 'pokedex',
      text: `📖 Pokédex ${dex}/151`,
      detail: _t(`${151 - dex} espèces manquantes`, `${151 - dex} species missing`),
      tab: 'tabPokedex',
    };
  return { id: 'kanto_done', text: _t('🏆 Pokédex complet — Tu domines Kanto !', '🏆 Pokédex complete — You rule Kanto!'), detail: null, tab: null };
}

// ── Boost helpers ─────────────────────────────────────────────
function isBoostActive(boostId) {
  const state = globalThis.state;
  return (state.activeBoosts[boostId] || 0) > Date.now();
}
function boostRemaining(boostId) {
  const state = globalThis.state;
  const exp = state.activeBoosts[boostId] || 0;
  return Math.max(0, Math.ceil((exp - Date.now()) / 1000));
}
// Boost durations moved to data/gameplay-config-data.js

function activateBoost(boostId, { save = true } = {}) {
  const state = globalThis.state;
  if ((state.inventory[boostId] || 0) <= 0) return false;
  state.inventory[boostId]--;
  const duration = globalThis.BOOST_DURATIONS[boostId] || 90000;
  // Cumulate: extend from current expiry if already active, else from now
  const base = Math.max(Date.now(), state.activeBoosts[boostId] || 0);
  state.activeBoosts[boostId] = base + duration;
  if (save) _save();
  return true;
}

// Item and ball sprite URLs moved to data/assets-data.js
function itemSprite(id) {
  const url = globalThis.ITEM_SPRITE_URLS[id];
  return url
    ? `<img src="${url}" style="width:28px;height:28px;image-rendering:pixelated" onerror="this.style.display='none'">`
    : `<span style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim)">${id.toUpperCase().slice(0,3)}</span>`;
}

Object.assign(globalThis, {
  initSession,
  _saveSessionActivity,
  getSessionDelta,
  getNextObjective,
  isBoostActive,
  boostRemaining,
  activateBoost,
  itemSprite,
});

export {};
