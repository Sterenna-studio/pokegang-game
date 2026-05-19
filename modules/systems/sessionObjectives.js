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
        // Migration : anciens saves de session sans caught/sold
        if (_sessionBaseline.caughtAtStart === undefined) _sessionBaseline.caughtAtStart = state.stats.totalCaught || 0;
        if (_sessionBaseline.soldAtStart   === undefined) _sessionBaseline.soldAtStart   = state.stats.totalSold   || 0;
        return; // session en cours — on la continue
      }
    } catch {}
  }
  // Nouvelle session
  _sessionBaseline = {
    ts:           now,
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

// ════════════════════════════════════════════════════════════════
// NEXT OBJECTIVE
// ════════════════════════════════════════════════════════════════
function getNextObjective() {
  const state = globalThis.state;
  const pc     = state.pokemons.length;
  const team   = state.gang.bossTeam.length;
  const agents = state.agents.length;
  const money  = state.gang.money;
  const rep    = state.gang.reputation;
  const openZones = globalThis.openZones;
  const zones  = openZones ? openZones.size : 0;
  const dex    = Object.values(state.pokedex).filter(e => e.caught).length;

  if (!state.gang.initialized)
    return { text: '👋 Crée ton Gang pour commencer', tab: null };
  if (pc === 0)
    return { text: '⚡ Capture ton premier Pokémon', detail: '→ Zones', tab: 'tabZones' };
  if (team === 0)
    return { text: '⚔ Place un Pokémon dans ton équipe Boss', detail: '→ PC', tab: 'tabPC' };
  if (team < 3)
    return { text: `⚔ Complète ton équipe Boss`, detail: `${team}/6`, tab: 'tabPC' };
  if (agents === 0) {
    const cost = typeof globalThis.getAgentRecruitCost === 'function' ? globalThis.getAgentRecruitCost() : 10000;
    const progress = money >= cost ? 'Prêt !' : `₽${money.toLocaleString()}/${cost.toLocaleString()}`;
    return { text: '👤 Recrute ton premier agent', detail: progress, tab: 'tabPC' };
  }
  // Zone suivante verrouillée
  const nextLocked = ZONES.find(z => !globalThis.isZoneUnlocked(z.id));
  if (nextLocked) {
    const req = nextLocked.repRequired || 0;
    if (req > 0)
      return { text: `🗺 Débloquer ${nextLocked.fr}`, detail: `Rép. ${rep}/${req}`, tab: 'tabZones' };
  }
  if (agents < 3)
    return { text: `👥 Avoir ${agents+1} agents`, detail: `${agents}/3`, tab: 'tabAgents' };
  if (dex < 151)
    return { text: `📖 Pokédex ${dex}/151`, detail: `${151 - dex} espèces manquantes`, tab: 'tabPokedex' };
  return { text: '🏆 Pokédex complet — Tu domines Kanto !', detail: null, tab: null };
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

function activateBoost(boostId) {
  const state = globalThis.state;
  if ((state.inventory[boostId] || 0) <= 0) return false;
  state.inventory[boostId]--;
  const duration = globalThis.BOOST_DURATIONS[boostId] || 90000;
  // Cumulate: extend from current expiry if already active, else from now
  const base = Math.max(Date.now(), state.activeBoosts[boostId] || 0);
  state.activeBoosts[boostId] = base + duration;
  globalThis.saveState();
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
